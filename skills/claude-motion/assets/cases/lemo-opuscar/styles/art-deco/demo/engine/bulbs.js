// Art Deco engine · bulb marquee sign. Any text, any font: glyphs are thinned to a one-pixel skeleton,
// traced into stroke chains and dotted with evenly spaced bulbs. Each bulb can be lit independently (chases, one-by-one ignition).
import { C, TAU, clamp, lerp, mix, rgba, goldGrad, gline, toPath } from './deco.js';

const cache = new Map();

function zhangSuen(img, w, h) {
  const idx = (x, y) => y * w + x; let changed = true; const del = [];
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = idx(x, y); if (!img[i]) continue;
        const p2 = img[i - w], p3 = img[i - w + 1], p4 = img[i + 1], p5 = img[i + w + 1], p6 = img[i + w], p7 = img[i + w - 1], p8 = img[i - 1], p9 = img[i - w - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
        if (A !== 1) continue;
        if (pass === 0 ? (p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) : (p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0)) del.push(i);
      }
      if (del.length) { changed = true; for (const i of del) img[i] = 0; }
    }
  }
  return img;
}

function traceChains(img, w, h) {
  const N = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && img[y * w + x];
  const RING = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  // crossing number: number of separate neighbour runs (1 = end, 2 = line, >=3 = junction); staircases count as lines
  const deg = (x, y) => { let A = 0, any = 0; for (let i = 0; i < 8; i++) { const a = on(x + RING[i][0], y + RING[i][1]), b = on(x + RING[(i + 1) % 8][0], y + RING[(i + 1) % 8][1]); if (a) any++; if (!a && b) A++; } return any === 0 ? 0 : any >= 7 ? 3 : A; };
  const seen = new Uint8Array(w * h); const chains = [];
  const walk = (sx, sy) => {
    const pts = [[sx, sy]]; seen[sy * w + sx] = 1; let x = sx, y = sy;
    for (; ;) {
      let nx = null;
      for (const [dx, dy] of N) { const X = x + dx, Y = y + dy; if (on(X, Y) && !seen[Y * w + X]) { nx = [X, Y]; break; } }
      if (!nx) break;
      x = nx[0]; y = nx[1]; seen[y * w + x] = 1; pts.push([x, y]);
      if (deg(x, y) >= 3 && pts.length > 2) break;
    }
    return pts;
  };
  const pix = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (img[y * w + x]) pix.push([x, y]);
  for (const [x, y] of pix) if (!seen[y * w + x] && deg(x, y) === 1) chains.push(walk(x, y));
  for (let pass = 0; pass < 3; pass++) for (const [x, y] of pix) if (!seen[y * w + x]) { const c = walk(x, y); if (c.length > 1) chains.push(c); }
  const keep = chains.filter(c => c.length >= 4);
  // join chain ends to the nearest pixel of another chain (closes junction gaps left by the tracer)
  for (const c of keep) for (const end of [0, 1]) {
    const p = end ? c[c.length - 1] : c[0]; let best = null, bd = 14;
    for (const o of keep) { if (o === c) continue; for (let i = 0; i < o.length; i += 1) { const d = Math.hypot(o[i][0] - p[0], o[i][1] - p[1]); if (d < bd && d > .5) { bd = d; best = o[i]; } } }
    if (best) { if (end) c.push([best[0], best[1]]); else c.unshift([best[0], best[1]]); }
  }
  return keep;
}

function smooth(pts, k = 3) {
  if (pts.length < 5) return pts.map(p => [p[0], p[1]]);
  const o = [];
  for (let i = 0; i < pts.length; i++) {
    let sx = 0, sy = 0, n = 0;
    for (let j = -k; j <= k; j++) { const q = pts[clamp(i + j, 0, pts.length - 1)]; sx += q[0]; sy += q[1]; n++; }
    o.push(i === 0 || i === pts.length - 1 ? [pts[i][0], pts[i][1]] : [sx / n, sy / n]);
  }
  return o;
}

