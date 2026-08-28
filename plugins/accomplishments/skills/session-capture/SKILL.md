---
name: session-capture
description: Use when turning work that just happened into a journal entry — capturing what was accomplished while the context is still live, interviewing for the impact facts that exist only in the user's head, and writing a dated entry with every number traced to its source. Invoked by /accomplishments:log; also useful directly when a session has just produced something that will be invisible in six months.
---

# Capturing an Accomplishment While It Is Still Warm

**Load the `accomplishments:accomplishments` skill** for the impact ladder, the
entry format, and the never-invent gates. `references/interviewing.md` holds
the question set this skill runs. This plugin's skills are addressed as
`accomplishments:<name>`; there is no bare-name fallback.

Impact facts have a half-life of about a week. This procedure exists to catch
them inside it.

## Phase 1 — Establish the journal

```bash
J="${CLAUDE_ACCOMPLISHMENTS_DIR:-$HOME/.claude/accomplishments}"
[ -d "$J" ] || echo "no journal — run /accomplishments:init first"
```

No journal, no entry. Do not create it silently here: initialization is also
what arms the session-archiving hook, and that is the user's decision to make
knowingly. Say so and stop.

## Phase 2 — Draft from what you already know

Do not open with questions. Read the session first and produce a draft, then
ask only about what the draft is missing. A user handed a draft corrects it in
one message; a user handed six questions answers one.

From the conversation, extract:

- **What was actually done** — the change, in the user's terms, not the diff's
- **The problem behind it** — usually stated in the user's first prompt, which
  is the densest record of intent in the whole session
- **What was hard** — the dead ends, the wrong hypotheses, the thing that took
  three attempts. This is the part no other source keeps.
- **Anything measured** — a benchmark that was run, a timing, a count. Only if
  it was actually observed in the session.

Then check the repository for what landed:

```bash
git log --author="$(git config user.email)" --since="6 hours ago" \
        --pretty=format:'%h %s' --stat
```

If the work is not committed yet, that is fine — the entry records the work,
not the commit. Note it as in-flight and move on.

## Phase 3 — Interview for what is missing

Ask about **the gaps in the draft**, not from a script. Cap it at three
questions. In descending order of yield:

1. **Who was affected, and did anyone say anything?** Highest yield. Surfaces
   beneficiaries and catches praise before it decays.
2. **What would have happened if you hadn't?** The counterfactual, which is
   what separates contribution from maintenance.
3. **Is there a number?** Phrased as whether one *exists* — never propose a
   value, and never ask a question that a plausible figure would answer.

Skip any question the session already answered. If the user gives a short or
reluctant answer, take it and move on; a capture habit that feels like an
interrogation stops happening, and that failure costs more than one thin entry.

## Phase 4 — Write the entry

One file, `entries/YYYY-MM/YYYY-MM-DD-short-slug.md`, in the format from the
knowledge skill. Then:

- **Every metric carries a `source`.** No source, no metric — write the entry
  without it. This is not negotiable and is the reason the field exists.
- **Set `confidence` honestly.** `measured` only if something was actually
  measured. Most good entries are `reported`.
- **Set `level` from consequence, not effort.** When it is genuinely unclear
  between two tiers, take the lower one and say why in the body.
- **Keep the user's own sentences.** Where they described something well, use
  their words rather than a polished paraphrase — it is their voice that has
  to survive into the review.
- **Record the unverified.** A belief the user has not confirmed belongs in the
  entry marked as such. It is a lead worth chasing and a liability if a review
  states it as fact.

Link the evidence that exists right now: PR number, commit SHAs, the archived
session path if one exists for this session, and any dashboard the user named.

## Phase 5 — Report

State what was written and where, in two or three lines. Name explicitly:

- Anything recorded as unverified, and what would confirm it
- Any number the user could supply later that would strengthen the entry

Then stop. Do not offer to write more entries, and do not summarize the entry
back — the user just supplied its contents.

## Hard rules

- **Never invent a metric, a beneficiary, or a consequence.** If the session
  does not establish it and the user did not say it, it is not in the entry.
- **Never upgrade the user's confidence.** "I think it helped" stays "I think
  it helped."
- **Never write an entry for work the user did not do.** Claude did much of
  the typing in these sessions; the entry records the user's work, judgment,
  and direction. Where a distinction matters, ask.
- **Never log the same work twice.** Check `entries/` for the current month
  before writing; if an entry covers this work, update it instead.
