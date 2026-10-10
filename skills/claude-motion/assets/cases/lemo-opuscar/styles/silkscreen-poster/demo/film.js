// film.js · 场景 demo：户外步道指南（丝印旅行海报）
// 时间线完全由 content.json 推出来（1–4 条步道都成立），100 BPM，一拍 0.6 s
import { makeTextures, squeegee, screenFrame, wipeFront, wipeRegion, ink, rectPath, polyPath, circlePath, ringPath, clamp, lerp, mix, hash, mulberry, paperSheet, inkFinish } from './engine/silk.js';
import { buildPoster, drawPoster, drawBanner, swapFrontLine, pickInk, BANNER_ART, BANNER_BANDS, PW, PH, ART, BW, BH, readTime } from './engine/poster.js';

export const BPM = 100, B = 60 / BPM;
const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const eo = t => 1 - Math.pow(1 - clamp(t), 3);
const ei = t => Math.pow(clamp(t), 3);
const seg = (t, a, b) => clamp((t - a) / (b - a));
const W = 1920, H = 1080;

let C, T, POS, TL, ctx;
// 世界坐标（印刷台）：横幅居中在原点，海报在下方
const BAN = [-900, -220];          // 横幅左上角（1800×440，中心在原点）
const PO = [-500, 420];            // 海报左上角（印刷台上）

export function setup(content, canvas) {
  C = content; ctx = canvas.getContext('2d');
  T = makeTextures(C.palette.paper, 7);
  POS = C.trails.map((tr, i) => buildPoster(C, tr, i, C.trails.length));
  TL = timeline();
  return TL;
}
const pal = (key) => C.palette[key] || C.palette.noon;

// ---------------- 时间线 ----------------
function timeline() {
  const n = POS.length, secs = [], ev = [];
  const E = (t, type, o = {}) => ev.push({ t: +t.toFixed(3), type, ...o });
  // S1 横幅 + 片名
  const s1 = { kind: 'banner', t0: 0, sky: [-.45, 1.0], lift: 1.0, title: [1.2, 1.5], footer: [1.35, 1.6], pull: [1.0, 1.65], t1: 8 * B };
  E(0, 'squeegee', { dur: 1.0, ink: 'sky' }); E(1.0, 'lift'); E(1.2, 'squeegee', { dur: .3, ink: 'title' }); E(1.35, 'squeegee', { dur: .25, ink: 'footer' });
  E(1.5, 'title'); secs.push(s1);
  let s = s1.t1;
  POS.forEach((P, i) => {
    const mode = i === 0 ? 'press' : (i === n - 1 && n > 1 ? 'ascent' : 'quick');
    const statStr = P.items.map(it => it.value).join(' ');
    const sec = { kind: mode, P, i, t0: s };
    if (mode === 'press') {
      sec.tilt = [s, s + B];
      sec.pulls = { sky: s + B, far: s + 2 * B, mid: s + 3 * B, near: s + 4 * B };
      sec.pullDur = .45; sec.lift = s + 5 * B; sec.push = [s + 5 * B, s + 7 * B];
      sec.band = s + 6 * B; sec.name = s + 7 * B;
      sec.items = P.items.map((_, k) => s + 8 * B + k * B / 2);
    } else if (mode === 'quick') {
      sec.pulls = { sky: s - .3, far: s + B / 2, mid: s + B, near: s + 1.5 * B };
      sec.pullDur = .26; sec.back = [s + 2 * B, s + 3.2 * B];
      sec.band = s + 2.5 * B; sec.name = s + 3 * B;
      sec.items = P.items.map((_, k) => s + 3.5 * B + k * B / 2);
    } else {
      sec.climb = [s, s + 7 * B]; sec.clack = s + 8 * B; sec.down = [s + 8 * B, s + 9.5 * B];
      sec.band = s + 9 * B; sec.name = s + 9.5 * B;
      sec.items = P.items.map((_, k) => s + 10 * B + k * B / 2);
      sec.pals = [...new Set([POS[i - 1] ? POS[i - 1].trail.time_of_day : 'noon', 'golden', P.trail.time_of_day])].filter(k => C.palette[k]);
    }
    // ---- 事件（音效 / 配乐卡点都从这里取） ----
    if (mode === 'press') { E(sec.tilt[0], 'tilt', { i }); ['sky', 'far', 'mid', 'near'].forEach((k, j) => E(sec.pulls[k], 'pull', { i, layer: k, n: j, dur: sec.pullDur })); E(sec.lift, 'lift', { i }); }
    else if (mode === 'quick') { E(s, 'wipe', { i }); ['sky', 'far', 'mid', 'near'].forEach((k, j) => E(sec.pulls[k], 'pull', { i, layer: k, n: j, dur: sec.pullDur, quick: 1 })); E(sec.back[0], 'pullback', { i }); }
    else {
      E(s, 'wipe', { i }); E(s, 'ascent', { i, dur: sec.climb[1] - sec.climb[0] });
      const nS = sec.pals.length - 1; for (let k = 1; k <= nS; k++) E(lerp(sec.climb[0], sec.climb[1], k / (nS + 1)), 'swap', { i, k, dur: .35 });
      ['near', 'spurC', 'spurB', 'spurA'].forEach((id, j) => E(lerp(sec.climb[0], sec.climb[1], [.12, .3, .5, .7][j]), 'part', { i, layer: id }));
      E(sec.climb[1], 'silence', { dur: sec.clack - sec.climb[1] }); E(sec.clack, 'clack', { i }); E(sec.down[0], 'tiltdown', { i });
    }
    E(sec.band, 'band', { i }); E(sec.name, 'name', { i });
    sec.items.forEach((a, k) => E(a, 'item', { i, k, last: k === sec.items.length - 1 ? 1 : 0, climb: P.items[k].climb ? 1 : 0 }));
    const lastItem = sec.items[sec.items.length - 1] ?? sec.name;
    const need = Math.max(sec.name + readTime(P.trail.name), lastItem + readTime(statStr));
    sec.t1 = Math.ceil((need + .05) / B) * B + (mode === 'ascent' ? 0 : B);
    secs.push(sec); s = sec.t1;
  });
  // S5 墙面落版
  const foot = readTime(C.footer);
  const wall = { kind: 'wall', t0: s, pull: [s, s + 2 * B], t1: 0 };
  wall.hold0 = s + 2 * B; wall.t1 = wall.hold0 + Math.ceil(Math.max(3.6, foot) / B) * B;
  secs.push(wall);
  const end = { kind: 'end', t0: wall.t1, t1: wall.t1 + 6 * B }; secs.push(end);
  // 快印段结尾的静音（进入签名段之前）
  const asc = secs.find(q => q.kind === 'ascent'); if (asc) E(asc.t0 - 2 * B, 'silence', { dur: 2 * B, pre: 1 });
  E(wall.t0, 'wallpull'); E(wall.hold0, 'land', { dur: wall.t1 - wall.hold0 }); E(end.t0, 'endcard', { dur: end.t1 - end.t0 }); E(end.t0 + .5, 'endpull', { dur: .3 });
  secs.forEach(q => E(q.t0, 'section', { kind: q.kind, t1: q.t1, time_of_day: q.P ? q.P.trail.time_of_day : null }));
  ev.sort((a, b) => a.t - b.t);
  return { secs, ev, dur: end.t1 };
}

