// content.json → lines.json（Kokoro 配音输入）。用法：node tools/make_lines.mjs [content.json] [lines.json] [voice覆盖]
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const D = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(D, process.argv[2] || 'content.json'), out = process.argv[3] ? path.resolve(process.argv[3]) : path.join(D, 'lines.json');   // 输出路径相对当前目录
const C = JSON.parse(fs.readFileSync(src, 'utf8'));
const v = process.argv[4] || C.voice?.id || 'af_heart', sp = C.voice?.speed ?? 0.96;
const L = [{ id: 'intro', text: C.intro_vo, asr: C.intro_vo_asr }, ...C.callouts.map((c, i) => ({ id: 'c' + i, text: c.vo, asr: c.vo_asr })), { id: 'outro', text: C.outro_vo, asr: C.outro_vo_asr }]
  .filter(l => l.text).map(l => { const o = { ...l, voice: v, speed: sp }; if (!o.asr) delete o.asr; return o; });
fs.writeFileSync(out, JSON.stringify(L, null, 1)); console.log(out, L.length, 'lines', v);
