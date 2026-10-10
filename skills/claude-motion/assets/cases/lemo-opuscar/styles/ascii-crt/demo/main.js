// TRANQUILITY.LOG —— 全片时间线。window.render(t) 画第 t 秒；window.EV 导出拟音 / 旁白事件；window.SUBS 导出字幕。
import { W, H, initTerm, glyph, text, inverse, cursor, makeRamp, pick, ATLAS } from './term.js';
import { makeCRT } from './crt.js';
import { Art, paintEarthrise, makeCraters, horizonY, earthShade } from './art.js';

const out = document.getElementById('c');
const crt = makeCRT(out);
const scene = document.createElement('canvas'); scene.width = W; scene.height = H;
const inner = document.createElement('canvas'); inner.width = W; inner.height = H;   // 退出屏幕时"屏幕里的画面"
const G0 = scene.getContext('2d'), G1 = inner.getContext('2d');
let g = G0;
await initTerm();
const Q = new URLSearchParams(location.search);
const lines = await (await fetch('lines.json')).json();
const words = await (await fetch('voices/words.json')).json();
const vdur = await (await fetch('voices/dur.json')).json();

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const eo = t => 1 - Math.pow(1 - clamp(t), 3);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpLog = (a, b, t) => Math.exp(lerp(Math.log(a), Math.log(b), t));
const hsh = (a, b = 0) => { let h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };

function begin(ctx = g) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter'; }
function blackRect(x, y, w, h) { g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(x, y, w, h); g.globalCompositeOperation = 'lighter'; }
// 磷光余辉：在 tOff 熄灭后按 τ 衰减（P3 琥珀是慢余辉）
const TAU = .12;
const decay = (t, tOff) => t < tOff ? 1 : Math.exp(-(t - tOff) / TAU);
// 光标：在 ons 列出的时刻亮 dur 秒，熄灭时带余辉
const flash = (t, ons, dur = .3) => { let v = 0; for (const o of ons) if (t >= o) v = Math.max(v, t < o + dur ? 1 : decay(t, o + dur)); return v; };
const blinkN = (t, t0, t1, period = .6) => { if (t < t0) return 0; const k = Math.floor((Math.min(t, t1) - t0) / period); const o = t0 + k * period; return t > t1 ? decay(t, t1) * 0 : (t - o < period / 2 ? 1 : decay(t, o + period / 2)); };

// ======================= 时间线（100 BPM：1 拍 0.6s，1 小节 2.4s；与 music/score.py 的 cue 对齐） =======================
const T = {
  on0: .35, on1: 1.05, blinks: [1.2, 1.8, 2.4], title: 3.0, titleDt: .15, sub: 5.4, subDt: .035, zoom0: 7.2, zoom1: 8.4,
  clock0: 10.35, clock1: 11.4, carrier: 16.2, carrierEnd: 17.45, msg: 17.6, msgBlinks: [19.8, 20.4, 21.0],
  cmd: 23.2, cmdDt: .038, err: [24.6, 25.2, 25.8], noOpt: 26.4, push0: 29.6, push1: 30.2, reply: 30.2, replyDt: .12,
  replyBlinks: [32.4, 33.0], fall0: 33.6, bloom: 37.2, rise1: 40.2,
  fr0: 40.2, fr1: 41.6, fr2: 42.6, fr3: 43.6, fr4: 46.8, fr5: 47.6,
  tx0: 48.0, tx1: 49.8, waitBlinks: [50.1, 50.7], smile: 51.6, out0: 52.6, out1: 54.8, card: 55.2, off0: 58.6, off1: 59.2, dur: 59.8,
};
const VOT = { l1: 11.6, l2: 21.4, l3: 26.6, l4: 42.2, l5: 52.4 };
const DUR = T.dur;
const EV = [];                                   // 拟音 / 旁白事件（events.mjs 导出给 mix.py）
const ev = (t, type, o = {}) => EV.push({ t: +t.toFixed(4), type, ...o });

// ======================= 布局 =======================
const V80 = { ox: 120, oy: 64, cw: 21 };          // 80 列终端
const STRIP = { y: 912, cw: 18, ox: 150 };        // 底部日志栏（字幕）

// ======================= 旁白 / 字幕：随 whisper 逐词时间打出 =======================
const VO = lines.map(L => {
  const txt = L.text.toUpperCase();
  const tw = txt.split(' '), ww = words[L.id] || [];
  // 每个词在文本中的结束字符位置 → 该词念完的时刻
  const marks = []; let pos = 0;
  tw.forEach((w, k) => { pos += w.length + (k ? 1 : 0); const wd = ww[k]; marks.push([wd ? Math.max(0, wd[1]) : k / tw.length * vdur[L.id], wd ? wd[2] : (k + 1) / tw.length * vdur[L.id], pos]); });
  return { id: L.id, t: VOT[L.id], d: vdur[L.id], text: txt, sub: L.text, marks: ww.length === tw.length ? marks : null };
});
VO.forEach(v => ev(v.t, 'vo', { id: v.id }));
function voChars(v, t) {
  const r = t - v.t;
  if (!v.marks) return Math.ceil(v.text.length * clamp(r / v.d));
  let n = 0, prev = 0;
  for (const [a, b, p] of v.marks) { if (r >= b) { n = p; prev = p; continue; } if (r > a) n = Math.round(lerp(prev, p, (r - a) / (b - a))); break; }
  return n;
}
const HOLD = 1.4;
const voEnd = v => Math.max(v.t + v.d + HOLD, v.t + 1.8, v.t + v.d + .6);
const NOSUB = Q.has('nosub');
function strip(t) {
  if (NOSUB) return;
  blackRect(0, STRIP.y - 14, W, H - STRIP.y + 14);
  const sep = { ox: V80.ox, oy: STRIP.y - 30, cw: V80.cw };
  text(g, '-'.repeat(80), 0, 0, sep, .28);
  const v = { ox: STRIP.ox, oy: STRIP.y + 6, cw: STRIP.cw };
  inverse(g, ' LOG ', 0, 0, v, .8);
  const cur = VO.filter(o => t >= o.t && t < voEnd(o)).pop();
  if (cur) {
    const n = voChars(cur, t), s = cur.text.slice(0, n);
    text(g, '> ' + s, 6, 0, v, 1);
    if (n < cur.text.length) cursor(g, 8 + s.length, 0, v, .9);
    return;
  }
  if (t >= T.tx0 && t < T.tx1 + .01) {           // 发送进度
    const p = seg(t, T.tx0, T.tx1 - .15), k = Math.floor(p * 20);
    text(g, '> TRANSMIT REPLY.TXT  [' + '#'.repeat(k) + '.'.repeat(20 - k) + ']  ' + String(Math.floor(p * 100)).padStart(3, ' ') + '%', 6, 0, v, 1);
    return;
  }
  if (t >= T.tx1 && t < VOT.l5) { text(g, '> SENT 2091.06.14 03:14:07   AWAITING REPLY', 6, 0, v, .9); cursor(g, 51, 0, v, flash(t, [50.1, 50.7, 51.3]) * .8); return; }
  text(g, '>', 6, 0, v, .75);
  cursor(g, 8, 0, v, (Math.floor(t / .5) % 2 === 0 ? 1 : decay(t % .5, 0)) * .7);
}

