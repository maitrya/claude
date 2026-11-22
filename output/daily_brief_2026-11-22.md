# 🧠 Daily AI Intelligence Brief — 2026-11-22

---

## 🗞️ AI News

**OpenAI Launches GPT-6.2 Astra and Sol**
OpenAI released two new models on November 17: Sol (everyday assistant tasks) and Astra (multi-step, multi-file agentic work). Astra is positioned as a direct competitor to long-horizon agent frameworks from Google and Anthropic.
*Source: AI Release Tracker – nocode.mba | LLM Gateway Timeline* · `[MODEL]`

---

**Moonshot AI Ships Kimi K3.1 Pro Prime**
Moonshot AI released Kimi K3.1 Pro Prime on November 20, the most recent entry in its Kimi series. The release follows rapid iteration across the K3 line throughout Q4 2026.
*Source: LLM Gateway Timeline* · `[MODEL]`

---

**Tencent Announces Hy4 — Weights "Coming Days"**
Tencent unveiled Hy4, its latest-generation LLM, with model weights promised in the near term. If released open-weight, it would be one of the larger Chinese open models available outside Alibaba's Qwen line.
*Source: AI Release Tracker – nocode.mba* · `[MODEL]`

---

**Thinking Machines Lab Raises $5B**
AI infrastructure startup Thinking Machines Lab closed a $5 billion round this month. The round underscores continued mega-round activity in AI infra despite broader VC tightening.
*Source: Work Insiders – Nov 2026 Funding | AI Funding Tracker* · `[FUNDING]`

---

**Mercor Closes $750M Series D at $20B Valuation**
AI hiring platform Mercor confirmed a $750M Series D, doubling its October 2025 $10B valuation. Mercor has shifted from job-matching to supplying domain experts for AI model training and is reportedly cash-flow positive.
*Source: TechCrunch | Sacra* · `[FUNDING | EDTECH]`

---

**"Language Models Can Rewrite Their Own Weights" — arXiv:2611.21885**
A team released a 27B open model capable of editing its own weights without gradient-based training. The v2 appeared November 18 and was the lead item in multiple daily research digests on November 21.
*Source: AI Daily Digest Nov 21 | Top Papers Vol 117* · `[RESEARCH]`

---

**ROGUE-AI: Agent Incident Reports → Testable Failure Conditions**
arXiv:2611.26553 introduces ROGUE-AI, a framework converting narrative security incident reports into reproducible AI agent test cases. Directly relevant for red-teaming agentic pipelines at scale.
*Source: AI Daily Digest Nov 21* · `[RESEARCH]`

---

**EU AI Act General Application Triggered; US Deregulatory Posture Widens Gap**
The EU AI Act entered general application August 2, 2026, with a December 2 deadline for generative AI content-marking. The US is actively pushing deregulation and reportedly considering Section 301 investigations targeting the EU Act as a trade barrier.
*Source: Al Jazeera | CSA Research Note* · `[FUNDING]`

---

**Oura Acquires AI Primary Care Startup Counsel Health for $625M**
Wearable maker Oura acquired Counsel Health, an AI-powered primary care service. The deal extends Oura from passive health tracking into active AI-mediated clinical guidance — adjacent to wellness and coaching platforms.
*Source: Work Insiders – Nov 2026 Funding* · `[FUNDING]`

---

**AI Job-Search Tool Landscape: Niche Specialisation Accelerating**
A November 7 nine-tool comparison highlights Jobright, HiringCafe, and Huntr ($40/mo for AI resume features) as front-runners. The trend is toward niche fit — tools compete on match quality and application automation, not breadth of listings.
*Source: HireKey – Best AI Job Search Tools 2026* · `[EDTECH]`

> ⚠️ Data note: Several items drawn from aggregator trackers that may conflict on dates/figures. Thinking Machines Lab and Mercor Series D figures should be verified against Bloomberg/TechCrunch before citing externally. ROGUE-AI and self-rewriting weights papers are confirmed on arXiv.

---

## 💡 Project Ideas

### Project 1 — LinkedIn Message Intelligence Layer
**Pitch:** Stop spray-and-pray networking — write messages that actually get replies.

**Problem:** Dashboard data shows users (e.g. 51% acceptance, 0.5 msg/request ratio) adding connections but never talking to them. No tool sits in the job seeker's workflow and drafts personalized first-touch messages.

**Stack:** New React panel in existing `networking-dashboard.html` + Supabase Edge Function `generate-message` (Claude Haiku) + `message_drafts` table. No new services.

**Build time:** 2–3 days | **Difficulty:** EASY

**Who cares:** Every active dashboard user immediately. Coaches (Archie) can review message quality patterns in digest email.

**LinkedIn angle:** "I looked at my users' data and one had a 51% connection acceptance rate but only 0.5 messages per connection. The data was screaming: they were adding people but never talking to them. So I built the fix directly into the dashboard."

---

