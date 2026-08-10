# Rewriting History Without Interactive Rebase

## Before Anything

```bash
git rev-parse HEAD > /tmp/undo-point    # or just note the SHA
git status --porcelain                  # must be clean; stash or commit first
git log --oneline @{upstream}..HEAD     # what is unpublished
git log --oneline HEAD..@{upstream}     # what you are missing — rewrite is unsafe if non-empty
```

Every rewrite below is undoable via `git reset --hard <undo-point>` **as long as the rewrite finished**. A rewrite abandoned mid-flight needs `git rebase --abort` first. Recovery when the undo point was not recorded: `recovery.md`.

A rewrite is only permissible under the rules in the core skill's "What May Be Rewritten" table. The mechanics below assume that gate has already been passed.

## Amending the Tip

```bash
git commit --amend -m "fix(auth): reject tokens issued before a password change"
git commit --amend --no-edit                 # add staged changes, keep the message
git commit --amend --author="Name <email>"   # fix a wrong author
```

`--amend` creates a **new commit** and abandons the old one; it does not edit in place. The old one survives in the reflog.

## Fixups and Autosquash

The intended workflow: while working on a branch, when a commit needs a correction, attach it to its target rather than adding `fix typo` to the log.

```bash
git commit --fixup <sha>            # message becomes "fixup! <target subject>"
git commit --squash <sha>           # same, but the message is kept and combined
```

**`--fixup=amend:<sha>` and `--fixup=reword:<sha>` open an editor and will hang here.** Both work by creating a commit whose message begins `amend! <target subject>`, so build that commit directly with `-m` instead:

```bash
# Reword an older commit's message, no code change, no editor:
ORIG=$(git log -1 --format=%s <sha>)
git commit --allow-empty --only \
  -m "amend! $ORIG" \
  -m "feat(api): the corrected subject" \
  -m "The body explaining why."
```

The first `-m` is the marker autosquash matches on; every later `-m` becomes the target's new message. Drop `--only --allow-empty` and stage changes first to fold code in as well (the `amend:` behavior).

**The `amend! <target subject>` line must match the target's current subject exactly** — that is how autosquash finds it. Get it from `git log -1 --format=%s`, never by retyping. A mismatched marker does not error: the commit simply stays in the log as an ordinary commit named `amend! …` and the target keeps its old message.

Then collapse them all at once:

```bash
GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash <base>
```

`GIT_SEQUENCE_EDITOR=true` runs `true` in place of an editor: it exits 0 without modifying the todo file, so the list `--autosquash` generated is accepted as-is. Nothing interactive happens.

`--autosquash` moves each `fixup!`/`squash!` commit directly after its target and marks it accordingly. Targets are matched by the SHA recorded at `--fixup` time, or by subject-line prefix, so **two commits with identical subjects will mis-target** — check the result.

Set `git config rebase.autoSquash true` in a repository to make it the default for every rebase.

## Scripted Sequence-Editor Recipes

`GIT_SEQUENCE_EDITOR` receives the path to the todo file as its argument. Any program that rewrites that file works. Use `perl -pi -e` rather than `sed -i` — it behaves identically on Linux, macOS, and Windows Git Bash.

| Goal | Command |
|---|---|
| Accept as generated | `GIT_SEQUENCE_EDITOR=true git rebase -i <base>` |
| Squash everything into the first commit | `GIT_SEQUENCE_EDITOR="perl -pi -e 's/^pick/squash/ unless \$. == 1'" git rebase -i <base>` |
| Drop one commit | `GIT_SEQUENCE_EDITOR="perl -ni -e 'print unless /^pick 8a3f2c1/'" git rebase -i <base>` |
| Stop to edit a commit | `GIT_SEQUENCE_EDITOR="perl -pi -e 's/^pick (8a3f2c1)/edit \$1/'" git rebase -i <base>` |
| Reword a commit | An `amend!` commit built with `-m` (above), then autosquash |
| Reorder | Rewrite the whole todo file with the Write tool, then point `GIT_SEQUENCE_EDITOR` at `cp /tmp/todo` |

Reordering needs the whole todo file replaced rather than pattern-edited. Build it, edit it, then hand it over:

```bash
# 1. Generate the same list rebase would have produced
git log --reverse --format="pick %h %s" <base>..HEAD > /tmp/todo

# 2. Reorder the lines in /tmp/todo with the Edit tool

# 3. Run the rebase, overwriting its todo with the prepared one
GIT_SEQUENCE_EDITOR="cp /tmp/todo" git rebase -i <base>
```

