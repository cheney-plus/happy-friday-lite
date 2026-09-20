#!/bin/sh
# Dev-only launcher for the happyfriday-office CLI (GENOFFICE_APP_BIN).
#
# The CLI's --headless-export path spawns the "app binary". In a packaged app
# process.execPath already is that binary; in the dev checkout it is the bare
# Electron runtime, which needs the project root passed as the app path for the
# request to reach main.js (and its --headless-export entry).
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/../../node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" "$DIR/../.." "$@"
