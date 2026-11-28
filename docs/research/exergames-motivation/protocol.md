# Protocol — Exergames and exercise motivation

**Drafted:** 2026-11-28 · **Approved:** 2026-11-28 · **Approved by:** user · **Status:** approved; amended 2026-11-28 after gate 2 (section 14, A1–A9, each approved by the user; A1 was made before the user saw it and ratified afterwards); amended 2026-11-28 after gate 3 (A10–A13, each approved by the user)

This review is machine-conducted. Screening, extraction and appraisal are done by
language-model agents; the two approval gates are decided by the user.

## 1. Question

As asked: *"What is the current state of exercise video games and motivation?"*

That wording is a topic, and it cannot be screened against. The question this protocol
operationalises, proposed by the drafter and **approved by the user as drafted at gate 1**:

> In randomized controlled trials whose first results report was published from 2024 onward, does an exergame
> programme lasting two weeks or more change participants' motivation for exercise,
> measured with a named multi-item motivation instrument, compared with an arm that
> has no exergame — and how much can that evidence be trusted?

Framework: PICOS

- **Population:** people of any age and health status (coded, not restricted)
- **Intervention:** an exergame programme scheduled to last two weeks or more
- **Comparator:** an arm with no exergame (conventional exercise, usual care, wait-list, no intervention, sedentary activity)
- **Outcome:** motivation for exercise, physical activity or the training activity, on a named multi-item self-report instrument
- **Study design:** randomized controlled trials

### Limits on this run, and who set them

These bind the run and are reported as limitations in the review.

1. **At most 20 studies are appraised.** This limit is the user's own. The criteria, date range and designs below are set so that the expected inclusion set is about 20 or fewer. If screening includes more than 20, nothing is truncated silently: the count goes to gate 2 with options for narrowing.
2. **Roughly 150 records or fewer at title and abstract screening.** Set by the operator who launched the run, not by the user; the user accepted it at gate 1.
3. **Citation searching: backward only, one iteration, at most 15 references per seed and at most 40 new records in total.** Set by the operator who launched the run, not by the user; the user accepted it at gate 1.
4. **The run is attended.** No gate is passed without the user's answer.

What the limits cost, and what the drafter's reading leaves out:

- The 2024 start date, the randomized-only restriction and the named-instrument
  requirement were chosen partly to meet limits 1 and 2. The review will say nothing
  about earlier trials, non-randomized or qualitative studies, single-session
  laboratory studies, or motivation inferred from adherence or enjoyment.
- **It is not a map of the field.** A randomized-only effect question cannot describe
  what kinds of exergame motivation research exist.
- **It cannot say which design features motivate.** Trials comparing one exergame with
  another, or one exergame with and without a feature, are excluded (E3). This is the
  drafter's reading of the question, not a consequence of the limits; admitting them
  changes I3 and raises volume. Put to the user at gate 1, who approved the question as drafted.
- **It cannot say who keeps playing and why.** Studies of motivation as a predictor of
  exergame use are observational and excluded.
- **Need-satisfaction scales count as motivation measures** (I5), although in
  self-determination theory they measure antecedents of motivation; enjoyment measured
  alone does not count, while the Intrinsic Motivation Inventory's interest/enjoyment
  subscale does. Put to the user at gate 1, who accepted both choices.
- **The search probably overstates benefit.** The motivation terms must appear in a
  record's title, abstract or index terms. Trials that measured motivation as a
  secondary outcome and reported it only in the full text are not found, and these are
  more likely to be null. The exergame block alone returns thousands of records, so the
  block cannot be dropped within limit 2.
- **Trials described only as "serious games" are not searched for.** That term added 46
  PubMed records to the pilot and was left out for volume; so was the broad MeSH heading
  `Video Games` (65).
- **Full text is retrieved by three routes only: open-access PubMed Central, arXiv,
  and — added after gate 2 by amendment A2 — an open-access PDF copy that OpenAlex
  lists for the record** (`fetch_fulltext.py --oa-copies`: OpenAlex is asked by DOI or
  OpenAlex ID which open-access copies exist; only a PDF is accepted, converted with
  `pdftotext` and title-checked; nothing is fetched from a location OpenAlex does not
  mark open access, and no copy is fetched by hand). As approved at gate 1 this
  limitation named the first two routes only. A count-only PubMed query with the
  section 4 string on 2026-11-28 found open-access PubMed Central full text for 59 of
  83 records. A report whose full text cannot be retrieved by these routes cannot be
  screened at full text, extracted or appraised. It is reported as **not retrieved**,
  never as excluded on a criterion, and gate 2 lists every such report by name. The
  included set is therefore drawn from open-access reports only. Some copies reached
  by the third route are preprints (`submittedVersion`) and may differ from the paper
  of record, in their numbers above all; text converted from a PDF is also rougher
  than the other two routes'. The review names every report read as a preprint. All
  of this is stated as a limitation in the review.

## 2. Eligibility criteria

E<n> is the mirror of I<n>: a record failing I<n> is excluded under E<n>. E9 has no
mirror. Screeners cite exclusion codes only. **Where a record fails several criteria,
cite the lowest-numbered exclusion code that applies**, except that E9 is cited for
anything that is not a primary report. A criterion marked "partly" is answered
`unsure`, not guessed, when the abstract does not settle it. **In a crossover trial, "arm"
in I3, I4, I6, E3, E4 and E6 means condition, not sequence**: a crossover of exergame and
conventional exercise has a non-exergame arm.

