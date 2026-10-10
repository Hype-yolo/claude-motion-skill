// main.js — 《The Last Save Point》导演脚本：按 timeline.json 排镜头、转场、调色板、事件（EV）与字幕（SUBS）
import { W, H, FB, C, T, GBI, LUT, makeOut, mosaic, darken, whiten, bayer, bayer8, clamp, ss, eio, eo } from './px.js';
import { corridor, doorScene, CORR, FLOOR, DOOR } from './scenes.js';
import { village, blitHalf, half, campfire, battle, battleUI, BATTLE, thumbVillage, thumbCamp, thumbBattle, thumbNow, titleCard, endCard } from './memscenes.js';
import { dialog, battleMsg, saveMenu, fileList, statusWin, savingWin, saveCompleteWin, win, LIST } from './ui.js';
import { portraitArlo, portraitWren8 } from './portraits.js';
import { text, textW, textOutlined as textOutlinedImport } from './font.js';

const q = new URLSearchParams(location.search);
const NOSUB = q.has('nosub');
const fb = new FB(), out = makeOut(document.getElementById('c'));
const TL = await (await fetch('./timeline.json')).json();
const LINES = await (await fetch('./lines.json')).json();
const VDUR = await (await fetch('./voices/dur.json')).json();
const LINE = Object.fromEntries(LINES.map(l => [l.id, l]));
const vo = id => ({ t0: TL.vo[id].t, t1: TL.vo[id].t + VDUR[id], expr: TL.vo[id].expr, text: LINE[id].sub || LINE[id].text });

// —— 存档位 ——
const FILES = [
  { label: 'FILE 1', place: 'HOLLOWMERE', time: '00:12', thumb: thumbVillage, lut: LUT.gb4 },
  { label: 'FILE 2', place: 'EMBER RIDGE', time: '23:48', thumb: thumbCamp, lut: LUT.nes },
  { label: 'FILE 3', place: 'ASHFALL KEEP', time: '51:09', thumb: thumbBattle, lut: LUT.full },
];
const WREN_LINE = 'Cold? Here. Nothing finds you if we share it.';

// ———————————————— 事件与字幕（混音 / srt 用）————————————————
const EV = [], SUBS = [];
const ev = (t, type, o = {}) => EV.push({ t: +t.toFixed(3), type, ...o });
function typing(t0, s, cps, type, every = 2) { let k = 0; for (let i = 0; i < s.length; i++) { if (s[i] === ' ') continue; if (k++ % every === 0) ev(t0 + i / cps, type, { ch: i }); } }
for (const id of ['vo1', 'vo2', 'vo4', 'vo5', 'vo6']) { const v = vo(id); ev(v.t0, 'vo', { id }); }
// 字幕区间（≥ 语音 + 0.6，且 ≥ 1.8）
const box = (t0, t1, s) => { SUBS.push({ t0, t1, text: s }); return { t0, t1, text: s }; };
const B = {};
{ const v = vo('vo1'); B.vo1 = box(v.t0 - .1, Math.max(v.t1 + .6, v.t0 + 1.8), v.text); }
{ const v = vo('vo2'); B.vo2 = box(v.t0 - .1, Math.max(v.t1 + .6, v.t0 + 1.8), v.text); }
B.wren = box(19.48, 23.9, WREN_LINE);
B.ward = box(26.95, 28.9, 'WREN used WARD!');
B.fell = box(29.9, 32.05, 'WREN fell.');
{ const v = vo('vo4'); B.vo4 = box(v.t0 - .1, Math.min(35.45, Math.max(v.t1 + .6, v.t0 + 1.8)), v.text); }
{ const v = vo('vo5'); B.vo5 = box(v.t0 - .1, Math.max(v.t1 + .6, v.t0 + 1.8), v.text); }
{ const v = vo('vo6'); B.vo6 = box(v.t0 - .1, Math.min(49.4, Math.max(v.t1 + .6, v.t0 + 1.8)), v.text); }
// 拟音事件
ev(0, 'chime'); ev(0, 'bed', { name: 'hum', t1: 10.4, gain: .5 });
for (let s = 0.25; s < 7.5; s += .25) ev(s, 'step', { v: .6 + .4 * Math.sin(s * 3) ** 2 });
ev(7.5, 'flare'); ev(8.0, 'open'); ev(8.75, 'select'); ev(8.8, 'slide'); ev(9.5, 'cursor'); ev(10.25, 'select'); ev(10.25, 'mosaic', { up: 1 });
for (let s = 11.125; s < 15.6; s += .25) ev(s, 'step4');
ev(17.6, 'mosaic', { up: 0 });
ev(18.0, 'bed', { name: 'fire', t1: 25.4, gain: .8 }); ev(19.48, 'open8'); typing(19.55, WREN_LINE, 30, 'blipW');
ev(22.44, 'cloth');
ev(26.95, 'openUI'); typing(26.95, 'WREN used WARD!', 45, 'blipUI'); ev(27.0, 'hop'); ev(27.325, 'ward'); ev(27.7, 'charge', { t1: 29.2 }); ev(29.2, 'blast');
for (let s = 29.3; s < 29.7; s += .05) ev(s, 'tick'); ev(29.7, 'thud');
for (let s = 30.1; s < 31.0; s += 1 / 6) ev(s, 'koblink'); typing(29.9, 'WREN fell.', 45, 'blipUI', 3);
[31.0, 31.9, 32.8, 33.7].forEach((s, i) => ev(s, 'bitdrop', { k: i }));
ev(35.5, 'bed', { name: 'hum', t1: 41.9, gain: .45 });
ev(36.2, 'slide'); ev(36.9, 'cursor'); ev(37.4, 'cursor'); ev(38.9, 'cursor'); ev(39.4, 'select');
for (let s = 39.45; s < 40.3; s += .09) ev(s, 'savetick'); ev(40.3, 'sparkle');
ev(41.9, 'bed', { name: 'wind', t1: 49.5, gain: .6 });
ev(44.7, 'breath', { d: 1.0 });
ev(45.55, 'stepB'); ev(45.8, 'stepB'); ev(46.0, 'grind', { t1: 49.2 }); ev(47.5, 'flood');
for (let i = 0; i < 6; i++) ev(47.6 + i * .13, 'ignite', { pan: i % 2 ? .5 : -.5 });
ev(48.7, 'stepB'); ev(49.05, 'stepB'); ev(48.9, 'swell', { t1: 49.5 });
ev(51.2, 'cursor');
window.EV = EV; window.SUBS = SUBS;

