# agentic-qa

A Claude Code plugin that runs a live QA walkthrough — a browser, an API, a CLI — against a finished feature or fix, the way a QA engineer would, not by writing test code.

## What It Does

The premise: a ticket and its merged PR describe what should be true of a running system. This plugin drives that system and checks. It is not `testing`'s `/test-write` run against a live server — it produces no test code, and it is not trying to prove the logic is correct in general; it is trying to confirm this one described behavior actually works, right now, against the real thing.

- **`/agentic-qa:walkthrough`** — the interactive entry point. Resolves a ticket and its merged PR, extracts a behavior spec, plans a step-by-step verification, reviews it with the user, runs it against the live system, and writes a report with embedded screenshots.
- **A drafter/critic exchange**, twice — once extracting behaviors from the ticket, once planning the steps. The orchestrator carries each round between the drafter and its adversarial critic, and the drafter that wrote the draft is resumed, with its reasoning intact, to revise it. Up to two rounds, every one logged.
- **A blast-radius critic that reads the diff, and the code that uses what it changed** — the plugin's actual edge over a human QA process. A person testing a ticket generally can't read the code that implements it and reason about what else it touches; this critic does, and every finding it raises has to cite a real line, not an impression. A diff shows what was changed and not what calls it, so when the session is in a checkout of the PR's repository the critic searches it for the other users of each thing the diff changed: a report, an export or an endpoint the ticket never mentions and the diff never touches. Each one it finds becomes a behavior a step checks or observes. **Start the session in that checkout**, at a commit that holds the merge. Anywhere else the critic has only the diff, and says so in its findings.
- **A hard split between two kinds of irreversible action** — one that stays inside the target environment and test account, and one that reaches something real outside it (an email that delivers, a real payment, a shared resource). Only the first can ever be pre-authorized in bulk; the second always gets individual attention, in every mode.
- **Agent-invoked operation** — another agent can dispatch a walkthrough unattended via `agentic-qa:qa-runner` or by calling the umbrella skill directly, handing it a brief instead of a conversation. Anything that needs a decision pauses the run and returns an escalation to whoever invoked it, rather than guessing or halting outright; the caller resumes the run with the answer, so it needs `SendMessage`. It can proceed, decline the step, or stop the run, and a stopped run still gets a report. An answer states who decided, and an agent's answer can never clear a step that reaches something real outside the test environment.
- **A question doesn't stop what the ticket asked for** — the pipeline raises questions about what a ticket leaves open, and a criterion the ticket states is tested as written even when one of them asks what else it might mean. The question goes into the report beside the result. Only a behavior with no stated result waits for an answer, which matters most when nobody is there to give one.
- **An observation is not a pass** — a behavior nobody stated a result for, usually one the critic found in the code, is run where that changes nothing and recorded as `observed`: what the system does today, shown against the open question it belongs to and counted apart from the passes. Where running it would change something, it stays blocked.
- **A report with the evidence in it, not just links to it** — `walkthrough-report.html` embeds every browser step's screenshot and renders once the run finishes; `walkthrough-report.md` is the working copy behind it, brought up to date after every step when a person is at the session or a report destination is set, and otherwise when the run pauses and when it ends.

## Prerequisites

Requires the **`testing`** plugin — Extract Behaviors runs `testing:behavior-extraction` directly and will not improvise an extraction procedure if it isn't installed. It is declared as a dependency in the manifest.

Requires `gh` for ticket/PR resolution.

### Running unattended

An unattended run needs these in place first, because nobody is there to supply them:

