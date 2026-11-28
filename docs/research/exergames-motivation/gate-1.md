# Gate 1 — Protocol approval

**Written:** 2026-11-28 · **Decision:** approved, with the answers and two corrections recorded below · **Decided by:** user · **Decided:** 2026-11-28

Nothing has been searched. Only count-only pilot queries have run; no record has been
retrieved. The run resumes from this file: invoke the command again with the same
`--output` and your answers.

The protocol is `protocol.md` in this directory. The two critic reports are
`protocol-critique-1.md` and `protocol-critique-2.md`.

## Decisions needed

### 1. The question

You asked: *"What is the current state of exercise video games and motivation?"* That
is a topic, and a systematic review needs something a record can be screened against.
The protocol proposes:

> In randomized controlled trials whose first results report was published from 2024
> onward, does an exergame programme lasting two weeks or more change participants'
> motivation for exercise, measured with a named multi-item motivation instrument,
> compared with an arm that has no exergame — and how much can that evidence be trusted?

This is one reading of your topic. It leaves out, by name:

- **A map of the field.** If "current state" meant "what research exists", a scoping
  review is the right method, not this one.
- **Which design features motivate.** Trials comparing one exergame with another, or
  one exergame with and without a feature (multiplayer, immersion, narrative), are
  excluded. This is the drafter's reading, not a result of your limits.
- **Who keeps playing and why.** Those studies are observational.

**Recommendation:** approve the proposed question. It is the reading that fits your
20-study and 150-record limits, and the one where a risk-of-bias assessment means
something.

### 2. Date range and volume

| Option | Records before deduplication | Estimated unique at title/abstract | Within ~150? |
|---|---|---|---|
| **A. From 2024-01-01 (in the protocol)** | PubMed 83 + OpenAlex 106 = 189 | about 135–160, citation searching capped so the total stays ≤ 160 | yes, roughly |
| B. From 2023-07-01 | 94 + 116 = 210 | about 150–180 | marginal |
| C. From 2023-01-01 | 104 + 128 = 232 | about 165–195 | no |

The overlap between the two sources is unknown until records are retrieved, so the
unique counts are estimates. If the database set alone exceeds 160 after
deduplication, the run stops and asks before screening.

**Recommendation:** A.

### 3. Two construct choices in criterion I5

- Need-satisfaction scales (PNSE, BPNES) count as motivation instruments, although in
  self-determination theory they measure antecedents of motivation.
- Enjoyment measured alone (PACES) does not count; the Intrinsic Motivation
  Inventory's interest/enjoyment subscale does.

**Recommendation:** accept both. Excluding need-satisfaction scales is a one-line
change to I5 if you prefer the narrower construct.

### 4. Toolchain gaps

- **No OpenAlex key.** Keyless search answered every pilot query today, but it runs on
  a budget shared per network address and can run out mid-run. If it does, the
  OpenAlex search is logged as not run and you are told. Setting `OPENALEX_API_KEY`
  before resuming removes the risk.
- **No native rasterizer or LaTeX.** Figures go into the .docx through `svglib`
  (tested, works; cannot draw hatched fills, so no figure relies on hatching). The PDF
  goes through `weasyprint`: legible, not typeset, and wide tables wrap.

**Recommendation:** proceed as is; set the key if you have one.

## What the protocol says

**Criteria.** Eight inclusion criteria, each with a mirror exclusion, plus E9 (not a
primary report): exergame intervention; randomized allocation; a non-exergame
comparator; two weeks or more; a named multi-item motivation instrument; motivation
results for both arms; first results 2024 or later; English full text. Each has cases
on both sides of its line in section 2.

**Sources.** PubMed and OpenAlex. Not searched: PsycINFO, SPORTDiscus, Scopus, Web of
Science, Embase, CINAHL (no access), trial registries, grey literature.

