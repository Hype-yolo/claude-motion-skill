// chars.js — 原创角色：Dr. Vask（厌世天才）、Gary（紧张搭档）、Decaf（会说话的咖啡）
// 所有角色：局部坐标脚底为原点、y 向下；face=1 朝右（3/4 侧），-1 镜像
import { clamp, lerp, hash, TAU } from '/core/lib.js';
import { INK, g, push, pop, translate, rotate, scale, shape, fillOnly, stroke, ell, arc, spline, rr, rect, noodle, quad, dot, text, S, tx, zoom } from './toon.js';

export const PAL = {
  skinV: '#f2c9a0', skinVs: '#d9a57c', stub: '#dcb08e', robe: '#2a9d8f', robeS: '#1c6f66', pj: '#b9a7dc', pjS: '#8e79bd',
  slip: '#ff9ecb', slipS: '#e0719f', brow: '#3a3340', gogF: '#737b87', gogL: '#ffb020',
  skinG: '#a8714a', skinGs: '#855535', vest: '#9b7fd4', vestS: '#7a5fb3', shirt: '#f4f1ea', shorts: '#cdb37a', shortsS: '#a88f58',
  helm: '#ef5b3f', helmS: '#c43f27', sock: '#f4f1ea', shoe: '#3b6fd6', shoeS: '#2a52a8', frame: '#3a2a20', lens: '#d6f3ff',
  mouthIn: '#4a1a2a', tongue: '#e8637a', white: '#ffffff', cup: '#f7f3ea', cupS: '#d9d1c1', sleeve: '#b5763c', coffee: '#6b3e26', blob: '#7b4a2d', crema: '#c99a66',
};

// —— 脸部零件 ——
// 眼睛：大白眼 + 小瞳孔；lid = 上眼皮覆盖比例；closed = 满足地闭眼（弧线）
export function eye(cx, cy, rx, ry, { lid = 0, look = [0, 0], pupil = 4.5, skin = PAL.skinV, closed = false, lw = 6, jitter = 0, lower = 0 } = {}) {
  if (closed) { stroke(arc(cx, cy + ry * .15, rx * .8, ry * .45, Math.PI * .1, Math.PI * .9, 14), lw); return; }
  const E = ell(cx, cy, rx, ry, 36);
  shape(E, {
    fill: PAL.white, lw, shade: () => {
      const px = cx + look[0] * rx * .55 + jitter, py = cy + look[1] * ry * .5;
      dot(px, py, pupil);
      if (lid > 0) {   // 上眼皮
        const yl = cy - ry + lid * 2 * ry;
        fillOnly([[cx - rx * 1.3, cy - ry * 1.4], [cx + rx * 1.3, cy - ry * 1.4], [cx + rx * 1.3, yl], [cx - rx * 1.3, yl + ry * .08]], skin, { boil: .5 });
        stroke([[cx - rx * 1.2, yl + ry * .08], [cx + rx * 1.2, yl]], lw);
      }
      if (lower > 0) { const yb = cy + ry - lower * 2 * ry; fillOnly([[cx - rx * 1.3, yb], [cx + rx * 1.3, yb], [cx + rx * 1.3, cy + ry * 1.4], [cx - rx * 1.3, cy + ry * 1.4]], skin, { boil: .5 }); stroke([[cx - rx * 1.2, yb], [cx + rx * 1.2, yb]], lw * .8); }
    }
  });
}
// 嘴：o 张合 0..1，w 宽度倍率，sm 嘴角（+笑 −撇），skew 歪嘴
export function mouth(cx, cy, mw, { o = 0, w = 1, sm = 0, skew = 0, lw = 6, teeth = true, tongue = true } = {}) {
  const hw = mw * w / 2, k = mw * .22, lc = [cx - hw, cy - sm * k + skew * k], rc = [cx + hw, cy - sm * k - skew * k];
  if (o < .07) {
    stroke(quad(lc, [cx, cy + sm * k * 1.2], rc, 12), lw);
    stroke([[lc[0] - 4, lc[1] - 5 * Math.sign(sm || 1)], [lc[0] + 3, lc[1] + 3]], lw * .7);
    return;
  }
  const h = o * mw * .62;
  const up = quad(lc, [cx, cy - h * .25 + sm * k * .4], rc, 12), dn = quad(rc, [cx, cy + h + sm * k * .6], lc, 14);
  const P = [...up, ...dn];
  shape(P, {
    fill: PAL.mouthIn, lw, shade: () => {
      if (teeth && o > .22) fillOnly(rect(cx - hw * 1.2, cy - h, hw * 2.4, h * .32 + (cy - Math.min(lc[1], rc[1])) * .2 + 6), PAL.white, { boil: .3 });
      if (tongue) fillOnly(ell(cx + hw * .15, cy + h * .95, hw * .6, h * .45, 20), PAL.tongue, { boil: .3 });
    }
  });
}
export function hand(x, y, ang, r = 21, col = PAL.skinV, { fist = false, lw = 6 } = {}) {
  push(); translate(x, y); rotate(ang);
  const pts = fist ? spline([[-r * .6, -r * .8], [r * .7, -r * .9], [r * 1.1, -r * .1], [r * .8, r * .8], [-r * .5, r * .9], [-r * .9, 0]])
    : spline([[-r * .5, -r * .85], [r * .5, -r * 1.05], [r * 1.35, -r * .75], [r * 1.05, -r * .3], [r * 1.5, -r * .1], [r * 1.1, r * .3], [r * 1.35, r * .7], [r * .6, r * .95], [-r * .6, r * .8], [-r * .95, 0]]);
  shape(pts, { fill: col, lw });
  stroke([[r * .2, -r * .15], [r * .75, -r * .45]], lw * .6);   // 拇指缝
  pop();
}
const sweat = (x, y, s = 1) => shape(spline([[x, y - 16 * s], [x + 9 * s, y + 4 * s], [x, y + 12 * s], [x - 9 * s, y + 4 * s]]), { fill: '#bfe9ff', lw: 5 });

