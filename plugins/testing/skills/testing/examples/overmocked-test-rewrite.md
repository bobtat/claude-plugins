# Rewriting an Over-Mocked Test (C#)

Demonstrates the highest-value move in testing: **separating the decision from the effect** so the interesting logic needs no doubles at all.

## The Starting Point

```csharp
public sealed class SubscriptionRenewalService(
    ISubscriptionRepository repository,
    IPricingService pricing,
    IDiscountRepository discounts,
    IPaymentGateway gateway,
    IEmailSender email,
    IClock clock,
    ILogger<SubscriptionRenewalService> logger)
{
    public async Task<RenewalResult> RenewAsync(Guid subscriptionId)
    {
        var subscription = await repository.GetAsync(subscriptionId);
        logger.LogInformation("Renewing {Id}", subscriptionId);

        if (subscription.Status == SubscriptionStatus.Cancelled)
            return RenewalResult.Skipped("cancelled");

        if (subscription.ExpiresAt > clock.Now.AddDays(7))
            return RenewalResult.Skipped("not due");

        var basePrice = await pricing.GetPriceAsync(subscription.PlanId);
        var discount = await discounts.FindActiveAsync(subscription.CustomerId, clock.Now);

        var amount = basePrice;
        if (discount is not null)
        {
            amount = discount.Kind == DiscountKind.Percentage
                ? basePrice * (1 - discount.Value / 100m)
                : basePrice - discount.Value;

            if (amount < 0m) amount = 0m;
        }

        if (subscription.LoyaltyYears >= 3)
            amount *= 0.95m;

        var charge = await gateway.ChargeAsync(subscription.PaymentMethodId, amount);
        if (!charge.Succeeded)
            return RenewalResult.Failed(charge.FailureReason);

        subscription.ExtendBy(TimeSpan.FromDays(30), clock.Now);
        await repository.SaveAsync(subscription);
        await email.SendRenewalConfirmationAsync(subscription.CustomerId, amount);

        return RenewalResult.Renewed(amount);
    }
}
```

The test for the interesting behavior — discount and loyalty pricing:

```csharp
[Fact]
public async Task RenewAsync_AppliesPercentageDiscountAndLoyaltyDiscount()
{
    var repository = Substitute.For<ISubscriptionRepository>();
    var pricing = Substitute.For<IPricingService>();
    var discounts = Substitute.For<IDiscountRepository>();
    var gateway = Substitute.For<IPaymentGateway>();
    var email = Substitute.For<IEmailSender>();
    var clock = Substitute.For<IClock>();
    var logger = Substitute.For<ILogger<SubscriptionRenewalService>>();

    var now = new DateTimeOffset(2026, 3, 1, 0, 0, 0, TimeSpan.Zero);
    clock.Now.Returns(now);

    var subscription = new Subscription
    {
        Id = Guid.NewGuid(),
        CustomerId = Guid.NewGuid(),
        PlanId = Guid.NewGuid(),
        PaymentMethodId = "pm_1",
        Status = SubscriptionStatus.Active,
        ExpiresAt = now.AddDays(2),
        LoyaltyYears = 4
    };

    repository.GetAsync(subscription.Id).Returns(subscription);
    pricing.GetPriceAsync(subscription.PlanId).Returns(100m);
    discounts.FindActiveAsync(subscription.CustomerId, now)
             .Returns(new Discount(DiscountKind.Percentage, 10m));
    gateway.ChargeAsync("pm_1", Arg.Any<decimal>())
           .Returns(ChargeResult.Success("ch_1"));

    var sut = new SubscriptionRenewalService(
        repository, pricing, discounts, gateway, email, clock, logger);

    var result = await sut.RenewAsync(subscription.Id);

    await gateway.Received(1).ChargeAsync("pm_1", 85.5m);
    Assert.Equal(85.5m, result.Amount);
}
```

## What's Wrong

- **Seven doubles** to verify one arithmetic rule. 30 lines of setup for a 2-line assertion.
- **The assertion is about a mock call.** `gateway.Received(1).ChargeAsync(...)` says "the code called the gateway with 85.5" — coupling the pricing test to the payment mechanism. Move the charge behind a different port and this test breaks though pricing is unchanged.
- **`Arg.Any<decimal>()` in the setup** while asserting the exact amount later means the stub answers regardless of what's passed. Get the amount wrong and the charge still "succeeds" — the test only catches it via `Received`.
- **The pricing rules can't be tested exhaustively.** Fixed discount, negative-clamping, no discount, loyalty below 3 years, discount-plus-loyalty interaction: each needs its own copy of the 30-line setup. In practice they never get written, so the clamp at `if (amount < 0m)` stays untested — and that's the line most likely to be wrong.
- **It's not clear what the test protects.** If `RenewalResult.Amount` were computed differently from the charged amount, this test wouldn't notice.

The setup length is the signal: **this class mixes a pure decision (what to charge) with orchestration (fetch, charge, save, notify).**

## Step 1 — Extract the Decision

The pricing rules depend only on data. Give them a home that takes data and returns data:

