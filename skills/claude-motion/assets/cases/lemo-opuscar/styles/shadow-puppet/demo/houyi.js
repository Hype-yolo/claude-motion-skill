// 后羿皮影：11 片驴皮 + 箭壶 + 弓箭 + 两根雉尾翎子；三根操纵杆（颈杆、两根手杆）
// 侧身朝右。所有坐标单位 = 幕布 px（机位 1×）。旋转：弧度，正 = 顺时针；手臂/腿 0 = 自然下垂，负值 = 向前（向右）抬
import { piece, drawPiece, fill, cut, cutLine, ink, within, smooth, poly, scales, scalesOpen, lattice, coin, cloud, beads, beadLine, plum, waves, meander, rivet, DYE } from './carve.js';

// —— 关节（父片局部坐标）——
const HK = 1.2;   // 头部放大（皮影头茬大，头盔占全身约 1/4）
export const J = {
  neck: [7, -122], shF: [16, -106], shB: [1, -110], rod: [5, -117],
  hipF: [10, 52], hipB: [-8, 50], elbow: [0, 62], wrist: [0, 54], feather: [-9 * HK, -104 * HK]
};
export const LEGLEN = 222 + 52;   // 腰 → 靴底
const UA = 62, FA = 54, HANDR = 13;      // 上臂、前臂、手心到腕

