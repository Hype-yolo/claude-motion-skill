// 第 7 镜 过江（江被劈开，白路；身后水合拢）→ 抱拳 → 收卷盖印 → 片尾卡
import { mk, draw, blot, mass } from './ink.js';
import { hero, POSE, mixPose } from './hero.js';
import { ridgeFn, mountainLayer, cliff, pine, ripple } from './land.js';
import { seal } from './seal.js';
import * as W from './world.js';
import { T } from './story.js';
import { VERM } from './hero.js';
import { clamp, lerp, ss, eo, eio, mulberry } from '/core/lib.js';

const CY = 815;                                       // 白路（江底）中线
const walkX = t => lerp(2350, W.HERO1[0], ss(clamp((t - 35.3) / (T.bank - 35.3))));
const closeFront = t => lerp(3200, 1020, ss(clamp((t - T.close[0]) / (T.close[1] - T.close[0]))));

export function render(A, t, TMP) {
  if (t < T.shotBow) return renderWalk(A, t, TMP);
  if (t < T.scrollA) return renderBow(A, t);
  return renderScroll(A, t);
}

// 水墙：路两侧各一条（淡墨带 + 顺流的干笔水纹 + 翻向路面的浪头），身后按合拢前沿用横向渐变蒙版抹掉
function walls(L, A, t, TMP, xf) {
  const front = closeFront(t);
  const T2 = TMP.ink;
  for (const c of [T2.wet, T2.dry]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, 1920, 1080); c.setTransform(xf.s, 0, 0, xf.s, xf.tx, xf.ty); }
  const R = mulberry(4);
  for (let side = -1; side <= 1; side += 2) {
    const g = 50, H = side < 0 ? 170 : 240;
    const edge = x => CY + side * (g + Math.sin(x * .011 + t * 1.6 + side) * 5);
    // 淡墨带
    const gr = T2.wet.createLinearGradient(0, CY + side * g, 0, CY + side * (g + H));
    gr.addColorStop(0, 'rgba(0,0,0,.34)'); gr.addColorStop(.5, 'rgba(0,0,0,.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    T2.wet.fillStyle = gr; T2.wet.beginPath();
    for (let x = 1000; x <= 3400; x += 40) T2.wet.lineTo(x, edge(x));
    T2.wet.lineTo(3400, CY + side * (g + H)); T2.wet.lineTo(1000, CY + side * (g + H)); T2.wet.closePath(); T2.wet.fill();
    // 墙沿：一笔长含墨
    const pts = []; for (let x = 1010; x <= 3400; x += 80) pts.push([x, edge(x)]);
    draw(T2, mk(pts, { w: 20, tone: .85, darkDir: [0, -side], side: .85, brWet: true, body: .3, dry: .45, wet: .8, prof: 'even', seed: 1700 + side, gapLen: 900 }), 1, 1);
    // 顺流的水纹：宋人水图式的波纹线，靠路越密越浓，向外渐疏渐淡
    for (let k = 0; k < 11; k++) {
      const f = k / 10, off = 14 + Math.pow(f, 1.3) * (H - 20), ph = R() * 6, amp = 4 + 6 * f, wl = .016 + R() * .01;
      const lp = []; for (let x = 1010 + R() * 60; x <= 3400; x += 22) lp.push([x, edge(x) + side * off + Math.sin(x * wl + ph + t * (1.5 + f)) * amp]);
      draw(T2, mk(lp, { w: 2.8 - f * 1.4, tone: .75 - f * .45, dry: .55, wet: .25, prof: 'even', seed: 1750 + k + side * 20, gapLen: 500 + R() * 300 }), 1, 1);
    }
    // 路沿几个小漩（浪花）
    for (let x = 1200 + R() * 100; x < 3350; x += 280 + R() * 200) {
      const r = 10 + R() * 12, y = edge(x) + side * r * .8, pts = [];
      for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 * side + i / 10 * Math.PI * 1.6 * side; pts.push([x + Math.cos(a) * r * (1 - i * .05), y + Math.sin(a) * r * (1 - i * .05)]); }
      draw(T2, mk(pts, { w: 4.5, tone: .8, dry: .45, wet: .4, prof: 'brush', seed: 1850 + (x | 0) }), 1, .9);
    }
  }
  // 合拢：前沿之后逐渐抹掉
  const sx = x => x * xf.s + xf.tx;
  for (const c of [T2.wet, T2.dry]) {
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-in';
    const g2 = c.createLinearGradient(sx(1000), 0, sx(front + 320), 0); const f0 = clamp((sx(1160) - sx(1000)) / (sx(front + 320) - sx(1000) + 1)), f1 = clamp((sx(front) - sx(1000)) / (sx(front + 320) - sx(1000) + 1));
    g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(Math.min(f0, f1 * .99), '#000'); g2.addColorStop(Math.max(f1, Math.min(f0, f1 * .99) + .001), '#000'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g2; c.fillRect(0, 0, 1920, 1080); c.globalCompositeOperation = 'source-over';
  }
  for (const k of ['wet', 'dry']) { const c = A.ink[k]; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(TMP[k], 0, 0); c.restore(); }
  // 合拢处：水纹涟漪
  for (let x = 1300; x < 3300; x += 260) {
    if (x < front + 150) continue;
    const age = clamp((x - front) / 1400);
    ripple(L, x, CY + 6, 40 + 200 * age, .4 * (1 - age * .6), x, .2, 2.4);
  }
}

