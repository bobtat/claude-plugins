---
description: Run the model redaction pass over any session digests still marked regex-only
argument-hint: [month] (e.g. 2026-08; defaults to every unreviewed digest)
allowed-tools: Bash, Read, Skill
---

## Task

Finish the second redaction stage on digests the background pass did not
reach.

Session digests are written in two stages. The hook redacts by regex
immediately and marks the digest `redaction: regex`, then spawns a detached
Haiku pass that upgrades it to `regex+model`. That pass is best-effort — the
machine sleeps, the process is killed, `claude` is not on PATH, the call times
out. This command sweeps up whatever it missed.

### Find the unreviewed digests

```bash
J="${CLAUDE_ACCOMPLISHMENTS_DIR:-$HOME/.claude/accomplishments}"
grep -l '^redaction: regex$' "$J"/digests/*/*.md 2>/dev/null | wc -l
grep -l '^redaction: regex$' "$J"/digests/*/*.md 2>/dev/null | head -20
```

`$ARGUMENTS`, if given, narrows to one month: `"$J"/digests/2026-08/*.md`.

The grep anchors on `regex$` deliberately. A digest already at `regex+model`
or `regex+model-clean` has been reviewed and must not be sent again — a second
pass costs a model call and can only remove more of a record that is already
clean.

### Report the count before running

Each digest is one Haiku call taking roughly 8 seconds. Say how many there are
and roughly how long it will take, then run them. For more than about 30,
confirm first rather than making a hundred model calls on the user's account
without asking.

### Run the pass

```bash
S="${CLAUDE_PLUGIN_ROOT}/hooks/scripts/scrub-digest.sh"
for d in $(grep -l '^redaction: regex$' "$J"/digests/*/*.md 2>/dev/null); do
  bash "$S" "$d"
done
```

The script is idempotent and self-guarding: it skips anything not marked
`regex`, and it exits immediately if `ACCOMPLISHMENTS_NO_CAPTURE` is set.

### Verify, and be honest about what failed

Re-count afterwards. Anything still marked `regex` did not get reviewed, and
the reason matters:

- `claude` not on PATH — the pass cannot run at all here
- calls timing out — raise `ACCOMPLISHMENTS_SCRUB_TIMEOUT`
- digests with no findings — these end at `regex+model-clean`, not `regex`, so
  they are not failures

**Never report a digest as reviewed unless its frontmatter says so.** The
frontmatter is the only record of what redaction a file actually received, and
a wrong claim there is worse than no claim: it is the file the user will trust
when deciding whether the journal is safe to keep.

### What this command does not do

It does not read the digests' contents into the conversation. There is no
reason to — the whole point is that their contents may be sensitive until the
pass has run. Work from the file list and the frontmatter.

It also cannot recover anything from a deleted transcript. The digest is what
survives; if a secret reached it and the model pass missed it, editing the
digest is the only remedy.