**Scale (estimates, not measurements).** About 135–160 records at title/abstract;
about 55–75 full texts, because the instrument criterion usually cannot be decided
from an abstract; 10–20 included studies. Every record is screened by two agents;
every included study is read by two screeners, an extractor and two judges.

**Citation searching.** Backward only, one iteration, 15 references per seed, and a
total cap of the smaller of 40 and (160 − unique database records). Forward searching
is not run.

**Risk of bias.** RoB 2, on the motivation outcome, with anchors per domain. Because
participants know their arm and motivation is self-reported, nearly every trial is
expected to be rated Some concerns or worse on outcome measurement, and so overall.
The review will say this is a property of the field, not a finding about one trial.

**Synthesis.** Narrative, no meta-analysis, no forest plot. GRADE per outcome.

**Figures.** PRISMA flow diagram; risk-of-bias traffic-light and summary plots;
database contribution; an evidence map of population group by direction of effect if
five or more studies are included.

**Output.** `review.md`, `references.bib`, `.docx`, `.pdf`; APA 7.

## Limitations already fixed by the plan

- Your four limits (20 studies, ~150 records, backward-only capped citation searching,
  attended gates), stated in section 1 and reported in the review.
- **The search probably overstates benefit.** It finds only trials that mention
  motivation in the title, abstract or index terms; trials with a null secondary
  motivation result often do not. Dropping the motivation block returns thousands of
  records, so this cannot be fixed within the 150-record limit.
- **Trials described only as "serious games" are not searched for** (+46 PubMed
  records in the pilot; left out for volume).
- No trial-registry search, so unpublished trials are not looked for.

## The critique

Two rounds, 27 findings (3 High, 15 Medium, 9 Low). All accepted and applied, with
one part handled differently:

- **F15, one extraction row per comparator arm — not adopted.** The data file and the
  plugin's scripts hold one row per study. Instead `direction` has a
  `mixed across comparators` value and a valence rule, and the per-comparator results
  are quoted in `motivation_result`. The second critic round accepted this shape and
  its remaining gaps (G3, G4) were closed.

Nothing the critic raised is left unresolved.

## To resume

Reply with approval, or with changes to any of decisions 1–4. On approval the protocol
is marked approved by `user`, dated, and frozen; any later change is a dated
amendment.

---

## Decision

**Decided by:** user · **Date:** 2026-11-28

| # | Decision put | The user's answer |
|---|---|---|
| 1 | The question | Approved as drafted |
| 2 | Date range and volume | Option A: from 2024-01-01 |
| 3 | Construct choices in criterion I5 | Both accepted: need-satisfaction scales count; the Intrinsic Motivation Inventory's interest/enjoyment subscale counts; enjoyment measured alone does not |
| 4 | Toolchain gaps | Proceed as is. There is no OpenAlex key |

### Corrections approved with the protocol

The user approved the protocol with two corrections. Both were made to `protocol.md`
before it was marked approved; they are part of the approved text, not amendments.

1. **Who set the limits.** The text above ("Your four limits", "your 20-study and
   150-record limits") and the draft of protocol section 1 attributed four limits to
   the user. Only the 20-study cap was the user's own. The target of roughly 150
   records at title and abstract and the backward-only, capped citation searching were
   set by the operator who launched the run, and the user accepted them at this gate.
   Protocol sections 1, 5 and 13 now say so.
2. **Full-text retrieval is a stated limitation.** Full text is retrieved only from
   open-access PubMed Central and arXiv. A count-only PubMed query with the section 4
   string on 2026-11-28 found open-access PubMed Central full text for 59 of 83
   records. Reports whose full text cannot be retrieved are reported as not retrieved,
   never as excluded on a criterion, and gate 2 lists every one of them by name. This
   is in protocol sections 1 and 6 and will be stated in the review.

### Standing limits confirmed

At most 20 studies appraised; if screening includes more than 20, the count is
presented at gate 2 with options, without truncating. The run is attended: gate 2 is
not passed without the user's answer.

The text above the rule is the gate as it was presented and is left as written.
