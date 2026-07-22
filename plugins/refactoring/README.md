# refactoring

A Claude Code plugin that teaches Claude to spot code smells and apply disciplined, behavior-preserving refactoring.

## What It Does

Adds one auto-triggering skill that activates whenever Claude is refactoring, reviewing code quality, or asked whether code is well designed. It provides:

- **Smell detection heuristics** — what to scan for and in what order (size/shape, duplication, dishonest names, change friction, envious code, test pain)
- **Three smell catalogs** — classic (Fowler) smells, architectural smells, and test smells, each mapped to the refactorings that fix it
- **A refactoring-mechanics catalog** — step-by-step procedures for ~35 named techniques
- **A safe refactoring workflow** — behavior locks via characterization tests, small reversible steps, tests after every step, atomic `refactor:` commits, and never mixing behavior change with structural change
- **Worked examples** — four before/after walkthroughs (long method, primitive obsession, switch-to-polymorphism, feature envy) in TypeScript, C#, and Python

The guidance is language-agnostic; examples span multiple languages deliberately.

## Installation

Test locally:

```bash
claude --plugin-dir C:\Users\Robert\.claude\plugins\refactoring
```

Or add to a marketplace and install via `/plugin`.

## Usage

No commands to run — the skill triggers automatically on requests like:

- "Refactor this class"
- "Find code smells in src/services"
- "Is this code well designed?"
- "Clean up this method"
- "Why is this module so hard to change?"

Claude loads the lean core skill on trigger and pulls in the detailed catalogs (`references/`) and worked examples (`examples/`) only when the task needs them.

## Structure

```
refactoring/
├── .claude-plugin/plugin.json
└── skills/refactoring/
    ├── SKILL.md                      # Detection heuristics, smell index, safe workflow
    ├── references/
    │   ├── classic-smells.md         # Bloaters, OO abusers, change preventers, dispensables, couplers
    │   ├── architectural-smells.md   # Cycles, god components, layering violations...
    │   ├── test-smells.md            # Test smells and the production problems they signal
    │   └── refactoring-techniques.md # Mechanics for each named refactoring
    └── examples/
        ├── long-method-extract-function.md
        ├── primitive-obsession-value-object.md
        ├── switch-to-polymorphism.md
        └── feature-envy-move-method.md
```

## License

MIT
