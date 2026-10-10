// The Bell Founder · paper transitions: a sheet with weight that curls off a surface (page curl on a cylinder)
import { clamp } from '/core/lib.js';
const W = 1920, H = 1080, PI = Math.PI;

// Draw a sheet lying on the frame whose free (right) edge has been peeled back to the fold line xf, rolling
// over a cylinder of radius r and lying flipped (underside up) to the left of the fold.
//  up   : the face that is up while the sheet lies flat (canvas W×H)
//  down : the underside (canvas W×H, as it reads once turned over a vertical axis)
//  offX : horizontal camera offset (world→screen), F: perspective distance (px) — lifted paper grows toward camera
export function curl(g, up, down, xf, r, { offX = 0, F = 2400, step = 3, shadow = .38 } = {}) {
  r = Math.max(.5, r);
  const cx = W / 2, cy = H / 2;
  const P = z => F / (F - z);
  const place = d => d < PI * r ? [xf + r * Math.sin(d / r), r * (1 - Math.cos(d / r))] : [xf - (d - PI * r), 2 * r];
  // flat part (still lying)
  const xa = clamp(xf, 0, W);
  if (xa > 0) g.drawImage(up, 0, 0, xa, H, offX, 0, xa, H);
  // cast shadow of the curl onto whatever is under it (to the right of the roll)
  const xr = xf + r + offX;
  if (xf < W) {
    const gr = g.createLinearGradient(xr, 0, xr + 70 + r * .8, 0);
    gr.addColorStop(0, `rgba(0,0,0,${shadow})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(Math.max(xa + offX, xr - 4), 0, 90 + r, H);
  }
  const rising = [], top = [], flipped = [];
  for (let x = Math.max(0, Math.floor(xf)); x < W; x += step) {
    const d0 = x - xf, d1 = d0 + step, dm = (d0 + d1) / 2;
    if (d1 <= 0) continue;
    const [X0, z0] = place(Math.max(0, d0)), [X1, z1] = place(d1);
    const s = { x, X0, X1, z: (z0 + z1) / 2, dm };
    if (dm < PI * r * .5) rising.push(s); else if (dm < PI * r) top.push(s); else flipped.push(s);
  }
  const drawStrip = (s, face) => {
    const k = P(s.z), a = Math.min(s.X0, s.X1) + offX, b = Math.max(s.X0, s.X1) + offX;
    const x0 = cx + (a - cx) * k, x1 = cx + (b - cx) * k + .8, y0 = cy - cy * k, h = H * k;
    const src = face === 'up' ? up : down, sx = face === 'up' ? s.x : W - s.x - step;
    if (x1 - x0 < .2) return;
    g.drawImage(src, Math.max(0, sx), 0, step, H, x0, y0, x1 - x0, h);
    const th = s.dm < PI * r ? s.dm / r : PI;                           // surface angle
    const lum = face === 'up' ? Math.cos(th) : -Math.cos(th);           // how much the face looks at the camera
    const dark = clamp(.75 * (1 - lum) ** 1.3 + (face === 'up' ? .08 : 0), 0, .8);
    if (dark > .01) { g.fillStyle = `rgba(20,14,8,${dark})`; g.fillRect(x0, y0, x1 - x0, h); }
  };
  for (const s of rising) drawStrip(s, 'up');
  // shadow of the flipped leaf onto the flat sheet, at its left edge
  if (flipped.length) {
    const l = flipped[flipped.length - 1], k = P(2 * r), xl = cx + (Math.min(l.X0, l.X1) + offX - cx) * k;
    const gr = g.createLinearGradient(xl, 0, xl - 50, 0); gr.addColorStop(0, 'rgba(0,0,0,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(xl - 50, 0, 50, H);
  }
  for (const s of flipped) drawStrip(s, 'down');
  for (const s of top) drawStrip(s, 'down');
  // bright rim where the roll turns over
  if (xf < W && r > 2) {
    const k = P(r), xe = cx + (xf + r + offX - cx) * k;
    g.fillStyle = 'rgba(255,250,235,.35)'; g.fillRect(xe - 2.5, cy - cy * k, 2.5, H * k);
  }
}

// a page with weight: slow unstick, a big soft roll in the middle, a flop at the end
export function peelState(u, rmax = 150) {
  u = clamp(u);
  const e = u < .22 ? .12 * (u / .22) ** 2 : .12 + .88 * (1 - Math.pow(1 - (u - .22) / .78, 2.2));
  const xf = W * (1 - e) - (u > .9 ? (u - .9) / .1 * 12 : 0);
  const r = 4 + rmax * Math.pow(Math.sin(PI * Math.min(1, u * 1.05)), .7);
  return { xf, r };
}
