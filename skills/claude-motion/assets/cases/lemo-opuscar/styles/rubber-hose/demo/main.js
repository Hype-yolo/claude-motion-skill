// main.js — 入口：?mode=sheet|kitchen|test 出设定表；默认 = 成片
import * as T from './toon.js';
import { P, mug, cube } from './chars.js';
const Q = new URLSearchParams(location.search), MODE = Q.get('mode') || 'film';
const cv = document.getElementById('c');
const CW = +(Q.get('w') || 1920), CH = +(Q.get('h') || 1080);
cv.width = CW; cv.height = CH; cv.style.width = CW + 'px'; cv.style.height = CH + 'px';
T.init(cv);

let draw = null;
if (MODE === 'test') {
  draw = t => {
    const g = T.g; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = P.mid; g.fillRect(0, 0, CW, CH);
    T.frame(t);
    const turns = [0, 35, 70, 100];
    turns.forEach((tn, i) => mug({ x: 220 + i * 420, y: 480, turn: tn, t, armL: { x: -150, y: -120, hand: 'open' }, armR: { x: 150, y: -240, hand: 'point', front: true }, eyes: { lx: .3 }, mouth: { type: i === 1 ? 'grin' : 'smile' }, steam: ['lazy', 'bitter', 'heart', 'up'][i] }));
    [0, 30, 60, 100].forEach((tn, i) => cube({ x: 220 + i * 420, y: 950, k: 1.6, turn: tn, armL: { x: -60, y: -70, hand: 'open' }, armR: { x: 62, y: -95, hand: 'wave' }, eyes: { type: i === 2 ? 'wide' : 'open' }, mouth: { type: ['smile', 'wavy', 'o', 'grin'][i] }, sweat: i === 1 ? [[-50, -110, 6]] : null }));
  };
}
if (MODE === 'sheet') { const { modelSheet } = await import('./sheet.js'); draw = t => modelSheet(T.g, CW, CH, t); }
if (MODE === 'kitchen') { const { kitchenSheet } = await import('./sheet.js'); draw = t => kitchenSheet(T.g, CW, CH, t); }
await document.fonts.ready;
for (const f of ['46px Limelight', '20px "IM Fell English SC"', '40px Shrikhand']) await document.fonts.load(f);
if (MODE === 'film') {
  const { makeFilm, post } = await import('./film.js');
  const { paintKitchen, paintCupboard } = await import('./bg.js');
  const S = await import('./scenes.js');
  const ST = await import('./story.js');
  await document.fonts.load('38px "IM Fell English SC"'); await document.fonts.load('40px Shrikhand'); await document.fonts.load('40px Limelight');
  const await_ui = await import('./ui.js');
  const F = makeFilm(cv); T.init(F.scene);
  const bgK = paintKitchen(), bgC = paintCupboard();
  T.init(F.scene); S.initScenes(bgK, bgC, F.sg);
  const nosub = Q.get('nosub') === '1';
  const FN = { title: S.shotTitle, wide1: S.shotWide1, bitterCU: S.shotBitter, wide2: S.shotWide2, chase: S.shotChase, toaster: S.shotToaster, cupboard: S.shotCupboard, sink: S.shotCupboard, twoShot: S.shotTwo, leaving: S.shotLeaving, sweetCU: S.shotSweet, dance: S.shotDance, iris: S.shotIris, end: S.shotEnd };
  const cutAt = ST.SHOTS.map(s => s[0]);
  draw = t => {
    t = Math.min(t, ST.DUR - 1e-4);
    const sg = F.sg; sg.setTransform(1, 0, 0, 1, 0, 0); sg.fillStyle = '#000'; sg.fillRect(0, 0, 1920, 1080);
    const sh = ST.shotAt(t);
    FN[sh[2]](t);
    if (!nosub) S.subtitles(t);
    if (Q.get('poster') === '1') {   // 海报：片名压在画面上方
      const { fatTitle } = await_ui;   // 片名压在下方一块黑牌上（上方留给角色亮相）
      sg.save(); sg.fillStyle = 'rgba(12,11,10,.9)'; sg.strokeStyle = '#F1EEE6'; sg.lineWidth = 3; sg.beginPath(); sg.roundRect(560, 880, 800, 170, 26); sg.fill(); sg.beginPath(); sg.roundRect(572, 892, 776, 146, 20); sg.stroke(); sg.restore();
      fatTitle(sg, 'Coffee Cup Chase', 960, 945, 76);
      sg.save(); sg.fillStyle = '#F1EEE6'; sg.font = '28px Limelight'; sg.textAlign = 'center'; sg.fillText('A  RUBBER  HOSE  CARTOON', 960, 1018); sg.restore();
    }
    const f = Math.round(t * 24), jump = cutAt.some(c => c > 0 && Math.abs(Math.round(c * 24) - f) === 0) ? 3 : 0;   // 剪接处片门跳一下
    post(F, t, { jump });
  };
  window.DUR = ST.DUR;
  window.SUBS = ST.SUBS.map(s => ({ t0: s[0], t1: s[1], text: s[2] }));
  const { buildEvents } = await import('./events.js');
  window.EV = buildEvents();
}
window.DUR = window.DUR || 47;
window.render = t => draw(t);
window.READY = true;
