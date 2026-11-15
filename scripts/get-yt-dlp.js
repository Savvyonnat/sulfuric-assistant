// Download yt-dlp into bin/ (Windows exe, or the plain binary elsewhere).
// Usage: node scripts/get-yt-dlp.js
const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const isWin = process.platform === "win32";
const dest = path.join(__dirname, "..", "bin", isWin ? "yt-dlp.exe" : "yt-dlp");
const url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" + (isWin ? ".exe" : "");

fs.mkdirSync(path.dirname(dest), { recursive: true });

function download(u) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(u, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return download(res.headers.location).then(resolve);
      }
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode + " for " + u));
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", reject);
  });
}

(async () => {
  console.log("Downloading", url);
  await download(url);
  if (!isWin) execSync(`chmod +x "${dest}"`);
  console.log("Saved to", dest);
})().catch(e => { console.error("Failed to download yt-dlp:", e.message); process.exit(1); });
