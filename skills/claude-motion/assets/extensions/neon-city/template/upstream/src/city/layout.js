// CPU-side city: street grid, districts, lots, building tiers, signs, street furniture, collision and height queries.
// Units are metres. +x east, +z south (towards the harbour), y up. Traffic keeps left, as in Hong Kong.
import DISTRICT from './district.json';
import { mulberry32, vnoise, hash2, pick, range, shuffle } from '../core/rng.js';
import ATLAS from './signs-atlas.json';
import { corporate, estate, tenement, megabuilding, outer as outerMassing, rngFor } from './massing.js';

export const CITY = {
  half: 1600,
  outer: 3600,
  harbourZ: 1180,
  farShoreZ: 2350,
  cloudBase: 520,
  cloudTop: 660,
  floorH: 3.1,
  curb: 0.18,
  zenith: { x: 0, z: 0, top: 1560, pad: 1418 },
};

export const STYLE = { TENEMENT: 0, GLASS: 1, ESTATE: 2, OFFICE: 3, WAREHOUSE: 4 };

export const SEEDS = [
  { type: 'market', x: -880, z: -260, zh: '廟街夜市', en: 'TEMPLE NIGHT MARKET' },
  { type: 'market', x: -460, z: 420, zh: '油麻地', en: 'YAU MA TEI' },
  { type: 'market', x: -1250, z: 380, zh: '深水埗', en: 'SHAM SHUI PO' },
  { type: 'center', x: 40, z: 40, zh: '天頂中區', en: 'ZENITH CENTRAL' },
  { type: 'center', x: 420, z: -380, zh: '金鐘', en: 'ADMIRALTY RIDGE' },
  { type: 'center', x: -260, z: -470, zh: '銅鑼灣', en: 'CAUSEWAY' },
  { type: 'center', x: 360, z: 420, zh: '海港城', en: 'HARBOUR CITY' },
  { type: 'estate', x: 1080, z: -620, zh: '彩虹邨', en: 'RAINBOW ESTATE' },
  { type: 'estate', x: -320, z: -1180, zh: '石硤尾', en: 'SHEK KIP MEI' },
  { type: 'mixed', x: 920, z: 340, zh: '九龍城', en: 'KOWLOON CITY' },
  { type: 'mixed', x: -1200, z: -1000, zh: '長沙灣', en: 'CHEUNG SHA WAN' },
  { type: 'mixed', x: 520, z: -1150, zh: '黃大仙', en: 'WONG TAI SIN' },
  { type: 'docks', x: 760, z: 960, zh: '葵涌碼頭', en: 'KWAI CHUNG PIERS' },
  { type: 'market', x: -820, z: 900, zh: '佐敦', en: 'JORDAN' },
];

