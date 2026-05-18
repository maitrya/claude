# CLAUDE.md — Prepped Talent Tools

> Read this first when starting any new Claude Code session on this repo.
> Last refreshed: 2026-05-18.

## Repo map

```
coding experiments/                           # ← git repo root (maitrya/claude)
├── ai-career-tools/                          # Networking Dashboard (single-file React app)
│   └── networking-dashboard.html             # All the React code lives here
├── dcf-grader/                               # DCF Model Reviewer (vanilla JS)
│   ├── index.html + app.js                   # Frontend
│   ├── config/{rubric.md, model-answer.md, lindy-knowledge-base.md}
│   ├── sample-models/                        # Reference + test xlsx files
│   ├── tools/{inspect.js, build-template.js} # Dev scripts
│   └── supabase/functions/grade-dcf/         # Source of the Edge Function
└── CLAUDE.md                                 # This file
```

## Shared cloud infrastructure

| Service | Identifier | Purpose |
|---|---|---|
| Supabase project | `dsnkabdmposyukcedduy` | DB + Auth + Edge Functions |
| Anthropic owner | (Maitrya) | Claude Haiku for DCF grader |
| Resend | domain `preppedtalent.com.au` verified | Email delivery |
| Cloudflare | `preppedtalent.com.au` DNS | Subdomains + email DKIM/SPF |
| GitHub | `maitrya/claude` | Source of truth, auto-deploys to Vercel |

## Project 1 — Networking Dashboard

**Live:** https://dashboard.preppedtalent.com.au (Vercel) + https://maitrya.github.io/claude/ai-career-tools/networking-dashboard.html (legacy GH Pages)

**Stack:** React 18 (CDN) + Babel standalone + Plotly + PapaParse + Supabase JS. Single HTML file, no build step.

**Supabase tables:** `profiles`, `networking_weeks`, `connections`, `messages`, `catchup_flags`, `bug_reports`, `insight_email_log`

**Edge Functions deployed (Supabase):**
- `send-magic-link` — Resend-based passwordless auth (bypasses Supabase 2-3/hr rate limit)
- `kajabi-auth` — silent SSO from Kajabi (signed token)
- `submit-bug-report` — in-app 🐛 button → DB row + email Archie
- `send-insights-email` — weekly analytics emails (see Email Insights section)
- `detect-catchups` — AI catch-up detection (scaffolded but not activated; needs key)

**RPCs:** `get_platform_benchmarks()`, `get_dormant_users()`, `get_active_user_weekly_summary(date)`, `get_at_risk_users(date)`, `get_cohort_digest(date)`

**Auth:** Magic link primary + Google OAuth + LinkedIn OIDC. Goal-setting screen on first login.

**Common bugs (with fixes):**
- "User can't see their data" → check `loadWeekDataFromDB` returned rows + week_key DESC ordering. Lazy-load runs per selected week.
- "Magic link expired" → user clicked OLD email; only the latest works.
- "Browser shows old code" → cache-bust via version comment at top of HTML. Force `Ctrl+Shift+R`.
- "Page reloads when tab regains focus" → `onAuthStateChange` filter for SIGNED_IN only, ignore TOKEN_REFRESHED.

## Project 2 — DCF Model Reviewer

**Live:** https://dcf-omega.vercel.app (separate Vercel project, root dir `dcf-grader/`)

**Stack:** Vanilla JS + ExcelJS CDN (browser parsing) + Supabase Edge Function + Claude Haiku 4.5

**Architecture:**
1. Browser uses ExcelJS to extract cells/formulas/font colours from .xlsx
2. POSTs JSON context to `grade-dcf` Edge Function
3. Edge Function calls Anthropic Claude (with Gemini fallback)
4. Tool-use enforces structured JSON output
5. Returns scored report (out of 100, 4 components)

**Rubric:** `dcf-grader/config/rubric.md`. Currently **format-agnostic** — banker-style tab names (`Financials`, `DCF input/output`) accepted as long as logical sections present.

**Two open knobs awaiting Archie's call:**
- WACC strictness — currently docks ~10pts for hardcoded WACC; can soften
- Tab naming — currently flexible; can re-tighten if desired

**Cost per submission:** ~$0.015 (Claude Haiku). $5 free credit covers ~333 runs.

## Email Insights System (new — 2026-05-18)

Triggered via POST to `https://dsnkabdmposyukcedduy.supabase.co/functions/v1/send-insights-email`:

```json
{
  "email_type": "archie_dropoff" | "archie_digest" | "candidate_weekly" | "candidate_dormant" | "all",
  "target_week": "YYYY-MM-DD" (optional, defaults to last Monday),
  "dry_run": true (optional, returns HTML preview instead of sending)
}
```

All sends logged in `insight_email_log` table with Resend message ID.

**Not yet scheduled.** Currently fired manually. Next step: `pg_cron` Monday 9am AEST.

## Skills (`~/.claude/skills/`)

- **`prepped-talent-debug`** — diagnose user-data issues with the dashboard
- **`bug-triage`** — review and prioritise `bug_reports` table entries

Both are NOT yet committed to the repo. They live in user `.claude/skills/`. To use on a different machine, either copy these directories over OR re-run a similar setup from this CLAUDE.md.

## Quick ops cheat sheet

| Task | How |
|---|---|
| Check why a user's data isn't showing | Supabase MCP → query their `profiles` row + `networking_weeks` count |
| Pull edge function logs | Supabase MCP `get_logs` with `service: 'edge-function'` |
| Pull auth logs | Supabase MCP `get_logs` with `service: 'auth'` |
| Redeploy an edge function | Supabase MCP `deploy_edge_function` |
| Update the dashboard HTML | Edit `ai-career-tools/networking-dashboard.html`, commit, push, Vercel auto-redeploys |
| Update DCF grader frontend | Edit `dcf-grader/{index.html,app.js}`, commit, push |
| Send a test insights email | `curl -X POST ...send-insights-email -d '{"email_type":"...","dry_run":true}'` |

## Current state snapshot (2026-05-18)

- 20 profiles registered (cleaned of typos)
- 4 users with uploaded data: archie, lfox0017, yamaan2003, anthonysiciliano04
- 15 dormant signups (haven't uploaded)
- 1 OAuth provider live (Google), LinkedIn pending Archie's setup
- Sentry NOT activated (DSN placeholder in HTML; just needs replace + push)
- AI catch-up detection NOT activated (Edge Function scaffolded; needs Anthropic/Gemini key + UI wired)
- pg_cron schedule for insights emails NOT set up

## Decisions made

- **Magic link over email+password** — diverges from PRD AUTH-01/02 but better UX
- **Strict 3-tab template for DCF was relaxed** — banker conventions now accepted (Option B in chat)
- **Vercel for both frontends** — `dashboard.preppedtalent.com.au` and `dcf-omega.vercel.app`
- **Lazy-load per week** in dashboard — scales to any user volume regardless of LinkedIn export size

## Active TODOs (parked, ready when you are)

1. Send candidate weekly emails (4 active users) — Edge Function ready, prompt for "go"
2. Send dormant reactivation emails (15 users) — same
3. Schedule via pg_cron (Monday 9am AEST) — ~10 min
4. Wire up AI catch-up detection (CU-01..06) — Anthropic/Gemini key needed
5. Real platform benchmarks display — works once 5+ users have data (currently 4)
6. Commit skills to repo so they sync

## Owner / contacts

- **Maitrya** (developer) — `maitryainfinity@gmail.com` / `maitryaanupam@outlook.com`
- **Archie** (Prepped Talent operator) — `archie@preppedtalent.com.au`
