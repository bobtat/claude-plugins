---
title: "Exergame programmes and exercise motivation in randomized trials published since 2024: a systematic review"
date: 2026-11-28
---

**Compiled:** 2026-11-28 · **Last revised:** 2026-11-28

| Date | Change |
|---|---|
| 2026-11-28 | Compiled. |

> **This review was conducted by an automated agent pipeline.** Searching, screening,
> data extraction and risk-of-bias assessment were done by language-model agents. A
> person (the user who commissioned it) approved the protocol and the inclusion set and
> ruled on the questions the agents escalated. No second human screened any record.
> `conduct-disclosure.md` says what was automated and what a person must still do.

## Abstract

**Background.** "Exercise video games and motivation" is a topic and not a question. The
question this review answers, approved by the user before any searching, is narrower:
in randomized trials first reported from 2024 onward, does an exergame programme of two
weeks or more change motivation for exercise, on a named multi-item instrument, against
an arm with no exergame, and how far can that evidence be trusted?

**Methods.** PubMed and OpenAlex were searched on 2026-11-28, with one pass of backward
citation searching. Two agents screened every record independently at title and
abstract and at full text. Full texts were retrieved by open-access routes only. Each
included trial was extracted by one agent and its risk of bias rated with RoB 2 by two
agents independently, with an adjudicator for disagreements. The synthesis is
narrative, following SWiM; no meta-analysis was run.

**Results.** 189 database records and 10 from citation searching were identified; 140
and 10 were screened; 65 reports were sought and 21 could not be retrieved; 44 were
assessed in full text; 6 trials (6 reports) were included. One of the six is kept
marked as of doubtful eligibility by the user's decision. Four trials were rated at
high risk of bias overall and two at some concerns; none was rated low in any domain.
By each trial's own between-group test at the end of the programme, two trials favoured
the exergame arm (one against no intervention, one against conventional training on one
of four subscales), one was mixed across subscales, and three reported only a total
score whose construction or direction the paper does not state, so no direction was
coded for them. Both trials coded as favouring the exergame arm are rated at high risk
of bias. Setting the doubtful trial aside changes none of these counts except that
two, not three, trials have no coded direction.

**Conclusion.** The included trials do not show whether exergame programmes change
exercise motivation. Certainty is very low. The answer rests on six small open-access
trials; 21 reports that might have been eligible could not be read.

**Registration.** Not registered. **Funding and interests.** To be declared by the
person responsible for the review.

## 1. Background and objectives

Exergames, video games played by moving the body, are often proposed as a way to make
exercise something people want to do. Whether they do is an empirical question about
motivation, and motivation is measured in many ways: as enjoyment, as attendance, as a
single rating, or with multi-item instruments built on a theory of motivation. This
review makes no claim about what is already known; no source was consulted for one.

**Objective.** In randomized controlled trials whose first results report was published
on or after 2024-01-01, does an exergame programme lasting two weeks or more change
participants' motivation for exercise, measured with a named multi-item motivation
instrument, compared with an arm that has no exergame, and how much can that evidence
be trusted?

The user asked "What is the current state of exercise video games and motivation?" and
approved the question above as its operational form at the first gate. What that
narrowing leaves out is stated in section 4.3. It is not a map of the field.

## 2. Methods

The protocol (`protocol.md`) was written and approved before any search ran. This
section summarizes it. Reporting follows PRISMA 2020 [@page2021prisma] and, for the
synthesis, SWiM [@campbell2020synthesis].

### 2.1 Eligibility

Framework: PICOS. A report was included if it met all of these, and excluded under the
mirror code (E1 to E8) of the lowest-numbered criterion it failed, or E9 if it was not
a primary report.

| Code | Criterion |
|---|---|
| I1 | At least one arm receives an exergame: a digital game in which the player's movement of limbs or trunk is the game input and the game has a goal or score |
| I2 | Participants or clusters were allocated to arms at random |
| I3 | At least one arm receives no exergame |
| I4 | The exergame arm was scheduled to last two weeks or more |
| I5 | Motivation for exercise, physical activity or the training activity was measured with a named multi-item self-report instrument or subscale |
| I6 | Results on that instrument are given for the exergame arm and a non-exergame arm after baseline |
| I7 | The trial's first results report was published on or after 2024-01-01 |
| I8 | The full text is in English |

