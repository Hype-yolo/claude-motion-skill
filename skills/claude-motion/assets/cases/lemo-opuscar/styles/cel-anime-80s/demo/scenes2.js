// 骑行蒙太奇：背影纵深、胸像光带、车轮大特写、高架大全景
import { canvas, W, H, TAU, LWK, rgba, mix, vgrad, airbrush, hash, rng, poly, path, cel, line, ribbon, flutter } from './cel.js';
import { PAL } from './pal.js';
import { wheel } from './rider.js';
import { head80 } from './head80.js';
import { rain, splashes, speedLines, flare, lamp, trail } from './fx.js';
import { celLayer } from './shots.js';
import { T, q12, q8, BEAT } from './story.js';
import { NEON } from './bg.js';

const f12 = t => Math.floor(t * 12 + 1e-6);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));

// —— 背影（摩托 + 骑手，从后方看）——
export function riderRear(g, P, o = {}) {
  const ph = o.ph || 0, rim = o.rim;
  // 后轮
  cel(g, [[-34, -8], [-38, -120], [-30, -230], [30, -230], [38, -120], [34, -8], [0, 4]], { f: P.tire.f, s: P.tire.s, so: [8, 0], h: P.tire.h, ho: [-4, 0], l: P.tire.l, lw: 2.5 });
  // 排气管口（右侧）
  const mc = new Path2D(); mc.ellipse(78, -178, 24, 20, 0, 0, TAU); cel(g, mc, { f: P.chrome.f, s: P.chrome.s, so: [-4, -4], l: P.chrome.l, lw: 2 });
  g.fillStyle = '#0a0a10'; g.beginPath(); g.ellipse(78, -178, 13, 11, 0, 0, TAU); g.fill();
  // 腿（两侧，膝盖外张）+ 靴子踩在脚踏上
  for (const sx of [-1, 1]) {
    cel(g, [[sx * 50, -380], [sx * 140, -380], [sx * 150, -330], [sx * 120, -250], [sx * 86, -250], [sx * 70, -330]], { f: P.pants.f, s: P.pants.s, so: [-sx * 10, -8], l: P.pants.l, lw: 2.2, rim });
    cel(g, [[sx * 82, -262], [sx * 128, -262], [sx * 134, -214], [sx * 80, -214]], { f: P.boot.f, s: P.boot.s, so: [-sx * 6, -6], l: P.boot.l, lw: 2 });
  }
  // 尾段 + 尾灯 + 牌照
  cel(g, [[-86, -296], [86, -296], [60, -372], [-60, -372]], { f: P.white.f, s: P.white.s, so: [0, -14], h: P.white.h, ho: [0, 5], l: P.white.l, lw: 2.4, rim });
  cel(g, poly([[-56, -340], [56, -340], [50, -322], [-50, -322]]), { f: '#ff3848', l: '#5a0a14', lw: 1.8 });
  cel(g, poly([[-34, -296], [34, -296], [34, -262], [-34, -262]]), { f: '#e8e4d0', l: '#3a3a44', lw: 1.6 });
  g.fillStyle = '#2a2a44'; g.font = '700 20px "Barlow SC"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NB·87', 0, -279);
  // 围巾尾巴：朝镜头飘（左右各一条）
  for (const sx of [-1, 1]) {
    const sp = flutter(sx * 20, -520, Math.PI / 2 - sx * .9, 230, 12, 18, 1.2, ph * TAU + (sx > 0 ? 1.5 : 0), sx * 30);
    cel(g, ribbon(sp, u => 40 - u * 16), { f: sx > 0 ? P.scarf.s : P.scarf.f, s: P.scarf.s, so: [0, -8], l: P.scarf.l, lw: 2, rim });
  }
  // 背（夹克，前倾所以显得短）+ 手臂伸向两侧车把
  cel(g, [[-80, -372], [80, -372], [112, -470], [100, -540], [0, -556], [-100, -540], [-112, -470]], { f: P.jacket.f, s: P.jacket.s, so: [0, -20], h: P.jacket.h, ho: [0, 8], l: P.jacket.l, lw: 2.4, rim,
    clipFn: gg => { gg.fillStyle = P.stripe.f; gg.fillRect(-8, -560, 16, 190); } });
  for (const sx of [-1, 1]) {
    cel(g, [[sx * 90, -530], [sx * 196, -470], [sx * 204, -440], [sx * 110, -470]], { f: P.jacket.f, s: P.jacket.s, so: [0, -8], l: P.jacket.l, lw: 2.2, rim });
    cel(g, [[sx * 190, -480], [sx * 222, -474], [sx * 226, -440], [sx * 196, -432]], { f: P.glove.f, l: P.glove.l, lw: 2 });
  }
  // 头（后脑勺）+ 马尾（朝上后方飘）+ 耳机带、护目镜带
  // 马尾：被风吹向镜头，看起来是从后脑垂下、左右甩动的一大束
  for (let k = 0; k < 3; k++) {
    const sp = flutter(-10 + k * 12, -640, Math.PI / 2 - .35 + k * .25 + Math.sin(ph * TAU) * .15, 200 - k * 30, 12, 26, 1.1, ph * TAU + k, 20);
    cel(g, ribbon(sp, u => (1 - u) * (70 - k * 14) + 3), { f: k === 1 ? P.hair.s : P.hair.f, s: P.hair.s, so: [8, 0], h: P.hair.h, l: P.hair.l, lw: 2.2, rim });
  }
  const head = new Path2D(); head.ellipse(0, -600, 54, 60, 0, 0, TAU);
  cel(g, head, { f: P.hair.f, s: P.hair.s, so: [0, -16], h: P.hair.h, hi: [[[-30, -640], [20, -652], [36, -636], [-20, -628]]], l: P.hair.l, lw: 2.4, rim });
  // 两侧飘开的发梢（让后脑勺读作头发而不是头盔）
  for (const sx of [-1, 1]) { const sp2 = flutter(sx * 44, -590, sx > 0 ? .5 : Math.PI - .5, 80, 7, 8, 1, ph * TAU + (sx > 0 ? 2 : 0), sx * 10); cel(g, ribbon(sp2, u => (1 - u) * 26 + 2), { f: P.hair.f, s: P.hair.s, so: [0, -6], l: P.hair.l, lw: 2, rim }); }
  line(g, [[-20, -652], [-26, -600]], P.hair.l, 1.6); line(g, [[14, -656], [20, -604]], P.hair.l, 1.6);
  cel(g, [[-58, -612], [0, -600], [58, -612], [58, -596], [0, -584], [-58, -596]], { f: P.strap.f, l: P.strap.l, lw: 1.6 });
  for (const sx of [-1, 1]) { const c = new Path2D(); c.ellipse(sx * 56, -592, 10, 16, 0, 0, TAU); cel(g, c, { f: P.phone.f, l: P.phone.l, lw: 1.6 }); }
  cel(g, [[-26, -560], [26, -560], [20, -536], [-20, -536]], { f: P.scarf.f, l: P.scarf.l, lw: 1.8 });
}