// ================= 各片 =================
const facePts = [[-6, 6], [8, 6], [9, -6], [13, -12], [18, -15], [19.5, -19], [21, -21.5], [19.5, -23.2], [22.5, -24.5], [21.5, -28], [24, -29.5], [27.5, -32.5], [22, -42], [18.5, -52], [17.5, -60], [17, -65], [-2, -64], [-6, -56], [-5, -40], [-9, -26], [-10, -10]];
const hairPts = [[-2, -64], [-18, -64], [-28, -58], [-31, -40], [-27, -18], [-17, 2], [-6, 7], [-10, -10], [-9, -26], [-4.5, -33], [-5, -40], [-6, -56]];
function head() {
  return piece([-50 * HK, -142 * HK, 36 * HK, 14 * HK], g => {
    g.scale(HK, HK);
    const rib = q => smooth(q, [[-24, -62], [-31, -58], [-39, -30], [-43, 0], [-37, 2], [-31, -28], [-26, -52]]);
    fill(g, DYE.red, rib); within(g, rib, () => beadLine(g, -30, -52, -40, -4, 1.2, 5)); ink(g, 1.3, rib);
    const flap = q => smooth(q, [[-22, -62], [-36, -52], [-38, -30], [-34, -14], [-27, -18], [-25, -40]]);
    fill(g, DYE.green, flap); within(g, flap, () => scales(g, -42, -58, -22, -10, 4.6, 1.05)); ink(g, 1.5, flap);
    const hair = q => poly(q, hairPts);
    fill(g, DYE.ink, hair);
    within(g, hair, () => { for (let k = 0; k < 7; k++) cutLine(g, .7, q => { q.moveTo(-6 - k * 3, -60); q.quadraticCurveTo(-24 - k * 1.2, -40 + k * 2, -16 - k * 1.5, -2 + k); }); });
    // 空脸：脸部镂空，只留轮廓与五官细皮线
    ink(g, 2.3, q => poly(q, facePts.slice(1, 17), false));
    ink(g, 1.2, q => { q.moveTo(16.5, -15); q.quadraticCurveTo(6, -9, -6, -24); });
    ink(g, 1.5, q => { q.moveTo(15.5, -44.2); q.quadraticCurveTo(8, -48.2, -1, -46); q.quadraticCurveTo(-4, -46.5, -6.5, -49.5); });
    ink(g, 1.05, q => { q.moveTo(15, -43.6); q.quadraticCurveTo(8, -41.8, 1.5, -44.6); });
    ink(g, .8, q => { q.moveTo(14, -47.2); q.quadraticCurveTo(7, -50, -1, -48.4); });
    g.beginPath(); g.arc(9.5, -45, 1.9, 0, Math.PI * 2); g.fillStyle = DYE.ink; g.fill();
    fill(g, DYE.ink, q => smooth(q, [[17.5, -51.4], [10, -54.2], [0, -56.4], [-8, -59.8], [-7, -57.2], [1, -53.8], [10, -51.6], [17, -49.8]]));
    ink(g, 1.1, q => { q.moveTo(23.8, -30.3); q.quadraticCurveTo(21, -31.5, 21.6, -28.4); });
    ink(g, 1.2, q => { q.moveTo(20.5, -23.4); q.lineTo(15.5, -22.6); });
    ink(g, 1.3, q => { q.moveTo(-3, -40); q.bezierCurveTo(-9, -41, -10, -30, -4.5, -30.5); q.moveTo(-5, -37); q.quadraticCurveTo(-7, -35, -5.2, -33); });
    const wing = q => smooth(q, [[-18, -70], [-30, -80], [-42, -76], [-44, -66], [-36, -62], [-30, -68], [-22, -64]]);
    fill(g, DYE.yellow, wing); cloud(g, -37, -71, 4.5, 0, 1, -1); ink(g, 1.3, wing);
    const dome = q => smooth(q, [[18, -69], [13, -90], [1, -106], [-14, -104], [-25, -90], [-28, -66]]);
    fill(g, DYE.red, dome);
    within(g, dome, () => { cloud(g, -8, -86, 9, 0, 1.3); cloud(g, 7, -84, 6, 2, 1.1, -1); beadLine(g, -22, -74, 12, -75, 1.3, 5); });
    ink(g, 1.7, dome);
    const band = q => poly(q, [[21, -61], [21, -71], [-28, -68], [-29, -59]]);
    fill(g, DYE.yellow, band); within(g, band, () => meander(g, -26, -61.5, 19, 3.6, 1)); ink(g, 1.6, band);
    const plate = q => smooth(q, [[14, -70], [23, -82], [17, -100], [8, -90], [4, -74]]);
    fill(g, DYE.yellow, plate); cut(g, q => { q.arc(14, -85, 3.8, 0, Math.PI * 2); }); cutLine(g, .9, q => { q.moveTo(9, -76); q.quadraticCurveTo(18, -80, 16, -94); }); ink(g, 1.4, plate);
    ink(g, 2.6, q => { q.moveTo(-3, -105); q.lineTo(-3, -114); }, DYE.brown);
    const pom = q => { q.arc(-3, -122, 9.5, 0, Math.PI * 2); };
    fill(g, DYE.orange, pom);
    for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; cutLine(g, 1, q => { q.moveTo(-3 + Math.cos(a) * 3, -122 + Math.sin(a) * 3); q.lineTo(-3 + Math.cos(a) * 8.5, -122 + Math.sin(a) * 8.5); }); }
    ink(g, 1.4, pom);
  }, { seed: 1 });
}
function chest() {
  const body = q => smooth(q, [[-26, 4], [-30, -40], [-32, -80], [-27, -104], [-14, -120], [0, -126], [14, -124], [27, -114], [39, -96], [45, -74], [41, -50], [33, -24], [28, 4]]);
  return piece([-40, -136, 50, 10], g => {
    fill(g, DYE.red, body);
    within(g, body, () => { scalesOpen(g, -38, -92, 48, -18, 6.4); });
    // 甲片分区线（留皮）
    ink(g, 2.4, q => { q.moveTo(-30, -52); q.quadraticCurveTo(6, -44, 42, -52); });
    const mir = q => { q.arc(20, -64, 14, 0, Math.PI * 2); };
    fill(g, DYE.yellow, mir); cut(g, q => { q.arc(20, -64, 11, 0, Math.PI * 2); q.arc(20, -64, 8, 0, Math.PI * 2, true); }, 'nonzero');
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; cut(g, q => { q.ellipse(20 + Math.cos(a) * 5, -64 + Math.sin(a) * 5, 2.4, 1.1, a, 0, Math.PI * 2); }); }
    ink(g, 1.5, mir);
    const cc = q => smooth(q, [[-27, -104], [-31, -94], [-21, -88], [-13, -95], [-3, -86], [7, -95], [17, -88], [27, -97], [37, -95], [34, -108], [20, -124], [2, -130], [-16, -126]]);
    fill(g, DYE.green, cc);
    within(g, cc, () => { ink(g, 5, cc, DYE.yellow); for (const [x, y, f] of [[-21, -98, 1], [-3, -97, -1], [17, -98, 1], [30, -104, -1]]) cloud(g, x, y, 5.4, 1.2, 1.4, f); lattice(g, -14, -126, 26, -108, 7, 1.6); });
    ink(g, 1.5, cc);
    const belt = q => poly(q, [[-28, -14], [31, -14], [29, 5], [-26, 5]]);
    fill(g, DYE.yellow, belt); within(g, belt, () => { for (let x = -22; x < 22; x += 9) coin(g, x, -4.5, 3.6); }); ink(g, 1.5, belt);
    const bk = q => { q.arc(27, -4, 8.5, 0, Math.PI * 2); };
    fill(g, DYE.gold, bk); cloud(g, 27, -4, 5.5, 0, 1.2, 1); ink(g, 1.4, bk);
    ink(g, 2.3, body);
  }, { seed: 2 });
}
function quiver() {
  return piece([-70, -196, -4, 0], g => {
    const ax = -36, ay = -28, bx = -14, by = -142, w = 9;
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), nx = -dy / L * w, ny = dx / L * w;
    for (let k = 0; k < 4; k++) {
      const off = (k - 1.5) * 4.2, sx = bx + nx * off / w, sy = by + ny * off / w, ex = sx + dx / L * (30 + k * 5) - 3 * k, ey = sy + dy / L * (30 + k * 5);
      ink(g, 1.8, q => { q.moveTo(sx, sy); q.lineTo(ex, ey); }, DYE.hide2);
      fill(g, DYE.red, q => poly(q, [[ex, ey], [ex - 6, ey + 4], [ex - 4, ey + 16], [ex + 1, ey + 12]]));
      fill(g, DYE.red, q => poly(q, [[ex, ey], [ex + 5, ey + 3], [ex + 5, ey + 15], [ex + 1, ey + 12]]));
      ink(g, .8, q => { q.moveTo(ex, ey); q.lineTo(ex - 1, ey + 14); });
    }
    const tube = q => poly(q, [[ax + nx, ay + ny], [bx + nx * 1.25, by + ny * 1.25], [bx - nx * 1.25, by - ny * 1.25], [ax - nx, ay - ny]]);
    fill(g, DYE.brown, tube);
    within(g, tube, () => { for (let k = 1; k < 6; k++) { const px = ax + dx * k / 6, py = ay + dy * k / 6; cloud(g, px, py, 4.4, k, 1, k % 2 ? 1 : -1); } });
    ink(g, 1.5, tube);
    const rim = q => poly(q, [[bx + nx * 1.4, by + ny * 1.4], [bx + nx * 1.4 - dx / L * 8, by + ny * 1.4 - dy / L * 8], [bx - nx * 1.4 - dx / L * 8, by - ny * 1.4 - dy / L * 8], [bx - nx * 1.4, by - ny * 1.4]]);
    fill(g, DYE.yellow, rim); ink(g, 1.3, rim);
  }, { seed: 3 });
}
function skirt() {
  return piece([-54, -8, 58, 160], g => {
    const inner = q => smooth(q, [[-30, -4], [28, -4], [40, 60], [50, 146], [0, 152], [-46, 148], [-40, 60]]);
    fill(g, DYE.yellow, inner); within(g, inner, () => { for (let y = 20; y < 152; y += 11) cutLine(g, 3, q => { for (let x = -50; x < 56; x += 11) { q.moveTo(x - 5, y + 2); q.quadraticCurveTo(x, y - 5, x + 5, y + 2); } }); }); ink(g, 1.6, inner);
    const back = q => smooth(q, [[-33, -4], [-1, -3], [-4, 80], [-14, 140], [-46, 138], [-40, 64]]);
    const front = q => smooth(q, [[3, -3], [31, -4], [44, 64], [50, 132], [24, 140], [9, 82]]);
    for (const f of [back, front]) {
      fill(g, DYE.red, f); within(g, f, () => scalesOpen(g, -50, 8, 52, 128, 6));
      g.save(); g.beginPath(); f(g); g.clip(); ink(g, 6, f, DYE.green); g.restore();
      within(g, f, () => { g.save(); g.beginPath(); f(g); g.clip(); g.restore(); });
      ink(g, 1.7, f);
    }
    const tab = q => smooth(q, [[-8, -3], [8, -3], [10, 70], [1, 96], [-8, 70]]);
    fill(g, DYE.green, tab); cloud(g, 1, 22, 5.5, 0, 1.3); coin(g, 1, 44, 5); plum(g, 1, 66, 3); ink(g, 1.5, tab);
    const tas = q => smooth(q, [[-2, 94], [4, 94], [5, 116], [1, 124], [-3, 116]]);
    fill(g, DYE.red, tas); for (let k = 0; k < 4; k++) cutLine(g, .9, q => { q.moveTo(-1 + k * 1.6, 102); q.lineTo(-1.5 + k * 1.8, 120); }); ink(g, 1.1, tas);
  }, { seed: 4 });
}
function leg() {
  return piece([-22, -12, 50, 226], g => {
    // 裤：锦纹菱格 + 膝部团花
    const tr = q => smooth(q, [[-13, -8], [13, -8], [15, 60], [15, 100], [13, 130], [-11, 132], [-14, 100], [-14, 60]]);
    fill(g, DYE.jade, tr);
    within(g, tr, () => { lattice(g, -16, 60, 18, 132, 9, 1.7); });
    fill(g, DYE.jade, q => q.arc(1, 96, 9, 0, 7)); cloud(g, 1, 96, 6.5, .5, 1.4); ink(g, 1.2, q => q.arc(1, 96, 9, 0, 7));
    ink(g, 1.7, tr);
    // 朝靴：高靴筒（墨色，刻云头）+ 翘头
    const boot = q => smooth(q, [[-13, 118], [13, 116], [14, 150], [15, 178], [26, 186], [38, 190], [43, 184], [45, 192], [40, 200], [-15, 200], [-15, 160]]);
    fill(g, DYE.ink, boot);
    within(g, boot, () => { cloud(g, 0, 138, 7, .3, 1.6); cloud(g, -2, 166, 5.5, 2.4, 1.4, -1); cutLine(g, 1.3, q => { q.moveTo(-13, 124); q.lineTo(13, 122); }); cutLine(g, 1.1, q => { q.moveTo(8, 184); q.quadraticCurveTo(22, 180, 36, 190); }); beadLine(g, -9, 151, 9, 150, 1.3, 4.5); });
    ink(g, 1.2, boot, '#000');
    // 厚白底：一整片刻花
    const sole = q => poly(q, [[-17, 199], [44, 197], [43, 204], [41, 221], [-15, 223], [-17, 212]]);
    fill(g, DYE.white, sole);
    within(g, sole, () => { cutLine(g, 1.4, q => { q.moveTo(-15, 205); q.lineTo(42, 203); q.moveTo(-15, 217); q.lineTo(41, 215.5); }); for (let x = -11; x < 40; x += 6.5) cut(g, q => { q.ellipse(x, 210.5, 2.1, 3.2, 0, 0, 7); }); });
    ink(g, 1.7, sole);
  }, { seed: 5 });
}
function upperArm() {
  const sl = q => smooth(q, [[-12, 0], [12, 0], [11, 56], [-10, 56]]);
  return piece([-28, -28, 28, 76], g => {
    fill(g, DYE.green, sl); fill(g, DYE.green, q => q.arc(0, 62, 10, 0, Math.PI * 2));
    within(g, sl, () => scalesOpen(g, -14, 14, 14, 56, 5));
    ink(g, 1.6, sl); ink(g, 1.5, q => q.arc(0, 62, 10, 0, Math.PI * 2));
    const gd = q => smooth(q, [[-21, -12], [-7, -25], [14, -23], [25, -7], [17, 12], [0, 19], [-19, 9]]);
    fill(g, DYE.yellow, gd); cloud(g, 1, -4, 8.5, 0, 1.6);
    within(g, gd, () => { const pts = []; for (let k = 0; k < 13; k++) { const a = .2 + k / 12 * 2.6; pts.push([Math.cos(a) * 17, -3 + Math.sin(a) * 15]); } beads(g, pts, 1.6); });
    ink(g, 1.7, gd);
  }, { seed: 6 });
}
function foreArm() {
  return piece([-14, -12, 14, 62], g => {
    fill(g, DYE.green, q => q.arc(0, 0, 9, 0, Math.PI * 2)); ink(g, 1.4, q => q.arc(0, 0, 9, 0, Math.PI * 2));
    const cf = q => smooth(q, [[-10, -2], [10, -2], [9, 36], [-8, 36]]);
    fill(g, DYE.green, cf); within(g, cf, () => scalesOpen(g, -12, 8, 12, 34, 4.4)); ink(g, 1.5, cf);
    const br = q => poly(q, [[-9, 31], [9, 31], [8, 56], [-8, 56]]);
    fill(g, DYE.yellow, br); within(g, br, () => lattice(g, -10, 31, 10, 56, 7, 1.5)); ink(g, 1.4, br);
  }, { seed: 7 });
}
function hand(kind) {
  const K = 1.15;
  return piece([-16, -6, 18, 30], g => {
    g.scale(K, K);
    const f = kind === 'bow'
      ? q => smooth(q, [[-7, -1], [7, -1], [11, 7], [11, 17], [5, 22], [-5, 21], [-9, 12]])
      : q => smooth(q, [[-7, -1], [7, -1], [12, 8], [13, 16], [8, 21], [-2, 22], [-8, 14]]);
    fill(g, DYE.skin, f);
    if (kind === 'bow') { cut(g, q => { q.ellipse(1.5, 12.5, 2.6, 3.4, 0, 0, Math.PI * 2); }); for (const y of [9, 13.5, 18]) cutLine(g, .8, q => { q.moveTo(5, y); q.lineTo(10, y + .5); }); }
    else { cutLine(g, .8, q => { q.moveTo(3, 7); q.quadraticCurveTo(9, 10, 8, 17); }); cutLine(g, .8, q => { q.moveTo(-2, 12); q.lineTo(4, 18); }); }
    ink(g, 1.5, f);
  }, { seed: 8 });
}
let P = null;
export function build() {
  if (P) return P;
  P = { head: head(), chest: chest(), quiver: quiver(), skirt: skirt(), leg: leg(), ua: upperArm(), fa: foreArm(), handBow: hand('bow'), handDraw: hand('draw') };
  return P;
}

