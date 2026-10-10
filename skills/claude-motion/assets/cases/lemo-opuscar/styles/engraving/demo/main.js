// page contract for core/render: window.READY, window.render(t), window.DUR, window.EV
// ?content=content_alt.json swaps the content file.
import { makeFilm } from './film.js';
const q = new URLSearchParams(location.search);
const ctx = document.getElementById('c').getContext('2d');
const C = await (await fetch(q.get('content') || 'content.json')).json();
let dur = {};
try { const r = await fetch(q.get('voices') || 'voices/dur.json'); if (r.ok) dur = await r.json(); } catch {}
await Promise.all(['600 40px "Bodoni Moda"', 'italic 400 40px "Bodoni Moda"', '400 40px "Pinyon Script"'].map(f => document.fonts.load(f)));
const film = makeFilm(C, dur);
window.DUR = film.DUR; window.EV = film.EV; window.T = film.T;
window.render = t => film.render(ctx, t);
window.READY = true;
