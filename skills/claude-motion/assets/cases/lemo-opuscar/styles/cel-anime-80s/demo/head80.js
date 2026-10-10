// 80 年代人设的头部（返修 v2）：颅骨球体 + 鹅蛋形下颌，三个角度（front / q = 3/4 / side）× 多种表情
// 局部坐标：颅骨球心 (0,0)，半径 80；头顶 -80，眼睛中心 +22，鼻底 +54，嘴 +74，下巴 +114。脸朝画面右侧。
// 描线：皮肤 = 细的暖深棕，头发 = 深紫，睫毛近黑，道具近黑（80 年代赛璐璐的彩色描线）
import { cel, path, poly, ribbon, flutter, line, TAU, rgba, mix, LWK } from './cel.js';

const LW = 1.5;                  // 基础线宽（局部单位）
const LS = LW * .78, LH = LW * 1.05, LP = LW * 1.25;   // 皮肤 / 头发 / 道具

// ——— 表情预设 ———  brow: [内端 dy, 外端 dy, 眉弓]（正 = 向下）
export const EXPR = {
  neutral: { open: 1, lid: 0, brow: [0, 0, 2], mouth: 'closed' },
  determined: { open: .95, lid: .34, brow: [6, -3, 1], mouth: 'set', look: [.3, 0] },
  panting: { open: .55, lid: .5, brow: [-6, 5, 1.5], mouth: 'pant', look: [0, .25], sweat: true, blush: .45, shoulders: -10 },
  smile: { open: .72, lid: .1, brow: [-3, -1, 3], mouth: 'smile', smileEyes: true },
  smileopen: { open: .74, lid: .08, brow: [-4, -2, 3.5], mouth: 'smileopen', smileEyes: true },
  surprised: { open: 1.12, lid: -.25, brow: [-9, -7, 4.5], mouth: 'oh', iris: .78 },
  talk: { open: 1, lid: .1, brow: [0, 0, 2], mouth: 'talk' },
  closed: { open: 0, lid: 0, brow: [0, 0, 2], mouth: 'closed' },
};

