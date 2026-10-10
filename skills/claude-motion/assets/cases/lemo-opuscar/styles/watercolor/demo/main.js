const cv = document.getElementById('c'), ctx = cv.getContext('2d');

// ---------- 地图（深时间） ----------
const MAPC = { k: 24, cx: 830, cy: 520, lon0: 133.8, lat0: -27.0, c: Math.cos(26 * Math.PI / 180) };
const mproj = (lon, lat) => [MAPC.cx + (lon - MAPC.lon0) * MAPC.k * MAPC.c, MAPC.cy - (lat - MAPC.lat0) * MAPC.k];
// 近似多年平均降雨（mm），只用来画示意分带
const STN = [[133.88, -23.7, 285], [130.98, -25.24, 310], [128.3, -25.03, 290], [134.19, -19.65, 450], [132.26, -14.47, 1100], [130.84, -12.46, 1730], [128.74, -15.77, 820], [127.67, -18.23, 570], [122.24, -17.96, 610], [118.6, -20.31, 320], [119.73, -23.36, 330], [116.85, -20.74, 290], [114.13, -21.93, 260], [113.66, -24.88, 230], [114.61, -28.78, 450], [115.86, -31.95, 730], [117.88, -35.02, 930], [121.89, -33.86, 620], [121.47, -30.75, 270], [118.49, -26.6, 240], [126.6, -26.13, 250], [128.88, -31.68, 270], [133.68, -32.13, 290], [134.72, -29.01, 150], [135.45, -27.55, 170], [137.3, -28.4, 125], [139.35, -25.9, 160], [139.9, -22.91, 260], [139.49, -20.73, 460], [141.08, -17.67, 920], [141.87, -12.63, 1950], [145.25, -15.47, 1750], [145.37, -16.46, 2300], [145.77, -16.92, 2000], [146.03, -17.52, 3500], [146.82, -19.26, 1130], [149.19, -21.14, 1600], [150.51, -23.38, 800], [144.25, -23.44, 440], [146.24, -26.4, 490], [153.03, -27.47, 1150], [153.4, -28.0, 1400], [153.11, -30.3, 1650], [152.9, -31.43, 1500], [151.21, -33.87, 1210], [148.6, -32.25, 590], [145.94, -30.09, 350], [141.47, -31.95, 250], [142.16, -34.19, 290], [138.6, -34.93, 550], [137.77, -32.49, 250], [140.78, -37.83, 710], [144.96, -37.81, 650], [149.13, -35.28, 620], [149.84, -36.67, 850], [147.37, -35.12, 570], [147.33, -42.88, 600], [145.33, -42.15, 1600], [147.14, -41.43, 670], [145.55, -42.08, 2400], [145.83, -31.5, 390], [140.5, -20.7, 470], [126.64, -14.3, 1200], [123.63, -17.3, 680], [131.1, -17.5, 650], [133.9, -21.5, 380], [130.9, -31.4, 240], [122.4, -28.6, 230], [119.7, -21.2, 380], [114.2, -27.7, 340], [113.5, -25.9, 220], [143.4, -31.6, 260], [144.8, -34.5, 370], [148.2, -23.5, 630], [148.8, -26.6, 590], [149.8, -29.5, 580], [141.7, -20.7, 480], [143.5, -18.3, 850], [143.2, -13.9, 1250], [136.8, -12.2, 1500], [136.3, -16.1, 900], [133.4, -16.3, 650], [133.1, -14.9, 950], [130.6, -18.3, 500], [130.0, -20.2, 420], [146.5, -38.3, 900], [143.6, -38.7, 1100], [135.9, -34.7, 450], [116.1, -34.3, 1100]];
const MAP = {};
let BANDL, BANDC;
const hash2 = (i, j) => hash(i * 12.9898 + j * 78.233);
function vn2(x, y) { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return lerp(lerp(hash2(i, j), hash2(i + 1, j), u), lerp(hash2(i, j + 1), hash2(i + 1, j + 1), u), v); }
const MSTOP = [[150, '#cf7c4f'], [300, '#cda35f'], [650, '#b3b07a'], [1150, '#7f9a6c'], [2000, '#46705a'], [4000, '#2f5a45']];
function mmColor(mm) {
  const L = Math.log(mm);
  for (let i = 0; i < MSTOP.length - 1; i++) { const a = Math.log(MSTOP[i][0]), b = Math.log(MSTOP[i + 1][0]); if (L <= b) return mixc(MSTOP[i][1], MSTOP[i + 1][1], clamp((L - a) / (b - a))); }
  return MSTOP[MSTOP.length - 1][1];
}
function buildMap() {
  BANDL = [250, 500, 900, 1500].map(Math.log); BANDC = [180, 360, 680, 1150, 2600].map(m => hex2rgb(mmColor(m)));
  const rings = AUS.map(r => r.map(([lo, la]) => mproj(lo, la)));
  MAP.rings = rings; MAP.path = new Path2D();
  for (const r of rings) { r.forEach(([x, y], i) => i ? MAP.path.lineTo(x, y) : MAP.path.moveTo(x, y)); MAP.path.closePath(); }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const r of rings) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cell = 4; MAP.cell = cell; MAP.x0 = Math.floor(x0) - 8; MAP.y0 = Math.floor(y0) - 8;
  MAP.nx = Math.ceil((x1 - x0 + 16) / cell); MAP.ny = Math.ceil((y1 - y0 + 16) / cell);
  const test = document.createElement('canvas').getContext('2d'), st = STN.map(([lo, la, mm]) => { const [x, y] = mproj(lo, la); return [x, y, Math.log(mm)]; });
  MAP.logmm = new Float32Array(MAP.nx * MAP.ny).fill(NaN); MAP.dn = new Float32Array(MAP.nx * MAP.ny); MAP.rad = new Float32Array(MAP.nx * MAP.ny); MAP.tex = new Float32Array(MAP.nx * MAP.ny);
  const [hx, hy] = mproj(133.2, -25.3);
  for (let j = 0; j < MAP.ny; j++) for (let i = 0; i < MAP.nx; i++) {
    const x = MAP.x0 + (i + .5) * cell, y = MAP.y0 + (j + .5) * cell, k = j * MAP.nx + i;
    // 往外多涂一圈，让海岸线笔触下面没有缝
    if (!test.isPointInPath(MAP.path, x, y) && !test.isPointInPath(MAP.path, x + 6, y) && !test.isPointInPath(MAP.path, x - 6, y) && !test.isPointInPath(MAP.path, x, y + 6) && !test.isPointInPath(MAP.path, x, y - 6)) continue;
    let sw = 0, sv = 0; for (const [sx, sy, lv] of st) { const d2 = (x - sx) ** 2 + (y - sy) ** 2 + 30; const w = 1 / (d2 * d2); sw += w; sv += w * lv; }
    MAP.logmm[k] = sv / sw;
    MAP.dn[k] = (vn2(x / 26, y / 26) - .5) * .5 + (vn2(x / 11, y / 11) - .5) * .12;
    MAP.tex[k] = 1 + (vn2(x / 9, y / 9) - .5) * .1 + (vn2(x / 40 + 7, y / 40) - .5) * .08;
    MAP.rad[k] = Math.hypot(x - hx, y - hy) + (vn2(x / 30, y / 30) - .5) * 90;
  }
  MAP.small = document.createElement('canvas'); MAP.small.width = MAP.nx; MAP.small.height = MAP.ny;
  MAP.sctx = MAP.small.getContext('2d'); MAP.img = MAP.sctx.createImageData(MAP.nx, MAP.ny);
  // 海岸线笔触
  MAP.coast = [];
  for (const r of rings) { const step = 26; for (let i = 0; i < r.length - 1; i += step) { const pts = r.slice(i, Math.min(r.length, i + step + 1)); if (pts.length > 1) MAP.coast.push(mk(pts, 3.6, INK, { prof: 'even', nb: 3, a: .85, rough: .35 })); } }
  // 火点（今天 500–900 mm 带）
  MAP.fires = []; let guard = 0;
  while (MAP.fires.length < 26 && guard++ < 5000) { const i = Math.floor(rnd(0, MAP.nx)), j = Math.floor(rnd(0, MAP.ny)), v = MAP.logmm[j * MAP.nx + i]; if (v > Math.log(480) && v < Math.log(950)) MAP.fires.push([MAP.x0 + i * cell, MAP.y0 + j * cell, rnd(0, 6)]); }
  // 我们走过的路：中心 → 雨林
  const [ax, ay] = mproj(131.04, -25.34), [bx, by] = mproj(145.4, -16.2);
  MAP.walk = qcurve(ax, ay, bx, by, -60, 40);
}
function mapTau(t) {
  if (t < 79.4) return 1;
  if (t < 80.8) return 1 - eio(seg(t, 79.4, 80.8));
  if (t < 86.2) return 0;
  return eio(seg(t, 86.2, 95.0));
}
function drawMapFill(tau, reveal, a) {
  const mult = Math.log(Math.exp(2.6 * (1 - tau))), d = MAP.img.data, R = lerp(-100, 900, reveal);
  const [c0, c1, c2, c3, c4] = [150, 300, 650, 1150, 2000];
  for (let k = 0, n = MAP.nx * MAP.ny; k < n; k++) {
    const v = MAP.logmm[k]; if (v !== v) { d[k * 4 + 3] = 0; continue; }
    const L = v + mult + MAP.dn[k] * 1.3; let b = 0; while (b < 4 && L > BANDL[b]) b++;
    const base = BANDC[b], tx = MAP.tex[k], col = [base[0] * tx, base[1] * tx, base[2] * tx];
    const edge = clamp((R - MAP.rad[k]) / 60);
    d[k * 4] = col[0]; d[k * 4 + 1] = col[1]; d[k * 4 + 2] = col[2]; d[k * 4 + 3] = Math.round(255 * edge);
  }
  MAP.sctx.putImageData(MAP.img, 0, 0);
  ctx.save(); ctx.globalAlpha = a; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.filter = 'blur(2.5px)';
  ctx.drawImage(MAP.small, MAP.x0, MAP.y0, MAP.nx * MAP.cell, MAP.ny * MAP.cell);
  ctx.restore();
}
function drawMap(t) {
  const tau = mapTau(t), offY = 90 * (1 - tau), endFade = 1 - .7 * ss(seg(t, 101, 103.2)), all = 1 - ss(seg(t, 112.4, 113.6));
  ctx.save(); ctx.translate(0, offY); ctx.globalAlpha = 1;
  const reveal = eio(seg(t, 75.6, 78.2));
  if (reveal > 0) drawMapFill(tau, reveal, .78 * endFade * all);
  // 海岸线
  const cp = seg(t, 73.3, 76.4), N = MAP.coast.length;
  for (let i = 0; i < N; i++) drawS(ctx, MAP.coast[i], (cp * N * 1.15 - i), null, endFade * all);
  // 火
  if (t > 89.2 && t < 95.5) for (let i = 0; i < MAP.fires.length; i++) {
    const [x, y, ph] = MAP.fires[i], I = ss(seg(t, 89.4 + ph * .25, 90 + ph * .25)) * (1 - ss(seg(t, 93.6 + ph * .2, 94.6 + ph * .2)));
    if (I > 0) flame(x, y + 6, 40 * I * (.8 + .2 * Math.sin(t * 8 + ph)), t, 700 + i);
  }
  ctx.restore();
  // 路线
  const wp = seg(t, 76.8, 78.8), wf = 1 - ss(seg(t, 79.0, 79.6));
  if (wp > 0 && wf > 0) {
    ctx.globalAlpha = wf;
    const m = Math.floor((MAP.walk.length - 1) * wp);
    for (let i = 0; i <= m; i += 1) { const [x, y] = MAP.walk[i]; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fillStyle = rgba(INK, .85); ctx.fill(); }
    if (wp >= 1) { const [x, y] = MAP.walk[MAP.walk.length - 1], [px, py] = MAP.walk[MAP.walk.length - 3], a = Math.atan2(y - py, x - px); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); ctx.lineTo(x + Math.cos(a + 2.5) * 12, y + Math.sin(a + 2.5) * 12); ctx.lineTo(x + Math.cos(a - 2.5) * 12, y + Math.sin(a - 2.5) * 12); ctx.closePath(); ctx.fill(); }
    const [mx, my] = MAP.walk[20]; hand('our walk', mx - 150, my - 50, seg(t, 77.4, 78.4), { size: 32 });
    const [ax, ay] = MAP.walk[0]; hand('desert', ax - 20, ay + 34, seg(t, 76.8, 77.6), { size: 26, align: 'center' });
    const [bx, by] = MAP.walk[MAP.walk.length - 1]; hand('rainforest', bx + 24, by - 4, seg(t, 78.4, 79.1), { size: 26 });
    ctx.globalAlpha = 1;
  }
  // 漂移
  const df = fade2(t, 86.8, 94.5, .6, .8);
  if (df > 0) { ctx.globalAlpha = df; const x = 1300, y0 = 640 + offY * .5; ctx.strokeStyle = rgba(INK, .75); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 - 110); ctx.moveTo(x - 9, y0 - 98); ctx.lineTo(x, y0 - 112); ctx.lineTo(x + 9, y0 - 98); ctx.stroke(); hand('drifting north', x + 18, y0 - 60, seg(t, 87.2, 88.4), { size: 30 }); ctx.globalAlpha = 1; }
  // 干心 / 绿边
  const lf = fade2(t, 97.3, 101.4, .3, .6);
  if (lf > 0) {
    ctx.globalAlpha = lf;
    const [hx, hy] = mproj(133.3, -24.8); leader(hx - 150, hy - 100, hx, hy, seg(t, 97.4, 97.9), 16); hand('dry heart', hx - 290, hy - 118, seg(t, 97.5, 98.3), { size: 42, w: 600 });
    const [ex, ey] = mproj(147.6, -20.4); leader(ex + 120, ey - 120, ex + 4, ey - 4, seg(t, 98.6, 99.1), -16); hand('green edge', ex + 70, ey - 146, seg(t, 98.7, 99.5), { size: 42, w: 600 });
    ctx.globalAlpha = 1;
  }
  // 右栏：时间计数 + 图例
  const rf = fade2(t, 76.2, 101.4, .8, .7);
  if (rf > 0) {
    ctx.globalAlpha = rf; ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const n = Math.round(50 * (1 - tau)), X = 1420;
    if (n === 0) { ctx.font = 'italic 500 104px "Cormorant Garamond"'; ctx.fillText('today', X, 330); }
    else { ctx.font = '500 150px "Cormorant Garamond"'; ctx.fillText(String(n), X, 330); ctx.font = 'italic 500 34px "Cormorant Garamond"'; ctx.fillText('million years ago', X + 6, 408); }
    ctx.font = '400 14px "IBM Plex Mono"'; ctx.letterSpacing = '3px'; ctx.fillStyle = rgba(INK, .7); ctx.fillText('ANNUAL RAINFALL', X + 4, 560); ctx.letterSpacing = '0px';
    const rows = [['< 250 mm', 180], ['250 – 500', 360], ['500 – 900', 680], ['900 – 1500', 1150], ['> 1500', 2600]];
    rows.forEach(([lab, mm], i) => {
      const q = seg(t, 77.0 + i * .18, 77.5 + i * .18); if (q <= 0) return; const y = 600 + i * 40;
      withSeed(900 + i, () => drawS(ctx, mk(qcurve(X + 4, y, X + 4 + 44 * eo(q), y, 0, 6), 16, mmColor(mm), { prof: 'even', nb: 4, a: .9 })));
      ctx.font = '400 17px "IBM Plex Mono"'; ctx.fillStyle = rgba(INK, .85 * q); ctx.fillText(lab, X + 66, y + 6);
    });
    ctx.font = 'italic 400 20px "Cormorant Garamond"'; ctx.fillStyle = rgba(INK, .55); ctx.fillText('schematic, from long-term averages', X + 4, 820);
    ctx.globalAlpha = 1;
  }
}