| Code | Label | Criterion | Decidable at title/abstract? |
|---|---|---|---|
| I1 | Exergame intervention | At least one arm receives an exergame: a digital game in which the player's movement of limbs or trunk is the game input and the game has a goal or score that the movement pursues | yes |
| I2 | Randomized allocation | Participants or clusters were allocated to arms at random. Both of these count as random allocation (amendment A3): random allocation after which a minority of participants were reassigned at their own request before the intervention began; and allocation the paper describes as random but made by a constrained or pseudo-randomized procedure | partly — `unsure` when the abstract describes two or more arms without saying how allocation was made |
| I3 | Non-exergame comparator | At least one arm receives no exergame | partly — `unsure` if arms are not described |
| I4 | Two weeks or more | The exergame arm was scheduled to last two weeks or more | partly — `unsure` if duration is not given |
| I5 | Named motivation instrument | Motivation for exercise, physical activity or the training activity was measured with a named multi-item self-report instrument or subscale whose items concern motivation or motives | no — full text, unless the abstract names the instrument or shows there is none |
| I6 | Motivation results by arm | The report gives results on the I5 instrument for the exergame arm and for a non-exergame arm at one or more time points after baseline | partly — protocols are decidable; otherwise full text |
| I7 | First results 2024 or later | The trial's first results report was published on or after 2024-01-01 | partly — a record dated before 2024 is decidable; `unsure` when the abstract presents itself as a secondary or follow-up analysis of an earlier trial |
| I8 | English full text | The full text is in English | yes |
| E1 | Not an exergame | No arm receives an exergame as I1 defines it | yes |
| E2 | Not randomized | Allocation was not random, or there is one arm. E2 is not cited for random allocation after which a minority of participants were reassigned at their own request before the intervention began, nor for allocation the paper describes as random but made by a constrained or pseudo-randomized procedure (amendment A3) | partly |
| E3 | No non-exergame comparator | Every arm receives an exergame | partly |
| E4 | Under two weeks | The exergame arm was scheduled to last under two weeks | partly |
| E5 | No named motivation instrument | Motivation was not measured with a named multi-item self-report instrument or subscale | no — full text, unless the abstract settles it |
| E6 | No motivation results by arm | The report lacks post-baseline results on the I5 instrument for the exergame arm, for a non-exergame arm, or for both | partly |
| E7 | First results before 2024 | The trial's first results report was published before 2024-01-01 | partly |
| E8 | Not English | The full text is not in English | yes |
| E9 | Not a primary report | The report is a review, meta-analysis, editorial, commentary, or conference abstract without a full paper | yes |

### Cases on each side of the line

**I1 / E1 — exergame.**
In: a console, camera, headset or sensor game played by moving the body (Ring Fit
Adventure, Kinect or Wii sports and fitness titles, a rhythm game in a VR headset used
as exercise); a stationary bike or treadmill whose pedalling or walking drives a game
with a goal or score; a custom rehabilitation game controlled by stepping, reaching
with the arm, or shifting weight; a game played by walking or running in real time
(location-based or audio-narrative running games); a robot- or exoskeleton-assisted
game in which the patient moves actively; a movement-training system that gives the
player a running score for matching target movements, whether or not the paper calls
it a game (amendment A4); an intervention the paper calls an exergame and describes
as exercise performed in the game, unless the text shows the input is not body
movement (amendment A6).
Out: movement feedback alone — speed, distance, heart rate, accuracy or posture cues,
or virtual scenery that moves with pedalling or walking — with no goal or score: that
is not a game; a fitness app or wearable that awards points or badges for steps
(gamification, not an exergame); a mobile game whose state changes from step or
distance totals accumulated outside a play session; a seated video game played with a
hand controller; a game controlled only by finger or hand movement on a screen or
controller; cognitive-training games; a robot or exoskeleton that moves the limb
passively; a game whose input is muscle activation sensed by EMG, force or torque
sensors without required movement of the limb or trunk (amendment A9).
A mixed programme (exergame plus conventional exercise in the same arm) is in under
I1; whether it is in overall turns on I3.

**I2 / E2 — randomized.**
In: parallel, cluster-randomized and randomized crossover trials; trials called pilot
or feasibility, if randomized; random allocation after which a minority of
participants were reassigned at their own request before the intervention began; and
allocation the paper describes as random but made by a constrained or
pseudo-randomized procedure (both by amendment A3 — the weakness is rated under risk
of bias, D1 and D2, not decided here; by amendment A13, reassignment at participants'
request after allocation is rated under D2, and D1 carries a constrained or
pseudo-randomized procedure).
Out: allocation by alternation, by date, by class or site chosen by the researchers,
or by participant preference; single-arm pre–post studies; a secondary analysis of one
arm of a trial.
A secondary or follow-up report of an eligible trial is in, and is grouped with its
parent as one study.

**I3 / E3 — comparator.**
In: exergame versus conventional exercise; exergame plus usual care versus usual care;
exergame versus wait-list, no intervention, or a seated video game.
Out: one exergame versus another; the same exergame with and without a feature
(multiplayer, immersion, a narrative); exergame given to every arm with something else
varied.

**I4 / E4 — duration.**
In: a programme the paper describes as lasting two weeks or more, whatever the session
count (a "2-week programme, five sessions a week" is in); a programme with no stated
length whose scheduled sessions span 14 days or more counting from the first session
day; a crossover trial in which each condition lasts two weeks or more.
Out: a single session; a programme described as shorter than two weeks; a crossover
trial with one session per condition, even when the sessions are weeks apart.
A stated number of weeks decides over a count of days. The scheduled duration decides,
not what participants completed. Where a paper gives conflicting durations, the
schedule in the Methods decides over the Abstract (amendment A5).

