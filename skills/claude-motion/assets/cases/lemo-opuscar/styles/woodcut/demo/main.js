// The Bell Founder — Woodcut Print demo (entry)
const qs = new URLSearchParams(location.search);
const cv = document.getElementById('cv'), g = cv.getContext('2d');
await document.fonts.load('400 40px "IM Fell English"'); await document.fonts.load('400 40px "IM Fell English SC"'); await document.fonts.load('italic 400 40px "IM Fell English"');
const TEST = qs.get('test');
if (TEST) {
  const m = await import('./test.js');
  await (m.init ? m.init(qs) : null); await (m.preload ? m.preload(qs) : null);
  window.DUR = 1; window.render = t => m.test(g, TEST, t, qs); window.READY = true;
} else {
  const m = await import('./film.js');
  await m.init(g, qs);
  window.DUR = m.DUR; window.EV = m.EV; window.SUBS = m.SUBS; window.render = t => m.render(g, t); window.READY = true;
}
