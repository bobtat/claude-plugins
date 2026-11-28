# Protocol critique 1: Exergames and exercise motivation

Reviewed: `protocol.md` (draft, 2026-11-28). Criteria: `literature-review:literature-review`
references `search-strategy.md`, `appraisal.md`, `prisma.md`, `figures.md`; template rules
in `literature-review:review-protocol`.

The user's limits (section 1) are taken as fixed. The findings below are about places
where the protocol does not honour them, places where a criterion, string or anchor will
not work within them, and costs of the limits the protocol does not state.

**Count:** 3 High, 11 Medium, 6 Low.

---

## Is the operational question a fair reading?

The question in section 1 is a question, not a topic. Every criterion I1 to I8 can be
read off it, so charter item 1 does not apply. It is **a fair reading of one sense** of
"exergames and motivation": do exergames change motivation compared with not using
them? It leaves out three things the user's wording plausibly covered. The gate should
put these to the user by name.

1. **What it is about exergames that motivates.** E3 excludes "one exergame versus
   another; the same exergame with and without a feature (multiplayer, immersion, a
   narrative)". Much of the HCI and games-research literature on motivation is these
   head-to-head design trials. The limits did not force this exclusion; the drafter's
   reading did. Section 1's "What the limits cost" paragraph does not mention it.
2. **Motivation as a predictor or moderator of exergame use** (who keeps playing, and
   why). Those studies are observational, so the design restriction excludes them. The
   paragraph says non-randomized studies are lost, but not that this question is lost.
3. **"Current state" as a map of the field.** An RCT-only, 2023-onward effect question
   cannot describe what kinds of exergame motivation research exist. That may be what
   the user wanted.

There is also a construct choice the user should confirm. I5 counts "basic psychological
need satisfaction scales for exercise (PNSE, BPNES)" as motivation instruments. In
self-determination theory these measure antecedents of motivation, not motivation. A
trial that measured only PNSE would contribute to a conclusion about "motivation". At
the same time, PACES enjoyment is excluded while the IMI interest/enjoyment subscale is
included. Both choices are defensible, but the user should agree to them knowingly.

**Fix:** add a sentence to "What the limits cost": "The review also excludes trials that
compare exergames with each other or vary one exergame feature, so it cannot say which
design features motivate; and it treats need-satisfaction scales as motivation
measures." At gate 1, ask the user whether design-feature trials were part of what they
meant. Admitting them is a change to I3/E3 and would raise volume.

---

## Findings

### F1. High. Charter 5 / limit 2. Section 13 (also 5, 6)

**The planned title/abstract volume is over the user's limit, and there is no rule for
when it is exceeded.**

> "about 130–145 unique records, plus up to 40 from citation searching screened in a
> second pass"

130–145 + 40 = 170–185 records at title/abstract. Limit 2 is "Roughly 150 records or
fewer at title and abstract screening". The protocol does not say whether snowballed
records count toward the 150. The overlap figure ("half to two-thirds") is a guess, and
at one-third overlap the database set alone is about 159. Limit 1 has an action when it
is exceeded ("the count goes to gate 2 with options"). Limit 2 has none. Section 6 also
does not say whether the more-than-20 check runs before or after the snowballing pass.

**Fix:** add to section 5: "The citation-searching total cap is the smaller of 40 and
(160 − unique database records after deduplication). If deduplication alone leaves more
than 160 records, screening does not start; the count goes to the user with options
(drop the 2023 start to mid-2023, or run no citation searching)." Add to section 6: "The
more-than-20 check is made after the snowballing pass is screened at full text."

### F2. High. Charter 3. Sections 1, 4

**The motivation block searches titles and abstracts only. That systematically misses
trials where motivation was a secondary, null outcome, and the protocol does not state
this cost.**

> "(motivat*[tiab] OR amotivation[tiab] OR … ) AND …"
> "What the limits cost: … The review will therefore say nothing about earlier trials, …"

A trial whose motivation result was null usually leaves motivation out of its abstract.
The motivation block can only find trials that put motivation in the abstract, and
these lean toward positive or primary-outcome motivation findings. So the included set
is biased toward benefit. The search cannot recover the counter-evidence. The pilot
counts show why the block is there: the exergame block alone from 2021 is 2,415 records,
so dropping the block would break limit 2. Because of that, this is a cost to state,
not a block to remove. Section 9 discusses reporting bias only through registries.

