# accomplishments

A Claude Code plugin that builds the evidence record a performance review needs, starting before the evidence is deleted.

## What It Does

The premise: three different failures ruin review material, and they happen at three different times.

**Evaporation** happens continuously. The evidence is not forgotten, it is deleted. Claude Code purges session transcripts after 30 days. Tickets close and archive. The Slack thread where someone said "this saved us" scrolls out of retention. By review time the record of your best quarter is a list of commit subjects — the one artifact guaranteed to say *what changed* and never *why it mattered*.

**Deflation** happens at capture time. "Refactored the sync module" is true and earns nothing. The facts that make it count — it blocked three teams, it cut a nightly job from 40 minutes to 6, two people had already looked and missed it — were never written down, and unlike the commit they cannot be reconstructed later.

**Fabrication** happens at writing time, and it is the failure specific to a model doing this work. Asked to make an accomplishment sound stronger, a model supplies the missing number, because a specific figure is better writing and inventing one is cheaper than finding it. "Improved sync performance" becomes "improved sync performance by 40%." Nobody notices until a manager repeats it upward and cannot support it.

Adds an auto-triggering knowledge skill, three procedure skills, four commands, one agent, and a `SessionEnd` hook:

- **The impact ladder** — task, project, team, org, company, with the rule that level follows consequence rather than effort, and the argument that a truthful spread beats a stack of inflated claims
- **The evidence table** — what git, PRs, reviews given, tickets, transcripts, dashboards, and praise can each actually prove, and the specific blind spot of each
- **The never-invent gates** — a `source` on every metric and a `confidence` on every entry, so invention is structurally difficult rather than merely discouraged
- **The interview** — the questions that pull impact out of a user who says "I just fixed some bugs," ordered by yield, with question 4 phrased to ask whether a number *exists* rather than what it was
- **`/accomplishments:init`** — creates the journal and arms the hook, after telling you exactly what that turns on
- **`/accomplishments:log`** — drafts an entry from the live session, then asks at most three questions
- **`/accomplishments:sweep`** — mines a period across every repository, reconciles against the journal, and interviews the gaps
- **`/accomplishments:review`** — self-assessment, promotion packet, resume bullets, or weekly rollup, with a verification pass that traces every claim back to a dated entry

## The 30-Day Deadline Is the Whole Design

Claude Code stores session transcripts in `~/.claude/projects/` and deletes them after `cleanupPeriodDays`, which defaults to 30.

This was verified rather than assumed, on the machine this plugin was written on: 161 transcripts, the oldest exactly 30 days old, no retention override in any settings file.

That single fact settles the architecture. The reasoning behind your work — the dead ends, the hypothesis that was wrong for two days, the moment you realized the problem was not where everyone was looking — exists in exactly one place, and it is on a 30-day timer. A performance review covers six to twelve months. So the capture cannot be something you remember to do; by the time you have a reason to want it, four fifths of it is already gone.

Hence a hook. And the hook has to extract at session end rather than leave a pointer for later, because a pointer to a deleted file is worth nothing.

## Why the Hook Is Silent

The obvious design — a hook that notices significant work and asks whether to log it — is the wrong one, for a reason worth stating.

The judgment cannot happen in the hook. A shell script cannot tell whether a commit mattered. A one-line config change that ends a recurring outage is org-level impact; a heroic three-month refactor nobody adopted is not. Any heuristic you write gets that backwards, so an asking hook is wrong most of the time it fires, and it fires while you are looking at code rather than thinking about your career. That kind of tooling gets switched off.

So the hook never asks. It appends, silently, and the significance judgment happens later at sweep time with a human in the loop — which is where it belongs.

`SessionEnd` turns out to enforce this rather than merely permit it: the event cannot block, and its stdout goes to the debug log rather than into the conversation. The hook is structurally incapable of interrupting you. It also fires on `/clear` and `resume`, not only on exit, so a long session is archived repeatedly as it grows; re-archiving replaces the shorter copy rather than accumulating duplicates.

**It is inert until you run `/accomplishments:init`.** The journal directory's existence is the opt-in gate — no directory, no capture, checked before the hook reads anything at all. Silent capture nobody asked for is surveillance, and a config flag someone has to find is not consent.

