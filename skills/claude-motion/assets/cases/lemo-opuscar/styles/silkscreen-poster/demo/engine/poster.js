// poster.js · 旅行海报版式：场景层 + 页眉 + 底部标准信息带（名称、难度、距离、用时、爬升）+ 横幅
// 所有文案来自 content.json；这里只负责排版和"怎么印上去"
import { hex2rgb, ink, wipeRegion, wipeFront, inkFinish, paperSheet, texFill, rectPath, polyPath, circlePath, ringPath, clamp, lerp, hash } from './silk.js';
import { buildScene, PW, PH, ART } from './scenes.js';

export { PW, PH, ART };
const FONT_D = 'BigShoulders', FONT_T = 'Outfit';
const LEVEL = { easy: 1, moderate: 2, hard: 3, expert: 3 };

function fitFont(ctx, text, weight, family, maxW, maxS, minS, ls = 0) {
  let s = maxS;
  for (; s > minS; s -= 2) { ctx.font = `${weight} ${s}px ${family}`; ctx.letterSpacing = (ls * s) + 'px'; if (ctx.measureText(text).width <= maxW) break; }
  return s;
}
const fmtNum = (v) => typeof v === 'number' ? v.toLocaleString('en-US') : String(v);

// 统计项：按 content 生成（elevation 为空就不出现）
export function statItems(trail, units = { distance: 'km', elevation: 'm' }) {
  const it = [];
  it.push({ key: 'difficulty', label: 'LEVEL', value: String(trail.difficulty || '').toUpperCase(), level: LEVEL[(trail.difficulty || '').toLowerCase()] || 1 });
  if (trail.distance != null) it.push({ key: 'distance', label: 'DISTANCE', value: `${fmtNum(trail.distance)} ${units.distance.toUpperCase()}` });
  if (trail.time) it.push({ key: 'time', label: 'TIME', value: String(trail.time).toUpperCase() });
  if (trail.elevation != null) it.push({ key: 'elevation', label: 'CLIMB', value: `↑${fmtNum(trail.elevation)} ${units.elevation.toUpperCase()}`, climb: true });
  return it;
}
// 一条信息的最短停留（BRIEF_SCENE：字数/12 + 1，最少 1.5s）
export const readTime = (s) => Math.max(1.5, String(s).length / 12 + 1);

export function buildPoster(content, trail, idx, n) {
  const sc = buildScene(trail.scene, 11 + idx * 17);
  const items = statItems(trail, content.units);
  // 步道折线累计长度
  let L = 0; const tr = sc.trail.map((q, i, a) => { if (i) L += Math.hypot(q.x - a[i - 1].x, q.y - a[i - 1].y); return { ...q, s: L }; });
  return { sc, trail, items, idx, n, paper: content.palette.paper, park: content.park, trailPts: tr, trailLen: L, seed: idx * 13 + 5 };
}

// 步道虚线（只画 plane 这一段，reveal = 已印出的弧长比例）
function trailDashes(ctx, P, plane, reveal, color) {
  const pts = P.trailPts, maxS = reveal * P.trailLen, dash = 16, gap = 12;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.lineCap = 'butt';
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]; if (b.plane !== plane && a.plane !== plane) continue;
    if (b.plane !== plane) continue;
    const len = b.s - a.s;
    for (let s = Math.ceil(a.s / (dash + gap)) * (dash + gap); s < b.s && s < maxS; s += dash + gap) {
      const t0 = (s - a.s) / len, t1 = Math.min(1, (Math.min(s + dash, maxS) - a.s) / len);
      ctx.beginPath(); ctx.moveTo(lerp(a.x, b.x, t0), lerp(a.y, b.y, t0)); ctx.lineTo(lerp(a.x, b.x, t1), lerp(a.y, b.y, t1)); ctx.stroke();
    }
  }
  ctx.restore();
}


