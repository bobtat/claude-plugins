---
name: review-protocol
description: The procedure for writing a systematic review's protocol before any searching — turning a question into numbered eligibility criteria, per-source search strings, a snowballing plan with caps, a screening and appraisal plan, a figure budget, and a toolchain probe, then running pilot counts so the approval gate carries evidence about volume. Used by /literature-review:review in Phases 0 and 1.
---

# Writing the Protocol

`protocol.md` is the contract. It is written before a single record is retrieved,
approved by the user at the Phase 1 gate, and every later phase is judged against it.
It is also what PRISMA item 24b asks for: a protocol that existed before the results
did.

**Load the `literature-review:literature-review` skill** — `references/search-strategy.md`
and `references/appraisal.md` are the criteria for what goes in here.

## Phase 0 — Intake

Three things before the protocol can be drafted.

### A question, not a topic

Refuse a bare topic and ask for the question. The frameworks table in
`references/search-strategy.md` helps the user say it; do not invent it for them.

### Where the output goes

Ask for the output directory and the citation style (APA, Vancouver, IEEE, Chicago)
if not given. Default to a new directory named for the question under `docs/research/`
when the working directory is a repository, and say so.

### The toolchain probe

Use the Bash tool. Record each result in the protocol's Toolchain section.

| Probe | How | If absent |
|---|---|---|
| `paper-search-mcp` tools | Are its tools in the session? | Discovery falls back to the keyless routes below |
| `arxiv-mcp-server` tools | Same | arXiv full text via the abs page; BibTeX via DOI negotiation |
| `OPENALEX_API_KEY` set | `test -n "$OPENALEX_API_KEY"` | Keyless OpenAlex **search** draws on a per-IP daily budget shared with everyone on the same network, and is routinely exhausted. Forward snowballing outside biomedicine is effectively unavailable |
| `pandoc` | `pandoc --version` | No .docx or PDF |
| A rasterizer | The probe order in `references/reporting.md` — and convert one test SVG, do not trust a version string | .docx and PDF would ship without figures |

A missing rasterizer or OpenAlex key is raised **at the Phase 1 gate**, while the
user can still fix it or change scope — not discovered after the review is written.

## Phase 1 — The Protocol

### The template

```markdown
# Protocol — <short title>

**Drafted:** <date> · **Approved:** <date, filled at the gate> · **Status:** draft | approved

## 1. Question
<The question, verbatim as agreed.>
Framework: PICO | PICOS | PECO | SPIDER | PIRD | Objective/Intervention/Outcome | none
<Each component, one line.>

## 2. Eligibility criteria
Numbered, so every screening decision can cite one.

| Code | Criterion | Decidable at title/abstract? |
|---|---|---|
| I1 | … | yes |
| E1 | … | no — full text |

## 3. Information sources
| Source | Interface | Date range | Why this source |

## 4. Search strings
One subsection per source, the **literal** string in that source's syntax.

## 5. Snowballing
Directions (backward / forward), seed set, iterations, per-seed caps, total cap.

## 6. Screening
Two independent screeners at title/abstract and at full text. Adjudication rule.
The κ threshold below which criteria are revised rather than adjudicated.

## 7. Data items
Outcomes (item 10a) and other variables (10b) to extract, each defined.

## 8. Risk of bias
Instrument per design, or the stated critique criteria where none is validated.

## 9. Synthesis
Narrative or meta-analysis, and why. Planned threads if known.

## 10. Figure budget
| Figure | Source file | Mandatory? |

## 11. Output
Directory · formats · CSL style

## 12. Toolchain
The Phase 0 probe results.

## 13. Pilot counts and scale
Per-source totals from count-only queries, and what they imply.

## 14. Amendments
| Date | Change | Reason |
```

### Criteria

The criteria are the part of the protocol that decides screening agreement. Write them
for someone who has only a title and an abstract.

- **One condition per criterion.** "Randomized trials in adults" is two criteria and
  will be applied as whichever half the screener noticed.
