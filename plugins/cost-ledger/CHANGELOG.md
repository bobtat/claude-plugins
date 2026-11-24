# Changelog

What changed in each version of cost-ledger, newest first.

The totals have always come from Claude Code's own running cost and are not affected by any
of the pricing fixes below. The category breakdown is different: it is priced as each
request is recorded and is not priced again when a later version corrects a rate or a rule.
Where a version leaves earlier figures standing with a known error, its entry says so under
**Figures recorded before this version**.

## 0.9.4 (2026-11-24)

### Fixed

- A store that refuses a write no longer stops the mod from doing the rest of its work. At
  its 4 MiB limit, or with its file locked, the store rejected what the mod keeps beside the
  ledger (a budget threshold announced, the cache lifetime and pricing learned, a model named
  as unpriced, a quoted price), and Claude Code then skipped the whole hook: the budget toast,
  the model-switch warning and the unpriced-model notice were not shown, and a request's
  record stopped part-way. Those writes may now fail. A notice the store cannot remember
  having given is given once for as long as Claude Code runs, not with every request.
- `/costs doctor` answers when the store takes no write, which was when it gave no answer at
  all. Its **Store file** line says the write was refused, a **Store size** line gives each
  store file's size against the limit, and the checks that only read go on.

### Changed

- A prompt is stored only when it can still be one of its month's ten most expensive, the
  only prompts the pane lists. Each session used to keep its own ten of each month, most of
  which could never be shown. A session's entry is smaller for it, and so is what each cost
  measurement reads. Entries stored before this version keep what they have until they are
  folded into their project's archive.

## 0.9.3 (2026-11-23)

### Fixed

- The store no longer fills up with sessions younger than the 60 days after which one is
  archived. A session's entry weighs about 8 kB, so some five hundred of them reach the
  store's 4 MiB limit, and a store at its limit refuses every write: nothing more was
  recorded, with one toast to say so. Sessions past the hundred most recently used, or past
  a mebibyte of entries together, are now folded into their project's archive once they have
  been idle a day and have nothing on the current day, up to a hundred at each start. The
  totals, the breakdown, the listed prompts and the export are as they were.
- A store that is already at its limit is given room without removing anything first. The
  prompts of the sessions about to be folded that are not among their project's ten most
  expensive of the month, which an archive does not keep either, are dropped before the fold,
  and the sessions then go into the archive as many at a time as there is room for.
- A token count from 999,500 to 999,999 reads `1.0M`, not `1000k`.

### Changed

- `/costs doctor`'s **Turns** line counts the sessions that still have an entry of their
  own. An archive does not keep a session's turn-by-turn record, so past a hundred sessions
  the line covers the most recently used of them.
- Old sessions of one project go into its archive in one write at a start, not one write a
  session.

### Development

- Three tests named a Windows home folder and failed on Linux. They now name one that every
  platform takes as an absolute path.

## 0.9.2 (2026-11-12)

### Fixed

- A turn's cache writes are priced again as the turn ends when its total shows they were
  charged at the other cache lifetime than the one assumed while it ran. A session's first
  turn could only assume a lifetime, and the writes it recorded stayed at that assumption
  even after the turn's total had settled the matter.

### Figures recorded before this version

- A session's first turn can stand at the five-minute write rate where it was charged the
  one-hour rate, which leaves those writes 37.5% low.

## 0.9.1 (2026-11-12)

### Fixed

- Each session keeps the cache lifetime its own requests showed. It was one value for the
  whole machine, so an interactive session and a headless one (`claude -p`, the SDK), which
  Claude Code can put on different lifetimes, overwrote each other's value and priced their
  cache writes by it. The stored value is now only where a new session starts from, and
  interactive and headless sessions each have their own.

### Changed

- `/costs doctor`'s **Cache lifetime** line says whether the lifetime in use is the
  session's own or carried over from earlier sessions.

## 0.9.0 (2026-11-12)

### Added

- The price list is checked against Claude Code's own price at every model switch. A
  difference raises a toast the first time it is seen for a model, and `/costs doctor` gains
  a **Prices** line.

### Fixed

- `/costs doctor` names US-only inference and web searches among the causes of a breakdown
  that falls short of the total. Both are charges in Claude Code's total that no request's
  token counts show.

## 0.8.0 (2026-11-12)

### Added

- At the end of each turn the mod keeps what the turn moved Claude Code's total by, beside
  what it priced the turn's requests at, and `/costs doctor` gains a **Turns** line that
  sets the two against each other inside turns and outside them. Only sessions that began
  under this version or a later one are counted.

## 0.7.0 (2026-11-12)

### Added

- The pane and `/costs doctor` (the **Breakdown** line) say how much of the month's total
  the category breakdown accounts for, and the doctor warns when the two are more than a
  tenth apart.

## 0.6.2 (2026-11-12)

### Fixed

- A subagent's cache writes are priced at the five-minute rate, which is what they are
  charged at whatever lifetime the conversation is on.
- A subagent's run no longer cancels the keep-alive, and no longer leaves behind a prompt
  record or a lifetime measurement that nothing clears.
- No cache lifetime is inferred from a turn whose cost fits both lifetimes.
- Folding an old session into its project's archive is safe to interrupt and to repeat. An
  archive records each session it has taken in and never takes one in twice.
- A session starts counting from the right baseline even when the store changes or fails
  during start-up housekeeping.

### Figures recorded before this version

- Subagents' cache writes are priced at the conversation's rate, 60% too high where that is
  the one-hour rate.

## 0.6.1 (2026-11-12)

### Added

- A toast the first time a model with no price is used. Its tokens are reported as
  unpriced, never priced from a neighbouring model.
- Rates by prompt length: a `longPrompt` object in the `rates` setting, and Haiku 5.5's
  higher rates for prompts over 100,000 tokens in the list.

### Fixed

- The price list is brought up to date with Anthropic's pricing page: Fable 5.2, Mythos 5.2,
  Haiku 5.5, Opus 4, 4.1 and 4.5 and Sonnet 4 and 4.5 are added, and Sonnet 5.5's cache-read
  rate is corrected.
- `/costs doctor` no longer names a model as unpriced once an update or the `rates` setting
  has given it a rate.

### Figures recorded before this version

- Tokens of the models added in this version are unpriced: Fable 5.2 and Haiku 5.5 among
  them.
- Sonnet 5.5 cache reads are at twice their price.

## 0.6.0 (2026-10-11)

### Added

- An optional keep-alive that holds the prompt cache warm while a session sits idle
  (`keepAlive` setting, `/costs keepalive on|off`).
- The cache lifetime is learned from Claude Code's own pricing of each turn.
- What a cold re-cache will cost, shown before a prompt or a resume pays for it, less the
  opening that other sessions keep cached.

## 0.5.0 (2026-10-06)

### Added

- `/costs doctor`, a self-check of the assumptions the ledger rests on.
- What each prompt cost, with the month's most expensive prompts in the pane.
- Which tool results fill the context, and what their cache writes and re-reads cost.
- The month's pace and the change against last week.

## 0.4.0 (2026-10-06)

The first version: session, week and month totals from Claude Code's running cost, a
`/costs` pane with a spend calendar, a category breakdown priced at list or your own rates,
per-project and subagent splits, budget alerts, CSV export, and warnings before a prompt, a
model switch or a large write re-caches the context.
