#!/usr/bin/env bash
# Test harness for archive-session.sh — run:  bash hooks/scripts/test-archive.sh
# Exits non-zero if any case behaves differently than the hook promises.
# Resolves next to this script, so it works from any checkout.
HOOK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/archive-session.sh"
pass=0; fail=0

check() { # check <description> <0 = ok>
  if [ "$2" -eq 0 ]; then pass=$((pass+1)); printf '  ok   %s\n' "$1"
  else fail=$((fail+1)); printf '  FAIL %s\n' "$1"; fi
}
yes_no() { if [ "$1" -eq 0 ] 2>/dev/null; then echo 0; else echo 1; fi; }

fire() { # fire <transcript> <session_id> <cwd>  -> echoes exit code
  printf '{"hook_event_name":"SessionEnd","session_id":"%s","transcript_path":"%s","cwd":"%s","permission_mode":"default"}' \
    "$2" "$1" "$3" | CLAUDE_ACCOMPLISHMENTS_DIR="$JOURNAL" bash "$HOOK" >/dev/null 2>&1
  echo $?
}

mk_transcript() { # mk_transcript <path> <n-lines> [start-date]
  local d="${3:-2026-08-20}" i=1
  : > "$1"
  while [ "$i" -le "$2" ]; do
    printf '{"type":"user","timestamp":"%sT09:%02d:00.000Z","cwd":"/w","gitBranch":"main","sessionId":"s","message":{"role":"user","content":"prompt number %s"}}\n' \
      "$d" "$((i % 60))" "$i" >> "$1"
    i=$((i+1))
  done
}

archives() { find "$JOURNAL/sessions" -type f -name '*.jsonl.gz' 2>/dev/null | wc -l | tr -d ' '; }
index_lines() { wc -l < "$JOURNAL/sessions/index.jsonl" 2>/dev/null | tr -d ' '; }

TMP=$(mktemp -d)
WORK="$TMP/work"; mkdir -p "$WORK"
git -C "$WORK" init -q -b main 2>/dev/null
git -C "$WORK" config user.email t@t.co; git -C "$WORK" config user.name t
echo one > "$WORK/a.txt"; git -C "$WORK" add a.txt; git -C "$WORK" commit -qm "init" 2>/dev/null

T="$TMP/transcript.jsonl"
mk_transcript "$T" 20
SID="84fdf701-fd50-4e60-9b1a-5c9a26ec0a87"

echo "== inert until the journal directory exists =="
JOURNAL="$TMP/no-such-journal"
rc=$(fire "$T" "$SID" "$WORK")
check "exits 0 with no journal directory" "$(yes_no "$rc")"
check "creates nothing at all"            "$([ ! -e "$JOURNAL" ]; yes_no $?)"

echo "== archives once the journal exists =="
JOURNAL="$TMP/journal"; mkdir -p "$JOURNAL"
rc=$(fire "$T" "$SID" "$WORK")
ARCHIVE=$(find "$JOURNAL/sessions" -type f -name '*.jsonl.gz' | head -1)
check "exits 0"                             "$(yes_no "$rc")"
check "wrote exactly one archive"           "$([ "$(archives)" -eq 1 ]; yes_no $?)"
check "bucketed by the session START date"  "$(echo "$ARCHIVE" | grep -q '/2026-08/2026-08-20-'; yes_no $?)"
check "archive round-trips to the original" "$(gzip -dc "$ARCHIVE" 2>/dev/null | diff -q - "$T" >/dev/null 2>&1; yes_no $?)"
check "archive is smaller than the source"  "$([ "$(wc -c < "$ARCHIVE")" -lt "$(wc -c < "$T")" ]; yes_no $?)"
check "left no .partial file behind"        "$([ -z "$(find "$JOURNAL" -name '*.partial.*' 2>/dev/null)" ]; yes_no $?)"
check "wrote one index line"                "$([ "$(index_lines)" -eq 1 ]; yes_no $?)"
check "index is valid JSON"                 "$(python -c 'import json,sys
for l in sys.stdin:
    if l.strip(): json.loads(l)' < "$JOURNAL/sessions/index.jsonl" >/dev/null 2>&1; yes_no $?)"
