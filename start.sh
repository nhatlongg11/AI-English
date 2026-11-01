#!/usr/bin/env bash
# Run with Git Bash on Windows, or Bash on Linux/macOS.
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

case "${1:-}" in
  -h|--help)
    echo "Usage: bash start.sh [--no-open]"
    echo "Prepare the existing database, start both services, and open TenseLab."
    echo "Keep this terminal open. Press Ctrl+C to stop services started here."
    exit 0
    ;;
  ""|--no-open) ;;
  *) echo "Unknown option: $1. Use --help." >&2; exit 2 ;;
esac
if (( $# > 1 )); then
  echo "Usage: bash start.sh [--no-open]" >&2
  exit 2
fi

command -v node >/dev/null 2>&1 || { echo "Install Node.js 22.12+ before starting TenseLab." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is missing. Install Node.js with npm." >&2; exit 1; }
node --input-type=module -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) { console.error("TenseLab requires Node.js 22.12 or newer."); process.exit(1); }'
if [[ ! -f .env ]]; then
  echo "Missing .env. Configure your Gemini/database settings first; see docs/GEMINI_SETUP.md." >&2
  exit 1
fi

if [[ ! -f node_modules/tsx/dist/cli.mjs || ! -f node_modules/vite/bin/vite.js || ! -f node_modules/prisma/build/index.js ]]; then
  npm ci
fi

echo "Preparing TenseLab using the existing configuration and data..."
npm run db:generate
npm run db:migrate
npm run db:seed

if [[ "${1:-}" == "--no-open" ]]; then
  exec npm run dev
else
  exec npm run dev -- --open
fi
