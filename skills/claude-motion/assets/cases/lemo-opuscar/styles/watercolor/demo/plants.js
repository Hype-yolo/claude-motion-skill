// ---------- 植物生成器：局部坐标，原点 = 根部落地点，y 向上为负 ----------
const COL = {
  straw: ['#b59a55', '#a38d4b', '#8c8446', '#c2a864'],
  mulga: ['#8a9577', '#77866a', '#9aa487', '#6c7a60'],
  salt: ['#9aa7a0', '#8b9a93', '#aab4ab'],
  gum: ['#7f9677', '#6b8466', '#93a88a', '#5f7a5c'],
  gold: ['#c9b06a', '#b19c5a', '#d4bd78', '#a8a061'],
  ash: ['#5d6f55', '#6f8163', '#4f6249'],
  fern: ['#4f7a46', '#5f8a52', '#3f6a3e', '#6c9658'],
  rain: ['#2f5a45', '#3f6f4f', '#56845a', '#244a39', '#4a7a57'],
  rainLite: ['#56845a', '#6a9565', '#4a7a57', '#7aa06c'],
  palm: ['#3f7a55', '#4e8a5e', '#357050'],
  wattle: ['#e0ae35', '#ecc24a', '#d69f2c'],
};

function spinifex(sc) {
  const S = [], r = rnd(45, 75) * sc, hh = r * rnd(.5, .62);
  S.push(mk(qcurve(-r * 1.05, 2, r * 1.05, 2, -hh * 1.1, 12), hh * .9, '#c9a15e', { prof: 'leaf', a: .32, nb: 5 }));
  const N = Math.round(46 * sc + 16);
  for (let i = 0; i < N; i++) {
    const u = rnd(-1, 1), a = Math.PI + (u + 1) / 2 * Math.PI; // 穹顶上的一点
    const bx = Math.cos(a) * r * .55, by = Math.sin(a) * hh * .45;
    const ang = a + rnd(-.25, .25), len = r * rnd(.4, .62);
    S.push(mk(polar(bx, by, ang, len, rnd(-.18, .18) * len, 6), rnd(2.2, 3.4) * sc, pick(COL.straw), { prof: 'tip', nb: 0, a: rnd(.75, .95) }));
  }
  for (let i = 0; i < 7; i++) { const a = Math.PI + rnd(.15, .85) * Math.PI; S.push(mk(polar(Math.cos(a) * r * .4, Math.sin(a) * hh * .3, a + rnd(-.2, .2), r * rnd(.45, .65), rnd(-6, 6), 6), 1.6 * sc, INK, { prof: 'tip', nb: 0, a: .5 })); }
  return { S };
}

function desertOak(sc) {
  const S = [], Hh = rnd(170, 240) * sc, tx = rnd(-10, 10) * sc;
  const trunk = mk(qcurve(0, 0, tx, -Hh * .8, rnd(-8, 8) * sc, 12), 8 * sc, INK, { prof: 'tip', nb: 3 });
  S.push(trunk);
  for (let i = 0; i < 4; i++) { const y = -Hh * rnd(.5, .75), sx = tx * (-y / Hh / .8); S.push(mk(polar(sx, y, -Math.PI / 2 + rnd(-.9, .9), rnd(30, 55) * sc, rnd(-6, 6), 6), 3 * sc, INK, { prof: 'tip', nb: 0 })); }
  const N = Math.round(34 * sc + 8);
  for (let i = 0; i < N; i++) {
    const a = rnd(0, Math.PI * 2), rr = Math.sqrt(rnd());
    const x = tx + Math.cos(a) * rr * Hh * .3, y = -Hh * .86 + Math.sin(a) * rr * Hh * .16;
    S.push(mk(polar(x, y, Math.PI / 2 + rnd(-.25, .25), rnd(25, 60) * sc, rnd(-6, 6) * sc, 6), rnd(2, 3.4) * sc, pick(['#56604c', '#6c735a', '#4b5343']), { prof: 'tip', nb: 0, a: rnd(.7, .95) }));
  }
  return { S };
}

