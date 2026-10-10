// 入口：?test=swatch|model 进入试画页；否则渲染正片
import { makeComp } from './gl.js';
import { BOIL } from './crayon.js';
const Q = new URLSearchParams(location.search);
const comp = makeComp(document.getElementById('gl'));
window.DUR = 1;
const fontsToLoad = ['400 40px "Patrick Hand"', '700 40px Gaegu', '400 40px Gaegu', '400 40px "Short Stack"', '400 40px "Gochi Hand"', '400 40px "Caveat Brush"', '400 40px Sniglet'];
await Promise.all(fontsToLoad.map(f => document.fonts.load(f)));
const test = Q.get('test');
if (test) {
  const T = await import('./test.js');
  window.render = t => { BOIL.step = Math.floor(t * 12); T.test(comp, t, test, Q); };
} else {
  const M = await import('./film.js');
  window.DUR = M.DUR; window.EV = M.EV; window.SUBS = M.SUBS;
  window.render = t => { BOIL.step = Math.floor(t * 12 + 1e-6); M.frame(comp, t); };
}
window.READY = true;
