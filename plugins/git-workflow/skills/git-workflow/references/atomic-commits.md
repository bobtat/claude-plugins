# Splitting a Working Tree into Atomic Commits

## Why the Effort Pays

Four tools stop working when commits bundle unrelated changes:

- **`git bisect`** — needs every commit to build and pass. One broken intermediate commit poisons the search.
- **`git revert`** — needs one commit to equal one idea. Otherwise reverting a bad feature also reverts an unrelated fix.
- **`git blame`** — needs the commit that introduced a line to explain that line. A grab-bag commit explains nothing.
- **Code review** — a reviewer reading five focused commits catches things they miss in one 800-line diff.

If none of those matter for a repository, atomicity matters less. They almost always matter more than the author expects at the time.

## Grouping Heuristics

Group by **intent**, not by file, not by directory, and not by when the edit was typed.

Work through the diff and ask, per hunk: *what question was I answering when I wrote this?* Hunks answering the same question are one commit.

Common natural splits:

| Signal | Split |
|---|---|
| A rename or move alongside real edits | Rename alone first (`git log --follow` survives it), edits second |
| Formatting/lint churn alongside logic | Formatting alone first, always — it makes the logic commit readable |
| A helper added and then used | Usually one commit; two only if the helper stands alone with its own tests |
| A dependency bump alongside code using the new API | Bump first, then the usage — the bump alone should still build |
| A test that fails before the fix | Same commit as the fix, so `bisect` never sees a red commit |
| An unrelated bug noticed in passing | Its own commit, always |
| Config/generated files (lockfiles, migrations) | With the change that caused them |

**Ordering matters.** Each commit must build on its predecessors. Prerequisites first, dependents after — otherwise the intermediate states are broken and `bisect` is dead again.

## Staging Precisely

### By path

The common case, when groups split along file boundaries:

```bash
git add src/auth/token.ts src/auth/token.test.ts
git diff --cached          # read it
git commit -m "fix(auth): reject tokens issued before a password change"
```

### By hunk, without `git add -p`

Interactive staging is unavailable in this environment. Use a patch file:

```bash
# 1. Write the file's diff out, with generous context so hunks apply cleanly
git diff -U5 -- src/orders/service.ts > /tmp/split.patch

# 2. Edit /tmp/split.patch with the Edit tool: delete whole @@ hunks you
#    do NOT want in this commit. Keep the file header (--- / +++) intact.

# 3. Apply what remains to the index only
git apply --cached --recount /tmp/split.patch

# 4. Verify
git diff --cached
```

Three things that go wrong here:

- **`--recount` is not optional after hand-editing.** Deleting hunks or lines invalidates the line counts in the `@@ -a,b +c,d @@` headers. `--recount` recomputes them; without it `git apply` fails with "corrupt patch".
- **Delete entire hunks, never partial hunks**, unless you also fix the header by hand. Splitting *within* a hunk means deleting a `+` line (it never existed) or converting a `-` line back to context (prefix it with a space).
- **The working tree is unchanged** by `--cached`. After committing, the rest of the file's changes remain unstaged, ready for the next commit. That is the point.

### Untracked files

A new file is all-or-nothing to `git add` and invisible to `git diff`. To stage part of one, register it as empty first:

```bash
git add -N path/to/new-file.ts    # intent-to-add: now it appears in git diff
git diff -U5 -- path/to/new-file.ts > /tmp/new.patch
# edit, then:
git apply --cached --recount /tmp/new.patch
```

### Verifying a commit in isolation

The staged set must build and pass **on its own**. Unstaged changes in the tree hide breakage:

```bash
git stash push --keep-index --include-untracked
<run the build and tests>
git stash pop
```

`--keep-index` stashes everything *except* what is staged, leaving exactly the prospective commit on disk. `--include-untracked` matters because an untracked file the staged code depends on would otherwise mask a missing-file error.

If `git stash pop` conflicts, the stash is still intact — see `recovery.md`.

## Splitting a Commit That Already Exists

### The most recent commit

```bash
git rev-parse HEAD              # record the undo point
git reset --soft HEAD~1         # commit undone, changes stay staged
git reset                       # unstage; changes now in working tree
# ... stage and commit in groups as above ...
```

`--soft` keeps everything staged; the bare `git reset` (mixed) then moves it to the working tree. Neither touches file contents — **never use `--hard` here**, which discards them.

### An older commit

Mark it `edit` in the rebase todo without an interactive editor:

```bash
git rev-parse HEAD              # record the undo point

GIT_SEQUENCE_EDITOR="sed -i -e 's/^pick \(8a3f2c1\)/edit \1/'" \
  git rebase -i <base>

# rebase stops at that commit, with it already applied
git reset HEAD^                 # undo it, keep changes in the working tree
# ... stage and commit in groups ...
git rebase --continue
```

Substitute the target commit's short SHA. On macOS/BSD `sed` requires `sed -i ''`; prefer `perl -pi -e` for portability across both:

```bash
GIT_SEQUENCE_EDITOR="perl -pi -e 's/^pick (8a3f2c1)/edit \$1/'" git rebase -i <base>
```

**This rewrites history.** Confirm the commits are unpublished, or that the user authorized rewriting them, before starting.

## Extracting One Change Out of a Commit

To pull an unrelated fix out of a commit that has already landed on a branch, without redoing the rest: split the commit as above and reorder. Do not attempt to `revert -n` a portion — a partial revert produces a diff that no longer matches either side and is far harder to reason about than the split.

## Checking Every Commit on a Branch Builds

After splitting, verify the whole sequence mechanically:

```bash
GIT_SEQUENCE_EDITOR=true git rebase --exec "npm test" <base>
```

`--exec` runs the command after every commit in the range and stops at the first failure, leaving you positioned on the offending commit. Substitute the project's real test command. `GIT_SEQUENCE_EDITOR=true` accepts the generated todo list unchanged, so nothing is reordered — the rebase exists only to run the checks.

This is the only way to know the sequence is bisectable, and it is worth doing before opening a PR whose commits claim to be atomic.

## When to Stop Splitting

Splitting has a cost, and past a point it obscures rather than clarifies:

- **Do not split a change that only makes sense whole.** A rename and the call sites it updates are one commit; three commits leaving the build broken in between are worse than one.
- **Do not split to hit a commit count.** Five contrived commits are not better than two honest ones.
- **Do not split a hotfix under time pressure.** Ship it, then clean up. Say so in the message.
- **Do not split someone else's uncommitted work** found in the tree. Ask what it is first.
