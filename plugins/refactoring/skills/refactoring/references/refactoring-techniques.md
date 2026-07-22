# Refactoring Techniques: Mechanics Catalog

Step-by-step mechanics for the refactorings named in the smell catalogs. The steps look pedantically small — that is the point: each step compiles and passes tests, so a mistake surfaces immediately and reverting costs seconds. With experience, batch steps mentally but fall back to the full sequence the moment something breaks.

**Universal preconditions:** tests green before starting; IDE/language-server rename-and-extract used where available (they are behavior-preserving by construction); run tests after every numbered step; commit when the refactoring completes.

---

## Composing Functions

### Extract Function

*Turn a code fragment into a function named for its intent.*

1. Create a new function named for **what** the fragment does, not how (`calculateOutstanding`, not `sumLoopOverInvoices`). If a good name won't come, don't extract.
2. Copy the fragment into it.
3. Pass locals the fragment reads as parameters; return the value(s) it writes. A fragment writing many locals resists extraction — apply Split Variable or Replace Temp with Query first, or extract a smaller piece.
4. Replace the original fragment with a call. Test.

### Inline Function

*Replace calls to a trivial function with its body.* Use when the body is as clear as the name, or to gather badly-factored pieces before re-extracting along better lines.

1. Verify the function isn't polymorphic (overridden anywhere).
2. Replace each call with the body, one call site at a time. Test after each.
3. Delete the function.

### Extract Variable

*Name a subexpression.* `if (order.quantity * order.itemPrice > 1000)` → `const basePrice = order.quantity * order.itemPrice; if (basePrice > 1000)`. If the name would be useful beyond this function, extract a function instead.

### Replace Temp with Query

*Replace a computed local with a function computing it.* Unlocks Extract Function by removing the shared local.

1. Ensure the variable is computed once and not reassigned (Split Variable first if it is).
2. Extract its computation into a function (must be side-effect-free).
3. Replace reads of the temp with calls; delete the temp. Test.

### Split Variable

*Give each responsibility of a reused variable its own variable.* Any variable assigned more than once (except loop counters/accumulators) is doing two jobs. Declare a new appropriately-named variable at the second assignment; update reads that follow; make both `const`/`final` where possible.

### Slide Statements

*Move related statements next to each other* (declaration next to first use; the lines that will be extracted together into one block). Legal when neither the sliding code nor the code slid over writes state the other reads. Precursor to Extract Function.

### Split Loop

*One loop doing two jobs becomes two loops.* Duplicate the loop, delete different halves of each body. Enables independent extraction of each. Resist premature performance objections — measure after; two passes over a list are almost never the bottleneck.

### Split Phase

*Code doing two sequential kinds of work becomes two phases communicating through an explicit intermediate data structure.* Cure for Divergent Change when the change-reasons are stages (parse-then-compute, compute-then-format).

1. Extract the second phase's code into its own function. Test.
2. Introduce an intermediate data structure and pass it to that function.
3. Move each value the second phase uses into the intermediate structure, one at a time, removing it from the function's other parameters. Test each.
4. Extract the first phase into a function returning the intermediate structure. Test.

Each phase can now change (or be tested) without knowledge of the other; the structure documents the interface between them.

---

## Moving Features

### Move Function

*Move a function to the class/module whose data it uses most.*

1. Check what the function references in its current home; decide whether those pieces should move with it, first, or stay.
2. Copy the function to the target; adapt references (pass the old home's needed data as parameters, or reference the target's own fields directly).
3. Turn the original into a delegating call to the new location. Test.
4. Migrate callers to call the target directly; remove the delegation (or keep it if the old location is a legitimate convenience API).

### Move Field

1. Encapsulate the field (all access through getter/setter). Test.
2. Create the field in the target; update accessors to read/write the target's copy (the source holds a reference to the target).
3. Remove the source field. Test.

### Extract Class

*Split a class doing two jobs.*

1. Decide the split: list fields and methods; cluster by which fields each method touches; name the new concept.
2. Create the new class; link from the old (old holds an instance).
3. Move Field each field of the cluster, one at a time, testing after each.
4. Move Function each method, lowest-dependency first. Test each.
5. Review interfaces: expose the new object, or keep it fully hidden behind the old one — decide deliberately.

### Inline Class

Reverse of Extract Class — fold a no-longer-pulling-its-weight class into its main consumer. Move members one at a time; delete the husk.

