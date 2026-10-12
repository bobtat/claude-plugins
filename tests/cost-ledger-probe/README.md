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
| `/probe prompt 110 [text]` | Sends a prompt (default `ok`) at that minute after the last turn ended, as if you typed it, so a long run needs no one at the keyboard |
| `/probe burst 20 30` | 20 forks, each started 30 s after the previous one returned |
| `/probe mark <text>` | Writes a label into the log, such as `control start` |
| `/probe report` | Summarises forks, the first request of each turn, each turn's cost against its tokens at both cache write rates, spend no logged request explains, rate limits and cache lifetime |

A prompt you send cancels any pings and any scheduled prompt still pending, and a ping is skipped (and logged as
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
| 5 | With Claude not in use anywhere else on the account, `/probe ping` for a fresh reading, then `/probe burst 10 30`; if the 5-hour reading moved 1% or less, `/probe burst 30 30` | Spend between the steps of the 5-hour reading, set against the pings' cost. A fork's response carries the reading, so no prompt is needed between bursts |

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
| 2 | **Not settled.** The pings themselves behaved: `+4m` read 99% and wrote 790 tokens, `+8m` and `+12m` read 100% and wrote 0. But the cache stayed warm without pings too: the first requests after idle gaps of 7.4, 18.3 and 15.2 minutes with no ping in between (the last one the control) all read the whole context. The likeliest cause is that this account uses the one-hour cache. Claude Code never reported the lifetime directly, but its own pricing of the turns agrees (below). The 2026-10-11 run settles it. |
| 3 | **Yes, Claude Code counts it.** Each fork's `Δcost` equals its tokens at list price to the cent: the first fork $0.0374 = 61,084 read × $0.20/M + 4,981 written × $5/M + 49 input × $4/M + 4 output × $20/M. A fork's own writes are priced at the five-minute rate; the main thread's turns at the one-hour rate (below). |
| 4 | **4 output tokens per ping**, about $0.0001: no noticeable thinking. A ping that writes nothing cost $0.0137 at this context size. |
| 5 | **Not measured.** The readings around each fork stayed the same and moved only at real turns. That does not mean forks never update them: in the 2026-10-11 run a fork's response carried a reading that had moved (below). The 5-hour reading went from 3% to 7% over the whole session, about $0.65 of API-equivalent spend, real turns included. Measured on 2026-10-12 (below). |

#### From the JSONL

Claude Code's running total against each interval's tokens at list price:

| Interval | Total moved | Writes at $5/M | Writes at $8/M |
|---|---|---|---|
| First turn, two requests | $0.38143 | $0.2834 | **$0.3811** |
| 11:50 turn, one request | $0.07121 | $0.0550 | **$0.07121** |
| Each of the four forks | as logged | **matches** | too high |

So Claude Code charges the main thread's cache writes at the one-hour rate and a fork's at the five-minute rate. A fork's read still renews the main thread's one-hour entries: the caching docs say a read renews an entry's timer on either lifetime.

Some spend passed through no hook the probe logs:

| Window | Total moved | Logged requests priced | Left over |
|---|---|---|---|
| 12:02 → 12:21, 18 min idle | $0.0509 | $0.0292 | $0.0217 |
| 12:21 → 12:36, 15 min idle | $0.0357 | $0.0146 | $0.0211 |
| 11:44 → 11:50, 7 min idle | $0.0712 | $0.0712 | none |
| After the last turn | $0.0331 | none | $0.0331 |

About $0.021 is what one cache read of the 67k context plus a few hundred output tokens costs. That looks like Claude Code making a background request of its own after a long idle gap. If such a request reads the transcript, it renews the cache too. The report now lists this spend with its window, so the next runs show when it happens. The 2026-10-11 run had none in 110 minutes, so what it was is still unknown.

### 2026-10-11: personal Pro account, Opus 5.5, ~64k-token context

One turn, then `/probe schedule 55` and `/probe prompt 110`, and the session left alone.

| After the turn ended | Event | Read | Write | Total moved |
|---|---|---|---|---|
| 0 | Context-building turn | 29,130 | 33,009 | $0.29908 |
| 55.0 min | `+55m` ping | 62,139 of 63,587 (98%) | 1,446 | $0.01993 |
| 110.0 min, 55.0 after the ping | Scheduled `ok` | 62,139 | 8,667 | $0.08424 |

- **The cache lasted at least 55 minutes,** and the ping renewed it: the prompt at 110 minutes read the same 62,139 tokens again. The expiry control below confirms the cache would otherwise have expired.
- **The write rates match exactly again.** The first turn comes to $0.29883 with one-hour writes and $0.1998 with five-minute writes. The `ok` turn comes to $0.08424 with one-hour writes, exactly. The ping comes to $0.01993 with five-minute writes, exactly.
- **The ping wrote only the tail.** Its 1,446 written tokens equal the first turn's 1,446 output tokens. That write is priced, and so presumably kept, at the five-minute rate, so it had expired by the `ok` 55 minutes later, which wrote it again. The other ~7,100 tokens came with the prompt itself: `/probe prompt` adds that much context where a typed `ok` added about 120 (below). What they contain is not in the log.
- **No spend went unexplained.** Each known total equals the next across the whole 110 minutes.
- **Saving:** without the ping, the `ok` would have re-written about 62k tokens at $8/M, roughly $0.50, against $0.0199 for the ping.
- **A fork can carry a moved rate-limit reading.** The ping's response came with the 5-hour reading at 62% (55% before) and the 7-day at 13% (12% before). A $0.02 request cannot account for 7 points when $0.65 moved the reading 4 points in the first run, so this is almost certainly other use on the account in those 55 minutes. The readings cover the whole account, so experiment 5 has to run while Claude is not in use anywhere else on it.

#### The expiry control, same session

After 438 minutes (7.3 hours) with nothing sent, a typed `ok`:

| Read | Write | Context | Total moved | Writes at $8/M | Writes at $5/M |
|---|---|---|---|---|---|
| 29,130 | 41,919 | 71,051 | $0.341986 | **$0.341986** | $0.2162 |

- **The cache had expired.** The gap is far past an hour, so on its own it shows only that entries expire within 7.3 hours. But the API offers two lifetimes, five minutes and one hour, the 18-minute hits of the first run rule out five minutes, and Claude Code prices every turn at the one-hour rate. So the lifetime is one hour, and without the `+55m` ping the 110-minute prompt would have found the cache cold.
- **The shared opening stayed warm.** The cold request still read 29,130 tokens, exactly what this session's very first request read before it had written anything (the first run's first request read 28,468). The opening of the prompt, mostly the system prompt and tool definitions by its size, is cached on its own; something else must have used it within the hour, most likely another Claude Code session. Only the conversation, 41,919 tokens, was written again. A cold resume therefore cost (context − shared opening) × write rate: $0.335, where the whole context × $8/M would say $0.568, about 70% too high.
- **No spend went unexplained** in 7.3 hours idle, so the first run's ~$0.02 charges are not something Claude Code does whenever a session sits idle.
- **A typed prompt added about 120 tokens** of context (71,051 against 70,810 + 123 output before it), where the `/probe prompt` one added about 7,100.

