#!/usr/bin/env bash
# Second-stage redaction: a Haiku pass over one already-regex-redacted digest.
#
#   scrub-digest.sh <digest.md>
#
# Regex catches credentials that have a shape. It cannot catch "the staging
# password is hunter2", or an internal customer name, or a hostname that
# should not leave the machine. A model can.
#
# The model never rewrites the document. It returns ONLY the literal substrings
# it judges sensitive, one per line, and this script applies them locally by
# exact match. That inversion matters: a mangled or hallucinated response then
# changes nothing, instead of corrupting the record or inventing content. The
# worst failure is a missed secret, never a fabricated digest.
#
# Fails safe in every direction. If `claude` is missing, the call fails, the
# response is unusable, or anything else goes wrong, the regex-redacted digest
# is left exactly as it was and keeps `redaction: regex` in its frontmatter --
# so /accomplishments:scrub can find it later and try again.

set -uo pipefail

DIGEST="${1:-}"
[ -n "$DIGEST" ] && [ -f "$DIGEST" ] || exit 0

# --- Recursion guard --------------------------------------------------------
# `claude -p` starts a real session. When it ends it fires SessionEnd, which
# runs archive-session.sh, which would spawn another scrub, forever. The hook
# checks this variable and exits; it is exported into the child here and
# inherited by everything below it.
if [ -n "${ACCOMPLISHMENTS_NO_CAPTURE:-}" ]; then
  exit 0
fi
export ACCOMPLISHMENTS_NO_CAPTURE=1

command -v claude >/dev/null 2>&1 || exit 0
PY=$(command -v python3 || command -v python) || exit 0

grep -q '^redaction: regex$' "$DIGEST" 2>/dev/null || exit 0   # already reviewed

MODEL="${ACCOMPLISHMENTS_SCRUB_MODEL:-claude-haiku-4-5-20251001}"

read -r -d '' INSTRUCTIONS <<'PROMPT'
You are a redaction reviewer. The text below is a log of prompts a developer
typed to a coding assistant. It has already had obvious credential formats
stripped by a regular expression.

Find anything remaining that is a secret or should not be retained: passwords
or keys written in prose, internal hostnames, connection strings, customer or
client names, personal data, or anything else that would be damaging if this
file were read by someone else.

Output ONLY the exact substrings to remove, one per line, copied character for
character from the text. No explanation, no numbering, no quotes, no markdown.
If there is nothing to remove, output the single word NONE.

Never output a substring shorter than 6 characters. Never output a common
English word, a programming keyword, a file path, or a command name.
---
PROMPT

FINDINGS=$(printf '%s\n%s\n' "$INSTRUCTIONS" "$(cat "$DIGEST")" \
  | timeout "${ACCOMPLISHMENTS_SCRUB_TIMEOUT:-90}" \
    claude -p --model "$MODEL" 2>/dev/null) || exit 0
[ -n "$FINDINGS" ] || exit 0

printf '%s' "$FINDINGS" | "$PY" -c '
import os, sys

digest_path = sys.argv[1]
findings = sys.stdin.read().splitlines()

with open(digest_path, encoding="utf-8", errors="replace") as fh:
    original = fh.read()

body_start = original.find("\n---\n", 3)
if body_start == -1:
    sys.exit(0)
head, body = original[:body_start + 5], original[body_start + 5:]

removed = 0
for raw in findings:
    # chr() rather than literal quotes: this whole script is embedded in a
    # single-quoted shell string, so a literal apostrophe would end it.
    needle = raw.strip().strip(chr(96) + chr(34) + chr(39))
    # Guards against a model response that would gut the document: too short
    # to be a secret, absent from the text, or so frequent that removing it
    # would delete ordinary prose.
    if len(needle) < 6 or needle.upper() == "NONE":
        continue
    count = body.count(needle)
    if count == 0 or count > 8:
        continue
    body = body.replace(needle, "[REDACTED-BY-REVIEW]")
    removed += count

state = "regex+model" if removed else "regex+model-clean"
head = head.replace(
    "redaction: regex",
    f"redaction: {state}\nreviewed_removals: {removed}",
    1,
)

tmp = digest_path + ".partial"
with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
    fh.write(head + body)
os.replace(tmp, digest_path)
' "$DIGEST" 2>/dev/null

exit 0
