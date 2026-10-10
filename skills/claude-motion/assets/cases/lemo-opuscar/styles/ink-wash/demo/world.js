// 手卷世界（世界坐标，缩放 1 = 屏幕像素）：右端远山与崖松（起点岸），中间大江（留白），左端对岸。
// 第 1–2 镜：墨滴晕开成山 → 自右向左展卷 → 崖石晕出 → 侠客三笔画出 → 起跳
import { mk, draw, blot } from './ink.js';
import { hero, POSE, mixPose } from './hero.js';
import { ridgeFn, mountainLayer, cun, cliff, pine, vn2 } from './land.js';
import { seal } from './seal.js';
import { T } from './story.js';
import { clamp, lerp, ss, eio, eo, mulberry } from '/core/lib.js';

export const WW = 5600, WH = 1080;
export const HERO0 = [3680, 800];          // 起点崖上
export const HERO1 = [960, 812];            // 对岸
const DROP = [4700, 420];
let LAY = null;
const cv = (w = WW, h = WH) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function layer() { const wet = cv(), dry = cv(); return { wet, dry, ink: { wet: wet.getContext('2d'), dry: dry.getContext('2d') } }; }

export function init() {
  if (LAY) return;
  LAY = { mtn: layer(), cliff: layer(), bank: layer() };
  // 远山（全卷）
  const far = ridgeFn([[5250, 250, 110], [4900, 330, 100], [4550, 270, 120], [4200, 190, 110], [3700, 150, 120], [3000, 110, 150], [2300, 80, 170], [1450, 90, 120], [1575, 115, 85], [860, 150, 95], [990, 115, 120], [380, 140, 130]], 560, 3, 30);
  LAY.mtn.ink.wet.drawImage(mountainLayer({ W: WW, H: WH, ridge: far, depth: 230, tone: .15, rim: .55, rimW: 24, mist: .9, seed: 3 }), 0, 0);
  // 墨滴长出的中山（右端）
  const mid = ridgeFn([[4760, 470, 150], [5170, 350, 150], [4390, 300, 130], [3720, 390, 110], [3960, 250, 120], [3430, 200, 110], [5520, 290, 140]], 720, 7, 40);
  LAY.mtn.ink.wet.drawImage(mountainLayer({ W: WW, H: WH, ridge: mid, xmask: x => clamp((x - 3180) / 160), depth: 320, tone: .44, rim: .8, rimW: 14, mist: .7, seed: 7 }), 0, 0);
  cun(LAY.mtn.ink, { x0: 3240, x1: 5560, ridge: mid, tone: .34, cun: 1.4, moss: 1.1, seed: 7 });
  const near = ridgeFn([[4560, 170, 210], [5060, 140, 230], [4150, 110, 170], [5500, 120, 160]], 790, 19, 22);
  LAY.mtn.ink.wet.drawImage(mountainLayer({ W: WW, H: WH, ridge: near, xmask: x => clamp((x - 4000) / 200), depth: 150, tone: .5, rim: .85, rimW: 12, mist: .6, seed: 19 }), 0, 0);
  cun(LAY.mtn.ink, { x0: 4050, x1: 5580, ridge: near, tone: .4, cun: 1.2, moss: 1.4, seed: 19, cunLen: .7 });
  // 起点崖 + 松
  cliff(LAY.cliff.ink, 4000, 800, 2.1, 3, -1);
  pine(LAY.cliff.ink, 3850, 804, 1.25, 5, 0, 0, -1);
  // 对岸：低丘 + 岸石 + 两株远树
  const bank = ridgeFn([[300, 95, 120], [620, 60, 110], [-60, 70, 90], [1150, 40, 90]], 720, 11, 14);
  LAY.bank.ink.wet.drawImage(mountainLayer({ W: WW, H: WH, ridge: bank, xmask: x => clamp((1400 - x) / 200), depth: 100, tone: .4, rim: .8, rimW: 10, mist: .3, seed: 11 }), 0, 0);
  cun(LAY.bank.ink, { x0: 0, x1: 1250, ridge: bank, tone: .3, cun: .8, moss: 1, seed: 11, cunLen: .5 });
  cliff(LAY.bank.ink, 780, 812, 1.35, 9, 1);
  for (const c of [LAY.bank.ink.wet, LAY.bank.ink.dry]) {   // 岸石下半消失在江雾里（不留硬边）
    c.globalCompositeOperation = 'destination-in'; const g = c.createLinearGradient(0, 930, 0, 1075);
    g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, WW, WH); c.globalCompositeOperation = 'source-over';
  }
  for (let i = 0; i < 3; i++) {       // 岸上远树：一竖 + 一团点叶
    const x = 380 + i * 170, y = 735 + i * 6;
    draw(LAY.bank.ink, mk([[x, y], [x + 3, y - 50], [x - 2, y - 90]], { w: 3.4, tone: .8, dry: .5, prof: 'tip', seed: 60 + i }));
    const R = mulberry(i + 3); for (let k = 0; k < 16; k++) blot(LAY.bank.ink.wet, x + (R() - .5) * 40, y - 90 + (R() - .5) * 34, 4 + R() * 5, .5, 0, .6, k + i * 20);
  }
}