`cp /tmp/todo` is invoked as `cp /tmp/todo <todo-path>`, which overwrites the todo with the prepared version. Reordering commits that touch the same lines will conflict — resolve per `branching-and-conflicts.md`, or reorder in smaller steps.

Combine any of these with a verification pass:

```bash
GIT_SEQUENCE_EDITOR=true git rebase --exec "npm test" <base>
```

## Squashing a Whole Branch

When a branch's internal history is noise and only the net change matters, no rebase is needed:

```bash
BASE=$(git merge-base HEAD origin/main)
git rev-parse HEAD                      # undo point
git reset --soft "$BASE"
git commit -m "feat(billing): add proration to mid-cycle plan changes"
```

`--soft` moves the branch pointer back while leaving every change staged. Faster and less error-prone than squashing through a rebase, and it cannot conflict.

Consider first whether the repository squash-merges PRs anyway — if it does, this is redundant work that also destroys the review-time granularity.

## `rebase --onto`

The three-argument form, and the one most often gotten wrong:

```bash
git rebase --onto <new-base> <old-base> <branch>
```

Read as: *take the commits in `<old-base>..<branch>` and replay them onto `<new-base>`.* The `<old-base>` argument is exclusive — it says where to start taking commits *from*, and is not itself replayed.

Two cases where nothing else works:

**Dropping a range of early commits:**
```bash
git rebase --onto main~5 main~2 feature   # discard the 3 commits between
```

**Re-parenting a stacked branch after its parent was squash-merged.** `feature-b` was branched off `feature-a`; `feature-a` merged as a single squashed commit, so its original commits no longer exist in `main` and a plain rebase would replay them as duplicates:
```bash
git rebase --onto main feature-a feature-b
```

## Keeping Stacked Branches Consistent

Rewriting a branch normally orphans every branch stacked on it. Since Git 2.38:

```bash
git rebase --update-refs <base>
git config rebase.updateRefs true    # make it the default
```

Any branch pointing at a commit inside the rebased range moves with it. Without this, each stacked branch needs its own `rebase --onto` afterward.

## Reusing Conflict Resolutions

```bash
git config --global rerere.enabled true
```

`rerere` records how each conflict was resolved and replays that resolution when the same conflict reappears. It pays for itself immediately on any repeated rebase of a long-lived branch. It is a cache of *your own* prior decisions — verify the replayed resolution rather than assuming it, since the surrounding code may have moved on.

## The Force-Push Protocol

```bash
git push --force-with-lease --force-if-includes
```

Never bare `--force`.

- **`--force-with-lease`** refuses the push if the remote ref moved since your last fetch — it protects a collaborator whose commits you have not seen.
- **`--force-if-includes`** (Git ≥ 2.30) closes the hole in the lease: a `git fetch` run at any point updates the remote-tracking ref, which silently re-arms the lease even though the new commits were never integrated. This flag additionally requires that the remote's tip is actually an ancestor of what is being pushed.

Use both, always, together. `--force-with-lease` alone in an environment that fetches automatically provides much weaker protection than it appears to.

Before force-pushing a branch with an open PR: say so. Force-pushing outdates review comments and can hide them entirely in the GitHub UI, and reviewers lose their place.

## Removing a File from All History

For a leaked secret or a large binary, rewriting *every* commit is the only removal. Use [`git-filter-repo`](https://github.com/newren/git-filter-repo), not `git filter-branch` (deprecated, slow, and full of correctness traps) and not `BFG` unless already standardized on it:

```bash
git filter-repo --path secrets.env --invert-paths
```

This rewrites every commit SHA in the repository. It requires a fresh clone, a force-push of every ref, and every collaborator re-cloning. It also does **not** un-leak the credential — GitHub retains unreferenced objects, forks keep their own copies, and anything pushed has been fetchable.

**Rotate the credential first. Always.** The rewrite is cleanup, not remediation. Full procedure in `recovery.md`.

## What Not to Do

- **Never rewrite `main`/`master`/`develop` or a protected branch.** Correct forward with `git revert`.
- **Never use `--no-verify`** to get past a failing hook. Fix the cause.
- **Never rewrite commits authored by someone else** without asking them.
- **Never rebase a branch other people are actively committing to.** Merge instead.
- **Never run `git filter-repo` or `filter-branch` to fix a message or a small mistake.** The cost is a whole-repository invalidation.
