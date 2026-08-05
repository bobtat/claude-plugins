---
name: test-planning
description: Use when turning a behavior specification and codebase recon into an approved test plan — choosing test cases and coverage depth per behavior, picking the right scope (unit, integration, contract, schema, property, UI, E2E), justifying every choice, running an adversarial critique of the plan, and reviewing it with the user before any test is written. Invoked by /test-write between extraction and authoring.
---

# Planning Spec-Driven Test Coverage

## Overview

The plan is a contract. Authoring implements it, verification audits against it, and the user approves it — so it has to be specific enough to disagree with. "Add tests for the refund rules" is not a plan. A numbered list of cases, each traced to a behavior ID, each with a scope and a stated reason, is.

Two properties make a plan worth reviewing:

1. **Traceability both ways.** Every behavior has at least one case; every case names the behavior it proves. A case with no behavior is scope creep or a fabricated requirement; a behavior with no case is a gap. Both are visible in one table.
2. **Justification, including for omissions.** Why these cases, why this scope, and — the part usually missing — which cases were considered and deliberately dropped. A plan that only lists what it will do hides its own weakest decisions.

Case-selection order, naming, and builders come from `references/test-design.md`. Scope selection comes from `references/test-scope.md`. The doubles gate comes from the `testing` skill itself. This file is the procedure that applies them to a behavior spec.

## Inputs

`behavior-spec.md` and `recon.md`. If either is missing, stop — planning from the description alone produces cases that cannot be placed in the suite, and planning from recon alone reproduces the implementation.

## Procedure

### 1. Reconcile with existing coverage

For each behavior ID, recon says whether a test already exists. Decide, per behavior, and record the decision:

| Finding | Decision |
|---|---|
| Covered, asserts the described outcome | **Leave it.** Cite file and test name in the plan. No new case. |
| Covered, but asserts something different from the description | **Flag as a conflict.** The existing test may encode the old behavior, or the description may be a change. This goes to the user — do not quietly overwrite either. |
| Covered, but the test is ineffective (no meaningful assertion, mocked to the point of vacuity) | **Replace**, and say why. |
| Partially covered — happy path only | **Extend** with the missing branches; do not restate the happy path. |
| Not covered | **New cases.** |

Conflicts are the highest-value output of this step. A described behavior that contradicts an existing green test means someone's understanding is wrong, and finding that before writing code is worth the whole exercise.

### 2. Choose cases per behavior

Work through `references/test-design.md`'s ordering for each behavior, stopping as soon as the next case exercises no new behavior:

1. **Happy path** — one case, realistic in the value the behavior turns on.
2. **Each rejection or error branch named in the description.**
3. **Boundaries** — empty, zero, one, exactly-at-limit, one-over, absent. **Where the description did not settle the boundary, the case is blocked on a register question** — carry it into the plan as blocked rather than guessing which side is correct.
4. **Distinct equivalence classes** — cases the description treats *differently*. Several values on one path are one table-driven case, not several cases.
5. **State-dependent behavior** — each prior state where the outcome differs.

Then state the **coverage depth** for the behavior and defend it in one line. The user asked for this justification explicitly, so make it real:

- **Happy path only** — legitimate for a behavior with no branches and no boundaries. Say that is why.
- **Happy + errors + boundaries** — the default for anything with a rule in it.
- **Exhaustive, including obscure cases** — reserve for behaviors where the cost of being wrong is high: money, permissions, data loss, anything irreversible. Name the reason.

And list, explicitly, the **cases considered and dropped** with the reason: no distinct behavior, framework responsibility, covered elsewhere, cost exceeds value. Reviewers cannot evaluate a plan whose omissions are invisible.

### 3. Choose scope per case

Cheapest scope that can genuinely observe the outcome named in the spec. Use the table in the `testing` skill, extended here for the levels beyond unit that a described behavior often demands:

| The described outcome is… | Scope | Why not cheaper |
|---|---|---|
| A rule, calculation, validation, or state transition | Unit (sociable — real collaborators) | Nothing cheaper exists |
| Persistence, query correctness, ORM mapping, transaction/rollback semantics | Integration, real database | A mocked DB tests string-building, not the query |
| An HTTP/GraphQL contract: routing, status, serialization, auth | Integration, in-process host | Serialization and routing are not observable below the boundary |
| A change to a published schema (GraphQL, OpenAPI, Avro, DB migration) | **Schema/snapshot test** on the schema artifact | Behavioral tests pass while a breaking schema change ships |
| Agreement with a service you do not control | **Contract test** against a recorded or verified spec | Your fake agreeing with itself proves nothing |
| An invariant stated over a range ("never negative for any input") | **Property-based test** | Example tests sample; the description quantified over everything |
| Something a user must *see* — layout, states, a11y, copy | **UI test**, and prefer component-level over browser-level | Not observable from the API |
| One critical path wired together for real | E2E — very few, money paths only | Wiring is the only thing E2E uniquely proves |

Two failure modes, and the critic checks both:

- **Scope inflation** — an E2E test for a rule a unit test pins down. Slow, flaky, and it fails for reasons unrelated to the rule.
- **Scope deficit** — a unit test that cannot observe the outcome the description names. A serialization requirement verified below the serializer proves nothing about the contract.

