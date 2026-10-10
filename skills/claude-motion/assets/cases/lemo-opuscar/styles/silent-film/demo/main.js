// The Runaway Loaf — page entry. window.render(t) draws frame t; ?scene=file.fn renders a test/sheet scene.
import { FilmPost, damage } from './engine/film.js';
import { setFrame } from './engine/ink.js';
const Q = new URLSearchParams(location.search);
const cv = document.getElementById('c'), g = cv.getContext('2d');
await Promise.all(['400 40px "Old Standard TT"', 'italic 400 40px "Old Standard TT"', '700 40px "Old Standard TT"', '900 40px "Playfair Display SC"', '700 40px "Playfair Display SC"', '400 40px "Playfair Display"', 'italic 700 40px "Playfair Display"'].map(f => document.fonts.load(f)));
const mods = {};
const film = await import('./film.js');
window.EV = film.events ? film.events() : [];
window.render = async t => {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (Q.has('scene')) {
    const [file, fn] = Q.get('scene').split('.');
    const m = mods[file] || (mods[file] = await import('./' + file + '.js'));
    g.fillStyle = '#000'; g.fillRect(0, 0, 1920, 1080);
    await m[fn](g, t, Object.fromEntries(Q)); return;
  }
  film.renderFilm(g, t, Q);
};
window.DUR = film.DUR;
window.READY = true;