// ——— 眼睛 ———
function eye(g, P, cx, cy, w, h, dir, fs, E, detail) {
  const open = Math.max(0, E.open ?? 1), lid = E.lid || 0, W2 = w / 2, lash = P.lash || P.hair.l;
  const X = u => cx + dir * u * W2;                    // u：-1 内眼角 → +1 外眼角
  const inY = cy + h * .1, outY = cy - h * .08 - (E.smileEyes ? h * .06 : 0);
  const topY = cy - h * .5 * open + lid * h * .32;
  const botY = cy + h * .47 * Math.min(1, open + .25) - (E.smileEyes ? h * .3 : 0);
  if (open > .08) {
    const WP = path([[X(-1), inY, 1], [X(-.4), topY + h * .05], [X(.3), topY], [X(1), outY, 1], [X(.45), botY], [X(-.4), botY - h * .02]], true);
    g.save(); g.clip(WP);
    g.fillStyle = P.white_eye; g.fill(WP);
    g.fillStyle = mix(P.white_eye, P.skin.s, .55); g.fillRect(cx - w, topY - 6, w * 2, h * .22 + 6);   // 上眼睑投影
    const sc = E.iris || 1, iw = w * .25 * sc * (fs < 1 ? .92 : 1), ih = h * .46 * sc;
    const ix = cx + dir * W2 * .04 + (E.look?.[0] || 0) * w * .15, iy = cy + h * .08 + (E.look?.[1] || 0) * h * .14;
    const IR = new Path2D(); IR.ellipse(ix, iy, iw, ih, 0, 0, TAU);
    g.fillStyle = P.eye.f; g.fill(IR);
    g.save(); g.clip(IR);
    g.fillStyle = P.eye.s; g.fillRect(ix - iw, iy - ih, iw * 2, ih * .95);                 // 上部暗色
    g.fillStyle = mix(P.eye.s, lash, .5); g.fillRect(ix - iw, iy - ih, iw * 2, ih * .38);     // 顶部最深的一条带
    g.fillStyle = mix(P.eye.l, lash, .3); g.beginPath(); g.ellipse(ix, iy - ih * .02, iw * .46, ih * .52, 0, 0, TAU); g.fill();   // 瞳孔
    g.fillStyle = P.eye.h; g.beginPath(); g.ellipse(ix, iy + ih * .9, iw * 1.05, ih * .52, 0, 0, TAU); g.fill();                    // 底部亮月牙
    g.fillStyle = mix(P.eye.h, '#ffffff', .45); g.beginPath(); g.ellipse(ix, iy + ih * 1.05, iw * .7, ih * .32, 0, 0, TAU); g.fill();
    if (E.reflect) { g.strokeStyle = rgba(E.reflect, .85); g.lineWidth = iw * .18; g.beginPath(); g.arc(ix, iy, ih * .72, .3, 1.3); g.stroke(); }
    g.restore();
    g.strokeStyle = mix(P.eye.l, lash, .5); g.lineWidth = LW * .75 * LWK.k; g.stroke(IR);
    g.fillStyle = '#ffffff';   // 高光：左上大椭圆 + 右下小圆
    g.beginPath(); g.ellipse(ix - dir * iw * .34, iy - ih * .34, iw * .42, ih * .27, -.5 * dir, 0, TAU); g.fill();
    g.beginPath(); g.arc(ix + dir * iw * .42, iy + ih * .34, iw * .2, 0, TAU); g.fill();
    g.restore();
    // 下眼睑：外侧一小段细线 + 一根淡下睫毛
    line(g, [[X(.95), outY + h * .12], [X(.5), botY + 1], [X(.05), botY + 1.5]], mix(P.skin.l, P.skin.f, .35), LS * .8);
  }
  const t = h * .19;
  if (open > .08) {   // 粗上睫毛线，外眼角加厚上挑
    cel(g, [[X(-1.03), inY + 1, 1], [X(-.4), topY + h * .05 - t * .6], [X(.3), topY - t * .75], [X(.95), outY - t], [X(1.25), outY - t * 2.1, 1],
      [X(1.03), outY + t * .5], [X(.3), topY + t * .45], [X(-.4), topY + h * .05 + t * .35], [X(-.98), inY + t * .6, 1]], { f: lash });
    for (let k = 0; k < 3; k++) {   // 外眼角挑出的 3 根睫毛
      const u = .55 + k * .2, bx = X(u), by = topY + (outY - topY) * ((u - .3) / .7) - t * .5;
      cel(g, [[bx - dir * 2, by, 1], [bx + dir * (4 + k * 3), by - h * (.16 + k * .05), 1], [bx + dir * 3, by + 1, 1]], { f: lash });
    }
    line(g, [[X(-.25), topY - h * .22], [X(.45), topY - h * .25], [X(1), outY - h * .3]], mix(P.skin.l, P.skin.f, .3), LS * .85);   // 双眼睑
  } else {   // 闭眼（快速眨眼的那一张）
    cel(g, [[X(-1), inY, 1], [X(0), cy + h * .22], [X(1.05), outY + h * .04], [X(1.22), outY - t, 1], [X(1), outY + t * .8], [X(0), cy + h * .22 + t * .8], [X(-.98), inY + t * .5, 1]], { f: lash });
  }
}
function eyeSide(g, P, cx, cy, w, h, E) {   // 正侧面：楔形眼
  const open = Math.max(0, E.open ?? 1), lid = E.lid || 0, lash = P.lash || P.hair.l;
  const topY = cy - h * .5 * open + lid * h * .32, front = cx + w * .5, back = cx - w * .5;
  const botY = cy + h * .46 - (E.smileEyes ? h * .26 : 0);
  if (open > .08) {
    const WP = path([[back, cy - h * .12, 1], [cx - w * .1, topY], [front, cy + h * .06, 1], [cx, botY]], true);
    g.save(); g.clip(WP); g.fillStyle = P.white_eye; g.fill(WP);
    const ix = cx + w * .2, iy = cy + h * .1, iw = w * .24, ih = h * .46;
    g.fillStyle = P.eye.f; g.beginPath(); g.ellipse(ix, iy, iw, ih, 0, 0, TAU); g.fill();
    g.fillStyle = P.eye.s; g.fillRect(ix - iw, iy - ih, iw * 2, ih * .95);
    g.fillStyle = mix(P.eye.s, lash, .5); g.fillRect(ix - iw, iy - ih, iw * 2, ih * .38);
    g.fillStyle = P.eye.h; g.beginPath(); g.ellipse(ix, iy + ih * .9, iw, ih * .5, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ix - iw * .15, iy - ih * .32, iw * .45, ih * .24, 0, 0, TAU); g.fill();
    g.restore();
    const t = h * .17;
    cel(g, [[back - w * .35, cy - h * .3 - t, 1], [cx - w * .1, topY - t * .6], [front + w * .04, cy + h * .02, 1], [cx - w * .1, topY + t * .5], [back, cy - h * .06, 1]], { f: lash });
    cel(g, [[back - w * .1, cy - h * .2, 1], [back - w * .5, cy - h * .45, 1], [back - w * .05, cy - h * .12, 1]], { f: lash });
    line(g, [[cx - w * .15, botY], [front - w * .1, cy + h * .26]], mix(P.skin.l, P.skin.f, .3), LS * .8);
    line(g, [[back + w * .05, topY - h * .12], [cx + w * .2, topY - h * .2]], mix(P.skin.l, P.skin.f, .3), LS * .8);
  } else cel(g, [[back - w * .3, cy - h * .12, 1], [cx, cy + h * .2], [front, cy + h * .08, 1], [cx, cy + h * .28], [back, cy + h * .02, 1]], { f: lash });
}
function brow(g, P, ix, iy, ox, oy, B) {   // 细长眉：内端 → 外端，B = [内 dy, 外 dy, 眉弓]
  const a = [ix, iy + B[0]], c = [ox, oy + B[1]], m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2 - B[2]];
  const col = P.lash || P.hair.l;
  cel(g, [[a[0], a[1] - 1.4, 1], [m[0], m[1] - 1.6], [c[0], c[1] - .2, 1], [m[0], m[1] + 1.2], [a[0], a[1] + 1.4, 1]], { f: col });
}

