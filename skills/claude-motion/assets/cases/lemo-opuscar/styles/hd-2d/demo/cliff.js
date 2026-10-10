// 场景 C：风暴石阶（Gale Steps）+ 灯塔顶灯室（镜头 'cliff' 35.5–49.5、'lamp' 49.5–58.0）
import * as THREE from 'three';
import { PX, ramp, hex, h2, fbm, texOf, rock, cobbles, billboard, glow, blob, mulberry } from './px.js';
import { mat, mesh, box } from './kit.js';
import { sky, stars, sea, particles, rain, beamCard, flick } from './fx.js';
import { makeChar } from './chars.js';
import { T } from './story.js';
import { clamp, seg, ss, eio, eo, lerp, track } from '/core/lib.js';

// —— 本场景的贴图 ——
function masonry(w, h, o = {}) {   // 石阶/石墙：错缝方石
  const P = new PX(w, h), s = o.seed ?? 1, R = ramp(o.cols ?? ['#121118', '#22212a', '#34323c', '#48454f', '#5e5a63', '#77727a']), bw = o.bw ?? 12, bh = o.bh ?? 6;
  P.fill((x, y) => {
    const row = Math.floor(y / bh), off = row % 2 ? bw >> 1 : 0, col = Math.floor((x + off) / bw), xx = (x + off) % bw, yy = y % bh, id = h2(col, row, s);
    let v = .42 + id * .3 + (fbm(x * .2, y * .2, s) - .5) * .3 - yy / bh * .12;
    if (yy === 0 || xx === 0) v = .07; else if (yy === 1) v += .14; else if (yy === bh - 1 || xx === bw - 1) v -= .12;
    if (o.moss && fbm(x * .1, y * .15, s + 5) > .6 && yy < 3) return ramp(['#101a12', '#1c2c1c', '#2b4028'])(fbm(x * .4, y * .4, s) , x, y);
    return R(v, x, y);
  });
  return P.done();
}
function rockBig(w, h, o = {}) {   // 大块面低对比岩石：Voronoi 块面 + 块内上亮下暗 + 稀疏裂缝
  const P = new PX(w, h), s = o.seed ?? 1, cell = o.cell ?? 22, R = ramp(o.cols ?? ['#2a2c36', '#343743', '#3f4250', '#4b4f5e', '#575b6a']);
  P.fill((x, y) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / (cell * .7)); let d1 = 1e9, d2 = 1e9, id = 0, py0 = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const X = cx + i, Y = cy + j, px = (X + .5 + (h2(X, Y, s) - .5) * .8) * cell, py = (Y + .5 + (h2(Y, X, s + 5) - .5) * .8) * cell * .7, d = Math.hypot(x - px, (y - py) * 1.2); if (d < d1) { d2 = d1; d1 = d; id = h2(X, Y, s + 9); py0 = py; } else if (d < d2) d2 = d; }
    let v = .3 + id * .4 + (py0 - y) / cell * .35 + (fbm(x * .08, y * .08, s) - .5) * .15;
    const edge = d2 - d1; if (edge < 1.1 && id > .35) v = .05; else if (edge < 2.2) v -= .12;
    return R(v, x, y);
  });
  return P.done();
}
function foamCanvas(seed) {   // 崖脚白浪：横向条带，靠岩一侧最密
  const P = new PX(256, 24), F = ramp(['#6a86a8', '#a8c0da', '#e4eef8', '#ffffff']);
  P.fill((x, y) => { const v = 1 - y / 24, n = fbm(x * .08, y * .3, seed, 3), m = n + v * .7 - .7 + (y < 3 ? .25 : 0); if (m < 0 || (m < .12 && h2(x, y, seed) > .5)) return null; return F(Math.min(.99, m * 2.2), x, y); });
  return P.done();
}
function lensCanvas(lit) {   // 菲涅尔透镜：横向棱纹环
  const P = new PX(48, 40), G = ramp(lit ? ['#8a5a1c', '#e0a040', '#ffe08a', '#fff8e0'] : ['#0e1a20', '#1c3038', '#2e4a52', '#4a6e74', '#8ab0b0']);
  P.fill((x, y) => { const band = y % 5, mid = y > 16 && y < 24; let v = .35 + (band === 1 ? .45 : band === 0 ? -.2 : 0) + (mid ? .15 : 0) + (x % 12 === 0 ? -.25 : 0) + (h2(x >> 1, y, 3) - .5) * .12; return G(v, x, y); });
  return P.done();
}
function grassCanvas(seed) {
  const P = new PX(16, 12), G = ramp(['#0b140f', '#172618', '#243a22', '#34502e', '#4a6a3c']), R = mulberry(seed);
  for (let b = 0; b < 9; b++) { let x = 2 + R() * 12, lean = (R() - .3) * .6; const hgt = 5 + R() * 7; for (let y = 0; y < hgt; y++) { P.set(Math.round(x), 11 - y, G(.25 + y / hgt * .7, b, y)); x += lean; } }
  return P.done();
}
function cloudCanvas(seed, w = 256, h = 96, rim = 0) {
  const P = new PX(w, h), R = ramp(['#1a2030', '#262e42', '#343e56', '#46526c', '#5c6a84']), RIM = ramp(['#8a9cc0', '#c4d2ee', '#eef4ff']);
  const N = (x, y) => { const u = x / w, v = y / h, edge = Math.sin(u * Math.PI) * Math.sin(v * Math.PI); return fbm(x * .03, y * .06, seed, 5) * 1.25 + edge * .55 - .7; };
  P.fill((x, y) => { const n = N(x, y); if (n < .05) return null; if (rim && (N(x, y - 3) < .05 || N(x + (rim > 0 ? 3 : -3), y) < .05)) return RIM(.35 + h2(x, y, seed) * .5, x, y); return R(.25 + n * 1.3 - y / h * .3, x, y); });
  return P.done();
}
function towerCanvas() {
  const P = new PX(64, 128), W = ramp(['#8d8a88', '#b9b5ae', '#dcd8cf', '#f0ece2']), Rr = ramp(['#4a1216', '#7a1f22', '#a2302c', '#c2463a']);
  P.fill((x, y) => { const band = Math.floor(y / 24) % 2 === 1; const v = .55 + (h2(x >> 1, y >> 1, 2) - .5) * .2 - (y % 6 === 0 ? .15 : 0); return band ? Rr(v, x, y) : W(v, x, y); });
  return P.done();
}

