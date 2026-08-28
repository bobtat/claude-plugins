---
description: Create the accomplishments journal and arm the session-archiving hook
argument-hint: [path] (defaults to ~/.claude/accomplishments)
allowed-tools: Bash, Read, Write, Skill
---

## Task

### Phase 0 — Survey, with the Bash tool

Gather this yourself before anything else. It is deliberately **not** in a `!`
context block: those blocks are refused rather than prompted when they contain
shell expansion and match no permission rule, and every path below needs
`$HOME` or `$CLAUDE_ACCOMPLISHMENTS_DIR`.

```bash
J="${CLAUDE_ACCOMPLISHMENTS_DIR:-$HOME/.claude/accomplishments}"
echo "journal:  $J"
[ -d "$J" ] && echo "exists:   YES" || echo "exists:   no"
grep -h cleanupPeriodDays "$HOME/.claude/settings.json" \
     "$HOME/.claude/settings.local.json" 2>/dev/null \
  || echo "retention: not set — Claude Code default of 30 days applies"
find "$HOME/.claude/projects" -name '*.jsonl' 2>/dev/null | wc -l
find "$HOME/.claude/projects" -name '*.jsonl' -printf '%TY-%Tm-%Td\n' 2>/dev/null \
  | sort | head -1
```

The last two lines are the argument for this whole plugin: how many
transcripts exist, and how old the oldest one is. If that date is close to 30
days ago, retention is actively deleting history right now — say so.

Create the journal, and make sure the user understands what they are turning on
before it starts running.

`$ARGUMENTS`, if given, is the journal path. Otherwise use the default above.
A path outside `$HOME/.claude` needs `CLAUDE_ACCOMPLISHMENTS_DIR` exported in
the user's shell profile for the hook to find it — say so rather than creating
a directory the hook will never look at.

### Tell the user what this turns on, before creating anything

The journal directory's existence is what arms the `SessionEnd` hook. Until it
exists the hook does nothing at all; once it exists, **every session on this
machine gets its full transcript copied into the journal when it ends.**

State these four things plainly and get explicit confirmation:

1. **What is captured** — the complete transcript: prompts, replies, file
   contents that were read, tool output. Not a summary.
2. **Why** — Claude Code deletes transcripts after 30 days (see the retention
   line above). A performance review covers six to twelve months. Without this,
   the reasoning behind the work is gone before it is needed.
3. **The cost** — roughly 400 MB per year at heavy daily use, measured at a
   2.9x gzip ratio against real transcripts.
4. **The risk** — transcripts are not filtered. Any credential, customer name,
   or private file content that passed through a session is archived in
   plaintext-once-decompressed under the user's home directory. It is not
   scrubbed, because scrubbing would corrupt the evidence being kept.

If they decline, create nothing and say the hook stays inert. That is a
supported end state, and the commands still work on git and PR history.

### Create the structure

```
<journal>/
  README.md            what this is, what is in it, how to turn it off
  entries/             one markdown file per accomplishment, YYYY-MM/
  sessions/            archived transcripts, written by the hook
  sweeps/              a record of each sweep, so the next one knows where to start
```

Write the journal's own `README.md` covering: what the directory is, that
`sessions/` holds unfiltered transcripts, how to read one, how to disable
capture (remove the directory, or uninstall the plugin), and how to prune old
archives. Someone finding this directory in two years should be able to
understand it without this plugin installed.

### Verify

Confirm the hook can see the journal — check that the resolved path matches
what `archive-session.sh` will compute from the environment. If the user chose
a non-default path without exporting `CLAUDE_ACCOMPLISHMENTS_DIR`, this is
where that gets caught, not silently three months later when the journal is
empty.

### Offer the backfill

Transcripts already on disk are inside the retention window and will be
deleted on their own schedule. Offer to archive them now — that is up to 30
days of history rescued for free, and it is the only chance to get it.

Do not do it without asking; it is the same privacy decision as above, applied
retroactively to sessions the user had no capture expectation for.

### Report

Where the journal is, what was created, whether the hook is armed, whether
backfill ran, and the single next action: `/accomplishments:log` after
something worth recording, `/accomplishments:sweep` monthly.
