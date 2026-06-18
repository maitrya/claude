// DCF Model Reviewer — Edge Function v24
// Receives a JSON payload from the browser frontend (which has already
// parsed the .xlsx with ExcelJS), runs Gemini against the rubric +
// model answer, and writes an audit row to dcf_submissions.
//
// Required env vars:
//   GEMINI_API_KEY — Google AI Studio API key (free tier: 15 RPM, 1500/day)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — for audit logging
//
// Deploy: supabase functions deploy grade-dcf --no-verify-jwt
// Frontend lives at dcf-grader/app.js — it parses Excel client-side and
// sends { candidate_id, file_name, context, matched, missing_categories,
// naming_deviations, all_sheets } as JSON.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const sb = SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

async function logSubmission(row: Record<string, unknown>): Promise<void> {
  if (!sb) return;
  const { error } = await sb.from('dcf_submissions').insert(row);
  if (error) console.error('[grade-dcf] audit insert failed:', error.message);
}

const GEMINI_MODEL  = 'gemini-2.0-flash';
const MAX_CONTEXT_CHARS = 40000; // frontend caps at 35k; allow a bit of headroom

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', ...CORS },
});

// ─── Rubric (embedded; edit + redeploy to update) ───────────────────────────
const RUBRIC = `
# DCF Grading Rubric (100 points total)

Layout: 3 logical sections must be present (Assumptions / P&L-like /
Valuation-like). Banker-style multi-tab layouts are accepted (e.g.
'Assumptions' + 'Company fin forecasts' + 'Financials' + 'DCF input' +
'DCF output'). Tab naming is flexible — only deduct if a section is
missing entirely. Reference whichever tab the candidate uses when
commenting.

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
- Formulas dynamic from Assumptions — no hardcodes embedded in formula cells in P&L / Valuation sections (4)
- 3 logical sections present (Assumptions / P&L-like / Valuation-like); banker-style naming accepted, only deduct if a section is missing (4)
- Layout clean — labelled sections, consistent structure, no merged cells blocking formulas (2)

## Commentary requirements
- Reference SPECIFIC CELLS when flagging issues (e.g. "Cell D14 on the P&L tab")
- Be ACTIONABLE — say what to fix
- If you cannot assess something (missing section, parsing failure), say so explicitly and award partial marks
- Use whole numbers for scores
`;

// ─── Model answer (Tap & Turf Holdings Pty Ltd reference build) ─────────────
const MODEL_ANSWER = `
## Case study: Tap & Turf Holdings Pty Ltd (AU stadium beverage concessions)
- Transaction date: 31 March 2026 (FY26)
- Last historical FYE: 31 March 2025 (FY25)
- Forecast horizon: 6 years (FY26 → FY31), AUD millions
- Capital structure: all-equity (net cash, asset-light); deal struck cash-free / debt-free → EV = equity value

## Driver assumptions (Assumptions tab)
- Revenue growth: 6.0% p.a. flat (CFO midpoint of 5–7%)
- EBITDA margin: 8.72% flat (FY24–25 clean average)
- D&A / revenue: 3.80% (FY25 ratio)
- Capex / revenue: 3.00% (2% maintenance + 1% step-up, full horizon)
- Change in WC / revenue: 1.50% OUTFLOW (not an inflow)
- Effective tax rate: 19%

## Expected P&L outputs (±5% acceptable, driven from Assumptions tab)
| Year | Revenue | EBITDA | EBITDA margin | D&A | EBIT |
| FY26 | 1,529 | 133.3 | 8.72% | (58.1) | 75.2 |
| FY27 | 1,621 | 141.3 | 8.72% | (61.6) | 79.7 |
| FY28 | 1,718 | 149.8 | 8.72% | (65.3) | 84.5 |
| FY29 | 1,821 | 158.8 | 8.72% | (69.2) | 89.6 |
| FY30 | 1,931 | 168.3 | 8.72% | (73.4) | 95.0 |
| FY31 | 2,046 | 178.4 | 8.72% | (77.8) | 100.7 |

## Expected WACC (±100bps; candidates build CAPM from given inputs)
- Risk-free rate (AU 10Y): 4.90% (RBA, late May 2026)
- Equity risk premium: 5.50% (KPMG ANZ MRP)
- Comparable beta peer set: Endeavour Group (β 0.41), CCEP (0.38), Compass (0.64), Aramark (1.20), Aristocrat (0.42); average unlevered β ≈ 0.30
- Specific risk premium: 1.50% (venue concentration + private illiquidity)
- All-equity capital structure (net cash) → WACC = cost of equity ≈ 8.03%

## Terminal value — BOTH methods expected
- Perpetuity growth: 2.5% (sourced in the brief to IBISWorld's central-case long-run industry growth rate, post-Olympic moderation paragraph)
- Exit EBITDA multiple: 13.28× — median trading EV/EBITDA of the SAME peer set (EDV 7.64, CCEP 13.28, CPG 14.15, ARMK 12.96, ALL 13.37)

## Expected Valuation outputs (±10% acceptable per methodology)
| Component | Perpetuity Growth | Exit EBITDA Multiple (13.28×) |
| Sum of PV(FCF) | $277m | $277m |
| PV(Terminal Value) | $784m | $1,490m |
| Enterprise Value | $1,060m | $1,768m |
| Net debt & adjustments | nil | nil |
| Equity Value (= EV, debt-free) | $1,060m | $1,768m |

Both methods are expected. Perpetuity is the more grounded figure for this niche operator; the 13.28× peer median is large-cap and diversified — credit candidates who flag that it likely overstates value and treat the multiple as an upper-bound cross-check.

## Common pitfalls to flag (cell-specific commentary required)
- Hardcoded revenue in the P&L section (must drive from Assumptions)
- Using the template's yellow "<<<" hints (1% terminal growth, 9% terminal margin, D&A as % of capex) instead of the PDF CFO commentary
- Treating ΔWC as an inflow (brief explicitly says ~1.5% outflow)
- Capex stuck at 2% maintenance (brief says combined 3% for the full horizon)
- EBITDA *post*-exceptionals used as run-rate margin (use clean, recent 2yrs)
- Forecasting margin expansion (CFO explicitly said it holds flat)
- Using a terminal growth rate other than ~2.5% without sourcing it (the brief explicitly references IBISWorld's long-run industry growth)
- Effective tax rate inconsistency between the WACC build and the FCF tax line (19% throughout)
- Net debt applied in the equity bridge (deal is cash-free/debt-free; EV = equity)
- Capitalising the WA/SA expansion (brief instructs base case excludes these)
- Terminal value not discounted back to present
- Cost of debt not tax-effected in WACC build
- Taking the 13.28× exit multiple at face value without flagging the comp-set caveat (large-cap, diversified peers overstate value vs perpetuity-implied ~7.0×)

## Grading approach
- Reference SPECIFIC cells (e.g. "P&L!D14" or "DCF input!Q24") when flagging issues
- Award partial marks generously when the structural approach is correct
- Currency choice (AUD/USD) doesn't matter; internal consistency does
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
      description: 'Cell-level formatting violations, e.g. "Cell P&L!D14 contains a hardcoded value formatted in black."',
    },
  },
  required: ['totalScore', 'components', 'formattingViolations'],
};

async function callGemini(workbookContext: string, candidateId: string, matched: Record<string, string>, missingCategories: string[]): Promise<any> {
  const layoutNote = `## Candidate's tab mapping
