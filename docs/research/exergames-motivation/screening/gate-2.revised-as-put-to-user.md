# Gate 2 — The inclusion set (revised)

**First written:** 2026-11-28 · **Answered by the user:** 2026-11-28 · **Rewritten for the revised set:** 2026-11-28
**Decision on the revised set:** — (awaiting the user) · **Decided by:** —

The user answered the first version of this gate (kept as
`screening/gate-2.as-first-written.md`). The answers changed the inclusion set, so the
work they called for has been done and the revised set is put back to you here.
**Appraisal has not started and will not start until you approve this set.** This run
is attended; nothing below was passed on the orchestrator's own authority.

Every count comes from `prisma-flow.json`, which `screening_stats.py` re-derived from
`records.csv` and `screening.csv` after the re-screening. One screening decision is
now a human decision (`pm-41628428`, section 0); every other one was made by
language-model agents (`decided_by=automation`).

## 0. The user's answers to the first version — decided by the user, 2026-11-28

| Decision | Answer (decided by: user, 2026-11-28) | What was done |
|---|---|---|
| **1.1 Retrieval** | Widen retrieval, then re-screen. Add the open-access-copy route (`fetch_fulltext.py --oa-copies`, new in plugin 0.4.0) to the protocol's information sources and retrieval limitation; run it on the 35 reports not retrieved; screen every newly retrieved report at full text with two independent screeners, the quote check and adjudication; fetch nothing by hand | Amendment **A2** entered in `protocol.md` (sections 1, 3, 6, 14). The route reached **15 of the 35**. All 15 were screened: 1 included, 14 excluded (sections 2–5). **This route was added, and the plugin version changed from 0.3.0 to 0.4.0, after gate 2 of this run was first written; the conduct disclosure will say so** |
| **1.2 Randomization** | Include both borderline trials and let risk of bias carry the weakness. I2 counts as random allocation (a) random allocation after which a minority were reassigned at their own request before the intervention began, and (b) allocation the paper describes as random but made by a constrained or pseudo-randomized procedure; E2 mirrors it. `pm-41628428` is included. `pm-42974341` goes back to two screeners on all criteria. Every other E2 exclusion is checked against the new wording | Amendment **A3** entered. `pm-41628428`: `final=include`, `decided_by=human`. `pm-42974341`: re-screened by two fresh screeners on all criteria — **both included it** (section 3). The other E2 exclusions were checked; none is decided differently (section 6) |
| **1.3 Exergame definition** | The inclusive sentence is adopted: a movement-training system that gives the player a running score for matching target movements is an exergame under I1, whether or not the paper calls it a game. `pm-40567995` and `pm-43021294` stay in; the appraisal judges rule on eligibility again from the full paper | Amendment **A4** entered. Both stay in. The I1 and I3 doubts on `pm-40567995` are settled by A4; its I6 doubt and `pm-43021294`'s I1 doubt remain on their rows |
| **1.4 Amendments** | A1 is ratified. The I4 sentence is adopted: where a paper gives conflicting durations, the schedule in the Methods decides over the Abstract | A1 marked ratified; amendment **A5** entered |

## 1. Decisions needed now

### 1.1 Approve the revised inclusion set: 6 studies

The set is **6 studies from 6 reports**, up from 4. The 20-study cap is not reached, so
nothing needs narrowing and nothing was truncated.

| Record | Report | Programme and comparator | I5 instrument | How it got in | Doubt |
|---|---|---|---|---|---|
| `pm-41307454` | Liu et al. (2025) | VR cycling versus no intervention, college students | BREQ-2 | both screeners | none |
| `pm-40567995` | Huang et al. (2025) | Kinect scored aerobic dance versus the same dance from a video, pre-frail older adults, 8 weeks | BREQ-2 | both screeners; I1 settled by A4 | I6 |
| `pm-43021294` | Tunç et al. (2026) | Game-based balance and core exercise versus conventional, adolescent idiopathic scoliosis | MSPPA | both screeners | I1 |
| `pm-41628428` | Ngo et al. (2026) | Exergaming tennis plus on-court versus on-court training, 12 weeks | Sport Motivation Scale | **the user**, with A3 | none (settled by A3) |
| `pm-42974341` **new** | Anderson et al. (2026) | Wii Fit versus wobble-board balance training versus no training, collegiate athletes, 4 weeks | Intrinsic Motivation Inventory (4 subscales) | both screeners on re-screening under A3 | I6 |
| `oa-W7220097264` **new** | Nikolova et al. (2025), *Game Nexus* | "VR exergame" versus traditional physical activity, 30 adults in Nigeria, eight sessions over two months | BREQ-3 | both screeners; retrieved by the new route | I1 |

