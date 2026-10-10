// Toy Town Rush Hour — Tilt-Shift Miniature 风格 demo
import * as THREE from 'three';
import { makePost } from './post.js';
import { clamp, seg, lerp, ss, eio, eo, hash, monotone, track, mulberry } from '/core/lib.js';
import { buildCity, AV, ST, avW, stW, RAIL, ZEBRA_Z, POND, CURB, U } from './city.js';
import { makeSky } from './sky.js';
import { LANES, LIGHT, ixOff, lightState, simulate, sampleSim, carS, laneWorld, laneYaw, makeFleet, makeTrails, makeWalkers, HERO_COL } from './traffic.js';
import { makeTrain, CAR_L, CAR_GAP, NCARS } from './train.js';
import { DUR, T, SHOTS, shotAt, WINDOWS, windowAt, clockAt, fmtClock, VO, TITLE, BEAT } from './story.js';
import { makeDucks, duckState } from './ducks.js';

const W = 1920, H = 1080, QS = new URLSearchParams(location.search);
await document.fonts.load('800 150px Overpass'); await document.fonts.load('600 40px Overpass'); await document.fonts.load('600 40px "Overpass Mono"');

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 1, 12000);
const post = makePost(renderer, scene, camera, W, H, { ssaa: 2, ao: !QS.has('noao'), aoRadius: 2.5, aoThickness: 3, aoScale: 1.4, aoAmt: .75 });
post.bloom.strength = .22; post.bloom.threshold = 1.1; post.bloom.radius = .5;

const city = buildCity(scene);
const sky = makeSky(scene, renderer);
const fleet = makeFleet(scene), trails = makeTrails(scene), walkers = makeWalkers(scene, city);
const train = makeTrain(scene);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// —— 招牌：大道西侧一栋中高层楼顶，面朝大道（+x），前方是 24 米宽的大道，视线不被挡 ——
{
  const cand = city.bl.filter(b => b.x1 > -17 && b.x1 < -12 && b.z0 > -175 && b.z1 < -12 && b.h > 13 && b.h < 32 && (b.z1 - b.z0) > 12).sort((a, b) => (b.z1 - b.z0) * 2 + b.h - ((a.z1 - a.z0) * 2 + a.h));
  const b = cand[0] || { x0: -40, x1: -16, z0: -40, z1: -20, h: 20 };
  const g = city.sign.g; g.scale.setScalar(.62); g.rotation.y = Math.PI / 2;
  g.position.set(b.x1 - 3, b.h + 2.4, (b.z0 + b.z1) / 2);
  city.SIGNB = b;
}

// —— 各时间窗的交通预模拟 ——
const heroIx = { X: -90, Z: 60 };
for (const Wn of WINDOWS) Wn.light = { off: 0, heroX: 99999, heroZ: 99999 };
WINDOWS[2].light = { off: clockAt(T.greenA, WINDOWS[2]), heroX: heroIx.X, heroZ: heroIx.Z };
WINDOWS[0].light = { off: clockAt(T.firstNote, WINDOWS[0]) - 48, heroX: 0, heroZ: 0 };   // 东西向 3.0s 转绿
const useLight = Wn => Object.assign(LIGHT, Wn.light);
const rateFor = (dens) => (L, simT) => (L.main ? 1.7 : 1) * dens * (L.axis === 'x' ? 1.1 : 1);
const SIMS = {};
function sim(name, cfg) { const Wn = WINDOWS.find(w => w.name === name); useLight(Wn); SIMS[name] = simulate({ t0: clockAt(Wn.t0, Wn), t1: clockAt(Math.min(Wn.t1, DUR), Wn) + 2, ...cfg }); }
sim('title', { warm: 400, dt: .5, rate: rateFor(.02), seed: 3 });
sim('ix', { warm: 500, dt: .25, rate: rateFor(.11), seed: 5 });
sim('train', { warm: 500, dt: .25, rate: rateFor(.14), seed: 7 });
// 大堵车：超过路口通行能力的车流 + 红车在斑马线前让鸭子（让行一直持续到最后一只小鸭跳上路沿）
{
  const Wn = WINDOWS.find(w => w.name === 'jam'); useLight(Wn);
  const heroLane = LANES.findIndex(l => l.axis === 'z' && l.road === 0 && l.dir < 0 && Math.abs(l.c - 6.0) < .01);   // 北行外侧车道（紧挨东侧路沿，鸭子最后过的那条）
  SIMS.jam = simulate({ t0: clockAt(19, Wn), t1: clockAt(DUR, Wn) + 2, warm: 620, dt: .25, rate: (L, T2) => (L.main ? 1.7 : 1) * .3 * (L.axis === 'x' ? 1.1 : 1), seed: 11,
    hero: { lane: heroLane, spawn: clockAt(19, Wn) - 200, s0: (720 - 34.4) - 60 }, zebra: { dist: 30, until: clockAt(T.release + .35, Wn) } });
}

