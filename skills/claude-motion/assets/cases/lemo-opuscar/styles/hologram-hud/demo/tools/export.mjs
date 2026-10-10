// 导出 events.json（音效事件）、timeline.json（配乐网格）、out/srt.json（字幕）
// 用法（仓库根）：node styles/hologram-hud/demo/tools/export.mjs [content.json] [工作目录，默认 demo/]
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const D = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(D, '../../..');
process.chdir(ROOT);
const { openDemo, closeServer } = await import(path.join(ROOT, 'core/render/page.mjs'));
const rel = path.relative(ROOT, D);
const content = process.argv[2] || 'content.json', W = path.resolve(process.argv[3] || D);
const q = `content=${content}&voices=${path.relative(D, path.join(W, 'voices')) || 'voices'}`;
const { browser, page } = await openDemo(rel, { q });
const r = await page.evaluate(() => ({ dur: window.DUR, ev: window.EV, subs: window.SUBS, tl: window.TIMELINE }));
fs.mkdirSync(path.join(W, 'out'), { recursive: true });
fs.writeFileSync(path.join(W, 'events.json'), JSON.stringify({ dur: r.dur, ev: r.ev }));
fs.writeFileSync(path.join(W, 'timeline.json'), JSON.stringify(r.tl, null, 1));
fs.writeFileSync(path.join(W, 'out/srt.json'), JSON.stringify(r.subs, null, 1));
console.log('events', r.ev.length, 'dur', r.dur);
await browser.close(); closeServer();
