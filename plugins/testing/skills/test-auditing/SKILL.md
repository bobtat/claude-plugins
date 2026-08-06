---
name: test-auditing
description: Use when assessing a whole repository's test suite rather than specific test files — finding where protection is weakest, diagnosing systemic problems across the suite, ranking modules by risk against the strength of their tests, and producing a map that says where to spend test effort next. Invoked by /test-audit. For per-test defects in a known set of files, use /test-review instead.
---

# Auditing a Repository's Test Suite

## Overview

This answers one question: **where is this suite weakest relative to what it protects?**

It is not a bigger `/test-review`. Reviewing tests file by file across a repository produces hundreds of findings nobody acts on, and misses the findings that only exist in aggregate — that the fast slice is 4% of the suite, that 47 files sleep, that the module with the worst bug history has the thinnest tests. Those are the findings worth having, and none of them are visible one file at a time.

Two things make the job tractable at scale, and both are non-negotiable:

1. **Mechanical sweep before reading.** A five-thousand-file suite cannot be read. Grep-able signals across everything, then deep reading only where the ranking says it matters.
2. **A map, not a list.** Output is modules ranked by risk against protection, with systemic patterns called out once. A flat list of findings is a failure of the format, not a thorough audit.

**Reference paths.** `references/detection-patterns.md` is this skill's own. Every other `references/…` named below belongs to the **`testing`** skill — load it alongside this one, since it holds the criteria the signals here are interpreted against.

## What This Can and Cannot Tell You

**State this limit in every report.** At repo scale there is no oracle — no description of what the system as a whole should do. So:

- **Can report:** whether the suite would *notice a change* — protection strength, gaps, fragility, systemic design problems, where risk and weakness coincide.
- **Cannot report:** whether the behavior is *correct*. A well-protected module can be well-protected wrong.

When a described behavior *is* available for some area, that is `/test-write`'s job and the audit should hand off to it. Do not silently upgrade "the tests are thorough" into "the code is right."

The failure mode of an audit is overclaiming, and it is much more damaging than an incomplete audit — a report that says "well covered" about a module full of vacuous assertions actively removes the pressure to fix it.

### Where the module attribution breaks down

The risk map assumes protection can be attributed to a module. For unit and narrow-integration tests that holds. **For browser end-to-end tests it largely does not** — one `checkout.cy.ts` traverses routing, auth, cart, pricing, and payment, so it cannot be scored as protection for any one of them.

This is a real limit, not a pattern gap. Handle it by scoring E2E separately as **journey-level protection** — list the journeys covered, and do not let their existence raise any module's protection score. A repository whose entire suite is browser E2E has, by this model, near-zero module-level protection and a handful of covered journeys. That is the correct reading and usually the most useful thing the audit can say about such a repo.

## Why Not Just Run a Coverage Tool

Because coverage measures which lines ran, not whether anything was verified. `references/test-design.md` puts it plainly: a suite with no assertions can reach 100%.

Never reimplement coverage. Run the repo's own tool and use its output as an input. **The value this audit adds is the cross-reference**, which no coverage tool can do:

| Coverage | Assertion quality | Reading |
|---|---|---|
| Low | — | An honest gap. Cheapest thing to fix, and the tool already found it. |
| High | Strong | Genuinely protected. Say so. |
| **High** | **Weak** | **The dangerous cell.** Looks safest, protects least. Only reading finds it, and it is the single most valuable output of this audit. |
| Low | Strong | Small but real protection. Usually a young suite; not a problem. |

## Procedure

### Phase 0 — Inventory

Establish, before any analysis: language and stack, test runner and the exact command to invoke it, test directories, how slices are separated (directories, xUnit traits, pytest markers, Jest projects, Go build tags), whether a coverage tool is configured, whether any mutation tooling exists. Read the build/config files rather than guessing — `package.json`, `*.csproj`, `pyproject.toml`, `go.mod`, `pom.xml`, CI workflow files.

Count test files and, approximately, tests.

**If there are effectively no tests, stop.** The useful output is "here is where to start, ranked by risk" — not an audit of an empty suite. Run the risk model (Phase 2), skip the rest, and report it as a starting plan.

### Phase 1 — Mechanical sweep

