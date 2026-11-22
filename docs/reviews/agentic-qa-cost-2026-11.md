# agentic-qa cost review — November 2026

A review of `agentic-qa` 0.5.0, read at `1932953`, for one question: where does a
walkthrough's cost go, and what can be removed without the testing getting worse. The
changes it led to are 0.6.0, and 0.7.0 for the decisions it left open, which the
Resolution section records. Finding numbers are local to this review (C1 to C7); the
earlier reviews are about safety and are cited where they bear on cost.

## Conclusion

Three things, in order of how much they matter.

1. **The most expensive run is the one that stops at its first step.** Of the first five
   fixture runs, three ended at S1 with nothing verified, each over how the executor
   handled a file path. A run that stops there still costs about two thirds of one that
   finishes, because the orchestrator and both agents have loaded everything by then.
   0.6.0 removes the three causes it could (C1).
2. **Less than half of a run's tokens go on testing.** In the one completed baseline run
   the executor processed 43% of the input tokens, the orchestrator 30% and the reporter
   27%. 0.6.0 takes the orchestrator's share to about 17% by not loading two skills it
   doesn't use (C2).
3. **The executor reads a whole page when it needs one line of it,** once per run, on the
   first page it sees. On a 100-row page that cost 12,000 tokens of context carried for
   the rest of the run. 0.6.0 stops it (C3).

On the fixture, 0.6.0 completed with the same seven verdicts as 0.5.0, both planted
defects included, at $0.68 to $0.70 a run against $0.75 to $0.97. That comparison is one
run per configuration, so the structural numbers below are worth more than the totals.

The largest saving still available is a product decision and was left alone: the
reporter's update after every step is six to seven tenths of what the reporter reads
(C4).

## Evidence

Each finding states its basis:

- **Measured (server):** the pinned `@playwright/mcp@0.0.81` driven directly over stdio
  with the plugin's flags against a local page, and the size of each tool result
  recorded.
- **Measured (run):** a fixture run of the real Phase 4 and 5. A headless
  `claude -p` session on Claude Code 2.1.330 with `claude-sonnet-5-5` followed the
  command's Phase 4 and 5 text and spawned the real `qa-reporter` and `step-executor`
  against a local app, with `intake.md`, `behavior-spec.md` and an approved seven-step
  `step-plan.md` written by hand. Token counts come from the session's transcripts and
  cost from the CLI's own `total_cost_usd`, which it reports at list prices. The fixture
  is in `tests/agentic-qa-fixture`.
- **Projected:** `claude plugin details`, which estimates each component's tokens.
- **Reasoned:** read from the instructions.

The fixture app has two planted defects, so a correct run is five passes and two
failures. Every completed run below gave exactly that.

### What wasn't measured

- **Phases 0 to 3.** Intake, the two drafters and the two critics need a real ticket and
  a real diff. Nothing here says what they cost.
- **Any model but Sonnet.** Which tool an executor reaches for is the model's choice.
- **Repeats.** Each configuration ran once. Across runs of the same seven steps the
  reporter made 18 to 25 calls, which moves a run's total by about a tenth on its own.
- **An escalation answered by a person.** The fixture has nobody to answer one.
- **The guard's new refusal message in a run.** It is covered by the guard's tests, and
  no run after the change happened to produce a refusal of that kind.

### The runs

All on `claude-sonnet-5-5`, with a 100-row orders list. "List first" is the same seven
steps reordered so the first page the executor sees is the large one.

| Run | Plugin | Plan | Outcome | Cost |
|---|---|---|---|---|
| a0 | 0.5.0 | standard | Stopped at S1. The session refused `cp` out of `~/.claude/plugins/data` as a sensitive file | $0.55 |
| a0b | 0.5.0, Playwright output moved out of `~/.claude` | standard | Stopped at S1. The executor ran `find /` to locate a screenshot, and the guard refused it | $0.47 |
| a1 | as a0b, and the executor told the output directory | standard | 7 of 7 correct | $0.75 |
| b1 | first draft of the executor changes | standard | 7 of 7 correct. S1's entry was written after S2 ran | $0.79 |
| c0 | second draft | standard | Stopped at S1. `P=<dir>; cp "$P/…"` refused by the guard | $0.45 |
| c1 | 0.6.0 less the account check and the program list | standard | 7 of 7 correct | $0.68 |
| a2 | as a1 | list first | 7 of 7 correct | $0.97 |
| c2 | as c1, not told the output directory | list first | 7 of 7 correct | $0.74 |
| c3 | 0.6.0 less the program list, not told the output directory | list first | 7 of 7 correct. `pwd` was refused, and the executor left it out and carried on | $0.70 |

