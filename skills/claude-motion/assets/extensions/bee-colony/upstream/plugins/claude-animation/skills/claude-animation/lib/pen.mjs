// pen.mjs — the hand: brush ink, pencil, watercolour, lettering. Every mark has a STABLE seed taken
// from a name, never from the frame, so a held drawing keeps its marks. Boil (the redrawn-every-few-
// frames wobble) is opt-in per drawing: pen.begin(name, reveal, { boil: 10 }) — decide it on purpose.
//
//   const pen = new Pen(ctx);
//   pen.begin("hero/body", reveal);        // reveal 0..1 draws the marks on in order
//   pen.stroke(points, { w: 5 });          // tapered brush line, drawn on by a round nib
//   pen.wash(points, "#7DB26A");           // watercolour that blooms from a point
//   pen.pencil(points, { w: 1.6 });        // 3 thin broken passes, gaps where pressure is low
//   pen.box(x, y, w, h);                   // corners drawn edge by edge with overshoot
import { clamp, lerp, hash, noise1, catmull, densify, centroid, eOut, eBack, grainCanvas, INK, Path2D } from "./core.mjs";

const idHash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) % 100000; };

export class Pen {
  constructor(ctx) { this.ctx = ctx; this.grain = ctx.createPattern(grainCanvas(256, 70, 11), "repeat"); this.rv = 1; this.Wt = 1; this.c = 0; this.seed = 1; this.boilIx = 0; this.act = 0; this.weights = new Map(); }
  // start a named drawing. reveal: 0..1 progress of drawing it on. opts.boil: redraws per second (0 = still)
  begin(name, reveal = 1, opts = {}) {
    this.name = name; this.seed = idHash(name); this.rv = clamp(reveal); this.c = 0;
    this.Wt = this.weights.get(name) || 1; this.boilIx = opts.boil ? Math.floor((opts.t ?? 0) * opts.boil) : 0; this.jitAmp = opts.jitter ?? 1;
    return this;
  }
  // call after drawing the full drawing once (reveal 1) so reveal knows how many marks there are
  end() { if (this.rv >= 1) this.weights.set(this.name, Math.max(this.c, .5)); }
  next(wt = 1) {
    const OV = 1.6, c = this.c; this.c += wt; if (this.rv >= 1) return 1;
    const r = clamp((this.rv * (this.Wt + OV) - c) / (OV * wt)); if (r > 0 && r < 1) this.act += Math.min(wt, 1.5); return r;
  }
  J(i, amp) { return (hash(this.seed * 91.7 + this.boilIx * 13.37 + i * 7.13) - .5) * 2 * amp * this.jitAmp; }

