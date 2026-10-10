// 夜村布景：红纸房子（翘檐、锯齿瓦、对联条、窗洞）、远山、梅树、雪地（白纸）、打孔雪花
import { PAL, piece, P, Pl, trace, fill, cut, cutLine, cutTaper, inset, within, ellipsePoly, curve, rnd, canvas, paperGrain } from './paper.js';
import { sawRow, sawEdge, crescent, crescentPts, crescentRows, swirl, doubleSwirl, rosette, plum, coin, dots, taper, along, cloudCut } from './motifs.js';

const V = {};
// ---------- 房子 ----------
// 原点 = 墙底中心；opt: w 墙宽, h 墙高, win: {x,y,w,h,round}, door: {x,w,h}, col
export function housePiece(opt = {}) {
  const w = opt.w || 420, h = opt.h || 230, col = opt.col || PAL.red, seed = opt.seed || 71;
  const rh = opt.rh || h * .62, ew = w / 2 + 60;
  const win = opt.win || { x: -w * .26, y: -h * .62, w: w * .26, h: h * .36 }, door = opt.door || { x: w * .2, w: w * .24, h: h * .7 };
  const box = [-ew - 40, -h - rh - 70, ew + 40, 12];
  const p = piece(box, g => {
    // 屋顶：翘檐 + 屋脊
    const eave = -h + 6, ridge = -h - rh;
    const roof = [[-ew - 30, eave - 44], [-ew - 8, eave - 22], [-ew + 30, eave - 8], [0, eave - 2], [ew - 30, eave - 8], [ew + 8, eave - 22], [ew + 30, eave - 44],
      [ew + 10, eave - 34], [ew - 40, eave - 30], [w * .36, ridge + 14], [w * .36 + 24, ridge - 26], [w * .36 + 8, ridge - 30], [w * .34, ridge], [-w * .34, ridge], [-w * .36 - 8, ridge - 30], [-w * .36 - 24, ridge - 26], [-w * .36, ridge + 14], [-ew + 40, eave - 30], [-ew - 10, eave - 34]];
    const rp = Pl(roof, true, .4, seed);
    fill(g, q => trace(q, rp), col);
    // 墙
    const wall = Pl([[-w / 2, eave - 4], [w / 2, eave - 4], [w / 2 + 4, -2], [w / 2 + 14, 0], [-w / 2 - 14, 0], [-w / 2 - 4, -2]], true, .3, seed + 1);
    fill(g, q => trace(q, wall), col);
    // 屋脊卷
    swirl(g, w * .36 + 10, ridge - 14, 12, 1.5, 3.4, 0, 1); swirl(g, -w * .36 - 10, ridge - 14, 12, 1.5, 3.4, Math.PI, -1);
    // 瓦：锯齿行 + 瓦垄
    const rows = 4;
    for (let k = 0; k < rows; k++) {
      const y = ridge + 14 + (eave - 34 - ridge - 14) * (k + .6) / rows, half = w * .34 + (ew - 30 - w * .34) * (k + .6) / rows;
      sawRow(g, [[-half, y], [half, y]], 11, 10, -1, .7);
      cutTaper(g, [[-half - 4, y + 2], [0, y + 3], [half + 4, y + 2]], 2.4);
    }
    cutTaper(g, [[-w * .33, ridge + 8], [0, ridge + 9], [w * .33, ridge + 8]], 3);
    // 檐下：一排圆孔 + 锯齿
    dots(g, along([[-ew + 30, eave - 18], [ew - 30, eave - 18]], 22).map(p => [p.x, p.y]), 3.2);
    // 窗洞
    if (win.round) cut(g, q => { q.arc(win.x, win.y, win.r, 0, Math.PI * 2); });
    else cut(g, q => { q.rect(win.x - win.w / 2, win.y - win.h / 2, win.w, win.h); });
    // 窗框刻线
    if (win.round) cut(g, q => { q.arc(win.x, win.y, win.r + 10, 0, 7); q.arc(win.x, win.y, win.r + 7, 0, 7, true); });
    else cut(g, q => { q.rect(win.x - win.w / 2 - 10, win.y - win.h / 2 - 10, win.w + 20, win.h + 20); q.rect(win.x - win.w / 2 - 7, win.y - win.h / 2 - 7, win.w + 14, win.h + 14); }, 'evenodd');
    // 门：两扇门 + 门环 + 对联条（只刻轮廓，不写字）+ 横批
    const dx = door.x, dw = door.w, dh = door.h;
    cutTaper(g, [[dx, -dh + 4], [dx, -dh / 2], [dx, -4]], 3);
    cut(g, q => { q.rect(dx - dw / 2, -dh, dw, dh); q.rect(dx - dw / 2 + 4, -dh + 4, dw - 8, dh - 4); }, 'evenodd');
    for (const s of [-1, 1]) { crescent(g, dx + s * 9, -dh * .5, 5, 0, Math.PI * 2 - .01, 2.2); }
    for (const s of [-1, 1]) cut(g, q => { const x = dx + s * (dw / 2 + 14); q.rect(x - 9, -dh + 6, 18, dh - 14); q.rect(x - 6.5, -dh + 8.5, 13, dh - 19); }, 'evenodd');
    cut(g, q => { q.rect(dx - dw / 2 - 4, -dh - 24, dw + 8, 15); q.rect(dx - dw / 2 - 1.5, -dh - 21.5, dw + 3, 10); }, 'evenodd');
    // 福字位的菱形斗方（空心轮廓）
    if (opt.doufang !== false) cut(g, q => { const cx = dx, cy = -dh * .72, r = dw * .2; q.moveTo(cx, cy - r); q.lineTo(cx + r, cy); q.lineTo(cx, cy + r); q.lineTo(cx - r, cy); q.closePath(); q.moveTo(cx, cy - r + 3); q.lineTo(cx - r + 3, cy); q.lineTo(cx, cy + r - 3); q.lineTo(cx + r - 3, cy); q.closePath(); });
    // 墙基：一排月牙砖
    within(g, wall, () => { g.save(); g.beginPath(); g.rect(-w, -18, w * 2, 16); g.clip(); crescentRows(g, -w / 2, -16, w / 2, -4, 9, 3, 0, .7); g.restore(); });
    cutTaper(g, [[-w / 2, -20], [0, -21], [w / 2, -20]], 2.4);
    inset(g, wall, 4, 1.6, col);
  }, { seed, col, ss: opt.ss || 2 });
  p.win = win; p.door = door; p.wallH = h; p.eave = -h;
  return p;
}
// ---------- 远山（一层）：锯齿山脊 + 云纹 ----------
export function mountainPiece(opt = {}) {
  const w = opt.w || 2600, col = opt.col || PAL.far, seed = opt.seed || 81, hs = opt.hs || 1;
  return piece([-w / 2, -420 * hs, w / 2, 40], g => {
    const top = [];
    for (let x = -w / 2; x <= w / 2; x += 20) { const u = x / w; const y = -(160 + 140 * Math.sin(u * 7.3 + seed) + 70 * Math.sin(u * 17.1 + seed * 2) + 40 * Math.sin(u * 31 + seed)) * hs * .9 - 60 * hs; top.push([x, y]); }
    const ridge = sawEdge(top, 16 * hs, 30, 1, .9, seed);
    const pts = [...ridge, [w / 2, 40], [-w / 2, 40]];
    fill(g, q => trace(q, pts), col);
    // 山体云纹
    for (let k = 0; k < 9; k++) { const x = -w / 2 + (k + .5) * w / 9 + (rnd(k, seed) - .5) * 120, y = -80 * hs - rnd(k, seed + 1) * 60 * hs; cloudCut(g, x, y, 26 * hs, 3.2, rnd(k, seed + 2) * 6, k % 2 ? 1 : -1); }
    // 山脊下的刻线
    const band = top.map(([x, y]) => [x, y + 34 * hs]);
    cutTaper(g, band, 3.4);
  }, { seed, col, ss: opt.ss || 1 });
}
// ---------- 梅树（红纸，花是孔） ----------
export function plumTreePiece(opt = {}) {
  const col = opt.col || PAL.red, seed = opt.seed || 91, s = opt.s || 1;
  return piece([-200, -520, 220, 10], g => {
    g.scale(s, s);
    const br = (x0, y0, a, L, w, d) => {
      const x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L, mx = (x0 + x1) / 2 + Math.cos(a + 1.57) * L * .12, my = (y0 + y1) / 2 + Math.sin(a + 1.57) * L * .12;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.stroke();
      if (d > 0) { br(x1, y1, a - .45 - rnd(d * 7, seed) * .3, L * .7, w * .66, d - 1); br(x1, y1, a + .4 + rnd(d * 5, seed) * .3, L * .62, w * .62, d - 1); }
      else { g.beginPath(); g.arc(x1, y1, 11, 0, 7); g.fillStyle = col; g.fill(); plum(g, x1, y1, 9, rnd(x1, seed) * 3); }
    };
    br(0, 0, -1.57, 150, 26, 4);
  }, { seed, col, ss: opt.ss || 2 });
}
// ---------- 雪地（米白纸，波浪边） ----------
export function snowPiece(opt = {}) {
  const w = opt.w || 3200, h = opt.h || 360, seed = opt.seed || 101;
  return piece([-w / 2, -80, w / 2, h], g => {
    const top = []; for (let x = -w / 2; x <= w / 2; x += 16) top.push([x, -18 * Math.sin(x * .004 + seed) - 12 * Math.sin(x * .011 + seed * 3) - 20]);
    fill(g, q => trace(q, [...top, [w / 2, h], [-w / 2, h]]), opt.col || '#f4ecd8');
    // 雪地上的小月牙（雪窝）
    for (let k = 0; k < 40; k++) { const x = -w / 2 + rnd(k, seed) * w, y = 30 + rnd(k, seed + 1) * (h - 60); crescent(g, x, y, 14 + rnd(k, seed + 2) * 10, Math.PI * .2, Math.PI * .8, 3); }
  }, { seed, col: opt.col || '#f4ecd8', ss: opt.ss || 1, edge: .8 });
}
// ---------- 打孔雪花：返回 (t, layer) → 画点 ----------
export function drawSnow(g, t, W, H, layer, C = [1, 0, 0, 1, 0, 0], opt = {}) {
  const n = [70, 50, 26][layer], r = [2.4, 3.8, 6][layer], sp = [26, 40, 62][layer], par = [.35, .6, 1][layer];
  const tt = Math.floor(t * 12) / 12;   // 12 fps 步进
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = opt.col || '#f3ead4';
  g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 2; g.shadowOffsetX = 1; g.shadowOffsetY = 1.5;
  for (let k = 0; k < n; k++) {
    const x0 = rnd(k, 11 + layer) * (W + 200), y0 = rnd(k, 13 + layer) * (H + 200);
    const x = ((x0 + Math.sin(tt * .9 + k) * 18 - C[4] * par * .3) % (W + 200) + W + 200) % (W + 200) - 100;
    const y = ((y0 + tt * sp) % (H + 200)) - 100;
    g.beginPath(); g.arc(x, y, r * (.7 + .5 * rnd(k, 17)), 0, 7); g.fill();
  }
  g.restore();
}

// ---------- 小红灯笼（挂檐下）：原点 = 挂绳顶 ----------
export function lanternPiece(opt = {}) {
  const col = opt.col || PAL.red, seed = opt.seed || 111;
  return piece([-30, -2, 30, 96], g => {
    g.strokeStyle = col; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 16); g.stroke();
    fill(g, q => q.rect(-10, 14, 20, 6), col);
    fill(g, q => q.ellipse(0, 42, 24, 22, 0, 0, 7), col);
    fill(g, q => q.rect(-9, 62, 18, 6), col);
    for (const v of [-12, 0, 12]) cutTaper(g, curve([[v * .6, 26], [v, 42], [v * .6, 58]], false, 2), 3.4);
    for (const x of [-5, 0, 5]) { g.beginPath(); g.moveTo(0, 68); g.lineTo(x * 1.4, 92); g.lineWidth = 2; g.stroke(); }
  }, { seed, col, ss: opt.ss || 3 });
}
