// 岛：六边形柱地块布局 + 全部低多边形道具 + 生长日程（每个生长事件带音高 → 配乐旋律声部）
import * as THREE from 'three';
import { clamp, seg, ss, eo, eio, lerp, hash, TAU } from '/core/lib.js';
import { T, BEAT, BAR, bar, noteAt, DUR } from './story.js';
import { waveH } from './sea.js';

const SQ3 = Math.sqrt(3);
export const hex2w = (q, r) => [SQ3 * (q + r / 2), 1.5 * r];
const hdist = (q, r) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));

// —— 材质（全部 flatShading，无贴图）——
const MC = new Map();
export function mat(hex, o = {}) {
  const k = hex + JSON.stringify(o);
  if (!MC.has(k)) MC.set(k, new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: .88, metalness: 0, ...o }));
  return MC.get(k);
}
const jit = (hex, a) => { const c = new THREE.Color(hex), h = {}; c.getHSL(h); c.setHSL(h.h, h.s, clamp(h.l * (1 + a))); return '#' + c.getHexString(); };
const M = (g, m, cast = true) => { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = true; return x; };

export const PAL = {
  sandTop: '#f3dfab', sandSide: '#e2c68e', grassTop: '#93c96c', grassTop2: '#7fbd62', earth: '#c99c6e', earth2: '#b88a5e',
  rockTop: '#b4b8bd', rockSide: '#8f949c', stone: '#d9d5cc',
  walls: ['#fbf3e6', '#f5c2b0', '#b5dccb', '#a9cbe8', '#f7df8f', '#fbf3e6', '#e9c9e6', '#f5c2b0'],
  roofs: ['#d9644a', '#4f7fb8', '#e0874f', '#6a5a8e', '#c9504a', '#3f8f86', '#d9644a', '#4f7fb8'],
  pine: ['#3f8a5a', '#4f9c63'], leaf: ['#7fc36a', '#9ad06f', '#6fb35e'], trunk: '#8a5a3c',
  win: '#4d5c74', warm: '#ffc676', wood: '#a8764e', woodDark: '#7d5436',
};

// —— 布局 ——
// 半径 3 的六边形去掉 4 个海岸格；中心 = 礁石山顶（空着的灯塔石台）；第 2 圈 12 格正好每 30° 一格：
// 灯塔光束每拍扫过一格（一圈 = 12 拍 = 3 小节），8 栋房子站在其中 8 格上 = 八音盒的 8 个音
const REMOVE = new Set(['0,-3', '-3,0', '3,-3', '-1,3']);
const FIRST = '3,-1', DOCK = '-3,2';
export const BEAM_NOTES = [74, 78, null, 81, 83, null, 81, 78, null, 76, 74, null];   // 第 2 圈第 k 格（k=拍）→ 音高；null = 非房子
const RING2_ROLE = { 2: 'tree', 5: 'mill', 8: 'tree', 11: 'tree' };

function buildLayout() {
  const cells = [];
  for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) {
    const d = hdist(q, r); if (d > 3 || REMOVE.has(q + ',' + r)) continue;
    const [x, z] = hex2w(q, r), key = q + ',' + r, ang = Math.atan2(z, x);
    let type = 'grass', h = .78;
    if (d === 0) { type = 'rock'; h = 1.95; }
    else if (d === 1) { h = [1.38, 1.12, 1.3, 1.1, 1.26, 1.16][(Math.round((ang + TAU) / (TAU / 6)) % 6)]; }
    else if (d === 2) { h = .74 + (hash(q * 7 + r * 13) > .5 ? .16 : 0); }
    else { type = 'sand'; h = .36 + hash(q * 3 + r * 5) * .06; if (key === '-2,-1' || key === '-3,1') { type = 'rock'; h = .62; } }
    cells.push({ q, r, d, x, z, ang, key, type, h });
  }
  // 第 2 圈按角度编号（从 +x 方向逆时针，k = 光束扫到它的拍）
  cells.filter(c => c.d === 2).forEach(c => { c.k = Math.round(((c.ang + TAU) % TAU) / (TAU / 12)) % 12; });
  return cells;
}
export const CELLS = buildLayout();
const byKey = k => CELLS.find(c => c.key === k);

// —— 几何件 ——
function hexPrism(r, h, top, side, y0 = -2.4) {
  const g = new THREE.Group();
  const bt = h - .1;   // 侧面柱体顶面藏在草皮/沙皮帽里，避免 z-fighting
  const body = M(new THREE.CylinderGeometry(r * .985, r * .985, bt - y0, 6, 1), mat(side));
  body.position.y = (bt + y0) / 2; g.add(body);
  const cap = M(new THREE.CylinderGeometry(r, r, .16, 6, 1), mat(top)); cap.position.y = h - .08; g.add(cap);
  return g;
}
function gable(w, d, h, over = .08) {   // 双坡屋顶：沿 x 的三棱柱（坡面），两端山墙另做
  const W = w / 2 + over, D = d / 2 + over, g = new THREE.BufferGeometry();
  const v = [-W, 0, -D, W, 0, -D, W, h, 0, -W, 0, -D, W, h, 0, -W, h, 0, -W, 0, D, -W, h, 0, W, h, 0, -W, 0, D, W, h, 0, W, 0, D,
    -W, 0, -D, -W, 0, D, W, 0, D, -W, 0, -D, W, 0, D, W, 0, -D];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
}
function gableEnds(w, d, h) {
  const W = w / 2, D = d / 2, g = new THREE.BufferGeometry();
  const v = [W, 0, -D, W, 0, D, W, h, 0, -W, 0, D, -W, 0, -D, -W, h, 0];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
}

