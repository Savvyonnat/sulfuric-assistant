#!/data/data/com.termux/files/usr/bin/bash
# One-time setup for running the Sulfuric Discord bot inside Termux (Android).
#
#   bash scripts/termux-setup.sh
#
# The bot is plain Node.js, so it runs headless on Android. Music uses the
# system ffmpeg and yt-dlp resolved through tools.js.

set -e

echo "==> Updating packages"
pkg update -y

echo "==> Installing Node.js, ffmpeg, Python, git"
pkg install -y nodejs ffmpeg python git

echo "==> Installing yt-dlp"
if pkg install -y yt-dlp 2>/dev/null; then
  echo "    yt-dlp installed from the Termux repo"
else
  echo "    falling back to pip"
  pip install -U yt-dlp
fi

echo
echo "==> Versions"
node -v
ffmpeg -version | head -1
(yt-dlp --version 2>/dev/null || python -m yt_dlp --version)

cat <<'EOF'

==> Next steps
  1. Copy this project to your phone (git clone, or copy the folder).
  2. cd sulfur-bot
  3. cp .env.example .env      # then edit DISCORD_TOKEN / CLIENT_ID / GUILD_ID
  4. npm install               # if ffmpeg-static fails, use: npm install --ignore-scripts
  5. npm start

==> Keep Termux alive
  termux-wake-lock             # stop Android from killing the bot
  Also disable battery optimisation for Termux in Android settings.

  Run in the background with:
  nohup npm start > bot.log 2>&1 &
EOF
