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

async function submit() {
  state.screen = 'loading';
  state.error = '';
  render();

  try {
    const fd = new FormData();
    fd.append('candidate_id', state.candidateId);
    fd.append('file', state.file);

    const res = await fetch(GRADE_ENDPOINT, { method: 'POST', body: fd });
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