**I5 / E5 — named motivation instrument.**
In: Intrinsic Motivation Inventory (any subscale set, including the interest/enjoyment
subscale, which is its measure of intrinsic motivation); Behavioural Regulation in
Exercise Questionnaire (any version); Situational Motivation Scale; Exercise Motivations
Inventory; Motives for Physical Activity Measure; Sport Motivation Scale; Physical
Activity and Leisure Motivation Scale; basic psychological need satisfaction scales
for exercise (PNSE, BPNES); any other instrument the paper names, with two or more
items, that it describes as measuring motivation or motives for exercise, physical
activity, sport, physical education or the training or therapy sessions themselves; a
subscale of two or more items headed motivation inside a named instrument that
measures something broader (the subscale is the I5 instrument); a named questionnaire
the authors wrote for the study, if it has two or more motivation items (its lack of
validation is rated under D4).
Out: enjoyment measured alone (PACES or an enjoyment visual scale) with no motivation
instrument; exercise self-efficacy alone; intention alone; adherence, attendance or
play time alone; a single-item motivation rating; an unnamed questionnaire written for
the study; clinician-rated participation; apathy or depression scales; motivation for
something other than exercise or the training (academic motivation, motivation to
quit smoking); motivation discussed only in interviews.
I5 asks only whether such an instrument was used; in which arms is I6's question.

**I6 / E6 — results.**
In: means, change scores, or a between-group test for the motivation instrument, in
text, table, figure or supplement; a composite or total score of the I5 instrument
reported for both arms (how it was formed is a matter for extraction and D4;
amendment A7); in a trial with several non-exergame arms, results on the I5
instrument for the exergame arm and any one non-exergame arm (amendment A8).
Out: a trial protocol or registry record; a report that lists the instrument in its
methods and gives no result for it; a report giving motivation results for the
exergame arm only (an instrument given only to the exergame arm fails I6, not I5); in
a trial with several arms, results for exergame arms only.

**I7 / E7 — date.** The first results report is the version of record of the earliest
report of the trial's results, dated by online-first or print publication, whichever
is earlier. Preprints, registry postings and published protocols do not count.
In: online first 2024-01-05; a 2024 paper whose preprint was posted in 2023; a 2025
secondary report of a trial whose main results appeared in 2024.
Out: online first 2023-12-20 in an issue dated 2024; a 2024 secondary or follow-up
report of a trial whose first results report appeared in 2022.
Where only a year is known, the year decides.

**I8 / E8 — language.** In: English full text. Out: English abstract with the full
text in another language.

**E9 — not a primary report.** Out: systematic and narrative reviews, meta-analyses,
editorials, letters without data, conference abstracts with no full paper. A conference
*paper* with full methods and results is a primary report.

## 3. Information sources

| Source | Interface | Date range | Why this source |
|---|---|---|---|
| PubMed | NCBI E-utilities (esearch, esummary, efetch), no key | 2024-01-01 to 2026-11-28 | Indexes the health, rehabilitation and sports-medicine journals where exergame trials are published; has a thesaurus (MeSH `Exergaming`, `Motivation`) and a true total |
| OpenAlex | `api.openalex.org/works`, `title_and_abstract.search` filter, **no key** | 2024-01-01 to 2026-11-28 | Covers psychology, education, human–computer interaction and games venues that PubMed does not index |
| Reference lists of included reports | OpenAlex single-work lookup (`referenced_works`), Crossref as fallback | — | Backward citation searching, section 5 |

**Full-text retrieval routes** (not search sources; amended by A2). Each report sought
is fetched once by `fetch_fulltext.py`, and every saved text must carry the record's
title:

| Route | Interface | Added |
|---|---|---|
| Open-access PubMed Central | Europe PMC full-text XML | approved at gate 1 |
| arXiv | arXiv HTML rendering | approved at gate 1 |
| Open-access copies listed by OpenAlex | `fetch_fulltext.py --oa-copies`: OpenAlex looked up by DOI or OpenAlex ID, the open-access copies it lists tried in order, PDF only, converted with `pdftotext`. A copy may be a preprint (`submittedVersion`); the retrieval log gives each copy's version and address | **2026-11-28, after gate 2 (A2)**, with plugin version 0.4.0; the run began under 0.3.0, which had no such route |

Not searched, and reported as limitations: PsycINFO, SPORTDiscus, Scopus, Web of
Science, Embase and CINAHL (no access from this environment); trial registries; grey
literature and theses. arXiv is not searched: it carries almost no randomized trials of
exercise interventions. Crossref is used only to resolve identifiers.

## 4. Search strings

Three blocks — exergame, motivation, randomized design — combined with AND. Left out
for volume after piloting (section 13): `"serious game*"` and `"Video Games"[MeSH]`.

### PubMed

```
(exergam*[tiab] OR "exer-gam*"[tiab] OR "active video gam*"[tiab] OR "active videogam*"[tiab] OR "exercise video gam*"[tiab] OR "exercise videogam*"[tiab] OR "active gaming"[tiab] OR "fitness gam*"[tiab] OR "interactive video gam*"[tiab] OR "motion-based gam*"[tiab] OR "motion-controlled gam*"[tiab] OR "movement-based gam*"[tiab] OR "exertion game*"[tiab] OR "dance game*"[tiab] OR "location-based game*"[tiab] OR "game-based exercise"[tiab] OR "game-based training"[tiab] OR "game-based rehabilitation"[tiab] OR "video game-based"[tiab] OR "gamified exercise"[tiab] OR "virtual reality exercise"[tiab] OR "virtual reality-based exercise"[tiab] OR "VR exercise"[tiab] OR "virtual reality game*"[tiab] OR "VR game*"[tiab] OR "Ring Fit"[tiab] OR "Nintendo Switch"[tiab] OR "Kinect"[tiab] OR "Wii"[tiab] OR Xbox[tiab] OR "EyeToy"[tiab] OR "Just Dance"[tiab] OR "Dance Dance Revolution"[tiab] OR "Beat Saber"[tiab] OR "Exergaming"[MeSH]) AND (motivat*[tiab] OR amotivation[tiab] OR motive*[tiab] OR "self-determination"[tiab] OR "self-determined"[tiab] OR "basic psychological need*"[tiab] OR "need satisfaction"[tiab] OR "behavioral regulation"[tiab] OR "behavioural regulation"[tiab] OR "autonomous regulation"[tiab] OR BREQ[tiab] OR "Motivation"[MeSH]) AND (randomized controlled trial[pt] OR randomi*[tiab] OR randomly[tiab] OR RCT[tiab]) AND 2024/01/01:2026/11/28[dp]
```