// ---------------- 相机 ----------------
function cam(cx, cy, z, rot = 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(W / 2, H / 2); if (rot) ctx.rotate(rot); ctx.scale(z, z); ctx.translate(-cx, -cy); }

// ---------------- 印刷台：旧木工作台（平涂木板 + 木纹 + 干掉的墨渍 + 胶带痕） ----------------
const TABLE = '#6B4E36';
let TABLE_CACHE = null;
function buildTable() {
  const r = mulberry(21), planks = [], stains = [], tapes = [];
  const x0 = -2200, x1 = 2200, y0 = -1400, y1 = 2600, ph = 170;
  const tones = ['#6E5039', '#664A34', '#73553C', '#6A4C35', '#5F4430'];
  for (let y = y0, k = 0; y < y1; y += ph, k++) {
    const grain = new Path2D(), knots = new Path2D();
    for (let g = 0; g < 7; g++) {
      const gy = y + 14 + g * 22 + r() * 8, amp = 3 + r() * 5, f = .002 + r() * .003, ph0 = r() * 6;
      grain.moveTo(x0, gy); for (let x = x0; x <= x1; x += 40) grain.lineTo(x, gy + amp * Math.sin(x * f + ph0) + 2 * Math.sin(x * f * 3.7));
    }
    for (let q = 0; q < 3; q++) { const kx = x0 + r() * (x1 - x0), ky = y + 30 + r() * (ph - 60); knots.ellipse(kx, ky, 22 + r() * 18, 7 + r() * 5, 0, 0, 7); }
    planks.push({ y, color: tones[k % tones.length], grain, knots });
  }
  // 干墨渍：不规则的平涂块（印刷时溢出的墨），颜色取自本片的调色板
  const pals = Object.keys(C.palette).filter(k => C.palette[k] && C.palette[k].sky2).map(k => C.palette[k]);
  const avoid = (x, y) => (x > PO[0] - 60 && x < PO[0] + PW + 60 && y > PO[1] - 60 && y < PO[1] + PH + 60) || (x > BAN[0] - 60 && x < BAN[0] + BW + 60 && y > BAN[1] - 60 && y < BAN[1] + BH + 60);
  for (let i = 0; i < 12; i++) {
    let x, y, n = 0; do { x = x0 + 300 + r() * (x1 - x0 - 600); y = y0 + 200 + r() * (y1 - y0 - 400); n++; } while (avoid(x, y) && n < 30);
    const pp = pals[i % pals.length], col = [pp.sky2, pp.near, pp.sun, pp.mid, pp.far][(r() * 5) | 0];
    const R = 50 + r() * 70, pts = [], m = 11;
    for (let j = 0; j < m; j++) { const a = j / m * 6.283, rr = R * (.65 + .5 * r()) * (j % 3 === 0 ? 1.3 : 1); pts.push([x + Math.cos(a) * rr * 1.25, y + Math.sin(a) * rr * .8]); }
    const path = new Path2D(); pts.forEach((q, j) => { const nq = pts[(j + 1) % m]; if (!j) path.moveTo((q[0] + nq[0]) / 2, (q[1] + nq[1]) / 2); else path.quadraticCurveTo(q[0], q[1], (q[0] + nq[0]) / 2, (q[1] + nq[1]) / 2); });
    path.closePath();
    if (r() < .45) { const d = new Path2D(); d.arc(x + R * 1.6, y + (r() - .5) * R, 4 + r() * 6, 0, 7); path.addPath(d); }   // 甩出的墨点
    if (r() < .35) { const sm = new Path2D(); const sx = x - R * 2.4; sm.rect(sx, y - 5, R * 1.8, 10 + r() * 6); path.addPath(sm); }   // 刮刀抹痕
    stains.push({ path, col: mix(col, TABLE, .45), a: .7 });
  }
  // 胶带痕：撕下后留下的旧胶带条（浅米色、边缘不齐）
  for (let i = 0; i < 9; i++) {
    let x, y, n = 0; do { x = x0 + 300 + r() * (x1 - x0 - 600); y = y0 + 200 + r() * (y1 - y0 - 400); n++; } while (avoid(x, y) && n < 30);
    tapes.push({ x, y, w: 60 + r() * 120, h: 22 + r() * 8, a: (r() - .5) * .6, torn: r() < .6, dirty: r() < .5 });
  }
  return { planks, stains, tapes, x0, x1, ph };
}
function table() {
  if (!TABLE_CACHE) TABLE_CACHE = buildTable();
  const TB = TABLE_CACHE;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = TABLE; ctx.fillRect(0, 0, W, H); ctx.restore();
  for (const p of TB.planks) {
    ctx.fillStyle = p.color; ctx.fillRect(TB.x0, p.y, TB.x1 - TB.x0, TB.ph);
    ctx.fillStyle = 'rgba(35,22,12,.55)'; ctx.fillRect(TB.x0, p.y, TB.x1 - TB.x0, 5);           // 板缝
    ctx.fillStyle = 'rgba(255,230,190,.07)'; ctx.fillRect(TB.x0, p.y + 5, TB.x1 - TB.x0, 3);
    ctx.save(); ctx.strokeStyle = 'rgba(40,24,12,.22)'; ctx.lineWidth = 2; ctx.stroke(p.grain); ctx.fillStyle = 'rgba(40,24,12,.25)'; ctx.fill(p.knots); ctx.restore();
  }
  for (const s0 of TB.stains) { ctx.save(); ctx.globalAlpha = s0.a; ctx.fillStyle = s0.col; ctx.fill(s0.path); ctx.globalAlpha = s0.a * .5; ctx.translate(-2, -2); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fill(s0.path); ctx.restore(); }
  for (const tp of TB.tapes) {
    ctx.save(); ctx.translate(tp.x, tp.y); ctx.rotate(tp.a);
    ctx.fillStyle = tp.dirty ? 'rgba(205,184,140,.75)' : 'rgba(222,204,160,.8)';
    ctx.beginPath(); ctx.moveTo(-tp.w / 2, -tp.h / 2); ctx.lineTo(tp.w / 2, -tp.h / 2);
    if (tp.torn) { for (let k = 0; k <= 5; k++) ctx.lineTo(tp.w / 2 + (k % 2 ? -6 : 3), -tp.h / 2 + tp.h * k / 5); } else ctx.lineTo(tp.w / 2, tp.h / 2);
    ctx.lineTo(-tp.w / 2, tp.h / 2); ctx.closePath(); ctx.fill();
    if (tp.dirty) { ctx.fillStyle = 'rgba(60,40,25,.25)'; ctx.fillRect(-tp.w / 2 + 6, -3, tp.w * .5, 5); }
    ctx.restore();
  }
}
function regTape(x, y, w, h) {
  ctx.fillStyle = '#D9C38A';
  const L = 60, th = 16;
  for (const [px, py, sx, sy] of [[x, y, -1, -1], [x + w, y, 1, -1], [x, y + h, -1, 1], [x + w, y + h, 1, 1]]) {
    ctx.fillRect(Math.min(px, px + sx * L), py + (sy < 0 ? -th : 0) - sy * 2, L, th);
    ctx.fillRect(px + (sx < 0 ? -th : 0) - sx * 2, Math.min(py, py + sy * L), th, L);
  }
}
function sheetShadow(x, y, w, h, a = .3) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#000'; ctx.fillRect(x + 8, y + 12, w, h); ctx.restore(); }

