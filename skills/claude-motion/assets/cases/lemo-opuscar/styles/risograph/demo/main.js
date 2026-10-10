import { makeRiso, INK } from './riso.js';
import { W, H, plate, g, clear, text, layer, over } from './draw.js';
import { head, riderBike, pigeon, baguette } from './rider.js';
import { river, lamp, RIVER, street, ST } from './scenes.js';
import { modelSheet } from './sheet.js';
import { renderFilm, DUR, EV, setLines, subs } from './film.js';
const out = document.getElementById('c');
const print = makeRiso(out, W, H);
const Q = new URLSearchParams(location.search);
await Promise.all(['400 40px Jost', '500 40px Jost', '600 40px Jost', '700 40px Jost', '800 40px Bricolage', '600 40px Bricolage'].map(f => document.fonts.load(f)));
const lines = await (await fetch('lines.json')).json();
const dur = await (await fetch('voices/dur.json')).json();
setLines(lines, dur);
window.DUR = DUR; window.EV = EV; window.SUBS = subs();
window.render = t => {
  if (Q.get('frame') === 'street') {
    clear();
    street({ cx: 400, light: 0, sun: 0, lamps: 1 });
    layer(() => riderBike(760, ST.RY, .7, { crank: 2.4, lean: .22, expr: 'sleepy', ph: 1.1, scarfAmt: .8, shadow: false }));
    text('SUNDAY RIDE', 960, 250, '800 190px Bricolage', [1, 0, 0], 'center', 'alphabetic', 6);
    print(plate, { seed: 5, off: [[0, 0], [4, -3], [-4, 3]], gate: [1, 0, 0] });
    return;
  }
  if (Q.get('frame') === 'river') {
    clear();
    river({ cx: 0 });
    const s = .98, x = 860, y = RIVER.quay + 4;
    layer(() => { riderBike(x, y, s, { crank: .4, footDown: [30, 0], hip: [-52, -252], lean: .02, expr: 'calm', view: 'side', ph: 0, scarfAmt: .3, headO: {}, inBasket: () => baguette(200, -330, 200, -1.15), shadow: false });
    pigeon(x + 205 * s, y - (304 + 36) * s, s * 1.5, { pose: 'stand', flip: true }); });
    print(plate, { seed: 3, off: [[0, 0], [4, -3], [-4, 3]], water: { y: RIVER.horizon, b: RIVER.quay, amp: 7, t: 1.3, sep: .35, refl: .6 } });
    return;
  }
  if (Q.get('test') === 'heads') {
    clear();
    const vs = [['side','calm'],['q','calm'],['front','calm'],['side','surprise'],['q','joy'],['back','calm']];
    vs.forEach(([v,e],i)=>head(200+ (i%3)*560+160, 300+Math.floor(i/3)*500, 4.6, v, e));
    print(plate, { seed: 1, off: [[0,0],[3,-2],[-3,2]] }); return;
  }
  if (Q.has('sheet')) {
    const o = modelSheet(t, Q);
    if (Q.has('raw')) { const c2 = out; } 
    print(plate, o);
    return;
  }
  const o = renderFilm(t);
  if (Q.has('nogrid')) o.grain = 0;
  if (Q.has('boil')) o.boil = +Q.get('boil');
  if (Q.has('poster')) {   // 海报：片名印在天上（蓝版 + 粉版错位叠印）
    g.setTransform(1, 0, 0, 1, 0, 0);
    text('SUNDAY RIDE', 968, 196, '800 170px Bricolage', [0, 0, 1], 'center', 'alphabetic', 6);
    over(() => text('SUNDAY RIDE', 956, 190, '800 170px Bricolage', [.9, 0, 0], 'center', 'alphabetic', 6));
    text('RISOGRAPH PRINT  ·  LemoLab × Claude Opus 5.5', 960, 258, '600 32px Jost', [1, 0, 0], 'center', 'alphabetic', 6);
  }
  print(plate, o);
};
window.READY = true;
