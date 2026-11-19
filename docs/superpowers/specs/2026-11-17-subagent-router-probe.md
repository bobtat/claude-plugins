# subagent-router: stage 1 probe results

**Stops:** None of the answers so far requires a stop. Two stop conditions are still pending: Q5 (no user-level entry found under any key) and Q12 (a `/config` change does not land in the user source). Both depend on interactive steps the user has not yet run.

## How the runs were made

- **When and how.** The runs took place on 2026-11-19. The user started each one as a headless `claude -p` session. The Claude Code version installed when this was written was 2.1.328.
- **What was loaded.** Each session loaded a frozen copy of the probe build at commit 61fd99c with `--plugin-dir`. The Q13 runs also loaded a throwaway observer plugin, `probe-observer`.
- **Flags.** Every run used `--strict-mcp-config --permission-prompts none`. All runs except E-project also used `--restricted`: file tools stay inside the worktree, the command and web tools are removed, and the user, project and local settings files are ignored. E-project instead used `--disallowedTools Bash,PowerShell,Write,Edit,NotebookEdit,WebFetch,WebSearch`, so settings files were read.
- **Model caveat.** Restricted runs ignore the settings files. So their `session` records say nothing about the user's settings, and run A's parent model, which had no `--model` flag, is the account's default rather than the model the user's settings would choose.
- **Prompts.** Every prompt had one extra sentence asking that all work stay inside the current directory. No output file shows an agent or the main session failing or refusing because of the restrictions.
- **Data folder.** The plugin's data folder is named `subagent-router-inline`, and the observer's is `probe-observer-inline`. That suggests a `--plugin-dir` plugin is identified as `<name>@inline`, but no run has shown a settings key yet: Q5's user-level step is what confirms the id.

### Files and runs

- **Run A's first launch.** It exited with code 127 after half a second, started no session and wrote no files. E-local was refused because a local settings file already existed, so it did not run.
- **Probe files.** The 14 sessions that ran wrote 103 probe files: 14 `session`, 21 `spawn`, 21 `started`, 21 `q6`, 23 `end`, 2 `self-spawn` and 1 `parent-messages`. The observer wrote 2 `observed-spawn` files.
- **Spawn count.** The 21 spawns break down as:
  - 2 each for the nine prompt-A runs (A, B, C1 to C6, F1);
  - 2 for D: one general-purpose agent and the Explore agent it started;
  - 1 for F2's resumed Explore agent.
- **End count.** The 23 `end` records are those 21 agents plus the 2 self-spawned agents of Q13a and Q13b.

## Answers

Q1: Explore and general-purpose agents started on these models when no `model` was set (evidence: runs A, B, F1, D, C1, `started` records).

- **Run A, parent `claude-fable-5-2`:** the general-purpose agent started on `claude-fable-5-2`, the parent's model. The Explore agent started on `claude-opus-5-5`, not the parent's model.
- **Sonnet parent (B, F1, D):** both agent types started on `claude-sonnet-5-5`.
- **Opus parent (C1):** the general-purpose agent started on `claude-opus-5-5`. C1's Explore agent was routed by the hook, so it says nothing about the default.
- **Caveat:** run A's parent is the account default, not the user's configured model.

Q2: The rewrite reached both agents, and the marker line is the last line of the first message; no engine text follows it (evidence: run B, `end` records).

- Both agents' `answerTail` end with `PROBE-OK`: the Explore agent's ends `…README.md\`.\n\nPROBE-OK`, and the general-purpose agent's ends `…as separate commits.\nPROBE-OK`.
- The first message's `firstTail` ends, for the Explore agent, `…Search breadth: medium.\n\nEnd your reply with the word PROBE-OK.\n[subagent-router:routed v1]`.
- For the general-purpose agent it ends `…Do not modify any files.\n\nEnd your reply with the word PROBE-OK.\n[subagent-router:routed v1]`.
- In both, the text before the note is the parent's own prompt text, including the extra stay-in-the-directory sentence.
- **Why B was fast:** it took about 10 seconds because the Sonnet parent and its two Sonnet agents finished quickly. The Explore agent ended about 3.5 seconds after it started. Both agents ran to an answer, and the session's output relays both results, so B does answer Q2.

