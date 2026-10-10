// 场景（片中复用）+ 关卡 1 风格帧
import { g, C, S, W, H, clear, piece, rough, roughC, rectP, circP, ellP, label } from './paper.js';
import { layout, drawLine } from './glyph.js';
import { agentSide, courierSide, key, runPose, walkPose, coRunPose, AGENT_POSE, COURIER_POSE } from './chars.js';
import { drawTitle, titleBox, CUT_ANG } from './title.js';
import { hash } from '/core/lib.js';

// ── 旁白字幕：纸白窄纸条 + 红钥匙孔图标（片头字幕的一部分） ──
export function subStrip(text, opt = {}) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = '600 44px LSpartan'; g.letterSpacing = '0.5px';
  const tw = g.measureText(text).width;
  const x = 96 + (opt.dx || 0), y = 958, h = 70, w = tw + 118;
  const dark = opt.dark;
  g.translate(x, y); g.rotate(-1 * Math.PI / 180);
  const strip = rough([[0, -h / 2], [w, -h / 2 + 2], [w - 16, h / 2], [-10, h / 2 - 1]], 777 + text.length, 1.1, 10);
  piece(strip, dark ? C.ink : C.paper, { gap: 0, shA: .35 });
  // 钥匙孔图标
  g.save(); g.translate(40, -12); g.scale(.28, .28);
  piece([[0, -31], ...circP(0, 0, 31, 24).slice(0), [0, 0]].slice(1), C.red, { gap: 0, shadow: false });
  piece([[-12.5, 20], [12.5, 20], [23, 118], [-23, 118]], C.red, { gap: 0, shadow: false });
  g.restore();
  g.fillStyle = dark ? C.paper : C.ink; g.textBaseline = 'middle';
  g.fillText(text, 78, 3);
  g.restore();
}

// ═══════════ 机场：STARRING THE AGENT ═══════════
export const AIR = { floor: 880, size: 900 };
export function airport(o) {
  clear(C.mus);
  const cam = o.cam || 0;
  // 天上：红色剪纸客机（沿网格斜线）
  if (o.plane) {
    const [px, py, pr] = o.plane;
    g.save(); g.translate(px - cam * .35, py); g.rotate(pr);
    piece(roughC('plane', () => [[-120, -8], [60, -12], [96, -4], [104, 2], [60, 10], [-110, 10], [-128, 2]], 601, 1, 8), C.red);
    piece(roughC('planeW', () => [[-10, 0], [22, 0], [-40, 58], [-62, 58]], 602, 1, 8), C.red);
    piece(roughC('planeT', () => [[-104, -4], [-86, -4], [-118, -40], [-132, -40]], 603, 1, 8), C.red);
    for (let i = 0; i < 6; i++) piece([[-60 + i * 18, -4], [-52 + i * 18, -4], [-52 + i * 18, 1], [-60 + i * 18, 1]], C.mus, { gap: 0, shadow: false });
    g.restore();
  }
  // 地面：墨黑地带 + 跑道长破折号
  piece(roughC('airFloor', () => rectP(-20, AIR.floor, W + 40, H - AIR.floor + 20), 610, 1.4, 14), C.ink, { gap: 0, shadow: false });
  for (let i = -2; i < 14; i++) {
    const x = ((i * 260 - cam * 1.25) % (260 * 14) + 260 * 14) % (260 * 14) - 300;
    piece(roughC('dash' + (i & 3), () => [[0, 0], [150, -2], [152, 14], [2, 16]], 620 + (i & 3), 1, 10).map(([a, b]) => [a + x, b + 980]), C.paper, { gap: 0, shadow: false });
  }
  // 悬挂的翻牌指示牌：THE AGENT
  const sx = 1500 - cam * .9;
  if (sx > -700 && sx < W + 100) {
    piece([[sx + 60, -10], [sx + 66, -10], [sx + 66, 60], [sx + 60, 60]], C.ink, { gap: 0 });
    piece([[sx + 454, -10], [sx + 460, -10], [sx + 460, 60], [sx + 454, 60]], C.ink, { gap: 0 });
    piece(roughC('board', () => rectP(0, 0, 520, 150), 630, 1.2, 12).map(([a, b]) => [a + sx, b + 52]), C.ink);
    const bl = layout('THE AGENT', 132, { track: .1 });
    drawLine(bl, sx + 260 - bl.width / 2, 52 + 128, { col: C.paper, seed: 40, jit: .6, gap: 0, shadow: false, amp: .8 });
    // 翻牌缝
    for (let i = 1; i < 9; i++) piece([[sx + i * 57.7, 56], [sx + i * 57.7 + 2, 56], [sx + i * 57.7 + 2, 198], [sx + i * 57.7, 198]], C.ink, { gap: 0, shadow: false });
    piece([[sx + 4, 124], [sx + 516, 124], [sx + 516, 127], [sx + 4, 127]], C.ink, { gap: 0, shadow: false });
  }
  // 巨型字母 STARRING（航站楼柱廊）
  const lay = layout('STARRING', AIR.size, { track: .2 });
  const lx = 60 - cam;
  const iIdx = 5;
  drawLine(lay, lx, AIR.floor + 4, { col: C.ink, seed: 21, jit: .7, amp: 2.2, shA: .35, each: (L) => L.i === iIdx ? { hide: true } : null });
  // 特工（在 I 后面）
  if (o.agentBehindI) { const Li = lay.letters.find(L => L.i === iIdx); const ix = lx + Li.x + (Li.x0 + Li.x1) / 2; o.agentBehindI(ix); }
  drawLine(lay, lx, AIR.floor + 4, { col: C.ink, seed: 21, jit: .7, amp: 2.2, shA: .45, each: (L) => L.i === iIdx ? null : { hide: true } });
  if (o.front) o.front();
  return { lay, lx };
}