// 世界 → 屏幕
export const camXf = cam => ({ s: cam.z, tx: 960 - cam.x * cam.z, ty: 540 - cam.y * cam.z });
export function blit(A, lay, cam, am = 1) {
  const { s, tx, ty } = camXf(cam);
  for (const k of ['wet', 'dry']) { const c = A.ink[k]; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = am; c.drawImage(lay[k], tx, ty, WW * s, WH * s); c.restore(); }
}
export const layers = () => LAY;

// 墨晕显现蒙版（低分辨率，世界坐标噪声）：返回 {mask, rim}
const MW = 480, MH = 270;
let mk1 = null;
function revealMasks(cam, center, R) {
  if (!mk1) { mk1 = { m: cv(MW, MH), r: cv(MW, MH) }; }
  const { s, tx, ty } = camXf(cam);
  const cm = mk1.m.getContext('2d'), cr = mk1.r.getContext('2d');
  const im = cm.createImageData(MW, MH), ir = cr.createImageData(MW, MH);
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    const wx = (i * 4 + 2 - tx) / s, wy = (j * 4 + 2 - ty) / s;
    const d = Math.hypot(wx - center[0], wy - center[1]);
    const n = vn2(wx * .0035 + 3, wy * .0035) * .55 + vn2(wx * .014, wy * .014 + 7) * .3 + vn2(wx * .05, wy * .05) * .15;
    const dn = d * (.62 + .8 * n);
    const a = clamp((R - dn) / (R * .06 + 10));
    const rim = Math.exp(-Math.pow((dn - R * .985) / (R * .025 + 6), 2));
    const o = (j * MW + i) * 4 + 3; im.data[o] = a * 255; ir.data[o] = rim * 255;
  }
  cm.putImageData(im, 0, 0); cr.putImageData(ir, 0, 0);
  return mk1;
}
// 把一个缓存层按墨晕蒙版贴进 A（前沿加一圈积墨）
function blitReveal(A, TMP, lay, cam, center, R) {
  if (R <= 0) return;
  if (R > 6000) return blit(A, lay, cam);
  const M = revealMasks(cam, center, R);
  const { s, tx, ty } = camXf(cam);
  for (const k of ['wet', 'dry']) {
    const c = TMP.ink[k]; c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, 1920, 1080);
    c.drawImage(lay[k], tx, ty, WW * s, WH * s);
    c.globalCompositeOperation = 'destination-in'; c.imageSmoothingEnabled = true; c.drawImage(M.m, 0, 0, 1920, 1080);
    c.globalCompositeOperation = 'source-over';
    A.ink[k].save(); A.ink[k].setTransform(1, 0, 0, 1, 0, 0); A.ink[k].drawImage(TMP[k], 0, 0); A.ink[k].restore();
  }
  // 前沿积墨：层的湿墨 × 前沿带
  const c = TMP.ink.wet; c.clearRect(0, 0, 1920, 1080);
  c.drawImage(lay.wet, tx, ty, WW * s, WH * s);
  c.globalCompositeOperation = 'destination-in'; c.drawImage(M.r, 0, 0, 1920, 1080); c.globalCompositeOperation = 'source-over';
  A.cw.save(); A.cw.setTransform(1, 0, 0, 1, 0, 0); A.cw.globalAlpha = .9; A.cw.drawImage(TMP.wet, 0, 0); A.cw.drawImage(TMP.wet, 0, 0); A.cw.restore();
}

export function openCam(t) {
  const u = eio(clamp((t - T.panA) / (T.panB - T.panA)));
  return { x: lerp(4560, 3000, u), y: 540, z: 1 };
}
// 侠客在第 1–2 镜的姿势/位置
function heroOpen(t) {
  if (t < T.crouch) return { P: POSE.stand, x: HERO0[0], y: HERO0[1] };
  if (t < T.leap) return { P: mixPose(POSE.stand, POSE.skid, ss((t - T.crouch) / (T.leap - T.crouch)) * .6), x: HERO0[0], y: HERO0[1] };
  const u = clamp((t - T.leap) / .5);
  return { P: POSE.leap, x: HERO0[0] - 520 * u, y: HERO0[1] - 90 * Math.sin(u * Math.PI * .8) + 60 * u * u };
}
export function leapScreen(t) { const h = heroOpen(Math.min(t, T.x3a)), cam = openCam(t), { s, tx, ty } = camXf(cam); return [h.x * s + tx, (h.y + 20) * s + ty]; }

