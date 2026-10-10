// 黎明：交接磁带、卡带机 PLAY、火箭升空、晨光里的微笑、片尾卡
import { canvas, W, H, TAU, LWK, rgba, mix, vgrad, airbrush, hash, rng, poly, path, cel, line, ribbon, flutter } from './cel.js';
import { PAL } from './pal.js';
import { head80 } from './head80.js';
import { rain, speedLines, flare, lamp, trail } from './fx.js';
import { celLayer } from './shots.js';
import { cassette, titleCard } from './scenes1.js';
import { hand, HER, HIS } from './hands.js';
import { T, q12, q8, BEAT, BAR, bar, VO, CREDITS } from './story.js';

const f12 = t => Math.floor(t * 12 + 1e-6);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = x => { x = clamp(x); return x * x * (3 - 2 * x); };

function dawnSky(g, e, y0 = 0, h = H, k = 0) {
  vgrad(g, 0, y0, W, h, [[0, mix('#2a3a8a', '#4a6ab8', k)], [.4, mix('#9a6aaa', '#c89ab8', k)], [.72, mix('#ffa08a', '#ffc0a0', k)], [1, mix('#ffe0a0', '#fff0c8', k)]]);
}

// —— 16 交接：铁丝网前两只手 ——
export function handoff(S) {
  const { g, e, t, lt } = S, P = PAL.dawn;
  dawnSky(g, e, 0, H, .3);
  // 散景：发射场的灯 + 模糊的火箭
  const R = rng(88);
  g.save(); g.filter = 'blur(14px)';
  g.fillStyle = '#f4ecff'; g.fillRect(1380, 120, 90, 700); g.fillStyle = '#ff8a4a'; g.fillRect(1380, 400, 90, 30);
  g.fillStyle = '#3a2a4a'; g.fillRect(1250, 60, 70, 900); g.fillStyle = '#4a3a58'; g.fillRect(0, 820, W, 300);
  g.restore();
  for (let i = 0; i < 26; i++) { const x = R() * W, y = 500 + R() * 500, r = 20 + R() * 60, col = ['#ffd08a', '#ff9a6a', '#fff0d0'][i % 3]; for (const [ctx, a] of [[g, .3], [e, .3]]) { ctx.fillStyle = rgba(col, a); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } }
  // 铁丝网（菱形格，前景）
  g.strokeStyle = '#3a2c44'; g.lineWidth = 7;
  for (let k = -20; k < 40; k++) { g.beginPath(); g.moveTo(k * 90, 0); g.lineTo(k * 90 + 1100, H); g.stroke(); g.beginPath(); g.moveTo(k * 90, 0); g.lineTo(k * 90 - 1100, H); g.stroke(); }
  g.strokeStyle = rgba('#ffd0a8', .55); g.lineWidth = 2;
  for (let k = -20; k < 40; k++) { g.beginPath(); g.moveTo(k * 90 - 3, 0); g.lineTo(k * 90 + 1097, H); g.stroke(); }
  // 网上剪开的缺口（手从这里伸过去）
  g.save(); g.globalCompositeOperation = 'destination-out'; g.restore();
  // 动作：她的手从左进 → 对方从右接 → 她松手退出，对方带走
  const tq = q12(t);
  const inU = ss(seg(tq, bar(20), bar(20) + .55)), outU = ss(seg(tq, T.handoff + .45, T.handoff + 1.2));
  const takeU = ss(seg(tq, bar(20) + .3, T.handoff)), awayU = ss(seg(tq, T.handoff + .6, T.handoff + 1.3));
  const cy = 540 + Math.sin(tq * 3) * 4;
  const herX = -600 + inU * 1420 - outU * 1500, hisX = 2500 - takeU * 1400 + awayU * 1100;
  const cx = tq < T.handoff ? herX + 140 : hisX - 140;
  const jolt = (tq >= T.handoff && tq < T.handoff + .1) ? 8 : 0;
  celLayer(S, c => {
    LWK.k = .8; c.translate(960, 540); c.scale(1.25, 1.25); c.translate(-960, -540);
    const at = (x, y, fn) => { c.save(); c.translate(x, y); fn(); c.restore(); };
    at(hisX, cy - 30, () => hand(c, HIS, 'back', { dir: -1, squeeze: takeU }));
    at(herX, cy - 40, () => hand(c, HER(P), 'back', { dir: 1 }));
    at(cx - 200 * .9 + jolt, cy - 128 * .9, () => { c.scale(.9, .9); cassette(c, P, { reel: 0, shine: seg(t, bar(20), bar(21)), shineCol: '#ffd0a0' }); });
    at(herX, cy - 40, () => hand(c, HER(P), 'front', { dir: 1 }));
    at(hisX, cy - 30, () => hand(c, HIS, 'front', { dir: -1 }));
    LWK.k = 1;
  });
  flare(e, 1700, 160, .5, '#ffe0b0', { streak: 1200, ghostA: .5 });
}

