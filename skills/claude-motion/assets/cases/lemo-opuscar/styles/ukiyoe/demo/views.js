// 五幅画：每幅 = 若干缓存色版（layers）+ 每帧的动态元素（paint）
// 图层组 g：0 = 墨线版，1 = 蓝版，2 = 绿/次色版，3 = 红/人物版（用于"一版一版印出来"）
import { clamp, lerp, seg, ss, eio, eo, ei, mulberry, hash, vnoise, TAU } from '/core/lib.js';
import { W, H, FR, PAL, smooth, poly, carve, wob, line, fillPath, bokashi, kasumi, rgba, mix } from './print.js';
import { mountain, mtnPts, pine, rock, rain, goose, claw } from './nature.js';
import { traveler, kasa } from './traveler.js';
import { T, q8, q12 } from './story.js';
import { wave, sea, foam, wstate } from './wave.js';

const S = PAL.sumi;
const rectFill = (x, c, x0, y0, x1, y1) => { x.fillStyle = c; x.fillRect(x0, y0, x1 - x0, y1 - y0); };

// ————————————————————————— 一 · 田毎の朝 —————————————————————————
const HZ1 = 500;
// 水田几何：高视角的平行层叠——横埂略起伏、间距只缓慢变大；纵埂彼此平行（统一略斜），不做一点透视汇聚
const ROWS1 = [516, 540, 568, 600, 638, 684, 740, 806, 890, 980, 1070];
const sc1 = y => .25 + (y - 500) / 570 * .75;
const rowY = (r, X) => ROWS1[r] + (r > 0 && r !== 6 && r !== 7 ? (vnoise(X * .003 + r * 3.7) - .5) * 16 * sc1(ROWS1[r]) + Math.sin(X * .0018 + r) * 5 : 0);
const SLANT = .28;   // 纵埂统一斜度（dx/dy）
const CELLS1 = [], DIKES1 = [];
{
  const R = mulberry(42);
  for (let r = 0; r < ROWS1.length - 1; r++) {
    if (r === 6) continue; // 主田埂
    const y0 = ROWS1[r], y1 = ROWS1[r + 1], sp = 300 + 260 * sc1((y0 + y1) / 2);
    let X = -300 - R() * sp; const xs = [];
    while (X < W + 300) { xs.push(X); X += sp * (.55 + R() * 1.0); }
    for (let i = 0; i < xs.length; i++) {
      const xa = xs[i], xb = xs[i + 1] ?? W + 600, sl = SLANT + (R() - .5) * .12, dx = (y1 - y0) * sl;
      CELLS1.push({ r, q: [[xa, rowY(r, xa)], [xb, rowY(r, xb)], [xb + dx, rowY(r + 1, xb + dx)], [xa + dx, rowY(r + 1, xa + dx)]], tint: R(), sprout: r >= 7 ? R() < .75 : R() < .3 });
      DIKES1.push({ r, a: [xa, rowY(r, xa)], b: [xa + dx, rowY(r + 1, xa + dx)], w: 3 + 11 * sc1(y1) * (.6 + R() * .8) });
    }
  }
}
const rowPts = (r, dy = 0) => { const p = []; for (let X = -40; X <= W + 40; X += 60) p.push([X, rowY(r, X) + dy]); return p; };
export const V1 = {
  id: 'v1',
  layers: {
    skyB: { g: 1, grain: .1, draw(x) {
      bokashi(x, 0, FR.y0, W, 360, PAL.prus, .92, 0, { rough: 26, seed: 2 });
      bokashi(x, 0, 250, W, HZ1, PAL.sky, 0, .35, { rough: 18, seed: 6 });
      mountain(x, 330, HZ1 - 6, 132, 64, { body: PAL.prusL, snow: PAL.white, frac: .36, seed: 4 });
      // 水田：每块倒映天空（上浅下蓝，个别偏粉）
      for (const c of CELLS1) {
        const y0 = c.q[0][1], y1 = c.q[2][1], g = x.createLinearGradient(0, y0, 0, y1);
        const top = c.tint > .8 ? PAL.beniP : PAL.skyL;
        g.addColorStop(0, rgba(top, .35)); g.addColorStop(1, rgba(PAL.sky, .95 - c.r * .03));
        x.fillStyle = g; x.beginPath(); poly(x, c.q); x.fill();
      }
      // 远山倒影（落在最远一排水田里）
      x.save(); x.beginPath(); CELLS1.filter(c => c.r <= 1).forEach(c => poly(x, c.q)); x.clip();
      x.translate(0, 2 * (HZ1 + 18)); x.scale(1, -1); x.globalAlpha = .4; mountain(x, 330, HZ1 + 18, 132, 50, { body: PAL.prusL }); x.restore();
      // 村落屋顶（茅草）
      [[1560, 70], [1655, 54], [1740, 84]].forEach(([cx, w]) => { x.fillStyle = PAL.greyD; x.beginPath(); poly(x, [[cx - w / 2, HZ1 - 4], [cx - w * .28, HZ1 - 24], [cx + w * .28, HZ1 - 24], [cx + w / 2, HZ1 - 4]]); x.fill(); });
    } },
    greens: { g: 2, grain: .03, draw(x) {
      // 远树带
      x.fillStyle = PAL.greenD; x.beginPath(); x.moveTo(0, HZ1 + 8);
      for (let X = 0; X <= W; X += 14) x.lineTo(X, HZ1 - 3 - Math.abs(Math.sin(X * .05)) * 7 - vnoise(X * .015) * 12 - (X > 1480 && X < 1800 ? 10 : 0));
      x.lineTo(W, HZ1 + 16); x.lineTo(0, HZ1 + 16); x.fill();
      // 横向田埂
      x.lineCap = 'round'; x.lineJoin = 'round';
      for (let r = 1; r < ROWS1.length - 1; r++) { if (r === 6 || r === 7) continue; x.strokeStyle = PAL.green; x.lineWidth = 3 + 16 * sc1(ROWS1[r]); x.beginPath(); smooth(x, rowPts(r)); x.stroke(); }
      for (const d of DIKES1) { x.strokeStyle = PAL.green; x.lineWidth = d.w; x.beginPath(); x.moveTo(d.a[0], d.a[1]); x.lineTo(d.b[0], d.b[1]); x.stroke(); }
      // 主田埂（旅人走的路）
      rectFill(x, PAL.ochreL, 0, 746, W, 800);
      rectFill(x, PAL.green, 0, 738, W, 750); rectFill(x, PAL.greenD, 0, 796, W, 808);
      pine(x, 1790, 1060, 2.6, { seed: 3, lean: -.4, lines: false, minI: 4 });
    } },
    reds: { g: 3, draw(x) {
      bokashi(x, 0, 330, W, HZ1 - 2, PAL.beniL, 0, .8, { rough: 14, seed: 9 });
      x.fillStyle = PAL.beni; x.beginPath(); x.arc(1250, 452, 34, 0, TAU); x.fill();
      kasumi(x, 760, 478, 620, 18, PAL.beniP, .9); kasumi(x, 1330, 492, 460, 14, PAL.beniP, .85); kasumi(x, 170, 472, 320, 13, PAL.beniP, .8);
    } },
    key: { g: 0, speck: .12, draw(x) {
      mountain(x, 330, HZ1 - 6, 132, 64, { lines: true, lw: 1.8, snowLine: S, frac: .36, seed: 4 });
      x.fillStyle = S;
      for (let r = 1; r < ROWS1.length - 1; r++) { if (r === 6 || r === 7) continue; const w = 3 + 16 * sc1(ROWS1[r]); carve(x, rowPts(r, w / 2), 1 + 2.6 * sc1(ROWS1[r]), { taper: [0, 0], seed: r, per: 3, jit: .55 }); carve(x, rowPts(r, -w / 2), .6 + 1.2 * sc1(ROWS1[r]), { taper: [0, 0], seed: r + 20, per: 3, jit: .7 }); }
      for (const d of DIKES1) if (d.r >= 2) carve(x, [[d.a[0] + d.w * .5, d.a[1]], [d.b[0] + d.w * .5, d.b[1]]], .8 + d.w * .16, { taper: [.15, .15], seed: d.a[0], jit: .5 });
      carve(x, wob([[0, 738], [700, 739], [1300, 737], [W, 738]], 1.5, 3), 2.6, { taper: [0, 0] });
      carve(x, wob([[0, 808], [700, 809], [1300, 807], [W, 808]], 1.5, 4), 3, { taper: [0, 0] });
      pine(x, 1790, 1060, 2.6, { seed: 3, lean: -.4, fills: false, lw: 2.8, minI: 4 });
      x.strokeStyle = S; x.lineWidth = 1.6; x.beginPath(); x.arc(1250, 452, 34, 0, TAU); x.stroke();
    } },
  },
  paint(x, t, R) {
    R.L('skyB'); R.L('reds'); R.L('greens');
    // 秧苗：一簇簇，风吹成排起伏（8fps）
    const tq = q8(t);
    R.D(2, x => {
      x.strokeStyle = PAL.greenD; x.lineCap = 'round';
      for (const c of CELLS1) {
        if (!c.sprout || c.r < 3) continue;
        const [a, b, cc, d] = c.q, y0 = a[1], y1 = d[1], rows = Math.max(1, Math.round((y1 - y0) / (14 + 26 * sc1(y1))));
        for (let k = 0; k < rows; k++) {
          const v = (k + .6) / (rows + .2), y = lerp(y0, y1, v), sc = .35 + 1.5 * sc1(y), xl = lerp(a[0], d[0], v) + 10 * sc, xr = lerp(b[0], cc[0], v) - 10 * sc;
          x.lineWidth = .9 + sc * .9;
          for (let X = xl + (k % 2) * 9 * sc; X < xr; X += 22 * sc) {
            const sway = Math.sin(X * .005 - tq * 3.2 + c.r) * 4 * sc; x.beginPath();
            for (const dx of [-4, 0, 4]) { x.moveTo(X + dx * sc * .4, y); x.quadraticCurveTo(X + dx * sc * .7 + sway * .3, y - 7 * sc, X + dx * sc + sway, y - (11 - Math.abs(dx) * .6) * sc); }
            x.stroke();
          }
        }
      }
    });
    R.L('key');
    // 雁阵
    if (t > 3.5 && t < 10.5) R.D(0, x => { const u = (tq - 3.5) / 7; for (let i = 0; i < 7; i++) { const off = Math.abs(i - 3), px = lerp(1500, 520, u) + off * 34 + i * 2, py = 175 + off * 18 - (i < 3 ? 0 : 0) + Math.sin(u * 6 + i) * 3; goose(x, px, py, 1.25, Math.sin(tq * 9 + i) > 0 ? 1 : -.4); } });
    // 旅人：沿主田埂向左走
    const u = seg(t, 3.2, 10.5), px = lerp(1480, 930, u);
    R.D(3, x => traveler(x, px, 772, 128, { mode: t > 3.2 && t < 10.5 ? 'walk' : 'stand', ph: tq * 1.05, t: tq, wind: 1 }));
  },
};

