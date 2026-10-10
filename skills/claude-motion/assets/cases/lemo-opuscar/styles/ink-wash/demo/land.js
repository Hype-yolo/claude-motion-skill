// 山水：远山（湿墨渐隐入雾）、中山（披麻皴 + 点苔）、崖石（斧劈）、松、芦苇、墨圈涟漪
import { mk, draw, mass, blot, TONE } from './ink.js';
import { mulberry, lerp, clamp, vnoise } from '/core/lib.js';

const fbm = x => vnoise(x) * .55 + vnoise(x * 2.1 + 17) * .28 + vnoise(x * 4.7 + 41) * .17;

// 2D 值噪声
const h2 = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
export function vn2(x, y) {
  const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g);
  return lerp(lerp(h2(i, j), h2(i + 1, j), u), lerp(h2(i, j + 1), h2(i + 1, j + 1), u), v);
}
const fbm2 = (x, y) => vn2(x, y) * .5 + vn2(x * 2.07 + 5.1, y * 2.07 + 1.3) * .3 + vn2(x * 4.3 + 9, y * 4.3 + 3) * .2;

// 山脊：尖峰（指数衰减，p 越小越尖）+ 分形起伏。peaks: [[x, h, w]]
export function ridgeFn(peaks, base, seed = 1, rough = 18) {
  return x => {
    let y = 0;
    for (const [px, h, w] of peaks) { const d = Math.abs(x - px) / w; y = Math.max(y, h * Math.exp(-Math.pow(d, 1.7)) * (1 - .12 * Math.exp(-d * d * 30))); }
    const n = (fbm(x * .004 + seed) - .5) * rough + (vnoise(x * .018 + seed * 3) - .5) * rough * .45 + (vnoise(x * .07 + seed * 5) - .5) * rough * .12;
    return base - y * (1 + (vnoise(x * .01 + seed) - .5) * .25) - n;
  };
}

// 山体（逐像素）：山脊下一道浓边往下渐淡，山脚被横向的雾带切断；返回缓存画布
// o: {W, H, ridge, depth, tone, rim(山脊浓边), rimW, mist(雾量), seed}
export function mountainLayer(o) {
  const W = o.W, H = o.H, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), img = c.createImageData(W, H), D = img.data;
  const sd = o.seed || 1, depth = o.depth, rimW = o.rimW || 16;
  for (let x = 0; x < W; x++) {
    const r = o.ridge(x + (o.x0 || 0)), y0 = Math.max(0, Math.floor(r));
    const colK = .8 + .4 * vn2(x * .012 + sd, 3.3);                     // 竖向的浓淡变化（像笔意）
    const xm = o.xmask ? o.xmask(x + (o.x0 || 0)) : 1; if (xm <= 0) continue;
    for (let y = y0; y < Math.min(H, r + depth); y++) {
      const d = y - r; if (d < -1) continue;
      const cover = d < 0 ? 1 + d : 1;
      const f = Math.pow(1 - d / depth, 1.6);
      const tex = .7 + .6 * fbm2((x + (o.x0 || 0)) * .018 + sd, y * .03);
      const mist = o.mist ? clamp(1 - o.mist * Math.max(0, fbm2((x + (o.x0 || 0)) * .0025 + sd * 2, y * .012) - .38) * 3.2) : 1;
      const a = o.tone * (f * .6 * tex + Math.exp(-d / rimW) * (o.rim ?? .7) * colK) * mist * cover * xm;
      D[(y * W + x) * 4 + 3] = Math.min(255, a * 255);
    }
  }
  c.putImageData(img, 0, 0);
  return cv;
}

// 皴 + 苔点（画在山体之上）
export function cun(L, o) {
  const R = mulberry(o.seed || 1);
  const nC = Math.round((o.x1 - o.x0) / 100 * (o.cun ?? 1.2));
  for (let i = 0; i < nC; i++) {
    const x = lerp(o.x0 + 20, o.x1 - 20, R()), y = o.ridge(x) + 4 + R() * 30 * (o.cunDepth || 1);
    const sl = (o.ridge(x + 8) - o.ridge(x - 8)) / 16;
    const len = (25 + R() * 60) * (o.cunLen || 1), dx = clamp(sl * len * .8, -len * .7, len * .7);
    const pts = [[x, y], [x + dx * .45 + (R() - .5) * 6, y + len * .5], [x + dx * .8, y + len]];
    draw(L, mk(pts, { w: (7 + R() * 9) * (o.cunW || 1), tone: o.tone * (1.3 + R() * .8), darkDir: [-1, 0], side: .7, brWet: true, body: .25, dry: .6 + R() * .2, wet: .8, prof: 'tip', seed: (o.seed || 1) * 1000 + i }), 1, .75);
  }
  const nM = Math.round((o.x1 - o.x0) / 100 * (o.moss ?? 1.5));
  for (let i = 0; i < nM; i++) {
    const x = lerp(o.x0 + 10, o.x1 - 10, R()), y = o.ridge(x) + R() * 8;
    for (let k = 0; k < 3; k++) blot(L.wet, x + (R() - .5) * 14, y + R() * 5, (1.2 + R() * 2.2) * (o.mossR || 1), clamp(o.tone * 3), R() * 3, .6 + R() * .3, (o.seed || 1) + i * 3 + k);
  }
}

