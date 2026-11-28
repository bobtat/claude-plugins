# Critique: review.md (exergames and exercise motivation)

**Critic:** literature-review:review-critic, reading cold · **Date:** 2026-11-28
**Mode:** full artifact set. Checked against `extraction.csv`, `rob.csv`, `evidence-map.csv`, `appraisal-agreement.json`, `prisma-flow.json`, `screening.csv`, `retrieval.csv`, `search-log.md`, `protocol.md` (sections 7, 8, 9, 14), `gate-2.md`, `gate-3.md`, `conduct-disclosure.md`, `prisma-checklist.md`, `synthesis-plan.md`, `checks/citation-verification.md`, the six `appraisals/*.evidence.md` files, the judge and adjudication files for `pm-41628428`, `pm-40567995` and `pm-43021294`, and the text of all five SVGs. I did not edit the review.

**Count:** 2 High · 5 Medium · 8 Low

## What checked clean

- **Citations (charter 1).** All 9 references resolve and title-match (`checks/citation-verification.md`). The 6 study keys map one-to-one to `study-keys.csv`. `nikolova2025effect` rests on an OpenAlex ID plus the publisher page, and §4.2 says it has no DOI. No mismatch.
- **Flow arithmetic (charter 4).** I recomputed it from the files. Databases: 189 − 49 = 140 screened; − 80 = 60 sought; − 20 = 40 assessed; − 34 = 6 included. The exclusion reasons add up: 22 + 8 + 2 + 1 + 1 = 34. Citation searching: 10 − 5 = 5 sought; − 1 = 4 assessed; − 4 (E4 2, E5 2) = 0 included. There are 21 full-text rows marked "not retrieved" in `screening.csv` (20 + 1). The 3 decision-level disagreements in 44 full-text pairs give raw agreement 0.932. Adding the 2 disagreements on exclusion code only gives 5 adjudicated, as §3.1 says. The abstract, §3.1, Figure 1 and `prisma-flow.json` all agree. Every full-text exclusion has a reason and a count.
- **The 3.2 characteristics table and the 3.4 results table** match `extraction.csv` and the evidence files cell by cell: country, population, numbers randomized, platform, comparator, programme, instrument and role, registration, every quoted mean, SD and P value. The computed total of 257 is correct (30 + 65 + 38 + 66 + 33 + 25). The internal inconsistencies §4.2 attributes to the papers are each recorded in the matching evidence file.
- **Tiers (charter 2).** All six studies are tier A, and each claim in the review can be located in an evidence file. I found no tier-C or tier-D finding.
- **Eligibility with-and-without table (§4.1).** Every row is arithmetically right.
- **Risk-of-bias figures.** `rob-traffic-light.svg` and `rob-summary.svg` match `rob.csv` exactly.

---

## High

### H1. The headline counts erase the one clear null result and rest on two recodes the user never ratified (charter 6)

**Where:** Abstract, Results (lines 38–44). §4.1, Interpretation and Sensitivity to risk of bias (lines 504–518). Figure 5.

The abstract says: *"three reported only a total score whose construction or direction the paper does not state, so no direction was coded for them."* §4.1 says: *"With the four trials rated high set aside, two remain: one mixed [@ngo2026effects] and one with no coded direction [@huang2025effects]."*

**What goes wrong.** `pm-40567995` (Huang) has a clear between-group null, and the review hides it under "no coded direction":

- Its between-group P is 0.936 at the end of the programme and 1.000 at follow-up (`extraction.csv`, `motivation_result`).
- Both judges agreed the code `no between-group difference` (`appraisal-agreement.json`, `decided[2]`: `"extracted": "no between-group difference"`).
- Gate 3 told the user the same thing, at line 84: *"its motivation result is 'no between-group difference'"*.
- The orchestrator then recoded it to `other` under A11 without a ruling from the user (`conduct-disclosure.md` lines 75–85).

A null on a total does not depend on which way the total points. P = 0.936 is no difference whatever the score's valence. The reason A11 gives for `other` therefore does not apply to this trial.

The recode matters most in the risk-of-bias sensitivity analysis. Huang is one of only two trials not rated High overall, and a reader of the abstract and §4.1 never learns that its result is null.

The second unratified recode is `pm-43021294`, changed from `favours exergame` to `other`. The disclosure says this *"changed the review's count of trials favouring the exergame arm from three to two"* and *"The user did not rule on these two codes individually and may wish to."* The abstract presents "two" with no such qualification.

**Fix.**
- In the abstract and §4.1, say that one of the three trials without a coded direction (Huang) reported a between-group P of 0.936 at the end of the programme.
- In the sensitivity paragraph, state that the lower-risk evidence is one mixed trial and one trial with no between-group difference.
- Add one clause to the abstract: the favouring count of two rests on two direction recodes the user has not yet ratified, and without them it would be three favouring and one null.
- Alternatively, put both recodes to the user before the review ships.

### H2. Thread 5 says every difference between arms was on an autonomous form of motivation, and the review's own table contradicts it (charter 6)

**Where:** §3.8, paragraph 3 (lines 461–468).

