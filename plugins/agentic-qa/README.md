# agentic-qa

A Claude Code plugin that runs a live QA walkthrough — a browser, an API, a CLI — against a finished feature or fix, the way a QA engineer would, not by writing test code.

## What It Does

The premise: a ticket and its merged PR describe what should be true of a running system. This plugin drives that system and checks. It is not `testing`'s `/test-write` run against a live server — it produces no test code, and it is not trying to prove the logic is correct in general; it is trying to confirm this one described behavior actually works, right now, against the real thing.

- **`/agentic-qa:walkthrough`** — the interactive entry point. Resolves a ticket and its merged PR, extracts a behavior spec, plans a step-by-step verification, reviews it with the user, runs it against the live system, and writes a report with embedded screenshots.
- **A drafter/critic exchange**, twice — once extracting behaviors from the ticket, once planning the steps. The orchestrator carries each round between the drafter and its adversarial critic, and the drafter that wrote the draft is resumed, with its reasoning intact, to revise it. Up to two rounds, every one logged.
- **A blast-radius critic that reads the diff** — the plugin's actual edge over a human QA process. A person testing a ticket generally can't read the code that implements it and reason about what else it touches; this critic does, and every finding it raises has to cite a real line, not an impression.
- **A hard split between two kinds of irreversible action** — one that stays inside the target environment and test account, and one that reaches something real outside it (an email that delivers, a real payment, a shared resource). Only the first can ever be pre-authorized in bulk; the second always gets individual attention, in every mode.
- **Agent-invoked operation** — another agent can dispatch a walkthrough unattended via `agentic-qa:qa-runner` or by calling the umbrella skill directly, handing it a brief instead of a conversation. Anything that needs a human pauses the run and returns an escalation to whoever invoked it, rather than guessing or halting outright; the caller resumes the run with the answer, so it needs `SendMessage`.
- **A report with the evidence in it, not just links to it** — `walkthrough-report.html` embeds every browser step's screenshot and renders once the run finishes; `walkthrough-report.md` is the live, incrementally-built working copy behind it.

## Prerequisites

Requires the **`testing`** plugin — Extract Behaviors runs `testing:behavior-extraction` directly and will not improvise an extraction procedure if it isn't installed. It is declared as a dependency in the manifest.

Requires `gh` for ticket/PR resolution.

The pipeline's agents hand work to each other with `SendMessage`, resuming one another by agent ID. That needs no agent-teams setting: subagents were offered `SendMessage` with no flag set on Claude Code 2.1.281, where this was last checked.

Any behavior planned against the browser surface needs a browser driver, and there are two. `claude-in-chrome` is preferred when a browser is actually connected — it drives your own Chrome, so whatever you're already logged into is simply there. Its tools are registered even when no browser is attached, so Intake checks for a live connection rather than trusting that they're listed. Otherwise the plugin falls back to **Playwright MCP**, which it ships configured: no setup beyond having `npx` on the machine. Intake picks the driver and records it in `intake.md`, so the choice is made once, before any planning, and travels with the run into the report. An agent-invoked run can't see the session's browser tools, so its brief names the driver in `browser_driver`, defaulting to `playwright`.

If **neither** is available, browser steps are still planned — and then marked `blocked — no browser driver`, with the count surfaced at the User Gate before you approve anything. They are never quietly re-planned onto the API: an API check would pass even if the button were broken, and a behavior about what's rendered has no API equivalent at all. You decide whether to fix the environment, narrow the run, or proceed knowing what won't be covered.

The fallback is not a degraded mode. Playwright acts on element references from an accessibility snapshot rather than screenshot coordinates, which makes a failed action attributable to the page instead of to a misplaced click, and it captures console messages and network requests — evidence for a step whose expected result concerns something the rendered page can hide.

What does differ is the session. Playwright launches its own browser, not yours, so the first interactive run is expected to be unauthenticated: it stops and asks you to log in live, and the profile persists from there. An agent-invoked run loads the brief's `browser_session` storage state instead and escalates if it's missing or expired.

