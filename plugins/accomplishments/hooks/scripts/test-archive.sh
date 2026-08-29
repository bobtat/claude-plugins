#!/usr/bin/env bash
# Test harness for archive-session.sh and digest.py.
#   bash hooks/scripts/test-archive.sh
# Exits non-zero if any case behaves differently than the hook promises.
#
# The Haiku pass is disabled throughout (ACCOMPLISHMENTS_NO_SCRUB=1). These
# cases cover stage 1, which must be correct offline and on its own.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$HERE/archive-session.sh"
pass=0; fail=0

check() { # check <description> <0 = ok>
  if [ "$2" -eq 0 ]; then pass=$((pass+1)); printf '  ok   %s\n' "$1"
  else fail=$((fail+1)); printf '  FAIL %s\n' "$1"; fi
}
yes_no() { if [ "$1" -eq 0 ] 2>/dev/null; then echo 0; else echo 1; fi; }

fire() { # fire <transcript> <session_id> <cwd> -> exit code
  printf '{"hook_event_name":"SessionEnd","session_id":"%s","transcript_path":"%s","cwd":"%s","permission_mode":"default"}' \
    "$2" "$1" "$3" \
    | CLAUDE_ACCOMPLISHMENTS_DIR="$JOURNAL" ACCOMPLISHMENTS_NO_SCRUB=1 bash "$HOOK" >/dev/null 2>&1
  echo $?
}

digest_file() { find "$JOURNAL/digests" -type f -name '*.md' 2>/dev/null | head -1; }
digest_count() { find "$JOURNAL/digests" -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' '; }

TMP=$(mktemp -d)
WORK="$TMP/work"; mkdir -p "$WORK"
git -C "$WORK" init -q -b main 2>/dev/null
git -C "$WORK" config user.email t@t.co; git -C "$WORK" config user.name t
echo one > "$WORK/a.txt"; git -C "$WORK" add a.txt; git -C "$WORK" commit -qm init 2>/dev/null

