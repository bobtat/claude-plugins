# Sources, Synthesis, and Known Gaps

## Where the Conventions Come From

**Conventional Commits 1.0.0** — [conventionalcommits.org](https://www.conventionalcommits.org/en/v1.0.0/). The type/scope/`!`/footer grammar, the `BREAKING CHANGE:` footer, and the mapping to SemVer bumps are the specification verbatim. The types beyond `feat` and `fix` (`docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`) are not part of the spec proper — they come from the Angular commit convention that the spec cites as its origin, and are near-universal in practice.

**Commit subject craft** — the imperative-mood rule, the 50/72 convention, and the "if applied, this commit will…" test are long-standing Git community practice, articulated most influentially in Chris Beams' *[How to Write a Git Commit Message](https://cbea.ms/git-commit/)* (2014) and reflected in the Git project's own `SubmittingPatches`.

**Git mechanics** — `--force-with-lease`, `--force-if-includes`, `--autosquash`, `--fixup=amend:`/`reword:`, `--update-refs`, `rebase --exec`, `rerere`, `zdiff3`, and the reflog semantics are all from the official Git documentation ([git-scm.com/docs](https://git-scm.com/docs)). Version floors stated in the text: `--force-if-includes` is Git ≥ 2.30, `--fixup=amend|reword` is ≥ 2.32, `--update-refs` is ≥ 2.38, `zdiff3` is ≥ 2.35.

**Pull-request size and review effectiveness** — SmartBear's study of peer code review at Cisco Systems (2005–2006; 2,500 reviews, ~3.2M lines of code, 50 developers). The specific findings used: defect-finding ability drops beyond ~400 LOC per review; a 200–400 LOC review over 60–90 minutes yields 70–90% defect discovery; defect density drops significantly above ~500 LOC/hour. Published in SmartBear's *[Best Practices for Peer Code Review](https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/)* and the [Cisco case study PDF](https://static0.smartbear.co/support/media/resources/cc/book/code-review-cisco-case-study.pdf).

**Caveat on that study:** it is vendor-published research about a single company's C/C++ codebase, now two decades old, and measuring reviews conducted in a dedicated review tool rather than as GitHub pull requests. The direction of the finding is corroborated by later work and by common experience; the exact thresholds should be treated as useful heuristics rather than measured constants for any given team.

**Secret remediation ordering** — rotate-before-rewrite, and the fact that rewriting does not un-leak, follows GitHub's own documentation on [removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository), which recommends `git-filter-repo` over the deprecated `filter-branch`.

## This Plugin's Own Synthesis

Not sourced from anywhere in particular; assembled here because the pieces are usually scattered:

- **The non-interactive rebase toolkit.** The `GIT_SEQUENCE_EDITOR` recipes for drop/reorder/edit, and the `git diff` → edit patch → `git apply --cached --recount` substitute for `git add -p`, exist because Claude Code cannot run interactive Git at all. Individual pieces appear in blog posts and Stack Overflow answers; collecting them as *the* way to do history work in a non-interactive agent environment is this plugin's framing. The `--recount` requirement after hand-editing a patch is the detail most often omitted elsewhere, and is the most common cause of these recipes failing.
- **The four-part atomicity test** (reverts cleanly alone / no "and" in the subject / builds on its own / nothing unexplained by the subject). A compression of widely-shared advice into a checkable form.
- **The published/unpublished decision table** as the single question governing every rewrite.
- **The merge-strategy × commit-quality matrix.** The observation that squash-merge repositories make branch commit hygiene nearly worthless while making the *PR title* a permanent commit subject is underemphasized nearly everywhere, and it changes where effort should go.
- **The "when it's fine" column throughout `anti-patterns.md`.** Borrowed in form from this marketplace's `refactoring` plugin, on the view that a rule without its exceptions produces confident misapplication.

## Known Gaps

Deliberately not covered:

- **Non-GitHub hosting.** GitLab, Bitbucket, Azure DevOps, and Gerrit have different PR/MR models, and Gerrit's change-per-commit model in particular conflicts with several recommendations here. The commit and history material is host-agnostic; everything in `pull-requests.md` assumes GitHub and `gh`.
- **Monorepo-specific workflow.** Sparse checkout, partial clone, per-package versioning, and release trains are out of scope.
- **Submodules and subtrees.** Genuinely tricky and used rarely enough that the guidance would be speculative.
- **Signed commits.** `commit.gpgsign`, SSH signing, and `git verify-commit` are mentioned only as things not to bypass. Repositories requiring signatures need setup this plugin does not perform.
- **Git LFS.** Referenced only via "do not commit large binaries."
- **Release engineering.** Tagging conventions, changelog generation from Conventional Commits (`semantic-release`, `changesets`, `git-cliff`), and version bumping are downstream of what this plugin does and vary too much by ecosystem.
- **`git worktree`.** Useful with agents specifically, but orthogonal to commit and PR quality.

## What Is Untested

The `/git-workflow:commit`, `/git-workflow:pr`, and `/git-workflow:tidy-history` procedures encode judgment — how to group a diff into logical changes, when a history is messy enough to warrant rewriting, whether a PR is too large. That judgment is not measured against anything. The safety gates are mechanical and testable; the grouping quality is not, and a split that looks reasonable can still cut along the wrong seam.

The `hooks/scripts/guard-git.sh` guard matches command **text**, not intent. It is a backstop against the obvious forms of destructive commands, not a sandbox: a destructive command constructed through variables, a here-doc, or an alias will pass it. Treat it as the seatbelt, not the brakes.
