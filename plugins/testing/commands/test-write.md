---
description: Write tests from a described behavior — a ticket, a PR, or free text — verifying the code captures what was described, not that it does what it already does
argument-hint: [description | file path | PR/issue number or URL | ticket key] [--light | --full] [--bdd]
allowed-tools: Agent, AskUserQuestion, Read, Write, Edit, Grep, Glob, Bash, TodoWrite
---

## Context

- Current branch: !`git branch --show-current`
- Repo root: !`git rev-parse --show-toplevel 2>/dev/null || echo "not a git repository"`
- Uncommitted changes: !`git status --porcelain`

## Task

Write tests that verify **the described behavior is correctly captured in the code**. This is not "write tests for this file." The description is the oracle; the implementation is not.

**Load the `testing:testing` skill now** — its references are the criteria for every phase below. Each phase also has its own skill, loaded at the point it is needed.

### The governing rule

> **Expected outcomes come from the description. If the description does not say what should happen, that is a question for the user — never a value to read out of the implementation.**

A test whose expected value was derived from the code under test can only confirm the code does what it does. Producing those is the specific failure this command exists to prevent. It applies in every phase, to you and to every subagent you spawn.

Its corollary, which governs Phase 5: **a spec-derived test that goes red may mean the code is wrong.** Never weaken an assertion to make it pass.

### Artifacts

Phases hand off through files, because subagents cannot see your context. Create a working directory — your scratchpad directory if you have one, otherwise a temp directory — and write:

- `behavior-spec.md` — Phase 1 output
- `recon.md` — Phase 1 output
- `test-plan.md` — Phase 3 output, the approved contract
- `authoring/<slice>.md` — per-author briefs, Phase 4

Pass **absolute paths** to every subagent. Tell the user where the directory is in your final report, and offer to save `test-plan.md` into the repo if they want it reviewed or committed.

Track the phases with TodoWrite; this is a long pipeline and the user should be able to see where it is.

### Skills and agents are namespaced

Everything this plugin ships is addressed as `testing:<name>`. **There is no bare-name fallback** — `Skill("behavior-extraction")` does not resolve; `Skill("testing:behavior-extraction")` does.

- **Skills** — `testing:testing`, `testing:behavior-extraction`, `testing:test-planning`, `testing:spec-test-writing`, `testing:spec-test-verification`
- **Agents** — `testing:test-planner`, `testing:test-plan-critic`, `testing:spec-test-author`, `testing:test-code-critic`. Recon uses the built-in `Explore` agent.

If a skill will not load, say so and continue with the `testing:testing` skill's references rather than proceeding on memory — the phase skills carry the procedures, and improvising them silently is how this pipeline produces a plausible-looking run that skipped its own gates. If a plugin agent is unavailable, fall back to `general-purpose` and paste the agent file's instructions into the prompt yourself; do not silently skip the step.

---

## Phase 0 — Intake

Interpret `$ARGUMENTS` to locate the description. Do not read any production code in this phase or the next one's first lane.

| Argument shape | Action |
|---|---|
| Prose | That is the description |
| A file path | Read it |
| A number, or a GitHub URL | `gh pr view <n> --json title,body,url` or `gh issue view <n> --json title,body,url`; follow linked issues |
| A ticket key (`ABC-123`) | Use a JIRA/tracker MCP server if one is connected; otherwise ask the user to paste the ticket |
| Empty | Reconstruct the description from this session's conversation and **show it back for confirmation** before proceeding |

**For a PR, the oracle is the PR description plus any linked issue — not the diff.** The diff is read later, in recon, only to locate entry points and observe what exists. A diff is evidence of what was written, never evidence that it is correct. Testing a PR against its own diff is the exact circularity this command exists to break.

If the description is too thin to yield even one testable behavior — a title with no body, "fix the thing" — stop and ask for more. Do not proceed to invent a specification.

## Phase 1 — Explore

Two lanes with different rules. **Lane A runs first and completes before Lane B starts**, so the behavior spec cannot be contaminated by implementation detail.

**Lane A — behavior extraction.** Load the `testing:behavior-extraction` skill. Work only from the description. Produce `behavior-spec.md`: numbered behaviors with stable IDs, each in Given/When/Then, each anchored to a quote from the source, plus the unspecified-behavior register.