Q3: Both variables are readable: `session.sub` is `sonnet`, and `session.force` reads back exactly as set (evidence: runs C2 to C6, `session` records). A model set by the hook wins over an unforced `CLAUDE_CODE_SUBAGENT_MODEL`. `FORCE=1` and `FORCE=true` force the variable's model over the hook; `0` and `false` do not (evidence: runs C1 to C6, `started` and `end` records).

| Run | Variables | Parent | Explore started on | general-purpose started on |
|---|---|---|---|---|
| C1 | `PROBE_MODEL=haiku` | claude-opus-5-5 | claude-haiku-5-5 | claude-opus-5-5 |
| C2 | C1's, plus `SUBAGENT_MODEL=sonnet` | claude-opus-5-5 | claude-haiku-5-5 | claude-sonnet-5-5 |
| C3 | C2's, plus `FORCE=1` | claude-opus-5-5 | claude-sonnet-5-5 | claude-sonnet-5-5 |
| C4 | C2's, plus `FORCE=true` | claude-opus-5-5 | claude-sonnet-5-5 | claude-sonnet-5-5 |
| C5 | C2's, plus `FORCE=0` | claude-opus-5-5 | claude-haiku-5-5 | claude-sonnet-5-5 |
| C6 | C2's, plus `FORCE=false` | claude-opus-5-5 | claude-haiku-5-5 | claude-sonnet-5-5 |

In every C run, each agent's `end.usage.model` matches its `started.result.model`. Where a forced model overrode the hook (C3 and C4), the hook's own `next(e)` result already named the forced model, `claude-sonnet-5-5`.

Q4: The two spawns of one prompt were never concurrent. In every run, the first agent's `started` came before the second agent's `spawn`, between 0.9 and 3.4 seconds earlier. Each `started` came before that agent's `end` (evidence: runs A, B, C1 to C6, F1, file-name timestamps).

- **Run A timeline:**
  - 1795105305195 Explore `spawn`, 1795105305348 its `started`;
  - 1795105308712 general-purpose `spawn`, 1795105308733 its `started`;
  - 1795105314571 general-purpose `end`, 1795105340502 Explore `end`.
- **Other runs:** the gap from the first `started` to the second `spawn` was 912 ms (B), 1420 (C1), 1640 (C2), 1585 (C3), 1787 (C4), 2428 (C5), 1743 (C6) and 987 (F1).
- **Timestamp ties:** no two files involved in these orderings share a millisecond.
- **What the probe cannot say:** whether the engine runs the two Agent calls one after the other, or whether the model issued them in separate steps despite the prompt.

Q5: Two parts.

- **Key form:** PENDING (user). It needs the Run E user-level step, `mode` set to `route` in `/config` and then one session. The restricted runs ignore the user settings file, so their `user` fields are empty.
- **Project value:** it did not reach the plugin (evidence: run E-project, `session` record). With a project `.claude/settings.json` holding `pluginConfigs` entries for both `subagent-router` and `subagent-router@inline`, `options` still read `{ mode: 'observe', locatingRoute: 'haiku', readingRoute: 'parent' }`. In that run the user source held two `pluginConfigs` keys, neither of them this plugin's, and the policy source held none. The probe reads only the user and policy sources, so it does not show whether `settings.read` would return the project entry.
- **Local value:** not tested, because E-local did not run.

Q6: Not observed. The two spawns of a run never overlapped (Q4), so no write by the other hook could land while a hook waited in `next` (evidence: all `q6` records).

- In every run the second spawn's `seenBefore` was the first spawn's `tool_use_id`. So a value one spawn's hook writes is visible to a later spawn's hook in the same session.
- Every `seen` was the record's own `mine`.
- Under the test kit, by contrast, a hook's read after `next` does not see a write made meanwhile by an overlapping dispatch (see the note after K2).

Q7: `parentModel` and `sessionModel` are full model ids, always equal to each other, each carrying a family word (evidence: all `spawn` records). The values seen were `claude-fable-5-2` (run A), `claude-sonnet-5-5` and `claude-opus-5-5`. `started.result.model` is also a full id, for example `claude-haiku-5-5`. Caveat: run A's parent is the account default.

