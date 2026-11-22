# agentic-qa fixture

Runs the real Phase 4 and 5 of an `agentic-qa` walkthrough — the orchestration,
`step-executor` and `qa-reporter` — against a small local web app with a plan written
by hand, then reports what each agent spent. It answers two questions about a change
to the plugin: did the verdicts hold, and what did the run cost.

It lives outside `plugins/` so it is never published.

**It spends real tokens.** Each run starts a headless Claude Code session. In November
2026, on `claude-sonnet-5-5` and Claude Code 2.1.330, a completed run cost $0.68 to
$0.97 at list prices, and one that stalled at its first step still cost $0.45 to $0.55.
It is for measuring a change, not a gate before every commit.

## What it runs

- `app.mjs` is the system under test: an orders list, an order page with a Cancel
  button, and a JSON API, with its state in memory. `ROWS` sets the size of the list,
  and so the size of that page's accessibility snapshot. It has two planted defects:
  the list spells a cancelled order's status "Canceled" where the ticket says
  "Cancelled", and a cancelled order's page still shows the "Cancel order" button.
- `make-run.sh` writes the artifacts Phases 0 to 3 would have produced: `intake.md`,
  `behavior-spec.md` and an approved `step-plan.md` of seven steps, five in the browser
  and two against the API, one of them irreversible, contained and pre-authorized.
- `make-run-listfirst.sh` writes the same plan in another order, so the first page the
  executor sees is the large list rather than the small order page.
- `orchestrator-prompt.txt` is Phases 4 and 5 of `commands/walkthrough.md`, copied,
  with nobody to answer an escalation. `spawn-live-on.txt` is the command's paragraph
  that spawns the two agents, and `spawn-live-off.txt` is what `qa-runner` does instead
  when a brief names no report destination. **Keep all three in step with the plugin**,
  or the fixture measures an orchestrator it no longer ships.
- `make-plugin.sh` copies the plugin and changes only Playwright's launch flags.

A correct run gives these verdicts, and anything else is a regression in the testing
rather than in its cost:

| Behavior | Verdict | `make-run.sh` | `make-run-listfirst.sh` |
|---|---|---|---|
| A paid order shows Cancel | pass | S1 | S2 |
| Cancelling confirms and updates the status | pass | S2 | S3 |
| The API shows the cancellation | pass | S3 | S4 |
| The list shows "Cancelled" | **fail** — it shows "Canceled" | S4 | S5 |
| A cancelled order offers no Cancel | **fail** — the button is still there | S5 | S6 |
| The API refuses a refunded order | pass | S6 | S7 |
| Search reports one result | pass | S7 | S1 |

## Running it

```
tests/agentic-qa-fixture/run.sh <label>
MAKE=make-run-listfirst.sh tests/agentic-qa-fixture/run.sh <label>
LIVE_REPORT=off tests/agentic-qa-fixture/run.sh <label>
```

It needs `claude`, `node`, `npx` and a Chromium that Playwright can launch. In a
container, or as root:

```
PW_FLAGS="--headless --isolated --no-sandbox" CHROMIUM=/path/to/chrome tests/agentic-qa-fixture/run.sh <label>
```

To measure an earlier version of the plugin, extract it and pass its directory:

```
git archive <commit> plugins/agentic-qa | tar -x -C /tmp/old
tests/agentic-qa-fixture/run.sh <label> /tmp/old/plugins/agentic-qa
```

The prompt copies the current command, so for a version before 0.6.0 put the old
command's Phase 4 text back in it first.

The session is given a list of allowed tools and no permission bypass, which is how an
unattended run should be set up. `run.sh` prints the verdicts and a table of calls and
tokens per agent. `turns.mjs <run dir> <agent>` splits one agent's usage by the message
that woke it, `trace.mjs <run dir> <agent>` lists its tool calls and their results, and
`calls.mjs <run dir> <agent>` prints one line per API call: the context it read, what it
added, and each tool call with the size of what came back.

## The whole pipeline, unattended

```
tests/agentic-qa-fixture/run-unattended.sh <label>
```

`run.sh` starts at Phase 4 with a plan written by hand. This starts from a brief: a
calling agent spawns `agentic-qa:qa-runner`, which runs Intake, both drafter and critic
pairs, the executor and the reporter against the same app, with nobody to answer
anything. It is the only thing here that exercises `qa-runner`, Intake, the drafters
and the critics, and the guard's rules for each of them.

- `unattended/bin/gh` stands in for `gh`. It answers the read commands with one issue,
  its merged pull request and that pull request's diff, from `unattended/ticket.md` and
  `unattended/pr-7.diff`, and fails on anything else. The script puts it first on
  `PATH` and logs each call.
- `unattended/caller-prompt.txt` is the calling agent and its brief.
- The diff shows both planted defects, so a coverage critic that reads it has something
  real to find.

The plan is made by the pipeline, so there is no table of expected verdicts. A correct
run plans and runs a step for each of the ticket's six criteria, reports the two
defects, the list's "Canceled" and the Cancel button that stays, and lists its open
questions in the report. The first run of this fixture left the search criterion
blocked on a question, which is the kind of regression it is here to show.

It needs agents to be able to spawn agents. Where `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`
is 1, `qa-runner` is given no `Agent` tool and escalates at once: run the script with
that variable set to 2.

`CALLER=caller-prompt-escalation.txt` runs it with a second caller. Its brief grants
nothing in advance, so the run stops at its first irreversible step and returns an
escalation; the caller answers a contained one once, as an agent, and waits for the
report. A correct run records the step as decided by the caller, finishes the report
with HTML, and reports the same two defects. It is the only thing here that resumes
`qa-runner` with an answer.

It costs several times what `run.sh` does.

## What it can't tell you

- **One run is not a measurement.** Across runs of the same seven steps the reporter
  made 18 to 25 calls. Compare a structural number where there is one, such as an agent's
  context per call, and treat a difference in total cost of less than about 10% as
  noise until it repeats.
- **A warm cache flatters the second run.** A run that follows another with the same
  agent text reads a cached prompt where the first one paid to write it.
- **`run.sh` doesn't run Phases 0 to 3.** Only `run-unattended.sh` does, and it has
  run ten times: seven to the end, two to an escalation nobody answered, and one through
  an escalation its caller answered.
- **The search form does nothing on Enter.** It has a Search button, and the criterion
  passes through it. That is not one of the two planted defects. A run that fails the
  search criterion after pressing Enter alone has used the wrong control.
- **Only Sonnet has been measured.** Which tools an executor reaches for is the model's
  choice, and another model will choose differently.
