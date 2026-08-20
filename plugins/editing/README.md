# editing

A Claude Code plugin that edits prose — Claude's own replies, and the documents Claude writes — by deleting what carries no information and rebuilding what does.

## What It Does

The premise: two different failures produce most bad writing, and they need opposite treatments.

**Noise** is text occupying space without carrying information — praise for the question, narration of what is about to happen, claims about how carefully the writer thought. Noise is deleted. No amount of restructuring improves a sentence that should not exist.

**Fog** is real content buried in the wrong grammar — the actor missing from the subject, the action trapped inside a noun, the point stranded mid-sentence instead of at its end. Fog is restructured. The information survives; only its shape changes.

Adds an auto-triggering knowledge skill, a procedure skill, two commands, and one agent:

- **The tell catalog** — sixteen constructions that mark prose as machine-written, each with a worked before/after, why it reads that way, and the case where it is genuinely correct
- **The clarity moves** — Williams' framework in full: characters into subjects, actions out of nominalizations, subject–verb proximity, the old-to-new flow that makes paragraphs cohere, and stress position
- **The never-invent gates** — the rules that stop an edit from becoming a fabrication, which is the specific way a model fails at this task and a human editor does not
- **Register** — per-surface bars for chat replies, READMEs, ADRs, PR bodies, release notes, docstrings, comments, and error messages, each with the editing mistake specific to that surface
- **`/editing:edit`** — runs the two-pass edit over a file, a passage, or the last reply, and reports every cut
- **`/editing:critique`** — spawns a cold reader over a document and returns findings, changing nothing

## No Hook Can Edit a Chat Message

This is the constraint that shapes the plugin, and it is worth stating plainly because the obvious design does not work.

You cannot intercept Claude's reply and fix it before you read it. `Stop` fires **after** the message is already on screen; blocking it does not retract anything, it only makes Claude append a correction underneath the original. There is no `PreMessage` event. The text you did not want is text you have already read.

So the plugin does not try. Chat prose is governed by **discipline at composition** — a skill that loads while Claude is drafting — and everything else routes through surfaces where interception is actually possible or where you invoke it yourself.

A `PreToolUse` hook on `Write`/`Edit` for `.md` files *would* work mechanically, and it is deliberately not here. It fires on every documentation edit, including the ninety percent that are fine, and a prose guard that interrupts routine work gets switched off within a day. The line between an edit worth blocking and a fine one is a judgment call, and judgment calls do not belong in a hook that cannot see the document's purpose.

**Its honest limit:** the always-on skill fires on a description match, which is probabilistic. When Claude is writing a README as step nine of an unrelated task, the match is weak and the skill may not load. The commands are the deterministic path.

## The Two Passes

Delete first, then restructure — in that order, because rebuilding a sentence you were about to cut is wasted work.

> **Before.** "Great question! I've gone ahead and taken a careful look at the auth module. The main issue is that the token refresh logic isn't just handling expiry — it's also silently swallowing network errors, which could potentially lead to unexpected behavior down the line. It's worth noting that the implementation of the retry mechanism was done in a way that makes the assumption that all failures are transient."

> **After.** "The auth module's token refresh handles expiry, but it also swallows network errors silently — and the retry logic assumes every failure is transient."

72 words to 24. Pass 1 removed the sycophantic opener, the narrated procedure, the "carefully", the announced significance, and one of two stacked hedges. Pass 2 turned "the implementation … was done in a way that makes the assumption" into "assumes" and moved the finding to the front.

Nothing was added. Both claims survive, and that second property is the one the whole plugin is built to protect.

## The Failure Mode Is Fabrication, Not Verbosity

An LLM editor fails differently from a human editor, and the gates exist for the machine failure rather than the human one.

A human editor asked to make prose concrete does not invent a number. A model asked to make prose concrete **will** — "significantly faster" becomes "3× faster" because the concrete version is better writing and the specific figure is the cheapest way to produce it. The rule that says *prefer concrete over abstract* actively creates this temptation, so it ships with the counter-rule attached:

| Gate | Rule |
|---|---|
| **Never add a claim** | The edited text may assert nothing the draft did not assert. |
| **Never invent a specific** | If the number is not in the draft, flag the vagueness as a question. Do not supply a figure. |
| **Never delete a real hedge** | "This probably fixes the race" becomes a lie as "This fixes the race". |
| **Never drop a qualifier** | "on Linux", "for authenticated users", "since 3.2" — scope conditions look like clutter and are load-bearing. |
| **Never synonym a term of art** | "idempotent" does not become "repeatable". Precision reads as jargon and is not. |
| **Never touch quoted material** | Code, identifiers, error strings, command lines, and anything the user wrote. |
| **Preserve rejected alternatives** | In an ADR, "we considered X and rejected it" is the document's most valuable content, and it has the shape of throat-clearing. |
| **Report the cut** | A silent deletion the author never notices is the worst outcome of an edit pass. |

