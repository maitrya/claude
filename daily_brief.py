#!/usr/bin/env python3
"""
Daily AI Intelligence Brief Orchestrator

Three specialist sub-agents run in sequence/parallel to compile a morning brief.

Routing:
  Agent 1 (news) and Agent 2 (ideas) → parallel
  Agent 3 (cost/time) → sequential, after Agent 2
  Orchestrator synthesis → after all three complete

Output: ./output/daily_brief_YYYY-MM-DD.md
Cost log: ./output/cost_log.csv

Usage:
  python daily_brief.py
  ANTHROPIC_API_KEY=sk-... python daily_brief.py
"""

import asyncio
import csv
from datetime import datetime
from pathlib import Path

import anthropic

SUBAGENT_MODEL = "claude-sonnet-4-6"
ORCHESTRATOR_MODEL = "claude-sonnet-4-6"

# Sonnet 4.6 pricing per 1M tokens
_INPUT_PER_M = 3.00
_OUTPUT_PER_M = 15.00

MAX_AGENT_TURNS = 15


def _cost_usd(input_tokens: int, output_tokens: int) -> float:
    return (input_tokens / 1_000_000 * _INPUT_PER_M) + (
        output_tokens / 1_000_000 * _OUTPUT_PER_M
    )


def _text(content: list) -> str:
    return "\n".join(
        b.text for b in content if getattr(b, "type", None) == "text"
    )


async def _server_tool_loop(
    client: anthropic.AsyncAnthropic,
    *,
    system: str,
    user: str,
    tools: list,
    max_tokens: int = 8192,
) -> tuple[str, int, int]:
    """Agentic loop for server-side tools (web_search / web_fetch).

    Handles pause_turn continuations up to MAX_AGENT_TURNS rounds.
    """
    messages: list = [{"role": "user", "content": user}]
    total_in = total_out = 0

    for _ in range(MAX_AGENT_TURNS):
        resp = await client.messages.create(
            model=SUBAGENT_MODEL,
            max_tokens=max_tokens,
            system=system,
            tools=tools,
            messages=messages,
        )
        total_in += resp.usage.input_tokens
        total_out += resp.usage.output_tokens

        if resp.stop_reason == "end_turn":
            return _text(resp.content), total_in, total_out

        if resp.stop_reason == "pause_turn":
            # Server-side tool loop hit its iteration cap; re-send to continue.
            # The API detects the trailing server_tool_use block and resumes.
            messages.append({"role": "assistant", "content": resp.content})
            continue

        # max_tokens or other terminal stop
        return _text(resp.content), total_in, total_out

    return _text(resp.content), total_in, total_out  # type: ignore[possibly-undefined]


# ---------------------------------------------------------------------------
# Agent 1 — AI News Researcher
# ---------------------------------------------------------------------------

async def run_news_agent(client: anthropic.AsyncAnthropic) -> tuple[str, int, int]:
    """Search the web for the top 10 AI developments in the last 24 hours."""
    system = (
        "You are an AI news researcher. Search the web for the most significant "
        "AI developments from the last 24 hours and return a structured brief."
    )
    user = """\
Search across these categories and return a structured summary:

1. MODEL RELEASES & UPDATES
   New announcements from OpenAI, Anthropic, Google, Meta, Mistral, xAI.
   Benchmark results, capability upgrades, context window changes, API pricing.

2. FUNDING & INDUSTRY MOVES
   VC rounds (Series A+, notable seed), acquisitions, partnerships, key hires.
   Regulatory developments (EU AI Act, US executive orders).

3. RESEARCH BREAKTHROUGHS
   Top papers from arXiv, Hugging Face, or major lab blogs.
   Agent frameworks, fine-tuning methods, inference improvements.

4. AI × FINANCE (specialist lens)
   AI in trading, quant, hedge funds, or risk management.
   Fintech AI tools relevant to FX, derivatives, portfolio management.

Format each item as:
**Headline**
2-sentence summary.
Source: [name](URL)
Tag: [CAREER | TOOL | RESEARCH | FINANCE]

Return max 10 items. Prioritise signal over volume."""

    return await _server_tool_loop(
        client,
        system=system,
        user=user,
        tools=[
            {"type": "web_search_20260209", "name": "web_search"},
            {"type": "web_fetch_20260209", "name": "web_fetch"},
        ],
        max_tokens=8192,
    )


# ---------------------------------------------------------------------------
# Agent 2 — Project Ideator
# ---------------------------------------------------------------------------

