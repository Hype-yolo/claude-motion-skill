// 从剪辑表 edl.js 导出 music/timeline.json（配乐脚本 music.py 的输入）
// 用法（在 demo/ 目录下）：node music/export_timeline.cjs
const fs = require('fs'), path = require('path'), vm = require('vm');
const here = __dirname;
const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(here, '..', 'edl.js'), 'utf8'), sandbox);
const E = sandbox.EDL;
const shots = E.shots.map((s) => ({
  kind: s.kind,
  id: s.kind === 'card' ? s.pose : s.id,
  chap: s.kind === 'card' ? s.chap : s.kind === 'chapter' ? s.id : s.kind,
  t0: Math.round(s.t0 * 1e6) / 1e6, b0: s.b0, beats: s.beats,
}));
const out = { bpm: E.BPM, beat: E.BEAT, total_beats: E.beats, duration: E.DUR, shots };
const dst = process.argv[2] || path.join(here, 'timeline.json');
fs.writeFileSync(dst, JSON.stringify(out, null, 1));
console.log('timeline', shots.length, 'shots', E.DUR.toFixed(2) + 's →', dst);