// ================= 矩阵 =================
const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const T = (x, y) => [1, 0, 0, 1, x, y];
const R = a => { const c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
const S = k => [k, 0, 0, k, 0, 0];
export const ap = (M, x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
export { mul, T, R, S };
const set = (g, M) => g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);

// 两段 IK：肩 s（世界）→ 目标 p（世界，手心），返回上臂/前臂的世界旋转（0 = 下垂）
function ik(s, p, bend) {
  const L1 = UA, L2 = FA + HANDR; let dx = p[0] - s[0], dy = p[1] - s[1], d = Math.hypot(dx, dy);
  d = Math.max(Math.abs(L1 - L2) + 1, Math.min(L1 + L2 - .3, d));
  const phi = Math.atan2(dy, dx), al = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
  const a1 = phi + bend * al, e = [s[0] + Math.cos(a1) * L1, s[1] + Math.sin(a1) * L1];
  const a2 = Math.atan2(p[1] - e[1], p[0] - e[0]);
  return [a1 - Math.PI / 2, a2 - Math.PI / 2];
}

// 雉尾翎子：链条（静止曲率 + 动态偏转 dyn[i]）
function feather(g, K, base, dir0, n, seg, k, dyn, w0) {
  const pts = [[base[0], base[1]]]; let a = dir0, x = base[0], y = base[1];
  for (let i = 0; i < n; i++) { a += k + (dyn ? dyn[i] || 0 : 0); x += Math.cos(a) * seg; y += Math.sin(a) * seg; pts.push([x, y]); }
  set(g, [1, 0, 0, 1, 0, 0]);
  // 翎身：渐细带状 + 横斑
  const L = [], Rr = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
    const dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1, w = w0 * (1 - i / pts.length * .62);
    L.push([p[0] - dy / l * w, p[1] + dx / l * w]); Rr.push([p[0] + dy / l * w, p[1] - dx / l * w]);
  }
  g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (const p of L) g.lineTo(p[0], p[1]); for (let i = Rr.length - 1; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]); g.closePath();
  g.fillStyle = DYE.hide; g.fill();
  for (let i = 1; i < pts.length - 1; i++) {   // 横斑
    const j = i + .5, p0 = L[i], p1 = Rr[i], q0 = L[Math.min(i + 1, L.length - 1)], q1 = Rr[Math.min(i + 1, Rr.length - 1)];
    g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo((p1[0] + q1[0]) / 2, (p1[1] + q1[1]) / 2); g.lineTo((p0[0] + q0[0]) / 2, (p0[1] + q0[1]) / 2); g.closePath();
    g.fillStyle = i % 2 ? '#5a2a14' : DYE.gold; g.fill();
  }
  g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (const p of L) g.lineTo(p[0], p[1]); for (let i = Rr.length - 1; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]); g.closePath();
  g.strokeStyle = DYE.ink; g.lineWidth = 1.2 * K; g.stroke();
  return pts;
}