async def run_ideation_agent(client: anthropic.AsyncAnthropic) -> tuple[str, int, int]:
    """Generate 3 buildable AI project ideas tailored to Matt's profile."""
    system = "You are a creative AI project ideation specialist for finance professionals."
    user = """\
Generate 3 buildable AI project ideas given this profile:

PROFILE
- Trading Ops Specialist at Afterprime (FX, crypto, hedging, risk management)
- Master of Finance, CAIA L2 candidate, CFA L2 candidate
- Goal: run own fund; needs investor-grade portfolio projects
- Tech comfort: Python, Excel, basic APIs; building toward quant/ML fluency
- Visa: 485 → 482 → 186 PR path; needs to demonstrate value at Afterprime or
  for job applications in investment management / VC / AI-in-finance

FOR EACH PROJECT RETURN:
- **Project name**
- One-line pitch (founder framing, not developer framing)
- Problem it solves
- Stack (tools, models, APIs)
- Estimated build time (hours/days)
- Who would care (recruiters, fund managers, VCs, employers)
- LinkedIn post angle (what story you'd tell about building it)
- Difficulty: [EASY | MEDIUM | HARD]

Skew toward: agentic finance tools, risk monitoring, portfolio analytics,
AI-augmented research, or trading automation."""

    resp = await client.messages.create(
        model=SUBAGENT_MODEL,
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return _text(resp.content), resp.usage.input_tokens, resp.usage.output_tokens


# ---------------------------------------------------------------------------
# Agent 3 — Cost vs Time Analyzer  (depends on Agent 2)
# ---------------------------------------------------------------------------

async def run_analysis_agent(
    client: anthropic.AsyncAnthropic, project_ideas: str
) -> tuple[str, int, int]:
    """Evaluate the 3 project ideas against a cost/time/ROI matrix."""
    system = "You are a build-vs-skip decision analyst for AI projects."
    user = f"""\
Evaluate these 3 project ideas against a cost/time/ROI matrix:

{project_ideas}

FOR EACH PROJECT CALCULATE:

BUILD COST
- Estimated Claude API tokens (input + output) per run
- Estimated daily/monthly API cost at Sonnet 4.6 pricing ($3/$15 per 1M tokens)
- Any third-party API costs (financial data, news APIs, etc.)
- Hosting/infra cost if deployed

TIME COST
- Hours to MVP (working prototype, not polished)
- Hours to portfolio-ready (documented, deployable, presentable)
- Hours/week to maintain once built

RETURN ON INVESTMENT (score each 1–10)
- Interview talking point value
- Recruiter/LinkedIn signal value
- Actual utility at Afterprime or in job search
- Visa/career progression leverage
- Composite ROI score (average of above)

FINAL OUTPUT
- Ranked recommendation: which project to build first and why
- Build vs Skip decision for each project
- Total cost estimate if all 3 were built

Format as a markdown table + 2-paragraph recommendation."""

    resp = await client.messages.create(
        model=SUBAGENT_MODEL,
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return _text(resp.content), resp.usage.input_tokens, resp.usage.output_tokens


# ---------------------------------------------------------------------------
# Orchestrator synthesis
# ---------------------------------------------------------------------------

async def run_synthesis(
    client: anthropic.AsyncAnthropic,
    news: str,
    ideas: str,
    analysis: str,
) -> tuple[str, int, int]:
    """Produce a 3-sentence top recommendation from all three agent outputs."""
    user = f"""\
Write a 3-sentence 'Today's Top Recommendation' that synthesises the most
actionable insight across today's AI news, the project ideas, and the cost-time
analysis. Be specific, direct, and address Matt's career/visa context.

AI NEWS (excerpt):
{news[:2500]}

PROJECT IDEAS (excerpt):
{ideas[:2500]}

COST-TIME ANALYSIS (excerpt):
{analysis[:2500]}

3 sentences max. No preamble."""

    resp = await client.messages.create(
        model=ORCHESTRATOR_MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": user}],
    )
    return _text(resp.content), resp.usage.input_tokens, resp.usage.output_tokens


# ---------------------------------------------------------------------------
# Cost log
# ---------------------------------------------------------------------------

def _append_cost_log(
    output_dir: Path,
    date: str,
    a1_tokens: int,
    a2_tokens: int,
    a3_tokens: int,
    total_cost: float,
) -> None:
    log_path = output_dir / "cost_log.csv"
    write_header = not log_path.exists()
    with open(log_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(
                ["date", "agent_1_tokens", "agent_2_tokens", "agent_3_tokens", "total_cost_usd"]
            )
        writer.writerow([date, a1_tokens, a2_tokens, a3_tokens, f"{total_cost:.4f}"])


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main() -> None:
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)

    today = datetime.now().strftime("%Y-%m-%d")
    brief_path = output_dir / f"daily_brief_{today}.md"

    print(f"Starting daily AI intelligence brief — {today}")
    print("  Agents 1 & 2 running in parallel...")

    client = anthropic.AsyncAnthropic()

    # Parallel: Agents 1 and 2 have no dependency on each other
    (news, a1_in, a1_out), (ideas, a2_in, a2_out) = await asyncio.gather(
        run_news_agent(client),
        run_ideation_agent(client),
    )
    print("  Agents 1 & 2 done. Running Agent 3 (cost/time analysis)...")

    # Sequential: Agent 3 needs Agent 2's output
    analysis, a3_in, a3_out = await run_analysis_agent(client, ideas)
    print("  Agent 3 done. Synthesising...")

    synthesis, orch_in, orch_out = await run_synthesis(client, news, ideas, analysis)
    print("  Synthesis complete. Writing output...")

    # Compile the daily brief
    brief = f"""# Daily AI Intelligence Brief — {today}

---

## AI News

{news}

---

## Project Ideas

{ideas}

---

## Cost vs Time Matrix

{analysis}

---

## Today's Top Recommendation

{synthesis}

---

*Generated {datetime.now().strftime("%Y-%m-%d %H:%M:%S")} | {SUBAGENT_MODEL} (agents) / {ORCHESTRATOR_MODEL} (orchestrator)*
"""
    brief_path.write_text(brief, encoding="utf-8")

    # Totals
    a1_tok = a1_in + a1_out
    a2_tok = a2_in + a2_out
    a3_tok = a3_in + a3_out + orch_in + orch_out
    total_in = a1_in + a2_in + a3_in + orch_in
    total_out = a1_out + a2_out + a3_out + orch_out
    total_cost = _cost_usd(total_in, total_out)

    _append_cost_log(output_dir, today, a1_tok, a2_tok, a3_tok, total_cost)

    print(f"\nBrief saved → {brief_path}")
    print(
        f"Tokens: {total_in:,} in / {total_out:,} out | "
        f"Est. cost: ${total_cost:.4f}"
    )
    print(f"\nTop Recommendation:\n{synthesis}")


if __name__ == "__main__":
    asyncio.run(main())