# A fixture shaped like a real transcript: metadata records with no timestamp
# first, then a mix of prompts, injected context, tool traffic, assistant text,
# and a sidechain record. Secrets are planted in each segment so the test can
# prove which segments survive into the digest.
python - "$TMP/transcript.jsonl" <<'PYEOF'
import json, sys
recs = [
    {"type": "ai-title", "title": "x"},
    {"type": "mode", "mode": "default"},
    {"type": "user", "timestamp": "2026-08-20T09:00:00.000Z", "cwd": "/w",
     "gitBranch": "main", "message": {"role": "user",
     "content": "why is the nightly sync taking 40 minutes"}},
    {"type": "user", "timestamp": "2026-08-20T09:01:00.000Z",
     "message": {"role": "user", "content": [
        {"type": "text", "text": "here is the config AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMIK7MDENGbPxRfiCY"}]}},
    {"type": "user", "timestamp": "2026-08-20T09:02:00.000Z",
     "message": {"role": "user", "content": [
        {"type": "text", "text": "<system-reminder>INJECTED_TOKEN=ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA</system-reminder>"}]}},
    {"type": "assistant", "timestamp": "2026-08-20T09:03:00.000Z",
     "message": {"role": "assistant", "content": [
        {"type": "text", "text": "ASSISTANT_MARKER the key is sk-abcdefghijklmnopqrstuvwxyz123456"}]}},
    {"type": "user", "timestamp": "2026-08-20T09:04:00.000Z",
     "message": {"role": "user", "content": [
        {"type": "tool_result", "content": "TOOLRESULT_MARKER DB_PASSWORD=hunter2supersecret"}]}},
    {"type": "assistant", "timestamp": "2026-08-20T09:05:00.000Z",
     "message": {"role": "assistant", "content": [
        {"type": "tool_use", "input": {"command": "curl -H 'Authorization: Bearer TOOLUSE_MARKER_abcdef123456'"}}]}},
    {"type": "user", "timestamp": "2026-08-20T09:06:00.000Z", "isSidechain": True,
     "message": {"role": "user", "content": "SIDECHAIN_MARKER subagent prompt"}},
    {"type": "user", "timestamp": "2026-08-20T09:07:00.000Z",
     "message": {"role": "user", "content": "batch the per-row lookup, that fixed it"}},
    # --- injected content that does NOT start with "<" ----------------------
    # A compact summary: a model-written recap of the whole prior conversation,
    # wearing the user role, not sidechain, not meta, opening in prose.
    {"type": "user", "timestamp": "2026-08-20T09:08:00.000Z", "isCompactSummary": True,
     "message": {"role": "user", "content":
        "This session is being continued from a previous conversation. COMPACTMARKER "
        "Summary: read src/auth.py which contains SECRETKEY=leakedfromcompaction"}},
    {"type": "user", "timestamp": "2026-08-20T09:09:00.000Z", "isVisibleInTranscriptOnly": True,
     "message": {"role": "user", "content": "TRANSCRIPTONLY_MARKER"}},
    {"type": "user", "timestamp": "2026-08-20T09:10:00.000Z", "promptSource": "system",
     "message": {"role": "user", "content": "SYSTEMPROMPT_MARKER continue the task"}},
    {"type": "user", "timestamp": "2026-08-20T09:11:00.000Z", "origin": {"kind": "task-notification"},
     "message": {"role": "user", "content": "TASKNOTIF_MARKER agent finished"}},
    # A slash-command expansion: prose first, diff payload after.
    {"type": "user", "timestamp": "2026-08-20T09:12:00.000Z",
     "message": {"role": "user", "content":
        "Review this change for security vulnerabilities. DIFFPAYLOAD_MARKER\n"
        "--- a/src/auth.py\n+++ b/src/auth.py\n@@ -1,3 +1,4 @@\n+SECRET=leakedviadiff\n"}},
    # An injected tag that appears mid-text rather than at position zero.
    {"type": "user", "timestamp": "2026-08-20T09:13:00.000Z",
     "message": {"role": "user", "content":
        "ok do that MIDTAG_MARKER <system-reminder>hidden</system-reminder>"}},
    # origin.kind == human is the POSITIVE signal for a typed prompt.
    {"type": "user", "timestamp": "2026-08-20T09:14:00.000Z", "origin": {"kind": "human"},
     "message": {"role": "user", "content": "HUMANORIGIN_MARKER ship it"}},
    # --- credential formats the v0.2.0 pattern set missed --------------------
    # Assembled at runtime, never written as a literal: a Stripe-shaped string
    # sitting in the file trips GitHub push protection, which is the correct
    # behaviour on its part and blocks the push.
    {"type": "user", "timestamp": "2026-08-20T09:15:00.000Z",
     "message": {"role": "user", "content":
        "keys: " + "sk_" + "live_" + "51H8xQ2eZvKYlo2Cabcdefghij"
        + " glpat-" + "x" * 20
        + " npm_" + "a" * 36
        + " AKIA" + "IOSFODNN7EXAMPLE"}},
    {"type": "user", "timestamp": "2026-08-20T09:16:00.000Z",
     "message": {"role": "user", "content":
        "connect to https://admin:hunter2inurl@internal.example.com and DB_PASS=hunter2plzwork"}},
]
with open(sys.argv[1], "w", encoding="utf-8", newline="\n") as fh:
    for r in recs:
        fh.write(json.dumps(r) + "\n")
PYEOF

T="$TMP/transcript.jsonl"
SID="84fdf701-fd50-4e60-9b1a-5c9a26ec0a87"

echo "== inert until the journal directory exists =="
JOURNAL="$TMP/no-such-journal"
rc=$(fire "$T" "$SID" "$WORK")
check "exits 0 with no journal"  "$(yes_no "$rc")"
check "creates nothing"          "$([ ! -e "$JOURNAL" ]; yes_no $?)"

echo "== writes a digest, not a transcript copy =="
JOURNAL="$TMP/journal"; mkdir -p "$JOURNAL"
rc=$(fire "$T" "$SID" "$WORK")
D=$(digest_file)
check "exits 0"                        "$(yes_no "$rc")"
check "wrote exactly one digest"       "$([ "$(digest_count)" -eq 1 ]; yes_no $?)"
check "no transcript copy anywhere"    "$([ -z "$(find "$JOURNAL" \( -name '*.jsonl.gz' -o -name '*-*-*.jsonl' \) 2>/dev/null)" ]; yes_no $?)"
check "bucketed by session START date" "$(echo "$D" | grep -q '/2026-08/2026-08-20-'; yes_no $?)"
# Relative to the source, not a fixed number that only reflects the fixture.
check "digest far smaller than source"  "$([ "$(wc -c < "$D")" -lt "$(( $(wc -c < "$T") / 2 ))" ]; yes_no $?)"
check "left no .partial behind"        "$([ -z "$(find "$JOURNAL" -name '*.partial*' 2>/dev/null)" ]; yes_no $?)"

