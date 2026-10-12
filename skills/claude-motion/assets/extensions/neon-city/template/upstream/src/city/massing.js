// Building massing: turns a lot and a height into tiers (axis-aligned boxes, each with its own centre).
// tiers[0] is the base and tiers[1] the main shaft for every type, so run gates and the map can rely on them;
// features (ledges, fins, crown frames, bridges, plant rooms) come after and carry feat: true.
// Kinds the facade shader draws: undefined = the building's style, 'clad' metal and stone cladding,
// 'louvre' mechanical floors, 'led' lit crowns, 'plant' bare concrete roof structures.
// Every choice here draws from a generator seeded by the building, never from the layout's own stream, so
// the lots, shops and signs (and the baked district) stay where they are.
import { mulberry32, range, pick, shuffle } from '../core/rng.js';
import { STYLE } from './layout.js';

const FLOOR = 3.1;
const snap = (h) => Math.max(FLOOR * 3, Math.round(h / FLOOR) * FLOOR);
export const rngFor = (seed, salt = 0) => mulberry32(Math.floor(seed * 2 ** 31) ^ (salt * 0x9e3779b1));

const T = (x, z, w, d, y0, y1, o = {}) => ({ x, z, w, d, y0, y1, ...o });
const F = (x, z, w, d, y0, y1, kind, o = {}) => ({ x, z, w, d, y0, y1, kind, feat: true, ...o });

// a ledge or cornice capping a tier, a little proud of it
function ledge(t, over = 0.6, th = 0.7) {
  return F(t.x, t.z, t.w + over * 2, t.d + over * 2, t.y1 - th, t.y1, 'clad');
}

// crowns: what a tower does at the top
function crown(rng, t, out, tall) {
  const k = rng();
  const top = t.y1;
  if (k < 0.3) {
    // open frame: corner posts and a ring beam
    const h = range(rng, 9, tall ? 26 : 16), p = Math.min(1.6, t.w * 0.08);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      out.push(F(t.x + sx * (t.w / 2 - p / 2), t.z + sz * (t.d / 2 - p / 2), p, p, top, top + h, 'clad'));
    }
    out.push(F(t.x, t.z - t.d / 2 + p / 2, t.w, p, top + h - 1.4, top + h, 'led'));
    out.push(F(t.x, t.z + t.d / 2 - p / 2, t.w, p, top + h - 1.4, top + h, 'led'));
    out.push(F(t.x - t.w / 2 + p / 2, t.z, p, t.d - 2 * p, top + h - 1.4, top + h, 'led'));
    out.push(F(t.x + t.w / 2 - p / 2, t.z, p, t.d - 2 * p, top + h - 1.4, top + h, 'led'));
    out.push(F(t.x, t.z, t.w * 0.45, t.d * 0.45, top, top + range(rng, 4, 7), 'plant'));
  } else if (k < 0.55) {
    // lit crown: a narrower drum of LED panels over a louvred plant floor
    const h = range(rng, 6, 9);
    out.push(F(t.x, t.z, t.w - 1.2, t.d - 1.2, top, top + h, 'louvre'));
    const s = range(rng, 0.62, 0.8);
    out.push(F(t.x, t.z, t.w * s, t.d * s, top + h, top + h + range(rng, 8, tall ? 22 : 12), 'led'));
  } else if (k < 0.8) {
    // stepped top: two or three shrinking blocks
    let w = t.w, d = t.d, y = top;
    const n = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      w *= range(rng, 0.68, 0.82); d *= range(rng, 0.68, 0.82);
      const h = range(rng, 5, 10);
      out.push(F(t.x, t.z, w, d, y, y + h, i === n - 1 ? 'led' : 'louvre'));
      y += h;
    }
  } else {
    // plant rooms and a cornice
    out.push(ledge(t, 0.5, 0.9));
    out.push(F(t.x + range(rng, -0.15, 0.15) * t.w, t.z + range(rng, -0.15, 0.15) * t.d, t.w * range(rng, 0.3, 0.5), t.d * range(rng, 0.3, 0.5), top, top + range(rng, 4, 8), 'plant'));
  }
  if (tall && rng() < 0.75) out.push(F(t.x, t.z, 1.6, 1.6, top, top + range(rng, 24, 70), 'clad', { mast: true }));
}

