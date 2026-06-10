#!/usr/bin/env bash
# Run the daily AI brief via Claude Code CLI.
# Usage: ./daily-brief/run.sh
# Cron:  0 8 * * * cd /path/to/repo && ./daily-brief/run.sh >> ./daily-brief/output/run.log 2>&1

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROMPT_FILE="$REPO_ROOT/daily-brief/orchestrator.md"
OUTPUT_DIR="$REPO_ROOT/daily-brief/output"
DATE=$(date +%Y-%m-%d)

mkdir -p "$OUTPUT_DIR"

echo "[$(date -Iseconds)] Starting daily brief for $DATE"

# Sub-agents use Sonnet; orchestrator synthesis can use the default model.
# CLAUDE_CODE_SUBAGENT_MODEL caps sub-agent spend without touching the orchestrator.
export CLAUDE_CODE_SUBAGENT_MODEL="claude-sonnet-4-6"

claude -p "$(cat "$PROMPT_FILE")" \
  --output-format text \
  --max-turns 40

echo "[$(date -Iseconds)] Done. Brief → $OUTPUT_DIR/daily_brief_$DATE.md"