// ---------- 雾：把风景洗回白纸 ----------
function drawMist(t) {
  const c = eio(seg(t, 70.3, 73.6)); if (c <= 0) return;
  for (const [lift, a] of [[120, .55], [0, 1]]) {
    const top = 1180 - c * 1400 - lift;
    ctx.save(); ctx.beginPath(); ctx.moveTo(-10, 1100);
    for (let x = -10; x <= W + 40; x += 40) ctx.lineTo(x, top + (vnoise(x * .006 + lift) - .5) * 160 + Math.sin(x * .01 + t) * 12);
    ctx.lineTo(W + 10, 1100); ctx.closePath(); ctx.clip(); ctx.globalAlpha = a; ctx.drawImage(PAPER_IMG, 0, 0); ctx.restore();
  }
}

// ---------- HUD ----------
const BIOMES = [[11.2, 22.8, '01', 'Hummock grassland', 'the red centre', '#cf7c4f'], [23.0, 33.8, '02', 'Acacia shrubland', 'mulga country', '#cda35f'], [34.0, 51.8, '03', 'Eucalypt woodland', 'gum trees, and fire', '#b3b07a'], [52.0, 60.8, '04', 'Tall wet forest', 'the mountain ash', '#7f9a6c'], [61.2, 70.2, '05', 'Rainforest', 'the green edge', '#46705a']];
function drawHUD(t) {
  for (const [a, b, num, name, sub, col] of BIOMES) {
    const f = fade2(t, a, b, .6, .5); if (f <= 0) continue;
    const dy = (1 - eo(seg(t, a, a + .8))) * 14;
    ctx.globalAlpha = f; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    withSeed(40 + +num, () => drawS(ctx, mk(qcurve(86, 84 + dy, 86 + 30 * eo(seg(t, a, a + .6)), 84 + dy, 0, 5), 9, col, { prof: 'even', nb: 3, a: .9 })));
    ctx.font = '400 15px "IBM Plex Mono"'; ctx.letterSpacing = '3px'; ctx.fillStyle = rgba(INK, .7); ctx.fillText(num + ' / 05', 128, 90 + dy); ctx.letterSpacing = '0px';
    ctx.font = '500 52px "Cormorant Garamond"'; ctx.fillStyle = INK; ctx.fillText(name, 82, 146 + dy);
    ctx.font = 'italic 500 28px "Cormorant Garamond"'; ctx.fillStyle = rgba(INK, .7); ctx.fillText(sub, 86, 184 + dy);
    ctx.globalAlpha = 1;
  }
  const gf = fade2(t, 11.4, 70.2, .8, .6);
  if (gf > 0) {
    const mm = rainAt(camXf(t)), shown = mm < 1000 ? Math.round(mm / 10) * 10 : Math.round(mm / 100) * 100;
    const XR = 1836; ctx.globalAlpha = gf; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.font = '400 14px "IBM Plex Mono"'; ctx.letterSpacing = '3px'; ctx.fillStyle = rgba(INK, .7); ctx.fillText('ANNUAL RAINFALL', XR, 90); ctx.letterSpacing = '0px';
    ctx.font = '500 54px "Cormorant Garamond"'; ctx.fillStyle = INK; ctx.fillText((mm < 250 ? '< ' : '≈ ') + (mm < 250 ? 250 : shown.toLocaleString('en-US')) + ' mm', XR, 146);
    const bx0 = 1560, bx1 = XR, lg = v => bx0 + (bx1 - bx0) * (Math.log(v) - Math.log(100)) / (Math.log(4000) - Math.log(100)), by = 176;
    ctx.strokeStyle = rgba(INK, .5); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx0, by); ctx.lineTo(bx1, by); ctx.stroke();
    ctx.strokeStyle = rgba('#3f7fa8', .85); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx0, by); ctx.lineTo(lg(mm), by); ctx.stroke();
    ctx.font = '400 12px "IBM Plex Mono"'; ctx.textAlign = 'center'; ctx.fillStyle = rgba(INK, .6);
    for (const [v, lab] of [[250, '250'], [500, '500'], [1000, '1k'], [2000, '2k'], [4000, '4k']]) { ctx.fillRect(lg(v) - .75, by - 5, 1.5, 10); ctx.fillText(lab, lg(v), by + 22); }
    const mx = lg(mm); ctx.beginPath(); ctx.moveTo(mx, by - 24); ctx.bezierCurveTo(mx + 7, by - 14, mx + 7, by - 8, mx, by - 7); ctx.bezierCurveTo(mx - 7, by - 8, mx - 7, by - 14, mx, by - 24); ctx.fillStyle = '#3f7fa8'; ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ---------- 字幕 ----------
