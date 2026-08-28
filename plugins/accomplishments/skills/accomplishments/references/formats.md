# Output Formats

Four readers, four different documents, one journal behind all of them. Each
section says who reads it, what they need, and the mistake specific to it.

## Self-assessment (performance review)

**Reader:** your manager, writing their own assessment of you, usually against
a competency framework, usually under time pressure and calibrating you
against peers they know better than they know your work.

**What they need:** evidence they can quote in a calibration meeting where you
are not present. Their constraint is not persuasion, it is *defensibility* —
they must be able to answer "what did they actually do?" from your document.

**Shape:**

- Organize by **theme**, not chronology. Three to five themes for a year.
  "Reliability," "the SSO migration," "mentoring." A dated list makes the
  reader do the synthesis, and they will not.
- Lead each theme with the outcome, then the evidence, then your specific role.
- Map to the framework's language when the company has one. Not as decoration:
  if the ladder says "influences beyond own team," the theme that does that
  should say so and cite the instance.
- Include one thing that did not work, with what changed as a result. It buys
  credibility for everything else, and its absence is conspicuous.
- Length: shorter than you think. Dense and specific beats long.

**The mistake:** writing a status report. A chronological list of everything
you did, with no claim about which parts mattered, hands the reader the
hardest task in the document. Sort by impact and say so.

## Promotion packet

**Reader:** a committee, often including people who have never met you and do
not know your systems, reading many packets in one sitting.

**What they need:** evidence that you are **already operating** at the next
level, consistently, over time. Promotion is nearly always recognition of
current behavior, not a bet on future behavior.

**Shape:**

- Organize by the **next level's criteria**, one section each. Not by project.
- Each criterion needs **multiple instances across time** — one brilliant
  quarter reads as a spike, three quarters read as a level.
- Scope claims must be legible to an outsider. "Unblocked data-eng, platform,
  and billing" travels; "fixed the reconcile loop" does not.
- Include others' words verbatim where you have them.
- Name the counterfactual on the biggest items.

**The mistake:** arguing from effort and tenure. "I have worked very hard for
two years" is not an argument the committee can act on. The document has to
show the *behavior* the next level describes, in specific instances, more than
once.

## Resume and LinkedIn bullets

**Reader:** a recruiter for six seconds, then an engineer for sixty.

**What they need:** scope and result, fast, with no internal vocabulary.

**Shape:** one line, past tense, roughly *action — object — result*, leading
with the strongest true element.

> Cut nightly customer sync from 40 minutes to 6 by batching a per-row lookup,
> unblocking three downstream data teams.

- Translate every internal name. "Migrated Fizzbot to Widgetflow" is unreadable
  outside the company; "migrated the billing pipeline to the new event bus" is
  not.
- Numbers when they exist and are cleared for external use, never invented to
  fill the slot. A bullet with no number is normal.
- No "responsible for." Responsibilities describe a job description; results
  describe you.

**The mistake specific to this format is confidentiality.** These leave the
company. Customer names, unannounced products, internal financials, security
findings, and headcount are cleared explicitly with the user or generalized:
"a top-five customer," "a payments provider," "a seven-figure contract."

## Weekly and standup rollups

**Reader:** you, your manager, or your team, this week.

**What they need:** what moved, what is blocked, in under a minute.

**Shape:** three to six lines. What shipped, what is in flight, what is stuck
and on whom.

**The value is secondary.** Rollups are useful in themselves, but their real
function here is that writing one produces journal entries as a side effect,
at the moment the details are still recoverable. A habit that pays off weekly
survives; a habit that only pays off annually does not.

**The mistake:** treating the rollup as the record. It is a byproduct. If
something in the week was genuinely significant, it gets its own journal entry
with impact and evidence, not just a line in a weekly summary that nobody will
open again.

## What every format shares

- **Same underlying facts.** The journal is the source; formats are views. If
  a claim is in the packet but not the journal, it needs evidence before it
  ships, not after.
- **No number without a source.** Enforced upstream by the entry format; do
  not let it relax at authoring time.
- **The user's voice.** Match how they write. A document that does not sound
  like them is a document they will have to defend in a conversation where
  they sound different from it.
- **Say what is thin.** If a theme rests on one entry from March, say so and
  ask, rather than padding it into a paragraph that looks like more.