**Fix:** add to "What the limits cost": "Because the motivation terms must appear in the
title or abstract, trials that measured motivation as a secondary outcome and reported
it only in the full text are not found. These are more likely to be null, so the
included set probably overstates benefit." Put the same sentence in section 9 under
reporting bias, and carry it into the GRADE publication-bias judgment. The instrument
names in F4 partly mitigate this at almost no volume cost.

### F3. High. Charter 2 (I1/E1). Section 2

**I1's definition and its own Out list disagree on the most common borderline case,
VR or screen exercise with feedback but no score.**

> I1: "the game has goals, scoring **or feedback** tied to that movement"
> Out: "virtual scenery shown during treadmill or bike exercise with **no goals or scoring**"

Hardest case: a VR cycling trial where scenery moves with pedalling and the screen shows
speed, heart rate or distance. That is feedback tied to movement, so it is in under I1.
It has no goals or scoring, so it is out under the Out list. The search term "virtual
reality exercise" will retrieve many such trials, as will stroke-rehabilitation "VR
training" with movement-accuracy feedback. Two screeners sharing a model will both
notice the conflict and resolve it differently from record to record.

I1 also leaves two more cases undecided:

- **Step-driven mobile game.** A virtual pet or story app whose game state advances with
  daily step totals. "Awards points or badges for steps" puts it out. "A game played by
  moving" plus the `mobile or ar` platform code suggests some mobile games are meant to
  be in.
- **Robot-assisted rehabilitation game.** The patient moves actively and the robot
  assists. The Out list covers only "a robot or exoskeleton that moves the limb for the
  patient".

**Fix:** rewrite I1 as "…the game input, and the game has a goal or score the player's
movement pursues. Movement feedback alone (speed, accuracy, posture cues) with no goal
or score is not a game." Add to Out: "a mobile game whose state changes from step or
distance totals accumulated outside a play session". Add to In: "a game played by
walking or running in real time (location-based or audio-narrative running games)" and
"a robot- or exoskeleton-assisted game in which the patient moves actively; out only
when the device moves the limb passively".

### F4. Medium. Charter 4. Section 4 (motivation and design blocks)

**The motivation block misses instrument names and terms that do not contain
"motivat".**

> "Motives for Physical Activity Measure", "Behavioural Regulation in Exercise
> Questionnaire" (I5 In list)

`motivat*` does not match "motives" or "motive", which is the MPAM's own wording.
Nor does it match "behavioural regulation", "behavioral regulation" or "BREQ", which is
how BREQ trials often describe their outcome. "Autonomous" and "controlled" regulation
are also missed. The PubMed design block has `randomi*` but not `randomly`, which the
OpenAlex string does have. Crossover and pilot abstracts often say "randomly assigned"
without any randomi* word.

**Fix:** PubMed motivation block, add `OR motive*[tiab] OR "behavioral regulation"[tiab]
OR "behavioural regulation"[tiab] OR BREQ[tiab] OR "autonomous regulation"[tiab]`.
Design block, add `OR randomly[tiab] OR RCT[tiab]`. OpenAlex, add `OR motives OR motive
OR "behavioral regulation" OR "behavioural regulation" OR BREQ`. Re-pilot; these should
add few records.

### F5. Medium. Charter 4. Section 4 (exergame block), section 5 (snowball filter)

**The exergame block lacks the rehabilitation and HCI terms for the same thing.**
Section 5 reuses the block as the title filter for reference lists, so each missing
term is missed twice.

Missing:
- `"serious game*"` (the dominant rehabilitation term)
- `"exertion game*"` (the HCI coinage, and the source OpenAlex is meant to cover)
- `"virtual reality game*"` / `"VR game*"`
- `"video game-based"`
- `"game-based training"` / `"game-based rehabilitation"`
- `"dance game*"` / `"Dance Dance Revolution"`
- `"motion-controlled gam*"` / `"movement-based gam*"`
- `"location-based game*"`
- platform and title names: `"Nintendo Switch"`, `Xbox`, `"EyeToy"`, `"Just Dance"`,
  `"Beat Saber"`

PubMed also has the MeSH heading `"Video Games"[MeSH]`, and `Exergaming` sits under it.
`"serious game*"` may add materially to volume. It must be pilot-counted, not just
added.

