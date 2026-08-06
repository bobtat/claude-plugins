---
name: spec-test-writing
description: Use when implementing an approved test plan — building shared test scaffolding before fanning out, dispatching parallel authoring agents over disjoint files, requiring executed-and-observed-red evidence rather than claims of verification, and running an adversarial review of the resulting test code for simplicity, maintainability, and conformance with the existing suite. Invoked by /test-write after plan approval.
---

# Writing Tests From an Approved Plan


**Reference paths.** This skill ships no `references/` directory of its own — every `references/…` named below belongs to the **`testing:testing`** skill, which must be loaded alongside it — the bare name `testing` does not resolve.

## Overview

Authoring is where a good plan gets diluted. Three things cause it, and the procedure below exists to prevent each:

- **Parallel authors duplicating infrastructure.** Four agents writing tests for the same aggregate produce four `OrderBuilder`s with different defaults. Fix: build shared scaffolding first, serialized, and hand every author an inventory of what already exists.
- **Claimed verification.** An agent reports "all tests pass" having run nothing. Fix: evidence is the command and its output, never the assertion that it went well.
- **Green-seeking.** A spec-derived test goes red, and the agent adjusts the expectation until it passes — converting the pipeline's single most valuable output into noise. Fix: the rule below, stated to every author verbatim.

Everything in the `testing` skill applies to the test code itself: naming, AAA, whole-value assertions, no logic in tests, and the mocking gate. This file governs the *process*.

## The rule every author gets verbatim

> **Expected values come from the behavior spec, not from the code under test.** If a test fails, that is a finding — the code may not implement the described behavior. Do not weaken the assertion, do not delete the test, do not edit production code to make it pass. Report it.

Put this in every authoring brief. It is the one instruction that, if dropped, silently invalidates the whole run.

## Two Modes

Determine which from recon and from `--bdd`:

**Code exists.** Tests are written against a running implementation, and they are expected to pass — except where the code does not match the description, which is exactly what you are looking for. Every test needs its red confirmed from the *test side*: change the expected value to something wrong, run it, confirm it fails for the reason you expect, restore it. Never mutate production code to force a red; an interrupted sequence leaves a defect in the tree.

**Code does not exist yet (BDD / outside-in).** Tests are written first and are *supposed* to fail — failing to compile or resolve is a legitimate red. Here you may build the abstractions the tests need to express themselves: builders, fixtures, harnesses, and the interfaces the tests call *through*. Do not implement the behavior. Follow the outside-in sequence in `references/bdd.md`: one outer test for the first scenario, then inward. Record which failures are "not implemented yet" so Phase 5 does not report them as spec/code mismatches.

## Step 1 — Scaffolding, serialized

**One agent, or you, working alone.** Build everything on the plan's "new test infrastructure" list before any author starts:

- Builders and object mothers, with sane defaults so tests can name only the values that matter
- Fakes for real boundaries — in-memory implementations, not mocks
- Fixtures, harnesses, container setup, seed data
- In BDD mode, the interfaces and types the tests call through

Match the existing suite: if the suite has an `OrderBuilder`, extend it rather than adding `OrderTestDataFactory`. Recon's conventions section is the authority; where the suite's convention conflicts with the `testing` skill's preference, **the suite wins** and you note the divergence in the final report.

Compile or import the scaffolding and confirm it loads before dispatching anyone. Handing four agents a broken builder produces four agents debugging the same thing.

## Step 2 — Slice the work

Slice by **file ownership**, never by anything that lets two agents touch one file. Concurrent edits to the same test file lose work silently.

- Group cases by target test file, then assign whole files.
- Cases at different scopes go to different authors — a unit slice and an integration slice have different setup concerns.
- Two or three authors is usually the whole benefit. Beyond that, coordination cost and review load exceed the parallelism gain.
- If the plan has only a handful of cases, or they all land in one file, **do not fan out.** One author, or do it yourself.

Each author gets `authoring/<slice>.md` containing:

1. The rule above, verbatim
2. Their slice of the traceability matrix — case IDs, behavior IDs, names, scopes, doubles
3. The relevant behaviors from the spec, in full, with anchors — **this is their oracle**
4. **Exact file paths they own**, and an instruction to create or modify nothing else
5. The scaffolding inventory — what exists, where, how to use it
6. Suite conventions from recon — naming, layout, assertion library, how the clock and IO are handled
7. The command to run their tests, and the requirement to paste its output
8. An instruction to load the `testing:testing` skill
9. **The mode — `code exists` or `BDD`.** The author branches on this to classify its own failures, and it cannot read a value the brief does not carry. An author that assumes `code exists` during a BDD run reports every unresolved symbol as a spec/code mismatch, and Phase 5 is instructed to leave those red and report them prominently — so the final report leads with fabricated claims that the code fails to implement behavior nobody has written yet.
10. Whether any case in the slice is a **characterization case**, named as such. Without that word the author is under the absolute form of the verbatim rule and will correctly refuse to take a value from the implementation.

Spawn them with the `testing:spec-test-author` agent.

