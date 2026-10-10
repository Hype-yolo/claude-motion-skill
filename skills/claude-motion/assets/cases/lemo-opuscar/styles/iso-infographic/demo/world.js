// The diorama: one square board (S = 240 units) seen in true isometric. Story geometry lives here; drawing via engine.js only.
import { PAL, tri, mix, hex, hash, clamp, lerp, seg, ss, eo, back, TAU, C30, S30, person, ICON, hatch } from './engine.js';

export const S = 240, ZL = 0, ZW = -1.2, ZB = -7, ZBOT = -11;   // land top, water surface, sea bed, slab bottom
// ---- coasts (hand-drawn polygons, world XY) ----
export const UP_COAST = [[240, 16], [149, 16], [141, 28], [131, 48], [114, 74], [97, 99], [77, 121], [53, 143], [28, 167], [0, 190]];
export const LOW_COAST = [[40, 240], [47, 227], [55, 214], [60, 205], [132, 205], [139, 195], [151, 171], [164, 142], [182, 113], [200, 88], [220, 64], [240, 44]];
export const SEA = [...UP_COAST, [0, 240], ...LOW_COAST, [240, 16]].filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
export const UP_LAND = [[0, 0], [240, 0], ...UP_COAST];
export const LOW_LAND = [...LOW_COAST.slice().reverse(), [240, 240]].reverse();

// ---- key places ----
export const MTN = { x: 40, y: 42 };
export const TER = [0, 1, 2, 3, 4, 5].map(i => ({ i, R: 25 - 3.7 * i, z0: i * 1.7, z1: (i + 1) * 1.7 }));
export function blob(cx, cy, R, n = 40, seed = 1, amp = 1) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, r = R * (1 + amp * (.09 * Math.sin(3 * a + seed) + .05 * Math.sin(5 * a + 2 * seed) + .03 * Math.sin(7 * a + 3.1))); p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * .92]); } return p; }
export const PICKER = { x: 58.2, y: 52.6, lvl: 2 };             // our picker on terrace 2 (front-right)
export const BEDS = { x: 76, y: 60, w: 17, d: 2.6, gap: 4.2, n: 3, h: 1.3 };
export const FARM_ROAD = [[60, 64], [70, 70], [80, 75], [95, 76], [104, 66], [110, 52], [118, 40], [128, 30], [140, 18], [152, 13], [186, 13]];
export const PORT_A = { x: 194, y: 25 };                       // ship centre at dock A (heading −x)
export const PORT_B = { x: 96, y: 197.5 };                       // ship centre at dock B (heading −x)
export const ROASTERY = { x: 148, y: 212, w: 16, d: 12, h: 8 };
export const CAFE = { x: 196, y: 222, w: 14, d: 11, h: 6.5 };
export const CITY_ROAD = [[100, 212], [124, 214], [146, 228], [168, 230], [188, 234], [200, 235]];

// ---- ship route (dock A → dock B), sampled once ----
const SHIP_KEYS = [[194, 25], [192, 31], [185, 37], [172, 47], [160, 66], [152, 96], [144, 126], [132, 156], [119, 180], [106, 194], [96, 197.5]];
export const SHIP_PATH = (() => { // arc-length table
  const P = [], N = 400; let L = 0; const cat = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); };
  const K = SHIP_KEYS; for (let i = 0; i <= N; i++) { const u = i / N * (K.length - 1), s = Math.min(K.length - 2, Math.floor(u)), f = u - s; const a = K[Math.max(0, s - 1)], b = K[s], c = K[s + 1], d = K[Math.min(K.length - 1, s + 2)]; const p = [cat(a[0], b[0], c[0], d[0], f), cat(a[1], b[1], c[1], d[1], f)]; if (P.length) L += Math.hypot(p[0] - P[P.length - 1][0], p[1] - P[P.length - 1][1]); P.push([p[0], p[1], L]); }
  return P;
})();
export function shipAt(u) { // u ∈ [0,1] along the route → {x, y, rot}
  const P = SHIP_PATH, L = P[P.length - 1][2] * clamp(u); let i = 1; while (i < P.length - 1 && P[i][2] < L) i++;
  const a = P[i - 1], b = P[i], f = (L - a[2]) / (b[2] - a[2] || 1), x = lerp(a[0], b[0], f), y = lerp(a[1], b[1], f);
  const j = Math.min(P.length - 1, i + 3), h = Math.max(0, i - 4); let rot = Math.atan2(P[j][1] - P[h][1], P[j][0] - P[h][0]);
  // heading −x (π) at both docks, eased in/out
  const fix = (a, w) => { let d = Math.PI - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * w; };
  rot = fix(rot, Math.max(1 - ss(clamp((u - .02) / .1)), ss(clamp((u - .86) / .12))));
  return { x, y, rot };
}

