import fs from 'fs';
import path from 'path';
import { openPage, closeServer, ROOT } from './page.mjs';
const { browser, page } = await openPage();
const d = await page.evaluate(() => ({ C: window.CUES, P: window.PLAN, DUR: window.DUR }));
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out/timeline.json'), JSON.stringify(d, null, 1)); console.log('DUR', d.DUR);
await browser.close(); closeServer();