function wrap(txt, maxW) {
  if (ctx.measureText(txt).width <= maxW) return [txt];
  const words = txt.split(' '); let best = null;
  for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' '), b = words.slice(i).join(' '), m = Math.max(ctx.measureText(a).width, ctx.measureText(b).width); if (!best || m < best[0]) best = [m, a, b]; }
  return [best[1], best[2]];
}
function drawSubs(t) {
  for (const [, s, d, en, zh] of VO) {
    const f = fade2(t, s - .15, s + d + .45, .25, .35); if (f <= 0) continue;
    ctx.save(); ctx.globalAlpha = f; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = rgba(PAPER, 1); ctx.shadowBlur = 18;
    ctx.font = 'italic 500 36px "Cormorant Garamond"'; const lines = wrap(en, 1400);
    const y0 = lines.length > 1 ? 962 : 1000;
    for (let k = 0; k < 2; k++) { ctx.fillStyle = INK; lines.forEach((ln, i) => ctx.fillText(ln, 960, y0 + i * 38)); }
    ctx.font = '400 24px "Noto Serif SC"'; ctx.fillStyle = rgba(INK, .78);
    for (let k = 0; k < 2; k++) ctx.fillText(zh, 960, 1042);
    ctx.restore();
  }
}

// ---------- 片头 / 片尾 ----------
function titleBlock(t, t0, y, big, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `italic 500 ${big}px "Cormorant Garamond"`; const w = ctx.measureText('Follow the Rain').width;
  ctx.save(); ctx.beginPath(); ctx.rect(960 - w / 2 - 20, y - big, (w + 40) * eio(seg(t, t0, t0 + 1.6)), big * 1.4); ctx.clip();
  ctx.fillStyle = INK; ctx.fillText('Follow the Rain', 960, y); ctx.restore();
  ctx.font = '500 25px "Cormorant Garamond"'; ctx.letterSpacing = '7px'; ctx.fillStyle = rgba(INK, .75 * ss(seg(t, t0 + 1.0, t0 + 1.8)));
  ctx.fillText('AUSTRALIA’S VEGETATION, FROM DRY HEART TO GREEN EDGE', 966, y + 72); ctx.letterSpacing = '0px';
  ctx.font = '400 26px "Noto Serif SC"'; ctx.letterSpacing = '6px'; ctx.fillStyle = rgba(INK, .7 * ss(seg(t, t0 + 1.4, t0 + 2.2)));
  ctx.fillText('跟着雨走 · 澳洲植被图卷', 963, y + 122); ctx.letterSpacing = '0px';
  ctx.restore();
}
function drawTitle(t) { const a = 1 - ss(seg(t, 9.9, 10.9)); if (a > 0) titleBlock(t, 2.3, 440, 124, a); }
function drawEnd(t) {
  if (t < 101.6) return;
  const a = 1 - ss(seg(t, 112.4, 113.4));
  titleBlock(t, 101.9, 480, 118, a);
  const cf = ss(seg(t, 105, 106.2)) * a;
  if (cf > 0) {
    ctx.save(); ctx.globalAlpha = cf; ctx.textAlign = 'center'; ctx.fillStyle = rgba(INK, .75); ctx.font = '400 15px "IBM Plex Mono"'; ctx.letterSpacing = '2px';
    ctx.fillText('MUSIC  “Wildflowers” by Scott Buckley  ·  CC BY 4.0  ·  scottbuckley.com.au', 960, 930);
    ctx.fillText('VOICE  Kokoro TTS   ·   COASTLINE  Natural Earth   ·   RAINFALL BANDS ARE SCHEMATIC', 960, 960);
    ctx.letterSpacing = '0px'; ctx.font = 'italic 500 30px "Cormorant Garamond"'; ctx.fillStyle = rgba(INK, .85);
    ctx.fillText('LemoLab × Claude Opus 5.5', 960, 1010);
    ctx.restore();
  }
}

// ---------- 主渲染 ----------
let PAPER_IMG;
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  ctx.drawImage(PAPER_IMG, 0, 0);
  if (t < 73.7) { drawLandscape(t); drawNotes(t); }
  if (t > 70.3) drawMist(t);
  if (t > 73.2) drawMap(t);
  drawHUD(t);
  if (t < 11) drawTitle(t);
  drawEnd(t);
  drawSubs(t);
}
window.render = render;

(async () => {
  PAPER_IMG = new Image(); PAPER_IMG.src = 'paper.jpg'; await PAPER_IMG.decode();
  await Promise.all(['500 52px "Cormorant Garamond"', 'italic 500 36px "Cormorant Garamond"', '500 30px Caveat', '600 30px Caveat', '400 15px "IBM Plex Mono"', '400 24px "Noto Serif SC"'].map(f => document.fonts.load(f, 'Aa跟着雨走')));
  build(); buildMap();
  const c612 = camXf(61.2);
  for (const lay of ['main', 'mid']) for (const pl of PL[lay]) if (zoneOf(pl.wx) === 'rain') { const X = 960 + pl.xl - c612 * LAY[lay].par; if (X < 2150) pl.burst = 61.15 + .5 * clamp(X / 1920); }
  window.READY = true;
})();