Enjoyment measured alone, single-item ratings, adherence and interviews do not meet
I5. Trials comparing one exergame with another are excluded (E3). Need-satisfaction
scales and the interest/enjoyment subscale of the Intrinsic Motivation Inventory count
as motivation measures. The full cases on each side of every line are in `protocol.md`
section 2. Studies were grouped for synthesis by comparator, population, platform and
instrument.

### 2.2 Sources and search

| Source | Interface | Last searched | Matched | Retrieved |
|---|---|---|---|---|
| PubMed | NCBI E-utilities | 2026-11-28 | 83 | 83 |
| OpenAlex | REST API, keyless | 2026-11-28 | 106 | 106 |
| Reference lists of included reports | OpenAlex `referenced_works` | 2026-11-28 | 255 references listed, 10 new records taken | 10 |

Each string combines an exergame block, a motivation block and a randomized-design
block, limited to 2024-01-01 through 2026-11-28. The literal strings are in
`protocol.md` section 4 and, as run, in `search-log.md`. OpenAlex applied stemming of
its own, so its matching may be somewhat broader than the written string. Backward
citation searching ran for one iteration from the six included reports, keeping
references dated 2024 or later whose title carried an exergame term, at most 15 per
seed. Forward citation searching was not run. PsycINFO, SPORTDiscus, Scopus, Web of
Science, Embase, CINAHL, trial registries and grey literature were not searched.

### 2.3 Selection

Two screener agents, given identical inputs and no access to each other's decisions,
screened every record at title and abstract and every retrieved report at full text.
At title and abstract a record advanced if either screener answered include or unsure.
Full-text disagreements went to an adjudicator agent, which decided from the saved
text or escalated to the user. Every quotation a screener gave was checked by script
against the saved text before its decisions were compared with the other's.

Full texts were fetched by script from three open-access routes only: Europe PMC,
arXiv, and (added after the second gate, amendment A2) open-access PDF copies listed
by OpenAlex. A report that could not be fetched is counted as not retrieved, never as
excluded on a criterion.

### 2.4 Data collection and data items

One extractor agent per study read the saved full text and recorded coded values from
the protocol's lists, and quoted, located numbers. It made no judgments. Two judge
agents per study, independent of each other, could query any extracted value; an
adjudicator settled queries from the paper's text. The primary outcome was motivation
at the end of the intervention, exergame arm against non-exergame arm, on the
instrument meeting I5; secondary outcomes were the same at any later follow-up, and
adherence. Other items are defined in `protocol.md` section 7.

`direction` records each trial's own between-group test at the end of the
intervention, coded from the reported test and not from the authors' conclusion. It is
not an effect size. A code of `other` here means the trial reported only a total or
composite score and the paper does not state how it is formed in a way that fixes its
direction (amendment A11), so no direction is coded and the quoted result is reported
instead.

### 2.5 Risk of bias

RoB 2 [@sterne2019rob], applied to the motivation outcome at the end of the
intervention, for the effect of assignment. The protocol fixes anchors for each domain
(`protocol.md` section 8). Two judge agents rated every domain independently; an
adjudicator decided ratings they gave differently, or escalated to the user where the
anchor supported both. The overall rating is the worst domain, derived by script.
Because motivation is self-reported by participants who know their arm, the protocol
expected domain 4 to be some concerns at best for nearly every trial.

### 2.6 Synthesis, reporting bias and certainty

Narrative synthesis by thread; no meta-analysis, because the trials use different
instruments and subscales in different populations and extraction was by machine.
There is therefore no effect measure, no pooled estimate, no heterogeneity statistic
and no forest plot. Directions are tabulated as counts with the risk-of-bias rating
beside them. Counting directions is a weak method: it weights a trial of 25 the same as
a trial of 66, and it is labelled as such where used.

Conclusions are stated with and without trials rated high overall, and with and
without the trial of doubtful eligibility. Reporting bias was assessed only through
domain 5 of RoB 2; no registry was searched. Certainty was rated per outcome with
GRADE. Every included study is tier A (full text read); no claim below rests on an
abstract.

### 2.7 Amendments to the protocol

All thirteen are dated 2026-11-28, and are in `protocol.md` section 14 with reasons.

