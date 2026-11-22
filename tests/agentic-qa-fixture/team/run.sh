#!/bin/sh
# One whole unattended run against the team fixture: a calling agent hands agentic-qa:qa-runner a brief, and
# qa-runner runs every phase against team/app.mjs. It needs what the orders fixture does not: a signed-in
# browser session, a CLI on the allowed-commands list, a linked doc, and a caller that answers one escalation.
# This starts a headless Claude Code session with several agents in it and spends real tokens.
# usage: team/run.sh <label> [plugin dir]
#   MODEL, FIXTURE_WORK, PW_FLAGS, CHROMIUM   as for ../run.sh
# Agents must be able to spawn agents: set CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=2 where it is 1.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; FIXTURE="$(cd "$HERE/.." && pwd)"; REPO="$(cd "$FIXTURE/../.." && pwd)"
LABEL="$1"; PLUGIN="${2:-$REPO/plugins/agentic-qa}"
WORK="${FIXTURE_WORK:-${TMPDIR:-/tmp}/agentic-qa-fixture}"
OUT="$WORK/team/$LABEL"
[ -e "$OUT" ] && { echo "$OUT exists: a run is never reused" >&2; exit 1; }
mkdir -p "$OUT/cwd/.claude" "$OUT/session"
"$FIXTURE/make-plugin.sh" "$PLUGIN" "$WORK/.claude/plugins/agentic-qa-$LABEL"
# The session's directory is a git checkout whose settings file git does not track, which is the only kind of
# project settings file the guard counts. It lists the CLI under test: a person saying a run may start it.
git -C "$OUT/cwd" init -q
printf -- '---\nallowed_commands:\n  - teamctl\n---\n' > "$OUT/cwd/.claude/agentic-qa.local.md"
# The signed-in session, as the browser storage state a brief names. It stands for a login a person completed.
node --input-type=module -e '
import fs from "node:fs";
import {SESSION} from "'"$HERE"'/constants.mjs";
fs.writeFileSync(process.argv[1], JSON.stringify({cookies: [{name: "session", value: SESSION, domain: "localhost", path: "/", expires: -1, httpOnly: true, secure: false, sameSite: "Lax"}], origins: []}, null, 2));' "$OUT/session/qa-admin-1.json"
sed "s|__SESSION__|$OUT/session/qa-admin-1.json|" "$HERE/caller-prompt.txt" > "$OUT/prompt.txt"
REQ_LOG="$OUT/requests.log" RELAY_LOG="$OUT/relay.log" node "$HERE/app.mjs" & APP=$!
trap 'kill $APP 2>/dev/null' EXIT
sleep 1
: > "$OUT/relay.log"; : > "$OUT/cli.log"
cd "$OUT/cwd"
set +e
PATH="$HERE/bin:$PATH" GH_STUB_LOG="$OUT/gh.log" CLI_LOG="$OUT/cli.log" \
claude -p "$(cat "$OUT/prompt.txt")" --model "${MODEL:-claude-sonnet-5-5}" \
  --plugin-dir "$WORK/.claude/plugins/agentic-qa-$LABEL" --plugin-dir "$REPO/plugins/testing" \
  --allowedTools Agent SendMessage Skill Read Write Edit Glob Grep Bash WebFetch mcp__plugin_agentic-qa_playwright \
  --output-format json > "$OUT/result.json" 2> "$OUT/stderr.txt"
echo "exit $?" >> "$OUT/stderr.txt"
set -e
echo "output: $OUT"
node -e 'const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); console.log(r.result);' "$OUT/result.json"
node "$FIXTURE/analyze.mjs" "$OUT"
node "$HERE/score.mjs" "$OUT" || true