// —— 17 卡带机：PLAY ——
export function deck(S) {
  const { g, e, t, lt } = S, P = PAL.day;
  // 面板（拉丝金属）
  vgrad(g, 0, 0, W, H, [[0, '#4a4a58'], [.5, '#6a6a7a'], [1, '#3a3a46']]);
  for (let y = 0; y < H; y += 3) { g.fillStyle = rgba(y % 2 ? '#ffffff' : '#000000', .03); g.fillRect(0, y, W, 1); }
  g.fillStyle = '#2a2a34'; g.font = '600 30px "Barlow SC"'; g.textAlign = 'left'; g.fillText('ON-BOARD AUDIO  ·  CH 2', 120, 110);
  for (const [x, y] of [[60, 60], [W - 60, 60], [60, H - 60], [W - 60, H - 60]]) { g.fillStyle = '#8a8a98'; g.beginPath(); g.arc(x, y, 12, 0, TAU); g.fill(); g.strokeStyle = '#2a2a34'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.stroke(); }
  // 卡带仓（窗里看见磁带）
  const played = t >= T.play, ra = played ? (t - T.play) * 5 : 0;
  g.fillStyle = '#16141c'; g.beginPath(); g.roundRect(200, 180, 900, 600, 20); g.fill();
  g.save(); g.translate(250, 250); g.scale(2, 2); cassette(g, PAL.day, { reel: ra }); g.restore();
  g.fillStyle = rgba('#8ab8ff', .1); g.beginPath(); g.roundRect(200, 180, 900, 600, 20); g.fill();
  g.fillStyle = rgba('#ffffff', .12); g.beginPath(); g.moveTo(240, 200); g.lineTo(420, 200); g.lineTo(300, 760); g.lineTo(240, 760); g.fill();
  g.strokeStyle = '#8a8a98'; g.lineWidth = 6; g.beginPath(); g.roundRect(200, 180, 900, 600, 20); g.stroke();
  // VU 表（透过光）
  for (let k = 0; k < 2; k++) {
    const x = 1200 + k * 330, y = 200, w = 290, h = 200;
    g.fillStyle = played ? '#ffd88a' : '#8a7a5a'; g.fillRect(x, y, w, h); if (played) { e.fillStyle = rgba('#ffc860', .7); e.fillRect(x, y, w, h); }
    g.strokeStyle = '#2a2020'; g.lineWidth = 3; g.beginPath(); g.arc(x + w / 2, y + h + 40, 190, Math.PI * 1.28, Math.PI * 1.72); g.stroke();
    g.strokeStyle = '#d02020'; g.lineWidth = 6; g.beginPath(); g.arc(x + w / 2, y + h + 40, 190, Math.PI * 1.6, Math.PI * 1.72); g.stroke();
    g.fillStyle = '#2a2020'; g.font = '700 26px "Barlow SC"'; g.textAlign = 'center'; g.fillText('VU', x + w / 2, y + h - 30);
    const lev = played ? .35 + .4 * Math.abs(Math.sin(q12(t) * 7.3 + k)) * (hash(f12(t) + k * 9) * .5 + .5) : 0;
    const a = Math.PI * (1.3 + lev * .4);
    g.strokeStyle = '#1a1010'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + w / 2, y + h + 40); g.lineTo(x + w / 2 + Math.cos(a) * 200, y + h + 40 + Math.sin(a) * 200); g.stroke();
    g.fillStyle = '#16141c'; g.fillRect(x - 10, y + h, w + 20, 60);
    g.strokeStyle = '#8a8a98'; g.lineWidth = 6; g.strokeRect(x, y, w, h);
  }
  // LED
  const led = (x, y, col, on, label) => { lamp(g, on ? e : null, x, y, 12, on ? col : '#302828', on ? 1 : 0); g.fillStyle = on ? col : '#403838'; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); g.fillStyle = '#1a1a22'; g.font = '600 22px "Barlow SC"'; g.textAlign = 'center'; g.fillText(label, x, y + 40); };
  led(1300, 520, '#40ff80', played, 'PLAY'); led(1420, 520, '#ffb040', true, 'POWER'); led(1540, 520, '#ff3030', false, 'REC');
  // 按键：REW PLAY FF STOP
  const keys = ['◀◀', '▶', '▶▶', '■'];
  const press = played ? Math.min(1, (t - T.play) * 20) * (1 - seg(t, T.play + .25, T.play + .4) * .6) : 0;
  keys.forEach((kname, i) => {
    const x = 240 + i * 215, y = 840 + (i === 1 ? press * 16 : 0);
    g.fillStyle = '#1a1a22'; g.fillRect(x - 6, 834, 202, 150);
    cel(g, poly([[x, y], [x + 190, y], [x + 190, y + 120], [x, y + 120]]), { f: i === 1 ? '#d8dce8' : '#b8bcc8', s: '#7a7e8c', so: [0, -14], h: '#ffffff', ho: [0, 4], l: '#2a2a34', lw: 3 });
    g.fillStyle = i === 1 ? '#20a050' : '#3a3a48'; g.font = '700 44px "Barlow SC"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(kname, x + 95, y + 60); g.textBaseline = 'alphabetic';
  });
  // 戴白手套的手指从上方按下 PLAY
  const fy = t < T.play - .35 ? -700 : t < T.play ? -700 + ss(seg(t, T.play - .35, T.play)) * 1480 : 780 + press * 16 - ss(seg(t, T.play + .5, T.play + 1.1)) * 1300;
  celLayer(S, c => {
    c.translate(575, fy); LWK.k = .9;
    cel(c, [[-70, -600], [70, -600], [74, -40], [40, 30], [-40, 30], [-74, -40]], { f: '#f4f2ec', s: '#c8c0b0', so: [-14, 0], h: '#ffffff', ho: [6, 0], l: '#4a4238', lw: 3 });
    cel(c, [[-200, -1100], [120, -1100], [140, -560], [-60, -520], [-220, -600]], { f: '#f4f2ec', s: '#c8c0b0', so: [-24, 0], l: '#4a4238', lw: 3 });
    cel(c, poly([[-240, -1500], [160, -1500], [160, -1080], [-240, -1080]]), { f: '#ff8a3c', s: '#c85a2a', so: [-30, 0], l: '#5a2410', lw: 3 });
    LWK.k = 1;
  });
}