## What It Costs, Honestly

The hook archives **complete transcripts**, not summaries. Two consequences, both measured rather than estimated:

**Disk.** gzip compresses real transcripts **2.9x**, not the ~10x that plain text suggests — the large ones carry base64 and dense tool output that barely compress. Measured across 161 real transcripts: 101.5 MB raw, 35.5 MB compressed, over 30 days. At that rate, heavy daily use archives roughly **400 MB per year**.

**Secrets.** Transcripts are not filtered. Any credential, customer name, private file content, or internal metric that passed through a session is in the archive. This is documented rather than mitigated: scrubbing would corrupt the evidence being preserved, and a partially-scrubbed archive you trust is worse than an unscrubbed one you know to handle carefully. The journal lives under your home directory, it is never committed to a repository, and `/accomplishments:init` states this before creating anything.

If that trade is wrong for you, the plugin still works without the hook — `/accomplishments:log` and `/accomplishments:sweep` run against git and PR history alone. You lose the reasoning, which is the part worth having.

## Mining Produces Candidates, Not Accomplishments

The sweep can reconstruct a great deal: commits across every repository, merged PRs, issues you filed, and — the one almost nobody records — **reviews you gave**, which is real team-level evidence that takes one command to count.

What it cannot do is tell you which of that mattered. So it does not try. The sweep returns a ranked list of eight to twelve candidates and stops, and the user says which ones were real.

Presenting mined output as a set of accomplishments is the central failure mode of this whole approach. A list of 340 commits is not a review. It is a prompt.

## The Failure Mode Is Fabrication

A human writing their own brag document does not invent a metric. A model asked to make an accomplishment concrete **will**, because the concrete version is better writing and a plausible figure is the cheapest way to produce it.

That failure is worse here than in ordinary prose. A fabricated number in a review is repeated by your manager in a calibration meeting you are not in, and cannot be supported when someone asks. The cost lands on you, later, in a room you are not standing in.

So every metric carries a `source` — `user`, `dashboard`, `benchmark`, `document`, or `estimate` — and a number with no source cannot be written down at all. Every entry carries a `confidence`. Estimates ship with their arithmetic, so they can be challenged instead of quietly hardening into fact:

> **Legitimate.** "The manual reconciliation ran twice a week and took about an hour, per the two people doing it. Roughly 100 person-hours a year. (2/wk x 1hr x 2 people x 50 weeks; hours self-reported.)"

> **Fabrication.** "Saved ~100 hours annually."

Same number. The first can be defended in a room. The second cannot, because nobody — including the person who wrote it, six months later — knows where it came from.

## Its Honest Limits

- **No company's actual framework is encoded.** The ladder is a generic default. Point the review command at your real one; a review mapped to the wrong ladder is worse than one mapped to none.
- **The always-on skill fires on a description match**, which is probabilistic. When you finish something significant as step nine of an unrelated task, the match is weak and the skill may not load. The commands are the deterministic path.
- **The hook only covers sessions after you initialize.** Everything before that is already on the 30-day timer. `/accomplishments:init` offers to backfill what is still on disk — that is a one-time chance to rescue up to 30 days.
- **Non-GitHub forges are unsupported in the mining commands.** Git-level commands work everywhere; the PR and review queries are `gh`.
- **No issue-tracker integration ships.** JIRA and Linear go through whatever MCP server you have, or through pasted text. The plugin deliberately does not guess at ticket contents, because that is exactly where invention enters a review.
- **Nothing here is validated against actual promotion outcomes.** It reflects published practitioner advice and a coherent theory of what reviewers need. No claim is made that it changes review results.

## Installation

```
/plugin marketplace add bobtat/claude-plugins
/plugin install accomplishments@bobtat-plugins
/accomplishments:init
```

Then `/accomplishments:log` when something happens, and `/accomplishments:sweep` monthly. The monthly sweep is the one with a deadline attached: everything else can be caught up, but a purged transcript cannot.

## Testing the Hook

```
bash plugins/accomplishments/hooks/scripts/test-archive.sh
```

28 cases covering the opt-in gate, start-date bucketing, idempotent re-archiving, growth on resume, path-traversal refusal, and fail-open behavior on malformed input.
