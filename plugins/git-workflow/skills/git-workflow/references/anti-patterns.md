# Version-Control Anti-Patterns

Each entry: the signs, why it hurts, the fix, and — because most of these have a legitimate twin — when the thing that looks like it is actually correct.

---

## 1. The Reflexive `git add -A`

**Signs:** `git add -A`, `git add .`, or `git commit -am` run without reading the diff first.

**Why it hurts:** It is the primary mechanism by which secrets, `.env` files, debug statements, editor backups, build output, and someone else's in-progress work enter history. The author does not know what they committed, which means nobody does.

**Fix:** Read `git status --porcelain` and `git diff HEAD` first, then stage by path or hunk.

**When it's fine:** A repository with a strict `.gitignore` and a working tree you created entirely in the last few minutes, where you have just read the full diff. The reading is what makes it fine, not the size.

---

## 2. The Grab-Bag Commit

**Signs:** Subjects with "and", or "misc", "various", "updates", "cleanup", "wip".

**Why it hurts:** Kills `revert` (can't remove one idea), `bisect` (can't isolate a cause), and `blame` (the commit explains nothing about the line). The single most expensive habit in this document.

**Fix:** Split per `atomic-commits.md`.

**When it's fine:** A genuine mechanical sweep — one automated formatter run, one codemod — where "apply prettier to the repo" *is* the single idea. Say so in the message so future `blame` readers skip past it, and consider adding the SHA to `.git-blame-ignore-revs`.

---

## 3. Rewriting Published History

**Signs:** `rebase`, `amend`, or `reset` on commits that exist on the remote; `push --force`.

**Why it hurts:** Every collaborator's next pull produces a divergence they must resolve, and the naive resolution (`git pull` creating a merge) reintroduces the old commits. On a shared branch this costs a team hours.

**Fix:** `git revert` to correct forward. Rewrite only unpublished commits.

**When it's fine:** Your own topic branch with no other contributors and no in-progress review — with `--force-with-lease --force-if-includes`, and after telling the user.

---

## 4. Bare `git push --force`

**Signs:** `--force` or `-f` without `--force-with-lease`.

**Why it hurts:** It overwrites the remote unconditionally, including commits pushed by someone else that you have never seen. There is no warning and no local record of what was destroyed.

**Fix:** `--force-with-lease --force-if-includes`, always. It fails instead of destroying.

**When it's fine:** Genuinely never, on a branch anyone else can reach. On a personal scratch branch the lease costs nothing anyway.

---

## 5. Committing Generated or Vendored Files

**Signs:** `dist/`, `build/`, `node_modules/`, `bin/`, `obj/`, `.next/`, minified bundles, compiled binaries in the diff.

**Why it hurts:** Enormous diffs that swamp review, constant spurious conflicts, and permanent repository bloat — a committed binary is in the history forever unless every commit is rewritten.

**Fix:** `.gitignore` them and build in CI. If already committed: `git rm --cached`, ignore, commit.

**When it's fine:** Lockfiles (`package-lock.json`, `poetry.lock`, `Cargo.lock`) **must** be committed — they are the reproducibility record, not build output. Some ecosystems legitimately vendor dependencies (Go's `vendor/` under specific policies), and some deploy targets require a committed build artifact. All of these are deliberate, documented decisions rather than accidents.

---

## 6. Secrets in History

**Signs:** API keys, tokens, connection strings, `.pem` files, or a `.env` in the diff.

**Why it hurts:** A pushed secret is compromised permanently. GitHub keeps unreferenced objects fetchable by SHA, forks retain their own copies, and CI logs may have echoed it. History rewriting does not undo any of that.

**Fix:** Rotate first, then clean history (`recovery.md`). Prevent with `.gitignore`, committed `.env.example` templates, secret scanning, and push protection.

**When it's fine:** Never. Test fixtures needing credential-shaped strings should use obvious fakes (`sk_test_000...`) that no scanner and no human mistakes for real.

---

## 7. `--no-verify`

**Signs:** `git commit --no-verify`, `git push --no-verify`, or disabling hooks to get past a failure.

**Why it hurts:** The hook encodes a team decision. Bypassing it moves the failure to CI or to `main`, where it costs more and is someone else's problem.

