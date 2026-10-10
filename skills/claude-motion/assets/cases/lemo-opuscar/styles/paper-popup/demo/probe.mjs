import { chromium } from 'playwright-core'; import { serve } from './serve.mjs';
import { EXE } from '../../../core/render/browser.mjs';   // PLAYWRIGHT_CHROME 或本机 playwright 缓存里最新的 headless shell
const { server, port } = await serve(process.cwd());
const b = await chromium.launch({ executablePath: EXE, args: ['--use-angle=gl', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(`http://127.0.0.1:${port}/index.html`); await p.waitForFunction(() => window.READY, null, { timeout: 120000 });
console.log(await p.evaluate(process.argv[2]));
await b.close(); server.close();
