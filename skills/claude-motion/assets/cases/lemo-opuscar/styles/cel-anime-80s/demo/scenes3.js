// 阻碍与爆发：吊桥、拧油门 + 转速表、正面冲刺、飞越止め絵、落地
import { canvas, W, H, TAU, LWK, rgba, mix, vgrad, airbrush, hash, rng, poly, path, cel, line, ribbon, flutter } from './cel.js';
import { PAL } from './pal.js';
import { riderSide, LAMPS } from './rider.js';
import { head80 } from './head80.js';
import { rain, splashes, speedLines, flare, lamp, trail } from './fx.js';
import { celLayer } from './shots.js';
import { T, q12, q8, BEAT, BAR, bar } from './story.js';

const f12 = t => Math.floor(t * 12 + 1e-6);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = x => { x = clamp(x); return x * x * (3 - 2 * x); };

// 黎明前的天空（通用）
function predawn(g, y0 = 0, h = 760, k = 0) {
  vgrad(g, 0, y0, W, h, [[0, mix('#0c0c3a', '#2a2a78', k)], [.5, mix('#2a1a5e', '#6a3a8a', k)], [.82, mix('#7a3a7a', '#e07a8a', k)], [1, mix('#ff9a6a', '#ffd08a', k)]]);
}
function farShore(g, e, y, rocketX, s = 1, lights = true) {
  const R = rng(44);
  g.fillStyle = '#1a1030';
  for (let x = 0; x < W; x += 5) { const h = (6 + R() * 22) * s; g.fillRect(x, y - h, 5, h); if (lights && R() < .3) { g.fillStyle = '#ffd28a'; g.fillRect(x + 1, y - R() * h, 2, 2); e.fillStyle = rgba('#ffd28a', .5); e.fillRect(x, y - 2 - R() * h, 3, 3); g.fillStyle = '#1a1030'; } }
  if (rocketX != null) {
    g.fillStyle = '#140c28'; g.fillRect(rocketX - 34 * s, y - 150 * s, 14 * s, 150 * s);
    g.fillStyle = '#e8e4ff'; g.fillRect(rocketX - 8 * s, y - 130 * s, 16 * s, 130 * s); g.beginPath(); g.moveTo(rocketX - 8 * s, y - 130 * s); g.lineTo(rocketX, y - 164 * s); g.lineTo(rocketX + 8 * s, y - 130 * s); g.fill();
    e.fillStyle = rgba('#ffffff', .35); e.fillRect(rocketX - 8 * s, y - 130 * s, 16 * s, 130 * s);
  }
}

