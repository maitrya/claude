// DCF Model Reviewer — Edge Function v27
// Receives a JSON payload from the browser frontend (which has already
// parsed the .xlsx with ExcelJS), runs Claude Haiku against the rubric +
// model answer, falls back to Gemini if Claude errors, and writes an
// audit row to dcf_submissions.
//
// Required env vars:
//   ANTHROPIC_API_KEY — primary grader (Claude Haiku 4.5)
//   GEMINI_API_KEY    — fallback grader (Gemini 2.0 Flash, free tier)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — for audit logging

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
const GEMINI_API_KEY    = Deno.env.get('GEMINI_API_KEY') || '';
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const sb = SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

async function logSubmission(row: Record<string, unknown>): Promise<void> {
  if (!sb) return;
  const { error } = await sb.from('dcf_submissions').insert(row);
  if (error) console.error('[grade-dcf] audit insert failed:', error.message);
}

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const GEMINI_MODEL = 'gemini-2.0-flash';
const MAX_CONTEXT_CHARS = 40000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', ...CORS },
});

const RUBRIC = `
# DCF Grading Rubric (100 points total)

Layout: 3 logical sections must be present (Assumptions / P&L-like / Valuation-like). Banker-style multi-tab layouts are accepted. Tab naming flexible — only deduct if a section is missing entirely.

## P&L Build (40 points)
- Revenue dynamically driven from Assumptions; no hardcoded revenue in the P&L section (10)
- Cost line items correctly categorised + linked (10)
- EBITDA correctly derived, no manual overrides (8)
- D&A correctly treated, sourced from Assumptions, flows to EBIT (6)
- Key P&L outputs match model answer within ±5% (6)

## WACC (20 points)
- Cost of equity via CAPM with rf, β, ERP correctly sourced (6)
- Cost of debt correctly specified and tax-effected (4)
- Capital structure weights sum to 100% (4)
- Final WACC correctly assembled, no hardcodes (4)
- WACC output matches model answer within ±50bps (2)

## Valuation Calculation (20 points)
- FCF correctly derived from P&L (D&A back, capex out, ΔWC) (5)
- Discount factors correctly calculated and applied (4)
- Terminal value correctly calculated (Gordon or exit multiple), inputs from Assumptions (4)
- Enterprise value correctly assembled (4)
- Equity bridge handles net debt and adjustments (3)

## Formatting & Model Layout (20 points)
- Hardcoded inputs in blue font (6)
- Formula cells in black font (4)
- Formulas dynamic from Assumptions — no hardcodes embedded (4)
- 3 logical sections present; banker-style naming accepted, only deduct if a section is missing (4)
- Layout clean — labelled sections, consistent structure (2)

## Commentary requirements
- Reference SPECIFIC CELLS when flagging issues (e.g. "Cell D14 on the P&L tab")
- Be ACTIONABLE — say what to fix
- If you cannot assess something, say so explicitly and award partial marks
- Use whole numbers for scores
`;

