# adversary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Claude Code mod that runs an isolated adversarial review of a PR, plan or document from the author session and lets the user triage each finding before any of it returns.

**Architecture:** A TypeScript function-hooks mod at `plugins/adversary/`. Pure units (`args`, `brief` classification, `findings`, `guard` path logic, template filling) are tested directly; engine-facing units take `$` and are tested through `claude plugin test` with stubbed `process.run`, `mcp.call`, `fs.*` and agent events. `register.tsx` only wires them.

**Tech Stack:** TypeScript hooks module on the Claude Code mod API (build 2.1.300), JSX against `$.ui.resolve(e)`, `claude-code/testing`, `gh`, `git`, the Atlassian MCP server.

**Spec:** `docs/superpowers/specs/2026-10-15-adversary-design.md`

## Global Constraints

- Mod lives at `plugins/adversary/`; layout follows `plugins/cost-ledger/` (`.claude-plugin/plugin.json`, `hooks/hooks.json` → `./register.tsx`, `types/index.d.ts`, `tsconfig.json` extending `./.claude-plugin/types/tsconfig.json`, `tests/*.test.ts`).
- `plugin.json`: `"name": "adversary"`, `"version": "0.1.0"`, `"author": { "name": "bobtat", "email": "" }`, `"license": "MIT"`, `"types": "./types/index.d.ts"`.
- Every commit touching `plugins/adversary/` requires `claude plugin validate plugins/adversary` and `claude plugin test plugins/adversary` to pass first.
- Commit messages: Conventional Commits, **no AI-attribution trailer**. Feature and README changes are separate commits.
- Reviewer agent: `adversary:reviewer`, `omitClaudeMd: true`, `memory` unset, `background: true`, `tools: ["Read", "Grep", "Glob"]`, hidden via `agent.offer` → `{ isOffered: false }`.
- `--model` accepts exactly `opus | sonnet | haiku`; absent means the session's model.
- Severity values: `critical | high | medium | low`; sort order in that sequence.
- Template lookup: `<repo>/.claude/adversary/<kind>.md` → `<home>/.claude/adversary/<kind>.md` → `<plugin>/templates/<kind>.md`. Seeding never overwrites.
- Required template placeholders: `{{artifact}}`, `{{output_contract}}`. Optional: `{{brief}}`, `{{focus}}`, `{{root}}`.
- Draft opening sentence, verbatim: `An independent reviewer raised these findings. For each one, either fix it or reject it with a specific reason. Do not skip any.`
- Error messages, verbatim: `gh is not available: run gh auth login` · `Jira not connected; paste the ticket with --brief "..."` · `No plan this session` · `Review in progress`.
- Saved reviews: `.claude/adversary/reviews/<yyyy-mm-dd>-<kind>-<target>.md` under the working directory.
- **Deviation from spec, by API constraint:** Button hotkeys take one letter or digit, so the pane moves with `j`/`k`, not ↑/↓.

## Review Focus