// —— 10 吊桥升起（第一人称：一堵路面慢慢立起来）——
export function bridge(S) {
  const { g, e, t, lt, u } = S;
  const HZ = 600, f = 1000, camY = 2.0;
  const zc = ss(lt / 2.07) * 1.6;            // 镜头推近
  const th = ss(seg(lt, .15, 2.0)) * .4;     // 桥面升起角度
  predawn(g, 0, HZ + 10, .12);
  airbrush(g, 1000, HZ, 800, 140, '#ff9a6a', .4);
  const proj = (x, y, z) => { z = Math.max(.35, z - zc); return [960 + x / z * f, HZ + (camY - y) / z * f]; };
  farShore(g, e, HZ, 1000, 1.1);
  vgrad(g, 0, HZ, W, H - HZ, [[0, '#3a2250'], [1, '#0c0818']]);
  const quad = (pts, col, ctx = g) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.closePath(); ctx.fill(); };
  const L = 15, nz = 9, fz = nz + 2 * L + 1.5;
  // 远侧桥面（近端抬起，路面朝镜头）
  const fT = [fz - L * Math.cos(th), L * Math.sin(th)];
  quad([proj(-5.5, fT[1], fT[0]), proj(5.5, fT[1], fT[0]), proj(5.5, 0, fz), proj(-5.5, 0, fz)], '#3e3058');
  const fe = [proj(-5.5, fT[1], fT[0]), proj(5.5, fT[1], fT[0])];
  for (let k = 0; k < 16; k++) { g.fillStyle = k % 2 ? '#ffcc30' : '#1a1020'; g.fillRect(fe[0][0] + (fe[1][0] - fe[0][0]) * k / 16, fe[0][1] - 4, (fe[1][0] - fe[0][0]) / 16 + 1, 8); }
  // 引桥路面 + 湿路倒影
  quad([proj(-5.5, 0, .9), proj(5.5, 0, .9), proj(5.5, 0, nz), proj(-5.5, 0, nz)], '#221834');
  for (let k = 0; k < 6; k++) { const z = 1.6 + k * 1.3; if (z - zc < .5) continue; quad([proj(-.08, 0, z), proj(.08, 0, z), proj(.08, 0, z + .6), proj(-.08, 0, z + .6)], rgba('#fff0d0', .6)); }
  // 桥塔 + 控制室 + 警示灯（交替闪）
  const blink = Math.floor(t * 4) % 2;
  for (const [x, z] of [[-7, nz], [7, nz], [-7, fz], [7, fz]]) {
    const b = proj(x, 0, z), tp = proj(x, 9, z), w = 2.6 / (z - zc) * f;
    g.fillStyle = '#1a1230'; g.fillRect(b[0] - w / 2, tp[1], w, b[1] - tp[1]);
    g.fillStyle = '#2e2250'; g.fillRect(x < 0 ? b[0] + w * .2 : b[0] - w / 2, tp[1], w * .3, b[1] - tp[1]);
    const win = proj(x, 7, z); g.fillStyle = '#ffd890'; g.fillRect(win[0] - w * .3, win[1], w * .6, w * .35); e.fillStyle = rgba('#ffd890', .5); e.fillRect(win[0] - w * .3, win[1], w * .6, w * .35);
    const on = (x < 0) === !!blink, lp = proj(x, 9.5, z);
    lamp(g, e, lp[0], lp[1], w * .14 + 5, on ? '#ff2020' : '#401010', on ? 1 : .15);
    if (on) { flare(e, lp[0], lp[1], .1 + w / 1600, '#ff4040', { ghosts: false, streak: 360 });
      const rb = proj(x * .8, 0, z - .3); const gr = g.createLinearGradient(0, rb[1], 0, H); gr.addColorStop(0, rgba('#ff3030', .45)); gr.addColorStop(1, rgba('#ff3030', 0)); g.fillStyle = gr; g.fillRect(rb[0] - w * .15, rb[1], w * .3, H - rb[1]); e.fillStyle = gr; e.fillRect(rb[0] - w * .15, rb[1], w * .3, H - rb[1]); }
  }
  // 近侧桥面（远端抬起）：立起来的路面
  const nT = [nz + L * Math.cos(th), L * Math.sin(th)];
  const n0 = proj(-5.5, 0, nz), n1 = proj(5.5, 0, nz), n2 = proj(5.5, nT[1], nT[0]), n3 = proj(-5.5, nT[1], nT[0]);
  const gr = g.createLinearGradient(0, n0[1], 0, n3[1]); gr.addColorStop(0, '#2c2046'); gr.addColorStop(1, '#4a3a66');
  quad([n0, n1, n2, n3], gr);
  for (let k = 0; k < 6; k++) { const a = k / 6 + .04, zz = nz + L * Math.cos(th) * a, yy = L * Math.sin(th) * a, da = .45; quad([proj(-.08, yy, zz), proj(.08, yy, zz), proj(.08, yy + da * Math.sin(th), zz + da * Math.cos(th)), proj(-.08, yy + da * Math.sin(th), zz + da * Math.cos(th))], rgba('#fff0d0', .65)); }
  for (let k = 0; k < 14; k++) { g.fillStyle = k % 2 ? '#ffcc30' : '#1a1020'; g.fillRect(n3[0] + (n2[0] - n3[0]) * k / 14, n3[1] - 8, (n2[0] - n3[0]) / 14 + 1, 14); }
  line(g, [n3, n2], rgba('#ffb08a', .9), 3);
  // 右车道的栏杆放下
  const arm = ss(seg(lt, 0, .7)) * Math.PI / 2, armLen = 5, a0 = proj(5.8, 1.2, 5), a1 = proj(5.8 - armLen * Math.sin(arm), 1.2 + armLen * Math.cos(arm), 5);
  g.fillStyle = '#1c1430'; g.fillRect(a0[0] - 16, a0[1], 32, proj(5.8, 0, 5)[1] - a0[1]);
  for (let k = 0; k < 10; k++) { const p = k / 10, q = (k + 1) / 10; g.strokeStyle = k % 2 ? '#ff2a2a' : '#f4f0f0'; g.lineWidth = 18; g.beginPath(); g.moveTo(a0[0] + (a1[0] - a0[0]) * p, a0[1] + (a1[1] - a0[1]) * p); g.lineTo(a0[0] + (a1[0] - a0[0]) * q, a0[1] + (a1[1] - a0[1]) * q); g.stroke(); }
  lamp(g, e, a1[0], a1[1], 10, blink ? '#ff3030' : '#601010', blink ? 1 : .2);
  if (blink) { g.fillStyle = rgba('#ff2030', .07); g.fillRect(0, 0, W, H); }
  const fr = f12(t);
  rain(g, e, fr, { n: 150, ang: .05, len: [40, 100], a: .24, w: 1.3, seed: 31 });
  speedLines(g, fr, { type: 'radial', cx: 960, cy: HZ, n: 40, col: '#d0c0ff', a: .12, r0: 420, seed: 32 });
}

