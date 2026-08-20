# Registers

One standard, different bars. The tells in `tells.md` are noise everywhere; how hard to cut, and what counts as essential context, depends on who is reading and why.

Each surface below gives the reader and their goal, what the document owes them, the editing bar, and **the failure mode specific to that surface** — the mistake an editor makes here and nowhere else.

---

## Chat reply

**Reader.** Someone who asked a question thirty seconds ago and is watching a terminal.
**Goal.** Get the answer and act on it.

**Owes them.** The finding in the first sentence. Reasoning after, in descending order of consequence. Nothing else.

**Bar.** The tightest of any surface. Everything above the first informative sentence is cut. No summary at the end. No offer of further work unless there is a genuine fork.

**Specific failure mode: under-cutting.** Chat prose accumulates every tell at once — opener, narration, restated request, trailing offer — because the conversational frame invites them. An editor who removes the obvious opener and stops has done a tenth of the job.

**Structural rule.** If the reply contains a recommendation, it goes first, not after the analysis that produced it. The reader can stop reading at any point; anything they must have should be above the fold.

---

## README

**Reader.** A stranger deciding, in about ninety seconds, whether this project is worth their time.
**Goal.** Determine what it does, whether it fits, and how to try it.

**Owes them.** What the thing is, in one sentence, before anything else. Then why it exists, install, and a real example that runs.

**Bar.** Moderate. Cut tells and fog; keep orientation.

**Specific failure mode: over-cutting.** The editor is usually deep in the project and finds the context obvious, so the sentence explaining what the thing *is* looks like filler and gets removed. It is the most important sentence in the file. A README edited to chat density is unusable, because its reader has none of the shared context a chat reply can assume.

**Structural rule.** Example code beats prose describing what the example would do. If a paragraph explains an API, check whether four lines of usage would replace it.

---

## Design doc / ADR

**Reader.** Someone deciding whether to approve, or someone in two years asking why this is the way it is.
**Goal.** Understand the decision and its reasoning well enough to accept or revisit it.

**Owes them.** The decision, the constraints, the alternatives considered, and why each lost.

**Bar.** Light on content, normal on prose. Cut fog aggressively; cut content almost never.

**Specific failure mode: cutting the alternatives.** "We considered a queue-based approach and rejected it because…" has the shape of throat-clearing — hedging, discursive, about something that did not happen. It is the highest-value content in the document, and the reason ADRs exist. Deleting it turns a decision record into an announcement.

Also preserve: stated constraints that later look obvious, the date and status, and anything phrased as "at the time we believed X". Those exist to be re-read after they stop being true.

---

## PR description

**Reader.** A reviewer who has not seen the branch.
**Goal.** Know what problem this solves and where to look hard.

**Owes them.** The problem, the approach and what was rejected, what deserves scrutiny, and how it was verified.

**Bar.** Tight. This is closer to chat than to a README.

**Specific failure mode: restating the diff.** A file-by-file walkthrough duplicates what GitHub already renders. Cut it entirely; the space belongs to the *why*.

Format and `gh` mechanics belong to `git-workflow:git-workflow` — defer to it rather than re-deriving them.

---

## Commit message

Owned by `git-workflow:git-workflow`. It holds the Conventional Commits format, the subject rules, and the body-explains-why convention.

The one thing worth repeating here, because it is a prose failure rather than a format one: **a body that paraphrases the diff is noise.** "Changed the timeout from 30 to 60" is already visible in the patch. "The upstream API's p99 moved past 30s after their October migration" is not, and is the only reason the commit exists.

---

## Release notes / changelog

**Reader.** A user deciding whether to upgrade, or debugging something that broke after they did.
**Goal.** Find what changed for *them*.

**Owes them.** User-visible consequences, breaking changes first and unmissable, migration steps.

**Bar.** Tight, with one exception: never compress a breaking change.

**Specific failure mode: writing from the committer's perspective.** "Refactored the token store" tells the reader nothing. "Sessions now expire after 24h instead of 7 days" is the same change described in terms of what they will notice.

---

## API docs / docstrings

**Reader.** A developer at a call site, mid-task, with the signature already in front of them.
**Goal.** Get the parameter, the return, the failure modes, and the gotcha.

**Owes them.** What it does, what it returns, what it throws, and any non-obvious constraint — thread safety, idempotence, ordering, whether it mutates its argument.

**Bar.** Precision over concision. This is the one register where a longer sentence is often the right edit.

**Specific failure mode: eleganting away the edge cases.** "Returns the user" is cleaner than "Returns the user, or `None` if the ID is well-formed but unknown; raises `ValueError` on a malformed ID." The second is correct. Never trade a documented failure mode for a shorter sentence.

Also: do not restate the signature in prose. `def get_user(user_id: UUID) -> User | None` does not need "Takes a user_id parameter of type UUID."

---

## Code comments

**Reader.** Whoever is editing this function next, probably at speed.
**Goal.** Not break something invisible.

**Owes them.** Only the *why* the code cannot state itself — a workaround and its upstream bug, a non-obvious ordering constraint, a deliberate deviation from the surrounding pattern.

**Bar.** Delete-first.

**Specific failure mode: editing a comment that should be deleted.** A comment restating what the line does is not a style problem to be tightened; it is redundancy to be removed. Improving its prose entrenches it.

The exception to delete-first: a comment explaining a workaround, a race, or a "yes, this looks wrong, here is why it is not". Those are load-bearing and get preserved even when clumsily written — clarify, never cut.

---

## Error messages and UI copy

**Reader.** Someone whose task just failed, in a bad mood, possibly under time pressure.
**Goal.** Understand what happened and what to do next.

**Owes them.** What failed, why, and the next action. Specific over reassuring.

**Bar.** Clarity beats concision at every point of failure. Style is worth nothing here.

**Specific failure mode: editing for elegance.** "Something went wrong" is shorter and worse than "Could not write to `/etc/app/config.yml`: permission denied. Run with sudo, or set `APP_CONFIG` to a writable path."

Never make an error message friendlier at the cost of the detail someone needs to fix it. Never apologize where an actionable instruction would fit.

---

## Cross-cutting

**When the register is unclear**, ask rather than guess. The same paragraph gets three different correct edits depending on whether it is a chat reply, a README section, or an ADR, and a confidently wrong register produces a confidently wrong edit.

**When a document mixes registers** — a README containing an embedded design rationale, a PR body quoting an error message — edit each part to its own bar. The quoted error message is not edited at all.
