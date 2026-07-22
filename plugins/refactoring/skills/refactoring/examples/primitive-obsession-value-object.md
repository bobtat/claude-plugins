# Worked Example: Primitive Obsession → Replace Primitive with Object

Demonstrates: value-object introduction one call site at a time, behavior migration, and how the type system starts catching bugs mid-refactor. Language: C#.

## Before

Money as `decimal`, currency as `string`, everywhere:

```csharp
public class Order
{
    public decimal Total { get; set; }
    public string Currency { get; set; } = "USD";
}

public class InvoiceService
{
    public string FormatTotal(Order order) =>
        order.Currency == "USD" ? $"${order.Total:F2}"
        : order.Currency == "EUR" ? $"{order.Total:F2} €"
        : $"{order.Total:F2} {order.Currency}";

    public decimal AddShipping(Order order, decimal shipping) =>
        order.Total + shipping;   // silently assumes same currency
}

public class CartService
{
    public decimal Sum(IEnumerable<Order> orders) =>
        orders.Sum(o => o.Total); // ignores currency entirely
}
```

## Diagnosis

- **Primitive Obsession**: `(decimal, string)` is a Data Clump masquerading as two fields; the concept is `Money`.
- Formatting logic lives in `InvoiceService` (Feature Envy toward the money data); nothing stops adding USD to EUR — `CartService.Sum` already has that latent bug.
- Currency validity is enforced nowhere.

## Precondition

Tests pass for `FormatTotal`, `AddShipping`, `Sum`. Add a characterization test documenting the current (wrong but current) mixed-currency behavior of `Sum`, marked as such — refactoring must preserve it; *fixing* it comes after, as a behavior change.

## Steps

**Step 1 — Create the value object.** New code, no callers yet; add its own unit tests:

```csharp
public readonly record struct Money(decimal Amount, Currency Currency)
{
    public Money Add(Money other) =>
        Currency == other.Currency
            ? this with { Amount = Amount + other.Amount }
            : throw new CurrencyMismatchException(Currency, other.Currency);

    public override string ToString() => Currency.Format(Amount);
}
```

(`Currency` becomes a small type too — code, symbol, formatting — instead of a raw string.)

▶ Build + run tests. Green (nothing uses it yet).

**Step 2 — Change one field.** Swap `Order` to hold `Money`, keeping the old properties as *read-only* delegating shims:

```csharp
public class Order
{
    public Money Price { get; set; } = new(0m, Currency.USD);

    [Obsolete("Use Price")] public decimal Total => Price.Amount;
    [Obsolete("Use Price")] public string Currency => Price.Currency.Code;
}
```

The initializer matters: the old class defaulted `Currency` to `"USD"`, so a freshly constructed `Order` must keep reporting the same values — dropping the default would be a silent behavior change hiding inside a refactoring. Read sites keep compiling (each flagged by an `[Obsolete]` warning); write sites break immediately. The breakage is intentional — writes are where currency bugs live, so the compile errors enumerate the risky sites for migration *first*.

▶ Fix each write-site error mechanically (`order.Total = x` → `order.Price = new Money(x, ...)` — and where no currency is in scope, the error is exposing a real question). Build + tests. Green. The remaining warnings are the read-site migration to-do list.

**Step 3 — Migrate call sites one at a time**, moving behavior onto the type as each migrates:

- `FormatTotal` collapses to `order.Price.ToString()` — the per-currency formatting chain moves into `Currency.Format`, where it is written once. ▶ Tests.
- `AddShipping` becomes `order.Price.Add(shipping)` — which forces `shipping` to become `Money` in its signature (**Change Function Declaration**, callers updated one by one). ▶ Tests.
- `CartService.Sum` now fails to compile without a currency decision — **the type system just surfaced the latent bug**. To stay behavior-preserving, replicate current behavior explicitly (`orders.Sum(o => o.Price.Amount)` with a `// preserves pre-Money mixed-currency summing` note) and file the fix as follow-up behavior work.

**Step 4 — Delete the shims** once `[Obsolete]` warnings hit zero. ▶ Build + full suite. Green.

## After

Validation, formatting, and arithmetic live on `Money`/`Currency`; mismatched-currency arithmetic is impossible to write silently; call sites shrank.

## Commits

```
refactor: introduce Money value object for order totals
refactor: migrate invoice and cart services to Money
```

The `Sum` currency-bug fix ships separately as `fix: reject mixed-currency cart totals` — behavior change, different hat.