- `allowed_hosts`, and any `identity_hosts` and `allowed_commands`, in `~/.claude/agentic-qa.local.md`. A fresh checkout holds no gitignored file, and an unlisted host stops the run until a person adds it.
- A `browser_session` storage state for any browser step, since a live login needs a person.
- A caller holding `SendMessage`, and a brief with `pre_authorize_contained` if `contained` steps should run without one escalation each.
- One walkthrough at a time in each Claude Code session. A session's agents all drive its one Playwright browser, so walkthroughs that should run at once each need a session of their own. See the Playwright config, below.
- Agents that can spawn agents. `qa-runner` is a spawned agent that spawns the rest of the pipeline. Where a session limits spawn depth to one, which `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` does, it is given no `Agent` tool and escalates before doing anything. Raise the limit to two, or have the caller run the pipeline itself.
- A session that outlasts the run. A headless session (`claude -p`) stops agents that are still running ten minutes after its last turn, and on Claude Code 2.1.330 a caller waiting on `qa-runner` had its turn ended after about two minutes with the runner left running. A run longer than that is stopped part-way, with its report still in progress and `Background tasks still running 10m after the last turn` on stderr. Set `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` to longer than your longest run, in milliseconds, or to `0` to wait without limit.
- Permission for `Bash` in `qa-runner` and the executor. A permission mode that prompts will hang, and a classifier may refuse broad grants: check this in your environment before relying on it.
- A `gh` login that can only read. `qa-runner` runs `gh` with whatever token the machine has, and a default `gh auth login` token can comment, merge and delete. Use a fine-grained token that is read-only for issues, pull requests and contents on the repositories under test.
- A credential file somewhere other than `~/.config`, `~/.claude`, `~/.ssh` or `~/.aws`. The guard protects those directories whole, so a `file:` reference into one is refused.
- `browser_driver: claude-in-chrome` in `~/.claude/agentic-qa.local.md` if the run is to use your own Chrome. A brief naming that driver is not enough.
- `live_report: true` in the brief if something will read `walkthrough-report.md` while the run is going. Without it, and without a `report_destination`, the report is filled in when the run pauses and when it ends, which cost $0.57 on the fixture where a run with updates cost $0.68 to $0.80.

Steps classified `escapes` never run unattended. They finish as `not verified`, and need a person.

### How the agents communicate

The pipeline's agents hand work to each other with `SendMessage`, resuming one another by agent ID. That needs no agent-teams setting: subagents were offered `SendMessage` with no flag set on Claude Code 2.1.318, where this was last checked. On that version a resumed agent's result doesn't wake a spawned agent that resumed it, so `qa-runner` stays alive by waiting on signal files in a Bash loop. An unattended run needs permission for that.

Credentials are given as a reference, never a value: `env:NAME`, or `file:/absolute/path` outside the repository. The value is read inside the command that uses it, because Claude Code saves conversations, spawn prompts and tool calls to transcripts on disk. Don't paste a password into the conversation. A browser login is done live by you, or comes from a storage state.

Any behavior planned against the browser surface needs a browser driver, and there are two. The default is **Playwright MCP**, which the plugin ships configured: no setup beyond having `npx` on the machine. Its browser is separate from yours, so a hostile page or a mistaken step can reach only what that browser holds. `claude-in-chrome` is available if you choose it, after Intake tells you what that means: the run acts as whoever is logged in to your own Chrome, next to every other site you're signed in to. Its tools are registered even when no browser is attached, so Intake checks for a live connection rather than trusting that they're listed. Intake records the driver in `intake.md`, so the choice is made once, before any planning, and travels with the run into the report. An agent-invoked run can't see the session's browser tools, so its brief names the driver in `browser_driver`, defaulting to `playwright`.

Whichever driver runs, the executor checks that the browser is logged in as the test account before the first browser step, and escalates if it isn't.

If **neither** is available, browser steps are still planned — and then marked `blocked — no browser driver`, with the count surfaced at the User Gate before you approve anything. They are never quietly re-planned onto the API: an API check would pass even if the button were broken, and a behavior about what's rendered has no API equivalent at all. You decide whether to fix the environment, narrow the run, or proceed knowing what won't be covered.

Playwright acts on element references from an accessibility snapshot rather than screenshot coordinates, which makes a failed action attributable to the page instead of to a misplaced click, and it captures console messages and network requests — evidence for a step whose expected result concerns something the rendered page can hide. The executor reads the part of a page a step names, with `browser_find`, and takes the whole snapshot only when that can't carry the verdict: an element that isn't there, an expectation that something is absent, a page that could show a secret.