// the named district under (x, z), for the HUD and the map
export function districtSeedAt(x, z) {
  if (Math.abs(x) > CITY.half + 40 || z < -CITY.half - 40) return { zh: '新界', en: 'OUTER WARDS' };
  if (z > CITY.harbourZ + 10 && z < CITY.farShoreZ) return { zh: '維多利亞港', en: 'VICTORIA HARBOUR' };
  if (z >= CITY.farShoreZ) return { zh: '對岸', en: 'FAR SHORE' };
  if (Math.hypot(x, z) < 330) return SEEDS[3];
  const wx = x + (vnoise(x / 380 + 11, z / 380) - 0.5) * 380;
  const wz = z + (vnoise(x / 380, z / 380 + 7) - 0.5) * 380;
  let best = SEEDS[0], bd = Infinity;
  for (const s of SEEDS) {
    const d = (s.x - wx) ** 2 + (s.z - wz) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

export function districtAt(x, z) {
  const wx = x + (vnoise(x / 380 + 11, z / 380) - 0.5) * 380;
  const wz = z + (vnoise(x / 380, z / 380 + 7) - 0.5) * 380;
  let best = null, bd = Infinity;
  for (const s of SEEDS) {
    const d = (s.x - wx) ** 2 + (s.z - wz) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  if (Math.hypot(x, z) < 330) return 'center';
  return best.type;
}

function streetLines(rng) {
  // a wide block is reserved around the origin for the Zenith tower
  const xs = [];
  {
    let p = -96, i = 1;
    const left = [];
    while (p > -CITY.half + 70) { left.push({ p, w: i % 4 === 0 ? 26 : 14 }); p -= range(rng, 96, 140); i++; }
    left.push({ p: -CITY.half, w: 26 });
    xs.push(...left.reverse());
    p = 96; i = 1;
    while (p < CITY.half - 70) { xs.push({ p, w: i % 4 === 0 ? 26 : 14 }); p += range(rng, 96, 140); i++; }
    xs.push({ p: CITY.half, w: 26 });
  }
  xs.find((l) => l.p === -96).w = 26;
  xs.find((l) => l.p === 96).w = 26;
  const zs = [];
  {
    let p = -96, i = 1;
    const top = [];
    while (p > -CITY.half + 70) { top.push({ p, w: i % 4 === 0 ? 26 : 14 }); p -= range(rng, 92, 132); i++; }
    top.push({ p: -CITY.half, w: 26 });
    zs.push(...top.reverse());
    p = 96; i = 1;
    while (p < CITY.harbourZ - 90) { zs.push({ p, w: i % 4 === 0 ? 26 : 14 }); p += range(rng, 92, 132); i++; }
    zs.push({ p: CITY.harbourZ - 18, w: 30, harbour: true });
  }
  zs.find((l) => l.p === -96).w = 26;
  zs.find((l) => l.p === 96).w = 26;
  return { xs, zs };
}

export function generateCity(seed = 20261002) {
  const rng = mulberry32(seed);
  const { xs, zs } = streetLines(rng);
  const blocks = [];
  const alleys = [];

  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const x0 = xs[i].p + xs[i].w / 2, x1 = xs[i + 1].p - xs[i + 1].w / 2;
      const z0 = zs[j].p + zs[j].w / 2, z1 = zs[j + 1].p - zs[j + 1].w / 2;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const district = Math.abs(cx) < 100 && Math.abs(cz) < 100 ? 'zenith' : districtAt(cx, cz);
      // market blocks are cut by a service alley along their long side
      if (district === 'market' && Math.max(x1 - x0, z1 - z0) > 92 && rng() < 0.85) {
        const aw = 6.5;
        if (x1 - x0 > z1 - z0) {
          const m = (x0 + x1) / 2 + range(rng, -10, 10);
          blocks.push({ x0, x1: m - aw / 2, z0, z1, district, sides: [true, false, true, true] });
          blocks.push({ x0: m + aw / 2, x1, z0, z1, district, sides: [false, true, true, true] });
          alleys.push({ x0: m - aw / 2, x1: m + aw / 2, z0, z1, axis: 'z' });
        } else {
          const m = (z0 + z1) / 2 + range(rng, -10, 10);
          blocks.push({ x0, x1, z0, z1: m - aw / 2, district, sides: [true, true, true, false] });
          blocks.push({ x0, x1, z0: m + aw / 2, z1, district, sides: [true, true, false, true] });
          alleys.push({ x0, x1, z0: m - aw / 2, z1: m + aw / 2, axis: 'x' });
        }
      } else {
        // sides: [west, east, north, south] faces a proper street (true) or an alley (false)
        blocks.push({ x0, x1, z0, z1, district, sides: [true, true, true, true] });
      }
    }
  }

  const buildings = [];
  const signs = [];
  const awnings = [];
  const roofProps = [];
  const shopfronts = [];

  const vCells = [], hCells = [];
  ATLAS.forEach((c, i) => (c.k === 'v' ? vCells : hCells).push(i));

  function addBuilding(b) {
    b.id = buildings.length;
    buildings.push(b);
    return b;
  }

  function tenementHeight(district) {
    const r = rng();
    if (district === 'market') return r < 0.1 ? range(rng, 70, 115) : range(rng, 20, 58);
    return r < 0.15 ? range(rng, 80, 150) : range(rng, 28, 80);
  }

  // facing: 0 west(-x) 1 east(+x) 2 north(-z) 3 south(+z)

  function decorateFrontage(b, face, along0, along1, onStreet) {
    // along0..along1 is the frontage span on the facade line, in world coordinates along the facade axis
    const [nx, nz] = NORM[face];
    const facadeX = face === 0 ? b.x - b.w / 2 : face === 1 ? b.x + b.w / 2 : 0;
    const facadeZ = face === 2 ? b.z - b.d / 2 : face === 3 ? b.z + b.d / 2 : 0;
    const alongIsX = face >= 2;
    const len = along1 - along0;
    const at = (t, out, y) => (alongIsX
      ? { x: along0 + t * len, y, z: facadeZ + nz * out }
      : { x: facadeX + nx * out, y, z: along0 + t * len });
    const rotY = face === 0 ? -Math.PI / 2 : face === 1 ? Math.PI / 2 : face === 2 ? Math.PI : 0;
    const signy = b.district === 'market' ? 1 : b.district === 'mixed' ? 0.45 : b.district === 'center' ? 0.2 : 0.15;

    // ground-floor shop and its fascia sign
    if (b.style === STYLE.TENEMENT || b.style === STYLE.OFFICE) {
      shopfronts.push({ ...at(0.5, 0.02, 2.1), rotY, w: len - 0.6, h: 3.8, seed: rng(), face, open: rng() < 0.72 });
      b.shopFaces = (b.shopFaces || 0) | (1 << face);
      if (onStreet && rng() < 0.85 * Math.max(signy, 0.4)) {
        const w = Math.min(len - 1, range(rng, 4.5, 8.5));
        signs.push({ ...at(range(rng, 0.35, 0.65), 0.18, range(rng, 3.9, 4.5)), rotY, w, h: w / 4, cell: pick(rng, hCells), kind: 'fascia', flicker: rng() < 0.08 ? 2 : rng() < 0.4 ? 1 : 0 });
      }
      if (onStreet && b.district !== 'center') awnings.push({ ...at(0.5, 0.9, range(rng, 3.2, 3.5)), rotY, w: len - 0.4, depth: range(rng, 1.4, 2.1) });
    }

    if (!onStreet) return;
    // blade signs, perpendicular to the facade so they read down the street
    const maxY = Math.min(b.h - 3, 46);
    const nBlade = Math.floor(signy * range(rng, 0.6, 3.6));
    for (let k = 0; k < nBlade && maxY > 9; k++) {
      const w = range(rng, 1.6, 2.3);
      const h = w * 4.1;
      const y = range(rng, 6 + h / 2, Math.max(6 + h / 2 + 0.1, maxY - h / 2));
      const p = at(range(rng, 0.15, 0.85), 0.55 + w / 2, y);
      signs.push({ ...p, rotY: rotY + Math.PI / 2, w, h, cell: pick(rng, vCells), kind: 'blade', flicker: rng() < 0.07 ? 2 : rng() < 0.5 ? 1 : 0, face });
    }
    // big horizontal signs cantilevered far over the street
    const nOver = b.district === 'market' ? Math.floor(range(rng, 0, 2.4)) : rng() < signy * 0.5 ? 1 : 0;
    for (let k = 0; k < nOver && maxY > 8; k++) {
      const w = range(rng, 5.5, 8.8);
      const h = w / 4;
      const y = range(rng, 6.5, Math.min(maxY, 26));
      const p = at(range(rng, 0.2, 0.8), 0.5 + w / 2, y);
      signs.push({ ...p, rotY: rotY + Math.PI / 2, w, h, cell: pick(rng, hCells), kind: 'over', flicker: rng() < 0.06 ? 2 : rng() < 0.4 ? 1 : 0, face });
    }
    // tall flat signs bolted to the upper facade
    if (b.h > 40 && rng() < signy * 0.35) {
      const h = range(rng, 9, 16);
      const w = h / 4.1;
      signs.push({ ...at(range(rng, 0.2, 0.8), 0.25, range(rng, 12, Math.max(13, b.h - h))), rotY, w, h, cell: pick(rng, vCells), kind: 'wall', flicker: 0 });
    }
  }

  // the facade kits model their own air-conditioners; the draws stay so the rest of the layout keeps its seed
  function addAC() {
    if (rng() > 0.85) return;
    range(rng, 0.12, 0.42);
  }

  function roofDressing(b) {
    const top = b.h;
    const n = b.style === STYLE.GLASS ? 0 : Math.floor(range(rng, 0, 3.5));
    for (let k = 0; k < n; k++) {
      const type = b.style === STYLE.WAREHOUSE ? 'chiller' : pick(rng, ['tank', 'tank', 'shack', 'chiller', 'mast']);
      const x = b.x + range(rng, -0.35, 0.35) * b.w;
      const z = b.z + range(rng, -0.35, 0.35) * b.d;
      roofProps.push({ type, x, y: top, z, s: range(rng, 0.8, 1.3), rotY: Math.floor(rng() * 4) * Math.PI / 2, b });
    }
    if ((b.district === 'market' || b.district === 'mixed') && b.style === STYLE.TENEMENT && b.h < 70 && rng() < 0.16 && b.streetFace != null) {
      const face = b.streetFace;
      const w = Math.min(range(rng, 11, 18), (face >= 2 ? b.w : b.d) * 1.3);
      const rotY = face === 0 ? -Math.PI / 2 : face === 1 ? Math.PI / 2 : face === 2 ? Math.PI : 0;
      const [nx, nz] = NORM[face];
      const off = (face >= 2 ? b.d : b.w) / 2 - 2;
      signs.push({ x: b.x + nx * off, y: top + 2.2 + w / 8, z: b.z + nz * off, rotY, w, h: w / 4, cell: pick(rng, hCells), kind: 'roof', flicker: rng() < 0.1 ? 2 : 0 });
    }
  }

  for (const blk of blocks) {
    const sw = blk.district === 'market' ? 3.2 : 4.6;
    const ix0 = blk.x0 + (blk.sides[0] ? sw : 0.6), ix1 = blk.x1 - (blk.sides[1] ? sw : 0.6);
    const iz0 = blk.z0 + (blk.sides[2] ? sw : 0.6), iz1 = blk.z1 - (blk.sides[3] ? sw : 0.6);
    blk.sw = sw;
    blk.inner = { ix0, ix1, iz0, iz1 };
    const W = ix1 - ix0, D = iz1 - iz0;
    if (W < 12 || D < 12) continue;
    const d = blk.district;

    if (d === 'zenith') {
      const b = addBuilding({ x: (ix0 + ix1) / 2, z: (iz0 + iz1) / 2, w: W, d: D, h: CITY.zenith.top, style: STYLE.GLASS, district: d, seed: 0.77, zenith: true });
      b.tiers = [
        { w: W, d: D, y0: 0, y1: 44 },
        { w: 86, d: 86, y0: 44, y1: 610 },
        { w: 70, d: 70, y0: 610, y1: 1010 },
        { w: 56, d: 56, y0: 1010, y1: 1300 },
        { w: 40, d: 40, y0: 1300, y1: CITY.zenith.pad },
        { w: 10, d: 10, y0: CITY.zenith.pad, y1: CITY.zenith.top },
      ];
      b.h = CITY.zenith.top;
      continue;
    }

    if (d === 'market' || d === 'mixed') {
      // perimeter lots with frontage on every street side, a core building inside
      const depth = Math.min(d === 'market' ? range(rng, 13, 19) : range(rng, 16, 24), Math.min(W, D) / 2);
      const style = d === 'market' ? STYLE.TENEMENT : rng() < 0.55 ? STYLE.TENEMENT : STYLE.OFFICE;
      const frontLo = d === 'market' ? 8.5 : 12, frontHi = d === 'market' ? 15 : 26;
      const rows = [
        { face: 2, a0: ix0, a1: ix1, fixed: iz0, dir: 1, axis: 'x', street: blk.sides[2] },
        { face: 3, a0: ix0, a1: ix1, fixed: iz1, dir: -1, axis: 'x', street: blk.sides[3] },
        { face: 0, a0: iz0 + depth, a1: iz1 - depth, fixed: ix0, dir: 1, axis: 'z', street: blk.sides[0] },
        { face: 1, a0: iz0 + depth, a1: iz1 - depth, fixed: ix1, dir: -1, axis: 'z', street: blk.sides[1] },
      ];
      for (const r of rows) {
        let a = r.a0;
        while (r.a1 - a > 6) {
          let f = range(rng, frontLo, frontHi);
          if (r.a1 - a - f < frontLo * 0.7) f = r.a1 - a;
          const a1 = a + f;
          const h = Math.max(9, Math.round(tenementHeight(d) / CITY.floorH) * CITY.floorH);
          const cAlong = (a + a1) / 2;
          const cFixed = r.fixed + r.dir * depth / 2;
          const bx = r.axis === 'x' ? cAlong : cFixed;
          const bz = r.axis === 'x' ? cFixed : cAlong;
          const bw = r.axis === 'x' ? f - 0.25 : depth;
          const bd = r.axis === 'x' ? depth : f - 0.25;
          const b = addBuilding({ x: bx, z: bz, w: bw, d: bd, h, style: h > 90 && style === STYLE.TENEMENT && rng() < 0.4 ? STYLE.OFFICE : style, district: d, seed: rng(), streetFace: r.street ? r.face : null });
          b.tiers = [{ w: bw, d: bd, y0: 0, y1: h }];
          b.arch = b.style === STYLE.OFFICE && Math.min(bw, bd) >= 14 ? 'corp' : 'tenement';
          b.lot = { x: bx, z: bz, w: bw, d: bd }; b.H = h; b.podium = 10.5;
          decorateFrontage(b, r.face, a + 0.2, a1 - 0.2, r.street);
          if (b.style === STYLE.TENEMENT) addAC();
          roofDressing(b);
          a = a1;
        }
      }
      const cw = W - depth * 2 - 2, cd = D - depth * 2 - 2;
      if (cw > 10 && cd > 10 && rng() < 0.75) {
        const h = rng() < 0.3 ? range(rng, 90, 190) : range(rng, 30, 70);
        const b = addBuilding({ x: (ix0 + ix1) / 2, z: (iz0 + iz1) / 2, w: cw, d: cd, h, style: h > 90 ? STYLE.ESTATE : STYLE.TENEMENT, district: d, seed: rng() });
        b.tiers = [{ w: cw, d: cd, y0: 0, y1: h }];
        b.arch = b.style === STYLE.ESTATE ? 'estate' : 'tenement';
        b.lot = { x: (ix0 + ix1) / 2, z: (iz0 + iz1) / 2, w: cw, d: cd }; b.H = h;
        roofDressing(b);
      }
      continue;
    }

    if (d === 'center') {
      const r0 = Math.hypot((ix0 + ix1) / 2, (iz0 + iz1) / 2);
      const near = Math.max(0, 1 - r0 / 1100);
      const split = W > 80 && rng() < 0.45 ? 2 : 1;
      for (let s = 0; s < split; s++) {
        const lx0 = ix0 + (W / split) * s + (s ? 3 : 0), lx1 = ix0 + (W / split) * (s + 1) - (s < split - 1 ? 3 : 0);
        const lw = lx1 - lx0, ld = D;
        const cx = (lx0 + lx1) / 2, cz = (iz0 + iz1) / 2;
        let H = range(rng, 110, 260) + near * near * range(rng, 120, 520);
        if (rng() < 0.34 * near) H = range(rng, 560, 920);
        const podium = range(rng, 16, 34);
        const sw0 = Math.min(lw, ld) * range(rng, 0.55, 0.8);
        const tw = Math.min(lw - 4, sw0 * range(rng, 0.9, 1.25)), td = Math.min(ld - 4, sw0);
        const b = addBuilding({ x: cx, z: cz, w: lw, d: ld, h: H, style: STYLE.GLASS, district: d, seed: rng() });
        b.tiers = [{ w: lw, d: ld, y0: 0, y1: podium }];
        b.arch = 'corp'; b.lot = { x: cx, z: cz, w: lw, d: ld }; b.H = H; b.podium = podium;
        let y = podium, w = tw, dd = td;
        const steps = H > 400 ? 3 : H > 200 ? 2 : 1;
        for (let k = 0; k < steps; k++) {
          const y1 = k === steps - 1 ? H : y + (H - y) * range(rng, 0.45, 0.65);
          b.tiers.push({ w, d: dd, y0: y, y1 });
          y = y1;
          w *= range(rng, 0.7, 0.86);
          dd *= range(rng, 0.7, 0.86);
        }
        if (H > 300) b.tiers.push({ w: 2.2, d: 2.2, y0: H, y1: H + range(rng, 25, 70), mast: true });
        roofDressing(b);
        // shops line the podium
        shopfronts.push({ x: cx, y: 2.1, z: cz - ld / 2 - 0.02, rotY: Math.PI, w: lw - 2, h: 3.8, seed: rng(), face: 2, open: true });
        shopfronts.push({ x: cx, y: 2.1, z: cz + ld / 2 + 0.02, rotY: 0, w: lw - 2, h: 3.8, seed: rng(), face: 3, open: true });
      }
      continue;
    }

    if (d === 'estate') {
      const n = W > 70 && D > 70 ? 4 : 2;
      for (let k = 0; k < n; k++) {
        const qx = n === 4 ? (k % 2 ? 0.25 : -0.25) : 0;
        const qz = n === 4 ? (k < 2 ? -0.25 : 0.25) : (k ? 0.25 : -0.25);
        const cx = (ix0 + ix1) / 2 + qx * W, cz = (iz0 + iz1) / 2 + qz * D;
        const slabLong = rng() < 0.5;
        const bw = slabLong ? Math.min(W / (n === 4 ? 2 : 1) - 8, range(rng, 36, 60)) : range(rng, 18, 24);
        const bd = slabLong ? range(rng, 16, 22) : Math.min(D / 2 - 8, range(rng, 36, 50));
        const h = Math.round(range(rng, 105, 195) / CITY.floorH) * CITY.floorH;
        const b = addBuilding({ x: cx, z: cz, w: bw, d: bd, h, style: STYLE.ESTATE, district: d, seed: rng() });
        b.tiers = [{ w: bw, d: bd, y0: 0, y1: h }];
        b.arch = 'estate'; b.lot = { x: cx, z: cz, w: bw, d: bd }; b.H = h; b.blk = blk;
        roofDressing(b);
      }
      continue;
    }

    if (d === 'docks') {
      const n = W > 90 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const lw = W / n - 6;
        const cx = ix0 + (W / n) * (k + 0.5);
        const b = addBuilding({ x: cx, z: (iz0 + iz1) / 2, w: lw, d: D - 6, h: range(rng, 11, 24), style: STYLE.WAREHOUSE, district: d, seed: rng() });
        b.tiers = [{ w: lw, d: D - 6, y0: 0, y1: b.h }];
        roofDressing(b);
      }
    }
  }

  // tier world bounds for rendering and collision
  for (const b of buildings) {
    for (const t of b.tiers) {
      t.x = b.x; t.z = b.z;
      t.x0 = b.x - t.w / 2; t.x1 = b.x + t.w / 2;
      t.z0 = b.z - t.d / 2; t.z1 = b.z + t.d / 2;
    }
  }

  // the outer city: simpler towers that fill the horizon on every side, and the far shore across the harbour
  const outer = [];
  const orng = mulberry32(seed ^ 0x5bd1e995);
  const step = 64;
  for (let x = -CITY.outer; x < CITY.outer; x += step) {
    for (let z = -CITY.outer; z < CITY.outer; z += step) {
      const inCore = Math.abs(x + step / 2) < CITY.half + 40 && z + step / 2 > -CITY.half - 40 && z + step / 2 < CITY.harbourZ + 40;
      const inWater = z + step / 2 > CITY.harbourZ - 10 && z + step / 2 < CITY.farShoreZ;
      if (inCore || inWater) continue;
      const fs = z > CITY.farShoreZ;
      const n = 1 + Math.floor(orng() * 2.4);
      for (let k = 0; k < n; k++) {
        const w = range(orng, 18, 42), dd = range(orng, 18, 42);
        const cx = x + range(orng, w / 2 + 6, step - w / 2 - 6), cz = z + range(orng, dd / 2 + 6, step - dd / 2 - 6);
        const ridge = fs ? Math.max(0, 1 - Math.abs(cx - 300) / 2200) : 0.3 * vnoise(cx / 600, cz / 600);
        const h = range(orng, 30, 110) + ridge * ridge * range(orng, 80, 420) * (fs ? 1.4 : 1);
        const style = h > 160 ? (orng() < 0.6 ? STYLE.GLASS : STYLE.ESTATE) : orng() < 0.5 ? STYLE.ESTATE : STYLE.TENEMENT;
        const b = { id: buildings.length + outer.length, x: cx, z: cz, w, d: dd, h, style, district: 'outer', seed: orng(), outer: true };
        b.tiers = outerMassing(rngFor(b.seed, 5), cx, cz, w, dd, h, style).map(bounds);
        b.h = Math.max(...b.tiers.map((t) => t.y1));
        outer.push(b);
      }
    }
  }

  // street furniture
  const lamps = [];
  const signals = [];
  for (const blk of blocks) {
    if (blk.district === 'zenith') continue;
    const warm = blk.district === 'market' || blk.district === 'docks';
    const edges = [
      { s: blk.sides[2], a0: blk.x0, a1: blk.x1, fixed: blk.z0 + 0.7, axis: 'x', out: -1 },
      { s: blk.sides[3], a0: blk.x0, a1: blk.x1, fixed: blk.z1 - 0.7, axis: 'x', out: 1 },
      { s: blk.sides[0], a0: blk.z0, a1: blk.z1, fixed: blk.x0 + 0.7, axis: 'z', out: -1 },
      { s: blk.sides[1], a0: blk.z0, a1: blk.z1, fixed: blk.x1 - 0.7, axis: 'z', out: 1 },
    ];
    for (const e of edges) {
      if (!e.s) continue;
      const n = Math.max(1, Math.round((e.a1 - e.a0) / 30));
      for (let k = 0; k < n; k++) {
        const a = e.a0 + ((k + 0.5) / n) * (e.a1 - e.a0);
        const x = e.axis === 'x' ? a : e.fixed, z = e.axis === 'x' ? e.fixed : a;
        lamps.push({ x, z, ox: e.axis === 'z' ? e.out : 0, oz: e.axis === 'x' ? e.out : 0, warm });
      }
    }
    for (const [cx, cz, ox, oz] of [[blk.x0, blk.z0, 1, 1], [blk.x1, blk.z0, -1, 1], [blk.x0, blk.z1, 1, -1], [blk.x1, blk.z1, -1, -1]]) {
      if (rng() < 0.5) signals.push({ x: cx + ox * 1.0, z: cz + oz * 1.0, ox, oz });
    }
  }

  const city = { xs, zs, blocks, alleys, buildings, outer, signs, awnings, roofProps, shopfronts, lamps, signals, atlas: ATLAS };
  buildCollision(city);
  indexBlocks(city);
  addSideShops(city);
  bakeDistrict(city);
  applyMassing(city);
  buildCollision(city);
  placeScreens(city);
  buildCollision(city); // again, with the side shops and the district in it
  return city;
}

