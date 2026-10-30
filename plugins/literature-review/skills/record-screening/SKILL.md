---
name: record-screening
description: The procedure for screening a review's records at title/abstract and at full text — two screener agents given identical inputs and no shared context, a calibration batch before the full run, each full text fetched once and title-checked before anyone reads it, every quotation checked by script against the saved text, adjudication of disagreements, the human/automation attribution the PRISMA template requires, and a script that derives the flow counts and Cohen's kappa straight from the CSVs. Used by /literature-review:review in Phase 3 and in each snowballing pass.
---

# Screening

Screening decides the evidence base. Everything downstream — appraisal, synthesis,
every figure — inherits its mistakes, and a record wrongly excluded at title/abstract is
never seen again.

**Load the `literature-review:literature-review` skill** — `references/prisma.md` covers
item 8 and the flow diagram this phase feeds.

## Independence, and What It Is Worth

Two `literature-review:screener` agents screen every record. They receive **identical
inputs and no shared context**: each gets the same brief and the same batch, writes to
its own file, and is never shown the other's output — not directly, not summarized, not
as a hint.

Two instances of one model share training and therefore share blind spots. Their
independence is contextual, not cognitive, and their κ overstates what the same number
means between two people. The conduct disclosure says so. Two mitigations are cheap and
worth taking:

- **Shuffle the record order** for the second screener. It removes position effects,
  which are real and would otherwise be perfectly correlated.
- **Keep the brief minimal** — criteria and records, not your opinion of the likely
  answer. Anything the orchestrator adds reaches both screeners and correlates them.

## The Brief

Write `screening/brief.md` once per stage and give both screeners the same path:

- the question, verbatim from `protocol.md`
- at title/abstract, each record's title and its abstract from `abstracts.json`; a
  record with no abstract is screened on its title and answered `unsure`
- the criteria table, with codes and short labels
- which criteria are decidable at this stage
- the decision rules below

## Calibration First

Screen a **pilot batch of about twenty records** with both screeners before the full
run, and compute κ. If it falls below the protocol's threshold, the criteria are
ambiguous: rewrite the criterion the disagreements cluster on, record the amendment in
`protocol.md` section 14, and re-pilot.

Adjudicating a hundred disagreements caused by one vague criterion is the most expensive
possible way to fix it. Calibration is standard practice for human teams for the same
reason.

## Stage 1 — Title and Abstract

Both screeners answer `include`, `exclude` or `unsure` per record, citing a criterion
code for every `exclude`.

**The liberal rule:** a record advances to full text if **either** screener answers
`include` or `unsure`. It is excluded only when both exclude. A title/abstract exclusion
is irreversible and cheap to avoid; eligibility is properly decided at full text. State
this rule in `protocol.md` section 6 — PRISMA item 8 asks how decisions were made.

A criterion that needs the full text is answered `unsure` at this stage, never guessed.

## Stage 2 — Full Text

### Fetch once, before anyone reads

Retrieve every advanced record's text **once**, before either screener starts, so both
screeners, the adjudicator and later the appraisal reader all read the same file — and
every quotation they make can be checked against it:

```
python3 ${CLAUDE_SKILL_DIR}/scripts/fetch_fulltext.py records.csv <record_id>... --out fulltext --log retrieval.csv
```

It saves `fulltext/<record_id>.txt` from the arXiv HTML rendering or Europe PMC's
open-access XML, and **refuses to save a text that does not carry the record's title**.
For each record the log says whether it was retrieved, by which route, and why not.

For a record the script could not route — a DOI with no arXiv ID or PMID — try an
open-access copy yourself. Check its title against the record before saving it as
`fulltext/<record_id>.txt`, and update that record's `retrieval.csv` row with the route
you used. Open-access routes only.

`full_text_retrieved` in `screening.csv` comes from `retrieval.csv`, not from the
screeners. A record with no saved text is `full_text_retrieved=no`. That is the "Reports
not retrieved" box, and it stays in the flow rather than disappearing.

### Judge

Only records with a saved text go to the screeners. Both judge eligibility against the
saved texts, given the `fulltext/` path, in **batches of about five**, each writing
`screening/ft-<batch>-s1.csv` or `-s2.csv`. They read the sections that decide
eligibility — methods, population, design — one paper at a time, and never fetch.

Batches are small because the failure they prevent is real. In this pipeline's first
end-to-end run, a screener with a large batch in view quoted a passage from one paper
as evidence about another.

- **Both agree** → that is the decision.
- **They disagree** → `literature-review:screening-adjudicator` decides, citing the
  criterion and the passage, or escalates to the user when the criterion itself is
  ambiguous. It writes `screening/adjudication-<round>.csv`, where the round is the
  main search or a snowballing iteration.

