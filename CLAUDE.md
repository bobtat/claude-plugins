# claude-plugins

A Claude Code plugin marketplace. See `README.md` for the repository layout.

## Commit conventions

**Commit messages carry no AI-attribution trailer.** No `Co-Authored-By: Claude`, no generated-with footer, no equivalent. This overrides Claude Code's default behavior.

Attribution goes on **pull request descriptions** instead, which keep:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

The reasoning for the split: a PR is communication, where provenance is useful context for whoever reviews it. The commit log is a permanent technical record, where the same trailer is noise on every line of `git log` forever.

This is the convention the `git-workflow` plugin in this repo prescribes, applied to the repo itself. Commits before `1ed4afa` (2026-08-10) predate the change and do carry the trailer — the history is mixed at that point by design, not by accident.

Atomic commits and Conventional Commits style apply as usual; `plugins/git-workflow/skills/git-workflow/` is the reference for both.
