// 景片：全部是刻出来的驴皮件，幕布大部分留白（只是被灯照亮的布）
// 山（左右两片，山纹地层 + 云头镂空）、地面条（刻纹，焦土时裂纹逐渐烧穿）、河（可揭下的靛青水纹条）、树（叶冠一片 + 干一片 / 枯枝）、茅屋、火焰纹皮件（杆上抖动）
import { piece, drawPiece, fill, cut, cutLine, ink, within, smooth, poly, cloud, beads, beadLine, plum, lattice, coin, strata, meander, flameTongue, cutTaper, DYE, canvas, hideTexture, SS } from './carve.js';
import { mulberry } from '/core/lib.js';

export const groundY = x => 905 + 10 * Math.sin(x / 260) + 6 * Math.sin(x / 97 + 1);
const GB = 975;      // 地面条下缘

// —— 山：一整片皮件，山纹地层（宽缝）+ 峰顶云头孔 ——
function mountain(pk, col, seed) {
  const xs = pk.map(p => p[0]), x0 = Math.min(...xs) - 10, x1 = Math.max(...xs) + 10, y0 = Math.min(...pk.map(p => p[1])) - 10;
  const top = x => { for (let i = 0; i < pk.length - 1; i++) if (x >= pk[i][0] && x <= pk[i + 1][0]) { const u = (x - pk[i][0]) / (pk[i + 1][0] - pk[i][0]); return pk[i][1] + (pk[i + 1][1] - pk[i][1]) * (u * u * (3 - 2 * u)); } return 930; };
  return piece([x0, y0, x1, 940], g => {
    const m = q => smooth(q, [...pk, [pk[pk.length - 1][0], 940], [pk[0][0], 940]]);
    fill(g, col, m);
    within(g, m, () => {
      strata(g, x0, x1, x => top(x) + 4 * Math.sin(x / 40), 14, 17, 4.2);
      const r = mulberry(seed);
      for (let i = 1; i < pk.length - 1; i++) if (pk[i][1] < pk[i - 1][1] && pk[i][1] < pk[i + 1][1]) { cloud(g, pk[i][0] - 14, pk[i][1] + 40, 11, r() * 6, 2.2, 1); cloud(g, pk[i][0] + 16, pk[i][1] + 62, 8, r() * 6, 2, -1); }
      for (let k = 0; k < 10; k++) { const x = x0 + 30 + r() * (x1 - x0 - 60); plum(g, x, top(x) + 150 + r() * 60, 3.4); }
    });
    ink(g, 2.4, m);
  }, { ss: 1.4, seed });
}
// —— 地面条：刻纹；焦土时裂纹由细变宽、由短变长（逐渐烧穿）——
const CRACKS = (() => { const r = mulberry(17), out = []; for (let k = 0; k < 34; k++) { let x = 30 + r() * 1860, y = groundY(x) + 12 + r() * 14; const pts = [[x, y]]; const n = 4 + Math.floor(r() * 4); for (let j = 0; j < n; j++) { x += (r() - .5) * 44; y += 6 + r() * 11; pts.push([x, Math.min(GB - 6, y)]); } out.push({ pts, d: r() }); } return out; })();
function groundBase(scorched) {
  const top = []; for (let x = -10; x <= 1930; x += 16) top.push([x, groundY(x)]);
  const gp = q => poly(q, top.concat([[1930, GB], [-10, GB]]));
  return [gp, top, (g) => {
    fill(g, scorched ? '#9a5a2c' : '#8a5e30', gp);
    within(g, gp, () => {
      // 下缘回纹带（留皮）+ 一排古钱孔
      g.fillStyle = scorched ? '#6a3216' : DYE.brown; g.fillRect(-10, GB - 22, 1940, 30);
      meander(g, 0, GB - 7, 1920, 6, 1.8);
      for (let x = 20; x < 1920; x += 38) coin(g, x, GB - 34, 5.5);
      if (!scorched) {   // 青草：刻出来的绿草叶
        const rr = mulberry(2);
        for (let x = 8; x < 1910; x += 16 + rr() * 16) { const y = groundY(x) + 3, h = 12 + rr() * 12; fill(g, DYE.green, q => poly(q, [[x - 6, y + 6], [x - 3, y - h], [x, y + 2], [x + 4, y - h * .8], [x + 7, y + 6]])); }
        for (let x = 30; x < 1900; x += 64) cloud(g, x, groundY(x) + 30, 6.5, x * .03, 1.6, (x / 64) % 2 ? 1 : -1);
      } else {
        for (let x = 30; x < 1900; x += 64) cloud(g, x, groundY(x) + 30, 6.5, x * .03, 1.4, (x / 64) % 2 ? 1 : -1);
      }
    });
    ink(g, 2.4, q => poly(q, top, false), '#2e1a0c');
  }];
}
const GCACHE = new Map();
function groundPiece(burn) {       // burn 0..1 量化缓存
  const key = Math.round(burn * 24);
  if (GCACHE.has(key)) return GCACHE.get(key);
  const b = key / 24, [gp, top, draw] = groundBase(b > 0);
  const p = piece([0, 870, 1920, GB + 4], g => {
    draw(g);
    if (b > 0) within(g, gp, () => { for (const c of CRACKS) { if (c.d > b * 1.3) continue; const k = Math.min(1, (b * 1.3 - c.d) * 2.2), n = Math.max(2, Math.round(c.pts.length * k)); cutTaper(g, c.pts.slice(0, n), 1.5 + 7 * k); } });
  }, { ss: 1.5, seed: 12 });
  GCACHE.set(key, p); return p;
}
// —— 河：靛青水纹条，横在地面中段（可以揭下 / 按回）——
function river() {
  return piece([960, 880, 1480, 960], g => {
    const rv = q => { const pts = []; for (let x = 970; x <= 1470; x += 20) pts.push([x, groundY(x) + 6 + 3 * Math.sin(x / 30)]); for (let x = 1470; x >= 970; x -= 20) pts.push([x, groundY(x) + 44 + 4 * Math.sin(x / 45 + 1)]); smooth(q, pts); };
    fill(g, DYE.teal, rv);
    within(g, rv, () => { for (let row = 0; row < 4; row++) for (let x = 960 + (row % 2) * 12; x < 1480; x += 24) cutLine(g, 3, q => { const y = groundY(x) + 16 + row * 8; q.moveTo(x - 10, y + 3); q.quadraticCurveTo(x, y - 5, x + 10, y + 3); }); });
    ink(g, 2, rv);
  }, { ss: 2, seed: 15 });
}
// —— 树：叶冠（一整片蕾丝）+ 干；枯树 = 干 + 焦枝 ——
function canopy() {
  return piece([-200, -480, 200, -170], g => {
    const lobes = [[-170, -300], [-140, -380], [-70, -440], [10, -462], [90, -430], [160, -370], [180, -290], [120, -220], [40, -200], [-40, -205], [-120, -225]];
    const cp = q => { smooth(q, lobes.flatMap((p, i) => { const n = lobes[(i + 1) % lobes.length], m = [(p[0] + n[0]) / 2, (p[1] + n[1]) / 2], c = [0, -320], d = Math.hypot(m[0] - c[0], m[1] - c[1]); return [p, [m[0] + (m[0] - c[0]) / d * 26, m[1] + (m[1] - c[1]) / d * 26]]; })); };
    fill(g, DYE.green, cp);
    within(g, cp, () => {
      const r = mulberry(8);
      for (let k = 0; k < 90; k++) {   // 叶形孔
        const a = r() * 6.28, rad = Math.sqrt(r()) * 150, x = Math.cos(a) * rad * 1.15, y = -320 + Math.sin(a) * rad * .85, ang = r() * 6.28, L = 12 + r() * 6;
        cut(g, q => { q.moveTo(x - Math.cos(ang) * L, y - Math.sin(ang) * L); q.quadraticCurveTo(x - Math.sin(ang) * 5, y + Math.cos(ang) * 5, x + Math.cos(ang) * L, y + Math.sin(ang) * L); q.quadraticCurveTo(x + Math.sin(ang) * 5, y - Math.cos(ang) * 5, x - Math.cos(ang) * L, y - Math.sin(ang) * L); });
      }
      for (let k = 0; k < 10; k++) plum(g, -140 + r() * 280, -420 + r() * 200, 4);
    });
    g.save(); g.beginPath(); cp(g); g.clip(); ink(g, 9, cp, DYE.jade); g.restore();
    ink(g, 2.2, cp);
  }, { ss: 1.6, seed: 16 });
}
function trunk(burnt) {
  return piece([-190, -440, 190, 26], g => {
    const br = burnt
      ? [[0, 0, -8, -220, 22, 12], [-6, -150, -120, -300, 10, 3], [0, -200, 110, -330, 9, 3], [-4, -230, -40, -400, 8, 2], [2, -210, 60, -420, 7, 2], [-60, -240, -160, -320, 5, 2], [80, -270, 150, -300, 5, 2]]
      : [[0, 0, -8, -220, 22, 14], [-6, -150, -110, -270, 11, 7], [0, -200, 100, -290, 10, 6], [-4, -220, -30, -300, 9, 6]];
    const col = burnt ? '#3d2012' : DYE.brown;
    for (const [x0, y0, x1, y1, w0, w1] of br) {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, mx = (x0 + x1) / 2 + nx * 18, my = (y0 + y1) / 2 + ny * 18;
      const b = q => { q.moveTo(x0 + nx * w0, y0 + ny * w0); q.quadraticCurveTo(mx + nx * (w0 + w1) / 2, my + ny * (w0 + w1) / 2, x1 + nx * w1, y1 + ny * w1); q.lineTo(x1 - nx * w1, y1 - ny * w1); q.quadraticCurveTo(mx - nx * (w0 + w1) / 2, my - ny * (w0 + w1) / 2, x0 - nx * w0, y0 - ny * w0); q.closePath(); };
      fill(g, col, b); ink(g, 1.4, b);
      if (w0 > 12) for (let k = 1; k < 9; k++) cutLine(g, 1.5, q => { const u = k / 9, x = x0 + dx * u, y = y0 + dy * u; q.moveTo(x - 8, y + 5); q.lineTo(x, y - 2); q.lineTo(x + 8, y + 5); });
    }
    fill(g, col, q => smooth(q, [[-36, 18], [-20, -10], [22, -10], [38, 18]]));
    if (burnt) for (const [x, y] of [[-120, -300], [110, -330], [-40, -400], [60, -420]]) { const lf = q => smooth(q, [[x, y], [x + 7, y + 9], [x, y + 20], [x - 7, y + 9]]); fill(g, DYE.orange, lf); ink(g, 1, lf); }
  }, { ss: 1.6, seed: 17 });
}
function hut() {
  return piece([-130, -170, 130, 14], g => {
    const wall = q => poly(q, [[-90, 8], [-90, -88], [90, -88], [90, 8]]);
    fill(g, DYE.hide2, wall);
    within(g, wall, () => { for (let y = -80, r = 0; y < 8; y += 12, r++) for (let x = -90 + (r % 2) * 11; x < 90; x += 22) cut(g, q => q.rect(x + 2, y + 2, 18, 8)); });
    const win = q => q.rect(-64, -70, 48, 44);
    fill(g, DYE.brown, win); within(g, win, () => lattice(g, -66, -72, -14, -24, 11, 2)); ink(g, 2, win);
    const door = q => poly(q, [[20, 8], [20, -62], [58, -62], [58, 8]]); fill(g, DYE.brown, door); within(g, door, () => { cloud(g, 39, -40, 8, 0, 1.6); coin(g, 39, -12, 6); }); ink(g, 1.6, door);
    ink(g, 2, wall);
    const roof = q => poly(q, [[-126, -80], [-72, -162], [72, -162], [126, -80]]);
    fill(g, '#3a1c10', roof); within(g, roof, () => { for (let k = 0; k < 7; k++) for (let x = -130 + (k % 2) * 8; x < 130; x += 16) cut(g, q => { const y = -154 + k * 11; q.moveTo(x - 6, y); q.arc(x, y, 6, Math.PI, 0, true); q.closePath(); }); });
    ink(g, 2, roof);
    fill(g, '#3a1c10', q => poly(q, [[-136, -78], [136, -78], [132, -72], [-132, -72]]));
  }, { ss: 2, seed: 14 });
}
// —— 火焰纹皮件：三到四条 S 形火舌，舌根卷云，舌内刻平行弧缝；红外黄内 ——
function flame(v) {
  return piece([-70, -190, 70, 10], g => {
    const r = mulberry(20 + v);
    const T = [[-34, 110, 44, 1], [34, 118, 44, -1], [-12, 160, 50, -1], [14, 146, 48, 1]].map(([x, h, w, d]) => [x + (r() - .5) * 6, h * (.9 + r() * .2), w, d]);
    const at = (x, fn) => q => { const P = { moveTo: (a, b) => q.moveTo(a + x, b), bezierCurveTo: (a1, b1, a2, b2, a3, b3) => q.bezierCurveTo(a1 + x, b1, a2 + x, b2, a3 + x, b3), closePath: () => q.closePath() }; fn(P); };
    for (const [x, h, w, d] of T) fill(g, DYE.red, at(x, P => flameTongue(P, h, w, d)));
    for (const [x, h, w, d] of T) fill(g, DYE.orange, at(x + d * 2, P => flameTongue(P, h * .72, w * .62, d)));
    for (const [x, h, w, d] of T) fill(g, DYE.yellow, at(x + d * 3, P => flameTongue(P, h * .42, w * .34, d)));
    for (const [x, h, w, d] of T) {
      for (let j = 1; j <= 2; j++) cutLine(g, 1.8, q => { q.moveTo(x - w * .28 + j * 4, -8); q.bezierCurveTo(x - w * .3, -h * .35, x + d * w * .05, -h * (.5 + j * .06), x + d * w * .2, -h * (.66 + j * .05)); });
      cloud(g, x + d * w * .45, -h * .84, 4.2, d > 0 ? 0 : 3, 1.3, d);
    }
    for (const [x, h, w, d] of T) ink(g, 1.7, at(x, P => flameTongue(P, h, w, d)));
    fill(g, '#5a2410', q => poly(q, [[-66, 0], [66, 0], [62, 9], [-62, 9]]));
  }, { seed: 20 + v });
}
let S = null;
export function buildScenery() {
  if (S) return S;
  const pkL = [[-20, 900], [40, 800], [150, 690], [230, 740], [330, 640], [450, 760], [560, 720], [700, 830], [780, 900]];
  const pkR = [[1330, 900], [1420, 790], [1520, 700], [1600, 760], [1700, 660], [1810, 740], [1880, 700], [1950, 780], [1960, 900]];
  S = { mtnL: [mountain(pkL, '#7fae96', 3), mountain(pkL, '#c7874c', 3)], mtnR: [mountain(pkR, '#7fae96', 5), mountain(pkR, '#c7874c', 5)],
    canopy: canopy(), trunk: [trunk(false), trunk(true)], hut: hut(), river: river(), flames: [flame(0), flame(1), flame(2)] };
  return S;
}
const M_ = (C, x, y, s = 1, r = 0) => { const c = Math.cos(r) * s, sn = Math.sin(r) * s; return [C[0] * c, C[3] * sn, -C[0] * sn, C[3] * c, C[0] * x + C[4], C[3] * y + C[5]]; };
// 画大地：st = {burn 0..1（焦土前沿从右往左）, flames 0..1, t, river 0..1（1 = 贴在布上）, riverLift, canopy 0..1, canopyLift}
export function drawLand(g, Cam, st = {}) {
  const S = buildScenery(), burn = st.burn || 0;
  g.save(); g.globalCompositeOperation = 'multiply';
  const wipe = (a, b) => {
    const fx = 2100 - burn * 2400;
    g.setTransform(Cam[0], 0, 0, Cam[3], Cam[4], Cam[5]);
    if (burn <= 0) { drawPiece(g, a); return; } if (burn >= 1) { drawPiece(g, b); return; }
    g.save(); g.beginPath(); g.rect(-100, 0, fx + 100, 1200); g.clip(); drawPiece(g, a); g.restore();
    g.save(); g.beginPath(); g.rect(fx, 0, 3000, 1200); g.clip(); drawPiece(g, b); g.restore();
  };
  wipe(S.mtnL[0], S.mtnL[1]); wipe(S.mtnR[0], S.mtnR[1]);
  g.setTransform(...M_(Cam, 1640, 908)); drawPiece(g, S.hut);
  // 树
  const tb = (st.bare ?? (burn > .8 ? 1 : 0));
  g.setTransform(...M_(Cam, 250, 912)); drawPiece(g, S.trunk[tb]);
  const cv = st.canopy ?? (burn > .8 ? 0 : 1);
  if (cv > 0) { const lift = st.canopyLift || 0; g.save(); g.globalAlpha = cv; if (lift > 0) g.filter = `blur(${lift * 14 * Cam[0]}px)`; g.setTransform(...M_(Cam, 250 - lift * 30, 912 - lift * 40, 1 + lift * .5)); drawPiece(g, S.canopy); g.restore(); }
  // 地面条（焦土裂纹随 burn 逐渐烧穿）
  g.setTransform(Cam[0], 0, 0, Cam[3], Cam[4], Cam[5]); drawPiece(g, groundPiece(burn));
  // 河
  const rv = st.river ?? (1 - Math.min(1, burn * 2));
  if (rv > 0) { const lift = 1 - rv; g.save(); g.globalAlpha = Math.min(1, rv * 1.4); if (lift > 0) g.filter = `blur(${lift * 16 * Cam[0]}px)`; const sc = 1 + lift * .3, cx = 1220, cy = 920; g.setTransform(Cam[0] * sc, 0, 0, Cam[3] * sc, Cam[4] + Cam[0] * (cx - cx * sc + lift * 40), Cam[5] + Cam[3] * (cy - cy * sc - lift * 50)); drawPiece(g, S.river); g.restore(); }
  // 火焰纹皮件：插在杆上，12 fps 抖动
  if (st.flames > 0) {
    const fr = Math.floor((st.t || 0) * 12);
    [[360, 1], [1180, .85], [1560, 1.1], [820, .75], [1790, .95]].forEach(([x, s], i) => {
      if (burn < 1 - x / 2400) return;
      const j = Math.sin(fr * 2.3 + i * 1.7), sc = s * st.flames * (1 + .05 * j);
      const fx = x + 3 * Math.sin(fr * 1.9 + i), fy = groundY(x) + 10;
      g.setTransform(...M_(Cam, fx, fy, sc, .07 * j)); drawPiece(g, S.flames[(fr + i) % 3]);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = `blur(${2.4 * Cam[0]}px)`; g.globalAlpha = .6; g.strokeStyle = '#2a1a10'; g.lineWidth = 3 * Cam[0];
      g.beginPath(); g.moveTo(Cam[0] * fx + Cam[4], Cam[3] * (fy - 30 * sc) + Cam[5]); g.lineTo(Cam[0] * (fx - 60) + Cam[4], Cam[3] * 1200 + Cam[5]); g.stroke(); g.restore();
    });
  }
  g.restore();
}
export const FLAMEX = [[360, 1], [1180, .85], [1560, 1.1], [820, .75], [1790, .95]];