```csharp
public sealed record RenewalPricing(decimal BasePrice, Discount? Discount, int LoyaltyYears)
{
    public decimal AmountDue()
    {
        var amount = BasePrice;

        if (Discount is not null)
        {
            amount = Discount.Kind switch
            {
                DiscountKind.Percentage => BasePrice * (1 - Discount.Value / 100m),
                DiscountKind.FixedAmount => BasePrice - Discount.Value,
                _ => BasePrice
            };
        }

        if (LoyaltyYears >= 3)
            amount *= LoyaltyDiscountFactor;

        return Math.Max(amount, 0m);
    }

    private const decimal LoyaltyDiscountFactor = 0.95m;
}
```

Note the behavior change smuggled in, and note that it is **not** fully equivalent. The original clamped to zero inside the `if (discount is not null)` branch; the new code clamps unconditionally at the end. Working the cases:

- Fixed discount exceeding base price: original clamps to 0, then the loyalty branch gives `0 * 0.95 = 0`. New code: same. **Equivalent.**
- Percentage discount over 100%: both reach 0. **Equivalent.**
- **No discount, negative `BasePrice`: the original never clamps (the clamp sits inside the discount branch) and returns the negative value; the new code returns 0. Not equivalent.**

Whether that matters depends on whether a negative base price is reachable — if prices come from a validated catalog it is dead input, and clamping is a harmless improvement. If it *is* reachable, the change is a behavior fix and belongs in its own commit with its own test, not smuggled into a refactoring.