// 6 背后跟拍：霓虹峡谷的纵深
export function rear(S) {
  const { g, e, t, lt } = S, P = PAL.night;
  const VP = [960, 470], f = 700, camH = 1.6, spd = 26;
  vgrad(g, 0, 0, W, H, [[0, '#0a0826'], [.44, '#3a1a5a'], [.5, '#8a3a7a'], [1, '#0c0818']]);
  airbrush(g, VP[0], VP[1], 520, 200, '#ff6ab0', .35); airbrush(e, VP[0], VP[1], 300, 90, '#ff6ab0', .4);
  const proj = (x, y, z) => [VP[0] + x / z * f, VP[1] + (camH - y) / z * f];
  // 两侧墙面
  for (const sx of [-1, 1]) {
    const a = proj(sx * 7, 0, 60), b = proj(sx * 7, 14, 60), c = proj(sx * 7, 14, .6), d = proj(sx * 7, 0, .6);
    const gr = g.createLinearGradient(VP[0], 0, sx > 0 ? W : 0, 0); gr.addColorStop(0, '#3a1f52'); gr.addColorStop(1, '#120a20');
    g.fillStyle = gr; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.fill();
  }
  // 路面
  const r0 = proj(-7, 0, 60), r1 = proj(7, 0, 60), r2 = proj(7, 0, .6), r3 = proj(-7, 0, .6);
  g.fillStyle = '#150d26'; g.beginPath(); g.moveTo(...r0); g.lineTo(...r1); g.lineTo(...r2); g.lineTo(...r3); g.fill();
  const zoff = (t * spd) % 6;
  // 招牌（霓虹方块，沿墙面向镜头涌来）
  const R = rng(55);
  const signs = []; for (let i = 0; i < 40; i++) signs.push({ sx: R() < .5 ? -1 : 1, z: i * 1.6 + R(), y: 2 + R() * 9, h: .8 + R() * 1.6, d: .6 + R() * 1.2, c: NEON[Math.floor(R() * NEON.length)] });
  for (const s of signs.sort((a, b) => b.z - a.z)) {
    let z = s.z - (t * spd) % 64; if (z < .5) z += 64; if (z > 55) continue;
    const x = s.sx * 6.9, p0 = proj(x, s.y, z), p1 = proj(x, s.y + s.h, z), p2 = proj(x, s.y + s.h, z + s.d), p3 = proj(x, s.y, z + s.d);
    const fade = clamp((55 - z) / 20);
    g.fillStyle = rgba(s.c, .85 * fade); g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.lineTo(...p2); g.lineTo(...p3); g.fill();
    e.fillStyle = rgba(s.c, .9 * fade); e.beginPath(); e.moveTo(...p0); e.lineTo(...p1); e.lineTo(...p2); e.lineTo(...p3); e.fill();
    // 墙上的色光
    const m = proj(x, s.y + s.h / 2, z + s.d / 2); airbrush(g, m[0], m[1], 90 * 6 / z, 90 * 6 / z, s.c, .12 * fade);
  }
  // 路面倒影：招牌的光在湿路上拉成竖条
  for (const s of signs) {
    let z = s.z - (t * spd) % 64; if (z < .5) z += 64; if (z > 40) continue;
    const p = proj(s.sx * 5.5, 0, z), L = 260 / z * 6;
    const gr = g.createLinearGradient(0, p[1], 0, p[1] + L); gr.addColorStop(0, rgba(s.c, .35)); gr.addColorStop(1, rgba(s.c, 0));
    g.fillStyle = gr; g.fillRect(p[0] - 30 / z * 6, p[1], 60 / z * 6, L);
    e.fillStyle = gr; e.fillRect(p[0] - 30 / z * 6, p[1], 60 / z * 6, L);
  }
  // 车道线
  for (let k = 0; k < 14; k++) {
    const z = k * 6 - zoff + .8; if (z < .7) continue;
    const a = proj(-.12, 0, z), b = proj(.12, 0, z), c = proj(.12, 0, z + 2.6), d = proj(-.12, 0, z + 2.6);
    g.fillStyle = rgba('#e8e0ff', .6); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.fill();
  }
  speedLines(g, f12(t), { type: 'radial', cx: VP[0], cy: VP[1], n: 60, col: '#c8b8ff', a: .16, r0: 300, seed: 3 });
  // 骑手（12fps 步进的左右摆）
  const fr = f12(t), sway = Math.sin(q12(t) * 2.4) * .035, bob = (hash(fr) - .5) * 5;
  const X = 960 + Math.sin(q12(t) * 1.2) * 30, Y = 1010 + bob;
  // 尾灯光在路面上的红色倒影
  const gr = g.createLinearGradient(0, Y - 20, 0, H); gr.addColorStop(0, rgba('#ff2a40', .45)); gr.addColorStop(1, rgba('#ff2a40', 0));
  g.fillStyle = gr; g.fillRect(X - 50, Y - 20, 100, H - Y + 20); e.fillStyle = gr; e.fillRect(X - 50, Y - 20, 100, H - Y + 20);
  celLayer(S, c => { c.translate(X, Y); c.rotate(sway); c.scale(.9, .9); riderRear(c, P, { ph: (fr % 4) / 4, rim: { c: '#ff6ad0', d: [0, 5] } }); });
  const tl = [X + Math.sin(sway) * 331 * .9, Y - 331 * .9];
  lamp(g, e, tl[0], tl[1], 22, '#ff2a40');
  // 雨：从消失点向外放射
  const Rr = rng(900 + fr % 3); g.strokeStyle = rgba('#d0c8ff', .35); g.lineWidth = 1.5;
  for (let i = 0; i < 160; i++) { const a = Rr() * TAU, r = 100 + Rr() * 1100, L = 20 + r * .12; g.beginPath(); g.moveTo(VP[0] + Math.cos(a) * r, VP[1] + Math.sin(a) * r); g.lineTo(VP[0] + Math.cos(a) * (r + L), VP[1] + Math.sin(a) * (r + L)); g.stroke(); }
}

