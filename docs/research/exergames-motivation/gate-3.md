# Gate 3 — Appraisal: four adjudications escalated to the user

**Written:** 2026-11-28
**Decision:** — (awaiting the user) · **Decided by:** —

This is not one of the two approval gates. It is the stop the user asked for in their
answer to the revised gate 2: *if an adjudication is escalated and nobody can rule, do
not decide it; finish the appraisal work that does not depend on it, write the question
down, and stop.* The appraisal adjudicator escalated four items. Each comes from the
protocol supporting both readings, so choosing one is an amendment, and it is yours.

**No judge disputed any study's eligibility.** All twelve judgments rule the six
studies eligible (section 3).

Nothing below was decided by the orchestrator. `rob.csv`, `extraction.csv` and
`appraisal-agreement.json` do not exist yet: `appraisal_merge.py` writes nothing while
an item is open, and it was not run with `--escalated worse`, which is the route for a
run where nobody can rule.

## 1. The questions

Three questions settle the four items. A fourth is optional.

### Q1. Does reporting only a total score meet D5 "High"? (two studies)

Section 8, D5, High: "…or the report gives only some of the subscales or time points
that its methods or registration say were administered". Two papers describe their
instrument's subscales in the Methods and report only a total:

| Study | Instrument | What the Methods say | What is reported | Judge 1 | Judge 2 |
|---|---|---|---|---|---|
| `pm-40567995` Huang et al. (2025) | BREQ-2 | "The scale is divided into five aspects" (§2.5.4) | one score per arm at each of three time points; how it was formed is not stated | High | Some concerns |
| `pm-43021294` Tunç et al. (2026) | MSPPA | "comprises three subscales: individual reasons, environmental reasons, and amotivation", and a total "scored from 16 to 80" | the total only | High | Some concerns |

One reading: a total in place of every subscale is "only some" of what was
administered. The other: a whole-instrument total is not a subset, and nothing was
picked from among the subscales. The adjudicator found both judges read both papers
correctly and that the anchor supports both readings.

**What turns on it.**
- `pm-40567995`: this decides its **overall** rating. The merge lists no other open
  rating for it, and neither judge rated any other domain High, so overall is High if
  D5 is High and Some concerns if not.
- `pm-43021294`: overall is High either way; both judges rated D2 and D3 High. Only
  the D5 cell of the traffic-light plot changes.
- `oa-W7220097264` (Nikolova et al., 2025): both judges rated its D5 **High** on this
  same reading (six BREQ-3 subscales described, one composite reported). That rating is
  agreed and is not pending. If you answer "Some concerns", it should be re-rated under
  your sentence so the three studies are treated alike; I would send that one domain
  back to an agent that reads the paper, not change it myself. Its overall rating would
  stay High either way, because both judges also rated its D4 High.

**Sentence to adopt, one of:**
- (a) *Reporting only the total or composite score of an instrument whose subscales the
  Methods name is not, alone, "only some of the subscales": it is rated Some concerns
  under D5 unless a registration or protocol named the subscales as outcomes. How the
  total was formed is rated under D4.*
- (b) *Reporting only the total or composite score of an instrument whose subscales the
  Methods name counts as giving only some of the subscales, and is rated High under D5.*

**Recommendation: (a).** The anchor's words are "only some of the subscales", and a
total is not some of them. RoB 2's fifth domain is about a result chosen from several
that were available; all time points and, for the MSPPA, the instrument's own defined
total were reported. What is actually wrong in these papers (a BREQ total whose
construction is never given) is a measurement problem, and D4 already carries it. I
should say what (a) costs: `pm-40567995` would be the only study of the six not rated
High overall, and its motivation result is "no between-group difference". Under (b), or
if you prefer not to rule and have the more severe rating taken, all six are High.

### Q2. What decides `direction` for a composite of unstated construction? (one study)