When acceptance criteria are stated in user-facing terms, the outside-in sequence in `references/bdd.md` applies: **one** outer test proves the wiring, and the remaining scenarios become fast unit tests against the rule. Do not turn five scenarios into five E2E tests.

### 4. Name doubles and new infrastructure

Per case, list any double with a one-line justification, applying the gate in the `testing` skill: which of the five doubles, and why neither a real instance nor a fake will serve. Default to the real collaborator, then to a fake. If a case needs more than two or three doubles, say so in the plan — that is a signal about production design, and the plan should name the production change rather than budgeting for the setup.

Separately, list **new test infrastructure** the plan requires: builders, fakes, fixtures, a harness, a container, seed data. This list is what Phase 4 builds first, serialized, before any author starts. Missing it here is what produces four agents inventing four different `OrderBuilder`s.

### 5. Write the plan

```markdown
# Test Plan: <title>

**Behavior spec:** <path>   **Recon:** <path>   **Depth:** light | full

## Traceability
| Case | Behavior | Name | Scope | Doubles | Status |
|---|---|---|---|---|---|
| T1 | B1 | rejects an order with no lines | unit | none | new |
| T2 | B1 | … | unit | fake clock | new |
| T3 | B2 | … | integration | — | extends `OrderApiTests` |
| T4 | B4 | … | unit | none | **blocked on Q2** |

## Coverage rationale
### B1 — <name>
- **Depth:** happy + errors + boundaries. **Why:** three guard clauses in the description and an inclusive/exclusive limit.
- **Dropped:** currency-conversion variants — no distinct described behavior.

## Existing coverage
| Behavior | Existing test | Decision |
|---|---|---|

## Conflicts with existing tests
| Behavior | Existing test asserts | Description says | Needs a decision from |

## New test infrastructure
| Item | Purpose | Used by |

## Open questions blocking cases
| # | Question | Blocks | Options |

## Out of scope
- <non-goals carried from the spec, and anything dropped wholesale>
```

Every behavior ID from the spec appears somewhere in this document — in traceability, in existing coverage, or in out-of-scope with a reason. Silent omission is the defect this format exists to make impossible.

## Adversarial Critique

Spawn the `test-plan-critic` agent with the plan, the behavior spec, and the recon. Its charter is fixed; a generic "review this" produces generic findings.

**The charter:**

1. **Oracle contamination.** Any expected value that came from the implementation rather than the description. Highest severity — these tests cannot fail.
2. **Fabricated requirements.** Cases with no behavior ID, or resting on an `inferred` behavior that the user has not confirmed.
3. **Missing behaviors.** Anything in the description with no case, and any rejection/error branch the extraction dropped.
4. **Missing boundaries.** Limits, empty/zero/one, absent — especially where the description was ambiguous and the plan quietly picked a side instead of blocking on a question.
5. **Scope inflation and deficit**, per the table above.
6. **Redundancy.** Cases duplicating existing coverage, or several cases on one code path that should be one table.
7. **Untestable-as-written cases.** A case whose expected value nobody can compute from the description, or whose outcome is not observable at the chosen scope.
8. **Testing the framework.** Cases that assert ORM, serializer, or language behavior instead of the described rule.
9. **Double overuse**, and where it signals production design rather than test design.

**Iteration rule:** address the findings, then re-run the critic **only if the plan changed materially**. Cap at two rounds. **"No material findings" is a valid and expected terminal result** — a critic on its third pass is inventing work to justify the round, and the churn costs more than it finds. Record findings you rejected, with the reason; a rejected finding the user disagrees with is exactly what the next gate is for.

## The User Gate

**Do not write a test before the user approves the plan.** This is the cheapest point in the pipeline to change direction, and the whole pipeline is downstream of decisions only the user can make.

Present, compactly:

1. **The behavior list**, in their words — the first thing to check is whether extraction understood the ticket at all.
2. **The traceability matrix** — cases, scopes, counts.
3. **The open questions** blocking cases. Use `AskUserQuestion` with the concrete options; these are usually boundary decisions with two answers.
4. **Conflicts** with existing tests, each needing a call.
5. **What is deliberately not tested**, and why.
6. **Cost** — roughly how many test files and how much new infrastructure.

Fold the answers into the spec (they become `stated` behaviors) and the plan (blocked cases unblock). If the answers change coverage substantially, show the revised matrix before proceeding — do not treat approval of the old plan as approval of the new one.

## Planning Anti-Patterns

| Anti-pattern | Why it fails | Instead |
|---|---|---|
| Cases derived from code structure | Produces one case per method and misses described behavior entirely | Cases derive from behavior IDs |
| Guessing an ambiguous boundary | The test then encodes a guess as a requirement | Block the case on a register question |
| A case per description bullet | Bullets are not behaviors; some contain three, some contain none | Trace to behavior IDs, not to prose |
| Coverage percentage as the goal | Manufactures assertions on lines nobody cares about | Depth justified per behavior |
| Every scenario becomes E2E | A slow, flaky suite that proves the wiring five times | One outer test, then inward |
| Omissions left unstated | Reviewers cannot evaluate what they cannot see | List dropped cases with reasons |
| Approval assumed | The most expensive rework happens after authoring | Hard gate before Phase 4 |