// office and glass towers on a lot: several families, picked per building
export function corporate(rng, lot, H, podium) {
  const { x, z, w: lw, d: ld } = lot;
  const out = [T(x, z, lw, ld, 0, podium)];
  const k = rng();
  const tall = H > 300;
  const wide = Math.max(lw, ld) > 46;
  const alongX = lw >= ld;
  if (k < 0.24 || (k < 0.4 && !wide)) {
    // setback tower: shrinking shafts with cornices and plant floors at the steps
    const sw0 = Math.min(lw, ld) * range(rng, 0.55, 0.8);
    let w = Math.min(lw - 4, sw0 * range(rng, 0.9, 1.3)), d = Math.min(ld - 4, sw0);
    let y = podium;
    const steps = H > 400 ? 3 : H > 200 ? 2 : 1;
    const ox = range(rng, -0.12, 0.12) * (lw - w), oz = range(rng, -0.12, 0.12) * (ld - d);
    for (let i = 0; i < steps; i++) {
      const y1 = i === steps - 1 ? H : y + (H - y) * range(rng, 0.45, 0.65);
      const t = T(x + ox, z + oz, w, d, y, y1);
      out.push(t);
      if (i < steps - 1) {
        if (rng() < 0.6) { t.y1 = y1 - range(rng, 4, 7); out.push(F(t.x, t.z, w - 0.8, d - 0.8, t.y1, y1, 'louvre')); }
        out.push(ledge({ ...t, y1 }, 0.8, 0.9));
      } else crown(rng, t, out, tall);
      y = y1;
      w *= range(rng, 0.7, 0.86);
      d *= range(rng, 0.7, 0.86);
    }
  } else if (k < 0.5) {
    // stacked blocks that slide past each other, cantilevering over the street side
    const n = H > 380 ? 5 : H > 200 ? 4 : 3;
    let y = podium;
    const span = H - podium;
    for (let i = 0; i < n; i++) {
      const h = i === n - 1 ? H - y : span / n * range(rng, 0.8, 1.2);
      const w = Math.min(lw - 2, lw * range(rng, 0.5, 0.82)), d = Math.min(ld - 2, ld * range(rng, 0.5, 0.82));
      const ox = range(rng, -1, 1) * Math.max(0, (lw - w) / 2 - 1), oz = range(rng, -1, 1) * Math.max(0, (ld - d) / 2 - 1);
      const t = T(x + ox, z + oz, w, d, y, y + h, { style: i % 2 ? STYLE.OFFICE : STYLE.GLASS });
      out.push(t);
      if (i < n - 1 && rng() < 0.55) {
        // a recessed sky lobby between blocks
        const g = range(rng, 4.5, 8);
        t.y1 -= g;
        out.push(F(t.x, t.z, w * 0.55, d * 0.55, t.y1, t.y1 + g, rng() < 0.5 ? 'louvre' : undefined, { style: STYLE.GLASS }));
      }
      out.push(ledge(t, 0.4, 0.8));
      if (i === n - 1) crown(rng, t, out, tall);
      y += h;
    }
  } else if (k < 0.7 && wide) {
    // twin shafts on one podium, tied by sky bridges
    const L = alongX ? lw : ld, S = alongX ? ld : lw;
    const gap = Math.max(9, L * range(rng, 0.14, 0.22));
    const tw = (L - gap) / 2 - 2, td = Math.min(S - 4, tw * range(rng, 0.8, 1.2));
    const hB = H * range(rng, 0.78, 0.95);
    const pos = (s) => (alongX ? [x + s * (gap / 2 + tw / 2), z] : [x, z + s * (gap / 2 + tw / 2)]);
    const [ax, az] = pos(-1), [bx, bz] = pos(1);
    const ta = T(ax, az, alongX ? tw : td, alongX ? td : tw, podium, H);
    const tb = T(bx, bz, alongX ? tw : td, alongX ? td : tw, podium, hB, { style: STYLE.GLASS });
    out.push(ta, tb);
    const nb = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < nb; i++) {
      const by = podium + (hB - podium) * range(rng, 0.3, 0.85);
      const bw = range(rng, 7, 11), bh = range(rng, 5, 8);
      out.push(F(x, z, alongX ? gap + 2 : bw, alongX ? bw : gap + 2, by, by + bh, undefined, { style: STYLE.GLASS }));
      out.push(F(x, z, alongX ? gap + 2.4 : bw + 0.8, alongX ? bw + 0.8 : gap + 2.4, by - 0.8, by, 'clad'));
    }
    crown(rng, ta, out, tall);
    crown(rng, tb, out, tall && hB > 300);
  } else if (k < 0.85) {
    // slab with full-height fins down its long faces
    const L = alongX ? lw - 6 : ld - 6, S = Math.min((alongX ? ld : lw) - 6, range(rng, 18, 28));
    const t = T(x, z, alongX ? L : S, alongX ? S : L, podium, H);
    out.push(t);
    const step = range(rng, 3.6, 6.2), fd = range(rng, 0.7, 1.4);
    const n = Math.floor(L / step);
    for (let i = 0; i <= n; i++) {
      const a = -L / 2 + (L - n * step) / 2 + i * step;
      for (const s of [-1, 1]) {
        if (alongX) out.push(F(x + a, z + s * (S / 2 + fd / 2), 0.45, fd, podium + 2, H - 1.5, 'clad'));
        else out.push(F(x + s * (S / 2 + fd / 2), z + a, fd, 0.45, podium + 2, H - 1.5, 'clad'));
      }
    }
    crown(rng, t, out, tall);
  } else {
    // a tall core with lower wings: T, L or cross plans
    const cw = Math.min(lw, ld) * range(rng, 0.42, 0.55);
    const core = T(x, z, cw, cw, podium, H);
    out.push(core);
    const dirs = shuffle(rng, [[1, 0], [-1, 0], [0, 1], [0, -1]]).slice(0, 2 + Math.floor(rng() * 3));
    for (const [sx, sz] of dirs) {
      const reach = (sx ? lw : ld) / 2 - 2;
      const len = reach - cw / 2;
      if (len < 6) continue;
      const ww = cw * range(rng, 0.55, 0.8);
      const wh = podium + (H - podium) * range(rng, 0.3, 0.7);
      const t = T(x + sx * (cw / 2 + len / 2), z + sz * (cw / 2 + len / 2), sx ? len : ww, sz ? len : ww, podium, wh, { feat: true, style: STYLE.OFFICE });
      out.push(t, ledge(t, 0.4, 0.8));
    }
    crown(rng, core, out, tall);
  }
  return out;
}

