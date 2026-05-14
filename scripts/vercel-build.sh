#!/bin/sh
set -e

pnpm --filter @workspace/api-zod exec tsc --build
pnpm --filter @workspace/db exec tsc --build
BASE_PATH=/ pnpm --filter @workspace/resin-trading run build
cd artifacts/api-server
pnpm exec esbuild src/app.ts --bundle --platform=node --format=cjs --outfile=dist/app.cjs
