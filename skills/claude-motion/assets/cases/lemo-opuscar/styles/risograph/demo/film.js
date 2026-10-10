// 《Sunday Ride》全片时间线：120 BPM，1 小节 = 2 s。所有时间对齐拍点（0.5 s）。
import { g, W, H, S, clear, rect, rrect, line, circle, ellipse, poly, text, over, inkA, layer, blob } from './draw.js';
import { clamp, lerp, seg, ss, eio, eo, ei, back, hash, mulberry } from '/core/lib.js';
import { PAL, riderBike, pigeon, baguette, figureSide, poseSit, L, head } from './rider.js';
import { river, RIVER, street, ST, bakeryBuilding } from './scenes.js';
import { park, parkFore, PARK, overhead, printerTable, printerBody, paperSheet, bellECU } from './scenes2.js';

export const DUR = 40;
export const SHOTS = [
  ['bell', 0, 2], ['street', 2, 8], ['bakery', 8, 16], ['park', 16, 19], ['pigeons', 19, 21.5],
  ['passenger', 21.5, 24], ['sun', 24, 26], ['stop', 26, 29], ['share', 29, 32], ['pull', 32, 36], ['end', 36, 40],
];
// 套色"跳一下"的节拍点（秒, 幅度 px）
const KICKS = [[2, 9], [5.5, 5], [8, 12], [12, 8], [16, 12], [20, 14], [24, 12], [30, 4], [31, 4], [36, 9], [38, 5]];
// 声音事件（给 mix.py）
export const EV = [];
const ev = (t, type, o = {}) => EV.push({ t, type, ...o });
ev(0.02, 'drum', { plate: 'blue' }); ev(1.0, 'bell', { n: 2 }); ev(2.0, 'titlehit');
ev(8.0, 'drum', { plate: 'yellow' }); ev(8.2, 'doorchime'); ev(12.0, 'catch'); ev(13.0, 'bell', { n: 2, gain: .8 });
ev(16.0, 'drum', { plate: 'pink' }); ev(19.5, 'bell', { n: 3 }); ev(20.0, 'flock'); ev(21.9, 'flap'); ev(22.05, 'land'); ev(22.7, 'coo');
ev(24.0, 'whoosh'); ev(26.0, 'brake'); ev(26.3, 'church'); ev(28.0, 'snap'); ev(29.5, 'crunch'); ev(30.6, 'coo'); ev(31.3, 'peck'); ev(31.7, 'peck');
ev(32.6, 'paperout'); ev(35.4, 'paperland'); ev(38.0, 'bell', { n: 2 });
// 环境与车轮（区间）
ev(0, 'amb', { kind: 'street', t1: 8 }); ev(8, 'amb', { kind: 'bakery', t1: 16 }); ev(16, 'amb', { kind: 'park', t1: 24 }); ev(24, 'amb', { kind: 'river', t1: 32 });
ev(0, 'ride', { t1: 2, v: 1 }); ev(2, 'ride', { t1: 8, v: .8 }); ev(8, 'ride', { t1: 16, v: 1 }); ev(16, 'ride', { t1: 24, v: 1 }); ev(24.6, 'ride', { t1: 26, v: .7 });

// 旁白（lines.json 的 t + dur.json）
let LINES = [];
export function setLines(lines, dur) {
  LINES = lines.map(l => ({ ...l, dur: dur[l.id] }));
  LINES.forEach((l, i) => { const nx = LINES[i + 1] ? LINES[i + 1].t : 1e9; l.t0 = l.t; l.t1 = Math.min(nx - .05, Math.max(l.t + l.dur + .7, l.t + 1.8)); ev(l.t, 'vo', { id: l.id }); });
}
export const subs = () => LINES.map(l => ({ t0: l.t0, t1: l.t1, text: l.text }));