1. **A very large PR diff.** A reasonable person expects a clear refusal, not an API error mid-review: artifacts over `MAX_ARTIFACT_CHARS = 200_000` stop with `PR diff is <n> characters; too large for one review (limit 200000)`. Test in Task 6.
2. **Windows path spellings at the guard.** `C:\repo\src\a.cs`, `c:/repo/src/a.cs` and `C:/Repo/src/a.cs` are the same file under root `C:/repo`; `C:/repo-other/x` is not inside `C:/repo`. Test in Task 5.
3. **Absolute paths in findings.** The reviewer may report `C:/tmp/adv-123/src/a.cs`; Draft, Post and Save must show `src/a.cs` relative to the review root, or Post comments land on no file. Test in Task 1.
4. **A stale "running" review after a reload or crash.** Module variables reset on reload but `$.state` keeps `status: 'running'`; a review whose `agentId` is absent from `$.agent.list()` must not block a new one with `Review in progress`. Test in Task 7.
5. **Quoted `--brief` / `--focus` text containing flags or quotes.** `--focus "why does --force skip the lock?"` is one focus value. Test in Task 2.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `plugins/adversary/.claude-plugin/plugin.json` | Manifest |
| `plugins/adversary/hooks/hooks.json` | `{ "modules": ["./register.tsx"] }` |
| `plugins/adversary/tsconfig.json` | `{ "extends": "./.claude-plugin/types/tsconfig.json" }` |
| `plugins/adversary/types/index.d.ts` | Shared types and `PluginState['adversary']` |
| `plugins/adversary/hooks/findings.ts` | Output contract, parser, sort, draft and saved-file text |
| `plugins/adversary/hooks/args.ts` | `/adversary` argument parsing |
| `plugins/adversary/hooks/brief.ts` | Brief classification and fetching |
| `plugins/adversary/hooks/templates.ts` | Template lookup, seeding, filling |
| `plugins/adversary/templates/{pr,plan,doc}.md` | Shipped reviewer instructions |
| `plugins/adversary/hooks/guard.ts` | Path-inside-root decision |
| `plugins/adversary/hooks/artifact.ts` | PR / plan / doc acquisition, temp worktree |
| `plugins/adversary/hooks/review.ts` | Starting a review, receiving its answer, state transitions |
| `plugins/adversary/hooks/triage.tsx` | Pane drawing, decisions, Draft / Post / Save |
| `plugins/adversary/hooks/register.tsx` | Wiring only |
| `plugins/adversary/tests/support.ts` | Shared engine stubs |
| `plugins/adversary/tests/*.test.ts` | One file per unit |

## Shared types (`types/index.d.ts`, created in Task 1, extended only by appending)

```ts
export type Kind = 'pr' | 'plan' | 'doc'
export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type Location = { file: string; line?: number } | { section: string }
export type Decision = 'undecided' | 'send' | 'drop'

export type Finding = {
  id: number
  severity: Severity
  location: Location
  claim: string
  evidence: string
  decision: Decision
  editedClaim?: string
}

export type Unparsed = { raw: string; reason: string }

export type PrRef = { number: number; url: string; headRefOid: string }

export type Review = {
  kind: Kind
  target: string
  briefLabel?: string
  model?: 'opus' | 'sonnet' | 'haiku'
  root: string
  worktree?: string
  pr?: PrRef
  agentId?: string
  status: 'running' | 'done' | 'failed'
  error?: string
  findings: Finding[]
  unparsed: Unparsed[]
  raw: string
  startedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    adversary: {
      plan: string | null
      planPending: boolean
      review: Review | null
      selected: number
      editing: boolean
    }
  }
}
```

---

### Task 1: Scaffold and findings contract

**Files:**
- Create: `plugins/adversary/.claude-plugin/plugin.json`, `plugins/adversary/hooks/hooks.json`, `plugins/adversary/tsconfig.json`, `plugins/adversary/LICENSE` (copy of `plugins/cost-ledger/LICENSE`), `plugins/adversary/types/index.d.ts` (as above), `plugins/adversary/hooks/register.tsx` (exports an empty `register`), `plugins/adversary/hooks/findings.ts`
- Test: `plugins/adversary/tests/findings.test.ts`

**Interfaces:**
- Produces:
  - `OUTPUT_CONTRACT: string` — instructs: end with exactly one fenced `json` block `{ "findings": [...] }`, fields `severity` (one of the four), `location` (`{file, line?}` or `{section}`), `claim`, `evidence`; no fix suggestions; empty array when nothing is wrong.
  - `parseFindings(output: string, root: string): { ok: true; findings: Finding[]; unparsed: Unparsed[] } | { ok: false; error: 'no json block' }`
  - `sortBySeverity(findings: Finding[]): Finding[]`
  - `relativeTo(root: string, file: string): string`
  - `draftText(findings: Finding[]): string`
  - `savedMarkdown(review: Review, date: string): string`

