---
name: behavior-extraction
description: Use when turning a described behavior — a JIRA ticket, a GitHub PR or issue, a spec document, or free-form text — into a structured, testable behavior specification before any test is planned or written. Produces numbered behaviors in Given/When/Then anchored to quotes from the source, plus an explicit register of what the description leaves unspecified. Invoked by /test-write; also useful on its own when acceptance criteria need to be pinned down before work starts.
---

# Extracting a Behavior Specification

## Overview

This is the step that makes spec-driven testing possible. The output is an **oracle**: a statement of what the system should do, derived from what someone said it should do, written before any implementation is read.

The whole discipline rests on one rule:

> **Read no production code during extraction.** Not the diff, not the handler, not the file the ticket names.

This is not squeamishness. The moment you read the implementation, every later "what should this return?" gets answered by what it *does* return, and the resulting tests can only confirm the code does what it does. The description is the only admissible source. Where it is silent, the answer is a question for the user — and that silence is itself a deliverable (the register below), not a gap to fill in quietly.

Given/When/Then, the story template, declarative phrasing, and ubiquitous language are covered in the `testing` skill's `references/bdd.md`. Read it if you have not; this file is the procedure that consumes it.

## Intake

| Source | How to read it | Watch for |
|---|---|---|
| Free-form text or a spec file | Directly | Mixed levels: a paragraph of behavior wrapped in implementation instructions. Extract only the behavior. |
| GitHub issue | Title, body, and the acceptance-criteria checklist if present | Behavior settled in the comment thread that never made it into the body |
| GitHub PR | Title, body, **and the linked issue** | **Not the diff.** See below. |
| JIRA / tracker ticket | Summary, description, acceptance criteria field | Criteria in attachments or linked sub-tasks; a "Definition of Done" that mixes process with behavior |
| Conversation context | Reconstruct, then **show it back and get confirmation** before proceeding | Behavior you inferred rather than heard |

**The PR case deserves its own warning.** A PR contains a description *and* the code that claims to satisfy it. Extract only from the description and any linked issue. If the description is just "implements ABC-123," go get ABC-123. If it is empty, say so and ask — a PR whose only specification is its own diff cannot be tested against a specification, and writing tests from the diff produces a suite that ratifies whatever was written, bugs included.

## The Extraction Procedure

### 1. Find the benefit

Before listing anything, state who wants this and why, in one sentence. The story template (`As a … I want … so that …`) is a filter, not a ceremony — but the *so that* clause is what tells you which outcomes matter. A refund story is about money moving, not about a button existing. If the description cannot support a benefit clause, ask the user what the point of the change is; that answer usually reorganizes the whole behavior list.

### 2. List candidate behaviors

Sweep the description for anything that asserts what the system does. Sources, roughly in order of reliability:

- Explicit acceptance criteria or a checklist
- Sentences with modal verbs — *should*, *must*, *will*, *cannot*, *is not allowed to*
- Rejections, validations, and error cases stated anywhere in prose
- Stated limits, thresholds, and defaults
- Screenshots, tables, and example payloads — often the only place a concrete expected value appears
- Non-functional statements with an observable outcome (a timeout, a retry count, an ordering guarantee)

**Rejection and error behaviors are behaviors.** Descriptions bury them in prose while stating the happy path as a bullet, and extractions routinely drop them. Sweep for them deliberately.

### 3. Split until each behavior has one trigger

One `When` per behavior. A sentence needing "and" between two events is two behaviors. A sentence needing "and" between two outcomes of the same event is usually one behavior with a compound `Then` — keep it together only if the outcomes are genuinely inseparable (a state change and the event it emits); split it if they can fail independently.

Write each declaratively, in the domain's vocabulary:

- `When the customer cancels 3 days before the class` — not `When the user clicks Cancel and confirms the dialog`
- `Given the booking was paid in full` — not `Given a row in bookings with status='PAID'`

Imperative phrasing encodes mechanism into the specification. It also quietly picks a test scope: a `When` written as clicks forces a UI test for a rule a unit test could pin down.

