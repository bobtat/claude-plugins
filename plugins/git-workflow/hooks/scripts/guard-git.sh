#!/usr/bin/env bash
# PreToolUse(Bash) guard for the git-workflow plugin.
#
# Blocks git commands that destroy unrecoverable work, publish over someone
# else's, or hang this environment waiting on an editor that will never open.
#
# Design notes:
#   - Fails OPEN. Any parsing or environment problem exits 0 and allows the
#     command. A guard that blocks everything when it cannot parse its input
#     would break the session; this is a seatbelt, not a sandbox.
#   - Matches command TEXT. A destructive command assembled from variables, a
#     here-doc, or a shell alias will pass. Treat accordingly.
#   - Denies via BOTH the JSON permissionDecision and exit 2, so the block
#     holds whichever mechanism the host honors.

set -uo pipefail

input=$(cat 2>/dev/null) || exit 0
[ -n "$input" ] || exit 0

# --- Extract .tool_input.command and .cwd -----------------------------------
# jq if present, then python, then a crude but adequate bash fallback.
extract() {
  local field="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$input" | jq -r "$field // empty" 2>/dev/null && return 0
  fi
  local py
  py=$(command -v python3 || command -v python) || py=""
  if [ -n "$py" ]; then
    printf '%s' "$input" | "$py" -c '
import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
path = sys.argv[1].lstrip(".").split(".")
for key in path:
    if not isinstance(d, dict):
        sys.exit(0)
    d = d.get(key)
    if d is None:
        sys.exit(0)
sys.stdout.write(d if isinstance(d, str) else "")
' "$field" 2>/dev/null && return 0
  fi
  # Fallback: pull the raw JSON string value. Escapes are left in place, which
  # is fine for pattern matching.
  local key="${field##*.}"
  printf '%s' "$input" \
    | tr -d '\n' \
    | sed -n "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"\\(\\([^\"\\\\]\\|\\\\.\\)*\\)\".*/\\1/p"
}

cmd=$(extract '.tool_input.command')
[ -n "$cmd" ] || exit 0

# Fast path: the overwhelming majority of Bash calls are not git.
case "$cmd" in
  *git*) ;;
  *) exit 0 ;;
esac

cwd=$(extract '.cwd')
[ -n "$cwd" ] && [ -d "$cwd" ] || cwd="."

# --- Helpers ----------------------------------------------------------------
# -e so patterns beginning with a dash are treated as patterns, not options.
has() { printf '%s' "$cmd" | grep -Eq -e "$1"; }

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

deny() {
  local reason="$1" escaped
  escaped=$(json_escape "$reason")
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"},"systemMessage":"%s"}\n' \
    "$escaped" "$escaped"
  printf 'git-workflow guard: %s\n' "$reason" >&2
  exit 2
}

tree_is_dirty() {
  local out
  out=$(git -C "$cwd" status --porcelain 2>/dev/null) || return 1
  [ -n "$out" ]
}

current_branch() { git -C "$cwd" branch --show-current 2>/dev/null; }

PROTECTED='^(main|master|develop|development|trunk|prod|production|release([/-].*)?)$'

on_protected_branch() {
  local b
  b=$(current_branch) || return 1
  [ -n "$b" ] || return 1
  printf '%s' "$b" | grep -Eq "$PROTECTED"
}

# ---------------------------------------------------------------------------
# 1. Interactive git — guaranteed to hang; there is a non-interactive form.
# ---------------------------------------------------------------------------
if has 'git[[:space:]]+add([[:space:]]+-[A-Za-z]*[ip]|[[:space:]]+--(interactive|patch))'; then
  deny 'git add -p/-i cannot run here (no interactive terminal) and will hang. Stage a subset with a patch file instead: git diff -U5 -- <path> > patch, delete the unwanted @@ hunks, then git apply --cached --recount patch. See the git-workflow skill, references/atomic-commits.md.'
fi

if has 'git[[:space:]]+rebase' \
   && has '(^|[[:space:]])(-i|--interactive)([[:space:]]|$)' \
   && ! has 'GIT_SEQUENCE_EDITOR'; then
  deny 'git rebase -i opens an editor and will hang here. Prefix it with a sequence editor instead: GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash <base> accepts the generated todo unchanged. For drop/reorder/edit, see the git-workflow skill, references/history-rewriting.md.'
fi

if has 'git[[:space:]]+commit[^|;&]*--fixup=(amend|reword):' && ! has 'GIT_EDITOR'; then
  deny 'git commit --fixup=amend: / --fixup=reword: opens an editor and will hang here. Build the marker commit directly instead: ORIG=$(git log -1 --format=%s <sha>); git commit --allow-empty --only -m "amend! $ORIG" -m "<new subject>". The amend! line must match the target subject exactly or autosquash silently skips it. See references/history-rewriting.md.'
fi

if has 'git[[:space:]]+mergetool'; then
  deny 'git mergetool launches an interactive tool and will hang here. Read the conflicted file, resolve it with Edit, then git add it. See references/branching-and-conflicts.md.'
fi

# ---------------------------------------------------------------------------
# 2. Force-push — the one operation that destroys other people's work.
# ---------------------------------------------------------------------------
if has 'git[[:space:]]+push'; then
  # A bare -f may appear inside a flag cluster (-uf), so match f anywhere in it.
  lease=0; bare=0
  has '--force-with-lease' && lease=1
  has '(^|[[:space:]])--force([[:space:]]|$)' && bare=1
  has '(^|[[:space:]])-[A-Za-z]*f[A-Za-z]*([[:space:]]|$)' && bare=1
  forced=0
  { [ "$lease" -eq 1 ] || [ "$bare" -eq 1 ]; } && forced=1

  if [ "$bare" -eq 1 ] && [ "$lease" -eq 0 ]; then
    deny 'Bare git push --force overwrites the remote unconditionally, including commits pushed by someone else that you have never seen, with no warning and no local record of what was destroyed. Use git push --force-with-lease --force-if-includes, which fails instead of destroying.'
  fi

  if [ "$forced" -eq 1 ] && has '(^|[[:space:]:/])(main|master|develop|trunk|prod|production)([[:space:]]|$)'; then
    deny 'Refusing to force-push a protected branch. Correct forward with git revert instead. If this branch genuinely is not protected, run the push yourself.'
  fi

  if has '--mirror'; then
    deny 'git push --mirror overwrites every ref on the remote, including branches and tags you do not have. Push the specific branch instead.'
  fi

  if has 'git[[:space:]]+push[^|;&]*--delete[^|;&]*(main|master|develop|trunk|prod|production)([[:space:]]|$)' \
     || has 'git[[:space:]]+push[^|;&]*[[:space:]]:(refs/heads/)?(main|master|develop|trunk)([[:space:]]|$)'; then
    deny 'Refusing to delete a protected branch on the remote.'
  fi
fi

# ---------------------------------------------------------------------------
# 3. Hook bypass.
# ---------------------------------------------------------------------------
if has 'git[[:space:]]+(commit|push|merge|rebase)' && has '(^|[[:space:]])--no-verify([[:space:]]|$)'; then
  deny '--no-verify bypasses a check the repository deliberately installed, moving the failure to CI or to main where it costs more. Fix what the hook caught; if the hook itself is broken, fix the hook.'
fi

# ---------------------------------------------------------------------------
# 4. Unrecoverable destruction of uncommitted work.
# ---------------------------------------------------------------------------
if has 'git[[:space:]]+reset[^|;&]*--hard' && tree_is_dirty; then
  deny 'git reset --hard discards uncommitted changes permanently — the reflog cannot recover work that was never committed, and the working tree here is dirty. Commit or git stash first, then reset.'
fi

if has 'git[[:space:]]+(checkout|restore)([[:space:]]+-[A-Za-z-]+)*[[:space:]]+(--[[:space:]]+)?\.([[:space:]]|$)' \
   && tree_is_dirty; then
  deny 'git checkout . / git restore . overwrites every uncommitted change in the working tree, permanently. Commit or git stash first, or name the specific paths to revert.'
fi

if has 'git[[:space:]]+clean' \
   && has '(^|[[:space:]])(-[A-Za-z]*f[A-Za-z]*|--force)([[:space:]]|$)' \
   && ! has '(^|[[:space:]])(-[A-Za-z]*n[A-Za-z]*|--dry-run)([[:space:]]|$)'; then
  deny 'git clean -f deletes untracked files at the filesystem level — Git never saw them, so nothing recovers them. Run it with -n first and confirm the list with the user.'
fi

# ---------------------------------------------------------------------------
# 5. Destroying the recovery path itself.
# ---------------------------------------------------------------------------
if has 'git[[:space:]]+reflog[[:space:]]+(expire|delete)' && has '(--expire=(now|all)|--all)'; then
  deny 'Expiring the reflog destroys the only local record of abandoned commits — the mechanism every recovery in this plugin depends on. Do not run this to clean up.'
fi

if has 'git[[:space:]]+gc[^|;&]*--prune=(now|all)'; then
  deny 'git gc --prune=now deletes unreachable objects immediately, which is exactly what recovery of a bad reset, rebase, or dropped stash relies on. Let gc expire them on its normal schedule.'
fi

if has 'git[[:space:]]+filter-branch'; then
  deny 'git filter-branch is deprecated by the Git project, slow, and full of correctness traps. Use git filter-repo instead — and if this is about a leaked credential, rotate it first: rewriting history does not un-leak anything.'
fi

# ---------------------------------------------------------------------------
# 6. Rewriting a protected branch.
# ---------------------------------------------------------------------------
if ! has 'git[[:space:]]+(switch|checkout)' && on_protected_branch; then
  if has 'git[[:space:]]+rebase' && ! has 'git[[:space:]]+rebase[[:space:]]+--(abort|continue|skip)'; then
    deny "Refusing to rebase $(current_branch), a protected branch. Rewriting it forces every collaborator into recovery. Correct forward with git revert, or do the work on a topic branch."
  fi
  if has 'git[[:space:]]+commit[^|;&]*--amend'; then
    deny "Refusing to amend a commit on $(current_branch), a protected branch. If the commit is already pushed, amending it rewrites published history; add a new commit instead."
  fi
fi

exit 0
