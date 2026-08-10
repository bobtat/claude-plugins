---
description: Preflight, push, and open a pull request described from the branch's commits
argument-hint: [PR title | --draft | --base <branch>] (defaults to deriving everything from the commits)
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Skill, TodoWrite
---

## Context

- Branch: !`git branch --show-current`
- Base: !`git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo "origin/HEAD not set — falling back to origin/main"`
- Upstream: !`git rev-parse --abbrev-ref --symbolic-full-name @{upstream} 2>/dev/null || echo "not pushed yet"`
- Uncommitted: !`git status --porcelain`
- Existing PR: !`gh pr view --json number,state,isDraft,url 2>/dev/null || echo "none"`
- PR template: !`ls .github/PULL_REQUEST_TEMPLATE.md .github/pull_request_template.md docs/PULL_REQUEST_TEMPLATE.md 2>/dev/null || echo "none"`

## Task

Get this branch onto GitHub as a reviewable pull request.

**Load the `git-workflow:git-workflow` skill now** and follow `references/pull-requests.md` for the PR anatomy, the `gh` command set, and the merge-strategy interaction. Skills are addressed as `git-workflow:<name>`; there is no bare-name fallback.

`$ARGUMENTS` may supply a title, `--draft`, or `--base <branch>`. Absent those, derive the title from the commits and open the PR ready for review against the repository's default branch.

Track the phases with TodoWrite.

### Phase 1 — Preflight, in this order

Each check is cheaper than the one after it, and each can stop the command.

1. **Uncommitted changes.** If the tree is dirty, stop and ask: commit them (offer `/git-workflow:commit`), stash them, or proceed without them. Never commit them silently as part of opening a PR.

2. **Secrets and junk in the outgoing commits** — not just the working tree:
   ```bash
   git diff "$BASE...HEAD" | grep -nEi '(api[_-]?key|secret|passwo?rd|token|BEGIN [A-Z ]*PRIVATE KEY|xox[baprs]-|gh[pousr]_[A-Za-z0-9]{36})'
   git log "$BASE..HEAD" --name-only --format= | sort -u
   git diff --stat "$BASE...HEAD" | tail -1
   ```
   Read every hit — grep produces false positives on variable names and fixtures. A real credential **blocks the push**: report it, and note that a secret already pushed must be rotated regardless of any history cleanup. Also flag `.env`, key files, build output, `node_modules`, and large binaries.

3. **Base currency.** `git fetch origin` and check `git log --oneline HEAD..$BASE`. If the base has moved ahead, offer to rebase (unpushed or unreviewed branch) or merge (shared branch, or review in progress) before opening. A PR opened stale runs CI against something already out of date.

4. **Tests and the linter.** Detect the project's commands from `package.json` scripts, `Makefile`, `pyproject.toml`, `*.csproj`, or `.github/workflows/`, and run them. Report failures and **ask before pushing anyway** — a known-red test is sometimes expected, and that call belongs to the user. If no test command can be found, say so rather than reporting a clean preflight.

### Phase 2 — Write the description

Derive it from `git log "$BASE..HEAD"`, **not** from the raw diff. If the repository has a PR template, fill in its sections rather than substituting a different structure.

If the commit log will not yield a description — `wip`, `fix`, `more fixes` — say so and recommend `/git-workflow:tidy-history` before continuing. That is a finding, not a reason to write a description from the diff instead.

Note `git diff "$BASE...HEAD"` uses three dots: the branch's own changes, excluding what landed on the base since branching.

Write the body to a file and pass `--body-file`. Inline `--body` mangles markdown through shell quoting, unreliably so on Windows.

Keep the standard footer on the PR body:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### Phase 3 — Push and open

```bash
git push -u origin "$(git branch --show-current)"
gh pr create --base "${BASE#origin/}" --title "..." --body-file /tmp/pr-body.md
```

If a PR already exists, **update it** (`gh pr edit --body-file`) rather than failing or creating a duplicate. If the branch is already pushed and unchanged, skip the push.

If the repository squash-merges, the **PR title becomes the commit subject on `main`** — make it a valid Conventional Commit subject.

If `gh` is unauthenticated, tell the user to run `gh auth login` themselves; it is interactive and cannot be driven from here. If `gh` is absent, push and hand them the compare URL.

### Hard rules

- **Never force-push.** If the branch has diverged from its upstream, stop and report — that is `/git-workflow:tidy-history`'s job, under its own gates.
- **Never push to `main`, `master`, or a protected branch.**
- **Never rewrite commits** as part of opening a PR.
- **Never describe the PR from the diff** when the commits can describe it.
- **Never report a preflight as passing** when a step was skipped or could not run — name what was skipped.

### Report

The PR URL, the preflight results including anything skipped, and whether it opened as draft or ready.
