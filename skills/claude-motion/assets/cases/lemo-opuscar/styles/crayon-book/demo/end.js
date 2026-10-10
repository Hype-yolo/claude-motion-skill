// 结尾：画面拉远成一本打开的绘本（真纸：中缝阴影、页面弧度、柔和投影），书躺在蜡笔画的木桌上，
// 旁边是用短了的蜡笔、一支笔头湿着蓝色的平头刷和一杯洗笔水。翻页 → The End。
// 桌面空间：右页 = [0,1920]×[0,1080]，左页 = [-1920,0]×[0,1080]，中缝 x = 0。
import { layer, clear, line, fill, dab, text, handCircle, ellipse, smooth, xf, CAM, BOIL, W, H } from './crayon.js';
import { group, clearGroup, part } from './rig.js';
import { star } from './chars.js';
import { PAL } from './pal.js';
import { clamp, lerp, hash, ss, eio, track } from '/core/lib.js';
const K = PAL.crayon;
const pr = (t, a, b) => clamp((t - a) / (b - a));
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return { c, g: c.getContext('2d') }; };
const pageR = mk(), pageL = mk(), pageEnd = mk(), pageBack = mk(), book = mk();
const DUM = layer(), TXT = layer(), DESK = { f: layer(), l: layer() }, OBJ = group(), WET = layer(), SUBK = layer(), SUBT = layer();
const glc = () => document.getElementById('gl');
const snap = P => { P.g.setTransform(1, 0, 0, 1, 0, 0); P.g.clearRect(0, 0, W, H); P.g.drawImage(glc(), 0, 0); };

// 桌面镜头：z 缩放，c 中心（桌面坐标）
const camD = track([[46.0, [960, 540, 1]], [47.5, [0, 580, 0.44]], [49.0, [0, 580, 0.44]], [50.4, [960, 560, 0.78]], [52, [960, 560, 0.8]]]);
export const TURN = [47.6, 48.8];

export function endFrame(comp, t, api) {
  const [cx, cy, z] = camD(t);
  // 1) 右页 = 这一页画（整页视角，无字幕、无暗角）
  api.drawPage(comp, t, [1600, 900, 0.6], { subs: false, vig: 0 }); snap(pageR);
  // 2) 左页：书上印着的那一句
  CAM.x = 960; CAM.y = 540; CAM.s = 1; clear(TXT);
  text(TXT, 'And at last,', 960, 470, { size: 92, col: K.ink, seed: 301, p: 0.95, stroke: 1.5 });
  text(TXT, 'the moon fell asleep.', 960, 590, { size: 92, col: K.ink, seed: 302, p: 0.95, stroke: 1.5 });
  clear(DUM); star({ k: DUM, f: TXT, l: TXT }, [960, 760], 26, 330, 0.2, K.yellow, true);
  comp.paperCam(2000, 300, 1); comp.begin(PAL.paper); comp.crayon(TXT.c); comp.finish({ vig: 0, emb: 0.55 }); snap(pageL);
  // 3) 下一页：The End
  clear(TXT);
  text(TXT, 'The End', 960, 520, { size: 230, font: 'Gaegu', weight: 700, col: K.ink, seed: 311, p: 0.95, stroke: 3 });
  { const cr = []; for (let i = 0; i <= 24; i++) { const a = -2.2 + 4.4 * i / 24; cr.push([1330 + Math.cos(a) * 66, 330 + Math.sin(a) * 66]); } for (let i = 0; i <= 24; i++) { const a = 1.95 - 3.9 * i / 24; cr.push([1296 + Math.cos(a) * 60, 322 + Math.sin(a) * 60]); }
    fill(TXT, cr, { col: K.yellow, p: 0.9, gap: 6, w: 8, seed: 320, over: 2 }); line(TXT, [...cr, cr[0]], { w: 6, seed: 321 });
    line(TXT, [[1352, 318], [1360, 326], [1370, 320]], { w: 5, seed: 322 }); }
  text(TXT, 'Crayon Picture Book', 960, 720, { size: 76, col: K.ink, seed: 312, p: 0.9 });
  text(TXT, 'LemoLab × Claude Opus 5.5', 960, 830, { size: 60, col: K.ink, seed: 313, p: 0.8 });
  comp.paperCam(4100, 700, 1); comp.begin(PAL.paper); comp.crayon(TXT.c); comp.finish({ vig: 0, emb: 0.55 }); snap(pageEnd);
  // 4) 翻过去那页的背面：透出一点正面的画（镜像）
  comp.paperCam(700, 3100, 1); comp.begin(PAL.paper); comp.finish({ vig: 0, emb: 0.55 }); snap(pageBack);
  { const g = pageBack.g; g.save(); g.globalAlpha = 0.07; g.globalCompositeOperation = 'multiply'; g.translate(W, 0); g.scale(-1, 1); g.drawImage(pageR.c, 0, 0); g.restore(); }

  // 5) 桌面（蜡笔画）+ 蜡笔 + 刷子 + 水杯
  CAM.x = cx; CAM.y = cy; CAM.s = z;
  clear(DESK.f); clear(DESK.l); clearGroup(OBJ); clear(WET); clear(SUBK); clear(SUBT);
  drawDesk(DESK);
  drawTools(OBJ, WET);
  // 6) 书（2D：真纸）
  drawBook(book.g, t, cx, cy, z);
  // 字幕
  if (api.subTo) api.subTo(SUBK, SUBT, t);
  // 合成
  const k = pr(t, 46.0, 46.9);                // 从"满屏一页"过渡到桌面：暗角、纸纹、台灯慢慢出来
  comp.paperCam(cx, cy, z); comp.begin(PAL.paper);
  if (k > 0) { comp.crayon(DESK.f.c); comp.crayon(DESK.l.c); }
  comp.image(book.c);
  if (k > 0) { comp.group(OBJ, { goff: [hash(BOIL.step) * 200, 0] }); comp.wash(WET.c, { color: PAL.wash, resist: 0.9 }); }
  comp.knock(SUBK.c); comp.crayon(SUBT.c);
  comp.finish({ vig: 0.3 * k, emb: 0.55 * k, lamp: [0.42, 0.62, 0.62, 0.85 * k] });
}