echo "== keeps the user's prompts =="
check "keeps the opening question" "$(grep -q 'nightly sync taking 40 minutes' "$D"; yes_no $?)"
check "keeps the later decision"   "$(grep -q 'batch the per-row lookup' "$D"; yes_no $?)"
check "records prompt count"       "$(grep -qE '^prompts: [0-9]+$' "$D"; yes_no $?)"
check "marks redaction state"      "$(grep -q '^redaction: regex$' "$D"; yes_no $?)"

echo "== drops every other segment =="
check "no assistant text"      "$(grep -q 'ASSISTANT_MARKER'  "$D" && echo 1 || echo 0)"
check "no tool results"        "$(grep -q 'TOOLRESULT_MARKER' "$D" && echo 1 || echo 0)"
check "no tool inputs"         "$(grep -q 'TOOLUSE_MARKER'    "$D" && echo 1 || echo 0)"
check "no sidechain prompts"   "$(grep -q 'SIDECHAIN_MARKER'  "$D" && echo 1 || echo 0)"
check "no injected context"    "$(grep -q 'system-reminder'   "$D" && echo 1 || echo 0)"

echo "== redacts secrets that survive into prompts =="
check "AWS secret value gone"      "$(grep -q 'wJalrXUtnFEMIK7MDENGbPxRfiCY' "$D" && echo 1 || echo 0)"
check "replaced with a marker"     "$(grep -q 'REDACTED' "$D"; yes_no $?)"
check "no ghp_ token anywhere"     "$(grep -q 'ghp_AAAA' "$D" && echo 1 || echo 0)"
check "no sk- key anywhere"        "$(grep -q 'sk-abcdefghij' "$D" && echo 1 || echo 0)"
check "no hunter2 password"        "$(grep -q 'hunter2' "$D" && echo 1 || echo 0)"
# Asserted against the LITERAL planted secrets, never against digest.py's own
# patterns -- a test that reuses the implementation's regexes cannot fail, and
# the previous version of this check could not have caught any of the formats
# below, all of which the v0.2.0 pattern set missed.
# Each literal is a fragment of a planted secret, chosen so no complete
# credential-shaped string appears in this file.
for lit in 51H8xQ2eZvKYlo2C glpat-xxxxxxxxxxxxxxxxxxxx \
           npm_aaaaaaaaaaaaaaaaaaaa IOSFODNN7EXAMPLE hunter2inurl hunter2plzwork; do
  check "planted secret absent: $lit" "$(grep -qF "$lit" "$D" && echo 1 || echo 0)"
done

echo "== injected content that does not start with '<' =="
check "no compact summary"            "$(grep -q 'COMPACTMARKER'      "$D" && echo 1 || echo 0)"
check "no secret from a compact summary" "$(grep -q 'leakedfromcompaction' "$D" && echo 1 || echo 0)"
check "no transcript-only record"     "$(grep -q 'TRANSCRIPTONLY_MARKER' "$D" && echo 1 || echo 0)"
check "no system-sourced prompt"      "$(grep -q 'SYSTEMPROMPT_MARKER' "$D" && echo 1 || echo 0)"
check "no task notification"          "$(grep -q 'TASKNOTIF_MARKER'   "$D" && echo 1 || echo 0)"
check "no slash-command diff payload" "$(grep -q 'DIFFPAYLOAD_MARKER' "$D" && echo 1 || echo 0)"
check "no secret carried in a diff"   "$(grep -q 'leakedviadiff'      "$D" && echo 1 || echo 0)"
check "no mid-text injected tag"      "$(grep -q 'MIDTAG_MARKER'      "$D" && echo 1 || echo 0)"
check "counts what it dropped"        "$(grep -qE '^dropped_injected: [1-9]' "$D"; yes_no $?)"

