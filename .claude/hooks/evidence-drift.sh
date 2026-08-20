#!/usr/bin/env bash
# evidence-drift - CLAUDE.md requires fixtures/evidence.ts to be scaffolded
# VERBATIM from .claude/templates/evidence.ts. This makes "verbatim" checkable.
#
# Exit 0 = clean / out of scope. Exit 2 = blocking, stderr goes back to the agent.
set -uo pipefail

payload="$(cat)"
file="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
[ -z "$file" ] && exit 0

case "$file" in
  */fixtures/evidence.ts) ;;
  *) exit 0 ;;
esac

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
template="$root/.claude/templates/evidence.ts"

[ -f "$template" ] || exit 0   # no template to compare against
[ -f "$file" ]     || exit 0   # file gone

if ! diff -q "$template" "$file" >/dev/null 2>&1; then
  {
    echo "BLOCKED by evidence-drift [evidence/verbatim-template]"
    echo
    echo "  fixtures/evidence.ts must match .claude/templates/evidence.ts EXACTLY."
    echo "  CLAUDE.md: \"scaffolded verbatim from .claude/templates/evidence.ts\"."
    echo
    echo "  Diff (template → written file):"
    diff -u "$template" "$file" 2>&1 | head -40 | sed 's/^/    /'
    echo
    echo "  → Copy the template unchanged:"
    echo "      cp .claude/templates/evidence.ts fixtures/evidence.ts"
    echo "  → If the TEMPLATE itself needs to change, edit the template and say so;"
    echo "    that is a deliberate change to the standard, not a per-project tweak."
  } >&2
  exit 2
fi

exit 0