**Fix:** pilot each addition against the current string. Keep those that add fewer than
about 10 records each, within F1's headroom. Name the ones dropped for volume in
"What the limits cost" (for example: "trials described only as serious games are not
searched for").

### F6. Medium. Charter 4. Section 4 (OpenAlex)

**The OpenAlex string is not a faithful translation of the PubMed string. Four
PubMed concepts are missing.**

PubMed has `"exer-gam*"`, `"exercise videogam*"`, `"motion-based gam*"` and `"VR
exercise"`. The OpenAlex block has none of them. The section says "plural and spelling
variants are written out", but "active video gaming", "exergamer", "exer-game" and
"exer-gaming" are not.

**Fix:** add to the OpenAlex exergame block `OR "exer-game" OR "exer-games" OR
"exer-gaming" OR "exercise videogame" OR "exercise videogames" OR "motion-based game"
OR "motion-based games" OR "VR exercise" OR "active video gaming"`, plus the F5 terms
that survive piloting.

### F7. Medium. Charter 2 (I4/E4). Section 2

**"Two weeks" and "14 days" diverge for the most common short programme.**

> I4: "scheduled to last 14 days or more"; Out: "several sessions scheduled within 13
> days or fewer"

Hardest case: "a 2-week programme, five sessions per week" (Monday of week 1 to Friday
of week 2). The paper says two weeks, so it is in. The span of scheduled sessions is 12
days, so it is out. Two-week, ten-session rehabilitation programmes are common in this
literature.

**Fix:** "In: a programme the paper describes as lasting two weeks or more, or whose
scheduled sessions span 14 days or more counting from the first session day. A stated
number of weeks decides over a count of days."

### F8. Medium. Charter 2 (I7/E7). Section 2

**I7 dates the report, but the question dates the trial. Preprints are not addressed.**

> Question: "In randomized controlled trials first published from 2023 onward"
> I7: "[The report was] First published (online or in print, whichever is earlier) on
> or after 2023-01-01"
> I2 note: "A secondary or follow-up report of an eligible trial is in, and is grouped
> with its parent"

Hardest case 1: a 2024 secondary report giving the motivation results of a trial whose
main report appeared in 2021. By I7 as written, it is in. By the question, it is out.
And if it is in, grouping it "with its parent" pulls in a pre-2023 parent.

Hardest case 2: a 2023 JMIR Serious Games trial whose JMIR Preprints record went up in
2022. JMIR is a main venue here and posts submissions publicly. "First published
online" could mean the preprint.

**Fix:** "I7: The trial's first results report (the version of record, online-first or
print, whichever is earlier) is dated on or after 2023-01-01. Preprints and registry
postings do not count. A later report of a trial whose first results report predates
2023 fails I7."

### F9. Medium. Charter 2 (I5/E5, I6/E6). Section 2

**I5 holds two conditions (a named multi-item instrument, and measurement in both
arms). The second duplicates I6, so one record can be excluded under either code.**

> I5: "…was measured in the exergame arm and the comparator arm with a named
> multi-item self-report instrument"; "A measure taken in the exergame arm only fails I5."
> I6 Out: "a report giving motivation results for the exergame arm only"

A trial that administered the IMI only to the exergame arm fails both I5 and I6. No
precedence rule exists, so screeners will split the reason between E5 and E6, and the
flow diagram's reason counts become arbitrary.

Two hard cases are also undecided:

- **A motivation subscale inside a non-motivation instrument.** For example, a
  three-item subscale headed "motivation" in a named user-experience questionnaire. The
  catch-all needs an "instrument … that it describes as measuring motivation", and here
  only the subscale is.
- **A named questionnaire the authors wrote for this study.** The Out list excludes only
  "an unnamed questionnaire written for the study".

**Fix:** I5 becomes "Motivation … was measured with a named multi-item self-report
instrument or subscale whose items concern motivation or motives." Move "measured in
both arms" into I6 alone, and move the "exergame arm only" sentence to the I6 cases.
Add to section 2: "Where a record fails several criteria, cite the lowest-numbered
exclusion code." Add one line deciding the study-written named questionnaire either
way. If in, D4's "unvalidated" anchor handles it.

### F10. Medium. Charter 8 (D2). Section 8

**The D2 "Low" and "Some concerns" anchors both fit an ordinary intention-to-treat
trial.**

> Some concerns: "Participants knew their arm (unavoidable here) and analysis is
> intention-to-treat…"
> Low: "Analysis keeps participants in their randomized arms, and no deviations arose…"

Every exergame trial has unblinded participants. So an ITT trial with no reported
deviations meets Low and also meets the first clause of Some concerns. One judge will
read "unavoidable" as a floor, the other will not.

**Fix:** decide which it is. Either state, as D4 does, "Low is not attainable; awareness
is always present", or rewrite Some concerns as "deviations arising from the trial
context (extra sessions, co-interventions, comparator participants seeking exercise) are
reported or likely, are balanced between arms, and the analysis is ITT or modified ITT.
Awareness of arm alone does not move a trial off Low."

