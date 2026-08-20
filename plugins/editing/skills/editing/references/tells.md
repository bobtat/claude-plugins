# The Tells

Constructions that mark prose as machine-written. Each entry gives the pattern, a worked example, why it reads the way it does, and — the part most style guides omit — **the case where it is actually correct**. A rule applied without its exception produces a different kind of bad writing.

These are deletions, not rewrites. If a sentence's only content is one of these patterns, the sentence goes.

---

## 1. The sycophantic opener

**Pattern.** "Great question!" · "Great catch!" · "Absolutely!" · "You're absolutely right!" · "What a fascinating problem."

**Before.** "Great question! The reason the cache misses is that the key includes a timestamp."
**After.** "The cache misses because the key includes a timestamp."

**Why it reads as machine-written.** It evaluates the prompt instead of answering it. Humans answering a colleague rarely grade the question first, and when they do it means something — here it means nothing, because it precedes every answer regardless of the question.

**When it is correct.** Never as an opener. Genuine acknowledgment of a real insight belongs in the body and names the insight: "The timestamp in the key is the part everyone misses."

---

## 2. Narrated procedure

**Pattern.** "Let me take a look at…" · "I've gone ahead and…" · "First, I'll need to understand…" · "Let me walk you through…" · "Now let's dive into…"

**Before.** "Let me take a look at the config. I've gone ahead and checked the timeout values, and I can see that they're set to 30 seconds."
**After.** "The config sets every timeout to 30 seconds."

**Why it reads as machine-written.** It narrates the process instead of delivering the result. The reader can see that work happened; what they cannot see is the finding, which the narration delays.

**When it is correct.** When the process *is* the content — a tutorial where the reader follows along, or an explanation of how a conclusion was reached because the method is what is in dispute.

---

## 3. Self-commentary on reasoning quality

**Pattern.** "I want to be thorough here" · "carefully analyzing this" · "to be precise" · "after careful consideration" · "I've thought about this deeply."

**Before.** "After carefully considering the options and thinking through the trade-offs thoroughly, my recommendation is Postgres."
**After.** "Use Postgres."

**Why it reads as machine-written.** A claim about the quality of your own thinking is unverifiable and adds no information. Careful reasoning shows up as *correct conclusions and stated assumptions*, never as an assertion of carefulness.

**When it is correct.** When the *limits* of the analysis matter: "I checked the read path only" is not self-praise, it is scope. Say what you did or did not examine; never say how well you did it.

---

## 4. Restating the request

**Pattern.** "So you want to add authentication to your app." · "You're asking about how to configure the linter." · "If I understand correctly, you'd like…"

**Before.** "So you want to know why the build is slow. Let's explore that. The build is slow because the Docker layer cache is invalidated on every run."
**After.** "The build is slow because the Docker layer cache is invalidated on every run."

**Why it reads as machine-written.** The reader wrote the request thirty seconds ago. Reflecting it back is a chatbot conversational move, not a writing one.

**When it is correct.** When the request was genuinely ambiguous and the reading chosen changes the answer: "Taking 'slow' as cold-build time rather than incremental — " is load-bearing disambiguation. The test: would a different reading produce a different answer? If not, cut it.

---

## 5. Announced significance

**Pattern.** "It's worth noting that" · "It's important to note" · "Importantly," · "Keep in mind that" · "Here's the key insight" · "Here's where it gets interesting."

**Before.** "It's important to note that the migration is not reversible."
**After.** "The migration is not reversible."

**Why it reads as machine-written.** Every sentence in a document is there because it was worth writing. Announcing that one is important implies the others are filler, and the frame consumes words that the point could have used.

**When it is correct.** When something genuinely cuts against what the reader just concluded and would otherwise be skimmed past: "The migration is not reversible — despite the `--dry-run` flag suggesting otherwise." The contrast does the work, not the announcement.

---

## 6. Stacked hedges

**Pattern.** "could potentially" · "might possibly" · "it seems like it may be" · "there's a chance this could perhaps."

**Before.** "This could potentially lead to some unexpected behavior in certain cases."
**After.** "This drops writes when two clients reconnect at the same moment."