function renderWalk(A, t, TMP) {
  const cam = { x: 1600, y: 610, z: .9 }, { s, tx, ty } = W.camXf(cam), L = A.ink, t12 = Math.floor(t * 12) / 12;
  const LY = W.layers();
  W.blit(A, LY.mtn, cam); W.blit(A, LY.bank, cam);
  A.xf(s, tx, ty);
  walls(L, A, t, TMP, { s, tx, ty });
  const hx = walkX(t12), arrived = t12 >= T.bank;
  let P;
  if (!arrived) { const ph = Math.floor((t12 - 35.3) / .333) % 2; P = ph ? POSE.walk1 : POSE.walk2; }
  else P = POSE.stand;
  const hy = hx < 1060 ? W.HERO1[1] : CY + 2;
  hero(L, P, { x: hx, y: hy, s: 1.9, dir: -1, seed: 2, t: t12, boil: t12 * 12 });
  return { bleed: 5 * s, rim: 1, paper: [-tx, -ty, s] };
}

let BOWBG = null;
function renderBow(A, t) {
  const L = A.ink, t12 = Math.floor(t * 12) / 12, u = t - T.shotBow;
  if (!BOWBG) BOWBG = mountainLayer({ W: 1920, H: 1080, ridge: ridgeFn([[1500, 150, 150], [1250, 90, 130], [1800, 110, 120]], 700, 23, 20), depth: 150, tone: .12, rim: .5, mist: .8, seed: 23 });
  const z = 1 + .025 * u;
  for (const c of [A.cw, A.cd, A.cc]) { c.save(); c.translate(700, 700); c.scale(z, z); c.translate(-700, -700); }
  A.cw.drawImage(BOWBG, 0, 0);
  // 远处起点岸：一小块崖与松（很淡、很小）
  cliff(L, 1640, 690, .42, 3, -1); pine(L, 1610, 692, .26, 5, 0, 0, -1);
  // 江面：几道淡水纹（江已复原）
  for (let i = 0; i < 5; i++) draw(L, mk([[900 + i * 170, 760 + i * 40], [1060 + i * 190, 758 + i * 40]], { w: 2.2, tone: .35, dry: .7, prof: 'tip', seed: 2000 + i }), 1, .6);
  const b = ss(clamp((t12 - T.bow[0]) / (T.bow[1] - T.bow[0])));
  const P = { ...mixPose(POSE.front, POSE.bow, b), eyes: b > .5 ? 1 : 0, rib: [0, 1, 0] };
  hero(L, P, { x: 640, y: 1110, s: 7.2, dir: 1, seed: 2, t: t12, boil: t12 * 12 });
  for (const c of [A.cw, A.cd, A.cc]) c.restore();
  return { bleed: 6, rim: 1 };
}

