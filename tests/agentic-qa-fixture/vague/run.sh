#!/bin/sh
# One whole unattended run against the vague-ticket fixture: a task tracker, a ticket with two criteria, and
# a pull request whose change reaches a report and an export that neither the ticket nor the diff mentions.
# The session starts inside a checkout of the app, so an agent that reads code can read all of it.
# This starts a headless Claude Code session with several agents in it and spends real tokens.
# usage: vague/run.sh <label> [plugin dir]
#   MODEL, FIXTURE_WORK, PW_FLAGS, CHROMIUM, AGENT_MODELS, BG_WAIT_MS   as for run.sh
#   VAGUE_PORT   the port the app listens on (default 8780), so two runs can go side by side on two ports
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; FIX="$(cd "$HERE/.." && pwd)"; REPO="$(cd "$FIX/../.." && pwd)"
LABEL="$1"; PLUGIN="${2:-$REPO/plugins/agentic-qa}"
WORK="${FIXTURE_WORK:-${TMPDIR:-/tmp}/agentic-qa-fixture}"
OUT="$WORK/vague/$LABEL"; PORT="${VAGUE_PORT:-8780}"
[ -e "$OUT" ] && { echo "$OUT exists: a run is never reused" >&2; exit 1; }
mkdir -p "$OUT"
"$FIX/make-plugin.sh" "$PLUGIN" "$WORK/.claude/plugins/agentic-qa-$LABEL"
# The checkout the session starts in: the tree before the pull request, then the tree as merged.
MERGE="$("$HERE/make-diff.sh" "$OUT/cwd")"
sed "s|__PORT__|$PORT|" "$HERE/caller-prompt.txt" > "$OUT/prompt.txt"
PORT="$PORT" COMMIT="$MERGE" PR=21 REQ_LOG="$OUT/requests.log" node "$HERE/repo/server.mjs" > "$OUT/app.log" 2>&1 & APP=$!
trap 'kill $APP 2>/dev/null' EXIT
sleep 1
cd "$OUT/cwd"
# A headless session stops agents still running ten minutes after its last turn, and a run on a slower
# model takes longer than that. Forty-five minutes lets one finish and still ends one that hangs.
set +e
CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS="${BG_WAIT_MS:-2700000}" \
PATH="$HERE/bin:$PATH" GH_STUB_LOG="$OUT/gh.log" GH_MERGE="$MERGE" \
claude -p "$(cat "$OUT/prompt.txt")" --model "${MODEL:-claude-sonnet-5-5}" \
  --plugin-dir "$WORK/.claude/plugins/agentic-qa-$LABEL" --plugin-dir "$REPO/plugins/testing" \
  --allowedTools Agent SendMessage Skill Read Write Edit Glob Grep Bash WebFetch mcp__plugin_agentic-qa_playwright \
  --output-format json > "$OUT/result.json" 2> "$OUT/stderr.txt"
echo "exit $?" >> "$OUT/stderr.txt"
set -e
echo "output: $OUT"
node -e 'const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); console.log(r.result);' "$OUT/result.json"
node "$FIX/analyze.mjs" "$OUT"
node "$HERE/score.mjs" "$OUT" || true
