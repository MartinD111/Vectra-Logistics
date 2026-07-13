#!/usr/bin/env bash
# List migration files added since a previous release's git tag.
#
# Usage: scripts/list-release-migrations.sh <previous-release-git-tag>
#
# Wraps `git diff <prev-tag>..HEAD --name-only -- database/migrations/`,
# filtered to the NNN_description.sql convention (the same filename regex
# apps/api/src/scripts/migrate.ts's discovery logic encodes: ^\d+_[\w-]+\.sql$).
# Read-only — takes no untrusted input, writes nothing, operator-invoked only.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: scripts/list-release-migrations.sh <previous-release-git-tag>" >&2
  exit 1
fi

PREV_TAG="$1"

git diff "$PREV_TAG"..HEAD --name-only -- database/migrations/ \
  | grep -E '^database/migrations/[0-9]+_[A-Za-z0-9_-]+\.sql$' || true