// 弓（世界坐标里画）：握点 G，前向 f，上向 u；draw 0..1；nock 拉弦点
function bow(g, K, G, f, u, draw, nock, arrow) {
  set(g, [1, 0, 0, 1, 0, 0]);
  const Lh = 100 * K, pt = s => {
    const bend = -(0.2 + .2 * draw) * Lh * s * s, rec = .5 * Lh * Math.max(0, Math.abs(s) - .8) ** 2 * 6;
    return [G[0] + u[0] * s * Lh + f[0] * (bend + rec), G[1] + u[1] * s * Lh + f[1] * (bend + rec)];
  };
  const top = pt(-1), bot = pt(1);
  const np = nock || [(top[0] + bot[0]) / 2, (top[1] + bot[1]) / 2];
  // 弦
  g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(np[0], np[1]); g.lineTo(bot[0], bot[1]); g.strokeStyle = '#3b2616'; g.lineWidth = 1.1 * K; g.stroke();
  // 箭
  if (arrow) {
    const ax = G[0] - np[0], ay = G[1] - np[1], al = Math.hypot(ax, ay) || 1, dx = ax / al, dy = ay / al, len = Math.max(150 * K, al + 40 * K);
    const tip = [np[0] + dx * len, np[1] + dy * len];
    g.beginPath(); g.moveTo(np[0], np[1]); g.lineTo(tip[0], tip[1]); g.strokeStyle = '#4a2612'; g.lineWidth = 3 * K; g.stroke();
    g.beginPath(); g.moveTo(tip[0] + dx * 12 * K, tip[1] + dy * 12 * K); g.lineTo(tip[0] - dy * 4.5 * K, tip[1] + dx * 4.5 * K); g.lineTo(tip[0] + dy * 4.5 * K, tip[1] - dx * 4.5 * K); g.closePath(); g.fillStyle = DYE.ink; g.fill();
    for (const sd of [1, -1]) { g.beginPath(); g.moveTo(np[0] + dx * 4 * K, np[1] + dy * 4 * K); g.lineTo(np[0] + (dx * 22 - dy * 5 * sd) * K, np[1] + (dy * 22 + dx * 5 * sd) * K); g.lineTo(np[0] + dx * 26 * K, np[1] + dy * 26 * K); g.closePath(); g.fillStyle = DYE.red; g.fill(); }
  }
  // 弓身：渐细 + 缠带
  const N = 30, Lp = [], Rp = [];
  for (let i = 0; i <= N; i++) {
    const s = -1 + 2 * i / N, p = pt(s), q = pt(Math.min(1, s + .02)), o = pt(Math.max(-1, s - .02));
    const dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1, w = (3.6 - 1.8 * Math.abs(s)) * K;
    Lp.push([p[0] - dy / l * w, p[1] + dx / l * w]); Rp.push([p[0] + dy / l * w, p[1] - dx / l * w]);
  }
  g.beginPath(); g.moveTo(Lp[0][0], Lp[0][1]); for (const p of Lp) g.lineTo(p[0], p[1]); for (let i = N; i >= 0; i--) g.lineTo(Rp[i][0], Rp[i][1]); g.closePath();
  g.fillStyle = DYE.brown; g.fill(); g.strokeStyle = DYE.ink; g.lineWidth = 1 * K; g.stroke();
  for (const s of [-.62, -.3, .3, .62]) { const i = Math.round((s + 1) / 2 * N); g.beginPath(); g.moveTo(Lp[i][0], Lp[i][1]); g.lineTo(Rp[i][0], Rp[i][1]); g.strokeStyle = DYE.yellow; g.lineWidth = 2.4 * K; g.stroke(); }
  return { top, bot };
}

