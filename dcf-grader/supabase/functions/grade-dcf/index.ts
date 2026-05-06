// DCF Model Reviewer — Edge Function
// Receives an .xlsx file, extracts cell values + formulas + font colours
// from the three required tabs (P&L, Valuation Calculation, Assumptions),
// then calls Claude to grade against the embedded rubric + model answer.
//
// Required env vars:
//   ANTHROPIC_API_KEY — Anthropic API key (sk-ant-...)
//
// Deploy: supabase functions deploy grade-dcf

import { createClient } from 'jsr:@supabase/supabase-js@2';
import ExcelJS from 'npm:exceljs@4.4.0';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
const ANTHROPIC_MODEL   = 'claude-haiku-4-5-20251001';
const MAX_FILE_BYTES    = 12 * 1024 * 1024; // 12MB hard cap (UI sets 10MB)

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

// ─── Model answer (PLACEHOLDER — replace with operator-provided answer) ─────
const MODEL_ANSWER = `
[PLACEHOLDER — operator must replace this with the case-study-specific model answer.]

The grader should:
- Assess STRUCTURAL correctness when no numerical answer is available
- Flag obvious errors (formula bugs, missing tax line, hardcoded revenue)
- Award partial marks generously when the approach is right but exact numbers can't be checked
`;

// ─── Output schema given to Claude ──────────────────────────────────────────
const OUTPUT_SCHEMA = `
{
  "totalScore": <integer 0-100>,
  "components": [
    { "name": "P&L Build", "score": <int 0-40>, "outOf": 40, "commentary": "<specific written feedback>" },
    { "name": "WACC", "score": <int 0-20>, "outOf": 20, "commentary": "<specific written feedback>" },
    { "name": "Valuation Calculation", "score": <int 0-20>, "outOf": 20, "commentary": "<specific written feedback>" },
    { "name": "Formatting & Model Layout", "score": <int 0-20>, "outOf": 20, "commentary": "<specific written feedback>" }
  ],
  "formattingViolations": [ "<specific cell-level violation 1>", "..." ]
}
`;

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

// ─── Claude API ─────────────────────────────────────────────────────────────
async function callClaude(workbookContext: string, candidateId: string): Promise<any> {
  const systemPrompt = `You are a strict, consistent DCF model grader for an M&A interview prep program.

You receive a parsed Excel workbook (cell values, formulas, font colours per cell). Grade the candidate's submission against the rubric below.

${RUBRIC}

## Model Answer (reference)
${MODEL_ANSWER}

## Candidate name / identifier
${candidateId}

## Output format
Return ONLY valid JSON matching this schema, no prose, no markdown fences:
${OUTPUT_SCHEMA}

## Important rules
- Be SPECIFIC and ACTIONABLE in commentary. Reference cell addresses (e.g. "P&L!D14").
- If a tab is missing, award 0 for the affected component(s) and call it out.
- For formatting: blue = font color starting with "FF0000FF" or close (theme blue is also OK if explicitly noted as theme:5 or similar — if you can't tell, say so).
- Whole-number scores only. Total must equal sum of components.
`;

  const userMessage = `Here is the parsed workbook content:\n\n${workbookContext}\n\nGrade this submission. Return only the JSON object.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  // Strip markdown fences if Claude added them despite instructions
  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse Claude response as JSON: ${cleaned.slice(0, 200)}`);
  }
}

// ─── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405);

  if (!ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY not configured on the server.' }, 500);
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
      report = await callClaude(context, candidateId);
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