function sample(chain, sp) {
  const out = [chain[0]]; let acc = 0;
  for (let i = 1; i < chain.length; i++) {
    const a = chain[i - 1], b = chain[i]; let d = Math.hypot(b[0] - a[0], b[1] - a[1]); let t0 = 0;
    while (acc + d * (1 - t0) >= sp) { const need = sp - acc; t0 += need / d; out.push([lerp(a[0], b[0], t0), lerp(a[1], b[1], t0)]); acc = 0; }
    acc += d * (1 - t0);
  }
  const last = chain[chain.length - 1], lp = out[out.length - 1];
  if (Math.hypot(last[0] - lp[0], last[1] - lp[1]) > sp * .55) out.push(last);
  return out;
}

// Build a sign layout. size = font px of the glyph raster; spacing = bulb pitch (same units). Units are raster px; draw with a scale.
export function buildSign(text, { font = 'Poiret', weight = '', size = 260, spacing = 20, track = .12 } = {}) {
  const key = [text, font, weight, size, spacing, track].join('|');
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  g.font = `${weight} ${size}px ${font}`.trim();
  const letters = []; let x = 0; let gi = 0;
  const pad = Math.ceil(size * .12), H = Math.ceil(size * 1.3);
  for (const ch of text) {
    const adv = g.measureText(ch).width;
    if (ch === ' ') { x += adv + size * track; continue; }
    const W = Math.ceil(adv + pad * 2);
    cv.width = W; cv.height = H;
    const h = cv.getContext('2d'); h.font = `${weight} ${size}px ${font}`.trim(); h.fillStyle = '#fff'; h.textBaseline = 'alphabetic';
    h.fillText(ch, pad, size * 1.02);
    const d = h.getImageData(0, 0, W, H).data, img = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) img[i] = d[i * 4 + 3] > 110 ? 1 : 0;
    zhangSuen(img, W, H);
    const chains = traceChains(img, W, H).map(c => smooth(c, 4));
    const bulbs = [];
    for (const c of chains) for (const p of sample(c, spacing)) {
      if (bulbs.some(b => Math.hypot(b[0] - p[0], b[1] - p[1]) < spacing * .62)) continue;
      bulbs.push(p);
    }
    const ox = x - pad;
    letters.push({ ch, x: ox, w: W, chains: chains.map(c => c.map(([a, b]) => [a + ox, b])), bulbs: bulbs.map(([a, b]) => [a + ox, b]), gi0: gi });
    gi += bulbs.length; x += adv + size * track;
  }
  const out = { text, letters, w: x - size * track, h: H, size, spacing, count: gi, base: size * 1.02 };
  cache.set(key, out);
  return out;
}

