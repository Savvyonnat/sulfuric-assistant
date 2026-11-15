#!/data/data/com.termux/files/usr/bin/bash
# Runs at boot when the Termux:Boot addon is installed.
# Place a copy in ~/.termux/boot/ :
#   mkdir -p ~/.termux/boot && cp termux/boot.sh ~/.termux/boot/start-sulfuric.sh
#
# Then start it once manually so Android shows the boot permission prompt.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

termux-wake-lock
nohup npm start > "$ROOT/bot.log" 2>&1 &
echo "Sulfuric started at boot (log: $ROOT/bot.log)"
