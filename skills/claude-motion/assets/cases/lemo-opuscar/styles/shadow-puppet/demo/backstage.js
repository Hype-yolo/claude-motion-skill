// 幕后：艺人的手（剪影 + 暖色轮廓光）、油灯（亮 / 熄 + 细烟）、立柱、舞台木框
import { canvas } from './carve.js';
import { vnoise, hash, mulberry } from '/core/lib.js';

const W = 1920, H = 1080;
const [mc, mg] = canvas(W, H), [rc, rg] = canvas(W, H), [oc, og] = canvas(W, H);

// —— 剪影合成：暗色主体 + 朝光一侧的暖色轮廓光 ——
// draw(mask) 在 mask 上用白色画形状；dir = 指向光的单位向量；k = 轮廓宽度
export function silhouette(g, draw, { dir = [.6, -.8], k = 5, dark = '#0c0705', rim = '#ffb05a', rimA = .9, blur = 0 } = {}) {
  mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, W, H); mg.fillStyle = '#fff'; mg.strokeStyle = '#fff'; mg.lineCap = 'round'; mg.lineJoin = 'round';
  draw(mg);
  og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, W, H); og.globalCompositeOperation = 'source-over'; og.filter = 'none';
  og.drawImage(mc, 0, 0); og.globalCompositeOperation = 'source-in'; og.fillStyle = dark; og.fillRect(0, 0, W, H);
  rg.setTransform(1, 0, 0, 1, 0, 0); rg.clearRect(0, 0, W, H); rg.globalCompositeOperation = 'source-over'; rg.filter = 'none';
  rg.drawImage(mc, 0, 0); rg.globalCompositeOperation = 'destination-out'; rg.filter = 'blur(1.6px)'; rg.drawImage(mc, -dir[0] * k, -dir[1] * k);
  rg.filter = 'none'; rg.globalCompositeOperation = 'source-in'; rg.fillStyle = rim; rg.fillRect(0, 0, W, H);
  og.globalCompositeOperation = 'source-over'; og.globalAlpha = rimA; og.filter = 'blur(.7px)'; og.drawImage(rc, 0, 0); og.globalAlpha = 1; og.filter = 'none';
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); if (blur) g.filter = `blur(${blur}px)`; g.drawImage(oc, 0, 0); g.restore();
}

