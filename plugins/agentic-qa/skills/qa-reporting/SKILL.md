---
name: qa-reporting
description: Use when building the walkthrough report — spawning agentic-qa:qa-reporter alongside agentic-qa:step-executor to write a live, incrementally-updated report and render the finished, self-contained HTML deliverable at finalization. Governs the report template, the Traceability table, the report-destination sync, the finalization self-check, and screenshot embedding. Invoked by /agentic-qa:walkthrough alongside agentic-qa:step-execution.
---

## Overview

This is Phase 4's other half: `agentic-qa:qa-reporter` is spawned **alongside** `agentic-qa:step-executor`, not after it finishes. Give it the absolute paths to `step-plan.md`, `behavior-spec.md`, and `intake.md` up front. It writes a skeleton `walkthrough-report.md` before a single step has run — the `Traceability` table with every planned step and its behavior, verdicts marked pending — then fills it in live as `step-executor` streams each completed step's result via `SendMessage`.

## Incremental updates

As each result arrives: fill in that step's `Traceability` row and append its detail section, evidence linked by relative path rather than described in prose. If `step-executor` pauses for an escalation, note that too — `⏸ paused, waiting on SSO login` — so a report checked mid-wait shows a real status, not silence.

If `intake.md` names a report destination, every update writes there too, alongside the working-directory copy, not just once at the end. A failure to reach that destination gets noted and does not stop anything — the working-directory copy is always the real one. `walkthrough-report.html` is different: it only exists once, at finalization (see below), so it copies to the destination once, alongside the others, not incrementally.

## Finalization

On the final signal from `step-executor`:

1. Write `Status` and `Summary`.
2. Write the `Findings` section — anything worth flagging that isn't a strict pass/fail: a confusing-but-correct error message, an ambiguity resolved mid-run, a UX rough edge.
3. Write the `Blocked` and `Not walked through` sections — distinct from each other. `Blocked` needs an actual answer; `Not walked through` (behaviors deliberately excluded) needs nothing further. Don't conflate them.
4. Run the **three-part self-check** before calling the report done:
   - Every step from `step-plan.md` is present in the report.
   - The `Summary` counts match the actual entries.
   - Every `Evidence` path points to a file that actually exists.
5. Render `walkthrough-report.html` from the finished `walkthrough-report.md`.

A run with any `blocked` or `skipped` step states that in the `Status` line itself, not just as a nonzero count buried in `Summary` — `⚠️ Incomplete — 2 blocked, 1 skipped`, not a report that reads as done when it isn't.

## Rendering `walkthrough-report.html`

Not hand-templated like the `.md` — generated once, at finalization, from the finished `walkthrough-report.md`. Same content and structure, with two differences:

- Every browser step's screenshot embeds as a base64 image, inline with that step — not linked by path. The point is a single, self-contained file: open it anywhere, everything shows, no dependence on a Markdown renderer or a co-located `evidence/` folder.
- An api/cli step's evidence (its response body or command output) renders as a formatted text block — no screenshot exists for these, per `agentic-qa:step-execution`.

The raw `evidence/*` files still exist and still travel with the working directory and the report-destination copy — the HTML being self-contained doesn't replace them, it serves a different purpose: reading, not auditing.

A lightweight inline-SVG step-status summary is worth adding when a run has enough steps to benefit from a visual overview at a glance — a judgment call, not a rule required on every report; a two-step run where the `Traceability` table already says everything doesn't need one.

## `walkthrough-report.md` format

```markdown
# Walkthrough Report: <title>

**Ticket:** <key/URL>   **PR:** <#, merged>
**Environment:** staging — https://staging.example.com
**Status:** ⏳ In progress — 4 of 7 steps run | ⚠️ Incomplete — 2 blocked, 1 skipped | ✅ Complete
**Summary:** 3 passed, 1 failed, 2 blocked, 1 skipped

## Traceability
| Step | Behavior | Verdict |
|---|---|---|
| S1 | B1 — order confirmation email sends on checkout | ✅ Pass |
| S2 | B2 — order status updates when payment clears | ❌ Fail |
| S3 | B3 — cancelling a paid booking refunds it | ✅ Pass (irreversible, contained — pre-authorized) |
| S4 | B6 — cancellation exactly at the 24h boundary | ⏳ blocked — Unspecified Q2 |
| S8 | A1 — loyalty credit also reverses on refund | ⏭ skipped — depends on S2, which failed |

## S1 — <short name>
- Behaviors: B1
- Verdict: ✅ Pass
- Expected: …
- Observed: …
- Evidence: evidence/s1-response.json
- Reversibility: reversible

## Findings
- <worth flagging even though it isn't a strict pass/fail>

## Blocked — needs an answer
| Step | Behavior | Question |
|---|---|---|
| S4 | B6 | Is a cancellation at exactly 24:00:00 refunded? |

## Not walked through
- <behaviors deliberately excluded from this run, and why>
```
