#!/usr/bin/env bash
# Backfill digests from transcripts that are still on disk.
#
#   backfill-sessions.sh [--dry-run]
#
# Claude Code deletes transcripts after `cleanupPeriodDays` (default 30). The
# SessionEnd hook only ever sees sessions that end AFTER the journal is created,
# so everything already on disk is a one-time, expiring opportunity: run this
# once at init and you rescue up to 30 days of history, or never run it and
# that history is deleted on its own schedule.
#
# /accomplishments:init documented this before it existed. It exists now.
#
# It does not reimplement the hook. It synthesizes the SessionEnd payload the
# harness would have sent and pipes it to archive-session.sh, so backfilled
# digests go through exactly the same extraction, redaction, exclusion, and
# indexing as live ones. A second implementation would be a second thing to
# keep correct, and the redaction path is the last place to want that.
#
# The Haiku pass is suppressed. Backfilling 100 sessions would otherwise spawn
# 100 detached model calls at once. Digests land at `redaction: regex`; run
# /accomplishments:scrub afterwards to finish them.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$HERE/archive-session.sh"
JOURNAL="${CLAUDE_ACCOMPLISHMENTS_DIR:-$HOME/.claude/accomplishments}"
PROJECTS="$HOME/.claude/projects"

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

if [ ! -d "$JOURNAL" ]; then
  echo "No journal at $JOURNAL — run /accomplishments:init first." >&2
  exit 1
fi
if [ ! -d "$PROJECTS" ]; then
  echo "No transcripts at $PROJECTS — nothing to backfill." >&2
  exit 0
fi
[ -f "$HOOK" ] || { echo "archive-session.sh not found beside this script." >&2; exit 1; }

PY=$(command -v python3 || command -v python) || PY=""

total=0; done_n=0; skipped=0

# Only top-level transcripts. Files one level deeper are subagent transcripts
# (<session-id>/subagents/*.jsonl); they hold no typed user prompts and are not
# what SessionEnd would ever hand us.
for transcript in "$PROJECTS"/*/*.jsonl; do
  [ -f "$transcript" ] || continue
  total=$((total + 1))

  base=$(basename "$transcript" .jsonl)
  case "$base" in
    *[!a-zA-Z0-9-]*|"") skipped=$((skipped + 1)); continue ;;
  esac

  # Already have a digest for this session? Leave it alone — re-running must be
  # safe, and the existing one may already have been scrubbed.
  if find "$JOURNAL/digests" -type f -name "*${base}.md" 2>/dev/null | grep -q .; then
    skipped=$((skipped + 1))
    continue
  fi

  # The cwd is recorded inside the transcript. It drives both the exclusion
  # check and the project name, so it has to be read rather than guessed.
  cwd=""
  if [ -n "$PY" ]; then
    cwd=$(head -c 262144 "$transcript" 2>/dev/null | "$PY" -c '
import json, sys
found = ""
for line in sys.stdin:
    if found:
        continue
    line = line.strip()
    if not line:
        continue
    try:
        v = json.loads(line).get("cwd")
    except Exception:
        continue
    if isinstance(v, str) and v:
        found = v
sys.stdout.write(found)
' 2>/dev/null) || cwd=""
  fi

  if [ "$DRY_RUN" = "1" ]; then
    printf 'would backfill  %s  (%s)\n' "$base" "${cwd:-unknown cwd}"
    done_n=$((done_n + 1))
    continue
  fi

  # The payload is built with json.dumps, never printf. On Windows `cwd` is
  # C:\Users\... and printing those backslashes raw produces invalid JSON
  # escapes (\U, \R), so the hook's parser fails and it exits silently having
  # written nothing — 115 transcripts processed, 0 digests, no error.
  A_B="$base" A_T="$transcript" A_C="$cwd" "$PY" -c '
import json, os, sys
sys.stdout.write(json.dumps({
    "hook_event_name": "SessionEnd",
    "session_id":      os.environ["A_B"],
    "transcript_path": os.environ["A_T"],
    "cwd":             os.environ.get("A_C", ""),
    "permission_mode": "default",
}))' \
    | CLAUDE_ACCOMPLISHMENTS_DIR="$JOURNAL" ACCOMPLISHMENTS_NO_SCRUB=1 bash "$HOOK" >/dev/null 2>&1
  done_n=$((done_n + 1))
done

written=$(find "$JOURNAL/digests" -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
pending=$(grep -l '^redaction: regex$' "$JOURNAL"/digests/*/*.md 2>/dev/null | wc -l | tr -d ' ')

if [ "$DRY_RUN" = "1" ]; then
  printf '\n%s transcripts found, %s would be backfilled, %s already present or skipped.\n' \
    "$total" "$done_n" "$skipped"
  exit 0
fi

printf '\n%s transcripts found, %s processed, %s already present or skipped.\n' \
  "$total" "$done_n" "$skipped"
printf '%s digests in the journal, %s still awaiting the model pass.\n' "$written" "$pending"
printf 'Run /accomplishments:scrub to finish redacting them.\n'

# Not every transcript yields a digest: sessions with no typed prompts (agent
# or SDK-driven runs) are indexed but produce no file, which is correct.
exit 0
