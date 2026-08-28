---
description: Draft a self-assessment, promotion packet, resume bullets, or rollup from the journal
argument-hint: [format and period] (e.g. "self-assessment for H1", "resume bullets", "weekly")
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Skill, AskUserQuestion, TodoWrite
---

## Context

- Journal: !`echo "${CLAUDE_ACCOMPLISHMENTS_DIR:-$HOME/.claude/accomplishments}"`
- Initialized: !`[ -d "${CLAUDE_ACCOMPLISHMENTS_DIR:-$HOME/.claude/accomplishments}" ] && echo YES || echo "NO — run /accomplishments:init"`
- Entries: !`find "${CLAUDE_ACCOMPLISHMENTS_DIR:-$HOME/.claude/accomplishments}/entries" -name '*.md' 2>/dev/null | wc -l` across !`ls "${CLAUDE_ACCOMPLISHMENTS_DIR:-$HOME/.claude/accomplishments}/entries" 2>/dev/null | wc -l` months
- Months covered: !`ls "${CLAUDE_ACCOMPLISHMENTS_DIR:-$HOME/.claude/accomplishments}/entries" 2>/dev/null | tr '\n' ' '`
- Last sweep: !`ls "${CLAUDE_ACCOMPLISHMENTS_DIR:-$HOME/.claude/accomplishments}/sweeps" 2>/dev/null | tail -1 || echo "none"`

## Task

Turn journal entries into a finished document for a specific reader.

**Load the `accomplishments:review-authoring` skill now** and follow its six
phases. Load `accomplishments:accomplishments` for the impact ladder and the
quantification rules; `references/formats.md` holds the shape and the
characteristic mistake for each document type. This plugin's skills and agents
are addressed as `accomplishments:<name>`.

`$ARGUMENTS` names the format and period. If either is unclear, ask with
AskUserQuestion rather than guessing — a promotion packet and a resume bullet
share facts and share nothing else.

### Ask for the framework

If the company has a competency ladder, level definitions, or a review form
with prescribed sections, ask for it and map to its language. A document
mapped to the wrong ladder is worse than one mapped to none. Ask about length
limits at the same time: most review forms have a character count, and a draft
that does not fit gets cut by the user, under time pressure, badly.

### Assess coverage before drafting

Read every entry in the period and report, **before writing any prose**:

- Months with no entries
- Themes resting on a single entry
- Entries marked `estimated` or `unverified` that a draft would lean on

Then ask whether to fill the gaps first. A user told that March is empty will
usually remember March; a user handed a polished draft will assume the record
was complete.

### The verification pass is not optional

Before delivering, check the draft claim by claim: every number traces to an
entry with a `source`, every impact claim traces to a specific entry, every
hedge survives, attribution matches, and nothing confidential is in a document
that leaves the company. Anything failing a check comes out or goes back to
the user as a question — it does not get softened and kept.

### Hard rules

- **Never add a claim that is not in the journal** — not from git history, not
  from this conversation, not from what plausibly must have happened.
- **Never invent, interpolate, or round a metric into existence.**
- **Never present a partial record as complete.** Naming the gaps is part of
  the deliverable, not a caveat to bury.
- **Never turn "we" into "I".**
- **Never put confidential detail in a resume or LinkedIn bullet** without the
  user clearing it in this conversation.

### Report

Deliver the draft, then state: which periods or themes were thin and what
would strengthen them, every claim resting on an estimated or unverified
entry, anything cut during verification and why, and — for external documents
— what was generalized for confidentiality.
