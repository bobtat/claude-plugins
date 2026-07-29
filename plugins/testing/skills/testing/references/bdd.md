# BDD, Acceptance Criteria & Outside-In

Behaviour-driven development began as a fix for a teaching problem. Dan North found that "test" was the word getting in the way — developers hearing *test* wrote tests for methods, while what he wanted them to write were descriptions of behaviour. Everything below follows from replacing one word with another, and the practical payoff is in the naming discipline and the sequencing, not in any tool.

The other half of the discipline is that the *specification* and the *test* can be the same artifact. That is a real gain when there is someone outside the team who reads it, and pure overhead when there isn't. This file is explicit about which situation you're in, because that judgment determines nearly everything about how much of BDD to adopt.

## The Story Template

```
As a   [role]
I want [capability]
So that [benefit]
```

The third line is the one that does work. A story that can't complete "so that…" is a feature nobody has justified — and the benefit clause is what tells you which scenarios matter, because it names the outcome the user is actually buying. `As a customer I want a refund when I cancel so that I'm not charged for a class I can't attend` implies scenarios about *money returned*, not about clicking a cancel button.

Use it as a filter, not a ceremony. If the story is "the nightly job should retry failed webhooks," the role is an operator and the benefit is delivery guarantees — write that, don't force it into a user-facing shape it doesn't have.

## Given / When / Then

North's formulation: "Given some initial context (the givens), When an event occurs, Then ensure some outcomes." Fragments compose with `And`:

```
Given the class starts on 10 April at 18:00
  And the booking was paid in full
 When the customer cancels 3 days before the class
 Then the full amount is refunded
```

**GWT and Arrange/Act/Assert are the same shape at different altitudes.** AAA is a code convention for a developer reading a test body; GWT is a sentence structure meant to be read by someone who will never open the file. They map one-to-one — given→arrange, when→act, then→assert — and the same discipline applies to both: **one `When` per scenario.** A scenario with two events is two scenarios, exactly as a test with two acts is two tests.

Two rules keep scenarios useful:

- **Write them declaratively, not imperatively.** `When the customer cancels 3 days before the class` — not `When I click "My Bookings" And I click "Cancel" And I confirm`. Imperative scenarios are the single most common way BDD goes wrong: they encode the UI into the specification, so every layout change rewrites the spec, and they describe mechanism where the reader wanted intent.
- **Keep the givens declarative too.** `Given the booking was paid in full`, not `Given I insert a row into bookings with status='PAID'`. A given states a *situation*; how the situation is established is the step implementation's problem.

## Outside-In

The sequencing is the part of BDD that survives regardless of tooling. Work from the outside inward:

1. **Write the story**, including the benefit clause.
2. **Write the acceptance criteria as scenarios** — enough to cover the behaviours a stakeholder would care about, including the rejections. This is the conversation, and it is cheapest to have before any code exists.
3. **Write one failing outer test** for the first scenario, at the thinnest scope that can observe the outcome the scenario names. Usually integration (through the application's entry point), because acceptance criteria are stated in terms a user recognizes.
4. **Drive inward.** The outer test fails because something doesn't exist. Build that something under its own fast unit tests — this is where the *should* probe and the boundary cases live. When the inner units are right, the outer test goes green.
5. **Next scenario.** Most subsequent scenarios need no new outer test: they are variations on a rule, and belong as unit tests against the decision that rule lives in.

Point 5 is what stops outside-in producing a slow suite. The scenarios are the *specification*; they do not each need an end-to-end test. One outer test proves the wiring; the rule's boundaries get pinned cheaply underneath. `examples/outside-in-from-a-story.md` walks this end to end.

## Ubiquitous Language

BDD's other durable contribution is insisting that analysts, testers, developers, and stakeholders use the same words for the same things. Concretely, for test code:

- **Name tests in the domain's vocabulary, not the implementation's.** `refunds_the_full_amount_when_cancelled_more_than_a_day_ahead`, not `returns_100_when_delta_gt_86400`.
- **If the code and the conversation use different words, one of them is wrong** — and it's usually worth changing the code. A codebase where `Booking` means what stakeholders call a *reservation* generates a permanent translation tax on every discussion.
- **Scenario vocabulary is a design signal.** When stakeholders keep saying a word your model has no type for, that word is probably a missing concept. (This is the same instinct as domain-driven design; the `ddd` plugin covers the modelling side.)

## When the Tooling Is Worth It

Gherkin plus a runner — Cucumber, `behave`, Reqnroll, and their relatives, descended from North's JBehave — turns scenarios into executable specifications. The cost is a layer of step definitions and regex-or-expression matching between the scenario text and the code that runs it.

**Adopt it when there are genuinely non-technical readers who will read the scenarios.** A product owner, a compliance reviewer, a domain expert, a regulator — someone who would not open a test file but will read a feature file, and whose reading of it changes what gets built. That is the benefit the ceremony buys.

**Don't adopt it when the only readers are the team.** Gherkin used by developers for developers is a well-documented failure mode: feature files nobody outside the team reads, plus indirection that makes every test harder to navigate, for no communication gain. The symptoms are recognizable — step definitions that exist for exactly one scenario, regexes edited to make a sentence parse, `And I wait 2 seconds` in a feature file, and a `World` object accumulating shared mutable state between steps.

**Without the tooling you keep almost everything valuable:** the story template, the scenarios (as comments, docstrings, or a markdown file next to the tests), declarative naming, one-`When`-per-scenario, and outside-in sequencing. A `describe`/`it` structure or a `Given_When_Then` test name carries the same information to the same readers. This is the right default.

## BDD-Specific Anti-Patterns

Beyond the general catalog in `anti-patterns.md`:

| Anti-pattern | Why it hurts | Instead |
|---|---|---|
| Imperative scenarios (click, type, navigate) | Encodes the UI into the spec; every layout change rewrites it | State intent; put mechanics in step implementations or a page object |
| One scenario per UI screen | Produces a slow end-to-end suite that tests navigation, not rules | One scenario per *behaviour*; push rule variations to unit tests |
| Shared mutable `World` between steps | Reintroduces order dependence and mystery guests at the scenario level | Each scenario establishes its own givens |
| Step-definition explosion | Near-duplicate steps for near-identical sentences | Parameterize steps; agree on canonical phrasings |
| `Given` clauses naming test data (`user 42`) | Mystery guest — the scenario can't be read alone | `Given a customer with a paid booking` |
| Every scenario as an end-to-end test | Suite too slow to run, so it stops being a safety net | One outer test for wiring; boundaries underneath |
| Scenarios written after the code | Loses the entire point — the conversation was the value | Write them before; they're cheapest to correct as sentences |

## How This Interacts With the Rest of This Skill

- **Naming** — the *should* probe in `test-design.md` is the unit-level form of the same instinct: if "this class should…" won't fit one responsibility, the behaviour belongs elsewhere.
- **Scope** — acceptance criteria usually land in the integration slice (`test-scope.md`), not end-to-end. Resist the pull to test every scenario through the full stack.
- **Doubles** — an outer test still fakes real boundaries (payment gateways, mail, clock). Outside-in does not mean "everything real"; it means "start from the outside." The gate in `SKILL.md` applies unchanged.
- **Legacy code** — outside-in assumes you're adding behaviour. For existing untested behaviour, characterization comes first (`legacy-code.md`): a characterization test *reveals* current behaviour, where a scenario *specifies* intended behaviour. Don't write scenarios describing what you hope the legacy code does.
