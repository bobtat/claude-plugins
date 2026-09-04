#!/usr/bin/env bash
# SessionEnd hook for the accomplishments plugin.
#
# Claude Code deletes session transcripts after `cleanupPeriodDays` (default
# 30). A performance review covers six to twelve months. So the raw material
# for the review is gone long before the review is written, and mining git
# history afterwards does not recover it: a diff records what changed, never
# why it mattered or what it cost to find.
#
# This hook rescues the part worth keeping, and only that part.
#
# It does NOT copy the transcript. Measured across 114 real transcripts, tool
# traffic -- file contents read, command output -- is 44% of content and held
# 92 of the 120 credential-shaped strings found anywhere in them. The user's
# own prompts are 7.8% of content, held 28, and carry the actual signal: the
# problem they brought and the decisions they made. Keeping only the prompts
# drops three quarters of the exposure and about 99.8% of the bytes.
#
# Redaction runs in two stages:
#   1. Here, synchronously, by regex. Fast, offline, and fail-closed -- if it
#      cannot run, metadata is written and no prompt text is.
#   2. In scrub-digest.sh, detached, by a Haiku-class model through whatever
#      provider Claude Code is pointed at (first-party, Bedrock, Vertex).
#      Catches what a pattern cannot: a password written in prose, an internal
#      hostname, a client name.
# Stage 2 is best-effort and never blocks. Anything it misses stays marked
# `redaction: regex` in the digest frontmatter, so /accomplishments:scrub can
# find it and finish the job later. The state is always explicit on disk.
#
# Design notes:
#   - Fails OPEN as a hook, always exiting 0: a journal is a convenience and
#     must never break the end of a session. But it fails CLOSED on content:
#     any doubt writes less, never more.
#   - INERT until the journal directory exists. That is the opt-in gate:
#     /accomplishments:init creates it, and until then this does nothing.
#   - SessionEnd fires on `clear` and `resume`, not only on exit, so a session
#     is digested repeatedly as it grows. Re-running replaces the earlier,
#     shorter digest rather than accumulating duplicates.
#   - Every file reaches a helper on stdin rather than as an argument. On
#     Windows the `python` on PATH is often native Python, which cannot open a
#     Git Bash path like /tmp/x.
#   - Stdout is discarded by Claude Code on this event; it reaches neither the
#     user nor Claude. Anything printed here is for `claude --debug` alone.

set -uo pipefail

# --- Recursion guard --------------------------------------------------------
# scrub-digest.sh invokes `claude -p`, which is itself a session. Its
# SessionEnd would re-enter this hook and spawn another scrub, without end.
# The variable is exported by the scrubber and inherited here.
[ -n "${ACCOMPLISHMENTS_NO_CAPTURE:-}" ] && exit 0

ROOT_DEFAULT="${HOME}/.claude/accomplishments"
JOURNAL="${CLAUDE_ACCOMPLISHMENTS_DIR:-$ROOT_DEFAULT}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- The opt-in gate --------------------------------------------------------
[ -d "$JOURNAL" ] || exit 0

input=$(cat 2>/dev/null) || exit 0
[ -n "$input" ] || exit 0

PY=$(command -v python3 || command -v python) || PY=""

extract() {
  local field="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$input" | jq -r ".${field} // empty" 2>/dev/null && return 0
  fi
  if [ -n "$PY" ]; then
    printf '%s' "$input" | "$PY" -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
v = d.get(sys.argv[1])
sys.stdout.write(v if isinstance(v, str) else "")
' "$field" 2>/dev/null && return 0
  fi
  printf '%s' "$input" | tr -d '\n' \
    | sed -n "s/.*\"${field}\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p"
}

transcript=$(extract 'transcript_path')
session_id=$(extract 'session_id')
cwd=$(extract 'cwd')

[ -n "$transcript" ] && [ -f "$transcript" ] && [ -s "$transcript" ] || exit 0
[ -n "$session_id" ] || exit 0

# Session ids build file paths. Anything outside hex-and-dash is refused
# rather than sanitized, so a malformed id cannot escape the journal.
case "$session_id" in
  *[!a-zA-Z0-9-]*|"") exit 0 ;;
esac

