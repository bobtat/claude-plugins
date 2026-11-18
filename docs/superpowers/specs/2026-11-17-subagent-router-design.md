# subagent-router: design

Status: approved by the user on 2026-11-18, with the reading route off by default. Stage 1 is planned and built first. First written 2026-11-17 and revised after an adversarial review (last section). Rewritten after the picker and the model downgrade were measured ("Measurement results") and after the design grew from a fixed router into a staged, adaptive one, then revised again after a second review split by concern ("Second review"). Design decisions are Claude's unless marked "user".

Revised a third time on 2026-11-18 after a review of the Stage 1 plan changed eleven points of the design; they are listed in "Plan review" at the end and the body reflects them. These changes were made after the user's approval and have not been approved in turn.

## Intent

**User.** When a main Opus session spawns a subagent for search, reading files or summarizing content, the subagent also runs on Opus. Sonnet or Haiku is capable of that work. The scope is the `general-purpose` and `Explore` agent types.

**User.** The routing should be adaptive: over time the router learns which model suits which kind of task. The user runs several Claude Code sessions at once as a matter of course.

The mod moves those spawns to a cheaper model and leaves every other spawn exactly as it is today.

## Size and stages

This is a project, built in three stages. Each stage is usable without the next.

| Stage | What it adds | Shared storage |
|---|---|---|
| 1 | The router as measured: picker, routes, observe mode, settings, per-session records | None |
| 2 | A ledger of routed runs, labels for unlisted kinds of task, and the subagent's own report on fit. Recorded, not acted on | SQLite |
| 3 | Adaptation: automatic moves to a stronger model, the comparison command, label merging, proposals for new kinds | SQLite |

Stage 1 is built first and run in observe mode on real work. The Stage 3 thresholds are fixed only after the Stage 2 ledger shows how often each signal occurs.

## Goals, non-goals, anti-goals

- **Goal.** Built-in `Explore` and `general-purpose` spawns whose task is locating or reading/summarizing run on a cheaper model than their parent.
- **Goal.** Every in-scope spawn leaves a record of what was decided and why, including the ones left unchanged, and each routed spawn shows a line in the transcript.
- **Goal.** The parent model can tell that a result came from a routed subagent.
- **Goal (Stages 2 and 3).** A route that is visibly failing moves to a stronger model without the user having to notice it. The user can find out, at a cost stated up front, whether a route could use a cheaper model on their own repository.
- **Goal (Stages 2 and 3).** All of this is correct with several sessions running at once.
- **Non-goal.** Routing any other agent type, user-defined agents that reuse those two names, teammates, workflow agents, forks, resumed agents, or spawns made by other plugins.
- **Non-goal.** Re-running a task on a stronger model. Adaptation changes how later tasks are routed; it never repeats one.
- **Anti-goal.** Work that changes files, or that is review, debugging or design, silently lands on a weaker model. The mechanism reduces this but does not guarantee it: the picker can be wrong. The guards are listed under "Misroutes".
- **Anti-goal.** A spawn ends up on a more expensive model than it would have had without the mod.
- **Anti-goal.** The router moves a route to a cheaper model by itself. A worse answer from a cheaper model raises no error, so nothing the router can observe in normal use justifies that move.
- **Anti-goal.** The router keeps task prompts across sessions.

## Approaches

| Approach | Outcome |
|---|---|
| Fixed table by type | Rejected. `general-purpose` also carries implementation and review work. For Explore, a rule that it never runs above Sonnet was adopted after the measurement and then dropped on the builder check: with the picker in place it would only act when the picker answers `other` or fails, which is about 1 Explore spawn in 40 and is the one case the measurement did not cover. |
| **Haiku classifies the task against a short list of described options, for both types** | **Chosen.** One short Haiku completion is shown the task and the options, and names one. Picking from a described set is the user's suggestion. Measured: see "Measurement results". |
| Haiku picks from bare model names, judging capability | Rejected. Haiku has no reliable knowledge of how the models compare, and "which model can handle this" would route work outside the stated scope, such as simple-looking implementation tasks. |
| System-prompt section telling the parent to pass `model` | Not chosen for this version. It is unenforced and its effect cannot be checked per spawn. Its effectiveness is untested, not disproven, and it composes with the router (an explicit `model` is always respected), so it can be added later. |
| New cheap read-only agent types registered by the mod, chosen by the parent | Rejected. It does not act on `Explore` and `general-purpose` spawns, which is the stated scope, and it adds listing entries that compete with `Explore`. |
| A user-defined agent named `Explore` with `model: haiku` (documented, no mod) | Not chosen. It covers Explore only, and it replaces the built-in's prompt with one the user maintains. Nothing equivalent separates general-purpose tasks. It is the right answer for someone who only wants cheaper exploration. |
| `CLAUDE_CODE_SUBAGENT_MODEL` (no mod) | Rejected. Alone it moves every agent that names no model of its own, including general-purpose implementation work, and does not move Explore. With `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` it moves every subagent. |
| Adaptation by matching each new task to similar past tasks | Rejected. Evidence arrives a few signals a week at most, so finely divided groups never collect enough to act on. A few coarse kinds do. |
| Adaptation by replaying stored prompts on another model | Rejected (user). A replay compares answers made against different states of the repository and of outside services, and repeats whatever outside calls the task made. |
| Shared state in `$.store` or in plain files | Rejected (user raised it). Several sessions write at once. The mod's file API has no append, rename, delete or lock, and whether `$.store` survives concurrent writers is unknown. |

## How it works

```
                       settings                       SQLite database (Stages 2 and 3)
                  (mode, model per route)             ├ overrides  project, kind ─► model
                          │                           ├ ledger     one row per routed run
                          ▼                           ├ labels     unlisted kinds, counts, aliases
 spawn ─► hook ─► picker ─► route lookup ◄─ overrides ┤
                                │                     └ meta       models seen, last merge
                                ▼
                         subagent runs ─► its turn ends ─► ledger row            (Stage 2)

 ledger ─► rule ─► an override moves one step stronger, and the user is told       (Stage 3)
 /subagent-router compare ─► fresh questions ─► both models ─► judge ─► user confirms
                          ─► an override moves cheaper                             (Stage 3)
 session start, weekly ─► label merge ─► proposal for a new kind; user approves    (Stage 3)
```

### Stage 1: the router

