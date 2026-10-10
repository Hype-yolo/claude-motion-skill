// 无头 Chrome：优先 PLAYWRIGHT_CHROME 环境变量，否则找本机 playwright 缓存里的 headless shell
// GPU 参数让 WebGL 走 ANGLE/GL（M 系列 Mac 上比默认 SwiftShader 快 ~6 倍）
import fs from 'fs'; import path from 'path';
function findExe() {
  if (process.env.PLAYWRIGHT_CHROME) return process.env.PLAYWRIGHT_CHROME;
  const base = path.join(process.env.HOME, 'Library/Caches/ms-playwright');
  const dirs = fs.existsSync(base) ? fs.readdirSync(base).filter(d => d.startsWith('chromium_headless_shell')).sort().reverse() : [];
  for (const d of dirs) {
    const p = path.join(base, d, 'chrome-headless-shell-mac-arm64/chrome-headless-shell');
    if (fs.existsSync(p)) return p;
  }
  return undefined;   // 交给 playwright 自己找
}
export const EXE = findExe();
export const ARGS = ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--font-render-hinting=none', '--force-color-profile=srgb'];
