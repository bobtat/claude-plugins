# Characterizing Legacy Code, Then Fixing It (Python)

Demonstrates the full legacy sequence: lock current behavior → create a seam → discover a bug → fix it in a separate, visible step.

## The Code

Twelve years old, no tests, called from three places, and someone has just asked for a rule change.

```python
# billing/late_fees.py
import datetime
from decimal import Decimal

GRACE_DAYS = 5
DAILY_RATE = Decimal("0.015")
MAX_FEE = Decimal("250.00")


def calculate_late_fee(invoice):
    """Calculate the late fee owed on an overdue invoice."""
    today = datetime.date.today()

    if invoice["status"] == "paid":
        return Decimal("0.00")

    days_late = (today - invoice["due_date"]).days - GRACE_DAYS
    if days_late <= 0:
        return Decimal("0.00")

    fee = invoice["amount"] * DAILY_RATE * days_late

    if invoice.get("customer_tier") == "premium":
        fee = fee / 2

    if fee > MAX_FEE:
        fee = MAX_FEE

    return fee.quantize(Decimal("0.01"))
```

Two problems for testing: `date.today()` makes every result change daily, and there are no tests to tell you whether a change breaks anything.

## Step 1 — The Minimal Seam

The only blocker is the clock. A **parameter seam with a default** is additive — all three existing callers keep working untouched:

```python
def calculate_late_fee(invoice, today=None):
    if today is None:                      # not `today or …` — see legacy-code.md
        today = datetime.date.today()
    ...
```

Two lines, no behavior change for any existing caller, and the function becomes deterministic under test. Commit this alone as `refactor: add injectable today parameter to calculate_late_fee`.

## Step 2 — Discover Actual Behavior

Don't reason about the output — measure it. Write a deliberately wrong assertion and let the failure report the truth:

```python
def test_characterize():
    invoice = {
        "status": "unpaid",
        "due_date": datetime.date(2026, 1, 1),
        "amount": Decimal("1000.00"),
    }
    assert calculate_late_fee(invoice, today=datetime.date(2026, 1, 20)) == "?"
```

```
E   AssertionError: assert Decimal('210.00') == '?'
```

`1000 × 0.015 × (19 − 5) = 210.00`. Paste it in. Repeat for each branch: paid, within grace, exactly at grace, premium tier, above the cap.

## Step 3 — The Characterization Suite

```python
# tests/test_late_fees_characterization.py
"""Characterization tests: these document what calculate_late_fee DOES today,
not what it should do. Written before changing the grace-period rule.
"""
import datetime
from decimal import Decimal

import pytest

from billing.late_fees import calculate_late_fee

DUE = datetime.date(2026, 1, 1)


def an_invoice(**overrides):
    return {
        "status": "unpaid",
        "due_date": DUE,
        "amount": Decimal("1000.00"),
        **overrides,
    }


def test_paid_invoice_owes_nothing():
    fee = calculate_late_fee(an_invoice(status="paid"), today=DUE + datetime.timedelta(days=90))
    assert fee == Decimal("0.00")


@pytest.mark.parametrize("days_after_due", [0, 1, 5])
def test_within_grace_period_owes_nothing(days_after_due):
    fee = calculate_late_fee(an_invoice(), today=DUE + datetime.timedelta(days=days_after_due))
    assert fee == Decimal("0.00")


def test_first_chargeable_day_is_six_days_after_due():
    fee = calculate_late_fee(an_invoice(), today=DUE + datetime.timedelta(days=6))
    assert fee == Decimal("15.00")


def test_fee_accrues_daily_after_grace():
    # 1000 * 0.015 * (19 - 5 days grace) = 210.00
    fee = calculate_late_fee(an_invoice(), today=datetime.date(2026, 1, 20))
    assert fee == Decimal("210.00")


def test_premium_customers_pay_half():
    fee = calculate_late_fee(
        an_invoice(customer_tier="premium"), today=datetime.date(2026, 1, 20)
    )
    assert fee == Decimal("105.00")


def test_fee_is_capped():
    fee = calculate_late_fee(an_invoice(), today=datetime.date(2026, 6, 1))
    assert fee == Decimal("250.00")


def test_premium_cap_applies_after_halving():
    # Documents ordering: halve first, then cap. A premium customer can
    # therefore owe the full 250 cap, not 125.
    fee = calculate_late_fee(
        an_invoice(customer_tier="premium"), today=datetime.date(2026, 12, 1)
    )
    assert fee == Decimal("250.00")


def test_missing_customer_tier_is_treated_as_standard():
    invoice = an_invoice()
    assert "customer_tier" not in invoice
    fee = calculate_late_fee(invoice, today=datetime.date(2026, 1, 20))
    assert fee == Decimal("210.00")
```

