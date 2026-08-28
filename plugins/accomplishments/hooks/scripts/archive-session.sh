#!/usr/bin/env bash
# SessionEnd hook for the accomplishments plugin.
#
# Claude Code deletes session transcripts after `cleanupPeriodDays` (default
# 30). A performance review covers six to twelve months. So the raw material
# for the review is gone long before the review is written, and mining git
# history afterwards does not recover it: a diff records what changed, never
# why it mattered or what it cost to find.
#
# This hook copies the transcript out of the purge window at session end.
#
# Design notes:
#   - Fails OPEN, always. Every path exits 0. A journal is a convenience; it
#     must never be able to break the end of a session.
#   - INERT until the journal directory exists. That is the opt-in gate:
#     /accomplishments:init creates it, and until then this hook does nothing
#     at all. Silent capture nobody asked for is surveillance.
#   - SessionEnd fires on `clear` and `resume`, not only on exit, so a single
#     session is archived repeatedly as it grows. Re-archiving replaces the
#     earlier, shorter copy instead of accumulating duplicates.
#   - gzip because transcripts are JSONL. Measured against 161 real
#     transcripts the ratio is 2.9x, not the 10x that plain text suggests:
#     these files are already dense, and the largest ones carry base64 and
#     tool output that barely compress at all. Budget accordingly — heavy
#     daily use archives on the order of 400 MB per year, not tens of MB.
#   - Every file path is handed to helpers on stdin rather than as an
#     argument. On Windows the `python` on PATH is often native Python, which
#     cannot open a Git Bash path like /tmp/x — piping sidesteps the whole
#     question of which path flavor the helper understands.
#   - Stdout is discarded by Claude Code on this event; it reaches neither you
#     nor Claude. Anything printed here is for `claude --debug` alone.

set -uo pipefail

ROOT_DEFAULT="${HOME}/.claude/accomplishments"
JOURNAL="${CLAUDE_ACCOMPLISHMENTS_DIR:-$ROOT_DEFAULT}"

# --- The opt-in gate --------------------------------------------------------
# No journal, no capture. Checked before anything is read or parsed.
[ -d "$JOURNAL" ] || exit 0

input=$(cat 2>/dev/null) || exit 0
[ -n "$input" ] || exit 0

PY=$(command -v python3 || command -v python) || PY=""

# --- Extract a top-level string field --------------------------------------
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
  # Last resort. Escapes are left in place; adequate for the checks below.
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

sessions="$JOURNAL/sessions"
mkdir -p "$sessions" 2>/dev/null || exit 0

# --- Which day does this session belong to? ---------------------------------
# Bucketed by the session's START timestamp, which is stable across
# re-archives. The end time is not: a session opened at 23:50 and cleared at
# 00:10 would land in two different buckets and archive itself twice.
# The reader deliberately drains its whole input instead of stopping at the
# first hit. Breaking early kills `head` with SIGPIPE, and under `pipefail`
# that marks the whole pipeline failed and discards a timestamp that was
# found correctly. The first dozen records are session metadata carrying no
# timestamp at all, so the scan has to reach roughly line 16 regardless.
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

# An earlier archive of this session may already exist, possibly under another
# month if the start timestamp was unreadable then. Reuse its path so a
# re-archive replaces rather than duplicates.
existing=$(find "$sessions" -type f -name "*${session_id}.jsonl.gz" 2>/dev/null | head -1)
if [ -n "$existing" ]; then
  target="$existing"
else
  mkdir -p "$sessions/$month" 2>/dev/null || exit 0
  target="$sessions/$month/${day}-${session_id}.jsonl.gz"
fi

# Skip when the archive already holds everything the transcript does. A
# resumed session only grows, so uncompressed size is the test.
src_bytes=$(wc -c < "$transcript" 2>/dev/null | tr -d ' ') || src_bytes=0
if [ -f "$target" ]; then
  have=$(gzip -dc "$target" 2>/dev/null | wc -c | tr -d ' ') || have=0
  [ -n "$have" ] || have=0
  if [ "${src_bytes:-0}" -le "${have:-0}" ] 2>/dev/null; then
    exit 0
  fi
fi

# --- Copy -------------------------------------------------------------------
# Written to a temp file beside the destination, then moved into place, so a
# session killed mid-write cannot leave a truncated archive behind.
tmp="${target}.partial.$$"
if command -v gzip >/dev/null 2>&1; then
  gzip -c "$transcript" > "$tmp" 2>/dev/null || { rm -f "$tmp" 2>/dev/null; exit 0; }
else
  target="${target%.gz}"
  tmp="${target}.partial.$$"
  cp "$transcript" "$tmp" 2>/dev/null || { rm -f "$tmp" 2>/dev/null; exit 0; }
fi
mv -f "$tmp" "$target" 2>/dev/null || { rm -f "$tmp" 2>/dev/null; exit 0; }

# --- Index ------------------------------------------------------------------
# One JSONL line per archive, appended and never rewritten, so an interrupted
# write cannot corrupt what came before. Readers take the LAST entry for a
# given session_id. The sweep reads this instead of opening every archive.
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
       A_ARCHIVE="${target#"$JOURNAL"/}" \
       A_BYTES="$src_bytes"

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
    "archived_at":         os.environ.get("A_ARCHIVED", ""),
    "started_at":          os.environ.get("A_STARTED", ""),
    "day":                 os.environ.get("A_DAY", ""),
    "cwd":                 os.environ.get("A_CWD", ""),
    "project":             os.environ.get("A_PROJECT", ""),
    "branch":              os.environ.get("A_BRANCH", ""),
    "head":                os.environ.get("A_HEAD", ""),
    "commits_since_start": num(os.environ.get("A_COMMITS", "0")),
    "archive":             os.environ.get("A_ARCHIVE", ""),
    "transcript_bytes":    num(os.environ.get("A_BYTES", "0")),
}) + "\n")
' >> "$sessions/index.jsonl" 2>/dev/null
elif command -v jq >/dev/null 2>&1; then
  jq -nc '{session_id: env.A_SID, archived_at: env.A_ARCHIVED, started_at: env.A_STARTED,
           day: env.A_DAY, cwd: env.A_CWD, project: env.A_PROJECT, branch: env.A_BRANCH,
           head: env.A_HEAD, commits_since_start: (env.A_COMMITS | tonumber? // 0),
           archive: env.A_ARCHIVE, transcript_bytes: (env.A_BYTES | tonumber? // 0)}' \
    >> "$sessions/index.jsonl" 2>/dev/null
fi
# With neither python nor jq the archive still lands; only the index line is
# skipped. The sweep falls back to reading filenames, which carry the date and
# the session id. Nothing is lost that cannot be recomputed.

exit 0
