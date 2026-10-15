# adversary — design

Date: 2026-10-15
Status: approved in conversation, awaiting written-spec review
Location: `plugins/adversary/` (a TypeScript hooks mod, like `cost-ledger`)

## Problem

Robert regularly asks one Claude session to act as an adversary to another: review a PR, a plan or a design document and find its flaws. Today that is done with a second terminal session, a subagent, or a blind headless `claude -p` run. Three things go wrong:

1. **The reviewer knows too much.** A subagent receives the project CLAUDE.md and often the author's framing, which biases the critique.
2. **The adversary prompt is rewritten every time.**
3. **There is no control over what comes back.** Every finding reaches the author session, including ones Robert disagrees with.

## Goal and success criteria

One command, run in the author session, starts an isolated review; findings land in a triage pane; only the findings Robert approves reach the author.

Success means:

- A review starts with one command and no prompt writing.
- The reviewer never sees the author's conversation, CLAUDE.md, memory, or any file outside the code under review.
- Nothing reaches the author session or a PR without a per-finding decision by Robert.

## Decisions

| Area | Decision |
| --- | --- |
| Interaction | Everything runs from the author session; no second window |
| Isolation | Registered agent type: no CLAUDE.md, never given the conversation, tools limited to Read/Grep/Glob, path-guarded to one root |
| Artifacts | PR (number or URL), plan-mode plan, document (path) |
| Brief (optional) | Jira ticket (Atlassian MCP server), GitHub issue (`gh`), or pasted text |
| Prompt | Per-kind template files, user-editable, overridable per repo; `--focus "..."` per run |
| Model | Session's model by default; `--model opus|sonnet|haiku` per run |
| Triage | Pane listing findings; send / drop / edit per finding |
| Delivery | Draft into the prompt box (always); for a PR also post review comments or save to a file, by button |
| Plan mode | A band above the prompt offers `/adversary plan`; nothing runs automatically |

Rejected alternatives:

- **A separate reviewer console session.** Needs cross-session messaging and a second window — the overhead that exists today.
- **Sending approved findings directly to the author.** Saves one keypress and removes Robert's last word on framing.
- **Holding every plan for review before approval.** Charges a review and a wait on every plan, including trivial ones.
- **Guessing whether a PR is Robert's own.** Extra code that can guess wrong; the pane offers every destination instead.

## Architecture

```
 /adversary <pr|plan|doc> <target> [--brief X] [--focus "..."] [--model m]
        │
        ▼
 ┌──────────────┐  ┌───────────────┐  ┌──────────────┐
 │ args.ts      │─►│ artifact.ts   │  │ brief.ts     │
 │ parse+check  │  │ PR: gh diff   │  │ PROJ-123 →   │
 └──────────────┘  │ plan: captured│  │  Atlassian   │
        │          │ doc: fs.read  │  │  MCP         │
        │          └──────┬────────┘  │ #45/URL → gh │
        │                 │           │ else: text   │
        │                 ▼           └──────┬───────┘
        │          ┌───────────────┐         │
        └─────────►│ templates.ts  │◄────────┘
                   │ repo > ~/.claude/adversary > shipped
                   └──────┬────────┘
                          ▼ one prompt
                   ┌───────────────────────────────┐
                   │ adversary:reviewer agent type │
                   │ omitClaudeMd, Read/Grep/Glob, │
                   │ hidden from the model,        │
                   │ background; path guard hook   │
                   └──────┬────────────────────────┘
                          ▼ JSON findings
                   ┌───────────────┐   ┌─────────────────────────┐
                   │ findings.ts   │──►│ Triage pane (atom state)│
                   │ parse+validate│   │ send / drop / edit each │
                   └───────────────┘   └──────┬──────────────────┘
                                              ▼
                     Draft → $.prompt.fill    │  PR only, by button:
                     (always available)       │  post review comments
                                                 or save to file

 Plan watch: tool.call(ExitPlanMode) → saves plan text in $.state →
 AbovePrompt band "Plan ready — /adversary plan" → cleared on next prompt
```

### Units

Each unit is one file with one job, testable without the others.

| File | Job | Depends on |
| --- | --- | --- |
| `hooks/args.ts` | Parse `/adversary` arguments; reject bad input with a usage line | — |
| `hooks/artifact.ts` | Produce the artifact text and the review root directory | `$.process` (`gh`, `git`), `$.fs`, `$.state` |
| `hooks/brief.ts` | Classify `--brief` and fetch it | `$.mcp` (Atlassian), `$.process` (`gh`) |
| `hooks/templates.ts` | Resolve the template; seed user copies on first use | `$.fs` |
| `hooks/findings.ts` | Finding type and parser | — |
| `hooks/guard.ts` | Decide whether a reviewer tool path is inside the review root | `$.fs.stat` |
| `hooks/triage.tsx` | Triage pane, its state, delivery actions | `$.ui`, `$.prompt`, `$.process`, `$.fs` |
| `hooks/register.tsx` | Wiring only: command, agent type, hooks, band | all of the above |
| `templates/{pr,plan,doc}.md` | Shipped default reviewer instructions | — |

