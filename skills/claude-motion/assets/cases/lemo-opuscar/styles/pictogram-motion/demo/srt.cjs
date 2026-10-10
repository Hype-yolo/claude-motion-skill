// 字卡字幕：片子无旁白，这里把画面上的标题字卡按剪辑表导出成 .srt（英日版文字）
// 用法（在 demo/ 目录下）：node srt.cjs [../pictogram-motion.srt]
const fs = require('fs'), path = require('path'), vm = require('vm');
const sb = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'edl.js'), 'utf8'), sb);
const E = sb.EDL, B = E.BEAT;
const cues = [];
const cue = (t0, t1, text) => cues.push({ t0, t1, text });

// 片头（intro 48 拍，见 scenes.js introScene）
cue(1.0, 6.4, '2026 · AICHI – NAGOYA · JAPAN');
cue(6.4 + 1.0 * B, 12.8, 'THE 20TH ASIAN GAMES\nAICHI-NAGOYA 2026 · 第20回アジア競技大会');
cue(12.8, 14.4, '43 SPORTS · 競技');
cue(14.4, 16.0, '469 EVENTS · 種目');
cue(16.0, 17.6, '16 DAYS · 9.19 — 10.4');
cue(17.6, 18.4, 'ON YOUR MARKS · 位置について');
cue(18.4, 19.2, 'SET · よーい');

for (const s of E.shots) {
  const t0 = s.t0, t1 = s.t0 + s.dur;
  if (s.kind === 'chapter') cue(t0, t1, `CHAPTER ${s.no} · ${s.en}\n${s.jp}`);
  else if (s.kind === 'card') {
    const fam = s.fam ? `${s.en} — ${s.sub}` : s.en + (s.sub ? ` (${s.sub})` : '');
    cue(t0, t1, `${String(s.n).padStart(2, '0')}/43  ${fam}\n${s.jpBig || s.jp}`);
  } else if (s.kind === 'finale') {
    cue(t0, t0 + 20 * B, 'ALL 43 SPORTS');
    cue(t0 + 23 * B, t0 + 36 * B, 'IMAGINE ONE ASIA\nここで、ひとつに。');
    cue(t0 + 36 * B, t1 - 0.2, 'AICHI-NAGOYA 2026\nTHE 20TH ASIAN GAMES · 2026.9.19 — 10.4\nLemoLab × Claude Opus 5.5');
  }
}
const ts = (t) => {
  const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const out = process.argv[2] || path.join(__dirname, '..', 'pictogram-motion.srt');
fs.writeFileSync(out, cues.map((c, i) => `${i + 1}\n${ts(c.t0)} --> ${ts(c.t1)}\n${c.text}\n`).join('\n'));
console.log(cues.length, 'cues →', out);