// 石阶：flight 1 在 z=0（向右上），平台，flight 2 在 z=-2.6（向左上）
const RUN = .5, RISE = .25, X0 = -9, SEA_Y = -9;
const top1 = x => (Math.floor((x - X0) / RUN) + 1) * RISE;   // flight 1 某 x 处台阶顶面高度
const LAND_X = 4.5, LAND_Y = top1(LAND_X - .01);

export function buildCliff() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#1c2334', .02);
  const stormG = new THREE.Group(), lampG = new THREE.Group(); scene.add(stormG, lampG);

  // ———————————————— 风暴石阶 ————————————————
  const SK = sky({ top: '#121828', mid: '#262f44', hor: '#3c465c', moonI: 0 }); stormG.add(SK.mesh);
  const stepM = mat(masonry(96, 96, { seed: 3, moss: true })), wallM = mat(rockBig(128, 128, { seed: 11 })), wallM2 = mat(rockBig(128, 128, { seed: 4, cell: 30, cols: ['#262833', '#30333e', '#3a3d4a', '#454957', '#505463'] }));
  // 下方崖体（台阶所在的岩架，前脸一直落到海里）
  { const g = new THREE.BoxGeometry(100, 50, 6, 50, 25, 1); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (z > 0) { const deep = clamp((-y - 3) / 10), far = clamp((Math.abs(x - -2) - 9) / 6); p.setZ(i, z + (fbm(x * .3, y * .2, 4) - .5) * (1.6 + 3.5 * Math.max(deep, far)) + 1.2 * Math.max(deep, far) * (fbm(x * .06, y * .05, 9) - .3)); } }
    g.translate(0, -25 - .2, -2.2); stormG.add(mesh(g, wallM2)); }
  // flight 1
  for (let x = X0; x < LAND_X; x += RUN) { const tp = top1(x + .01); const b = box(RUN, tp + 1.2, 1.7, stepM); b.position.set(x + RUN / 2, -1.2, 0); stormG.add(b); }
  // 平台
  { const b = box(3, LAND_Y + 1.2, 4.6, stepM); b.position.set(LAND_X + 1.5, -1.2, -1.45); stormG.add(b); }
  // flight 2（z=-2.6，向左上），它的前脸就是 flight 1 背后的挡土墙
  const top2 = x => LAND_Y + (Math.floor((LAND_X - x) / RUN) + 1) * RISE;
  for (let x = LAND_X; x > -12; x -= RUN) { const tp = top2(x - .01); const b = box(RUN, .5, 1.8, stepM); b.position.set(x - RUN / 2, tp - .5, -2.6); stormG.add(b); const bb = box(RUN, tp - .5 + 1.2, 1.8, wallM); bb.position.set(x - RUN / 2, -1.2, -2.6); stormG.add(bb); const wb = box(RUN, tp - .1 + 1.2, .9, wallM); wb.position.set(x - RUN / 2, -1.2, -1.3); stormG.add(wb); }
  // 上方崖壁
  { const g = new THREE.BoxGeometry(110, 26, 40, 55, 13, 20); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (z > 19.9) p.setZ(i, z + (fbm(x * .15, y * .12, 8) - .5) * 3 - (y > 10 ? (y - 10) * .5 : 0));
      if (y > 12.9) p.setY(i, y + (fbm(x * .08, z * .08, 12) - .5) * 5 - (z > 12 ? (z - 12) * .35 : 0)); }
    g.translate(0, 4, -23.6); stormG.add(mesh(g, wallM2)); }
  // 崖顶 + 熄灭的灯塔（剪影）
  const tower = new THREE.Group();
  { const tm = new THREE.MeshStandardMaterial({ map: texOf(towerCanvas()), roughness: .9, color: '#5c616e' });
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.85, 11, 16), tm); tw.position.y = 5.5; tower.add(tw);
    const gal = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, .2, 16), new THREE.MeshStandardMaterial({ color: '#202026' })); gal.position.y = 11.1; tower.add(gal);
    const room = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 1.5, 12), new THREE.MeshStandardMaterial({ color: '#1a1c24' })); room.position.y = 12; tower.add(room);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.3, 12), new THREE.MeshStandardMaterial({ color: '#4a1a1a' })); cap.position.y = 13.4; tower.add(cap); }
  tower.position.set(9, 24.5, -26); stormG.add(tower);
  { const g = new THREE.CylinderGeometry(8, 14, 8, 9, 2); g.translate(9, 20.6, -26); stormG.add(mesh(g, wallM)); }
  { const R2 = mulberry(21);
    for (let i = 0; i < 26; i++) { const g = new THREE.DodecahedronGeometry(1, 0); const m = mesh(g, wallM); const top = i < 16; const x = top ? -45 + R2() * 90 : (R2() < .5 ? -30 + R2() * 18 : 12 + R2() * 20); const sc = top ? 1.2 + R2() * 2.6 : .8 + R2() * 1.6;
      m.scale.set(sc * (1 + R2() * .6), sc * (.6 + R2() * .5), sc); m.rotation.set(R2() * 3, R2() * 3, R2() * 3); m.position.set(x, top ? 15.5 + R2() * 1.5 : -.5 - R2() * 2, top ? -6 - R2() * 14 : .2 + R2() * .8); if (!top && x > -12 && x < 8) continue; stormG.add(m); } }
  // 草丛（风吹）
  const grasses = [], GT = [1, 2, 3].map(s => texOf(grassCanvas(s)));
  { const R = mulberry(31);
    for (let x = X0 + 1; x < LAND_X + 2.5; x += .45 + R() * .6) { const g = billboard(GT[Math.floor(R() * 3)], .7, .52, { shadow: false }); g.position.set(x, top1(Math.min(x, LAND_X - .01) + .01), .72 + R() * .12); stormG.add(g); grasses.push({ g, ph: R() * 6 }); }
    for (let x = -10; x < LAND_X; x += .5 + R() * .7) { const g = billboard(GT[Math.floor(R() * 3)], .7, .52, { shadow: false }); g.position.set(x, top2(x - .01), -1.78); stormG.add(g); grasses.push({ g, ph: R() * 6 }); } }
  // 海（深渊下）
  const SEA = sea(900, { ppm: 3, deep: '#070c18', shallow: '#132238', crest: '#6a84a8' }); SEA.mesh.position.y = SEA_Y; stormG.add(SEA.mesh); SEA.setLights([]);
  const foams = [0, 1].map(i => { const tx = texOf(foamCanvas(7 + i), { repeat: [6, 1] }); tx.wrapS = THREE.RepeatWrapping; const m = new THREE.Mesh(new THREE.PlaneGeometry(110, 1.8 + i * 1.2), new THREE.MeshBasicMaterial({ map: tx, transparent: true, alphaTest: .5, color: '#ffffff', fog: true })); m.rotation.x = -Math.PI / 2; m.position.set(0, SEA_Y + .04 + i * .02, 1.9 + i * 1.3); stormG.add(m); return { m, tx, i }; });
  const spray = particles(260, (i, t, o) => { const per = 1.6 + h2(i, 3) * 1.2, ph = ((t / per + h2(i, 1)) % 1), cyc = Math.floor(t / per + h2(i, 1)); o.x = (h2(i, cyc, 5) - .5) * 90; o.z = 1.1 + h2(i, cyc, 6) * .8 + ph * .6; o.y = SEA_Y + Math.sin(ph * Math.PI) * (1.2 + h2(i, cyc, 8) * 2.2); o.a = (1 - ph) * .9 * sprayK; o.s = .11 + h2(i, 9) * .08; o.r = .85; o.g = .92; o.b = 1; });
  let sprayK = 1; stormG.add(spray);
  // 云
  const clouds = [];
  { const R = mulberry(5); for (let i = 0; i < 9; i++) { const tx = texOf(cloudCanvas(i + 3)); const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 34), new THREE.MeshBasicMaterial({ map: tx, transparent: true, alphaTest: .5, fog: false, color: '#ffffff' })); m.position.set(-120 + R() * 240, 25 + R() * 45, -140 - R() * 60); stormG.add(m); clouds.push({ m, x0: m.position.x, sp: 3 + R() * 3 }); } }
  // 光
  const hemi = new THREE.HemisphereLight('#6a7a9e', '#14161e', .7); scene.add(hemi);
  const diff = new THREE.DirectionalLight('#9aaad4', .5); diff.position.set(-28, 34, 22); diff.castShadow = true; diff.shadow.mapSize.set(2048, 2048); Object.assign(diff.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 }); diff.shadow.bias = -.0008; stormG.add(diff, diff.target);
  const bolt = new THREE.DirectionalLight('#d4e2ff', 0); bolt.position.set(30, 45, 18); stormG.add(bolt, bolt.target);
  // 雨
  const RB = [-12, -4, -6, 12, 16, 9], RAIN = rain(1800, RB, { speed: 26, len: 1.0, opacity: .32 }); stormG.add(RAIN);
  // 石阶上的雨花
  const splash = particles(120, (i, t, o) => { const ph = (t * 2.3 + h2(i, 4)) % 1, cyc = Math.floor(t * 2.3 + h2(i, 4)); const x = RB[0] + h2(i, cyc, 7) * (RB[3] - RB[0]); o.x = x; o.y = top1(Math.min(x, LAND_X - .01) + .01) + ph * .12; o.z = (h2(i, cyc, 9) - .5) * 1.4; o.a = (1 - ph) * .5 * splashK; o.s = .03; o.r = .7; o.g = .8; o.b = 1; });
  let splashK = 1; stormG.add(splash);

  // ———————————————— 灯塔顶灯室 ————————————————
  const LP = new THREE.Vector3(300, 0, 0); lampG.position.copy(LP);
  const MOON_D = new THREE.Vector3(.12, .075, -1).normalize(); const SK2 = sky({ top: '#060a1a', mid: '#16244a', hor: '#34486c', moonDir: MOON_D, moonI: 1.5 }); lampG.add(SK2.mesh);
  const ST2 = stars(500, 9); lampG.add(ST2);
  const metal = mat(masonry(48, 48, { bw: 6, bh: 6, seed: 9, cols: ['#0c0c10', '#18181e', '#26262e', '#34343e', '#44444e'] }));
  { const tw = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 3.4, 26, 20), new THREE.MeshStandardMaterial({ map: texOf(towerCanvas()), roughness: .9 })); tw.position.y = -13.2; tw.receiveShadow = true; lampG.add(tw); }
  const floor = mesh(new THREE.CylinderGeometry(3.5, 3.3, .25, 24).translate(0, -.125, 0), metal); lampG.add(floor);
  const iron = new THREE.MeshStandardMaterial({ color: '#15151a', roughness: .5, metalness: .6 });
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; const p = new THREE.Mesh(new THREE.BoxGeometry(.06, 1.05, .06), iron); p.position.set(Math.cos(a) * 3.3, .52, Math.sin(a) * 3.3); p.castShadow = true; lampG.add(p); }
  { const r = new THREE.Mesh(new THREE.TorusGeometry(3.3, .045, 6, 48), iron); r.rotation.x = Math.PI / 2; r.position.y = 1.05; lampG.add(r); const r2 = r.clone(); r2.position.y = .55; lampG.add(r2); }
  // 灯室：窗棂 + 后半圈玻璃 + 屋顶
  const RR = 1.95;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + .33; const m = new THREE.Mesh(new THREE.BoxGeometry(.07, 2.6, .07), iron); m.position.set(Math.cos(a) * RR, 1.3, Math.sin(a) * RR); m.castShadow = true; lampG.add(m); }
  for (const y of [.02, 2.05, 2.6]) { const r = new THREE.Mesh(new THREE.TorusGeometry(RR, .05, 6, 40), iron); r.rotation.x = Math.PI / 2; r.position.y = y; lampG.add(r); }
  { const gl = new THREE.Mesh(new THREE.CylinderGeometry(RR - .02, RR - .02, 2.6, 24, 1, true, Math.PI * .15, Math.PI * .7), new THREE.MeshBasicMaterial({ color: '#8fb0c8', transparent: true, opacity: .06, side: THREE.DoubleSide, depthWrite: false })); gl.rotation.y = Math.PI; gl.position.y = 1.3; lampG.add(gl); }
  const roofM = new THREE.MeshStandardMaterial({ color: '#5a1c1a', roughness: .8 });
  { const c = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.4, 16), roofM); c.position.y = 3.3; c.castShadow = true; lampG.add(c); const b = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), iron); b.position.y = 4.1; lampG.add(b); }
  // 透镜 + 底座 + 进火口
  const lensOff = texOf(lensCanvas(false)), lensOn = texOf(lensCanvas(true));
  const lensM = new THREE.MeshStandardMaterial({ map: lensOff, emissiveMap: lensOn, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, roughness: .65, metalness: .1 });
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(.95, .95, 1.7, 24), lensM); lens.position.y = 1.35; lampG.add(lens);
  { const cap = new THREE.Mesh(new THREE.CylinderGeometry(.6, .95, .3, 24), iron); cap.position.y = 2.35; lampG.add(cap); const ped = new THREE.Mesh(new THREE.CylinderGeometry(.55, .7, .5, 16), new THREE.MeshStandardMaterial({ color: '#6a5020', roughness: .5, metalness: .7 })); ped.position.y = .25; ped.castShadow = true; lampG.add(ped); }
  const feed = new THREE.Mesh(new THREE.BoxGeometry(.22, .16, .22), new THREE.MeshStandardMaterial({ color: '#8a6a2a', emissive: '#ff9a3a', emissiveIntensity: 0, roughness: .4, metalness: .7 })); feed.position.set(-.42, .6, .82); lampG.add(feed);
  // 地板上的楼梯口
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(.8, .8), new THREE.MeshBasicMaterial({ color: '#020204' })); hole.rotation.x = -Math.PI / 2; hole.position.set(-1.2, .006, .75); lampG.add(hole);
  const lid = box(.8, .06, .8, metal); lid.rotation.x = -1.25; lid.position.set(-1.2, 0, .35); lampG.add(lid);
  // 下方岬角与海
  { const g = new THREE.CylinderGeometry(14, 30, 12, 10, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (h2(Math.round(p.getX(i) * 2), Math.round(p.getZ(i) * 2), 6) - .5) * .3; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.translate(0, -32, 0); lampG.add(mesh(g, wallM)); }
  const SEA2 = sea(1400, { ppm: 4, deep: '#040a16', shallow: '#0e2038', crest: '#4a6c90' }); SEA2.mesh.position.y = -37; lampG.add(SEA2.mesh);
  const clouds2 = [];
  { const R = mulberry(8); for (let i = 0; i < 8; i++) { const tx = texOf(cloudCanvas(i + 20)); const m = new THREE.Mesh(new THREE.PlaneGeometry(120, 44), new THREE.MeshBasicMaterial({ map: tx, transparent: true, alphaTest: .5, fog: false, color: '#9aa6c4' })); const a = -1.1 + R() * 2.4; m.position.set(Math.sin(a) * 220, 10 + R() * 50, -Math.cos(a) * 220); m.lookAt(0, m.position.y, 0); lampG.add(m); clouds2.push(m); } }
  // 云缝：月亮两侧各一块带轮廓光的云
  [[-1, -.17, .035], [1, .16, .015], [-1, -.34, .09], [1, .33, .075]].forEach(([side, da, dy], i) => { const tx = texOf(cloudCanvas(40 + i, 256, 96, -side)); const d = MOON_D.clone(); d.applyAxisAngle(new THREE.Vector3(0, 1, 0), -da); d.y += dy; d.normalize(); const m = new THREE.Mesh(new THREE.PlaneGeometry(110, 40), new THREE.MeshBasicMaterial({ map: tx, transparent: true, alphaTest: .5, fog: false, color: '#b4c0dc' })); m.position.copy(d.multiplyScalar(240)); m.lookAt(0, m.position.y, 0); lampG.add(m); clouds2.push(m); });
  const moonFront = new THREE.DirectionalLight('#a6b8e4', 0); moonFront.position.set(-14, 16, 26); lampG.add(moonFront, moonFront.target);
  const spill = new THREE.PointLight('#ffd89a', 0, 16, 1.6); spill.position.set(-1.8, -1.8, 4.2); lampG.add(spill);
  const moon2 = new THREE.DirectionalLight('#9ab0e0', .9); moon2.position.set(-20, 25, -30); moon2.castShadow = true; moon2.shadow.mapSize.set(1024, 1024); Object.assign(moon2.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 80 }); lampG.add(moon2, moon2.target);
  const lensL = new THREE.PointLight('#fff0c8', 0, 45, 1.4); lensL.position.set(0, 1.35, 0); lensL.castShadow = true; lensL.shadow.mapSize.set(1024, 1024); lensL.shadow.bias = -.003; lensL.shadow.camera.near = .9; lampG.add(lensL);
  lens.castShadow = false;
  const lensGlow = glow('#fff2c4', 5, 1.4); lensGlow.position.set(0, 1.35, 0); lampG.add(lensGlow);
  const beams = [0, 1].map(() => { const b = beamCard(170, .9, 24, '#fff0c8', { k: 0, fall: 1.1 }); scene.add(b); return b; });
  const drips = particles(60, (i, t, o) => { const ph = (t * .9 + h2(i, 2)) % 1, a = h2(i, 5) * Math.PI * 2; o.x = Math.cos(a) * 2.35; o.z = Math.sin(a) * 2.35; o.y = 2.7 - ph * 3.2; o.a = .5 * (1 - ph); o.s = .025; o.r = .7; o.g = .8; o.b = 1; }); lampG.add(drips);
  // 倒火时飞出的火星
  const spark = particles(18, (i, t, o) => { const u = clamp((t - T.pour - .4 - i * .012) / .5); const a = new THREE.Vector3(-.55, 1.03, 1.0), b = new THREE.Vector3(-.42, .66, .82); o.x = lerp(a.x, b.x, u) + (h2(i, 1) - .5) * .06; o.y = lerp(a.y, b.y, u) + Math.sin(u * Math.PI) * .15 + (h2(i, 2) - .5) * .06; o.z = lerp(a.z, b.z, u); o.a = u > 0 && u < 1 ? 1.4 : 0; o.s = .03; o.r = 3; o.g = 1.4; o.b = .4; }); lampG.add(spark);

  // ———————————————— 角色与灯光 ————————————————
  const wren = makeChar('wren', {
    kLow: { kneel: 1, arm: 'hug', lit: .5, closed: 1 }, kEmber: { kneel: 1, arm: 'hug', lit: .27, closed: 1 }, kHalf: { kneel: 1, arm: 'hug', lit: .6 },
    fw0: { step: 0, arm: 'fwd', hem: 1 }, fw1: { step: 1, arm: 'fwd', bob: -1 }, fw2: { step: 2, arm: 'fwd', hem: -1 }, fw3: { step: 3, arm: 'fwd', bob: -1 },
    gOut: { arm: 'fwd', hem: 5, lit: .45, scarf: 2 },
  });
  scene.add(wren.root);
  const lanL = new THREE.PointLight('#ffae4a', 0, 11, 2); lanL.castShadow = true; lanL.shadow.mapSize.set(1024, 1024); lanL.shadow.bias = -.004; lanL.shadow.camera.near = .05; scene.add(lanL);
  const lanG = glow('#ffbe6a', 1.2, 1.1); scene.add(lanG);
  const fill = new THREE.PointLight('#9fb2e8', 0, 8, 2); scene.add(fill);

  const V3 = (a) => new THREE.Vector3(...a);
  function flash(t) { let f = 0; for (const [e, k] of [[36.8, 1], [39.9, .75]]) { const d = t - e; if (d < 0 || d > 1.2) continue; f = Math.max(f, k * (d < .15 ? .92 + .08 * Math.sin(d * 140) : d < .24 ? .08 : d < .3 ? .42 : .42 * Math.exp(-(d - .3) * 9))); } return f; }

  // 镜头 4：Wren 的路径
  const walkX = t => t < T.gust ? lerp(-2.4, 2.3, seg(t, 35.5, T.gust)) : t < T.stand + .3 ? 2.3 : lerp(2.3, 3.9, seg(t, T.stand + .3, 49.5));
  const camOff = track([[35.5, [-3.6, 6.4, 10.4]], [40.6, [-3.1, 5.9, 9.8]], [42.0, [-1.5, 2.35, 6.5]], [44.3, [-1.35, 2.15, 5.9]], [46.5, [-1.35, 2.2, 6.0]], [47.6, [-1.6, 2.5, 6.6]], [49.5, [-3.6, 5.6, 11]]]);
  const lookOff = track([[35.5, [1, .9, 0]], [40.6, [.9, .9, 0]], [42.0, [.35, .5, 0]], [44.3, [.35, .45, 0]], [47.6, [.45, .7, 0]], [49.5, [1.6, 1.8, -1]]]);
  const estPos = track([[35.5, [-33, 29, 58]], [37.0, [-30.5, 27, 53]]]), estLook = track([[35.5, [2, 16.5, -10]], [37.0, [1, 15.5, -9]]]);
  // 镜头 5
  const camLamp = track([[49.5, [-2.3, 2.9, 7.9]], [53.5, [-1.7, 2.55, 6.9]], [54.2, [-1.8, 2.7, 7.3]], [58, [-10.5, 5.2, 25]]]);
  const lookLamp = track([[49.5, [-.9, 1.05, .6]], [53.5, [-.6, 1.25, .5]], [54.2, [-.5, 1.35, .3]], [58, [2, -3.2, -10]]]);

  function update(t, shot, cam, post, renderer) {
    const V = post.vig.uniforms, step8 = Math.floor(t * 8);
    const storm = shot.id === 'cliff';
    stormG.visible = storm; lampG.visible = !storm;
    let wf = 'fwd', lit = 1, wflip = false, wpos;
    if (storm) {
      scene.fog.color.set('#1c2334'); scene.fog.density = .02;
      const gustK = ss(seg(t, T.gust, T.gust + .25)) * (1 - ss(seg(t, T.dim + .2, T.dark + .5))) * 1.0;
      const darkK = ss(seg(t, T.dim, T.dark + .3)) * (1 - ss(seg(t, T.relight, T.relight + 1.6)) * .85);
      const fl = flash(t);
      const ek = 1 - eio(seg(t, 37.0, 39.0));   // 建立镜头 → 跟随
      // Wren
      const x = walkX(t); let y = top1(x + .01);
      if (t < T.gust) wf = ['g0', 'g1', 'g2', 'g3'][Math.floor(t * 6) % 4];
      else if (t < T.dim) wf = Math.floor(t * 14) % 3 ? 'gDim' : 'gOut';
      else if (t < T.dim + .25) wf = 'kLow';
      else if (t < T.relight) wf = 'kEmber';
      else if (t < T.relight + .25) wf = 'kHalf';
      else if (t < T.stand) wf = 'kneelOpen';
      else if (t < T.stand + .3) wf = 'fwd';
      else wf = ['fw0', 'fw1', 'fw2', 'fw3'][Math.floor(t * 6) % 4];
      lit = t < T.gust ? 1 : t < T.dim ? lerp(.8, .35, seg(t, T.gust, T.dim)) : t < T.relight ? lerp(.3, .05, ss(seg(t, T.dim, T.dark))) : lerp(.05, 1, ss(seg(t, T.relight, T.relight + 1.2)));
      wpos = new THREE.Vector3(x, y, 0);
      // 光与气氛
      const amb = 1 - darkK * .94;
      const ext = clamp(1 - ss(seg(t, T.gust + .3, T.dark + .3)) + ss(seg(t, T.stand, T.stand + 1.2)));   // 额外的夜间可读补光：全黑与重燃段不加
      hemi.intensity = (.75 + fl * 1.6) * amb + 1.0 * ext; diff.intensity = .55 * amb + 1.3 * ext; bolt.intensity = fl * 11;
      SK.u.k.value = (.8 + fl * 2.2) * amb + .05 + .35 * ext;
      clouds.forEach((c, i) => { c.m.position.x = c.x0 - t * c.sp * (1 + gustK * 2); c.m.material.color.setScalar((.6 + fl * 2.4) * (1 - darkK * .85) + .3 * ext); });
      tower.visible = true;
      const wind = -8 - gustK * 16 + darkK * 5;
      RB[0] = wpos.x - 14 - 22 * ek; RB[3] = wpos.x + 14 + 22 * ek; RB[1] = wpos.y - 6 - 10 * ek; RB[4] = wpos.y + 14 + 22 * ek;
      RAIN.userData.update(t, [wind, 0]); RAIN.material.opacity = (.3 + fl * .4) * (1 - darkK * .78);
      splashK = 1 - darkK * .9; splash.userData.update(t);
      grasses.forEach(g => { g.g.rotation.set(0, Math.atan2(cam.position.x - g.g.position.x, cam.position.z - g.g.position.z), (.12 + gustK * .25) * Math.sin(t * (5 + gustK * 6) + g.ph) + .15 + gustK * .3); });
      SEA.u.t.value = t * 1.6; SEA.u.camPos.value.copy(cam.position); SEA.u.fogColor.value.copy(scene.fog.color); SEA.u.fogDensity.value = .004; SEA.u.bright.value = (1 + fl * 3) * amb;
      foams.forEach(f => { f.tx.offset.x = f.i * .37 + Math.sin(t * .9 + f.i * 2) * .012; f.m.scale.y = 1 + .25 * Math.sin(t * 1.3 + f.i * 1.7); f.m.material.color.setScalar(((.4 + fl * .9) * amb + .25 * ext)); });
      sprayK = amb; spray.userData.update(t);
      // 镜头
      const sm = new THREE.Vector3(x, (x - X0) * RISE / RUN + .12, 0);   // 平滑的台阶高度，给镜头用
      const lk = sm.clone().add(V3(lookOff(t))).lerp(V3(estLook(Math.min(t, 37))), ek);
      cam.position.copy(sm).add(V3(camOff(t))).lerp(V3(estPos(Math.min(t, 37))), ek); cam.fov = lerp(30, 34, ek); cam.updateProjectionMatrix(); cam.lookAt(lk);
      scene.fog.density = lerp(.014, .0075, ek);
      // 后期：风暴更冷更灰；全黑段更暗
      V.warm.value = -.25 + (1 - darkK) * 0 + ss(seg(t, T.relight, T.relight + 2)) * .35; V.sat.value = .82 + ss(seg(t, T.relight, T.relight + 2)) * .15; V.amt.value = .62 + darkK * .25;
      renderer.toneMappingExposure = 1.15 + fl * .5;
      post.bloom.strength = .55 + darkK * .3;
      fill.intensity = 1.2 * amb; fill.position.copy(wpos).add(new THREE.Vector3(.2, 1.6, 2.4));
      const fd = cam.position.distanceTo(wpos.clone().add(new THREE.Vector3(.2, .7, 0)));
      post.dof.focus = fd; post.dof.aper = fd < 9 ? 140 : 170; post.dof.maxCoc = 22;
    } else {
      scene.fog.color.set('#18223a'); scene.fog.density = .006;
      // Wren：49.5–50.8 从楼梯口升上来，51–52.2 走到透镜前，52.6 举灯，53.0 倒火
      const H0 = new THREE.Vector3(-1.2, 0, .75), P1 = new THREE.Vector3(-1.02, 0, .98);
      const rise = eo(seg(t, 49.5, 50.9)), walk = ss(seg(t, 51.0, 52.2));
      wpos = H0.clone().lerp(P1, walk); wpos.y = lerp(-1.45, 0, rise) + (rise < 1 ? (Math.floor(t * 6) % 2) * .04 : 0);
      if (t < 51.0) wf = rise < 1 ? (Math.floor(t * 5) % 2 ? 'fw1' : 'fw3') : 'fwd';
      else if (t < 52.2) wf = ['fw0', 'fw1', 'fw2', 'fw3'][Math.floor(t * 6) % 4];
      else if (t < T.pour) wf = 'fwd';
      else if (t < T.pour + .4) wf = 'up';
      else if (t < T.pour + .7) wf = 'pour';
      else wf = 'pourEnd';
      lit = t < T.pour + .7 ? 1 : 0;
      const ig = t >= T.ignite ? 1 : 0, burst = ig * Math.exp(-(t - T.ignite) / .22), settle = ig * ss(seg(t, T.ignite, T.ignite + .6));
      const pre = ss(seg(t, T.pour + .45, T.ignite));   // 火进入进火口 → 透镜里先微亮
      lensM.emissiveIntensity = pre * .25 + ig * (1.4 + burst * 2);
      lensM.map = ig ? lensOn : lensOff;
      feed.material.emissiveIntensity = pre * 3 + ig * 3;
      lensL.intensity = pre * 4 + ig * (70 + burst * 180);
      lensGlow.material.opacity = pre * .5 + ig * (.55 + burst * .45); lensGlow.scale.setScalar(4 + ig * (1.5 + burst * 3));
      const pb = ss(seg(t, 54.5, 57.2));   // 拉远段：月光与溢光把塔身照出来
      // 光柱
      const sp = t < T.beam ? 0 : Math.min(t - T.beam, 1.6) ** 2 / 3.2 + Math.max(0, t - T.beam - 1.6);
      const bOn = ig * ss(seg(t, T.ignite, T.ignite + .5));
      beams.forEach((bm, i) => { const ang = 2.2 + sp * .6 + i * Math.PI, dir = new THREE.Vector3(Math.cos(ang), -.05, Math.sin(ang)); const o = lens.getWorldPosition(new THREE.Vector3()); const side = bm.userData.aim(o, dir, cam); bm.visible = bOn > .01 && !storm; bm.material.uniforms.k.value = (.6 + pb * .45) * bOn * Math.pow(side, 1.5) * (1 + burst); bm.material.uniforms.t.value = t; });
      spark.userData.update(t); drips.userData.update(t);
      ST2.material.uniforms.t.value = t; SK2.u.k.value = 1;
      SEA2.u.t.value = t; SEA2.u.camPos.value.copy(cam.position); SEA2.u.fogColor.value.copy(scene.fog.color); SEA2.u.fogDensity.value = scene.fog.density;
      SEA2.setLights(ig ? [{ p: lens.getWorldPosition(new THREE.Vector3()), c: new THREE.Color('#fff0c8'), i: 1.2 * bOn }] : []);
      hemi.intensity = .6 + pb * .55; moon2.intensity = .9 * (1 - ig * .4); moonFront.intensity = pb * 1.3; spill.intensity = ig * pb * 26;
      // 镜头：先中景，爆光后拉远上升
      cam.position.copy(V3(camLamp(t)).add(LP)); cam.fov = lerp(30, 40, ss(seg(t, 54.2, 58))); cam.updateProjectionMatrix(); cam.lookAt(V3(lookLamp(t)).add(LP));
      V.warm.value = .1 + ig * .25; V.sat.value = 1.05; V.amt.value = .62;
      renderer.toneMappingExposure = 1.15 + burst * .45 + settle * .1;
      post.bloom.strength = .5 + burst * .25 + ig * .1; post.bloom.threshold = .95;
      V.fade.value = 1 + burst * .12;
      fill.intensity = 1.4 * (1 - ig); fill.position.copy(wpos).add(LP).add(new THREE.Vector3(.1, 1.5, 2.2));
      const target = t < T.ignite + .7 ? wpos.clone().add(LP).add(new THREE.Vector3(.3, .7, 0)) : lens.getWorldPosition(new THREE.Vector3());
      const fd = cam.position.distanceTo(target);
      post.dof.focus = fd; post.dof.aper = lerp(150, 320, ss(seg(t, 54.5, 57.5))); post.dof.maxCoc = 22;
      wpos.add(LP);
    }
    // 角色 + 灯光
    wren.root.position.copy(wpos); wren.frame(wf); wren.face(cam, wflip);
    const lp = wren.lanternPos(wf, wflip), toCam = cam.position.clone().sub(lp).setY(0).normalize().multiplyScalar(.45);
    const fk = t > T.gust && t < T.stand ? 1 + .35 * Math.sin(t * 31) * Math.sin(t * 17) : flick(t, 4);
    lanL.position.copy(lp).add(toCam); lanL.intensity = lit > 0 ? Math.max(.14, 3.2 * Math.pow(lit, 1.3)) * fk : 0;
    lanG.position.copy(lp); lanG.material.opacity = Math.min(.8, .25 + lit * .7) * (lit > 0 ? 1 : 0); lanG.scale.setScalar(.25 + lit * .55);
  }
  return { scene, update };
}