## Command

```
/adversary pr <number|url>   [--brief <key|#n|url|"text">] [--focus "..."] [--model opus|sonnet|haiku]
/adversary plan              [--brief ...] [--focus ...] [--model ...]
/adversary doc <path>        [--brief ...] [--focus ...] [--model ...]
/adversary triage            reopen the triage pane for the last review
```

With no `--model`, the reviewer uses the session's model.

## Artifact acquisition

- **PR.** `gh pr view <n> --json number,title,body,headRefOid,baseRefName,url` and `gh pr diff <n>`. If local `HEAD` equals `headRefOid`, the review root is the working directory. Otherwise the mod runs `git fetch origin pull/<n>/head` and `git worktree add --detach <tmp> FETCH_HEAD`, and the temporary worktree is the review root; it is removed when the triage pane closes or the session ends.
- **Plan.** A `tool.call` hook on `ExitPlanMode` stores the plan text in `$.state` before calling `next(e)`. The review root is the working directory.
- **Document.** `$.fs.read(path)`. The review root is the working directory.

## Brief

| `--brief` value | Treated as | Fetched by |
| --- | --- | --- |
| Matches `^[A-Z][A-Z0-9]+-\d+$` | Jira issue key | Atlassian MCP server via `$.mcp.call` |
| `#<n>` or a GitHub issue URL | GitHub issue | `gh issue view --json title,body` |
| Anything else | The brief itself | — |

Jira tool names are confirmed against the connected server during implementation, not assumed.

## Templates

Lookup order, first hit wins:

1. `<repo>/.claude/adversary/<kind>.md`
2. `~/.claude/adversary/<kind>.md`
3. `<plugin>/templates/<kind>.md`

On first use the shipped templates are copied to `~/.claude/adversary/` if absent; existing files are never overwritten.

A template is Markdown with these placeholders, filled by `templates.ts`: `{{artifact}}`, `{{brief}}` (empty section dropped when no brief), `{{focus}}` (dropped when absent), `{{root}}`, `{{output_contract}}`. A template missing `{{artifact}}` or `{{output_contract}}` is rejected with its path named. `{{output_contract}}` is supplied by the mod, not the template, so a user edit cannot break parsing.

## Reviewer agent

Registered in `session.start` with `$.agent.register`:

- `name: "reviewer"` → `adversary:reviewer`
- `omitClaudeMd: true` — the API documents this as dropping every CLAUDE.md block: the person's, the project's, and the rules
- `memory` left unset, so no memory scope is attached
- `background: true`
- `tools: ["Read", "Grep", "Glob"]`
- hidden from the model with an `agent.offer` hook returning `{ isOffered: false }`
- spawned by the mod with `$.agent.spawn({ subagentType, prompt, description, model })`; the answer is the subagent's `turn.complete`, matched by `agentId`

The reviewer is given only the filled template. It never receives the session transcript.

**Path guard.** A `tool.call` hook on Read, Grep and Glob, scoped to the reviewer's `agentId` (tool-call input carries the calling agent's id), resolves the target with `$.fs.stat(path, { resolve: true })` and denies anything whose real path is not under the review root, and anything that cannot be resolved. This is the enforcement of isolation; `omitClaudeMd` is the first layer, not the only one.

**Fallback.** If live verification shows the reviewer's context still carries user-level CLAUDE.md, auto-memory, or anything from the session beyond its prompt, the reviewer is replaced by a headless `claude -p --restricted --strict-mcp-config` run via `$.process`, from an empty directory outside the repo and `~/.claude`, with its stream-json output logged and surfaced in the pane.

## Findings contract

The reviewer ends with one fenced `json` block:

```json
{ "findings": [
  { "severity": "critical|high|medium|low",
    "location": { "file": "src/Cache.cs", "line": 88 },
    "claim": "Eviction races with refresh; a stale entry can be re-inserted.",
    "evidence": "Refresh() reads _map before taking _lock (line 71); ..." }
] }
```

- `location` is `{ file, line? }` for code or `{ section }` for a plan or document.
- There is no suggested-fix field: the reviewer finds, the author fixes.
- The parser takes the **last** `json` block. Each valid finding becomes a row; each invalid one goes to an "unparsed" list with its raw text. No finding is dropped silently.
- `{ "findings": [] }` is a valid result, shown as "No findings."
- No `json` block at all is a reviewer failure (see Errors).

## Triage pane