// ================= 姿势 → 画到透射率画布 =================
// pose: {x,y,rot,head,waist,legF,legB, bowT:[dx,dy] 相对肩的握弓手目标, drawT, draw, arrow, bowOn, hB, hF, feat:[dynA,dynB]}
export const REST = { x: 0, y: 0, rot: 0, head: 0, waist: 0, legF: -.06, legB: .08, bowT: [16, 118], drawT: [10, 122], draw: 0, arrow: false, bowOn: true };
export function solve(pose) {
  const p = { ...REST, ...pose };
  const MW = mul(T(p.x, p.y), R(p.rot));
  const sB = ap(MW, ...J.shB), sF = ap(MW, ...J.shF);
  const toW = (s, d) => ap(MW, J[s][0] + d[0], J[s][1] + d[1]);
  const pB = toW('shB', p.bowT);
  const [aB1, aB2] = ik(sB, pB, p.bendB ?? 1);
  // 拉弦手：拉满时在下巴旁（锚点），否则按 drawT
  const pF = toW('shF', p.drawT);
  const [aF1, aF2] = ik(sF, pF, p.bendF ?? 1);
  return { p, MW, sB, sF, aB1, aB2, aF1, aF2 };
}
export function drawHouYi(g, Cam, pose, opt = {}) {
  const P = build(), S0 = solve(pose), { p, MW } = S0;
  const W = mul(Cam, MW);
  const Mskirt = mul(W, R(p.waist));
  const MlegB = mul(Mskirt, mul(T(...J.hipB), R(p.legB))), MlegF = mul(Mskirt, mul(T(...J.hipF), R(p.legF)));
  const Mhead = mul(W, mul(T(...J.neck), R(p.head)));
  const armM = (sh, a1, a2, hA) => {
    const Mu = mul(Cam, mul(T(...ap(MW, ...J[sh])), R(a1)));
    const Mf = mul(Mu, mul(T(...J.elbow), R(a2 - a1)));
    const Mh = mul(Mf, mul(T(...J.wrist), R(hA || 0)));
    return [Mu, Mf, Mh];
  };
  const [MuB, MfB, MhB] = armM('shB', S0.aB1, S0.aB2, p.hB);
  const [MuF, MfF, MhF] = armM('shF', S0.aF1, S0.aF2, p.hF);
  const riv = [];
  const dp = (M, pc) => { set(g, M); drawPiece(g, pc); };
  g.save(); g.globalCompositeOperation = 'multiply';
  // 弓：握点在握弓手的孔
  const Minv = MhB, G = ap(MhB, 1.7, 14.4), fx = ap(MhB, 1.7, 15.4), f = [fx[0] - G[0], fx[1] - G[1]];
  const fl = Math.hypot(f[0], f[1]); f[0] /= fl; f[1] /= fl; const u = [f[1], -f[0]];
  const nockW = p.draw > 0 ? ap(MhF, 3.5, 16) : null;
  const camK = Math.hypot(Cam[0], Cam[1]);
  // 画序：翎子 → 后臂(握弓) → 后腿 → 前腿 → 裙 → 箭壶 → 胸 → 头 → 前臂 → 弓 → 前手
  const headM = Mhead;
  const fb = ap(headM, ...J.feather);
  const worldHeadA = p.rot + p.head;
  const fd = p.feat || [];
  const plumeA = feather(g, camK, fb, -1.72 + worldHeadA, 10, 23 * camK, -.145, fd[0], 4.4 * camK);
  const plumeB = feather(g, camK, [fb[0] + 5 * camK, fb[1]], -1.52 + worldHeadA, 10, 21 * camK, -.16, fd[1], 3.9 * camK);
  dp(MuB, P.ua); dp(MfB, P.fa);
  if (p.bowOn) { var B = bow(g, camK, G, f, u, p.draw, nockW, p.arrow); }
  dp(MhB, P.handBow);
  dp(MlegB, P.leg); dp(MlegF, P.leg); dp(Mskirt, P.skirt);
  dp(W, P.quiver); dp(W, P.chest); dp(Mhead, P.head);
  dp(MuF, P.ua); dp(MfF, P.fa); dp(MhF, P.handDraw);
  g.restore();
  // 铆钉
  set(g, [1, 0, 0, 1, 0, 0]);
  const rv = (M, x, y) => { const q = ap(M, x, y); riv.push(q); };
  rv(W, ...J.neck); rv(W, ...J.shB); rv(W, ...J.shF); rv(W, 0, 0);
  rv(Mskirt, ...J.hipB); rv(Mskirt, ...J.hipF);
  rv(MuB, ...J.elbow); rv(MfB, ...J.wrist); rv(MuF, ...J.elbow); rv(MfF, ...J.wrist);
  if (opt.rivets !== false) for (const q of riv) rivet(g, q[0], q[1], 3.4 * camK);
  // 操纵杆锚点（世界 = 幕布坐标，已含机位的在屏幕坐标）
  const rods = [ap(W, ...J.rod), ap(MhB, 0, 8), ap(MhF, 0, 8)];
  return { rods, rivets: riv, M: { W, Mhead, MuB, MfB, MhB, MuF, MfF, MhF, Mskirt, MlegB, MlegF }, bow: B, plume: [plumeA, plumeB] };
}

// 操纵杆：离布的竹杆，虚、半透明（屏幕坐标）；ends = 杆尾（艺人手里）
export function drawRods(g, pts, ends, blur = 2.5, alpha = .62) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.filter = `blur(${blur}px)`; g.globalAlpha = alpha;
  pts.forEach((p, i) => {
    const e = ends[i]; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(e[0], e[1]); g.strokeStyle = '#2a1a10'; g.lineWidth = i === 0 ? 4.2 : 2.8; g.stroke();
    g.beginPath(); g.arc(p[0], p[1], i === 0 ? 4 : 3, 0, Math.PI * 2); g.fillStyle = '#2a1a10'; g.fill();
  });
  g.restore();
}