`oa-W7220097264`. The only motivation result is one "Exercise Motivation" composite per
arm from the six-subscale BREQ-3. The paper never says how it was formed; the subscales
run from amotivation to intrinsic regulation and so point in opposite directions; the
VR arm's post-intervention mean is 4.08 on items scored 0–4. The tests reported are a
group main effect and a time × group interaction across three time points, with
within-group post-hoc tests; no between-group test at post-intervention is given.

Section 7 says a composite with a between-group test decides `direction`, but defines
"favouring" only for named constructs. The extractor and Judge 1 accept `favours
exergame`; Judge 2 queried it and proposed `other`. Two questions:

- **Q2a.** Does a composite whose construction and valence the paper does not state
  decide `direction` on the paper's own label (higher = more motivation)?
- **Q2b.** Does a time × group interaction count as the end-of-intervention
  between-group test?

**Sentences to adopt:**
- Q2a: *A composite decides `direction` only when the paper states how it is formed and
  its valence follows from that; otherwise the code is `other`, and the result is
  recorded in `motivation_result`.* — or its opposite: *a composite the paper labels as
  motivation decides, higher being favourable.*
- Q2b: *A time × group interaction on the I5 instrument counts as the between-group
  test at end of intervention when the paper reports no separate test there.* — or: *it
  does not; code `not tested between groups`.*

**Recommendation: Q2a — the first sentence (`other`); Q2b — the interaction counts.**
On Q2a, a score above the instrument's maximum, built by an unstated rule from
subscales with opposite meanings, cannot be given a direction without guessing. Coding
it `other` keeps the quoted result in the review and keeps it out of the count of
trials favouring exergames. On Q2b, saying the interaction does not count would also
bear on `pm-41307454`, whose `favours exergame` both judges accepted and which rests on
interaction P values; that value is agreed and not pending, and I would not reopen it
without your say.

**What turns on it.** Whether the review counts this trial among those favouring the
exergame. It is also the trial you kept marked doubtful, so the with-and-without
statement already sets it aside once.

### Q3. Which `exergame_platform` code for a game bike seen through a headset? (one study)

`pm-41307454` (Liu et al., 2025): "the commercial VirZoom VR exercise bike connected to
a PlayStation VR system (Sony), which includes a head-mounted display". Pedalling is
the game input; the game is seen in the headset. The extractor coded `immersive vr
headset`; Judge 1 queried it and proposed `exercise equipment with game`. Section 7
codes by hardware and gives no precedence between the two.

**Sentence to adopt:** *When an exercise machine is the game input and the game is
displayed in an immersive headset, the input device decides: code `exercise equipment
with game`.* — or the reverse, `immersive vr headset`.

**Recommendation: the input device decides.** I1 defines an exergame by its movement
input, so the platform column should follow the same thing. **What turns on it:** only
thread 3 (by platform) and one column of the characteristics table. No rating.

### Q4 (optional). Which domain carries reassignment at participants' request?

Not pending: the adjudicator decided it. For `pm-41628428` (Ngo et al., 2026) the
judges split on D1 (High / Some concerns) because amendment A3 says the weakness is
rated "under risk of bias, D1 and D2" without saying which. The adjudicator decided
**D1 Some concerns**: the seven participants asked to change "their assigned
allocation" after assignment, which RoB 2 treats as a deviation (D2, which both judges
rated Some concerns), not as broken concealment. It proposes adding to A3: *Reassignment
at participants' request after allocation is rated under D2; D1 carries a constrained
or pseudo-randomized procedure.* **Recommendation: adopt it**, so the rule is written
down. If you would rather the reassignment count under D1, say so and that rating goes
back to the adjudicator.

## 2. What the adjudicator decided (2 of 6 items)

| Study | Item | Judges | Decision | Why |
|---|---|---|---|---|
| `pm-41628428` | D1 Randomization process | High / Some concerns | **Some concerns** | Q4 above |
| `pm-41307454` | `n_randomized` | extractor's value / Judge 2's "19 and 19, derived" | **changed to a third value** | The column asks for numbers as stated. The paper never prints 19 per arm. The extractor had missed that the Abstract gives a different total ("36 college students randomized … (n=17, 47%) … (n=19, 53%)") from the Participant Flow (38). The cell now records both and the conflict |