**Why it reads as machine-written.** Each hedge is a small retreat from commitment. Stacked, they produce a sentence that cannot be wrong because it says nothing. The vagueness on the other end — "unexpected behavior", "certain cases" — usually travels with them.

**When it is correct.** One hedge, when the uncertainty is real and preferably quantified. "This probably drops writes — I have not reproduced it" is honest and useful. The rule is not *never hedge*; it is *never hedge twice about the same thing*, and never hedge to avoid committing to something you actually know.

---

## 7. Inflation by negation

**Pattern.** "not just X, but Y" · "isn't merely X — it's Y" · "goes beyond X" · "more than just X."

**Before.** "This isn't just a performance improvement — it's a fundamental rethinking of how we handle state."
**After.** "This moves state out of the component tree and into the store."

**Why it reads as machine-written.** The construction manufactures significance by first denying a smaller claim nobody made. The negated half is scaffolding; when you delete it, either a real claim remains or there was never one.

**When it is correct.** When the reader has genuinely already concluded X and needs correcting: "This is not just a lint rule — it fails the build." The prior belief has to be real, not invented for the sentence.

---

## 8. Invented triads

**Pattern.** Three parallel items where two are true and the third completes a rhythm. "faster, cleaner, and more maintainable" · "simple, powerful, and flexible" · "robust, scalable, and secure."

**Before.** "The new parser is faster, cleaner, and more maintainable."
**After.** "The new parser runs about 3× faster and drops the mutable-state handling that caused the reentrancy bug."

**Why it reads as machine-written.** English prose has a strong pull toward tricolon, and unconstrained generation follows it. The third item is often the one nobody measured.

**When it is correct.** When there are genuinely three things and you can say what each means. The test: can you defend item three on its own? If it evaporates under that question, it was rhythm.

---

## 9. Manufactured balance

**Pattern.** A drawback attached to every advantage so the analysis reads as even-handed. "It's fast, though it does add a dependency." · "Both approaches have merit."

**Before.** "Postgres is a solid choice, though it does require running a server. SQLite is also viable, though it has limitations under concurrent writes. Both have their trade-offs."
**After.** "Use Postgres. The concurrent-write load here is exactly what SQLite does not do."

**Why it reads as machine-written.** It performs neutrality rather than reaching a conclusion. A caveat invented to balance a paragraph is noise wearing the costume of rigor, and it pushes the decision back to the reader who asked precisely so they would not have to make it.

**When it is correct.** When the trade-off is real and would change the decision under stated conditions. "Postgres, unless this ships to air-gapped laptops — then SQLite" is a genuine fork. State the condition that flips it; if you cannot, there is no trade-off.

---

## 10. The trailing offer

**Pattern.** "Let me know if you'd like me to explain further!" · "Would you like me to implement this?" · "Feel free to ask if anything is unclear!" · "I hope this helps!"

**Before.** "…and that fixes the leak. Let me know if you'd like me to walk through any part of this in more detail, or if you'd like me to apply the change!"
**After.** "…and that fixes the leak."

**Why it reads as machine-written.** It fills the ending with politeness rather than content. The user knows they can ask a follow-up question.

**When it is correct.** When there is a genuine, specific next step and a real decision about whether to take it: "The same bug is in the batch path — want me to fix that too, or is it out of scope?" That is a question with a consequence, not a pleasantry.

---

## 11. The restating summary

**Pattern.** A closing paragraph that recaps a short document. "In summary, we've added X, fixed Y, and updated Z."

**Before.** Three paragraphs describing three changes, followed by: "To summarize, I added the retry logic, fixed the null check, and updated the tests."
**After.** The three paragraphs.

**Why it reads as machine-written.** Summaries exist so a reader who lost the thread can recover it. Over 200 words nobody lost the thread, so the recap only repeats what is still visible on screen.

**When it is correct.** At real length — a long design doc, a multi-section report — and best placed at the *top* as a lede rather than the bottom as a recap. Also correct when the summary states something the body did not: a recommendation, a decision, a next action.

---