```
 ┌ Adversary · PR #123 · PROJ-456 · opus ─────────────────────────┐
 │ 5 findings · 2 send · 1 drop · 2 undecided                     │
 │                                                                │
 │ ▸ ✓ CRIT  src/Cache.cs:88                                      │
 │     Eviction races with refresh; stale entry re-inserted.      │
 │     Evidence: Refresh() reads _map before taking _lock (l.71)… │
 │   ✓ HIGH  src/Orders/Repo.cs:140                               │
 │   ✗ MED   plan §3 "Rollout"                                    │
 │   · MED   tests/CacheTests.cs:22                               │
 │   · LOW   README.md:10                                         │
 │                                                                │
 │ s send · d drop · e edit · ↑↓ move   [Draft (2)] [Post] [Save] │
 └────────────────────────────────────────────────────────────────┘
```

- Findings sorted by severity; the selected one expands to show its evidence.
- Each finding is `undecided`, `send` or `drop`. **Edit** replaces the claim with Robert's text; the original is kept and appears in the saved file.
- **Draft** fills the prompt box (`$.prompt.fill`, mode `replace`) with:

  > An independent reviewer raised these findings. For each one, either fix it or reject it with a specific reason. Do not skip any.
  >
  > 1. [CRITICAL] src/Cache.cs:88 — claim
  >    Evidence: …

- **Post** (PR only): one `gh api` pull-request review with an inline comment on each `send` finding's file and line. A `send` finding without a line in the diff goes into the review body.
- **Save**: writes every finding with its decision and any edit to `.claude/adversary/reviews/<yyyy-mm-dd>-<kind>-<target>.md` in the working directory.
- The pane opens when the review finishes. Below the width at which an unrequested pane is seated, a toast says "Review done: N findings — /adversary triage" instead; that command opens it at any width.

## Plan band

- `tool.call` on `ExitPlanMode` stores the plan and sets `planPending`.
- An `AbovePrompt` `ui.render` hook shows `Plan ready — /adversary plan to review it` while `planPending` is set.
- `prompt.submit` clears `planPending`.

## Errors

All of these stop before a review starts and reply with one line:

| Situation | Message |
| --- | --- |
| `gh` missing or unauthenticated | `gh is not available: run gh auth login` |
| Jira key, Atlassian server not connected | `Jira not connected; paste the ticket with --brief "..."` |
| `/adversary plan` with no captured plan | `No plan this session` |
| Document path missing | names the path |
| Template invalid | names the template path and the missing placeholder |
| Bad arguments | usage line |
| A review already running | `Review in progress` |

After the reviewer starts, a denied spawn, an API error, or output with no `json` block opens the pane in an error state showing the reason and the reviewer's raw output.

## State

`$.state` (session), declared in `types/index.d.ts` under `adversary`:

- `plan`: last captured plan text, or undefined
- `planPending`: boolean
- `review`: the active or last review — kind, target, brief label, model, root, temp worktree path, reviewer `agentId`, status (`running|done|failed`), findings with decisions and edits, unparsed items, raw output

Nothing is kept in `$.store`; saved reviews are Markdown files Robert controls.

## Testing

`claude plugin validate plugins/adversary` and `claude plugin test plugins/adversary` must both pass before any commit under `plugins/adversary/`, as for `cost-ledger`.

Unit tests:

- `args.ts`: each subcommand, every flag, bad and missing values
- `brief.ts`: classification of Jira keys, `#n`, issue URLs, plain text (including text that looks almost like a key)
- `templates.ts`: lookup order, first-use seeding without overwrite, placeholder filling, rejection of a template missing a required placeholder
- `findings.ts`: well-formed, malformed, zero findings, multiple `json` blocks (last wins), no block
- `guard.ts`: inside the root, outside, `..` traversal, symlink out of the root, drive-relative and UNC paths, unresolvable paths
- Draft text formatting

Flow tests (stubbed `$.process`, `$.mcp`, `$.agent`):

- PR with `HEAD` at the PR head (no worktree) and not (worktree created, then removed on close)
- Each row of the error table
- Plan band appears on `ExitPlanMode` and clears on the next prompt

Manual checks in a live session (the stand-in engine cannot answer these):

- That the reviewer's context holds nothing beyond its prompt (no user CLAUDE.md, no auto-memory); decides whether the headless fallback is needed
- The Atlassian MCP server's tool names and response shape
- Posting a real review on a scratch PR

## Out of scope

- Automatic reviews of any kind
- Reviewing the current branch's diff without a PR
- Multiple concurrent reviews
- Rules-based filtering of findings by severity
- Tracking whether the author actually resolved each finding

## Repo housekeeping

- `plugins/adversary/README.md`, a row in the root `README.md` table, an entry in `.claude-plugin/marketplace.json` with `version` and `description` matching `plugin.json`
- A line in the repo `CLAUDE.md` requiring validate and test for changes under `plugins/adversary/`, like the `cost-ledger` exception
- Feature and README changes land as separate commits