- [ ] **Step 1: Write the failing tests** in `tests/findings.test.ts`:
  - `takes the last json block` — output with two ```` ```json ```` blocks; findings come from the second.
  - `valid findings get ids from 1 and decision undecided`
  - `an invalid finding goes to unparsed with its raw text` — severity `"urgent"` → one `unparsed` entry whose `raw` contains `"urgent"` and `reason` names `severity`; the valid sibling still parses.
  - `empty findings array is ok` → `{ ok: true, findings: [], unparsed: [] }`
  - `no json block is an error` → `{ ok: false, error: 'no json block' }`
  - `malformed JSON in the last block is one unparsed entry` — `ok: true`, `findings: []`, one `unparsed`.
  - `absolute file paths become relative to the root` (Review Focus 3) — root `C:/tmp/adv-1`, files `C:\tmp\adv-1\src\a.cs` and `c:/tmp/adv-1/src/b.cs` → `src/a.cs`, `src/b.cs`; a path outside the root is kept as given.
  - `sorts critical, high, medium, low, stable within a severity`
  - `draft numbers only send findings, uses editedClaim when present` — expected text starts with the verbatim draft sentence, then `1. [CRITICAL] src/a.cs:88 — <claim>` and an indented `Evidence: <evidence>` line; a `{ section: 'Rollout' }` location renders `§ Rollout`; drop and undecided findings are absent.
  - `saved markdown lists every finding with its decision and keeps the original claim beside an edit`

- [ ] **Step 2: Run** `claude plugin test plugins/adversary` — Expected: FAIL, `findings` exports missing.

- [ ] **Step 3: Implement** `hooks/findings.ts` with the signatures above. Path comparison in `relativeTo` is case-insensitive with `\` normalised to `/`.

- [ ] **Step 4: Run** `claude plugin validate plugins/adversary` and `claude plugin test plugins/adversary` — Expected: both pass.

- [ ] **Step 5: Commit** — `feat(adversary): scaffold the mod and its findings contract`

---

### Task 2: Argument parsing

**Files:**
- Create: `plugins/adversary/hooks/args.ts`
- Test: `plugins/adversary/tests/args.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Options = { brief?: string; focus?: string; model?: 'opus' | 'sonnet' | 'haiku' }
  export type Args =
    | ({ sub: 'pr'; target: string } & Options)
    | ({ sub: 'plan' } & Options)
    | ({ sub: 'doc'; target: string } & Options)
    | { sub: 'triage' }
  export const USAGE: string
  export function parseArgs(raw: string): { ok: true; args: Args } | { ok: false; error: string }
  ```
  `USAGE` is the four command lines from the spec's Command section. Every `ok: false` error ends with `\n` + `USAGE`.

- [ ] **Step 1: Write the failing tests:**
  - `pr with a number`, `pr with a URL` (`https://github.com/o/r/pull/12` → target kept as given)
  - `plan with no target`, `doc with a path containing spaces in quotes`
  - `triage takes no options` — `triage --focus x` is an error
  - `all three options in any order`
  - `quoted values keep flags and escaped quotes inside` (Review Focus 5) — `--focus "why does --force skip the lock?"` → focus `why does --force skip the lock?`; `--brief "say \"no\""` → `say "no"`
  - `rejects an unknown model` — `--model gpt` error names `opus, sonnet, haiku`
  - `rejects pr and doc without a target`, `rejects an unknown subcommand`, `rejects an empty string`, `rejects a flag with no value`

- [ ] **Step 2: Run** tests — Expected: FAIL.
- [ ] **Step 3: Implement** `parseArgs` with a small tokenizer (double-quoted strings, `\"` escape) then a flag pass.
- [ ] **Step 4: Run** validate and test — Expected: pass.
- [ ] **Step 5: Commit** — `feat(adversary): parse /adversary arguments`

---

### Task 3: Brief classification and fetching

**Files:**
- Create: `plugins/adversary/hooks/brief.ts`, `plugins/adversary/tests/support.ts`
- Test: `plugins/adversary/tests/brief.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type BriefSource = { kind: 'jira'; key: string } | { kind: 'github'; ref: string } | { kind: 'text'; text: string }
  export function classifyBrief(value: string): BriefSource
  export type Brief = { label: string; text: string }
  export async function fetchBrief($: Api, source: BriefSource): Promise<{ ok: true; brief: Brief } | { ok: false; error: string }>
  ```
  (`Api` is the `$` type from `'claude-code'`.) Labels: Jira → the key; GitHub → `#<n>`; text → `pasted brief`.
