---
name: accomplishments
description: This skill should be used whenever work is being recorded or retold for career purposes — when the user asks to "log this", "note this accomplishment", "what did I do this quarter", "write my self-assessment", "help with my performance review", "build my promo packet", "update my resume", "turn this into a resume bullet", "write my brag document", "summarize my week for standup" — and whenever Claude has just finished a substantial piece of work that will be invisible in six months. Provides the impact ladder that separates activity from accomplishment, the evidence classes and what each can actually prove, the journal entry format, and the never-invent rules that keep a review defensible in the room where it is read aloud.
---

# Accomplishments

## Overview

Three failures ruin performance-review material, and they happen at three different times.

The first is **evaporation**, and it happens continuously. The evidence is not forgotten, it is deleted. Claude Code purges session transcripts after 30 days. Tickets get closed and archived. The Slack thread where someone said "this saved us" scrolls out of retention. The person who would vouch for you changes teams. By review time the record of your best quarter is a list of commit subjects, and a commit subject is the one artifact guaranteed to describe *what changed* and never *why it mattered*.

The second is **deflation**, and it happens at capture time. "Refactored the sync module" is true and earns nothing. The facts that make it count — it was blocking three teams, it cut a nightly job from 40 minutes to 6, you found the cause after two people had already looked — were never written down, and unlike the commit they cannot be reconstructed later. Deflation is not modesty. It is the loss of exactly the information a reviewer needs and cannot infer.

The third is **fabrication**, and it happens at writing time. This is the failure specific to a model doing this work. Asked to make an accomplishment sound stronger, a model supplies the missing number, because a specific figure is better writing and inventing one is cheaper than finding it. "Improved sync performance" becomes "improved sync performance by 40%." Nobody notices until a manager repeats it upward and cannot support it.

The whole plugin follows from those three. Capture early because the evidence is being deleted. Capture *impact*, not activity, because impact is the part that decays. Never invent, because this document gets read aloud in a room you are not in.

## Non-Negotiables

These are gates. Each blocks an entry or a draft until its condition is met.

| Gate | Rule |
|---|---|
| **Never invent a metric** | No number enters an entry or a draft unless it came from the user, a document, or a command whose output was actually read. "Roughly 40 minutes to 6" from the user is a fact. "~40%" that you computed to fill a slot is a fabrication. |
| **Never upgrade a hedge** | "I think it helped with the on-call load" does not become "reduced on-call load." If the user is unsure, the entry records that they are unsure. |
| **Never inflate attribution** | "We" stays "we" unless the user says what *they* specifically did. A promo packet that claims a teammate's work is the fastest way to lose a promotion, not win one. |
| **Mark every number's source** | Each figure carries where it came from — the user, a dashboard, a benchmark run, an estimate. An estimate labeled as an estimate is usable. An estimate that looks like a measurement is a trap. |
| **Distinguish measured from claimed** | "p99 dropped from 1.2s to 300ms (Grafana, 2026-03-04)" and "felt much faster" are different kinds of evidence. Never let the second borrow the voice of the first. |
| **Never write the review from the journal alone** | The journal holds what was captured, which is never everything. Before drafting, say what period is thin and ask, rather than quietly presenting a partial record as complete. |
| **Confidentiality survives the export** | A resume bullet leaves the company. Customer names, unannounced products, internal metrics, and security findings do not go in one without the user explicitly clearing them. |
| **The user's voice, not yours** | A self-assessment that reads like it was generated is worse than a plain one. Match how the user actually writes; when their own words describe something well, keep them. |

## Activity Is Not Accomplishment

Most journal entries fail here, and the fix is mechanical.

> **Activity.** "Migrated the reporting service to the new auth library."
>
> **Accomplishment.** "Migrated reporting to the new auth library, closing the last blocker on the SSO rollout that three teams were waiting on. Did it in-place with no downtime; the rollout shipped a week early."

Same work. The second says who was affected, what it unblocked, and what changed as a result. None of that is inferable from the diff, and all of it is gone in a month.

Five questions convert one to the other. An entry that answers three of them is strong; most raw material answers zero.

1. **Who was affected, and how many of them?** One team, every engineer, every customer, the on-call rotation, the finance close.
2. **What is measurably different now?** Time, money, error rate, headcount freed, incidents avoided, a deadline met.
3. **What would have happened otherwise?** The counterfactual is the whole argument. Work with no counterfactual is maintenance.
4. **How hard was it to see?** Being handed a ticket and finishing it is competence. Noticing the problem nobody had named is scope.
5. **Does it keep paying?** A fix helps once. A change to how the team works helps every week after.

## The Impact Ladder

Reviews and promotion committees think in scope. Placing work on this ladder is the single most useful thing an entry can do, and it is nearly impossible to reconstruct a year later.