What does differ is the session. Playwright launches its own browser, not yours, and keeps nothing from one run to the next, so every interactive run starts logged out: it stops and asks you to log in live, unless you name a saved storage state at Intake. After a live login the executor offers to save one. An agent-invoked run loads the brief's `browser_session` storage state instead and escalates if it's missing or expired.

Six things about the shipped Playwright config worth knowing before you install:

- **It runs in every session.** Claude Code starts a plugin's stdio MCP servers when the plugin is enabled, not on first use, so enabling `agentic-qa` means a small Node process starts each session whether or not you ever run a browser step. Its 48 tools, including `browser_run_code_unsafe`, are also offered to your main session, not only to the executor.
- **`--isolated` is what lets walkthroughs run at once.** Without it Playwright keeps a profile on disk for each working directory, and only one browser can have a profile open. On 0.0.81 a second session started in the same directory failed at its first browser step with `Browser is already in use … use --isolated to run multiple instances of the same browser`, and a session's browser keeps its profile until the session ends, not only while a walkthrough runs. Isolated, each session's browser keeps its profile in memory, so no cookie or stored value carries over from one run to the next. Neither does a login, which is the cost: a saved storage state stands in for the profile that used to remember one. A headless browser left for an hour without a call is closed and the next call starts an empty one, so the executor checks the login again after every pause.
- **The version is pinned**, deliberately. A walkthrough's worth as evidence depends on knowing what produced it, and `@latest` would mean the same walkthrough run two months apart used provably different tools.
- **`--caps=testing,storage` is required, not optional.** The verification tools and both storage-state tools sit behind non-default capability groups; without that flag the server silently doesn't expose them. Note that `--caps --help` lists only `vision, pdf, devtools` — `testing` and `storage` are real, working values the CLI's own help text omits. Don't remove the flag on the strength of that help output.
- **Its files go to `.cache/agentic-qa/playwright-output` in your home directory, not your repository.** Playwright writes snapshots, screenshots and storage states to an output directory, and confines file access to that directory and the session's working root. Left at the default, both are your repository. `--output-dir` points it at your home's `.cache` instead; the executor copies each screenshot from there into the run's `evidence/` and deletes the original. It is not under `~/.claude`, where the plugin's own data directory is, because a session that isn't in bypass mode may not copy or delete anything there, and no permission rule changes that. The setting reaches your home by climbing out of `CLAUDE_PLUGIN_DATA`, so with a relocated Claude config directory it lands somewhere else. `--allow-unrestricted-file-access` would also remove the confinement, and is deliberately not used: it lets the browser open `file://` URLs.
- **Screenshots come back as a path, not an image.** `--image-responses omit` keeps the server writing every screenshot to disk while leaving the image out of the tool result, which otherwise stays in the executor's context and is paid for again on every later call of the run. The executor judges from the accessibility snapshot, and opens a screenshot only when a step's expected result concerns appearance. This affects only your main session if you call Playwright's tools yourself: their screenshots won't show inline either.

Walkthroughs can run at the same time in separate Claude Code sessions: two terminals, or one `claude -p` per brief in CI, in the same working directory or not. In one session they can't. Claude Code starts one Playwright server per session and every agent in the session shares it, its tools acting on whichever page is current, so two walkthroughs would click through each other's pages under each other's logins; and Claude Code ignores `mcpServers` in a plugin's agents, so the executor can't be given a server of its own. Separate sessions still share Playwright's output directory. A brief's storage state is copied there under each run's own name and deleted once loaded, but the server names a screenshot for the moment it was taken, to the millisecond, so two sessions could in principle write the same name at once.

## Before you run it

A walkthrough only accepts a ticket **with real acceptance criteria** and its **merged** PR — cross-resolved from whichever one you give it — and checks that the running system contains that merge. If nothing can show either way, the report says so at the top. This isn't a tool for planning a feature or reviewing one still in flight; it tests what's already landed. Production is refused outright as a target, in every mode, with no confirmation path around it.

