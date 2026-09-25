---
name: review-figures
description: Turns a literature review's data files into SVG figures — the PRISMA 2020 flow diagram, risk-of-bias traffic-light and summary plots, evidence maps, database contribution and timelines. Every mark traces to a row in a named file, no figure asserts more than the prose beside it, and each one is validated for geometry, theming and accessibility before it ships. Used by the pipeline's figure phase and whenever a review needs a figure built or checked.
---

# Building a Review's Figures

A review's findings are comparative, and comparative data read badly as prose. This
skill turns the data files into figures without letting the figures claim more than the
data.

**Load the `literature-review:literature-review` skill** — `references/figures.md` is
the catalog, the two gates, and the SVG craft rules. This file is the procedure.

## Before Anything: the Two Gates

From `references/figures.md`, restated because everything here depends on them:

1. **Every figure is generated from a data file**, and every mark traces to a row in
   it. No data file, no figure.
2. **No figure asserts more than the prose beside it.** Tiers survive into the picture.
   No forest plot without a real meta-analysis.

A figure that cannot satisfy both is not drawn. Reporting why is the deliverable in
that case, and it is a complete one.

## The Procedure

### 1. Read the budget

`protocol.md` declares which figures this review produces, decided at the Phase 1 gate
before any searching. Work that list.

A figure in the budget whose data never materialized is reported as **not produced,
with the reason** — not quietly dropped, and not replaced with something else. A figure
not in the budget that the data now clearly warrants is proposed, not silently added.

### 2. Bind each figure to exactly one source file

| Figure | Source |
|---|---|
| PRISMA flow | `screening.csv` + `search-log.md` |
| RoB traffic light, RoB summary | `appraisals/*.md` |
| Database contribution | `records.csv` |
| Evidence map | the extraction table |
| Timeline | `records.csv` |

If a figure needs two files, derive one intermediate file first and bind the figure to
that. A figure reading from several sources cannot be checked against any of them.

### 3. Build

**The PRISMA flow uses the shipped generator.** Its layout is fixed by the standard and
its arithmetic must close, which makes it a job for code rather than for placing boxes
by hand:

```
python3 <plugin>/skills/review-figures/scripts/prisma_flow.py counts.json --out figures/prisma-flow.svg
```

The counts JSON is derived from `screening.csv` — see
`examples/prisma-flow-example.json` for the shape. Supplying `other_methods` selects
the two-column v2 template, which **citation searching requires**, so a review that
snowballed uses it.

The script **checks the arithmetic before it draws** and exits non-zero, having written
nothing, when the numbers do not close. That is the correct outcome: fix the counts.
`--force` exists for inspecting a broken flow during debugging and must not be used for
a figure that ships.

**Everything else is hand-authored SVG** against the specs in `references/figures.md`.
Derive the numbers from the source file first and write them down; then draw. Drawing
while computing is how a mark stops matching its row.

### 4. Validate

**Run the checker. Do not eyeball it.**

```
python3 <plugin>/skills/review-figures/scripts/check_figure.py figures/*.svg
```

It exits non-zero on any failure and reports what and where:

| Check | Catches |
|---|---|
| Well-formed XML, `viewBox` present | A file that will not render or will not scale |
| No overlapping content boxes | Two boxes drawn on top of each other |
| **Arrow endpoints land on a box edge** | An arrow pointing at empty space |
| Nothing outside the `viewBox` | Clipped boxes and clipped text |
| Real `<text>` elements exist | Text outlined into paths |
| `role="img"`, non-empty `<title>` and `<desc>` | A figure a screen reader cannot read |
| `<desc>` contains digits | A description that omits the figure's numbers |
| No `white`/`black`/`#fff`/`#000` fills on marks | Marks that vanish on one background |
| Font size at or above 11px | Text that rasterizes to mush at 96 DPI |

**The arrow check exists because the other checks are not enough.** An earlier version
of the shipped flow generator produced an SVG that passed every structural and geometric
test — well-formed, no overlaps, nothing clipped, fully accessible — while the
other-methods column's arrow dropped into empty space and never reached the Included
box. It took a human looking at the render to see it. The check now catches it, and it
is the reason "it parses and nothing overlaps" is not a sufficient standard.

What the checker still cannot judge: whether the figure **reads well** — crowding,
label collisions inside a box, a layout that is technically correct and hard to follow.
When a figure is new or its layout changed, render it and look, or ask someone to.

Separately, and not the checker's job: **recompute the figure's numbers from the source
file** and compare them to what is drawn.

### 5. Place it

In `review.md`, each figure gets a caption naming its source file and the date:

```markdown
![PRISMA 2020 flow diagram](figures/prisma-flow.svg)

**Figure 1.** Study selection. Generated from `screening.csv`, 2026-09-25.
Template: PRISMA 2020 v2 (databases and registers, plus citation searching).
```

Reproduce the PRISMA template's two footnotes beneath the flow diagram; the generator
already draws them into the SVG.

## The Automation Split

The PRISMA template's second footnote requires a review using automation tools to
report **how many records a human excluded and how many the tools did**. Agent
screening is an automation tool, so the `Records excluded**` box always carries both
numbers here. Pass `excluded` as an object rather than an integer:

```json
"excluded": {"by automation tools": 54, "by a human reviewer": 24}
```

A single undifferentiated exclusion count does not follow the template, and it conceals
the fact the conduct disclosure exists to surface.

## Refusing to Draw

Refusal is a normal outcome and it is reported, not worked around:

| Situation | Response |
|---|---|
| Arithmetic does not close | Do not draw. Report the discrepancy with both sides of it |
| The source file lacks a column the figure needs | Do not draw. Name the missing column |
| A forest plot is requested with no meta-analysis | Refuse. Offer a table of per-study results instead |
| A quantity would have to be invented to size a mark | Refuse. Size by study count, or drop the encoding |
| Fewer than about three items | Say a figure adds nothing here; a sentence is better |

Never draw a figure that needs a number the data does not contain. Drawing it launders
a data gap into a graphic, and the graphic is what people cite.

## Resources

- **`scripts/check_figure.py`** — the validator. Run it on every figure, generated or
  hand-authored.
- **`scripts/prisma_flow.py`** — the flow diagram generator. Standard library only,
  validates the arithmetic, supports v1 and v2, emits both template footnotes.
  `--help` for the interface.
- **`examples/prisma-flow-example.json`** — a worked counts file, two-column, with the
  human/automation exclusion split.
- **`examples/prisma-flow.svg`** — its rendered output, for reference on layout,
  theming and the accessibility wiring.
- **`references/figures.md`** in the main skill — the catalog, the two gates, per-figure
  specs, SVG craft.
