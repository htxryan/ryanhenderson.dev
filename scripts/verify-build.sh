#!/usr/bin/env bash
# E1-T8 integration probes — exercise the failure modes specified by E-2 and U-3.
#
# Probes (each must fail astro build with a clear, file-located error):
#   1. Unknown frontmatter key (.strict() rejection)
#   2. Missing required field (zod required-field rejection)
#   3. Malformed required field (e.g. status not in enum)
#
# Each probe is run in isolation: a temp MDX is staged, build is run, exit
# code is asserted, then the temp MDX is removed. The script exits 0 only if
# every probe behaves as specified.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

run_probe() {
  local name="$1"
  local file="$2"
  local content="$3"

  echo
  echo "── Probe: $name ──"
  printf '%s' "$content" > "$file"

  local out
  out=$(pnpm exec astro build 2>&1)
  local rc=$?

  rm -f "$file"

  if [ $rc -ne 0 ]; then
    echo "  ✓ build failed as expected (rc=$rc)"
    echo "  ── stderr excerpt ──"
    echo "$out" | tail -8 | sed 's/^/    /'
    PASS=$((PASS + 1))
  else
    echo "  ✗ build SUCCEEDED but should have failed"
    echo "$out" | tail -10 | sed 's/^/    /'
    FAIL=$((FAIL + 1))
  fi
}

# Probe 1: unknown frontmatter key
run_probe "unknown frontmatter key" "src/content/blog/__probe-unknown-key.mdx" '---
title: "Probe"
pubDate: 2026-04-30
summary: "x"
rogueKey: true
---
body
'

# Probe 2: missing required field
run_probe "missing required field" "src/content/blog/__probe-missing-required.mdx" '---
title: "Probe"
---
body
'

# Probe 3: invalid status enum value
run_probe "invalid status enum" "src/content/projects/__probe-bad-enum.mdx" '---
name: "Probe"
oneLiner: "x"
status: notvalid
marketingUrl: "https://example.com"
---
body
'

# Probe 4: duplicate slug across paths (must fail at the slug-discipline gate)
echo
echo "── Probe: duplicate slug across paths ──"
mkdir -p src/content/blog/__probe-dupe
printf '%s' '---
title: "A"
pubDate: 2026-04-30
summary: "x"
---
' > src/content/blog/__probe-dupe.mdx
printf '%s' '---
title: "B"
pubDate: 2026-04-30
summary: "x"
---
' > src/content/blog/__probe-dupe-other.mdx
# Duplicate the slug intentionally:
mv src/content/blog/__probe-dupe-other.mdx src/content/blog/__probe-dupe-nested.mdx 2>/dev/null || true
# Actually create a real collision: two files with the same basename in different subpaths
mkdir -p src/content/blog/sub
cp src/content/blog/__probe-dupe.mdx src/content/blog/sub/__probe-dupe.mdx
out=$(pnpm run -s check:content-slugs 2>&1)
rc=$?
rm -rf src/content/blog/__probe-dupe.mdx src/content/blog/__probe-dupe-nested.mdx src/content/blog/sub src/content/blog/__probe-dupe
if [ $rc -ne 0 ]; then
  echo "  ✓ slug check failed as expected (rc=$rc)"
  echo "$out" | tail -6 | sed 's/^/    /'
  PASS=$((PASS + 1))
else
  echo "  ✗ slug check SUCCEEDED but should have failed"
  echo "$out" | tail -10 | sed 's/^/    /'
  FAIL=$((FAIL + 1))
fi

# Probe 5: invalid slug pattern (uppercase)
echo
echo "── Probe: invalid slug pattern ──"
printf '%s' '---
title: "Probe"
pubDate: 2026-04-30
summary: "x"
---
' > "src/content/blog/__Probe-Bad-CASE.mdx"
out=$(pnpm run -s check:content-slugs 2>&1)
rc=$?
rm -f "src/content/blog/__Probe-Bad-CASE.mdx"
if [ $rc -ne 0 ]; then
  echo "  ✓ slug check failed as expected (rc=$rc)"
  echo "$out" | tail -4 | sed 's/^/    /'
  PASS=$((PASS + 1))
else
  echo "  ✗ slug check SUCCEEDED but should have failed"
  echo "$out" | tail -10 | sed 's/^/    /'
  FAIL=$((FAIL + 1))
fi

echo
echo "── Summary ──"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
if [ $FAIL -gt 0 ]; then
  exit 1
fi
exit 0
