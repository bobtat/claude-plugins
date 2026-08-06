# Testing Legacy & Untested Code

Everything in this file derives from Michael Feathers' *Working Effectively with Legacy Code* (2004); the terms of art are his.

Working definition: **"Legacy code is code without tests."** Age and style are irrelevant; the problem is that you cannot change it and know whether you broke something. The goal of everything here is to get a **behavior lock** — a set of tests that will go red if behavior changes — before doing anything else.

The dilemma is circular: to change the code safely you need tests, but to test it you must change it. Feathers' resolution is a governing constraint — **"change as little code as possible to get tests in place"** — so the only permitted changes are **mechanical, minimal, and behavior-preserving by construction** (tool-assisted rename/extract/move, adding an overload, parameterizing a constructor), accepting a small bounded risk to enable a large safety gain.

His **Legacy Code Change Algorithm** is the sequence:

1. Identify change points
2. Find test points
3. Break dependencies
4. Write the tests
5. Make your changes and refactor

Step 2 is the one most often skipped: the place you need to *change* and the place you can *observe* the effect are frequently not the same, and finding the observation point is what determines how much dependency-breaking is actually required.

## Characterization Tests

The term is Feathers': **"a test that characterizes the actual behavior of a piece of code."** It documents what the code **currently does**, not what it should do. It is not a specification — it's a snapshot of present behavior, including behavior that is clearly wrong. Where a TDD or BDD test specifies intended behavior, a characterization test *reveals* existing behavior.

The procedure:

1. **Call the code with a realistic input** and assert something deliberately incorrect:
   ```python
   assert calculate_fee(order) == "PLACEHOLDER"
   ```
2. **Run it.** The failure message tells you the actual value.
3. **Paste the actual value in** as the expectation. The test now pins current behavior.
4. **Repeat** for each input class you care about, working outward: happy path, each branch you can reach, each boundary.
5. **Record oddities as tests, not fixes.** When the observed output is plainly a bug, still assert it — and name the test so the next reader knows:
   ```python
   def test_negative_quantity_produces_negative_fee_bug_1234():
       # Documents existing (incorrect) behavior. See issue #1234.
       assert calculate_fee(order_with_quantity(-3)) == Decimal("-15.00")
   ```
   Fixing the bug in the same step destroys the lock you're building and mixes two concerns in one diff. Lock first, fix in a separate commit that visibly flips this assertion.

**Coverage tooling makes this systematic.** Run coverage over the characterization suite; each uncovered branch is a behavior with no lock. Iterate until the paths your change will touch are covered — not the whole file.

**Approval testing** scales this up when output is large or complex (a report, a generated document, a whole response object): capture the current output to an approved file, and let the tool diff future runs against it. Two cautions — approve only output you have actually read, and keep approved files small enough to review in a diff, or the test degenerates into "something changed somewhere."

## Finding a Seam

Feathers' definition: a **seam** is **"a place where you can alter behavior in your program without editing in that place."** Every seam has an **enabling point** — the place where you choose which behavior applies (the parameter you pass, the subclass you instantiate, the build configuration you select). A candidate with no enabling point is not a seam.

Testing untestable code is the search for a seam. Feathers classifies them by *when* the substitution happens — **object seams** (at runtime, via polymorphism; the common case in OO languages), **link seams** (at link/build time, via which binary or module is bound), and **preprocessing seams** (before compilation, in languages with a preprocessor). The table below is ordered by how invasive the change is:

| Seam type | How | Use when |
|---|---|---|
| **Parameter** | Add the dependency as a parameter, defaulting to the current value | Almost always the best option |
| **Constructor** | Take the dependency in the constructor; keep the old constructor delegating with the real one | Class-level dependency used by several methods |
| **Extract + override** | Extract the awkward call into a `protected virtual` method; override it in a test subclass | Language supports it and other seams are too invasive |
| **Interface extraction** | Extract an interface from a concrete dependency; inject it | Dependency is a class you own with a wide surface |
| **Link/config** | Substitute at build/DI-config time | Static or third-party dependency you can't touch |

The **parameter seam with a default** is the workhorse — it is additive, so every existing caller keeps working:

```python
# Before: untestable, reads the clock and the network internally
def expire_sessions():
    now = datetime.now()
    sessions = SessionStore().load_all()
    ...

# After: same behavior for every existing caller, now testable
def expire_sessions(now=None, store=None):
    if now is None:
        now = datetime.now()
    if store is None:
        store = SessionStore()
    ...
```

