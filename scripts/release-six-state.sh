#!/bin/sh
set -eu

# One deterministic release gate for the six-state coaching launch.
# Native exports are intentionally delegated to the mobile package's release
# check so iOS and Android use the same Expo/Doctor configuration as releases.

echo "== Workspace typecheck =="
pnpm run typecheck

echo "== Web unit/content tests =="
pnpm --dir artifacts/california-driver-coach run test

echo "== Web production build =="
PORT=4174 BASE_PATH=/california-driver-coach/ pnpm --dir artifacts/california-driver-coach run build

echo "== Browser regression (Chromium, Firefox, WebKit) =="
pnpm --dir artifacts/california-driver-coach run test:browser

echo "== API typecheck and tests =="
pnpm --dir artifacts/api-server run typecheck
pnpm --dir artifacts/api-server run test

echo "== Mobile release check (iOS and Android exports) =="
pnpm --dir artifacts/coastwise-mobile run release-check

echo "== Working tree validation =="
git diff --check

echo "Six-state release validation passed."