// —— 道具 ——
export function mug(x, y, a = 0, { empty = true, steam = 0 } = {}) {
  push(); translate(x, y); rotate(a);
  shape(spline([[30, -22], [58, -20], [60, 10], [30, 16]], false).concat([[30, 8], [48, 6], [48, -12], [30, -12]]), { fill: '#e9e4f5', lw: 6 });
  shape(rr(-32, -38, 64, 72, 10), { fill: '#e9e4f5', lw: 6, shade: () => fillOnly(rect(12, -40, 30, 80), '#c8c0de', { boil: .3 }) });
  text('GENIUS', 0, 4, { font: '800 15px "Baloo 2"', fill: '#6b5fa0' });
  shape(ell(0, -38, 32, 8, 20), { fill: empty ? '#5a4a3a' : PAL.coffee, lw: 5 });
  pop();
}
export function remote(x, y, a = 0, { press = 0, glow = 0 } = {}) {
  push(); translate(x, y); rotate(a);
  stroke(spline([[8, -38], [14, -62], [4, -78], [16, -96]], false), 5);          // 弯天线
  dot(16, -96, 7, '#ff4a3a');
  shape(rr(-22, -42, 44, 78, 9), { fill: '#8d96a3', lw: 6, shade: () => fillOnly(rect(8, -44, 20, 84), '#6c7482', { boil: .3 }) });
  shape(ell(0, -18 + press * 3, 14, 12 - press * 3, 20), { fill: glow ? '#ff7b6b' : '#e8392b', lw: 5 });
  shape(rr(-18, 6, 36, 18, 3), { fill: '#f3e27a', lw: 4 });               // 胶带标签
  text('DO NOT', 0, 16, { font: '800 11px "Baloo 2"', fill: INK });
  pop();
}
// 纸杯 + 咖啡生物 Decaf。rise: 0 平静 → 1 冒出来；eyes: 睁眼程度；o 说话
export function coffeeCup(x, y, s = 1, { rise = 0, eyes = 0, o = 0, look = [0, 0], blink = false, happy = 0, arms = 0, a = 0, t = 0 } = {}) {
  push(); translate(x, y); rotate(a); scale(s);
  // 杯身（底在 0）
  const cupP = [[-62, -150], [62, -150], [46, 0], [-46, 0]];
  shape(cupP, { fill: PAL.cup, lw: 7, shade: () => { fillOnly([[22, -160], [70, -160], [52, 10], [14, 10]], PAL.cupS, { boil: .3 }); fillOnly([[-70, -105], [70, -105], [70, -52], [-70, -52]], PAL.sleeve, { boil: .3 }); } });
  stroke([[-58, -105], [58, -105]], 5); stroke([[-53, -52], [53, -52]], 5);
  shape(spline([[-12, -88], [10, -92], [16, -76], [-6, -68], [-16, -76]]), { fill: '#6b3e26', lw: 4 }); stroke(quad([-8, -86], [2, -80], [6, -72], 6), 3, { line: '#c99a66' });
  // 杯口
  shape(ell(0, -150, 64, 15, 30), { fill: '#e8e0d0', lw: 7 });
  const r = rise;
  if (r <= .02) shape(ell(0, -148, 54, 10, 30), { fill: PAL.coffee, lw: 5 });
  else {
    // 咖啡生物：从液面拱起的圆顶
    const hgt = 20 + r * 95, wob = Math.sin(t * 9) * 3 * r;
    const body = spline([[-56, -148], [-58, -148 - hgt * .55], [-30 + wob, -148 - hgt], [30 + wob, -148 - hgt], [58, -148 - hgt * .55], [56, -148], [0, -140]]);
    shape(body, {
      fill: PAL.blob, lw: 7, shade: () => {
        fillOnly(spline([[-70, -148 - hgt * .78], [-30 + wob, -148 - hgt * 1.08], [30 + wob, -148 - hgt * 1.08], [70, -148 - hgt * .78], [30 + wob, -148 - hgt * .86], [-30 + wob, -148 - hgt * .86]]), PAL.crema, { boil: .4 });
        fillOnly(ell(40, -148 - hgt * .45, 16, hgt * .45, 20), '#5c341e', { boil: .3 });
        fillOnly(ell(-36 + wob, -148 - hgt * .55, 7, 16, 10), 'rgba(255,255,255,.55)', { boil: .2 });
      }
    });
    // 拉花爱心（让它一眼看出是咖啡）
    const hy = -148 - hgt * .93, hx = wob;
    shape(spline([[hx, hy + 9], [hx - 16, hy - 2], [hx - 12, hy - 11], [hx - 3, hy - 9], [hx, hy - 4], [hx + 3, hy - 9], [hx + 12, hy - 11], [hx + 16, hy - 2]]), { fill: '#f6e7cc', lw: 4 });
    // 漫出杯沿的咖啡滴
    for (const [dx, L] of [[-40, 22], [8, 30], [44, 18]]) shape(spline([[dx - 9, -150], [dx + 9, -150], [dx + 7, -150 + L * .7], [dx, -150 + L], [dx - 7, -150 + L * .7]]), { fill: PAL.blob, lw: 5 });
    // 热气
    for (let k = 0; k < 2; k++) { const ph = t * 1.4 + k * .5, y0 = -160 - hgt - 10 - (ph % 1) * 40, x0 = -20 + k * 40; stroke(spline([[x0, y0], [x0 + 10, y0 - 18], [x0 - 6, y0 - 36], [x0 + 8, y0 - 54]], false), 5, { line: `rgba(255,255,255,${.75 * (1 - (ph % 1))})` }); }
    // 小手
    if (arms > 0) {
      const wave = Math.sin(t * 14) * .5 * arms;
      shape(noodle([-50, -148 - hgt * .35], [-82, -148 - hgt * .35 - 38 * arms], -12 + wave * 10, 13, 9), { fill: PAL.blob, lw: 6 });
      shape(noodle([50, -148 - hgt * .35], [82, -148 - hgt * .35 - 38 * arms], 12 - wave * 10, 13, 9), { fill: PAL.blob, lw: 6 });
    }
    if (eyes > 0) {
      const ey = -148 - hgt * .62, ry = 22 * eyes;
      for (const ex of [-22, 22]) {
        if (blink) stroke([[ex - 15 + wob, ey], [ex + 15 + wob, ey]], 6);
        else if (happy > .5) stroke(arc(ex + wob, ey + 6, 14, 12, Math.PI * 1.1, Math.PI * 1.9, 10), 6);
        else { shape(ell(ex + wob, ey, 18, Math.max(3, ry), 24), { fill: PAL.white, lw: 6, shade: () => { dot(ex + wob + look[0] * 6, ey + look[1] * 6, 6.5); dot(ex + wob + look[0] * 6 + 3, ey + look[1] * 6 - 3, 2.2, '#fff'); } }); }
      }
      mouth(wob, -148 - hgt * .3, 26, { o, sm: .8 + happy * .4, lw: 5, teeth: false });
    }
  }
  pop();
}