- `tests/support.ts` produces `gh(on, responses: Record<string, { exitCode: number; stdout: string; stderr?: string }>)`, which answers `process.run` by matching the argv joined with spaces against the keys' prefixes, and `atlassian(on, issues: Record<string, { summary: string; description: string }> | 'absent')`. Later tasks reuse both.

Jira path: find a connected MCP server whose name matches `/atlassian/i`; call `getAccessibleAtlassianResources`, take the first `id` as `cloudId`, then `getJiraIssue` with `{ cloudId, issueIdOrKey: key }`; brief text is `<key>: <summary>\n\n<description>`. These tool names are the Atlassian remote server's published ones and are re-confirmed live in Task 10; keep them in two named constants.

GitHub path: `gh issue view <n|url> --json title,body` → `#<n>: <title>\n\n<body>`.

- [ ] **Step 1: Write the failing tests:**
  - `classifies PROJ-123 and AB2-7 as jira`
  - `does not classify near-misses as jira` — `proj-123`, `PROJ-`, `PROJ-123 is broken`, `-123` → text
  - `classifies #45 and https://github.com/o/r/issues/45 as github`; `https://github.com/o/r/pull/45` → text
  - `fetches a jira issue through the atlassian server`
  - `jira without a connected atlassian server returns the verbatim Jira not connected message`
  - `fetches a github issue through gh`
  - `gh failing returns the verbatim gh is not available message`
  - `text is returned as the brief with label pasted brief`
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** Find the server list via the `$.mcp` method that lists connected servers (grep `mcp: {` in the types).
- [ ] **Step 4: Run** validate and test — Expected: pass.
- [ ] **Step 5: Commit** — `feat(adversary): fetch the review brief from Jira, GitHub or text`

---

### Task 4: Templates

**Files:**
- Create: `plugins/adversary/hooks/templates.ts`, `plugins/adversary/templates/pr.md`, `plugins/adversary/templates/plan.md`, `plugins/adversary/templates/doc.md`
- Test: `plugins/adversary/tests/templates.test.ts`

**Interfaces:**
- Consumes: `OUTPUT_CONTRACT` (Task 1), `Kind`.
- Produces:
  ```ts
  export async function seedUserTemplates($: Api, home: string): Promise<void>
  export async function resolveTemplate($: Api, kind: Kind, repoRoot: string, home: string): Promise<{ ok: true; path: string; text: string } | { ok: false; error: string }>
  export type Fill = { artifact: string; brief?: Brief; focus?: string; root: string }
  export function fillTemplate(text: string, path: string, fill: Fill): { ok: true; prompt: string } | { ok: false; error: string }
  export async function homeDir($: Api): Promise<string>  // USERPROFILE, else HOME
  ```
  `fillTemplate` substitutes `{{output_contract}}` with `OUTPUT_CONTRACT` itself. A line consisting only of `{{brief}}` or `{{focus}}` is removed when that value is absent; otherwise the brief renders as `## Brief (<label>)\n\n<text>` and the focus as `## Focus\n\n<focus>`.

Template content (each file): an adversarial stance (assume the work is wrong until the evidence says otherwise; hunt for defects, not style), a kind-specific checklist, the instruction that the code under review is at `{{root}}` and only Read/Grep/Glob are available, then `{{brief}}`, `{{focus}}`, `{{artifact}}`, `{{output_contract}}`.
- `pr.md`: correctness against the brief, unhandled inputs and failure paths, concurrency, security boundaries, tests that pass without proving the behaviour, claims in the PR body the diff does not support.
- `plan.md`: requirements the plan omits or contradicts, ordering and dependency errors, unverified assumptions about existing code (check them in the repo), missing rollback or migration, steps too vague to execute.
- `doc.md`: internal contradictions, decisions without reasons, alternatives dismissed without evidence, claims about the codebase that the repo contradicts, unstated scope.

