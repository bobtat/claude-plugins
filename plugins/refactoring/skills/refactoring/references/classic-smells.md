# Classic Code Smells Catalog

The classic smells, organized in five categories by the kind of damage they do. Every entry follows the same template: **Signs** (how to recognize it), **Why it hurts**, **When it's fine** (the legitimate uses that look like the smell), and **Fix** (the refactorings that remove it). Technique mechanics are in `refactoring-techniques.md`.

A smell is a symptom, not a verdict. Always weigh it against change pressure: a smell in code that changes weekly is urgent; the same smell in code untouched for years is not. Check the "When it's fine" entry before reporting — a pattern chosen deliberately for one of those reasons is a design decision, not a defect.

---

## Bloaters

Code that has grown too large to understand as a unit. Bloaters accumulate gradually — no single commit creates them — so they are invisible to authors and obvious to newcomers.

### Long Method

**Signs:** A function that doesn't fit on one screen; sections separated by blank lines or `// step 2: ...` comments; local variables reused for different purposes; multiple levels of abstraction mixed (business rules next to string formatting).

**Why it hurts:** The function must be read in full to be changed safely. Sections can't be reused or tested independently. Naming is dishonest — the name covers only part of what it does.

**When it's fine:** A flat function reading top-to-bottom as a checklist at a single level of abstraction can carry 40 lines comfortably — length alone isn't the trigger; mixed abstraction levels and tangled locals are. A measured hot path where extraction defeats inlining is a rare exception that must be proven with a profiler, not assumed.