### F11. Medium. Charter 8 (D3). Section 8

**D3 has a gap between Some concerns and High, and an overlap between Low and High.**

> Low: "available for 90% or more … in each arm"; Some concerns: "more than 10% and up
> to 20% in any arm, with similar proportions and reasons across arms"; High: "more
> than 20% …, or … differing between arms by more than 10 percentage points, or reasons
> related to the intervention (dislike, boredom)"

- **Gap:** 15% missing in the exergame arm and 5% in the comparator. The difference is
  10 points, which is not "more than 10", so it is not High. The proportions are not
  similar, so it is not Some concerns. The same gap applies to 15% missing with no
  reasons reported, which is the usual case.
- **Overlap:** 8% missing from the exergame arm, citing cybersickness or boredom. That
  is Low by the 90% rule and High by the reasons clause.

**Fix:** "Low: ≥ 90% available in each arm and no arm's missingness is attributed to the
intervention, or robust handling. High: [as written]. Some concerns: every case that is
neither Low nor High, including missingness of 10–20% with reasons not reported."

### F12. Medium. Charter 8 (D4). Section 8

**D4's "High" anchor catches the standard way the IMI is used, and a single trial can
fit both Some concerns and High.**

> Some concerns: "The I5 instrument is a validated one … and the wording refers to
> exercise or the sessions generally"
> High: "The instrument's items refer to the game or favour one arm, … or the
> instrument was unvalidated or modified without testing"

The IMI is designed to be adapted to the target activity ("this activity" becomes
"playing this game" or "these exercises"). Nearly every IMI trial "modified" it. One
judge reads that as standard use of a validated instrument (Some concerns). The other
reads "modified without testing" and "items refer to the game" (High).

Paper that earns both: a trial giving the IMI interest/enjoyment subscale, worded "this
game" in the exergame arm and "these exercises" in the comparator arm.

**Fix:** "Adapting the IMI's activity referent, or translating a validated version, is
not modification. High when items were added, removed or rewritten beyond the
referent, or when the exergame arm's items rate game features (graphics, the game
itself) that the comparator arm's items have no counterpart for."

### F13. Medium. Charter 8 (D5). Section 8

**D5 leaves retrospective and unspecific registrations without a level. Its High
anchor would catch every trial that by design gives only part of an instrument.**

> Low: "A registration … dated before enrolment names the motivation instrument and
> time point"; Some concerns: "No registration or protocol, or one that does not name
> the motivation outcome…"; High: "…only some subscales or time points of the
> instrument are reported"

- **Gap:** a registration made after enrolment that names the IMI. It is not Low and
  matches neither Some concerns clause. Similarly, a prospective registration naming
  "motivation" but no instrument.
- **Overlap:** a prospectively registered trial that names the IMI interest/enjoyment
  subscale and reports only that subscale. It matches its registration, so it is Low.
  It reports "only some subscales of the instrument", so it is High. I5 explicitly
  admits subscale-only use.

**Fix:** "only some of the subscales or time points that the methods or registration say
were administered". Add to Some concerns: "registration after enrolment, or one naming
motivation without an instrument or time point".

### F14. Medium. Charter 8 (scale). Section 8

**"No information" is allowed as a domain judgment, but the overall rule does not say
how it counts. The pipeline's script ignores it.**

> "Scale: Low < Some concerns < High · No information: No information · Overall: worst
> domain"

`appraisal_check.py` (`overall_for`) takes the worst domain among the rated ones and
skips "No information". A trial with No information on D1, D3 and D5 and Some concerns
on D4 is therefore rated Some concerns overall. That is the same as a fully reported
trial, so the overall rating is optimistic for exactly the poorly reported pilots this
literature is full of. RoB 2 itself has no "No information" domain judgment. NI is an
answer to a signalling question, and the RoB 2 algorithms map it to Some concerns or
High.

**Fix:** drop the "No information" line for RoB 2 and add: "A signalling question
answered No information is mapped by the RoB 2 algorithm; each domain receives Low, Some
concerns or High."

### F15. Medium. Charter 8 (data items). Section 7, `direction`

**`direction` cannot be coded the same way twice for multi-arm trials, or for
subscales where higher is not better.**

> "favours exergame; no between-group difference; favours comparator; mixed across
> subscales; …"

- **Multi-arm:** an exergame vs conventional exercise vs wait-list trial, favouring the
  exergame over wait-list with no difference against conventional exercise. "Mixed
  across subscales" is defined only for subscales and instruments, so the extractor has
  no value that fits. This matters because thread 1 contrasts exactly these comparators.
