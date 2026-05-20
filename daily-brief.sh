#!/usr/bin/env bash
# Run the daily AI intelligence brief via Claude Code CLI.
# Usage:
#   ./daily-brief.sh                   # interactive (default)
#   ./daily-brief.sh --non-interactive # headless / cron mode
#
# Cron example (8 AM AEST = 10 PM UTC previous night):
#   0 22 * * * cd /path/to/repo && ./daily-brief.sh --non-interactive >> ./output/cron.log 2>&1

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$REPO_DIR/.claude/commands/daily-brief.md"

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "ERROR: Prompt file not found at $PROMPT_FILE" >&2
  exit 1
fi

mkdir -p "$REPO_DIR/output"

if [[ "${1:-}" == "--non-interactive" ]]; then
  # Headless mode — requires ANTHROPIC_API_KEY in environment
  exec claude -p "$(cat "$PROMPT_FILE")" \
    --output-format text \
    --model claude-sonnet-4-6
else
  # Interactive: open Claude Code with /daily-brief pre-loaded
  exec claude --resume
fi