// ---- deterministic scatter (trees etc.) ----
function inPoly(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function distSeg(x, y, pts) { let m = 1e9; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)); m = Math.min(m, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)); } return m; }
export function distToPolyEdge(x, y, poly) { return distSeg(x, y, [...poly, poly[0]]); }
export const TREES = (() => {
  const out = []; let s = 7;
  for (let i = 0; i < 2600 && out.length < 230; i++) {
    const x = hash(s++) * S, y = hash(s++) * S;
    if (!inPoly(x, y, UP_LAND)) continue;
    if (distToPolyEdge(x, y, UP_LAND) < 4) continue;
    if (Math.hypot(x - MTN.x, y - MTN.y) < 29) continue;
    if (distSeg(x, y, FARM_ROAD) < 5) continue;
    if (x > 66 && x < 100 && y > 52 && y < 80) continue;        // drying yard + farmhouse
    if (x > 142 && y < 20) continue;                             // quay
    if (out.some(t => Math.hypot(t.x - x, t.y - y) < 4.2)) continue;
    out.push({ x, y, kind: hash(s++) < .35 ? 'cone' : 'round', h: 2.2 + hash(s++) * 2.2, r: 1.5 + hash(s++) * .9 });
  }
  return out;
})();
export const CITY = (() => { // blocks on the lower land
  const out = []; let s = 91;
  for (let bx = 60; bx < 240; bx += 12) for (let by = 60; by < 240; by += 12) {
    for (const [ox, oy] of [[0, 0], [6, 0], [0, 6], [6, 6]]) {
      const x = bx + ox + .6, y = by + oy + .6, w = 4.8, d = 4.8;
      if (!inPoly(x, y, LOW_LAND) || !inPoly(x + w, y + d, LOW_LAND) || !inPoly(x + w, y, LOW_LAND) || !inPoly(x, y + d, LOW_LAND)) continue;
      if (distToPolyEdge(x + w / 2, y + d / 2, LOW_LAND) < 7) continue;
      if (distSeg(x + w / 2, y + d / 2, CITY_ROAD) < 6) continue;
      if (x > 52 && x < 142 && y < 224) continue;                     // quay B
      if (Math.hypot(x + 2.4 - (ROASTERY.x + 8), y + 2.4 - (ROASTERY.y + 6)) < 14 || Math.hypot(x + 2.4 - (CAFE.x + 7), y + 2.4 - (CAFE.y + 5)) < 14) { if (hash(s++) < .5) continue; }
      const r = (q, a, b) => q.x < b[0] + b[2] + 3 && q.x + w > b[0] - 3 && q.y < b[1] + b[3] + 3 && q.y + d > b[1] - 3;
      if (r({ x, y }, 0, [ROASTERY.x, ROASTERY.y, ROASTERY.w, ROASTERY.d]) || r({ x, y }, 0, [CAFE.x - 3, CAFE.y - 3, CAFE.w + 6, CAFE.d + 6])) continue;
      const cc = x + y, near = clamp((cc - 300) / 120);             // lower toward the front corner
      const h = (2.6 + hash(s++) * 7) * (1 - .55 * near) + (hash(s++) < .07 ? 5 : 0);
      const col = ['#E8D9BC', '#D7C3A0', '#C9A27E', '#B8B2A6', '#9FB3C4', '#D8B48A'][Math.floor(hash(s++) * 6)];
      if (hash(s++) < .24) { out.push({ x, y, park: true }); continue; }
      out.push({ x, y, w, d, h, col, roof: hash(s++) < .3 });
    }
  }
  return out;
})();

// ---------- drawing helpers ----------
const G3 = PAL.green, SOIL = PAL.soil;
const cont = ['#B3352B', '#3C7FB1', '#5E8C4A', '#D9A53A', '#E9DCC2', '#2F6F73'];
export function containerTri(i) { return tri(cont[i % cont.length], .2, .24); }

