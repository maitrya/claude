#!/usr/bin/env bash
# Daily AI Intelligence Brief runner
# Usage: ./run.sh
# Scheduled: daily at 8:00 AM via cron or Cowork /schedule

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$SCRIPT_DIR/orchestrator.md"
OUTPUT_DIR="$SCRIPT_DIR/output"
DATE=$(date +%Y-%m-%d)

mkdir -p "$OUTPUT_DIR"

# Strip the markdown fences from orchestrator.md to get the raw prompt
PROMPT=$(sed -n '/^```$/,/^```$/p' "$PROMPT_FILE" | grep -v '^```$')

echo "[$DATE] Starting daily brief pipeline..."

CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-4-6 \
  claude -p "$PROMPT" \
  --output-format text \
  --max-turns 50 \
  2>&1 | tee "$OUTPUT_DIR/run_${DATE}.log"

echo "[$DATE] Done. Check $OUTPUT_DIR/daily_brief_${DATE}.md"
