# git-workflow

A Claude Code plugin that treats version control as part of the deliverable, not as the thing you do after the work is done.

## What It Does

The premise: a commit history is read far more often than it is written, by people who cannot ask the author what happened. It has two jobs — **answer "why is this line like this?"** years later via `log -S`, `blame`, and `bisect`, and **let a reviewer read a change as a sequence of comprehensible steps.** Both are destroyed by the same thing: commits that bundle unrelated changes.

Adds an auto-triggering knowledge skill, three commands, one agent, and a hook that blocks the mistakes you cannot undo:

- **Commit composition** — the four-part atomicity test, grouping a working tree by intent rather than by file, precise staging, and per-commit isolation checks so every commit builds on its own
- **Conventional Commits in full** — every type with its common misuse, the `chore` trap, scope conventions derived from the repo rather than invented, the imperative test for subjects, and what a body should contain that the diff does not
- **History rewriting without interactive rebase** — the whole non-interactive toolkit, because `rebase -i` cannot run in this environment at all
- **Branching, staying current, and conflicts** — rebase vs. merge as a decision rather than a preference, stacked branches, and a conflict procedure that never silently drops a side
- **Pull requests** — descriptions derived from the commit range instead of the diff, the size threshold where review effectiveness collapses, and how merge strategy changes where effort should go
- **Recovery** — exactly what the reflog can and cannot bring back, and the ordered procedure when a secret reaches the remote
- **Fourteen anti-patterns** with the fix for each and, for every one, the case where the thing that looks like it is actually correct
- **`/commit`** — splits the working tree into atomic commits and creates them after approval
- **`/tidy-history`** — audits a branch against its base and rewrites it, verified content-identical
- **`/pr`** — preflights, pushes, and opens a PR described from the commits

## The Environment Cannot Run Interactive Git

This is the constraint that shapes the plugin. `git rebase -i`, `git add -p`, and `git add -i` open an editor and **hang**. Most git advice on the internet assumes they are available, so a model following that advice deadlocks the session.

Every one of these was executed and verified against Git 2.55 before being written down:

| Instead of | Use |
|---|---|
| `rebase -i` to squash fixups | `GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash <base>` |
| `rebase -i` to drop or reorder | A scripted `perl -pi -e` sequence editor, or a prepared todo file via `cp` |
| `rebase -i` to reword an older commit | An `amend!` marker commit built with `-m`, then autosquash |
| `add -p` to stage part of a file | `git diff -U5 > patch`, delete unwanted hunks, `git apply --cached --recount patch` |
| `git mergetool` | Read the file, resolve with Edit, `git add` |

Two details in that table are the ones that actually bite, and both were found by running the recipes rather than reasoning about them:

- **`git apply --recount` is not optional** after hand-editing a patch. Deleting hunks invalidates the line counts in the `@@` headers, and without `--recount` the apply fails with "corrupt patch."
- **`git commit --fixup=reword:<sha>` opens an editor too** — so it hangs like the rest. Worse, the obvious workaround (`GIT_EDITOR="cp msg"`) clobbers the `amend!` marker line that autosquash matches on, and then the rebase **silently does nothing**: the old message stays, and a stray commit is left in the log. The working form builds the marker commit directly with `-m`, and the `amend!` line has to match the target's subject byte for byte.

## The Hook Is the Part That Can't Be Talked Out Of

Knowledge in a skill is advisory — a model under pressure to finish can reason its way past it. `hooks/guard-git.sh` runs on `PreToolUse(Bash)` and denies outright:

| Blocked | Because |
|---|---|
| `push --force` without `--force-with-lease` | Overwrites commits you have never seen, with no warning and no local record |
| Any force-push to `main`/`master`/`develop`/`release/*` | — |
| `push --mirror`, deleting a protected branch remotely | — |
| `reset --hard` **when the tree is dirty** | The reflog cannot recover what was never committed |
| `checkout .` / `restore .` when the tree is dirty | Same |
| `clean -f` without `-n` | Untracked files are deleted at the filesystem level; nothing recovers them |
| `reflog expire --all`, `gc --prune=now` | Destroys the recovery path every other rule depends on |
| `filter-branch` | Deprecated by the Git project; and a leaked credential needs rotation, not a rewrite |
| `--no-verify` on commit/push/merge/rebase | Moves a failure the repo deliberately caught to somewhere it costs more |
| `rebase`/`commit --amend` while on a protected branch | — |
| `add -p`, `add -i`, `rebase -i` without a sequence editor, `mergetool`, `--fixup=amend\|reword:` | Guaranteed hang |

