#!/usr/bin/env python3
"""
Daily AI Intelligence Brief — Orchestrator

Usage:
    python daily-brief/run.py

Schedule (cron, 8 AM daily):
    0 8 * * * cd /path/to/repo && python daily-brief/run.py >> daily-brief/output/run.log 2>&1

Output:
    daily-brief/output/daily_brief_YYYY-MM-DD.md
    daily-brief/output/cost_log.csv
"""

import asyncio
import csv
import os
import sys
from datetime import date
from pathlib import Path

BRIEF_DATE = date.today().isoformat()
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_FILE = OUTPUT_DIR / f"daily_brief_{BRIEF_DATE}.md"
COST_LOG = OUTPUT_DIR / "cost_log.csv"

# ---------------------------------------------------------------------------
# Agent prompts
# ---------------------------------------------------------------------------

NEWS_AGENT_PROMPT = """
Conduct web searches across the following categories and return a structured
summary of the most significant AI developments from the last 24 hours.

1. MODEL RELEASES & UPDATES
   - New model announcements (OpenAI, Anthropic, Google, Meta, Mistral, xAI)
   - Benchmark results, capability upgrades, context window changes
   - API pricing changes

2. FUNDING & INDUSTRY MOVES
   - VC rounds in AI startups (Series A+, seed if notable)
   - Acquisitions, partnerships, and key hires
   - Regulatory developments (EU AI Act, US executive orders)

3. RESEARCH BREAKTHROUGHS
   - Top papers from arXiv, Hugging Face, or major lab blogs
   - Agent frameworks, fine-tuning methods, inference improvements

4. AI x FINANCE
   - AI in trading, quant, hedge funds, or risk management
   - Fintech AI tools relevant to FX, derivatives, portfolio management

Format each item as:
- **Headline**
- 2-sentence summary
- Source + link
- Tag: [CAREER | TOOL | RESEARCH | FINANCE]

Return max 10 items. Prioritise signal over volume.
""".strip()

IDEAS_AGENT_PROMPT = """
Generate 3 buildable AI project ideas based on current AI news and the
following profile:

PROFILE:
- Trading Ops Specialist at Afterprime (FX, crypto, hedging, risk)
- Master of Finance, CAIA L2 candidate, CFA L2 candidate
- Goal: run own fund; needs investor-grade portfolio projects
- Tech: Python, Excel, basic APIs; building toward quant/ML fluency
- Visa: 485 → 482 → 186 PR path; needs to demonstrate value at Afterprime
  or for investment management / VC / AI-in-finance job applications

FOR EACH PROJECT, RETURN:
- Project name
- One-line pitch (founder framing, not developer framing)
- Problem it solves
- Stack (tools, models, APIs)
- Estimated build time (hours/days)
- Who would care about this (recruiters, fund managers, VCs, employers)
- LinkedIn post angle
- Difficulty: [EASY | MEDIUM | HARD]

Skew ideas toward: agentic finance tools, risk monitoring, portfolio
analytics, AI-augmented research, or trading automation.
""".strip()


def cost_agent_prompt(ideas_output: str) -> str:
    return f"""
You are a cost/time analyst. Below are 3 project ideas. Produce a decision
matrix for each one.

PROJECT IDEAS:
{ideas_output}

FOR EACH PROJECT, CALCULATE:

BUILD COST
- Estimated Claude API tokens (input + output) per run
- Estimated daily/monthly API cost at current Sonnet 4 pricing (~$3/$15 per M tokens)
- Any third-party API costs (financial data, news APIs, etc.)
- Hosting/infra cost if deployed

TIME COST
- Hours to MVP (working prototype)
- Hours to portfolio-ready (documented, deployable, presentable)
- Hours to maintain per week once built

RETURN ON INVESTMENT (score 1–10 each)
- Interview talking point value
- Recruiter/LinkedIn signal value
- Actual utility at Afterprime or in job search
- Visa/career progression leverage
- Composite ROI score (average of above)

FINAL OUTPUT:
- Ranked recommendation: which project to build first and why
- Build vs Skip decision for each project
- Total cost estimate if all 3 were built

Format the matrix as a markdown table + 2-paragraph recommendation.
""".strip()