Two things this suite already did before any code changed:

- **`test_premium_cap_applies_after_halving`** pinned an ordering nobody had noticed. Whether it's intended is a product question — but now it can't change silently.
- **`test_first_chargeable_day_is_six_days_after_due`** pinned the off-by-one interpretation of "5 grace days." The requested rule change is about the grace period, so this is exactly the assertion that must be deliberate rather than accidental.

## Step 4 — Confirm the Lock Covers the Blast Radius

Every test above was **born red**. Step 2 started each one from a deliberately wrong assertion — `assert calculate_fee(invoice) == "PLACEHOLDER"` — ran it, and read the real value out of the failure message. So each has already been observed failing for the reason it should, which is the whole content of the "watch it fail first" habit.

That settles that each assertion is **live** — it evaluates something and compares. It does not settle the different and more important question: **would this lock notice the change I am about to make?** Step 5 proves the gap from inside this example — the suite reaches 100% statement *and* branch coverage, every test was born red, and it still misses negative amounts entirely.

The tempting way to answer it is to break the production code and watch the suite react. Changing `GRACE_DAYS` to `4` produces a satisfying five-failure output:

```
FAILED test_within_grace_period_owes_nothing[5]  - Decimal('15.00') == Decimal('0.00')
FAILED test_first_chargeable_day_is_six_days_after_due - Decimal('30.00') == Decimal('15.00')
FAILED test_fee_accrues_daily_after_grace - Decimal('225.00') == Decimal('210.00')
FAILED test_missing_customer_tier_is_treated_as_standard - Decimal('225.00') == Decimal('210.00')
FAILED test_premium_customers_pay_half - Decimal('112.50') == Decimal('105.00')
```

**Don't.** It puts a real defect in the working tree that only a remembered revert removes, and anything interrupting the sequence — a failing run you stop to investigate, a context limit, a crash — ships it.

The right tool answers the same question without that risk: **mutation testing**. `mutmut run --paths-to-mutate billing.py` mutates a scratch copy, runs the suite against each mutant, and reports which survived. A surviving mutant is a change your lock would not notice — precisely what breaking `GRACE_DAYS` was trying to find out, computed across every constant and condition in the blast radius instead of the one you happened to think of, and leaving nothing behind. On a single module it takes minutes.

Run it before Step 6, not after: surviving mutants tell you where the lock is thin while there is still time to thicken it. Then commit as `test: characterize existing late-fee calculation`.

Two of those five are the same input (`an_invoice()` at Jan 20) asserting the same value — `test_missing_customer_tier_is_treated_as_standard` differs only by also asserting that the key is absent. That duplication is worth noticing rather than tolerating: fold the absent-key assertion into the accrual test, or drop it, because two tests failing for one reason is two tests to update every time the rule changes.

## Step 5 — Finding the Gap Coverage Can't

Run coverage and it reports **100%, nothing missing** — all 18 statements execute across the eight tests. That is the honest result, and it is exactly why coverage is a weak instrument for this job: the gap in this suite is not an unexecuted line, it is an **untested equivalence class**. Nothing in the function branches on the *sign* of `amount`, so no line- or branch-coverage tool can point at it.

