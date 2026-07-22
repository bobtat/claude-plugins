# Worked Example: Repeated Type Switch → Replace Conditional with Polymorphism

Demonstrates: migrating one branch at a time with the switch still alive mid-refactor, and the factory as the single remaining dispatch point. Language: C#.

## Before

Two services switch on the same shipping-method string:

```csharp
public class ShippingCalculator
{
    public decimal Cost(Shipment s) => s.Method switch
    {
        "ground"    => 5.00m + s.WeightKg * 0.50m,
        "express"   => 15.00m + s.WeightKg * 1.20m,
        "overnight" => 40.00m + s.WeightKg * 2.50m,
        _ => throw new ArgumentException($"unknown method {s.Method}")
    };
}

public class DeliveryEstimator
{
    public int BusinessDays(Shipment s) => s.Method switch
    {
        "ground"    => s.DistanceKm < 500 ? 3 : 6,
        "express"   => 2,
        "overnight" => 1,
        _ => throw new ArgumentException($"unknown method {s.Method}")
    };
}
```

## Diagnosis

- **Repeated Switch on Type**: the same three-way dispatch in two places (and label printing has a third, elsewhere). Adding a `"drone"` method means hunting down every switch; miss one and it throws at runtime.
- One switch alone would be acceptable; *repetition* makes it a Change Preventer.

## Precondition

Tests cover cost and estimate per method. Green.

## Steps

**Step 1 — Create the hierarchy and factory.** No behavior moves yet:

```csharp
public abstract class ShippingMethod
{
    public static ShippingMethod From(string code) => code switch
    {
        "ground" => new GroundShipping(),
        "express" => new ExpressShipping(),
        "overnight" => new OvernightShipping(),
        _ => throw new ArgumentException($"unknown method {code}")
    };
}
public class GroundShipping : ShippingMethod { }
public class ExpressShipping : ShippingMethod { }
public class OvernightShipping : ShippingMethod { }
```

▶ Build + tests. Green. This factory switch is the *one* switch that remains at the end — dispatch happens once, at creation.

**Step 2 — Move the whole switch into the base class and route the caller through it.** No logic changes shape yet; it just changes address — and critically, the tests now exercise the hierarchy:

```csharp
public abstract class ShippingMethod
{
    public virtual decimal Cost(Shipment s) => s.Method switch
    {
        "ground"    => 5.00m + s.WeightKg * 0.50m,
        "express"   => 15.00m + s.WeightKg * 1.20m,
        "overnight" => 40.00m + s.WeightKg * 2.50m,
        _ => throw new ArgumentException($"unknown method {s.Method}")
    };
}

public class ShippingCalculator
{
    public decimal Cost(Shipment s) => ShippingMethod.From(s.Method).Cost(s);
}
```

▶ Run tests. Green — and the green means something: every cost assertion now flows through `From(...)` and the base method. (Later, `Shipment.Method` itself can become a `ShippingMethod` instead of a string — a follow-up Replace Primitive with Object.)

**Step 3 — Migrate one branch per subclass.** Override in `GroundShipping` with the `"ground"` arm's logic; delete that arm from the base switch:

```csharp
public class GroundShipping : ShippingMethod
{
    public override decimal Cost(Shipment s) => 5.00m + s.WeightKg * 0.50m;
}
```

▶ Run tests — the ground-shipping tests now hit the override, the rest still hit the shrinking base switch. Green. Repeat for `ExpressShipping`, then `OvernightShipping`, running tests between each. When the base switch has no arms left, delete it and make `Cost` abstract — the compiler now *forces* every future method to implement it (the switch never forced anything).

**Step 4 — Repeat steps 2–3 for `BusinessDays`** in `DeliveryEstimator`: move its switch onto the base, route the caller, migrate one branch per subclass, tests between each.

## After

```csharp
public class GroundShipping : ShippingMethod
{
    public override decimal Cost(Shipment s) => 5.00m + s.WeightKg * 0.50m;
    public override int BusinessDays(Shipment s) => s.DistanceKm < 500 ? 3 : 6;
}
```

Everything about ground shipping lives in one class. Adding `"drone"` = one new subclass + one factory line, and the compiler lists every member it must provide.

## When NOT to do this

- A **single** switch, not repeated: leave it; a switch is simpler than a hierarchy.
- Branches are pure data (rate tables, no logic): a dictionary keyed by method code is lighter than subclasses.
- New *operations* are added more often than new *types*: the switch layout actually serves that change axis better (the expression problem cuts both ways).

## Commits

```
refactor: introduce ShippingMethod hierarchy with factory
refactor: replace shipping cost switch with polymorphism
refactor: replace delivery estimate switch with polymorphism
```
