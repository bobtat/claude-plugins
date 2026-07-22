# Domain Services

## What is a Domain Service?

A domain service encapsulates **stateless domain logic** that doesn't naturally belong to a single aggregate. If the logic requires coordinating multiple aggregates or applying rules that span across entities, it belongs in a domain service — not shoehorned into one aggregate.

## When to Use a Domain Service

### Use a domain service when:
- The logic **spans multiple aggregates** and no single aggregate owns it
- The operation requires **coordination** between entities from different aggregates
- The logic represents a **domain concept** that isn't an entity or value object
- You need to enforce a **cross-aggregate invariant** (though prefer eventual consistency when possible)

### Don't use a domain service when:
- The logic belongs to a **single aggregate** — put it on the aggregate root
- You're just **orchestrating infrastructure** (saving, publishing events) — that's the application layer
- You're **transforming data** for an API response — that's a DTO mapping concern
- You could use a **value object method** instead (e.g., unit conversion)

## Decision Guide

```
Does this logic change the state of a single aggregate?
  -> Yes -> Put it on the aggregate root

Does it involve computation with no state changes?
  -> Yes -> Could it be a value object method?
    -> Yes -> Put it on the value object
    -> No -> Domain service

Does it coordinate state changes across multiple aggregates?
  -> Yes -> Domain service (called from application layer)

Does it orchestrate infrastructure (save, publish, send)?
  -> Yes -> Application layer handler, not a domain service
```

## Examples

### Pricing Calculator — Pure Domain Logic (e-commerce)

```csharp
/// <summary>
/// Calculates order total with discount rules.
/// Stateless — no dependencies on infrastructure.
/// </summary>
public static class PricingCalculator
{
    public static Money CalculateTotal(
        IReadOnlyList<OrderLine> lines,
        DiscountPolicy? discount = null)
    {
        if (lines.Count == 0)
            throw new DomainException("Cannot calculate a total for an empty order");

        // Seed with the first line's currency — a fixed-currency seed would
        // throw for any other currency; mixed-currency lines still throw via
        // the Money + operator, which is the intended invariant
        var subtotal = lines.Aggregate(
            new Money(0, lines[0].UnitPrice.Currency),
            (sum, line) => sum + new Money(
                line.UnitPrice.Amount * line.Quantity,
                line.UnitPrice.Currency));

        if (discount is null)
            return subtotal;

        return discount.Apply(subtotal);
    }
}
```

### BMI Calculator — Health Domain (illustrative)

```csharp
/// <summary>
/// Calculates BMI from height and weight measurements.
/// Example from a health-tracking domain.
/// </summary>
public static class BmiCalculator
{
    public static Bmi Calculate(Height height, Weight weight)
    {
        var heightInMeters = height.ToMeters().Value;
        var weightInKg = weight.ToKilograms().Value;

        if (heightInMeters <= 0)
            throw new DomainException("Height must be positive");

        var value = weightInKg / (heightInMeters * heightInMeters);
        var category = ClassifyBmi(value);

        return new Bmi(Math.Round(value, 1), category);
    }

    private static BmiCategory ClassifyBmi(decimal value) => value switch
    {
        < 18.5m => BmiCategory.Underweight,
        < 25.0m => BmiCategory.Normal,
        < 30.0m => BmiCategory.Overweight,
        _ => BmiCategory.Obese
    };
}
```

### Overlap Validator — Cross-Entity Rule

```csharp
/// <summary>
/// Validates that a new booking doesn't overlap with existing ones.
/// This rule spans multiple aggregates, so it doesn't belong on any single one.
/// </summary>
public sealed class BookingOverlapValidator
{
    public bool HasOverlap(
        DateTimeRange proposedTime,
        IReadOnlyList<Booking> existingBookings)
    {
        return existingBookings.Any(booking =>
            booking.TimeRange.OverlapsWith(proposedTime));
    }

    public void EnsureNoOverlap(
        DateTimeRange proposedTime,
        IReadOnlyList<Booking> existingBookings)
    {
        if (HasOverlap(proposedTime, existingBookings))
            throw new BookingOverlapException(proposedTime);
    }
}
```

## Domain Service Characteristics

| Characteristic | Domain Service | Application Service |
|---|---|---|
| **Contains** | Business rules, domain logic | Orchestration, workflow |
| **Dependencies** | Other domain objects only | Repositories, infrastructure, domain services |
| **State** | Stateless | Stateless |
| **Knows about** | Domain model | Domain model + infrastructure interfaces |
| **Example** | Calculate pricing with discount rules | Load order, call pricing calculator, save result |

## Registration

Domain services are registered as part of the module:

```csharp
// In the module's registration method
services.AddSingleton<BookingOverlapValidator>();
```

For pure static domain services (like `PricingCalculator`), no registration is needed.

## Domain Service vs. Extension Methods

For very simple, pure logic, a static method or extension method may suffice:

```csharp
// Simple enough for an extension method
public static class MoneyExtensions
{
    public static Money ConvertTo(this Money money, Currency target, decimal rate)
        => new(money.Amount * rate, target);
}
```

Use a domain service class when:
- The logic is complex enough to warrant its own tests
- It involves multiple collaborating objects
- It represents a named concept in the ubiquitous language