// ———————————————— 分镜函数 ————————————————
const heroX = t => t < 7.5 ? 70 + 30 * t : CORR.heroStop;
const heroPose = t => t < 7.5 ? 'walk' + (Math.floor(t * 8) % 4) : (t < 8.3 ? 'lookup' : 'idle');
const camA = t => Math.round(99 * eio(clamp((t - .4) / 7.1, 0, 1)));
const inBox = (b, t) => t >= b.t0 && t < b.t1;
function drawDialog(b, t, expr, skin = 'snes', portrait) {
  if (NOSUB || !inBox(b, t)) return;
  dialog(fb, { skin, portrait: portrait === null ? null : (portrait || portraitArlo(expr)), text: b.text, t: t - b.t0 - .1, cps: skin === 'nes' ? 30 : 40 });
}
function listSlide(t, t0) { return Math.round(-190 * (1 - eo(clamp((t - t0) / .3, 0, 1)))); }

// 现在 · 走廊 + 存档（t < 10.25 或 35.5 ≤ t < 41.9）
function shotCorridor(t, regionsOut) {
  const late = t >= 35.5;
  const flare = !late && t > 7.5 && t < 8.3 ? 6 * (1 - (t - 7.5) / .8) : late && t > 40.3 && t < 41.2 ? 8 * (1 - (t - 40.3) / .9) : 0;
  const hero = late ? { x: CORR.heroStop, pose: 'idle', flare } : { x: heroX(t), pose: heroPose(t), flare };
  corridor(fb, t, late ? 99 : camA(t), hero);
  if (!late) {
    if (t >= 1.5 && t < 5.2) titleCard(fb, t < 2.4 ? (t - 1.5) / .9 : t > 4.6 ? 1 - (t - 4.6) / .6 : 1);
    drawDialog(B.vo1, t, 'wistful');
    if (t >= 8.0 && t < 9.1) saveMenu(fb, 236, 40, t, t >= 8.75);
    if (t >= 8.75) {
      const dx = listSlide(t, 8.75);
      const tmp = new FB(); tmp.clear(T);
      const regs = fileList(tmp, FILES, 0, t, { bob: t < 10.25 });
      fb.copy(tmp, 0, 0, W, H, dx, 0);
      regs.forEach(r => regionsOut.push({ ...r, x: r.x + dx }));
    }
  } else {
    // 回到现在：存档位上的犹豫
    if (t >= 36.2) {
      const cur = t < 36.9 ? 0 : t < 37.4 ? 0 + ss(36.9, 37.02, t) : t < 38.9 ? 1 + ss(37.4, 37.52, t) : 2 + ss(38.9, 39.02, t);
      const saved = t >= 40.3;
      const tmp = new FB(); tmp.clear(T);
      const regs = fileList(tmp, FILES, cur, t, { bob: t < 37.4 || t > 38.9, newThumb: saved ? (f, x, y) => thumbNow(f, x, y, t) : null, newLut: LUT.faded, newLabel: saved ? 'FILE 4  LAST DOOR' : 'NEW FILE' });
      const dx = listSlide(t, 36.2);
      fb.copy(tmp, 0, 0, W, H, dx, 0);
      regs.forEach(r => regionsOut.push({ ...r, x: r.x + dx }));
      if (t >= 39.4 && t < 40.3) savingWin(fb, clamp((t - 39.4) / .85, 0, 1), t);
      if (t >= 40.3) saveCompleteWin(fb, t - 40.3);
    }
  }
}
// 回忆三 · 战斗
function battleState(t) {
  const lt = t - 26.2, st = { wrenVis: true, arloPose: 'ready' };
  if (t < 26.95) { st.wrenX = BATTLE.wrenX0; st.wrenPose = 'idle'; }
  else if (t < 27.25) { const u = (t - 26.95) / .3; st.wrenX = BATTLE.wrenX0 + (BATTLE.wrenX1 - BATTLE.wrenX0) * eo(u); st.wrenPose = 'walk' + (Math.floor(t * 12) % 4); }
  else if (t < 29.2) { st.wrenX = BATTLE.wrenX1; st.wrenPose = 'cast'; }
  else { st.wrenX = BATTLE.wrenX1; st.wrenPose = 'kneel'; }
  st.ward = t >= 27.325 && t < 29.2 ? clamp((t - 27.325) / .2, 0, 1) : 0;
  st.charge = t >= 27.7 && t < 29.2 ? (t - 27.7) / 1.5 : 0;
  st.beam = t >= 29.2 && t < 29.4 ? 1 - (t - 29.2) / .2 : 0;
  if (t >= 29.2 && t < 29.8) st.arloPose = 'hurt'; else if (t >= 29.8) st.arloPose = 'idle';
  if (t >= 30.1 && t < 31.0) st.blink = Math.floor((t - 30.1) * 12) % 2 === 0;
  if (t >= 31.0) st.wrenVis = false;
  st.scarfOnly = t >= 30.6;
  return st;
}
function shotBattle(t) {
  battle(fb, t, t - 26.2, battleState(t));
  if (!NOSUB) {
    if (inBox(B.ward, t)) battleMsg(fb, B.ward.text, t - B.ward.t0);
    if (inBox(B.fell, t)) battleMsg(fb, B.fell.text, t - B.fell.t0);
  }
  const hp = t < 29.3 ? 12 : Math.max(0, Math.round(12 * (1 - (t - 29.3) / .4)));
  if (t < 32.1) battleUI(fb, win, hp, t >= 29.7);
  drawDialog(B.vo4, t, 'sad');
}
function battleLUT(t) { return t < 31.0 ? LUT.full : t < 31.9 ? LUT.c16 : t < 32.8 ? LUT.c8 : t < 33.7 ? LUT.c4 : t < 34.6 ? LUT.c2 : LUT.faded; }
// 最终之门
function doorState(t) {
  const TOPY = -386, camY = t < 42.1 ? 0 : t < 43.3 ? TOPY * eio((t - 42.1) / 1.2) : t < 43.9 ? TOPY : t < 44.9 ? TOPY * (1 - eio((t - 43.9) / 1.0)) : 0;
  let pose = 'backlook', y = 146;
  if (t >= 44.9) pose = 'back';
  if (t >= 44.7 && t < 45.3) pose = 'backbreathe';
  if (t >= 45.5 && t < 46.0) { pose = 'backwalk' + (Math.floor(t * 8) % 2); y = 146 - Math.round((t - 45.5) / .5 * 8); }
  if (t >= 46.0) { y = 138; pose = 'backpush'; }
  if (t >= 48.6) { pose = 'backwalk' + (Math.floor(t * 8) % 2); y = 138 - Math.round((t - 48.6) / .9 * 10); }
  const open = t < 46.0 ? 0 : t < 47.5 ? .12 * ss(46.0, 47.5, t) : .12 + .88 * eio(clamp((t - 47.5) / 1.7, 0, 1));
  const sil = t >= 48.6 ? clamp((t - 48.6) / .9, 0, 1) : 0;
  return { camY, open, torch: clamp((t - 47.55) / .95, 0, 1), runes: 1, hero: { x: 160, y, pose, wind: t > 46.5 ? .9 : .35, sil } };
}
function shotDoor(t) {
  const st = doorState(t);
  doorScene(fb, t, st.camY, st);
  if (t >= 44.6 && t < 48.6) { const dy = Math.round(-44 * (1 - eo(clamp((t - 44.6) / .3, 0, 1)))); const tmp = new FB(); tmp.clear(T); statusWin(tmp, 6, 6); fb.copy(tmp, 0, 0, 170, 50, 0, dy); }
  drawDialog(B.vo5, t, 'wistful'); drawDialog(B.vo6, t, 'determined');
  return st;
}