// ————————————————————————— 二 · 雨の橋 —————————————————————————
const bridgeY = X => 452 + Math.pow((X - 960) / 780, 2) * 250;
export const V2 = {
  id: 'v2',
  layers: {
    back: { g: 1, grain: .06, draw(x) {
      bokashi(x, 0, FR.y0, W, 400, PAL.sumi, .88, 0, { rough: 30, seed: 12 });
      bokashi(x, 0, 300, W, 600, PAL.greyL, 0, .45, { rough: 20, seed: 13 });
      mountain(x, 560, 600, 560, 270, { body: '#8e959b', shade: '#7b8389', frac: .2, seed: 8 });
      // 远岸树影
      x.fillStyle = PAL.greyL; x.beginPath(); x.moveTo(0, 620);
      for (let X = 0; X <= W; X += 14) x.lineTo(X, 588 - vnoise(X * .018) * 26 - Math.abs(Math.sin(X * .045)) * 10);
      x.lineTo(W, 630); x.fill();
      x.fillStyle = '#9ea39f'; x.beginPath(); x.moveTo(1150, 630); for (let X = 1150; X <= W; X += 12) x.lineTo(X, 596 - vnoise(X * .03 + 4) * 34); x.lineTo(W, 640); x.fill();
      // 河
      const g = x.createLinearGradient(0, 615, 0, 1042); g.addColorStop(0, '#aebfc6'); g.addColorStop(1, PAL.ai); x.fillStyle = g; x.fillRect(0, 615, W, 440);
    } },
    bridge: { g: 2, grain: .05, draw(x) {
      fillPath(x, [[-20, 700], [120, 690], [260, 730], [300, 820], [200, 1060], [-20, 1060]], PAL.greenD);
      fillPath(x, [[1940, 690], [1760, 700], [1660, 740], [1640, 830], [1760, 1060], [1940, 1060]], PAL.greenD);
      x.fillStyle = PAL.green; for (let i = 0; i < 60; i++) { const L = i < 30, X = L ? hash(i) * 250 : 1680 + hash(i) * 240, Y = 720 + hash(i + 7) * 330; x.fillRect(X, Y, 2, -8 - hash(i + 2) * 8); }
      // 桥柱
      for (const X of [330, 470, 640, 820, 1100, 1280, 1450, 1590]) {
        const y = bridgeY(X) + 28; x.fillStyle = PAL.woodD; x.fillRect(X - 9, y, 18, 900 - y + (X % 3) * 6);
      }
      // 斜撑
      x.strokeStyle = PAL.woodD; x.lineWidth = 7;
      [[330, 470], [470, 640], [1280, 1450], [1450, 1590]].forEach(([a, b]) => { x.beginPath(); x.moveTo(a, bridgeY(a) + 60); x.lineTo(b, bridgeY(b) + 160); x.stroke(); });
      // 桥面侧板
      x.fillStyle = PAL.woodL; x.beginPath(); x.moveTo(170, bridgeY(170)); for (let X = 170; X <= 1750; X += 10) x.lineTo(X, bridgeY(X));
      for (let X = 1750; X >= 170; X -= 10) x.lineTo(X, bridgeY(X) + 30); x.fill();
      // 栏杆
      x.fillStyle = PAL.wood;
      for (let X = 200; X <= 1720; X += 95) x.fillRect(X - 5, bridgeY(X) - 50, 10, 50);
      x.strokeStyle = PAL.wood; x.lineWidth = 9; x.beginPath(); for (let X = 190; X <= 1730; X += 10) X === 190 ? x.moveTo(X, bridgeY(X) - 46) : x.lineTo(X, bridgeY(X) - 46); x.stroke();
    } },
    key: { g: 0, speck: .12, draw(x) {
      x.fillStyle = S;
      const top = [], bot = []; for (let X = 170; X <= 1750; X += 40) { top.push([X, bridgeY(X)]); bot.push([X, bridgeY(X) + 30]); }
      carve(x, top, 2.6, { taper: [.02, .02] }); carve(x, bot, 2.4, { taper: [.02, .02], seed: 3 });
      const rail = []; for (let X = 190; X <= 1730; X += 40) rail.push([X, bridgeY(X) - 50]); carve(x, rail, 2.2, { taper: [.02, .02], seed: 5 });
      const rail2 = []; for (let X = 190; X <= 1730; X += 40) rail2.push([X, bridgeY(X) - 41]); carve(x, rail2, 1.5, { taper: [.02, .02], seed: 6 });
      for (let X = 200; X <= 1720; X += 95) { x.fillRect(X - 6, bridgeY(X) - 50, 1.6, 50); x.fillRect(X + 4.5, bridgeY(X) - 50, 1.6, 50); }
      for (const X of [330, 470, 640, 820, 1100, 1280, 1450, 1590]) { const y = bridgeY(X) + 30, y2 = 900 + (X % 3) * 6; carve(x, [[X - 9, y], [X - 9, y2]], 1.8, { taper: [0, .3] }); carve(x, [[X + 9, y], [X + 9, y2]], 1.8, { taper: [0, .3] }); }
      carve(x, wob([[-20, 700], [120, 690], [260, 730], [300, 820], [240, 960]], 2, 3), 2.4, { taper: [0, .3] });
      carve(x, wob([[1940, 690], [1760, 700], [1660, 740], [1640, 830], [1700, 960]], 2, 4), 2.4, { taper: [0, .3] });
      mountain(x, 560, 600, 560, 270, { lines: true, lw: 1.6, lineCol: '#5d6166' });
    } },
  },
  paint(x, t, R) {
    R.L('back');
    const tq = q8(t), t12 = q12(t);
    // 水纹
    R.D(1, x => {
      x.strokeStyle = rgba(PAL.prusL, .8); x.lineWidth = 2.2; x.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const y = 650 + i * 15 + (i * i) * .45, sc = .5 + i * .06, ph = tq * 40 * sc + i * 97;
        x.beginPath();
        for (let X = -60 + ((ph % 180) + 180) % 180; X < W + 100; X += 180 * sc) { x.moveTo(X, y); x.quadraticCurveTo(X + 30 * sc, y - 6 * sc, X + 60 * sc, y); x.quadraticCurveTo(X + 90 * sc, y + 5 * sc, X + 115 * sc, y); }
        x.stroke();
      }
    });
    R.L('bridge'); R.L('key');
    // 旅人过桥（披蓑衣，压低斗笠）
    const u = seg(t, 11.7, 16.4), px = lerp(1400, 830, u);
    R.D(3, x => traveler(x, px, bridgeY(px) + 1, 124, { mode: t > 11.7 && t < 16.4 ? 'walk' : 'stand', ph: tq * .9, t: tq, tilt: -.16, mino: true }));
    // 前景柳枝（右上垂下，随风摆）
    R.D(2, x => {
      for (let i = 0; i < 11; i++) {
        const bx = 1440 + i * 44 + hash(i) * 20, len = 280 + hash(i + 3) * 300, sw = Math.sin(tq * 2.1 + i * .8) * 20 - 14;
        const P = s => [lerp(bx, bx - 40 + sw, s * s) - 12 * Math.sin(s * 3), 30 + len * s];
        x.strokeStyle = PAL.sumi; x.lineWidth = 1.5; x.beginPath(); for (let k = 0; k <= 16; k++) { const p = P(k / 16); k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); } x.stroke();
        x.fillStyle = PAL.greenD;
        for (let k = 2; k < 16; k++) { const p = P(k / 16), sd = k % 2 ? 1 : -1; x.beginPath(); x.ellipse(p[0] + sd * 5, p[1] + 2, 8, 1.8, sd * 1.25, 0, TAU); x.fill(); }
      }
    });
    // 雨
    R.D(0, x => rain(x, t12, [FR.x0 - 100, FR.y0 - 200, FR.x1, FR.y1]));
  },
};