// ---------------- 各段 ----------------
function banner(sec, t) {
  const p = seg(t, sec.sky[0], sec.sky[1]);
  const sqX = wipeFront([BAN[0], BAN[1], BW, BH], 'right', p, 34);
  // 相机：先跟刮板横移（特写），刮完拉开看整条横幅，随后缓推
  const k = eo(seg(t, sec.pull[0], sec.pull[1]));
  const zc = lerp(1.95, 1.8, ss(seg(t, 0, 1.0))), zw = .96;         // 开场特写 → 横幅撑满画宽（边距约 5%），占画高约 40%
  const cxClose = sqX - 150, cyClose = 0;
  let z = lerp(zc, zw, k), cx = lerp(cxClose, 0, k), cy = lerp(cyClose, 0, k);
  z *= 1 + .03 * ss(seg(t, 1.8, sec.t1));                 // 读片名时的缓推
  cam(cx, cy, z, lerp(-.03, 0, k));
  table();
  regTape(BAN[0], BAN[1], BW, BH);
  sheetShadow(BAN[0], BAN[1], BW, BH, .25);
  ctx.save(); ctx.translate(BAN[0], BAN[1]);
  drawBanner(ctx, C, { pal: pal(C.banner_time || 'golden'), T, sky: p, title: seg(t, sec.title[0], sec.title[1]), footer: seg(t, sec.footer[0], sec.footer[1]), reg: 1 });
  ctx.restore();
  // 湿墨反光：刚刮过的墨面在刮板后面亮一截，随刮板走、慢慢变哑
  const wet = 1 - seg(t, sec.sky[1], sec.sky[1] + .8);
  if (p > 0 && wet > 0) {
    ctx.save(); ctx.globalAlpha = wet; ctx.beginPath(); ctx.rect(BAN[0] + 14, BAN[1] + 14, Math.max(0, sqX - BAN[0] - 14), BANNER_ART[3]); ctx.clip();
    const g = ctx.createLinearGradient(sqX - 420, 0, sqX, 0); g.addColorStop(0, 'rgba(255,250,235,0)'); g.addColorStop(.6, 'rgba(255,250,235,.08)'); g.addColorStop(1, 'rgba(255,250,235,.34)');
    ctx.fillStyle = g; ctx.fillRect(sqX - 420, BAN[1], 420, BH);
    ctx.restore();
  }
  const lift = seg(t, sec.lift, sec.lift + .45);
  const box = [BAN[0] - 90, BAN[1] - 90, BW + 180, BH + 180];
  const emu = new Path2D(); emu.rect(box[0], box[1], box[2], box[3]); emu.rect(BAN[0] + 14, BAN[1] + 14, BW - 28, BANNER_ART[3]);
  if (lift < 1) screenFrame(ctx, box, { lift: ss(lift), frame: 40, mesh: 'rgba(236,214,128,.03)', emulsion: emu, emulsionAlpha: .55, meshStep: 3.4, meshLine: 'rgba(70,60,30,.16)' });
  // 刮板（分色刮：刀口上的墨珠按天空色带分段）
  if (t < sec.lift + .35) {
    const bp = pal(C.banner_time || 'golden');
    const up = ss(seg(t, sec.lift, sec.lift + .35));
    const x = sqX + 14 + up * 120, y0 = BAN[1] - 38, y1 = BAN[1] + BH + 38;
    const tt = (yy) => (yy - y0) / (y1 - y0);
    ctx.save(); ctx.globalAlpha = 1 - up;
    const BB = BANNER_BANDS;
    squeegee(ctx, [x, y0], [x, y1], [1, 0], { beads: [['sky2', bp.sky2], ['sky1', bp.sky1], ['far', bp.far]].map(([k, c]) => ({ t0: tt(BAN[1] + BB[k][0] + 16), t1: tt(BAN[1] + BB[k][1]), color: c })), seed: 3, scale: 1.25, roll: sqX / 30 });
    ctx.restore();
  }
  // 片名刮板（快速一刮，深色墨）
  const tp = seg(t, sec.title[0], sec.title[1]);
  if (tp > 0 && tp < 1) {
    const x = wipeFront([BAN[0], BAN[1] + 20, BW, 330], 'right', tp, 40) + 12;
    squeegee(ctx, [x, BAN[1] - 38], [x, BAN[1] + BH + 38], [1, 0], { color: pal(C.banner_time || 'golden').near, seed: 5, roll: x / 30, scale: 1.25 });
  }
}

