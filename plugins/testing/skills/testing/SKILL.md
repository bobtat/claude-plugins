---
name: testing
description: This skill should be used whenever writing, reviewing, or fixing tests — when the user asks to "write tests", "add tests for X", "test this function/class", "improve test coverage", "review my tests", "why is this test flaky", "should I mock this", "how do I test X", mentions TDD or characterization tests, asks how to test code that has no tests or seems untestable, or when Claude has just written production code and is about to add tests for it. Provides test-design fundamentals, a test-double decision framework, scope selection (unit/integration/contract/E2E), an anti-pattern index, and a workflow for testing legacy code.
---

# Writing Tests Worth Having

## Overview

A test earns its place by two properties: it **fails when behavior breaks**, and it **stays quiet when behavior doesn't**. A test that misses real breakage is theater. A test that goes red on every refactor is a tax on all future work. Most bad tests fail one of these two, and almost always for the same underlying reason — they were written against the *implementation* instead of the *behavior*.

Those two properties are Kent Beck's **behavioral** and **structure-insensitive** [test desiderata](https://testdesiderata.com/); Khorikov names the same pair *protection against regressions* and *resistance to refactoring*. Provenance for everything here, including measured evidence that LLM-authored tests over-reach for interaction mocks, is in `references/sources.md`.

Two rules govern everything below:

1. **Test observable behavior through the public surface.** The unit under test is a behavior, not a class or a file. If the test knows how the code works internally, it will break when the internals change — which is exactly when a test should be silent.
2. **One reason to fail per test.** When a test goes red, its name and its single assertion focus should tell you what broke without reading the body.

## Before Writing Any Test

Answer these four questions first. Skipping them is what produces tests nobody trusts:

1. **What behavior am I pinning down?** State it as a sentence: "an order with no lines cannot be placed." If it can't be stated without naming a private method, the target is wrong — step back to the caller's perspective.
2. **What is the observable outcome?** A return value, a state change visible through the public API, a raised event/error, or a message sent across a real boundary. If the only observable is "method X was called on my own internal helper," there is no behavior here worth testing.
3. **What is the smallest scope that can observe it?** See the scope table below. Cheapest scope that can genuinely see the outcome wins.
4. **Where are the real boundaries?** Only genuine boundaries — network, clock, filesystem, randomness, third-party services, and things that must be *sent* — are candidates for doubles. See the doubles table.

Then, critically: **watch the test fail before you make it pass.** A test never observed red may be asserting nothing at all (wrong setup, swallowed exception, vacuous loop, assertion inside an untaken branch). This one habit eliminates the largest class of worthless tests.

For a test added to already-passing code, get the red from the **test side**: change the expected value to something wrong, run it, confirm it fails for the reason you expect, then restore it. Do not edit production code to force a failure — an agent that mutates production code and relies on remembering to revert can leave a defect in the tree if anything interrupts the sequence. Reach for a production-side change only when the test-side one cannot distinguish (e.g. verifying that a guard clause is what rejects the input), and revert it in the same step.

**If you cannot run the suite** — no dependencies installed, no database, wrong runtime — say so explicitly and list which tests you were unable to verify. Never describe a test as verified when you did not run it.

## Anatomy of a Good Test

- **Name states condition and expected outcome**, not the method name. `Place_WithNoLines_IsRejected` or `"rejects an order with no lines"` — never `TestPlace` or `Place_Works`. The name is what a reader sees when CI fails; it should make the body unnecessary.
- **Three visible phases** (arrange / act / assert), separated by blank lines. One action in the act phase. If there are two acts, there are two tests — or a missing test-data builder.
- **Only the values that matter appear in the test body.** Everything irrelevant to this behavior goes behind a builder or factory default. A test showing eleven constructor arguments when one of them drives the assertion buries its own point.
- **Assert whole values, not field-by-field** — within a size limit. Comparing a whole returned object against a fully specified expected one catches fields you forgot to think about; five separate field assertions do not. But this only holds while the whole value is small and every field is meaningful: roughly **six fields or fewer, no timestamps or generated ids**. Above that, a fully specified expected object is an inline snapshot, with all the brittleness of one — assert the whole value of the *relevant sub-object* instead, or use a partial matcher that names what it excludes (`expect.objectContaining`, `BeEquivalentTo(…, opt => opt.Excluding(…))`).
- **No logic in the test.** No `if`, no loops that assert, no computing the expected value with the same formula the production code uses. Expected values are written out literally — a hand-computed `47.50`, not `subtotal * rate`.
- **Deterministic and independent.** Passes alone, passes in any order, passes at 23:59 on Dec 31. No shared mutable state, no reliance on another test having run.
- **Fast enough to run constantly.** If the suite can't run on every change, it stops being a safety net and becomes a report.