// Draw a sign. (x,y) = top-left, s = scale. lit(li, bi, gi) → 0..1 (0 = dark glass, 1 = full, >1 = ignition flash).
// o.channel: draw enamel channel letters behind the bulbs; o.color = bulb colour (keep warm white for the deco look, or any hex for "the one colour").
export function drawSign(g, sign, x, y, s, o = {}) {
  const { lit = () => 1, channel = true, enamel = '#1a0c10', rimW = 2.2, bulbR = null, color = null, haloK = 1, frame = true, letterGlow = 1, only = null } = o;
  const use = li => only == null || only === li;
  const sp = sign.spacing, br = (bulbR ?? sp * .3) * s;
  const glowRGB = color ? (() => { const n = parseInt(color.slice(1), 16); return `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`; })() : C.bulbGlow;
  g.save(); g.translate(x, y);
  // letter-level light level (average) for channel warmth + big bloom
  const L = sign.letters.map((le, li) => { let a = 0; le.bulbs.forEach((_, bi) => a += clamp(lit(li, bi, le.gi0 + bi), 0, 1.4)); return le.bulbs.length ? a / le.bulbs.length : 0; });
  if (channel) {
    sign.letters.forEach((le, li) => {
      if (!use(li)) return;
      const lv = clamp(L[li]);
      for (const c of le.chains) {
        const P = toPath(c.map(([a, b]) => [a * s, b * s]));
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = goldGrad(g, le.x * s, 0, (le.x + le.w) * s, sign.h * s, { sheen: .35 }); g.lineWidth = sp * 1.25 * s + rimW * 2; g.stroke(P);
      }
      for (const c of le.chains) {
        const P = toPath(c.map(([a, b]) => [a * s, b * s]));
        g.strokeStyle = mix(enamel, '#5a2a14', lv * .8); g.lineWidth = sp * 1.25 * s; g.stroke(P);
      }
    });
  }
  // bloom
  g.save(); g.globalCompositeOperation = 'lighter';
  sign.letters.forEach((le, li) => {
    if (!use(li)) return;
    const lv = clamp(L[li]) * letterGlow; if (lv <= .01) return;
    const cx = (le.x + le.w / 2) * s, cy = sign.h * .55 * s, R = Math.max(le.w, sign.size) * .9 * s;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R); gr.addColorStop(0, `rgba(${glowRGB},${.22 * lv})`); gr.addColorStop(1, `rgba(${glowRGB},0)`);
    g.fillStyle = gr; g.fillRect(cx - R, cy - R, R * 2, R * 2);
  });
  g.restore();
  // bulbs
  sign.letters.forEach((le, li) => {
    if (!use(li)) return;
    le.bulbs.forEach(([bx, by], bi) => {
      const v = lit(li, bi, le.gi0 + bi), X = bx * s, Y = by * s;
      // socket ring
      g.beginPath(); g.arc(X, Y, br * 1.28, 0, TAU); g.fillStyle = '#2a1d0c'; g.fill();
      g.beginPath(); g.arc(X, Y, br * 1.28, 0, TAU); g.strokeStyle = v > .05 ? C.gold2 : '#7a5e2a'; g.lineWidth = Math.max(1, br * .24); g.stroke();
      if (v <= .02) {
        const gr = g.createRadialGradient(X - br * .35, Y - br * .35, 0, X, Y, br); gr.addColorStop(0, '#4a3a2c'); gr.addColorStop(.5, '#1c1510'); gr.addColorStop(1, '#0b0806');
        g.beginPath(); g.arc(X, Y, br, 0, TAU); g.fillStyle = gr; g.fill();
        g.beginPath(); g.arc(X - br * .35, Y - br * .38, br * .22, 0, TAU); g.fillStyle = 'rgba(255,240,210,.35)'; g.fill();
      } else {
        const vv = clamp(v, 0, 1.6);
        g.save(); g.globalCompositeOperation = 'lighter';
        const hr = br * (3.2 + 1.6 * Math.max(0, vv - 1)) * haloK;
        const gr = g.createRadialGradient(X, Y, 0, X, Y, hr); gr.addColorStop(0, `rgba(${glowRGB},${.55 * Math.min(1, vv)})`); gr.addColorStop(.35, `rgba(${glowRGB},${.16 * Math.min(1, vv)})`); gr.addColorStop(1, `rgba(${glowRGB},0)`);
        g.fillStyle = gr; g.fillRect(X - hr, Y - hr, hr * 2, hr * 2); g.restore();
        const cr = g.createRadialGradient(X, Y, 0, X, Y, br);
        const core = color ? mix(color, '#ffffff', .75) : C.bulbCore, mid = color || C.bulb;
        cr.addColorStop(0, core); cr.addColorStop(.55, mix('#3a2a18', mid, Math.min(1, vv))); cr.addColorStop(1, mix('#1a120a', mix(mid, '#b06a20', .5), Math.min(1, vv)));
        g.beginPath(); g.arc(X, Y, br, 0, TAU); g.fillStyle = cr; g.fill();
      }
    });
  });
  g.restore();
}

// Helpers for lighting patterns
export const litAll = v => () => v;
// letters 0..n-1 switch on in order at times T[i]; bulbs flash (overshoot) then settle; optional chase afterwards.
export function litSequence(t, T, { flash = .18, chaseFrom = Infinity, chaseSpeed = 14, chaseLen = 5, chaseDim = .35 } = {}) {
  return (li, bi, gi) => {
    const t0 = T[li]; if (t0 == null || t < t0) return 0;
    const dt = t - t0; let v = dt < flash ? 1 + .6 * (1 - dt / flash) : 1;
    if (dt < .05) v *= dt / .05 * .7 + .3;
    if (t >= chaseFrom) { const ph = ((gi - (t - chaseFrom) * chaseSpeed) % chaseLen + chaseLen) % chaseLen; v = ph < 1.5 ? 1.25 : 1 - chaseDim; }
    return v;
  };
}
