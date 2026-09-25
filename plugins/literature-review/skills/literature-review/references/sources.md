# Sources, Synthesis, and Known Gaps

This skill tells Claude to record how every claim came to be known. It would be a poor
advertisement for that rule if its own methodology arrived unlabelled, so the table
below applies the tier system in `provenance.md` to this skill's own sources.

## Verification Table

Checked 2026-09-20 during the build of this plugin.

| Source | Cited for | Tier | Check |
|---|---|---|---|
| **PRISMA 2020** — Page MJ, McKenzie JE, Bossuyt PM, et al. BMJ 2021;372:n71. DOI [10.1136/bmj.n71](https://doi.org/10.1136/bmj.n71) | All 42 checklist rows in `prisma.md`, quoted | **A** | Full checklist retrieved from [PMC8005924](https://pmc.ncbi.nlm.nih.gov/articles/PMC8005924/) and transcribed item by item |
| PRISMA 2020 **flow diagram** templates (v1 and v2, new reviews) | The diagram spec in `prisma.md` | **A** | Both official `.docx` templates downloaded from prisma-statement.org and their text extracted; box labels, phase rails, column headers and both footnotes are verbatim. CC BY 4.0, citing Page et al. 2021. Corrected an earlier reconstruction — see below |
| **PRISMA-S** — Rethlefsen ML, Kirtley S, Waffenschmidt S, et al. Syst Rev 2021;10:39. DOI [10.1186/s13643-020-01542-z](https://doi.org/10.1186/s13643-020-01542-z) | Search reporting requirements | **C** | Title, venue, DOI and the 16-item count confirmed by search. Item text not read |
| **Cochrane Handbook for Systematic Reviews of Interventions**, v6.5 (2024) | Screening, RoB, the two RoB figure conventions | **C** | Current version confirmed as 6.5 (2024); 6.4 was August 2023. Chapters not read |
| **RoB 2** — Sterne JAC, et al. BMJ 2019;366:l4898 | Randomized-trial appraisal; five domains | **C** | Citation confirmed. **Domains independently confirmed by a second search** |
| **ROBINS-I** — Sterne JAC, et al. BMJ 2016;355:i4919 | Non-randomized appraisal; seven domains | **C** | Same |
| **QUADAS-2** — Whiting PF, et al. Ann Intern Med 2011;155(8):529–536 | Diagnostic accuracy; four domains | **C** | Same |
| **robvis** — McGuinness LA, Higgins JPT. Res Syn Methods 2021;12(1):55–61. DOI [10.1002/jrsm.1411](https://doi.org/10.1002/jrsm.1411) | Traffic-light and summary plot conventions | **C** | Citation and both figure types confirmed. Package not run |
| **Wohlin C.** *Guidelines for snowballing…* EASE '14. DOI [10.1145/2601248.2601268](https://doi.org/10.1145/2601248.2601268) | Backward/forward snowballing as a first-class strategy | **C** | Citation, venue and the headline finding confirmed |
| **GRADE** — Guyatt GH, Oxman AD, Vist GE, et al. BMJ 2008;336:924–926 | Certainty of evidence | **C / D** | Citation and the four levels confirmed. **The rate-down and rate-up lists in `appraisal.md` are tier D** — written from recall, not read |
| **AMSTAR 2**, **ROBIS**, **CASP** | Named as instruments for reviews-as-evidence and qualitative work | **D** | Named from recall. No citation given and none verified. Treat as pointers |
| **PROSPERO** (CRD, University of York) | Protocol registration | **D** | Not verified in this build |
| **CSL styles repository** | Citation style files | **D** | URL from recall |
| `docs/research/agent-memory-literature-review.md` (this repo) | The tier system, the existence-check failure modes, the prevalence rule | **A** | Read directly |

**What this table does not do.** It confirms that these works exist and are titled and
numbered as cited. It does not confirm that this skill represents their content
correctly — that would require reading them, which for every tier-C row was not done.

**One correction already made.** The flow diagram row shipped at tier B/D, flagged as
reconstructed. Reading the official templates then found three things the
reconstruction had wrong or missing: there are **two** templates for a new review and
snowballing forces the two-column one; the middle of the flow says *Reports*, not
*Studies*; and a template footnote requires a review using automation tools to split
its exclusion count into human and automation. That last one binds directly on this
plugin and was not in the reconstruction at all. The flag was worth carrying.

## Where the Conventions Come From

**The reporting backbone** is PRISMA 2020, unmodified. The 42 rows, the flow diagram,
and the section structure in `synthesis.md` are the standard's, not this plugin's.
PRISMA-S supplies the search-reporting detail that items 6 and 7 only gesture at.

**The appraisal instruments** are the standard ones, matched to design, with their own
scales preserved rather than normalized. The Cochrane Handbook is the reference for
screening practice and for the two risk-of-bias figures, whose visual conventions come
from robvis.

**Snowballing** follows Wohlin: both directions, iterated from the included set to
saturation, treated as a legitimate primary strategy rather than a supplement. That
framing matters most in fields whose terminology moves too fast for a Boolean query.

**Certainty of evidence** is GRADE, applied per outcome and kept separate from the tier
system.

## This Plugin's Own Synthesis

Not sourced from anywhere in particular, because no established standard covers it —
these address the failure modes of a *machine* conducting a review, which is not the
reader every methodology guide was written for:

- **The five-tier provenance system.** Derived from the tier table in this repo's
  agent-memory review. No systematic review standard has an equivalent, because the
  question "did the reviewer actually read this?" does not arise when the reviewer is
  a person who either fetched the PDF or did not.
- **Existence check plus title match as separate gates.** The MINJA error in that
  review passed existence cleanly while pointing at the wrong paper. PRISMA has no
  item for fabricated or misattributed references.
- **The three-state checklist marking** (`met` / `met-by-machine` / `requires-human`)
  and the conduct disclosure. PRISMA's item 8 asks how many reviewers screened
  independently and assumes the answer is a number of people.
- **The κ caveat** — that Cohen's κ between two instances of one model overstates what
  the same number means between two humans, because contextual independence is not
  cognitive independence.
- **The prevalence rule** and its permitted rewrites.
- **The two figure gates.** Data-file provenance for every mark, and the rule that a
  figure may not outclaim its prose. The observation that a chart is the most
  efficient way to launder an unverified claim is this plugin's, and it is why the
  figure layer sits inside the epistemics rather than beside them.
- **The appraisal criteria for computational work**, offered explicitly as a
  structured critique rather than a validated instrument, because none exists.
- **Theme-independent SVG over `prefers-color-scheme`**, on the grounds that the media
  query is irrelevant once pandoc rasterizes.

## Deliberate Departures

- **PRISMA compliance is reported in three states, not two.** The standard's checklist
  is binary. A binary marking from an agent pipeline would be a claim this plugin
  cannot support.
- **Recall is preferred over precision in search construction**, against the instinct
  to write a tight query. Screening is cheap here; a study never retrieved is
  invisible forever.
- **GRADE is withheld rather than guessed** when the full text was not retrieved.
  The convention is to rate; this plugin says "not rated" and gives the reason.
- **Instrument scales are not normalized** to a common three-point scale, even though
  it would produce one tidy figure instead of two panels.

## Known Gaps

Deliberately not covered:

- **Meta-analysis itself.** The plugin knows when a meta-analysis is *not* warranted
  and refuses to draw a forest plot without one. It does not compute pooled estimates,
  heterogeneity statistics, or meta-regression. That needs a statistics toolchain and
  a statistician.
- **Grey literature.** Scoped to academic sources by design. Theses, standards,
  regulatory filings and industry reports are out.
- **Non-English literature.** Every search string here is English. A review that
  searches only English says so in its limitations; this plugin cannot fix the
  underlying restriction.
- **Living reviews.** Re-running a search and extending an existing review is
  supported. Living-review methodology — surveillance intervals, update triggers,
  continuous incorporation — is not.
- **Qualitative evidence synthesis** — meta-ethnography, thematic synthesis,
  framework synthesis — as methods in their own right. CASP is named; the methods are
  not implemented.
- **Full-text acquisition behind paywalls.** Open-access routes only. Sci-Hub is
  reachable through the discovery server and is never invoked.
- **Diagnostic test accuracy and network meta-analysis** as specialized review types.
- **Human adjudication.** The pipeline surfaces disagreements and stops; it does not
  pretend to settle them.

## What Is Untested

The three things most likely to be wrong, in order:

1. **The MCP server pins.** Both servers are pinned, and `paper-search-mcp` is a 0.1.x
   package that went 14 months between releases. A pin that stops resolving breaks
   discovery, and the fallback is a tier-C web search.
2. **The rasterizer chain on Windows.** The `svglib` fallback is the least-exercised
   path and the one Windows users will land on.
3. **The GRADE rate-down and rate-up lists**, which remain tier D.

The methodology sources are stable on a decade timescale. The tooling is not.
