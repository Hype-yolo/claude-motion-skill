// BOSS 关 LAND IT!：一个画面里混多种画风——孔版天空、蜡笔地球/大海、蓝图返回舱、ASCII 高度表、像素小伞、水墨大伞、瑞士红圆落点；舱窗里是"家"画风的 Dot
// 视觉焦点只允许一个：伞 → 舱 → 红圆（高度表缩小放右上角，海鸥已删）
import { P, K, setCtx } from './toon.js';
import * as RS from './g_riso.js';
import * as CRY from './g_crayon.js';
import * as INK from './g_ink.js';
import * as AS from './g_ascii.js';
import * as PX from './g_pixel.js';
import * as BL from './g_blue.js';
import { SW } from './g_swiss.js';
import { drawDot } from './chars.js';
import { command } from './hud.js';
import { clamp, seg, eo, ei, ss, lerp, mulberry, vnoise } from '/core/lib.js';
const TAU = Math.PI * 2, B = .375;
// Boss 本地时间点（160 BPM，1 小节 1.5s）
export const BT = { pull: 3.0, pop: 3.375, err: 3.75, shatter: 3.9, zoom: 4.5, dust: 4.548, idea: 5.0, ah1: 5.25, ah2: 5.625, achoo: 6.0, canopy: 7.5, sea: 7.5, land: 10.5, clear: 11.25, end: 12 };

