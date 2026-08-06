# Taming a Flaky Test (C#)

Demonstrates removing nondeterminism **at its source in the production code** rather than patching the test. Three causes appear here — real clock, unawaited async work, and shared state — and each has a production-side fix.

## The Flaky Test

Fails roughly one run in fifteen, more often on CI.

```csharp
[Fact]
public async Task ProcessExpiredTrials_NotifiesAndDowngrades()
{
    var service = new TrialExpiryService(_dbContext, _emailSender);
    await _dbContext.Accounts.AddAsync(new Account
    {
        Id = Guid.NewGuid(),
        Plan = Plan.Trial,
        TrialEndsAt = DateTime.UtcNow.AddSeconds(1)   // not yet expired
    });
    await _dbContext.SaveChangesAsync();

    service.ProcessExpiredTrials();

    await Task.Delay(500);   // let the background work finish

    var account = _dbContext.Accounts.Single();
    Assert.Equal(Plan.Trial, account.Plan);   // should NOT have been expired
    Assert.Empty(SentEmails.All);
}
```

## The Production Code

```csharp
public sealed class TrialExpiryService(AppDbContext db, IEmailSender email)
{
    public void ProcessExpiredTrials()
    {
        var expired = db.Accounts
            .Where(a => a.Plan == Plan.Trial && a.TrialEndsAt < DateTime.UtcNow)
            .ToList();

        foreach (var account in expired)
        {
            account.Plan = Plan.Free;
            _ = Task.Run(async () =>
            {
                await email.SendTrialEndedAsync(account.Id);
                await db.SaveChangesAsync();
            });
        }
    }
}
```

## Diagnosis

Four distinct defects, three of which are production bugs the test was correctly (if unreliably) detecting:

1. **`DateTime.UtcNow` read inside the query.** The test's `AddSeconds(1)` is a bet that less than one second elapses between arrange and act. On a cold CI runner — first EF query compiling, container warming — it loses: the trial expires mid-test and the assertions invert.

   Note the direction, because it is easy to get backwards. A *past*-dated fixture (`AddSeconds(-1)` asserting the trial **was** expired) is safe here: time only moves forward, so a slow arrange makes that row more expired, never less. The hazard is a **future**-dated fixture asserting that something has *not yet* happened, where elapsed time can cross the boundary. Any test whose correctness depends on a deadline relative to `Now` has this shape, and injecting the clock removes the whole category rather than widening the margin.
2. **Fire-and-forget `Task.Run`.** The caller cannot know when the work finished, so the test guesses with `Task.Delay(500)` — too long on a dev machine, too short under load. **This is a production bug, not a test bug**: an unobserved task swallows exceptions, and if the process shuts down mid-flight the email is sent but the downgrade is never saved.
3. **`DbContext` used concurrently.** `AppDbContext` is not thread-safe; N concurrent `Task.Run` bodies calling `SaveChangesAsync` on one context is a race in production too. It surfaces in tests as an intermittent `InvalidOperationException: A second operation was started on this context`.
4. **`SentEmails.All` is a static.** It carries state between tests, so `Assert.Single` depends on execution order and fails outright under parallel execution.

The `Task.Delay(500)` was masking bugs 2 and 3. Lengthening it — the usual "fix" — would have hidden them for longer.

## Fix 1 — Inject the Clock

```csharp
public interface IClock { DateTimeOffset UtcNow { get; } }

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}

public sealed class FixedClock(DateTimeOffset utcNow) : IClock
{
    public DateTimeOffset UtcNow { get; } = utcNow;
}
```

Same shape as `references/test-doubles.md` deliberately — one clock abstraction per codebase, not one per test file. Note also that `Account.TrialEndsAt` becomes a `DateTimeOffset` here; that is a production change to the entity and its schema, not something a test fix gets to do silently, and it belongs in its own commit.

Now `TrialEndsAt < clock.UtcNow` compares against a value the test controls. Beyond removing the flake, this makes the boundary directly testable — expiry *exactly* at the cutoff was previously untestable by construction:

```csharp
[Fact]
public async Task ProcessExpiredTrials_WhenTrialEndsExactlyNow_DoesNotExpireIt()
{
    var now = new DateTimeOffset(2026, 3, 1, 12, 0, 0, TimeSpan.Zero);
    var account = GivenAccount(plan: Plan.Trial, trialEndsAt: now);
    await _db.SaveChangesAsync();

    await NewService(new FixedClock(now)).ProcessExpiredTrialsAsync();

    Assert.Equal(Plan.Trial, Reload(account).Plan);
}
```

## Fix 2 — Return the Work Instead of Abandoning It

```csharp
public async Task<int> ProcessExpiredTrialsAsync(CancellationToken ct = default)
{
    var expired = await db.Accounts
        .Where(a => a.Plan == Plan.Trial && a.TrialEndsAt < clock.UtcNow)
        .ToListAsync(ct);

    foreach (var account in expired)
    {
        account.Plan = Plan.Free;
        await db.SaveChangesAsync(ct);
        await email.SendTrialEndedAsync(account.Id, ct);
    }

    return expired.Count;
}
```

Sequential and awaited: no race on the context, and exceptions propagate to the caller instead of vanishing into an unobserved task. The test can now await real completion — the `Task.Delay` disappears because there is nothing left to guess about.

**On ordering, and what is still not atomic.** Persist the downgrade *before* sending the notification, and save per account rather than once at the end. The reason is which failure you prefer: if the email throws, that account is already downgraded and consistent, and the remaining accounts are untouched — a retry re-processes only what's left. The reverse order (notify, then save at the end, as an earlier draft of this example had it) means a failure on the third account leaves two customers emailed about a downgrade that was never persisted. That is the same inconsistency this file criticizes in the original code; moving it rather than removing it would not be a fix.

What remains is a genuine at-least-once exposure: an email can be sent and the process die before the next iteration, or an email can be sent twice on retry. Removing that needs an outbox or an idempotency key on the send — out of scope here, but state it rather than claiming atomicity. A single `SaveChanges` makes the *database write* atomic; it does not make the observable effect atomic, because the email has already left.

Returning the count also gives the test something to assert directly instead of inferring completion from side effects.

If throughput genuinely requires concurrency, the correct shape is a bounded `Parallel.ForEachAsync` with **one scoped context per iteration** — still fully awaited. Concurrency is a deliberate design choice with its own isolation requirements, never a side effect of `_ = Task.Run(...)`.

## Fix 3 — Replace the Static With an Instance Fake

```csharp
public sealed class FakeEmailSender : IEmailSender
{
    private readonly List<SentEmail> _sent = [];
    private Exception? _failure;

    public IReadOnlyList<SentEmail> Sent => _sent;

    public void FailWith(Exception failure) => _failure = failure;

    public Task SendTrialEndedAsync(Guid accountId, CancellationToken ct = default)
    {
        if (_failure is not null) return Task.FromException(_failure);

        _sent.Add(new SentEmail(accountId, nameof(SendTrialEndedAsync)));
        return Task.CompletedTask;
    }
}
```

Constructed fresh per test, so no cross-test leakage and the suite can run in parallel.

## The Rewritten Test