| # | Change | Approved |
|---|---|---|
| A1 | E5 may be cited at title and abstract only when the abstract itself shows there is no eligible instrument | Made by the pipeline during calibration; ratified by the user at gate 2 |
| A2 | A third full-text route: open-access PDF copies listed by OpenAlex | User, gate 2 |
| A3 | Random allocation followed by reassignment of a minority at their own request, and allocation described as random but constrained or pseudo-randomized, count as randomized; the weakness is carried by risk of bias | User, gate 2 |
| A4 | A movement-training system that scores the player against target movements is an exergame | User, gate 2 |
| A5 | Where a paper gives conflicting durations, the Methods decide | User, gate 2 |
| A6 | An intervention the paper calls an exergame and describes as exercise in the game meets I1 unless the text shows the input is not body movement | User, revised gate 2 |
| A7 | A composite or total score reported for both arms meets I6 | User, revised gate 2 |
| A8 | Results for the exergame arm and any one non-exergame arm meet I6 | User, revised gate 2 |
| A9 | A game whose input is muscle activation without required movement is not an exergame | User, revised gate 2 |
| A10 | Reporting only a total of an instrument whose subscales the Methods name is some concerns under domain 5, not high, unless a registration named the subscales; how the total was formed is rated under domain 4 | User, gate 3 |
| A11 | A composite decides `direction` only when the paper states how it is formed and its valence follows; otherwise `other`. A time × group interaction counts as the end-of-intervention between-group test when no separate test is reported | User, gate 3 |
| A12 | When an exercise machine is the game input and the game is seen in a headset, the platform is `exercise equipment with game` | User, gate 3 |
| A13 | Reassignment at participants' request is rated under domain 2; domain 1 carries a constrained or pseudo-randomized procedure | User, gate 3 |

Two consequences of the gate 3 amendments went beyond the items the user ruled on, and
are stated here and in the conduct disclosure. Under A10, the domain 5 rating both
judges had given `oa-W7220097264` (high) was sent back and re-rated, as the user
instructed. Under A11, the `direction` codes of two other trials that report only a
total score (`pm-40567995`, `pm-43021294`) were sent back to the judges by the
pipeline, without a specific instruction from the user, so that the three such trials
would be treated alike; all four judges queried the code and the adjudicator changed
both to `other`.

## 3. Results

### 3.1 Study selection

The database searches identified 189 records (PubMed 83, OpenAlex 106). After 49
duplicates were removed, 140 were screened at title and abstract and 80 excluded, all
by automation tools and none by a human reviewer. 60 reports were sought; 20 could not
be retrieved; 40 were assessed in full text and 34 excluded: 22 for no named motivation
instrument (E5), 8 for no exergame (E1), 2 for a programme under two weeks (E4), 1 for
no motivation results by arm (E6) and 1 that was not a primary report (E9).

Citation searching identified 10 further records. None was removed before screening; 5
were excluded at title and abstract; 5 were sought, 1 was not retrieved, 4 were
assessed and all 4 excluded (E4: 2; E5: 2).

Six studies, from six reports, were included, all from the database search.

![PRISMA 2020 flow diagram](figures/prisma-flow.svg)

**Figure 1.** Study selection. Generated from `prisma-flow.json`, which is derived by
script from `records.csv` and `screening.csv`, 2026-11-28. Template: PRISMA 2020 v2
(databases and registers, plus other methods). The template has no box for records
from other methods screened at title and abstract: of the 10 identified by citation
searching, none was removed before screening and 5 were excluded there before 5 were
sought. \* Consider, if feasible to do so, reporting the number of records identified
from each database or register searched (rather than the total number across all
databases/registers). \*\* If automation tools were used, indicate how many records
were excluded by a human and how many were excluded by automation tools.

![Records by source](figures/database-contribution.svg)

**Figure 2.** Records contributed by each source. Generated from `records.csv`,
2026-11-28.

Agreement between the two screeners: at title and abstract, 150 pairs, raw agreement
0.967, Cohen's κ 0.935; at full text, 44 pairs, raw agreement 0.932, κ 0.732. These
are two instances of one model; the number overstates what it would mean between two
people. Five full-text disagreements went to the adjudicator: it decided three and
escalated two to the user. Two screening decisions were made by the
user: the inclusion of `pm-41628428` (random allocation with seven participants
reassigned at their request; amendment A3) and the exclusion code of `pm-42261097`
(amendment A9).