export function renderOpen(A, t, TMP) {
  const cam = openCam(t), { s, tx, ty } = camXf(cam), L = A.ink;
  // 远山、中山：墨滴晕开
  const R1 = t < T.dropHit ? 0 : 3000 * Math.pow(eo(clamp((t - T.dropHit) / (T.bloomEnd - T.dropHit))), 1.2);
  blitReveal(A, TMP, LAY.mtn, cam, DROP, R1);
  // 崖与松：第二滴墨晕出
  const R2 = t < T.cliffBloom ? 0 : 1100 * eo(clamp((t - T.cliffBloom) / 2.4));
  blitReveal(A, TMP, LAY.cliff, cam, [3720, 790], R2);
  A.xf(s, tx, ty);
  // 墨滴：落下、落纸成一团、慢慢化进山里
  if (t >= T.dropFall && t < T.dropHit) {
    const u = (t - T.dropFall) / (T.dropHit - T.dropFall), y = lerp(-40, DROP[1], u * u);
    A.cw.globalAlpha = .9; A.cw.fillStyle = '#000'; A.cw.beginPath(); A.cw.ellipse(DROP[0], y, 7, 11 + 8 * u, 0, 0, 7); A.cw.fill();
    draw(L, mk([[DROP[0], y - 90 * u], [DROP[0], y - 8]], { w: 3, tone: .35, dry: .6, prof: 'tip', seed: 3 }), 1, .5);
    A.cw.globalAlpha = 1;
  }
  if (t >= T.dropHit) {
    const u = clamp((t - T.dropHit) / .6), f = 1 - clamp((t - 1.8) / 1.6);
    if (f > 0) {
      const R = mulberry(31);
      for (let i = 0; i < 9; i++) { const a = R() * 6.28, d = R() * 40 * eo(u); blot(A.cw, DROP[0] + Math.cos(a) * d, DROP[1] + Math.sin(a) * d * .7, (6 + R() * 26) * (.3 + .7 * eo(u)), .35 * f, R() * 3, .6 + R() * .4, i + 5); }
      blot(A.cd, DROP[0], DROP[1], 5 + 6 * eo(u), .6 * f * (1 - u * .6), .4, .8, 2);
    }
  }
  // 片名：竖排两行 + 印（写在卷上，随卷移动）
  const ta = Math.min(clamp((t - T.titleIn) / .8), 1 - clamp((t - T.titleOut) / .6));
  if (ta > 0) {
    const wx = 3830, c = A.cd;
    for (const [ctx, k] of [[A.cw, (1 - ta) * .6], [c, ta]]) {
      ctx.save(); ctx.globalAlpha = clamp(k * .9); ctx.fillStyle = '#000'; ctx.font = '600 50px CormorantSC'; ctx.letterSpacing = '9px';
      ctx.translate(wx + 70, 150); ctx.rotate(Math.PI / 2); ctx.fillText('THE SWORDSMAN', 0, 0); ctx.restore();
      ctx.save(); ctx.globalAlpha = clamp(k * .9); ctx.fillStyle = '#000'; ctx.font = '600 50px CormorantSC'; ctx.letterSpacing = '9px';
      ctx.translate(wx, 230); ctx.rotate(Math.PI / 2); ctx.fillText('AND THE RIVER', 0, 0); ctx.restore();
    }
    seal(A.cc, wx - 44, 740, 64, ta * .95, 5);
  }
  // 侠客：三笔画出（袍、笠、剑）→ 静立 → 蹲 → 起跳
  if (t >= T.paint[0]) {
    const t12 = Math.floor(t * 12) / 12;
    const pp = t < T.paint[1] ? .45 * eo(clamp((t - T.paint[0]) / .35)) : t < T.paint[2] ? .45 + .35 * eo(clamp((t - T.paint[1]) / .35)) : .8 + .2 * eo(clamp((t - T.paint[2]) / .4));
    const h = heroOpen(t12);
    hero(L, h.P, { x: h.x, y: h.y, s: 1.7, dir: -1, seed: 2, t: t12, p: pp, boil: t12 * 12 });
  }
  return { bleed: 5 * s, rim: 1, paper: [tx * -1 + 0, 0, s] };
}
