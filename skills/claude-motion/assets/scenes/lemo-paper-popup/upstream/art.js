// 所有纸片美术：角色（可逐帧重画的姿势）+ 场景道具 + 书页
import { mulberry, TAU, clamp, lerp } from './lib.js';
import { cv, finishCut, sh, blob, smoothClosed, smoothOpen, crescent, paperFill, INK, GRAIN, rr } from './paper.js';

const LW = 9;   // 主描边
const LW2 = 5;  // 细节线

// ============ 皮普 ============
export const PIP_W = 900, PIP_H = 1120;
const SKIN = '#ffe2bd', SKIN_S = '#f3c393', LEAF = '#62c24c', LEAF_S = '#3e9a34', LEAF_V = '#2e7a27';
const TUNIC = '#3fa1de', TUNIC_S = '#2a78b3', BOOT = '#8a5530';

function pipWing(x, ang, flap, len = 330) {
  x.save(); x.translate(450, 870); x.rotate(ang);
  const w = 150 * (1 - flap * .25);
  x.beginPath(); x.moveTo(0, 0);
  x.bezierCurveTo(w, -len * .25, w * .9, -len * .9, 0, -len);
  x.bezierCurveTo(-w * .7, -len * .8, -w * .6, -len * .25, 0, 0); x.closePath();
  sh(x, '#d4f3ff', 6);
  x.beginPath(); x.moveTo(0, -12); x.quadraticCurveTo(w * .15, -len * .5, 0, -len * .88); x.lineWidth = 4; x.strokeStyle = '#8fcbe3'; x.stroke();
  x.beginPath(); x.moveTo(4, -len * .35); x.quadraticCurveTo(w * .45, -len * .45, w * .55, -len * .6); x.moveTo(3, -len * .6); x.quadraticCurveTo(w * .35, -len * .7, w * .4, -len * .82); x.stroke();
  x.restore();
}
function pipLeg(x, hx, ang, lift) {
  x.save(); x.translate(hx, 955); x.rotate(ang);
  rr(x, -24, -10, 48, 78 - lift, 20); sh(x, SKIN, LW2 + 1);
  blob(x, 16, 78 - lift, 50, 30, .03, 3); sh(x, BOOT, LW2 + 2);
  x.beginPath(); x.ellipse(24, 66 - lift, 18, 8, -.2, 0, TAU); x.fillStyle = 'rgba(255,255,255,.35)'; x.fill();
  x.restore();
}
function pipArm(x, sx, ang, side) {
  x.save(); x.translate(sx, 842); x.rotate(ang * side);
  rr(x, -19, -8, 38, 118, 19); sh(x, TUNIC, LW2 + 1);
  x.beginPath(); x.arc(0, 122, 30, 0, TAU); sh(x, SKIN, LW2 + 1);
  x.restore();
}
function pipEye(x, ex, ey, p) {
  const { blink = 0, eyes = 'open', look = [0, 0] } = p;
  if (eyes === 'happy') { x.beginPath(); x.moveTo(ex - 30, ey + 8); x.quadraticCurveTo(ex, ey - 44, ex + 30, ey + 8); x.lineWidth = 12; x.strokeStyle = INK; x.lineCap = 'round'; x.stroke(); return; }
  if (eyes === 'closed' || blink > .85) { x.beginPath(); x.moveTo(ex - 28, ey + 4); x.quadraticCurveTo(ex, ey + 18, ex + 28, ey + 4); x.lineWidth = 11; x.strokeStyle = INK; x.lineCap = 'round'; x.stroke(); return; }
  if (eyes === 'dizzy') { x.beginPath(); for (let i = 0; i < 40; i++) { const a = i * .45, r = i * .9; x.lineTo(ex + Math.cos(a) * r, ey + Math.sin(a) * r); } x.lineWidth = 7; x.strokeStyle = INK; x.stroke(); return; }
  const big = eyes === 'wide' ? 1.18 : 1, ry = 56 * big * (1 - blink * .9), rx = 29 * big;
  x.beginPath(); x.ellipse(ex + look[0] * 10, ey + look[1] * 12, rx, ry, 0, 0, TAU); x.fillStyle = INK; x.fill();
  if (ry > 20) {
    x.beginPath(); x.ellipse(ex + look[0] * 10 - 9, ey + look[1] * 12 - ry * .42, 10 * big, 16 * big, -.2, 0, TAU); x.fillStyle = '#fff'; x.fill();
    x.beginPath(); x.ellipse(ex + look[0] * 10 + 8, ey + look[1] * 12 + ry * .45, 5, 7, 0, 0, TAU); x.fill();
  }
}
export function drawPip(x, p = {}) {
  const { walk = 0, stride = 0, armL = .25, armR = .25, flap = 0, mouth = 'smile', lean = 0 } = p;
  x.clearRect(0, 0, PIP_W, PIP_H);
  const W = cv(PIP_W, PIP_H), a = W.getContext('2d');
  a.save(); a.translate(450, 1050); a.rotate(lean); a.translate(-450, -1050);
  // 翅膀
  pipWing(a, -1.2 - flap * .4, flap); pipWing(a, 1.2 + flap * .4, flap);
  // 腿
  const s = Math.sin(walk) * stride;
  pipLeg(a, 412, s * .5, Math.max(0, -Math.sin(walk)) * stride * 16);
  pipLeg(a, 488, -s * .5, Math.max(0, Math.sin(walk)) * stride * 16);
  // 身体（花瓣裙）
  const tunic = () => { a.beginPath(); a.moveTo(385, 800); a.bezierCurveTo(360, 880, 330, 930, 322, 972); a.quadraticCurveTo(360, 1000, 395, 978); a.quadraticCurveTo(450, 1008, 505, 978); a.quadraticCurveTo(540, 1000, 578, 972); a.bezierCurveTo(570, 930, 540, 880, 515, 800); a.closePath(); };
  crescent(a, tunic, TUNIC_S, 22, 0, TUNIC); tunic(); sh(a, null, LW);
  a.beginPath(); a.moveTo(450, 830); a.lineTo(450, 990); a.lineWidth = LW2; a.strokeStyle = TUNIC_S; a.stroke();
  // 腰带小叶
  a.beginPath(); a.ellipse(450, 900, 30, 17, 0, 0, TAU); sh(a, LEAF, LW2);
  // 手臂
  pipArm(a, 372, armL, 1); pipArm(a, 528, -armR, 1);
  // 头
  const head = () => { a.beginPath(); a.ellipse(450, 565, 248, 228, 0, 0, TAU); };
  crescent(a, head, SKIN_S, 34, 26, SKIN); head(); sh(a, null, LW + 1);
  // 脸（朝右偏）
  const fx = 22;
  a.beginPath(); a.ellipse(450 + fx - 128, 650, 42, 26, 0, 0, TAU); a.fillStyle = 'rgba(255,120,120,.45)'; a.fill();
  a.beginPath(); a.ellipse(450 + fx + 138, 650, 42, 26, 0, 0, TAU); a.fill();
  pipEye(a, 450 + fx - 68, 575, p); pipEye(a, 450 + fx + 78, 575, p);
  const mx = 450 + fx + 6, my = 672;
  a.lineCap = 'round'; a.strokeStyle = INK;
  if (mouth === 'smile') { a.beginPath(); a.moveTo(mx - 34, my - 4); a.quadraticCurveTo(mx, my + 30, mx + 34, my - 4); a.lineWidth = 9; a.stroke(); }
  else if (mouth === 'open' || mouth === 'grin') {
    const h = mouth === 'grin' ? 40 : 52; a.beginPath(); a.moveTo(mx - 42, my - 10); a.quadraticCurveTo(mx, my + h * 1.5, mx + 42, my - 10); a.closePath(); sh(a, '#8a2a2a', 7);
    a.save(); a.clip(); a.beginPath(); a.ellipse(mx, my + h * .8, 26, 18, 0, 0, TAU); a.fillStyle = '#ef6f6f'; a.fill(); a.restore();
  }
  else if (mouth === 'o') { a.beginPath(); a.ellipse(mx, my + 8, 16, 21, 0, 0, TAU); sh(a, '#8a2a2a', 7); }
  else if (mouth === 'worried') { a.beginPath(); a.moveTo(mx - 34, my + 10); a.bezierCurveTo(mx - 16, my - 6, mx - 4, my + 16, mx + 10, my + 2); a.quadraticCurveTo(mx + 24, my - 8, mx + 34, my + 8); a.lineWidth = 8; a.stroke(); }
  else if (mouth === 'determined') { a.beginPath(); a.moveTo(mx - 30, my + 2); a.lineTo(mx + 32, my - 4); a.lineWidth = 9; a.stroke(); }
  // 叶子帽
  const leaf = () => {
    a.beginPath(); a.moveTo(208, 548);
    a.bezierCurveTo(150, 520, 110, 470, 70, 392);          // 向后下方的叶尖
    a.bezierCurveTo(150, 410, 185, 388, 222, 372);
    a.bezierCurveTo(262, 300, 360, 262, 460, 262);
    a.bezierCurveTo(590, 262, 690, 330, 708, 440);
    a.bezierCurveTo(716, 490, 700, 520, 676, 528);
    a.bezierCurveTo(560, 492, 380, 500, 208, 548); a.closePath();
  };
  crescent(a, leaf, LEAF_S, 30, 30, LEAF); leaf(); sh(a, null, LW + 1);
  a.beginPath(); a.moveTo(96, 408); a.bezierCurveTo(260, 420, 440, 330, 650, 450); a.lineWidth = 6; a.strokeStyle = LEAF_V; a.stroke();
  for (const [x0, y0, x1, y1] of [[300, 392, 330, 300], [420, 365, 470, 285], [540, 380, 600, 310], [240, 405, 230, 470], [380, 380, 360, 470], [520, 395, 520, 480]]) { a.beginPath(); a.moveTo(x0, y0); a.quadraticCurveTo((x0 + x1) / 2 + 12, (y0 + y1) / 2, x1, y1); a.lineWidth = 4; a.stroke(); }
  // 茎
  a.beginPath(); a.moveTo(470, 268); a.bezierCurveTo(470, 220, 500, 185, 548, 190); a.bezierCurveTo(578, 194, 582, 226, 556, 232); a.lineWidth = 15; a.strokeStyle = INK; a.stroke(); a.lineWidth = 7; a.strokeStyle = '#9a6a3a'; a.stroke();
  a.restore();
  x.drawImage(finishCut(W, 16, { grainA: .7 }), 0, 0);
}

