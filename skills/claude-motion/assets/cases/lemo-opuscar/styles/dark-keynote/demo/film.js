// film.js — 《Room to Think》装配：混乱世界 → 收拢 → 光的揭幕 → 大数字 → 呼吸 → 回响
import * as E from './engine.js';
import { K, DUR, S16, typeTimes, voice1, voice2, voice3, voiceClean } from './timeline.js';
import { RING, CARET_HOME, SCR, NOTE, TXT, CARET_H, CAM0, pullZoom, camCenter, items, poseAt, snap, SLOTS, TILE, sorted, TW, ST, groupOf } from './world.js';
const { W, H, PAL, clamp, lerp, seg, ss, eo, ei, eio, back, spring, hash, TAU, font, rr } = E;
export { DUR };

// ───────────────── 片名打字 ─────────────────
const TITLE = typeTimes(K.typeStart, K.title);
const ECHO = typeTimes(K.echoType, K.title);
const typed = (tt, t) => tt.filter(c => c.t <= t).map(c => c.c).join('');
const caretWorld = () => ({ x: TXT.x + 8, y: TXT.y + TXT.lh - 11 });   // 第二行 "I" 之后

// 光标在世界里的位置（开场）
function caretOpen(g, t) {
  g.font = font(TXT.px, 500);
  if (t < K.ret) { const s = typed(TITLE, t); return { x: TXT.x + g.measureText(s).width + 3, y: TXT.y - 11 }; }
  const s2 = t >= K.typeI ? 'I' : '';
  return { x: TXT.x + g.measureText(s2).width + 3, y: TXT.y + TXT.lh - 11 };
}
const blinkOn = t => (Math.floor(t / 0.5) % 2 === 0 ? 1 : 0);
function caretState(t) {
  // 返回 {on, sx, sy, dx}
  let on = 1, sx = 1, sy = 1, dx = 0;
  if (t < K.typeStart) on = blinkOn(t);
  else if (t < K.ding[0]) on = 1;
  else if (t < K.pullStart) {                      // 被挤一下，愣住常亮
    for (const d of K.ding) { const a = t - d; if (a >= 0 && a < 0.25) { const k = Math.exp(-a * 14) * Math.sin(a * 38); dx += 8 * k; sx *= 1 - 0.1 * k; sy *= 1 + 0.1 * k; } }
  } else if (t < K.freeze) on = blinkOn(t);
  else if (t < K.press) { const u = ei(seg(t, K.stretch, K.press)); sy = 1 + 0.35 * u; sx = 1 - 0.2 * u; }
  else if (t < K.press + 0.9) { const a = t - K.press; if (a < 2 / 24) { sy = 0.3; sx = 2.4; } else { const r = spring((a - 2 / 24) / 0.6, 8, 0.3); sy = lerp(0.3, 1, r); sx = lerp(2.4, 1, r); } }
  else on = blinkOn(t);
  return { on, sx, sy, dx };
}

// ───────────────── 摄影机（混乱段） ─────────────────
function camMess(t) {
  const cw = caretWorld();
  if (t < K.freeze) {
    const z = pullZoom(t), c = t < K.pullEnd ? camCenter(t) : { x: 960, y: 540 };
    let rot = 0.018 * ss(seg(t, 10.5, 12)) + 0.034 * ss(seg(t, 13.5, 14.8));
    const amp = 1.5 * ss(seg(t, 10.5, 12)) + 5 * ss(seg(t, 13.5, 14.9)), k = t * 24;
    const sx = amp * (Math.sin(k * 1.7) * 0.6 + Math.sin(k * 3.1 + 1) * 0.4), sy = amp * (Math.sin(k * 2.3 + 2) * 0.6 + Math.sin(k * 0.9) * 0.4);
    return E.camera({ x: c.x, y: c.y, zoom: z, rot, sx, sy });
  }
  if (t < K.press) {                                // 冻结：无声推近光标
    const u = eio(seg(t, K.freeze, K.press));
    return E.camera({ x: lerp(960, cw.x, u), y: lerp(540, cw.y, u), zoom: Math.exp(lerp(Math.log(0.8), Math.log(4.4), u)), rot: lerp(0.034, 0, u) });
  }
  const u = 1 - Math.pow(1 - seg(t, K.press, K.press + 0.5), 3);  // 急拉
  return E.camera({ x: lerp(cw.x, 960, u), y: lerp(cw.y, 540, u), zoom: Math.exp(lerp(Math.log(4.4), Math.log(0.78), u)) });
}

// ───────────────── 元素绘制 ─────────────────
function winParams(it, t) {
  const ta = Math.min(t, K.freeze), a = ta - it.t0;
  if (it.kind === 'inbox') return { seed: it.seed, scroll: Math.max(0, a) * 140, unread: 99 };
  if (it.kind === 'browser') return { seed: it.seed, tabs: Math.min(160, Math.floor(6 * Math.pow(2, Math.max(0, a) / 0.5))) };
  return { seed: it.seed, n: 6 };
}
function drawItem(g, it, t) {
  const w = it.w, h = it.h;
  if (it.type === 'file') E.fileIcon(g, 0, 0, it.s, { name: it.name, ext: it.ext, tint: it.tint });
  else if (it.type === 'photo') E.photo(g, -w / 2, -h / 2, w, h, it.seed);
  else if (it.type === 'notif') E.notif(g, -w / 2, -h / 2, w, h, { app: it.app, title: it.txt[0], body: it.txt[1], badge: it.bd, cheap: true });
  else if (it.type === 'window') {
    const r = E.windowBox(g, -w / 2, -h / 2, w, h, { title: it.title, app: it.app, cheap: true });
    E.windowContent(g, r, it.kind, winParams(it, t));
    if (it.kind === 'inbox') { const a = Math.max(0, Math.min(t, K.freeze) - it.t0); const n = Math.floor(Math.pow(a / 4, 1.6) * 999); E.badge(g, w / 2 - 10, -h / 2 + 8, n >= 999 ? '999+' : String(Math.max(1, n)), 1.3); }
  }
}
/** 吸附后的统一方块 */
function drawTile(g, it, s, alpha = 1) {
  g.save(); g.globalAlpha *= alpha;
  const r = s * 0.2;
  if (it.type === 'photo') { E.photo(g, -s / 2, -s / 2, s, s, it.seed, { cheap: false, r }); }
  else {
    g.fillStyle = PAL.surf2; rr(g, -s / 2, -s / 2, s, s, r); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 1; rr(g, -s / 2 + 0.5, -s / 2 + 0.5, s - 1, s - 1, r); g.stroke();
    if (it.type === 'file') E.fileIcon(g, 0, s * 0.1, s / 86, { ext: it.ext, tint: it.tint, cheap: false, label: false });
    else if (it.type === 'notif') { E.appIcon(g, -s * 0.22, -s * 0.22, s * 0.44, it.app); }
    else if (it.type === 'window') {
      g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(-s / 2 + 1, -s / 2 + 1, s - 2, s * 0.18);
      for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(-s * 0.32, -s * 0.08 + i * s * 0.14, s * (i === 2 ? 0.36 : 0.64), s * 0.06); }
    }
  }
  g.restore();
}
const STACKN = ['8,155', '3,647', '435'];
function drawStack(g, s, label, a) {
  g.save(); g.globalAlpha *= a;
  for (let k = 2; k >= 0; k--) { g.fillStyle = k ? E.mix('#1A1E28', '#0A0B0F', k * 0.3) : PAL.surf3; rr(g, -s / 2 + k * 4, -s / 2 - k * 4, s, s, s * 0.2); g.fill(); g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; rr(g, -s / 2 + k * 4 + 0.5, -s / 2 - k * 4 + 0.5, s - 1, s - 1, s * 0.2); g.stroke(); }
  g.fillStyle = PAL.text; g.font = font(s * 0.22, 600, 'mono'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 0, 1); g.restore();
}
function tileMaxScale(it) { return TILE / Math.max(it.w, it.h) * (it.type === 'file' ? 1.25 : 1.1); }

