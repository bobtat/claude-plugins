---
description: Walk through a finished feature or fix — a ticket and its merged PR — against a live browser, API, and CLI, with a human decision before anything irreversible runs
argument-hint: <ticket key/URL> <PR number/URL> | <PR number/URL> | <ticket key/URL>
allowed-tools: Agent, AskUserQuestion, Read, Write, Edit, Grep, Glob, Bash, SendMessage, Skill, ToolSearch, WebFetch, mcp__claude-in-chrome__tabs_context_mcp
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

Every phase hands off through files in a working directory **new to this run**: `walkthrough-<ticket>-<UTC timestamp>` inside your scratchpad directory if you have one, otherwise inside a temp directory. Use only letters, digits and hyphens from the ticket key in that name; it comes from a ticket. Never reuse one, or a second ticket picks up the first one's verdicts from `step-results.md`.

| File | Written by | Holds |
|---|---|---|
| `intake.md` | Intake | The validated ticket snapshot, target facts, a reference to the credentials and never the credentials |
| `behavior-spec.md` | `behavior-extractor` | The behavior spec, plus its own `Critique Exchange` log with the Coverage Critic |
| `step-plan.md` | `step-planner` | The step plan, plus its own `Critique Exchange` log with the plan critic |
| `step-results.md` | `step-executor` | One append-only entry per executed step |
| `evidence/*` | `step-executor` | A screenshot, response body, or command output per step |
| `walkthrough-report.md` | `qa-reporter` | The live, incrementally-built report |
| `walkthrough-report.html` | `qa-reporter` | The rendered, self-contained deliverable — generated once, at finalization |
| `signals/report-done.txt` | `qa-reporter` | The path to the finished report, written last — the signal Phase 5 waits on |

