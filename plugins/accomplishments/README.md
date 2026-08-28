# accomplishments

A Claude Code plugin that builds the evidence record a performance review needs, starting before the evidence is deleted.

## What It Does

The premise: three different failures ruin review material, and they happen at three different times.

**Evaporation** happens continuously. The evidence is not forgotten, it is deleted. Claude Code purges session transcripts after 30 days. Tickets close and archive. The Slack thread where someone said "this saved us" scrolls out of retention. By review time the record of your best quarter is a list of commit subjects — the one artifact guaranteed to say *what changed* and never *why it mattered*.

**Deflation** happens at capture time. "Refactored the sync module" is true and earns nothing. The facts that make it count — it blocked three teams, it cut a nightly job from 40 minutes to 6, two people had already looked and missed it — were never written down, and unlike the commit they cannot be reconstructed later.

**Fabrication** happens at writing time, and it is the failure specific to a model doing this work. Asked to make an accomplishment sound stronger, a model supplies the missing number, because a specific figure is better writing and inventing one is cheaper than finding it. "Improved sync performance" becomes "improved sync performance by 40%." Nobody notices until a manager repeats it upward and cannot support it.

Adds an auto-triggering knowledge skill, three procedure skills, five commands, one agent, and a `SessionEnd` hook:

- **The impact ladder** — task, project, team, org, company, with the rule that level follows consequence rather than effort, and the argument that a truthful spread beats a stack of inflated claims
- **The evidence table** — what git, PRs, reviews given, tickets, session digests, dashboards, and praise can each actually prove, and the specific blind spot of each
- **The never-invent gates** — a `source` on every metric and a `confidence` on every entry, so invention is structurally difficult rather than merely discouraged
- **The interview** — the questions that pull impact out of a user who says "I just fixed some bugs," ordered by yield, with question 4 phrased to ask whether a number *exists* rather than what it was
- **`/accomplishments:init`** — creates the journal and arms the hook, after telling you exactly what that turns on
- **`/accomplishments:log`** — drafts an entry from the live session, then asks at most three questions
- **`/accomplishments:sweep`** — mines a period across every repository, reconciles against the journal, and interviews the gaps
- **`/accomplishments:review`** — self-assessment, promotion packet, resume bullets, or weekly rollup, with a verification pass that traces every claim back to a dated entry
- **`/accomplishments:scrub`** — finishes the model redaction pass on any digest the background run did not reach

## The 30-Day Deadline Is the Whole Design

Claude Code stores session transcripts in `~/.claude/projects/` and deletes them after `cleanupPeriodDays`, which defaults to 30.

This was verified rather than assumed, on the machine this plugin was written on: the oldest transcript on disk was exactly 30 days old, with no retention override in any settings file.

That single fact settles the architecture. The reasoning behind your work — the dead ends, the hypothesis that was wrong for two days, the moment you realized the problem was not where everyone was looking — exists in exactly one place, and it is on a 30-day timer. A performance review covers six to twelve months. So the capture cannot be something you remember to do; by the time you have a reason to want it, four fifths of it is already gone.

Hence a hook. And the hook has to extract at session end rather than leave a pointer for later, because a pointer to a deleted file is worth nothing.

## Why the Hook Is Silent

The obvious design — a hook that notices significant work and asks whether to log it — is the wrong one, for a reason worth stating.

The judgment cannot happen in the hook. A shell script cannot tell whether a commit mattered. A one-line config change that ends a recurring outage is org-level impact; a heroic three-month refactor nobody adopted is not. Any heuristic you write gets that backwards, so an asking hook is wrong most of the time it fires, and it fires while you are looking at code rather than thinking about your career. That kind of tooling gets switched off.

So the hook never asks. It appends, silently, and the significance judgment happens later at sweep time with a human in the loop — which is where it belongs.

`SessionEnd` turns out to enforce this rather than merely permit it: the event cannot block, and its stdout goes to the debug log rather than into the conversation. The hook is structurally incapable of interrupting you. It also fires on `/clear` and `resume`, not only on exit, so a long session is digested repeatedly as it grows; re-running replaces the shorter digest rather than accumulating duplicates.

**It is inert until you run `/accomplishments:init`.** The journal directory's existence is the opt-in gate — no directory, no capture, checked before the hook reads anything at all. Silent capture nobody asked for is surveillance, and a config flag someone has to find is not consent.

