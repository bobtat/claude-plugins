---
name: step-execution
description: Use when running an approved step plan against a live system — spawning agentic-qa:step-executor to drive the browser, API, and CLI. Governs the four verdicts (pass/fail/blocked/skipped), which evidence is required by surface, the backoff retry policy for environment failures, the irreversible-step check, and the rule against adapting an action to force a pass. Invoked by /agentic-qa:walkthrough after the User Gate, alongside agentic-qa:qa-reporting.
---

## Overview

This is Phase 4: running the approved `step-plan.md` one step at a time against the live system. Spawn `agentic-qa:step-executor` with the absolute paths to `step-plan.md` and `intake.md` — **spawn it alongside `agentic-qa:qa-reporter`, not before it**, since the report is built incrementally as steps complete, not assembled afterward. See `agentic-qa:qa-reporting` for that agent's half of the pairing.

This is the longest-running, most context-heavy stage in the pipeline, which is exactly why it is a spawned agent rather than main-thread work — the bulk of what it does (screenshots, response bodies, command output, tool-call history) should never accumulate in the thread that has to survive the whole session.

## Per-step loop

Before each step, read `step-results.md` for any output value an earlier step produced that this step's action depends on. After each step, append its own entry there — verdict, evidence path, outputs later steps might need — and send that same result to `agentic-qa:qa-reporter` via `SendMessage` so the report grows step by step.

### Evidence, fixed by surface, not judgment

- **browser** — a screenshot, every time, pass or fail, never skipped as unnecessary.
- **api** — the response body as text.
- **cli** — the command output as text.

No screenshot is expected or useful for an api/cli step. See `agentic-qa:qa-reporting` for how each renders in the final report.

### Four verdicts

| Verdict | When | What happens |
|---|---|---|
| `pass` | Observed matches Expected | Recorded, walkthrough continues |
| `fail` | Step ran; observed doesn't match Expected | Recorded with evidence, walkthrough continues — this is QA finding what it exists to find, not an interruption to it |
| `blocked` | Already marked so in `step-plan.md` — an Unspecified question or Conflict was never resolved | Never reached unresolved in interactive mode (the User Gate settles it first); agent-invoked, skip it and any step cascading from it, record the question, keep running the rest of the plan |
| `skipped` | A step this one depends on failed, so its output never existed | Cascades automatically; the `Reason` names the *specific* upstream failure, not just a step number — `skipped — depends on S2, which failed: SQS message contract mismatch (expected orderId, got order_id)` |

Every verdict cites the specific evidence backing it — never a bare "looks right."

### Environment failure — a fifth thing, not a verdict

A timeout, a connection reset, a 5xx gateway error, or the browser tool itself crashing isn't a finding about the feature — retry the identical action, not a different approach:

1. Retry immediately.
2. Retry after 30s.
3. Retry after 1 minute.

Three retries, four attempts total. If all four fail, this is a trigger for the escalation mechanism in `agentic-qa:agentic-qa` — pause and notify, don't keep "testing" against a target that isn't answering.

**This retry never applies to a step that completed and simply didn't match Expected.** A clean response with the wrong data is the finding, not a glitch to wait out — retrying that would reopen the false-pass door the next rule closes.

### Never adapt an action to force a pass

The first reasonable attempt at the plan's literal action is what gets judged. Retrying that identical action for a transient-looking failure, per above, is fine. Trying a *different* approach because the first one didn't work — a different selector, different test data — is never absorbed silently into a clean pass: record it in `step-results.md`'s `Deviation` field, honestly, and let the verdict still reflect whether the originally planned check actually succeeded. A step that didn't work as planned may mean the feature is wrong, not the plan.

### Irreversible steps

Before running any step tagged irreversible, check its containment:

- **`escapes`** — always stops for explicit confirmation, no exceptions, regardless of anything approved earlier. Escalate per `agentic-qa:agentic-qa`.
- **`contained`** — checks whether this run carries a blanket pre-authorization (`step-plan.md`'s header, from the User Gate or the brief's `pre_authorize_contained`). If so, run without stopping. If not, falls back to the same individual escalation as an `escapes` step.

Either way, `step-results.md`'s `Authorization` field records how it was cleared — `confirmed live`, `pre-authorized (contained)`, or `n/a (reversible)` — never silent.

### Browser session and SSO

Before the first browser step, verify the session is authenticated. Interactively, `claude-in-chrome` drives the user's actual, already-logged-in browser — if not authenticated, navigate to the login page and escalate, asking the person to complete SSO/MFA live; there is no credential to know, only a session to wait for. Agent-invoked, load the brief's `browser_session` (a pre-established storage state) if given; if missing or expired, this is an escalation trigger, not a retry candidate — an expired session fails identically every time, so what it needs is a human to refresh it, not four attempts at the same action.

## `step-results.md` format

```markdown
# Step Results: <title>

## S1 — <short name>
- **Verdict:** pass | fail | blocked | skipped
- **Evidence:** evidence/s1-response.json
- **Observed:** <what happened, citing the evidence>
- **Outputs:** order_id: ORD-8842
- **Authorization:** n/a (reversible) | confirmed live | pre-authorized (contained)
- **Deviation:** none | <what diverged from the plan and why, never absorbed silently into a pass>

## S4 — <short name>
- **Verdict:** blocked
- **Reason:** Unspecified Q2 unresolved — <question text>
- **Evidence:** none — not executed

## S8 — <short name>
- **Verdict:** skipped
- **Reason:** depends on S2, which failed: SQS message contract mismatch (expected orderId, got order_id)
- **Evidence:** none — not executed
```