```
 Agent tool call (main loop or a subagent)
        │
        ▼
 agent.spawn ──► router hook
   1. Spawner is an agent this router moved, and this
      is not a fork or a resume ─────────────────────► { deny }  (whatever the mode is now)
   2. Mode off or standing down ─────────────────────► pass through, no record
   3. Pass through untouched, counted but not recorded:
        fork · resume · teammate · workflow agent · spawn made by another plugin ·
        type is not the built-in Explore / general-purpose
      (in observe mode nothing is changed; steps 4 to 7 only record what would happen)
   4. Caller passed `model` ─────────────────────────► unchanged, recorded "explicit"
   5. Ask Haiku which kind the task is (one completion, 5 s timeout):
        locating · reading · other
      unparseable · timeout · error · empty prompt ·
      prompt over 16,000 characters ────────────────► other, recorded with the reason
      (route mode: not asked when no route could apply; off for the session after
       three failures in a row)
   6. Route lookup, kind ─► target:
        locating ─► the locating route   (default haiku)
        reading  ─► the reading route    (default parent, that is, off; sonnet when the user turns it on)
        other    ─► parent, that is, no change
      Target ranks below the baseline learned for this agent type and parent model?
        no, or no baseline yet ─► unchanged, recorded "not cheaper" or "baseline unknown"
   7. Record the decision in $.state, then
        next({ ...e, model: target, prompt: prompt + router note })
   8. From the result: store the agentId and the model that actually started;
        $.ui.log one dim transcript line (not sent to the model)

 /subagent-router ──► reads $.state ──► table of this session's decisions (display only)
```

- **Hook point.** One `agent.spawn` hook. The engine raises it for every subagent start before the model is resolved.
- **Built-ins only.** Routing requires `e.provider` to be the engine's own agent. A user or plugin agent named `Explore` or `general-purpose` may set its own model, which the hook cannot see.
- **Explicit choices win.** A caller-supplied `model` is never changed. This is the manual override.
- **Kinds.** The picker names a kind, not a model. A kind is defined by what comes back, which survives rephrasing:
  - `locating`: the task only asks to find things (files, symbols, definitions, usages, where something is set). The answer is a list of locations.
  - `reading`: the task asks to read content and summarize it, explain how it works, or answer questions about what it says. Nothing is changed, and no judgment about quality, correctness or cause is asked for.
  - `other`: everything else, and whenever unsure. That covers any task that creates or changes files or state, runs or fixes something, finds the cause of a failure, reviews, assesses, designs, plans or decides. A task that mixes kinds takes the most demanding one.
- **Routes.** A route maps a kind to a model. There are two settings: the locating route (default `haiku`) and the reading route (default `parent`, which means off). The reading route is off by default because Sonnet's reading answers were less complete in 17 of 20 measured pairs and materially wrong in 1; the user turns it on by setting it to `sonnet`, ideally after observe mode has shown what it would save. Each can be set to another model or to `parent`, which turns it off. The reading route costs a small, measured loss of completeness, so it has to be switchable (user). `parent` means the router leaves `model` unset; it never writes the parent's model id, which for Explore can differ from what would have run.
- **No rule by agent type.** Explore and general-purpose are routed the same way. In the measurement the parent sent every locating task to Explore, so Explore is where most of the saving comes from, but it comes through the picker.
- **Picker.** `$.model.complete` on `haiku`, `effort: "low"`, a small `maxTokens`, `timeoutMs: 5000`. The system prompt lists the three kinds with the descriptions above. Only an exact kind name counts as an answer. `$.model.classify` is not used: it takes bare labels with a fixed prompt and has no timeout.
  - The descriptions must stay this narrow. With Anthropic's general model descriptions in their place, the same picker sent 10 of 160 change or judgment tasks to a cheaper model.
  - A stronger picker model is not needed; Sonnet as picker was no safer and left more savings unclaimed.
  - The measured prompt named its options `haiku`, `sonnet` and `inherit`. The built prompt names them `locating`, `reading` and `other` with the same descriptions. It is re-run on the kept prompt set before Stage 1 ships and must again give 0 of 160.
  - Haiku answered with a sentence in place of a bare name on 9% of the measured prompts. Those count as `other`. The builder must bring that under 1% on the kept set without loosening the rule that only an exact name counts.
