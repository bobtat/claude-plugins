# UI, Browser & Component Tests

Everything in `SKILL.md` still applies — test behavior, not implementation; one reason to fail; watch it fail first. This file covers what is genuinely different when the thing under test is rendered.

Three differences drive all of it:

1. **The DOM is an implementation detail.** A CSS class is as much an internal as a private field, so a test that finds elements by class is coupled to implementation in exactly the sense `anti-patterns.md` warns about. This is the single largest source of UI-test fragility.
2. **Assertions retry.** In Cypress and Playwright, locating and asserting are the same retrying operation. That changes what counts as an assertion, and it removes almost every legitimate reason to wait.
3. **The cost curve is steep.** A browser test costs seconds where a unit test costs microseconds, and it fails for reasons unrelated to the behavior. Scope discipline matters more here than anywhere else in the suite.

## Selector Strategy

The frameworks agree, which is unusual and worth weighting accordingly.

**Cypress** names the anti-pattern as "using highly brittle selectors that are subject to change," and prescribes: "Use `data-*` attributes to provide context to your selectors and isolate them from CSS or JS changes."

**Playwright**: "Prefer user-facing attributes to XPath or CSS selectors," because "your DOM can easily change so having your tests depend on your DOM structure can lead to failing tests." It ranks `getByRole()` first and test IDs as the explicit-contract fallback.

**Testing Library** states the underlying principle: "The more your tests resemble the way your software is used, the more confidence they can give you."

Ranked by coupling, worst first:

| Selector | Couples the test to | Verdict |
|---|---|---|
| `.btn-primary`, `#submit-2`, `div > span:nth-child(3)` | Styling and markup structure | Breaks on any restyle. Never. |
| XPath | Document structure | Worse; also unreadable |
| `[data-testid=...]`, `[data-cy=...]` | An explicit contract you created for tests | **Good.** Nothing else changes it |
| Role, label, and visible text — `getByRole('button', {name: 'Submit'})` | What a user perceives | **Best**, and it verifies accessibility as a side effect |

The last two are complements, not rivals. Prefer the user-facing query when the element has an accessible name; reach for a test id when it doesn't, or when the text is volatile copy.

**The brittle-to-stable selector ratio is the best single fragility metric for a UI suite.** It is cheap to compute and it predicts how much of the suite goes red on the next redesign.

**Actually correct when:** asserting *about* presentation is the point — a visual-regression check, or a test that a validation error carries the error class. Assert the class as the observable outcome; don't navigate by it.

## Retry-Ability, and Why You Should Almost Never Wait

Modern UI frameworks retry locators and assertions until a timeout. Cypress documents **default assertions** on `cy.get()`, `cy.visit()`, and `cy.request()` — `visit` expects a 200 with `text/html`, `request` expects the server to answer, `get` expects the element to eventually exist. Note that *retry-ability* and *default assertions* are not the same property: since v12 Cypress retries **queries** such as `cy.get()`, while `cy.visit()` and `cy.request()` carry a default assertion without being retried.

Cypress names the anti-pattern flatly — "waiting for arbitrary time periods using `cy.wait(Number)`" — and the fix: "use route aliases or assertions to guard Cypress from proceeding until an explicit condition is met."

```js
cy.wait(500);                              // anti-pattern: too short on CI, too long always
cy.wait('@createOrder');                   // wait for the actual signal
cy.get('[data-cy=total]').should('contain', '47.50');   // or let the assertion retry
```

Playwright makes the same distinction through **web-first assertions**: `await expect(page.getByText('welcome')).toBeVisible()` waits; `expect(await page.getByText('welcome').isVisible()).toBe(true)` "won't wait a single second, it will just check the locator is there and return immediately." The second form looks equivalent and is the more common source of flake.

This is `anti-patterns.md`'s *Sleep-Based Waiting* in UI clothing: await the real signal, never a duration.

**Actually correct when:** essentially never for synchronization. A deliberate delay to test debounce or throttle behavior is a different thing — and even then, drive it with a clock control (`cy.clock()` / `page.clock`) rather than real time.

## What Counts as an Assertion Here

This matters for reviewing and auditing, because the usual heuristic — "does this test contain an assertion?" — misreads a retrying API.

- `cy.get('[data-cy=total]')` **is** a weak assertion. It fails if the element never appears, so it asserts existence.
- `cy.get('[data-cy=total]').should('contain', '47.50')` asserts the behavior.
- A test whose entire body is `cy.get(...).click()` chains asserts only that every element existed. That is a smoke test, and it is fine if labeled as one — it is not a test of the behavior its name probably claims.
- `expect(` is largely absent from idiomatic Cypress. Its absence is not evidence of a missing assertion; `.should()` and `.and()` are the assertion forms.

When judging whether a UI test can fail, ask what would have to break for it to go red. If the answer is "any element disappears," it is an existence test regardless of length.

