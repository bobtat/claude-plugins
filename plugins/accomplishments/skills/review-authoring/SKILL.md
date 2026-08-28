---
name: review-authoring
description: Use when turning journal entries into a finished career document — a performance self-assessment, a promotion packet, resume or LinkedIn bullets, or a weekly rollup — by clustering entries into themes, mapping them to the reader's framework, drafting in the user's voice, and verifying that every claim and every number traces back to a dated entry. Invoked by /accomplishments:review.
---

# Authoring from the Journal

**Load the `accomplishments:accomplishments` skill.** `references/formats.md`
holds what each reader needs and the mistake specific to each document;
`references/impact.md` holds the quantification rules.

The journal is the source. This procedure is a **view over it**, and the
constraint that makes the output defensible is that nothing may enter the
draft which is not in the journal.

## Phase 1 — Establish the target

Do not start drafting against an assumption. Settle:

- **Which document** — self-assessment, promotion packet, resume bullets, or
  rollup. Each has a different reader and a different shape.
- **What period** — and whether the journal actually covers it.
- **Whose framework** — if the company has a competency ladder or level
  definitions, ask for it and map to its language. A review mapped to the
  wrong ladder is worse than one mapped to none, so use the generic ladder
  only when there is no real one.
- **Any length limit.** Most self-assessments have a form with a character
  count, and a draft that does not fit gets cut by the user under time
  pressure, badly.

## Phase 2 — Load and assess coverage

Read every entry in the period. Before drafting, assess the record honestly:

- **Months with no entries.** Say so. A gap is a gap in the record, not a gap
  in the user's contribution, and presenting it as a complete picture is the
  quiet way this plugin would fail someone.
- **Themes resting on a single entry.** Flag them; one instance does not
  support a level claim.
- **Entries marked `unverified` or `estimated`.** List them now. Some are worth
  the user confirming before the draft ships, and confirming is cheap while
  drafting and expensive afterwards.

Report this assessment **before** producing prose, and ask whether to fill the
gaps first. A user who knows March is empty will usually remember March.

## Phase 3 — Cluster into themes

Group entries by **the thread a reader would recognize**, not by chronology or
by repository. Three to five themes for a year; two or three for a quarter.

Good themes are the ones a manager could repeat in a sentence: "reliability of
the data pipeline," "the SSO migration," "raising the team's testing bar." Bad
themes are technology names and time periods.

Within each theme, order by impact rather than by date, and identify the one
entry that carries the theme.

## Phase 4 — Draft

Follow the shape for the target document in `references/formats.md`. Across
all of them:

- **Lead with the outcome**, then the evidence, then the user's specific role.
- **Carry the source of every number into the draft's working notes**, even
  when the final text does not show it. The user will be asked "where did that
  come from" and must be able to answer.
- **Preserve hedges and attribution exactly.** "We" stays "we" unless the
  journal says what the user specifically did. `estimated` numbers are
  presented as estimates.
- **Write in the user's voice.** Read their journal entries for how they
  actually write and match it. Where their own sentence is good, keep it
  verbatim — a document that does not sound like them is one they will have to
  defend while sounding different from it.
- **Include a failure with what changed**, in a self-assessment or packet. Its
  absence is conspicuous and its presence buys credibility for the rest.

Cut anything that reads as filler. A shorter document with five specific
claims beats a longer one with five specific claims and three paragraphs of
throat-clearing, and the reader is skimming either way.

## Phase 5 — Verify every claim

This phase is the reason the output is trustworthy. Go through the draft claim
by claim:

| Check | Failure |
|---|---|
| Every number appears in an entry with a `source` | A figure that entered during drafting is a fabrication, however plausible |
| Every impact claim traces to a specific entry | An inference made while writing is not evidence |
| Every hedge in the journal survives in the draft | Silent upgrading is the most damaging edit available here |
| Attribution matches the entry | "We" that became "I" is a serious error, not a stylistic one |
| Level claims match the ladder tier in the entries | Inflation on one item discounts the whole document |
| Nothing confidential is in an external-facing document | Resume and LinkedIn bullets leave the company permanently |

Anything that fails a check comes **out** of the draft, or goes back to the
user as a question. It does not get softened and kept.

## Phase 6 — Report

Deliver the draft, then state plainly:

- Which periods or themes were thin, and what a stronger version would need
- Every claim that rests on an `estimated` or `unverified` entry
- Anything cut during verification, and why — a silent removal the user never
  notices is worse than the claim would have been
- For external documents: what was generalized for confidentiality

## Hard rules

- **Never add a claim that is not in the journal.** Not from the git history,
  not from the conversation, not from what plausibly must have happened.
- **Never invent, interpolate, or round a metric into existence.**
- **Never present a partial record as complete.** Naming the gaps is part of
  the deliverable.
- **Never write in a voice the user does not have.**
- **Never let a resume bullet carry confidential detail** without the user
  explicitly clearing it in this conversation.
