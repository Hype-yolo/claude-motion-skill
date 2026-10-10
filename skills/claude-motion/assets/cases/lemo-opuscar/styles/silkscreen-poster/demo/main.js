import { setup, render } from './film.js';
const Q = new URLSearchParams(location.search);
await Promise.all(['900 40px BigShoulders', '800 40px BigShoulders', '500 40px Outfit', '600 40px Outfit', '700 40px Outfit', '800 40px Outfit'].map(f => document.fonts.load(f)));
const content = await (await fetch(Q.get('content') || 'content.json')).json();
const TL = setup(content, document.getElementById('c'));
window.DUR = TL.dur; window.EV = TL.ev; window.TL = TL.secs.map(s => ({ kind: s.kind, t0: s.t0, t1: s.t1 }));
window.render = t => render(t);
window.READY = true;