// ============ 皱皱（纸团怪） ============
export const CR_W = 760, CR_H = 760;
const CRUMPLE_PTS = (() => { const R = mulberry(41), pts = []; for (let i = 0; i < 17; i++) { const a = i / 17 * TAU + (R() - .5) * .18, r = 270 * (.82 + R() * .2); pts.push([380 + Math.cos(a) * r, 400 + Math.sin(a) * r * .92]); } return pts; })();
export function drawCrumple(x, p = {}) {
  const { mood = 'angry', blink = 0, mouthOpen = 0 } = p;
  x.clearRect(0, 0, CR_W, CR_H);
  const W = cv(CR_W, CR_H), a = W.getContext('2d'), R = mulberry(77), P = CRUMPLE_PTS;
  const body = () => { a.beginPath(); a.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) a.lineTo(P[i][0], P[i][1]); a.closePath(); };
  body(); a.fillStyle = '#f2eee4'; a.fill();
  a.save(); body(); a.clip();
  const C = [372, 392];
  for (let i = 0; i < P.length; i++) {
    const q = P[(i + 1) % P.length], m = [(P[i][0] + q[0]) / 2 + (R() - .5) * 60, (P[i][1] + q[1]) / 2 + (R() - .5) * 60];
    const tone = 214 + R() * 38 - (Math.cos(i / P.length * TAU - .8) * 18);
    a.beginPath(); a.moveTo(C[0] + (R() - .5) * 90, C[1] + (R() - .5) * 90); a.lineTo(P[i][0], P[i][1]); a.lineTo(m[0], m[1]); a.closePath();
    a.fillStyle = `rgb(${tone | 0},${(tone - 4) | 0},${(tone - 14) | 0})`; a.fill();
  }
  a.strokeStyle = 'rgba(120,105,90,.55)'; a.lineWidth = 3.5;
  for (let i = 0; i < 16; i++) { const p0 = P[(R() * P.length) | 0], p1 = [C[0] + (R() - .5) * 260, C[1] + (R() - .5) * 260]; a.beginPath(); a.moveTo(p0[0], p0[1]); a.lineTo(lerp(p0[0], p1[0], .5) + (R() - .5) * 40, lerp(p0[1], p1[1], .5) + (R() - .5) * 40); a.lineTo(p1[0], p1[1]); a.stroke(); }
  // 横线（笔记本纸）
  a.strokeStyle = 'rgba(110,150,210,.35)'; a.lineWidth = 4;
  for (let k = 0; k < 7; k++) { a.beginPath(); let y = 190 + k * 70; a.moveTo(90, y); for (let xx = 90; xx < 680; xx += 60) a.lineTo(xx, y + Math.sin(xx * .05 + k) * 12); a.stroke(); }
  a.restore();
  body(); sh(a, null, LW + 1);
  // 脸
  const ex = 395, ey = 390;
  if (mood === 'dizzy') {
    for (const dx of [-72, 72]) { a.beginPath(); for (let i = 0; i < 40; i++) { const an = i * .5, r = i * 1.1; a.lineTo(ex + dx + Math.cos(an) * r, ey + Math.sin(an) * r); } a.lineWidth = 8; a.strokeStyle = INK; a.stroke(); }
    a.beginPath(); a.moveTo(ex - 50, ey + 110); for (let i = 0; i <= 6; i++) a.lineTo(ex - 50 + i * 17, ey + 110 + (i % 2 ? -14 : 8)); a.lineWidth = 8; a.stroke();
  } else {
    for (const dx of [-72, 72]) {
      const ry = 34 * (1 - blink * .9);
      a.beginPath(); a.ellipse(ex + dx, ey + 12, 22, ry, 0, 0, TAU); a.fillStyle = INK; a.fill();
      if (ry > 10) { a.beginPath(); a.ellipse(ex + dx - 6, ey - 4, 7, 10, 0, 0, TAU); a.fillStyle = '#fff'; a.fill(); }
    }
    a.lineCap = 'round'; a.strokeStyle = INK;
    if (mood === 'angry') {
      a.lineWidth = 20; a.beginPath(); a.moveTo(ex - 120, ey - 58); a.lineTo(ex - 36, ey - 26); a.moveTo(ex + 120, ey - 58); a.lineTo(ex + 36, ey - 26); a.stroke();
      a.beginPath(); a.moveTo(ex - 58, ey + 120); a.quadraticCurveTo(ex, ey + 74 - mouthOpen * 20, ex + 58, ey + 120);
      if (mouthOpen > .05) { a.quadraticCurveTo(ex, ey + 120 + mouthOpen * 50, ex - 58, ey + 120); sh(a, '#7a2323', 8); } else { a.lineWidth = 10; a.stroke(); }
    } else {
      a.lineWidth = 10; a.beginPath(); a.moveTo(ex - 50, ey + 90); a.quadraticCurveTo(ex, ey + 130, ex + 50, ey + 90); a.stroke();
    }
  }
  x.drawImage(finishCut(W, 14, { grainA: .5 }), 0, 0);
}

