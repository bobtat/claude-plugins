# claude-plugins

A Claude Code plugin marketplace. See `README.md` for the repository layout.

## Nothing to build, nothing to run

Markdown and JSON only — no package manager, no test runner, no lint step, no CI. Validation is reading the files and checking the manifests parse. Don't go looking for a build command.

## Editing a plugin

```
plugins/<name>/
  .claude-plugin/plugin.json    # name, version, description, keywords
  README.md                     # the plugin's own docs
  skills/<skill>/SKILL.md       # + optional references/, examples/
  commands/*.md                 # frontmatter: description, argument-hint, allowed-tools
  agents/*.md                   # frontmatter: name, description, tools, model
  hooks/hooks.json              # + hooks/scripts/*.sh, invoked via ${CLAUDE_PLUGIN_ROOT}
```

**`version` and `description` are duplicated** in `.claude-plugin/marketplace.json` and `plugins/<name>/.claude-plugin/plugin.json`. Nothing enforces the match — bump both in the same commit. Adding a new plugin also means a row in the root `README.md` table.

**Skills and commands are namespaced with no bare-name fallback.** A skill is addressable only as `plugin:skill` — `testing:testing`, never bare `testing`. Cross-references inside SKILL.md and agent files must use the namespaced form; a bare name silently resolves to nothing, or appears to work only because a stray copy in `~/.claude/skills/` caught it. Two commits on main (`a8b9eba`, `1fe21cc`) exist solely to fix this.

**A `!` context block in a command must contain no shell expansion.** No `${VAR}`, no `$(cmd)`, no `$HOME`, no `~/`. A block containing expansion cannot be matched against the permission rules, so it is **refused outright rather than prompted for**, and the command fails at invocation with `Shell command permission check failed … Contains expansion`. The blocks in `git-workflow` look like counter-examples — `pr.md` uses `$(git merge-base …)` — but they survive only because they all begin with `git` and this machine has `Bash(git *)` allowlisted; they would fail for anyone without that rule. A plugin published for other people cannot depend on an installer's allowlist, so treat the rule as absolute. Anything needing a path goes in the command body, run through the Bash tool, which expands and prompts normally. Commit `57c4b07` fixes four commands that shipped this way.

A feature and the README update documenting it land as **separate commits** (`feat(testing): …` then `docs(testing): …`), consistent with the atomicity rule below.

## Commit conventions

**Commit messages carry no AI-attribution trailer.** No `Co-Authored-By: Claude`, no generated-with footer, no equivalent. This overrides Claude Code's default behavior.

Attribution goes on **pull request descriptions** instead, which keep:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

The reasoning for the split: a PR is communication, where provenance is useful context for whoever reviews it. The commit log is a permanent technical record, where the same trailer is noise on every line of `git log` forever.

This is the convention the `git-workflow` plugin in this repo prescribes, applied to the repo itself. Commits before `8a5c101` (2026-08-10) predate the change and do carry the trailer — the history is mixed at that point by design, not by accident.

Atomic commits and Conventional Commits style apply as usual; `plugins/git-workflow/skills/git-workflow/` is the reference for both.