echo "== but a human-origin prompt is KEPT =="
check "origin.kind=human survives"    "$(grep -q 'HUMANORIGIN_MARKER' "$D"; yes_no $?)"

echo "== index =="
IDX="$JOURNAL/digests/index.jsonl"
check "wrote one index line"     "$([ "$(wc -l < "$IDX" | tr -d ' ')" -eq 1 ]; yes_no $?)"
check "index is valid JSON"      "$(python -c '
import json,sys
for l in sys.stdin:
    if l.strip(): json.loads(l)' < "$IDX" >/dev/null 2>&1; yes_no $?)"
check "index records the branch"  "$(grep -q '"branch": "main"' "$IDX"; yes_no $?)"
check "index records the project" "$(grep -q '"project": "work"' "$IDX"; yes_no $?)"
check "index points at the digest" "$(grep -q '"digest": "digests/2026-08' "$IDX"; yes_no $?)"
check "index carries no prompt text" "$(grep -q 'nightly sync' "$IDX" && echo 1 || echo 0)"

echo "== re-firing an unchanged session must not rewrite the digest =="
before=$(wc -l < "$IDX" | tr -d ' ')
sum_before=$(md5sum "$D" | cut -d' ' -f1)
rc=$(fire "$T" "$SID" "$WORK")
check "exits 0"                 "$(yes_no "$rc")"
check "still one digest file"   "$([ "$(digest_count)" -eq 1 ]; yes_no $?)"
check "digest byte-identical"   "$([ "$(md5sum "$D" | cut -d' ' -f1)" = "$sum_before" ]; yes_no $?)"

# Why that matters: SessionEnd fires on /clear and resume, so rewriting an
# unchanged session would replace a Haiku-scrubbed digest with a fresh
# regex-only one, putting removed secrets back on disk in plaintext.
sed -i 's/^redaction: regex$/redaction: regex+model/' "$D" 2>/dev/null
rc=$(fire "$T" "$SID" "$WORK")
check "a scrubbed digest is not clobbered" "$(grep -q '^redaction: regex+model$' "$D"; yes_no $?)"
sed -i 's/^redaction: regex+model$/redaction: regex/' "$D" 2>/dev/null

echo "== a resumed session that grew is re-digested in place =="
python - "$T" <<'PYEOF'
import json, sys
with open(sys.argv[1], "a", encoding="utf-8", newline="\n") as fh:
    fh.write(json.dumps({"type": "user", "timestamp": "2026-08-20T10:00:00.000Z",
        "message": {"role": "user", "content": "GROWTH_MARKER one more question"}}) + "\n")
PYEOF
rc=$(fire "$T" "$SID" "$WORK")
check "still exactly one digest"    "$([ "$(digest_count)" -eq 1 ]; yes_no $?)"
check "digest picked up the growth" "$(grep -q 'GROWTH_MARKER' "$(digest_file)"; yes_no $?)"

echo "== exclusion list =="
printf '# a comment\n\nwork\n' > "$JOURNAL/exclude"
rc=$(fire "$T" "aaaabbbb-1111-2222-3333-444455556666" "$WORK")
check "excluded cwd exits 0"       "$(yes_no "$rc")"
check "excluded cwd wrote nothing" "$([ -z "$(find "$JOURNAL/digests" -name '*aaaabbbb*' 2>/dev/null)" ]; yes_no $?)"
check "excluded cwd not indexed"   "$(grep -q 'aaaabbbb' "$IDX" && echo 1 || echo 0)"
OTHER="$TMP/elsewhere"; mkdir -p "$OTHER"
rc=$(fire "$T" "bbbbcccc-1111-2222-3333-444455556666" "$OTHER")
check "non-excluded cwd still captured" \
  "$([ -n "$(find "$JOURNAL/digests" -name '*bbbbcccc*' 2>/dev/null)" ]; yes_no $?)"
printf 'GitHub/acme-client\n' > "$JOURNAL/exclude"
WINCWD='C:\Users\Robert\Documents\GitHub\acme-client'
rc=$(fire "$T" "cccc1111-1111-2222-3333-444455556666" "$WINCWD")
check "forward-slash pattern matches a Windows cwd" \
  "$([ -z "$(find "$JOURNAL/digests" -name '*cccc1111*' 2>/dev/null)" ]; yes_no $?)"
