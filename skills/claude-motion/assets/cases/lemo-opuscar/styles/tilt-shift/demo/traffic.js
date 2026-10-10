// 交通：车道、红绿灯相位、IDM 跟驰预模拟（按时间窗）、路口"堵死"占用、斑马线让行；行人（人行道绕街区 + 路口成群过街）；车辆实例化渲染与车灯光轨
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { AV, ST, avW, stW, EXT, ZEBRA_Z, CURB, SW } from './city.js';
import { mulberry, clamp, lerp, hash } from '/core/lib.js';

// —— 车道 ——
export const LANES = [];
const addLane = (axis, c, dir, road, main) => {
  const lo = axis === 'z' ? -266 : -720, hi = axis === 'z' ? 720 : 720;
  const a0 = dir > 0 ? lo : hi, len = hi - lo;
  const crosses = (axis === 'z' ? ST : AV).map(cc => ({ cc, half: axis === 'z' ? stW(cc) / 2 : avW(cc) / 2 }));
  const stops = [];
  for (const k of crosses) {
    const X = axis === 'z' ? road : k.cc, Z = axis === 'z' ? k.cc : road;
    const sl = k.cc - dir * (k.half + 4.4);
    stops.push({ s: (sl - a0) * dir, kind: 'light', X, Z, box: [(k.cc - k.half - a0) * dir, (k.cc + k.half - a0) * dir].sort((a, b) => a - b) });
  }
  if (axis === 'z' && road === 0) { const sl = ZEBRA_Z - dir * 3.0; stops.push({ s: (sl - a0) * dir, kind: 'zebra' }); }
  stops.sort((a, b) => a.s - b.s);
  LANES.push({ id: LANES.length, axis, c, dir, road, main, a0, len, stops });
};
for (const X of AV) for (const o of (X === 0 ? [2.5, 6.0] : [2.4])) { addLane('z', X - o, 1, X, X === 0); addLane('z', X + o, -1, X, X === 0); }
for (const Z of ST) for (const o of (Z === 0 ? [2.0, 5.5] : [2.4])) { addLane('x', Z + o, 1, Z, Z === 0); addLane('x', Z - o, -1, Z, Z === 0); }
export const laneWorld = (L, s, out = new THREE.Vector3()) => { const a = L.a0 + L.dir * s; return L.axis === 'z' ? out.set(L.c, 0, a) : out.set(a, 0, L.c); };
export const laneYaw = L => L.axis === 'x' ? (L.dir > 0 ? 0 : Math.PI) : (L.dir > 0 ? -Math.PI / 2 : Math.PI / 2);

// —— 红绿灯 ——  状态：0 绿 1 黄 2 红（对 ns=南北向车流 / ew）
export const LIGHT = { C: 96, off: 0, heroX: 0, heroZ: 0 };
export const ixOff = (X, Z) => (X === LIGHT.heroX && Z === LIGHT.heroZ) ? 0 : Math.floor(hash(X * 7.1 + Z * 3.3) * 8) * 12;
export function lightState(X, Z, axisNS, simT) {
  const ph = (((simT - LIGHT.off - ixOff(X, Z)) % LIGHT.C) + LIGHT.C) % LIGHT.C / LIGHT.C;
  if (axisNS) return ph < .46 ? 0 : ph < .5 ? 1 : 2;
  return ph < .5 ? 2 : ph < .96 ? 0 : 1;
}

// —— 车辆类型与颜色 ——
const CARCOL = ['#f4f4f0', '#f4f4f0', '#c9ccd0', '#2a2d33', '#1f4e9c', '#3d7fd0', '#b8272c', '#2f6b3f', '#e67a1e', '#8a8f96', '#e9e2cf', '#5a2a3c', '#77b7d8', '#f2f2ee'];
export const HERO_COL = '#e0262e';