// —— 清晨的红车：手写路线（南行 → 左转东行 → 红灯停 → 3.0s 绿灯走）——
const dawnPath = (() => {
  // 大道 X=90 北行（x=92.4，从画面下方驶来）→ 左转上主街 Z=0 西行（z=-2.0）→ 在大路口 (0,0) 红灯前停 → 3.0s 绿灯 → 穿过路口
  const P = [], r = 8, x0 = 92.4, zl = -2.0, cx = x0 - r, cz = zl + r;
  for (let z = 220; z >= cz; z -= 2) P.push([x0, z]);
  for (let i = 1; i <= 14; i++) { const a = i / 14 * Math.PI / 2; P.push([cx + Math.cos(a) * r, cz - Math.sin(a) * r]); }
  for (let x = cx - 2; x >= -500; x -= 2) P.push([x, zl]);
  const S = [0]; for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  return { P, S };
})();
const dawnStop = (() => { const target = 16.4 + 2.3; const i = dawnPath.P.findIndex(p => p[1] === -2.0 && p[0] <= target); return dawnPath.S[i]; })();
const dawnS = monotone([[0, dawnStop - 200], [1.6, dawnStop - 44], [2.35, dawnStop], [3.05, dawnStop], [3.7, dawnStop + 24], [5.1, dawnStop + 170]]);
function pathAt(s) {
  const { P, S } = dawnPath; s = clamp(s, 0, S[S.length - 1] - .01);
  let i = 0, j = S.length - 1; while (j - i > 1) { const m = (i + j) >> 1; if (S[m] <= s) i = m; else j = m; }
  const u = (s - S[i]) / (S[j] - S[i] || 1), x = lerp(P[i][0], P[j][0], u), z = lerp(P[i][1], P[j][1], u);
  return { x, z, yaw: Math.atan2(-(P[j][1] - P[i][1]), P[j][0] - P[i][0]) };
}