// —— Dr. Vask ——
// P: {x,y,s,face,lean,bob,sq, lid,look,brow,mouth:{o,w,sm,skew},blink,closed,twitch, armR:{h,bend}, armL, holdR, holdL, legL, legR, headTilt, press, sweat}
export function vask(P) {
  const f = P.face ?? 1;
  push(); translate(P.x, P.y + (P.bob || 0)); scale((P.s ?? 1) * f, (P.s ?? 1) * (P.sq ?? 1));
  const lean = P.lean ?? .06;
  const legL = P.legL || [0, 0], legR = P.legR || [0, 0];
  // 腿 + 拖鞋
  for (const [sx, lg] of [[-1, legL], [1, legR]]) {
    const hip = [sx * 26, -140], ank = [sx * 30 + lg[0], -24 + lg[1]];
    shape(noodle(hip, ank, sx * -6, 40, 34), { fill: PAL.pj, lw: 7, shade: () => { for (let k = 0; k < 5; k++) fillOnly(rect(-200, -130 + k * 24 + lg[1] * (k / 5), 400, 8), PAL.pjS, { boil: .3 }); } });
    shape(spline([[ank[0] - 30, ank[1] + 26], [ank[0] - 26, ank[1] + 2], [ank[0] + 10, ank[1] - 2], [ank[0] + 46, ank[1] + 12], [ank[0] + 40, ank[1] + 28]]), { fill: PAL.slip, lw: 7, shade: () => fillOnly(rect(ank[0] - 40, ank[1] + 18, 100, 20), PAL.slipS, { boil: .3 }) });
  }
  push(); rotate(lean);
  // 后臂
  const shB = [-58, -335], shF = [52, -332];
  const armB = P.armL || { h: [-20, 170], bend: -20 }, armF = P.armR || { h: [30, 165], bend: 20 };
  const drawArm = (sh, arm, holding) => {
    const hp = [sh[0] + arm.h[0], sh[1] + arm.h[1]];
    shape(noodle(sh, hp, arm.bend ?? 0, 46, 38), { fill: PAL.robe, lw: 7 });
    const ang = Math.atan2(hp[1] - sh[1], hp[0] - sh[0]);
    shape(ell(hp[0] - Math.cos(ang) * 4, hp[1] - Math.sin(ang) * 4, 22, 22, 20), { fill: PAL.robeS, lw: 6 });
    if (holding === 'mug') { hand(hp[0], hp[1], ang, 20, PAL.skinV, { fist: true }); mug(hp[0] - 40 * Math.cos(lean), hp[1] - 2, -lean, { empty: !P.mugFull }); return; }
    else if (holding === 'remote') { hand(hp[0], hp[1], ang, 20, PAL.skinV, { fist: true }); remote(hp[0] + 4, hp[1] - 18, -lean + (arm.ra || 0), { press: P.press || 0, glow: P.press > .5 }); return; }
    else if (holding === 'cup') { coffeeCup(hp[0] + 4, hp[1] + 34, .55, P.cupP || {}); }
    hand(hp[0], hp[1], ang, 20, PAL.skinV, { fist: !!holding });
  };
  drawArm(shB, armB, P.holdL);
  // 浴袍身体
  const robe = spline([[-30, -372], [-80, -350], [-96, -250], [-104, -118], [0, -108], [100, -114], [96, -220], [78, -320], [30, -372]]);
  shape(robe, {
    fill: PAL.robe, lw: 7, shade: () => {
      fillOnly(spline([[-120, -380], [-40, -360], [-60, -250], [-50, -100], [-130, -100]]), PAL.robeS, { boil: .4 });
      fillOnly([[-12, -372], [34, -372], [16, -250], [4, -250]], PAL.pj, { boil: .4 });   // 睡衣 V 领
    }
  });
  stroke([[-14, -372], [6, -250], [30, -118]], 6);                 // 衣襟
  stroke([[34, -372], [12, -250]], 6);
  stroke(spline([[-26, -372], [-10, -330], [-6, -290], [6, -250]], false), 5);  // 翻领
  // 腰带
  shape(spline([[-100, -222], [0, -214], [98, -226], [96, -202], [0, -190], [-102, -198]]), { fill: PAL.robeS, lw: 6 });
  shape(noodle([40, -205], [30, -150], 8, 16, 12), { fill: PAL.robeS, lw: 5 });
  shape(noodle([48, -205], [62, -156], -6, 16, 12), { fill: PAL.robeS, lw: 5 });
  shape(ell(44, -206, 14, 11, 16), { fill: PAL.robeS, lw: 5 });
  stroke(spline([[-60, -170], [-30, -160], [-20, -135]], false), 4);   // 口袋
  // 脖子
  shape(noodle([14, -366], [26, -398], 4, 30, 30), { fill: PAL.skinV, lw: 6 });
  // 头
  push(); translate(40, -478); rotate(P.headTilt ?? .12);
  head_vask(P);
  pop();
  drawArm(shF, armF, P.holdR);
  pop();
  if (P.sweat) sweat(150, -520 + (P.sweat % 1) * 20, 1.2);
  pop();
}
function head_vask(P) {
  // 耳朵（后侧）
  shape(ell(-70, 6, 17, 25, 18), { fill: PAL.skinV, lw: 6, shade: () => fillOnly(ell(-66, 8, 7, 13, 12), PAL.skinVs, { boil: .3 }) });
  const HD = spline([[-10, -112], [55, -104], [86, -60], [92, 10], [86, 70], [55, 104], [5, 108], [-45, 90], [-78, 40], [-84, -30], [-58, -90]]);
  shape(HD, {
    fill: PAL.skinV, lw: 7, shade: () => {
      fillOnly(spline([[-40, 30], [20, 48], [92, 30], [96, 120], [-60, 120]]), PAL.stub, { boil: .4 });      // 胡茬区
      for (let i = 0; i < 26; i++) { const a = hash(i * 3.1), b = hash(i * 7.7); dot(-30 + a * 120, 58 + b * 44, 1.8, '#a88264'); }
      fillOnly(spline([[-90, -20], [-60, -110], [-100, -120]]), PAL.skinVs, { boil: .3 });
      fillOnly(rect(-120, -104, 260, 16), '#4a4f5a', { boil: .4 });                 // 护目镜带
    }
  });
  // 护目镜
  for (const [gx, gr] of [[10, 20], [56, 17]]) shape(ell(gx, -94, gr, gr * .85, 22), { fill: PAL.gogF, lw: 6, shade: () => { fillOnly(ell(gx, -94, gr * .66, gr * .56, 18), PAL.gogL, { boil: .3 }); fillOnly(ell(gx - gr * .25, -99, gr * .2, gr * .14, 10), '#fff6d8', { boil: 0 }); } });
  // 眼睛
  const lid = P.blink ? 1 : clamp(P.lid ?? .46, 0, 1), look = P.look || [0, 0];
  const tw = P.twitch ? (Math.floor(P.twitch * 12) % 2 ? .2 : 0) : 0;
  eye(8, -10, 32, 35, { lid: P.closed ? 0 : clamp(lid + tw, 0, 1), look, closed: P.closed, pupil: 4.5 });
  eye(58, -12, 25, 30, { lid: P.closed ? 0 : lid, look, closed: P.closed, pupil: 4 });
  // 眼袋
  for (const [ex, rx] of [[8, 26], [58, 20]]) { stroke(arc(ex, 28, rx, 9, Math.PI * .15, Math.PI * .85, 10), 4); stroke(arc(ex + 2, 38, rx * .7, 7, Math.PI * .25, Math.PI * .75, 8), 3.5); }
  // 一字眉
  const br = P.brow ?? 0, by = -48 - br * 10;
  shape(spline([[-24, by + 6 + br * 4], [10, by - 6], [40, by - 2 + br * 5], [90, by - 8], [94, by + 6], [40, by + 12 + br * 5], [8, by + 8], [-22, by + 16 + br * 4]]), { fill: PAL.brow, lw: 5 });
  // 鼻子
  shape(spline([[34, -12], [46, 18], [70, 36], [64, 54], [40, 50], [30, 36]]), { fill: PAL.skinV, lw: 6, shade: () => fillOnly(ell(62, 48, 14, 8, 12), PAL.skinVs, { boil: .3 }) });
  // 嘴
  const m = P.mouth || {};
  mouth(40 + (m.skew || 0) * 6, 78, 64, { o: m.o || 0, w: m.w ?? 1, sm: m.sm ?? -.35, skew: m.skew || 0, lw: 6 });
  // 一根卷毛
  stroke(spline([[-6, -106], [2, -128], [20, -138], [30, -124], [18, -114], [10, -124]], false), 5);
}