// ———————————————— 渲染 ————————————————
const bufA = new Uint32Array(W * H), bufB = new Uint32Array(W * H);
function applyRegions(regs) { for (const r of regs) for (let y = Math.max(0, r.y); y < Math.min(H, r.y + r.h); y++) for (let x = Math.max(0, r.x); x < Math.min(W, r.x + r.w); x++) { const i = y * W + x; out.u32[i] = r.lut[fb.d[i]]; } }
function renderVillage(t) { const f = village(t, t - 11.0); if (!NOSUB && inBox(B.vo2, t)) dialog(f, { skin: 'gb', portrait: null, text: B.vo2.text, t: t - B.vo2.t0 - .1, cps: 40 }); fileLabelGB(f); blitHalf(fb, f); }
function fileLabelGB(f) { win(f, 2, 2, 62, 13, 'gb'); text(f, 'FILE 1 00:12', 6, 5, GBI[0]); }
function renderCamp(t) { campfire(fb, t, t - 18.0); text(fb, 'FILE 2 · EMBER RIDGE · 23:48', 6, 5, C.white); if (!NOSUB && inBox(B.wren, t)) dialog(fb, { skin: 'nes', portrait: portraitWren8(), text: B.wren.text, t: t - B.wren.t0 - .07, cps: 30 }); }
function shake(u32, dx, dy) { if (!dx && !dy) return; const s = u32.slice(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const X = x - dx, Y = y - dy; u32[y * W + x] = X < 0 || Y < 0 || X >= W || Y >= H ? 0xff000000 : s[Y * W + X]; } }