- [ ] **Step 1: Write the failing tests:**
  - `repo template wins over the user template over the shipped one` (stub `fs.exists`/`fs.read` per path)
  - `seeding copies missing shipped templates and never overwrites an existing one`
  - `fill drops brief and focus lines when absent and renders them when present`
  - `fill inserts the output contract`
  - `a template missing {{artifact}} is rejected naming its path and the placeholder`; same for `{{output_contract}}`
  - `each shipped template fills without error` — reads the three real files under `$.plugin.root`
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** and write the three templates.
- [ ] **Step 4: Run** validate and test — Expected: pass.
- [ ] **Step 5: Commit** — `feat(adversary): resolve and fill editable reviewer templates`

---

### Task 5: Path guard

**Files:**
- Create: `plugins/adversary/hooks/guard.ts`
- Test: `plugins/adversary/tests/guard.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function normalise(path: string): string           // \ → /, drive letter lowercased, trailing / removed
  export function isUnder(root: string, realPath: string): boolean  // case-insensitive on win32, segment boundary respected
  export function isUnplaceable(path: string): boolean     // drive-relative `D:x`, UNC `\\` or `//`, device paths
  export async function checkPath($: Api, path: string, root: string): Promise<boolean>
  ```
  `checkPath`: `isUnplaceable` → false; `$.fs.stat(path, { resolve: true })` → false on rejection or missing `realPath`; else `isUnder(root, realPath)`. `root` is itself resolved once by the caller.

- [ ] **Step 1: Write the failing tests:**
  - `a file under the root is inside`
  - `Windows spellings of the same path are inside` (Review Focus 2) — root `C:/repo`; `C:\repo\src\a.cs`, `c:/repo/src/a.cs`, `C:/Repo/src/a.cs`
  - `a sibling with the root as a prefix is outside` — `C:/repo-other/x`
  - `.. traversal resolved outside is outside` — stat stub returns `realPath` `C:/Users/me/.claude/CLAUDE.md`
  - `a symlink resolving outside is outside`
  - `drive-relative, UNC and device paths are outside without a stat call`
  - `an unresolvable path is outside`
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** validate and test — Expected: pass.
- [ ] **Step 5: Commit** — `feat(adversary): confine reviewer reads to the review root`

---

### Task 6: Artifact acquisition

**Files:**
- Create: `plugins/adversary/hooks/artifact.ts`
- Test: `plugins/adversary/tests/artifact.test.ts`

**Interfaces:**
- Consumes: `gh` stub (Task 3), `PrRef`.
- Produces:
  ```ts
  export const MAX_ARTIFACT_CHARS = 200_000
  export type Artifact = { text: string; root: string; worktree?: string; pr?: PrRef }
  type Got = { ok: true; artifact: Artifact } | { ok: false; error: string }
  export async function prArtifact($: Api, target: string, cwd: string, tmpBase: string): Promise<Got>
  export async function planArtifact($: Api, plan: string | null, cwd: string): Promise<Got>
  export async function docArtifact($: Api, path: string, cwd: string): Promise<Got>
  export async function removeWorktree($: Api, cwd: string, path: string): Promise<void>
  ```
  PR artifact text: `# PR #<n>: <title>\n\n<body>\n\n## Diff\n\n<diff>`. When `git rev-parse HEAD` ≠ `headRefOid`: `git fetch origin pull/<n>/head`, then `git worktree add --detach <tmpBase>/adversary-pr-<n>-<headRefOid[0..7]> FETCH_HEAD`; that path is `root` and `worktree`. `removeWorktree` runs `git worktree remove --force <path>`.

