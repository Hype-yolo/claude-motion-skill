// copper.js — the plate before it is printed: polished copper with fine polishing scratches and the soft reflection
// of a studio window, the engraved grooves (dark trough, a bright burr on the lip), the burin — mushroom-shaped
// wooden handle, lozenge-section steel shaft, a bevelled lozenge face at the point — held low and pushed forward,
// and the thin spiral of copper it raises ahead of the point, growing as the cut lengthens.
import * as B from './burin.js';
const { clamp, RNG, noise1, noise2 } = B;

let scratchC = null;
function scratches() {                                   // polishing scratches: thousands of hairlines, mostly in swirls
  if (scratchC) return scratchC;
  const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), R = RNG(21);
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, N, N);
  g.lineCap = 'round';
  for (let k = 0; k < 5200; k++) {
    const cx = R() * N, cy = R() * N, rad = 200 + R() * 900, a0 = R() * 6.28, span = (0.02 + R() * 0.08), bright = R() < 0.55;
    g.strokeStyle = bright ? `rgba(255,255,255,${0.05 + R() * 0.12})` : `rgba(0,0,0,${0.04 + R() * 0.1})`; g.lineWidth = 0.4 + R() * 0.7;
    g.beginPath(); g.arc(cx, cy, rad, a0, a0 + span); g.stroke();
  }
  for (let k = 0; k < 900; k++) { const x = R() * N, y = R() * N, a = -0.15 + R() * 0.3, l = 20 + R() * 120; g.strokeStyle = `rgba(255,255,255,${0.04 + R() * 0.08})`; g.lineWidth = 0.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  scratchC = c; return c;
}
// the copper surface over a world rectangle
export function drawCopper(ctx, rect) {
  const [x0, y0, x1, y1] = rect;
  ctx.save();
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#5e2a12'); g.addColorStop(0.4, '#94502c'); g.addColorStop(0.7, '#86441f'); g.addColorStop(1, '#4e220e');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.9;
  const pat = ctx.createPattern(scratches(), 'repeat'); pat.setTransform(new DOMMatrix().scaleSelf(0.35, 0.35));
  ctx.fillStyle = pat; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}