// —— 镜头 ——
// 每个镜头：pos / look / up / fov；移轴参数：物理光圈 aper + 屏幕虚化带 band；span = 阴影范围；az = 太阳方位（按镜头布光）
const BAND = (y, w, amp, mix = .55, tilt = 0) => ({ y, w, amp, mix, tilt, pow: 1.2 });
const UPN = V(0, 0, -1), UPY = V(0, 1, 0);
const topDown = (look, h, yaw) => ({ pos: look.clone().add(V(0, h, .01)), look, up: V(Math.sin(yaw), 0, -Math.cos(yaw)) });
// 大堵车 → 俯冲 → 鸭子 → 升起：一条连续的机位曲线
const JAM = {
  A: topDown(V(1, 0, 13), 200, -22 * Math.PI / 180),   // 正上方俯拍缓慢旋转，转到朝东北，俯冲后正好接上鸭子机位的朝向
  B: topDown(V(4, 0, 18), 172, 48 * Math.PI / 180),
  // 鸭子中近景：机位压到红车引擎盖上方、接近鸭子的高度，斜俯角看向斑马线东端；红车车头是虚化前景，清晰带在鸭子上
  C: { pos: V(4.2, 1.78, 34.6), look: V(10.2, .16, 30.9), up: UPY, fov: 18 },
  D: { pos: V(4.4, 1.74, 34.4), look: V(10.6, .16, 30.9), up: UPY, fov: 17.5 },
  E: topDown(V(0, 0, 14), 820, 0),
  F: topDown(V(0, 0, 14), 900, 5 * Math.PI / 180),
};
function blendCam(a, b, u, fa, fb) {
  const pos = a.pos.clone().lerp(b.pos, u), look = a.look.clone().lerp(b.look, u), up = a.up.clone().lerp(b.up, u).normalize();
  return { pos, look, up, fov: lerp(fa, fb, u) };
}
function jamCam(t) {
  if (t < T.rampDown[0]) { const u = seg(t, 19, T.rampDown[0]); return { ...blendCam(JAM.A, JAM.B, ss(u), 30, 30) }; }
  if (t < T.rampDown[1] + .1) {   // 俯冲：先加速后减速，高度按对数插值
    const u = eio(seg(t, T.rampDown[0], T.rampDown[1] + .1)), c = blendCam(JAM.B, JAM.C, u, 30, 17);
    const h = Math.exp(lerp(Math.log(JAM.B.pos.y), Math.log(JAM.C.pos.y), u)); c.pos.y = h;
    c.look = JAM.B.look.clone().lerp(JAM.C.look, 1 - Math.pow(1 - u, 2.5));   // 视线先落到鸭子上，身体再落下去
    return c;
  }
  if (t < T.release) { const u = seg(t, T.rampDown[1] + .1, T.release); return blendCam(JAM.C, JAM.D, ss(u), 17, 16.5); }
  if (t < T.end) {   // 升起：对数高度，越来越快，最后减速停在电路板高度
    const u = seg(t, T.release, T.end - .1), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const c = blendCam(JAM.D, JAM.E, e, 16.5, 30);
    const eh = 1 - Math.pow(1 - u, 2.2);   // 高度一开始就抬起来（红车要从机位旁开走），之后减速停在电路板高度
    c.pos.y = Math.exp(lerp(Math.log(JAM.D.pos.y), Math.log(JAM.E.pos.y), eh));
    c.up = UPY.clone().lerp(UPN, ss(seg(u, .1, .7))).normalize();
    return c;
  }
  return blendCam(JAM.E, JAM.F, ss(seg(t, T.end, DUR)), 30, 30);
}
let DUCKC = V(9, .2, 30);
function cam(t, st) {
  const [t0, t1, name] = st, u = seg(t, t0, t1);
  let pos, look, up = UPY, fov = 30, aper = 5000, band = BAND(.5, .055, 30), span = 220, az = 140;   // 太阳方位按镜头布光（每个延时片段各自独立，方位可以作弊）
  switch (name) {
    case 'dawn': {
      look = V(52, 0, 4).lerp(V(38, 0, 2), u);
      pos = look.clone().add(V(-10, 200, 150)); fov = 29; aper = 6000; band = BAND(.5, .06, 26, .5, 0); span = 330;
      const hp = pathAt(dawnS(Math.min(t, 4.2))); band.follow = V(hp.x, 0, hp.z); break;
    }
    case 'title': {
      az = 88; const s = city.sign.g.position; look = V(s.x, s.y + 4, s.z);
      pos = look.clone().add(V(60 - 8 * u, 40, -8 - 8 * u)); fov = 29; aper = 3000; band = BAND(.5, .075, 30, .5); span = 240; break;
    }
    case 'ix': {
      look = V(heroIx.X, 0, heroIx.Z).add(V(3, 0, 3));
      pos = look.clone().add(V(-52, 128, 78).multiplyScalar(lerp(1.06, .94, eio(u)))); fov = 27; aper = 7000; band = BAND(.5, .055, 30); span = 200; break;
    }
    case 'train': {
      const cx = lerp(-40, 12, eio(u));
      look = V(cx, 2, (RAIL.zB + RAIL.pz0) / 2); pos = look.clone().add(V(-14, 58, 60)); fov = 27; aper = 7000; band = BAND(.5, .055, 30, .55, .02); span = 200; break;
    }
    default: {
      const c = jamCam(t); pos = c.pos; look = c.look; up = c.up; fov = c.fov; span = clamp(c.pos.y * .9, 40, 900); az = 200;
      const h = c.pos.y;
      if (t < T.rampDown[0]) band = BAND(.5, .06, 30, .7);
      else if (t < T.release) { const k = seg(t, T.rampDown[0], T.rampDown[1]); band = BAND(.5, lerp(.06, .05, k), 30, lerp(.7, .35, k)); band.follow = DUCKC; aper = lerp(9000, 700, k); }
      else band = BAND(.5, lerp(.035, .07, seg(t, T.release, T.end)), 30, .75);
      if (t >= T.end) band = BAND(.5, .08, 26, .8);
    }
  }
  const o = QS.get('cam'); if (o) { const a = o.split(',').map(Number); pos = V(a[0], a[1], a[2]); look = V(a[3], a[4], a[5]); if (a[6]) fov = a[6]; }
  const nearCam = pos.y < 12; camera.near = nearCam ? .08 : 1; camera.far = nearCam ? 4000 : 12000;   // 贴近地面的镜头要小近裁面（引擎盖前景）
  camera.position.copy(pos); camera.up.copy(up); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(look);
  camera.updateMatrixWorld();
  let focus = pos.distanceTo(look);
  if (band.follow) { const p = band.follow.clone().project(camera); band.y = clamp((p.y + 1) / 2, .25, .75); focus = pos.distanceTo(band.follow); }
  const d = post.dof; d.focus = focus; d.aper = +(QS.get('aper') ?? aper); d.maxCoc = 30;
  Object.assign(d.band, band); if (QS.has('bmix')) d.band.mix = +QS.get('bmix'); if (QS.has('bamp')) d.band.amp = +QS.get('bamp');
  if (QS.has('nodof')) d.maxCoc = 0;
  if (QS.has('az')) az = +QS.get('az');
  return { pos, look, span, name, az };
}