// —— 11a 拧油门（手套 + 车把）——
export function throttle(S) {
  const { g, e, t, lt } = S, P = PAL.night;
  const split = bar(14) + BEAT * 2;   // 后半切到转速表
  if (t >= split) return tacho(S, t - split);
  vgrad(g, 0, 0, W, H, [[0, '#1a0c30'], [1, '#3a1440']]);
  speedLines(g, f12(t), { type: 'h', n: 70, col: '#ff6ab0', a: .5, hmax: 12, seed: 41 });
  speedLines(e, f12(t), { type: 'h', n: 30, col: '#ff6ab0', a: .3, hmax: 8, seed: 41 });
  // 8fps 三张：0 = 握住，1 = 转一半，2 = 拧到底
  const k = Math.min(2, Math.max(0, Math.floor((q8(t) - T.throttle) * 8)));
  const rot = [0, .22, .42][k];
  const fr = f12(t), jx = (hash(fr) - .5) * (4 + k * 4), jy = (hash(fr + 3) - .5) * (4 + k * 4);
  celLayer(S, c => {
    c.translate(960 + jx, 560 + jy); LWK.k = .8;
    // 车把握把（横穿画面）
    cel(c, poly([[-1100, -70], [260, -70], [260, 70], [-1100, 70]]), { f: P.dark.f, s: P.dark.s, so: [0, -30], h: P.dark.h, ho: [0, 10], l: P.dark.l, lw: 3 });
    for (let x = -560; x < 260; x += 34) line(c, [[x, -66], [x, 66]], P.dark.s, 3);
    cel(c, poly([[260, -96], [460, -96], [460, 96], [260, 96]]), { f: P.teal.f, s: P.teal.s, so: [0, -30], h: P.teal.h, ho: [0, 10], l: P.teal.l, lw: 3 });
    // 刹车拉杆
    cel(c, poly([[430, -50], [456, -26], [-250, 118], [-262, 94]]), { f: P.chrome.f, s: P.chrome.s, so: [0, -6], h: P.chrome.h, ho: [0, 3], l: P.chrome.l, lw: 3 });
    { const b = new Path2D(); b.arc(-262, 108, 18, 0, TAU); cel(c, b, { f: P.chrome.f, s: P.chrome.s, so: [-4, -4], l: P.chrome.l, lw: 3 }); }
    // 手套：绕着握把旋转（手腕下压）
    c.save(); c.rotate(rot * .35); c.translate(0, rot * 60);
    cel(c, [[-420, 60], [-400, -120], [-300, -190], [-120, -200], [60, -170], [150, -100], [160, 40], [60, 150], [-200, 170], [-380, 140]], { f: P.glove.f, s: P.glove.s, so: [0, -40], h: P.glove.h, ho: [0, 12], l: P.glove.l, lw: 3 });
    for (let i = 0; i < 4; i++) { const x = -260 + i * 90; cel(c, [[x, -150], [x + 80, -150], [x + 90, 60 + i * 6], [x + 10, 80 + i * 6]], { f: P.glove.f, s: P.glove.s, so: [-10, -10], h: P.glove.h, ho: [4, 4], l: P.glove.l, lw: 3 }); }
    cel(c, poly([[-700, -150], [-420, -170], [-400, 160], [-700, 200]]), { f: P.cuff.f, s: P.cuff.s, so: [0, -30], l: P.cuff.l, lw: 3 });
    cel(c, poly([[-1200, -200], [-700, -170], [-700, 220], [-1200, 260]]), { f: P.jacket.f, s: P.jacket.s, so: [0, -50], h: P.jacket.h, ho: [0, 12], l: P.jacket.l, lw: 3, rim: { c: '#ff6ad0', d: [0, 8] } });
    c.restore(); LWK.k = 1;
  });
  rain(g, e, fr, { n: 60, ang: -1, len: [120, 240], a: .3, w: 2, seed: 42 });
}
// —— 11b 转速表（透过光刻度 + 指针甩进红区）——
function tacho(S, lt) {
  const { g, e, t } = S;
  vgrad(g, 0, 0, W, H, [[0, '#0c0818'], [1, '#1a1026']]);
  const cx = 960, cy = 560, R = 430, fr = f12(t);
  const jx = (hash(fr) - .5) * 8, jy = (hash(fr + 1) - .5) * 8;
  g.save(); e.save(); g.translate(jx, jy); e.translate(jx, jy);
  g.fillStyle = '#26222e'; g.beginPath(); g.arc(cx, cy, R + 40, 0, TAU); g.fill();
  g.fillStyle = '#4a4458'; g.beginPath(); g.arc(cx, cy, R + 40, Math.PI * 1.1, Math.PI * 1.6); g.arc(cx, cy, R + 20, Math.PI * 1.6, Math.PI * 1.1, true); g.fill();
  g.fillStyle = '#07060c'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  const A0 = Math.PI * .75, A1 = Math.PI * 2.25, ang = v => A0 + (A1 - A0) * v / 12;
  // 红区
  for (const [ctx, a] of [[g, .9], [e, .8]]) { ctx.strokeStyle = rgba('#ff2a2a', a); ctx.lineWidth = 26; ctx.beginPath(); ctx.arc(cx, cy, R - 40, ang(10), ang(12)); ctx.stroke(); }
  // 刻度 + 数字（透过光）
  for (let v = 0; v <= 12; v += .5) {
    const a = ang(v), major = v % 1 === 0, r0 = R - (major ? 70 : 50), r1 = R - 20;
    const col = v >= 10 ? '#ff5050' : '#ffe8c8';
    for (const [ctx, w] of [[g, major ? 7 : 4], [e, major ? 9 : 5]]) { ctx.strokeStyle = ctx === e ? rgba(col, .8) : col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke(); }
    if (major) for (const ctx of [g, e]) { ctx.fillStyle = ctx === e ? rgba(col, .7) : col; ctx.font = 'italic 800 64px Kanit'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(v), cx + Math.cos(a) * (R - 125), cy + Math.sin(a) * (R - 125)); }
  }
  for (const ctx of [g, e]) { ctx.fillStyle = ctx === e ? rgba('#35e7ff', .6) : '#35e7ff'; ctx.font = '600 30px "Barlow SC"'; ctx.textAlign = 'center'; ctx.fillText('×1000 r/min', cx, cy + 150); ctx.font = 'italic 800 40px Kanit'; ctx.fillStyle = ctx === e ? rgba('#ff4fa8', .6) : '#ff4fa8'; ctx.fillText('NIGHTBIRD', cx, cy + 210); }
  // 指针：12fps 步进，甩进红区再回弹抖动
  const v = 4.5 + 6.6 * (1 - Math.exp(-q12(lt) * 5)) + Math.sin(q12(lt) * 40) * .25 * Math.min(1, q12(lt) * 3);
  const a = ang(v);
  for (const [ctx, w, col] of [[e, 22, rgba('#ff8a2a', .8)], [g, 12, '#ff7a1a']]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 60, cy - Math.sin(a) * 60); ctx.lineTo(cx + Math.cos(a) * (R - 40), cy + Math.sin(a) * (R - 40)); ctx.stroke(); }
  g.fillStyle = '#2a2632'; g.beginPath(); g.arc(cx, cy, 44, 0, TAU); g.fill(); g.fillStyle = '#56506a'; g.beginPath(); g.arc(cx - 8, cy - 8, 16, 0, TAU); g.fill();
  // 玻璃反光（硬边）
  g.fillStyle = rgba('#ffffff', .1); g.beginPath(); g.moveTo(cx - R * .8, cy - R * .5); g.quadraticCurveTo(cx, cy - R * 1.1, cx + R * .7, cy - R * .6); g.quadraticCurveTo(cx, cy - R * .8, cx - R * .8, cy - R * .5); g.fill();
  g.restore(); e.restore();
  speedLines(g, fr, { type: 'radial', cx, cy, n: 50, col: '#ff6ab0', a: .25, r0: R + 60, seed: 44 });
}

