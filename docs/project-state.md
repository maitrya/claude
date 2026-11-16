# Project state snapshots

> Moved out of CLAUDE.md so it is not loaded into every session. These are point-in-time
> snapshots and go stale; for live numbers ask the `supabase-ops` agent for a health check.

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

---

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