Details, naming schemes, builder patterns, and parameterized-test guidance: `references/test-design.md`.

## Procedure: Writing Tests for a Unit

Follow this sequence rather than generating a test file in one pass. The order matters: deciding *which behaviors* before writing *any* test is what prevents both a thin suite and a bloated one.

1. **List the behaviors as sentences, and show the list** before writing code. "Rejects an order with no lines." "Applies the loyalty discount from three years." If a sentence needs "and", split it. This list is the test plan, and it is cheap for the user to correct — much cheaper than rewriting fifteen tests. For a *new* feature rather than existing code, the list is the acceptance criteria and is best written Given/When/Then, working from the outside in: `references/bdd.md`.
2. **Choose the cases, in this order,** stopping as soon as the next case would exercise no new behavior:
   - The **happy path** — one case, realistic in the value the behavior turns on.
   - **Each rejection or error branch** — every guard clause and every `throw`.
   - **Boundaries** — empty, zero, one, exactly-at-limit, one-over-limit, absent/null. Off-by-one bugs live almost exclusively here.
   - **Distinct equivalence classes** — cases the code treats *differently*. Several values on the same path are one test with a table, not several tests.
   - **State-dependent behavior** — each state where the outcome differs.
3. **Name the boundaries and pick doubles deliberately** — see the gate below. State, in one line per double, why the real object won't serve.
4. **Write one test, run it, confirm it can fail**, then move to the next. Not fifteen tests and then one run: a single failing run at the end tells you almost nothing about which test is wrong.
5. **Report honestly.** Which tests you ran, which you confirmed can fail, which you could not verify and why, and any behavior you found that looks like a bug.

## Choosing Test Scope

Pick the cheapest scope that can actually observe the outcome. "Unit" does not mean "one class with everything else mocked" — a unit test may freely use real, cheap collaborators it owns (a *sociable* unit test), and usually should.

| What you're verifying | Scope | Boundaries | Rough budget |
|---|---|---|---|
| A business rule, calculation, validation, or state transition | Unit, pure — plain values in, values out | None needed | < 1 ms |
| One object's behavior with its owned collaborators | Unit, sociable — real collaborators | Fake only clock/IO/random | < 10 ms |
| Query correctness, ORM mapping, schema, transaction/rollback semantics | Integration — real database in a container | Real DB, faked third parties | < 1 s each |
| HTTP contract: routing, status codes, serialization, auth | Integration — in-process app host | Real app, faked externals | < 1 s each |
| Agreement with a service you don't control | Contract test against a recorded/verified spec | The real shape, not your guess | — |
| One critical path works wired together for real | End-to-end — very few, only the money paths | Nothing faked | Seconds |

Mocking a database and asserting the SQL string tests your string-building, not your query. Either use the real database in the integration slice or don't claim the query works. Full guidance on the pyramid/trophy trade-off, suite organization, and speed budgets: `references/test-scope.md`.

## Choosing a Test Double

Reach for a double only when the real thing is genuinely unusable. Default to the real collaborator; default to a **fake** (a working in-memory implementation) over an interaction **mock**.

| Situation | Use | Don't |
|---|---|---|
| Pure function or value object | The real thing, real values | Any double at all |
| Collaborator you own and can construct cheaply | The real thing | Stub it "for isolation" |
| Repository / data store, in a unit test | In-memory fake implementing the same interface | A mock configured per query |
| Clock, `now`, timers, random, UUID, env, filesystem | Inject a deterministic value or controllable fake | `sleep`, freezing global time, real IO |
| Third-party network service | Fake behind *your own* port/interface | Mock the HTTP client library |
| An action whose whole point is being performed — email sent, payment charged, message published | A spy or mock; the call **is** the observable behavior | Assert internal state instead |
| Expensive infrastructure you own (DB, broker) | The real thing in a container, in the integration slice | A mock that pretends to be SQL |

### The gate

**Before writing `Substitute.For<T>`, `Mock<T>`, `mock()`, `jest.mock`, `vi.mock`, `unittest.mock.patch`, `MagicMock`, `mockito.mock`, or any equivalent — stop and answer two questions in one line each:**

