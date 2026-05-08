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

## P&L Build (40 points) — assesses the "P&L" tab
- Revenue assumptions dynamically driven from Assumptions tab; no hardcoded revenue in P&L (10)
- Cost line items correctly categorised + linked (10)
- EBITDA correctly derived, no manual overrides (8)
- D&A correctly treated, sourced from Assumptions, flows to EBIT (6)
- Key P&L outputs match model answer within ±5% (6)

## WACC (20 points) — assesses the "Assumptions" tab
- Cost of equity via CAPM with rf, β, ERP correctly sourced (6)
- Cost of debt correctly specified and tax-effected (4)
- Capital structure weights sum to 100% (4)
- Final WACC correctly assembled, no hardcodes (4)
- WACC output matches model answer within ±50bps (2)

## Valuation Calculation (20 points) — assesses the "Valuation Calculation" tab
- FCF correctly derived from P&L (D&A back, capex out, ΔWC) (5)
- Discount factors correctly calculated and applied (4)
- Terminal value correctly calculated, inputs from Assumptions (4)
- Enterprise value correctly assembled (4)
- Equity bridge handles net debt and adjustments (3)

## Formatting & Model Layout (20 points) — all tabs
- Hardcoded inputs in blue font (6)
- Formula cells in black font (4)
- Formulas dynamic from Assumptions, no hardcodes embedded in formula cells in P&L / Valuation tabs (4)
- Exactly 3 tabs named "P&L", "Valuation Calculation", "Assumptions"; no extra substantive tabs (4)
- Layout clean — labelled sections, consistent structure, no merged cells blocking formulas (2)

## Commentary requirements
- Reference SPECIFIC CELLS when flagging issues (e.g. "Cell D14 on P&L tab")
- Be ACTIONABLE — say what to fix
- If you cannot assess something (missing tab, parsing failure), say so explicitly
- Use whole numbers for scores
`;

// ─── Model answer (Happy Hour Co reference build) ──────────────────────────
// Update this when the case study changes. Source: nba-happy-hour-v2.xlsx
const MODEL_ANSWER = `
## Case study: Happy Hour Co (NBA-listed hospitality)
- Transaction date: 31 March 2020
- Last historical FYE: 30 March 2019
- Forecast horizon: 10 years (FY20 stub → FY30), AUD millions

## Expected P&L outputs (±5% acceptable, driven from Assumptions tab)
| Year | Revenue | EBITDA | EBITDA margin | D&A | EBIT |
| FY20 | 1,149 | 94.1 | 8.2% | (36.1) | 58.0 |
| FY21 | 1,256 | 92.6 | 7.4% | (40.5) | 52.2 |
| FY25 | 1,471 | 130.5 | 8.9% | (53.6) | 76.9 |
| FY30 | 1,577 | 142.0 | 9.0% | (47.5) | 94.5 |

Drivers expected on Assumptions tab:
- Revenue growth: 9.3% → 7.8% → 6.9% → -0.3% → 2.0% declining to 1.0% terminal
- EBITDA margin ramps 7.4% → 9.0% over forecast period
- Capex: $50m flat from FY21
- Tax rate: 17% (forecast); 19% in FY20 actual

## Expected WACC
- WACC used in DCF: 8.5% (acceptable range ±50bps)
- Perpetuity growth rate: 0.5%
- Exit EBITDA multiple: 8.5×
- Tax rate: 17%
- (Specific CAPM components — rf, β, ERP, Kd — are case-study specific; operator to confirm.)

## Expected Valuation outputs (±10% acceptable per methodology)
| Component | Perpetuity Growth | Exit EBITDA Multiple |
| Sum of PV(FCF) | $409m | $409m |
| PV(Terminal Value) | $394m | $579m |
| Enterprise Value | $803m | $988m |
| Net debt | ($85m) | ($85m) |
| Equity Value | $718m | $904m |
| Implied share price (199m shares) | 361¢ | 454¢ |

Either methodology is valid. Candidates score full marks if numbers fall within ±10%.

## Common pitfalls to flag (cell-specific commentary required)
- Hardcoded revenue in P&L tab (must drive from Assumptions)
- Cost of debt not tax-effected in WACC build
- Book value used for capital structure weights instead of market value
- Tax rate inconsistency between WACC and FCF (e.g. 17% vs 19%)
- Terminal value not discounted back to present
- Capex not deducted from FCF
- ΔWC sign convention errors
- Net debt added rather than deducted in equity bridge
- Hardcoded EBITDA margin

## Grading approach
- Reference SPECIFIC cells (e.g. "P&L!D14") when flagging issues
- Award partial marks generously when structural approach is correct
- Goal is teaching candidates, not penalising minor variations
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