// —— Gary ——
export function gary(P) {
  const f = P.face ?? 1, ner = P.nerv ?? 0;
  const jit = ner ? (hash(Math.floor((P.t || 0) * 12) * 3.3) - .5) * 6 * ner : 0;
  push(); translate(P.x + jit, P.y + (P.bob || 0)); scale((P.s ?? 1) * f, (P.s ?? 1) * (P.sq ?? 1));
  const legL = P.legL || [0, 0], legR = P.legR || [0, 0];
  for (const [sx, lg] of [[-1, legL], [1, legR]]) {
    const hip = [sx * 24, -86], ank = [sx * 28 + lg[0], -18 + lg[1]];
    shape(noodle(hip, ank, 0, 26, 24), { fill: PAL.skinG, lw: 6, shade: () => fillOnly(rect(-200, -54 + lg[1] * .5, 400, 60), PAL.sock, { boil: .3 }) });
    stroke([[ank[0] - 13, -44 + lg[1] * .6], [ank[0] + 13, -44 + lg[1] * .6]], 4);
    shape(spline([[ank[0] - 24, ank[1] + 18], [ank[0] - 20, ank[1] - 4], [ank[0] + 10, ank[1] - 6], [ank[0] + 40, ank[1] + 8], [ank[0] + 38, ank[1] + 20]]), { fill: PAL.shoe, lw: 6, shade: () => fillOnly(rect(ank[0] - 40, ank[1] + 12, 100, 20), '#f4f1ea', { boil: .3 }) });
  }
  push(); rotate(P.lean ?? 0);
  const shB = [-58, -196], shF = [56, -196];
  const armB = P.armL || { h: [-10, 90], bend: -16 }, armF = P.armR || { h: [10, 90], bend: 16 };
  const drawArm = (sh, arm) => {
    const hp = [sh[0] + arm.h[0], sh[1] + arm.h[1]];
    const el = [sh[0] + arm.h[0] * .3, sh[1] + arm.h[1] * .3];
    shape(noodle(sh, hp, arm.bend ?? 0, 22, 18), { fill: PAL.skinG, lw: 6 });
    shape(noodle(sh, el, 0, 34, 30), { fill: PAL.shirt, lw: 6 });
    hand(hp[0], hp[1], Math.atan2(hp[1] - sh[1], hp[0] - sh[0]), 15, PAL.skinG, { fist: arm.fist });
  };
  drawArm(shB, armB);
  // 身体：白衬衫 + 毛背心 + 短裤
  shape(spline([[-60, -112], [-66, -70], [0, -62], [66, -70], [60, -112]]), { fill: PAL.shorts, lw: 6, shade: () => fillOnly(rect(20, -130, 60, 80), PAL.shortsS, { boil: .3 }) });
  const body = spline([[0, -232], [58, -214], [78, -150], [66, -96], [0, -84], [-66, -96], [-78, -150], [-58, -214]]);
  shape(body, {
    fill: PAL.vest, lw: 7, shade: () => {
      fillOnly(spline([[20, -240], [80, -220], [96, -150], [80, -80], [40, -80], [60, -150]]), PAL.vestS, { boil: .4 });
      fillOnly([[-26, -240], [26, -240], [0, -176]], PAL.shirt, { boil: .4 });
      for (let k = 0; k < 4; k++) stroke([[-70, -120 + k * 9], [70, -120 + k * 9]], 3, { line: PAL.vestS });
    }
  });
  stroke([[-26, -228], [0, -176], [26, -228]], 5);
  shape([[-22, -234], [-2, -222], [-12, -206], [-32, -222]], { fill: PAL.shirt, lw: 5 });   // 衣领
  shape([[22, -234], [2, -222], [12, -206], [32, -222]], { fill: PAL.shirt, lw: 5 });
  // 口袋 + 笔
  const pens = ['#e8392b', '#3b6fd6', '#2bb673'];
  pens.forEach((c, i) => shape(rr(-50 + i * 11, -176, 8, 26, 3), { fill: c, lw: 4 }));
  shape(rr(-56, -160, 40, 30, 4), { fill: PAL.shirt, lw: 5 });
  // 头
  push(); translate(0, -300); rotate(P.headTilt ?? 0);
  head_gary(P, ner);
  pop();
  drawArm(shF, armF);
  pop();
  if (P.sweat != null) { const u = P.sweat % 1; sweat(-70, -380 + u * 40, 1); sweat(78, -360 + ((u + .5) % 1) * 40, .8); }
  pop();
}
function head_gary(P, ner) {
  for (const sx of [-1, 1]) shape(ell(sx * 86, 6, 16, 22, 16), { fill: PAL.skinG, lw: 6 });
  shape(ell(0, 0, 90, 88, 60), { fill: PAL.skinG, lw: 7, shade: () => fillOnly(ell(48, 30, 60, 70, 30), PAL.skinGs, { boil: .3 }) });
  // 头盔
  const hel = [...arc(0, -18, 100, 96, Math.PI * 1.02, Math.PI * 1.98, 30), [96, -2], [-96, -2]];
  shape(hel, { fill: PAL.helm, lw: 7, shade: () => { fillOnly(ell(40, -60, 60, 50, 24), PAL.helmS, { boil: .3 }); for (const vx of [-40, 0, 40]) fillOnly(rr(vx - 9, -104, 18, 44, 8), INK, { boil: .3 }); } });
  stroke([[-94, -4], [-88, 20], [-70, 60]], 4); stroke([[94, -4], [88, 20], [70, 60]], 4);    // 头盔带
  // 眉毛（担心：内端上挑）
  const br = P.brow ?? 1;
  stroke([[-66, -30 + br * 2], [-26, -40 - br * 8]], 7); stroke([[66, -30 + br * 2], [26, -40 - br * 8]], 7);
  // 大眼镜 + 放大的眼睛
  const look = P.look || [0, 0], shake = ner ? (hash(Math.floor((P.t || 0) * 24) * 1.7) - .5) * 3 * ner : 0;
  for (const ex of [-40, 40]) {
    shape(ell(ex, 14, 40, 40, 36), { fill: PAL.lens, lw: 9, line: PAL.frame, shade: () => { } });
    eye(ex, 14, 29 * (P.eyeS ?? 1), 29 * (P.eyeS ?? 1), { lid: P.blink ? 1 : (P.lid ?? 0), look, pupil: P.pupil ?? 3.6, skin: PAL.lens, jitter: shake, lw: 5 });
    shape(ell(ex, 14, 40, 40, 36), { line: PAL.frame, lw: 9, stroke: true });
    stroke(arc(ex - 12, 2, 18, 18, Math.PI * 1.1, Math.PI * 1.45, 6), 4, { line: '#ffffff' });
  }
  stroke([[-2, 10], [2, 10]], 8, { line: PAL.frame });
  // 鼻子、嘴
  shape(ell(0, 50, 11, 9, 12), { fill: PAL.skinGs, lw: 5 });
  const m = P.mouth || {};
  mouth(0, 70 + ((P.mouthS ?? 1) - 1) * 8, 42 * (P.mouthS ?? 1), { o: m.o || 0, w: m.w ?? 1, sm: m.sm ?? -.5, skew: m.skew || 0, lw: 5, teeth: true });
}
