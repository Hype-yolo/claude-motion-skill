// wash.js — hand colouring, the way plates were coloured after printing: transparent watercolour laid region by
// region, blooming out from where the brush touched. Each region is painted once into its own cached sheet:
//   · the colour spills a few px past the engraved line and sits a little off register (the colourist worked fast);
//   · the pigment is uneven — lighter and heavier patches from a low-frequency density field;
//   · it pools into a darker tide-line at the edge of the wet area (the "water mark" edge);
//   · a backrun or two (cauliflower bloom) in large regions;
//   · granulation: pigment settles into the valleys of the paper, so the paper's tooth shows through.
// It is an independent layer: draw it between the paper and the ink (multiply), or leave it out entirely.
//   const w = new Wash({ scale: 1.5 });
//   w.add({ path, polys, color: '#d9962a', origin: [x, y], t0: 26.3, dur: 1.4 });
//   w.draw(ctx, t);
import * as B from './burin.js';
const { clamp, noise1, noise2, RNG, bboxOf } = B;

const hex = c => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = ([r, g, b], a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

function densityTex(W, H, seed) {                     // low-frequency density field, alpha = how much pigment to lift
  const c = document.createElement('canvas'); c.width = Math.ceil(W / 4); c.height = Math.ceil(H / 4); const g = c.getContext('2d'), im = g.createImageData(c.width, c.height);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const n = noise2(x / 22, y / 22, seed) * 0.6 + noise2(x / 7, y / 7, seed + 1) * 0.4;
    const i = (y * c.width + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 0; im.data[i + 3] = Math.max(0, (n - 0.35)) * 255 * 0.75;
  }
  g.putImageData(im, 0, 0); return c;
}
let grainC = null;
function grainTex() {                                   // paper tooth: speckles where pigment does not settle
  if (grainC) return grainC;
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), im = g.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) { const n = noise2(x / 1.6, y / 1.6, 3) * 0.6 + noise2(x / 5, y / 5, 4) * 0.4; const i = (y * 512 + x) * 4; im.data[i + 3] = Math.max(0, n - 0.48) * 255 * 1.6; }
  g.putImageData(im, 0, 0); grainC = c; return c;
}

