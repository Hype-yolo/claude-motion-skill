// 逐镜头绘制。每个镜头 fn(S) ，S = { t, lt（镜头内时间）, u（0..1）, g（画面）, e（发光层）, A（资源）}
import { canvas, W, H, TAU, rgba, mix, vgrad, airbrush, hash, poly, path, cel, line } from './cel.js';
import { PAL } from './pal.js';
import { riderSide, LAMPS } from './rider.js';
import { drawLoop } from './bg.js';
import { rain, splashes, speedLines, flare, lamp, trail } from './fx.js';
import { q12, q8 } from './story.js';

const f12 = t => Math.floor(t * 12 + 1e-6);

// 赛璐璐层：画在离屏画布上，贴到画面；同时在发光层上挖出黑色剪影（赛璐璐挡住背后的霓虹光）
const [LC, LG] = canvas(W, H), [MC, MG] = canvas(W, H);
export function celLayer(S, fn, o = {}) {
  LG.setTransform(1, 0, 0, 1, 0, 0); LG.clearRect(0, 0, W, H); LG.globalAlpha = 1; LG.filter = 'none';
  fn(LG);
  S.g.save(); if (o.alpha != null) S.g.globalAlpha = o.alpha; S.g.drawImage(LC, 0, 0); S.g.restore();
  if (o.occlude !== false) {
    MG.setTransform(1, 0, 0, 1, 0, 0); MG.globalCompositeOperation = 'source-over'; MG.clearRect(0, 0, W, H); MG.drawImage(LC, 0, 0);
    MG.globalCompositeOperation = 'source-in'; MG.fillStyle = o.occCol || '#000'; MG.fillRect(0, 0, W, H); MG.globalCompositeOperation = 'source-over';
    S.e.save(); S.e.globalAlpha = o.occA ?? 1; S.e.drawImage(MC, 0, 0); S.e.restore();
  }
  return LC;
}

