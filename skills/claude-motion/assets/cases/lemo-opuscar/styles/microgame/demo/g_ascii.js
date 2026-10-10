// ASCII 终端画风（向 ascii-crt 学：字即画面、按字形真实墨量排序的密度阶、负空间、琥珀磷光 + 辉光 + 扫描线、桶形屏）——自写简化版
import { pass, canvas } from './glpass.js';
import { clamp, hash } from '/core/lib.js';
const TAU = Math.PI * 2;
export const CW = 16, CH = 32, COLS = 120, ROWS = 34;
export const [lumC, lx] = canvas();                 // 灰度"底片"：在这里画图形
export const [txtC, tx] = canvas();                 // 字符层：白字黑底，送进 CRT
const [smC, sx] = canvas(COLS, ROWS);
// 按真实墨量排序的字形阶
let RAMP = null;
function buildRamp() {
  const cand = " .,:;-=+*oxO#%@";
  const [c, x] = canvas(40, 60); const res = [];
  for (const ch of cand) {
    x.fillStyle = '#000'; x.fillRect(0, 0, 40, 60); x.fillStyle = '#fff'; x.font = '60px VT'; x.textBaseline = 'top'; x.fillText(ch, 0, 0);
    const d = x.getImageData(0, 0, 40, 60).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i];
    res.push([s, ch]);
  }
  res.sort((a, b) => a[0] - b[0]);
  const mx = res[res.length - 1][0];
  // 去掉墨量太接近的
  const out = []; let last = -1; for (const [s, ch] of res) { const v = s / mx; if (v - last > .03 || ch === ' ') { out.push([v, ch]); last = v; } }
  RAMP = out;
}
export function clearAscii() {
  for (const x of [lx, tx]) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.fillStyle = '#000'; x.fillRect(0, 0, 1920, 1080); }
}
// 把底片区域 [c0,r0,c1,r1)（按格）转成字符画到 txt 层
export function rasterize(region = [0, 0, COLS, ROWS], o = {}) {
  if (!RAMP) buildRamp();
  sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = 'high';
  sx.clearRect(0, 0, COLS, ROWS); sx.drawImage(lumC, 0, 0, 1920, 1080, 0, 0, COLS, ROWS);
  const d = sx.getImageData(0, 0, COLS, ROWS).data;
  tx.save(); tx.font = `${CH}px VT`; tx.textBaseline = 'top'; tx.fillStyle = '#fff';
  const [c0, r0, c1, r1] = region;
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
    const at = (cc, rr) => d[(Math.max(0, Math.min(ROWS - 1, rr)) * COLS + Math.max(0, Math.min(COLS - 1, cc))) * 4] / 255;
    let L = at(c, r);
    if (L < .05) continue;
    L = clamp(L + (hash(c * 7.1 + r * 13.3 + (o.seed || 0)) - .5) * .05);
    let ch = ' '; for (const [v, g] of RAMP) { if (v <= L * .92) ch = g; else break; }
    // 边缘：梯度大时用结构字形（- / | \ _）勾出轮廓
    const gx = at(c + 1, r) - at(c - 1, r), gy = (at(c, r + 1) - at(c, r - 1)) * 2, gm = Math.hypot(gx, gy);
    if (o.edges !== false && gm > .55 && L < .85) {
      const a = (Math.atan2(gy, gx) * 180 / Math.PI + 180) % 180;   // 梯度方向；边缘垂直于它
      ch = a < 22.5 || a >= 157.5 ? '|' : a < 67.5 ? '/' : a < 112.5 ? (gy > 0 ? '_' : '-') : '\\';
      L = Math.max(L, .8);
    }
    tx.globalAlpha = .7 + .3 * L;
    tx.fillText(ch, c * CW, r * CH);
  }
  tx.restore();
}
// 直接打字（终端文字）：col,row 为格坐标；inv = 反白
export function type(str, col, row, o = {}) {
  tx.save(); tx.font = `${(o.size || 1) * CH}px VT`; tx.textBaseline = 'top';
  const w = CW * (o.size || 1);
  if (o.inv) { tx.fillStyle = '#fff'; tx.fillRect(col * CW - 4, row * CH, str.length * w + 8, CH * (o.size || 1)); tx.fillStyle = '#000'; }
  else { tx.fillStyle = '#fff'; tx.globalAlpha = o.a ?? 1; }
  for (let i = 0; i < str.length; i++) tx.fillText(str[i], col * CW + i * w, row * CH);
  tx.restore();
}
export function print(g, o = {}) { g.drawImage(pass('crt', txtC, { on: o.on ?? 1, time: o.time || 0 }), 0, 0); }