// —— 正面冲刺用：摩托 + 骑手（正面，护目镜已拉下）——
function riderFront(g, P, o) {
  const ph = o.ph || 0, rim = o.rim;
  const hairSt = { f: P.hair.f, s: P.hair.s, h: P.hair.h, l: P.hair.l, lw: 2.2, rim };
  // 围巾两侧向后下方飘
  for (const sx of [-1, 1]) { const sp = flutter(sx * 40, -596, sx > 0 ? .55 : Math.PI - .55, 280, 12, 18, 1.2, ph * TAU + (sx > 0 ? 1.7 : 0), sx * 30); cel(g, ribbon(sp, u => 46 - u * 20), { f: P.scarf.f, s: P.scarf.s, so: [0, -8], l: P.scarf.l, lw: 2, rim }); }
  // 肩膀 + 手臂伸向车把
  cel(g, [[-150, -560], [0, -598], [150, -560], [250, -440], [210, -420], [120, -500], [-120, -500], [-210, -420], [-250, -440]], { f: P.jacket.f, s: P.jacket.s, so: [0, -16], h: P.jacket.h, ho: [0, 6], l: P.jacket.l, lw: 2.4, rim,
    clipFn: gg => { gg.fillStyle = P.stripe.f; gg.fill(poly([[-150, -560], [-138, -566], [-226, -436], [-240, -440]])); gg.fill(poly([[150, -560], [138, -566], [226, -436], [240, -440]])); } });
  for (const sx of [-1, 1]) cel(g, [[sx * 200, -450], [sx * 262, -452], [sx * 270, -404], [sx * 208, -400]], { f: P.glove.f, l: P.glove.l, lw: 2 });
  cel(g, poly([[-34, -612], [34, -612], [30, -584], [-30, -584]]), { f: P.skin.s, l: P.skin.l, lw: 1.8 });
  cel(g, [[-60, -600], [0, -586], [60, -600], [56, -574], [-56, -574]], { f: P.scarf.f, s: P.scarf.s, so: [0, -6], l: P.scarf.l, lw: 2 });
  // 头：新人设正面（眼睛越过风挡盯着前方）
  g.save(); g.translate(0, -738); g.scale(1.45, 1.45);
  head80(g, P, { view: 'front', expr: 'determined', ph, wind: 1, rim, body: false, neckEnd: 100 });
  g.restore();
  // 风挡 + 整流罩正面 + 大灯
  g.fillStyle = rgba('#3a5a8a', .82); g.beginPath(); g.moveTo(-130, -520); g.lineTo(-90, -640); g.lineTo(90, -640); g.lineTo(130, -520); g.fill();
  g.fillStyle = rgba('#ffffff', .35); g.beginPath(); g.moveTo(-80, -636); g.lineTo(-40, -636); g.lineTo(-90, -524); g.lineTo(-120, -524); g.fill();
  g.fillStyle = rgba('#ff9ad0', .3); g.beginPath(); g.moveTo(30, -636); g.lineTo(46, -636); g.lineTo(20, -524); g.lineTo(4, -524); g.fill();
  line(g, [[-130, -520], [-90, -640], [90, -640], [130, -520]], P.teal.l, 2.5);
  cel(g, [[-170, -520], [170, -520], [190, -420], [150, -330], [60, -290], [-60, -290], [-150, -330], [-190, -420]], { f: P.white.f, s: P.white.s, so: [-14, -14], h: P.white.h, ho: [6, 6], l: P.white.l, lw: 2.6, rim,
    clipFn: gg => { gg.fillStyle = P.teal.f; gg.fillRect(-200, -380, 400, 26); gg.fillStyle = P.magenta.f; gg.fillRect(-200, -392, 400, 7); } });
  const hl = new Path2D(); hl.arc(0, -430, 58, 0, TAU); cel(g, hl, { f: '#fff6d0', l: P.white.l, lw: 3 });
  for (const sx of [-1, 1]) cel(g, poly([[sx * 150, -470], [sx * 190, -470], [sx * 190, -448], [sx * 150, -448]]), { f: '#ffb030', l: P.white.l, lw: 1.5 });
  // 前叉 + 前轮 + 挡泥板
  for (const sx of [-1, 1]) cel(g, poly([[sx * 40 - 10, -300], [sx * 40 + 10, -300], [sx * 44 + 10, -60], [sx * 44 - 10, -60]]), { f: P.gold.f, s: P.gold.s, so: [-4, 0], l: P.gold.l, lw: 2 });
  cel(g, [[-28, -240], [-34, -120], [-26, 0], [26, 0], [34, -120], [28, -240]], { f: P.tire.f, s: P.tire.s, so: [6, 0], h: P.tire.h, ho: [-3, 0], l: P.tire.l, lw: 2.5 });
  cel(g, [[-50, -250], [0, -276], [50, -250], [44, -226], [-44, -226]], { f: P.white.f, s: P.white.s, so: [0, -6], l: P.white.l, lw: 2 });
  return [0, -430];
}