// —— 侧面跟拍（夜 / 黎明）——
export function side(S, mode = 'night') {
  const { g, e, A } = S, t = S.t, lt = S.lt;
  const night = mode === 'night', P = night ? PAL.night : PAL.dawn;
  const V = 1500, FAC = .6;   // 骑手所在深度的地面速度（px/s），立面相对速度
  const ST = night ? A.street : A.streetDawn, SK = night ? A.sky : A.skyDawn, RF = night ? A.refl : A.reflDawn;
  const fx = -t * V * FAC;
  if (night) {
    vgrad(g, 0, 0, W, 720, [[0, '#0a0924'], [.55, '#261452'], [1, '#6b2a70']]);
    drawLoop(g, SK.c, SK.w, -t * 70, 700 - SK.h); drawLoop(e, SK.e, SK.w, -t * 70, 700 - SK.h);
    drawLoop(g, ST.c, ST.w, fx, 700 - ST.h); drawLoop(e, ST.e, ST.w, fx, 700 - ST.h);
    vgrad(g, 0, 700, W, 40, [[0, '#2a2240'], [1, '#1a1430']]);
    g.fillStyle = '#4a3d66'; g.fillRect(0, 738, W, 5);
    vgrad(g, 0, 743, W, H - 743, [[0, '#140d24'], [1, '#0b0716']]);
    drawLoop(g, RF.c, RF.w, fx, 743); drawLoop(e, RF.e, RF.w, fx, 743);
  } else {   // 黎明的海边公路：天空打开、太阳从海平面升起
    vgrad(g, 0, 0, W, 640, [[0, '#34407e'], [.45, '#a86a9e'], [.8, '#ff9e86'], [1, '#ffe2a4']]);
    airbrush(g, 1500, 640, 900, 260, '#fff0c0', .6); airbrush(e, 1500, 640, 520, 150, '#ffe0a0', .55);
    g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(1500, 646, 70, Math.PI, 0); g.fill(); e.fillStyle = '#fff0c0'; e.beginPath(); e.arc(1500, 646, 70, Math.PI, 0); e.fill();
    g.save(); g.filter = 'blur(8px)'; for (let i = 0; i < 9; i++) { const x = ((i * 260 - t * 30) % 2200 + 2200) % 2200 - 140, y = 200 + (i * 97) % 300; g.fillStyle = rgba('#7a5a9a', .5); g.beginPath(); g.ellipse(x, y, 220, 26, 0, 0, TAU); g.fill(); g.fillStyle = rgba('#ffc0a0', .55); g.beginPath(); g.ellipse(x + 20, y + 10, 190, 10, 0, 0, TAU); g.fill(); } g.restore();
    // 远处的发射塔与火箭（目的地就在前方）
    const rx = 1720 - t * 6; g.fillStyle = '#4a2e5a'; g.fillRect(rx - 30, 470, 12, 170); g.fillStyle = '#fff4f0'; g.fillRect(rx - 8, 490, 16, 150); g.beginPath(); g.moveTo(rx - 8, 490); g.lineTo(rx, 460); g.lineTo(rx + 8, 490); g.fill();
    vgrad(g, 0, 640, W, 100, [[0, '#ffc49a'], [1, '#6a4a7a']]);
    for (let k = 0; k < 30; k++) { const y = 644 + k * 3.2, w = 60 + (k * 37) % 200; g.fillStyle = rgba('#fff0c0', .55 * (1 - k / 30)); g.fillRect(1500 - w / 2 + Math.sin(k * 2.3 + t * 3) * k * 3, y, w, 2); }
    // 护栏（中景，随车速平移）
    const gx = -t * V * .8; g.fillStyle = '#3a2440';
    for (let k = -1; k < 12; k++) { const x = ((gx % 200) + 200) % 200 + k * 200 - 200; g.fillRect(x, 690, 12, 56); }
    g.fillStyle = '#c8a0b0'; g.fillRect(0, 692, W, 10); g.fillStyle = '#5a3a58'; g.fillRect(0, 702, W, 6);
    vgrad(g, 0, 743, W, H - 743, [[0, '#6a4a6a'], [1, '#3a2840']]);
    g.save(); g.globalAlpha = .35; g.translate(0, 1486); g.scale(1, -1); g.filter = 'blur(6px)'; g.drawImage(g.canvas, 0, 430, W, 313, 0, 430, W, 313); g.restore();
  }
  // 路面横向拖影（高速感）
  speedLines(g, f12(t), { type: 'h', n: 26, col: night ? '#8f7cc8' : '#ffd0b0', a: .25, hmax: 3, seed: 7 });
  // 远层雨
  if (night) rain(g, e, f12(t), { n: 160, ang: -.55, len: [30, 70], a: .22, w: .8, seed: 1 });
  // —— 骑手 ——
  const fr = f12(t), bob = (hash(fr * 1.3) - .5) * 5 + Math.sin(fr * 1.9) * 2.5;
  const X = 900 + Math.sin(q12(t) * .9) * 18, Y = 985, s = .92;
  const tail = [X + LAMPS.tail[0] * s, Y + (LAMPS.tail[1] + bob * .4) * s];
  // 尾灯光轨（在车身之前画，从尾灯向后拖）
  const tpts = []; for (let k = 0; k < 24; k++) { const tt = q12(t) - k * .03, bb = (hash(Math.floor(tt * 12) * 1.3) - .5) * 5 + Math.sin(Math.floor(tt * 12) * 1.9) * 2.5; tpts.push([tail[0] - k * 38, Y + (LAMPS.tail[1] + bb * .4) * s]); }
  trail(g, e, tpts, '#ff2a40', 7);
  // 地面阴影 / 车身在湿路上的倒影
  g.save(); g.globalAlpha = .35; g.translate(X, Y + 6); g.scale(s, -s * .5); g.filter = 'blur(4px)';
  riderSide(g, P, { ph: (fr % 4) / 4, wheelA: q12(t) * 40, speed: 1, bob, rim: null }); g.restore();
  g.fillStyle = rgba('#05030c', .5); g.beginPath(); g.ellipse(X, Y + 4, 380, 16, 0, 0, TAU); g.fill();
  celLayer(S, c => { c.translate(X, Y); c.scale(s, s);
    riderSide(c, P, { ph: (fr % 4) / 4, wheelA: q12(t) * 40, speed: 1, bob, rim: night ? { c: '#ff6ad0', d: [3, 4.5] } : { c: '#ffe0a8', d: [-3.5, 2.5] } });
    if (night) {   // 从招牌下穿过：霓虹色光一条条从车身上扫过（只照亮赛璐璐）
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop';
      for (let k = 0; k < 3; k++) {
        const col = ['#ff3fa4', '#35e7ff', '#ffd23f'][k], x = W + 400 - ((t * 1300 + k * 900) % 2900);
        const gr = c.createLinearGradient(x - 220, 0, x + 220, 0); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.5, rgba(col, .28)); gr.addColorStop(1, rgba(col, 0));
        c.fillStyle = gr; c.fillRect(x - 220, 0, 440, H);
      }
      c.globalCompositeOperation = 'source-over';
    } });
  // 灯：尾灯、车头灯 + 光束
  lamp(g, e, tail[0], tail[1], 14, '#ff2a40');
  const hd = [X + LAMPS.head[0] * s, Y + (LAMPS.head[1] + bob * .4) * s];
  e.save(); e.globalCompositeOperation = 'lighter';
  const bg_ = e.createLinearGradient(hd[0], 0, W, 0); bg_.addColorStop(0, rgba('#fff4c8', .28)); bg_.addColorStop(1, rgba('#fff4c8', 0));
  e.fillStyle = bg_; e.beginPath(); e.moveTo(hd[0], hd[1] - 10); e.lineTo(W + 100, hd[1] - 150); e.lineTo(W + 100, hd[1] + 260); e.lineTo(hd[0], hd[1] + 14); e.fill(); e.restore();
  lamp(g, e, hd[0], hd[1], 18, '#fff2c0');
  // 近层：路灯杆飞过（强模糊）
  const px = ((-t * V * 1.7) % 2600 + 2600) % 2600 - 300;
  if (night) { g.save(); g.filter = 'blur(10px)'; g.fillStyle = night ? '#0a0612' : '#2a1a28'; g.fillRect(px, -50, 70, H + 100); g.restore(); }
  // 近层雨
  if (night) { rain(g, e, f12(t), { n: 70, ang: -.6, len: [90, 180], a: .3, w: 2.2, seed: 2 }); splashes(g, f12(t) % 3, 760, 1070, 26, '#bfb0ff'); }
}

export const SHOTS_FN = {
  side: S => side(S, 'night'),
  dawnride: S => side(S, 'dawn'),
};
