// 孔版印刷画风（向 risograph 学：R/G/B = 蓝/黄/粉三块版的密度、lighter = 叠印、source-over = 挖空、每区最多两版、纸白挖空光晕、版错位 kick）——自写简化版
import { pass, canvas } from './glpass.js';
import { clamp } from '/core/lib.js';
const TAU = Math.PI * 2;
export const [rsC, rx] = canvas();
export function clearRiso() { rx.setTransform(1, 0, 0, 1, 0, 0); rx.globalCompositeOperation = 'source-over'; rx.globalAlpha = 1; rx.fillStyle = '#000'; rx.fillRect(0, 0, 1920, 1080); }
// 墨 = [蓝, 黄, 粉] 0..1
export const ink = (b = 0, y = 0, p = 0) => `rgb(${clamp(b) * 255},${clamp(y) * 255},${clamp(p) * 255})`;
export function shape(path, b, y, p, over = false) {
  rx.save(); if (over) rx.globalCompositeOperation = 'lighter';
  rx.beginPath(); path(rx); rx.fillStyle = ink(b, y, p); rx.fill(); rx.restore();
}
export const C_ = (x, y, r) => g => g.arc(x, y, r, 0, TAU);
export const E_ = (x, y, a, b, rot = 0) => g => g.ellipse(x, y, a, b, rot, 0, TAU);
export const RR = (x, y, w, h, r) => g => g.roundRect(x, y, w, h, r);
export function print(g, o = {}) {
  const k = o.kick || 0;
  g.drawImage(pass('riso', rsC, { offB: o.offB || [2 + k * 9, -1], offY: o.offY || [-2, 2 - k * 6], offP: o.offP || [0 - k * 5, 1 + k * 4], seed: o.seed || 3, layer: o.layer ? 1 : 0 }), 0, 0);
}
// 纸白挖空光晕：把一个画在透明图层上的人物，用"零墨"描一圈再盖上去
const [haloC, hx] = canvas();
export function withHalo(draw, r = 6) {
  hx.setTransform(1, 0, 0, 1, 0, 0); hx.clearRect(0, 0, 1920, 1080);
  const save = { ...rx }; draw(hx);
  rx.save(); rx.filter = 'brightness(0)';
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; rx.drawImage(haloC, Math.cos(a) * r, Math.sin(a) * r); }
  rx.filter = 'none'; rx.drawImage(haloC, 0, 0); rx.restore();
}
// ───────── 孔版版 Dot：两三块版叠印（橙 = 黄+粉叠印；头发 = 蓝+粉）(x,y)=脚底 ─────────
export function cadetRiso(g, x, y, s = 1, o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const f = (path, b, yy, p, over) => { g.save(); if (over) g.globalCompositeOperation = 'lighter'; g.beginPath(); path(g); g.fillStyle = ink(b, yy, p); g.fill(); g.restore(); };
  const aw = o.ant || 0;
  // 天线（蓝细线）+ 球（黄+粉 = 橙）
  g.strokeStyle = ink(1, 0, 0); g.lineWidth = 5; g.beginPath(); g.moveTo(0, -240); g.quadraticCurveTo(aw * 10, -262, aw * 26, -284); g.stroke();
  f(C_(aw * 26, -296, 15), 0, 1, .85);
  // 背包：黄 + 粉 = 橙
  f(RR(-66, -142, 132, 98, 18), 0, 1, .8);
  // 身体：纸白 + 蓝 18% 阴影面
  f(RR(-54, -126, 108, 86, 24), 0, 0, 0);
  f(RR(18, -126, 36, 86, 16), .22, 0, 0);
  f(RR(-58, -68, 116, 14, 5), .7, 0, .1);
  // 胸牌：粉 100，05 挖空
  f(RR(-22, -114, 44, 32, 7), 0, .2, 1);
  g.save(); g.font = '28px Lilita'; g.textAlign = 'center'; g.fillStyle = ink(0, 0, 0); g.fillText('05', 0, -89); g.restore();
  // 腿（纸白 + 蓝描边感的阴影）+ 靴（橙）
  for (const sx of [-1, 1]) { f(RR(sx * 24 - 17, -56, 34, 40, 10), .16, 0, 0); f(RR(sx * 24 - 22, -22, 44, 24, 11), 0, 1, .8); }
  // 手臂 + 手套
  const arms = o.arms || [[-72, -54], [72, -54]];
  for (const [ax, ay] of arms) { g.strokeStyle = ink(.34, 0, 0); g.lineWidth = 27; g.lineCap = 'round'; g.beginPath(); g.moveTo(Math.sign(ax) * 50, -110); g.lineTo(ax, ay); g.stroke(); f(C_(ax, ay, 15), 0, 1, .8); }
  // 领圈：蓝 55%
  f(E_(0, -124, 50, 15), .55, 0, 0);
  // 头盔：玻璃蓝 22% + 脸（黄 26 + 粉 10）+ 头发（蓝 + 粉 45）
  f(C_(0, -178, 62), .24, 0, 0);
  f(C_(0, -172, 43), 0, .28, .12);
  f(g2 => { g2.moveTo(-44, -168); g2.quadraticCurveTo(-46, -222, 0, -222); g2.quadraticCurveTo(44, -222, 44, -176); g2.quadraticCurveTo(24, -196, 6, -192); g2.quadraticCurveTo(-18, -200, -30, -186); g2.quadraticCurveTo(-38, -178, -44, -168); }, .95, 0, .45);
  f(E_(-2, -228, 20, 11), .95, 0, .45);
  for (const sx of [-1, 1]) { f(C_(sx * 17, -174, 6.5), 1, 0, 0); f(C_(sx * 26, -158, 8), 0, 0, .45, true); }
  g.strokeStyle = ink(1, 0, 0); g.lineWidth = 4; g.beginPath(); g.arc(0, -160, 9, .3, Math.PI - .3); g.stroke();
  // 高光：挖空成纸白
  g.strokeStyle = ink(0, 0, 0); g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.arc(0, -178, 50, Math.PI * 1.1, Math.PI * 1.4); g.stroke();
  g.restore();
}
export function testCadet(g, t) {
  clearRiso();
  // 背景：黄 30% 天空 + 粉色大星球
  shape(g2 => g2.rect(0, 0, 1920, 1080), 0, .3, 0);
  shape(C_(1450, 420, 300), 0, 0, .75);
  withHalo(h => cadetRiso(h, 760, 980, 2.8), 7);
  print(g);
}

