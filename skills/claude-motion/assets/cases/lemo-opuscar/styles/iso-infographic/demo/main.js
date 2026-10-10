import { Iso, PAL } from './engine.js';
const Q = new URLSearchParams(location.search);
const cv = document.getElementById('c'), g = cv.getContext('2d');
for (const w of [300, 400, 500, 600, 700]) await document.fonts.load(`${w} 40px Jost`);
const film = await import('./film.js');
window.DUR = film.DUR; window.EV = film.events();
window.render = async t => {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (Q.has('test')) { const m = await import('./tests.js'); m[Q.get('test')](g, t, Q); return; }
  film.render(g, t, Q);
};
window.READY = true;