// ——— 嘴（唇形 + 口内色）———
function mouth(g, P, cx, cy, w, type, fs = 1) {
  const L = cx - w / 2, R = cx + w / 2 * fs;
  const lc = P.skin.l, lip = rgba(P.mouth, .22);
  const lowerLip = (y, ww) => { line(g, [[cx - ww * .6, y], [cx + ww * .5, y]], mix(lc, P.skin.f, .5), LS * .75); };
  if (type === 'closed' || type === 'set') {
    const dn = type === 'set' ? 1.6 : 0;
    line(g, [[L, cy + dn], [cx - w * .12, cy - .6], [cx + w * .06, cy + .2], [R, cy + dn]], lc, LS * 1.05);
    lowerLip(cy + 5.5, w * .2);
  } else if (type === 'smile') {
    line(g, [[L - 1, cy - 3], [cx - w * .15, cy + 1.6], [cx + w * .1, cy + 1.6], [R + 1, cy - 3]], lc, LS * 1.05);
    lowerLip(cy + 6.5, w * .16);
  } else {
    let pts, teeth = 0, tongue = 0, bot;
    if (type === 'smileopen') { pts = [[L - 1, cy - 3, 1], [cx, cy - 2], [R + 1, cy - 3, 1], [cx + w * .2, cy + 6], [cx, cy + 10], [cx - w * .22, cy + 6]]; teeth = 1; tongue = 1; bot = cy + 10; }
    else if (type === 'pant') { pts = [[L + 1, cy + 1, 1], [cx, cy - 2], [R - 1, cy + 1, 1], [cx + w * .2, cy + 14], [cx, cy + 17], [cx - w * .22, cy + 14]]; teeth = 1; tongue = 1; bot = cy + 17; }
    else if (type === 'oh') { pts = [[cx - w * .24, cy + 3], [cx, cy - 4], [cx + w * .22, cy + 3], [cx + w * .16, cy + 14], [cx - w * .16, cy + 14]]; bot = cy + 14; }
    else { pts = [[L + 3, cy, 1], [cx, cy - 1], [R - 3, cy, 1], [cx + w * .08, cy + 7], [cx - w * .1, cy + 7]]; tongue = .8; bot = cy + 7; }   // talk
    const MP = path(pts, true);
    g.save(); g.clip(MP); g.fillStyle = '#5a1a2a'; g.fill(MP);
    if (tongue) { g.fillStyle = '#e0707a'; g.beginPath(); g.ellipse(cx, bot + 1, w * .28, 6, 0, 0, TAU); g.fill(); }
    if (teeth) { g.fillStyle = '#ffffff'; g.fillRect(cx - w, cy - 8, w * 2, 10.5); }
    g.restore();
    g.strokeStyle = lc; g.lineWidth = LS * 1.05 * LWK.k; g.lineJoin = 'round'; g.stroke(MP);
    lowerLip(bot + 4.5, w * .14);
  }
}