// —— IDM 预模拟 ——
// cfg: { t0, t1, dt, warm, rate(lane, simT) → 车/秒, heroLane, heroSpawn, zebra: { trigger: 'hero', until }, seed }
export function simulate(cfg) {
  const dt = cfg.dt || .25, t0 = cfg.t0 - (cfg.warm || 300), t1 = cfg.t1, N = Math.ceil((t1 - t0) / dt) + 2;
  const R = mulberry(cfg.seed || 1);
  const cars = [], q = LANES.map(() => []);
  const boxKey = (X, Z) => X * 10000 + Z;
  let zebraOn = false, zebraFrom = null;
  const occ = new Map();   // 路口占用：key → { ns: n, ew: n }
  for (let k = 0; k < N; k++) {
    const T = t0 + k * dt;
    // 生成
    for (const L of LANES) {
      const lam = cfg.rate(L, T);
      if (R() < lam * dt) {
        const Q = q[L.id], last = Q[Q.length - 1];
        const r = R(), type = r < .05 ? 'bus' : r < .1 ? 'truck' : r < .22 ? 'taxi' : 'car';
        const len = type === 'bus' ? 11 : type === 'truck' ? 7.5 : 4.4;
        if (!last || last.s - last.len > len + 3) {
          const v0 = (L.main ? 13 : 11) * (.85 + R() * .3) * (type === 'bus' ? .85 : 1);
          const c = { id: cars.length, lane: L.id, s: 0, v: last ? Math.min(v0, last.v) : v0, v0, len, type, col: type === 'taxi' ? '#f2c230' : type === 'bus' ? ['#d8412f', '#2f8a5a', '#2b6cb0'][Math.floor(R() * 3)] : CARCOL[Math.floor(R() * CARCOL.length)], born: k, hist: [], si: 0 };
          cars.push(c); Q.push(c);
        }
      }
    }
    if (cfg.hero && !cfg.hero.car && T >= cfg.hero.spawn) {
      const L = LANES[cfg.hero.lane], Q = q[L.id], s0 = cfg.hero.s0 ?? 0;
      // 插入到车道队列里 s0 附近的空档（队列按 s 从大到小）
      let idx = Q.findIndex(c => c.s < s0); if (idx < 0) idx = Q.length;
      const ahead = Q[idx - 1], behind = Q[idx];
      let s = s0; if (ahead) s = Math.min(s, ahead.s - ahead.len - 3); if (behind) { const gap = s - 4.4 - behind.s; if (gap < 2) Q.splice(idx, 1); }
      const c = { id: cars.length, lane: L.id, s, v: ahead ? Math.min(9, ahead.v) : 9, v0: 11.5, len: 4.4, type: 'car', col: HERO_COL, hero: true, born: k, hist: [], si: 0 };
      if (behind && Q[idx] !== behind) { behind.dead = k; }
      while (c.si < L.stops.length && c.s > L.stops[c.si].s + .6) c.si++;
      cars.push(c); Q.splice(idx, 0, c); cfg.hero.car = c;
    }
    // 斑马线触发（红车接近时开始让行，直到 until）
    if (cfg.zebra && !zebraOn && cfg.hero?.car) {
      const h = cfg.hero.car, st = LANES[h.lane].stops.find(s => s.kind === 'zebra');
      const Q = q[h.lane], i = Q.indexOf(h), lead = i === 0 || Q[i - 1].s - Q[i - 1].len > st.s + 1;
      if (st && st.s - h.s < cfg.zebra.dist && st.s - h.s > 0 && lead) { zebraOn = true; zebraFrom = T; }
    }
    const zebraActive = zebraOn && T < cfg.zebra.until;
    // 路口占用
    occ.clear();
    for (const L of LANES) for (const c of q[L.id]) {
      for (const st of L.stops) if (st.kind === 'light' && c.s > st.box[0] - .5 && c.s - c.len < st.box[1]) {
        const key = boxKey(st.X, st.Z); let o = occ.get(key); if (!o) occ.set(key, o = { ns: 0, ew: 0 });
        if (L.axis === 'z') o.ns++; else o.ew++;
      }
    }
    // 跟驰
    for (const L of LANES) {
      const Q = q[L.id], ns = L.axis === 'z';
      for (let i = 0; i < Q.length; i++) {
        const c = Q[i];
        let gap = 1e9, vl = 0;
        if (i > 0) { const l = Q[i - 1]; gap = l.s - l.len - c.s; vl = l.v; }
        while (c.si < L.stops.length && c.s > L.stops[c.si].s + .6) c.si++;
        for (let j = c.si; j < Math.min(L.stops.length, c.si + 2); j++) {
          const st = L.stops[j], d = st.s - c.s;
          if (d > 60 || d < -.5) continue;
          let stop = false;
          if (st.kind === 'zebra') { stop = zebraActive; if (stop) { const dd = d + 1.7; if (dd < gap) { gap = Math.max(dd, .01); vl = 0; } break; } continue; }
          else {
            const ls = lightState(st.X, st.Z, ns, T);
            if (ls === 2) stop = true;
            else if (ls === 1) stop = d > c.v * c.v / (2 * 3.5) + .5;
            else if (!(L.main && ns)) { const o = occ.get(boxKey(st.X, st.Z)); if (o && (ns ? o.ew : o.ns) > 0 && d > .3) stop = true; }
            if (cfg.noLights) stop = false;
          }
          if (stop && d < gap) { gap = Math.max(d, .01); vl = 0; }
          if (stop) break;
        }
        const a = 1.6, b = 2.6, s0 = 2.2, Th = 1.1, v = c.v;
        const sStar = s0 + Math.max(0, v * Th + v * (v - vl) / (2 * Math.sqrt(a * b)));
        let acc = a * (1 - Math.pow(v / c.v0, 4) - Math.pow(sStar / Math.max(gap, .05), 2));
        acc = Math.max(acc, -9);
        c.v = Math.max(0, v + acc * dt);
        c.s += Math.min(c.v * dt, Math.max(0, gap - .3));
      }
      // 记录 + 驶出
      for (const c of Q) c.hist.push(c.s);
      while (Q.length && Q[0].s > L.len) { const c = Q.shift(); c.dead = k; }
    }
  }
  for (const c of cars) if (c.dead === undefined) c.dead = N - 1;
  return { t0, dt, N, cars, zebraFrom, hero: cfg.hero?.car };
}

