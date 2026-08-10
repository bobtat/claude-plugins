---
name: git-workflow
description: This skill should be used whenever Claude is about to run `git commit`, `git push`, `git rebase`, `git reset`, `git cherry-pick`, or `gh pr create` — and when the user asks to "commit this", "write a commit message", "split these changes", "squash my commits", "clean up the history", "rebase onto main", "amend", "undo that commit", "open a PR", "push this branch", "fix the merge conflict", "I committed a secret", or "I lost my work". Provides the atomicity test for splitting a working tree, Conventional Commits format, the published-history safety rule, non-interactive equivalents for `rebase -i` and `add -p`, PR authoring, and reflog-based recovery.
---

# Version Control as a Deliverable

## Overview

A commit history is read far more often than it is written, and by people who cannot ask the author what happened. It has exactly two jobs:

1. **Answer "why is this line like this?"** years later, via `git log -S`, `git blame`, and `git bisect`.
2. **Let a reviewer read a change as a sequence of comprehensible steps** rather than one wall of diff.

Both jobs are destroyed by the same thing: commits that bundle unrelated changes. Everything below serves those two properties.

The work is not done when the code works. It is done when the history explains it.

## Non-Negotiables

These are gates, not advice. Each one blocks an action until its condition is met.

| Gate | Rule |
|---|---|
| **Read before staging** | Never run `git add -A`, `git add .`, or `git commit -a` without having read the full diff first. This is the single most common way a debug print, a `.env`, or an unrelated file enters history. |
| **Read before committing** | Run `git diff --cached` and read it before every `git commit`. If what is staged does not match the message about to be written, stop. |
| **Never rewrite published history** | Any commit that exists on the remote is off limits to `rebase`, `amend`, `reset`, and `commit --fixup` targeting it — unless the user explicitly authorizes it for that specific branch in the same conversation. See "What May Be Rewritten". |
| **Never force-push without `--force-with-lease`** | Bare `--force` silently discards a collaborator's work. `--force-with-lease --force-if-includes` fails instead. |
| **Never commit secrets** | Scan the staged diff for keys, tokens, connection strings, `.env` files, and private keys before committing. A secret in a pushed commit is a credential-rotation incident, not a `git revert`. |
| **One hat per commit** | A commit either changes behavior or changes structure — never both. Refactoring bundled with a fix makes the fix unreviewable and un-revertable. |

Additionally: **never run `git push`, `git reset --hard`, `git clean`, or any history rewrite that the user did not ask for.** These destroy work or publish it. Committing locally is recoverable; these are not.

## Composing a Commit

Follow this sequence. Do not skip to step 5.

1. **Survey.** `git status --porcelain` and `git diff HEAD` (plus `git diff --cached` if anything is already staged). Untracked files need `git status --porcelain` — they do not appear in `git diff HEAD`.
2. **Group into logical changes.** Apply the atomicity test below. Most working trees that took more than twenty minutes to produce contain more than one commit.
3. **Check for contamination.** Debug statements, commented-out code, `TODO(me)`, stray formatting churn from an editor, lockfiles changed by an unrelated install, generated or build artifacts. Remove them from the change or from the commit — do not narrate them in the message.
4. **Stage one group precisely.** Stage by path where the groups split cleanly along files. Where two logical changes live in one file, stage by hunk — see the non-interactive patch technique below.
5. **Verify the staged set in isolation.** `git diff --cached`. Ask: does this compile and pass tests *on its own*? A commit that only builds when the next one is applied breaks `git bisect`, which is most of the reason atomic commits are worth the trouble.
6. **Write the message** per the format below.
7. **Repeat** for each remaining group.

When the tree contains more than one logical change, **present the proposed split to the user and get approval before creating any commits.** When it is unambiguously one change, just commit it.

## The Atomicity Test

A commit is atomic when all four hold:

- **It reverts cleanly alone.** `git revert <sha>` removes one complete idea and nothing else.
- **Its subject needs no "and".** If the honest subject is "fix login and update the README", it is two commits.
- **It builds and its tests pass on its own.** Not just cumulatively with its neighbors.
- **Nothing in it is unexplained by the subject.** A reviewer reading only the subject is not surprised by anything in the diff.

Atomic is not the same as small. A rename touching two hundred files is one atomic commit. A three-line change that fixes a bug *and* tweaks an unrelated default is two.

Splitting mechanics — staging hunks without `git add -p`, splitting an existing commit, extracting a change already committed — are in `references/atomic-commits.md`.

## Message Format

Conventional Commits:

```
<type>(<optional scope>): <subject>

<optional body — why, not what>

<optional footers>
```

| Rule | Detail |
|---|---|
| Type | `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert` |
| Subject | Imperative mood ("add", not "added"/"adds"), lowercase start, no trailing period, ≤ 50 chars where possible and never over 72 |
| Body | Wrapped at 72. Explains **why** the change was needed and what was rejected — never restates the diff |
| Breaking change | `!` after the type/scope **and** a `BREAKING CHANGE:` footer explaining the migration |
| Issue links | `Refs #123` in a footer; `Fixes #123` only when the commit genuinely closes it |

Two failure modes to avoid specifically:

