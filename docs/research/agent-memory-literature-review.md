# Agent Memory: Literature Review

A survey of work on memory for LLM agents and the human memory research it draws
on, assembled as background for designing a short-term / long-term memory system.

**Compiled:** 2026-07-30 · **Last revised:** 2026-08-07

## Provenance and confidence

Sources fall into the tiers below. This matters for how much weight to put on any
given claim.

| Tier | Sources | What this means |
|---|---|---|
| **A — read directly** | **CoALA** (pp. 1–4, 7–19 — all of §1 and §4–§8; pp. 5–6, the production-systems background, skipped); **A-Mem** (pp. 1–12; appendices not read) | Text, tables, and figures seen firsthand. |
| **B — machine summary of the source** | *From Storage to Experience* (HTML full text), *The AI Hippocampus* (PDF), *Memory for Autonomous LLM Agents* (**abstract page only** — the full paper was never fetched) | A summarising model read these and returned prose; the underlying text was never inspected. No methodology, tables, or citations verified. Unknown what the summariser dropped. §3 below shows that this tier *does* lose load-bearing detail. |
| **C — search-result snippets** | Every other paper cited: HippoRAG, Generative Agents, MemGPT, MemoryBank, Voyager, all forgetting papers, all safety papers, all benchmarks | Titles, abstract fragments, and search-engine summaries only. Existence verified (see below); content not. Treat as *pointers to follow*, not findings. |
| **D — unverified recall** | §1 (Human memory foundations) | Written from model training knowledge. Two attributions since corroborated by CoALA's own citations (Atkinson & Shiffrin 1968; Baddeley & Hitch 1974). The rest — Teyler & DiScenna 1986, Bjork's storage/retrieval-strength distinction, Nader 2000, Anderson/Bjork/Bjork 1994 — remain unverified. Canonical textbook material, so likely correct, but check before citing. |

### Existence check (2026-08-07)

Every arXiv ID cited here was queried against the arXiv API. **All 11 resolve, with
titles matching what is cited.** No fabricated references.

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
| 2607.08032v1 | 2026-07-09 | ✓ What to Keep, What to Forget: A Rate–Distortion View of Memory Compaction |
| 2502.06975v1 | 2025-02-10 | ✓ Position: Episodic Memory is the Missing Piece for Long-Term LLM Agents |

This confirms the papers exist and are titled as cited. It does **not** verify any
claim about their *contents* — those still rest on tier-C snippets.

**Caveat on recency.** The compiling model's knowledge cutoff is May 2026, so most
papers here postdate it. Existence is now established; substance is not. Verify
before relying on any specific finding.

Benchmark numbers from vendor and blog sources are flagged inline where used.

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
| **Squire** | Declarative vs. procedural | Procedural handled separately and worst — see skill libraries |

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

**Forgetting curve** — Ebbinghaus (1885). Retention decays roughly exponentially
absent reinforcement. Cited by every decay-based agent memory system.

**New theory of disuse** — Bjork. Separates **storage strength** from **retrieval
strength**. Forgetting is loss of *accessibility*, not erasure. This distinction
is usually flattened in implementations, and flattening it is a design error: it
is the difference between decaying a score and deleting a row.

**Reconstructive memory** — Bartlett (1932). Memory is rebuilt at retrieval time,
shaped by schemas, not played back. Consistently underused in AI work, though
*Memory is Reconstructed, Not Retrieved* (2026) takes it seriously.

**Reconsolidation** — Nader et al. (2000). Retrieving a memory renders it labile;
it must be re-stored and may be altered in the process. The biological analogue of
A-Mem's "memory evolution."

**ACT-R** — Anderson. Activation-based declarative memory with base-level decay
and spreading activation. Supplies a concrete, implementable formula for "how
retrievable is this right now," which several agent systems copy directly.

### 1.3 Retrieval

