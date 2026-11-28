# Conduct disclosure

This review was conducted by an automated agent pipeline. It follows the PRISMA 2020
reporting standard. It is not equivalent to a systematic review conducted by
independent human reviewers, and the differences are below.

## What was automated

| Stage | How | PRISMA item |
|---|---|---|
| Approval gates | **Both decided by the user**, on 2026-11-28: gate 1 (the protocol) and gate 2 (the inclusion set, answered twice: once on the first set and once on the revised set). The run was attended throughout; nothing was pre-authorized | n/a |
| Gate 3 | Not an approval gate. Four adjudications the appraisal adjudicator escalated were put to the user, who answered all of them on 2026-11-28 (`gate-3.md`) | n/a |
| Ruling after the audit | Not a gate. The user ruled on 2026-11-28 on two `direction` codes the pipeline had changed without instruction, and adopted amendment A14 | n/a |
| Search | One agent per source: PubMed through NCBI E-utilities (no key); OpenAlex through its REST API (keyless); backward citation searching through OpenAlex `referenced_works` | 6, 7 |
| Screening | Two agents per record, identical inputs, no shared context. Title and abstract: 150 pairs, raw agreement 0.967, κ 0.935. Full text: 44 pairs, raw agreement 0.932, κ 0.732 | 8 |
| Extraction | One agent per study, coded values from the protocol's lists and quoted, located numbers | 9 |
| Risk of bias | Two judge agents per study, RoB 2 with the protocol's anchors; an adjudicator agent; the user for what the adjudicator escalated | 11 |
| Figures | The flow diagram by script from `prisma-flow.json`; the other four by one agent each from one data file | 13c |
| Synthesis | Written by the orchestrating agent from the data files | 13, 20 to 23 |

## Where this differs from independent human screening

The two screeners are instances of the same model given the same inputs. Their
independence is contextual, not cognitive: they cannot see each other's decisions,
but they share training and therefore share systematic blind spots. Cohen's κ
measures their agreement, and between two instances of one model it overstates what
the same statistic means between two people.

## Decisions made by a person

Every screening decision is `decided_by=automation` except two: the inclusion of
`pm-41628428` and the exclusion code of `pm-42261097`, both by the user at gate 2. The
user also:

- approved the protocol and the question as drafted (gate 1);
- approved the inclusion set of six, kept `oa-W7220097264` in the review **marked as of
  doubtful eligibility**, and approved amendments A2 to A9; ratified A1, which the
  pipeline had made during calibration before the user saw it (gate 2);
- at gate 3, adopted amendments A10 to A13 and ruled on four items: domain 5 as Some
  concerns for `pm-40567995` and `pm-43021294`; `direction` = `other` for
  `oa-W7220097264`; `exergame_platform` = `exercise equipment with game` for
  `pm-41307454`. These are entered in each study's adjudication file as decided by the
  user. The merge script labels them `adjudicated` in `rob.csv` and
  `appraisal-agreement.json`; it has no separate label for a user ruling;
- after the audit, ruled on the two `direction` codes the pipeline had changed
  without instruction (see Appraisal below): restored `pm-40567995` to `no
  between-group difference`, adopting amendment A14 for it, and ratified `other` for
  `pm-43021294` under A11 as written. Both are entered in the studies' adjudication
  files as decided by the user; the merge records the first as `kept` (the extracted
  value stands) and the second as `adjudicated`.

The limits of roughly 150 records at screening and backward-only citation searching
were set by the operator who launched the run, and accepted by the user at gate 1.

## Appraisal

