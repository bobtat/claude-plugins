# PRISMA 2020

PRISMA is a **reporting** standard, not a conduct standard. It says what a review
must disclose, not how to do the review well. A methodologically poor review that
discloses everything is PRISMA-compliant; a superb one that omits its search strings
is not. Treat it as the floor.

Source: Page MJ, McKenzie JE, Bossuyt PM, et al. *The PRISMA 2020 statement: an
updated guideline for reporting systematic reviews.* BMJ 2021;372:n71.
DOI [10.1136/bmj.n71](https://doi.org/10.1136/bmj.n71). Item text below is quoted
from the published checklist.

**27 numbered items, 42 rows** once sub-items are counted (10a–b, 13a–f, 16a–b,
20a–d, 23a–d, 24a–c). `prisma-checklist.md` has a row for each of the 42.

## The Three-State Marking

Every row is marked with one of three states. A plain "compliant" column would be a
lie, because some items cannot be satisfied by a machine-conducted review.

| State | Meaning |
|---|---|
| **met** | Satisfied, with a pointer to where in the review |
| **met-by-machine** | Satisfied in substance, but by an agent rather than a person — the disclosure says which agent and how |
| **requires-human** | Cannot be satisfied here. Names what a person must do |

Three items are **always** `requires-human`: **24a** (registration — only a person can
register with PROSPERO), **25** (support), **26** (competing interests). Items **8**,
**9** and **11** are `met-by-machine` at best, because each asks how many reviewers
worked independently and the answer is "two agents, not two people."

Never mark an item `met` because the review *could* satisfy it. Mark what it does.

## The Checklist

### Title and Abstract

| # | Item | Requirement | Generated from |
|---|---|---|---|
| 1 | Title | "Identify the report as a systematic review." | Title template |
| 2 | Abstract | Per the PRISMA 2020 for Abstracts checklist | Synthesis |

### Introduction

| # | Item | Requirement | Generated from |
|---|---|---|---|
| 3 | Rationale | "Describe the rationale for the review in the context of existing knowledge." | `protocol.md` |
| 4 | Objectives | "Provide an explicit statement of the objective(s) or question(s) the review addresses." | `protocol.md` — the Phase 0 question |

### Methods

| # | Item | Requirement | Generated from |
|---|---|---|---|
| 5 | Eligibility criteria | "Specify the inclusion and exclusion criteria for the review and how studies were grouped for the syntheses." | `protocol.md` |
| 6 | Information sources | "Specify all databases, registers, websites, organisations, reference lists and other sources searched or consulted… Specify the date when each source was last searched." | `search-log.md` — **the per-source date is mandatory** |
| 7 | Search strategy | "Present the full search strategies for all databases, registers and websites, including any filters and limits used." | `search-log.md` — the literal strings, not a description of them |
| 8 | Selection process | "…including how many reviewers screened each record…, whether they worked independently, and if applicable, details of automation tools used." | `screening.csv` + disclosure. **`met-by-machine`** — the automation clause is what makes honest reporting possible |
| 9 | Data collection process | Same structure, for extraction | `appraisals/` + disclosure. **`met-by-machine`** |
| 10a | Data items — outcomes | "List and define all outcomes for which data were sought…" | `protocol.md` |
| 10b | Data items — other variables | "List and define all other variables… Describe any assumptions made about any missing or unclear information." | `protocol.md` |
| 11 | Risk of bias assessment | "…details of the tool(s) used, how many reviewers assessed each study and whether they worked independently…" | `protocol.md` + disclosure. **`met-by-machine`** |
| 12 | Effect measures | "Specify for each outcome the effect measure(s)… used in the synthesis." | `protocol.md`. **N/A for a narrative synthesis — say N/A, do not invent one** |
| 13a | Eligibility for synthesis | Which studies were eligible for each synthesis | `protocol.md` |
| 13b | Data preparation | Handling of missing summary statistics, conversions | `protocol.md` |
| 13c | Tabulation / display | "Describe any methods used to tabulate or visually display results…" | **The figure budget** — see `figures.md` |
| 13d | Synthesis approach | Methods and rationale; if meta-analysis, model, heterogeneity method, software | `protocol.md` |
| 13e | Heterogeneity exploration | Subgroup analysis, meta-regression | `protocol.md` or N/A |
| 13f | Sensitivity analyses | Robustness checks | `protocol.md` or N/A |
| 14 | Reporting bias assessment | Risk of bias from missing results | `protocol.md` |
| 15 | Certainty assessment | "Describe any methods used to assess certainty… in the body of evidence." | GRADE, plus **the tier system** — see `provenance.md` |

### Results

| # | Item | Requirement | Generated from |
|---|---|---|---|
| 16a | Study selection | "…from the number of records identified in the search to the number of studies included, ideally using a flow diagram." | **`figures/prisma-flow.svg`** |
| 16b | Excluded studies | "Cite studies that might appear to meet the inclusion criteria, but which were excluded, and explain why." | `screening.csv` — near-misses, not every exclusion |
| 17 | Study characteristics | "Cite each included study and present its characteristics." | `appraisals/` |
| 18 | Risk of bias in studies | "Present assessments of risk of bias for each included study." | **`figures/rob-traffic-light.svg`** |
| 19 | Results of individual studies | Summary statistics and effect estimates, "ideally using structured tables or plots" | `appraisals/`, or N/A for a non-quantitative review |
| 20a | Synthesis characteristics | Characteristics and risk of bias among contributing studies | Synthesis |
| 20b | Statistical synthesis | Summary estimates, precision, heterogeneity | **N/A unless a meta-analysis was actually run.** See the forest-plot gate in `figures.md` |
| 20c | Heterogeneity investigation | Results of those investigations | N/A if 13e was N/A |
| 20d | Sensitivity analyses | Results of those analyses | N/A if 13f was N/A |
| 21 | Reporting biases | Assessments of bias from missing results | Synthesis |
| 22 | Certainty of evidence | Per outcome | GRADE + tier table |

### Discussion

| # | Item | Requirement |
|---|---|---|
| 23a | General interpretation | "…in the context of other evidence." |
| 23b | Evidence limitations | Limitations **of the evidence** |
| 23c | Process limitations | Limitations **of the review process** — where the conduct disclosure is cited |
| 23d | Implications | "…for practice, policy, and future research." |

23b and 23c are distinct and routinely merged. 23b is about the studies; 23c is about
what this review did to them. A machine-conducted review has a great deal to say
under 23c and should say it there rather than burying it.

### Other Information

| # | Item | Requirement | State |
|---|---|---|---|
| 24a | Registration | "…register name and registration number, **or state that the review was not registered**." | **requires-human** — the escape clause is the honest default |
| 24b | Protocol access | Where the protocol can be accessed, or that none was prepared | met — `protocol.md` is written before searching and is the artifact this item wants |
| 24c | Amendments | "Describe and explain any amendments…" | met — every post-gate protocol change is recorded |
| 25 | Support | Funding and the funder's role | **requires-human** |
| 26 | Competing interests | Author competing interests | **requires-human** |
| 27 | Availability of data, code, materials | Forms, extracted data, analytic code, other materials | met — the whole output directory is the answer |

Item 27 is nearly free here and usually hard for human reviewers: the artifact set
*is* the data availability statement. Say where it is.

## The Flow Diagram

Item 16a. Labels below are **verbatim from the official templates** at
prisma-statement.org, which are CC BY 4.0 and cite Page et al. 2021.

### There are two templates for a new review, and snowballing decides which

| Template | Use when |
|---|---|
| **v1 — databases and registers only** | Every record came from a database or register search |
| **v2 — adds "Identification of studies via other methods"** | Anything came from websites, organisations, or **citation searching** |

**Snowballing is citation searching, so a review that snowballs needs v2.** This
plugin treats backward and forward chaining as a first-class method
(`search-strategy.md`), which means **v2 is the common case here, not the exception.**
Its second column runs its own `Records identified from` → `Reports sought for
retrieval` → `Reports not retrieved` → `Reports assessed for eligibility` →
`Reports excluded` chain, and both columns feed the single Included box.

There are separate v1/v2 templates for **updated** reviews. Use those when extending
an existing review rather than redrawing a new-review diagram.

### Boxes, verbatim

Left rail, top to bottom: **Identification**, **Screening**, **Included**.
Column header: **Identification of studies via databases and registers** (and, in v2,
**Identification of studies via other methods**).

```
Records identified from*:            →  Records removed before screening:
  Databases (n = )                        Duplicate records removed (n = )
  Registers (n = )                        Records marked as ineligible by
                                            automation tools (n = )
                                          Records removed for other reasons (n = )
            ↓
Records screened (n = )              →  Records excluded** (n = )
            ↓
Reports sought for retrieval (n = )  →  Reports not retrieved (n = )
            ↓
Reports assessed for eligibility     →  Reports excluded:
  (n = )                                  Reason 1 (n = )
            ↓                             Reason 2 (n = )
                                          Reason 3 (n = )  etc.
Studies included in review (n = )
Reports of included studies (n = )
```

Note **"Reports"**, not "Studies", through the middle of the flow: a study can have
several reports, and the final box distinguishes them. Getting this wrong is a common
error in hand-drawn diagrams.

Grey boxes are **removed when not applicable**, not left at zero.

### The two footnotes are part of the template

Reproduce both:

> **\*** Consider, if feasible to do so, reporting the number of records identified
> from each database or register searched (rather than the total number across all
> databases/registers).
>
> **\*\*** If automation tools were used, indicate how many records were excluded by
> a human and how many were excluded by automation tools.

**The second footnote binds hard on this plugin.** Screening here is performed by
agents, which are automation tools. The `Records excluded**` box must therefore split
the count: how many by automation, how many by a human. A machine-conducted review
that reports one undifferentiated exclusion count is not following the template, and
it hides exactly the fact the conduct disclosure exists to surface.

### The arithmetic must close

```
identified (+ other methods) − removed before screening = screened
screened − excluded                                     = sought for retrieval
sought − not retrieved                                  = assessed for eligibility
assessed − excluded with reasons                        = included
```

`literature-review:review-critic` recomputes it from `screening.csv`. A flow diagram
whose numbers do not sum is the most visible defect a systematic review can ship.

Two honesty requirements specific to a machine-run search:

- **"Records identified" means the number the query matched**, which the discovery
  tooling may not report. When only the retrieved count is available, label the box as
  retrieved-under-cap and state the cap. Never present a capped retrieval as an
  identified total.
- **Exclusions at the "Reports excluded" step need a reason and a count per reason.**
  "Excluded: 11" is not compliant. `screening.csv` carries the criterion per record
  precisely so this box can be filled.

## PRISMA-S

Rethlefsen ML, Kirtley S, Waffenschmidt S, et al. *PRISMA-S: an extension to the
PRISMA Statement for Reporting Literature Searches in Systematic Reviews.* Systematic
Reviews 2021;10:39. DOI
[10.1186/s13643-020-01542-z](https://doi.org/10.1186/s13643-020-01542-z).

**16 items** covering search reporting in the detail items 6 and 7 gesture at.
It exists because search reporting is the most consistently under-reported part of a
systematic review, and it is the extension most worth following here: a
machine-conducted search is *more* reproducible than a human one if it is logged, and
completely opaque if it is not.

The items that bind hardest on this plugin:

- **Full Boolean strings per database**, verbatim, including field tags and filters.
  Not "we searched PubMed for agent memory."
- **Limits and restrictions** — date range, language, publication type — with the
  rationale for each.
- **The date each source was searched**, separately.
- **Any citation chaining** (snowballing), stated as a method with its direction.
- **Any automation tool** used at any stage, named and versioned.

`search-log.md` is structured to satisfy all of these; the pinned MCP server versions
are recorded there for the last one.

## What PRISMA Does Not Cover

Say so in the review rather than implying coverage:

- **Whether the question was worth asking.**
- **Whether the search was well constructed.** PRISMA asks you to report the strings,
  not to have chosen good ones.
- **Whether a claim in the synthesis follows from the evidence cited.** Nothing in the
  27 items checks a citation against what it actually says. That is what
  `provenance.md` is for.
- **Fabricated references.** PRISMA has no item for this, because the problem does
  not arise when humans write the review.
