# Sources, Synthesis, and Known Gaps

## Where the Conventions Come From

**The clarity framework** — Joseph M. Williams, *Style: Lessons in Clarity and Grace* (first published 1981 as *Style: Ten Lessons in Clarity and Grace*; later editions with Joseph Bizup). Nearly all of `craft.md` is Williams: characters into subjects, actions into verbs, the diagnosis of nominalization as the primary source of unclear professional prose, subject–verb proximity, metadiscourse, and the old-to-new information flow. His central claim — that readers judge prose clear when its grammar matches the story it tells — is the organizing idea of this whole skill.

**Old-to-new information flow** — Williams draws it from psycholinguistics, specifically the *given/new contract* described by Susan Haviland and Herbert Clark (1974). The finding is that comprehension is measurably faster when a sentence opens with information the reader already holds. The stress-position rule (new information lands at the end of the sentence) is the same principle read from the other end.

**Cutting clutter** — William Zinsser, *On Writing Well* (1976). The redundant-pair and long-function-word tables in `craft.md` §8 and `tells.md` §15 are in the tradition Zinsser and, before him, Sir Ernest Gowers (*Plain Words*, 1948; *The Complete Plain Words*, 1954) established for administrative and journalistic prose.

**"Omit needless words"** — Strunk and White, *The Elements of Style*. Used here only for that principle.

**Caveat on Strunk and White:** its grammatical advice is not reliable, and this skill deliberately departs from it in one visible place. The book's passive-voice guidance is the well-known example — Geoffrey Pullum's *[50 Years of Stupid Grammar Advice](https://www.chronicle.com/article/50-years-of-stupid-grammar-advice/)* (2009) documents that several sentences White offers as passives are not passive at all. The treatment of passive voice in `craft.md` §7 follows Pullum and Williams rather than Strunk and White: passive is a tool with legitimate uses, not a defect to be eliminated on sight.

**Documentation register** — the per-surface expectations in `registers.md` for API docs, error messages, and release notes are consistent with the [Google developer documentation style guide](https://developers.google.com/style) and the [Microsoft Writing Style Guide](https://learn.microsoft.com/en-us/style-guide/welcome/). Neither is followed as a house style here; they are the reference points for what each document type conventionally owes its reader.

**Readers scan rather than read** — Jakob Nielsen, *[How Users Read on the Web](https://www.nngroup.com/articles/how-users-read-on-the-web/)* (1997) and subsequent Nielsen Norman Group eye-tracking work. This is the basis for findings-first structure and for the claim in `tells.md` §13 that emphasis only works differentially.

## This Plugin's Own Synthesis

Not sourced from anywhere in particular; assembled here because no one place holds it:

- **The tell catalog.** There is no canonical, citable list of the constructions that mark machine-written prose — the phenomenon is newer than every style guide above. The sixteen entries in `tells.md` are drawn from observed patterns in LLM output, and several were codified from this repository owner's own `CLAUDE.md` instructions: the ban on manufactured trade-offs (§9), on self-commentary about reasoning quality (§3), and on restating the request (§4). Treat the catalog as a working list, not a finished taxonomy.
- **The noise/fog split** as the organizing distinction, and the rule that deletion strictly precedes restructuring. Both passes are conventional; sequencing them explicitly, and justifying the order by wasted-work avoidance, is this plugin's framing.
- **The never-invent gates.** The rules against adding claims, deleting real hedges, and dropping scope qualifiers exist because an LLM editor's characteristic failure is *not* the human editor's. A human editor rarely fabricates a number to make a sentence concrete; a model asked to make prose concrete will. The gate in `tells.md` §16 exists specifically to block a temptation the rest of that file creates.
- **The register table** and the per-surface failure modes. The observation that each document type has a *characteristic editing error* — README over-cutting, ADR alternative-deletion, API-doc edge-case elegance, error-message friendliness — is the useful part, and is this plugin's own.
- **The "when it is correct" column throughout `tells.md`.** Borrowed in form from this marketplace's `refactoring` and `git-workflow` plugins, on the same view: a rule without its exceptions produces confident misapplication.
- **The chat-reply register.** Not a documented genre anywhere. The three-question pre-send check is a synthesis of findings-first structure with the specific failure modes of conversational LLM output.

## Deliberate Departures

Where this skill contradicts a source it cites:

- **Passive voice is permitted** (Strunk and White say avoid it; Williams and Pullum say use it when the actor is unknown, irrelevant, or when it serves cohesion — this skill follows the latter).
- **Em dashes are defended** rather than treated as an AI marker. The tic is the withheld-reveal rhythm, not the punctuation mark, and blanket dash-avoidance produces stilted prose.
- **Concision loses to precision in two registers** — API documentation and error messages — against the general thrust of every source above.

## Known Gaps

Deliberately not covered:

- **The user's own voice as a target.** This skill edits for noise and fog. It does not impose a house voice on writing the user authored, and it has no opinion on whether their prose should be warm or clipped.
- **Configurability.** There is no per-project settings file. The standard is one standard; a project needing a different voice should say so in its `CLAUDE.md`, which outranks this skill.
- **Non-English prose.** Every rule here is about English grammar and information structure. The nominalization and word-order guidance does not transfer.
- **Narrative, marketing, and persuasive writing.** Different genres with different rules — suspense structure, repetition for emphasis, and deliberate rhythm are defects here and tools there.
- **Plain-language and accessibility standards.** Reading-level targets, [plainlanguage.gov](https://www.plainlanguage.gov/) guidelines, and WCAG-adjacent content requirements are a real discipline this skill does not implement.
- **Academic and legal style.** APA, Chicago, and citation practice; contractual precision, where redundancy is often deliberate.
- **Localization and internationalization.** Idiom that will not translate, string-length constraints, and translator-facing source-text rules.
- **Grammar and mechanics.** Comma placement, hyphenation, and typography are not addressed. Those are copyediting; this is line editing.
- **Fact-checking.** `editing:edit-pass` flags claims that look false and does not correct them. Verifying them is a different task.

## What Is Untested

The tell catalog is the part most likely to age. It describes the output characteristics of current models; as those change, entries will become obsolete and new patterns will not be here. The `craft.md` material is forty years old and stable, and the register expectations change on the timescale of documentation culture rather than model releases.
