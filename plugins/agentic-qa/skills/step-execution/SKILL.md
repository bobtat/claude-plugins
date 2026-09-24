---
name: step-execution
description: Use when running an approved step plan against a live system — spawning agentic-qa:step-executor to drive the browser, API, and CLI. Governs the four verdicts (pass/fail/blocked/skipped), which evidence is required by surface, the choice between the claude-in-chrome and playwright browser drivers, the backoff retry policy for environment failures, the irreversible-step check, and the rule against adapting an action to force a pass. Invoked by /agentic-qa:walkthrough after the User Gate, alongside agentic-qa:qa-reporting.
---

## Overview

This is Phase 4: running the approved `step-plan.md` one step at a time against the live system. Spawn `agentic-qa:qa-reporter` first — it writes the report skeleton and returns — then spawn `agentic-qa:step-executor` with the absolute paths to `step-plan.md` and `intake.md` and the reporter's agent ID. The reporter has to exist before the first step completes, since the report is built incrementally as steps complete, not assembled afterward. See `agentic-qa:qa-reporting` for that agent's half.

This is the longest-running, most context-heavy stage in the pipeline, which is exactly why it is a spawned agent rather than main-thread work — the bulk of what it does (screenshots, response bodies, command output, tool-call history) should never accumulate in the thread that has to survive the whole session.

## Per-step loop

Before each step, read `step-results.md` for any output value an earlier step produced that this step's action depends on. After each step, append its own entry there — verdict, evidence path, outputs later steps might need — then send `S<n>` via `SendMessage` to the reporter's agent ID so the report grows step by step. It is a nudge, not the result: the reporter rebuilds from `step-results.md` whenever it wakes, so a nudge that arrives late loses nothing. `SendMessage` accepts only an agent ID — never `agentic-qa:qa-reporter`.

### Ending a turn

The executor ends its turn in exactly one of two ways, and the orchestrator acts on which:

- **`ESCALATION: <what's needed, for which step>`** — a trigger from `agentic-qa:agentic-qa`'s escalation mechanism fired. Record the pending step's state in `step-results.md` first. The executor is resumed with the answer and continues from that step; it cannot wait for the answer in place.
- **`COMPLETE`**, with the verdict counts — every step has a verdict.

### Evidence, fixed by surface, not judgment

- **browser** — a screenshot, every time, pass or fail, never skipped as unnecessary, ending up at `evidence/s<n>-<short-name>.png`; a screenshot left wherever the driver put it is one the report can't find. With `playwright`, call `browser_take_screenshot` **without** a `filename`: the server saves into its own output directory and returns the path, and you copy that file into `evidence/` with Bash. Never pass `filename` — the server resolves an explicit name against the session's working root, which is the user's repository, and refuses any path outside its allowed roots, which the run's working directory is.
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

Only these count as an environment failure: a connection that never completed (refused, reset, DNS failure), a gateway status — `502`, `503`, `504` — or the browser tool itself crashing. Any other 5xx, a `500` above all, is the application under test answering, and that is a result: judge it against Expected like any other. An intermittent 500 is exactly the kind of defect a walkthrough exists to catch, and retrying it until it passes erases the evidence.

An environment failure gets a retry of the identical action, not a different approach:

1. Retry immediately.
2. Retry after 30s.
3. Retry after 1 minute.

Three retries, four attempts total. If all four fail, this is a trigger for the escalation mechanism in `agentic-qa:agentic-qa` — end your turn with an escalation, don't keep "testing" against a target that isn't answering.

**Never retry an irreversible step whose request may have landed.** A timeout, or a connection dropped after the request was sent, leaves the outcome unknown: the server may have charged the card or sent the email and simply failed to answer. Retrying would repeat a real side effect on an approval given for one. Escalate at once instead, with what was sent and what is unknown, so a human can check whether it landed. Only a failure that provably never reached the server — refused, DNS failure — may be retried for an irreversible step, and each attempt re-checks its authorization.

**Every attempt is recorded.** `step-results.md`'s `Attempts` field lists each one with what happened — `1: 503; 2: 200`. A step that passes after a failed attempt is still a `pass`, but the failed attempt is disclosed, and the report surfaces it under `Findings` as intermittent, never absorbed into a clean result.

**Backoff is for failures that might pass on the next attempt.** A failure that is deterministic fails identically four times and wastes ninety seconds proving it. An expired browser session is one (see below). A stale element reference — the handle came from a page snapshot the page has since re-rendered past — is the other: take a fresh snapshot and re-run the same action. Re-reading a page that moved is not a `Deviation`.

A fresh snapshot assigns new references, so "the same element" cannot be an identity check and must not be left to judgment. Use this test:

1. **Before** re-snapshotting, write down the element's identity as the *plan* names it — its accessible role and name, e.g. `button "Place order"`. From the plan, not from the element you were about to click.
2. Take the snapshot and look for an element with that same role and accessible name.
3. **Found it** — act on it. Record `re-snapshot — button "Place order"` in the step's `Deviation` field. It doesn't change the verdict, but it is disclosed, and a reader can see what was matched instead of taking your word for it.
4. **Not found** — stop. This is not a stale reference; the element the plan named is not on the page. That is an observation about the product, and the verdict follows from Expected like any other. It is never licence to look for something similar.

