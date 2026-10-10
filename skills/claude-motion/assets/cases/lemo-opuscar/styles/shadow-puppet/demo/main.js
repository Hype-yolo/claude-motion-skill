// Hou Yi Shoots the Suns — Shadow Puppetry demo
import { makeGL } from './gl.js';
import { canvas, DYE } from './carve.js';
import { clamp, lerp, seg, ss, eio, eo, ei, back, vnoise, hash } from '/core/lib.js';
import { build, drawHouYi, drawRods, solve, J, LEGLEN, mul as mM, T as tM, R as rM, ap } from './houyi.js';
import { POSES } from './poses.js';
import { drawSun, drawCrow, buildSuns, SUNPOS } from './suns.js';
import { drawLand, groundY, buildScenery } from './scenery.js';
import { drawFrame, drawAudience, drawPillar, buildStage } from './stage.js';
import { silhouette, fistHand, pinchHand, lampBody, flame as lampFlame, smoke } from './backstage.js';
import { drawSub } from './hud.js';
import { T, DUR, VO, SHOTS, shotAt, KILL, hitT, BEAT } from './story.js';

const qs = new URLSearchParams(location.search);
const W = 1920, H = 1080;
const [trc, tr] = canvas(W, H), [frc, fr] = canvas(W, H), [lmc, lm] = canvas(W, H);
const GL = makeGL(document.getElementById('gl'));
for (const f of ['500', '600', '700']) await document.fonts.load(`${f} 40px "Cormorant Garamond"`);
await document.fonts.load('italic 600 40px "Cormorant Garamond"'); await document.fonts.load('400 40px "Ma Shan Zheng"', '后羿射日说皮影');
const TEST = qs.get('test');
const testMod = TEST ? await import('./test.js') : null;
build(); buildSuns(); buildScenery(); const STG = buildStage();
let DURS = {}; try { const r = await fetch('voices/dur.json'); if (r.ok) DURS = await r.json(); } catch (e) { }

const E = (t, a, b) => ss(seg(t, a, b));
const HX = 560, HY = groundY(HX) - LEGLEN + 10;      // 后羿站位（腰）

// ================= 灯 =================
function lampI(k, t) {
  const fl = 1 + .06 * (vnoise(t * 7 + k * 13) - .5) * 2 + .03 * Math.sin(t * 23 + k);
  if (k === 0) {
    if (t < T.match) return 0;
    if (t < T.lampOn) return .05 * (1 + Math.sin(t * 60)) * seg(t, T.match, T.match + .08);
    const u = t - T.lampOn; return (u < .45 ? lerp(.1, 1, eo(u / .45)) + .35 * Math.sin(u / .45 * Math.PI) : 1) * fl;
  }
  const f = T.flares[k - 1]; if (t < f) return 0;
  const ki = KILL.indexOf(k), h = ki >= 0 ? hitT(ki) : 1e9;
  let I = t - f < .3 ? lerp(0, 1, eo((t - f) / .3)) + .5 * Math.sin((t - f) / .3 * Math.PI) : 1;
  if (t > h) { const u = (t - h) / .35; I *= u < 1 ? (1 - u) * (.7 + .3 * Math.sin(u * 40)) : 0; }
  return Math.max(0, I * fl);
}
const lamps = t => SUNPOS.map(([x, y], k) => [x, y - 10, lampI(k, t), .95]);