- **Encoding specificity** (Tulving & Thomson, 1973) — retrieval succeeds when cues
  overlap the encoding context. The argument for storing context alongside content,
  which is exactly what A-Mem's contextual descriptions do.
- **Retrieval-induced forgetting** (Anderson, Bjork & Bjork, 1994) — retrieving some
  items actively *suppresses* related competitors. Almost no agent system has an
  analogue for this, and it may be part of why naive top-*k* retrieval degrades with
  larger *k*.
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
  a weighted sum of **recency × importance × relevance**. Adds **reflection**:
  periodic synthesis of observations into higher-level inferences, written back into
  the stream as retrievable nodes. Reflection fires on an accumulated-importance
  threshold, not a fixed schedule. Still the most-copied single design in the field.
- **MemoryBank** (Zhong et al., AAAI 2024) — explicitly implements an
  Ebbinghaus-style forgetting curve.

### Stage 2 — Reflection (2024–2025)

Actively evaluate and refine what is stored. Three pathways: **introspection**
(self-critique without external feedback, e.g. Reflexion), **environmental**
(grounding corrections in outcomes), **coordination** (multi-agent consensus).

- **A-Mem** (Xu et al., 2025) — Zettelkasten-inspired. LLM-generated notes with
  keywords/tags/contextual descriptions, LLM-decided linking over an embedding
  prefilter, and *memory evolution* that rewrites existing notes when new ones
  arrive. Ablation: removing linking and evolution drops multi-hop F1 from 27.02 to
  9.65; restoring linking alone recovers to 21.35 — so **linking is the load-bearing
  mechanism and evolution is a refinement on top**, not the reverse.
- **HippoRAG** (Gutiérrez et al., NeurIPS 2024) — the cleanest neuro-to-AI mapping in
  the literature. LLM as neocortex, knowledge graph as hippocampal index,
  Personalized PageRank as pattern completion. Reports up to 20% over prior SOTA on
  multi-hop.

### Stage 3 — Experience (H2 2025 onward)

Abstract reusable *strategy* from clustered interactions, not just facts. Splits
into **explicit** (human-readable policies), **implicit** (parameter
internalisation via fine-tuning), and **hybrid**.

This is where **procedural memory** lives. **Voyager** (Wang et al., 2023) —
building an executable skill library through curriculum-driven exploration in
Minecraft — is the landmark. 2026 descendants: SkillOS, Skill-Pro, CODESKILL,
EmbodiSkill, and a [SoK on agentic skills](https://arxiv.org/html/2602.20867v1).

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
**The framing paper**, and the only source in this document read directly at
length.

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
> arguments) which are stored back in working memory."

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
  agents."** → learned//policy-based retrieval.
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
   better (Voyager for Minecraft), simpler ones generalise (ReAct).

CoALA also names a simplification that matters for the consolidation design:
**learning can be deferred to the end of an interaction**, summarising the episode
before storing it — citing Reflexion and Generative Agents. That is the "consolidate
at session end" pattern, stated as a deliberate decision-procedure simplification
rather than an architectural necessity.

#### Where CoALA and the search-snippet account of Generative Agents disagree

CoALA §5 states Generative Agents "use retrieval and reasoning to generate
reflections on their episodic memory … which are then written to long-term
**semantic** memory." The search-snippet account in §2 says reflections are stored
back into the **observation stream** as thought nodes. These may be reconcilable
(CoALA is recasting Park et al. into its own taxonomy), but **this document cannot
resolve it** — the Park paper was not read. Check the original before relying on
either.

### 3.2 The AI Hippocampus