**Reports not retrieved (21).** None was excluded on a criterion and none was read.
They are listed by name in `gate-2.md` section 7. Both screeners answered "include"
for one of them at title and abstract (`pm-42223906`); for the rest at least one
answered "unsure".

**Excluded reports that might appear eligible (item 16b).** Identified here by record
ID; none is cited, because none was put through citation verification.

| Record | What it is | Excluded under | Why |
|---|---|---|---|
| `oa-W7220200190` | Randomized trial of a mobile fitness game app with BREQ-2 in both arms | E1 | Adjudicated: a gamified tracking app; movement is not shown to be the game input |
| `pm-42261097` | Randomized trial of a myoelectric game after stroke | E1 | By the user's ruling (A9): input is muscle activation. Read as a preprint |
| `oa-W4413463698` | Kinect-assisted dance training reporting "motivation" scores | E1 | No game, goal or score described |
| `pm-41384807` | Three-arm randomized exergame trial with the IMI | E4 | One-week programme by its Methods (A5) |
| `s1-oa-W4403263759` | VR boxing against circuit training, crossover, Situational Motivation Scale | E4 | One session per condition |
| `pm-41627139` | VR trial using BREQ-2 | E6 | No comparator-arm result on the instrument |
| `pm-42247423` | Ring Fit Adventure against usual activities, 8 weeks | E5 | Motivation was registered as an outcome and is to be "reported separately"; that report was not found |
| `pm-41032869` | Active video games in schizophrenia | E5 | Only a self-written intention questionnaire |

### 3.2 Study characteristics

Built from `extraction.csv`. All six were read in full text (tier A). Numbers
randomized are as each paper states them.

| Study | Country | Population | Randomized | Exergame (platform code) | Comparator | Programme | Instrument (role) | Registration |
|---|---|---|---|---|---|---|---|---|
| @nikolova2025effect † | Nigeria | Healthy adults aged 18 to 35 | 30 (15 and 15) | Unnamed "VR exergame" (immersive vr headset) | "Traditional physical activity without VR", not described | Eight sessions over two months | BREQ-3, one composite score (unspecified) | None reported |
| @huang2025effects | Taiwan | Pre-frail older adults | 65 randomized, 60 finished (30 and 30) | Kinect aerobic dance system that scores movements (console or camera motion game) | The same dance by video at home | 8 weeks, 3 sessions a week | BREQ-2, one score (secondary) | ClinicalTrials.gov NCT06216236 |
| @liu2025effects | United States | College students aged 18 to 35 | 38 in the participant flow; the abstract says 36 | VirZoom exercise bike with PlayStation VR (exercise equipment with game) | No intervention | 4 weeks, twice weekly | BREQ-2, five subscales (unspecified) | ClinicalTrials.gov NCT06902727 |
| @ngo2026effects | Malaysia | Adult novice tennis players | 66 (33 and 33); 7 changed arm at their request before the start | Virtual Tennis on PlayStation 3 Move, one of two weekly sessions (console or camera motion game) | On-court tennis for both weekly sessions | 12 weeks | Sport Motivation Scale, seven subscales (unspecified) | Not preregistered |
| @anderson2026gamified | Not reported | Collegiate student-athletes | 33 (12, 11 and 10) | Wii Fit Plus balance games (console or camera motion game) | Wobble-board balance training; a no-training arm that was not given the instrument | 4 weeks, 12 sessions | IMI, four subscales, after training only (unspecified) | None reported |
| @tunc2026rehabilitative | Turkey | Adolescents aged 10 to 14 with idiopathic scoliosis | 25 (12 and 13) | BeCure balance-board and camera pose games within conventional treatment (other) | Conventional exercises | 24 weeks; games from week 5 | MSPPA total (secondary) | ClinicalTrials.gov NCT06469021 |

† Kept marked as of doubtful eligibility on I1 by the user's decision (section 3.8).

The six trials randomized [computed: 257] participants between them, taking each
paper's larger stated figure where it gives two. Four describe healthy adults, three of
them students or student-athletes. Two papers call themselves quasi-experimental while
describing random allocation [@ngo2026effects; @anderson2026gamified]; both are
included under amendment A3.

### 3.3 Risk of bias

![Risk-of-bias traffic-light plot](figures/rob-traffic-light.svg)