// 发束：根部两点 → 尖；bend 弯向一侧
function lock(x0, y0, x1, y1, tx, ty, bend = 0) {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = tx - mx, dy = ty - my, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  return [[x0, y0], [x0 + dx * .55 + nx * bend, y0 + dy * .55 + ny * bend], [tx, ty, 1], [x1 + dx * .5 + nx * bend * .7, y1 + dy * .5 + ny * bend * .7], [x1, y1]];
}
// 天使环：沿颅骨弧度的一整条锯齿高光带（上缘平滑弧线、下缘锯齿）
function halo(g, P, cx, cy, rx, ry, a0, a1, th, teeth, tilt = 0) {
  const up = [], dn = [];
  for (let i = 0; i <= teeth * 2; i++) {
    const u = i / (teeth * 2), a = a0 + (a1 - a0) * u;
    const env = Math.sin(u * Math.PI) * .7 + .3;
    up.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry + Math.sin(a) * tilt]);
    const depth = th * env * (i % 2 ? 1.9 : .55);
    dn.push([cx + Math.cos(a) * (rx - depth * .15), cy + Math.sin(a) * ry + depth + Math.sin(a) * tilt]);
  }
  g.fillStyle = mix(P.hair.h, '#ffffff', .3);
  g.beginPath(); up.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p[0], p[1])); for (let i = dn.length - 1; i >= 0; i--) g.lineTo(dn[i][0], dn[i][1]); g.closePath(); g.fill();
}

// ——— 各角度轮廓 ———
const VIEWS = {
  front: {
    face: [[-66, -40], [-67, 4], [-64, 36], [-57, 64], [-44, 88], [-24, 105], [0, 114], [24, 105], [44, 88], [57, 64], [64, 36], [67, 4], [66, -40], [36, -64], [-36, -64]],
    neck: [[-27, 76], [27, 76], [30, 138], [-30, 138]],
    chinShadow: [[-40, 74], [40, 74], [40, 92], [24, 105], [0, 115], [-24, 105], [-40, 92]],
    farShade: [[90, 26], [90, 120], [26, 108], [44, 92], [54, 70], [60, 46], [64, 26]],
    eyes: [{ x: -38, y: 22, w: 40, h: 36, dir: -1, fs: 1 }, { x: 38, y: 22, w: 40, h: 36, dir: 1, fs: 1 }],
    brows: [[-16, -6, -56, -4], [16, -6, 56, -4]],
    nose: P => g => { g.fillStyle = P.skin.s; g.beginPath(); g.moveTo(3, 40); g.lineTo(7, 53); g.lineTo(1, 55); g.closePath(); g.fill(); line(g, [[-3, 55], [3, 55.5]], P.skin.l, LS); },
    mouth: { x: 0, y: 74, w: 24, fs: 1 },
    blush: [[-42, 48, 13, 4.5], [42, 48, 13, 4.5]],
    cup: [-72, 26],
  },
  q: {
    face: [[-64, -44], [-67, -4], [-66, 30], [-60, 60], [-46, 86], [-24, 104], [4, 114], [24, 108], [38, 94], [46, 78], [48, 64], [53, 46], [55, 30], [50, 16], [53, 0], [54, -40], [18, -64], [-36, -64]],
    neck: [[-36, 66], [12, 90], [16, 138], [-40, 138]],
    chinShadow: [[-46, 64], [20, 64], [20, 96], [4, 115], [-24, 104], [-46, 86]],
    farShade: [[90, 30], [90, 120], [18, 112], [34, 98], [41, 82], [44, 68], [47, 54], [51, 42], [55, 30]],
    eyes: [{ x: -21, y: 22, w: 44, h: 38, dir: -1, fs: 1 }, { x: 35, y: 20, w: 26, h: 35, dir: 1, fs: .6 }],
    brows: [[0, -4, -42, -2], [24, -6, 48, -1]],
    nose: P => g => { g.fillStyle = P.skin.s; g.beginPath(); g.moveTo(42, 42); g.lineTo(45, 51); g.lineTo(39, 55); g.lineTo(39, 49); g.closePath(); g.fill(); line(g, [[38, 55.5], [44, 53]], P.skin.l, LS); },
    mouth: { x: 24, y: 75, w: 22, fs: .7 },
    blush: [[-30, 48, 14, 4.5], [44, 46, 6, 3.5]],
    cup: [-60, 26],
  },
  side: {
    face: [[60, -50], [72, -24], [75, -2], [70, 14], [75, 30], [83, 47, 1], [77, 52], [78, 59], [80, 64], [75, 69], [78, 74], [72, 84], [76, 98, 1], [62, 111], [30, 106], [4, 90], [-8, 60], [-10, 20], [18, -52]],
    neck: [[-12, 60], [16, 100], [12, 126], [-36, 126]],
    chinShadow: [[-20, 58], [50, 58], [62, 111], [30, 106], [4, 90]],
    farShade: [[-40, -60], [8, -60], [2, 0], [-4, 40], [0, 70], [-40, 90]],
    eyes: [{ x: 58, y: 22, w: 26, h: 36, side: true }],
    brows: [[52, -4, 72, -3]],
    nose: P => g => { line(g, [[72, 49], [76, 50]], P.skin.l, LS); },
    mouth: null,
    blush: [[58, 50, 9, 3.5]],
    cup: [-4, 26],
  },
};

