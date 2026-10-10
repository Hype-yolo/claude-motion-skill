import * as W from './engine/wb.js';
export async function build() {
  await W.loadFont('tech', 'fonts/EMSTech.json');
  const tl = new W.Timeline(), K = new W.Pen('k', W.INK.black), B = new W.Pen('b', W.INK.blue), O = new W.Pen('o', W.INK.orange);
  let t = .2;
  t = tl.draw(K, W.text('Einstein in your pocket', 300, 400, { h: 120 }), t);
  t = tl.draw(K, W.line(300, 480, 1500, 470, { w: 10, over: 12 }), t);
  t = tl.draw(B, W.circle(1000, 750, 180, { w: 9 }), t);
  t = tl.draw(B, W.dashed([[500, 900], [800, 700], [1300, 950]], { w: 8 }), t);
  t = tl.draw(O, W.arrow(1300, 620, 1650, 820, { w: 10 }), t);
  t = tl.draw(K, W.text('delay × c = distance  μs ≈ 38', 300, 1000, { h: 60 }), t);
  t = tl.draw(K, W.hatch([[1500, 250], [1800, 250], [1800, 500], [1500, 500]]), t);
  tl.erase(W.zigzag(1450, 220, 400, 300, 4).map(p => p), t + .2, 1);
  tl.end();
  const board = new W.Board(tl, {});
  const cam = new W.Camera([[0, 960, 600, 1]]);
  board.objs.push({ draw: (ctx, tt, c) => W.drawPinMagnet(ctx, 1000, 750, c) });
  board.objs.push({ draw: (ctx, tt, c) => { for (const e of tl.erasers) W.drawEraser(ctx, e, tt, c); } });
  board.objs.push({ draw: (ctx, tt, c) => { for (const p of [K, B, O]) W.drawMarker(ctx, p, W.penPose(p, tt, cam), c, tt); } });
  return { dur: t + 2, render: (ctx, tt) => board.render(ctx, tt, cam), ev: tl.ev };
}