// —— 18 火箭升空（大全景 → 上摇）——
export function liftPlate() {
  const [c, g] = canvas(1920, 2400), [ec, e] = canvas(1920, 2400), R = rng(99);
  e.fillStyle = '#000'; e.fillRect(0, 0, 1920, 2400);
  vgrad(g, 0, 0, 1920, 2000, [[0, '#1c2a78'], [.4, '#5a5aa8'], [.7, '#d88aa0'], [.9, '#ffb08a'], [1, '#ffe0a0']]);
  // 云（喷枪，被太阳从下面照亮）
  g.save(); g.filter = 'blur(12px)';
  for (let i = 0; i < 34; i++) { const x = R() * 2100 - 90, y = 300 + R() * 1500, w = 200 + R() * 420, h = 30 + R() * 50;
    g.fillStyle = rgba('#7a5a9a', .55); g.beginPath(); g.ellipse(x, y, w, h, 0, 0, TAU); g.fill();
    g.fillStyle = rgba('#ffc0a0', .45 + y / 4000); g.beginPath(); g.ellipse(x + 20, y + h * .4, w * .85, h * .4, 0, 0, TAU); g.fill(); }
  g.restore();
  // 太阳（刚出地平线）
  airbrush(g, 1500, 2000, 900, 400, '#fff0c0', .6); airbrush(e, 1500, 2000, 500, 240, '#ffe0a0', .7);
  g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(1500, 2010, 120, Math.PI, 0); g.fill(); e.fillStyle = '#fff0c0'; e.beginPath(); e.arc(1500, 2010, 120, Math.PI, 0); e.fill();
  // 海
  vgrad(g, 0, 2000, 1920, 400, [[0, '#ffb890'], [.2, '#9a6a9a'], [1, '#2a2050']]);
  for (let k = 0; k < 90; k++) { const y = 2006 + k * k * .045, w = 40 + R() * 200; g.fillStyle = rgba('#fff0c0', .5 * (1 - k / 90)); g.fillRect(1500 - w / 2 + (R() - .5) * k * 8, y, w, 2); }
  // 发射场剪影
  g.fillStyle = '#2a1a3a'; g.fillRect(0, 1960, 1920, 50);
  for (let x = 0; x < 1920; x += 40) { const h = 10 + R() * 40; g.fillRect(x, 1960 - h, 40, h); }
  return { c, e: ec, w: 1920, h: 2400 };
}
function rocket(g, e, x, y, s, t) {
  const P = PAL.dawn;
  g.save(); g.translate(x, y); g.scale(s, s);
  // 火焰（12fps 三张循环）
  const k = f12(t) % 3, fl = [1, 1.15, .92][k];
  for (const [ctx, col, w, L] of [[e, '#ffb040', 70, 520], [g, '#ff8a2a', 56, 460], [g, '#fff0a0', 34, 330], [g, '#ffffff', 18, 200]]) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.quadraticCurveTo(-w * .6, L * .5 * fl, 0, L * fl); ctx.quadraticCurveTo(w * .6, L * .5 * fl, w, 0); ctx.fill();
  }
  for (const sx of [-1, 1]) {   // 助推器
    g.save(); g.translate(sx * 70, 0);
    for (const [col, w, L] of [['#ff8a2a', 30, 260], ['#fff0a0', 18, 170]]) { g.fillStyle = col; g.beginPath(); g.moveTo(-w, 0); g.quadraticCurveTo(-w * .5, L * .5 * fl, 0, L * fl); g.quadraticCurveTo(w * .5, L * .5 * fl, w, 0); g.fill(); }
    cel(g, [[-26, 0], [-26, -380], [0, -440, 1], [26, -380], [26, 0]], { f: P.white.f, s: P.white.s, so: [-10 * sx, 0], h: P.white.h, ho: [4 * sx, 0], l: P.white.l, lw: 3 });
    g.restore();
  }
  cel(g, [[-44, 0], [-44, -760], [-30, -860], [0, -930, 1], [30, -860], [44, -760], [44, 0]], { f: P.white.f, s: P.white.s, so: [-16, 0], h: P.white.h, ho: [6, 0], l: P.white.l, lw: 3,
    clipFn: gg => { gg.fillStyle = '#ff7a3c'; gg.fillRect(-50, -520, 100, 40); gg.fillStyle = '#1fc4b2'; gg.fillRect(-50, -860, 100, 110); gg.fillStyle = '#2a2a3a'; gg.fillRect(-50, -120, 100, 26); gg.fillStyle = '#ff4fa8'; gg.fillRect(-50, -470, 100, 10); } });
  e.fillStyle = rgba('#fff0c0', .9); e.beginPath(); e.arc(0, 30, 80, 0, TAU); e.fill();
  g.restore();
}
function billow(g, x, y, r, seed, grow, col = ['#f4e8f0', '#b89ab8', '#ffffff']) {   // 赛璐璐烟云：一团团圆 + 硬边阴影
  const R = rng(seed);
  for (let i = 0; i < 9; i++) {
    const a = R() * TAU, d = R() * r * grow, rr = r * (.5 + R() * .6) * grow, cx = x + Math.cos(a) * d * 1.6, cy = y - Math.abs(Math.sin(a)) * d * .7;
    const c0 = new Path2D(); c0.arc(cx, cy, rr, 0, TAU);
    cel(g, c0, { f: col[0], s: col[1], so: [-rr * .25, -rr * .3], h: col[2], ho: [rr * .15, rr * .2], l: '#6a4a6a', lw: 2.5 });
  }
}
export function liftoff(S) {
  const { g, e, t, lt, u, A } = S;
  const rise = Math.pow(Math.max(0, lt - .25), 2) * 62;   // 火箭上升（加速）
  const tilt = ss(seg(lt, .5, 4.4)) * 1000;               // 镜头上摇（有延迟）
  const L = A.lift, oy = -(L.h - H) + 220 + tilt;
  const shake = Math.max(0, 1 - lt * .4) * (lt > .2 ? 1 : 0), sx = (hash(Math.floor(t * 24)) - .5) * 10 * shake, sy = (hash(Math.floor(t * 24) + 3) - .5) * 10 * shake;
  g.save(); e.save(); g.translate(sx, sy); e.translate(sx, sy);
  g.drawImage(L.c, 0, oy); e.drawImage(L.e, 0, oy);
  const pad = [760, oy + 1960];
  // 发射塔
  g.fillStyle = '#1e1230'; g.fillRect(pad[0] - 150, pad[1] - 720, 56, 720);
  for (let y = pad[1] - 720; y < pad[1]; y += 40) { g.strokeStyle = '#34224c'; g.lineWidth = 4; g.beginPath(); g.moveTo(pad[0] - 150, y); g.lineTo(pad[0] - 94, y + 40); g.moveTo(pad[0] - 94, y); g.lineTo(pad[0] - 150, y + 40); g.stroke(); }
  // 烟云：从发射台向两侧翻滚
  const grow = .4 + ss(seg(lt, .1, 3)) * 1.1;
  billow(g, pad[0] - 320, pad[1] - 20, 160, 3 + (f12(t) % 2), grow); billow(g, pad[0] + 320, pad[1] - 20, 160, 7 + (f12(t) % 2), grow);
  rocket(g, e, pad[0], pad[1] - 60 - rise, .5, t);
  billow(g, pad[0], pad[1] + 10, 200, 11 + (f12(t) % 2), grow * .9);
  // 尾迹烟柱
  if (rise > 60) { g.fillStyle = rgba('#fff4f0', .85); g.beginPath(); g.moveTo(pad[0] - 22, pad[1] - 60 - rise + 160); g.lineTo(pad[0] + 22, pad[1] - 60 - rise + 160); g.lineTo(pad[0] + 120, pad[1]); g.lineTo(pad[0] - 120, pad[1]); g.fill(); }
  g.restore(); e.restore();
  flare(e, 1500, oy + 1990, .9, '#ffe0b0', { streak: 1900 });
  flare(e, pad[0], pad[1] - 60 - rise + 40, .5, '#fff0c0', { ghosts: false, streak: 900 });
}

