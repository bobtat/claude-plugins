# Impact, and How to Quantify It Without Inventing It

## The ladder, in more detail

Level is set by **who bears the consequence**, not by how hard the work was or how long it took. This is the correction most people need: effort and impact are only loosely related, and a review that argues from effort loses to one that argues from consequence.

### Task

You completed something assigned to you. The ticket closed. Nobody outside the ticket noticed.

This is the floor, and most work lives here — that is normal and fine. A quarter of solid task-level delivery is a good quarter. The mistake is trying to dress task-level work as something else; reviewers read that instantly and start discounting the rest of the document.

Reads as: "Closed 31 tickets."

### Project

A feature, migration, or system reached its goal, and your work is why it did or why it did on time.

The distinguishing question: *if you had been out for a month, would this have shipped late?* If yes, that is project-level. If someone else would have picked it up with no loss, it is task-level even if it was a lot of work.

Reads as: "Owned the checkout redesign backend; shipped on the committed date."

### Team

You changed what your team can do, or how fast it can do it. The effect outlives the work.

The tell is that the benefit is **recurring and accrues to other people**. A test harness that makes everyone's PRs faster to verify. Documentation that cut onboarding from three weeks to one. A review practice the team kept.

This is the level most under-recorded, because the work rarely has a ticket. Tanya Reilly's "glue work" argument is exactly this: the work that holds a team together is invisible to systems that track tickets, so it must be recorded deliberately or it will not be recorded at all.

Reads as: "Built the seed-data harness; integration suite went from 22 min to 4, for everyone, every run."

### Org

Multiple teams, or a decision above your level. You removed a dependency between teams, set a standard others adopted, or changed a plan.

The tell: **someone who does not report to your manager changed what they were doing because of your work.**

Reads as: "Proposed and drove the shared event schema; three teams stopped maintaining separate parsers."

### Company

Revenue, risk, cost, or strategy moved.

Rare, and often not the biggest engineering effort — a security finding, an outage class eliminated, a contract unblocked. Claim it only with a number or a named consequence a non-engineer would recognize.

Reads as: "Found and fixed the tenant-isolation gap flagged in the SOC 2 audit; blocking finding cleared before the deadline."

## The spread matters more than the peak

A packet where every entry claims org-level impact is discounted as a whole — inflation on any one entry makes a reviewer distrust the rest, including the entries that were accurate.

A strong year looks like a spread: a lot of task and project work, several team-level items, one or two org-level, occasionally something company-level. Reviewers read the shape. A truthful spread with one genuine org-level item beats five inflated claims.

## Quantifying without fabricating

### The rule

**A number is either measured, reported, estimated, or absent. Those are the only four states, and the entry has to say which.**

- **Measured** — you ran it, or read it off a dashboard, and can name the source and date.
- **Reported** — someone told you. Record who and when. Still good evidence.
- **Estimated** — you derived it from something you know. The derivation goes in the entry.
- **Absent** — no number. Write the accomplishment without one. This is always allowed, and it is always better than a plausible invention.

### Honest estimation

An estimate is legitimate when the inputs are real and stated. It becomes a fabrication when the derivation is dropped and only the figure survives.

> **Legitimate.** "The manual reconciliation ran twice a week and took about an hour, per the two people doing it. Automating it saves roughly 100 person-hours a year. (Estimate: 2/wk x 1hr x 2 people x 50 weeks; hours self-reported.)"

> **Fabrication.** "Saved ~100 hours annually."

Identical number. The first can be challenged, corrected, and defended in a room. The second cannot be defended because nobody, including the author six months later, knows where it came from.

Write estimates as: **figure, then the arithmetic, then the weakest input.** The weakest input is what a skeptical reader will attack, so name it first rather than letting them find it.

### When there is no number

Most real accomplishments have no metric, and reaching for one is how fabrication starts. These carry weight without arithmetic:

- **The counterfactual.** "This was the last blocker on the SSO rollout."
- **Named beneficiaries.** "Data-eng's morning jobs now start on time."
- **A durable change of state.** "The 3am queue-depth page stopped firing."
- **Difficulty of detection.** "Two people had looked at it and read it as network latency."
- **Adoption.** "Three teams migrated to it without being asked."

A reviewer can act on every one of these. None of them requires a number.

### Numbers that are almost always available

Cheap, real, and unglamorous — usually better than nothing when a section feels thin. Each is countable from a command or a dashboard, so each can be *measured* rather than guessed:

- Build, test, or CI wall-clock time, before and after
- Page or alert frequency for a specific alert
- Error rate or p50/p99 for a named endpoint
- Support tickets of one category per month
- Reviews given, and to how many distinct authors
- Time from PR open to merge, for the team
- Onboarding time to first merged PR

## The trap: outcomes you did not control

Do not claim revenue, retention, or growth for shipping a feature that correlates with them. The reviewer knows the difference, and claiming it costs more credibility than the number adds.

Claim what you controlled, and name the outcome as context rather than as your result:

> **Overclaim.** "Drove a 12% increase in conversion."
>
> **Defensible.** "Shipped the one-page checkout on the committed date. Conversion rose 12% in the following quarter; the experiment design and the attribution belong to the growth team."

The second is more impressive to anyone who can tell them apart, and it is the version that survives being read aloud in front of the growth team.
