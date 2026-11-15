#!/data/data/com.termux/files/usr/bin/bash
# Stop a Sulfuric bot that is running in the background.

pkill -f "node .*index.js" 2>/dev/null && echo "Stopped the bot." || echo "The bot is not running."

if command -v termux-wake-unlock >/dev/null 2>&1; then
  termux-wake-unlock
  echo "Wake lock released."
fi
