# subagent-tree

A Claude Code mod that shows the session's subagents as a live tree in a pane. Like
`cost-ledger` it is code: a TypeScript hooks module that Claude Code loads and runs in the
session.

## Installation

```
/plugin marketplace add bobtat/claude-plugins
/plugin install subagent-tree@bobtat-plugins
```

## Using it

Type `/agents-tree`. The pane lists every subagent the session has started, children under
the agent that spawned them:

```
● Explore: scan the repo
    running · 1m05s · 3 tools · 2 steps · on Grep · 1k out
  ✓ general-purpose: read the config
      completed · 12s · 4 tools · 3 steps · 2k out
2 agents · 1 running · 3k tokens out
```

| Mark | Status |
|---|---|
| `●` | running |
| `◐` | waiting |
| `·` | pending |
| `○` | idle (a teammate waiting for a message) |
| `✓` | completed |
| `✗` | failed or killed |

While the pane is open and an agent is running, it redraws once a second so the elapsed times
keep moving, and once more when the last one finishes. A closed pane costs nothing: the timer
is stopped and the agent list is not polled. After a hot reload the timer restarts when the
pane next draws.

The list is drawn whole and the pane scrolls it; long lines are cut to the pane's width.

## Where the numbers come from

- **Which agents exist, their status and parent** come from the engine's agent list
  (`$.agent.list()`), so subagents started by other plugins and teammates appear too.
- **Tool calls, steps and the current tool** are counted by the mod from each agent's own
  `tool.call` and `turn.step` events, so they cover only what happened while the mod was
  loaded.
- **Time** is the agent's active time: its finished runs plus the run in progress. A
  teammate's idle gaps between runs are left out, and an agent that was killed or failed stops
  at its last event.
- **Output tokens** are summed from the usage on each finished turn of the agent, so a running
  agent's figure appears when its turn ends. The footer total counts only the agents the tree
  shows; the engine's own forks (compaction, memory) and workflow agents are not in the list
  and are left out. The pane shows output tokens only; it does not price anything
  (`cost-ledger` does that).
- Stats for ids the list does not show are dropped after ten minutes, and past 200 entries.

Nothing is blocked or rewritten: every hook passes the event on unchanged.
