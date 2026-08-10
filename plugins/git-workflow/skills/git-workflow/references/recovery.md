# Recovery

## What Git Can and Cannot Recover

| Lost | Recoverable? |
|---|---|
| A commit orphaned by rebase, reset, amend, or branch deletion | **Yes** — reflog, until `gc` expires it (90 days default, 30 for unreachable) |
| A commit lost by force-push, locally | **Yes** — local reflog is untouched by pushing |
| A stash dropped or cleared | **Yes, usually** — `git fsck --unreachable` |
| Staged changes never committed | **Yes** — the blobs are in the object database; `git fsck` finds them |
| Working-tree edits never staged, destroyed by `reset --hard` or `checkout` | **No** — Git never saw them |
| Untracked files removed by `git clean` | **No** — gone at the filesystem level |

The line is simple: **anything Git was told about is recoverable; anything it was not is not.** This is the entire reason `reset --hard` and `clean -fd` are gated in the core skill.

## The Reflog

Every movement of `HEAD` is logged locally, including movements that abandon commits.

```bash
git reflog                       # HEAD's movements
git reflog show <branch>         # one branch's movements
git reflog --date=iso            # with timestamps, for finding "before lunch"
```

Output reads newest-first:

```
8a3f2c1 HEAD@{0}: rebase (finish): returning to refs/heads/feat/pagination
1d4e5f6 HEAD@{1}: rebase (pick): feat(api): add cursor pagination
9c8b7a6 HEAD@{2}: reset: moving to HEAD~3          <-- the mistake
3f2e1d0 HEAD@{3}: commit: feat(api): add cursor pagination
```

`HEAD@{3}` is the state before the bad reset. Recover by pointing the branch back at it:

```bash
git reset --hard 'HEAD@{3}'      # quote it: braces are shell metacharacters
```

Inspect before committing to it:

```bash
git show 'HEAD@{3}'
git diff HEAD 'HEAD@{3}'
git log --oneline 'HEAD@{3}' -5
```

**The reflog is local and per-clone.** It is not pushed, not fetched, and a fresh clone has none. A collaborator's force-push cannot be undone from your reflog — only from theirs, or from the commits you still have locally.

## Specific Recoveries

### A rebase went wrong

Mid-rebase:
```bash
git rebase --abort
```

Already finished:
```bash
git reflog | grep -n "rebase (start)"     # the entry just before it is the pre-rebase state
git reset --hard 'HEAD@{n}'
```

`ORIG_HEAD` also holds the pre-rebase (and pre-merge, pre-reset) tip:
```bash
git reset --hard ORIG_HEAD
```
It is overwritten by the next such operation, so use it immediately or fall back to the reflog.

### `reset --hard` discarded committed work

```bash
git reset --hard 'HEAD@{1}'
```

Committed work is safe. Uncommitted working-tree edits are not, and no reflog entry brings them back.

### An amend replaced the wrong commit

```bash
git reflog                       # find the "commit (amend)" entry
git reset --hard 'HEAD@{1}'      # the entry before it is the pre-amend commit
```

To recover the *old* commit's content while keeping the new one, cherry-pick the abandoned SHA onto a scratch branch and diff it.

### A force-push destroyed commits

If you still have the commits locally, re-push them:
```bash
git reflog
git reset --hard <good-sha>
git push --force-with-lease --force-if-includes
```

If someone else force-pushed over your work and you have no local copy, ask them to recover from *their* reflog. On GitHub, the events API sometimes still carries the SHA, and an object unreferenced but not yet garbage-collected can be fetched directly:
```bash
gh api repos/{owner}/{repo}/events --jq '.[] | select(.type=="PushEvent") | .payload | {before, head}'
git fetch origin <sha>
```
Neither is guaranteed. This is why `--force-with-lease --force-if-includes` is non-negotiable.

### A deleted branch

```bash
git reflog                                  # find its tip
git switch -c <branch-name> <sha>
```

Or search all reflogs at once:
```bash
git reflog --all | grep <partial-message>
```

### A dropped or cleared stash

Stashes are commits, so a dropped stash becomes unreachable rather than deleted:

```bash
git fsck --unreachable --no-reflogs | grep commit | cut -d' ' -f3 | \
  xargs -r -n1 git log -1 --format='%H %ci %s'
```

Stash commits have subjects beginning `WIP on <branch>` or `On <branch>:`. Restore one:

```bash
git stash apply <sha>
```

### Committed work lost before it was ever committed

Staged content is written to the object database at `git add` time, so even a never-committed staging survives:

```bash
git fsck --lost-found
# dangling blobs are written to .git/lost-found/other/
git show <blob-sha>
```

Blobs carry no filename — identify them by content.

## A Secret Reached the Remote

Order matters, and the first step is not a Git operation.

1. **Rotate the credential.** Immediately, before anything else. Assume it is compromised: it has been in the remote's object store, in every fork, in CI logs, and in any clone. Rewriting history does not un-leak it, and GitHub keeps unreferenced objects reachable by SHA.
2. **Tell whoever owns the credential.** If it is not yours, this is theirs to know about now, not after cleanup.
3. **Remove it from history** — cleanup, not remediation:
   ```bash
   git filter-repo --path path/to/secret --invert-paths
   # or for a value rather than a file:
   git filter-repo --replace-text /tmp/expressions.txt
   ```
   `git-filter-repo` requires a fresh clone and refuses to run on one with uncommitted changes. Never use `git filter-branch`.
4. **Force-push every ref**, and tell every collaborator to re-clone. Their existing clones will otherwise re-introduce the old history on their next push.
5. **Ask GitHub Support to expire cached views** for a public repository, and delete forks if any exist.
6. **Prevent the recurrence.** Add the path to `.gitignore`, and enable push protection / secret scanning on the repository.

If the secret was committed but **not pushed**, this is far simpler — amend or reset it away locally, and rotation is precautionary rather than urgent.

## Preventing the Need

```bash
git config --global rerere.enabled true    # conflicts resolved once
git config --global merge.conflictstyle zdiff3
```

And two habits that make everything above rarely necessary:

- **Commit before any risky operation.** A commit is a save point; the reflog can only protect what was committed. `git stash` counts.
- **Record `git rev-parse HEAD` before any rewrite.** It turns a reflog archaeology session into a single `git reset --hard <sha>`.
