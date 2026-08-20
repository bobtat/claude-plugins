# Clarity Moves

Pass 1 deletes what should not exist. This is Pass 2: rebuilding what remains so it says its thing on the first read.

The organizing idea, from Joseph Williams: **readers judge prose as clear when its grammar matches its story.** A story has characters doing things. A clear sentence puts the characters in the subjects and their actions in the verbs. Almost every "somehow hard to read" sentence has broken one of those two correspondences, and almost every fix restores it.

---

## 1. Characters into subjects

**The diagnosis.** Find the sentence's real actor. If it is not the grammatical subject, that is the problem.

| Before | After |
|---|---|
| "The implementation of the retry mechanism was done by the platform team." | "The platform team implemented retry." |
| "There was a failure of the validation step." | "Validation failed." |
| "It is required that all requests include a trace header." | "Every request must include a trace header." |
| "Consideration was given to three approaches." | "We considered three approaches." |

**Two habitual offenders.** Sentences opening with *There is / There are / There was* and with *It is / It was* almost always have the real subject buried a few words later. They are not always wrong — "There are four cases" is fine as an enumeration frame — but they are worth checking every time.

**The missing-actor case.** Sometimes the actor is genuinely absent from the draft: "Mistakes were made." Do not invent one. Either flag it — *who?* — or leave the passive and note it. Inserting a plausible actor is fabrication.

---

## 2. Actions out of nouns

A **nominalization** is a verb wearing a noun costume: *implement → implementation*, *assume → assumption*, *decide → decision*, *fail → failure*, *validate → validation*, *utilize → utilization*, *analyze → analysis*, *react → reaction*.

Nominalizations are the single largest source of fog in technical writing, because they let a sentence describe an action without anyone performing it.

| Before | After |
|---|---|
| "makes the assumption that all failures are transient" | "assumes every failure is transient" |
| "performs a validation of the payload" | "validates the payload" |
| "the utilization of the cache is low" | "little of the cache is used" |
| "provides an improvement in latency" | "cuts latency" |
| "conducted an analysis of the logs" | "read the logs" |
| "there is a dependency on the auth service" | "this depends on the auth service" |
| "the decision was made to defer the migration" | "we deferred the migration" |

**The recovery pattern.** Find the nominalization, ask who does it, then rebuild: `<who> <verb> <what>`.

**When a nominalization is right.** Three cases, and they are common enough to matter:

- **It names a known thing rather than an action.** "The 3.2 migration", "the retry implementation in `client.go`" — these are objects the reader can point at.
- **It refers back to a previous sentence.** "…so the cache is cleared on every deploy. **That invalidation** is where the 2s p99 comes from." The nominalization is doing cohesion work, packaging the prior clause so the new sentence can build on it. Removing it costs more than it saves.
- **It is the established term.** "Serialization", "authentication", "garbage collection" are the names of the concepts. Verbing them produces worse prose, not better.

---

## 3. Keep the subject short and the verb early

A reader holds the subject in working memory until the verb arrives. A long subject makes them hold it longer, and comprehension drops.

**Before.** "The service responsible for refreshing OAuth tokens and cleaning up expired sessions on a fixed schedule **fails** when the identity provider returns a 503."

**After.** "Token refresh **fails** when the identity provider returns a 503. The same service also cleans up expired sessions on a schedule."

The fix is usually to move the long modifier out into its own sentence, not to shorten it in place — the detail was probably worth keeping, just not there.

---

## 4. Old information first, new information last

This is the rule that makes paragraphs cohere, and it is invisible until violated.

Each sentence should **begin** with something the reader already has and **end** with what is new. The end of a sentence is its stress position; whatever sits there is what the reader takes away.

**Before.**
> "A persistent cache layer would fix this. Cold caches on every deploy are the cause of the elevated p99. Forty deploys a day happen in this service."

**After.**
> "This service deploys about forty times a day, and every deploy invalidates the cache. Those cold caches are what drives the elevated p99 — which a persistent cache layer would fix."

