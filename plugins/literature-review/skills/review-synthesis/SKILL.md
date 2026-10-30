---
name: review-synthesis
description: The procedure for writing a systematic review from its appraisals — building threads from questions more than one study answers, writing review.md section by section from the data files rather than from memory, stating per section which tiers it rests on, rating certainty per outcome, and generating the PRISMA checklist and the conduct disclosure. Used by /literature-review:review in Phase 5.
---

# Synthesis

This is where the review answers its question. It is also the largest thing the run
produces, written at the point the run carries the most context — which is exactly when
a long deliverable gets lost. So it is built incrementally, from files.

**Load the `literature-review:literature-review` skill** — `references/synthesis.md` is
the method, `references/provenance.md` governs every claim, `references/reporting.md`
has the artifact shapes.

## Write From Files, Section by Section

Every input to this phase is on disk: `protocol.md`, `prisma-flow.json`,
`appraisals/`, `rob.csv`, `extraction.csv`, `references.bib`. **Read what each section
needs when you write it**, and append the section to `review.md` before starting the
next. Do not draft the review from your memory of earlier phases.

Two reasons. A section written from the appraisal file carries that file's quotes and
locations; one written from memory carries your impression of them. And a run that
writes `review.md` a section at a time leaves a usable partial review if it is
interrupted, instead of nothing.

## Order

### 1. Verify citations before writing any

Spawn `literature-review:citation-verifier` over the included studies with a path for
`references.bib`. It emits entries only for references that resolve **and** title-match.
Write with those keys. A study whose reference did not verify is resolved before it is
cited, not cited and fixed later.

### 2. Build the threads

Read across `appraisals/*.md` for questions **more than one study answers**. Each is a
thread and gets a section. A question only one study addresses is a single-study finding
and is labelled as one.

Write the thread list to `synthesis-plan.md` first — thread, studies bearing on it,
whether they agree. It is the outline you write against, and the audit can check the
review against it.

### 3. Write `review.md`

The section structure is in `references/synthesis.md`. In this order:

1. **Revision log and header** — compiled date, and an empty log.
2. **Methods** — summarizing `protocol.md`, including every amendment from its
   section 14. Items 5–15.
3. **Study selection** — the flow numbers from `prisma-flow.json`, and the flow diagram.
   Item 16a. Near-misses, item 16b.
4. **Study characteristics** — a table built from `extraction.csv`. Item 17.
5. **Risk of bias** — the traffic-light figure and a paragraph on the pattern. Item 18.
6. **One section per thread** — the body of the review.
7. **Certainty of evidence** — per outcome. Item 22.
8. **Discussion** — interpretation (23a), limitations of the evidence (23b), limitations
   of this review (23c), implications (23d).
9. **Other information** — registration, protocol, support, interests, availability.
   Items 24–27.

### Every thread section states what it rests on

```markdown
*Rests on: three studies at tier A (full text), two at tier C (abstract only). The
tier-C pair supply existence and topic, not findings.*
```

And where the tiers are mixed, per claim. A sentence resting on tier C reads identically
to one resting on tier A unless the difference is marked.

### Certainty

GRADE per outcome, from the RoB judgments, consistency, directness and precision across
the studies bearing on that outcome. **An outcome whose evidence is tier C cannot be
GRADE-rated** — rating down for risk of bias requires having assessed it, which requires
the full text. Write "not rated — full text not retrieved for N of M studies".

### Disagreement and gaps

`references/synthesis.md` covers both. Report conflicts; explain them only where the
evidence does. Report gaps as absences in the included set, bounded by the search, and
never fill one with reasoning about what the answer probably is.

## The Checklist

Write `prisma-checklist.md`: all 42 rows from `references/prisma.md`, each marked `met`,
`met-by-machine` or `requires-human`, with a pointer to where in `review.md`.

Mark what the review does, not what it could do. Items 24a, 25 and 26 are always
`requires-human`. Items 8, 9 and 11 are `met-by-machine` at best. Items 12, 13d–13f and
20b–20d are `N/A` for a narrative synthesis, and say so rather than disappearing.

## The Conduct Disclosure

Write `conduct-disclosure.md` from the template in `references/reporting.md`, with the
real values: κ and raw agreement per stage from `prisma-flow.json`, the count of
decisions the user made or changed, the MCP server versions and fallbacks from
`search-log.md`, and every route that failed or degraded.

The κ caveat stays in, unedited: two instances of one model are not two independent
reviewers, and a reader who does not know the screening was automated will read κ as the
stronger thing.

## Before Handing to the Audit

- Every citation key in `review.md` exists in `references.bib`.
- Every figure in the budget is placed with its caption, or its absence is explained.
- The flow numbers in the prose match `prisma-flow.json` exactly.
- The revision log exists, even if it has only the compiled date.

Then Phase 6 audits the finished document. The audit exists because this phase is where
the prevalence claims and the smoothed disagreements get written; expect it to find
some.
