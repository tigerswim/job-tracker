#!/usr/bin/env bash
set -euo pipefail
SRC="src/lib/google-sync"
VEN="supabase/functions/sync-google-interactions/_shared"
fail=0
for f in crypto identity matching gmail calendar followup-rules types; do
  # strip `.ts` from relative imports in the vendored copy, then diff
  if ! diff <(cat "$SRC/$f.ts") \
            <(sed -E "s/(from '\.\/[a-z-]+)\.ts'/\1'/g" "$VEN/$f.ts") \
            >/dev/null; then
    echo "DRIFT: $f.ts differs between src and _shared"
    fail=1
  fi
done
exit $fail