**Figure 3.** RoB 2 judgments per study and domain. Generated from `rob.csv`,
2026-11-28. Rows are labelled by study ID: `oa-W7220097264` is @nikolova2025effect,
`pm-40567995` @huang2025effects, `pm-41307454` @liu2025effects, `pm-41628428`
@ngo2026effects, `pm-42974341` @anderson2026gamified, `pm-43021294`
@tunc2026rehabilitative. The Overall column is derived as the worst domain.

![Risk-of-bias summary](figures/rob-summary.svg)

**Figure 4.** Number of studies at each judgment, per domain. Generated from `rob.csv`,
2026-11-28.

Four of the six trials are rated high overall and two some concerns
[@huang2025effects; @ngo2026effects]. No trial was rated low in any domain.

- **Missing outcome data (domain 3)** is the most common reason for a high rating:
  three trials. In each, the exergame arm lost more participants than the comparator
  and the analysis was of completers [@liu2025effects; @anderson2026gamified;
  @tunc2026rehabilitative].
- **Randomization (domain 1)** is high for one trial, whose paper states that
  allocation was not concealed and that one investigator enrolled and assigned
  participants [@anderson2026gamified].
- **Deviations (domain 2)** is high for one trial, which reports only a per-protocol
  analysis that dropped participants for low adherence [@tunc2026rehabilitative].
- **Measurement (domain 4)** is some concerns for five trials, as the protocol
  expected for a self-reported outcome in unblinded participants. It is high for one,
  whose single motivation score is of unstated construction and has a mean above the
  maximum of the items as described [@nikolova2025effect].
- **Selection of the reported result (domain 5)** is some concerns for all six. None
  shows a registration dated before enrolment that names the instrument and time
  point. Three report only a total score for an instrument whose subscales their
  Methods name; under amendment A10 that is some concerns and not high.

The judges agreed on 27 of 30 domain ratings (raw agreement 0.9, κ 0.737). Three were
settled otherwise: one by the adjudicator and confirmed by the user's amendment A13
(`pm-41628428`, domain 1), and two by the user's ruling under A10 (`pm-40567995` and
`pm-43021294`, domain 5). The domain 5 rating of `oa-W7220097264` was re-rated by two
fresh agents after A10 and both gave some concerns; its overall rating stays high
because of domain 4. The ruling under A10 decides one overall rating: `pm-40567995`
would be high overall had its domain 5 been rated high.

### 3.4 Thread 1: exergame against conventional exercise, and against no exercise

*Rests on: six studies at tier A (full text). One of the six is of doubtful eligibility
by the user's decision. Directions are each trial's own between-group test, not effect
sizes, and the search probably missed trials that reported motivation only in the full
text, which are more likely to be null.*

| Study | Comparator | Result at end of programme, as reported | `direction` | Overall risk of bias |
|---|---|---|---|---|
| @anderson2026gamified | Wobble-board training | IMI Interest/Enjoyment 5.04 ± 1.18 against 3.17 ± 1.31; the other three subscales not different (p 0.61, 0.81, 0.45) | favours exergame | High |
| @ngo2026effects | On-court tennis | Game arm higher at post-test on intrinsic motivation to know (22.39 against 17.21) and to accomplish (21.82 against 18.41), and also on external regulation (23.11 against 18.24); four subscales not different | mixed across subscales | Some concerns |
| @huang2025effects | The same dance by video | One BREQ-2 score per arm; between-group P read as 0.936 | other | Some concerns |
| @tunc2026rehabilitative | Conventional exercises | MSPPA total: absolute scores at week 24 not different (p 0.13); change scores and ANCOVA different (p = 0.015 for the ANCOVA) | other | High |
| @nikolova2025effect † | "Traditional physical activity" | One composite: 4.08 (0.52) against 3.15 (0.46), with a group effect and a time × group interaction | other | High |
| @liu2025effects | No intervention | BREQ-2 intrinsic regulation 3.71 (0.94) to 4.81 (0.26) against 3.63 (0.86) to 3.76 (0.61); identified regulation also in favour; three subscales without a significant interaction | favours exergame | High |

**Against conventional exercise (five trials).** One trial is coded as favouring the
exergame arm, one as mixed and three have no coded direction. With the doubtful trial
set aside the counts are one, one and two.