// —— 12 正面冲刺：放射速度线 + 车灯越来越大，最后一拍白闪 ——
export function charge(S) {
  const { g, e, t, lt, u } = S, P = PAL.night;
  if (t >= T.cutout) {   // 音乐抽空的一拍：画面定格 + 白闪（前 2 帧全白，之后留一层白雾和巨大的车灯光晕）
    const t0 = T.cutout - 1 / 24, dt = t - T.cutout;
    const ts = S.t - S.lt, sd = S.lt / Math.max(S.u, 1e-6); charge({ ...S, t: t0, lt: t0 - ts, u: (t0 - ts) / sd });
    const a = dt < 2 / 24 ? 1 : .42 - dt * .2;
    g.fillStyle = rgba('#fff8f0', a); g.fillRect(0, 0, W, H);
    flare(e, 960, 470, .8 + dt * 1.2, '#fff0d0', { streak: 2200 });
    return { bloom: 1.1 };
  }
  const gr = g.createRadialGradient(960, 520, 50, 960, 520, 1200); gr.addColorStop(0, '#ffb070'); gr.addColorStop(.35, '#ff4f8a'); gr.addColorStop(1, '#2a0c40');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  speedLines(g, f12(t), { type: 'radial', cx: 960, cy: 520, n: 120, col: '#ffffff', a: .75, r0: 220, seed: 51 });
  speedLines(g, f12(t) + 1, { type: 'radial', cx: 960, cy: 520, n: 60, col: '#2a0c40', a: .6, r0: 300, seed: 52 });
  const fr = f12(t), s = .95 + ss(u) * .55, jx = (hash(fr) - .5) * 10, jy = (hash(fr + 4) - .5) * 10;
  const X = 960 + jx, Y = 1080 + 260 * s + jy - 200;
  celLayer(S, c => { c.translate(X, Y); c.scale(s, s); riderFront(c, P, { ph: (fr % 4) / 4, rim: { c: '#ffd0a0', d: [0, 5] } }); });
  const hl = [X, Y - 430 * s];
  lamp(g, e, hl[0], hl[1], 40 * s, '#fff4d0'); flare(e, hl[0], hl[1], .5 + u * 1.2, '#fff0c0', { streak: 1400 });
}