Three design decisions worth knowing:

- **It is state-aware, not just text-aware.** `reset --hard` is blocked *only when the working tree is dirty*, and the protected-branch rules check the actual current branch. A blanket text match on `reset --hard` would be wrong most of the time, and a guard that cries wolf gets disabled.
- **It fails open.** Malformed input, a missing interpreter, an unparseable command — all exit 0 and allow. A guard that blocks everything when it cannot parse its input breaks the session, and this is a seatbelt rather than a sandbox.
- **It denies two ways at once** — the JSON `permissionDecision` *and* exit 2 — so the block holds whichever mechanism the host honors. The failure mode is a less pretty message, never a permitted command.

It ships with **55 test cases** (28 must-allow, 27 must-deny) covering flag clusters (`-fd`, `-uf`), the `--force-with-lease` vs. bare `--force` distinction, dirty-vs-clean trees, protected-vs-topic branches, and fail-open behavior. All 55 pass:

```bash
bash hooks/scripts/test-guard.sh
```

Two of them exist because the first draft got it wrong: `git clean -fd` slipped through a regex that only matched `-f` at the end of a flag cluster, and `git push --force-with-lease origin main` slipped through because the force check never considered the lease form to be a force at all.

**Its honest limit:** it matches command *text*. A destructive command assembled from shell variables, a here-doc, or an alias passes straight through.

## Why Commits Are Split Before They're Written

The default failure this exists to prevent: a session produces a feature, a bug fix noticed in passing, a formatting sweep, and a debug print — and all four land as `feat: add pagination`. The fix becomes unreviewable, the formatting hides the logic, the debug print ships, and reverting the feature also reverts the fix.

So `/commit` proposes the split and **waits** whenever the tree holds more than one idea, and just commits when it holds one. The asymmetry is deliberate: getting the split right beforehand is free, while reordering commits afterward is a history rewrite.

On a large working tree it spawns the `diff-analyst` agent rather than reading 3,000 lines on the main thread — but that agent's output is explicitly *a proposal to verify*, not a plan to execute, because a grouping that looks plausible can still cut along the wrong seam.

## Why History Rewrites Are Safe Here

A history rewrite is supposed to change **how a change is told**, not **what the change is**. That gives an exact, mechanical check:

```bash
git diff <pre-rewrite-tip> HEAD    # must be empty
```

If it is empty, the branch's tree is byte-identical to what it was and the rewrite provably lost nothing. If it is not, `/tidy-history` resets to the recorded undo point and reports the failure rather than trying to patch up the difference.

That check is the entire safety argument for letting an agent run destructive history operations, so it is mandatory rather than recommended, and the undo point is reported to you *before* execution rather than after.

`/tidy-history` also does something most cleanup tooling doesn't: **it checks whether the work is worth doing at all.** If the repository squash-merges PRs, branch commit messages never reach `main`, and the honest advice is to fix the PR title instead of rewriting seven commits about to be collapsed into one.

## Attribution

Commits get **no** `Co-Authored-By: Claude` trailer. PR descriptions keep the `Generated with Claude Code` footer.

The split is deliberate: a PR is communication where provenance is useful context for a reviewer, while the commit log is a permanent technical record where the trailer is noise on every line of `git log`. This overrides Claude Code's default behavior.

## Invocation Names

Everything a plugin ships is namespaced, and **skills have no bare-name fallback.** The three skills are addressable only as `git-workflow:git-workflow`, `git-workflow:commit-composition`, and `git-workflow:history-surgery`; the agent as `git-workflow:diff-analyst`.

Commands are namespaced the same way. `/git-workflow:commit` is always valid; the short `/commit` used below is what the `/` menu offers when nothing else claims the name — and the official `commit-commands` plugin does claim it, so prefer the qualified form if both are installed.

