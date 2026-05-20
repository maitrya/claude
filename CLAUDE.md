# CLAUDE.md — Prepped Talent Tools

> **Read this first when starting any new Claude Code session on this repo.**
> Last refreshed: 2026-05-20.

---

## 🚀 First 5 minutes in a new chat

Do these in order:

1. **Verify Supabase MCP is connected** — try a quick `execute_sql` against project `dsnkabdmposyukcedduy`. If not connected, ask the user to enable it before any debugging.
2. **Pull the current state:**
   ```sql
   SELECT
     (SELECT COUNT(*) FROM profiles) AS profiles,
     (SELECT COUNT(DISTINCT user_id) FROM networking_weeks) AS active_users,
     (SELECT COUNT(*) FROM get_dormant_users()) AS dormant,
     (SELECT jsonb_agg(jobname || ':' || schedule) FROM cron.job) AS crons;
   ```
3. **Check `insight_email_log` for any recent failed sends** — if `status = 'failed'` rows exist, investigate before next cron fires.
4. **Read this whole file once** — it's <250 lines, takes 90 seconds, saves 30 minutes.
5. **Check `TaskList`** — if the previous chat created tasks (TaskCreate), they may still be in the local DB.

---

## Repo map

```
coding experiments/                           # ← git repo root (maitrya/claude)
├── ai-career-tools/                          # Networking Dashboard (single-file React app)
│   └── networking-dashboard.html             # All React code lives here
├── dcf-grader/                               # DCF Model Reviewer (vanilla JS)
│   ├── index.html + app.js                   # Frontend
│   ├── config/{rubric.md, model-answer.md, lindy-knowledge-base.md}
│   ├── sample-models/                        # Reference + test xlsx files
│   ├── tools/{inspect.js, build-template.js} # Dev scripts
│   └── supabase/functions/grade-dcf/         # Source of Edge Function
└── CLAUDE.md                                 # This file
```

## Shared cloud infrastructure