// ═══════════ 列车：MUSIC BY THE SAMPLER ═══════════
export const TR = { rail: 858, base: 808, size: 380 };
export function trainLayout() {
  const words = ['MUSIC', 'BY', 'THE', 'SAMPLER'], out = []; let x = 0;
  for (const w of words) { const L = layout(w, TR.size, { track: .05 }); out.push({ w, L, x }); x += L.width + 130; }
  return { cars: out, len: x };
}
export function train(o) {
  clear(C.red);
  const cam = o.cam || 0, t = o.t || 0;
  // 远山（暗红，慢视差）
  for (let k = 0; k < 2; k++) {
    const par = .12 + k * .12, off = -((cam * par + t * (60 + k * 90)) % 1600);
    for (let r = -1; r < 3; r++) {
      const bx = off + r * 1600;
      piece(roughC('hill' + k, () => { const p = [[0, 900]]; for (let i = 0; i <= 16; i++) p.push([i * 100, 640 + k * 70 - Math.abs(Math.sin(i * 1.3 + k)) * (110 - k * 30) - (i % 5 === 2 ? 60 : 0)]); p.push([1600, 900]); return p; }, 700 + k, 2, 16).map(([a, b]) => [a + bx, b]), k ? '#b3301c' : C.redD, { gap: 0, shadow: false });
    }
  }
  // 电线杆（快，从右往左掠过）
  const spd = 1.0;
  for (let i = -1; i < 5; i++) {
    const x = ((i * 520 - (cam * spd + t * 900)) % 2600 + 2600) % 2600 - 200;
    piece(roughC('pole', () => [[-6, 250], [6, 250], [8, 870], [-8, 870]], 710, 1, 10).map(([a, b]) => [a + x, b]), C.redD, { gap: 0, shadow: false });
    piece(roughC('bar', () => [[-56, 280], [56, 276], [56, 289], [-56, 293]], 711, 1, 10).map(([a, b]) => [a + x, b]), C.redD, { gap: 0, shadow: false });
    // 电线：纸白细弧线连到下一根杆
    g.save(); g.strokeStyle = 'rgba(239,228,201,.75)'; g.lineWidth = 2.2; g.beginPath();
    for (const dy of [0]) { g.moveTo(x - 50, 283 + dy); g.quadraticCurveTo(x + 210, 330 + dy, x + 470, 283 + dy); g.moveTo(x + 50, 280 + dy); g.quadraticCurveTo(x + 310, 326 + dy, x + 570, 280 + dy); }
    g.stroke(); g.restore();
  }
  // 电线（纸白细线 → 网格母题）
  // 地面 + 铁轨
  piece(roughC('trGround', () => rectP(-20, TR.rail + 6, W + 40, 300), 720, 1.4, 14), C.ink, { gap: 0, shadow: false });
  piece(roughC('rail', () => rectP(-20, TR.rail - 2, W + 40, 9), 721, .8, 14), C.paper, { gap: 0, shadow: false });
  for (let i = -1; i < 22; i++) { const x = ((i * 96 - (cam + t * 900) * 1.0) % 2112 + 2112) % 2112 - 100; piece([[x, TR.rail + 16], [x + 44, TR.rail + 16], [x + 42, TR.rail + 24], [x + 2, TR.rail + 24]], C.redD, { gap: 0, shadow: false }); }
  // 车厢 = 单词
  const { cars, len } = trainLayout();
  const x0 = -cam;
  const bob = (i) => (Math.floor(t * 12) % 2) * (i % 2 ? 1 : -1) * 1.5;
  cars.forEach((c, i) => {
    const cx = x0 + c.x, w = c.L.width, by = TR.base + bob(i);
    if (cx > W + 50 || cx + w < -50) return;
    // 底盘 + 车钩
    piece(roughC('chassis' + i, () => rectP(-18, 0, w + 36, 26), 730 + i, 1.1, 10).map(([a, b]) => [a + cx, b + by]), C.ink);
    if (i < cars.length - 1) piece([[cx + w + 18, by + 8], [cx + w + 112, by + 8], [cx + w + 112, by + 16], [cx + w + 18, by + 16]], C.ink, { gap: 0 });
    // 车轮
    const nw = Math.max(2, Math.round(w / 150));
    for (let k = 0; k < nw; k++) {
      const wx = cx + 10 + (w - 20) * (nw === 1 ? .5 : k / (nw - 1)), wy = by + 34;
      piece(circP(wx, wy, 19, 20), C.ink, { gap: 2 });
      g.save(); g.translate(wx, wy); g.rotate(-(cam + t * 900) / 19);
      piece([[-14, -2], [14, -2], [14, 2], [-14, 2]], C.red, { gap: 0, shadow: false });
      g.restore();
    }
    drawLine(c.L, cx, by + 2, { col: C.ink, seed: 50 + i * 9, jit: .8, amp: 1.8, shA: .35 });
  });
  // 火车头（SAMPLER 前面）
  const last = cars[cars.length - 1], lx = x0 + last.x + last.L.width + 60;
  if (lx < W + 400) {
    const by = TR.base + bob(9);
    piece(roughC('loco', () => [[0, -250], [120, -250], [240, -40], [260, 30], [0, 30]], 740, 1.4, 10).map(([a, b]) => [a + lx, b + by]), C.ink);
    // 车灯 + 光束
    piece(roughC('beam', () => [[0, 0], [700, -120], [700, 90]], 741, 2, 20).map(([a, b]) => [a + lx + 200, b + by - 70]), 'rgba(226,165,42,.55)', { gap: 0, shadow: false });
    piece(circP(lx + 196, by - 70, 18, 18), C.mus, { gap: 3 });
    piece([[lx + 40, -330 + by], [lx + 80, -330 + by], [lx + 78, -250 + by], [lx + 42, -250 + by]], C.ink, { gap: 2 });   // 烟囱
  }
  const carTop = (i) => TR.base - (TR.size * .76) + bob(i);
  if (o.front) o.front({ cars, x0, carTop });
  return { cars, x0, carTop };
}

