# Agent Memory: Literature Review

A survey of work on memory for LLM agents and the human memory research it draws
on, assembled as background for designing a short-term / long-term memory system.

**Compiled:** 2026-07-30 · **Last revised:** 2026-08-25

## Provenance and confidence

Sources fall into the tiers below. This matters for how much weight to put on any
given claim.

| Tier | Sources | What this means |
|---|---|---|
| **A — read directly** | **CoALA** (pp. 1–4, 7–19 — all of §1 and §4–§8; pp. 5–6, the production-systems background, skipped); **A-Mem — two versions read, all eleven inspected**: v11 (pp. 1–12 plus Appendix A.2/Tables 5–6, A.3 Comparison Results, and A.5/Table 8) and v3 (§§4.4–4.5 prose, Tables 1–2, Appendix B.1/Tables 3–4, Appendix B.2 Comparison Results, and Appendix B.4/Table 5); **the v1–v11 LaTeX sources and figure PDFs** for the version forensics — §2 turns on the difference between them, and the tie-break rests on the appendix metric tables, which are Appendix A.2/Tables 5–6 in v11; **The AI Hippocampus** and the **SoK on agentic skills** (LaTeX sources searched to check specific attributions — not read through) | Text, tables, and figures seen firsthand. |
| **B — machine summary of the source** | *From Storage to Experience* (HTML full text), *The AI Hippocampus* (PDF), *Memory for Autonomous LLM Agents* (**abstract page only** — the full paper was never fetched) | A summarising model read these and returned prose; the underlying text was never inspected. No methodology, tables, or citations verified. Unknown what the summariser dropped. §3 below shows that this tier *does* lose load-bearing detail. |
| **C — search-result snippets** | Every other paper cited: HippoRAG, Generative Agents, MemGPT, MemoryBank, Voyager, all forgetting papers, all safety papers, all benchmarks | Titles, abstract fragments, and search-engine summaries only. Existence verified (see below); content not. Treat as *pointers to follow*, not findings. |
| **D — unverified recall** | §1 (Human memory foundations), in full | Written from model training knowledge. Corroborated since: Atkinson & Shiffrin 1968 and Baddeley & Hitch 1974 (via CoALA's own citations), and Ebbinghaus — though note the correction came *from another tier-D recollection*: Wixted & Ebbesen (1991, 1997) is itself unverified and appears in no source list, so "corroborated" overstates it. Read it as **corrected by a second unverified recollection**, which is weaker than it sounds. **Everything else in §1 is unverified** — Tulving 1972, Tulving & Thomson 1973, Cohen & Squire 1980, McClelland/McNaughton/O'Reilly 1995, Teyler & DiScenna 1986, Bartlett 1932, Bjork's storage/retrieval-strength distinction, Nader 2000, J.R. Anderson's ACT-R, M.C. Anderson/Bjork/Bjork 1994, **Wixted & Ebbesen (1991, 1997)**, and **Squire's later declarative/nondeclarative revision**. That is **twelve** items; an earlier revision listed four, and the list is still not guaranteed exhaustive — the testing-effect/spacing claim in §1.3 is a further tier-D attribution appearing in neither list. Canonical textbook material, so mostly right, but the Ebbinghaus error shows the tier is not decorative. |
| **E — vendor and blog material** | Everything in §5, plus the sleep-time-compute material in §3.5 | Written by the vendor about its own product, or by a third party with no review. Architecture claims are no more independently checked than the benchmark numbers; both are marketing until confirmed elsewhere. |

### Existence check (revised 2026-08-23)

**What this check does and does not do.** It confirms that an arXiv ID resolves to a
paper whose title matches the one cited next to it. It does **not** confirm that a
*name* used in the body is attached to the right ID, and it does not verify a single
claim about contents. The MINJA miscitation corrected in §6 passed this check
cleanly while pointing at the wrong paper — so read the table as a fabrication
screen, not a correctness one.

The first pass on 2026-08-07 checked 11 IDs while claiming to have checked every ID
cited. The document actually cites **24**. All 24 have now been queried against the
arXiv API and **all resolve with matching titles.** No fabricated references —
though the screen is **arXiv-only**: the five DOI-cited works and the plain-URL
sources were never in it.

| ID | Submitted | Title matches |
|---|---|---|
| 2601.05504v2 | 2026-01-09 | ✓ Memory Poisoning Attack and Defense on Memory Based LLM-Agents |
| 2601.09113v1 | 2026-01-14 | ✓ The AI Hippocampus: How Far are We From Human Memory? |
| 2601.18642v2 | 2026-01-26 | ✓ FadeMem: Biologically-Inspired Forgetting for Efficient Agent Memory |
| 2602.20867v1 | 2026-02-24 | ✓ SoK: Agentic Skills — Beyond Tool Use in LLM Agents |
| 2603.07670v1 | 2026-03-08 | ✓ Memory for Autonomous LLM Agents: Mechanisms, Evaluation, and Emerging Frontiers |
| 2604.00131v2 | 2026-03-31 | ✓ Oblivion: Self-Adaptive Agentic Memory Control through Decay-Driven Activation |
| 2604.20300v2 | 2026-04-22 | ✓ FSFM: A Biologically-Inspired Framework for Selective Forgetting of Agent Memory |
| 2605.06716v1 | 2026-05-07 | ✓ From Storage to Experience: A Survey on the Evolution of LLM Agent Memory Mechanisms |
| 2605.20616v1 | 2026-05-20 | ✓ Auto-Dreamer: Learning Offline Memory Consolidation for Language Agents |
| 2607.08032v1 | 2026-07-09 | ✓ What to Keep, What to Forget: A Rate–Distortion View of Memory Compaction in LLMs and Agents |
| 2502.06975v1 | 2025-02-10 | ✓ Position: Episodic Memory is the Missing Piece for Long-Term LLM Agents |

Added 2026-08-23 — the thirteen IDs the first pass missed:

| ID | Submitted | Title matches |
|---|---|---|
| 2210.03629 | 2022-10-06 | ✓ ReAct: Synergizing Reasoning and Acting in Language Models |
| 2303.11366 | 2023-03-20 | ✓ Reflexion: Language Agents with Verbal Reinforcement Learning |
| 2305.10250 | 2023-05-17 | ✓ MemoryBank: Enhancing Large Language Models with Long-Term Memory |
| 2305.16291 | 2023-05-25 | ✓ Voyager: An Open-Ended Embodied Agent with Large Language Models |
| 2309.02427 | 2023-09-05 | ✓ Cognitive Architectures for Language Agents |
| 2310.08560 | 2023-10-12 | ✓ MemGPT: Towards LLMs as Operating Systems |
| 2402.17753 | 2024-02-27 | ✓ Evaluating Very Long-Term Conversational Memory of LLM Agents |
| 2406.13144 | 2024-06-19 | ✓ DialSim: A Dialogue Simulator for Evaluating Long-Term Multi-Party Dialogue Understanding of Conversational Agents |
| 2502.12110 | 2025-02-17 | ✓ A-MEM: Agentic Memory for LLM Agents |
| 2503.03704 | 2025-03-05 | ✓ Memory Injection Attacks on LLM Agents via Query-Only Interaction |
| 2603.11768 | 2026-03-12 | ✓ Governing Evolving Memory in LLM Agents: Risks, Mechanisms, and the Stability and Safety Governed Memory (SSGM) Framework |
| 2605.23723 | 2026-05-22 | ✓ MemAudit: Post-hoc Auditing of Poisoned Agent Memory via Causal Attribution and Structural Anomaly Detection |
| 2607.06595 | 2026-07-06 | ✓ When Agents Remember Too Much: Memory Poisoning Attacks on Large Language Model Agents |

This confirms the papers exist and are titled as cited. It does **not** verify any
claim about their *contents* — those still rest on tier-C snippets.

**Caveat on recency — corrected.** An earlier revision said most papers here
postdate the compiling model's May 2026 cutoff. That is wrong and pointed at the
wrong risk: **19 of the 24 predate it**, and only the two 2607 papers clearly follow
it (the three 2605 papers sit on the boundary).

The real hazard is therefore the opposite of the one first stated. For pre-cutoff
papers the model *can* recall content — and confident recall attaching itself to
the wrong citation is exactly what produced the MINJA error. Post-cutoff papers are
safer in this one respect, because there is nothing to recall and the document is
forced to say so.

Benchmark numbers from vendor and blog sources are flagged inline where used.

**A standing caveat on prevalence claims.** §7 states the rule that consensus claims,
convergence claims and universal negatives are what a snippet-level survey cannot
support, and §§5 and 7.4 had theirs retracted for breaking it. The rest of the
document still contains
the same construction in smaller doses — "nearly every AI memory paper," "the single
most-cited distinction," "most decay-based agent memory systems," "the most-copied single
design," "the cleanest neuro-to-AI mapping," "consistently underused." The same
construction also survives at "the most-copied design in the field" in
§3.1 and §7.1 (§8 has "the most-copied *concrete* design"), "the one most often lost
in secondary summaries" in §3.1, and "the careful implementations" in §3.5. **Read
every one of these as "in the sources
visible here," not as a claim about the field.** The list is **not exhaustive** —
"the most theoretically load-bearing import into AI memory" in §1.2 and "both are
widely used" in §4 are two more, the latter introduced by the very fix that was
correcting a prevalence claim.
They are left in place because rewriting each into a hedge would cost more in
readability than it buys in accuracy, but the tier that governs them is C, and none
was measured.

---

## Contents

1. [Human memory foundations](#1-human-memory-foundations)
2. [The LLM agent memory lineage](#2-the-llm-agent-memory-lineage)
3. [Bridge work: cognitive theory applied to agents](#3-bridge-work)
4. [Evaluation and benchmarks](#4-evaluation-and-benchmarks)
5. [Production systems](#5-production-systems)
6. [Failure modes and safety](#6-failure-modes-and-safety)
7. [Design implications](#7-design-implications)
8. [Reading order](#8-reading-order)
9. [Full source list](#9-full-source-list)

---

## 1. Human memory foundations

Nearly every AI memory paper cites the same small set of theories. The borrowings
are often shallow, so knowing the originals tells you what was dropped on the way
across.

### 1.1 Structural models

| Theory | Core claim | What AI borrowed |
|---|---|---|
| **Atkinson & Shiffrin (1968)** — multi-store | Sensory register → short-term store → long-term store | The literal STM/LTM box diagram in most agent architectures |
| **Baddeley & Hitch (1974)**, + episodic buffer (2000) | Working memory is an *active control system*: central executive + phonological loop + visuospatial sketchpad + episodic buffer | Usually flattened to "context window = working memory" — though **CoALA explicitly does not make this mistake**; see §3.1 |
| **Tulving (1972)** | Episodic (events, situated in time and place) vs. semantic (facts, detached from acquisition) | The single most-cited distinction in the field |
| **Cohen & Squire (1980)** | Declarative vs. procedural; Squire later replaced this with declarative vs. **nondeclarative**, of which procedural is one subtype among several | Procedural handled separately and worst — see skill libraries. The field generally borrows the superseded 1980 cut, not the revision |

The important thing lost in the Baddeley borrowing: working memory is a *control
structure*, not a buffer. What it holds is what is being actively manipulated —
not simply what arrived most recently. Recency-based context management is a
weaker idea than the theory it claims to implement.

### 1.2 Dynamics

**Complementary Learning Systems** — McClelland, McNaughton & O'Reilly (1995).
The most theoretically load-bearing import into AI memory. The brain runs two
qualitatively different systems:

- a **fast-binding hippocampus** that learns from single exposure, sparse and
  pattern-separated;
- a **slow-consolidating neocortex** that gradually extracts latent structure
  across many episodes.

They exchange information via **replay during offline periods**. Critically, the
*reason* for two systems is catastrophic interference: fast learning in a
distributed network destroys existing knowledge. This is the direct justification
for episodic → semantic consolidation architectures.

**Hippocampal indexing** — Teyler & DiScenna (1986). The hippocampus stores
*pointers* to distributed neocortical traces rather than the traces themselves.
Operationalised almost literally by HippoRAG.

**Forgetting curve** — Ebbinghaus (1885). Retention decays as a **power function**
of time, not an exponential one — Wixted & Ebbesen (1991, 1997) fit the power form
to Ebbinghaus's own data and showed the result survives the averaging objection at
the individual-subject level. An earlier revision of this document said
"exponentially," which is the common shorthand and is wrong.

This is not pedantry. The two forms diverge most in the **long tail**, which is
exactly where a long-running agent memory operates: an exponential schedule discards
old-but-durable memories far faster than the human data justifies. Most decay-based
agent memory systems invoke this curve, and those assuming an exponential —
FadeMem's "adaptive exponential decay" among them — are using a convenience
approximation, not the finding. Several do not invoke it at all: Generative Agents
simply sets an exponential recency decay of 0.995 with no citation, which makes the
point more sharply than the ones that cite Ebbinghaus and then discretise him.

**New theory of disuse** — Bjork. Separates **storage strength** from **retrieval
strength**. Forgetting is loss of *accessibility*, not erasure. This distinction
is usually flattened in implementations, and flattening it is a design error: it
is the difference between decaying a score and deleting a row.

**Reconstructive memory** — Bartlett (1932). Memory is rebuilt at retrieval time,
shaped by schemas, not played back. Consistently underused in AI work.

**Reconsolidation** — Nader, Schafe & LeDoux (2000). Retrieving a *consolidated fear
memory* renders it labile: in the rat amygdala, blocking protein synthesis after
reactivation abolished the conditioned fear response at test. Whether that is
erasure or induced retrieval failure is itself unsettled — the same
storage-versus-accessibility distinction insisted on in the Bjork entry above
applies here, and an earlier revision of this document said "erased" as though it
were established. The generalisation to memory at large is widely drawn and
still contested — the original result is narrower than the principle usually
attributed to it. Read as the biological analogue of A-Mem's "memory evolution,"
with that caveat attached.

**ACT-R** — J. R. Anderson. Activation-based declarative memory with base-level decay
and spreading activation. Supplies a concrete, implementable formula for "how
retrievable is this right now," which several agent systems copy directly.

### 1.3 Retrieval

- **Encoding specificity** (Tulving & Thomson, 1973) — retrieval succeeds when cues
  overlap the encoding context. The argument for storing context alongside content,
  which is exactly what A-Mem's contextual descriptions do.
- **Retrieval-induced forgetting** (M. C. Anderson, Bjork & Bjork, 1994 — no relation
  to J. R. Anderson of ACT-R above) — retrieving some
  items actively *suppresses* related competitors. No agent system encountered here
  has an analogue for this *(tier C — a snippet-level survey cannot support a
  stronger claim)*, and it may be part of why naive top-*k* retrieval degrades with
  larger *k* — though see §6, which supports the weaker claim that more context stops
  paying rather than that it degrades — four of A-Mem's five task categories peak
  below the largest *k* tested, with only one rising monotonically across the whole
  sweep, and *k*=50 still beats *k*=10 in all five.
- **Testing effect / spacing** — retrieval practice strengthens retention more than
  restudy. Relevant to any design that reinforces memories on access.

---

## 2. The LLM agent memory lineage

The clearest organising frame is the three-stage evolution from
[*From Storage to Experience*](https://arxiv.org/html/2605.06716v1).

### Stage 1 — Storage (2023–2024)

Faithfully record trajectories; retrieve by similarity. Sub-families: **linear**
(FIFO token streams), **vector** (embedding stores), **structured** (knowledge
graphs, hierarchies).

- **MemGPT** (Packer et al., 2023) — the OS metaphor. Virtual context with paging
  between an in-context "main memory" and external storage, with the LLM issuing
  its own paging calls. Became **Letta**.
- **Generative Agents** (Park et al., 2023) — the memory stream. Retrieval scored as
  a weighted **sum** of recency, importance and relevance (often written
  "recency × importance × relevance," which describes the wrong operation). Adds
  **reflection**:
  periodic synthesis of observations into higher-level inferences, written back into
  the stream as retrievable nodes. Reflection fires on an accumulated-importance
  threshold, not a fixed schedule. Still the most-copied single design in the field.
- **MemoryBank** (Zhong et al., AAAI 2024) — explicitly implements an
  Ebbinghaus-style forgetting curve.

### Stage 2 — Reflection (2024–2025)

Actively evaluate and refine what is stored. Three pathways: **introspection**
(self-critique without external feedback, e.g.
[Reflexion](https://arxiv.org/abs/2303.11366) — which, like Voyager below, predates
the stage it is filed under, being from March 2023), **environmental**
(grounding corrections in outcomes), **coordination** (multi-agent consensus).

- **A-Mem** (Xu et al., 2025) — Zettelkasten-inspired. LLM-generated notes with
  keywords/tags/contextual descriptions, LLM-decided linking over an embedding
  prefilter, and *memory evolution* that rewrites existing notes when new ones
  arrive. Ablation (GPT-4o-mini): removing linking and evolution drops F1 from 27.02
  to 9.65; restoring linking alone recovers to 21.35. Across all five task categories
  link generation recovers **67 / 31 / 54 / 83 / 83%** of the gap, so
  **linking is the load-bearing mechanism and evolution is a refinement on top**, not
  the reverse. The paper says the same in words — link generation is "a critical
  foundation," memory evolution "provides essential refinements" — in its ablation
  section, which is **§4.4 in v11 and §4.5 in v3** (the quotes are identical in both).

  ⚠ **Do not name a task category for these numbers. A-Mem relabelled its columns
  between versions without changing a value.**

  | Column | v3 (its Table 2) | v11 (its Table 3) |
  |---|---|---|
  | 27.02 / 9.65 / 21.35 | Single Hop | Multi Hop |
  | 45.85 / 24.55 / 31.24 | Multi Hop | Temporal |

  The **first four** labels rotate one position left between v3 and v11 — *Adversial*
  (the paper's own spelling) stays in position five. The data is
  byte-identical, and each version is internally consistent with its own **Table 1**.

  **The paper's own appendix prose breaks the tie, and it favours v3.** This sentence
  is identical in both versions: A-Mem "achieves a ROUGE-L score of **44.27 in
  Multi-Hop tasks**, more than doubling LoComo's 18.09 … with METEOR scores of
  **23.43** versus 7.61 and SBERT scores of **70.49** versus 52.30." Those values sit
  in **column position two** of the appendix metric tables in *both* versions — which
  v3 heads *Multi Hop* and v11 heads *Temporal*. So **v11 contradicts its own prose
  across three further metrics, and v3 agrees with it.** That is the strongest
  evidence available and it is still not conclusive: the authors may have been
  *fixing* an original mislabelling in v11 and failed to update the prose. Anyone
  relying on a category name here should assume v3's assignment.

  **v11 contradicts itself inside its own body, and that needs no version
  archaeology.** Its §4.1 *enumeration sentence* — byte-identical across all eleven
  versions — lists the categories as "(1) single-hop … (2) multi-hop … (3)
  temporal reasoning … (4) open-domain knowledge … and (5) adversarial questions."
  On the next page v11's Table 1 heads its columns *Multi Hop, Temporal, Open Domain,
  Single Hop, Adversial*. **The prose enumeration and the table headers disagree
  within the same document**, and the enumeration matches v3. LoCoMo's own paper uses
  that order too.

  **A second tell comes from the version history.** The category ordering is *stable
  from v1 through v10* — all ten declare
  "Single Hop, Multi Hop, Temporal, Open Domain, and Adversial" — and **v11 is the
  single version that rotates it**.

  The subfigure labels first appear in **v8**, which pairs them to captions
  correctly — as do v9 and v10:
  `Single Hop` → `fig:singlehop`, `Multi Hop` → `fig:multihop`, and so on. In v11 the
  captions rotate to *Multi Hop / Temporal / Open Domain / Single Hop* while the
  labels stay put — so `fig:singlehop` now sits under a panel captioned *Multi Hop*.
  **The labels are a fossil of the pre-v11 ordering**, authored to match captions that
  v11 changed and left behind. All five figure PDFs are byte-identical between v3 and
  v11, so no underlying data moved.

  *(Two earlier revisions misdated this. One said "the captions were edited and the
  labels were not" of the v3→v11 pair — wrong, since v3 uses the old `\subfigure`
  idiom and has no subfigure labels at all. The next dated the fossil to v10 — also
  wrong; labels are absent in v1–v7 and present from v8. That correction took the
  count of correctly-paired versions from one to three; the ten-version ordering
  evidence is independent of it.)*

  The main-table prose points the same way. That claim sentence is unchanged in
  wording between versions (it differs only in using the `\ours` macro where v3 has a
  literal name) while the paragraph around it is not — v11 keeps v3's architecture
  discussion verbatim but inserts a DialSim comparison ahead of it, adds
  *Performance Analysis* and *Cost-Efficiency Analysis* run-in heads, and replaces
  v3's closing token-length paragraph. That claim sentence is scoped to GPT models:
  multi-hop performance "at least two times better." Under **v3's** labels it holds
  for **GPT-4o only**: 39.41 vs
  MemGPT's 17.29, its strongest baseline in that cell, is 2.3×. For GPT-4o-mini it
  does **not** hold — 45.85 against MemGPT's 25.52, the strongest baseline there, is
  1.80×. (Against LoCoMo's 18.41 it reaches 2.5×, but LoCoMo is not the strongest
  baseline in that cell, and choosing it would be picking the comparator that
  flatters the argument.) Under **v11's** labels it fails everywhere — GPT-4o-mini's
  Multi Hop is 27.02 against MemGPT's 26.65, a 1.4% gain.

  *(Two earlier revisions erred here in opposite directions: one cited 45.85 vs
  25.52 as a case where the claim holds — it is 1.80× — and the next replaced 25.52
  with LoCoMo's weaker 18.41 to clear 2×, which was cherry-picking. The evidence for
  v3 is weaker than either revision claimed.)*

  v3 also puts Single Hop before Multi Hop, which is the order LoCoMo's own paper
  uses. Against that, v11's assignment makes Single Hop outscore Multi Hop, the more
  natural difficulty ordering — the one argument still favouring v11. It comes at a
  price, though: the same assignment also makes Open Domain the *worst* category
  (12.14) and Temporal the *second-best* (45.85), both implausible, and both resolved
  under v3's labels.

  **A third tell, from the ablation prose itself.** The ablation section — §4.4 in v11,
  §4.5 in v3 — says removing both modules degrades performance "particularly in Multi
  Hop reasoning and **Open Domain** tasks," a sentence byte-identical in both. Under
  **v3's** labels Open Domain falls
  44.65 → 13.28, a **70% drop — the largest of the five**, which is exactly what
  "particularly" should mean. Under **v11's** labels Open Domain falls 12.14 → 7.77, a
  **36% drop — the smallest of the five**. v11's assignment makes the paper's own
  ablation prose false. *(The Multi Hop half of that sentence is less decisive: rank
  4 of 5 under v3, rank 3 under v11.)*

  This matters because the 67% figure above is the *first* column, and under v3's
  labelling the column named "Multi Hop" is the one case where evolution dominates
  instead (31%). The conclusion survives on the cross-column pattern and on the
  ablation prose (§4.4 in v11, §4.5 in v3); **a version-specific, category-specific
  claim does not.** An earlier revision
  of this document asserted the Multi Hop reading as re-verified fact. It was reading
  v11 and did not know v3 existed.
- **HippoRAG** (Gutiérrez et al., NeurIPS 2024) — the cleanest neuro-to-AI mapping in
  the literature. LLM as neocortex, knowledge graph as hippocampal index,
  Personalized PageRank as pattern completion. Reports up to 20% over prior SOTA on
  multi-hop.

### Stage 3 — Experience (H2 2025 onward)

Abstract reusable *strategy* from clustered interactions, not just facts. Splits
into **explicit** (human-readable policies), **implicit** (parameter
internalisation via fine-tuning), and **hybrid**.

This is where **procedural memory** lives.
[**Voyager**](https://arxiv.org/abs/2305.16291) (Wang et al., 2023) — building an
executable skill library through curriculum-driven exploration in Minecraft — is the
landmark. Note that it *predates* this stage by two years: the three-stage frame comes
from a tier-B summary, and Voyager is better read as the precursor that defined the
category than as a member of a period beginning in H2 2025. For the 2026 state of the
area see the [SoK on agentic skills](https://arxiv.org/html/2602.20867v1), which
organises it into system-level design patterns.

⚠ **Four names deleted here.** An earlier revision listed SkillOS, Skill-Pro,
CODESKILL and EmbodiSkill as "2026 descendants named in the SoK." They are not in
the SoK — checked against its full LaTeX source and bibliography: *SkillOS* 0
occurrences, *CODESKILL* 0, *EmbodiSkill* 0, *Skill-Pro* 1 and that one is the
substring inside "skill-provided metadata"; the control term *Voyager* returns 27.
The names came from a snippet search and could not be located anywhere. Same class
of defect as the §3.2 gap list.

### An alternative cut

[*Memory for Autonomous LLM Agents*](https://arxiv.org/abs/2603.07670) organises
the same territory differently — a **three-dimensional taxonomy** (temporal scope
× representational substrate × control policy) over a **write–manage–read loop**,
with five mechanism families:

1. Context-resident compression
2. Retrieval-augmented stores
3. Reflective self-improvement
4. Hierarchical virtual context
5. Policy-learned management

---

## 3. Bridge work

The subliterature that explicitly connects the two fields — most directly relevant
to a from-scratch design.

### 3.1 CoALA — Cognitive Architectures for Language Agents

[arXiv 2309.02427](https://arxiv.org/abs/2309.02427) — Sumers, Yao, Narasimhan &
Griffiths (Princeton). Published in **TMLR 02/2024**; v3 dated 15 Mar 2024.
**The framing paper**, and one of the two sources in this document read directly
at length — the other is A-Mem (§2).

CoALA organises agents along three dimensions: **information storage** (working +
long-term memories), **action space** (internal + external), and **decision-making
procedure** (an interactive loop of planning and execution).

#### Memory modules

**Working memory is not the context window.** This is the paper's most useful
single idea and the one most often lost in secondary summaries. CoALA is explicit:

> "CoALA's notion of working memory is more general: it is a data structure that
> persists across LLM calls. On each LLM call, the LLM input is synthesized from a
> subset of working memory (e.g., a prompt template and relevant variables). The
> LLM output is then parsed back into other variables (e.g., an action name and
> arguments) which are stored back in working memory and used to execute the
> corresponding action."

So working memory is the **persistent central hub** connecting long-term memory,
the LLM, and grounding interfaces. The context window is a *rendering* of a subset
of it, per call — not the thing itself. Any design that treats "what's in context"
as the working memory has collapsed the architecture's hub into one of its views.

**Long-term memory** splits three ways:

- **Episodic** — experience from earlier decision cycles: training input-output
  pairs, history event flows, game trajectories. Retrieved into working memory to
  support reasoning; written to as a form of learning.
- **Semantic** — knowledge about the world and the agent itself. Traditional RAG
  is a *fixed, read-only* semantic memory; language agents can additionally write
  LLM-derived inferences into it.
- **Procedural** — two distinct forms: **implicit** knowledge in the LLM weights,
  and **explicit** knowledge in the agent's code. The code divides again into
  procedures implementing *actions* and procedures implementing the *decision-making
  itself*.

Three procedural-memory points worth carrying into any design:

1. Procedural memory **must be initialised by the designer** with bootstrap code —
   unlike episodic and semantic, which may start empty or absent.
2. Writing to it is **"significantly riskier than writing to episodic or semantic
   memory, as it can easily introduce bugs or allow an agent to subvert its
   designers' intentions."**
3. CoALA advises using code **sparingly**, for generic algorithms that complement
   LLM limitations (e.g. tree search to mitigate autoregressive myopia), because
   agent code is interpretable but brittle while LLM parameters are opaque but
   flexible.

#### Action space

External actions ground the agent (physical, dialogue, digital environments).
Internal actions are three:

- **Retrieval** — read from long-term memory into working memory
- **Reasoning** — reads *and writes* working memory, generating new information
- **Learning** — write to long-term memory

Reasoning and retrieval together constitute **planning**; learning and grounding
are the actions a decision cycle actually commits to.

#### The decision cycle

Each cycle runs a **planning stage** — propose → evaluate → select — and then an
**execution stage** that commits either a grounding action or a learning action.
Planning sub-stages may interleave and iterate.

#### Gaps CoALA named in 2024 that the 2026 literature is now answering

These are worth noting because they show the recent work is filling holes an
authoritative source identified two years earlier, which is weak corroboration
that those holes were real:

- **"While our discussion has mostly focused on adding to memory, modifying and
  deleting (a case of 'unlearning') are understudied in recent language agents."**
  → the 2026 forgetting cluster (FadeMem, Oblivion, FSFM).
- **"Adaptive and context-specific recall remains understudied in language
  agents."** → learned, policy-based retrieval.
- Learning options for **updating retrieval procedures** are "not studied in recent
  language agents."
- On safety: **"Learning actions (especially procedural deletion and modification)
  could cause internal harm"** — a pre-echo of the memory-poisoning literature.

#### The design recipe (§6)

CoALA gives an explicit three-step procedure for designing a new agent, which is
directly usable:

1. **Determine what memory modules are necessary.** (Its worked example: a retail
   assistant needs semantic memory for the catalogue, episodic for each customer's
   history, procedural to query them, working memory for dialogue state.)
2. **Define the internal action space** — specifically, read and write access *per
   module*. In the example: read/write to episodic, but **read-only to semantic and
   procedural**, so the agent cannot rewrite the inventory or its own code.
3. **Define the decision-making procedure** — how reasoning and retrieval choose an
   external or learning action. Explicit tradeoff: complex procedures fit a problem
   better (Voyager for Minecraft), simpler ones generalise
   ([ReAct](https://arxiv.org/abs/2210.03629)).

CoALA also names a simplification that matters for the consolidation design:
**learning can be deferred to the end of an interaction**, summarising the episode
before storing it — citing Reflexion and Generative Agents. That is the "consolidate
at session end" pattern, stated as a deliberate decision-procedure simplification
rather than an architectural necessity.

#### Where CoALA and the search-snippet account of Generative Agents differ

CoALA §5 states Generative Agents "use retrieval and reasoning to generate
reflections on their episodic memory … which are then written to long-term
**semantic** memory." The search-snippet account in §2 says reflections are stored
back into the **stream** as retrievable nodes. These may be reconcilable
(CoALA is recasting Park et al. into its own taxonomy), and that is in fact what
appears to be happening: reflections in Generative Agents are written back into the
**memory stream** as new memory objects alongside observations and plans, and can
themselves be reflected upon. **On the mechanism, §2 appears correct**: reflections
are stored as memory objects in the stream, with pointers to the memories they cite,
and are retrieved alongside observations.

⚠ **Note what is happening epistemically here.** This ruling goes against CoALA — a
tier-A source read directly — on the strength of Generative Agents, which this
document classifies as **tier C** and still lists as unread in §8. The account is
consistent across every secondary source checked and I believe it, but the document
has no first-hand basis for overruling a tier-A reading, and saying so is the point
of having tiers. Read Park et al. before treating this as settled.

**But CoALA is not merely relabelling, and an earlier revision of this document
overcorrected by saying so.** CoALA describes reflections as written to *semantic*
memory and retrieved *from semantic memory* — two stores with separate retrieval
paths. Park implements one undifferentiated stream retrieved as a whole. That is a
design difference a builder would implement differently, not a vocabulary
difference, and it bears on §7.1: the most-copied design in the field does not
itself separate the stores that §7.1 recommends separating.

### 3.2 The AI Hippocampus

[arXiv 2601.09113](https://arxiv.org/pdf/2601.09113) — a **taxonomy survey**
organising the literature into three memory paradigms — implicit, explicit and
agentic — with multimodal memory treated as an extension rather than a fourth. "How
Far are We From Human Memory?" is its subtitle, not its method.

⚠ **A four-item "gap list" attributed to this paper here has been deleted.** It
claimed the paper named: consolidation comparable to sleep-dependent processing,
interference resolution, metacognitive awareness of memory reliability (confidence
and source monitoring), and temporal reasoning about when a memory applies. **None of
that is in the paper.** Checked against the full LaTeX source (24 files, 5,093
lines): *sleep* 0 occurrences, *metacogniti\** 0, *source monitoring* 0,
*interference* 1 — and that one describes representational collisions under finite
parametric capacity ("two distinct input-output relations … mapped to the same
location"), not the agent-level interference-resolution gap the deleted list
claimed.

The paper's own limitations and future-work sections name a different set:
Transformer-internal implicit memory, long-context versus RAG trade-offs, dynamic
memory adaptation through recursive retrieval and experience reflection, multimodal
challenges, no unified evaluation framework, and no single integrating platform.

**This was the document's worst defect and it survived four adversarial rounds.**
Unlike the MINJA error — a real claim pointed at the wrong paper — this was content
that does not exist in the cited source at all. The tier-B label does not cover it:
that label warns a summariser may have *dropped* detail, not that material was
invented or transplanted from elsewhere. Anything below sourced to this paper should
be treated as unsupported until re-read.

### 3.3 Other bridge work

- **[Episodic Memory is the Missing Piece](https://arxiv.org/pdf/2502.06975)** —
  position paper arguing the field over-invests in semantic fact stores and
  under-invests in event memory with real temporal structure.
- **[ACT-R-inspired memory architecture](https://dl.acm.org/doi/10.1145/3765766.3765803)**
  (HAI 2025) — ports ACT-R activation equations directly into an LLM agent.
- **[Dynamic Human-like Memory Recall and Consolidation](https://dl.acm.org/doi/10.1145/3613905.3650839)**
  (CHI EA) — user-facing evaluation of human-like memory behaviour.

### 3.4 Forgetting as a first-class mechanism

A visible 2026 research cluster. Common taxonomy: **time-based**,
**frequency-based**, **importance-driven** forgetting.

- **[FadeMem](https://arxiv.org/pdf/2601.18642)** — differential decay rates across a
  dual-layer hierarchy; adaptive exponential decay modulated by semantic relevance,
  access frequency, and temporal pattern.
- **[Oblivion](https://arxiv.org/html/2604.00131)** — decay-driven activation control.
- **[FSFM](https://arxiv.org/pdf/2604.20300)** — selective forgetting framework.
- **[What to Keep, What to Forget](https://arxiv.org/pdf/2607.08032)** — rate–distortion
  treatment of memory compaction. Useful because it gives forgetting a principled
  objective rather than a heuristic.

### 3.5 Offline consolidation ("sleep")

- **[Sleep-time compute](https://www.letta.com/blog/sleep-time-compute/)** (Letta) —
  reframes idle-time memory work as **offline policy improvement**: improve
  representations using already-collected data, without new environment interaction.
- **[Auto-Dreamer](https://arxiv.org/html/2605.20616)** — *learns* the consolidation
  policy rather than hand-coding it.

Design note worth stealing: the careful implementations emit consolidation output
into a **separate candidate store**, leaving the original intact so the result can
be reviewed, discarded, or rolled back.

---

## 4. Evaluation and benchmarks

| Benchmark | Shape | Tests |
|---|---|---|
| **LoCoMo** (Maharana et al., 2024) | **Public `locomo10` release**: 10 conversations, ~27 sessions each, ~16.6K tokens. *The paper itself reports 50 conversations, 19.3 sessions, 9,209 tokens; **the release figures above, not those published statistics, are what the LoCoMo evaluations surveyed here run on.*** | Single-hop, multi-hop, temporal, open-domain, adversarial |
| **LongMemEval** | 500 curated questions; 115K → 1.5M token settings | Information extraction, multi-session reasoning, temporal reasoning, **knowledge updates**, **abstention** |
| **DialSim** | Real-time multi-party dialogue (TV shows), ~1,300 sessions | Long-term multi-party QA |
| **MemoryAgentBench / MemGym / WorldLines / MemoryArena** ⚠ *uncited* | Agentic, multi-session | Memory interleaved with decision-making |

Two things to note:

1. **LongMemEval's knowledge-update and abstention categories are the most
   design-relevant.** They are the most *explicit* tests of "this fact changed" and
   "you should say you don't know." **For abstention they are not the only
   ones, as an earlier revision claimed.** A-Mem (tier A) describes
   LoCoMo's fifth category as "adversarial questions assessing models' ability to
   identify unanswerable queries," and DialSim's abstract scores agents on
   "recognizing when they lack sufficient information." Both are widely used; A-Mem
   benchmarks on LoCoMo throughout §2 of this document. *(The knowledge-update half
   of the claim stands — nothing cited here tests "this fact changed" except
   LongMemEval.)* *(An earlier revision claimed these were
   "precisely the two gaps the AI Hippocampus paper names." That paper names neither
   — see §3.2. The categories' design relevance stands on its own; the corroboration
   was fabricated.)*
2. **The field is moving from static recall to agentic evaluation.** The
   Mechanisms & Frontiers survey flags this shift explicitly, and reports that the
   newer benchmarks expose gaps the recall benchmarks miss.

**Caution:** LoCoMo scores are widely described as near-saturated and contested
across reimplementations — *uncited, and note this concerns LLM-judge accuracy
rather than the F1 values quoted in §2, which run from 7.77 to 45.85*. Do not select
an architecture on LoCoMo deltas alone.

---

## 5. Production systems

**This entire section is tier E** — see the provenance table. Its sources are one
Medium comparison post and the vendors' own blogs. An earlier revision said "architecture
descriptions below are reliable; treat any specific percentage as marketing," which
is an arbitrary split: a vendor is no better independently checked about its own
architecture than about its own benchmark numbers. Treat the whole table as an
orientation sketch of what these products *claim*, not as a comparison. Reported
benchmark numbers also **conflict substantially between sources**.

| System | Approach | Distinguishing idea |
|---|---|---|
| **Letta** (ex-MemGPT) | Explicit memory-block API, self-editing context | Sleep-time compute; agent manages its own memory via tools |
| **Mem0** | Fact extraction → vector store | Lightweight, low token cost |
| **Zep / Graphiti** | Temporal knowledge graph | **Bi-temporal modelling** — tracks both when a fact was true and when the system learned it |
| **LangMem** | LangChain-native SDK | Framework integration |

**Zep's bi-temporal modelling is the most interesting idea in this tier**, and it
maps onto something the literature treats as a live engineering concern — *Memory
for Autonomous LLM Agents* ([2603.07670](https://arxiv.org/abs/2603.07670)) lists
**contradiction handling** among the "engineering realities" its abstract says it
addresses. Note it is *not* in that abstract's own list of open challenges
(continual consolidation, causally grounded retrieval, trustworthy reflection,
learned forgetting, multimodal embodied memory), so this supports the topic being
live, not its being an acknowledged gap. *(An earlier revision sourced this to the
AI Hippocampus gap list,
which was fabricated and is retracted in §3.2; the replacement citation is
abstract-level, tier B.)* An earlier revision called it
"the only principled answer" to superseded facts among mainstream options — a
universal negative over the production landscape, drawn from one blog post, and
retracted in §7.4 while surviving here. What can honestly be said: **I found no
counterexample in a snippet-level search**, which is not the same as there being
none.

---

## 6. Failure modes and safety

Worth reading *before* designing, not after.

### Memory poisoning

Injecting false or malicious content into persistent memory. Structurally worse
than prompt injection because it **persists across sessions** and the agent trusts
its own memories implicitly.

The core defensive problem: **poisoning separates injection from execution.** The
write looks like a normal interaction; the malicious action weeks later looks like
normal operation. Nothing is anomalous at any single point in time.

- **[MINJA](https://arxiv.org/abs/2503.03704)** (Dong et al., 2025) — memory injection
  via ordinary queries and output observations only; the attacker never touches the
  memory bank directly. Reported at **over 95% injection success and 70% attack success
  — "under idealized conditions."** That qualifier is load-bearing and is not
  MINJA's own: it comes from the follow-up below, which exists to test how far the
  attack survives realistic deployment.
- **[Memory Poisoning Attack and Defense](https://arxiv.org/abs/2601.05504)**
  (Devarangadi Sunil et al., 2026) — a **different paper**, and the source of the
  qualifier above. It quotes MINJA's rates in its own abstract, then varies initial
  memory state, indication-prompt count, and retrieval parameters against EHR agents
  to find where the attack degrades, and proposes defences.

  **Its actual finding cuts against MINJA:** "realistic conditions with pre-existing
  legitimate memories **dramatically reduce attack effectiveness**." So the headline
  rates describe a near-empty memory bank, not a deployed agent — which is the single
  most decision-relevant fact in this subsection for anyone sizing the threat.

  Two earlier corrections converge here, and neither got it right. One cited *this*
  paper's URL under the name MINJA. The next deleted the >95/>70 figures as
  unverifiable — they were correct and are quoted in this paper's abstract — and
  then called MINJA "replicated and qualified." **Cited and qualified** is accurate;
  nothing here reproduces >95/>70 independently, and this paper reports the opposite
  under realistic conditions.
- **MemoryGraft** — implants malicious *successful experiences* into long-term memory.
  ⚠ **Uncited:** the name comes from model recall and no source was located.
  Treat as a lead to chase, not a reference.
- **[When Agents Remember Too Much](https://arxiv.org/pdf/2607.06595)** — survey of the
  attack surface.

### Decision drift

Gradual behavioural shift from accumulated corrupted information, with no
threshold event to alarm on. The agent moves from safe to unsafe operation without
any single detectable transition.

### Defences

- **[MemAudit](https://arxiv.org/pdf/2605.23723)** — post-hoc causal attribution: which
  stored memory caused this output?
- **[SSGM](https://arxiv.org/pdf/2603.11768)** — stability and safety governance
  framework for evolving memory.

### Over-retrieval sometimes degrades performance — and that is not store size

A-Mem's *k*-sweep is messier than a plateau-then-decline story. Reading the five
panels of its Figure 3 (v11 numbering) directly:

- **Three categories peak at *k* = 40 and fall at 50** — but two of those plateau by
  *k* ≈ 30 and the third jumps 14% between 30 and 40, so there is no single plateau
  point.
- **One rises monotonically across the whole sweep** and is still climbing at 50.
- **One is non-monotonic**, with its best value at *k* = 30 and a lower value at 50
  than at 30.

So "more retrieved context is not monotonically better" holds in **four of five** —
only the monotone series is a counterexample — and
nothing above 50 was tested — "declining" rests on one endpoint per series. Earlier
revisions of this section stated the decline flatly, then over-corrected to "two are
still improving," which is true of only one.

⚠ **And A-Mem does not operate at *k* = 10.** An earlier revision of this document
claimed it did, citing §4.2. That section says the paper "primarily employ[s]
*k*=10 … **while adjusting this parameter for specific categories**," and the
adjustments are in Appendix A.5, Table 8. For **both GPT models**, which between them produce
every A-Mem benchmark score in this document, *k* is **40 / 40 / 50 / 50 / 40** across
the five categories. *k* = 10 is the default only for the smaller local models. The
paper operates *at* the plateau, not away from it, which inverts the point the
earlier revision was making.

**Scope this claim carefully.** A *k*-sweep varies how many items are pulled into the
prompt, not how many are held in the store. A million-item store queried at *k* = 10
is untouched by this evidence. An earlier revision headed this section "unbounded
memory degrades performance," silently converting a retrieval-breadth finding into a
store-size one, and §7.3 inherited the conflation.

**Whether a large store degrades answer quality at fixed *k* is untested by anything
cited here.** A-Mem's scaling analysis measures *latency*, not quality — retrieval
time grows only 0.31µs → 3.70µs from 1K to 1M memories, which says nothing about
whether the right memory is still being found. An earlier revision offered that
figure as though it answered the quality question; it does not, and treating
latency as a proxy for quality reproduces on a new axis exactly the conflation this
section was rewritten to remove.

What the same table *does* show, and what an earlier revision omitted, is storage
growing linearly: **1.46 MB → 1464.84 MB** across the same range. For a section whose
conclusion is that decay needs a cost justification, that is the relevant column.

What actually follows is **tune *k*, and improve ranking**. Decaying or deleting store
contents is a different intervention and needs a different justification — cost,
latency, or staleness, not retrieval quality.

The rate–distortion paper formalises a compaction tradeoff, but it is tier C and was
never read. Calling it *independent* support, as an earlier revision did, overstated
it twice: it is neither an independent measurement nor a verified one.

---

## 7. Design implications

**Read the provenance label on each recommendation before acting on it.** This is
the only section that advises rather than reports, and an earlier revision opened it
by claiming the literature was "broadly unanimous" — a claim that requires having
read the corpus, which §§1–6 state plainly was not done. Consensus claims,
convergence claims and universal negatives are exactly what a snippet-level survey
cannot support.

Each subsection is now labelled with what it actually rests on:

| | Rests on | Strength |
|---|---|---|
| **7.1** Episodic/semantic/procedural split | CoALA §6, read directly | **Strongest.** Act on it. |
| **7.5** Observability | Structural argument from the poisoning literature | **Strong.** Follows by construction, not by citation. |
| **7.0** Working memory as persistent structure | CoALA's definition (tier A) + inference (mine) | Definition solid; the three consequences are my reasoning. |
| **7.2** Consolidation is under-built | Tier-C snippets + CLS (tier D) | Plausible, unverified. |
| **7.3** Forgetting as a feature | Tier-C cluster + Bjork (tier D) | Plausible, unverified. |
| **7.4** Contradiction and confidence | §5's Zep entry (tier E) for supersession; **nothing** for confidence | **Weakest. Do not budget against it.** |

### 7.0 Working memory is a persistent structure, not the context window

CoALA's definition — a data structure persisting across LLM calls, from which each
call's input is *synthesised* — is a better starting point than "short-term memory =
recent turns in context." Note the honest size of the claim: the *definition* is
tier A, the three consequences below are my inference from it, and in practice this
amounts to keeping structured state outside the transcript — which several agent
frameworks already do with scratchpads and typed state. It is a real improvement on
recency-truncation, not a novel architecture. It means:

- **What persists and what is shown are separate decisions.** Working memory holds
  task state, active goals, retrieved material, and parsed outputs. Any given LLM
  call renders a *subset*.
- **The eviction problem changes shape — but does not disappear.** You are deciding
  what to include in this call's render, and dropped-from-view is not
  dropped-from-state. That splits one problem into two, though: the working-memory
  structure is itself finite and grows monotonically in a long-running agent, so it
  needs its own eviction policy. CoALA does not supply one. Be clear that this
  reframing buys a better *place* to make the decision, not an escape from making
  it.
- **It is the hub.** Working memory is where long-term retrieval lands, where
  reasoning writes, and where grounding observations arrive. Treating it as a
  transcript buffer forfeits all of that.

This alone reframes the short-term half of an STM/LTM design.

### 7.1 Episodic/semantic/procedural beats short-term/long-term

*(Tier A — CoALA §6, read directly. The strongest recommendation here.)*

CoALA makes long-term memory **three** modules, not two. I cannot honestly claim the
field has converged on it — that would need the corpus read — but the sources
visible here are consistent with it, and the argument stands on CoALA alone. An
earlier revision followed this disclaimer with "the thing the field consistently
abandons," which is the same consensus claim one sentence later; it is cut.

What CoALA actually supports: the three modules have different **write policies** and
sharply different **risk** — procedural is the only one where a bad write corrupts
the agent's own behaviour rather than merely its beliefs. Differing decay profiles
and retrieval patterns are my inference, not CoALA's claim.

⚠ **Weigh this against §3.1:** Generative Agents, the most-copied design in the
field and one of the systems CoALA analyses, does *not* implement the split — it
keeps one undifferentiated stream. The argument for three modules is CoALA's
reasoning, not demonstrated practice. (CoALA's own *worked example* is the retail
assistant of §3.1, not Generative Agents; an earlier revision conflated the two.)

Concretely, CoALA's design recipe says to define **read/write access per module**
as an explicit decision. Its worked example gives the agent read/write on episodic
but **read-only on semantic and procedural**. That asymmetry is a good default.

### 7.2 Consolidation is the highest-leverage under-built component

*(Tier C plus tier D. Plausible, unverified — treat as a hypothesis worth testing.)*

An earlier revision said "multiple independent sources name it" without citing any.
What is actually true: the snippet-level sources I could see point this way, none
contradicted it, and none were read. Its theoretical grounding is CLS, which is
tier D. The implementation pattern — offline, batched, into a candidate store with
rollback — is a design suggestion, not a finding.

CoALA supplies a useful framing: **learning is an action the decision procedure
chooses**, on par with acting on the world — not a fixed schedule bolted on the
side. Deferring it to end-of-interaction is a legitimate *simplification*, but the
paper is clear that it is a simplification, and that more flexible agents "treat
learning on par with external actions," deciding when and what to commit.

### 7.3 Forgetting is a feature, and it is now its own research area

*(Tier C cluster plus tier D theory. Plausible, unverified.)*

Not eviction-for-capacity — *selective, importance-weighted decay as a retrieval
quality mechanism*. Bjork's storage/retrieval-strength distinction gives the design
directly: **decay accessibility, do not delete**.

Two warnings. The evidence for decay-improves-quality does **not** come from the
*k*-sweep — see §6, which was previously misread as supporting it. And
"decay, never delete" collides with data-protection law: a persistent store holding
user data owes right-to-erasure, and a design that makes deletion structurally
awkward is a liability. Neither this section nor §6 covers the legal surface, which
is a real gap for anyone building this.

Corroborated from an unexpected direction: CoALA flagged in 2024 that "modifying
and deleting … are understudied," and the 2026 forgetting cluster now exists. The
gap was real and is being filled.

### 7.4 Confidence is an open hole; contradiction handling is partly filled

*(**Supersession: §5's Zep entry, tier E. Confidence: nothing but my inference.**
Weakest item here by a wide margin.)*

This subsection has been progressively stripped. An earlier revision asserted that
Zep is the only mainstream system addressing contradiction and that "nothing
mainstream addresses" confidence — a universal negative over the whole production
landscape, sourced from one Medium post and converted into a market-opportunity
recommendation. That was retracted. A later revision rested the remainder on "the AI
Hippocampus paper names both"; **it names neither** (§3.2), so that support is gone
too.

What is left, stated carefully so it stops overreaching a third time: **the two
halves are not in the same state.**

- **Supersession is partly addressed.** Zep's bi-temporal model (§5) tracks when a
  fact was true separately from when the system learned it, which is exactly this
  problem. An earlier draft of this very paragraph claimed no system tracks
  supersession — contradicting §5 two sections earlier. It is not an open hole; it
  is a hole with one known occupant.
- **Confidence is the emptier of the two.** I found nothing in a snippet-level search
  that attaches a confidence or reliability score to a retrieved memory. That is a
  weak search, not a survey.

**Treat this as a hypothesis to test, not a finding**, and do not commit engineering
budget against it without checking properly.

### 7.5 Corollary: observability

*(Structural argument. Holds regardless of what the tier-C safety papers say.)*

Given the poisoning and drift literature, memory that silently injects is memory
you cannot debug. When behaviour degrades, you need to know *which* memory caused
it — which argues for explicit, traceable retrieval over invisible context
stuffing, at least until the system is well understood.

---

## 8. Reading order

~~1. CoALA~~ — **done**, read directly; §3.1 above reflects the source, not a
summary. Its §§4–6 are the applied core if you want to reread.

Remaining, for someone designing a system from scratch:

1. **[Generative Agents](https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763)** —
   the most-copied concrete design. The reflection-storage question raised in §3.1
   is answered on the mechanism but §3.1 asks you to confirm it first-hand; what
   remains beyond that is whether CoALA's separate-semantic-store recasting is a
   better design than Park's single stream.
2. **[From Storage to Experience](https://arxiv.org/html/2605.06716v1)** — the map of
   the field. Currently tier-B; the CoALA experience shows what that costs.
3. **[The AI Hippocampus](https://arxiv.org/pdf/2601.09113)** — a taxonomy of the
   memory literature. Read it to find out what it *does* say: this document
   attributed a gap list to it that is not in it (§3.2).
4. **[HippoRAG](https://proceedings.neurips.cc/paper_files/paper/2024/file/6ddc001d07ca4f319af96a3024f6dbd1-Paper-Conference.pdf)** — best neuro-to-AI mapping.
5. **[McClelland, McNaughton & O'Reilly (1995)](https://doi.org/10.1037/0033-295X.102.3.419), CLS**
   — the theory underneath consolidation. §9 lists this and O'Reilly et al. (2014),
   a later multi-author review; read the 1995 paper for the argument.
6. **[Memory Poisoning Attack and Defense](https://arxiv.org/abs/2601.05504)** — before
   committing to an architecture.

**Lesson from doing this once:** reading CoALA directly changed three substantive
claims in this document (working memory's definition, procedural memory's dual
nature and risk asymmetry, and the read/write-per-module design step). Tier-B
summaries preserved the taxonomy but dropped the parts that actually constrain a
design. Budget for direct reads of anything load-bearing.

---

## 9. Full source list

### Surveys

- [From Storage to Experience: A Survey on the Evolution of LLM Agent Memory Mechanisms](https://arxiv.org/html/2605.06716v1)
- [Memory for Autonomous LLM Agents: Mechanisms, Evaluation, and Emerging Frontiers](https://arxiv.org/abs/2603.07670)
- [The AI Hippocampus: How Far are We From Human Memory?](https://arxiv.org/pdf/2601.09113)

### Architectures and systems

- [Voyager: An Open-Ended Embodied Agent with Large Language Models](https://arxiv.org/abs/2305.16291)
- [Reflexion: Language Agents with Verbal Reinforcement Learning](https://arxiv.org/abs/2303.11366)
- [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)
- [Cognitive Architectures for Language Agents (CoALA)](https://arxiv.org/abs/2309.02427) — Sumers, Yao, Narasimhan & Griffiths; **TMLR 02/2024**; [OpenReview](https://openreview.net/forum?id=1i6ZCvflQJ); [companion repo](https://github.com/ysymyth/awesome-language-agents)
- [A-Mem: Agentic Memory for LLM Agents](https://arxiv.org/abs/2502.12110) — [benchmark code](https://github.com/WujiangXu/AgenticMemory), [production code](https://github.com/WujiangXu/A-mem-sys)
- [HippoRAG: Neurobiologically Inspired Long-Term Memory for LLMs](https://proceedings.neurips.cc/paper_files/paper/2024/file/6ddc001d07ca4f319af96a3024f6dbd1-Paper-Conference.pdf)
- [Generative Agents: Interactive Simulacra of Human Behavior](https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763)
- [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560)
- [MemoryBank: Enhancing LLMs with Long-Term Memory](https://arxiv.org/abs/2305.10250)
- [SoK: Agentic Skills — Beyond Tool Use in LLM Agents](https://arxiv.org/html/2602.20867v1)

### Human-memory bridge

- [Position: Episodic Memory is the Missing Piece for Long-Term LLM Agents](https://arxiv.org/pdf/2502.06975)
- [Human-Like Remembering and Forgetting in LLM Agents: An ACT-R-Inspired Memory Architecture](https://dl.acm.org/doi/10.1145/3765766.3765803)
- ["My agent understands me better": Dynamic Human-like Memory Recall and Consolidation](https://dl.acm.org/doi/10.1145/3613905.3650839)
- [Why There Are Complementary Learning Systems in the Hippocampus and Neocortex (McClelland, McNaughton & O'Reilly, 1995)](https://doi.org/10.1037/0033-295X.102.3.419) — *Psychological Review* 102(3)
- [Complementary Learning Systems (O'Reilly et al., 2014)](https://onlinelibrary.wiley.com/doi/10.1111/j.1551-6709.2011.01214.x)
- [Baddeley's model of working memory](https://en.wikipedia.org/wiki/Baddeley's_model_of_working_memory)
- [Multi-Store Memory Model: Atkinson and Shiffrin](https://www.simplypsychology.org/multi-store.html)
- [The episodic buffer: a new component of working memory?](https://www.cell.com/trends/cognitive-sciences/fulltext/S1364-6613(00)01538-2)

### Forgetting and consolidation

- [FadeMem: Biologically-Inspired Forgetting for Efficient Agent Memory](https://arxiv.org/pdf/2601.18642)
- [Oblivion: Self-Adaptive Agentic Memory Control through Decay-Driven Activation](https://arxiv.org/html/2604.00131)
- [FSFM: A Biologically-Inspired Framework for Selective Forgetting of Agent Memory](https://arxiv.org/pdf/2604.20300)
- [Auto-Dreamer: Learning Offline Memory Consolidation for Language Agents](https://arxiv.org/html/2605.20616)
- [Sleep-time Compute (Letta)](https://www.letta.com/blog/sleep-time-compute/)
- [What to Keep, What to Forget: A Rate–Distortion View of Memory Compaction](https://arxiv.org/pdf/2607.08032)

### Safety

- [MINJA: Memory Injection Attacks on LLM Agents via Query-Only Interaction](https://arxiv.org/abs/2503.03704) — Dong et al., 2025
- [Memory Poisoning Attack and Defense on Memory Based LLM-Agents](https://arxiv.org/abs/2601.05504)
- [When Agents Remember Too Much: Memory Poisoning Attacks on LLM Agents](https://arxiv.org/pdf/2607.06595)
- [MemAudit: Post-hoc Auditing of Poisoned Agent Memory](https://arxiv.org/pdf/2605.23723)
- [Governing Evolving Memory in LLM Agents (SSGM)](https://arxiv.org/pdf/2603.11768)

### Evaluation

- [LongMemEval](https://www.emergentmind.com/topics/longmemeval)
- [LoCoMo: Evaluating Very Long-Term Conversational Memory of LLM Agents](https://arxiv.org/abs/2402.17753)
- [DialSim: A Dialogue Simulator for Evaluating Long-Term Multi-Party Dialogue Understanding of Conversational Agents](https://arxiv.org/abs/2406.13144)

### Vendor landscape

- [AI Agent Memory 2026 — Comparing Mem0, Zep, Graphiti, Letta, LangMem](https://medium.com/@wasowski.jarek/i-compared-5-ai-agent-memory-systems-across-6-dimensions-none-wins-6a658335ed0a)