/** 屏幕（桌面）底面 */
function drawSurface(g, a = 1) {
  g.save(); g.globalAlpha *= a;
  g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 120; g.shadowOffsetY = 40;
  const gr = g.createLinearGradient(0, 0, 0, SCR.h); gr.addColorStop(0, '#12151D'); gr.addColorStop(1, '#0D0F15');
  g.fillStyle = gr; rr(g, SCR.x, SCR.y, SCR.w, SCR.h, 26); g.fill(); g.shadowColor = 'transparent';
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1.5; rr(g, SCR.x, SCR.y, SCR.w, SCR.h, 26); g.stroke();
  g.restore();
}

// ───────────────── Tidy 窗口（世界坐标 = 屏幕 1920×1080） ─────────────────
const COUNTS = ['8,212', '3,704', '492'], GNAME = ['Desktop', 'Photos', 'Inbox'];
function drawChrome(g, t, o = {}) {
  const ap = o.appear ?? ss(seg(t, K.chrome, K.chrome + 0.45));
  const out = o.out ?? [0, 0, 0, 0];   // 退场：侧栏 / 状态栏 / 标题栏 / 格子
  if (ap <= 0) return;
  const S = sorted();
  // 侧栏
  const sx = -TW.side * (1 - eo(ap)) - TW.side * ei(out[0]);
  g.save(); g.beginPath(); rr(g, 0, 0, SCR.w, SCR.h, 26); g.clip();
  g.save(); g.translate(sx, 0);
  g.fillStyle = 'rgba(255,255,255,.018)'; g.fillRect(0, TW.bar, TW.side, SCR.h - TW.bar - TW.status);
  g.fillStyle = PAL.line; g.fillRect(TW.side, TW.bar, 1, SCR.h - TW.bar - TW.status);
  g.font = font(13, 600, 'mono'); g.fillStyle = PAL.mute; g.textBaseline = 'alphabetic';
  if (g.letterSpacing !== undefined) g.letterSpacing = '2px';
  g.fillText('LIBRARY', 36, TW.bar + 52); g.fillText('RULES', 36, TW.bar + 330);
  if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
  for (let i = 0; i < 3; i++) {
    const y = TW.bar + 84 + i * 62;
    if (i === 0) { g.fillStyle = 'rgba(255,255,255,.05)'; rr(g, 20, y - 6, TW.side - 40, 52, 12); g.fill(); }
    E.appIcon(g, 36, y + 5, 30, [6, 5, 4][i]);
    g.fillStyle = PAL.text; g.font = font(20, 500); g.fillText(GNAME[i], 82, y + 27);
    g.fillStyle = PAL.dim; g.font = font(16, 500, 'mono'); g.textAlign = 'right'; g.fillText(COUNTS[i], TW.side - 66, y + 26); g.textAlign = 'left';
    const ck = K.checks[i], ca = o.checksAll ? 1 : clamp((t - ck) / 0.18);
    if (ca > 0) { const s = back(ca, 2.2); g.save(); g.translate(TW.side - 40, y + 20); g.scale(s, s); g.fillStyle = PAL.accent; g.shadowColor = E.rgba(PAL.accent, 0.7); g.shadowBlur = 12; g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill(); g.shadowColor = 'transparent'; g.strokeStyle = '#0A0B0F'; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-5, 0); g.lineTo(-1.5, 4); g.lineTo(5, -4); g.stroke(); g.restore(); }
  }
  const rules = [['Screenshots', 'Archive'], ['Duplicates', 'Merged'], ['Newsletters', 'Later'], ['Old downloads', 'Trash']];
  rules.forEach(([a, b], i) => { const y = TW.bar + 366 + i * 44; g.fillStyle = PAL.dim; g.font = font(17, 500); g.fillText(a, 36, y); const w = g.measureText(a).width; g.fillStyle = PAL.mute; g.fillText('→', 44 + w, y); g.fillStyle = PAL.text; g.fillText(b, 70 + w, y); });
  g.fillStyle = PAL.mute; g.font = font(14, 500, 'mono'); g.fillText('Last tidy · just now', 36, SCR.h - TW.status - 28);
  g.restore();
  // 分组标题
  const ha = ss(seg(t, K.chrome + 0.15, K.chrome + 0.5)) * (1 - out[3]);
  if (ha > 0 || o.checksAll) S.heads.forEach(hd => { g.globalAlpha = o.checksAll ? 1 - out[3] : ha; g.fillStyle = PAL.text; g.font = font(20, 600); g.fillText(GNAME[hd.gi], TW.side + 44, hd.y + 22); const w = g.measureText(GNAME[hd.gi]).width; g.fillStyle = PAL.mute; g.font = font(15, 500, 'mono'); g.fillText(`${COUNTS[hd.gi]} items · sorted`, TW.side + 58 + w, hd.y + 22); g.globalAlpha = 1; });
  // 标题栏
  const by = -TW.bar * (1 - eo(ap)) - TW.bar * ei(out[2]);
  g.save(); g.translate(0, by);
  g.fillStyle = '#151923'; g.fillRect(0, 0, SCR.w, TW.bar); g.fillStyle = PAL.line; g.fillRect(0, TW.bar, SCR.w, 1);
  if (!o.noMark) E.tidyMark(g, 44, TW.bar / 2, 36, { on: o.markOn ?? 1 });
  g.fillStyle = PAL.text; g.font = font(22, 600); g.textBaseline = 'middle'; g.fillText('Tidy', 76, TW.bar / 2 + 1);
  const segs = ['All', 'Desktop', 'Photos', 'Inbox']; let x = SCR.w / 2 - 190;
  g.fillStyle = 'rgba(255,255,255,.04)'; rr(g, x - 6, TW.bar / 2 - 20, 392, 40, 12); g.fill();
  segs.forEach((s, i) => { g.font = font(16, 500); const w = g.measureText(s).width + 36; if (i === 0) { g.fillStyle = 'rgba(255,255,255,.09)'; rr(g, x, TW.bar / 2 - 15, w, 30, 9); g.fill(); } g.fillStyle = i === 0 ? PAL.text : PAL.dim; g.fillText(s, x + 18, TW.bar / 2 + 1); x += w + 4; });
  g.fillStyle = PAL.accent; rr(g, SCR.w - 170, TW.bar / 2 - 19, 138, 38, 19); g.fill(); g.fillStyle = '#0A0B0F'; g.font = font(17, 600); g.textAlign = 'center'; g.fillText('Tidy up', SCR.w - 101, TW.bar / 2 + 1); g.textAlign = 'left';
  g.restore();
  // 状态栏
  const sy = TW.status * (1 - eo(ap)) + TW.status * ei(out[1]);
  g.save(); g.translate(0, sy);
  g.fillStyle = '#10131A'; g.fillRect(0, SCR.h - TW.status, SCR.w, TW.status); g.fillStyle = PAL.line; g.fillRect(0, SCR.h - TW.status, SCR.w, 1);
  g.fillStyle = PAL.accent; g.shadowColor = E.rgba(PAL.accent, 0.8); g.shadowBlur = 8; g.beginPath(); g.arc(40, SCR.h - TW.status / 2, 5, 0, TAU); g.fill(); g.shadowColor = 'transparent';
  g.fillStyle = PAL.dim; g.font = font(17, 500, 'mono'); g.textBaseline = 'middle'; g.fillText(STATUS, 58, SCR.h - TW.status / 2 + 1);
  g.textAlign = 'right'; g.fillStyle = PAL.mute; g.fillText('All clear', SCR.w - 36, SCR.h - TW.status / 2 + 1); g.textAlign = 'left';
  g.restore();
  g.restore();
}
const STATUS = '12,408 files sorted in 0.8 s';
export function statusDigitsBox(g) { g.font = font(17, 500, 'mono'); const w = g.measureText('12,408').width; return { x: 58, y: SCR.h - TW.status / 2 + 1, w, h: 17 }; }

