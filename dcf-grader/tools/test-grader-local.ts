// Local test harness for the grade-dcf edge function.
//
// Runs the same parsing + context-building logic against a local xlsx,
// without calling Gemini. Verifies:
//   1. Tabs are detected (no spurious "missing section" errors)
//   2. Cells parse correctly (revenue, EBITDA, formulas)
//   3. The context Gemini would receive is the right shape and size
//
// Optional: pass --post-live to actually POST the file to the deployed
// edge function and print the full grader response (requires
// SUPABASE_URL + SUPABASE_ANON_KEY env vars).
//
// Run:
//   deno run -A dcf-grader/tools/test-grader-local.ts \
//       dcf-grader/sample-models/tap-turf-completed.xlsx
//
//   deno run -A dcf-grader/tools/test-grader-local.ts \
//       dcf-grader/sample-models/tap-turf-completed.xlsx --post-live

import ExcelJS from 'npm:exceljs@4.4.0';

const REQUIRED_SECTIONS: Record<string, RegExp[]> = {
  'Assumptions': [/^assumptions/i, /^drivers/i, /^inputs/i],
  'P&L / Forecast': [/p&l/i, /financials?/i, /forecast/i, /income/i],
  'Valuation': [/valuation/i, /^dcf/i, /\bdcf\b/i],
};

function findMissingSections(tabNames: string[]): string[] {
  const trimmed = tabNames.map(n => n.trim());
  const missing: string[] = [];
  for (const [section, patterns] of Object.entries(REQUIRED_SECTIONS)) {
    if (!trimmed.some(name => patterns.some(p => p.test(name)))) missing.push(section);
  }
  return missing;
}

type ParsedCell = { ref: string; value: any; formula: string | null; fontColor: string | null };

async function parseWorkbook(buffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const presentNames = wb.worksheets.map(ws => ws.name.trim());
  const missingTabs = findMissingSections(presentNames);

  const tabs = wb.worksheets.map(ws => {
    const cells: ParsedCell[] = [];
    let maxRow = 0, maxCol = 0;
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      maxRow = Math.max(maxRow, rowNum);
      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        maxCol = Math.max(maxCol, colNum);
        const formula = (cell.formula || (cell.value as any)?.formula) ?? null;
        let value: any = cell.value;
        if (value && typeof value === 'object' && 'result' in value) value = value.result;
        const colorObj = cell.font?.color as any;
        let fontColor: string | null = null;
        if (colorObj?.argb) fontColor = colorObj.argb;
        else if (colorObj?.theme != null) fontColor = `theme:${colorObj.theme}`;
        cells.push({ ref: `${ws.name}!${cell.address}`, value, formula: formula ? String(formula) : null, fontColor });
      });
    });
    return { name: ws.name, rowCount: maxRow, colCount: maxCol, cells };
  });

  return { tabs, missingTabs, presentNames };
}

async function postToLive(file: Uint8Array, name: string, candidateId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey    = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY to use --post-live');
    Deno.exit(1);
  }
  const form = new FormData();
  form.append('candidate_id', candidateId);
  form.append('file', new Blob([file], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
  const res = await fetch(`${supabaseUrl}/functions/v1/grade-dcf`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
    body: form,
  });
  console.log(`\n--- LIVE grade-dcf response (${res.status}) ---`);
  console.log(await res.text());
}

const args = Deno.args;
const path = args[0];
const postLive = args.includes('--post-live');
if (!path) {
  console.error('Usage: deno run -A test-grader-local.ts <path-to-xlsx> [--post-live]');
  Deno.exit(1);
}

const file = await Deno.readFile(path);
const { tabs, missingTabs, presentNames } = await parseWorkbook(file.buffer);

console.log(`File: ${path}  (${(file.length / 1024).toFixed(1)} KB)`);
console.log(`Tabs detected (${presentNames.length}): ${presentNames.join(', ')}`);
console.log(`Missing logical sections: ${missingTabs.length ? missingTabs.join(', ') : 'none ✅'}`);

let totalCells = 0, totalFormulas = 0;
for (const t of tabs) {
  const f = t.cells.filter(c => c.formula).length;
  totalCells += t.cells.length;
  totalFormulas += f;
  console.log(`  ${t.name.padEnd(28)} rows=${t.rowCount} cols=${t.colCount} cells=${t.cells.length} formulas=${f}`);
}
console.log(`Total: cells=${totalCells} formulas=${totalFormulas}`);

// Sanity probes — key driver cells we expect to find populated
const PROBES = [
  { ref: 'Assumptions!D27', label: 'revenue growth driver' },
  { ref: 'Assumptions!D28', label: 'EBITDA margin driver' },
  { ref: 'Assumptions!D33', label: 'WACC' },
  { ref: 'Assumptions!D35', label: 'exit multiple (peer median)' },
  { ref: ' Financials!Q11', label: 'FY26 revenue formula' },
  { ref: 'DCF input!F11', label: 'WACC link in DCF' },
];
console.log('\nDriver cell probes:');
for (const probe of PROBES) {
  const cell = tabs.flatMap(t => t.cells).find(c => c.ref === probe.ref);
  console.log(`  ${probe.ref.padEnd(28)} ${probe.label.padEnd(30)} → ${cell ? `value=${cell.value} formula=${cell.formula ?? '—'}` : 'NOT FOUND ❌'}`);
}

if (postLive) {
  await postToLive(file, path.split('/').pop()!, 'local-test-tap-turf');
}