  // tapered, pressure-wobbled brush line
  stroke(pts, o = {}) {
    const r = this.next(o.wt ?? 1); if (r <= 0 || pts.length < 2) return;
    const { w = 5, color = INK, taper = .75, jit = 1.4, closed = false, alpha = 1, smooth = true, cap = true } = o;
    const k0 = this.c * 31 + this.seed;
    let P = pts.map(([x, y], i) => [x + this.J(k0 + i * 2, jit), y + this.J(k0 + i * 2 + 1, jit)]);
    if (closed) P = [...P, P[0]];
    const D = smooth && P.length > 2 ? catmull(P, false) : densify(P);
    const cum = [0]; for (let i = 1; i < D.length; i++) cum.push(cum[i - 1] + Math.hypot(D[i][0] - D[i - 1][0], D[i][1] - D[i - 1][1]));
    const L = cum[cum.length - 1] || 1, Lr = r * L;
    const wAt = (s) => { const u = s / L, e = (u < .14 ? u / .14 : 1) * (u > .84 ? (1 - u) / .16 : 1); return w * (1 - taper + taper * e) * (1 + .14 * noise1(s * .025 + k0)); };
    const Lp = [], Rp = []; let tip = null, tw = w;
    for (let i = 0; i < D.length; i++) {
      let [x, y] = D[i], s = cum[i];
      if (s > Lr) { if (i === 0) break; const k = (Lr - cum[i - 1]) / ((s - cum[i - 1]) || 1); x = lerp(D[i - 1][0], x, k); y = lerp(D[i - 1][1], y, k); s = Lr; }
      const a = D[Math.max(0, i - 1)], b = D[Math.min(D.length - 1, i + 1)]; let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const ww = wAt(s) / 2; Lp.push([x + nx * ww, y + ny * ww]); Rp.push([x - nx * ww, y - ny * ww]); tip = [x, y]; tw = ww; if (s >= Lr) break;
    }
    if (!tip) return;
    const ctx = this.ctx; ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(Lp[0][0], Lp[0][1]); for (const q of Lp) ctx.lineTo(q[0], q[1]); for (let i = Rp.length - 1; i >= 0; i--) ctx.lineTo(Rp[i][0], Rp[i][1]); ctx.closePath(); ctx.fill();
    if (cap) { ctx.beginPath(); ctx.arc(tip[0], tip[1], Math.max(tw, r < 1 ? w * .45 : 0), 0, Math.PI * 2); ctx.fill(); }   // the nib
    ctx.restore();
  }
  // graphite: three thin offset passes, broken where "pressure" (noise) is low. No solid ribbon under it.
  pencil(pts, o = {}) {
    const { w = 1.5, color = "#3A3430", passes = 3, alpha = .8 } = o; const r = this.next(o.wt ?? 1); if (r <= 0) return;
    const D = catmull(pts, false, 3), n = Math.max(2, Math.floor(D.length * r)), ctx = this.ctx; ctx.save(); ctx.strokeStyle = color; ctx.lineCap = "round";
    for (let p = 0; p < passes; p++) { const off = (p - 1) * w * .6; ctx.lineWidth = w * (p === 1 ? 1 : .6); ctx.beginPath(); let down = false;
      for (let i = 0; i < n; i++) { const pres = noise1(i * .09 + p * 7.3 + this.seed); if (pres < -.55) { down = false; continue; }
        ctx.globalAlpha = alpha * (.55 + .45 * (pres + 1) / 2); const x = D[i][0] + this.J(i * 3 + p, .6) + off * .3, y = D[i][1] + this.J(i * 3 + p + 1, .6) + off;
        down ? ctx.lineTo(x, y) : ctx.moveTo(x, y); down = true; }
      ctx.stroke(); }
    ctx.restore();
  }
  // a hand-drawn ellipse: starts at a random angle, overshoots its own start
  ring(cx, cy, rx, ry, o = {}) {
    const a0 = o.a0 ?? (-2.3 + hash(this.seed + this.c) * .8), n = Math.max(12, Math.round((rx + ry) / 7)), over = o.over ?? 1.07, pts = [];
    for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI * 2 * over, q = 1 + .025 * Math.sin(a * 3 + this.seed); pts.push([cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q]); }
    this.stroke(pts, { taper: .5, ...o });
  }
  // a box drawn edge by edge, each edge overshooting the corner a little — reads as a human pencil box
  box(x, y, w, h, o = {}) {
    const ov = o.over ?? 8, C = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    for (let i = 0; i < 4; i++) { const a = C[i], b = C[(i + 1) % 4], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      this.stroke([[a[0] - dx / l * ov * hash(this.seed + i), a[1] - dy / l * ov * hash(this.seed + i)], [b[0] + dx / l * ov * hash(this.seed + i + 9), b[1] + dy / l * ov * hash(this.seed + i + 9)]], { smooth: false, taper: .5, ...o, wt: (o.wt ?? 1) / 4 }); }
  }
  // watercolour: blooms outward from (ox, oy), three offset translucent passes multiplied, pooled edge, paper grain
  wash(pts, color, o = {}) {
    const r = this.next(o.wt ?? .8); if (r <= 0) return;
    const { alpha = .8, ox, oy, solid = false, over = false } = o;
    const sharp = o.sharp ?? (pts.length <= 6 && !o.round), ctx = this.ctx;
    const p = new Path2D(); const D = sharp ? pts : catmull(pts, true); D.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath();
    ctx.save();
    if (r < 1) { const [cx, cy] = ox != null ? [ox, oy] : centroid(pts); let R = 0; for (const q of pts) R = Math.max(R, Math.hypot(q[0] - cx, q[1] - cy)); R *= 1.12 * eOut(r);
      const b = new Path2D(); for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2, rr = R * (1 + .16 * noise1(a * 2.2 + this.seed + this.c)); i ? b.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : b.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      b.closePath(); ctx.clip(b); }
    ctx.globalCompositeOperation = over ? "source-over" : "multiply"; ctx.fillStyle = color;
    if (solid) { ctx.globalAlpha *= alpha; ctx.fill(p); }
    else { const a0 = ctx.globalAlpha, base = this.seed * 7 + this.c * 13;
      for (let k = 0; k < 3; k++) { ctx.save(); ctx.translate((hash(base + k * 3) - .5) * 7, (hash(base + k * 5 + 1) - .5) * 7); ctx.globalAlpha = a0 * alpha * .45; ctx.fill(p); ctx.restore(); }
      ctx.globalAlpha = a0 * alpha * .35; ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke(p);
      ctx.globalAlpha = a0 * .55; ctx.save(); ctx.clip(p); ctx.fillStyle = this.grain; ctx.fillRect(-4000, -4000, 8000, 8000); ctx.restore(); }
    ctx.restore();
  }
  // lettering that writes itself left to right
  text(str, x, y, o = {}) {
    const r = this.next(o.wt ?? 2); if (r <= 0) return;
    const { size = 44, font = "sans-serif", color = INK, align = "center", rot = 0, alpha = 1 } = o, ctx = this.ctx; ctx.save(); ctx.font = `${size}px "${font}"`;
    const w = ctx.measureText(str).width, x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    ctx.translate(x0 + this.J(this.c * 3, .9), y + this.J(this.c * 3 + 1, .9)); ctx.rotate(rot + this.J(this.c * 3 + 2, .006));
    if (r < 1) { ctx.beginPath(); ctx.rect(-10, -size * 1.3, (w + 20) * r, size * 2); ctx.clip(); }
    ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.fillText(str, 0, 0); ctx.restore();
  }
  dot(x, y, rr, color = INK, wt = .3) { const r = this.next(wt); if (r <= 0) return; const c = this.ctx; c.fillStyle = color; c.beginPath(); c.arc(x + this.J(this.c, .6), y + this.J(this.c + 1, .6), rr * eBack(r), 0, Math.PI * 2); c.fill(); }
  poly(pts, o) { this.stroke(pts, { closed: true, smooth: false, taper: .35, ...o }); }
  blob(pts, o) { this.stroke(pts, { closed: true, taper: .4, ...o }); }
}