// ───────────────── 元素状态 & 绘制（世界坐标） ─────────────────
function tilePos(i, t) {
  const sn = snap()[i], so = sorted().pos[i];
  const slot = { x: sn.slot.x, y: sn.slot.y };
  if (t < K.sort) return { ...slot, s: TILE, a: 1 };
  // 分类：四波，按列从左到右，每波一个八分音符
  const wave = Math.min(3, Math.floor(sn.slot.i / 6)), t0 = K.sort + wave * 0.25, p = eio(seg(t, t0, t0 + 0.32));
  return { x: lerp(slot.x, so.x, p), y: lerp(slot.y, so.y, p), s: lerp(TILE, ST, p), a: so.stack ? 1 - ss(seg(p, 0.6, 1)) : 1 };
}
const FLOW = ['#C9D3E6', '#F2A65A', '#7E95FF'];   // 三股流：文件 / 照片 / 通知
function drawWorldItems(g, cam, t) {
  const its = items(), SN = snap();
  for (let i = 0; i < its.length; i++) {
    const it = its[i];
    if (it.t0 > Math.min(t, K.freeze)) continue;
    const sn = SN[i];
    const fp = t < sn.t0 ? -1 : (t - sn.t0) / sn.dur;
    if (fp < 0) {
      const p = poseAt(it, t); if (!p) continue;
      const pr = cam.proj(p.x, p.y, it.z); if (!pr) continue;
      const rad = Math.max(it.w, it.h) * 0.75 * pr.s; if (pr.x + rad < 0 || pr.x - rad > W || pr.y + rad < 0 || pr.y - rad > H) continue;
      const cr = Math.cos(cam.rot), sr = Math.sin(cam.rot), s = pr.s * p.s;
      g.setTransform(s * cr, s * sr, -s * sr, s * cr, pr.x, pr.y); g.rotate(p.rot); g.globalAlpha = p.al;
      if (it.z > 0.03) { const b = clamp((pr.s / cam.zoom - 1) * 5, 0, 18); g.filter = b > 0.5 ? `blur(${b.toFixed(1)}px)` : 'none'; }
      drawItem(g, it, t); g.filter = 'none'; g.globalAlpha = 1;
    } else {
      const from = poseAt(it, K.freeze), to = tilePos(i, t), ts = tileMaxScale(it), gi = sn.gi;
      if (fp >= 1) { const pr = cam.proj(to.x, to.y); g.setTransform(pr.s, 0, 0, pr.s, pr.x, pr.y); drawTile(g, it, to.s, to.a); continue; }
      // 弧线飞行：同组同一个弯曲方向（三股流），终点沿切线过冲再弹回
      const ax = from.x, ay = from.y, bx = to.x, by = to.y, dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
      const cv = 0.2 * L * [1, -1, 1][gi], cx = (ax + bx) / 2 - dy / L * cv, cy = (ay + by) / 2 + dx / L * cv;
      const at = pp => { const q = back(clamp(pp), 1.3), u = Math.min(q, 1), v = 1 - u; let x = v * v * ax + 2 * v * u * cx + u * u * bx, y = v * v * ay + 2 * v * u * cy + u * u * by; if (q > 1) { x += (q - 1) * (bx - cx); y += (q - 1) * (by - cy); } return cam.proj(x, y); };
      const head = at(fp); if (!head) continue;
      // 光尾
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter'; g.lineCap = 'butt';
      const col = FLOW[gi], n = 9, span = Math.min(fp, 0.34);
      let prev = at(fp - span);
      for (let k = 1; k <= n; k++) { const pk = fp - span * (1 - k / n), cur = at(pk); const u = k / n; g.strokeStyle = E.rgba(col, 0.22 * u * u * (1 - ss(seg(fp, 0.75, 1)))); g.lineWidth = TILE * 0.42 * head.s * (0.35 + 0.65 * u); g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(cur.x, cur.y); g.stroke(); prev = cur; }
      g.restore();
      // 头部：元素迅速变成方块
      const morph = ss(seg(fp, 0.04, 0.32)), rot = lerp(from.rot, 0, clamp(spring(fp * 1.2, 9, 0.42))), pop = 1 + 0.14 * Math.sin(Math.PI * fp);
      g.setTransform(head.s * pop, 0, 0, head.s * pop, head.x, head.y); g.rotate(rot);
      if (morph < 1) { g.globalAlpha = (1 - morph) * from.al; g.save(); const sc = lerp(from.s, ts * to.s / TILE, eo(clamp(fp * 2.5))); g.scale(sc, sc); drawItem(g, it, K.freeze); g.restore(); g.globalAlpha = 1; }
      if (morph > 0) drawTile(g, it, to.s * lerp(0.7, 1, morph), morph);
    }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

// ───────────────── 混乱段场景（0 – 19.5） ─────────────────
function sceneMess(g, t) {
  E.bg(g, { lift: 1 });
  const cam = camMess(t);
  // 屏幕底面 + 网格
  cam.apply(g, 0);
  drawSurface(g);
  const o = cam.proj(0, 0), s0 = o.s;
  g.setTransform(1, 0, 0, 1, 0, 0);
  // 便签窗口 + 片名（收拢前）
  const noteA = 1 - ss(seg(t, K.press, K.press + 0.25));
  if (noteA > 0) {
    cam.apply(g, 0); g.globalAlpha = noteA;
    const r = E.windowBox(g, NOTE.x, NOTE.y, NOTE.w, NOTE.h, { title: 'Notes', app: 3 });
    E.windowContent(g, r, 'note');
    g.font = font(TXT.px, 500); g.fillStyle = PAL.text; g.textBaseline = 'alphabetic';
    g.fillText(typed(TITLE, t), TXT.x, TXT.y);
    if (t >= K.typeI) g.fillText('I', TXT.x, TXT.y + TXT.lh);
    // 小字副标
    const ca = ss(seg(t, 1.75, 2.2)) * (1 - ss(seg(t, 4.0, 4.6)));
    if (ca > 0) { g.globalAlpha = noteA * ca; g.font = font(6.4, 600, 'mono'); g.fillStyle = PAL.mute; if (g.letterSpacing !== undefined) g.letterSpacing = '1.4px'; g.fillText('TIDY  ·  A LAUNCH FILM', TXT.x, TXT.y - 44); if (g.letterSpacing !== undefined) g.letterSpacing = '0px'; }
    g.globalAlpha = 1; g.setTransform(1, 0, 0, 1, 0, 0);
  }
  // 光标（在元素下面；被埋时从缝里漏光）
  const cs = caretState(t);
  const cpos = t < K.press + 0.9 ? caretOpen(g, Math.min(t, K.pullStart)) : null;
  if (cpos && t < K.press + 0.9) {
    cam.apply(g, 0); E.caret(g, cpos.x + cs.dx / 5, cpos.y, CARET_H, { on: cs.on, sx: cs.sx, sy: cs.sy, glow: 1 }); g.setTransform(1, 0, 0, 1, 0, 0);
  }
  drawWorldItems(g, cam, t);
  // 冻结时的聚光：只让光标亮着
  const spot = ss(seg(t, K.freeze, K.freeze + 0.6)) * (1 - ss(seg(t, K.press, K.press + 0.15)));
  if (spot > 0 && cpos) {
    const pr = cam.proj(cpos.x, cpos.y), gr = g.createRadialGradient(pr.x, pr.y, 120, pr.x, pr.y, 900);
    gr.addColorStop(0, 'rgba(4,5,8,0)'); gr.addColorStop(1, `rgba(4,5,8,${0.55 * spot})`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  // 漏光：被埋时的青柠光（叠加）
  if (cpos && t > 11 && t < K.press + 0.2) {
    const pr = cam.proj(cpos.x, cpos.y); const a = 0.18 * ss(seg(t, 11, 13)) + 0.4 * ss(seg(t, K.freeze, K.press));
    g.save(); g.globalCompositeOperation = 'lighter'; E.glow(g, pr.x, pr.y, 90 * pr.s * (1 + 0.5 * ss(seg(t, K.stretch, K.press))), PAL.accent, a); g.restore();
    if (t >= K.freeze) {
      const sp = cam.proj(cpos.x, cpos.y), hr = CARET_H * sp.s * 0.9;       // 光标背后一小片暗：把它从杂物里"抠"出来
      const dg = g.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, hr * 1.4); dg.addColorStop(0, `rgba(6,7,10,${0.85 * spot})`); dg.addColorStop(0.6, `rgba(6,7,10,${0.6 * spot})`); dg.addColorStop(1, 'rgba(6,7,10,0)');
      g.fillStyle = dg; g.fillRect(sp.x - hr * 1.5, sp.y - hr * 1.5, hr * 3, hr * 3);
      cam.apply(g, 0); E.caret(g, cpos.x, cpos.y, CARET_H, { on: 1, sx: cs.sx, sy: cs.sy, glow: 1.2 }); g.setTransform(1, 0, 0, 1, 0, 0);
    }
  }
  // 光环
  if (t >= K.press && t < K.press + 0.9) {
    const a = t - K.press, cw = caretWorld(), pr = cam.proj(cw.x, cw.y), R = a * RING * pr.s;
    g.save(); g.globalCompositeOperation = 'lighter';
    const fade = 1 - ss(seg(a, 0.35, 0.9));
    g.strokeStyle = E.rgba(PAL.accent, 0.85 * fade); g.lineWidth = 3 + 10 * (1 - fade); g.shadowColor = E.rgba(PAL.accent, fade); g.shadowBlur = 40;
    g.beginPath(); g.arc(pr.x, pr.y, R, 0, TAU); g.stroke(); g.shadowColor = 'transparent';
    const gr = g.createRadialGradient(pr.x, pr.y, Math.max(0, R - 220 * pr.s), pr.x, pr.y, R);
    gr.addColorStop(0, E.rgba(PAL.accent, 0)); gr.addColorStop(1, E.rgba(PAL.accent, 0.1 * fade));
    g.fillStyle = gr; g.beginPath(); g.arc(pr.x, pr.y, R, 0, TAU); g.fill();
    if (a < 0.12) E.glow(g, pr.x, pr.y, 260 * pr.s, PAL.accent, 0.6 * (1 - a / 0.12));
    g.restore();
  }
  // 光环前沿：吸附网格在光环经过的地方亮起
  if (t >= K.press && t < K.press + 0.9) {
    const a = t - K.press, cw = caretWorld(), Rw = a * RING;
    cam.apply(g, 0); g.lineWidth = 1.2 / cam.proj(0, 0).s;
    for (const sl of SLOTS) { const d = Math.hypot(sl.x - cw.x, sl.y - cw.y), k = 1 - Math.abs(d - Rw + 90) / 230; if (k <= 0) continue; g.strokeStyle = E.rgba(PAL.accent, 0.5 * k * k); rr(g, sl.x - TILE / 2 - 4, sl.y - TILE / 2 - 4, TILE + 8, TILE + 8, 14); g.stroke(); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const pr = cam.proj(cw.x, cw.y); g.save(); g.globalCompositeOperation = 'lighter'; E.glow(g, pr.x, pr.y, 300 * pr.s, PAL.accent, 0.55 * (1 - ss(seg(a, 0.15, 0.9)))); g.restore();
  }
  // 网格显形
  const ga = t >= K.gridShow ? Math.exp(-(t - K.gridShow) * 5) * (t < K.sort ? 1 : 0) : 0;
  if (ga > 0.01) {
    cam.apply(g, 0); g.strokeStyle = `rgba(255,255,255,${0.28 * ga})`; g.lineWidth = 1 / s0;
    for (const sl of SLOTS) { rr(g, sl.x - TILE / 2 - 4, sl.y - TILE / 2 - 4, TILE + 8, TILE + 8, 14); g.stroke(); }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  // 收拢后的光标：停在第一行行首，19.0 飞进标题栏变成 logo
  if (t >= K.press + 0.9 - 1e-6 || (t >= K.press + 0.3)) {
    const cw = caretWorld(), home = CARET_HOME;
    const a1 = eo(seg(t, K.press + 0.3, K.press + 0.7));
    const fly = eio(seg(t, K.chrome, K.chrome + 0.4));
    const mx = lerp(lerp(cw.x, home.x, a1), 44, fly), my = lerp(lerp(cw.y, home.y, a1), TW.bar / 2, fly);
    const h = lerp(lerp(CARET_H, 34, a1), 36 * 0.52, fly);
    if (t >= K.press + 0.3 && t < K.dim + 0.01) {
      cam.apply(g, 0); const cs2 = caretState(t);
      E.caret(g, mx, my, h, { on: t < K.press + 0.9 ? 1 : (fly > 0 ? 1 : cs2.on), wr: lerp(1 / 14, 1 / 6.5, fly), glow: 1 });
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
  }
  // Tidy 窗口外框（19.0）
  if (t >= K.chrome) { cam.apply(g, 0); drawChrome(g, t, { noMark: t < K.chrome + 0.4 }); g.setTransform(1, 0, 0, 1, 0, 0); }
  E.vignette(g, 0.5);
}
// ───────────────── 插入镜头（12.0 – 13.5） ─────────────────
function insertScene(g, k, lt) {
  E.bg(g, { lift: 1.2, cool: 0.6 });
  E.grid(g, { ox: 960, oy: 540, scale: 1.4, alpha: 0.8 });
  const push = 1 + lt * 0.12;
  g.save(); g.translate(W / 2, H / 2); g.scale(push, push); g.translate(-W / 2, -H / 2);
  if (k === 0) {        // 999+ 角标
    E.appIcon(g, W / 2 - 170, H / 2 - 170, 340, 4);
    const n = Math.min(999, Math.floor(lerp(640, 999, eo(lt / 0.3))));
    E.badge(g, W / 2 + 150, H / 2 - 150, n >= 999 ? '999+' : String(n), 6.2);
  } else if (k === 1) { // 标签页细成线
    const tabs = Math.floor(lerp(60, 150, lt / 0.5)), x0 = 120, w = W - 240, tw = w / tabs;
    E.panel(g, 90, 250, W - 180, 600, { r: 32, fill: PAL.surf });
    for (let i = 0; i < tabs; i++) { g.fillStyle = i === tabs - 1 ? PAL.surf3 : 'rgba(255,255,255,.08)'; rr(g, x0 + i * tw, 290, Math.max(1, tw - 3), 110, Math.min(12, tw / 3)); g.fill(); if (tw > 20) E.appIcon(g, x0 + i * tw + 4, 330, Math.min(30, tw - 8), i); }
    g.fillStyle = 'rgba(255,255,255,.06)'; rr(g, 150, 440, W - 300, 70, 35); g.fill();
    g.fillStyle = PAL.text; g.font = font(120, 600, 'disp'); g.textBaseline = 'alphabetic'; g.fillText(String(tabs), 170, 740);
    const nw = g.measureText(String(tabs)).width; g.fillStyle = PAL.dim; g.font = font(56, 500, 'ui'); g.fillText('tabs open', 200 + nw, 740);
  } else {              // 存储条变红
    const p = lerp(0.9, 0.995, eo(lt / 0.4));
    E.storageBar(g, 220, 580, W - 440, 52, p, { label: 'Storage almost full', value: `${((1 - p) * 40).toFixed(1)} GB left` });
  }
  g.restore(); E.vignette(g, 0.5);
}

// ───────────────── 产品段（19.5 – 26） ─────────────────
function winPose(t) {
  // 返回 {cx, cy, s, rotY, bright}
  if (t < K.reveal) { const u = eio(seg(t, K.dim, K.reveal)); return { cx: 960, cy: lerp(540, 515, u), s: lerp(0.78, 0.76, u), rotY: lerp(0, -0.42, u), bright: 1 - 0.93 * ss(seg(t, K.dim, K.dim + 0.35)) }; }
  const u = seg(t, K.reveal, K.rotZero), e = 1 - Math.pow(1 - u, 2.4);
  return { cx: 960, cy: lerp(515, 505, e), s: lerp(0.76, 0.8, e), rotY: lerp(-0.42, 0, e), bright: 1 };
}
function drawWindowWorld(g, t, o = {}) {
  drawSurface(g, 1);
  const its = items();
  const S = sorted();
  for (let i = 0; i < its.length; i++) { const p = tilePos(i, t), ta = (o.tileA ? o.tileA(i) : 1) * p.a; if (ta <= 0) continue; g.setTransform(...o.base(p.x, p.y)); drawTile(g, its[i], p.s, ta); }
  S.stacks.forEach((st, gi) => { const a = ss(seg(t, K.sort + 0.5, K.sort + 1.0)) * (o.tileA ? o.tileA(st.gi * 97) : 1); if (a <= 0) return; g.setTransform(...o.base(st.x, st.y)); drawStack(g, ST, `+${STACKN[gi]}`, a); });
  g.setTransform(...o.base(0, 0));
  drawChrome(g, t, { appear: 1, checksAll: o.checksAll, out: o.out });
}
function sceneProduct(g, t) {
  E.bg(g, { lift: 0.9, cool: 0.7 });
  const P = winPose(t);
  const sweepP = clamp((t - K.reveal) / 1.3);
  // 背景里的斜光带（跟光扫同步）
  if (t > K.reveal - 0.2 && t < K.reveal + 2.4) {
    const x = lerp(-600, W + 600, eio(clamp((t - K.reveal + 0.1) / 1.9)));
    g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, H / 2); g.rotate(0.62);
    const gr = g.createLinearGradient(-300, 0, 300, 0); gr.addColorStop(0, 'rgba(200,215,255,0)'); gr.addColorStop(0.5, 'rgba(200,215,255,.045)'); gr.addColorStop(1, 'rgba(200,215,255,0)');
    g.fillStyle = gr; g.fillRect(-300, -1400, 600, 2800); g.restore();
  }
  // 窗口背后的柔光晕 + 地面柔光
  E.glow(g, P.cx, P.cy - 40, 1100 * P.s, '#6F82C8', 0.10 * clamp(sweepP * 1.5));
  E.glow(g, P.cx, P.cy + P.s * 560, 900 * P.s, '#8CA0FF', 0.05 * clamp(sweepP * 2));
  const [wc, wg] = E.buf('win', 1920, 1080);
  wg.clearRect(0, 0, 1920, 1080);
  drawWindowWorld(wg, t, { base: (x, y) => [1, 0, 0, 1, x, y], checksAll: false });
  wg.setTransform(1, 0, 0, 1, 0, 0);
  // 先把（不透明的）窗口透视投到屏幕缓冲，再在屏幕空间里做光扫：光是扫过整个场景的
  const [pc, pg] = E.buf('persp', W, H); pg.clearRect(0, 0, W, H);
  const map = E.perspective(pg, wc, P.cx, P.cy, 1920 * P.s, 1080 * P.s, P.rotY, { slices: 160 });
  g.save();
  if (t < K.reveal) { g.globalAlpha = P.bright; g.drawImage(pc, 0, 0); }
  else E.lightReveal(g, pc, 0, 0, W, H, sweepP, { base: 0.07, soft: 700, band: 360, glint: 0.2 });
  g.restore();
  // 边缘高光（光扫经过时窗口边一亮）
  if (t >= K.reveal && sweepP < 1) {
    const [a, b] = [map(0, 0), map(1, 0)]; g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(a[0], 0, b[0], 0), f = sweepP; gr.addColorStop(clamp(f - 0.15), 'rgba(255,255,255,0)'); gr.addColorStop(clamp(f), 'rgba(255,255,255,.55)'); gr.addColorStop(clamp(f + 0.05), 'rgba(255,255,255,0)');
    g.strokeStyle = gr; g.lineWidth = 2; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); g.restore();
  }
  E.vignette(g, 0.55);
}

// ───────────────── 正面直绘（24.5 – 26 推进；29.5 – 33 呼吸） ─────────────────
function sceneFront(g, t, cam, o = {}) {
  E.bg(g, { lift: 0.9, cool: 0.7 });
  cam.apply(g, 0);
  const s = cam.proj(0, 0).s;
  const base = (x, y) => { const p = cam.proj(x, y); return [p.s, 0, 0, p.s, p.x, p.y]; };
  drawWindowWorld(g, t, { base, checksAll: true, out: o.out, tileA: o.tileA });
  g.setTransform(1, 0, 0, 1, 0, 0);
  E.vignette(g, 0.55);
}
const DIG = { x: 58, y: 1080 - 28 + 1 };
function camPushNum(t) {
  const P = winPose(K.rotZero), g0 = { x: 960, y: 540 + (540 - P.cy) / P.s };
  const u = ei(seg(t, K.pushNum, K.num));
  const tgt = { x: DIG.x + 34, y: DIG.y };
  return E.camera({ x: lerp(g0.x, tgt.x, ss(seg(t, K.pushNum, K.num - 0.3))), y: lerp(g0.y, tgt.y, ss(seg(t, K.pushNum, K.num - 0.3))), zoom: Math.exp(lerp(Math.log(P.s), Math.log(16), u)) });
}

// ───────────────── 大数字（26 – 29.5） ─────────────────
function sceneNumber(g, t) {
  E.bg(g, { lift: 1, cool: 0.8 });
  const lt = t - K.num, pull = 1.035 - 0.035 * eo(clamp(lt / 3.5));
  E.grid(g, { ox: 960, oy: 540, scale: pull, alpha: 0.7 });
  E.glow(g, 960, 480, 760, '#8CA0FF', 0.05);
  g.save(); g.translate(W / 2, H / 2); g.scale(pull, pull); g.translate(-W / 2, -H / 2);
  // 量出整行宽度，居中
  g.font = font(360, 600, 'disp'); if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
  const trk = -0.045 * 360; let nw = 0; for (const c of '12,408') nw += g.measureText(c).width + trk; nw -= trk;
  g.font = font(120, 500, 'disp'); const fw = g.measureText('files.').width;
  const total = nw + 40 + fw, x0 = W / 2 - total / 2, base = 560;
  // 顶部标签
  g.font = font(22, 600, 'mono'); g.fillStyle = PAL.mute; if (g.letterSpacing !== undefined) g.letterSpacing = '5px';
  g.globalAlpha = ss(seg(t, K.num + 0.1, K.num + 0.5)); g.fillText('TIDY  ·  FIRST RUN', x0 + 8, base - 300); g.globalAlpha = 1;
  if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
  // 12,408（从右往左锁）
  const locks = [K.locks[4], K.locks[3], K.locks[2], K.locks[2], K.locks[1], K.locks[0]];
  E.scramble(g, '12,408', x0, base, t, locks, { px: 360, wt: 600, fam: 'disp', color: '#F1F3F7', tracking: -0.045 });
  const fa = seg(t, K.files, K.files + 0.22);
  if (fa > 0) { g.globalAlpha = fa; g.font = font(120, 500, 'disp'); g.fillStyle = PAL.dim; g.fillText('files.', x0 + nw + 40, base - (1 - eo(fa)) * 18); g.globalAlpha = 1; }
  // Sorted in 0.8 seconds. + 0–1 s 标尺
  const la = seg(t, K.line2, K.line2 + 0.3);
  if (la > 0) {
    g.globalAlpha = eo(la); const y = base + 170 + (1 - eo(la)) * 18;
    g.font = font(84, 500, 'ui'); const parts = [['Sorted in ', PAL.text], ['0.8', PAL.accent], [' seconds.', PAL.text]];
    let lw = 0; parts.forEach(([s]) => lw += g.measureText(s).width); let x = W / 2 - lw / 2;
    parts.forEach(([s, c]) => { g.fillStyle = c; if (c === PAL.accent) { g.shadowColor = E.rgba(PAL.accent, 0.55); g.shadowBlur = 34; } g.fillText(s, x, y); g.shadowColor = 'transparent'; x += g.measureText(s).width; });
    // 标尺：0 ——— 1 s，青柠段长到 0.8
    const rx = W / 2 - 360, rw = 720, ry = y + 92, fill = eo(seg(t, K.line2 + 0.1, K.line2 + 0.9));
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(rx, ry, rw, 2);
    for (let i = 0; i <= 10; i++) { g.fillStyle = `rgba(255,255,255,${i % 5 ? 0.12 : 0.3})`; g.fillRect(rx + rw * i / 10 - 0.5, ry - (i % 5 ? 6 : 12), 1, i % 5 ? 6 : 12); }
    g.fillStyle = PAL.accent; g.shadowColor = E.rgba(PAL.accent, 0.8); g.shadowBlur = 14; g.fillRect(rx, ry - 1, rw * 0.8 * fill, 4); g.shadowColor = 'transparent';
    g.font = font(18, 500, 'mono'); g.fillStyle = PAL.mute; g.textAlign = 'center'; g.fillText('0 s', rx, ry + 36); g.fillText('1 s', rx + rw, ry + 36);
    g.fillStyle = PAL.accent; g.globalAlpha *= clamp((fill - 0.95) * 20); g.fillText('0.8', rx + rw * 0.8, ry + 36); g.textAlign = 'left';
    g.globalAlpha = 1;
  }
  g.restore(); E.vignette(g, 0.5);
}

// ───────────────── 呼吸（29.5 – 33）与回响（33 – 42） ─────────────────
const END_CARET = { x: 479, y: 535, h: CARET_H * 4.81, px: TXT.px * 4.81 };
function sceneBreath(g, t) {
  const P = winPose(K.rotZero), g0 = { x: 960, y: 540 + (540 - P.cy) / P.s };
  if (t < K.retract[0]) {           // 大字收回状态栏
    const u = eo(seg(t, K.numBack, K.retract[0]));
    return sceneFront(g, t, E.camera({ x: lerp(DIG.x + 34, g0.x, u), y: lerp(DIG.y, g0.y, u), zoom: Math.exp(lerp(Math.log(16), Math.log(P.s), u)) }));
  }
  const push = P.s * (1 + 0.08 * ss(seg(t, K.retract[0], K.toCaret)));
  const out = [ss(seg(t, K.retract[0], K.retract[0] + 0.35)), ss(seg(t, K.retract[1], K.retract[1] + 0.35)), ss(seg(t, K.retract[2], K.retract[2] + 0.35)), ss(seg(t, K.retract[3], K.retract[3] + 0.4))];
  if (t < K.toCaret) {
    const its = items();
    sceneFront(g, t, E.camera({ x: g0.x, y: g0.y, zoom: push }), { out });
    const rim = ss(seg(t, K.retract[4], K.retract[4] + 0.3));
    if (rim > 0) { const cam = E.camera({ x: g0.x, y: g0.y, zoom: push }), a = cam.proj(0, 0), b = cam.proj(1920, 1080); g.save(); g.strokeStyle = E.rgba(PAL.accent, 0.7 * rim); g.lineWidth = 2; g.shadowColor = E.rgba(PAL.accent, rim); g.shadowBlur = 24; rr(g, a.x, a.y, b.x - a.x, b.y - a.y, 26 * a.s); g.stroke(); g.restore(); }
    return;
  }
  // 窗口 → 线 → 光标：真窗口竖向压扁（越扁越亮、越偏青柠），再收成光标
  E.bg(g, { lift: 0.9, cool: 0.7 });
  const cam = E.camera({ x: g0.x, y: g0.y, zoom: push });
  const c = cam.proj(960, 540), ww = 1920 * c.s, hh = 1080 * c.s;
  // 三步：竖向压成线（显像管关机）→ 线横向收成一个点 → 点竖着长成光标
  const u1 = ei(seg(t, K.toCaret, K.toCaret + 0.22)), u2a = eio(seg(t, K.toCaret + 0.22, K.toCaret + 0.38)), u2b = eio(seg(t, K.toCaret + 0.36, K.silence2));
  const u2 = Math.max(u2a, 1e-6 * (t > K.toCaret + 0.22));
  const w = lerp(ww, END_CARET.h / 14, u2a), h = u2a < 1 ? lerp(hh, 5, u1) : lerp(5, END_CARET.h, u2b);
  const x = lerp(c.x, END_CARET.x, u2a), y = lerp(c.y, END_CARET.y, u2a);
  if (u2 <= 0) {
    const [wc, wg] = E.buf('win', 1920, 1080); wg.clearRect(0, 0, 1920, 1080);
    const its = items();
    drawWindowWorld(wg, t, { base: (px, py) => [1, 0, 0, 1, px, py], checksAll: true, out: [1, 1, 1, 1] }); wg.setTransform(1, 0, 0, 1, 0, 0);
    wg.strokeStyle = E.rgba(PAL.accent, 0.7); wg.lineWidth = 3; rr(wg, 1.5, 1.5, 1917, 1077, 26); wg.stroke();
    g.save(); g.drawImage(wc, x - w / 2, y - h / 2, w, h);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = ss(seg(u1, 0.55, 1)); g.fillStyle = E.rgba(PAL.accent, 0.9); rr(g, x - w / 2, y - h / 2, w, h, lerp(26 * c.s, 2, u1)); g.fill();
    if (u1 > 0.5) E.glow(g, x, y, 260, PAL.accent, 0.3 * (u1 - 0.5));
    g.restore();
  } else E.caret(g, x, y, Math.max(h, w), { sx: w / (Math.max(h, w) / 14), sy: h / Math.max(h, w), glow: 0.6 + 0.4 * u2b });
  E.vignette(g, 0.5);
}
function sceneEnd(g, t) {
  E.bg(g, { lift: 0.9, cool: 0.7 });
  const st = t < K.echo ? 1 : t < K.echoType ? blinkOn(t - K.echo) : t < typedEnd() ? 1 : t < K.caretOff ? blinkOn(t - K.echo) : 0;
  const ta = 1 - ss(seg(t, K.endFade, K.endFade + 0.6));
  g.font = font(END_CARET.px, 500); g.fillStyle = PAL.text; g.textBaseline = 'alphabetic';
  const s = typed(ECHO, t), base = END_CARET.y + 11 * 4.81;
  g.globalAlpha = ta; g.fillText(s, END_CARET.x - 3 * 4.81, base); g.globalAlpha = 1;
  const cx = t < K.endFade ? END_CARET.x + g.measureText(s).width : lerp(END_CARET.x + g.measureText(s).width, END_CARET.x, eio(seg(t, K.endFade + 0.2, K.endFade + 0.8)));
  E.caret(g, cx, END_CARET.y, END_CARET.h, { on: st, glow: 1 });
  // 片尾信息
  const ea = ss(seg(t, K.endCard, K.endCard + 0.6)) * ta;
  if (ea > 0) {
    g.globalAlpha = ea; const x = END_CARET.x - 3 * 4.81; let y = base + 120;
    g.font = font(34, 600); g.fillStyle = PAL.text; g.fillText('Room to Think', x, y);
    g.font = font(22, 500, 'mono'); g.fillStyle = PAL.dim;
    g.font = font(24, 500, 'mono'); g.fillText('a launch film for Tidy, a fictional app', x + 280, y);
    y += 56; g.fillStyle = PAL.dim; g.fillText('Dark Tech Keynote  ·  Lemo-Opuscar', x, y);
    y += 38; g.fillText('LemoLab × Claude Opus 5.5', x, y);
    y += 54; g.font = font(19, 500, 'mono'); g.fillStyle = PAL.mute;
    g.fillText('Voice: Kokoro af_kore (Apache-2.0)  ·  Marimba / vibraphone / glockenspiel: VCSL (CC0)', x, y);
    y += 30; g.fillText('Type: Inter, Inter Tight, JetBrains Mono (OFL)  ·  All UI, music and sound are original', x, y);
    g.globalAlpha = 1;
  }
  E.vignette(g, 0.5);
}
const typedEnd = () => ECHO[ECHO.length - 1].t + 0.2;

// ───────────────── 字幕 ─────────────────
let LINES = null;
export function setLines(lines, dur) {
  LINES = lines.filter(l => !l.onscreen).map(l => { const d = dur?.[l.id] ?? 1.2; return { ...l, t0: K.vo[l.id], t1: K.vo[l.id] + Math.max(1.8, d + 0.6) }; });
}
export function subs() { return (LINES || []).map(l => ({ t0: l.t0, t1: l.t1, text: l.text })); }
function drawSubs(g, t) {
  if (!LINES) return;
  for (const l of LINES) { if (t < l.t0 || t > l.t1) continue; const a = Math.min(clamp((t - l.t0) / 0.16), clamp((l.t1 - t) / 0.16)); E.toast(g, l.text, a, { dense: t < 16 ? 1 : 0 }); }
}

// ───────────────── 总装 ─────────────────
export function renderFilm(g, t, o = {}) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  if (t < K.dim) {
    sceneMess(g, t);
    // 插入镜头（UI 展开 / 收起）
    const ki = K.inserts.findIndex((a, i) => i < 3 && t >= a && t < K.inserts[i + 1]);
    if (ki >= 0) {
      const lt = t - K.inserts[ki], [ic, ig] = E.buf('insert');
      insertScene(ig, ki, lt);
      const src = [[330, 690], [1010, 250], [1400, 900]][ki];
      const pin = eo(clamp((lt + 0.042) / 0.1)), pout = ki === 2 ? ei(clamp((lt - 0.4) / 0.1)) : 0, p = pin * (1 - pout);
      const w = lerp(160, W, p), h = lerp(90, H, p), x = lerp(src[0] - 80, 0, p), y = lerp(src[1] - 45, 0, p);
      g.save(); rr(g, x, y, w, h, lerp(18, 0, p)); g.clip(); g.drawImage(ic, x, y, w, h); g.restore();
    }
  } else if (t < K.rotZero) sceneProduct(g, t);
  else if (t < K.num) sceneFront(g, t, camPushNum(t));
  else if (t < K.numBack) sceneNumber(g, t);
  else if (t < K.silence2) sceneBreath(g, t);
  else sceneEnd(g, t);
  if (!o.nosub) drawSubs(g, t);
}

// ───────────────── 事件表（混音用） ─────────────────
export function buildEvents() {
  const ev = [], add = (t, type, x = {}) => ev.push({ t: +t.toFixed(4), type, ...x });
  TITLE.forEach((c, i) => add(c.t, 'key', { c: c.c, i }));
  add(K.ret, 'return'); add(K.typeI, 'key', { c: 'I', i: 99 });
  for (let t = 0; t < K.typeStart; t += 1) add(t, 'caret_tick');
  K.ding.forEach((t, i) => add(t, 'ding', { i }));
  const its = items();
  its.forEach(it => { if (it.src === 'ding' || it.t0 < 0) return; const c = camMess(it.t0), pr = c.proj(it.x, it.y, it.z); add(it.t0, 'spawn_' + (it.type === 'window' ? 'window' : it.type), { kind: it.kind || '', fg: !!it.fg, pan: pr ? +clamp(pr.x / W * 2 - 1, -1, 1).toFixed(2) : 0, big: it.type === 'window' ? +(it.w / 600).toFixed(2) : 0 }); });
  K.inserts.slice(0, 3).forEach((t, i) => add(t, 'insert', { i })); add(K.drown, 'insert_back');
  add(K.freeze, 'freeze'); add(K.stretch, 'stretch'); add(K.press, 'press');
  snap().forEach((s, i) => add(s.t0 + s.dur * 0.6, 'land', { g: s.gi, pan: +((s.slot.x / 1920) * 2 - 1).toFixed(2), k: s.slot.i }));
  snap().forEach((s, i) => add(s.t0, 'lift', { g: s.gi }));
  add(K.gridShow, 'grid');
  for (let w = 0; w < 4; w++) add(K.sort + w * 0.25, 'sort_wave', { w });
  add(K.chrome, 'chrome'); add(K.chrome + 0.4, 'caret_logo'); add(K.dim, 'dim');
  add(K.reveal, 'sweep'); K.checks.forEach((t, i) => add(t, 'check', { i }));
  add(K.pushNum, 'push'); add(K.num, 'num'); K.locks.forEach((t, i) => add(t, 'lock', { i })); add(K.files, 'files'); add(K.line2, 'line2');
  add(K.numBack, 'num_back'); K.retract.forEach((t, i) => add(t, 'retract', { i })); add(K.toCaret, 'to_caret'); add(K.toCaret + 0.22, 'to_caret2');
  add(K.silence2, 'silence2'); add(K.echo, 'caret_tick');
  ECHO.forEach((c, i) => add(c.t, 'key', { c: c.c, i, echo: 1 }));
  for (let t = K.echo + 1; t < K.caretOff; t += 1) if (t < K.echoType || t > typedEnd()) add(t, 'caret_tick');
  add(K.endCard, 'end_card'); add(K.caretOff, 'caret_off');
  if (LINES) LINES.forEach(l => add(l.t0, 'vo', { id: l.id }));
  return ev.sort((a, b) => a.t - b.t);
}
