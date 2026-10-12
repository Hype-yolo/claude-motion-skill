// 无头 Chrome 的启动参数。浏览器本身交给 playwright 按它的版本自己找（npm run 时装的 chromium-headless-shell）；
// 想用别的可执行文件：PLAYWRIGHT_CHROME=/path/to/chrome-headless-shell
// GPU：macOS 显式用 Metal（新版 headless-shell 上 --use-angle=gl 会退回 SwiftShader 软渲染，慢 ~6 倍）；
//      其它系统不强加后端。LEMO_ANGLE=metal|gl|vulkan|swiftshader… 可覆盖，LEMO_ANGLE=default 表示不传 --use-angle。
export const EXE = process.env.PLAYWRIGHT_CHROME || undefined;   // undefined = 让 playwright 自己找
const angle = process.env.LEMO_ANGLE || (process.platform === 'darwin' ? 'metal' : 'default');
export const ARGS = [...(angle === 'default' ? [] : [`--use-angle=${angle}`]), '--enable-gpu', '--ignore-gpu-blocklist', '--font-render-hinting=none', '--force-color-profile=srgb'];

// WebGL 走了软渲染就提醒一次（2D 画布的 demo 不受影响；不会让渲染失败）
let warned = false;
export async function warnIfSoftwareGL(page) {
  if (warned) return; warned = true;
  try {
    const r = await page.evaluate(() => {
      const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl'); if (!g) return null;
      const e = g.getExtension('WEBGL_debug_renderer_info'), name = e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '';
      g.getExtension('WEBGL_lose_context')?.loseContext(); return String(name);
    });
    if (r && /swiftshader|llvmpipe|software/i.test(r)) console.error(`[note] WebGL runs on software rendering (${r.slice(0, 80)}): 3D/CRT demos will be slow. macOS: LEMO_ANGLE=metal; Linux: needs GPU drivers. See core/README.md.`);
  } catch {}
}