// —— 13 飞越：冲击帧 → 止め絵（绘画质感的大画 + 慢速平移，只有头发围巾在动）——
export function jumpPlate() {
  const [c, g] = canvas(2600, 1300), [ec, e] = canvas(2600, 1300), R = rng(81);
  e.fillStyle = '#000'; e.fillRect(0, 0, 2600, 1300);
  vgrad(g, 0, 0, 2600, 820, [[0, '#141446'], [.35, '#3a2a7a'], [.62, '#9a4a8a'], [.85, '#ff8a7a'], [1, '#ffd08a']]);
  // 地平线后的太阳光（还没出来）
  airbrush(g, 2250, 820, 1000, 320, '#ffe0a0', .6); airbrush(e, 2250, 820, 600, 170, '#ffd090', .5);
  // 云：底部被照亮的喷枪云
  g.save(); g.filter = 'blur(10px)';
  for (let i = 0; i < 30; i++) { const x = R() * 2800 - 100, y = 180 + R() * 480, w = 180 + R() * 380, h = 26 + R() * 40;
    g.fillStyle = rgba('#4a2e7a', .7); g.beginPath(); g.ellipse(x, y, w, h, 0, 0, TAU); g.fill();
    g.fillStyle = rgba(y > 450 ? '#ffb08a' : '#d07aaa', .55); g.beginPath(); g.ellipse(x + 30, y + h * .45, w * .85, h * .4, 0, 0, TAU); g.fill(); }
  g.restore();
  // 星（上方还残留）
  for (let i = 0; i < 90; i++) { g.fillStyle = rgba('#ffffff', .3 + R() * .5); g.fillRect(R() * 2600, R() * 260, 2, 2); }
  // 对岸 + 发射塔 + 火箭
  const y0 = 820;
  g.fillStyle = '#26163e'; for (let x = 0; x < 2600; x += 6) { const h = 10 + R() * 34; g.fillRect(x, y0 - h, 6, h); if (R() < .25) { g.fillStyle = '#ffd28a'; g.fillRect(x + 1, y0 - R() * h, 2, 2); g.fillStyle = '#26163e'; } }
  const rx = 1900;
  g.fillStyle = '#1c1034'; g.fillRect(rx - 60, y0 - 260, 26, 260); for (let y = y0 - 260; y < y0; y += 20) { g.strokeStyle = '#2c1c4a'; g.lineWidth = 3; g.beginPath(); g.moveTo(rx - 60, y); g.lineTo(rx - 34, y + 20); g.stroke(); }
  g.fillStyle = '#f4eeff'; g.fillRect(rx - 16, y0 - 230, 32, 230); g.beginPath(); g.moveTo(rx - 16, y0 - 230); g.lineTo(rx, y0 - 290); g.lineTo(rx + 16, y0 - 230); g.fill();
  g.fillStyle = '#ff7a3c'; g.fillRect(rx - 16, y0 - 170, 32, 12); g.fillStyle = '#1fc4b2'; g.fillRect(rx - 16, y0 - 90, 32, 9);
  e.fillStyle = rgba('#ffe8d0', .5); e.fillRect(rx - 16, y0 - 230, 32, 230);
  // 海面：天空倒影 + 横向波光
  vgrad(g, 0, y0, 2600, 480, [[0, '#8a4a7a'], [.3, '#3a2458'], [1, '#100a24']]);
  for (let k = 0; k < 120; k++) { const y = y0 + 4 + k * k * .03, x = R() * 2600, w = 30 + R() * 160; g.fillStyle = rgba(k < 50 ? '#ffc8a0' : '#a078c8', .35 * (1 - k / 120)); g.fillRect(x, y, w, 2); }
  g.fillStyle = rgba('#ffe0a0', .25); g.fillRect(1700, y0, 400, 3);
  return { c, e: ec, w: 2600, h: 1300 };
}
function leaf(g, pivot, len, ang, dir, col) {   // 竖起的桥面（侧面看是一块厚板）
  const [px, py] = pivot, ca = Math.cos(ang), sa = Math.sin(ang), th = 110;
  const tip = [px + dir * len * ca, py - len * sa];
  const nx = dir * sa * th, ny = ca * th;
  g.fillStyle = col; g.beginPath(); g.moveTo(px, py); g.lineTo(tip[0], tip[1]); g.lineTo(tip[0] + nx, tip[1] + ny); g.lineTo(px + nx, py + ny); g.fill();
  // 侧面钢桁架（X 形）
  g.strokeStyle = rgba('#3a2a58', .9); g.lineWidth = 5;
  for (let k = 0; k < 10; k++) { const a = k / 10, b2 = (k + 1) / 10, p0 = [px + dir * len * ca * a, py - len * sa * a], p1 = [px + dir * len * ca * b2, py - len * sa * b2];
    g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0] + nx, p1[1] + ny); g.moveTo(p0[0] + nx, p0[1] + ny); g.lineTo(p1[0], p1[1]); g.stroke(); }
  g.strokeStyle = '#ffb08a'; g.lineWidth = 4; g.beginPath(); g.moveTo(px, py); g.lineTo(tip[0], tip[1]); g.stroke();   // 桥面边缘被晨光勾亮
  // 桥面上的栏杆
  g.strokeStyle = rgba('#140a24', .9); g.lineWidth = 3;
  for (let k = 1; k < 14; k++) { const a = k / 14, x = px + dir * len * ca * a, y = py - len * sa * a; g.beginPath(); g.moveTo(x, y); g.lineTo(x - dir * 0 + sa * dir * -30 * 0, y - 34); g.stroke(); }
  g.beginPath(); g.moveTo(px, py - 34); g.lineTo(tip[0], tip[1] - 34); g.stroke();
  return tip;
}
export function jump(S) {
  const { g, e, t, lt, u, A } = S;
  const fr = f12(t);
  // 冲击帧（2 帧）：反色剪影
  if (lt < 2 / 24) {
    g.fillStyle = '#0a0410'; g.fillRect(0, 0, W, H);
    speedLines(g, 1, { type: 'radial', cx: 960, cy: 500, n: 90, col: '#ff2a3a', a: .9, r0: 100, seed: 61 });
    celLayer(S, c => { c.translate(900, 800); c.rotate(-.18); c.scale(1.1, 1.1); riderSide(c, PAL.day, { ph: 0, wheelA: 0, speed: 1 }); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; }, { occlude: false });
    return { bloom: .4 };
  }
  const k = ss(u), pan = -200 - k * 420;
  g.drawImage(A.jump.c, pan, -120 - k * 40); e.drawImage(A.jump.e, pan, -120 - k * 40);
  // 两扇竖起的桥面（前景，比背景平移更快）
  const fp = pan * 1.5 + 300;
  leaf(g, [fp + 120, 1250], 820, .78, 1, '#1c1030');
  leaf(g, [fp + 2180, 1250], 820, .78, -1, '#1c1030');
  // 摩托剪影：黎明轮廓光 + ハーモニー式喷枪质感
  const bx = 800 + k * 240, by = 940 - Math.sin(u * Math.PI) * 50 - k * 20;
  celLayer(S, c => {
    c.translate(bx, by); c.rotate(-.12 + k * .06); c.scale(1.0, 1.0);
    riderSide(c, PAL.backlit, { ph: (fr % 4) / 4, wheelA: q12(t) * 30, speed: 1, rim: { c: '#ffb070', d: [-7, -3] } });
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop';
    const gr = c.createRadialGradient(bx + 500, by + 200, 50, bx + 500, by + 200, 900); gr.addColorStop(0, rgba('#ff9a70', .45)); gr.addColorStop(1, rgba('#ff9a70', 0));
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    const g2 = c.createLinearGradient(0, by - 700, 0, by); g2.addColorStop(0, rgba('#6a5ac8', .35)); g2.addColorStop(1, rgba('#6a5ac8', 0));
    c.fillStyle = g2; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
  }, { occCol: '#000' });
  // 车灯与尾灯
  const s = 1.0, ang = -.12 + k * .06, rot = (p) => [bx + (p[0] * Math.cos(ang) - p[1] * Math.sin(ang)) * s, by + (p[0] * Math.sin(ang) + p[1] * Math.cos(ang)) * s];
  const tl = rot(LAMPS.tail), hd = rot(LAMPS.head);
  lamp(g, e, tl[0], tl[1], 12, '#ff2a40'); lamp(g, e, hd[0], hd[1], 16, '#fff0c0'); flare(e, hd[0], hd[1], .35, '#fff0c0', { ghosts: false, streak: 800 });
  // 空中飘落的水珠（慢动作）
  const Rw = rng(66);
  for (let i = 0; i < 40; i++) { const x = bx - 500 + Rw() * 900, y = by + 60 + Rw() * 300 + lt * 40; g.fillStyle = rgba('#ffe0d0', .7); g.beginPath(); g.ellipse(x, y, 3, 5, 0, 0, TAU); g.fill(); }
  flare(e, 2250 + pan, 790 - 120 - k * 40, .6, '#ffd0a0', { streak: 1800, ghostA: .6 });
}

