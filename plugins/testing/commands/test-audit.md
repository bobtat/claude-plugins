---
description: Audit a whole repository's test suite — where protection is weakest relative to risk, what's systemically wrong, and where to spend test effort next
argument-hint: [path to scope to] [--no-coverage] [--mutation]
allowed-tools: Agent, AskUserQuestion, Read, Write, Grep, Glob, Bash, TodoWrite
---

## Context

- Repo root: !`git rev-parse --show-toplevel 2>/dev/null || echo "not a git repository"`
- Current branch: !`git branch --show-current 2>/dev/null`
- History depth: !`git log --oneline 2>/dev/null | wc -l` commits, first: !`git log --reverse --format=%as 2>/dev/null | head -1`
- Uncommitted changes: !`git status --porcelain 2>/dev/null | wc -l` files

## Task

Assess where this repository's test suite is weakest relative to what it protects, and produce a **risk-ranked map** — not a findings list.

This plugin's skills and agents are addressed as `testing:<name>` — there is no bare-name fallback, so `Skill("test-auditing")` does not resolve and `Skill("testing:test-auditing")` does. The audit agent is `testing:suite-auditor`.

**Load the `testing:test-auditing` skill now** and follow its procedure. It carries the risk model, the systemic-vs-specific reporting split, the report format, and the honesty rules. Load the `testing:testing` skill for the interpretation criteria its references hold — `anti-patterns.md`, `test-scope.md`, `test-design.md`, `test-doubles.md`.

### What this answers, and what it doesn't

It reports whether the suite would **notice a change**. It cannot report whether the behavior is **correct** — at repo scale there is no description of what the system should do, so there is no oracle. State that limit in the report. Where a described behavior *is* available for an area, that is `/test-write`'s job; hand off rather than implying correctness.

### Scope

`$ARGUMENTS` may contain a path to scope the audit to a subtree — useful on a monorepo, where a whole-repo audit is several audits averaged into mush. Empty means the whole repository.

`--no-coverage` skips running any coverage tool. `--mutation` pre-approves the mutation run in Phase 3 so it doesn't stop to ask.

### Artifacts

The report is long. Write it to a file — your scratchpad directory if you have one, otherwise a temp directory — and give the user the path. Offer to save it into the repo at the end; it is the justification for a quarter's test work and it is worth diffing against the next run.

Track phases with TodoWrite. Spawn `testing:suite-auditor` for Phase 4.

---

## Phase 0 — Inventory

Stack, test runner and its exact command, test directories, how slices are separated, whether a coverage tool is configured, whether mutation tooling exists. Read the build and CI config rather than guessing. Count test files.

**If there are effectively no tests, stop here.** Run the risk model, skip the rest, and report it as a ranked starting plan — "here is where to begin" is the useful output, not an audit of an empty suite.

## Phase 1 — Mechanical sweep

Ripgrep the test tree for the signal set in the skill; patterns per ecosystem are in `references/detection-patterns.md`. No reading, no judgment — counts and file lists.

**Verify one pattern against one file before trusting its count.** A house assertion helper will make a generic assertion pattern report the whole suite as assertion-free, and a report built on that is worse than no report.

## Phase 2 — Risk model

Rank modules by risk × weakness, per the skill: churn, defect history, a complexity proxy, and domain criticality against coverage, test density, and sweep-signal density.

Two things to get right:

- **Check the git history is usable** before ranking on it. Squash-merge repos and recent migrations produce churn numbers that mean something different. Say so rather than ranking on noise.
- **Confirm domain criticality with the user.** Path-name heuristics find `payment` and `auth`; every codebase has a critical area whose name doesn't reveal it.

## Phase 3 — Depth gate

Present the ranked map and let the user choose depth and areas, with `AskUserQuestion`. Carry the evidence and a recommendation — top N areas, roughly what each costs.

- **Coverage** runs here, using only what the repo already has configured. None configured → "not measured", offered as a follow-up. Do not install tooling.
- **Mutation testing runs only on explicit approval** (or `--mutation`), scoped to the single top-ranked module, with a time estimate given first. It is the strongest evidence available and the slowest thing here.

## Phase 4 — Targeted deep audit

Spawn `testing:suite-auditor` agents in parallel, one per selected area. Each reads that area's tests **and the production code they cover**.

Keep their briefs **aggregate** — protection strength, what class of defect would slip through, patterns within the area. Per-test defect enumeration is `/test-review`'s job; duplicating it here rebuilds the flat list this command exists to avoid.

## Phase 5 — Synthesize

Diagnose suite shape by the method in `references/test-scope.md` — read what the code *is*, then compare to the slice counts, and report the mismatch. Verify findings, separate systemic from specific, and write the report in the skill's format.

End with ranked next actions, each naming the command that performs it: `/test-review <path>` for per-test depth, `/test-write <description>` for a gap whose intended behavior is known.

---

## Rules

- **Never fabricate a coverage number.** Not measured means not measured.
- **Never assert a test cannot fail without running it.** Label `confirmed` when the defect is unambiguous on the page, `unverified — requires running` otherwise.
- **Always state the sampling** — files swept mechanically, files deep-read, what was skipped.
- **Check the "actually correct when" clause** in `references/anti-patterns.md` before reporting any pattern. At this scale a tolerable false-positive rate becomes noise, and one confidently wrong finding gets the whole report discounted.
- **Report systemic findings first**, with their production causes named where that is the real cause.
- **Do not manufacture findings.** A clean audit is a real result — say it plainly and stop.
- **Change nothing.** This command reads, ranks, and reports. It does not fix tests, and it does not commit.
