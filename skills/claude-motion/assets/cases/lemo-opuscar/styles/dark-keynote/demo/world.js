// world.js — 混乱世界：按音符表生成几百个 UI 元素（文件 / 照片 / 通知 / 窗口），以及它们的吸附槽位与分类槽位
import { mulberry, clamp, eo, ei, ss, seg, lerp } from './engine.js';
import { monotone } from '../../../core/lib.js';
import { K, voice1, voice2, voice3 } from './timeline.js';

// 世界 = 一块 1920×1080 的"屏幕"（桌面），摄影机在它上面推拉
export const SCR = { x: 0, y: 0, w: 1920, h: 1080 };
// 便签窗口与片名文字（世界坐标）
export const NOTE = { x: 520, y: 350, w: 800, h: 430 };
export const TXT = { x: 700, y: 560, px: 30, lh: 44 };
export const CARET_H = 38;

// ───── 摄影机轨迹（混乱段 0–20 s）─────
const Z0 = 5.0;
export const CAM0 = { x: TXT.x + 103, y: TXT.y - 10 };      // 开场特写：片名居中
// 对数空间的关键帧（每小节拉远一档，速度连续）
const ZK = monotone([[0, Math.log(Z0 / 1.04)], [3.9, Math.log(Z0)], [6, Math.log(3.1)], [8, Math.log(2.0)], [10, Math.log(1.35)], [12, Math.log(1.0)], [15, Math.log(0.8)]]);
export function pullZoom(t) { return Math.exp(ZK(Math.min(t, 15))); }

// ───── 元素生成 ─────
const FILES = ['final_v2.pdf', 'final_FINAL.pdf', 'final_FINAL_2.pdf', 'Untitled 38.txt', 'notes (copy).txt', 'IMG_4471.jpg', 'Screenshot 09-12.png', 'budget_new_NEW.xlsx', 'deck_v7_real.key', 'todo.txt', 'todo (1).txt', 'scan0003.pdf', 'invoice(3).pdf', 'draft.docx', 'draft-old.docx', 'export.zip', 'Untitled 39.txt', 'recording.m4a', 'IMG_4472.jpg', 'resume_2026.pdf'];
const EXT = { pdf: ['PDF', '#E0575B'], txt: ['TXT', '#6E7890'], jpg: ['JPG', '#4C9BE8'], png: ['PNG', '#2FB6A6'], xlsx: ['XLS', '#3FA66B'], key: ['KEY', '#5B7CFA'], docx: ['DOC', '#4C7BE8'], zip: ['ZIP', '#9A7B4F'], m4a: ['M4A', '#C55FD0'] };
const NOTIFS = [['Messages', '3 new messages'], ['Calendar', 'Standup in 5 min'], ['Reminders', 'Pay the invoice'], ['Updates', 'Restart to update'], ['Mail', '12 unread'], ['Photos', 'New memories'], ['Storage', 'Disk almost full'], ['Chat', '@you in #general'], ['Calendar', 'Moved: Team sync'], ['Messages', 'Are you there?'], ['Backup', 'Backup failed'], ['Mail', 'Re: Re: Fwd: deck']];
const WINS = [
  { t: 5.0, kind: 'sheet', title: 'budget_new_NEW.xlsx', w: 470, h: 300, x: 1180, y: 250 },
  { t: 6.0, kind: 'viewer', title: 'IMG_4471.jpg', w: 420, h: 330, x: 260, y: 170 },
  { t: 7.0, kind: 'code', title: 'untitled-3', w: 440, h: 300, x: 1230, y: 640 },
  { t: 8.0, kind: 'inbox', title: 'Inbox', w: 500, h: 400, x: 90, y: 600 },
  { t: 9.0, kind: 'chat', title: 'Team chat', w: 400, h: 300, x: 1420, y: 120 },
  { t: 10.0, kind: 'browser', title: 'Browser', w: 620, h: 360, x: 700, y: 110 },
  { t: 10.5, kind: 'sheet', title: 'budget_new_NEW (2).xlsx', w: 430, h: 280, x: 90, y: 60 },
  { t: 11.0, kind: 'viewer', title: 'IMG_4472.jpg', w: 380, h: 300, x: 1500, y: 700 },
  { t: 11.5, kind: 'chat', title: 'Family', w: 360, h: 280, x: 560, y: 720 },
  { t: 12.0, kind: 'code', title: 'untitled-4', w: 420, h: 290, x: -120, y: 380 },
  { t: 12.5, kind: 'inbox', title: 'Inbox — Work', w: 460, h: 360, x: 1560, y: 360 },
  { t: 13.0, kind: 'browser', title: 'Browser', w: 560, h: 330, x: 900, y: 820 },
  { t: 13.5, kind: 'sheet', title: 'copy of budget.xlsx', w: 420, h: 280, x: 1080, y: -90 },
  { t: 14.0, kind: 'viewer', title: 'Screenshot 09-12.png', w: 360, h: 280, x: -60, y: 820 },
];