// —— 火车运动：车厢经过站台标记的时刻落在网格上（八分 → 四分 → 二分，最后停稳）——
const MARK_X = 61 - (NCARS - 1) * (CAR_L + CAR_GAP);
const TRAIN_PASS = [14.5, 14.75, 15.0, 15.5, 16.0, 17.0];
const trainHead = monotone([[12.8, MARK_X - 150], ...TRAIN_PASS.map((tt, k) => [tt, MARK_X + k * (CAR_L + CAR_GAP)]), [18.6, 61], [19.3, 72], [20.2, 150]]);


// —— 路口人群：红灯时在路角聚集，绿灯一放行就成群过街（相位与红绿灯一致）——
const PC = ['#e8463c', '#2f5fb3', '#f2c230', '#f4f4f0', '#2a2d33', '#3f8f5a', '#e07bb0', '#f08a2c', '#6fb7e0', '#7a4a8c', '#c9c2b4', '#1f3b66'];
function crowds(clock, X, Z, dens = 1) {
  const hx = avW(X) / 2, hz = stW(Z) / 2, C = LIGHT.C, base = LIGHT.off + ixOff(X, Z);
  const k0 = Math.floor((clock - base) / C);
  // 四条斑马线：[轴, 固定坐标, 起点, 终点, 放行相位(0=南北绿,0.5=东西绿)]
  const XW = [['x', Z - hz - 2.4, X - hx - 1.6, X + hx + 1.6, .5], ['x', Z + hz + 2.4, X - hx - 1.6, X + hx + 1.6, .5], ['z', X - hx - 2.4, Z - hz - 1.6, Z + hz + 1.6, 0], ['z', X + hx + 2.4, Z - hz - 1.6, Z + hz + 1.6, 0]];
  XW.forEach((cw, ci) => {
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const g0 = base + k * C + cw[4] * C, n = Math.floor((5 + hash(k * 13.1 + ci * 7.7 + X) * 7) * dens);
      for (let i = 0; i < n; i++) {
        const h1 = hash(k * 31.7 + ci * 11.3 + i * 5.9 + X * .1 + Z), h2 = hash(h1 * 91.1 + i), h3 = hash(h2 * 17.3 + 3.1);
        const side = h1 < .5 ? 0 : 1, arrive = g0 - C * .5 * h2, go = g0 + .6 + h3 * 3.5, v = 1.25 + h2 * .45, L = cw[3] - cw[2];
        if (clock < arrive) continue;
        const lat = (h3 - .5) * 2.4, wait = side ? cw[3] + .8 + h1 * 1.2 : cw[2] - .8 - h2 * 1.2;
        let a;
        if (clock < go) a = wait;
        else { const d = (clock - go) * v; if (d > L + 14) continue; a = side ? cw[3] - d : cw[2] + d; }
        const x = cw[0] === 'x' ? a : cw[1] + lat, z = cw[0] === 'x' ? cw[1] + lat : a;
        const onRoad = cw[0] === 'x' ? Math.abs(a - X) < hx : Math.abs(a - Z) < hz;
        walkers.put(x, z, PC[Math.floor(h2 * PC.length)], .9 + h3 * .2, onRoad ? 0 : CURB);
      }
    }
  });
}
// —— 站台人群（按真实时间编排）——
function platform(t) {
  const pz = (RAIL.pz0 + RAIL.pz1) / 2, doorX = [];
  for (let k = 0; k < NCARS; k++) { const c = 61 - CAR_L / 2 - k * (CAR_L + CAR_GAP); doorX.push(c - 6.6, c, c + 6.6); }
  for (let i = 0; i < 46; i++) {   // 候车
    const h = hash(i * 3.7 + 1), x0 = -80 + h * 150, z0 = pz - 1.6 + hash(i * 9.1) * 2.6, board = T.trainStop + .25 + hash(i * 5.3) * .9;
    if (t < board) { walkers.put(x0 + Math.sin(t * 2 + i) * .15, z0, PC[i % PC.length], 1, 1.1); continue; }
    const dx = doorX.reduce((b, d) => Math.abs(d - x0) < Math.abs(b - x0) ? d : b, 1e9), u = clamp((t - board) / .35);
    if (u < 1) walkers.put(lerp(x0, dx, u), lerp(z0, RAIL.pz0 + .3, u), PC[i % PC.length], 1, 1.1);
  }
  for (let i = 0; i < 60; i++) {   // 下车 → 走向天桥楼梯
    const d = doorX[i % doorX.length], out = T.trainStop + .1 + hash(i * 7.9) * .8;
    if (t < out) continue;
    const dist = (t - out) * 8.5, sx = Math.sign(-d) || 1, zz = pz - 1.6 - hash(i * 2.3) * .8;
    const x = Math.abs(d) > dist ? d + sx * dist : 0;
    if (Math.abs(d) <= dist && dist - Math.abs(d) > 4) continue;
    walkers.put(x, dist < 1.5 ? lerp(RAIL.pz0 + .3, zz, dist / 1.5) : zz, PC[(i * 7) % PC.length], 1, 1.1);
  }
}

