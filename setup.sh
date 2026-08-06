#!/usr/bin/env bash
# setup.sh — recreate pi-zero's runtime dependency symlinks.
# compact-thinking resolves `jiti` and `pi-compact-thinking` from node_modules.
set -euo pipefail
cd "$(dirname "$0")"

NPM_DIR="${PI_NPM_DIR:-$HOME/.pi/agent/npm/node_modules}"

mkdir -p node_modules
ln -sfn "$NPM_DIR/jiti" node_modules/jiti
ln -sfn "$NPM_DIR/pi-compact-thinking" node_modules/pi-compact-thinking

echo "✅ pi-zero dependency symlinks created in node_modules/"
