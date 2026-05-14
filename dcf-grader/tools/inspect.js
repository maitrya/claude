// Quick inspection of a sample DCF model — prints sheet names, dimensions,
// and a sample of cells with values, formulas, and font colours.
// Used to validate the parser handles real candidate models.

const ExcelJS = require('exceljs');
const path = process.argv[2] || './sample-models/nba-happy-hour-v2.xlsx';

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);

  console.log(`\n=== ${path} ===`);
  console.log(`Sheets: ${wb.worksheets.map(w => `"${w.name}"`).join(', ')}`);
  console.log('');

  for (const ws of wb.worksheets) {
    console.log(`\n────────────  TAB: ${ws.name}  ────────────`);
    let cellCount = 0, formulaCount = 0, blueCount = 0, blackCount = 0, otherColorCount = 0, noColorCount = 0;
    let sampleCells = [];
    let maxRow = 0, maxCol = 0;

    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      maxRow = Math.max(maxRow, rowNum);
      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        maxCol = Math.max(maxCol, colNum);
        cellCount++;
        if (cell.formula) formulaCount++;
        const colorObj = cell.font?.color;
        const argb = colorObj?.argb;
        if (argb) {
          if (argb === 'FF0000FF' || argb.match(/^FF[0-9A-F]{2}[0-9A-F]{2}FF$/i)) blueCount++;
          else if (argb === 'FF000000') blackCount++;
          else otherColorCount++;
        } else if (colorObj?.theme != null || colorObj?.indexed != null) {
          otherColorCount++;
        } else {
          noColorCount++;
        }

        if (sampleCells.length < 12 && (cell.formula || cell.value != null)) {
          let val = cell.value;
          if (val && typeof val === 'object' && 'result' in val) val = val.result;
          if (val && typeof val === 'object' && 'richText' in val) val = val.richText.map(r => r.text).join('');
          sampleCells.push({
            ref: cell.address,
            value: typeof val === 'string' ? val.slice(0, 40) : val,
            formula: cell.formula || null,
            color: argb || (colorObj?.theme != null ? `theme:${colorObj.theme}` : null),
          });
        }
      });
    });

    console.log(`  Dimensions: ${maxRow} rows × ${maxCol} cols`);
    console.log(`  Cells with content: ${cellCount}  (formulas: ${formulaCount})`);
    console.log(`  Font colours: blue=${blueCount}  black=${blackCount}  other/theme=${otherColorCount}  none=${noColorCount}`);
    console.log(`  Sample cells:`);
    for (const c of sampleCells) {
      console.log(`    ${c.ref}: ${JSON.stringify(c.value)?.slice(0,60).padEnd(35)} ${c.formula ? '  formula:' + c.formula.slice(0,40) : ''}  ${c.color || ''}`);
    }
  }
  console.log('');
})();