function makeHouse(i, floors, winMat) {
  const root = new THREE.Group(), parts = [];
  const wall = mat(PAL.walls[i % 8]), W = .92, FH = .62;
  for (let f = 0; f < floors; f++) {
    const fl = new THREE.Group();
    const body = M(new THREE.BoxGeometry(W, FH, W), wall); body.position.y = FH / 2; fl.add(body);
    const wg = new THREE.PlaneGeometry(.17, .23);
    for (let s = 0; s < 4; s++) {
      const a = s * Math.PI / 2, n = s === 0 && f === 0 ? 1 : 2;
      for (let j = 0; j < n; j++) {
        const wm = new THREE.Mesh(wg, winMat), off = n === 1 ? .2 : (j - .5) * .42;
        wm.position.set(Math.sin(a) * (W / 2 + .004) + Math.cos(a) * off, FH * .55, Math.cos(a) * (W / 2 + .004) - Math.sin(a) * off); wm.rotation.y = a; fl.add(wm);
      }
      if (s === 0 && f === 0) {   // 门
        const door = new THREE.Mesh(new THREE.PlaneGeometry(.2, .36), mat(PAL.woodDark)); door.position.set(Math.sin(a) * (W / 2 + .004) - .18 * Math.cos(a), .18, Math.cos(a) * (W / 2 + .004) + .18 * Math.sin(a)); door.rotation.y = a; fl.add(door);
      }
    }
    fl.position.y = f * FH; root.add(fl); parts.push({ obj: fl, y: f * FH, kind: 'floor' });
  }
  const roof = new THREE.Group();
  roof.add(M(gable(W, W, .5), mat(PAL.roofs[i % 8]))); roof.add(M(gableEnds(W - .01, W - .01, .5), wall));
  roof.position.y = floors * FH; root.add(roof); parts.push({ obj: roof, y: floors * FH, kind: 'roof' });
  return { root, parts, top: floors * FH + .5 };
}

function makeTree(kind, s) {
  const g = new THREE.Group();
  if (kind === 'pine') {
    const tr = M(new THREE.CylinderGeometry(.06, .08, .3, 5), mat(PAL.trunk)); tr.position.y = .15; g.add(tr);
    const c1 = M(new THREE.ConeGeometry(.36, .62, 6), mat(PAL.pine[0])); c1.position.y = .55; g.add(c1);
    const c2 = M(new THREE.ConeGeometry(.26, .5, 6), mat(PAL.pine[1])); c2.position.y = .92; c2.rotation.y = .5; g.add(c2);
  } else if (kind === 'palm') {
    const tr = M(new THREE.CylinderGeometry(.045, .07, .9, 5), mat('#b98b5e')); tr.position.set(.08, .45, 0); tr.rotation.z = -.18; g.add(tr);
    for (let k = 0; k < 5; k++) {
      const lf = M(new THREE.ConeGeometry(.09, .6, 3), mat(PAL.leaf[k % 3])); const a = k / 5 * TAU;
      lf.position.set(.16 + Math.cos(a) * .22, .92, Math.sin(a) * .22); lf.rotation.set(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25); g.add(lf);
    }
  } else {
    const tr = M(new THREE.CylinderGeometry(.06, .08, .34, 5), mat(PAL.trunk)); tr.position.y = .17; g.add(tr);
    const c = M(new THREE.IcosahedronGeometry(.36, 0), mat(PAL.leaf[Math.floor(s * 3) % 3])); c.position.y = .6; c.rotation.set(s * 3, s * 5, 0); g.add(c);
  }
  return g;
}

function makeMill() {
  const g = new THREE.Group();
  const tower = M(new THREE.CylinderGeometry(.24, .36, 1.2, 6), mat('#f4efe4')); tower.position.y = .6;
  const cap = M(new THREE.ConeGeometry(.33, .4, 6), mat('#c9504a')); cap.position.y = 1.4;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(.12, .16), null);
  const hub = new THREE.Group(); hub.position.set(0, 1.18, .34);
  const hubC = M(new THREE.CylinderGeometry(.06, .06, .1, 6), mat(PAL.woodDark)); hubC.rotation.x = Math.PI / 2; hub.add(hubC);
  for (let k = 0; k < 4; k++) {
    const b = new THREE.Group(); b.rotation.z = k * Math.PI / 2;
    const spar = M(new THREE.BoxGeometry(.04, .78, .03), mat(PAL.wood)); spar.position.y = .4; b.add(spar);
    const sail = M(new THREE.BoxGeometry(.18, .5, .015), mat('#fbf6ea')); sail.position.set(.1, .48, 0); b.add(sail);
    hub.add(b);
  }
  g.add(tower, cap, hub);
  return { g, tower, cap, hub, win };
}

function makeBoat() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const hg = new THREE.BoxGeometry(.95, .24, .42, 2, 1, 1), p = hg.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); if (x > .3) p.setZ(i, p.getZ(i) * .15); if (p.getY(i) < 0) p.setZ(i, p.getZ(i) * .7); }
  hg.computeVertexNormals();
  const hull = M(hg, mat('#d9644a')); hull.position.y = .1; body.add(hull);
  const rim = M(new THREE.BoxGeometry(.7, .04, .36), mat('#f4efe4')); rim.position.set(-.08, .23, 0); body.add(rim);
  const mast = M(new THREE.CylinderGeometry(.018, .022, .9, 5), mat(PAL.woodDark)); mast.position.set(-.02, .66, 0); body.add(mast);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -.5, 0, 0, 0, .72, 0, 0, 0, 0, 0, .72, 0, -.5, 0, 0], 3)); sg.computeVertexNormals();
  const sail = M(sg, mat('#fbf6ea', { side: THREE.DoubleSide })); sail.position.set(-.04, .3, 0); body.add(sail);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, .07), new THREE.MeshStandardMaterial({ color: '#ffe6a8', emissive: '#ffc676', emissiveIntensity: 0, flatShading: true }));
  lamp.position.set(.3, .32, 0); body.add(lamp);
  return { g, body, sail, lamp };
}

