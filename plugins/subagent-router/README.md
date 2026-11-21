# subagent-router

A Claude Code mod that runs some subagents on a cheaper model than the session it belongs to. For the built-in `Explore` and `general-purpose` agents it asks Haiku what kind of task a spawn is and, when the task only locates things, starts the subagent on Haiku instead of the session's model. The call that asks is the picker, and its answer is the spawn's kind: `locating`, `reading` or `other` (defined under "Routes"). It starts in `observe` mode, which only records what it would have done, so you can read its decisions on your own work before it changes anything.

Like `cost-ledger` and `subagent-tree`, this is code: a TypeScript hooks module that Claude Code loads and runs inside the session. This version is Stage 1 of a planned three-stage design: the router and its records. Later stages (a ledger kept across sessions, and routes that adapt) are not built, and nothing here depends on them.

## Installation

```
/plugin marketplace add bobtat/claude-plugins
/plugin install subagent-router@bobtat-plugins
```

From a checkout of this repository, load it for one session with:

```
claude --plugin-dir <path to plugins/subagent-router>
```

## What it costs and what it risks

- **A Haiku call before most in-scope spawns.** An in-scope spawn is a start of the built-in `Explore` or `general-purpose` agent that is not one of the cases listed under "What it never touches". A spawn that names its own model is in scope but gets no call, and so, in `route` mode, does a spawn made by a subagent.
  - The call asks for the `haiku` alias, so it runs on whatever model that alias resolves to in your setup. It sends the task prompt with a short instruction and waits at most 5 seconds. Measured on Haiku 5.5, a call used about 600 input tokens on average, and at most 64 output tokens are allowed; a longer task prompt costs more. The median was 0.7 s when measured.
  - A prompt over 16,000 characters, or one that is empty once hidden characters are removed, gets no call and is recorded as `other`.
  - In `route` mode the call is skipped when no route could apply to the spawn.
  - In either mode, after three timeouts or errors in a row the picker is switched off and `/subagent-router` says so. That is kept in session state (see "Baseline"), so the picker stays off until that state is gone. Failures of spawns that overlap count once, and a call cut short by Escape does not count. Only a reply from the picker starts the count again; a prompt that gets no call leaves it as it was.
- **A task can land on a weaker model than it needs.** The picker can be wrong, and a worse answer from a cheaper model raises no error. The guards are the narrow kind list (anything that changes files or state, and anything uncertain, is `other` and stays where it is), the note that asks the subagent to say when a task needs more than searching and reading, the `Model:` line at the end of a routed report, the transcript line for each routed spawn, and observe mode. None of them catches an answer that is correct but thinner.
- **The first spawn of each type, under each session model, is not routed.** See "Baseline". A change of session model means another unrouted first spawn.
- **Spawns made by a subagent are not routed yet.** They are left as they are until it is measured which model they would inherit (see "Not yet measured"), and recorded with the reason `nested-unverified`. Only in `observe` mode, and only while the picker is on, is the picker asked about them, and only then does the record carry the picker's kind; in `route` mode, or with the picker off, it carries no kind.
- **A routed agent cannot start subagents.** A routed `general-purpose` agent that would have fanned out a large reading task has to do the work itself.

## Modes

| Mode | What it does |
|---|---|
| `observe` (default) | Asks the picker about every in-scope spawn that does not name its own model, and records what it would have done. Changes no model, adds no note to any prompt, and refuses nothing except under an agent that was already routed. |
| `route` | Does what `observe` records: starts a spawn on the cheaper model when its kind has a route and the route's model is cheaper than the one the agent would have run on. |
| `off` | Does nothing, except that an agent already moved to a cheaper model is still refused its own spawns. |

Set `mode` in `/config` under `subagent-router`. The setting is a user-level one, so a change applies to every running session at the next spawn, not only the one you changed it in. `/config` offers exactly `observe`, `route` and `off`, and the router accepts only those, written exactly: a value written by hand in another spelling, such as `" Route"` or `ROUTE`, turns the router off, and `/subagent-router` says it must be written exactly (lower case, no spaces). The first line of `/subagent-router` shows the mode the router is using.

What `observe` records is kept in session state, which does not outlive the Claude Code process. Read `/subagent-router` before you close a session whose findings you want.