// 7 胸像：霓虹光带从脸上一条条扫过
export function bustShot(S, o = {}) {
  const { g, e, t, lt } = S, P = PAL.night;
  vgrad(g, 0, 0, W, H, [[0, '#0e0824'], [1, '#2a1034']]);
  // 背景：横向拉长的霓虹光条（速度感）
  const R = rng(61);
  for (let i = 0; i < 34; i++) {
    const y = R() * H, h = 6 + R() * 40, L = 400 + R() * 900, v = 2400 + R() * 2400, col = NEON[i % NEON.length];
    const x = ((R() * 4000 - lt * v) % 4400 + 4400) % 4400 - 1200;
    for (const [ctx, a] of [[g, .3], [e, .35]]) { const gr = ctx.createLinearGradient(x, 0, x + L, 0); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.5, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); ctx.fillStyle = gr; ctx.fillRect(x, y, L, h); }
  }
  const fr = f12(t), shx = (hash(fr * 2.1) - .5) * 4, shy = (hash(fr * 3.3) - .5) * 4;
  const s = 2.55, narrow = o.narrow ?? .35;
  celLayer(S, c => {
    c.translate(870 + shx, 470 + shy); c.scale(s, s);
    const blink = Math.floor(q8(t) * 8) === Math.floor((S.t - lt + 1.25) * 8);   // 一次快速眨眼（1 张）
    head80(c, P, { view: 'q', expr: blink ? 'closed' : 'determined', ph: (fr % 4) / 4, wind: 1, look: [.35, 0], reflect: '#35e7ff', rim: { c: '#ff6ad0', d: [1.6, 1.2] } });
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop';
    for (let k = 0; k < 3; k++) {   // 光带：从右往左扫过（她向右骑）
      const col = ['#ff3fa4', '#35e7ff', '#ffd23f'][k], x = W + 300 - ((lt * 1500 + k * 700) % 2600);
      const gr = c.createLinearGradient(x - 160, 0, x + 160, 0); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.5, rgba(col, k === 0 ? .2 : .3)); gr.addColorStop(1, rgba(col, 0));
      c.fillStyle = gr; c.beginPath(); c.moveTo(x - 160, 0); c.lineTo(x + 160, 0); c.lineTo(x + 40, H); c.lineTo(x - 280, H); c.fill();
    }
    if (o.flash) { c.fillStyle = rgba('#ff2030', o.flash); c.fillRect(0, 0, W, H); }
    c.globalCompositeOperation = 'source-over';
  });
  rain(g, e, fr, { n: 90, ang: -.9, len: [60, 150], a: .3, w: 1.8, seed: 12 });
}