// 对比度：按 WCAG 相对亮度挑一块与底色对比够的墨（换内容/换配色时文字不会"隐身"）
const lum = (h) => { const c = hex2rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
export function pickInk(bgs, cands, need = 3) { bgs = [].concat(bgs); for (const c of cands) if (c && bgs.every(b => contrast(c, b) >= need)) return c; return cands.filter(Boolean).sort((a, b) => Math.min(...bgs.map(x => contrast(b, x))) - Math.min(...bgs.map(x => contrast(a, x))))[0]; }
// ---- 版式常量 ----
// 画面区到 y=1140；场景整体上移 SHIFT（裁掉一点天空），让出更高的信息带
export const ARTV = [26, 26, 948, 1114], SHIFT = 50, BAND = [26, 1148, 948, 326];
const NAME_Y = 1262, RULE_Y = 1290, LABEL_Y = 1348, VALUE_Y = 1440;

// 旋转坐标系下的拉墨区域（换色重印用，斜着推）
function tiltedWipe(ctx, p, angle, seed) {
  const m = ctx.getTransform();
  ctx.translate(PW / 2, PH / 2); ctx.rotate(angle); ctx.translate(-PW / 2, -PH / 2);
  const box = [-400, -300, PW + 800, PH + 600];
  ctx.clip(wipeRegion(box, 'up', p, seed, 50, 7));
  ctx.setTransform(m);
}
export function swapFrontLine(p, angle) {    // 刮板位置（海报坐标）：返回刀口两端
  const box = [-400, -300, PW + 800, PH + 600], y = wipeFront(box, 'up', p, 50);
  const c = Math.cos(angle), s = Math.sin(angle), rot = (x, yy) => { const dx = x - PW / 2, dy = yy - PH / 2; return [PW / 2 + dx * c - dy * s, PH / 2 + dx * s + dy * c]; };
  return [rot(-400, y), rot(PW + 400, y)];
}

// ---- 画一张海报（在当前变换下，海报单位） ----
// st: { pal, T, prog(id)->0..1, off(id)->[dx,dy], reg, sep(0..1 纸版分离感), trail, band, name, header, items[], swap:{pal,p,angle}, finish }
export function drawPoster(ctx, P, st) {
  paperSheet(ctx, st.T, 0, 0, PW, PH);
  body(ctx, P, st, st.pal);
  if (st.swap && st.swap.p > 0) {
    ctx.save(); tiltedWipe(ctx, st.swap.p, st.swap.angle ?? -.2, 7 + P.idx);
    paperSheet(ctx, st.T, 0, 0, PW, PH);
    body(ctx, P, st, st.swap.pal);
    ctx.restore();
  }
  if (st.finish !== false) inkFinish(ctx, st.T, 0, 0, PW, PH, .6, 1);
}
const R2 = (seed, k, amp) => [(hash(seed * 3.1 + k) - .5) * 2 * amp, (hash(seed * 7.7 + k * 1.3) - .5) * 2 * amp];

function body(ctx, P, st, pal) {
  const prog = st.prog || (() => 1), off = st.off || (() => [0, 0]), regAmt = st.reg ?? 1, sep = st.sep || 0;
  ctx.save(); ctx.beginPath(); ctx.rect(ARTV[0], ARTV[1], ARTV[2], ARTV[3]); ctx.clip();
  ctx.translate(0, -SHIFT);
  P.sc.planes.forEach((pl, k) => {
    const p = prog(pl.id); if (p <= 0) return;
    const [ox, oy] = off(pl.id, pl);
    ctx.save(); ctx.translate(ox, oy);
    const box = [ART[0] - ox, ART[1] - oy - 60, ART[2], ART[3] + 180];
    // 纸版分离：这块版的轮廓往上错一点印一道纸白缝，再往上一道纸厚阴影（落在下层上）
    if (sep > 0 && k > 1 && p >= 1) {
      const sil = pl.parts[0].path;
      ctx.save(); ctx.translate(0, -9 * sep); ctx.globalAlpha = .28 * Math.min(1, sep * 1.5); ctx.fillStyle = '#140f14'; ctx.fill(sil); ctx.restore();
      ctx.save(); ctx.translate(1.5 * sep, -3.2 * sep); ctx.fillStyle = P.paper; ctx.fill(sil); ctx.restore();
    }
    pl.parts.forEach((pt, j) => {
      const pp = pt.sub ? clamp(p * 1.35 - .35) : clamp(p * 1.35);    // 点缀色晚半拍
      if (pp <= 0) return;
      const reg = R2(P.seed + k * 5 + j, 1, 2.2 * regAmt);
      ink(ctx, pt, { color: pal[pt.ink] || (pt.ink === 'glow' ? pal.sky2 : pal.far), reg, clip: pp < 1 ? wipeRegion(box, st.dir || 'down', pp, P.seed + k * 3 + j, 30, 5) : null, sheen: 1, trap: 1, lw: 1.8 });
    });
    if (st.trail != null ? st.trail > 0 : true) {
      const rv = st.trail ?? 1;
      ctx.save(); ctx.translate(...R2(P.seed + 91, 1, 1.5 * regAmt)); trailDashes(ctx, P, pl.id, rv, pal.sun); ctx.restore();
    }
    ctx.restore();
  });
  ctx.restore();
  // 页眉：园区名（印在天空上）
  const hp = st.header ?? 1;
  if (hp > 0) {
    ink(ctx, { paint: (c) => { c.font = `800 62px ${FONT_D}`; c.letterSpacing = '14px'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText(P.park.toUpperCase(), PW / 2 + 7, 112); } },
      { color: pickInk([pal.sky2, pal.sky1], [pal.near, pal.sun, pal.sky1], 3), reg: R2(P.seed + 44, 1, 1.4 * regAmt), clip: hp < 1 ? wipeRegion([0, 40, PW, 100], 'right', hp, 3) : null });
  }
  // 信息带
  const bp = st.band ?? 1;
  if (bp > 0) {
    ink(ctx, { path: rectPath(...BAND) }, { color: pal.near, reg: R2(P.seed + 51, 1, 1.2 * regAmt), clip: bp < 1 ? wipeRegion(BAND, 'right', bp, 9, 40) : null, sheen: 1 });
  }
  const np = st.name ?? 1;
  if (np > 0) {
    ink(ctx, { paint: (c) => {
      const s = fitFont(c, P.trail.name.toUpperCase(), 900, FONT_D, 690, 122, 60, .01);
      c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText(P.trail.name.toUpperCase(), 64, NAME_Y);
    } }, { color: pickInk(pal.near, [pal.sky1, pal.sun, pal.glow], 4.5), reg: R2(P.seed + 61, 1, 1.4 * regAmt), clip: np < 1 ? wipeRegion([40, 1150, 900, 130], 'right', np, 21, 30) : null });
    ink(ctx, { paint: (c) => { c.font = `900 122px ${FONT_D}`; c.letterSpacing = '0px'; c.textAlign = 'right'; c.fillText(String(P.idx + 1).padStart(2, '0'), 938, NAME_Y); } },
      { color: pal.sun, reg: R2(P.seed + 62, 1, 1.4 * regAmt), clip: np < 1 ? wipeRegion([780, 1150, 170, 130], 'down', np, 23, 30) : null });
    ink(ctx, { path: rectPath(64, RULE_Y, 874, 6) }, { color: pal.sun, reg: R2(P.seed + 63, 1, 1.2 * regAmt), clip: np < 1 ? wipeRegion([60, RULE_Y - 10, 880, 26], 'right', np, 5, 20) : null });
  }
  // 统计项：一行 n 列；标签 38u（墙上 ≥18 px），数值 64u 窄体（墙上 ≥30 px）；列宽按内容分配
  const L = statLayout(ctx, P);
  P.items.forEach((it, i) => {
    const ip = st.items ? (st.items[i] ?? 0) : 1; if (ip <= 0) return;
    const x = L.xs[i], cw = L.ws[i], box = [x - 6, LABEL_Y - 44, cw + 12, 150];
    const clip = ip < 1 ? wipeRegion(box, 'right', ip, 31 + i, 24) : null;
    ink(ctx, { paint: (c) => { c.font = `600 ${L.ls}px ${FONT_T}`; c.letterSpacing = (L.ls * .1) + 'px'; c.textAlign = 'left'; c.fillText(it.label, x, LABEL_Y); } },
      { color: pickInk(pal.near, [pal.sky2, pal.glow, pal.far, pal.sky1], 3), reg: R2(P.seed + 70 + i, 1, 1.2 * regAmt), clip });
    ink(ctx, { paint: (c) => {
      let tx = x;
      if (it.key === 'difficulty') { icons(c, x, it.level, L.vs); tx = x + L.vs * 1.3; }
      c.font = `800 ${L.vs}px ${FONT_D}`; c.letterSpacing = (L.vs * .01) + 'px'; c.textAlign = 'left'; c.fillText(it.value, tx, VALUE_Y);
    } }, { color: it.climb || it.key === 'difficulty' ? pickInk(pal.near, [pal.sun, pal.sky1], 4.5) : pickInk(pal.near, [pal.sky1, pal.sun, pal.glow], 4.5), reg: R2(P.seed + 80 + i, 1, 1.2 * regAmt), clip });
  });
}
function icons(c, x, level, vs) {        // 三个小山形：实心 = 难度级
  const w = vs * .34, h = vs * .52, g = vs * .4;
  for (let k = 0; k < 3; k++) {
    const px = x + k * g; c.beginPath(); c.moveTo(px, VALUE_Y); c.lineTo(px + w / 2, VALUE_Y - h); c.lineTo(px + w, VALUE_Y); c.closePath();
    if (k < level) c.fill(); else { c.save(); c.lineWidth = vs * .055; c.strokeStyle = c.fillStyle; c.globalAlpha *= .6; c.stroke(); c.restore(); }
  }
}
function statLayout(ctx, P) {
  if (P._stat) return P._stat;
  const x0 = 64, x1 = 938, avail = x1 - x0, n = P.items.length;
  let vs = 68, ls = 38, ws;
  for (; ; vs -= 2, ls = Math.max(34, ls - 1)) {
    ctx.save();
    ws = P.items.map(it => {
      ctx.font = `600 ${ls}px ${FONT_T}`; ctx.letterSpacing = (ls * .1) + 'px'; const lw = ctx.measureText(it.label).width;
      ctx.font = `800 ${vs}px ${FONT_D}`; ctx.letterSpacing = (vs * .01) + 'px'; const vw = ctx.measureText(it.value).width + (it.key === 'difficulty' ? vs * 1.3 : 0);
      return Math.max(lw, vw);
    });
    ctx.restore();
    if (ws.reduce((a, b) => a + b, 0) + (n - 1) * 30 <= avail || vs <= 48) break;
  }
  const gap = n > 1 ? (avail - ws.reduce((a, b) => a + b, 0)) / (n - 1) : 0;
  const xs = []; let x = x0; ws.forEach(w => { xs.push(x); x += w + Math.min(gap, 140); });
  return (P._stat = { xs, ws, vs, ls });
}

// ---- 横幅（片名）：1800×440 单位（约 4:1；开场贴近时撑满画宽、占画高约 40%） ----
export const BW = 1800, BH = 440, BANNER_ART = [14, 14, 1772, 360];
export const BANNER_BANDS = { sky2: [0, 150], sky1: [150, 300], far: [300, 374] };   // 分色刮的墨珠分段
function splitTitle(ctx, text, family, size) {       // 两行：按宽度最均衡的断点
  const w = text.split(' '); if (w.length < 2) return [text];
  ctx.font = `900 ${size}px ${family}`; let best = null;
  for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '); const d = Math.max(ctx.measureText(a).width, ctx.measureText(b).width); if (!best || d < best.d) best = { d, l: [a, b] }; }
  return best.l;
}
export function drawBanner(ctx, content, st) {
  const pal = st.pal, T = st.T;
  paperSheet(ctx, T, 0, 0, BW, BH);
  const sp = st.sky ?? 1;
  ctx.save(); ctx.beginPath(); ctx.rect(...BANNER_ART); ctx.clip();
  if (sp > 0) {
    const clip = sp < 1 ? wipeRegion([0, 0, BW, BH], 'right', sp, 4, 34, 4) : null;
    ink(ctx, { path: rectPath(0, 0, BW, BH), knock: ringPath(1590, 300, 118, 132) }, { color: pal.sky1, reg: [0, 0], clip, sheen: 1 });
    const top = new Path2D(); top.rect(0, 0, BW, 96);
    for (let i = 0; i < 5; i++) { const cell = 22, th = cell * (1 - (i + .5) / 5) * .95 + 1.5; top.rect(0, 96 + i * cell, BW, th); }
    ink(ctx, { path: top }, { color: pal.sky2, reg: [1.2, .6], clip, sheen: 1, trap: .35 });
    ink(ctx, { path: circlePath(1590, 300, 96) }, { color: pal.sun || pal.sky1, reg: [2, 1], clip, sheen: 1 });
    const mt = []; mt.push([-10, 400]); for (let x = 0; x <= BW + 20; x += 20) { const y = 352 - 44 * Math.abs(Math.sin(x * .0035 + 1.3)) - 22 * Math.abs(Math.sin(x * .011)); mt.push([x, y]); } mt.push([BW + 20, 400]);
    ink(ctx, { path: polyPath(mt) }, { color: pal.far, reg: [-.8, 1], clip, sheen: 1 });
  }
  ctx.restore();
  const tp = st.title ?? 1;
  if (tp > 0) {
    ink(ctx, { paint: (c) => {
      const T0 = content.title.toUpperCase(); let size = 150, lines = splitTitle(c, T0, FONT_D, size);
      if (lines.length === 1) { size = fitFont(c, T0, 900, FONT_D, BW - 200, 170, 60, .02); }
      else { c.font = `900 ${size}px ${FONT_D}`; c.letterSpacing = (size * .02) + 'px'; const m = Math.max(...lines.map(l => c.measureText(l).width)); if (m > BW - 200) size = Math.floor(size * (BW - 200) / m); c.font = `900 ${size}px ${FONT_D}`; c.letterSpacing = (size * .02) + 'px'; }
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      if (lines.length === 1) c.fillText(T0, BW / 2, 200 + size * .35);
      else { c.fillText(lines[0], BW / 2, 160); c.fillText(lines[1], BW / 2, 160 + size * .98); }
    } }, { color: pickInk([pal.sky1, pal.sky2], [pal.near, pal.far], 3), reg: [1.5, -1], clip: tp < 1 ? wipeRegion([0, 20, BW, 330], 'right', tp, 17, 40) : null });
  }
  const fp = st.footer ?? 1;
  if (fp > 0) {
    const clip = fp < 1 ? wipeRegion([0, 378, BW, 56], 'right', fp, 19, 30) : null;
    ink(ctx, { path: rectPath(14, 382, BW - 28, 44) }, { color: pal.near, reg: [0, 0], clip, sheen: 1 });
    ink(ctx, { paint: (c) => { c.font = `600 25px ${FONT_T}`; c.letterSpacing = '9px'; c.textAlign = 'center'; c.fillText(content.footer.toUpperCase(), BW / 2, 413); } }, { color: pickInk(pal.near, [pal.sky1, pal.sun], 4.5), reg: [.8, .6], clip });
  }
  if (st.finish !== false) inkFinish(ctx, T, 0, 0, BW, BH, .6, 1);
}