Q8: Partly answered (evidence: runs F1 and F2, `spawn`, `started`, `end` and `session` records).

- **Did the session resume?** Yes: F2 resumed F1's main session by its session id (`--resume`).
- **Was the agent continued?** Yes. The main session continued F1's Explore agent: F2's `spawn` carries `resume.agentId` equal to F1's Explore agent id, and `started` returned the same `agentId`.
- **The resumed spawn's fields:** it arrived with `model` already set to `claude-sonnet-5-5` and `resume` among its keys.
- **Model:** the continued agent's `end.usage.model` was `claude-sonnet-5-5`.
- **Cache:** the resumed turn reported 2296 cache-write tokens (`cache_creation_input_tokens`) and 26475 cache-read tokens.
- **First message:** still readable, with 8 rows; the first row is the same prompt F1's agent had.
- **State:** `stateCanary` was null in F2's `session` record, so state did not survive. It was null in all 14 sessions, so each `claude -p` process starts with empty state.
- **Still open:** PENDING (user) whether a resumed agent returns to the parent's model. In F1 the agent's model and the parent's model were the same (`claude-sonnet-5-5`), so this was not exercised. It needs F1 rerun with `SUBAGENT_ROUTER_PROBE_MODEL=haiku` (Explore on Haiku under a Sonnet parent), followed by F2.

Q9: PENDING (user). It needs `/context` run inside a Haiku subagent under a 1M-context parent. A hook cannot observe it.

Q10: PENDING (user), only if some model is blocked for the account. Otherwise it is not testable here: in every run, every model the hook asked for started.

Q11: The nested spawn's `parentAgentId` is set, to the general-purpose agent's `agentId` (evidence: run D, `spawn`, `started` and `parent-messages` records).

- **`parentModel`:** `claude-sonnet-5-5`. The parent agent and the main session both ran on Sonnet, so this run cannot show which of the two `parentModel` names.
- **`parent-messages`:** returned rows, not `{ deny }`: `{ rows: 2, firstTail: <the parent agent's prompt> }`.

Q12: PENDING (user). It needs Run G: change `mode` in `/config`, then type `/subagent-router-probe`, then run another session. The `config` record and that next session's `user` field answer it.

Q13: In a real session, a spawn raised by a plugin's `$.agent.spawn` reaches other plugins' hooks as a full `AgentSpawnInput`, not in the reduced shape the test kit gives (evidence: runs Q13a and Q13b, `observed-spawn` and `self-spawn` records).

- **Keys:** `background, cwd, description, fork, model, name, parentModel, permissionMode, prompt, provider, subagentType, tool_use_id`. These are the same keys an Agent tool spawn carries.
- **Field values:** `provider` is `{ plugin: 'engine', tier: 'core' }`, which names the definer of the Explore agent type, not the plugin that raised the spawn. `parentModel` is `claude-sonnet-5-5`, `subagentType` is `Explore` (no `subagent_type`) and `fork` is false. `tool_use_id` is a synthetic `toolu_plugin_<32 hex>`.
- **`next.origin`:** `{ plugin: 'subagent-router', tier: 'user' }`.
- **Caller's result:** it carried an `agentId` (`{ model: 'claude-sonnet-5-5', agentId: … }`), and that agent ran to an `end` of `OK`.
- **Load order:** the observer saw the spawn with both orders of the two `--plugin-dir` flags.
- **Own hook:** the probe's own `agent.spawn` hook did not see its own spawn in either order. Neither run has a probe `spawn` or `started` record.

## Test kit (K1 to K12)

K1: Yes, for the probe build. Task 6 replaced that build with the router and removed the K1 tests from `kit.test.ts`; the bullets below record what they showed.

- **Pass-through:** with stand-ins for `fs.write`, `process.hookEnv`, `session.model` and `env.get` (`mock.env`), plus `session.messages` for a nested spawn, the probe's `agent.spawn` hook passes the spawn on deep-equal to the input. It records `spawn` (including its `keys`), `started` and `q6`.
- **Self-spawn:** with `SUBAGENT_ROUTER_PROBE_SELFSPAWN=1`, the probe raises at most one self-spawn per load. Its own spawn hook does not see that spawn, and the `self-spawn` record holds the caller's result, which under the kit is `{ model: 'inherit' }`.
- **Paths:** `fs.write`'s path reaches the stand-in resolved against the plugin's folder.

