// 字幕导出：node styles/paper-popup/demo/make_srt.mjs [out.srt]   （默认 ../paper-popup.srt）
// 直接读 story.js 的旁白 VO / 气泡 BUB 与 voices/dur.json，时间区间与 hud.js 的显示区间一致：
//   旁白 drawSubs：t0-.15 淡入 … t0+dur+.25 开始淡出 → 取 [t0, t0+dur+.4]
//   气泡 drawBubbles：t0 弹出 … t1 开始收起（.2 s）   → 取 [t0, t1+.2]
// 每条两行：英文 + 中文（与片中双语字幕一致）；章节横幅、片尾字卡不进 srt
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
// package.json 是 commonjs，story.js 按 ES module 用 data: URL 载入
const { VO, BUB } = await import('data:text/javascript;base64,' + fs.readFileSync(path.join(HERE, 'story.js')).toString('base64'));
const dur = JSON.parse(fs.readFileSync(path.join(HERE, 'voices/dur.json'), 'utf8'));
const cues = [
  ...VO.map(([id, t0, en, zh]) => ({ t0, t1: t0 + (dur[id] || 3) + .4, text: `${en}\n${zh}` })),
  ...BUB.map(([who, t0, t1, en, zh]) => ({ t0, t1: t1 + .2, text: `${en}\n${zh}` })),
].sort((a, b) => a.t0 - b.t0);
for (let k = 0; k < cues.length - 1; k++) cues[k].t1 = Math.min(cues[k].t1, cues[k + 1].t0);
const fmt = s => { const ms = Math.round(s * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(HERE, '../paper-popup.srt');
fs.writeFileSync(out, cues.map((c, i) => `${i + 1}\n${fmt(c.t0)} --> ${fmt(c.t1)}\n${c.text}\n`).join('\n'));
console.log(out, cues.length, 'cues');
