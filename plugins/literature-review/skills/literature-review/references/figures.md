# Figures

A review's findings are comparative — n studies across m dimensions — and comparative
data read badly as prose. The default failure is not an ugly chart; it is a
five-study, three-dimension comparison written as four paragraphs that no reader can
hold in their head.

Two of these figures are required by the reporting standards. The rest earn their
place by the rule below.

## The Two Gates

These bind as hard as the never-invent rules in `provenance.md`.

### Gate 1 — Every figure is generated from a data file

A figure is built from a named file in the output directory, and **every mark traces
to a row in it**. No data file, no figure.

The `figure-author` agent is given exactly one data file and the figure spec. It
cannot consult the synthesis, the papers, or its own impression of the field, because
a figure assembled from impression is a drawing of what the author expected to find.

Each figure's caption names its source: *"Generated from `screening.csv`, 2026-09-20."*

### Gate 2 — A figure may not assert more than the prose beside it

Readers grant figures more authority than sentences, which makes a chart the most
efficient way to launder an unverified claim.

| Violation | Why it overclaims |
|---|---|
| **Forest plot without pooled effect sizes** | Implies a meta-analysis, heterogeneity statistics, and weighting that were never computed |
| **Bubble sized by "importance"** | Implies importance was measured |
| **Trend line through five points** | Implies a fitted relationship |
| **Citation graph presented as the field** | Implies the search found everything |
| **Tier-C findings drawn identically to tier-A** | Erases the distinction the whole review is built on |

**Tiers survive into the figure.** Where a figure mixes tiers, mark them — hatching,
outline weight, or an explicit column. Where it cannot, restrict the figure to one
tier and say which.

## The Catalog

| Figure | Source file | When |
|---|---|---|
| **PRISMA 2020 flow** | `screening.csv` + `search-log.md` | **Always** |
| **RoB traffic light** | `appraisals/*.md` | **Always, when RoB was assessed** |
| **RoB summary barplot** | `appraisals/*.md` | With the traffic light |
| **Database contribution** | `records.csv` | More than one source searched |
| **Evidence map** | extraction table | Two categorical axes in the extraction |
| **Literature timeline** | `records.csv` | Optional |
| **Citation lineage** | citation-graph tools | Optional, and gated — see above |
| **Concept taxonomy** | the synthesis | Optional |
| **Forest plot** | effect sizes | Only with a real meta-analysis |

