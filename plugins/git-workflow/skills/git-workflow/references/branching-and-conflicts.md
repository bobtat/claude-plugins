# Branching, Staying Current, and Conflicts

## Branch Names

Match the repository's existing convention before inventing one:

```bash
git branch -a --sort=-committerdate --format='%(refname:short)' | head -20
```

The prevailing convention in most repositories is `<type>/<short-kebab-description>`, with types mirroring the commit types: `feat/cursor-pagination`, `fix/guest-null-address`, `refactor/extract-label-builder`, `chore/bump-node-22`.

Rules that matter:

- **Describe the change, not the ticket alone.** `feat/PROJ-1234` tells a reviewer nothing in a branch list. `feat/PROJ-1234-cursor-pagination` does both.
- **Lowercase, hyphens, no spaces.** `/` is a namespace separator, so `feat/x` and a branch literally named `feat` cannot coexist.
- **Short.** The name appears in every PR, log line, and CI job.
- **One branch, one deliverable.** A branch accumulating unrelated work is the same failure as a bundled commit, scaled up.

## Keeping a Branch Current

The base branch moves. Two ways to catch up, and the choice is not a matter of taste:

| Situation | Use | Why |
|---|---|---|
| Your topic branch, unpushed or pushed with no other contributors | `git rebase origin/main` | Linear history, no merge noise, the PR diff stays honest |
| Anyone else has commits on the branch, or a review is in progress | `git merge origin/main` | Rebasing rewrites SHAs out from under them and invalidates review comments |
| A long-lived shared branch | `git merge` | Rebasing a shared branch is the mistake that costs a team an afternoon |
| Repository policy forbids one | Follow the policy | Check `CONTRIBUTING.md` and whether `main` is linear (`git log --merges origin/main \| head`) |

```bash
git fetch origin
git rebase origin/main
# resolve any conflicts, then:
git push --force-with-lease --force-if-includes
```

**Rebase before opening a PR, merge after review has started.** That one rule covers most cases correctly.

Never rebase and merge the base into the same branch alternately — the result is a history with duplicated commits that is genuinely hard to untangle.

## Stacked Branches

When work must be split into reviewable pieces that depend on each other, branch each from the previous:

```bash
git switch -c feat/schema main
# ... commits ...
git switch -c feat/api feat/schema
# ... commits ...
```

Open each PR against its parent, not against `main`, so each diff shows only its own change. As the parent changes, keep the stack consistent with:

```bash
git rebase --update-refs origin/main
```

When the parent is **squash-merged**, its original commits no longer exist in `main` and a plain rebase will replay them as duplicates. Re-parent explicitly instead:

```bash
git rebase --onto main feat/schema feat/api
```

Stacking has real coordination cost. Use it when a single PR would exceed what a reviewer can hold, not by default.

## Resolving Conflicts

A conflict means two changes touched the same region and Git will not guess. Resolving it is a **code decision**, not a mechanical one.

### Procedure

1. **See the scope.**
   ```bash
   git status --short          # conflicted files are marked UU / AA / DU
   git diff --name-only --diff-filter=U
   ```

2. **Know which side is which.** During a `merge`, `--ours` is the branch you are on and `--theirs` is the branch being merged in. **During a `rebase` these are swapped** — `--ours` is the upstream being replayed onto, `--theirs` is your commit being replayed. This inversion is the single most common cause of a conflict resolved backwards. When unsure, read the file rather than trusting the labels.

3. **Get the common ancestor into view.** The default two-way markers hide *why* each side changed:
   ```bash
   git checkout --conflict=zdiff3 -- <file>
   ```
   This re-renders the conflict with a `|||||||` base section showing the original. Set it permanently with `git config --global merge.conflictstyle zdiff3`. Seeing the base usually makes the correct resolution obvious.

4. **Understand both changes before editing.**
   ```bash
   git log --merge -p -- <file>    # only the commits that touched the conflict
   git diff --ours -- <file>
   git diff --theirs -- <file>
   ```

5. **Resolve by writing the code that satisfies both intents.** The answer is frequently neither side verbatim.

6. **Remove every marker.** Then verify none survive:
   ```bash
   git diff --check
   grep -rn '^<<<<<<<\|^>>>>>>>\|^=======$' <files>
   ```

7. **Stage and continue.**
   ```bash
   git add <file>
   git rebase --continue    # or: git merge --continue
   ```

8. **Run the tests.** A conflict resolution is a code change written without review, in a hurry, at the least attentive moment of the process. It is a common source of silently reintroduced bugs.

### Never Do These

- **`git checkout --ours .` or `--theirs .` across a whole conflict.** This discards one side's work wholesale. It is occasionally right for a generated file (a lockfile — better regenerated) and essentially never right for source.
- **Resolve by deleting the markers and keeping whatever compiles.** Compiling is not the bar.
- **Silently drop a side because the intent is unclear.** Ask.
- **Push a resolution without running tests.**

### Escape Hatches

```bash
git rebase --abort        # back to before the rebase, entirely
git merge --abort
git rebase --skip         # drop the conflicting commit — only when it is genuinely obsolete
git checkout --merge -- <file>   # regenerate the markers after botching an edit
```

`--abort` is always available and always safe. Prefer it over pressing on through a rebase whose conflicts have stopped making sense — restart with smaller steps, or merge instead.

### Avoiding Repeat Conflicts

```bash
git config --global rerere.enabled true
```

Records each resolution and replays it when the same conflict recurs, which it will on any branch rebased more than once. Verify the replayed resolution rather than trusting it — the surrounding code may have moved since.

## Cleaning Up

After a branch merges, its local copy and the stale remote-tracking ref linger:

```bash
git fetch --prune
git branch --merged main | grep -v '^\*\|main\|master' | xargs -r git branch -d
```

`git branch -d` (lowercase) refuses to delete anything unmerged — that refusal is a safety feature. Reach for `-D` only after confirming the work is genuinely abandoned, and note that a deleted branch's commits remain recoverable via the reflog for the duration of `gc.reflogExpire` (90 days by default).