// the board slab: front faces with strata and the sea section
export function drawBoard(iso) {
  const g = iso.g;
  iso.add(-1e6, () => {
    // soft shadow on the background
    const c = [[0, 0, ZBOT], [S, 0, ZBOT], [S, S, ZBOT], [0, S, ZBOT]].map(p => iso.P(p[0] + 6, p[1] + 6, p[2] - 3));
    g.save(); g.filter = `blur(${Math.max(2, iso.cam.k * 4)}px)`; iso.poly(c, 'rgba(120,92,60,0.25)'); g.restore();
    // right front face (x = S) and left front face (y = S)
    const face = (axis) => {
      const N = 120, top = [], L = [];
      for (let i = 0; i <= N; i++) { const s = i / N * S, [x, y] = axis === 'x' ? [S, s] : [s, S]; top.push(inPoly(x - .01 * (axis === 'x'), y - .01 * (axis === 'y'), SEA) ? ZW : ZL); L.push([x, y]); }
      const Pt = (i, z) => iso.P(L[i][0], L[i][1], z);
      const band = (z0f, z1f, c) => { const pts = []; for (let i = 0; i <= N; i++) pts.push(Pt(i, z1f(i))); for (let i = N; i >= 0; i--) pts.push(Pt(i, z0f(i))); iso.poly(pts, c); };
      const shade = axis === 'x' ? 2 : 1;
      band(() => ZBOT, i => -7.5, tri('#5E4631')[shade]);
      band(() => -7.5, i => -3.8, tri('#7C5A3C')[shade]);
      band(() => -3.8, i => top[i] === ZW ? -3.8 : -1.1, tri('#9A6E47')[shade]);
      band(i => top[i] === ZW ? -3.8 : -1.1, i => top[i] === ZW ? -3.8 : 0, tri('#6E9A52')[shade]);
      // sea section: water column in three blues, deeper = darker
      const wat = (z0, z1, c) => { for (let i = 0; i < N; i++) if (top[i] === ZW && top[i + 1] === ZW) iso.poly([Pt(i, z1), Pt(i + 1, z1), Pt(i + 1, z0), Pt(i, z0)], c); };
      wat(-3.8, ZW, axis === 'x' ? '#3F7FAE' : '#4F8FBF'); wat(-5.6, -3.8, axis === 'x' ? '#346F9C' : '#3F7FAE'); wat(ZB + 1.9 - 1.9, -5.6, axis === 'x' ? '#2B5E86' : '#346F9C');
      // strata dots (pebbles)
      g.save(); for (let i = 0; i < 90; i++) { const q = hash(i * 3.1 + (axis === 'x' ? 5 : 9)), z = -8 - hash(i * 7.7) * 2.6; const [px, py] = Pt(Math.floor(q * N), z); g.beginPath(); g.ellipse(px, py, 3 * iso.cam.k / 4, 1.6 * iso.cam.k / 4, 0, 0, TAU); g.fillStyle = iso.col('#4E3A28', .5); g.fill(); } g.restore();
    };
    face('x'); face('y');
  }, 0);
}
export function drawGround(iso, t) {
  // upper land, lower land (flat tops at z = 0), sea surface at ZW with shore banks
  iso.add(-9e5, () => {
    iso.poly(UP_LAND.map(p => iso.P(p[0], p[1], ZL)), G3[0]);
    iso.poly(LOW_LAND.map(p => iso.P(p[0], p[1], ZL)), '#C9CFA0');
    iso.poly(SEA.map(p => iso.P(p[0], p[1], ZW)), PAL.blue[0]);
    // banks: coast edges whose outward normal faces the viewer
    const bank = (coast, landIsLeft) => { for (let i = 1; i < coast.length; i++) { const a = coast[i - 1], b = coast[i]; iso.face3([[a[0], a[1], ZW], [b[0], b[1], ZW], [b[0], b[1], ZL], [a[0], a[1], ZL]], tri('#D9C08E'), { out: landIsLeft ? [b[1] - a[1], -(b[0] - a[0]), 0] : [-(b[1] - a[1]), b[0] - a[0], 0] }); } };
    bank(UP_COAST, false); bank(LOW_COAST, true);
  }, 0);
  // waves: little light arcs drifting on the water
  iso.add(-8.9e5, () => {
    const g = iso.g, k = iso.cam.k; if (k < 2.5) return;
    g.save(); g.strokeStyle = iso.col('#CFE3F0', .75); g.lineWidth = Math.max(1, k * .12); g.lineCap = 'round';
    for (let i = 0; i < 420; i++) {
      const x = hash(i * 1.37) * S, y = hash(i * 2.91 + 4) * S; if (!inPoly(x, y, SEA)) continue;
      const ph = (t * .35 + hash(i * 5.3)) % 1, al = Math.sin(ph * Math.PI);
      const dx = (t * .6) % 3; const [sx, sy] = iso.P(x + dx * .3, y - dx * .3, ZW); const w = 1.4 * k;
      if (sx < -50 || sx > iso.W + 50 || sy < -50 || sy > iso.H + 50) continue;
      g.globalAlpha = al * .9; g.beginPath(); g.moveTo(sx - w, sy); g.quadraticCurveTo(sx - w * .5, sy - w * .35, sx, sy); g.quadraticCurveTo(sx + w * .5, sy - w * .35, sx + w, sy); g.stroke();
    }
    g.restore();
  }, 0);
  // roads
  road(iso, FARM_ROAD, 2.2, '#D8BE8C', '#C4A472');
  road(iso, CITY_ROAD, 3, '#B9B3A6', '#F5EEDC', true);
}
export function road(iso, pts, w, c, line, dashed) {
  iso.add(-8.8e5, () => {
    const g = iso.g, k = iso.cam.k; g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); pts.forEach((p, i) => { const s = iso.P(p[0], p[1], ZL + .02); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); });
    g.strokeStyle = iso.col(c); g.lineWidth = w * k * 1.05; g.stroke();
    if (dashed) { g.setLineDash([k * 1.2, k * 1.2]); g.strokeStyle = iso.col(line, .9); g.lineWidth = Math.max(1, k * .18); g.stroke(); }
    g.restore();
  }, 0);
}
// terraced coffee mountain (composite: terraces + shrub rows ordered so upper terraces hide the back rows)
export function drawMountain(iso, t, st = {}) {
  const { x: cx, y: cy } = MTN, lv = TER.map(T => ({ ...T, poly: blob(cx, cy, T.R, 44, 1.3 + T.i * .4, .9) }));
  const shr = (T) => { const out = []; const n = Math.max(6, Math.round(TAU * (T.R - 1.3) / 2.5)); for (let j = 0; j < n; j++) { const a = j / n * TAU + T.i * .3, r = T.R - 1.45; const k = Math.floor(a / TAU * 44) % 44; const p = T.poly[k]; const rr = Math.hypot(p[0] - cx, p[1] - cy) - 1.5; out.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * .98, a }); } return out; };
  iso.add(cx + cy, () => {
    const back = [], front = [];
    for (const T of lv) {
      iso.prismNow(T.poly, T.z0, T.z1 - T.z0, [G3[0], tri('#9A6E47')[1], tri('#9A6E47')[2]]);
      // terrace edge lip
      const list = T.i < 5 ? shr(T) : [{ x: cx - 2, y: cy - 1 }, { x: cx + 2, y: cy + 1.5 }, { x: cx - .5, y: cy + 3 }];
      for (const p of list) { (p.x + p.y < cx + cy - 1.5 ? back : front).push({ ...p, z: T.z1, lvl: T.i }); }
      back.filter(p => p.lvl === T.i).sort((a, b) => a.x + a.y - b.x - b.y).forEach(p => shrub(iso, p.x, p.y, p.z, t, st));
    }
    front.sort((a, b) => a.lvl === b.lvl ? a.x + a.y - b.x - b.y : b.lvl - a.lvl).forEach(p => shrub(iso, p.x, p.y, p.z, t, st));
    if (st.after) st.after();
  }, 1);
}
export function shrub(iso, x, y, z, t, st = {}) {
  const k = iso.cam.k; if (k > 120 || !iso.vis(x, y, z, 2)) return;
  iso.sphereNow(x, y, z + .75, .95, ['#86B266', '#5E8C4A', '#436B34'], { hi: false });
  if (k > 7) { for (let i = 0; i < 4; i++) { const a = hash(x * 3 + y * 7 + i) * TAU; iso.sphereNow(x + Math.cos(a) * .55, y + Math.sin(a) * .55, z + .55 + hash(i + x) * .5, .17, st.ripe === false ? PAL.green : PAL.red, { hi: false }); } }
}
export function tree(iso, T) {
  const { x, y, h, r } = T;
  if (!iso.vis(x, y, h, r + h)) return;
  iso.add(x + y + h * .5, () => {
    const k = iso.cam.k;
    if (T.kind === 'cone') { iso.cylNow(x, y, 0, .22, .9, tri('#7A5236'), { axis: 'z' }); }
    else { const [sx, sy] = iso.P(x, y, 0), [ex, ey] = iso.P(x, y, h * .55); const g = iso.g; g.fillStyle = iso.col('#7A5236'); g.fillRect(sx - .18 * k, ey, .36 * k, sy - ey); }
    if (T.kind === 'cone') iso.coneNow(x, y, .6, r * .8, h + 1, tri('#4F7F45'), { n: 10, rot: .3 });
    else iso.sphereNow(x, y, h * .55 + r * .65, r * .8, ['#8CB86D', '#679A50', '#4A7639'], { hi: false });
  }, 1);
}
export function drawTrees(iso) { for (const T of TREES) tree(iso, T); }

