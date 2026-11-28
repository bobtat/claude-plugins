# literature-review

A Claude Code plugin that conducts a systematic literature review to PRISMA 2020, and audits reviews written by anyone.

## What It Does

A model reviewing literature fails in ways the methodology standards were not written for. It cites a real paper for a claim that paper never makes. It quotes a sentence that is in a different paper. It writes a confident paragraph from an abstract. This plugin is built around those failures:

> **PRISMA governs the process. Evidence tiers govern what each claim may say. Figures carry the same discipline as the prose.**

- **`/literature-review:review`** runs the whole pipeline: protocol, search, dual screening, appraisal, figures, synthesis, audit and export. It stops for your approval twice, after the protocol and after the inclusion set.
- **`/literature-review:audit`** checks an existing review and reports findings. It changes nothing, and it works on a file, a directory or a URL, including reviews this plugin did not write.
- **Every claim carries an evidence tier**, A to E, set by how the source was actually read. An abstract supports "this work exists and concerns the topic", never a finding.
- **Every citation is resolved and title-matched.** A real identifier attached to the wrong paper passes an existence check; it does not pass this one.
- **Every quotation is checked by script** against the saved full text of the paper it is attributed to. Words from a different paper are reported as a transplant.
- **The numbers are derived, not typed.** Flow counts, exclusion reasons and screener agreement come from the screening files through a script that refuses inconsistent data. Each study's overall risk-of-bias rating is computed from its domain ratings.
- **Categories are fixed before anyone reads.** Every coded data item has its allowed values in the protocol, and a script refuses a value outside them.
- **Every number is traced.** A figure credited to a study must appear in that study's saved text.
- **Each study is read once and judged twice.** An extractor turns the paper into coded, quoted data and makes no judgment. Two independent judges rate it against anchors fixed in the protocol, and an adjudicator settles what they leave open from the paper's text. Their agreement is reported.
- **Figures are part of the standard.** The PRISMA flow diagram comes from a generator that will not draw arithmetic that does not close. The other figures are drawn from data files and validated for geometry, colliding labels, theming and accessibility.
- **The review says what it is.** The PRISMA checklist is marked `met`, `met-by-machine` or `requires-human`, and every run writes a conduct disclosure naming what a person must still do.

## When Not to Use It

A systematic review is expensive, and most questions do not want one. For a quick answer, a narrative report, or one claim to check, use ordinary search. Use this when you want an evidence base you can reproduce and defend. The command says so before it starts.

## What a Run Costs

Two full runs have been measured, both with the search deliberately capped.

| | Unattended, 2026-11-26 | Attended, 2026-11-28 |
|---|---|---|
| Question | Memory poisoning attacks on LLM agents | Exergames and exercise motivation |
| Records identified / screened | 132 / 115 | 199 / 150 |
| Reports sought / not retrieved | 64 / 0 | 65 / 21 |
| Studies included and appraised | 52 | 6 |
| Stops for the user | 0 | 5 |
| Running time | 89 minutes | 104 minutes |
| Cost | $86.67 | $66.08 |

The two runs are not comparable study for study. The first used one appraisal reader per study, at about $0.73 each. The second used the current design, an extractor, two judges and an adjudicator where needed, and spent more of its cost outside appraisal: screening twice after a retrieval route was added, three rounds of rulings, and two audit passes. Its appraisal leg cost $13.93 for six studies, which includes recording a gate and drawing two figures. A three-study test had put the design at about $1.58 per study.

A small inclusion set does not make a cheap review. Most of the second run's cost was the protocol, the search and the screening of 150 records, which do not shrink with the number of studies that survive. Each record is screened twice, and each included full text is read by two screeners, an extractor and two judges.

## What It Produces

A directory, not a file. `review.md` is the deliverable; the rest is the evidence that it was conducted and not composed.