- Assumptions section: ${matched['Assumptions'] || 'MISSING'}
- P&L section: ${matched['P&L'] || 'MISSING'}
- Valuation section: ${matched['Valuation Calculation'] || 'MISSING'}
${missingCategories.length > 0 ? `\nMISSING categories (deduct accordingly): ${missingCategories.join(', ')}` : ''}`;

  const systemInstruction = `You are a strict, consistent DCF model grader for an M&A interview prep program.

You receive a parsed Excel workbook (cell values, formulas, font colours per cell). Grade the candidate's submission against the rubric below.

${RUBRIC}

## Model Answer (reference)
${MODEL_ANSWER}

${layoutNote}

## Candidate name / identifier
${candidateId}

## Important rules
- Be SPECIFIC and ACTIONABLE in commentary. Reference cell addresses (e.g. "P&L!D14").
- If a LOGICAL SECTION is missing (see layout note), award 0 for the affected component(s) and call it out. Banker-style tab names that map to a section count — do NOT penalise tab naming.
- For formatting: blue = font color starting with "FF0000FF" or RGB blue. Theme colors (e.g. "theme:5") may also be blue depending on theme — if uncertain, mention it.
- Whole-number scores only. The sum of component scores MUST equal totalScore.
- Always return all 4 components in the components array, even if a tab is missing (score 0 in that case).`;

  const userMessage = `Here is the parsed workbook content. Grade it strictly against the rubric.\n\n${workbookContext}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
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
  if (!text) {
    throw new Error(`Gemini returned no text. Full response: ${JSON.stringify(data).slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON: ${text.slice(0, 200)}`);
  }
}

// ─── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405);

  if (!GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY not configured on the server.' }, 500);
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

    console.log(`[grade-dcf] candidate=${candidateId} file=${fileName} ctx=${context.length}b matched=${Object.keys(matched).length}/3 missing=${missingCategories.join(',')||'none'}`);

    let report;
    try {
      report = await callGemini(context, candidateId, matched, missingCategories);
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

    const summed = (report.components || []).reduce((s: number, c: any) => s + (Number(c.score) || 0), 0);
    if (Math.abs(summed - report.totalScore) > 1) report.totalScore = summed;

    report.meta = {
      candidate_id: candidateId,
      file_name: fileName,
      processing_ms: Date.now() - t0,
      missing_categories: missingCategories,
      matched,
    };

    await logSubmission({
      candidate_id: candidateId,
      file_name: fileName,
      total_score: report.totalScore,
      report,
      processing_ms: Date.now() - t0,
      parsed_tabs: allSheets,
      missing_tabs: missingCategories,
    });

    console.log(`[grade-dcf] done in ${Date.now()-t0}ms score=${report.totalScore}/100`);
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