// ============ 鲸鱼 ============
export function drawWhale(x, p = {}) {
  const w = x.canvas.width, h = x.canvas.height; x.clearRect(0, 0, w, h);
  const W = cv(w, h), a = W.getContext('2d');
  const body = () => { a.beginPath(); a.moveTo(140, 470); a.bezierCurveTo(130, 250, 380, 150, 640, 170); a.bezierCurveTo(900, 190, 1020, 300, 1070, 380); a.bezierCurveTo(1120, 330, 1180, 250, 1250, 230); a.bezierCurveTo(1240, 320, 1200, 380, 1170, 420); a.bezierCurveTo(1230, 440, 1290, 500, 1300, 560); a.bezierCurveTo(1220, 540, 1140, 500, 1080, 470); a.bezierCurveTo(1000, 560, 800, 620, 560, 620); a.bezierCurveTo(330, 620, 150, 580, 140, 470); a.closePath(); };
  crescent(a, body, '#2f6db0', 0, -40, '#4b90d6'); body(); sh(a, null, LW + 2);
  a.save(); body(); a.clip(); a.beginPath(); a.moveTo(150, 500); a.bezierCurveTo(400, 560, 800, 560, 1080, 470); a.lineTo(1080, 700); a.lineTo(150, 700); a.closePath(); a.fillStyle = '#cfe6f7'; a.fill();
  a.strokeStyle = '#9cc4e4'; a.lineWidth = 5; for (let i = 0; i < 6; i++) { a.beginPath(); a.moveTo(260 + i * 110, 540 + Math.sin(i) * 4); a.lineTo(280 + i * 110, 610); a.stroke(); }
  a.restore(); body(); sh(a, null, LW + 2);
  a.beginPath(); a.moveTo(150, 500); a.bezierCurveTo(400, 560, 800, 560, 1080, 470); a.lineWidth = LW2; a.strokeStyle = INK; a.stroke();
  // 眼、腮红、嘴
  if (p.happy) { a.beginPath(); a.moveTo(300, 380); a.quadraticCurveTo(330, 340, 360, 380); a.lineWidth = 11; a.lineCap = 'round'; a.stroke(); }
  else { a.beginPath(); a.ellipse(330, 370, 22, 36, 0, 0, TAU); a.fillStyle = INK; a.fill(); a.beginPath(); a.ellipse(323, 356, 8, 11, 0, 0, TAU); a.fillStyle = '#fff'; a.fill(); }
  a.beginPath(); a.ellipse(300, 440, 40, 22, 0, 0, TAU); a.fillStyle = 'rgba(255,130,150,.55)'; a.fill();
  a.beginPath(); a.moveTo(190, 470); a.quadraticCurveTo(260, 520, 360, 480); a.lineWidth = 9; a.strokeStyle = INK; a.lineCap = 'round'; a.stroke();
  // 鳍
  a.beginPath(); a.moveTo(560, 520); a.bezierCurveTo(600, 600, 660, 640, 720, 630); a.bezierCurveTo(690, 590, 660, 540, 640, 510); a.closePath(); sh(a, '#3a7cc2', LW2 + 2);
  // 喷水孔
  a.beginPath(); a.ellipse(600, 178, 30, 10, 0, 0, TAU); sh(a, '#2a5a90', LW2);
  x.drawImage(finishCut(W, 16), 0, 0);
}