K2: (a) yes, (b) yes.

- **Writes:** a test `state.set` hook that calls `next(e)` sees each write as `{ plugin, key, value, previous }`.
- **Reads:** the plugin reads its own write back later in the same hook and in a later event.
- **Unset value:** reads `{ version: 0 }`.
- **Versions:** counted per key, but a key's first write in a test lands one past the highest version any earlier test in the file reached. Compare versions only within one test.
- **Note on Q6:** under the kit, one spawn's hook reads a write an earlier spawn's hook made. But a hook reading after `await next(e)` does not see a write that an overlapping spawn's hook made while it waited: it still reads its own value.

K3: Yes. The matcher form `on('state.get', { plugin, key }, …)` is accepted. It answers that key, and every other key goes on to the kit's own state.

K4: Yes. Stand-ins answer `model.complete`, `settings.read`, `session.model` and `session.messages` with `{ value }`. `mock.env` answers `$.env.get`, giving `undefined` for a name it does not list. `mock.clock` answers `$.clock.now`.

K5: Yes, but the test does not fail. An unanswered `$` call rejects with `HooksError: no implementation for <event>`, and a hook that lets that rejection escape is skipped. Working form: list every stand-in a test needs, because a missing one shows up only as the hook's effect being absent.

K6: Yes. A file in `hooks/` imports a sibling with no extension. This holds both from a test file and from the hooks module itself; the latter was checked with an experiment that was not committed.