### Hide Delegate

*Replace `client → a.getB().doThing()` with `a.doThing()` delegating internally.* Create the delegating method on `a`; migrate clients; restrict access to `b` if nothing else needs it. Apply per-link where structure churns; over-application creates Middle Man.

### Remove Middle Man

Reverse of Hide Delegate: add an accessor for the delegate, change clients to call through it directly, delete forwarding methods one at a time.

---

## Organizing Data

### Replace Primitive with Object

*Give a domain value its own type.* See `../examples/primitive-obsession-value-object.md` for a full walkthrough.

1. Create a value class wrapping the primitive: constructor validates; equality by value; immutable.
2. At one field/parameter at a time: change the type, fix compile errors mechanically (wrap at write sites, unwrap at read sites). Test.
3. Migrate behavior: find logic operating on the raw value at call sites (formatting, comparison, arithmetic) and move it onto the type, removing unwrap calls as it moves.

### Encapsulate Variable / Encapsulate Collection

Route all access through functions before changing anything about widely-used data. For collections: getter returns a copy or read-only view; add explicit `add`/`remove` methods; hunt down callers mutating the raw collection.

### Replace Magic Literal

Introduce a named constant for a literal with meaning (`9.80665` → `STANDARD_GRAVITY`). Don't over-apply to structurally obvious values (`0`, `1`, `""` in idiomatic positions).

### Change Bidirectional Association to Unidirectional

*Remove the half of a two-way link that doesn't earn its keep.* Cure for Inappropriate Intimacy.

1. Decide which direction is essential (usually the one matching the dominant traversal; the other side can look its partner up).
2. For each use of the doomed back-reference, find another route: pass the object as a parameter, or query a lookup/repository. Migrate one use at a time. Test each.
3. Delete the back-reference and all code that maintained it (the error-prone both-sides bookkeeping disappears with it). Test.

---

## Simplifying Conditional Logic

### Decompose Conditional

Extract the condition into a predicate function named for *what it checks* (`isSummer(date)`), and each branch into a function named for *what it does*. The `if` becomes one readable line.

### Consolidate Conditional Expression

Several checks with the same result → one predicate combining them (`isNotEligibleForDisability()`), extracted as a function. Only when they are genuinely one check — don't merge independent rules.

### Replace Nested Conditional with Guard Clauses

For unusual/error cases: check and return early, un-nesting the main path.

1. Take the outermost condition; convert to a guard (`if (isDead) return deadAmount();`). Test.
2. Repeat inward. Invert conditions as needed to make each guard an early exit.
3. The remaining unindented tail is the dominant path, now readable top-to-bottom.

Use when paths are asymmetric (one normal, others exceptional). If both branches are equally "normal," a symmetric `if/else` communicates better than a fake guard.

### Replace Conditional with Polymorphism

For switches on type repeated across functions. See `../examples/switch-to-polymorphism.md` for a full walkthrough.

1. Create the class hierarchy (or strategy interface + implementations) for the type code, with a factory function mapping code → instance.
2. Take one switching function: declare it on the superclass with the switch intact; override in one subclass with that branch's logic; delete the branch from the switch. Test. Repeat per subclass.
3. Make the superclass method abstract (or leave default behavior there) when all branches have moved.
4. Repeat step 2–3 for each other function switching on the same code.

### Introduce Special Case (Null Object)

When many callers check the same special value (`if (customer == null)`, `if (customer === UNKNOWN)`): create a special-case class (`UnknownCustomer`) supplying the default answers those callers computed; return it from the source instead of null; delete the caller checks one at a time.

### Introduce Assertion

Make a stated-in-comments precondition executable: `assert(discountRate >= 0)`. Documents assumptions and converts silent corruption into loud failure. Not a substitute for input validation at trust boundaries.

---

## Refactoring APIs

### Change Function Declaration (Rename / Add / Remove Parameter)

For anything beyond an IDE-assisted rename, use the migration method:

1. Create the new function (new name/signature) with the old one delegating to it — or the new one delegating to old while bodies migrate.
2. Migrate callers one at a time, testing after each.
3. Delete the old declaration. When external callers exist, deprecate instead and delete later.

### Introduce Parameter Object