// —— 14 落地：冲击帧 → 悬挂压缩、火花、镜头震动 ——
export function land(S) {
  const { g, e, t, lt, u } = S, P = PAL.night;
  const fr = f12(t);
  if (lt < 2 / 24) {   // 黑白冲击帧
    g.fillStyle = '#f4f0ff'; g.fillRect(0, 0, W, H);
    celLayer(S, c => { c.translate(960, 900); c.scale(1.05, 1.05); riderSide(c, PAL.day, { ph: 0, wheelA: 0, speed: 1, squash: 1 }); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#0a0612'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; }, { occlude: false });
    speedLines(g, 2, { type: 'radial', cx: 960, cy: 800, n: 60, col: '#0a0612', a: .8, r0: 500, seed: 62 });
    return { bloom: .2 };
  }
  const shake = Math.exp(-lt * 3.2), sx = (hash(Math.floor(t * 24)) - .5) * 34 * shake, sy = (hash(Math.floor(t * 24) + 7) - .5) * 34 * shake;
  g.save(); e.save(); g.translate(sx, sy); e.translate(sx, sy);
  predawn(g, -40, 900, .35);
  farShore(g, e, 820, 1500, .8);
  vgrad(g, 0, 820, W, 300, [[0, '#6a3a6a'], [1, '#1a0e28']]);
  // 桥面 + 栏杆（高速平移）
  g.fillStyle = '#2a1e40'; g.fillRect(-50, 900, W + 100, 200);
  const ox = -(t * 1600) % 160;
  g.fillStyle = '#140a22'; for (let x = ox - 160; x < W + 160; x += 160) g.fillRect(x, 760, 14, 150);
  g.fillRect(-50, 756, W + 100, 12); g.fillRect(-50, 820, W + 100, 8);
  speedLines(g, fr, { type: 'h', n: 30, col: '#ffc0a0', a: .3, hmax: 4, seed: 63 });
  // 悬挂：压缩后弹簧回弹（12fps）
  const q = q12(lt), sq = Math.max(0, Math.exp(-q * 6) * Math.cos(q * 20));
  const X = 900, Y = 1000;
  // 火花：从车腹向后飞
  const Rs = rng(800 + fr);
  for (let i = 0; i < 60 * Math.max(0, 1 - lt * .8); i++) {
    const x0 = X - 40 + Rs() * 200, y0 = Y - 110, L = 60 + Rs() * 260, a = Math.PI + (Rs() - .7) * .5;
    for (const [ctx, w, col] of [[e, 6, '#ffb040'], [g, 2.5, '#fff4c0']]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(a) * L, y0 + Math.sin(a) * L * .4 - Rs() * 40); ctx.stroke(); }
  }
  celLayer(S, c => { c.translate(X, Y); c.scale(.95, .95); riderSide(c, P, { ph: (fr % 4) / 4, wheelA: q12(t) * 40, speed: 1, squash: sq, bob: sq * 20, rim: { c: '#ffb08a', d: [-4, 3] } }); });
  lamp(g, e, X + LAMPS.tail[0] * .95, Y + LAMPS.tail[1] * .95, 12, '#ff2a40');
  lamp(g, e, X + LAMPS.head[0] * .95, Y + LAMPS.head[1] * .95 + sq * 28, 16, '#fff0c0');
  // 水花（落地瞬间）
  const Rw = rng(900 + fr % 3), sp = Math.max(0, 1 - lt * 1.5);
  for (let i = 0; i < 80 * sp; i++) { const a = -Math.PI * Rw(), r = 80 + Rw() * 420 * (1 - sp * .4), x = X + (Rw() < .5 ? -290 : 300) + Math.cos(a) * r, y = Y + Math.sin(a) * r * .5; g.fillStyle = rgba('#e8e0ff', .7); g.beginPath(); g.arc(x, y, 3 + Rw() * 6, 0, TAU); g.fill(); }
  g.restore(); e.restore();
}
