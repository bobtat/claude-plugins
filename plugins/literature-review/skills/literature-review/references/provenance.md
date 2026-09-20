# Provenance: How a Claim Is Known

PRISMA governs how a review is *conducted*. It has nothing to say about how the
person conducting it came to believe a given sentence, because it was written for
humans, and humans do not confabulate a citation that reads exactly like a real one.

A model does. That is the failure this file exists to catch, and it is not a
hypothetical: the worked examples below are drawn from a real review in this
repository whose errors were caught and documented after publication.

## The Five Tiers

Every claim in a review carries a tier. The tier records **the act that produced
the knowledge**, not how confident the sentence sounds.

| Tier | What it means | What produced it |
|---|---|---|
| **A** | Read directly | The full text, or a named, bounded section of it, was retrieved and read. Cite the page, section, table, or figure. |
| **B** | Machine summary of the source | A summarising model read the source and returned prose. The underlying text was never inspected. |
| **C** | Search-result snippet | Title, abstract fragment, or search-engine summary only. Existence verified; content not. |
| **D** | Unverified recall | Written from model training knowledge with no source consulted. |
| **E** | Vendor or non-reviewed material | Written by a vendor about its own product, or by a third party with no peer review. |

An academic review should be **mostly A and C**, with B and D confined to clearly
labelled background and E excluded from the evidence base entirely. A review whose
findings rest on D has not been conducted; it has been recalled.

### Assignment rules

These are mechanical. Do not deliberate.

1. **Tier is assigned at the moment of reading, by the reader, and never revised
   upward.** The `paper-reader` agent records what it actually retrieved. A later
   pass cannot promote C to A because the claim "seems solid."
2. **An abstract is tier C, not tier B.** Reading the abstract is not reading a
   summary of the paper; it is reading the authors' summary of what they want you to
   take away. It is the single most over-promoted tier in practice.
3. **A partial read is tier A only for the parts read.** If §4 was retrieved and §5
   was not, claims from §5 are not tier A. Record the ranges: *"pp. 1–12 and
   Appendix A.2; §5 not retrieved."*
4. **A source that could not be retrieved is tier C at best**, however confident the
   recall about it. An unfetchable paper you remember is tier D wearing a citation.
5. **Degraded tooling produces an honest tier, not a failure.** When the discovery
   server is unavailable and the search fell back to the web, the results are tier C.
   Record the degradation in `search-log.md`.
6. **When two tiers apply, take the lower.**

### What each tier can support

| Tier | Can support | Cannot support |
|---|---|---|
| **A** | Specific claims about method, result, and limitation, with location | Claims about the field beyond this paper |
| **B** | The source's general position | Any number, any methodological detail, any quotation |
| **C** | *That the work exists and concerns this topic* | Any claim about what it found |
| **D** | Nothing in the findings. Background framing only, labelled | Anything a reader might act on |
| **E** | What the vendor claims about itself, attributed as such | That the claim is true |

The tier-C row is the one most often violated. A snippet supports "Smith et al.
studied retrieval latency." It does not support "Smith et al. found retrieval latency
dominates," even when the snippet appears to say so — abstract fragments are
truncated mid-qualification routinely.

## Verification

### Two checks, and they are not the same

**Existence check** — the identifier resolves to a real record.
**Title match** — the record it resolves to is the work being cited.

Running the first and calling it verification is the error that matters, because a
confidently-recalled claim attached to a real-but-wrong paper passes existence
cleanly. The review in `docs/research/` did exactly this: a citation to MINJA
resolved to a genuine arXiv paper while the surrounding prose described a different
one. **Both checks, on every reference, or the reference does not ship.**

### The procedure

For every citation in the reference list:

1. Resolve the identifier — DOI through Crossref, arXiv ID through the arXiv API,
   PMID through PubMed.
2. Compare the resolved title against the cited title. Normalize case, punctuation
   and subtitles; anything beyond that is a mismatch, not a variant.
3. Compare first author and year.
4. Record the outcome per reference, not in aggregate.

Report it as a table with a row per reference. **A count is not a result**: "all 24
verified" is the claim the earlier review made while having checked 11.

### What the check does not do

State this in the review, because a verification table reads as a stronger guarantee
than it is:

- It does not verify that any claim about the content is correct.
- It does not cover works cited without a resolvable identifier — book chapters,
  technical reports, URLs. Name that residue explicitly and give its size.
- It does not detect a reference that is real, correctly titled, and irrelevant.

## The Prevalence Rule

These constructions require having read the corpus:

> *most*, *nearly every*, *the field has converged*, *the standard approach*,
> *no system does X*, *consistently*, *the most-cited*, *widely used*

A search that returned 40 records and read 12 of them cannot support any of them.
They are not hedged into acceptability by "seems" or "appears" — the problem is the
scope of the quantifier, not the confidence of the verb.

**The permitted form names the evidence base:**

| Instead of | Write |
|---|---|
| "Most systems use a vector store." | "Nine of the twelve included studies use a vector store." |
| "The field has converged on X." | "X appears in every included study that addresses retrieval; the search was not designed to find dissent." |
| "No work addresses Y." | "No included study addresses Y. The search strings in `protocol.md` were not built to find it, so this is weak evidence of absence." |

A universal negative is the hardest claim in a review and the easiest to write.
Absence of evidence in a bounded search is evidence of nothing except the bounds of
the search.

## Retraction

When a claim is found wrong after the review is written, **the correction stays
visible**. Do not silently edit and move on.

> ~~An earlier revision stated that most decay-based systems delete rather than
> decay.~~ **Retracted 2026-09-14** — this was a prevalence claim resting on four
> tier-C snippets. What the evidence supports: three of the four included
> forgetting papers decay accessibility rather than delete.

Two reasons. A reader who acted on the original needs to know it changed, and a
review that shows its corrections is making a verifiable claim about its own
process. A review that shows none is claiming it was right the first time.

The revision log at the head of the document records each one with a date.

## Worked Examples

**Tier inflation.** A `paper-reader` returns: *"Tier A. The paper reports 34% lower
retrieval latency."* Its retrieval log shows it fetched the abstract page. → Tier C.
The claim survives only as "the abstract reports 34% lower retrieval latency" and is
flagged for a full-text read before it can be relied on.

**Recall wearing a citation.** A synthesis paragraph reads: *"CoALA divides long-term
memory into episodic, semantic and procedural modules [@sumers2024]."* The paper is
in the included set at tier A with §6 read. → Legitimate. Same sentence where the
paper is tier C → the claim is model recall with a real citation stapled to it.
Demote, or read §6.

**Prevalence from a thin base.** *"Every major agent framework now implements
consolidation."* → Fails on two counts: "every" and "major" are both unmeasured. The
supportable version names the count and the source.
