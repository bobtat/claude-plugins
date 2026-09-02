---
name: behavior-coverage
description: Use when turning a validated ticket into a behavior spec for a live walkthrough — spawning agentic-qa:behavior-extractor to draft it and agentic-qa:behavior-coverage-critic to pair with it live, arguing findings out directly rather than reporting back. Governs the grounding split between what the acceptance criteria asked for and everything else, the round cap, and the Critique Exchange log. Invoked as the Extract Behaviors phase by /agentic-qa:walkthrough, between Intake and Plan Steps.
---

## Overview

This is Phase 1: turning `intake.md`'s validated ticket into `behavior-spec.md`. It models a QA engineer's actual working knowledge, not a developer's — reasoning from the acceptance criteria and whatever docs were given, never from code. The plugin's edge over a human QA process lives entirely in the critic, which does read code, specifically to find what the ticket never called out.

**Orchestrator-owned steps:** spawning both agents and enforcing the round cap. Neither agent has `AskUserQuestion`; nothing here reaches the User Gate directly.

## Step 1 — Spawn the drafter

Spawn `agentic-qa:behavior-extractor` with the absolute path to `intake.md`. Its entire input is that file's `Ticket` and `Docs` fields — no `Diff`, no environment, no credentials, nothing else. It follows `testing:behavior-extraction` to draft a numbered Given/When/Then behavior spec, each behavior anchored to a quote from the ticket.

The grounding model is two categories, not the four-tier confidence ladder `testing:behavior-extraction` uses elsewhere in this repo:

- **From the acceptance criteria** — literal or a direct implication of it (`"implied by: <quote>"` if not verbatim). Not strikeable; it's what was actually asked for.
- **`Added`** — grounded in something outside the acceptance criteria: a doc, a related ticket, or (from the critic) the PR diff. Strikeable later, at the User Gate — starts `included` by default, becomes `dropped` only if struck.

A doc that actively disagrees with the acceptance criteria goes in `behavior-spec.md`'s `Conflicts` section rather than being silently picked one way — the drafter does not resolve it; it carries forward for the User Gate.

## Step 2 — Spawn the critic and start the pairing

Spawn `agentic-qa:behavior-coverage-critic` with the absolute path to the draft `behavior-spec.md`. It reads the PR's diff — always available, since Intake requires a merged PR — and argues two things:

1. **Blast radius** — behaviors the ticket never called out but the change plausibly affects, each requiring a real code-location citation.
2. **Citation audit** — does each of the drafter's own `Added` rows actually say what it claims, not just whether a citation exists.

A finding about the ticket's own clarity (an ambiguous criterion, no stated pass/fail) doesn't need a separate citation — the ticket text is already the artifact being critiqued.

**This is a live pairing, not a report-back.** Relay the critic's findings to `agentic-qa:behavior-extractor` via `SendMessage` rather than editing `behavior-spec.md` yourself — the agent that reasoned through why it wrote a behavior a certain way is better positioned to revise it correctly than an orchestrator reconstructing intent from the file. Log every round in `behavior-spec.md`'s own `Critique Exchange` section as it happens: what was raised, how it was answered.

**Round cap:** two rounds at most. Re-run only if a behavior or an `Added` row actually changed as a result of the previous round — a reworded justification or an accepted-but-unchanged finding is not grounds for another round. "No material findings" is a valid and expected terminal result, not a failure to look hard enough.

## `behavior-spec.md` format

```markdown
# Behavior Specification: <title>

**Ticket:** <key/URL>   **PR:** <#, merged>
**Benefit:** As a <role> I want <capability> so that <benefit>

## Vocabulary
| Term | Meaning in the ticket |
|---|---|

## Behaviors — from the acceptance criteria
### B1 — <short declarative name>
- **Given** … **When** … **Then** …
- **Anchor:** "<quote>" — or "implied by: <quote>" if not verbatim

## Unspecified — needs an answer before these become steps
| # | Question | Affects | Options |
|---|---|---|---|

## Conflicts — doc/ticket disagreement
| Behavior | Ticket says | Doc says | Needs a decision from |
|---|---|---|---|

## Added — grounded beyond the acceptance criteria
| ID | Behavior | Added by | Citation | Resolution |
|---|---|---|---|---|
| A1 | … | behavior-extractor (doc) | <url> | included |
| A2 | … | Coverage Critic | <file:line> | included |

## Non-goals
- <explicitly out of scope>

## Critique Exchange
### Round 1
**Coverage Critic:** <finding>
**behavior-extractor:** <accepted and revised, or rejected with a reason>
### Round 2 (if any)
…
```

Every behavior from the acceptance criteria and every `Added`/`Unspecified`/`Conflicts` entry gets resolved or explicitly carried to the User Gate — nothing gets silently dropped. Hand `behavior-spec.md`'s absolute path to Phase 2 (`agentic-qa:step-planning`) once the pairing settles.