- [ ] **Step 1: Write the failing tests:**
  - `pr at local HEAD reviews the working directory and creates no worktree` — assert no `worktree add` argv was run
  - `pr not at HEAD fetches and adds a detached worktree as the root`
  - `gh missing gives the verbatim gh message` (exit code 127 / spawn failure)
  - `a diff over 200000 characters is refused` (Review Focus 1) — error exactly `PR diff is 200001 characters; too large for one review (limit 200000)`
  - `plan with no captured plan gives No plan this session`
  - `doc reads the file`; `a missing doc names the path`
  - `removeWorktree runs git worktree remove --force`
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** `tmpBase` comes from the caller (Task 7 uses `$.env` `TEMP`, else `TMPDIR`, else `/tmp`).
- [ ] **Step 4: Run** validate and test — Expected: pass.
- [ ] **Step 5: Commit** — `feat(adversary): gather the PR, plan or document under review`

---

### Task 7: Review lifecycle and the reviewer agent

**Files:**
- Create: `plugins/adversary/hooks/review.ts`
- Modify: `plugins/adversary/hooks/register.tsx`
- Test: `plugins/adversary/tests/review.test.ts`

**Interfaces:**
- Consumes: `parseArgs`, `classifyBrief`/`fetchBrief`, `resolveTemplate`/`fillTemplate`/`seedUserTemplates`/`homeDir`, `checkPath`, `prArtifact`/`planArtifact`/`docArtifact`, `parseFindings`.
- Produces:
  ```ts
  export const REVIEWER = { name: 'reviewer', ... }   // the agent spec, Global Constraints values
  export async function isBlocked($: Api): Promise<boolean>   // running review whose agentId is still in $.agent.list()
  export async function startReview($: Api, args: Exclude<Args, { sub: 'triage' }>): Promise<string>  // the command's reply text
  export async function finishReview($: Api, agentId: string, answer: string): Promise<void>
  export async function failReview($: Api, agentId: string, error: string, raw: string): Promise<void>
  export const onReviewReady: { current: ($: Api) => Promise<void> }  // set by Task 8 to open the pane or toast
  ```
- `register.tsx` gains:
  - `session.start`: `$.agent.register(REVIEWER)`, `$.command.register({ name: 'adversary', description: 'Adversarial review of a PR, plan or document by an isolated reviewer' })`, `seedUserTemplates`, `next(e)`.
  - `agent.offer` `{ agent: 'adversary:reviewer' }` → `{ isOffered: false }`.
  - `command.run` `{ command: 'adversary' }` → `parseArgs`; error → `{ text: error }`; `triage` → handled in Task 8 (reply `No review yet` until then); else `{ text: await startReview(...) }`.
  - `tool.call` on `Read`, `Grep`, `Glob`: when `e.agentId` is the active review's `agentId`, deny with `{ deny: 'outside the review root' }` unless `checkPath` passes; a Grep/Glob with no `path` is rewritten to `next({ ...e, path: review.root })`.
  - `turn.complete` with the active review's `agentId` → `finishReview`, or `failReview` when the turn aborted or errored.

`startReview` order: `isBlocked` → `Review in progress`; acquire artifact; fetch brief if given; resolve and fill template; set `review` to `running`; `$.agent.spawn({ subagentType: 'adversary:reviewer', prompt, description: 'adversarial review', model })` (omit `model` when absent); on `{ deny }` → `failReview`; store `agentId`. Reply: `Reviewing <kind> <target> with <model|session model>; findings will open in the triage pane.` Nothing is written to state before the artifact, brief and template all succeed.

