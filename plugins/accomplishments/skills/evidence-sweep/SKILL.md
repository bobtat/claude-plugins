---
name: evidence-sweep
description: Use when reconstructing a past period into journal entries — mining git, pull requests, reviews given, and the plugin's own session digests across every repository, reconciling what is found against entries that already exist, clustering the remainder into candidate accomplishments, and interviewing the user about the ones that look significant. Invoked by /accomplishments:sweep. Runs against a deadline: while a session transcript still exists it can be upgraded to a written summary, and after 30 days it cannot.
---

# Sweeping a Period for What Was Not Captured

**Load the `accomplishments:accomplishments` skill.** `references/evidence.md`
holds the mining commands and what each result can and cannot establish;
`references/interviewing.md` holds the question set.

## The deadline, and the upgrade window

Two different clocks run here, and confusing them loses material.

**The digest is permanent.** The hook writes it at session end and it is not
subject to retention. A period with digests is never lost.

**The transcript is not.** Claude Code deletes it after `cleanupPeriodDays`,
default 30. While it survives, a session can be *upgraded* from a prompt
digest to a model-written summary that also captures what was tried and
abandoned — the assistant's reasoning, which the digest deliberately does not
keep. After 30 days that upgrade is impossible forever.

So a sweep run inside 30 days produces materially better material than the
same sweep run later. That is the reason for the monthly cadence, and it is
worth telling the user when they have gone longer.

**Say plainly which coverage a period has**: digests only, digests plus live
transcripts, or neither. The user should know the difference between "nothing
significant happened" and "the record was already gone."

## Phase 1 — Scope and identity

Establish the period. Default to since the last sweep; fall back to the last
30 days.

```bash
J="${CLAUDE_ACCOMPLISHMENTS_DIR:-$HOME/.claude/accomplishments}"
ls "$J/entries" 2>/dev/null | tail -3          # where the journal leaves off
git config user.email
git log --format='%ae' | sort | uniq -c | sort -rn | head
```

Confirm every author identity that belongs to the user. Filtering on one
address when they have two returns a partial result that looks like a complete
one — this is the most common way a sweep silently under-reports.

## Phase 2 — Mine

Run wide. Nothing here is a judgment; it is a list.

- **Commits** in each relevant repository, and the file-concentration ranking
  that shows where effort actually went
- **Merged PRs across all repositories** via `gh search prs --author=@me` —
  accomplishments span repos and a per-repo view misses that
- **Reviews given** via `gh search prs --reviewed-by=@me` — team-level evidence
  that is trivially countable and almost never counted
- **Issues filed** — problems the user found, as opposed to work handed to them
- **Session digests** from `digests/index.jsonl`, taking the **last** entry
  per `session_id` since the index is append-only. Check each digest's
  `redaction:` field; anything still marked `regex` has not had the model pass
  and should be run through `/accomplishments:scrub` before its contents are
  quoted anywhere.
- **Live transcripts still inside the 30-day window**, for sessions that look
  substantial. This is the only chance to capture what was *tried and
  abandoned*, which the digest does not hold. Write the result to
  `summaries/YYYY-MM/<day>-<session_id>.md` as prose — never copy transcript
  text into the journal.

Spawn `accomplishments:evidence-miner` when the period is longer than about
six weeks or spans more than three repositories. A quarter of raw git and PR
output floods the conversation before any decision gets made, and the agent
returns a clustered summary instead. Its clustering is a **proposal to
verify**, not a result to present — check its groupings against the underlying
evidence before showing them to the user.

## Phase 3 — Reconcile against the journal

Read the existing entries for the period. Split the mined material three ways:

- **Already captured** — drop it. Do not re-log, and do not "enrich" an entry
  the user wrote with detail inferred from a diff.
- **Captured thinly** — an entry exists but has no impact facts. Candidate for
  a follow-up question, not a new entry.
- **Not captured** — the working set for Phase 4.

## Phase 4 — Cluster into candidates

Individual commits are not accomplishments. Group the uncaptured material by
**the problem it was solving**, which usually spans several commits, sometimes
several weeks, and occasionally several repositories.

For each cluster, produce two or three lines: what it appears to be, the
evidence behind it, and the specific thing that is unknown. Rank by apparent
significance — sustained work, cross-repo work, and work touching areas the
user rarely touches all rank high. Volume does not.

Cap the list at **eight to twelve candidates**. A sweep that returns forty
items gets abandoned, and the tail is almost entirely routine work.

## Phase 5 — Present and interview

Show the ranked candidates and ask the user which ones mattered. This is the
question mining cannot answer and the user answers instantly.

Then, for the ones they pick, interview per `references/interviewing.md` —
three questions each at most, starting with who was affected. Work through
them one cluster at a time. A batch of twelve clusters and thirty questions
gets one answer.

## Phase 6 — Write entries and record the sweep

Write one entry per confirmed accomplishment, dated to when the **work**
happened, not to today. Record the sweep itself so the next one knows where to
start:

```
sweeps/YYYY-MM-DD.md   — period covered, candidates found, entries written,
                         and what the user explicitly declined to log
```

Recording the declines matters: without it, the next sweep re-surfaces the
same work and asks the same questions, which is how the habit dies.

## Phase 7 — Report

- Period swept, and how much of it had archive coverage
- Entries written, and where
- Candidates the user declined
- **Anything that looked significant but could not be reconstructed** — name
  it, because that is the argument for sweeping more often
- Any measurement the user said they would look up

## Hard rules

- **Never present mined output as accomplishments.** A list of commits is a
  prompt for the user, not a record of achievement. Presenting it as the
  latter is the central failure mode of this whole approach.
- **Never infer impact from a diff.** Size does not indicate significance, and
  the hardest change of a quarter is routinely one line.
- **Never reconstruct a ticket's business justification from code.** Read the
  ticket, or ask.
- **Never write an entry the user did not confirm.** Mining proposes;
  the user disposes.
- **Never overwrite or edit an existing entry's claims.** Add a new entry, or
  append to the existing one under a dated note.
- **Never copy transcript text into the journal.** A summary written from a
  live transcript is prose about the work. Pasting the transcript itself
  reintroduces exactly the tool output and file contents the digest format
  exists to keep out.
- **Never quote a digest still marked `redaction: regex`.** It has had only the
  pattern pass. Run `/accomplishments:scrub` first.
