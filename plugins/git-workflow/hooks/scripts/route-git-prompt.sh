#!/usr/bin/env bash
# UserPromptSubmit hook for the git-workflow plugin.
#
# Skill auto-invocation is a probabilistic match against a description, and it
# is weakest exactly where it matters most: a short approving continuation
# ("yes, commit and open a PR") arriving late in a session about something
# else. The turn reads as approval of existing work rather than a new task, so
# the git vocabulary carries little weight against the momentum of whatever is
# already in flight.
#
# This hook removes the guesswork. It matches the prompt text directly and
# injects a pointer to the skill, so the trigger no longer depends on phrasing
# or on where the request lands in the conversation.
#
# Design notes:
#   - Fails OPEN. Any parsing problem exits 0 with no output and the prompt
#     proceeds untouched. This hook must never be able to swallow a turn.
#   - Extracts .prompt properly rather than matching the raw JSON payload.
#     The payload carries cwd and transcript_path, and a path like
#     ...\Documents\GitHub\... would otherwise match "git" on every prompt.
#   - Injects three lines. It fires on a large fraction of prompts in a
#     git-heavy session, so it has to stay cheap enough to be redundant.

set -uo pipefail

input=$(cat 2>/dev/null) || exit 0
[ -n "$input" ] || exit 0

# --- Extract .prompt --------------------------------------------------------
# jq if present, then python, then a crude but adequate bash fallback. Mirrors
# guard-git.sh; kept self-contained so the tested guard needs no edit.
extract_prompt() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$input" | jq -r '.prompt // empty' 2>/dev/null && return 0
  fi
  local py
  py=$(command -v python3 || command -v python) || py=""
  if [ -n "$py" ]; then
    printf '%s' "$input" | "$py" -c '
import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
v = d.get("prompt") if isinstance(d, dict) else None
sys.stdout.write(v if isinstance(v, str) else "")
' 2>/dev/null && return 0
  fi
  printf '%s' "$input" \
    | tr -d '\n' \
    | sed -n 's/.*"prompt"[[:space:]]*:[[:space:]]*"\(\([^"\\]\|\\.\)*\)".*/\1/p'
}

prompt=$(extract_prompt)
[ -n "$prompt" ] || exit 0

# A slash command already routes deterministically; adding context to it is
# noise, and /git-workflow:* commands load the skill themselves.
case "$prompt" in
  /*) exit 0 ;;
esac

matches() { printf '%s' "$prompt" | grep -Eqi -e "$1"; }

# --- Signals ----------------------------------------------------------------
# Each of these is strong enough to fire alone. Deliberately excluded because
# they are ambiguous outside a git context and would fire constantly:
# "branch", "stage"/"staging", "merge", "history", "tag", "check out".
fire=0

# Committing.
matches '\b(commit|commits|committing|committed)\b'          && fire=1
# Publishing.
matches '\b(push|pushes|pushing|pushed)\b'                   && fire=1
matches '\b(pull request|pull requests)\b'                   && fire=1
matches '(^|[^A-Za-z])PRs?([^A-Za-z]|$)'                     && fire=1
matches '\bgh pr\b'                                          && fire=1
# History rewriting.
matches '\b(rebase|rebasing|rebased)\b'                      && fire=1
matches '\b(squash|squashing|squashed)\b'                    && fire=1
matches '\b(amend|amending|amended)\b'                       && fire=1
matches '\bcherry[- ]?pick'                                  && fire=1
matches '\b(fixup|autosquash)\b'                             && fire=1
matches '\b(tidy|clean( up)?|rewrite|rewriting)\b[^.]{0,20}\bhistor'  && fire=1
# Trouble.
matches '\bmerge conflict'                                   && fire=1
matches '\breflog\b'                                         && fire=1
matches '\b(lost|losing)\b[^.]{0,20}\b(work|commit|changes)\b'       && fire=1
# Explicit git mention. The trailing class excludes "git-workflow", "gitignore",
# and "GitHub", so a file path is not a version-control request.
matches '(^|[^A-Za-z0-9_-])git([^A-Za-z0-9_-]|$)'            && fire=1

[ "$fire" -eq 1 ] || exit 0

# --- Inject -----------------------------------------------------------------
read -r -d '' context <<'EOF' || true
This request involves version control. Load the `git-workflow:git-workflow` skill before staging, committing, pushing, rewriting history, or opening a PR — it carries the commit-message format, the atomicity test, the published-history rule, and the non-interactive substitutes for the git commands that hang here.
Prefer the commands where they fit: `/git-workflow:commit` for a working tree holding more than one change, `/git-workflow:tidy-history` to reshape a branch, `/git-workflow:pr` to preflight and open a pull request.
Commit messages in this environment carry no AI-attribution trailer.
EOF

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'BEGIN{ORS=""} {print sep $0; sep="\\n"}'
}

printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' \
  "$(json_escape "$context")"

exit 0
