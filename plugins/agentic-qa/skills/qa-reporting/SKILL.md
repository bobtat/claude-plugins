---
name: qa-reporting
description: The procedure agentic-qa:qa-reporter follows when building the walkthrough report — a live, incrementally-updated report while agentic-qa:step-executor runs, and the finished, self-contained HTML deliverable at finalization. Governs the report template, the Traceability table, the report-destination sync, the finalization self-check, and screenshot embedding. Loaded by that agent. An orchestrator runs this phase from /agentic-qa:walkthrough or agentic-qa:qa-runner and does not load it.
---

## Overview

This is Phase 4's other half: `agentic-qa:qa-reporter` is spawned **just before** `agentic-qa:step-executor`, not after it finishes. Give it the absolute paths to `step-plan.md`, `behavior-spec.md`, and `intake.md` up front. It writes a skeleton `walkthrough-report.md` before a single step has run — the `Traceability` table with every planned step and its behavior, verdicts marked pending — and returns. Keep its agent ID: the executor needs it when the run has live updates, and so do you.

From then on the reporter is resumed by message, never left waiting — a spawned agent can't wait (see `agentic-qa:agentic-qa`'s Agent messaging). When the run has live updates, the executor nudges it with `S<n>` after each step except the last; you send `paused: <reason>`, `resumed`, and `final`. A message can land inside a turn already running; `final` is honoured wherever it lands.

## Incremental updates

**Live updates are on or off for the whole run,** and the reporter's spawn prompt says which. On, the report is brought up to date after every step, for someone watching it or its copy at a report destination. Off, no `S<n>` arrives: the skeleton's `Status` reads `⏳ In progress — filled in when the run pauses and when it ends`, and the report is rebuilt from `step-results.md` on `paused` and on `final`. The finished report is the same either way. What follows applies to every wake in both modes.

On every wake, rebuild from `step-results.md` rather than from the message: fill in every `Traceability` row and detail section that has a result the report doesn't show yet, evidence linked by relative path rather than described in prose. A late nudge costs nothing this way. Read from the first step whose row has no final verdict yet, not the whole file — a step whose last entry was `pending` still counts as unfinished, so it is read again — and change the report with `Edit` rather than rewriting it. The file grows by an entry per step and the reporter wakes once per step, so reading or writing all of it every time makes a long run's cost grow with the square of its length. At `final` the whole file is read once, for the self-check. On `paused: <reason>`, note it too — `⏸ paused, waiting on SSO login` — so a report checked mid-wait shows a real status, not silence; `resumed` clears it.

If `intake.md` names a report destination, the reporter makes that folder if it isn't there, and every update is copied there too with `cp`, alongside the working-directory copy, not just once at the end. Copy it, never write it out a second time: written output is the most expensive thing the reporter produces. That path is already specific to this run; never write to the folder above it. A failure to reach that destination gets noted and does not stop anything — the working-directory copy is always the real one. `walkthrough-report.html` is different: it only exists once, at finalization (see below), so it copies to the destination once, alongside the others, not incrementally.

A step marked `Sensitive: yes` in `step-results.md` has evidence that shows a credential the executor could not mask. Its evidence file is never copied to the report destination and never embedded in the HTML; the report shows `evidence withheld — contains a credential, see the working directory` in its place.

## Finalization

Send the reporter `final` once `step-executor` returns `COMPLETE`, then wait on `signals/report-done.txt`; repeating `final` after a timed-out wait is safe. It rebuilds from `step-results.md` one last time, then:

1. Write `Status` and `Summary`.
2. Write the `Findings` section — anything worth flagging that isn't a strict pass/fail: a confusing-but-correct error message, an ambiguity resolved mid-run, a UX rough edge. Every step whose `Attempts` field shows a failed attempt before its verdict goes here as intermittent, with the attempt history — a pass on the second try is not the same evidence as a pass on the first.
3. Write the `Blocked`, `Open questions` and `Not walked through` sections — distinct from each other. `Blocked` needs an actual answer before its steps can run. `Open questions` copies every question from `step-plan.md`'s section of that name with what the run did about it, so a reader of a pass can see it was a pass for the criterion as written and what wider reading went untested. `Not walked through` (behaviors deliberately excluded) needs nothing further. Don't conflate them.
4. Run the **three-part self-check** before calling the report done:
   - Every step from `step-plan.md` is present in the report.
   - The `Summary` counts match the actual entries.
   - Every `Evidence` path points to a file that actually exists.
5. Render `walkthrough-report.html` from the finished `walkthrough-report.md`.
6. Write the HTML report's absolute path to `signals/report-done.txt`, as its last act on the run, then return `done: <absolute path to walkthrough-report.html>`. The file is the signal that the report is finished — Phase 5 waits on it, because a returned result does not reliably reach the orchestrator (see `agentic-qa:agentic-qa`'s Agent messaging).