// —— 鸭子 ——
const ducks = makeDucks(scene);
const JAMW = WINDOWS.find(w => w.name === 'jam');
const jamClock = tt => clockAt(tt, JAMW);

// —— 云（只在升起时可见：镜头穿过云层）——
const clouds = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const R = mulberry(9);
  for (let i = 0; i < 60; i++) { const px = 128 + (R() - .5) * 140, py = 128 + (R() - .5) * 80, r = 20 + R() * 50, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group(), R2 = mulberry(21), list = [];
  for (let i = 0; i < 30; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, fog: false, color: '#f4f6fa' }));
    const s = 160 + R2() * 260; m.scale.set(s, 1, s * (.6 + R2() * .4));
    let px = (R2() - .5) * 1300, pz = 14 + (R2() - .5) * 1000; if (i > 1 && Math.hypot(px, pz - 20) < 220) px += Math.sign(px || 1) * 260;
    if (i < 2) { px = 40 - i * 90; pz = 30 + i * 40; }
    m.position.set(px, i < 2 ? 640 + i * 180 : 420 + R2() * 520, pz); m.rotation.y = R2() * 6; m.renderOrder = 6;
    grp.add(m); list.push(m);
  }
  scene.add(grp); return { grp, list };
})();

// —— 延时的"卡顿感"：快进段里城市按 8 Hz（= 十六分音符）步进，镜头每帧平滑；真实速度段完全平滑 ——
function stepT(t, Wn) {
  if (QS.has('nostep')) return t;
  const r = Wn.rate(t), hz = r >= 6 ? 8 : r >= 2 ? 12 : 0;
  return hz ? Wn.t0 + Math.floor((t - Wn.t0) * hz + 1e-6) / hz : t;
}