**Pattern the adjudicator reported:** three of the four escalations, and the agreed D5
High on `oa-W7220097264`, come from one gap — the protocol accepts totals and
composites (A7, the `direction` rule) but D5 and `direction` do not say what a
composite means for them. Q1 and Q2 are that gap.

## 3. Eligibility

Every judge ruled its study **clear**. On the three studies whose `screening.csv` rows
still carry a doubt:

| Study | Screening doubt | What the judges found |
|---|---|---|
| `pm-43021294` | I1: game mechanics were in an appendix nobody had read | Both: met. Appendix 2 (fetched before extraction, below) gives the movement input and a score for each of the four games |
| `pm-40567995` | I6: no test labelled as the between-group test | Both: met. Table 2 gives BREQ-2 means for each arm at weeks 8 and 12, and I6 accepts means |
| `oa-W7220097264` | I1: exergame status rests on the authors' label | Both: met **under amendment A6**, which is the sentence you adopted for this record. Neither found text showing the input is not body movement; neither found a description of the input |

**How I intend to carry this, unless you say otherwise.** The merge will write
`eligibility=clear` for all six, because that column records the judges' rulings and I
do not edit it. You kept `oa-W7220097264` *marked doubtful*, and the judges' ruling on
it rests on A6 and not on anything new in the paper. So the synthesis will state each
conclusion with and without `oa-W7220097264`, name it as doubtful by your decision, and
say that the judges cleared the other two screening doubts from the text.

## 4. What is finished, and what waits

Finished:
- Gate 2 answers recorded (`gate-2.md`), amendments A6–A9 entered, `screening.csv`
  updated, `prisma-flow.json` re-derived: no flow count changed; doubtful inclusions
  went from 4 of 6 to 3 of 6.
- **A supplement was fetched for one included report.** `pm-43021294`'s Appendices 1
  and 2 came from the paper's open-access supplementary files at Europe PMC and are
  saved as `fulltext/pm-43021294.appendix1.txt` and `.appendix2.txt` (`search-log.md`,
  last section). This was done by the orchestrator, as the appraisal procedure allows
  for a part the saved text lacks. The screeners did not see them.
- Six extractions, all tier A, each passing the coded-value check and the quote check
  (355 quotations). Two extractors corrected one inexact quotation each on their first
  check; no transplant; no extraction replaced.
- Twelve judgments, each passing both checks. One judge corrected a quotation after its
  first check; no transplant; no judge replaced.
- One adjudication pass: 2 decided, 4 escalated; its quotations verified.
- Two figures that do not depend on appraisal: `figures/prisma-flow.svg` and
  `figures/database-contribution.svg`, both passing `check_figure.py`.

Waiting on your answers: the merge, `rob.csv`, `extraction.csv`, the derived overall
ratings, the two risk-of-bias figures and the evidence map, the synthesis, the audit
and the exports.

## To resume

Invoke the command again with the same `--output` and your answers:

1. **Q1** — (a) Some concerns or (b) High; and, if (a), whether `oa-W7220097264`'s
   agreed D5 is re-rated under it.
2. **Q2a** and **Q2b** — which sentence for each.
3. **Q3** — which platform code.
4. **Q4** — adopt the A3 clarification or not.
5. Whether section 3's handling of the doubtful study is what you meant.

Or say that you will not rule: the merge is then run with `--escalated worse`, which
takes High for both D5 ratings and keeps the extractor's values (`favours exergame`,
`immersive vr headset`), and the conduct disclosure lists each as escalated and
unresolved.

Each sentence you adopt is entered in protocol section 14 as approved by you. Your
rulings are entered in the studies' adjudication files as decided by the user, and the
merge is run again.