// drying beds: raised tables; fill colour goes red → dark brown with p ∈ [0,1]; rake worker at bed front
export function drawBeds(iso, t, st = {}) {
  const B = BEDS, p = st.dry ?? 0, col = hex(mix('#B3352B', '#5A2E1C', p));
  for (let i = 0; i < B.n; i++) {
    const x = B.x, y = B.y + i * B.gap;
    for (const [lx, ly] of [[0, 0], [B.w - .3, 0], [0, B.d - .3], [B.w - .3, B.d - .3], [B.w / 2, 0], [B.w / 2, B.d - .3]]) iso.box(x + lx, y + ly, 0, .3, .3, B.h, tri('#8A6844'), { bias: -.5 });
    iso.box(x - .2, y - .2, B.h, B.w + .4, B.d + .4, .35, tri('#C9A574'), {
      decal: (I) => { // cherries on the mesh
        const k = iso.cam.k; const top = [[x, y], [x + B.w, y], [x + B.w, y + B.d], [x, y + B.d]].map(q => I.L(q[0], q[1], B.h + .36)); I.poly(top, col);
        if (k > 9) { const g = I.g; g.save(); for (let j = 0; j < 90; j++) { const qx = x + hash(j * 1.3 + i * 9) * B.w, qy = y + hash(j * 2.7 + i * 5) * B.d, ph = (st.rake ?? 0) * 3 + j; const [sx, sy] = I.L(qx + Math.sin(ph) * .15 * (st.rakeAmp || 0), qy, B.h + .38); g.beginPath(); g.arc(sx, sy, .17 * k, 0, TAU); g.fillStyle = I.col(hex(mix(col, '#FFE9D0', .18))); g.fill(); } g.restore(); }
      }
    });
  }
}
export function farmhouse(iso, x, y) {
  iso.box(x, y, 0, 7, 5, 3.4, tri('#EFE2C8'), { decal: (I) => { I.face3([[x + 1.2, y + 5.02, .3], [x + 1.2, y + 5.02, 2.3], [x + 2.5, y + 5.02, 2.3], [x + 2.5, y + 5.02, .3]], tri('#6A432A'), { out: [0, 1, 0] }); I.face3([[x + 4, y + 5.02, 1.4], [x + 4, y + 5.02, 2.6], [x + 5.6, y + 5.02, 2.6], [x + 5.6, y + 5.02, 1.4]], tri('#3C7FB1'), { out: [0, 1, 0] }); } });
  iso.roof(x, y, 3.4, 7, 5, 2.2, tri('#B3352B'), { ridge: 'x', over: .35, gable: tri('#EFE2C8') });
}

// ---------- the ship (local frame: u along heading, v across, z up; origin at hull centre on the waterline) ----------
export const SHIP = { L: 64, W: 12, deck: 4.8, bays: 9, rows: 5, cl: 5.8, cw: 2.2, ch: 2.2 };
export function hullPoly() { const h = SHIP.L / 2, w = SHIP.W / 2; return [[-h, -w], [h - 7, -w], [h, 0], [h - 7, w], [-h, w]]; }
// containers on deck: filled count n (0..max), order bottom tier first, near rows last
export function deckSlots() { const out = []; for (let tier = 0; tier < 4; tier++) for (let b = 0; b < SHIP.bays; b++) for (let r = 0; r < SHIP.rows; r++) { if (b === 0 && tier > 2) continue; out.push({ b, r, tier, u: -SHIP.L / 2 + 10 + b * 5.9, v: -SHIP.W / 2 + .4 + r * 2.24, z: SHIP.deck + tier * SHIP.ch, c: Math.floor(hash(b * 17 + r * 5 + tier * 31) * 6) }); } return out; }
export const DECK = deckSlots();
export const HOLD = { u: -SHIP.L / 2 + 10 + 3 * 5.9, v: -SHIP.W / 2 + .4, z: .1 };  // our container: 4th bay, near row (ship heading −x → local −v faces the viewer), in the hold
export function hull2(pts) { pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = []; for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } for (const p of pts.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); }
export function shipToWorld(sh, u, v, z) { const c = Math.cos(sh.rot), s = Math.sin(sh.rot); return [sh.x + u * c - v * s, sh.y + u * s + v * c, ZW + z]; }