The one trial coded as favouring the game arm does so on one of four subscales of the
IMI, measured once, after training, with no baseline, and it is rated high for both
randomization and missing data [@anderson2026gamified]. The mixed trial found the game
arm higher on two intrinsic-motivation subscales and also on external regulation, which
the protocol counts as unfavourable; in that trial both arms' intrinsic scores fell
over the 12 weeks, and the paper's abstract describes the game arm as having retained
intrinsic motivation better [@ngo2026effects]. These two results do not contradict
each other, and they do not confirm each other either: the instruments and the
constructs differ.

For the three trials with no coded direction, the papers' own conclusions are more
favourable than their tables.

- One concludes that its Kinect programme improved exercise behaviour regulation. The
  test that supports this is a within-group change in the game arm; the control arm
  moved the same way, and the between-group values in its Table 2 read as 0.936 and
  1.000 [@huang2025effects]. Which P values are the between-group ones is inferred from
  the table's layout, because its footnote labels do not match the columns.
- One describes motivation as maintained in the game arm and declining in the control
  arm. Its three between-group tests at the end of the programme do not agree, the
  control arm started higher (33.70 against 27.84), and the game arm's change scores do
  not follow from its own means [@tunc2026rehabilitative].
- One reports a clearly higher composite in the game arm. The composite's mean exceeds
  the maximum of the items as the paper describes them, and how six subscales that run
  from amotivation to intrinsic regulation became one score is not stated
  [@nikolova2025effect]. This is the doubtful trial.

**Against no intervention (one trial; a single-study finding).** A four-week programme
on a game-driven exercise bike was followed by higher identified and intrinsic
regulation than in a control arm that did nothing, by the time × group interaction
(amendment A11 counts that test) [@liu2025effects]. The trial is rated high for missing
data: both dropouts came from the game arm. Its own limitations section says the
interactions were probably inflated by deterioration in the control arm, and the F and
P printed for the intrinsic-regulation interaction do not correspond to each other. A
second trial had a no-training arm and did not give it the motivation instrument
[@anderson2026gamified], so nothing can be said from it.

A comparison with no exercise cannot separate the game from the exercise. In the
included set, the only trial that favours the exergame arm on more than one subscale is
this one.

### 3.5 Thread 2: population and health status

*Rests on: six studies at tier A; one of doubtful eligibility.*

![Evidence map](figures/evidence-map.svg)

**Figure 5.** Included studies by population group and coded direction, marked by
overall risk of bias. Generated from `evidence-map.csv` (derived from `extraction.csv`
and the Overall rows of `rob.csv`), 2026-11-28. Study IDs as in Figure 3. The dagger
marks the trial kept as doubtful by the user's decision.

Four trials are in healthy adults, and their codes are favours exergame (two), mixed
(one) and none (one, the doubtful trial). The one trial in older adults
[@huang2025effects] and the one in adolescents [@tunc2026rehabilitative] each have no
coded direction. No population group other than healthy adults has more than one
included trial, so nothing can be said about whether results differ by age or
condition. No included trial recruited people with a neurological, cardiometabolic,
oncological or mental-health condition; that is an absence in six open-access trials
and not a statement about the field.

### 3.6 Thread 3: platform

*Rests on: six studies at tier A; one of doubtful eligibility.*

Three trials used a console or camera motion game, with codes of favours exergame
[@anderson2026gamified], mixed [@ngo2026effects] and none [@huang2025effects]. One used
exercise equipment with a game seen through a headset [@liu2025effects], one a headset
game the paper does not name [@nikolova2025effect], and one a balance board and
phone-camera games [@tunc2026rehabilitative]. With one trial each, nothing can be said
about platforms other than console or camera games, and within that group the three
results differ along with their comparators, instruments and populations. The evidence
does not show whether platform matters. Setting the doubtful trial aside leaves no
included trial coded as a headset game.

### 3.7 Thread 4: follow-up and adherence

*Rests on: two studies at tier A for follow-up, one of them of doubtful eligibility;
one study for adherence.*

Two trials measured motivation after the programme ended. One reports the same single
BREQ-2 score one month later, with a between-group P read as 1.000
[@huang2025effects]. The other reports its composite at five months, 3.92 (0.49)
against 3.12 (0.43), with no between-group test at that time point
[@nikolova2025effect]. Both are totals of unstated construction, so neither supports a
statement about direction at follow-up. Without the doubtful trial, one study remains
and this is a single-study finding. Four trials report no follow-up.

