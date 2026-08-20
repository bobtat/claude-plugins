---
description: Run a two-pass edit over a draft — delete the noise, fix the fog, and report every cut
argument-hint: [file path, or a pasted passage] (defaults to the last reply)
allowed-tools: Agent, Read, Write, Edit, Grep, Glob, Skill, TodoWrite
---

## Task

Edit the target so it says the same things in fewer, clearer words — and prove that it still says the same things.

**Load the `editing:edit-pass` skill now** and follow its five phases. Load `editing:editing` for the standard itself: the tell catalog in `references/tells.md`, the clarity moves in `references/craft.md`, and the per-surface bar in `references/registers.md`. This plugin's skills and agents are addressed as `editing:<name>`; there is no bare-name fallback.

## Resolving the target

`$ARGUMENTS` decides what gets edited:

| Argument | Target |
|---|---|
| A file path | That file. Read it whole before editing. |
| A path plus a section or heading | Only that section. Leave the rest of the file untouched and say so. |
| Pasted text | The passage as given. Return the edited version; do not write it anywhere. |
| Empty | The last assistant reply in this conversation. |

If the argument names a file that does not exist, or is ambiguous between a path and a passage, ask rather than guessing.

## Authorship changes what you may do

Establish this in Phase 1 and let it govern everything after:

- **Claude wrote it** (a draft from this session, a doc Claude generated) — edit directly and report the cuts.
- **The user wrote it** — propose. Show the edited version and the cut list; do not overwrite the file until they accept. The exception is an explicit "just fix it" in the arguments.
- **Someone else wrote it** (a vendored README, a dependency's docs, another contributor's PR body) — do not edit. Say what you would change and stop.

## Scale

- **Under ~500 words** — do the whole pass inline.
- **Over ~500 words, or a document with real structure** — track the phases with TodoWrite, and consider spawning `editing:prose-critic` for a cold read *before* editing. A reader who has not been staring at the draft catches structural problems that a line-by-line pass does not.
- **Over ~3,000 words** — spawn `editing:prose-critic` first, work from its findings, and edit section by section rather than in one pass.

## Hard rules

- **Never add a claim the draft does not make.** Including numbers, comparisons, and confidence the author did not express.
- **Never invent a specific to satisfy "be concrete."** If the figure is not in the draft, flag the vagueness as a question instead.
- **Never delete a hedge that encodes real uncertainty**, and never drop a scope qualifier — "on Linux", "for authenticated users", "since 3.2".
- **Never touch code, quoted text, identifiers, error strings, command lines, or file paths.** Prose *about* them is in scope; they are not.
- **Never cut rejected alternatives from a design doc or ADR.** That is the document's reason for existing.
- **Never silently drop something arguable.** Every non-trivial deletion appears in the cut list.
- **Never rewrite the user's voice.** Remove noise and fog; leave the person's register, humor, and rhythm alone.
- **Never report a word count you did not compute**, and never claim meaning was preserved without having compared the versions clause by clause.

## Gates

Stop and show the work before applying when:

- The pass would cut **more than roughly half** of a document the user wrote.
- A **structural change** (reordering sections, merging them, moving the conclusion) is warranted in someone else's document.
- A claim in the draft **appears to be false** — report it as a correctness finding, do not edit around it.
- A sentence's **meaning is unclear** and fixing it requires guessing the intent.

## Report

End with:

- **Size delta** — word count before and after.
- **The cut list** — everything removed that carried arguable content, with a one-line reason each. Pure noise deletions are given as a count by category, not enumerated.
- **Restructures** — sentences rebuilt, and what moved. Not every sentence; the ones where the change was more than mechanical.
- **Left alone deliberately** — anything that looks editable but was preserved, and why.
- **Open questions** — unclear meanings, claims that look wrong, and any place an audience assumption drove a judgment call.
- Where the edit was **proposed rather than applied**, say plainly that the file is unchanged.