- **Picker input.** The whole prompt, unchanged. A prompt over 16,000 code points is `other` with no picker call: cutting it down can remove the real instruction and leave something that reads as a search, and the longest measured prompt was 2,195 characters. The prompt is presented as data, with an instruction not to follow anything inside it. It is wrapped in a delimiter of random characters chosen for that call, drawn again if the prompt happens to contain it, so text copied into a prompt cannot close the block and answer for the picker. The kept prompt set gains prompts that try this, and every one must come back `other`.
- **When the picker is not asked.** In `route` mode the call is skipped when no route could apply: no baseline yet, or every route's target at or above it. After three timeouts or errors in a row the picker is off for the rest of the session and `/subagent-router` says so, so an outage does not add five seconds to every spawn. Spawns that fail together in one turn count once, and a call cut short by the user pressing Escape does not count. Observe mode asks for every in-scope spawn, so its counts are complete.
- **Never upgrade: the baseline is learned, not assumed.** The hook cannot see which model a spawn would run on without it. So for every in-scope spawn that names no model and that the router leaves alone, it records the model that actually started, per agent type and parent model. That is the baseline. A spawn that names its own model teaches nothing, because its model says nothing about what an unnamed one would get. A target applies only when it ranks below a recorded baseline by family name (haiku < sonnet < opus < fable/mythos). With no baseline yet, or an unrecognised id, the spawn is left alone, which also records one. Baselines are kept for the session only, so the first in-scope spawn of each agent type in every session is left alone; see "Open at approval". If a routed spawn starts on a model at or above its baseline, that route is off for the rest of the session and `/subagent-router` says so.
- **Routed agents do not spawn.** A child of a routed agent would inherit the cheaper model with nothing to restore it, and the hook cannot see what a child's own definition would have chosen. So any spawn whose parent is an agent this router moved is denied, with an error telling the agent to do the work itself. This is checked before anything else, including the mode, so switching to `observe` or `off` mid-session does not release an agent that is already on a cheaper model. It covers every agent type, including ones the router otherwise leaves alone and spawns that name a model. The exceptions are a fork, which is the same agent continuing, and a resume, which a hook cannot rewrite. A fork of a routed agent is recorded as routed itself, so its own spawns are refused too. An agent the router tried to move that started on its usual model anyway is not treated as routed. The cost falls on a general-purpose agent routed for a large reading task that would have fanned out: it has to do the work alone. The user has seen subagents delegate occasionally and cannot say how often, so observe mode keeps the id of every agent it would have routed and counts the spawns those agents make, and in `route` mode each refusal is recorded and shown as a transcript line. A spawn that is not under a routed agent is untouched.
- **Resumed agents.** A stopped subagent that is later resumed passes through the hook untouched: the engine lets a hook refuse a resume but not change it. The router does not rely on remembering which agents it routed, because a session can be closed and reopened in between. The router note ends with a marker line in a fixed format that never changes between versions. When a subagent the router does not recognise spawns something, and that subagent runs on a model ranked below the main session's, the router reads the subagent's first message, and if the marker is there the spawn is refused as for any routed agent. Text pasted elsewhere in a prompt does not count. Whether the marker is still the last line of the first message as the engine stores it is on the probe list; if engine text follows it, the rule becomes "a whole line equal to the marker". If the first message cannot be read, or compaction has replaced it, the spawn is allowed. Refusing on model rank alone was considered and dropped: it refuses the spawns of every agent that legitimately runs on a cheaper model, in observe mode and on a fresh install. What that gives up is narrow: a routed agent, resumed after the session's state is lost, whose first message is also unreadable, can start a child that inherits the cheaper model. From Stage 2 the ledger holds routed agent ids as well, and a resumed run adds its tokens to the same ledger row. Which model a resumed agent runs on is unverified; see probe. If it returns to the parent's model, the saving is lost and the whole conversation is written to that model's prompt cache afresh, which can cost more than the routed run saved. If the probe confirms that, the router note tells the parent to start a fresh agent instead of resuming one. Either way the record shows the model that actually ran.
- **Router note.** Appended to a routed subagent's prompt. It names the model and the reason, asks the subagent to say so in its first line instead of attempting the task if it needs file changes or judgment beyond searching and reading, and asks it to end its report with `Model: <model> (routed by subagent-router)`. This is how the parent learns the result came from a cheaper model. The parent never sees the note itself, so everything meant for the parent is a line the subagent is asked to copy into the end of its report: the `Model:` line, and the baseline model as the one to respawn with, so a parent does not pick something more expensive than it would have had without the router.
- **State.** The session's decisions and routed agent ids live in `$.state` as a state family with one entry per spawn, so parallel spawns in one turn never read and rewrite the same value. `$.state` reads one entry by a known id and cannot list a family, so the router also keeps an index: the list of entry ids and two counters (out-of-scope spawns, would-be refusals). The index is held in the module's memory and written whole to `$.state` after each change, with the writes kept in order; no hook reads it back to change it, and a reload reads it once. The record is written before the spawn continues and before any UI call. Stage 1 keeps nothing across sessions.
- **Standing down.** With `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` set the engine ignores per-spawn models, so the router does nothing and `/subagent-router` says so. `CLAUDE_CODE_SUBAGENT_MODEL` set and not forced needs no rule of its own: spawns start on that model, so that is the baseline the router learns. If the model that actually started differs from the target, the row is marked overridden.
- **`/subagent-router`.** Lists agent type, the kind picked or the reason nothing changed, the actual model and the task description, and how many spawns were out of scope. Costs are estimates from listed per-model prices and are labelled so; a run on a model with no listed price shows tokens only. Returned with `isTextDisplayOnly`, so it costs no parent tokens and feeds no model-written text back into the conversation. Every piece of text the router shows, here and in transcript lines, is stripped of control, escape, bidirectional and zero-width characters, flattened to one line and capped in length. The command is not registered to run mid-turn, because output answered mid-turn stays in the model's requests.
- **Observe mode.** In `observe`, the default after install, the router runs the picker and records what it would have chosen, and changes nothing: no model rewrite, no router note, and no refusal of an agent it merely would have routed. (An agent that was actually routed earlier, in `route` mode or before a resume, is still refused.) In `route` it acts. The user switches to `route` after reviewing the recorded picks on their own work. For each kind, `/subagent-router` also shows how many runs there were, how many it would have routed and an estimate of what those runs cost, taken from each run's own token counts, so the saving on offer is read from the user's real work and not from the measurement. Reading runs are counted and costed even while the reading route is off, which is what shows whether turning it on would be worth it.
- **Settings.** `mode` (`observe`, `route` or `off`) and the two routes, as `userConfig` fields. Only values set at the user or policy level count, and policy wins. The router reads those two settings sources itself on every spawn and does not rely on the options the engine hands the mod, so a value in a project's settings file, a local settings file or a command-line flag is ignored whatever the engine does with it. A cloned repository therefore cannot switch routing on or point a route at a cheaper model, and another plugin's attempt to change these settings is refused. A value that is present and not recognised never makes routing more active: an unrecognised `mode` is `off`, an unrecognised route is `parent`, and `/subagent-router` names the bad value. Because the setting is at the user level, changing it applies to every running session.

### Stage 2: the ledger

Stage 2 records evidence. It changes no routing.

- **Storage: one SQLite database (user).** The mod runtime has no SQLite binding, so the mod runs a small helper script it ships, through `$.process.run`. The request goes in as JSON on standard input, and every value is bound as a parameter, never spliced into SQL: labels are model-written text. The database is opened in WAL mode with a busy timeout, and each call is one short transaction.
  - A probe on Windows with 40 processes writing at once recorded all 40 writes and let exactly one win a compare-and-set. One call took about 56 ms, against about 700 ms for the picker call.
  - The helper needs Python or Node on the machine. Which of the two is the builder's call.
  - The runtime is found once on `PATH`, never in the working directory, and run by its absolute path with the plugin's data folder as the working directory, and Python with `-I`. A repository that ships its own `python.exe` must not be able to get it run.
  - The database lives in the plugin's data folder (`CLAUDE_PLUGIN_DATA`), which survives upgrades, and never inside a repository. It carries a schema version. Migrations only add, and a helper that meets a newer version than its own refuses to write.
  - The busy timeout is well under the call's timeout. Each write carries a request id so a late commit cannot apply twice, and after a timeout the mod reads back before reporting failure.
  - A bad value, such as an unpaired surrogate or an over-long string, is cleaned or rejected as one row. Only the helper being unable to run switches the stages off.
  - `$.process` exists in the terminal CLI only. Where it is missing, or neither runtime is found at session start, or the helper cannot run, Stages 2 and 3 are off for that session. Overrides read at session start stay in force for the session. If a database exists but could not be read at all, nothing is routed in that session, because a move to a stronger model might be among what could not be read. Where no database exists, Stage 1 routes from settings. `/subagent-router` says which applies.
