# Worked Example: Feature Envy → Extract + Move Function

Demonstrates: diagnosing envy by counting accesses, extracting the envious core before moving it, and the delegate-then-migrate pattern. Language: Python.

## Before

```python
class Customer:
    def __init__(self, name: str, plan: Plan, discount_eligible: bool):
        self.name = name
        self.plan = plan
        self.discount_eligible = discount_eligible


class Plan:
    def __init__(self, base_rate: float, per_seat: float, seat_count: int):
        self.base_rate = base_rate
        self.per_seat = per_seat
        self.seat_count = seat_count


class BillingService:
    LOYALTY_DISCOUNT = 0.05

    def monthly_charge(self, customer: Customer) -> float:
        # computes almost entirely from Plan's data
        charge = customer.plan.base_rate
        charge += customer.plan.per_seat * customer.plan.seat_count
        if customer.plan.seat_count > 100:
            charge *= 0.90  # volume discount
        if customer.discount_eligible:
            charge *= 1 - self.LOYALTY_DISCOUNT
        return round(charge, 2)
```

## Diagnosis

Count the data accesses in `monthly_charge`:

- `customer.plan.*`: **5 accesses** (base_rate, per_seat, seat_count ×2, and the chain itself)
- `customer.*` directly: 1 (`discount_eligible`)
- `self.*` (its own class): 1 (a constant)

The method lives in `BillingService` but its heart belongs to `Plan` — **Feature Envy**, plus a **Message Chain** (`customer.plan.x` repeated). Consequence already visible in the wild: a `QuoteService` elsewhere reimplements the same volume-discount rule and the two have drifted (volume threshold 100 vs 120 — a real bug of this smell).

Note the split: the *plan-derived* part is envious; the *loyalty* part legitimately uses `Customer` and service data. Move only the envious core.

## Precondition

Tests for `monthly_charge` across: base case, >100 seats, discount-eligible, combined. Green.

## Steps

**Step 1 — Extract the envious core** so it can move as a unit (Extract Function):

```python
    def monthly_charge(self, customer: Customer) -> float:
        charge = self._plan_charge(customer.plan)
        if customer.discount_eligible:
            charge *= 1 - self.LOYALTY_DISCOUNT
        return round(charge, 2)

    def _plan_charge(self, plan: Plan) -> float:
        charge = plan.base_rate + plan.per_seat * plan.seat_count
        if plan.seat_count > 100:
            charge *= 0.90
        return charge
```

▶ Run tests. Green. The extraction already fixed the message chain — `_plan_charge` receives the `Plan` directly.

**Step 2 — Move the extract to the class it envies** (Move Function), leaving a delegation behind. Name it `base_monthly_charge`, not `monthly_charge`: it excludes the loyalty discount, and an honest name must not collide with `BillingService.monthly_charge`, which returns a different number for the same customer:

```python
class Plan:
    VOLUME_DISCOUNT_THRESHOLD = 100

    def base_monthly_charge(self) -> float:
        charge = self.base_rate + self.per_seat * self.seat_count
        if self.seat_count > self.VOLUME_DISCOUNT_THRESHOLD:
            charge *= 0.90
        return charge


class BillingService:
    def _plan_charge(self, plan: Plan) -> float:
        return plan.base_monthly_charge()   # temporary delegation
```

▶ Run tests. Green. Every `plan.x` access became `self.x` — the accessor noise disappeared, which is the confirmation the method found its home.

**Step 3 — Inline the delegation** (Inline Function) since it has one caller:

```python
    def monthly_charge(self, customer: Customer) -> float:
        charge = customer.plan.base_monthly_charge()
        if customer.discount_eligible:
            charge *= 1 - self.LOYALTY_DISCOUNT
        return round(charge, 2)
```

▶ Run tests. Green.

**Step 4 — Attempt to retire the duplicate.** Point `QuoteService` at `plan.base_monthly_charge()`. Its test *fails* — the drifted threshold (120 there vs 100 here) surfaces as a red bar. Unifying the two would change quoting behavior, which is not the refactoring hat: revert the `QuoteService` migration, leave its implementation as-is for now, and flag the 100-vs-120 discrepancy to the user as a behavior decision someone must make. Do not silently pick a winner.

## After

`Plan` owns plan pricing; `BillingService` orchestrates customer-level concerns; the volume rule exists once.

## Commits

```
refactor: extract plan charge calculation in BillingService
refactor: move plan charge onto Plan (fixes feature envy)
```

The threshold discrepancy gets a ticket/`fix:` commit only after a human picks the correct value.
