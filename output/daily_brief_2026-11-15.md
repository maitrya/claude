# 🧠 Daily AI Intelligence Brief — 2026-11-15

> Generated automatically via scheduled task. Run time: ~2 min.

---

## 🗞️ AI News (Agent 1)

### 1. **Google Drops Gemini 4 Carbon & Hydrogen**
Google released two Gemini 4 variants — Carbon (Nov 10) and Hydrogen (Nov 12) — alongside Gemini Decision 1 (Nov 11), a reasoning-first model aimed at complex multi-step tasks. Omni Flash 1.2 also shipped Nov 5. Official changelogs lagged third-party trackers at time of capture.
📎 Source: [LLM Release Tracker](https://nhimg.org/llm-release-tracker) | [opper.ai](https://opper.ai/model-releases)
🏷️ [TOOL] [RESEARCH]

### 2. **Anthropic Releases Claude Fable 5.2 (GA) + Restricted Mythos 5.2**
Claude Fable 5.2 went generally available November 9. Claude Mythos 5.2, also dated November 9, is restricted to verified organisations only — suggesting a capability tier above current public offerings.
📎 Source: [opper.ai Model Tracker](https://opper.ai/model-releases)
🏷️ [TOOL]

### 3. **Mistral Large 4 Ships as Open Weights**
Mistral Large 4 is generally available from November 5 with open weights — a rare move among frontier labs. Public preview started October 6. This keeps Mistral competitive in enterprise and self-hosted deployments.
📎 Source: [nhimg LLM Tracker](https://nhimg.org/llm-release-tracker)
🏷️ [TOOL] [RESEARCH]

### 4. **OpenAI Closes $11B Round at $1.25T Valuation**
OpenAI raised $11 billion as the first tranche of a larger fundraise, valuing the company at $1.25 trillion. Fireworks AI is in separate talks at a $30B–$40B valuation. This marks continued consolidation of capital into the top few labs.
📎 Source: [AI Funding Tracker — Nov 7-8](https://aifundingtracker.com/ai-funding-news-nov-7-8-2026/) | [Best Startup US](https://beststartup.us/us-startup-funding-november-2026/)
🏷️ [CAREER] [FINANCE]

### 5. **Fal Raises $1.3B Series F + LangChain $300M, Mercor $750M**
November's funding flow is heavy: Fal (AI infra) at $1.3B, Mercor (AI hiring) at $750M, LangChain (agent orchestration) at $300M. Total AI funding in November 2026 is tracking toward $8.24B across 117 rounds.
📎 Source: [aifunding.me Nov Roundup](https://aifunding.me/roundups/november-2026) | [AlleyWatch 11/16](https://alpha-maven.com/story/venture-capital/the-weekly-notable-startup-funding-report-111626-alleywatch)
🏷️ [CAREER] [FINANCE]

### 6. **DeepMind Agents Crack Legacy 1024-bit RSA**
DeepMind agents reportedly found weaknesses in 1024-bit RSA encryption. Modern 2048-bit+ keys remain secure, but it marks a milestone in AI-driven cryptanalysis — expect near-term compliance guidance for financial institutions still using legacy TLS setups.
📎 Source: [AI Agents Directory Nov 7](https://aiagentsdirectory.com/news/ai-agents-directory-daily-brief-november-7-2026)
🏷️ [RESEARCH] [FINANCE]

### 7. **Google Launches Co-Scientist Multi-Agent Research Platform**
Google's Co-Scientist is a multi-agent system built to accelerate scientific research — structuring hypotheses, delegating literature reviews, and synthesising findings across sub-agents. AlphaGenome 2 for DNA analysis also shipped mid-November.
📎 Source: [AI Agent Store Nov Research Brief](https://aiagentstore.ai/ai-agent-news/topic/scientific-research)
🏷️ [RESEARCH]

### 8. **79% of Enterprises Have AI Agents in Production (Genpact Survey)**
Genpact's November 12 survey found 79% of enterprises run AI agents in production. Only 15% have tied AI investment to measurable P&L outcomes — signalling execution gap. This is relevant context for selling AI tooling internally.
📎 Source: [AI Agents Directory Nov 13](https://aiagentsdirectory.com/news/ai-agents-news-brief-november-13-2026)
🏷️ [CAREER]

### 9. **Citadel Launches Internal AI Research Assistant**
Citadel's AI assistant is now deployed for fundamental research internally, per HedgeCo. Man Numeric's AlphaGPT generates, codes, and backtests trading strategies automatically. Two Sigma reportedly runs AI-driven strategies across $70B AUM.
📎 Source: [HedgeCo — Citadel AI](https://www.hedgeco.net/news/?p=91495) | [Hedge Fund Huddle Podcast](https://hedge-fund-huddle.castos.com/episodes/ai-at-work-inside-the-new-era-of-hedge-fund-research-and-trading)
🏷️ [FINANCE] [CAREER]

### 10. **AI Execution Tools Could Add 15bps to $5B Funds**
Agecroft Partners estimates AI-driven execution adds ~15 basis points/year for a $5B fund trading $15B annually. 47%+ of mid-to-large hedge funds have GenAI in production as of Q1 2026. Adoption is accelerating fastest in systematic and quant strategies.
📎 Source: [Opalesque Oct 21](https://www.opalesque.com/716852/How_AI_is_changing_the_hedge_fund_investment685.html) | [AI for Hedge Funds 2026](https://www.tommasomariaricci.com/blog/ai-for-hedge-funds)
🏷️ [FINANCE]

---

## 💡 Project Ideas (Agent 2)

*Profile context: Trading Ops / Finance background, Python-comfortable, goal = investor-grade portfolio projects for fund or IM job applications.*

---

### Project A — **FX Sentiment Monitor with Macro Alerts**
**One-line pitch:** A live dashboard that reads central bank statements, news wire, and social signals to surface directional FX sentiment — before the market moves.

**Problem:** Traders and analysts manually scan Reuters, Bloomberg headlines, and Twitter for macro signals. This is slow, noisy, and misses cross-currency correlation shifts.

**Stack:** Python + Claude Haiku (sentiment tagging) + NewsAPI or GDELT + Plotly Dash or Streamlit + Supabase (history)

**Build time:** 6–8h MVP · 15h portfolio-ready

**Who cares:** FX desks, macro PMs, trading ops leads, IM recruiters, hedge fund analysts

**LinkedIn angle:** *"Built an AI macro signal aggregator for FX trading — here's what I learned about where human judgement still wins."*

**Difficulty:** EASY

---

### Project B — **Earnings Call Alpha Extractor**
**One-line pitch:** An agent that ingests earnings call transcripts and analyst reports, extracts hidden forward guidance signals, and ranks tickers by AI-detected sentiment drift vs consensus.

**Problem:** Alpha from earnings calls is buried in 10,000-word transcripts. Manual reads take hours; existing scrapers miss tone changes and hedged language.

**Stack:** Python + Claude Sonnet (long-context analysis) + SEC EDGAR API + yfinance + pandas + Streamlit

**Build time:** 10h MVP · 25h portfolio-ready (includes backtesting logic)

**Who cares:** Equity analysts, PM candidates, buy-side IM recruiters, quant researchers

**LinkedIn angle:** *"I built an agent that reads earnings calls faster than any analyst — here's the alpha signal that jumped out immediately."*

**Difficulty:** MEDIUM

---

### Project C — **AI-Narrated Portfolio Risk Report**
**One-line pitch:** A tool that takes a multi-asset portfolio, computes real-time VaR, correlation matrices, and drawdown scenarios, then uses Claude to auto-write the risk narrative — the kind of report a risk officer would actually send up the chain.

**Problem:** Risk reports are either manual (slow, expensive, inconsistent) or quantitative-only (unreadable by non-quants). An AI-narrated format bridges both.

**Stack:** Python + yfinance / Bloomberg API + scipy/numpy + Claude Sonnet (narrative) + PDF export (ReportLab or WeasyPrint)

**Build time:** 12h MVP · 30h portfolio-ready

**Who cares:** Risk officers, fund managers, compliance teams, CAIA/CFA program recruiters, any role in portfolio risk or treasury

**LinkedIn angle:** *"I automated the risk officer's weekly narrative. Here's the template, free to use."*

**Difficulty:** MEDIUM-HARD

---

## ⚖️ Cost vs Time Matrix (Agent 3)

*Pricing basis: Claude Haiku 4.5 at ~$0.80/$4 per 1M tokens (input/output); Claude Sonnet 4.6 at ~$3/$15.*

| Metric | Project A: FX Sentiment | Project B: Earnings Alpha | Project C: Risk Report |
|---|---|---|---|
| **Model** | Haiku 4.5 | Sonnet 4.6 | Sonnet 4.6 |
| **Tokens/run (est.)** | 50K input / 5K output | 150K input / 15K output | 80K input / 20K output |
| **API cost/run** | ~$0.06 | ~$0.68 | ~$0.54 |
| **Daily cost (10 runs)** | ~$0.60 | ~$6.80 | ~$5.40 |
| **Monthly API cost** | ~$18 | ~$204 | ~$162 |
| **Third-party APIs** | NewsAPI ~$15/mo | EDGAR free; yfinance free | yfinance free |
| **Hosting (Streamlit Cloud)** | Free tier | Free tier | Free tier |
| **Hours to MVP** | 6–8h | 10h | 12h |
| **Hours to portfolio-ready** | 15h | 25h | 30h |
| **Weekly maintenance** | 0.5h | 1h | 1h |
| **Interview talking point (1–10)** | 6 | 9 | 8 |
| **LinkedIn signal (1–10)** | 7 | 9 | 8 |
| **Actual utility at work (1–10)** | 8 | 7 | 9 |
| **Visa/career leverage (1–10)** | 6 | 8 | 9 |
| **Composite ROI score** | **6.75** | **8.25** | **8.50** |
| **Build vs Skip** | ✅ Build (later) | ✅ Build (second) | ✅ **Build first** |

### Decision

**Build Project C first.** The AI-narrated portfolio risk report has the highest composite ROI (8.5) because it hits all four levers simultaneously: it demonstrates applied quant knowledge (CAIA-aligned), it has direct utility in a trading operations role, it produces a shareable artefact (the PDF report), and it maps clearly onto risk/treasury/portfolio roles in the 482→186 visa pathway. The 30h portfolio-ready investment is recoverable as a template you reuse across roles.

**Build Project B second.** The earnings alpha extractor scores 8.25 and is the most LinkedIn-viral concept — but it requires more consistent API spend (~$204/month at scale). Consider building it with a cap on tickers to control cost during the portfolio phase.

**Build Project A third (or not at all).** FX Sentiment Monitor is fast to build and genuinely useful in a trading ops context, but its ROI score (6.75) reflects weaker career-trajectory signal. Build it only if you want a quick weekend win to warm up your Python/Claude workflow before tackling C.

**All-in cost if all 3 built:** ~$384/month in API + data costs, ~53h of build time to portfolio-ready across all three. Realistically, C alone is enough for 3 months of job search momentum.

---

## 🎯 Today's Top Recommendation

**Build the AI-Narrated Portfolio Risk Report (Project C) starting this week.** It's the intersection of your CAIA/CFA prep, your trading ops context, and recruiter-legible output — a PDF risk report shows, not tells, that you can operate at the analyst/risk officer level. With Mistral Large 4 now available as open weights and Claude Sonnet 4.6 on the API, the stack costs are low and the differentiation is high: 47%+ of hedge funds have AI in production, but almost none of the candidates they're hiring can demo the full stack.

---

*Sources: [LLM Gateway](https://llmgateway.io/timeline) · [nhimg LLM Tracker](https://nhimg.org/llm-release-tracker) · [opper.ai](https://opper.ai/model-releases) · [AI Funding Tracker](https://aifundingtracker.com/) · [aifunding.me](https://aifunding.me/roundups/november-2026) · [AI Agents Directory](https://aiagentsdirectory.com/news/ai-agents-news-brief-november-13-2026) · [HedgeCo](https://www.hedgeco.net/news/?p=91495) · [Opalesque](https://www.opalesque.com/716852/How_AI_is_changing_the_hedge_fund_investment685.html)*