1. **Which of the five doubles do I actually need** (dummy, stub, spy, mock, fake)?
2. **Why won't a real instance work, and why won't a fake?**

If you cannot answer the second, **use the real object.** This gate exists because reaching for a mocking library is the default reflex, and it is the wrong default: measured evidence shows LLM-authored test commits use a markedly narrower range of doubles than human ones, concentrating on interaction mocks (`references/sources.md`).

The objections that make people skip the fake — wide interface, only one method needed, no port to implement, where it lives — all have short answers, in "Building a Fake in Practice" in `references/test-doubles.md`. Read it once; none of them justify defaulting to a mock.

If a test needs more than two or three doubles of any kind, that is a signal about the production code — too many collaborators, or decision logic tangled with orchestration — not a cue to write more setup. Separate the pure decision from the I/O and the doubles disappear. Full taxonomy, contract tests that keep a fake honest, and injection patterns: `references/test-doubles.md`.

## Anti-Pattern Index

| Anti-pattern | Symptom while writing it | Do instead | Detail |
|---|---|---|---|
Every row has a full entry in `references/anti-patterns.md`, including an "actually correct when" clause. **Read that clause before reporting any of these as a finding** — several have legitimate forms, and skipping it is how a review manufactures false positives.

| Anti-pattern | Symptom while writing it | Do instead |
|---|---|---|
| Testing implementation instead of behavior | Asserting private state, call counts on internal helpers, or exact log strings | Assert the public outcome |
| Assertion roulette | Ten unlabeled assertions in one test | One behavior per test |
| Mock overuse | Setup longer than the assertion; mocks returning mocks | Extract pure logic; fake at real boundaries only |
| Logic in the test | `if`/loop in the body, or expected value computed | Straight-line test; literal expected values |
| Mystery guest | Test depends on "customer 42" from a shared fixture | Each test builds what it needs |
| Shared mutable fixture | Fixture mutated by tests; passes in file order, fails alone | Fresh state per test; share only immutable setup |
| Sleep-based waiting | `Thread.Sleep`/`setTimeout` to "let it finish" | Await the real signal; inject the clock |
| The test that cannot fail | Never seen red; asserts nothing meaningful | Confirm red from the test side, then restore |
| Snapshot everything | Huge approved blobs; any change fails all | Snapshot small, intentional outputs only |
| Testing the framework or language | Asserting record equality or ORM behavior works | Trust the library; test your rules |
| Coverage chasing | Tests written to touch lines, asserting nothing | Cover behaviors; use coverage to find gaps |
| Tests mirroring production structure | One test class per production class, mechanically | Organize by behavior/feature |
| Overspecified error assertions | Asserting exact exception message text, or catching a base type | Assert the type plus a stable code |

## Workflow: Adding Tests to Existing Code

1. **Establish what the code does now** — not what it should do. If behavior is undocumented, write **characterization tests**: assert the current output, including behavior that looks wrong. Do not fix a bug in the same step as locking it. **Do tell the user:** when characterizing reveals behavior that looks wrong, assert the current value, then say plainly what you found and ask whether to fix it now or leave the lock in place. Silently committing `assert fee == -105.00` with a `# BUG` comment answers a question the user probably meant to ask.
2. **Find the seam.** If the code can't be invoked in a test at all (statics, `new` inside the method, global config, hidden IO), apply the smallest mechanical change that creates a test seam — parameterize the constructor, extract a function, inject the dependency. Procedures: `references/legacy-code.md`.
3. **Cover the paths that matter first** — the happy path, then each rejection/error branch, then boundaries (empty, zero, one, maximum, null/absent). Not every permutation; the ones with distinct behavior.
4. **Confirm each test can fail** before moving on.
5. **Only then change behavior.** Tests written first are the behavior lock; with them green you can refactor or fix bugs and know immediately which one you broke.
6. **If — and only if — the user asks you to commit,** keep tests and behavior changes in separate commits: `test:` for the characterization lock, `refactor:` for any seams, then `feat:`/`fix:` for the behavior change. Characterization tests that document a bug go in before the `fix:` commit that corrects them, so the diff shows exactly which assertion changed. Adding tests is not by itself a reason to commit.

## What Not to Test

Writing these wastes effort and creates drag on every future refactor:

- **Framework and library behavior.** That the ORM saves, that a record's equality works, that the DI container resolves. Test your rules, not your dependencies.
- **Trivial accessors** with no logic.
- **Private methods directly.** If a private method needs its own test, it wants to be a public function on its own unit — extract it and test it there, or test it through the caller.
- **Generated or declarative code** with no hand-written branches.
- **Types the compiler already guarantees.** In a statically typed language, a test asserting a parameter can't be a string is dead weight.
- **Exhaustive permutations** where behavior doesn't vary. Three inputs on the same code path is one test with a table, not three tests.

