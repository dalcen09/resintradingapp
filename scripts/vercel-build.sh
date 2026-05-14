#!/bin/sh
set -e

BASE_PATH=/ pnpm --filter @workspace/resin-trading run build
cd artifacts/api-server
pnpm exec esbuild src/app.ts --bundle --platform=node --format=cjs --outfile=dist/app.cjs