const bounds = (t) => ({ ...t, x0: t.x - t.w / 2, x1: t.x + t.w / 2, z0: t.z - t.d / 2, z1: t.z + t.d / 2 });

// massing.js shapes every building outside Temple Street once the lots are fixed; ids, lots, shops and signs
// stay as generated. A few housing estates become one arcology. Rooftop plant moves onto whatever roof is
// under it now.
function applyMassing(city) {
  const seen = new Set();
  for (const b of city.buildings) {
    if (b.baked || b.zenith || !b.arch) continue;
    const rng = rngFor(b.seed, 7);
    let tiers = null;
    const blk = b.blk;
    if (blk && !seen.has(blk)) {
      seen.add(blk);
      const I = blk.inner, W = I.ix1 - I.ix0, D = I.iz1 - I.iz0;
      if (W > 60 && D > 45 && hash2(Math.round(blk.x0 * 7 + blk.z0 * 13), 3) < 0.15) {
        blk.mega = b;
        b.style = STYLE.ESTATE;
        tiers = megabuilding(rng, { x: (I.ix0 + I.ix1) / 2, z: (I.iz0 + I.iz1) / 2, w: W - 8, d: D - 8 });
      }
    }
    if (!tiers && blk?.mega && blk.mega !== b) {
      // the arcology's satellite towers
      const s = range(rng, 12, 16);
      tiers = [{ x: b.x, z: b.z, w: s, d: s, y0: 0, y1: blk.mega.tiers[0].y1 + range(rng, 40, 130) }];
    }
    if (!tiers) {
      if (b.arch === 'corp') tiers = corporate(rng, b.lot, b.H, b.podium);
      else if (b.arch === 'estate') tiers = estate(rng, b.lot, b.H);
      else tiers = tenement(rng, b.lot, b.H, b.streetFace);
    }
    b.tiers = tiers.map(bounds);
    b.h = Math.max(...b.tiers.filter((t) => !t.mast).map((t) => t.y1));
  }
  city.roofProps = city.roofProps.filter((r) => {
    if (!r.b || r.b.baked || !r.b.arch) return true;
    let top = -1;
    for (const t of r.b.tiers) if (!t.mast && r.x > t.x0 + 1 && r.x < t.x1 - 1 && r.z > t.z0 + 1 && r.z < t.z1 - 1) top = Math.max(top, t.y1);
    if (top < 0) return false;
    r.y = top;
    return true;
  });
}