That refusal is enforced by an allowlist, not by guessing from a hostname. A target is accepted only if its host — after following redirects — is in `allowed_hosts` in `.claude/agentic-qa.local.md`; `localhost` is always allowed. The list is checked before anything is sent to the target, and each redirect's host is checked before it is followed, so a host nobody has listed is never contacted to find out what it is. The first time you point a walkthrough at a new host, it asks whether the host is non-production and saves your answer. An agent-invoked run never adds to the list: an unlisted host escalates to its caller, and a brief can't carry its own allowlist.

The list applies to every step, not only the first URL. Each step declares its target, and the planner, critic and executor each check it. A `PreToolUse` hook, `hooks/target-guard.mjs`, enforces it for the executor. Its `Bash` runs only a fixed list of file and text tools and `curl`, written in a small part of shell: plain commands, quotes, `$NAME`, a plain `$(command)`, redirects and heredocs with a quoted delimiter. Every `curl` must start with `-q` and use only literal allowed hosts with no redirects or proxies. Every file is named literally, with no variable or glob, and the executor writes only inside the run's working directory and Playwright's output directory, through `Bash` or the file tools. Browser navigation must go to an allowed host, and any other program must be listed by you in `allowed_commands`, including the CLI you're testing. The hook acts only on this plugin's own agents, and adds a short Node process to `Bash`, file-write and `Agent` calls in any session where the plugin is enabled.

A refusal ends the executor's turn in an escalation, and it doesn't try another way. The exception is a refusal of how a command was written rather than what it reaches: a variable or a glob in a path, an unquoted heredoc, a write aimed outside the working directory. The guard says so and names the fix, and the executor sends the command once more, to be checked in full like any other. A step escalates twice for the same reason and is then recorded as not verified, so an answer that can't resolve it can't keep the run going round.

**Know what the hook doesn't do.** It isn't a sandbox:

- It makes the executor's `curl` print a response only through a filter that masks fields named like credentials, and never print headers, because what a command prints is kept in the transcript. That covers JSON from `curl`. It does not cover what a page shows in the browser, or what a program on `allowed_commands` prints.
- It can't see where a click or a server redirect lands in the browser. That rule is still an instruction to the agent. Point Playwright at a host that can't reach production if that matters to you.
- A program you list in `allowed_commands` can do anything, including reach the network, and the hook only checks that its name is on the list. Where a CLI points, including its ambient context (`kubectl`, `aws`), is confirmed by instruction only: the plan names a read-only command that prints it, and the executor runs that before the step.
- It reads shell text, and a reader of shell text can disagree with bash. Three rounds of review each found ways past it. The third answer was to accept only the small part of shell described above and refuse the rest, so what is left to get wrong is smaller, not gone. Treat the next bypass as expected.
- The executor's writes are held to two directories. Its reads are not held to any: it may not name a credential directory, the allowlist or a shell startup file, but any other file the OS user can read, it can read with `Bash` or with the `Read` tool, which the hook is not called for. An environment variable can be sent to an allowed host in a request. Use test credentials, and run where nothing else worth reading is.
- `localhost` is allowed on every port. On a machine where a tunnel or a local admin API listens, that is not staging.
- The other agents are held less. `behavior-extractor` and `step-planner` have no `Bash`, and their file tools are refused the protected names. The two critics have no `Bash`: each writes its findings with a file tool, and the guard lets that write nowhere but a run directory. The reporter is held to a list of its own: the executor's file and text tools without `curl`, and `node` only to run the renderer this plugin ships. It writes only in the run's working directory and in a folder named for the run, which is what a report destination's folder is. `qa-runner` is held to a list of its own: the executor's programs, `curl` under the executor's rules, `gh` only to read issues and pull requests, `git` in three exact forms, and the wait on a signal file. It writes only in a run directory. It still holds `WebFetch`, which fetches any URL, and `Read`. An agent that runs the pipeline itself, without `qa-runner`, is not one of this plugin's agents and is not held at all.
- Those files belong to the same OS user the agents run as, and a program on `allowed_commands` can write anywhere. For unattended runs, mount `~/.claude/agentic-qa.local.md` and the plugin read-only if you can.
- It relies on Node, which `npx` already requires. If the hook can't start at all, Claude Code treats that as non-blocking.

