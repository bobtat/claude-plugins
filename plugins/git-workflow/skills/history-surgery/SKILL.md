---
name: history-surgery
description: Use when reshaping a branch's existing commits into a legible sequence before review — auditing commits against their base, deciding what may be rewritten based on what has been published, executing squashes, reorders, rewords, and splits without interactive rebase, and proving the rewrite changed no code via a tree-identity check. Invoked by /git-workflow:tidy-history.
---

# Rewriting a Branch into Something Reviewable

## The Property That Makes This Safe

A history rewrite is supposed to change **how the change is told**, not **what the change is**. That gives an exact, mechanical check:

```bash
git diff <pre-rewrite-tip> HEAD    # must be EMPTY
```

If that diff is empty, the branch's final tree is byte-identical to what it was before, and the rewrite provably lost nothing. If it is not empty, something was dropped or mangled — **reset to the pre-rewrite tip and report the failure.** Do not attempt to fix the discrepancy by editing; the rewrite is already untrustworthy.

Run this check after every rewrite. It is the reason this procedure can be trusted with destructive operations, and skipping it removes the entire safety argument.

The one legitimate exception: a rewrite that deliberately drops a commit's content (removing an accidentally committed file). Then the diff is expected to be exactly that removal and nothing else — verify it equals what was intended, rather than merely checking it is non-empty.

## Phase 0 — Establish the Base and the Publication State

```bash
BASE=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)
MERGE_BASE=$(git merge-base HEAD "$BASE")
git log --oneline "$MERGE_BASE..HEAD"        # the commits in scope
git status --porcelain                        # must be clean
git log --oneline @{upstream}..HEAD 2>/dev/null   # unpushed
git log --oneline HEAD..@{upstream} 2>/dev/null   # pushed but not local — a hard stop
```

**Hard stops, before any analysis:**

| Condition | Response |
|---|---|
| Working tree dirty | Stop. Commit or stash first — a rebase will refuse or will strand the changes |
| A rebase/merge/cherry-pick in progress | Stop. Finish or abort it |
| On `main`, `master`, `develop`, or a protected branch | Refuse. Say why; offer `git revert` instead |
| `HEAD..@{upstream}` is non-empty | Stop. The remote has commits you do not; pull first or the rewrite discards them |
| Commits in range authored by someone else | Stop and name them. Rewriting another person's commits needs their agreement, not the user's |
| No commits in range | Stop. Nothing to tidy |

**The publication gate.** Commits reachable from `@{upstream}` have been published. Rewriting them requires the user to authorize it for this branch, explicitly, in this conversation. State exactly what is published and what is not, then ask:

> 4 of the 7 commits on this branch are already on `origin/feat/pagination`. Rewriting them means a force-push. Nobody else has commits on the branch, and there's no open PR. Proceed?

If a PR exists with reviews, say so — force-pushing outdates review comments. Check with `gh pr view --json state,reviews,reviewDecision 2>/dev/null`.

## Phase 1 — Audit

Read the commits and classify each. Look for:

| Finding | Evidence |
|---|---|
| Fixup commits | Subjects like `fix typo`, `oops`, `address review`, `wip`, or literal `fixup!`/`squash!` |
| Non-conventional messages | Subject does not parse as `type(scope): subject` when the repo's log otherwise does |
| Subjects that lie or say nothing | `updates`, `changes`, `misc`, or a subject naming one thing while the diff does three |
| Bundled commits | A single commit whose diff spans unrelated concerns |
| Bodies missing where they matter | A non-obvious change with a bare subject and no *why* |
| Commits that do not build | Verify with `GIT_SEQUENCE_EDITOR=true git rebase --exec "<test cmd>" "$MERGE_BASE"` — only if the suite is fast enough to be worth it |
| Merge commits from the base | `Merge branch 'main' into …` noise that a rebase would remove |
| Secrets or junk introduced then removed | Still in history even if the tip is clean: `git log -p "$MERGE_BASE..HEAD" \| grep …` |

Also detect the **merge strategy**, because it decides whether any of this matters:

```bash
gh api "repos/{owner}/{repo}" --jq '{squash:.allow_squash_merge, rebase:.allow_rebase_merge, merge:.allow_merge_commit}' 2>/dev/null
```

If the repository squash-merges, branch commit messages never reach `main` — say so, and recommend doing less. A ten-minute history cleanup on a branch that will land as one squashed commit is wasted effort, and the honest advice is to fix the **PR title** instead.