// ================= 后羿表演 =================
const aimAt = (target, pull = 1, extra = {}) => {    // 瞄准某个太阳的开弓姿势
  const sh = [HX + J.shB[0], HY + J.shB[1]], dx = target[0] - sh[0], dy = target[1] - sh[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  // 箭在瞄准线上：握点 = 肩 + u·118；拉满时搭箭点 = 握点 − u·(40 + 72·pull)
  const grip = [J.shB[0] + ux * 118, J.shB[1] + uy * 118], nock = [grip[0] - ux * (40 + 72 * pull), grip[1] - uy * (40 + 72 * pull)];
  return { ...POSES.draw, bowT: [ux * 118, uy * 118], drawT: [nock[0] - J.shF[0], nock[1] - J.shF[1] + 4], draw: pull, bendF: -1, arrow: true, ...extra };
};
const lerpA = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
function mix(A, B, u) {
  const o = { ...A };
  for (const k of Object.keys(B)) {
    const a = A[k], b = B[k];
    if (typeof b === 'number' && typeof a === 'number' && !k.startsWith('bend')) o[k] = lerp(a, b, u);
    else if (Array.isArray(b) && Array.isArray(a)) o[k] = lerpA(a, b, u);
    else o[k] = u < .5 ? (a ?? b) : b;
  }
  return o;
}
const READY = { ...POSES.liang, head: -.42, bowT: [70, -40], drawT: [8, 70], hB: -.3, legF: -.26, legB: .22, rot: -.03 };
const LOOSED = t0 => ({ ...POSES.draw, draw: 0, arrow: false, drawT: [-58, -34], bendF: -1 });
const tgt = i => SUNPOS[KILL[i]];
function heroPose(t) {
  let p;
  const base = { x: HX, y: HY };
  if (t < T.run0) return null;
  if (t < T.run1) {                                      // 碎步急上
    const u = (t - T.run0) / (T.run1 - T.run0), ph = (t - T.run0) * 10.5;
    p = { ...POSES.stride, x: lerp(-200, HX - 50, u), y: HY - Math.abs(Math.sin(ph)) * 7, legF: -.12 + .4 * Math.sin(ph), legB: .1 - .4 * Math.sin(ph), rot: .1 + .02 * Math.sin(ph * 2), drawT: [-50 + 18 * Math.sin(ph), 88], bowT: [66, 72 - 8 * Math.sin(ph)] };
  } else if (t < T.hop + .35) {                          // 小跳
    const u = seg(t, T.run1, T.hop + .35), hgt = Math.sin(u * Math.PI) * 38;
    p = mix({ ...POSES.stride, x: HX - 50, y: HY }, { ...POSES.stride, x: HX - 6, y: HY, legF: -.5, legB: .1, rot: .02 }, u); p.y -= hgt;
  } else if (t < T.liang) {                              // 落地蹲 → 亮相
    const u1 = E(t, T.hop + .35, T.hop + .5), u2 = back(seg(t, T.liang - .15, T.liang), 1.4);
    const crouch = { ...READY, x: HX, y: HY + 10, rot: .12, head: .05, bowT: [50, 60], drawT: [0, 90], legF: -.3, legB: .3 };
    p = mix(mix({ ...POSES.stride, x: HX - 6, y: HY }, crouch, u1), { ...POSES.liang, ...base }, u2);
  } else if (t < 23.6) {                                  // 亮相定住 → 抬头望日
    p = mix({ ...POSES.liang, ...base }, { ...POSES.liang, ...base, head: -.46 }, E(t, T.lookUp, T.lookUp + .5));
  } else if (t < T.draw1[0]) {                            // 收成预备
    p = mix({ ...POSES.liang, ...base, head: -.46 }, { ...READY, ...base }, E(t, 23.6, 24.6));
  } else if (t < T.rel[0]) {                              // 第一箭：慢开弓
    const u = E(t, T.draw1[0], T.draw1[1]);
    p = mix({ ...READY, ...base, arrow: true }, { ...aimAt(tgt(0), 1), ...base }, u);
  } else if (t < T.last0) {                               // 连射
    let i = 0; while (i < T.rel.length - 1 && t >= T.rel[i + 1]) i++;
    const r0 = T.rel[i], r1 = T.rel[i + 1] ?? T.last0;
    const loose = { ...LOOSED(), ...base, bowT: aimAt(tgt(i)).bowT };
    if (t < r0 + .1) p = mix({ ...aimAt(tgt(i), 1), ...base }, loose, eo(seg(t, r0, r0 + .1)));
    else { const nxt = i + 1 < T.rel.length ? tgt(i + 1) : SUNPOS[0], gap = r1 - r0; p = mix(loose, { ...aimAt(nxt, 1), ...base }, E(t, r0 + .1 + gap * .15, r1 - .04)); }
  } else if (t < T.lower0) {                              // 最后一支：搭箭，拉满，停住
    const loose = { ...LOOSED(), ...base, bowT: aimAt(tgt(8)).bowT };
    const nocked = { ...aimAt(SUNPOS[0], .15), ...base };
    p = t < T.lastDraw ? mix(loose, nocked, E(t, T.last0, T.lastDraw)) : mix(nocked, { ...aimAt(SUNPOS[0], 1), ...base }, E(t, T.lastDraw, T.stop));
  } else if (t < T.lower1 + 2) {                          // 放下弓
    const spare = { ...POSES.spare, ...base, arrow: false };
    p = mix({ ...aimAt(SUNPOS[0], 1), ...base }, spare, E(t, T.lower0, T.lower1));
    if (t > T.lower1) p = mix(spare, { ...spare, head: -.3 }, E(t, 38.6, 39.8));
  } else {
    const spare = { ...POSES.spare, ...base, arrow: false, head: -.3 };
    p = mix(spare, { ...spare, head: .18 }, E(t, 41.6, 42.8));
    if (t > 46) { const b = E(t, T.bow, T.bow + .5) * (1 - E(t, T.bow + 1.1, T.bow + 1.7)); p = { ...p, rot: p.rot + .2 * b, head: p.head + .22 * b, bowT: lerpA(p.bowT, [50, 90], b) }; }
  }
  // 手持微颤（皮影的"活气"）+ 张力颤
  const tens = t > T.stop && t < T.lower0 ? 1.8 : 1;
  p.x += (vnoise(t * 2.1) - .5) * 3 * tens; p.y += (vnoise(t * 2.7 + 9) - .5) * 2.4 * tens; p.rot += (vnoise(t * 1.7 + 4) - .5) * .018 * tens;
  if (p.draw > 0 && p.drawT) { p.drawT = [p.drawT[0] + (vnoise(t * 9) - .5) * 2 * tens, p.drawT[1] + (vnoise(t * 8 + 3) - .5) * 2 * tens]; }
  return p;
}
// —— 翎子与腿的惯性（预模拟，确定性）——
const SIM = (() => {
  const dt = 1 / 120, n = Math.ceil(DUR / dt) + 2, fa = new Float32Array(n), lg = new Float32Array(n);
  let phi = 0, om = 0, psi = 0, ps = 0, pa = null, pv = 0, px = null, vx = 0;
  for (let i = 0; i < n; i++) {
    const t = i * dt, p = heroPose(t);
    if (!p) { fa[i] = 0; lg[i] = 0; pa = null; px = null; continue; }
    const ha = p.rot + p.head, x = p.x;
    const av = pa == null ? 0 : (ha - pa) / dt, aa = (av - pv) / dt, v = px == null ? 0 : (x - px) / dt, ax = (v - vx) / dt;
    pa = ha; pv = av; px = x; vx = v;
    om += (-60 * phi - 5 * om - .9 * clamp(aa, -400, 400) - .0025 * clamp(ax, -4000, 4000)) * dt; phi += om * dt;
    ps += (-30 * psi - 3.5 * ps - .0016 * clamp(ax, -4000, 4000)) * dt; psi += ps * dt;
    fa[i] = clamp(phi, -.8, .8); lg[i] = clamp(psi, -.5, .5);
  }
  return t => { const i = clamp(Math.round(t * 120), 0, n - 1); return [fa[i], lg[i]]; };
})();
function heroFull(t) {
  const p = heroPose(t); if (!p) return null;
  const [f, l] = SIM(t);
  p.feat = [Array.from({ length: 10 }, (_, i) => f * .09 * (1 + i * .15)), Array.from({ length: 10 }, (_, i) => f * .1 * (1 + i * .12))];
  p.legF += l; p.legB += l * .9;
  return p;
}

// ================= 镜头 =================
function camAt(t) { const c = camRaw(t), n = shotAt(t)[2]; if (c[2] >= 1 && !['house', 'truck', 'end'].includes(n)) { c[0] = clamp(c[0], 960 / c[2], 1920 - 960 / c[2]); c[1] = clamp(c[1], 540 / c[2], 1080 - 540 / c[2]); } return c; }
function camRaw(t) {
  const [t0, t1, name] = shotAt(t), u = (t - t0) / (t1 - t0);
  switch (name) {
    case 'house': return [960, 560, lerp(.72, .8, eio(u))];
    case 'suns': return [960, lerp(560, 540, E(t, 7.2, 10)), lerp(.8, 1.0, E(t, 7.2, 10.2))];
    case 'land': return [lerp(1480, 470, eio(u)), lerp(760, 720, u), 1.55];
    case 'enter': return [lerp(620, 780, eio(u)), 610, 1.15];
    case 'liang': { const c = back(seg(t, 21.6, 21.6 + 5 / 24), 1.2); return [lerp(780, 640, c), lerp(610, 470, c) - E(t, 22.9, 24.5) * 30, lerp(1.15, 1.95, c) - E(t, 22.9, 25.2) * .12]; }
    case 'draw': {
      const whip = E(t, T.rel[0] + .02, T.rel[0] + .26), tg = tgt(0);
      return [lerp(700, tg[0] - 60, whip), lerp(450, tg[1] + 30, whip), lerp(lerp(2.35, 2.55, E(t, 25.2, 27.4)), 2.1, whip)];
    }
    case 'second': return [900, 470, lerp(1.28, 1.34, u)];
    case 'volley': return [960, 540, 1.0];
    case 'last': return [lerp(890, 880, u), lerp(430, 415, u), lerp(1.38, 1.48, eio(u))];
    case 'heal': return [lerp(960, 960, u), lerp(540, 560, E(t, T.pull0, 43.2)), lerp(1.0, .72, E(t, T.pull0, 43.4))];
    case 'truck': return [lerp(960, 2500, ei(seg(t, 43.2, 44.0))), 560, .72];
    default: return [960, 560, .8];
  }
}
const camM = ([cx, cy, z], mir = 1) => [z * mir, 0, 0, z, 960 - cx * z * mir, 540 - cy * z];

// ================= 字幕区间 =================
const SUBS = VO.map((v, i) => { const d = DURS[v.id] || 2.5, nxt = VO[i + 1]; let t1 = v.t + Math.max(1.8, d + .8); if (nxt) t1 = Math.min(t1, nxt.t - .3); else t1 = Math.min(t1, T.clap2 - .15); return { t0: v.t, t1, text: v.text }; });
window.SUBS = SUBS;

// ================= 画一帧 =================
function drawScreen(t, C, opt = {}) {      // 幕布上的一切（透射率画布）
  tr.setTransform(1, 0, 0, 1, 0, 0); tr.fillStyle = '#fff'; tr.fillRect(0, 0, W, H);
  const k = Math.hypot(C[0], C[1]);
  // 景片
  const burn = t < T.heal0 ? E(t, T.burn0, T.burn1) : 1 - E(t, T.heal0, T.heal1);
  const flames = t < T.heal0 ? E(t, T.flames, T.flames + 1.2) : 1 - E(t, T.heal0, T.heal0 + .9);
  const river = t < T.heal0 ? 1 - E(t, 11.6, 13.4) : E(t, T.river, T.river + .8);
  const canopy = t < T.heal0 ? 1 - E(t, 14.4, 15.4) : E(t, T.canopy, T.canopy + .9);
  if (t >= 6.9 || opt.land) drawLand(tr, C, { burn, flames, t, river, canopy, canopyLift: 1 - canopy, bare: canopy < .5 ? 1 : 0 });
  // 太阳
  for (let s = 0; s < 10; s++) {
    const ta = s === 0 ? T.sun0 : T.flares[s - 1]; if (t < ta) continue;
    const ki = KILL.indexOf(s), h = ki >= 0 ? hitT(ki) : 1e9;
    const [x, y, , v] = SUNPOS[s], sw = eo(seg(t, ta, ta + .55)), lift = 1 - sw;
    let sc = .95 * (1 + lift * 1.6), bl = lift * 34 * k, al = .35 + .65 * sw, dx = 0, dy = Math.sin(t * .8 + s) * 4;
    let crow = true;
    if (t > h) {
      const jolt = seg(t, h, h + .12), v2 = seg(t, h + .08, h + .95);
      dx += Math.sin(jolt * 30) * 6 * (1 - jolt); sc *= 1 + v2 * .9; bl += v2 * 30 * k; al *= 1 - ei(v2); dy -= v2 * 40; crow = false;
      if (v2 >= 1) continue;
    }
    const rot = t * .05 * (s % 2 ? 1 : -1) + s;
    drawSun(tr, [C[0] * sc, 0, 0, C[3] * sc, C[0] * (x + dx) + C[4], C[3] * (y + dy) + C[5]], { v, rot, blur: bl, alpha: al, noCrow: !crow });
  }
  // 片名牌
  if (t >= T.titleIn && t < T.titleOut + .9) {
    const up = eo(seg(t, T.titleIn, T.titleSet)), off = seg(t, T.titleOut, T.titleOut + .8);
    const sc = 1.18 * (1 + ei(off) * .7), y = lerp(1300, 500, up) - off * 30, bl = off * 30 * k;
    tr.save(); tr.globalCompositeOperation = 'multiply'; tr.globalAlpha = 1 - ei(off); if (bl) tr.filter = `blur(${bl}px)`;
    tr.setTransform(C[0] * sc, 0, 0, C[3] * sc, C[0] * 960 + C[4], C[3] * y + C[5]); tr.drawImage(STG.title.c, STG.title.x0, STG.title.y0, STG.title.w, STG.title.h); tr.restore();
    if (off < .3) { const r = [[-450, 180], [450, 180]].map(([a, b]) => [C[0] * (960 + a) + C[4], C[3] * (y + b) + C[5]]); drawRods(tr, r, r.map(p => [p[0] - 60 * k, p[1] + 900]), 2.4 * k, .6); }
  }
  // 片尾牌
  if (opt.endPlaque) {
    const up = eo(seg(t, T.endIn, T.endIn + 1.0)), y = lerp(1250, 500, up);
    tr.save(); tr.globalCompositeOperation = 'multiply'; tr.setTransform(C[0], 0, 0, C[3], C[0] * 960 + C[4], C[3] * y + C[5]); tr.drawImage(STG.end.c, STG.end.x0, STG.end.y0, STG.end.w, STG.end.h); tr.restore();
    const r = [[-380, 170], [380, 170]].map(([a, b]) => [C[0] * (960 + a) + C[4], C[3] * (y + b) + C[5]]); drawRods(tr, r, r.map(p => [p[0] - 60 * k, p[1] + 900]), 2.4 * k, .6);
  }
  // 箭（飞行中）
  for (let i = 0; i < T.rel.length; i++) {
    const r0 = T.rel[i], h = hitT(i); if (t < r0 || t > h) continue;
    const p0 = heroNock(r0 - 1 / 48), p1 = SUNPOS[KILL[i]], u = (t - r0) / (h - r0);
    const a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    for (let gh = 0; gh < 4; gh++) {
      const uu = clamp(u - gh * .06), x = lerp(p0[0], p1[0], uu), y = lerp(p0[1], p1[1], uu) - Math.sin(uu * Math.PI) * 18;
      tr.save(); tr.globalCompositeOperation = 'multiply'; tr.globalAlpha = gh ? .25 / gh : 1; tr.setTransform(C[0] * Math.cos(a), C[0] * Math.sin(a), -C[0] * Math.sin(a), C[0] * Math.cos(a), C[0] * x + C[4], C[3] * y + C[5]);
      tr.strokeStyle = '#4a2612'; tr.lineWidth = 3.2; tr.beginPath(); tr.moveTo(-150, 0); tr.lineTo(0, 0); tr.stroke();
      tr.fillStyle = DYE.ink; tr.beginPath(); tr.moveTo(12, 0); tr.lineTo(-2, -5); tr.lineTo(-2, 5); tr.closePath(); tr.fill();
      tr.fillStyle = DYE.red; tr.beginPath(); tr.moveTo(-150, 0); tr.lineTo(-128, -6); tr.lineTo(-122, 0); tr.lineTo(-128, 6); tr.closePath(); tr.fill(); tr.restore();
    }
  }
  // 后羿
  const hp = opt.noHero ? null : heroFull(t);
  if (hp) {
    if (opt.mirror) { /* 幕后：同样的皮影，镜像由 C 负责 */ }
    const r = drawHouYi(tr, C, hp);
    opt.rodsOut = r.rods;
    if (!opt.noRods) drawRods(tr, r.rods, r.rods.map((q, j) => [q[0] - (140 - j * 40) * k * Math.sign(C[0]), q[1] + 700 * k]), 2.4 * k, .7);
  }
  // 坠落的金乌
  for (let i = 0; i < KILL.length; i++) {
    const h = hitT(i); if (t < h || t > h + 1.4) continue;
    const [x, y] = SUNPOS[KILL[i]], u = t - h, w = seg(t, h + .15, h + 1.3);
    const cx = x + u * 60 * (i % 2 ? 1 : -1), cy = y + 60 * u + 520 * u * u, rot = u * 3.2 * (i % 2 ? 1 : -1), sc = 1.1 * (1 + w * 1.1);
    drawCrow(tr, [C[0] * sc * Math.cos(rot), C[3] * sc * Math.sin(rot), -C[0] * sc * Math.sin(rot), C[3] * sc * Math.cos(rot), C[0] * cx + C[4], C[3] * cy + C[5]], w * 24 * k, 1 - ei(w));
  }
}
let NOCK = null;
function heroNock(t) { const p = heroFull(t); if (!p) return [HX, HY]; const S = solve(p); return ap(S.MW, J.shF[0] + p.drawT[0], J.shF[1] + p.drawT[1]); }

function render(t) {
  fr.setTransform(1, 0, 0, 1, 0, 0); fr.clearRect(0, 0, W, H); fr.globalAlpha = 1; fr.filter = 'none';
  if (testMod) {
    if (TEST === 'model') { const o = testMod.modelSheet(tr, fr, lm, qs.get('v') || '2'); GL.render(trc, frc, o, lmc); return; }
    if (TEST === 'hands') { const o = testMod.handsTest(fr, t); GL.render(trc, frc, o); return; }
    if (TEST === 'poster') {     // 海报：戏台全景 + 后羿瞄准最后一个太阳 + 台口片名
      const cam = [960, 565, .72], C = camM(cam);
      tr.setTransform(1, 0, 0, 1, 0, 0); tr.fillStyle = '#fff'; tr.fillRect(0, 0, W, H);
      drawLand(tr, C, { burn: 0, flames: 0, river: 1, canopy: 1 });
      drawSun(tr, [C[0] * .95, 0, 0, C[3] * .95, C[0] * SUNPOS[0][0] + C[4], C[3] * SUNPOS[0][1] + C[5]], { v: 0, rot: .3 });
      const p = { ...aimAt(SUNPOS[0], 1), x: HX, y: HY }; const r = drawHouYi(tr, C, p);
      drawRods(tr, r.rods, r.rods.map((q, j) => [q[0] - (140 - j * 40) * .78, q[1] + 600]), 2, .7);
      drawFrame(fr, C, .8); drawAudience(fr, .95, 2);
      fr.save(); fr.textAlign = 'center'; fr.fillStyle = '#e9cf9c'; fr.font = '700 64px "Cormorant Garamond"'; fr.letterSpacing = '10px'; fr.fillText('HOU YI SHOOTS THE SUNS', 960, 66);
      fr.font = 'italic 600 30px "Cormorant Garamond"'; fr.letterSpacing = '2px'; fr.fillStyle = '#c9a26a'; fr.fillText('a shadow puppet tale  ·  Shadow Puppetry  ·  LemoLab × Claude Opus 5.5', 960, 108); fr.restore();
      GL.render(trc, frc, { lamps: [[SUNPOS[0][0], SUNPOS[0][1] - 10, 1, .95]], cam, expo: 1.75, sigB: 700, sigC: 120, amb: .3, vign: .45, sat: 1.1, contrast: .15, bloom: .3 }); return;
    }
    if (TEST === 'frame') { const o = testMod.styleFrame(tr, fr, qs.get('f') || 'ten'); GL.render(trc, frc, { ...o, time: t }); return; }
  }
  const [, , name] = shotAt(t);
  const L = lamps(t), nEff = L.reduce((a, l) => a + l[2], 0);
  const base = { lamps: L, sigB: 700, sigC: 120, amb: .3, time: t, vign: .45, sat: 1.1, contrast: .15, bloom: .3 };
  // 曝光：十盏灯按 √n 压，过曝但不全白
  const expoFront = 1.75 / Math.sqrt(Math.max(1, nEff));
  let o;
  if (name === 'back' || (name === 'truck' && t >= T.cutBack)) o = renderBack(t, base);
  else if (name === 'end') o = renderEnd(t, base, expoFront);
  else {
    const cam = camAt(t), C = camM(cam);
    drawScreen(t, C);
    if (cam[2] < 1.02) { drawFrame(fr, C, clamp(nEff, 0, 3) / 1.5); }
    if (name === 'house') drawAudience(fr, 1 - E(t, 5.5, 7.2), t);
    if (name === 'heal') drawAudience(fr, E(t, 41.8, 43.2) * .9, t);
    if (name === 'truck') drawPillar(fr, lerp(2700, 960, eo(seg(t, 43.25, T.cutBack))));
    const haze = t > T.hot && t < T.heal0 ? 3.2 * E(t, T.hot, 12.5) * (1 - E(t, 34, 36)) : 0;
    o = { ...base, cam, expo: expoFront, haze, bloom: .28 + .2 * clamp((nEff - 1) / 9, 0, 1) };
    if (t < T.lampOn + .1) o.bloom = .5;
  }
  drawSubs(t);
  GL.render(trc, frc, o);
}
function drawSubs(t) {
  if (qs.get('nosub')) return;
  for (const s of SUBS) if (t >= s.t0 && t < s.t1) { const a = Math.min(E(t, s.t0, s.t0 + .2), 1 - E(t, s.t1 - .25, s.t1)); drawSub(fr, s.text, a, 1 - eo(seg(t, s.t0, s.t0 + .22))); }
}

// ================= 幕后 =================
function renderBack(t, base) {
  // 视图：从幕后看（镜像），先是横移进入，再缓推向最后一盏灯
  const tIn = eo(seg(t, T.cutBack, T.truck1 + .6));
  const push = eio(seg(t, T.truck1, 50.6)), dive = ei(seg(t, 50.3, 51.0));
  const zBase = .83, L0 = [960 - (SUNPOS[0][0] - 970) * zBase + 16, 540 + (SUNPOS[0][1] - 660) * zBase + 52];   // 最后一盏灯（视口）
  const z = zBase * (1 + push * .1 + dive * 2.4);
  const sx = (1 - tIn) * 900;                   // 横移残余
  const cx = 970 - sx / zBase, cy = 660;
  const C0 = camM([cx, cy, zBase], -1), sc = z / zBase;
  // 缓推围绕画面中部；最后的俯冲围绕灯焰（固定点从中部移到灯焰）
  const F = [lerp(1000, L0[0], ss(seg(t, 50.0, 50.5))), lerp(600, L0[1], ss(seg(t, 50.0, 50.5)))];
  const C = [C0[0] * sc, 0, 0, C0[3] * sc, F[0] + (C0[4] - F[0]) * sc, F[1] + (C0[5] - F[1]) * sc];
  const Vt = (x, y, par = 1) => [F[0] + (x - F[0]) * sc - sx * (par - 1) * .6, F[1] + (y - F[1]) * sc];   // 视口物体（有视差）
  drawScreen(t, C, { noRods: true });
  const rods = (heroFull(t) ? drawHouYiRodsView(t, C) : []);
  // 暗场 + 木框（幕后看到的是木框背面）
  fr.save(); fr.setTransform(1, 0, 0, 1, 0, 0);
  const sr = [C[0] * 1920 + C[4], C[3] * 0 + C[5], C[4], C[3] * 1080 + C[5]];   // 镜像：x0 > x1
  fr.fillStyle = '#0d0705';
  fr.beginPath(); fr.rect(0, 0, W, H); fr.rect(sr[0], sr[1], sr[2] - sr[0], sr[3] - sr[1]); fr.fill('evenodd');
  fr.strokeStyle = '#2a120a'; fr.lineWidth = 26 * sc; fr.strokeRect(sr[0], sr[1], sr[2] - sr[0], sr[3] - sr[1]);
  // 台口横木（幕布下沿），受光
  fr.fillStyle = '#1c0d08'; fr.fillRect(0, sr[3], W, 60 * sc);
  const gl = fr.createLinearGradient(0, sr[3], 0, sr[3] + 60 * sc); gl.addColorStop(0, 'rgba(255,170,90,.35)'); gl.addColorStop(1, 'rgba(255,170,90,0)'); fr.fillStyle = gl; fr.fillRect(0, sr[3], W, 60 * sc);
  fr.restore();
  // 吊灯（十盏：0 亮；其余刚熄、冒烟）
  const lampV = SUNPOS.map(([x, y], k) => { const v = [C[0] * x + C[4], C[3] * Math.min(y, 300) * .55 + C[5]]; return k === 0 ? [v[0], C[3] * y + C[5] + 60 * sc] : [v[0] + (v[0] - 960) * .06, C[3] * Math.min(y, 420) * .8 + C[5] + 70 * sc + (k % 3) * 16 * sc]; });
  const lit = lampV[0];
  const bright = (x, y) => clamp(1 - Math.hypot(x - lit[0], y - lit[1]) / (520 * sc), 0, 1) ** 1.3;
  silhouette(fr, g => { lampV.forEach(([x, y], k) => lampBody(g, x, y, .85 * sc)); }, { dir: [0, -1], k: 3, rimA: .55, rim: '#ffb766' });
  lampV.forEach(([x, y], k) => { if (k) { const ki = KILL.indexOf(k); smoke(fr, x, y, .85 * sc, t, t - hitT(ki), bright, k * 7 + 1); } });
  lampFlame(fr, lit[0], lit[1], .85 * sc, t, 1);
  // 艺人的手 + 杆
  const hb = Vt(1480, 905, 1.4), hp = Vt(1230, 925, 1.4), hs = 1.3 * sc;
  silhouette(fr, g => {
    const bowG = E(t, T.bow, T.bow + .5) * (1 - E(t, T.bow + 1.1, T.bow + 1.7));
    const a = fistHand(g, [hs, 0, 0, hs, hb[0] + bowG * 14 * sc, hb[1] + bowG * 30 * sc]);
    const b = pinchHand(g, [hs * Math.cos(-.2), hs * Math.sin(-.2), -hs * Math.sin(-.2), hs * Math.cos(-.2), hp[0], hp[1]], .2);
    if (rods.length) {
      const grips = [a.grip, b.gripA, b.gripB];
      rods.forEach((p, i) => { const q = grips[i]; g.lineWidth = (i === 0 ? 6 : 4) * sc; g.beginPath(); g.moveTo(q[0] + (q[0] - p[0]) * .18, q[1] + (q[1] - p[1]) * .18); g.lineTo(p[0], p[1]); g.stroke(); });
    }
    // 过肩：艺人的肩与后脑（大虚前景）
  }, { dir: [-.5, -.86], k: 5, rimA: .85 });
  silhouette(fr, g => { const s = Vt(1900, 1160, 1.8); g.beginPath(); g.ellipse(s[0], s[1], 300 * sc, 220 * sc, -.2, 0, 7); g.fill(); g.beginPath(); g.ellipse(s[0] + 60 * sc, s[1] - 300 * sc, 120 * sc, 150 * sc, 0, 0, 7); g.fill(); }, { dir: [-.7, -.7], k: 7, rimA: .6, blur: 10 });
  return { ...base, cam: [(960 - C[4]) / C[0], (540 - C[5]) / C[3], C[3]], mir: -1, expo: .95, lamps: [[SUNPOS[0][0], SUNPOS[0][1] + 40, lampI(0, t) * 1.2, 1.4]], bloom: .38, vign: .55, fade: dive * .92, fadeCol: [1, .82, .55] };
}
function drawHouYiRodsView(t, C) {   // 幕后看到的杆锚点（视口坐标）——drawScreen 已经画了后羿
  const p = heroFull(t); const k = Math.hypot(C[0], C[1]);
  const S = solve(p), MW = mM(C, S.MW);
  // 与 houyi.drawHouYi 的锚点保持一致：颈杆在胸上，手杆在两手
  return [ap(MW, ...J.rod), handPt(C, S, 'B'), handPt(C, S, 'F')];
}
function handPt(C, S, side) {
  const MW = S.MW, sh = side === 'B' ? J.shB : J.shF, a1 = side === 'B' ? S.aB1 : S.aF1, a2 = side === 'B' ? S.aB2 : S.aF2;
  const Mu = mM(C, mM(tM(...ap(MW, ...sh)), rM(a1))), Mf = mM(Mu, mM(tM(...J.elbow), rM(a2 - a1))), Mh = mM(Mf, tM(...J.wrist));
  return ap(Mh, 0, 8);
}
// ================= 片尾 =================
function renderEnd(t, base, expoFront) {
  const cam = [960, 560, lerp(.84, .8, seg(t, T.endIn, T.end))], C = camM(cam);
  drawScreen(t, C, { endPlaque: true, noHero: true });
  drawFrame(fr, C, .7);
  drawAudience(fr, .9, t);
  return { ...base, cam, expo: expoFront, lamps: [[SUNPOS[0][0] - 450, SUNPOS[0][1] + 80, lampI(0, t), .8]], fade: 1 - E(t, T.endIn - .1, T.endIn + .5), fadeCol: [1, .82, .55] };
}

// ================= 音效 / 配乐事件（给 mix.py 与 music/score.py）=================
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  add('clap', T.clap); add('match', T.match); add('ignite', T.lampOn);
  add('rodtap', T.titleIn + .1); add('rodtap', T.titleSet, { v: .6 }); add('liftoff', T.titleOut);
  add('liftoff', T.sun0 - .05, { v: .5 }); T.flares.forEach((f, i) => add('flare', f, { i }));
  add('heat', T.hot, { d: T.stop - T.hot + .05 });
  add('crackle', T.burn0 + 1, { d: T.stop - T.burn0 - 1 });
  add('crack', 14.15); add('crack', 14.5, { v: .6 }); add('fireup', 16.55);
  for (let k = 0; k < 14; k++) add('step', T.run0 + .2 + k * (T.run1 - T.run0 - .2) / 14, { v: .5 + .3 * (k % 2) });
  add('hop', T.hop); add('land', T.hop + .35);
  add('creak', T.draw1[0], { d: T.draw1[1] - T.draw1[0] });
  T.rel.forEach((r, i) => { add('twang', r); add('arrow', r, { d: T.fly[i] }); add('hit', hitT(i), { i }); add('snuff', hitT(i) + .05, { i }); if (i > 0 && i < 8) add('creak', r - .35, { d: .3, v: .5 }); });
  add('crowflap', hitT(0) + .1); add('crowflap', hitT(1) + .15, { v: .6 });
  add('creak', T.lastDraw, { d: T.stop - T.lastDraw, v: 1 }); add('bowease', T.lower0, { d: 1.1 });
  add('water', T.river, { d: T.truck0 - T.river });
  add('wind', T.truck0, { d: 1.5 }); add('cloth', T.truck0 + .3);
  add('room', T.cutBack, { d: T.clap2 - T.cutBack + .3 }); add('rodtap', T.bow, { v: .5 }); add('rodtap', T.bow + 1.2, { v: .35 }); add('breath', 47.2);
  add('clap', T.clap2); add('rodtap', T.endIn + .1, { v: .6 });
  for (const v of VO) add('vo', v.t, { id: v.id });
  return ev.sort((a, b) => a.t - b.t);
}
window.EV = events(); window.T = T;
window.render = render; window.DUR = DUR;
render(parseFloat(qs.get('t') ?? '15'));
window.READY = true;