// —— 手：指骨胶囊链 + 掌 ——
const cap = (g, pts, w) => { for (let i = 0; i < pts.length - 1; i++) { const ww = Array.isArray(w) ? w[i] : w; g.lineWidth = ww; g.beginPath(); g.moveTo(...pts[i]); g.lineTo(...pts[i + 1]); g.stroke(); } };
const tf = (M, p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
// 宽袖：腕口一圈椭圆袖口，向下放宽，边缘略起伏
function sleeve(g, T, k, side = 1) {
  g.beginPath(); const pts = [[-40, 30], [-58, 60], [-80, 140], [-104, 280], [110, 280], [86, 150], [66, 62], [44, 30]].map(p => T([p[0] * side, p[1]]));
  g.moveTo(...pts[0]); for (const p of pts) g.lineTo(...p); g.closePath(); g.fill();
  g.beginPath(); const c = T([2 * side, 44]); g.ellipse(c[0], c[1], 52 * k, 18 * k, Math.atan2(T([1, 0])[1] - T([0, 0])[1], T([1, 0])[0] - T([0, 0])[0]), 0, 7); g.fill();
  g.beginPath(); const w = [[-30, -12], [-34, 40], [34, 40], [30, -12]].map(T); g.moveTo(...w[0]); for (const p of w) g.lineTo(...p); g.closePath(); g.fill();   // 腕
}
// 右手握主杆（手背朝镜头，拇指在左）。M = 局部 → 屏幕；局部原点 = 腕中心，-y = 指向
export function fistHand(g, M, grip = 1) {
  const k = Math.hypot(M[0], M[1]), T = p => tf(M, p);
  sleeve(g, T, k, 1);
  // 掌背
  g.beginPath(); const pl = [[-40, 2], [-47, -30], [-46, -66], [-38, -86], [36, -88], [44, -70], [42, -30], [34, 2]].map(T); g.moveTo(...pl[0]);
  for (let i = 1; i < pl.length; i++) g.lineTo(...pl[i]); g.closePath(); g.fill();
  // 四个指节（握拳：近节指骨向前卷，只露出指节隆起 + 一点中节）
  const kn = [[-28, -86, 21], [-8, -91, 22], [13, -90, 21], [31, -84, 18]];
  for (const [x, y, w] of kn) { cap(g, [T([x, y + 8]), T([x - 1, y - 6 * grip]), T([x + 3, y - 14 * grip])], [w * k, w * .92 * k]); }
  // 拇指：从掌侧伸出，压在杆上（受力：末节翘起）
  cap(g, [T([-44, -24]), T([-58, -52]), T([-50, -82]), T([-33, -98])], [26 * k, 22 * k, 18 * k]);
  g.beginPath(); g.arc(...T([-31, -100]), 9 * k, 0, 7); g.fill();
  return { grip: T([-6, -104]) };
}
// 左手捏两根手杆（手背朝镜头，拇指在右）：食指—拇指夹一根，中指—无名指夹一根
export function pinchHand(g, M, sp = 0) {
  const k = Math.hypot(M[0], M[1]), T = p => tf(M, p);
  sleeve(g, T, k, -1);
  g.beginPath(); const pl = [[-34, 2], [-42, -34], [-38, -68], [-28, -84], [32, -86], [40, -66], [42, -30], [34, 2]].map(T); g.moveTo(...pl[0]); for (let i = 1; i < pl.length; i++) g.lineTo(...pl[i]); g.closePath(); g.fill();
  const s = sp;
  // 小指、无名指：向前卷（从背后只看到短短的指节）
  cap(g, [T([-28, -76]), T([-33, -94]), T([-30, -104])], [16 * k, 13 * k]);
  cap(g, [T([-12, -84]), T([-15, -106]), T([-11, -116])], [19 * k, 15 * k]);
  // 中指：微弯向拇指一侧，与食指并拢夹住一根杆
  cap(g, [T([6, -88]), T([8, -122]), T([16 + s * 3, -142]), T([24 + s * 4, -152])], [20 * k, 17 * k, 14 * k]);
  // 食指：更靠右、中节弯，指尖压杆
  cap(g, [T([26, -84]), T([34, -114]), T([44, -130]), T([54, -134])], [20 * k, 17 * k, 14 * k]);
  // 拇指：从掌右下斜上，指尖顶住食指（捏的受力点），末节微翘
  cap(g, [T([40, -18]), T([62, -46]), T([70, -80]), T([64, -106])], [26 * k, 22 * k, 18 * k]);
  g.beginPath(); g.arc(...T([63, -109]), 9.5 * k, 0, 7); g.fill();
  return { gripA: T([58, -124]), gripB: T([20, -150]) };
}
// —— 油灯：灯台 + 灯盏 + 灯芯 + 火焰（lit 0..1）+ 熄灭后的烟 ——
export function lampBody(g, x, y, s) {   // 用白色画进 mask
  const P = (a, b) => [x + a * s, y + b * s];
  g.beginPath(); g.moveTo(...P(-34, -4)); g.quadraticCurveTo(...P(-30, 14), ...P(0, 16)); g.quadraticCurveTo(...P(30, 14), ...P(34, -4)); g.lineTo(...P(24, -2)); g.lineTo(...P(-24, -2)); g.closePath(); g.fill();   // 灯盏
  g.beginPath(); g.moveTo(...P(-5, 14)); g.lineTo(...P(5, 14)); g.lineTo(...P(6, 60)); g.lineTo(...P(-6, 60)); g.closePath(); g.fill();                                   // 短柄
  g.beginPath(); g.ellipse(...P(0, 34), 10 * s, 5 * s, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(...P(-22, 60)); g.lineTo(...P(22, 60)); g.lineTo(...P(16, 68)); g.lineTo(...P(-16, 68)); g.closePath(); g.fill();                               // 托
  g.lineWidth = 2.2 * s; g.beginPath(); g.moveTo(...P(-20, 64)); g.lineTo(...P(0, -260)); g.moveTo(...P(20, 64)); g.lineTo(...P(0, -260)); g.stroke();                  // 吊绳
  g.lineWidth = 3 * s; g.beginPath(); g.moveTo(...P(12, -4)); g.lineTo(...P(20, -10)); g.stroke();                                                                         // 灯芯
}
export function flame(g, x, y, s, t, a = 1) {   // 加色画（lighter）
  if (a <= 0) return;
  const f = 1 + .08 * Math.sin(t * 31) + .06 * vnoise(t * 9) - .03, sw = (vnoise(t * 5 + 3) - .5) * 5 * s;
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a;
  const gx = x + 20 * s, gy = y - 12 * s;
  let gr = g.createRadialGradient(gx, gy - 18 * s, 0, gx, gy - 18 * s, 260 * s); gr.addColorStop(0, 'rgba(255,190,110,.55)'); gr.addColorStop(.25, 'rgba(255,150,70,.18)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = gr; g.fillRect(gx - 260 * s, gy - 280 * s, 520 * s, 520 * s);
  g.beginPath(); g.moveTo(gx - 7 * s, gy); g.quadraticCurveTo(gx - 9 * s, gy - 18 * s * f, gx + sw, gy - 40 * s * f); g.quadraticCurveTo(gx + 9 * s, gy - 18 * s * f, gx + 7 * s, gy); g.closePath();
  gr = g.createLinearGradient(0, gy, 0, gy - 40 * s); gr.addColorStop(0, 'rgba(120,150,255,.8)'); gr.addColorStop(.18, 'rgba(255,240,200,1)'); gr.addColorStop(.6, 'rgba(255,190,90,.95)'); gr.addColorStop(1, 'rgba(255,120,40,.2)');
  g.fillStyle = gr; g.fill();
  g.restore();
}
// 细烟：从灯芯升起、左右飘的几缕；bright(x,y) 给出被灯照亮的程度
export function smoke(g, x, y, s, t, age, bright, seed = 1) {
  if (age <= 0) return;
  const r = mulberry(seed);
  g.save(); g.lineCap = 'round';
  for (let w = 0; w < 3; w++) {
    const ph = r() * 10, amp = 10 + r() * 16, len = Math.min(1, age / 2.5) * (300 + r() * 160) * s;
    const pts = [];
    for (let i = 0; i < 44; i++) {
      const u = i / 43, yy = y - 10 * s - u * len, xx = x + 20 * s + Math.sin(u * 5 + t * .9 + ph) * amp * u * s * (1 + u) + (vnoise(u * 3 + t * .4 + ph) - .5) * 34 * u * s;
      pts.push([xx, yy, u]);
    }
    for (let i = 1; i < pts.length; i++) {
      const [xx, yy, u] = pts[i], b = bright(xx, yy), fade = (1 - u * .85) * Math.min(1, age * .8);
      g.lineWidth = (2.5 + u * 10) * s;
      // 背光的布前：烟是淡褐的一缕；靠近最后那盏灯时被照亮成暖白
      g.globalCompositeOperation = 'source-over'; g.strokeStyle = `rgba(70,48,34,${.2 * fade * (1 - b)})`;
      g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(xx, yy); g.stroke();
      g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(255,200,140,${.32 * fade * b})`;
      g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(xx, yy); g.stroke();
    }
  }
  g.restore();
}
