// DCF Model Reviewer — Edge Function
// Receives an .xlsx file, extracts cell values + formulas + font colours
// from the three required tabs (P&L, Valuation Calculation, Assumptions),
// then calls Gemini to grade against the embedded rubric + model answer.
//
// Required env vars:
//   GEMINI_API_KEY — Google AI Studio API key (free tier: 15 RPM, 1500/day)
//                    Get one at https://aistudio.google.com/apikey
//
// Deploy: supabase functions deploy grade-dcf

import { createClient } from 'jsr:@supabase/supabase-js@2';
import ExcelJS from 'npm:exceljs@4.4.0';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
// gemini-2.0-flash is free, fast, supports structured JSON output via responseSchema.
// Upgrade to gemini-2.5-flash or gemini-1.5-pro for better quality if needed (still free tier).
const GEMINI_MODEL  = 'gemini-2.0-flash';
const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12MB hard cap (UI sets 10MB)

const REQUIRED_TABS = ['P&L', 'Valuation Calculation', 'Assumptions'];

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
// Source: dcf-grader/tools/tap-turf-dcf.py → dcf-grader/config/tap-turf-model-answer.md
// Refresh when real comp set EV/EBITDA and WACC inputs land.
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
- Comparable beta peer set: Endeavour Group (β 0.41), CCEP (0.35), Compass (0.64), Aramark (1.20), Aristocrat (0.42); average unlevered β ≈ 0.30
- Specific risk premium: 1.50% (venue concentration + private illiquidity)
- All-equity capital structure (net cash) → WACC = cost of equity ≈ 8.07%

## Terminal value — BOTH methods expected
- Perpetuity growth: 2.5%
- Exit EBITDA multiple: 12.96× — median trading EV/EBITDA of the SAME peer set (EDV 7.64, CCEP ~10.00, CPG 14.15, ARMK 12.96, ALL 13.37; CCEP partly estimated)

## Expected Valuation outputs (±10% acceptable per methodology)
| Component | Perpetuity Growth | Exit EBITDA Multiple (12.96×) |
| Sum of PV(FCF) | $276m | $276m |
| PV(Terminal Value) | $777m | $1,452m |
| Enterprise Value | $1,053m | $1,728m |
| Net debt & adjustments | nil | nil |
| Equity Value (= EV, debt-free) | $1,053m | $1,728m |

Both methods are expected. Perpetuity is the more grounded figure for this niche operator; the 12.96× peer median is large-cap and diversified — credit candidates who flag that it likely overstates value and treat the multiple as an upper-bound cross-check.

## Common pitfalls to flag (cell-specific commentary required)
- Hardcoded revenue in the P&L section (must drive from Assumptions)
- Using the template's yellow "<<<" hints (1% terminal growth, 9% terminal margin, D&A as % of capex) instead of the PDF CFO commentary
- Treating ΔWC as an inflow (brief explicitly says ~1.5% outflow)
- Capex stuck at 2% maintenance (brief says combined 3% for the full horizon)
- EBITDA *post*-exceptionals used as run-rate margin (use clean, recent 2yrs)
- Forecasting margin expansion (CFO explicitly said it holds flat)
- Effective tax rate inconsistency between the WACC build and the FCF tax line (19% throughout)
- Net debt applied in the equity bridge (deal is cash-free/debt-free; EV = equity)
- Capitalising the WA/SA expansion (brief instructs base case excludes these)
- Terminal value not discounted back to present
- Cost of debt not tax-effected in WACC build
- Taking the 10.5× exit multiple at face value without flagging the comp-set caveat