// screen-space reflections: a studio window (softbox with mullions) sliding across as the camera moves, dark room elsewhere
export function copperLight(ctx, W, H, cam) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const ox = -(cam.cx - 960) * 0.45 * cam.z * 0.2, oy = -(cam.cy - 540) * 0.45 * cam.z * 0.2;
  ctx.globalCompositeOperation = 'multiply';                       // the room: dark toward the edges
  const v = ctx.createRadialGradient(W * 0.46 + ox * 0.3, H * 0.4, H * 0.15, W * 0.5, H * 0.5, H * 1.05); v.addColorStop(0, 'rgb(255,250,245)'); v.addColorStop(1, 'rgb(60,26,12)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(W * 0.5 + ox, H * 0.46 + oy); ctx.rotate(-0.22);
  ctx.filter = 'blur(90px)'; ctx.fillStyle = 'rgba(255,190,140,0.45)'; ctx.fillRect(-700, -380, 1400, 760);     // glow of the room
  ctx.filter = 'blur(14px)';                                                                                    // the window: four panes, crisp enough to read as a reflection
  const pane = (x, y) => { const g2 = ctx.createLinearGradient(x, y, x + 300, y + 190); g2.addColorStop(0, 'rgba(255,238,215,0.75)'); g2.addColorStop(1, 'rgba(255,214,176,0.45)'); ctx.fillStyle = g2; ctx.fillRect(x, y, 300, 190); };
  pane(-330, -210); pane(-10, -210); pane(-330, 2); pane(-10, 2);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'overlay'; ctx.setTransform(1, 0, 0, 1, 0, 0); const sp = ctx.createPattern(scratches(), 'repeat'); sp.setTransform(new DOMMatrix().scaleSelf(0.7, 0.7)); ctx.globalAlpha = 0.5; ctx.fillStyle = sp; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
// engraved grooves: shadowed trough, the lit lip with its burr, a glint on the far wall
export function drawGrooves(ctx, ink, t, { zoom = 1, light = [-0.6, -0.8] } = {}) {
  const px = 1 / Math.max(0.5, zoom);
  ink.draw(ctx, t, { color: 'rgba(50,16,4,0.45)', wScale: 1.9, dx: -light[0] * px * 2.5, dy: -light[1] * px * 2.5 });   // shade of the burr on the far side
  ink.draw(ctx, t, { color: 'rgba(255,226,186,1)', wScale: 1.35, dx: light[0] * px * 2.6, dy: light[1] * px * 2.6 });   // the burr: a bright raised lip
  ink.draw(ctx, t, { color: '#240c05', wScale: 1.0 });                                                                      // the trough
  return ink.draw(ctx, t, { color: 'rgba(214,128,78,0.75)', wScale: 0.25, dx: -light[0] * px * 1.4, dy: -light[1] * px * 1.4 }); // far wall catching light
}

// ---------- the burin (screen space) ----------
// tip: [x, y] px; dir: unit direction of the cut; s: scale; lift 0..1 raises it off the plate; skew: the shaft trails the cut at an angle
export function drawBurin(ctx, tip, dir, { s = 1, lift = 0, skew = 0.22 } = {}) {
  // the shaft lies along the direction the point travels, turned only ~13° so the fresh groove stays visible
  const ca = Math.cos(skew), sa = Math.sin(skew), dx = dir[0] * ca - dir[1] * sa, dy = dir[0] * sa + dir[1] * ca, nx = -dy, ny = dx;
  const L = 470 * s, w = 34 * s, bev = 66 * s;
  const P = (d, o = 0) => [tip[0] - dx * d + nx * o, tip[1] - dy * d + ny * o];
  const poly = pts => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); };
  const up = lift * 70 * s;
  ctx.save(); ctx.translate(-up * 0.3, -up);
  // cast shadow: the tool is held low, so the shadow hugs it
  ctx.save(); ctx.translate(18 * s + up * 0.8, 26 * s + up * 1.2); ctx.filter = `blur(${9 * s + up * 0.15}px)`; ctx.fillStyle = 'rgba(30,8,2,0.55)';
  poly([P(4), P(L, w * 0.7), P(L + 330 * s, w * 3.6), P(L + 330 * s, -w * 3.6), P(L, -w * 0.7)]); ctx.fill(); ctx.restore();
  // the shaft: a lozenge section seen from above — two long faces meeting at a sharp ridge
  const faceA = [P(bev, 0), P(bev, w * 0.5), P(L, w * 0.5), P(L, 0)], faceB = [P(bev, 0), P(L, 0), P(L, -w * 0.5), P(bev, -w * 0.5)];
  const grad = (a, b, stops) => { const g = ctx.createLinearGradient(...a, ...b); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
  ctx.fillStyle = grad(P(bev, w * 0.5), P(bev, 0), [[0, '#8e98a2'], [0.6, '#d9e0e6'], [1, '#f4f7f9']]); poly(faceA); ctx.fill();
  ctx.fillStyle = grad(P(bev, 0), P(bev, -w * 0.5), [[0, '#3a4148'], [0.5, '#262b30'], [1, '#4a525a']]); poly(faceB); ctx.fill();
  // the bevelled face at the point: a lozenge, polished flat, catching the window
  const face = [tip, P(bev, w * 0.5), P(bev * 1.18, 0), P(bev, -w * 0.5)];
  ctx.fillStyle = grad(tip, P(bev * 1.18, 0), [[0, '#ffffff'], [0.5, '#e6edf2'], [1, '#aab4bd']]); poly(face); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(...tip); ctx.lineTo(...P(bev, w * 0.5)); ctx.stroke();   // the sharp edges
  ctx.strokeStyle = 'rgba(20,24,28,0.9)'; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(...tip); ctx.lineTo(...P(bev, -w * 0.5)); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(...P(bev * 1.18, 0)); ctx.lineTo(...P(L, 0)); ctx.stroke();   // the ridge highlight
  ctx.strokeStyle = 'rgba(15,18,22,0.85)'; ctx.lineWidth = 1.2 * s; poly([tip, P(bev, w * 0.5), P(L, w * 0.5), P(L, -w * 0.5), P(bev, -w * 0.5)]); ctx.stroke();
  // ferrule
  const fe = [P(L - 6 * s, w * 0.9), P(L + 40 * s, w * 0.95), P(L + 40 * s, -w * 0.95), P(L - 6 * s, -w * 0.9)];
  ctx.fillStyle = grad(P(L, w), P(L, -w), [[0, '#c9a45a'], [0.35, '#f3dd9a'], [0.7, '#8a6a2e'], [1, '#5a4520']]); poly(fe); ctx.fill();
  // the mushroom handle: a turned wooden knob, its flat side toward the plate
  const hc = P(L + 40 * s + 145 * s, 0), ang = Math.atan2(-dy, -dx);
  ctx.save(); ctx.translate(...hc); ctx.rotate(ang);
  const hg = ctx.createRadialGradient(-50 * s, -70 * s, 10 * s, 0, 0, 200 * s); hg.addColorStop(0, '#c98a4e'); hg.addColorStop(0.5, '#8a4f24'); hg.addColorStop(1, '#3e1f0c');
  // mushroom: a neck flaring into a dome, the flat cut on the plate side
  const knob = new Path2D(); knob.moveTo(-150 * s, -26 * s); knob.bezierCurveTo(-110 * s, -30 * s, -80 * s, -118 * s, 10 * s, -120 * s); knob.bezierCurveTo(110 * s, -120 * s, 150 * s, -60 * s, 150 * s, 0); knob.bezierCurveTo(150 * s, 60 * s, 110 * s, 120 * s, 10 * s, 120 * s); knob.bezierCurveTo(-80 * s, 118 * s, -110 * s, 30 * s, -150 * s, 26 * s); knob.closePath();
  ctx.fillStyle = hg; ctx.fill(knob);
  ctx.save(); ctx.clip(knob); ctx.strokeStyle = 'rgba(40,18,6,0.35)'; ctx.lineWidth = 1.4 * s;                               // wood grain
  for (let k = -9; k <= 9; k++) { ctx.beginPath(); for (let i = 0; i <= 40; i++) { const x = -190 * s + i * 9.5 * s, y = k * 17 * s + Math.sin(i * 0.3 + k) * 5 * s + (noise1(i * 0.2 + k * 3, 4) - 0.5) * 8 * s; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
  ctx.fillStyle = 'rgba(40,18,6,0.4)'; ctx.fillRect(-175 * s, 80 * s, 350 * s, 80 * s);                                   // the flat cut
  ctx.restore();
  ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,220,180,0.35)'; ctx.filter = `blur(${10 * s}px)`; ctx.beginPath(); ctx.ellipse(-60 * s, -65 * s, 70 * s, 32 * s, -0.4, 0, Math.PI * 2); ctx.fill();   // varnish highlight
  ctx.filter = 'none'; ctx.restore();
  ctx.restore();
}
// the swarf: a thin, thinning ribbon of copper curling up ahead of the point — irregular turns that open out as it grows,
// an occasional twist; one edge catches the light, the other falls dark, so it reads as sheet metal, not a spring.
// len = screen px of line cut so far
export function drawSwarf(ctx, tip, dir, len, { s = 1, seed = 3 } = {}) {
  if (len < 4) return;
  const [dx, dy] = dir, nx = -dy, ny = dx, L = Math.min(1, len / (520 * s)), N = 160;
  const turns = 0.6 + 2.6 * L, P = [];
  let a = 0;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    a += (turns * Math.PI * 2 / N) * (0.75 + 0.5 * noise1(u * 6 + seed, seed));               // uneven winding
    const r = s * (6 + 44 * Math.pow(u, 0.8) * (0.55 + 0.45 * L)) * (0.85 + 0.3 * noise1(u * 9, seed + 1));   // small at the point, opening out
    const ax = s * (8 + 46 * u * L), rise = r * 0.55;                                          // the coil drifts ahead and lifts
    const cx = tip[0] + dx * (ax + r * Math.sin(a)) + nx * (-r * (1 - Math.cos(a)) * 0.9), cy = tip[1] + dy * (ax + r * Math.sin(a)) + ny * (-r * (1 - Math.cos(a)) * 0.9) - rise * (1 - Math.cos(a)) * 0.5;
    const tw = Math.cos(u * 7 + noise1(u * 3, seed + 2) * 4);                                 // twist: the ribbon turns edge-on now and then
    P.push({ x: cx, y: cy, a, depth: Math.cos(a), w: s * (10 - 6.5 * u) * (0.3 + 0.7 * Math.abs(tw)), flip: tw < 0 });
  }
  // ribbon edges
  for (let i = 0; i <= N; i++) { const p = P[i], q = P[Math.min(N, i + 1)], o = P[Math.max(0, i - 1)], tx = q.x - o.x, ty = q.y - o.y, tl = Math.hypot(tx, ty) || 1; p.nx = -ty / tl; p.ny = tx / tl; }
  ctx.save();
  ctx.fillStyle = 'rgba(30,8,2,0.4)'; ctx.filter = `blur(${3 * s}px)`;                          // shadow on the plate
  ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(p.x + 7 * s, p.y + 11 * s) : ctx.moveTo(p.x + 7 * s, p.y + 11 * s)); ctx.lineWidth = 4 * s; ctx.strokeStyle = 'rgba(30,8,2,0.4)'; ctx.stroke(); ctx.filter = 'none';
  for (const front of [false, true]) for (let i = 0; i < N; i++) {
    const p = P[i], q = P[i + 1]; if ((p.depth > 0) !== front) continue;
    const e = (pt, k) => [pt.x + pt.nx * pt.w * 0.5 * k, pt.y + pt.ny * pt.w * 0.5 * k];
    const face = 0.5 + 0.5 * Math.sin(p.a + 0.8), k = front ? 1 : 0.5;
    ctx.fillStyle = `rgb(${Math.round((150 + 90 * face) * k + 20)},${Math.round((72 + 105 * face) * k + 8)},${Math.round((36 + 80 * face) * k + 4)})`;
    ctx.beginPath(); ctx.moveTo(...e(p, 1)); ctx.lineTo(...e(q, 1)); ctx.lineTo(...e(q, -1)); ctx.lineTo(...e(p, -1)); ctx.closePath(); ctx.fill();
    // one edge bright, one dark (which is which flips where the ribbon twists)
    const lit = p.flip ? -1 : 1;
    ctx.lineWidth = 1.4 * s; ctx.strokeStyle = front ? 'rgba(255,238,210,0.95)' : 'rgba(230,170,120,0.6)'; ctx.beginPath(); ctx.moveTo(...e(p, lit)); ctx.lineTo(...e(q, lit)); ctx.stroke();
    ctx.lineWidth = 1.2 * s; ctx.strokeStyle = 'rgba(40,12,4,0.9)'; ctx.beginPath(); ctx.moveTo(...e(p, -lit)); ctx.lineTo(...e(q, -lit)); ctx.stroke();
  }
  ctx.restore();
}