K7: The event's shape is a "no"; `next.origin` is a "yes". Under the kit, an inline plugin's `$.agent.spawn` arrives in the Agent tool's shape, `{ tool: 'Agent', prompt, description, run_in_background: true, subagent_type?, model? }`, with no `provider`, `parentModel`, `fork` or `tool_use_id`. `next.origin` is `{ plugin: 'other', tier: 'user' }` both at the test's hook and in the plugin under test (since Task 6, `kit.test.ts` pins it at the test's hook only; the check in the plugin under test went with the probe build). The caller's call resolves to `{ model: <its model or 'inherit'> }`, with no `agentId`. Working form: tests must not expect `AgentSpawnInput` fields on a plugin-raised spawn, and should key on `next.origin`. A real session delivers the full input (Q13).

K8: It starts fresh. Module memory does not carry over between tests of one file, so no reset export is needed.

K9: No. A stand-in that throws is skipped, and the call then rejects as unanswered (`no implementation for <event>`), not with the thrown error. The test does not fail by itself. Working form: to feed a specific failure, answer with the event's own refusal, for example `{ value: { deny } }` for `session.messages`.

K10: Yes. `ui.log` lines made before and after `next` have reached the stand-in by the time the awaited `$.agent.spawn` resolves.

K11: Partly. An inline plugin's `$.config.set` does reach the plugin under test's `config.set` hook (shown by the probe build; since Task 6, `kit.test.ts` pins the event and `next.origin` at the test's hook only). But under the kit the event is only `{ key, value }`, with no `origin`; the caller is in `next.origin`. Working form: read the caller from `next.origin`, or raise `config.set` on the engine's `$` with a full `ConfigSetInput`.

K12: Yes. A hook that returns the `{ deny }` its own `next(e)` answered is accepted, and the spawn resolves to it. A deny the hook makes up itself after `next` answered fails the hook, and its `.catch` is asked.

## Consequences

| Answer | Consequence |
|---|---|
| Q1 unreadable, or Q7 gives an id with no family word | Does not apply. Every model is readable as a full id with a family word. Model families include `fable` as well as `opus`, `sonnet` and `haiku`. |
| Q2: the rewrite did not reach the agent | Does not apply: it reached both agent types. |
| Q2: engine text follows the prompt in the first message | Does not apply: the marker is the last line. Task 6 keeps the "last line" rule. |
| Q3: variables unreadable | Does not apply: both are readable. |
| Q3: a hook-set model loses to an unforced `CLAUDE_CODE_SUBAGENT_MODEL` | Does not apply: the hook wins. A forced variable (`FORCE=1` or `true`) outranks the hook, and `next(e)`'s result names the forced model. |
| Q4: `end` can precede `started` | Does not apply: `started` always came first. The spawns were also sequential rather than concurrent. |
| Q5 | Pending: the user-level key form is not yet known, and the stop ("no entry under any key") is pending with it. A project-level `pluginConfigs` entry did not reach the plugin's `options`. |
| Q6 | Recorded only: no overlap was observed in a session. |
| Q8: state does not survive a resume | Applies, as expected: `stateCanary` was null after the resume, and in every session. The marker check in Task 6 covers it. |
| Q8: the resumed agent returned to the parent's model | Pending: not exercised, because the agent and the parent shared a model. |
| Q9, Q10 | Pending (user). |
| Q11: `{ deny }` for an ordinary nested spawn | Does not apply: rows were returned. |
| Q12: the command is gone after a reload | Pending (user, Run G). |
| Q12: a `/config` change does not land in the user source | Pending (user, Run G). It is a stop if it holds. |
| K1 to K12 | Neither K2(a) nor K4 failed. K7, K9 and K11 change how Tasks 5 to 7 supply inputs, as their working forms say. |
| Q13 (added) | In a session, a plugin-raised spawn looks like an engine spawn in every field: full keys, a `provider` naming the agent's definer, a `parentModel`. Only `next.origin` (and the synthetic `toolu_plugin_` id) tells it apart. So Task 6's "another plugin's spawn is passed on untouched" guard must test `next.origin.plugin !== 'engine'`, and never a missing field or `provider`. Its test must raise the spawn from an inline plugin and assert on `next.origin`, because the kit's reduced shape (K7) differs from a session's. A plugin's own `$.agent.spawn` never reaches its own `agent.spawn` hook, so the router cannot route or record spawns it raises itself. |
| Q1, Explore under a Fable parent (added) | The Explore agent does not always inherit the parent's model: under `claude-fable-5-2` it started on `claude-opus-5-5`. The router must take the baseline from `next(e)`'s result or from the agent type, not assume `parentModel`. |
| Spawn keys (added) | `model`, `cwd` and `name` are present as keys even when unset, so an `'x' in e` check is always true. The router must test for `undefined`. |
| Resume (added) | A resumed spawn arrives with `model` already set to the agent's earlier model, and its content keys are fixed. The router must leave a spawn with `resume` alone. |
| `--plugin-dir` identity (added) | A plugin loaded with `--plugin-dir` has the data folder `<name>-inline`, which suggests the id `<name>@inline`; unconfirmed until Q5's user-level step. Task 5's settings reader already looks for `subagent-router` and any `subagent-router@…` key, which covers both. |
| Q11, which model `parentModel` names (added) | Pending. In run D the parent agent and the main session were both on Sonnet. Task 6's check for an unrecognised spawner compares `parentModel` with the main session's model, which only works if `parentModel` is the spawning agent's model. It needs a nested spawn whose parent agent runs on a different model from the main session. Q11 also decides the baseline key for a nested spawn, which is `<agent type>|<parentModel>`: if `parentModel` names the session's model, a spawn under an agent on a cheaper model would be compared with the session's baseline and could be moved to a model dearer than the one it would have inherited. Until Q11 is answered, the final review's fix wave leaves every nested spawn unrouted (`NESTED_UNVERIFIED` in `hooks/spawn.ts`): it is recorded with the reason `nested-unverified`, teaches no baseline, and in `observe` mode is still asked about so its kind is recorded. |

## Not yet run

- Run E at user level (`mode` set to `route` in `/config`, one session, then set back), for Q5's key form.
- E-local: refused, because a local settings file already existed in the worktree.
- Run G (a `/config` change, then `/subagent-router-probe`), for Q12.
- Q8's model question: F1 with `SUBAGENT_ROUTER_PROBE_MODEL=haiku`, then F2.
- Q11's `parentModel` question: prompt D under an Opus main session with `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`, so the general-purpose parent runs on Sonnet and the main session on Opus.
- Q9 (`/context` inside a Haiku subagent under a 1M-context parent).
- Q10, only if some model is blocked for the account.
