# Outside-In: From a Story to Unit Tests (TypeScript)

Demonstrates the full outside-in sequence — story → acceptance criteria → one failing outer test → inward to fast unit tests — and shows why most scenarios should *not* become end-to-end tests.

## Step 1 — The Story

```
As a   customer
I want a refund when I cancel a class booking
So that I'm not charged for a class I can't attend
```

The benefit clause is doing work here: it says the outcome that matters is *money returned*, not *a booking marked cancelled*. That determines what the first test asserts.

## Step 2 — Acceptance Criteria

Written with the person who asked for the feature, before any code. Declarative — no clicking, no navigating:

```
Scenario: Cancelling well ahead of the class
  Given a paid booking of £80.00 for a class starting on 10 April at 18:00
   When the customer cancels on 7 April at 18:00
   Then £80.00 is refunded

Scenario: Cancelling shortly before the class
  Given a paid booking of £80.00 for a class starting on 10 April at 18:00
   When the customer cancels on 9 April at 19:00
   Then £40.00 is refunded

Scenario: Cancelling too late to refund
  Given a paid booking of £80.00 for a class starting on 10 April at 18:00
   When the customer cancels on 10 April at 17:00
   Then nothing is refunded
```

The conversation that produced these also produced the rule behind them, which is worth writing down separately because it is what the unit tests will pin:

> Full refund if cancelled 24 hours or more before the start; half if less than 24 but 2 hours or more; nothing inside 2 hours.

Three scenarios, one `When` each. Note what is *absent*: no scenario for "the cancel button is disabled," no scenario per screen. Those are UI concerns, and putting them here is how a BDD suite becomes an end-to-end suite.

## Step 3 — One Failing Outer Test

Pick the first scenario and write it at the thinnest scope that can observe "£80.00 is refunded" — the application's entry point, not the browser.

**The gate, applied.** Three collaborators, and the reasoning for each before any of them gets doubled:

- **Booking storage** → in-memory **fake**. A real object won't do (no database in this slice), and a stub would let `save` and `load` disagree about what was stored.
- **Refund gateway** → **spy**. This is the one place an interaction assertion is correct: issuing the refund *is* the observable behaviour the scenario names, and there is no state on our side to inspect instead. Also a real-money boundary, so it must never be real in a test.
- **Clock** → **fixed clock**. The cancellation time is an input to the rule; reading the real clock would make every scenario time-dependent.

No mocking library appears, because none of the three needs one.

```typescript
// tests/cancelBooking.acceptance.test.ts
const CLASS_STARTS_AT = new Date("2026-04-10T18:00:00Z");
const PRICE_PAID = 8_000;        // minor units — £80.00
const FULL_REFUND = 8_000;

describe("cancelling a booking", () => {
  it("refunds the full amount when cancelled three days ahead", async () => {
    const bookings = new InMemoryBookingRepository();
    const refunds = new SpyRefundGateway();
    const booking = bookings.add(
      aPaidBooking({ pricePaid: PRICE_PAID, classStartsAt: CLASS_STARTS_AT }),
    );

    await cancelBooking(
      { bookingId: booking.id },
      { bookings, refunds, clock: fixedClock("2026-04-07T18:00:00Z") },
    );

    expect(refunds.issued).toEqual([{ bookingId: booking.id, amount: FULL_REFUND }]);
  });
});
```

Run it. It fails because `cancelBooking` doesn't exist — which is the point: the outer test is a specification of work not yet done, and its failure message is the to-do list.

## Step 4 — Drive Inward

The outer test needs a use case, and the use case needs a refund rule. The rule is pure — price and two timestamps in, money out — so it gets its own fast tests, and this is where the boundary cases go:

```typescript
// src/domain/refundPolicy.ts
const FULL_REFUND_MIN_HOURS = 24;
const PARTIAL_REFUND_MIN_HOURS = 2;

export function refundDue(
  pricePaid: number,
  classStartsAt: Date,
  cancelledAt: Date,
): number {
  const hoursAhead =
    (classStartsAt.getTime() - cancelledAt.getTime()) / 3_600_000;

  if (hoursAhead >= FULL_REFUND_MIN_HOURS) return pricePaid;
  if (hoursAhead >= PARTIAL_REFUND_MIN_HOURS) return Math.floor(pricePaid / 2);
  return 0;
}
```

