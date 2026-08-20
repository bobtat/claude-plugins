---
description: Read a document cold and report what is wrong with it — findings only, no edits
argument-hint: <file path> (or a pasted passage)
allowed-tools: Agent, Read, Grep, Glob, Skill
---

## Task

Get an honest reading of a document from someone who has not been staring at it, and report the findings. **Change nothing.**

This is the read-only counterpart to `/editing:edit`. Use it when the question is *is this any good* rather than *make this shorter* — before a README ships, before a design doc goes out for approval, or when a draft feels wrong and the reason is not obvious.

## How to run it

**Spawn the `editing:prose-critic` agent** with the target and whatever context matters: who the reader is, what the document is for, and who wrote it. The agent reads cold — that is the entire point, and it is why this command delegates rather than reading the document on the main thread. A critique written by the same context that produced the draft inherits its blind spots.

Pass along, when known:

- **The intended reader** and what they need to do after reading. Without this the agent will assume, and say that it assumed.
- **The author** — Claude, the user, or a third party. It sets the tone of the findings, not their content.
- **Any constraint** — a length limit, a required section, a house style, an audience that cannot be assumed to know the domain.

For a short passage pasted directly into `$ARGUMENTS`, reading it inline is fine; the cold-read advantage is small for three paragraphs and the agent round-trip is not worth it.

## What comes back

Findings ordered by consequence, each naming a location, the problem, and why it matters — not a rewrite. Structural problems first, then paragraph-level, then line-level.

**Relay the findings; do not act on them.** If the user wants them applied, that is `/editing:edit`, which will re-derive the changes with the authorship and gate rules that command enforces.

## Hard rules

- **No edits.** No file is written, and no "here is the fixed version" is offered unless the user asks for one after seeing the findings.
- **Do not soften the report.** A critique that grades everything as fine is worthless. If the document is good, say which parts and why, and still name the weakest one.
- **Do not invent problems to fill a report.** Three real findings beat twelve manufactured ones. An empty structural section is a legitimate result.
- **Separate correctness from style.** A claim that looks false is a different class of finding from a clumsy sentence, and it outranks everything else in the report.
- **Do not treat the user's voice as a defect.** Deliberate informality, a joke, an aside — note it only if it will not land with the stated reader.