// ship: st = {x, y, rot, n: deck containers shown, drop: fn(i)→[dz, alpha] for falling ones, cut: 0..1 (near hull side peeled), hold: bool, ours: {slot...}}
export function drawShip(iso, st) {
  const { x, y, rot } = st, L = SHIP.L, Wd = SHIP.W, D = SHIP.deck;
  iso.push(x, y, ZW, rot);
  const W0 = iso.w(0, 0, 0);
  if (st.wake > 0) iso.add(-8.5e5, () => { // V-shaped wake on the water behind the stern
    const g = iso.g, k = iso.cam.k; g.save(); g.strokeStyle = iso.col('#E8F1F6', .85); g.lineCap = 'round'; g.lineWidth = Math.max(1.5, k * .35);
    for (let i = 0; i < 5; i++) { const d = 4 + i * 7 * st.wake, sp = 2 + i * 2.6 * st.wake; g.globalAlpha = (1 - i / 5) * .8; for (const sgn of [-1, 1]) { const a = iso.L(-L / 2 - d, sgn * (Wd / 2 + sp * .2), 0), b = iso.L(-L / 2 - d - 5 * st.wake, sgn * (Wd / 2 + sp), 0); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } }
    const a = iso.L(L / 2, -Wd / 2 - .5, 0), b = iso.L(L / 2 + 1, 0, 0), c = iso.L(L / 2, Wd / 2 + .5, 0); g.globalAlpha = .9; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke(); g.restore();
  }, 0);
  iso.add(W0[0] + W0[1] + 2, () => {
    const hullT = ['#51677D', '#34495E', '#26384A'];
    const hp = hullPoly(), cut = st.cut || 0;
    // which long side faces the viewer? (local +v normal → world)
    const nv = iso.wn(0, 1, 0), nearSide = nv[0] + nv[1] > 0 ? 1 : -1;
    if (cut <= 0) {
      iso.prismNow(hp, 0, D, hullT, { topColor: '#9AA3A6' });
      iso.prismNow(hp, 0, 1.0, tri('#B3352B'), { top: false });
      iso.prismNow(hp, D - .45, .45, tri('#EFE6D2'), { top: false });
    } else {
      drawHullCut(iso, hp, hullT, nearSide, cut, st);
    }
    iso.sub(() => {
      // superstructure (stern)
      const su = -L / 2 + 1;
      iso.box(su, -Wd / 2 + .5, D, 6, Wd - 1, 8.2, tri('#F3ECDD'), {
        decal: (I) => { for (let r = 0; r < 3; r++) { const z = D + 2.2 + r * 2.2; I.face3([[su + 6.02, -Wd / 2 + 1.5, z], [su + 6.02, Wd / 2 - 1.5, z], [su + 6.02, Wd / 2 - 1.5, z + .9], [su + 6.02, -Wd / 2 + 1.5, z + .9]], tri('#3E5E7E'), { out: [1, 0, 0] }); I.face3([[su + 6.02, -Wd / 2 + 1.5, z], [su + 6.02, Wd / 2 - 1.5, z], [su + 6.02, Wd / 2 - 1.5, z + .9], [su + 6.02, -Wd / 2 + 1.5, z + .9]].map(p => [p[0] - 6.04, p[1], p[2]]), tri('#3E5E7E'), { out: [-1, 0, 0] }); for (const sv of [-1, 1]) for (let w = 0; w < 3; w++) { const u0 = su + .7 + w * 1.8; I.face3([[u0, sv * (Wd / 2 - .48), z], [u0 + 1.1, sv * (Wd / 2 - .48), z], [u0 + 1.1, sv * (Wd / 2 - .48), z + .9], [u0, sv * (Wd / 2 - .48), z + .9]], tri('#3E5E7E'), { out: [0, sv, 0] }); } } }
      });
      iso.box(su - .3, -Wd / 2 - .4, D + 8.2, 6.6, Wd + .8, .5, tri('#E6DCC6'));
      iso.box(su + 1.2, -1.3, D + 8.7, 2.4, 2.6, 4.2, tri('#B3352B'), { decal: (I) => { I.face3([[su + 1.2, 1.32, D + 11], [su + 3.6, 1.32, D + 11], [su + 3.6, 1.32, D + 11.8], [su + 1.2, 1.32, D + 11.8]], tri('#F3ECDD'), { out: [0, 1, 0] }); I.face3([[su + 3.62, -1.3, D + 11], [su + 3.62, 1.3, D + 11], [su + 3.62, 1.3, D + 11.8], [su + 3.62, -1.3, D + 11.8]], tri('#F3ECDD'), { out: [1, 0, 0] }); } });
      // bow mast
      iso.box(L / 2 - 8.5, -.3, D, .6, .6, 5, tri('#E6DCC6'));
      // open hatch over the hold (before our container goes in)
      if (st.hatch !== undefined && st.hatch < 1) { const H = HOLD, f = st.hatch; const hx0 = H.u - .6, hx1 = H.u + SHIP.cl + .6, hy0 = -SHIP.W / 2 + 1, hy1 = SHIP.W / 2 - 1; iso.add(-1e4, () => { iso.poly([[hx0, hy0], [hx1, hy0], [hx1, hy1], [hx0, hy1]].map(q => iso.L(q[0], q[1], SHIP.deck + .01)), '#2A2622'); const cz = SHIP.deck + .02; iso.poly([[hx0, hy0], [lerp(hx1, hx0, 1 - f), hy0], [lerp(hx1, hx0, 1 - f), hy1], [hx0, hy1]].map(q => iso.L(q[0], q[1], cz)), '#8E989C'); }, 0); if (st.holdBox) st.holdBox(iso); }
      // deck containers
      const n = st.n ?? DECK.length;
      for (let i = 0; i < Math.min(n, DECK.length); i++) {
        const s = DECK[i]; let dz = 0, a = 1; if (st.drop) { const r = st.drop(i); if (!r) continue; [dz, a] = r; }
        const prevA = iso.alpha; iso.alpha = a;
        iso.box(s.u, s.v, s.z + dz, SHIP.cl, SHIP.cw - .08, SHIP.ch - .06, containerTri(s.c), { decal: ribs(s.u, s.v, s.z + dz), cull: false });
        iso.alpha = prevA;
      }
      if (st.extra) st.extra(iso);
    });
  }, 1);
  iso.pop();
}
// container ribs (vertical lines on the two visible long faces) — only when big enough on screen
export function ribs(u, v, z, l = SHIP.cl, w = SHIP.cw - .08, h = SHIP.ch - .06) {
  return (I) => {
    if (I.cam.k * I.scale() < 9) return; const g = I.g; g.save(); g.lineWidth = Math.max(.6, I.cam.k * .04); g.strokeStyle = I.col('#000', .16);
    const nv = I.wn(0, 1, 0), fy = nv[0] + nv[1] > 0 ? v + w : v; const nu = I.wn(1, 0, 0), fx = nu[0] + nu[1] > 0 ? u + l : u;
    g.beginPath(); for (let i = 1; i < 12; i++) { const uu = u + l * i / 12; const a = I.L(uu, fy, z + .15), b = I.L(uu, fy, z + h - .15); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    for (let i = 1; i < 5; i++) { const vv = v + w * i / 5; const a = I.L(fx, vv, z + .15), b = I.L(fx, vv, z + h - .15); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke(); g.restore();
  };
}
function drawHullCut(iso, hp, hullT, near, cut, st) {
  // far half of the hull as an open shell: far side inner wall, floor, the hold, then the near wall sliding away
  const D = SHIP.deck, L = SHIP.L, Wd = SHIP.W, vN = near * Wd / 2, vF = -near * Wd / 2;
  iso.prismNow(hp, 0, .01, hullT, { topColor: '#6F6A60' });                              // floor
  iso.face3([[-L / 2, vF, 0], [L / 2 - 7, vF, 0], [L / 2 - 7, vF, D], [-L / 2, vF, D]], hullT, { both: true, color: '#5E6F80' }); // far wall inner
  if (st.holdDraw) iso.sub(() => st.holdDraw(iso));
  // near wall slides out along its normal and fades
  const off = near * 7 * eo(cut), a = 1 - ss(seg(cut, .15, .8));
  if (a > 0) { const pa = iso.alpha; iso.alpha = a; iso.push(0, off, 0, 0); iso.prismNow(hp, 0, D, hullT, { topColor: '#9AA3A6' }); iso.prismNow(hp, 0, 1, tri('#B3352B'), { top: false }); iso.pop(); iso.alpha = pa; }
  // deck slab (hatch covers) stays; cut rims hatched
  const deckPoly = hp.map(p => [p[0], p[1]]);
  const pa = iso.alpha; iso.prismNow(deckPoly, D - .5, .5, tri('#9AA3A6'), {}); iso.alpha = pa;
  const hp2 = ss(seg(cut, .5, 1)); if (hp2 > 0) { const g = iso.g; g.save(); g.globalAlpha = hp2;
    hatch(g, [[-L / 2, vN, D - .5], [L / 2 - 7, vN, D - .5], [L / 2 - 7, vN, D], [-L / 2, vN, D]].map(q => iso.L(...q)), { sp: 6 });
    hatch(g, [[-L / 2, vN, -.02], [L / 2 - 7, vN, -.02], [L / 2 - 7, vN, .1], [-L / 2, vN, .1]].map(q => iso.L(...q)), { sp: 6 });
    hatch(g, [[-L / 2, vN, 0], [-L / 2 + .5, vN, 0], [-L / 2 + .5, vN, D], [-L / 2, vN, D]].map(q => iso.L(...q)), { sp: 6 });
    g.restore(); }
}

// gantry crane on the quay: at world (x, y), boom along +y. hook = {dz, box: containerTri|null}
export function crane(iso, x, y, st = {}) {
  if (st.flip) return craneFlip(iso, x, y, st);
  const Cc = tri('#D9A53A', .22, .25), H = 19, reach = st.reach || 31, back = 6;
  const leg = (lx, ly) => iso.box(x + lx, y + ly, 0, .7, .7, H, Cc);
  leg(-3, -4); leg(3, -4); leg(-3, 3); leg(3, 3);
  iso.box(x - 3, y - 4, H - 1.2, .7, 7.7, 1.2, Cc); iso.box(x + 3, y - 4, H - 1.2, .7, 7.7, 1.2, Cc);
  iso.box(x - 3, y - 4 - back, H, 6.7, reach + back, 1.4, Cc, { bias: 40 });             // boom
  iso.box(x - 1.6, y - 4 - back - 1, H + 1.4, 3.9, 3, 3, tri('#EFE6D2'), { bias: 40 });                 // machinery house
  const ty = y + (st.trolley ?? 16);
  iso.box(x - 1.4, ty - 1.2, H - 1, 3.5, 2.4, 1, tri('#3A3A3A'), { bias: 42 });
  const hz = st.hookZ ?? 8;
  iso.line3([[x - .6, ty, H - 1], [x - .6, ty, hz + 1.2]], '#3A3230', 1.4, { bias: 41 });
  iso.line3([[x + 1.2, ty, H - 1], [x + 1.2, ty, hz + 1.2]], '#3A3230', 1.4, { bias: 41 });
  if (st.box) {
    const bx = x - SHIP.cl / 2, by = ty - SHIP.cw / 2, bz = hz - SHIP.ch + 1.2;
    iso.add(bx + by + bz + 44, () => { const g = iso.g; g.save(); if (st.clip) { g.beginPath(); st.clip.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip(); } iso.boxNow(bx, by, bz, SHIP.cl, SHIP.cw, SHIP.ch, st.box, { decal: ribs(bx, by, bz) }); g.restore(); }, 1);
  }
  iso.box(x - 2.4, ty - 1.3, hz + 1.1, 5.2, 2.6, .35, tri('#D9A53A'), { bias: 41.6 });   // spreader
}
function craneFlip(iso, x, y, st) { // quay B: boom reaching back over the water (−y)
  const Cc = tri('#D9A53A', .22, .25), H = 19, reach = st.reach || 24;
  if (st.alpha !== undefined && st.alpha <= 0) return; const pa = iso.alpha; if (st.alpha !== undefined) iso.alpha = st.alpha;
  for (const [lx, ly] of [[-3, -3], [3, -3], [-3, 4], [3, 4]]) iso.box(x + lx, y + ly, 0, .7, .7, H, Cc);
  iso.box(x - 3, y + 4 - reach, H, 6.7, reach + 6, 1.4, Cc, { bias: -10 });
  iso.box(x - 1.6, y + 7, H + 1.4, 3.9, 3, 3, tri('#EFE6D2'));
  const ty = y + (st.trolley ?? -12); iso.box(x - 1.4, ty - 1.2, H - 1, 3.5, 2.4, 1, tri('#3A3A3A'));
  const hz = st.hookZ ?? 12; iso.line3([[x, ty, H - 1], [x, ty, hz]], '#3A3230', 1.4); iso.box(x - 2.4, ty - 1.3, hz - .35, 5.2, 2.6, .35, tri('#D9A53A'));
  iso.alpha = pa;
}
export function quayB(iso, t) {
  iso.flat([[58, 205], [134, 205], [134, 216], [58, 216]], .03, '#CFCABF', { layer: 0 });
  for (let x = 62; x < 132; x += 6) iso.cyl(x, 205.6, 0, .25, .5, tri('#3A3A3A'), { n: 8 });
  let s = 11; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 1 + ((i + j) % 2); k++) iso.box(62 + i * 6.3, 210 + j * 2.4, k * 2.2, 5.8, 2.2, 2.14, containerTri(Math.floor(hash(s++) * 6)));
}
export function quayStuff(iso, t) {
  // quay A: warehouse + container yard behind the ship
  iso.box(215, 1.5, 0, 16, 7, 5, tri('#DCCFB6'), { decal: (I) => { for (let i = 0; i < 4; i++) I.face3([[217 + i * 3.4, 8.52, .01], [219 + i * 3.4, 8.52, .01], [219 + i * 3.4, 8.52, 3.2], [217 + i * 3.4, 8.52, 3.2]], tri('#8C8577'), { out: [0, 1, 0] }); } });
  iso.roof(215, 1.5, 5, 16, 7, 1.4, tri('#3C7FB1'), { ridge: 'x' });
  let s = 3; for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 1 + ((i + j) % 3); k++) { const c = Math.floor(hash(s++) * 6); iso.box(150 + i * 6.3, 1.6 + j * 2.4, k * 2.2, 5.8, 2.2, 2.14, containerTri(c)); }
  // bollards along the quay edge
  for (let x = 152; x < 238; x += 6) iso.cyl(x, 15.2, 0, .25, .5, tri('#3A3A3A'), { n: 8 });
  iso.flat([[149, 0], [240, 0], [240, 16], [149, 16]], .02, '#CFCABF', { layer: 0 });
}
export function drawCity(iso, t) {
  for (const b of CITY) {
    if (b.park) { iso.flat([[b.x, b.y], [b.x + 4.8, b.y], [b.x + 4.8, b.y + 4.8], [b.x, b.y + 4.8]], .02, '#8DB36F', { layer: 0 }); tree(iso, { x: b.x + 1.6, y: b.y + 1.8, h: 2.2, r: 1.2, kind: 'round' }); tree(iso, { x: b.x + 3.4, y: b.y + 3.4, h: 2.8, r: 1.3, kind: 'round' }); continue; }
    const T = tri(b.col, .22, .2);
    iso.box(b.x, b.y, 0, b.w, b.d, b.h, T, { decal: winDecal(b) });
    if (b.roof) iso.box(b.x + 1.2, b.y + 1.2, b.h, 1.6, 1.6, 1, tri('#8C8577'));
  }
}
function winDecal(b) {
  return (I) => {
    const k = I.cam.k; if (k < 7) return; const c = I.col('#3E5E7E', .55);
    for (let z = 1.2; z < b.h - .8; z += 1.6) for (let i = 0; i < 3; i++) {
      const u = b.x + .6 + i * 1.45; const p = [[u, b.y + b.d + .01, z], [u + .8, b.y + b.d + .01, z], [u + .8, b.y + b.d + .01, z + .8], [u, b.y + b.d + .01, z + .8]].map(q => I.L(...q)); I.poly(p, c);
      const v = b.y + .6 + i * 1.45; const q2 = [[b.x + b.w + .01, v, z], [b.x + b.w + .01, v + .8, z], [b.x + b.w + .01, v + .8, z + .8], [b.x + b.w + .01, v, z + .8]].map(q => I.L(...q)); I.poly(q2, I.col('#2E4A64', .55));
    }
  };
}
// people on the map (billboards). list of {x,y,z, o}
export function people(iso, list) { for (const p of list) iso.bill(p.x, p.y, p.z || 0, (g) => { g.globalAlpha *= p.alpha ?? 1; person(g, p.o); }, { r: 3, bias: p.bias || .5 }); }

