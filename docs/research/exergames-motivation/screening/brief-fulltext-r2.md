# Screening brief — full-text stage

## The question (verbatim from the protocol)

> In randomized controlled trials whose first results report was published from 2024 onward, does an exergame
> programme lasting two weeks or more change participants' motivation for exercise,
> measured with a named multi-item motivation instrument, compared with an arm that
> has no exergame — and how much can that evidence be trusted?

## Stage

Full text. Each record in your batch has a saved text at `fulltext/<record_id>.txt`
in the directory you were given. Read that file and never fetch anything. If a
record's file is missing, answer `unsure` with the rationale `no saved full text`.

## Decision rules

- **Every criterion is decidable at this stage.** Decide `include` or `exclude` for
  every record from its saved text. `unsure` is only for a text that is missing,
  truncated before its methods or results, or is not the full paper.
- Every `exclude` cites one exclusion code and its label exactly as the table below
  writes them, e.g. `E5: No named motivation instrument`. E-codes only, never
  I-codes, no invented sub-codes.
- Where a record fails several criteria, cite the lowest-numbered exclusion code that
  applies, except that E9 is cited for anything that is not a primary report.
- One paper at a time: open one record's text, decide it, write its row, then open
  the next.
- In the rationale, quote the passage that decided the record, in double quotes, with
  its location (section name). Copy the words from the saved file; shorten with
  `...`, never by rewording. Every quotation is checked by script against that
  record's saved text.
- For an `include`, the rationale names the motivation instrument that meets I5 and
  quotes where its results are given for both arms (I6).
- If the text shows the record is a report of a trial that another report also
  describes (a secondary analysis, a follow-up, a preprint of a published paper), say
  so in the rationale and name the other report as the text gives it.
- Fill the `doubt` column when a criterion, as written, did not clearly decide a
  record: the criterion code, then the question it leaves open. Record it above all
  when you include.
- Some saved texts were converted from a PDF. A page header, footer or sidebar can
  land in the middle of a sentence there, and a quotation that runs across one will
  not verify. Quote from within a paragraph, and keep quotations short.
- Output columns, in this order: `record_id,decision,criterion,rationale,doubt`.

## Eligibility criteria (verbatim from the protocol, section 2, as amended 2026-11-28)


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
it a game (amendment A4).
Out: movement feedback alone — speed, distance, heart rate, accuracy or posture cues,
or virtual scenery that moves with pedalling or walking — with no goal or score: that
is not a game; a fitness app or wearable that awards points or badges for steps
(gamification, not an exergame); a mobile game whose state changes from step or
distance totals accumulated outside a play session; a seated video game played with a
hand controller; a game controlled only by finger or hand movement on a screen or
controller; cognitive-training games; a robot or exoskeleton that moves the limb
passively.
A mixed programme (exergame plus conventional exercise in the same arm) is in under
I1; whether it is in overall turns on I3.

**I2 / E2 — randomized.**
In: parallel, cluster-randomized and randomized crossover trials; trials called pilot
or feasibility, if randomized; random allocation after which a minority of
participants were reassigned at their own request before the intervention began; and
allocation the paper describes as random but made by a constrained or
pseudo-randomized procedure (both by amendment A3 — the weakness is rated under risk
of bias, D1 and D2, not decided here).
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
text, table, figure or supplement.
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

The column "Decidable at title/abstract?" in the table above does not apply at this
stage.
