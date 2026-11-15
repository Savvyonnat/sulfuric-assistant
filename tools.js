// Resolve external binaries (yt-dlp, ffmpeg) portably.
//
// Order of preference:
//   1. env override (YT_DLP_PATH / FFMPEG_PATH)
//   2. bundled binary (bin/yt-dlp.exe on Windows, bin/yt-dlp elsewhere)
//   3. system PATH (works on Termux/Linux/macOS after `pkg install` / `apt install`)
//   4. `python -m yt_dlp` for yt-dlp when only Python is available

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function onPath(cmd) {
  if (process.platform === "win32") return null; // bundled exe is used on Windows
  try {
    const out = execFileSync("sh", ["-c", "command -v " + cmd], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    const found = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0];
    return found || null;
  } catch {
    return null;
  }
}

function pythonModule(moduleName) {
  for (const py of ["python3", "python"]) {
    if (!onPath(py)) continue;
    try {
      execFileSync(py, ["-m", moduleName, "--version"], { stdio: "ignore" });
      return { cmd: py, prefix: ["-m", moduleName] };
    } catch { /* try next interpreter */ }
  }
  return null;
}

/** yt-dlp command spec: { cmd, prefix } or null when unavailable. */
function ytdlpCommand() {
  const candidates = [];
  if (process.env.YT_DLP_PATH) candidates.push(process.env.YT_DLP_PATH);
  candidates.push(path.join(__dirname, "bin", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"));
  for (const cmd of candidates) {
    if (cmd && fs.existsSync(cmd)) return { cmd, prefix: [] };
  }
  const found = onPath("yt-dlp");
  if (found) return { cmd: found, prefix: [] };
  return pythonModule("yt_dlp");
}

/** ffmpeg executable path. */
function ffmpegPath() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const system = onPath("ffmpeg");
  if (system) return system;
  try {
    const bundled = require("ffmpeg-static");
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch { /* ffmpeg-static not installed */ }
  return "ffmpeg";
}

module.exports = { ytdlpCommand, ffmpegPath, onPath };
