# Search Strategy

The search is the part of a review that determines what the review can possibly
conclude, and it is settled before anything is read. A synthesis cannot recover from
a search that never found the dissenting work.

## A Question, Not a Topic

A topic cannot be searched systematically because nothing about it says what would
count as a relevant record. Refuse one and ask for a question.

| Topic | Question |
|---|---|
| "Agent memory" | "What memory architectures do LLM agent systems use, and what evidence supports each?" |
| "Semaglutide" | "In adults with obesity and without diabetes, how does semaglutide compare with placebo for weight loss at 52 weeks?" |
| "Code review" | "Does modern code review reduce defect density in industrial software projects?" |

A well-formed question already contains the inclusion criteria. If you cannot read
the criteria off the question, the question is not finished.

### Frameworks

Pick the one that fits the question. They exist to force the components into the
open, not as a ritual.

| Framework | Components | Fits |
|---|---|---|
| **PICO** | Population, Intervention, Comparator, Outcome | Clinical effectiveness |
| **PICOS** | + Study design | When design is an inclusion criterion |
| **PECO** | Population, Exposure, Comparator, Outcome | Observational and epidemiological |
| **SPIDER** | Sample, Phenomenon of Interest, Design, Evaluation, Research type | Qualitative and mixed-methods |
| **PIRD** | Population, Index test, Reference test, Diagnosis | Diagnostic accuracy |
| **Objective / Intervention / Outcome** | Free-form, but named and bounded | Computer science and engineering, where PICO fits badly |

Forcing a CS question into PICO produces an empty Comparator and a fake Population.
Say which framework was used, and say when none was.

## Building the Strings

### Blocks and combination

One block per question component. Within a block, synonyms are `OR`-ed. Blocks are
`AND`-ed together.

```
Block 1 (population):    "large language model" OR "LLM" OR "language agent"
Block 2 (intervention):  memory OR "retrieval augmented" OR consolidation
Block 3 (outcome):       benchmark OR evaluation OR accuracy

Query: (Block 1) AND (Block 2) AND (Block 3)
```

**Three blocks is usually the maximum.** Each additional `AND` block cuts recall
sharply, and in a review the cost of a missed study is much higher than the cost of
screening extra records. Where precision and recall trade off, take recall — screening
is cheap here, and a study never retrieved is invisible forever.

### Synonym expansion

For each concept, sweep deliberately:

- **Spelling variants** — behaviour/behavior, randomised/randomized
- **Abbreviations and their expansions**, both — "RAG" and "retrieval augmented generation"
- **Hyphenation variants** — "fine-tuning", "fine tuning", "finetuning"
- **Superseded terminology** — the name the concept had five years ago still indexes
  the older literature
- **Author-preferred coinages** — a subfield often names the same thing three ways

Truncation catches morphology: `memor*` covers memory, memories, memorization.
Check the database's truncation character; it is not always `*`.

### Controlled vocabulary

Where a database has a thesaurus, use it **alongside** free text, never instead of
it. MeSH in PubMed, Emtree in Embase. Indexing lags publication by months, so
controlled-vocabulary-only searches systematically miss the most recent work — which
in a fast-moving field is the work that matters most.

```
("Memory, Short-Term"[MeSH] OR "working memory"[tiab]) AND ...
```

Sources without a thesaurus — arXiv, Semantic Scholar, OpenAlex — are free-text only.
Say so; the difference in search quality between a MeSH-indexed and a free-text source
is real and belongs in the limitations.

### Syntax differs per database

A string is not portable. Translate it, record each translation separately, and never
report one string as though it ran everywhere.

| | Field tags | Truncation | Phrase | Notes |
|---|---|---|---|---|
| **PubMed** | `[tiab]`, `[MeSH]`, `[au]` | `*` | `"..."` | Automatic term mapping expands unquoted terms — quote to suppress it |
| **arXiv** | `ti:`, `abs:`, `au:`, `cat:` | limited | `"..."` | Category filters (`cat:cs.AI`) are the strongest precision lever |
| **Crossref** | query params | none | bibliographic match | Metadata only; no abstract search |
| **OpenAlex** | filters on concepts, year, type | none | `"..."` | Strong structured filtering, weaker text matching |
| **Semantic Scholar** | fielded + semantic | none | `"..."` | Relevance-ranked, so a cap truncates by rank, not arbitrarily |

That last point matters for the flow diagram. On a relevance-ranked source, a capped
retrieval is the *top n*, not a random n — record the cap and the ranking so the
reader knows what the cap removed.

## Snowballing

Citation chaining, following Wohlin C. *Guidelines for snowballing in systematic
literature studies and a replication in software engineering.* EASE '14. DOI
[10.1145/2601248.2601268](https://doi.org/10.1145/2601248.2601268).

- **Backward** — the reference lists of included studies. Finds the foundational work
  that database queries miss because it predates current terminology.
- **Forward** — works citing an included study. Finds the responses, replications and
  refutations, which is where a review's disagreement material lives.

Run both, from the **included** set, and iterate until a pass yields no new
inclusions. Wohlin's finding is that snowballing is a viable first strategy, not only
a supplement — worth knowing when a topic's terminology is too unstable for a Boolean
query to work at all.

Every snowballing pass is logged like any other source: direction, seed set, date,
records found, records included.

## When to Stop

Stopping is a decision, and it needs a stated basis:

- **Saturation** — a snowballing pass yields no new inclusions.
- **Protocol exhaustion** — every database in the protocol has been searched at its
  stated date.
- **A cap was hit** — legitimate, but it is a limitation and goes in the limitations
  section, not silently into the flow diagram.

"Enough records" is not a stopping rule.

## Logging

`search-log.md` carries, per source, the fields PRISMA-S requires:

```markdown
### PubMed
- Searched: 2026-09-20
- Interface: paper-search-mcp 0.1.4 (search_pubmed)
- Query: ("large language model"[tiab] OR "LLM"[tiab]) AND (memory[tiab] OR ...)
- Limits: 2020/01/01–2026/09/20; English
- Records retrieved: 84
- Cap: none / hit at 100 (relevance-ranked)
- Notes: MeSH terms unavailable through this interface — free-text only
```

A reader must be able to re-run the search from this file alone. If they cannot, the
review is not reproducible whatever else it reports.

## Degradation

When the discovery server is unavailable, the search falls back to general web search.
This is permitted and it is **not equivalent**:

- Results become **tier C** with no structured metadata.
- No deduplication, no result counts, no DOI resolution.
- Coverage is unknown rather than bounded.

Record the fallback in `search-log.md`, mark the affected records, and state in the
limitations that the search was degraded for those sources. A degraded search that
says so is usable; one that does not is misleading.
