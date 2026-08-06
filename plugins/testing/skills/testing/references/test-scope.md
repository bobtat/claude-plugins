# Test Scope & Suite Organization

## What "Unit" Means

There is no canonical definition, and it is worth knowing that rather than assuming one. Fowler's position in [UnitTest](https://martinfowler.com/bliki/UnitTest.html) is that "the team decides what makes sense to be a unit for the purposes of their understanding of the system and its testing" — object-oriented codebases tend to treat a class as the unit, functional ones a function.

The stance this plugin takes is that the most useful choice is a **unit of behavior** rather than a unit of code. Nothing requires one test class per production class, and mechanically mirroring the production structure is a mistake: it forces a test for every class you extract, which means every refactoring breaks tests, which trains people to stop refactoring.

Two legitimate styles — the terms are Jay Fields' (*Working Effectively with Unit Tests*), popularized by Fowler:

**Solitary unit test** — every collaborator replaced by a double. Fowler's illustration of the motivation: "If you like your unit tests to be solitary, you don't want to use the real product or customer classes here, because a fault in the customer class would cause the order class's tests to fail." Appropriate when collaborators are genuine boundaries, or when the unit is an orchestrator whose only job is coordination.

**Sociable unit test** — the unit under test uses its real collaborators; only boundaries are doubled. Appropriate for domain logic, and the better default. A test of `Order.Cancel()` that uses real `Money`, real `OrderLine`, and real `OrderStatus` covers more, reads better, and survives refactoring across those internal boundaries.

Sociable is also the older practice, not a modern relaxation of a rule: "when xunit testing began in the 90's we made no attempt to go solitary unless communicating with the collaborators was awkward."

The failure mode of solitary-everywhere is a suite where every class is verified in isolation and nothing verifies that they work together — 100% coverage, zero confidence. When in doubt, use real objects you own and reserve doubles for the boundary list in `test-doubles.md`.

## The Slices

| Slice | Verifies | Uses | Count | Speed |
|---|---|---|---|---|
| **Unit** | Business rules, calculations, validation, state machines, edge cases | Real domain objects; fakes for boundaries | Most tests | µs–ms |
| **Integration (narrow)** | One adapter against one real dependency: SQL correctness, ORM mapping, serialization, transactions, migrations | Real DB/broker in a container | Dozens | 10ms–1s |
| **Integration (broad / API)** | Wiring through the app: routing, status codes, auth, validation, DI configuration | Real in-process app host, faked third parties | Dozens | ~100ms–1s |
| **Contract** | Your assumptions about a service you don't own still hold | Recorded or provider-verified spec | A few per integration | ms (consumer side) |
| **End-to-end** | A critical user journey works fully wired, deployed-like | Everything real | A handful | Seconds–minutes |

## Choosing the Slice

Ask what could realistically be wrong, and pick the cheapest slice that would catch it:

- **"Is the discount calculated right?"** → Unit. Never reach for a database to verify arithmetic.
- **"Does the query return the right rows?"** → Narrow integration with a real database. A mocked ORM verifies your mock, not your query — LINQ that can't translate, an N+1, a wrong join, or a missing index will all pass against a mock and fail in production.
- **"Does the mapping persist and reload correctly?"** → Narrow integration. Round-trip through the real store: save, clear the context/cache, reload, compare.
- **"Does POST /orders return 422 for invalid input?"** → Broad integration through the app host.
- **"Does the payment provider's response still parse?"** → Contract test against their sandbox or a provider-verified pact, run on a schedule rather than in the fast loop.
- **"Can a user sign up, order, and get a confirmation?"** → One end-to-end test. Not five.

**Push tests down whenever the same defect could be caught lower.** A rule tested at the E2E level costs a thousand times more to run and gives a worse failure message than the same rule tested in a unit test. Reserve high slices for verifying *wiring and integration*, which is the only thing they can verify that lower slices cannot.

## Pyramid vs. Trophy

**The test pyramid** is Mike Cohn's, from *Succeeding with Agile* (2009). Its two claims, in Fowler's rendering: "you should have many more low-level UnitTests than high level BroadStackTests running through a GUI," and "you should do much more automated testing through unit tests than through traditional GUI based testing." The rationale, in Fowler's words, is that "end-to-end tests are: brittle, expensive to write, and time consuming to run," and more prone to non-determinism.

It is the right default for **logic-rich** systems: domain services, pricing engines, schedulers, parsers, workflow rules. Most behavior is decision-making that pure tests verify exhaustively and instantly.

**The testing trophy** is Kent C. Dodds'. It has four layers, not three — static analysis (types, lint) at the base, then unit, then a deliberately fat integration layer, then a thin end-to-end tip — and it is summarized by Guillermo Rauch's line "Write tests. Not too many. Mostly integration," which Dodds took as the title of the post that popularized it. The rationale: "Integration tests strike a great balance on the trade-offs between confidence and speed/expense." Note that static analysis is part of the shape; Dodds' point is not merely "more integration tests" but that a typed, linted codebase has already discharged a category of test the pyramid era wrote by hand — while cautioning that "even a strongly typed language should have tests."

