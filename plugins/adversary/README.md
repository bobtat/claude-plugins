# adversary

A Claude Code mod that has an isolated reviewer attack a pull request, a plan or a document, then
lets you decide which of its findings reach the author. Like `cost-ledger` and `subagent-tree` it is
code: a TypeScript hooks module that Claude Code loads and runs in the session.

## Why

A review written inside the session that produced the work shares that session's assumptions. The
reviewer here is a separate agent that starts with none of them:

- It does not see the session transcript or memory, and it is not given `CLAUDE.md` and cannot read
  it. Its only input is one message: the template, the artifact, the optional brief and focus, and
  the output format.
- It has Read, Grep and Glob only, and a `tool.call` hook confines every call to the review root.
  A path that resolves outside the root (through `..`, a link, a drive-relative or UNC spelling) is
  denied. Inside the root, the contents of any `CLAUDE.md`, `CLAUDE.local.md`, `.claude` or `.git`
  are withheld: Read of one is denied, and so is a Grep whose path or glob names one, or that
  matches in one. Before a reviewer Grep runs, the same search is run once listing every file it
  matches, with no output limit, and if any is withheld the Grep is denied (narrow it with `path` or
  `glob` and it works again); if that listing fails, the Grep is denied too. A Glob with a broad
  pattern such as `**/*` still lists the names of files under `.claude` and `.git`.
- Nothing it finds goes anywhere on its own. The findings open in a pane where you send or drop each
  one, and only the ones you send are drafted into your prompt, posted to the PR, or both. The
  reviewer's completion notice, which carries its answer, is kept out of the session, whether it
  arrives as a prompt or is queued into a running turn.

```
/adversary pr|plan|doc ──► artifact (PR text + diff, plan, or file)
                           brief    (Jira / GitHub issue / pasted text, optional)
                           template (repo, user or shipped copy)
                                  │
                                  ▼
                        reviewer agent  ◄── tool.call guard: Read/Grep/Glob inside review root only
                                  │
                                  ▼
                   findings (one ```json block, parsed, sorted by severity)
                                  │
                                  ▼
                           triage pane
                  s send · d drop · e edit · j/k move
                    │           │            │
                  Draft        Post         Save
              (prompt box)  (PR review)  (.claude/adversary/reviews/)