// ───────── ASCII 版 Dot：在灰度底片上画（亮 = 字密）(x,y) = 脚底，s = 缩放 ─────────
export function cadetAscii(x, y, s = 1, o = {}) {
  const g = lx; g.save(); g.translate(x, y); g.scale(s, s);
  const G = v => `rgb(${v * 255},${v * 255},${v * 255})`;
  const circ = (cx, cy, r, v) => { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fillStyle = G(v); g.fill(); };
  const rr = (x0, y0, w, h, r, v) => { g.beginPath(); g.roundRect(x0, y0, w, h, r); g.fillStyle = G(v); g.fill(); };
  // 天线
  g.strokeStyle = G(.7); g.lineWidth = 5; g.beginPath(); g.moveTo(0, -240); g.lineTo(0, -282); g.stroke(); circ(0, -292, 14, 1);
  // 背包 + 身体
  rr(-64, -140, 128, 96, 16, .45);
  rr(-54, -124, 108, 84, 22, .92);
  rr(-58, -66, 116, 14, 4, .35);
  rr(-20, -112, 40, 30, 6, .15);            // 胸牌（暗 = 字稀，显出 05 的"洞"）
  // 腿 + 靴
  for (const sx2 of [-1, 1]) { rr(sx2 * 24 - 17, -56, 34, 40, 10, .8); rr(sx2 * 24 - 22, -22, 44, 24, 11, .55); }
  // 手臂
  if (o.pose === 'strap') { rr(-86, -118, 30, 60, 14, .85); rr(56, -118, 30, 60, 14, .85); circ(-70, -54, 15, .6); circ(70, -54, 15, .6); }
  else { rr(-86, -120, 28, 66, 14, .85); rr(58, -120, 28, 66, 14, .85); circ(-72, -52, 15, .6); circ(72, -52, 15, .6); }
  // 领圈
  g.beginPath(); g.ellipse(0, -124, 50, 15, 0, 0, TAU); g.fillStyle = G(.6); g.fill();
  // 头盔：亮环 + 暗玻璃 + 脸
  circ(0, -178, 68, 1); circ(0, -178, 56, .0);
  circ(0, -172, 40, .42);
  g.beginPath(); g.ellipse(0, -212, 36, 12, 0, 0, TAU); g.fillStyle = G(.3); g.fill();   // 头发
  for (const sx2 of [-1, 1]) circ(sx2 * 17, -176, 9, 0);                                   // 眼 = 空
  if (o.face === 'happy') { g.fillStyle = G(0); g.fillRect(-10, -152, 20, 6); }
  else { g.fillStyle = G(0); g.fillRect(-8, -150, 16, 4); }
  // 玻璃高光
  g.strokeStyle = G(1); g.lineWidth = 6; g.beginPath(); g.arc(0, -178, 46, Math.PI * 1.1, Math.PI * 1.4); g.stroke();
  g.restore();
}
export function testCadet(g, t) {
  clearAscii();
  cadetAscii(700, 950, 2.6);
  rasterize();
  type('> CADET_05.PRF', 70, 6); type('  HELMET ... OK', 70, 8); type('  ANTENNA . OK', 70, 9); type(' SECURED ', 70, 12, { inv: true });
  print(g);
}
export function render(o = {}) { return pass('crt', txtC, { on: o.on ?? 1, time: o.time || 0, uflat: o.flat ? 1 : 0 }); }