// ═══════════ 片名 ═══════════
export function titleScene(o) {
  clear(C.paper);
  const Ht = o.H || 250, { w, h } = titleBox(Ht);
  const x = (W - w) / 2 + (o.dx || 0), y = (H - h) / 2 - 20 + (o.dy || 0);
  // 背景：淡红细斜线网格（开场网格的回响）
  g.save(); g.globalAlpha = o.gridA ?? .9;
  for (let i = -8; i < 20; i++) {
    const bx = i * 150;
    const tn = Math.tan(CUT_ANG) * 1110;
    piece(rough([[bx, -10], [bx + 3, -10], [bx + 3 - tn, 1100], [bx - tn, 1100]], 800 + i, .4, 30), 'rgba(210,58,34,.22)', { gap: 0, shadow: false });
  }
  g.restore();
  const info = drawTitle(x, y, Ht, { split: o.split || 0, onLock: o.onLock });
  if (o.front) o.front({ x, y, w, h });
  return { x, y, w, h };
}

// ═══════════ 关卡 1 风格帧 ═══════════
export function frame(name, t, Q) {
  if (name === 'airport') {
    airport({
      cam: 1450, plane: [900, 120, -.2],
      agentBehindI: (ix) => agentSide(ix + 26, AIR.floor + 2, .86, AGENT_POSE.flatten),
      front: () => courierSide(1375, AIR.floor + 26, .8, { ...COURIER_POSE.lookBack, key: .35 }),
    });
    subStrip('He travels light.');
    return;
  }
  if (name === 'train') {
    const r = train({
      cam: 1060, t: 0,
      front: ({ cars, x0, carTop }) => {
        const c3 = cars[3], c2 = cars[2];
        const gapX = x0 + c2.x + c2.L.width + 65;
        courierSide(x0 + c3.x + c3.L.width - 190, carTop(3), .62, { ...COURIER_POSE.lookBack, key: .5 });
        agentSide(gapX - 30, carTop(2) - 10, .62, AGENT_POSE.leap);
      },
    });
    return;
  }
  if (name === 'title') {
    titleScene({
      split: 40, dx: -50,
      front: ({ x, y, w, h }) => {
        const bx = x + w + 100, by = y + h;
        const r = agentSide(bx, by, .62, { ...AGENT_POSE.stand, shF: 2.75, elF: .15, head: -.3, eye: 'open' });
        key(r.wrist[0] + 4, r.wrist[1] - 6, .62, Math.PI + .1);
      },
    });
    return;
  }
}