// 海报在印刷台上的通用绘制
function posterOnTable(P, st) {
  regTape(PO[0], PO[1], PW, PH);
  sheetShadow(PO[0], PO[1], PW, PH, .22);
  ctx.save(); ctx.translate(PO[0], PO[1]); drawPoster(ctx, P, st); ctx.restore();
}
const pullProg = (sec, id, t) => { const k = id === 'sun' ? 'sky' : id; const a = sec.pulls[k] ?? sec.pulls.near; return seg(t, a, a + sec.pullDur); };
function planeGroup(id) { return id === 'sun' ? 'sky' : ['main', 'spurA', 'spurB', 'spurC'].includes(id) ? 'mid' : id; }

function press(sec, t) {
  const P = POS[sec.i], pl = pal(P.trail.time_of_day);
  // 相机：从横幅下摇到海报全景 → 推到信息带
  const tilt = eio(seg(t, sec.tilt[0], sec.tilt[1]));
  const push = eio(seg(t, sec.push[0], sec.push[1]));
  const full = [0, PO[1] + PH / 2 - 10, .66];
  const bandC = [0, PO[1] + 1290, 1.55];
  let cx = lerp(0, full[0], tilt), cy = lerp(0, full[1], tilt), z = lerp(.96 * 1.03, full[2], tilt);
  cx = lerp(cx, bandC[0], push); cy = lerp(cy, bandC[1], push); z = lerp(z, bandC[2], push);
  z *= 1 + .02 * seg(t, sec.items[0], sec.t1);
  cam(cx, cy, z); table();
  if (tilt < 1) { ctx.save(); ctx.translate(BAN[0], BAN[1]); sheetShadow(0, 0, BW, BH, .25); drawBanner(ctx, C, { pal: pal(C.banner_time || 'golden'), T }); ctx.restore(); }
  const st = { pal: pl, T, prog: id => pullProg(sec, planeGroup(id), t), band: seg(t, sec.band, sec.band + .3), name: seg(t, sec.name, sec.name + .3), header: seg(t, sec.name, sec.name + .3), trail: seg(t, sec.band, sec.band + .6), items: sec.items.map(a => seg(t, a, a + .18)) };
  posterOnTable(P, st);
  // 网版 + 刮板
  const lift = seg(t, sec.lift, sec.lift + .4);
  const box = [PO[0] - 70, PO[1] - 70, PW + 140, PH + 140];
  if (lift < 1) screenFrame(ctx, box, { lift: ss(lift), frame: 44 });
  for (const k of ['sky', 'far', 'mid', 'near']) {
    const a = sec.pulls[k], p = seg(t, a, a + sec.pullDur);
    if (p > 0 && p < 1) {
      const y = PO[1] + wipeFront([0, ART[1] - 60, PW, ART[3] + 120], 'down', clamp(p * 1.35), 30) - 60 + 14;
      const inkKey = k === 'sky' ? 'sky1' : k === 'far' ? P.sc.planes.find(q => q.id === 'far').parts[0].ink : k === 'mid' ? 'mid' : 'near';
      squeegee(ctx, [PO[0] - 30, y], [PO[0] + PW + 30, y], [0, 1], { color: pl[inkKey], seed: a * 10, roll: y / 30, scale: 1.3 });
    }
  }
}

