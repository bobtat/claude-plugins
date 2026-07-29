# Test Design Fundamentals

The properties this file is trying to produce are Kent Beck's [test desiderata](https://testdesiderata.com/) — twelve things we want from tests. Five bear directly on test design:

- **Specific** — "if a test fails, the cause of the failure should be obvious" (drives naming and one-behavior-per-test)
- **Readable** — "tests should be comprehensible for reader, invoking the motivation for writing this particular test"
- **Writable** — "tests should be cheap to write relative to the cost of the code being tested" (drives builders)
- **Isolated** — "tests should return the same results regardless of the order in which they are run"
- **Deterministic** — "if nothing changes, the test result shouldn't change"

## Naming

A test name is read at exactly one moment that matters: when CI is red and nobody wants to open the file. It must answer *what was expected* and *under what condition*. This is Beck's *specific* property, and it is also the oldest argument for behavior-style naming: Dan North's [account of arriving at BDD](https://dannorth.net/blog/introducing-bdd/) starts from `agiledox`, a tool that stripped "test" from method names and turned them into readable sentences, making the test list function as documentation.

Three schemes that work — pick one per codebase and never mix:

| Scheme | Example | Best for |
|---|---|---|
| `Method_Condition_Outcome` | `Withdraw_WithInsufficientFunds_Throws` | C#/Java, xUnit/JUnit conventions; also Go, where `go test` only discovers functions matching `TestXxx` — `TestWithdraw_InsufficientFunds` |
| Sentence describing behavior | `it("rejects a withdrawal that exceeds the balance")` | JS/TS, RSpec-style, BDD frameworks |
| `should_<outcome>_when_<condition>` | `should_reject_withdrawal_when_balance_is_lower` | Python, Ruby, snake_case codebases |

**The third scheme is more than a style choice.** North's point about the word *should* is that it does design work: writing "this class should…" forces a single responsibility into the sentence, and when the sentence won't fit, that is evidence the behavior belongs on a different class. It also invites the challenge — "Should it? Really?" — which the word *test* does not. Use it as a probe even in codebases that name tests the other two ways: if you cannot finish the sentence about the class under test, stop and reconsider the design before writing the test.

Rules that apply to all three:

- **Name the behavior, not the mechanism.** `Cancel_WhenShipped_IsRejected`, not `Cancel_CallsValidatorThenThrows`.
- **Never `TestX`, `XWorks`, `HappyPath`, or `Test1`.** These carry zero information at failure time.
- **Don't put the expected value in the name.** `CalculatesTotalOf47_50` rots the instant the fixture changes; `CalculatesTotalIncludingTax` does not.
- **If the name needs "and", it's two tests.** `Place_SavesOrderAndSendsEmail` is a compound assertion wearing a disguise.

Grouping helps names stay short: a `describe`/nested class per scenario lets each test name carry only the outcome (`OrderCancellation` → `updates the status`, `raises an event`, `is rejected when already shipped`).

## Arrange / Act / Assert

Three phases, in order, separated by blank lines, with exactly one act:

```csharp
[Fact]
public void Cancel_OnShippedOrder_IsRejected()
{
    var order = AnOrder().Shipped().Build();          // arrange

    var act = () => order.Cancel();                    // act

    Assert.Throws<DomainException>(act);               // assert
}
```

**One act.** Two actions in one test means either two tests, or the first action is really arrange (move it up and hide it behind a builder — `AnOrder().Shipped()` above is exactly that move).

**Arrange belongs in the test only when it's relevant to the behavior.** Setup that varies per test stays visible; setup every test in the file shares can move out. The distinction is whether the reader needs the value to understand *this* assertion.

**Prefer an explicit helper method to an implicit setup hook.** When shared setup does move out, a named factory called from the test body (`CreateDefaultCalculator()`, `AnOrder().Shipped().Build()`) beats a `Setup`/`beforeEach`/`@BeforeEach` hook that runs invisibly. Three reasons, and they compound in large suites:

- **All the code is visible from the test.** A reader sees what the test depends on without scrolling to a hook — and a hook is exactly what a reader forgets to check when diagnosing a failure.
- **Less chance of setting up too much or too little.** A hook applies identical setup to every test in the file, so it drifts toward the union of everything any test needed. Tests then carry setup irrelevant to them, which is how a "minimal" test ends up with eleven constructor arguments.
- **Less chance of sharing state.** A hook that assigns to fields creates an object graph tests can mutate for each other; a factory returns a fresh graph per call.

Implicit hooks are still right for genuinely uniform, non-negotiable setup — starting a container, booting an app host, opening and rolling back a transaction, resetting a database. The rule of thumb: use a hook for *lifecycle*, a helper for *data*. (In some frameworks this distinction is moot — xUnit removed `SetUp`/`TearDown` in 2.x and uses the constructor and `IAsyncLifetime` instead, which at least makes the lifecycle explicit.)

**Assert last, and only about one behavior.** Multiple assertion statements are fine when they describe one behavior together (`status`, `cancelledAt`, and the raised event all describe "the order got cancelled"). They are not fine when they describe unrelated outcomes.

## Assertions

**Assert whole values.** Compare the returned object against a fully-specified expected object rather than picking fields:

```typescript
// Weak — silently ignores every field you forgot, including new ones
expect(result.status).toBe("active");
expect(result.plan).toBe("pro");

// Strong — a new field with a wrong default fails this test
expect(result).toEqual({ id: "u-1", status: "active", plan: "pro", seats: 5 });
```

Whole-value assertions are also how you avoid the trap of adding a field to a type and having every test keep passing while the new field is wrong everywhere.

**For collections, assert contents, not shape.** `expect(items).toEqual([a, b])` beats asserting `length === 2` followed by index lookups — and beats a loop that asserts nothing when the collection is empty.

**Write expected values literally.** If the test computes the expectation with the production formula, it asserts that the code equals itself:

```python
# Vacuous — the same bug in both places passes
assert invoice.total == subtotal * (1 + TAX_RATE)

# Real — a hand-computed number the reader can check
assert invoice.total == Decimal("108.50")
```

Where a literal genuinely can't be written (large structures, generated output), use an approval/snapshot test deliberately over a *small, intentionally designed* output — never over a whole page or a whole API response.

**Name the literals that carry meaning; hide the ones that don't.** "Write it literally" is about not *computing* the expectation — not about leaving significant values unexplained. A bare `"1001"` in a test makes the reader stop and wonder why that number; `const string MaximumSumResult = "1001"` tells them, and the test reads as a sentence about a rule rather than a puzzle:

```csharp
// Unexplained — why 1001? The reader has to go read the implementation.
Assert.Throws<OverflowException>(() => calculator.Add("1001"));

// Explained — the name states what makes this value special.
const string JustOverMaximum = "1001";
Assert.Throws<OverflowException>(() => calculator.Add(JustOverMaximum));
```

The distinction that matters is **significant vs. incidental**:

- **Significant** — a value chosen because it sits at a boundary, trips a rule, or represents a specific case. Name it. This is the one place a constant genuinely earns its keep in a test.
- **Incidental** — a value needed only to satisfy a constructor or signature. Don't name it and don't feature it; push it into a builder default where it stops competing for attention (see "Test Data" below).

This is why the builder guidance says to generate IDs and emails uniquely rather than pinning them to shared constants: those are incidental. A named constant for an *incidental* value is the worst of both worlds — it implies significance that isn't there, and shared constants collide across tests.

**Assert on messages only when the message is the contract.** User-facing error text and API error codes are contracts; internal exception strings and log lines are not. Assert the error *type* plus a machine-readable code, not the prose.

**Failure output should identify the problem.** Prefer assertion libraries that print the diff. When several assertions in a test are unavoidable, use grouped/soft assertions or messages so the failure names which one broke.

## Choosing Test Cases

For a given behavior, work outward in this order and stop when the next case would exercise no new behavior:

1. **The happy path.** One canonical case — realistic in the value that drives the behavior, minimal in everything else.

   These pull in opposite directions and both are right about different values. Use the **simplest input that still verifies the behavior** for anything incidental: extra properties set on a model, non-zero amounts where zero would do, a populated collection where an empty one suffices. Every unnecessary detail is a chance to introduce a bug in the test and a distraction from its point. But for the value the behavior actually turns on, prefer a **realistic** one: testing a tax calculation with `0` or `1` hides rounding, precision, and unit errors that `108.50` catches immediately. Zeros and empty strings are excellent *boundary* cases — step 3 — and poor stand-ins for the main case.
2. **Each rejection or error branch.** Every guard clause and every `throw` deserves one test naming the condition that trips it.
3. **Boundaries.** Empty, zero, one, exactly-at-limit, one-over-limit, maximum, absent/null. Off-by-one bugs live here almost exclusively.
4. **Distinct equivalence classes.** Cases the code treats *differently* — a negative amount, a foreign currency, an expired date. Three values inside the same class is one test, not three.
5. **State-dependent behavior.** For anything with a lifecycle, test the operation from each state where the outcome differs (cancel a draft, cancel a shipped order).

Skip: additional values that follow the same path, permutations of independent parameters (test them independently), and cases the type system already forbids.

**Property-based testing** is the right tool when a behavior has an invariant that should hold across all inputs — round-trip (`parse(render(x)) == x`), commutativity, idempotence, ordering-independence, or "never throws for any valid input." One property often replaces a dozen example tests and finds the case you wouldn't have written. Keep the canonical examples too: they document intent, while the property documents the law.

## Test Data

**Builders with sensible defaults** are the single highest-leverage test-quality investment in any codebase past trivial size. Introduce one at the first of these thresholds you cross: **the same arrange block appears in three tests**, **construction takes more than four arguments**, or **a test must set a field it does not care about** to get a valid object. Below those, a plain constructor call in the test is clearer than indirection.

```csharp
public sealed class OrderBuilder
{
    private CustomerId _customer = CustomerId.New();
    private readonly List<OrderLine> _lines = [ALine()];
    private OrderStatus _status = OrderStatus.Draft;

    public OrderBuilder ForCustomer(CustomerId id) { _customer = id; return this; }
    public OrderBuilder WithLine(OrderLine line) { _lines.Add(line); return this; }
    public OrderBuilder Shipped() { _status = OrderStatus.Shipped; return this; }

    public Order Build() => Order.Rehydrate(_customer, _lines, _status);
}

// Test bodies then state only what matters:
var order = AnOrder().Shipped().Build();
```

Properties of a good builder: **every field has a valid default**, so a test names only the values it cares about; each named method describes a *domain* state (`Shipped()`, `WithExpiredCard()`) rather than a field assignment; and `Build()` returns a valid object, using whatever internal constructor is needed rather than forcing tests through a lifecycle.

**Object mothers** (`Orders.ShippedOrder()`) are the simpler alternative — a handful of named canonical objects. They work well until tests start needing variations, at which point the method count explodes; migrate to builders then.

**Uniqueness by default.** Generate IDs, emails, and names uniquely in the builder rather than using constants. Shared constants cause cross-test collisions in any suite touching a real database.

**Never a shared mutable fixture across tests.** One test mutating a fixture object another test reads is the most common cause of order-dependent suites. Fresh instance per test — construction is cheap, debugging order dependence is not.

## Fixture Scope

| Cost of setup | Scope | Requirement |
|---|---|---|
| Cheap objects | Per test — preferably a helper called from the test, else constructor / `beforeEach` | Default; always safe |
| Database schema, container start, app host boot | Per class/suite or per run (shared collection fixture) | Each test must clean up or isolate its own data — transaction rollback, unique keys, or truncation between tests |
| Anything mutable | Never shared without isolation | — |

Sharing expensive setup is a correctness obligation, not just an optimization: the moment two tests share a database, one of them must not be able to see the other's rows.

## Coverage

Coverage measures which lines ran, not whether anything was verified. A suite with no assertions can reach 100%. Fowler's formulation in [TestCoverage](https://martinfowler.com/bliki/TestCoverage.html): "Test coverage is a useful tool for finding untested parts of a codebase. Test coverage is of little use as a numeric statement of how good your tests are."

Fowler's reason targets specifically backfire: "If you make a certain level of coverage a target, people will try to attain it." Brian Marick, quoted on the same page, draws the distinction that matters to anyone setting policy — "I expect a high level of coverage. Sometimes managers require one. There's a subtle difference" — and makes the deeper point that coverage is a weak instrument even where it fires: "If a part of your test suite is weak in a way that coverage can detect, it's likely also weak in a way coverage can't detect." Note also Fowler's calibration in the other direction — he expects thoughtful testing to land "in the upper 80s or 90s" on its own, and would be "suspicious of anything like 100% — it would smell of someone writing tests to make the coverage numbers happy." A high number is not the problem; *aiming* at it is.

Use it as a **diagnostic**:

- Look for *behaviors* with no test — an uncovered `catch` block, an uncovered guard clause, an uncovered branch of a conditional. Those are real gaps worth filling.
- Look at coverage on **new or changed** code in a diff; that's the number with signal. Total-repo percentage is dominated by legacy code and tells you nothing about today's change.
- Treat branch coverage as more informative than line coverage, and mutation testing (if available) as far more informative than either — it answers the question coverage can't: would the tests notice if the code were wrong?

Do **not** set a percentage target and write tests to reach it. That produces tests that call code and assert nothing, which is worse than no test: it costs maintenance, blocks refactors, and creates false confidence. If a coverage gate exists, apply it to changed lines and accept documented exclusions for generated code and thin adapters.
