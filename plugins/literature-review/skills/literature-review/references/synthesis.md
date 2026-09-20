# Synthesis

Synthesis is where a review earns its existence or fails to. A document that walks
through the included studies one at a time is an annotated bibliography; the reader
could have assembled it themselves.

## Organize by Thread, Not by Paper

A **thread** is a question the literature engages with. Each section takes one thread
and reports what the evidence says about it, drawing on however many studies bear on
it. A study with something to say about four threads appears in four sections.

| Paper-by-paper | Thread-by-thread |
|---|---|
| "Smith et al. (2024) proposed X and found Y…" | "**Whether consolidation should run offline.** Four included studies address this. Three [@a; @b; @c] run it offline, on the argument that…; [@d] runs it inline and reports…" |
| The reader does the synthesis | The review does the synthesis |
| Disagreement is invisible — it sits in separate paragraphs | Disagreement is the structure |

Build the threads from the extraction, not from the paper list: read across
`appraisals/*.md` looking for questions that more than one study answers. A thread
only one study addresses is not a thread; it is a finding, and it goes in a
single-study section that says so.

## Disagreement Is the Point

When included studies conflict, that is the most valuable thing the review has. It is
also what a language model most reliably smooths away, because averaging two positions
into a moderate-sounding sentence is the path of least resistance.

**Never resolve a disagreement by splitting the difference.** Report it, then explain
it if the evidence lets you:

| The disagreement is explained by | Report as |
|---|---|
| Different populations or datasets | "…on clinical notes [@a] but not on web text [@b], which is consistent with…" |
| Different outcome measures | "Both report improvement; [@a] measures recall@10 and [@b] measures end-task accuracy" |
| Different risk of bias | "[@a] reports a larger effect and is rated High for selection of the reported result" |
| Nothing visible | "**Unexplained.** Designs are comparable; the evidence does not resolve which holds." |

That last row is a legitimate and common outcome. "The evidence is inconsistent and I
cannot say why" is a finding. Manufacturing an explanation for it is fabrication.

## What a Narrative Synthesis Can Claim

Most reviews outside clinical medicine are narrative. The boundary is sharp:

| Can say | Cannot say |
|---|---|
| Directions, patterns, counts of included studies | Pooled effect sizes |
| "Five of seven report improvement" | "Improvement averages 12%" |
| That studies disagree | *How much* they disagree, statistically |
| That an approach recurs in the included set | That it is dominant in the field |

Vote-counting — tallying significant results — is a weak method and must be labelled
one. It weights a 20,000-participant trial equally with a 30-participant pilot. Where
it is used, report the counts *and* the study sizes, and never describe the majority
side as "supported by the evidence" on the strength of a tally.

### When meta-analysis is appropriate

Only when studies are clinically and methodologically similar enough that a pooled
estimate means something, and when effect sizes and variances are extractable.
Pooling heterogeneous studies produces a precise number describing nothing.

If a meta-analysis is not run, **say so explicitly and say why** — otherwise a reader
assumes it was considered and the data did not support it, which may not be what
happened. Items 12, 13d–13f and 20b–20d are then N/A, and marked N/A rather than
silently dropped.

## Every Claim Carries Its Tier

A synthesis sentence resting on tier-C evidence reads identically to one resting on
tier A unless the difference is marked. Mark it.

Per-section, a one-line statement of what the section rests on:

> *Rests on: three studies at tier A (full text), two at tier C (abstract only).
> The tier-C pair supply existence and topic, not findings.*

And per-claim where the mix is uneven:

> "Retrieval latency dominates end-to-end cost in three of the four systems
> measured [@a; @b; @c — all tier A]. A fourth [@d] is reported to agree, but
> only its abstract was retrieved."

The prevalence rule in `provenance.md` governs every sentence here. It is broken most
often in the synthesis, because the synthesis is where the temptation to generalize
lives.

## Structure

```
1. Background and objectives          — items 3, 4
2. Methods                            — items 5–15, summarizing protocol.md
3. Results
   3.1 Study selection                — item 16a, the flow diagram
   3.2 Included study characteristics — item 17, a table
   3.3 Risk of bias                   — item 18, the traffic-light figure
   3.4 Thread 1 …                     — items 20a–20d
   3.5 Thread 2 …
   3.n Certainty of evidence          — item 22
4. Discussion                         — items 23a–23d
   4.1 Interpretation                 — 23a
   4.2 Limitations of the evidence    — 23b
   4.3 Limitations of this review     — 23c, cites conduct-disclosure.md
   4.4 Implications                   — 23d
5. Other information                  — items 24–27
```

The threads are sections 3.4 onward and are the body of the document. If sections 3.1
to 3.3 are longer than the threads, the review has reported its process and forgotten
to answer its question.

## Gaps

A gap is a question the included studies do not answer. It is worth reporting and easy
to overstate.

- **A gap in the included set is not a gap in the field.** The search had bounds. Say
  "no included study addresses X" and name the bound that may explain it.
- **A gap is not an opportunity.** "This represents a promising research direction"
  is an inference the evidence does not carry. Report the absence.
- **Never fill a gap.** A thread with no evidence gets a sentence saying so, not a
  paragraph of plausible reasoning about what the answer probably is.

## The Failure Modes

Checked by `review-critic`, listed here so they can be avoided while drafting:

| Failure | Looks like |
|---|---|
| **Annotated bibliography** | Sections named after papers |
| **Smoothed disagreement** | Every conflict resolved into a moderate middle |
| **Tier laundering** | Tier-C snippets narrated with tier-A confidence |
| **Prevalence creep** | "Most", "the field", "widely" over a bounded set |
| **Gap inflation** | Absence in 22 studies reported as a hole in the discipline |
| **Process bloat** | Methods and flow longer than the findings |
| **Table-as-prose** | A five-study, three-dimension comparison written as paragraphs — see `figures.md` |