For an unattended run against anything that matters, also run it somewhere whose network can't reach production: a container or CI runner with egress limited to staging. That is the real boundary, and this hook is a second layer.

A login provider is handled separately. Staging behind single sign-on usually redirects to a production identity provider, so Intake asks whether that host is the login provider and records it in `identity_hosts`, where it can only ever be somewhere a login happens.

## Invocation names

Everything this plugin ships is namespaced, with no bare-name fallback. The command is `/agentic-qa:walkthrough`. The five skills are `agentic-qa:agentic-qa`, `agentic-qa:behavior-coverage`, `agentic-qa:step-planning`, `agentic-qa:step-execution`, and `agentic-qa:qa-reporting`. The seven agents are `agentic-qa:behavior-extractor`, `agentic-qa:behavior-coverage-critic`, `agentic-qa:step-planner`, `agentic-qa:step-plan-critic`, `agentic-qa:step-executor`, `agentic-qa:qa-reporter`, and `agentic-qa:qa-runner`.

## What a run costs

Measured on a fixture, not on your tickets: seven steps, five of them in a browser, against a small local app, with the earlier phases prepared by hand, on Claude Code 2.1.330. Every figure but the last bullet's is with every agent on `claude-sonnet-5-5`, as the plugin ran through 0.18.0. `tests/agentic-qa-fixture` in this repository reruns it, and `docs/reviews/agentic-qa-cost-2026-11.md` has the runs.

- Execution and reporting cost $0.68 to $0.80 a run at list prices with the report updated after every step, in three runs, and $0.57 without, in one. Intake, the two drafters and the two critics are extra and weren't measured.
- About half of that is the testing. With per-step updates the executor processed about half the input tokens, the reporter about a third and the orchestrator the rest, because every agent pays for its own instructions before it does anything.
- The reporter's update after each step is six to seven tenths of what it reads. That is why an unattended run with nobody to watch the report doesn't make them.
- A run that stops at its first step costs about two thirds of one that finishes. The orchestrator and both agents have already loaded everything by then.
- On a second fixture, a team-settings app with a login, a CLI and a step that must not run unattended, five whole runs cost $2.06 to $2.35 each for 12 to 15 steps planned.
- A whole unattended run, from a brief to a report, cost $1.47 to $1.55 in the three runs of 0.12.0, for 6 to 8 steps run, and $2.14, $1.78 and $1.62 in the versions before. The executor is the largest part, at about four tenths of the input tokens, and `qa-runner` is about a quarter. Every turn an agent takes carries its whole context, so most of what was saved came from taking fewer turns and from not reading a whole list to pick one row.
- From 0.19.0, with three agents on Haiku, a whole unattended run cost $0.67 to $0.94 on the first fixture and $0.90 to $1.28 on the second, in five runs of each. The same five with every agent on Sonnet cost $1.35 to $1.70 and $2.05 to $2.72. Execution and reporting alone, with the report updated after every step, cost $0.23 to $0.28 in four runs.
- At 0.20.0, in ten runs of each, a whole unattended run cost $0.71 to $0.93 on the first fixture, $1.06 to $1.69 on the second and $0.72 to $1.05 on a third, a two-criterion ticket whose change breaks code that neither the ticket nor the diff mentions. The critic's search of the checkout is in the third figure, on an app small enough to read in a few calls; on a large repository it has not been measured.

`agentic-qa:qa-runner`, `agentic-qa:step-executor` and `agentic-qa:qa-reporter` run on Haiku. The extractor, the planner and the two critics run on Sonnet. None of them takes your session's model, so a run costs the same from an Opus session as from a Sonnet one: with every agent inheriting, one run of each fixture from an Opus session cost $4.34 and $6.12.

