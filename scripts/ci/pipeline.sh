#!/usr/bin/env bash
set -euo pipefail

npm ci
npm run check:all
npm run typecheck
npm run lint
npm run test --workspace @sap/api -- --runInBand --json --outputFile=test-results/jest.json
npm run ci:record-evidence