A run with any `blocked`, `skipped` or `not verified` step states that in the `Status` line itself, not just as a nonzero count buried in `Summary` — `⚠️ Incomplete — 2 blocked, 1 skipped, 1 not verified`, not a report that reads as done when it isn't. A run with any `fail` leads with that: `❌ Failed — 1 failed; incomplete — 2 blocked`. `✅ Passed` means every planned step passed, and nothing less; someone reading only this line should not be misled. A run with open questions says so after the verdict, whatever the verdict: `✅ Passed — every step passed; 2 open questions`.

**If the self-check fails,** fix what the files allow. Anything still wrong goes in the report under `Findings` and in `Status` — `⚠️ Incomplete — self-check failed: S3's evidence is missing` — and finalization continues. **If the HTML can't be rendered,** say so in `Status`, write `walkthrough-report.md`'s path to `signals/report-done.txt` instead, and return `done: <that path> (HTML not rendered: <reason>)`. The orchestrator always gets an ending.

**On `final: run ended abnormally — <reason>`,** finalize the same way, from whatever `step-results.md` holds. A step with no entry shows as `not verified — run ended`. A step whose last entry is `pending` shows as `not verified — outcome unknown, the request may have landed`, with its `Action sent`, and goes first under `Findings`, because someone may need to check it. Put the reason in `Status`.

## Rendering `walkthrough-report.html`

Not hand-templated like the `.md` — generated once, at finalization, from the finished `walkthrough-report.md`. Same content and structure, with two differences:

- Every browser step's screenshot embeds as a base64 image, inline with that step — not linked by path. The point is a single, self-contained file: open it anywhere, everything shows, no dependence on a Markdown renderer or a co-located `evidence/` folder.
- An api/cli step's evidence (its response body or command output) renders as a formatted text block — no screenshot exists for these, per `agentic-qa:step-execution`.

**Everything from the system under test or the ticket is hostile text.** A walkthrough of a stored-XSS ticket carries its payload in the evidence by design, and this file gets opened on other people's machines. HTML-escape `&`, `<`, `>`, `"` and `'` in every piece of it: evidence, `Observed`, ticket text, reasons, step names, in text blocks and table cells alike. Emit no script, and put `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">` in the head. Escape `|` and newlines in anything going into a Markdown table cell, or a hostile value rewrites the `Traceability` row.

**Build it with a script, never by hand.** Write a short throwaway script in the working directory, in whatever Bash can run, that reads the files and writes the HTML, and never print the base64 or a whole evidence file into your own context: a few screenshots would exhaust it. The escaping belongs in that script, where it applies to everything.

The raw `evidence/*` files still exist and still travel with the working directory and the report-destination copy — the HTML being self-contained doesn't replace them, it serves a different purpose: reading, not auditing.

A lightweight inline-SVG step-status summary is worth adding when a run has enough steps to benefit from a visual overview at a glance — a judgment call, not a rule required on every report; a two-step run where the `Traceability` table already says everything doesn't need one.

## `walkthrough-report.md` format

```markdown
# Walkthrough Report: <title>

**Ticket:** <key/URL>   **PR:** <#, merged>
**Environment:** staging — https://staging.example.com
**Deployed build:** <from intake.md> (when `unverified`, also say so in `Status`: these results may describe a build without this change)
**Browser driver:** playwright — logged in as <`Browser account` from step-results.md>  (omit this line when the run has no browser steps)
**Status:** ⏳ In progress — 4 of 7 steps run | ❌ Failed — 1 failed | ⚠️ Incomplete — 2 blocked, 1 skipped | ✅ Passed — every step passed
**Summary:** 3 passed, 1 failed, 2 blocked, 1 skipped, 0 not verified

## Traceability
| Step | Behavior | Verdict |
|---|---|---|
| S1 | B1 — order confirmation email sends on checkout | ✅ Pass |
| S2 | B2 — order status updates when payment clears | ❌ Fail |
| S3 | B3 — cancelling a paid booking refunds it | ✅ Pass (irreversible, contained — pre-authorized) |
| S4 | B6 — cancellation exactly at the 24h boundary | ⏳ blocked — Unspecified Q2 |
| S8 | A1 — loyalty credit also reverses on refund | ⏭ skipped — depends on S2, which failed |
| S9 | B7 — refund notifies the card issuer | ❔ not verified — declined at escalation |

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

## Open questions
| # | Question | What this run did |
|---|---|---|
| Q1 | Must the search also find a cancelled order? | S7 passed as written; the wider reading was not tested |
| Q3 | What should a search with no results say? | not tested |

## Not walked through
- <behaviors deliberately excluded from this run, and why>
```
