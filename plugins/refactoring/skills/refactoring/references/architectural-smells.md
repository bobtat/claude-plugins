# Architectural Smells Catalog

Smells at the component/module/package level. They differ from code-level smells in two ways: they are invisible when reading a single file (detection requires dependency analysis or change history), and fixing them is a project, not an edit — plan incremental restructuring, don't attempt it inside an unrelated task.

Every entry follows the same template as the classic catalog: **Signs**, **Why it hurts**, **When it's fine** (legitimate structures that trip the same detectors), and **Fix**. Architectural detectors are statistical — fan-in counts and co-change clusters flag deliberate designs as readily as accidents — so the "When it's fine" check matters even more here than at code level.

## Detection Tools

Before diagnosing, gather evidence:

- **Dependency graph**: language tooling (`dotnet` — NDepend/`dotnet-depends`; JS/TS — `madge`, `dependency-cruiser`; Python — `pydeps`; Java — `jdeps`) or IDE dependency diagrams. Look for cycles, hubs, and edges pointing the wrong direction.
- **Change history**: `git log --format="" --name-only` piped through sorting/counting reveals hotspots (files changed most) and co-change clusters (files that always change together despite living in different components).
- **Fan-in/fan-out counts** per module: high fan-in = many dependents (must be stable); high fan-out = depends on many (fragile); high both = hub (dangerous).

---

## Cyclic Dependency

**Signs:** Module A depends on B, B depends (directly or transitively) on A. In compiled languages, often forced into a single assembly/package "because it wouldn't build otherwise." In dynamic languages, hidden as imports inside function bodies to dodge import-time cycles.

**Why it hurts:** The cycle is one de-facto module regardless of folder structure: nothing inside it can be understood, tested, versioned, or extracted independently. Cycles also grow — anything either side touches gets pulled in.

**When it's fine:** Mutual recursion between *classes inside one module* — AST node families, parent–child object models — is normal object design. The smell lives at module/package boundaries, where independent build, test, and versioning are the promise the cycle breaks.