function mulga(sc) {
  const S = [], Hh = rnd(120, 170) * sc, n = 4 + Math.floor(rnd(0, 3)), stems = [], tips = [];
  for (let i = 0; i < n; i++) {
    const bx = rnd(-5, 5) * sc, ang = -Math.PI / 2 + (i - (n - 1) / 2) * .27 + rnd(-.08, .08), len = Hh * rnd(.62, .8);
    const pts = polar(bx, 0, ang, len, rnd(-8, 8) * sc, 8);
    S.push(mk(pts, rnd(4, 6) * sc, INK2, { prof: 'tip', nb: 3 })); stems.push(pts);
    const e = pts[pts.length - 1];
    for (const da of [-.35, .3]) { const t = polar(e[0], e[1], ang + da, len * .28, 0, 4); S.push(mk(t, 2.2 * sc, INK2, { prof: 'tip', nb: 0 })); tips.push(t[t.length - 1]); }
  }
  for (const [x, y] of tips) clump(S, x, y - 6 * sc, 20 * sc, 12, COL.mulga, { dir: -Math.PI / 2, spread: .5, l0: 10 * sc, l1: 20 * sc, w0: 4 * sc, w1: 7 * sc, sx: 1.4, sy: .6 });
  return { S, stems, top: -Hh };
}

function saltbush(sc) { const S = []; clump(S, 0, -12 * sc, 22 * sc, 14, COL.salt, { l0: 6 * sc, l1: 12 * sc, w0: 6 * sc, w1: 10 * sc, sx: 1.5, sy: .6 }); return { S }; }

function wattle(sc) {
  const S = [], Hh = rnd(70, 100) * sc;
  for (let i = 0; i < 4; i++) S.push(mk(polar(rnd(-4, 4), 0, -Math.PI / 2 + rnd(-.5, .5), Hh * rnd(.6, .9), rnd(-6, 6), 6), 2.5 * sc, INK2, { prof: 'tip', nb: 0 }));
  clump(S, 0, -Hh * .75, Hh * .35, 18, ['#7d8f5c', '#6e8052'], { l0: 8 * sc, l1: 15 * sc, w0: 3 * sc, w1: 5 * sc, sy: .9 });
  for (let i = 0; i < 26; i++) { const a = rnd(0, 6.28), r = Hh * .45 * Math.sqrt(rnd()), x = Math.cos(a) * r * 1.2, y = -Hh * .75 + Math.sin(a) * r * .9; S.push(mk(qcurve(x, y, x + 2, y + 1, 0, 3), rnd(6, 9) * sc, pick(COL.wattle), { prof: 'leaf', nb: 0, a: .92 })); }
  return { S };
}

function tussock(sc, cols = COL.gold, n = 14) {
  const S = [];
  for (let i = 0; i < n; i++) {
    const side = rnd(-1, 1), ang = -Math.PI / 2 + side * .95, len = rnd(28, 58) * sc;
    S.push(mk(polar(side * 6 * sc, 0, ang, len, side * len * .25, 6), rnd(2, 3.2) * sc, pick(cols), { prof: 'tip', nb: 0, a: rnd(.7, .92) }));
  }
  return { S };
}

