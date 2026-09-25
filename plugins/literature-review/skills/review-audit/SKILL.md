---
name: review-audit
description: The procedure for auditing a literature review — inventorying its references, resolving and title-matching every one, checking claims against their stated evidence tiers, sweeping for prevalence claims a bounded search cannot support, recomputing the PRISMA flow arithmetic, and finding comparative results buried in prose. Works on a review this plugin produced and on one it did not, including reviews written by people. Used by /literature-review:audit and by the pipeline's own audit phase.
---

# Auditing a Review

An audit answers one question: **would a reader who acted on this review be misled?**

It is not a quality rating and not a rewrite. It produces located, grounded findings
and stops. Whoever owns the review decides what to do with them.

**Load the `literature-review:literature-review` skill** — its references are the
criteria for every step here.

## Two Modes

Establish which one applies before starting, and state it in the report.

| | **Full artifact set** | **Document only** |
|---|---|---|
| Input | `review.md` plus `screening.csv`, `search-log.md`, `protocol.md`, `appraisals/`, `figures/` | One document |
| Typical origin | This plugin's pipeline | Anywhere — a paper, a published review, a colleague's draft |
| Available | Everything below | Steps 1–3, 5, 6, 7 |
| Not available | — | Flow arithmetic against source data; per-claim provenance against extractions |

**In document-only mode, absence of an artifact is not a finding.** A review that never
claimed to have a `screening.csv` is not defective for lacking one. Report the reduced
coverage as a limit of the audit, not a defect of the document.

## The Steps

### 1. Inventory

Read the document. Build the reference list — every work cited anywhere, including
those cited only in a footnote, a table, or a figure caption.

Record for each: how it is cited, what identifier it carries (DOI, arXiv ID, PMID,
ISBN, bare URL, none), and where it appears.

**The count matters and is easy to get wrong.** Reference-list entries and in-text
citations diverge: a work cited in the body and missing from the list is a finding, and
so is the reverse. Count both and reconcile.

### 2. Verify

Spawn `literature-review:citation-verifier` with absolute paths to the document and to
the output table. For a long reference list, spawn several over disjoint slices and
merge — the work is independent per reference.

Its table is an input to everything after this, so it runs before the critique. Read it
when it returns: a title mismatch is the highest-severity thing an audit can find, and
it changes how you read the surrounding prose.

### 3. Tier audit

For each substantive claim, ask what evidence the document says it rests on, and
whether that supports it. The tier table in `references/provenance.md` is the standard.

Three shapes come up:

- **Tiers are stated and some are inflated.** Specific findings from a tier-C source,
  a quotation from a tier-B one. Report per claim.
- **Tiers are not stated at all.** Usual for a review from outside this plugin. That is
  itself the finding, reported once: the review makes no provenance claim, so a reader
  cannot tell which claims were read and which recalled. Then sample — check whether
  the cited works plausibly support the specific claims made, and report what you find.
- **Tiers are stated and honest.** Say so. It is rare and worth naming.

### 4. Flow arithmetic

Full-artifact mode only. Recompute from `screening.csv`:

```
identified − duplicates − ineligible_by_automation = screened
screened − excluded = sought
sought − not_retrieved = assessed
assessed − excluded_with_reasons = included
```

Check the figure, the prose and the CSV agree, and that full-text exclusions carry a
reason and a count per reason. Any mismatch is high severity — the numbers are the one
part of a review a reader checks by eye.

### 5. Prevalence sweep

Mechanical. Search the document for: *most, nearly every, the field, converged,
standard, widely, consistently, no system, none of, always, never, the most-cited,
dominant, ubiquitous*.

For each hit, decide whether the sentence names its evidence base. Quote the sentence,
say why it overreaches, and give the supportable rewrite. Do not paraphrase the
original — the exact wording is what makes the finding checkable.

Some hits are legitimate. "Most of the included studies" is bounded and fine. Check
before reporting.

### 6. Figure audit

Two directions, per `references/figures.md`:

- **Missing.** More than four studies compared on more than two dimensions in prose.
  Per-study risk-of-bias judgments with no traffic-light figure. A selection narrative
  with no flow diagram.
- **Overclaiming.** A forest plot without a meta-analysis. A bubble sized by something
  unmeasured. Tier-C and tier-A findings drawn identically. A citation graph implying
  the search was exhaustive.

For each missing figure, name the figure type and the data it would be built from.
A finding that says "this needs a figure" without saying which is not actionable.

### 7. Critique

Spawn `literature-review:review-critic` with the document, the verification table,
whatever artifacts exist, **and the absolute path it must write `critique.md` to**. It
returns that path and a short summary, not the critique itself — then read the file.
A long critique returned inline lands in your context at the point you still have the
report to assemble.

It covers smoothed disagreement, gap inflation, structure and checklist overclaim, and
it re-checks the ground the earlier steps covered — the overlap is deliberate, because
the steps above are mechanical and the critic reads.

Merge its findings with yours. Where you disagree with it, say so in the report rather
than silently dropping either.

## The Report

**Write this file incrementally**, from intake onward — header and coverage first, then
each step's findings as that step finishes. An interrupted run should leave a partial
report that says how far it got, not an empty directory.

```markdown
# Audit — <document>

**Mode:** full artifact set | document only
**Audited:** <date>
**Coverage:** what this audit could and could not check

## Summary
<Two or three sentences. The most serious thing found, and whether a reader
acting on this review would be misled.>

## Findings

### High
1. **<One-line claim>** — §<location>
   > <quoted text>
   <What goes wrong, in a sentence. Then the concrete fix.>

### Medium
### Low

## Citation verification
<The verifier's table, with its caveat paragraph intact.>

## What this audit did not check
- Whether any claim about a paper's contents is correct
- <N> references carrying no resolvable identifier
- <In document-only mode:> flow arithmetic, per-claim provenance
```

### Reporting rules

- **Ground every finding.** Quote the text or cite the row. An ungrounded finding is an
  opinion and costs the report its credibility.
- **Locate every finding.** Section, line, or table row.
- **Give the fix.** "This overreaches" is half a finding.
- **No material findings is a complete result.** Say it plainly. Do not pad.
- **Severity is about consequence**, not about how annoying the defect is.

## What an Audit Does Not Do

State these in the report, because an audit reads as a stronger guarantee than it is:

- **It does not check whether claims about papers are true.** That needs reading the
  papers, which is appraisal, not audit. A review can pass cleanly and still
  misrepresent every source it cites correctly.
- **It does not assess the studies.** Risk of bias belongs to appraisal.
- **It does not judge whether the question was worth asking** or the search
  well-constructed.
- **It does not fix anything.** Findings only.

## Auditing Someone Else's Review

The common case, and it needs a different posture.

A published review, or one written by a person, was produced under constraints the
audit cannot see. Report what is checkable and be careful about what is not:

- **Never assert a citation is fabricated** because you do not recognize it. Report it
  as unresolved and say the check could not reach it.
- **Absence of this plugin's conventions is not a defect.** Tier labels, conduct
  disclosures and artifact sets are this plugin's. Their absence is worth one note
  about what a reader cannot verify, not a finding per missing element.
- **Distinguish a defect from a difference.** A narrative review that does not follow
  PRISMA is not non-compliant; it is a different kind of document. Check it against
  what it claims to be.
- **The findings are for whoever asked**, not for the review's author, unless they
  asked. Say what is wrong; do not draft the complaint.