// 刘海 / 头发（按角度）：locks = [根x0,根y0,根x1,根y1,尖x,尖y,弯]；前两项是后排
const HAIR = {
  front: {
    back: [[-80, -20], [-84, 30], [-74, 70], [-40, 84], [40, 84], [74, 70], [84, 30], [80, -20], [0, -60]],
    cap: [[-84, 8], [-90, -40], [-68, -84], [-26, -102], [26, -102], [68, -84], [90, -40], [84, 8], [66, -26], [0, -54], [-66, -26]],
    locks: [[-52, -82, -20, -90, -38, -10, 0], [20, -90, 52, -82, 40, -8, 0], [-90, -52, -52, -72, -76, 6, -5], [-70, -74, -26, -86, -52, -2, -3], [-44, -86, -2, -92, -24, -12, 3], [-16, -92, 20, -90, 0, 14, 0], [4, -90, 44, -86, 22, -14, -3], [28, -82, 70, -70, 50, -2, 3], [52, -70, 90, -52, 78, 6, 5]],
    strays: [[-6, -90, -16, 6, 6], [30, -84, 36, 0, -5]],
    side: [[-76, -40, -58, -54, -70, 104, -8], [76, -40, 58, -54, 70, 104, 8]],
    halo: [0, -8, 74, 58, Math.PI * 1.1, Math.PI * 1.9, 8, 9],
    goggles: [[-22, -96, 20], [22, -96, 20]],
  },
  q: {
    back: [[-78, -30], [-92, 20], [-86, 70], [-56, 88], [-18, 80], [36, 62], [56, 20], [56, -20], [-10, -60]],
    cap: [[-88, 4], [-94, -44], [-70, -88], [-24, -104], [24, -100], [58, -78], [66, -46], [60, -8], [46, -30], [0, -54], [-58, -34]],
    locks: [[-56, -86, -24, -94, -40, -8, 0], [0, -96, 28, -90, 18, -10, 0], [-96, -50, -60, -72, -84, 10, -6], [-76, -76, -34, -88, -58, -4, -4], [-50, -88, -6, -94, -28, -14, 2], [-20, -94, 18, -94, 8, 12, 2], [4, -94, 42, -86, 26, -12, 4], [26, -86, 62, -70, 46, -2, 5], [46, -72, 70, -52, 60, 4, 5]],
    strays: [[-20, -92, -34, 4, 5], [20, -92, 30, -2, -4]],
    side: [[-78, -44, -58, -58, -76, 106, -10], [56, -40, 62, -30, 58, 72, 8]],
    halo: [-12, -10, 72, 58, Math.PI * 1.12, Math.PI * 1.85, 8, 8],
    goggles: [[-12, -100, 20], [30, -96, 13]],
  },
  side: {
    back: [[-20, -60], [-60, -40], [-62, 10], [-46, 36], [-16, 42], [-12, 20], [0, -40]],
    cap: [[-64, 18], [-74, -30], [-58, -78], [-18, -100], [30, -96], [64, -74], [76, -46], [64, -40], [30, -58], [-4, -40], [-12, 0], [-38, 28]],
    locks: [[10, -96, 40, -88, 60, -4, 4], [30, -90, 58, -76, 78, 0, 6], [42, -80, 76, -60, 86, -6, 8], [52, -66, 80, -46, 82, 6, 6]],
    strays: [[40, -86, 70, 10, 6]],
    side: [[2, -60, 22, -50, 16, 64, 10]],
    halo: [0, -10, 66, 58, Math.PI * 1.1, Math.PI * 1.82, 8, 8],
    goggles: [[56, -84, 12]],
  },
};

