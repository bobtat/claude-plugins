# Critique, pass 2: `review.md` as it stands after the user's ruling of 2026-11-28

**Mode:** full artifact set. I read the review cold and checked it against `extraction.csv`, `rob.csv`, `rob-labelled.csv`, `evidence-map.csv`, `appraisal-agreement.json`, the four `appraisals/*.adjudication.csv` files that carry a direction or rating ruling, `prisma-flow.json`, `screening.csv`, `retrieval.csv`, `protocol.md` §5–§9 and §14 (A1–A14), `gate-3.md`, `conduct-disclosure.md`, `prisma-checklist.md`, `synthesis-plan.md`, `study-keys.csv`, `checks/citation-verification.md`, `checks/number-trace.md`, the SVG source and `<desc>` of all five figures, and the saved text of `pm-41307454`, `pm-41628428`, `pm-42974341`, `oa-W7220097264` and `pm-38801680` where a claim depended on the wording. I did not use `critique.md`.

I judged the un-struck text. Where a retraction leaves the standing sentence unclear, I say so.

**Summary:** 0 High, 3 Medium, 7 Low. Every count of directions and risk-of-bias ratings in the standing text matches the data files. The findings are about who decided what, one rule that does not produce the code shown, and readability.

---

## Medium

### M1. The abstract says the pipeline changed the code of the doubtful trial. It did not. (Charter 1/9: attribution of decisions)

**Location:** Abstract, Results, lines 60–64.

> "Of the two with no coded direction, one reported a difference in change scores but not in final scores, and one is the doubtful trial. Two of these codes were changed by the pipeline during appraisal without the user's instruction; the user has since ruled on both, restoring the null result to no between-group difference and ratifying the other as not coded."

"Two of these codes" can only refer back to the two trials with no coded direction, Tunc 2026 and Nikolova 2025. The two codes the pipeline changed without instruction were `pm-43021294` (Tunc) and `pm-40567995` (Huang), and Huang is not one of "these". Nikolova's `other` was the user's own ruling at gate 3 (`appraisals/oa-W7220097264.adjudication.csv`: "This study's direction is other by the user's ruling, not the adjudicator's"; A11). The same sentence then says one of the two was "restor[ed] … to no between-group difference", which cannot be true of either uncoded trial. So the sentence contradicts itself and, read naturally, puts the doubtful trial's code on the pipeline.

**Fix:** name the trials. For example: "The pipeline changed two codes during appraisal without the user's instruction: the null trial's (to `other`) and the change-score trial's (from favouring to `other`). The user has since restored the first and ratified the second. The doubtful trial's code is the user's ruling at gate 3 (A11)."

### M2. The stated A14 rule codes Tunc 2026 differently from the code shown, and the tie-break that settles it is in no protocol text. (Charter 6/9: rule and data disagree)

**Location:** §2.4, lines 170–172; §3.4 table row for `@tunc2026rehabilitative`; Figure 5 note (b); `conduct-disclosure.md` lines 108–115.

> §2.4: "A between-group test that shows no difference is coded `no between-group difference` whatever the construction of the score, because a null result needs no direction (amendment A14)."

> §3.4: "MSPPA total: absolute scores at week 24 not different (p 0.13); change scores and ANCOVA different (p = 0.015 for the ANCOVA) | other"