// ───────── 印刷参数 ─────────
function regist(t) {
  const st = shotAt(t)[1] * 10;   // 每个镜头一套固定的错位（真实印刷：一张纸内套色是静止的）；只在节拍上跳
  const base = [[0, 0], [3, -2], [-3, 2.5]];
  const off = base.map((b, i) => [b[0] + (hash(st * 3 + i) - .5) * (i ? 3 : 1), b[1] + (hash(st * 7 + i + 50) - .5) * (i ? 3 : 1)]);
  for (const [tk, amp] of KICKS) {
    const x = t - tk; if (x < 0 || x > .5) continue;
    const e = Math.exp(-x * 11) * Math.cos(x * 34);
    for (let i = 0; i < 3; i++) { const a = hash(tk * 13 + i * 5) * 6.283; off[i][0] += Math.cos(a) * amp * e * (i ? 1 : .5); off[i][1] += Math.sin(a) * amp * e * (i ? 1 : .5); }
  }
  // 音乐停顿的一小节：三块版慢慢漂开，28.0 "咔"地套准
  if (t >= 26 && t < 28.6) {
    const d = t < 28 ? ss(seg(t, 26.05, 27.9)) : Math.exp(-(t - 28) * 16) * Math.cos((t - 28) * 40);
    const dv = [[-6, 5], [24, -13], [-22, 15]];
    for (let i = 0; i < 3; i++) { off[i][0] += dv[i][0] * d; off[i][1] += dv[i][1] * d; }
  }
  return off;
}
function plates(t) {
  // 蓝版 0.02–0.6 刷墨；黄版 8.0；粉版 16.0
  const sw = (a) => lerp(-60, W + 200, eio(seg(t, a, a + .55)));
  return {
    gate: [1, t >= 8 ? 1 : 0, t >= 16 ? 1 : 0],
    sweep: [t < 2 ? sw(0.02) : 1e5, t < 9 ? sw(8) : 1e5, t < 17 ? sw(16) : 1e5],
  };
}

// ───────── 工具 ─────────
const cam = (z, px, py, dx = 0, dy = 0) => g.setTransform(z, 0, 0, z, px * (1 - z) + dx, py * (1 - z) + dy);
const step = t => Math.floor(t * 12) / 12;          // 角色表演 on twos
const RS = .7;                                       // 街道段人物比例
const riderAt = (x, y, s, o) => layer(() => riderBike(x, y, s, { shadow: false, ...o }), o.halo ?? 5);