The trap this closes: re-snapshot, fail to find the planned element, take the nearest plausible substitute, and call it a stale-reference refresh. Writing the role and name down in step 1 — before you know what the new snapshot holds — is what makes that self-deception hard. Choosing a different element remains a `Deviation` however reasonable the substitute looks.

**This retry never applies to a step that completed and simply didn't match Expected.** A clean response with the wrong data is the finding, not a glitch to wait out — retrying that would reopen the false-pass door the next rule closes.

### Never adapt an action to force a pass

The first reasonable attempt at the plan's literal action is what gets judged. Retrying that identical action for a transient-looking failure, per above, is fine. Trying a *different* approach because the first one didn't work — a different selector, different test data — is never absorbed silently into a clean pass: record it in `step-results.md`'s `Deviation` field, honestly, and let the verdict still reflect whether the originally planned check actually succeeded. A step that didn't work as planned may mean the feature is wrong, not the plan.

### Irreversible steps

Before running any step tagged irreversible, check its containment:

- **`escapes`** — always stops for explicit confirmation, no exceptions, regardless of anything approved earlier. Escalate per `agentic-qa:agentic-qa`.
- **`contained`** — checks whether this run carries a blanket pre-authorization (`step-plan.md`'s header, from the User Gate or the brief's `pre_authorize_contained`). If so, run without stopping. If not, falls back to the same individual escalation as an `escapes` step.

Either way, `step-results.md`'s `Authorization` field records how it was cleared — `confirmed live`, `pre-authorized (contained)`, or `n/a (reversible)` — never silent.

### Browser driver

Two drivers can run a browser step. Which one this run uses was settled at Intake and is recorded in `intake.md`'s `Browser driver` field — read it, don't re-derive it. Intake sees the same tool list you do, and a run whose evidence came from one driver for some steps and the other for the rest can't be compared against itself.

- **`claude-in-chrome`** — preferred when available. It drives the user's own Chrome, which is why the interactive session story below is as short as it is.
- **`playwright`** — the fallback, shipped configured with this plugin. Nothing else about this phase changes: the same four verdicts, the same evidence rules, the same escalations.
- **`none`** — every browser step arrived already marked `blocked — no browser driver` by `agentic-qa:step-planning`. Skip them and their cascade exactly as you would any other blocked step. You have nothing to escalate here; Intake already did.

Driving Playwright, work from `browser_snapshot` and act on the element references it returns — not from screenshot coordinates. This matters for more than ergonomics: a reference that no longer resolves is an unambiguous failure attributable to the page, where a coordinate click that lands on the wrong element produces a screenshot that looks like a product bug. Screenshots are still captured for every browser step, but as evidence, not as the thing actions are aimed at.

Playwright also exposes two evidence classes no other surface here can reach — `browser_console_messages` and `browser_network_requests`. Capture them alongside the screenshot when a step's Expected concerns something the rendered page can hide: a request that should have fired, a silent client-side error behind a UI that looks fine. `agentic-qa:step-planning` adds a deliberate API step next to a browser one for exactly this reason; network evidence tightens that pairing, it doesn't replace it.

A driver recorded at Intake can still fail when it first reaches for a browser binary — that is an environment failure, so it gets the backoff below and then escalates like any other. Never re-plan a browser step onto the API because the browser is missing: the surface was chosen deliberately, and a behavior that is only observable in the rendered UI has no API equivalent to fall back to.

### Browser session and SSO

Before the first browser step, verify the session is authenticated.

Interactively with `claude-in-chrome`, the user's browser is already logged in — if it isn't, navigate to the login page and escalate, asking the person to complete SSO/MFA live; there is no credential to know, only a session to wait for.

Interactively with `playwright`, the browser is the plugin's own, not the user's, so that assumption does not carry: expect an unauthenticated first run, navigate to the login page and escalate for a live login the same way. The profile persists between runs, so this is a first-run cost rather than a per-run one. Capturing the resulting state with `browser_storage_state` and handing the path back to the user is worth doing — it is exactly what an agent-invoked run will want as its `browser_session`. Call it without a `filename`, so the state lands in the server's output directory: outside the run's working directory and outside the repository, which is where the credentials rule wants a storage state kept.

Agent-invoked, load the brief's `browser_session` (a pre-established storage state) if given — with `playwright`, via `browser_set_storage_state`, at the start of the run rather than as a launch flag. The server reads only inside its allowed roots, so if the brief's path is elsewhere, copy the file into the server's output directory with Bash first — `browser_navigate`'s result names a snapshot file inside it — and delete that copy when the run ends. If it is missing or expired, this is an escalation trigger, not a retry candidate — an expired session fails identically every time, so what it needs is a human to refresh it, not four attempts at the same action.

## `step-results.md` format

```markdown
# Step Results: <title>

## S1 — <short name>
- **Verdict:** pass | fail | blocked | skipped
- **Evidence:** evidence/s1-response.json
- **Observed:** <what happened, citing the evidence>
- **Outputs:** order_id: ORD-8842
- **Authorization:** n/a (reversible) | confirmed live | pre-authorized (contained)
- **Attempts:** 1 | <each attempt and its outcome, e.g. `1: 503; 2: 200`>
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