Fewer than two trials report adherence in a way that can be compared between arms.
One reports that everyone analysed in both training arms completed all 12 sessions
[@anderson2026gamified], which is the same in both arms and excludes those who dropped
out. Whether adherence moves with motivation cannot be addressed from the included
trials.

### 3.8 Thread 5: what is measured as motivation

*Rests on: six studies at tier A; one of doubtful eligibility.*

Three trials used a version of the BREQ [@nikolova2025effect; @huang2025effects;
@liu2025effects], one the IMI [@anderson2026gamified], one the Sport Motivation Scale
[@ngo2026effects] and one the MSPPA [@tunc2026rehabilitative]. No included trial used
a need-satisfaction scale.

Three of the six report only a total or composite score
[@nikolova2025effect; @huang2025effects; @tunc2026rehabilitative]. Each of these
instruments includes amotivation alongside more autonomous forms of motivation, and
none of the three papers says how the total treats items that point the other way.
This is the main reason the review cannot code a direction for half of its trials.
The three trials that report subscales are the three with a coded direction.

Where subscales are reported, any difference between arms is on intrinsic or
identified forms of motivation: interest and enjoyment [@anderson2026gamified],
intrinsic motivation to know and to accomplish [@ngo2026effects], identified and
intrinsic regulation [@liu2025effects]. The IMI has no amotivation or introjected
subscale. In the two trials that measured them, neither was reported as different
between arms, though one prints a borderline value for amotivation in its table and
describes only a main effect of time in its text [@liu2025effects]. That is three
trials, two of them rated high, using three instruments.

**The trial of doubtful eligibility.** @nikolova2025effect is kept in the review marked
doubtful, by the user's decision at the second gate. Its paper never names the game or
the headset and never says body movement is the game input; it meets I1 only under
amendment A6, on the authors' label. Both judges ruled it eligible under A6 and
neither found new text either way. Two other included trials carried screening doubts
that the judges cleared from the text: for @tunc2026rehabilitative, an appendix
fetched before extraction gives the movement input and a score for each game; for
@huang2025effects, the table gives the instrument's means for both arms at both later
time points.

### 3.9 Reporting biases

No registry was searched, so unpublished trials were not looked for. Three trials cite
a registration [@huang2025effects; @liu2025effects; @tunc2026rehabilitative]; the
content of the registrations is not in the saved texts, so no registered outcome was
compared with a reported one. One excluded trial (`pm-42247423`) registered motivation
as an outcome and says it will be reported separately; that report was not found. The
search required a motivation term in the title, abstract or index terms, which favours
trials whose motivation result was worth putting in the abstract.

### 3.10 Certainty of evidence

| Outcome | Studies (randomized) | Certainty (GRADE) | Reasons |
|---|---|---|---|
| Motivation at end of programme, exergame against a non-exergame arm | 6 trials ([computed: 257]) | Very low | Risk of bias: 4 of 6 high overall, none low in any domain. Inconsistency: directions differ and three cannot be coded. Indirectness: instruments, comparators and populations differ; one comparison is with no exercise. Imprecision: small trials, no pooled estimate. Publication bias suspected from the search design |
| Motivation at follow-up | 2 trials | Not rated | Both report a total of unstated construction; one is of doubtful eligibility |
| Adherence | 1 trial | Not rated | A single study, identical in both arms among completers |

Every included study is tier A, so no rating is withheld for lack of a full text.

## 4. Discussion

### 4.1 Interpretation

The included trials do not answer the question. Two of six favour the exergame arm by
their own test, both at high risk of bias, one of them against a control arm that did
no exercise and one on a single subscale measured once. One is mixed. Three report a
score that cannot be given a direction. No trial favours the comparator. Counting
these is vote-counting over small trials and is a weak basis for any statement; the
counts are given because they are all there is.

This is not evidence that exergames do not affect motivation. It is six small trials
that measured motivation as one outcome among several and, in half of them, reported
it in a form that cannot be interpreted. No other evidence was consulted, so the
review does not place this in the context of earlier work.

**Sensitivity to risk of bias.** With the four trials rated high set aside, two remain:
one mixed [@ngo2026effects] and one with no coded direction [@huang2025effects]. No
trial coded as favouring the exergame arm remains.

