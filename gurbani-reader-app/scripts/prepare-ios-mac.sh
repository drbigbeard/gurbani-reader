#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Xcode is required. Install it from the Mac App Store, open it once, then rerun this script." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 24 is required. Install the current Node.js 24 LTS release, then rerun this script." >&2
  exit 1
fi

npm ci

if [[ ! -f public/assets/databases/gurbani_reader_v8SQLite.db ]]; then
  npm run corpus:restore
  snapshot_root=".tmp/v013-banidb-snapshot"
  SNAPSHOT_GENERATED_AT=2026-07-19T00:00:00.000Z \
  EXPECTED_SNAPSHOT_SHA256=e49b1f372aa59e59cb8ba0a9a5c97d72491fe58089ad43d7148416aaf6886f38 \
    npm run data:fetch-v013 -- "$snapshot_root"
  npm run data:upgrade-v6 -- \
    public/assets/databases/gurbani_reader_v5SQLite.db \
    public/assets/databases/gurbani_reader_v6SQLite.db \
    "$snapshot_root"
  npm run data:upgrade-v7 -- \
    public/assets/databases/gurbani_reader_v6SQLite.db \
    public/assets/databases/gurbani_reader_v7SQLite.db
  npm run data:upgrade-v8 -- \
    public/assets/databases/gurbani_reader_v7SQLite.db \
    public/assets/databases/gurbani_reader_v8SQLite.db
fi

npm run audit:rc
npm run ios:prepare
npm run ios:audit

echo
echo "The iOS project is prepared. Xcode will now open."
echo "Select the App target, choose your Personal Team under Signing & Capabilities, select your iPhone, and press Run."
open ios/App/App.xcodeproj