// ============ 静态剪纸（一次性生成） ============
// 每个返回 {c: 画布, w,h: 米（世界尺寸）, ax,ay: 锚点(0..1)}
const PPM = 5200; // 静态道具的像素/米
function cut(wm, hm, draw, o = {}) {
  const pad = o.pad ?? 30, w = Math.ceil(wm * PPM) + pad * 2, h = Math.ceil(hm * PPM) + pad * 2;
  const c = cv(w, h), x = c.getContext('2d'); x.translate(pad, pad);
  draw(x, w - pad * 2, h - pad * 2);
  const out = o.raw ? c : finishCut(c, o.border ?? 14, o);
  return { c: out, w: w / PPM, h: h / PPM, ax: o.ax ?? .5, ay: o.ay ?? 1 - pad / h, pad };
}
export { cut, PPM };

// 山丘：宽 wm 高 hm
export function hill(wm, hm, col, shade, seed, o = {}) {
  return cut(wm, hm, (x, W, H) => {
    const R = mulberry(seed), n = o.bumps ?? 3, pts = [[0, H]];
    for (let i = 0; i <= n * 2; i++) {
      const u = i / (n * 2), top = i % 2 === 0 ? (.25 + R() * .45) : (.05 + R() * .2);
      pts.push([u * W, H * (i % 2 ? top : top + .1) + (i === 0 || i === n * 2 ? H * .35 : 0)]);
    }
    pts.push([W, H]);
    const path = () => { x.beginPath(); x.moveTo(0, H + 40); x.lineTo(pts[1][0], pts[1][1]); smoothOpen(x, pts.slice(1, -1), false); x.lineTo(W, H + 40); x.closePath(); };
    crescent(x, path, shade, 40, 30, col); path(); sh(x, null, LW);
    // 草丛纹
    x.strokeStyle = shade; x.lineWidth = 6; x.lineCap = 'round';
    for (let i = 0; i < (o.tufts ?? 10); i++) { const px = W * (.08 + R() * .84), py = H * (.45 + R() * .45); x.beginPath(); x.moveTo(px - 14, py); x.lineTo(px - 6, py - 22); x.moveTo(px, py); x.lineTo(px + 2, py - 30); x.moveTo(px + 12, py); x.lineTo(px + 12, py - 20); x.stroke(); }
    if (o.dots) { for (let i = 0; i < 14; i++) { x.beginPath(); x.arc(W * (.1 + R() * .8), H * (.5 + R() * .4), 8 + R() * 6, 0, TAU); x.fillStyle = pickc(R, o.dots); x.fill(); } }
  }, { ay: 1, ...o });
}
const pickc = (R, a) => a[(R() * a.length) | 0];