```typescript
// tests/refundPolicy.test.ts
const STARTS_AT = new Date("2026-04-10T18:00:00Z");
const PRICE_PAID = 8_000;

describe("refundDue", () => {
  it.each([
    { scenario: "three days ahead",        cancelledAt: "2026-04-07T18:00:00Z", expected: 8_000 },
    { scenario: "exactly 24 hours ahead",  cancelledAt: "2026-04-09T18:00:00Z", expected: 8_000 },
    { scenario: "23 hours ahead",          cancelledAt: "2026-04-09T19:00:00Z", expected: 4_000 },
    { scenario: "exactly 2 hours ahead",   cancelledAt: "2026-04-10T16:00:00Z", expected: 4_000 },
    { scenario: "1 hour ahead",            cancelledAt: "2026-04-10T17:00:00Z", expected: 0 },
    { scenario: "after the class started", cancelledAt: "2026-04-10T18:30:00Z", expected: 0 },
  ])("refunds $expected when cancelled $scenario", ({ cancelledAt, expected }) => {
    expect(refundDue(PRICE_PAID, STARTS_AT, new Date(cancelledAt))).toBe(expected);
  });
});
```

Six cases against three scenarios, and the three extra ones are the boundaries the conversation never mentioned: *exactly* 24 hours, *exactly* 2 hours, and after the start. Acceptance criteria are written by people thinking about typical cases; boundaries are the developer's contribution, and they belong at the unit level where they cost microseconds.

**A question the scenarios didn't answer.** Halving an odd amount:

```typescript
it("rounds a half refund down to the nearest penny", () => {
  expect(refundDue(8_001, STARTS_AT, new Date("2026-04-09T19:00:00Z"))).toBe(4_000);
});
```

`Math.floor` favours the business by one penny. That is a *policy* decision, not an implementation detail — the correct move is to name it, write the test that pins whichever answer you get, and go ask. This is outside-in working as intended: driving inward surfaced a question the specification was silent on, while it is still cheap to ask.

## Step 5 — The Other Scenarios Go Inward, Not Outward

Scenarios 2 and 3 are already covered — by rows in the unit table above. They do **not** get their own outer tests.

That is the discipline that keeps an outside-in suite fast. One outer test proves the wiring: entry point reaches the rule, the amount reaches the gateway, the booking gets saved. Nothing about scenario 2 exercises a different path through that wiring; it exercises a different branch of the *rule*, which is verified in microseconds one level down.

What does earn a second outer test is a genuinely different *path*, not a different value:

```typescript
  it("marks the booking cancelled", async () => {
    // A distinct observable outcome, not a variation on the refund amount.
    const bookings = new InMemoryBookingRepository();
    const booking = bookings.add(
      aPaidBooking({ pricePaid: PRICE_PAID, classStartsAt: CLASS_STARTS_AT }),
    );

    await cancelBooking(
      { bookingId: booking.id },
      { bookings, refunds: new SpyRefundGateway(), clock: fixedClock("2026-04-07T18:00:00Z") },
    );

    expect(bookings.get(booking.id).status).toBe("cancelled");
  });

  it("does not issue a refund when nothing is due", async () => {
    // The zero case must not call the gateway at all — a £0 refund request
    // is rejected outright by some providers, so this is a boundary contract,
    // not a variation on an amount.
    const bookings = new InMemoryBookingRepository();
    const refunds = new SpyRefundGateway();
    const booking = bookings.add(
      aPaidBooking({ pricePaid: PRICE_PAID, classStartsAt: CLASS_STARTS_AT }),
    );

    await cancelBooking(
      { bookingId: booking.id },
      { bookings, refunds, clock: fixedClock("2026-04-10T17:00:00Z") },
    );

    expect(refunds.issued).toEqual([]);
  });
```

The last one is a good illustration of the boundary: it looks like "scenario 3 again," but it asserts a different thing — that no call is made — which the unit test cannot observe.

## What This Produced

| | Count | Runs in |
|---|---|---|
| Acceptance scenarios (specification) | 3 | — |
| Outer tests (wiring) | 3 | ~100 ms each |
| Unit tests (the rule, incl. boundaries) | 7 | µs |

Three scenarios did not become three end-to-end tests, and the boundary cases that matter most got the cheapest home. The specification stayed readable by the person who asked for the feature; the arithmetic got pinned where a failure names the rule that broke.

## If You Adopt Gherkin

Nothing above requires it. Written this way the scenarios live in a markdown file or a docstring beside the tests, and the `it` names carry the same sentences.

Adding Cucumber (or `behave`, or Reqnroll) buys one thing: the scenario text becomes executable, so the document a non-technical reader reads is provably in sync with the code. If such a reader exists, that is worth the step-definition layer. If the only readers are the team, you would be adding indirection to re-express `it("refunds the full amount when cancelled three days ahead")` as a regex-matched sentence — see "When the Tooling Is Worth It" in `references/bdd.md`.

Either way, **step 5 is the rule that matters**: the scenarios are the specification, not the test plan.