The review says: *"Where subscales are reported, any difference between arms is on intrinsic or identified forms of motivation: interest and enjoyment [@anderson2026gamified], intrinsic motivation to know and to accomplish [@ngo2026effects], identified and intrinsic regulation [@liu2025effects]."*

**What goes wrong.** Ngo's external regulation also differed between arms. It was 23.11 against 18.24 at post-test, P < .001 (`extraction.csv`, `pm-41628428`). §3.4 reports this result itself, and it is the reason Ngo is coded `mixed`. Under protocol §7, higher external regulation counts as favouring the comparator.

The sentence drops the one subscale result that runs in the unfavourable direction. That turns the thread about which constructs move into a cleaner picture than the data support.

**Fix.** Rewrite as: "Where subscales are reported, differences between arms are on intrinsic or identified forms in all three trials. In one of them [@ngo2026effects] the game arm was also higher on external regulation (P < .001), which the protocol counts as unfavourable."

---

## Medium

### M1. The abstract's statement about setting the doubtful trial aside is wrong (charter: with-and-without)

**Where:** Abstract, Results (lines 43–44).

The abstract says: *"Setting the doubtful trial aside changes none of these counts except that two, not three, trials have no coded direction."*

**What goes wrong.** "These counts" includes the abstract's own *"Four trials were rated at high risk of bias overall"*. Without `oa-W7220097264` that becomes 3 of 5, which the §4.1 table itself shows (line 526: *"4 of 6 | 3 of 5"*). The follow-up count also falls from 2 to 1.

**Fix.** Write "…except that two, not three, trials have no coded direction, and three of five, not four of six, are at high risk of bias." Or limit the sentence explicitly to the direction counts.

### M2. A false "only trial" claim in Thread 1 (charter 6)

**Where:** §3.4, last paragraph (lines 388–390).

The review says: *"In the included set, the only trial that favours the exergame arm on more than one subscale is this one."*

**What goes wrong.** Ngo's game arm was higher on two subscales, intrinsic motivation to know and to accomplish, both P < .001 (`extraction.csv`, `pm-41628428`). The sentence is therefore false as written. It also inflates how distinctive the one trial with a no-exercise comparator is.

**Fix.** "…the only trial coded as favouring the exergame arm on more than one subscale with none in the other direction is this one". Alternatively, delete the sentence.

### M3. The with-and-without statements for high-risk trials cover only the direction counts (charter: with-and-without, protocol §9)

**Where:** §4.1, Sensitivity to risk of bias (lines 516–518). §3.4 to §3.7.

The protocol §9 requires: *"conclusions are stated with and without studies rated High overall"*. The review states this only for the direction counts. These conclusions are not restated without the four high-risk trials:

- **Thread 1, no-intervention comparison.** The only trial is High, so no evidence would remain.
- **Thread 2, population.** Only one adult trial (Ngo) and one older-adult trial (Huang) would remain.
- **Thread 4, follow-up.** Only Huang would remain, and its result is null (P 1.000).
- **Certainty table.** Not restated either.

The eligibility side gets a full table. The risk-of-bias side does not.

**Fix.** Add a "Without the four High trials" column to the §4.1 table, covering the same rows as the eligibility column.

### M4. Ngo's results come from an as-treated analysis, and the review never says so (charter 2 and 6)

**Where:** §3.3 (the domain 2 bullet, lines 312–313) and §3.4 (the Ngo row and paragraph).

**What goes wrong.** Ngo is one of the two trials the risk-of-bias sensitivity analysis rests on. Its Tables 2–3 come from an analysis where *"participants were analyzed according to the group they actually participated in, instead of their original randomized groups"* (`pm-41628428.evidence.md`, D2). The modified intention-to-treat table that would check this is in Multimedia Appendix 1, which is *"not in the saved text"*.

Judge 2 rated domain 2 Some concerns but wrote: *"This rating is close to High"* (`pm-41628428.j2.md`). The authors themselves say the switching *"could potentially affect the internal validity … especially for outcomes related to motivation"*. §3.3 describes a domain-2 problem only for Tunç. A reader would take Ngo's results as a randomized comparison.

**Fix.** In §3.3 and beside the Ngo row, say that the reported motivation results are by the arm participants joined after 7 of 66 switched. Say that the authors report the intention-to-treat analysis as consistent, in an appendix this review did not read.

### M5. A gap the review created is reported as a gap in the trials (charter 7)

**Where:** §4.4, For research (lines 583–587).

The review says: *"no included trial reports a registration whose content could be checked against the motivation outcome"*.

**What goes wrong.** Three trials do report a registration (§3.9, the `registration` column of `extraction.csv`). Their content could not be checked because *"No registry was searched"* and *"the content of the registrations is not in the saved texts"* (§3.9). The absence comes from this review's method, but the sentence lists it among absences in the trials and implies research should fix it.

**Fix.** Remove it from the research implications. State it in §4.3 as a limitation of this review: three registrations were cited and none was read.

---

## Low

### L1. Checklist items are marked more generously than the checklist's own definition allows (charter 9)