// —— 19 晨光里的微笑 ——
function smileBG(g, e, t, lt) {
  dawnSky(g, e, 0, H, .5);
  airbrush(g, 1750, 1000, 900, 500, '#fff0c0', .5);
  // 火箭尾迹：一条弧线伸向右上
  const pts = []; for (let k = 0; k <= 40; k++) { const u = k / 40; pts.push([1100 + u * 700, 1100 - Math.pow(u, .7) * 1050 - lt * 30 * u]); }
  g.strokeStyle = rgba('#ffffff', .85); g.lineWidth = 14; g.lineCap = 'round'; g.beginPath(); pts.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p[0], p[1])); g.stroke();
  g.strokeStyle = rgba('#ffd8c8', .6); g.lineWidth = 30; g.stroke();
  const tip = pts[pts.length - 1]; lamp(g, e, tip[0], tip[1], 16, '#fff0c0'); flare(e, tip[0], tip[1], .35, '#fff0c0', { ghosts: false, streak: 500 });
}
export function smile(S) {
  const { g, e, t, lt } = S, P = PAL.dawn;
  smileBG(g, e, t, lt);
  const tq = q8(t), g4 = VO.find(v => v.id === 'g4'), speaking = tq >= g4.t && tq < g4.t + 1.35;
  const flap = ['talk', 'oh', 'talk', 'closed'][Math.floor((tq - g4.t) * 8) % 4];
  const after = tq >= g4.t + 1.35, beam = tq > T.smile + .2;
  const mouth = speaking ? flap : after ? (beam ? 'smileopen' : 'smile') : 'pant';
  const expr = speaking ? 'talk' : after ? (beam ? 'smileopen' : 'smile') : 'panting';
  const blink = Math.floor(tq * 8) === Math.floor((T.smile - .1) * 8);   // 笑之前眨一下眼（1 张）
  const fr = Math.floor(t * 8);
  const s = 2.5 + lt * .03;
  celLayer(S, c => {
    c.translate(820, 490); c.scale(s, s);
    head80(c, P, { view: 'q', expr: blink ? 'closed' : expr, mouth: blink ? 'smile' : mouth, ph: (fr % 6) / 6, wind: .35, look: [.55, -.6], light: [1, -.35], skinRim: '#ffe6b8', rim: { c: '#ffe0a0', d: [-2, .8] } });
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop';
    const gr = c.createLinearGradient(1300, 0, 500, 0); gr.addColorStop(0, rgba('#ffd090', .35)); gr.addColorStop(1, rgba('#ffd090', 0));
    c.fillStyle = gr; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
  });
  flare(e, 1760, 980, .8, '#ffe8c0', { streak: 1600, ghostA: .7 });
}