// 8 车轮大特写：积水飞溅
export function wheelShot(S) {
  const { g, e, t, lt } = S, P = PAL.night;
  vgrad(g, 0, 0, W, H, [[0, '#120a28'], [.7, '#2a1440'], [1, '#0a0614']]);
  speedLines(g, f12(t), { type: 'h', n: 60, col: '#ff6ab0', a: .5, hmax: 10, seed: 21 });
  speedLines(g, f12(t) + 7, { type: 'h', n: 40, col: '#35e7ff', a: .35, hmax: 6, seed: 22 });
  speedLines(e, f12(t), { type: 'h', n: 30, col: '#ff6ab0', a: .3, hmax: 8, seed: 21 });
  // 路面
  vgrad(g, 0, 930, W, 150, [[0, '#1c1230'], [1, '#08050e']]);
  speedLines(g, f12(t) + 3, { type: 'h', n: 50, col: '#b8a8ff', a: .45, hmax: 3, seed: 23 });
  const cx = 860, cy = 540, s = 390 / 118, fr = f12(t);
  // 水花：扇形喷溅（在车轮后方）
  const Rs = rng(700 + fr % 3);
  for (let i = 0; i < 140; i++) {
    const a = Math.PI + .15 + Rs() * .9, r = 120 + Rs() * 700, x = cx - 120 + Math.cos(a) * r, y = 925 + Math.sin(a) * r * .55, sz = 3 + Rs() * 10;
    g.fillStyle = rgba('#dfe8ff', .5 + Rs() * .4); g.beginPath(); g.ellipse(x, y, sz * 1.8, sz * .7, a, 0, TAU); g.fill();
  }
  g.fillStyle = rgba('#cfe0ff', .35); g.beginPath(); g.moveTo(cx - 60, 930); g.quadraticCurveTo(cx - 400, 700, cx - 900, 760); g.quadraticCurveTo(cx - 420, 820, cx - 60, 945); g.fill();
  celLayer(S, c => {
    c.translate(cx, cy); c.scale(s, s); c.translate(-322, 118);
    LWK.k = .5;
    // 挡泥板 + 前叉（出画）
    cel(c, [[228, -210], [290, -250], [380, -238], [418, -190], [396, -198], [360, -222], [292, -226], [246, -200]], { f: P.white.f, s: P.white.s, so: [-4, -6], l: P.white.l, lw: 2 });
    wheel(c, [322, -118], P, { wheelA: q12(t) * 40, speed: 1 }, true);
    cel(c, poly([[287, -560], [313, -560], [335, -118], [309, -118]]), { f: P.gold.f, s: P.gold.s, so: [-7, 0], h: P.gold.h, ho: [3, 0], l: P.gold.l, lw: 2 });
    cel(c, [[228, -210], [290, -250], [380, -238], [418, -190], [396, -198], [360, -222], [292, -226], [246, -200]], { f: P.white.f, s: P.white.s, so: [-4, -6], l: P.white.l, lw: 2 });
    LWK.k = 1;
  });
  // 前方水面被切开的白色水线
  g.strokeStyle = rgba('#ffffff', .7); g.lineWidth = 4; g.beginPath(); g.moveTo(cx + 40, 928); g.quadraticCurveTo(cx + 200, 915, cx + 420, 930); g.stroke();
  splashes(g, fr % 3, 950, 1075, 24, '#cfc0ff', 4);
  rain(g, e, fr, { n: 80, ang: -.8, len: [80, 180], a: .3, w: 2, seed: 13 });
}