The nine runs cost $6.10 in all.

Input tokens processed (cache reads plus cache writes, thousands), calls, and the
largest context an agent reached (thousands):

| Run | Orchestrator | Executor | Reporter |
|---|---|---|---|
| a1 — 0.5.0, standard | 634 in 9 calls, 77 | 908 in 19 calls, 56 | 569 in 19 calls, 37 |
| c1 — 0.6.0, standard | 343 in 6 calls, 61 | 938 in 20 calls, 54 | 708 in 23 calls, 39 |
| a2 — 0.5.0, list first | 795 in 11 calls, 79 | 1,191 in 19 calls, 73 | 538 in 18 calls, 37 |
| c3 — 0.6.0, list first | 343 in 6 calls, 61 | 1,019 in 22 calls, 56 | 765 in 25 calls, 38 |

---

## Findings

### C1 — A run that stops at its first step costs two thirds of one that finishes

Three of the first five runs ended at S1 with seven steps `not verified`. They cost
$0.45, $0.47 and $0.55, against $0.75 for the baseline run that finished. Each was
about a path:

- **A shell variable in a path that gets written.** The executor wrote
  `P=<dir>; cp "$P/…" "$P/…"` in two runs. The guard refuses a variable there, the
  refusal said "do not rephrase this", and in c0 the executor escalated as told. In a0
  it resent the command with literal paths anyway, against its instructions. The
  agent's prompt already said "name write destinations literally".
- **`find /`.** Playwright reports a screenshot's path relative to the session's working
  directory, and nothing told the executor that. Given `../pw-out/page-….png` it went
  looking for the file, and `find` isn't a program the guard allows (a0b).
- **The plugin's own data directory.** In a0, with literal paths, the session itself
  refused `cp` from `~/.claude/plugins/data/…/playwright-output` as a sensitive file.
  This was a headless session given a list of allowed tools and no bypass.

The second November review saw this coming as F54 and F55: ordinary operations refused,
and each refusal stalling the run.

Basis: **Measured (run).**

Changed in 0.6.0:

- The guard now tells apart a refusal of how a command is written from a refusal of what
  it reaches, and for the first asks for the command once more with every path spelled
  out. What it allows is unchanged, and the literal command is checked in full
  (`fb9c95a`).
- The skill says what a reported path is relative to, and that one climbing into
  `.claude` must be written out as an absolute path (`9b7049c`). c2 and c3 were not told
  the output directory and both resolved it.
- The skill lists the guard's programs exactly, with a test holding the two lists
  together (`e1a6339`).

Not changed: the sensitive-file refusal. It comes from where Playwright's output lives,
and moving it is a decision with a history (see "Decisions left open").

### C2 — The orchestrator loaded two skills it doesn't use

`/agentic-qa:walkthrough` and `qa-runner` both loaded `step-execution` and
`qa-reporting` before Phase 4. `claude plugin details` projected those at about 9,800 and
3,200 tokens in 0.5.0. They are the executor's and the reporter's procedures, each agent loads
its own copy, and the command's Phase 4 text already says everything the orchestrator
does.

The orchestrator's context is the largest in the run, because it also carries Claude
Code's own prompt and every tool, so each of its calls is the most expensive call there
is. In a1 it reached 77,000 tokens. In c1 and c3, without the two skills, 61,000.

Basis: **Measured (run)** for the context sizes, **Projected** for the skill sizes.

Changed in 0.6.0 (`b9ad6a3`): neither orchestrator loads them. The two rules an
orchestrator did need from `step-execution` moved to where it already reads: the
abnormal-end rule into the command, `qa-runner` and the umbrella skill, and the rerun
rule into the umbrella's Intake section. That second move also fixes part of F53, since
`qa-runner` never loaded the rerun rule before Intake.

c0 exercised the new text on the one path the fixture can reach beyond the ordinary one:
the executor escalated, and the orchestrator, without either skill, sent the reporter
`final: run ended abnormally`, waited on the signal file, and reported an incomplete
run.

### C3 — The executor read a whole page to find one line

Against the pinned server, with the plugin's flags:

| Call | 50-row page | 400-row page |
|---|---|---|
| `browser_snapshot`, whole page | about 6,700 tokens | about 48,000 |
| `browser_snapshot` with `target` set to the search form | about 100 | about 100 |
| `browser_find` for one element | about 130 | about 130 |
| `browser_navigate`, `browser_click` | about 55 | about 55 |

Token figures are characters divided by four. A navigation or a click returns the page's
URL and title and saves the snapshot to a file instead of returning it. `browser_find`
needs no snapshot first, and the references it returns work in `browser_click` and
`browser_type`. The executor didn't hold it.

The skill said to "work from `browser_snapshot`". On Sonnet the executor mostly didn't:
after the first page it searched the saved snapshot file with `grep`, on its own
initiative. But in all eight runs before the account check was narrowed it took the
whole of the first page it saw, to confirm the logged-in account. On the standard plan
that page is small. On the list-first plan it is the 100-row list: about 12,000 tokens,
carried on every later call. The executor's context peaked at 73,000 tokens in a2 and
56,000 in a1, and a2 cost $0.97 where a1 cost $0.75.

Basis: **Measured (server)** and **Measured (run).**

Changed in 0.6.0 (`ebe9153`): the executor holds `browser_find`, and reads the element
the plan names. In c3, on the list-first plan, it took no whole-page snapshot and peaked
at 56,000 tokens.

Reading narrowly has its own way of going wrong, and the baseline executor was already
doing it with no rule about how. The skill now names three cases:

- "Absent" is never judged from a search that found nothing, since a search for the
  wrong words finds nothing too. The executor snapshots the region the thing would be
  in. b1, c1 and c3 each did this for the step that checks a button is gone.
- A search for the text Expected predicts finds it wherever it appears, so the search is
  for the element. `browser_verify_text_visible` alone never settles a verdict.
- An element that isn't found is recorded only after looking at what the page shows
  instead.

A page that could show a secret is still read whole before its screenshot, because the
masking rule needs the executor to know what is on screen.

What this costs in quality is the incidental observation: an executor that sees less of
a page notices less that the plan didn't ask about. The screenshot of every browser step
is unchanged, so a person reviewing the report sees what they saw before.

### C4 — The reporter's per-step updates are most of what it costs

In a1 the reporter read 537,000 cached tokens in 19 calls. Its skeleton took 49,000 of
those, finalization 104,000, and the six per-step updates 385,000: 72%. The updates were
also 4,300 of its 8,100 output tokens. In c1 the updates were 411,000 of 675,000.

Each update is two or three calls: read the new entries, patch the report, and copy it
if a destination is configured. The reporter's context grows with the report, so later
updates cost more than earlier ones.

What the updates buy is `walkthrough-report.md` being current while the run is going.
They are not what makes the report correct: on `paused` and on `final` the reporter
rebuilds from `step-results.md` whatever it has or hasn't been told.

Basis: **Measured (run).**

Not changed. See "Decisions left open".

### C5 — The reporter summarized each update for nobody

After each update the reporter ended its turn with a paragraph on what it had just
written: 230 to 730 characters each in a1. The orchestrator is told to ignore these
notices.

Basis: **Measured (run).**

Changed in 0.6.0 (`5f15870`): a turn that isn't finalization ends with `ok`. In c1 every
such turn did. The saving is small, a few hundred output tokens a run.

### C6 — A step's entry could be written after the next step ran

The executor sends several tool calls in one response. The skill said to append an entry
and then nudge the reporter, without saying that the entry has to exist before the next
step's action. In b1, under a draft instruction that encouraged batching and was
dropped for this reason, S1's entry was appended after S2's irreversible click. A session
ending in between would have lost a verdict the executor had reached.

Basis: **Measured (run)**, under a draft that never shipped. 0.5.0 did not do this in
a1 or a2.

Changed in 0.6.0 (`e64deb9`): the entry is in the file before its nudge and before the
next step's action, and is appended with a quoted heredoc, which the guard requires
whenever an entry quotes something shaped like a substitution.

### C7 — What didn't work

- **Telling the executor to batch its calls.** It already does. Told to do more, it
  produced C6. The instruction was dropped.
- **`--snapshot-mode none`.** It stops the server saving a snapshot after each action,
  which would remove a file to delete per action. It also removes the page's URL and
  title from a click's result, and the executor's check that a click didn't land on an
  unlisted host reads them. Not adopted.
