// Nian Comes to Town — Red Paper-cut demo
import { PAL, canvas, piece, fill, cut, trace, fillPaper, Pl, P, curve, ellipsePoly, paperShadow, noShadow, finishPaper, transmitOf, rnd } from './paper.js';
import { put, mul, T as Tm, S, R, ap } from './rig.js';
import { drawGirl, drawScissors, buildGirl } from './girl.js';
import { drawNian, buildNian, NPOSE, NJ, HS } from './nian.js';
import { tuanhua, tuanhuaHoles, TR } from './tuanhua.js';
import { drawVillage, kit, HOUSES, HERO, GROUND, NIGHT, DAY, winI, NLc } from './world.js';
import { beginLight, pool, lightRect, applyLight, glowWindow, bloom, rays, addMasked, E, L } from './light.js';
import { drawFold } from './fold.js';
import { drawSubs, textPiece } from './hud.js';
import { sawRow, swirl, crescent, rosette, plum } from './motifs.js';
import { T, DUR, VO, SHOTS, shotAt } from './story.js';
import { clamp, lerp, seg, ss, eio, eo, ei, back, hash, vnoise, track } from '/core/lib.js';

const qs = new URLSearchParams(location.search);
const cv = document.getElementById('cv'), g = cv.getContext('2d');
await document.fonts.load('600 40px "Fraunces"'); await document.fonts.load('800 40px "Fraunces"'); await document.fonts.load('700 40px "Fraunces"'); await document.fonts.load('italic 500 40px "Fraunces"');
await document.fonts.load('400 40px "Ma Shan Zheng"', '年剪纸窗花红');
const TEST = qs.get('test');
if (TEST) {
  const m = await import('./test.js');
  window.DUR = 1; window.render = t => m.test(g, TEST, t, qs); window.READY = true;
}
const W = 1920, H = 1080;
let DURS = {}; try { const r = await fetch('voices/dur.json'); if (r.ok) DURS = await r.json(); } catch (e) { }
const E_ = (t, a, b) => ss(seg(t, a, b));
const st = t => Math.floor(t * 12) / 12;         // 角色 12 fps 步进
const cam = (x, y, z) => [z, 0, 0, z, 960 - x * z, 540 - y * z];
const lerpA = (a, b, u) => a.map((v, i) => lerp(v, b[i], u));
function mix(A, B, u) { const o = { ...A }; for (const k of Object.keys(B)) { const a = A[k], b = B[k]; if (typeof a === 'number' && typeof b === 'number') o[k] = lerp(a, b, u); else o[k] = u < .5 ? (a ?? b) : b; } return o; }
kit(); buildGirl(); buildNian();
const FLOWER = tuanhua(1.4), HOLES = tuanhuaHoles(1);
const SPOT = (() => { const [c, q] = canvas(256, 256), gr = q.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(.55, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = gr; q.fillRect(0, 0, 256, 256); return { c, x0: -1, y0: -1, w: 2, h: 2 }; })();
const [TCc, TC] = canvas(W, H), [OCc, OC] = canvas(W, H);

// ===================== 字幕 =====================
const SUBS = VO.map((v, i) => {
  const d = DURS[v.id] || 3; const next = VO[i + 1] ? VO[i + 1].t - .15 : DUR;
  return { t0: v.t - .05, t1: Math.min(next, v.t + Math.max(1.8, d + .7)), text: v.text };
});
window.SUBS = SUBS;

// ===================== S1 剪刀特写 =====================
const MAC = {};
function buildMacro() {
  if (MAC.sheet) return;
  MAC.sheet = piece([0, 0, 1700, 1500], q => fill(q, qq => trace(qq, Pl([[0, 0], [1700, 0], [1700, 1500], [0, 1500]], true, .6, 3)), PAL.red), { ss: 1, seed: 31 });
  MAC.path = curve([[760, 1300], [700, 1000], [820, 760], [1060, 640], [1300, 700], [1500, 600], [1640, 420], [2140, 380]], false, 4);
}
function macroProg(t) {   // 刀路进度：每一剪推进一截
  let p = .02 * seg(t, 0, .25);
  for (const s of T.snips) p += .28 * eo(seg(t, s - .12, s + .02));
  return Math.min(1, p + .14 * seg(t, 1.85, 2.2));
}
function pathPt(pts, u) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const s = clamp(u) * L[L.length - 1]; let i = 0; while (i < L.length - 2 && L[i + 1] < s) i++;
  const f = (s - L[i]) / (L[i + 1] - L[i] || 1); return { p: [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)], ang: Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]), i, n: Math.ceil(clamp(u) * (pts.length - 1)) };
}
function shotMacro(g, t, piecesOnly = false) {
  buildMacro();
  const u = macroProg(t), tip = pathPt(MAC.path, u);
  const cx = lerp(1000, tip.p[0], .35), cy = lerp(620, tip.p[1], .35), z = 1.25 - .1 * seg(t, 0, 2.4);
  const C = cam(cx, cy, z);
  if (!piecesOnly) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); fillPaper(g, 'rice', 0, 0, W, H, [z * 1.6, 0, 0, z * 1.6, C[4], C[5]]); g.restore(); }
  const pts = MAC.path, done = pts.slice(0, tip.i + 1).concat([tip.p]);
  const A = pts.concat([[2140, -300], [440, -300], [440, 1300]]), B = pts.concat([[2140, 1600], [440, 1600], [440, 1300]]);
  const fly = E_(t, T.lift, T.lift + .55);
  const drawPart = (poly, M, sh) => { g.save(); g.setTransform(...M); g.beginPath(); trace(g, poly); g.clip(); paperShadow(g, M[0], sh); g.drawImage(MAC.sheet.c, 440, -300, 1700, 1500); g.restore(); };
  if (t < T.lift) {
    g.save(); g.setTransform(...C); paperShadow(g, z, 1.2); g.drawImage(MAC.sheet.c, 440, -300, 1700, 1500); noShadow(g);
    // 刀口：已剪开的缝
    g.strokeStyle = '#efe4c8'; g.lineWidth = 3.2; g.lineJoin = 'round'; g.beginPath(); trace(g, done, false); g.stroke();
    g.strokeStyle = 'rgba(90,10,14,.5)'; g.lineWidth = 1; g.translate(1.5, 2); g.beginPath(); trace(g, done, false); g.stroke();
    g.restore();
  } else {
    drawPart(B, mul(C, Tm(-380 * fly, 900 * ei(fly))), 1.2);
    drawPart(A, mul(C, mul(Tm(900 * ei(fly) + 1300, -700 * ei(fly) + 300), mul(R(.5 * fly), Tm(-1300, -300)))), 1.2 + 6 * fly);
  }
  if (piecesOnly) return;
  // 碎纸
  T.snips.forEach((s, k) => {
    if (t < s) return; const v = t - s, p0 = pathPt(MAC.path, macroProg(s)).p;
    const x = p0[0] + 60 * v + Math.sin(v * 7 + k) * 30, y = p0[1] + 30 + 380 * v * v, r = v * 3 + k;
    g.save(); g.setTransform(...mul(C, mul(Tm(x, y), mul(R(r), S(1 + v * .8))))); paperShadow(g, z, 2 + v * 4);
    g.beginPath(); g.moveTo(-26, -8); g.lineTo(22, -18); g.lineTo(10, 20); g.closePath(); g.fillStyle = PAL.red; g.fill(); g.restore();
  });
  // 剪刀：每一剪前 0.12 s 合刃
  if (t < T.lift + .3) {
    let open = .55; for (const s of T.snips) { if (t > s - .12 && t < s) open = lerp(.55, .03, (t - s + .12) / .12); else if (t >= s && t < s + .3) open = lerp(.03, .55, (t - s) / .3); }
    const away = E_(t, T.lift - .2, T.lift + .3);
    drawScissors(g, mul(C, mul(Tm(tip.p[0] - Math.cos(tip.ang) * 130 + 500 * away, tip.p[1] - Math.sin(tip.ang) * 130 - 300 * away), S(6.2))), tip.ang, open, { shadow: 3 });
  }
  if (t < .3) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(0,0,0,${1 - t / .3})`; g.fillRect(0, 0, W, H); g.restore(); }
}

// ===================== S2 片名 =====================
const TITLE = {};
function buildTitle() {
  if (TITLE.l1) return;
  TITLE.l1 = 'NIAN'.split('').map((c, i) => textPiece(c, 250, 800, PAL.red, 'Fraunces', 40 + i));
  TITLE.l2 = 'COMES TO TOWN'.split('').map((c, i) => textPiece(c, 92, 700, PAL.red, 'Fraunces', 60 + i));
  const strip = (w, seed) => piece([0, 0, w, 40], q => { const pts = []; for (let x = 0; x <= w; x += 14) pts.push([x, 6 + (x / 14 % 2) * 8]); pts.push([w, 34]); for (let x = w; x >= 0; x -= 14) pts.push([x, 34 - (x / 14 % 2) * 0]); fill(q, qq => trace(qq, pts), PAL.red); for (let x = 30; x < w - 20; x += 60) { rosette(q, x, 24, 7, 5, 0, .25); } }, { ss: 1.5, seed });
  TITLE.top = strip(1300, 21); TITLE.flower = tuanhua(.6);
  TITLE.seal = piece([0, 0, 110, 110], q => { fill(q, qq => trace(qq, Pl([[0, 0], [110, 0], [110, 110], [0, 110]], true, .6, 4)), PAL.red); q.save(); q.globalCompositeOperation = 'destination-out'; q.font = '400 86px "Ma Shan Zheng"'; q.textAlign = 'center'; q.fillText('年', 55, 88); q.restore(); }, { ss: 2, seed: 23 });
  const mw = (arr, gap) => arr.reduce((s, p) => s + p.w - 20 + gap, 0);
  TITLE.w1 = mw(TITLE.l1, 6); TITLE.w2 = mw(TITLE.l2, 2);
}
function drawTitleCard(g, t) {
  buildTitle();
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); fillPaper(g, 'rice', 0, 0, W, H); g.restore();
  const t0 = T.title, pop = (i, d = .06) => { const u = st(t - t0 - i * d); return u < 0 ? 0 : u < .09 ? 1.18 : 1; };
  // 上下锯齿条
  const sl = E_(t, t0, t0 + .35);
  put(g, TITLE.top, [1, 0, 0, 1, 310 - (1 - sl) * 1500, 150], { shadow: 1 });
  put(g, TITLE.top, [1, 0, 0, -1, 310 + (1 - sl) * 1500, 930], { shadow: 1 });
  let x = 960 - TITLE.w1 / 2;
  TITLE.l1.forEach((p, i) => { const s = pop(i); if (s) put(g, p, [s, 0, 0, s, x + (1 - s) * p.w / 2, 250 + (1 - s) * p.h / 2], { shadow: 1.4 }); x += p.w - 20 + 6; });
  x = 960 - TITLE.w2 / 2;
  TITLE.l2.forEach((p, i) => { const s = pop(i + 4, .04); if (s) put(g, p, [s, 0, 0, s, x, 590], { shadow: 1.1 }); x += p.w - 20 + 2; });
  // 两侧小团花 + 印章
  const fs = pop(4, 0) ? 1 : 0;
  if (t > t0 + .5) { const r = (t - t0) * .08; for (const [fx, d] of [[260, 1], [1660, -1]]) put(g, TITLE.flower, mul([1, 0, 0, 1, fx, 420], mul(R(r * d), S(.3))), { shadow: 1 }); }
  if (t > t0 + .95) { const u = st(t - t0 - .95), s = u < .09 ? 1.5 : 1; put(g, TITLE.seal, [s, 0, 0, s, 1330 - 55 * (s - 1), 700 - 55 * (s - 1)], { shadow: 1 }); }
  if (t > t0 + 1.2) { g.save(); g.globalAlpha = E_(t, t0 + 1.2, t0 + 1.6); g.font = 'italic 500 36px "Fraunces"'; g.fillStyle = '#5a1a12'; g.textAlign = 'center'; g.fillText('a red paper-cut tale for New Year’s Eve', 960, 770); g.restore(); }
}
function shotTitle(g, t) {
  if (t < T.titleFold) { drawTitleCard(g, t); if (t < T.lift + .56) shotMacro(g, t, true); return; }
  // 翻页：右半边向左折过来，露出下面的夜村
  shotVillage(g, Math.max(T.village, t));
  drawTitleCard(TC, t);
  const u = seg(t, T.titleFold, T.titleFold + .38), s = Math.cos(Math.PI * eio(u)), slide = ei(seg(t, T.titleFold + .3, T.village - .02));
  const ox = -slide * 1100;
  g.save(); g.setTransform(1, 0, 0, 1, ox, 0); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 20; g.shadowOffsetX = 6; g.shadowOffsetY = 8;
  g.drawImage(TCc, 0, 0, 960, H, 0, 0, 960, H); g.restore();
  g.save(); g.setTransform(s, 0, 0, 1, 960 + ox, 0);
  if (s > 0) { g.drawImage(TCc, 960, 0, 960, H, 0, 0, 960, H); g.fillStyle = `rgba(40,20,10,${.35 * (1 - s)})`; g.fillRect(0, 0, 960, H); }
  else { fillPaper(g, 'rice', 0, 0, 960, H, [1, 0, 0, 1, 0, 0], `rgba(120,90,60,${.15 + .2 * (1 + s)})`); }
  g.restore();
}

// ===================== 年兽姿势 =====================
function nianLying(extra = {}) { return { ...NPOSE.stand, head: -.5, eye: 'sniff', tail: .3, ...extra }; }
function riseNian(ctx, C, t) {
  const ts = st(t), up = eo(seg(ts, T.rise, T.rise + 1.3)), headUp = E_(ts, T.rise + .5, T.rise + 1.5);
  const walk = seg(ts, T.rise + 1.8, 16.8), step = ts;
  const x = 1250 + 260 * walk, y = 820 + 640 * (1 - up);
  let pose = mix(nianLying(), NPOSE.stalk, headUp);
  pose.eye = t < 13.0 ? 'sniff' : t < 13.5 ? 'normal' : 'sniff';
  if (t > 13.3 && t < 14.0) { const k = Math.sin(seg(t, 13.3, 14.0) * Math.PI); pose.jaw = .38 * k; pose.head = lerp(pose.head, .25, k); pose.eye = 'fierce'; }
  if (t > 14) { const ph = step * 2.2; pose.head += .06 * Math.sin(ph * 3); pose.fnU += .25 * Math.sin(ph * 2); pose.bnU -= .2 * Math.sin(ph * 2); pose.ffU -= .2 * Math.sin(ph * 2); }
  return drawNian(ctx, mul(C, mul(Tm(x, y), mul(S(1.15), Tm(0, -NJ.ground)))), { ...pose, flip: true }, { shadow: 1.6 });
}

// ===================== S3 夜村 =====================
const vCam = track([[T.village, [1000, 560, 1.0]], [10.2, [2150, 560, 1.0]], [12.0, [HERO.x - 110 * HERO.s, GROUND + 25 - 150 * HERO.s, 2.2]]]);
function girlCutting(ctx, M, t) {
  const s = st(t), ph = Math.sin(s * 9);
  return drawGirl(ctx, M, { expr: 'smile', shF: -1.0 + .08 * ph, elF: -1.5 + .1 * ph, handF: 'fist', scissors: { ang: -.3, open: .25 + .25 * Math.max(0, Math.sin(s * 18)) }, shB: -.7, elB: -1.1, handB: 'fist', head: .12 });
}
function shotVillage(g, t) {
  const [x, y, z] = vCam(t); const C = cam(x, y, z);
  drawVillage(g, C, t, {
    nianBehindFar: true, nian: ctx => drawNian(ctx, mul(C, mul(Tm(1250, 820 + 640), mul(S(1.15), Tm(0, -NJ.ground)))), { ...nianLying(), flip: true }, { shadow: 1.4 }),
    hero: 'girl', heroI: 1,
    girlSil: (ctx, HM) => girlCutting(ctx, mul(HM, mul(Tm(-150, 110), S(.78))), t)
  });
}
// ===================== S4 年兽起身 =====================
const rCam = track([[T.rise, [1450, 470, .56]], [14.2, [1500, 500, .6]], [17.0, [1900, 560, .7]]]);
function shake(t, times, a = 5) { let d = 0; for (const s of times) if (t > s && t < s + .35) d += a * Math.exp(-(t - s) * 12) * Math.sin((t - s) * 70); return d; }
function shotRise(g, t) {
  let [x, y, z] = rCam(t); const dy = shake(t, [12.0, 13.2, 14.0, 15.0, 16.0], 6);
  const C = cam(x, y + dy / z, z);
  const heroI = t < T.candleOut ? 1 : t < T.candleOut + .15 ? (1 - (t - T.candleOut) / .15) * (.5 + .5 * Math.sin(t * 80)) : 0;
  drawVillage(g, C, t, {
    nianBehindFar: true, nian: ctx => riseNian(ctx, C, t), nianDark: 'rgb(232,222,236)',
    hero: 'girl', heroI, girlSil: (ctx, HM) => drawGirl(ctx, mul(HM, mul(Tm(-150, 110), S(.78))), { expr: 'scared', shF: -1.6, elF: -1.5, shB: -1.2, elB: -1.6, head: -.1 })
  });
}
// ===================== S5 窗里的眼 =====================
const ROOM = {};
function buildRoom() {
  if (ROOM.frame) return;
  // 方窗框（靛蓝纸），3×3 窗格
  ROOM.frame = piece([-460, -380, 460, 380], q => {
    fill(q, qq => qq.rect(-460, -380, 920, 760), '#2b3668');
    q.save(); q.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) q.fillRect(-420 + i * 280 + 8, -340 + j * 227 + 8, 264, 211);
    q.restore();
    // 窗格上的回纹角花（剪）
    for (let i = 0; i <= 3; i++) for (let j = 0; j <= 3; j++) { const x = -420 + i * 280, y = -340 + j * 227; q.save(); q.fillStyle = '#2b3668'; q.beginPath(); q.arc(x + 4, y + 4, 18, 0, 7); q.fill(); q.restore(); plum(q, x + 4, y + 4, 10); }
  }, { ss: 1.5, seed: 131, col: '#2b3668' });
  ROOM.sill = piece([-700, -30, 700, 60], q => fill(q, qq => trace(qq, Pl([[-700, -20], [700, -20], [700, 50], [-700, 50]], true, .6, 5)), '#303c74'), { ss: 1, seed: 133, col: '#303c74' });
  ROOM.table = piece([-500, -30, 500, 40], q => { fill(q, qq => trace(qq, Pl([[-500, -24], [500, -24], [500, 30], [-500, 30]], true, .5, 6)), '#303c74'); sawRow(q, [[-490, 14], [490, 14]], 10, 12, -1, .7); }, { ss: 1.5, seed: 135, col: '#303c74' });
  ROOM.candle = piece([-30, -150, 30, 10], q => { fill(q, qq => qq.rect(-16, -110, 32, 110), PAL.red); fill(q, qq => qq.rect(-28, -8, 56, 12), '#303c74'); cut(q, qq => { qq.rect(-10, -96, 3, 70); }); plum(q, 0, -60, 8); }, { ss: 2.5, seed: 137 });
  ROOM.flame = [0, 1, 2].map(k => piece([-20, -70, 20, 4], q => { fill(q, qq => { qq.moveTo(0, -62 + k * 4); qq.bezierCurveTo(16 - k * 3, -30, 14, -4, 0, 0); qq.bezierCurveTo(-14, -4, -16 + k * 3, -30, 0, -62 + k * 4); }, '#ffcf6e'); fill(q, qq => qq.ellipse(0, -16, 6, 12, 0, 0, 7), '#fff4d0'); }, { ss: 2.5, seed: 140 + k, edge: 0 }));
  ROOM.paper = piece([-90, -120, 90, 120], q => { fill(q, qq => trace(qq, Pl([[-86, -116], [86, -116], [86, 80], [50, 116], [-86, 116]], true, .6, 7)), PAL.red); fill(q, qq => { qq.moveTo(86, 80); qq.lineTo(50, 116); qq.lineTo(52, 82); qq.closePath(); }, '#e2493e'); }, { ss: 2, seed: 143 });
  ROOM.crackers = piece([-80, -20, 80, 330], q => {
    q.strokeStyle = '#303c74'; q.lineWidth = 4; q.beginPath(); q.moveTo(0, -10); q.lineTo(0, 320); q.stroke();
    for (let i = 0; i < 9; i++) for (const s of [-1, 1]) { const y = 20 + i * 33; q.save(); q.translate(s * 16, y); q.rotate(s * .5); fill(q, qq => qq.rect(-26, -9, 52, 18), PAL.red); cut(q, qq => { qq.rect(-20, -2, 40, 3); }); q.restore(); }
    fill(q, qq => qq.arc(0, -8, 12, 0, 7), PAL.red);
  }, { ss: 2, seed: 145 });
}
function roomBg(g, C, warm) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); fillPaper(g, 'indigo', 0, 0, W, H, C, 'rgba(8,10,26,.35)'); g.restore();
}
function shotEye(g, t) {
  buildRoom();
  beginLight('rgb(170,176,220)');
  const WX = [500, 140, 920, 760];
  // 墙
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); fillPaper(g, 'indigo', 0, 0, W, H, [1, 0, 0, 1, 0, 0], 'rgba(6,8,22,.45)');
  // 窗外：夜空 + 远处黑下来的村子 + 年兽的眼
  g.beginPath(); g.rect(...WX); g.clip();
  fillPaper(g, 'ink', 0, 0, W, H);
  const kk = kit().night; put(g, kk.mid, [.5, 0, 0, .5, 900, 900], { shadow: .6 });
  for (let i = 0; i < 4; i++) { const hp = kk.houses[i]; g.save(); put(g, hp, [.42, 0, 0, .42, 600 + i * 230, 915], { shadow: .5 }); g.fillStyle = '#0c1024'; g.restore(); }
  const inX = eo(seg(t, T.room + .15, T.room + .8)), out = ei(seg(t, 19.0, 19.5));
  const kz = 2.6 * HS, tx = 960 + 252 * kz + 1500 * (1 - inX) - 1700 * out, ty = 520 + 166 * kz + 18 * Math.sin(t * 1.7);
  const Np = buildNian(), blink = t > T.blink && t < T.blink + .22;
  put(g, Np.mane, [kz, 0, 0, kz, tx, ty], { shadow: 1.2 });
  put(g, Np.head[blink ? 'blink' : 'normal'], [kz, 0, 0, kz, tx, ty], { shadow: 1.2 });
  g.restore();
  put(g, ROOM.frame, [1, 0, 0, 1, 960, 520], { shadow: 1.4 });
  put(g, ROOM.sill, [1, 0, 0, 1, 960, 912], { shadow: 1.2 });
  // 前景：女孩缩在窗台下，只露出头顶和眼睛
  const peek = E_(t, 17.25, 17.55) * (1 - .6 * E_(t, 18.35, 18.6));
  drawGirl(g, [2.25, 0, 0, 2.25, 330, 1980 - 250 * peek], { expr: 'scared', head: -.06, shF: -2.3, elF: -1.1, shB: -2.1, elB: -1.2 });
  pool(960, 480, 800, 'rgba(170,180,240,1)', .3);
  applyLight(g);
}
// ===================== S6 下决心 =====================
function shotDecide(g, t) {
  buildRoom();
  const lit = E_(t, T.light, T.light + .25);
  beginLight(`rgb(${lerp(165, 150, lit) | 0},${lerp(170, 132, lit) | 0},${lerp(215, 160, lit) | 0})`);
  const C = cam(960 + 30 * seg(t, T.decide, 24), 540, 1 + .04 * seg(t, T.decide, 24));
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); fillPaper(g, 'indigo', 0, 0, W, H, C, 'rgba(6,8,22,.3)'); g.restore();
  const popS = (t0) => { const u = st(t - t0); return u < 0 ? 1 : u < .09 ? 1.16 : u < .17 ? .96 : 1; };
  put(g, ROOM.paper, mul(C, mul(Tm(1180, 380), mul(R(-.06), S(1.7 * popS(T.red))))), { shadow: 1.3 });
  const jig = t > T.noise ? .08 * Math.sin((t - T.noise) * 30) * Math.exp(-(t - T.noise) * 4) : 0;
  put(g, ROOM.crackers, mul(C, mul(Tm(1640, 120), mul(R(jig), S(1.45 * popS(T.noise))))), { shadow: 1.3 });
  put(g, ROOM.table, mul(C, mul(Tm(1250, 930), S(1.2, 1.3))), { shadow: 1.2 });
  const cs = 1.8 * popS(T.light);
  put(g, ROOM.candle, mul(C, mul(Tm(1420, 900), S(cs))), { shadow: 1.2 });
  const cm = mul(C, mul(Tm(1420, 900 - 110 * cs), S(cs)));
  if (t > T.light) {
    const fk = Math.floor(t * 12) % 3, fl = ROOM.flame[fk], ig = st(t - T.light) < .09 ? 1.6 : 1;
    put(E, fl, mul(cm, S(ig)), { shadow: 0 }); put(g, fl, mul(cm, S(ig)), { shadow: 0 });
    const c = ap(cm, [0, -20]); pool(c[0], c[1], 1300, 'rgba(255,190,115,1)', .95 * lit); lightRect(q => { q.setTransform(...cm); q.ellipse(0, -24, 16, 46, 0, 0, 7); });
  }
  pool(300, 200, 900, 'rgba(150,165,235,1)', .35);   // 窗外夜光
  const e = t < T.red - .35 ? 'scared' : t < T.noise + .15 ? 'surprise' : 'determined';
  const nod = t > T.nod && t < T.nod + .35 ? Math.sin(seg(t, T.nod, T.nod + .35) * Math.PI) * .2 : 0;
  const look = t > T.red - .35 ? .08 : -.08;
  const armP = t < T.red - .35 ? { shF: -.5, elF: -1.5, shB: -.3, elB: -1.5 } : t < T.noise + .15 ? { shF: -.9, elF: -.6, shB: -.4, elB: -1.2 } : { shF: -1.35, elF: -.25, shB: .3, elB: -1.1 };
  drawGirl(g, mul(C, mul(Tm(560, 1245), S(2.5))), { expr: e, head: look + nod, lean: .03, ...armP, handF: t > T.noise ? 'fist' : 'open' });
  applyLight(g);
  bloom(g, .6);
}
// ===================== S8b 贴窗 =====================
function shotPaste(g, t) {
  buildRoom();
  beginLight('rgb(150,132,160)');
  const C = cam(980, 540, 1);
  roomBg(g, C, 1);
  // 圆窗（从里面看，窗纸是暗的）
  g.save(); g.setTransform(...C); g.fillStyle = '#141a38'; g.beginPath(); g.arc(1320, 470, 300, 0, 7); g.fill(); g.restore();
  const ring = kit().night.hero;
  g.save(); g.setTransform(...C); paperShadow(g, 1, 1.2); g.strokeStyle = '#34437f'; g.lineWidth = 34; g.beginPath(); g.arc(1320, 470, 316, 0, 7); g.stroke(); g.restore();
  const u = E_(st(t), T.bloom + .25, T.paste), sw = st(t);
  const pose = mix({ expr: 'determined', lean: -.02, shF: -1.45, elF: -.3, shB: -1.3, elB: -.35, handF: 'flat', handB: 'flat', head: -.05 }, { expr: 'smile', lean: -.06, shF: -1.85, elF: -.2, shB: -1.7, elB: -.25, handF: 'flat', handB: 'flat', head: -.22 }, u);
  const r = drawGirl(g, mul(C, mul(Tm(720, 1250), S(2.4))), pose);
  const fp = lerpA([r.joints.hand[0] + 60, r.joints.hand[1] - 90], [1320, 470], u), fs = lerp(.55, .74, u);
  const pat = t > T.paste && t < T.paste + .15 ? 1.03 : 1;
  put(g, FLOWER, [fs * pat, 0, 0, fs * pat, fp[0], fp[1]], { shadow: 1 + 3 * (1 - u) });
  // 桌上蜡烛在身后
  put(g, ROOM.table, mul(C, Tm(300, 1000)), { shadow: 1.2 });
  put(g, ROOM.candle, mul(C, mul(Tm(360, 975), S(1.3))), { shadow: 1.2 });
  const cm = mul(C, mul(Tm(360, 975 - 143 * 1.3), S(1.3))), fl = ROOM.flame[Math.floor(t * 12) % 3];
  put(g, fl, cm, { shadow: 0 }); put(E, fl, cm, { shadow: 0 });
  pool(360, 780, 1500, 'rgba(255,186,110,1)', .85); lightRect(q => { q.setTransform(...cm); q.ellipse(0, -20, 14, 40, 0, 0, 7); });
  applyLight(g); bloom(g, .5);
}
// ===================== S9 满村红 =====================
const LANTERN = kit().lantern;
function flightPos(h, t, wc, C) {   // 灯笼纹样从窗花飞向第 i 户
  const t1 = h.relit, t0 = t1 - .62, u = seg(t, t0, t1), hp = kit().night.houses[h.i];
  const M = mul(C, mul(Tm(h.x, GROUND), S(h.s))), dst = ap(M, [hp.win.x, hp.win.y]);
  const e = eio(u), x = lerp(wc[0], dst[0], e), y = lerp(wc[1], dst[1], e) - Math.sin(u * Math.PI) * 260 * C[0] * (1 + (h.i % 3) * .3);
  return { u, x, y, on: t > t0 && t < t1 };
}
function nianStand(ctx, C, t, x, pose, s = 1.05) { return drawNian(ctx, mul(C, mul(Tm(x, 900), mul(S(s), Tm(0, -NJ.ground)))), { ...pose, flip: true }, { shadow: 1.6 }); }
const gCam = track([[T.outside, [HERO.x - 120, 620, 1.3]], [32.25, [HERO.x - 200, 610, 1.2]], [33.1, [1800, 560, .68]], [34.0, [1700, 560, .64]]]);
function fireworks(g, C, t, list, sc = 1) {
  for (const [t0, x, y, s] of list) {
    const u = t - t0; if (u < 0 || u > 1.4) continue;
    const open = eo(Math.min(1, u / .35)), a = 1 - seg(u, .7, 1.4);
    const M = mul(C, mul(Tm(x, y + u * 40), mul(R(u * .4), S(s * sc * (.15 + .85 * open)))));
    g.save(); g.globalAlpha = a; put(g, FLOWER, M, { shadow: .6 }); g.restore();
    E.save(); E.globalAlpha = a * .8; put(E, FLOWER, M, { shadow: 0 }); E.restore();
  }
}
function crackers(g, C, t, x0, y0, t0, n = 16, sc = 1) {   // 纸屑爆竹：一串红纸屑炸开 + 闪光
  for (let k = 0; k < n; k++) {
    const tb = t0 + k * .09 + hash(k) * .05, u = t - tb; if (u < 0 || u > .8) continue;
    const bx = x0 + (hash(k * 2.3) - .5) * 260, by = y0 - k * 18;
    for (let j = 0; j < 7; j++) {
      const a = j / 7 * 6.28 + k, d = 80 * eo(Math.min(1, u / .3)) * sc, x = bx + Math.cos(a) * d, y = by + Math.sin(a) * d + 160 * u * u;
      g.save(); g.setTransform(...mul(C, mul(Tm(x, y), mul(R(a + u * 8), S(sc))))); g.globalAlpha = 1 - seg(u, .5, .8);
      g.beginPath(); g.moveTo(-10, -4); g.lineTo(10, -7); g.lineTo(3, 9); g.closePath(); g.fillStyle = PAL.red; g.fill(); g.restore();
    }
    if (u < .12) { const c = ap(C, [bx, by]); E.save(); E.setTransform(1, 0, 0, 1, 0, 0); E.globalCompositeOperation = 'lighter'; const gr = E.createRadialGradient(c[0], c[1], 0, c[0], c[1], 90 * C[0] * sc); gr.addColorStop(0, `rgba(255,236,190,${1 - u / .12})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); E.fillStyle = gr; E.fillRect(c[0] - 200, c[1] - 200, 400, 400); E.restore(); }
  }
}
function shotGlow(g, t) {
  const [x, y, z] = gCam(t), C = cam(x, y, z);
  const I = t < T.outside + .12 ? E_(t, T.outside, T.outside + .12) * 1.3 : 1 + .25 * Math.exp(-(t - T.outside - .12) * 4);
  drawVillage(g, C, t, {
    hero: 'flower', heroI: Math.min(1.25, I), rays: .6, nianDark: 'rgb(215,200,222)', flowerE: .55,
    nian: ctx => nianStand(ctx, C, t, 1180, { ...NPOSE.stalk, head: -.1 + .05 * Math.sin(st(t) * 6), eye: t > 33.3 ? 'normal' : 'sniff' }, 1.1),
    front: (gg, { wc }) => {
      for (const h of HOUSES) { const f = flightPos(h, t, wc, C); if (!f.on) continue; const s = C[0] * 1.5 * (1 + Math.sin(f.u * Math.PI) * .6); put(gg, LANTERN, [s, 0, 0, s, f.x, f.y - 40 * s], { shadow: 2 }); put(E, LANTERN, [s, 0, 0, s, f.x, f.y - 40 * s], { shadow: 0 }); }
      crackers(gg, C, t, HERO.x + 200, GROUND - 40, 33.4, 10, 1.2);
    },
    after: (gg) => { }
  });
}
function shotNianClose(g, t) {
  const C = cam(1300 - 30 * seg(t, 34, 35.3), 300, 1.08 + .05 * seg(t, 34, 35.3));
  const fl = t > T.flinch;
  const pose = fl ? { ...NPOSE.flinch, lean: .06, head: .1 + .025 * Math.sin(st(t) * 20) } : { ...NPOSE.stalk, head: -.12, eye: 'normal' };
  if (fl && st(t - T.flinch) < .17) pose.head = .24;   // 被照到的一缩
  let NM;
  drawVillage(g, C, t, {
    hero: 'flower', heroI: 1.1, nianDark: 'rgb(150,126,172)', bloom: .5,
    nian: ctx => (NM = drawNian(ctx, mul(C, mul(Tm(700, 900), mul(S(1.2), Tm(0, -NJ.ground)))), { ...pose, flip: true }, { shadow: 1.6 })),
    sky: gg => fireworks(gg, C, t, [[33.6, 2000, -80, .45], [34.5, 1750, -220, .35]]),
    lights: () => { pool(2100, 420, 1300, 'rgba(255,170,100,1)', .7); },
    after: (gg) => {
      const fc = ap(NM.M.head, [-420, -30]), k = C[0] * .5, ec = ap(NM.M.head, [-280, -120]);
      addMasked(gg, SPOT, [340 * C[0], 0, 0, 300 * C[0], ec[0], ec[1]], NLc, 'rgb(255,120,70)', .75);
      const PM = [k, .05 * k, -.04 * k, k * .97, fc[0], fc[1]];
      addMasked(gg, HOLES, PM, NLc, 'rgb(255,200,140)', .85, .5);
      addMasked(gg, HOLES, PM, NLc, 'rgb(255,110,50)', .4, 6);
      // 光从右边窗口来：一道暖色斜光
      gg.save(); gg.setTransform(1, 0, 0, 1, 0, 0); gg.globalCompositeOperation = 'lighter'; const gr = gg.createLinearGradient(1920, 400, 900, 300); gr.addColorStop(0, 'rgba(255,170,90,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 1920, 1080); gg.restore();
    },
    front: (gg) => { crackers(gg, C, t, 1750, 560, 34.05, 12, 1.4); crackers(gg, C, t, 1450, 640, 34.55, 10, 1.2); }
  });
}
function shotFlee(g, t) {
  const C = cam(1500, 560, .62);
  const u = seg(st(t), T.flee, 37.8), turn = t < T.flee + .25;
  const s = st(t), ph = s * 12;
  const run = { ...NPOSE.run, fnU: -.9 + .9 * Math.sin(ph), fnL: .6 - .5 * Math.sin(ph), ffU: .6 - .9 * Math.sin(ph), bnU: .9 * Math.sin(ph + 1.5), bnL: -.4, bfU: -.7 * Math.sin(ph + 1.5), lean: .05 * Math.sin(ph * 2) };
  const x = 1250 - 900 * eio(u), sc = 1.05 * (1 - .55 * u), y = 900 - 330 * u - Math.abs(Math.sin(ph)) * 20 * (1 - u);
  drawVillage(g, C, t, {
    hero: 'flower', heroI: 1, rays: .3, nianDark: 'rgb(215,200,222)',
    nian: ctx => drawNian(ctx, mul(C, mul(Tm(x, y), mul(S(sc), Tm(0, -NJ.ground)))), turn ? { ...NPOSE.flinch, flip: true } : { ...run, flip: false }, { shadow: 1.4 }),
    sky: gg => fireworks(gg, C, t, [[T.fireworks[0], 1300, 180, .5], [T.fireworks[1], 2100, 120, .42], [T.fireworks[2], 1650, 90, .55], [T.fireworks[2] + .45, 900, 160, .36]]),
    front: (gg) => {
      crackers(gg, C, t, HERO.x + 200, GROUND - 40, 35.4, 14, 1.2);
      const sp = st(t), hop = Math.abs(Math.sin(sp * 7)) * 26;
      drawGirl(gg, mul(C, mul(Tm(HERO.x - 380, GROUND + 60 - hop), S(1.45))), { flip: true, expr: 'smile', shF: -2.8 + .2 * Math.sin(sp * 7), elF: -.3, shB: -2.5, elB: -.4, handF: 'fist', scissors: { ang: -1.2, open: .5 }, hipF: -.1, hipB: .1 });
    }
  });
}
// ===================== S10 天亮 =====================
const [NCc, NC] = canvas(W, H);
function sun(g, C, t) {
  const u = eo(seg(t, T.sunUp - .4, T.asleep)), c = ap(C, [1500, 560 - 330 * u]), r = 120 * C[0] / .62 * .6;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.translate(c[0], c[1]);
  g.fillStyle = PAL.gold; paperShadow(g, 1, 1);
  g.beginPath(); for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283, rr = r * (i % 2 ? 1.28 : 1.02); g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill();
  noShadow(g); g.fillStyle = '#e8bf5a'; g.beginPath(); g.arc(0, 0, r * .8, 0, 7); g.fill();
  g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.beginPath(); g.ellipse(Math.cos(a) * r * .55, Math.sin(a) * r * .55, r * .12, r * .05, a, 0, 7); g.fill(); }
  g.restore();
}
function dayScene(g, t, C) { return drawVillage(g, C, t, { pal: 'day', snow: false, sky: gg => sun(gg, C, t) }); }
function shotDawn(g, t) {
  const C = cam(1500, 560, .62 + .03 * seg(t, T.dawn, T.asleep));
  dayScene(g, t, C);
  const u = eio(seg(t, T.dawn + .1, T.dawn + 1.3));
  if (u < 1) {
    // 夜纸从右上角揭起：折线 x - y = m，m 从 1940 扫到 -1100
    drawVillage(NC, C, T.dawn, { hero: 'flower', heroI: 1, snow: true });
    const m = lerp(1940, -1100, u);
    g.save(); g.beginPath(); trace(g, [[-3000, -3000 - m], [3000, 3000 - m], [-3000, 3000]]); g.clip(); g.drawImage(NCc, 0, 0); g.restore();
    let poly = [[0, 0], [1920, 0], [1920, 1080], [0, 1080]], out = [];
    const f = p => p[0] - p[1] - m;
    for (let i = 0; i < poly.length; i++) { const A = poly[i], B = poly[(i + 1) % poly.length], fa = f(A), fb = f(B); if (fa >= 0) out.push(A); if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k]); } }
    if (out.length > 2) {
      const fl = out.map(([x, y]) => [y + m, x - m]);
      g.save(); g.shadowColor = 'rgba(10,6,20,.55)'; g.shadowBlur = 30; g.shadowOffsetX = -10; g.shadowOffsetY = 14;
      g.beginPath(); trace(g, fl); g.fillStyle = '#56639c'; g.fill(); g.restore();
      g.save(); g.beginPath(); trace(g, fl); g.clip(); fillPaper(g, 'indigo', 0, 0, 1920, 1080, [1, 0, 0, 1, 0, 0], 'rgba(140,155,210,.45)'); g.restore();
    }
  }
}
function shotAsleep(g, t) {
  buildRoom();
  const C = cam(960, 540, 1 + .03 * seg(t, T.asleep, T.reveal));
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); fillPaper(g, 'rice', 0, 0, W, H, C, 'rgba(210,160,110,.12)'); g.restore();
  beginLight('rgb(250,244,232)');
  const win = { x: 1290, y: 420, r: 300 };
  const fl = { p: FLOWER, M: [win.r / 400, 0, 0, win.r / 400, win.x, win.y] };
  glowWindow(g, C, win, 1, fl, { tcol: '#c92a1c' }); glowWindow(E, C, win, .28, fl, { tcol: '#c92a1c' });
  g.save(); g.setTransform(...C); paperShadow(g, 1, 1.2); g.strokeStyle = '#b8191b'; g.lineWidth = 32; g.beginPath(); g.arc(win.x, win.y, win.r + 16, 0, 7); g.stroke(); g.restore();
  // 桌 + 女孩趴着睡
  const br = Math.sin(st(t) * 2.6) * .02;
  drawGirl(g, mul(C, mul(Tm(640, 1330), S(2.35))), { expr: 'sleep', lean: .22 + br * .5, head: .42 + br, shF: -1.3, elF: -.4, shB: -1.2, elB: -.5, handF: 'fist', handB: 'open' });
  const tb = ROOM.tableDay || (ROOM.tableDay = piece([-800, -30, 800, 300], q => { fill(q, qq => trace(qq, Pl([[-800, -24], [800, -24], [800, 300], [-800, 300]], true, .6, 9)), '#b8191b'); sawRow(q, [[-790, 8], [790, 8]], 12, 14, 1, .7); }, { ss: 1, seed: 151 }));
  put(g, tb, mul(C, Tm(760, 930)), { shadow: 1.5 });
  drawScissors(g, mul(C, mul(Tm(1110, 915), S(2.4))), .15, .12, { shadow: 1.2 });
  pool(1290, 420, 1300, 'rgba(255,236,200,1)', .3);
  applyLight(g); bloom(g, .3);
}
// ===================== S11 尺度揭示 =====================
const [SCc, SC] = canvas(W, H);
const REAL = {};
function buildReal() {
  if (REAL.wood) return;
  const [c, q] = canvas(512, 512); q.fillStyle = '#6b4526'; q.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 2) { q.fillStyle = `rgba(${40 + (hash(y) * 30) | 0},${22 + (hash(y * 1.3) * 16) | 0},10,${.15 + hash(y * .7) * .25})`; q.fillRect(0, y + Math.sin(y * .05) * 2, 512, 1 + hash(y * 3.1) * 2); }
  REAL.wood = c;
  REAL.ring = piece([-470, -470, 470, 470], q2 => {
    const out = [], inn = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * 6.283, k = Math.abs(Math.cos(a * 12)); out.push([Math.cos(a) * (430 + 26 * Math.pow(k, .6)), Math.sin(a) * (430 + 26 * Math.pow(k, .6))]); inn.push([Math.cos(a) * 392, Math.sin(a) * 392]); }
    q2.beginPath(); trace(q2, out); trace(q2, inn.reverse()); q2.fillStyle = PAL.red; q2.fill('evenodd');
    sawRow(q2, (() => { const p = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * 6.283; p.push([Math.cos(a) * 400, Math.sin(a) * 400]); } return p; })(), 12, 9, -1, .7);
    for (let i = 0; i < 36; i++) { const a = i / 36 * 6.283; crescent(q2, Math.cos(a) * 418, Math.sin(a) * 418, 12, a + Math.PI - 1, a + Math.PI + 1, 4); }
  }, { ss: 1.6, seed: 161 });
  REAL.couplet = piece([0, 0, 90, 700], q2 => { fill(q2, qq => trace(qq, Pl([[0, 0], [90, 0], [90, 700], [0, 700]], true, .6, 3)), PAL.sub); for (let k = 0; k < 5; k++) rosette(q2, 45, 90 + k * 130, 26, 8, k * .3, .2); for (let k = 0; k < 30; k++) { q2.fillStyle = 'rgba(222,178,84,.5)'; q2.beginPath(); q2.arc(10 + hash(k) * 70, hash(k * 3) * 700, 1.5, 0, 7); q2.fill(); } }, { ss: 1.5, seed: 163 });
  REAL.title = textPiece('RED PAPER-CUT', 88, 800, '#fff1d6', 'Fraunces', 5, 6);
}
function realScissors(g, x, y, s, a) {
  g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
  g.shadowColor = 'rgba(40,20,5,.45)'; g.shadowBlur = 14; g.shadowOffsetX = 10; g.shadowOffsetY = 14;
  for (const k of [-1, 1]) {
    g.save(); g.rotate(k * .12);
    const gr = g.createLinearGradient(0, -10, 0, 10); gr.addColorStop(0, '#dfe3e8'); gr.addColorStop(.5, '#8a929c'); gr.addColorStop(1, '#4a5058');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -5 * k); g.lineTo(150, -1 * k); g.lineTo(152, 0); g.lineTo(0, 6 * k); g.closePath(); g.fill();
    g.fillStyle = '#2b2f35'; g.beginPath(); g.ellipse(-60, 16 * k, 30, 18, .3 * k, 0, 7); g.ellipse(-60, 16 * k, 20, 10, .3 * k, 0, 7, true); g.fill('evenodd');
    g.fillRect(-40, -3 + 6 * k, 42, 6);
    g.restore();
  }
  g.fillStyle = '#c9ccd0'; g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill();
  g.restore();
}
function shotReveal(g, t) {
  buildReal();
  const u = eio(seg(t, T.reveal + .1, 45.6)), k = lerp(1.55, .42, u);
  // 1) 渲染白天的村子（窗花内容）
  dayScene(SC, t, cam(1800, 700, .8));
  // 2) 墙（真实：暖白灰泥 + 阳光）
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#e9dfcc'; g.fillRect(0, 0, W, H);
  const cx = 960, cy = lerp(540, 470, u);
  // 3) 木格窗：窗户纸发光（背光） + 木格
  const winW = 1500 * k * 1.25, winH = 1180 * k * 1.25;
  g.save(); g.translate(cx, cy);
  const gl = g.createRadialGradient(0, -winH * .2, 0, 0, 0, winW * .8); gl.addColorStop(0, '#fffaf0'); gl.addColorStop(1, '#f6dcaa');
  g.fillStyle = gl; g.fillRect(-winW / 2, -winH / 2, winW, winH);
  // 窗花 = 村子画面裁成圆，背光（提亮、偏暖）
  const rr = 392 * k * 1.25;
  g.save(); g.beginPath(); g.arc(0, 0, rr, 0, 7); g.clip(); g.filter = `brightness(${lerp(1, 1.12, u)}) saturate(${lerp(1, 1.18, u)})`;
  const sk = k * 1.25 * 392 / 540; g.drawImage(SCc, -960 * sk, -540 * sk, W * sk, H * sk); g.filter = 'none';
  g.globalCompositeOperation = 'soft-light'; g.fillStyle = `rgba(255,190,110,${.35 * u})`; g.fillRect(-rr, -rr, rr * 2, rr * 2);
  g.restore();
  put(g, REAL.ring, [k * 1.25, 0, 0, k * 1.25, cx, cy], { shadow: 1 }); g.setTransform(1, 0, 0, 1, cx, cy);
  // 木格
  const woodPat = g.createPattern(REAL.wood, 'repeat');
  g.fillStyle = woodPat; g.shadowColor = 'rgba(40,20,5,.5)'; g.shadowBlur = 16 * k; g.shadowOffsetX = 8 * k; g.shadowOffsetY = 10 * k;
  const bw = 34 * k * 1.25;
  g.beginPath(); g.rect(-winW / 2 - bw, -winH / 2 - bw, winW + 2 * bw, winH + 2 * bw); g.rect(-winW / 2, -winH / 2, winW, winH); g.fill('evenodd');
  for (const fx of [-1, 1]) { g.fillRect(fx * rr * 1.06 - (fx > 0 ? 0 : bw * .6), -winH / 2, bw * .6, winH); }
  for (const fy of [-1, 1]) { g.fillRect(-winW / 2, fy * rr * 1.04 - (fy > 0 ? 0 : bw * .6), winW, bw * .6); }
  g.restore();
  // 窗台 + 真剪刀 + 红纸屑
  const sy = cy + winH / 2 + bw;
  g.fillStyle = g.createPattern(REAL.wood, 'repeat'); g.shadowColor = 'rgba(40,20,5,.4)'; g.shadowBlur = 20; g.shadowOffsetY = 10;
  g.fillRect(cx - winW / 2 - bw * 3, sy, winW + bw * 6, 60 * k * 1.25 + 30); g.shadowColor = 'transparent';
  if (u > .3) {
    realScissors(g, cx + winW * .18, sy + 14, k * 1.3, -.08);
    for (let i = 0; i < 14; i++) { const x = cx - winW * .3 + hash(i) * winW * .45, y = sy + 6 + hash(i * 2) * 26 * k; g.save(); g.translate(x, y); g.rotate(hash(i * 3) * 6); g.fillStyle = PAL.red; g.shadowColor = 'rgba(40,10,5,.4)'; g.shadowBlur = 4; g.shadowOffsetY = 3; g.beginPath(); g.moveTo(-12 * k, -3); g.lineTo(12 * k, -6 * k); g.lineTo(3, 9 * k); g.closePath(); g.fill(); g.restore(); }
  }
  // 阳光斜光束 + 暖色
  g.globalCompositeOperation = 'soft-light'; const sl = g.createLinearGradient(0, 0, W, H); sl.addColorStop(0, 'rgba(255,220,160,.5)'); sl.addColorStop(1, 'rgba(120,80,40,.4)'); g.fillStyle = sl; g.fillRect(0, 0, W, H);
  g.restore();
  // 4) 片尾：对联 + 横批 + 落款
  const e = E_(t, T.end - .4, T.end + .1), ban = st(t - T.end);
  if (t > T.end - .4) {
    const cy2 = cy;
    put(g, REAL.couplet, [1, 0, 0, 1, cx - winW / 2 - bw - 150 - (1 - e) * 400, cy2 - 350], { shadow: 1.2 });
    put(g, REAL.couplet, [1, 0, 0, 1, cx + winW / 2 + bw + 60 + (1 - e) * 400, cy2 - 350], { shadow: 1.2 });
  }
  if (t > T.end) {
    const drop = ban < .09 ? -40 : ban < .17 ? 8 : 0;
    const bwid = 900; const [bc, bg2] = [null, null];
    g.save(); g.shadowColor = 'rgba(40,10,5,.45)'; g.shadowBlur = 12; g.shadowOffsetX = 5; g.shadowOffsetY = 8;
    g.fillStyle = PAL.sub; const y0 = 26 + drop; g.beginPath(); trace(g, Pl([[960 - bwid / 2, y0], [960 + bwid / 2, y0], [960 + bwid / 2 - 30, y0 + 64], [960 + bwid / 2, y0 + 128], [960 - bwid / 2, y0 + 128], [960 - bwid / 2 + 30, y0 + 64]], true, .8, 3)); g.fill(); g.restore();
    put(g, REAL.title, [1, 0, 0, 1, 960 - REAL.title.w / 2, 26 + drop + 10], { shadow: .6 });
    g.save(); g.globalAlpha = E_(t, T.end + .4, T.end + .9); g.font = '600 38px "Fraunces"'; g.fillStyle = '#4a1a10'; g.textAlign = 'center'; g.fillText('LemoLab × Claude Opus 5.5', 960, 1050); g.restore();
  }
}