- **Valence:** a BREQ trial where the exergame arm shows higher introjected or external
  regulation and no difference in intrinsic regulation. One extractor codes "favours
  exergame" (more motivation). Another codes "favours comparator" (more controlled
  motivation) or "mixed".

**Fix:** code `direction` once per comparison, one row per comparator arm, with
`comparator_type` taking exactly one value per row. Add: "Favouring means higher
intrinsic, identified, integrated or need-satisfaction scores, or lower amotivation,
external or introjected scores, or IMI pressure/tension. An instrument with subscales
favouring in opposite directions is `mixed across subscales`."

### F16. Medium. Charter 8 (data items). Section 7, `exergame_platform`

**A researcher-built game on commercial camera or headset hardware fits two values.**
Thread 3 ("by platform") depends on this column.

> "console or camera motion game; immersive vr headset; … custom rehabilitation system"
> "A commercial console title is `console or camera motion game` even in a clinic"

The rule covers commercial titles only. A Kinect-based stroke-rehabilitation game written
by the authors fits both `console or camera motion game` and `custom rehabilitation
system`. The same goes for a custom game in a Meta Quest headset. Both are common in this
literature.

**Fix:** "Code by hardware. `custom rehabilitation system` only for purpose-built
hardware (a dedicated sensor rig, balance platform or device). Custom software on
commercial camera or headset hardware takes the hardware's value."

### F17. Low. Charter 8 (data items). Section 7, `population_group`

> "adults: 18 and over with no lower bound of 60+; older adults: lower bound of 60 or
> over (or described as older adults)"

A sample aged 55 and over that the paper calls "older adults" is `adults` by age and
`older adults` by description.

**Fix:** "The age lower bound decides; the paper's description decides only when no
bound is given."

### F18. Low. Charter 8 (data items). Section 7, `health_status`

No value fits neurodevelopmental conditions. Children with autism, ADHD, developmental
coordination disorder or intellectual disability (all common exergame populations) fit
both `neurological` and `mental health`.

**Fix:** add `neurodevelopmental` as a value, or state which existing value takes these
conditions.

### F19. Low. Charter 2 (I2). Section 2

> I2 "Randomized allocation … | yes"; "A criterion marked 'partly' is answered `unsure`"

Pilot and feasibility abstracts often say "participants were assigned to an exergame or
control group" without saying how. I2 is marked fully decidable, so screeners have no
instruction to answer `unsure`, and some will exclude under E2.

**Fix:** mark I2 "partly: `unsure` when the abstract describes two or more arms without
saying how allocation was made".

### F20. Low. Charter 10 (PRISMA 11, 13b, 13f, 15). Sections 8, 9

- **Item 11:** section 8 names the tool but not how many judges rated each study or
  whether they worked independently. "Two judges" appears only in section 13's reading
  load. Fix: add "Two judge agents per study, independently and with no shared context;
  an adjudicator settles differences."
- **Item 13f:** "Conclusions are stated with and without any study marked doubtful at
  appraisal". "Doubtful" is never defined. Fix: "with and without studies rated High
  overall, and with and without studies whose eligibility the judges disputed".
- **Items 13b and 15:** no statement of how GRADE imprecision is judged without a pooled
  estimate, or of what happens when only within-group results are reported. Fix: one
  sentence each (for example: "imprecision is judged from total randomized N and the
  consistency of direction; within-group-only results are coded `not tested between
  groups` and do not count toward a direction").

---

## What would most improve the protocol, ranked

1. **Make the volume honour limit 2 (F1), and state the search's directional bias
   (F2).** As drafted, the plan exceeds the user's title/abstract limit with no
   stopping rule, and it does not disclose that its motivation-in-abstract design leans
   toward positive trials.
2. **Repair I1 (F3), and settle the I4, I7 and I5/I6 lines (F7, F8, F9).** I1's
   definition contradicts its own Out list on the commonest borderline record (VR
   exercise with feedback). The others leave common cases (two-week programmes, late
   secondary reports, JMIR preprints, exergame-arm-only measures) to whichever reading
   a screener takes. Because both screeners share a model, κ will not show this.
3. **Rewrite the D2, D3, D4 and D5 anchors so no trial can earn two levels, remove "No
   information" as a domain judgment (F10 to F14), and fix `direction` for multi-arm
   trials and subscale valence (F15).** As written, a standard IMI trial can be rated
   both Some concerns and High on D4, and the overall rating ignores unreported domains.
