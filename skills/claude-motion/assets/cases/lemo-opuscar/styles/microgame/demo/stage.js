// 主持人舞台（"家"）：放射背景、招牌、中央大电视、Coach Tick、按钮讲台、生命板、关卡牌
import { P, K, part, line, dot, circ, ell, rrect, poly, smooth, outlined } from './toon.js';
import { drawTick, drawDot } from './chars.js';
import { livesBoard, stageBadge } from './hud.js';
import { clamp, seg, eo, lerp, mulberry } from '/core/lib.js';
const TAU = Math.PI * 2;
// 电视屏幕（16:9，放大 2.5 倍正好满屏）
export const TV = { cx: 960, cy: 500, w: 768, h: 432 };
export const TVZ = 1920 / TV.w;
// 推进电视的摄像机：u = 0（舞台）→ 1（屏幕满屏）
export function tvCam(g, u) {
  const z = lerp(1, TVZ, u), px = TV.cx, py = lerp(TV.cy, 540, u);
  g.translate(px, py); g.scale(z, z); g.translate(-TV.cx, -TV.cy);
}
function sunburst(g, t, o) {
  const cx = 960, cy = 470, n = 28, rot = t * .12;
  g.fillStyle = o.dark ? '#0c0420' : P.deep; g.fillRect(-400, -300, 2720, 1680);
  if (o.dark) return;
  g.save(); g.translate(cx, cy);
  for (let i = 0; i < n; i++) { if (i % 2) continue; const a0 = rot + i / n * TAU, a1 = rot + (i + 1) / n * TAU; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 2400, a0, a1); g.closePath(); g.fillStyle = '#3d168f'; g.fill(); }
  const gr = g.createRadialGradient(0, 0, 100, 0, 0, 1300); gr.addColorStop(0, 'rgba(255,60,160,.35)'); gr.addColorStop(1, 'rgba(20,4,50,.6)');
  g.fillStyle = gr; g.fillRect(-1400, -900, 2800, 1800);
  g.restore();
}
function marquee(g, t, o) {
  const x = 960, y = 140, w = 1060, h = 150, lit = o.title ?? 1;
  part(rrect(x - w / 2, y - h / 2, w, h, 34), P.mag, P.magD, { sh: 10, lw: 9 });
  part(rrect(x - w / 2 + 22, y - h / 2 + 22, w - 44, h - 44, 20), P.night, null, { lw: 6 });
  // 灯泡（追逐闪烁）
  const nb = 34;
  for (let i = 0; i < nb; i++) {
    const u = i / nb, per = 2 * (w + h - 60);
    let d = u * per, bx, by; const W2 = w - 30, H2 = h - 30;
    if (d < W2) { bx = x - W2 / 2 + d; by = y - H2 / 2; } else if ((d -= W2) < H2) { bx = x + W2 / 2; by = y - H2 / 2 + d; } else if ((d -= H2) < W2) { bx = x + W2 / 2 - d; by = y + H2 / 2; } else { d -= W2; bx = x - W2 / 2; by = y + H2 / 2 - d; }
    const on = (i + Math.floor(t * 8)) % 3 !== 0;
    g.fillStyle = on ? '#fff3a0' : '#b3602a'; g.beginPath(); g.arc(bx, by, 7, 0, TAU); g.fill();
    if (on) { g.fillStyle = 'rgba(255,230,120,.25)'; g.beginPath(); g.arc(bx, by, 15, 0, TAU); g.fill(); }
  }
  const txt = o.marqueeText || 'FIVE-SECOND ASTRONAUT';
  const n = Math.floor(txt.length * clamp(lit));
  g.save(); g.font = '66px Titan'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const full = g.measureText(txt).width; let cx0 = x - full / 2;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i], cw = g.measureText(ch).width, on = i < n;
    g.save(); g.translate(cx0 + cw / 2, y + 4);
    if (on) { g.shadowColor = '#ffd84a'; g.shadowBlur = 22; }
    outlined(g, ch, 0, 0, { font: '66px Titan', base: 'middle', lw: 10, fill: on ? '#fff6c8' : '#4a2a6a', stroke: on ? P.ink : '#1e0c3a' });
    g.restore(); cx0 += cw;
  }
  g.restore();
  if (o.sub) { outlined(g, 'A MICROGAME FRENZY', x, y + h / 2 + 34, { font: '34px Lilita', base: 'middle', lw: 8, fill: P.gold, ls: 6 }); }
}
function tvSet(g, t, o) {
  const { cx, cy, w, h } = TV;
  // 支架
  part(poly([[cx - 120, cy + h / 2 + 30], [cx + 120, cy + h / 2 + 30], [cx + 170, 880], [cx - 170, 880]]), P.vio, P.vioD, { sh: 10, lw: 8 });
  // 机身
  part(rrect(cx - w / 2 - 56, cy - h / 2 - 50, w + 112, h + 120, 52), P.gold, P.goldD, { sh: 14, lw: 9, hi: gg => { gg.strokeStyle = 'rgba(255,255,255,.55)'; gg.lineWidth = 10; gg.lineCap = 'round'; gg.beginPath(); gg.moveTo(cx - w / 2 - 20, cy - h / 2 - 22); gg.lineTo(cx + w / 2 - 60, cy - h / 2 - 22); gg.stroke(); } });
  // 下方喇叭 + 旋钮
  for (let i = 0; i < 9; i++) line([[cx - 200 + i * 22, cy + h / 2 + 34], [cx - 200 + i * 22, cy + h / 2 + 52]], 5, P.goldD);
  part(circ(cx + 220, cy + h / 2 + 42, 16), P.red, P.redD, { sh: 3, lw: 5 }); part(circ(cx + 280, cy + h / 2 + 42, 16), P.cyan, P.cyanD, { sh: 3, lw: 5 });
  // 屏幕内框
  part(rrect(cx - w / 2 - 14, cy - h / 2 - 14, w + 28, h + 28, 26), P.ink, null, { lw: 4 });
}
function tvScreen(g, o) {
  const { cx, cy, w, h } = TV;
  g.save(); g.beginPath(); g.roundRect(cx - w / 2, cy - h / 2, w, h, 16); g.clip();
  if (o.screen) g.drawImage(o.screen, cx - w / 2, cy - h / 2, w, h);
  else { g.fillStyle = '#10082a'; g.fillRect(cx - w / 2, cy - h / 2, w, h); }
  // 玻璃反光
  g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(cx - w / 2, cy - h / 2); g.lineTo(cx - w / 2 + 300, cy - h / 2); g.lineTo(cx - w / 2 + 120, cy + h / 2); g.lineTo(cx - w / 2, cy + h / 2); g.fill();
  g.restore();
}
function podium(g, t, o) {
  const x = 1600, y = 1000;
  part(poly([[x - 130, y], [x + 130, y], [x + 100, y - 250], [x - 100, y - 250]]), P.vio, P.vioD, { sh: 10, lw: 8 });
  part(rrect(x - 124, y - 280, 248, 44, 14), P.gold, P.goldD, { sh: 6, lw: 8 });
  outlined(g, '5', x, y - 110, { font: '120px Titan', base: 'middle', lw: 12, fill: P.gold });
  // 大红按钮（press = 0..1 按下）
  const pr = o.press || 0;
  part(ell(x, y - 286, 96, 26), '#8a8aa0', '#5a5a70', { sh: 4, lw: 8 });
  part(g2 => { g2.ellipse(x, y - 300 + pr * 16, 76, 22, 0, 0, Math.PI); g2.lineTo(x - 76, y - 336 + pr * 30); g2.ellipse(x, y - 336 + pr * 30, 76, 22, 0, Math.PI, 0); g2.closePath(); }, P.red, P.redD, { sh: 6, lw: 8 });
  part(ell(x, y - 336 + pr * 30, 76, 22), '#ff6a6a', P.red, { sh: 4, lw: 8 });
}
function floor(g, o) {
  part(poly([[-50, 860], [1970, 860], [1970, 1130], [-50, 1130]]), '#3a1470', null, { lw: 0.1, stroke: false });
  g.save(); g.globalAlpha = .5;
  for (let i = -12; i <= 12; i++) { g.strokeStyle = '#4c1d8a'; g.lineWidth = 3; g.beginPath(); g.moveTo(960 + i * 60, 860); g.lineTo(960 + i * 260, 1100); g.stroke(); }
  for (const yy of [900, 960, 1040]) { g.beginPath(); g.moveTo(-50, yy); g.lineTo(1970, yy); g.stroke(); }
  g.restore();
  part(ell(960, 900, 820, 70), P.mag, P.magD, { sh: 10, lw: 8 });
  part(ell(960, 894, 760, 56), '#ff4fa0', null, { lw: 5, stroke: P.magD });
  line([[-50, 862], [1970, 862]], 7);
}
function spots(g, t, o) {
  if (o.dark) {   // 只剩一束顶光
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(0, 0, 0, 1000); gr.addColorStop(0, 'rgba(255,240,200,.28)'); gr.addColorStop(1, 'rgba(255,240,200,.05)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(o.spotX - 60, -20); g.lineTo(o.spotX + 60, -20); g.lineTo(o.spotX + 260, 1010); g.lineTo(o.spotX - 260, 1010); g.fill();
    g.fillStyle = 'rgba(255,240,200,.18)'; g.beginPath(); g.ellipse(o.spotX, 1005, 270, 40, 0, 0, TAU); g.fill();
    g.restore(); return;
  }
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [x0, x1, c] of [[120, 520, 'rgba(255,120,200,'], [1800, 1380, 'rgba(120,220,255,']]) {
    const sw = Math.sin(t * .9 + x0) * 90;
    const gr = g.createLinearGradient(x0, 0, x1 + sw, 1000); gr.addColorStop(0, c + '.20)'); gr.addColorStop(1, c + '0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x0 - 40, -20); g.lineTo(x0 + 40, -20); g.lineTo(x1 + sw + 220, 1000); g.lineTo(x1 + sw - 220, 1000); g.fill();
  }
  g.restore();
}
// st: { lives, crack, blink, stage, score, title, sub, screen, tick:{...}, press, dark, dot:{...}, confetti }
export function drawStage(g, t, st = {}) {
  K.s = 1;
  sunburst(g, t, st);
  if (!st.dark) spots(g, t, st);
  floor(g, st);
  if (st.marquee !== false) marquee(g, t, st);
  tvSet(g, t, st); tvScreen(g, st);
  podium(g, t, st);
  const tk = st.tick || {};
  drawTick(tk.x ?? 330, tk.y ?? 1000, tk.s ?? 1.3, { face: 'grin', pose: 'present', view: 'q', ...tk });
  if (st.dot) drawDot(st.dot.x ?? 1220, st.dot.y ?? 1000, st.dot.s ?? 1.35, st.dot);
  livesBoard(g, st.lives ?? 3, 1490, 340, { crack: st.crack, blink: st.blink });
  if (st.stage !== undefined) stageBadge(g, st.stage, 60, 70);
  if (st.dark) spots(g, t, { ...st, spotX: tk.x ?? 330 });
  if (st.confetti) confetti(g, t, st.confetti);
}
export function confetti(g, t, t0) {
  const r = mulberry(11), cols = [P.gold, P.cyan, P.mag, P.green, P.white, P.orange];
  for (let i = 0; i < 140; i++) {
    const x0 = r() * 1920, vy = 220 + r() * 260, ph = r() * TAU, sz = 10 + r() * 14, dl = r() * .5, c = cols[i % cols.length];
    const tt = t - t0 - dl; if (tt < 0) continue;
    const y = -40 + tt * vy, x = x0 + Math.sin(tt * 3 + ph) * 40;
    if (y > 1120) continue;
    g.save(); g.translate(x, y); g.rotate(tt * 4 + ph); g.scale(1, Math.abs(Math.sin(tt * 6 + ph)) + .15);
    g.fillStyle = c; g.strokeStyle = P.ink; g.lineWidth = 2.5; g.beginPath(); g.rect(-sz / 2, -sz / 3, sz, sz * .66); g.fill(); g.stroke(); g.restore();
  }
}