// ───────── G4 CATCH!（本地 lt 0..4，120 BPM；8fps；横移跟拍）─────────
import { seg as _seg, eo as _eo, ss as _ss, lerp as _lerp } from '/core/lib.js';
function sandwich(g, x, y, rot, bite = 0) {
  g.save(); g.translate(x, y); g.rotate(rot);
  const tri = (gg, s) => { gg.moveTo(-90 * s, 50 * s); gg.lineTo(90 * s, 50 * s); gg.lineTo(-60 * s, -80 * s); gg.closePath(); };
  const f = (fn, b, yy, p, over) => { g.save(); if (over) g.globalCompositeOperation = 'lighter'; g.beginPath(); fn(g); g.fillStyle = ink(b, yy, p); g.fill(); g.restore(); };
  f(gg => { gg.save(); gg.translate(0, 16); tri(gg, 1.02); gg.restore(); }, 0, .7, .2);          // 下层面包
  f(gg => { gg.save(); gg.translate(4, 4); tri(gg, 1.06); gg.restore(); }, .7, 1, 0);             // 生菜 = 黄 + 蓝（叠印出绿）
  f(gg => { gg.save(); gg.translate(-2, -4); tri(gg, 1.0); gg.restore(); }, 0, 0, 1);             // 火腿
  f(gg => { gg.save(); gg.translate(0, -18); tri(gg, 1.0); gg.restore(); }, 0, .7, .2);         // 上层面包
  f(gg => { gg.save(); gg.translate(0, -18); tri(gg, .8); gg.restore(); }, 0, .35, .05);
  if (bite) { g.save(); g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(70 - i * 26, 30 - i * 34, 34, 0, TAU); g.fill(); } g.restore(); }
  g.restore();
}
export function sceneCatch(g, lt, o = {}) {
  const T = o.step === false ? lt : Math.floor(lt * 8) / 8;
  clearRiso();
  const camX = _lerp(0, 700, _ss(_seg(lt, .3, 3.0)));   // 镜头横移（24fps 平滑）
  // 舱壁：蓝 18% 底 + 蓝 45% 横条 + 铆钉
  shape(gg => gg.rect(0, 0, 1920, 1080), .18, .06, 0);
  rx.save(); rx.translate(-camX, 0);
  for (let x = -200; x < 3200; x += 480) { shape(gg => gg.rect(x, 0, 14, 1080), .5, 0, 0); for (let y = 60; y < 1080; y += 120) shape(RS_C(x + 7, y, 6), .75, 0, 0); }
  shape(gg => gg.rect(-200, 950, 3400, 140), .38, .2, 0);
  // 舷窗：纸白圈 + 深空（蓝 90）+ 粉色大星球 + 黄星
  for (const px of [700, 2100]) {
    shape(RS_C(px, 380, 250), 0, 0, 0);
    shape(RS_C(px, 380, 215), .92, 0, .15);
    shape(RS_C(px + 70, 430, 120), 0, .1, 1);
    shape(RS_C(px + 40, 400, 120), 0, .5, .2, true);
    for (let i = 0; i < 9; i++) shape(RS_C(px - 150 + (i * 71) % 300, 250 + (i * 53) % 260, 5), 0, 1, 0);
  }
  rx.restore();
  // Dot 在画面里只慢慢前移（镜头在跟），三明治在她前方翻滚；2.5 被抓住，3.0 咬一口
  const caught = T >= 2.5, K2 = 2.05;
  const dx = _lerp(560, 760, _ss(T / 2.5)), dy = 860 + Math.sin(T * 3) * 22;
  const rot = caught ? -.1 : -.32;
  const handL = caught ? [150, -250] : [120 + Math.sin(T * 6) * 20, -205];
  const hw = [dx + (handL[0] * Math.cos(rot) - handL[1] * Math.sin(rot)) * K2, dy + (handL[0] * Math.sin(rot) + handL[1] * Math.cos(rot)) * K2];
  const sx = caught ? hw[0] + 70 : _lerp(1180, 1330, T / 2.5), sy = caught ? hw[1] - 30 : 400 + Math.sin(T * 2.2) * 40;
  const srot = caught ? .25 : T * 1.3;
  withHalo(h => {
    h.save(); h.translate(dx, dy); h.rotate(rot); h.translate(-dx, -dy);
    cadetRiso(h, dx, dy, K2, { arms: [[-80, -70], handL], ant: Math.sin(T * 5) * .7 });
    h.restore();
    h.save(); h.translate(sx, sy); h.scale(1.6, 1.6); h.translate(-sx, -sy); sandwich(h, sx, sy, srot, T >= 3.0 ? 1 : 0); h.restore();
  }, 7);
  // 面包屑
  if (T >= 3.0) for (let i = 0; i < 10; i++) { const a = i * 2.1, d = 60 + (T - 3) * 260 * (0.5 + (i % 3) * .25); shape(RS_C(sx + 60 + Math.cos(a) * d, sy - 20 + Math.sin(a) * d, 8 + i % 3 * 3), 0, .7, .2); }
  // 拟声字（粉版）
  if (T >= 3.0) { rx.save(); rx.translate(1450, 200); rx.rotate(-.12); rx.font = '900 150px Inter'; rx.textAlign = 'center'; rx.fillStyle = ink(0, 0, 1); rx.fillText('CHOMP!', 0, 0); rx.restore(); }
  const kick = caught ? Math.max(0, 1 - (lt - 2.5) / .3) * Math.cos((lt - 2.5) * 30) : 0;
  print(g, { kick, seed: 5 });
}
const RS_C = (x, y, r) => gg => gg.arc(x, y, r, 0, TAU);