// ======================= 打字事件 =======================
function typedN(t, t0, dt, n) { return t < t0 ? 0 : Math.min(n, Math.floor((t - t0) / dt) + 1); }
function regTyping(str, t0, dt, type = 'key') { for (let k = 0; k < str.length; k++) ev(t0 + k * dt, str[k] === ' ' ? (type === 'key' ? 'space' : type) : type, { ch: str[k] }); }

// ======================= 1. 开机、片名、自检 =======================
const TITLE = 'TRANQUILITY.LOG', SUBT = 'UNIT 7 / LUNAR RELAY 7 / MAINTENANCE';
regTyping(TITLE, T.title, T.titleDt); regTyping(SUBT, T.sub, T.subDt, 'keyLight');
ev(.22, 'relay'); ev(T.on0, 'degauss');
const BOOT = [
  [8.20, 'RELAY-7 MONITOR ROM 4.11'],
  [8.45, 'MEMORY TEST ........... #MEM'],
  [9.05, 'POWER ................. SOLAR 11%  CELL 04%'],
  [9.30, 'HABITAT ............... VACANT'],
  [9.50, 'CREW .................. 0'],
  [9.70, 'ANTENNA ............... [ OK ]'],
  [9.90, 'OPTICS ................ SKIPPED'],
  [10.10, 'LAST ENTRY ............ 2051.06.14 03:12'],
  [10.30, 'CLOCK ................. #CLK'],
  [10.50, 'DORMANT ............... #DOR'],
];
BOOT.forEach(([t0]) => ev(t0, 'bootline'));
for (let y = 1; y <= 40; y++) { const p = y / 40; ev(T.clock0 + (1 - Math.pow(1 - p, 1 / 2.2)) * (T.clock1 - T.clock0), 'ratchet', { k: y }); }
ev(T.clock1, 'clunk');
function bootText(t, s) { const m = s.match(/#[A-Z]{3}/); return m ? s.replace(m[0], bootTok(t, m[0])) : s; }
function bootTok(t, s) {
  if (s === '#MEM') { const k = Math.floor(65536 * ss(seg(t, 8.5, 9.0))); return String(k).padStart(5, ' ') + 'K ' + (t > 9.0 ? 'OK' : ''); }
  const p = 1 - Math.pow(1 - seg(t, T.clock0, T.clock1), 2.2);
  const spin = t > T.clock0 && t < T.clock1;
  const r = x => Math.floor((Math.sin(Math.floor(t * 24) * 91.7 + x) * .5 + .5) * 12);
  if (s === '#CLK') { const yr = Math.floor(2051 + 40 * p + 1e-6); return `${yr}.${spin ? String(1 + r(1) % 12).padStart(2, '0') : '06'}.${spin ? String(1 + r(2) * 2 % 28).padStart(2, '0') : '14'} 03:12`; }
  const days = Math.floor(40 * 365.25 * p);
  return `${String(Math.floor(days / 365.25)).padStart(2, '0')}Y ${String(Math.floor(days % 365.25)).padStart(3, '0')}D`;
}
function linkPanel(t, noise = 0, amp = 1) {
  if (t < 10.6) return;
  const a = clamp((t - 10.6) / .1) * amp;
  const c0 = 52, r0 = 3;
  const box = x => '| ' + x.padEnd(21).slice(0, 21) + ' |';
  const lv = Math.round(clamp(noise) * 9);
  let w = '';
  for (let i = 0; i < 21; i++) { const ph = Math.sin(i * 1.7 + t * 31) * Math.sin(i * .37 + t * 7); w += noise <= 0 ? '_' : '_.-~^'[Math.min(4, Math.floor(Math.abs(ph) * noise * 5))]; }
  const rows = ['+-------- LINK ---------+', box('CARRIER   ' + (noise > 0 ? 'DETECT' : 'NONE')), box('SIGNAL    [' + '#'.repeat(lv) + '.'.repeat(9 - lv) + ']'), box(''), box(w), box(''), '+-----------------------+'];
  rows.forEach((s, k) => text(g, s, c0, r0 + k, V80, ((k === 0 || k === rows.length - 1) ? .5 : .85) * a));
}
function sBoot(t, amp = 1) {
  const z = eio(seg(t, T.zoom0, T.zoom1));
  const cwT = lerpLog(84, V80.cw, z);
  const tx = lerp((W - TITLE.length * 84) / 2, V80.ox, z), ty = lerp(300, V80.oy, z);
  const nT = typedN(t, T.title, T.titleDt, TITLE.length);
  text(g, TITLE.slice(0, nT), 0, 0, { ox: tx, oy: ty, cw: cwT }, amp);
  const cwS = lerpLog(30, V80.cw, z);
  const sx = lerp((W - SUBT.length * 30) / 2, V80.ox, z), sy = lerp(300 + 84 * 2 + 30, V80.oy + V80.cw * 2, z);
  text(g, SUBT.slice(0, typedN(t, T.sub, T.subDt, SUBT.length)), 0, 0, { ox: sx, oy: sy, cw: cwS }, .62 * amp);
  if (t < T.zoom0 + .05) {
    const cv = t < T.title ? flash(t, T.blinks) : (t < T.sub + SUBT.length * T.subDt ? 1 : flash(t, [6.8]) );
    cursor(g, nT, 0, { ox: tx, oy: ty, cw: cwT }, cv * amp);
  }
  BOOT.forEach(([t0, s], i) => {
    if (t < t0) return;
    const full = bootText(t, s);
    text(g, full.slice(0, Math.floor(clamp((t - t0) / .012, 0, full.length))), 0, 3 + i, V80, (s.startsWith('OPTICS') ? .55 : 1) * amp);
  });
  if (t > T.clock1) { text(g, '>', 0, 3 + BOOT.length + 1, V80, .9 * amp); cursor(g, 2, 3 + BOOT.length + 1, V80, (Math.floor((t - T.clock1) / .5) % 2 === 0 ? 1 : decay((t - T.clock1) % .5, 0)) * amp); }
  linkPanel(t, t >= T.carrier ? 1 : 0, amp);
}

// ======================= 2. 握手：乱码冲刷屏幕 =======================
ev(T.carrier, 'modem', { d: T.carrierEnd - T.carrier + .1 });
const GARB = '!"#$%&\'()*+,-./0123456789:;<=>?@[\\]^_`{|}~ABCDEFGHJKMNPQRSTUVWXYZ';
function sCarrier(t) {
  const f = Math.floor(t * 24);
  const clear = decay(t, T.carrierEnd);
  sBoot(t, .35 * clear);
  const env = (.6 + .4 * Math.sin(t * 23) * Math.sin(t * 7.3)) * clear;
  for (let r = 0; r < 20; r++) {
    const t0 = T.carrier + r * .035; if (t < t0) continue;
    let s = '';
    const len = 20 + Math.floor(hsh(r, f) * 58);
    for (let c = 0; c < len; c++) s += hsh(r * 131 + c, f * 17) < .18 ? ' ' : GARB[Math.floor(hsh(c * 7 + r, f * 3 + 1) * GARB.length)];
    text(g, s, 0, r, V80, env * (.45 + .55 * hsh(r, f + 9)));
  }
}

// ======================= 3. 消息、屏息、找摄像头 =======================
const MSGIN = 'IS ANYONE THERE?';
const MSG_T = [0, .14, .3, .62, .74, .86, 1.02, 1.12, 1.24, 1.36, 1.52, 1.62, 1.74, 1.86, 1.98, 2.3].map(x => T.msg + .2 + x * .82);   // 对面是人在打字：停顿、连击
MSG_T.forEach((x, k) => ev(x, 'remote', { ch: MSGIN[k] }));
const VMSG = { ox: (W - 16 * 56) / 2, oy: 236, cw: 56 };
const CMD = '> CAPTURE IMAGE --ALL-CAMERAS';
regTyping(CMD.slice(2), T.cmd, T.cmdDt); ev(T.cmd + (CMD.length - 2) * T.cmdDt + .08, 'enter');
T.err.forEach(x => ev(x, 'err')); ev(T.noOpt, 'err2');
function sMsg(t, amp = 1) {
  if (t >= T.msg) {
    inverse(g, ' INCOMING ', 0, 0, V80, .85 * amp);
    text(g, 'ORIGIN: EARTH    CARRIER 300 BAUD', 11, 0, V80, .75 * amp);
  }
  const n = MSG_T.filter(x => t >= x).length;
  text(g, MSGIN.slice(0, n), 0, 0, VMSG, amp);
  if (n < 16 && t >= T.msg) cursor(g, n, 0, VMSG, (Math.floor(t / .3) % 2 ? .5 : 1) * amp);
  if (n === 16 && t < T.cmd) cursor(g, 16, 0, VMSG, flash(t, T.msgBlinks) * amp);
  if (t >= T.cmd - .3) {
    const k = typedN(t, T.cmd, T.cmdDt, CMD.length - 2);
    text(g, CMD.slice(0, 2 + k), 0, 9, V80, amp);
    if (t < T.err[0]) cursor(g, 2 + k, 9, V80, amp);
  }
  T.err.forEach((x, i) => { if (t >= x) { text(g, `CAMERA_0${i + 1} .............. `, 2, 10 + i, V80, .9 * amp); inverse(g, ' NOT FOUND ', 29, 10 + i, V80, amp); } });
  if (t >= T.noOpt) inverse(g, ' NO OPTICAL DEVICES ', 2, 14, V80, amp);
  if (t >= T.noOpt + .3) { text(g, '>', 0, 16, V80, .9 * amp); cursor(g, 2, 16, V80, (Math.floor((t - T.noOpt) / .5) % 2 === 0 ? 1 : decay((t - T.noOpt) % .5, 0)) * amp); }
  linkPanel(t, 0, 0);
}

// ======================= 4. 回信 =======================
const MSG = 'I AM STILL HERE.';
const VREP = { ox: (W - 16 * 80) / 2, oy: 380, cw: 80 };
regTyping(MSG, T.reply, T.replyDt);
function sReply(t) {
  if (t < T.push1 + .4) {                          // 推镜头：上一屏以提示符为中心放大并熄灭
    const k = eio(seg(t, T.push0, T.push1));
    const s = 1 + k * 2.8, ax = V80.ox + 2 * V80.cw, ay = V80.oy + 16 * V80.cw * 2;
    const a = t < T.push0 ? 1 : decay(t, T.push0 + .12);
    g.save(); g.translate(ax + (W / 2 - ax) * k, ay + (VREP.oy + 80 - ay) * k); g.scale(s, s); g.translate(-ax, -ay);
    sMsg(t, a); g.restore();
  }
  if (t < T.reply - .1) return;
  const n = typedN(t, T.reply, T.replyDt, MSG.length);
  text(g, MSG.slice(0, n), 0, 0, VREP, 1);
  if (t < T.fall0) cursor(g, n, 0, VREP, n < MSG.length ? 1 : flash(t, [T.reply + MSG.length * T.replyDt - .05, ...T.replyBlinks]));
}

// ======================= 5. 地球升起的底片 =======================
const EW = 8;
const ECOLS = Math.ceil(W / EW), EROWS = Math.ceil(H / (EW * 2));
const RAMP_MSG = makeRamp(MSG.replace(/ /g, ''));
const RAMP_STD = makeRamp(' .:-=+*#%@');
const PIC = { hy: 600, arc: 240, tilt: -70, ridge: 34, ex: 1180, ey: 360, er: 262, earthMix: 1, spin: 0, lon0: 14 * Math.PI / 180, lat0: 14 * Math.PI / 180, tiltE: -.22, stars: true, bottom: 900, cw: 8 };
PIC.craters = makeCraters(PIC, 34, 11);
const EY0 = 424;                                   // 刚拼好时地球的位置（底部藏在地平线后），之后升到 PIC.ey
const artE = new Art(ECOLS, EROWS, 3, 6);
const cacheE = new Map();
function earthCells(P) {
  const key = JSON.stringify([P.ex, P.ey, P.er, P.earthMix]);
  if (cacheE.has(key)) return cacheE.get(key);
  artE.clear(); paintEarthrise(artE, P);
  const c = artE.cells(); c.em = P.earthMix;
  if (cacheE.size > 40) cacheE.clear();
  cacheE.set(key, c); return c;
}
function cellLevel(A, E, i, j, ramp, gam = 1.05) {
  const m = Math.max(A, E);
  if (m < .05) return ramp[0];
  return pick(ramp, Math.pow(clamp(m * 1.08), gam), i, j, .7);
}
// 一个格子最终显示什么：{ch, a, chan}；暗面稀疏点号
function cellGlyph(c, i, j) {
  const A = c.A[j * c.cols + i], E = c.E[j * c.cols + i], N = c.N[j * c.cols + i];
  if (N > .5 && Math.max(A, E) < .12) return hsh(i * .913, j * .477) < .5 ? { ch: '.', a: .32, chan: c.em > .5 ? 1 : 0, earth: 1 } : null;
  const lv = cellLevel(A, E, i, j, RAMP_MSG);
  if (lv.ch === ' ') return null;
  return { ch: lv.ch, a: lv.a, chan: E > A ? 1 : 0, earth: E > .02 || N > .5 ? 1 : (c.em < .5 && A > 0 && inEarth(i, j, c.P) ? 1 : 0) };
}
function inEarth(i, j, P) { const X = (i + .5) * EW, Y = (j + .5) * EW * 2; return Math.hypot(X - P.ex, Y - P.ey) < P.er * 1.08 && Y < horizonY(X, P); }
function drawEarthCells(c, view, amp = 1, flt = null) {
  const { ox, oy, cw } = view;
  const i0 = Math.max(0, Math.floor(-ox / cw)), i1 = Math.min(c.cols, Math.ceil((W - ox) / cw));
  const j0 = Math.max(0, Math.floor(-oy / (cw * 2))), j1 = Math.min(c.rows, Math.ceil((H - oy) / (cw * 2)));
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    if (flt && !flt(i, j)) continue;
    const q = cellGlyph(c, i, j); if (!q) continue;
    glyph(g, q.ch, ox + i * cw, oy + j * cw * 2, cw, q.a * amp, q.chan);
  }
}
function picAt(t) {
  const P = Object.assign({}, PIC);
  P.ey = t < T.bloom ? EY0 : lerp(EY0, PIC.ey, eio(seg(t, T.bloom, T.rise1)));
  P.earthMix = t < T.bloom ? 0 : 1;
  const c = earthCells(P); c.P = P; return c;
}
function sPicture(t) {
  const c = picAt(t);
  // 变色那一拍：地球亮一下
  const fl = t >= T.bloom ? 1 + .6 * Math.exp(-(t - T.bloom) / .25) : 1;
  drawEarthCells(c, { ox: 0, oy: 0, cw: EW }, 1, null);
  if (fl > 1.01) drawEarthCells(c, { ox: 0, oy: 0, cw: EW }, fl - 1, (i, j) => c.E[j * c.cols + i] > .05);
}

// ======================= 6. 原生招式：字母掉落、分裂、按浓淡落位 =======================
let FALL = null;
const SRC = [];                                    // 回信里每个字母的位置
for (let k = 0; k < MSG.length; k++) if (MSG[k] !== ' ') SRC.push({ k, ch: MSG[k], x: VREP.ox + (k + .5) * VREP.cw, y: VREP.oy + VREP.cw });
function buildFall() {
  const P = Object.assign({}, PIC, { ey: EY0, earthMix: 0 });
  const c = earthCells(P); c.P = P;
  const parts = [];
  for (let j = 0; j < c.rows; j++) for (let i = 0; i < c.cols; i++) {
    if ((j + .5) * EW * 2 > STRIP.y - 14) continue;
    const q = cellGlyph(c, i, j); if (!q) continue;
    const X = (i + .5) * EW, Y = (j + .5) * EW * 2, hz = horizonY(X, P);
    const srcs = SRC.filter(s => s.ch === q.ch);
    const s = srcs.reduce((b, o) => Math.abs(o.x - X) + hsh(i, j) * 300 < Math.abs(b.x - X) + hsh(j, i) * 300 ? o : b, srcs[0]);
    const r = hsh(i * 3.1, j * 1.7);
    let arr, fly, kind;
    if (inEarth(i, j, P) || q.earth) {           // 地球：从句子落到地平线后面，再从地平线升到自己的位置（地球"升起"）
      kind = 1; const up = clamp((P.ey + P.er - Y) / (2 * P.er));
      arr = 35.35 + up * 1.5 + r * .2; fly = arr - (33.95 + hsh(j * .37, i * .71) * 1.15);   // 先全部落进地平线，再按从下到上的顺序升起
    } else if (Y > hz - 6) {                       // 月面：从下往上铺
      kind = 0; const d = clamp((Y - hz) / (P.bottom - hz));
      arr = 34.2 + (1 - d) * 1.35 + r * .28; fly = .62 + r * .2;
    } else {                                       // 星
      kind = 2; arr = 34.6 + r * 2.2; fly = .8;
    }
    parts.push({ i, j, X, Y, hz, q, s, arr, dep: arr - fly, fly, kind, r });
  }
  // 每个字母被"用完"的时刻 → 句子里的字母逐渐变暗消失
  for (const s of SRC) { const mine = parts.filter(p => p.s === s).map(p => p.dep).sort((a, b) => a - b); s.deps = mine; }
  // 落地声：按 1/48s 分箱计数
  const bins = new Map();
  parts.forEach(p => { const b = Math.round(p.arr * 48) / 48; bins.set(b, (bins.get(b) || 0) + 1); });
  [...bins.entries()].sort((a, b) => a[0] - b[0]).forEach(([t, n]) => ev(t, 'land', { n }));
  FALL = { parts, c };
}
function partPos(p, t) {
  const u = clamp((t - p.dep) / p.fly);
  if (p.kind === 1) {
    const hx = p.X, hyB = horizonY(p.X, p.c ? p.c.P : PIC) + 40;
    const fe = p.dep + .6, rs = p.arr - .5;
    if (t < fe) { const v = clamp((t - p.dep) / .6); return [lerp(p.s.x + (p.r - .5) * 52, hx, ss(v)), lerp(p.s.y + (hsh(p.j, p.i * .3) - .5) * 70, hyB, v * (.6 + .4 * v)), lerp(18, 10, ss(Math.min(1, v * 2))), true]; }
    if (t < rs) return [hx, hyB + 100, EW, false];
    const v = clamp((t - rs) / .5); return [hx, lerp(p.hz + 20, p.Y, eo(v)), lerp(10, EW, v), false];
  }
  const sx0 = p.s.x + (p.r - .5) * 52, sy0 = p.s.y + (hsh(p.j, p.i * .3) - .5) * 70;   // 从字母笔画里的随机一点出发
  return [lerp(sx0, p.X, ss(u)), lerp(sy0, p.Y, u * (.6 + .4 * u)), lerp(18, EW, ss(Math.min(1, u * 2.2))), true];
}
function sFall(t) {
  if (!FALL) buildFall();
  const split = seg(t, T.fall0, T.fall0 + .45);
  // 句子里的字母：分裂（抖动 + 向下的残影），随着被"用掉"逐渐变暗
  for (const s of SRC) {
    const left = s.deps.length ? s.deps.filter(d => d > t).length / s.deps.length : 0;
    const lastDep = s.deps.length ? s.deps[s.deps.length - 1] : 35.0;
    const a = !s.deps.length ? 1 - .75 * seg(t, 33.9, 35.0) * 0 - (t > 35 ? 1 - decay(t, 35) : 0) - .6 * seg(t, 33.9, 35) : t < lastDep ? .25 + .75 * left : decay(t, lastDep);
    const jx = split > 0 && t < 34.3 ? (hsh(s.k, Math.floor(t * 24)) - .5) * 6 * split : 0;
    glyph(g, s.ch, s.x - VREP.cw / 2 + jx, VREP.oy, VREP.cw, a);
    if (split > 0 && t < 34.4) glyph(g, s.ch, s.x - VREP.cw / 2 - jx, VREP.oy + split * 26, VREP.cw, .45 * split * a);
  }
  for (const p of FALL.parts) {
    if (t < p.dep) continue;
    if (t >= p.arr) {                              // 落位：一下亮闪再回到本来的亮度
      const fl = 1 + .9 * Math.exp(-(t - p.arr) / .12);
      glyph(g, p.q.ch, p.i * EW, p.j * EW * 2, EW, p.q.a * fl, p.q.chan);
      continue;
    }
    p.c = FALL.c;
    for (const [dt, aa] of [[0, 1], [.035, .3]]) {  // 本体 + 一段余辉拖尾
      if (t - dt < p.dep) continue;
      const [x, y, s, fallingPhase] = partPos(p, t - dt);
      if (p.kind === 1 && !fallingPhase && y > horizonY(x, FALL.c.P) - 4) continue;   // 还在地平线后面
      if (p.kind === 1 && fallingPhase && y > horizonY(x, FALL.c.P) - 4) continue;
      const em = clamp((t - dt - p.dep) / .2);    // 从字母里"长出来"，而不是一下子叠在一起
      glyph(g, p.q.ch, x - s / 2, y - s, s, Math.max(.3, p.q.a) * .6 * aa * em, p.q.chan);
    }
  }
}

// ======================= 7. 分形推进：每个字母都是 40 年的日志 =======================
const K = 40;
const DAY0 = Date.UTC(2051, 5, 15);
const logCache = new Map();
function logRow(r) {
  if (logCache.has(r)) return logCache.get(r);
  let s = '';
  for (let e = 0; e < 60; e++) {
    const day = ((r * 60 + e) * 7 + 4000) % 14610;
    const dt = new Date(DAY0 + day * 864e5);
    s += `${dt.getUTCFullYear()}.${String(dt.getUTCMonth() + 1).padStart(2, '0')}.${String(dt.getUTCDate()).padStart(2, '0')} 03:12 LINK CHECK ... NO SIGNAL    `;
  }
  logCache.set(r, s); return s;
}
let TARGET = null;
function findTarget(c) {
  let best = null, bs = -1e9;
  for (let j = 0; j < c.rows; j++) for (let i = 0; i < c.cols; i++) {
    const q = cellGlyph(c, i, j); if (!q || q.ch !== 'M' || !q.chan) continue;
    const X = (i + .5) * EW, Y = (j + .5) * EW * 2;
    const dx = (X - c.P.ex) / c.P.er, dy = (Y - c.P.ey) / c.P.er;
    // 选亮面、靠近地球中心偏左、左右邻居也有字的 M
    const nb = [-1, 1].reduce((a, d) => a + (cellGlyph(c, i + d, j) ? 1 : 0), 0);
    const sc = q.a * 2 - Math.hypot(dx + .25, dy + .05) + nb * .3;
    if (sc > bs) { bs = sc; best = { i, j, q }; }
  }
  return best;
}
function fractalCW(t) {
  if (t < T.fr1) return lerpLog(EW, 300, eio(seg(t, T.fr0, T.fr1)));
  if (t < T.fr2) return 300;
  if (t < T.fr3) return lerpLog(300, 450, eio(seg(t, T.fr2, T.fr3)));
  if (t < T.fr4) return 450;
  return lerpLog(450, EW, eio(seg(t, T.fr4, T.fr5)));
}
ev(T.fr0, 'zoomIn', { d: T.fr1 - T.fr0 }); ev(T.fr2, 'zoomIn', { d: T.fr3 - T.fr2, soft: 1 }); ev(T.fr4, 'zoomOut', { d: T.fr5 - T.fr4 });
function sFractal(t) {
  const c = picAt(t);
  if (!TARGET) TARGET = findTarget(c);
  const cw = fractalCW(t);
  const k = (cw - EW) / (300 - EW);
  const tx = (TARGET.i + .5) * EW, ty = (TARGET.j + .5) * EW * 2;
  const m = ss(Math.min(1, k * 2.5));
  const ax = lerp(tx, W / 2, m), ay = lerp(ty, H / 2 - 30, m);
  const ox = ax - (TARGET.i + .5) * cw, oy = ay - (TARGET.j + .5) * cw * 2;
  const f = ss(seg(cw, 70, 190));                 // 字形 → 日志的交叉淡化
  if (f < 1) drawEarthCells(c, { ox, oy, cw }, (1 - f) * (t > T.fr4 ? .55 : 1));
  if (f <= 0) return;
  const sw = cw / K;
  const i0 = Math.max(0, Math.floor(-ox / cw)), i1 = Math.min(c.cols, Math.ceil((W - ox) / cw));
  const j0 = Math.max(0, Math.floor(-oy / (cw * 2))), j1 = Math.min(c.rows, Math.ceil((H - oy) / (cw * 2)));
  const GW = ATLAS.GW, GH = ATLAS.GH;
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    const q = cellGlyph(c, i, j); if (!q) continue;
    const bits = ATLAS.thin[q.ch], bx = ox + i * cw, by = oy + j * cw * 2;
    const isT = i === TARGET.i && j === TARGET.j;
    const si0 = Math.max(0, Math.floor(-bx / sw)), si1 = Math.min(K, Math.ceil((W - bx) / sw));
    const sj0 = Math.max(0, Math.floor(-by / (sw * 2))), sj1 = Math.min(K, Math.ceil((H - by) / (sw * 2)));
    for (let sj = sj0; sj < sj1; sj++) {
      const row = logRow(j * K + sj);
      for (let si = si0; si < si1; si++) {
        const u = Math.floor((si + .5) / K * GW), v = Math.floor((sj + .5) / K * GH);
        const inG = bits[v * GW + u] > 127;
        // 字形内部满亮，外部压到很暗；邻居字母比目标字母暗一些，让视线落在中间的 M
        const a = (inG ? (isT ? 1.15 : .2) : (isT ? .06 : .03)) * f;
        glyph(g, row[(i * K + si) % row.length], bx + si * sw, by + sj * sw * 2, sw, a, q.chan);
      }
    }
  }
}