const MODEL_ANSWER = `
## Case study: Tap & Turf Holdings Pty Ltd (AU stadium beverage concessions)
- Transaction date: 31 March 2026 (FY26)
- Forecast horizon: 6 years (FY26 → FY31), AUD millions
- Capital structure: all-equity (net cash); deal struck cash-free / debt-free → EV = equity value

## Driver assumptions
- Revenue growth: 6.0% p.a. flat (CFO midpoint of 5–7%)
- EBITDA margin: 8.72% flat (FY24–25 clean average)
- D&A / revenue: 3.80% (FY25 ratio)
- Capex / revenue: 3.00% (2% maintenance + 1% step-up)
- Change in WC / revenue: 1.50% OUTFLOW (not an inflow)
- Effective tax rate: 19%

## Expected P&L outputs (±5% acceptable)
| Year | Revenue | EBITDA | Margin | D&A | EBIT |
| FY26 | 1,529 | 133.3 | 8.72% | (58.1) | 75.2 |
| FY27 | 1,621 | 141.3 | 8.72% | (61.6) | 79.7 |
| FY28 | 1,718 | 149.8 | 8.72% | (65.3) | 84.5 |
| FY29 | 1,821 | 158.8 | 8.72% | (69.2) | 89.6 |
| FY30 | 1,931 | 168.3 | 8.72% | (73.4) | 95.0 |
| FY31 | 2,046 | 178.4 | 8.72% | (77.8) | 100.7 |

## Expected WACC (±100bps)
- Risk-free rate (AU 10Y): 4.90%
- Equity risk premium: 5.50%
- Peer beta set: EDV 0.41, CCEP 0.38, CPG 0.64, ARMK 1.20, ALL 0.42; avg unlevered β ≈ 0.30
- Specific risk premium: 1.50%
- All-equity → WACC = cost of equity ≈ 8.03%

## Terminal value — BOTH methods expected
- Perpetuity growth: 2.5% (IBISWorld long-run)
- Exit EBITDA multiple: 13.28× (peer median: EDV 7.64, CCEP 13.28, CPG 14.15, ARMK 12.96, ALL 13.37)

## Expected Valuation outputs (±10%)
| Component | Perpetuity | Exit Multiple |
| Sum PV(FCF) | $277m | $277m |
| PV(TV) | $784m | $1,490m |
| EV | $1,060m | $1,768m |
| Equity Value | $1,060m | $1,768m |

Both methods expected. Credit candidates who flag the multiple is large-cap and overstates value.

## Common pitfalls (cell-specific commentary required)
- Hardcoded revenue in the P&L
- Using template's yellow hints instead of CFO commentary
- Treating ΔWC as inflow (it's outflow)
- Capex stuck at 2% (it's 3% combined)
- Forecasting margin expansion (CFO said flat)
- Terminal growth other than ~2.5% without sourcing
- Net debt applied (it's cash-free/debt-free)
- TV not discounted
- Cost of debt not tax-effected
- 13.28× multiple taken at face value without caveat

## Grading approach
- Reference SPECIFIC cells (e.g. "P&L!D14")
- Award partial marks generously when approach is correct
- Currency choice doesn't matter; internal consistency does
`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    totalScore: { type: 'integer', description: 'Sum of all component scores, 0-100.' },
    components: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: ['P&L Build', 'WACC', 'Valuation Calculation', 'Formatting & Model Layout'] },
          score: { type: 'integer' },
          outOf: { type: 'integer' },
          commentary: { type: 'string', description: 'Specific written feedback referencing exact cells where applicable.' },
        },
        required: ['name', 'score', 'outOf', 'commentary'],
      },
    },
    formattingViolations: {
      type: 'array',
      items: { type: 'string' },
      description: 'Cell-level formatting violations.',
    },
  },
  required: ['totalScore', 'components', 'formattingViolations'],
};

function buildSystemInstruction(candidateId: string, matched: Record<string, string>, missingCategories: string[]): string {
  const layoutNote = `## Candidate's tab mapping
- Assumptions section: ${matched['Assumptions'] || 'MISSING'}
- P&L section: ${matched['P&L'] || 'MISSING'}
- Valuation section: ${matched['Valuation Calculation'] || 'MISSING'}
${missingCategories.length > 0 ? `\nMISSING categories (deduct accordingly): ${missingCategories.join(', ')}` : ''}`;

  return `You are a strict, consistent DCF model grader for an M&A interview prep program.

You receive a parsed Excel workbook (cell values, formulas, font colours per cell). Grade the candidate's submission against the rubric below.

${RUBRIC}

## Model Answer (reference)
${MODEL_ANSWER}

${layoutNote}

## Candidate name / identifier
${candidateId}

## Important rules
- Be SPECIFIC and ACTIONABLE in commentary. Reference cell addresses (e.g. "P&L!D14").
- If a LOGICAL SECTION is missing (see layout note), award 0 for the affected component(s) and call it out.
- For formatting: blue = font color starting with "FF0000FF" or RGB blue. Theme colors may also be blue — if uncertain, mention it.
- Whole-number scores only. The sum of component scores MUST equal totalScore.
- For EVERY component, score MUST satisfy 0 ≤ score ≤ outOf. NEVER award more than the component's outOf cap, even for "structural completeness" or "partial credit". The maximum credit possible is the outOf value.
- Always return all 4 components in the components array, even if a tab is missing (score 0 in that case).`;
}