Limits: date only. No language or publication-type exclusion in the string; I8 and E9
are applied at screening. Cap: none.

### OpenAlex

`GET https://api.openalex.org/works?filter=` followed by, as one filter value:

```
title_and_abstract.search:(exergame OR exergames OR exergaming OR "exer-game" OR "exer-games" OR "exer-gaming" OR "active video game" OR "active video games" OR "active video gaming" OR "active videogame" OR "active videogames" OR "exercise video game" OR "exercise video games" OR "exercise videogame" OR "exercise videogames" OR "active gaming" OR "fitness game" OR "fitness games" OR "interactive video game" OR "interactive video games" OR "motion-based game" OR "motion-based games" OR "motion-controlled game" OR "motion-controlled games" OR "movement-based game" OR "movement-based games" OR "exertion game" OR "exertion games" OR "dance game" OR "dance games" OR "location-based game" OR "location-based games" OR "game-based exercise" OR "game-based training" OR "game-based rehabilitation" OR "video game-based" OR "gamified exercise" OR "virtual reality exercise" OR "virtual reality-based exercise" OR "VR exercise" OR "virtual reality game" OR "virtual reality games" OR "VR game" OR "VR games" OR "Ring Fit" OR "Nintendo Switch" OR Kinect OR Wii OR Xbox OR EyeToy OR "Just Dance" OR "Dance Dance Revolution" OR "Beat Saber") AND (motivation OR motivational OR motivated OR amotivation OR motive OR motives OR "self-determination" OR "self-determined" OR "basic psychological needs" OR "need satisfaction" OR "behavioral regulation" OR "behavioural regulation" OR "autonomous regulation" OR BREQ) AND (randomized OR randomised OR randomly OR RCT),from_publication_date:2024-01-01,to_publication_date:2026-11-28,type:article
```

Free text only: OpenAlex has no truncation and no thesaurus, so plural and spelling
variants are written out. The string is the PubMed string translated term for term,
less the two MeSH headings and the publication-type tag, which have no counterpart. Limits: date, `type:article`. Cap: none; all pages retrieved
with cursor paging.

## 5. Snowballing

- **Direction:** backward only (reference lists). Forward citation searching is not run,
  by the operator's limit, accepted by the user at gate 1; it would also need an OpenAlex key this environment lacks.
- **Seeds:** the reports included at full text from the database search.
- **Iterations:** one. Records found by snowballing are screened but are not themselves
  seeds.
- **Per-seed cap:** 15 references. From each seed's reference list, keep references
  dated 2024 or later (earlier ones fail I7) whose title contains an exergame-block
  term from section 4, or "serious game"; if more than 15 remain, the 15 most recent.
- **Total cap:** the smaller of 40 and (160 − unique database records after
  deduplication), counted in new records after deduplication against `records.csv`.
  Records from citation searching count toward the limit of roughly 150 at
  title/abstract. Seeds are processed in record-id order; when the cap is reached the
  remaining seeds are not processed, and the log names them.
- **If deduplication of the database search alone leaves more than 160 records,**
  screening does not start: the count goes to the user with options (a later start
  date, or no citation searching).
- A cap that was hit is a limitation, logged in `search-log.md` and reported.
- The 2024 filter means backward searching here can only find recent trials the
  database strings missed, not older foundational work, which I7 excludes anyway.

Because citation searching is planned, the two-column PRISMA 2020 flow template is used.

## 6. Screening

Two independent screener agents at title/abstract and at full text, given identical
inputs and no shared context. Title/abstract uses the liberal rule: a record advances
if either screener answers include or unsure. Full-text disagreements go to the
screening adjudicator, which decides from the saved text or escalates to the user.

Full text is fetched once per advanced record, from open-access PubMed Central or
arXiv, and — by amendment A2, in a second pass over the records those two routes did
not reach — from an open-access PDF copy OpenAlex lists (sections 1 and 3). A report with no retrievable full text is counted in the flow diagram
as a report not retrieved, is never given an exclusion code, and is named at gate 2.

A calibration batch of 20 records is screened first. If Cohen's κ on it, or at either
stage overall, is below 0.60, the criteria are revised (as a dated amendment, approved
by the user) rather than the disagreements adjudicated one by one.

Several reports of one trial are grouped as one study. The count of included studies
is taken after the citation-searching pass has been screened at full text. If it is
more than 20, appraisal does not start: the count goes to gate 2 with narrowing
options.

## 7. Data items

**Outcomes (item 10a).**

- *Primary:* motivation for exercise, physical activity or the training activity at the
  end of the intervention, exergame arm versus non-exergame arm, on the instrument(s)
  that met I5. All subscales and all time points reported are extracted.
- *Secondary:* the same outcome at any follow-up after the intervention ended;
  adherence or attendance, as the included trials report it.

**Other variables (item 10b).**