```

## Installation

```
/plugin marketplace add bobtat/claude-plugins
/plugin install adversary@bobtat-plugins
```

## Using it

```
/adversary pr <number|url>   [--brief <key|#n|url|"text">] [--focus "..."] [--model opus|sonnet|haiku]
/adversary plan              [--brief ...] [--focus ...] [--model ...]
/adversary doc <path>        [--brief ...] [--focus ...] [--model ...]
/adversary triage            reopen the triage pane for the last review
```

```
/adversary pr 482
/adversary pr https://github.com/acme/widgets/pull/482 --brief PROJ-123 --model opus
/adversary pr 482 --brief #471 --focus "the retry logic and anything that touches billing"
/adversary plan --brief "Add a read-only audit log; no schema changes to existing tables"
/adversary doc docs/specs/export-design.md --focus "claims about the existing importer"
```

- `pr` and `doc` take exactly one target; `plan` takes none; `triage` takes no options.
- Flag values with spaces go in double quotes. A quoted token is always a value, never a flag.
- `--model` sets the reviewer's model. Without it the reviewer uses the session model.
- `--focus` adds a "Focus" section to the reviewer's task.
- A malformed command, including an empty target or flag value, replies with the usage above.
- `plan` reviews the plan from the last `ExitPlanMode` in this session. With none it replies
  "No plan this session".
- `doc <path>` is relative to the project root unless absolute. The reviewer can read the rest of
  the project (the review root is the project root), not just the one file.
- Only one review runs at a time; starting another while the reviewer is alive replies "Review in
  progress". The pane opens by itself when the review finishes or fails. A review whose reviewer is
  no longer running (after a reload or a crash) shows in the pane as failed: "The reviewer is gone".

### Plan-ready band

After you approve a plan, a line appears above the prompt: "Plan ready — /adversary plan to review
it". It stays until you send your next message, from the terminal or through Remote Control. A
background task's notification or a scheduled prompt arriving in between leaves it up.

## Briefs

`--brief` gives the reviewer the intent to check the work against. The value is classified like this:

| Value | Source | Needs |
|---|---|---|
| `PROJ-123` (project key and number) | Jira issue summary and description | The [Atlassian MCP server](https://github.com/atlassian/atlassian-mcp-server), connected to this session |
| `#123` or a `https://github.com/<owner>/<repo>/issues/<n>` URL | GitHub issue title and body | `gh`, logged in |
| anything else | the text itself | nothing |

If a brief cannot be fetched, the review does not start and the reply says why (for Jira, "Jira not
connected; paste the ticket with --brief "..."").

## Reviewing a PR

Needs `gh`, logged in. The reviewer is given the PR number, title, body and diff.

- The PR must belong to the project's repository, as `gh repo view` names it (host, owner and name,
  ignoring case). A URL of a PR in another repository is refused, since the checkout and Post would
  go to this repository's PR of the same number.
- If the project's checked-out `HEAD` is the PR's head commit and the working tree has no
  uncommitted or untracked changes, the reviewer reads the project directory.
- Otherwise the PR head is fetched from `origin` and checked out detached in a temporary git
  worktree under the system temp directory (`adversary-pr-<number>-<short sha>-<session>`, the last
  part the first eight characters of the session id), and that is the review root. If the fetch
  brings a different commit than the head `gh` reported (the PR moved, or `origin` is not the
  repository `gh` read), the review is refused. A worktree left at that path is removed first, which
  after a reload or a crash only happens if the session keeps its id; a session that comes back
  under a new id (after `/clear`, for one) uses a new path, and the old checkout stays until you
  remove it with `git worktree remove`. Another session reviewing the same PR head has its own path
  and is never touched. The worktree is removed when the pane closes or the session ends, and
  before the next review starts.
  While the reviewer is still running, closing the pane leaves the worktree in place until the
  session ends. If git cannot remove it, a toast names the path and the next close or session end
  tries again.
- A diff over 200000 characters is refused; the reply gives its size. The same limit applies to a
  document or a plan.

## Templates

The reviewer's task is a template with placeholders, one per kind: `pr.md`, `plan.md`, `doc.md`.
For each review the first of these that exists is used:

1. `<project>/.claude/adversary/<kind>.md`, for a template shared with the repo
2. `~/.claude/adversary/<kind>.md`, your own copy
3. `templates/<kind>.md` in the plugin, the shipped copy

On session start any of the three user copies that do not exist are created from the shipped ones, so
you can edit them in place. Your edits are never overwritten, which also means a later plugin update
does not reach a copy you have already seeded; delete it to take the new one.

| Placeholder | Holds |
|---|---|
| `{{artifact}}` | The PR text and diff, the plan, or the document. Required. |
| `{{output_contract}}` | The format the reviewer must answer in (below). Required. |
| `{{root}}` | The review root the reviewer can read. |
| `{{brief}}` | A "Brief" section, or nothing without `--brief`. |
| `{{focus}}` | A "Focus" section, or nothing without `--focus`. |

A template missing a required placeholder fails the review with a message naming the file. A
`{{brief}}` or `{{focus}}` alone on its line leaves no blank line behind when it is empty.

The reviewer must end with one fenced `json` block, `{ "findings": [...] }`, each finding having a
`severity` (`critical`, `high`, `medium`, `low`), a `location` (`file` and optional `line`, or
`section`), a `claim` and an `evidence`. The last such block is used. Findings that do not fit are
kept and shown under "Unparsed" in the pane. An answer with no `json` block fails the review and the
raw answer is shown.

## The triage pane

Findings are listed worst first, each with a mark (`·` undecided, `✓` send, `✗` drop), a severity and
a location. The selected finding shows its claim and evidence. A line under the title counts findings
and decisions.

| Key | Button | Does |
|---|---|---|
| `s` | Send | Mark the selected finding to send |
| `d` | Drop | Mark it dropped |
| `e` | Edit | Edit the claim text; an empty edit or one equal to the original removes the edit. Not offered where the surface has no text input |
| `j` / `k` | Down / Up | Move the selection |
| `r` | Draft | Put the sent findings in the prompt box (replacing what is there), asking the author to fix each or reject it with a reason |
| `p` | Post | PR reviews only: post the sent findings as a GitHub review |
| `w` | Save | Write the whole review to a file |
| `c` | Close | Close the pane |

With nothing marked to send, Draft and Post show "Nothing to send — mark findings with s first".

**Post** posts one review with the `COMMENT` event, so it neither approves nor requests changes.
It first compares the PR's current head with the commit that was reviewed.

- Head unchanged: it re-fetches the PR diff. A finding with a file and line that is on an added or
  context line in the diff becomes an inline comment on that line, anchored to the reviewed commit.
  Every other sent finding (outside the diff, no line, or a section) is listed numbered in the review
  body.
- Head moved, or unreadable: line numbers may now point at other code, so nothing is anchored. All
  sent findings go in the body, which begins "The PR has new commits since this review (reviewed
  `<short sha>`)."

A toast gives the review's URL, or the reason it failed.

**Save** writes `<project>/.claude/adversary/reviews/<date>-<kind>-<slug>.md`: `2026-10-19-pr-482.md`,
`2026-10-19-plan.md`, `2026-10-19-doc-export-design.md`. An existing file is never overwritten; a
second save the same day gets `-2`, `-3` and so on. The file holds every finding with its decision,
edited claims alongside the original, and the unparsed entries. Add the directory to `.gitignore` if
you do not want the reviews committed.

If the surface does not place the pane when a review finishes, a toast says "Review done: N
findings — /adversary triage" (or that it failed); `/adversary triage` opens the pane for the last
review. The review lives in session state, so it survives closing the pane.

## Limits

- Grep and Glob are disabled for the reviewer when the review root contains a link leading outside
  it, or more than 20000 entries; the scan runs once per review and counts anything it cannot settle
  as such a link. The reviewer gets "Grep/Glob disabled" and has Read only. Reading files by path
  still works and is still confined.
- A denied Grep tells the reviewer that its pattern matched somewhere in `CLAUDE.md`, `.claude` or
  `.git`. It learns that there is a match, but not the matching text or which file it is in.
- One review at a time, and only the last review is kept for `/adversary triage`.
- The reviewer sees one artifact. A PR diff, document or plan over 200000 characters is refused
  rather than truncated.

## Development

The reviewer's path guard and the findings parser fail silently: a guard bug lets the reviewer read
outside the review root, a parser bug drops findings. After any change under `plugins/adversary/`,
run both and commit only when both pass:

```
claude plugin validate plugins/adversary
claude plugin test plugins/adversary
```
