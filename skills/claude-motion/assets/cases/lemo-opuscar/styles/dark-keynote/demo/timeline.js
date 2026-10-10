// timeline.js — 速度网格 + 音型 + 三条声部的音符表（画面 / 配乐 / 混音 / 自检共用的唯一数据源）
export const BPM = 120, BEAT = 0.5, BAR = 2, S16 = 0.125, DUR = 42;

// 音型 P（原创，12 个十六分音符）：A3 E4 B4 E4 C#5 E4 | A3 E4 B4 E4 D5 C#5
export const P = [57, 64, 71, 64, 73, 64, 57, 64, 71, 64, 74, 73];

// 关键时间点（秒）
export const K = {
  typeStart: 0.75,          // 片名第一个字
  title: 'Room to think.',
  ret: 2.5,                 // 回车
  typeI: 2.75,              // 第二行 "I"
  ding: [3.0, 3.5, 3.75],   // 三声通知
  pullStart: 4.0, pullEnd: 12.0,
  vo: { l1: 4.25, l2: 6.25, l3: 8.25, l4: 20.5, l5: 23.0, l6: 34.55 },
  inserts: [12.0, 12.5, 13.0, 13.5],
  drown: 13.5,
  freeze: 15.0, stretch: 15.5, press: 16.0, gridShow: 17.0,
  sort: 18.0, chrome: 19.0, dim: 19.5,
  reveal: 20.0, checks: [21.75, 22.25, 22.75], rotZero: 24.5, pushNum: 25.0,
  num: 26.0, locks: [26.5, 26.625, 26.75, 26.875, 27.0], files: 27.0, line2: 28.0,
  numBack: 29.5, retract: [30.0, 30.5, 31.0, 31.5, 32.0], toCaret: 32.5,
  silence2: 33.0, echo: 34.0, echoType: 34.5, endCard: 37.0, endFade: 40.0, caretOff: 41.5,
};

// 声部 1：在拍上的马林巴（4.0–15.0）
export function voice1() {
  const out = [];
  for (let k = 0; ; k++) { const t = 4.0 + k * S16; if (t >= K.freeze - 1e-6) break; out.push({ t, k, i: k % 12, m: P[k % 12] }); }
  return out;
}
// 声部 2：同一音型，6.0 进，8.0 起加速错相（速度比 rate2）
export function rate2(t) {
  if (t < 8) return 1;
  if (t < 10) return 1 + 0.045 * (t - 8) / 2;
  if (t < 14) return 1.045 + 0.02 * (t - 10) / 4;
  return 1.065 + 0.10 * (t - 14);           // 14–15 冲向 1.165
}
function notesByRate(t0, rate, filter, tEnd = K.freeze) {
  const out = []; let tau = 0, t = t0, k = 0; const dt = 1 / 2000;
  while (t < tEnd - 1e-6) {
    if (tau >= k * S16 - 1e-9) { if (filter(k)) out.push({ t: Math.round(t * 2000) / 2000, k, i: k % 12, m: P[k % 12] }); k++; continue; }
    tau += rate(t) * dt; t += dt;
  }
  return out;
}
export function voice2() { return notesByRate(6.0, rate2, () => true); }
// 声部 3：钟琴，只奏高音（第 2、4、10、11 个音），10.0 进，略慢（反向错相）
export function voice3() {
  return notesByRate(10.0, t => t < 14 ? 0.94 : 0.94 + 0.12 * (t - 14), k => [2, 4, 10, 11].includes(k % 12)).map(n => ({ ...n, m: n.m + 12 }));
}
// 对齐后的干净声部（18–26 轻奏；30–33 做减法）
export function voiceClean() {
  const out = [];
  for (let k = 0; ; k++) { const t = 18.0 + k * S16; if (t >= 26.0 - 1e-6) break; out.push({ t, k, i: k % 12, m: P[k % 12], v: t < 20 ? 0.55 : 0.32 }); }
  // 减法：30–31 拿掉 4 个、31–32 拿掉 8 个、32–33 只剩四分音符 A4
  const drop1 = [1, 5, 8, 11], drop2 = [1, 2, 3, 5, 7, 8, 9, 11];
  for (let k = 0; k < 16; k++) { const t = 30 + k * S16, i = k % 12; if (!drop1.includes(i)) out.push({ t, k, i, m: P[i], v: 0.36 }); }
  for (let k = 0; k < 8; k++) { const t = 31 + k * S16 * 2, i = (k * 2) % 12; if (!drop2.includes(i)) out.push({ t, k, i, m: P[i], v: 0.3 }); }
  for (let k = 0; k < 2; k++) out.push({ t: 32 + k * 0.5, k, i: 0, m: 69, v: 0.26 });
  return out.sort((a, b) => a.t - b.t);
}
export const typeTimes = (t0, text) => [...text].map((c, i) => ({ c, t: t0 + i * S16 }));