Tunc has a between-group test at the end of the programme that shows no difference (T2 absolute scores, p 0.13; `extraction.csv`). Read literally, the rule in §2.4 and in protocol §7 makes Tunc `no between-group difference`. The review shows `other`. The rule that actually produces `other` appears only in Figure 5's note and `<desc>` ("'other' means the trial reported only a total or composite score … and at least one of its between-group tests showed a difference") and in the abstract's "with a difference on at least one of their tests". Neither A11 nor A14 says that. The code itself is not in doubt, because the user ratified `other` for this study by name (`pm-43021294.adjudication.csv`; A14's Consequences). But a reader who applies the stated rule to the tabulated results gets a different answer from the review. For the same reason, the conduct disclosure's line about the adjudicator's unadopted proposal (2), a rule for which test decides when a paper reports several, is now wrong. It says "Neither changes a value in this review as it stands". Once A14 exists, proposal (2) is exactly the rule that decides between A14 and A11 for Tunc. Only the user's study-specific ratification makes it moot.

**Fix:** in §2.4, state the scope the user's two rulings imply: A14 applies when every end-of-programme between-group test on the instrument shows no difference, and a mix of null and non-null tests on a composite of unstated valence falls under A11. Say that this scope was inferred from the two rulings and not stated by the user. Add it to "What a human must still do" for confirmation. In the disclosure, change "Neither changes a value" to say that proposal (2) would decide Tunc's code if the user's ratification were set aside.

### M3. The conduct disclosure's Audit section still describes the two recodes as unreverted. (Decided matter described as undecided)

**Location:** `conduct-disclosure.md`, Audit, lines 193–197.

> "…all accepted and corrected in `review.md` with the corrections left visible, except that the two recoded `direction` values were not reverted (a coded value is a reading, and the adopted wording of A11 gives `other`)…"

This is the state before the user's ruling. Since then the user has reverted `pm-40567995` to `no between-group difference` (A14; `pm-40567995.adjudication.csv`), and the same disclosure says so twenty lines earlier ("`pm-40567995` is **restored**"). The Audit section is the part a reader checks for what the audit changed, and here it gives the old answer. The stated reason, that A11 gives `other`, also no longer holds for `pm-40567995` once A14 exists.

**Fix:** "…except that the two recoded `direction` values were not reverted by the pipeline. The user later ruled on both: `pm-40567995` restored under A14, `pm-43021294` ratified under A11." Add the user's ruling as an event after the audit, and say that no independent reader has read the text written after it.

---

## Low

### L1. The adjudication marks in Figure 3 call two user rulings "adjudication". (Charter 5: figure states more than its data)

**Location:** `figures/rob-traffic-light.svg`, legend line 127 and `<desc>`. Figure 3 caption, lines 336–339.

> SVG: "Adjudicated: judgment set by adjudication (basis = adjudicated)." `<desc>`: "3 cells were adjudicated: Huang 2025 (pm-40567995) D5, Ngo 2026 (pm-41628428) D1, Tunc 2026 (pm-43021294) D5."

The caption gets it right: two of the three were decided by the user under A10. The figure itself, and its accessible description, attribute all three to adjudication. Anyone who sees the figure without the caption (a slide, a screen reader that reads only `<desc>`, the .docx figure alone) gets the wrong account.

**Fix:** either add a second mark for "decided by the user", or change the legend and `<desc>` to "Adjudicated or decided by the user on escalation (Huang D5, Tunc D5 by the user under A10; Ngo D1 by the adjudicator)".

### L2. After the two retractions, §4.1's main paragraph is hard to follow. (Retraction readability)

**Location:** §4.1, lines 588–606.

There are two problems:

- The marker "*[Corrected after audit, 2026-11-28]*" at line 588 now sits in front of a passage that is struck in full, immediately followed by a second marker. Nothing in the standing text belongs to the first marker, so it reads as an orphan.
- In "The user restored **the first trial above** to no between-group difference", the nearest preceding trials are the two uncoded ones, Tunc and then Nikolova. Read that way, "the first trial above" is Tunc, which the previous sentence says was *ratified*, not restored. The intended trial is Huang, mentioned four sentences earlier.

**Fix:** replace "the first trial above" with "@huang2025effects". Join the two markers ("*[Corrected after audit, and again after the user's ruling, 2026-11-28]*"), or move the first marker inside the struck span.

### L3. §3.1's "five full-text disagreements" do not match the agreement statistic beside them.

**Location:** §3.1, lines 272–276.

> "at full text, 44 pairs, raw agreement 0.932, κ 0.732 … Five full-text disagreements went to the adjudicator"

0.932 × 44 = 41 agreements, so 3 disagreements on the decision. The data supports that: `screening.csv` rows `pm-41628428`, `pm-41384807` and `oa-W7220200190` have `agreed=no`. The other two items sent to the adjudicator, `pm-42261097` and `oa-W4413463698`, are recorded as `agreed=yes`. Both screeners excluded them, and they differed only on the exclusion code.

**Fix:** "Three decision disagreements and two exclusion-code disagreements went to the adjudicator…"

### L4. Liu 2025's "deterioration in the control arm" caveat is applied to motivation, where the control arm did not deteriorate. (Number against the saved text)

**Location:** §3.4, "Against no intervention", lines 442–444.

> "Its own limitations section says the interactions were probably inflated by deterioration in the control arm"

The paper's sentence (`fulltext/pm-41307454.txt`, Limitations) names the deterioration: "the control group exhibited elevated depressive symptoms, increased BF percentage, and poorer CRF over time". On motivation, the control arm's identified regulation stayed at 3.74 and its intrinsic regulation rose from 3.63 to 3.76 (`extraction.csv`). The quotation is accurate. Placed beside the motivation result, it suggests a reason to discount that result which the motivation data do not show.

**Fix:** add "…by deterioration in the control arm on depression, body fat and fitness; on the two motivation subscales that differed, the control arm's scores did not fall (identified 3.74 to 3.74, intrinsic 3.63 to 3.76)."

### L5. The adherence statements disagree across §3.7, §3.10 and §4.4.

**Location:** §3.7 lines 510–514; §3.10 Adherence row; §4.4 lines 705–706.

§3.10 counts the adherence outcome as resting on "1 trial", and §3.7 describes that trial's completers attending 100% in both arms. §4.4 says "none reports motivation and comparable adherence in both arms". Anderson 2026 reports both, for two arms, though among completers only. "Comparable" is doing work that is not defined.

**Fix:** in §4.4, "none reports adherence for all randomized participants in both arms; the one that reports it does so for completers only and finds it identical [@anderson2026gamified]."

### L6. The sensitivity table's "Headset games represented: 1 trial" leaves out Liu 2025's headset.

**Location:** §4.1 sensitivity table, row "Headset games represented".

Liu 2025's game is "seen through a headset" (§3.6; PlayStation VR). It is coded `exercise equipment with game` under A12. §3.6 is careful ("coded as a headset game"), but the table row is not, so "None" in the other two columns reads as "no headset in any remaining trial". Liu is rated high, so that is true for the high-risk column and not for the doubtful-trial column.

**Fix:** relabel the row "Trials coded `immersive vr headset`".

### L7. Checklist items 13c and 16a are marked plain `met` for machine-produced displays that no person has viewed. (Charter 9)

**Location:** `prisma-checklist.md`, rows 13c and 16a.

> 13c "Tabulation and display | met | §2.6; five figures and the tables in §3"

Four of the figures were drawn by agents and the flow diagram by script from machine screening. The conduct disclosure says "**Nobody has looked at the figures as a person.**" The checklist's own header says no item is marked `met` "on the strength of a gate alone". On this review's own convention, the truthful state of these two rows is `met-by-machine`, as it is for 17, 18 and 19.

**Fix:** mark 13c and 16a `met-by-machine`.

A related, smaller point: protocol §9 says that the search's lean toward null-in-full-text trials is stated "wherever it reports a direction". The review states it in §3.4's "Rests on" line and in §4.3. It is missing from the abstract, which reports the direction counts. One clause there ("the search probably missed trials that reported motivation only in the full text") would satisfy the protocol.

---

## Checked and clean

- **Direction counts** in the abstract, §3.4 (both paragraphs and the table), §3.5, §3.6, §3.8, §3.10, §4.1 text and every cell of the sensitivity table, with all six, without Nikolova, and without the four rated high. All match `extraction.csv` and `evidence-map.csv`: 2 favour, 1 mixed, 1 no between-group difference, 2 `other`. Without the doubtful trial: 2/1/1/1. Without the four rated high: 0 favour, 1 mixed, 1 no difference, 0 uncoded.
- **Risk-of-bias counts**: overall 4 High and 2 Some concerns. By domain, High in D1 (Anderson), D2 (Tunc), D3 (Liu, Anderson, Tunc) and D4 (Nikolova); D5 Some concerns for all six; no Low anywhere. "3 of 5" without the doubtful trial. All match `rob.csv`. Figures 3 and 4 (marks and `<desc>`) match `rob.csv` and `rob-labelled.csv`, and the two files agree row for row. Agreement on 27 of 30, 0.9, κ 0.737, and 3 settled otherwise all match `appraisal-agreement.json`.
- **Figure 5**: marks, labels, dagger, the 4 High / 2 Some concerns legend and the `<desc>` cell counts match `evidence-map.csv`. The first-author and year labels match `study-keys.csv` and the record IDs in the Figure 3 caption.
- **Flow arithmetic**: 189 − 49 = 140; 140 − 80 = 60; 60 − 20 = 40; 40 − 34 = 6. Exclusion reasons 22+8+2+1+1 = 34. Other methods: 10 − 5 = 5; 5 − 1 = 4; 4 − 4 = 0, with reasons 2+2. The abstract's combined figures, 65 sought, 21 not retrieved and 44 assessed, close too. `screening.csv` full-text rows give 21 not retrieved and E1 = 8 at the database stage. The prose, `prisma-flow.json` and the SVG all agree. κ values reconcile with their raw agreements.
- **Who decided what**: gate 3 Q1–Q4, A10–A14 and the four adjudication files agree with §2.7, §3.3 and the conduct disclosure (apart from M1 and M3). That includes the user's A10 rulings on the D5 ratings of Huang and Tunc, the user's A11 ruling on Nikolova's direction, the adjudicator's D1 for Ngo confirmed by A13, and the post-audit restore and ratification. No standing text calls the two codes an open question.
- **Citations**: all nine references resolve and title-match (`checks/citation-verification.md`). Citekeys map to the right record IDs.
- **Numbers against papers**: `checks/number-trace.md` traces 41 of 41. I spot-checked the following against the saved texts, and each holds: Ngo's subscale means and the claim that both arms fell; Anderson's IMI values and its self-description as quasi-experimental under TREND; Nikolova's 0–4 item range against its 4.08 mean, and its group discussion and goal-setting sessions; Liu's interaction F and P; Tunc's three disagreeing tests and change-score inconsistency; and the accepted-manuscript status of `pm-38801680` (its first page says so, though `retrieval.csv` logs `publishedVersion`).
- **Tiers**: all six included studies are tier A. No claim rests on an abstract, and no tier-B quotation appears.
- **Prevalence**: every "most", "nearly every" and "the field" in the review is bounded to the included set or to the protocol's expectation.
- **Gaps**: §3.5, §4.4 and §4.3 bound each absence to the search and convert none into a finding.
- **Disagreement**: the conflicting results (Ngo's external regulation, Tunc's three tests, Huang's favourable conclusion against its null table) are reported as conflicts, not smoothed.
- **κ caveat**: the caveat that two instances of one model are not two people is stated beside both κ figures in the review and in the disclosure. Items 24a, 25 and 26 are `requires-human`.

## The changes that would most improve the review, ranked

1. **Rewrite the abstract's "Two of these codes" sentence (M1)** so that it names Huang and Tunc as the pipeline's recodes and Nikolova's code as the user's gate-3 ruling. The abstract is the part most people read, and at present it attributes the wrong decision to the wrong actor.
2. **State A14's scope (M2)**, meaning which test decides when a composite has both null and non-null tests. Put it in §2.4 and the protocol, flag it for the user's confirmation, and correct the disclosure's "neither changes a value".
3. **Update the conduct disclosure's Audit paragraph (M3)** so that it records the user's post-audit ruling and no longer says the recodes stand unreverted.
