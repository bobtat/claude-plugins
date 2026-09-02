---
name: agentic-qa
description: This skill should be used whenever running or invoking a live QA walkthrough — e.g. "walk through ticket ABC-123", "verify this PR works end to end against staging" — via the interactive /agentic-qa:walkthrough command, an agent-invoked run through agentic-qa:qa-runner, or a direct Skill call. Carries the safety posture, evidence discipline, and escalation mechanism shared across every phase of the pipeline — the umbrella rules the phase-specific skills assume are already loaded.
---

## Overview

A walkthrough tests finished functionality against a live system — a browser, an API, a CLI — the way a QA engineer would, not by writing test code. It is invoked two ways: interactively, via `/agentic-qa:walkthrough`, or agent-invoked, via `agentic-qa:qa-runner` or a direct `Skill("agentic-qa:agentic-qa")` call with a brief instead of a conversation. The pipeline does not change between modes. Only how a required human decision gets answered does.

This skill is the umbrella: load it once, at the start of a run, before any phase-specific skill. It does not describe the six phases — `agentic-qa:behavior-coverage`, `agentic-qa:step-planning`, `agentic-qa:step-execution`, and `agentic-qa:qa-reporting` each own their own phase. It describes what holds across all of them.

## The rules that hold everywhere

1. **Production is never a valid target.** Refused outright at Intake, no confirmation path, in either mode. This is not a tool for verifying production.
2. **Never run an irreversible step without a real decision behind it** — live, pre-authorized in advance, or escalated. Never inferred, never defaulted to "probably fine."
3. **Never adapt a step's action to force a pass.** A step that didn't work as planned may mean the feature is wrong, not the plan. Any deviation from the literal planned action is disclosed in `step-results.md`'s `Deviation` field, never silently absorbed into a clean verdict.
4. **Credentials never touch a file.** They stay in conversation context (interactive) or get resolved from an environment-variable reference at the moment of use (agent-invoked). `intake.md` and the brief both carry only references, never secrets.
5. **Every consequential claim is grounded, never asserted.** A behavior beyond the acceptance criteria, a reversibility call, a containment call — each cites something concrete: a doc, a ticket, code, an API contract. "This looks safe" is not a citation.

## Agent-invoked contract

No slash command is callable by another agent in this environment. An agent runs this pipeline one of two ways:

- **Directly**, holding `Skill`, `Bash`, `Read`/`Write`, the browser tools, `Agent`, and `SendMessage` — the last two are what make the live drafter/critic pairing and the escalation mechanism possible, not optional tooling — by calling `Skill("agentic-qa:agentic-qa")` and running the pipeline itself.
- **Via `agentic-qa:qa-runner`**, a self-contained wrapper for a caller without that toolset.

Either way, everything Intake would otherwise ask for arrives up front as a brief, and Intake validates it against the same gates `/agentic-qa:walkthrough` uses rather than asking:

```yaml
ticket: ABC-123
pr: 456
environment: staging
base_url: https://staging.example.com
test_account: qa-test-1
credentials: env:QA_API_TOKEN
browser_session: <path to a pre-established storage state, for SSO — omitted triggers escalation for a live login>
docs: [https://wiki.example.com/notifications]
isolation: sandboxed
pre_authorize_contained: true
report_destination: /shared/qa-reports/ABC-123
```

A brief that fails a validity gate triggers the same escalation as everything else that needs a human — see below — rather than erroring out and forcing the caller to reconstruct a new brief from scratch.

## Escalation: pause, notify, resume

Four situations can't proceed without a human. All four use one mechanism:

| Trigger | Stage | Mode |
|---|---|---|
| Brief fails a validity gate — thin ticket, PR not merged, target unreachable | Intake | Agent-invoked only — interactive just asks again live, Intake isn't a spawned agent |
| An irreversible step, `contained` or `escapes`, has no pre-authorization covering it | Execute Steps | Both — same mechanism either way |
| Browser session isn't authenticated and SSO/MFA needs a human to complete it | Execute Steps | Both |
| Backoff retry exhausted (four attempts) on an apparent environment failure | Execute Steps | Both |

The run pauses in place rather than terminating, and notifies via `SendMessage` — addressed to whichever session or agent directly invoked this one, the main or initial session, not a specific human or channel. What that session does with it differs by mode, not by mechanism: interactively, the orchestrator relays it straight into a live `AskUserQuestion`, since a person is already watching; agent-invoked, it's the caller's own judgment — relay to Slack, page someone, write to stderr, or nothing at all. This skill does not assume a channel exists, because it cannot know one does.

Once notified, wait — no built-in timeout. It is a blocking wait via `SendMessage`, not a poll loop, so there is no cost to waiting arbitrarily long, and `step-results.md`'s incremental writes mean nothing already completed is at risk if the surrounding environment's own timeout kills the process first. That is an external concern, outside this pipeline's scope, the same as the notification channel. Resuming continues from exactly where it paused; nothing is re-derived or re-run.

**What deliberately does not escalate:** a `blocked` step (an unresolved Unspecified question or Conflict) skips and cascades instead of pausing — the whole run pausing over one unanswered question would sacrifice everything else the plan could still verify unattended, for a question that risks nothing by waiting until the report is reviewed. A drafter/critic disagreement still open after the two-round cap gets logged in the `Critique Exchange`, visible for review, not escalated. Neither does a failed write to a configured report destination — the working-directory copy is always the real one.

## Irreversible step policy

An irreversible step is not one thing. Split it:

| Classification | Meaning | Can it be pre-authorized? |
|---|---|---|
| `contained` | Effect stays inside the target environment and test account — deleting a test order, resetting seeded data | Yes, as a single blanket grant covering every contained step in the run |
| `escapes` | Effect reaches something real outside that boundary — an email that actually delivers, a real payment, a shared or cross-team resource | Never. Always stops individually, in every mode, regardless of any grant |

`agentic-qa:step-plan-critic` makes this call, grounded against `intake.md`'s `Isolation` claim and the actual code — and can override the claim if the code disagrees; a hardcoded production mail relay is `escapes` even if the isolation claim said sandboxed.

The grant, when given, comes from one of two places and is recorded once, in `step-plan.md`'s header: interactively, a single choice at the User Gate covering the whole plan's `contained` steps; agent-invoked, the `pre_authorize_contained` field in the brief. Execute Steps checks that field rather than deciding for itself.

## Working directory and artifacts

Every phase hands off through files — pass absolute paths to every spawned agent, since they cannot see conversation context:

`intake.md` → `behavior-spec.md` → `step-plan.md` → `step-results.md` + `evidence/*` → `walkthrough-report.md` / `walkthrough-report.html`

See `agentic-qa:behavior-coverage`, `agentic-qa:step-planning`, `agentic-qa:step-execution`, and `agentic-qa:qa-reporting` for each file's exact schema and the phase that produces it.

## Namespacing

Every component this plugin ships is addressed as `agentic-qa:<name>`. There is no bare-name fallback — `Agent("step-executor")` does not resolve; `Agent("agentic-qa:step-executor")` does. If a skill will not load, say so and continue by following the procedure as published in this file rather than improvising from memory.