export class Wash {
  // scale: cache resolution (canvas px per world unit)
  constructor({ scale = 1.5 } = {}) { this.items = []; this.k = scale; }
  add({ path, polys, color, alpha = 0.62, origin = null, t0 = 0, dur = 1.2, spill = 3.5, offset = [2, 1.5], seed = 1, pool = 0.5, lift = 0.6, backruns = null }) {
    const bb = bboxOf(polys), o = origin || [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2];
    const far = Math.max(...[[bb[0], bb[1]], [bb[2], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]]].map(([x, y]) => Math.hypot(x - o[0], y - o[1]))) + spill * 3;
    const it = { path, polys, color, alpha, o, far, t0, dur, spill, offset, seed, pool, lift, bb, cache: null };
    it.backruns = backruns ?? ((bb[2] - bb[0]) * (bb[3] - bb[1]) > 12000 ? 2 : 0);
    this.items.push(it); return this;
  }
  _paint(it) {
    const k = this.k, pad = it.spill * 2 + 12, x0 = it.bb[0] - pad, y0 = it.bb[1] - pad, W = Math.ceil((it.bb[2] - it.bb[0] + 2 * pad) * k), H = Math.ceil((it.bb[3] - it.bb[1] + 2 * pad) * k);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const col = hex(it.color), dark = col.map(v => v * 0.62);
    const toLocal = ctx => { ctx.setTransform(k, 0, 0, k, (-x0 + it.offset[0]) * k, (-y0 + it.offset[1]) * k); };
    // 1. the body of the wash, spilling past the line
    toLocal(g); g.fillStyle = rgba(col); g.strokeStyle = rgba(col); g.lineJoin = 'round';
    g.globalAlpha = 1; g.fill(it.path); g.lineWidth = it.spill * 2; g.stroke(it.path);
    // 2. uneven pigment: lift some of it away in soft patches
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = it.lift; g.imageSmoothingEnabled = true;
    g.drawImage(densityTex(W, H, it.seed * 7 + 1), 0, 0, W, H);
    // 3. backruns: a pale bloom with a darker rim where wet paint crept back into drying paint
    const R = RNG(it.seed * 31 + 5);
    for (let b = 0; b < it.backruns; b++) {
      let bx, by, tries = 0; do { bx = it.bb[0] + R() * (it.bb[2] - it.bb[0]); by = it.bb[1] + R() * (it.bb[3] - it.bb[1]); } while (!B.inPoly(it.polys, bx, by) && ++tries < 40);
      const r = Math.min(it.bb[2] - it.bb[0], it.bb[3] - it.bb[1]) * (0.12 + R() * 0.12), blob = new Path2D();
      for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, rr = r * (0.75 + 0.5 * noise1(a * 3 + b * 9, it.seed + b)); const x = bx + Math.cos(a) * rr, y = by + Math.sin(a) * rr; i ? blob.lineTo(x, y) : blob.moveTo(x, y); }
      toLocal(g); g.save(); g.clip(it.path); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 0.35; g.fillStyle = '#000'; g.fill(blob);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.45; g.strokeStyle = rgba(dark); g.lineWidth = 1.6; g.stroke(blob); g.restore();
    }
    // 4. the tide-line: pigment pooled at the outer edge of the wet area
    const E = document.createElement('canvas'); E.width = W; E.height = H; const e = E.getContext('2d');
    toLocal(e); e.lineJoin = 'round'; e.strokeStyle = rgba(dark); e.lineWidth = it.spill * 2 + 3.2; e.stroke(it.path);
    e.globalCompositeOperation = 'destination-out'; e.lineWidth = Math.max(0.5, it.spill * 2 - 1.6); e.stroke(it.path); e.fill(it.path);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = it.pool; g.filter = 'blur(0.8px)'; g.drawImage(E, 0, 0); g.filter = 'none';
    // a softer inner pooling just inside the line
    toLocal(g); g.save(); g.clip(it.path); g.globalAlpha = it.pool * 0.35; g.strokeStyle = rgba(dark); g.lineWidth = 6; g.filter = 'blur(2px)'; g.stroke(it.path); g.restore(); g.filter = 'none';
    // 5. granulation: the paper's tooth
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 0.55;
    const pat = g.createPattern(grainTex(), 'repeat'); g.fillStyle = pat; g.fillRect(0, 0, W, H);
    it.cache = { c, x0: x0, y0: y0, w: W / k, h: H / k };
  }
  draw(ctx, t, { k = 1 } = {}) {
    for (const it of this.items) {
      const p = clamp((t - it.t0) / it.dur); if (p <= 0) continue;
      if (!it.cache) this._paint(it);
      const e = 1 - Math.pow(1 - p, 2.2), R = it.far * e * 1.08;
      const ring = (ctx2, dx = 0, dy = 0) => { ctx2.beginPath(); for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2, rr = R * (0.86 + 0.28 * noise1(a * 2.2 + it.seed * 7, it.seed) + 0.06 * noise1(a * 9, it.seed + 3)); const x = it.o[0] + dx + Math.cos(a) * rr, y = it.o[1] + dy + Math.sin(a) * rr; i ? ctx2.lineTo(x, y) : ctx2.moveTo(x, y); } ctx2.closePath(); };
      ctx.save();
      if (p < 1) { ring(ctx); ctx.clip(); }
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = it.alpha * k;
      ctx.drawImage(it.cache.c, it.cache.x0, it.cache.y0, it.cache.w, it.cache.h);
      ctx.restore();
      // the wet front travelling with the bloom
      if (p < 1 && p > 0.02) {
        ctx.save(); ctx.translate(it.offset[0], it.offset[1]); ctx.clip(it.path); ctx.translate(-it.offset[0], -it.offset[1]);
        ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35 * (1 - p) * k; ctx.strokeStyle = it.color; ctx.lineWidth = 5;
        ring(ctx, it.offset[0], it.offset[1]); ctx.stroke(); ctx.restore();
      }
    }
  }
}