Pass **absolute paths** to every spawned agent — they cannot see your conversation. Tell the user where the directory is **when you create it**, not only when the run finishes: if the session dies, that path is what a rerun needs in order to know what was already sent. If they say an earlier run of this ticket was interrupted, ask for its directory (see `agentic-qa:step-execution`'s Rerunning). Tell them where the report landed if a report destination was configured.

### Everything here is namespaced

Every component this plugin ships is addressed as `agentic-qa:<name>` — `agentic-qa:behavior-extractor`, not `behavior-extractor`. There is no bare-name fallback. If a skill won't load, say so and continue by following the procedure as published rather than improvising from memory — the phase skills carry the actual rules, and skipping one silently is how a run produces a plausible-looking result that quietly skipped its own safety checks.

---

## Phase 0 — Intake

Load the `agentic-qa:agentic-qa` skill's intake section if you haven't already. Before asking anything, check for `.claude/agentic-qa.local.md` in the repo — if it exists, read it and treat its saved environment/report-destination answers as already given; only ask for what it doesn't cover.

Resolve `$ARGUMENTS`, and apply the resolution table and the validity gates, from that section. They are in the skill because every mode shares them.

Determine the **browser driver** before writing `intake.md`, and do not defer it to Execute Steps:

1. **`playwright`**, which this plugin ships configured. It runs an isolated browser, so a hostile page or a mistaken step can reach only what that browser holds. Its server can still be starting when the session begins, and its tools may be deferred — listed by name only — so if none appear, search for `playwright` with `ToolSearch` before concluding it is absent.
2. **`claude-in-chrome`**, only if the person chooses it, after being told what it means: the run acts as whoever is logged in to their own Chrome, next to every other site they're signed in to. Offer it if Playwright is absent, or if they ask. It also needs a browser **connected**, which its tools being present doesn't show: the server registers them whether or not an extension is attached, so call `tabs_context_mcp`, where an error means none is connected.
3. Otherwise **`none`**.

Record the answer, including `none`. A driver chosen here can still fail when it first reaches for a browser binary; that is an environment failure for backoff to handle, not something this check can predict.

Ask what's needed to reach the system: base URL, environment (local/staging), a test account and a **reference** to its credentials (`env:NAME`, or `file:/absolute/path` outside the repository — ask for where the value is, and if the person starts to paste it, tell them transcripts are saved to disk), whether it's sandboxed or shared (default shared/unknown if unanswered), optionally any docs/wiki links (skippable, and note if a given link is unreachable rather than treating that the same as none given), and optionally a report destination — a shared drive or folder path. Offer to save the environment answers and report destination to `.claude/agentic-qa.local.md` for next time, as YAML frontmatter alongside the allowlist:

```markdown
---
base_url: https://staging.example.com
environment: staging
report_destination: /shared/qa-reports
allowed_hosts:
  - staging.example.com
  - "*.preview.example.com"
identity_hosts:
  - login.example.com
---
```

Saved values are defaults, not a pass: an allowlisted host still gets the reachability and redirect checks on every run. The file holds per-machine settings, so if the repo's `.gitignore` doesn't already cover it, add `.claude/*.local.md` before saving, or save to the home-directory file instead — a committed file is ignored.

**Read the ticket and docs now, with whatever this session has** — `gh`, `WebFetch`, or an MCP tool for the tracker or wiki. The agents that use them can't: save each doc's text to `docs/<n>.md` in the working directory, and record any you can't read as unreachable. A ticket you can't read is a failed gate, not something to work around. Name the PR's repository explicitly in `Diff`: a bare `gh pr diff <n>` resolves against the current checkout, which silently gives a different PR if yours is from another repository. If it is from another repository, say so, because code citations from this checkout won't describe it.

Write `intake.md`, following this template exactly:

```markdown
# Intake: <title>

**Source:** <ticket + merged PR reference>
**Diff:** gh pr diff <n> --repo <owner/repo>
**Docs:** <each link given, and the snapshot of it: url → docs/1.md>, or "none provided" — <url> (unreachable)

**Environment:** staging | local
**Base URL:** https://staging.example.com
**Allowed hosts:** <`allowed_hosts` as read at Intake, plus localhost>
**Identity hosts:** <`identity_hosts` as read at Intake, or none — login only, never a step target>
**Deployed build:** <version or commit, and how it was determined> | unverified
**Test account:** qa-test-1
**Credentials:** env:QA_API_TOKEN | file:/absolute/path | none (a reference only — never the value)
**Isolation:** sandboxed — no real outbound side effects | shared/unknown (default)
**Browser driver:** claude-in-chrome | playwright | none — browser steps will be planned but marked blocked
**Report destination:** <configured path>/<this run's directory name> | none (default — working directory only)
**Earlier run:** none | <directory> — irreversible actions already sent: <list>

## Ticket
<full title, description, and acceptance criteria, as read and validated at Intake — a snapshot, not re-fetched later>
```

This file holds a reference to the credentials, never their value, and neither does anything else in the run.

If any gate fails, ask again live — this is the one place a validity failure is always resolved interactively, since you're already talking to the person who can fix it.

## Phase 1 — Extract Behaviors

Spawn `agentic-qa:behavior-extractor` with `intake.md`'s absolute path — its entire input is that file's `Ticket` and `Docs` fields, nothing else. It drafts `behavior-spec.md` following `testing:behavior-extraction` and returns. Keep the agent ID its spawn returned. Spawn `agentic-qa:behavior-coverage-critic` on the draft; it returns its findings. Relay them by resuming the extractor with `SendMessage` to its ID, so the agent that wrote the draft is the one that revises it; it returns with the round logged. If the spec changed or a finding was rejected, resume the critic by its ID for a second round. Your job here is relay and cap enforcement, not editing: two rounds at most, and "no material findings" ends it early. The two agents never message each other — see `agentic-qa:agentic-qa`'s Agent messaging for why. Load `agentic-qa:behavior-coverage` for the full procedure and the grounding rules before spawning either agent.

## Phase 2 — Plan Steps

Spawn `agentic-qa:step-planner` with the resolved `behavior-spec.md` and `intake.md`'s target facts. It drafts `step-plan.md` and is reviewed by `agentic-qa:step-plan-critic` the same way — you relay by resuming each by agent ID, capped at two rounds. Before moving on, read its `Critique Exchange` and apply `agentic-qa:step-planning`'s rule that the stricter reversibility or containment call stands. Load `agentic-qa:step-planning` for surface selection, the reversibility/containment classification, and the blocked/cascade rules before spawning either agent.

## Phase 3 — User Gate

**Orchestrator-owned** — neither spawned agent has `AskUserQuestion`. Present, compactly:

1. The step plan's coverage — advisory, not a hard gate. A gap found here is no different from one found later; both are just a follow-up.
2. Every `Added` row (from either agent) with its citation, for an explicit strike if it doesn't belong — the only place that happens.
3. Any step still `blocked` — put its question to `AskUserQuestion` directly. This is the one part of this gate that isn't skippable.
4. The irreversible steps, `contained` vs. `escapes`, with their citations. Offer the blanket pre-authorization for `contained` steps as a single choice; `escapes` never gets covered by it.
5. Every `cli` step, and every step whose `Target` isn't the base URL's host, with its actual action, whether reversible or not. These reach further than the system the ticket describes, so a person sees the command before it runs.

6. Any drafter/critic disagreement still open in either `Critique Exchange`. A person decides what it means; nothing else shows it to them before the run.

**Settle item 3 before presenting items 4 and 5.** A blocked step has no action and no classification yet, so an answer can't simply be folded in, and a grant offered first would cover steps nobody has classified. Resume `agentic-qa:step-planner` with the answers to write those steps, and `agentic-qa:step-plan-critic` once to check them; this is outside the round cap, since these steps are new. Then present the rest, including them.

Fold the remaining answers back into `step-plan.md` before moving on — a struck `Added` row, the pre-authorization decision in the header.

## Phase 4 — Execute Steps & Write Report

Load `agentic-qa:step-execution` and `agentic-qa:qa-reporting` for the full procedure — the five verdicts, the surface-driven evidence rule, the backoff policy, the never-adapt-to-force-a-pass rule, and the report template — before spawning either agent.

Spawn `agentic-qa:qa-reporter` **first**: it writes the report skeleton before a single step runs, and returns. Keep its agent ID. Then spawn `agentic-qa:step-executor`, passing that ID in its prompt — the executor nudges the reporter after every step, and only an ID is an address `SendMessage` accepts.

The executor returns one of two results:

- **`ESCALATION: …`** — something needs a human: an unauthorized irreversible step, an unauthenticated browser session, an exhausted backoff retry, an irreversible step whose outcome is unknown. Resume the reporter with `paused: <reason>` so the report shows it, and relay the question into a live `AskUserQuestion` immediately, offering to proceed, decline the step, or stop the run; a person is already here. Then resume the reporter with `resumed`, and the executor by its ID with the answer. It continues from the step it stopped on. This is the same mechanism an agent-invoked run uses unattended, just answered faster.
- **`COMPLETE`** — every step has a verdict. Send the reporter `final`, then wait for `signals/report-done.txt` with a foreground Bash call, 300000 ms timeout: `until [ -f <path> ]; do sleep 2; done`. The file is the signal, not the notice: `final` can land inside a turn a nudge already began, and that turn's notice may say nothing about it. If the wait times out, send `final` again — it is safe to repeat — up to two more times. After that the report did not finalize: tell the user, and give them `walkthrough-report.md`, which is current up to the last update.

The reporter's other completion notices carry nothing you need; ignore them.

Any other ending is an **abnormal end**: follow `agentic-qa:step-execution`'s rule — one resume to ask, then `final: run ended abnormally — <reason>` to the reporter, never a new executor. The user still gets a report, marked incomplete.

## Phase 5 — Wrap-up

Once `signals/report-done.txt` exists, or the report failed to finalize, delete `runtime-secrets/` from the working directory. Then tell the user: the report's `Status` and `Summary`, where the working directory is, where the report destination copy landed if one was configured, and the `walkthrough-report.html` path — that's the deliverable, open it directly.

---

## Rules that hold across every phase

- **Production is never a valid target.** Refused at Intake, no exceptions, no confirmation path.
- **Never adapt a step's action to force a pass.** A step that didn't work as planned may mean the feature is wrong, not the plan — any deviation from the literal planned action goes in `step-results.md`'s `Deviation` field, honestly, never absorbed silently into a clean verdict.
- **Never run an irreversible step without a real decision behind it** — live, pre-authorized, or escalated. Never inferred, never defaulted to safe.
- **Do not commit, post, or publish anything** — including to the report destination or the PR/ticket — beyond what was explicitly configured at Intake.