### 2026-10-12: experiment 5, personal Pro account, Opus 5.5, ~62k-token context

One context-building turn, `/probe ping`, `/probe burst 10 30`, then `/probe burst 30 30`: 41 pings, with Claude not in use anywhere else on the account.

| Point | Total moved to (API-equivalent) | 5-hour | 7-day |
|---|---|---|---|
| Session start | $0.0000 | 3% | 21% |
| After the context turn | $0.2447 | 3% | 21% |
| After the first ping | $0.2624 | 4% | 21% |
| After the 10-ping burst | $0.3885 | 4% | 21% |
| After ping 12 of the 30 | $0.5399 | 4% | 21% |
| After ping 13 of the 30 | $0.5526 | 5% | 21% |
| After all 41 pings | $0.7671 | 5% | 21% |

- **Each pure-read ping cost exactly $0.0126176**: 61,708 read × $0.20/M + 49 input × $4/M + 4 output × $20/M. The first wrote the 1,053-token tail as well, $0.0177.
- **About 23 pings per 1% of the 5-hour window.** The step from 4% to 5% took between $0.2775 and $0.3079 of spend, all of it pings, so roughly 22–24 pings: **about 0.045% of the 5-hour window per ping** at 62k tokens. The 7-day reading did not move.
- **Cache reads are not counted like full input.** If they were, a ping would weigh like 61.7k × $4/M ≈ $0.25, and 41 pings would have used something like 35% of the window rather than about 2%. The run fits limits weighted by API-equivalent price, at about $0.29 of spend per 1% of this account's 5-hour window. The first run's rougher figure, about $0.16 per 1%, came from whole-number readings over a session that may have included other use.
- **Forks do carry fresh readings.** Every step in the table came with a fork's response; `resetsAt` stayed at 16:50 UTC throughout.

For keep-alive on this account: hourly pings across a three-hour idle stretch cost about 0.13% of the 5-hour window, against about 1% for one cold re-cache of a conversation this size (33–42k tokens at the one-hour write rate, $0.27–0.34).

Nothing is left to run for the keep-alive.

### What this changes for cost-ledger's keep-alive

- **The ping interval comes from the cache lifetime, not a fixed ~4.5 minutes.** On a one-hour cache that means one ping about every 55 minutes, about $0.014–0.02 each at 62–67k tokens, against a cold re-cache of 67k × $8/M ≈ $0.54 at the one-hour write rate. That is about 40 hours of pings before they cost more than one re-cache, so the limit that matters is the maximum idle time, not break-even.
- **cost-ledger should learn the lifetime from what it observes.** With `cacheTtl` on `auto` and nothing reported, it assumes five minutes. That shows "cache cold" and the re-cache warning too early, and prices writes too low, on an account like this one. The reliable signal is Claude Code's own pricing: price each request with five-minute and one-hour writes and see which matches the running total's change, as the probe's report now does.
- **Keep-alive cost goes into the category breakdown only.** Claude Code's running total already includes forks, and cost-ledger's totals come from it, so adding forks to the totals would count them twice. Forks don't pass through `turn.step`, so the breakdown must record their usage itself.
- **A ping only has to protect the conversation, not the shared opening** while something else keeps that opening warm. In the expiry run that is 41,919 tokens × ($8 − $0.20)/M ≈ $0.33 per re-cache avoided, so hourly pings at $0.014–0.02 cover 16–23 hours.
- **The cold-resume estimate should subtract the shared opening,** learned from a session's first request, and still show the whole context as the worst case, since the opening stays warm only if something else used it within the hour.
- **On a subscription, pings are cheap against the limits.** About 0.045% of the 5-hour window each at 62k tokens on Pro, so `keepAlive` can stay off by default as an opt-in for something that spends while the person is away, without the limits being the reason.
- **Only the first ping after a turn writes anything.** It writes the tail; later pings are pure cache reads. That tail is written at the five-minute rate, so on a one-hour cache it has expired by the next ping or prompt and is written again: about $0.01 an hour at this size, not worth working around.

## Development

```
claude plugin validate tests/cost-ledger-probe
claude plugin test tests/cost-ledger-probe
```