| Column | Type | Allowed values | Definition |
|---|---|---|---|
| `design` | code | parallel rct; cluster rct; crossover rct; other; not stated | Unit and pattern of randomization |
| `trial_scale` | code | pilot or feasibility; full-scale; other; not stated | `pilot or feasibility` only when the paper calls itself one |
| `population_group` | code | children and adolescents; adults; older adults; mixed; other; not stated | By the paper's inclusion ages: upper bound under 18; lower bound 18 to 59; lower bound 60 or over. The age bound decides; the paper's description decides only when no bound is given. `mixed` when the bounds span under-18s and adults |
| `health_status` | code | healthy or general population; neurological; neurodevelopmental; cardiometabolic or obesity; oncology; mental health; musculoskeletal; other; not stated | The condition participants were recruited for; `healthy or general population` when none. `neurodevelopmental` takes autism, ADHD, developmental coordination disorder, intellectual disability and cerebral palsy; `neurological` takes acquired or degenerative conditions (stroke, Parkinson's disease, multiple sclerosis, dementia) |
| `setting` | code | laboratory or university; school; clinic or hospital; home; community or care facility; other; not stated | Where exergame sessions took place; `other` with a note if more than one |
| `exergame_platform` | code | console or camera motion game; immersive vr headset; exercise equipment with game; mobile or ar; custom rehabilitation system; other; not stated | Coded by hardware. A commercial console title is `console or camera motion game` even in a clinic, and so is custom software on a commercial camera or console; custom software in a commercial headset is `immersive vr headset`. `custom rehabilitation system` only for purpose-built hardware (a dedicated sensor rig, balance platform or device). When an exercise machine is the game input and the game is displayed in an immersive headset, the input device decides: code `exercise equipment with game` (amendment A12) |
| `comparator_type` | codes | conventional exercise; usual care; no intervention or wait-list; sedentary activity; other; not stated | What the non-exergame arm(s) received. Several may apply |
| `motivation_instrument` | codes | imi; breq; sims; need satisfaction scale; other; not stated | Instrument(s) meeting I5. `need satisfaction scale` covers PNSE and BPNES |
| `motivation_role` | code | primary; secondary; exploratory or unspecified; other; not stated | The role the paper assigns the motivation outcome |
| `direction` | code | favours exergame; no between-group difference; favours comparator; mixed across subscales; mixed across comparators; not tested between groups; other; not stated | The authors' own between-group test on the I5 instrument at end of intervention, coded from the reported test and not from the authors' conclusion. Favouring an arm means higher intrinsic, identified, integrated, autonomous or need-satisfaction scores, or lower amotivation, external or introjected regulation or IMI pressure/tension, in that arm. IMI effort/importance, value/usefulness and perceived competence or choice count as higher-is-favourable; the separate motives scales of the Exercise Motivations Inventory, the Motives for Physical Activity Measure and similar motive inventories have no valence except their enjoyment, interest and competence motives (higher is favourable), and the others are recorded in `motivation_result` without deciding the code. Where the paper reports a composite or total score (a relative autonomy index, an IMI total) with a between-group test, the composite decides and the subscales do not. A composite decides `direction` only when the paper states how it is formed and its valence follows from that; otherwise the code is `other`, and the result is recorded in `motivation_result` (amendment A11). A time × group interaction on the I5 instrument counts as the between-group test at end of intervention when the paper reports no separate test there (amendment A11). Otherwise: `favours exergame` or `favours comparator` only when at least one subscale with a valence differs in that direction and none differs in the other; one subscale favouring an arm with the rest showing no difference takes that arm's value; `mixed across subscales` only when subscales, or two instruments, favour opposite arms against the same comparator. `mixed across comparators` when a trial with two or more non-exergame arms gives different codes against them, and it takes precedence over `mixed across subscales`; the result per comparator goes in `motivation_result`. `not tested between groups` when only within-arm changes are tested |
| `country` | text | — | Where the trial was run |
| `n_randomized` | text | — | Total and per arm, as stated |
| `duration` | text | — | Weeks, sessions per week and session length, as stated |
| `exergame_name` | text | — | Title or system, as stated |
| `motivation_result` | text | — | The quoted numbers for the primary outcome, per arm and between groups, with location |
| `followup_result` | text | — | Quoted motivation result at follow-up, or "none reported" |
| `adherence_result` | text | — | Quoted adherence or attendance result, or "none reported" |
| `registration` | text | — | Registry and number, or "none reported" |
| `funding` | text | — | As the paper states it, including any industry tie |

## 8. Risk of bias

- Instrument: RoB 2 (Sterne et al., BMJ 2019;366:l4898), applied to the motivation outcome at end of intervention, effect of assignment (intention-to-treat). Its signalling questions apply; the anchors below fix what it leaves open for this outcome.
- Scale: Low < Some concerns < High
- Overall: worst domain
- Raters: two judge agents per study, independently and with no shared context; an adjudicator settles what they rate differently.

"No information" is not a domain judgment. Where the paper is silent on what a domain
asks, the domain is rated as the anchors say for that silence — Some concerns unless
an anchor says otherwise — as the RoB 2 algorithms do.

| Domain | Low when | Some concerns when | High when |
|---|---|---|---|
| D1 Randomization process | A random sequence method is named, allocation was concealed until assignment, and baseline motivation is similar between arms. For a cluster-randomized trial, also that participants were identified and recruited before clusters were randomized (RoB 2 for cluster trials, domain 1b, is rated here) | Every case that is neither Low nor High — including a paper that says "randomized" and gives no sequence method or no concealment | Allocation was predictable or not concealed in a way that could be exploited, or baseline differences point to a failed randomization; or, in a cluster-randomized trial, participants were recruited or consented after their cluster's allocation was known to recruiters or participants |
| D2 Deviations from intended interventions | Analysis keeps participants in their randomized arms (intention-to-treat, or modified to exclude only those with no outcome data) and no deviation arising from the trial context is reported. Participants knowing their arm does not alone move a trial off Low. For a crossover trial, also a washout of two weeks or more or a reported test for carryover | Every case that is neither Low nor High — including deviations arising from the trial context (extra sessions, co-interventions, comparator participants seeking other exercise) that are balanced between arms; an analysis population that is not described; a crossover trial with no washout and no carryover test | Per-protocol or as-treated analysis only, with exclusions or switching that could affect the result; or contamination (comparator participants using exergames) or unbalanced deviations reported and not handled |
| D3 Missing outcome data | Motivation data available for 90% or more of those randomized in each arm and no arm's missingness is attributed to the intervention; or missingness handled by an analysis shown to be robust | Every case that is neither Low nor High — including 10–20% missing with reasons not reported, and numbers analysed not reported | Data missing for more than 20% in any arm, or missingness differing between arms by more than 10 percentage points, or missingness in any amount attributed to the intervention (dislike, boredom, cybersickness), without an analysis shown to be robust |
| D4 Measurement of the outcome | Only when participants were unaware of the study hypothesis and of the other arm, **and** every instrument condition under Some concerns is met and none under High applies; otherwise not attainable, because motivation is self-reported by participants who know their arm | The I5 instrument is a published, validated one, given the same way and at the same times in both arms. Adapting its activity referent ("this activity" to "these sessions", "this game", "these exercises") or using a validated translation is not modification | Items were added, removed or rewritten beyond the referent; or the exergame arm's items rate game features the comparator arm's items have no counterpart for; or administration differed between arms (timing, mode, who administered); or the instrument was written for the study or is otherwise unvalidated |
| D5 Selection of the reported result | A registration or protocol dated before enrolment began names the motivation instrument and time point, and the report matches it | Every case that is neither Low nor High — including no registration or protocol; registration after enrolment began; a registration naming motivation without an instrument or time point | The registered outcome or time point differs from the reported one without explanation, or the report gives only some of the subscales or time points that its methods or registration say were administered. Reporting only the total or composite score of an instrument whose subscales the Methods name is not this: it is rated Some concerns, unless a registration or protocol named the subscales as outcomes; how the total was formed is rated under D4 (amendment A10) |

Reassignment at participants' request after allocation is rated under D2; D1 carries a
constrained or pseudo-randomized procedure (amendment A13).

Because participants cannot be blinded to an exergame and the outcome is self-reported,
D4 is expected to be Some concerns at best for nearly every trial, and the overall
rating with it. The review will say so rather than treat it as a finding about any one
trial, and will report the pattern of the other four domains alongside the overall
rating.

Certainty of the body of evidence is rated per outcome with GRADE. With no pooled
estimate, imprecision is judged from the total number randomized across the trials
that speak to the outcome and from the consistency of direction. The search's lean
toward trials that report motivation in the abstract (section 1) is carried into the
publication-bias judgment.

## 9. Synthesis

Narrative synthesis, reported following SWiM. No meta-analysis: the eligible trials are
expected to use different instruments and subscales in populations from schoolchildren
to stroke patients, and extraction is by machine; a pooled estimate would claim more
than that supports. No forest plot is drawn.

Direction of effect is tabulated per study from `direction`; counts of directions are
reported as counts, never as a proportion "showing benefit", and never without the
risk-of-bias rating beside them. Results coded `not tested between groups` do not
count toward any direction. For thread 1, a trial coded `mixed across comparators` is
entered once per comparator, with each comparator's direction read from the quoted
results in `motivation_result`; the review marks those entries as read from the quoted
result and not from a coded column.

Planned threads: (1) exergame versus conventional exercise, against exergame versus
inactive or usual-care comparators; (2) by population group and health status; (3) by
platform; (4) whether any difference lasts past the programme (follow-up) and whether
adherence moves with motivation; (5) which motivation constructs are measured and which
are not. A thread fewer than two studies speak to gets a sentence saying so.

Reporting bias: registrations cited by included trials are compared with what was
reported (D5). No registry search is run, so unpublished trials are not looked for;
this is a stated limitation. Trials that reported motivation only in the full text are
not found by the search and are more likely to be null (section 1); the synthesis says
so wherever it reports a direction. No funnel plot.

Sensitivity: conclusions are stated with and without studies rated High overall, and
with and without studies whose eligibility either judge disputed at appraisal
(marked `doubtful`).

## 10. Figure budget

| Figure | Source file | Mandatory? |
|---|---|---|
| PRISMA 2020 flow diagram (two-column, with citation searching) | `prisma-flow.json` | yes |
| Risk-of-bias traffic-light plot | `rob.csv` | yes |
| Risk-of-bias summary barplot | `rob.csv` | yes |
| Database contribution (PubMed, OpenAlex, both, citation searching) | `records.csv` | yes — two sources searched |
| Evidence map: `population_group` × `direction`, marked by overall risk of bias | `extraction.csv` + `rob.csv` overall | yes, if five or more studies are included |

The characteristics of the included studies are a table, not a figure.

## 11. Output

- Directory: `/home/user/claude-plugins/docs/research/exergames-motivation`
- Formats: `review.md`, `references.bib`, `review.docx`, `review.pdf`
- CSL style: APA 7th edition

## 12. Toolchain

Probed 2026-11-28.

| Probe | Result | Consequence |
|---|---|---|
| `python3` | 3.11.17 | Scripts run |
| Outbound HTTPS | PubMed E-utilities answered; OpenAlex answered keyless | Searches can run |
| `OPENALEX_API_KEY` | **not set** | Keyless OpenAlex search answered every pilot query today, but it draws on a daily budget shared per network address and can be exhausted mid-run. If it is, the OpenAlex search is logged as not run and the user is told; it is not replaced silently. Forward citation searching is not planned, so that loss does not apply |
| `pandoc` | 3.1.3 | .docx possible |
| Rasterizer | `rsvg-convert`, `inkscape`, `magick`: absent. `convert` (ImageMagick 6) is present but **failed** a test conversion (no SVG delegate). `svglib` through `uvx` **converted a test SVG to PNG at 300 DPI** | Figures can be embedded in .docx through svglib. svglib does not draw `<pattern>` fills, so no figure encodes anything by hatching alone |
| PDF engine | `xelatex`, `tectonic`, `typst`, `wkhtmltopdf`: absent. `weasyprint` 70.0 through `uvx`: present | PDF through HTML and weasyprint: legible, not typeset; wide tables wrap |

## 13. Pilot counts and scale

Count-only queries, 2026-11-28. No records were retrieved.

| Source | String | Total |
|---|---|---|
| PubMed | section 4, as written (2024-01-01 –) | 83 |
| PubMed | same, from 2023-07-01 | 94 |
| PubMed | same, from 2023-01-01 | 104 |
| OpenAlex | section 4, as written (2024-01-01 –) | 106 |
| OpenAlex | same, from 2023-07-01 | 116 |
| OpenAlex | same, from 2023-01-01 | 128 |
| PubMed | first-draft string (fewer synonyms), from 2023 / 2022 / 2021 | 88 / 108 / 125 |
| OpenAlex | first-draft string, from 2023 / 2022 / 2021 | 100 / 123 / 146 |
| PubMed | first-draft exergame block alone, from 2021 | 2,415 |
| PubMed | first-draft exergame AND motivation blocks, no design block, from 2021 | 392 |

Terms piloted after the critique, as PubMed records added to the 2023 string: the
motivation and design additions together +2; `"virtual reality game*"` +4, `"VR game*"`
+5, `"video game-based"` +4, `"game-based training"` +3, `"game-based rehabilitation"`
+1; eleven other terms +0. All kept. `"serious game*"` +46 and `"Video Games"[MeSH]`
+65: left out.

What they imply:

- **Records at title/abstract.** 189 before deduplication. The overlap between the two
  sources is not known until the records are retrieved. If one-third to two-thirds of
  the PubMed set is also in OpenAlex, about 135–160 unique records. Citation searching
  adds at most (160 − that number), capped at 40, so the total at title/abstract stays
  at or under 160. The expanded strings from 2023 would give roughly 165–195, over the
  limit of roughly 150; that is why the range starts in 2024. If the database set alone exceeds
  160 after deduplication, the run stops and asks (section 5).
- **Full texts.** E1, E7, E8 and E9 are decidable from an abstract, and E2, E3, E4 and
  E6 usually are. E5 mostly is not: abstracts say "motivation" without naming an
  instrument, and the liberal rule advances every `unsure`. The drafter's estimate —
  an estimate, not a measurement — is that reviews, protocols, non-randomized and
  single-session studies remove a little over half, so **about 55–75 records reach full
  text**.
- **Inclusions.** Estimated at **10–20 studies**. The uncertainty is real: the estimate
  rests on a guess at how many trials that mention motivation measured it with a named
  instrument and reported it for both arms. If it comes in over 20, gate 2 presents the
  count and narrowing options.
- **Reading load.** Each record is screened by two agents; each full text is read by
  two screeners, and each included study additionally by one extractor and two judges,
  plus an adjudicator where the judges differ.

## 14. Amendments

| Date | Change | Reason |
|---|---|---|
| 2026-11-28 | **A1 — when E5 may be cited at title/abstract.** Added to the I5/E5 row's stage rule: at title and abstract, E5 is cited only when the abstract itself says how motivation was assessed and that way is on I5's Out list (interviews or focus groups only, a single item, adherence or play time as the measure, enjoyment alone), or when the report is qualitative only. An abstract that lists its outcomes or instruments and names no motivation instrument does **not** show there is none; the record is answered `unsure` and goes to full text. Eligibility itself is unchanged. Made by the orchestrator during calibration, before the full screening run; **not approved by the user in advance — listed at gate 2 for ratification.** It can only advance more records, never exclude one. **Ratified by the user on 2026-11-28, in their answer to gate 2 (decision 1.4).** | Calibration pilot (20 records): both screeners excluded 6 records under E5 because the abstract's outcome list named no motivation instrument, and one or both recorded a doubt on each that the list might not be exhaustive. Section 2 already marks E5 as needing the full text "unless the abstract names the instrument or shows there is none", and section 13 estimates full-text volume on that reading; the pilot showed screeners reading "shows there is none" more loosely than the protocol intends. The search requires a motivation term in every record, so a motivation measure reported only in the full text is the case the review most needs to find. |
| 2026-11-28 | **A2 — a third full-text retrieval route.** Sections 1, 3 and 6 now name, beside open-access PubMed Central and arXiv, the open-access copies OpenAlex lists for a record, fetched by `fetch_fulltext.py --oa-copies` (PDF only, converted with `pdftotext`, title-checked; nothing from a location OpenAlex does not mark open access; no copy fetched by hand). Run as a second pass over the 35 records the first two routes did not reach; every newly retrieved report is screened at full text by two independent screeners, with the quote check and adjudication, like any other. A copy may be a preprint (`submittedVersion`); the review names the reports read as preprints and states it as a limitation. The route did not exist when the run began: it came with the plugin's update from 0.3.0 to 0.4.0, made between gate 2 being written and being answered. **Approved by the user on 2026-11-28, in their answer to gate 2 (decision 1.1).** | Gate 2: 35 of 62 reports sought were not retrieved by the two approved routes, 24 of them not in PubMed at all, so the inclusion set described the retrieval route more than the literature. |
| 2026-11-28 | **A3 — I2/E2, two borderline kinds of allocation are in.** I2 now counts as random allocation (a) random allocation after which a minority of participants were reassigned at their own request before the intervention began, and (b) allocation the paper describes as random but made by a constrained or pseudo-randomized procedure. E2 carries the mirror wording: it is not cited for either. The weakness is carried by risk of bias (D1, D2). Consequences: `pm-41628428` is included by the user's decision; `pm-42974341`, excluded by both screeners under E2 and judged on I2 only, is re-screened at full text on all criteria; every other E2 exclusion at either stage is checked against the new wording and re-screened if it could be decided differently. **Approved by the user on 2026-11-28, in their answer to gate 2 (decision 1.2).** | Gate 2: the adjudicator escalated `pm-41628428` because I2/E2 did not say which side of the line reassignment-after-randomization falls; the user chose to include both borderline trials and let the risk-of-bias rating carry the weakness. |
| 2026-11-28 | **A4 — I1, a scored movement-training system is an exergame.** Added to I1's In cases: a movement-training system that gives the player a running score for matching target movements is an exergame under I1, whether or not the paper calls it a game. `pm-40567995` and `pm-43021294` stay in; the appraisal judges rule on eligibility again from the full paper. **Approved by the user on 2026-11-28, in their answer to gate 2 (decision 1.3).** | Gate 2: three of four inclusions were doubtful, two of them on I1 (a Kinect system that scores limb angles against a model and is never called a game). |
| 2026-11-28 | **A5 — I4, conflicting durations.** Added to I4/E4: where a paper gives conflicting durations, the schedule in the Methods decides over the Abstract. **Approved by the user on 2026-11-28, in their answer to gate 2 (decision 1.4).** | Proposed by the screening adjudicator on `pm-41384807`, whose Abstract says seven weeks and whose Methods and Results say one; the exclusion under E4 now follows from the criterion rather than from a reading. |
| 2026-11-28 | **A6 — I1, an authors' label with exercise described in the game.** Added to I1's In cases: an intervention the paper calls an exergame and describes as exercise performed in the game meets I1 unless the text shows the input is not body movement. `oa-W7220097264` is kept, marked doubtful; the appraisal judges rule on its eligibility from the full paper, and the synthesis states its conclusions with and without the doubtful studies. `oa-W7220200190` stays excluded as the adjudicator decided: its text describes the input, and it is tracking. **Approved by the user on 2026-11-28, in their answer to the revised gate 2 (decisions 1.2 and 1.3).** | Revised gate 2: `oa-W7220097264` never names its game or headset and never says body movement is the game input; its exergame status rested on the authors' label, and I1 did not say whether a label is enough. |
| 2026-11-28 | **A7 — I6, a composite score counts.** Added to I6's In cases: a composite or total score of the I5 instrument, reported for both arms, meets I6; how it was formed is a matter for extraction and D4. **Approved by the user on 2026-11-28, in their answer to the revised gate 2 (decision 1.2).** | Revised gate 2: `oa-W7220097264` reports one composite "Exercise Motivation" score per arm from a six-subscale instrument, and both screeners recorded a doubt on I6. |
| 2026-11-28 | **A8 — I6, any one non-exergame arm is enough.** Added to I6's In cases: in a trial with several non-exergame arms, results on the I5 instrument for the exergame arm and any one non-exergame arm meet I6. **Approved by the user on 2026-11-28, in their answer to the revised gate 2 (decision 1.2).** | Revised gate 2: `pm-42974341` gave its motivation instrument to the exergame and wobble-board groups and not to the no-training control, and both screeners recorded a doubt on I6. |
| 2026-11-28 | **A9 — I1, muscle-activation input is out.** Added to I1's Out cases: a game whose input is muscle activation sensed by EMG, force or torque sensors without required movement of the limb or trunk. `pm-42261097` is excluded under E1 by the user's decision (`decided_by=human`); it was excluded under either reading, and only the code was open. No other record screened uses myoelectric or isometric control, so none was re-checked. **Approved by the user on 2026-11-28, in their answer to the revised gate 2 (decision 1.3).** | Revised gate 2: the screening adjudicator escalated `pm-42261097` on the exclusion code (E1 or E3), because I1's cases did not cover myoelectric input. |
| 2026-11-28 | **A10 — D5, a total reported in place of the subscales.** Added to the D5 High anchor in section 8: reporting only the total or composite score of an instrument whose subscales the Methods name is rated Some concerns under D5, unless a registration or protocol named the subscales as outcomes; how the total was formed is rated under D4. Consequences: D5 is Some concerns for `pm-40567995` and `pm-43021294` by the user's ruling, entered in each study's adjudication file as decided by the user. The D5 High that both judges gave `oa-W7220097264` was agreed, but on the reading this amendment rejects; that one domain is sent back to agents that read the paper, to be rated under this sentence, and the conduct disclosure says so. **Approved by the user on 2026-11-28, in their answer to gate 3 (Q1, sentence (a)).** | Gate 3: the appraisal adjudicator escalated D5 for two studies because the High anchor's "only some of the subscales" could be read as covering a total reported in place of every subscale, or as covering only a subset. |
| 2026-11-28 | **A11 — `direction`, composites and interactions.** Added to the `direction` definition in section 7: (a) a composite decides `direction` only when the paper states how it is formed and its valence follows from that; otherwise the code is `other`, and the result is recorded in `motivation_result`; (b) a time × group interaction on the I5 instrument counts as the between-group test at end of intervention when the paper reports no separate test there. Consequence: `oa-W7220097264`'s `direction` is `other` by the user's ruling, entered in its adjudication file as decided by the user. The agreed `favours exergame` of `pm-41307454`, which rests on interaction P values, stands under (b) and was not reopened. **Approved by the user on 2026-11-28, in their answer to gate 3 (Q2a, first sentence; Q2b).** | Gate 3: the adjudicator escalated `oa-W7220097264`'s `direction`. Its only motivation result is a composite of unstated construction from subscales of opposite valence, tested by a group main effect and a time × group interaction; section 7 did not say whether either decides the code. |
| 2026-11-28 | **A12 — `exergame_platform`, the input device decides.** Added to the `exergame_platform` definition in section 7: when an exercise machine is the game input and the game is displayed in an immersive headset, the input device decides: code `exercise equipment with game`. Consequence: `pm-41307454`'s `exergame_platform` is `exercise equipment with game` by the user's ruling, entered in its adjudication file as decided by the user. **Approved by the user on 2026-11-28, in their answer to gate 3 (Q3).** | Gate 3: the adjudicator escalated the platform code of a game bike seen through a headset; section 7 codes by hardware and gave no precedence between the two values. |
| 2026-11-28 | **A13 — which domain carries reassignment at participants' request.** Added to A3's wording in section 2 and to section 8: reassignment at participants' request after allocation is rated under D2; D1 carries a constrained or pseudo-randomized procedure. The adjudicator's D1 Some concerns for `pm-41628428` stands. **Approved by the user on 2026-11-28, in their answer to gate 3 (Q4).** | Gate 3: the judges of `pm-41628428` split on D1 because A3 said the weakness is rated "under risk of bias, D1 and D2" without saying which; the adjudicator decided it and proposed writing the rule down. |