function frame(t) {
  fb.clear(C.ink);
  const regs = [];
  if (t < 10.25 || (t >= 35.5 && t < 41.9)) {
    shotCorridor(t, regs);
    let L = LUT.faded; if (t < .5) L = darken(L, .75 * (1 - t / .5));
    out.present(fb, L); applyRegions(regs);
    if (t >= 35.5 && t < 35.55) {}   // 匹配剪辑：硬切
  } else if (t < 11.0) {
    // 缩略图放大进入回忆一（马赛克）
    shotCorridor(10.25, regs); out.present(fb, LUT.faded); applyRegions(regs); bufA.set(out.u32);
    fb.clear(C.ink); renderVillage(11.0); out.present(fb, LUT.gb4); bufB.set(out.u32);
    const u = eio((t - 10.25) / .75), r0 = { x: LIST.x + 20, y: LIST.y + 17, w: LIST.thumbW, h: LIST.thumbH };
    const rx = r0.x * (1 - u), ry = r0.y * (1 - u), rw = r0.w + (W - r0.w) * u, rh = r0.h + (H - r0.h) * u, n = Math.max(1, Math.round(10 * (1 - u)));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) { let sx = Math.floor((x - rx) / rw * W), sy = Math.floor((y - ry) / rh * H); sx = Math.floor(sx / n) * n; sy = Math.floor(sy / n) * n; out.u32[i] = bufB[sy * W + sx]; } else out.u32[i] = bufA[i];
    }
  } else if (t < 18.0) {
    renderVillage(t); out.present(fb, LUT.gb4);
    if (t > 17.6) mosaic(out.u32, Math.round(1 + 15 * ss(17.6, 18.0, t)));
  } else if (t < 25.4) {
    renderCamp(t); out.present(fb, LUT.nes);
    if (t < 18.4) mosaic(out.u32, Math.round(1 + 15 * (1 - ss(18.0, 18.4, t))));
  } else if (t < 26.2) {
    // 遇敌旋涡
    renderCamp(25.4 + (t - 25.4) * .3); out.present(fb, LUT.nes); bufA.set(out.u32);
    const s = Math.pow((t - 25.4) / .8, 1.6), n = 1 + Math.round(6 * s);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x - W / 2, dy = y - H / 2, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx) + s * 7 * (1.2 - r / 190);
      let sx = Math.round(W / 2 + Math.cos(a) * r * (1 - s * .35)), sy = Math.round(H / 2 + Math.sin(a) * r * (1 - s * .35));
      sx = clamp(Math.floor(sx / n) * n, 0, W - 1); sy = clamp(Math.floor(sy / n) * n, 0, H - 1);
      out.u32[y * W + x] = bufA[sy * W + sx];
    }
    if (t > 26.08) out.u32.fill(0xffffffff);
    else if (t > 25.96) for (let i = 0; i < out.u32.length; i++) if (bayer(i % W, (i / W) | 0) < .5) out.u32[i] = 0xffffffff;
  } else if (t < 35.5) {
    shotBattle(t);
    let L = battleLUT(t);
    if (t >= 29.2 && t < 29.29) L = whiten(LUT.full, 1);
    out.present(fb, L);
    if (t >= 29.2 && t < 29.55) { const k = Math.floor((t - 29.2) * 24); shake(out.u32, [3, -3, 2, -2, 1, -1, 1, 0, 0][k] || 0, [0, 2, -2, 1, -1, 0, 1, 0, 0][k] || 0); }
  } else if (t < 49.5) {
    const st = shotDoor(t);
    if (t < 47.5) out.present(fb, LUT.faded);
    else if (t < 48.8) {
      const R = (t - 47.5) / 1.3 * 360, cx = 160, cy = st.hero.y - 22 - st.camY * 0;
      out.present(fb, LUT.faded, LUT.full, (x, y) => Math.hypot(x - cx, (y - cy) * 1.1) < R - bayer8(x, y) * 34);
    } else out.present(fb, LUT.full);
  } else if (t < 50.1) {
    shotDoor(49.5); out.present(fb, whiten(LUT.full, 1));
  } else {
    endCard(fb, t, t - 50.4);
    let L = LUT.full; if (t < 50.4) L = whiten(L, 1 - (t - 50.1) / .3); if (t > 54.0) L = darken(L, (t - 54.0) / .5);
    out.present(fb, L);
  }
  out.post(() => {}); out.show();
}