## What It Keeps, and What It Throws Away

The hook does **not** copy the transcript. It writes a small digest of the
prompts you typed, and discards everything else.

That split was chosen on measurement, not instinct. Across 114 real
transcripts totalling 22.3 MB of content:

| Segment | Share of content | Credential-shaped strings |
|---|---|---|
| Session metadata | 40.1% | — |
| Tool results — file contents, command output | 24.1% | 92 combined |
| Tool inputs | 20.3% | ↑ |
| Assistant replies | 4.7% | 4 |
| **Your prompts** | **7.8%** | 28 |

Tool traffic is where the secrets are and carries no career signal at all.
Your prompts are 7.8% of the bytes and hold the part that matters: the problem
you brought, and the decisions you made about it. Keeping only those removes
three quarters of the credential exposure and **99.8% of the bytes** — a
measured 564x reduction, roughly 1 MB per year instead of 260 MB.

Here is a real digest, from a 4.95 MB session reduced to 3.1 KB:

```
---
session: 0f7d3d02-…  started: 2026-08-05T10:58  project: claude-plugins
branch: feat/testing-plugin  prompts: 25  redaction: regex+model
---

[2026-08-05T10:58] Let's build a test writer plugin. I'm envisioning a
                   sequence of steps…
[2026-08-05T12:29] split it — feat for the pipeline, docs for the READMEs
[2026-08-05T12:35] Do we have a way to audit the testing coverage of a repo?
[2026-08-05T13:13] How do you think these would perform against Cypress tests?
```

That decision trail is unrecoverable from git, and it is what a review needs.

## Redaction Runs Twice, and Neither Pass Is a Guarantee

Prompts are not clean — 28 of the 120 credential-shaped hits were in them,
because people paste keys into questions. So the digest is redacted twice.

**Stage 1, in the hook, by regex.** Synchronous, offline, ~100 ms. Strips the
formats that have a shape: AWS and GitHub and Slack tokens, JWTs, PEM blocks,
connection strings, `SECRET=`/`PASSWORD=` assignments, long entropy blobs. It
**fails closed** — if Python is unavailable, the session is indexed and no
prompt text is written at all.

**Stage 2, detached, by Haiku.** Regex cannot catch a password written in
prose. A model can. Run against a digest containing `the staging database
password is hunter2plzwork`, `prod-billing-07.corp.internal`, and a client
name, Haiku removed all three and left `batch the per-row lookup, that fixed
it` untouched.

The model **never rewrites the digest**. It returns only the literal substrings
to remove, and the replacement happens locally by exact match. A garbled or
hallucinated response therefore changes nothing rather than corrupting the
record or inventing content. The worst failure mode is a missed secret, never
a fabricated one.

Stage 2 is best-effort and never blocks: `SessionEnd` runs on a ~1.5 second
budget and a Haiku call takes about 8. It is spawned detached, so if the
machine sleeps or the process dies, the digest simply keeps `redaction: regex`
in its frontmatter and `/accomplishments:scrub` finishes the job later. **The
redaction state is always written on disk**, so nothing is ever silently
assumed clean.

Set `ACCOMPLISHMENTS_NO_SCRUB=1` to skip the model pass entirely.

### The honest residual

Two stages are not a guarantee. A secret phrased unusually enough to defeat
both is possible, and no amount of pattern-matching or prompting closes that
completely. For projects where that risk is unacceptable, `<journal>/exclude`
lists paths that are never captured — checked **before** the transcript is
opened, so an excluded project is never read at all.

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
- **The hook only covers sessions after you initialize.** Everything before that is already on the 30-day timer. `/accomplishments:init` offers to backfill what is still on disk — a one-time chance to rescue up to 30 days.
- **Subagent transcripts are not captured.** They live beside the session transcript and are purged with it. The hook only ever reads the path `SessionEnd` hands it.
- **Redaction is two imperfect passes, not a guarantee.** Use `<journal>/exclude` for anything where that is not good enough.
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

50 cases, run offline with the model pass disabled. They cover the opt-in gate, start-date bucketing, idempotent re-digesting, growth on resume, the exclusion list, the recursion sentinel, path-traversal refusal, fail-open behavior on malformed input, and — the ones that matter most — that assistant replies, tool inputs, tool results, sidechain prompts, and injected context never appear in a digest, and that planted credentials do not survive redaction.