// —— 帧 ——
const tmpV = new THREE.Vector3();
let smp = [];
function render(t) {
  const st = shotAt(t), Wn = windowAt(t), tq = stepT(t, Wn), clock = clockAt(tq, Wn);
  useLight(Wn);
  // 先算鸭子（清晰带要跟着母鸭）
  const duckP = Wn.name === 'jam' ? [0, 1, 2, 3, 4].map(i => duckState(i, tq, clock, jamClock, T.hops)) : null;
  if (duckP) DUCKC = V(duckP[0].x - 1.0, .15, duckP[0].z);
  const C = cam(t, st);
  const S = sky.apply(clock, C.look, C.span, { az: C.az, fog: .00022 * clamp(300 / C.pos.y, .12, 1) });
  const night = S.night;
  city.headMat.color.setRGB(1, .62, .3).multiplyScalar(.25 + 6 * night); city.poolMat.opacity = night * .2;
  // 红绿灯
  {
    const cG = new THREE.Color(.1, 1.6, .5), cY = new THREE.Color(1.8, 1, .1), cR = new THREE.Color(1.8, .1, .08), m4 = new THREE.Matrix4();
    const I = .9 + 1.5 * night;
    city.tlights.forEach((L, i) => {
      const s = lightState(L.X, L.Z, L.face === 'ns', clock);
      m4.makeTranslation(L.x, 5.3, L.z); city.tlamp.setMatrixAt(i, m4);
      city.tlamp.setColorAt(i, (s === 0 ? cG : s === 1 ? cY : cR).clone().multiplyScalar(I));
    });
    city.tlamp.count = city.tlights.length; city.tlamp.instanceMatrix.needsUpdate = true; city.tlamp.instanceColor.needsUpdate = true;
  }
  city.craneArm.rotation.y = Math.sin(clock / 400) * 1.6 + clock / 900;
  // 车
  fleet.begin(); fleet.setNight(night); trails.begin(); walkers.begin();
  const hgt = C.pos.y, rise = Wn.name === 'jam' && t > T.release ? seg(t, T.release + 1, T.end - .5) : 0;
  const trailI = Math.max(night * 2.2, rise * 3.5), tw = Math.max(1, hgt / 240);
  if (Wn.name === 'dawn') {
    const s = dawnS(tq), p = pathAt(s);
    fleet.put(p.x, p.z, p.yaw, 'car', HERO_COL, 0, true);
    if (Math.abs(t - T.secondNote) < 1.2 || t > T.secondNote) {   // 第二辆车：远处南北向大道上的一道光
      const L = LANES.find(l => l.axis === 'z' && l.road === 180 && l.dir < 0), s2 = (tq - 3.6) * 150;
      if (s2 > 0) { const q = laneWorld(L, s2); fleet.put(q.x, q.z, laneYaw(L), 'taxi', '#f2c230');
        if (trailI > .02) { const a = laneWorld(L, Math.max(0, s2 - 70)); trails.ribbon([[a.x, a.z], [q.x, q.z]], 'head', trailI * 1.6, .9); trails.ribbon([[a.x + .5, a.z], [q.x + .5, q.z]], 'tail', trailI * 1.6, .8); } }
    }
    if (trailI > .02) {
      const pts = [], back = [];
      for (let k = 0; k < 14; k++) { const tt = tq - 1.6 + k * 1.6 / 13, q = pathAt(dawnS(Math.max(0, tt))); const f = [Math.cos(q.yaw), -Math.sin(q.yaw)], sd = [-f[1], f[0]]; pts.push([q.x + f[0] * 2.1 + sd[0] * .45, q.z + f[1] * 2.1 + sd[1] * .45]); back.push([q.x - f[0] * 2.1 - sd[0] * .45, q.z - f[1] * 2.1 - sd[1] * .45]); }
      trails.ribbon(pts, 'head', trailI * 2.4, .9); trails.ribbon(back, 'tail', trailI * 2.6, .8);
    }
  } else if (SIMS[Wn.name]) {
    const Sm = SIMS[Wn.name];
    smp = sampleSim(Sm, clock, smp);
    const R = clamp(hgt * 4, 160, 1400), shutter = Math.max(Wn.rate(t) / 12, .5);
    for (const { c, s, v } of smp) {
      const L = LANES[c.lane], yaw = laneYaw(L);
      laneWorld(L, s - c.len / 2, tmpV);
      if (Math.abs(tmpV.x - C.look.x) > R || Math.abs(tmpV.z - C.look.z) > R) continue;
      fleet.put(tmpV.x, tmpV.z, yaw, c.type, c.col, 0, c.hero, true, v < .6);
      if (trailI > .02) {
        const s0 = carS(Sm, c, clock - shutter) ?? s;
        if (s - s0 < .5) continue;
        const a = laneWorld(L, s0), b = laneWorld(L, s);
        trails.ribbon([[a.x, a.z], [b.x, b.z]], 'head', trailI, tw);
        const a2 = laneWorld(L, s0 - c.len), b2 = laneWorld(L, s - c.len);
        trails.ribbon([[a2.x, a2.z], [b2.x, b2.z]], 'tail', trailI * 1.2, tw * .9);
      }
    }
  }
  for (const pr of city.props) fleet.put(pr.x, pr.z, pr.ry, pr.type === 'truck' ? 'truck' : 'car', pr.col || ['#f4f4f0', '#2a2d33', '#c9ccd0', '#1f4e9c', '#b8272c', '#8a8f96'][Math.floor(hash(pr.x * 3 + pr.z) * 6)], CURB, false, false);
  fleet.end(night);
  trails.end();
  // 行人
  const far = hgt > 700;
  if (!far) {
    walkers.sidewalks(clock, { x: C.look.x, z: C.look.z, r: Math.min(420, 120 + hgt) });
    if (Wn.name !== 'dawn') for (const X of AV) for (const Z of ST) if (Math.abs(X - C.look.x) < 260 && Math.abs(Z - C.look.z) < 220) crowds(clock, X, Z, Wn.name === 'title' ? .3 : Wn.name === 'jam' ? 1.5 : 1);
    if (Wn.name === 'train') platform(tq);
  }
  walkers.end();
  // 火车
  if (Wn.name === 'train') train.place(trainHead(tq), RAIL.zB); else train.place(-2600, RAIL.zB);
  // 鸭子
  const showDucks = Wn.name === 'jam';
  for (let i = 0; i < 5; i++) {
    if (!showDucks) { ducks.pose(i, { vis: false }); continue; }
    ducks.pose(i, duckP[i]);
  }
  // 招牌字母（片名：每个八分音符亮一个）
  {
    const n = clamp(Math.floor((t - T.title0) / BEAT * 2) + 1, 0, 99), L = city.sign.letters;
    L.forEach((l, i) => { const on = t >= T.title0 && i < n; l.m.material.opacity = on ? 1 : 0; l.m.material.color.copy(l.col).multiplyScalar(on ? 2.2 : 0); });
  }
  // 云：升起时从镜头旁掠过
  { const vis = clamp((hgt - 250) / 150) * (t > T.release - .5 ? 1 : 0); for (const m of clouds.list) { const dy = hgt - m.position.y; m.material.opacity = vis * (.42 * clamp(1 - Math.abs(dy) / 220) + (dy > 0 ? .05 : 0)) * (1 - seg(t, T.end - 1, T.end + .5) * .85); } clouds.grp.visible = vis > 0; clouds.grp.position.x = clock * .8 % 400; }
  const G = post.grade.uniforms;
  G.expo.value = S.expo * 1.08; G.sat.value = 1.55 - .25 * night; G.contrast.value = .42; G.warm.value = .38 * (1 - night);
  post.composer.render();
  hud(t, tq, clock, Wn);
}