**If the plan carries characterization cases** — cases resting on a behavior the spec labels `observed`, which the user chose to lock rather than confirm — say so explicitly in that author's brief, and say why the rule above reads differently for them. A characterization test's expected value *does* come from the running code; that is what it is for. The protections are elsewhere: it must be named and commented as documenting current behavior (`references/legacy-code.md` has the procedure), it must never be described as proving the behavior correct, and a red one is not a spec/code mismatch. Keep these in separate files or a clearly separated region from the spec-derived tests — mixing them is how "the code does this" gets read later as "this is required."

## Step 3 — What authors must not do

State these as prohibitions in the brief:

- **Do not edit production code.** If a behavior cannot be reached at all, stop and report the obstacle with the smallest seam that would fix it (`references/legacy-code.md`). Do not create the seam unilaterally.
- **Do not change the plan.** A case that turns out to be wrong or impossible gets reported, not rewritten. Silent substitution destroys traceability.
- **Do not weaken or delete assertions**, add `skip`/`ignore`/`xfail`, or catch-and-swallow to reach green.
- **Do not add cases** beyond the slice. Anything discovered mid-write goes in the report as a proposed case.
- **Do not report a test as verified without the command output.** "Could not run, here is the error" is an acceptable and useful result; a false claim is not.

## Step 4 — Collect and reconcile

Each author returns: tests written (case ID → file → test name), the command run and its output, which tests were confirmed able to fail and how, failures with the classification the author assigned, obstacles hit, and cases not completed with the reason.

Before review, reconcile:

- Every case in the slice is accounted for — written, or explained.
- No file was touched by two authors.
- No duplicated helpers appeared despite the scaffolding step. If they did, consolidate now; the reviewer should not spend its attention on it.
- No production file changed. Check with `git status` — this is worth verifying, not trusting.

## Step 5 — Adversarial code review

Spawn the `testing:test-code-critic` agent over everything written. Its charter, in priority order:

1. **Oracle integrity.** Does any expected value trace to the implementation rather than the behavior spec? Any test that cannot fail — no meaningful assertion, an assertion on a literal, a double so lenient the path never runs, an over-broad exception assertion?
2. **Traceability.** Does each test prove the behavior its case claims? A test named for `B3` that asserts something `B3` never said is worse than a missing test, because the audit will count it as coverage.
3. **Conformance with the existing suite.** Naming, layout, assertion style, fixture patterns, use of existing builders. A slice that is individually elegant and unlike everything around it is a maintenance cost.
4. **Simplicity and human maintainability.** Would a developer who did not write this understand what broke from the failure message alone? Is setup longer than the assertion? Is there logic in the test — `if`, loops that assert, an expected value computed with the production formula? Are irrelevant values cluttering the body instead of sitting behind a builder default?
5. **Architecture of the test code.** Is the scaffolding coherent, or are there parallel builders and near-duplicate fakes? Is anything over-abstracted — a base class or helper indirection that hides what a test actually does? Over-abstraction is as costly as duplication here, and more common in generated test code.
6. **Anti-patterns**, per `references/anti-patterns.md` — **and read each entry's "actually correct when" clause before reporting.** Skipping it is how a review manufactures false positives.
7. **Determinism.** Real clock, sleeps, unseeded randomness, unawaited async, order dependence, shared mutable state.

Give the reviewer the behavior spec and the plan, not just the diff — most of these findings are only decidable against the oracle.

Address findings by severity. Oracle-integrity findings are not negotiable: a test that cannot fail gets fixed or deleted. For style findings that conflict with the surrounding suite, the suite wins. Reject findings you disagree with and say why; do not perform a fix you think is wrong.

## Step 6 — Hand off

Report to the main pipeline: files created and modified, case-to-test mapping, the full command output from the final run, tests confirmed able to fail, failures with classifications, review findings addressed and rejected, deviations from the plan, and anything you could not verify.

## Authoring Anti-Patterns

| Anti-pattern | Why it is fatal here | Instead |
|---|---|---|
| Reading the implementation for the expected value | Produces tests that ratify the code, defeating the entire pipeline | Expected values come from the spec; unknowns go back to the user |
| An unlabeled characterization test | It reads as a requirement forever, and the next reader has no way to tell it was never specified | Name and comment it as documenting current behavior, and keep it out of the spec-derived files |
| Adjusting an assertion until green | Destroys the finding that justified the run | Leave red, classify, report |
| Claimed verification | The suite's trustworthiness is the deliverable | Paste the command output |
| Parallel authors on one file | Silent lost edits | Disjoint file ownership |
| Each author building its own builder | Three near-identical helpers to maintain | Scaffolding first, inventory in the brief |
| Editing production code to make a test pass | Hides the defect the test found and mixes concerns | Report the obstacle, propose the seam |
| Silently substituting a different case | Traceability breaks and the audit reports coverage that does not exist | Report the problem with the case |
| Style unlike the surrounding suite | Elegant in isolation, friction forever | Recon's conventions win over preference |
