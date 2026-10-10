import { chromium } from 'playwright-core'; import { serve } from './serve.mjs';
import { EXE } from '../../../core/render/browser.mjs';   // PLAYWRIGHT_CHROME 或本机 playwright 缓存里最新的 headless shell
const { server, port } = await serve(process.cwd());
const flagsets = { default: [], metal: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], gl: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist'] };
for (const [name, fl] of Object.entries(flagsets)) {
  const b = await chromium.launch({ executablePath: EXE, args: fl });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(`http://127.0.0.1:${port}/test.html?h=${process.argv[2] || 'lythwood_lounge'}`);
  await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
  const info = await p.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
  let t0 = Date.now();
  for (let i = 0; i < 10; i++) { await p.evaluate(t => window.render(t), i / 60); await p.screenshot({ type: 'jpeg', quality: 100, path: `out/gl_${name}.jpg` }); }
  console.log(name, info, ((Date.now() - t0) / 10).toFixed(0) + 'ms/frame');
  await b.close();
}
server.close();
