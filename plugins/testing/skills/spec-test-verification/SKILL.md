---
name: spec-test-verification
description: Use when auditing written tests back against the behavior specification and test plan that produced them — checking traceability in both directions, running the full suite, classifying every failure as a spec/code mismatch versus a test defect versus an environment problem, and reporting which described behaviors appear unimplemented. Invoked by /test-write as the final phase.
---

# Verifying Tests Against the Described Behavior

## Overview

This phase answers one question: **do the tests that now exist actually prove the described behavior is captured in the code?**

That is not the same as "do the tests pass." A suite can be entirely green and prove nothing — because the expected values came from the implementation, or because two behaviors in the description never got a test, or because a test named for a behavior asserts something else. Conversely, a red suite can be a complete success: it means the code does not do what was described, found before anyone shipped it.

So the deliverable is a verdict with evidence, not a pass/fail.

## Step 1 — Audit traceability, both directions

**Forward — every behavior is proven.** Walk the behavior spec. For each ID:

| State | Meaning |
|---|---|
| **Covered** | ≥1 test exists, and its assertions match the behavior's `Then` and observable | 
| **Covered by existing tests** | The plan found prior coverage and left it; name the file and test |
| **Partially covered** | The happy path is tested, described branches or boundaries are not; name each |
| **Not covered** | No test. Either a defect in this run, or an out-of-scope decision — say which, with the reason |

**Backward — every test earns its place.** Walk the new tests. Each must name the behavior it proves. Tests with no behavior ID are scope creep or fabricated requirements — report them and propose removal unless the user wants them.

**Then the check that matters most: does the test actually assert what the behavior says?** Read the assertion against the behavior's `Then` clause and its anchor quote. A test named `refunds_the_full_amount` that asserts only `result.IsSuccess` does not prove the behavior, and it is more dangerous than a missing test because both the matrix and the coverage report count it. Verify by reading, case by case. This is the single highest-value check in the phase.

## Step 2 — Run the suite

Run the **whole suite**, not only the new tests. New tests are the point, but a regression in the existing suite caused by shared scaffolding is the most likely damage this pipeline does.

Capture and keep the actual output. If the suite cannot run — missing dependencies, no database, wrong runtime — **say so explicitly, name every test you could not verify, and do not describe anything as verified.** An honest "I could not run this" is worth more than a confident summary of an imagined run.

## Step 3 — Classify every failure

Every red test falls into exactly one of these, and the classification decides what happens next:

| Class | Signal | Action |
|---|---|---|
| **Spec/code mismatch** | Expected value traces to the description; the code produces something else | **Leave red.** This is a finding: the code may not implement the described behavior. Report it prominently. |
| **Not implemented yet** | BDD mode — the production code does not exist | Expected. Report as pending, not as a defect. |
| **Test defect** | The test's setup, wiring, or assertion is wrong; the code is right | Fix the test |
| **Environment** | Missing dependency, unavailable service, config | Report; do not paper over it with a skip |
| **Pre-existing failure** | Also fails on a clean checkout | Report as pre-existing and out of scope. Verify with `git stash` or a clean tree before claiming it. |

**Do not resolve a spec/code mismatch by changing the test.** Weakening an assertion to reach green converts the most valuable output of this whole pipeline into a green checkmark that means nothing. If you genuinely cannot tell whether the description or the code is right, that is a question for the user, presented with both sides quoted.

Report mismatches like this: the behavior ID and its anchor quote, what the description says should happen, what the code actually does, and the test and line that shows it. That is enough for someone to decide whether it is a bug or a stale ticket.

## Step 4 — Confirm the tests can fail

A green test never observed red may be asserting nothing. Confirm each new test's red from the **test side** — change the expected value to something wrong, run, confirm it fails for the reason you expect, restore. Never mutate production code to force a red.

If the authors already did this and provided the evidence, do not repeat all of it; spot-check the ones most likely to be vacuous: tests with a single boolean assertion, tests with heavy doubles, tests over collections, and any test whose setup is much longer than its assertion.

## Step 5 — Report

```markdown
## Verdict
<Does the described behavior appear correctly captured in the code? One paragraph.
 If tests are red because the code disagrees with the description, lead with that.>

## Behavior coverage
| Behavior | Status | Tests | Notes |

## Spec/code mismatches — the code may not do what was described
| Behavior | Description says | Code does | Test |

## Tests written
| Case | Behavior | File | Test name | Confirmed able to fail |

## Suite run
Command: <exact command>
Result: <pass/fail counts>
Pre-existing failures: <or none>

## Not verified
<Every test not actually run, and why>

## Open questions and unresolved conflicts
<Register questions the user never answered; conflicts with existing tests still outstanding>

## Deviations from the plan
<Cases not written, cases changed, and why>
```

## Honesty Rules

These are the rules that make the report usable. Breaking any one makes the whole run worthless, because the user's only alternative is to re-verify everything themselves.

- **Never call a test verified that you did not run.** Not "should pass," not "passes" — ran, with output.
- **Never report a spec/code mismatch as a test defect** to make the run look clean.
- **Never hide a case you skipped.** Deviations get their own section.
- **Do not manufacture findings.** If coverage is complete and the suite is green for the right reasons, say that plainly.
- **Distinguish confirmed from suspected.** A test you read and believe is vacuous, but did not execute, is a candidate — label it.
- **State the residual risk.** Which described behaviors are now genuinely protected, and which are only nominally covered — for example a behavior whose boundary the user never settled, tested on one side of a guess.

## Closing the Loop

Before finishing:

1. **Answered register questions become spec.** If the user resolved boundary questions at the plan gate, the spec should show them as `stated` — the artifact should be re-readable later as the record of what was agreed.
2. **Unresolved questions carry forward.** List them in the report; they are the highest-value follow-up.
3. **Offer to save the plan and spec into the repo.** They are the justification for the suite's shape, and worth keeping if the tests will be reviewed.
4. **Do not commit unless asked.** If the user does ask, keep it atomic and conventional: `test:` for the tests, a separate `refactor:` for any seam, and never fold a production change into the test commit.
