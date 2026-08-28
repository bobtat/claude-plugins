# Interviewing the User

Most people describe their own work in a way that destroys its value. "I just
fixed some bugs" is the single most common answer, and it is almost never an
accurate description of a quarter.

The interview exists because **the impact facts live only in the user's head**
and are not recoverable from any tool. Getting them out is the highest-value
thing this plugin does.

## Rules

- **Ask about one thing at a time.** A list of six questions gets one answer.
- **Ask for the number; accept "I don't know."** The point is to find out
  whether a number exists, not to obtain one. "I don't know" is a complete
  answer and ends that line of questioning permanently.
- **Never suggest the number.** "Did that cut it by about half?" is how a
  fabricated metric gets laundered through the user's agreement. Ask "do you
  know what it was before?" instead.
- **Record their words.** When the user says something well, keep the sentence.
  It is their voice, and it is more defensible than a polished paraphrase.
- **Stop when it is dry.** Three good questions beat ten. An interview that
  feels like an interrogation does not get repeated, and a habit that does not
  get repeated is the failure mode this plugin exists to prevent.

## The questions

Ordered by yield. The first two produce most of the useful material.

### 1. Who noticed?

> "Who else was affected by this — and did anyone say anything about it?"

The highest-yield question in the set. It surfaces the beneficiaries, and it
frequently surfaces a quotable reaction the user had already forgotten. Praise
is the most perishable evidence there is; this question is how it gets caught.

### 2. What would have happened if you hadn't?

> "If you'd never picked this up, what would be different today?"

Establishes the counterfactual, which is the load-bearing element of any
promotion argument. It also cleanly separates maintenance ("someone else would
have done it next week") from real contribution ("nobody had noticed it").

### 3. What was hard about it?

> "Was this straightforward once you knew what to do, or was finding the
> problem the hard part?"

Distinguishes execution from diagnosis. Work where the diagnosis was hard is
routinely under-recorded because the resulting diff is small — a one-line fix
after three days of tracing looks trivial in git and is not.

### 4. Was anything measured?

> "Is there a graph, a log, or a number from before and after?"

Note the phrasing: it asks whether a measurement *exists*, not what it was.
This is the anti-fabrication form of the question. If yes, get the source and
the date. If no, move on and write the entry without one.

### 5. Does it keep paying?

> "Is this a one-time fix, or does it keep helping every week?"

Separates task-level from team-level. Recurring benefit is the tell for the
team tier of the ladder, and users rarely volunteer it.

### 6. Who else worked on it?

> "Was this yours, or shared? What was your specific part?"

Asked plainly, without implying that a shared accomplishment is worth less.
Accurate attribution protects the user — a packet that overclaims a
teammate's work is the fastest way to lose a promotion.

### 7. What did you learn or change?

> "Did this change how you or the team do things afterwards?"

Catches process changes and glue work, which have no ticket and no commit and
are therefore invisible to every mining command.

## Handling "I just fixed some bugs"

Do not accept it, and do not argue with it. Go concrete:

> "Let's take one. Which bug took the longest?"

Then ask questions 1 through 3 about that one. A specific incident produces
detail that a general question never will, and the user usually reconstructs
two or three more once the first is on the table.

## Handling reluctance

Some users are uncomfortable with the whole exercise. Two things help, and
neither is encouragement:

- **Reframe as accuracy, not self-promotion.** The goal is a record that is
  true. Understatement is as inaccurate as overstatement, and it has the same
  cost: a reviewer making a decision on wrong information.
- **Point out that the alternative is a worse record, not no record.** Their
  manager will write an assessment either way. The only question is whether it
  is written from evidence.

Do not push past a second refusal. Log what was said, mark the entry
`unverified`, and move on. An incomplete journal is recoverable; a user who
stops using it is not.
