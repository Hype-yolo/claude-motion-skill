// Painted title + end card
import { Ref, paintRef } from '../engine/plate.js';
import { P, lin, rad } from './common.js';
export function buildTitle() {
  const R = new Ref(1500, 330, 1);
  R.text('The Colour of Rain', 750, 215, 'italic 600 176px "Cormorant Garamond"', lin(0, 60, 0, 240, [[0, '#fff6e2'], [1, '#f2d8a8']]), { dir: 'edge', fallback: 20, maxR: 6, group: 't' });
  const st = paintRef(R, { R: [7, 3.5, 2], T: 10, seed: 21, app: (x, y) => x / 1500 * .9 + (y / 330) * .05 });
  return { strokes: st, ref: R };
}
export function buildEnd() {
  const R = new Ref(1920, 1080, 1);
  R.fill(P([[0, 0], [1920, 0], [1920, 1080], [0, 1080]]), rad(960, 480, 50, 1200, [[0, '#2c3c78'], [.6, '#1c2654'], [1, '#10142e']]), { dir: -8, fallback: -8, group: 'bg', maxR: 40, detail: 1.8 });
  R.text('The Colour of Rain', 960, 470, 'italic 600 150px "Cormorant Garamond"', lin(0, 350, 0, 480, [[0, '#ffe6a8'], [1, '#e8a848']]), { dir: 'edge', fallback: 15, maxR: 6, group: 't' });
  // a single red dab: the umbrella, seen from above
  R.fill(c => c.arc(960, 590, 26, 0, 7), '#dc2f28', { maxR: 5, group: 'u' });
  const st = paintRef(R, { R: [40, 20, 7, 3.5, 2], T: 10, seed: 23, app: (x, y) => x / 1920 * .7 });
  return { strokes: st, ref: R };
}