| Service | Identifier | Purpose |
|---|---|---|
| Supabase project | `dsnkabdmposyukcedduy` | DB + Auth + Edge Functions + pg_cron |
| Anthropic | (Maitrya's account) | Claude Haiku for DCF grader + insights |
| Resend | `preppedtalent.com.au` verified | Email delivery |
| Cloudflare | `preppedtalent.com.au` DNS | Subdomains + email DKIM/SPF |
| GitHub | `maitrya/claude` | Source of truth, auto-deploys to Vercel |

## Project 1 — Networking Dashboard

**Live:** https://dashboard.preppedtalent.com.au (Vercel)

**Stack:** React 18 (CDN) + Babel standalone + Plotly + PapaParse + Supabase JS. Single HTML file, no build step.

**Supabase tables:** `profiles`, `networking_weeks`, `connections`, `messages`, `catchup_flags`, `bug_reports`, `insight_email_log`

**Edge Functions deployed (Supabase):**
- `send-magic-link` — Resend-based passwordless auth
- `kajabi-auth` — silent SSO from Kajabi (signed token)
- `submit-bug-report` — in-app 🐛 button → DB row + email Archie
- `send-insights-email` — **v4 — primary email system** (5 templates, throttle, dedupe)
- `detect-catchups` — AI catch-up detection (scaffolded but not activated; needs key)
- `grade-dcf` — DCF grader (v21, Claude Haiku + Gemini fallback)

**RPCs:** `get_platform_benchmarks()`, `get_dormant_users()`, `get_active_user_weekly_summary(date)`, `get_at_risk_users(date)`, `get_cohort_digest(date)`, `get_day1_followup_users()`, `already_sent_email(uuid, text, date)`

**Auth:** Magic link primary + Google OAuth working. LinkedIn OIDC still pending Archie's setup.

**Common bugs (with fixes):**
- "User can't see their data" → check `loadWeekDataFromDB` returned rows + week_key DESC ordering. Lazy-load runs per selected week.
- "Magic link expired" → user clicked OLD email; only the latest works.
- "Browser shows old code" → cache-bust via version comment at top of HTML. Force `Ctrl+Shift+R`.
- "Page reloads when tab regains focus" → `onAuthStateChange` filter for SIGNED_IN only, ignore TOKEN_REFRESHED.

## Project 2 — DCF Model Reviewer

**Live:** https://dcf-omega.vercel.app

**Stack:** Vanilla JS + ExcelJS CDN (browser parsing) + Supabase Edge Function + Claude Haiku 4.5

**Rubric:** `dcf-grader/config/rubric.md`. Currently **format-agnostic** — banker-style tab names accepted.

**Two open knobs awaiting Archie's call:**
- WACC strictness — currently docks ~10pts for hardcoded WACC
- Tab naming — currently flexible

**Cost per submission:** ~$0.015 (Claude Haiku).

## 📧 Email Insights System (live & automated)

**Endpoint:** `POST https://dsnkabdmposyukcedduy.supabase.co/functions/v1/send-insights-email`

```json
{
  "email_type": "archie_dropoff" | "archie_digest" | "candidate_weekly" | "candidate_dormant" | "candidate_day1_followup" | "all",
  "target_week": "YYYY-MM-DD" (optional),
  "dry_run": true (optional, returns HTML preview),
  "force": true (optional, bypasses dedupe)
}
```

**Safeguards built into v4:**
- 600ms throttle between Resend calls (under 2/sec limit)
- Dedupe via `already_sent_email` RPC — same user + email_type + for_week = skipped
- All sends logged in `insight_email_log`

**Active cron schedules (`SELECT * FROM cron.job;`):**

| Job | Cron | Local time | What |
|---|---|---|---|
| `daily-day1-followup` | `0 22 * * *` | Daily 08:00 AEST | Users 18-48h post-signup, no upload |
| `weekly-archie-digest` | `0 23 * * 0` | Mon 09:00 AEST | Cohort digest to Archie |
| `weekly-candidate-summary` | `5 23 * * 0` | Mon 09:05 AEST | Per-user weekly summary (targets prev Monday) |
| `weekly-dormant-reactivation` | `0 23 * * 2` | Wed 09:00 AEST | Re-nudge new dormant signups |

All target `DATE_TRUNC('week', CURRENT_DATE - INTERVAL '1 week')` for completed-week data.

## Skills (`~/.claude/skills/`)

- **`prepped-talent-debug`** — diagnose user-data issues with the dashboard
- **`bug-triage`** — review and prioritise `bug_reports` table entries

Both live in user-level `.claude/skills/` (NOT committed). On a new machine, copy these dirs over.

## Quick ops cheat sheet

| Task | How |
|---|---|
| Why isn't a user's data showing? | Supabase MCP → query `profiles` + `networking_weeks` count |
| Pull edge function logs | Supabase MCP `get_logs` with `service: 'edge-function'` |
| Pull auth logs | Supabase MCP `get_logs` with `service: 'auth'` |
| Redeploy an edge function | Supabase MCP `deploy_edge_function` |
| Update the dashboard HTML | Edit `ai-career-tools/networking-dashboard.html`, commit, push, Vercel auto-redeploys |
| Update DCF grader frontend | Edit `dcf-grader/{index.html,app.js}`, commit, push |
| Send a test insights email | `curl -X POST ...send-insights-email -d '{"email_type":"...","dry_run":true}'` |
| Force-resend a deduped email | Add `"force": true` to the POST body |
| Check cron job status | `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;` |

## 📊 Cohort state (2026-05-20)

**20 profiles · 5 active · 15 dormant · 4 cron jobs running**

### The 5 active users

| User | Goals | Avg req/wk | Avg msg/wk | Accept | Hit-both | Notes |
|---|---|---:|---:|---:|---:|---|
| `archie@preppedtalent.com.au` | 20/20 | 68.1 | 1010 | 92% | 81% | Power user (operator) |
| `maitryainfinity@gmail.com` | 20/20 | 35.2 | 72.5 | 89% | 67% | **Could raise goals to 35/35** |
| `yamaan2003@gmail.com` | 35/35 | 28.0 | 13.0 | **51%** | **0%** | **Goals too high. Coaching needed: low accept rate + 0.5 msg/req ratio = blast-and-burn** |
| `lfox0017@gmail.com` | 20/20 | 21.8 | 20.8 | 70% | 25% | Steady, could push higher |
| `anthonysiciliano04@gmail.com` | 10/6 | 2.7 | 0.9 | 68% | 8% | **Barely engaged — verify still in program** |

### Platform benchmarks (cohort averages, live via RPC)

```
22 reqs/wk · 77% acceptance · 166 msgs/wk · 0 catch-ups
```

### Cohort-wide observations
- **0 catch-ups across ALL 5 users in ~60 user-weeks** = statistically impossible. Either checkbox unused or AI detection needed (parked).
- **4/5 users stale by 3+ weeks** — Maitrya is only one with current-week data. Weekly cron email will keep nudging.
- **18 of 20 signups dropped off pre-upload** (90% activation gap). Day-1 follow-up cron addresses going forward.

## Decisions made

- **Magic link over email+password** — diverges from PRD AUTH-01/02 but better UX
- **DCF grader rubric is format-agnostic** — banker-style tab names accepted (Option B)
- **Vercel for both frontends** — `dashboard.preppedtalent.com.au` and `dcf-omega.vercel.app`
- **Lazy-load per week** in dashboard — scales to any LinkedIn export size
- **Cohort digest targets `previous` week** — `DATE_TRUNC('week', CURRENT_DATE - INTERVAL '1 week')`

## Active TODOs (parked, ready when you are)

| # | Task | Effort | Priority | Blocked by |
|---|---|---|---|---|
| 1 | **Wire AI catch-up detection** (CU-01..06) | M | 🔴 High — biggest unlock | Anthropic/Gemini key, UI wiring |
| 2 | **Coaching action for Yamaan** | trivial | 🔴 High | Operator decision (Archie) |
| 3 | **Recalibrate Yamaan's goals down to 25/25** | trivial | 🟡 Med | User consent |
| 4 | **Recalibrate Maitrya's goals up to 35/35** | trivial | 🟡 Med | User consent |
| 5 | **Activate Sentry** (replace `YOUR_SENTRY_DSN` in HTML) | 5min | 🟢 Low | DSN from sentry.io signup |
| 6 | **LinkedIn OIDC setup in Supabase** | 15min | 🟡 Med | Archie's LinkedIn dev account |
| 7 | **Commit skills to repo** | 5min | 🟢 Low | — |

## Owner / contacts

- **Maitrya** (developer) — `maitryainfinity@gmail.com` / `maitryaanupam@outlook.com`
- **Archie** (Prepped Talent operator) — `archie@preppedtalent.com.au`

## Recent chat sessions (chronological)

- 2026-04-21 — Dashboard V2 rebuild, pink/purple theme, CSV upload UI
- 2026-04-23 — Goal setting, drilldown charts, bug button
- 2026-04-27 — Vercel deploy, branded subdomain, Edge Function magic link
- 2026-04-28 → 04-30 — DCF grader scaffold, Claude integration, prompt tuning
- 2026-05-04 → 05-12 — DCF grader to working MVP, format-agnostic rubric
- 2026-05-18 — Email insights system (5 templates, DB analytics functions)
- 2026-05-19 — Sent first batch of emails (4 weekly + 18 dormant), throttle + dedupe added
- 2026-05-20 — Maitrya joined as 5th user, platform benchmarks unlocked, cron jobs scheduled, cohort analysis surfaced

Next chat: pick up from any item in the "Active TODOs" table above.
