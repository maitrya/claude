#!/usr/bin/env bash
# Daily AI Intelligence Brief — runner script
# Usage: ./run.sh
# Schedule: cron 0 8 * * * or Cowork /schedule daily at 8:00 AM

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p output

echo "=== Daily AI Brief — $(date +%Y-%m-%d %H:%M) ==="

# Run orchestrator non-interactively via Claude Code CLI.
# --output-format stream-json gives live output + final JSON summary.
# Adjust model with CLAUDE_MODEL env var if needed.
claude \
  --print \
  --output-format text \
  --model claude-sonnet-4-6 \
  --max-turns 50 \
  "$(cat orchestrator.md)"

echo "=== Done ==="