// —— 2D 层：时钟、字幕、片名副标题、片尾 ——
const ov = document.getElementById('ov'), g = ov.getContext('2d');
let DURS = {};
try { const r = await fetch('voices/dur.json'); if (r.ok) DURS = await r.json(); } catch (e) { }
const voDur = v => DURS[v.id] ?? v.text.length * .07;
export const SUBS = VO.map((v, i) => ({ t0: v.t - .05, t1: Math.min(v.t + Math.max(voDur(v) + .7, 1.9), VO[i + 1] ? VO[i + 1].t - .15 : 99), text: v.text }));
const SIGN_GREEN = '#0f5e3c';
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function tlIcon(x, y, s, on) {   // 小红绿灯图标：三颗灯，当前亮绿
  g.fillStyle = '#1b1f24'; rr(x, y, 20 * s, 52 * s, 7 * s); g.fill();
  ['#ff4a3d', '#ffc233', '#3dff8a'].forEach((c, i) => { g.fillStyle = i === on ? c : 'rgba(255,255,255,.14)'; g.beginPath(); g.arc(x + 10 * s, y + (10 + i * 16) * s, 5.2 * s, 0, 7); g.fill(); });
}
function hud(t, tq, clock, Wn) {
  g.clearRect(0, 0, W, H);
  if (QS.has('nohud')) return;
  const A = 1 - seg(t, T.end - .6, T.end);   // 片尾前收掉时钟
  // 时钟（左上）：快进时数字飞转，真实速度时秒数一跳一跳
  if (t > .35 && A > 0) {
    const [hm, ss2] = fmtClock(clock), r = Wn.rate(t), a = seg(t, .35, .9) * A;
    g.save(); g.globalAlpha = a;
    g.fillStyle = 'rgba(12,16,20,.55)'; rr(56, 52, 212, 92, 14); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; rr(61, 57, 202, 82, 10); g.stroke();
    g.fillStyle = '#fff'; g.font = '600 46px "Overpass Mono"'; g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.fillText(hm, 80, 111);
    g.font = '500 24px "Overpass Mono"'; g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText(ss2, 214, 111);
    g.font = '700 19px Overpass'; g.fillStyle = r > 1.5 ? '#ffc233' : '#3dff8a'; g.fillText(r > 1.5 ? `×${Math.round(r)}  TIME-LAPSE` : '×1  REAL TIME', 80, 134);
    g.restore();
  }
  // 片名副标题（招牌亮完之后）
  if (t > 6.9 && t < 9.0) { const a = seg(t, 6.9, 7.2) * (1 - seg(t, 8.75, 9.0)); g.save(); g.globalAlpha = a; g.font = '700 30px Overpass'; g.textAlign = 'center'; const w = g.measureText('A  TILT-SHIFT  MINIATURE').width + 60; g.fillStyle = SIGN_GREEN; rr(W / 2 - w / 2, H - 200, w, 58, 10); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; rr(W / 2 - w / 2 + 6, H - 194, w - 12, 46, 7); g.stroke(); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText('A  TILT-SHIFT  MINIATURE', W / 2, H - 169); g.restore(); }
  // 字幕：路牌样式
  const sb = SUBS.find(s => t >= s.t0 && t < s.t1);
  if (sb && t < T.end) {
    const a = seg(t, sb.t0, sb.t0 + .15) * (1 - seg(t, sb.t1 - .15, sb.t1));
    g.save(); g.globalAlpha = a; g.font = '600 44px Overpass'; g.textBaseline = 'middle'; g.textAlign = 'left';
    const tw = g.measureText(sb.text).width, w = tw + 124, h = 76, x = (W - w) / 2, y = H - 118 - h;
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 18; g.shadowOffsetY = 4; g.fillStyle = SIGN_GREEN; rr(x, y, w, h, 12); g.fill(); g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 3; rr(x + 6, y + 6, w - 12, h - 12, 8); g.stroke();
    tlIcon(x + 26, y + 12, 1, 2);
    g.fillStyle = '#fff'; g.fillText(sb.text, x + 72, y + h / 2 + 3);
    g.restore();
  }
  // 片尾卡
  if (t >= T.end) {
    const a = ss(seg(t, T.end, T.end + .7));
    g.save(); g.globalAlpha = a;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(8,14,12,.15)'); gr.addColorStop(.5, 'rgba(8,14,12,.45)'); gr.addColorStop(1, 'rgba(8,14,12,.15)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const w = 980, h = 300, x = (W - w) / 2, y = H / 2 - h / 2 - 20;
    g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 30; g.fillStyle = SIGN_GREEN; rr(x, y, w, h, 22); g.fill(); g.shadowColor = 'transparent';
    g.strokeStyle = '#fff'; g.lineWidth = 5; rr(x + 12, y + 12, w - 24, h - 24, 14); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
    g.font = '800 82px Overpass'; g.fillText('Toy Town Rush Hour', W / 2, y + 112);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(x + 90, y + 176, w - 180, 3);
    g.font = '700 34px Overpass'; g.fillText('TILT-SHIFT  MINIATURE', W / 2, y + 222);
    tlIcon(x + 50, y + 124, 1.1, 2); tlIcon(x + w - 72, y + 124, 1.1, 2);
    g.font = '600 30px Overpass'; g.fillStyle = '#fff'; g.fillText('LemoLab × Claude Opus 5.5', W / 2, y + h + 70);
    g.restore();
  }
}