// 测试帧：?frame=corridor|door（环境自查）
function testFrame(t) {
  const which = q.get('frame'), lut = LUT[q.get('lut') || 'full'];
  fb.clear(C.ink);
  if (which === 'corridor') corridor(fb, t, +(q.get('cam') || 99), { x: +(q.get('hx') || 295), pose: q.get('pose') || 'idle' });
  if (which === 'door') doorScene(fb, t, +(q.get('camY') || 0), { open: +(q.get('open') || 0), torch: +(q.get('torch') || 0), hero: { x: 160, y: 138, pose: q.get('pose') || 'backlook' } });
  out.present(fb, lut); out.show();
}
// 海报：门开、颜色回涨后的一刻 + 片名
function posterFrame() {
  fb.clear(C.ink);
  const st = doorState(48.75); st.hero.sil = 0; st.hero.pose = 'backpush'; st.hero.y = 138; st.torch = 1;
  doorScene(fb, 48.75, 0, st);
  const s1 = 'THE LAST SAVE POINT', col = y => y < 2 ? C.white : y < 4 ? C.yellow : y < 6 ? C.amber : C.orange;
  win(fb, 44, 8, 232, 40);
  textOutlinedImport(fb, s1, Math.round((W - textW(s1, 2)) / 2), 14, col, C.ink, 2);
  const s2 = 'a 16-bit pixel RPG short'; text(fb, s2, Math.round((W - textW(s2)) / 2), 36, C.silver, C.night);
  out.present(fb, LUT.full); out.show();
}
window.render = t => q.has('poster') ? posterFrame() : q.get('frame') ? testFrame(t) : frame(t);
window.DUR = TL.dur; window.READY = true;