// public housing: cruciform and H plans, slabs with end wings; lift rooms and water tanks on top
export function estate(rng, lot, H) {
  const { x, z, w, d } = lot;
  const out = [];
  const k = rng();
  const h = snap(H);
  if (k < 0.4 && Math.min(w, d) > 26) {
    const c = range(rng, 10, 13);
    const reach = Math.min(w, d) / 2;
    const ww = range(rng, 10, 12.5);
    out.push(T(x, z, c, c, 0, h));
    out.push(T(x, z, Math.min(w, reach * 2), ww, 0, h - (rng() < 0.4 ? FLOOR * 2 : 0)));
    out.push(T(x, z, ww, Math.min(d, reach * 2), 0, h - (rng() < 0.4 ? FLOOR * 2 : 0), { feat: true }));
    out.push(F(x, z, c * 0.7, c * 0.7, h, h + range(rng, 4, 6.5), 'plant'));
  } else if (k < 0.7 && Math.max(w, d) > 30) {
    // H: two slabs and a core between them
    const alongX = w >= d;
    const L = (alongX ? w : d), sd = range(rng, 10, 13);
    const gap = Math.max(8, (alongX ? d : w) - sd * 2);
    const off = gap / 2 + sd / 2;
    const s1 = alongX ? T(x, z - off, L, sd, 0, h) : T(x - off, z, sd, L, 0, h);
    const s2 = alongX ? T(x, z + off, L, sd, 0, h - (rng() < 0.5 ? FLOOR * 3 : 0), { feat: true }) : T(x + off, z, sd, L, 0, h, { feat: true });
    out.push(s1, s2, T(x, z, alongX ? range(rng, 9, 12) : gap + 2, alongX ? gap + 2 : range(rng, 9, 12), 0, h + FLOOR, { feat: true }));
    for (const s of [s1, s2]) out.push(F(s.x, s.z, Math.min(s.w, 8), Math.min(s.d, 8), s.y1, s.y1 + 4.5, 'plant'));
  } else {
    // slab, ends stepping down
    out.push(T(x, z, w, d, 0, h));
    out.push(T(x, z, w * 0.6, d * 0.6, h, h + FLOOR * Math.floor(range(rng, 1, 4))));
    out.push(F(x, z, Math.min(w, 9), Math.min(d, 9), out[1].y1, out[1].y1 + 4.5, 'plant'));
  }
  return out;
}

