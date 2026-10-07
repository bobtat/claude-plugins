# cost-ledger probe

A throwaway mod that measures how `$.model.fork` behaves as a prompt-cache keep-alive,
before cost-ledger's keep-alive is built on it. It logs every request's token counts,
Claude Code's running cost and the rate-limit readings, and forks the transcript on demand
or on a timer while the session is idle.

It lives outside `plugins/` so it is never published, and nothing in the marketplace
lists it.

## What it has to settle

1. Does a fork sent while the session is idle read the session's cache (`cache_read`
   close to the context size)?
2. With pings, is the next real turn after a gap longer than the cache lifetime still a
   cache read rather than a re-write?
3. Is a fork's cost included in Claude Code's running total (`$.session.usage().cost`)?
   If it is, cost-ledger must not add it a second time.
4. How many output tokens does each ping cost? `fork` takes no `max_tokens`, and the
   session's thinking setting applies.
5. On a subscription, how much does a ping move the 5-hour and 7-day limit percentages?

## Running it

Load it next to cost-ledger for one session:

```
claude --plugin-dir tests/cost-ledger-probe
```

Every record goes to `~/claude-costs/probe-<date>-<session>.jsonl` (`%USERPROFILE%` on
Windows) as it happens. A reload or restart of the same session keeps adding to the same
file. Timers still pending are lost on a reload.

| Command | Does |
|---|---|
| `/probe ping` | Forks now |
| `/probe schedule 4 8 12` | Forks at those minutes after the last turn ended |
| `/probe burst 20 30` | 20 forks, each started 30 s after the previous one returned |
| `/probe mark <text>` | Writes a label into the log, such as `control start` |
| `/probe report` | Summarises forks, the first request of each turn, rate limits and cache lifetime |

A prompt you send cancels any pings still pending, and a ping is skipped (and logged as
skipped) while a turn is running.

## The experiments

Before each one, build a context of at least 50k tokens, for example by asking Claude to
read a few large files, so a hit and a miss differ by a clear margin. Use `/probe mark`
before each run so the log is easy to split afterwards. Don't run other Claude sessions
during experiment 5.

| # | Steps | Read in the report |
|---|---|---|
| 1, 4 | End a turn, wait 2 min, `/probe ping`. Repeat at your usual effort and at a lower one | Fork `read` close to `ctx` (above 90%); fork `output` |
| 2 | **Test:** end a turn, `/probe schedule 4 8 12`, send a one-word prompt 15 min after the turn ended. **Control:** the same with no schedule | First request of the follow-up turn: the test shows a large `read`, the control a large `write` |
| 3 | `/probe ping` with no turn in between | Fork `Δcost` against its tokens priced at list rates: about equal means Claude Code counts the fork; zero means cost-ledger has to |
| 5 | `/probe report` to note the limits, `/probe burst 20 30`, then a one-word prompt and `/probe report` again. Then the same wait and prompt without the burst | The difference between the two moves, divided by 20 |

For experiment 2, check the reported cache lifetime first. If it is `1h`, use
`/probe schedule 55 110` with the prompt at 115 minutes; the 15-minute version proves
nothing on a one-hour cache.

The rate-limit percentages come with one decimal place and are only what the last
response reported. That is why experiment 5 uses a burst and takes its readings after a
real prompt.

Bring the JSONL file back when you're done. It holds everything the report leaves out.

## Development

```
claude plugin validate tests/cost-ledger-probe
claude plugin test tests/cost-ledger-probe
```