| Level | The work affects | Typical evidence |
|---|---|---|
| **Task** | You. You finished a thing you were asked to finish. | The ticket, the merged PR |
| **Project** | A feature or system reaching its goal | Ship date met, requirements closed |
| **Team** | How your team works or what it can now do | Others' velocity, a process that stuck, onboarding time |
| **Org** | Multiple teams, or a decision above your level | Cross-team dependency removed, a standard adopted |
| **Company** | Revenue, risk, or strategy | Contract landed, outage class eliminated, audit passed |

Two notes that matter more than the ladder itself. **Level is set by consequence, not effort** — a one-line config change that ends a recurring outage is org-level; a heroic three-month refactor nobody adopted is task-level. And **the ladder is for the entry, not for you** — a strong quarter is a spread, not a stack of company-level claims, and a packet that rates everything at the top reads as inflation and gets discounted wholesale.

## Evidence, and What Each Kind Can Prove

Every source is partial in a specific way. Full treatment in `references/evidence.md`; the summary:

| Source | Proves | Cannot show |
|---|---|---|
| Git history | That you did it, when, and how much changed | Why it mattered; the hard part; that it worked |
| Merged PRs | Scope, review, collaborators | Impact after merge |
| Reviews you gave | Multiplier effect, mentoring | Anything, unless you count and cite them |
| Issue tracker | The business reason and who asked | What it actually took |
| Session transcripts | The reasoning, the dead ends, the real problem | Anything after the session ended |
| Dashboards | The measured result — the strongest evidence there is | Attribution to you |
| What people said | Impact you never saw and cannot measure | Nothing — but it decays fastest, so capture it verbatim, immediately |

Two consequences. **Quantified results usually come from outside the codebase** — the dashboard, the invoice, the support queue — so an entry with a metric almost always needed a human to supply it. And **praise is the most perishable evidence and the least recoverable**: paste the sentence and who said it on the day it happens, or lose it.

## The Journal Entry

One file per entry under `entries/YYYY-MM/`, newest anywhere in the directory — order comes from the frontmatter, not the filename.

```markdown
---
date: 2026-03-04
title: Cut nightly sync from 40 minutes to 6
level: team
themes: [performance, reliability]
metrics:
  - value: "40 min -> 6 min"
    source: user            # user | dashboard | benchmark | document | estimate
    note: "timed against the Feb 28 run"
people: ["data-eng (unblocked)", "on-call (2 fewer pages/week)"]
evidence:
  - "PR #4821"
  - "sessions/2026-03/2026-03-04-<id>.jsonl.gz"
  - "Grafana: nightly-sync-duration, week of Mar 2"
confidence: measured        # measured | reported | estimated | unverified
---

The nightly customer sync had been running 40 minutes for months and was
treated as normal. It was blocking data-eng, whose jobs queued behind it.

Traced the stall to a per-row lookup inside the reconcile loop — two people
had already looked and read it as network latency. Batched the lookup.

Runtime is now about 6 minutes. Data-eng's morning jobs start on time and
the on-call rotation stopped getting the 3am queue-depth page.

**Unverified:** I believe this also fixed the duplicate-row reports, but I
have not confirmed that.
```

Three properties of that format carry the weight:

- **`source` on every metric.** This is the anti-fabrication mechanism made structural. A number with no source cannot be written down, so it cannot later be laundered into a review draft as fact.
- **`confidence` on the entry.** Downgrading is honest and cheap; a `reported` entry is still usable. Silent upgrading is what destroys a packet.
- **The unverified note stays.** It is a lead to confirm later, and it is a lie if the review says it happened.

## Working Rhythm

| When | Do | Why |
|---|---|---|
| Something lands | `/accomplishments:log` while the detail is live | Impact facts have a half-life of about a week |
| Praise arrives | Log it verbatim, immediately | The least recoverable evidence there is |
| Monthly | `/accomplishments:sweep` | Inside the 30-day transcript window — after that the reasoning is gone |
| Review time | `/accomplishments:review` | Reads the journal; never invents to fill it |

The monthly sweep is the one with a deadline attached. Everything else can be caught up; a transcript that was purged cannot.

## References

- `references/impact.md` — the ladder in depth, quantification without fabrication, and how to estimate honestly when nothing was measured
- `references/evidence.md` — mining git, PRs, reviews given, and issue trackers; the commands, and what each result does and does not establish
- `references/formats.md` — self-assessment, promotion packet, resume and LinkedIn bullets, weekly rollup: what each reader wants and the mistake specific to each
- `references/interviewing.md` — the questions that pull impact out of a user who says "I just fixed some bugs"
- `references/sources.md` — where the frameworks and claims here come from