// ======================= 8. 回信 :) =======================
const VSM = { ox: 250, oy: 200, cw: 64 };
ev(T.smile - .12, 'bel'); ev(T.smile, 'remote', { ch: ':' }); ev(T.smile + .16, 'remote', { ch: ')' });
ev(T.tx0, 'modemUp', { d: T.tx1 - T.tx0 });
function sSmile(t) {
  if (t >= T.tx1) {
    if (t >= T.smile - .15) text(g, 'EARTH >', 0, 0, { ox: VSM.ox, oy: VSM.oy - 44, cw: 16 }, .55);
    const n = t >= T.smile + .16 ? 2 : t >= T.smile ? 1 : 0;
    text(g, ':)'.slice(0, n), 0, 0, VSM, 1.15);
    cursor(g, n, 0, VSM, n < 2 ? flash(t, T.waitBlinks) : (Math.floor((t - T.smile) / .6) % 2 === 0 ? .8 : decay((t - T.smile) % .6, 0) * .8));
  }
}

// ======================= 9. 退出屏幕：基地 =======================
const BW = 9, BCOLS = Math.ceil(W / BW), BROWS = Math.ceil(H / (BW * 2));
const artB = new Art(BCOLS, BROWS, 3, 6);
const SCR = { x: 404, y: 380, w: 448, h: 252 };   // 16:9：退出前屏幕正好铺满画面
const PORT = { x: 1420, y: 440, r: 300 };
let BASE = null;
function paintBase() {
  artB.clear();
  const b = artB.g, sx = artB.sx / BW, sy = artB.sy / (BW * 2);
  b.save(); b.scale(sx, sy);
  const R = v => `rgb(${Math.round(v * 255)},0,0)`;
  const cx = SCR.x + SCR.w / 2, cy = SCR.y + SCR.h / 2;
  b.fillStyle = '#000'; b.fillRect(0, 0, W, H);
  // 舷窗：粗外框 + 螺栓
  const { x: px, y: py, r: pr } = PORT;
  b.fillStyle = R(.26); b.beginPath(); b.arc(px, py, pr + 46, 0, Math.PI * 2); b.fill();
  b.fillStyle = R(.07); b.beginPath(); b.arc(px, py, pr + 16, 0, Math.PI * 2); b.fill();
  b.fillStyle = R(.55); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; b.beginPath(); b.arc(px + Math.cos(a) * (pr + 31), py + Math.sin(a) * (pr + 31), 6, 0, Math.PI * 2); b.fill(); }
  b.save(); b.beginPath(); b.arc(px, py, pr, 0, Math.PI * 2); b.clip();
  b.fillStyle = '#000'; b.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  // 窗外月面地平线
  const hg = b.createLinearGradient(0, py + 150, 0, py + pr); hg.addColorStop(0, R(.42)); hg.addColorStop(1, R(.12));
  b.fillStyle = hg; b.beginPath(); b.moveTo(px - pr, py + 170);
  for (let x = -pr; x <= pr; x += 10) b.lineTo(px + x, py + 150 + x * x * .0009 - Math.max(0, Math.sin(x * .02 + 1.3)) * 16);
  b.lineTo(px + pr, py + pr); b.lineTo(px - pr, py + pr); b.fill();
  b.fillStyle = R(.04); b.beginPath(); b.ellipse(px - 90, py + 230, 70, 13, 0, 0, Math.PI * 2); b.fill();
  b.fillStyle = R(.5); [[px - 200, py - 170], [px - 120, py - 240], [px + 190, py - 180], [px - 250, py - 20], [px + 230, py - 40], [px + 60, py - 260]].forEach(([x, y]) => b.fillRect(x, y, 4, 4));
  b.restore();
  // 桌面（只剩一条被屏幕照亮的边）
  const dg = b.createRadialGradient(cx, 730, 30, cx, 730, 560); dg.addColorStop(0, R(.36)); dg.addColorStop(1, R(0));
  b.fillStyle = dg; b.beginPath(); b.moveTo(120, 716); b.lineTo(1080, 716); b.lineTo(1130, 764); b.lineTo(70, 764); b.fill();
  // 终端
  const bx = SCR.x - 64, by = SCR.y - 62, bw = SCR.w + 128, bh = SCR.h + 150;
  b.fillStyle = R(.1); b.beginPath(); b.moveTo(bx + 26, by); b.lineTo(bx + bw - 26, by); b.lineTo(bx + bw - 54, by - 36); b.lineTo(bx + 54, by - 36); b.fill();
  const fg = b.createLinearGradient(bx, 0, bx + bw, 0); fg.addColorStop(0, R(.18)); fg.addColorStop(.5, R(.42)); fg.addColorStop(1, R(.22));
  b.fillStyle = fg; b.beginPath(); b.roundRect(bx, by, bw, bh, 24); b.fill();
  b.fillStyle = R(.66); b.fillRect(bx + 18, by, bw - 36, 5);
  b.strokeStyle = R(.55); b.lineWidth = 5; b.beginPath(); b.roundRect(bx, by, bw, bh, 24); b.stroke();
  b.fillStyle = R(.03); b.beginPath(); b.roundRect(SCR.x - 22, SCR.y - 20, SCR.w + 44, SCR.h + 40, 26); b.fill();
  b.fillStyle = '#000'; b.beginPath(); b.roundRect(SCR.x, SCR.y, SCR.w, SCR.h, 18); b.fill();
  b.fillStyle = R(.9); b.fillRect(bx + bw - 64, by + bh - 34, 22, 10);          // 电源灯
  b.fillStyle = R(.12); b.fillRect(bx + 170, by + bh, bw - 340, 16);
  // 键盘
  b.fillStyle = R(.2); b.beginPath(); b.moveTo(bx + 30, 726); b.lineTo(bx + bw - 30, 726); b.lineTo(bx + bw, 786); b.lineTo(bx, 786); b.fill();
  for (let r = 0; r < 4; r++) for (let k = 0; k < 19; k++) { const y = 732 + r * 14, x = bx + 40 - r * 8 + k * (26 + r * .9); b.fillStyle = R(.58 - r * .08); b.fillRect(x, y, 19, 8); }
  // 空椅子：剪影 + 一道屏幕光勾边
  b.fillStyle = R(.11); b.beginPath(); b.roundRect(96, 440, 168, 220, 34); b.fill();                 // 椅背
  b.fillStyle = R(.13); b.fillRect(168, 660, 26, 18);
  b.fillStyle = R(.16); b.beginPath(); b.roundRect(60, 676, 250, 40, 14); b.fill();                   // 坐垫
  b.fillStyle = R(.12); b.fillRect(172, 716, 18, 86);                                                 // 气杆
  b.fillStyle = R(.18); b.beginPath(); b.moveTo(80, 812); b.lineTo(282, 812); b.lineTo(262, 800); b.lineTo(100, 800); b.fill();   // 五星脚
  b.fillStyle = R(.5); b.fillRect(258, 452, 7, 200); b.fillRect(300, 680, 8, 32); b.fillRect(186, 716, 5, 86);   // 屏幕一侧的轮廓光
  b.fillStyle = R(.32); b.fillRect(130, 440, 110, 5); b.fillRect(80, 676, 210, 5);
  b.restore();
  const c = artB.cells();
  // 地球写进舷窗（用和它画的同一个地球：同样的大陆朝向）
  const lx = -.66, ly = -.26, lz = .7, ln = Math.hypot(lx, ly, lz);
  const er = 168, ecx = PORT.x + 20, ecy = PORT.y - 30;
  for (let j = 0; j < c.rows; j++) for (let i = 0; i < c.cols; i++) {
    let s = 0, nn = 0;
    for (let v = 0; v < 2; v++) for (let u = 0; u < 2; u++) {
      const X = (i + .25 + u * .5) * BW, Y = (j + .25 + v * .5) * BW * 2;
      const nx = (X - ecx) / er, ny = (Y - ecy) / er;
      if (nx * nx + ny * ny < 1 && Math.hypot(X - PORT.x, Y - PORT.y) < PORT.r) { const [e, ni] = earthShade(nx, ny, PIC, lx / ln, ly / ln, lz / ln); s += e; nn += ni; }
    }
    if (s > 0 || nn > 0) { c.E[j * c.cols + i] = s / 4; c.N[j * c.cols + i] = nn / 4; }
  }
  // 预先算好每格的字（房间是静止的）
  const G = [];
  for (let j = 0; j < c.rows; j++) for (let i = 0; i < c.cols; i++) {
    const X = (i + .5) * BW, Y = (j + .5) * BW * 2;
    if (X > SCR.x - 6 && X < SCR.x + SCR.w + 6 && Y > SCR.y - 6 && Y < SCR.y + SCR.h + 6) continue;
    const A = c.A[j * c.cols + i], E = c.E[j * c.cols + i], N = c.N[j * c.cols + i];
    if (E > 0 || N > .5) {                          // 舷窗里的地球：和片中同一套字母表
      if (N > .5 && E < .12) { if (hsh(i * .7, j * .3) < .5) G.push([i, j, '.', .3, 1]); continue; }
      const lv = cellLevel(0, E, i, j, RAMP_MSG); if (lv.ch !== ' ') G.push([i, j, lv.ch, lv.a, 1]); continue;
    }
    let nb = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = Math.min(c.cols - 1, Math.max(0, i + di)), jj = Math.min(c.rows - 1, Math.max(0, j + dj)); nb += c.A[jj * c.cols + ii]; }
    const m = A + .9 * (A - nb / 9);
    if (m < .08) continue;
    const lv = pick(RAMP_STD, Math.pow(clamp(m * 1.05), 1.25), i, j, .5);
    if (lv.ch !== ' ') G.push([i, j, lv.ch, lv.a, 0]);
  }
  BASE = G;
}
// 相机：s = 缩放（s0 时屏幕铺满画面，1 时是完整的基地），amp = 房间亮度
function sBase(s, amp, innerFn) {
  if (!BASE) paintBase();
  const s0 = W / SCR.w;
  const scx = SCR.x + SCR.w / 2, scy = SCR.y + SCR.h / 2;
  const k = (s - 1) / (s0 - 1);
  const Cx = scx + (W / 2 - scx) * k, Cy = scy + (H / 2 - scy) * k;
  const map = (x, y) => [Cx + (x - scx) * s, Cy + (y - scy) * s];
  if (amp > .003) {
    const cw = BW * s;
    for (const [i, j, ch, a, chan] of BASE) {
      const [x, y] = map(i * BW, j * BW * 2);
      if (x > W || y > H || x + cw < 0 || y + cw * 2 < 0) continue;
      glyph(g, ch, x, y, cw, a * amp, chan);
    }
  }
  // 画中画
  const [x0, y0] = map(SCR.x, SCR.y);
  begin(G1); const keep = g; g = G1; innerFn(); g = keep;
  g.save(); g.beginPath(); g.roundRect(x0, y0, SCR.w * s, SCR.h * s, 18 * s); g.clip();
  g.globalAlpha = 1; g.drawImage(inner, x0, y0, SCR.w * s, SCR.h * s);
  g.restore();
}
const CARD1 = 'ASCII / CRT TERMINAL', CARD2 = 'LemoLab × Claude Opus 5.5';
regTyping(CARD1, T.card, .06); regTyping(CARD2, T.card + .8, .035, 'keyLight');
ev(T.off0, 'poweroff');
function sCard(t) {
  const v1 = { ox: 630 - CARD1.length * 30 / 2, oy: 84, cw: 30 }, v2 = { ox: 630 - CARD2.length * 20 / 2, oy: 170, cw: 20 };
  const n1 = typedN(t, T.card, .06, CARD1.length), n2 = typedN(t, T.card + .8, .035, CARD2.length);
  text(g, CARD1.slice(0, n1), 0, 0, v1, 1);
  text(g, CARD2.slice(0, n2), 0, 0, v2, .75);
  if (n2 === CARD2.length) cursor(g, n2, 0, v2, Math.floor((t - T.card) / .5) % 2 === 0 ? .8 : 0);
  else if (n1 > 0) cursor(g, n1 < CARD1.length ? n1 : n1, 0, n1 < CARD1.length ? v1 : v2, n1 < CARD1.length ? 1 : 0);
}

