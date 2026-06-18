// Send Insights Email v5 — adds DCF weekly summary block to archie_digest

import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || 're_8ZgDa9xk_97QHaRA8AuKScEahs5DurKSB';
const FROM_EMAIL = 'archie@preppedtalent.com.au';
const FROM_NAME = 'Archie | Prepped Talent';
const DASHBOARD_URL = 'https://dashboard.preppedtalent.com.au';
const LINKEDIN_DATA_URL = 'https://www.linkedin.com/mypreferences/d/download-my-data';
const ARCHIE_EMAIL = 'archie@preppedtalent.com.au';
const SEND_THROTTLE_MS = 600; // Resend allows 2/sec; 600ms = safe margin

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
function esc(s) { if (s == null) return ''; return String(s).replace(/[&<>\"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;' }[c])); }
function firstName(email) { const local = (email || '').split('@')[0]; return local.split(/[._-]/)[0].charAt(0).toUpperCase() + local.split(/[._-]/)[0].slice(1).toLowerCase(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const SHELL = (title, bodyHtml) => `<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>${esc(title)}</title></head>
<body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;\">
  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:40px 0;\">
    <tr><td align=\"center\">
      <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);\">
        <tr><td style=\"background:linear-gradient(135deg,#ec4899,#a855f7);padding:28px 40px;\">
          <p style=\"margin:0;color:#fff;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;\">Prepped Talent</p>
          <h1 style=\"margin:6px 0 0;color:#fff;font-size:22px;font-weight:800;\">${esc(title)}</h1>
        </td></tr>
        <tr><td style=\"padding:32px 40px;color:#111827;font-size:15px;line-height:1.6;\">${bodyHtml}</td></tr>
        <tr><td style=\"padding:0 40px 28px;\">
          <p style=\"margin:0;color:#111827;font-size:14px;font-weight:600;\">Archie</p>
          <p style=\"margin:2px 0 0;color:#6b7280;font-size:12px;\">Prepped Talent</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const btn = (href, label, color) => `<table cellpadding=\"0\" cellspacing=\"0\" style=\"margin:8px 0 20px;\"><tr>
  <td style=\"background:${color || 'linear-gradient(135deg,#ec4899,#a855f7)'};border-radius:8px;\">
    <a href=\"${href}\" style=\"display:inline-block;padding:13px 28px;color:#fff;font-size:14px;font-weight:700;text-decoration:none;\">${esc(label)}</a>
  </td></tr></table>`;

function tCandidateDormant({ email, signedUpDaysAgo }) {
  const name = firstName(email);
  const body = `<p style=\"margin:0 0 18px;\">Hi ${esc(name)},</p>
<p style=\"margin:0 0 16px;\">You signed up ${signedUpDaysAgo} day${signedUpDaysAgo === 1 ? '' : 's'} ago but haven't uploaded any LinkedIn data yet — your dashboard is sitting empty.</p>
<p style=\"margin:0 0 16px;\">It takes about <strong>5 minutes</strong> to get up and running:</p>
<ol style=\"margin:0 0 18px;padding-left:20px;\">
  <li style=\"margin-bottom:8px;\">Request your data: <a href=\"${LINKEDIN_DATA_URL}\" style=\"color:#a855f7;\">linkedin.com/mypreferences/d/download-my-data</a></li>
  <li style=\"margin-bottom:8px;\">Select <strong>Connections</strong>, <strong>Invitations</strong>, <strong>Messages</strong> → Request archive</li>
  <li style=\"margin-bottom:8px;\">Wait for the email (~10 min), download the ZIP, unzip the CSVs</li>
  <li style=\"margin-bottom:8px;\">Drag the 3 CSVs into your dashboard</li>
</ol>
${btn(DASHBOARD_URL, 'Upload my data →')}
<p style=\"margin:24px 0 0;color:#6b7280;font-size:13px;\">Any issues or questions, just reply to this email.</p>`;
  return { subject: "Your Prepped dashboard is waiting — 5 min to set up", html: SHELL('Your dashboard is waiting', body) };
}

function tCandidateDay1Followup({ email }) {
  const name = firstName(email);
  const body = `<p style=\"margin:0 0 18px;\">Hey ${esc(name)},</p>
<p style=\"margin:0 0 16px;\">Quick check-in — you signed up yesterday. LinkedIn usually takes about <strong>24 hours</strong> to email your data export, so it should be landing in your inbox right about now.</p>
<p style=\"margin:0 0 18px;\">When it arrives:</p>
<ol style=\"margin:0 0 20px;padding-left:20px;\">
  <li style=\"margin-bottom:6px;\">Download the ZIP from LinkedIn's email</li>
  <li style=\"margin-bottom:6px;\">Unzip — you'll see <code>Connections.csv</code>, <code>Invitations.csv</code>, <code>messages.csv</code></li>
  <li style=\"margin-bottom:6px;\">Drag the 3 CSVs into your dashboard — takes about 30 seconds</li>
</ol>
${btn(DASHBOARD_URL, 'Open my dashboard')}
<p style=\"margin:0 0 12px;color:#6b7280;font-size:14px;\">Haven't requested it yet? Start here: <a href=\"${LINKEDIN_DATA_URL}\" style=\"color:#a855f7;\">request a LinkedIn data export</a> (free, ~24h to arrive).</p>
<p style=\"margin:18px 0 0;color:#6b7280;font-size:13px;\">Any questions, just reply to this email — happy to help.</p>`;
  return { subject: "Your LinkedIn data should have arrived — ready to upload?", html: SHELL("Your data is probably here", body) };
}

function tCandidateWeekly({ email, weekKey, requestsSent, connGoal, messagesSent, msgGoal, catchupsBooked, acceptanceRate, trend, avgReq, avgMsg }) {
  const name = firstName(email);
  const tick = (n, g) => n >= g ? '✅' : '⚠️';
  const trendIcon = trend === 'up' ? '↗️ Trending up' : trend === 'down' ? '↘️ Trending down' : trend === 'first_week' ? '🆕 First week' : '→ Steady';
  const hitBoth = requestsSent >= connGoal && messagesSent >= msgGoal;
  const hitOne = !hitBoth && (requestsSent >= connGoal || messagesSent >= msgGoal);
  const headlineStyle = hitBoth ? 'color:#10b981;' : hitOne ? 'color:#a855f7;' : 'color:#f59e0b;';
  const headlineText = hitBoth ? `🎯 You hit both goals this week!` : hitOne ? `Almost there — you hit one goal this week` : `Week of ${esc(weekKey)} — here's your snapshot`;
  const body = `<p style=\"margin:0 0 12px;font-size:16px;${headlineStyle}font-weight:700;\">${headlineText}</p>
<p style=\"margin:0 0 20px;\">Hi ${esc(name)},</p>
<table cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;background:#faf5ff;border-radius:10px;padding:16px;margin-bottom:20px;border-left:4px solid #a855f7;\">
  <tr><td style=\"padding:6px 8px;\"><strong>${tick(requestsSent, connGoal)} Connection requests</strong></td><td align=\"right\" style=\"padding:6px 8px;\"><strong>${requestsSent}</strong> <span style=\"color:#6b7280\">/ ${connGoal} goal</span></td></tr>
  <tr><td style=\"padding:6px 8px;\"><strong>${tick(messagesSent, msgGoal)} Messages sent</strong></td><td align=\"right\" style=\"padding:6px 8px;\"><strong>${messagesSent}</strong> <span style=\"color:#6b7280\">/ ${msgGoal} goal</span></td></tr>
  <tr><td style=\"padding:6px 8px;\">🤝 Acceptance rate</td><td align=\"right\" style=\"padding:6px 8px;\"><strong>${acceptanceRate}%</strong></td></tr>
  <tr><td style=\"padding:6px 8px;\">☕ Catch-ups booked</td><td align=\"right\" style=\"padding:6px 8px;\"><strong>${catchupsBooked}</strong></td></tr>
</table>
<p style=\"margin:0 0 8px;font-weight:600;\">${trendIcon}</p>
${trend !== 'first_week' ? `<p style=\"margin:0 0 16px;color:#374151;font-size:14px;\">Your 4-week average: <strong>${avgReq}</strong> requests, <strong>${avgMsg}</strong> messages per week. This week you ${requestsSent > avgReq ? 'beat' : 'fell below'} your average.</p>` : ''}
<div style=\"background:#f0fdfa;border-radius:10px;padding:16px 18px;border-left:4px solid #14b8a6;margin:24px 0 16px;\">
  <p style=\"margin:0 0 6px;font-size:14px;font-weight:700;color:#0f766e;\">📅 Refresh your data for next week</p>
  <p style=\"margin:0 0 12px;font-size:13px;color:#115e59;line-height:1.5;\">Request a fresh LinkedIn data export now (it arrives by email in ~10 min), then upload the CSVs to your dashboard. Keep your weekly numbers up to date.</p>
  ${btn(LINKEDIN_DATA_URL, '↓ Download LinkedIn data', '#14b8a6')}
</div>
${btn(DASHBOARD_URL, 'Open my dashboard')}
<p style=\"margin:24px 0 0;color:#6b7280;font-size:13px;\">Keep going — consistency compounds. Reply if anything looks off.</p>`;
  return { subject: `Your Prepped weekly: ${requestsSent}/${connGoal} requests, ${messagesSent}/${msgGoal} messages`, html: SHELL(`Week of ${weekKey}`, body) };
}

function tArchieDropoff({ dormantUsers, totalRegistered }) {
  const rows = dormantUsers.map(u =>
    `<tr style=\"border-bottom:1px solid #e5e7eb;\">
      <td style=\"padding:8px 6px;font-size:13px;\">${esc(u.email)}</td>
      <td style=\"padding:8px 6px;font-size:13px;text-align:right;color:#6b7280;\">${u.days_since_signup}d ago</td>
      <td style=\"padding:8px 6px;font-size:13px;text-align:center;\">${u.goals_set ? '✅' : '⚠️'}</td>
    </tr>`).join('');
  const body = `<p style=\"margin:0 0 16px;\">Hey mate —</p>
<p style=\"margin:0 0 20px;\"><strong>${dormantUsers.length} of ${totalRegistered}</strong> signups haven't uploaded a CSV yet.</p>
<table cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;background:#fef3c7;border-radius:10px;padding:14px;margin-bottom:20px;border-left:4px solid #f59e0b;\">
  <tr><td style=\"font-size:13px;color:#92400e;\"><strong>${Math.round(dormantUsers.length / totalRegistered * 100)}% drop-off</strong> between sign-up and first upload</td></tr>
</table>
<table cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;\">
  <thead><tr style=\"background:#f9fafb;\">
    <th style=\"padding:10px 6px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;\">Email</th>
    <th style=\"padding:10px 6px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;\">Signed up</th>
    <th style=\"padding:10px 6px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;\">Goals set</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<p style=\"margin:24px 0 0;color:#374151;font-size:14px;\">A separate reactivation email has been queued to each dormant user.</p>`;
  return { subject: `💤 ${dormantUsers.length} dormant signups need chasing`, html: SHELL('Dormant users digest', body) };
}

// DCF block: rendered inside tArchieDigest. Empty-state has its own copy so
// Archie sees explicitly that nobody submitted (vs. the block being missing).
function dcfBlockHtml(dcfSummary) {
  if (!dcfSummary || dcfSummary.total === 0) {
    return `<table cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;background:#f3f4f6;border-radius:10px;padding:14px;margin:0 0 20px;border-left:4px solid #9ca3af;\">
  <tr><td style=\"font-size:13px;color:#374151;\"><strong>📊 DCF Grader — 0 submissions this week.</strong> No candidates uploaded a model.</td></tr>
</table>`;
  }
  const successes = dcfSummary.rows.filter(r => !r.error);
  const failures = dcfSummary.rows.filter(r => r.error);
  const rowHtml = successes.slice(0, 10).map(r =>
    `<tr style=\"border-bottom:1px solid #e5e7eb;\">
      <td style=\"padding:8px 6px;font-size:13px;\">${esc(r.candidate_id)}</td>
      <td style=\"padding:8px 6px;font-size:13px;color:#6b7280;\">${esc(r.file_name)}</td>
      <td style=\"padding:8px 6px;font-size:13px;text-align:right;font-weight:600;\">${r.total_score}/100</td>
      <td style=\"padding:8px 6px;font-size:12px;text-align:right;color:#6b7280;\">${esc(r.created_at.slice(0, 10))}</td>
    </tr>`).join('');
  const failHtml = failures.length > 0
    ? `<p style=\"margin:10px 0 0;font-size:12px;color:#991b1b;\">⚠️ ${failures.length} failed submission${failures.length === 1 ? '' : 's'}: ${failures.slice(0, 3).map(f => esc(f.candidate_id)).join(', ')}${failures.length > 3 ? '…' : ''}</p>`
    : '';
  const avgScore = successes.length > 0 ? Math.round(successes.reduce((s, r) => s + r.total_score, 0) / successes.length) : 0;
  return `<h2 style=\"margin:24px 0 12px;font-size:16px;color:#111827;\">📊 DCF Grader this week</h2>
<table cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;background:#ecfdf5;border-radius:10px;padding:14px;margin:0 0 12px;border-left:4px solid #10b981;\">
  <tr><td style=\"font-size:13px;color:#065f46;\"><strong>${dcfSummary.total}</strong> submission${dcfSummary.total === 1 ? '' : 's'} from <strong>${dcfSummary.unique_candidates}</strong> candidate${dcfSummary.unique_candidates === 1 ? '' : 's'}${successes.length > 0 ? ` · avg score <strong>${avgScore}/100</strong>` : ''}${failHtml ? '' : ''}</td></tr>
</table>
${successes.length > 0 ? `<table cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;margin-bottom:20px;\">
  <thead><tr style=\"background:#f9fafb;\">
    <th style=\"padding:10px 6px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;\">Candidate</th>
    <th style=\"padding:10px 6px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;\">File</th>
    <th style=\"padding:10px 6px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;\">Score</th>
    <th style=\"padding:10px 6px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;\">Date</th>
  </tr></thead>
  <tbody>${rowHtml}</tbody>
</table>` : ''}
${failHtml}`;
}

function tArchieDigest({ digest, activeRows, atRiskRows, dormantCount, dcfSummary }) {
  const userRows = activeRows.map(u => {
    const reqHit = u.hit_connection_goal ? '✅' : '⚠️';
    const msgHit = u.hit_message_goal ? '✅' : '⚠️';
    const trendIcon = u.trend_label === 'up' ? '↗️' : u.trend_label === 'down' ? '↘️' : u.trend_label === 'first_week' ? '🆕' : '→';
    return `<tr style=\"border-bottom:1px solid #e5e7eb;\">
      <td style=\"padding:8px 6px;font-size:13px;\">${esc(u.email)}</td>
      <td style=\"padding:8px 6px;font-size:13px;text-align:right;\">${reqHit} ${u.requests_sent}<span style=\"color:#6b7280\">/${u.weekly_connection_goal}</span></td>
      <td style=\"padding:8px 6px;font-size:13px;text-align:right;\">${msgHit} ${u.messages_sent}<span style=\"color:#6b7280\">/${u.weekly_message_goal}</span></td>
      <td style=\"padding:8px 6px;font-size:13px;text-align:right;\">${u.acceptance_rate}%</td>
      <td style=\"padding:8px 6px;font-size:13px;text-align:right;\">${u.catchups_booked}</td>
      <td style=\"padding:8px 6px;font-size:13px;text-align:center;\">${trendIcon}</td>
    </tr>`;
  }).join('');
  const atRiskBlock = atRiskRows.length > 0
    ? `<table cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;background:#fee2e2;border-radius:10px;padding:14px;margin:0 0 20px;border-left:4px solid #ef4444;\"><tr><td><p style=\"margin:0;font-size:14px;font-weight:700;color:#991b1b;\">⚠️ ${atRiskRows.length} user${atRiskRows.length === 1 ? '' : 's'} at risk</p><ul style=\"margin:8px 0 0;padding-left:20px;font-size:13px;color:#7f1d1d;\">${atRiskRows.map(u => `<li>${esc(u.email)} — ${esc(u.trend_status)} (last active ${esc(String(u.last_active_week))})</li>`).join('')}</ul></td></tr></table>`
    : '';
  const body = `<p style=\"margin:0 0 16px;\">Hey mate — weekly cohort snapshot for week of <strong>${esc(String(digest.target_week))}</strong>.</p>
<table cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;background:#f3e8ff;border-radius:10px;padding:14px;margin-bottom:20px;border-left:4px solid #a855f7;\">
  <tr><td><strong style=\"color:#581c87;\">${digest.active_this_week}</strong> active users this week · <strong style=\"color:#581c87;\">${digest.goal_hit_rate}%</strong> hit both goals · <strong style=\"color:#581c87;\">${digest.total_catchups_this_week}</strong> catch-ups booked</td></tr>
</table>
${atRiskBlock}
<h2 style=\"margin:0 0 12px;font-size:16px;color:#111827;\">Active users this week</h2>
<table cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;margin-bottom:24px;\">
  <thead><tr style=\"background:#f9fafb;\">
    <th style=\"padding:10px 6px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;\">User</th>
    <th style=\"padding:10px 6px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;\">Requests</th>
    <th style=\"padding:10px 6px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;\">Messages</th>
    <th style=\"padding:10px 6px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;\">Accept</th>
    <th style=\"padding:10px 6px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;\">Catch-ups</th>
    <th style=\"padding:10px 6px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;\">Trend</th>
  </tr></thead>
  <tbody>${userRows}</tbody>
</table>
${dcfBlockHtml(dcfSummary)}
<table cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;background:#fef3c7;border-radius:10px;padding:14px;margin-bottom:8px;border-left:4px solid #f59e0b;\">
  <tr><td style=\"font-size:13px;color:#92400e;\"><strong>💤 ${dormantCount} signups</strong> still haven't uploaded data. Separate digest sent.</td></tr>
</table>
<p style=\"margin:20px 0 0;color:#6b7280;font-size:13px;\">Auto-generated. Reply if any user looks off.</p>`;
  const subjectExtra = dcfSummary && dcfSummary.total > 0 ? `, ${dcfSummary.total} DCF` : '';
  return { subject: `📊 Weekly cohort digest — ${digest.active_this_week} active, ${digest.total_catchups_this_week} catch-ups${subjectExtra}`, html: SHELL(`Cohort week of ${digest.target_week}`, body) };
}

async function fetchDcfSummary(supabase, weekStart) {
  // weekStart is the Monday of the target week (YYYY-MM-DD). Window = [weekStart, weekStart + 7 days).
  const start = new Date(weekStart + 'T00:00:00Z');
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  const { data, error } = await supabase
    .from('dcf_submissions')
    .select('candidate_id,file_name,total_score,error,created_at')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: false });
  if (error) { console.error('[dcf-summary]', error.message); return { total: 0, unique_candidates: 0, rows: [] }; }
  const rows = data || [];
  const unique = new Set(rows.map(r => r.candidate_id)).size;
  return { total: rows.length, unique_candidates: unique, rows };
}

async function sendEmail(to, subject, html, replyTo) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_NAME + ' <' + FROM_EMAIL + '>', to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error('Resend ' + res.status + ': ' + err.slice(0, 300)); }
  const data = await res.json();
  return data.id || null;
}

