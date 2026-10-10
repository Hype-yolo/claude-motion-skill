// 场景搭建小件：世界坐标 UV、像素材质、房子、木箱、木桶、火焰、窗、灯柱、远山剪影
import * as THREE from 'three';
import { PX, PPM, ramp, hex, h2, fbm, texOf, woodPlanks, plaster, shingles, billboard, glow, mulberry } from './px.js';
import { flick } from './fx.js';

// 按法线做平面投影 UV（米 / tile）：让任何几何体上的像素密度一致
export function worldUV(geo, tile, o = {}) {
  geo = geo.index ? geo.toNonIndexed() : geo; geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v; if (ay >= ax && ay >= az) { u = o.swap ? z : x; v = o.swap ? x : z; } else if (ax >= az) { u = z * Math.sign(n.getX(i) || 1); v = y; } else { u = x * Math.sign(n.getZ(i) || 1); v = y; }
    uv[i * 2] = (u + (o.ou ?? 0)) / tile; uv[i * 2 + 1] = (v + (o.ov ?? 0)) / tile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo;
}
export function mat(canvas, o = {}) {
  const t = texOf(canvas, { repeat: [1, 1], mip: o.mip });
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: o.rough ?? .92, metalness: 0, color: o.color ?? '#ffffff' });
  if (o.em) { m.emissiveMap = texOf(o.em, { repeat: [1, 1] }); m.emissive = new THREE.Color(o.emCol ?? '#ffffff'); m.emissiveIntensity = o.emI ?? 1; }
  m.userData.tile = canvas.width / PPM; return m;
}
// 带世界 UV 的网格
export function mesh(geo, m, o = {}) {
  const g = worldUV(geo, m.userData.tile ?? 4, o);
  const me = new THREE.Mesh(g, m); me.castShadow = o.cast ?? true; me.receiveShadow = o.recv ?? true; return me;
}
export const box = (w, h, d, m, o) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return mesh(g, m, o); };

// —— 常用材质（缓存）——
const M = {};
export function mats() {
  if (M.ok) return M;
  M.plank = mat(woodPlanks(96, 96, { pw: 6, len: 48, seed: 2 }));
  M.plankDark = mat(woodPlanks(96, 96, { pw: 5, len: 32, seed: 4, cols: ['#1a100c', '#2e1d14', '#452a1b', '#5c3a24', '#74492b'] }));
  M.beam = mat(woodPlanks(48, 48, { pw: 48, len: 96, seed: 6, nails: false, cols: ['#1a0f0b', '#2a1a12', '#3e2618', '#533420'] }));
  M.wall = mat(plaster(96, 96, { seed: 3, beams: [{ t: 'h', y: 0 }, { t: 'v', x: 0 }, { t: 'v', x: 48 }, { t: 'd', x: 3, y: 3, k: 1, h: 45 }, { t: 'd', x: 93, y: 3, k: -1, h: 45 }] }));
  M.wall2 = mat(plaster(96, 96, { seed: 8, wall: ['#5d6068', '#767a82', '#90949a', '#a9acb0'], beams: [{ t: 'h', y: 0 }, { t: 'h', y: 48 }, { t: 'v', x: 0 }, { t: 'v', x: 32 }, { t: 'v', x: 64 }] }));
  M.wall3 = mat(plaster(96, 96, { seed: 12, wall: ['#6c5646', '#8a6f58', '#a4886c', '#bda283'], beams: [{ t: 'h', y: 0 }, { t: 'v', x: 0 }, { t: 'v', x: 48 }] }));
  M.roof = mat(shingles(96, 96, { seed: 1 }));
  M.roof2 = mat(shingles(96, 96, { seed: 5, cols: ['#12161c', '#1f2a33', '#2d3b47', '#3e4f5c', '#546676'] }));
  M.roof3 = mat(shingles(96, 96, { seed: 9, cols: ['#1a140e', '#2e2418', '#4a3b25', '#645034', '#7d6746'] }));
  M.ok = true; return M;
}

