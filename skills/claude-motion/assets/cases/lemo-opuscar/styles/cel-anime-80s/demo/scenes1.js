// 冷开场 + 片名：下摇、磁带、眼睛大特写、片名卡
import { canvas, W, H, TAU, LWK, rgba, mix, vgrad, airbrush, hash, rng, poly, path, cel, line } from './cel.js';
import { PAL } from './pal.js';
import { riderSide } from './rider.js';
import { head80 } from './head80.js';
import { rain, splashes, speedLines, flare, lamp } from './fx.js';
import { celLayer } from './shots.js';
import { hand, HER } from './hands.js';
import { T, q12, q8, BEAT, VO } from './story.js';

const f12 = t => Math.floor(t * 12 + 1e-6);
const ease = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));

// —— 1 下摇：天空 → 楼顶 → 霓虹 → 街角的她 ——
export function crane(S) {
  const { g, e, A, t, u } = S;
  const k = ease(clamp(u * 1.08));
  const F = A.tallFar, N = A.tallNear;
  const yF = -k * (F.h - H) , yN = -k * (N.h - H);
  g.drawImage(F.c, 0, yF); e.drawImage(F.e, 0, yF);
  g.drawImage(N.c, 0, yN); e.drawImage(N.e, 0, yN);
  // 她坐在停着的摩托上（无风，头发垂下）
  const gy = N.base + yN + 150, fr = f12(t);
  if (gy < H + 400) {
    celLayer(S, c => { c.translate(1180, gy); c.scale(.5, .5); riderSide(c, PAL.night, { ph: (fr % 6) / 6, wheelA: 0, speed: 0, wind: 0, rim: { c: '#ff6ad0', d: [5, 6] } }); });
    lamp(g, e, 1180 - 356 * .5, gy - 366 * .5, 8, '#ff2a40', .6);
  }
  // 前景：近处招牌层（比近楼更快，多层视差）
  const yFG = -k * 3400 + 900;
  g.save(); g.fillStyle = '#0a0612'; g.fillRect(-20, yFG, 150, 1500); g.restore();
  // 雨（纵向下摇时雨更"长"）
  rain(g, e, fr, { n: 200, ang: .08, len: [60, 140], a: .28, w: 1.4, seed: 5 });
  if (u > .7) splashes(g, fr % 3, gy - 20, H, 20, '#bfb0ff');
}