// 在某个模拟时刻取样：返回 [{car, s, v}]
export function sampleSim(S, simT, out = []) {
  out.length = 0;
  const f = (simT - S.t0) / S.dt, k = Math.floor(f), u = f - k;
  for (const c of S.cars) {
    if (k < c.born || k >= c.born + c.hist.length - 1) continue;
    const i = k - c.born, s = lerp(c.hist[i], c.hist[i + 1], u);
    out.push({ c, s, v: (c.hist[i + 1] - c.hist[i]) / S.dt });
  }
  return out;
}
// 某辆车在某时刻的位置（光轨用）
export function carS(S, c, simT) {
  const f = (simT - S.t0) / S.dt, k = Math.floor(f), u = f - k, i = k - c.born;
  if (i < 0) return null; if (i >= c.hist.length - 1) return null;
  return lerp(c.hist[i], c.hist[i + 1], u);
}

// —— 车辆渲染（实例化）——
let NIGHT = 0;
export function makeFleet(scene, MAX = 3400) {
  const std = (c, r = .35, cc = .6) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r, clearcoat: cc, clearcoatRoughness: .15 });
  const body = new THREE.InstancedMesh(new RoundedBoxGeometry(4.3, .95, 1.8, 2, .28).translate(0, .72, 0), std('#ffffff'), MAX);
  const cab = new THREE.InstancedMesh(new RoundedBoxGeometry(2.3, .72, 1.62, 2, .22).translate(-.25, 1.42, 0), new THREE.MeshPhysicalMaterial({ color: '#1c232c', roughness: .15, clearcoat: 1 }), MAX);
  const roof = new THREE.InstancedMesh(new RoundedBoxGeometry(1.9, .1, 1.4, 1, .04).translate(-.3, 1.8, 0), std('#ffffff'), MAX);
  // 公交：侧窗贴图
  const busTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#1c232c'; for (let i = 0; i < 8; i++) x.fillRect(8 + i * 31, 10, 26, 26); x.fillStyle = '#ddd'; x.fillRect(0, 50, 256, 14); return new THREE.CanvasTexture(c); })();
  busTex.colorSpace = THREE.SRGBColorSpace;
  const busSide = std('#ffffff'); busSide.map = busTex;
  const busTop = std('#ffffff');
  const bus = new THREE.InstancedMesh(new THREE.BoxGeometry(11, 2.6, 2.5).translate(0, 1.6, 0), [busTop, busTop, busTop, busTop, busSide, busSide], 160);
  const van = new THREE.InstancedMesh(new THREE.BoxGeometry(5.2, 2.7, 2.3).translate(-1, 1.7, 0), std('#f2f2ee', .6, .1), 160);
  const vcab = new THREE.InstancedMesh(new RoundedBoxGeometry(2, 1.9, 2.2, 2, .25).translate(2.6, 1.25, 0), std('#ffffff'), 160);
  // 车灯（夜间可见的小发光块）
  const lampF = new THREE.InstancedMesh(new THREE.BoxGeometry(.34, .1, 1.5).translate(2.02, 1.12, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }), MAX);   // 前灯：做在车头上沿，俯视也看得到
  const lampR = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .18, 1.5).translate(-2.16, .85, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }), MAX);
  // 车轮 + 车底接触阴影（微缩模型的"落地感"）
  const wheelGeo = new THREE.CylinderGeometry(.34, .34, .24, 12).rotateX(Math.PI / 2);
  const wheel = new THREE.InstancedMesh(wheelGeo, new THREE.MeshStandardMaterial({ color: '#1c1c1e', roughness: .8 }), MAX * 4);
  const blobTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(.55, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const blob = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, color: '#ffffff' }), MAX + 400);
  blob.renderOrder = 2;
  const all = [body, cab, roof, bus, van, vcab, lampF, lampR, wheel, blob];
  for (const o of all) { o.count = 0; o.castShadow = o !== lampF && o !== lampR && o !== blob; o.receiveShadow = o !== blob; o.frustumCulled = false; scene.add(o); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), col = new THREE.Color(), white = new THREE.Color('#f4f4f0');
  let nC, nB, nV, nW, nS; const m5 = new THREE.Matrix4(), off = new THREE.Vector3(), sc2 = new THREE.Vector3(), cBrake = new THREE.Color(3.2, .18, .1), cTail = new THREE.Color(), cHead = new THREE.Color();
  const shadowAt = (sx, sz) => { if (nS >= MAX + 400) return; sc2.set(sx, 1, sz); off.set(p.x, p.y + .035, p.z); m5.compose(off, q, sc2); blob.setMatrixAt(nS++, m5); };
  return {
    begin() { nC = nB = nV = nW = nS = 0; },
    // x,z 车身中心；yaw；type；color；lights 0..1
    put(x, z, yaw, type, color, y = 0, heroRoof = false, lit = true, brake = false) {
      q.setFromAxisAngle(Y, yaw); p.set(x, y, z); m4.compose(p, q, sc); col.set(color);
      if (type === 'bus') { if (nB < 160) { bus.setMatrixAt(nB, m4); bus.setColorAt(nB, col); nB++; shadowAt(12.4, 3.4); } return; }
      if (type === 'truck') { if (nV < 160) { van.setMatrixAt(nV, m4); vcab.setMatrixAt(nV, m4); vcab.setColorAt(nV, col); nV++; shadowAt(8.6, 3.2); } return; }
      if (nC >= MAX) return;
      body.setMatrixAt(nC, m4); body.setColorAt(nC, col); cab.setMatrixAt(nC, m4); roof.setMatrixAt(nC, m4); roof.setColorAt(nC, heroRoof ? white : col);
      shadowAt(5.0, 2.5);
      for (const [wx, wz] of [[1.38, .8], [1.38, -.8], [-1.38, .8], [-1.38, -.8]]) { off.set(wx, .34, wz).applyQuaternion(q).add(p); m5.compose(off, q, sc); wheel.setMatrixAt(nW++, m5); }
      lampR.setColorAt(nC, brake ? cBrake : cTail.setRGB(.35, .03, .03).lerp(cBrake, NIGHT * .6));
      lampF.setColorAt(nC, heroRoof ? cHead.setRGB(2.6, 2.5, 2.2) : cHead.setRGB(3.2, 2.9, 2.3).multiplyScalar(NIGHT));   // 红车白天也开着日行灯
      if (!lit) { m4.makeScale(0, 0, 0); } lampR.setMatrixAt(nC, m4); if (!heroRoof && NIGHT < .03) m4.makeScale(0, 0, 0); lampF.setMatrixAt(nC, m4); nC++;
    },
    setNight(n) { NIGHT = n; },
    end(night) {
      body.count = cab.count = roof.count = nC; bus.count = nB; van.count = vcab.count = nV;
      lampF.count = nC; lampR.count = nC; wheel.count = nW; blob.count = nS;
      for (const o of all) { o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true; }
    },
  };
}