That is the point of the exercise: enumerate the cases and say which ones the move changes. "Verify such equivalences before moving code" means all of them, not the one that supports the conclusion. (Secondary: the original's ternary treated every non-`Percentage` kind as fixed-amount; the new `switch` adds `_ => BasePrice`. Identical for two kinds, divergent the moment a third exists.)

## Step 2 — Test the Decision With No Doubles

```csharp
public sealed class RenewalPricingTests
{
    [Fact]
    public void AmountDue_WithNoDiscount_IsBasePrice() =>
        Assert.Equal(100m, Pricing(basePrice: 100m).AmountDue());

    [Theory]
    [InlineData(100, 10, 90)]     // 10% off
    [InlineData(100, 100, 0)]     // 100% off
    [InlineData(49.99, 50, 24.995)]
    public void AmountDue_WithPercentageDiscount_ReducesProportionally(
        decimal basePrice, decimal percent, decimal expected)
    {
        var pricing = Pricing(basePrice, new Discount(DiscountKind.Percentage, percent));
        Assert.Equal(expected, pricing.AmountDue());
    }

    [Fact]
    public void AmountDue_WithFixedDiscount_SubtractsAmount() =>
        Assert.Equal(75m, Pricing(100m, Fixed(25m)).AmountDue());

    [Fact]
    public void AmountDue_WhenFixedDiscountExceedsPrice_IsZero() =>
        Assert.Equal(0m, Pricing(20m, Fixed(50m)).AmountDue());

    [Theory]
    [InlineData(2, 100)]          // below loyalty threshold
    [InlineData(3, 95)]           // exactly at threshold
    [InlineData(10, 95)]
    public void AmountDue_AppliesLoyaltyDiscountFromThreeYears(
        int loyaltyYears, decimal expected)
    {
        var pricing = Pricing(100m, loyaltyYears: loyaltyYears);
        Assert.Equal(expected, pricing.AmountDue());
    }

    [Fact]
    public void AmountDue_AppliesLoyaltyToTheAlreadyDiscountedPrice() =>
        // 100 - 10% = 90, then 5% loyalty = 85.50
        Assert.Equal(85.5m, Pricing(100m, Percentage(10m), loyaltyYears: 4).AmountDue());

    private static RenewalPricing Pricing(
        decimal basePrice, Discount? discount = null, int loyaltyYears = 0) =>
        new(basePrice, discount, loyaltyYears);

    private static Discount Percentage(decimal v) => new(DiscountKind.Percentage, v);
    private static Discount Fixed(decimal v) => new(DiscountKind.FixedAmount, v);
}
```

Ten executed cases across six test methods, including the boundaries that were previously untestable, no doubles, and each runs in microseconds. The `85.5m` assertion from the original test survives — as one line, in the test that's actually about it.

One framework note, since it bites people: the `[InlineData]` literals above are `double`, and xUnit converts them to `decimal` at invocation. Writing them as `49.99m` looks more correct and is a hard compile error — `decimal` is not a legal attribute-argument type (CS0182). If exact decimal literals matter for a case, use `[MemberData]` with a `TheoryData<decimal, decimal, decimal>` instead.

## Step 3 — Slim the Orchestrator

```csharp
public async Task<RenewalResult> RenewAsync(Guid subscriptionId)
{
    var subscription = await repository.GetAsync(subscriptionId);

    if (!subscription.IsDueForRenewal(clock.Now))
        return RenewalResult.Skipped(subscription.RenewalSkipReason(clock.Now));

    var renewalPricing = new RenewalPricing(
        await pricing.GetPriceAsync(subscription.PlanId),
        await discounts.FindActiveAsync(subscription.CustomerId, clock.Now),
        subscription.LoyaltyYears);

    var amount = renewalPricing.AmountDue();

    var charge = await gateway.ChargeAsync(subscription.PaymentMethodId, amount);
    if (!charge.Succeeded)
        return RenewalResult.Failed(charge.FailureReason);

    subscription.ExtendBy(TimeSpan.FromDays(30), clock.Now);
    await repository.SaveAsync(subscription);
    await email.SendRenewalConfirmationAsync(subscription.CustomerId, amount);

    return RenewalResult.Renewed(amount);
}
```

The due-for-renewal rules moved onto `Subscription`, where they're testable as plain state checks too.

## Step 4 — Test the Orchestration Thinly

The orchestrator's behavior is now: skip when not due, charge, don't extend on failure, extend and notify on success. Five tests — the split described below turned one of the four into two — using **fakes** rather than mocks for everything except the two genuine effects:

```csharp
public sealed class SubscriptionRenewalServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 3, 1, 0, 0, 0, TimeSpan.Zero);

    private readonly InMemorySubscriptionRepository _repository = new();
    private readonly FakePaymentGateway _gateway = new();
    private readonly FakeEmailSender _email = new();
    private readonly SubscriptionRenewalService _sut;

    public SubscriptionRenewalServiceTests() =>
        _sut = new SubscriptionRenewalService(
            _repository,
            new StubPricingService(100m),
            new InMemoryDiscountRepository(),
            _gateway,
            _email,
            new FixedClock(Now),
            NullLogger<SubscriptionRenewalService>.Instance);

    [Fact]
    public async Task RenewAsync_WhenNotYetDue_DoesNotCharge()
    {
        var subscription = _repository.Add(ASubscription().ExpiringOn(Now.AddDays(30)));

        var result = await _sut.RenewAsync(subscription.Id);

        Assert.Equal(RenewalOutcome.Skipped, result.Outcome);
        Assert.Empty(_gateway.Charges);
    }

    [Fact]
    public async Task RenewAsync_WhenDue_ExtendsExpiryByThirtyDays()
    {
        var subscription = _repository.Add(ASubscription().ExpiringOn(DueSoon));

        var result = await _sut.RenewAsync(subscription.Id);

        Assert.Equal(RenewalOutcome.Renewed, result.Outcome);
        Assert.Equal(ExpectedRenewedExpiry, _repository.Get(subscription.Id).ExpiresAt);
    }

    [Fact]
    public async Task RenewAsync_WhenDue_ChargesTheCardExactlyOnce()
    {
        // The one interaction genuinely worth asserting: double-charging is a
        // real-money bug that no state assertion would catch.
        var subscription = _repository.Add(ASubscription().ExpiringOn(DueSoon));

        await _sut.RenewAsync(subscription.Id);

        Assert.Single(_gateway.Charges);
    }

    [Fact]
    public async Task RenewAsync_WhenChargeFails_DoesNotExtendExpiry()
    {
        var subscription = _repository.Add(ASubscription().ExpiringOn(DueSoon));
        _gateway.FailAllCharges("card_declined");

        var result = await _sut.RenewAsync(subscription.Id);

        Assert.Equal("card_declined", result.FailureReason);
        Assert.Equal(DueSoon, _repository.Get(subscription.Id).ExpiresAt);
    }

    [Fact]
    public async Task RenewAsync_WhenChargeFails_DoesNotNotifyTheCustomer()
    {
        var subscription = _repository.Add(ASubscription().ExpiringOn(DueSoon));
        _gateway.FailAllCharges("card_declined");

        await _sut.RenewAsync(subscription.Id);

        Assert.Empty(_email.Sent);
    }

    // Named so the assertions read as rules rather than arithmetic:
    // due in two days, and a renewal adds thirty to the existing expiry.
    private static readonly DateTimeOffset DueSoon = Now.AddDays(2);
    private static readonly DateTimeOffset ExpectedRenewedExpiry =
        new(2026, 4, 2, 0, 0, 0, TimeSpan.Zero);
}
```

Note what splitting bought. `RenewAsync_WhenDue_ChargesAndExtendsExpiry` and `..._DoesNotExtendOrNotify` were each two behaviors wearing one name — exactly the "if the name needs *and*, it's two tests" rule from `references/test-design.md`. Split, a failure now names the behavior that broke instead of the scenario that contained it, and the charge-failure case no longer aborts before reaching the email assertion. The expected expiry is also a named constant rather than `Now.AddDays(32)`, because computing an expectation from the same arithmetic the production code uses is the vacuous-assertion trap.

## What Changed

| | Before | After |
|---|---|---|
| Doubles to test pricing | 7 | 0 |
| Setup lines for a pricing case | ~30 | 1 |
| Pricing cases actually covered | 1 | 10, incl. all boundaries |
| Assertion style | Mock call verification | Returned values and observable state |
| Survives moving the charge behind a new port | No | Yes (pricing tests unaffected) |
| Interaction assertions remaining | Many, incidental | One, deliberate (charge exactly once) |

The general lesson: **when mock setup dominates a test, the fix is in the production code, not the test.** Extract the decision, test it with values, and let a handful of thin tests cover the wiring.