1. Create the value type for the clump (immutable).
2. Change Function Declaration: add the new parameter; populate it at call sites while old parameters still flow. Test.
3. Switch the body to read from the object, one clump-member at a time; drop each old parameter as it goes unused. Test each.
4. Watch the new type attract behavior — validation and derived values that were duplicated at call sites now have a home.

### Preserve Whole Object

Caller unpacks an object to pass parts → pass the object. Create the new signature alongside, migrate, remove old. Exception: keep primitives when the function must not depend on the source type (dependency direction matters more than parameter count).

### Replace Parameter with Query

*Remove a parameter the function can derive itself* — from its other parameters or its own object's state.

1. If callers compute the value, extract that computation into a query the function can call (must be side-effect-free).
2. In the body, replace reads of the parameter with the query. Test.
3. Remove the parameter (Change Function Declaration); simplify each caller. Test.

Skip when the derivation would add a dependency the function shouldn't have — sometimes the parameter *is* the decoupling.

### Remove Flag Argument

A boolean/enum parameter selecting behavior → one explicitly-named function per behavior (`setRushDelivery()` / `setRegularDelivery()`), implemented as thin wrappers first, then push the split inward if the internal branches are large.

### Separate Query from Modifier

A function that returns a value *and* has side effects → split into a query (no effects) and a modifier (no return). Copy the function, strip effects from one and the return from the other, migrate callers to call the pair, remove duplication between them.

### Parameterize Function

Several functions differing only in a constant → one function taking the value as a parameter. Pick one, add the parameter, generalize its body, migrate the others' callers, delete them.

---

## Dealing with Inheritance

### Pull Up Method / Field

Identical members in siblings → move to superclass. For near-identical methods, first make them textually identical (Parameterize Function, Extract the varying part) then pull up. If the varying part stays abstract in the parent and concrete in children, that is **Form Template Method**.

### Push Down Method / Field

Superclass member relevant to only some subclasses → move into those subclasses. Cure for Refused Bequest.

### Extract Superclass / Extract Interface

Two classes sharing duplicated behavior → create their common parent and pull shared members up. Prefer Extract Interface when only the contract, not implementation, is shared.

### Replace Type Code with Subclasses

*A field holding a type code (enum/string) whose value drives behavior becomes a subclass per value.* Precursor to Replace Conditional with Polymorphism when the type is fixed at creation.

1. Encapsulate the type code (all reads through a getter). Test.
2. Create one subclass per code value, overriding the getter to return its constant; add a factory function mapping code → subclass. Test.
3. Route construction through the factory. Test.
4. Push type-specific behavior down into the subclasses (Push Down Method, Replace Conditional with Polymorphism); remove the type-code field when nothing reads it. Test.

If the code can change during the object's lifetime, subclassing won't work — use Replace Type Code with State/Strategy (same shape, but the "subclass" is a swappable delegate).

### Collapse Hierarchy

Parent and child no longer different enough to matter → merge them (either direction). Cure for Speculative Generality.

### Replace Subclass with Delegate

Subclassing that fights the hierarchy (Refused Bequest, subclass varying on an axis that should be composable, need to change "type" at runtime) → replace with a delegate object: create the delegate class, move overridden behavior into it, have the former parent forward to an (optional/strategy) delegate, delete the subclass. Composition leaves the door open; inheritance spends the single-inheritance slot.

---

## Working Without a Safety Net (Legacy Code)

When code has no tests and must be refactored to *become* testable, standard order:

1. **Identify the seam** — where a dependency could be swapped without editing the code that uses it.
2. Apply only the minimal, lowest-risk, ideally tool-automated moves to create the seam: **Extract Function** around the untestable dependency, **Parameterize Constructor/Function** to inject it, **Extract Interface** on the dependency.
3. Write characterization tests through the seam: assert what the code *does* (run it, capture actual output, assert that), not what docs claim. Include the weird cases — current behavior is the spec until a human decides otherwise.
4. Refactor normally under the new tests.

Keep the pre-test moves embarrassingly conservative — they are performed without a net.

### Parameterize Constructor (seam-making)

*A constructor that news up a dependency internally → accept it as a parameter, without disturbing existing callers.*

1. Add a constructor parameter for the internally-created dependency; assign it to the field instead of the `new`.
2. Keep the old signature as an overload delegating to the new one, passing the previous `new` expression as the argument. Existing callers compile unchanged.
3. Tests construct through the new signature, injecting a fake/fixed dependency.
