#!/usr/bin/env python3
"""Daily AI Intelligence Brief Orchestrator.

Spawns three specialist sub-agents and compiles their output into a single
morning brief with cost tracking.

  Agent 1 (news)  ─┐
                   ├─ parallel ─> Agent 3 (analysis) ─> compile brief
  Agent 2 (ideas) ─┘

Usage:
    export ANTHROPIC_API_KEY=sk-ant-...
    python daily_brief.py

Output:
    ./output/daily_brief_YYYY-MM-DD.md
    ./output/cost_log.csv
"""

import asyncio
import csv
import os
from datetime import datetime
from pathlib import Path

import anthropic

SUBAGENT_MODEL = "claude-sonnet-4-6"
ORCHESTRATOR_MODEL = "claude-opus-4-7"
MAX_TURNS = 15
OUTPUT_DIR = Path("./output")

# ── Prompts ───────────────────────────────────────────────────────────────────

NEWS_SYSTEM = (
    "You are an expert AI news researcher. Use web search to find today's most "
    "significant AI developments. Be specific, cite sources, and focus on signal over noise."
)

NEWS_PROMPT = """Today is {today}. Search the web for the most significant AI developments from the last 24 hours.

Return max 10 items across these four categories:

1. MODEL RELEASES & UPDATES
   New model announcements (OpenAI, Anthropic, Google, Meta, Mistral, xAI),
   benchmark results, capability upgrades, context window changes, API pricing.

2. FUNDING & INDUSTRY MOVES
   VC rounds (Series A+, seed if notable), acquisitions, key hires,
   regulatory developments (EU AI Act, US executive orders).

3. RESEARCH BREAKTHROUGHS
   Top papers from arXiv, Hugging Face, or major lab blogs —
   agent frameworks, fine-tuning methods, inference improvements.

4. AI x FINANCE
   AI in trading, quant, hedge funds, risk management,
   fintech AI tools relevant to FX, derivatives, portfolio management.

Format each item exactly as:
**[Headline]**
[2-sentence summary]
Source: [name] — [URL if available]
[CAREER | TOOL | RESEARCH | FINANCE]

Prioritise signal over volume. Max 10 items total."""

IDEAS_SYSTEM = (
    "You are an expert AI project ideation coach specialising in finance and trading. "
    "Generate actionable, investor-grade project ideas with clear founder framing."
)

IDEAS_PROMPT = """Today is {today}. Generate exactly 3 buildable AI project ideas for this builder profile:

PROFILE:
- Trading Ops Specialist (FX, crypto, hedging, risk management)
- Master of Finance, CAIA L2 candidate, CFA L2 candidate
- Goal: investor-grade portfolio projects to eventually run own fund
- Tech: Python, Excel, basic APIs — building toward quant/ML fluency
- Visa path: 485 → 482 → 186 PR in Australia; needs to demonstrate value at
  current employer or in investment management / VC / AI-in-finance roles

FOR EACH PROJECT, PROVIDE:
1. **Project Name**
2. One-line pitch (founder framing, not developer framing)
3. Problem it solves
4. Stack (tools, models, APIs)
5. Build time — hours to MVP / hours to portfolio-ready
6. Target audience (recruiters, fund managers, VCs, employers)
7. LinkedIn post angle
8. Difficulty: [EASY | MEDIUM | HARD]

Skew ideas toward: agentic finance tools, risk monitoring, portfolio analytics,
AI-augmented research, trading automation."""

ANALYSIS_SYSTEM = (
    "You are an expert at evaluating AI project build cost, time, and career ROI. "
    "Produce rigorous, honest cost-benefit analysis with specific numbers."
)

ANALYSIS_PROMPT = """Evaluate these 3 AI project ideas against a cost/time/ROI decision matrix.

PROJECT IDEAS:
{ideas}

FOR EACH PROJECT, CALCULATE:

BUILD COST:
- Estimated Claude API tokens (input + output) per run
- Daily/monthly API cost at Sonnet 4.6 pricing ($3/1M input, $15/1M output)
- Third-party API costs (financial data, news APIs, etc.)
- Hosting/infra cost if deployed

TIME COST:
- Hours to MVP (working prototype, not polished)
- Hours to portfolio-ready (documented, deployable, presentable)
- Hours/week to maintain once built

ROI SCORES (1–10 each):
- Interview talking point value
- Recruiter/LinkedIn signal value
- Actual utility at current employer or in job search
- Visa/career progression leverage
- Composite ROI score (average of above)

FINAL DELIVERABLE:
1. Markdown table comparing all 3 projects across all metrics
2. Ranked recommendation: which to build first and why (2 paragraphs)
3. Build vs Skip verdict for each project
4. Total cost estimate if all 3 were built

Be specific with numbers. Assume the builder has ~10 hours/week available."""

