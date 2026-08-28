---
description: Mine git, PRs, reviews, and session digests for a period, then log what mattered
argument-hint: [period] (e.g. "last month", "2026-01-01..2026-03-31"; defaults to since the last sweep)
allowed-tools: Agent, Bash, Read, Write, Edit, Grep, Glob, Skill, TodoWrite
---

## Context

- Repo: !`git rev-parse --show-toplevel`
- Your git identity: !`git config user.email`
- Every author identity in this repo: !`git shortlog -sne --all`

Two things are deliberately **not** in this block.

The mined evidence, because a quarter of git and PR output would flood the
conversation before any decision is made. Gather it in Phase 2, or hand it to
the `accomplishments:evidence-miner` agent when the period is large.

The journal state and `gh` status, because resolving the journal path needs
shell expansion, and a `!` block containing expansion is **refused rather than
prompted** when it matches no permission rule. Gather both with the Bash tool
in Phase 1:

```bash
J="${CLAUDE_ACCOMPLISHMENTS_DIR:-$HOME/.claude/accomplishments}"
[ -d "$J" ] || echo "no journal — run /accomplishments:init first"
ls "$J/sweeps" 2>/dev/null | tail -1                        # where the last sweep ended
find "$J/entries" -name '*.md' 2>/dev/null | wc -l          # entries so far
find "$J/digests" -name '*.md' 2>/dev/null | wc -l          # session digests
grep -l '^redaction: regex$' "$J"/digests/*/*.md 2>/dev/null | wc -l  # awaiting scrub
gh auth status >/dev/null 2>&1 && echo "gh: ok" || echo "gh: NOT authenticated"
```

If `gh` is not authenticated, say so explicitly. A sweep missing all PR and
review evidence must not be reported as a sweep that found none.

## Task

Reconstruct what a period contained, reconcile it against the journal, and
capture what was missed.

**Load the `accomplishments:evidence-sweep` skill now** and follow its seven
phases. Load `accomplishments:accomplishments` for the impact ladder, the entry
format, and the mining commands in `references/evidence.md`. This plugin's
skills and agents are addressed as `accomplishments:<name>`.

`$ARGUMENTS` sets the period. Without it, sweep from the last recorded sweep,
falling back to the last 30 days.

Track the phases with TodoWrite when the period is longer than a month.

### The deadline

Session transcripts are deleted 30 days after they are written. The archive
only covers sessions that ended after the journal was created.

**If the period predates the journal, say so before mining.** The user needs to
know they are looking at git history alone, and that the reasoning behind that
work is already gone. That fact is also the argument for sweeping monthly.

### When to spawn the miner

Longer than about six weeks, or more than three repositories: spawn
`accomplishments:evidence-miner` rather than mining inline. Its clusters are a
**proposal to verify** — check them against the underlying evidence before
presenting them. Below that threshold, mine directly; an agent round-trip
costs more than it saves on a short period.

### The gate

> **Mining produces candidates, never accomplishments. The user decides which
> ones mattered.**

Present a ranked list of eight to twelve candidates and stop. Do not write
entries before the user has said which are real. A sweep that returns forty
items, or that writes entries on its own, is a sweep that does not get run
again.

### Hard rules

- **Never present mined output as a list of achievements.**
- **Never infer impact from diff size.** The hardest change of a quarter is
  routinely one line.
- **Never reconstruct a ticket's business justification from the code.**
- **Never write an entry the user did not confirm**, and never edit the claims
  in an entry they already wrote.
- **Record what the user declined**, so the next sweep does not resurface it.

### Report

Period swept and how much had archive coverage; entries written; candidates
declined; anything that looked significant but could not be reconstructed; and
any measurement the user said they would look up.