- **The executor changes alone.** b1 had only the page-reading and bookkeeping changes
  and cost $0.79 against a1's $0.75. On the standard plan, on Sonnet, the baseline
  executor was already close to what the changes ask for. The saving in C3 appears when
  the first page is large.

---

## What 0.6.0 costs, per component

From `claude plugin details`:

| Component | 0.5.0 | 0.6.0 |
|---|---|---|
| Always on, every session | about 1,957 tokens | about 1,991 |
| `step-execution`, when loaded | about 9,800 | about 10,800 |
| `agentic-qa`, when loaded | about 7,000 | about 7,300 |
| `qa-reporting`, when loaded | about 3,200 | about 3,200 |
| `step-executor` agent | about 2,700 | about 2,900 |
| `qa-reporter` agent | about 1,700 | about 1,800 |
| `walkthrough` command | about 5,200 | about 5,300 |

`step-execution` grew by about 1,000 tokens: the page-reading rules, the exact program
list and the refusal exception, less the paragraphs that were written for an
orchestrator. The executor pays for that on every call, and the orchestrator no longer
pays for any of it.

The Playwright server's 48 tool schemas are not in those figures. They come to about
25,700 characters, of which the 26 the executor holds are about 16,600. A session that
doesn't defer tool schemas carries all 48 whenever the plugin is enabled.

---

## Decisions left open

Each of these would save more than anything in 0.6.0, and each changes something a
person chose. They were open when 0.6.0 shipped. The owner then left them to the
maintainer, and the Resolution section below says how each was settled.

### The reporter's per-step updates (C4)

Dropping them would remove six to seven tenths of what the reporter reads. Less of its
output would go, since the step sections still have to be written at the end. My
estimate from a1's figures is a saving somewhere near 15% of Phase 4 and 5, and it
would grow with the number of steps. The report at the end would be the same, and so
would the paused report an escalation leaves behind.

What goes is the live view: someone watching `walkthrough-report.md`, or the copy at a
report destination, sees it move only at a pause and at the end.

Options, cheapest first:

1. Keep the updates when a person is at the session, and drop them for an agent-invoked
   run with no report destination, where nobody can be watching.
2. Update only when a step fails or isn't verified, which is what a watcher most wants
   to know at once.
3. Generate the report's table and step sections with a script rather than a model, and
   keep the model for `Findings` and the summary. This is the largest change and would
   also make the HTML's escaping something a test can check.

### What a refused program should cost

In c3 the guard refused an incidental `pwd` that the executor had put in front of a
copy. The rule says to escalate. The executor left `pwd` out and carried on, and the
run finished. Escalating would have ended an unattended run over a command the step
didn't need.

0.6.0 keeps the rule and tries to keep the executor from meeting it, by listing the
allowed programs. It also says in the skill that a refused program is not something to
drop and continue past. Whether the rule should instead allow exactly that is a safety
decision, since "a refusal is a decision" is something the earlier reviews leaned on.
It is possible that the new exception for refusals of form made the executor readier to
continue here. One run can't say.

### Where Playwright writes

`--output-dir ${CLAUDE_PLUGIN_DATA}/playwright-output` was chosen so files don't land in
the user's repository. In a0 a headless session without bypass refused to copy out of
it. An unattended run set up the way the README recommends may therefore stop at its
first screenshot. The README now says so. The fix is either a permission rule the README
can name, once someone has found one that works, or a different directory.

### Which model each agent runs on

Every agent but the reporter inherits the session's model. On an Opus-class session
that is where most of the money is, and this review measured none of it. Moving the
executor or a drafter to a smaller model needs a way to show the verdicts hold, and one
fixture with two planted defects is not that. `claude plugin eval` exists for this, and
the plugin has no eval suite.

### Phases 0 to 3

Not measured. Reasoned only: the drafter and critic pairs each run up to two rounds, and
the critics read the PR's whole diff. A diff with a lockfile or generated code in it is
read like any other.

---

## Resolution — 0.7.0

The owner left the open decisions to the maintainer on 21 November 2026. Changes are
named by their commit subject, since a rebase merge gives each commit a new hash.

### The reporter's per-step updates: on when someone can watch, off otherwise