Every edit pass ends with a cut list for this reason. An edit you cannot audit is a rewrite.

## One Standard, Different Bars

The tells are noise everywhere. How hard to cut is not the same everywhere, and each surface has an editing mistake that belongs to it alone:

| Surface | Specific failure mode |
|---|---|
| **Chat reply** | Under-cutting. Every tell arrives at once here; removing the opener and stopping is a tenth of the job. |
| **README** | Over-cutting. The sentence explaining what the thing *is* looks obvious to a maintainer and is the most important line in the file. |
| **Design doc / ADR** | Deleting the alternatives. They read as discursive hedging and they are the reason the document exists. |
| **API docs** | Eleganting away the edge cases. "Returns the user" is cleaner and wrong. |
| **Code comments** | Editing a comment that should be deleted. Improving its prose entrenches it. |
| **Error messages** | Editing for elegance. "Something went wrong" is shorter and useless. |
| **PR body / commit message** | Restating the diff — and these belong to `git-workflow` anyway, which this plugin defers to rather than duplicating. |

## Why There Is No Configuration

No settings file, no per-project voice, no tunable aggressiveness. Three reasons.

The standard is about **information content**, not taste — a sentence praising the question is noise in every voice, and a nominalization hides its actor regardless of register. There is not much left to configure once the rules are only about what carries meaning.

Register already handles the real variation, and it is derived from the document rather than declared in a config file that will drift out of date.

And `CLAUDE.md` is the existing, working mechanism for project-specific voice. It outranks this skill by design, which is stated in the skill itself. Adding a second, competing configuration surface would produce two sources of truth for the same question.

## What It Deliberately Does Not Do

- **Impose a house voice on your writing.** On text you wrote, it removes noise and fog and leaves your register, humor, and rhythm alone. On text Claude wrote, it cuts hard.
- **Fact-check.** Claims that look false are reported as correctness findings and left in place. Correcting them requires knowing the truth, which is a different task with a different failure mode.
- **Copyedit.** Commas, hyphenation, and typography are not addressed. This is line editing.
- **Edit anyone else's published writing** without a stated reason.

## Invocation Names

Everything a plugin ships is namespaced, and **skills have no bare-name fallback.** The two skills are addressable only as `editing:editing` and `editing:edit-pass`; the agent as `editing:prose-critic`.

Commands are namespaced the same way. `/editing:edit` is always valid; the bare `/edit` is only what the `/` menu offers when nothing else claims the name.

## Installation

```
/plugin marketplace add bobtat/claude-plugins
/plugin install editing@bobtat-plugins
```

Or test locally:

```bash
claude --plugin-dir C:\Users\Robert\Documents\GitHub\claude-plugins\plugins\editing
```

**Requirements:** none. Markdown only — no hooks, no scripts, no external tools.

## Usage

The skill triggers on its own whenever Claude is writing prose a person will read, and on requests like:

- "Edit this"
- "Tighten this paragraph"
- "Cut the fluff"
- "Make this less AI"
- "This reads like ChatGPT"
- "Review my writing"
- "This is too wordy"
- "Rewrite this section"

The commands are explicit:

```
/editing:edit                         # edit the last reply
/editing:edit README.md               # edit a file
/editing:edit docs/adr/0007.md#Alternatives   # edit one section
```

```
/editing:critique README.md           # findings only, nothing changed
```

`/editing:edit` **proposes rather than applies** when the text is yours, and when the pass would cut more than about half of it. On Claude's own drafts it edits directly and reports the cuts.

## Structure

```
editing/
├── .claude-plugin/plugin.json
├── commands/
│   ├── edit.md                                # Orchestrates the two-pass edit, gates, and cut list
│   └── critique.md                            # Delegates a cold read to the agent; forbids edits
├── agents/
│   └── prose-critic.md                        # sonnet — reads cold, reports findings, never rewrites
├── skills/
│   ├── editing/
│   │   ├── SKILL.md                           # The standard: two passes, gates, register
│   │   └── references/
│   │       ├── tells.md                       # 16 tells, each with its legitimate case
│   │       ├── craft.md                       # Williams' clarity moves in full
│   │       ├── registers.md                   # Per-surface bars and failure modes
│   │       └── sources.md                     # Provenance, synthesis, departures, gaps
│   └── edit-pass/
│       └── SKILL.md                           # The five-phase procedure for one document
├── LICENSE
└── README.md
```

## Sources

`skills/editing/references/sources.md` records where each rule comes from — Williams for the clarity framework, Haviland and Clark for old-to-new information flow, Zinsser and Gowers for clutter, Nielsen for scanning behavior — along with the three places this plugin deliberately departs from a source it cites, and the parts that are its own synthesis. The tell catalog is the largest of those: no citable canon exists for it, because the phenomenon is newer than every style guide involved.

## License

MIT