The two RoB figures follow the conventions of **robvis** — McGuinness LA, Higgins JPT.
*Risk-of-bias VISualization (robvis): An R package and Shiny web app for visualizing
risk-of-bias assessments.* Research Synthesis Methods 2021;12(1):55–61. DOI
[10.1002/jrsm.1411](https://doi.org/10.1002/jrsm.1411). The conventions are matched;
the R dependency is not taken.

### When a figure is required and absent

`literature-review:review-critic` raises a finding when prose does the work of a table or a chart. The
trigger: **more than four studies compared on more than two dimensions**, rendered as
paragraphs. Also flagged — a section reporting per-study judgments with no
traffic-light figure, and any flow narrative without `figures/prisma-flow.svg`.

## Specifications

### PRISMA flow diagram

Follow the official template labels verbatim — `prisma.md` carries them, extracted from
the CC BY 4.0 `.docx` templates. Two structural decisions come first:

1. **v1 or v2.** A review that used citation searching, websites or organisations needs
   **v2**, which adds a second column, "Identification of studies via other methods",
   with its own sought / not-retrieved / assessed / excluded chain merging into the
   shared Included box. **Snowballing is citation searching**, so v2 is this plugin's
   normal case.
2. **The automation split.** The template footnote requires a review using automation
   tools to report how many records a human excluded and how many the tools did. Agent
   screening is an automation tool, so `Records excluded**` carries both numbers here,
   always.

Layout: phase rails down the left (**Identification**, **Screening**, **Included**),
main chain in a column, exclusion boxes branching right, arrows between. Grey boxes are
**removed when not applicable**, never left at zero. Reproduce both template footnotes
beneath the diagram.

**The arithmetic must close**, and `figure-author` recomputes it from the source file
before drawing rather than transcribing numbers it was handed:

```
identified (+ other methods) − removed before screening = screened
screened − excluded                                     = sought for retrieval
sought − not retrieved                                  = assessed for eligibility
assessed − excluded with reasons                        = included
```

If it does not close, **the figure is not drawn**. Report the discrepancy instead — a
diagram whose numbers do not sum is the most visible defect a systematic review can
ship, and drawing it anyway launders a data error into a graphic.

Exclusion reasons need a count each. A single "excluded (n=9)" box is non-compliant.

### RoB traffic light

Rows are studies, columns are the instrument's domains plus an overall column.

- Each cell carries **both** a color and its letter — `L` low, `S` some concerns,
  `H` high, `N` no information, `?` unclear. Color alone fails for the ~8% of readers
  with a color vision deficiency and fails entirely in grayscale print.
- Cell shape may also vary (circle / square / triangle) for a third redundant channel.
- Study labels on the left as citation keys, in the same form as the bibliography.
- A legend, always.
- **Separate panels per instrument.** RoB 2 and ROBINS-I have different scales; a
  shared legend across both misrepresents each.

### RoB summary barplot

One horizontal stacked bar per domain, segments proportional to the share of studies
at each judgment. Percentages on the bar; **the study count `n=` in the title**, since
a percentage over 7 studies invites over-reading.

### Evidence map

Two categorical axes from the extraction, a bubble at each intersection with **area**
proportional to study count. Area, not radius — radius-scaled bubbles overstate large
values by the square.

Empty intersections stay visible as empty. They are the gaps, and they are the most
informative cells in the figure.

### Database contribution

Records per source and how much each contributed uniquely. Prefer a stacked bar of
unique-vs-shared per source over a Venn diagram: Venn is unreadable beyond three
sets, and there are usually more.

## SVG Craft

### Theme independence first

The instinct is `prefers-color-scheme`. Include it — and do not rely on it. An SVG
referenced from markdown is loaded as an image, its media query support varies by
host and renderer, and **when pandoc rasterizes it for .docx the query is irrelevant
because it renders once, in light mode.**

So: **choose marks that read on both light and dark backgrounds**, then add the media
query as an enhancement.

- Mid-tone fills, roughly 40–65% lightness, work on white and on dark.
- Never `fill="white"` or `fill="black"` on a mark. A shape that vanishes on one
  background is a missing figure half the time.
- Give the figure an explicit background rect only if it needs one; a transparent
  ground with theme-independent marks is more robust.
- Text in `currentColor` where the host supplies one, with an explicit mid-tone
  fallback.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 560"
     role="img" aria-labelledby="figTitle figDesc">
  <title id="figTitle">PRISMA 2020 flow diagram</title>
  <desc id="figDesc">142 records identified across three databases; 31 duplicates
    removed; 111 screened; 78 excluded; 33 sought; 31 assessed; 9 excluded with
    reasons; 22 studies included.</desc>
  <style>
    .ink   { fill: #44506b; }
    .line  { stroke: #44506b; stroke-width: 1.5; fill: none; }
    .label { font: 13px system-ui, sans-serif; fill: #44506b; }
    @media (prefers-color-scheme: dark) {
      .ink { fill: #9fb0d0; } .line { stroke: #9fb0d0; } .label { fill: #9fb0d0; }
    }
  </style>
  <!-- marks -->
</svg>
```

### Accessibility

- `role="img"` plus `<title>` and `<desc>`, referenced by `aria-labelledby`. The
  `<desc>` carries **the figure's numbers in prose** — it is the only way a screen
  reader reaches them, and it doubles as the alt text on export.
- Real `<text>` elements, never outlined paths. Text stays selectable, searchable,
  translatable, and sharp at print resolution.
- Minimum 11px type at the figure's native size; below that, rasterization at 96 DPI
  turns it to mush.
- Contrast at least 4.5:1 against both candidate backgrounds.
- No information encoded by color alone, anywhere.

### Layout

- `viewBox` on every figure; no fixed `width`/`height` attributes, so it scales into
  a document column.
- Target roughly 800 units wide for a full-width portrait page figure.
- Leave 8–12 units of padding inside the viewBox — a mark flush to the edge gets
  clipped by some renderers.
- One figure per file in `figures/`, named for what it shows.

### Why not Mermaid

It renders natively on GitHub, which is a real advantage, and it is still not used
here. It cannot express a traffic-light grid, a bubble map, or a stacked bar; pandoc
needs a filter to render it at all; and the PRISMA flow's branching exclusion boxes
come out wrong in its flowchart layout. Hand-authored SVG covers every figure in the
catalog with one mechanism and no renderer.

## Export

SVG is the committed source of truth. The rasterizer detected in Phase 0 converts for
.docx and PDF — see `reporting.md`. Figures are never committed as PNG only: a raster
figure cannot be diffed, re-themed, or read by a screen reader.