- **The body that paraphrases the diff.** "Changed the timeout from 30 to 60" is already visible. "The upstream API's p99 moved past 30s after their October migration" is not, and is the only reason the commit exists.
- **`chore:` as a dumping ground.** If a change does not fit a type, it is usually two changes wearing one label.

Full type semantics, scope conventions, revert and breaking-change formats: `references/commit-messages.md`.

### Attribution

**Do not add `Co-Authored-By: Claude` or any AI-attribution trailer to commit messages.** This overrides the default behavior. Commit trailers stay clean.

PR descriptions keep the "Generated with Claude Code" footer.

## What May Be Rewritten

The only question that matters: **has this commit left the machine?**

| State | Rewriting is |
|---|---|
| Local, never pushed | **Free.** Amend, squash, reorder, split at will. |
| Pushed to your own topic branch, no other contributors, no open PR reviews | **Allowed with `--force-with-lease`,** after telling the user what will be rewritten. |
| Pushed, and someone else has commits on it, or a review is in progress | **Ask first.** Rewriting invalidates review comments and forces every collaborator into recovery. |
| On `main`/`master`/`develop` or any protected branch | **Never.** Correct forward with `git revert`. |

Determine state with `git log --oneline @{upstream}..HEAD` (commits not yet pushed) and `git log --oneline HEAD..@{upstream}` (commits pushed that you do not have). No upstream means nothing is published.

Before any rewrite, record the pre-rewrite tip: `git rev-parse HEAD`. That SHA is the undo button, and `references/recovery.md` covers using it.

## This Environment Cannot Run Interactive Git

`git rebase -i`, `git add -i`, and `git add -p` open an editor and **will hang or fail** here. They are not available. Use these equivalents:

| Instead of | Use |
|---|---|
| `rebase -i` to squash fixups | `git commit --fixup <sha>` while working, then `GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash <base>` |
| `rebase -i` to reword the tip | `git commit --amend -m "<message>"` |
| `rebase -i` to reword an older commit | Build an `amend!` commit with `-m`, then autosquash — see `references/history-rewriting.md` |
| `rebase -i` to drop or reorder | A scripted `GIT_SEQUENCE_EDITOR` that rewrites the todo file — see `references/history-rewriting.md` |
| `add -p` to stage part of a file | `git diff -- <path> > patch`, edit the patch to keep only the wanted hunks, then `git apply --cached patch` |
| `git mergetool` | Read the conflicted file, resolve it with Edit, `git add` it |

Set `GIT_EDITOR=true` (or pass `-m`) on any command that would otherwise open an editor: `commit`, `merge`, `revert`, `tag`.

## Pull Requests

The PR description's audience is a reviewer who has not seen the branch. Derive it from **the commit range** (`git log <base>..HEAD`), not from the raw diff — if the commits are atomic and well-titled, the PR body nearly writes itself, and if they are not, that is the signal to clean the history first.

A PR body states: what problem this solves, the approach and what was rejected, anything a reviewer should look at closely, and how it was verified. It does not enumerate the files changed — GitHub already does that.

Before pushing: confirm the base branch has not moved ahead, scan the outgoing commits for secrets and junk, and run the project's tests and linter. Details and the `gh` command set: `references/pull-requests.md`.

## When to Stop and Ask

- The working tree contains changes the user did not ask for and did not make in this session — someone else's work in progress may be present.
- A rewrite would touch commits authored by someone else.
- Tests fail and the fix is not obviously part of the current change.
- A `.gitignore`d-looking artifact appears staged and it is unclear whether it belongs.
- The user asks to push directly to `main` in a repository that clearly uses PRs.

## Additional Resources

### Reference Files

- **`references/commit-messages.md`** — Conventional Commits in full: every type with when it applies and its common misuse, scopes, breaking changes, revert format, trailers, and worked before/after message rewrites.
- **`references/atomic-commits.md`** — Splitting a working tree: grouping heuristics, staging hunks without `add -p`, splitting a commit that already exists, extracting a change into its own commit, and per-commit test verification.
- **`references/history-rewriting.md`** — The non-interactive rebase toolkit: `--autosquash`, scripted `GIT_SEQUENCE_EDITOR` recipes for drop/reorder/reword, `rebase --onto`, squashing a branch, `rerere`, and the force-push protocol.
- **`references/branching-and-conflicts.md`** — Branch naming, keeping a branch current (rebase vs. merge and when each is correct), stacked branches, and a conflict-resolution procedure that does not silently discard a side.
- **`references/pull-requests.md`** — PR anatomy, size and its measured effect on review quality, draft PRs, the `gh` CLI command set, merge-strategy interaction with commit quality, and responding to review feedback.
- **`references/recovery.md`** — Reflog-driven recovery from a bad rebase, reset, amend, force-push, or dropped stash; recovering an unreachable commit; and the secret-in-history procedure.
- **`references/anti-patterns.md`** — Fourteen version-control anti-patterns with the fix for each, and for every one, the case where the thing that looks like it is actually correct.
- **`references/sources.md`** — Where each convention comes from, which parts are this plugin's own synthesis, and what it knowingly does not cover.

### Commands

- **`/git-workflow:commit`** — Splits the working tree into atomic commits and creates them after approval.
- **`/git-workflow:tidy-history`** — Audits the branch against its base and rewrites it into a legible sequence.
- **`/git-workflow:pr`** — Preflights, pushes, and opens a pull request described from the commit range.