// 桉树：浅色树干 + 弯折枝 + 下垂叶团（稀疏、透光）
function gum(sc, hm = 1) {
  const woody = [], leaves = [], tips = [], shoots = [];
  const Hh = rnd(300, 400) * sc * hm, lean = rnd(-.1, .1), tx = lean * Hh * .55, ty = -Hh * rnd(.45, .55);
  const trunkPts = qcurve(0, 0, tx, ty, rnd(-14, 14) * sc, 12), tw = rnd(15, 22) * sc;
  const trunk = mk(trunkPts, tw, '#d8cdb9', { prof: 'trunk', nb: 0, a: 1, rib: 1, rough: .12 });
  woody.push(trunk, edgeOf(trunk, 1, 2.6 * sc, INK), edgeOf(trunk, -1, 1.4 * sc, '#8c7d68', .7));
  for (let i = 0; i < 4; i++) { const k = Math.floor(rnd(2, 10)), p = trunkPts[k]; woody.push(mk(qcurve(p[0] - 3, p[1], p[0] + 3, p[1] - rnd(8, 18) * sc, 2, 3), rnd(4, 7) * sc, pick(['#b3a58e', '#a6977f', '#c2b39b']), { prof: 'leaf', nb: 0, a: .7 })); }
  const segs = [trunkPts];
  function limb(x, y, ang, len, w, depth) {
    const pts = polar(x, y, ang, len, rnd(-.28, .28) * len, 8);
    const s = mk(pts, w, pick(['#d3c6ae', '#c8b99f']), { prof: 'tip', nb: 0, a: 1, rib: 1 });
    woody.push(s, edgeOf(s, 1, Math.max(1.1, w * .16), INK, .8)); segs.push(pts);
    const e = pts[pts.length - 1];
    if (depth <= 0 || len < 26 * sc) { tips.push(e); return; }
    const nk = rnd() < .4 ? 3 : 2;
    for (let k = 0; k < nk; k++) limb(e[0], e[1], ang + (k - (nk - 1) / 2) * .6 + rnd(-.3, .3), len * rnd(.6, .78), w * .62, depth - 1);
  }
  const nl = rnd() < .5 ? 3 : 2;
  for (let k = 0; k < nl; k++) limb(tx, ty, -Math.PI / 2 + (k - (nl - 1) / 2) * .62 + rnd(-.2, .2), Hh * rnd(.26, .34), tw * .6, 2);
  for (const [x, y] of tips) clump(leaves, x, y + 4 * sc, rnd(26, 40) * sc, Math.round(16 * Math.min(1.2, sc + .3)), COL.gum, { dir: Math.PI / 2, spread: .55, l0: 10 * sc, l1: 20 * sc, w0: 4 * sc, w1: 7.5 * sc, sx: 1.2, sy: .75 });
  // 火后萌发：沿主干和大枝的新芽（鲜绿短簇）
  for (const pts of segs.slice(0, 6)) for (let i = 1; i < pts.length - 1; i += 2) {
    const [x, y] = pts[i]; if (rnd() < .25) continue;
    clump(shoots, x + rnd(-3, 3), y, 7 * sc, 4, ['#8fbf5a', '#a3cc66', '#7fb24f'], { l0: 5 * sc, l1: 11 * sc, w0: 3.5 * sc, w1: 6 * sc, sx: 1.4, sy: 1 });
  }
  return { S: woody.concat(leaves), woody, leaves, shoots, fork: [tx, ty] };
}

function ash(sc) {
  const S = [], Hh = rnd(1500, 1720) * sc, tx = rnd(-20, 20) * sc, top = -Hh * .9;
  const trunkPts = qcurve(0, 0, tx, top, rnd(-22, 22) * sc, 34);
  const trunk = mk(trunkPts, 36 * sc, '#ddd6c6', { prof: 'trunk', nb: 0, a: 1, rib: 1, rough: .08 });
  S.push(trunk, edgeOf(trunk, 1, 3 * sc, INK), edgeOf(trunk, -1, 1.6 * sc, '#8c8373', .8));
  for (let i = 0; i < 16; i++) { const k = Math.floor(rnd(1, 12)), p = trunkPts[k]; S.push(mk(qcurve(p[0] + rnd(-8, 8) * sc, p[1], p[0] + rnd(-8, 8) * sc, p[1] + rnd(40, 110) * sc, rnd(-5, 5), 6), rnd(3, 6) * sc, pick(['#7a6a57', '#8d7c66', '#5e5144']), { prof: 'tip', nb: 0, a: .8 })); }
  const tips = [];
  for (let k = 0; k < 6; k++) {
    const y = top + k * 28 * sc, x = tx * (y / top);
    const pts = polar(x, y, -Math.PI / 2 + (k % 2 ? 1 : -1) * rnd(.4, 1.1), rnd(110, 190) * sc, rnd(-20, 20), 8);
    S.push(mk(pts, rnd(5, 8) * sc, '#cfc6b3', { prof: 'tip', nb: 0, a: 1 }), mk(pts, 1.5 * sc, INK, { prof: 'tip', nb: 0, a: .7 }));
    tips.push(pts[pts.length - 1], pts[5]);
  }
  for (const [x, y] of tips) clump(S, x, y, rnd(30, 46) * sc, 16, COL.ash, { dir: Math.PI / 2, spread: .6, l0: 12 * sc, l1: 22 * sc, w0: 5 * sc, w1: 8 * sc });
  return { S, top: top - 200 * sc, tx };
}

