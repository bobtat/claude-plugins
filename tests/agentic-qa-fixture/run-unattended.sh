#!/bin/sh
# One whole unattended run: a calling agent hands agentic-qa:qa-runner a brief, and qa-runner runs every phase
# against the fixture app, with a stand-in `gh` answering for the ticket, the merged pull request and its diff.
# This starts a headless Claude Code session with several agents in it and spends real tokens: more than run.sh.
# usage: run-unattended.sh <label> [plugin dir]
#   MODEL, ROWS, FIXTURE_WORK, PW_FLAGS, CHROMIUM   as for run.sh
#   CALLER   caller-prompt.txt (default): a brief that grants contained steps, and a caller that answers nothing.
#            caller-prompt-escalation.txt: a brief that grants nothing, so the run stops at its first
#            irreversible step, and a caller that answers that once and waits for the report.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../.." && pwd)"
LABEL="$1"; PLUGIN="${2:-$REPO/plugins/agentic-qa}"
WORK="${FIXTURE_WORK:-${TMPDIR:-/tmp}/agentic-qa-fixture}"
OUT="$WORK/unattended/$LABEL"
[ -e "$OUT" ] && { echo "$OUT exists: a run is never reused" >&2; exit 1; }
mkdir -p "$OUT/cwd"
"$HERE/make-plugin.sh" "$PLUGIN" "$WORK/.claude/plugins/agentic-qa-$LABEL"
ROWS="${ROWS:-100}" PORT=8765 REQ_LOG="$OUT/requests.log" node "$HERE/app.mjs" & APP=$!
trap 'kill $APP 2>/dev/null' EXIT
sleep 1
cd "$OUT/cwd"
# A headless session stops agents still running ten minutes after its last turn, and a run on a slower
# model takes longer than that. Forty-five minutes lets one finish and still ends one that hangs.
set +e
CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS="${BG_WAIT_MS:-2700000}" \
PATH="$HERE/unattended/bin:$PATH" GH_STUB_LOG="$OUT/gh.log" \
claude -p "$(cat "$HERE/unattended/${CALLER:-caller-prompt.txt}")" --model "${MODEL:-claude-sonnet-5-5}" \
  --plugin-dir "$WORK/.claude/plugins/agentic-qa-$LABEL" --plugin-dir "$REPO/plugins/testing" \
  --allowedTools Agent SendMessage Skill Read Write Edit Glob Grep Bash WebFetch mcp__plugin_agentic-qa_playwright \
  --output-format json > "$OUT/result.json" 2> "$OUT/stderr.txt"
echo "exit $?" >> "$OUT/stderr.txt"
set -e
echo "output: $OUT"
node -e 'const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); console.log(r.result);' "$OUT/result.json"
node "$HERE/analyze.mjs" "$OUT"
# The scorer is for a run on the default caller and ticket: it says which of the six criteria were judged right.
node "$HERE/score.mjs" "$OUT" || true