Every full-text exclusion carries a criterion. The flow diagram lists exclusion reasons
with a count each, and the count comes from this column.

### Check every quotation

As each screener's file returns, **before comparing it with the other's**:

```
python3 ${CLAUDE_SKILL_DIR}/../literature-review/scripts/verify_quotes.py --fulltext fulltext screening/ft-<batch>-s<n>.csv
```

It finds each quotation in the saved text of the record on its row. Any `NOT FOUND` or
`TRANSPLANT` — real words from a different paper — fails the batch:

1. **Discard that screener's whole batch**, not just the bad row. A screener that
   misattributed one passage may have misjudged its neighbours, and its other decisions
   were made in the same context.
2. Move the file to `screening/rejected/` — it is evidence for the disclosure.
3. Re-run that batch with a **fresh** screener instance, same brief, same records.
4. If the fresh instance fails too, stop and tell the user. The batch or the brief is
   the problem.

κ is computed on the decisions that survived, so it measures the re-run, and the
conduct disclosure says so with the number of batches replaced.

Check the adjudicator's file the same way. Before the gate, make one final run over
every surviving full-text file and the adjudications, with
`--report checks/quote-check-screening.md`. `UNCHECKABLE` there means a quotation about
a record with no saved text, which should not happen when screeners read only saved
texts — find out why.

Title/abstract rationales are not checked: they quote abstracts both screeners had in
the brief, and an exclusion there needs both screeners to agree anyway.

### Reports and studies

When two included records are reports of one study — a preprint and its published
version, a trial and its secondary analysis — give them the same `study_id`. The flow
diagram's last box counts both studies and reports, and this column is where that
distinction lives.

## Who Decided

The PRISMA template's second footnote requires a review using automation tools to report
how many records a human excluded and how many the tools did. Agent screening is an
automation tool.

`decided_by` is `automation` when the screeners agreed or the adjudicator decided, and
`human` **only when the user made or changed that specific decision**. Approving the
inclusion set as a whole does not make every decision in it human; claiming otherwise
inflates the human count the footnote exists to make visible.

## `screening.csv`

One row per record per stage:

```csv
record_id,stage,screener_1,screener_1_criterion,screener_2,screener_2_criterion,agreed,adjudication,final,final_criterion,decided_by,full_text_retrieved,study_id
```

`stage` is `title_abstract` or `full_text`. `full_text_retrieved` and `study_id` apply
to full-text rows. `examples/screening.csv` and `examples/records.csv` exercise every
case — a duplicate, an automation-ineligible record, human and automation exclusions,
`unsure` votes, an adjudicated disagreement, an unretrieved report, and a
preprint/published pair counted as one study.

## Deriving the Numbers

At the end of each screening round:

```
python3 ${CLAUDE_SKILL_DIR}/scripts/screening_stats.py records.csv screening.csv --out prisma-flow.json
```

It emits the flow counts — the input to the figure phase's `prisma_flow.py` — and κ with
raw agreement for each stage. **No number in the flow diagram is transcribed by hand.**

It checks the files first and **refuses to emit counts** from inconsistent data: a kept
record never screened, a screening row for a duplicate, a record advanced with no
full-text row, a full-text exclusion with no reason. Fix the data; do not work around
the check.

κ for full text excludes reports that were never retrieved, since nobody could judge
them.

Other-methods records lose some to deduplication and title/abstract screening before
they are "sought", and the two-column template has no box for that. The script emits a
note with the numbers; put it in the figure caption.

## The Gate

After the last snowballing pass is screened, present — with `AskUserQuestion` where
there is a real choice:

- The flow counts from `prisma-flow.json`
- κ and raw agreement per stage, and whether calibration changed any criterion
- Every adjudicated record, with the adjudicator's reasoning
- Anything the adjudicator escalated
- **Near-misses** — records that nearly met the criteria and why they were excluded.
  PRISMA item 16b asks for these by name
- Reports not retrieved, which the user may be able to obtain. A text the user
  supplies is saved as `fulltext/<record_id>.txt`, its `retrieval.csv` row marked
  `route=user`, and the record screened like any other
- The quote check: quotations checked, every failure, and the batches replaced
- Reports grouped under one `study_id`

Recommend, do not just list. **Appraisal does not start until the user approves the
inclusion set.** Any decision the user changes gets `decided_by=human`, and
`screening_stats.py` is re-run.

## Never

- **Never show one screener the other's decisions.**
- **Never exclude at title/abstract on a criterion that needs the full text.**
- **Never mark a decision human** that the user did not individually make.
- **Never invoke Sci-Hub** for a full text.
- **Never compare a screener's decisions before its quotations pass.**
- **Never let an agent fetch a full text during screening.** Fetching is done once, by
  script, before screening.
- **Never drop an unretrieved report.** It is a box in the flow diagram.
