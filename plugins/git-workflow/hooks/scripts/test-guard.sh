#!/usr/bin/env bash
# Test harness for guard-git.sh — run:  bash hooks/scripts/test-guard.sh
# Exits non-zero if any case behaves differently than the guard promises.
# Resolves next to this script, so it works from any checkout.
GUARD="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/guard-git.sh"
pass=0; fail=0

run() { # run <expected 0|2> <cwd> <command>
  local expect="$1" cwd="$2" command="$3" out rc
  out=$(printf '{"hook_event_name":"PreToolUse","tool_name":"Bash","cwd":"%s","tool_input":{"command":"%s"}}' \
        "$cwd" "$command" | bash "$GUARD" 2>/dev/null)
  rc=$?
  if [ "$rc" -eq "$expect" ]; then
    pass=$((pass+1)); printf '  ok   [%s] %s\n' "$rc" "$command"
  else
    fail=$((fail+1)); printf '  FAIL exp=%s got=%s  %s\n     out: %s\n' "$expect" "$rc" "$command" "$out"
  fi
}

# --- Scratch repos ---------------------------------------------------------
CLEAN=$(mktemp -d); DIRTY=$(mktemp -d); PROT=$(mktemp -d)
for d in "$CLEAN" "$DIRTY" "$PROT"; do
  git -C "$d" init -q -b feat/thing 2>/dev/null
  git -C "$d" config user.email t@t.co; git -C "$d" config user.name t
  echo one > "$d/a.txt"; git -C "$d" add a.txt; git -C "$d" commit -qm "init"
done
echo changed > "$DIRTY/a.txt"          # dirty tree
git -C "$PROT" branch -m main          # protected branch, clean tree

echo "== should ALLOW =="
run 0 "$CLEAN" "ls -la"
run 0 "$CLEAN" "npm test"
run 0 "$CLEAN" "git status --porcelain"
run 0 "$CLEAN" "git add src/foo.ts"
run 0 "$CLEAN" "git add -A"
run 0 "$CLEAN" "git commit -m 'feat: add thing'"
run 0 "$CLEAN" "git diff HEAD"
run 0 "$CLEAN" "git push origin feat/thing"
run 0 "$CLEAN" "git push --force-with-lease --force-if-includes"
run 0 "$CLEAN" "GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash origin/main"
run 0 "$CLEAN" "GIT_SEQUENCE_EDITOR=true git rebase --exec 'npm test' origin/main"
run 0 "$CLEAN" "git rebase origin/main"
run 0 "$CLEAN" "git clean -n"
run 0 "$CLEAN" "git clean -nd"
run 0 "$CLEAN" "git reset --hard HEAD"
run 0 "$CLEAN" "git checkout ."
run 0 "$CLEAN" "curl -s https://github.com/foo/bar"
run 0 "$CLEAN" "git commit --amend -m 'feat: reword'"
run 0 "$CLEAN" "git log --oneline -10"
run 0 "$CLEAN" "git stash push --keep-index"
run 0 "$CLEAN" "gh pr create --fill"
run 0 "$CLEAN" "git push -n origin feat/thing"
run 0 "$PROT"  "git switch -c feat/new && git rebase origin/main"
run 0 "$DIRTY" "git reset --soft HEAD~1"
run 0 "$DIRTY" "git checkout -- src/specific-file.ts"
run 0 "$DIRTY" "git rebase --continue"

echo "== should DENY =="
run 2 "$CLEAN" "git add -p"
run 2 "$CLEAN" "git add -i"
run 2 "$CLEAN" "git add --patch src/foo.ts"
run 2 "$CLEAN" "git rebase -i origin/main"
run 2 "$CLEAN" "git rebase --interactive HEAD~3"
run 2 "$CLEAN" "git mergetool"
run 2 "$CLEAN" "git commit --allow-empty --fixup=reword:abc1234"
run 2 "$CLEAN" "git commit --fixup=amend:abc1234"
run 0 "$CLEAN" "git commit --allow-empty --fixup abc1234"
run 0 "$CLEAN" "git commit --allow-empty --only -m 'amend! old subject' -m 'new subject'"
run 2 "$CLEAN" "git push --force origin feat/thing"
run 2 "$CLEAN" "git push -f"
run 2 "$CLEAN" "git push --force-with-lease origin main"
run 2 "$CLEAN" "git push --mirror origin"
run 2 "$CLEAN" "git push origin --delete main"
run 2 "$CLEAN" "git commit --no-verify -m 'skip'"
run 2 "$CLEAN" "git push --no-verify"
run 2 "$CLEAN" "git clean -fd"
run 2 "$CLEAN" "git clean -f"
run 2 "$CLEAN" "git clean --force -dx"
run 2 "$CLEAN" "git filter-branch --tree-filter 'rm -f secret' HEAD"
run 2 "$CLEAN" "git gc --prune=now"
run 2 "$CLEAN" "git reflog expire --expire=now --all"
run 2 "$DIRTY" "git reset --hard HEAD~1"
run 2 "$DIRTY" "git checkout ."
run 2 "$DIRTY" "git checkout -- ."
run 2 "$DIRTY" "git restore ."
run 2 "$PROT"  "git rebase origin/main"
run 2 "$PROT"  "git commit --amend --no-edit"

rm -rf "$CLEAN" "$DIRTY" "$PROT"
echo
echo "pass=$pass fail=$fail"
[ "$fail" -eq 0 ]
