import { P, K, setCtx, outlined } from './toon.js';
import { drawDot, drawTick } from './chars.js';
const Q = new URLSearchParams(location.search);
const cv = document.getElementById('c'), g = cv.getContext('2d');
setCtx(g);
await Promise.all(['80px Titan', '40px Lilita', '40px VT', '40px Arch', '40px Gochi', '400 40px Silk', '700 40px Silk', '400 40px Inter', '700 40px Inter', '900 40px Inter'].map(f => document.fonts.load(f)));
const mods = {};
const film = await import('./film.js');
const lines = await (await fetch('lines.json')).json();
const durs = await (await fetch('voices/dur.json')).json();
film.setLines(lines, durs);
window.EV = film.events(); window.SUBS = film.subs(); window.SRT = film.srtCues();
window.render = async t => {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const test = Q.get('test');
  if (test === 'chars') {
    g.fillStyle = '#efe6ff'; g.fillRect(0, 0, 1920, 1080);
    const views = ['front', 'q', 'side', 'back'];
    views.forEach((v, i) => drawDot(140 + i * 200, 470, 1.25, { view: v, face: 'neutral' }));
    ['determined', 'ah', 'sneeze', 'panic', 'proud'].forEach((f, i) => drawDot(140 + i * 170, 1020, 1.1, { view: 'front', face: f }));
    views.forEach((v, i) => drawTick(1000 + i * 240, 520, 1.0, { view: v, face: 'grin' }));
    ['shout', 'facepalm', 'serious', 'sly'].forEach((f, i) => drawTick(1000 + i * 240, 1060, .95, { view: 'front', face: f, pose: f === 'shout' ? 'shout' : f === 'facepalm' ? 'facepalm' : 'idle' }));
    return;
  }
  if (test === 'fonts') {
    g.fillStyle = P.mag; g.fillRect(0, 0, 1920, 1080);
    ['Titan'].forEach((f, i) => {
      g.save(); g.translate(60, 150 + i * 170); g.rotate(-.1 * 0); g.transform(1, 0, -.12, 1, 0, 0);
      outlined(g, "DON'T SNEEZE! " + f, 0, 0, { font: `120px ${f}`, align: 'left', lw: 18, shadow: P.gold, sd: [0, 12] });
      g.restore();
    });
    return;
  }
  if (Q.has('scene')) {
    const [file, fn] = Q.get('scene').split('.');
    const m = mods[file] || (mods[file] = await import('./' + file + '.js'));
    g.fillStyle = '#fff'; g.fillRect(0, 0, 1920, 1080);
    m[fn](g, t, Object.fromEntries(Q)); return;
  }
  film.renderFilm(g, t, Q);
  if (Q.has('poster')) posterOverlay(g);
};
function posterOverlay(g) {
  g.save(); g.fillStyle = 'rgba(20,6,50,.35)'; g.fillRect(0, 0, 1920, 180);
  outlined(g, 'FIVE-SECOND ASTRONAUT', 960, 120, { font: '96px Titan', lw: 14, fill: P.gold, shadow: P.mag, sd: [6, 10] });
  g.restore();
}
window.DUR = film.DUR;
window.READY = true;
