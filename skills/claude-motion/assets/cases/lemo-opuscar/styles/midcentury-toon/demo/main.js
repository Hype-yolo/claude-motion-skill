// Page contract: window.READY, window.render(t), window.DUR, window.EV
import { textures } from './engine/toon.js';
const Q = new URLSearchParams(location.search);
const cv = document.getElementById('c'), g = cv.getContext('2d');
await Promise.all(['700 80px Oleo', '400 80px Oleo', '80px Slab', '400 40px Jost', '500 40px Jost', '600 40px Jost', '700 40px Jost'].map(f => document.fonts.load(f)));
textures();
const content = await (await fetch(Q.get('content') || 'content.json')).json();
let durs = {}; if (!Q.get('content') || Q.get('durs')) try { durs = await (await fetch(Q.get('durs') || 'voices/dur.json')).json(); } catch (e) {}
const film = await import('./film.js');
film.setup(content, durs);
window.DUR = film.DUR(); window.EV = film.events(); window.SRT = film.srtCues();
window.render = async t => {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (Q.get('test') === 'sheet') { (await import('./sheet.js')).drawSheet(g, t, content); return; }
  film.renderFilm(g, t, Q);
};
window.READY = true;
