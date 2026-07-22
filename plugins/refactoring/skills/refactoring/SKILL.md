---
name: refactoring
description: This skill should be used when the user asks to "refactor" code, "clean up" code, "find code smells", "improve code quality", "simplify this method/class/module", "restructure" existing code, mentions "technical debt", says a function or class is "too long" or "too complicated", asks "is this code well designed?" or "does this need refactoring?", or when modifying existing code whose structure resists the change being made. Provides smell detection heuristics, a smell-to-refactoring index, and a safe behavior-preserving refactoring workflow.
---

# Code Smells & Disciplined Refactoring

## Overview

Refactoring is restructuring existing code **without changing its observable behavior**. It is not rewriting, not bug fixing, and not feature work. Code smells are surface symptoms that suggest — but do not prove — a deeper design problem worth fixing. This skill covers both halves of the discipline: recognizing smells accurately, and removing them safely.

Two rules govern everything below:

1. **Wear one hat at a time.** Either change behavior (add feature, fix bug) or change structure (refactor) — never both in the same step or the same commit. When a refactoring reveals a bug, note it, finish the refactoring, then fix the bug separately.
2. **Stay green.** Refactor only under passing tests, in steps small enough that the code compiles and tests pass between each step. If tests stay red for more than a few minutes, revert and take smaller steps.

## Spotting Smells

Smells are found by scanning, not by exhaustive audit. When reading code (during review, before modifying, or on request), check these signals in rough order of yield:

- **Size and shape**: functions over ~20-30 lines, classes over ~200-300 lines, parameter lists over 3, nesting over 2-3 levels deep. Thresholds are heuristics, not rules — a flat 40-line function reading like a checklist may be fine; a dense 15-line one may not.
- **Duplication**: the same logic, structure, or magic literal appearing in more than one place. Includes near-duplication where two blocks differ only in a value or a type check.
- **Names that lie or hedge**: `Manager`, `Util`, `Helper`, `Processor`, `data`, `temp`, `handleStuff`, functions whose names say less than their bodies do, or names requiring "and" to describe honestly.
- **Comments explaining *what***: a comment paraphrasing the next block of code usually marks an Extract Function opportunity — the comment wants to be a function name.
- **Change friction**: from version-control history or the current task — one conceptual change touching many files (Shotgun Surgery), or one file changed for many unrelated reasons (Divergent Change).
- **Envious code**: a method referencing another object's data more than its own (Feature Envy); chains like `a.getB().getC().getD()` (Message Chains).
- **Type-based branching**: the same `switch`/`if-else` chain over a type code or enum repeated in multiple places.
- **Test pain**: tests requiring heavy mock setups, breaking on refactors, or being impossible to write — test smells are design smells about the production code. See `references/test-smells.md`.

When reporting a smell, name it precisely, cite the evidence (file, lines, the specific signal), state the refactoring that fixes it, and estimate effort. Distinguish "this hurts now" from "this will hurt when X changes." Do not report smells speculatively where no change pressure exists — a smell in stable, working code that nobody touches is low priority by definition.

## Smell → Refactoring Index

| Smell | Category | Primary refactoring(s) | Detail |
|---|---|---|---|
| Long Method | Bloater | Extract Function, Replace Temp with Query, Decompose Conditional | `references/classic-smells.md` |
| Large Class | Bloater | Extract Class, Extract Superclass | `references/classic-smells.md` |
| Primitive Obsession | Bloater | Replace Primitive with Object, Introduce Parameter Object | `references/classic-smells.md` |
| Long Parameter List | Bloater | Introduce Parameter Object, Preserve Whole Object | `references/classic-smells.md` |
| Data Clumps | Bloater | Extract Class, Introduce Parameter Object | `references/classic-smells.md` |
| Repeated Switch on Type | OO Abuser | Replace Conditional with Polymorphism | `references/classic-smells.md` |
| Temporary Field | OO Abuser | Extract Class, Introduce Special Case | `references/classic-smells.md` |
| Refused Bequest | OO Abuser | Push Down Method, Replace Subclass with Delegate | `references/classic-smells.md` |
| Alternative Classes w/ Different Interfaces | OO Abuser | Rename, Extract Superclass/Interface | `references/classic-smells.md` |
| Divergent Change | Change Preventer | Split Phase, Extract Class | `references/classic-smells.md` |
| Shotgun Surgery | Change Preventer | Move Function/Field, Inline Class | `references/classic-smells.md` |
| Parallel Inheritance Hierarchies | Change Preventer | Move Function/Field to collapse the shadow hierarchy | `references/classic-smells.md` |
| Duplicate Code | Dispensable | Extract Function, Pull Up Method, Slide Statements | `references/classic-smells.md` |
| Dead Code / Speculative Generality | Dispensable | Delete; Collapse Hierarchy, Inline Class | `references/classic-smells.md` |
| Data Class | Dispensable | Move Function (behavior toward data), Encapsulate | `references/classic-smells.md` |
| Lazy Class | Dispensable | Inline Class, Collapse Hierarchy | `references/classic-smells.md` |
| Comments (as deodorant) | Dispensable | Extract Function, Rename | `references/classic-smells.md` |
| Feature Envy | Coupler | Move Function, Extract + Move | `references/classic-smells.md` |
| Message Chains | Coupler | Hide Delegate, Extract + Move Function | `references/classic-smells.md` |
| Inappropriate Intimacy | Coupler | Move Function/Field, Change Bidirectional to Unidirectional | `references/classic-smells.md` |
| Middle Man | Coupler | Remove Middle Man, Inline Function | `references/classic-smells.md` |
| Cyclic Dependency | Architectural | Dependency inversion, Extract shared kernel | `references/architectural-smells.md` |
| God Component | Architectural | Split by responsibility/change-reason | `references/architectural-smells.md` |
| Layering Violation | Architectural | Introduce interface at boundary, Move Function | `references/architectural-smells.md` |
| Fragile / Over-mocked Tests | Test | Test behavior not implementation; fix production coupling | `references/test-smells.md` |

