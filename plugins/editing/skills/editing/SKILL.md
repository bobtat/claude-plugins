---
name: editing
description: This skill should be used whenever Claude is writing or revising prose that a person will read — a chat reply explaining a finding, a README, a design doc or ADR, a PR description, release notes, a docstring — and whenever the user asks to "edit this", "tighten this", "cut the fluff", "make this less AI", "rewrite this paragraph", "review my writing", or says a draft is "too wordy", "too corporate", "repetitive", or "reads like ChatGPT". Provides the catalog of tells that mark machine-written prose, the clarity moves that rebuild a sentence around its real subject and verb, the never-invent rules that separate editing from rewriting, and the register bar for each kind of document.
---

# Editing

## Overview

Two different failures produce most bad prose, and they need opposite treatments.

The first is **noise** — text occupying space without carrying information. Praise for the question. Narration of what is about to happen. Claims about how carefully the writer thought. Noise is deleted, never rewritten; no amount of restructuring improves a sentence that should not exist.

The second is **fog** — real content buried in the wrong grammar. The actor missing from the subject, the action trapped inside a noun, the point stranded mid-sentence instead of at its end. Fog is restructured. The information survives; only its shape changes.

An edit pass does both, in that order. Delete before restructuring — otherwise you spend effort rebuilding sentences you were about to cut.

The third thing an edit pass does is **stop**. An editor who keeps going past the last real problem starts inventing them, and the draft gets worse under the pretense of improvement. The hardest rule here is not what to cut. It is what to leave alone.

## Non-Negotiables

These are gates. Each blocks an edit until its condition is met.

| Gate | Rule |
|---|---|
| **Never add a claim** | The edited text may assert nothing the draft did not assert. An editor who tightens a sentence into a cleaner, stronger statement the author never made has fabricated, not edited. |
| **Never delete a real hedge** | "This probably fixes the race" becomes a lie as "This fixes the race". Cut hedges that pad; keep hedges that encode uncertainty the author actually has. |
| **Never drop a qualifier** | "on Linux", "for authenticated users", "after the 3.2 migration" — scope conditions look like clutter and are load-bearing. Dropping one silently widens the claim. |
| **Never touch quoted material** | Quotes, code, identifiers, error strings, log output, file paths, command lines, and anything the user wrote are edited only when the user asks for exactly that. |
| **Never synonym a term of art** | "idempotent" does not become "repeatable"; "p99" does not become "typical". Precision reads as jargon and is not. |
| **Preserve rejected alternatives** | In a design doc or ADR, "we considered X and did not take it" is the document's most valuable content. It is not throat-clearing. |
| **Report the cut, do not hide it** | When an edit removes something that may have been intentional, say so. A silent deletion the author never notices is the worst outcome of an edit pass. |

## The Two Passes

### Pass 1 — Delete the noise

These constructions carry no information. They are recognized on sight and removed, not improved. The full catalog with worked examples is `references/tells.md`; the ones worth memorizing:

| Tell | Example | Fix |
|---|---|---|
| Sycophantic opener | "Great question!" / "Great catch!" | Delete. Praise for the prompt is not content. |
| Narrated procedure | "Let me take a look at…" / "I've gone ahead and…" | Delete. The action is visible in what follows it. |
| Self-commentary | "I want to be thorough here" / "carefully analyzing this" | Delete. Claims about the quality of your own thinking add nothing. |
| Restating the request | "So you want to add auth to your app." | Delete. The reader wrote it. |
| Announced significance | "It's worth noting that" / "Importantly" / "Here's the key insight" | Delete the frame, keep the sentence. If it were not worth noting you would not have written it. |
| Stacked hedges | "could potentially" / "it seems like it may" | One hedge maximum, and only where the doubt is real. |
| Inflation by negation | "not just X, but Y" / "isn't merely" / "goes beyond" | State Y. The negated half is usually filler. |
| Invented triads | "faster, cleaner, and more maintainable" | Keep the items that are true. The third is often present for rhythm. |
| Manufactured balance | A con attached to every pro so the analysis looks even-handed | Cut the caveat you do not believe. If one option is better, say so. |
| Trailing offer | "Let me know if you'd like me to explain further!" | Delete unless the user asked what comes next. |
| Restating summary | "In summary, we added X and fixed Y" after three paragraphs saying that | Delete. Summaries earn their place at length, not after 200 words. |
| Bullet sprawl | Connected reasoning shredded into fragments | Restore the prose. Lists are for genuinely parallel items, not for arguments. |

Two of these deserve care rather than reflex:

- **Em dashes are not a tell.** The tic is the *dramatic reversal* — the every-paragraph reveal that withholds the point for effect. A dash joining a clause to its consequence is ordinary punctuation and stays.
- **Bold is not a tell.** Bolding *every* noun phrase is. When everything is emphasized nothing is; keep the emphasis on terms a scanning reader needs to find.

### Pass 2 — Fix the fog

Once the noise is gone, what remains either says its thing clearly or does not. Five moves fix nearly all of it. Full treatment in `references/craft.md`.

