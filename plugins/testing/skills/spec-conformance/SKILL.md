---
name: spec-conformance
description: Use when checking whether code that was written or pushed actually does what its description said — comparing a PR, branch, or commit range against the ticket, issue, or acceptance criteria that specified it, and returning a per-behavior verdict with code citations rather than a test suite. Answers "does this PR still match the ticket." Invoked by /spec-conformance; distinct from /test-review, which audits test quality, and /test-write, which writes tests for a description.
---

# Checking Code Against the Description That Specified It


**Reference paths.** This skill ships no `references/` directory of its own — every `references/…` named below belongs to the **`testing:testing`** skill, which must be loaded alongside it — the bare name `testing` does not resolve.

## Overview

This answers a reviewer's question, not a test author's: **for each behavior the description states, does the code implement it, contradict it, or ignore it?**

The `/test-write` pipeline reaches the same central finding — its `spec/code mismatch` class in `spec-test-verification` is exactly this — but only after extracting a spec, planning coverage, writing tests, and running them. That is the right cost when you want the tests. It is the wrong cost when you want the answer, and it cannot answer at all for behavior nobody would reasonably write a test for: an error message that must name the offending field, an ordering guarantee in a log, a rejection reason surfaced to the caller.

## What This Cannot Tell You

Three limits, in the order they are likely to bite. **State all three in every report** — a reader who takes a verdict at face value is relying on limits they cannot see.

1. **Whether the description was right.** This compares code to a specification. A change that faithfully implements a bad ticket conforms.
2. **Whether a verdict is trustworthy at all.** The core output is a judgment about whether code satisfies a sentence, and a model handed a ticket and a diff can construct a plausible story for either answer. The evidence requirements, the citations, and `undeterminable` are the designed defenses against that, and **they have not been measured** — see `references/sources.md`. Nothing here makes a verdict as strong as an executed test.
3. **Whether an `absent` is real.** A false `absent` is the most likely way this procedure produces a wrong answer, because behavior satisfied by pre-existing code that the change merely calls looks identical to behavior that was never implemented.

## The Discipline This Rests On

The plugin's governing rule looks violated here — this procedure must read the implementation. It is not violated, and understanding why decides whether the output is worth anything.

> **The rule is about sequencing, not abstinence.**

Extract the behaviors from the description and freeze them *before* opening any code. Then read the code and judge against a specification that could not have been influenced by it. This is the same Lane A → Lane B ordering `/test-write` uses; recon there already reads the implementation under exactly this protection.

The failure mode this prevents is specific and seductive: read the diff first, then extract "the behaviors," and every behavior you extract will be one the diff satisfies. The check returns `conforms` every time and means nothing. **A spec revised after the code is read is not a spec.**

So: after Phase 1, behaviors that came from the description are immutable. Later phases may *add* `observed` behaviors — things the code does that nobody described — but may not edit, soften, reinterpret, or delete a described one.

## Phase 1 — Extract, Blind

Load the `testing:behavior-extraction` skill and follow it exactly. Nothing here changes: numbered behaviors in Given/When/Then, verbatim anchors, confidence levels, the unspecified-behavior register, vocabulary, non-goals.

Two notes specific to this command:

- **Reuse a spec if one exists.** If `/test-write` already ran against this ticket, its `behavior-spec.md` is the same artifact. Reuse it and say so. Re-deriving invites a second, subtly different specification.
- **The register matters more here than anywhere else.** In `/test-write` it produces questions for the user. Here it produces a checklist against the code: every open boundary is a place the implementation had to pick a side without being told which. See Phase 3.

## Phase 2 — Locate, Without Judging

Read the diff. Then follow into the surrounding code.

Spawn read-only `Explore` agents to answer: *what code, if any, implements `Bn`?*

**Batch behaviors across agents rather than spawning one per behavior**, and cap the fan-out at four or five. A real ticket yields fifteen to thirty behaviors, and the authoring step in `spec-test-writing` already establishes why unbounded fan-out is a false economy: coordination and review cost exceed the parallelism gain. Group by subsystem where the spec suggests one, otherwise roughly five behaviors per agent.

Give each agent its behaviors in full with their anchors, and this instruction verbatim:

> *Report where the behavior is or is not implemented, with file and line. Do not judge whether it is correct — that is not your output. If the behavior is implemented partly here and partly elsewhere, say so and name both.*

Record `locations.md`: behavior ID → `file:line`, or an explicit *nothing found, searched X*.