export function head80(g, P, o = {}) {
  const view = o.view || 'q', V = VIEWS[view], Hh = HAIR[view];
  const E = { ...EXPR[o.expr || 'neutral'], ...(o.E || {}) };
  if (o.reflect) E.reflect = o.reflect;
  if (o.look) E.look = o.look;
  if (o.open != null) E.open = o.open;
  if (o.mouth) E.mouth = o.mouth;
  if (o.lid != null) E.lid = o.lid;
  const ph = o.ph || 0, wind = o.wind ?? .4, rim = o.rim;
  const hairSt = { f: P.hair.f, s: P.hair.s, h: P.hair.h, l: P.hair.l, lw: LH, rim };
  const lx = o.light?.[0] ?? -1, ly = o.light?.[1] ?? -.8;
  const SO = k => [lx * k, ly * k];
  // 1 马尾 + 后发
  if (o.ponytail !== false) {
    const px = view === 'front' ? 0 : view === 'q' ? -54 : -50, py = view === 'front' ? -40 : -80;
    for (let k = 0; k < 4; k++) {
      let ang;
      if (view === 'front') ang = Math.PI / 2 + (k < 2 ? 1 : -1) * (.28 + (k % 2) * .16) - Math.sin(ph * TAU + k) * .05 * wind;
      else ang = (Math.PI + .25 - k * .12) * wind + (Math.PI / 2 + .45 - k * .1) * (1 - wind);
      const len = view === 'front' ? 200 - (k % 2) * 30 : 300 - k * 40;
      const sp = flutter(px + (view === 'front' ? (k < 2 ? -44 : 44) : (k - 1.5) * 6), py + k * 5, ang, len, 14, (10 + k * 5) * wind + 3, 1, ph * TAU + k * 1.9, (view === 'front' ? 0 : -(10 + k * 20)) * wind);
      cel(g, ribbon(sp, u => Math.pow(1 - u, .85) * (view === 'front' ? 46 : 60 - k * 8) + 1), { ...hairSt, f: k === 2 || k === 1 ? P.hair.s : P.hair.f, so: SO(8) });
    }
  }
  cel(g, Hh.back, { ...hairSt, f: P.hair.s, so: SO(10), s: mix(P.hair.s, '#000000', .25) });
  // 2 身体（肩、领、围巾）+ 脖子 + 下巴投影
  if (o.body !== false) body(g, P, view, E);
  if (o.neck !== false) cel(g, poly(V.neck.map(([x, y]) => [x, Math.min(y, o.neckEnd ?? 999)])), { f: P.skin.f, s: P.skin.s, l: P.skin.l, lw: LS, sh: [V.chinShadow] });
  if (o.body !== false) scarf(g, P, view, E);
  // 3 脸
  cel(g, V.face, { f: P.skin.f, s: P.skin.s, l: P.skin.l, lw: LS, h: P.skin.h, sh: o.light ? [] : [V.farShade], so: o.light ? SO(12) : null,
    rim: o.skinRim ? { c: o.skinRim, d: [-lx * 2.5, -ly * 2] } : null,
    clipFn: gg => {   // 刘海在额头的投影（跟着刘海下缘）
      gg.fillStyle = mix(P.skin.f, P.skin.s, .7);
      for (const L of Hh.locks) { const [x0, y0, x1, y1, tx, ty, b] = L; gg.fill(path(lock(x0 - 4, y0 + 8, x1 + 6, y1 + 8, tx + 3, ty + 9, b))); }
      gg.fillRect(-120, -120, 240, view === 'side' ? 58 : 62);
    } });
  for (const [x, y, rx, ry] of V.blush) { g.fillStyle = rgba(P.blush, (o.blush ?? E.blush ?? .2)); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
  // 4 五官
  V.nose(P)(g);
  if (V.mouth) mouth(g, P, V.mouth.x, V.mouth.y, V.mouth.w, E.mouth, V.mouth.fs);
  else sideMouth(g, P, E.mouth);
  for (const ey of V.eyes) { if (ey.side) eyeSide(g, P, ey.x, ey.y, ey.w, ey.h, E); else eye(g, P, ey.x, ey.y, ey.w, ey.h, ey.dir, ey.fs, E, o.detail); }
  // 5 头发：发帽 → 侧发 → 暗色底（发束之间的缝）→ 发束（有厚度、互相叠压）→ 碎发 → 天使环
  cel(g, Hh.cap, { ...hairSt, so: SO(10) });
  if (view !== 'front' && o.ponytail !== false) { const px = view === 'q' ? -54 : -50; cel(g, [[px - 14, -92], [px + 6, -96], [px + 12, -72], [px - 8, -66]], { f: P.magenta.f, s: P.magenta.s, so: SO(3), l: P.magenta.l, lw: LS }); }
  if (o.headset !== false) { const [cx, cy] = V.cup; line(g, [[cx + 2, cy - 12], [cx + 8, -64], [cx + 34, -100]], P.phone.f, 5); }
  for (const L of Hh.side) { const [x0, y0, x1, y1, tx, ty, b] = L; const sw = Math.sin(ph * TAU) * 4 * wind; cel(g, lock(x0, y0, x1, y1, tx - 10 * wind + sw, ty, b), { ...hairSt, so: SO(7) }); }
  const lf = Math.sin(ph * TAU) * 2 * wind;
  g.save(); g.fillStyle = P.hair.s; for (const L of Hh.locks) { const [x0, y0, x1, y1, tx, ty, b] = L; g.fill(path(lock(x0 - 10, y0, x1 + 10, y1, tx, ty + 3 + lf, b))); } g.restore();
  const lockSt = { ...hairSt, l: mix(P.hair.l, P.hair.s, .45), lw: LH * .6 };
  for (const L of Hh.locks) { const [x0, y0, x1, y1, tx, ty, b] = L; cel(g, lock(x0, y0, x1, y1, tx, ty + lf, b), { ...lockSt, so: SO(6) }); }
  for (const [x0, y0, tx, ty, b] of Hh.strays) cel(g, lock(x0 - 2, y0, x0 + 2, y0, tx, ty + lf, b), { f: P.hair.f, l: mix(P.hair.l, P.hair.s, .3), lw: LH * .6 });
  const hz = Hh.halo;
  g.save(); const HC = new Path2D(); HC.addPath(path(Hh.cap)); for (const L of Hh.locks) { const [x0, y0, x1, y1, tx, ty, b] = L; HC.addPath(path(lock(x0, y0, x1, y1, tx, ty + lf, b))); }
  g.clip(HC); halo(g, P, hz[0], hz[1], hz[2], hz[3], hz[4], hz[5], hz[6], hz[7]);
  g.restore();
  // 眉毛画在刘海上面（"透过刘海"的惯例，保证情绪看得见）
  for (const b of V.brows) brow(g, P, b[0], b[1], b[2], b[3], E.brow || [0, 0, 2]);
  if (E.sweat) { const sx = view === 'side' ? 40 : view === 'q' ? -58 : -62; cel(g, [[sx, -16, 1], [sx + 7, 0], [sx, 6], [sx - 7, 0]], { f: '#e8f8ff', l: '#4a6a98', lw: LS, h: '#ffffff', hi: [[[sx - 3, -2], [sx - 1, -6], [sx - 4, 2]]] }); }
  // 6 道具：护目镜、耳机、麦克风（近黑描线）
  for (const [x, y, rw] of Hh.goggles) {
    const L = new Path2D(); L.ellipse(x, y, rw, rw * .66, 0, 0, TAU);
    cel(g, L, { f: P.lens.f, s: P.lens.s, sh: [[[x - rw, y], [x + rw, y - 4], [x + rw, y + rw], [x - rw, y + rw]]], l: '#141420', lw: LP, h: P.lens.h, hi: [[[x - rw * .6, y - rw * .35], [x - rw * .1, y - rw * .5], [x - rw * .4, y]]] });
    g.strokeStyle = P.chrome.s; g.lineWidth = 2.6 * LWK.k; g.beginPath(); g.ellipse(x, y, rw + 2.5, rw * .66 + 2.5, 0, 0, TAU); g.stroke();
  }
  if (Hh.goggles.length === 2) { const [a, b] = Hh.goggles; cel(g, poly([[a[0] + a[2], a[1] - 4], [b[0] - b[2], b[1] - 4], [b[0] - b[2], b[1] + 4], [a[0] + a[2], a[1] + 4]]), { f: P.strap.f, l: '#141420', lw: LW }); }
  if (o.headset !== false) {
    const [cx, cy] = V.cup;
    const cup = new Path2D(); cup.ellipse(cx, cy, 14, 20, 0, 0, TAU);
    cel(g, cup, { f: P.phone.f, s: P.phone.s, so: SO(3), h: P.phone.h, ho: [-lx * 2, -ly * 2], l: '#08080c', lw: LP });
    const mx = view === 'side' ? 70 : view === 'q' ? 8 : -10, my = view === 'side' ? 80 : 86;
    line(g, [[cx + 6, cy + 14], [(cx + mx) / 2, my + 2], [mx, my]], P.phone.f, 3);
    const mic = new Path2D(); mic.ellipse(mx, my, 6, 4.5, 0, 0, TAU); cel(g, mic, { f: P.phone.h, l: '#08080c', lw: LW * .8 });
    g.fillStyle = '#ff9a3c'; g.beginPath(); g.arc(cx, cy, 3, 0, TAU); g.fill();
  }
}
function sideMouth(g, P, type) {
  const lc = P.skin.l;
  if (type === 'closed' || type === 'set') { line(g, [[69, 69], [77, 69]], lc, LS * 1.05); }
  else if (type === 'smile') line(g, [[67, 66], [71, 70], [77, 69]], lc, LS * 1.05);
  else { const MP = path([[69, 67, 1], [78, 66], [76, type === 'pant' ? 79 : 75], [70, 74]], true); g.fillStyle = '#5a1a2a'; g.fill(MP); g.strokeStyle = lc; g.lineWidth = LS * LWK.k; g.stroke(MP); }
}
// 肩与立领
function body(g, P, view, E) {
  const dx = view === 'front' ? 0 : view === 'q' ? -14 : -34, dy = E.shoulders || 0;
  cel(g, [[-190 + dx, 330], [-182 + dx, 206 + dy], [-140 + dx, 158 + dy], [-60 + dx, 138 + dy * .5], [50 + dx, 138 + dy * .5], [124 + dx, 156 + dy], [166 + dx, 204 + dy], [176 + dx, 330]], { f: P.jacket.f, s: P.jacket.s, so: [-30, -10], h: P.jacket.h, ho: [8, 6], l: P.jacket.l, lw: LW * 1.1,
    clipFn: gg => { gg.fillStyle = P.stripe.f; gg.fill(poly([[-172 + dx, 214 + dy], [-156 + dx, 190 + dy], [-138 + dx, 330], [-160 + dx, 330]])); gg.fill(poly([[150 + dx, 190 + dy], [166 + dx, 214 + dy], [158 + dx, 330], [136 + dx, 330]])); } });
  cel(g, [[-64 + dx, 146 + dy * .5], [-40 + dx, 120 + dy * .5], [40 + dx, 120 + dy * .5], [62 + dx, 146 + dy * .5], [40 + dx, 160], [-40 + dx, 160]], { f: P.jacket.f, s: P.jacket.s, so: [-8, -8], l: P.jacket.l, lw: LW });
  line(g, [[2 + dx, 158], [6 + dx, 330]], P.jacket.l, LW);
}
function scarf(g, P, view, E) {
  const dx = view === 'front' ? 0 : view === 'q' ? -14 : -34, dy = (E.shoulders || 0) * .5;
  cel(g, [[-44 + dx, 126 + dy], [-20 + dx, 121 + dy], [30 + dx, 123 + dy], [50 + dx, 127 + dy], [51 + dx, 134 + dy], [26 + dx, 137 + dy], [-20 + dx, 135 + dy], [-45 + dx, 133 + dy]], { f: P.scarf.f, s: P.scarf.s, so: [-4, -8], h: P.scarf.h, ho: [0, 3], l: P.scarf.l, lw: LW,
    sh: [[[-4 + dx, 120 + dy], [4 + dx, 137 + dy], [-4 + dx, 138 + dy], [-12 + dx, 120 + dy]], [[30 + dx, 122 + dy], [36 + dx, 137 + dy], [30 + dx, 138 + dy], [24 + dx, 122 + dy]]] });
  cel(g, [[12 + dx, 133 + dy], [32 + dx, 135 + dy], [38 + dx, 196], [26 + dx, 210], [16 + dx, 190]], { f: P.scarf.f, s: P.scarf.s, so: [-5, -4], l: P.scarf.l, lw: LW });
  line(g, [[18 + dx, 152 + dy], [24 + dx, 192]], P.scarf.l, LW * .6);
}
