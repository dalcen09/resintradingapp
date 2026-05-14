#!/bin/sh
set -ex

echo "=== Pushing database schema ==="
pnpm --filter @workspace/db run push

echo "=== Building frontend ==="
BASE_PATH=/ pnpm --filter @workspace/resin-trading run build

echo "=== Building API server ==="
cd artifacts/api-server
pnpm exec esbuild src/app.ts --bundle --platform=node --format=cjs --outfile=dist/app.cjs

echo "=== Build complete ==="
