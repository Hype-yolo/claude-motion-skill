// 字符画的"底片"：先在离屏像素上算出灰度（R = 琥珀，G = 地球），再交给 term.js 按格取平均、查密度表选字。
// 全部确定性：同样的参数永远得到同样的画。
import { W, H, cellsFromImage } from './term.js';

// ---------- 噪声 ----------
function hash3(x, y, z) { let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function vn3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), L(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    L(L(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), L(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
}
export function fbm3(x, y, z, oct = 5) { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * vn3(x * f, y * f, z * f); n += a; a *= .5; f *= 2.03; } return s / n; }
const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- 地球贴图：粗略的大陆轮廓（经纬度多边形）→ 等距圆柱投影的陆地蒙版；云用噪声 + 涡旋 ----------
const CONT = [
  // 非洲
  [[-6,36],[10,37],[11,33],[20,31],[25,32],[32,31],[34,28],[39,20],[43,12],[51,12],[48,6],[44,2],[40,-10],[40,-16],[35,-24],[33,-29],[27,-34],[20,-35],[18,-30],[15,-27],[12,-18],[13,-12],[9,-2],[9,4],[5,6],[-2,5],[-8,4],[-13,8],[-17,14],[-17,21],[-13,27],[-10,30]],
  [[44,-13],[50,-15],[47,-25],[44,-22]],                                                     // 马达加斯加
  [[35,28],[39,22],[43,13],[52,16],[59,22],[56,26],[50,30],[48,30],[36,32]],                   // 阿拉伯半岛
  [[36,32],[36,37],[40,41],[50,42],[55,45],[62,42],[66,36],[62,26],[57,25],[50,30]],           // 中东—中亚
  [[-9,37],[-2,37],[3,43],[7,44],[9,44],[12,42],[16,38],[18,40],[13,45],[19,42],[22,37],[26,40],[29,41],[30,45],[40,47],[50,48],[60,55],[60,68],[40,68],[30,70],[25,71],[15,68],[8,62],[5,60],[8,58],[10,55],[8,54],[4,52],[2,51],[-2,49],[-5,48],[-1,46],[-2,44],[-9,43]],  // 欧洲
  [[-5,50],[1,51],[0,53],[-2,56],[-5,58],[-6,56],[-3,54],[-5,52]],                            // 大不列颠
  [[-35,-5],[-40,-3],[-50,0],[-60,8],[-72,12],[-78,5],[-80,-3],[-75,-15],[-70,-20],[-70,-35],[-68,-50],[-72,-53],[-65,-55],[-58,-38],[-48,-28],[-40,-22],[-38,-13]],  // 南美
  [[-45,60],[-20,70],[-20,82],[-60,82],[-55,70]],                                             // 格陵兰
];
const TW = 720, TH = 360;
let LAND = null, CLOUD = null;
function initEarthTex() {
  const c = document.createElement('canvas'); c.width = TW; c.height = TH;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000'; g.fillRect(0, 0, TW, TH); g.fillStyle = '#fff';
  for (const poly of CONT) { g.beginPath(); poly.forEach(([lo, la], i) => { const x = (lo + 180) * 2, y = (90 - la) * 2; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); }
  // 冰盖
  g.fillRect(0, 0, TW, 10); g.fillRect(0, TH - 26, TW, 26);
  const d = g.getImageData(0, 0, TW, TH).data;
  LAND = new Float32Array(TW * TH); CLOUD = new Float32Array(TW * TH);
  for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
    const lo = i / TW * Math.PI * 2, la = (.5 - j / TH) * Math.PI;
    const x = Math.cos(la) * Math.cos(lo), y = Math.sin(la), z = Math.cos(la) * Math.sin(lo);
    // 海岸线加一点碎边
    const edge = (fbm3(x * 6 + 3, y * 6, z * 6, 3) - .5) * .5;
    LAND[j * TW + i] = Math.max(0, Math.min(1, d[(j * TW + i) * 4] / 255 + edge * (d[(j * TW + i) * 4] > 20 && d[(j * TW + i) * 4] < 235 ? 1 : 0)));
    // 云：沿纬度拉长的带 + 几个涡旋
    const sw = Math.sin(la * 3) * 1.2;
    const cl = fbm3(x * 2.6 + sw * z, y * 5 + 1, z * 2.6 - sw * x, 5);
    const band = .6 + .4 * Math.cos(la * 6);
    CLOUD[j * TW + i] = sst(.58, .74, cl * (.8 + .25 * band)) * (1 - sst(.9, 1.2, Math.abs(la)));
  }
}
function earthTex(lo, la) {
  let i = Math.floor((((lo + Math.PI) / (Math.PI * 2)) % 1 + 1) % 1 * TW), j = Math.floor((.5 - la / Math.PI) * TH);
  j = Math.max(0, Math.min(TH - 1, j)); i = Math.min(TW - 1, i);
  return [LAND[j * TW + i], CLOUD[j * TW + i]];
}

// 地球表面着色：单位圆内的 (nx, ny) → [亮度, 是否暗面]
export function earthShade(nx, ny, P, Lx = -.66 / 1.0, Ly = -.26, Lz = .7) {
  if (!LAND) initEarthTex();
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const ct = Math.cos(P.tiltE || 0), st = Math.sin(P.tiltE || 0);
  const vx = nx * ct - ny * st, vy = -(nx * st + ny * ct), vz = nz;
  const la0 = P.lat0, lo0 = P.lon0 + (P.spin || 0);
  const y1 = vy * Math.cos(la0) + vz * Math.sin(la0), z1 = -vy * Math.sin(la0) + vz * Math.cos(la0);
  const la = Math.asin(Math.max(-1, Math.min(1, y1))), lo = lo0 + Math.atan2(vx, z1);
  const [land, cloud] = earthTex(lo, la);
  let alb = .14 + land * .82;
  alb = alb * (1 - cloud * .85) + .5 * cloud * .85;
  const ndl = nx * Lx + ny * Ly + nz * Lz;
  const lit = sst(-.03, .1, ndl);
  let v = alb * (.35 + .65 * Math.max(0, ndl)) * lit;
  v += Math.pow(1 - nz, 3) * .35 * lit;
  return [v, lit < .5 ? 1 : 0];
}

// ---------- 画布 ----------
export class Art {
  constructor(cols, rows, sx = 2, sy = 4) {
    this.cols = cols; this.rows = rows; this.sx = sx; this.sy = sy;
    this.w = cols * sx; this.h = rows * sy;
    this.cv = document.createElement('canvas'); this.cv.width = this.w; this.cv.height = this.h;
    this.g = this.cv.getContext('2d', { willReadFrequently: true });
  }
  clear() { this.g.globalCompositeOperation = 'source-over'; this.g.globalAlpha = 1; this.g.fillStyle = '#000'; this.g.fillRect(0, 0, this.w, this.h); }
  img() { return this.g.getImageData(0, 0, this.w, this.h); }
  put(id) { this.g.putImageData(id, 0, 0); }
  cells() { return cellsFromImage(this.img().data, this.w, this.cols, this.rows, this.sx, this.sy); }
}

// 地平线高度（屏幕像素）：一条缓弧 + 远处低矮的山脊
export function horizonY(X, P) {
  const u = X / W - .5;
  return P.hy + u * u * P.arc + P.tilt * u - (fbm3(X * .004 + 11, 3, 0, 4) - .5) * P.ridge - Math.max(0, fbm3(X * .0017 + 5, 7, 1, 3) - .52) * P.ridge * 2.4;
}

// 月面 + 地球（屏幕坐标参数），写进 Art 的像素：R = 琥珀亮度，G = 地球亮度
// P: { hy, arc, tilt, ridge, ex, ey, er, earthMix(0 琥珀 → 1 蓝), spin, stars }
export function paintEarthrise(art, P) {
  if (!LAND) initEarthTex();
  const id = art.img(), d = id.data, aw = art.w, ah = art.h;
  const kx = (P.cw || 9) / art.sx, ky = (P.cw || 9) * 2 / art.sy;   // 与字符网格严格对齐
  const hz = new Float32Array(aw);
  for (let x = 0; x < aw; x++) hz[x] = horizonY((x + .5) * kx, P);
  // 光从左上来（太阳在画外左侧），地球是一个亮面偏左的凸月
  let Lx = -.66, Ly = -.26, Lz = .7; const ln = Math.hypot(Lx, Ly, Lz); Lx /= ln; Ly /= ln; Lz /= ln;
  const craters = P.craters || [];
  for (let y = 0; y < ah; y++) {
    const Y = (y + .5) * ky;
    for (let x = 0; x < aw; x++) {
      const X = (x + .5) * kx, o = (y * aw + x) * 4;
      let amb = 0, ea = 0, night = 0;
      const h = hz[x];
      if (Y < h) {
        // 天空：地球 + 少量星点
        const nx = (X - P.ex) / P.er, ny = (Y - P.ey) / P.er, r2 = nx * nx + ny * ny;
        if (r2 < 1) {
          const sh = earthShade(nx, ny, P, Lx, Ly, Lz); ea = sh[0]; night = sh[1];
        } else if (r2 < 1.1) {
          const rr = Math.sqrt(r2); ea = sst(1.06, 1.0, rr) * .28 * sst(-.3, .6, (nx * Lx + ny * Ly) / rr);
        }
        if (P.stars && ea === 0) {   // 星：只落在格子中心的一个像素块上，一格一颗
          const cw = P.cw || 9, ci = Math.floor(X / cw), cj = Math.floor(Y / (cw * 2)), sh = hash3(ci, cj, 3.3);
          if (sh > .9955) amb = .075 + (sh - .9955) * 12;
        }
      } else {
        // 月面：暗灰底 + 沿深度拉长的纹理（透视感），地平线一条亮边；环形山左侧内壁在阴影里，右侧内壁被低角度的太阳照亮
        const depth = Math.min(1, (Y - h) / ((P.bottom || H) - h + 1));           // 0 地平线 → 1 画面底
        const sc = .25 + depth * 2.2;
        const tex = fbm3(X * .012 / sc, Y * .07 / sc, 1.5, 4);
        let v = (.17 + (tex - .5) * .3) * (.3 + 1.0 * depth);   // 远处更暗更稀，近处更亮更密
        const mare = fbm3(X * .0022 / sc, Y * .012 / sc, 9, 3);         // 大片的暗色"海"和亮色高地
        v *= .45 + 1.3 * sst(.3, .7, mare);
        v += Math.exp(-(Y - h) / 10) * .3;
        for (const k of craters) {
          const rx = k.r, ry = k.r * k.sq;
          const u = (X - k.x) / rx, w = (Y - k.y) / ry, rr = u * u + w * w;
          if (rr > 1.7) continue;
          const r1 = Math.sqrt(rr);
          if (r1 < 1) {
            // 阴影线：从左缘投进来，碗的左侧大半是黑的
            const edge = -Math.sqrt(Math.max(0, 1 - w * w));
            const lit = u > edge + .75 * (1 - .4 * w);
            v = lit ? (.14 + .55 * sst(-.2, 1, u) * (1 - .4 * Math.max(0, w))) * (.55 + .7 * depth) : .0;
          } else {
            // 坑缘：左上缘迎光最亮，近侧（下缘）一条亮唇，右侧暗
            const rim = sst(1.3, 1.0, r1);
            v += (rim * (u < .2 ? .34 : .08) + rim * Math.max(0, w) * .2) * (.5 + .9 * depth);
            if (u > .3 && r1 < 1.6) v *= 1 - .5 * sst(1.6, 1.05, r1) * sst(.3, .9, u);   // 右外侧落在坑缘的影子里
          }
        }
        amb = Math.max(0, v);
      }
      const m = P.earthMix;
      d[o] = Math.min(255, (amb + ea * (1 - m)) * 255); d[o + 1] = Math.min(255, ea * m * 255); d[o + 2] = night * 255; d[o + 3] = 255;
    }
  }
  art.put(id);
}

// 固定的一组环形山（屏幕坐标），近大远小
export function makeCraters(P, n = 16, seed = 7) {
  let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const out = [];
  for (let i = 0; i < n; i++) {
    const X = rnd() * W;
    const h = horizonY(X, P);
    const depth = Math.pow(rnd(), .8);
    const Y = h + 14 + depth * ((P.bottom || H) - h);
    const r = 10 + depth * depth * 70 * (.5 + rnd());
    out.push({ x: X, y: Y, r, sq: .22 + depth * .2 });
  }
  // 前景几个大坑，轮廓清楚
  for (const [fx, fd, fr] of [[.2, .88, 250], [.78, .8, 190], [.47, .5, 95]]) {
    const X = fx * W, h = horizonY(X, P);
    out.push({ x: X, y: h + 14 + fd * ((P.bottom || H) - h), r: fr, sq: .26 + fd * .12 });
  }
  return out.sort((a, b) => a.y - b.y);
}