// ————————————————————————— 三 · 茶屋の窓 —————————————————————————
const WC = [760, 450], WR = 318;
export const V3 = {
  id: 'v3',
  layers: {
    view: { g: 1, grain: .06, draw(x) {
      // 圆窗里的景：暮色 ぼかし + 大山
      x.save(); x.beginPath(); x.arc(WC[0], WC[1], WR, 0, TAU); x.clip();
      rectFill(x, '#f0dcc0', 0, 0, W, H);
      bokashi(x, WC[0] - WR, WC[1] - WR, WC[0] + WR, WC[1] + 40, PAL.prus, .95, 0, { rough: 14, seed: 21 });
      bokashi(x, WC[0] - WR, WC[1] - 20, WC[0] + WR, WC[1] + 170, '#e9a27c', 0, .85, { rough: 10, seed: 22 });
      mountain(x, 790, 700, 820, 450, { grad: [[0, PAL.prus], [.55, PAL.prusL], [1, '#7f9cb4']], shade: rgba(PAL.prusD, .45), snow: PAL.white, glow: '#e9a27c', frac: .34, seed: 5 });
      kasumi(x, 640, 600, 520, 30, PAL.beniP, .92); kasumi(x, 980, 648, 460, 26, PAL.beniP, .9);
      x.fillStyle = PAL.pine; x.beginPath(); x.moveTo(WC[0] - WR, 700); for (let X = WC[0] - WR; X <= WC[0] + WR; X += 12) x.lineTo(X, 672 - vnoise(X * .04) * 22 - Math.abs(Math.sin(X * .09)) * 8); x.lineTo(WC[0] + WR, 800); x.lineTo(WC[0] - WR, 800); x.fill();
      x.restore();
    } },
    room: { g: 2, grain: .018, baren: .22, draw(x) {
      // 灰泥墙（挖出圆窗）
      x.save(); x.beginPath(); x.rect(0, 0, W, H); x.arc(WC[0], WC[1], WR + 16, 0, TAU, true); x.clip('evenodd');
      rectFill(x, PAL.plaster, 0, 0, W, 890);
      bokashi(x, 0, 110, W, 420, '#b9a987', .5, 0, { rough: 30, seed: 23 });
      x.restore();
      // 窗框（竹环）
      x.strokeStyle = PAL.wood; x.lineWidth = 22; x.beginPath(); x.arc(WC[0], WC[1], WR + 9, 0, TAU); x.stroke();
      // 梁与柱
      rectFill(x, PAL.woodD, 0, FR.y0, W, 112); rectFill(x, PAL.wood, 0, 112, W, 128);
      rectFill(x, PAL.woodD, FR.x0, 112, 150, 890); rectFill(x, PAL.woodD, 1880 - 70, 112, 1880, 890);
      // 地板
      rectFill(x, PAL.woodL, 0, 880, W, H);
      x.strokeStyle = rgba(PAL.woodD, .55); x.lineWidth = 2; for (let i = 0; i < 7; i++) { const y = 900 + i * i * 4.5 + i * 8; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
      // 长凳 + 红毡
      rectFill(x, PAL.woodD, 1140, 812, 1162, 905); rectFill(x, PAL.woodD, 1790, 812, 1812, 905); rectFill(x, PAL.woodD, 1160, 850, 1790, 862);
      x.fillStyle = PAL.beni; x.beginPath(); poly(x, [[1110, 790], [1850, 790], [1854, 842], [1106, 842]]); x.fill();
      x.fillStyle = mix(PAL.beni, '#000', .25); x.fillRect(1106, 830, 748, 12);
      // 火盆 + 铁壶
      x.fillStyle = PAL.woodD; x.beginPath(); poly(x, [[930, 842], [1090, 842], [1080, 906], [940, 906]]); x.fill();
      x.fillStyle = PAL.sumiL; x.beginPath(); x.moveTo(958, 820); x.bezierCurveTo(958, 770, 1062, 770, 1062, 820); x.bezierCurveTo(1062, 846, 958, 846, 958, 820); x.fill();
      x.fillStyle = PAL.sumi; x.fillRect(996, 768, 28, 8); x.beginPath(); x.arc(1010, 766, 6, 0, TAU); x.fill();
      x.strokeStyle = PAL.sumi; x.lineWidth = 5; x.beginPath(); x.moveTo(966, 800); x.quadraticCurveTo(1010, 700, 1054, 800); x.stroke();
      x.fillStyle = PAL.sumiL; x.beginPath(); poly(x, [[1058, 812], [1090, 790], [1094, 796], [1060, 824]]); x.fill();
      x.fillStyle = PAL.beni; x.beginPath(); x.ellipse(1010, 846, 60, 6, 0, 0, TAU); x.fill();
      // 放在凳上的斗笠与靠着的手杖
      x.strokeStyle = PAL.woodL; x.lineWidth = 7; x.beginPath(); x.moveTo(1830, 895); x.lineTo(1868, 600); x.stroke();
    } },
    key: { g: 0, speck: .12, draw(x) {
      x.strokeStyle = S; x.lineWidth = 3; x.beginPath(); x.arc(WC[0], WC[1], WR, 0, TAU); x.stroke(); x.lineWidth = 2.4; x.beginPath(); x.arc(WC[0], WC[1], WR + 20, 0, TAU); x.stroke();
      // 竹节
      x.lineWidth = 2; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + .2; x.beginPath(); x.moveTo(WC[0] + Math.cos(a) * WR, WC[1] + Math.sin(a) * WR); x.lineTo(WC[0] + Math.cos(a) * (WR + 20), WC[1] + Math.sin(a) * (WR + 20)); x.stroke(); }
      x.save(); x.beginPath(); x.arc(WC[0], WC[1], WR, 0, TAU); x.clip(); mountain(x, 790, 700, 820, 450, { lines: true, lw: 2.4, snowLine: PAL.prusD, frac: .34, seed: 5 }); x.restore();
      x.fillStyle = S;
      const L = (a, b, w = 2.6) => carve(x, wob([a, b], 1.2, a[0] + b[1]), w, { taper: [0, 0] });
      L([0, 112], [W, 112], 3); L([0, 128], [W, 128]); L([150, 128], [150, 890]); L([1810, 128], [1810, 890]); L([0, 880], [W, 880], 3);
      L([1106, 790], [1854, 790]); L([1106, 842], [1854, 842]); L([1106, 790], [1106, 842]); L([1854, 790], [1854, 842]);
      L([1140, 842], [1140, 905]); L([1162, 842], [1162, 905]); L([1790, 842], [1790, 905]); L([1812, 842], [1812, 905]);
      L([930, 842], [1090, 842]); L([940, 906], [1080, 906]); L([930, 842], [940, 906]); L([1090, 842], [1080, 906]);
      x.strokeStyle = S; x.lineWidth = 2.4; x.beginPath(); x.moveTo(958, 820); x.bezierCurveTo(958, 770, 1062, 770, 1062, 820); x.bezierCurveTo(1062, 846, 958, 846, 958, 820); x.stroke();
    } },
  },
  paint(x, t, R) {
    R.L('view'); R.L('room'); R.L('key');
    const tq = q8(t);
    // 灯笼（右上，轻摆）
    R.D(3, x => {
      const sw = Math.sin(tq * 1.6) * .05; x.save(); x.translate(1450, 128); x.rotate(sw);
      x.strokeStyle = S; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, 40); x.stroke();
      x.fillStyle = PAL.sumi; x.fillRect(-42, 40, 84, 16); x.fillRect(-42, 236, 84, 16);
      x.fillStyle = '#f2dfa8'; x.beginPath(); x.ellipse(0, 146, 70, 92, 0, 0, TAU); x.fill();
      x.fillStyle = PAL.beni; x.font = '400 92px Yuji'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('茶', 0, 150);
      x.strokeStyle = S; x.lineWidth = 2.2; x.beginPath(); x.ellipse(0, 146, 70, 92, 0, 0, TAU); x.stroke();
      x.lineWidth = 1; x.strokeStyle = rgba(S, .6); for (let k = -3; k <= 3; k++) { x.beginPath(); x.ellipse(0, 146 + k * 25, 70 * Math.cos(k * .33), 5, 0, 0, Math.PI); x.stroke(); }
      x.restore();
      // 风铃
      const fs = Math.sin(tq * 3.1) * .18; x.save(); x.translate(WC[0] + 180, 128); x.rotate(fs);
      x.strokeStyle = S; x.lineWidth = 1.4; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, 30); x.stroke();
      x.fillStyle = rgba('#a9c8d0', .95); x.beginPath(); x.moveTo(-17, 58); x.quadraticCurveTo(-17, 30, 0, 30); x.quadraticCurveTo(17, 30, 17, 58); x.closePath(); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(0, 58); x.lineTo(0, 80); x.stroke();
      x.save(); x.translate(0, 80); x.rotate(Math.sin(tq * 3.1 + 1) * .3); x.fillStyle = PAL.beniL; x.fillRect(-9, 0, 18, 58); x.strokeRect(-9, 0, 18, 58); x.restore();
      x.restore();
    });
    // 前景框景：右上角伸进来一枝红叶（随风轻摆，偶有一片落下）
    R.D(3, x => momiji(x, tq));
    // 斗笠放在凳上
    R.D(3, x => kasa(x, 1640, 786, .05, 2.2, 3.1));
    // 铁壶的热气（8fps 卷曲上升）
    R.D(0, x => steam(x, 1094, 786, tq, 4, 1.1));
    const cup = ss(seg(t, 18.4, 19.2)) * (1 - ss(seg(t, 21.2, 21.8)));
    R.D(3, x => traveler(x, 1370, 887, 240, { mode: 'sit', t: tq, cup }));
    R.D(0, x => steam(x, 1370 + 2.4 * (lerp(-15, -11.5, cup) - 1), 887 + 2.4 * (lerp(-56, -74, cup) - 6), tq, 2, .7));
  },
};
function momiji(x, tq) {
  const sw = Math.sin(tq * 1.3) * .025;
  x.save(); x.translate(1935, 8); x.scale(.82, .82); x.rotate(sw);
  const br = [[0, 0], [-120, 70], [-230, 110], [-330, 190], [-380, 290]];
  const twigs = [[1, -60, 150], [2, -40, 220], [2, 30, 180], [3, -20, 300], [3, 60, 260], [1, 80, 90], [4, 10, 360]];
  x.lineCap = 'round';
  x.strokeStyle = PAL.sumi; x.lineWidth = 11; x.beginPath(); smooth(x, br); x.stroke(); x.strokeStyle = '#5a3a2a'; x.lineWidth = 7; x.beginPath(); smooth(x, br); x.stroke();
  const R = mulberry(33), leaves = [];
  for (const [i, dx, dy] of twigs) { const p = br[i]; const q = [p[0] + dx * .6 - 40, p[1] + dy * .35]; x.strokeStyle = PAL.sumi; x.lineWidth = 3; x.beginPath(); x.moveTo(p[0], p[1]); x.quadraticCurveTo((p[0] + q[0]) / 2, p[1] + 10, q[0], q[1]); x.stroke(); for (let k = 0; k < 5; k++) leaves.push([q[0] + (R() - .5) * 90, q[1] + (R() - .3) * 70, 16 + R() * 10, R() * TAU, R()]); }
  for (let k = 0; k < 8; k++) { const p = br[1 + (k % 4)]; leaves.push([p[0] + (R() - .5) * 70, p[1] + 20 + R() * 40, 14 + R() * 8, R() * TAU, R()]); }
  for (const [lx, ly, r, a, c] of leaves) leaf(x, lx, ly, r, a + Math.sin(tq * 2 + lx) * .06, c < .7 ? PAL.beni : c < .9 ? '#d0602e' : PAL.ochre);
  x.restore();
  // 一片落叶
  const ph = (tq * .16) % 1; leaf(x, 1560 - ph * 260 + Math.sin(ph * 12) * 40, 220 + ph * 640, 14, ph * 9, PAL.beni);
}
function leaf(x, cx, cy, r, a, col) {
  x.save(); x.translate(cx, cy); x.rotate(a); x.beginPath();
  for (let i = 0; i < 5; i++) { const t0 = -Math.PI / 2 + (i - 2) * .62, tip = [Math.cos(t0) * r, Math.sin(t0) * r], mid = [Math.cos(t0 + .31) * r * .45, Math.sin(t0 + .31) * r * .45]; i ? x.lineTo(tip[0], tip[1]) : x.moveTo(tip[0], tip[1]); if (i < 4) x.lineTo(mid[0], mid[1]); }
  x.lineTo(0, r * .15); x.closePath(); x.fillStyle = col; x.fill(); x.strokeStyle = PAL.sumi; x.lineWidth = 1.3; x.stroke();
  x.beginPath(); x.moveTo(0, r * .15); x.lineTo(0, r * .6); x.stroke(); x.restore();
}
function steam(x, bx, by, tq, n, sc) {
  x.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const ph = (tq * .45 + i / n) % 1, y0 = by - ph * 150 * sc, a = Math.sin(ph * Math.PI) * .8;
    x.strokeStyle = rgba(PAL.white, a); x.lineWidth = (9 - ph * 5) * sc;
    x.beginPath(); x.moveTo(bx + Math.sin(ph * 6 + i) * 8 * sc, y0);
    x.bezierCurveTo(bx + 22 * sc, y0 - 25 * sc, bx - 22 * sc, y0 - 45 * sc, bx + Math.sin(ph * 5 + i * 2) * 14 * sc, y0 - 70 * sc); x.stroke();
  }
}
// ————————————————————————— 四 · 海立つ —————————————————————————
export const HZ4 = 612;
export const ROCK4 = [[1300, 1060], [1330, 900], [1380, 830], [1440, 790], [1560, 772], [1680, 740], [1760, 660], [1830, 600], [1900, 590], [1940, 1060]];
export const V4 = {
  id: 'v4',
  layers: {
    back: { g: 1, grain: .07, draw(x) {
      bokashi(x, 0, -600, W, 330, PAL.prus, .95, 0, { rough: 30, seed: 31 });
      bokashi(x, 0, 380, W, HZ4, '#d8b58c', 0, .5, { rough: 16, seed: 32 });
      mountain(x, 430, HZ4 - 2, 240, 128, { body: PAL.prusL, snow: PAL.white, frac: .38, seed: 9 });
      kasumi(x, 520, HZ4 - 18, 420, 16, PAL.beniP, .9);
      const g = x.createLinearGradient(0, HZ4, 0, 1042); g.addColorStop(0, '#6f8fae'); g.addColorStop(1, PAL.prus); x.fillStyle = g; x.fillRect(0, HZ4, W, 460);
      x.fillStyle = S; carve(x, [[0, HZ4], [W, HZ4]], 2, { taper: [0, 0] });
    } },
    rock: { g: 2, grain: .05, draw(x) {
      rock(x, ROCK4, { fill: '#6a6f67', face: '#4c5a55', facets: [[[1420, 820], [1520, 860], [1480, 1060], [1360, 1060]], [[1700, 760], [1800, 700], [1860, 900], [1760, 1060], [1640, 1060]]] });
      x.fillStyle = PAL.greenD; for (let i = 0; i < 40; i++) { const X = 1420 + hash(i) * 460, Y = 780 + hash(i + 9) * 240; if (Y > 760 + (X > 1700 ? -60 : 0)) { x.beginPath(); x.arc(X, Y, 3 + hash(i + 3) * 4, 0, TAU); x.fill(); } }
      pine(x, 1800, 640, 1.25, { seed: 11, lean: -1.25, lines: false, extra: [[-260, -40, 40]] });
    } },
    key: { g: 0, speck: .12, draw(x) {
      mountain(x, 430, HZ4 - 2, 240, 128, { lines: true, lw: 2, snowLine: S, frac: .38, seed: 9 });
      rock(x, ROCK4, { lines: true, facets: [[[1420, 820], [1520, 860], [1480, 1060]], [[1700, 760], [1800, 700], [1860, 900]]], seed: 4 });
      pine(x, 1800, 640, 1.25, { seed: 11, lean: -1.25, fills: false, lw: 2.4, extra: [[-260, -40, 40]] });
    } },
  },
  paint(x, t, R, cam) {
    R.L('back');
    const t12 = q12(t), tq = q8(t);
    const WS = wstate(t, T), rise = WS.rise, crash = WS.fall;
    R.D(1, x => sea(x, tq, rise, 'far'));
    R.border();
    let G = null;
    R.free(x => { x.save(); x.beginPath(); x.rect(FR.x0, -3000, FR.x1 - FR.x0, 3000 + FR.y1); x.clip(); G = wave(x, t12, rise, crash); foam(x, G, t12, rise, crash, WS); x.restore(); });
    R.D(1, x => sea(x, tq, rise, 'near'));
    R.L('rock'); R.L('key');
    const hold = t > 25.9;
    R.D(3, x => traveler(x, 1500, 776, 118, { mode: 'stand', t: tq, wind: 1 + rise * 2, holdHat: hold, lean: hold ? .06 : 0 }));
  },
};