// ───────── 各镜头 ─────────
const SHOT = {
  bell(t) {
    const rg = t >= 1.0 ? t - 1.0 : -1;
    bellECU(t, rg);
    return {};
  },
  street(t) {
    const v = 240, cx = (t - 2) * v, tt = step(t);
    street({ cx, light: 0, sun: 0 });
    const wa = cx / (96 * RS), crank = wa / 2.2;
    const yawn = tt > 3.2 && tt < 4.3;
    riderAt(760, ST.RY, RS, { crank, wa, lean: .22, expr: yawn ? 'yawn' : (tt > 6.8 ? 'calm' : 'sleepy'), headO: { tilt: yawn ? -.12 : 0 }, ph: tt, scarfAmt: .7, bob: Math.sin(crank * 2) * 2 });
    // 片名（只印在蓝版上），2.0 起由左往右刷出，5.5 拍点撤下
    if (t >= 2 && t < 5.5) {
      g.save(); g.beginPath(); g.rect(0, 0, lerp(300, 1700, eo(seg(t, 2, 2.45))), H); g.clip();
      text('SUNDAY RIDE', 960, 215, '800 190px Bricolage', [1, 0, 0], 'center', 'alphabetic', 6);
      text('a ride in three plates', 960, 278, '500 40px Jost', [1, 0, 0], 'center', 'alphabetic', 8);
      g.restore();
    }
    return {};
  },
  bakery(t) {
    const Z = 1.3, v = 240, bb = bakeryBuilding(), doorX = bb.x + bb.w - 56;
    const cx12 = doorX - 710, cx = cx12 + (t - 12) * v, tt = step(t);
    const light = ss(seg(t, 8, 8.4));
    cam(Z, 760, ST.RY);
    street({ cx, light, sun: ss(seg(t, 8.2, 15)), lamps: 1 - seg(t, 13, 15) });
    // 面包师的手（从门里伸出）
    const ext = ss(seg(tt, 10.8, 11.5)) * (1 - ss(seg(tt, 12.4, 12.9)));
    const hx = doorX - cx + ext * 120, hy = ST.FB - 100 - ext * 110;
    if (ext > .01) {
      line([[doorX - cx - 20, ST.FB - 96], [hx, hy]], 36, [1, 0, .3]);
      line([[doorX - cx - 20, ST.FB - 96], [hx, hy]], 26, [0, .0, .0]);
      line([[doorX - cx - 20, ST.FB - 96], [lerp(doorX - cx - 20, hx, .4), lerp(ST.FB - 96, hy, .4)]], 26, [.3, 0, .1]);
      circle(hx + 6, hy, 13, PAL.skin);
      if (tt < 12) baguette(hx + 8, hy - 20, 210, -1.1);
    }
    // 骑车人
    const wa = cx / (96 * RS), crank = wa / 2.2;
    const hand = [(hx + 8 - 760) / RS, (hy - 8 - ST.RY) / RS];
    let o = { crank, wa, lean: .2, ph: tt, scarfAmt: .8, expr: 'calm', bob: Math.sin(crank * 2) * 2 };
    const inB = () => baguette(200, -330, 200, -1.15);
    if (tt >= 11.0 && tt < 12) { o.expr = tt > 11.5 ? 'surprise' : 'look'; o.headO = { tilt: -.15 }; o.armBend = 1; const k = ss(seg(tt, 11.2, 11.9)); o.armN = [lerp(42, hand[0] - 8, k), lerp(-306, hand[1] + 6, k)]; }
    else if (tt >= 12 && tt < 14.4) {
      const up = ss(seg(tt, 12, 12.4)), down = ss(seg(tt, 13.6, 14.4));
      o.headFlip = tt > 12.3 && tt < 13.3; o.expr = 'joy'; o.armBend = -1;
      const pUp = [-30, -560], pBk = [190, -330];
      o.armN = [lerp(lerp(hand[0], pUp[0], up), pBk[0], down), lerp(lerp(hand[1], pUp[1], up), pBk[1], down)];
      o.hand = w => { baguette(w[0] + 2, w[1] - 30 + down * 20, 200, lerp(-1.25, -1.15, down)); circle(w[0], w[1], 11, PAL.skin); };
      if (tt >= 12.9 && tt < 13.3) o.gripF = [50, -318];   // 另一只手按铃
    } else if (tt >= 14.4) { o.inBasket = inB; o.expr = 'calm'; }
    riderAt(760, ST.RY, RS, o);
    g.setTransform(1, 0, 0, 1, 0, 0);
    return {};
  },
  park(t) {
    const tt = step(t);
    park({ cx: 0, t });
    // 静止大全景：人物从左入画（塔蒂式：人小、景大）
    const x = lerp(-180, 520, seg(t, 16, 19)), s = .52;
    const wa = x / (96 * s), crank = wa / 2.2;
    riderAt(x, PARK.path + 20, s, { crank, wa, lean: .2, ph: tt, scarfAmt: .8, expr: 'calm', inBasket: () => baguette(200, -330, 200, -1.15), halo: 4 });
    // 小径右侧啄食的鸽子（伏笔）
    for (let i = 0; i < 5; i++) pigeon(1150 + i * 110 + (i % 2) * 30, PARK.path + 18 - (i % 2) * 10, .5, { pose: (Math.floor(tt * 2) + i) % 3 ? 'peck' : 'walk', step: tt * 2 + i * .3, flip: i % 2 === 1 });
    return {};
  },
  pigeons(t) {
    const tt = step(t);
    // 低机位：地平线压低，草地只露一条，天占大半
    cam(1.25, 960, 1080, 0, 0);
    park({ cx: 300 + (t - 19) * 60, t });
    g.setTransform(1, 0, 0, 1, 0, 0);
    // 车从左后方驶入
    const bx = lerp(-260, 820, seg(t, 19, 21.5)), s = .78;
    const wa = bx / (96 * s), crank = wa / 2.2;
    const gy = 1000;
    riderAt(bx, gy - 30, s, { crank, wa, lean: .2, ph: tt, scarfAmt: .8, expr: tt > 19.9 ? 'surprise' : 'calm', inBasket: () => baguette(200, -330, 200, -1.15), gripF: tt > 19.4 && tt < 19.8 ? [50, -318] : undefined });
    // 前景鸽群
    const R = mulberry(77);
    const birds = [];
    for (let i = 0; i < 16; i++) birds.push({ x: 150 + R() * 1700, y: gy + 20 + R() * 60, s: 1.2 + R() * 1.2, ph: R(), dx: (R() - .3) * 900, dy: -(700 + R() * 700), delay: R() * .35, fl: R() < .5 });
    birds.sort((a, b) => a.s - b.s);
    const flock = [];
    for (const b of birds) {
      const tb = t - 20 - b.delay;
      if (tb < 0) {
        if (b.y < gy + 20 + 60 && b.s < 2.6) pigeon(b.x, b.y - 30 * b.s, b.s * .9, { pose: (Math.floor(tt * 2 + b.ph * 5)) % 3 ? 'peck' : 'walk', step: tt * 2 + b.ph, flip: b.fl, tilt: t > 19.6 ? -.3 : 0 });
      } else flock.push(b);
    }
    // 起飞的鸽群：叠印（翅膀的蓝叠在粉花、黄天上 → 紫、绿）
    layer(() => {
      for (const b of flock) {
        const tb = t - 20 - b.delay, k = eo(clamp(tb / 1.4));
        const x = b.x + b.dx * k, y = b.y - 30 * b.s + b.dy * (tb * .9 - tb * tb * .08), s = b.s * (1 + tb * .35);
        pigeon(x, y, s * .85, { pose: 'fly', frame: Math.floor(tt * 12 / 1 + b.ph * 4), flip: b.dx < 0, rot: -.35 * Math.sign(b.dx) });
      }
    }, 3);
    return {};
  },
  passenger(t) {
    const tt = step(t), sc = 1.25, X = 640, Y = 1135;
    const cx = 900 + (t - 21.5) * 200;
    cam(1.7, 960, 820, 0, 0);
    park({ cx, t });
    g.setTransform(1, 0, 0, 1, 0, 0);
    const wa = cx / (96 * sc), crank = wa / 2.2;
    const land = seg(tt, 21.5, 22.05);
    const o = { crank, wa, lean: .2, ph: tt, scarfAmt: .8, bob: Math.sin(crank * 2) * 2, inBasket: () => baguette(200, -330, 200, -1.15) };
    o.expr = tt < 22.2 ? 'calm' : tt < 22.9 ? 'surprise' : 'joy';
    if (tt >= 22.2 && tt < 23.6) { o.headDX = 8; o.headO = { tilt: .3, lookX: 2, lookY: 3 }; }
    riderAt(X, Y, sc, o);
    // 鸽子落在车筐边（法棍旁）
    const px = X + 250 * sc, py = Y - 345 * sc;
    layer(() => {
      if (land < 1) pigeon(lerp(px + 620, px, eo(land)), lerp(py - 460, py, eo(land)), 1.3, { pose: 'fly', frame: Math.floor(tt * 12), flip: true });
      else pigeon(px, py, 1.3, { pose: 'stand', flip: true, tilt: tt > 22.6 && tt < 23.4 ? .45 : 0, look: tt > 22.6 && tt < 23.4 ? 'back' : undefined });
    }, 4);
    return {};
  },
  sun(t) {
    // 24.0–24.6：粉色圆从车筐那里长大吞没整个画面；24.6 画面底下换成河边；24.6–25.4 缩回成河上的太阳
    const grow = t < 24.6;
    let r, cxs, cys;
    if (grow) { SHOT.passenger(t); r = lerp(20, 2300, ei(seg(t, 24.0, 24.6))); cxs = 640 + 250 * 1.25; cys = 1135 - 400 * 1.25; }
    else {
      SHOT.riverRide(t);
      const k = eio(seg(t, 24.6, 25.5));
      r = lerp(2300, 330, k); cxs = lerp(960, 1000, k); cys = lerp(540, 500, k);
    }
    over(() => { g.beginPath(); g.arc(cxs, cys, r, 0, 7); g.fillStyle = inkA([0, 0, 1]); g.fill(); });
    return grow ? {} : { water: waterFx(t) };
  },
  riverRide(t) {
    const tt = step(t);
    river({ cx: 0 });
    const s = .98, y = RIVER.quay + 4;
    const x = lerp(260, 860, eo(seg(t, 24.6, 26.0)));
    const wa = x / (96 * s), crank = wa / 2.2;
    riderAt(x, y, s, { crank, wa, lean: .18, ph: tt, scarfAmt: .6, expr: 'calm', inBasket: () => baguette(200, -330, 200, -1.15) });
    layer(() => pigeon(x + 205 * s, y - (304 + 36) * s, s * 1.15, { pose: 'stand', flip: true }), 4);
    return { water: waterFx(t) };
  },
  stop(t) {
    const tt = step(t);
    river({ cx: 0 });
    const s = .98, x = 860, y = RIVER.quay + 4;
    const fd = ss(seg(tt, 26, 26.3));
    const o = { crank: .4, wa: 860 / (96 * s), lean: lerp(.18, .03, fd), ph: tt, scarfAmt: lerp(.6, .25, fd), expr: tt > 27.1 && tt < 27.25 ? 'blink' : 'calm', inBasket: () => baguette(200, -330, 200, -1.15) };
    if (fd > 0) { o.footDown = [lerp(-10, 30, fd), 0]; o.hip = [lerp(-88, -52, fd), lerp(-290, -252, fd)]; }
    if (tt > 26.6) o.headO = { tilt: .18, lookY: 2 };   // 低头看水
    riderAt(x, y, s, o);
    const ptilt = [0, .35, -.2, .4, 0, -.3][Math.floor((t - 26) * 2) % 6];
    layer(() => pigeon(x + 205 * s, y - (304 + 36) * s, s * 1.15, { pose: 'stand', flip: true, tilt: ptilt }), 4);
    return { water: waterFx(t) };
  },
  share(t) {
    const tt = step(t);
    // 中景：人坐在河堤护墙上，巨大的太阳在身后
    const HZ = 640, QY = 770;
    river({ cx: 0, hz: HZ, quay: QY, sunX: 1020, sunY: 420, sunR: 400, coping: 30, wallRow: 60 });
    // 倚墙的自行车（车筐已空）
    layer(() => riderBike(230, 1165, .95, { crank: 1, noRider: true }), 4);
    const mx = 800, wy = QY + 4, SC = 1.45;
    const tear = seg(tt, 29.4, 29.7), give = ss(seg(tt, 30.2, 30.7)), bite = tt > 31.1 && tt < 31.5;
    layer(() => {
      g.save(); g.translate(mx, wy); g.scale(SC, SC);
      const J = poseSit({
        handN: [lerp(120, 250, give), lerp(-100, -80, give)],
        handF: bite ? [72, -170] : [lerp(110, 60, tear), lerp(-100, -120, tear)],
        swing: Math.sin(t * 3) * 10,
      });
      figureSide(J, {
        ph: tt, scarfAmt: .25, expr: tt < 29.4 ? 'calm' : 'joy',
        hand: w => { if (tear > 0) baguette(w[0] + 30, w[1] - 4, 90, .1, { half: true, r: 12 }); else baguette(w[0] + 60, w[1] - 4, 200, .05); circle(w[0], w[1], 10.5, PAL.skin); },
      });
      if (tear > 0) { const w = J.wristF; baguette(w[0] - 10, w[1] - 16, 90, -1.0, { half: true, r: 12 }); circle(w[0], w[1], 10.5, PAL.skin); }
      g.restore();
    }, 5);
    // 鸽子：歪头、跳近、啄
    const hop = ss(seg(tt, 30.7, 31.0));
    const pk = (tt > 31.25 && tt < 31.4) || (tt > 31.65 && tt < 31.8);
    layer(() => pigeon(mx + lerp(560, 450, hop) * SC / 1.1, wy - 50 - Math.sin(hop * Math.PI) * 40, 1.75, { pose: pk ? 'peck' : (hop > 0 && hop < 1 ? 'walk' : 'stand'), step: hop * 2, flip: true, tilt: tt < 30.5 ? .4 : 0 }), 4);
    return { water: { ...waterFx(t), y: HZ, b: QY, refl: .4 } };
  },
  pull(t) {
    // 32–33：正上方俯拍；33–35.6：拉远 → 纸从出纸口滑出，落到纸堆上
    const k = eio(seg(t, 32.6, 35.4));
    const z = lerp(1, .3, k);
    if (z > .985) { overhead({ t }); return {}; }
    printerTable();
    // 纸堆（前面几张：只有蓝版的街、面包店、公园）
    const cxS = 960, cyS = 700, w = W * .3 * 1.08, h = H * .3 * 1.08;
    const old = [[[1, 0, 0], -.05, -34, 30, 'street'], [[1, 1, 0], .04, 26, 18, 'bakery'], [[1, 1, 1], -.02, -12, 8, 'park']];
    for (const [m, rot, dx, dy, kind] of old) {
      S.mask = m;
      paperSheet(cxS + dx, cyS + dy, w, h, rot, () => miniScene(kind));
      S.mask = [1, 1, 1];
    }
    // 当前这张：从出纸口滑下
    const fall = seg(t, 34.6, 35.4);
    const sy = lerp(lerp(540, 470, k), cyS, eo(fall));
    const sw = lerp(W * 1.08, w, k), shh = lerp(H * 1.08, h, k);
    paperSheet(lerp(960, cxS, k), sy, sw, shh, lerp(0, .015, fall), () => overhead({ t }));
    const bodyH = lerp(-200, 330, ss(seg(t, 33.4, 34.8)));
    if (bodyH > 0) printerBody(bodyH);
    return {};
  },
  end(t) {
    // 片尾卡：纸白；片名三版分别印、各自错位
    const sl = 4 + 10 * ss(seg(t, 36, 36.6));
    text('SUNDAY RIDE', 960 + sl, 470 + sl * .4, '800 170px Bricolage', [0, 0, 1], 'center', 'alphabetic', 6);
    over(() => { text('SUNDAY RIDE', 960 - sl, 470 - sl * .4, '800 170px Bricolage', [.8, 0, 0], 'center', 'alphabetic', 6); });
    text('RISOGRAPH PRINT', 960, 575, '600 44px Jost', [1, 0, 0], 'center', 'alphabetic', 14);
    text('LemoLab × Claude Opus 5.5', 960, 650, '500 34px Jost', [0, 0, 1], 'center', 'alphabetic', 3);
    // 套准十字
    const cross = (x, y) => { line([[x - 22, y], [x + 22, y]], 3, [1, 0, 0]); line([[x, y - 22], [x, y + 22]], 3, [1, 0, 0]); g.beginPath(); g.arc(x, y, 10, 0, 7); g.lineWidth = 3; g.strokeStyle = inkA([1, 0, 0]); g.stroke(); };
    cross(80, 80); cross(W - 80, 80); cross(80, H - 80); cross(W - 80, H - 80);
    // 底线上一个小小的骑车人横穿（38.0 按铃）
    line([[300, 880], [W - 300, 880]], 3, [.5, 0, .1]);
    const x = lerp(200, W - 200, seg(t, 36.6, 39.6)), s = .32;
    if (t > 36.6 && t < 39.6) riderAt(x, 878, s, { crank: x / 30 / 2.2, wa: x / 30, lean: .2, ph: step(t), scarfAmt: .9, expr: 'joy', inBasket: () => baguette(200, -330, 200, -1.15), halo: 3, gripF: t > 37.9 && t < 38.3 ? [50, -318] : undefined });
    return {};
  },
};
function waterFx(t) {
  const br = t >= 26 && t < 28 ? ss(seg(t, 26.05, 27.8)) : (t >= 28 && t < 28.4 ? 1 - seg(t, 28, 28.15) : 0);
  return { y: RIVER.horizon, b: RIVER.quay, amp: 6 + br * 12, t, sep: .3 + br * 1.4, refl: .6 };
}
function miniScene(kind) {
  if (kind === 'street') { street({ cx: 900, light: 0 }); riderBike(760, ST.RY, RS, { crank: 1, shadow: false, expr: 'sleepy' }); }
  else if (kind === 'bakery') { street({ cx: bakeryBuilding().x - 500, light: 1, sun: .8 }); riderBike(760, ST.RY, RS, { crank: 2, shadow: false, inBasket: () => baguette(200, -330, 200, -1.15) }); }
  else { park({ cx: 0, t: 3 }); riderBike(700, PARK.path + 20, .6, { crank: 1, shadow: false, inBasket: () => baguette(200, -330, 200, -1.15) }); }
}

export function shotAt(t) { for (const s of SHOTS) if (t >= s[1] && t < s[2]) return s; return SHOTS[SHOTS.length - 1]; }

// ───────── 字幕：纸白挖空条 + 蓝版文字 ─────────
function subtitle(t) {
  for (const l of LINES) {
    if (t < l.t0 || t >= Math.min(l.t1, 36)) continue;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = '500 42px Jost'; g.letterSpacing = '0.5px';
    const w = g.measureText(l.text).width + 64, y = 1000;
    rrect(960 - w / 2, y - 36, w, 64, 6, [0, 0, 0]);
    text(l.text, 960, y + 10, '500 42px Jost', [1, 0, 0], 'center', 'alphabetic', .5);
  }
}

const NOSUB = new URLSearchParams(location.search).has('nosub');
export function renderFilm(t) {
  clear();
  const [name, a] = shotAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const o = SHOT[name](t) || {};
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (!NOSUB) subtitle(t);
  const p = plates(t);
  return {
    seed: Math.floor(t * 12), sheet: SHOTS.findIndex(s => s[0] === name) * 3.7,
    off: regist(t), rot: [0, .0005, -.0004], period: 7, grain: .55,
    gate: p.gate, sweep: p.sweep, water: o.water || null,
  };
}
