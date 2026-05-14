// v1: DCF Model Reviewer — frontend
// Vanilla JS, no build step. Calls Supabase Edge Function for grading.

const GRADE_ENDPOINT = 'https://dsnkabdmposyukcedduy.supabase.co/functions/v1/grade-dcf';
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

const app = document.getElementById('app');

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  screen: 'submit',      // 'submit' | 'loading' | 'report' | 'error'
  candidateId: '',
  file: null,
  error: '',
  report: null,
};

// ─── Render ──────────────────────────────────────────────────────────────────
function render() {
  if (state.screen === 'submit')  return renderSubmit();
  if (state.screen === 'loading') return renderLoading();
  if (state.screen === 'report')  return renderReport();
  if (state.screen === 'error')   return renderError();
}

function renderSubmit() {
  app.innerHTML = `
    <div class="card">
      <label class="field">
        <span class="lbl">Your name or email</span>
        <input id="cid" type="text" placeholder="e.g. sarah@example.com" value="${escapeHtml(state.candidateId)}" />
      </label>
      <label class="field" style="margin-bottom:0">
        <span class="lbl">DCF model (.xlsx, max 10MB)</span>
        <div id="dz" class="drop-zone ${state.file ? 'loaded' : ''}">
          <input id="file-input" type="file" accept=".xlsx" style="display:none" />
          ${state.file
            ? `<span class="icon">✅</span><strong>${escapeHtml(state.file.name)}</strong><div class="hint">${formatBytes(state.file.size)} — click to replace</div>`
            : `<span class="icon">📊</span><strong>Drag your .xlsx file here</strong><div class="hint">or click to browse</div>`}
        </div>
      </label>
    </div>
    <button class="primary" id="submit-btn" ${(!state.candidateId || !state.file) ? 'disabled' : ''}>
      Submit for review →
    </button>
    ${state.error ? `<p class="err">${escapeHtml(state.error)}</p>` : ''}
  `;

  document.getElementById('cid').addEventListener('input', e => {
    state.candidateId = e.target.value;
    updateSubmitBtn();
  });

  const dz = document.getElementById('dz');
  const fi = document.getElementById('file-input');
  dz.addEventListener('click', () => fi.click());
  fi.addEventListener('change', e => handleFile(e.target.files[0]));
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('dragover');
    handleFile(e.dataTransfer.files[0]);
  });

  document.getElementById('submit-btn').addEventListener('click', submit);
}

function renderLoading() {
  app.innerHTML = `
    <div class="card loading-screen">
      <div class="spinner big-spinner"></div>
      <h2 style="font-weight:700;font-size:18px;color:#fff;">Grading your model…</h2>
      <p>Parsing the workbook and running AI assessment.</p>
      <p>This usually takes 30–60 seconds.</p>
    </div>
  `;
}

function renderReport() {
  const r = state.report;
  app.innerHTML = `
    <div class="card report">
      <div class="total">
        <span class="score">${r.totalScore}</span>
        <span class="max">/ 100</span>
      </div>
      ${r.components.map(c => `
        <div class="component" style="border-color:${componentColor(c.score, c.outOf)}">
          <div class="head">
            <span class="name">${escapeHtml(c.name)}</span>
            <span class="pts"><strong>${c.score}</strong> / ${c.outOf}</span>
          </div>
          <p class="commentary">${escapeHtml(c.commentary)}</p>
        </div>
      `).join('')}

      ${r.formattingViolations && r.formattingViolations.length > 0 ? `
        <div class="violations">
          <h3>Formatting violations</h3>
          <ul>${r.formattingViolations.map(v => `<li>${escapeHtml(v)}</li>`).join('')}</ul>
        </div>
      ` : ''}

      <div class="actions">
        <button id="reset-btn">← New submission</button>
        <button class="primary" id="copy-btn">Copy feedback</button>
      </div>
    </div>
  `;
  document.getElementById('reset-btn').addEventListener('click', reset);
  document.getElementById('copy-btn').addEventListener('click', copyFeedback);
}

function renderError() {
  app.innerHTML = `
    <div class="card">
      <h2 style="color:#ef4444;font-weight:700;font-size:16px;margin-bottom:8px;">Something went wrong</h2>
      <p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.5;margin-bottom:16px;">${escapeHtml(state.error)}</p>
      <button class="primary" id="retry-btn">← Try again</button>
    </div>
  `;
  document.getElementById('retry-btn').addEventListener('click', reset);
}

// ─── Actions ─────────────────────────────────────────────────────────────────
function handleFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    state.error = 'Please upload an .xlsx file. Other formats (.xls, .csv, .pdf) are not supported.';
    render(); return;
  }
  if (file.size > MAX_FILE_BYTES) {
    state.error = `File too large (${formatBytes(file.size)}). Max is 10MB.`;
    render(); return;
  }
  state.file = file;
  state.error = '';
  render();
}

function updateSubmitBtn() {
  const btn = document.getElementById('submit-btn');
  if (!btn) return;
  btn.disabled = !state.candidateId || !state.file;
}

// ─── Excel parsing (browser-side) ────────────────────────────────────────────
const REQUIRED_TABS = ['P&L', 'Valuation Calculation', 'Assumptions'];
const TAB_PATTERNS = {
  'Assumptions':           [/^assumption/i, /^inputs?$/i, /^drivers?$/i, /^key\s*input/i],
  'P&L':                   [/^p[\&\s]*l$/i, /income\s*statement/i, /^is$/i, /^company\s*fin/i, /^financials?$/i, /^profit/i],
  'Valuation Calculation': [/^valuation/i, /^dcf\s*input/i, /^dcf\s*calc/i, /^dcf$/i, /^discounted/i, /^cashflow/i, /^dcf\s*output/i],
};
const MAX_CONTEXT_CHARS = 35000;