// ---------- vehicles ----------
export function drawTruck(iso, x, y, rot, st = {}) {
  iso.push(x, y, 0, rot);
  const W0 = iso.w(0, 0, 0);
  iso.add(W0[0] + W0[1] + 1.2, () => iso.sub(() => {
    const cab = tri(st.cab || '#B3352B', .2, .24), bed = tri('#8A6844');
    for (const [u, v] of [[-2.2, -1.25], [1.6, -1.25], [-2.2, 1.05], [1.6, 1.05]]) iso.cyl(u, v, .55, .55, .2, tri('#2E2A28'), { axis: 'y', n: 12 });
    iso.box(-3, -1.1, .5, 3.6, 2.2, .5, bed);                                    // bed floor
    iso.box(-3, -1.1, 1.0, 3.6, .15, .7, bed); iso.box(-3, .95, 1.0, 3.6, .15, .7, bed); iso.box(-3, -1.1, 1.0, .15, 2.2, .7, bed);
    iso.box(.8, -1.1, .5, 1.6, 2.2, 2.0, cab, { decal: (I) => { I.face3([[2.42, -.8, 1.5], [2.42, .8, 1.5], [2.42, .8, 2.3], [2.42, -.8, 2.3]], tri('#9CC3DD'), { out: [1, 0, 0] }); I.face3([[1.0, -1.12, 1.5], [2.2, -1.12, 1.5], [2.2, -1.12, 2.3], [1.0, -1.12, 2.3]], tri('#9CC3DD'), { out: [0, -1, 0] }); I.face3([[1.0, 1.12, 1.5], [2.2, 1.12, 1.5], [2.2, 1.12, 2.3], [1.0, 1.12, 2.3]], tri('#9CC3DD'), { out: [0, 1, 0] }); } });
    for (let i = 0; i < (st.sacks || 0); i++) iso.box(-2.7 + i * 1.1, -.5, 1.0, 1.0, 1.1, .7, tri('#C9A874', .2, .22));
    if (st.box) iso.box(-3.1, -1.1, 1.0, 5.8 * .62, 2.2, 1.6, st.box);
  }), 1);
  iso.pop();
}
export function drawBike(iso, x, y, rot, st = {}) {
  iso.push(x, y, 0, rot);
  iso.bill(0, 0, 0, (g) => {
    g.strokeStyle = '#2E2522'; g.lineWidth = .09; for (const u of [-.55, .55]) { g.beginPath(); g.ellipse(u, -.35, .34, .34, 0, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(-.55, -.35); g.lineTo(-.1, -.8); g.lineTo(.4, -.8); g.lineTo(.55, -.35); g.moveTo(-.1, -.8); g.lineTo(0, -.35); g.stroke();
    g.fillStyle = '#C9A874'; g.fillRect(-.95, -1.05, .5, .42);
    person(g, { body: '#3C7FB1', hat: 'cap', skin: '#C98B62', arm: 2.2, h: 2.2, bob: 0 });
  }, { r: 3 });
  iso.pop();
}

// ---------- cutaway building: closed exterior, or open = front walls slide out & fade, roof lifts ----------
// B = {x, y, w, d, h}; st = {open, wall: tri, roof: fn(iso, dz, alpha) , floor, interior: fn(iso), decal: fn}
export function cutBuilding(iso, B, st) {
  const { x, y, w, d, h } = B, o = st.open || 0, th = .45;
  iso.add(x + w / 2 + y + d / 2 + h / 2, () => {
    if (o <= 0) { iso.boxNow(x, y, 0, w, d, h, st.wall, { decal: st.decal }); if (st.roof) st.roof(iso, 0, 1); return; }
    iso.poly([[x, y], [x + w, y], [x + w, y + d], [x, y + d]].map(q => iso.P(q[0], q[1], .02)), st.floor || '#D8CCB6');
    if (st.floorDecal) st.floorDecal(iso);
    iso.boxNow(x, y, 0, th, d, h, st.inner || st.wall); iso.boxNow(x, y, 0, w, th, h, st.inner || st.wall);
    // hatched section on the cut wall tops
    const op = ss(seg(o, .6, 1)); if (op > 0) { const g = iso.g; g.save(); g.globalAlpha = op; hatchTop(iso, x, y, th, d, h); hatchTop(iso, x, y, w, th, h); g.restore(); }
    if (st.backDecal) st.backDecal(iso);
    iso.sub(() => st.interior && st.interior(iso));
    const a = 1 - ss(seg(o, .1, .75)), off = eo(o) * 7;
    if (a > 0) {
      const pa = iso.alpha; iso.alpha = a;
      iso.boxNow(x + w - th + off * .7, y, 0, th, d, h, st.wall); iso.boxNow(x, y + d - th + off, 0, w, th, h, st.wall);
      if (st.roof) st.roof(iso, off * 1.3, a);
      iso.alpha = pa;
    }
  }, 1);
}
function hatchTop(iso, x, y, w, d, h) {
  const pts = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]].map(q => iso.P(q[0], q[1], h + .01));
  const g = iso.g; g.save(); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = iso.col('#FBF4E6'); g.fill(); g.clip();
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); g.strokeStyle = iso.col('#2E2522', .55); g.lineWidth = 1.2; g.beginPath();
  for (let s = Math.min(...xs) - 300; s < Math.max(...xs); s += 6) { g.moveTo(s, Math.max(...ys)); g.lineTo(s + (Math.max(...ys) - Math.min(...ys)), Math.min(...ys)); } g.stroke(); g.restore();
}