**Where:** `prisma-checklist.md`, items 13b, 17, 20a, 23b and 23c, all marked `met`.

The checklist defines `met-by-machine` as *"satisfied in substance, by an agent and not a person"*. These items fit that definition:

- **13b.** The `direction` coding was done by agent extractors, judges and an adjudicator.
- **17.** The characteristics were extracted by one agent per study.
- **20a, 23b and 23c.** These were written by the orchestrator, like 23a and 23d, which are marked `met-by-machine`.

Separately, 13f and 20d are marked N/A even though the review runs descriptive sensitivity analyses (§2.6, §4.1).

**Fix.** Mark the five items `met-by-machine`. Mark 13f and 20d `met-by-machine`, pointing to §4.1.

Items 24a, 25 and 26 are correctly `requires-human`. The κ caveat for screening is present in §3.1.

### L2. The κ for risk of bias is quoted without its caveat, and it includes a re-rated pair

**Where:** §3.3 (line 323): *"The judges agreed on 27 of 30 domain ratings (raw agreement 0.9, κ 0.737)."*

The caveat that the judges are two instances of one model appears only in §4.3. Also, one of the 27 agreed pairs (`oa-W7220097264`, domain 5) comes from two fresh agents re-rating after A10. That is disclosed only in `conduct-disclosure.md`.

**Fix.** Add the caveat in that sentence, plus one clause noting the re-rated pair.

### L3. An unsourced prevalence claim in the Background (charter 3)

**Where:** §1 (line 55): *"Exergames … are often proposed as a way to make exercise something people want to do."*

**What goes wrong.** Line 59 says *"no source was consulted for one"*. "Often proposed" is therefore model recall.

**Fix.** "Exergames … are proposed as a way to…", or "The question asks whether…".

### L4. "Both arms' intrinsic scores fell" is overstated

**Where:** §3.4 (lines 356–357): *"in that trial both arms' intrinsic scores fell over the 12 weeks"*.

**What goes wrong.** On IM-to-experience stimulation, the comparator rose from 24.21 to 24.31 (`extraction.csv`, `pm-41628428`).

**Fix.** "…both arms' scores on intrinsic motivation to know and to accomplish fell".

### L5. Anderson's allocation is described as random

**Where:** §3.2 (lines 283–285), *"describing random allocation"*, and the "Randomized" column, *"33 (12, 11 and 10)"*.

**What goes wrong.** The paper says *"a pseudo-randomized procedure constrained to produce approximately equal group sizes"*. It also reports *"following the TREND statement for non-randomized designs"* (`pm-42974341.evidence.md`, D1). It is included under A3 case (b), which the review cites. The wording still says more than the paper does.

**Fix.** "…while describing pseudo-randomized (Anderson) or random (Ngo) allocation". In the table, put "33 allocated (pseudo-randomized)".

### L6. Who re-examined the two direction codes, and how Figure 3 labels user rulings

**Where:** §2.7 (line 199) and Figure 3.

**What goes wrong.** §2.7 says the codes *"were sent back to the judges"*. The disclosure says *"two fresh judge agents per study"*. Figure 3 also marks the two domain-5 cells the user ruled on as "Adjudicated".

**Fix.** Say "fresh judge agents" in §2.7. In the Figure 3 caption, add: "two of the three adjudicated cells were decided by the user (A10)".

### L7. A co-intervention in the doubtful trial is not reported

**Where:** §3.4 (the Nikolova bullet) and §3.8.

**What goes wrong.** The VR arm's sessions included group discussion, goal-setting, content *"reinforcing intrinsic motivation"* and a personal activity plan. None of this is described for the control arm (`oa-W7220097264.evidence.md`, D2). That matters for any reading of its higher composite score. The review mentions only the measurement problems.

**Fix.** Add one clause to the Nikolova bullet.

### L8. Smaller imprecisions in §4.2, §4.4 and §4.3

**Where:** §4.2 (line 535), §4.4 (line 586) and §4.3 (line 570).

- *"a total whose construction is not given"* is too strong for the MSPPA. Its range of 16 to 80 is stated. What is missing is whether the amotivation items are reverse-scored, which §3.8 states correctly. Fix: reuse the §3.8 wording.
- The five reports read as preprints and the one accepted manuscript are not named. `gate-2.md` section 8 said they would be named in the limitations. Fix: name them.

---

## The changes that would most improve the review, ranked

1. **Restore the Huang null and qualify the favouring count (H1).** Rewrite the abstract and §4.1 so that the lower-risk evidence is described as one mixed trial and one with no between-group difference. Say that the count of "two favouring" depends on two recodes the user has not ratified. Alternatively, get the ruling before the review ships.
2. **Correct the two false synthesis sentences (H2, M2).** Ngo's external-regulation result belongs in §3.8. Ngo's two favourable subscales falsify the "only trial" sentence in §3.4.
3. **Complete the with-and-without statements (M1, M3).** Fix the abstract's doubtful-trial sentence. Add a "without High" column to the §4.1 table covering the no-intervention comparison, population, follow-up and certainty.