Each study was extracted once and judged twice, by two instances of one model given
identical inputs and no knowledge of each other. Across 6 studies and 30 domain
ratings the judges agreed on 27 (raw agreement 0.9, κ 0.737); 3 were settled
otherwise and 0 remain escalated. Of the 3: one was decided by the adjudicator from
the paper's text (`pm-41628428`, domain 1, Some concerns; confirmed by the user's
amendment A13), and two were escalated by the adjudicator and **decided by the user**
(`pm-40567995` and `pm-43021294`, domain 5, Some concerns, under amendment A10). The
judges gave the same eligibility verdict on 6 of 6 studies (clear), and 0 studies are
marked doubtful by a judge. The judges raised 7 queries of extracted values, on 5
cells; 4 cells were changed and 1 was kept as extracted (`pm-40567995`, `direction`,
by the user's ruling under A14). Escalated and still open for a person: none.
Figures are from `appraisal-agreement.json`. The same caveat applies as to screening:
this is two readings by one model, not two reviewers.

**The agreement figures count one rating that was re-rated.** Both judges had rated
domain 5 of `oa-W7220097264` High, and that rating was agreed. It was reached on the
reading that reporting only a composite score in place of an instrument's subscales
is "only some of the subscales". **The user rejected that reading at gate 3**
(amendment A10) and instructed that this one domain be sent back to an agent that
reads the paper and rated under the adopted sentence, so that the three studies
reporting only a total are treated alike. Two fresh judge agents, independent of each
other, each re-rated that domain in one judge's file; both gave Some concerns. The
pair counted in the agreement statistics is the re-rated pair (the original pair also
agreed, so raw agreement is unchanged by the swap). The study's overall rating stays
High because of domain 4. The original files are in `checks/superseded/`.

**The pipeline changed two direction codes before asking the user; the user has
since ruled on both.** Amendment A11, adopted for `oa-W7220097264`, says a composite
decides `direction` only when the paper states how it is formed and its valence
follows. Two other studies report only a total score (`pm-40567995`, BREQ-2;
`pm-43021294`, MSPPA), and their `direction` codes (`no between-group difference` and
`favours exergame`) had been accepted by both judges before A11 existed. Without an
instruction from the user, the orchestrator sent that one value back to two fresh
judge agents per study. All four queried it, and the adjudicator changed both to
`other`. The review was written, audited and exported on those codes. The user then
ruled, on 2026-11-28:

- `pm-40567995` is **restored** to `no between-group difference`. The user adopted
  amendment A14, qualifying A11: a between-group test on the I5 instrument that shows
  no difference is coded `no between-group difference` whatever the construction or
  valence of the score, because a null result needs no direction.
- `pm-43021294` **stays** `other`. The user ratified the recode under A11 as written:
  the paper gives the score's range but does not say whether the amotivation items
  are reverse-scored.

Both rulings were entered in the adjudication files, and the merge and the appraisal
check were run again; no coded value was edited any other way. The direction counts
are now two favouring the exergame arm, one mixed, one with no between-group
difference and two not coded (`extraction.csv`). The files as they stood before each
step are in `checks/superseded/`.

**The adjudicator proposed two further protocol sentences that were not adopted**,
because adopting one is the user's decision: (1) that a total including an
opposite-valence subscale has a stated valence only when the paper says those items
are reverse-scored or that higher means more autonomous motivation; (2) a rule for
which between-group test decides `direction` when a paper reports several
(`pm-43021294` reports three that disagree). Neither was needed for the values as
they stand, because the user ruled on `pm-43021294` by name, under A11 as written.
Proposal (2) is not moot, though: `pm-43021294`'s final scores do not differ between
arms (p 0.13), and on that test alone A14 would give `no between-group difference`.
The review reads the two rulings together as meaning that A14 applies only when no
end-of-programme between-group test on the instrument shows a difference. That scope
is the pipeline's inference; the user did not state it, and the protocol was not
amended to say it.

**One formatting repair was made by the orchestrator.** The extractor's row for
`pm-41628428` had an unquoted comma inside its `registration` cell, which split the
cell and shifted `funding` into a stray column. The quoting was repaired and no
character of the cell's content was changed; the original is
`checks/superseded/pm-41628428.extraction.before-quoting-repair.csv`. The check script
did not catch this because both cells are free text.

**A supplement was fetched for one included report** (`pm-43021294`, Appendices 1 and
2, from Europe PMC) by the orchestrator before extraction. The screeners did not see
it.

## Quotations

Every quotation in the screening and appraisal files was checked by script against
the saved full text of the paper it is attributed to. Screening: 136 checked, 136
verified. Appraisal: 524 checked, 507 verified in the papers and 17 matched to the
protocol's own wording; 0 not found, 0 from another paper, 0 uncheckable. 0 screening
batches, 0 extractions and 0 judgments failed the check and were redone. One
screening file was replaced for another reason (it was not valid CSV); the discarded
file is in `screening/rejected/`. κ is computed on the replacement.

Extractors and judges checked their own drafts before returning: 3 of 18 (two
extractors and one judge) had a failure on that first check and corrected 3
quotations between them; 0 of those were another paper's words. The six later
re-rating and re-examination passes had no first-check failure. All left a
first-check report; they are in `checks/readers/`. The check confirms that quoted
words are in the paper named; it does not check paraphrase, or that a quotation
supports the judgment it is cited for.

Every number credited to a study in `review.md` was traced by script to that study's
saved text: 37 traced before the audit, 39 after its corrections and 41 after the user's ruling was applied, 0 corrected or re-cited, 2 marked as the
review's own arithmetic. Coded data items and risk-of-bias ratings were checked
against the protocol's lists and scale, and each study's overall rating was derived
by rule.

## Routes that failed or degraded

- **21 reports were not retrieved** (20 from the databases, 1 from citation
  searching). Three open-access routes were tried by script; nothing was fetched by
  hand. They are named in `gate-2.md` section 7.
- **The third retrieval route was added after gate 2 was first written**, when the
  plugin was updated from 0.3.0 to 0.4.0 mid-run (amendment A2).
- **Forward citation searching was not run** (by the protocol). Backward searching
  ran one iteration; no cap was reached.
- **OpenAlex was searched without a key**, and applied stemming, so its matching may
  be broader than the written string.
- **Five excluded reports were read as preprints** and one as an accepted manuscript.
  No included report was.
- **No rasterizer for SVG is installed**; figures for the converted files were
  rasterized with `svglib`. **No LaTeX engine is installed**; the PDF, if produced,
  is from HTML through `weasyprint`.
- **Nobody has looked at the figures as a person.** The orchestrator viewed
  rasterized renders of the flow diagram, the two risk-of-bias figures and the
  evidence map, and viewed the traffic-light plot and the evidence map again after
  they were redrawn with first-author and year labels.

## What a human must still do

- [ ] Confirm the scope of A14 the review infers (it applies only when no
      end-of-programme between-group test shows a difference), or adopt a rule for
      which test decides when a paper's tests disagree; `pm-43021294`'s code is the
      user's ruling by name either way
- [ ] Decide whether to adopt the adjudicator's other proposed protocol sentence
      (above); it is not needed for a value in this review
- [ ] Decide whether `oa-W7220097264` stays: it is included on the authors' label
      alone (A6) and marked doubtful by the user's decision: `gate-2.md`, `review.md`
      §3.8 and §4.1
- [ ] Obtain and assess the 21 reports not retrieved: `gate-2.md` section 7
- [ ] Register the protocol, or leave the statement that it was not registered: item
      24a
- [ ] Second independent human screen: item 8
- [ ] Review the adjudicated and user-ruled risk-of-bias ratings, and the rest: item
      11
- [ ] Check the registrations of the three trials that cite one against their
      reported motivation outcomes; no registry was consulted
- [ ] Declare support and competing interests: items 25, 26

## Audit

Pass 1: an independent critic and citation verifier (`audit.md`, `critique.md`). 2
High, 5 Medium and 8 Low findings; all accepted and corrected in `review.md` with the
corrections left visible, except that checklist items 13f and 20d stay N/A, and that
the pipeline did not revert the two recoded `direction` values. The user later ruled
on both: `pm-40567995` restored under A14, `pm-43021294` ratified under A11.

After the user's ruling was applied, the quote check and the number trace were run
again (660 quotations, 0 not found, 0 from another paper; 41 numbers traced, 0 not in
source) and an independent critic read the final text and artifacts (pass 2,
`critique-2.md`): 0 High, 3 Medium, 7 Low, all accepted and corrected, with the
corrections in `review.md` left visible. One finding (M2) could be corrected only by
disclosure: the review now says which rule it inferred, and the question is listed
above for the user. **The sentences written to correct pass 2's findings have not
been read by an independent agent**; the number trace and figure checker were run
over them. Two audit passes is the limit the method sets.