The four on Sonnet decide what the ticket asks for and what gets tested, and nearly every miss the fixtures have found in what a run tests was in that part. The three on Haiku carry out a plan that is already written. In the last thirty runs, ten of each fixture, every check held in twenty-nine: each criterion's verdict, the planted defects, the steps that must not run, and on the third fixture the three effects nobody mentioned. The one that missed lost a linked doc at Intake, which 0.20.0 changes.

Whether the planning agents should run on Opus was tried on the third fixture. With them on Opus the critic searched the checkout unasked in four runs of five and found the broken report; on Sonnet it read the diff, as it was told, in ten of ten and found nothing beyond it. Once told to search, the critic on Sonnet found it in every run since, twenty-five of twenty-five, at about four tenths of what planning on Opus cost. So the gap was in the instructions, and a stronger model had been filling it in most of the time.

An agent on Haiku fails in more ways than one on Sonnet, and mostly by stopping. It escalates, or records the step as not verified, and the report says so; it asks about one step at a time where one on Sonnet asked about several at once, so a caller may answer more escalations. Three ways were seen once each in the eighty-six runs behind 0.20.0 and are now handled: an executor that escalated over a refused `pwd` before testing anything, a reporter that answered the request to finish and wrote nothing, and a runner that deleted a doc it had saved. The guard now runs `pwd`, the runner spawns a second reporter, and a saved doc is kept. No step run by an executor on Haiku was given a verdict its evidence did not support in any run read. The wrong criterion verdicts that were seen, three in two evals of fifteen runs before the rules that fixed them, came from where the spec or the plan, both written on Sonnet, drew the line around a criterion, and the defect itself was in the report each time. These are three small local apps with defects planted to be found, and a page harder to read than theirs has not been tried.

To run every agent on your session's model instead, start the session with `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`. Claude Code then ignores each agent's `model` line; the 0.19.0 figures with every agent on Sonnet were measured that way.

The reporter's work is filling a template from `step-results.md` and running the script the plugin ships to render the HTML. That script escapes everything the ticket and the system under test supplied, embeds only files from the run's own evidence folder, and has its own tests.

## Settings

Environment answers (base URL, environment name, report destination) can be saved to `.claude/agentic-qa.local.md` on first run so a later walkthrough on the same project doesn't ask again. The same file holds `allowed_hosts`, the production gate's allowlist, and `identity_hosts`. All of them live in YAML frontmatter:

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
allowed_commands:
  - mytool
---
```

It is a per-machine file; add `.claude/*.local.md` to `.gitignore` if the repo doesn't already. **The project's copy counts only when git says it is untracked.** A copy git tracks is ignored, because anyone who can merge could otherwise edit the production gate, and so is one git can't answer for: a broken checkout, one owned by another user, or a directory that isn't a checkout at all. The lists can be block lists or `[a, b]`. An entry the guard can't read is named in the refusal it leads to. The same file at `~/.claude/agentic-qa.local.md` is read too, and is the place for hosts that should stay allowed across clones and for unattended runs. Credentials are never written to this file; it holds at most a reference.

## Working directory

A run's artifacts — `intake.md`, `behavior-spec.md`, `step-plan.md`, `step-results.md`, `evidence/*`, and the two report files — live in a working directory new to that run, reported when it is created so an interrupted run can be found. If a report destination was configured, the report and its evidence are also copied to a subfolder for that run, incrementally as the run progresses.

If a run is interrupted, give the rerun the earlier directory (`previous_run` in a brief). An irreversible action is recorded before it is sent, so the rerun knows what may already have happened, and no grant covers repeating it.

Evidence is masked before it is written: credential headers, URL query strings, connection-string passwords, credential-shaped values, and token, password and secret fields in response bodies and command output are replaced with `<masked>`. A screenshot that shows a secret the executor couldn't hide is marked sensitive and stays in the working directory only — never embedded in the HTML report, never copied to the report destination. Masking is done by a model reading the output, so it reduces this risk without removing it. Use test credentials, and don't treat a report or a transcript as free of secrets.
