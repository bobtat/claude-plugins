# Value Objects & Strongly-Typed IDs

## Value Object Principles

- **Immutable** — no state changes after creation
- **Compared by value** — two value objects with the same data are equal
- **No identity** — they don't have an ID
- **Self-validating** — encapsulate validation in creation
- Use `record` or `readonly record struct` in C#

## Value Object Examples

```csharp
// Simple value object
public sealed record PersonName
{
    public string First { get; }
    public string Last { get; }

    public PersonName(string first, string last)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(first);
        ArgumentException.ThrowIfNullOrWhiteSpace(last);
        First = first;
        Last = last;
    }

    public string FullName => $"{First} {Last}";
}

// Value object with unit — useful for measurement domains
public readonly record struct Money
{
    public decimal Amount { get; }
    public Currency Currency { get; }

    public Money(decimal amount, Currency currency)
    {
        Amount = amount;
        Currency = currency;
    }

    public static Money operator +(Money a, Money b)
    {
        if (a.Currency != b.Currency)
            throw new InvalidOperationException("Cannot add different currencies");
        return new Money(a.Amount + b.Amount, a.Currency);
    }
}

public enum Currency { USD, EUR, GBP }

// Value object with domain-specific units (e.g., health tracking)
public readonly record struct Weight
{
    public decimal Value { get; }
    public WeightUnit Unit { get; }

    public Weight(decimal value, WeightUnit unit)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(value);
        Value = value;
        Unit = unit;
    }

    public Weight ToKilograms() => Unit switch
    {
        WeightUnit.Kilograms => this,
        WeightUnit.Pounds => new Weight(Value * 0.453592m, WeightUnit.Kilograms),
        _ => throw new InvalidOperationException($"Unknown unit: {Unit}")
    };
}

public enum WeightUnit { Kilograms, Pounds }

// Email value object
public sealed record Email
{
    public string Value { get; }

    public Email(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        if (!value.Contains('@'))
            throw new ArgumentException("Invalid email format", nameof(value));
        Value = value;
    }
}
```

## Strongly-Typed IDs

Use `readonly record struct` for IDs to avoid primitive obsession and prevent mixing up IDs from different aggregates:

```csharp
public readonly record struct OrderId(Guid Value)
{
    public static OrderId New() => new(Guid.NewGuid());
}

public readonly record struct CustomerId(Guid Value)
{
    public static CustomerId New() => new(Guid.NewGuid());
}

// Type safety prevents mixing IDs
// OrderId orderId = new CustomerId(Guid.NewGuid()); // Won't compile!
```

## When to Use Value Objects

Look for these signals that a primitive should be a value object:

- **Has validation rules** — emails, phone numbers, measurements
- **Has behavior** — unit conversions, formatting, calculations
- **Is passed around together** — first name + last name = PersonName
- **Has domain meaning** — a `decimal` isn't descriptive, a `Money` is
- **Could be confused with other primitives** — two `Guid` parameters could be swapped

## EF Core Value Conversions

See `persistence.md` for configuring EF Core to store value objects and strongly-typed IDs.