// —— 窗户：像素窗格，暖光可调（emissive）——
let _win = null;
export function windowMat() {
  if (_win) return _win;
  const P = new PX(12, 16), E = new PX(12, 16), F = ramp(['#1a0f0b', '#33200f', '#4d3219']), G = ramp(['#8a3e14', '#e0822c', '#ffc05a', '#ffe6a4']);
  P.fill((x, y) => { const fr = x === 0 || x === 11 || y === 0 || y === 15 || x === 5 || x === 6 || y === 7; if (fr) return F(y === 0 || x === 0 ? .9 : .4, x, y); const v = .55 + (1 - y / 16) * .2 + (h2(x, y, 3) - .5) * .25 - (x > 6 && y > 8 ? .3 : 0); const c = G(v, x, y); E.set(x, y, c); return c; });
  // 窗台
  const t = texOf(P.done()), e = texOf(E.done());
  _win = new THREE.MeshStandardMaterial({ map: t, emissiveMap: e, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 2.2, roughness: .6 }); return _win;
}
export function windowQuad(w = .8, h = 1.05) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), windowMat()); return m; }

// —— 房子：墙体 + 山墙屋顶 + 窗 + 门 + 烟囱 ——
export function house(o) {
  const MM = mats(), g = new THREE.Group(), { w, d, h } = o, rh = o.rh ?? w * .45, wm = MM[o.wall ?? 'wall'], rm = MM[o.roof ?? 'roof'];
  const body = box(w, h, d, wm); g.add(body);
  // 山墙三角（沿 x 方向的两端）
  const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rh)]);
  for (const s of [-1, 1]) { const tg = new THREE.ShapeGeometry(tri); tg.rotateY(Math.PI / 2 * s); tg.translate(s * w / 2, h, 0); const m = mesh(tg, wm); g.add(m); }
  // 屋顶两坡（稍出檐）
  const ov = .35, sl = Math.hypot(d / 2 + ov, rh + ov * rh / (d / 2));
  for (const s of [-1, 1]) {
    const pg = new THREE.BoxGeometry(w + ov * 2, .14, sl); pg.translate(0, 0, s * sl / 2);
    const m = mesh(pg, rm); m.rotation.x = s * Math.atan2(rh, d / 2); m.position.set(0, h + rh + .06, 0); g.add(m);
  }
  // 屋脊
  const ridge = box(w + ov * 2 + .1, .16, .22, MM.beam); ridge.position.set(0, h + rh, 0); g.add(ridge);
  // 烟囱
  if (o.chimney !== false) { const c = box(.6, rh + 1.2, .6, MM.wall2); c.position.set(w * .25, h, -d * .15); g.add(c); }
  // 窗：前面（+z）与侧面
  const wins = [];
  (o.windows ?? [[-w * .25, h * .55], [w * .25, h * .55]]).forEach(([x, y]) => { const q = windowQuad(); q.position.set(x, y, d / 2 + .02); g.add(q); wins.push(q);
    const sill = box(.95, .08, .18, MM.beam, { cast: false }); sill.position.set(x, y - .6, d / 2 + .06); g.add(sill); });
  if (o.upper) o.upper.forEach(([x, y]) => { const q = windowQuad(.7, .9); q.position.set(x, y, d / 2 + .02); g.add(q); wins.push(q); });
  if (o.side) o.side.forEach(([z, y, s]) => { const q = windowQuad(.7, .95); q.rotation.y = Math.PI / 2 * s; q.position.set(s * (w / 2 + .02), y, z); g.add(q); wins.push(q); });
  // 门
  if (o.door) { const dm = box(1.0, 1.9, .12, MM.plankDark); dm.position.set(o.door, 0, d / 2 + .02); g.add(dm); }
  g.position.set(o.x, o.y ?? 0, o.z); g.rotation.y = o.ry ?? 0;
  g.userData.windows = wins; return g;
}

