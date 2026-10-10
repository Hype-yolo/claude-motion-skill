// Frame pipeline: scene → 4:3 film canvas → FilmPost (tone + ageing) → damage overlay → gate on the 16:9 frame.
import { FilmPost, damage } from './engine/film.js';
import { theatre } from './engine/cards.js';
import { setFrame } from './engine/ink.js';
export const FW = 1440, FH = 1080, GATE = { x: 240, y: 0, w: 1440, h: 1080 };
export const fc = document.createElement('canvas'); fc.width = FW; fc.height = FH;
export const fg = fc.getContext('2d');
export const post = new FilmPost(FW, FH);
const outc = document.createElement('canvas'); outc.width = FW; outc.height = FH; const og = outc.getContext('2d');

// shoot: draw(fg) the scene, then develop it. fp = film params. returns the developed 4:3 canvas
export function shoot(draw, fp = {}, t = 0) {
  fg.setTransform(1, 0, 0, 1, 0, 0); fg.globalAlpha = 1; fg.globalCompositeOperation = 'source-over';
  fg.fillStyle = '#fff'; fg.fillRect(0, 0, FW, FH);
  setFrame(t, { boil: fp.boil ?? 1 });
  draw(fg);
  const dev = post.render(fc, fp, fp.colorMask || null);
  og.setTransform(1, 0, 0, 1, 0, 0); og.drawImage(dev, 0, 0);
  if ((fp.strength ?? .6) > 0.01) damage(og, 0, 0, FW, FH, fp.frame ?? 0, fp.strength ?? .6, fp);
  return outc;
}
// place the developed frame in the gate with the dark theatre around
export function gate(g, dev, spill = post.mean, curtain = 1) {
  theatre(g, 1920, 1080, GATE, spill, curtain);
  g.save();
  const r = 22; g.beginPath(); g.roundRect(GATE.x, GATE.y, GATE.w, GATE.h, r); g.clip();
  g.drawImage(dev, GATE.x, GATE.y);
  // aperture edge: soft dark rim (the gate mask is slightly out of focus)
  const e = g.createLinearGradient(GATE.x, 0, GATE.x + 18, 0); e.addColorStop(0, 'rgba(0,0,0,.85)'); e.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = e; g.fillRect(GATE.x, 0, 18, 1080);
  const e2 = g.createLinearGradient(GATE.x + GATE.w, 0, GATE.x + GATE.w - 18, 0); e2.addColorStop(0, 'rgba(0,0,0,.85)'); e2.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = e2; g.fillRect(GATE.x + GATE.w - 18, 0, 18, 1080);
  g.restore();
}