Ripgrep across the test tree. No reading, no judgment — counts and file lists per signal. Patterns per ecosystem are in `references/detection-patterns.md`.

**Identify the frameworks before sweeping.** A browser suite needs different patterns, and the generic ones fail silently against it: idiomatic Cypress contains almost no `expect(`, so a generic assertion sweep returns zero and the assertion-free heuristic then flags the entire suite. `references/detection-patterns.md` has the browser section; the `testing` skill's `references/ui-testing.md` has the criteria for interpreting it.

Every signal maps to an entry in `references/anti-patterns.md`, which is where the interpretation lives:

| Signal | Indicates |
|---|---|
| Sleeps in tests | Flakiness and wasted wall-clock; usually an uninjected clock in production |
| Disabled/skipped tests | The suite reports protection it does not provide |
| Real clock or unseeded randomness | Nondeterminism |
| Mock density per file | Mock overuse; at high density, a production design signal |
| Tests with no assertion token | Candidates for the test that cannot fail |
| `assertNotNull`-only, broad exception catches | Assertions too weak to fail for the right reason |
| `if`/`for`/`try` in test bodies | Conditional test logic; loops that assert pass vacuously on empty |
| Oversized snapshot files | Snapshot-everything; the diff is never reviewed |
| Production directories with no test counterpart | Structural gaps |

**Counts are candidates, not findings.** A grep hit for `Thread.Sleep` might be in a helper that polls correctly. Aggregate counts are reliable enough to rank; individual hits are not reportable until seen.

### Phase 2 — Risk model

Protection only matters against what is at stake, so rank by **risk × weakness**.

The churn-and-complexity half is Michael Feathers' — his *Getting Empirical about Refactoring* uses version-control history to find refactoring candidates, and the quadrant that matters is **high churn crossed with high complexity**: code that is both hard to understand and constantly changing. Adding test coverage as a third dimension is Ernesto Tagwerker's extension (the Skunk tool), whose framing is directly this audit's question — *should I increase test coverage before I refactor this?* Provenance and what was verifiable is in `references/sources.md`.

**Risk inputs** — all cheap, all from git or grep:

- **Churn.** Commits touching each file over a chosen window (default: 12 months). `git log --format= --name-only --since=...` piped through a frequency count.
- **Defect history.** Commits matching `fix`/`bug`/`hotfix`/`revert` touching each file. **This is the strongest signal available and the closest thing to an oracle at repo scale** — a module that has repeatedly produced bugs and has thin tests is the top of the ranking by definition, with the evidence attached. `references/test-scope.md` already leans on bug history for diagnosing suite shape.
- **Complexity proxy.** Branch density — counts of `if`/`else if`/`switch`/`case`/`catch`/`&&`/`||` — and file length. A proxy, not a metric; say so.
- **Domain criticality.** Path-name heuristics (payment, billing, auth, permission, tax, pricing, migration). **Confirm with the user rather than assuming** — every codebase has a critical area the names don't reveal.

**Weakness inputs:** coverage where measured, test-to-production density, and Phase 1 signal density for the module.

Rank, and keep the evidence attached to each row. A ranking whose reasoning is invisible cannot be argued with, and the user knows things about their system that this model does not.

### Phase 3 — Depth gate

Present the ranked map and let the user choose depth and areas. Carry evidence and a recommendation — behavior of `/test-write`'s depth gate, for the same reason: the user is the one who knows what is worth the spend.

- **Coverage** runs here, using the repo's already-configured tool only. If none is configured, say "not measured" and offer to set one up as a follow-up. Do not install tooling mid-audit.
- **Mutation testing runs only on explicit approval**, and only on the single top-ranked module. It is the one measure that answers "would these tests notice a defect," and it can take hours — so it is offered, scoped, and never run by surprise.

### Phase 4 — Targeted deep audit

Spawn `suite-auditor` agents in parallel, one per selected area. Each reads the area's tests **and the production code they cover** — most of what matters (over-mocking, wrong scope, weak assertions) is only decidable against the code under test.

Give each agent the area path, the ranking evidence for it, and the aggregate checklist. Keep the per-agent checklist **aggregate**: the strength of protection, what class of defect would slip through, systemic patterns in this area. Per-test defect enumeration is `/test-review`'s job and duplicating it here produces the flat list this format exists to avoid.