function frond(S, x, y, ang, len, sc, cols, droop = .35) {
  const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len * .55 + len * droop;
  const cx = x + Math.cos(ang) * len * .55, cy = y + Math.sin(ang) * len * .55 - len * .12;
  const pts = qctrl(x, y, cx, cy, ex, ey, 10);
  S.push(mk(pts, 3 * sc, '#3a5a36', { prof: 'tip', nb: 0 }));
  for (let i = 1; i < pts.length - 1; i++) {
    const s = i / (pts.length - 1), [px, py] = pts[i], d = Math.atan2(pts[i + 1][1] - py, pts[i + 1][0] - px), L = 17 * sc * (1 - s * .7);
    for (const side of [-1, 1]) S.push(mk(polar(px, py, d + side * 1.15, L, side * 2, 3), 3.2 * sc * (1 - s * .4), pick(cols), { prof: 'tip', nb: 0, a: .88 }));
  }
}
function treeFern(sc) {
  const S = [], h = rnd(140, 240) * sc, tx = rnd(-15, 15) * sc;
  S.push(mk(qcurve(0, 0, tx, -h, rnd(-10, 10) * sc, 10), 12 * sc, '#4a3a2e', { prof: 'even', nb: 3 }));
  const N = 11; for (let i = 0; i < N; i++) { const ang = -Math.PI / 2 + (i / (N - 1) - .5) * 2.9 + rnd(-.1, .1); frond(S, tx, -h, ang, rnd(100, 150) * sc, sc, COL.fern, .3); }
  return { S };
}
function groundFern(sc) { const S = []; for (let i = 0; i < 6; i++) frond(S, rnd(-6, 6) * sc, 0, -Math.PI / 2 + (i / 5 - .5) * 2.6, rnd(40, 70) * sc, sc * .7, COL.fern, .15); return { S }; }

function rfTree(sc, o = {}) {
  const S = [], Hh = (o.emergent ? rnd(560, 640) : rnd(260, 360)) * sc, tx = rnd(-15, 15) * sc;
  const trunk = mk(qcurve(0, 0, tx, -Hh, rnd(-12, 12) * sc, 14), (o.emergent ? 22 : 17) * sc, '#3b3028', { prof: 'trunk', nb: 4 });
  S.push(trunk);
  if (!o.noButt && (o.emergent || rnd() < .35)) for (const side of [-1, 1, -1, 1]) S.push(mk(qcurve(side * 4 * sc, -rnd(50, 80) * sc, side * rnd(25, 45) * sc, 2, side * rnd(6, 12) * sc, 8), rnd(6, 9) * sc, INK2, { prof: 'tip', nb: 3 }));
  const R = (o.emergent ? rnd(170, 210) : rnd(130, 180)) * sc;
  const cy = -Hh, sy = o.emergent ? .45 : .75;
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * .7; S.push(mk(polar(tx, cy + R * .3, a, R * .7, rnd(-10, 10), 6), 5 * sc, INK2, { prof: 'tip', nb: 0 })); }
  const nC = o.emergent ? 9 : 8;
  for (let k = 0; k < nC; k++) {
    const a = Math.PI + (k / (nC - 1)) * Math.PI, rr = R * rnd(.35, .75);
    const x = tx + Math.cos(a) * rr * 1.1, y = cy + Math.sin(a) * rr * sy + R * .15;
    clump(S, x, y, R * rnd(.4, .55), 20, k < nC / 2 ? COL.rain : COL.rain.slice(1), { l0: 12 * sc, l1: 24 * sc, w0: 9 * sc, w1: 16 * sc, sx: 1.2, sy: .8, a0: .8, a1: .97 });
  }
  clump(S, tx, cy - R * .1, R * .6, 26, COL.rainLite, { l0: 10 * sc, l1: 20 * sc, w0: 8 * sc, w1: 14 * sc, sx: 1.3, sy: sy, a0: .75, a1: .95 });
  return { S, top: cy - R * sy, crown: [tx, cy] };
}

function fanPalm(sc) {
  const S = [], h = rnd(160, 240) * sc, tx = rnd(-18, 18) * sc;
  S.push(mk(qcurve(0, 0, tx, -h, rnd(-12, 12) * sc, 10), 5 * sc, '#4a3d31', { prof: 'even', nb: 0 }));
  const nf = 6;
  for (let f = 0; f < nf; f++) {
    const a = -Math.PI / 2 + (f / (nf - 1) - .5) * 2.4, d = rnd(40, 70) * sc;
    const cx = tx + Math.cos(a) * d, cy = -h + Math.sin(a) * d * .7;
    S.push(mk(qcurve(tx, -h, cx, cy, rnd(-6, 6), 5), 2.2 * sc, '#3a5a36', { prof: 'even', nb: 0 }));
    const rf = rnd(38, 55) * sc, a0 = rnd(0, 6.28);
    for (let i = 0; i < 16; i++) { const aa = a0 + i / 16 * Math.PI * 1.85; S.push(mk(polar(cx, cy, aa, rf, rnd(-2, 2), 4), 5.5 * sc, pick(COL.palm), { prof: 'leaf', nb: 0, a: .85 })); }
  }
  return { S };
}

