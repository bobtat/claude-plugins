# Mining Evidence

Every command here was run and its output checked. Each section says what the
result **establishes** and, more importantly, what it does not.

## First: who are you, to git?

Everything filters on authorship, and the wrong identity silently returns
nothing — which reads exactly like "you did no work this quarter."

```bash
git config user.email
git log --format='%ae' | sort | uniq -c | sort -rn | head
```

The second command lists every author identity in the repo. Work-laptop and
personal identities, or a `users.noreply.github.com` address that changed when
an account was renamed, are common and produce empty results without an error.
Filter on every identity that is yours.

## Commits

```bash
ME=$(git config user.email)

# What landed, in a period
git log --author="$ME" --since=2026-01-01 --until=2026-04-01 \
        --pretty=format:'%h %ad %s' --date=short

# Scale of each change
git log --author="$ME" --since=2026-01-01 --numstat --pretty=format:'%h %s'

# Where the effort concentrated — the shape of a quarter in one command
git log --author="$ME" --since=2026-01-01 --name-only --pretty=format: \
  | grep -v '^$' | sort | uniq -c | sort -rn | head -20

# First and last commit touching a subsystem: how long you carried it
git log --author="$ME" --format='%ad %s' --date=short -- path/to/subsystem | tail -1
```

**Establishes:** that you did it, when, how much changed, and which areas you
owned over time. The concentration command is the most useful of the four —
the top of that list is usually the spine of a review period, and it surfaces
sustained ownership that no single commit shows.

**Does not establish:** why any of it mattered. Also actively misleading on
effort: generated files, formatting passes, and vendored code inflate line
counts, and the hardest change of a quarter is routinely one line. Never let a
line count into a review as a measure of contribution.

**Blind spots:** squash-merges collapse to one commit with the merger as
committer; pairing and mob work attribute to one person; work in another
repo, in a wiki, in review comments, or in a design doc is invisible here.

## Pull requests, across every repository

Accomplishments span repos, and `gh search` is the only view that does too.

```bash
# Merged PRs you authored, anywhere, in a period
gh search prs --author=@me --merged --created=2026-01-01..2026-03-31 \
  --limit 100 --json number,title,repository,closedAt

# Reviews you gave — the multiplier evidence nobody records
gh search prs --reviewed-by=@me --created=2026-01-01..2026-03-31 \
  --limit 100 --json number,title,repository,author

# Issues you filed: problems you found, as distinct from tickets you were handed
gh search issues --author=@me --created=2026-01-01..2026-03-31 \
  --limit 100 --json number,title,repository

# One PR in full — the description and discussion are the "why"
gh pr view <n> --repo <owner/repo> --json title,body,comments,reviews,additions,deletions
```

**Establishes:** scope, collaborators, and — in the PR body and discussion —
the reasoning, which is the part git does not keep. A PR description written
at the time is often the single best evidence available.

**The reviews query deserves special attention.** Reviews given are the most
under-claimed evidence in engineering reviews: it is real team-level impact,
it is trivially countable, and almost nobody counts it. "Reviewed 94 PRs
across 11 authors" is a measured fact about your multiplier effect.

**Does not establish:** anything about what happened after the merge. A PR
proves the change shipped, never that it worked.

## Issue trackers

Whatever the tracker, one thing is worth extracting: **the business reason the
work existed, in the requester's words.** That sentence is what turns
"migrated the auth library" into "closed the last blocker on the SSO rollout,"
and it is written down exactly once, at the top of the ticket, usually by
someone else.

```bash
gh issue view <n> --repo <owner/repo> --json title,body,labels,assignees,closedAt
```

For JIRA, Linear, or Azure DevOps, use the MCP server or CLI if one is
configured; if none is, ask the user to paste the ticket rather than guessing
at its contents. **Never reconstruct a ticket's business justification from
the code.** That is the exact point where invention enters a review.

## Archived session transcripts

The plugin's own capture. One gzipped JSONL file per session under
`sessions/YYYY-MM/`, indexed in `sessions/index.jsonl`.

```bash
J="${CLAUDE_ACCOMPLISHMENTS_DIR:-$HOME/.claude/accomplishments}"

# What sessions exist in a period, without opening any archive
python -c '
import json, sys
for line in sys.stdin:
    d = json.loads(line)
    if "2026-03" <= d["day"] <= "2026-03-31":
        print(d["day"], d["project"], d["branch"], d["commits_since_start"], d["archive"])
' < "$J/sessions/index.jsonl"

# The prompts from one session: the cheapest high-signal summary of its purpose
gzip -dc "$J/sessions/2026-03/<file>.jsonl.gz" | python -c '
import json, sys
for line in sys.stdin:
    try: d = json.loads(line)
    except Exception: continue
    if d.get("type") != "user" or d.get("isSidechain"): continue
    m = d.get("message", {})
    c = m.get("content")
    if isinstance(c, str) and c.strip() and not c.startswith("<"):
        print(d.get("timestamp", "")[:16], c[:300].replace("\n", " "))
'
```

**Establishes:** what the problem actually was, what you tried, what did not
work, and how long it took to see. This is the reasoning that exists nowhere
else — not in the commit, not in the PR, not in the ticket.

**Read the prompts before the replies.** The questions a person asked are a
denser record of intent than anything generated in response to them.

**Does not establish:** anything after the session. And note that the index is
append-only with re-archives appended, so **take the last entry per
`session_id`**, not the first.

## Dashboards, and everything outside the tools

The strongest evidence in a review — a latency graph, a cost line, a support
volume chart — lives where no command reaches, and cannot be inferred.

When a sweep finds work that looks like it should have a measurable result,
that is the moment to **ask** rather than to estimate. "The nightly sync
change looks like it changed a runtime — do you have a before and after?" is
the question that produces the best line in the review. If the answer is no,
the entry ships without a number.

## What the mining pass is for

Mining does not produce accomplishments. It produces a **list of things that
happened**, which is raw material for two questions the user answers:

1. Which of these mattered?
2. What do you know about it that is not written down anywhere?

Presenting mined output as a set of accomplishments is the failure mode of
this whole approach. A list of 340 commits is not a review; it is a prompt.
