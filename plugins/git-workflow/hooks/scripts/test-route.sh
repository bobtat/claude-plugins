#!/usr/bin/env bash
# Test harness for route-git-prompt.sh — run:  bash hooks/scripts/test-route.sh
# Exits non-zero if any prompt routes differently than the hook promises.
# Resolves next to this script, so it works from any checkout.
ROUTE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/route-git-prompt.sh"
pass=0; fail=0

# The payload carries a cwd containing "GitHub" on purpose: the hook must
# extract .prompt rather than matching the raw JSON, or every prompt fires.
CWD='C:\\\\Users\\\\Robert\\\\Documents\\\\GitHub\\\\claude-plugins'

run() { # run <expected fire|quiet> <prompt>
  local expect="$1" prompt="$2" out got
  out=$(printf '{"hook_event_name":"UserPromptSubmit","cwd":"%s","prompt":"%s"}' \
        "$CWD" "$prompt" | bash "$ROUTE" 2>/dev/null)
  if printf '%s' "$out" | grep -q 'additionalContext'; then got=fire; else got=quiet; fi
  if [ "$got" = "$expect" ]; then
    pass=$((pass+1)); printf '  ok   [%-5s] %s\n' "$got" "$prompt"
  else
    fail=$((fail+1)); printf '  FAIL exp=%s got=%s  %s\n' "$expect" "$got" "$prompt"
  fi
}

echo "== should FIRE =="
# The case this hook exists for.
run fire "yes commit and open a PR"
run fire "yes, commit this and open a PR"
run fire "commit this"
run fire "can you commit that for me"
run fire "write a commit message"
run fire "split these changes into commits"
run fire "squash my commits"
run fire "clean up the history on this branch"
run fire "tidy the history before review"
run fire "rebase onto main"
run fire "amend the last one"
run fire "undo that commit"
run fire "open a PR"
run fire "open a pull request against main"
run fire "push this branch"
run fire "push it"
run fire "fix the merge conflict"
run fire "I committed a secret"
run fire "I lost my work"
run fire "check the reflog"
run fire "cherry-pick that onto the release branch"
run fire "run git status"
run fire "what does git log show"
run fire "add a fixup commit"
run fire "PR is ready"
run fire "the PRs are stacked"
run fire "gh pr create"

echo
echo "== should stay QUIET =="
run quiet "explain this function"
run quiet "add a test for the parser"
run quiet "why is this failing"
run quiet "refactor the OrderService class"
run quiet "what does this regex do"
run quiet "run the tests"
run quiet "deploy to staging"
run quiet "which branch of the conditional runs first"
run quiet "merge these two dictionaries"
run quiet "the history panel shows the wrong dates"
run quiet "stage the modal before the animation"
run quiet "tag the release notes section"
run quiet "check out the new API docs"
run quiet "read plugins/git-workflow/README.md"
run quiet "/git-workflow:commit"
run quiet "/commit"
run quiet "does the preprocessor handle this"
run quiet "print the results"

echo
printf 'pass=%s fail=%s\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