function vine(sc) {
  const S = [], w = rnd(120, 240) * sc, y0 = -rnd(300, 420) * sc;
  S.push(mk(qcurve(-w / 2, y0, w / 2, y0 + rnd(-40, 40) * sc, -rnd(60, 130) * sc, 18), 2.4 * sc, INK2, { prof: 'even', nb: 0, a: .85 }));
  for (let i = 0; i < 4; i++) {
    const x = rnd(-w / 2, w / 2), L = rnd(90, 230) * sc, pts = qcurve(x, y0 + 20, x + rnd(-15, 15), y0 + 20 + L, rnd(-10, 10), 10);
    S.push(mk(pts, 1.8 * sc, INK2, { prof: 'even', nb: 0, a: .8 }));
    for (let k = 2; k < pts.length; k += 2) S.push(mk(polar(pts[k][0], pts[k][1], rnd(0, 6.28), 9 * sc, 2, 3), 6 * sc, pick(COL.rainLite), { prof: 'leaf', nb: 0 }));
  }
  return { S };
}

// 远景树剪影：几笔色团
function farTree(sc, cols, tall = 1) {
  const S = [], Hh = rnd(60, 100) * sc * tall;
  S.push(mk(qcurve(0, 0, rnd(-3, 3), -Hh * .7, 2, 5), 3 * sc, INK2, { prof: 'tip', nb: 0, a: .6 }));
  clump(S, 0, -Hh, Hh * .35, 10, cols, { l0: 8 * sc, l1: 16 * sc, w0: 6 * sc, w1: 11 * sc, sx: 1.2, sy: .7 });
  return { S };
}

function uluru(sc) {
  const S = [], w = 560 * sc, h = 130 * sc, R = 16;
  const prof = s => Math.pow(clamp(Math.min(s, 1 - s) * 5.5), .55) * (1 - .06 * Math.sin(s * 11));
  for (let r = 0; r < R; r++) {
    const f = (r + .5) / R, y = -h * f;
    let a = 0, b = 1; while (prof(a) < f && a < .5) a += .004; while (prof(b) < f && b > .5) b -= .004;
    if (b - a < .02) continue;
    S.push(mk(qcurve(-w / 2 + a * w, y, -w / 2 + b * w, y + rnd(-1, 1), rnd(-2, 2), 10), h / R * 2.1, pick(['#c46a45', '#bd5f3c', '#ca7249']), { prof: 'even', nb: 6, a: .8, rough: .12 }));
  }
  for (let i = 0; i < 8; i++) { const x = rnd(-w * .36, w * .36); S.push(mk(qcurve(x, -h * .9, x + rnd(-8, 8), -h * .05, rnd(-6, 6), 6), 2.4 * sc, '#8e4028', { prof: 'tip', nb: 0, a: .45 })); }
  S.push(mk(qcurve(-w * .5, 0, w * .5, 0, 0, 12), 6 * sc, '#9a4a2e', { prof: 'even', nb: 3, a: .5 }));
  return { S };
}

function cloud(sc, col = '#aab8bd') {
  const S = [], w = rnd(260, 520) * sc;
  for (let i = 0; i < 5; i++) { const y = rnd(-18, 18) * sc, x = rnd(-w * .2, w * .2); S.push(mk(qcurve(x - w / 2, y, x + w / 2, y + rnd(-8, 8), rnd(-14, 14) * sc, 14), rnd(18, 34) * sc, col, { prof: 'leaf', nb: 7, a: rnd(.18, .3) })); }
  return { S };
}

function shrub(sc, cols = COL.rain) {
  const S = [], h = rnd(60, 130) * sc;
  for (let i = 0; i < 3; i++) S.push(mk(polar(rnd(-10, 10), 0, -Math.PI / 2 + rnd(-.5, .5), h * .8, rnd(-8, 8), 5), 3 * sc, INK2, { prof: 'tip', nb: 0 }));
  clump(S, 0, -h * .6, h * .55, 22, cols, { l0: 10 * sc, l1: 20 * sc, w0: 8 * sc, w1: 14 * sc, sx: 1.4, sy: .8 });
  return { S };
}