// 穿过近景树影的转场（屏幕空间遮挡物，颜色 = 上一张的近景墨）
function treeWipe(t, t0, color) {
  const u = seg(t, t0 - .3, t0 + .3); if (u <= 0 || u >= 1) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const w = W * 1.25, cxw = lerp(W + w / 2 + 120, -w / 2 - 120, ss(u)), x = cxw - w / 2;   // 中点正好盖满画面（约 1 帧），此时换下一张
  const p = new Path2D(); p.moveTo(x, -20);
  for (let y = -20; y <= H + 20; y += 40) p.lineTo(x - 50 - 70 * hash(y * .37), y);
  for (let y = H + 20; y >= -20; y -= 40) p.lineTo(x + w + 60 + 80 * hash(y * .61 + 3), y);
  p.closePath(); ctx.fillStyle = color; ctx.fill(p);
  ctx.restore();
}

function quick(sec, t) {
  const P = POS[sec.i], pl = pal(P.trail.time_of_day);
  const back = eio(seg(t, sec.back[0], sec.back[1]));
  const s = seg(t, sec.t0 - .3, sec.back[0]);
  const close = [0, PO[1] + 400 + 40 * s, 1.25 + .04 * s];      // 整张纸宽和上沿都在画里：知道在看哪张海报，海报占画高 100%
  const bandC = [0, PO[1] + 1300, 1.5];                          // 信息带完整入画，左右各留 ~13%
  const cx = lerp(close[0], bandC[0], back), cy = lerp(close[1], bandC[1], back), z = lerp(close[2], bandC[2], back);
  cam(cx, cy, z); table();
  posterOnTable(P, { pal: pl, T, prog: id => pullProg(sec, planeGroup(id), t), band: seg(t, sec.band, sec.band + .25), name: seg(t, sec.name, sec.name + .3), header: seg(t, sec.far ?? sec.name, sec.name + .3), trail: seg(t, sec.band, sec.band + .5), items: sec.items.map(a => seg(t, a, a + .18)) });
}

