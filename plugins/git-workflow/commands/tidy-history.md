---
description: Audit this branch's commits against its base and rewrite them into a legible sequence, verified content-identical
argument-hint: [base branch] (defaults to the repository's default branch)
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Skill, TodoWrite
---

## Context

- Branch: !`git branch --show-current`
- Base: !`git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo "origin/HEAD not set — falling back to origin/main"`
- Commits vs. base: !`git log --oneline "$(git merge-base HEAD "$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)" 2>/dev/null || echo HEAD)"..HEAD 2>/dev/null || echo "could not determine range"`
- Unpushed: !`git log --oneline @{upstream}..HEAD 2>/dev/null || echo "no upstream — nothing published"`
- Behind upstream: !`git log --oneline HEAD..@{upstream} 2>/dev/null || echo "none"`
- Uncommitted: !`git status --porcelain`
- Existing PR: !`gh pr view --json number,state,reviewDecision,url 2>/dev/null || echo "none"`

## Task

Reshape this branch's commits into a sequence a reviewer can read — **without changing what the branch does**.

**Load the `git-workflow:history-surgery` skill now** and follow its five phases. Load `git-workflow:git-workflow` for the non-interactive rebase recipes in `references/history-rewriting.md`. Skills are addressed as `git-workflow:<name>`; there is no bare-name fallback.

`$ARGUMENTS`, if given, names the base branch to compare against. Track the phases with TodoWrite.

### The property this command guarantees

> **`git diff <pre-rewrite-tip> HEAD` must be empty when the rewrite finishes.**

A history rewrite changes how a change is told, not what it is. That check proves it. Run it after every rewrite; if it fails, `git reset --hard` to the pre-rewrite tip and report — do not try to patch up the difference.

The only exception is a rewrite that deliberately removes content (an accidentally committed file). Then the diff must equal exactly that removal, verified against the intent.

### Gates that stop this command

Check all of these in Phase 0, before analyzing anything:

| Condition | Response |
|---|---|
| Dirty working tree | Stop — commit or stash first |
| Merge, rebase, or cherry-pick in progress | Stop — finish or abort it |
| On `main`, `master`, `develop`, or protected | **Refuse.** Offer `git revert` instead |
| Upstream has commits you don't (`HEAD..@{upstream}` non-empty) | Stop — pull first, or the rewrite discards them |
| Commits in range authored by someone else | Stop and name them |
| Nothing in range | Stop — nothing to tidy |

**Commits already pushed may not be rewritten without the user's explicit authorization for this branch, in this conversation.** State exactly which commits are published, whether a PR exists, and whether it has reviews — force-pushing outdates review comments — then ask.

### Do less rather than more

Check the merge strategy first (`gh api "repos/{owner}/{repo}" --jq '{squash:.allow_squash_merge}'`). **If the repository squash-merges, branch commit messages never reach `main`** — say so and recommend fixing the PR title instead of rewriting seven commits that are about to be collapsed into one anyway.

A plan that touches every commit when three needed attention is over-reach. Say what is being left alone and why.

### Hard rules

- **Report the undo point (`git rev-parse HEAD`) before executing, not after.**
- **Never rewrite a protected branch.**
- **Never `git reset --hard` with a dirty tree.**
- **Never push automatically.** Report the force-push command and let the user run it, or run it only when asked — and then only with `--force-with-lease --force-if-includes`, never bare `--force`.
- **Never resolve a conflict by guessing** during a cosmetic rewrite. Abort; the whole operation is optional.
- **Never bypass hooks** with `--no-verify`.

### Report

The before/after commit shape, the tree-identity check result stated explicitly, the undo command, and — separately — the force-push command if one is needed.
