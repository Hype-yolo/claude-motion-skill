// 瑞士排版画风（向 swiss-motion 学：12 栏网格、单字族、左齐右不齐、黑白 + 一个信号红、大留白、不加阴影/颗粒）——自写简化版
const TAU = Math.PI * 2;
export const SW = { page: '#eae9e5', paper: '#ffffff', ink: '#111111', red: '#e30613', grid: '#cfcec9' };
export const GRID = { cols: 12, m: 96, gut: 24, col: (1920 - 96 * 2 - 24 * 11) / 12 };
export const colX = i => GRID.m + i * (GRID.col + GRID.gut);
export function page(g, o = {}) {
  g.fillStyle = SW.page; g.fillRect(0, 0, 1920, 1080);
  if (o.grid !== false) {
    g.save(); g.strokeStyle = SW.grid; g.lineWidth = 1;
    for (let i = 0; i < 12; i++) { const x = colX(i); g.strokeRect(x + .5, 60.5, GRID.col, 960); }
    for (let y = 60; y <= 1020; y += 24) { g.globalAlpha = .35; g.beginPath(); g.moveTo(GRID.m, y + .5); g.lineTo(1920 - GRID.m, y + .5); g.stroke(); }
    g.restore();
  }
}
export function text(g, t, x, y, size, w = 700, col = SW.ink, o = {}) {
  g.save(); g.font = `${w} ${size}px Inter`; g.fillStyle = col; g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic';
  g.letterSpacing = (size >= 90 ? -size * .03 : 0) + 'px'; g.fillText(t, x, y); g.restore();
}
// ───────── 瑞士版 Dot：黑圆（头盔）+ 黑矩形（身体）+ 红圆（天线球）；arm = 敬礼臂角度（弧度，0 = 下垂）─────────
// (x,y) = 身体底边中心，u = 模块单位（px）
export function cadetSwiss(g, x, y, u = 40, o = {}) {
  const arm = o.arm ?? 0, ball = o.ball, show = o.ballShow ?? true;
  g.save(); g.translate(x, y);
  g.fillStyle = SW.ink;
  g.fillRect(-2 * u, -5 * u, 4 * u, 5 * u);                 // 身体：4×5 模块
  g.beginPath(); g.arc(0, -7.5 * u, 2.5 * u, 0, TAU); g.fill();   // 头盔：直径 5 模块
  const lk = o.look ?? 1;   // 1 = 朝右，-1 = 朝左
  g.fillStyle = SW.page; g.beginPath(); g.arc(.6 * u * lk, -7.3 * u, 1.35 * u, 0, TAU); g.fill();   // 面罩：纸色圆（偏向 = 朝向）
  g.fillStyle = SW.ink; g.beginPath(); g.arc(1.05 * u * lk, -7.4 * u, .28 * u, 0, TAU); g.fill();    // 一只眼
  // 天线：细线 + 红圆
  const aw = o.antBend || 0;
  g.save(); g.translate(0, -10 * u); g.rotate(aw); g.fillRect(-.06 * u, -1.5 * u, .12 * u, 1.5 * u); g.restore();
  if (show) { g.fillStyle = SW.red; g.beginPath(); const [bx, by] = ball || [0, -12.2 * u]; g.arc(bx, by, .75 * u, 0, TAU); g.fill(); }
  // 手臂：一根矩形，绕肩点旋转
  g.save(); g.translate(1.6 * u, -4.4 * u); g.rotate(-arm); g.fillStyle = SW.ink; g.fillRect(-.45 * u, 0, .9 * u, (o.armLen ?? 3.6) * u); g.restore();
  // 腿：两根短矩形
  g.fillStyle = SW.ink; g.fillRect(-1.6 * u, 0, 1.1 * u, 1.6 * u); g.fillRect(.5 * u, 0, 1.1 * u, 1.6 * u);
  // 05：白字压在身体上
  text(g, '05', -1.6 * u, -1.3 * u, 1.5 * u, 800, SW.paper);
  g.restore();
}
export function testCadet(g, t) {
  page(g);
  text(g, 'salute.', colX(0), 300, 200, 800);
  text(g, 'cadet 05 — rule 7: arm 90°, hand to brow', colX(0), 360, 26, 500);
  cadetSwiss(g, colX(8) + GRID.col / 2, 900, 44, { arm: 1.3 });
}

