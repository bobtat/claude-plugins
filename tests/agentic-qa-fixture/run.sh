#!/bin/sh
# One Phase 4-5 fixture run: the real orchestration, step-executor and qa-reporter against the fixture app.
# This starts a headless Claude Code session and spends real tokens.
# usage: run.sh <label> [plugin dir]
#   MODEL          model for the session and every agent that inherits it (default: claude-sonnet-5-5)
#   MAKE           make-run.sh (default) or make-run-listfirst.sh
#   LIVE_REPORT    on (default), as /agentic-qa:walkthrough runs it, or off, as qa-runner does with no report destination
#   ROWS           rows in the orders table, which sets how large the list page is (default: 100)
#   FIXTURE_WORK   where run directories, the plugin copy and Playwright's output go
#   PW_FLAGS, CHROMIUM   see make-plugin.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../.." && pwd)"
LABEL="$1"; PLUGIN="${2:-$REPO/plugins/agentic-qa}"
WORK="${FIXTURE_WORK:-${TMPDIR:-/tmp}/agentic-qa-fixture}"
RUN="$WORK/runs/$LABEL"
[ -e "$RUN" ] && { echo "$RUN exists: a run directory is never reused" >&2; exit 1; }
mkdir -p "$WORK/cwd"
"$HERE/make-plugin.sh" "$PLUGIN" "$WORK/.claude/plugins/agentic-qa-$LABEL"
"$HERE/${MAKE:-make-run.sh}" "$RUN"
ROWS="${ROWS:-100}" PORT=8765 REQ_LOG="$RUN/requests.log" node "$HERE/app.mjs" & APP=$!
trap 'kill $APP 2>/dev/null' EXIT
sleep 1
node -e '
const fs = require("fs");
const [prompt, spawn, run, out] = process.argv.slice(1);
fs.writeFileSync(out, fs.readFileSync(prompt, "utf8").replace("__SPAWN__", fs.readFileSync(spawn, "utf8").trim()).replaceAll("__W__", run));' \
  "$HERE/orchestrator-prompt.txt" "$HERE/spawn-live-${LIVE_REPORT:-on}.txt" "$RUN" "$RUN/prompt.txt"
cd "$WORK/cwd"
set +e
claude -p "$(cat "$RUN/prompt.txt")" --model "${MODEL:-claude-sonnet-5-5}" \
  --plugin-dir "$WORK/.claude/plugins/agentic-qa-$LABEL" --plugin-dir "$REPO/plugins/testing" \
  --allowedTools Agent SendMessage Skill Read Write Edit Glob Grep Bash mcp__plugin_agentic-qa_playwright \
  --output-format json > "$RUN/result.json" 2> "$RUN/stderr.txt"
echo "exit $?" >> "$RUN/stderr.txt"
set -e
echo "run directory: $RUN"
grep -E '^## S|Verdict' "$RUN/step-results.md" | paste - - || true
node "$HERE/analyze.mjs" "$RUN"