## 12. Bullet sprawl

**Pattern.** Connected reasoning shredded into fragments, losing the connectives that made it an argument.

**Before.**
> - Cache is invalidated on every deploy
> - Deploys happen ~40× per day
> - Cold cache adds 2s to p99
> - Consider a persistent cache layer

**After.** "The cache is invalidated on every deploy, and we deploy about forty times a day — so most requests hit a cold cache, which is where the 2s p99 comes from. A persistent cache layer would fix it."

**Why it reads as machine-written.** Bullets drop the words that carry logical structure — *because*, *so*, *but*, *therefore*. Four facts in a list leave the reader to infer the causal chain; four facts in a sentence state it. The list also flattens hierarchy, presenting the recommendation as a peer of the evidence.

**When it is correct.** Genuinely parallel, order-independent items: config options, requirements, a checklist, alternatives being compared. The test: do the items connect with *and*, or with *because* and *therefore*? The second case is prose.

---

## 13. Emphasis inflation

**Pattern.** Bolding every noun phrase, or bolding whole sentences.

**Why it reads as machine-written.** Emphasis is differential. When a paragraph bolds six phrases, a scanning reader gets no routing information, and the prose acquires a breathless quality.

**When it is correct.** Bold the terms a reader scanning for a specific thing needs to find — usually one or two per paragraph, typically the subject of the paragraph rather than its most exciting adjective. Tables and gate lists tolerate more, because the bolded cell is a label.

---

## 14. The dramatic reversal

**Pattern.** Withholding the point for effect, then revealing it after a dash or a paragraph break — every paragraph. "The tests all passed. But there was a problem."

**Why it reads as machine-written.** Used once, suspense structure is good writing. Used as the default shape of every paragraph it becomes a tic, and in technical prose it inverts the priority: the reader wants the finding first and the setup after.

**When it is correct.** Once per document, for something genuinely counterintuitive. Note that **the em dash itself is not the problem** — joining a clause to its consequence with a dash is ordinary punctuation and appears throughout well-edited prose, including this file. The tell is the withheld-reveal *rhythm*, not the character.

---

## 15. Metadiscourse and long function words

**Pattern.** Phrases that talk about the writing instead of saying it, and multi-word forms of single words.

| Instead of | Write |
|---|---|
| in order to | to |
| due to the fact that | because |
| at this point in time | now |
| in the event that | if |
| has the ability to | can |
| a large number of | many |
| it is possible that | may |
| for the purpose of | for |
| in the process of ~ing | ~ing |
| as previously mentioned | (delete) |
| as we discussed above | (delete) |
| it should be understood that | (delete) |

**When it is correct.** "In order to" occasionally prevents a garden-path reading ("To to" collisions, or where *to* would attach to the wrong verb). Cross-references like "as described in §4" are useful in long documents; "as mentioned above" in a 300-word document is not.

---

## 16. Abstraction where a number was available

**Pattern.** "performance issues" · "significantly faster" · "a number of problems" · "various improvements" · "recently."

**Before.** "This significantly improves performance in most cases."
**After.** "This cuts p99 from 1.2s to 400ms on the orders endpoint."

**Why it reads as machine-written.** Abstraction is the safe default when the specifics are not at hand, and generated prose reaches for it constantly. Concrete numbers are also falsifiable, which is exactly why they carry information.

**When it is correct — and this is the important half.** Only when the specifics exist. **Never invent a number to satisfy this rule.** If the draft says "significantly faster" and you do not know the figure, the correct edit is either to leave it, or to flag it: "*significantly faster* — by how much? A number here would carry the paragraph." Fabricating "3×" to make prose concrete is the single worst failure an editor can commit, and it is the one this rule tempts you into.

---

## Applying the catalog

Work top-down through a draft rather than tell-by-tell through the catalog — a single pass in reading order catches nesting (a narrated procedure inside a sycophantic opener inside a restated request) that sixteen separate passes would fragment.

For each candidate, ask the exception question before deleting: *is this the case where the construction is correct?* Most of the time it is not. The times it is are what separate an edit from a lint rule.