// —— 20 片尾卡 ——
export function endcard(S) {
  const { g, e, t, lt } = S;
  smileBG(g, e, t, lt + 4);
  const a = ss(seg(lt, 0, .6));
  g.fillStyle = rgba('#0a0620', .72 * a); g.fillRect(0, 0, W, H);
  e.fillStyle = rgba('#000', .7 * a); e.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = a; g.textAlign = 'center';
  g.font = '44px "Dela Gothic One"'; g.fillStyle = '#35e7ff'; g.fillText('シティ・ライツ', W / 2, 250);
  g.font = 'italic 900 150px Kanit'; g.lineJoin = 'round';
  const gr = g.createLinearGradient(0, 290, 0, 420); gr.addColorStop(0, '#e8f6ff'); gr.addColorStop(.46, '#7fc8ff'); gr.addColorStop(.5, '#ffffff'); gr.addColorStop(.54, '#3a2a7a'); gr.addColorStop(.8, '#ff6aa0'); gr.addColorStop(1, '#ffd08a');
  g.strokeStyle = '#120830'; g.lineWidth = 18; g.strokeText('CITY LIGHTS', W / 2, 410); g.strokeStyle = '#ff3fa4'; g.lineWidth = 7; g.strokeText('CITY LIGHTS', W / 2, 410);
  g.fillStyle = gr; g.fillText('CITY LIGHTS', W / 2, 410);
  g.font = 'italic 900 90px Kanit'; g.fillStyle = '#ff2a3a'; g.strokeStyle = '#1a0610'; g.lineWidth = 10; g.strokeText('1987', W / 2 + 430, 500); g.fillText('1987', W / 2 + 430, 500);
  g.font = '600 46px "Barlow SC"'; g.fillStyle = '#ffe98a'; g.letterSpacing = '10px'; g.fillText('80s CEL ANIME', W / 2, 610); g.letterSpacing = '0px';
  g.font = '600 36px "Barlow SC"'; g.fillStyle = '#ffffff'; g.fillText('LemoLab  ×  Claude Opus 5.5', W / 2, 670);
  g.font = '500 29px "Barlow SC"'; g.fillStyle = rgba('#e8e0ff', .85);
  ['inspired by 1980s Japanese cel animation · all characters, vehicles and places are original', ...CREDITS].forEach((c, i) => g.fillText(c, W / 2, 790 + i * 44));
  g.restore();
  e.save(); e.globalAlpha = a; e.textAlign = 'center'; e.font = 'italic 900 150px Kanit'; e.strokeStyle = rgba('#ff3fa4', .8); e.lineWidth = 12; e.strokeText('CITY LIGHTS', W / 2, 410); e.restore();
}