The trophy fits **integration-rich** systems: CRUD APIs, thin adapters, UI components, glue services. There is little logic to unit test; the risk lives in the wiring, the SQL, the serialization, and the HTTP contract. Unit-testing a controller that only forwards a request to a handler verifies nothing.

Both shapes agree on the two things that matter more than the ratio:

- **Few end-to-end tests.** They are slow, flaky, and give diagnostics like "the button wasn't there." Keep only the journeys whose failure would be a business emergency.
- **A fast slice that runs on every change.** Whatever proportion of the suite, some subset must run in seconds so it can be run constantly. That's the slice that functions as a safety net during refactoring.

Diagnose the shape from the risk, not from a diagram. Where a bug history is available, it settles the question: bugs from misunderstood rules → pyramid; bugs from misconfigured wiring → trophy. Without one, read the code instead:

- **Pyramid** if you find dense conditional logic, calculations, state machines, or a substantial layer of functions that transform values without touching IO.
- **Trophy** if you find thin controllers and handlers that forward calls, mapping and serialization code, ORM queries, and few branches per function — the risk is in the wiring, and unit tests of forwarding code verify nothing.

Two caveats worth carrying, both Fowler's:

- **"End-to-end," "UI," and "customer-facing" are orthogonal characteristics**, and teams routinely conflate them. A customer-facing test need not run through the UI; a UI test need not be end-to-end. Decide the axis you actually mean before arguing about the diagram.
- **The pyramid is a heuristic about cost, not a law.** "If my high level tests are fast, reliable, and cheap to modify — then lower-level tests aren't needed." Where tooling has made a higher slice genuinely cheap, the shape should follow the economics rather than the picture.

## Suite Organization

**Organize test files by behavior, not by mirroring classes.** Where a production class has several distinct responsibilities or a lifecycle, several test files are clearer than one giant one:

```
OrderTests/
  PlacingAnOrder.cs           # creation rules, initial state, events
  CancellingAnOrder.cs        # transitions and rejections
  OrderPricing.cs             # totals, discounts, tax
```

Each file has one focused setup and short test names. This also removes the pressure to share a fixture across unrelated scenarios.

**Separate the slices physically**, because they need different runtimes and different budgets:

```
tests/
  Unit/            # no IO at all — runs in seconds, on every save
  Integration/     # containers, real DB — runs before push
  E2E/             # deployed environment — runs in CI
```

Enforce the separation: a unit-test project that references the database driver will eventually contain a test that touches the database. Keep the dependency out of the project, and the rule enforces itself.

**Name the categories in the tooling** (xUnit traits, Jest projects, pytest markers, Go build tags) so CI can run `unit` on every commit and the rest on a schedule or pre-merge.

## Speed Budgets

Budgets worth defending, because they are what makes the suite usable:

| Slice | Per test | Whole slice |
|---|---|---|
| Unit | < 10 ms | < 10 s |
| Narrow + broad integration | < 1 s | < 5 min |
| E2E | — | < 15 min |

When the fast slice slows down, the cause is nearly always one of:

- **Hidden IO in "unit" tests** — a real file read, a DNS lookup, a container start, a config load. Find it by running the slice with network/filesystem blocked.
- **Real waiting.** Every `sleep` is pure latency; replace with injected clocks and awaited signals.
- **Per-test expensive setup** that should be per-suite (app host boot, container start, schema creation) — share it, with per-test data isolation.
- **Crypto with real work factors.** Use a low cost factor for password hashing in tests, configured, not hardcoded.

For integration suites, the two big wins are **reusing one container across the run** (start once, isolate per test with transaction rollback or unique tenant keys) and **running independent test classes in parallel** — which is only safe if no test depends on another's data, so it doubles as a check on isolation.

## Ordering and Independence

Every test must pass alone, in any order, in parallel. Enforce it by **randomizing execution order in CI** — order dependence surfaces immediately rather than as an inexplicable failure six months later.

The two causes of order dependence, both worth fixing at the source:

- **Shared mutable state in tests** — static fields, module-level singletons, a fixture object mutated by one test and read by another, a database row left behind. Fix: fresh state per test; clean up in teardown or roll back. **Browser suites invert this**: Cypress wants state reset in `beforeEach`, not `after`/`afterEach`, because an `after` hook has no guarantee of running when a test refreshes mid-run. See `ui-testing.md`.
- **Global state in production code** — static caches, singletons initialized once, ambient config. Fix: inject it. The test pain is a genuine warning about the same fragility under concurrency in production.