// 棒棒糖树（剪纸 + 木棍）
export function lolliTree(hm, col, shade, seed) {
  return cut(hm * .62, hm, (x, W, H) => {
    const R = mulberry(seed), r = W * .46, cy = r + 6;
    rr(x, W / 2 - 16, cy, 32, H - cy, 8); sh(x, '#a8733f', LW2 + 1);
    x.strokeStyle = '#7c5129'; x.lineWidth = 3; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(W / 2 - 6 + (i % 2) * 10, cy + 40 + i * (H - cy) / 6); x.lineTo(W / 2 - 4 + (i % 2) * 8, cy + 80 + i * (H - cy) / 6); x.stroke(); }
    const can = () => blob(x, W / 2, cy, r, r * .96, .06, seed);
    crescent(x, can, shade, 30, 26, col); can(); sh(x, null, LW);
    x.strokeStyle = shade; x.lineWidth = 6; x.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const a = R() * TAU, d = r * (.3 + R() * .45), px = W / 2 + Math.cos(a) * d, py = cy + Math.sin(a) * d; x.beginPath(); x.arc(px, py, 18, .3, 2.2); x.stroke(); }
    x.beginPath(); x.ellipse(W / 2 - r * .4, cy - r * .45, r * .22, r * .12, -.6, 0, TAU); x.fillStyle = 'rgba(255,255,255,.35)'; x.fill();
  });
}
// 松树：三层三角
export function pine(hm, col, shade, seed, tiers = 3) {
  return cut(hm * .55, hm, (x, W, H) => {
    rr(x, W / 2 - 18, H * .72, 36, H * .28, 6); sh(x, '#7d5230', LW2 + 1);
    for (let k = 0; k < tiers; k++) {
      const top = H * (.02 + k * .2), bot = H * (.38 + k * .2), hw = W * (.26 + k * .12);
      const p = () => { x.beginPath(); x.moveTo(W / 2, top); x.quadraticCurveTo(W / 2 + hw * .5, (top + bot) / 2, W / 2 + hw, bot); x.quadraticCurveTo(W / 2, bot + 26, W / 2 - hw, bot); x.quadraticCurveTo(W / 2 - hw * .5, (top + bot) / 2, W / 2, top); x.closePath(); };
      crescent(x, p, shade, 26, 0, col); p(); sh(x, null, LW);
    }
  });
}
// 灌木
export function bush(wm, hm, col, shade, seed, berries) {
  return cut(wm, hm, (x, W, H) => {
    const R = mulberry(seed), n = 4, pts = [];
    const p = () => {
      x.beginPath(); x.moveTo(0, H);
      for (let i = 0; i < n; i++) { const cx = W * (i + .5) / n, r = W / n * (.62 + R() * .1); x.arc(cx, H - r * .9 - (i % 2 ? H * .15 : 0), r, Math.PI * (1 + (i ? .05 : -.1)), Math.PI * 2 - .1 * (i < n - 1)); }
      x.lineTo(W, H); x.closePath();
    };
    const s = R; const seedR = mulberry(seed);
    const pp = () => { const RR = mulberry(seed); x.beginPath(); x.moveTo(4, H); for (let i = 0; i < n; i++) { const cx = W * (i + .5) / n, r = W / n * (.66 + RR() * .1); x.arc(cx, H * .98 - r * .95 - (i % 2 ? H * .16 : 0), r, Math.PI * 1.02, Math.PI * 1.98); } x.lineTo(W - 4, H); x.closePath(); };
    crescent(x, pp, shade, 24, 24, col); pp(); sh(x, null, LW);
    if (berries) for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(W * (.15 + seedR() * .7), H * (.35 + seedR() * .45), 14, 0, TAU); sh(x, berries, 4); }
  });
}
// 花
export function flower(hm, petal, seed) {
  return cut(hm * .5, hm, (x, W, H) => {
    const cy = W * .45;
    x.beginPath(); x.moveTo(W / 2, cy); x.quadraticCurveTo(W / 2 + 14, H * .6, W / 2, H); x.lineWidth = 12; x.strokeStyle = INK; x.stroke(); x.lineWidth = 6; x.strokeStyle = '#4ea83d'; x.stroke();
    x.beginPath(); x.ellipse(W / 2 + 30, H * .72, 34, 14, -.5, 0, TAU); sh(x, '#5cbf48', 4);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; x.beginPath(); x.ellipse(W / 2 + Math.cos(a) * W * .22, cy + Math.sin(a) * W * .22, W * .17, W * .12, a, 0, TAU); sh(x, petal, 5); }
    x.beginPath(); x.arc(W / 2, cy, W * .13, 0, TAU); sh(x, '#ffd23f', 5);
  }, { border: 10 });
}
// 蘑菇屋
export function mushHouse(hm) {
  return cut(hm * 1.0, hm, (x, W, H) => {
    // 柄
    const stem = () => { x.beginPath(); x.moveTo(W * .22, H); x.bezierCurveTo(W * .2, H * .72, W * .28, H * .56, W * .3, H * .48); x.lineTo(W * .7, H * .48); x.bezierCurveTo(W * .72, H * .56, W * .8, H * .72, W * .78, H); x.closePath(); };
    crescent(x, stem, '#e2cfa8', 34, 0, '#fbefd3'); stem(); sh(x, null, LW);
    // 门洞（门另做）
    x.beginPath(); x.moveTo(W * .38, H); x.lineTo(W * .38, H * .78); x.arc(W * .5, H * .78, W * .12, Math.PI, 0); x.lineTo(W * .62, H); x.closePath(); sh(x, '#3b2418', LW2);
    // 窗
    x.beginPath(); x.arc(W * .68, H * .7, W * .055, 0, TAU); sh(x, '#6b4a2f', LW2 + 2);
    // 帽
    const cap = () => { x.beginPath(); x.moveTo(W * .02, H * .52); x.bezierCurveTo(W * .0, H * .1, W * .3, 0, W * .5, 0); x.bezierCurveTo(W * .7, 0, W * 1.0, H * .1, W * .98, H * .52); x.quadraticCurveTo(W * .5, H * .6, W * .02, H * .52); x.closePath(); };
    crescent(x, cap, '#c23a2e', 40, 30, '#ec5140'); cap(); sh(x, null, LW + 1);
    const R = mulberry(5);
    for (const [u, v, r] of [[.2, .3, .07], [.45, .14, .08], [.72, .26, .09], [.34, .42, .05], [.86, .42, .05], [.6, .45, .045]]) { blob(x, W * u, H * v, W * r, W * r * .8, .08, (R() * 99) | 0); sh(x, '#fff7ea', LW2); }
    // 烟囱
  });
}
export function door(hm) {
  return cut(hm * .7, hm, (x, W, H) => {
    x.beginPath(); x.moveTo(0, H); x.lineTo(0, W / 2); x.arc(W / 2, W / 2, W / 2, Math.PI, 0); x.lineTo(W, H); x.closePath(); sh(x, '#a8683a', LW2 + 1);
    x.strokeStyle = '#7b4a28'; x.lineWidth = 5; for (const u of [.33, .66]) { x.beginPath(); x.moveTo(W * u, W * .1); x.lineTo(W * u, H); x.stroke(); }
    x.beginPath(); x.arc(W * .8, H * .6, 12, 0, TAU); sh(x, '#ffd23f', 4);
  }, { border: 8, ay: 1 });
}
export function windowGlow(rm) {
  return cut(rm * 2, rm * 2, (x, W, H) => {
    x.beginPath(); x.arc(W / 2, H / 2, W / 2, 0, TAU); x.fillStyle = '#ffd766'; x.fill();
    x.strokeStyle = '#6b4a2f'; x.lineWidth = 10; x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, H); x.moveTo(0, H / 2); x.lineTo(W, H / 2); x.stroke();
  }, { border: 0, grain: false, ay: .5 });
}
// 太阳（带木棍）
export function sunOnStick(rm, stickm) {
  return cut(rm * 2.6, rm * 2.6 + stickm, (x, W, H) => {
    const cx = W / 2, cy = W / 2, r = rm * PPM;
    rr(x, cx - 14, cy, 28, H - cy, 6); sh(x, '#b27a45', LW2 + 1);
    x.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, rad = i % 2 ? r * 1.08 : r * 1.28; x.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); } x.closePath(); sh(x, '#ffb52e', LW);
    const disk = () => { x.beginPath(); x.arc(cx, cy, r * .9, 0, TAU); };
    crescent(x, disk, '#ffb02a', 26, 26, '#ffd84a'); disk(); sh(x, null, LW);
    x.lineCap = 'round'; x.strokeStyle = INK; x.lineWidth = 11;
    x.beginPath(); x.moveTo(cx - r * .42, cy - r * .05); x.quadraticCurveTo(cx - r * .28, cy - r * .22, cx - r * .14, cy - r * .05); x.moveTo(cx + r * .14, cy - r * .05); x.quadraticCurveTo(cx + r * .28, cy - r * .22, cx + r * .42, cy - r * .05); x.stroke();
    x.beginPath(); x.moveTo(cx - r * .25, cy + r * .25); x.quadraticCurveTo(cx, cy + r * .48, cx + r * .25, cy + r * .25); x.stroke();
    x.beginPath(); x.ellipse(cx - r * .55, cy + r * .2, r * .14, r * .08, 0, 0, TAU); x.ellipse(cx + r * .55, cy + r * .2, r * .14, r * .08, 0, 0, TAU); x.fillStyle = 'rgba(255,110,80,.45)'; x.fill();
  }, { ay: 1 });
}
export function cloud(wm, seed, col = '#ffffff') {
  return cut(wm, wm * .55, (x, W, H) => {
    const p = () => { x.beginPath(); x.moveTo(W * .1, H * .9); x.arc(W * .22, H * .66, H * .28, Math.PI * .6, Math.PI * 1.55); x.arc(W * .45, H * .42, H * .38, Math.PI * 1.1, Math.PI * 1.85); x.arc(W * .72, H * .5, H * .32, Math.PI * 1.25, Math.PI * .1); x.arc(W * .82, H * .72, H * .2, Math.PI * 1.6, Math.PI * .5); x.closePath(); };
    crescent(x, p, '#d7e6f2', 0, -22, col); p(); sh(x, null, LW);
  }, { ay: 0 });
}
export function sign(wm, text, font = '700 120px Fredoka') {
  return cut(wm, wm * .75, (x, W, H) => {
    rr(x, W / 2 - 20, H * .3, 40, H * .7, 8); sh(x, '#8d5a31', LW2 + 1);
    const b = () => { x.beginPath(); x.moveTo(W * .04, H * .08); x.lineTo(W * .96, H * .04); x.lineTo(W * .98, H * .5); x.lineTo(W * .02, H * .54); x.closePath(); };
    crescent(x, b, '#b98150', 0, 20, '#d9a36c'); b(); sh(x, null, LW);
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#5a3417'; x.save(); x.translate(W / 2, H * .29); x.rotate(-.025);
    let fs = parseInt(font.match(/(\d+)px/)[1]); while (x.measureText(text).width > W * .82 && fs > 20) { fs -= 4; x.font = font.replace(/\d+px/, fs + 'px'); }
    x.fillText(text, 0, 0); x.restore();
  });
}
export function fence(wm, hm) {
  return cut(wm, hm, (x, W, H) => {
    rr(x, 0, H * .35, W, H * .12, 6); sh(x, '#fff3dc', LW2); rr(x, 0, H * .68, W, H * .12, 6); sh(x, '#fff3dc', LW2);
    const n = Math.max(3, Math.round(W / 70));
    for (let i = 0; i < n; i++) { const px = (i + .5) / n * W, pw = W / n * .5; x.beginPath(); x.moveTo(px - pw / 2, H); x.lineTo(px - pw / 2, H * .12); x.lineTo(px, 0); x.lineTo(px + pw / 2, H * .12); x.lineTo(px + pw / 2, H); x.closePath(); sh(x, '#fffaf0', LW2 + 1); }
  }, { border: 10 });
}
// 波浪条：宽 wm，高 hm；顶边扇形浪 + 白浪花
export function waveStrip(wm, hm, col, dark, seed, n = 9) {
  return cut(wm, hm, (x, W, H) => {
    const p = () => { x.beginPath(); x.moveTo(0, H + 30); x.lineTo(0, H * .45); for (let i = 0; i < n; i++) { const x0 = W * i / n, x1 = W * (i + 1) / n; x.bezierCurveTo(x0 + (x1 - x0) * .25, H * .0, x0 + (x1 - x0) * .7, H * .0, x1 - (x1 - x0) * .08, H * .38); x.quadraticCurveTo(x1 - (x1 - x0) * .2, H * .2, x1 - (x1 - x0) * .02, H * .45); } x.lineTo(W, H + 30); x.closePath(); };
    crescent(x, p, dark, 0, -30, col); p(); sh(x, null, LW);
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 9; x.lineCap = 'round';
    for (let i = 0; i < n; i++) { const x0 = W * i / n, x1 = W * (i + 1) / n; x.beginPath(); x.moveTo(x0 + (x1 - x0) * .2, H * .32); x.bezierCurveTo(x0 + (x1 - x0) * .35, H * .12, x0 + (x1 - x0) * .6, H * .12, x0 + (x1 - x0) * .72, H * .26); x.stroke(); }
    const R = mulberry(seed); x.strokeStyle = dark; x.lineWidth = 6;
    for (let i = 0; i < n * 1.5; i++) { const px = R() * W, py = H * (.55 + R() * .35); x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 20, py - 12, px + 40, py); x.stroke(); }
  }, { ay: 1 });
}
export function boat(wm, part = 'all') {
  return cut(wm, wm * .62, (x, W, H) => {
    if (part !== 'hull') {
      const sail = () => { x.beginPath(); x.moveTo(W * .5, 0); x.lineTo(W * .72, H * .58); x.lineTo(W * .28, H * .58); x.closePath(); };
      crescent(x, sail, '#e8a43a', 30, 0, '#ffc85a'); sail(); sh(x, null, LW);
      x.beginPath(); x.moveTo(W * .5, 8); x.lineTo(W * .5, H * .58); x.lineWidth = 4; x.strokeStyle = '#c98a2a'; x.stroke();
    }
    if (part !== 'sail') {
      const hull = () => { x.beginPath(); x.moveTo(0, H * .52); x.lineTo(W, H * .52); x.lineTo(W * .8, H); x.lineTo(W * .2, H); x.closePath(); };
      crescent(x, hull, '#c9382e', 0, -26, '#e8513f'); hull(); sh(x, null, LW);
      x.beginPath(); x.moveTo(W * .28, H * .52); x.lineTo(W * .2, H); x.moveTo(W * .72, H * .52); x.lineTo(W * .8, H); x.lineWidth = 4; x.strokeStyle = '#a82a22'; x.stroke();
    }
  }, { ay: 1 });
}
export function moon(rm) {
  return cut(rm * 2, rm * 2, (x, W, H) => {
    const p = () => { x.beginPath(); x.arc(W / 2, H / 2, W * .46, -Math.PI * .62, Math.PI * .62, true); x.arc(W * .66, H * .45, W * .38, Math.PI * .7, -Math.PI * .75, false); x.closePath(); };
    crescent(x, p, '#f0c94a', 16, 16, '#ffe680'); p(); sh(x, null, LW);
    x.beginPath(); x.moveTo(W * .2, H * .46); x.quadraticCurveTo(W * .26, H * .52, W * .32, H * .46); x.lineWidth = 9; x.strokeStyle = INK; x.lineCap = 'round'; x.stroke();
    x.beginPath(); x.moveTo(W * .24, H * .64); x.quadraticCurveTo(W * .3, H * .69, W * .36, H * .62); x.stroke();
  }, { ay: 0 });
}
export function star(rm, col = '#ffe35a') {
  return cut(rm * 2, rm * 2, (x, W, H) => {
    const p = () => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU, r = (i % 2 ? .42 : 1) * W / 2 * .96; x.lineTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r * 1.02); } x.closePath(); };
    crescent(x, p, '#f2b92e', 12, 12, col); p(); sh(x, null, LW - 2);
  }, { ay: 0, border: 10 });
}
export function island(wm) {
  return cut(wm, wm * .7, (x, W, H) => {
    const g = () => { x.beginPath(); x.moveTo(0, H); x.quadraticCurveTo(W * .5, H * .55, W, H); x.closePath(); };
    crescent(x, g, '#d8b56a', 20, 10, '#f0d38a'); g(); sh(x, null, LW);
    x.beginPath(); x.moveTo(W * .5, H * .76); x.quadraticCurveTo(W * .54, H * .45, W * .6, H * .22); x.lineWidth = 22; x.strokeStyle = INK; x.stroke(); x.lineWidth = 12; x.strokeStyle = '#a0703c'; x.stroke();
    for (let i = 0; i < 5; i++) { const a = -Math.PI * (.05 + i * .22); x.beginPath(); x.moveTo(W * .6, H * .22); x.quadraticCurveTo(W * .6 + Math.cos(a) * W * .18, H * .22 + Math.sin(a) * W * .14 - 20, W * .6 + Math.cos(a) * W * .32, H * .22 + Math.sin(a) * W * .1 + 40); x.lineWidth = 26; x.strokeStyle = INK; x.stroke(); x.lineWidth = 16; x.strokeStyle = '#4fae45'; x.stroke(); }
  });
}
export function mushroom(hm, col, seed) {
  return cut(hm * .9, hm, (x, W, H) => {
    rr(x, W * .38, H * .4, W * .24, H * .6, 20); sh(x, '#fbefd3', LW2 + 1);
    const cap = () => { x.beginPath(); x.moveTo(W * .02, H * .5); x.bezierCurveTo(W * .02, H * .05, W * .98, H * .05, W * .98, H * .5); x.quadraticCurveTo(W * .5, H * .58, W * .02, H * .5); x.closePath(); };
    crescent(x, cap, shadeOf(col), 26, 18, col); cap(); sh(x, null, LW);
    const R = mulberry(seed); for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(W * (.25 + i * .25), H * (.26 + R() * .1), W * .06, 0, TAU); sh(x, '#fff7ea', 4); }
  });
}
export function log(wm) {
  return cut(wm, wm * .32, (x, W, H) => {
    rr(x, H * .2, H * .1, W - H * .4, H * .9, H * .4); sh(x, '#9a6236', LW);
    x.strokeStyle = '#6d4222'; x.lineWidth = 5; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(W * (.2 + i * .18), H * .3); x.lineTo(W * (.3 + i * .18), H * .35); x.stroke(); }
    x.beginPath(); x.ellipse(W - H * .45, H * .55, H * .3, H * .44, 0, 0, TAU); sh(x, '#e8c28e', LW2 + 2);
    x.beginPath(); x.ellipse(W - H * .45, H * .55, H * .15, H * .22, 0, 0, TAU); x.lineWidth = 4; x.strokeStyle = '#b88a5a'; x.stroke();
  });
}
export function fern(hm, seed) {
  return cut(hm * .9, hm, (x, W, H) => {
    const R = mulberry(seed);
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * .42, len = H * (.75 + R() * .2);
      const ex = W / 2 + Math.cos(a) * len, ey = H + Math.sin(a) * len;
      x.beginPath(); x.moveTo(W / 2, H); x.quadraticCurveTo(W / 2 + Math.cos(a) * len * .4, H + Math.sin(a) * len * .6, ex, ey); x.lineWidth = 16; x.strokeStyle = INK; x.stroke();
      for (let i = 1; i < 8; i++) { const u = i / 8, px = lerp(W / 2, ex, u), py = lerp(H, ey, u), l = (1 - u) * W * .16 + 14; for (const sgn of [-1, 1]) { x.beginPath(); x.ellipse(px + sgn * l * .5 * Math.cos(a + Math.PI / 2), py + sgn * l * .5 * Math.sin(a + Math.PI / 2), l * .55, l * .22, a + Math.PI / 2 * sgn * .8, 0, TAU); sh(x, k % 2 ? '#3f9a44' : '#4fae4c', 4); } }
      x.beginPath(); x.moveTo(W / 2, H); x.quadraticCurveTo(W / 2 + Math.cos(a) * len * .4, H + Math.sin(a) * len * .6, ex, ey); x.lineWidth = 6; x.strokeStyle = '#2f7a33'; x.stroke();
    }
  });
}
// 铅笔草图（最后一页）：白纸 + 灰铅笔线，未上色
export function sketchTree(hm) {
  return cut(hm * .7, hm, (x, W, H) => {
    x.fillStyle = '#fbf6ea'; blob(x, W / 2, W * .4, W * .42, W * .38, .06, 3); x.fill(); rr(x, W / 2 - 16, W * .7, 32, H - W * .7, 6); x.fill();
    pencil(x, () => blob(x, W / 2, W * .4, W * .42, W * .38, .06, 3), 3);
    pencil(x, () => { x.beginPath(); x.moveTo(W / 2 - 16, H); x.lineTo(W / 2 - 14, W * .74); x.moveTo(W / 2 + 16, H); x.lineTo(W / 2 + 14, W * .74); }, 2);
    x.strokeStyle = 'rgba(80,80,90,.35)'; x.lineWidth = 3; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(W * .2 + i * 16, W * .2 + i * 6); x.lineTo(W * .1 + i * 16, W * .5 + i * 6); x.stroke(); }
  }, { border: 8, edge: '#cfc8ba' });
}
export function sketchHouse(hm) {
  return cut(hm * .9, hm, (x, W, H) => {
    x.fillStyle = '#fbf6ea'; x.fillRect(W * .12, H * .42, W * .76, H * .58); x.beginPath(); x.moveTo(W * .04, H * .45); x.lineTo(W * .5, H * .04); x.lineTo(W * .96, H * .45); x.fill();
    pencil(x, () => { x.beginPath(); x.rect(W * .12, H * .42, W * .76, H * .58); x.moveTo(W * .04, H * .45); x.lineTo(W * .5, H * .04); x.lineTo(W * .96, H * .45); x.rect(W * .42, H * .7, W * .16, H * .3); }, 3);
  }, { border: 8, edge: '#cfc8ba' });
}
function pencil(x, pathFn, passes = 2) {
  for (let i = 0; i < passes; i++) { x.save(); x.translate((i - 1) * 2.5, (i % 2) * 2); pathFn(); x.lineWidth = 4.5 - i; x.strokeStyle = `rgba(70,72,82,${.55 - i * .12})`; x.lineCap = 'round'; x.stroke(); x.restore(); }
}
export { pencil };
function shadeOf(hex) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255, f = .78; return `rgb(${r * f | 0},${g * f | 0},${b * f | 0})`; }
export { shadeOf };