printf 'ACME-Client\n' > "$JOURNAL/exclude"
rc=$(fire "$T" "dddd2222-1111-2222-3333-444455556666" "$WINCWD")
check "exclusion matching is case-insensitive" \
  "$([ -z "$(find "$JOURNAL/digests" -name '*dddd2222*' 2>/dev/null)" ]; yes_no $?)"
rm -f "$JOURNAL/exclude"

echo "== recursion guard =="
out=$(printf '{"hook_event_name":"SessionEnd","session_id":"ccccdddd-1111-2222-3333-444455556666","transcript_path":"%s","cwd":"%s"}' "$T" "$WORK" \
      | CLAUDE_ACCOMPLISHMENTS_DIR="$JOURNAL" ACCOMPLISHMENTS_NO_CAPTURE=1 bash "$HOOK" 2>&1; echo "rc=$?")
check "no-capture sentinel exits 0"      "$(echo "$out" | grep -q 'rc=0'; yes_no $?)"
check "no-capture sentinel wrote nothing" "$([ -z "$(find "$JOURNAL/digests" -name '*ccccdddd*' 2>/dev/null)" ]; yes_no $?)"

echo "== refuses malformed input and fails open =="
n=$(digest_count)
rc=$(fire "$T" "../../../etc/passwd" "$WORK")
check "path-traversal id refused" "$([ "$rc" -eq 0 ] && [ "$(digest_count)" -eq "$n" ]; yes_no $?)"
rc=$(fire "$T" 'a;rm -rf x' "$WORK")
check "metacharacter id refused"  "$([ "$rc" -eq 0 ] && [ "$(digest_count)" -eq "$n" ]; yes_no $?)"
rc=$(fire "$TMP/nope.jsonl" "dddd-eeee" "$WORK")
check "missing transcript exits 0" "$(yes_no "$rc")"
: > "$TMP/empty.jsonl"
rc=$(fire "$TMP/empty.jsonl" "eeee-ffff" "$WORK")
check "empty transcript exits 0"   "$(yes_no "$rc")"
printf 'not json' | CLAUDE_ACCOMPLISHMENTS_DIR="$JOURNAL" ACCOMPLISHMENTS_NO_SCRUB=1 bash "$HOOK" >/dev/null 2>&1
check "garbage stdin exits 0"      "$(yes_no $?)"
printf '' | CLAUDE_ACCOMPLISHMENTS_DIR="$JOURNAL" ACCOMPLISHMENTS_NO_SCRUB=1 bash "$HOOK" >/dev/null 2>&1
check "empty stdin exits 0"        "$(yes_no $?)"

echo "== a transcript with no user prompts yields no digest =="
python - "$TMP/silent.jsonl" <<'PYEOF'
import json, sys
with open(sys.argv[1], "w", encoding="utf-8", newline="\n") as fh:
    fh.write(json.dumps({"type": "assistant", "timestamp": "2026-08-21T09:00:00.000Z",
        "message": {"role": "assistant", "content": [{"type": "text", "text": "hello"}]}}) + "\n")
PYEOF
rc=$(fire "$TMP/silent.jsonl" "ffff0000-1111-2222-3333-444455556666" "$WORK")
check "exits 0"                       "$(yes_no "$rc")"
check "no digest written"             "$([ -z "$(find "$JOURNAL/digests" -name '*ffff0000*' 2>/dev/null)" ]; yes_no $?)"
check "but the session is indexed"    "$(grep -q 'ffff0000' "$IDX"; yes_no $?)"
check "indexed with an empty digest"  "$(grep -q '"digest": ""' "$IDX"; yes_no $?)"

echo "== stays silent on stdout =="
out=$(printf '{"hook_event_name":"SessionEnd","session_id":"99998888-7777-6666-5555-444433332222","transcript_path":"%s","cwd":"%s"}' "$T" "$WORK" \
      | CLAUDE_ACCOMPLISHMENTS_DIR="$JOURNAL" ACCOMPLISHMENTS_NO_SCRUB=1 bash "$HOOK" 2>/dev/null)
check "stdout is empty" "$([ -z "$out" ]; yes_no $?)"

rm -rf "$TMP"
printf '\n%s passed, %s failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