function makeLighthouse() {
  const g = new THREE.Group(), rings = [];
  const R = [[.5, .45], [.45, .41], [.41, .37], [.37, .34]], H = .44;
  R.forEach(([rb, rt], i) => { const m = M(new THREE.CylinderGeometry(rt, rb, H, 8), mat(i % 2 ? '#d9544a' : '#f6f2ea')); m.position.y = H / 2; const w = new THREE.Group(); w.add(m); w.position.y = i * H; g.add(w); rings.push({ obj: w, y: i * H }); });
  const top = new THREE.Group(); top.position.y = 4 * H;
  const gal = M(new THREE.CylinderGeometry(.46, .46, .06, 8), mat('#3d4250')); gal.position.y = .03; top.add(gal);
  const glassM = new THREE.MeshStandardMaterial({ color: '#fff3cf', emissive: '#ffe2a0', emissiveIntensity: 0, flatShading: true, roughness: .3 });
  const glass = M(new THREE.CylinderGeometry(.26, .26, .34, 8), glassM, false); glass.position.y = .23; top.add(glass);
  const cap = M(new THREE.ConeGeometry(.36, .34, 8), mat('#d9544a')); cap.position.y = .57; top.add(cap);
  const ball = M(new THREE.IcosahedronGeometry(.05, 0), mat('#3d4250')); ball.position.y = .76; top.add(ball);
  g.add(top); rings.push({ obj: top, y: 4 * H, top: true });
  return { g, rings, glassM, lampY: 4 * H + .23 };
}