SYNTHESIS_PROMPT = """Based on today's AI news and project analysis below, write exactly 3 sentences:

1. The single most important news item and why it matters for an AI-in-finance career.
2. Which project to build first and the strongest single reason to do it now.
3. One concrete action to take today (specific, not generic).

NEWS HIGHLIGHTS:
{news}

PROJECT ANALYSIS:
{analysis}

Respond with exactly 3 sentences. Be direct and specific. No preamble or headers."""


# ── Agent runners ──────────────────────────────────────────────────────────────

async def run_news_agent(
    client: anthropic.AsyncAnthropic,
) -> tuple[str, int, int]:
    today = datetime.now().strftime("%B %d, %Y")
    messages = [{"role": "user", "content": NEWS_PROMPT.format(today=today)}]
    total_in = total_out = 0
    result = "[News agent returned no content]"

    for _ in range(MAX_TURNS):
        try:
            async with client.messages.stream(
                model=SUBAGENT_MODEL,
                max_tokens=8192,
                output_config={"effort": "medium"},
                system=NEWS_SYSTEM,
                tools=[{"type": "web_search_20260209", "name": "web_search"}],
                messages=messages,
            ) as stream:
                response = await stream.get_final_message()
        except anthropic.APIError as exc:
            return f"[News agent error: {exc}]", total_in, total_out

        total_in += response.usage.input_tokens
        total_out += response.usage.output_tokens

        if response.stop_reason == "end_turn":
            result = next(
                (b.text for b in response.content if b.type == "text"), result
            )
            break

        # Server-side web-search loop hit its iteration limit — continue
        if response.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": []})
            continue

        break  # unexpected stop reason

    return result, total_in, total_out


async def run_ideas_agent(
    client: anthropic.AsyncAnthropic,
) -> tuple[str, int, int]:
    today = datetime.now().strftime("%B %d, %Y")
    try:
        async with client.messages.stream(
            model=SUBAGENT_MODEL,
            max_tokens=8192,
            output_config={"effort": "medium"},
            system=IDEAS_SYSTEM,
            messages=[{"role": "user", "content": IDEAS_PROMPT.format(today=today)}],
        ) as stream:
            response = await stream.get_final_message()
    except anthropic.APIError as exc:
        return f"[Ideas agent error: {exc}]", 0, 0

    return (
        next((b.text for b in response.content if b.type == "text"), "[No ideas returned]"),
        response.usage.input_tokens,
        response.usage.output_tokens,
    )


async def run_analysis_agent(
    client: anthropic.AsyncAnthropic,
    ideas: str,
) -> tuple[str, int, int]:
    try:
        async with client.messages.stream(
            model=SUBAGENT_MODEL,
            max_tokens=8192,
            output_config={"effort": "medium"},
            system=ANALYSIS_SYSTEM,
            messages=[{"role": "user", "content": ANALYSIS_PROMPT.format(ideas=ideas)}],
        ) as stream:
            response = await stream.get_final_message()
    except anthropic.APIError as exc:
        return f"[Analysis agent error: {exc}]", 0, 0

    return (
        next((b.text for b in response.content if b.type == "text"), "[No analysis returned]"),
        response.usage.input_tokens,
        response.usage.output_tokens,
    )


async def synthesize_recommendation(
    client: anthropic.AsyncAnthropic,
    news: str,
    ideas: str,
    analysis: str,
) -> str:
    try:
        async with client.messages.stream(
            model=ORCHESTRATOR_MODEL,
            max_tokens=2048,
            thinking={"type": "adaptive"},
            output_config={"effort": "medium"},
            messages=[
                {
                    "role": "user",
                    "content": SYNTHESIS_PROMPT.format(
                        news=news[:2000],
                        analysis=analysis[:3000],
                    ),
                }
            ],
        ) as stream:
            response = await stream.get_final_message()
    except anthropic.APIError as exc:
        return f"[Synthesis error: {exc}]"

    return next((b.text for b in response.content if b.type == "text"), "")