### Phase 5 — Synthesis

On the main thread, where the whole picture is visible.

1. **Diagnose suite shape.** Use the method already in `references/test-scope.md`: read what the code *is* — dense conditional logic and calculations imply a pyramid; thin forwarding controllers, mapping, and ORM queries imply a trophy — then compare against the actual slice counts. Report the mismatch, not the ratio. An inverted pyramid on a logic-rich domain is a systemic finding worth more than any individual test defect.

   **Split browser suites by slice before counting.** `cypress/component/` costs near a unit test; `cypress/e2e/` costs seconds and fails for unrelated reasons. Counting them together turns a healthy component-heavy suite and a pathologically E2E-heavy one into the same number.
2. **Verify before reporting.** Downgrade any "this test cannot fail" claim to `suspected` unless it was executed or is unambiguous on the page (no assertion at all, an assertion on a literal, an empty body). Check the **"actually correct when"** clause in `references/anti-patterns.md` for every pattern before reporting it — at repo scale, a false-positive rate that would be tolerable across ten findings becomes noise across a thousand files, and one confidently wrong finding causes the whole report to be discounted.
3. **Separate systemic from specific**, below.
4. **Write the report.**

## Systemic vs. Specific

This split is what makes the audit worth running.

**Systemic findings** are patterns across the suite, reported once with a count, a cause, and a single fix: *"64 test files construct `DateTime.Now` directly. The clock is not injected anywhere in the domain layer — that is a production change, and it is why the scheduling tests are the flakiest in the suite."*

**Specific findings** are individual defects severe enough to name despite the scale — a critical module's only test being vacuous, a disabled test on a payment path.

Report systemic first. They are fewer, they have leverage, and their fixes are usually production-side. A hundred specific findings that all share one cause is one finding, reported wrong.

## Report Format

```markdown
## Verdict
<Would this suite catch a regression in what it covers? One paragraph, plainly.>

## Suite shape
| Slice | Test count | Share | Budget/actual runtime |
<Shape the code needs, per test-scope.md, vs. the shape it has. Name the mismatch.>

## Risk map
| Module | Risk (churn / defects / complexity) | Protection | Verdict |
<Ranked. Evidence in the row, worst first.>

## Systemic findings
<Pattern, count, cause, single fix. Production-side where that is the real cause.>

## Specific findings
<Only those severe enough to name. Each labeled confirmed | suspected.>

## Coverage
<Tool, command, result — or "not measured: no coverage tool configured.">

## Not examined
<N test files swept mechanically, M deep-read, which areas were skipped and why.>

## Next actions
<Ranked. Each with the command that does it.>
```

## Honesty Rules

The report's only value is that someone can act on it without re-verifying it themselves.

- **Never fabricate a coverage number.** No tool configured means "not measured" — never an estimate, never a guess from test counts.
- **Never assert a test cannot fail without running it.** `confirmed` versus `suspected`, the convention `/test-review` already uses.
- **Always state the sampling.** How many files were swept mechanically, how many were deep-read, what was skipped. An audit that implies whole-repo certainty from a 3% sample is worse than one that reports the 3% honestly.
- **Call proxies proxies.** Branch density is not complexity; test count is not protection.
- **Do not manufacture findings.** If the suite is genuinely good, say so and stop. A clean audit is a real result, and padding one destroys the credibility of the next.
- **Name production causes as production causes.** Uninjected clocks, god classes, no pure core. Fixing the tests alone relocates the problem.

## Handing Off

The audit diagnoses; it does not treat. End by naming the next action for each top area with the command that performs it:

- Weak or fragile tests in a known area → **`/test-review <path>`** for per-test depth
- A recent change whose ticket or PR described what it should do → **`/spec-conformance <PR or ticket>`** to check the code still matches the description
- A gap where the intended behavior is known or documented → **`/test-write <ticket, PR, or description>`**
- Production-side causes (uninjected clock, god class, no seam) → the `refactoring` plugin if installed, whose `references/test-smells.md` reads test pain as a design report. It is a sibling plugin and may be absent; do not read it by relative path.

Offer to save the report into the repo. It is long, it is the justification for a quarter's test work, and it is worth diffing against the next run.
