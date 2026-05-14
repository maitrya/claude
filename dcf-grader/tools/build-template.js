// Build a "perfect" DCF template using the Happy Hour Co numbers,
// structured exactly per the PRD: 3 tabs (P&L, Valuation Calculation,
// Assumptions), blue hardcodes, black formulas, full CAPM build.
//
// Usage: node tools/build-template.js [output-path]
// Default output: sample-models/prepped-template-reference.xlsx

const ExcelJS = require('exceljs');
const path = require('path');

const BLUE  = { argb: 'FF0000FF' };
const BLACK = { argb: 'FF000000' };
const GRAY  = { argb: 'FF666666' };

function setInput(cell, value)  { cell.value = value;  cell.font = { color: BLUE,  size: 11 }; }
function setFormula(cell, f)    { cell.value = { formula: f }; cell.font = { color: BLACK, size: 11 }; }
function setLabel(cell, text)   { cell.value = text;   cell.font = { color: GRAY,  size: 11, bold: true }; }
function setHeader(cell, text)  { cell.value = text;   cell.font = { color: GRAY,  size: 12, bold: true, italic: false }; }

async function build(outputPath) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Prepped Talent';
  wb.created = new Date();

  // ──────────────────────────────────────────────────────────────────────
  // ASSUMPTIONS TAB
  // ──────────────────────────────────────────────────────────────────────
  const a = wb.addWorksheet('Assumptions');
  a.columns = [
    { width: 38 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 },
  ];

  setHeader(a.getCell('A1'), 'WACC BUILD');
  setLabel(a.getCell('A3'),  'Risk-free rate (10Y AGB)');           setInput(a.getCell('B3'),  0.025);
  setLabel(a.getCell('A4'),  'Equity risk premium');                setInput(a.getCell('B4'),  0.065);
  setLabel(a.getCell('A5'),  'Beta (levered)');                     setInput(a.getCell('B5'),  1.1);
  setLabel(a.getCell('A6'),  'Cost of equity (CAPM)');              setFormula(a.getCell('B6'), 'B3+B5*B4');
  setLabel(a.getCell('A8'),  'Pre-tax cost of debt');               setInput(a.getCell('B8'),  0.05);
  setLabel(a.getCell('A9'),  'Tax rate');                           setInput(a.getCell('B9'),  0.17);
  setLabel(a.getCell('A10'), 'After-tax cost of debt');             setFormula(a.getCell('B10'), 'B8*(1-B9)');
  setLabel(a.getCell('A12'), 'Market value of equity ($m)');        setInput(a.getCell('B12'), 328.35);
  setLabel(a.getCell('A13'), 'Market value of debt ($m)');          setInput(a.getCell('B13'), 84.62);
  setLabel(a.getCell('A14'), 'Enterprise value ($m)');              setFormula(a.getCell('B14'), 'B12+B13');
  setLabel(a.getCell('A15'), 'Equity weight (E/V)');                setFormula(a.getCell('B15'), 'B12/B14');
  setLabel(a.getCell('A16'), 'Debt weight (D/V)');                  setFormula(a.getCell('B16'), 'B13/B14');
  setLabel(a.getCell('A17'), 'WACC');                               setFormula(a.getCell('B17'), 'B15*B6+B16*B10');

  setHeader(a.getCell('A20'), 'P&L DRIVERS');
  setLabel(a.getCell('A22'), 'Year');
  ['FY20','FY21','FY22','FY23','FY24','FY25','FY26','FY27','FY28','FY29','FY30'].forEach((y,i) => {
    setLabel(a.getCell(22, 2+i), y);
  });
  setLabel(a.getCell('A23'), 'Revenue growth %');
  [null, 0.0926, 0.0782, 0.0688, -0.003, 0.02, 0.018, 0.016, 0.014, 0.012, 0.01].forEach((v,i) => {
    if (v !== null) setInput(a.getCell(23, 2+i), v);
  });
  setLabel(a.getCell('A24'), 'EBITDA margin %');
  [0.082, 0.074, 0.083, 0.086, 0.088, 0.089, 0.089, 0.089, 0.090, 0.090, 0.090].forEach((v,i) => {
    setInput(a.getCell(24, 2+i), v);
  });
  setLabel(a.getCell('A25'), 'D&A ($m)');
  [-36.1, -40.5, -47.2, -51.8, -54.8, -53.6, -52.4, -51.2, -49.9, -48.7, -47.5].forEach((v,i) => {
    setInput(a.getCell(25, 2+i), v);
  });
  setLabel(a.getCell('A26'), 'Capex ($m)');
  [-36, -51, -50, -50, -50, -50, -50, -50, -50, -50, -50].forEach((v,i) => {
    setInput(a.getCell(26, 2+i), v);
  });
  setLabel(a.getCell('A27'), 'Change in working capital ($m)');
  [6, 16.1, 15.2, 11.1, 4.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0].forEach((v,i) => {
    setInput(a.getCell(27, 2+i), v);
  });

  setHeader(a.getCell('A30'), 'TERMINAL VALUE INPUTS');
  setLabel(a.getCell('A32'), 'Perpetuity growth rate');             setInput(a.getCell('B32'), 0.005);
  setLabel(a.getCell('A33'), 'Exit EBITDA multiple');               setInput(a.getCell('B33'), 8.5);

  setHeader(a.getCell('A36'), 'EQUITY BRIDGE INPUTS');
  setLabel(a.getCell('A38'), 'Net debt ($m)');                      setInput(a.getCell('B38'), 84.62);
  setLabel(a.getCell('A39'), 'Minority interests ($m)');            setInput(a.getCell('B39'), 0);
  setLabel(a.getCell('A40'), 'Investments in associates ($m)');     setInput(a.getCell('B40'), 0);
  setLabel(a.getCell('A41'), 'Shares outstanding (m)');             setInput(a.getCell('B41'), 199);

  // ──────────────────────────────────────────────────────────────────────
  // P&L TAB
  // ──────────────────────────────────────────────────────────────────────
  const p = wb.addWorksheet('P&L');
  p.columns = Array(13).fill({ width: 14 });
  p.getCell('A1').value = 'P&L'; p.getCell('A1').font = { bold: true, size: 14 };

  setLabel(p.getCell('A3'), 'Year');
  ['FY20','FY21','FY22','FY23','FY24','FY25','FY26','FY27','FY28','FY29','FY30'].forEach((y,i) => {
    setLabel(p.getCell(3, 2+i), y);
  });

  // Revenue — FY20 hardcoded as base, then driven by growth from Assumptions
  setLabel(p.getCell('A5'), 'Revenue');
  setInput(p.getCell('B5'), 1149.2);
  for (let i = 1; i <= 10; i++) {
    const col = String.fromCharCode(66 + i); // C, D, E...
    const prev = String.fromCharCode(65 + i);
    setFormula(p.getCell(5, 2+i), `${prev}5*(1+Assumptions!${String.fromCharCode(66+i)}23)`);
  }

  setLabel(p.getCell('A6'), 'EBITDA');
  for (let i = 0; i <= 10; i++) {
    const col = String.fromCharCode(66 + i);
    setFormula(p.getCell(6, 2+i), `${col}5*Assumptions!${col}24`);
  }

  setLabel(p.getCell('A7'), 'D&A');
  for (let i = 0; i <= 10; i++) {
    const col = String.fromCharCode(66 + i);
    setFormula(p.getCell(7, 2+i), `Assumptions!${col}25`);
  }

  setLabel(p.getCell('A8'), 'EBIT');
  for (let i = 0; i <= 10; i++) {
    const col = String.fromCharCode(66 + i);
    setFormula(p.getCell(8, 2+i), `${col}6+${col}7`);
  }

  setLabel(p.getCell('A9'), 'Tax on EBIT');
  for (let i = 0; i <= 10; i++) {
    const col = String.fromCharCode(66 + i);
    setFormula(p.getCell(9, 2+i), `-${col}8*Assumptions!$B$9`);
  }

  setLabel(p.getCell('A10'), 'EBIAT (NOPAT)');
  for (let i = 0; i <= 10; i++) {
    const col = String.fromCharCode(66 + i);
    setFormula(p.getCell(10, 2+i), `${col}8+${col}9`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // VALUATION CALCULATION TAB
  // ──────────────────────────────────────────────────────────────────────
  const v = wb.addWorksheet('Valuation Calculation');
  v.columns = Array(13).fill({ width: 14 });
  v.getCell('A1').value = 'Valuation Calculation'; v.getCell('A1').font = { bold: true, size: 14 };

  setLabel(v.getCell('A3'), 'Year');
  ['FY20','FY21','FY22','FY23','FY24','FY25','FY26','FY27','FY28','FY29','FY30'].forEach((y,i) => {
    setLabel(v.getCell(3, 2+i), y);
  });
  setLabel(v.getCell('A4'), 'Discount period');
  for (let i = 0; i <= 10; i++) setInput(v.getCell(4, 2+i), i);

  setLabel(v.getCell('A6'), 'EBIAT (from P&L)');
  for (let i = 0; i <= 10; i++) {
    const col = String.fromCharCode(66 + i);
    setFormula(v.getCell(6, 2+i), `'P&L'!${col}10`);
  }
  setLabel(v.getCell('A7'), '+ D&A');
  for (let i = 0; i <= 10; i++) {
    const col = String.fromCharCode(66 + i);
    setFormula(v.getCell(7, 2+i), `-'P&L'!${col}7`);
  }
  setLabel(v.getCell('A8'), '- Capex');
  for (let i = 0; i <= 10; i++) {
    const col = String.fromCharCode(66 + i);
    setFormula(v.getCell(8, 2+i), `Assumptions!${col}26`);
  }
  setLabel(v.getCell('A9'), '- Change in WC');
  for (let i = 0; i <= 10; i++) {
    const col = String.fromCharCode(66 + i);
    setFormula(v.getCell(9, 2+i), `-Assumptions!${col}27`);
  }
  setLabel(v.getCell('A10'), 'FCF');
  for (let i = 0; i <= 10; i++) {
    const col = String.fromCharCode(66 + i);
    setFormula(v.getCell(10, 2+i), `${col}6+${col}7+${col}8+${col}9`);
  }

  setLabel(v.getCell('A12'), 'Discount factor');
  for (let i = 0; i <= 10; i++) {
    const col = String.fromCharCode(66 + i);
    setFormula(v.getCell(12, 2+i), `1/(1+Assumptions!$B$17)^${col}4`);
  }
  setLabel(v.getCell('A13'), 'PV(FCF)');
  for (let i = 0; i <= 10; i++) {
    const col = String.fromCharCode(66 + i);
    setFormula(v.getCell(13, 2+i), `${col}10*${col}12`);
  }

  setLabel(v.getCell('A15'), 'Sum of PV(FCF)');         setFormula(v.getCell('B15'), 'SUM(C13:L13)');
  setLabel(v.getCell('A17'), 'Terminal value (perp)');  setFormula(v.getCell('B17'), 'L10*(1+Assumptions!B32)/(Assumptions!B17-Assumptions!B32)');
  setLabel(v.getCell('A18'), 'PV of TV');                setFormula(v.getCell('B18'), 'B17/(1+Assumptions!B17)^L4');
  setLabel(v.getCell('A20'), 'Enterprise Value');        setFormula(v.getCell('B20'), 'B15+B18');
  setLabel(v.getCell('A22'), 'Net debt');                setFormula(v.getCell('B22'), '-Assumptions!B38');
  setLabel(v.getCell('A23'), 'Minority interests');      setFormula(v.getCell('B23'), '-Assumptions!B39');
  setLabel(v.getCell('A24'), 'Investments in associates'); setFormula(v.getCell('B24'), 'Assumptions!B40');
  setLabel(v.getCell('A25'), 'Equity Value');            setFormula(v.getCell('B25'), 'B20+B22+B23+B24');
  setLabel(v.getCell('A27'), 'Shares outstanding (m)');  setFormula(v.getCell('B27'), 'Assumptions!B41');
  setLabel(v.getCell('A28'), 'Implied share price ($)'); setFormula(v.getCell('B28'), 'B25/B27');

  await wb.xlsx.writeFile(outputPath);
  console.log('✓ Wrote', outputPath);
}

const out = process.argv[2] || path.join(__dirname, '..', 'sample-models', 'prepped-template-reference.xlsx');
build(out).catch(e => { console.error(e); process.exit(1); });