// —— 光轨：每辆车前灯（暖白）+ 尾灯（红）两条带状轨迹，加法混合 ——
export function makeTrails(scene, MAXR = 1200, K = 14) {
  const nv = MAXR * K * 2;
  const pos = new Float32Array(nv * 3), colA = new Float32Array(nv * 3), idx = [];
  for (let r = 0; r < MAXR; r++) for (let k = 0; k < K - 1; k++) { const a = (r * K + k) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colA, 3)); g.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; scene.add(mesh);
  let n = 0;
  const HEAD = [1.0, .86, .62], TAIL = [1.0, .08, .04];
  return {
    begin() { n = 0; },
    // pts: [[x,z],...] 从旧到新；kind 'head'|'tail'；I 亮度；w 宽
    ribbon(pts, kind, I, w = .9, y = .75) {
      if (n >= MAXR || pts.length < 2) return;
      const C = kind === 'head' ? HEAD : TAIL, m = pts.length;
      for (let k = 0; k < K; k++) {
        const t = k / (K - 1), fi = t * (m - 1), i0 = Math.min(Math.floor(fi), m - 2), u = fi - i0;
        const x = lerp(pts[i0][0], pts[i0 + 1][0], u), z = lerp(pts[i0][1], pts[i0 + 1][1], u);
        let dx = pts[i0 + 1][0] - pts[i0][0], dz = pts[i0 + 1][1] - pts[i0][1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
        const a = (n * K + k) * 2, fade = Math.pow(t, 1.6) * I;
        pos.set([x - dz * w / 2, y, z + dx * w / 2], a * 3); pos.set([x + dz * w / 2, y, z - dx * w / 2], a * 3 + 3);
        colA.set([C[0] * fade, C[1] * fade, C[2] * fade], a * 3); colA.set([C[0] * fade, C[1] * fade, C[2] * fade], a * 3 + 3);
      }
      n++;
    },
    end() {
      g.setDrawRange(0, n * (K - 1) * 6);
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
      mesh.visible = n > 0;
    },
  };
}