Options: **approve** the six and start appraisal; **supply full texts** for any of the
21 reports still not retrieved (section 7) and have them screened first; or change a
decision below. A text you provide is saved as `fulltext/<record_id>.txt`, logged
`route=user`, and screened by two agents like any other.

**Recommendation: approve, after settling 1.2 and 1.3 — and if you can obtain one
paper, make it `pm-42223906`** (Shamsoddini et al., 2026, VR versus conventional
balance training). Both screeners answered include on its abstract, it is in PubMed
with no open-access text, and OpenAlex lists no open-access copy. It is the unread
report most likely to change the set.

### 1.2 Doubtful inclusions: 4 of the 6

More than a tenth of the set, so the criteria should be settled here rather than
carried into appraisal.

| Criterion | Record | The question left open | The sentence that would settle it |
|---|---|---|---|
| **I1** | `oa-W7220097264` | The paper never names the game or the headset and never says body movement is the game input; it describes "VR exergame tasks", "levels, points, and rewards" and "higher-intensity VR exergame tasks that require endurance". Exergame status rests on the authors' label. The adjudicator excluded `oa-W7220200190`, from the same journal, on the same kind of gap (1.3) | Either: *a report that calls its intervention an exergame but does not describe movement of the limbs or trunk as the game's input does not meet I1 on the label alone* (this record goes out under E1); or: *an intervention the paper calls an exergame and describes as exercise performed in the game meets I1 unless the text shows the input is not body movement* (it stays) |
| **I1** | `pm-43021294` | Unchanged from the first version: the games' mechanics are in an appendix that is not in the saved text | No amendment; the appendix would settle it (section 8) |
| **I6** | `oa-W7220097264` | The BREQ-3 has six subscales; the paper reports one composite "Exercise Motivation" score per arm, and a mean of 4.08 on an instrument scored 0–4, so how the composite was built is unclear | *A composite or total score of the I5 instrument, reported for both arms, meets I6; how it was formed is a matter for extraction and D4* |
| **I6** | `pm-42974341` | The IMI was given after training to the two training groups only, not to the no-training control. I6 as written asks for results for the exergame arm and "a non-exergame arm", which the wobble-board arm is. Table 2 gives N=12 for the Wii Fit arm where the text says n=9. Both screeners also noted, under I2, that the paper calls itself quasi-experimental — the case A3 names | *In a trial with several non-exergame arms, results on the I5 instrument for the exergame arm and any one non-exergame arm meet I6* |
| **I6** | `pm-40567995` | One screener: Table 2 gives between-group P values per interval, with no single test labelled as the between-group test | None needed: I6 asks for results by arm, not for a test. Left to extraction |

**Recommendation:** adopt both I6 sentences (they say what I6 already implies, and
both records stay). On the I1 label question I recommend the **second** sentence —
keep `oa-W7220097264`, marked doubtful, and let the two appraisal judges rule on its
eligibility from the full paper, as they must — because the paper does describe
supervised sessions of graded exercise in a headset game, which is more than a label,
and excluding it would rest on what the paper omits. But this is the weaker of the
two new inclusions and you should know why: no named game or hardware, no described
randomization method, 15 per arm, a mean above the instrument's maximum, and a journal
not indexed in PubMed. None of those is an eligibility criterion; all are for risk of
bias and for the synthesis, which will state its conclusions with and without it. If
you would rather not carry it, the first sentence removes it cleanly and the set is 5.

### 1.3 Two things the adjudicator raised on I1

Three second-pass disagreements all turned on I1/E1. The adjudicator decided two and
escalated one, and proposed wording.

