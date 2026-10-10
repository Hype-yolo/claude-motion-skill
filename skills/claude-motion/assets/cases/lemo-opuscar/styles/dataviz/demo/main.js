import { renderFilm, setData, setCaptions, subs, buildEvents, DUR } from './film.js';
const cv = document.getElementById('c'), g = cv.getContext('2d');
await Promise.all(['400 40px Newsreader', '500 40px Newsreader', '500 40px Caveat', '400 20px "IBM Plex Mono"', '500 20px "IBM Plex Mono"'].map(f => document.fonts.load(f)));
setData(await (await fetch('data/jja.json')).json());
const lines = await (await fetch('lines.json')).json();
const get = async u => { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch { return null; } };
setCaptions(lines, await get('voices/dur.json'), await get('voices/words_rel.json'));
window.DUR = DUR;
window.EV = buildEvents();
window.SUBS = subs();
const Q = new URLSearchParams(location.search);
import * as E from './engine.js';
window.render = Q.has('engine') ? () => engineDemo(g) : t => renderFilm(g, t, { nosub: Q.has('nosub') });
// ?engine=1 : the engine drawing an arbitrary shape (a #D97757 four-point spark with a cursor tail) three ways
function engineDemo(g) {
  const cam = { x: 0, y: 0, zoom: 1, roll: 0 };
  E.drawPaper(g, cam); E.applyCam(g, cam);
  const ACC = '#D97757';
  E.setType(g, 'engine.js — any shape, in this style', -860, -440, { size: 22, color: E.P.ink });
  // 1. ink shape: accent fill + hatching + pencil outline, with a dot trail (cursor tail) and an annotation
  const s1 = E.sparklePath(-560, -40, 150);
  E.dotTrail(g, Array.from({ length: 9 }, (_, i) => [-860 + i * 26, 130 - i * 14]), { color: ACC, r0: 9, r1: 2 });
  E.inkShape(g, s1, { fill: ACC });
  E.leader(g, [-450, -240], [-520, -150], { color: E.P.blue }); E.handText(g, 'the spark, in pencil', -440, -250, { size: 34, color: E.P.blue });
  // 2. the same path plotted as data: dots coloured by the ramp, one accent dot
  const s2 = E.sparklePath(0, -40, 150);
  E.plotShape(g, s2, { n: 33, r: 7, values: Array.from({ length: 33 }, (_, i) => -0.4 + i / 32 * 1.6) });
  E.dataDot(g, 0, -40, 11, ACC, { ripple: 0 }); E.handText(g, 'as a data series', -90, 190, { size: 34, color: E.P.blue });
  // 3. the path filled with warming stripes (real JJA values 1926–2026 would go here; a ramp stands in)
  const s3 = E.sparklePath(560, -40, 150);
  E.stripesFill(g, s3, Array.from({ length: 40 }, (_, i) => -0.4 + i / 39 * 1.7));
  E.handText(g, 'filled with stripes', 470, 190, { size: 34, color: E.P.red });
}
window.READY = true;