async function logEmail(supabase, { user_id, email_to, email_type, for_week, resend_id, status, error }) {
  await supabase.from('insight_email_log').insert({ user_id: user_id || null, email_to, email_type, for_week: for_week || null, resend_id: resend_id || null, status, error: error || null });
}

async function alreadySent(supabase, user_id, email_type, for_week) {
  if (!user_id) return false;
  const { data } = await supabase.rpc('already_sent_email', { p_user_id: user_id, p_email_type: email_type, p_for_week: for_week || null });
  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

  try {
    const body = await req.json();
    const emailType = body.email_type;
    const dryRun = !!body.dry_run;
    const force = !!body.force; // override dedupe
    let targetWeek = body.target_week;
    if (!targetWeek) {
      const d = new Date();
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      targetWeek = d.toISOString().slice(0, 10);
    }
    const result = { email_type: emailType, target_week: targetWeek, dry_run: dryRun, force, sent: [], errors: [], skipped: [], preview: null };

    if (emailType === 'archie_dropoff' || emailType === 'all') {
      const { data: dormant } = await supabase.rpc('get_dormant_users');
      const { count: totalRegistered } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const tpl = tArchieDropoff({ dormantUsers: dormant || [], totalRegistered: totalRegistered || 0 });
      if (dryRun) { result.preview = tpl; }
      else {
        try { const id = await sendEmail(ARCHIE_EMAIL, tpl.subject, tpl.html); await logEmail(supabase, { email_to: ARCHIE_EMAIL, email_type: 'archie_dropoff', for_week: targetWeek, resend_id: id, status: 'sent' }); result.sent.push({ to: ARCHIE_EMAIL, type: 'archie_dropoff', resend_id: id }); }
        catch (e) { await logEmail(supabase, { email_to: ARCHIE_EMAIL, email_type: 'archie_dropoff', for_week: targetWeek, status: 'failed', error: e.message }); result.errors.push({ to: ARCHIE_EMAIL, type: 'archie_dropoff', error: e.message }); }
        await sleep(SEND_THROTTLE_MS);
      }
    }

    if (emailType === 'candidate_dormant' || emailType === 'all') {
      const { data: dormant } = await supabase.rpc('get_dormant_users');
      for (const u of dormant || []) {
        if (!force && await alreadySent(supabase, u.user_id, 'candidate_dormant', null)) { result.skipped.push({ to: u.email, type: 'candidate_dormant', reason: 'already_sent' }); continue; }
        const tpl = tCandidateDormant({ email: u.email, signedUpDaysAgo: u.days_since_signup });
        if (dryRun) { if (!result.preview) result.preview = tpl; }
        else {
          try { const id = await sendEmail(u.email, tpl.subject, tpl.html, ARCHIE_EMAIL); await logEmail(supabase, { user_id: u.user_id, email_to: u.email, email_type: 'candidate_dormant', resend_id: id, status: 'sent' }); result.sent.push({ to: u.email, type: 'candidate_dormant', resend_id: id }); }
          catch (e) { await logEmail(supabase, { user_id: u.user_id, email_to: u.email, email_type: 'candidate_dormant', status: 'failed', error: e.message }); result.errors.push({ to: u.email, type: 'candidate_dormant', error: e.message }); }
          await sleep(SEND_THROTTLE_MS);
        }
      }
    }

    if (emailType === 'candidate_day1_followup' || emailType === 'all') {
      const { data: rows } = await supabase.rpc('get_day1_followup_users');
      for (const u of rows || []) {
        const tpl = tCandidateDay1Followup({ email: u.email });
        if (dryRun) { if (!result.preview) result.preview = tpl; }
        else {
          try { const id = await sendEmail(u.email, tpl.subject, tpl.html, ARCHIE_EMAIL); await logEmail(supabase, { user_id: u.user_id, email_to: u.email, email_type: 'candidate_day1_followup', resend_id: id, status: 'sent' }); result.sent.push({ to: u.email, type: 'candidate_day1_followup', resend_id: id }); }
          catch (e) { await logEmail(supabase, { user_id: u.user_id, email_to: u.email, email_type: 'candidate_day1_followup', status: 'failed', error: e.message }); result.errors.push({ to: u.email, type: 'candidate_day1_followup', error: e.message }); }
          await sleep(SEND_THROTTLE_MS);
        }
      }
    }

    if (emailType === 'archie_digest' || emailType === 'all') {
      const { data: digest } = await supabase.rpc('get_cohort_digest', { target_week: targetWeek });
      const { data: activeRows } = await supabase.rpc('get_active_user_weekly_summary', { target_week: targetWeek });
      const { data: atRiskRows } = await supabase.rpc('get_at_risk_users', { target_week: targetWeek });
      const dormantCount = digest.dormant_users || 0;
      const dcfSummary = await fetchDcfSummary(supabase, targetWeek);
      const tpl = tArchieDigest({ digest, activeRows: activeRows || [], atRiskRows: atRiskRows || [], dormantCount, dcfSummary });
      if (dryRun) { result.preview = tpl; result.dcf_summary = dcfSummary; }
      else {
        try { const id = await sendEmail(ARCHIE_EMAIL, tpl.subject, tpl.html); await logEmail(supabase, { email_to: ARCHIE_EMAIL, email_type: 'archie_digest', for_week: targetWeek, resend_id: id, status: 'sent' }); result.sent.push({ to: ARCHIE_EMAIL, type: 'archie_digest', resend_id: id }); }
        catch (e) { await logEmail(supabase, { email_to: ARCHIE_EMAIL, email_type: 'archie_digest', for_week: targetWeek, status: 'failed', error: e.message }); result.errors.push({ to: ARCHIE_EMAIL, type: 'archie_digest', error: e.message }); }
        await sleep(SEND_THROTTLE_MS);
      }
    }

    if (emailType === 'candidate_weekly' || emailType === 'all') {
      const { data: rows } = await supabase.rpc('get_active_user_weekly_summary', { target_week: targetWeek });
      for (const u of rows || []) {
        if (!force && await alreadySent(supabase, u.user_id, 'candidate_weekly', targetWeek)) { result.skipped.push({ to: u.email, type: 'candidate_weekly', reason: 'already_sent' }); continue; }
        const tpl = tCandidateWeekly({ email: u.email, weekKey: u.week_key, requestsSent: u.requests_sent, connGoal: u.weekly_connection_goal, messagesSent: u.messages_sent, msgGoal: u.weekly_message_goal, catchupsBooked: u.catchups_booked, acceptanceRate: u.acceptance_rate, trend: u.trend_label, avgReq: u.avg_requests_last_4w, avgMsg: u.avg_messages_last_4w });
        if (dryRun) { if (!result.preview) result.preview = tpl; }
        else {
          try { const id = await sendEmail(u.email, tpl.subject, tpl.html, ARCHIE_EMAIL); await logEmail(supabase, { user_id: u.user_id, email_to: u.email, email_type: 'candidate_weekly', for_week: targetWeek, resend_id: id, status: 'sent' }); result.sent.push({ to: u.email, type: 'candidate_weekly', resend_id: id }); }
          catch (e) { await logEmail(supabase, { user_id: u.user_id, email_to: u.email, email_type: 'candidate_weekly', for_week: targetWeek, status: 'failed', error: e.message }); result.errors.push({ to: u.email, type: 'candidate_weekly', error: e.message }); }
          await sleep(SEND_THROTTLE_MS);
        }
      }
    }

    return json(result);
  } catch (err) {
    console.error('[send-insights-email]', err);
    return json({ error: (err.message || 'unknown') }, 500);
  }
});
