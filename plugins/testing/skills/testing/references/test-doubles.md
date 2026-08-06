# Test Doubles

## The Five Doubles

The taxonomy is Meszaros' (*xUnit Test Patterns*, 2007); the definitions below are Fowler's rendering of it in [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html). Precision matters because "mock" is used colloquially for all five — Robert Martin notes it is "used in an informal way to refer to the whole family of objects that are used in tests" — and the differences determine whether a test survives refactoring.

| Double | Fowler's definition | Verification |
|---|---|---|
| **Dummy** | "passed around but never actually used. Usually they are just used to fill parameter lists" | None |
| **Stub** | "provide canned answers to calls made during the test, usually not responding at all to anything outside what's programmed in" | State |
| **Fake** | "actually have working implementations, but usually take some shortcut which makes them not suitable for production" | State |
| **Spy** | "stubs that also record some information based on how they were called" | Test inspects the record |
| **Mock** | "pre-programmed with expectations which form a specification of the calls they are expected to receive" | Behavior, enforced by the double |

Two distinctions are easy to lose and worth stating exactly:

- **Spy vs. mock.** Meszaros characterizes a Test Spy as a Test Stub with recording added — an *observation point* for the SUT's indirect outputs, which the **test** then asserts on. (Paraphrase: `xunitpatterns.com` is HTTP-only and was not directly reachable when this was written; see `sources.md`.) A Mock Object embeds the expectation in the double itself, so it fails from the inside when the calls don't match. Fowler's summary of the whole set: "Of these kinds of doubles, only mocks insist upon behavior verification. The other doubles can, and usually do, use state verification."
- **Indirect inputs vs. indirect outputs** (Meszaros' framing, and the sharpest way to choose). Stubs and fakes supply the SUT's indirect *inputs*. Spies and mocks observe its indirect *outputs*. Ask which one you're dealing with and the choice of double usually follows.

The practical rule: **prefer doubles verified by state over doubles verified by interaction.** State-verified tests survive internal refactoring; interaction-verified tests encode the current call sequence and break when it changes. Fowler puts the cost plainly: "Mockist tests are thus more coupled to the implementation of a method. Changing the nature of calls to collaborators usually cause a mockist test to break," and "Coupling to the implementation also interferes with refactoring, since implementation changes are much more likely to break tests than with classic testing."

Khorikov names this property directly — **resistance to refactoring**, one of his four pillars of a good unit test (*Unit Testing: Principles, Practices, and Patterns*, 2019) — and argues it is effectively binary and should always be maximized, because a test coupled to implementation details generates false alarms that erode trust in the whole suite.

## Vocabulary Collisions

The taxonomy above is the precise one, but **it is not the vocabulary most codebases actually use**, and assuming otherwise causes real miscommunication. Two competing conventions are in wide circulation:

| | Classic xUnit (Meszaros, Fowler) — used in this skill | Umbrella convention (Osherove; common in .NET docs) |
|---|---|---|
| **Fake** | A working, simplified implementation | Generic term for *any* double — "a fake can be a stub or a mock" |
| **Stub** | Supplies canned indirect inputs | A controllable replacement you do **not** assert against |
| **Mock** | Has expectations embedded; self-verifying | Any double you **do** assert against — "a mock begins as a fake and remains a fake until it enters an `Assert` operation" |

Under the second convention the distinguishing question is simply *does the test assert against this object?* — which is a genuinely useful question, just not the same one the first convention answers.

Tooling entrenches the confusion further, and in every language:

- **Python** ships `unittest.mock` in the standard library; `MagicMock` and `patch` are used as stub, spy, fake, and mock interchangeably.
- **JavaScript/TypeScript**: `jest.mock()` and `jest.fn()` name everything a mock regardless of role; Sinon at least distinguishes `stub`, `spy`, and `fake`.
- **Java**: Mockito's `mock()` creates objects used in all five roles.
- **.NET**: `Mock<T>` in Moq is the entry point for stubs and spies as much as for mocks.

Robert Martin's observation covers the whole situation: "The word mock is sometimes used in an informal way to refer to the whole family of objects that are used in tests." Meszaros himself acknowledged the terminology around test doubles is inconsistent, which is why he coined "test double" as the neutral umbrella in the first place.

**How to handle it:**

1. **Reason with the precise taxonomy.** The distinctions predict whether a test survives refactoring, which is the thing that actually matters. Losing them means losing the ability to see the problem.
2. **Write in the codebase's vocabulary.** If a project calls its in-memory repository `FakeOrderRepository` or its stub `MockClock`, match it. Renaming a team's test doubles to satisfy a taxonomy is churn, and correcting their word choice unprompted is worse.
3. **When ambiguity would change a decision, describe the behavior instead of naming the double.** "An in-memory implementation that actually stores what you save" and "an object that fails the test if `Charge` isn't called" are unambiguous in any convention. Reach for this in review comments and commit messages.
4. **Don't let a label authorize the wrong thing.** A class named `FakeEmailSender` that is really an assertion-bearing mock is fine; a *mock* used where a real object or working fake would serve is the problem this file exists to prevent — regardless of what it's called.

## Why This Matters Especially Here

Hora and Robbes measured test doubles in agent-authored commits across 2,168 TypeScript, JavaScript, and Python repositories — 1,254,878 commits from 2025, of which 48,563 were authored or co-authored by Claude Code, Copilot, or Cursor ([*Are Coding Agents Generating Over-Mocked Tests?*](https://arxiv.org/abs/2602.00409), MSR '26). Two findings bear on this file:

- **Agents add mocks somewhat more often than humans.** 36% of agent test commits add mocks vs. 26% for non-agents. Read the effect sizes before drawing a conclusion: in repositories with high agent activity the repo-level difference is 36% vs. 28% with a *small* effect (Cliff's delta 0.252), while in lower-activity repositories the difference is statistically significant but the effect is **negligible** (Cliff's delta 0.002) — the authors' own words are "statistically significant, but not meaningful." This is a mild tendency, not a chasm, and it should not be cited as one.
- **Agents use a less diverse set of double types.** Measured as the share of the 496 repositories with agent mock activity that contain at least one agent commit using each type (agents vs. non-agents): **mock 95% vs. 91%, fake 32% vs. 57%, spy 33% vs. 51%, dummy 19% vs. 40%, stub 14% vs. 30%.** The authors conclude agents "tend to generate less diverse test doubles as compared to non-agents."

Two cautions on reading those numbers, because both are easy to get wrong:

1. **They are repository ratios, not proportions of doubles written.** 95% does not mean 95% of agent doubles are mocks; it means 95% of those repositories contain at least one agent commit using a mock-type double. The figures sum to well over 100% and are not a distribution.
2. **The largest gap is `fake` (25 points).** Dummy (21) and spy (18) follow, and stub is the smallest gap (16) — the paper notes dummy and stub are the least-adopted types for humans too. So the defensible claim is narrow: *agents reach for a narrower range of doubles, and the type they most under-use relative to humans is the fake.* It is **not** true that agents specifically neglect the state-verifying doubles — spy verifies interactions, and dummy verifies nothing.

That narrower claim is still the relevant one here, because the fake is the double this file most recommends. The paper's own closing recommendation is that teams "explicitly include guidance on mocking best practices and anti-patterns in agent configuration files (e.g., `CLAUDE.md`)."

Kent Beck, quoted in the same paper, describes the failure mode from the other side: an LLM "makes some decisions seemingly at random, like, 'Oh, let's use a mock for this test even though the actual object is fine.'"

So when the choice between a real object, a fake, and a mock feels arbitrary, the measured prior is that reaching for `mock` is the wrong default. Use the real object; fall back to a fake; reach for a mock only where the interaction genuinely is the behavior.

## Queries vs. Commands

The single most useful distinction when deciding what to double — Meyer's command/query separation applied to doubles:

- **A query** returns data and changes nothing (`repo.FindById`, `pricing.RateFor`, `clock.Now`). Double it with a **stub or fake**. Never assert that a query was called — that's asserting how the code obtained information, not what it did with it.
- **A command** causes an effect outside the unit (`gateway.Charge`, `mailer.Send`, `bus.Publish`). Here the call *is* the observable behavior; there is no state to inspect. Verify it with a **spy or mock** — deliberately, once, at the boundary.

Applied consistently this removes most mock bloat: the majority of collaborators in a typical unit are queries, and queries don't need verification.

## Prefer Fakes to Mocks

A fake is a working implementation with the fidelity you need and none of the cost:

```typescript
export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  async save(order: Order): Promise<void> { this.orders.set(order.id, order); }
  async findById(id: string): Promise<Order | null> { return this.orders.get(id) ?? null; }
  async findByCustomer(c: string): Promise<Order[]> {
    return [...this.orders.values()].filter(o => o.customerId === c);
  }
}
```

Why this beats mock configuration:

- **Tests read as scenarios.** `await repo.save(anOrder()); ... expect(await repo.findById(id)).toEqual(...)` describes a situation, not a call script.
- **It survives refactoring.** Change the code from `findById` to `findByCustomer` and the fake still works; twelve `when(repo.findById(...)).thenReturn(...)` setups do not.
- **It can't lie about consistency.** A mocked `save` followed by a mocked `findById` will happily return something `save` never received. A fake can't.
- **One fake amortizes across the whole suite**, replacing setup repeated in every test.

## Building a Fake in Practice

The four objections that send people back to a mocking library, answered:

- **"The interface has fifteen methods."** Implement only the ones the test exercises; throw `NotImplementedException` / `raise NotImplementedError` from the rest. A four-method fake of a fifteen-method port is legitimate and takes minutes — and the throw is useful, because it fails loudly the day a test starts depending on a method the fake doesn't really model.
- **"I only need one method to return one value."** Then a fake is the wrong tool and so is a mocking framework: write a small hand-written stub class, or use the framework's plain stub form. Fakes earn their cost when they hold **state across calls** — save then read, add then list. For a single canned answer they are overkill.
- **"There's no interface to fake."** Then the production code has no seam at that point. Introducing one is a **production change** — propose it and let the user decide; don't add an interface silently as part of "adding tests." If the change isn't wanted, the honest answer is an integration test against the real dependency, not a mock that pretends the seam exists.
- **"Where does it live?"** Beside the tests, named for the port (`InMemoryOrderRepository`, `FakeEmailSender`, `FixedClock`), and **reused across the suite**. A fake written for one test is worth little more than the mock it replaced — the economics come from amortizing it. Before writing one, check whether the suite already has it.

**Keep the fake honest with a shared contract test.** Write one test suite against the *interface* and run it against both the fake and the real implementation:

```typescript
describe.each([
  ["in-memory", () => new InMemoryOrderRepository()],
  ["postgres",  () => new PostgresOrderRepository(testDb)],
])("OrderRepository contract (%s)", (_name, create) => {
  it("returns null for an unknown id", async () => { /* ... */ });
  it("round-trips a saved order", async () => { /* ... */ });
  it("returns only the requested customer's orders", async () => { /* ... */ });
});
```

This is what makes fakes trustworthy rather than a second implementation that drifts. Without it, the fake eventually diverges from the real behavior and the fast tests start passing on fiction. The contract suite runs fast against the fake in the unit slice and against the real thing in the integration slice.

## Mock Only at Boundaries — Concretely

**Default to the classical position: real objects where possible, doubles only at the boundaries below. Deviate only if the codebase has already committed to verifying interactions on internal collaborators** — in which case follow the codebase.

The rest of this section is why, and is worth reading once rather than at every decision. **This is a position, not a consensus.** Fowler frames the field as two schools: *classical* TDD, which will "use real objects if possible and a double if it's awkward to use the real thing," and *mockist* TDD, which "will always use a mock for any object with interesting behavior" — including internal collaborators. Fowler himself does not restrict mocks to boundaries, and describes both schools as coherent design philosophies rather than one being simply correct.

This file takes the classical position, and the reason is the trade-off Fowler documents rather than a claim that mockists are wrong: mockist tests are more coupled to implementation, break when call structure changes, and interfere with refactoring. Since the entire value of a suite as a safety net rests on it staying quiet during refactoring — Beck's *structure-insensitive*, Khorikov's *resistance to refactoring* — that cost is the one worth avoiding by default. Mockist TDD buys something real in exchange (outside-in design pressure, and immediate feedback on interface design); if a codebase has deliberately adopted it, follow the codebase.

The boundary list is also not an absolute. Fowler again: "I don't treat using doubles for external resources as an absolute rule. If talking to the resource is stable and fast enough for you then there's no reason not to do it in your unit tests." A local in-memory database or a fast local broker can legitimately be used directly.

A boundary is a place where the process ends or determinism does:

- Network calls (HTTP, gRPC, message brokers)
- The filesystem
- The clock, timers, and scheduling
- Randomness and ID generation
- The current user/environment/config
- Third-party services you don't control
- Anything expensive or destructive (sending real email, charging a real card)

**Not** boundaries — do not double these:

- Value objects and pure functions. Construct them for real; a stubbed value object is a bug waiting to happen.
- Your own domain objects and their collaborators. Real ones are cheap and give the test genuine coverage.
- Collections, DTOs, mappers, builders.
- The class under test itself. **Partial mocks / spies on the subject** (stubbing one method while testing another) mean the class does two things — split it.

Double **at your own port, not at the vendor's API.** Fake the `PaymentGateway` interface you defined, not Stripe's SDK client. Faking the vendor library means your test asserts against your *guess* about their API, and it re-breaks on every SDK upgrade; the vendor's real shape belongs in a small integration or contract test against their sandbox.

## Injecting Nondeterminism

The three sources that cause the most flakiness, and their fix. In every case the fix is production-side injection — the test-side workaround (sleeps, freezing global time, retries) treats the symptom.

**Time.** Never call `DateTime.Now` / `Date.now()` / `datetime.now()` inside domain logic. Inject a clock:

```csharp
public interface IClock { DateTimeOffset UtcNow { get; } }

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}

public sealed class FixedClock(DateTimeOffset utcNow) : IClock
{
    public DateTimeOffset UtcNow { get; } = utcNow;
}
```

`UtcNow` rather than `Now`, and `DateTimeOffset` rather than `DateTime`: an abstraction over the clock that can hand back an ambiguous local time has given away most of what you wanted from it. (.NET 8+ ships `TimeProvider` for this; prefer it over a hand-rolled interface on a new codebase.)

A fixed clock makes date-boundary behavior (month ends, DST, leap years, expiry) directly testable instead of accidental — a strict improvement over "the test passed because it wasn't December 31."

**Randomness and IDs.** Inject the generator (`IIdGenerator`, `() => string`). In tests, return a sequence. This also makes assertions possible: you can assert the created entity's id, which is impossible with an internal `Guid.NewGuid()`.

**Asynchrony.** Return awaitable handles rather than firing and forgetting. If work is queued for background processing, expose the queue so the test can drain it deterministically; the test then awaits a real signal instead of sleeping and hoping. A **bare** `await Task.Delay`/`setTimeout` used to wait for work to finish is a defect. The call itself is not: it is the standard way to test timeout and cancellation behaviour, it is correct inside a polling helper with a real timeout (`anti-patterns.md`, *Sleep-Based Waiting* → "actually correct when"), and under `vi.useFakeTimers()`/`jest.useFakeTimers()` it advances virtual time and costs nothing.

## Over-Mocking as a Design Signal

When a test needs many doubles, the test is reporting a fact about the production code. Read it that way before writing more setup:

| Test symptom | Production problem | Fix in production |
|---|---|---|
| 6+ constructor doubles | Too many collaborators — the class does too much | Split by responsibility |
| Mocks returning mocks | Reaching through objects (`a.getB().getC()`) | Tell, don't ask; pass what's needed |
| Mock setup longer than the assertion | Decision logic tangled with orchestration | Extract a pure function that takes data and returns a decision |
| Must stub a method on the class under test | The class has two responsibilities | Extract the stubbed part into its own unit |
| Can't test without mocking a static/singleton | Hidden global dependency | Inject it |
| Every test breaks when one method's signature changes | Tests coupled to call sequence | Move to state verification with fakes |

The highest-value move is almost always the third row: **separate deciding from doing.** A function that takes the facts and returns a decision needs no doubles at all and can be tested exhaustively with plain values; a thin orchestrator that fetches facts, calls the decision, and performs the effect needs one or two integration tests. `examples/overmocked-test-rewrite.md` walks this transformation end to end.

## Library Conventions

Framework-independent guidance that holds across Moq/NSubstitute, Jest/Vitest, unittest.mock, Mockito, and gomock:

- **Strict vs. loose doubles.** Prefer strict (unconfigured calls fail loudly) for spies at boundaries so an unexpected effect is caught; loose is fine for query stubs where unconfigured calls returning defaults is harmless.
- **Argument matchers.** Assert on specific expected values, not `Any<T>()` everywhere — `Any` verification often passes when the code sends the wrong data. Conversely, don't over-specify arguments irrelevant to the behavior.
- **Never assert call counts** unless the count is genuinely part of the contract (charge exactly once — idempotency is a real requirement worth a real test). `Times.Once` on a query is noise that breaks on caching changes.
- **Reset or recreate doubles per test.** A module-level mock that survives between tests reintroduces order dependence.
- **Don't auto-mock everything.** Auto-mocking containers make it effortless to add a seventh dependency, which is exactly the pressure a test suite should be applying in the other direction.