// ───────── 背景：孔版天空（再入 = 深蓝→粉；下降 = 黄昏）─────────
export function risoSky(g, o = {}) {
  RS.clearRiso();
  const re = o.mode === 'reentry';
  const bands = re ? [[0, .95, 0, .25], [230, .75, 0, .45], [420, .45, .1, .7], [600, .15, .45, .6]]
    : [[0, 0, .15, .72], [250, 0, .35, .55], [430, 0, .6, .38], [580, 0, .85, .2]];
  for (const [y, b, yy, p] of bands) RS.shape(gg => gg.rect(0, y, 1920, 1080), b, yy, p);
  if (!re) RS.shape(RS.C_(o.sunX ?? 420, o.sunY ?? 720, 230), 0, 1, .55);
  else for (let i = 0; i < 40; i++) { const r = mulberry(i + 9); RS.shape(RS.C_(r() * 1920, r() * 360, 2 + r() * 3), 0, 1, 0); }
  const r = mulberry(5), off = o.cloudOff || 0;
  for (let i = 0; i < 6; i++) {
    let cx = r() * 2400 - 240, cy = 120 + r() * 480; const s = .6 + r() * .8;
    if (re) cy = ((cy - off * (1 + i * .2)) % 1300 + 1300) % 1300 - 160; else cx = ((cx - off * (1 + i * .15)) % 2400 + 2400) % 2400 - 240;
    RS.shape(gg => { for (let k = 0; k < 4; k++) gg.ellipse(cx + (k - 1.5) * 70 * s, cy - (k % 2) * 26 * s, 90 * s, 50 * s, 0, 0, TAU); }, 0, 0, 0);
    RS.shape(gg => gg.ellipse(cx, cy + 30 * s, 190 * s, 20 * s, 0, 0, TAU), .22, 0, 0);
  }
  if (o.flame) {   // 再入等离子：黄 + 粉叠印的火舌，从隔热罩往上翻卷
    const [fx, fy, w, t] = o.flame;
    for (let i = 0; i < 9; i++) { const u = (i - 4) / 4, ph = t * 11 + i * 1.9, len = (260 + 120 * Math.sin(ph)) * (1 - Math.abs(u) * .4);
      RS.shape(gg => { gg.moveTo(fx + u * w - 40, fy); gg.quadraticCurveTo(fx + u * w * 1.3 + Math.sin(ph) * 30, fy - len * .5, fx + u * w * 1.5, fy - len); gg.quadraticCurveTo(fx + u * w * 1.1 + 20, fy - len * .4, fx + u * w + 40, fy); gg.closePath(); }, 0, 1, .55 + .35 * (i % 2), false); }
    RS.shape(gg => gg.ellipse(fx, fy + 30, w * 1.35, 95, 0, 0, TAU), 0, 1, .9);
    RS.shape(gg => gg.ellipse(fx, fy + 30, w * 1.0, 55, 0, 0, TAU), 0, .7, .15);
  }
  RS.print(g, { kick: o.kick || 0, seed: 7 });
}
// ───────── 蜡笔地球（再入时脚下的大弧）─────────
export function crayonEarth(g, top, rot, boil) {
  CRY.clearCrayon(boil);
  const R = 1700, cx = 960, cy = top + R;
  const disc = CRY.circlePts(cx, cy, R, R, 120);
  CRY.hatch(disc.filter(p => p[1] < 1200).concat([[1920 + 300, 1300], [-300, 1300]]), { col: CRY.CR.white, p: 1, seed: 100, gap: 7, lw: 12 });
  CRY.hatch(disc.filter(p => p[1] < 1200).concat([[1920 + 300, 1300], [-300, 1300]]), { col: CRY.CR.sky, p: .95, seed: 101, gap: 9, lw: 12, ang: -.25 });
  // 大陆：几团绿色（随自转平移）
  const r = mulberry(3);
  for (let i = 0; i < 5; i++) {
    const x = ((r() * 2600 - rot) % 2600 + 2600) % 2600 - 340, y = top + 60 + r() * 260, w = 160 + r() * 200, h = 50 + r() * 60;
    const pts = []; for (let k = 0; k <= 16; k++) { const a = k / 16 * TAU; pts.push([x + Math.cos(a) * w * (1 + .25 * Math.sin(a * 3 + i)), y + Math.sin(a) * h * (1 + .2 * Math.cos(a * 2 + i))]); }
    CRY.hatch(pts, { col: CRY.CR.green, p: .9, seed: 110 + i, gap: 9 }); CRY.cline(pts, { w: 5, col: CRY.CR.green, seed: 120 + i });
  }
  // 云（白蜡涡）
  for (let i = 0; i < 4; i++) { const x = ((i * 520 + 200 - rot * 1.3) % 2300 + 2300) % 2300 - 200, y = top + 90 + i * 60; const pts = []; for (let k = 0; k < 30; k++) { const a = k * .4; pts.push([x + Math.cos(a) * (10 + k * 4), y + Math.sin(a) * (4 + k * 1.5)]); } CRY.cline(pts, { w: 9, col: CRY.CR.white, seed: 130 + i, p: 1 }); }
  CRY.cline(disc.filter(p => p[1] < 1150), { w: 9, col: CRY.CR.ink, seed: 140 });
  CRY.print(g, { layer: true });
}
// ───────── 蜡笔大海（不透明，只在海平面以下）＋ 水花 ─────────
export function crayonSea(g, o = {}) {
  CRY.clearCrayon(o.boil || 0);
  const top = o.top ?? 740;
  if (top >= 1080) return;
  CRY.hatch([[0, top], [1920, top], [1920, 1080], [0, 1080]], { col: CRY.CR.sky, p: .95, seed: 90, ang: -.15, gap: 9, lw: 12 });
  CRY.hatch([[0, top + 120], [1920, top + 120], [1920, 1080], [0, 1080]], { col: CRY.CR.violet, p: .45, seed: 91, ang: .3, gap: 14 });
  for (let i = 0; i < 9; i++) { const y = top + 30 + i * 38, ph = (o.wave || 0) * (1 + i * .1); if (y > 1080) break; const pts = []; for (let x = -40; x <= 1960; x += 40) pts.push([x, y + Math.sin(x * .02 + ph + i) * 7]); CRY.cline(pts, { w: 5, col: CRY.CR.ink, p: .6, seed: 92 + i }); }
  CRY.cline([[0, top], [1920, top]], { w: 8, col: CRY.CR.ink, seed: 99 });
  if (o.splash) {   // 落水：白蜡 + 天蓝的水柱向上甩
    const [sx, sy, p] = o.splash, r = mulberry(77);
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (r() - .5) * 2.4, l = (120 + r() * 240) * eo(p) * (1 - .35 * seg(p, .6, 1)), w = 14 + r() * 16;
      const x0 = sx + Math.cos(a) * 60, y0 = sy + Math.sin(a) * 14;
      CRY.cline([[x0, y0], [x0 + Math.cos(a) * l * .5, y0 + Math.sin(a) * l * .6 - 20], [x0 + Math.cos(a) * l, y0 + Math.sin(a) * l + l * .3 * p]], { w, col: i % 3 ? CRY.CR.white : CRY.CR.sky, p: 1, seed: 150 + i });
    }
    for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + (r() - .5) * 2.8, d = (160 + r() * 260) * eo(p); const pts = CRY.circlePts(sx + Math.cos(a) * d, sy + Math.sin(a) * d * .8 + d * d * .002 * p, 10 + r() * 8); CRY.cfill(pts, CRY.CR.white, { p: 1, seed: 170 + i, gap: 6, lw: 8 }); CRY.cline(pts, { w: 4, col: CRY.CR.sky, seed: 180 + i }); }
  }
  g.save(); g.beginPath(); g.rect(0, top - 6, 1920, 1100); g.clip(); CRY.print(g); g.restore();
  if (o.splash) { g.save(); g.beginPath(); g.rect(0, 0, 1920, top - 6); g.clip(); CRY.print(g, { layer: true }); g.restore(); }
}
// ───────── 瑞士红圆落点 ─────────
export function swissTarget(g, x, y, rx, o = {}) {
  g.save(); g.globalAlpha = o.alpha ?? 1;
  g.fillStyle = SW.red; g.beginPath(); g.ellipse(x, y, rx, rx * .28, 0, 0, TAU); g.fill();
  g.strokeStyle = SW.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(x - rx - 60, y); g.lineTo(x + rx + 60, y); g.moveTo(x, y - rx * .28 - 40); g.lineTo(x, y + rx * .28 + 30); g.stroke();
  g.font = '600 22px Inter'; g.fillStyle = SW.ink; g.fillText('target — the red circle from rule 7', x + rx + 20, y - 14);
  g.restore();
}
// ───────── 水墨伞：一滴墨 → 墨团 → 扇形伞瓣（浓淡相间、伞沿波浪、边缘飞白）─────────
// C = 屏幕坐标变换函数，hem = [x,y] 伞沿中心（世界），R = 伞半宽，H = 伞高，grow = 0..1，capTop = 舱顶（世界）
export function inkCanopy(g, C, hem, R, H, grow, capTop, o = {}) {
  INK.clearInk();
  const z = o.z || 1, q = clamp(grow);
  if (q <= 0) { INK.print(g, { layer: true }); return; }
  const [hx, hy] = C(hem[0], hem[1]), [tx, ty] = C(capTop[0], capTop[1]);
  const Rz = R * z, Hz = H * z;
  const cen = [hx, hy - Hz * .45];
  // 1) 墨滴从舱顶喷出（0–.1）
  if (q < .16) {
    const u = eo(q / .1), px = lerp(tx, cen[0], u), py = lerp(ty, cen[1], u);
    INK.stroke([[tx, ty], [lerp(tx, px, .5), lerp(ty, py, .5) + 10], [px, py]], { w: 22 * z, tone: .9, dry: .15, wet: true, prof: 'nail', seed: 400 });
    INK.blot(px, py, (18 + 60 * seg(q, .08, .16)) * z, .9, 401, true, .3);
  }
  // 2) 圆墨滴洇开（.1–.3），3) 墨滴横向摊开成伞形、伞瓣分开（.28–1）
  const fan = ss(seg(q, .28, .85));
  if (q >= .08 && fan < .3) {
    const br = lerp(30, Rz * .32, eo(seg(q, .08, .28)));
    INK.blot(cen[0], cen[1], br * (1 + fan * 1.2), .85 * (1 - fan / .3), 402, true, .1);
  }
  if (fan > 0) {
    const N = 9, rx = Rz * (.36 + .64 * fan), ry = Hz * (.5 + .5 * fan), apex = [hx, hy - ry];
    const ix = INK.ix; ix.save(); ix.globalCompositeOperation = 'lighter';
    const split = seg(q, .45, .85);   // 伞瓣缝逐渐出现
    for (let i = 0; i < N; i++) {
      const a0 = Math.PI + i / N * Math.PI, a1 = Math.PI + (i + 1) / N * Math.PI;
      const gap = .007 * split;
      const e = Math.abs((i + .5) / N - .5) * 2;   // 0 = 中心，1 = 边
      const top = (.82 - .3 * e - (i % 2 ? .07 * split : 0)) * (.5 + .5 * fan), bot = top * .5;
      const pA = [hx + Math.cos(a0 + gap) * rx, hy + Math.sin(a0 + gap) * ry], pB = [hx + Math.cos(a1 - gap) * rx, hy + Math.sin(a1 - gap) * ry];
      const gr = ix.createLinearGradient(0, apex[1], 0, hy + 30 * z);
      gr.addColorStop(0, `rgba(255,0,0,${top})`); gr.addColorStop(1, `rgba(255,0,0,${bot})`);
      ix.beginPath(); ix.moveTo(apex[0], apex[1] + 2);
      for (let k = 0; k <= 10; k++) { const a = a0 + gap + (a1 - a0 - 2 * gap) * k / 10; ix.lineTo(hx + Math.cos(a) * rx, hy + Math.sin(a) * ry); }
      ix.lineTo(pB[0], hy); ix.quadraticCurveTo((pA[0] + pB[0]) / 2, hy + 34 * z * fan, pA[0], hy);
      ix.closePath(); ix.fillStyle = gr; ix.fill();
    }
    ix.restore();
    // 伞顶轮廓：一笔饱墨弧（上浓下淡的"负笔"）
    const arcP = []; for (let k = 0; k <= 20; k++) { const a = Math.PI * 1.04 + Math.PI * .92 * k / 20; arcP.push([hx + Math.cos(a) * rx * .99, hy + Math.sin(a) * ry * .99]); }
    INK.stroke(arcP, { w: 16 * z, tone: .7, dry: .3, wet: true, prof: 'brush', seed: 420, darkSide: -1, draw: fan });
    // 伞沿：干笔飞白（每瓣一笔短扫）
    for (let i = 0; i < N; i++) { const xa = hx + Math.cos(Math.PI + i / N * Math.PI) * rx, xb = hx + Math.cos(Math.PI + (i + 1) / N * Math.PI) * rx; INK.stroke([[xa, hy - 6], [(xa + xb) / 2, hy + 22 * z * fan], [xb, hy - 6]], { w: 12 * z, tone: .6, dry: .72, prof: 'even', seed: 450 + i, draw: split }); }
    // 伞绳：干笔细线
    if (q > .7) for (let i = 0; i <= N; i++) { const a = Math.PI + i / N * Math.PI, x = hx + Math.cos(a) * rx; INK.stroke([[x, hy + 8], [tx + (i - N / 2) * 5, ty]], { w: 3 * z, tone: .6, dry: .4, prof: 'even', seed: 440 + i, draw: seg(q, .7, 1) }); }
  }
  // 喷出瞬间的甩墨点（只在前半段）
  if (q < .6) INK.splatter(cen[0], cen[1], Rz * 1.2, seg(q, .05, .5), 230, 18, .7);
  if (o.dust) INK.dust(...o.dust);
  INK.print(g, { layer: true });
}
// ───────── 蓝图返回舱（C = 世界→屏幕，z = 缩放）─────────
export function blueCapsule(g, cx, cy, s, o = {}) {
  const w0 = 90 * s, w1 = 150 * s, h = 170 * s;
  g.save();
  g.fillStyle = '#e9eef5';
  g.beginPath(); g.moveTo(cx - w0 - 10, cy - h / 2 - 10); g.lineTo(cx + w0 + 10, cy - h / 2 - 10); g.lineTo(cx + w1 + 12, cy + h / 2 + 6); g.quadraticCurveTo(cx, cy + h / 2 + 70 * s, cx - w1 - 12, cy + h / 2 + 6); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(cx - w0, cy - h / 2); g.lineTo(cx + w0, cy - h / 2); g.lineTo(cx + w1, cy + h / 2); g.quadraticCurveTo(cx, cy + h / 2 + 60 * s, cx - w1, cy + h / 2); g.closePath(); g.clip();
  BL.paper(g);
  g.restore();
  BL.setDraw(1);
  const L = BL.WT, k = Math.max(1, s / 1.35) * .9;
  BL.bl(g, [[cx - w0, cy - h / 2], [cx + w0, cy - h / 2], [cx + w1, cy + h / 2]], L.out * k);
  BL.bl(g, [[cx - w0, cy - h / 2], [cx - w1, cy + h / 2]], L.out * k);
  const shield = []; for (let i = 0; i <= 30; i++) { const u = i / 30; shield.push([lerp(cx - w1, cx + w1, u), cy + h / 2 + Math.sin(u * Math.PI) * 60 * s]); }
  BL.bl(g, shield, L.out * k); BL.bl(g, [[cx - w1, cy + h / 2], [cx + w1, cy + h / 2]], L.det * k);
  for (let i = 1; i < 9; i++) { const u = i / 9; BL.bl(g, [[lerp(cx - w1, cx + w1, u) - 12 * s / 1.35, cy + h / 2 + 4], [lerp(cx - w1, cx + w1, u) + 8 * s / 1.35, cy + h / 2 + Math.sin(u * Math.PI) * 56 * s]], L.hair * k); }
  BL.bl(g, [[cx, cy - h / 2 - 30 * s], [cx, cy + h / 2 + 80 * s]], L.hair * k, { dash: [24, 6, 5, 6] });
  BL.bl(g, BL.rectPts(cx - 36 * s, cy - h / 2 - 26 * s, 72 * s, 26 * s), L.det * k);
  BL.label(g, 'RE-ENTRY CAPSULE  SCALE 1:20', cx - w0 + 14 * s, cy - h / 2 + 20 * s, 15 * s);
  if (o.dims !== false) BL.dim(g, cx - w1, cy + h / 2 + 70 * s, cx + w1, cy + h / 2 + 70 * s, 'Ø 3.9 m', { off: 20 });
  // 舷窗 + Dot（"家"画风）
  const pr = 46 * s, px = cx, py = cy - 6 * s;
  g.save(); g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fillStyle = '#10204a'; g.fill(); g.clip();
  const ps = K.s; setCtx(g);
  g.save(); g.translate(px, py + 12 * s); g.scale(s * .72, s * .72); g.translate(0, 172);
  K.s = s * .72; drawDot(0, 0, 1, { face: o.face || 'determined', look: o.look, view: 'front', pose: 'stand', ant: o.ant || 0 });
  g.restore(); K.s = ps;
  g.restore();
  BL.bl(g, BL.arcPts(px, py, pr), L.out * k); BL.bl(g, BL.arcPts(px, py, pr + 9 * s), L.thin * k);
  return { top: [cx, cy - h / 2 - 26 * s], port: [px, py], shieldY: cy + h / 2 + 60 * s };
}
// ───────── ASCII 高度表（小，右上角）─────────
export function asciiPanel(g, alt, t, o = {}) {
  AS.clearAscii();
  const c0 = 97, r0 = 1;
  AS.type('+--------------------+', c0, r0); for (let r = 1; r <= 3; r++) { AS.type('|', c0, r0 + r); AS.type('|', c0 + 21, r0 + r); } AS.type('+--------------------+', c0, r0 + 4);
  AS.type(`ALT ${String(Math.max(0, Math.round(alt))).padStart(6, '0')} m`, c0 + 2, r0 + 1);
  const n = Math.round(clamp(Math.log10(Math.max(1, alt)) / 5.1) * 16);
  AS.type('[' + '#'.repeat(n) + '.'.repeat(16 - n) + ']', c0 + 2, r0 + 3);
  if (o.warn && Math.floor(t * 4) % 2) AS.type(' CHUTE? ', c0 + 7, r0 + 2, { inv: true });
  const out = AS.render({ flat: true, time: t });
  const x = c0 * AS.CW - 16, y = r0 * AS.CH - 12, w = 22 * AS.CW + 32, h = 5 * AS.CH + 24;
  g.save(); g.fillStyle = '#1a1030'; g.beginPath(); g.roundRect(x - 10, y - 10, w + 20, h + 20, 18); g.fill();
  g.beginPath(); g.roundRect(x, y, w, h, 12); g.clip(); g.drawImage(out, 0, 0); g.restore();
}
// 高度曲线（本地时间 → 米）
export function altAt(lt) {
  if (lt < BT.achoo) return lerp(120000, 9000, Math.pow(lt / BT.achoo, .7));
  if (lt < BT.land) return lerp(9000, 0, Math.pow((lt - BT.achoo) / (BT.land - BT.achoo), .55));
  return 0;
}
// ───────── 像素小伞 → ERR → 碎掉 ─────────
const ERR = ["###.###.###", "#...#.#.#.#", "##..##..##.", "#...#.#.#.#", "###.#.#.#.#"];
function pixelChute(g, top, lt) {
  PX.fill(0);
  const bx = Math.round(top[0] / 12), by = Math.round(top[1] / 12);
  if (lt < BT.err) {
    const u = seg(lt, BT.pop, BT.pop + .1);
    const w = Math.round(8 * u), cy = by - 14;
    for (let x = -w; x <= w; x++) for (let y = 0; y < 5; y++) { if (x * x / ((w + .5) ** 2) + (y - 4.5) ** 2 / 25 > 1) continue; PX.pset(bx + x, cy + y, (Math.floor((x + 20) / 3) % 2) ? PX.C.red : PX.C.white); }
    if (u > .5) for (const x of [-w, 0, w]) for (let y = 5; y < 14; y++) PX.pset(bx + Math.round(x * (1 - (y - 5) / 9)), cy + y, PX.C.gray);
  } else {
    const r = mulberry(12), fall = Math.max(0, lt - BT.shatter);
    for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 13; xx++) {
      const inner = yy >= 1 && yy <= 5 && xx >= 1 && xx <= 11 ? ERR[yy - 1][xx - 1] === '#' : false;
      const vx = (r() - .5) * 60, vy = -20 - r() * 30;
      const px = bx - 6 + xx + vx * fall, py = by - 16 + yy + vy * fall + 90 * fall * fall;
      PX.pset(px, py, inner ? PX.C.white : PX.C.red);
    }
  }
  PX.present(g, 0, 0, 12, 0);
}