// Giant LED screens (adscreens.js draws them): landscape boards on office podiums, banners up towers and
// arcologies, the odd billboard on a tenement. A screen goes only where the street in front of it is open.
function placeScreens(city) {
  const screens = [];
  const q = [];
  const ROT = [-Math.PI / 2, Math.PI / 2, Math.PI, 0];
  const open = (b, t, f, along, y0, y1) => {
    const [nx, nz] = NORM[f];
    const fx = f < 2 ? (f ? t.x1 : t.x0) : t.x, fz = f < 2 ? t.z : (f === 3 ? t.z1 : t.z0);
    for (const k of [-0.45, 0, 0.45]) {
      const px = fx + nx * 4 + (f < 2 ? 0 : k * along), pz = fz + nz * 4 + (f < 2 ? k * along : 0);
      queryBoxes(city, px - 1, pz - 1, px + 1, pz + 1, q);
      if (q.some((bx) => bx.kind === 'bldg' && bx.b !== b && bx.y1 > y0 && bx.y0 < y1)) return false;
    }
    return true;
  };
  const add = (b, t, f, w, h, y, o) => {
    const [nx, nz] = NORM[f];
    const along = f < 2 ? t.d : t.w;
    if (w > along - 1 || h < 3 || !open(b, t, f, w, y - h / 2, y + h / 2)) return false;
    const off = (along - w) / 2 * o;
    const x = f < 2 ? (f ? t.x1 : t.x0) + nx * 0.25 : t.x + off;
    const z = f < 2 ? t.z + off : (f === 3 ? t.z1 : t.z0) + nz * 0.25;
    screens.push({ x, y, z, rotY: ROT[f], w, h, seed: (b.seed * 7.31 + screens.length * 0.137) % 1, face: f });
    return true;
  };
  for (const b of city.buildings) {
    if (b.baked || b.zenith || !b.arch) continue;
    const rng = rngFor(b.seed, 11);
    const faces = shuffle(rng, [0, 1, 2, 3]);
    if (b.blk?.mega === b) {
      let n = 0;
      for (const t of b.tiers.filter((t) => !t.kind && t.y0 > 1)) {
        for (const f of faces) {
          if (n >= 4 || rng() < 0.4) continue;
          const along = f < 2 ? t.d : t.w;
          const h = Math.min(t.y1 - t.y0 - 6, range(rng, 22, 44));
          if (add(b, t, f, Math.min(along * range(rng, 0.45, 0.75), h * range(rng, 1.4, 2.4)), h, (t.y0 + t.y1) / 2, range(rng, -1, 1))) n++;
        }
      }
    } else if (b.arch === 'corp') {
      const pod = b.tiers[0], sh = b.tiers[1];
      if (rng() < 0.8 && pod.y1 > 14) {
        for (const f of faces) {
          const along = f < 2 ? pod.d : pod.w;
          const h = Math.min(pod.y1 - 7.5, range(rng, 9, 16));
          if (add(b, pod, f, Math.min(along * range(rng, 0.55, 0.85), h * range(rng, 1.8, 2.6), 46), h, 6 + h / 2 + 0.5, range(rng, -1, 1))) break;
        }
      }
      if (sh && !sh.kind && rng() < 0.7 && sh.y1 - sh.y0 > 50) {
        for (const f of faces) {
          const along = f < 2 ? sh.d : sh.w;
          const w = Math.min(along * range(rng, 0.35, 0.6), range(rng, 11, 22));
          const h = Math.min(w * range(rng, 2.2, 4.2), (sh.y1 - sh.y0) * 0.6, 150);
          if (add(b, sh, f, w, h, sh.y0 + 8 + h / 2 + rng() * Math.max(0, sh.y1 - sh.y0 - h - 16), rng() < 0.5 ? -0.9 : 0.9)) break;
        }
      }
    } else if (b.arch !== 'corp' && b.h > 14 && b.h < 80 && b.streetFace != null && rng() < 0.07) {
      // rooftop billboard on a steel frame, facing the street
      const t = b.tiers.find((t) => !t.feat && t.y1 >= b.h - 0.01) || b.tiers[0], f = b.streetFace;
      const along = f < 2 ? t.d : t.w;
      const w = Math.min(along - 1.5, range(rng, 9, 18)), h = w / range(rng, 2, 2.6), lift = range(rng, 1.5, 4);
      const [nx, nz] = NORM[f];
      const inset = 1.2;
      const fx = f < 2 ? (f ? t.x1 : t.x0) - nx * inset : t.x, fz = f < 2 ? t.z : (f === 3 ? t.z1 : t.z0) - nz * inset;
      if (w > 7 && open(b, t, f, w, t.y1, t.y1 + lift + h)) {
        screens.push({ x: fx, y: t.y1 + lift + h / 2, z: fz, rotY: ROT[f], w, h, seed: (b.seed * 7.31 + screens.length * 0.137) % 1, face: f, roof: true });
        for (const k of [-0.4, 0.4]) {
          const px = fx - nx * 0.6 + (f < 2 ? 0 : k * w), pz = fz - nz * 0.6 + (f < 2 ? k * w : 0);
          b.tiers.push(bounds({ x: px, z: pz, w: 0.35, d: 0.35, y0: t.y1, y1: t.y1 + lift + h, kind: 'clad', feat: true }));
        }
      }
    } else if (b.arch === 'tenement' && b.h > 36 && b.streetFace != null && rng() < 0.2) {
      const t = b.tiers[0], f = b.streetFace;
      const along = f < 2 ? t.d : t.w;
      const w = Math.min(along - 2, range(rng, 5.5, 9));
      const h = Math.min(w * range(rng, 2.2, 3.4), t.y1 - 14);
      add(b, t, f, w, h, t.y1 - 3 - h / 2, 0);
    }
  }
  city.screens = screens;
}