Option 1 above. A run has live updates on or off, and its orchestrator tells both
agents which. `/agentic-qa:walkthrough` always turns them on. `qa-runner` turns them on
when the brief names a `report_destination` or sets the new `live_report` field, and
otherwise off. Off, the executor sends no nudge, and the reporter fills the report in
from `step-results.md` on `paused` and on `final`.

Change: "update the report after each step only when someone can watch".

Two more fixture runs, both on the 0.7.0 text and the standard plan:

| Run | Live updates | Outcome | Cost | Reporter |
|---|---|---|---|---|
| d1 | on, as the command runs it | 7 of 7 correct | $0.80 | 19 calls, 561,000 input tokens, 7,200 output |
| d2 | off, as `qa-runner` runs a brief with no destination | 7 of 7 correct | $0.57 | 7 calls, 183,000 input tokens, 4,500 output |

Both reports were complete: seven step sections, five embedded screenshots, no script
element, the content security policy present. d1 ran first, on a plugin copy nothing
had cached, so part of the $0.22 between them is cache writes d2 didn't have to make.
The reporter's own figures don't have that problem, and they fell by two thirds.

The fixture's orchestrator was told to do what `qa-runner` does. `qa-runner` itself,
reading a brief and choosing, was not run.

### A refused program: the rule stays

A refusal still ends the executor's turn, a refused program included. The rule is what
stops an executor working its way round the guard, and nothing here showed that
loosening it is safe. The second November review's answer to refusals of ordinary
operations (F55) was to list them in the executor's instructions rather than widen the
guard. 0.6.0's exact program list does that, and in d1 and d2 the guard refused
nothing.

If refusals over incidental programs keep ending runs after this, the next step is to
add the program to the guard's list where that is safe, as it was for the ones already
there, and not to let the executor judge which refusals matter.

### Where Playwright writes: out of `~/.claude`

Six permission settings were tried against a one-command headless session: an `Edit`
rule on the directory in two spellings, `Bash(cp:*)`, `--add-dir` alone and with an
`Edit` rule, and `acceptEdits`. None lifted the refusal. `cat` out of the directory
ran; `cp` out of it, `rm` inside it and any write into it did not. The same commands on
a directory under `~/.cache` all ran.

So the directory moved, to `.cache/agentic-qa/playwright-output` in the user's home.
A plugin's `.mcp.json` has no variable for the home directory that exists on every
platform, so the setting climbs out of `CLAUDE_PLUGIN_DATA`, which sits four levels
below it. With a relocated Claude config directory it lands four levels above that
instead. The guard's exemption for `.claude/plugins/data` existed only for the old
location, covered every other plugin's stored data too, and is removed.

Change: "write Playwright's files outside ~/.claude". d1 and d2 used the directory as
shipped, with a list of allowed tools and no bypass, and every copy and delete ran.

Not tested: Windows, where the owner's machine is. The path is built with forward
slashes and resolved by Node, which accepts them there, but no run has confirmed it.

### Which model each agent runs on: unchanged

No agent moves to a smaller model until an eval suite can show its verdicts hold. That
suite is the next piece of work on cost, ahead of anything else in this review, because
on an Opus-class session the inherited model is most of what a run costs and nothing
measured here touches it.

### Phases 0 to 3

Measured once, in 0.9.0, by a whole unattended run in the fixture: a calling agent,
`qa-runner`, both drafters, both critics, the executor and the reporter, with a stand-in
`gh` supplying the ticket, the merged pull request and its diff. It cost $2.14 on
`claude-sonnet-5-5`. The pipeline planned 17 steps and ran 10; seven were blocked on
questions nobody was there to answer. Both planted defects were reported.

| Agent | Calls | Input tokens processed | Output tokens |
|---|---|---|---|
| `qa-runner` | 31 | 1,781,000 | 14,400 |
| `step-executor` | 19 | 1,300,000 | 8,800 |
| `behavior-extractor` | 10 | 320,000 | 13,200 |
| `qa-reporter` | 9 | 319,000 | 8,300 |
| `behavior-coverage-critic` | 9 | 247,000 | 4,900 |
| `step-planner` | 7 | 235,000 | 17,900 |
| `step-plan-critic` | 5 | 167,000 | 5,200 |
| The calling agent | 3 | 144,000 | 1,100 |