const USER_PROMPT_PREFIX = 'Here is the parsed workbook content. Grade it strictly against the rubric.\n\n';

// Cheap pre-flight: catch obvious blank-template uploads before we burn an API call.
// The frontend JSON.stringify's string cell values, so error cells encode as
// v:"#DIV/0", v:"#REF", etc. (with literal quotes) — match either form.
// Threshold is low (>= 2) because a completed model should have ZERO broken
// references; even 2 is a strong signal of unpopulated Assumptions inputs.
function detectBlankTemplate(context: string): string | null {
  const errorMatches = context.match(/v:"?#(DIV\/0|REF|NAME|VALUE|NULL|N\/A|NUM)/g);
  if (errorMatches && errorMatches.length >= 2) {
    return `This workbook contains ${errorMatches.length} broken formula references (#DIV/0!, #REF!, etc.) — it looks like the candidate template with missing Assumptions inputs, not a completed model. Populate the Assumptions tab so downstream formulas resolve, then re-upload.`;
  }
  return null;
}

async function callClaude(workbookContext: string, candidateId: string, matched: Record<string, string>, missingCategories: string[]): Promise<any> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      temperature: 0.2,
      system: buildSystemInstruction(candidateId, matched, missingCategories),
      tools: [{
        name: 'submit_grade',
        description: 'Submit the DCF grading report.',
        input_schema: RESPONSE_SCHEMA,
      }],
      tool_choice: { type: 'tool', name: 'submit_grade' },
      messages: [{ role: 'user', content: USER_PROMPT_PREFIX + workbookContext }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const block = (data.content || []).find((b: any) => b.type === 'tool_use' && b.name === 'submit_grade');
  if (!block?.input) {
    throw new Error(`Anthropic returned no tool_use block. stop_reason=${data.stop_reason}`);
  }
  return block.input;
}

async function callGemini(workbookContext: string, candidateId: string, matched: Record<string, string>, missingCategories: string[]): Promise<any> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemInstruction(candidateId, matched, missingCategories) }] },
      contents: [{ role: 'user', parts: [{ text: USER_PROMPT_PREFIX + workbookContext }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        maxOutputTokens: 2048,
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error(`Gemini returned no text. Full response: ${JSON.stringify(data).slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON: ${text.slice(0, 200)}`);
  }
}

async function gradeWithFallback(
  workbookContext: string,
  candidateId: string,
  matched: Record<string, string>,
  missingCategories: string[],
): Promise<{ report: any; provider: string; fallbackReason: string | null }> {
  try {
    const report = await callClaude(workbookContext, candidateId, matched, missingCategories);
    return { report, provider: CLAUDE_MODEL, fallbackReason: null };
  } catch (claudeErr) {
    const claudeMsg = (claudeErr as Error).message ?? 'unknown';
    console.warn(`[grade-dcf] Claude failed, falling back to Gemini: ${claudeMsg}`);
    try {
      const report = await callGemini(workbookContext, candidateId, matched, missingCategories);
      return { report, provider: GEMINI_MODEL, fallbackReason: claudeMsg };
    } catch (geminiErr) {
      const geminiMsg = (geminiErr as Error).message ?? 'unknown';
      throw new Error(`Both providers failed. Claude: ${claudeMsg} | Gemini: ${geminiMsg}`);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405);

  if (!ANTHROPIC_API_KEY && !GEMINI_API_KEY) {
    return json({ error: 'No AI provider configured on the server.' }, 500);
  }

  const t0 = Date.now();
  let candidateId = '';
  let fileName = '';

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ error: 'Request body must be JSON.' }, 400);
    }

    candidateId = String(body.candidate_id || '').trim();
    fileName    = String(body.file_name || '').trim();
    const context           = String(body.context || '');
    const matched           = (body.matched && typeof body.matched === 'object') ? body.matched : {};
    const missingCategories = Array.isArray(body.missing_categories) ? body.missing_categories.map(String) : [];
    const allSheets         = Array.isArray(body.all_sheets) ? body.all_sheets.map(String) : [];

    if (!candidateId) return json({ error: 'Missing candidate identifier.' }, 400);
    if (!fileName)    return json({ error: 'Missing file_name.' }, 400);
    if (!context)     return json({ error: 'Missing parsed workbook context.' }, 400);
    if (context.length > MAX_CONTEXT_CHARS) {
      return json({ error: `Context too large (${context.length} chars, max ${MAX_CONTEXT_CHARS}).` }, 400);
    }

    const templateWarning = detectBlankTemplate(context);
    if (templateWarning) {
      console.log(`[grade-dcf] blank-template detected file=${fileName}`);
      await logSubmission({
        candidate_id: candidateId,
        file_name: fileName,
        error: `template: ${templateWarning}`,
        processing_ms: Date.now() - t0,
        parsed_tabs: allSheets,
        missing_tabs: missingCategories,
      });
      return json({ error: templateWarning }, 400);
    }

    console.log(`[grade-dcf] candidate=${candidateId} file=${fileName} ctx=${context.length}b matched=${Object.keys(matched).length}/3 missing=${missingCategories.join(',')||'none'}`);

    let report: any;
    let provider: string;
    let fallbackReason: string | null;
    try {
      ({ report, provider, fallbackReason } = await gradeWithFallback(context, candidateId, matched, missingCategories));
    } catch (e) {
      console.error('[grade-dcf] AI error:', e);
      await logSubmission({
        candidate_id: candidateId,
        file_name: fileName,
        error: `ai: ${(e as Error).message ?? 'unknown'}`,
        processing_ms: Date.now() - t0,
        parsed_tabs: allSheets,
        missing_tabs: missingCategories,
      });
      return json({ error: 'AI grading service is currently unavailable. Please try again in a minute.' }, 503);
    }

    // Clamp each component score to [0, outOf]. The schema doesn't enforce this and
    // models occasionally award "partial credit" above the cap (e.g. 28/20 for
    // "structural completeness"). Rebuild totalScore from the clamped values.
    for (const c of (report.components || [])) {
      const raw = Number(c.score) || 0;
      const cap = Number(c.outOf) || 0;
      c.score = Math.max(0, Math.min(cap, raw));
    }
    report.totalScore = (report.components || []).reduce((s: number, c: any) => s + (Number(c.score) || 0), 0);

    report.meta = {
      candidate_id: candidateId,
      file_name: fileName,
      processing_ms: Date.now() - t0,
      missing_categories: missingCategories,
      matched,
      provider,
      fallback_reason: fallbackReason,
    };

    await logSubmission({
      candidate_id: candidateId,
      file_name: fileName,
      total_score: report.totalScore,
      report,
      provider,
      fallback_reason: fallbackReason,
      processing_ms: Date.now() - t0,
      parsed_tabs: allSheets,
      missing_tabs: missingCategories,
    });

    console.log(`[grade-dcf] done in ${Date.now()-t0}ms score=${report.totalScore}/100 provider=${provider}${fallbackReason ? ' (fallback)' : ''}`);
    return json(report);
  } catch (err) {
    console.error('[grade-dcf] unhandled:', err);
    await logSubmission({
      candidate_id: candidateId || 'unknown',
      file_name: fileName || 'unknown',
      error: `unhandled: ${(err as Error).message ?? 'unknown'}`,
      processing_ms: Date.now() - t0,
    });
    return json({ error: (err as Error).message ?? 'Unknown error' }, 500);
  }
});