**Locating and judging are separate phases on purpose.** Doing both at once produces verdicts that arrive with their evidence assembled to fit, which is how a model reading a diff talks itself into any conclusion. Cite first; judge second.

### The diff is not the system

A small PR can satisfy a described behavior entirely through code that already existed and is now merely wired up, configured, or called. A check that reads only the diff will report `absent` for behavior that is correctly implemented.

**This is the most likely way this procedure produces a wrong answer.** Before any `absent` verdict, search the repository, not the diff, and record what you searched.

The mirror case is worth naming too: a behavior the description states was *already* implemented before this change. That is `conforms`, not `absent`, and the report should note that the change did not introduce it.

## Phase 3 — Adjudicate

Exactly one verdict per behavior, and every behavior appears in the report. Each verdict has an evidence requirement, and **a verdict whose evidence you cannot supply falls back to `undeterminable` with the reason — never to silence, and never to the stronger claim with the requirement quietly relaxed.**

| Verdict | Meaning | Requires |
|---|---|---|
| `conforms` | Implemented as described | The `file:line` implementing it |
| `contradicts` | Implemented, but differently than described | Anchor quote, code location, and what the code does instead |
| `absent` | Nothing implements it | Where it would belong, and the searches you ran that did not find it |
| `partial` | Some described cases handled, others not | Which are handled, which are not, each named |
| `undeterminable` | Reading cannot settle it | Why, and what would settle it |

Two notes on that table, both of which earlier drafts got wrong:

**`undeterminable` is always reachable**, because its requirement is one you can always meet. It is the floor of the ladder, not an escape from it. Dropping a behavior out of the report entirely would hide it — the same silent-omission defect the per-behavior table exists to prevent.

**`absent` cannot require proof of nonexistence.** No search establishes that code does not exist somewhere in a repository. What it requires is the search log: the queries you ran, and where. If the search space could not be covered — a large repo, dynamic dispatch, generated code, configuration-driven wiring — the honest verdict is `undeterminable`, not `absent`.

`undeterminable` is the honest answer when the outcome depends on runtime state, configuration, an external service, or code paths the change does not reveal. **Use it freely.** It is this command's form of the convention `/test-review` uses (`confirmed` / `unverified — requires running`) and `/test-audit` uses ("not measured"), and a report without any is more suspicious than one with several — this command's output is *claims about code*, and overstating certainty is precisely how it becomes worthless.

Report a contradiction in the shape `spec-test-verification` already uses, so the two commands name one finding the same way: the behavior ID and its anchor quote, what the description says should happen, what the code actually does, and the location that shows it.

**Never resolve a contradiction by deciding the ticket is stale.** That is frequently the right conclusion and it is never yours to draw. Quote both sides; the user decides whether the code is wrong or the description is out of date.

### Two sweeps a plain code review cannot do

Having a frozen specification makes both of these possible, and they are where this command earns its place next to ordinary review.

**1. Undescribed changes.** Behavior in the diff that no part of the description covers. Each is an `observed` behavior — record it with its code location, per the `testing:behavior-extraction` skill's "When a Behavior Came from the Code."

Do not call these defects. They are one of: deliberate scope creep, an unrelated fix riding along, refactoring with no behavior change, or a bug. Report what the code does and let the user classify. Filter out pure refactoring — a rename or an extracted method that changes no observable behavior is not an undescribed change and reporting it as one is noise.

**2. Questions the change answered silently.** Walk the register against the code. Where the description left something open and the implementation picked a side, report the register question, the side chosen, and the location:

> *The ticket says "cancellations more than 24 hours ahead are refunded" and never settles the boundary. `BookingPolicy.cs:88` treats exactly 24:00:00 as not refundable. Was that intended?*

Nobody wrote that rule down, so no reviewer is checking it and no test is pinning it. This is often the highest-value output of the entire run.

## Phase 4 — Corroborate

Detect the runner and its command from the repository's configuration. Identify which existing tests cover each behavior and **run those tests, not the whole suite.**

The scope is deliberate. `spec-test-verification` runs everything because it has just written tests and may have broken something. This procedure writes nothing, so a full run costs time and pulls unrelated pre-existing failures into a report about one change. Fall back to a broader run only if targeted selection is impossible, and say which you did.

Assign every verdict an evidence tier:

| Tier | Meaning |
|---|---|
| `tested` | A test covers this behavior and was executed; give the result |
| `read` | The verdict comes from reading code only |
| `untested` | No test covers this behavior at all |