- **Mark which can be decided from a title and abstract.** A criterion needing the full
  text is still valid, but screeners must be told to answer `unsure`, not guess, at the
  title/abstract stage.
- **Exclusions are stated positively.** "E2: Population is not adults" — not "E2:
  Wrong population", which gives the screener nothing to check.
- **Short labels travel.** Each criterion's code and a short label (`E2: Not adults`)
  become the exclusion reasons in the flow diagram. Keep the label under about five
  words.

Ambiguous criteria are the cause of low κ, and low κ is fixed by rewriting criteria,
not by adjudicating forty records one at a time.

### Search strings

Build blocks and translate them per source as `references/search-strategy.md`
describes. Every source gets its own literal string; a string written once and reported
as though it ran everywhere is a PRISMA-S failure.

The routes that answer without keys, tested:

| Source | Route | Returns a true total? |
|---|---|---|
| PubMed | E-utilities `esearch` | **Yes** — `esearchresult.count` |
| arXiv | `https://arxiv.org/search/?query=…&searchtype=all` (HTML) | **Yes** — "Showing … of N results" |
| OpenAlex | `/works?search=` | Yes, **but needs a key** in practice |
| Crossref | `/works?query=` | **No** — the query is relevance-ranked, not Boolean, and the total counts nearly everything. Crossref resolves identifiers; it does not do discovery |

The arXiv **export API** returns HTTP 406 from environments like this one. Use the HTML
search. `literature-review:citation-verifier` documents the same finding.

### Pilot counts

Before the gate, run each string **count-only** and record the totals in section 13.
This is what turns the gate from "does this look right?" into a decision with evidence:

- **Zero or near-zero** — the string is broken or too narrow.
- **Tens of thousands** — the string needs a block, a field restriction, or a date
  bound, or the question is too broad for this method.
- **Large overlap expected** — say so; deduplication will absorb it.

Then state the implied scale plainly: how many records reach title/abstract screening,
roughly how many full texts, and that each record is screened by two agents and each
full text read at least three times (two screeners and the appraisal reader). Present
volumes, not a cost figure you cannot back.

### Snowballing caps

Forward snowballing from a heavily cited paper explodes — one landmark paper can be
cited tens of thousands of times. The protocol must cap it:

- **Per-seed cap** on forward citations, and the rule used to choose within it
  (most recent, or relevance-ranked against the question).
- **Iterations** — usually one or two passes. Saturation is the stopping rule; the cap
  is the backstop.
- **Directions actually available** given the probe. Without an OpenAlex key, forward
  snowballing outside PubMed-indexed work is not available — say so here rather than
  discovering it mid-run.

Snowballing is citation searching, so it selects the two-column PRISMA template.

### The figure budget

List every figure the review will produce, each bound to its source file. The PRISMA
flow diagram is always in it. The risk-of-bias pair is in it whenever section 8 names
an instrument. Everything else follows the trigger in `references/figures.md`.

Declaring figures now, before the prose exists, is what makes them happen.

## The Critique

Spawn `literature-review:protocol-critic` with the absolute path to the draft and the
path it writes its findings to. Address each finding you accept; say why for any you
reject. **Two critic rounds at most.** "No material findings" is a valid result, not a
failure to look hard enough.

## The Gate

Present, with `AskUserQuestion` where there is a real choice:

- The question and the criteria table
- Sources, and the pilot counts per source
- The implied scale
- Snowballing directions and caps, including any direction unavailable for lack of a key
- The RoB instrument, or the critique criteria if none fits
- The figure budget
- Toolchain gaps — a missing rasterizer, a missing key — and what each costs
- Anything the critic raised that you did not resolve

Recommend, do not just list. **Do not search until the user approves.** On approval,
set Status to approved and fill the date.

## After the Gate

The protocol is frozen. Any change after approval is an **amendment**: recorded in
section 14 with its date and reason, and reported under PRISMA item 24c. A criterion
changed silently after screening began invalidates every decision made under the old
one.