// ───────── BOSS 全段（本地 lt 0..12）─────────
export function sceneBoss(g, lt, o = {}) {
  const T24 = lt, T12 = Math.floor(lt * 12) / 12;
  const post = lt >= BT.achoo;
  // 镜头：B4 推到舷窗，ACHOO 一拍内拉回
  let z = 1, fx = 960, fy = 540;
  const cap0 = capPos(lt);
  const port = [cap0[0], cap0[1] - 6 * 1.35];
  if (lt >= BT.zoom && lt < BT.achoo + .35) {
    const zin = eo(seg(lt, BT.zoom, BT.zoom + .25)), zout = eo(seg(lt, BT.achoo, BT.achoo + .35));
    const zz = lerp(1, 2.6, zin) * (1 - zout) + 1 * zout;
    z = zz; const m = (zz - 1) / 1.6; fx = lerp(960, port[0], clamp(m)); fy = lerp(540, port[1], clamp(m));
  }
  const C = (x, y) => [(x - fx) * z + 960, (y - fy) * z + 540];
  const shake = (!post && lt < BT.zoom) ? [(vnoise(lt * 30) - .5) * 10, (vnoise(lt * 30 + 9) - .5) * 8] : [0, 0];
  // 背景
  if (!post) {
    const sh0 = C(cap0[0] + shake[0], cap0[1] + 150 * 1.8 / 1.35 * .62 + shake[1]);
    risoSky(g, { mode: 'reentry', cloudOff: lt * 700, flame: z < 1.2 ? [sh0[0], sh0[1], 290, lt] : null });
    crayonEarth(g, lerp(800, 700, lt / BT.achoo), lt * 140, Math.floor(lt * 12));
  } else {
    const kick = Math.max(0, 1 - (lt - BT.achoo) / .35) * Math.cos((lt - BT.achoo) * 28);
    risoSky(g, { cloudOff: (lt - BT.achoo) * 60, kick });
    const seaTop = lerp(1100, 740, eo(seg(lt, BT.sea, BT.sea + 1.2)));
    const tgt = targetPos(lt);
    const sp = lt >= BT.land ? [tgt[0], tgt[1] - 10, seg(lt, BT.land, BT.land + .9)] : null;
    crayonSea(g, { top: seaTop, wave: lt * 2, boil: Math.floor(lt * 12), splash: sp });
    if (seaTop < 1060) swissTarget(g, tgt[0], tgt[1] + (seaTop - 740), 270, { alpha: 1 });
  }
  if (lt >= BT.zoom && lt < BT.achoo) { g.save(); g.fillStyle = 'rgba(10,6,30,.35)'; g.fillRect(0, 0, 1920, 1080); g.restore(); }
  // 再入火焰：干笔墨痕从隔热罩两侧往上拖（在舱后面）
  if (!post && z < 1.2) {
    INK.clearInk();
    const [sx, sy] = C(cap0[0] + shake[0], cap0[1] + 150 + shake[1]);
    for (let i = 0; i < 6; i++) { const off = (i - 2.5) * 150, ph = (lt * 2.5 + i * .37) % 1; const yy = sy - 100 - ph * 700; INK.stroke([[sx + off * 1.6, yy], [sx + off * 1.7, yy - 160]], { w: 10, tone: .45, dry: .7, prof: 'tip', seed: 500 + i }); }
    g.save(); g.globalCompositeOperation = 'multiply'; INK.print(g, { layer: true }); g.restore();
    // 隔热罩发热的孔版辉光（粉 + 黄叠印在舱下）
  }
  // 水墨伞（在舱之前画，舱压在伞绳末端上）
  const capS = lerp(1.8, 1.35, eo(seg(lt, BT.achoo, BT.achoo + .35)));
  const top = [cap0[0], cap0[1] - 85 * capS - 26 * capS];
  if (post) {
    const grow = seg(lt, BT.achoo, BT.canopy);
    const hem = [cap0[0], top[1] - 105], R = 440, H = 210;
    const land = seg(lt, BT.land, BT.land + 1.2);
    g.save(); g.globalCompositeOperation = 'multiply';
    inkCanopy(g, C, [hem[0] + land * 330, hem[1] + land * 330], R * (1 - .2 * land), H * (1 - .6 * land), grow, land > 0 ? [top[0] + 60 * land, top[1]] : top, { z });
    g.restore();
  }
  // 返回舱
  let face = 'determined', look = [0, 0], ant = Math.sin(lt * 20) * .15;
  if (lt >= BT.err) face = 'panic';
  if (lt >= BT.zoom) { face = 'neutral'; look = [.5, -.5]; }
  if (lt >= BT.dust + .1) look = [.2, .6];
  if (lt >= BT.idea) face = 'idea';
  if (lt >= BT.ah1) face = 'ah';
  if (lt >= BT.ah2) face = 'sneeze';
  if (lt >= BT.achoo) { face = 'sneeze'; ant = Math.sin((lt - BT.achoo) * 30) * Math.exp(-(lt - BT.achoo) * 3) * 1.2; }
  if (lt >= BT.achoo + .4) face = 'happy';
  if (lt >= BT.land) face = 'proud';
  if (lt >= BT.zoom && lt < BT.dust + .1) face = 'neutral';
  const [cx, cy] = C(cap0[0] + shake[0], cap0[1] + shake[1]);
  g.save();
  const sway = post ? Math.sin((lt - BT.achoo) * 2.2) * .06 * (1 - seg(lt, BT.land - .5, BT.land)) : 0;
  g.translate(cx, cy - 300 * z); g.rotate(sway); g.translate(-cx, -(cy - 300 * z));
  const info = blueCapsule(g, cx, cy, capS * z, { face, look, ant, dims: z < 1.2 && lt < BT.land });
  g.restore();
  // 灰尘：水墨的焦墨点 + 绒毛，飘到她鼻尖前（压在舷窗玻璃上）
  if (lt >= BT.dust - .05 && lt < BT.achoo) {
    const u = ss(seg(lt, BT.dust, BT.idea));
    const [dx, dy] = C(lerp(port[0] + 150, port[0] + 8, u) + Math.sin(lt * 5) * 4, lerp(port[1] - 90, port[1] + 30, u));
    INK.clearInk(); INK.dust(dx, dy, z * .6, lt);
    g.save(); g.globalCompositeOperation = 'multiply'; INK.print(g, { layer: true }); g.restore();
  }
  // 像素小伞
  if (lt >= BT.pop && lt < BT.zoom) pixelChute(g, C(top[0], top[1]), lt);
  // 高度表（小，右上角）
  if (z < 1.3) asciiPanel(g, altAt(lt), lt, { warn: lt >= BT.err && lt < BT.achoo });
  // CLEAR!
  if (lt >= BT.clear) command(g, 'CLEAR!', lt - BT.clear, 9, { burst: P.green, size: 200 });
}
// 舱的世界坐标
export function capPos(lt) {
  if (lt < BT.achoo) return [930, 470];
  const t2 = lt - BT.achoo;
  let x = 930, y = lerp(470, 600, eo(seg(lt, BT.achoo, BT.canopy)));
  if (lt >= BT.canopy) { y = lerp(600, 650, seg(lt, BT.canopy, BT.land - .6)); x = 930 + Math.sin(t2 * 1.6) * 60 * (1 - seg(lt, BT.land - 1.5, BT.land - .3)); }
  if (lt >= BT.land - .6) y = lerp(650, 830, ei(seg(lt, BT.land - .6, BT.land)));
  if (lt >= BT.land) y = 830 + Math.sin((lt - BT.land) * 5) * 10 * Math.exp(-(lt - BT.land) * 2);
  return [x, y];
}
export function targetPos(lt) {
  const u = ss(seg(lt, BT.sea, BT.land - .4));
  return [lerp(1500, 930, u), 900];
}
// 风格帧 / 测试
export function descentFrame(g, lt = 0) { sceneBoss(g, 8.6); }
export function testBoss(g, t) { sceneBoss(g, t); }
