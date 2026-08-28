---
name: evidence-sweep
description: Use when reconstructing a past period into journal entries — mining git, pull requests, reviews given, and archived session transcripts across every repository, reconciling what is found against entries that already exist, clustering the remainder into candidate accomplishments, and interviewing the user about the ones that look significant. Invoked by /accomplishments:sweep. Runs against a deadline: session transcripts are deleted 30 days after they are written.
---

# Sweeping a Period for What Was Not Captured

**Load the `accomplishments:accomplishments` skill.** `references/evidence.md`
holds the mining commands and what each result can and cannot establish;
`references/interviewing.md` holds the question set.

## The deadline

Session transcripts are deleted after `cleanupPeriodDays`, default 30. The
archive hook rescues them only for sessions that ended *after* the journal was
created. For any period before that, the reasoning is already gone and only
git, PRs, and the user's memory remain.

**Say this plainly when sweeping a period with no archive coverage.** The user
should know the difference between "nothing significant happened" and "the
record was deleted before this plugin existed."

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
- **Archived sessions** from `sessions/index.jsonl`, taking the **last** entry
  per `session_id` since the index is append-only

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