Four things about the shipped Playwright config worth knowing before you install:

- **It runs in every session.** Claude Code starts a plugin's stdio MCP servers when the plugin is enabled, not on first use, so enabling `agentic-qa` means a small Node process starts each session whether or not you ever run a browser step.
- **The version is pinned**, deliberately. A walkthrough's worth as evidence depends on knowing what produced it, and `@latest` would mean the same walkthrough run two months apart used provably different tools.
- **`--caps=testing,storage` is required, not optional.** The verification tools and both storage-state tools sit behind non-default capability groups; without that flag the server silently doesn't expose them. Note that `--caps --help` lists only `vision, pdf, devtools` — `testing` and `storage` are real, working values the CLI's own help text omits. Don't remove the flag on the strength of that help output.
- **Its files go to the plugin's data directory, not your repository.** Playwright writes snapshots, screenshots and storage states to an output directory, and confines file access to that directory and the session's working root. Left at the default, both are your repository. `--output-dir` points it at the plugin's data directory instead; the executor copies each screenshot from there into the run's `evidence/`. `--allow-unrestricted-file-access` would also remove the confinement, and is deliberately not used: it lets the browser open `file://` URLs.

The persistent Playwright profile is keyed by a hash of the working directory, so running a walkthrough from a different directory gets a different — also persistent — profile, and a fresh login.

## Before you run it

A walkthrough only accepts a ticket **with real acceptance criteria** and its **merged** PR — cross-resolved from whichever one you give it. This isn't a tool for planning a feature or reviewing one still in flight; it tests what's already landed. Production is refused outright as a target, in every mode, with no confirmation path around it.

That refusal is enforced by an allowlist, not by guessing from a hostname. A target is accepted only if its host — after following redirects — is in `allowed_hosts` in `.claude/agentic-qa.local.md`; `localhost` is always allowed. The first time you point a walkthrough at a new host, it asks whether the host is non-production and saves your answer. An agent-invoked run never adds to the list: an unlisted host escalates to its caller, and a brief can't carry its own allowlist.

## Invocation names

Everything this plugin ships is namespaced, with no bare-name fallback. The command is `/agentic-qa:walkthrough`. The five skills are `agentic-qa:agentic-qa`, `agentic-qa:behavior-coverage`, `agentic-qa:step-planning`, `agentic-qa:step-execution`, and `agentic-qa:qa-reporting`. The seven agents are `agentic-qa:behavior-extractor`, `agentic-qa:behavior-coverage-critic`, `agentic-qa:step-planner`, `agentic-qa:step-plan-critic`, `agentic-qa:step-executor`, `agentic-qa:qa-reporter`, and `agentic-qa:qa-runner`.

## Settings

Environment answers (base URL, environment name, report destination) can be saved to `.claude/agentic-qa.local.md` on first run so a later walkthrough on the same project doesn't ask again. The same file holds `allowed_hosts`, the production gate's allowlist. Both live in YAML frontmatter:

```markdown
---
base_url: https://staging.example.com
environment: staging
report_destination: /shared/qa-reports
allowed_hosts:
  - staging.example.com
  - "*.preview.example.com"
---
```

It is a per-machine file; add `.claude/*.local.md` to `.gitignore` if the repo doesn't already. Credentials are never written to this file or any other — they stay in conversation context (interactive) or resolve from an environment-variable reference at the moment of use (agent-invoked).

## Working directory

A run's artifacts — `intake.md`, `behavior-spec.md`, `step-plan.md`, `step-results.md`, `evidence/*`, and the two report files — live in a working directory for the run, reported at the end. If a report destination was configured, the report and its evidence are also copied there, incrementally as the run progresses.

Evidence is masked before it is written: credential headers, and token, password and secret fields in response bodies and command output, are replaced with `<masked>`. A screenshot that shows a secret the executor couldn't hide is marked sensitive and stays in the working directory only — never embedded in the HTML report, never copied to the report destination.