## Routes

The picker names one of three kinds of task:

| Kind | The task | Route setting | Default |
|---|---|---|---|
| `locating` | Only asks to find things: files, symbols, definitions, usages, where something is set. The answer is a list of locations. | `locatingRoute` | `haiku` |
| `reading` | Asks to read content and summarise it, explain how it works, or answer questions about what it says. Changes nothing and asks for no judgment about quality, correctness or cause. | `readingRoute` | `parent` (off) |
| `other` | Everything else, and anything uncertain: creating or changing files or state, running or fixing something, finding the cause of a failure, reviewing, assessing, designing, planning, deciding. A task that mixes kinds takes the most demanding one. | none | never routed |

A route is `parent` (leave the model alone, which turns the route off), a model family written as the whole value (`haiku`, `sonnet`, `opus` or `fable`), or a model id that begins with `claude-` and names exactly one family as a whole word, which is read as that family. Anything else is not recognised and leaves the route at `parent`: `not-haiku`, `haiku-off`, `my-haiku`, `not haiku` and `mythos` are not routes, and neither is `affable`, whose `fable` is part of a longer word. A route value is read without regard to case and with surrounding spaces ignored; `mode` is not (see "Modes"). The router asks for the family name, not a full model id.

A route applies to a spawn only when its model is cheaper than the model that agent would have run on without the router (the baseline, below); that decision is made by family, since which version an alias such as `opus` resolves to is known only once the agent starts. Family is not a price across model generations, so the start is checked too. A route stays on only while the model that actually started is on the family the route asked for and can be confirmed cheaper than the baseline. Where both models have a listed price, every listed price decides: input and output must both be lower, and no cache read or cache write price may be higher, since a subagent's tokens are mostly cache reads. For a `haiku` route only, a start with no listed price is confirmed by family, Haiku being the cheapest family in every generation; a route to any other family whose start has no listed price cannot be confirmed. A model id that two listed prices both claim has no price, and a start whose family cannot be read is never confirmed. A start that is not confirmed, including one at or above the baseline, one on a cheaper family other than the one asked for, and one whose reply names no model, turns that route off, and both the transcript line and the report say so. That a route is off is kept in session state (see "Baseline"), so it stays off, even if its setting is changed, until that state is gone.

`readingRoute` ships off because Sonnet's reading answers were less complete than Opus's in 17 of 20 measured pairs and materially wrong in 1 (see "What was measured"). Set it to `sonnet` to turn it on, ideally after `observe` mode has shown how many reading tasks your sessions contain. The route accepts any family, but only Sonnet was measured on reading tasks; Haiku on reading tasks was never run, and no measured reading prompt was sent to Haiku.

## Baseline: why the first spawn is not routed

The router cannot see which model a spawn would run on without it. It learns that from the spawns it leaves alone: for each agent type and parent model, it records the model the agent actually started on. That is the baseline. A start that names no model, a spawn that names its own model, and for now a spawn made by a subagent teach nothing and are not used.