const toS = (x, y, cx, cy, z, f = 1) => [((x - cx) * f) * z + W / 2, ((y - cy) * f) * z + H / 2];

function drawBook(g, t, cx, cy, z) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  const D = 5200;                              // 透视：翻起的纸越高离镜头越近
  const P = (x, y, h = 0) => toS(x, y, cx, cy, z, D / (D - h));
  const k = pr(t, 46.0, 46.9);
  // 投影 + 硬壳封面
  if (k > 0) {
    g.save(); g.filter = `blur(${Math.max(1, 34 * z)}px)`; g.fillStyle = `rgba(40,22,10,${0.5 * k})`;
    const [a, b] = P(-1960 + 40, -40 + 60), [c, d] = P(1960 + 40, 1120 + 60); g.fillRect(a, b, c - a, d - b); g.restore();
    g.fillStyle = '#2c3b6e'; const [a2, b2] = P(-1975, -38), [c2, d2] = P(1975, 1118); rr(g, a2, b2, c2 - a2, d2 - b2, 14 * z); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)'; const [s0] = P(-40, 0), [s1] = P(40, 0); g.fillRect(s0, b2, s1 - s0, d2 - b2);
    // 书口（页边厚度）
    g.strokeStyle = 'rgba(120,105,80,0.55)'; g.lineWidth = Math.max(1, 1.5 * z);
    for (let i = 1; i <= 4; i++) { const [x0, y0] = P(1920 + i * 5, 6 + i * 3), [x1, y1] = P(1920 + i * 5, 1074 + i * 3); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); const [x2, y2] = P(-1920 - i * 5, 6 + i * 3), [x3, y3] = P(-1920 - i * 5, 1074 + i * 3); g.beginPath(); g.moveTo(x2, y2); g.lineTo(x3, y3); g.stroke(); }
  }
  const th = Math.PI * ss(pr(t, TURN[0], TURN[1]));
  const turning = th > 0.001 && th < Math.PI - 0.001, turned = th >= Math.PI - 0.001;
  // 平躺的书页（带中缝弧度与阴影）
  flatPage(g, pageL.c, -1, P, k);
  flatPage(g, turned || turning ? pageEnd.c : pageR.c, 1, P, k);
  if (turned) flatPage(g, pageBack.c, -1, P, k);
  if (turning) {
    // 下一页上的投影
    const edgeX = 1920 * Math.cos(th);
    if (th < Math.PI / 2) { const [ex] = P(Math.max(0, edgeX), 0), [sx0, sy0] = P(0, 0), [, sy1] = P(0, 1080); const gr = g.createLinearGradient(ex, 0, ex + 260 * z * (1 - Math.cos(th)), 0); gr.addColorStop(0, `rgba(30,20,10,${0.35 * Math.sin(th)})`); gr.addColorStop(1, 'rgba(30,20,10,0)'); g.fillStyle = gr; const [rx] = P(1920, 0); g.fillRect(sx0, sy0, rx - sx0, sy1 - sy0); }
    else { const [lx, ly0] = P(-1920, 0), [, ly1] = P(0, 1080), [ex] = P(Math.min(0, edgeX), 0); const gr = g.createLinearGradient(ex, 0, ex - 260 * z * (1 + Math.cos(th)), 0); gr.addColorStop(0, `rgba(30,20,10,${0.35 * Math.sin(th)})`); gr.addColorStop(1, 'rgba(30,20,10,0)'); g.fillStyle = gr; const [sx0] = P(0, 0); g.fillRect(lx, ly0, sx0 - lx, ly1 - ly0); }
    // 翻起的那页：48 条竖条，每条自己的角度（外缘滞后 = 纸的弯曲）+ 透视放大
    const N = 64;
    const strips = [];
    for (let i = 0; i < N; i++) {
      const u0 = 1920 * i / N, u1 = 1920 * (i + 1) / N, um = (u0 + u1) / 2;
      const ang = u => th - 0.5 * Math.sin(th) * Math.pow(u / 1920, 1.6);
      const x0 = u0 * Math.cos(ang(u0)), x1 = u1 * Math.cos(ang(u1)), h = um * Math.sin(ang(um));
      const front = Math.cos(ang(um)) > 0;
      strips.push({ i, u0, u1, x0, x1, h, front, a: ang(um), aA: ang(u0), aB: ang(u1) });
    }
    strips.forEach(S => {
      // 每条竖条用仿射变换贴成平行四边形：左右两边各有自己的透视高度，上下边连续
      const hA = S.u0 * Math.sin(S.aA), hB = S.u1 * Math.sin(S.aB);
      const fA = D / (D - hA), fB = D / (D - hB);
      const [XA, YA0] = toS(S.x0, 0, cx, cy, z, fA), [, YA1] = toS(S.x0, 1080, cx, cy, z, fA);
      const [XB, YB0] = toS(S.x1, 0, cx, cy, z, fB);
      if (Math.abs(XB - XA) < 0.2) return;
      const src = S.front ? pageR.c : pageBack.c;
      const sw = 1920 / N, scol = S.front ? S.u0 : 1920 - S.u1;
      g.save();
      // 源条的左边 → (XA, YA0..YA1)，右边 → (XB, YB0..)
      if (S.front) g.setTransform((XB - XA) / sw, (YB0 - YA0) / sw, 0, (YA1 - YA0) / 1080, XA, YA0);
      else g.setTransform((XA - XB) / sw, (YA0 - YB0) / sw, 0, (YA1 - YA0) / 1080, XB, YB0);
      g.drawImage(src, scol, 0, sw, 1080, 0, 0, sw * 1.04, 1080);
      const shade = S.front ? 0.28 * Math.sin(S.a) * (0.6 + 0.4 * S.u0 / 1920) : 0.16 * Math.abs(Math.cos(S.a));
      g.fillStyle = `rgba(40,28,15,${shade})`; g.fillRect(0, 0, sw * 1.04, 1080);
      g.restore();
    });
  }
  // 中缝阴影
  const [gx] = P(0, 0), [, gy0] = P(0, 0), [, gy1] = P(0, 1080), gw = 200 * z;
  const gr = g.createLinearGradient(gx - gw, 0, gx + gw, 0);
  gr.addColorStop(0, 'rgba(60,40,20,0)'); gr.addColorStop(0.42, 'rgba(60,40,20,0.12)'); gr.addColorStop(0.5, 'rgba(50,32,15,0.34)'); gr.addColorStop(0.58, 'rgba(60,40,20,0.12)'); gr.addColorStop(1, 'rgba(60,40,20,0)');
  g.fillStyle = gr; g.globalAlpha = k; g.fillRect(gx - gw, gy0 - 6 * z, gw * 2, gy1 - gy0 + 12 * z); g.globalAlpha = 1;
}
// 平躺的一页：靠近中缝的几条略微抬起（页面弧度）并变暗
function flatPage(g, src, side, P, k) {
  const N = 24;
  for (let i = 0; i < N; i++) {
    const u0 = 1920 * i / N, u1 = 1920 * (i + 1) / N;
    const lift = k * 14 * Math.pow(1 - Math.min(1, u0 / 420), 2);     // 靠近中缝往上鼓
    const xa = side > 0 ? u0 : -u1, xb = side > 0 ? u1 : -u0;
    const [X0, Y0] = P(xa, -lift), [X1, Y1] = P(xb, 1080 + lift * 0.3);
    const scol = side > 0 ? u0 : 1920 - u1;
    g.drawImage(src, scol, 0, 1920 / N, 1080, X0, Y0, X1 - X0 + 0.6, Y1 - Y0);
  }
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// —— 木桌：赭石打底 + 棕色交叉排线 + 木纹 + 木板缝 ——
function drawDesk(Dk) {
  const R = [[-2600, -1000], [2600, -1000], [2600, 2100], [-2600, 2100]];
  fill(Dk.f, R, { col: K.ochre, p: 0.9, gap: 13, w: 16, ang: 0.08, seed: 700, over: 0 });
  fill(Dk.f, R, { col: K.brown, p: 0.5, gap: 18, w: 16, ang: -0.06, seed: 701, over: 0 });
  for (let i = 0; i < 26; i++) {
    const y0 = -1000 + i * 120 + hash(i) * 40; const pts = []; for (let x = -2600; x <= 2600; x += 100) pts.push([x, y0 + 16 * Math.sin(x * 0.0021 + i) + 8 * Math.sin(x * 0.009 + i * 2)]);
    line(Dk.l, pts, { w: 5, col: K.brown, p: 0.7, seed: 710 + i, wob: 2 });
  }
  for (let j = 0; j < 5; j++) { const y = -760 + j * 700; line(Dk.l, [[-2600, y], [2600, y + 6]], { w: 6, col: K.ink, p: 0.45, seed: 750 + j }); }
  [[-2250, 1500], [2300, -500], [-1500, -700]].forEach(([x, y], i) => line(Dk.l, ellipse(x, y, 60, 24, 24), { w: 5, col: K.brown, p: 0.8, seed: 760 + i }));
}
// —— 蜡笔（顶视：包纸 + 磨圆的笔头）、平头刷、洗笔水 ——
function crayonStick(C, x, y, a, col, len, sd) {
  const r = 46, T = pts => xf(pts, { x, y, r: a });
  const tip = [[len * 0.5, -r * 0.8], [len * 0.5 + 70, -r * 0.3], [len * 0.5 + 84, 0], [len * 0.5 + 70, r * 0.3], [len * 0.5, r * 0.8]];
  const body = [[-len * 0.5, -r], [len * 0.5, -r], ...tip.slice(1, -1), [len * 0.5, r], [-len * 0.5, r]];
  part(C, T(body), { col, p: 0.9, gap: 7, w: 9, ang: a + 1.5, seed: sd }, { w: 4.5, seed: sd + 1 });
  // 包纸：同色纸 + 两道深色环 + 锯齿纹
  const wr = [[-len * 0.5, -r - 3], [len * 0.28, -r - 3], [len * 0.28, r + 3], [-len * 0.5, r + 3]];
  part(C, T(wr), { col, p: 0.7, gap: 6, w: 8, ang: a, seed: sd + 2 }, { w: 4, seed: sd + 3 });
  [-len * 0.38, len * 0.18].forEach((u, i) => fill(C.f, T([[u, -r - 3], [u + 26, -r - 3], [u + 26, r + 3], [u, r + 3]]), { col: K.ink, p: 0.8, gap: 4, w: 6, seed: sd + 4 + i }));
  const zz = []; for (let i = 0; i <= 10; i++) zz.push([-len * 0.3 + i * len * 0.045, (i % 2 ? -1 : 1) * r * 0.35]);
  line(C.l, T(zz), { w: 3.5, col: K.ink, p: 0.6, seed: sd + 6 });
  // 圆柱明暗：一侧压暗、一侧白蜡高光
  fill(C.f, T([[-len * 0.5, r * 0.35], [len * 0.5, r * 0.35], [len * 0.5, r], [-len * 0.5, r]]), { col: K.ink, p: 0.25, gap: 6, w: 8, ang: a, seed: sd + 7 });
  line(C.l, T([[-len * 0.46, -r * 0.5], [len * 0.52, -r * 0.45]]), { w: 5, col: K.white, p: 0.9, seed: sd + 8 });
}
function drawTools(C, WETL) {
  crayonStick(C, -900, 1420, 0.12, K.yellow, 560, 800);
  crayonStick(C, -300, 1500, -0.2, K.violet, 480, 820);
  crayonStick(C, 380, 1400, 0.3, K.ink, 400, 840);
  crayonStick(C, 1000, 1520, -0.05, K.red, 520, 860);
  crayonStick(C, 1700, 1380, 0.5, K.pink, 440, 880);
  crayonStick(C, -1650, 1560, -0.35, K.sky, 460, 900);
  // 平头刷：木柄 → 金属箍 → 鬃毛（笔头湿着群青）
  const a = -0.1, bx = 700, by = -300, T = pts => xf(pts, { x: bx, y: by, r: a });
  const handle = [[-700, -18], [-80, -28], [0, -30], [0, 30], [-80, 28], [-700, 18], [-730, 0]];
  part(C, T(handle), { col: K.brown, p: 0.85, gap: 7, w: 9, ang: a + 1.4, seed: 920 }, { w: 4.5, seed: 921 });
  line(C.l, T([[-680, -8], [-20, -14]]), { w: 4, col: K.ochre, p: 0.9, seed: 922 });
  const ferr = [[0, -34], [150, -40], [150, 40], [0, 34]];
  part(C, T(ferr), { col: K.sky, p: 0.45, gap: 6, w: 8, ang: a, seed: 923 }, { w: 4.5, seed: 924 });
  line(C.l, T([[10, -20], [140, -24]]), { w: 5, col: K.white, p: 1, seed: 925 });
  [40, 80, 120].forEach((u, i) => line(C.l, T([[u, -38], [u, 38]]), { w: 3, col: K.ink, p: 0.5, seed: 926 + i }));
  const bristle = [[150, -42], [300, -50], [318, -30], [322, 0], [318, 30], [300, 50], [150, 42]];
  part(C, T(bristle), null, { w: 4.5, seed: 930 });
  for (let i = 0; i < 9; i++) { const y = -40 + i * 10; line(C.l, T([[160, y * 0.9], [310, y * 1.1]]), { w: 2.5, col: K.ink, p: 0.35, seed: 931 + i }); }
  // 湿的群青：笔头 + 桌上一小滩
  const wg = WETL.g; wg.save(); wg.setTransform(CAM.s, 0, 0, CAM.s, W / 2 - CAM.x * CAM.s, H / 2 - CAM.y * CAM.s);
  wg.fillStyle = '#000'; wg.globalAlpha = 0.85; wg.beginPath(); T([[200, -46], [300, -50], [322, 0], [300, 50], [200, 46], [230, 0]]).forEach(([x, y], i) => i ? wg.lineTo(x, y) : wg.moveTo(x, y)); wg.fill();
  wg.globalAlpha = 0.6; wg.beginPath(); const tipC = T([[420, 20]])[0]; wg.ellipse(tipC[0], tipC[1], 90, 55, 0.4, 0, 7); wg.fill();
  // 洗笔水
  wg.globalAlpha = 0.32; wg.beginPath(); wg.arc(-1480, -330, 140, 0, 7); wg.fill();
  wg.restore();
  const jar = handCircle(-1480, -330, 162, 950, 0.05);
  line(C.l, jar, { w: 6, col: K.sky, p: 0.9, seed: 951 });
  line(C.l, handCircle(-1480, -330, 140, 952, 0.05), { w: 4, col: K.sky, p: 0.6, seed: 953 });
  line(C.l, ellipse(-1480, -330, 128, 128, 20, 3.6, 4.6), { w: 9, col: K.white, p: 0.9, seed: 954 });
}
