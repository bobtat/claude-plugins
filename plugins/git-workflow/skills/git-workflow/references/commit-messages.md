# Commit Messages

## The Format

Conventional Commits 1.0.0:

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

The machine-readable part is the first line. Tooling derives changelogs and semantic-version bumps from it (`feat` → minor, `fix` → patch, `!` or `BREAKING CHANGE:` → major). The human-readable part is the body, and it is the part that survives.

## Types

| Type | Applies when | Commonly misused for |
|---|---|---|
| `feat` | New capability visible to a user or caller of the system | Internal helpers nobody can call yet — that is `refactor` or part of the `feat` that uses it |
| `fix` | Corrects behavior that was wrong | Changing behavior that was merely undesirable-but-specified; that is `feat` or `refactor` |
| `docs` | Documentation only — README, comments, ADRs | Code changes that happen to also touch docs; split them |
| `style` | Whitespace, formatting, semicolons — **zero** semantic change | Any rename or reordering that changes behavior |
| `refactor` | Restructuring with no behavior change | Bundled behavior changes; if tests had to change meaningfully, it is not a refactor |
| `perf` | Improves performance measurably | Speculative micro-optimizations with no measurement |
| `test` | Adds or corrects tests only | Production fixes discovered while testing; split them |
| `build` | Build system, dependencies, packaging | CI configuration, which is `ci` |
| `ci` | CI/CD pipeline configuration | Build scripts the pipeline calls, which is `build` |
| `chore` | Maintenance with no src or test change — tooling config, ignore files | **Everything the author couldn't be bothered to classify.** See below |
| `revert` | Reverts a previous commit | Manual re-editing that undoes a change; that is `fix` |

### The `chore` problem

`chore` is the type most likely to be wrong. When a change does not fit a type, it is usually because it is *two changes wearing one label*. `chore: update deps and fix build` is `build:` plus `fix:`.

Legitimate `chore`: adding an entry to `.gitignore`, bumping a tool version in `.tool-versions`, renaming a non-code asset. If it changed anything under `src/` or `test/`, it is not a chore.

## Scopes

The scope names the part of the system affected: `feat(auth):`, `fix(parser):`. Rules:

- **Derive scopes from the codebase, not from imagination.** Run `git log --oneline -50` and reuse the scopes already in use. Inventing a parallel vocabulary makes the history harder to filter, which is the only thing scopes are for.
- If a repository does not use scopes, do not start unilaterally.
- A change spanning many scopes usually wants splitting. If it genuinely does not (a cross-cutting rename), omit the scope.

## The Subject Line

**The imperative test:** the subject must complete this sentence — *"If applied, this commit will \_\_\_."*

| Good | Bad | Why |
|---|---|---|
| `fix(auth): reject tokens issued before a password change` | `fixed the token bug` | Past tense; no type; "the token bug" identifies nothing |
| `refactor(billing): extract proration into ProrationCalculator` | `refactor: cleanup` | Names nothing; unsearchable |
| `perf(search): replace linear scan with index lookup` | `perf: make search faster` | States the goal, not the change |
| `feat(api): add cursor pagination to /orders` | `feat(api): add pagination and fix sort order` | Two changes |

Mechanics: imperative mood, lowercase after the colon, no trailing period, ≤ 50 characters where it fits and never past 72 (`git log --oneline` and GitHub both truncate).

## The Body

Wrap at 72 columns. The body answers **why**, and specifically these four questions when they apply:

1. **What was wrong or missing?** The state of the world before.
2. **Why this approach?** The alternatives considered and rejected — this is the single most valuable thing a commit body can carry, and it is almost always lost.
3. **What are the consequences?** Performance, compatibility, behavior a caller will notice.
4. **What does a future reader need that isn't in the diff?** An upstream bug number, a spec section, a production incident.

Never restate the diff. `git show` already contains it.

### Before and after

**Before:**
```
fix: update timeout
```

**After:**
```
fix(sync): raise upstream timeout from 30s to 60s

The vendor's p99 moved past 30s after their October infrastructure
migration, so roughly 4% of nightly syncs failed on timeout and were
retried into a duplicate-record condition.

Raising the timeout is a stopgap. The real fix is making sync
idempotent (tracked in #4412); this stops the bleeding tonight.
```

The subject is searchable, the body explains a decision nobody could reconstruct from the code, and it names the follow-up so the stopgap does not become permanent by accident.

**Before:**
```
refactor: cleaned up the order service and also fixed a null check
```

**After:** two commits.
```
fix(orders): guard against a null shipping address on guest checkout

Guest orders skip the address-book write, so Order.ShippingAddress
was null for any guest reaching the label-printing path.
```
```
refactor(orders): extract label generation into LabelBuilder

No behavior change. OrderService had grown three unrelated
responsibilities; this moves the first of them out.
```

## Footers

| Footer | Use |
|---|---|
| `BREAKING CHANGE: <description>` | Required for any breaking change. Describe **the migration**, not just the breakage |
| `Fixes #123` / `Closes #123` | Only when the commit genuinely closes the issue — GitHub will auto-close it on merge |
| `Refs #123` | Related but not closing |
| `Co-authored-by: Name <email>` | Real human co-authors (pairing). **Not** for AI attribution in this plugin's convention |
| `Signed-off-by: Name <email>` | DCO-required projects; `git commit -s` generates it |

## Breaking Changes

Both markers, together:

```
feat(api)!: return ISO-8601 timestamps from /events

BREAKING CHANGE: `created_at` was a Unix epoch integer and is now an
ISO-8601 string. Clients parsing it as a number will fail. The v1
endpoint keeps the old format until 2026-03-01; migrate to /v2/events
or set `Accept: application/vnd.api.v1+json`.
```

The `!` is what tooling reads for the major bump. The footer is what a consumer reads to survive it. A `BREAKING CHANGE:` footer that only restates the subject has wasted the one place a migration path could have lived.

## Reverts

```
revert: feat(api): add cursor pagination to /orders

This reverts commit 8a3f2c1d.

Cursor encoding leaked the internal primary key, and the fix requires
a format change we cannot ship before the release freeze. Re-landing
after the freeze, tracked in #4501.
```

`git revert` generates the first two lines. **Always add the reason** — a revert with no explanation invites someone to re-land the same change next quarter.

## Squash Merges Change the Rules

When a repository squash-merges PRs, **the PR title becomes the commit subject on `main`** and the PR body (or the concatenated commit list) becomes the body. So:

- The PR title must itself be a valid Conventional Commit subject.
- Individual commit subjects on the branch matter for review, not for permanent history.
- Verify the generated squash message before merging — GitHub's default concatenation of every commit subject is rarely what you want.

Under merge-commit or rebase-merge strategies, every commit subject lands permanently and the standard applies to all of them.

## Message Linting

Repositories may enforce the format with `commitlint`, `gitlint`, or a `commit-msg` hook. Check for `commitlint.config.js`, `.gitlint`, `.husky/commit-msg`, or `.pre-commit-config.yaml` before writing messages — the local config may restrict types or require a scope. If a hook rejects a message, **fix the message; never bypass with `--no-verify`.**