// 9 高架大全景：远方海湾对岸的火箭第一次出现
export function highwayPlate() {
  const [c, g] = canvas(2200, 1200), [ec, e] = canvas(2200, 1200), R = rng(71);
  e.fillStyle = '#000'; e.fillRect(0, 0, 2200, 1200);
  vgrad(g, 0, 0, 2200, 420, [[0, '#070520'], [.7, '#24124a'], [1, '#5a2a6a']]);
  // 海湾
  vgrad(g, 0, 400, 2200, 800, [[0, '#2a1640'], [1, '#0a0618']]);
  // 对岸：低矮城市灯带 + 发射场
  for (let x = 0; x < 2200; x += 6) { const h = 8 + R() * 30; g.fillStyle = '#140c28'; g.fillRect(x, 400 - h, 6, h); if (R() < .35) { const cc = R() < .6 ? '#ffd28a' : '#ff8ad0'; g.fillStyle = cc; g.fillRect(x + 1, 398 - R() * h, 2, 2); e.fillStyle = rgba(cc, .6); e.fillRect(x, 396 - R() * h, 4, 4); } }
  // 火箭与发射塔（远、小）
  const rx = 1640, ry = 400;
  g.fillStyle = '#1a1030'; g.fillRect(rx - 40, ry - 170, 18, 170); for (let y = ry - 170; y < ry; y += 14) { g.strokeStyle = '#2a1a48'; g.lineWidth = 2; g.beginPath(); g.moveTo(rx - 40, y); g.lineTo(rx - 22, y + 14); g.stroke(); }
  g.fillStyle = '#f0ecff'; g.fillRect(rx - 10, ry - 150, 20, 150); g.beginPath(); g.moveTo(rx - 10, ry - 150); g.lineTo(rx, ry - 190); g.lineTo(rx + 10, ry - 150); g.fill();
  g.fillStyle = '#ff7a3c'; g.fillRect(rx - 10, ry - 110, 20, 8); g.fillStyle = '#1fc4b2'; g.fillRect(rx - 10, ry - 60, 20, 6);
  e.fillStyle = rgba('#ffffff', .45); e.fillRect(rx - 10, ry - 150, 20, 150);
  // 探照灯光柱
  for (const [bx, a] of [[rx - 160, -.35], [rx + 180, .3], [rx - 60, -.1]]) {
    e.save(); e.translate(bx, ry); e.rotate(a); const gr = e.createLinearGradient(0, 0, 0, -800); gr.addColorStop(0, rgba('#bfe8ff', .5)); gr.addColorStop(1, rgba('#bfe8ff', 0));
    e.fillStyle = gr; e.beginPath(); e.moveTo(-8, 0); e.lineTo(-90, -800); e.lineTo(90, -800); e.lineTo(8, 0); e.fill(); e.restore();
    g.save(); g.translate(bx, ry); g.rotate(a); const g2 = g.createLinearGradient(0, 0, 0, -800); g2.addColorStop(0, rgba('#bfe8ff', .25)); g2.addColorStop(1, rgba('#bfe8ff', 0));
    g.fillStyle = g2; g.beginPath(); g.moveTo(-8, 0); g.lineTo(-90, -800); g.lineTo(90, -800); g.lineTo(8, 0); g.fill(); g.restore();
  }
  // 水面倒影（对岸灯光的竖条）
  g.save(); g.globalAlpha = .5; g.filter = 'blur(3px)'; g.translate(0, 800); g.scale(1, -1); g.drawImage(c, 0, 250, 2200, 150, 0, 250, 2200, 150); g.restore();
  e.save(); e.globalAlpha = .5; e.filter = 'blur(3px)'; e.translate(0, 800); e.scale(1, -1); e.drawImage(ec, 0, 250, 2200, 150, 0, 250, 2200, 150); e.restore();
  // 近岸城市：楼顶（左下大片）
  for (let i = 0; i < 520; i++) {
    const x = R() * 2200, y = 520 + R() * 700; if (y < 560 + (x - 700) * .5 && x > 700) continue;
    const w = 20 + R() * 70, h = 20 + R() * 50;
    g.fillStyle = ['#1a1234', '#22183e', '#2c1e4a'][Math.floor(R() * 3)]; g.fillRect(x, y, w, h);
    g.fillStyle = rgba('#8a6ad0', .3); g.fillRect(x, y, w, 3);
    for (let k = 0; k < 4; k++) if (R() < .5) { const cc = R() < .7 ? '#ffcf80' : '#8fdcff'; g.fillStyle = cc; g.fillRect(x + 4 + R() * (w - 8), y + 6 + R() * (h - 10), 3, 3); e.fillStyle = rgba(cc, .5); e.fillRect(x + 3 + R() * (w - 8), y + 6 + R() * (h - 10), 5, 5); }
  }
  return { c, e: ec, w: 2200, h: 1200 };
}
// 高架曲线
const HW = [[-100, 1250], [520, 760], [1150, 640], [2300, 560]];
function bez(u) { const [a, b, c2, d] = HW, m = 1 - u; return [0, 1].map(i => m * m * m * a[i] + 3 * m * m * u * b[i] + 3 * m * u * u * c2[i] + u * u * u * d[i]); }
export function highway(S) {
  const { g, e, t, lt, u, A } = S;
  const pan = -80 - u * 120, zoom = 1 + u * .04;
  g.save(); e.save(); for (const x of [g, e]) { x.translate(W / 2, H / 2); x.scale(zoom, zoom); x.translate(-W / 2 + pan, -H / 2 - 60); }
  g.drawImage(A.highway.c, 0, 0); e.drawImage(A.highway.e, 0, 0);
  // 高架路面（带状）+ 路灯
  const pts = []; for (let k = 0; k <= 60; k++) pts.push(bez(k / 60));
  g.strokeStyle = '#0c0818'; g.lineWidth = 70; g.lineCap = 'round'; g.beginPath(); pts.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p[0], p[1] + 30)); g.stroke();
  g.strokeStyle = '#2a2040'; g.lineWidth = 56; g.beginPath(); pts.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p[0], p[1])); g.stroke();
  g.strokeStyle = '#4a3a70'; g.lineWidth = 3; g.beginPath(); pts.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p[0], p[1] - 26)); g.stroke();
  for (let k = 0; k <= 40; k++) { const p = bez(k / 40), s2 = 1.4 - k / 40; lamp(g, e, p[0], p[1] - 34 * s2, 5 * s2 + 2, '#ffb060', .8); }
  // 其他车辆的灯
  for (let k = 0; k < 6; k++) { const uu = ((k * .17 + lt * .05) % 1); const p = bez(uu); lamp(null, e, p[0], p[1] + 8, 4, k % 2 ? '#ff3040' : '#fff0c0', .6); }
  // 她：一粒车灯 + 红色光轨
  const ub = .18 + u * .33, tr = []; for (let k = 0; k < 20; k++) { const p = bez(Math.max(0, ub - k * .008)); tr.push([p[0], p[1] - 4]); }
  trail(g, e, tr, '#ff2a40', 5);
  const pb = bez(ub); lamp(g, e, pb[0] + 6, pb[1] - 6, 9, '#fff4d0'); flare(e, pb[0] + 6, pb[1] - 6, .18, '#fff0c0', { ghosts: false, streak: 400 });
  g.restore(); e.restore();
  rain(g, e, f12(t), { n: 120, ang: .12, len: [30, 60], a: .18, w: 1, seed: 17 });
}
