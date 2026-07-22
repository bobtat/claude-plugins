# Test Smells Catalog

Test smells matter twice: they make the test suite expensive to maintain, and — more importantly for refactoring — **they are instruments pointed at the production design**. Hard-to-write tests almost always indicate hard-to-use code. When diagnosing a test smell, always ask what production problem it signals before "fixing" the test cosmetically.

A second reason test smells matter here: the test suite is the safety net for all other refactoring. A fragile or flaky suite makes every refactoring slower and riskier, so test smells often deserve fixing *first*.

---

## Fragile Test (breaks when behavior didn't change)

**Signs:** Refactoring production code — with observable behavior provably unchanged — turns tests red. Tests assert on private state, call order, or intermediate representations rather than outcomes.

**Production signal:** Usually none — this one is a genuine test-design fault. Tests are coupled to *implementation* rather than *behavior*.

**Fix:** Assert on observable outcomes (return values, state visible through the public API, messages sent across a real boundary). Treat "test broke during pure refactor" as a bug in the test: rewrite the assertion at the behavioral level, don't just update the expected value.

## Excessive Mocking / Mock Overuse

**Signs:** Test setup dominated by mock configuration; mocks returning mocks; every collaborator of the unit replaced; tests that mainly verify the mock choreography (`verify(x).calledWith(...)` many times over).

**Production signal:** **This is the loudest design smell in the catalog.** The unit under test has too many collaborators (high fan-out), depends on concrete implementations, or mixes logic with orchestration. Feature Envy and Middle Man smells frequently sit underneath.

**Fix the production code:** separate pure decision logic (test it with plain values, no mocks) from I/O orchestration (test thin with a couple of integration tests). Introduce Parameter Object or restructure so the unit takes *data in, data out*. Mock only at genuine architectural boundaries (network, clock, filesystem, randomness) — and prefer fakes (in-memory implementations) to interaction mocks even there.

## Assertion Roulette

**Signs:** Many assertions in one test with no identifying messages; when it fails, the failure line number is the only clue which behavior broke.

**Fix:** One behavior per test (split the test); or use assertion messages / grouped assertion blocks. If splitting one test into five reveals five setups of ten lines each, that duplication is the next smell (see Test Code Duplication) — and possibly a production Long Parameter List / missing builder.

## Eager Test

**Signs:** One test exercising several methods/behaviors of the unit in sequence, asserting along the way. Often named `testProcessWorks` or `testEverything`.

**Production signal:** Sometimes indicates the unit's operations can't be exercised independently — hidden temporal coupling (`init()` must precede everything; method B only works after method A). That temporal coupling is a production smell: make the sequence explicit (constructor does the setup; or a method object owns the sequence).

**Fix:** Split into one test per behavior; extract shared setup into fixture/arrange helpers.

## Mystery Guest

**Signs:** The test depends on information not visible in the test body — a magic row in a shared fixture file, a record seeded by another test, an environment variable, "customer 42 is special."

**Why it hurts:** The test can't be understood or trusted in isolation; editing the shared resource breaks unrelated tests.

**Fix:** Make each test build (or clearly declare) what it needs: builders/object mothers for domain data, per-test database state. Shared fixtures only for genuinely invariant reference data.

## Erratic / Flaky Test

**Signs:** Passes and fails without code changes. Causes, in rough frequency order: shared mutable state between tests (order dependence), real time/clock, concurrency and unawaited async work, network/external services, unseeded randomness, floating-point comparison.

**Production signal:** Time flakiness → production code reads the clock directly (inject a clock). Order dependence → hidden global/static state in production code. Async flakiness → missing synchronization the production code may also lack.

**Fix:** Quarantine immediately (a flaky test is worse than no test — it trains people to ignore red), then remove the nondeterminism at its source, preferring production-side injection of clock/randomness/IO over test-side sleeps and retries. Never fix flakiness with `sleep`.

## Conditional Test Logic

**Signs:** `if`/`for`/`try` inside a test body — the test computes what to assert, or asserts different things on different paths.

**Why it hurts:** A test with branches has untested branches of its own; a loop that asserts nothing when the collection is empty passes vacuously.

**Fix:** One straight-line scenario per test; parameterized/table-driven tests for genuine input matrices; assert collection contents with whole-value equality rather than loops.

## Test Code Duplication

**Signs:** The same multi-line arrange block pasted across dozens of tests; copies drift as the constructor changes.

**Production signal:** Painful arranging often means painful construction for real callers too — Long Parameter List, required-but-irrelevant dependencies, missing sensible defaults.

**Fix:** Test-data builders with defaults (`anOrder().withThreeItems().build()`); shared arrange helpers. Improve the production constructors where the pain originates.

## Slow Test Suite

**Signs:** Suite so slow that running it after every refactoring step (as the workflow requires) is impractical, so people batch changes and lose the safety net.

**Production signal:** Usually logic is only testable *through* I/O — business rules reachable only via HTTP+database mean the architecture lacks a pure core.

**Fix:** Extract decision logic into pure, fast-testable units (this is the same fix as Excessive Mocking — the two smells are siblings); keep a small integration suite for the wiring. Organize so a sub-second unit slice can run on every step, with the full suite at commit time.

## Testing Implementation Details (Overspecified Tests)

**Signs:** Tests asserting exact call counts on internal helpers, exact private field values, exact log strings, or snapshot tests over huge structures where any change anywhere fails the snapshot.

**Fix:** Assert the contract, not the mechanism. Snapshots only over small, intentionally-designed outputs. If the "detail" genuinely matters (e.g., exactly one charge call to a payment gateway), that's a boundary contract — assert it deliberately at the boundary, not incidentally everywhere.

---

## Reading the Suite as a Design Report

When auditing a codebase, read the tests early. A quick mapping:

| Observed in tests | Suspect in production |
|---|---|
| Walls of mock setup | God class / too many collaborators / logic tangled with I/O |
| Builders absent, constructors painful | Long Parameter List, Primitive Obsession |
| Tests break on every refactor | (test fault) implementation coupling — fix before refactoring further |
| Everything tested through HTTP/DB | No pure domain core (layering smell) |
| Clock/sleep hacks everywhere | Time dependency not injected |
| One giant test per class | Temporal coupling; operations not independently usable |
