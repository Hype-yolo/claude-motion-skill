import { makeComp, layerSet } from './comp.js';
import { DUR, T, VO } from './story.js';
import { subtitle } from './subs.js';
import { clamp } from '/core/lib.js';
const q = new URLSearchParams(location.search);
const comp = makeComp(document.getElementById('c'));
const A = layerSet(), B = layerSet(), TMP = layerSet();
const mode = q.get('test');
await document.fonts.load('600 40px CormorantSC'); await document.fonts.load('500 40px CormorantSC');
await document.fonts.load('italic 500 40px Cormorant'); await document.fonts.load('500 40px Cormorant');
await document.fonts.load('40px MaShanZheng', '水');
const NOSUB = q.has('nosub') || q.has('poster'), POSTER = q.has('poster');

let render;
if (mode) {
  const mod = await import('./test.js');
  window.DUR = 1;
  render = t => mod.render(t, A, B, comp, mode);
} else {
  const S = await import('./shots.js');
  await S.init(TMP);
  window.DUR = DUR;
  window.EV = S.events();
  render = t => {
    A.clear(); B.clear();
    const o = S.frame(t, A, B, TMP) || {};
    // 字幕（题跋）：放在当前镜头的留白处
    if (!NOSUB) for (const v of VO) {
      const [a, b] = v.sub; if (t < a || t > b) continue;
      const k = Math.min(clamp((t - a) / .35), clamp((b - t) / .4));
      const pos = S.subPos(v.id, t);
      subtitle(o.subInB ? B : A, v.text, pos[0], pos[1], k, { size: pos[2] || 46 });
    }
    if (POSTER) {   // 海报：片名题在江面留白处
      const c = A.cd; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#000'; c.globalAlpha = .9;
      c.font = '600 64px CormorantSC'; c.letterSpacing = '12px'; c.fillText('THE SWORDSMAN', 170, 800); c.fillText('AND THE RIVER', 170, 885);
      c.font = 'italic 500 30px Cormorant'; c.letterSpacing = '3px'; c.globalAlpha = .7; c.fillText('a Chinese ink wash film', 174, 945); c.restore();
      A.cc.setTransform(1, 0, 0, 1, 0, 0); S.seal(A.cc, 900, 815, 76, .95, 5);
    }
    comp(A, B, o);
  };
}
window.render = render;
window.READY = true;
