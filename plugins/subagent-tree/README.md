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

Type `/agents-tree` (or `/agents-tree open`) to open the pane and `/agents-tree close` to close
it; any other argument replies with the usage. If a hook refuses the close, the reply says the
tree stays open. The pane lists every subagent the session has started, children under the
agent that spawned them:

```
● Explore: scan the repo
    running · 1m05s · 3 tools · 2 steps · on Grep · 1k out
  ✓ general-purpose: read the config
      completed · 12s · 4 tools · 3 steps · 2k out
2 agents · 1 active · 3k tokens out
```

| Mark | Status |
|---|---|
| `●` | running |
| `◐` | waiting |
| `·` | pending |
| `○` | idle (a teammate waiting for a message) |
| `✓` | completed |
| `✗` | failed or killed |

While the pane is drawn it redraws once a second as long as an agent is pending, running or
waiting, so the elapsed times keep moving, and once more when the last one finishes. With
nothing running it redraws every fifth second, so a status that changed with no event of the
mod's own (a pending agent starting, a teammate in a terminal pane of its own) still shows
within five seconds. Each second the mod also asks the engine for the agent list. When the pane
has not been drawn for about twelve seconds (it was closed, or it was dropped without the mod
being told) the timer stops, and the pane's next draw starts it again. After a hot reload the timer restarts when the pane next draws. If a
tick fails, the error goes to the debug log (`claude --debug`), the timer stops, and the next
draw starts it again.

The list is drawn whole and the pane scrolls it. Each line is set to truncate (`wrap="truncate"`)
at the pane's width; the mod's tests do not measure the truncation or the indent, which the
surface does.

## Where the numbers come from

- **Which agents exist, their status and parent** come from the engine's agent list
  (`$.agent.list()`), so subagents started by other plugins and teammates appear too.
- **Tool calls, steps and the current tool** are counted by the mod from each agent's own
  `tool.call` and `turn.step` events, so they cover only what happened while the mod was
  loaded. The current tool (`on Grep`) shows from its call until the agent's next model
  request starts, so it is not shown while the model is thinking. A tool call that is
  interrupted before its count is written may go uncounted.
- **Time** is the agent's active time: its finished runs plus the run in progress. A
  teammate's idle gaps between runs are left out, and an agent that was killed or failed stops
  at its last event.
- **Output tokens** are summed from the usage on each finished turn of the agent, so a running
  agent's figure appears when its turn ends. The footer total counts only the agents the tree
  shows; the engine's own forks (compaction, memory) and workflow agents are not in the list
  and are left out. The pane shows output tokens only; it does not price anything
  (`cost-ledger` does that).
- Stats for ids the list does not show are dropped once idle for ten minutes, and past 200
  entries unlisted ones go first. This runs when an agent's turn finishes and, while the pane is
  drawn, on the timer; it writes only when something is dropped. With the pane closed, stats of forks and workflow agents stay until the
  next agent turn finishes.
- **Active** in the footer counts pending, running and waiting agents.

Nothing is blocked or rewritten: every hook passes the event on unchanged.