// ---- 墙面（游客中心）：布局 ----
function wallLayout() {
  // 横幅（4:1）居中挂在海报上方；高度预算先保证海报上墙后数值 ≥30 px（s ≥ .47）
  const n = POS.length, gap = 54, maxW = 1700;
  const bw0 = Math.min(1150, W * .62), bh0 = BH * bw0 / BW;
  const s = Math.min((maxW - (n - 1) * gap) / n / PW, (H - 44 - bh0 - 26) / PH, .62);
  const pw = PW * s, ph = PH * s, total = n * pw + (n - 1) * gap;
  const bw = bw0, bs = bw / BW, bh = BH * bs;
  const top = Math.max(14, (H - 30 - (bh + 26 + ph)) / 2);
  const x0 = (W - total) / 2;
  return { s, pw, ph, bs, bh, banner: [(W - bw) / 2, top], posters: POS.map((_, i) => [x0 + i * (pw + gap), top + bh + 26]) };
}
function wall(t, glint = -1) {
  const Lw = wallLayout(), wp = C.palette.wall || { board: '#5E4432', groove: '#3F2C21', rail: '#8A6547' };
  ctx.fillStyle = wp.board; ctx.fillRect(-2000, -2000, 6000, 6000);
  ctx.fillStyle = wp.groove; for (let x = -1200; x < 3200; x += 96) ctx.fillRect(x, -2000, 5, 6000);
  ctx.fillStyle = mix(wp.board, '#ffffff', .07); for (let x = -1200; x < 3200; x += 96) ctx.fillRect(x + 5, -2000, 3, 6000);
  ctx.fillStyle = wp.rail; ctx.fillRect(-2000, H - 44, 6000, 18); ctx.fillStyle = wp.groove; ctx.fillRect(-2000, H - 26, 6000, 2000);
  // 横幅
  const [bx, by] = Lw.banner;
  ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = '#1a120c'; ctx.fillRect(bx + 10, by + 12, BW * Lw.bs, BH * Lw.bs); ctx.restore();
  ctx.save(); ctx.translate(bx, by); ctx.scale(Lw.bs, Lw.bs); drawBanner(ctx, C, { pal: pal(C.banner_time || 'golden'), T }); ctx.restore();
  POS.forEach((P, i) => {
    const [x, y] = Lw.posters[i];
    ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = '#1a120c'; ctx.fillRect(x + 12, y + 14, Lw.pw, Lw.ph); ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.scale(Lw.s, Lw.s); drawPoster(ctx, P, { pal: pal(P.trail.time_of_day), T }); ctx.restore();
    // 图钉
    ctx.fillStyle = '#C9C2B2'; for (const dx of [18, Lw.pw - 18]) { ctx.beginPath(); ctx.arc(x + dx, y + 16, 5, 0, 7); ctx.fill(); }
  });
  return Lw;
}

function ascent(sec, t) {
  const P = POS[sec.i], Lw = wallLayout(), [wx, wy] = Lw.posters[sec.i];
  const u = seg(t, sec.climb[0], sec.climb[1]);
  const ue = u < .5 ? ss(u * 2) * .5 * .7 + u * .3 : .5 + (1 - Math.pow(1 - (u - .5) * 2, 2)) * .5;   // 起步缓、中段匀速、到顶减速
  // 相机（海报单位）：谷底 → 山顶（同一镜头里升起）
  const start = [520, 800, 2.3], top = [500, 400, 2.06], band = [500, 1300, 1.72];
  let cx = lerp(start[0], top[0], ue), cy = lerp(start[1], top[1], ue), z = lerp(start[2], top[2], ue);
  const dn = eio(seg(t, sec.down[0], sec.down[1]));
  cx = lerp(cx, band[0], dn); cy = lerp(cy, band[1], dn); z = lerp(z, band[2], dn);
  z *= 1 + .025 * ss(seg(t, sec.items[0], sec.t1));          // 读数时极慢推
  // 各层视差：近层下沉更快；每道山梁在镜头经过它时向两侧让开，到顶后全部回位，卡嗒一声套准
  const settle = seg(t, sec.climb[1], sec.clack);
  const loose = 1 - ss(seg(t, sec.clack - .02, sec.clack + .04));
  const pass = { near: .12, spurC: .3, spurB: .5, spurA: .7, main: .95 };
  const off = (id, pl) => {
    const f = pl.depth, dy = (top[1] - cy) * (f - 1) * .42;
    const side = pl.side || 0, pu = pass[id] ?? 1;
    const bump = Math.exp(-Math.pow((u - pu) / .16, 2)) * (1 - settle);
    const sx = side * 190 * bump * (f - .3);
    const jig = loose * 5 * (1 - settle * .6);
    return [(sx + jig * Math.sin(f * 9)) * loose, (dy + bump * 40 * (f - .3) + jig * Math.cos(f * 7)) * loose];
  };
  // 换色：同一张海报随时间整体重印（中午 → 午后 → 黄昏）
  const pals = sec.pals.map(pal); const nS = pals.length - 1;
  const swapTimes = pals.slice(1).map((_, k) => lerp(sec.climb[0], sec.climb[1], (k + 1) / (nS + 1)));
  let base = pals[0], swap = null;
  swapTimes.forEach((st, k) => { const p = seg(t, st, st + .35); if (p >= 1) base = pals[k + 1]; else if (p > 0) swap = { pal: pals[k + 1], p, dir: 'up' }; });
  // 转成墙面坐标
  cam(wx + cx * Lw.s, wy + cy * Lw.s, z / Lw.s);
  wall(t);
  ctx.save(); ctx.translate(wx, wy); ctx.scale(Lw.s, Lw.s);
  const ANG = -.21;
  if (swap) swap.angle = ANG;
  const sep = loose * (settle > 0 ? 1 - .5 * settle : 1) * clamp(u * 6);
  drawPoster(ctx, P, { pal: base, T, off, reg: .35 + loose * 1.25, sep, swap, trail: clamp(u * 1.08), band: seg(t, sec.band, sec.band + .3), name: seg(t, sec.name, sec.name + .3), header: 1, items: sec.items.map(a => seg(t, a, a + .18)) });
  // 重印换色：一把大刮板从下往上推过整张海报
  if (swap) {                // 斜着推的大刮板：只露刀口、墨珠和一截手柄
    const [a0, a1] = swapFrontLine(swap.p, ANG), dx = a1[0] - a0[0], dy = a1[1] - a0[1], L = Math.hypot(dx, dy);
    const nrm = [dy / L, -dx / L];                       // 前进方向（向上偏）
    const off2 = 26;
    squeegee(ctx, [a0[0] + nrm[0] * -off2, a0[1] + nrm[1] * -off2], [a1[0] + nrm[0] * -off2, a1[1] + nrm[1] * -off2], nrm, { color: swap.pal.sky2, scale: 1.1, seed: 11, shadow: .1, handle: .3, roll: t * 40 });
  }
  ctx.restore();
}

