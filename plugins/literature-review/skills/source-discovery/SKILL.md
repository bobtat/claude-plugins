---
name: source-discovery
description: The procedure for executing an approved protocol's searches — one hunter per source running the literal string, recording true totals against what was retrieved, deduplicating across sources without collapsing a preprint into its published version, and then snowballing backward and forward from the included set within the protocol's caps. Used by /literature-review:review in Phase 2 and in each snowballing pass.
---

# Discovery

Discovery executes `protocol.md` sections 3–5 exactly as approved. It does not improve
the strings, add a source that seemed useful, or widen a cap. A search that drifts from
its protocol cannot be reproduced from it, and reproducibility is the one thing a
machine-run search can offer that a human one usually does not.

**Load the `literature-review:literature-review` skill** — `references/search-strategy.md`
governs syntax, snowballing and logging.

## Pass 0 — Database and Register Search

### Fan out

Spawn one `literature-review:source-hunter` per source in the protocol, in parallel —
they are independent. Give each:

- the source name and its **literal** string from `protocol.md` section 4,
- the date range and limits,
- the retrieval cap, if the protocol set one,
- absolute paths for its records slice (`records.<source>.csv`) and its log entry.

### What each hunter returns

A slice of records and a `search-log.md` entry carrying, per PRISMA-S:

- an abstract for each record where the route provides one,
- the string exactly as run, the interface and its version, the date searched,
- **total matched** as reported by the source, and **retrieved** — kept apart,
- whether a cap was hit, and for a relevance-ranked source, that the cap kept the top
  results rather than an arbitrary subset.

The difference between total matched and retrieved is the thing a flow diagram most
often misstates. PubMed and arXiv both report a true total without a key; record it
even when you retrieve fewer.

### Several strings against one source

A protocol often runs several strings against one source. **Their union is that source's
result set**: a record returned by three arXiv strings is one arXiv record, and "Records
identified from arXiv" counts unique records across all its strings. Overlap *between
sources* is what the "Duplicate records removed" box counts.

Log each string's own total and retrieved count, and the size of the overlap between
them, in `search-log.md`. This is equivalent to running one combined `OR` search, and
fixing it here matters for reproducibility: logging per string-and-record pair instead
would put the overlap in the duplicates box, and two runs of the same protocol would
draw different flow diagrams.

### Merge into `records.csv`

```csv
record_id,source_type,source_db,query_id,iteration,doi,arxiv_id,pmid,openalex_id,title,authors,year,venue,retrieved_date,pre_screen,duplicate_of
```

- `source_type` — `database`, `register`, or `other`. Snowballing is `other`.
- `query_id` — **every** string that returned the record, semicolon-separated, in
  protocol order (`ax-1;ax-4`). The first is the one credited for any cap allocation.
- `iteration` — `0` for this pass; `1`, `2`, … for snowballing passes.
- `pre_screen` — `kept`, `duplicate`, `automation_ineligible`, or `other:<reason>`.
  These feed the "Records removed before screening" box directly.
- `duplicate_of` — the kept record's `record_id`, for duplicates.

### Abstracts

Title/abstract screening needs abstracts, and `records.csv` has no column for them.
Write them to **`abstracts.json`**, an object keyed by `record_id`:

```json
{"ax-2609.29647": "Memory poisoning and decomposition attacks distribute…"}
```

The arXiv result page already carries each full abstract, and PubMed's `efetch` returns
them, so capture them here rather than fetching again at screening. A record with no
abstract has no key; screeners see its title alone and answer `unsure`.

**Every retrieved record gets a row, duplicates included.** The identification count is
computed from this file, so a duplicate deleted rather than marked makes the flow
diagram's first box wrong.

### Deduplicate

Match in this order and stop at the first hit:

1. DOI, lower-cased, with any `https://doi.org/` prefix stripped
2. arXiv ID with the version suffix removed (`2502.12110v3` → `2502.12110`)
3. PMID
4. Normalized title + year + first author's surname

**A preprint and its published version are not duplicates.** They are two reports of
one study. Keep both as `kept`, and let screening link them under one `study_id`. The
PRISMA template distinguishes "Studies included" from "Reports of included studies" for
exactly this case, and collapsing them at deduplication erases the distinction.

Keep the record with the most identifiers; mark the rest `duplicate`.

## Snowballing Passes

Snowballing runs **after** a screening round, from the records included at full text.
The command alternates: search → screen → snowball → screen the new records → repeat,
until a pass yields no new inclusions or the protocol's iteration cap is reached.

### Routes, tested

| Direction | Route | Key? | Coverage |
|---|---|---|---|
| Backward | Crossref `works/<DOI>` → `message.reference` | No | Crossref-registered DOIs where the publisher deposited references. **Not arXiv** |
| Backward | OpenAlex single work → `referenced_works` | No, for single lookups | Published works. Returned **no references** for an arXiv DOI when tested |
| Backward | arXiv HTML full text → `<li class="ltx_bibitem">` | No | **arXiv works** with an HTML rendering — the route that works for preprints |
| Backward | `arxiv-mcp-server` citation tools | No | arXiv works, when the server is present |
| Forward | PubMed `elink` with `linkname=pubmed_pubmed_citedin` | No | **PubMed-indexed citing work only** |
| Forward | OpenAlex `/works?filter=cites:<id>` | **In practice, yes** | Broad |

### arXiv preprints need the bibliography route

An arXiv DOI (`10.48550/arXiv.…`) is registered with DataCite, not Crossref: Crossref
returns 404 for it, the DataCite record carries no references, and OpenAlex returned no
`referenced_works` for one when tested. **None of the DOI-based backward routes work for
an arXiv preprint.** Parse the reference list from the paper's HTML rendering instead:
one tested paper had 237 `ltx_bibitem` entries, about 40% carrying an arXiv ID and
almost none a DOI. Resolve those with an arXiv ID directly; resolve the rest by title,
and record any reference that cannot be resolved rather than dropping it.

Forward snowballing outside biomedicine needs an OpenAlex key. If the toolchain probe
found none, forward citation searching for non-PubMed work did not happen — record that
in `search-log.md` as a limitation, never as a pass that found nothing.

### Caps

Apply the protocol's per-seed and total caps. A heavily cited seed can have tens of
thousands of citing works; retrieving all of them is not snowballing, it is a second
unbounded database search. Record for each seed how many citing or cited works existed
and how many were taken, and by what rule.

### Recording

Snowballed records are `source_type=other`, `source_db` of
`Citation searching (backward)` or `Citation searching (forward)`, and the pass number
in `iteration`. Each pass gets its own `search-log.md` entry: direction, seed set, date,
found, taken.

## Degradation

If a source cannot be reached by any route, the hunter may fall back to general web
search. This is permitted and **not equivalent**: no structured metadata, no total, no
reliable identifiers. Those records are tier C, the fallback is logged, and the
limitation goes in the review.

## Never

- **Never invoke Sci-Hub**, whatever tool offers it. Open-access routes only.
- **Never edit a string** to get better results. A string that performs badly is an
  amendment to the protocol, raised with the user and logged in section 14.
- **Never delete a record.** Mark it.
- **Never retrieve full text here.** Discovery collects metadata. Full text is fetched
  at full-text screening and appraisal, where the tier it earns is recorded.