let _items = null;
export function items() {
  if (_items) return _items;
  const R = mulberry(20260926), out = [];
  const caretW = { x: TXT.x + 8, y: TXT.y + TXT.lh - 11 };      // 第二行 "I" 之后
  const visible = t => { const z = pullZoom(t), c = camCenter(t); return [c.x - 960 / z, c.y - 540 / z, c.x + 960 / z, c.y + 540 / z]; };
  const place = (t, w, h, avoidNote) => {
    const [x0, y0, x1, y1] = visible(Math.min(t + 0.4, K.freeze));
    const ox0 = Math.max(x0, -220), oy0 = Math.max(y0, -170), ox1 = Math.min(x1, 2140), oy1 = Math.min(y1, 1250);
    for (let k = 0; k < 40; k++) {
      const x = lerp(ox0 + w * 0.3, ox1 - w * 0.3, R()), y = lerp(oy0 + h * 0.3, oy1 - h * 0.3, R());
      if (Math.hypot(x - caretW.x, y - caretW.y) < 90 + Math.max(w, h) * 0.45) continue;          // 给光标留一道缝
      if (avoidNote && x > TXT.x - 60 && x < TXT.x + 300 && y > TXT.y - 80 && y < TXT.y + 90) continue;
      return [x, y];
    }
    return [lerp(ox0, ox1, R()), lerp(oy0, oy1, R())];
  };
  const add = (it) => { it.id = out.length; out.push(it); return it; };
  // 1) 三声通知（特写里压住字行）
  const dn = [[TXT.x + 250, TXT.y - 44, 0], [TXT.x + 150, TXT.y + 60, 1], [TXT.x - 40, TXT.y + 128, 2]];
  K.ding.forEach((t, i) => add({ type: 'notif', t0: t, x: dn[i][0], y: dn[i][1], w: 330, h: 74, rot: 0, z: 0, app: [0, 1, 2][i], txt: NOTIFS[[9, 1, 2][i]], seed: i, src: 'ding' }));
  // 2) 声部 1（在拍上）→ 文件；10 s 后部分 → 照片
  const mkFile = (t, n) => { const [x, y] = place(t, 70, 86, t < 9); const f = FILES[Math.floor(R() * FILES.length)], e = EXT[f.split('.').pop()] || EXT.txt; return add({ type: 'file', t0: t, x, y, w: 70, h: 86, rot: (R() - 0.5) * 0.28, z: 0, name: f, ext: e[0], tint: e[1], s: 1.05 + R() * 0.25, note: n }); };
  const mkPhoto = (t, n) => { const w = 170 + R() * 70; const [x, y] = place(t, w, w * 0.72, t < 9); return add({ type: 'photo', t0: t, x, y, w, h: w * 0.72, rot: (R() - 0.5) * 0.6, z: 0, seed: Math.floor(R() * 999), dir: R() < 0.5 ? -1 : 1, note: n }); };
  const mkNotif = (t, n, rr = 0.1) => { const [x, y] = place(t, 330, 74, false); return add({ type: 'notif', t0: t, x, y, w: 330, h: 74, rot: (R() - 0.5) * rr, z: 0, app: Math.floor(R() * 7), txt: NOTIFS[Math.floor(R() * NOTIFS.length)], bd: R() < 0.35 ? String(1 + Math.floor(R() * 99)) : null, seed: Math.floor(R() * 999), note: n }); };
  for (const n of voice1()) {
    const t = n.t;
    if (t < 8) { if (n.i % 3 === 0) mkFile(t, n); }
    else if (t < 12) { mkFile(t, n); if (n.i % 3 === 0) mkPhoto(t + 0.001, n); }
    else { mkFile(t, n); mkPhoto(t + 0.001, n); if (n.i % 2 === 0) mkFile(t + 0.002, n); }
  }
  // 3) 声部 2：6–8 照片；8 s 后错相 → 照片 + 通知
  for (const n of voice2()) {
    const t = n.t;
    if (t < 8) { if (n.i % 2 === 0) mkPhoto(t, n); }
    else { if (n.i % 3 === 0) mkPhoto(t, n); else mkNotif(t, n, t > 12 ? 0.25 : 0.08); if (t > 12) mkNotif(t + 0.001, n, 0.3); }
  }
  // 4) 声部 3（钟琴）→ 通知
  for (const n of voice3()) mkNotif(n.t, n, 0.2);
  // 5) 窗口（小节 / 拍上）
  WINS.forEach((w, i) => add({ type: 'window', t0: w.t, x: w.x + w.w / 2, y: w.y + w.h / 2, w: w.w, h: w.h, rot: (R() - 0.5) * 0.06, z: 0, kind: w.kind, title: w.title, app: i, seed: i + 3 }));
  // 6) 前景视差卡（贴着镜头掠过，虚化）
  [[5.25, 1.8, 0.14], [6.75, -1.6, 0.13], [8.5, 1.5, 0.12], [9.75, -1.4, 0.1], [10.75, 1.3, 0.09], [11.5, -1.2, 0.08]].forEach(([t, side, z], k) => {
    const c = camCenter(t), zz = pullZoom(t), s = 1 / (1 / zz - z);
    const x = c.x + side * 700 / s + side * 40, y = c.y + (k % 2 ? 260 : -300) / s;
    add({ type: 'notif', t0: t, x, y, w: 330, h: 74, rot: 0, z, app: k + 2, txt: NOTIFS[(k * 5) % NOTIFS.length], seed: 50 + k, fg: true });
  });
  // 数量与分组正好填满吸附网格：Desktop 5 行、Photos 3 行、Inbox 4 行（每行 22 格）
  const TGT = [GC * 5, GC * 3, GC * 4], mk = [mkFile, mkPhoto, (t, n) => mkNotif(t, n, 0.3)];
  const late = i => out[i].t0 > 12 && out[i].type !== 'window' && !out[i].fg && out[i].src !== 'ding';
  const cnt = () => [0, 1, 2].map(gi => out.filter(it => groupOf(it) === gi).length);
  for (let guard = 0; guard < 400; guard++) {
    const c = cnt(), over = [0, 1, 2].find(gi => c[gi] > TGT[gi]), under = [0, 1, 2].find(gi => c[gi] < TGT[gi]);
    if (over === undefined && under === undefined) break;
    if (over !== undefined) { const cand = out.map((it, i) => i).filter(i => late(i) && groupOf(out[i]) === over); out.splice(cand[Math.floor(R() * cand.length)], 1); }
    else { const ln = voice1().filter(n => n.t >= 12); const n = ln[Math.floor(R() * ln.length)]; mk[under](n.t + 0.003, n); }
  }
  out.sort((a, b) => a.t0 - b.t0 || (a.type === 'window' ? -1 : 1));
  out.forEach((it, i) => it.id = i);
  _items = out; return out;
}
export function camCenter(t) {
  const u = ss(seg(t, K.pullStart, K.pullEnd));
  return { x: lerp(CAM0.x, 960, u), y: lerp(CAM0.y, 540, u) };
}