Coverage is a diagnostic, not a target: use it to find untested *behaviors*, and treat a chase for a percentage as a way to manufacture tests that assert nothing.

## When the Starting Point Is a Description, Not Code

Everything above assumes you can see the code you are testing. When the starting point is instead a *described* behavior — a ticket, a PR description, acceptance criteria, a paragraph from the user — the job changes: you are checking whether the description is correctly captured in the code, and the code cannot be your source for what the answer should be.

Run **`/test-write`** for that. It extracts a behavior spec from the description before any code is read, plans coverage with a traceability matrix, gets your approval, then writes and audits the tests. The rule it enforces throughout is worth applying even when you are not running the command:

> Expected values come from the description. Where the description is silent, ask — never read the answer out of the implementation.

A test whose expected value was copied from the code under test cannot fail. And a spec-derived test that *does* fail is a finding — the code may not do what was described — never an assertion to weaken until it passes.

## Additional Resources

### Choosing a Command

| You have | Use |
|---|---|
| Specific test files, or a branch's changed tests | **`/test-review`** — per-test defects, capped at ~10 findings |
| A described behavior — ticket, PR, spec, paragraph | **`/test-write`** — tests of that description |
| A whole repository and no idea where it's weak | **`/test-audit`** — a risk-ranked map, then drill down with the other two |

### Workflow Skills

Loaded by the commands, one phase at a time; each is also useful alone.

- **`behavior-extraction`** — a ticket, PR, or paragraph → numbered behaviors in Given/When/Then, anchored to quotes, plus the register of what the description leaves unspecified.
- **`test-planning`** — behavior spec + recon → cases, coverage depth, scope, the adversarial critique charter, and the user gate.
- **`spec-test-writing`** — scaffolding before fan-out, disjoint file ownership, evidence over claims, adversarial code review.
- **`spec-test-verification`** — traceability audited both ways, full-suite run, and failure triage that distinguishes a wrong test from wrong code.
- **`test-auditing`** — repository-scale assessment: where protection is weakest relative to what it guards, found by mechanical sweep and a churn/defect risk model rather than by reading everything. Carries `references/detection-patterns.md` (per-ecosystem sweep patterns, coverage and mutation tooling).

### Reference Files

- **`references/test-design.md`** — Naming schemes, AAA, assertions, choosing test cases, builders, fixture scope, coverage philosophy.
- **`references/test-doubles.md`** — The five doubles and when each is correct; competing naming conventions for those words; fakes over mocks and contract tests to keep a fake honest; injecting clock/randomness/IO; over-mocking as a production design signal.
- **`references/test-scope.md`** — Unit (solitary vs sociable), integration, contract, E2E; pyramid vs. trophy; suite organization; speed budgets.
- **`references/legacy-code.md`** — Characterization tests, seam discovery, Feathers' change algorithm, sprout and wrap, sequencing a risky change.
- **`references/bdd.md`** — Acceptance criteria and outside-in development: the story template, Given/When/Then and how it maps to arrange/act/assert, ubiquitous language, when Gherkin tooling earns its cost and when it doesn't, and BDD-specific anti-patterns.
- **`references/anti-patterns.md`** — Each row of the index above, with the "actually correct when" clause for each.
- **`references/sources.md`** — Provenance for every claim, which parts are this plugin's own synthesis, and what is knowingly not covered. Consult when a recommendation here conflicts with a codebase's convention and you need to know how much weight it carries.

### Worked Examples

- **`examples/overmocked-test-rewrite.md`** — A mock-choreography test rewritten by extracting the pure decision and faking one real boundary (C#).
- **`examples/characterization-tests-legacy-code.md`** — Locking down an untested legacy function, finding a seam, then fixing the bug it revealed (Python).
- **`examples/table-driven-parameterized-tests.md`** — Collapsing duplicated near-identical tests into a table without hiding what each case proves (TypeScript).
- **`examples/taming-a-flaky-test.md`** — Removing nondeterminism at its source: injected clock and awaited completion instead of sleeps (C#).
- **`examples/outside-in-from-a-story.md`** — Story → acceptance criteria → one failing outer test → inward to fast unit tests, and why three scenarios should not become three end-to-end tests (TypeScript).
