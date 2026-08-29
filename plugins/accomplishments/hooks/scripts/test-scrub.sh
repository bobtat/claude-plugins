#!/usr/bin/env bash
# Test harness for scrub-digest.sh — run:  bash hooks/scripts/test-scrub.sh
#
# The second redaction stage previously had no tests at all, and an adversarial
# review broke it with a three-line attack. These cases run entirely offline:
# a stub `claude` earlier on PATH returns a scripted findings response, so the
# applier's guards are exercised deterministically and no model is called.
SCRUB="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scrub-digest.sh"
pass=0; fail=0

check() { if [ "$2" -eq 0 ]; then pass=$((pass+1)); printf '  ok   %s\n' "$1"
          else fail=$((fail+1)); printf '  FAIL %s\n' "$1"; fi; }
yes_no() { if [ "$1" -eq 0 ] 2>/dev/null; then echo 0; else echo 1; fi; }

TMP=$(mktemp -d)
BIN="$TMP/bin"; mkdir -p "$BIN"
export PATH="$BIN:$PATH"

# Stub `claude`: prints whatever RESPONSE_FILE holds, ignoring its input.
cat > "$BIN/claude" <<'STUB'
#!/usr/bin/env bash
cat "$RESPONSE_FILE"
STUB
chmod +x "$BIN/claude"

mk_digest() { # mk_digest <path> <body-line>
  cat > "$1" <<EOF
---
session: abcd1234-1111-2222-3333-444455556666
started: 2026-08-20T09:00:00.000Z
project: acme-client-portal
branch: feat/acme-corp-billing
prompts: 3
truncated: 0
dropped_injected: 0
redaction: regex
source: session transcript, typed user prompts only
---

[2026-08-20T09:00] why is the nightly sync taking 40 minutes
[2026-08-20T09:01] $2
[2026-08-20T09:02] batch the per-row lookup, that fixed it
EOF
}
respond() { printf '%s\n' "$1" > "$TMP/response"; export RESPONSE_FILE="$TMP/response"; }
state() { grep -m1 '^redaction:' "$1" | cut -d' ' -f2-; }

echo "== a real finding is removed =="
mk_digest "$TMP/a.md" "the staging password is hunter2plzwork ok"
respond "hunter2plzwork"
bash "$SCRUB" "$TMP/a.md"
check "secret removed"            "$(grep -q hunter2plzwork "$TMP/a.md" && echo 1 || echo 0)"
check "marked regex+model"        "$([ "$(state "$TMP/a.md")" = "regex+model" ]; yes_no $?)"
check "records removal count"     "$(grep -q '^reviewed_removals: 1$' "$TMP/a.md"; yes_no $?)"
check "kept the other prompts"    "$(grep -q 'batch the per-row lookup' "$TMP/a.md"; yes_no $?)"
check "wrote a .bak"              "$([ -f "$TMP/a.md.bak" ]; yes_no $?)"
check "left no .partial"          "$([ -z "$(find "$TMP" -name '*.partial*')" ]; yes_no $?)"

echo "== NONE leaves content intact =="
mk_digest "$TMP/b.md" "nothing sensitive at all here"
respond "NONE"
bash "$SCRUB" "$TMP/b.md"
check "marked regex+model-clean"  "$([ "$(state "$TMP/b.md")" = "regex+model-clean" ]; yes_no $?)"
check "zero removals recorded"    "$(grep -q '^reviewed_removals: 0$' "$TMP/b.md"; yes_no $?)"
check "body preserved"            "$(grep -q 'nothing sensitive at all here' "$TMP/b.md"; yes_no $?)"

echo "== the echo attack: model returns the whole body =="
mk_digest "$TMP/c.md" "the staging password is hunter2plzwork ok"
before=$(md5sum "$TMP/c.md" | cut -d' ' -f1)
printf '%s\n' \
  "[2026-08-20T09:00] why is the nightly sync taking 40 minutes" \
  "[2026-08-20T09:01] the staging password is hunter2plzwork ok" \
  "[2026-08-20T09:02] batch the per-row lookup, that fixed it" > "$TMP/response"
export RESPONSE_FILE="$TMP/response"
bash "$SCRUB" "$TMP/c.md"
check "digest is untouched"        "$([ "$(md5sum "$TMP/c.md" | cut -d' ' -f1)" = "$before" ]; yes_no $?)"
check "still marked regex"         "$([ "$(state "$TMP/c.md")" = "regex" ]; yes_no $?)"
check "so scrub will retry it"     "$(grep -q '^redaction: regex$' "$TMP/c.md"; yes_no $?)"