# ── Output helpers ─────────────────────────────────────────────────────────────

def build_brief(
    date_str: str,
    news: str,
    ideas: str,
    analysis: str,
    top_rec: str,
) -> str:
    return f"""# Daily AI Intelligence Brief — {date_str}

---

## 🗞️ AI News

{news}

---

## 💡 Project Ideas

{ideas}

---

## ⚖️ Cost vs Time Matrix

{analysis}

---

## 🎯 Today's Top Recommendation

{top_rec}

---
*Generated by Daily AI Intelligence Brief Orchestrator*
"""


def log_costs(
    date_str: str,
    a1: tuple[int, int],
    a2: tuple[int, int],
    a3: tuple[int, int],
) -> float:
    # Sonnet 4.6 pricing
    rate_in = 3.0 / 1_000_000   # $3/1M input tokens
    rate_out = 15.0 / 1_000_000  # $15/1M output tokens

    def agent_cost(tokens: tuple[int, int]) -> float:
        return tokens[0] * rate_in + tokens[1] * rate_out

    total = agent_cost(a1) + agent_cost(a2) + agent_cost(a3)
    log_path = OUTPUT_DIR / "cost_log.csv"
    write_header = not log_path.exists()

    with open(log_path, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if write_header:
            w.writerow([
                "date",
                "agent_1_input_tokens", "agent_1_output_tokens",
                "agent_2_input_tokens", "agent_2_output_tokens",
                "agent_3_input_tokens", "agent_3_output_tokens",
                "total_cost_usd",
            ])
        w.writerow([
            date_str,
            a1[0], a1[1],
            a2[0], a2[1],
            a3[0], a3[1],
            f"{total:.6f}",
        ])

    return total


# ── Orchestrator ───────────────────────────────────────────────────────────────

async def main() -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit("ANTHROPIC_API_KEY environment variable is not set.")

    OUTPUT_DIR.mkdir(exist_ok=True)
    date_str = datetime.now().strftime("%Y-%m-%d")
    brief_path = OUTPUT_DIR / f"daily_brief_{date_str}.md"

    client = anthropic.AsyncAnthropic(api_key=api_key)

    def ts() -> str:
        return datetime.now().strftime("%H:%M:%S")

    print(f"[{ts()}] Daily brief — {date_str}")
    print(f"[{ts()}] Agents 1 (news) and 2 (ideas) starting in parallel...")

    # Agents 1 and 2 run concurrently — no dependency between them
    raw = await asyncio.gather(
        run_news_agent(client),
        run_ideas_agent(client),
        return_exceptions=True,
    )

    if isinstance(raw[0], Exception):
        news, a1_in, a1_out = f"[News agent failed: {raw[0]}]", 0, 0
    else:
        news, a1_in, a1_out = raw[0]

    if isinstance(raw[1], Exception):
        ideas, a2_in, a2_out = f"[Ideas agent failed: {raw[1]}]", 0, 0
    else:
        ideas, a2_in, a2_out = raw[1]

    print(f"[{ts()}] Agents 1 & 2 done. Agent 3 (analysis) starting...")

    # Agent 3 runs sequentially after Agent 2 — needs ideas output
    if ideas.startswith("["):
        analysis, a3_in, a3_out = "[Analysis skipped: ideas agent failed]", 0, 0
    else:
        analysis, a3_in, a3_out = await run_analysis_agent(client, ideas)

    print(f"[{ts()}] Agent 3 done. Synthesising recommendation...")

    top_rec = await synthesize_recommendation(client, news, ideas, analysis)

    brief = build_brief(date_str, news, ideas, analysis, top_rec)
    brief_path.write_text(brief, encoding="utf-8")

    total_cost = log_costs(
        date_str,
        (a1_in, a1_out),
        (a2_in, a2_out),
        (a3_in, a3_out),
    )
    total_in = a1_in + a2_in + a3_in
    total_out = a1_out + a2_out + a3_out

    print(f"\n✅  Brief saved → {brief_path}")
    print(f"📊  Tokens: {total_in:,} in / {total_out:,} out  (~${total_cost:.4f})")
    print(f"\n🎯  Today's recommendation:\n{top_rec}")


if __name__ == "__main__":
    asyncio.run(main())