// ───── 入场动画 & 冻结 ─────
export function poseAt(it, t) {
  const ta = Math.min(t, K.freeze), a = ta - it.t0;
  if (a < 0) return null;
  let x = it.x, y = it.y, rot = it.rot, s = 1, al = 1;
  if (it.type === 'file') { const p = clamp(a / 0.22); y -= 34 * (1 - eo(p)); if (p >= 1) y -= 6 * Math.max(0, Math.sin(clamp((a - 0.22) / 0.14) * Math.PI)); al = clamp(a / 0.06); }
  else if (it.type === 'photo') { const p = eo(clamp(a / 0.3)); x -= it.dir * 260 * (1 - p); y -= 120 * (1 - p); rot += it.dir * 0.5 * (1 - p); al = clamp(a / 0.08); }
  else if (it.type === 'notif') { const p = eo(clamp(a / 0.24)); x += 90 * (1 - p); al = clamp(a / 0.1); }
  else if (it.type === 'window') { const p = clamp(a / 0.22); s = 0.94 + 0.06 * (1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2)); al = clamp(a / 0.12); }
  // 14–15 颤抖（冻结后停住）
  if (ta > 13.8) { const k = Math.floor(ta * 24), m = 2.4 * ss(seg(ta, 13.8, 14.9)); x += (Math.sin(k * 12.9898 + it.id * 78.233) * 43758.5 % 1) * m; y += (Math.sin(k * 39.346 + it.id * 11.135) * 24634.6 % 1) * m; }
  return { x, y, rot, s, al };
}