**Sensitivity to eligibility.**

| Conclusion | With all six | Without the doubtful trial (I1, authors' label only) |
|---|---|---|
| Trials coded as favouring the exergame arm | 2 | 2; unchanged |
| Trials with no coded direction | 3 | 2 |
| Trials rated high overall | 4 of 6 | 3 of 5 |
| Evidence at follow-up | 2 trials, neither interpretable | 1 trial; a single-study finding |
| Headset games represented | 1 trial | None coded as a headset game |
| Overall answer: the trials do not show whether motivation changes | Holds | Holds |

### 4.2 Limitations of the evidence

- Four of six trials are at high risk of bias, mostly from more dropout in the game
  arm analysed by completers.
- Three of six report motivation only as a total whose construction is not given.
- Samples are small, from 25 to 66 randomized.
- Comparators differ in kind, and one trial compares a game with no exercise at all.
- Four of six trials are in healthy young adults.
- Several papers contain internal inconsistencies in the motivation results
  themselves: different randomized totals in abstract and text [@liu2025effects;
  @huang2025effects], sample sizes in a table that differ from the text
  [@anderson2026gamified], change scores that do not follow from means
  [@tunc2026rehabilitative] and a mean above the scale maximum [@nikolova2025effect].
- One included report comes from a journal not indexed in PubMed and has no DOI
  [@nikolova2025effect].

### 4.3 Limitations of this review

`conduct-disclosure.md` is the full account. The main points:

- **Machine-conducted.** Screening, extraction and risk-of-bias rating were done by
  agents. The two screeners, and the two judges, are instances of one model and share
  its blind spots.
- **21 reports were not retrieved** and could not be assessed; one of them both
  screeners would have included on its abstract. The included set is drawn from
  open-access reports only.
- **Narrow by design.** Only randomized trials from 2024 onward with a named
  multi-item instrument. The date limit, the limit of roughly 150 records at screening
  and backward-only citation searching were set to keep the run small; the last two
  were set by the operator who launched the run and accepted by the user. The review
  says nothing about earlier trials, non-randomized or qualitative work, single-session
  studies, enjoyment measured alone, or which game features motivate.
- **The search probably overstates benefit**, because motivation had to be named in
  the title, abstract or index terms. Trials described only as "serious games" were
  not searched for. Two sources were searched; six named databases, registries and
  grey literature were not.
- **The protocol changed thirteen times after approval**, each change dated and
  approved by the user, one of them (A1) only after the fact. Four were made after
  appraisal had begun, and they changed one overall rating and three direction codes.
- **Five excluded reports were read as preprints** and one as an accepted manuscript;
  a published version could differ.
- **An appendix was fetched for one included report** after screening; the screeners
  did not see it.
- **The retrieval route added by A2 came with a plugin update** made between the
  second gate being written and answered.
- **Not registered.** No protocol was registered before the review began.

### 4.4 Implications

For practice: the included trials give no basis for expecting an exergame programme to
raise, or to lower, exercise motivation compared with conventional exercise.

For research, three absences in the included set, each bounded by this search: no
included trial reports a registration whose content could be checked against the
motivation outcome; half report a total score without saying how it was formed; none
reports motivation and comparable adherence in both arms. These are statements about
six trials, not about the field.

## 5. Other information

- **Registration (24a).** This review was not registered. Registration requires a
  person.
- **Protocol (24b).** `protocol.md`, in this directory, written and approved before any
  search.
- **Amendments (24c).** Section 2.7 above; `protocol.md` section 14.
- **Support (25).** Not declared. To be completed by the person responsible for the
  review.
- **Competing interests (26).** Not declared. To be completed by the person responsible
  for the review.
- **Availability of data, code and materials (27).** Everything is in this directory:
  `protocol.md`, `search-log.md`, `records.csv`, `screening.csv`, `retrieval.csv`,
  `prisma-flow.json`, `appraisals/`, `rob.csv`, `extraction.csv`, `evidence-map.csv`,
  `appraisal-agreement.json`, `checks/`, `figures/`, `references.bib`,
  `study-keys.csv`, `synthesis-plan.md`, the three gate files, `prisma-checklist.md`
  and `conduct-disclosure.md`. The scripts are those of the `literature-review` plugin.

## References
