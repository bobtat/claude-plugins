# testing

A Claude Code plugin that teaches Claude to write tests worth having — and to recognize the ones that aren't.

## What It Does

The premise: a test earns its place by two properties — it **fails when behavior breaks**, and it **stays quiet when behavior doesn't**. Most bad tests fail one of those, usually because they were written against the implementation instead of the behavior. Everything in the plugin serves those two properties.

Adds an auto-triggering knowledge skill, a spec-driven writing pipeline, a repo-scale audit, and three commands:

- **Test-design fundamentals** — naming that identifies what broke, arrange/act/assert discipline, whole-value assertions, builders over copy-pasted setup, how to choose test cases (happy path → branches → boundaries → equivalence classes), and coverage as a diagnostic rather than a target
- **A test-double decision framework** — the five doubles and what each couples you to, the query/command distinction that removes most mock bloat, fakes over mocks with contract tests to keep the fake honest, injecting clock/randomness/IO, and reading over-mocking as a production design signal
- **Scope selection** — unit (solitary vs. sociable), integration, contract, and E2E: which slice can actually catch which defect, pyramid vs. testing trophy and how to tell which your system needs, suite organization, and speed budgets
- **Acceptance criteria and outside-in** — the story template, Given/When/Then and how it maps onto arrange/act/assert, ubiquitous language, when Gherkin tooling earns its cost and when it's pure overhead, and why most scenarios should become unit tests rather than end-to-end tests
- **Legacy-code workflow** — characterization tests, seam discovery, the minimal mechanical changes that make untestable code testable, and sequencing tests before a risky change
- **Browser and component testing** — selector strategy and why the DOM is an implementation detail, retry-ability and why bare waits are almost never right, what counts as an assertion in a retrying API, component vs. E2E, and the network as the boundary
- **An anti-pattern catalog** — thirteen anti-patterns with the fix for each, and for every one, when the thing that looks like it is actually correct
- **A sources file** — where each idea comes from, which parts are the plugin's own synthesis, and what it knowingly doesn't cover
- **`/test-review`** — audits tests (a path, or the current branch's changed tests) against all of the above and reports findings by severity
- **`/test-write`** — takes a described behavior (a JIRA ticket, a GitHub PR or issue, a spec file, or free text) and runs a four-phase, plan-gated pipeline that produces tests of *that description*
- **`/test-audit`** — assesses a whole repository and returns a risk-ranked map of where test protection is weakest relative to what it guards

The guidance is language-agnostic; the five worked examples span C#, Python, and TypeScript deliberately.

### Which command

| You have | Use |
|---|---|
| Specific test files, or a branch's changed tests | `/test-review` — per-test defects, capped at ~10 findings |
| A described behavior — ticket, PR, spec, paragraph | `/test-write` — tests of that description |
| A whole repository and no idea where it's weak | `/test-audit` — a map, then drill down with the other two |

They compose: the audit finds a weak area, `/test-review` says what's wrong with its tests, `/test-write` writes the ones that are missing.

## The Description Is the Oracle

`/test-write` exists to answer a different question from "does this code work." It answers **is the described behavior correctly captured in the code** — and those come apart constantly.

The failure it is built to prevent is subtle and extremely common in agent-written tests. An agent reads the implementation, sees `discount = 0.15`, and writes `expect(discount).toBe(0.15)`. The test passes forever. It cannot fail, because its expected value was copied from the thing it was supposed to check. Every test derived from the code under test has this property, and a suite full of them looks exactly like a suite that works.

So one rule runs through every phase, restated verbatim to every subagent:

> Expected outcomes come from the description. If the description does not say what should happen, that is a question for the user — never a value to read out of the implementation.

Its corollary is what makes the pipeline useful rather than merely careful: **a spec-derived test that goes red is a finding, not a problem to fix.** It means the code may not do what the ticket said. The pipeline never weakens an assertion to reach green, and a run that ends with red tests and a written explanation of which described behavior appears unimplemented is a successful run.

For a pull request, this makes the circularity concrete: the oracle is the PR description and its linked issue, never the diff. A diff is evidence of what was written, not evidence that it is correct — so testing a PR against its own diff produces a suite that ratifies whatever was written, bugs included.

The rule cannot be absolute, because recon reads the codebase and brownfield work is full of behavior nobody ever wrote down. So implementation-derived behavior gets a label rather than a prohibition: `observed`. It is not a weaker `stated` — it is the declaration that a behavior has **no oracle at all**, and it carries exactly three exits. The user confirms it and it becomes `stated`; or it becomes a characterization test, named as documenting current behavior and never counted as proof the behavior is right; or it is dropped. What it never becomes is an ordinary passing test, which is what an unlabeled observation turns into by default.

## The `/test-write` Pipeline

**Phase 1 — Explore.** Two lanes with different contamination rules. Lane A extracts the behavior spec from the description **before any code is read**: numbered behaviors in Given/When/Then, each anchored to a verbatim quote from the source, each labeled `stated`, `implied`, or `inferred` — plus an explicit register of what the description leaves open (boundaries, absence, precedence, dependency failure, rounding, authorization). Lane B then fans out read-only `Explore` agents for codebase recon: test framework and command, existing coverage per behavior, suite conventions, the observable surface, and seams. Recon informs *where and how*; it never informs *what should happen*, and behavior it turns up that nobody described is recorded as `observed` with its code location rather than folded into the spec.

**Phase 2 — Depth gate.** You choose light or full, after exploration, with the evidence in hand: how many behaviors, how many already covered, which scopes are needed, how many agents each path spawns. A recommendation comes with it. `--light` / `--full` skip the prompt.

**Phase 3 — Plan.** An opus planner produces a traceability matrix — every case named with its behavior ID, scope, and doubles — plus a written rationale for the coverage depth of each behavior and, critically, **the cases considered and dropped with reasons**. It reconciles against existing tests, and flags *conflicts* where a green test asserts something the description contradicts. Then an opus critic attacks it under a fixed charter: oracle contamination, fabricated requirements, missing behaviors and boundaries, scope inflation and deficit, redundancy, framework-testing, double overuse. At most two rounds, and "no material findings" is an expected terminal answer rather than a failure to try hard enough. Then a hard user gate — the plan does not proceed without approval, and this is where the open boundary questions get answered and each `observed` behavior gets its individual call: intended, a bug, or noise.

**Phase 4 — Write.** Shared scaffolding first and serialized (one builder, not four), then sonnet authors fan out over **disjoint files**, each holding the slice of the matrix it owns and the behaviors that are its oracle. Authors may not edit production code, change the plan, add cases, or claim a test passed without pasting the command output. Then an opus critic reviews the result for oracle integrity, traceability, conformance with the surrounding suite, simplicity, and test architecture — including over-abstraction, which generated test code produces more often than people expect.

**Phase 5 — Verify.** Traceability audited in both directions, including the check that matters most: does each test actually assert what its behavior's `Then` clause says? Then the **whole** suite runs, and every failure is classified — spec/code mismatch, not-implemented-yet, test defect, environment, or pre-existing. The report names which described behaviors are genuinely protected, which are only nominally covered, and which tests could not be run at all.

Each phase is its own skill, so only the phase in flight occupies context.

## Auditing a Whole Repository

`/test-audit` answers a question neither other command can: **where is this suite weakest relative to what it protects?**

It is deliberately not a bigger `/test-review`. Reviewing a repository file by file produces hundreds of findings nobody acts on, and misses the findings that only exist in aggregate — that the fast slice is 4% of the suite, that 47 files sleep, that the module with the worst bug history has the thinnest tests. None of those are visible one file at a time.

**It does not reimplement coverage tools.** It runs the repo's own, and adds the cross-reference no coverage tool can do alone:

| Coverage | Assertion quality | Reading |
|---|---|---|
| Low | — | An honest gap — the tool already found it |
| High | Strong | Genuinely protected |
| **High** | **Weak** | **The dangerous cell.** Looks safest, protects least — and only reading finds it |

Five phases: inventory the stack and runner; sweep the test tree mechanically with ripgrep (a five-thousand-file suite cannot be read, and pretending otherwise is how audits lie); rank modules by **risk × weakness**; gate on the user for depth; then deep-read only the selected areas in parallel and synthesize.

The risk half of that ranking is Michael Feathers' churn-vs-complexity view, extended with coverage as a third dimension by Ernesto Tagwerker's Skunk — both credited in `references/sources.md`, including the note that Feathers' original article was unreachable from this environment and the paraphrase is second-hand. The plugin's own addition is **defect history as the primary signal**: `fix`/`hotfix`/`revert` commits per module, which is the closest thing to an oracle available at repo scale. A module that has repeatedly produced bugs and has thin tests is the top of the map by definition, with the evidence attached.

Two design constraints do most of the work:

- **Systemic findings before specific ones.** *"64 test files construct `DateTime.Now` directly; the clock is not injected anywhere in the domain layer"* is one finding with a production-side fix — not 64 findings. A hundred specific findings sharing one cause is one finding reported wrong.
- **Mutation testing is offered, never assumed.** It is the only measure that answers "would these tests notice a defect," and it can take hours, so it runs on explicit approval and only against the single top-ranked module.

The audit diagnoses; it doesn't treat. It ends by handing off to `/test-review` for per-test depth and `/test-write` for the gaps whose intended behavior is known.

**What it cannot tell you:** whether the behavior is *correct*. At repo scale there is no description of what the system should do, so there is no oracle — the audit reports whether the suite would notice a change, and says so in every report. A well-protected module can be well-protected wrong.

## Browser Suites Get Their Own Patterns

A generic TypeScript sweep is not just imprecise against a Cypress suite — it is wrong in a way that fails silently. Measured against a Cypress fixture:

| Signal | Generic TS/JS pattern | Actually present |
|---|---|---|
| Assertions | **0** | `.should()` / `.and()` throughout |
| Sleeps | **0** | `cy.wait(500)` |
| Network doubles | **0** | `cy.intercept()` |

The first row is the dangerous one. The audit's cheapest high-value check compares test declarations against assertions to find tests that assert nothing — and since idiomatic Cypress contains almost no `expect(`, that check would flag **every file in the suite**. So the sweep detects the framework first and switches pattern sets, and `references/ui-testing.md` carries the criteria for reading them.

Three things that reference gets right which a generic test-quality rubric doesn't:

- **Selector coupling is the UI form of testing implementation.** A CSS class is as much an internal as a private field. Cypress and Playwright independently document the same prescription — `data-*` attributes and user-facing queries over CSS and XPath — so a suite full of `cy.get('.btn-primary')` is failing its own tooling's advice, not a matter of taste. The **brittle-to-stable selector ratio** is the best single fragility metric available without reading anything.
- **A bare `cy.get(...)` chain is not assertion-free.** It fails when the element never appears, so it asserts existence — an existence-only smoke test, which is a real but much weaker finding than a vacuous test. Getting this distinction wrong in either direction produces a useless report.
- **End-to-end tests can't be attributed to a module.** One `checkout.cy.ts` traverses routing, auth, cart, pricing, and payment. The audit scores them as *journey-level* protection that never raises any module's score — so a repo whose entire suite is browser E2E correctly reads as near-zero module protection plus a handful of covered journeys.

`/test-review` gained the same vocabulary, and `/test-write` needed none: its outside-in rule — one outer test proves the wiring, the remaining scenarios become fast tests underneath — is already the corrective for an E2E-heavy suite.

## Why It Emphasizes Fakes Over Mocks

Not just taste. Hora and Robbes measured test doubles across 1,254,878 commits from 2025 in 2,168 repositories, isolating the 48,563 authored or co-authored by Claude Code, Copilot, or Cursor ([MSR '26](https://arxiv.org/abs/2602.00409)). Agent-authored test commits add mocks somewhat more often than human ones (36% vs. 26%), though the effect size is small at best and negligible in lower-activity repositories.

The sharper finding is *which* doubles. Across the 496 repositories with agent mock activity, the share containing at least one agent commit using each type, versus non-agents: mock 95%/91%, **fake 32%/57%**, spy 33%/51%, dummy 19%/40%, stub 14%/30%. Agents use a narrower range, and the type they most under-use relative to humans is the **fake** — the double this plugin most recommends, because it verifies by state and so survives refactoring.

The paper's own recommendation is to put mocking guidance into agent configuration files. That is what `references/test-doubles.md` is for, and why `SKILL.md` puts a hard gate in front of every mocking-library call.

One habit the skill emphasizes above the rest: **watch every test fail before trusting it.** A test never seen red may be asserting nothing, and that class of test is the most expensive thing in a suite — full maintenance cost, zero protection, plus false confidence. The skill specifies getting that red from the *test* side (change the expectation, confirm, restore) rather than by mutating production code, and requires saying so explicitly when the suite can't be run at all.

And one structural choice worth knowing about: the guidance is written as **procedures with gates**, not as advice. There is an ordered sequence for writing tests, and a hard stop before any call to a mocking library that requires naming the double and justifying why a real object won't serve. Rubrics change how an LLM evaluates test code after the fact; gates change what it writes.

## Installation

```
/plugin marketplace add bobtat/claude-plugins
/plugin install testing@bobtat-plugins
```

Or test locally:

```bash
claude --plugin-dir C:\Users\Robert\Documents\GitHub\claude-plugins\plugins\testing
```

## Usage

The skill triggers automatically — including when Claude has just written production code and is about to test it. It also activates on requests like:

- "Write tests for this class"
- "Add tests for the discount calculation"
- "Review my tests"
- "Why is this test flaky?"
- "Should I mock the repository here?"
- "This code has no tests and I need to change it"
- "How do I test this — it seems untestable"

The commands are explicit:

```
/test-review                          # tests changed on this branch
/test-review tests/billing            # a specific directory
/test-review src/**/*.spec.ts         # a glob
```

```
/test-write 1284                      # a GitHub PR or issue
/test-write PROJ-455                  # a ticket, via a connected tracker MCP
/test-write docs/specs/refunds.md     # a spec file
/test-write "cancellations more than 24 hours ahead are refunded in full"
/test-write                           # behavior described earlier in the session
/test-write 1284 --full               # skip the depth gate, run the full pipeline
/test-write PROJ-455 --bdd            # tests first; the code does not exist yet
```

```
/test-audit                           # the whole repository
/test-audit src/billing               # scope to a subtree — useful on a monorepo
/test-audit --no-coverage             # skip running any coverage tool
/test-audit --mutation                # pre-approve the mutation run on the top module
```

Claude loads the lean core skill on trigger and pulls in the detailed references and worked examples only when the task needs them. `/test-write` loads its four phase skills one at a time, so a long run does not carry every phase's instructions in context at once.

## Structure

```
testing/
├── .claude-plugin/plugin.json
├── commands/
│   ├── test-review.md                            # Per-test quality audit of files or a branch diff
│   ├── test-write.md                             # Orchestrates the spec-driven pipeline and its gates
│   └── test-audit.md                             # Orchestrates the repo-scale audit and its gates
├── agents/
│   ├── test-planner.md                           # opus  — designs the plan and its traceability matrix
│   ├── test-plan-critic.md                       # opus  — attacks the plan under a fixed charter
│   ├── spec-test-author.md                       # sonnet — writes one disjoint slice, reports evidence
│   ├── test-code-critic.md                       # opus  — reviews the written tests against the spec
│   └── suite-auditor.md                          # sonnet — aggregate protection verdict for one area
└── skills/
    ├── testing/
    │   ├── SKILL.md                              # Procedure, the mocking gate, scope + doubles tables, anti-pattern index
    │   ├── references/
    │   │   ├── test-design.md                    # Naming, AAA, assertions, case selection, builders, coverage
    │   │   ├── test-doubles.md                   # Dummy/stub/spy/mock/fake, fakes over mocks, injecting nondeterminism
    │   │   ├── test-scope.md                     # Unit/integration/contract/E2E, pyramid vs trophy, speed budgets
    │   │   ├── legacy-code.md                    # Characterization tests, seams, sprout & wrap
    │   │   ├── bdd.md                            # Story template, GWT, outside-in, when Gherkin pays for itself
    │   │   ├── ui-testing.md                     # Selectors, retry-ability, component vs E2E (Cypress, Playwright)
    │   │   ├── anti-patterns.md                  # Thirteen anti-patterns, fixes, and their legitimate forms
    │   │   └── sources.md                        # Bibliography, own-synthesis boundary, known gaps
    │   └── examples/
    │       ├── overmocked-test-rewrite.md        # 7 doubles → 0, by extracting the decision (C#)
    │       ├── characterization-tests-legacy-code.md # Lock, seam, change, fix — as four commits (Python)
    │       ├── table-driven-parameterized-tests.md   # When a table helps and when it hides meaning (TypeScript)
    │       ├── taming-a-flaky-test.md            # Clock injection and awaited work instead of sleeps (C#)
    │       └── outside-in-from-a-story.md        # Story → criteria → outer test → units (TypeScript)
    ├── behavior-extraction/SKILL.md              # /test-write 1A — ticket/PR/text → behavior spec, no code read
    ├── test-planning/SKILL.md                    # /test-write 3  — cases, depth, scope, critique charter, user gate
    ├── spec-test-writing/SKILL.md                # /test-write 4  — scaffolding, fan-out, evidence, code review
    ├── spec-test-verification/SKILL.md           # /test-write 5  — traceability audit, suite run, failure triage
    └── test-auditing/
        ├── SKILL.md                              # /test-audit    — risk model, systemic vs specific, honesty rules
        └── references/detection-patterns.md      # Sweep patterns per ecosystem and for browser suites; coverage + mutation tooling
```

## Related Plugins

- **[refactoring](../refactoring)** — the diagnostic counterpart: reads test pain as a signal about production design, and provides the behavior-preserving workflow this plugin's legacy-code guidance hands off to.
- **[ddd](../ddd)**, **[mediatr](../mediatr)**, **[graphql](../graphql)** — each carries a `testing.md` reference with C#-specific patterns for that layer (aggregates and value objects, handlers and pipeline behaviors, resolvers and schema).

## License

MIT