### Project 2 — Finance Technical Interview Coach
**Pitch:** Practice DCF, LBO, and fit questions with an AI interviewer that grades you like a Goldman associate would.

**Problem:** DCF grader users can build models but freeze up during verbal walkthroughs. No tool simulates a live technical interview with calibrated verbal feedback.

**Stack:** New React SPA at `interview.preppedtalent.com.au` + Edge Function `run-interview-session` (Claude Sonnet stateful loop) + `interview_sessions` table. Can integrate DCF grader score as context.

**Build time:** 5–7 days | **Difficulty:** MEDIUM

**Who cares:** DCF grader users (same funnel), finance bootcamps, MBA programs, university finance societies.

**LinkedIn angle:** "I built a DCF grader that helped 20+ students see where their model breaks. But the real feedback: 'I know the model — I freeze up when they ask me to explain it.' So I built the interviewer."

---

### Project 3 — Hiring Manager Cold Email Autopilot
**Pitch:** Research a company, generate a compelling cold pitch to the hiring manager, track whether it worked — all in one place.

**Problem:** Cold emails to hiring managers have the highest ROI in job search but require 30–45 minutes of research per send. No tool automates research → draft → delivery → reply tracking.

**Stack:** New React SPA at `outreach.preppedtalent.com.au` + Edge Function calling Brave/Exa search API + Claude Haiku for drafts + Resend (already integrated) for delivery + Supabase webhook tracking.

**Build time:** 8–10 days | **Difficulty:** MEDIUM-HARD

**Who cares:** High-intent job seekers, career coaches, recruiting bootcamps. The 15 dormant Prepped Talent users are a ready test cohort.

**LinkedIn angle:** "18 of my 20 users never got past signup. The answer wasn't the dashboard — it was that they didn't know who to reach out to or what to say. So I built the thing that comes before the networking dashboard."

---

## ⚖️ Cost vs Time Matrix

### Build Cost

| Metric | P1 · Message AI | P3 · Email Autopilot | P2 · Interview Coach |
|---|---|---|---|
| Tokens per use | 500 in · 600 out | 3,800 in · 1,400 out | 12,000 in · 6,000 out |
| Cost per use | $0.00088 | $0.0027 | $0.126 |
| Monthly API (20u × 5/wk) | **$0.35** | **$1.08** | **$50.40** |
| Third-party services | None | Brave/Exa $0–$20/mo | None |
| Hosting / infra | $0 (free tier) | $0 (free tier) | $0 (free tier) |

### Time Cost

| Metric | P1 | P3 | P2 |
|---|---|---|---|
| Hours to MVP | ~20 h | ~72 h | ~48 h |
| Hours to portfolio-ready | ~30 h | ~96 h | ~68 h |
| Maintenance per week | ~1 h | ~3 h | ~2 h |

### ROI Score (1–10)

| Dimension | P1 · Message AI | P3 · Email Autopilot | P2 · Interview Coach |
|---|---|---|---|
| User value / engagement | 9 | 8 | 8 |
| Growth / acquisition | 7 | **9** | 7 |
| Monetisation potential | 7 | 8 | **9** |
| Product flywheel fit | **10** | 7 | 5 |
| **Composite ROI** | **8.25** | **8.0** | **7.25** |

### Decision

| Project | Decision | Reason |
|---|---|---|
| P1 — LinkedIn Message Intelligence | **Build first** | Highest composite ROI, $0.35/mo, 20h to MVP, zero new services, plugs into existing dashboard |
| P3 — Cold Email Autopilot | **Build second** | Highest growth score (9/10), API still cheap, Resend already integrated |
| P2 — Interview Coach | **Defer — needs paid tier first** | $50.40/mo at current scale, $252/mo at 100 users — only viable behind a paywall |

### Total Cost If All 3 Built

| Item | Estimate |
|---|---|
| Total build time | ~140 h (~18 work days) |
| Monthly API combined | $51.83/mo |
| + Brave/Exa (P3) | +$0–$20/mo |
| **Total monthly range** | **$52–$72/mo** |
| Hosting / infra | $0 (free tier) |

*Pricing: Haiku 4.5 — $0.00025/1K input, $0.00125/1K output; Sonnet 4.6 — $0.003/1K input, $0.015/1K output.*

---

## 🎯 Today's Top Recommendation

Ship the **LinkedIn Message Intelligence Layer** this week — 20 hours to MVP, $0.35/month in API costs, zero new services, and it directly addresses the blast-and-burn pattern already visible in your user data. The biggest AI news this week is **Mercor closing at $20B** doing AI-augmented hiring, which validates the market you're building in — that's a signal the niche is worth doubling down on. Build P1 to deepen engagement with active users, then follow with the **Cold Email Autopilot** to solve the 90% activation drop-off problem and bring dormant users back.

---

*Generated: 2026-11-22 | Pipeline: 3 sub-agents (news + ideas + cost analysis)*