**Fix:** **Extract Function** for each coherent section (the comment above a block is usually the new function's name). If locals tangle the extraction, first apply **Replace Temp with Query**, **Split Variable**, or **Slide Statements** to untangle them. For long conditionals, **Decompose Conditional**. For loops doing two jobs, **Split Loop** first, then extract each.

### Large Class

**Signs:** Many fields, many methods, low cohesion — subsets of methods using disjoint subsets of fields. Name is a giveaway: `OrderManager`, `SiteHelper`, anything that needs "and" to describe.

**Why it hurts:** Attracts more code (everything vaguely related lands there), becomes a merge-conflict hotspot, and couples unrelated features through shared state.

**When it's fine:** Size without low cohesion is just a big concept — if most methods touch most fields, splitting manufactures coupling instead of removing it. Generated code is exempt: fix the generator or leave it alone.

**Fix:** Group fields and the methods that use them; **Extract Class** for each group. If groups form a general/special relationship, **Extract Superclass** or **Replace Type Code with Subclasses**. Cohesion analysis: for each pair of methods, do they touch common fields? Clusters in that graph are the hidden classes.

### Primitive Obsession

**Signs:** Domain concepts represented as bare primitives: money as `decimal`, phone numbers and emails as `string`, ranges as two separate values, IDs of different entities all as interchangeable `int`/`Guid`. Validation and formatting logic for these values duplicated at every use site.

**Why it hurts:** The type system can't catch unit mismatches (`customerId` passed where `orderId` expected), invariants are enforced nowhere or everywhere, and behavior that belongs to the concept smears across the codebase.

**When it's fine:** At serialization and I/O boundaries the primitive *is* the format — convert to domain types once at the edge rather than pushing value objects into adapter code. A value with no invariants, arithmetic, or formatting to own (a truly opaque token passed through unexamined) gains nothing from wrapping.

**Fix:** **Replace Primitive with Object** — introduce a value object owning validation, formatting, and arithmetic. Related primitives traveling together are Data Clumps; see below. See `../examples/primitive-obsession-value-object.md` for a worked example.

### Long Parameter List

**Signs:** More than 3-4 parameters; boolean flags that change what the function does; callers that pass the same group of arguments to several functions.

**Why it hurts:** Call sites are unreadable and error-prone (adjacent same-typed parameters transpose silently); every new requirement adds another parameter.

**When it's fine:** When passing parts keeps the function independent of the source object's type — dependency direction matters more than parameter count (the same exception noted under Preserve Whole Object). Pure functions over genuinely independent values (math, geometry) wear more parameters honestly than orchestration code does.

**Fix:** **Introduce Parameter Object** for values that travel together; **Preserve Whole Object** when the caller decomposes an object just to pass its parts; **Remove Flag Argument** by splitting into two functions; **Replace Parameter with Query** when the function could derive the value itself.

### Data Clumps

**Signs:** The same group of fields or parameters appearing together in multiple places — `street, city, postalCode` on three classes; `startDate, endDate` in a dozen signatures. The test: delete one value of the clump mentally — do the others still mean anything alone? If not, it's a clump.

**Why it hurts:** The group is an undiscovered concept. Its invariants (start ≤ end) can't live anywhere, and adding a member to the clump means touching every occurrence.

**When it's fine:** Values that merely co-occur in a few signatures but carry independent meaning and change for different reasons (the deletion test passes) — grouping those manufactures a concept that doesn't exist.

**Fix:** **Extract Class** to give the concept a home (`Address`, `DateRange`), then **Introduce Parameter Object** at each signature. The new class then attracts its behavior (overlap checks, formatting) via **Move Function**.

---

## OO Abusers

Code that uses object-oriented constructs incorrectly or incompletely.

### Repeated Switch on Type

**Signs:** The same `switch`/`if-else if` chain over a type code, enum, or `typeof`/`is` check appearing in more than one function.

**Why it hurts:** Adding a new variant means finding and updating every switch — a Shotgun Surgery generator. The compiler won't always find every occurrence.

**When it's fine:** A single occurrence — one switch is simpler than a hierarchy; repetition is the smell. Also when new *operations* are added more often than new *types*: the switch layout serves that change axis better (the expression problem cuts both ways).

**Fix:** **Replace Conditional with Polymorphism** — move each branch into a subclass or strategy implementation; the dispatch happens once, at object creation. For data-driven cases, a lookup table/map keyed by the type code can be lighter than a class hierarchy. See `../examples/switch-to-polymorphism.md`.

### Temporary Field

**Signs:** A field that only holds a meaningful value during certain operations, and is null/default otherwise. Often set up by one method solely to be read by a helper method.

**Why it hurts:** Readers must learn the field's lifecycle to know when it is valid; objects have invisible modes.

**When it's fine:** Lazy-initialization and memoization caches — there the lifecycle is an implementation detail hidden behind an accessor, not a mode callers must track. Likewise fields populated by a documented framework lifecycle contract.

**Fix:** **Extract Class** — the field plus the methods that use it form a coherent short-lived object (often a method object). If the field encodes "not applicable," **Introduce Special Case**.

### Refused Bequest

**Signs:** A subclass inheriting methods or data it doesn't want — overriding them to throw, stubbing them empty, or ignoring them. Signature of a hierarchy built for code reuse rather than substitutability (a Liskov violation in the making).

**Why it hurts:** Callers holding the superclass type get surprises; the hierarchy misleads about what is substitutable.

**When it's fine:** Mild refusal that confuses no caller is often not worth the rework — Fowler's own advice. A subclass declining optional hooks while still honoring the substitution contract is normal framework use, not a broken hierarchy.

**Fix:** **Push Down Method/Field** so the superclass holds only what all subclasses honor. If the subclass really isn't a subtype, **Replace Subclass with Delegate** — compose instead of inherit.

### Alternative Classes with Different Interfaces

**Signs:** Two classes doing the same job with different method names/shapes, so callers can't swap one for the other.

**Why it hurts:** Because neither can substitute for the other, each accumulates its own surrounding duplication, and consolidating later costs a rewrite at every call site instead of a rename today.

**When it's fine:** Classes you don't own — a third-party API can't be renamed; write an Adapter to your own interface instead. And superficial resemblance between jobs that will diverge is not "the same job" — unifying those creates a Change Preventer.

**Fix:** **Rename** methods to match, **Parameterize** where they differ trivially, then **Extract Superclass** or a shared interface and migrate callers to it.

---

## Change Preventers

Structures that make change expensive. These are the highest-priority smells because they tax every future modification. Version-control history detects them better than reading code does.

### Divergent Change

**Signs:** One class/module modified for many unrelated reasons — the same file appears in commits about pricing, about email formatting, and about database schema. "If we get a new payment type we edit these three methods; if the tax rules change we edit those four."

**Why it hurts:** Every kind of change forces understanding of the whole class; unrelated changes conflict with each other.

**When it's fine:** Only when the divergent reasons actually occur. Splitting along change axes that are hypothetical is Speculative Generality arriving through the back door — wait until history shows the second real reason before restructuring for it.

**Fix:** Identify the separate change-reasons and give each its own module: **Split Phase** when the reasons are sequential stages, **Extract Class** / **Move Function** when they are independent concerns. This is the Single Responsibility Principle stated as a symptom.

### Shotgun Surgery

**Signs:** The inverse of Divergent Change — one conceptual change requires small edits in many files. Detected from history: commits that repeatedly touch the same scattered set of files together.

**Why it hurts:** Edits get missed (the change is made in four of five places); the concept exists everywhere and lives nowhere.

**When it's fine:** Some changes are inherently cross-cutting — a new locale string, a schema field flowing through DTO, mapper, and migration — and when codegen or tooling fans the edit out mechanically, the scatter costs little. The smell is scattered *hand-maintained business logic*, not tool-managed plumbing.

**Fix:** **Move Function** and **Move Field** to gather the scattered logic into one module; **Inline Class** or **Inline Function** first if fragments are too small to move — combining them and re-extracting along better lines is often easier than moving shards.

### Parallel Inheritance Hierarchies

**Signs:** Creating a subclass in one hierarchy forces creating a matching subclass in another (`Shape`/`ShapeRenderer`, `Order`/`OrderValidator` pairs that always grow together).

**Why it hurts:** Every new variant costs a class in each hierarchy plus the wiring between them, and the twins drift — one side gets updated while its shadow doesn't.

**When it's fine:** Two or three pairs may be duplication too small to be worth collapsing — act when the hierarchies grow. Deliberate parallelism across a boundary that must stay separate (domain types and their UI renderers in different layers) is layering doing its job, not a smell.

**Fix:** Collapse the duplication by making one hierarchy reference the other: **Move Function**/**Move Field** from the shadow hierarchy into the primary one until the shadow disappears or becomes a single class.

---

## Dispensables

Things whose absence would make the code cleaner.

### Duplicate Code

**Signs:** Identical or near-identical blocks in multiple places. Near-duplication — same structure, different values or types — matters more than textual sameness. Watch especially for duplicated *decisions* (the same business rule re-derived in two services).

**Why it hurts:** Fixes and rule changes must be replicated; they won't be, and the copies drift.

**When it's fine:** Duplication of *incidental* similarity should stay duplicated. Two rules that look alike today but change for different reasons (e.g., two tax jurisdictions) will diverge; unifying them creates a Change Preventer. Apply the rule of three: extract on the third occurrence if the copies have changed in lockstep so far.

**Fix:** Same class: **Extract Function**. Sibling classes: **Extract Function** then **Pull Up Method**. Similar but not identical: extract the common skeleton and **Parameterize Function**, or use **Form Template Method** (pull the shared outline up, keep varying steps abstract). Unrelated classes: extract into a shared function or class both can use. When blocks are almost adjacent, **Slide Statements** first to bring duplication together.

### Dead Code

**Signs:** Unreachable branches, unused parameters/fields/classes, commented-out blocks, feature flags fully rolled out.

**Why it hurts:** Readers spend real effort understanding code that never runs; it turns up in searches, inflates every audit and refactor, and silently rots until someone resurrects it in its broken state.

**When it's fine:** Code inside an active rollback window or behind a flag with a documented expiry is dead by coverage but alive by contract. Public library surface may have external callers you can't see — deprecate, don't delete.

**Fix:** Delete it. Version control remembers. Verify unreachability first (compiler/IDE unused warnings, coverage over a representative run, grep for reflective/dynamic access before deleting anything looked up by name).

### Speculative Generality

**Signs:** Abstract classes with one implementation, hooks and parameters "for future flexibility" that only tests exercise, generic type parameters instantiated one way, layers of indirection with a single caller. The tell: "we might need it someday."

**Why it hurts:** Every reader pays the indirection cost forever; the actual future need, when it arrives, rarely matches the speculation.

**When it's fine:** A published extension point with real external consumers is a contract, not speculation. Generality for a *scheduled* requirement — next sprint, not "someday" — can be cheaper to build now; the tell that separates it from the smell is a date, not a hunch.

**Fix:** **Collapse Hierarchy**, **Inline Class**, **Inline Function**, **Remove Dead Code**, remove unused parameters (**Change Function Declaration**).

### Data Class

**Signs:** A class that is only getters/setters/public fields, with all logic operating on it living elsewhere.

**Why it hurts:** The behavior that belongs with the data smears across callers, usually creating Feature Envy and Duplicate Code around it.

**When it's fine:** DTOs at serialization boundaries and record types used as plain values are data-by-design. The smell is a behavior-less class at the *core* of the domain — where logic operating on it clearly exists but lives elsewhere.

**Fix:** Find the envious callers and **Move Function** their logic into the class; **Encapsulate Collection** and remove setters for fields that shouldn't change.

### Lazy Class

**Signs:** A class that no longer earns its keep — a once-useful abstraction now nearly empty after other refactorings, or a middle layer that only forwards.

**Why it hurts:** Every class is a name readers must learn and a hop navigation must take; one that carries no weight dilutes the design's vocabulary for nothing.

**When it's fine:** Small isn't lazy. A value object earning its keep through one invariant or one honest name stays; so does a deliberate growth point for work that is actually scheduled.

**Fix:** **Inline Class** or **Collapse Hierarchy**.

### Comments as Deodorant

**Signs:** Comments explaining *what* the next block does, or apologizing for confusing code ("careful, this also updates the cache").

**Why it hurts:** The comment substitutes for the structural fix and then drifts — code gets edited, comments don't — leaving a narrator that can't be trusted next to code that still can't be read.

**When it's fine:** Comments stating *why* — constraints, non-obvious tradeoffs, links to specs — are exactly what comments are for and are not this smell. The smell is only the *what*-paraphrase and the apology.

**Fix:** **Extract Function** named for what the comment said; **Rename Variable/Function** until the code says it; **Introduce Assertion** when the comment states a precondition. Then delete the comment.

---

## Couplers

Excessive coupling between classes, or the delegation meant to fix coupling taken too far.

### Feature Envy

**Signs:** A method that references another object's data more than its own — clusters of `other.getX()` calls feeding a computation. Count the accesses: more foreign than domestic is envy.

**Why it hurts:** The logic changes when the *other* class changes, so it lives in the wrong place; it usually duplicates similar envious logic elsewhere.

**When it's fine:** When data and behavior are deliberately separated (strategy objects, visitors, serializers, mappers), envy is the chosen tradeoff of the pattern — choose it, don't drift into it.

**Fix:** **Move Function** to the class it envies. If only part of the method envies, **Extract Function** on that part first, then move the extract. See `../examples/feature-envy-move-method.md`.

### Inappropriate Intimacy

**Signs:** Two classes reaching into each other's internals — accessing private-ish state, bidirectional references, subclasses exploiting superclass internals.

**Why it hurts:** The pair can only be understood, tested, or changed together — encapsulation exists in name only, and an edit to either ripples into the other's private assumptions.

**When it's fine:** Designed pairs inside one module (a collection and its iterator, an aggregate root and its child entities) where intimacy *is* the contract — draw the privacy boundary around the pair's module instead of between the two classes.

**Fix:** **Move Function**/**Move Field** to put the intimate parts in one place; **Change Bidirectional Association to Unidirectional**; **Extract Class** for shared intimate state; **Replace Subclass with Delegate** for intimate inheritance.

### Message Chains

**Signs:** `order.getCustomer().getAddress().getCountry().getTaxRate()` — the caller navigates the object graph.

**Why it hurts:** The client encodes the whole path's structure, coupling itself to every link; any structural change along the chain breaks every client that walked it.

**When it's fine:** Fluent builders and stream/LINQ pipelines look like chains but return transformed values or the same object by design — no graph structure is exposed. Short chains over stable, immutable structures rarely churn. Hide only the links that actually change — hiding every link reflexively creates Middle Men.

**Fix:** **Hide Delegate** on the link clients shouldn't know about (`order.getTaxRate()`), or better, **Extract Function** for the computation at the chain's end and **Move Function** it down the chain to the data.

### Middle Man

**Signs:** A class where most methods just delegate to another object. The over-correction of Message Chains.

**Why it hurts:** Every operation pays an extra hop and an extra edit site; readers open the middle man only to discover nothing happens there.

**When it's fine:** Facades, anti-corruption layers, and API-stability wrappers are middle men *on purpose* — delegation by design with a named job (simplifying, translating, insulating). The smell is delegation by accretion, not by intent.

**Fix:** **Remove Middle Man** — let clients call the delegate directly; or if the middle man has a few real responsibilities, **Inline Function** the pure delegations and keep the rest.