// —— 磁带（通用画法）——
export function cassette(g, P, o = {}) {
  const ra = o.reel || 0;
  // 外壳（烟灰色半透明塑料）
  cel(g, poly([[0, 12], [12, 0], [388, 0], [400, 12], [400, 244], [388, 256], [12, 256], [0, 244]]), { f: '#2c2a3a', s: '#1a1824', so: [0, -18], h: '#5a5670', ho: [0, 4], l: '#0a0a12', lw: 3 });
  // 标签
  const lab = new Path2D(); lab.roundRect(22, 18, 356, 160, 8);
  cel(g, lab, { f: '#f4ead0', s: '#d8c9a4', so: [0, -10], l: '#6a5a40', lw: 2 });
  g.fillStyle = '#ff6a3c'; g.fillRect(22, 30, 356, 10); g.fillStyle = '#ffb33c'; g.fillRect(22, 44, 356, 6); g.fillStyle = '#35b8c8'; g.fillRect(22, 54, 356, 4);
  // 手写字
  g.save(); g.fillStyle = '#23306a'; g.font = 'italic 600 40px Kanit'; g.textBaseline = 'middle'; g.translate(78, 84); g.rotate(-.04); g.fillText('CITY LIGHTS', 0, 0);
  g.font = 'italic 600 20px Kanit'; g.fillText('for the pilot — play at T-0 ♪', 4, 30); g.restore();
  g.strokeStyle = '#23306a'; g.lineWidth = 3; g.beginPath(); g.arc(50, 84, 17, 0, TAU); g.stroke();
  g.fillStyle = '#23306a'; g.font = '700 24px "Barlow SC"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('A', 50, 85); g.textAlign = 'left';
  // 窗 + 磁带卷
  const win = new Path2D(); win.roundRect(118, 118, 164, 50, 22);
  g.fillStyle = '#120f1a'; g.fill(win);
  g.save(); g.clip(win);
  g.fillStyle = '#5a3424'; g.beginPath(); g.arc(158, 143, 38, 0, TAU); g.fill(); g.beginPath(); g.arc(242, 143, 24, 0, TAU); g.fill();
  g.restore();
  g.strokeStyle = '#6a6680'; g.lineWidth = 2.5; g.stroke(win);
  for (const [x, a] of [[158, ra], [242, ra * 1.4]]) {
    g.fillStyle = '#eeeef4'; g.beginPath(); g.arc(x, 143, 15, 0, TAU); g.fill();
    g.fillStyle = '#2c2a3a'; g.beginPath(); g.arc(x, 143, 7, 0, TAU); g.fill();
    g.fillStyle = '#eeeef4'; for (let k = 0; k < 6; k++) { const aa = a + k * TAU / 6; g.fillRect(x + Math.cos(aa) * 6 - 1.5, 143 + Math.sin(aa) * 6 - 1.5, 3, 3); }
  }
  // 底部磁头区
  cel(g, poly([[92, 256], [116, 196], [284, 196], [308, 256]]), { f: '#26242f', l: '#0a0a12', lw: 2 });
  g.fillStyle = '#0a0a12'; for (const x of [140, 176, 224, 260]) { g.beginPath(); g.arc(x, 226, 7, 0, TAU); g.fill(); }
  g.fillStyle = '#8a8698'; for (const [x, y] of [[14, 14], [386, 14], [14, 242], [386, 242], [200, 188]]) { g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); g.strokeStyle = '#2a2838'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 3, y); g.stroke(); }
  // 塑料上的硬边高光（光带随时间滑过）
  if (o.shine != null) {
    g.save(); g.beginPath(); g.rect(0, 0, 400, 256); g.clip();
    const x = -200 + o.shine * 900;
    g.fillStyle = rgba('#ffffff', .22); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 70, 0); g.lineTo(x - 30, 256); g.lineTo(x - 100, 256); g.fill();
    g.fillStyle = rgba(o.shineCol || '#ff8ad8', .28); g.beginPath(); g.moveTo(x + 90, 0); g.lineTo(x + 110, 0); g.lineTo(x + 10, 256); g.lineTo(x - 10, 256); g.fill();
    g.restore();
  }
}
// 戴手套的手（从下方托住磁带）：拇指压在左下角，指尖从右边缘露出
export function gloveHold(g, P, part) {
  if (part === 'back') {   // 手掌与手腕（在磁带后）
    cel(g, [[-60, 300], [30, 200], [150, 220], [330, 214], [420, 240], [430, 290], [300, 330], [120, 420], [-40, 520]], { f: P.glove.f, s: P.glove.s, so: [0, -20], h: P.glove.h, ho: [0, 8], l: P.glove.l, lw: 3 });
    cel(g, poly([[-120, 420], [40, 330], [100, 440], [-60, 560]]), { f: P.cuff.f, s: P.cuff.s, so: [0, -14], l: P.cuff.l, lw: 3 });
    cel(g, poly([[-300, 560], [-110, 420], [-40, 560], [-200, 700]]), { f: P.jacket.f, s: P.jacket.s, so: [0, -30], l: P.jacket.l, lw: 3 });
  } else {   // 拇指 + 右侧指尖（在磁带前）
    cel(g, [[40, 250], [70, 196], [110, 176], [138, 190], [120, 226], [96, 262]], { f: P.glove.f, s: P.glove.s, so: [-6, -8], h: P.glove.h, ho: [4, 4], l: P.glove.l, lw: 3 });
    for (let k = 0; k < 3; k++) cel(g, [[394, 150 + k * 34], [420, 146 + k * 34], [430, 170 + k * 34], [398, 178 + k * 34]], { f: P.glove.f, s: P.glove.s, so: [-4, -4], l: P.glove.l, lw: 2.5 });
  }
}