- **What a ledger row holds.** Project, kind, agent type, model asked for, model that ran, which rule set the model (the setting, an automatic override, or an override from a comparison), input and output tokens, duration, how the run ended, the signals below, and a timestamp. No prompt and no description. A row is keyed by agent id and written as an upsert: a resumed run adds its tokens to it, and signals are flags that are combined, never appended.
- **Signals recorded per routed run.**

  | Signal | How it is seen | Strength |
  |---|---|---|
  | The subagent's first line says the task needed more than its route allows | The router note asks for it; read from the answer at the subagent's `turn.complete` | Strong |
  | The parent redoes the task on a stronger model | A spawn of the same agent type by the same parent, in a later turn than the routed run's end, carrying an explicit stronger `model`. Spawns the router itself starts never count | Weak; recorded, not counted. It cannot tell a redo from an unrelated task |
  | The user flags a routed result | `/subagent-router bad <row>` | Strong |
  | The subagent reports the task was beyond it | The fit line, below | Strong |
  | The run ended in an error | The end reason at `turn.complete` | Weak; recorded, not counted |
  | The run was unusually large | Tokens above five times the median for that kind and model | Weak; recorded, not counted |

- **The subagent reports on fit (user's idea).** The router note also asks a routed subagent to end with what it did not verify and one of `Fit: easy`, `Fit: a stretch` or `Fit: beyond me`. Both that line and the first-line report must carry a random token the router put in that agent's note, and the `Fit:` line must be the last line of the answer. A file the subagent quotes, this document included, cannot then produce either signal. It asks for facts and a coarse rating, not for a verdict on the model, because a model cannot see what a stronger one would have found. In the measurement both models volunteered what they had not checked, and in the three cases looked at the judges' omission lists matched those statements. The fit question itself is untested.
- **Labels for unlisted kinds (user's idea).** When the picker answers `other`, a second Haiku call gives the task a short label, such as "run tests and report", and says what comes back: a report, an account, a change or a judgment. It is a separate call, made after the spawn has started, so the picker call stays exactly as measured and no earlier label ever enters it. The label call is shown the most common existing labels and reuses one when it fits. If it fails, nothing is recorded and nothing else is affected. The outcome is one of those four fixed values. A label is reduced to at most six words of lower-case letters, digits, spaces and hyphens before it is stored, because stored labels are shown to later calls. The database counts labels per project. `/subagent-router kinds` shows which recur.
- **Scope.** Ledger rows, labels and overrides carry the project. In a git repository the project is the hash of its first commit, so worktrees, renamed folders and fresh clones count as one project. Elsewhere it is the folder path. Settings stay global.
- **Retention.** Ledger rows older than 180 days are deleted at session start.

### Stage 3: adaptation

Every number here is a starting point, to be fixed from Stage 2 data before this stage is built.

- **Overrides.** An override is a row in the database: for this project, this kind goes to this model. The route lookup uses the project's override when one applies and the setting otherwise. `/subagent-router` shows every override with the evidence that caused it, and `/subagent-router reset <kind>` removes one.
- **The user's latest choice wins.** An override stores a model family name, never a full model id, and records the value the setting had when it was made. If the setting has been changed since, an override that is cheaper than the new setting no longer applies and is shown as stale. One that is stronger stays, because it protects a route that was failing. So setting a route to `parent` turns it off in every project at once, a comparison confirmed after that applies again in its project, and making a setting cheaper does not undo a move to a stronger model.
- **Moving to a stronger model is automatic.** When a kind has 3 strong signals in its last 20 routed runs in a project, its override moves one step stronger (haiku to sonnet, sonnet to parent). Only runs on the route's current model that started after its last move or reset are counted, so one burst of signals cannot move a route twice and a reset is not undone by old evidence. The count and the write happen in one transaction, with one override row per project and kind, so two sessions cannot both apply it. A transcript line says what moved and why. The worst outcome of a wrong move is paying more than necessary.
- **Moving to a cheaper model needs a comparison the user starts.** `/subagent-router compare <kind>` first states the estimated cost and waits for the user to confirm. Then it:
  1. has an agent on the parent's model write 12 fresh questions of that kind about the repository as it stands;
  2. runs each on the current model and the next cheaper one, at the same moment, on the read-only Explore agent;
  3. has judge agents on the parent's model check each pair against the code without knowing which model wrote which;
  4. shows the tally and a recommendation, and changes the override only if the user confirms.

  This is the method of "Measurement results", pointed at the user's repository. It uses no past prompts (user), so it has no dependency on earlier state or on outside services, and the router stores no task text. Tasks that read from outside services are never compared; for those the only evidence is the live signals.

  The override is written only if the route is still on the model the comparison started from. If another session moved it meanwhile, the user is shown the change and asked again. The cost shown up front covers the question writer, both sets of runs and the judges; by the measurement's figures one comparison is in the region of $5 to $15, which a reading route on the general-purpose agent earns back after roughly 10 to 25 routed tasks at the measured saving of about $0.59 each, and after many more on Explore, where a reading task costs less to begin with. The question writer and the judges read repository files that could try to steer them, so a judge's verdict is read as one of a fixed set of values and a repository path containing control characters is refused. Twelve pairs with no bad one still leave the true rate anywhere below about one in five, and the command says so with its result.
- **Tolerance.** A setting states what the user accepts from a comparison. The default is "no pair where acting on the cheaper answer would cause a mistake". The recommendation follows it; the user still confirms.
- **Prompts to run a comparison.** The router suggests one, in a transcript line, when a model id it has not seen before appears, and when a kind has 10 `Fit: easy` reports in its last 20 runs. These only suggest. They never move a route.
- **Label merge (user's idea).** At session start, if a week has passed since the last merge, one model call groups similar labels. The session claims the merge with a lease that expires, and the stored time is updated only when the merge finishes, so a session that dies mid-merge does not block merging for a week. A merge writes alias rows only and counts are added up when read, so labels counted while a merge runs are not lost. Labels with different outcomes are never merged, so "run tests and report" and "run tests and fix" stay apart. Merged labels are kept as aliases so a merge can be undone.
- **New kinds are proposed, not added.** When a label has recurred 20 times in a project, `/subagent-router kinds` proposes it as a new kind with a draft description. If the user accepts, the description is run against the kept prompt set first; a description that pulls in any change or judgment task is refused. An accepted kind starts with its route at `parent`, so it is observed before it routes anything, and moves cheaper only through a comparison.

## What the documentation settles

Read on 2026-11-17 from the Claude Code and Claude Platform docs. The probe still confirms each by running it.

- **Model resolution order for a subagent:** the per-invocation `model` parameter, then the definition's `model` field, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the parent's model. The router acts at the first level.
- **Built-ins today:** general-purpose runs on the parent's model. Explore runs on the parent's model, except that under a Fable parent on a subscription or Console account it runs on Opus.
- **Blocked models:** when an allowlist blocks a subagent's model, Claude Code runs it on a fallback model instead of failing the call.
- **Effort:** the session's effort level does not carry to a subagent on a different model, so a routed subagent runs at its own model's default effort.
- **Anthropic's model guidance** is coarse: Haiku for "simple tasks", "high-volume, straightforward tasks" and "subagent tasks"; Sonnet for "everyday coding, agent, and enterprise workloads"; Opus for "complex reasoning" and "long-running agentic coding". It names no task-level rules for search or summarizing, and its method is to test candidates on one's own prompts.

## Misroutes

A task that should have stayed on the parent's model can still be given a cheaper one. What limits the damage:

1. The kind list makes `other` the answer for anything that changes state and for any doubt.
2. Every failure path (timeout, error, unparseable answer) counts as `other`.
3. The router note asks the subagent to stop and report when the task needs more than reading.
4. The parent sees the `Model:` line, and the user sees the transcript line and the decision list.
5. The picker was measured on a blind synthetic set before building, and the mod starts in observe mode, so nothing is routed until the user has seen its picks on their own work.
6. From Stage 3, a route that keeps producing strong signals moves to a stronger model.

What none of these catch: an answer from a cheaper model that is correct but thinner, given without complaint. In the measurement that was the actual difference between Sonnet and Opus on explanations. Only a comparison shows it.

A keyword veto ("edit", "write", "fix" and so on force `other`) was considered and rejected: read-only prompts routinely contain "do not edit any files", so it would veto the tasks the mod exists for.

## Constraints

- A fork always inherits its parent's model and a resumed agent's content cannot be rewritten. Both are engine rules.
- If the hook itself fails, the engine skips it and the spawn starts unchanged. That includes the nested-spawn deny, which then does not apply.
- The picker adds one short model call, at most 5 seconds, before each in-scope spawn. Measured median 0.7 s.
- A routed subagent may get a smaller context window than its parent's model would give it. Unverified; see probe.
- Stages 2 and 3 need the terminal CLI and Python or Node.
- In the measurement, the report of every agent a mod started was delivered into the main conversation. A comparison starts dozens of agents, so Stage 3 depends on finding a way to keep those reports out; see probe.

## Where it is built and shipped

- Built in `plugins/subagent-router/` on its own branch off `main`, and loaded from there with `claude --plugin-dir`. Not in a session's mod folder: an executor in another session has a different one, and commits need a repository. Not on `feat/bug-hunter-extractor-1a`.
- Packaged with a `marketplace.json` entry and a root README row once Stage 1 works.
- The repo's `CLAUDE.md` says "nothing to build, nothing to run" with one code exception. This plugin is a second: a rule is added to run `claude plugin validate` and `claude plugin test` on `plugins/subagent-router` after any change and not commit until they pass.
- The kept prompt set ships inside the plugin as data, copied from `docs/superpowers/specs/2026-11-17-subagent-router-measurement/`. `/subagent-router check-picker` runs it against the live picker and reports the three numbers from "Measurement results"; it makes 250 Haiku calls (the 240 measured prompts and ten injection prompts), says so before it starts, and runs only when a person types the confirmation, not when another plugin or a scheduled prompt issues the command. A run in which any call failed is not a result. The check also fails if any measured reading prompt comes back `locating`, since that would send a reading task to Haiku, which was never measured. The prompt text the check last passed on is kept beside the picker, and a unit test fails when the shipped prompt differs from it. It is used before a picker change ships and, in Stage 3, to test a proposed kind's description. The exact prompt that was measured is in `picker-prompt.md` in that folder.
- The helper script has its own tests, run with its runtime's built-in test runner, because the mod test kit has no file system or processes. The `CLAUDE.md` rule names that command too.

## Verification

1. **Probe first** (a logging-only build; results recorded, and the design revisited on any surprise).
   - That a rewritten `prompt` takes effect, and what the built-in `general-purpose` resolves to. For Explore, a `model` set per spawn is already confirmed (see "Measurement results").
   - Whether the mod can read `CLAUDE_CODE_SUBAGENT_MODEL` and `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`, and that forcing outranks the hook.
   - Whether `agent.spawn` hooks for several Agent calls in one message run concurrently or in sequence.
   - The context window of a routed subagent under a 1M-context parent.
   - What happens when the target model is not allowed for the account. Documented as a fallback model, not a failure; the row must then show the model that actually ran.
   - The form of `parentModel` ids under the providers in use.
   - What model a resumed routed agent runs on and what the resume costs in cache writes, whether `$.state` survives a session that is closed and reopened, and whether a resting agent's messages can be read.
   - Under what key the user-level settings hold this plugin's values, and whether a project value reaches the mod's options (recorded only; the router reads the user and policy sources regardless).
   - Whether a state write inside one hook sees writes made by other spawns in the same turn (recorded only; the index does not depend on it).
   - Whether the marker is still the last line of a routed subagent's first message as the engine stores it.
   - For a spawn made by a subagent: whether `parentAgentId` is set and whether that subagent's messages can be read.
   - Whether a subagent's `turn.complete` can arrive before its spawn hook has finished.
   - Whether the command is still registered after a settings change reloads the mod.
   - What the test kit can stand in for (state, settings, the model call, a second plugin), pinned by a test file before the router is written.
   - Before Stage 2: how `$.process.run` resolves a bare program name on Windows, whether it kills its child at the timeout, and whether moving the mod from the dev folder to the plugin folder changes its data folder.
   - Before Stage 2: where a mod may keep a database file, and that `$.process.run` can start the helper on each platform.
   - Before Stage 3: whether the report of an agent the mod starts can be kept out of the main conversation.
2. **Unit tests** (`claude plugin test`, model call stubbed).
   - Stage 1: every numbered branch in the diagram; explicit `model`; Sonnet and Haiku parents; picker timeout, error, unparseable answer; empty prompt; a prompt over 16,000 characters, never sent to the picker; a prompt containing the picker's own delimiter; non-ASCII and control characters in prompt, description, agent type and model id; three spawns whose picker replies and starts resolve out of order, each recorded against its own spawn and all three shown by the report; a spawn under a routed agent denied, also after the mode changes and when recording the refusal fails; an unrecognised spawner with and without the marker, on a cheaper and on the main model, readable and unreadable; a start that is refused or returns no agent id; a value set only at project, local or flag level; an unrecognised mode and route; an explicit model that must not teach the baseline; a user-defined `general-purpose`; another plugin's spawn; a failing `$.ui.log` with the record still written; display-only command output; state from an earlier version of the mod after a reload; each route set to `parent`; every agent type spawned under a routed agent, with and without a `model`, and a fork under one.
   - Stages 2 and 3, mod side (`$.process.run` stubbed): the helper missing, failing and timing out, with routing unaffected each time; a label containing quotes, SQL, non-ASCII and control characters passed through unchanged; an override made against an older setting value ignored; `compare` started twice; a session closed in the middle of a comparison.
   - Stages 2 and 3, helper side (its own test runner, real database files): two processes racing the same row move, with one winner; two racing the label merge; the helper killed mid-transaction; a missing, locked and corrupt database file; a database written by an earlier version; hostile label text stored and read back intact.
3. **Picker measurement** (done 2026-11-18; see "Measurement results"). The user's session transcripts are not read (user). The set is kept as a regression test: any change to the picker prompt or to a kind's description is re-run against it before it ships.
4. **Observe mode on real work.** The mod runs in `observe` for some days of normal use. `/subagent-router` then shows what share of spawns are in scope and what would have been picked for each. The user reviews the picks and switches to `route`.
5. **In use, in `route` mode.** One Explore search, one general-purpose summary and one general-purpose implementation task, checked against the model that actually ran, not against the router's own record. Token usage compared with the same tasks unrouted.
6. **Before Stage 3 is built.** The ledger is read after some weeks of use, and the thresholds in "Stage 3" are set from how often each signal occurred.

## Measurement results (2026-11-18)

Run from a Fable session with a throwaway mod, since deleted. Repository: `ErsatzTV/legacy` at commit `8b2af35`, about 3,700 C# files. The prompt set, its labels and the picker's answers are in `docs/superpowers/specs/2026-11-17-subagent-router-measurement/`.

### Picker

60 scenarios, ten of each category (locating, reading and summarizing, implementing, debugging, reviewing, designing). Each was written as an Agent call by four independent Opus agents that knew nothing about the router, in four styles (natural, terse, full brief, question form): 240 prompts, of which 160 are change or judgment tasks that must stay on the parent's model.

| Variant | Change or judgment task given a cheaper model | Routable task left on the parent's model | Scenarios whose four phrasings all got the same outcome |
|---|---|---|---|
| Narrow descriptions, Haiku picker (the design) | 0 of 160 | 12 of 80 | 48 of 60 |
| Anthropic's general descriptions, Haiku picker | 10 of 160 | 24 of 80 | 39 of 60 |
| Narrow descriptions, Sonnet picker | 0 of 160 | 22 of 80 | 49 of 60 |

- Zero in 160 puts the true misroute rate probably under 2%. It does not show that it is zero.
- All 40 change or judgment scenarios got "no change" in all four phrasings. Every inconsistent scenario was a locating or reading task where one phrasing was routed and another was not, which costs saving and not quality.
- No reading task was sent to Haiku.
- Haiku wrote a sentence in place of a bare option name on 22 of 240 prompts. All 22 were treated as "no change".
- Picker latency: median 0.7 s, 95th percentile 1.7 s, maximum 2.1 s. About 600 input tokens per call.
- The writers also chose the agent type. All 40 locating prompts went to Explore. 34 of 40 reading prompts and all 160 change or judgment prompts went to general-purpose.

### Downgrade

20 scenarios run on the built-in Explore agent with the model set per call: 12 searches scored against an answer key generated from the code, and 8 explanations compared blind by judge agents that checked both answers against the code.

| | Opus | Sonnet | Haiku |
|---|---|---|---|
| Search items found (12 scenarios) | 106 of 106 | 106 of 106 | 106 of 106 |
| Estimated cost of the 12 searches (too high for Opus and Sonnet; see the note below the table) | $2.65 | $1.08 | $0.08 |
| Explanation preferred by the judge (8 scenarios) | 8 | 0 | not run |
| Gap rated material | 0 | 0 | not run |
| Mean completeness of explanations, 1 to 5 | 5.0 | 4.1 | not run |
| Mean accuracy of explanations, 1 to 5 | 4.6 | 4.5 | not run |

- The search costs were computed with cache reads at 0.1 of the input price. The listed rate is 0.05 for Opus 5.5 and Sonnet 5.5, and 0.1 for Haiku 5.5. The token records of these 36 runs were not kept, so the Opus and Sonnet figures cannot be recomputed; the true Opus figure lies between $1.33 and $2.65. Applying the correction found on the reading runs below (0.81) gives about $2.15, and a saving of about $0.17 per search routed from Opus to Haiku, where $0.21 was first reported. The bounds are $0.10 and $0.21.
- Searches: no difference in what was found. This supports Haiku for locating.
- Explanations: Sonnet's were correct but less complete, in every pair, and never to the point where acting on them would cause a mistake. Routing reading tasks to Sonnet is therefore a small, consistent loss of completeness for roughly a third of the cost. The user accepts that trade, with the route switchable.

### Reading on the general-purpose agent

Run after the second review, because the explanation result above came from eight tasks on Explore while most reading prompts go to general-purpose. 20 reading tasks on the built-in general-purpose agent, each on Opus and on Sonnet: ten are prompts the blind writers had addressed to general-purpose, ten were written for this test on other parts of the code. Ten judge agents compared each pair blind and checked both answers against the code. Each run's own record confirms the model: every assistant message in the Opus runs came from `claude-opus-5-5` and every one in the Sonnet runs from `claude-sonnet-5-5`.

| | Opus | Sonnet |
|---|---|---|
| Preferred by the judge (20 pairs; 3 ties) | 17 | 0 |
| Pairs where acting on this model's answer would cause a mistake | 0 | 1 |
| Mean accuracy, 1 to 5 | 4.40 | 4.40 |
| Mean completeness, 1 to 5 | 4.95 | 3.95 |
| Claims the code contradicts, all 20 answers | 21 | 22 |
| Omissions noted, all 20 answers | 22 | 85 |
| Mean answer length | 15.0 KB | 10.3 KB |
| Estimated cost per task | $0.92 | $0.33 |

- Sonnet was as accurate as Opus claim for claim, and markedly less complete. That matches the Explore result.
- One Sonnet answer in 20 was materially wrong: on how the classic playout builder treats existing items, it stated the opposite of what the code does. Checked against the code: the answer described a loop that removes items past the anchor, which exists, but did not trace where that loop's data comes from, and for classic playouts the list is always empty. The wrong statement came from the same cause as the omissions, stopping one step short.
- With the eight Explore pairs, that is 1 material gap in 28. The data fit a true rate anywhere up to about one in six.
- A reading task routed to Sonnet saves about $0.59, a little under two thirds of its cost. These figures were recomputed on 2026-11-18 from the 40 runs' recorded token counts at the listed cache rates; the figures first reported were $1.14, $0.38 and a saving of $0.76.

### What the measurement does not show

- The mix of tasks in real sessions, and so the real saving. Observe mode shows that.
- Searches that do not name a symbol. All 12 search scenarios named an exact type, method or string, which is the easy case for a cheaper model.
- Kinds of task outside the six categories, such as running a test suite and reporting, or fetching from an outside service and summarizing.
- Any other language or a much larger repository.
- Prompts that depend on a long session's context.
- False extra claims in search answers. Only what was found was scored. One Haiku answer gave a wrong count in its first line above a correct list.
- The judges were Fable agents, the same model family as the writers of both answers. Reading costs use the listed rates: cache reads at 0.05 of the input price for Opus 5.5 and Sonnet 5.5, five-minute cache writes at 1.25. Search costs were computed with cache reads at 0.1, which is right for Haiku and too high for the other two, and with Haiku at its lowest listed price.

### What the mod API showed along the way

- A `model` set per spawn is honoured for the built-in Explore agent: the three arms started on `claude-opus-5-5`, `claude-sonnet-5-5` and `claude-haiku-5-5` as asked.
- `turn.complete` carries the subagent's id, its answer, its token usage and the model that answered. The ledger is filled from there.
- A `cwd` passed to `$.agent.spawn` did not change where the Explore agent searched, and two agents then searched outside the intended folder. A comparison must put the repository path in the prompt and tell the agent to stay inside it.
- The report of every agent the mod started was delivered into the main conversation.

## Left to the builder

Picker prompt wording within the rules above, the state contract's shape (it must be versioned so a reload reads older values cleanly), the database schema (versioned likewise), Python or Node for the helper, log line text, router note wording, family-name matching, command argument syntax.

## Open at approval

These are deferred and leave the design on the conservative path until decided.

- The Stage 3 thresholds (3 strong signals in 20 runs; 10 easy reports in 20; 20 recurrences before a kind is proposed; 12 questions per comparison). Starting points only; set from the Stage 2 ledger. Until then nothing moves automatically.
- Decided at approval: the reading route ships off. The reasoning, kept for the record: the user had accepted Sonnet for reading tasks. The evidence is thinner than that acceptance may have assumed: eight explanation tasks, all on Explore, while 34 of 40 reading prompts in the picker set went to general-purpose. Eight pairs with no material gap leave the true rate anywhere below about three in ten. That measurement has now been run ("Reading on the general-purpose agent"): Sonnet saved two thirds of the cost, was less complete in 17 of 20 pairs, and was materially wrong in 1 of 20. Claude's recommendation is to ship the reading route as `parent`, so that only locating is routed by default, and leave Sonnet for reading as a setting the user turns on knowing those figures. Until the user chooses, the default is `parent`.
- Whether the baseline should be relearned in every session. As designed it is: Stage 1 keeps nothing across sessions, so the first Explore spawn and the first general-purpose spawn of each session run unchanged. A session that makes one search saves nothing; one that makes five loses a fifth of the saving. Found by the review of the plan, after approval. Observe mode measures it: the report counts locating runs left alone for want of a baseline. Two ways out if the count is large. One is to let a route whose target is the cheapest family apply with no baseline, since Haiku cannot be an upgrade, and have the router note tell the parent to respawn with a line the router recognises and passes through, in place of naming a model. The other is to keep baselines in the Stage 2 database. Until the user chooses, the first spawn of each type in a session is left alone.
- Whether routed agents should be allowed to spawn the two built-in agent types. The relaxed rule would route such a child against the model its parent would have had without the router, so a locating or reading child still goes cheaper and any other child is set back to that original model. It is exact for the built-in types, which have no model of their own; other agent types would still be refused. Until the observe-mode count shows the refusal matters, every spawn under a routed agent is refused.
- Whether mod-started agents' reports can be kept out of the main conversation. If they cannot, the comparison command needs another way to run, and is not built until one is found.

## Second review (2026-11-18), by concern

Four reviewers read the rewritten document cold, one each for lifecycle, concurrency, untrusted input, and cost and authorisation. 34 findings; the ones that changed the design are below, and the body above already reflects them.

| Finding | Concern | Outcome |
|---|---|---|
| The never-upgrade check compares against a model the hook cannot see | Cost | Accepted. The baseline is learned from spawns the router leaves alone. |
| A project's settings file, or another plugin, could switch routing on or make it cheaper | Authorisation | Accepted. Only user and policy values count. On the probe list. |
| The helper's runtime could be resolved from the repository folder and run a file the repository ships | Untrusted input | Accepted. Absolute path from `PATH`, plugin data folder as working directory, database outside any repository. |
| Text copied into a task prompt can close the picker's data block and answer for it | Untrusted input | Accepted. Random delimiter per call; injection prompts join the kept set. |
| The router note invites a respawn on a model dearer than the baseline | Cost | Accepted. The note names the baseline. |
| `parent` written as the parent's model id would upgrade Explore under a Fable parent | Cost | Accepted. `parent` leaves `model` unset. |
| Switching mode mid-session releases agents already on a cheaper model to spawn | Lifecycle | Accepted. The refusal is checked before the mode. |
| The observe-mode count of would-be refusals is always zero as designed | Lifecycle | Accepted. Observe keeps the ids of agents it would have routed. |
| The marker for a routed agent can be forged by pasted text, lost to compaction, or reworded by an upgrade | Lifecycle, untrusted input | Accepted. Fixed marker at the end of the first message, and a fallback by model rank. |
| Parallel spawns may be unable to write shared session state | Concurrency | Accepted. One state entry per spawn. On the probe list. |
| Only command output is cleaned; transcript lines are not | Untrusted input | Accepted. One cleaner at every place text is shown. |
| A helper failure sends routing back to settings, undoing moves to stronger models | Lifecycle | Accepted. Overrides stay in force for the session; an unreadable database means nothing is routed. |
| The project key is a folder path, so worktrees and clones split the evidence | Lifecycle | Accepted. First-commit hash. |
| Signals from before a move are counted again and move the route twice; a reset is undone | Lifecycle, concurrency | Accepted. Only runs on the current model since the last move count. |
| Database location and schema version unspecified; an old helper could write to a newer schema | Lifecycle | Accepted. Plugin data folder, versioned, additive migrations. |
| The "parent redoes the task" signal fires on the router's own comparison runs and on unrelated explicit models | Concurrency, cost | Accepted. Demoted to a weak signal that is recorded and not counted. |
| A file the subagent quotes can contain the bail-out line or a `Fit:` line | Untrusted input | Accepted. Both need a per-agent token; `Fit:` must be the last line. |
| One malformed value switches Stages 2 and 3 off for the session | Untrusted input | Accepted. Bad rows are rejected singly. |
| Labels are unbounded model-written text shown to later calls | Untrusted input | Accepted. Fixed outcome values; labels reduced to a few plain words. |
| A helper that times out can still commit later | Concurrency | Accepted. Short busy timeout, request ids, read-back. |
| Confirming a comparison can overwrite a move another session made meanwhile | Concurrency | Accepted. Conditional write. |
| The label merge loses counts made while it runs, and a dead session blocks it | Concurrency | Accepted. Alias rows, expiring lease. |
| A resumed run can lose or double-count tokens and signals | Concurrency | Accepted. Upsert by agent id; signals as flags. |
| "A saving is lost and nothing else" on resume ignores the cost of rewriting the prompt cache | Cost | Accepted. Corrected; on the probe list. |
| Making a setting cheaper silently drops stronger overrides in every project | Cost | Accepted. Only overrides cheaper than the new setting go stale. |
| The comparison's cost is understated, and repository files can steer its writer and judges | Cost, untrusted input | Accepted. Full estimate, fixed verdict values, and the result states its own uncertainty. |
| Keep a second copy of overrides in `$.store` so a deleted or restored database cannot undo stronger moves | Lifecycle | Not taken. It adds a second store with unknown behaviour under several sessions. Deleting the database resets adaptation, and `/subagent-router` shows when the database was created. |
| Ship the reading route as `parent`: the downgrade was measured on Explore only, on eight tasks | Cost | Open; see "Open at approval". |

## Review outcome

| Finding | Outcome |
|---|---|
| `$.ui.notice` writes under a permission dialog, which Agent calls rarely have; a refused notice could also skip the record | Accepted. `$.ui.log` instead; record first. |
| A downgrade is inherited by everything the routed agent spawns | Accepted. Routed agents may not spawn. The reviewer's alternative, restoring the original model on children, was not used because the hook cannot see a child definition's own model. |
| The classifier call has no time bound and `classify` cannot carry label definitions | Accepted. `$.model.complete` with described options and a timeout. |
| The parent never learns of the downgrade | Accepted. Router note in the subagent's prompt. |
| First-4,000-character truncation drops the instruction | Accepted. Head and tail, larger cap. |
| Explore is read-only, not search-only | Accepted. Explore is classified like general-purpose. A Sonnet floor for Explore was added after the measurement and removed on the builder check; see "Approaches". |
| Deterministic keyword veto before the classifier | Rejected. See "Misroutes". |
| Concurrent state writes lose entries | Accepted. `update()` within a session; SQLite across sessions. |
| Command output re-enters the parent's context | Accepted. Display-only and sanitised. |
| Name-only type match; definition model invisible | Accepted. Built-ins only; actual model recorded. |
| Other plugins' spawns are routed | Accepted. Passed through. |
| Classifier failures are invisible | Accepted. Unchanged rows carry a reason. |
| Twenty hand-written prompts prove little | Accepted. A blind synthetic set of 240 prompts, then observe mode on real work. The reviewer's suggestion to harvest the user's transcripts was not taken. |
| Unit tests cannot expose engine-side behaviour | Accepted. Probe list extended; in-use check reads the actual model. |
| Repo is documented as Markdown and JSON only | Accepted. `CLAUDE.md` exception added with the plugin. |
| Replace the classifier with mod-registered cheap agent types | Rejected. See "Approaches". |

## Plan review (2026-11-18)

Three reviewers read the Stage 1 plan cold against this design and the mod API's type file: one for coverage and lifecycle, one for executability, one for hostile input, concurrency and cost. The plan was rewritten. These points change the design itself, and the body above now reflects them. Rows in the two earlier review tables that they supersede (the fallback by model rank, head-and-tail truncation) are left as the record of what was decided then.

| Was | Now | Why |
|---|---|---|
| Records are one state entry per spawn, nothing shared | Plus an index of entry ids, held in module memory and mirrored whole to `$.state` | `$.state` reads one entry by a known id and cannot list a family, so the report and the cost hook could not find records. No hook reads the list, changes it and writes it back. |
| Long prompts send the first 4,000 and last 8,000 characters to the picker | A prompt over 16,000 code points is `other`, with no picker call | The real instruction can sit in the removed middle and the task then reads as a search. The longest measured prompt was 2,195 characters. |
| A delimiter found inside the prompt is removed from it | The delimiter is drawn again until the prompt does not contain it | Removal can rebuild a tag from nested pieces, and it alters the text being classified. |
| An unrecognised spawner whose first message cannot be read is refused when it runs on a model ranked below the main session's | It is not refused. The marker is checked only when the spawner's model ranks below the main session's, and an unreadable or compacted first message passes | The rank rule refused the spawns of every agent that legitimately runs on a cheaper model, in observe mode and on a fresh install. What is given up: a routed agent that is resumed after the session's state is lost, and whose first message is also unreadable, can start a child that inherits the cheaper model. |
| Whether the marker ends the first message is assumed | On the probe list | A reviewer's own first message carried engine text after its prompt. If that is general the rule becomes "a whole line equal to the marker". |
| Observe mode marks a would-be refusal on the spawn's record | A counter | Most such spawns are out of scope and have no record. |
| Out-of-scope spawns leave no trace | They are counted | "What share of spawns are in scope" had no denominator. |
| Settings arrive as the mod's options; whether a project value reaches them is on the probe list | The mod reads the user and policy settings sources itself on every spawn | The probe as written would have answered "no" falsely and removed the guard. An unrecognised mode is `off` and an unrecognised route is `parent`. |
| `CLAUDE_CODE_SUBAGENT_MODEL`, unforced, is the baseline for general-purpose | Dropped | The learned baseline already reflects it, and using it in place of a learned Haiku baseline could raise a spawn's model. |
| The picker runs for every in-scope spawn | In `route` mode it is skipped when no route can apply, and after three failures in a row it is off for the session | Each call costs up to 5 seconds. Observe mode still asks every time, so its counts are complete. |
| Built in the session's mod folder and copied later | Built in `plugins/subagent-router` on its branch and loaded with `--plugin-dir` | An executor in another session has a different mod folder, and commits need a repository. |

**Cost figures.** The dollar figures under "Measurement results" were first computed with cache reads at 0.1 of the input price. The listed rate is 0.05 for Opus 5.5 and Sonnet 5.5, and subagent runs are mostly cache reads. The reading figures have been recomputed from the runs' recorded token counts: $0.92 per task on Opus and $0.33 on Sonnet, where $1.14 and $0.38 were reported. The search runs' token records were not kept, so those figures carry a correction estimated from the reading runs. The counts (items found, answers preferred, omissions) are unaffected. The plugin prices runs from listed per-model prices and labels the result an estimate.
