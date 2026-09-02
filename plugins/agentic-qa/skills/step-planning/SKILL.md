---
name: step-planning
description: Use when turning a resolved behavior spec into an ordered, executable step plan — spawning agentic-qa:step-planner to draft it and agentic-qa:step-plan-critic to pair with it live. Governs surface selection (browser vs. API vs. CLI), the reversibility and containment classification, blocked/cascade marking, and the Critique Exchange log. Invoked by /agentic-qa:walkthrough between Extract Behaviors and the User Gate.
---

## Overview

This is Phase 2: turning the resolved `behavior-spec.md` into `step-plan.md` — one step per behavior from the acceptance criteria, and one per `Added` row still marked `included`. This is mechanical, not a judgment call this phase makes; whether an `Added` row survives is the User Gate's decision, made later.

**Orchestrator-owned steps:** spawning both agents and enforcing the round cap, same division as `agentic-qa:behavior-coverage`.

## Step 1 — Spawn the drafter

Spawn `agentic-qa:step-planner` with the absolute paths to `behavior-spec.md` and `intake.md`. It writes real actions against the real target host from `intake.md`'s facts, not abstract ones.

**Surface selection** — the point of a live walkthrough is confirming the real user-facing path works, not proving logic correctness cheaply, so this inverts the usual "cheapest scope" instinct:

1. Default to wherever a real user actually meets the behavior — browser (or CLI, for a CLI-facing tool) over a direct API call. A browser check also confirms the surface is actually wired up; an API-only check would pass even if the button were broken.
2. Add a second, deliberate API step **alongside** the user-facing one — not instead of it — whenever the UI's own behavior could mask a backend gap. Client-side validation blocking an invalid value is exactly this case: the browser step proves the UI rejects bad input, the API step proves the backend independently enforces the same rule. Carry a one-line `Rationale` for this step so a reviewer doesn't wonder why one behavior produced two steps.
3. A behavior that's purely about what's rendered — an error message's wording, a loading state — has no API equivalent and stays browser-only.

**Reversibility and containment** — every step that would have a real-world side effect gets two grounded classifications, not one:

- **Reversibility:** `reversible` | `irreversible`.
- **Containment** (required if irreversible): `contained` (effect stays inside the target environment and test account) or `escapes` (reaches something real outside it — a real email, SMS, payment, or shared resource). Ground the call in the actual API contract, the code path, a doc, or `intake.md`'s `Isolation` claim.

**Blocked steps** — a behavior resting on an unanswered `Unspecified` question or an unresolved `Conflict` doesn't get a guessed action. Mark its step `Status: blocked`, with the specific register/conflict number it's waiting on, and cascade that same status to any later step whose `Depends on` traces back to it — never run a step on a missing value.

## Step 2 — Spawn the critic and start the pairing

Spawn `agentic-qa:step-plan-critic` with the absolute paths to the draft `step-plan.md` and `behavior-spec.md`. Its charter:

1. Steps that don't actually verify their claimed behavior, grounded against `behavior-spec.md`.
2. **Traceability completeness** — every behavior from `behavior-spec.md`, stated or an included `Added` row, appears somewhere in `step-plan.md`: as a step, or explicitly in `Out of scope` with a reason. A silent omission is a defect, not a gap to assume was intentional.
3. **Surface-choice fit** — a browser step for something purely backend (inflation), or an API-only step for something only observable in the rendered UI (deficit).
4. **Two grounded calls on every irreversible step** — whether it's irreversible at all, and whether it's `contained` or `escapes`. Both must cite something concrete; "this looks safe" is never sufficient. A hardcoded production mail relay is `escapes` even if `intake.md`'s isolation claim said sandboxed.

**Live pairing, same as Phase 1:** relay findings via `SendMessage` to `agentic-qa:step-planner` rather than editing `step-plan.md` yourself. Log every round in `step-plan.md`'s own `Critique Exchange` section. Round cap: two, same early-exit rule — "no material findings" is valid and expected.

## `step-plan.md` format

```markdown
# Step Plan: <title>

**Behavior spec:** <path>   **Intake:** <path>
**Pre-authorized (contained/irreversible):** yes — granted at User Gate | yes — granted in brief | no

## Traceability
| Step | Behaviors | Action | Surface | Reversibility | Status |
|---|---|---|---|---|---|
| S1 | B1 | … | api | reversible | ready |
| S2 | B3, B4 | … | browser | irreversible, contained — <citation> | ready |
| S3 | B5 | … | api | irreversible, escapes — <citation> | ready |
| S4 | B6 | — | — | — | blocked — Unspecified Q2 |
| S5 | B7 | … | api | — | blocked — depends on S4 |

## Step detail
### S1 — <short name>
- **Behaviors:** B1
- **Surface:** api
- **Action:** <concrete action, using intake.md's target facts>
- **Expected:** <pass criterion, traced to the behavior's Then clause>
- **Reversibility:** reversible | irreversible
- **Containment:** contained | escapes (required if irreversible)
- **Basis:** <API/code/doc citation> (required if irreversible)
- **Depends on:** <a prior step's output, if any>
- **Rationale:** <only for a deliberate API-bypass step alongside a browser one>
- **Status:** ready | blocked — <Unspecified/Conflict # or "depends on step N">

## Out of scope
- <behaviors deliberately not walked through, and why>

## Critique Exchange
### Round 1
**step-plan-critic:** <finding>
**step-planner:** <accepted and revised, or rejected with a reason>
### Round 2 (if any)
…
```

Hand `step-plan.md`'s absolute path to the User Gate once the pairing settles — that gate resolves every `blocked` status and the `Added`-row strikes; this phase never asks the user anything directly.