[arXiv 2601.09113](https://arxiv.org/pdf/2601.09113) — direct human-vs-AI
comparison. Its **gap list** is the most useful part:

- No robust **consolidation and abstraction** comparable to sleep-dependent
  processing
- Poor **interference resolution** — conflicting memories are handled badly
- No **metacognitive awareness** of memory reliability: no confidence, no source
  monitoring
- Weak **temporal reasoning** about *when* a memory should apply

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
| **LoCoMo** (Maharana et al., 2024) | 10 conversations, ~27 sessions each, ~16.6K tokens | Single-hop, multi-hop, temporal, open-domain, adversarial |
| **LongMemEval** | 500 curated questions; 115K → 1.5M token settings | Information extraction, multi-session reasoning, temporal reasoning, **knowledge updates**, **abstention** |
| **DialSim** | Real-time multi-party dialogue (TV shows), ~1,300 sessions | Long-term multi-party QA |
| **MemoryAgentBench / MemGym / WorldLines / MemoryArena** | Agentic, multi-session | Memory interleaved with decision-making |

Two things to note:

1. **LongMemEval's knowledge-update and abstention categories are the most
   design-relevant.** They are the only widely-used tests of "this fact changed" and
   "you should say you don't know" — precisely the two gaps the AI Hippocampus paper
   names.
2. **The field is moving from static recall to agentic evaluation.** The
   Mechanisms & Frontiers survey flags this shift explicitly, and reports that the
   newer benchmarks expose gaps the recall benchmarks miss.

**Caution:** LoCoMo scores are near-saturated and contested across
reimplementations. Do not select an architecture on LoCoMo deltas alone.

---

## 5. Production systems

The comparison material available is largely vendor-adjacent, and reported
benchmark numbers **conflict substantially between sources**. Architecture
descriptions below are reliable; treat any specific percentage as marketing until
independently verified.

| System | Approach | Distinguishing idea |
|---|---|---|
| **Letta** (ex-MemGPT) | Explicit memory-block API, self-editing context | Sleep-time compute; agent manages its own memory via tools |
| **Mem0** | Fact extraction → vector store | Lightweight, low token cost |
| **Zep / Graphiti** | Temporal knowledge graph | **Bi-temporal modelling** — tracks both when a fact was true and when the system learned it |
| **LangMem** | LangChain-native SDK | Framework integration |

**Zep's bi-temporal modelling is the genuinely distinctive idea in this tier.** It
is the only principled answer to "this fact was superseded" among the mainstream
options, and it maps onto a real gap the research literature names.

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

- **[MINJA](https://arxiv.org/abs/2601.05504)** — memory injection via ordinary queries,
  no special privileges. Reported >95% injection success / >70% attack success
  *(single source, unreplicated — treat with caution)*.
- **MemoryGraft** — implants malicious *successful experiences* into long-term memory.
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

### Unbounded memory degrades performance

Independently supported: A-Mem's own *k*-sweep shows retrieval quality plateauing
around *k*≈30–40 and **declining** at 50; the rate–distortion paper formalises the
tradeoff. More retrieved context is not monotonically better — irrelevant
retrievals are noise competing with signal.

---

## 7. Design implications

Points the literature is broadly unanimous on, each cutting against a common
intuition. §7.0 is the one to internalise first; it is sourced from a directly-read
paper rather than a summary.

### 7.0 Working memory is a persistent structure, not the context window

CoALA's definition — a data structure persisting across LLM calls, from which each
call's input is *synthesised* — is a materially better design than "short-term
memory = recent turns in context." It means:

- **What persists and what is shown are separate decisions.** Working memory holds
  task state, active goals, retrieved material, and parsed outputs. Any given LLM
  call renders a *subset*.
- **The eviction problem changes shape.** You are not deciding what to drop from
  memory; you are deciding what to include in this call's render. Dropped-from-view
  is not dropped-from-state.
- **It is the hub.** Working memory is where long-term retrieval lands, where
  reasoning writes, and where grounding observations arrive. Treating it as a
  transcript buffer forfeits all of that.

This alone reframes the short-term half of an STM/LTM design.

### 7.1 Episodic/semantic/procedural beats short-term/long-term

Nearly every serious architecture converges on CoALA's decomposition, and CoALA
itself makes it **three** long-term modules, not two. "Long-term memory" as one
undifferentiated store is the thing the field consistently abandons. The three have
different write policies, different decay profiles, different retrieval patterns —
and, per CoALA, sharply different **risk**: procedural is the only one where a bad
write can corrupt the agent's own behaviour rather than merely its beliefs.

Concretely, CoALA's design recipe says to define **read/write access per module**
as an explicit decision. Its worked example gives the agent read/write on episodic
but **read-only on semantic and procedural**. That asymmetry is a good default.

### 7.2 Consolidation is the highest-leverage under-built component

Multiple independent sources name it as the least-implemented and most impactful
stage. It is also the part with the strongest theoretical grounding (CLS) and the
clearest implementation pattern (offline, batched, into a candidate store with
rollback).

CoALA supplies a useful framing: **learning is an action the decision procedure
chooses**, on par with acting on the world — not a fixed schedule bolted on the
side. Deferring it to end-of-interaction is a legitimate *simplification*, but the
paper is clear that it is a simplification, and that more flexible agents "treat
learning on par with external actions," deciding when and what to commit.

### 7.3 Forgetting is a feature, and it is now its own research area

Not eviction-for-capacity — *selective, importance-weighted decay as a retrieval
quality mechanism*. Bjork's storage/retrieval-strength distinction gives the
design directly: **decay accessibility, do not delete**.

Corroborated from an unexpected direction: CoALA flagged in 2024 that "modifying
and deleting … are understudied," and the 2026 forgetting cluster now exists. The
gap was real and is being filled.

### 7.4 Contradiction handling and confidence are the open holes

The AI Hippocampus paper names both. Zep's bi-temporal graph is the only mainstream
system meaningfully addressing the first; nothing mainstream addresses the second.
If one component of a new system is to be non-commodity, this is where the
opportunity is.

### 7.5 Corollary: observability

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
   the most-copied concrete design, and needed to resolve the reflection-storage
   discrepancy noted in §3.1.
2. **[From Storage to Experience](https://arxiv.org/html/2605.06716v1)** — the map of
   the field. Currently tier-B; the CoALA experience shows what that costs.
3. **[The AI Hippocampus](https://arxiv.org/pdf/2601.09113)** — what is still missing.
   Also tier-B.
4. **[HippoRAG](https://proceedings.neurips.cc/paper_files/paper/2024/file/6ddc001d07ca4f319af96a3024f6dbd1-Paper-Conference.pdf)** — best neuro-to-AI mapping.
5. **McClelland et al. (1995), CLS** — the theory underneath consolidation.
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
- [Complementary Learning Systems (O'Reilly, 2014)](https://onlinelibrary.wiley.com/doi/10.1111/j.1551-6709.2011.01214.x)
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

- [Memory Poisoning Attack and Defense on Memory Based LLM-Agents](https://arxiv.org/abs/2601.05504)
- [When Agents Remember Too Much: Memory Poisoning Attacks on LLM Agents](https://arxiv.org/pdf/2607.06595)
- [MemAudit: Post-hoc Auditing of Poisoned Agent Memory](https://arxiv.org/pdf/2605.23723)
- [Governing Evolving Memory in LLM Agents (SSGM)](https://arxiv.org/pdf/2603.11768)

### Evaluation

- [LongMemEval](https://www.emergentmind.com/topics/longmemeval)
- [LoCoMo: Evaluating Very Long-Term Conversational Memory of LLM Agents](https://arxiv.org/abs/2402.17753)
- [DialSim: A Real-Time Simulator for Long-Term Multi-Party Dialogue](https://arxiv.org/abs/2406.13144)

### Vendor landscape

- [AI Agent Memory 2026 — Comparing Mem0, Zep, Graphiti, Letta, LangMem](https://medium.com/@wasowski.jarek/i-compared-5-ai-agent-memory-systems-across-6-dimensions-none-wins-6a658335ed0a)
