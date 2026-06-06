#!/usr/bin/env bash
# Bouwt de app (indien nodig) en start 'm. Open daarna http://localhost:3000
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
npm run build
npm start
