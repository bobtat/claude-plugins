# Test Anti-Patterns

Each entry: how to recognize it, why it hurts, what to do instead, and — importantly — **when the thing that looks like it is actually correct**. That last section matters: applied without judgment, several of these rules produce worse tests than the anti-pattern.

Several of the names below are Gerard Meszaros' from *xUnit Test Patterns* (2007), where they are catalogued as test smells: **Assertion Roulette**, **Mystery Guest**, **Eager Test**, **Erratic Test**, **Fragile Test**, **Obscure Test**, **Conditional Test Logic**, **Test Code Duplication**, **Slow Tests**. The determinism entry follows Fowler's [Eradicating Non-Determinism in Tests](https://martinfowler.com/articles/nonDeterminism.html).

This file is about avoiding these at authoring time. The complementary *diagnostic* view — reading test pain as a signal about production design, e.g. walls of mock setup indicating a god class — is covered by the separate `refactoring` plugin, if the user has it installed. Don't attempt to read a file from it by relative path; it is a sibling plugin, not part of this one, and may be absent.

---

## Testing Implementation Instead of Behavior

**Recognize:** Assertions on private fields, internal call counts, method ordering, intermediate representations, or exact log output. Tests that go red during a pure refactoring where observable behavior provably didn't change.

**Why it hurts:** It inverts the value of a test. A good test constrains behavior and permits any implementation; this constrains the implementation and permits behavior changes to slip through. The suite becomes a change-detector rather than a correctness-checker, and the rational response to it — updating the expected values until green — makes it worse.

**Instead:** Assert what a caller could observe: return values, state readable through the public API, thrown errors, events raised, messages sent across a real boundary. When a test breaks during a refactor, treat it as a bug *in the test* — re-express the assertion behaviorally rather than editing the expected value.

**Actually correct when:** The "detail" is a real contract. Exactly-once charging of a payment card, a published event's schema, or the number of queries in a hot path are contracts worth asserting deliberately at the boundary that owns them.

---

## Assertion Roulette

**Recognize:** A dozen unlabeled assertions in one test; on failure, only the line number tells you which behavior broke. Frequently paired with a test name like `TestOrderFlow`.

**Why it hurts:** Diagnosis requires reading the test and reconstructing what it was verifying. Worse, the first failing assertion aborts the test, hiding the state of everything after it — you fix one, rerun, find the next.

**Instead:** One behavior per test, named for that behavior. Where several assertions genuinely describe one behavior, use soft/grouped assertions so all failures report at once, or a whole-value comparison instead of field-by-field checks.

**Actually correct when:** The assertions collectively describe a single outcome (a cancelled order's status, timestamp, and event) — that's one behavior expressed in three statements, best written as one whole-value assertion where the language allows.

---

## Mock Overuse

**Recognize:** Setup dominating the test; mocks returning mocks; every collaborator doubled; the assertions are mostly `verify(...)` calls.

**Why it hurts:** Such a test passes when every mock is configured as the code expects — which is a tautology, since both were written from the same assumption. It verifies choreography, not outcomes, and re-breaks on every internal change while catching almost no real defects.

**Instead:** Use real collaborators you own; fake at genuine boundaries; and above all separate the decision from the effect so most logic can be tested with plain values. Full treatment in `test-doubles.md`; worked transformation in `examples/overmocked-test-rewrite.md`.

**Actually correct when:** The unit under test is a genuine orchestrator whose entire job is coordinating boundaries, and the calls it makes *are* its behavior. Even then: a couple of doubles, verified deliberately — not a wall of setup.

---

## Logic in the Test

**Recognize:** `if`, `for`, `while`, `try`, or a computed expected value inside the test body.

**Why it hurts:** Three separate failure modes. A branch means part of the test is itself untested. A loop that asserts per element passes vacuously on an empty collection — the most common silently-useless test. And an expected value computed with the production formula asserts only that the code equals itself, passing even when the formula is wrong.

**Instead:** One straight-line scenario per test; literal, hand-computed expected values; whole-collection equality rather than loops; parameterized tests for real input matrices.

**Actually correct when:** Building a large fixture (a loop appending 100 rows in *arrange*) is fine — the constraint is on the act and assert phases, not on setup. Retry loops around a genuinely asynchronous condition are acceptable *if* using a proper polling assertion helper with a timeout, though awaiting a real signal is better.

---

## Mystery Guest

**Recognize:** The test's behavior depends on information not visible in the test — a magic row in a shared SQL fixture, a seeded record from another test, an environment variable, "user 42 is the admin."

**Why it hurts:** The test can't be read or trusted in isolation, and it can't be changed safely: editing the shared fixture breaks unrelated tests, so the fixture becomes append-only and grows forever.

**Instead:** Each test builds (or explicitly declares) what it needs, via builders/object mothers. Shared fixtures only for genuinely invariant reference data (currency codes, country lists) that no test mutates.

**Actually correct when:** Reference data that is immutable, invariant, and identical for every test — loaded once and never written to.

---

## Shared Mutable Fixture

**Recognize:** A fixture object or static field created once and mutated by tests; database rows left behind; tests passing in file order but failing when run alone or in parallel.

**Why it hurts:** Failures depend on execution order, which makes them nearly impossible to diagnose and impossible to reproduce reliably. It also blocks parallelization, which is usually the largest available speedup.

**Instead:** Fresh state per test — construction is cheap. Where setup is genuinely expensive (container, app host, schema), share the *setup* but isolate the *data*: transaction rollback per test, unique keys/tenants, or truncation between tests. Randomize test order in CI so order dependence surfaces immediately.

**Actually correct when:** Sharing immutable setup: a started container, a booted app host, a compiled schema, a read-only fixture.

---

## Sleep-Based Waiting

**Recognize:** `Thread.Sleep`, `await new Promise(r => setTimeout(r, 500))`, `time.sleep(2)` anywhere in a test.

**Why it hurts:** It is both flaky and slow — simultaneously too short on a loaded CI machine and far too long on a fast one. Sleeps accumulate until the suite is unusable, and the flakes they produce get "fixed" by lengthening them.

**Instead:** Fowler's rule is categorical: "Never use bare sleeps to wait for asynchonous responses: use a callback or polling." Await the real completion signal (return the task/promise, expose the queue, subscribe to the completion event). Inject the clock — "Always wrap the system clock, so it can be easily substituted for testing" — so time-dependent logic is driven rather than waited on. Where polling is genuinely unavoidable, use a polling assertion with a short interval and a generous timeout, never a bare sleep.

**Actually correct when:** Essentially never in a unit test. Legitimate only against a genuinely external asynchronous system you don't control, and then via a polling helper rather than a fixed sleep.

**The wider flakiness list.** Fowler identifies five causes of non-determinism, and one is easy to miss because it presents as an unrelated failure elsewhere: **lack of isolation**, **asynchronous behavior**, **remote services**, **time dependencies**, and **resource leaks** (exhausted connection pools, file handles, memory). The diagnostic trick for the last one is deliberately hostile: set the resource pool size to 1 in the test configuration, so a leak fails immediately and in the test that caused it rather than randomly in whichever test runs when the pool finally empties.

Quarantine before diagnosing: "Place any non-deterministic test in a quarantined area. (But fix quarantined tests quickly.)" The reason to move fast on quarantined tests is that tolerance is contagious — "Once that discipline is lost, then a failure in the healthy deterministic tests will get ignored too."

---

## The Test That Cannot Fail

**Recognize:** A test never observed red. Common shapes: no assertion at all (just "doesn't throw"); assertion inside an `if` that never runs; a loop over an empty collection; `assertNotNull` on something that's always non-null; an exception assertion so broad it catches setup failures; a mock so lenient the code path never executes.

**Why it hurts:** It's the most expensive kind of test — full maintenance cost, zero protection, plus false confidence and inflated coverage.

**Instead:** Verify every test can fail, once per test, when you write it. Get the red from the **test side**: change the expected value to something wrong, run, confirm it fails for the reason you expect, restore it. In TDD it's free — you saw red before you made it green. Mutation testing automates this check across the whole suite and is worth running periodically if tooling exists for your language.

Reach for a production-side change (invert a condition, return early) only when the test-side one cannot distinguish — verifying that a *guard clause* is what rejects the input, for example, where a wrong expected value would fail identically whether the guard fired or not. Prefer the test side otherwise, and never leave a production-side edit unreverted: an interrupted sequence leaves a real defect in the working tree, and that risk is why the test side is the default.

**Actually correct when:** A "does not throw" test is legitimate when not throwing is the actual behavior under test (a parser accepting valid input, a migration running idempotently) — assert the successful outcome too where one exists.

---

## Snapshot Everything

**Recognize:** Large approved/snapshot files covering whole pages, whole API responses, or entire object graphs. Any change fails dozens of snapshots; the fix is running `--update-snapshots`.

**Why it hurts:** Nobody reviews a 400-line snapshot diff, so the update becomes reflexive and real regressions get approved. The snapshot also asserts hundreds of incidental details, making it maximally fragile and minimally informative.

**Instead:** Snapshot small, intentionally designed outputs where the whole shape matters (a rendered template fragment, a generated SQL statement, a serialized event). Otherwise assert the specific behavior. Review every snapshot change as carefully as production code.

**Actually correct when:** Output is large, genuinely intentional, and reviewable — approval-testing a report format, or characterizing legacy output as a temporary lock (see `legacy-code.md`).

---

## Testing the Framework or Language

**Recognize:** Tests asserting that record/value equality works, that the ORM saves and loads, that the DI container resolves a registration, that a validation attribute rejects null, that a getter returns what the constructor set.

**Why it hurts:** It tests someone else's code, adds suite time, and breaks on library upgrades for no benefit. It also inflates coverage in a way that hides the absence of real behavioral tests.

**Instead:** Test your rules. If the concern is that *your configuration* is right (mapping correctness, DI wiring, validation attributes actually applied to the right fields), that's a legitimate narrow integration test of the configuration — a different and much smaller set of tests than one per property.

**Actually correct when:** Your own custom equality, custom serializer, custom validation attribute, or a mapping you configured by hand. You wrote it, so test it.

---

## Coverage Chasing

**Recognize:** Tests that call a method and assert nothing (or only `assertNotNull`); tests written to satisfy a percentage gate; test names like `TestConstructor`; a rule requiring N% before merge.

**Why it hurts:** It produces exactly the tests described in "The Test That Cannot Fail" at scale — maintenance cost, refactoring drag, false confidence. It also actively misleads: a high number over assertion-free tests is worse than a low number honestly reported.

**Instead:** Cover *behaviors*, and use coverage as a diagnostic to find behaviors you missed — uncovered branches and error paths are the useful signal. Measure coverage on changed lines in a diff rather than repo-wide. Prefer mutation testing where available, since it measures whether tests would notice a defect.

**Actually correct when:** Coverage on new/changed code is a reasonable review prompt ("this branch has no test — intentional?"). The failure is treating the number as the goal rather than as a question.

---

## Tests Mirroring Production Structure

**Recognize:** Exactly one test class per production class, mechanically, including thin classes; tests reorganized every time production classes are split.

**Why it hurts:** It couples the test suite's structure to the production structure, so every extraction breaks tests. That penalizes refactoring, which is backwards — the suite exists to make refactoring safe.

**Instead:** Organize by behavior and feature. One entry-point behavior may be covered by several focused test files; several small collaborating classes may be covered together through their entry point (see sociable unit tests in `test-scope.md`).

**Actually correct when:** A class has one cohesive responsibility and its behaviors fit naturally in one file — which is common and fine. The anti-pattern is the *mechanical rule*, not the resulting layout when it happens to match.

---

## Overspecified Error Assertions

**Recognize:** Asserting on exact exception message strings, or catching a broad base exception type and calling it a test.

**Why it hurts:** Exact-message assertions break on any wording or localization change while verifying nothing about behavior. Broad catches do the opposite — `Assert.Throws<Exception>` passes when the setup itself fails, so the test is green for the wrong reason.

**Instead:** Assert the specific exception type plus a stable machine-readable code or property. Assert user-facing message text only where the text is genuinely a contract, and then in one dedicated test rather than in every failure test.

**Actually correct when:** The message *is* the contract — a user-facing string someone signed off on, a documented API error body, a CLI output another tool parses. Assert it once, in a test named for the fact that the wording is a commitment, so the next person to reword it sees why it broke. Asserting a base exception type is correct essentially never; the one defensible case is a boundary that genuinely promises "anything thrown in here surfaces as `RequestFailed`," and then the test is about the wrapping, not the failure.