// 光束：水平锥体（加色、沿长度衰减）+ 海面上的扇形光斑
function beamMats() {
  const vs = `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
  const cone = new THREE.ShaderMaterial({   // 朝向相机的柔边光带：横向高斯 × 纵向衰减
    uniforms: { amt: { value: 0 }, len: { value: 60 }, soft: { value: 4.5 }, gain: { value: 1 }, col: { value: new THREE.Color('#fff1c8') } },
    vertexShader: `attribute float across; varying float vA; varying float vX; void main(){ vA = across; vX = position.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying float vA; varying float vX; uniform float amt, len, soft, gain; uniform vec3 col; void main(){ float s = clamp(vX / len, 0., 1.);
      float core = pow(1. - s, 1.7) * .42 + exp(-s * 10.) * .75;   // 根部亮、远端淡
      float dust = .86 + .14 * sin(vX * 1.3) * sin(vX * .37 + 1.7);
      float a = exp(-vA * vA * soft) * core * dust * gain * amt * smoothstep(0., .012, s); gl_FragColor = vec4(col * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const pool = new THREE.ShaderMaterial({
    uniforms: { amt: { value: 0 }, len: { value: 60 }, hw: { value: .12 }, col: { value: new THREE.Color('#ffe9b8') } }, vertexShader: vs,
    fragmentShader: `varying vec3 vP; uniform float amt, len, hw; uniform vec3 col; void main(){ float r = length(vP.xz); float s = r / len; float a0 = abs(atan(vP.z, vP.x));
      float edge = smoothstep(hw, hw * .45, a0); float a = edge * pow(1. - clamp(s, 0., 1.), 1.3) * smoothstep(.02, .08, s) * .5 * amt; gl_FragColor = vec4(col * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  return { cone, pool };
}

export function buildWorld(scene) {
  const W = {};
  const S = new THREE.Group(); scene.add(S);

  // —— 地块 ——
  const tiles = CELLS.map(c => {
    const j = (hash(c.q * 17 + c.r * 31) - .5) * .08;
    let top = PAL.grassTop, side = PAL.earth;
    if (c.type === 'sand') { top = PAL.sandTop; side = PAL.sandSide; }
    if (c.type === 'rock') { top = PAL.rockTop; side = PAL.rockSide; }
    if (c.type === 'grass' && hash(c.q * 5 - c.r * 11) > .55) top = PAL.grassTop2;
    const g = hexPrism(1, c.h, jit(top, j), jit(side, j * .7)); g.position.set(c.x, 0, c.z); S.add(g);
    // 岸边浪花环
    const foam = new THREE.Mesh(new THREE.RingGeometry(.99, 1.12, 6, 1, Math.PI / 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .0, depthWrite: false }));
    foam.rotation.x = -Math.PI / 2; foam.position.set(c.x, .07, c.z); S.add(foam);
    return { c, g, foam, t0: 99 };
  });
  // 中心石台（灯塔地基，全片前半段一直空着）
  const center = byKey('0,0');
  const plinth = M(new THREE.CylinderGeometry(.56, .62, .14, 8), mat(PAL.stone)); plinth.position.set(0, center.h + .07, 0);
  tiles.find(t => t.c.key === '0,0').g.add(plinth); plinth.position.set(0, center.h + .07, 0);

  // —— 生长日程 ——
  const EVS = [];   // {t, type, note?, v?, ...}
  const ev = (t, type, o = {}) => { EVS.push({ t: +t.toFixed(4), type, ...o }); return t; };
  const first = byKey(FIRST);
  const order = CELLS.filter(c => c.key !== FIRST && c.key !== '0,0')
    .map(c => ({ c, s: Math.hypot(c.x - first.x, c.z - first.z) + hash(c.q * 13.1 + c.r * 7.7) * 2.2 })).sort((a, b) => a.s - b.s).map(o => o.c);
  const slots = [[bar(0), [first]], [bar(0) + 2 * BEAT, [order.shift()]]];
  for (let i = 0; i < 4; i++) slots.push([bar(1) + i * BEAT, [order.shift(), order.shift()]]);
  slots.push([bar(2), [center]]);
  const rest = order.length;
  for (let i = 1; i < 8; i++) { const n = Math.round(rest * i / 7) - Math.round(rest * (i - 1) / 7); slots.push([bar(2) + i * BEAT / 2, order.splice(0, n)]); }
  const CONT = [.35, .6, .45, .8, .55, .95, .7, .5, .65, .85, .4, .75, .6, 1];
  slots.forEach(([t, cs], i) => {
    const hAvg = cs.reduce((a, c) => a + c.h, 0) / cs.length;
    let note = noteAt(t, clamp(CONT[i % CONT.length] * .7 + (1 - (hAvg - .36) / 1.6) * .3), 50, 74);
    if (i === 0) note = 50; if (cs[0] === center) note = 38;
    ev(t, 'rise', { note, n: cs.length, v: clamp(.45 + hAvg * .35), big: i === 0 || cs[0] === center ? 1 : 0 });
    cs.forEach(c => { tiles.find(x => x.c === c).t0 = t; });
  });

  // —— 第 2 圈：房子 / 风车 / 树 ——
  const ring2 = CELLS.filter(c => c.d === 2).sort((a, b) => a.k - b.k);
  const houses = [], trees = [];
  const HF = [2, 1, 2, 1, 1, 2, 1, 2];
  const hOrder = [3, 0, 6, 1, 7, 4, 2, 5];   // 建造顺序（打乱）；光束顺序 = 空间顺序 = 旋律顺序
  let hi = 0;
  for (const c of ring2) {
    if (BEAM_NOTES[c.k] != null) {
      const winMat = new THREE.MeshStandardMaterial({ color: PAL.win, emissive: PAL.warm, emissiveIntensity: 0, flatShading: true, roughness: .4 });
      const h = makeHouse(hi, HF[hi], winMat);
      const out = Math.atan2(c.x, c.z);   // 门朝外
      h.root.position.set(c.x, c.h, c.z); h.root.rotation.y = out + (hash(hi) - .5) * .3; S.add(h.root);
      const pl = new THREE.PointLight('#ffb766', 0, 4.2, 1.6); pl.position.set(c.x * 1.18, c.h + .45, c.z * 1.18); S.add(pl);
      houses.push({ c, ...h, winMat, note: BEAM_NOTES[c.k], idx: hi, pl, lit: 99, hits: [] }); hi++;
    }
  }
  // 每个部件独占一个十六分音符格：楼层 = 木块声（和弦低音），屋顶 = 这栋房子自己的旋律音
  let hSlot = 0; const S16 = i => T.houses + i * BEAT / 4;
  hOrder.forEach(hIdx => {
    const H = houses[hIdx];
    H.parts.forEach((p, pi) => { const t = S16(hSlot++); p.t0 = t; ev(t, p.kind === 'roof' ? 'roof' : 'floor', p.kind === 'roof' ? { note: H.note, v: .8, house: H.idx } : { v: .7, note: noteAt(t, .15 + pi * .2, 50, 66) }); });
  });
  const DET0 = hSlot;   // 细节从房子之后的下一个十六分格开始

  // 树（第 1 圈大部分、第 2 圈的空格、沙滩上两棵椰子）
  const treeSpots = [];
  CELLS.filter(c => c.d === 1).forEach((c, i) => { if (i === 4) return; const n = c.h > 1.25 ? 2 : 1; for (let k = 0; k < n; k++) treeSpots.push({ c, kind: c.h > 1.25 ? 'pine' : 'round', dx: n > 1 ? (k - .5) * .5 : (hash(i) - .5) * .3, dz: n > 1 ? (hash(i + k) - .5) * .4 : (hash(i + 9) - .5) * .3 }); });
  ring2.filter(c => RING2_ROLE[c.k] === 'tree').forEach((c, i) => treeSpots.push({ c, kind: i === 1 ? 'pine' : 'round', dx: 0, dz: 0 }));
  ['2,1', '-1,-2'].forEach(k => { const c = byKey(k); if (c) treeSpots.push({ c, kind: 'palm', dx: 0, dz: 0 }); });
  treeSpots.sort((a, b) => ((a.c.ang + TAU + 1) % TAU) - ((b.c.ang + TAU + 1) % TAU));
  const TC = [1, 1, 2, 1, 2, 1, 2, 2], tn = treeSpots.length; let ti = 0;
  TC.forEach((n, i) => {
    const t = T.trees + i * BEAT / 2; const cnt = i === 7 ? tn - ti : Math.min(n, tn - ti);
    for (let k = 0; k < cnt; k++) {
      const sp = treeSpots[ti++]; const g = makeTree(sp.kind, hash(ti * 3.1)); g.position.set(sp.c.x + sp.dx, sp.c.h, sp.c.z + sp.dz); g.rotation.y = hash(ti) * TAU; g.scale.setScalar(0); S.add(g);
      trees.push({ g, t0: t, s: .9 + hash(ti * 7) * .25 });
    }
    if (cnt > 0) ev(t, 'pop', { note: noteAt(t, i / 7, 69, 88), n: cnt, v: .7 });
  });

  // 风车
  const millC = ring2.find(c => RING2_ROLE[c.k] === 'mill');
  const mill = makeMill(); mill.g.position.set(millC.x, millC.h, millC.z); mill.g.rotation.y = Math.atan2(millC.x, millC.z) + .5; S.add(mill.g);

  // 码头：从 DOCK 沙滩格向外铺 4 块木板
  const dc = byKey(DOCK), dAng = Math.atan2(dc.z, dc.x) + .12, dDir = [Math.cos(dAng), Math.sin(dAng)];
  const planks = [];
  for (let k = 0; k < 4; k++) {
    const g = new THREE.Group(), d0 = .75 + k * .56;
    const pl = M(new THREE.BoxGeometry(.54, .07, .62), mat(k % 2 ? PAL.wood : '#b8845a')); pl.position.y = .42; g.add(pl);
    for (const s of [-1, 1]) { const post = M(new THREE.CylinderGeometry(.04, .04, .9, 5), mat(PAL.woodDark)); post.position.set(.22, 0, s * .27); g.add(post); }
    g.position.set(dc.x + dDir[0] * d0, 0, dc.z + dDir[1] * d0); g.rotation.y = -dAng; S.add(g); planks.push({ g, t0: 99 });
  }
  const dockEnd = [dc.x + dDir[0] * (.75 + 3 * .56 + .55), dc.z + dDir[1] * (.75 + 3 * .56 + .55) + .5];

  // 灯柱（沙滩上 3 盏）
  const lampSpots = ['-2,3', '1,2', '-3,3'].map(byKey).filter(Boolean);
  const lampMat = new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: PAL.warm, emissiveIntensity: 0, flatShading: true });
  const lamps = lampSpots.map((c, i) => {
    const g = new THREE.Group(); const post = M(new THREE.CylinderGeometry(.025, .03, .55, 5), mat('#3d4250')); post.position.y = .27; g.add(post);
    const head = M(new THREE.OctahedronGeometry(.07, 0), lampMat, false); head.position.y = .6; g.add(head);
    g.position.set(c.x + .35, c.h, c.z - .2); g.scale.setScalar(0); S.add(g); return { g, t0: 99 };
  });
  // 烟囱（3 栋房子）
  const chims = [0, 2, 5].map(i => { const H = houses[i]; const ch = M(new THREE.BoxGeometry(.12, .3, .12), mat('#b0786a')); ch.position.set(.22, H.top - .2, .15); H.root.add(ch); ch.scale.setScalar(0); return { ch, H, t0: 99 }; });
  // 花与篱笆（点缀）
  const flowers = [];
  CELLS.filter(c => c.type === 'grass' && c.d >= 2).forEach((c, i) => {
    for (let k = 0; k < 3; k++) {
      const a = hash(i * 9 + k) * TAU, r = .55 + hash(i * 3 + k) * .25, col = ['#ffffff', '#ffd35c', '#ff8fa0', '#c9a8ff'][(i + k) % 4];
      const f = M(new THREE.IcosahedronGeometry(.045, 0), mat(col), false); f.position.set(c.x + Math.cos(a) * r, c.h + .03, c.z + Math.sin(a) * r); f.scale.setScalar(0); S.add(f); flowers.push({ f, grp: i % 2 });
    }
  });
  const boat = makeBoat(); S.add(boat.g); boat.g.visible = false;
  const lh = makeLighthouse(); lh.g.position.set(0, center.h + .14, 0); S.add(lh.g);
  const bm = beamMats(); const BL = 70;
  const beamGeo = (() => { const g = new THREE.BufferGeometry(), P = [], A = [], I = [], NX = 24, NY = 8;
    for (let i = 0; i <= NX; i++) for (let j = 0; j <= NY; j++) { const x = BL * Math.pow(i / NX, 1.3), a = j / NY * 2 - 1, w = .3 + x * .1; P.push(x, a * w / 2, 0); A.push(a); }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) { const k = i * (NY + 1) + j; I.push(k, k + NY + 1, k + 1, k + 1, k + NY + 1, k + NY + 2); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('across', new THREE.Float32BufferAttribute(A, 1)); g.setIndex(I); return g; })();
  const beam = new THREE.Mesh(beamGeo, bm.cone); beam.position.set(0, center.h + .14 + lh.lampY, 0); beam.renderOrder = 5; S.add(beam);
  // 外层光晕：同一条光带放宽 2.4 倍、低强度，给体积感和柔边
  const haloMat = bm.cone.clone(); haloMat.uniforms.soft.value = 2.2; haloMat.uniforms.gain.value = .32;
  const halo = new THREE.Mesh(beamGeo, haloMat); halo.scale.set(1, 2.4, 1); beam.add(halo); halo.renderOrder = 5;
  bm.cone.uniforms.len.value = BL;
  const poolGeo = new THREE.CircleGeometry(BL, 48, -.2, .4); poolGeo.rotateX(-Math.PI / 2);
  // CircleGeometry 的 thetaStart 围绕 +x；rotateX 后 z 取反，着色器用 atan(z,x) 绝对值判断，对称无妨
  const pool = new THREE.Mesh(poolGeo, bm.pool); pool.position.y = .2; pool.renderOrder = 4; S.add(pool); bm.pool.uniforms.len.value = BL;
  const spot = new THREE.SpotLight('#fff0cc', 0, 60, .2, .6, 1.2); spot.position.copy(beam.position); S.add(spot, spot.target);
  const lampLight = new THREE.PointLight('#ffe2a0', 0, 9, 1.5); lampLight.position.copy(beam.position); S.add(lampLight);

  // 浮标（开场）+ 远方的另一只浮标（结尾）
  function makeBuoy() {
    const g = new THREE.Group();
    const base = M(new THREE.CylinderGeometry(.34, .4, .2, 8), mat('#d9544a')); base.position.y = .05; g.add(base);
    const band = M(new THREE.CylinderGeometry(.2, .3, .3, 8), mat('#f6f2ea')); band.position.y = .3; g.add(band);
    const top = M(new THREE.CylinderGeometry(.06, .2, .34, 8), mat('#d9544a')); top.position.y = .62; g.add(top);
    const lm = new THREE.MeshStandardMaterial({ color: '#ffe8b0', emissive: '#ffcf7a', emissiveIntensity: 0, flatShading: true });
    const light = M(new THREE.IcosahedronGeometry(.085, 0), lm, false); light.position.y = .84; g.add(light);
    return { g, lm };
  }
  const buoy = makeBuoy(); const BUOY = [first.x + 2.6, first.z + 1.9]; S.add(buoy.g);
  const buoyFar = makeBuoy(); const BUOY_FAR = [96, 58]; buoyFar.g.scale.setScalar(2.2); S.add(buoyFar.g);
  // 远方浮标的光晕（拉远时保持可见）：朝相机的发光小圆片
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,236,190,1)'); gr.addColorStop(.25, 'rgba(255,210,140,.55)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const glows = [];
  const mkGlow = () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); S.add(s); glows.push(s); return s; };
  const glowFar = mkGlow(), glowBuoy = mkGlow(), glowBoat = mkGlow(), glowLH = mkGlow(); glowFar.material.depthTest = false; glowBoat.material.depthTest = false; glowFar.renderOrder = glowBoat.renderOrder = 9;

  // 海鸥
  const gulls = [0, 1, 2].map(i => {
    const g = new THREE.Group(), wm = mat('#fbfbf6', { side: THREE.DoubleSide });
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -.06, 0, 0, .06, .34, 0, 0], 3)); wg.computeVertexNormals();
    const L = new THREE.Mesh(wg, wm), R = new THREE.Mesh(wg, wm); R.scale.x = -1; L.castShadow = R.castShadow = true;
    const body = M(new THREE.ConeGeometry(.045, .26, 4), mat('#f4f4ee')); body.rotation.x = Math.PI / 2;
    g.add(L, R, body); g.visible = false; S.add(g); return { g, L, R, ph: i * 2.1, rad: 5.5 + i * 1.6, hgt: 3.6 + i * .7, sp: .55 - i * .08 };
  });

  // 水花：所有地块升起共用一个 InstancedMesh
  const DROP_N = 14, dropMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(.09, 0), new THREE.MeshBasicMaterial({ color: '#f4fdff' }), tiles.length * DROP_N + 40);
  dropMesh.castShadow = false; S.add(dropMesh);
  const splashRing = tiles.map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(1.08, 1.2, 6, 1, Math.PI / 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = .09; S.add(m); return m; });
  // 烟
  const smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.07, 0), new THREE.MeshStandardMaterial({ color: '#f4f2ee', flatShading: true, transparent: true, opacity: .8 }), 60); smoke.count = 0; smoke.frustumCulled = false; dropMesh.count = 0; dropMesh.frustumCulled = false; S.add(smoke);

  // —— 细节日程（第 5 小节，十六分音符）——
  const D16 = i => T.houses + (DET0 + i) * BEAT / 4;   // 接在房子后面，到 21.25 前收完
  mill.t = [D16(0), D16(1), D16(2)];
  ev(D16(0), 'floor', { note: 55, v: .7 }); ev(D16(1), 'roof', { note: 62, v: .6 }); ev(D16(2), 'pop', { note: 66, v: .5 });
  chims.forEach((c, i) => { const H = c.H; c.t0 = H.parts[H.parts.length - 1].t0 + .08; });   // 烟囱跟屋顶一起冒出，不单独占音
  planks.forEach((p, i) => { p.t0 = D16(3 + i); ev(p.t0, 'plank', { note: [69, 71, 74, 78][i], v: .7 }); });
  const boatT = D16(7); ev(boatT, 'splash', { note: 81, v: .8 });
  lamps.forEach((l, i) => { l.t0 = D16(8) + i * .05; }); ev(D16(8), 'pop', { note: 78, v: .5 });
  const flowerT = [D16(9), D16(10)]; ev(flowerT[0], 'sparkle', { note: 74, v: .4 }); ev(flowerT[1], 'sparkle', { note: 69, v: .4 });
  if (D16(10) >= T.day - 1e-6) throw new Error('details overflow ' + D16(10));
  ev(T.day, 'chord', { note: 62, v: 1 });

  // 黄昏：按光束顺序逐盏亮窗（= 主题的预告，半速的两倍快）
  houses.forEach((H, j) => { H.lit = T.dusk + j * BEAT / 2; ev(H.lit, 'window', { note: H.note, v: .6 }); });
  const lampLit = T.night0 + BEAT; ev(lampLit, 'window', { note: 69, v: .4 });
  const millLit = T.night0 + 2 * BEAT; ev(millLit, 'window', { note: 66, v: .35 });
  // 灯塔四环 + 灯室
  lh.rings.forEach((r, i) => { r.t0 = i < 4 ? T.rise + i * BEAT : T.rise + 3 * BEAT + BEAT / 2; ev(r.t0, i < 4 ? 'ring' : 'lamproom', i < 4 ? { note: [69, 71, 74, 78][i], v: .8 } : { v: .5 }); });
  ev(T.ignite, 'ignite', { v: 1 });
  // 光束：一圈 12 拍，第 k 拍扫过第 2 圈第 k 格
  const OMEGA = TAU / (12 * BEAT), PHI0 = 0;
  for (let b = 0; T.ignite + b * BEAT < T.end + 2; b++) {
    const k = b % 12, H = houses.find(h => h.c.k === k), t = T.ignite + b * BEAT;
    if (H) { H.hits.push(t); ev(t, 'beamhit', { note: H.note, v: t > T.far ? .45 : .8, rev: Math.floor(b / 12) }); }
  }
  // 小船：在光束第一次扫到它的角度上
  const BOAT_ANG = PHI0 + OMEGA * (T.found - T.ignite), BOAT_R = 12.5;
  const boatFar = [Math.cos(BOAT_ANG) * BOAT_R, Math.sin(BOAT_ANG) * BOAT_R];
  ev(T.dock + BEAT, 'boatbell', { note: 74, v: .5 }); ev(T.found + BEAT / 2, 'boatbell', { note: 81, v: .8, answer: 1 });
  ev(T.bell1, 'bell', { note: 74, v: .9 }); ev(T.bell2, 'bell', { note: 74, v: .6 }); ev(T.first, 'bell', { note: 74, v: .5 }); ev(T.bellFar, 'bell', { note: 74, v: .55, far: 1 });

  // —— 每帧更新 ——
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
  const dropY = (s, h0 = 2.4, dur = .22) => {   // 从上方落下 + 弹性回弹；s = t - 落定时刻
    if (s < -dur) return null;
    if (s < 0) { const u = 1 + s / dur; return { y: h0 * (1 - u * u), sy: 1 + .12 * u }; }
    return { y: Math.abs(Math.sin(s * 15)) * Math.exp(-s * 9) * .22, sy: 1 - .16 * Math.exp(-s * 12) * Math.cos(s * 26) };
  };
  const popS = s => s < 0 ? 0 : s > 1.2 ? 1 : 1 - Math.exp(-s * 9) * Math.cos(s * 17);

  function boatAt(t) {   // → {x,z,yaw,vis}
    const dEnd = dockEnd, far = boatFar;
    const outDir = Math.atan2(far[1] - dEnd[1], far[0] - dEnd[0]);
    if (t < boatT - .3) return { vis: false };
    if (t < T.dock + .6) { const dr = t < boatT ? (1 - seg(t, boatT - .3, boatT)) : 0; return { vis: true, x: dEnd[0], z: dEnd[1], yaw: dAng + Math.PI / 2, drop: dr }; }
    if (t < T.night) { const u0 = seg(t, T.dock + .6, T.night - .3), u = 1 - Math.pow(1 - u0, 1.8) * (1 - .0 * u0) - Math.sin(u0 * Math.PI) * 0; const uu = u0 < .08 ? u * ss(u0 / .08) : u; const turn = ss(seg(t, T.dock + .6, T.dock + 1.6)); return { vis: true, x: lerp(dEnd[0], far[0], uu), z: lerp(dEnd[1], far[1], uu), yaw: lerp(dAng + Math.PI / 2, outDir, turn) }; }
    if (t < T.found + .3) return { vis: true, x: far[0] + Math.sin(t * .7) * .3, z: far[1] + Math.cos(t * .5) * .3, yaw: outDir + Math.sin(t * .9) * .25 };
    const back = outDir + Math.PI;
    if (t < T.found + 1.1) return { vis: true, x: far[0], z: far[1], yaw: lerp(outDir, back, ss(seg(t, T.found + .3, T.found + 1.1))) };
    const u = eio(seg(t, T.found + 1.1, T.far)); return { vis: true, x: lerp(far[0], dEnd[0], u), z: lerp(far[1], dEnd[1], u), yaw: back };
  }

  W.update = (t, ctx) => {
    const night = ctx.night, amp = ctx.amp;
    let di = 0; const blobs = [];
    tiles.forEach((T0, i) => {
      const s = t - T0.t0, c = T0.c;
      if (s < -.5) { T0.g.visible = false; T0.foam.visible = false; splashRing[i].visible = false; return; }
      T0.g.visible = true;
      // 升起：0.3s 冲出水面 + 弹性回弹（事件时刻 = 到位）
      const dep = c.h + 2.6; let y;
      if (s < 0) { const u = 1 + s / .5; y = -dep * (1 - u * u * u); } else y = Math.sin(s * 13) * Math.exp(-s * 7) * .18 * (c.h > 1.5 ? 1.4 : 1);
      T0.g.position.y = y;
      blobs.push([c.x, c.z, 2.5, clamp((s + .3) / .6) * 1]);
      T0.foam.visible = s > -.1; T0.foam.material.opacity = .32 * clamp((s + .1) / .5) * (.7 + .3 * Math.sin(t * 1.7 + i)) * (1 - .45 * night);
      T0.foam.scale.setScalar(1 + .05 * Math.sin(t * 1.3 + i * 1.7));
      // 水花：冲出水面那一刻（s≈-0.12）炸开
      const ss_ = s + .12, rg = splashRing[i];
      if (ss_ > 0 && ss_ < .9) {
        rg.visible = true; rg.position.set(c.x, .09, c.z); rg.scale.setScalar(1 + ss_ * 1.3); rg.material.opacity = .6 * (1 - ss_ / .9);
        for (let k = 0; k < DROP_N; k++) {
          const a = k / DROP_N * TAU + hash(i * 31 + k), sp = 1.6 + hash(k * 7 + i) * 1.6, vy = 3.2 + hash(k * 3 + i * 5) * 2.4 * (c.h > 1.5 ? 1.4 : 1);
          const yy = vy * ss_ - 9.8 * ss_ * ss_ / 1.3; if (yy < -.1) continue;
          _v.set(c.x + Math.cos(a) * (.9 + sp * ss_), yy, c.z + Math.sin(a) * (.9 + sp * ss_));
          _e.set(ss_ * 9 + k, ss_ * 7, 0); _q.setFromEuler(_e); _s.setScalar(1 - ss_ / 1.1);
          dropMesh.setMatrixAt(di++, _m.compose(_v, _q, _s));
        }
      } else rg.visible = false;
    });
    // 小船落水的水花
    { const s = t - boatT + .12; if (s > 0 && s < .8) for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, yy = 2.6 * s - 7 * s * s; if (yy < 0) continue; _v.set(dockEnd[0] + Math.cos(a) * (.3 + s * 1.5), yy, dockEnd[1] + Math.sin(a) * (.3 + s * 1.5)); _q.identity(); _s.setScalar(.8 - s); dropMesh.setMatrixAt(di++, _m.compose(_v, _q, _s)); } }
    dropMesh.count = di; dropMesh.instanceMatrix.needsUpdate = true;
    ctx.sea.drawShallow(blobs);

    // 房子
    houses.forEach(H => {
      H.root.visible = t > H.parts[0].t0 - .3;
      H.parts.forEach(p => { const d = dropY(t - p.t0); if (!d) { p.obj.visible = false; return; } p.obj.visible = true; p.obj.position.y = p.y + d.y; p.obj.scale.set(1 / Math.sqrt(d.sy), d.sy, 1 / Math.sqrt(d.sy)); });
      const lit = ss(seg(t, H.lit - .05, H.lit + .12)) * ctx.winAmt;
      let fl = 0; for (const th of H.hits) if (t >= th - .04) fl = Math.max(fl, Math.exp(-(t - th) * 3.2) * ss(seg(t, th - .04, th + .02)));
      H.winMat.emissiveIntensity = lit * (1.3 + night * .7) + fl * 4;
      H.pl.intensity = lit * night * 1.4 + fl * 2.6;
    });
    trees.forEach(tr => { tr.g.scale.setScalar(popS(t - tr.t0) * tr.s); tr.g.visible = t > tr.t0; });
    // 风车
    { const [a, b, c] = mill.t, dt = dropY(t - a), dc_ = dropY(t - b); mill.tower.visible = !!dt; mill.cap.visible = !!dc_; mill.hub.visible = t > c;
      if (dt) { mill.tower.position.y = .6 + dt.y; mill.tower.scale.y = dt.sy; } if (dc_) mill.cap.position.y = 1.4 + dc_.y;
      mill.hub.scale.setScalar(popS(t - c));
      const spin = t < T.day ? 0 : (t - T.day) * 1.6 - Math.max(0, t - T.night0) * .9; mill.hub.rotation.z = -spin; }
    planks.forEach(p => { const d = dropY(t - p.t0, 1.6); p.g.visible = !!d; if (d) p.g.position.y = d.y; });
    lamps.forEach(l => { l.g.scale.setScalar(popS(t - l.t0)); l.g.visible = t > l.t0; });
    lampMat.emissiveIntensity = ss(seg(t, lampLit, lampLit + .15)) * 2.2 * ctx.winAmt;
    chims.forEach(c => { c.ch.scale.setScalar(popS(t - c.t0)); });
    flowers.forEach(f => { const s = popS(t - flowerT[f.grp]); f.f.scale.setScalar(s); f.f.visible = s > 0; });
    // 烟：白天从烟囱冒
    { let si = 0; if (t > T.day - .5 && t < T.night + 2) chims.forEach((c, ci) => { c.ch.getWorldPosition(_v); for (let k = 0; k < 6; k++) { const ph = ((t * .45 + k / 6 + ci * .3) % 1); const a = 1 - ph; _s.setScalar((.5 + ph * 1.6) * a * clamp((t - T.day + .5) * 2) * (1 - seg(t, T.night0, T.night + 1))); _q.identity(); dropY; smoke.setMatrixAt(si++, _m.compose(new THREE.Vector3(_v.x + ph * .5 + Math.sin(ph * 5 + k) * .08, _v.y + .2 + ph * 1.3, _v.z + ph * .2), _q, _s)); } }); smoke.count = si; smoke.instanceMatrix.needsUpdate = true; }
    // 小船
    { const B = boatAt(t); boat.g.visible = !!B.vis; if (B.vis) { const wy = waveH(B.x, B.z, t, amp); boat.g.position.set(B.x, wy + .02 + (B.drop || 0) * 1.6, B.z); boat.g.rotation.set(0, -B.yaw, 0); boat.body.rotation.set(Math.sin(t * 2.1) * .08 * amp, 0, Math.sin(t * 1.7 + 1) * .06 * amp);
        const tA = T.found + BEAT / 2, flick = t > T.night - 1 && t < tA ? .75 + .25 * Math.sin(t * 17) * Math.sin(t * 5.3) : 1, ans = t > tA - .02 ? Math.exp(-(t - tA) * 2.5) * 5 * seg(t, tA - .02, tA + .02) : 0;
        boat.lamp.material.emissiveIntensity = (ss(seg(t, T.night0, T.night)) * 2.5 * flick + ans);
        boat.lamp.getWorldPosition(_v); glowBoat.position.copy(_v); glowBoat.material.opacity = Math.min(1, ss(seg(t, T.night0, T.night)) * .9 * flick + ans * .15); glowBoat.scale.setScalar(ctx.px * 40 * (1 + Math.min(ans, 1) * .7)); } else glowBoat.material.opacity = 0; }
    // 灯塔
    lh.rings.forEach(r => { const d = dropY(t - r.t0, 2.6); r.obj.visible = !!d; if (d) { r.obj.position.y = r.y + d.y; r.obj.scale.y = d.sy; } });
    const ig = t >= T.ignite ? 1 : 0, igF = ig ? 1 + 2.2 * Math.exp(-(t - T.ignite) * 3) : 0;
    lh.glassM.emissiveIntensity = ig * 3.2 * igF;
    const phi = PHI0 + OMEGA * Math.max(0, t - T.ignite);
    beam.visible = pool.visible = ig > 0; pool.rotation.y = -phi;
    { const X = new THREE.Vector3(Math.cos(phi) * .993, -.12, Math.sin(phi) * .993), Z = ctx.camBack.clone(); Z.addScaledVector(X, -Z.dot(X)).normalize(); const Y = new THREE.Vector3().crossVectors(Z, X);
      beam.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); }
    bm.cone.uniforms.amt.value = ig * Math.min(1.4, igF) * ss(seg(t, T.ignite, T.ignite + .12)); bm.pool.uniforms.amt.value = 0; pool.visible = false;
    ctx.sea.U.uBeam.value.set(phi, bm.cone.uniforms.amt.value * 1.1, .085, 58); haloMat.uniforms.amt.value = bm.cone.uniforms.amt.value; haloMat.uniforms.len.value = BL;
    spot.intensity = ig * 90 * Math.min(1.5, igF); spot.target.position.set(Math.cos(phi) * 20, 0, Math.sin(phi) * 20);
    lampLight.intensity = ig * 6 * igF;
    glowLH.position.copy(beam.position); glowLH.material.opacity = ig * .9; glowLH.scale.setScalar(ctx.px * 60 * igF);
    // 浮标
    const bob = (g, x, z, sc = 1) => { const y = waveH(x, z, t, amp); const dx = waveH(x + .3, z, t, amp) - waveH(x - .3, z, t, amp), dz = waveH(x, z + .3, t, amp) - waveH(x, z - .3, t, amp); g.position.set(x, y - .08 * sc, z); g.rotation.set(dz * 1.2, 0, -dx * 1.2); };
    bob(buoy.g, BUOY[0], BUOY[1]); bob(buoyFar.g, BUOY_FAR[0], BUOY_FAR[1], 2.2);
    const ring = th => t >= th ? Math.exp(-(t - th) * 1.4) : 0;
    const bl = Math.max(ring(T.bell1), ring(T.bell2) * .8, ring(T.first) * .6), blink = .35 + .35 * (Math.sin(t * 2.2) > .6 ? 1 : 0);
    buoy.lm.emissiveIntensity = bl * 6 + blink * (1 - night * .2) + night * 1.2;
    buoy.lm.emissiveIntensity *= 1; buoy.g.children[3].getWorldPosition(_v); glowBuoy.position.copy(_v); glowBuoy.material.opacity = clamp(bl * .9 + night * .4); glowBuoy.scale.setScalar(ctx.px * 30 * (1 + bl));
    const blf = ring(T.bellFar);
    buoyFar.lm.emissiveIntensity = blf * 8 + night * .8; buoyFar.g.children[3].getWorldPosition(_v); glowFar.position.copy(_v); glowFar.material.opacity = clamp(blf * 1.2 + (t > T.far ? .25 : 0)); glowFar.scale.setScalar(ctx.px * 20 * (1 + blf * 1.2));
    // 海鸥
    gulls.forEach(G => { const vis = t > T.day - 1 && t < T.night0 + 1; G.g.visible = vis; if (!vis) return; const a = G.ph + t * G.sp; G.g.position.set(Math.cos(a) * G.rad, G.hgt + Math.sin(t * 1.3 + G.ph) * .3, Math.sin(a) * G.rad); G.g.rotation.set(0, -a, Math.sin(t * 1.1 + G.ph) * .25); const f = Math.sin(t * 9 + G.ph * 3) * .55; G.L.rotation.z = f; G.R.rotation.z = -f; });
    glows.forEach(s => { s.visible = s.material.opacity > .002; });
  };

  Object.assign(W, { S, tiles, houses, trees, mill, planks, lamps, boat, lh, beam, pool, spot, buoy, buoyFar, BUOY, BUOY_FAR, boatFar, dockEnd, EVS, gulls, OMEGA, PHI0, boatAt, center });
  return W;
}