## Component vs. End-to-End

Component tests (Cypress component testing, Playwright component testing, Testing Library with a runner) mount one component with controlled props and no server. They are close to unit tests in cost and are the right home for most UI behavior: rendering states, conditional display, form validation, empty and error states, accessibility.

Reserve browser end-to-end for what only it can prove — that real pages, real routing, real auth, and a real server work together on a journey that matters.

| Verifying | Slice |
|---|---|
| A rule, calculation, or formatting | Plain unit test, no DOM at all |
| Component renders states correctly; validation; empty/error/loading | Component test |
| A page composes components and talks to the API | Integration, often with the network stubbed |
| One critical journey works fully wired | E2E — a handful, money paths only |

`bdd.md`'s rule governs the count: **one outer test proves the wiring; the remaining scenarios belong underneath as fast tests.** Five acceptance scenarios should not become five E2E tests. This is the most common and most expensive mistake in UI suites, and it is what produces a suite too slow and too flaky to trust.

Fowler's caveat from `test-scope.md` applies in the other direction too: if the high-level tests are genuinely fast, reliable, and cheap to modify, the shape should follow the economics. Component testing has moved that line — it did not erase it.

## Isolation

Cypress: "Tests should always be able to be run independently from one another **and still pass**." The check is that any test passes when run with `.only`.

Its cleanup guidance inverts the usual instinct: "clean up state **before** tests run," not in `after`/`afterEach`, because "code in `after` hooks has no guarantee of execution if tests refresh mid-run" — and leaving state behind aids debugging. Playwright states the same isolation requirement over storage, cookies, and data.

Cache expensive setup rather than repeating it: `cy.session()` for auth, or a storage-state fixture in Playwright. That is sharing *setup*, not sharing *data* — the distinction `anti-patterns.md` draws under *Shared Mutable Fixture*.

## The Network Is the Boundary

`cy.intercept()` and `page.route()` are where `test-doubles.md` applies: the network is a genuine boundary, so doubling it is correct. A route returning a fixed payload is a **stub** — canned answers supplying indirect inputs, verified by asserting on outcomes rather than on the fact that a call happened. A route handler that keeps state across calls — so a POST changes what the next GET returns — is a **fake**, and it is the better choice whenever a scenario spans more than one request. The distinction is worth keeping precisely here: a stub makes each request independent, which is why multi-step flows built on stubs drift out of sync with themselves.

Both frameworks say to stub rather than reach outward. Cypress: "only test websites that you control. Try to avoid visiting or requiring a 3rd party server," because third parties bring A/B tests, rate limits, and bot detection. Playwright: "only test what you control," using its network API to "guarantee the response needed."

Asserting that a request *was made* is occasionally right — it's the *"an action whose whole point is being performed"* row in the doubles table. Asserting that the UI showed the right thing given a response is right far more often.

## `.only` Is a Suite-Wide Outage

`it.only` / `describe.only` / `test.only` committed to a repository silently reduces the file to one test while CI stays green. It is more dangerous than `.skip`, because `.skip` is visibly a disabled test and `.only` looks like nothing at all.

Treat a committed `.only` as a defect, sweep for it, and prefer a lint rule that fails the build.

## UI-Specific Anti-Patterns

| Anti-pattern | Recognize | Instead | Actually correct when |
|---|---|---|---|
| Brittle selectors | `cy.get('.btn-primary')`, XPath, `nth-child` | Role/label queries, or `data-*` test ids | Asserting *about* presentation, e.g. visual regression |
| Bare waits | `cy.wait(500)`, `page.waitForTimeout` | Await the alias, event, or retrying assertion | Driving debounce/throttle — with a controlled clock |
| Non-retrying assertion | `expect(await locator.isVisible()).toBe(true)` | Web-first `await expect(locator).toBeVisible()` | Asserting something must be *immediately* false |
| Everything through the browser | Business rules verified via UI | Push the rule down to a unit test | The rule *is* a rendering rule |
| Scenario-per-E2E | Five criteria → five browser tests | One outer test, the rest underneath | Five genuinely distinct critical journeys |
| Committed `.only` | `it.only` in the repository | Lint rule; treat as a build failure | Never, in committed code |
| Cleanup in `after` | State reset in `afterEach` | Reset in `beforeEach` | Releasing a real external resource |
| Testing third parties | Driving a real payment or SSO provider's UI | Stub the network; `cy.origin()` where auth truly needs it | A deliberate, scheduled contract check |
| Imperative scenarios | Test reads as click-by-click narration | Name the behavior; hide steps in commands/page objects | A deliberate click-path regression test |

## Sweeping a UI Suite

Patterns for these signals, per framework, are in the `test-auditing` skill's `references/detection-patterns.md` — including the selector-ratio metric and the correction that makes assertion counting work on a retrying API.