// ───────── 手写 ASCII 版 Dot（模板）：圆头盔轮廓 + 两只眼 + 天线球（最亮的 @）─────────
export const DOT_ART = [
  "        (@)        ",
  "         |         ",
  "     .-'''''-.     ",
  "   .'         '.   ",
  "  /   (o) (o)   \\  ",
  " |               | ",
  " |     \\___/     | ",
  "  \\             /  ",
  "   '-._______.-'   ",
  "  __/|  05   |\\__  ",
  " (___|       |___) ",
  "     |  | |  |     ",
  "    (___) (___)    ",
];
// 亮度：头盔轮廓/天线球最亮，脸部中亮，身体中亮
function charLevel(r, c, ch) {
  if (r === 0 && ch === '@') return 1.25;
  if (r >= 2 && r <= 8 && "/\\|.'-_".includes(ch)) return 1;
  if (ch === 'o' || ch === '^' || ch === '_') return .95;
  return .8;
}
export function drawArt(art, col, row, size = 2, o = {}) {
  tx.save(); tx.font = `${CH * size}px VT`; tx.textBaseline = 'top';
  for (let r = 0; r < art.length; r++) for (let c = 0; c < art[r].length; c++) {
    const ch = art[r][c]; if (ch === ' ') continue;
    const L = (o.level || charLevel)(r, c, ch);
    const x = (col + c * size) * CW, y = (row + r * size) * CH;
    if (L > 1.1) { tx.fillStyle = '#fff'; tx.globalAlpha = 1; tx.fillRect(x - 4, y + 6, CW * size + 8, CH * size - 10); tx.globalAlpha = 1; tx.fillStyle = '#000'; tx.fillText(ch, x, y); continue; }
    tx.globalAlpha = Math.min(1, L); tx.fillStyle = '#fff'; tx.fillText(ch, x, y);
    tx.fillText(ch, x + 1.5, y); if (L >= 1) tx.fillText(ch, x + 3, y);   // 加粗
  }
  tx.restore();
}
// ───────── G3 STRAP IN!（本地 lt 0..4，120 BPM；8fps）─────────
export function sceneStrap(g, lt, o = {}) {
  const T = o.step === false ? lt : Math.floor(lt * 8) / 8;
  clearAscii();
  // 顶栏
  type(' FIVE-SECOND CAMP // TRAINING TERMINAL v0.5 '.padEnd(118, ' '), 1, 1, { inv: true });
  // 日志（右侧逐字打出）
  const log = [[.8, '> STRAP_IN.EXE'], [1.0, '  SEAT ......... OK'], [1.5, '  BELT ........ ' + (T >= 2.5 ? 'LOCKED' : '....')], [2.5, '  BUCKLE ...... CLICK'], [3.0, '  CADET 05 .... SECURED']];
  log.forEach(([t0, s], i) => { if (T >= t0) { const n = Math.min(s.length, Math.floor((T - t0) * 60)); type(s.slice(0, n), 76, 6 + i * 2); } });
  if (T >= .8 && T < 3.0 && Math.floor(lt * 4) % 2) type('_', 76 + (T >= 2.5 ? 20 : 16), 6 + Math.min(4, Math.floor((T - .8) / .5)) * 2);
  // 座椅（大号字）
  const C0 = 5, R0 = 2.6, SZ = 2.2;
  const seat = ["|=============|", "|             |", "|             |", "|             |", "|             |", "|             |"];
  // Dot
  const happy = T >= 3.0;
  const art = DOT_ART.map(r => r);
  if (happy) art[4] = "  /   (^) (^)   \\  ";
  // 安全带：第 10 行，从左往右三段推进，最后插进扣子
  let belt = 0; for (const [t0, v] of [[1.0, 4], [1.5, 8], [2.0, 11], [2.5, 13]]) if (T >= t0) belt = v;
  const locked = T >= 2.5;
  const row10 = " (___|" + ('='.repeat(Math.min(belt, 7))).padEnd(7, ' ') + "|___) ";
  art[10] = row10;
  drawArt(art, C0, R0, SZ);
  // 带子尾巴从画面左边伸进来 + 扣子
  const by = R0 + 10 * SZ;
  if (belt > 0 && !locked) { type('='.repeat(Math.max(0, 12 - belt)).padStart(Math.round(C0 / SZ + 1), ' ').slice(-Math.round(C0 / SZ + 1)), 0, by, { size: SZ, a: .9 }); }
  type(locked ? '[##]' : '[  ]', C0 + 13 * SZ, by, { size: SZ, inv: locked && Math.floor(lt * 8) % 2 === 0 });
  // SECURED 反白闪
  if (T >= 3.0) type(' SECURED ', 80, 22, { size: 2, inv: Math.floor(lt * 6) % 2 === 0 });
  // 底部状态栏
  type(`STRAP TENSION [${'#'.repeat(Math.round(Math.min(1, belt / 13) * 20)).padEnd(20, '.')}]`, 76, 18);
  print(g, { time: lt });
}