## Phase 2 — Propose

Present a plan naming every commit and its disposition. Nothing executes before approval.

```markdown
## Current — 7 commits on feat/pagination

  a1b2c3d feat(api): add cursor pagination          keep
  e4f5g6h fix typo                                  squash into a1b2c3d
  i7j8k9l wip                                       squash into a1b2c3d
  m0n1o2p refactor: extract cursor encoding         keep, reword (no scope)
  q3r4s5t address review comments                   squash into m0n1o2p
  u6v7w8x fix(api): handle empty result set         keep
  y9z0a1b Merge branch 'main' into feat/pagination  drop (rebase removes it)

## Proposed — 3 commits

  feat(api): add cursor pagination to /orders
  refactor(api): extract cursor encoding into CursorCodec
  fix(api): handle an empty result set in cursor pagination

## How
  git rebase onto origin/main, with fixups autosquashed.

## Risk
  4 commits are published; this needs a force-push with --force-with-lease.
  No open PR. Undo point will be recorded and reported.
```

Say what is **not** being changed and why. A rewrite plan that touches every commit when three needed attention is over-reach.

## Phase 3 — Execute

1. **Record the undo point and state it to the user now**, not afterward:
   ```bash
   PRE=$(git rev-parse HEAD); echo "undo point: $PRE"
   ```
2. **Apply the plan** using the non-interactive recipes in the `git-workflow:git-workflow` skill's `references/history-rewriting.md`:
   - Squash-all-into-one → `git reset --soft "$MERGE_BASE"` then one commit. No rebase, no conflicts.
   - Targeted fixups → `git commit --fixup <sha>` is for *authoring* time; for existing commits, mark the todo with a scripted `GIT_SEQUENCE_EDITOR`.
   - Reword the tip → `git commit --amend -m`.
   - Reword an older commit → build an `amend!` commit with `-m` (never `--fixup=reword:`, which opens an editor and hangs), then `GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash "$MERGE_BASE"`. **Verify the reword landed** — a mismatched `amend!` marker fails silently, leaving the old message in place and a stray commit in the log.
   - Drop, reorder, or mark for edit → the `perl -pi -e` / `cp /tmp/todo` recipes.
   - Rebasing onto a moved base → include `--update-refs` if any branch is stacked on this one.
3. **On conflict:** resolve per `references/branching-and-conflicts.md`, or `git rebase --abort` and report. Do not resolve a conflict during a *cosmetic* rewrite by guessing — the whole operation is optional, and aborting costs nothing.

## Phase 4 — Verify

Non-negotiable, in this order:

```bash
git diff "$PRE" HEAD                       # MUST be empty (or exactly the intended removal)
git log --oneline "$MERGE_BASE..HEAD"      # the shape matches the plan
git status --porcelain                     # clean
```

Then, if the project has a test command, run the suite once at the tip — and, when the branch is short enough to make it cheap, verify every commit builds:

```bash
GIT_SEQUENCE_EDITOR=true git rebase --exec "<test cmd>" "$MERGE_BASE"
```

**If `git diff "$PRE" HEAD` is not empty and the rewrite was meant to be content-neutral:**

```bash
git reset --hard "$PRE"
```

Then report the failure and stop. Do not retry automatically.

## Phase 5 — Push, Only If Asked

`/git-workflow:tidy-history` does not push on its own. Report the state and let the user decide:

```
Rewritten: 7 commits → 3. Tree identical to before (git diff is empty).
Undo:      git reset --hard a1b2c3d
Push:      git push --force-with-lease --force-if-includes
           (required — the branch has diverged from origin)
```

If the user asks to push, use `--force-with-lease --force-if-includes`. Never bare `--force`. If an open PR has reviews, say once more that force-pushing outdates the review comments, then do as asked.

## Rules

- **The tree-identity check is not optional.** A rewrite that skips it has no safety argument.
- **Never rewrite a protected branch.** Refuse and offer `git revert`.
- **Never rewrite published commits without explicit authorization** for that branch, in this conversation.
- **Never rewrite another person's commits** on the user's say-so alone.
- **Never `git reset --hard` with a dirty tree.** Uncommitted work is unrecoverable.
- **Never bypass hooks** with `--no-verify` to make a rewrite land.
- **Report the undo point before executing, not after.**
- **Prefer doing less.** The goal is a history a reviewer can read, not a history that is maximally tidy.