# --- Exclusions -------------------------------------------------------------
# One pattern per line in <journal>/exclude; blank lines and # comments
# ignored. A pattern matches if it appears anywhere in the session's cwd, so a
# bare repository name is enough. Checked before the transcript is opened:
# an excluded project is never read at all, not merely not written.
EXCLUDE="$JOURNAL/exclude"
if [ -f "$EXCLUDE" ] && [ -n "$cwd" ]; then
  # Both sides are normalized to lowercase forward slashes before matching.
  # On Windows `cwd` arrives with backslashes, so a user who wrote the natural
  # `clients/acme` got no match and no error -- the plugin's only hard privacy
  # control, failing silently.
  cwd_norm=$(printf '%s' "$cwd" | tr 'A-Z' 'a-z' | tr '\' '/')
  while IFS= read -r pattern || [ -n "$pattern" ]; do
    case "$pattern" in ''|'#'*) continue ;; esac
    pattern="${pattern#"${pattern%%[![:space:]]*}"}"
    pattern="${pattern%"${pattern##*[![:space:]]}"}"
    [ -n "$pattern" ] || continue
    pat_norm=$(printf '%s' "$pattern" | tr 'A-Z' 'a-z' | tr '\' '/')
    case "$cwd_norm" in *"$pat_norm"*) exit 0 ;; esac
  done < "$EXCLUDE"
fi

digests="$JOURNAL/digests"
mkdir -p "$digests" 2>/dev/null || exit 0

# --- Which day does this session belong to? ---------------------------------
# Bucketed by START timestamp, stable across re-digests. The end time is not:
# a session opened at 23:50 and cleared at 00:10 would land in two buckets.
#
# The reader drains its whole input rather than stopping at the first hit.
# Breaking early kills `head` with SIGPIPE, and under `pipefail` that marks
# the pipeline failed and discards a timestamp that was found correctly.
started=""
if [ -n "$PY" ]; then
  started=$(head -c 262144 "$transcript" 2>/dev/null | "$PY" -c '
import json, sys
found = ""
for line in sys.stdin:
    if found:
        continue
    line = line.strip()
    if not line:
        continue
    try:
        ts = json.loads(line).get("timestamp")
    except Exception:
        continue
    if isinstance(ts, str) and ts:
        found = ts
sys.stdout.write(found)
' 2>/dev/null) || started=""
fi
day="${started%%T*}"
case "$day" in
  [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;;
  *) day=$(date -u +%Y-%m-%d); started="" ;;
esac
month="${day%-*}"

existing=$(find "$digests" -type f -name "*${session_id}.md" 2>/dev/null | head -1)
if [ -n "$existing" ]; then
  target="$existing"
else
  mkdir -p "$digests/$month" 2>/dev/null || exit 0
  target="$digests/$month/${day}-${session_id}.md"
fi

# --- Stage 1: extract and redact -------------------------------------------
# No Python means no redaction, and no redaction means no prompt text. The
# digest is skipped entirely; the index line below still records that the
# session happened.
wrote_digest=0
prompts=0
if [ -n "$PY" ] && [ -f "$HERE/digest.py" ]; then
  tmp="${target}.partial.$$"
  if A_SID="$session_id" "$PY" "$HERE/digest.py" < "$transcript" > "$tmp" 2>/dev/null; then
    if [ -s "$tmp" ]; then
      # A resumed session only grows, so replace only when there is strictly
      # MORE to say. `-ge` here was a secret-resurrection bug: SessionEnd fires
      # on /clear and resume, so an unchanged session regenerated a fresh
      # regex-only digest over one Haiku had already scrubbed, putting removed
      # secrets back on disk in plaintext.
      new_n=$(grep -c '^\[' "$tmp" 2>/dev/null | tr -d ' ') || new_n=0
      old_n=0
      if [ -f "$target" ]; then
        old_n=$(grep -c '^\[' "$target" 2>/dev/null | tr -d ' ') || old_n=0
      fi
      if [ ! -f "$target" ] || [ "${new_n:-0}" -gt "${old_n:-0}" ] 2>/dev/null; then
        # New or genuinely longer. Added prompts have had only the regex pass,
        # so the digest correctly reads `redaction: regex` and the scrub below
        # re-reviews the whole file.
        mv -f "$tmp" "$target" 2>/dev/null && { wrote_digest=1; prompts="${new_n:-0}"; }
      fi
    fi
  fi
  rm -f "$tmp" 2>/dev/null
fi

# --- Stage 2: hand the digest to Haiku, detached ---------------------------
# Never blocks. SessionEnd runs on a ~1.5s shared budget and a model call takes
# seconds; waiting for it would delay every session exit. If the detached
# process is killed, the regex-redacted digest simply keeps `redaction: regex`
# and /accomplishments:scrub picks it up later.
if [ "$wrote_digest" = "1" ] && [ -z "${ACCOMPLISHMENTS_NO_SCRUB:-}" ] \
   && [ -f "$HERE/scrub-digest.sh" ] && command -v claude >/dev/null 2>&1; then
  ACCOMPLISHMENTS_NO_CAPTURE=1 nohup bash "$HERE/scrub-digest.sh" "$target" \
    >/dev/null 2>&1 &
fi

# --- Index ------------------------------------------------------------------
# One JSONL line per session, appended and never rewritten, so an interrupted
# write cannot corrupt what came before. Readers take the LAST entry for a
# given session_id. The sweep reads this instead of opening every digest.
branch=""; head_sha=""; commits=0; author=""
if [ -n "$cwd" ] && [ -d "$cwd" ] && command -v git >/dev/null 2>&1; then
  branch=$(git -C "$cwd" branch --show-current 2>/dev/null) || branch=""
  head_sha=$(git -C "$cwd" rev-parse --short HEAD 2>/dev/null) || head_sha=""
  author=$(git -C "$cwd" config user.email 2>/dev/null) || author=""
  if [ -n "$started" ] && [ -n "$author" ]; then
    commits=$(git -C "$cwd" log --since="$started" --author="$author" --oneline 2>/dev/null \
              | wc -l | tr -d ' ') || commits=0
  fi
fi
[ -n "$commits" ] || commits=0

rel=""
[ "$wrote_digest" = "1" ] && rel="${target#"$JOURNAL"/}"

# Values travel through the environment so neither shell quoting nor a
# hand-rolled escaper has to be correct for Windows paths full of backslashes.
export A_SID="$session_id" \
       A_ARCHIVED="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       A_STARTED="$started" \
       A_DAY="$day" \
       A_CWD="$cwd" \
       A_PROJECT="$(basename "${cwd:-unknown}")" \
       A_BRANCH="$branch" \
       A_HEAD="$head_sha" \
       A_COMMITS="$commits" \
       A_DIGEST="$rel" \
       A_PROMPTS="$prompts"

if [ -n "$PY" ]; then
  "$PY" -c '
import json, os, sys
def num(v):
    try:
        return int(v)
    except Exception:
        return 0
sys.stdout.write(json.dumps({
    "session_id":          os.environ.get("A_SID", ""),
    "recorded_at":         os.environ.get("A_ARCHIVED", ""),
    "started_at":          os.environ.get("A_STARTED", ""),
    "day":                 os.environ.get("A_DAY", ""),
    "cwd":                 os.environ.get("A_CWD", ""),
    "project":             os.environ.get("A_PROJECT", ""),
    "branch":              os.environ.get("A_BRANCH", ""),
    "head":                os.environ.get("A_HEAD", ""),
    "commits_since_start": num(os.environ.get("A_COMMITS", "0")),
    "digest":              os.environ.get("A_DIGEST", ""),
    "prompts":             num(os.environ.get("A_PROMPTS", "0")),
}) + "\n")
' >> "$digests/index.jsonl" 2>/dev/null
elif command -v jq >/dev/null 2>&1; then
  jq -nc '{session_id: env.A_SID, recorded_at: env.A_ARCHIVED, started_at: env.A_STARTED,
           day: env.A_DAY, cwd: env.A_CWD, project: env.A_PROJECT, branch: env.A_BRANCH,
           head: env.A_HEAD, commits_since_start: (env.A_COMMITS | tonumber? // 0),
           digest: env.A_DIGEST, prompts: (env.A_PROMPTS | tonumber? // 0)}' \
    >> "$digests/index.jsonl" 2>/dev/null
fi

exit 0