// Temple Street comes from Blender (district.js): its buildings, their signs, awnings and rooftop plant are drawn
// there, so the generated ones give way; the building boxes stay for landing and line of sight, and the district's
// own colliders cover what it adds. Shopfronts and lamps are the game's own and stay.
function bakeDistrict(city) {
  const hero = new Set(DISTRICT.hero);
  const baked = city.buildings.filter((b) => hero.has(b.id));
  for (const b of baked) b.baked = true;
  const c = DISTRICT.corridor, m = 1.5;
  const covered = (x, z) => (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1)
    || baked.some((b) => b.tiers.some((t) => x > t.x0 - m && x < t.x1 + m && z > t.z0 - m && z < t.z1 + m));
  city.signs = city.signs.filter((s) => !covered(s.x, s.z));
  city.awnings = city.awnings.filter((a) => !covered(a.x, a.z));
  city.roofProps = city.roofProps.filter((r) => !covered(r.x, r.z));
  city.bakedBoxes = DISTRICT.colliders;
}

const NORM = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// Corner and end-of-row buildings show a second face to the street; it gets shops too. Hashed rather than drawn
// from the layout's generator, so nothing else in the city moves.
function addSideShops(city) {
  const q = [];
  for (const b of city.buildings) {
    if (b.style !== STYLE.TENEMENT || b.tiers[0].y0 > 0) continue;
    for (let face = 0; face < 4; face++) {
      if ((b.shopFaces || 0) & (1 << face)) continue;
      const [nx, nz] = NORM[face];
      const len = face >= 2 ? b.w : b.d;
      if (len < 4) continue;
      const fx = b.x + nx * b.w / 2, fz = b.z + nz * b.d / 2;
      // open pavement all along it: every sample 1.5 m out is sidewalk and clear of other buildings
      let open = true;
      for (const t of [0.15, 0.5, 0.85]) {
        const a = (t - 0.5) * len;
        const px = fx + nx * 1.5 + (face >= 2 ? a : 0), pz = fz + nz * 1.5 + (face >= 2 ? 0 : a);
        if (!onSidewalk(city, px, pz)) { open = false; break; }
        queryBoxes(city, px, pz, px, pz, q);
        if (q.some((bx) => !bx.sign && bx.b !== b && px >= bx.x0 && px <= bx.x1 && pz >= bx.z0 && pz <= bx.z1)) { open = false; break; }
      }
      if (!open) continue;
      const rotY = face === 0 ? -Math.PI / 2 : face === 1 ? Math.PI / 2 : face === 2 ? Math.PI : 0;
      const h = hash2(b.id * 7 + face, 913);
      city.shopfronts.push({ x: fx + nx * 0.02, y: 2.1, z: fz + nz * 0.02, rotY, w: len - 1.0, h: 3.8, seed: h, face, open: hash2(b.id, face + 77) < 0.72 });
      b.shopFaces = (b.shopFaces || 0) | (1 << face);
    }
  }
}