function wallShot(sec, t) {
  const Lw = wallLayout(), last = POS.length - 1, [wx, wy] = Lw.posters[last];
  const k = eio(seg(t, sec.pull[0], sec.pull[1]));
  const from = [wx + 500 * Lw.s, wy + 1300 * Lw.s, 1.72 * 1.025 / Lw.s];
  const cx = lerp(from[0], W / 2, k), cy = lerp(from[1], H / 2, k), z = Math.exp(lerp(Math.log(from[2]), 0, k));
  cam(cx, cy, z * (1 + .012 * seg(t, sec.hold0, sec.t1)));
  wall(t);
  // 墨层光泽：一道斜向的反光慢慢扫过三张海报（只在墨面上，很淡）
  const g = seg(t, sec.hold0 + .6, sec.hold0 + 3.2);
  if (g > 0 && g < 1) {
    ctx.save(); ctx.beginPath(); Lw.posters.forEach(([x, y]) => ctx.rect(x, y, Lw.pw, Lw.ph)); ctx.rect(Lw.banner[0], Lw.banner[1], BW * Lw.bs, BH * Lw.bs); ctx.clip();
    const gx = lerp(-300, W + 300, ss(g)), gr = ctx.createLinearGradient(gx - 220, 0, gx + 220, 0);
    gr.addColorStop(0, 'rgba(255,248,230,0)'); gr.addColorStop(.5, 'rgba(255,248,230,.10)'); gr.addColorStop(1, 'rgba(255,248,230,0)');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.transform(1, 0, -.35, 1, 190, 0); ctx.fillStyle = gr; ctx.fillRect(-400, 0, W + 800, H);
    ctx.restore();
  }
}