def synthesis_prompt(news: str, ideas: str, cost: str) -> str:
    return f"""
You are synthesising a morning brief. Read the three sections below and write
a single "Today's Top Recommendation" in exactly 3 sentences:
1. What to build today and why (based on the cost/time matrix winner).
2. The one AI news item most relevant to that project.
3. The single highest-leverage action to take this morning.

AI NEWS:
{news}

PROJECT IDEAS:
{ideas}

COST VS TIME MATRIX:
{cost}

Write only the 3-sentence recommendation. No headers, no preamble.
""".strip()


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

async def run_agent(name: str, prompt: str) -> tuple[str, int]:
    """Spawn claude -p and return (output, exit_code)."""
    print(f"[{name}] starting...", flush=True)
    proc = await asyncio.create_subprocess_exec(
        "claude", "-p", prompt,
        "--output-format", "text",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    output = stdout.decode().strip()
    if proc.returncode != 0:
        err = stderr.decode().strip()[:400]
        print(f"[{name}] WARNING: exit {proc.returncode} — {err}", flush=True)
        if not output:
            output = f"[{name} failed — exit {proc.returncode}]\n{err}"
    else:
        print(f"[{name}] done ({len(output)} chars)", flush=True)
    return output, proc.returncode


def append_cost_log(news_ok: bool, ideas_ok: bool, cost_ok: bool) -> None:
    write_header = not COST_LOG.exists() or COST_LOG.stat().st_size == 0
    with open(COST_LOG, "a", newline="") as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(["date", "news_agent", "ideas_agent", "cost_agent",
                             "total_cost_usd_est", "notes"])
        # Token counts aren't exposed by claude -p; log qualitative status.
        writer.writerow([
            BRIEF_DATE,
            "ok" if news_ok else "failed",
            "ok" if ideas_ok else "failed",
            "ok" if cost_ok else "failed",
            "~$0.05–0.15",
            "claude-sonnet-4-6 x4 calls",
        ])


async def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n=== Daily AI Brief: {BRIEF_DATE} ===\n", flush=True)

    # Agent 1 (news) + Agent 2 (ideas) — parallel
    print("[orchestrator] Running news + ideas agents in parallel...", flush=True)
    (news, news_rc), (ideas, ideas_rc) = await asyncio.gather(
        run_agent("ai-news-researcher", NEWS_AGENT_PROMPT),
        run_agent("ai-project-ideator", IDEAS_AGENT_PROMPT),
    )

    # Agent 3 (cost/time) — sequential, depends on ideas
    print("[orchestrator] Running cost-time analysis agent...", flush=True)
    cost, cost_rc = await run_agent("cost-time-analyzer", cost_agent_prompt(ideas))

    # Synthesis (orchestrator itself)
    print("[orchestrator] Synthesising final recommendation...", flush=True)
    synthesis, _ = await run_agent(
        "orchestrator-synthesis",
        synthesis_prompt(news, ideas, cost),
    )

    # Write brief
    brief = f"""# Daily AI Intelligence Brief — {BRIEF_DATE}

## 🗞️ AI News

{news}

---

## 💡 Project Ideas

{ideas}

---

## ⚖️ Cost vs Time Matrix

{cost}

---

## 🎯 Today's Top Recommendation

{synthesis}
"""
    OUTPUT_FILE.write_text(brief, encoding="utf-8")
    print(f"\n[orchestrator] Brief saved → {OUTPUT_FILE}", flush=True)

    # Cost log
    append_cost_log(news_rc == 0, ideas_rc == 0, cost_rc == 0)
    print(f"[orchestrator] Cost log updated → {COST_LOG}", flush=True)

    # Terminal summary
    print("\n" + "=" * 60, flush=True)
    print("✅ COMPLETE", flush=True)
    print("=" * 60, flush=True)
    print("\n🎯 TOP RECOMMENDATION:\n", flush=True)
    print(synthesis, flush=True)
    print(flush=True)

    # Exit non-zero if any agent failed
    if any(rc != 0 for rc in (news_rc, ideas_rc, cost_rc)):
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
