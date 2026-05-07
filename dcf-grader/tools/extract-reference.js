// Pull the key reference values from a "good" model so we can populate
// model-answer.md. Targets WACC build, key P&L outputs, DCF output bridge.

const ExcelJS = require('exceljs');
const path = process.argv[2] || './sample-models/nba-happy-hour-v2.xlsx';

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);

  // Find sheets case-insensitive (allow trailing/leading whitespace)
  const findSheet = (re) => wb.worksheets.find(w => re.test(w.name.trim()));

  const dump = (sheet, label) => {
    if (!sheet) { console.log(`\n[${label}] sheet not found`); return; }
    console.log(`\n=== [${label}] ${sheet.name} ===`);
    sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
      const rowText = [];
      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        let v = cell.value;
        if (v && typeof v === 'object' && 'result' in v) v = v.result;
        if (v && typeof v === 'object' && 'richText' in v) v = v.richText.map(r => r.text).join('');
        if (v == null) return;
        const display = typeof v === 'number' ? Number(v.toFixed(4)).toString() : String(v).slice(0, 50);
        rowText.push(`${cell.address}=${display}`);
      });
      if (rowText.length > 0) console.log(`  R${rowNum.toString().padStart(2)}: ${rowText.join('  ')}`);
    });
  };

  dump(findSheet(/^assumptions$/i), 'Assumptions');
  dump(findSheet(/dcf\s*output/i), 'DCF output');
  dump(findSheet(/dcf\s*input/i), 'DCF input');
})();
