# agentic-qa

A Claude Code plugin that runs a live QA walkthrough — a browser, an API, a CLI — against a finished feature or fix, the way a QA engineer would, not by writing test code.

## What It Does

The premise: a ticket and its merged PR describe what should be true of a running system. This plugin drives that system and checks. It is not `testing`'s `/test-write` run against a live server — it produces no test code, and it is not trying to prove the logic is correct in general; it is trying to confirm this one described behavior actually works, right now, against the real thing.

- **`/agentic-qa:walkthrough`** — the interactive entry point. Resolves a ticket and its merged PR, extracts a behavior spec, plans a step-by-step verification, reviews it with the user, runs it against the live system, and writes a report with embedded screenshots.
- **A live drafter/critic pairing**, twice — once extracting behaviors from the ticket, once planning the steps — where the drafter and its adversarial critic argue findings out directly with each other rather than relaying through a human every round. Every exchange is logged.
- **A blast-radius critic that reads the diff** — the plugin's actual edge over a human QA process. A person testing a ticket generally can't read the code that implements it and reason about what else it touches; this critic does, and every finding it raises has to cite a real line, not an impression.
- **A hard split between two kinds of irreversible action** — one that stays inside the target environment and test account, and one that reaches something real outside it (an email that delivers, a real payment, a shared resource). Only the first can ever be pre-authorized in bulk; the second always gets individual attention, in every mode.
- **Agent-invoked operation** — another agent can dispatch a walkthrough unattended via `agentic-qa:qa-runner` or by calling the umbrella skill directly, handing it a brief instead of a conversation. Anything that needs a human pauses and notifies whoever invoked it, rather than guessing or halting outright.
- **A report with the evidence in it, not just links to it** — `walkthrough-report.html` embeds every browser step's screenshot and renders once the run finishes; `walkthrough-report.md` is the live, incrementally-built working copy behind it.

## Prerequisites

Requires the **`testing`** plugin — Extract Behaviors runs `testing:behavior-extraction` directly and will not improvise an extraction procedure if it isn't installed.

Requires `gh` for ticket/PR resolution, and a Chrome browser connected via `claude-in-chrome` for any behavior planned against the browser surface.

## Before you run it

A walkthrough only accepts a ticket **with real acceptance criteria** and its **merged** PR — cross-resolved from whichever one you give it. This isn't a tool for planning a feature or reviewing one still in flight; it tests what's already landed. Production is refused outright as a target, in every mode, with no confirmation path around it.

## Invocation names

Everything this plugin ships is namespaced, with no bare-name fallback. The command is `/agentic-qa:walkthrough`. The five skills are `agentic-qa:agentic-qa`, `agentic-qa:behavior-coverage`, `agentic-qa:step-planning`, `agentic-qa:step-execution`, and `agentic-qa:qa-reporting`. The seven agents are `agentic-qa:behavior-extractor`, `agentic-qa:behavior-coverage-critic`, `agentic-qa:step-planner`, `agentic-qa:step-plan-critic`, `agentic-qa:step-executor`, `agentic-qa:qa-reporter`, and `agentic-qa:qa-runner`.

## Settings

Environment answers (base URL, environment name, report destination) can be saved to `.claude/agentic-qa.local.md` on first run so a later walkthrough on the same project doesn't ask again. Credentials are never written to this file or any other — they stay in conversation context (interactive) or resolve from an environment-variable reference at the moment of use (agent-invoked).

## Working directory

A run's artifacts — `intake.md`, `behavior-spec.md`, `step-plan.md`, `step-results.md`, `evidence/*`, and the two report files — live in a working directory for the run, reported at the end. If a report destination was configured, the report and its evidence are also copied there, incrementally as the run progresses.
