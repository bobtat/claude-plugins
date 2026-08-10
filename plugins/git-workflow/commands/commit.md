---
description: Split the working tree into atomic conventional commits and create them after approval
argument-hint: [path or scope hint] (defaults to the whole working tree)
allowed-tools: Agent, Bash, Read, Write, Edit, Grep, Glob, Skill, TodoWrite
---

## Context

- Branch: !`git branch --show-current`
- Status: !`git status --porcelain`
- Changed lines: !`git diff HEAD --shortstat`
- Staged already: !`git diff --cached --stat`
- In-progress operation: !`git rev-parse --verify -q MERGE_HEAD >/dev/null && echo "MERGE in progress"; git rev-parse --verify -q REBASE_HEAD >/dev/null && echo "REBASE in progress"; git rev-parse --verify -q CHERRY_PICK_HEAD >/dev/null && echo "CHERRY-PICK in progress"; true`
- Recent commits (for message conventions): !`git log --oneline -10`

The full diff is deliberately **not** in this block. Read it in Phase 1 — or hand it to the `git-workflow:diff-analyst` agent when it is large — so a big working tree does not flood the conversation before any decision is made.

## Task

Turn the working tree into a sequence of **atomic** commits: one idea each, each building on its own, each with a message that says why it exists.

**Load the `git-workflow:commit-composition` skill now** and follow its five phases. Load `git-workflow:git-workflow` for the message format and the staging mechanics in its references. This plugin's skills and agents are addressed as `git-workflow:<name>`; there is no bare-name fallback.

`$ARGUMENTS`, if given, narrows the scope — a path, a directory, or a hint about what to focus on. Changes outside it stay uncommitted; **say so in the report** rather than quietly leaving them.

Track the phases with TodoWrite when the tree splits into more than two commits.

### The gate

> **More than one logical change → present the proposed split and wait. Exactly one → just commit it.**

Do not create a commit before approval when the tree holds more than one idea. Reordering commits afterward is a history rewrite; getting the split right first is free.

### When to spawn the analyst

More than ~400 changed lines or ~10 files: spawn `git-workflow:diff-analyst` with the diff rather than reading it inline. Its grouping is a **proposal to verify**, not a plan to execute — check its assignments against the actual diff before presenting them to the user. Below that threshold, read the diff directly; an agent round-trip for a small diff costs more than it saves.

### Hard rules

- **Never `git add -A`, `git add .`, or `git commit -a`.** Stage by path or by patch, always.
- **Never push.** This command commits and stops. `/git-workflow:pr` pushes.
- **Never commit a secret.** A credential-shaped hit in the diff stops the command until the user resolves it.
- **Never add an AI-attribution trailer** to a commit message.
- **Never commit changes this session did not make** without asking what they are — they may be someone else's work in progress.
- **Never claim a commit was verified** unless the build or test command was actually run against it in isolation.

### Report

End with what was committed (SHA + subject), what was deliberately left uncommitted and why, whether per-commit verification ran or was skipped, and the plain statement that nothing was pushed.
