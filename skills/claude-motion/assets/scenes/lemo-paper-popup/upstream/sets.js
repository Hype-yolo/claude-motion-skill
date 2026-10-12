// 四个跨页：页面美术 + 立体弹出件 + 会动的机关
import * as THREE from 'three';
import * as A from './art.js';
import { cv, paperFill, INK, blob, sh, smoothOpen, GRAIN } from './paper.js';
import { mulberry, clamp, lerp, seg, back, ss, eio, TAU, spring } from './lib.js';
import { BW, BD, texOf } from './book.js';
import { cutMesh, thread, blobShadow } from './cutmesh.js';
import { OPEN, TURNS } from './story.js';

const PW = 2048, PH = Math.round(2048 * BD / BW);
const gx = xm => (xm / BW + .5) * PW, gz = zm => zm / BD * PH, sy = ym => (1 - ym / BD) * PH;

// 每个跨页出现 / 收起的时间
export const RISE = [OPEN[0] + 1.3, TURNS[0][1] - .9, TURNS[1][1] - .9, TURNS[2][1] - .9];
export const FOLD = [TURNS[0][0], TURNS[1][0], TURNS[2][0], 1e9];

// ---------- 页面美术 ----------
function page(fn, seed) { const c = cv(PW, PH), x = c.getContext('2d'); fn(x); x.save(); x.globalAlpha = .7; x.fillStyle = x.createPattern(GRAIN, 'repeat'); x.fillRect(0, 0, PW, PH); x.restore(); return c; }
function grad(x, stops) { const g = x.createLinearGradient(0, 0, 0, PH); stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, PW, PH); }
function softClouds(x, seed, col = 'rgba(255,255,255,.55)', n = 7, y0 = .1, y1 = .55) {
  const R = mulberry(seed);
  for (let i = 0; i < n; i++) { const cx = R() * PW, cy = PH * (y0 + R() * (y1 - y0)), w = 180 + R() * 260; x.fillStyle = col; for (let k = 0; k < 5; k++) { x.beginPath(); x.ellipse(cx + (k - 2) * w * .22, cy - Math.sin(k / 4 * Math.PI) * w * .12, w * .2, w * .13, 0, 0, TAU); x.fill(); } }
}
function birds(x, seed, n = 5) {
  const R = mulberry(seed); x.strokeStyle = 'rgba(60,70,90,.55)'; x.lineWidth = 5; x.lineCap = 'round';
  for (let i = 0; i < n; i++) { const px = PW * (.2 + R() * .6), py = PH * (.15 + R() * .25), s = 14 + R() * 10; x.beginPath(); x.moveTo(px - s, py); x.quadraticCurveTo(px - s * .4, py - s * .6, px, py); x.quadraticCurveTo(px + s * .4, py - s * .6, px + s, py); x.stroke(); }
}
function dots(x, seed, n, cols, y0 = 0, y1 = PH, r0 = 5, r1 = 11) {
  const R = mulberry(seed);
  for (let i = 0; i < n; i++) { x.beginPath(); x.arc(R() * PW, y0 + R() * (y1 - y0), r0 + R() * (r1 - r0), 0, TAU); x.fillStyle = cols[(R() * cols.length) | 0]; x.fill(); }
}
function pathStroke(x, pts, w, col, edge) {
  x.lineCap = 'round'; x.lineJoin = 'round';
  if (edge) { x.beginPath(); smoothOpen(x, pts); x.lineWidth = w + 14; x.strokeStyle = edge; x.stroke(); }
  x.beginPath(); smoothOpen(x, pts); x.lineWidth = w; x.strokeStyle = col; x.stroke();
}
function stripes(x, col, n = 9, a = .1) { for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * .5})`; x.fillRect(0, PH * i / n, PW, PH / n); } }

export function pages() {
  const P = {};
  P.sky0 = page(x => { grad(x, [[0, '#7cc6ef'], [.7, '#c9ecf7'], [1, '#e8f7ee']]); softClouds(x, 3); birds(x, 4); }, 1);
  P.ground0 = page(x => {
    grad(x, [[0, '#86c763'], [1, '#9fd57a']]); stripes(x, '#fff', 10, .06);
    pathStroke(x, [[gx(-.13), gz(.09)], [gx(-.11), gz(.15)], [gx(-.02), gz(.17)], [gx(.03), gz(.22)], [gx(.0), gz(.3)]], 120, '#ecd49a', '#d6b877');
    dots(x, 5, 160, ['#ffffff', '#ffe066', '#ff9ec1'], 0, PH, 5, 10);
  }, 2);
  P.sky1 = page(x => {
    grad(x, [[0, '#a8e0cf'], [.75, '#e3f5df'], [1, '#f2f7df']]);
    x.save(); x.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { x.beginPath(); const x0 = PW * (.1 + i * .2); x.moveTo(x0, 0); x.lineTo(x0 + 140, 0); x.lineTo(x0 + 420, PH); x.lineTo(x0 + 220, PH); x.closePath(); x.fillStyle = 'rgba(255,255,230,.10)'; x.fill(); } x.restore();
    const R = mulberry(8); x.fillStyle = '#b6ddc6';
    for (let i = 0; i < 26; i++) { const px = R() * PW, h = PH * (.35 + R() * .3), w = 60 + R() * 60; x.beginPath(); x.moveTo(px, PH - h); x.lineTo(px + w, PH); x.lineTo(px - w, PH); x.closePath(); x.fill(); }
  }, 3);
  P.ground1 = page(x => {
    grad(x, [[0, '#4f8f46'], [1, '#62a653']]); stripes(x, '#fff', 8, .05);
    pathStroke(x, [[gx(-.25), gz(.15)], [gx(-.1), gz(.16)], [gx(.05), gz(.14)], [gx(.25), gz(.155)]], 150, '#c9a877', '#a8875a');
    dots(x, 9, 220, ['#e8a33a', '#c9612e', '#f2c14e', '#7a4a2a'], 0, PH, 6, 12);
  }, 4);
  P.sky2day = page(x => {
    grad(x, [[0, '#4fb3ea'], [.8, '#bfe9fa'], [1, '#e6f8fb']]);
    const g = x.createRadialGradient(PW * .75, PH * .3, 0, PW * .75, PH * .3, 500); g.addColorStop(0, 'rgba(255,250,210,.9)'); g.addColorStop(1, 'rgba(255,250,210,0)'); x.fillStyle = g; x.fillRect(0, 0, PW, PH);
    x.beginPath(); x.arc(PW * .75, PH * .3, 90, 0, TAU); x.fillStyle = '#fff4c2'; x.fill();
    softClouds(x, 12, 'rgba(255,255,255,.7)', 6, .12, .5); birds(x, 13, 4);
  }, 5);
  P.sky2night = page(x => {
    grad(x, [[0, '#131d44'], [.7, '#2d3f7a'], [1, '#4a5a94']]);
    const R = mulberry(21); for (let i = 0; i < 260; i++) { x.beginPath(); x.arc(R() * PW, R() * PH * .85, .8 + R() * 2.6, 0, TAU); x.fillStyle = `rgba(255,248,220,${.3 + R() * .6})`; x.fill(); }
    x.save(); x.globalAlpha = .12; x.fillStyle = '#c8d4ff'; x.beginPath(); x.ellipse(PW * .5, PH * .35, PW * .6, 90, -.25, 0, TAU); x.fill(); x.restore();
  }, 6);
  P.ground2 = page(x => {
    grad(x, [[0, '#3a86cf'], [1, '#2e6fb3']]);
    const R = mulberry(31); x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 6; x.lineCap = 'round';
    for (let i = 0; i < 90; i++) { const px = R() * PW, py = R() * PH; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 30, py - 16, px + 60, py); x.stroke(); }
  }, 7);
  P.sky3 = page(x => {
    paperFill(x, PW, PH, '#f5eedc', 41, .05);
    const pen = (fn, a = .5, w = 4) => { x.save(); fn(); x.lineWidth = w; x.strokeStyle = `rgba(70,72,82,${a})`; x.lineCap = 'round'; x.stroke(); x.restore(); };
    pen(() => { x.beginPath(); x.arc(PW * .78, PH * .28, 110, -.3, Math.PI * 1.4); });
    pen(() => { x.beginPath(); x.arc(PW * .78, PH * .28, 112, Math.PI * 1.45, Math.PI * 1.6); }, .25);
    for (const [cx, cy, s] of [[.22, .22, 1], [.5, .14, .7]]) pen(() => { x.beginPath(); x.arc(PW * cx - 70 * s, PH * cy + 10, 50 * s, Math.PI, 0); x.arc(PW * cx, PH * cy - 20 * s, 70 * s, Math.PI * 1.1, -.1); x.arc(PW * cx + 80 * s, PH * cy + 10, 45 * s, Math.PI * 1.3, .2); }, .35);
    // 橡皮擦痕
    x.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 4; i++) { x.save(); x.translate(PW * (.3 + i * .15), PH * (.4 + (i % 2) * .15)); x.rotate(-.3); x.fillRect(-90, -24, 180, 48); x.restore(); }
    x.font = 'italic 46px "IM Fell English"'; x.fillStyle = 'rgba(80,70,60,.55)'; x.textAlign = 'center'; x.fillText('(to be continued…?)', PW * .5, PH * .62);
  }, 8);
  P.ground3 = page(x => {
    paperFill(x, PW, PH, '#f5eedc', 43, .05);
    const pen = (fn, a = .45, w = 4) => { x.save(); fn(); x.lineWidth = w; x.strokeStyle = `rgba(70,72,82,${a})`; x.lineCap = 'round'; x.stroke(); x.restore(); };
    pen(() => { x.beginPath(); x.moveTo(gx(-.24), gz(.13)); x.bezierCurveTo(gx(-.1), gz(.12), gx(-.06), gz(.18), gx(-.03), gz(.2)); });
    pen(() => { x.beginPath(); x.moveTo(gx(-.24), gz(.17)); x.bezierCurveTo(gx(-.12), gz(.16), gx(-.08), gz(.2), gx(-.06), gz(.215)); }, .3);
    x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = '#2d241e';
    x.font = 'italic 230px "IM Fell English"'; x.fillText('The End', PW * .5, gz(.262));
    x.strokeStyle = '#2d241e'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(PW * .38, gz(.279)); x.bezierCurveTo(PW * .44, gz(.272), PW * .47, gz(.286), PW * .5, gz(.279)); x.bezierCurveTo(PW * .53, gz(.272), PW * .56, gz(.286), PW * .62, gz(.279)); x.stroke();
    x.beginPath(); x.arc(PW * .5, gz(.279), 7, 0, TAU); x.fillStyle = '#2d241e'; x.fill();
    x.font = '40px "IM Fell English"'; x.fillStyle = 'rgba(45,36,30,.8)'; x.fillText('33', PW * .93, gz(.29));
  }, 9);
  return P;
}

// ---------- 弹出件 ----------
// dir: -1 向后倒（平躺时正面朝上），+1 向前倒（正面朝下）
function popper(list, spread, parent, item, x, y, z, o = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const m = cutMesh(item, o); if (o.flip) m.scale.x = -1; if (o.ry) m.rotation.y = o.ry;
  g.add(m); parent.add(g);
  const rec = { g, m, spread, d: o.d ?? 0, dir: o.dir ?? (z > .15 ? -1 : 1), sway: o.sway || 0, ph: o.ph ?? x * 40, pop: o.pop !== false, upd: o.upd };
  list.push(rec); return rec;
}
function riseOf(r, t) {
  const t0 = RISE[r.spread] + r.d, tf = FOLD[r.spread] + (.3 - r.g.position.z) * .6;
  const up = r.pop ? back(seg(t, t0, t0 + .55), 1.7) : (t >= t0 ? 1 : 0);
  const dn = 1 - ss(seg(t, tf, tf + .4));
  return Math.min(up, dn);
}

export function buildSets(book, A2) {
  const L = [];            // 所有弹出件
  const S = book.stage, K = book.sky;
  const ex = {};           // 需要单独驱动的部件

  // ===== 跨页 0：纸片谷 =====
  const s0 = 0, dz = z => (.3 - z) * 1.2;   // 由后往前依次弹起
  popper(L, s0, S, A.hill(.24, .075, '#b5e39a', '#93cc78', 11, { bumps: 2 }), -.12, 0, .014, { d: dz(.014) });
  popper(L, s0, S, A.hill(.26, .085, '#a9dd8c', '#88c46c', 12, { bumps: 3 }), .09, 0, .016, { d: dz(.016) + .05 });
  popper(L, s0, S, A.hill(.2, .05, '#8fd06e', '#6fb553', 13, { bumps: 2, dots: ['#fff', '#ffe066'] }), -.15, 0, .045, { d: dz(.045) });
  popper(L, s0, S, A.hill(.22, .045, '#8fd06e', '#6fb553', 14, { bumps: 2, dots: ['#fff', '#ff9ec1'] }), .13, 0, .048, { d: dz(.048) });
  popper(L, s0, S, A.lolliTree(.065, '#5cbf4a', '#3f9934', 21), -.03, 0, .058, { d: dz(.058), sway: .03 });
  popper(L, s0, S, A.lolliTree(.05, '#6fcc55', '#4ea93e', 22), .175, 0, .06, { d: dz(.06), sway: .03 });
  popper(L, s0, S, A.pine(.07, '#3f9f5a', '#2e7c45', 23), -.205, 0, .07, { d: dz(.07), sway: .02 });
  ex.house = popper(L, s0, S, A.mushHouse(.078), -.13, 0, .085, { d: dz(.085) });
  // 门：左边铰链
  const doorItem = A.door(.0262);
  { const g = new THREE.Group(); const m = cutMesh({ ...doorItem, ax: (doorItem.pad / A.PPM) / doorItem.w }, { backCol: '#8a5a34' }); g.add(m); g.position.set(-.078 * .12, 0, .0006); ex.house.g.add(g); ex.door = g; }
  const win = A.windowGlow(.0045); { const m = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.h), new THREE.MeshBasicMaterial({ map: texOf(win.c), transparent: true, depthWrite: false, color: new THREE.Color(2.2, 1.7, .9) })); m.position.set(.078 * .18, .078 * .3, .0007); m.material.opacity = 0; ex.house.g.add(m); ex.win = m; }
  popper(L, s0, S, A.fence(.06, .016), -.055, 0, .1, { d: dz(.1) });
  popper(L, s0, S, A.sign(.036, 'Papervale'), -.005, 0, .118, { d: dz(.118) });
  // 河：三条波浪
  ex.river = [];
  for (let k = 0; k < 3; k++) ex.river.push(popper(L, s0, S, A.waveStrip(.19, .014 + k * .002, ['#8fd3f4', '#6cbcea', '#4aa3e0'][k], ['#6cbcea', '#4aa3e0', '#2f86c6'][k], 40 + k, 7), .13, 0, .1 + k * .02, { d: dz(.1 + k * .02), dir: 1 }));
  // 前景
  const R0 = mulberry(90);
  for (let i = 0; i < 9; i++) { const x = -.2 + i * .05 + (R0() - .5) * .02; popper(L, s0, S, A.flower(.016 + R0() * .008, ['#ff7aa8', '#ffd23f', '#ffffff', '#b58cff'][i % 4], i), x, 0, .2 + R0() * .05, { d: dz(.22), sway: .08 }); }
  popper(L, s0, S, A.bush(.07, .03, '#4fae4c', '#3a8a3a', 31, '#e8413a'), -.17, 0, .265, { d: dz(.265) });
  popper(L, s0, S, A.bush(.06, .026, '#5cbb52', '#44953e', 32), .15, 0, .27, { d: dz(.27) });
  // 太阳（插在木棍上，从远山后面升起）
  { const it = A.sunOnStick(.02, .085); const g = new THREE.Group(); g.add(cutMesh(it)); g.position.set(.06, -.12, .008); S.add(g); ex.sun = g; }
  // 挂在线上的云（背景页上）
  ex.clouds = [];
  for (const [x, y, w, sd] of [[-.12, .205, .06, 1], [.13, .225, .05, 2], [-.01, .25, .04, 3]]) {
    const g = new THREE.Group(), it = A.cloud(w, sd); const m = cutMesh(it); g.add(m);
    const th = thread(.2); th.position.set(-w * .15, 0, -.0004); g.add(th); const th2 = thread(.2); th2.position.set(w * .2, 0, -.0004); g.add(th2);
    g.position.set(x, y, .03); K.add(g); ex.clouds.push({ g, y, ph: x * 30 });
  }

  // ===== 跨页 1：窃窃私语森林 =====
  const s1 = 1;
  const R1 = mulberry(7);
  for (let i = 0; i < 12; i++) popper(L, s1, S, A.pine(.12 + R1() * .04, '#8cc9a0', '#74b38a', 100 + i), -.23 + i * .042, 0, .012 + (i % 2) * .004, { d: dz(.012), sway: .01 });
  for (let i = 0; i < 8; i++) popper(L, s1, S, A.pine(.1 + R1() * .035, '#3f9a5c', '#2f7c47', 120 + i), -.21 + i * .06 + (R1() - .5) * .02, 0, .04 + (i % 2) * .006, { d: dz(.04), sway: .015 });
  popper(L, s1, S, A.lolliTree(.07, '#2f8f55', '#236b40', 130), -.08, 0, .075, { d: dz(.075), sway: .02 });
  popper(L, s1, S, A.lolliTree(.06, '#4aa35a', '#347f44', 131), .16, 0, .078, { d: dz(.078), sway: .02 });
  popper(L, s1, S, A.mushroom(.028, '#f08a2e', 1), -.15, 0, .1, { d: dz(.1) });
  popper(L, s1, S, A.mushroom(.02, '#e8513f', 2), -.13, 0, .105, { d: dz(.105) });
  popper(L, s1, S, A.log(.07), .03, 0, .1, { d: dz(.1) });
  popper(L, s1, S, A.mushroom(.024, '#b58cff', 3), .19, 0, .11, { d: dz(.11) });
  for (const [x, z, h] of [[-.2, .2, .022], [-.11, .215, .018], [.09, .21, .02], [.2, .205, .024]]) popper(L, s1, S, A.fern(h, 140 + Math.round(x * 100)), x, 0, z, { d: dz(z), sway: .05 });
  for (const [x, z] of [[-.16, .125], [.15, .128]]) popper(L, s1, S, A.fern(.02, 160 + Math.round(x * 100)), x, 0, z, { d: dz(z), sway: .04 });

  // ===== 跨页 2：哗啦哗啦海 =====
  const s2 = 2;
  popper(L, s2, S, A.island(.07), .15, 0, .016, { d: dz(.016) });
  popper(L, s2, S, A.island(.045), -.17, 0, .014, { d: dz(.014) });
  ex.waves = [];
  const wz = [.03, .075, .115, .175, .235], wc = [['#9ad8f5', '#76c2ec'], ['#79c3ee', '#55aee4'], ['#58ade3', '#3d93d2'], ['#3f95d6', '#2c79bd'], ['#2f7fc4', '#1f62a3']];
  for (let k = 0; k < 5; k++) ex.waves.push(popper(L, s2, S, A.waveStrip(.5, [.03, .026, .022, .016, .012][k], wc[k][0], wc[k][1], 60 + k, 16), 0, 0, wz[k], { d: dz(wz[k]), dir: 1 }));
  // 翻转天空板（三面翻广告牌）
  ex.slats = [];
  { const day = null; }
  // 月亮、星星（挂线）
  ex.stars = [];
  { const it = A.moon(.018); const g = new THREE.Group(); g.add(cutMesh(it)); const th = thread(.2); th.position.set(.005, 0, -.0004); g.add(th); g.position.set(-.12, .4, .025); K.add(g); ex.moon = g; }
  const R2 = mulberry(55);
  for (let i = 0; i < 9; i++) { const it = A.star(.004 + R2() * .004); const g = new THREE.Group(); g.add(cutMesh(it)); const th = thread(.25); th.position.set(0, 0, -.0004); g.add(th); g.position.set(-.2 + i * .05 + (R2() - .5) * .02, .4, .02 + R2() * .02); K.add(g); ex.stars.push({ g, y: .16 + R2() * .1, d: i * .12 + R2() * .2, ph: R2() * 9 }); }

  // ===== 跨页 3：最后一页 =====
  const s3 = 3;
  popper(L, s3, S, A.sketchTree(.07), -.14, 0, .05, { d: dz(.05) });
  popper(L, s3, S, A.sketchHouse(.05), .13, 0, .06, { d: dz(.06) });
  popper(L, s3, S, A.sketchTree(.05), .19, 0, .09, { d: dz(.09) });

  return { L, ex };
}

// 三面翻天空板：需要 day/night 两张大图的纹理
export function buildSlats(book, dayTex, nightTex, ex) {
  const n = 4, w = (BW - .006) / n, h = BD - .03;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group(); g.position.set(-BW / 2 + .003 + w * (i + .5), .03 + h / 2, .004);
    const mk = (tex, side, flipU) => {
      const geo = new THREE.PlaneGeometry(w, h); const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) { const u = uv.getX(k), v = uv.getY(k); const uu = (i + (flipU ? 1 - u : u)) / n; uv.setXY(k, uu, (.03 + v * h) / BD); }
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: .9, side })); m.receiveShadow = true; m.castShadow = true; return m;
    };
    g.add(mk(dayTex, THREE.FrontSide, false)); g.add(mk(nightTex, THREE.BackSide, true));
    book.sky.add(g); ex.slats.push(g);
  }
}

// 每帧：弹出件
export function updatePops(L, t) {
  for (const r of L) {
    const k = riseOf(r, t);
    r.g.visible = k > .002;
    if (!r.g.visible) continue;
    r.g.rotation.x = r.dir * (Math.PI / 2) * (1 - k);
    if (r.sway) r.m.rotation.z = Math.sin(t * 1.6 + r.ph) * r.sway * k;
  }
}
export { riseOf };