export function tape(S) {
  const { g, e, t, lt, u } = S, P = PAL.night;
  // 背景：霓虹散景（圆形光斑）
  vgrad(g, 0, 0, W, H, [[0, '#120a26'], [1, '#2a1030']]);
  const R = rng(77);
  for (let i = 0; i < 38; i++) {
    const x = R() * W, y = R() * H, r = 30 + R() * 90, col = ['#ff3fa4', '#35e7ff', '#ffd23f', '#b36bff', '#ff5a3c'][i % 5];
    const dx = -lt * (10 + r * .2);
    for (const [ctx, a] of [[g, .18], [e, .25]]) { ctx.fillStyle = rgba(col, a); ctx.beginPath(); ctx.arc(x + dx, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba(col, a * 1.4); ctx.lineWidth = 3; ctx.stroke(); }
  }
  // 手 + 磁带：12fps 步进的轻微晃动；最后 0.6 秒收进夹克（向下滑出）
  const tq = q12(t), exitU = seg(tq, 6.55, 7.2), bob = Math.sin(tq * 3.1) * 4;
  const x = 700, y = 330 + bob + exitU * exitU * 900, rot = -.08 + Math.sin(tq * 1.7) * .012 + exitU * .3;
  celLayer(S, c => {
    c.translate(x, y); c.rotate(rot); c.scale(1.35, 1.35);
    c.save(); c.translate(70, 205); c.rotate(-.62); hand(c, HER(P), 'back'); c.restore();
    cassette(c, P, { reel: 0, shine: seg(t, 4.3, 6.3), shineCol: '#ff8ad8' });
    c.save(); c.translate(70, 205); c.rotate(-.62); hand(c, HER(P), 'front'); c.restore();
  });
  // 塑料壳上的反光也进发光层（透过光的一丝）
  rain(g, e, f12(t), { n: 60, ang: .1, len: [50, 120], a: .18, w: 1.2, seed: 9 });
}

// —— 3 眼睛大特写 ——
export function eyes(S) {
  const { g, e, t, lt, u } = S, P = PAL.night;
  vgrad(g, 0, 0, W, H, [[0, '#1a0c2e'], [1, '#2a1238']]);
  for (let i = 0; i < 12; i++) { const R = hash(i * 7.3); airbrush(g, R * W, hash(i * 3.1) * H, 160, 160, ['#ff3fa4', '#35e7ff', '#b36bff'][i % 3], .25); }
  // 表演（8fps）：先垂眼听无线电 → 一次快速眨眼（闭眼只停 1 张 = 3 帧）→ 抬眼，眼神变锐利；说台词时口型开合
  const tq = q8(t), k = Math.floor((tq - T.eyesOpen) * 8);
  const E = k < 0 ? { open: .62, lid: .42, look: [.1, .55], expr: 'neutral' } : k === 0 ? { open: 0, expr: 'closed' } : { open: .95, lid: Math.min(.36, .12 + k * .06), look: [.3, 0], expr: 'determined' };
  const g1 = VO.find(v => v.id === 'g1'), talking = tq >= g1.t && tq < g1.t + 1.5;
  const mouth = talking ? ['talk', 'oh', 'talk', 'set'][Math.floor((tq - g1.t) * 8) % 4] : 'set';
  const rev = seg(t, T.rev[0], T.rev[0] + .1) * (1 - seg(t, T.rev[0] + .2, T.rev[0] + .6)) + seg(t, T.rev[1], T.rev[1] + .1) * (1 - seg(t, T.rev[1] + .2, T.rev[1] + .8));
  const shx = (hash(Math.floor(t * 24)) - .5) * 10 * rev, shy = (hash(Math.floor(t * 24) + 5) - .5) * 8 * rev;
  const s = 4.6 + lt * .06;
  LWK.k = .5;
  celLayer(S, c => {
    c.translate(960 - 7 * s + shx, 520 - 21 * s + shy); c.scale(s, s);
    head80(c, P, { view: 'q', expr: E.expr, open: E.open, lid: E.lid, look: E.look, mouth, ph: (f12(t) % 4) / 4, wind: .5, reflect: '#ff5fc8', detail: true, rim: { c: '#ff6ad0', d: [1.2, .8] } });
    // 霓虹光带从脸上扫过（只照亮赛璐璐）
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop';
    const bx = -600 + ((lt * 900) % 2800);
    const gr = c.createLinearGradient(bx, 0, bx + 500, 300); gr.addColorStop(0, rgba('#35e7ff', 0)); gr.addColorStop(.5, rgba('#35e7ff', .22)); gr.addColorStop(1, rgba('#35e7ff', 0));
    c.fillStyle = gr; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
  });
  LWK.k = 1;
  // 眼神一亮（キラッ）：睁眼后第二次轰油时，瞳孔高光处闪出星芒
  const gl = seg(t, T.rev[1] - .05, T.rev[1] + .45), ga = Math.sin(gl * Math.PI);
  if (ga > 0) { const ix = 960 - 7 * s + (-21 - .34 * 11) * s, iy = 520 - 21 * s + (22 + 3 - .34 * 17) * s;
    flare(e, ix, iy, .45 * ga, '#ffffff', { ghosts: false, streak: 500, spikes: 4, rot: .78 }); }
}

// —— 4 片名卡：透过光 ——
export function titleCard(g, e, t0, lt, o = {}) {
  const on = o.static ? 1 : lt;
  // 背景：深蓝 + 横向光条 + 细星
  vgrad(g, 0, 0, W, H, [[0, '#03021a'], [.55, '#0d0a36'], [1, '#2a0d3a']]);
  const R = rng(91); for (let i = 0; i < 180; i++) { g.fillStyle = rgba('#ffffff', .2 + R() * .5); g.fillRect(R() * W, R() * H, 2, 2); }
  if (!o.static) speedLines(g, f12(t0), { type: 'h', n: 30, col: '#6a8aff', a: .35, hmax: 4, seed: 4 });
  // 地平线光（霓虹城市的剪影）
  vgrad(g, 0, 720, W, 360, [[0, rgba('#ff3fa4', 0)], [1, rgba('#ff3fa4', .35)]]);
  const R2 = rng(12); g.fillStyle = '#07041a';
  for (let x = 0; x < W;) { const w = 40 + R2() * 110, h = 60 + R2() * 220; g.fillRect(x, H - h, w, h); x += w; }
  // 字：CITY LIGHTS（铬金属渐变 + 粗描边），透过光：前几帧按 12fps 闪两下再稳定
  const flick = o.static ? 1 : (() => { const k = Math.floor(lt * 12); return k < 1 ? 0 : k === 2 ? .3 : k === 4 ? .6 : 1; })();
  const cy = 470;
  g.save(); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = 'italic 900 230px Kanit';
  const gr = g.createLinearGradient(0, cy - 190, 0, cy + 10);
  gr.addColorStop(0, '#e8f6ff'); gr.addColorStop(.46, '#7fc8ff'); gr.addColorStop(.5, '#ffffff'); gr.addColorStop(.54, '#3a2a7a'); gr.addColorStop(.8, '#ff6aa0'); gr.addColorStop(1, '#ffd08a');
  g.lineJoin = 'round';
  g.strokeStyle = '#120830'; g.lineWidth = 26; g.strokeText('CITY LIGHTS', W / 2, cy);
  g.strokeStyle = '#ff3fa4'; g.lineWidth = 10; g.strokeText('CITY LIGHTS', W / 2, cy);
  g.fillStyle = gr; g.fillText('CITY LIGHTS', W / 2, cy);
  g.restore();
  // 发光层：字的轮廓透过光
  e.save(); e.textAlign = 'center'; e.font = 'italic 900 230px Kanit'; e.lineJoin = 'round';
  e.strokeStyle = rgba('#ff3fa4', .9 * flick); e.lineWidth = 16; e.strokeText('CITY LIGHTS', W / 2, cy);
  e.fillStyle = rgba('#9fd8ff', .35 * flick); e.fillText('CITY LIGHTS', W / 2, cy); e.restore();
  // 片假名 + 年份
  g.save(); g.textAlign = 'center'; g.font = '64px "Dela Gothic One"'; g.fillStyle = '#35e7ff';
  g.fillText('シティ・ライツ', W / 2, cy - 250);
  e.font = '64px "Dela Gothic One"'; e.textAlign = 'center'; e.fillStyle = rgba('#35e7ff', .7 * flick); e.fillText('シティ・ライツ', W / 2, cy - 250);
  g.font = 'italic 900 150px Kanit'; g.fillStyle = '#ff2a3a'; g.strokeStyle = '#1a0610'; g.lineWidth = 14; g.lineJoin = 'round';
  g.strokeText('1987', W / 2 + 470, cy + 170); g.fillText('1987', W / 2 + 470, cy + 170);
  e.font = 'italic 900 150px Kanit'; e.textAlign = 'center'; e.fillStyle = rgba('#ff2a3a', .8 * flick); e.fillText('1987', W / 2 + 470, cy + 170);
  g.font = '600 34px "Barlow SC"'; g.fillStyle = rgba('#e8e0ff', .85); g.letterSpacing = '12px';
  g.fillText('A  NIGHTBIRD  DELIVERY', W / 2 - 180, cy + 150); g.letterSpacing = '0px';
  g.restore();
  // 光扫过字（片名的"光の走り"）
  if (!o.static) {
    const sx = -300 + seg(lt, .15, 1.2) * 2600;
    e.save(); e.globalCompositeOperation = 'lighter';
    const sg = e.createLinearGradient(sx - 120, 0, sx + 120, 0); sg.addColorStop(0, rgba('#ffffff', 0)); sg.addColorStop(.5, rgba('#ffffff', .75)); sg.addColorStop(1, rgba('#ffffff', 0));
    e.fillStyle = sg; e.fillRect(sx - 120, cy - 200, 240, 220); e.restore();
    // 星芒：字头的闪光
    const gl = seg(lt, 1.1, 1.6), ga = Math.sin(gl * Math.PI);
    if (ga > 0) flare(e, W / 2 - 610, cy - 170, .6 * ga, '#bfe6ff', { ghosts: false, streak: 700 });
    // 开场白闪
    if (lt < 2 / 24) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); }
  }
}
export function title(S) {
  const z = 1 + S.u * .045; for (const x of [S.g, S.e]) { x.translate(W / 2, H / 2); x.scale(z, z); x.translate(-W / 2, -H / 2); }
  titleCard(S.g, S.e, S.t, S.lt);
}
