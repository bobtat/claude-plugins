---
description: Walk through a finished feature or fix — a ticket and its merged PR — against a live browser, API, and CLI, with a human decision before anything irreversible runs
argument-hint: <ticket key/URL> <PR number/URL> | <PR number/URL> | <ticket key/URL>
allowed-tools: Agent, AskUserQuestion, Read, Write, Edit, Grep, Glob, Bash, SendMessage, Skill
---

## Context

- Current branch: !`git branch --show-current`
- Repo root: !`git rev-parse --show-toplevel 2>/dev/null || echo "not a git repository"`

## Task

Walk through a described feature or fix by actually running it — a live browser, a live API, a live CLI — the way a QA engineer would, not by writing test code. That's what the `testing` plugin's `/test-write` is for; this command tests the running thing, not the source.

This is the **interactive** entry point. An agent invoking this plugin unattended calls `agentic-qa:qa-runner`, or the `agentic-qa:agentic-qa` skill directly, with a brief instead of running this command — see that skill for the agent-invoked contract and the brief format.

**Load the `agentic-qa:agentic-qa` skill now.** It carries the safety posture, the artifact discipline, and the escalation mechanism every phase below depends on. Each phase also loads its own skill at the point it's needed.

### Requires the `testing` plugin

Extract Behaviors runs `testing:behavior-extraction` directly. If that plugin isn't installed, say so and stop — do not improvise an extraction procedure in its place.

### Artifacts

Every phase hands off through files in a working directory — your scratchpad directory if you have one, otherwise a temp directory you create for this run:

| File | Written by | Holds |
|---|---|---|
| `intake.md` | Intake | The validated ticket snapshot, target facts, no credentials |
| `behavior-spec.md` | `behavior-extractor` | The behavior spec, plus its own `Critique Exchange` log with the Coverage Critic |
| `step-plan.md` | `step-planner` | The step plan, plus its own `Critique Exchange` log with the plan critic |
| `step-results.md` | `step-executor` | One append-only entry per executed step |
| `evidence/*` | `step-executor` | A screenshot, response body, or command output per step |
| `walkthrough-report.md` | `qa-reporter` | The live, incrementally-built report |
| `walkthrough-report.html` | `qa-reporter` | The rendered, self-contained deliverable — generated once, at finalization |

Pass **absolute paths** to every spawned agent — they cannot see your conversation. Tell the user where the directory is when the run finishes, and where the report landed if a report destination was configured.

### Everything here is namespaced

Every component this plugin ships is addressed as `agentic-qa:<name>` — `agentic-qa:behavior-extractor`, not `behavior-extractor`. There is no bare-name fallback. If a skill won't load, say so and continue by following the procedure as published rather than improvising from memory — the phase skills carry the actual rules, and skipping one silently is how a run produces a plausible-looking result that quietly skipped its own safety checks.

---

## Phase 0 — Intake

Load the `agentic-qa:agentic-qa` skill's intake section if you haven't already. Before asking anything, check for `.claude/agentic-qa.local.md` in the repo — if it exists, read it and treat its saved environment/report-destination answers as already given; only ask for what it doesn't cover.

Resolve `$ARGUMENTS` into a ticket **and** its merged PR — both required, cross-resolved from whichever is given:

| Given | Resolves the other via |
|---|---|
| Ticket key or URL only | Search for a PR referencing it — the issue's linked-PR list, or a branch/PR body/title containing the ticket key |
| PR number or URL only | `Closes`/`Fixes #N` in the PR body, the issue sidebar, or a branch/title/body ticket-key pattern |
| Both given | Verify each resolves; flag it if they don't actually reference each other rather than proceeding on the assertion alone |
| Prose, a file path, or neither resolves | **Invalid.** Ask for the missing piece — do not proceed on a description alone |

**Validity gates**, all required before proceeding:

1. The ticket states real acceptance criteria — a bare title is rejected, not extracted from on a guess.
2. The PR's state is `MERGED` — `OPEN` (review could still change the functionality) and `CLOSED` (nothing to test) are both rejected.
3. The base URL is reachable — checked, not just accepted as a string.
4. The environment does not resolve to production — refused outright, no confirmation path, in any invocation mode.

Ask what's needed to reach the system: base URL, environment (local/staging), test-account credentials, whether it's sandboxed or shared (default shared/unknown if unanswered), optionally any docs/wiki links (skippable, and note if a given link is unreachable rather than treating that the same as none given), and optionally a report destination — a shared drive or folder path. Offer to save the environment answers and report destination to `.claude/agentic-qa.local.md` for next time.