check "index records the branch"            "$(grep -q '"branch": "main"' "$JOURNAL/sessions/index.jsonl"; yes_no $?)"
check "index records the project"           "$(grep -q '"project": "work"' "$JOURNAL/sessions/index.jsonl"; yes_no $?)"
check "index records the start timestamp"   "$(grep -q '"started_at": "2026-08-20T' "$JOURNAL/sessions/index.jsonl"; yes_no $?)"

echo "== re-firing an unchanged session is a no-op (SessionEnd fires on clear/resume) =="
before=$(index_lines)
rc=$(fire "$T" "$SID" "$WORK")
check "exits 0"                   "$(yes_no "$rc")"
check "no duplicate archive file" "$([ "$(archives)" -eq 1 ]; yes_no $?)"
check "no duplicate index line"   "$([ "$(index_lines)" -eq "$before" ]; yes_no $?)"

echo "== a resumed session that grew is re-archived in place =="
mk_transcript "$T" 60
rc=$(fire "$T" "$SID" "$WORK")
ARCHIVE=$(find "$JOURNAL/sessions" -type f -name '*.jsonl.gz' | head -1)
check "still exactly one archive"      "$([ "$(archives)" -eq 1 ]; yes_no $?)"
check "archive now holds all 60 lines" "$([ "$(gzip -dc "$ARCHIVE" | wc -l | tr -d ' ')" -eq 60 ]; yes_no $?)"
check "a second index line was added"  "$([ "$(index_lines)" -eq $((before+1)) ]; yes_no $?)"

echo "== a session that starts in a different month gets its own bucket =="
T2="$TMP/older.jsonl"; mk_transcript "$T2" 5 "2026-06-11"
rc=$(fire "$T2" "11112222-3333-4444-5555-666677778888" "$WORK")
check "bucketed under 2026-06" "$([ -n "$(find "$JOURNAL/sessions/2026-06" -name '2026-06-11-*.jsonl.gz' 2>/dev/null)" ]; yes_no $?)"

echo "== refuses malformed input and fails open =="
n_before=$(archives)
rc=$(fire "$T" "../../../etc/passwd" "$WORK")
check "path-traversal session_id refused"  "$([ "$rc" -eq 0 ] && [ "$(archives)" -eq "$n_before" ]; yes_no $?)"
rc=$(fire "$T" 'a;rm -rf x' "$WORK")
check "shell-metacharacter id refused"     "$([ "$rc" -eq 0 ] && [ "$(archives)" -eq "$n_before" ]; yes_no $?)"
rc=$(fire "$TMP/does-not-exist.jsonl" "aaaa-bbbb" "$WORK")
check "missing transcript exits 0"         "$(yes_no "$rc")"
: > "$TMP/empty.jsonl"
rc=$(fire "$TMP/empty.jsonl" "cccc-dddd" "$WORK")
check "empty transcript exits 0"           "$(yes_no "$rc")"
printf 'not json at all' | CLAUDE_ACCOMPLISHMENTS_DIR="$JOURNAL" bash "$HOOK" >/dev/null 2>&1
check "garbage stdin exits 0"              "$(yes_no $?)"
printf '' | CLAUDE_ACCOMPLISHMENTS_DIR="$JOURNAL" bash "$HOOK" >/dev/null 2>&1
check "empty stdin exits 0"                "$(yes_no $?)"
rc=$(fire "$T" "eeeeffff-1111-2222-3333-444455556666" "$TMP/not-a-repo")
check "non-repo cwd still archives"        "$([ "$rc" -eq 0 ] && [ -n "$(find "$JOURNAL/sessions" -name '*eeeeffff*' 2>/dev/null)" ]; yes_no $?)"

echo "== stays silent on stdout =="
out=$(printf '{"hook_event_name":"SessionEnd","session_id":"99998888-7777-6666-5555-444433332222","transcript_path":"%s","cwd":"%s"}' "$T" "$WORK" \
      | CLAUDE_ACCOMPLISHMENTS_DIR="$JOURNAL" bash "$HOOK" 2>/dev/null)
check "stdout is empty" "$([ -z "$out" ]; yes_no $?)"

rm -rf "$TMP"
printf '\n%s passed, %s failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
