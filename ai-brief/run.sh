#!/usr/bin/env bash
# Daily AI brief runner — wraps claude -p for cron or manual execution
# Usage: ./run.sh [--dry-run]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$SCRIPT_DIR/prompt.md"
OUTPUT_DIR="$SCRIPT_DIR/output"
DATE=$(date +%Y-%m-%d)
LOG_FILE="$OUTPUT_DIR/run_$DATE.log"

mkdir -p "$OUTPUT_DIR"

# Subagents inherit this model; orchestrator can override to opus via the prompt
export CLAUDE_CODE_SUBAGENT_MODEL="${CLAUDE_CODE_SUBAGENT_MODEL:-claude-sonnet-4-6}"

echo "[$(date -Iseconds)] Starting daily brief for $DATE" | tee -a "$LOG_FILE"

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "[DRY RUN] Would execute: claude -p \"\$(cat $PROMPT_FILE)\" --output-format json"
  echo "[DRY RUN] Output dir: $OUTPUT_DIR"
  exit 0
fi

claude -p "$(cat "$PROMPT_FILE")" \
  --output-format json \
  2>&1 | tee -a "$LOG_FILE"

echo "[$(date -Iseconds)] Run complete. See $OUTPUT_DIR/daily_brief_$DATE.md" | tee -a "$LOG_FILE"