echo "== too many needles aborts =="
# The needles must genuinely occur in the body, otherwise they are filtered
# out before the cap is reached and the case proves nothing.
WORDS="alpha1 bravo2 charlie delta45 echo567 foxtrot golf890 hotel12 india34 juliet5 kilo678 lima901 mike234 novemb7 oscar89 papa012"
mk_digest "$TMP/d.md" "$WORDS"
before=$(md5sum "$TMP/d.md" | cut -d' ' -f1)
respond "$(printf '%s\n' $WORDS)"
bash "$SCRUB" "$TMP/d.md"
check "aborted, file unchanged"    "$([ "$(md5sum "$TMP/d.md" | cut -d' ' -f1)" = "$before" ]; yes_no $?)"

echo "== removing too large a fraction aborts =="
mk_digest "$TMP/e.md" "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
before=$(md5sum "$TMP/e.md" | cut -d' ' -f1)
respond "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
bash "$SCRUB" "$TMP/e.md"
check "aborted, file unchanged"    "$([ "$(md5sum "$TMP/e.md" | cut -d' ' -f1)" = "$before" ]; yes_no $?)"

echo "== per-needle guards =="
mk_digest "$TMP/f.md" "the code is abc and the tag is the the the the the the the the the"
respond "$(printf 'abc\nthe\n')"
bash "$SCRUB" "$TMP/f.md"
check "short needle ignored"        "$(grep -q 'code is abc' "$TMP/f.md"; yes_no $?)"
check "over-frequent needle ignored" "$(grep -q 'the the the' "$TMP/f.md"; yes_no $?)"

echo "== frontmatter: client names scrubbed, structure protected =="
mk_digest "$TMP/g.md" "ship the billing change"
respond "$(printf 'acme-client-portal\nacme-corp\n')"
bash "$SCRUB" "$TMP/g.md"
check "project name scrubbed"      "$(grep -q '^project: acme-client-portal$' "$TMP/g.md" && echo 1 || echo 0)"
check "branch name scrubbed"       "$(grep -q 'acme-corp' "$TMP/g.md" && echo 1 || echo 0)"
check "session id preserved"       "$(grep -q '^session: abcd1234-1111-2222-3333-444455556666$' "$TMP/g.md"; yes_no $?)"
check "started preserved"          "$(grep -q '^started: 2026-08-20T09:00:00.000Z$' "$TMP/g.md"; yes_no $?)"

echo "== idempotency and opt-outs =="
cp "$TMP/a.md" "$TMP/h.md"; before=$(md5sum "$TMP/h.md" | cut -d' ' -f1)
respond "batch the per-row lookup"
bash "$SCRUB" "$TMP/h.md"
check "already-reviewed digest untouched" "$([ "$(md5sum "$TMP/h.md" | cut -d' ' -f1)" = "$before" ]; yes_no $?)"

mk_digest "$TMP/i.md" "the staging password is hunter2plzwork ok"
before=$(md5sum "$TMP/i.md" | cut -d' ' -f1)
respond "hunter2plzwork"
ACCOMPLISHMENTS_NO_CAPTURE=1 bash "$SCRUB" "$TMP/i.md"
check "NO_CAPTURE sentinel is a no-op" "$([ "$(md5sum "$TMP/i.md" | cut -d' ' -f1)" = "$before" ]; yes_no $?)"
ACCOMPLISHMENTS_NO_SCRUB=1 bash "$SCRUB" "$TMP/i.md"
check "NO_SCRUB is a no-op"            "$([ "$(md5sum "$TMP/i.md" | cut -d' ' -f1)" = "$before" ]; yes_no $?)"

echo "== no claude on PATH =="
mk_digest "$TMP/j.md" "the staging password is hunter2plzwork ok"
before=$(md5sum "$TMP/j.md" | cut -d' ' -f1)
respond "hunter2plzwork"
PATH="/usr/bin:/bin" bash "$SCRUB" "$TMP/j.md"
check "no-op, file unchanged"      "$([ "$(md5sum "$TMP/j.md" | cut -d' ' -f1)" = "$before" ]; yes_no $?)"

echo "== bad input =="
bash "$SCRUB" "$TMP/does-not-exist.md"; check "missing file exits 0" "$(yes_no $?)"
bash "$SCRUB"; check "no argument exits 0" "$(yes_no $?)"
printf 'no frontmatter here\nredaction: regex\n' > "$TMP/k.md"
before=$(md5sum "$TMP/k.md" | cut -d' ' -f1)
respond "something"
bash "$SCRUB" "$TMP/k.md"
check "malformed digest untouched"  "$([ "$(md5sum "$TMP/k.md" | cut -d' ' -f1)" = "$before" ]; yes_no $?)"

rm -rf "$TMP"
printf '\n%s passed, %s failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