### 4. Assign IDs, anchors, and confidence

Every behavior gets a stable ID (`B1`, `B2`, …) that the test plan, the test names, and the final audit all reference. Every behavior gets an **anchor** — a short verbatim quote from the source — and a **confidence**:

| Confidence | Meaning | Consequence |
|---|---|---|
| `stated` | The description says this outcome, in words | Test it |
| `implied` | Follows necessarily from something stated (a stated maximum implies rejection above it) | Test it; note the inference in one line |
| `inferred` | Reasonable, standard, probably wanted — but nobody said it | **Goes to the user before it becomes a test.** Never silently promoted. |
| `observed` | Nobody described it — you read it in the implementation | **No oracle.** Cannot become a correctness test. See below. |

`inferred` is where fabricated specifications enter. Anything you "know" a system like this should do — audit logging, idempotency, rate limits — is `inferred` until someone confirms it. Being right about it does not make it stated.

`observed` is a different kind of label entirely, and it has its own section below. Read it before using it.

### 5. Name the observable outcome

For each behavior, write what a caller could actually observe: a return value, a state change visible through the public surface, an emitted event, a rejection with a specific reason, a message sent across a real boundary. This is what makes the behavior testable at all, and it is what the plan uses to choose scope.

If the only observable you can name is "an internal method gets called," the behavior is stated at the wrong altitude — step back to the caller.

### 6. Build the unspecified-behavior register

This is a primary output, not an appendix. For each behavior, ask what the description does not say:

- **Boundaries.** "Within 24 hours" — is exactly 24 hours in or out? Off-by-one bugs live almost entirely here, and descriptions almost never say.
- **Absence and emptiness.** Null, missing, empty collection, zero.
- **Concurrency and repetition.** What if it happens twice? Simultaneously?
- **Failure of a dependency.** The description assumes the payment provider answers. What if it times out?
- **Precedence.** Two stated rules that can both apply to one input — which wins?
- **Units, precision, rounding, timezone.** A money or time behavior with no rounding rule is unspecified.
- **Authorization.** Who is allowed to trigger this?

Write each as a direct question with the options you can see. `"Cancellation more than 24 hours ahead is refunded" — is a cancellation at exactly 24:00:00 refunded? (a) yes, boundary inclusive (b) no, strictly more than.` These become the questions asked at the plan-review gate, and each answer becomes a `stated` behavior.

A register that comes back empty means the extraction was shallow. Real descriptions leave boundaries open; go back and look again.

### 7. Record vocabulary and non-goals

- **Vocabulary** — the domain terms the description uses and what each means. Tests get named in these words. Where the description's word and the codebase's word differ, note both; recon will confirm which the suite uses, and the mismatch is worth telling the user about.
- **Non-goals** — anything the description explicitly excludes, defers, or marks out of scope. Writing these down stops the planner from inventing coverage for them and stops the final audit from reporting them as gaps.

## When a Behavior Came from the Code

`observed` is not a fourth rung on the same ladder. `stated`, `implied`, and `inferred` measure distance from the description, and all three keep the oracle independent of the implementation. `observed` breaks that axis: its source *is* the implementation, so a test built from it can only assert that the code does what it does — the exact circularity this pipeline exists to prevent.

That is why the label has to exist. An unlabeled implementation-derived behavior is indistinguishable from a `stated` one by the time it reaches an author, and every downstream phase trusts the label.

### Where it legitimately comes from

Extraction reads no production code, so this should be uncommon. It is not never:

- **Brownfield changes.** The description modifies part of a system whose surrounding behavior is documented only in code. That behavior still has to keep working, and the register cannot ask about what nobody knew to mention.
- **Recon comes back with answers.** Lane B reads the codebase and will surface behavior even when told not to report computed values as correct answers. `observed` is where that goes; the alternative is that it silently contaminates the spec or is thrown away.
- **The code answers a register question.** The description leaves a boundary open and the implementation picks a side. Recording which side is useful — as evidence for the user's decision, never as the decision.
- **You slipped.** You opened the handler before extraction was done. Labeling is the remedy; silence is not.

