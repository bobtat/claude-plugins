# testing

A Claude Code plugin that teaches Claude to write tests worth having — and to recognize the ones that aren't.

## What It Does

The premise: a test earns its place by two properties — it **fails when behavior breaks**, and it **stays quiet when behavior doesn't**. Most bad tests fail one of those, usually because they were written against the implementation instead of the behavior. Everything in the plugin serves those two properties.

Adds one auto-triggering skill plus one command:

- **Test-design fundamentals** — naming that identifies what broke, arrange/act/assert discipline, whole-value assertions, builders over copy-pasted setup, how to choose test cases (happy path → branches → boundaries → equivalence classes), and coverage as a diagnostic rather than a target
- **A test-double decision framework** — the five doubles and what each couples you to, the query/command distinction that removes most mock bloat, fakes over mocks with contract tests to keep the fake honest, injecting clock/randomness/IO, and reading over-mocking as a production design signal
- **Scope selection** — unit (solitary vs. sociable), integration, contract, and E2E: which slice can actually catch which defect, pyramid vs. testing trophy and how to tell which your system needs, suite organization, and speed budgets
- **Acceptance criteria and outside-in** — the story template, Given/When/Then and how it maps onto arrange/act/assert, ubiquitous language, when Gherkin tooling earns its cost and when it's pure overhead, and why most scenarios should become unit tests rather than end-to-end tests
- **Legacy-code workflow** — characterization tests, seam discovery, the minimal mechanical changes that make untestable code testable, and sequencing tests before a risky change
- **An anti-pattern catalog** — thirteen anti-patterns with the fix for each, and for every one, when the thing that looks like it is actually correct
- **A sources file** — where each idea comes from, which parts are the plugin's own synthesis, and what it knowingly doesn't cover
- **`/test-review`** — audits tests (a path, or the current branch's changed tests) against all of the above and reports findings by severity

The guidance is language-agnostic; the five worked examples span C#, Python, and TypeScript deliberately.

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

The command is explicit:

```
/test-review                          # tests changed on this branch
/test-review tests/billing            # a specific directory
/test-review src/**/*.spec.ts         # a glob
```

Claude loads the lean core skill on trigger and pulls in the detailed references and worked examples only when the task needs them.

## Structure

```
testing/
├── .claude-plugin/plugin.json
├── commands/
│   └── test-review.md                            # Test-quality audit
└── skills/testing/
    ├── SKILL.md                                  # Procedure, the mocking gate, scope + doubles tables, anti-pattern index
    ├── references/
    │   ├── test-design.md                        # Naming, AAA, assertions, case selection, builders, coverage
    │   ├── test-doubles.md                       # Dummy/stub/spy/mock/fake, fakes over mocks, injecting nondeterminism
    │   ├── test-scope.md                         # Unit/integration/contract/E2E, pyramid vs trophy, speed budgets
    │   ├── legacy-code.md                        # Characterization tests, seams, sprout & wrap
    │   ├── bdd.md                                # Story template, GWT, outside-in, when Gherkin pays for itself
    │   ├── anti-patterns.md                      # Thirteen anti-patterns, fixes, and their legitimate forms
    │   └── sources.md                            # Bibliography, own-synthesis boundary, known gaps
    └── examples/
        ├── overmocked-test-rewrite.md            # 7 doubles → 0, by extracting the decision (C#)
        ├── characterization-tests-legacy-code.md # Lock, seam, change, fix — as four commits (Python)
        ├── table-driven-parameterized-tests.md   # When a table helps and when it hides meaning (TypeScript)
        ├── taming-a-flaky-test.md                # Clock injection and awaited work instead of sleeps (C#)
        └── outside-in-from-a-story.md            # Story → criteria → outer test → units (TypeScript)
```

## Related Plugins

- **[refactoring](../refactoring)** — the diagnostic counterpart: reads test pain as a signal about production design, and provides the behavior-preserving workflow this plugin's legacy-code guidance hands off to.
- **[ddd](../ddd)**, **[mediatr](../mediatr)**, **[graphql](../graphql)** — each carries a `testing.md` reference with C#-specific patterns for that layer (aggregates and value objects, handlers and pipeline behaviors, resolvers and schema).

## License

MIT