The gap surfaces from the case-selection checklist instead (`references/test-design.md`, "Choosing Test Cases", step 4): enumerate the classes the code might treat differently. Amounts are positive in every test so far — but credit notes exist in this system, and nothing stops one reaching here:

```python
def test_negative_amount_produces_negative_fee():
    """BUG (#4471): a credit note produces a negative 'fee', which the caller
    adds to the balance as a discount. Characterized, not fixed, here.
    """
    fee = calculate_late_fee(an_invoice(amount=Decimal("-500.00")),
                            today=datetime.date(2026, 1, 20))
    assert fee == Decimal("-105.00")
```

The cap check (`fee > MAX_FEE`) never fires for negatives, so there's no floor. This is a genuine bug — and it stays asserted as-is for now. Fixing it inside the characterization commit would destroy the record of what the code used to do.

## Step 6 — The Requested Change, Under the Lock

The actual request: premium customers get a 10-day grace period. With the lock in place this is a small, verified change — write the new test first:

```python
def test_premium_customers_get_ten_day_grace_period():
    invoice = an_invoice(customer_tier="premium")
    assert calculate_late_fee(invoice, today=DUE + datetime.timedelta(days=10)) == Decimal("0.00")
    assert calculate_late_fee(invoice, today=DUE + datetime.timedelta(days=11)) == Decimal("7.50")
```

```python
GRACE_DAYS = 5
PREMIUM_GRACE_DAYS = 10


def calculate_late_fee(invoice, today=None):
    if today is None:                      # not `today or …` — see legacy-code.md
        today = datetime.date.today()

    if invoice["status"] == "paid":
        return Decimal("0.00")

    is_premium = invoice.get("customer_tier") == "premium"
    grace_days = PREMIUM_GRACE_DAYS if is_premium else GRACE_DAYS

    days_late = (today - invoice["due_date"]).days - grace_days
    if days_late <= 0:
        return Decimal("0.00")

    fee = invoice["amount"] * DAILY_RATE * days_late
    if is_premium:
        fee = fee / 2

    return min(fee, MAX_FEE).quantize(Decimal("0.01"))
```

Run the suite. One characterization test goes red:

```
FAILED test_premium_customers_pay_half - Decimal('67.50') == Decimal('105.00')
```

That is the system working as designed. The failure is **expected** — premium fees now start accruing 5 days later, so the 19-day case charges for 9 days instead of 14. Update that expectation and say so in the commit message. Every other test stayed green, which is the real payoff: the change did what was asked and nothing else.

Commit: `feat: extend late-fee grace period to 10 days for premium customers`, noting the one updated characterization expectation in the body.

## Step 7 — Fix the Bug, Separately

Now flip the assertion that documented the bug:

```python
def test_negative_amount_produces_no_fee():
    fee = calculate_late_fee(an_invoice(amount=Decimal("-500.00")),
                            today=datetime.date(2026, 1, 20))
    assert fee == Decimal("0.00")
```

```python
    fee = invoice["amount"] * DAILY_RATE * days_late
    if is_premium:
        fee = fee / 2

    return min(max(fee, Decimal("0.00")), MAX_FEE).quantize(Decimal("0.01"))
```

Commit: `fix: clamp late fee to zero for credit notes (#4471)`. The diff shows an assertion changing from `-105.00` to `0.00` — a reviewer sees exactly which behavior changed and that it was intentional.

## The Sequence

| Commit | Type | What it changed |
|---|---|---|
| 1 | `refactor:` | Injectable `today` — no behavior change |
| 2 | `test:` | Characterization lock, including a documented bug |
| 3 | `feat:` | Premium grace period (one expectation updated, explained) |
| 4 | `fix:` | Negative-amount clamp (documented bug's assertion flipped) |

Each commit answers one question. Collapsed into a single commit, nobody — including you in six months — could tell which assertion changes were intended and which were regressions papered over.