### The downgrade rule

**Confidence records where the expected outcome came from, not how sure you feel about it.** If you read the implementation and then wrote a number, a message, an ordering, or a boundary into a `Then` clause, that behavior is `observed` — even when the description mentions the behavior, even when you are confident the value is right.

A behavior labeled `stated` whose *outcome* was filled in from the code is the most dangerous artifact this phase can produce. It passes every downstream check by lying about its provenance.

An `observed` behavior anchors to a **code location** (`PricingService.cs:120-134`), not a quote. Name what you read so the user can check it.

### Three exits, and only three

| Exit | When | Result |
|---|---|---|
| **Promoted** | The user confirms the behavior is intended | Becomes `stated`, anchored to their confirmation. An ordinary test. |
| **Characterized** | It must keep working, but nobody can confirm it is *right* | A characterization test per the `testing` skill's `references/legacy-code.md` — named and commented as documenting current behavior, never presented as proof of correctness |
| **Dropped** | Incidental, or outside the change's blast radius | Listed in the report, not tested |

There is no fourth exit. An `observed` behavior does not become a correctness test by looking obviously right.

## Output Format

Write `behavior-spec.md`:

```markdown
# Behavior Specification: <title>

**Source:** <PR #123 / ABC-456 / file path / conversation>
**Benefit:** As a <role> I want <capability> so that <benefit>

## Vocabulary
| Term | Meaning in this description | Codebase term (from recon) |

## Behaviors

### B1 — <short declarative name>
- **Given** …
- **When** …
- **Then** …
- **Observable:** <what a caller can see>
- **Anchor:** "<verbatim quote from the source>" — or `<file>:<lines>` if `observed`
- **Confidence:** stated | implied | inferred | observed

### B2 — …

## Unspecified — needs an answer before these become tests
| # | Question | Affects | Options |
|---|---|---|---|

## Observed — read from the implementation, not described anywhere
| ID | Behavior | Code location | Proposed exit (promote / characterize / drop) |
|---|---|---|---|

## Non-goals
- <explicitly out of scope, with its anchor>
```

## Gate Before Leaving This Phase

Do not hand off until all four hold:

1. **No production code was read** — or everything it touched is labeled `observed` and listed in its own section. Reading code is recoverable; hiding that you read it is not.
2. **Every behavior has an anchor, or is labeled `inferred`.** No unattributed behaviors. An `observed` behavior's anchor is its code location.
3. **Every expected value traces to the description**, unless its behavior is labeled `observed`. No number in a `Then` clause that the source did not contain and the label does not account for.
4. **The register is non-empty**, or you can state why this description genuinely left nothing open.

## Extraction Anti-Patterns

| Anti-pattern | What it looks like | Instead |
|---|---|---|
| Reading the code "just to orient" | Opening the handler before extraction is done | Extract first; recon is a separate lane and runs after. If it already happened, label what it touched `observed` |
| Laundering an observation | A behavior read off the implementation written up as `stated` because the description happens to mention the topic | The description naming a behavior does not make it the source of the outcome — label `observed` |
| An `observed` behavior tested for correctness | A characterization finding turned into an ordinary assertion because it looks right | Promote it, characterize it, or drop it — nothing else |
| Silent inference | Standard behavior appearing as `stated` because it is obviously right | Label `inferred`, ask |
| Imperative scenarios | `When I click Save` | `When the order is submitted` |
| Restating the ticket | Behaviors that are the description's bullets copied verbatim | Behaviors are testable claims: trigger plus observable outcome |
| Implementation vocabulary | `When the OrderService handler executes` | Domain vocabulary; the handler is not a behavior |
| Compound behaviors | Two `When`s joined by "and" | Split |
| Dropping the sad paths | Only happy-path behaviors survive extraction | Sweep for rejections deliberately (step 2) |
| Empty register | No open questions on a real ticket | Look at boundaries, absence, precedence, and dependency failure again |