**Fix:** Fix what the hook caught. If the hook is wrong, fix the hook — that is a real change worth making.

**When it's fine:** A hook that is genuinely broken (an unrelated crash, not a real failure) and blocking urgent work, with the bypass mentioned to the user and the hook fixed immediately after.

---

## 8. Committing Directly to `main`

**Signs:** Commits on `main`/`master` in a repository whose history is otherwise all merges or squashes.

**Why it hurts:** Skips review and CI gating, and on a protected branch simply fails after the work is done.

**Fix:** Branch first, then PR. When work has already been committed to `main` locally and not pushed:
```bash
git switch -c feat/thing
git switch main && git reset --hard origin/main
```

**When it's fine:** Solo repositories, documentation typos in repositories that permit it, and repositories that genuinely practice trunk-based development with direct commits. Check the existing history before assuming.

---

## 9. The 3,000-Line Pull Request

**Signs:** A PR nobody has reviewed in three days, or one approved in ninety seconds.

**Why it hurts:** Review quality falls off a cliff with size. A large PR does not receive a proportionally longer review — it receives a rubber stamp.

**Fix:** Split. Mechanical changes separately, interface before implementation, new-path-behind-a-flag, or a stack.

**When it's fine:** Generated code updates, dependency migrations, and large file moves — where the diff is large but the *decisions* are few. Say so in the description and point the reviewer at the parts that are not mechanical.

---

## 10. The Commit Body That Restates the Diff

**Signs:** "Changed X to Y. Added method Z. Removed the call to W."

**Why it hurts:** It occupies the only place the *reason* could have been recorded, and the reason is the thing that cannot be recovered from the code later.

**Fix:** Write why the change was needed, what alternatives were rejected, and what a future reader could not deduce.

**When it's fine:** Where the "what" is genuinely non-obvious from the diff — an unusual algorithm, a subtle ordering requirement. Then explain the what *and* the why.

---

## 11. Merging the Base Branch Repeatedly into a Topic Branch

**Signs:** A topic branch containing five `Merge branch 'main' into feature` commits.

**Why it hurts:** The branch's history becomes unreadable, the PR diff fills with unrelated changes, and finding the branch's actual contribution requires effort nobody spends.

**Fix:** `git rebase origin/main` on an unshared branch. Merge only when others have commits on it, and then only when actually needed — usually once, near the end.

**When it's fine:** A long-lived shared branch with several contributors, where rebasing would rewrite history out from under them. Then merging is correct, and merging *rarely* is still better than merging daily.

---

## 12. Force-Pushing During Review

**Signs:** Rebasing or amending a branch that has open review comments.

**Why it hurts:** Outdates every inline comment and can hide them entirely, so the reviewer loses their place and their record of what they already checked.

**Fix:** Push additional commits during review. Collapse them with `--autosquash` after approval, if the merge strategy makes it matter.

**When it's fine:** When the reviewer asks for it, or after approval and before merge on a rebase-merge repository. Announce it in a comment either way.

---

## 13. Emptying `.gitignore` Into the Repository

**Signs:** `.idea/`, `.vscode/`, `.DS_Store`, `Thumbs.db`, `*.swp` in the diff.

**Why it hurts:** Noise in every subsequent diff, spurious conflicts, and occasionally leaked local paths or tokens from editor config.

**Fix:** Repository `.gitignore` for what the *project* generates; `~/.config/git/ignore` (global) for what *your* tools generate. Editor directories belong in the global one — imposing them on the repository is a decision about other people's tooling.

**When it's fine:** A team that has deliberately standardized on shared editor settings and commits a curated `.vscode/settings.json` — a specific file, agreed on, not the whole directory.

---

## 14. "Fix" Commits That Fix the Previous Commit

**Signs:** `fix typo`, `fix build`, `oops`, `address review` accumulating on a branch.

**Why it hurts:** On rebase-merge or merge-commit repositories these land in `main` permanently, and the log stops describing the change and starts describing the author's afternoon.

**Fix:** `git commit --fixup <sha>` while working, then `GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash <base>` before opening the PR.

**When it's fine:** During active review — see #12; new commits are correct there. And on any repository that squash-merges, where the branch's commits are review scaffolding that never lands.
