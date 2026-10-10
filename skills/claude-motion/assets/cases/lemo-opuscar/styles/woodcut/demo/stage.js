// The Bell Founder · stage: plate framing, camera, print pass, captions
import * as WC from './engine/index.js';
import { PW, PH } from './world.js';

export const W = 1920, H = 1080;
export const IMG = { x: 36, y: 36, w: 1848, h: 912 };     // printed image area; captions live in the bottom margin
export const [M, m] = WC.canvas(W, H);                     // carve mask
export const [C, c] = WC.canvas(W, H);                     // colour plate (alpha)
let P = null;
export function printer() { return P || (P = WC.makePrinter(W, H)); }

// camera: centre (x,y) in plate coords, zoom z, roll r
export function camMatrix(cam, full = false) {
  const z = cam.z ?? 1, r = cam.r ?? 0, cs = Math.cos(r) * z, sn = Math.sin(r) * z;
  const ox = full ? W / 2 : IMG.x + IMG.w / 2, oy = full ? H / 2 : IMG.y + IMG.h / 2;
  const x = cam.x ?? PW / 2, y = cam.y ?? PH / 2;
  return [cs, sn, -sn, cs, ox - (cs * x - sn * y), oy - (sn * x + cs * y)];
}
// start a frame: paper everywhere, then clip to the image area with the camera applied.
// full = true → full-bleed (the wood block world, no paper margin)
export function begin(cam = {}, { full = false, mirror = false } = {}) {
  m.setTransform(1, 0, 0, 1, 0, 0); c.setTransform(1, 0, 0, 1, 0, 0);
  m.fillStyle = '#fff'; m.fillRect(0, 0, W, H); c.clearRect(0, 0, W, H);
  for (const g of [m, c]) {
    g.save();
    if (!full) { g.beginPath(); g.rect(IMG.x, IMG.y, IMG.w, IMG.h); g.clip(); }
    if (mirror) g.setTransform(-1, 0, 0, 1, W, 0);
    const k = camMatrix(cam, full); g.transform(...k);
  }
  if (!full) { m.fillStyle = '#000'; m.fillRect(-4000, -4000, 12000, 12000); }
}
export function end() { m.restore(); c.restore(); m.setTransform(1, 0, 0, 1, 0, 0); c.setTransform(1, 0, 0, 1, 0, 0); }

// caption in the bottom margin (letterpress): drawn in ink on the mask so it gets printed too
export function caption(text, a = 1) {
  if (!text || a <= 0) return;
  m.save(); m.setTransform(1, 0, 0, 1, 0, 0);
  m.font = '400 44px "IM Fell English"'; m.textAlign = 'center'; m.textBaseline = 'middle';
  m.fillStyle = `rgba(0,0,0,${a})`;
  m.fillText(text, W / 2, IMG.y + IMG.h + (H - IMG.y - IMG.h) / 2 + 2);
  m.restore();
}
export function print(g, o = {}) {
  const out = printer().render(M, C, o);
  g.drawImage(out, 0, 0);
  return out;
}
