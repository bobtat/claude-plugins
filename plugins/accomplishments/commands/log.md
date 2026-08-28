---
description: Record what just happened as a journal entry, while the impact facts are still recoverable
argument-hint: [what to log] (defaults to the work in this session)
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Skill
---

## Context

- Repo: !`git rev-parse --show-toplevel`
- Branch: !`git branch --show-current`
- Your git identity: !`git config user.email`
- Commits today: !`git log --since=midnight --pretty=format:'%h %an %s'`

## Task

Turn work that just happened into a journal entry before the parts that matter
become unrecoverable.

**Load the `accomplishments:session-capture` skill now** and follow its five
phases. Load `accomplishments:accomplishments` for the entry format and the
impact ladder. This plugin's skills and agents are addressed as
`accomplishments:<name>`; there is no bare-name fallback.

`$ARGUMENTS`, if given, says what to log — a specific piece of work, a
compliment someone paid, a problem you solved last week. Without it, log the
work in this session.

### Resolve the journal first

Run this with the Bash tool. It is not a `!` context block because those are
refused rather than prompted when they contain shell expansion and match no
permission rule, and the journal path needs `$HOME` or the env override:

```bash
J="${CLAUDE_ACCOMPLISHMENTS_DIR:-$HOME/.claude/accomplishments}"
[ -d "$J" ] || echo "no journal — run /accomplishments:init first"
ls "$J/entries/$(date +%Y-%m)" 2>/dev/null | wc -l   # entries already this month
```

No journal, no entry. Say so and stop rather than creating it silently —
initialization is also what arms the session-archiving hook, and that is the
user's decision to make knowingly.

The commits-today line above is unfiltered by author. Match it against the git
identity shown to find the user's own.

### Draft first, ask second

Read the session and produce a draft entry, then ask only about what the draft
cannot supply. Opening with a list of questions gets one answer; opening with a
draft gets corrections to all of it.

### The three questions worth asking

Cap the interview at three, skipping any the session already answered:

1. Who was affected, and did anyone say anything about it?
2. What would have happened if you hadn't done it?
3. Is there a number anywhere — a graph, a timing, a count?

Ask whether a number **exists**. Never propose one, and never ask a question a
plausible figure would answer.

### Logging praise

If the user is logging something someone said, capture it **verbatim**, with
who said it and when. Do not summarize it. Quoted praise is the least
recoverable evidence there is and the most useful in a packet.

### Hard rules

- **Never invent a metric, a beneficiary, or a consequence.** Not in the entry,
  not "as a placeholder."
- **Never upgrade the user's confidence.** "I think it helped" stays that way.
- **Never record Claude's work as the user's.** The entry is about the user's
  work, judgment, and direction. Ask when the line matters.
- **Never log the same work twice** — check this month's entries first and
  update rather than duplicate.

### Report

Where the entry was written, anything marked unverified and what would confirm
it, and any number the user could look up later that would strengthen it. Two
or three lines. Do not summarize the entry back to the user — they just wrote
its contents.
