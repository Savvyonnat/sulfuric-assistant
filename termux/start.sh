#!/data/data/com.termux/files/usr/bin/bash
# Start the Sulfuric bot in Termux, keeping the CPU awake.
#
#   bash termux/start.sh
#
# Stop with Ctrl+C, or use: bash termux/stop.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "No .env found. Copy the template first:"
  echo "  cp .env.example .env && nano .env"
  exit 1
fi

# Keep the CPU awake while the bot runs (needs the Termux:API addon).
if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock
  echo "Wake lock enabled."
else
  echo "Note: install the Termux:API addon to enable termux-wake-lock."
fi

echo "Starting Sulfuric... (Ctrl+C to stop)"
exec npm start