// —— 事件（给配乐与混音）——
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  VO.forEach(v => add('vo', v.t, { id: v.id }));
  add('firstNote', T.firstNote); add('secondNote', T.secondNote);
  city.sign.letters.forEach((l, i) => add('letter', T.title0 + i * BEAT / 2, { i, ch: l.ch }));
  TRAIN_PASS.forEach((tt, k) => add('carriage', tt, { k }));
  add('trainStop', T.trainStop); add('doors', T.trainStop + .15); add('trainGo', T.trainGo);
  T.jamHorn.forEach(tt => add('hornChord', tt));
  T.hops.forEach((tt, k) => add(k === 4 ? 'hopFail' : 'hop', tt, { k: k === 5 ? 4 : k }));
  add('rampDown', T.rampDown[0], { d: T.rampDown[1] - T.rampDown[0] }); add('release', T.release); add('finalChord', T.finalChord);
  // 城市事件：每 1/48 秒取样（步进后的时钟），检测"车过停止线"、变灯、行人放行
  const centers = { ix: [heroIx.X, heroIx.Z, 90], train: [0, -250, 160], jam: [0, 10, 110], title: [-20, -60, 140] };
  const prev = new Map();
  for (const Wn of WINDOWS) {
    const Sm = SIMS[Wn.name], cc = centers[Wn.name]; if (!Sm || !cc) continue;
    useLight(Wn);
    let lastLight = null, lastQ = -1;
    for (let t = Wn.t0; t < Math.min(Wn.t1, T.end + 2); t += 1 / 48) {
      const tq = stepT(t, Wn); if (tq === lastQ) continue; lastQ = tq;
      const clock = clockAt(tq, Wn), cur = sampleSim(Sm, clock, []);
      for (const { c, s } of cur) {
        const L = LANES[c.lane], p0 = prev.get(c); prev.set(c, s);
        if (p0 === undefined) continue;
        for (const stp of L.stops) if (stp.kind === 'light' && p0 < stp.s && s >= stp.s) {
          const dx = stp.X - cc[0], dz = stp.Z - cc[1]; if (Math.hypot(dx, dz) > cc[2]) continue;
          add('car', t, { win: Wn.name, axis: L.axis, X: stp.X, Z: stp.Z, hero: !!c.hero });
        }
      }
      const X0 = Wn.name === 'ix' ? heroIx.X : 0, Z0 = Wn.name === 'ix' ? heroIx.Z : 0, ls = lightState(X0, Z0, true, clock);
      if (lastLight !== null && ls !== lastLight && (ls === 0 || ls === 2)) { add('light', t, { win: Wn.name, ns: ls === 0 }); add('ped', t + .3, { win: Wn.name }); }
      lastLight = ls;
    }
    prev.clear();
  }
  // 鸭子真实速度段的脚步（小鸭 16 rad/s 相位 → 每半周期一步）
  for (let t = T.rampDown[1]; t < T.release; t += 1 / 48) {
    const tq = t, cl = jamClock(t);
    for (let i = 0; i < 5; i++) {
      const P = duckState(i, tq, cl, jamClock, T.hops); if (!P.walk) continue;
      const ph = P.phase, k = Math.floor(ph / Math.PI), P2 = duckState(i, tq - 1 / 48, jamClock(tq - 1 / 48), jamClock, T.hops);
      if (P2.walk && Math.floor(P2.phase / Math.PI) !== k) add('duckStep', t, { i });
    }
  }
  add('quack', 24.35, { i: 0 }); add('quack', 26.1, { i: 0, soft: 1 }); add('peep', 27.95, { i: 4 }); add('peep', 28.6, { i: 4 }); add('peep', 29.55, { i: 4, happy: 1 }); add('peep', 25.7, { i: 1 }); add('splash', 33.2);
  return ev.sort((a, b) => a.t - b.t);
}

window.render = render; window.DUR = DUR; window.SUBS = SUBS; window.DBG = { camera, post, city, SIMS, scene, ducks };
window.EV = QS.has('noev') ? [] : events();
render(parseFloat(QS.get('t') ?? '11'));
window.READY = true;