## Installation

```
/plugin marketplace add bobtat/claude-plugins
/plugin install git-workflow@bobtat-plugins
```

Or test locally:

```bash
claude --plugin-dir C:\Users\Robert\Documents\GitHub\claude-plugins\plugins\git-workflow
```

**Hooks load at session start.** After installing, restart Claude Code before the guard is active.

**Requirements:** Git ≥ 2.38 for every recipe (`--update-refs`); ≥ 2.32 for the rest. `gh`, authenticated, for `/pr`. The guard script needs `bash` and uses `jq` or `python` if present, falling back to `sed` if neither is.

## Usage

The skill triggers on its own whenever Claude is about to run `git commit`, `git push`, `git rebase`, `git reset`, or `gh pr create`, and on requests like:

- "Commit this"
- "Write a commit message for these changes"
- "Split these changes into separate commits"
- "Squash my commits before I open the PR"
- "Rebase onto main"
- "Undo that last commit"
- "I committed a secret"
- "I lost my work"
- "Fix this merge conflict"

The commands are explicit:

```
/git-workflow:commit                  # split the whole working tree
/git-workflow:commit src/billing      # scope to a subtree
```

```
/git-workflow:pr                      # preflight, push, open
/git-workflow:pr --draft
/git-workflow:pr --base develop
/git-workflow:pr "feat(api): add cursor pagination"
```

```
/git-workflow:tidy-history            # audit and rewrite vs. the default branch
/git-workflow:tidy-history develop    # against a different base
```

## Structure

```
git-workflow/
├── .claude-plugin/plugin.json
├── commands/
│   ├── commit.md                              # Orchestrates the split-and-commit flow and its gate
│   ├── pr.md                                  # Orchestrates preflight → push → gh pr create
│   └── tidy-history.md                        # Orchestrates the audit, the gates, and the rewrite
├── agents/
│   └── diff-analyst.md                        # sonnet — proposes a commit split from a large diff
├── hooks/
│   ├── hooks.json                             # PreToolUse(Bash)
│   └── scripts/
│       ├── guard-git.sh                       # State-aware guard; fails open
│       └── test-guard.sh                      # 55 cases; run it after editing the guard
└── skills/
    ├── git-workflow/
    │   ├── SKILL.md                           # Gates, commit procedure, atomicity test, format, rewrite rules
    │   └── references/
    │       ├── commit-messages.md             # Types and their misuse, subjects, bodies, footers, squash-merge
    │       ├── atomic-commits.md              # Grouping, patch-file staging, splitting commits, verification
    │       ├── history-rewriting.md           # Non-interactive rebase toolkit, --onto, force-push protocol
    │       ├── branching-and-conflicts.md     # Naming, rebase vs merge, stacks, conflict procedure
    │       ├── pull-requests.md               # Anatomy, size research, gh commands, merge strategy, review
    │       ├── recovery.md                    # What the reflog can and cannot restore; the secret procedure
    │       ├── anti-patterns.md               # Fourteen, each with the case where it's actually correct
    │       └── sources.md                     # Provenance, own synthesis, known gaps, what's untested
    ├── commit-composition/SKILL.md            # /commit    — survey, group, screen, gate, execute, report
    └── history-surgery/SKILL.md               # /tidy-history — the tree-identity check and its gates
```

## What This Plugin Does Not Cover

GitLab, Bitbucket, Azure DevOps, and Gerrit — the commit and history material is host-agnostic, but everything about pull requests assumes GitHub and `gh`. Also out of scope: monorepo workflow, submodules and subtrees, commit signing, Git LFS, `git worktree`, and release engineering (tagging, changelog generation, version bumping). `references/sources.md` records the reasoning for each omission.

## Related Plugins

- **[testing](../testing)** — `/spec-conformance` answers whether a pushed branch still does what its ticket said, which is the question worth asking just before `/git-workflow:pr`.
- **[refactoring](../refactoring)** — shares the one-hat-at-a-time rule from the other side: it produces the `refactor:` commits this plugin insists on keeping separate from behavior changes.

## License

MIT