## Grading approach
- Reference SPECIFIC cells (e.g. "P&L!D14" or "DCF input!Q24") when flagging issues
- Award partial marks generously when the structural approach is correct
- Currency choice (AUD/USD) doesn't matter; internal consistency does
`;

// ─── Output schema enforced by Gemini's responseSchema ──────────────────────
// JSON Schema (subset Gemini supports). Guarantees the response shape.
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

// ─── Excel parsing ──────────────────────────────────────────────────────────
type ParsedCell = {
  ref: string;              // e.g. "P&L!D14"
  value: string | number | null;
  formula: string | null;
  fontColor: string | null; // e.g. "FF0000FF" or null
};

type ParsedTab = {
  name: string;
  rowCount: number;
  colCount: number;
  cells: ParsedCell[];
};

async function parseWorkbook(buffer: ArrayBuffer): Promise<{ tabs: ParsedTab[]; missingTabs: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const presentNames = wb.worksheets.map(ws => ws.name.trim());
  const missingTabs = REQUIRED_TABS.filter(req => !presentNames.some(p => p.toLowerCase() === req.toLowerCase()));

  const tabs: ParsedTab[] = [];
  for (const ws of wb.worksheets) {
    const cells: ParsedCell[] = [];
    let maxRow = 0, maxCol = 0;
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      maxRow = Math.max(maxRow, rowNum);
      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        maxCol = Math.max(maxCol, colNum);
        const formula = (cell.formula || (cell.value as any)?.formula) ?? null;
        let value: any = cell.value;
        if (value && typeof value === 'object' && 'result' in value) value = (value as any).result;
        if (value && typeof value === 'object' && 'richText' in value) {
          value = (value as any).richText.map((r: any) => r.text).join('');
        }
        // font colour can be: { argb: 'FF0000FF' } or { theme: 1, tint: 0 } or undefined
        const colorObj = cell.font?.color as any;
        let fontColor: string | null = null;
        if (colorObj?.argb)        fontColor = colorObj.argb;
        else if (colorObj?.theme != null) fontColor = `theme:${colorObj.theme}`;
        else if (colorObj?.indexed != null) fontColor = `indexed:${colorObj.indexed}`;

        cells.push({
          ref: `${ws.name}!${cell.address}`,
          value: typeof value === 'number' || typeof value === 'string' ? value : (value == null ? null : String(value)),
          formula: formula ? String(formula) : null,
          fontColor,
        });
      });
    });
    tabs.push({ name: ws.name, rowCount: maxRow, colCount: maxCol, cells });
  }

  return { tabs, missingTabs };
}

// Compress parsed workbook into a string Claude can ingest.
// Includes only useful cells (has value or formula) and trims to fit context.
function workbookToContext(tabs: ParsedTab[]): string {
  const lines: string[] = [];
  for (const tab of tabs) {
    lines.push(`\n=== TAB: ${tab.name} (${tab.rowCount} rows × ${tab.colCount} cols) ===`);
    const interesting = tab.cells.filter(c => c.value != null || c.formula != null);
    // Cap per tab to keep context manageable
    const capped = interesting.slice(0, 800);
    for (const c of capped) {
      const parts = [c.ref];
      if (c.formula) parts.push(`formula: ${c.formula}`);
      if (c.value != null) parts.push(`value: ${typeof c.value === 'string' ? JSON.stringify(c.value).slice(0, 80) : c.value}`);
      if (c.fontColor) parts.push(`color: ${c.fontColor}`);
      lines.push(parts.join(' | '));
    }
    if (interesting.length > capped.length) {
      lines.push(`... (${interesting.length - capped.length} more cells truncated)`);
    }
  }
  return lines.join('\n');
}

// ─── Gemini API ─────────────────────────────────────────────────────────────
async function callGemini(workbookContext: string, candidateId: string): Promise<any> {
  const systemInstruction = `You are a strict, consistent DCF model grader for an M&A interview prep program.

You receive a parsed Excel workbook (cell values, formulas, font colours per cell). Grade the candidate's submission against the rubric below.

${RUBRIC}

## Model Answer (reference)
${MODEL_ANSWER}

## Candidate name / identifier
${candidateId}

## Important rules
- Be SPECIFIC and ACTIONABLE in commentary. Reference cell addresses (e.g. "P&L!D14").
- If a tab is missing, award 0 for the affected component(s) and call it out in the commentary.
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
        temperature: 0.2, // low temperature for consistent grading
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
  } catch (e) {
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

  try {
    const formData = await req.formData();
    const candidateId = String(formData.get('candidate_id') || '').trim();
    const file = formData.get('file');

    if (!candidateId)              return json({ error: 'Missing candidate identifier.' }, 400);
    if (!(file instanceof File))   return json({ error: 'Missing file upload.' }, 400);
    if (!file.name.toLowerCase().endsWith('.xlsx'))
                                    return json({ error: 'File must be .xlsx format.' }, 400);
    if (file.size > MAX_FILE_BYTES) return json({ error: `File too large (max ${(MAX_FILE_BYTES/1024/1024).toFixed(0)}MB).` }, 400);

    const buffer = await file.arrayBuffer();
    console.log(`[grade-dcf] received file=${file.name} size=${file.size} candidate=${candidateId}`);

    let parsed;
    try {
      parsed = await parseWorkbook(buffer);
    } catch (e) {
      console.error('[grade-dcf] parse error:', e);
      return json({ error: 'Could not parse the Excel file. Make sure it is a valid .xlsx file (not .xls or password-protected).' }, 400);
    }

    console.log(`[grade-dcf] parsed tabs=${parsed.tabs.map(t => t.name).join(', ')} missing=${parsed.missingTabs.join(', ')||'none'}`);

    if (parsed.tabs.length === 0) {
      return json({ error: 'The workbook has no readable sheets.' }, 400);
    }

    const context = workbookToContext(parsed.tabs);
    console.log(`[grade-dcf] context length=${context.length} chars`);

    let report;
    try {
      report = await callGemini(context, candidateId);
    } catch (e) {
      console.error('[grade-dcf] AI error:', e);
      return json({ error: 'AI grading service is currently unavailable. Please try again in a minute.' }, 503);
    }

    // Sanity check — ensure score adds up; if not, trust components
    const summed = (report.components || []).reduce((s: number, c: any) => s + (Number(c.score) || 0), 0);
    if (Math.abs(summed - report.totalScore) > 1) report.totalScore = summed;

    report.meta = {
      candidate_id: candidateId,
      file_name: file.name,
      processing_ms: Date.now() - t0,
      missing_tabs: parsed.missingTabs,
      parsed_tabs: parsed.tabs.map(t => ({ name: t.name, cellCount: t.cells.length })),
    };

    console.log(`[grade-dcf] done in ${Date.now()-t0}ms score=${report.totalScore}/100`);
    return json(report);
  } catch (err) {
    console.error('[grade-dcf] unhandled:', err);
    return json({ error: (err as Error).message ?? 'Unknown error' }, 500);
  }
});