// ===================== 调度 =====================
const SHOT = { macro: shotMacro, title: shotTitle, village: shotVillage, rise: shotRise, eye: shotEye, decide: shotDecide, fold: (g, t) => drawFold(g, t), paste: shotPaste, glow: shotGlow, nianClose: shotNianClose, flee: shotFlee, dawn: shotDawn, asleep: shotAsleep, reveal: shotReveal };
function render(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; noShadow(g);
  const [a, b, name] = shotAt(t);
  (SHOT[name])(g, t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; noShadow(g);
  if (qs.get('nosub') !== '1') drawSubs(g, t, SUBS);
  if (qs.get('poster') === '1') {   // 海报：顶部红纸横批片名
    const tp = textPiece('NIAN COMES TO TOWN', 92, 800, '#fff1d6', 'Fraunces', 7, 4), w = tp.w + 140, x0 = 960 - w / 2;
    g.save(); g.shadowColor = 'rgba(20,4,8,.5)'; g.shadowBlur = 14; g.shadowOffsetX = 5; g.shadowOffsetY = 8; g.fillStyle = PAL.sub;
    g.beginPath(); trace(g, Pl([[x0, 40], [x0 + w, 40], [x0 + w - 36, 110], [x0 + w, 180], [x0, 180], [x0 + 36, 110]], true, .8, 3)); g.fill(); g.restore();
    put(g, tp, [1, 0, 0, 1, 960 - tp.w / 2, 52], { shadow: .5 });
    g.save(); g.font = 'italic 500 30px "Fraunces"'; g.fillStyle = '#fff1d6'; g.textAlign = 'center'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 8; g.fillText('Red Paper-cut  ·  LemoLab × Claude Opus 5.5', 960, 222); g.restore();
  }
}
// 事件（拟音 / 旁白）
const EV = [];
T.snips.forEach(s => EV.push({ t: s, type: 'snip', big: 1 }));
EV.push({ t: T.lift, type: 'paperwhoosh' });
EV.push({ t: T.title, type: 'place' }); EV.push({ t: T.title + .95, type: 'stamp' });
EV.push({ t: T.titleFold, type: 'pageturn' });
EV.push({ t: T.village, type: 'windbed', dur: 10 });
[12.0, 13.2, 14.0, 15.0, 16.0].forEach(s => EV.push({ t: s, type: 'thud' }));
EV.push({ t: 13.3, type: 'growl' });
HOUSES.forEach(h => EV.push({ t: h.out, type: 'puff' })); EV.push({ t: T.candleOut, type: 'puff' });
EV.push({ t: T.room, type: 'windbed', dur: 2.5, gain: .7 }); EV.push({ t: T.room + .2, type: 'breath' }); EV.push({ t: T.blink, type: 'blink' }); EV.push({ t: 18.8, type: 'breath' });
EV.push({ t: T.red, type: 'paperpop' }); EV.push({ t: T.light - .08, type: 'match' }); EV.push({ t: T.noise, type: 'rattle' });
T.folds.forEach(s => EV.push({ t: s, type: 'fold' }));
for (let s = T.cut0 + .25; s < T.cut1; s += .25) EV.push({ t: s, type: 'snip' });
T.unfolds.forEach(s => EV.push({ t: s, type: 'unfold' })); EV.push({ t: T.bloom, type: 'bloom' });
EV.push({ t: T.paste, type: 'pat' });
EV.push({ t: T.outside, type: 'glowon' });
T.lanterns.forEach(s => EV.push({ t: s, type: 'lanternarrive' }));
EV.push({ t: 33.4, type: 'crackers', dur: 1.2 }); EV.push({ t: 34.1, type: 'crackers', dur: 1.4 }); EV.push({ t: 34.6, type: 'crackers', dur: 1 }); EV.push({ t: 35.4, type: 'crackers', dur: 1.4 });
EV.push({ t: T.flinch, type: 'yelp' });
T.fireworks.forEach(s => EV.push({ t: s, type: 'firework' })); EV.push({ t: T.fireworks[2] + .45, type: 'firework' });
[35.5, 36.1, 36.7, 37.3].forEach(s => EV.push({ t: s, type: 'thud', gain: .4 }));
EV.push({ t: T.dawn + .1, type: 'peel' }); EV.push({ t: 39.2, type: 'bird' }); EV.push({ t: 40.3, type: 'bird' });
EV.push({ t: T.reveal, type: 'roomtone', dur: 6.5 });
EV.push({ t: T.end, type: 'place' });
VO.forEach(v => EV.push({ t: v.t, type: 'vo', id: v.id }));
if (!TEST) { window.EV = EV; window.DUR = DUR; window.render = render; window.READY = true; }