// ---------- hold, container interior, sacks (ship-local coordinates; called inside the ship transform) ----------
export const HOLDZ = [.1, 2.25];
export function holdContainers(iso, st) {
  for (let tier = 0; tier < 2; tier++) for (let b = 0; b < SHIP.bays; b++) for (let r = 0; r < SHIP.rows; r++) {
    const u = -SHIP.L / 2 + 10 + b * 5.9, v = -SHIP.W / 2 + .4 + r * 2.24, z = HOLDZ[tier];
    const ours = b === 3 && r === 0 && tier === 0;
    if (ours) { containerOpen(iso, u, v, z, st.boxOpen || 0, st); continue; }
    iso.box(u, v, z, SHIP.cl, SHIP.cw - .08, 2.1, containerTri(Math.floor(hash(b * 7 + r * 13 + tier * 29 + 3) * 6)), { decal: ribs(u, v, z, SHIP.cl, SHIP.cw - .08, 2.1) });
  }
}
export const SACK = { a: 2.4, c: 1.03 };                          // our sack's face centre in container-local (a along u, c up)
function containerOpen(iso, u, v, z, o, st) {
  const L = SHIP.cl, Wd = SHIP.cw - .08, H = 2.1, T = tri('#B3352B', .2, .24);
  const W0 = iso.w(u + L / 2, v + Wd / 2, z + H / 2);
  iso.add(W0[0] + W0[1] + W0[2], () => {
    if (o <= 0) { iso.boxNow(u, v, z, L, Wd, H, T, { decal: ribs(u, v, z, L, Wd, H) }); return; }
    // inner back wall (+v side), floor, end walls, then sacks, then the near side sliding away
    iso.face3([[u, v + Wd, z], [u + L, v + Wd, z], [u + L, v + Wd, z + H], [u, v + Wd, z + H]], T, { both: true, color: '#7E2A22' });
    iso.face3([[u, v, z], [u + L, v, z], [u + L, v + Wd, z], [u, v + Wd, z]], T, { both: true, color: '#6B5A48' });
    iso.face3([[u, v, z], [u, v + Wd, z], [u, v + Wd, z + H], [u, v, z + H]], T, { both: true, color: '#8C2E25' });
    iso.sub(() => {
      for (let tier = 0; tier < 3; tier++) for (let a = 0; a < 6; a++) for (let b = 0; b < 2; b++) {
        const su = u + .05 + a * .95, sv = v + .05 + b * 1.02, sz = z + .02 + tier * .68, isOurs = a === 2 && b === 0 && tier === 1;
        iso.box(su, sv, sz, .9, 1.0, .66, tri(isOurs ? '#CDA86F' : '#C4A26E', .2, .24), { cull: false, decal: sackDecal(su, sv, sz, isOurs ? st : null) });
      }
    });
    iso.face3([[u + L, v, z], [u + L, v + Wd, z], [u + L, v + Wd, z + H], [u + L, v, z + H]], T, { both: true, color: '#9E3127' });
    iso.face3([[u, v, z + H], [u + L, v, z + H], [u + L, v + Wd, z + H], [u, v + Wd, z + H]], T, { both: true, color: T[0] });
    const a = 1 - ss(seg(o, .1, .8)); if (a > 0) { const pa = iso.alpha; iso.alpha = a; iso.push(0, -eo(o) * 2.5, 0, 0); iso.face3([[u, v, z], [u + L, v, z], [u + L, v, z + H], [u, v, z + H]], T, { both: true }); iso.pop(); iso.alpha = pa; }
  }, 1);
}
function sackDecal(su, sv, sz, st) {
  return (I) => {
    const k = I.cam.k * I.scale(); if (k < 25) return;
    const g = I.g; const p = (a, c) => I.L(su + a, sv - .005, sz + c);
    g.save(); g.strokeStyle = I.col('#8A6A40', .8); g.lineWidth = Math.max(1, k * .012);
    g.beginPath(); const a0 = p(.02, .5), a1 = p(.88, .5); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.stroke();
    const b0 = p(.02, .56), b1 = p(.88, .56); g.strokeStyle = I.col('#B3352B', .7); g.lineWidth = Math.max(1, k * .02); g.beginPath(); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.stroke();
    g.restore();
    if (st && st.tear > 0 && st.tearDraw) st.tearDraw(I, su, sv, sz);
  };
}