**Fix (in order of preference):**
1. **Misplaced dependency** — one edge of the cycle usually represents code in the wrong place. **Move Function**/**Move Field** it to the module that uses it, and the cycle disappears.
2. **Dependency inversion** — if A legitimately needs to trigger behavior in B while B depends on A, define the interface in A (or a shared abstraction package), implement it in B, and inject. Callbacks and events are lighter forms of the same inversion.
3. **Extract shared kernel** — when both sides depend on a common core tangled between them, extract that core into a third module both depend on.

Break one edge at a time; verify with the dependency tool after each move.

## God Component

**Signs:** One module/package/service disproportionately larger than its siblings, appearing in nearly every change, imported by nearly everything. Common names: `core`, `common`, `shared`, `utils`. The class-level Large Class smell at architecture scale.

**Why it hurts:** It serializes team work (everyone edits it), accretes without limit (ambiguous things default into it), and its transitive dependency set is effectively the whole system.

**When it's fine:** High fan-in alone isn't the smell — a small, stable, deliberately curated shared library is healthy infrastructure. The diagnosis needs all three: size, unbounded growth, and presence in every change. In a small codebase, one central module may simply be the honest structure; premature decomposition adds ceremony without relieving any actual contention.

**Fix:** Do not "split the god component" as a project goal — split by *change reason*. Use co-change analysis to find clusters inside it that change together, name each cluster as a real concept, and extract them one at a time (**Extract Class** / move to new package, update imports, verify build+tests, commit). Shrink `utils`-style buckets by relocating each utility next to its dominant consumer; what remains with genuinely many consumers becomes a small, deliberately curated library.

## Unstable Dependency

**Signs:** A stable, high-fan-in module (domain model, core library) depends on a volatile, frequently-changing one (an experimental feature, a vendor SDK, UI code).

**Why it hurts:** Every change to the volatile module ripples into everything that trusted the stable one — the stable module's dependents inherit an instability they never signed up for.

**When it's fine:** Modules with no dependents — application entry points, composition roots, leaf features — can depend on volatile code freely; there is nothing above them for the instability to propagate into. The smell requires something *stable* on the depending end.

**Fix:** Depend in the direction of stability: abstractions and domain logic at the stable end; I/O, frameworks, and features at the volatile end, pointing inward. Invert the offending edge with an interface owned by the stable module (ports & adapters), or move the volatile part out of the dependency path entirely. Vendor SDKs get wrapped once at the boundary, not imported throughout.

## Hub-Like Dependency

**Signs:** A module with both high fan-in and high fan-out — many things depend on it and it depends on many things.

**Why it hurts:** It transmits change in both directions: its many dependencies destabilize it, and its many dependents amplify every wobble. It is simultaneously fragile and load-bearing.

**When it's fine:** A thin, stable facade over a subsystem is a deliberate hub — high fan-in from clients, high fan-out into the internals — but it transmits little because its surface is contracts that rarely change. The smell is a hub full of churning *implementation*, not a quiet pass-through boundary.

**Fix:** Split the hub's two roles. Usually a hub is an interface bundle plus an implementation grab-bag: extract the interfaces/contracts (keeping the high fan-in, now on a stable, nearly dependency-free module) and let the implementations (high fan-out) hide behind them.

## Layering Violation

**Signs:** Dependencies that skip or reverse the declared layers: UI importing the database module directly; domain entities importing web-framework types; a "repository" returning ORM-tracked entities to controllers; SQL strings in view code. Detection: define the intended layer order, then grep imports for edges that defy it (dependency-cruiser and ArchUnit-style tests can enforce this in CI).

**Why it hurts:** The architecture exists only in documentation; layers can't be tested or replaced independently, and every framework upgrade touches business logic.

**When it's fine:** When the declared architecture is obsolete and the "violations" are the new intended structure — fix the declaration, not the code. Cross-cutting infrastructure (logging, metrics, config) is conventionally reachable from any layer by explicit rule. And a small CRUD app may not warrant layers at all; enforcing a boundary that protects nothing is ceremony.

**Fix:** For each violating edge: either the code is in the wrong layer (**Move Function** to where it belongs) or the lower layer lacks the API the caller needed (add the missing operation, then route through it). Add an architecture-conformance test so the fixed edge stays fixed.

## Scattered Functionality

**Signs:** One domain concern implemented in fragments across multiple components — "discount logic" living partly in the cart service, partly in checkout, partly in a shared helper. The architectural form of Shotgun Surgery; co-change analysis finds it.

**Why it hurts:** The concern can't be found, changed, or tested in one place; edits reach some fragments and miss others, and the fragments drift into contradiction.

**When it's fine:** Two concerns that share a name aren't one scattered concern — the cart's display *estimate* and checkout's authoritative *calculation* may be legitimately separate rules. Likewise, bounded contexts each owning their own version of a similar policy is deliberate decoupling in distributed designs, accepted precisely to avoid cross-service coupling. Scatter means one rule fragmented; verify it is actually one rule before gathering it.

**Fix:** Choose (or create) the concept's single home; move fragments there one at a time, leaving delegating calls behind if consumers can't migrate immediately; retire the delegations last.

## Ambiguous Interface / Leaky Contract

**Signs:** A module boundary that offers a single `execute(params: dict)`-style entry point, or exposes its internal types (ORM entities, wire formats, framework request objects) in its public signatures.

**Why it hurts:** Callers couple to internals through the leak; the "boundary" constrains nothing, so the modules are effectively merged.

**When it's fine:** Genuinely generic infrastructure — message buses, middleware pipelines, plugin loaders — is *supposed* to offer one generic entry point; the genericity is the contract, not an evasion of one. And boundary DTOs belong at the seams that matter (module/service boundaries), not between every pair of classes — internal collaborators sharing types is normal.

**Fix:** Narrow and name the operations (**Change Function Declaration**); introduce boundary DTOs/value types so internal representations can change freely.

## Package by Layer (when it fights the domain)

**Signs:** Top-level structure is `controllers/`, `services/`, `repositories/`, `models/`, and every feature change touches one file in each folder.

**Why it hurts:** The structure taxes every change: each feature is smeared across the tree, related code is never adjacent, and folder boundaries protect nothing anyone was going to violate.

**When it's fine:** When co-change analysis shows changes actually clustering *within* layers — a team that regularly swaps persistence or presentation technology is being served by the layer folders. The smell requires evidence that features always cut across; without that evidence, either structure works and restructuring is churn.

**Fix:** Restructure toward package-by-feature (vertical slices): each feature folder owns its handler, logic, and data access, with shared kernel extracted only where genuinely shared. Migrate one feature at a time; don't big-bang.

---

## Prioritizing Architectural Work

Architectural smells always outnumber the capacity to fix them. Rank by: (1) change pressure — hotspot analysis first; a cycle in a frozen subsystem costs nothing; (2) blast radius — smells on stable, high fan-in modules multiply across all dependents; (3) trajectory — is the smell growing? A god component gaining edges monthly deserves action before a static one. Present findings with this ranking, an incremental (per-edge, per-fragment) fix plan, and the enforcement test that prevents regression.