Two things stand out. `qa-runner` is the largest single cost, about four tenths of the
input: its context reached 83,000 tokens and it made 31 calls, seven of them waits on a
signal file, and every call reads all of that again. And everything other than the
executor and the reporter, which is the drafters, the critics and `qa-runner`, is about
two thirds of the run. The first review's attention to execution and reporting was on
the smaller part.

One observation about the testing, not its cost. The sixth acceptance criterion, a
search that reports one result, was stated plainly in the ticket and was not tested:
the coverage critic noted the diff had no search code, a question was raised about it,
and with no User Gate to answer, the step stayed blocked. A hand-written plan tests it
in one step and it passes.

That was fixed in 0.10.0 ("test what the ticket states, even with a question open or
code unread"). A question now blocks the case it asks about, not the behavior it is
listed against, and every question reaches the report. Trying the rule on the same spec
showed a second way caution became no test: a step classed as escaping because nobody
could read its handler, which never runs unattended. The diff is now saved at Intake for
the planner and both critics, and an isolation claim stands unless code that was read
disagrees with it.

A second whole run, on that text:

| | First run | Second run |
|---|---|---|
| Steps planned | 17 | 11 |
| Steps run | 10 | 9 |
| Steps blocked on a question | 7 | 2 |
| Behaviors from the acceptance criteria run | 6 of 7 | 7 of 7 |
| Planted defects reported | both | both |
| Open questions in the report | 6 of 8, as blocked steps | 8 of 8 |
| Cost | $2.14 | $1.78 |
| `qa-runner` | 31 calls, 1,781,000 input tokens | 32 calls, 1,757,000 |

The two blocked steps in the second run are both rows the coverage critic added from
reading the code, with no result stated anywhere. That is what a question should block.
`qa-runner`'s cost did not move, and is the next thing to look at.

### `qa-runner`'s turns — 0.11.0

`calls.mjs`, added to the fixture for this, prints one line per call an agent makes. Run
on the second whole run it showed where `qa-runner`'s 32 calls went. About 14 of them
repeated or split work:

- A resume took three calls: the `SendMessage`, the wait on the signal file, and a read
  of that file. There were four resumes.
- Intake ran its commands a few at a time, printed the diff and then saved it, and
  resent a command the guard refused for using `$?`.
- An `Agent` call with no `subagent_type` was refused and resent.
- After the planner's revision it read the whole plan, found the round not yet logged,
  slept 20 seconds and searched the plan twice more: five calls to apply the
  stricter-classification rule. The planner had written its signal file before it
  finished saving the plan.

Every call reads the whole context again, so a call that does nothing new still costs
40,000 to 70,000 input tokens. The changes ("have qa-runner take fewer turns", "have a
drafter write its signal file after its other files"):

- The resume and its wait go in one turn, and the wait ends with a `cat` of the signal
  file. The guard already accepted that form.
- Intake's steps name which commands go together, and the diff is saved, not printed.
- The stricter-classification check is one `grep` that prints every step's reversibility
  and containment and the grant line. `qa-runner` reads the plan only to correct one.
- `qa-runner` no longer loads `behavior-coverage` and `step-planning`. The three rules
  in them that are its own to apply, the relay, the round cap and the stricter
  classification, are in its steps.
- The planner and the extractor write the signal file last.

Two whole runs on that text, against the second run above:

| | Before | After, first run | After, second run |
|---|---|---|---|
| How it ended | finished | paused on an escalation | finished |
| `qa-runner` calls | 32 | 14 | 15 |
| `qa-runner` input tokens processed | 1,757,000 | 658,000 | 684,000 |
| `qa-runner` output tokens | 11,900 | 9,500 | 8,000 |
| `qa-runner` context at its last call | 73,500 | 58,600 | 56,800 |
| `qa-runner` share of the run's input | 45% | 22% | 21% |
| Guard refusals in the run | 4, 3 of them `qa-runner`'s | 0 | 1 |
| Steps planned, steps run | 11, 9 | 10, 7 | 9, 8 |
| Behaviors from the acceptance criteria run | 7 of 7 | 7 of 7 | 7 of 7 |
| Planted defects reported | both | both | both |
| Open questions in the report | 8 of 8 | 7 of 7 | 10 of 10 |
| Deployed build | verified | unverified | verified |
| `step-executor` | 22 calls, 1,254,000 | 21 calls, 1,427,000 | 25 calls, 1,734,000 |
| Whole run, input tokens processed | 3,923,000 | 2,932,000 | 3,321,000 |
| Cost | $1.78 | $1.54 | $1.62 |

`qa-runner` now makes fewer than half the calls and processes about four tenths of the
input it did. The run's cost fell by less, 9% between the two finished runs, because the
executor cost more in both new runs, for a reason this work did not touch and which is
below.

What the two runs showed besides the numbers:

- **The first paused, as designed.** The coverage critic added a behavior from the diff,
  the planner gave it an irreversible step, and a grant from the brief never covers a
  step traced to an `Added` row, so the executor escalated and nobody answered. The
  reporter rebuilt the report on `paused` with live updates off, and the paused report
  was current: seven steps' verdicts, the step waiting, and no HTML. That path had not
  been seen in a run before. Its cost is not comparable with a finished run's.
- **The first recorded the build as unverified.** `qa-runner` asked `/health`, got a 404
  and stopped looking; the app reports its build at `/api/version`. This was not new:
  an earlier run, one that stopped after Intake for want of an `Agent` tool, did the same
  after two guesses. Told to put the build check in one
  turn, it made one guess. It now asks the places the ticket, the PR and the docs name
  and four common paths in that turn ("have qa-runner look in more than one place for
  the build"), and the second run verified the build. The fixture's path is one of the
  four, so that run shows the instruction is followed, not that the list is long enough.
- **Neither plan needed a relay.** The plan critic returned no material findings both
  times, so the wait that ends with the `grep` after a planner's revision was not
  exercised; the `grep` ran on its own. The planner writing its signal file last was not
  exercised either.
- **The second resent one command**, after putting the working directory in a shell
  variable. The text now says to write it out, and the last wait now lists the HTML
  report, which that run reported without checking. Neither of those two edits has been
  run.

**The executor is now the largest part of an unattended run**, at about half the input.
In the second new run one call accounts for most of the difference from the run before:
a `browser_snapshot` of the whole orders list, 49,000 characters, about 21,000 tokens,
which every one of its 22 later calls read again. The plan said "open a Paid order's
page" without naming one, because the planner cannot see the system's data, so the
executor read the list to find one. The run before did the same search with
`browser_find` for "Paid" and got 19,000 characters back. This is C3 again, by a route
the first fix did not cover: a step whose subject has to be found first. It is the next
thing to look at.

### The executor's list, the critics' findings and the drafters' tools — 0.12.0

Three whole runs, each on the text as it stood, against the last run of 0.11.0:

| | 0.11.0 | Run 1 | Run 2 | Run 3 |
|---|---|---|---|---|
| Cost | $1.62 | $1.55 | $1.54 | $1.47 |
| `step-executor` calls, input tokens | 25, 1,734,000 | 22, 1,147,000 | 23, 1,138,000 | 20, 986,000 |
| `step-executor` context at its last call | 81,100 | 62,700 | 57,100 | 56,200 |
| `qa-runner` calls, input tokens | 15, 684,000 | 15, 696,000 | 17, 805,000 | 15, 693,000 |
| Whole run, input tokens processed | 3,321,000 | 2,728,000 | 3,030,000 | 2,757,000 |
| Steps planned, steps run | 9, 8 | 12, 6 | 8, 8 | 8, 7 |
| Behaviors from the acceptance criteria run | 7 of 7 | 7 of 7 | 7 of 7 | 7 of 7 |
| Of those, judged correctly | 7 | 6 | 7 | 7 |
| Planted defects reported | both | both | both | both |
| Open questions in the report | 10 of 10 | 10 of 10 | 8 of 8 | 10 of 10 |
| Guard refusals in the run | 1 | 1 | 0 | 1 |

**One row, not the list** ("have the executor ask for one row when a step needs any one
of many"). `browser_find` has no limit on matches, so searching a hundred-row list for
"Paid" returns most of it, and a whole-page snapshot returns all of it. A
`browser_snapshot` whose `target` is a locator ending in `.first()` returns one row. It
was tried against the pinned server before it was written down: 457 characters. In all
three runs the executor used it, for 499 to 511 characters where the run before had read
49,000, and its input fell by about a third to four tenths.

**A critic's findings as a file** ("have a critic hand over its findings as a file, and
take its Bash away"). In the last three runs of 0.11.0 the critics used Bash for one
thing, writing a result file. They now hold `Write`, held by the guard to a run
directory, and no `Bash`, which closes F52 of the second November review for them.
`qa-runner` names the file at spawn and relays its path. This did not make `qa-runner`
cheaper: its input is where it was. What it changes is that the drafter reads the
findings as the critic wrote them, and that a critic has no shell.

**Steps that will stop for a decision go last** ("plan the steps that will stop for a
decision after the ones that won't"). None of the three runs planned such a step, so
this was not exercised.

What the runs showed, and what was changed after each:

- **Run 1 failed a criterion the product meets.** The plan said to enter an order id and
  submit. The fixture's search form has a Search button and does nothing on Enter. The
  executor pressed Enter, saw no result and recorded a fail, with the deviation stated.
  The run before had pressed Enter, then the button, and passed. A control the page
  names for the plan's action is now the first attempt ("judge a step by the control
  the page names"). Runs 2 and 3 clicked the button and passed the step. Enter doing
  nothing is not one of the fixture's two planted defects, and the fixture's README now
  says so.
- **Run 2 announced a revision that was not there.** The extractor held `Write` and no
  `Edit`. Resumed with the critic's findings it sent four `Edit` calls and the signal
  file in one turn; the edits failed for want of the tool and the signal was written.
  The critic's second round read the unrevised spec and reported every finding as
  unaddressed. `qa-runner` noticed and reran the round, which is the 17 calls in the
  table. Both drafters now hold `Edit`, and the signal file goes in a turn of its own
  ("give the drafters Edit, and keep a revision's signal out of the turn that makes
  it"). In run 3 both drafters revised with `Edit` and wrote the signal afterwards.
- **Run 2 also began with an `intake.md` that did not hold the ticket's text**, only a
  note that its criteria were present. The extractor stopped and `qa-runner` added
  them. Its steps now say the text goes in whole. Run 3's did.
- **Run 3 relayed a finding to the planner**, so the wait that ends with the `grep` of
  the plan, and the planner's signal written last, have now been seen once.
- **Run 1 left six `Added` rows blocked** and ran only the steps for the acceptance
  criteria. Each was a behavior the critic drew from the diff with no result stated
  anywhere, which is what the rule blocks. The other two runs planned one or two such
  rows with a result the diff states and ran them. That difference is the drafters'
  wording from run to run, not a change here.

Not done, and worth doing: a step for an `Added` row that is blocked for want of a
stated result could still be run as an observation where it changes nothing, so that
whoever answers the question sees what the system does today.

### The report renderer — 0.13.0

The reporter wrote a throwaway script on every run to build the HTML. The plugin now
ships one, `skills/qa-reporting/scripts/render-report.mjs`, with eight tests ("ship a
script that renders the HTML report"). This was done for what the file must get right,
not for cost: the escaping of text the system under test supplied was rewritten by a
model each run and never tested.

Checked two ways. Run by hand on the last whole run's report it embedded five
screenshots and two text files, and the page opened in a browser with every image
loaded and no console error. Then one Phase 4 to 5 fixture run with live updates off:
the reporter ran the shipped script and wrote none of its own, the page was the same
shape, all seven verdicts were right, and the run cost $0.55 against $0.57 for the same
configuration in 0.7.0. The reporter made nine calls where it had made seven, because
it ran the script once alongside a write that failed and again after. The skill now
says to render in a turn after the last write. That sentence has not been run.

A whole unattended run on the same text paused before any report was rendered, so it
shows nothing about the renderer. It does show the ordering rule of 0.12.0: the one
step that needed a decision was planned last, and the twelve others ran before the
pause, where the earlier paused run left a step behind the escalation. It cost $1.73,
for thirteen steps planned.

It also showed `qa-runner` refused a `for` loop as a program it may not start, which
tells an agent to escalate, and carrying on regardless. A loop or a condition is now
refused as a matter of form, with the instruction to send the commands plainly
("refuse a shell loop or condition as a matter of form").

---

## What still needs a live walkthrough

- `qa-runner` itself deciding live updates from a brief, and an agent-invoked run with a
  `report_destination`, where updates stay on.
- Playwright's output directory on Windows.
- A plan with a step that will stop for a decision, to see the planner put it last.
- A refusal of form, to see the executor resend the command once and continue. It is
  covered by the guard's tests and has not occurred in a run since.
- An escalation answered by a person, with an orchestrator that hasn't loaded
  `step-execution`.
- Any of the above on the model the plugin is actually used with.
- A repeat of each configuration, to put a range on the totals.