That converts an untestable function into a testable one without changing behavior for any existing caller. In C#/Java the equivalent is an overload or an optional constructor parameter.

**Use `is None`, not `x = x or default`.** The `or` form is shorter and is what most examples show, but it substitutes the default for *any* falsy argument — `0`, `""`, `[]`, `False`, `Decimal("0")`, a midnight `time`. It happens to be safe for `datetime`/`date` objects, which are always truthy, and that is exactly what makes it a trap: it works everywhere you first try it and then silently discards a legitimate `0` the day someone parameterizes a number. In a procedure whose entire premise is preserving behavior, do not introduce a value-dependent behavior change to save a line.

## Common Blockers and Their Fix

| Blocker | Why it blocks | Minimal fix |
|---|---|---|
| `new` inside the method | Can't substitute the collaborator | Parameterize; or extract a `protected virtual` factory method |
| Static/global call (`Clock.Now`, `Config.Get`, `Logger`) | No substitution point | Parameter seam with default; or a settable static with test reset (temporary — migrate to injection) |
| Singleton | Shared state across tests | Add a reset for tests as a stopgap; inject the instance properly next |
| Work in the constructor (IO, DB, validation) | Can't even construct the object | Move the work into an explicit `Initialize`/factory method; keep the old constructor calling it |
| God class, 3000 lines | Nothing testable in isolation | Sprout: put the new logic in a *new, fully tested* class and call it from the old one |
| Hidden IO deep in the call stack | Tests hit the network/disk | Inject at the top and thread it down, or wrap the IO in a one-method port and fake that |
| Untestable UI/framework coupling | Framework runtime required | Extract the logic into a plain class with no framework types; test that |

## Sprout and Wrap

When the surrounding code resists testing hard enough that a seam would be a big change, don't fight it — add the new behavior somewhere testable. Feathers names four techniques; all four exist to let you write tested code today without first earning a test lock on the code around it:

**Sprout Method** — put the new logic in a new method, fully tested, and call it from one line in the legacy method.

**Sprout Class** — same move when the new logic doesn't belong on the existing class, or when the existing class can't be instantiated in a test at all. The new class is tested in isolation; the legacy code gains one line that constructs and calls it.

**Wrap Method** — when new behavior must run alongside old behavior: rename the original method, then create a new method with the original name that calls the renamed original *and* the new behavior. Every existing caller is untouched, and the new behavior is testable on its own.

**Wrap Class** — the same at class scale (a decorator over the original), when the new behavior should apply everywhere the original type is used.

All four accept that some of the old code remains untested. That is the correct trade: the alternative is either no test or a risky rewrite. Coverage grows along the paths you actually touch, which is where it has value.

## Sequencing a Risky Change

The full order of operations when changing untested code:

1. **Identify the blast radius** — which behaviors could this change affect? Only those need a lock.
2. **Get the code under test at the highest convenient level first.** A single end-to-end-ish test that exercises the whole path is a better first step than an elegant unit test, because it's achievable without touching the code. Narrow later.
3. **Write characterization tests** over the blast radius. Each is born red — the procedure above starts from a deliberately wrong assertion and reads the real value out of the failure — so you have already watched every one of them fail for the right reason, and no extra confirmation step is needed. Do not change production code to re-confirm it.
4. **Make the seams** you need, mechanically, tests green after each step.
5. **Refactor toward testability** if needed, still green (see the `refactoring` plugin's workflow for the discipline here).
6. **Now make the behavior change**, adding the test that specifies the new behavior first. Existing characterization tests that go red are the interesting output: each one is either an intended behavior change (update it, and say so in the commit) or an unintended regression (fix the code).
7. **Commit in that order**: `test:` for the characterization lock, `refactor:` for the seams, then `feat:`/`fix:` for the behavior change. The history then shows precisely what changed behavior and what didn't.

## What Not to Do

- **Don't rewrite instead of characterizing.** Without a behavior lock you have no way to know the rewrite is equivalent, and untested legacy code always contains behavior that someone depends on but nobody documented.
- **Don't chase whole-file coverage.** Cover the blast radius of your change. Trying to test a 3000-line class exhaustively before touching it means the change never ships.
- **Don't "fix" the odd behavior you find while characterizing.** Write it down, assert it, fix it in a separate commit — otherwise the diff conflates the lock with the change and you lose both signals.
- **Don't delete a failing legacy test you don't understand.** It's evidence. Quarantine it (skip with a linked issue) if it blocks you, but a test that fails on a codebase everyone believes works is telling you something about either the code or the assumption.
