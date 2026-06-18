/**
 * detect-catchups Edge Function
 * Prepped Talent — LinkedIn Networking Dashboard
 *
 * Scans messages (outbound only) for catch-up signals — pre-arranged calls,
 * post-meeting acknowledgements, scheduled coffees — and writes high-confidence
 * matches to `catchup_flags` as status='pending' for human review.
 *
 * Two-stage pipeline:
 *   1. RPC `get_catchup_candidate_threads` does regex pre-filter + dedupe in DB
 *   2. For each candidate, Claude Haiku classifies and extracts an excerpt
 *
 * POST body:
 *   {
 *     "mode": "backfill" | "incremental",   // default: backfill
 *     "user_id": "<uuid>",                  // optional, scope to one user
 *     "since": "YYYY-MM-DD",                // optional; incremental defaults to last 14d
 *     "dry_run": true,                      // skip DB inserts, return what would be flagged
 *     "limit": 500                          // safety cap on candidates processed
 *   }
 *
 * Deploy: supabase functions deploy detect-catchups
 * Secret: ANTHROPIC_API_KEY must already be set (shared with grade-dcf)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const THROTTLE_MS = 200;
const MAX_THREAD_MESSAGES = 30;

interface Body {
  mode?: 'backfill' | 'incremental';
  user_id?: string;
  since?: string;
  dry_run?: boolean;
  limit?: number;
}

interface Candidate {
  user_id: string;
  recipient: string;
  msg_count: number;
  latest_sent: string;
}

interface Msg {
  sent_at: string;
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const mode = body.mode || 'backfill';
  const dryRun = body.dry_run === true;
  const limit = Math.min(body.limit ?? 500, 1000);

  const since = body.since
    || (mode === 'incremental'
      ? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : null);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  if (!supabaseUrl || !serviceKey) return json({ error: 'Supabase env missing' }, 500);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: candidatesRaw, error: rpcErr } = await supabase
    .rpc('get_catchup_candidate_threads', {
      p_user_id: body.user_id ?? null,
      p_since: since,
    });

  if (rpcErr) return json({ error: 'candidate RPC failed', detail: rpcErr.message }, 500);

  const candidates = ((candidatesRaw as Candidate[]) || []).slice(0, limit);

  const summary = {
    mode,
    dry_run: dryRun,
    user_id: body.user_id ?? null,
    since,
    total_candidates: (candidatesRaw as Candidate[] | null)?.length ?? 0,
    scanned: candidates.length,
    flags_created: 0,
    not_catchup: 0,
    ai_errors: 0,
    insert_errors: 0,
    sample: [] as Array<{ user_id: string; contact: string; date: string | null; excerpt: string }>,
  };

  for (const c of candidates) {
    const { data: msgs, error: msgErr } = await supabase
      .from('messages')
      .select('sent_at, content')
      .eq('user_id', c.user_id)
      .eq('recipient', c.recipient)
      .order('sent_at', { ascending: true })
      .limit(MAX_THREAD_MESSAGES);

    if (msgErr || !msgs || msgs.length === 0) {
      summary.ai_errors++;
      continue;
    }

    const threadText = (msgs as Msg[])
      .map((m) => `[${m.sent_at}] ${(m.content || '').slice(0, 500)}`)
      .join('\n');

    const prompt = buildPrompt(c.recipient, threadText);

    let aiText = '';
    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: HAIKU_MODEL,
          max_tokens: 250,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!aiRes.ok) {
        console.error(`Haiku ${aiRes.status} for ${c.recipient}`);
        summary.ai_errors++;
        await sleep(THROTTLE_MS);
        continue;
      }
      const aiJson = await aiRes.json();
      aiText = aiJson?.content?.[0]?.text?.trim() ?? '';
    } catch (err) {
      console.error(`Haiku fetch failed for ${c.recipient}:`, err);
      summary.ai_errors++;
      await sleep(THROTTLE_MS);
      continue;
    }

    let parsed: { catchup: boolean; approximate_date: string | null; excerpt: string };
    try {
      parsed = JSON.parse(extractJson(aiText));
    } catch {
      console.error(`Bad JSON for ${c.recipient}: ${aiText.slice(0, 200)}`);
      summary.ai_errors++;
      await sleep(THROTTLE_MS);
      continue;
    }

    if (!parsed.catchup) {
      summary.not_catchup++;
      await sleep(THROTTLE_MS);
      continue;
    }

    const approxDate = isValidDate(parsed.approximate_date)
      ? parsed.approximate_date
      : (msgs as Msg[])[msgs.length - 1].sent_at;
    const weekKey = isoWeekStart(approxDate as string);
    const excerpt = (parsed.excerpt || '').slice(0, 200);

    if (!dryRun) {
      const { error: insErr } = await supabase.from('catchup_flags').insert({
        user_id: c.user_id,
        thread_id: c.recipient,
        contact_name: c.recipient,
        week_key: weekKey,
        approximate_date: isValidDate(parsed.approximate_date) ? parsed.approximate_date : null,
        excerpt,
        status: 'pending',
      });
      if (insErr) {
        console.error(`Insert failed for ${c.recipient}:`, insErr.message);
        summary.insert_errors++;
        await sleep(THROTTLE_MS);
        continue;
      }
    }

    summary.flags_created++;
    if (summary.sample.length < 15) {
      summary.sample.push({
        user_id: c.user_id,
        contact: c.recipient,
        date: parsed.approximate_date,
        excerpt,
      });
    }

    await sleep(THROTTLE_MS);
  }

  return json(summary, 200);
});

function buildPrompt(contactName: string, threadText: string): string {
  return `You analyse a LinkedIn DM thread to detect whether the user had — or firmly scheduled — a real meeting/call/catch-up with a contact.

IMPORTANT: These messages are ONE-SIDED. Only the user's outbound messages are shown; the contact's replies are NOT visible. Infer purely from the user's wording.

Contact: ${contactName}

Thread (user's messages, oldest first):
${threadText}

A "catch-up" qualifies when ANY of the following is clearly present:
- The user references a past meeting that occurred ("great chatting yesterday", "thanks for the call", "loved our coffee", "amazing chat last week")
- The user firmly confirms an imminent scheduled meeting ("3pm works for me", "see you Tuesday", "still free to call?", "looking forward to our chat tomorrow")
- The user discusses logistics of a confirmed meeting (time, location, calendar link, dial-in)

A catch-up does NOT qualify when:
- The user only proposes a meeting without visible confirmation ("happy to chat if you'd like", "let me know if you want to jump on a call")
- Generic intro outreach, cold pitches, marketing nudges, follow-ups asking for a reply
- Forwarded links or asks for the contact to book a time (no evidence they did)

Return ONLY a valid JSON object, with NO surrounding prose or markdown. Schema:
{
  "catchup": true | false,
  "approximate_date": "YYYY-MM-DD" or null,
  "excerpt": "the single most telling line, max 140 chars"
}`;
}

function extractJson(text: string): string {
  // Strip markdown fences if Haiku ignores instructions
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function isValidDate(d: string | null | undefined): boolean {
  if (!d || typeof d !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = Date.parse(d + 'T00:00:00Z');
  return !Number.isNaN(t);
}

function isoWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