// Unwrap ExcelJS cell value to a primitive. Non-recursive (avoid infinite loops).
function unwrapCellValue(v, depth) {
  if (depth == null) depth = 0;
  if (depth > 3) return null;
  if (v == null) return null;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v !== 'object') return String(v);

  if ('result' in v && v.result != null && typeof v.result !== 'object') return v.result;
  if ('result' in v) return unwrapCellValue(v.result, depth + 1);
  if ('richText' in v && Array.isArray(v.richText)) return v.richText.map(r => (r && r.text) || '').join('');
  if ('text' in v && typeof v.text === 'string') return v.text;
  if ('error' in v) return '#' + v.error;
  if ('sharedFormula' in v) return null; // formula evaluated elsewhere
  if ('formula' in v) return null;       // formula without result
  return null;
}

function matchTabsToRubric(sheets) {
  const matched = {};
  const claimed = new Set();
  for (const required of REQUIRED_TABS) {
    const m = sheets.find(s => s.name.trim().toLowerCase() === required.toLowerCase());
    if (m) { matched[required] = m.name; claimed.add(m.name); }
  }
  for (const required of REQUIRED_TABS) {
    if (matched[required]) continue;
    for (const pattern of TAB_PATTERNS[required] || []) {
      const m = sheets.find(s => !claimed.has(s.name) && pattern.test(s.name.trim()));
      if (m) { matched[required] = m.name; claimed.add(m.name); break; }
    }
  }
  return matched;
}

async function parseExcel(file) {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const allSheets = wb.worksheets.map(ws => ({ name: ws.name, ws }));
  const matched = matchTabsToRubric(allSheets);
  const allSheetNames = allSheets.map(s => s.name);

  const lines = [];
  let total = 0;

  for (const required of REQUIRED_TABS) {
    const sheetName = matched[required];
    if (!sheetName) continue;
    const ws = allSheets.find(s => s.name === sheetName).ws;
    let rowCount = 0;
    const header = `\n=== CATEGORY: ${required} | ORIGINAL TAB: "${sheetName}" ===`;
    lines.push(header); total += header.length;
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      rowCount = Math.max(rowCount, rowNum);
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (total > MAX_CONTEXT_CHARS) return;
        const formula = (cell.formula || cell.value?.formula || cell.value?.sharedFormula) ?? null;
        const value = unwrapCellValue(cell.value);
        const colorObj = cell.font?.color;
        let fontColor = null;
        if (colorObj?.argb)        fontColor = colorObj.argb;
        else if (colorObj?.theme != null) fontColor = 'theme:' + colorObj.theme;

        const parts = [`${ws.name}!${cell.address}`];
        if (formula) parts.push('f:' + String(formula).slice(0, 80));
        if (value != null) {
          const v = typeof value === 'string' ? JSON.stringify(value).slice(0, 40) : value;
          parts.push('v:' + v);
        }
        if (fontColor) parts.push('c:' + fontColor);
        const line = parts.join('|');
        if (total + line.length > MAX_CONTEXT_CHARS) return;
        lines.push(line);
        total += line.length + 1;
      });
    });
  }

  const missingCategories = REQUIRED_TABS.filter(r => !matched[r]);
  const namingDeviations = REQUIRED_TABS.filter(r => matched[r] && matched[r].toLowerCase() !== r.toLowerCase());

  if (total >= MAX_CONTEXT_CHARS) lines.push('... (truncated at ' + MAX_CONTEXT_CHARS + ' chars)');

  return {
    context: lines.join('\n'),
    matched, missingCategories, namingDeviations,
    allSheets: allSheetNames,
  };
}

async function submit() {
  state.screen = 'loading';
  state.error = '';
  render();

  try {
    // Parse client-side (much faster than server-side)
    const parsed = await parseExcel(state.file);

    if (Object.keys(parsed.matched).length === 0) {
      throw new Error('No tabs match the required structure. Found: ' + parsed.allSheets.join(', ') + '. Required: P&L, Valuation Calculation, Assumptions.');
    }

    const payload = {
      candidate_id: state.candidateId,
      file_name: state.file.name,
      context: parsed.context,
      matched: parsed.matched,
      missing_categories: parsed.missingCategories,
      naming_deviations: parsed.namingDeviations,
      all_sheets: parsed.allSheets,
    };

    const res = await fetch(GRADE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Server returned ${res.status}`);
    }
    const data = await res.json();
    state.report = data;
    state.screen = 'report';
  } catch (e) {
    state.error = e.message || 'Could not submit. Please try again.';
    state.screen = 'error';
  }
  render();
}

function reset() {
  state.screen = 'submit';
  state.error = '';
  state.report = null;
  state.file = null;
  // keep candidateId so resubmissions don't require re-typing
  render();
}

function copyFeedback() {
  const r = state.report;
  if (!r) return;
  const text = [
    `DCF Model Review — Score: ${r.totalScore}/100`,
    '',
    ...r.components.map(c => `${c.name}: ${c.score}/${c.outOf}\n${c.commentary}\n`),
    r.formattingViolations?.length ? `\nFormatting violations:\n${r.formattingViolations.map(v => '• ' + v).join('\n')}` : '',
  ].join('\n');
  navigator.clipboard.writeText(text);
  const btn = document.getElementById('copy-btn');
  if (btn) { btn.textContent = '✓ Copied'; setTimeout(() => btn.textContent = 'Copy feedback', 1800); }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function componentColor(score, outOf) {
  const pct = score / outOf;
  if (pct >= 0.85) return '#ec4899';
  if (pct >= 0.65) return '#a855f7';
  if (pct >= 0.45) return '#f59e0b';
  return '#ef4444';
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ─── Boot ────────────────────────────────────────────────────────────────────
render();
