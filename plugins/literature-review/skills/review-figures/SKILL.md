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

Run these against every figure, generated or hand-authored. They are cheap and they
catch real defects — the collision check below found a genuine overlap in this plugin's
own generator.

| Check | How |
|---|---|
| **Well-formed XML** | Parses with an XML parser |
| **No box overlaps** | Pairwise rectangle intersection over the content boxes |
| **Nothing clipped** | Every rect and every text `y` inside the `viewBox` |
| **Text inside its box** | Each label's anchor within the rect it belongs to |
| **Accessible** | `role="img"`, `<title>`, `<desc>` carrying the figure's numbers in prose, wired by `aria-labelledby` |
| **Real text** | `<text>` elements, not outlined paths |
| **Theme-independent** | No `fill="white"`, `"black"`, `#fff` or `#000` on any mark; a `prefers-color-scheme` block present as the enhancement |
| **Numbers reconcile** | Recompute from the source file and compare to what is drawn |

A figure failing any of these is fixed before it ships. "It probably renders" is not a
check — a structurally valid SVG can still be visually garbled, which is exactly what
the overlap check exists to catch.

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

- **`scripts/prisma_flow.py`** — the flow diagram generator. Standard library only,
  validates the arithmetic, supports v1 and v2, emits both template footnotes.
  `--help` for the interface.
- **`examples/prisma-flow-example.json`** — a worked counts file, two-column, with the
  human/automation exclusion split.
- **`examples/prisma-flow.svg`** — its rendered output, for reference on layout,
  theming and the accessibility wiring.
- **`references/figures.md`** in the main skill — the catalog, the two gates, per-figure
  specs, SVG craft.