**Lane B — codebase recon.** Now spawn `Explore` agents (read-only; run them in parallel when the questions are independent) to answer, and write `recon.md`:

1. **Test framework, runner, and command.** How is the suite invoked? Are there separate unit/integration/E2E commands?
2. **Existing coverage of these behaviors.** For each behavior ID, is there already a test? Give file and test name. This is the dedupe input and it matters — re-testing covered behavior is the most common waste this pipeline can produce.
3. **Suite conventions.** Naming scheme, file layout, assertion library, existing builders/factories/fixtures/harnesses, how the suite handles the clock, IO, and the database.
4. **Observable surface.** The public entry points through which each behavior's outcome can be observed, and what test infrastructure exists at each scope (in-process host? containers? seeded database?).
5. **Seams and obstacles.** Anything that would make a behavior hard to reach in a test — statics, hidden IO, global config.

Give each `Explore` agent the behavior spec and this instruction verbatim: *"Report what exists. Do not report what the code computes as though it were the correct answer — expected values are not your output."*

Recon will surface behavior anyway — that is unavoidable when reading a codebase. Anything it reveals that the description never stated enters the spec as an **`observed`** behavior with its code location, never as a `stated` one, and never as an expected value inside an existing behavior. The `behavior-extraction` skill's "When a Behavior Came from the Code" section governs what happens to it.

## Phase 2 — Depth gate

Summarize what Phase 1 found and let the user choose the pipeline depth. Use `AskUserQuestion`. Carry the evidence, not a bare question:

- Behavior count, and how many are already covered
- Scopes the plan will likely need
- Roughly how many subagents each path spawns

Recommend, don't just offer. **Light** — planning inline, one critique pass, one author, one code review — is right for a handful of behaviors at a single scope. **Full** — planner agent, up to two adversarial critique rounds, parallel authors, adversarial code review — earns its cost when there are many behaviors, multiple scopes, or new test infrastructure to design. Say which you'd pick and why in one line.

`--light` or `--full` in `$ARGUMENTS` skips this gate. If every behavior is already covered, say so and ask whether to stop rather than manufacturing work.

## Phase 3 — Plan

Load the `testing:test-planning` skill and follow it. In outline:

1. **Draft the plan.** Full path: spawn the `test-planner` agent with the absolute paths to `behavior-spec.md` and `recon.md`. Light path: do it yourself.
2. **Critique it.** Spawn the `test-plan-critic` agent. Address every finding you accept; say why for any you reject. Re-run the critic only if the plan changed materially — at most twice, and "no material findings" is a valid terminal result, not a failure to try hard enough.
3. **Review with the user.** Present the traceability matrix, the scope decisions, the unspecified-behavior questions, any `observed` behaviors with your proposed exit for each, and what is deliberately not being tested. Their answers become part of the spec. **Do not proceed without approval** — this gate is the cheapest point in the whole pipeline to change direction.

Write the approved result to `test-plan.md`. It is a contract: Phase 4 implements it and Phase 5 audits against it. Any deviation during authoring gets reported, not absorbed.

## Phase 4 — Write

Load the `testing:spec-test-writing` skill and follow it. In outline: shared scaffolding first and serialized, then authors fan out over disjoint files, then the `test-code-critic` agent reviews what they wrote for simplicity, maintainability, and conformance with the existing suite. Address the findings.

If `--bdd` is set, or recon found that the production code does not exist yet, the tests are written first and are expected to fail. That is the point; do not stub production code to make them pass unless the user asks for the implementation too.

## Phase 5 — Verify

Load the `testing:spec-test-verification` skill and follow it: audit traceability in both directions, run the whole suite, classify every failure, and report honestly — including which behaviors appear unimplemented and which tests you could not run.

---

## Rules that hold across all phases

- **Never edit production code** to make a test pass, unless the user has asked for the implementation as well. If a test cannot reach the behavior at all, that is a seam problem — report it and propose the minimal change, per `references/legacy-code.md`.
- **Never weaken or delete an assertion** to get green. A red spec-derived test is a finding.
- **Never let a subagent's claim of verification stand in for evidence.** Authors report the command they ran and its output, or they report that they could not run it and why.
- **Do not commit** unless the user asks.