// ————————————————————————— 五 · 山 —————————————————————————
const M5 = [960, 900, 2280, 770];
const GR5 = X => 902 + Math.pow((X - 960) / 960, 2) * -70 + (vnoise(X * .02) - .5) * 14;
export const V5 = {
  id: 'v5',
  layers: {
    sky: { g: 1, grain: .07, draw(x) {
      bokashi(x, 0, FR.y0, W, 470, PAL.prus, .95, 0, { rough: 30, seed: 41 });
      bokashi(x, 0, 380, W, 900, PAL.sky, 0, .4, { rough: 20, seed: 42 });
      mountain(x, ...M5, { grad: [[0, PAL.prusD], [.45, PAL.prus], [1, PAL.prusL]], shade: rgba(PAL.prusD, .5), frac: .36, seed: 13 });
      // 山腰的冲沟（深色条）
      x.save(); x.beginPath(); poly(x, mtnPts(...M5)); x.clip(); x.strokeStyle = rgba(PAL.prusD, .55); x.lineCap = 'round';
      for (let i = 0; i < 22; i++) { const u = (i + .5) / 22, X = lerp(120, 1800, u), y0 = 935 - 800 * Math.pow(1 - Math.abs(u - .5) * 2, 1.6) * .62; x.lineWidth = 2 + hash(i) * 3; x.globalAlpha = .45; x.beginPath(); x.moveTo(X, y0); x.quadraticCurveTo(X + (u - .5) * 60, (y0 + 935) / 2, X + (u - .5) * 140, 935); x.stroke(); }
      x.restore();
    } },
    snow: { g: 2, draw(x) {
      mountain(x, ...M5, { snow: PAL.white, frac: .36, seed: 13 });
      // 雪上淡红（晨光）+ 霞带
      mountain(x, ...M5, { glow: '#e79a86', frac: .36, seed: 13 });
      kasumi(x, 560, 760, 1100, 46, '#f2e6cf', .95, .9); kasumi(x, 1460, 812, 980, 40, '#f2e6cf', .92, .9);
    } },
    ground: { g: 3, grain: .04, draw(x) {
      x.fillStyle = '#2f3d30'; x.beginPath(); x.moveTo(0, 860);
      for (let X = 0; X <= W; X += 20) x.lineTo(X, GR5(X)); x.lineTo(W, H); x.lineTo(0, H); x.fill();
      pine(x, 190, 880, .75, { seed: 21, lean: .2, lines: false, needle: '#23301f' }); pine(x, 1720, 875, .65, { seed: 22, lean: -.25, lines: false, needle: '#23301f' });
    } },
    key: { g: 0, speck: .12, draw(x) {
      mountain(x, ...M5, { lines: true, lw: 3, snowLine: PAL.prusD, frac: .36, seed: 13 });
      x.fillStyle = S; const r = []; for (let X = 0; X <= W; X += 40) r.push([X, GR5(X)]); carve(x, r, 2.6, { taper: [0, 0] });
      pine(x, 190, 880, .75, { seed: 21, lean: .2, fills: false, lw: 2 }); pine(x, 1720, 875, .65, { seed: 22, lean: -.25, fills: false, lw: 2 });
    } },
  },
  paint(x, t, R) {
    R.L('sky'); R.L('snow'); R.L('ground'); R.L('key');
    const tq = q8(t);
    // 一只鸢在高空盘旋
    if (t > 32) R.D(0, x => { const a = (tq - 32) * .35; const px = 1350 + Math.cos(a) * 160, py = 250 + Math.sin(a) * 40; goose(x, px, py, 1.5, Math.sin(tq * 2) * .3); });
    const off = ss(seg(t, T.hatOff[0], T.hatOff[1]));
    R.D(3, x => traveler(x, 960, GR5(960) + 4, 100, { mode: 'back', t: tq, hatOff: off }));
  },
};

export const VIEWS = [V1, V2, V3, V4, V5];