// ───────── G7 SALUTE!（本地 lt 0..3.43，140 BPM，8 拍：第 4–6 拍是即时回放）─────────
import { clamp as _c, seg as _seg, eo as _eo, ei as _ei, ss as _ss, lerp as _l, back as _back } from '/core/lib.js';
const B7 = 60 / 140;
export const SAL = { swing: 2 * B7, hit: 3 * B7, rep0: 4 * B7, rep1: 6 * B7, fail: 7 * B7 };
export const BOUNCE = [.217, .427];   // 相对命中：两次弹跳（和配乐木块对齐）
export const live7 = t => t < SAL.rep0 ? t : t < SAL.rep1 ? SAL.rep0 : t - (SAL.rep1 - SAL.rep0);
const U = 56, DX = colX(8) + 60, DY = 930;             // Dot 的位置（右侧第 9–10 栏，底线 900）
const SH = [DX + 1.6 * U, DY - 4.4 * U], BALL0 = [DX, DY - 12.2 * U];
const A_HIT = Math.PI + Math.atan2(1.6, 7.8), L_HIT = Math.hypot(1.6, 7.8);
function armAt(tau) {   // tau = 相对命中时刻
  const u = _c((tau + (SAL.hit - SAL.swing)) / (SAL.hit - SAL.swing));
  if (tau < 0) return [A_HIT * _eo(u) * (u < 1 ? 1 : 1), 3.6 + (L_HIT - 3.6) * _ei(_seg(u, .45, 1))];
  const k = Math.exp(-tau * 7); return [A_HIT + .15 * Math.sin(tau * 26) * k + .08 * (1 - k), L_HIT - (L_HIT - 3.6) * _eo(_seg(tau, .1, .5))];
}
// 红球轨迹（脚本化抛物线）：向左上飞 → 落底线弹两次 → 沿底线滚出左边
function ballAt(tau) {
  const R = .75 * U, floor = DY - R;
  if (tau <= 0) return [BALL0[0], BALL0[1], 0];
  const segs = [[0, BOUNCE[0], BALL0, [1080, floor], 200], [BOUNCE[0], BOUNCE[1], [1080, floor], [880, floor], 110]];
  for (const [t0, t1, a, b, h] of segs) if (tau < t1) { const u = (tau - t0) / (t1 - t0); return [_l(a[0], b[0], u), _l(a[1], b[1], u) - h * 4 * u * (1 - u), tau]; }
  return [880 - (tau - BOUNCE[1]) * 1900, floor, tau];
}
function sceneBody(g, tau, o = {}) {
  page(g);
  text(g, 'salute.', colX(0), 300, 200, 800);
  text(g, 'rule 7 — arm to 90°, hand to brow.', colX(0), 372, 30, 500);
  if (tau > .2) { g.save(); g.strokeStyle = SW.red; g.lineWidth = 5; g.beginPath(); g.moveTo(colX(0) + 190, 360); g.lineTo(colX(0) + 262, 360); g.stroke(); g.restore(); text(g, '212°', colX(0) + 270, 330, 30, 800, SW.red); }
  // 底线
  g.save(); g.fillStyle = SW.ink; g.fillRect(GRID.m, DY, 1920 - 2 * GRID.m, 3); g.restore();
  const [a, L] = armAt(tau);
  const [bx, by] = ballAt(tau);
  const attached = tau <= 0;
  const look = tau > .15 ? -1 : 1;
  const antBend = tau > 0 ? Math.sin(tau * 30) * Math.exp(-tau * 5) * .6 : 0;
  cadetSwiss(g, DX, DY, U, { arm: a, armLen: L, ballShow: attached, look, antBend });
  if (!attached) { g.save(); g.fillStyle = SW.red; g.beginPath(); g.arc(bx, by, .75 * U, 0, TAU); g.fill(); g.restore(); }
  // 出格标注
  if (tau > .82) { const x = Math.max(GRID.m + 10, bx); g.save(); g.fillStyle = SW.red; g.fillRect(GRID.m, DY + 40, 3, 60); g.restore(); text(g, '← off grid', GRID.m + 16, DY + 86, 34, 700, SW.red); }
  // 命中瞬间：一条短促的撞击线
  if (tau > 0 && tau < .12) { g.save(); g.strokeStyle = SW.ink; g.lineWidth = 6; for (let i = 0; i < 5; i++) { const aa = -2.2 + i * .45; g.beginPath(); g.moveTo(BALL0[0] + Math.cos(aa) * 50, BALL0[1] + Math.sin(aa) * 50); g.lineTo(BALL0[0] + Math.cos(aa) * 90, BALL0[1] + Math.sin(aa) * 90); g.stroke(); } g.restore(); }
}
export function sceneSalute(g, lt, o = {}) {
  const T = o.step === false ? lt : Math.floor(lt * 12) / 12;
  if (T >= SAL.rep0 && T < SAL.rep1) {
    // 即时回放：先定格 3 帧，再 0.5× 慢放命中前后，镜头推近头部
    const u = (T - SAL.rep0) / (SAL.rep1 - SAL.rep0);
    const tau = u < .12 ? -.32 : _l(-.32, .32, (u - .12) / .88);
    const z = _l(1.0, 1.4, _eo(_seg(u, 0, .25)));
    g.save(); g.translate(BALL0[0] - 60, 215); g.scale(z, z); g.translate(-(BALL0[0] - 60), -215);
    sceneBody(g, tau); g.restore();
    // 回放标识（瑞士式黑条 + 红点）
    g.save(); g.fillStyle = SW.ink; g.fillRect(0, 0, 1920, 110); g.fillRect(0, 1020, 1920, 60); g.restore();
    text(g, 'instant replay', GRID.m, 76, 52, 800, SW.paper);
    text(g, '0.5×   ◀◀ 00:00:01.29', 1920 - GRID.m, 72, 30, 600, SW.paper, { align: 'right' });
    if (Math.floor(lt * 6) % 2 === 0) { g.save(); g.fillStyle = SW.red; g.beginPath(); g.arc(GRID.m + 420, 58, 16, 0, TAU); g.fill(); g.restore(); }
    return;
  }
  sceneBody(g, live7(T) - SAL.hit);
}
