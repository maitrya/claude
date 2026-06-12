#!/usr/bin/env bash
# Daily AI Intelligence Brief runner.
# Run from repo root or from daily-brief/ — script resolves paths correctly.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$SCRIPT_DIR/orchestrator.md"
OUTPUT_DIR="$SCRIPT_DIR/output"

mkdir -p "$OUTPUT_DIR"

# Sub-agents inherit this; keeps costs down.
export CLAUDE_CODE_SUBAGENT_MODEL="${CLAUDE_CODE_SUBAGENT_MODEL:-claude-sonnet-4-6}"

echo "=== Daily AI Brief — $(date '+%Y-%m-%d %H:%M %Z') ==="
echo "Subagent model: $CLAUDE_CODE_SUBAGENT_MODEL"
echo "Output dir:     $OUTPUT_DIR"
echo ""

# Run orchestrator from output directory so relative paths (./output/...) resolve correctly.
cd "$OUTPUT_DIR/.."
claude -p "$(cat "$PROMPT_FILE")" --output-format text
