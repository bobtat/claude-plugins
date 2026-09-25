# Reporting and Export

## The Artifact Set

A review is a directory, not a file. The prose is one artifact among several, and the
others are what make item 27 (availability of data and materials) answerable.

```
<output-dir>/
├── protocol.md              the approved contract: question, sources, strings,
│                            criteria, RoB instrument, figure budget, toolchain
├── search-log.md            per source: string, date, limits, counts, caps
├── records.csv              every record retrieved, before screening
├── screening.csv            per record: both screeners, criterion, adjudication
├── prisma-flow.json         flow counts and κ, derived from the two CSVs by script
├── appraisals/<key>.md      one per included study
├── figures/*.svg            one per figure in the budget
├── review.md                the synthesis — the document people read
├── references.bib           verified BibTeX
├── prisma-checklist.md      42 rows × met / met-by-machine / requires-human
└── conduct-disclosure.md    what a machine did, and what a person must still do
```

`review.md` is the deliverable. Everything else is the evidence that it was conducted
rather than composed.

### The data files are real CSVs

`records.csv` and `screening.csv` are machine-readable because three things depend on
it: the figures are generated from them, `literature-review:review-critic` recomputes the flow
arithmetic from them, and a human reviewer can open them in a spreadsheet and check.

```csv
record_id,source_type,source_db,query_id,iteration,doi,arxiv_id,pmid,openalex_id,title,authors,year,venue,retrieved_date,pre_screen,duplicate_of
```

Every retrieved record is a row, duplicates included — `pre_screen` marks them rather
than deleting them, because the identification count is computed from this file.
`source_type` is `database`, `register` or `other` (citation searching), and decides
which column of the flow diagram a record belongs to. Field meanings are in the
`literature-review:source-discovery` skill.

```csv
record_id,stage,screener_1,screener_1_criterion,screener_2,screener_2_criterion,agreed,adjudication,final,final_criterion,decided_by,full_text_retrieved,study_id
```

`stage` is `title_abstract` or `full_text`, because PRISMA counts exclusions at each
separately. `screener_*` values are `include` / `exclude` / `unsure`. `decided_by` is
`automation` or `human` — the split the PRISMA template's footnote requires of any
review using automation tools. `full_text_retrieved` feeds "Reports not retrieved", and
`study_id` groups several reports of one study. Field rules are in the
`literature-review:record-screening` skill.

The flow counts are never assembled by hand. `screening_stats.py` derives
`prisma-flow.json` from the two CSVs and refuses when they are inconsistent.

## The Conduct Disclosure

The document that keeps the review honest. It is generated, short, and unhedged.

```markdown
# Conduct disclosure

This review was conducted by an automated agent pipeline. It follows the PRISMA 2020
reporting standard. It is not equivalent to a systematic review conducted by
independent human reviewers, and the differences are below.

## What was automated
| Stage | How | PRISMA item |
|---|---|---|
| Screening | Two agents, identical inputs, no shared context. κ = 0.81 | 8 |
| Extraction | One agent per study, structured template | 9 |
| Risk of bias | One agent per study, <instrument> | 11 |

## Where this differs from independent human screening
The two screeners are instances of the same model given the same inputs. Their
independence is contextual, not cognitive: they cannot see each other's decisions,
but they share training and therefore share systematic blind spots. Cohen's κ
measures their agreement, and between two instances of one model it overstates what
the same statistic means between two people.

## What a human must still do
- [ ] Register the protocol (PROSPERO) — item 24a
- [ ] Second independent human screen — item 8
- [ ] Adjudicate risk of bias — item 11
- [ ] Declare support and competing interests — items 25, 26
```

The κ caveat is not optional. A high κ between two instances of one model is weaker
evidence than the same number between two people, and a reader who does not know the
screening was automated will read it as the stronger thing.

## Citations

`review.md` uses pandoc citation syntax against `references.bib`:

```markdown
Three included studies run consolidation offline [@smith2024; @jones2025; @patel2026].
As @chen2024 notes, the inline variant trades latency for freshness.
```

Slightly noisier to read raw. In exchange, every export format gets correctly
formatted citations and a generated bibliography from one source, and the citation
keys are checkable against the `.bib` mechanically.

### BibTeX

Entries come from **resolved metadata** — Crossref for DOIs, the arXiv API for arXiv
IDs, `export_citations` for arXiv works — never hand-written. A hand-written entry is
an unverified citation with extra steps.

Every entry carries its identifier. A reference with no resolvable identifier is
flagged in the verification table as outside the check, with the reason.

### Style

CSL, chosen at intake: APA, Vancouver, IEEE, Chicago. Styles come from the
[CSL repository](https://github.com/citation-style-language/styles). Record the style
in `protocol.md` so a re-export reproduces the same document.

## Export

### The command

```
pandoc review.md \
  --citeproc \
  --bibliography=references.bib \
  --csl=<style>.csl \
  --resource-path=. \
  -o review.docx
```

### The rasterizer problem

**pandoc cannot embed SVG in .docx or .pptx.** It shells out to an external converter
and embeds the resulting PNG. The usual converter, `rsvg-convert`, has no Windows
build, so this fails on Windows in a way that looks like the figures silently
vanishing.

**Phase 0 probes for a rasterizer and records the result in `protocol.md`**, so a
missing one surfaces at the Phase 1 gate rather than after the review is written.
Probe order:

| Converter | Command | Notes |
|---|---|---|
| `rsvg-convert` | `rsvg-convert --version` | librsvg. Best fidelity. Linux/macOS |
| `inkscape` | `inkscape --version` | Cross-platform including Windows. Slow |
| `magick` | `magick -version` | ImageMagick. Needs an SVG delegate; check it renders |
| `svglib` | via `uvx` | Pure Python, no native libraries — the Windows fallback |

Verify by converting one figure and looking at the output, not by the version string.
ImageMagick in particular reports success while producing a blank raster when its SVG
delegate is missing.

Rasterize at **300 DPI minimum** for print. The figures are designed at ~800 units
wide, so this is roughly a 2500px raster — sharp in Word and in print.

### Degradation

| Available | Produce |
|---|---|
| pandoc + rasterizer | .md, .bib, .docx, .pdf, figures embedded |
| pandoc only | .md, .bib, .docx with figures **listed as missing in the export report** |
| neither | .md + .bib + `figures/`, and say plainly that no converted formats were produced |

**Never silently ship a .docx with the PRISMA diagram missing.** The export report
names every figure that did not make it and why.

## The Revision Log

At the head of `review.md`:

```markdown
**Compiled:** 2026-09-20 · **Last revised:** 2026-10-04

| Date | Change |
|---|---|
| 2026-10-04 | Retracted the prevalence claim in §3.4; see the retraction in place |
| 2026-09-28 | Added 3 studies from a forward-snowballing pass; flow diagram renumbered |
```

Retractions stay visible in the body (`provenance.md`). The log is the index to them.
When the output directory is under version control, the log and the git history say
the same thing two ways — which is the point, since one of them is checkable.
