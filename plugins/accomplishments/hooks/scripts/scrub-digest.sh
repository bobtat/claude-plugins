#!/usr/bin/env bash
# Second-stage redaction: a Haiku pass over one already-regex-redacted digest.
#
#   scrub-digest.sh <digest.md>
#
# Regex catches credentials that have a shape. It cannot catch "the staging
# password is hunter2", or an internal customer name, or a hostname that should
# not leave the machine. A model can.
#
# The model never rewrites the document. It returns ONLY the literal substrings
# it judges sensitive, one per line, and this script applies them locally by
# exact match. A hallucinated response then removes nothing that was not there,
# instead of inventing content.
#
# That inversion is necessary but was not sufficient. An adversarial review
# showed the commonest small-model failure -- echoing the input back instead of
# emitting findings -- passed every per-needle guard, because each echoed line
# occurred exactly once. The whole body was replaced with [REDACTED-BY-REVIEW]
# and stamped `regex+model`, so nothing would ever revisit it. The source
# transcript is on a 30-day timer, so that was unrecoverable loss.
#
# Hence the global budgets below: a cap on distinct needles, a cap on the
# fraction of the body that may be removed, and a .bak written before any
# replacement. Exceeding a budget aborts the whole scrub and leaves the digest
# at `redaction: regex` so it can be retried, which is the safe direction.
#
# Fails safe in every direction. If `claude` is missing, the call fails, or the
# response is unusable, the regex-redacted digest is left exactly as it was.

set -uo pipefail

DIGEST="${1:-}"
[ -n "$DIGEST" ] && [ -f "$DIGEST" ] || exit 0

# --- Recursion guard --------------------------------------------------------
# `claude -p` starts a real session. When it ends it fires SessionEnd, which
# runs archive-session.sh, which would spawn another scrub, forever. The hook
# checks this variable; it is exported into the child here and inherited.
if [ -n "${ACCOMPLISHMENTS_NO_CAPTURE:-}" ]; then
  exit 0
fi
export ACCOMPLISHMENTS_NO_CAPTURE=1

# Honour the same opt-out the hook honours, so setting it disables the model
# pass "entirely" as the documentation claims -- including when this script is
# invoked directly by /accomplishments:scrub.
[ -n "${ACCOMPLISHMENTS_NO_SCRUB:-}" ] && exit 0

command -v claude >/dev/null 2>&1 || exit 0
PY=$(command -v python3 || command -v python) || exit 0

# Only digests whose frontmatter still reads exactly `redaction: regex`. The
# anchors matter: `regex+model` must not be re-reviewed.
grep -q '^redaction: regex$' "$DIGEST" 2>/dev/null || exit 0

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

Never output a substring shorter than 6 characters. Never output a whole line
or a whole prompt -- only the sensitive fragment within it. Never output a
common English word, a programming keyword, a file path, or a command name.
---
PROMPT

FINDINGS=$(printf '%s\n%s\n' "$INSTRUCTIONS" "$(cat "$DIGEST")" \
  | timeout "${ACCOMPLISHMENTS_SCRUB_TIMEOUT:-90}" \
    claude -p --model "$MODEL" 2>/dev/null) || exit 0
[ -n "$FINDINGS" ] || exit 0

printf '%s' "$FINDINGS" | "$PY" -c '
import os, shutil, sys

MAX_NEEDLES        = 15     # a real digest never has this many distinct secrets
MAX_REMOVED_FRAC   = 0.30   # abort if more than this share of the body would go
MAX_OCCURRENCES    = 8      # a needle this common is a word, not a secret
MIN_NEEDLE_LEN     = 6

digest_path = sys.argv[1]
findings = sys.stdin.read().splitlines()

with open(digest_path, encoding="utf-8", errors="replace") as fh:
    original = fh.read()

split = original.find("\n---\n", 3)
if split == -1:
    sys.exit(0)
head, body = original[:split + 5], original[split + 5:]

# Frontmatter keys whose values are structural. `project` and `branch` are
# deliberately absent: they are the two places a client name most reliably
# appears, and leaving them unscrubbable while stamping the file
# "model-reviewed" was a false assurance.
PROTECTED = ("session:", "started:", "day:", "prompts:", "truncated:",
             "dropped_injected:", "redaction:", "reviewed_removals:", "source:")

def protected_line(line):
    return any(line.startswith(k) for k in PROTECTED)

needles = []
saw_none = any(line.strip().upper() == "NONE" for line in findings)
for raw in findings:
    # chr() rather than literal quotes: this whole script is embedded in a
    # single-quoted shell string, so a literal apostrophe would end it.
    needle = raw.strip().strip(chr(96) + chr(34) + chr(39))
    if len(needle) < MIN_NEEDLE_LEN or needle.upper() == "NONE":
        continue
    if needle not in body and needle not in head:
        continue
    if body.count(needle) > MAX_OCCURRENCES:
        continue
    needles.append(needle)

# --- Global budgets --------------------------------------------------------
# Any breach aborts without touching the file. The digest keeps
# `redaction: regex`, so /accomplishments:scrub retries it later.
if not needles and not saw_none:
    # An unusable response -- not an assertion that the file is clean. Leave
    # it at `redaction: regex` so the backstop retries it.
    sys.exit(0)
if len(needles) > MAX_NEEDLES:
    sys.exit(0)
removed_bytes = sum(len(n) * body.count(n) for n in needles)
if body.strip() and removed_bytes > len(body) * MAX_REMOVED_FRAC:
    sys.exit(0)

removed = 0
for needle in needles:
    removed += body.count(needle)
    body = body.replace(needle, "[REDACTED-BY-REVIEW]")
    # Scrub unprotected frontmatter lines (project, branch) too.
    head = "\n".join(
        line if protected_line(line) else line.replace(needle, "[REDACTED-BY-REVIEW]")
        for line in head.split("\n")
    )

state = "regex+model" if removed else "regex+model-clean"
head = head.replace(
    "redaction: regex",
    "redaction: " + state + "\nreviewed_removals: " + str(removed),
    1,
)

# A copy of the pre-scrub file, so a bad pass is recoverable even though the
# source transcript may already be gone.
try:
    shutil.copy2(digest_path, digest_path + ".bak")
except Exception:
    pass

tmp = digest_path + ".partial." + str(os.getpid())
with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
    fh.write(head + body)
os.replace(tmp, digest_path)
' "$DIGEST" 2>/dev/null

exit 0
