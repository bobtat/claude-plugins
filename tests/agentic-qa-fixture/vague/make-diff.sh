#!/bin/sh
# Builds the fixture's repository in a directory: the tree as it was before the pull request, then the
# tree as merged, as two commits with fixed dates so the merge commit's hash is the same every time.
# With a second argument, also writes the pull request's diff there. `pr-21.diff` in this folder is
# that file, kept so the stand-in gh has it: run `make-diff.sh /tmp/x pr-21.diff` after changing the app.
# usage: make-diff.sh <directory to build the repository in> [file to write the diff to]
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="$1"; DIFF="$2"
[ -n "$DIR" ] || { echo "usage: make-diff.sh <directory> [diff file]" >&2; exit 2; }
[ -n "$DIFF" ] && DIFF="$(cd "$(dirname "$DIFF")" && pwd)/$(basename "$DIFF")"
mkdir -p "$DIR"; cd "$DIR"
G="git -c user.name=dev-two -c user.email=dev-two@example.com -c commit.gpgsign=false"
git init -q -b main .
cp -r "$HERE/repo/." .; cp -r "$HERE/before/." .
git add -A
GIT_AUTHOR_DATE="2026-11-18T10:00:00Z" GIT_COMMITTER_DATE="2026-11-18T10:00:00Z" $G commit -q -m "Search the task list (#19)"
cp -r "$HERE/repo/." .
git add -A
GIT_AUTHOR_DATE="2026-11-20T11:30:00Z" GIT_COMMITTER_DATE="2026-11-20T11:30:00Z" $G commit -q -m "Archive tasks (#88)"
[ -n "$DIFF" ] && git diff HEAD~1 HEAD > "$DIFF"
git rev-parse HEAD