// --- collision and height queries ---
const CELL = 32;

// Everything drawn that a vehicle could run into. Solid boxes (buildings, rooftop plant) can also be landed on;
// the rest only push back. Kinds: bldg, sign, shop, awning, pole, roof.
function buildCollision(city) {
  const boxes = [];
  for (const b of [...city.buildings, ...city.outer]) {
    for (const t of b.tiers) boxes.push({ x0: t.x0, x1: t.x1, y0: t.y0, y1: t.y1, z0: t.z0, z1: t.z1, b, t, kind: 'bldg', solid: true });
  }
  // a slab standing on a facade line: centred `along` the wall, reaching `out0..out1` from it, y0..y1
  const slab = (x, z, rotY, w, out0, out1, y0, y1, extra) => {
    const nx = Math.round(Math.sin(rotY)), nz = Math.round(Math.cos(rotY));
    const ax = Math.abs(nz), az = Math.abs(nx); // the wall runs along x when its normal is along z
    const ox0 = x + nx * out0, ox1 = x + nx * out1, oz0 = z + nz * out0, oz1 = z + nz * out1;
    boxes.push({
      x0: Math.min(ox0, ox1) - ax * w / 2, x1: Math.max(ox0, ox1) + ax * w / 2,
      z0: Math.min(oz0, oz1) - az * w / 2, z1: Math.max(oz0, oz1) + az * w / 2,
      y0, y1, ...extra,
    });
  };
  for (const s of city.signs) {
    if (s.kind === 'fascia') { slab(s.x, s.z, s.rotY, s.w, -0.2, 0.3, s.y - s.h / 2, s.y + s.h / 2, { sign: s, kind: 'sign' }); continue; }
    const across = Math.abs(Math.sin(s.rotY)) > 0.5;
    const hw = s.w / 2, th = 0.2;
    boxes.push({ x0: s.x - (across ? hw : th), x1: s.x + (across ? hw : th), y0: s.y - s.h / 2, y1: s.y + s.h / 2, z0: s.z - (across ? th : hw), z1: s.z + (across ? th : hw), sign: s, kind: 'sign' });
  }
  // modelled shopfronts stand up to 0.67 m proud of the wall (shopkit.js); awnings reach over the pavement
  for (const s of city.shopfronts) slab(s.x, s.z, s.rotY, s.w, -0.3, 0.7, 0, 3.3, { kind: 'shop' });
  for (const a of city.awnings) slab(a.x, a.z, a.rotY, a.w, -a.depth / 2, a.depth / 2, a.y - 0.2, a.y + 0.12, { kind: 'awning' });
  for (const sc of city.screens || []) slab(sc.x, sc.z, sc.rotY, sc.w + 0.6, -0.3, 0.45, sc.y - sc.h / 2 - 0.3, sc.y + sc.h / 2 + 0.3, { kind: 'sign' });
  // lamp posts: the pole, and the arm with its head reaching over the road
  for (const l of city.lamps) {
    boxes.push({ x0: l.x - 0.2, x1: l.x + 0.2, z0: l.z - 0.2, z1: l.z + 0.2, y0: 0, y1: 8.9, kind: 'pole' });
    const ex = l.x + l.ox * 2.8, ez = l.z + l.oz * 2.8;
    boxes.push({ x0: Math.min(l.x, ex) - 0.2, x1: Math.max(l.x, ex) + 0.2, z0: Math.min(l.z, ez) - 0.2, z1: Math.max(l.z, ez) + 0.2, y0: 8.4, y1: 8.8, kind: 'pole' });
  }
  // rooftop plant, footprints as props.js draws them (rotations are quarter turns)
  const ROOF = { tank: [2.5, 3.6, 2.5], shack: [4.2, 2.7, 3.2], chiller: [3.2, 1.6, 2.1], mast: [0.4, 12.3, 0.4] };
  for (const r of city.roofProps) {
    const [w, h, d] = ROOF[r.type];
    const q = Math.round(r.rotY / (Math.PI / 2)) % 2 !== 0;
    const hx = ((q ? d : w) * r.s) / 2, hz = ((q ? w : d) * r.s) / 2;
    boxes.push({ x0: r.x - hx, x1: r.x + hx, z0: r.z - hz, z1: r.z + hz, y0: r.y, y1: r.y + h * r.s, kind: r.type === 'mast' ? 'pole' : 'roof', solid: r.type !== 'mast' });
  }
  for (const c of city.bakedBoxes || []) boxes.push({ ...c });
  const grid = new Map();
  boxes.forEach((bx, i) => {
    for (let gx = Math.floor(bx.x0 / CELL); gx <= Math.floor(bx.x1 / CELL); gx++) {
      for (let gz = Math.floor(bx.z0 / CELL); gz <= Math.floor(bx.z1 / CELL); gz++) {
        const k = gx * 73856093 ^ gz * 19349663;
        let a = grid.get(k);
        if (!a) grid.set(k, (a = []));
        a.push(i);
      }
    }
  });
  city.boxes = boxes;
  city.grid = grid;
}

