# cost-ledger

A Claude Code mod that keeps a running ledger of what Claude Code costs: this session, this
calendar week (Monday to Sunday) and this calendar month, in local time. It also makes
prompt-cache spend visible, since on long agentic sessions `cache_read` and `cache_write`
are usually most of the bill.

Unlike the other plugins in this marketplace, cost-ledger is code: a TypeScript hooks
module that Claude Code loads and runs inside the session, not skills or commands for
Claude to read.

## Installation

```
/plugin marketplace add bobtat/claude-plugins
/plugin install cost-ledger@bobtat-plugins
```

## What it shows

| Where | What |
|---|---|
| Status line and a band above the prompt | `$1.84 session · $23.10 week · $96.40 month · ctx 150k ≈$0.03/step · cache warm 3m` |
| `/costs` pane | Totals with budget progress, a heat-map calendar per month (shade by total spend or by cache writes, `p`/`n` to change month, `s` to switch shading), the month's prompt-cache breakdown, the subagent share, spend by project, and daily bars |
| `/costs export` | Writes `~/claude-costs/claude-costs-<date>.csv`: one row per day and project with the total, tokens and estimated cost per category, and subagent cost |
| Toasts | Before a prompt is sent once the cache has likely expired; before a model switch that drops a warm cache; after one request writes a large amount to the cache; at 80% and 100% of a budget |

All warnings are informational: nothing is ever blocked.

## Where the numbers come from

```
 session.measure ── cost.usd (Claude Code's running total) ──► spend per session and day
 turn.step ──────── usage per request (tokens, model) ───────► priced per category
                                                                  │
                    $.store: one entry per session, ◄─────────────┘
                    archived per project after 60 days, kept 400 days
                                   │
                                   ▼
                status line · band · /costs pane · CSV export
```

- **Totals** (session, week, month, calendar, budgets) are Claude Code's own figure, the one
  `/cost` shows. It is list price unless an administrator has set the managed `modelPricing`
  setting.
- **The category breakdown** (input, output, cache write, cache read) is estimated by the mod
  from each request's token counts, at Anthropic list prices or at the rates you give it.
  Token counts and the cache-hit percentage are exact; the dollars are estimates.
- Only sessions that ran with the mod enabled are counted. There is no backfill from older
  transcripts.

## Settings

Set in `/config` under `cost-ledger`.

| Setting | Default | Meaning |
|---|---|---|
| `billing` | `api` | `subscription` labels figures as API-equivalent and adds the 5-hour and 7-day rate-limit percentages |
| `statusLine`, `band` | on | Show the summary in the status line and in the band |
| `rates` | empty | JSON of USD per million tokens by model family, overriding list prices for some or all fields, for example `{"opus-5-5": {"input": 4, "output": 20, "cacheRead": 0.2, "cacheWrite5m": 5, "cacheWrite1h": 8}}`. A family matches any model id that contains it and does not continue with another version number, so Bedrock ids such as `us.anthropic.claude-opus-5-5-v1:0` resolve. A family with no list price needs `input`, `output` and `cacheRead` |
| `cacheTtl` | `auto` | Prompt-cache lifetime used for the countdown, the idle warning and write pricing. `auto` uses what Claude Code reports around a model switch or resume, otherwise 5 minutes. Set `1h` if you know your setup uses the one-hour cache |
| `largeWriteTokens` | 50000 | Toast when one request writes at least this many tokens to the cache; 0 turns it off |
| `contextNudgeTokens` | 150000 | Suggest `/compact` once the context reaches this size; 0 turns it off |
| `dailyBudget`, `weeklyBudget`, `monthlyBudget` | 0 | USD; toast at 80% and 100%; 0 turns each off |

Models with no list price in the bundled reference (Opus 4.5, Opus 4.1, Sonnet 4.5) are not
guessed at: their tokens are reported as unpriced in the pane until `rates` names them.

## Known limits

- Week and day boundaries use the local time of the process running Claude Code.
- The store is one JSON file shared by every Claude Code process on the machine. Two sessions
  writing at the same moment have not been tested for lost updates, and two sessions can
  both show the same budget toast.
- After an in-process `/resume`, the mod takes Claude Code's running cost at that moment as
  the new baseline. If Claude Code restores the resumed session's earlier cost only after
  that point, the earlier cost would be counted again. This has been reasoned from the API
  documentation and covered by tests, not yet observed in a live resume.
- Spend from a subagent that finishes after the session's last turn is recorded when the
  session ends; a process that is killed outright loses it.

## Development

The module is `hooks/register.tsx`; date and summary logic is in `hooks/ledger.ts` and
pricing in `hooks/pricing.ts`, both free of engine calls so they can be tested directly.

```
claude plugin validate plugins/cost-ledger
claude plugin test plugins/cost-ledger
```

`tsc -p plugins/cost-ledger` type-checks it once Claude Code has loaded the mod from the
folder (for example with `claude --plugin-dir plugins/cost-ledger`), which writes the API
declarations to `.claude-plugin/types/`. That folder is regenerated on every load and is not
committed.

## License

MIT