export function crate(s = .8) {
  const P = new PX(20, 20), R = ramp(['#2a180e', '#4a2e18', '#6e4826', '#8c6034']);
  P.fill((x, y) => { const edge = x < 2 || y < 2 || x > 17 || y > 17, diag = Math.abs(x - y) < 1.5; let v = edge || diag ? .75 : .45 + (h2(x >> 2, y, 5) - .5) * .3; if (y % 5 === 0 && !edge) v -= .2; return R(v, x, y); });
  const m = new THREE.MeshStandardMaterial({ map: texOf(P.done()), roughness: .95 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(s, s, s).translate(0, s / 2, 0), m); b.castShadow = b.receiveShadow = true; return b;
}
export function barrel(r = .35, h = .9) {
  const P = new PX(24, 24), R = ramp(['#24140c', '#43281a', '#654028', '#7f5634']);
  P.fill((x, y) => { const hoop = y === 3 || y === 4 || y === 19 || y === 20; if (hoop) return ramp(['#1a1a20', '#3a3a44', '#5a5a66'])(y % 2 ? .3 : .8, x, y); let v = .5 + (x % 4 === 0 ? -.25 : 0) + (h2(x >> 2, 0, 3) - .5) * .3; return R(v, x, y); });
  const g = new THREE.CylinderGeometry(r * .92, r * .92, h, 12, 3); const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / h, k = 1 + .09 * (1 - 4 * y * y); pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); }
  g.translate(0, h / 2, 0); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: texOf(P.done()), roughness: .9 })); m.castShadow = m.receiveShadow = true; return m;
}

// —— 像素火焰：4 帧图集，公告板，发光 ——
let _fire = null;
function fireAtlas() {
  if (_fire) return _fire;
  const FWp = 16, FHp = 22, n = 6, P = new PX(FWp * n, FHp), G = ramp(['#b3260e', '#f0561a', '#ff9a2a', '#ffd35a', '#fff6c8'], .3);
  for (let f = 0; f < n; f++) for (let y = 0; y < FHp; y++) for (let x = 0; x < FWp; x++) {
    const u = (x + .5 - FWp / 2) / (FWp / 2), v = 1 - (y + .5) / FHp;   // v: 0 底 → 1 顶
    const wob = Math.sin(v * 7 + f * 1.05) * .12 * v + (fbm(x * .3, y * .25 - f * 1.4, 7) - .5) * .5 * v;
    const wid = Math.pow(1 - v, .7) * (1 - v * .15), d = Math.abs(u - wob) / Math.max(.05, wid);
    const heat = 1 - d - v * .55 + (fbm(x * .5 + f, y * .4 - f * 2, 3) - .5) * .5;
    if (heat > .05) P.set(f * FWp + x, y, G(Math.min(.99, heat * 1.25), x, y));
  }
  const t = texOf(P.done()); t.repeat.set(1 / n, 1); _fire = { t, n }; return _fire;
}
export function fire(size = .8, o = {}) {
  const A = fireAtlas(), t = A.t.clone(); t.needsUpdate = true; t.repeat.set(1 / A.n, 1);
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: .3, depthWrite: false, color: new THREE.Color(1, 1, 1).multiplyScalar(o.i ?? 3.2), fog: false });
  const geo = new THREE.PlaneGeometry(size * .73, size); geo.translate(0, size / 2, 0);
  const me = new THREE.Mesh(geo, m); me.renderOrder = 3;
  me.userData.update = (tt, cam, k = 1) => { t.offset.x = (Math.floor(tt * 10 + (o.seed ?? 0)) % A.n) / A.n; if (cam) me.rotation.y = Math.atan2(cam.position.x - me.parent.position.x - me.position.x, cam.position.z - me.parent.position.z - me.position.z); me.scale.setScalar(Math.max(.001, k)); };
  return me;
}

// —— 远山剪影（像素山脊公告板）——
export function ridge(wM, hM, col, seed, o = {}) {
  const W = Math.round(wM * (o.ppm ?? 3)), H = Math.round(hM * (o.ppm ?? 3)), P = new PX(W, H), c = hex(col);
  for (let x = 0; x < W; x++) { const top = H * (1 - (.35 + .6 * fbm(x * (o.f ?? .012), 0, seed, 4))); for (let y = Math.floor(top); y < H; y++) P.set(x, y, y - top < 2 ? [c[0] + 14, c[1] + 16, c[2] + 20] : c); }
  const m = new THREE.MeshBasicMaterial({ map: texOf(P.done()), transparent: true, alphaTest: .5, fog: true });
  const me = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM).translate(0, hM / 2, 0), m); return me;
}