const _seen = new Set();
export function queryBoxes(city, x0, z0, x1, z1, out) {
  out.length = 0;
  _seen.clear();
  for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++) {
    for (let gz = Math.floor(z0 / CELL); gz <= Math.floor(z1 / CELL); gz++) {
      const a = city.grid.get(gx * 73856093 ^ gz * 19349663);
      if (!a) continue;
      for (const i of a) if (!_seen.has(i)) { _seen.add(i); out.push(city.boxes[i]); }
    }
  }
  return out;
}

const _q = [];
// top of whatever solid is under (x,z) and below y; streets are 0, sidewalks the curb height, water -1.2
export function groundAt(city, x, z, y = Infinity) {
  if (z > CITY.harbourZ && z < CITY.farShoreZ) return -1.2;
  let top = onSidewalk(city, x, z) ? CITY.curb : 0;
  queryBoxes(city, x, z, x, z, _q);
  for (const b of _q) {
    if (!b.solid) continue;
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y1 <= y + 0.6 && b.y1 > top) top = b.y1;
  }
  return top;
}

export function onSidewalk(city, x, z) {
  const blk = blockAt(city, x, z);
  return !!blk;
}

export function blockAt(city, x, z) {
  // binary search the street lines, then test the block rectangle
  const xs = city.xs, zs = city.zs;
  let i = -1, j = -1;
  for (let k = 0; k < xs.length - 1; k++) if (x >= xs[k].p && x < xs[k + 1].p) { i = k; break; }
  for (let k = 0; k < zs.length - 1; k++) if (z >= zs[k].p && z < zs[k + 1].p) { j = k; break; }
  if (i < 0 || j < 0) return null;
  for (const blk of city.blocksByCell?.get(i * 1000 + j) || []) {
    if (x >= blk.x0 && x <= blk.x1 && z >= blk.z0 && z <= blk.z1) return blk;
  }
  return null;
}

export function indexBlocks(city) {
  const m = new Map();
  for (const blk of city.blocks) {
    const cx = (blk.x0 + blk.x1) / 2, cz = (blk.z0 + blk.z1) / 2;
    let i = -1, j = -1;
    for (let k = 0; k < city.xs.length - 1; k++) if (cx >= city.xs[k].p && cx < city.xs[k + 1].p) { i = k; break; }
    for (let k = 0; k < city.zs.length - 1; k++) if (cz >= city.zs[k].p && cz < city.zs[k + 1].p) { j = k; break; }
    const key = i * 1000 + j;
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(blk);
  }
  city.blocksByCell = m;
}