| File | What it is |
|---|---|
| `protocol.md` | The approved question, criteria, sources, strings and figure budget |
| `search-log.md`, `records.csv` | What was searched, and every record retrieved |
| `fulltext/`, `retrieval.csv` | Each full text, fetched once and title-checked |
| `screening.csv`, `prisma-flow.json` | Both screeners' decisions, and the derived counts |
| `appraisals/`, `rob.csv`, `extraction.csv` | Per study, one extraction and two independent judgments; and the merged data the figures use |
| `appraisal-agreement.json` | How often the two judges agreed, and what was adjudicated |
| `figures/*.svg` | The flow diagram, risk-of-bias plots and any others in the budget |
| `review.md`, `references.bib` | The review and its verified bibliography |
| `prisma-checklist.md`, `conduct-disclosure.md` | What was met, by whom, and what a person must still do |
| `audit.md` | The audit of the finished review, and what was fixed |
| `review.docx`, `review.pdf` | Exports, when the tools below are present |

## What a Person Must Still Do

The plugin does not produce a publishable systematic review by itself, and it says so in every run.

- **Two instances of one model are not two reviewers.** They share training, so their agreement overstates what the same figure means between two people. That holds for the two screeners and for the two judges. In the measured run the screeners agreed on 15 of 15 pilot records, and 12 of the 52 studies later included were of doubtful eligibility.
- **Approve the gates.** The protocol decides what the review can conclude. Read the criteria, and the doubtful inclusions listed at the second gate.
- **The quote check proves the words are in the paper.** It does not prove they support the judgment beside them.
- **The audit is a self-check** by the same pipeline. It found and fixed real errors in the measured run, including a wrong study named for one result. It is not an independent review.
- Registration, a second human screen, adjudication of risk of bias, and declarations of support and interests are always marked `requires-human`.

## Unattended Runs

Without a person, the command stops at each gate and writes `gate-<n>.md`. Running it again with the same `--output` resumes. With `--unattended` it proceeds on its own recommendation, records every gate as pre-authorized, and keeps doubtful studies in while marking them.

```
CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 claude -p "/literature-review:review <question> --output <dir> --unattended"
```

Set that variable for every headless run. In the measured run the harness launched 53 of 111 agents in the background although each was requested in the foreground, and a headless session otherwise stops background work after a time ceiling.

## No MCP Server Is Bundled

Every search and retrieval route is plain HTTP, and the measured run used no MCP server. Two community servers were evaluated for bundling and left out:

- **`paper-search-mcp` 0.1.4** did not start when tested on 2026-11-27 unless its MCP SDK dependency was held below 2.x. It also ships a Sci-Hub download tool, and its fallback download uses Sci-Hub by default. This plugin never retrieves from Sci-Hub.
- **`arxiv-mcp-server` 0.8.2** started and worked. It is a third-party project, and the plugin's agents have fixed tool lists that do not include it.

If you enable a paper-search server yourself, the plugin's agents will not use it, and the skills tell the main session never to call a download tool that can fall back to Sci-Hub.

## Requirements

- **`python3`** and outbound HTTPS. The eight scripts use only the standard library.
- **Optional: `OPENALEX_API_KEY`.** Without it, forward citation searching outside biomedicine does not run, and OpenAlex search depends on a shared quota. A missing key is raised at the first gate.
- **Optional, for Word and PDF:** `pandoc`; an SVG rasterizer (`rsvg-convert`, `inkscape`, ImageMagick with an SVG delegate, or `svglib` through `uvx`); and for PDF an engine (`xelatex`, `tectonic`, `typst` or `weasyprint`). The toolchain is probed before the first gate, and a missing format is reported, never silently dropped.

- **Optional: `pdftotext`** (poppler). Without it, an open-access copy that exists only as a PDF cannot be read.

Full texts come from three places: arXiv's HTML rendering, open-access PubMed Central, and the open-access copies OpenAlex lists for a paper, which are read as PDFs. Anything else is logged as not retrieved unless you supply it. A paywalled paper is never fetched.

## Installation

```
/plugin marketplace add bobtat/claude-plugins
/plugin install literature-review@bobtat-plugins
```