Executing tests does not upgrade every verdict — only the covered ones. Say which behaviors the run actually covered rather than implying the whole spec was corroborated because the command exited zero.

`untested` is a finding, not an absence of one. A behavior that conforms with no test covering it names exactly where `/test-write` should be pointed.

**A passing test does not prove `conforms`.** It proves a test that claims to cover the behavior passes. If that test's expected values were themselves read out of the implementation — the defect `/test-review` and `test-code-critic` exist to catch — it corroborates nothing. Where a behavior's only evidence is a test whose assertion does not match the behavior's `Then` clause, say so and treat the verdict as `read`.

If the suite will not run, mark every affected verdict `read`, name what could not be executed, and continue. Never describe a test as passing that you did not run.

## Phase 5 — Report

```markdown
## Verdict
<Does the pushed code do what was described? One paragraph, contradictions first if any exist.>

## Behavior conformance
| Behavior | Verdict | Evidence | Location |

## Contradictions — the code disagrees with the description
| Behavior | Description says | Code does | Location |

## Absent — described, not implemented
| Behavior | Anchor | Where it would belong | Searched |

## Undescribed changes
| Code location | What it does | Nothing in the description covers it |

## Questions the change answered silently
| Register question | Side the code chose | Location |

## Test corroboration
Command: <exact command>
Result: <pass/fail counts>
Behaviors actually covered: <IDs>
Behaviors with no test: <IDs>

## Compared against
Base: <stated plainly>
Not examined: <anything out of scope, and why>

## What this check cannot tell you
- Whether the description itself was right. Faithful implementation of a bad ticket conforms.
- Whether these verdicts are trustworthy: they are readings of code, not executed results,
  except where marked `tested`. The defenses against a confident wrong reading are designed
  but unmeasured.
- Whether an `absent` is real. Behavior satisfied by pre-existing code the change merely
  calls looks identical to behavior never implemented.
```

**The three limits are not optional boilerplate.** They are the difference between a report a reader can calibrate and one they take at face value.

End with the two or three things most worth acting on, ranked.

**If the code conforms, say so plainly.** A conformance check that never returns a clean result is not a check; it is a finding generator, and users learn to discount it in about two runs.

## Honesty Rules

- **Never state a verdict without its evidence.** The requirement per verdict is in the Phase 3 table. Fall back to `undeterminable` with the reason — never drop the behavior, and never relax the requirement to keep the stronger verdict.
- **Never revise a described behavior after reading code.** Add `observed` ones; change nothing extracted in Phase 1.
- **Never report `absent` from the diff alone.** Search the repo and record what you searched.
- **Never describe a test as passing that you did not execute.**
- **Never decide the description is stale.** Report both sides.
- **Say what you did not examine** — files out of scope, tests that would not run, behaviors whose outcome depends on something you could not observe.

## Anti-Patterns

| Anti-pattern | Why it fails | Instead |
|---|---|---|
| Extracting behaviors after reading the diff | Every behavior you find is one the diff satisfies; the check returns `conforms` and means nothing | Freeze the spec in Phase 1, before any code |
| `absent` from the diff alone | Behavior implemented by pre-existing code the change now calls gets reported as missing | Search the repository; record what you searched |
| A verdict with no citation | Unfalsifiable, and indistinguishable from a plausible guess | Fall back to `undeterminable` and say what would settle it |
| Dropping a behavior that could not be adjudicated | Silent omission — the reader cannot see what you failed to judge | Every behavior gets a row; `undeterminable` is the floor |
| `absent` claimed as proof of nonexistence | No search establishes that code exists nowhere | Report the searches you ran; if the space could not be covered, `undeterminable` |
| Certainty everywhere | The output is claims about code, not executed results; a report with no `undeterminable` is overstating | Use `undeterminable` freely and say what would settle it |
| Treating a green test as proof of conformance | The test may assert something other than the behavior, or its expected value may have come from the code | Check the assertion against the `Then` clause; downgrade to `read` if it does not match |
| Reporting refactoring as an undescribed change | Renames and extractions change no observable behavior; reporting them buries the real findings | Filter to observable behavior |
| Declaring the ticket stale | Frequently correct, never yours to decide | Quote both sides; the user calls it |
| Running the whole suite | Imports unrelated pre-existing failures into a report about one change | Run the tests covering the described behaviors |