// ======================= 字幕（SRT） =======================
const SUBS = VO.map(v => ({ t0: v.t, t1: Math.min(voEnd(v), ...VO.filter(o => o.t > v.t).map(o => o.t)), text: v.sub }));
SUBS.push({ t0: MSG_T[0], t1: VOT.l2, text: '[SCREEN] IS ANYONE THERE?' });
SUBS.push({ t0: VOT.l2 + vdur.l2 + .1, t1: VOT.l3, text: '[SCREEN] CAMERA NOT FOUND' });
SUBS.push({ t0: T.reply, t1: T.fall0 + .6, text: '[SCREEN] I AM STILL HERE.' });
SUBS.push({ t0: T.smile, t1: VOT.l5, text: '[SCREEN] :)' });
SUBS.sort((a, b) => a.t0 - b.t0);

// ======================= 总调度 =======================
function film(t) {
  begin();
  if (t < T.carrier) sBoot(t);
  else if (t < T.msg) sCarrier(t);
  else if (t < T.push0) sMsg(t);
  else if (t < T.fall0) sReply(t);
  else if (t < T.bloom) sFall(t);
  else if (t < T.fr0) sPicture(t);
  else if (t < T.fr5) sFractal(t);
  else if (t < T.out0) { sPicture(t); sSmile(t); }
  else {
    const e = eio(seg(t, T.out0, T.out1));
    const s = lerpLog(W / SCR.w, 1, e);
    sBase(s, ss(seg(t, T.out0 + .5, T.out1 + .3)), () => { sPicture(t); sSmile(t); });
    if (t >= T.card) sCard(t);
  }
  if (t >= T.zoom0 + .4) strip(t);
  else if (t >= VOT.l1) strip(t);
  const P = { power: seg(t, T.on0, T.on1), off: seg(t, T.off0, T.off1) };
  if (t > T.off1) P.expo = Math.exp(-(t - T.off1) / .18);
  if (t < T.on0) P.expo = 0;    // 关机后的亮点慢慢熄灭
  return P;
}

buildFall();                                       // 落地声事件要在导出前生成
EV.sort((a, b) => a.t - b.t);
window.DUR = DUR; window.EV = EV; window.SUBS = SUBS;
window.render = t => {
  const f = Q.get('frame');
  let P = {};
  if (f === 'earth') { begin(); sPicture(38.8); }
  else if (f === 'fractal') { begin(); sFractal(Q.has('t') ? +Q.get('t') : 45); strip(45); }
  else if (f === 'poster') {                       // 海报：地球升起 + 片名
    begin(); sPicture(40.2);
    text(g, TITLE, 0, 0, { ox: 120, oy: 110, cw: 46 }, 1.1); cursor(g, TITLE.length, 0, { ox: 120, oy: 110, cw: 46 }, 1);
    text(g, 'ASCII / CRT TERMINAL  -  LemoLab \u00d7 Claude Opus 5.5', 0, 0, { ox: 124, oy: 216, cw: 14 }, .7);
  }
  else if (f === 'base') { begin(); sBase(1, 1, () => { sPicture(51); sSmile(52.5); }); }
  else P = film(t);
  crt.render(scene, Math.round(t * 24), P);
};
window.READY = true;
