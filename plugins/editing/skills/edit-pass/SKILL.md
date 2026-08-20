---
name: edit-pass
description: Use when running a full edit over a specific draft — establishing what the document is for and who reads it, deleting noise before restructuring fog, holding every change against the never-invent rules, and reporting each cut so the author can veto it. Invoked by /editing:edit; also useful directly when a README, design doc, or long reply needs revision rather than a fresh draft.
---

# Running an Edit Pass

The `editing:editing` skill defines the standard. This one is the procedure for applying it to a particular document without wrecking it.

An edit pass has one property that separates it from rewriting: **the author can reject any individual change and the rest still stands.** That requires the changes to be discrete, attributable, and reported — not a new draft handed back with "I cleaned it up."

## The Five Phases

Do not skip to Phase 3. The two phases before it are what keep the edit from becoming a rewrite.

### Phase 1 — Establish the contract

Before reading for style, answer three questions. Getting these wrong makes every later judgment wrong.

| Question | Why it decides the edit |
|---|---|
| **Who reads this?** | A stranger evaluating the project needs context a teammate finds tedious. The same paragraph is bloat for one and essential for the other. |
| **What must the reader do after reading?** | Install something, approve a decision, find a parameter, understand a failure. Content that does not serve that action is the first candidate to cut. |
| **Who wrote it?** | Claude's own draft may be cut hard. The user's writing gets proposals, not silent surgery. Someone else's published text is off limits without a stated reason. |

If the document is Claude's own and the answers are obvious, state them in one line and move on. If it is the user's and the audience is unclear, ask — editing to the wrong audience produces confident, thorough damage.

Also identify the **register** from the table in `editing:editing`. A README and a chat reply do not get the same bar.

### Phase 2 — Read it whole, mark nothing

Read the entire document before changing a word. Two things only visible on a full read:

- **Structural problems.** The document answers the reader's third question before their first. Two sections say the same thing. The conclusion is in paragraph six. No amount of sentence-level editing fixes this, and sentence-level editing done first is wasted when the section moves.
- **Deliberate voice.** A recurring joke, a consistent informality, a rhythm the author is using on purpose. Reading one paragraph in isolation makes intent look like error.

Structural fixes are **proposals, not edits** unless the document is Claude's own. Moving someone's sections around is a rewrite wearing an edit's clothes.

### Phase 3 — Delete the noise

Pass 1 from `editing:editing`, applied top to bottom. Every deletion is a candidate to log.

Delete in this order — it prevents wasted work:

1. **Whole paragraphs** that exist only to introduce, summarize, or transition.
2. **Whole sentences** matching a tell.
3. **Clauses and phrases** — metadiscourse, stacked hedges, "in order to", "due to the fact that".

Track anything removed that a reasonable author might have wanted, with its reason. That list is the report, and it is what makes the pass reviewable.

### Phase 4 — Fix the fog

Pass 2 from `editing:editing`, on what survives. Work sentence by sentence, and for each one ask the only question that matters: **what is the actor, and what did it do?** If the answer is not in the subject and verb, that is the fix.

Two rules specific to this phase:

- **One restructure per sentence.** A sentence rebuilt three times is a sentence you rewrote. If it still fails after one honest attempt, flag it as unclear and ask what it meant.
- **Verify meaning survived.** After restructuring, read the original and the replacement side by side and confirm every claim, hedge, and qualifier is still present. This is where fabrication happens — not from malice, but because a cleaner sentence is easier to write than a faithful one.

### Phase 5 — Report

Never hand back only the edited text. The report is what makes the pass auditable:

- **What changed structurally**, if anything, and whether it was applied or is proposed.
- **The cut list** — anything removed that carried arguable content, with the reason. Pure noise deletions are summarized by count, not enumerated.
- **Anything not touched and why** — a passage that reads oddly but is deliberate, a term of art left alone, a hedge preserved.
- **Open questions** — sentences whose meaning was unclear, claims that look wrong, places where the audience assumption drove a judgment call.
- **The size delta** — before and after word count. It is the cheapest honest signal of how invasive the pass was.

## Gates

| Gate | Rule |
|---|---|
| **The user's own writing** | Propose, do not apply, unless the user asked for a rewrite. Show the diff or the marked-up passage. |
| **More than half cut** | Stop and show the cut list before applying. A 60% reduction is either exactly right or badly wrong, and only the author knows which. |
| **A claim looks false** | Report it as a correctness finding. Do not edit around it, and do not soften it into a hedge. |
| **Meaning is unclear** | Ask. A guessed intent that reads cleanly is worse than a clumsy sentence, because nobody will catch it. |
| **Code, quotes, identifiers** | Untouched. Prose about the code is in scope; the code is not. |

## What This Procedure Does Not Do

- **It does not fact-check.** Wrong claims get flagged, not corrected. Correcting them requires knowing the truth, which is a different task with a different failure mode.
- **It does not restructure someone else's argument.** Reordering paragraphs changes what a document argues, not just how it reads.
- **It does not enforce a house voice on the user's prose.** The standard governs Claude's writing. On the user's writing it removes noise and fog, and leaves the voice alone.