- **`pm-42261097` — escalated, exclusion code only.** Khorasani et al., myoelectric
  interface game after stroke (read as its medRxiv preprint). Every arm, the sham arm
  included, steers a cursor by muscle activation sensed by EMG; the IMI is reported
  pooled across arms. **It is excluded under either reading.** Open is the reason
  the flow diagram counts: **E1** if muscle activation without stated limb movement is
  not "movement of limbs or trunk", **E3** if it is (then every arm plays an exergame).
  It is carried as E1, the code the adjudicator cited, only so the arithmetic closes.
  Proposed sentence: *Out under I1: a game whose input is muscle activation sensed by
  EMG, force or torque sensors without required movement of the limb or trunk* — or
  its opposite. **Recommendation: adopt it as written (E1).** I1 defines the game by
  movement, and a cursor driven by isometric activation is closer to the hand-controller
  cases already on the Out list. No other record screened so far uses myoelectric or
  isometric control, so nothing else would need re-checking.
- **`oa-W7220200190` — decided: exclude, E1.** Jafari and Horváthová (2025), mobile
  fitness game app, BREQ-2 reported for both arms. One screener included it; the other
  and the adjudicator read the described mechanics ("track daily activity, nutrition,
  and exercise data through the app", "step-count battles, mini-games, or aerobic
  tasks", points and badges) as the Out case for I1: a fitness app awarding points for
  tracked activity. The adjudicator kept a doubt: a fuller description of the
  mini-games could reverse it. **It is the nearest miss in the set** and turns on the
  same label question as 1.2; under the second sentence there it still stays out,
  because here the text does describe the input, and it is tracking. If you read it
  the other way, say so and it becomes a seventh inclusion decided by you.

### 1.4 The reports still not retrieved

21 reports (20 from the databases, 1 from citation searching) were sought and have
not been read; section 7 names each with what was tried. You may supply any of them.
Otherwise they stay in the flow diagram as not retrieved and the review states that
its answer rests on the reports that could be read.

## 2. Flow counts

| | Databases | Citation searching |
|---|---|---|
| Records identified | PubMed 83, OpenAlex 106 (189) | 10 |
| Duplicates removed before screening | 49 | 0 |
| Records screened at title/abstract | 140 | 10 |
| Excluded at title/abstract | 80 | 5 |
| Reports sought | 60 | 5 |
| **Reports not retrieved** | **20** (was 35) | **1** |
| Reports assessed at full text | 40 (was 25) | 4 |
| Excluded at full text | 34 | 4 |
| Reports included | **6** | 0 |

Full-text exclusions, databases: E5 No named motivation instrument 22; E1 Not an
exergame 8 (one of them provisional between E1 and E3, section 1.3); E4 Under two
weeks 2; E6 No motivation results by arm 1; E9 Not a primary report 1. Citation
searching: E4 Under two weeks 2; E5 No named motivation instrument 2. E2 Not
randomized is now 0 at full text: its one exclusion, `pm-42974341`, was re-screened
under A3 and included.

Studies included: 6, from 6 reports. Records excluded by automation tools: all; by a
human reviewer: 0 (the one human decision is an inclusion).

Of the 15 reports the new route reached: 1 included (`oa-W7220097264`); 14 excluded —
E5 7, E1 5, E4 1, E9 1.

**Citation searching** (backward only, one iteration, same caps). The two newly
included database reports were added as seeds: `oa-W7220097264` (31 references, 6
matching the rule, 3 already in `records.csv`, 3 taken) and `pm-42974341` (32
references, 1 matching, 1 taken). Pass total: 6 seeds, 255 references listed, 10 new
records; the cap of 20 was not reached and no seed was left unprocessed. Of the 4 new
records, 1 was excluded at title/abstract (E3), 3 were sought, 2 retrieved and both
excluded at full text (E5), 1 not retrieved. **The pass added no inclusion.** Forward
searching was not run (protocol).

## 3. Agreement

| Stage | Pairs | Raw agreement | Cohen's κ | Before the re-screening |
|---|---|---|---|---|
| Title/abstract | 150 | 0.967 | 0.935 | 146 pairs, κ 0.933 |
| Full text | 44 | 0.932 | 0.732 | 27 pairs, κ 0.71 |

Both are above the protocol's 0.60 threshold. They are agreement between two instances
of one model, which share training; the number overstates what it would mean between
two people. κ counts agreement on the decision, not on the exclusion code: in two
second-pass records both screeners excluded under different codes (section 4).

For `pm-42974341` the full-text pair now counted is the re-screening pair (include,
include) under amended I2. The first-round pair (exclude E2, exclude E2) is in
`screening/ft-ft3-s1.csv` and `-s2.csv` and is superseded, not deleted. Both sets agree
within themselves, so κ is not flattered by the swap.

No criterion was re-piloted for this pass: the amendments were the user's, and the
second-pass screeners used the amended brief (`screening/brief-fulltext-r2.md`,
`screening/brief-r2.md`). Second-pass doubts cluster on I1 (section 1.2, 1.3).

## 4. Adjudications

First round (`screening/adjudication-main.csv`), unchanged:

| Record | Screeners | Outcome |
|---|---|---|
| `pm-41384807` | exclude E4 / include | **exclude, E4** — Methods and Results say one week; only the Abstract says seven. Now follows from A5 |
| `pm-41628428` | exclude E2 / include | escalated → **included by the user**, with A3 |

Second pass (`screening/adjudication-oa.csv`):

| Record | Screeners | Adjudicator | Reasoning |
|---|---|---|---|
| `oa-W7220200190` | exclude E1 / include | **exclude, E1: Not an exergame** | The app's described mechanics are tracking and logging with points and badges; nowhere is limb or trunk movement the input to a game. Doubt kept: a fuller description could reverse it (section 1.3) |
| `oa-W4413463698` | exclude E1 / exclude E5 | **E1** (code only) | Kinect compares joint coordinates with a reference database; no game, goal or score is described, so A4 does not apply. E5 also applies; the lowest code is cited |
| `pm-42261097` | exclude E3 / exclude E1 | **escalated** (code only) | See 1.3 |

**Pattern:** all three turn on I1/E1 — where "movement as game input" ends
(myoelectric control) and whether an authors' label is enough. Proposed wording is in
1.2 and 1.3.

## 5. Near-misses (PRISMA item 16b)

| Record | What it is | Excluded under | Why |
|---|---|---|---|
| `oa-W7220200190` **new** | Randomized trial of a mobile fitness game app, BREQ-2 for both arms, three months | E1 | Adjudicated: gamified tracking app, movement not shown as game input (1.3) |
| `pm-42261097` **new** | Randomized trial of a myoelectric game after stroke, modified IMI | E1 or E3 | Every arm plays the game; IMI pooled across arms, so E6 would apply too |
| `oa-W4413463698` **new** | Kinect-assisted sports-dance training, reports "motivation" scores | E1 | No game or score described; the motivation measure is unnamed |
| `pm-41384807` | Randomized three-arm exergame trial, IMI interest/enjoyment | E4 | One-week programme |
| `s1-oa-W4403263759` | VR HIIT boxing versus circuit training, crossover, Situational Motivation Scale for both conditions | E4 | One session per condition |
| `pm-41627139` | VR trial using BREQ-2 | E6 | One relative autonomy index score; no comparator-arm result |
| `pm-42247423` | Ring Fit Adventure versus usual activities, 8 weeks | E5 | Motivation was registered and is "reported separately" (section 8) |
| `pm-41032869` | Active video games in schizophrenia | E5 | Only a self-written intention questionnaire |
| `pm-42179992` | VR serious games in depression (title/abstract) | E5 | Motivation on a visual analogue scale, read as a single item |
| `pm-39335412` | Sensor-based balance exergaming (title/abstract) | E5 | Clinician-rated participation scale |

`pm-42974341`, a near-miss in the first version, is now included.

## 6. The check of other E2 exclusions under amended I2/E2

Every record on which either screener cited E2, or mentioned it in a rationale or
doubt, at either stage, was checked against A3's two cases. The check asks only
whether the report describes its allocation as random (constrained or
pseudo-randomized) or as random with a minority reassigned on request; any that could
be would have gone to two screeners. **None could; none was re-screened** other than
`pm-42974341`.

| Record | Stage, code | Allocation as the abstract or text gives it | Under A3 |
|---|---|---|---|
| `oa-W4400747992` | T/A, E2 | "all patients were assigned to the exergame group" — one arm | unchanged |
| `oa-W7201847614` | T/A, E2 | quasi-experimental single-group pre–post pilot | unchanged |
| `pm-39054204` | T/A, E2 | "non-randomised proof-of-concept clinical trial" | unchanged |
| `pm-40627595` | T/A, E2 | "non-randomized controlled trial"; the paper does not describe allocation as random | unchanged |
| `pm-40669044` | T/A, E2 | single-session usability study, one group | unchanged (also E4) |
| `pm-42393428` | T/A, E2 | single-arm feasibility protocol | unchanged (also E6) |
| `s1-oa-W4410002514` | T/A, E1 (one screener E2) | qualitative focus groups, no arms | unchanged |
| `pm-40902721` | T/A, E6 (doubt on E2) | protocol of a "partially randomised" trial, no results | unchanged: excluded as a protocol |
| `pm-41002748` | full text, E1 (E2 noted) | "simple even-odd assignment" — alternation, still on I2's Out list; cognitive-training games | unchanged |
| `s1-oa-W4392652772` | T/A, E4 (doubt on E2) | one test per condition | unchanged |

Two reports screened in the second pass touch the same line and were decided on other
criteria: `s1-oa-W4411350775` (the results preprint of the `pm-40902721` trial:
"partially randomised", with participants who rejected the technology "allocated to
the control group"; excluded E5 by both screeners) and `oa-W7130314881` (randomized by
intact class, quasi-experimental; excluded E1).

## 7. Reports still not retrieved — all 21

**None was excluded on a criterion, and none has been read.** Three routes were tried
for each, by script only: Europe PMC open-access full text (by PMID, or by DOI where
there is no PMID), arXiv (none has an arXiv ID), and — after amendment A2 — the
open-access copies OpenAlex lists, PDF only. For 15 OpenAlex lists no open-access
copy; for 6 it lists one and no PDF could be had from it (a landing page with no PDF,
or the server refused: HTTP 403 or 503); the four refusals were tried twice. Nothing was fetched by hand. The last column
is the two screeners' answers at title/abstract and any doubt; it is not a prediction
of eligibility. Rows 1–20 are database records; row 21 is from citation searching.

| # | Record | Report | Identifier | Routes 1–2 | Route 3 (OpenAlex open-access copies) | At title/abstract |
|---|---|---|---|---|---|---|
| 1 | `pm-39952553` | Hicks J (2025). Is exergaming a viable exercise option for obese black women?. *Contemp Clin Trials* | doi:10.1016/j.cct.2025.107846 · PMID 39952553 | Europe PMC: in PubMed, no open-access PubMed Central text | OpenAlex lists a copy, but no PDF was had from it: www.sciencedirect.com: HTTP Error 403: Forbidden; doi.org: no PDF at the copy; pmc.ncbi.nlm.nih.gov: no PDF at the copy; pmc.ncbi.nlm.nih.gov: no PDF at the copy (tried twice) | unsure / unsure |
| 2 | `oa-W4414250592` | Rasouli Nasim (2024). The effect of Game-Based Interventions on the Learning Disabilities of Primary School Students. *مجله علوم پزشکی رازی* | doi:10.47176/rjms.31.110 | Europe PMC by DOI: no record | OpenAlex lists no open-access copy | unsure / unsure — E8: English abstract but full text language not shown; E5: no motivation instrument listed but secondary outcomes may be unlisted |
| 3 | `oa-W4394692400` | Müberra Tanrıverdi (2024). Video-based exergaming versus conventional rehabilitation on balance in pediatric brain tumor survivors: a randomized clinical trial. *Virtual Reality* | doi:10.1007/s10055-024-00988-z | Europe PMC by DOI: no record | OpenAlex lists a copy, but no PDF was had from it: link.springer.com: no PDF at the copy; doi.org: no PDF at the copy | unsure / unsure |
| 4 | `pm-40983137` | Ozyemisci Taskiran O (2025). The effect of a 12-week tele-exercise using immersive virtual reality on functional capacity in adolescents with cystic fibrosis: A randomized controlled, single (assessor) - blind study. *Respir Med* | doi:10.1016/j.rmed.2025.108362 · PMID 40983137 | Europe PMC: in PubMed, no open-access PubMed Central text | OpenAlex lists no open-access copy | unsure / unsure — I1: is immersive VR exercise an exergame? |
| 5 | `oa-W4413201399` | Agrawal Luckykumar Dwarkadas (2025). Augmenting Conventional Therapy with Non-immersive Virtual Reality to Enhance Balance, Coordination, Motivation, and Functional Performance in Children with Spastic Diplegia Cerebral Palsy: A Single-Blinded Randomized Trial. *Arabian Journal for Science and Engineering* | doi:10.1007/s13369-025-10535-w | Europe PMC by DOI: no record | OpenAlex lists no open-access copy | unsure / unsure |
| 6 | `pm-39069966` | Stephan AT (2024). Older Adults' Perceptions of Cognitive, Physical, and Exergame Training: A Mixed Methods Investigation of a Four-Armed Randomized Controlled Pilot Trial. *Games Health J* | doi:10.1089/g4h.2023.0208 · PMID 39069966 | Europe PMC: in PubMed, no open-access PubMed Central text | OpenAlex lists no open-access copy | unsure / unsure — I5: unnamed feedback items on motivation may not be a named instrument |
| 7 | `pm-42223906` | Shamsoddini A (2026). Impact of virtual reality versus conventional balance training on balance function and fear of falling in older adults: a single blinded, randomized controlled trial. *Eur Geriatr Med* | doi:10.1007/s41999-026-01493-z · PMID 42223906 | Europe PMC: in PubMed, no open-access PubMed Central text | OpenAlex lists no open-access copy | **include / include** |
| 8 | `oa-W7237392436` | مریم شامی (2025). Radiology, Nuclear Medicine and Medical Imaging at the vanguard of artificial intelligence integration: A preliminary study of AI in medical research. *Bushehr University of Medical Sciences Repository (Bushehr University of Medical Sciences)* | no DOI or PMID | no DOI, PMID or arXiv ID, so no PubMed Central or arXiv route | OpenAlex lists no open-access copy | unsure / unsure — I1: does a health video game described as serious/active video game meet the movement-as-input definition? |
| 9 | `oa-W7125699163` | Bulbul Bhajikhaye (2026). COMPARISON BETWEEN THE EFFECT OF EXERGAMING AEROBICS ANDTRADITIONAL AEROBICS EXERCISE PROGRAM ON BODY MASS INDEX,RATE OF PERCEIVED EXERTION, WAIST HIP RATIO AND TOTAL FAT % INGRADE 1 OBESE POPULATION. *Indian journal of physical therapy* | doi:10.63299/ijopt.070192 | Europe PMC by DOI: no record | OpenAlex lists no open-access copy | unsure / unsure — E5: abstract lists outcomes without a motivation instrument; unlisted outcome possible |
| 10 | `pm-42583323` | Singh I (2026). Effectiveness of Computer-based Exergaming on Upper Limb Motor Function, Functional Independence, and Quality of Life in Individuals with Spinal Cord Injury: A Randomized Control Trial. *Top Spinal Cord Inj Rehabil* | doi:10.46292/sci25-00098 · PMID 42583323 | Europe PMC: in PubMed, no open-access PubMed Central text | OpenAlex lists a copy, but no PDF was had from it: pmc.ncbi.nlm.nih.gov: HTTP Error 403: Forbidden (tried twice) | unsure / unsure — E5: abstract lists motor and QOL outcomes only; unlisted motivation outcome possible |
| 11 | `pm-42551496` | Ali MS (2026). Effects of Virtual Reality Versus Whole-Body Vibration on Muscle Strength and Balance in Children with Duchenne Muscular Dystrophy: a Randomized Controlled Trial. *NeuroRehabilitation* | doi:10.1177/10538135261473293 · PMID 42551496 | Europe PMC: in PubMed, no open-access PubMed Central text | OpenAlex lists no open-access copy | unsure / unsure — E5: abstract lists outcomes without a motivation instrument; unlisted secondary outcomes possible |
| 12 | `oa-W7213433529` | Senthil Kumaran D (2025). ROLE OF BIOMIMETIC CONTROL MECHANISMS IN GAME-BASED REHABILITATION ON UPPER LIMB MOTOR FUNCTION IN PATIENTS WITH STROKE: A PILOT RANDOMIZED CONTROLLED TRIAL PROVIDE HIGH REPETITION MOTIVATION & ENGAGEMENT. *no venue recorded* | doi:10.13140/rg.2.2.23549.12000 | Europe PMC by DOI: no record | OpenAlex lists no open-access copy | unsure / unsure |
| 13 | `oa-W7220702081` | Ruhollah Solat (2026). Designing and evaluating the effect of a motivational VR game-based intervention on metabolic management in children and adolescents diagnosed with diabetes. *Rooyesh Psychological Journal* | doi:10.66224/rooyesh.15.5.21 | Europe PMC by DOI: no record | OpenAlex lists a copy, but no PDF was had from it: frooyesh.ir: HTTP Error 503: Service Unavailable; doi.org: connection reset (tried twice) | unsure / unsure — I1: unclear whether VR shooting game is driven by limb or trunk movement |
| 14 | `oa-W4416431672` | Saima Bibi (2025). Virtual Reality-Based Exercises Versus Manual Physiotherapy for Post-ACL Reconstruction Rehabilitation: A Randomized Controlled Trial. *The Healer Journal of Physiotherapy and Rehabilitation Sciences* | doi:10.55735/tjvxqq39 | Europe PMC by DOI: no record | OpenAlex lists a copy, but no PDF was had from it: thehealerjournal.com: HTTP Error 403: Forbidden; doi.org: HTTP Error 403: Forbidden (tried twice) | unsure / unsure — I1: is the VR-based exercise a game with a goal or score? |
| 15 | `oa-W4415152829` | Andrea Ribeiro (2025). Wii™ e prevenção de quedas: Uma abordagem para melhorar o equilíbrio em pessoas idosas – estudo-piloto. *TER ISAVE* | doi:10.71399/hcagkw98 | Europe PMC by DOI: no record | OpenAlex lists a copy, but no PDF was had from it: ter.isave.pt: no PDF at the copy; doi.org: no PDF at the copy | unsure / unsure — E8: English abstract but Portuguese title; is the full text English? |
| 16 | `pm-42857931` | Şen Tekin Ş (2026). The effect of video-based games on upper extremity function and activity participation in children with hemiparetic cerebral palsy. *Dev Neurorehabil* | doi:10.1080/17518423.2026.2738676 · PMID 42857931 | Europe PMC: in PubMed, no open-access PubMed Central text | OpenAlex lists no open-access copy | unsure / unsure |
| 17 | `oa-W4402875116` | İlknur Münevver Gönenç (2024). Examination of the effect of different techniques (demonstration, telesimulation and game-based training) in teaching the management of shoulder dystocia: A randomized controlled trial. *Clinical Simulation in Nursing* | doi:10.1016/j.ecns.2024.101611 | Europe PMC by DOI: no record | OpenAlex lists no open-access copy | unsure / exclude — E1: game-based training in simulation education is probably not an exergame but title alone does not show it |
| 18 | `pm-41990569` | Yavaş S (2026). The effect of video game-based exercises on selective motor control, balance, fear of falling, and functional capacity in individuals with spastic cerebral palsy: A randomized controlled trial. *Res Dev Disabil* | doi:10.1016/j.ridd.2026.105292 · PMID 41990569 | Europe PMC: in PubMed, no open-access PubMed Central text | OpenAlex lists no open-access copy | unsure / unsure — I5: is the Satisfaction Questionnaire or any other tool a motivation instrument? |
| 19 | `pm-41664928` | Hassan Bakri AA (2026). Effect of fully immersive virtual reality on daily pain, functional mobility, and health-related quality of life in pediatric sickle cell disease: a single-blinded randomized clinical trial. *Disabil Rehabil* | doi:10.1080/09638288.2026.2625551 · PMID 41664928 | Europe PMC: in PubMed, no open-access PubMed Central text | OpenAlex lists no open-access copy | unsure / unsure — I1: VR used for pain management may not involve movement as game input |
| 20 | `oa-W4408275182` | Simone Burin-Chu (2025). Effets d’un dispositif de réalité virtuelle immersive sur la rééducation du membre supérieur chez des enfants et adolescents atteints de paralysie cérébrale : un essai contrôlé randomisé. *Kinésithérapie la Revue* | doi:10.1016/j.kine.2024.12.110 | Europe PMC by DOI: no record | OpenAlex lists no open-access copy | unsure / unsure — E8: French title suggests full text may not be English but this is not shown |
| 21 | `s1-oa-W4401613739` | Jih‐Hsuan Tammy Lin (2025). Let us sweat it out in virtual reality: The effects of virtual reality exercise contexts on physical activity outcomes through social presence and audience responses. *Psychology of Popular Media* | doi:10.1037/ppm0000543 | no PMID or arXiv ID, so no PubMed Central or arXiv route | OpenAlex lists no open-access copy | unsure / unsure |

As in the first version: row 8 (`oa-W7237392436`) carries a title that appears
unrelated to the abstract OpenAlex holds for it, and row 17 (`oa-W4402875116`) is
probably not an exergame study; they stay because nothing but a full text can exclude
them.

## 8. Known limits — not decisions

- **Reports read as preprints.** **No included report was read as a preprint**: the six
  were read from Europe PMC (5) or a `publishedVersion` PDF (`oa-W7220097264`). Five
  *excluded* reports were read from a copy the retrieval log marks `submittedVersion`,
  which may differ from the paper of record: `oa-W4413422558` (HAL; excluded E4),
  `pm-42261097` (medRxiv; E1/E3), `oa-W4395005416` (OSF; E1), `oa-W7164739728`
  (logged `submittedVersion`, though the text is laid out as a journal article; E5)
  and `s1-oa-W4411350775` (Research Square; the record itself is the preprint; E5).
  One more, `pm-38801680` (E5), is logged `publishedVersion` but its own first page
  calls it the author's accepted version, not fully edited. Each exclusion rests on a
  design feature or on the outcomes measured, not on a number, but a published version
  could in principle report an instrument the preprint lacks. This goes in the
  review's limitations with the records named.
- **Text from PDFs is rougher.** The 16 texts from the third route were converted with
  `pdftotext`; screeners were told to quote within a paragraph, and every quotation
  verified.
- **A deciding appendix was not in the saved text** for two reports: `pm-39024000`
  (excluded under E5) and `pm-43021294` (included; its game mechanics are in
  Appendix 2). Each decision was made without the appendix. If you can supply either,
  the record is re-checked.
- **`pm-42247423`** (Ring Fit Adventure versus usual activities; excluded under E5)
  registered "sports motivation" as an outcome and says the remaining outcomes "will
  be reported separately". It does not name that report, and none was in the search
  results or the reference lists searched. A trial that would otherwise be eligible
  may have motivation results this review has not found.
- **Both screeners read part of one text.** `s1-oa-W4405428558` is 793 lines; each
  screener read the first 394 (through the Discussion) and reported the rest as
  references. Both excluded it under E5.
- **`oa-W7220097264` and `oa-W7220200190` are from the same journal** (*Game Nexus*),
  not indexed in PubMed; OpenAlex holds no DOI for either. One is in, one is out, on
  what each text says about its intervention (1.2, 1.3).
- **OpenAlex stemming, full-text volume, citation cap:** as in the first version
  (`search-log.md`). The citation-search cap of 20 now has 10 used.
- **Plugin version.** The run began under plugin 0.3.0 and continued under 0.4.0; the
  third retrieval route exists only in 0.4.0 and was added after this gate was first
  written. Records retrieved by it were screened under the amended criteria only.
- Nothing in any abstract or full text read as an instruction to the screeners.

## 9. The quotation check

**136 quotations** in the 22 surviving full-text screening files and the two
adjudication files were checked against the 44 saved texts: **136 verified, 0 not
found, 0 transplanted, 0 uncheckable.** Report: `checks/quote-check-screening.md` (the
first version's report, 75 of 75, is kept as
`screening/quote-check-screening.before-gate2-answers.md`). Each screener's file
passed before its decisions were compared with the other's.

**No batch failed the quote check. One file was replaced for another reason:** the
second screener's file for batch ft8 was not valid CSV (unquoted commas in the doubt
column), so the checker could not read it. It was moved to
`screening/rejected/ft-ft8-s2.malformed-csv.csv` and the batch re-run with a fresh
screener, same brief and records, whose file passed (8 of 8). The replacement differed
from the rejected file on one record (`oa-W7220200190`: include, where the rejected
file had exclude E1); that record went to the adjudicator. κ is computed on the
replacement.

Every saved text passed the title check before it was saved.

## 10. Reports grouped as one study

None among the included reports: 6 reports, 6 studies.

`pm-40321768` and `pm-40682190` (preprint and published version; both excluded at
title/abstract under E3) are as in the first version. `pm-40902721` (a trial protocol,
excluded at title/abstract) and `s1-oa-W4411350775` (the same trial's results
preprint, excluded at full text) are two reports of one study; neither is included.

## To resume

Reply with: approve the six, or name what to change; your choice of the I1 label
sentence for `oa-W7220097264` (1.2); adopt or not the two I6 sentences (1.2) and the
myoelectric sentence, which fixes `pm-42261097` as E1 or E3 (1.3); and any full texts
you can supply (section 7, `pm-42223906` first, and the two appendices in section 8).
Each sentence you adopt is entered in protocol section 14 as approved by you; any
individual decision you make or change is recorded as `decided_by=human`, and the
flow counts are re-derived before appraisal starts.
