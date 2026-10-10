import { buildPath, headAt, posAt } from './geom.js';
import { SEGS } from './face.js';
import { prepare, drawLine, drawBlots } from './ink.js';
import { makePaper, drawPaper, vignette, makeTooth, drawTooth } from './paper.js';
import { DUR, VO, TITLE, HAND, END } from './story.js';
import { subtitle, title, endCard } from './subs.js';
import { camAt, worldToScreen, BASE } from './cam.js';
import { CAM } from './shots.js';
import { penShadow, handShadow } from './hands.js';
import { clamp, lerp, ss, vnoise } from '/core/lib.js';

const q = new URLSearchParams(location.search);
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;
await document.fonts.load('500 40px Caveat'); await document.fonts.load('600 40px Caveat'); await document.fonts.load('80px Sacramento');

const P = prepare(buildPath(SEGS));
const paper = makePaper(), tooth = makeTooth();
window.PATH = P;
const NOSUB = q.has('nosub') || q.has('poster') || q.has('clean');
const kidSeg = P.segs.findIndex(s => s.id === 'kid');
const kidStart = P.range[kidSeg][0];

function camFor(t) {
  let cam = camAt(P, CAM, t, W, H);
  const fixed = (x, y, z) => ({ cx: x, cy: y, k: BASE * z, r: 0, z });
  if (q.get('cam')) cam = fixed(...q.get('cam').split(',').map(Number));
  if (q.get('cams')) { const L = q.get('cams').split(';'); cam = fixed(...L[Math.min(L.length - 1, Math.floor(t))].split(',').map(Number)); }
  if (q.get('camt')) { let best = null, bd = 1e9; for (const e of q.get('camt').split(';')) { const [tt, v] = e.split('@'); const d = Math.abs(parseFloat(tt) - t); if (d < bd) { bd = d; best = v; } } cam = fixed(...best.split(',').map(Number)); }
  return cam;
}

// 笔的朝向：老人的手在右下；交接后孩子的手在左下
function penDir(t) {
  const u = ss((t - HAND.grip) / 0.6);
  const a0 = Math.atan2(0.83, 0.56), a1 = Math.atan2(0.86, -0.42);
  const a = lerp(a0, a1, u);
  return [Math.cos(a), Math.sin(a)];
}

function render(t) {
  const cam = camFor(t);
  const M = worldToScreen(cam, W, H);
  drawPaper(ctx, paper, cam, W, H);
  const head = q.has('all') ? P.N - 1 : headAt(P, t);
  if (t >= P.T[0] || q.has('all')) drawLine(ctx, P, head, M, cam.k);
  drawBlots(ctx, P, q.has('all') ? 999 : t, M, cam.k);
  drawTooth(ctx, tooth, cam, W, H);
  vignette(ctx, W, H);
  if (!q.has('nopen') && !q.has('all') && !q.has('poster')) {
    const tip = M(...posAt(P, head)), dir = penDir(t), k = cam.k;
    const lift = t < P.T[0] ? clamp((P.T[0] - t) / 0.8) : 0;
    const appear = clamp((t - 0.15) / 0.6);
    // 手的投影：只在拉远后出现（近景里手在画外）
    const oldA = clamp((t - 39.8) / 0.9) * (1 - ss((t - HAND.oldOut[0]) / (HAND.oldOut[1] - HAND.oldOut[0])));
    if (oldA > 0) {
      const away = ss((t - HAND.oldOut[0]) / (HAND.oldOut[1] - HAND.oldOut[0]));
      const d0 = [0.56, 0.83], L = 270 * k + away * 500, tr = (vnoise(t * 7) - .5) * 3;   // 老人的手微颤
      handShadow(ctx, tip[0] + d0[0] * L + tr, tip[1] + d0[1] * L + tr * .6, 400 * k, Math.atan2(-d0[1], -d0[0]) - .15, .12 * oldA);
    }
    const kidA = clamp((t - HAND.enter) / 0.9);
    if (kidA > 0) {
      const reach = ss((t - HAND.enter) / (HAND.grip - HAND.enter));
      const d1 = [-0.42, 0.86], L = 150 * k + (1 - reach) * 420;
      const wob = t > HAND.newLine ? (vnoise(t * 3) - .5) * 6 : 0;
      handShadow(ctx, tip[0] + d1[0] * L + wob, tip[1] + d1[1] * L, 230 * k, Math.atan2(-d1[1], -d1[0]) + .1, .13 * kidA, 1, t);
    }
    if (appear > 0) penShadow(ctx, tip, dir, k, { lift, alpha: appear });
  }
  if (!NOSUB) {
    for (const v of VO) subtitle(ctx, v.text, v.sub[0], v.sub[1], t, W, H);
    title(ctx, TITLE, t, W, H);
    endCard(ctx, END, t, W, H);
  }
}

// 事件：给混音用（笔速轨迹 200Hz、拐角、落笔、停笔、钟声、旁白）
function events() {
  const ev = [];
  const track = [];
  for (let t = 0; t <= DUR; t += 0.005) {
    const h = headAt(P, t), i = Math.floor(h), cam = camAt(P, CAM, t, W, H), M = worldToScreen(cam, W, H);
    const p = M(...posAt(P, h)); const seg = P.segs[P.SEG[i]];
    const moving = t >= P.T[0] && t <= P.T[P.N - 1] && !(t > P.T[kidStart - 1] && t < P.T[kidStart]);
    track.push([+t.toFixed(3), moving ? Math.round(P.V[i]) : 0, +(p[0] / W).toFixed(3), seg.style, +(P.DRY[i] || 0).toFixed(2)]);
  }
  ev.push({ t: 0, type: 'track', data: track });
  // 拐角：转角大、速度局部最低的点
  const corners = [];
  for (let i = 8; i < P.N - 8; i += 1) {
    if (P.TURN[i] < 0.5) continue;
    let isMin = true; for (let j = -6; j <= 6; j++) if (P.V[i + j] < P.V[i]) { isMin = false; break; }
    if (isMin && (!corners.length || P.T[i] - corners.at(-1).t > 0.12)) corners.push({ t: +P.T[i].toFixed(3), seg: P.segs[P.SEG[i]].id, turn: +P.TURN[i].toFixed(2) });
  }
  ev.push({ t: 0, type: 'corners', data: corners });
  ev.push({ t: P.T[0], type: 'tap' });
  P.blots.forEach(b => ev.push({ t: b.t0, type: 'blot', dur: b.dur }));
  ev.push({ t: HAND.newLine, type: 'chime' });
  ev.push({ t: HAND.grip, type: 'handoff' });
  VO.forEach(v => ev.push({ t: v.t0, type: 'vo', id: v.id }));
  // 段落起止与标记时刻（配乐 cue 用）
  P.segs.forEach((s, i) => ev.push({ t: s.t[0], type: 'seg', id: s.id, t1: s.t[1] }));
  return ev;
}

window.DUR = DUR;
window.EV = events();
window.SUBS = VO.map(v => ({ t0: v.sub[0], t1: v.sub[1], text: v.text }));
window.render = render;
window.READY = true;