// ───── 吸附网格：22 列 × 12 行，按类型分三段（Desktop / Photos / Inbox），段间留缝 ─────
export const TILE = 60, GAP = 14, GC = 22, GR = 12, NSLOT = GC * GR, BAND = 28;
const PITCH = TILE + GAP, GX0 = (1920 - (GC * PITCH - GAP)) / 2, GY0 = (1080 - (GR * PITCH - GAP + 2 * BAND)) / 2;
export const ROWS = [[0, 5], [5, 3], [8, 4]];                     // 每组 [起始行, 行数]
const rowY = r => GY0 + r * PITCH + (r >= 5 ? BAND : 0) + (r >= 8 ? BAND : 0) + TILE / 2;
export const SLOTS = []; for (let j = 0; j < GR; j++) for (let i = 0; i < GC; i++) SLOTS.push({ i, j, x: GX0 + i * PITCH + TILE / 2, y: rowY(j) });
export const CARET_HOME = { x: GX0 - 30, y: rowY(0) };           // 收拢后光标停在第一行行首
export const RING = 2600;
let _snap = null;
/** 每个元素按类型飞回自己那一段：组内按 y 分行、行内按 x 排，少交叉；起飞时间按离光标的距离错开（一道浪） */
export function snap() {
  if (_snap) return _snap;
  const its = items(), pts = its.map(it => poseAt(it, K.freeze));
  const caret = { x: TXT.x + 8, y: TXT.y + TXT.lh - 11 }, res = new Array(its.length);
  ROWS.forEach(([r0, nr], gi) => {
    const ids = its.map((it, i) => i).filter(i => groupOf(its[i]) === gi).sort((a, b) => pts[a].y - pts[b].y);
    for (let r = 0; r < nr; r++) {
      const row = ids.slice(r * GC, (r + 1) * GC).sort((a, b) => pts[a].x - pts[b].x);
      row.forEach((id, k) => {
        const slot = SLOTS[(r0 + r) * GC + k], d = Math.hypot(pts[id].x - caret.x, pts[id].y - caret.y), trip = Math.hypot(pts[id].x - slot.x, pts[id].y - slot.y);
        res[id] = { slot, gi, t0: K.press + 0.03 + d / RING, dur: 0.26 + 0.14 * Math.min(1, trip / 1200), trip };
      });
    }
  });
  _snap = res; return res;
}
export const groupOf = it => it.type === 'photo' ? 1 : it.type === 'notif' ? 2 : 0;
// ───── 分类后的槽位（Tidy 窗口内容区，44px 格）─────
export const TW = { bar: 72, side: 360, status: 56 };
export const ST = 64, SG = 12, SCOLS = 19, SROWS = 3;
let _sorted = null;
/** 分类布局：每组最多 3 行 × 19 列，放不下的飞进本组最后一格的 "+N" 叠卡 */
export function sorted() {
  if (_sorted) return _sorted;
  const its = items(), x0 = TW.side + 44, groups = [[], [], []];
  its.forEach((it, i) => groups[groupOf(it)].push(i));
  const res = new Array(its.length); let y = TW.bar + 30; const heads = [], stacks = [];
  const cap = SCOLS * SROWS - 1;
  groups.forEach((g, gi) => {
    heads.push({ y, gi, n: g.length }); y += 46;
    const slot = k => ({ x: x0 + (k % SCOLS) * (ST + SG) + ST / 2, y: y + Math.floor(k / SCOLS) * (ST + SG) + ST / 2 });
    const st = { ...slot(Math.min(g.length - 1, cap)), gi }; stacks.push(st);
    g.forEach((id, k) => { res[id] = k < cap ? { ...slot(k), gi, k } : { x: st.x, y: st.y, gi, k, stack: true }; });
    y += SROWS * (ST + SG) + 22;
  });
  _sorted = { pos: res, heads, stacks, counts: groups.map(g => g.length) };
  return _sorted;
}