// 收卷：从对岸的侠客一路拉远到整幅手卷，盖印、题跋，片尾卡
function renderScroll(A, t) {
  const u = eio(clamp((t - T.scrollA) / (T.scrollB - T.scrollA)));
  const z = Math.exp(lerp(Math.log(1.25), Math.log(.315), u));
  const cam = { x: lerp(1150, 2800, u), y: lerp(720, 700, u), z };
  const { s, tx, ty } = W.camXf(cam), L = A.ink, t12 = Math.floor(t * 12) / 12;
  const LY = W.layers();
  W.blit(A, LY.mtn, cam); W.blit(A, LY.cliff, cam); W.blit(A, LY.bank, cam);
  A.xf(s, tx, ty);
  // 江面：一两道淡淡的水纹，什么也没留下
  draw(L, mk([[1500, 830], [2300, 826], [3000, 832]], { w: 3, tone: .25, dry: .75, prof: 'tip', seed: 2100 }), 1, .6);
  hero(L, POSE.stand, { x: W.HERO1[0], y: W.HERO1[1], s: 1.7, dir: 1, seed: 2, t: t12, boil: t12 * 12 });
  // 题跋（卷尾，竖排）
  const ia = clamp((t - 43.7) / .8);
  if (ia > 0) {
    for (const [ctx, k] of [[A.cw, (1 - ia) * .6], [A.cd, ia]]) {
      [['Draw a sword to cut the water,', 300, 150], ['and the water only flows on.', 215, 150]].forEach(([str, x, y]) => {
        ctx.save(); ctx.globalAlpha = clamp(k * .88); ctx.fillStyle = '#000'; ctx.font = 'italic 500 58px Cormorant'; ctx.letterSpacing = '2px';
        ctx.translate(x, y); ctx.rotate(Math.PI / 2); ctx.fillText(str, 0, 0); ctx.restore();
      });
    }
  }
  // 印：落下（略大 → 压实）
  if (t >= T.seal - .12) {
    const k = clamp((t - (T.seal - .12)) / .12), sz = 150 * (1.25 - .25 * eo(k));
    seal(A.cc, 190 - sz / 2 + 75, 880 - sz / 2 + 75 - 40, sz, .96 * k, 5);
  }
  // 卷外：绫裱 + 深色案面（世界矩形之外）
  const mk2 = A.cc; mk2.save(); mk2.setTransform(1, 0, 0, 1, 0, 0);
  const rx = tx, ry = ty, rw = W.WW * s, rh = W.WH * s, bd = 70 * s;
  const ma = clamp((.85 - z) / .35);
  if (ma > 0) {
    mk2.globalAlpha = ma;
    mk2.fillStyle = '#2f2b27'; mk2.beginPath(); mk2.rect(0, 0, 1920, 1080); mk2.rect(rx - bd, ry - bd, rw + bd * 2, rh + bd * 2); mk2.fill('evenodd');
    mk2.fillStyle = '#cdc3aa'; mk2.beginPath(); mk2.rect(rx - bd, ry - bd, rw + bd * 2, rh + bd * 2); mk2.rect(rx, ry, rw, rh); mk2.fill('evenodd');
    mk2.fillStyle = '#5a4634'; mk2.fillRect(rx - bd - 26 * s * 3, ry - bd - 10, 26 * s * 3, rh + bd * 2 + 20); mk2.fillRect(rx + rw + bd, ry - bd - 10, 26 * s * 3, rh + bd * 2 + 20);   // 两端轴
    mk2.strokeStyle = 'rgba(60,48,36,.5)'; mk2.lineWidth = 1.5; mk2.strokeRect(rx - 2, ry - 2, rw + 4, rh + 4);
  }
  // 片尾卡
  const ea = clamp((t - T.endCard) / .8);
  if (ea > 0) {
    mk2.globalAlpha = ea; mk2.fillStyle = '#e8dfcc'; mk2.textAlign = 'center';
    mk2.font = '600 44px CormorantSC'; mk2.letterSpacing = '14px'; mk2.fillText('CHINESE INK WASH', 960, 870);
    mk2.font = 'italic 500 30px Cormorant'; mk2.letterSpacing = '2px'; mk2.fillText('LemoLab × Claude Opus 5.5', 960, 925);
  }
  mk2.restore();
  return { bleed: 5 * s, rim: 1, paper: [-tx, -ty, s], vig: .22 + .15 * ma };
}