Mechanics for every code-level technique named above are in `references/refactoring-techniques.md`; the architectural strategies are detailed in `references/architectural-smells.md`.

## Safe Refactoring Workflow

Follow this sequence whenever performing a refactoring beyond a trivial rename:

1. **Establish a behavior lock.** Confirm tests cover the code being changed and that they pass. If coverage is missing, write **characterization tests** first: tests that pin down what the code *currently does* (including odd behavior), not what it should do. If the code is untestable as-is, apply only the minimal, mechanical, tool-assisted refactorings needed to get a test seam (e.g., Extract Function, Parameterize Constructor) before anything else — full procedure in "Working Without a Safety Net" at the end of `references/refactoring-techniques.md`.
2. **Name the smell and the target.** State which smell is being removed and which refactoring removes it. If the smell can't be named, the "refactoring" may be aimless churn — stop and reconsider.
3. **Work in small, reversible steps.** Each step compiles and passes tests. Prefer the mechanical step lists in `references/refactoring-techniques.md`. Use IDE/language-server refactorings (rename, extract, move) over hand-editing when available — they preserve behavior by construction.
4. **Run the tests after every step.** Not at the end — after every step. A failure then points at one small change.
5. **Commit each completed refactoring atomically** with a `refactor:` conventional-commit message naming the technique and target (e.g., `refactor: extract price calculation from Order.process`). Never bundle refactoring commits with behavior changes.
6. **Stop at the goal.** Remove the smell that motivated the work; resist cascading into neighboring cleanups. Note further opportunities instead of chasing them ("boy scout rule" applies to the code being touched, not the whole module).

For step-by-step worked demonstrations of this workflow, see the `examples/` directory.

## When NOT to Refactor

Decline or defer refactoring when:

- **The code is about to be deleted or replaced.** Confirm before polishing anything scheduled for removal.
- **A rewrite is genuinely cheaper.** Small, isolated, well-understood code with a clear spec can sometimes be rewritten under test faster than incrementally reshaped. This is rare for large or poorly understood code — incremental refactoring wins there because it never breaks the system.
- **Mid-feature with uncommitted behavior changes.** Finish and commit the behavior change first, or stash it and refactor first ("make the change easy, then make the easy change") — never interleave.
- **No behavior lock is achievable in the time available.** Refactoring untested code without characterization tests is editing blind; the risk usually exceeds the payoff.
- **The smell has no change pressure.** Stable code nobody modifies earns cleanup last, regardless of how it looks.

## Additional Resources

### Reference Files

- **`references/classic-smells.md`** — Full catalog of the classic (Fowler) code smells in five categories: Bloaters, OO Abusers, Change Preventers, Dispensables, Couplers. For each: signs, why it hurts, when it's fine (legitimate uses that look like the smell), and which refactorings fix it.
- **`references/architectural-smells.md`** — Component-level smells: cyclic dependencies, god components, unstable dependencies, layering violations, scattered functionality. Detection tooling, plus signs / why it hurts / when it's fine / fix for each smell.
- **`references/test-smells.md`** — Test smells (fragile tests, assertion roulette, excessive mocking, mystery guests, flaky tests) and the production design problem each one signals.
- **`references/refactoring-techniques.md`** — Mechanics catalog: the step-by-step procedure for each named refactoring, grouped by purpose (composing functions, moving features, organizing data, simplifying conditionals, refactoring APIs, dealing with inheritance).

### Worked Examples

Step-by-step before/after refactorings demonstrating the workflow:

- **`examples/long-method-extract-function.md`** — Decomposing a long method with Extract Function and Replace Temp with Query (TypeScript).
- **`examples/primitive-obsession-value-object.md`** — Replacing primitive money values with a value object (C#).
- **`examples/switch-to-polymorphism.md`** — Replacing a repeated type-switch with polymorphism (C#).
- **`examples/feature-envy-move-method.md`** — Moving an envious method to the data it uses (Python).
