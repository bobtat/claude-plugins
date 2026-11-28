# Audit — review.md (exergames and exercise motivation)

**Mode:** full artifact set
**Audited:** 2026-11-28 (pass 1; then the user's ruling and pass 2, recorded below under "After pass 1" and "Pass 2 (second and last)")
**Coverage:** `review.md` against `protocol.md`, `records.csv`, `screening.csv`, `prisma-flow.json`, `appraisals/`, `rob.csv`, `extraction.csv`, `appraisal-agreement.json`, `fulltext/`, `figures/`, `checks/`, `references.bib`. The audit is run by the same pipeline that wrote the review; the critic and the citation verifier are separate agents that did not write it.

## Summary

The mechanical checks are clean: every citation resolves and title-matches, the flow arithmetic closes across prose, figure and data, all 660 quotations check out (643 in the papers they are attributed to, 17 the protocol's own words), and every study-credited number traces to its source. The serious findings are in the synthesis. As first written, the review's headline counts described a trial with a clear null between-group result only as having "no coded direction", and presented a count of two trials favouring the exergame arm without saying that it rests on two direction codes changed during appraisal with no individual ruling from the user. A reader of the abstract alone would have been misled on both points. One sentence in the constructs thread also contradicted the review's own results table. All were corrected in place in pass 1; the two recoded values themselves were not changed by the audit and remain for the user.

## Findings

Source: the critic's report (`critique.md`, 2 High, 5 Medium, 8 Low) merged with the mechanical steps, which produced no finding of their own. Outcome of each is given.

### High

1. **The headline counts hid a null result and rested on two recodes the user has not ruled on** (abstract; §4.1)
   > "three reported only a total score whose construction or direction the paper does not state, so no direction was coded for them"
   `pm-40567995` has between-group P values read as 0.936 and 1.000 and was coded `no between-group difference` by both original judges; `pm-43021294` was first coded `favours exergame`. Both were changed to `other` under A11 by agents after the orchestrator sent them back.
   **Accepted in part; fixed.** The abstract, §2.7 and §4.1 now state the null, state both codings (two favouring as merged; three favouring, one null as first coded), and say the user has not ruled on the two changes. **Not done:** the codes were not reverted. A coded value is a reading and the audit does not write one; the literal wording of A11(a), which the user adopted, gives `other` for both, and four judges and the adjudicator read it so. Whether A11 was meant to reach a null result on a total is the user's to say; it is listed in the conduct disclosure.

2. **§3.8 said every between-arm difference was on an autonomous form of motivation; the review's own §3.4 table shows external regulation also differed in one trial** (§3.8)
   > "Where subscales are reported, any difference between arms is on intrinsic or identified forms of motivation"
   **Accepted; fixed** with the old wording struck through.

### Medium

1. **Abstract's with-and-without sentence was wrong about the high-risk count** (4 of 6 becomes 3 of 5). **Accepted; fixed.**
2. **"The only trial that favours the exergame arm on more than one subscale"** was false (§3.4): `pm-41628428` also has two. **Accepted; fixed** with the retraction visible.
3. **With-and-without statements for high-risk trials covered only the direction counts** (§4.1; protocol §9). **Accepted; fixed:** a column without the four high-risk trials added to the sensitivity table.
4. **`pm-41628428`'s results are analysed by arm joined, not arm allocated, and the review did not say so** (§3.3, §3.4). **Accepted; fixed.** The intention-to-treat table is in an appendix that was not read; said so.
5. **A gap in this review was listed as a gap in the trials** (§4.4: registrations not checkable). **Accepted; fixed:** moved to §4.3.

### Low

1. **Checklist items 13b, 17, 20a, 23b, 23c marked `met` although done by agents.** **Accepted; fixed** (`met-by-machine`). **Rejected in part:** the critic also asked for 13f and 20d to be `met-by-machine`. They stay N/A, as the method's checklist rules give for a narrative synthesis; each row already points to the descriptive with-and-without tables.
2. **κ for risk of bias quoted without the one-model caveat or the re-rated pair** (§3.3). **Accepted; fixed.**
3. **"often proposed" in the Background is unsourced.** **Accepted; fixed.**
4. **"both arms' intrinsic scores fell" overstated** (one intrinsic subscale did not fall in the comparator). **Accepted; fixed.**
5. **`pm-42974341`'s allocation described as random; the paper says pseudo-randomized.** **Accepted; fixed** in the prose. The table's column heading is unchanged and the prose beneath it now qualifies it.
6. **§2.7 said "the judges" where fresh judge agents did the re-examination; Figure 3 labels user rulings "adjudicated".** **Accepted; fixed** in §2.7 and the caption. The figure itself was not redrawn: it draws what `rob.csv` says.
7. **Co-intervention in the doubtful trial's game arm not reported.** **Accepted; fixed.**
8. **"construction is not given" too strong for the MSPPA; preprints not named.** **Accepted; fixed.**

## Mechanical re-check after pass 1's corrections

Run after the corrections, mechanical only: the number trace was re-run over the corrected `review.md` (39 traced, 0 not in source), and the citation keys are unchanged (9 cited, 9 in `references.bib`). **The critic was not run a second time**, so the corrected sentences have not been read cold by an agent that did not write them.

## After pass 1: the user's ruling, 2026-11-28

Pass 1's High 1 left two `direction` codes for the user. The user ruled: `pm-40567995` is restored to `no between-group difference`, with protocol amendment A14 (a between-group test on the I5 instrument that shows no difference is coded `no between-group difference` whatever the construction or valence of the score, because a null result needs no direction); `pm-43021294` stays `other`, ratified under A11 as written. Both were entered in the studies' adjudication files as decided by the user, and `appraisal_merge.py` and `appraisal_check.py` were run again. Nothing else in the coded data changed: `rob.csv` is identical in every rating, and `extraction.csv` differs in one cell. `appraisal-agreement.json` now shows 7 queries raised, 4 changed, 1 kept. The direction counts in `extraction.csv` are favours exergame 2, mixed across subscales 1, no between-group difference 1, other 2.

Brought into line: `evidence-map.csv` and Figure 5 (redrawn by a figure agent from the data file); every direction count in `review.md`, with the earlier wording struck through; `conduct-disclosure.md`; `prisma-checklist.md`; the exports. Figures 3 and 5 now label studies by first author and year, with record IDs in the figure notes, the captions and the data files (`rob-labelled.csv`, `evidence-map.csv`). The statements in pass 1 above that the codes "remain for the user" and that "the user has not ruled" describe the state at pass 1 and are superseded by this section. Files as they stood before are in `checks/superseded/`.

## Pass 2 (second and last), 2026-11-28

Run on the final text, after the ruling was applied. Pass 2 as first recorded above was mechanical only; this replaces it.

- **Quotations**, re-run over the screening, adjudication, appraisal, query and rating files: 660 checked, 643 verified in the papers, 17 the protocol's own words, 0 not found, 0 transplant, 0 uncheckable (`audit-quotes.md`).
- **Numbers**, re-run over `review.md`: 41 traced, 0 not in source, both before and after the critic's corrections (`audit-numbers.md`).
- **Figures**: `check_figure.py` passes on all five; the orchestrator viewed renders of the two that changed.
- **Critic**: `literature-review:review-critic`, reading cold, wrote `critique-2.md`: **0 High, 3 Medium, 7 Low**. It found every count of directions and risk-of-bias ratings, and the flow arithmetic, in agreement with the data files, and no standing text that calls the two codes open.

| # | Finding | Outcome |
|---|---|---|
| M1 | The abstract's "Two of these codes were changed by the pipeline" pointed at the two uncoded trials, one of which (the doubtful trial) was coded by the user's own ruling, and then said one was restored to a null | **Accepted; fixed.** Sentence struck and rewritten to say which code the pipeline changed and which the user ruled on |
| M2 | A14 as stated would code `pm-43021294` as no between-group difference on its final-score test (p 0.13); the rule that yields `other` was stated only in Figure 5's note | **Accepted; fixed by disclosure, not by a rule.** §2.4 and the conduct disclosure now say the protocol has no rule for tests that disagree, that this trial's code rests on the user's ruling by name, and that the scope of A14 is the review's inference; it is listed for the user. Figure 5's note no longer states it as a rule. **Not done:** the protocol was not amended; that is the user's decision |
| M3 | The conduct disclosure's Audit section still said the recodes were not reverted | **Accepted; fixed** |
| L1 | Figure 3's note and description attributed all three marked cells to adjudication; two are user rulings | **Accepted; fixed** in the note and `<desc>`: the mark means the judges differed and the adjudicator or, on escalation, the user settled it. The figure has one mark for both because its data file has one label |
| L2 | §4.1's main paragraph: an orphaned correction marker and an ambiguous "the first trial above" | **Accepted; fixed** |
| L3 | §3.1 "five full-text disagreements" against three in the agreement statistic | **Accepted; fixed** (three decision disagreements, two differences of exclusion code; checked against `screening.csv`) |
| L4 | The control-arm deterioration caveat for `pm-41307454` sat beside motivation scores that did not fall | **Accepted; fixed** |
| L5 | §4.4's adherence statement disagreed with §3.7 and §3.10 | **Accepted; fixed** |
| L6 | Sensitivity-table row "Headset games represented" left out a game seen through a headset but coded as exercise equipment | **Accepted; fixed** (row relabelled by the code) |
| L7 | Checklist items 13c and 16a marked `met` for machine-made displays; the abstract lacked the protocol's statement of what the search probably missed | **Accepted; fixed** |

**Left unread:** the sentences written to correct pass 2's findings were not read by an independent agent. Two passes is the method's limit.

## Mechanical checks (steps 1, 4, 5), as run at pass 1

- **Inventory.** 9 works cited in the text, 9 entries in `references.bib`; every key in the text is in the file and every entry is cited. Near-miss and not-retrieved records are identified by record ID and are not citations.
- **Flow arithmetic**, recomputed from `records.csv` and `screening.csv`: databases 189 (PubMed 83, OpenAlex 106) − 49 duplicates = 140 screened; − 80 excluded (all `automation`) = 60 sought; − 20 not retrieved = 40 assessed; − 34 excluded (E5 22, E1 8, E4 2, E6 1, E9 1) = 6 included. Citation searching: 10 identified, 0 duplicates, 5 excluded at title/abstract, 5 sought, 1 not retrieved, 4 assessed, 4 excluded (E4 2, E5 2), 0 included. Prose, `prisma-flow.json` and the figure agree with the CSVs.
- **Quotations**, re-run over the screening, adjudication, appraisal, query and rating files: 660 checked, 643 verified in the papers, 17 the protocol's own words, 0 not found, 0 transplant, 0 uncheckable (`audit-quotes.md`).
- **Numbers**, re-run: 37 traced, 0 not in source, 0 uncheckable (`audit-numbers.md`). The one computed figure, 257, is 30 + 65 + 38 + 66 + 33 + 25; redone by hand, correct, and the review says it takes the larger stated figure where a paper gives two.
- **Codes and ratings.** `appraisal_check.py` passes without `--derive-overall`. One overall rating recomputed by hand: `pm-40567995` has five domains at Some concerns, so Some concerns; matches.
- **Agreement.** `appraisal_merge.py` re-run: its statistics, `extraction.csv` and the domain rows of `rob.csv` are identical to the files on disk. Every rating in `rob.csv` is either one both judges gave or one an adjudication row decides.
- **First checks.** No `TRANSPLANT` in any report in `checks/readers/`. Three first checks had one quotation not found each (`pm-40567995.e`, `pm-41307454.e`, `oa-W7220097264.j2`); the disclosure says 3 of 18 and 3 quotations, which matches.
- **Doubtful inclusions.** `extraction.csv` marks 0 studies doubtful (the judges' rulings). `prisma-flow.json` still reports 3 screening doubts. The review carries 1 as doubtful by the user's decision and says the judges cleared the other 2.
- **Prevalence sweep.** Eleven hits for the listed words; all bounded to the included set or to the protocol's own expectation, except "often proposed" in §1 (Low 3).
- **Figure audit.** Flow diagram, traffic-light, summary, database contribution and evidence map are all present and placed; six studies are compared in tables, not paragraphs. No forest plot. No figure sizes a mark by an unmeasured quantity. The evidence map and the traffic-light figure match their data files.
- **Tier audit.** All six studies are tier A and every thread says so; no claim rests on an abstract.

## Citation verification

Independent re-verification for the audit (`audit-citations.md`), reproduced:

## Citation verification — review.md (exergames-motivation), 2026-11-28

Independent run. No earlier verification report was consulted. Routes: Crossref (DOI), PubMed esummary (PMID, used as a second route for the five trials), OpenAlex works API plus the publisher page's `citation_*` meta tags (the one entry with no DOI). No request failed, and TLS verification stayed on.

### Per-reference table

| # | Key | Cited as (implied by key and tables) | Identifier | Resolves to | Verdict |
|---|---|---|---|---|---|
| 1 | page2021prisma | Page et al. 2021, PRISMA 2020 | 10.1136/bmj.n71 | "The PRISMA 2020 statement: an updated guideline for reporting systematic reviews", Page, BMJ, 2021-03-29 | ✅ match |
| 2 | campbell2020synthesis | Campbell et al. 2020, SWiM | 10.1136/bmj.l6890 | "Synthesis without meta-analysis (SWiM) in systematic reviews: reporting guideline", Campbell, BMJ, 2020-01-16 | ✅ match |
| 3 | sterne2019rob | Sterne et al. 2019, RoB 2 | 10.1136/bmj.l4898 | "RoB 2: a revised tool for assessing risk of bias in randomised trials", Sterne, BMJ, 2019-08-28 | ✅ match |
| 4 | nikolova2025effect | Nikolova et al. 2025 (study `oa-W7220097264`) | none (OpenAlex W7220097264, publisher page article/view/20) | OpenAlex and the publisher page both give "Effect of a VR Exergame Intervention on Exercise Motivation and Self-Efficacy", Nikolova, Adeyemi, Schneider, Game Nexus 2(2), 2025-04-01. The OpenAlex record has no DOI. Its landing page is the cited URL. ISSN 3115-8668 matches the bib note. | ✅ match (title, first author, year, journal, volume and issue). No DOI or PMID exists, so this is a weaker kind of resolution than rows 1-3 and 5-9. |
| 5 | huang2025effects | Huang et al. 2025 (`pm-40567995`) | 10.3389/fpubh.2025.1498606 | Crossref: "Effects of physical fitness using a Kinect system for pre-frail community-dwelling older adults", Huang, Front Public Health, 2025-06-11. PMID 40567995 returns the same title, first author Huang WY and the same DOI. | ✅ match (two routes agree) |
| 6 | liu2025effects | Liu et al. 2025 (`pm-41307454`) | 10.2196/75777 | Crossref: "Effects of an Immersive Virtual Reality–Based Exercise Intervention on Psychological and Physiological Outcomes in College Students: Randomized Controlled Trial", Liu, JMIR Serious Games, 2025-12-15. PMID 41307454 returns the same title and DOI. | ✅ match (two routes agree) |
| 7 | ngo2026effects | Ngo et al. 2026 (`pm-41628428`) | 10.2196/73732 | Crossref: "Effects of Exergaming Tennis on Players' Tennis Skills and Mental State Compared to Regular Tennis in Adult Players: Quasi-Experimental Study", Ngo, JMIR Serious Games, 2026-02-02. PMID 41628428 agrees. | ✅ match (two routes agree) |
| 8 | anderson2026gamified | Anderson et al. 2026 (`pm-42974341`) | 10.26603/001c.172561 | Crossref: "Gamified Versus Traditional Balance Training: Effects on Balance and Motivation in Collegiate Student-Athletes", Anderson, Int J Sports Phys Ther, 2026-11-01. PMID 42974341 agrees. | ✅ match (two routes agree) |
| 9 | tunc2026rehabilitative | Tunc et al. 2026 (`pm-43021294`) | 10.1186/s13102-026-01981-6 | Crossref: "Rehabilitative game-based exercise integrated into conservative treatment for adolescent idiopathic scoliosis: a pilot randomized controlled trial", Tunc, BMC Sports Sci Med Rehabil, 2026-08-18. PMID 43021294 agrees. | ✅ match (two routes agree) |

### Key reconciliation

- Keys cited in review.md: 9 (page2021prisma, campbell2020synthesis, sterne2019rob, nikolova2025effect, huang2025effects, liu2025effects, ngo2026effects, anderson2026gamified, tunc2026rehabilitative).
- Entries in references.bib: 9, with the same 9 keys.
- Cited but absent from the bib: none.
- In the bib but never cited: none.
- Citations in tables, figure captions and prose all use keys from this set. The `## References` heading at the end is empty in the source, which is expected for pandoc to fill at build time.
- Keys are written as `@key` in table cells (Section 3.2 and 3.4) and in the Figure 3 caption. All of them resolve to bib entries.
- The excluded-report table in 3.1 names records by ID only (`oa-W…`, `pm-…`). It states that none is cited, and none carries a key, so those are outside this check.

### Author and year agreement

- The review states no author names or years apart from the key text. Each key's surname and year agree with the resolved record, taking the first author's family name and the Crossref or OpenAlex publication year. Tunc 2026 is online 2026-08, and Anderson 2026 is 2026-11-01. Liu 2025 is 2025-12-15. Huang 2025 is 2025-06. Nikolova 2025 is 2025-04. Ngo 2026 is 2026-02. Page 2021, Campbell 2020 and Sterne 2019 agree.
- The Figure 3 caption maps `oa-W7220097264`, `pm-40567995`, `pm-41307454`, `pm-41628428`, `pm-42974341` and `pm-43021294` to nikolova, huang, liu, ngo, anderson and tunc. PubMed confirms each PMID belongs to exactly that first author, so no mapping is crossed.
- The review's tables describe populations and countries (for example Nigeria, Taiwan, United States). These are claims about paper contents and were not checked.
- The publisher page's affiliations for Nikolova et al. are Bulgaria, Nigeria and Germany. This was not checked against the review's "Nigeria" entry, because that is a claim about the paper's content.

### Observations (not failures)

- The review describes @ngo2026effects as randomized, under amendment A3, while the resolved title calls it "Quasi-Experimental Study". The review states this itself in 3.2. This is a content question for the claim-checking audit, not a citation mismatch.
- Volume, issue and page fields in the bib were not compared field by field against Crossref. Only title, first author and year were compared.

### Summary of the table

Checked: 9 of 9 cited works resolved with matching titles. Eight carry a DOI. Five of those were also confirmed by PMID, and the ninth (Nikolova) was resolved through OpenAlex and its publisher page. Failed, unresolved or mismatched: none.

This check confirms that each identifier resolves to a record whose title matches the work cited. It does **not** verify any claim about what these works contain, including the review's numbers, directions, risk-of-bias ratings and descriptions of designs. It also does not cover the records the review names only by ID and states are not cited. For the one reference without a DOI (Nikolova et al.), the match rests on an OpenAlex record and the journal's own page, and no DOI, PMID or indexing database confirms it independently. The OpenAlex record and the journal page come from the same publisher metadata, so they do not count as two independent confirmations.


## What this audit did not check

- Whether any claim about a paper's contents is correct. The quote check shows the quoted words are in the paper named, not that the conclusion drawn from them is right.
- Whether the risk-of-bias ratings are right. That is appraisal.
- The 21 reports not retrieved, and the registrations three trials cite.
- One reference (`nikolova2025effect`) has no DOI or PMID; it was matched on an OpenAlex ID and the publisher's page, which share a source.
- Bibliography fields beyond title, first author and year.
- How the figures read to a person. The orchestrator viewed rasterized renders; `check_figure.py` passes on all five.
- The sentences written to correct pass 2's findings, beyond the mechanical re-checks.
