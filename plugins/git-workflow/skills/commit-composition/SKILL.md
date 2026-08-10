---
name: commit-composition
description: Use when turning a dirty working tree into a sequence of atomic commits — surveying what changed, grouping hunks by intent rather than by file, screening for secrets and contamination, verifying each prospective commit builds on its own, and creating the commits after user approval. Invoked by /git-workflow:commit; also useful directly when a session has produced several unrelated changes that should not land as one commit.
---

# Composing Commits from a Working Tree

## What This Produces

A sequence of commits where each one is a single idea, builds on its own, and carries a message explaining why it exists. Not one commit containing everything that happened to be on disk.

The default failure this exists to prevent: a session produces a feature, a bug fix noticed in passing, a formatting sweep, and a debug print, and all four land as `feat: add pagination`. The fix is unreviewable, the formatting hides the logic, the debug print ships, and reverting the feature also reverts the fix.

## Phase 0 — Survey

```bash
git status --porcelain          # includes untracked; git diff does not
git diff HEAD                   # tracked changes, staged and unstaged
git diff --cached --stat        # anything already staged
git log --oneline -10           # message conventions in use
git branch --show-current
```

Establish three facts before going further:

- **Is anything already staged?** A pre-existing index may be the user's deliberate partial staging. Do not blow it away — ask what it is.
- **Are there changes this session did not make?** Compare against what was edited. Unexplained modifications may be someone's work in progress, a stray build artifact, or a merge in flight. **Stop and ask** rather than committing them.
- **Is a merge, rebase, or cherry-pick in progress?** `git status` says so. Finish or abort it first; committing mid-operation does something other than what it appears to.

If the tree is clean, say so and stop. There is nothing to commit.

## Phase 1 — Group by Intent

Read the full diff and assign every hunk to a logical change. Group by **the question the edit was answering**, not by file or directory. The heuristics table and ordering rules are in the `git-workflow:git-workflow` skill's `references/atomic-commits.md` — apply them.

**When the diff is large — more than roughly 400 changed lines or 10 files — spawn the `git-workflow:diff-analyst` agent** rather than reading it all on the main thread. Give it the output of `git diff HEAD` and `git status --porcelain`, and it returns a proposed grouping with per-hunk assignments. Its output is a proposal to check, not a decision to execute: verify the groupings against the diff before presenting them.

For a small diff, group directly. Spawning an agent to read forty lines costs more than it saves.

Each proposed group needs, before it can be presented:

- A one-line intent ("the guest-checkout null address fix").
- The files and — where a file is split across groups — the hunks.
- A Conventional Commit subject that passes the "no *and*" test.
- Its position in the order, with prerequisites before dependents.

## Phase 2 — Screen for Contamination

Before proposing anything, check the whole diff for things that should not be committed at all:

| Look for | Action |
|---|---|
| API keys, tokens, passwords, connection strings, `BEGIN … PRIVATE KEY` | **Stop.** Report it and do not commit that hunk |
| `.env`, `*.pem`, `*.key`, credential files | Stop; propose `.gitignore` |
| Debug statements, `console.log`, `Console.WriteLine`, `print(`, breakpoints, commented-out code | Propose removing from the change entirely |
| `TODO`/`FIXME` added in this session | Flag for confirmation — sometimes deliberate |
| Build output, `dist/`, `bin/`, `obj/`, `node_modules/`, coverage reports | Propose `.gitignore`; do not commit |
| Lockfiles changed by an unrelated install | Ask whether the dependency change is intended |
| Whole-file reformatting from an editor's format-on-save | Split into its own commit, or revert if unintended |

A quick pass:

```bash
git diff HEAD | grep -nEi '(api[_-]?key|secret|passwo?rd|token|BEGIN [A-Z ]*PRIVATE KEY|xox[baprs]-|gh[pousr]_[A-Za-z0-9]{36})'
git status --porcelain | grep -Ei '\.(env|pem|key|p12|pfx)$|/(dist|build|bin|obj|node_modules|coverage)/'
```

Grep produces false positives — a variable named `password`, a test fixture. **Read each hit** rather than reporting or dismissing it mechanically.

## Phase 3 — The Gate

**More than one group → present the plan and wait for approval.** Do not create any commit first.

```markdown
## Proposed commits

**1.** `fix(orders): guard against a null shipping address on guest checkout`
   src/orders/Order.cs (hunks 1–2), src/orders/OrderTests.cs
   The null-check fix and its regression test.

**2.** `refactor(orders): extract label generation into LabelBuilder`
   src/orders/OrderService.cs (hunk 3), src/orders/LabelBuilder.cs (new)
   No behavior change. Depends on nothing in commit 1.

## Not committing
- `src/orders/OrderService.cs:88` — leftover `Console.WriteLine`. Remove it?
- `.env.local` — untracked, looks like credentials. Add to .gitignore?
```

**Exactly one group → just commit it.** A single obvious change does not need a ceremony. Report what was committed afterward.

The user may redraw the groupings. Their split wins; do not re-argue a rejected grouping.

## Phase 4 — Execute

For each group, in dependency order:

1. **Stage precisely.** By path where groups split along files; by patch file where a file is split across groups (`git diff -U5 -- <path> > patch`, edit, `git apply --cached --recount patch` — full mechanics in `references/atomic-commits.md`).
2. **Read `git diff --cached`.** Confirm it is exactly the group and nothing more. This is the last point at which a mistake is free.
3. **Verify in isolation, when the project has a fast check and more than one commit is being made:**
   ```bash
   git stash push --keep-index --include-untracked
   <build/test command>
   git stash pop
   ```
   Skip this when the suite is slow, and **say that it was skipped**. Never claim a commit was verified when it was not.
4. **Commit** with `-m` for the subject and a second `-m` for the body. No AI-attribution trailer.
5. **Confirm the tree state** before the next group: `git status --porcelain`.

If a step fails partway through — a patch will not apply, a test breaks — **stop and report.** Do not press on and leave a half-built sequence. Commits already made are fine and should be reported as made.

## Phase 5 — Report

```
Committed:
  a1b2c3d fix(orders): guard against a null shipping address on guest checkout
  e4f5g6h refactor(orders): extract label generation into LabelBuilder

Still uncommitted:
  src/orders/OrderService.cs — the Console.WriteLine, left in place per your call

Verified: each commit built and passed `dotnet test` in isolation.
Not pushed.
```

State plainly what was **not** done: what remains uncommitted, what was not verified, and that nothing was pushed. `/git-workflow:commit` never pushes.

## Rules

- **Never `git add -A` or `git commit -a`.** Stage explicitly, always.
- **Never commit a hunk that was not in the approved plan.**
- **Never push.** Committing is recoverable; pushing is publication.
- **Never remove a debug statement or fix a test as part of committing** without saying so — that is a code change hiding inside a version-control operation.
- **Never invent a body.** If the reason for a change is not known, write only the subject and say the body was left out, or ask.
- **Never claim verification that did not run.**