// a tenement on a perimeter lot: sometimes a rooftop extension set back from the street
export function tenement(rng, lot, h, streetFace) {
  const { x, z, w, d } = lot;
  const out = [T(x, z, w, d, 0, h)];
  if (rng() < 0.32 && h > 18) {
    const k = Math.min(w, d) > 9 ? range(rng, 0.55, 0.8) : 0.9;
    const [nx, nz] = streetFace == null ? [0, 0] : [[-1, 0], [1, 0], [0, -1], [0, 1]][streetFace];
    const ew = w * (nx ? k : 1), ed = d * (nz ? k : 1);
    out.push(T(x - nx * (w - ew) / 2, z - nz * (d - ed) / 2, ew, ed, h, h + FLOOR * (rng() < 0.6 ? 1 : 2)));
  }
  return out;
}

// the arcologies: a few megabuildings that hold a whole block
export function megabuilding(rng, lot) {
  const { x, z, w, d } = lot;
  const out = [];
  const base = range(rng, 18, 30);
  out.push(T(x, z, w, d, 0, base, { style: STYLE.OFFICE }));
  const alongX = w >= d;
  let y = base;
  const n = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    const h = range(rng, 60, 110);
    const sw = (alongX ? w : d) * range(rng, 0.72, 0.95), sd = (alongX ? d : w) * range(rng, 0.5, 0.75);
    const shift = range(rng, -0.12, 0.12) * (alongX ? w : d);
    const t = alongX ? T(x + shift, z, sw, sd, y, y + h, { style: STYLE.ESTATE }) : T(x, z + shift, sd, sw, y, y + h, { style: STYLE.ESTATE });
    if (i) t.feat = true;
    out.push(t, ledge(t, 1.2, 1.4));
    y += h;
    if (i < n - 1) {
      // an open level: a core and columns, lit
      const g = range(rng, 9, 14);
      out.push(F(t.x, t.z, t.w * 0.4, t.d * 0.4, y, y + g, 'louvre'));
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        out.push(F(t.x + sx * (t.w / 2 - 2), t.z + sz * (t.d / 2 - 2), 3, 3, y, y + g, 'clad'));
      }
      y += g;
    } else crown(rng, t, out, true);
  }
  return out;
}

// the horizon: simpler, but no two alike
export function outer(rng, cx, cz, w, d, h, style) {
  const out = [T(cx, cz, w, d, 0, h)];
  const k = rng();
  if (k < 0.35 && h > 60) {
    out[0].y1 = h * range(rng, 0.55, 0.75);
    out.push(T(cx + range(rng, -0.15, 0.15) * w, cz + range(rng, -0.15, 0.15) * d, w * range(rng, 0.55, 0.8), d * range(rng, 0.55, 0.8), out[0].y1, h));
  } else if (k < 0.5 && h > 80) {
    out.push(T(cx, cz, w * 0.7, d * 0.7, h, h + range(rng, 8, 30), { feat: true, kind: style === STYLE.GLASS ? 'led' : 'louvre' }));
  }
  return out;
}

export { pick };