// 叶子（飘落粒子）
export function leafBit(col) {
  return cut(.006, .004, (x, W, H) => { x.beginPath(); x.ellipse(W / 2, H / 2, W / 2, H / 2 * .9, 0, 0, TAU); sh(x, col, 5); x.beginPath(); x.moveTo(4, H / 2); x.lineTo(W - 4, H / 2); x.lineWidth = 3; x.strokeStyle = shadeOf(col); x.stroke(); }, { border: 6, ay: .5, pad: 14 });
}
// 感叹号小牌
export function bang() {
  return cut(.012, .016, (x, W, H) => {
    x.font = `900 ${H * 1.05}px "Lilita One"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 16; x.strokeStyle = INK; x.strokeText('!', W / 2, H * .55); x.fillStyle = '#ff4b3a'; x.fillText('!', W / 2, H * .55);
  }, { border: 12, ay: 1 });
}

// 皮普背面（从身后看：后脑勺、叶子帽、翅膀在前）
export function drawPipBack(x, p = {}) {
  const { walk = 0, stride = 0, armL = .25, armR = .25, flap = 0 } = p;
  x.clearRect(0, 0, PIP_W, PIP_H);
  const W = cv(PIP_W, PIP_H), a = W.getContext('2d');
  const s = Math.sin(walk) * stride;
  pipLeg(a, 412, s * .5, Math.max(0, -Math.sin(walk)) * stride * 16);
  pipLeg(a, 488, -s * .5, Math.max(0, Math.sin(walk)) * stride * 16);
  pipArm(a, 372, armL, 1); pipArm(a, 528, -armR, 1);
  const tunic = () => { a.beginPath(); a.moveTo(385, 800); a.bezierCurveTo(360, 880, 330, 930, 322, 972); a.quadraticCurveTo(360, 1000, 395, 978); a.quadraticCurveTo(450, 1008, 505, 978); a.quadraticCurveTo(540, 1000, 578, 972); a.bezierCurveTo(570, 930, 540, 880, 515, 800); a.closePath(); };
  crescent(a, tunic, TUNIC_S, -22, 0, TUNIC); tunic(); sh(a, null, LW);
  const head = () => { a.beginPath(); a.ellipse(450, 565, 248, 228, 0, 0, TAU); };
  crescent(a, head, SKIN_S, -30, 26, SKIN); head(); sh(a, null, LW + 1);
  // 后脑的一撮头发
  a.beginPath(); a.moveTo(330, 700); a.quadraticCurveTo(450, 760, 570, 700); a.quadraticCurveTo(450, 730, 330, 700); sh(a, '#f0a24a', 5);
  const leaf = () => {
    a.beginPath(); a.moveTo(200, 600);
    a.bezierCurveTo(150, 540, 110, 470, 70, 392);
    a.bezierCurveTo(150, 410, 185, 388, 222, 372);
    a.bezierCurveTo(262, 290, 360, 250, 460, 250);
    a.bezierCurveTo(600, 250, 700, 330, 712, 460);
    a.bezierCurveTo(716, 540, 700, 600, 690, 620);
    a.bezierCurveTo(560, 560, 360, 560, 200, 600); a.closePath();
  };
  crescent(a, leaf, LEAF_S, -30, 30, LEAF); leaf(); sh(a, null, LW + 1);
  a.beginPath(); a.moveTo(96, 408); a.bezierCurveTo(260, 420, 440, 330, 660, 480); a.lineWidth = 6; a.strokeStyle = LEAF_V; a.stroke();
  a.beginPath(); a.moveTo(460, 256); a.bezierCurveTo(460, 210, 490, 175, 538, 180); a.bezierCurveTo(568, 184, 572, 216, 546, 222); a.lineWidth = 15; a.strokeStyle = INK; a.stroke(); a.lineWidth = 7; a.strokeStyle = '#9a6a3a'; a.stroke();
  pipWing(a, -1.05 - flap * .4, flap); pipWing(a, 1.05 + flap * .4, flap);
  x.drawImage(finishCut(W, 16, { grainA: .7 }), 0, 0);
}