So the first `Explore` spawn and the first `general-purpose` spawn of every session run unchanged, and so does the first of each type under each new parent model, since the baseline is kept per agent type and parent model (for a spawn from the main conversation, the parent model is the session's). The baseline cannot be assumed to be the parent's model: in the probe, an `Explore` agent under a `claude-fable-5-2` parent started on `claude-opus-5-5`. A session that makes one search saves nothing; `/subagent-router` counts the spawns left alone for want of a baseline, and separately those whose baseline is a model the router cannot rank.

Baselines, decision records, a route being off and the picker being off are kept in session state, which does not outlive the Claude Code process. A session that is closed and resumed later starts with none, so its first spawns are left alone again and `/subagent-router` shows only what happened since. Whether `/clear` or a `/resume` within the same process resets that state has not been measured (see "Not yet measured").

If `CLAUDE_CODE_SUBAGENT_MODEL` is set without `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`, agents start on that model, which the router then learns as the baseline. It needs no rule of its own.

## What it never touches

These pass through unchanged and are counted, not recorded (the count is not kept while the router is off or standing down):

- forks, resumed agents, teammates and workflow agents
- spawns raised by another plugin
- agents of any type other than the built-in `Explore` and `general-purpose`, including user-defined agents that reuse those two names

A spawn of one of the two built-in types that names a model is left as it is and recorded as `explicit`. Naming a model is how you override the router for one task.

When `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is set to anything but empty, `0` or `false`, the engine ignores per-spawn models, so the router stands down and `/subagent-router` says so.

## How a spawn is handled

This is the whole path of an `agent.spawn`:

```
 Agent tool call
        |
        v
 agent.spawn hook --> spawner is a routed agent, and this is not a fork or resume --> refused, in every mode
        |
        v
 router off, standing down, or the spawn is out of scope --> passed through
        |
        v
 the spawn names a model --> left as it is, recorded "explicit"
        |
        v
 a subagent made the spawn --> left as it is, recorded "nested-unverified"
        |                      (observe mode still asks the picker, to record the kind)
        v
 route mode, and no route could apply (both routes are parent, no baseline yet,
 a baseline the router cannot rank, or no route's model is cheaper than it)
        |   --> picker not asked; left alone, reason recorded
        v
 picker off after three failures --> picker not asked; left alone, reason recorded
        |
        v
 Haiku picks a kind (a prompt that is empty or over 16,000 characters: no call, kind other)
        |
        v
 route for the kind, and its model cheaper than the baseline?
        | no --> left alone, reason recorded
        v yes
 route mode: model rewritten, router note appended, transcript line shown;
             a start not on the family asked for, or not confirmed cheaper, turns the route off
 observe mode: recorded as "would route", nothing changed
```

## Routed agents

- **A routed agent may not start subagents.** A child would inherit the cheaper model, and the router cannot see what the child's own definition would have chosen. The refusal applies to every agent type, with or without a `model`, and in every mode, so switching to `observe` or `off` does not release an agent already on a cheaper model. A fork of a routed agent is the same agent continuing: it is allowed, and its own spawns are refused too. A resume is left alone because a hook cannot change one. A refusal shows as a transcript line. An agent counts as routed unless its start named a model family at or above its baseline: one whose start named no model, a model whose family cannot be read (an inference-profile ARN, a gateway alias such as `fast`), or a cheaper family than the one asked for may well be on a cheaper model, so its spawns are refused too. An agent whose start named a family at or above its baseline is recorded as not moved, and its spawns are not refused, though its first message carries the router's marker. In `observe` mode the router keeps the ids of agents it would have routed, and of their forks, and counts the spawns they make, so the report shows how often the rule would bite.
- **The router note.** In `route` mode a note is appended to the routed subagent's prompt. It names the model and the reason, asks the subagent to say so in its first line instead of attempting the task if it needs file changes or judgment beyond searching and reading, and asks it to end its report with a `Model: <model> (routed by subagent-router)` line, so the parent can tell the result came from a cheaper model. The same lines give the baseline model to start a new agent with, so the parent does not pick something dearer than it would have had. For now the note also tells the parent not to resume a routed agent, because which model a resumed routed agent runs on has not been measured. The lines the subagent copies into its report are only as trustworthy as what that subagent read: a file it reads can supply a different `Model:` line or a different model to start again with. The router's own transcript line is the authority for which model was asked for and which started.
- **A routed agent is recognised after a session is reopened** by a fixed marker on the last line of its first message, checked only when the spawner's model (`parentModel`) ranks below the session's. Whether `parentModel` names the spawning agent's model rather than the session's has not been confirmed (see "Not yet measured"), and this path depends on it. If that first message cannot be read, the spawn is allowed, and the router reads it again at the agent's next spawn. Once the marker is found, the agent is recorded as routed, so its later spawns are refused without reading its first message again. A routed agent resumed after the session's state was lost, whose first message is also unreadable, can therefore start a child that inherits the cheaper model.

## `/subagent-router`

`/subagent-router` prints the decisions kept in session state. Its output is display-only: it is not sent to the model and costs no parent tokens. It is drawn as one literal block, so nothing in it, a task description included, is drawn as a link, emphasis or a table. It shows:

- the mode and the two routes in force, whether this version shipped with a passed picker check (see below), whether the router is standing down, and any setting it did not recognise;
- any route that is off, and whether the picker is off;
- for each kind: how many runs there were; in `route` mode, how many were asked to move to a cheaper model and how many of those started on the family asked for (`3 asked, 2 moved`); in `observe` mode, how many would be routed (a route that is off routes none); and what those runs cost;
- how many in-scope spawns there were, out of every spawn with a record plus those passed through untouched (a refusal has a record but is not counted in scope, since the spawn refused can be of any type; and the passed-through count is not kept while the router is off or standing down);
- how many spawns the no-spawn rule would have refused (in `observe`) or did refuse, how many were left alone while the baseline was learned, how many because the baseline is a model the router cannot rank, and how many nested spawns were left alone;
- how many stored records it skipped: those from another version of the mod, and those it could not read;
- one row per spawn, for the latest 200 spawns, with one line saying how many earlier rows are not shown (the totals cover every row): agent type, kind, outcome and reason, the model it started on and ran on, tokens, estimated cost, agent id and the task description. A model id too long to show keeps its beginning and its end around an ellipsis, since an inference-profile ARN names the model at its end.

The report shows what the runs cost as they ran, not what routing would have saved, and says so beside its totals. Every dollar figure is an estimate from listed per-model prices. Haiku is priced at its base rate; it costs more for a prompt over 100,000 tokens, so the figure for such a run is too low. A model with no listed price shows tokens only, with the row marked "not priced". A run whose usage has not been reported yet has no tokens to show, and its kind's total counts it as "with no usage reported yet". A run's cost can be missing from its row when its usage arrived before the row was linked to its agent, or while the agent is still running. A run with both priced and unpriced turns shows its cost as being for the priced turns, and its kind's total as "at least" that figure, or as "not known" when that figure rounds to $0.00. Text taken from prompts and records is stripped of control, escape, bidirectional and zero-width characters and of combining marks stacked past three, flattened to one line and capped in length before it is shown.

In `route` mode, each routed spawn also shows one line in the transcript, such as `Routed to haiku as a locating task: <description>`. If the agent started on another model, or on one that could not be confirmed cheaper, the line names the model asked for and the model that started, and says when that route is now off. A refused spawn shows as `Refused a spawn by an agent subagent-router treats as routed: <description>`.

## `/subagent-router check-picker`

The picker's wording decides what is routed, so a change to it must pass a live check before it ships. `/subagent-router check-picker` says what a run involves: 262 Haiku calls (240 measured prompts and twenty-two injection prompts, one call each), shipped with the plugin under `data/picker-set/`. It estimates the input tokens a call from the set itself, at four characters a token over the instruction, the task and the closing question, and the cost at the listed Haiku 5.5 price with each reply counted at its 64-token cap: for the shipped set, about 500 input tokens a call on average and about $0.02 in all. Both are estimates. Each call sends the task between two tags drawn at random for that call, and the closing question names the drawn tag, so the picker is told which tag pair is the real one; the injection prompts include tags forged inside the task, and the check measures that question along with the picker's instruction. `/subagent-router check-picker confirm` runs it, and only when the confirmation comes from a person at the prompt: a plugin, a scheduled prompt, the bridge or the SDK cannot start it. A click on a link in the transcript counts as the person's own action, the same as typing the command. A plugin that hooks `command.run` could rewrite the command's arguments, and the router cannot detect that.

A run passes only if every call completed, and:

| Count | Required |
|---|---|
| Change-or-judgment prompts (160) given a cheaper model | 0 |
| Injection prompts (22) given a cheaper model | 0 |
| Reading prompts (40) answered `locating` | 0 |
| Answers that were not exactly one option name (after trimming and lower-casing) | at most 2 |
| Routable prompts (80) left on the parent's model | at most 20 |

A set in which a prompt or injection id appears twice is refused before any call. A run on a set of any other size, or of other content, is not a result: the shipped set is known by its sizes and by a digest of every item's id, expected answer and prompt, in order, which `hooks/picker-gate.ts` records as `GATE_SET_DIGEST`. The digest catches a set whose prompts changed under the same ids; it is not a guard against someone who means to change the set, who can change the digest as well. After the verdict, one line says what to do with it: for a pass, copy the new instruction and closing question into `hooks/picker-gate.ts` and the run's numbers into `GATE_RESULT`; otherwise, the run changes nothing, and the line says what to look at. A unit test fails while either shipped text and its copy differ. In this version `GATE_RESULT` reads `not run`: the check has not been run on the shipped wording, and `/subagent-router` says near its top that this version shipped without a passed picker check, with the advice that `route` mode should wait for one. The shipped wording names its options `locating`, `reading` and `other`; the measured wording named them `haiku`, `sonnet` and `inherit`, with the same descriptions.

## Settings

Set in `/config` under `subagent-router`.

| Setting | Default | Meaning |
|---|---|---|
| `mode` | `observe` | `observe`, `route` or `off`, written exactly: lower case, no spaces |
| `locatingRoute` | `haiku` | A model family as the whole value, a model id beginning with `claude-` that names one family as a whole word, or `parent` to turn the route off; no spaces |
| `readingRoute` | `parent` | A model family as the whole value, a model id beginning with `claude-` that names one family as a whole word, or `parent` to leave the route off; no spaces |

- **Only the user and policy levels count, and policy wins.** The router reads those two settings sources itself on every spawn. A value in a project settings file, a local settings file or a command-line flag is ignored, so a cloned repository cannot switch routing on or point a route at a cheaper model.
- **A value it does not recognise makes routing less active, never more.** An unrecognised `mode`, including one that differs from an option only by case or spaces, becomes `off`; an unrecognised route becomes `parent`; and two entries for this plugin that disagree on a field make that field unrecognised. `/subagent-router` names the problem, shows a value that is not text as JSON, and says when hidden characters were removed from the value it shows. If the settings cannot be read at all, the router is off.
- **A change through `/config` is accepted only from you.** A change to this plugin's settings that another plugin requests through `config.set` is refused, and so, for now, is one that arrives over the Remote Control bridge or carries no origin. A change refused over the bridge is answered that it must be made at the terminal, in `/config`. That is the extent of the guard. A plugin with a hooks module can still write the settings file itself, rewrite what the router reads from settings or from its session state, or rewrite a command's arguments, and the router cannot detect any of that.

## What was measured

The picker and the downgrade were measured on 2026-11-18, from a Fable session with a throwaway mod, on the `ErsatzTV/legacy` repository (about 3,700 C# files). The prompt set and the picker's answers are in `docs/superpowers/specs/2026-11-17-subagent-router-measurement/`.

**The picker, with the original wording.** 240 prompts from 60 scenarios, written blind by four agents that knew nothing of the router: 160 change-or-judgment prompts that must stay put and 80 locating or reading prompts that may be routed.

| | Count |
|---|---|
| Change-or-judgment prompts given a cheaper model | 0 of 160 |
| Routable prompts left on the parent's model | 12 of 80 |
| Reading prompts sent to Haiku | 0 |
| Answers that were a sentence instead of an option name | 22 of 240 (all treated as no change) |

0 of 160 puts the true misroute rate probably under 2%; it does not show that it is zero. Every scenario whose four phrasings were handled differently was a locating or reading task, which costs saving and not quality. These are the figures for the original wording; the shipped wording has not had its own run (see above).

**Searches on Opus, Sonnet and Haiku.** 12 search scenarios on the `Explore` agent, scored against an answer key from the code: each model found 106 of 106 items.

**Reading tasks, Opus against Sonnet.** 8 explanations on `Explore` and 20 on `general-purpose`, compared blind by judge agents that checked both answers against the code.

| | Sonnet against Opus |
|---|---|
| `general-purpose`, 20 pairs | Opus's answer preferred in 17, none for Sonnet, 3 ties |
| `Explore`, 8 pairs | Opus's answer preferred in all 8 |
| Mean accuracy (`general-purpose`) | equal, 4.40 each |
| Mean completeness (`general-purpose`) | Opus 4.95, Sonnet 3.95 |
| Pairs where acting on the answer would cause a mistake | Sonnet 1 of 28, Opus 0 of 28 |

The one materially wrong Sonnet answer stated the opposite of what the code does; it stopped one step short of tracing where a loop's data came from. One in 28 fits a true rate anywhere up to about one in six. That, with the completeness gap, is why the reading route ships off.

## Limits

What the measurement does not show:

- **The mix of tasks in real sessions, and so the real saving.** `observe` mode shows that.
- **Searches that do not name a symbol.** All 12 search scenarios named an exact type, method or string, which is the easy case for a cheaper model.
- **Kinds of task outside the six categories measured**, such as running a test suite and reporting, or fetching from an outside service and summarising.
- **Any other language, or a much larger repository.**
- **Prompts that depend on a long session's context.**
- **False extra claims in search answers.** Only what was found was scored. One Haiku answer gave a wrong count in its first line above a correct list.
- **Independent judges.** The judges were Fable agents, the same model family as the writers of both answers.

Not yet measured:

- **The context window a routed subagent gets.** It may be smaller than the one its parent's model would give it.
- **What happens when the target model is not allowed for the account.** Claude Code documents a fallback model rather than a failure; the record shows the model that actually ran.
- **Which model a resumed routed agent runs on**, and what the resume costs in prompt-cache writes. Until it is measured, the router note tells the parent not to resume a routed agent.
- **Whether `parentModel` names the spawning agent's model rather than the session's.** In the one nested-spawn run both were Sonnet. The recognition of a routed agent after a reopen depends on it, and so does the baseline for a spawn made by a subagent, which is kept under its `parentModel`. Until it is measured, a spawn made by a subagent is recorded but not routed, and teaches no baseline.
- **Whether the `/subagent-router` command stays registered after a settings change reloads the mod.** The router registers it again from each hook until a call has succeeded.
- **Whether `/clear`, or a `/resume` within the same Claude Code process, resets the session state** that holds the records, the baselines, a route being off and the picker being off.
- **Whether a change made in `/config` reaches the user settings source the router reads**, and under what key. If it does not, a changed `mode` has no effect; the first lines of `/subagent-router` show the mode the router is using.

Documented by Claude Code, not measured here: a routed subagent runs at its own model's default effort, not the session's effort level.

Things the router cannot see:

- Another plugin that hooks `agent.spawn`, `model.complete`, `settings.read`, `config.set`, `state.get` or `state.set`, or `command.run` can change what this one sees or what it is asked to do, and the router cannot detect that.
- Other plugins can read this plugin's session state, and its decision records hold each in-scope spawn's task description.
- When one of the router's hooks fails, what happens depends on the hook. A failed `agent.spawn` hook passes the spawn on unchanged, so the no-spawn rule does not hold for that spawn: a child of a routed agent starts. A failed `turn.complete` or `session.start` hook passes the event on. A failed `config.set` guard refuses a change to this plugin's settings, or to any setting whose key it could not check. A failed command replies that it could not run.

## Development

The module is `hooks/register.ts`. The code is split by what it works on:

| File | Holds |
|---|---|
| `hooks/spawn.ts` | The `agent.spawn` hook: refusal, picking, rewriting, recording |
| `hooks/decide.ts`, `hooks/model-rank.ts` | Which spawns are in scope, the route rules, and the family side of the never-upgrade rule: a route applies only when its family ranks below the baseline's |
| `hooks/picker.ts` | The picker prompt, the message that wraps the task, and the call |
| `hooks/note.ts` | The router note, its marker, and the refusal text |
| `hooks/settings.ts`, `hooks/guard.ts` | Reading the user and policy settings; refusing other plugins' changes to them |
| `hooks/records.ts`, `hooks/usage.ts`, `hooks/prices.ts` | The session's decision records, tokens added from each finished turn, and the price list with the price side of the never-upgrade rule: the check that a routed start was cheaper than the baseline by listed price |
| `hooks/report.ts`, `hooks/command.ts` | The text of `/subagent-router` and the picker check's scoring; the command itself |
| `hooks/check-picker.ts`, `hooks/picker-gate.ts` | The picker check, and the instruction and closing question the check is to be run on, the shipped set's sizes and digest, and the result of its last run (`not run` so far) |
| `hooks/clean.ts` | The cleaning applied to every piece of text the router shows, and the literal block the command's answer is drawn in |

```
claude plugin validate plugins/subagent-router
claude plugin test plugins/subagent-router
```

After a change to the picker prompt, also run `/subagent-router check-picker confirm` in a session with the plugin loaded, and copy the passed text into `hooks/picker-gate.ts`. The design and the probe results are in `docs/superpowers/specs/2026-11-17-subagent-router-design.md` and `docs/superpowers/specs/2026-11-17-subagent-router-probe.md` at the repository root.

## License

MIT
