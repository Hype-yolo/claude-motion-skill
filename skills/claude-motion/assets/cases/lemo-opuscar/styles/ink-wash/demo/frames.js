// 关卡 1 风格帧（?test=frame&f=wide|cross|cut）
import { mk, draw, blot, TONE } from './ink.js';
import { hero, POSE } from './hero.js';
import { wave } from './wave.js';
import { shuiStrokes, cutStroke } from './glyph.js';
import { mulberry } from '/core/lib.js';
import { subtitle } from './subs.js';
let TMP = null;
function tmp() { if (!TMP) { const m = () => { const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; return c; }; TMP = { wet: m(), dry: m(), col: m() }; TMP.ink = { wet: TMP.wet.getContext('2d'), dry: TMP.dry.getContext('2d'), col: TMP.col.getContext('2d') }; } for (const k of ['wet', 'dry', 'col']) { const c = TMP.ink[k]; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 1920, 1080); } return TMP; }
import { ridgeFn, mountainLayer, cun, cliff, pine, reed, ripple } from './land.js';
export function renderFrame(t, A, comp, f) {
  A.clear(); const L = A.ink;
  if (f === 'wide') {
    const far = ridgeFn([[1480, 330, 90], [1690, 250, 110], [1270, 200, 80], [380, 150, 110], [120, 200, 90], [760, 100, 120], [980, 60, 90]], 560, 3, 30);
    const midR0 = ridgeFn([[1650, 420, 80], [1860, 310, 90], [1420, 230, 90], [1250, 120, 70]], 700, 7, 34), midR = midR0;
    const bank0 = ridgeFn([[180, 85, 110], [470, 55, 100], [-40, 70, 80]], 705, 11, 14), bank = bank0;
    A.cw.drawImage(mountainLayer({ W: 1920, H: 1080, ridge: far, depth: 230, tone: .16, rim: .55, rimW: 24, mist: .9, seed: 3 }), 0, 0);
    A.cw.drawImage(mountainLayer({ W: 1920, H: 1080, ridge: midR, xmask: x => Math.min(1, Math.max(0, (x - 1130) / 160)), depth: 300, tone: .46, rim: .8, rimW: 14, mist: .7, seed: 7 }), 0, 0);
    A.cw.drawImage(mountainLayer({ W: 1920, H: 1080, ridge: bank, xmask: x => Math.min(1, Math.max(0, (660 - x) / 180)), depth: 90, tone: .4, rim: .8, rimW: 10, mist: .3, seed: 11 }), 0, 0);
    cun(L, { x0: 1180, x1: 1920, ridge: midR, tone: .34, cun: 1.4, moss: 1.1, seed: 7 });
    cun(L, { x0: 0, x1: 600, ridge: bank, tone: .3, cun: .9, moss: 1, seed: 11, cunLen: .5 });
    cliff(L, 1960, 800, 2.1, 3, -1);
    pine(L, 1810, 804, 1.25, 5, 0, 0, -1);
    hero(L, POSE.stand, { x: 1640, y: 800, s: 1.7, dir: -1, seed: 2, t: .4 });
    ripple(L, 1380, 905, 60, .35, 1, .18, 2.2); ripple(L, 1300, 960, 110, .22, 2, .18, 2);
    // 远处两点帆影（尺度）
    draw(L, mk([[520, 700], [522, 684]], { w: 2, tone: .5, dry: .3, prof: 'tip', seed: 900 }));
    draw(L, mk([[512, 701], [534, 701]], { w: 2.2, tone: .45, dry: .3, prof: 'lens', seed: 901 }));
    subtitle(A, 'The river keeps no name.\nIt waits for no one.', 170, 860, 1);
    comp(A, null, { bleed: 5, rim: 1.0 });
  }
  if (f === 'cut') {
    // 远山一抹（极淡）
    A.cw.drawImage(mountainLayer({ W: 1920, H: 1080, ridge: ridgeFn([[300, 160, 120], [620, 90, 140], [1700, 120, 150]], 820, 5, 20), depth: 160, tone: .1, rim: .5, mist: .8, seed: 5 }), 0, 0);
    // 浪（被劈开）：先画进临时层，再按断流线分上下两半贴回
    const W = tmp();
    wave(W.ink, { x: 1240, y: 900, s: 1.0, rise: 1, curl: 1, t: 3.2, seed: 21 });
    const box = [300, 120, 480];
    const cx0 = 300 + 84 * 4.8, cy0 = 120 + 73 * 4.8, cx1 = 2200, cy1 = 640;
    const lineY = x => x < cx0 ? cy0 : cy0 + (x - cx0) / (cx1 - cx0) * (cy1 - cy0);
    const k = .8;   // 劈开后的进度
    for (const key of ['wet', 'dry']) {
      const c = A.ink[key];
      // 下半
      c.save(); c.beginPath(); c.moveTo(0, lineY(0) + 14); c.lineTo(1920, lineY(1920) + 14); c.lineTo(1920, 1080); c.lineTo(0, 1080); c.closePath(); c.clip();
      c.drawImage(W[key], 0, 18 * k); c.restore();
      // 上半：沿切线滑开、变淡（化成雾）
      c.save(); c.beginPath(); c.moveTo(0, lineY(0) - 14); c.lineTo(1920, lineY(1920) - 14); c.lineTo(1920, 0); c.lineTo(0, 0); c.closePath(); c.clip();
      c.globalAlpha = 1 - k * .5; c.drawImage(W[key], 90 * k, -80 * k); c.restore(); c.globalAlpha = 1;
    }
    // 水字前三笔 + 断流飞白
    const S = shuiStrokes(box, { dry: .26, w: 11 });
    for (let i = 0; i < 3; i++) draw(L, S[i], 1);
    draw(L, cutStroke(box, cx1, cy1, { w: 16, dry: .6 }), 1);
    // 墨点炸开
    const R = mulberry(9);
    for (let i = 0; i < 90; i++) {
      const u = R(), x = cx0 + u * (1920 - cx0), y = lineY(x);
      const a = (R() - .5) * 2.6, d = (20 + R() * 180) * (.4 + k);
      const px = x + Math.cos(a) * d * .5 + d * .3, py = y + Math.sin(a) * d;
      blot(A.cw, px, py, 2 + R() * 9 * (1 - u * .5), .85, R() * 3, .5 + R() * .5, i);
      if (R() < .3) draw(L, mk([[px, py], [px - Math.cos(a) * 18, py - Math.sin(a) * 18]], { w: 3, tone: .8, dry: .4, prof: 'tip', seed: 1000 + i }));
    }
    // 侠客（过肩，背面，剑随势横出）
    hero(L, { ...POSE.backWrite, aR: [[8.5, -74], [22, -74], [36, -72]], sword: { a: .12 }, rib: [-1, -.1, 30] }, { x: 330, y: 1330, s: 6.4, seed: 8, t: 1.2 });
    comp(A, null, { bleed: 5, rim: 1.0, shake: [3, -2] });
  }
}