// —— 行人 ——
export function makeWalkers(scene, city, MAX = 5200) {
  const geo = new THREE.CapsuleGeometry(.24, .95, 2, 6).translate(0, .72, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: .8 }), MAX);
  mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.count = 0; scene.add(mesh);
  const R = mulberry(77);
  const PC = ['#e8463c', '#2f5fb3', '#f2c230', '#f4f4f0', '#2a2d33', '#3f8f5a', '#e07bb0', '#f08a2c', '#6fb7e0', '#7a4a8c', '#c9c2b4', '#1f3b66'];
  // 人行道行人：绕街区矩形走
  const W = [];
  for (const b of city.blocks) {
    const sp = city.special.get(b);
    const per = 2 * ((b.x1 - b.x0) + (b.z1 - b.z0));
    const n = Math.round(per / (sp === 'park' ? 30 : 16));
    for (let i = 0; i < n; i++) W.push({ b, ins: .9 + R() * 2.2, p0: R() * per, v: (1.1 + R() * .5) * (R() < .5 ? 1 : -1), col: PC[Math.floor(R() * PC.length)], from: R() * 6600 - 1200, per, h: .9 + R() * .2 });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  const rectPt = (b, ins, d) => {
    const x0 = b.x0 + ins, x1 = b.x1 - ins, z0 = b.z0 + ins, z1 = b.z1 - ins, w = x1 - x0, h = z1 - z0, P = 2 * (w + h);
    d = ((d % P) + P) % P;
    if (d < w) return [x0 + d, z0]; d -= w; if (d < h) return [x1, z0 + d]; d -= h; if (d < w) return [x1 - d, z1]; d -= w; return [x0, z1 - d];
  };
  let n = 0;
  const put = (x, z, c, h = 1, y = CURB) => { if (n >= MAX) return; p.set(x, y, z); sc.set(1, h, 1); m4.compose(p, q, sc); mesh.setMatrixAt(n, m4); mesh.setColorAt(n, col.set(c)); n++; };
  return {
    W, rectPt,
    begin() { n = 0; },
    sidewalks(simT, near) {
      for (const w of W) {
        if (simT < w.from) continue;
        if (near && (Math.abs(w.b.cx - near.x) > near.r + 60 || Math.abs(w.b.cz - near.z) > near.r + 60)) continue;
        const [x, z] = rectPt(w.b, w.ins, w.p0 + w.v * simT);
        put(x, z, w.col, w.h);
      }
    },
    put,
    end() { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; },
  };
}