// 崖石：勾（断续的焦墨轮廓）+ 皴（沿结构线的短斧劈）+ 染（阴面淡墨，往下消失在雾里）+ 点（苔）。flip=-1 时崖面朝左
export function cliff(L, x, y, s, seed = 3, flip = 1) {
  const R = mulberry(seed);
  const T = p => [x + p[0] * s * flip, y + p[1] * s];
  const top = [[-40, 3], [0, -1], [45, 1], [90, -2], [128, 1], [152, 4]];
  const face = [[152, 4], [172, 22], [167, 62], [188, 98], [183, 142], [204, 192], [214, 262]];
  const facets = [[[112, 4], [132, 42], [127, 92], [148, 150], [152, 240]], [[62, 3], [80, 52], [74, 120], [94, 210]], [[18, 2], [30, 60], [26, 150]]];
  // 染：整体淡墨 + 各阴面一笔含墨（往下变淡）
  mass(L.wet, [...top, ...face.slice(1), [70, 262], [10, 150], [-25, 40]].map(T), .2, 2 * s, seed, [0, y, 0, y + 250 * s, 1.2, .05]);
  const shade = [face, ...facets];
  shade.forEach((f, i) => draw(L, mk(f.map(p => [p[0] - 12, p[1] + 4]).map(T), { w: (i === 0 ? 34 : 22) * s, tone: i === 0 ? .55 : .35, darkDir: [flip, 0], side: .85, brWet: true, body: .3, dry: .55, wet: .9, prof: 'rise', seed: seed * 5 + i }), 1, .9));
  // 勾：崖顶与崖面，分段、提按
  const outline = (pts, w, sd) => { for (let i = 0; i < pts.length - 1; i += 2) draw(L, mk(pts.slice(i, i + 3).map((p, j) => [...T(p), j === 1 ? 1.2 : .7]), { w: w * s, tone: .92, dry: .5, wet: .25, prof: 'brush', seed: sd + i })); };
  outline(top, 4.2, seed * 13); outline(face, 4.6, seed * 17);
  facets.forEach((f, i) => draw(L, mk(f.slice(0, 3 + (i === 0 ? 1 : 0)).map(T), { w: (3 - i * .6) * s, tone: .85, dry: .6, wet: .2, prof: 'tip', seed: seed * 23 + i })));
  // 皴：沿结构线的短斧劈
  for (const f of [face, ...facets]) {
    for (let i = 0; i < 6; i++) {
      const u = R() * .75, k = Math.floor(u * (f.length - 1)), fr = u * (f.length - 1) - k;
      const px = lerp(f[k][0], f[k + 1][0], fr) - 4 - R() * 10, py = lerp(f[k][1], f[k + 1][1], fr) + 4;
      const len = 16 + R() * 22;
      draw(L, mk([[px, py], [px - len * .35, py + len * .5], [px - len * .5, py + len]].map(T), { w: (7 + R() * 7) * s, tone: .75, dry: .6, wet: .4, prof: 'nail', seed: seed * 50 + i + f.length * 7 }), 1, clamp(1.3 - py / 200));
    }
  }
  // 点：崖顶苔点（成簇）
  for (let c = 0; c < 5; c++) {
    const cx = R() * 150, cy = 0;
    for (let i = 0; i < 4; i++) { const p = T([cx + (R() - .5) * 16, cy - 1 + R() * 4]); blot(L.wet, p[0], p[1], (1.2 + R() * 2) * s, .85, R() * 3, .6, c * 10 + i + seed); }
  }
  for (let i = 0; i < 6; i++) { const px = 10 + R() * 140; const p0 = T([px, 0]); draw(L, mk([p0, [p0[0] + (R() - .5) * 10 * s, p0[1] - (8 + R() * 12) * s]], { w: 1.5 * s, tone: .8, dry: .5, prof: 'tip', seed: seed * 300 + i })); }
}