| Move | Symptom | Example |
|---|---|---|
| **Actor into subject** | The real agent sits in a prepositional phrase, or is absent | "The implementation of retry was done by the team" → "The team implemented retry" |
| **Action out of the noun** | Nominalizations: *implementation, assumption, verification, utilization* | "makes the assumption that" → "assumes"; "performs a validation of" → "validates" |
| **Verb near the subject** | A fourteen-word subject strands the verb | "The service that handles token refresh and session cleanup **fails**" → "Token refresh **fails**" |
| **Point at the end** | The claim is buried mid-sentence and the sentence trails off into qualifiers | English stresses the final position. Put the new information there. |
| **Concrete over abstract** | "performance issues", "some problems", "various improvements" | "a 400 ms p99", "two null-reference crashes" — but only when the draft already contains the specifics. Do not invent numbers. |

Also: **passive voice is not banned.** "The record was deleted" is correct when the deleter is unknown, irrelevant, or deliberately unnamed. Convert to active when hiding the actor costs the reader something.

### Where the passes meet

Both applied to one paragraph:

> **Before.** "Great question! I've gone ahead and taken a careful look at the auth module. The main issue is that the token refresh logic isn't just handling expiry — it's also silently swallowing network errors, which could potentially lead to unexpected behavior down the line. It's worth noting that the implementation of the retry mechanism was done in a way that makes the assumption that all failures are transient."

> **After.** "The auth module's token refresh handles expiry, but it also swallows network errors silently — and the retry logic assumes every failure is transient."

72 words to 24. Pass 1 removed the opener, the narration, the "carefully", the announced significance, and one of two stacked hedges. Pass 2 turned "the implementation … was done in a way that makes the assumption" into "assumes" and moved the finding to the front. Nothing was added. Both claims survive.

## Register

The standard is one standard; the bar moves by document. A README edited to chat-reply density becomes unusable. Per-surface detail in `references/registers.md`.

| Surface | What it owes the reader | Where edits go wrong |
|---|---|---|
| **Chat reply** | The finding first, then the reasoning. No preamble, no summary. | Under-cutting. This is the densest register; nearly everything before the first real sentence goes. |
| **README** | A stranger deciding whether to use this. Purpose, then install, then a real example. | Over-cutting. The context a maintainer finds obvious is exactly what the stranger lacks. |
| **Design doc / ADR** | The decision, the alternatives, and why they lost. | Cutting the alternatives as filler. They are the point of the document. |
| **PR description** | Why the change exists and where to look hard. | Restating the diff. See `git-workflow:git-workflow`. |
| **Commit message** | Why, not what, in Conventional Commits form. | Owned by `git-workflow:git-workflow` — defer to it rather than duplicating the format here. |
| **Code comment** | Only the *why* the code cannot state itself. | Editing a comment that should be deleted. Restating the code is not a style problem; it is a redundant comment. |
| **Error message / UI copy** | What happened, and what to do next. | Elegance. Clarity beats concision at every point of failure. |

## Editing Claude's Own Chat Replies

No hook can revise a chat message before the user reads it — `Stop` fires after the text is already on screen, and blocking it only appends a correction below the original. Chat prose is therefore governed by discipline at composition, not by interception.

Before sending a reply longer than a few sentences, check three things:

1. **Does it open on content?** Find the first sentence carrying information. Everything above it goes.
2. **Is any sentence about the reply itself?** "I'll explain below", "to be thorough", "as mentioned above" — cut.
3. **Does it end on the last real point?** If a closing paragraph summarizes or offers more work, the message ended one paragraph earlier.

A style rule in the user's `CLAUDE.md` outranks everything in this skill.

## When to Stop and Ask

- The draft makes a claim that appears false. That is a correctness problem; report it rather than smoothing the prose over it.
- A sentence is unclear enough that fixing it means guessing the intent. Ask rather than silently picking a reading.
- The voice is deliberate and unusual — a joke, an aside, a deliberately informal line in a formal document. Confirm before flattening it.
- Editing would cut more than roughly half of something the user wrote themselves. Show the cut list first.
- The text is someone else's published writing and the reason for editing it has not been stated.

## Additional Resources

### Reference Files

- **`references/tells.md`** — Every tell with a worked before/after, the reason it reads as machine-written, and the case where the construction is genuinely correct.
- **`references/craft.md`** — The clarity moves in full: nominalization tables, subject–verb proximity, the old-to-new flow that makes paragraphs cohere, stress position, parallelism, and when passive voice is right.
- **`references/registers.md`** — Per-surface standards for README, ADR, PR body, release notes, docstrings, comments, error messages, and chat replies, with the failure mode specific to each.
- **`references/sources.md`** — Where each rule comes from, which parts are this plugin's own synthesis, and what it deliberately does not cover.

### Commands

- **`/editing:edit`** — Runs the two-pass edit over a file, a passage, or the last reply, and reports every cut.
- **`/editing:critique`** — Read-only. Spawns a cold reader over a document and returns findings without changing anything.