Or test locally:

```bash
claude --plugin-dir /path/to/claude-plugins/plugins/literature-review
```

## Usage

```
/literature-review:review What memory architectures do LLM agent systems use, and what evidence supports each? --output docs/research/agent-memory --style apa
/literature-review:audit docs/research/agent-memory-literature-review.md
/literature-review:audit https://example.org/a-published-review --citations-only
```

The review command refuses a bare topic and asks for a question. A well-formed question already contains its inclusion criteria.

## Invocation Names

Everything is addressed as `literature-review:<name>`, with no bare-name fallback.

- **Skills:** `literature-review:literature-review`, `literature-review:review-protocol`, `literature-review:source-discovery`, `literature-review:record-screening`, `literature-review:source-appraisal`, `literature-review:review-figures`, `literature-review:review-synthesis`, `literature-review:review-audit`
- **Agents:** `literature-review:protocol-critic`, `literature-review:source-hunter`, `literature-review:screener`, `literature-review:screening-adjudicator`, `literature-review:study-extractor`, `literature-review:study-judge`, `literature-review:appraisal-adjudicator`, `literature-review:figure-author`, `literature-review:citation-verifier`, `literature-review:review-critic`
- **Commands:** `/literature-review:review`, `/literature-review:audit`

## Structure

```
literature-review/
├── .claude-plugin/plugin.json
├── commands/
│   ├── review.md                  the pipeline, its gates and its rules
│   └── audit.md                   findings only; never edits
├── agents/                        ten, each with a fixed tool list
├── skills/
│   ├── literature-review/         the standard
│   │   ├── references/            PRISMA, tiers, search, appraisal, synthesis,
│   │   │                          figures, reporting, sources
│   │   ├── scripts/verify_quotes.py
│   │   └── examples/              quote-check fixtures
│   ├── review-protocol/           intake, criteria, pilot counts, first gate
│   ├── source-discovery/          searches, deduplication, snowballing
│   ├── record-screening/          dual screening, second gate
│   │   ├── scripts/fetch_fulltext.py
│   │   ├── scripts/screening_stats.py
│   │   └── examples/              a screening fixture covering every case
│   ├── source-appraisal/          one extractor and two judges per study
│   │   ├── scripts/appraisal_merge.py
│   │   ├── scripts/appraisal_check.py
│   │   └── examples/
│   ├── review-figures/
│   │   ├── scripts/prisma_flow.py
│   │   ├── scripts/check_figure.py
│   │   └── examples/
│   ├── review-synthesis/          threads, certainty, checklist, disclosure
│   │   ├── scripts/trace_numbers.py
│   │   └── examples/number-trace/
│   └── review-audit/              the seven-step audit
└── README.md
```

## What It Does Not Cover

- **Meta-analysis.** It knows when one is not warranted and refuses a forest plot without one. It computes no pooled estimates.
- **Grey literature, and non-English literature.** Academic sources and English search strings only.
- **Paywalled full text.** Open-access routes only.
- **Updating an existing review.** A command for extending a review with a new search is planned and not built.

## What Is Untested

Two full runs are the evidence behind this version: one unattended on an arXiv-heavy computing question, one attended on a health-science question. The second stopped at both gates and three more times, resumed each time, and had an adjudicator settle ratings. Neither run exercised:

- a field whose papers are mostly paywalled, without the user supplying texts: the health-science run could not read 21 of the 65 reports it sought, and one of those looked eligible from its abstract;
- supplementary files by a scripted route: one appendix that decided a study's eligibility was fetched by hand;
- a review of more than six studies under the extractor-and-two-judges design;
- forward citation searching;
- the export chain on Windows;
- a version in which the attended-run fixes of 0.4.0 and 0.4.1 were in place from the start. Three of them answer faults that run showed: a criterion amended without asking, a user's ruling extended to studies it did not name, and figures that named studies by record ID.

`skills/literature-review/references/sources.md` lists where each convention comes from, and which of this plugin's own claims did not verify.

## License

MIT
