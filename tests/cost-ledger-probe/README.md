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

## Results

### 2026-10-10: personal Pro account, Opus 5.5, ~67k-token context

| # | Result |
|---|---|
| 1 | **Yes.** A fork 2.8 min after a turn read 61,084 of 66,067 tokens from the cache (92%) and wrote 4,981: the tail since the last cached point. Read, write and input add up to the whole context plus the ping prompt. |
| 2 | **Not settled.** The pings themselves behaved: `+4m` read 99% and wrote 790 tokens, `+8m` and `+12m` read 100% and wrote 0. But the cache stayed warm without pings too: the first requests after idle gaps of 7.4, 18.3 and 15.2 minutes with no ping in between (the last one the control) all read the whole context. The likeliest cause is that this account uses the one-hour cache. Claude Code never reported the lifetime, so that is inferred, not read. |
| 3 | **Yes, Claude Code counts it.** Each fork's `Δcost` equals its tokens at list price to the cent: the first fork $0.0374 = 61,084 read × $0.20/M + 4,981 written × $5/M + 49 input × $4/M + 4 output × $20/M. Writes were priced at the five-minute rate even though the cache outlived five minutes. |
| 4 | **4 output tokens per ping**, about $0.0001: no noticeable thinking. A ping that writes nothing cost $0.0137 at this context size. |
| 5 | **Not measured.** The 5-hour reading went from 3% to 6% over the whole session, real turns included. |

Still to run:

- **Confirm the one-hour expiry.** Leave a session idle for more than an hour, then send a prompt: its first request should show a large `write`.
- **Confirm a ping just under the hour keeps it warm.** After a turn, `/probe schedule 55`, then send a prompt at about 70 minutes: its first request should show a large `read`.
- **Experiment 5** on the Pro account.

### What this changes for cost-ledger's keep-alive

- **The ping interval comes from the cache lifetime, not a fixed ~4.5 minutes.** On a one-hour cache that means one ping about every 55 minutes, about $0.014 each at 67k tokens, against a cold re-cache of 67k × $8/M ≈ $0.54 at the one-hour write rate. That is about 40 hours of pings before they cost more than one re-cache, so the limit that matters is the maximum idle time, not break-even.
- **cost-ledger should learn the lifetime from what it observes.** With `cacheTtl` on `auto` and nothing reported, it assumes five minutes. That shows "cache cold" and the re-cache warning too early, and prices writes too low, on an account like this one. A request after more than five idle minutes that still reads nearly all of the context shows the cache lasts at least that long.
- **Keep-alive cost goes into the category breakdown only.** Claude Code's running total already includes forks, and cost-ledger's totals come from it, so adding forks to the totals would count them twice. Forks don't pass through `turn.step`, so the breakdown must record their usage itself.
- **Only the first ping after a turn writes anything.** It writes the tail; later pings are pure cache reads.

## Development

```
claude plugin validate tests/cost-ledger-probe
claude plugin test tests/cost-ledger-probe
```