// 松：弯曲的老干 + 几簇扇形松针
export function pine(L, x, y, s, seed = 5, t = 0, wind = 0, flip = 1) {
  const R = mulberry(seed);
  const trunk = [[0, 0], [-6, -40], [4, -90], [-10, -140], [10, -185], [40, -215], [80, -226]];
  const T = p => [x + p[0] * s * flip, y + p[1] * s];
  draw(L, mk(trunk.map(T), { w: 14 * s, tone: .75, darkDir: [flip, 0], side: .8, brWet: true, body: .3, dry: .6, wet: .8, prof: 'press', seed: seed * 11 }));
  // 树皮鳞纹
  for (let i = 0; i < 9; i++) { const u = .1 + R() * .8, k = Math.floor(u * (trunk.length - 1)), f = u * (trunk.length - 1) - k; const p = [lerp(trunk[k][0], trunk[k + 1][0], f), lerp(trunk[k][1], trunk[k + 1][1], f)]; draw(L, mk([T([p[0] - 5, p[1]]), T([p[0] + 3, p[1] + 3])], { w: 2.2 * s, tone: .85, dry: .5, prof: 'lens', seed: seed * 90 + i })); }
  // 枝
  const branches = [[[4, -90], [-40, -110], [-80, -112]], [[-10, -140], [-50, -160], [-70, -175]], [[10, -185], [50, -190], [90, -186]], [[40, -215], [70, -240], [110, -245]], [[80, -226], [120, -220], [150, -228]]];
  branches.forEach((b, i) => draw(L, mk(b.map(T), { w: 5 * s, tone: .8, dry: .55, wet: .3, prof: 'tip', seed: seed * 20 + i })));
  // 松针簇：每簇两层扇形短线，浓墨，略随风摆
  const clusters = [[-80, -114, 1], [-70, -178, .9], [-35, -165, .8], [90, -190, 1], [55, -196, .8], [110, -248, 1.1], [150, -232, .9], [75, -244, .8], [120, -222, .7], [-45, -112, .7]];
  clusters.forEach(([cx, cy, k], i) => {
    const sw = Math.sin(t * 1.3 + i) * wind * 2;
    for (let layer = 0; layer < 2; layer++) {
      const n = 11, spread = 1.35, rr = (layer ? 22 : 28) * k;
      for (let j = 0; j < n; j++) {
        const a = -Math.PI / 2 + (j / (n - 1) - .5) * spread * 2 + (layer ? .12 : 0);
        const c0 = T([cx + sw, cy + (layer ? 4 : 0)]);
        const c1 = [c0[0] + Math.cos(a) * rr * s, c0[1] + Math.sin(a) * rr * s * .55 + rr * s * .18];
        draw(L, mk([c0, c1], { w: 2.1 * s, tone: layer ? .9 : .7, dry: .35, wet: .35, prof: 'tip', seed: seed * 1000 + i * 40 + layer * 20 + j }));
      }
      // 簇底淡墨
      const c0 = T([cx + sw, cy + 6]);
      blot(L.wet, c0[0], c0[1], 16 * k * s, .18, 0, .35, i);
    }
  });
}

// 芦苇：细长弯茎 + 几片叶 + 穗
export function reed(L, x, y, h, s, seed = 9, bend = 0, tone = .8) {
  const R = mulberry(seed);
  const top = [x + bend * h * .35, y - h];
  draw(L, mk([[x, y], [x + bend * h * .1, y - h * .5], top], { w: 2.4 * s, tone, dry: .35, wet: .3, prof: 'tip', seed: seed * 3 }));
  for (let i = 0; i < 3; i++) {
    const u = .25 + i * .2 + R() * .08, px = x + bend * h * .1 * u * 2, py = y - h * u;
    const dir = R() < .5 ? -1 : 1, L2 = h * (.3 + R() * .25);
    draw(L, mk([[px, py], [px + dir * L2 * .45, py - L2 * .35], [px + dir * L2 * .9 + bend * 10, py - L2 * .1]], { w: 5 * s, tone: tone * .9, dry: .4, wet: .4, prof: 'lens', seed: seed * 10 + i }));
  }
  // 穗
  draw(L, mk([top, [top[0] + bend * 14 * s + 6 * s, top[1] - 4 * s], [top[0] + bend * 26 * s + 14 * s, top[1] + 8 * s]], { w: 6 * s, tone: tone * .7, dry: .7, wet: .3, prof: 'lens', seed: seed * 17 }));
}

// 墨圈涟漪：一个透视椭圆，起笔重、收笔轻，缺一小口（像一笔画成）
export function ripple(L, x, y, r, a, seed = 1, sq = .2, w = 3) {
  if (a <= .01 || r < 1) return;
  const n = 28, ph = (seed * 1.7) % 6.28, pts = [];
  for (let i = 0; i <= n; i++) { const t = ph + i / n * Math.PI * 1.86; pts.push([x + Math.cos(t) * r, y + Math.sin(t) * r * sq]); }
  draw(L, mk(pts, { w, tone: .75, dry: .55, wet: .45, prof: 'brush', seed: seed * 7 }), 1, a);
}