// 片尾：最后一刮 —— 把片尾信息印成一张横版小海报（分色刮印画面，第二刮印信息带）
let END_CACHE = null;
function endShapes() {
  if (END_CACHE) return END_CACHE;
  const far = [[-20, 600]]; for (let x = 0; x <= W + 40; x += 40) far.push([x, 470 - 70 * Math.abs(Math.sin(x * .0042 + .4)) - 30 * Math.abs(Math.sin(x * .013))]); far.push([W + 20, 600]);
  const mid = [[-20, 620], [0, 540], [260, 470], [520, 520], [760, 430], [900, 360], [1010, 410], [1180, 500], [1420, 470], [1660, 530], [1940, 500], [1940, 620]];
  const lit = [[900, 360], [1010, 410], [1180, 500], [1080, 505], [960, 430]];
  const trail = []; for (let k = 0; k < 9; k++) trail.push([640 + k * 30 + (k % 2) * 12, 560 - k * 22]);
  return (END_CACHE = { far: polyPath(far), mid: polyPath(mid), lit: polyPath(lit), trail });
}
function endCard(sec, t) {
  cam(W / 2, H / 2, 1); wall(t);
  const pl = pal(POS[POS.length - 1].trail.time_of_day), E0 = endShapes();
  const p1 = seg(t, sec.t0, sec.t0 + .55), p2 = seg(t, sec.t0 + .5, sec.t0 + .8);
  const M = 36, ART_B = 610;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // 纸（整张换上一张新纸，随第一刮一起出现）
  const c1 = wipeRegion([0, 0, W, H], 'right', p1, 3, 60, 8);
  ctx.save(); ctx.clip(c1); paperSheet(ctx, T, 0, 0, W, H, 1.1);
  ctx.save(); ctx.beginPath(); ctx.rect(M, M, W - 2 * M, ART_B - M); ctx.clip();
  ink(ctx, { path: rectPath(0, 0, W, H), knock: ringPath(1660, 350, 128, 146) }, { color: pl.sky1, sheen: 1 });
  const top = new Path2D(); top.rect(0, 0, W, 120); for (let i = 0; i < 5; i++) { const cell = 26, th = cell * (1 - (i + .5) / 5) * .95 + 2; top.rect(0, 120 + i * cell, W, th); }
  ink(ctx, { path: top }, { color: pl.sky2, reg: [1.5, .8], sheen: 1, trap: .4 });
  ink(ctx, { path: circlePath(1660, 350, 108) }, { color: pl.sun, reg: [3, 1.5], sheen: 1 });
  ink(ctx, { path: E0.far }, { color: pl.far, reg: [-1, 1], sheen: 1, trap: 1 });
  ink(ctx, { path: E0.mid }, { color: pl.mid, reg: [1.2, -.8], sheen: 1, trap: 1 });
  ink(ctx, { path: E0.lit }, { color: pl.glow || pl.sky2, reg: [1.2, -.8], sheen: 1 });
  ctx.strokeStyle = pl.sun; ctx.lineWidth = 7; E0.trail.forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 16, y - 11); ctx.stroke(); });
  ctx.restore();
  ink(ctx, { paint: (c) => { c.font = '900 118px BigShoulders'; c.letterSpacing = '3px'; c.textAlign = 'center'; c.fillText(C.title.toUpperCase(), W / 2 - 60, 300); } }, { color: pickInk([pl.sky1, pl.sky2], [pl.near, pl.mid], 3), reg: [2, -1] });
  ctx.restore();
  // 第二刮：信息带 + 署名
  if (p2 > 0) {
    const c2 = p2 < 1 ? wipeRegion([0, ART_B, W, H - ART_B], 'right', p2, 9, 50, 8) : null;
    ink(ctx, { path: rectPath(M, ART_B + 12, W - 2 * M, H - ART_B - 12 - M) }, { color: pl.near, clip: c2, sheen: 1 });
    const hi = pickInk(pl.near, [pl.sky1, pl.sun], 4.5), lo = pickInk(pl.near, [pl.sky2, pl.glow, pl.sky1], 3.5);
    ink(ctx, { paint: (c) => { c.textAlign = 'center';
      c.font = '700 40px Outfit'; c.letterSpacing = '14px'; c.fillStyle = pl.sun; c.fillText('SILKSCREEN TRAVEL POSTER', W / 2, ART_B + 100);
      c.fillStyle = pl.sun; c.fillRect(W / 2 - 420, ART_B + 128, 840, 5);
      c.fillStyle = hi; c.font = '600 38px Outfit'; c.letterSpacing = '9px'; c.fillText('LEMO-OPUSCAR', W / 2, ART_B + 196); c.fillText('LEMOLAB × CLAUDE OPUS 5.5', W / 2, ART_B + 248);
      c.fillStyle = lo; c.font = '500 24px Outfit'; c.letterSpacing = '3px';
      c.fillText('FONTS: BIG SHOULDERS DISPLAY, OUTFIT (SIL OFL)', W / 2, ART_B + 322);
      c.fillText('SAMPLES: VCSL, VSCO 2 CE, KARORYFER (CC0) · ARTWORK, GUITARS & SOUND MADE IN CODE', W / 2, ART_B + 360);
    } }, { color: hi, clip: c2, reg: [1.2, .6] });
  }
  inkFinish(ctx, T, 0, 0, W, H, 1.1, p1 >= 1 ? 1 : 0);
  // 刮板
  if (p1 > 0 && p1 < 1) { const x = wipeFront([0, 0, W, H], 'right', p1, 60); const BB = [[pl.sky2, 0, .28], [pl.sky1, .28, .5], [pl.far, .5, .6]];
    squeegee(ctx, [x + 10, -40], [x + 10, H + 40], [1, 0], { beads: BB.map(([c, a, b]) => ({ t0: a + .04, t1: b, color: c })), scale: 1.6, seed: 9, roll: x / 30 }); }
  if (p2 > 0 && p2 < 1) { const x = wipeFront([0, ART_B, W, H - ART_B], 'right', p2, 50); squeegee(ctx, [x + 10, ART_B - 10], [x + 10, H + 40], [1, 0], { color: pl.near, scale: 1.4, seed: 4, roll: x / 30 }); }
}

export function render(t) {
  const sec = TL.secs.find(s => t >= s.t0 && t < s.t1) || TL.secs[TL.secs.length - 1];
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = TABLE; ctx.fillRect(0, 0, W, H);
  if (sec.kind === 'banner') banner(sec, t);
  else if (sec.kind === 'press') press(sec, t);
  else if (sec.kind === 'quick') quick(sec, t);
  else if (sec.kind === 'ascent') ascent(sec, t);
  else if (sec.kind === 'wall') wallShot(sec, t);
  else endCard(sec, t);
  // 段间的树影转场
  TL.secs.forEach((s, k) => { if ((s.kind === 'quick' || s.kind === 'ascent') && Math.abs(t - s.t0) < .3) { const prev = TL.secs[k - 1]; treeWipe(t, s.t0, pal(prev.P.trail.time_of_day).near); } });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
export const getTL = () => TL;