Same three facts. The second version links each sentence to the one before it, and lands the recommendation in the final stress position where it belongs.

**Practical test.** Read only the first few words of each consecutive sentence. If they connect to what came before, the paragraph will feel like an argument. If each one starts on a new subject, it will feel like a list of facts, which is exactly the sensation bullet sprawl produces in prose form.

---

## 5. Put the point where it will be read

- **In a sentence**, the point goes at the end (stress position).
- **In a paragraph**, the point goes in the first or last sentence — first for technical writing, where readers scan.
- **In a document**, the point goes at the top. Findings first, then evidence. The mystery-novel structure that saves the conclusion for the end is wrong for anything a reader might stop reading halfway through.

**Before.** "After looking at the query plan, checking the indexes, and running EXPLAIN on the slow endpoint, it turns out there's a missing index on `orders.customer_id`."

**After.** "`orders.customer_id` has no index. The query plan on the slow endpoint confirms a sequential scan."

---

## 6. Parallelism

Items in a series take the same grammatical form. Broken parallelism makes a reader re-parse.

**Before.** "The migration adds an index, the `status` column is renamed, and backfilling of old rows."
**After.** "The migration adds an index, renames the `status` column, and backfills old rows."

This applies to bullet lists, headings, and table cells as much as to sentences. A list whose items alternate between noun phrases and full clauses reads as unedited even when each item is individually fine.

---

## 7. Passive voice, honestly

Passive voice is not a defect. It is a tool with two legitimate uses and one abuse.

**Legitimate — the actor is unknown or irrelevant.**
"The record was deleted at 04:12." (We do not know by what; that is the finding.)
"The endpoint is called roughly 400 times a second." (By whom does not matter.)

**Legitimate — the passive puts old information first.**
"We introduced a retry layer in 3.1. **It was removed** in 3.4 after the thundering-herd incident." Active voice here ("The platform team removed it") would push the known subject out of the opening slot and break the cohesion chain from §4.

**The abuse — hiding an actor who matters.**
"Mistakes were made." · "The decision was taken to skip the review." When the reader needs to know who, the passive conceals it. That is the case to convert.

**The edit rule.** Do not convert passive to active on sight. Ask whether the actor matters to the reader. If yes and it is in the draft, convert. If yes and it is *not* in the draft, flag it as a question rather than inventing one.

---

## 8. Cut what the sentence already implies

Redundant pairs and category words survive in drafts because they sound complete.

| Before | After |
|---|---|
| "each and every" | "every" |
| "first and foremost" | "first" |
| "completely eliminate" | "eliminate" |
| "advance planning" | "planning" |
| "in the field of security" | "in security" |
| "of a technical nature" | "technical" |
| "a period of two weeks" | "two weeks" |
| "the reason is because" | "because" |
| "very unique" | "unique" |

---

## 9. Sentence length is a rhythm problem, not a rule

There is no correct sentence length. There is a correct *variance*. A paragraph of uniformly short sentences reads as staccato and slightly hostile; a paragraph of uniformly long ones is exhausting. Prose reads well when a long sentence that does real work is followed by a short one that lands the point.

Do not enforce a maximum. Do check whether a 60-word sentence contains two ideas that would each be clearer alone — usually it does, and the split is the fix, not the trimming.

---

## Order of operations

Applied to one sentence, the moves have a natural sequence:

1. **Find the actor.** Who or what is doing something?
2. **Find the action.** Is it in the verb, or trapped in a noun?
3. **Rebuild:** `<actor> <verb> <object>`, keeping every qualifier.
4. **Check the opening.** Does the sentence start from something the reader already has?
5. **Check the ending.** Is the new information — the point — in the final position?
6. **Verify nothing changed.** Read old and new side by side. Every claim, hedge, and scope condition still present?

Step 6 is not optional. A rebuilt sentence is a new sentence, and new sentences are where claims the author never made get in.
