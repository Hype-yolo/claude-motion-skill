const q = new URLSearchParams(location.search);
const mod = await import(q.get('scene') === 'test' ? './test.js' : './film.js');
await document.fonts.load('44px AD');
const F = await mod.build();
const ctx = document.getElementById('c').getContext('2d');
window.DUR = F.dur; window.EV = [...F.ev, { t: 0, type: 'cues', ...F.cues }]; window.SUBS = F.subs || [];
window.render = t => F.render(ctx, t);
window.READY = true;