Write `intake.md`, following this template exactly:

```markdown
# Intake: <title>

**Source:** <ticket + merged PR reference>
**Diff:** gh pr diff <n>
**Docs:** <links given, or "none provided"> — <url> (unreachable — no MCP connected)

**Environment:** staging | local
**Base URL:** https://staging.example.com
**Test account:** qa-test-1  (credentials not recorded here)
**Isolation:** sandboxed — no real outbound side effects | shared/unknown (default)
**Report destination:** <shared drive or folder path> | none (default — working directory only)

## Ticket
<full title, description, and acceptance criteria, as read and validated at Intake — a snapshot, not re-fetched later>
```

Credentials stay in conversation context only; never write them to this file or any other.

If any gate fails, ask again live — this is the one place a validity failure is always resolved interactively, since you're already talking to the person who can fix it.

## Phase 1 — Extract Behaviors

Spawn `agentic-qa:behavior-extractor` with `intake.md`'s absolute path — its entire input is that file's `Ticket` and `Docs` fields, nothing else. It drafts `behavior-spec.md` following `testing:behavior-extraction`, then pairs live with `agentic-qa:behavior-coverage-critic` via `SendMessage`, arguing findings out directly rather than reporting back to you. Your job here is relay and cap enforcement, not editing: keep the exchange going for at most two rounds, and let "no material findings" end it early. Load `agentic-qa:behavior-coverage` for the full procedure and the grounding rules before spawning either agent.

## Phase 2 — Plan Steps

Spawn `agentic-qa:step-planner` with the resolved `behavior-spec.md` and `intake.md`'s target facts. It drafts `step-plan.md` and pairs live with `agentic-qa:step-plan-critic` the same way — you relay and cap at two rounds. Load `agentic-qa:step-planning` for surface selection, the reversibility/containment classification, and the blocked/cascade rules before spawning either agent.

## Phase 3 — User Gate

**Orchestrator-owned** — neither spawned agent has `AskUserQuestion`. Present, compactly:

1. The step plan's coverage — advisory, not a hard gate. A gap found here is no different from one found later; both are just a follow-up.
2. Every `Added` row (from either agent) with its citation, for an explicit strike if it doesn't belong — the only place that happens.
3. Any step still `blocked` — put its question to `AskUserQuestion` directly. This is the one part of this gate that isn't skippable.
4. The irreversible steps, `contained` vs. `escapes`, with their citations. Offer the blanket pre-authorization for `contained` steps as a single choice; `escapes` never gets covered by it.

Fold every answer back into `step-plan.md` before moving on — a blocked step's resolved answer, a struck `Added` row, the pre-authorization decision in the header.

## Phase 4 — Execute Steps & Write Report

Spawn `agentic-qa:step-executor` and `agentic-qa:qa-reporter` **together, not sequentially** — `qa-reporter` writes the report skeleton before a single step runs. Load `agentic-qa:step-execution` and `agentic-qa:qa-reporting` for the full procedure: the four verdicts, the surface-driven evidence rule, the backoff policy, the never-adapt-to-force-a-pass rule, and the report template, before spawning either agent.

Whatever needs a human — an unauthorized irreversible step, an unauthenticated browser session, an exhausted backoff retry — arrives at you via `SendMessage`. Relay it into a live question immediately; a person is already here. This is the same mechanism an agent-invoked run uses unattended, just answered faster.

## Phase 5 — Wrap-up

Once `qa-reporter` signals done, tell the user: where the working directory is, where the report destination copy landed if one was configured, and the `walkthrough-report.html` path — that's the deliverable, open it directly.

---

## Rules that hold across every phase

- **Production is never a valid target.** Refused at Intake, no exceptions, no confirmation path.
- **Never adapt a step's action to force a pass.** A step that didn't work as planned may mean the feature is wrong, not the plan — any deviation from the literal planned action goes in `step-results.md`'s `Deviation` field, honestly, never absorbed silently into a clean verdict.
- **Never run an irreversible step without a real decision behind it** — live, pre-authorized, or escalated. Never inferred, never defaulted to safe.
- **Do not commit, post, or publish anything** — including to the report destination or the PR/ticket — beyond what was explicitly configured at Intake.