```csharp
public sealed class TrialExpiryServiceTests : IAsyncLifetime
{
    private static readonly DateTimeOffset Now = new(2026, 3, 1, 12, 0, 0, TimeSpan.Zero);

    private readonly FakeEmailSender _email = new();
    private AppDbContext _db = null!;

    public async Task InitializeAsync() => _db = await TestDb.CreateAsync();
    public async Task DisposeAsync() => await _db.DisposeAsync();

    [Fact]
    public async Task ProcessExpiredTrials_DowngradesAnExpiredTrial()
    {
        var expired = GivenAccount(Plan.Trial, trialEndsAt: Now.AddDays(-1));
        await _db.SaveChangesAsync();

        var processed = await NewService().ProcessExpiredTrialsAsync();

        Assert.Equal(1, processed);
        Assert.Equal(Plan.Free, Reload(expired).Plan);
    }

    [Fact]
    public async Task ProcessExpiredTrials_LeavesATrialThatHasNotEndedYet()
    {
        var active = GivenAccount(Plan.Trial, trialEndsAt: Now.AddDays(+1));
        await _db.SaveChangesAsync();

        var processed = await NewService().ProcessExpiredTrialsAsync();

        Assert.Equal(0, processed);
        Assert.Equal(Plan.Trial, Reload(active).Plan);
    }

    [Fact]
    public async Task ProcessExpiredTrials_NotifiesOnlyTheExpiredAccount()
    {
        var expired = GivenAccount(Plan.Trial, trialEndsAt: Now.AddDays(-1));
        GivenAccount(Plan.Trial, trialEndsAt: Now.AddDays(+1));
        await _db.SaveChangesAsync();

        await NewService().ProcessExpiredTrialsAsync();

        Assert.Equal(expired.Id, Assert.Single(_email.Sent).AccountId);
    }

    [Fact]
    public async Task ProcessExpiredTrials_WhenEmailFails_SurfacesTheFailure()
    {
        // Previously unobservable: the fire-and-forget task swallowed the exception
        // entirely, so a failed notification looked exactly like a successful run.
        var account = GivenAccount(Plan.Trial, trialEndsAt: Now.AddDays(-1));
        await _db.SaveChangesAsync();
        _email.FailWith(new SmtpException("relay unavailable"));

        await Assert.ThrowsAsync<SmtpException>(() => NewService().ProcessExpiredTrialsAsync());

        // The downgrade is deliberately already persisted — see "On ordering" above.
        // The account is in a consistent state; only the notification is outstanding.
        Assert.Equal(Plan.Free, Reload(account).Plan);
    }

    private TrialExpiryService NewService(IClock? clock = null) =>
        new(_db, _email, clock ?? new FixedClock(Now));

    private Account GivenAccount(Plan plan, DateTimeOffset trialEndsAt)
    {
        var account = new Account { Id = Guid.NewGuid(), Plan = plan, TrialEndsAt = trialEndsAt };
        _db.Accounts.Add(account);
        return account;
    }

    private Account Reload(Account account)
    {
        _db.Entry(account).Reload();
        return account;
    }
}
```

## What the Flake Was Telling You

| Test symptom | Test-side "fix" | Actual production defect |
|---|---|---|
| Fails when arrange is slow | Widen the time offset | Clock read inside the query, untestable boundary |
| Needs `Task.Delay` to pass | Increase the delay | Fire-and-forget work: swallowed exceptions, non-atomic outcome |
| Intermittent `DbContext` error | Add a retry | Concurrent use of a non-thread-safe context |
| Fails when run with other tests | Force serial execution | Static mutable state |
| A *later, unrelated* test times out | Rerun CI | Leaked connection/handle from this test's abandoned task |

Every one of the shortcuts in the middle column would have kept the suite green and shipped all four bugs. Two of them — a swallowed email failure leaving an inconsistent downgrade, and concurrent context use — were real production incidents waiting to happen.

The last row is the one that misleads hardest, because the failure surfaces in innocent code. Fowler's diagnostic for it: configure the connection pool to size 1 in tests, so a leak fails immediately in the test that caused it instead of randomly in whichever test happens to drain the pool.

## Rules

These follow Fowler's [Eradicating Non-Determinism in Tests](https://martinfowler.com/articles/nonDeterminism.html), which catalogues the five causes: lack of isolation, asynchronous behavior, remote services, time dependencies, and resource leaks.

1. **Never `sleep` in a test.** Await the real signal; if there is no signal to await, that absence is the bug.
2. **Never read the clock inside logic.** Inject it; time boundaries become testable rather than accidental.
3. **Never fire and forget.** Return the task. Unobserved tasks lose exceptions and defeat any attempt to test them.
4. **Never share mutable state between tests.** Fresh instances; randomize test order in CI so violations surface immediately.
5. **Quarantine a flake immediately, then fix the source.** A test that fails 5% of the time trains the team to ignore red, which is worse than having no test. Skip it with a linked issue, and treat the cause as a production bug until proven otherwise.
