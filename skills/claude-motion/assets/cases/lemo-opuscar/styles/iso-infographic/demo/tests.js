import { PAL } from './engine.js';
import * as H from './hero.js';
import { Iso, shape, sparkPath, cursorPath, tri, pin, ring } from './engine.js';
export function hero(g, t, Q) {
  const end = Q.get('end') === '1', k = 620, ax = 960, ay = 560;
  g.fillStyle = end ? '#B98A5E' : '#7BA75F'; g.fillRect(0, 0, 1920, 1080);
  g.save(); g.translate(ax, ay); g.scale(k, k);
  if (!end) { H.branch(g, { picked: [0, -0.5], attached: false }); H.palm(g, { skin: '#9C6644', sleeve: PAL.red[1], inside: (gg) => H.cherry(gg, 0.02, -0.02, .12) }); }
  else { H.palm(g, { skin: '#E8B894', sleeve: '#3C7FB1', inside: (gg) => H.cup(gg, t) }); }
  g.restore();
  H.kmTag(g, ax + 0.02 * k + 40, ay - 0.1 * k, end ? '11,000 km' : '0 km', 1);
}
// engine demo: any 2D outline → an isometric solid in this style; plus the one-colour hook
export function spark(g, t, Q) {
  g.fillStyle = PAL.bg; g.fillRect(0, 0, 1920, 1080);
  const iso = new Iso(g); iso.cam = { x: 0, y: 0, z: 2.5, k: 70 };
  iso.box(-6, -6, -1, 12, 12, 1, PAL.cream);                                   // a plinth
  for (let i = 0; i < 5; i++) iso.box(-5 + i * 2.2, 3.2, 0, 1.6, 1.6, .6 + i * .5, PAL.blue);
  iso.keep = true;
  shape(iso, sparkPath(4, 2.2, .22), [-1, -1, 5], { color: '#D97757', depth: .9, plane: 'xz' });
  shape(iso, cursorPath(2.4, .45, 2.7, 0), [-1, -1, 5], { color: '#D97757', depth: .9, plane: 'xz', bias: .01 });
  iso.keep = false;
  iso.desat = Q.get('desat') ? 1 : 0; iso.flush();
  pin(iso, 0, -1, 7.6, { title: 'ANY SHAPE', num: '#D97757', dir: 1, up: 90, a: 1 });
}