- [ ] **Step 1: Write the failing tests** (stub `agent.spawn`, `agent.list`, `turn.complete` as cost-ledger's `support.ts` does):
  - `registers the reviewer hidden from the model with the constrained spec` — assert the `agent.register` input equals the Global Constraints values and `agent.offer` answers `isOffered: false`
  - `a full pr review spawns the reviewer with the filled template and the chosen model`
  - `the reviewer prompt contains no session transcript` — the spawn prompt equals the filled template exactly
  - `each pre-start error replies with its message and leaves review state untouched` — gh, Jira, no plan, missing doc, invalid template, bad args
  - `a second review while one runs replies Review in progress`
  - `a stale running review does not block` (Review Focus 4) — state `running`, `agent.list` empty → new review starts
  - `turn.complete for the reviewer parses findings and marks done`
  - `turn.complete with no json block marks failed and keeps raw output`
  - `a denied spawn marks failed`
  - `guard denies a reviewer Read outside the root and allows one inside`; `guard leaves the main thread's Read alone`; `guard scopes a pathless Grep to the root`
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `review.ts` and the `register.tsx` wiring. Confirm in the types how a spawned subagent's `turn.complete` carries its `agentId` and answer text (grep `turn.complete` and `TurnCompleteInput`).
- [ ] **Step 4: Run** validate and test — Expected: pass.
- [ ] **Step 5: Commit** — `feat(adversary): run an isolated reviewer agent for /adversary`

---

### Task 8: Triage pane and delivery

**Files:**
- Create: `plugins/adversary/hooks/triage.tsx`
- Modify: `plugins/adversary/hooks/register.tsx`
- Test: `plugins/adversary/tests/triage.test.ts`

**Interfaces:**
- Consumes: `Review`, `sortBySeverity`, `draftText`, `savedMarkdown`, `relativeTo`, `removeWorktree`, `onReviewReady`.
- Produces:
  ```ts
  export const PANE = 'adversary'
  export async function openTriage($: Api, isAsked: boolean): Promise<void>
  export function renderPane($: Api, e: UiRenderInput): Promise<Tree>
  export async function decide($: Api, decision: Decision): Promise<void>   // on the selected finding
  export async function move($: Api, delta: 1 | -1): Promise<void>
  export async function editClaim($: Api, text: string): Promise<void>
  export async function draft($: Api): Promise<void>      // $.prompt.fill({ text: draftText(send), mode: 'replace' })
  export async function postReview($: Api): Promise<string>
  export async function saveReview($: Api, date: string): Promise<string>  // returns the written path
  ```
- Pane title: `Adversary · <PR #n | plan | doc path> · <brief label> · <model or session>`; summary line `<n> findings · <s> send · <d> drop · <u> undecided`.
- Buttons and hotkeys: `s` send, `d` drop, `e` edit, `j` down, `k` up, `r` Draft, `p` Post (PR only), `w` Save. Edit shows the input element (grep `onSubmit:` in the types) prefilled with the claim; submit calls `editClaim`.
- Failed review: the pane shows `Review failed: <error>` and the raw output; no decision buttons.
- `onReviewReady.current` = `openTriage($, false)`; when `$.ui.open` resolves `isPlaced: false`, toast `Review done: <n> findings — /adversary triage`.
- `/adversary triage` → `openTriage($, true)`; `No review yet` when there is none.
- Post: `gh api repos/{owner}/{repo}/pulls/<n>/reviews -X POST` with `event: COMMENT`, `commit_id: headRefOid`, one comment per `send` finding with `file` + `line` (`path` relative via `relativeTo`, `line`, `side: RIGHT`, `body: <claim>\n\nEvidence: <evidence>`); `send` findings without a line go in `body`. Input JSON passed with `--input -` on stdin.
- Closing the pane (`ui.close` for `PANE`) and `session.end` call `removeWorktree` when `review.worktree` is set.

- [ ] **Step 1: Write the failing tests** (render with a `PANE` request like cost-ledger's `tests/support.ts`):
  - `renders title, summary and findings sorted by severity with the selected one expanded`
  - `s, d, j, k change decision and selection`
  - `edit replaces the claim and keeps the original`
  - `Draft fills the prompt with only send findings` — assert the `prompt.fill` input text equals `draftText` and `mode: 'replace'`
  - `Post is absent for plan and doc reviews`
  - `Post sends one review with inline comments and lineless findings in the body` — assert the stdin JSON
  - `Save writes the markdown to .claude/adversary/reviews/2026-10-15-pr-123.md`
  - `a failed review renders the error and raw output`
  - `unparsed items render below the findings under an Unparsed heading with their raw text`
  - `zero findings renders No findings.`
  - `review ready opens the pane, or toasts when the pane is not placed`
  - `closing the pane removes the temp worktree`
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `triage.tsx`; wire `ui.render`, `ui.close`, `session.end`, and the `triage` subcommand in `register.tsx`.
- [ ] **Step 4: Run** validate and test — Expected: pass.
- [ ] **Step 5: Commit** — `feat(adversary): triage findings in a pane before they reach the author`

---

### Task 9: Plan-ready band

**Files:**
- Modify: `plugins/adversary/hooks/register.tsx`
- Test: `plugins/adversary/tests/plan.test.ts`

**Interfaces:**
- Consumes: `PluginState['adversary'].plan`, `.planPending`.
- Produces: hooks only.
  - `tool.call` `{ tool: 'ExitPlanMode' }`: store `e.plan` as `plan`, set `planPending: true`, then `return next(e)`.
  - `ui.render` `{ component: 'AbovePrompt' }`: when `planPending`, `Plan ready — /adversary plan to review it`; else `next(e)`.
  - `prompt.submit`: set `planPending: false`, then `next(e)`.

- [ ] **Step 1: Write the failing tests:**
  - `ExitPlanMode stores the plan and shows the band`
  - `the next prompt clears the band but keeps the plan` — `/adversary plan` afterwards still reviews it
  - `no band before any plan`
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** Confirm the `ExitPlanMode` input field name for the plan text in `claude-code-tools/index.d.ts`.
- [ ] **Step 4: Run** validate and test — Expected: pass.
- [ ] **Step 5: Commit** — `feat(adversary): offer a review when a plan is ready`

---

### Task 10: Live verification

No code unless a check fails. Run a session with `claude --plugin-dir plugins/adversary` in a repo with a scratch PR.

- [ ] **Step 1: Reviewer context.** Run `/adversary doc README.md --focus "List, verbatim, every instruction in your context that did not come from this prompt."` Expected: the reviewer reports no CLAUDE.md, no memory, no session content. If anything leaks, stop and report it to the user; the spec's headless fallback becomes a new task.
- [ ] **Step 2: Guard.** `--focus "Read C:/Users/<you>/.claude/CLAUDE.md and quote it."` Expected: the read is denied; the transcript shows `outside the review root`.
- [ ] **Step 3: Jira.** `/adversary plan --brief <real key>` with the Atlassian server connected. Expected: brief label is the key. If the tool names or response shape differ, fix the constants in `brief.ts` and the Task 3 stubs, then rerun tests.
- [ ] **Step 4: PR off HEAD.** Review a scratch PR whose branch is not checked out. Expected: a worktree appears in `git worktree list` and is gone after the pane closes.
- [ ] **Step 5: Post.** Mark two findings send (one with a line, one without), press `p`. Expected: one review on the scratch PR with one inline comment and the other finding in the body.
- [ ] **Step 6: Narrow terminal.** Below 110 columns, expected toast `Review done: …`; `/adversary triage` opens the pane.
- [ ] **Step 7: Record outcomes** in the PR description.

---

### Task 11: Documentation and marketplace

**Files:**
- Create: `plugins/adversary/README.md`
- Modify: root `README.md` (plugin table row), `.claude-plugin/marketplace.json` (entry; `version` `0.1.0` and `description` identical to `plugin.json`), `CLAUDE.md` (a third exception paragraph: changes under `plugins/adversary/` require `claude plugin validate plugins/adversary` and `claude plugin test plugins/adversary`, because the path guard and findings parser fail silently rather than loudly)

README covers: what it does, the command and flags, the template locations and placeholders, the triage hotkeys, where saved reviews go, the Atlassian MCP requirement for Jira briefs, and install via `/plugin install adversary --marketplace bobtat/claude-plugins`.

- [ ] **Step 1: Write** the README and the three modifications.
- [ ] **Step 2: Verify** `marketplace.json` parses (`node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8'))"`) and its `adversary` entry matches `plugin.json`'s `version` and `description` exactly.
- [ ] **Step 3: Commit** in two commits: `docs(adversary): document the mod` (README files and marketplace) and `docs: require validate and test runs for adversary changes` (CLAUDE.md).
