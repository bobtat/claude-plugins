# Protocol critique 2: Exergames and exercise motivation

Reviewed: revised `protocol.md` (draft, 2026-11-28), against `protocol-critique-1.md`
(F1 to F20). The criteria come from the `literature-review:literature-review` references.
The user's limits in section 1 are fixed and are not reported on.

**Round-1 status:** F1 to F14 and F16 to F20 are resolved as applied. F15's valence rule
and multi-arm value were added, but each leaves a case undecided (G3, G4). No other
round-1 finding was left unfixed.

**Count:** 0 High, 4 Medium, 3 Low.

---

### G1. Medium. Charter 2 (I3/E3), new. Section 2

**As written, E3 excludes every randomized crossover trial. I2 and D2 explicitly admit them.**

> I3: "At least one arm receives no exergame"; E3: "Every arm receives an exergame"
> I2 In: "parallel, cluster-randomized and randomized crossover trials"
> I4 In: "a crossover trial in which each condition lasts two weeks or more"

The hardest case is a crossover trial of exergame versus conventional exercise. The arms of a
crossover trial are its sequences (AB and BA), and every sequence contains the exergame. So
"every arm receives an exergame" and the trial fails I3. One screener will read "arm" as
a sequence and exclude it. The other will read it as a condition and include it. I6 has
the same problem ("results ... for the exergame arm and for a non-exergame arm").

**Fix:** add to section 2: "In a crossover trial, 'arm' in I3, I6, E3 and E6 means
condition (period treatment), not sequence."

### G2. Medium. Charter 8 (D4 anchors), new. Section 8

**A trial can earn D4 Low and High at once, because the Low anchor does not check the instrument.**

> Low: "Only when participants were unaware of the study hypothesis and of the other arm"
> High: "... or the instrument was written for the study or is otherwise unvalidated"

Example: a school cluster trial whose pupils are not told there is another arm. It uses
a named questionnaire the authors wrote (I5 admits these, "its lack of validation is
rated under D4"). The unaware pupils make it Low, and the study-written instrument makes it High.

**Fix:** Low becomes "Participants were unaware of the study hypothesis and of the other
arm, **and** every Some-concerns condition on the instrument and its administration is met."

### G3. Medium. Charter 8 (data items: `direction`), F15 not fully fixed. Section 7

**Extractors will split between `mixed across subscales` and a single direction. The
valence rule leaves common subscales and motives instruments without a direction.**

> "`mixed across subscales` when subscales of one instrument, or two instruments, differ
> in result against the same comparator"
> "Favouring an arm means higher intrinsic, identified, integrated, autonomous or
> need-satisfaction scores, or lower amotivation, external or introjected regulation or
> IMI pressure/tension"

- **Partial significance.** Take an IMI trial where interest/enjoyment favours the exergame and
  competence, effort and value show no difference. Read literally, "differ in result" makes it
  `mixed`. Many extractors will code `favours exergame` because one subscale differs and none
  goes against the exergame. If the literal reading holds, nearly every multi-subscale trial
  becomes `mixed`, and the direction counts and the evidence map lose their contrast.
- **Summary score against subscales.** Take a BREQ trial reporting a relative autonomy index that
  favours the exergame, with mixed subscales. The protocol does not say which decides.
- **No valence.** The protocol does not say which way IMI effort/importance and value/usefulness
  point. Nor does it say which way the motives of the Exercise Motivations Inventory and the
  Motives for Physical Activity Measure point (health, appearance, social). Both instruments are listed in I5.

**Fix:** "`mixed across subscales` only when at least one subscale favours each arm.
One or more subscales favouring an arm, with the rest showing no difference, is coded as
favouring that arm. A composite index (RAI, IMI total) decides over its subscales when
reported. IMI effort and value count with intrinsic motivation. Motives instruments
(EMI, MPAM) have no valence: code `other` and describe the result in `motivation_result`."

### G4. Medium. Charter 8/9 (`direction`, thread 1), F15 partial. Sections 7, 9

**The single-row design leaves two cases undecided. It also leaves thread 1 with no
coded source for the trials it most needs.**

> "`mixed across comparators` when a trial with two or more non-exergame arms gives
> different results against them"
> Section 9: "Direction of effect is tabulated per study from `direction`"; thread (1)
> "exergame versus conventional exercise, against exergame versus inactive or usual-care
> comparators"

- Take a three-arm trial that is mixed across subscales against the conventional-exercise arm and
  favours the exergame against wait-list. Both `mixed` values fit, and the protocol does not
  say which takes precedence.
- Thread 1 is the comparison a three-arm trial informs most directly. Section 9 tabulates
  only from `direction`, so these trials are coded `mixed across comparators` and fall
  out of both sides of thread 1. That happens unless someone parses free text that the
  protocol never says to use.

**Fix:** add to `direction`: "`mixed across comparators` takes precedence over `mixed
across subscales`." Add to section 9: "For trials coded `mixed across comparators`, thread
1 takes the direction against each comparator from `motivation_result`, which records it
per comparator using the same values and the same valence rule."

### G5. Low. Charter 2 (I7 decidability), new. Section 2

> I7 "The trial's first results report was published on or after 2024-01-01 | yes"

The revised I7 depends on whether an earlier results report of the same trial exists.
A 2024 secondary report's abstract usually does not say so. "Yes" tells screeners the
record's own date settles it, so the case is never checked at full text.

**Fix:** mark I7 "partly: the record's own date decides at title/abstract. At full text,
a report that cites earlier results of the same trial is judged by that earlier report's date."

### G6. Low. Charter 2 (E6 wording), new. Section 2

> E6: "The report gives no post-baseline results on the I5 instrument for both an
> exergame arm and a non-exergame arm"

"Gives no results for both" can be read as "results for neither". On that reading, an
exergame-arm-only report is not E6, yet I6's cases say it fails I6. It is then left with
no exclusion code.

**Fix:** "The report does not give post-baseline results on the I5 instrument for at
least one exergame arm and at least one non-exergame arm."

### G7. Low. Charter 8 (instrument fit), missed in round 1. Sections 2, 8

> I2 In: "cluster-randomized"; section 8: "RoB 2 (Sterne et al., BMJ 2019)", domains
> D1 to D5

School-based exergame trials are often cluster-randomized. The RoB 2 cluster variant adds a
domain (1b) for identifying and recruiting participants after randomization. The protocol has
no anchor for it, so recruitment bias in a cluster trial goes unrated.

**Fix:** "Cluster-randomized trials are rated with the RoB 2 cluster variant, adding D1b
(timing of identification and recruitment). Low: all participants were identified before
randomization. High: participants were recruited after the clusters were allocated, and
that could have been influenced by knowing the allocation. Some concerns: otherwise."

---

## What would most improve the protocol, ranked

1. **G1:** define "arm" for crossover trials. Otherwise E3 silently excludes a design
   the protocol admits and has written D2 anchors for.
2. **G3 and G4:** settle `direction` (partial significance, composite against subscales,
   valence for motives instruments, precedence between the two `mixed` values). Also route
   thread 1 to the per-comparator results. The direction counts, the evidence map and thread 1
   all depend on this column.
3. **G2:** make D4 Low conditional on the instrument as well as on unawareness, so no
   trial can be Low and High at once.
