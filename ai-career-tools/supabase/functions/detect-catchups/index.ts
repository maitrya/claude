/**
 * detect-catchups Edge Function
 * Prepped Talent — LinkedIn Networking Dashboard
 *
 * Deploy: supabase functions deploy detect-catchups
 * Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *
 * POST body: {
 *   threads: Array<{ threadId: string, contactName: string, messages: Array<{ from: string, to: string, date: string, content: string }> }>,
 *   candidateName: string
 * }
 *
 * Response: {
 *   flags: Array<{ threadId: string, catchup: boolean, contactName: string, approximateDate: string|null, excerpt: string }>
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { threads, candidateName } = await req.json();

    if (!threads || !Array.isArray(threads)) {
      return new Response(JSON.stringify({ error: 'threads array required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const flags: Array<{
      threadId: string;
      catchup: boolean;
      contactName: string;
      approximateDate: string | null;
      excerpt: string;
    }> = [];

    for (const thread of threads) {
      try {
        const { threadId, contactName, messages } = thread;

        // Build thread text for the prompt
        const threadText = messages
          .map((m: { from: string; to: string; date: string; content: string }) =>
            `[${m.date}] ${m.from} → ${m.to}: ${m.content}`
          )
          .join('\n');

        const prompt = `You are analysing a LinkedIn message thread to determine if a catch-up meeting was agreed.

Candidate name: ${candidateName || 'Unknown'}
Other person: ${contactName || 'Unknown'}

Thread:
${threadText}

Task: Determine if a meeting was clearly AGREED (not just suggested or discussed) in this conversation.

Return ONLY valid JSON in this exact format (no other text):
{
  "catchup": true or false,
  "approximateDate": "YYYY-MM-DD" or null,
  "excerpt": "the specific line that confirms the meeting, max 100 chars" or ""
}

Rules:
- catchup = true ONLY if there is clear confirmation that both parties agreed to meet
- If someone just suggested meeting without a response confirming it, catchup = false
- approximateDate: extract from context if mentioned (e.g. "next Tuesday", "3pm Friday"), otherwise null
- excerpt: the single message snippet that most clearly shows the agreement`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (!response.ok) {
          console.error(`Claude API error for thread ${threadId}: ${response.status}`);
          continue; // Skip this thread, don't fail everything
        }

        const aiResult = await response.json();
        const text = aiResult?.content?.[0]?.text?.trim() || '';

        let parsed: { catchup: boolean; approximateDate: string | null; excerpt: string };
        try {
          parsed = JSON.parse(text);
        } catch {
          console.error(`Failed to parse AI response for thread ${threadId}: ${text}`);
          continue; // Skip malformed responses
        }

        flags.push({
          threadId,
          catchup: !!parsed.catchup,
          contactName: contactName || '',
          approximateDate: parsed.approximateDate || null,
          excerpt: (parsed.excerpt || '').slice(0, 100),
        });
      } catch (threadErr) {
        console.error(`Error processing thread ${thread.threadId}:`, threadErr);
        // Skip this thread — don't let one failure break everything
        continue;
      }
    }

    return new Response(JSON.stringify({ flags }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('detect-catchups error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
