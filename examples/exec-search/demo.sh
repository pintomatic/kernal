#!/usr/bin/env bash
#
# Exec Search Shortlist Demo
# Generates a shortlist rationale from the Kernal knowledge graph.
#
# Usage: bash examples/exec-search/demo.sh
#

set -euo pipefail
cd "$(dirname "$0")/../.."

echo "=== Step 1: Build Kernal ==="
npm run build

echo ""
echo "=== Step 2: Seed exec search data ==="
npx tsx examples/exec-search/seed-exec-search.ts

echo ""
echo "=== Step 3: Generate shortlist — Vestra Media CFO ==="
npx tsx examples/exec-search/shortlist.ts \
  --assignment "Vestra Media CFO" \
  --candidates "Astrid Berg,Markus Blom"

echo ""
echo "=== Done ==="
echo ""
echo "Output:"
echo "  examples/exec-search/output/shortlist-rationale.md  (client-facing)"
echo "  examples/exec-search/output/shortlist-audit.md      (internal audit trail)"
echo ""
echo "Try another assignment:"
echo "  npx tsx examples/exec-search/shortlist.ts --assignment 'Nordvik Energy CTO' --candidates 'Maren Dahl'"
echo "  npx tsx examples/exec-search/shortlist.ts --assignment 'Arctura Tech CEO' --candidates 'Jonas Lindberg'"
