#!/data/data/com.termux/files/usr/bin/bash
# One-time setup for running the Sulfuric bot in Termux.
#
#   bash termux/setup.sh
#
# Safe to run again. Everything is installed into Termux's own prefix.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Updating packages"
pkg update -y
pkg upgrade -y

echo "==> Installing nodejs, ffmpeg, python, git"
pkg install -y nodejs ffmpeg python git

echo "==> Installing yt-dlp"
if pkg install -y yt-dlp 2>/dev/null; then
  echo "    yt-dlp installed from the Termux repo"
else
  echo "    falling back to python -m pip"
  python -m pip install --upgrade pip
  python -m pip install -U yt-dlp
fi

echo "==> Installing npm dependencies"
if ! npm install --no-audit --no-fund; then
  echo
  echo "    npm install failed - retrying with --ignore-scripts"
  echo "    (the bot will use the system ffmpeg instead of ffmpeg-static)"
  npm install --no-audit --no-fund --ignore-scripts
fi

echo
echo "==> Tool check"
printf "node   : "; node -v || true
printf "npm    : "; npm -v || true
printf "ffmpeg : "; ffmpeg -version 2>/dev/null | head -1 || echo "NOT FOUND"
printf "yt-dlp : "; (yt-dlp --version 2>/dev/null || python -m yt_dlp --version 2>/dev/null || echo "NOT FOUND")

cat <<'EOF'

==> Done. Next steps
  1. cp .env.example .env
  2. nano .env          # fill DISCORD_TOKEN, CLIENT_ID, GUILD_ID
  3. bash termux/start.sh
EOF
