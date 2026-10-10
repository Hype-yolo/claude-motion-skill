// 接云机：正立面几何（纸面坐标，y 向下），斜二测挤出，爆炸视图，活标注。
import { g, S, line, solid, knock, hatch, circ, ell, rect, xf, gearPts, text, dim, balloon, LW, FONT, TAU, proj, cam, lw, fillV } from './draw.js';
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

export const G = 1860, X = 1100;           // 地面线、桅杆轴
export const M = {
  pinion: [X, G - 120], idler: [X - 50.7, G - 138.5], big: [X - 157.1, G - 157.3],
  gauge: [X - 214, G - 290], pivot: [X, G - 940], house: [X - 272, G - 340, X + 68, G - 56],
  mastBot: G - 340, mastTop: G - 900, boomLen: 600, tail: 130,
};
const m3 = 3;
// 啮合相位
function meshAngle(t1, T1, T2, c1, c2) { const phi = Math.atan2(c2[1] - c1[1], c2[0] - c1[0]); return phi + Math.PI - Math.PI / T2 - (t1 - phi) * T1 / T2; }
export function gearAngles(th) {
  const a1 = th, a2 = meshAngle(a1, 48, 24, M.big, M.idler), a3 = meshAngle(a2, 24, 12, M.idler, M.pinion);
  return [a1, a2, a3];
}
// 爆炸偏移（dx, dy, dz），dz < 0 朝向观众
const EXP = {
  base: [0, 20, 0], house: [0, -70, 0], crank: [-150, -390, -430], big: [-60, -250, -310], idler: [-20, -200, -220], pinion: [0, -160, -150],
  gauge: [-60, -220, -200], bellows: [-240, 50, 0], mast: [0, -170, 0], chain: [0, -170, -110], head: [0, -260, 0],
  boom: [80, -280, 0], cw: [-130, -270, 0], net: [210, -300, 0], vane: [0, -330, 0],
};
const ORDER = ['base', 'mast', 'chain', 'head', 'boom', 'cw', 'net', 'vane', 'house', 'bellows', 'gauge', 'pinion', 'idler', 'big', 'crank'];
const EXSEQ = ['vane', 'net', 'cw', 'boom', 'head', 'mast', 'chain', 'bellows', 'base', 'gauge', 'crank', 'big', 'idler', 'pinion'];
export function explodeOf(part, E) {
  const i = EXSEQ.indexOf(part); if (i < 0) return 0;
  return eio(clamp((E * (1 + EXSEQ.length * .055) - i * .055) / 1));
}
// 阶段进度 → 单项进度
const stag = (P, i, n, span = .45) => clamp((P - (i / Math.max(1, n)) * (1 - span)) / span);

export function drawMachine(P = {}) {
  const pr = Object.assign({ c: 1, o: 1, g: 1, d: 1, h: 1, m: 1, b: 1 }, P.pr || {});
  const E = P.E || 0, th = P.gear || 0, boomA = P.boom ?? -.52, bel = P.bellows ?? .5, vane = P.vane ?? 0, gv = P.gauge ?? 0;
  const sec = P.section;          // 剖切线扫过的 x（null = 不剖）
  const off = k => { const e = explodeOf(k, E), v = EXP[k]; return [v[0] * e, v[1] * e, v[2] * e]; };
  const [ga1, ga2, ga3] = gearAngles(th);
  const BAL = [];                 // 零件号（最后画，永远在上层）
  const DIMS = [];
  const parts = {
    base() {
      const [ox, oy, oz] = off('base');
      const pts = xf(rect(X - 322, G - 58, X + 198, G - 28), ox, oy);
      solid(pts, { d0: oz - 70, th: 140, u: stag(pr.o, 0, 6) });
      // 螺栓
      for (const bx of [X - 294, X + 170]) { line(xf(rect(bx - 9, G - 70, bx + 9, G - 58), ox, oy), { w: LW.det, closed: true, u: pr.d, d: oz - 70 }); }
      // 脚轮
      for (const wx of [X - 272, X + 148]) { const c = xf([[wx, G - 14]], ox, oy)[0]; solid(circ(c[0], c[1], 14, 28), { d0: oz - 60, th: 18, w: LW.det, u: stag(pr.o, 1, 6), conn: false }); line(circ(c[0], c[1], 4, 12), { w: LW.thin, closed: true, u: pr.d, d: oz - 60 }); }
      hatch(pts, { sp: 13, u: pr.h, d: oz - 70 });
      BAL.push([[X + 188 + ox, G - 44 + oy], [X + 273 + ox, G + 20 + oy], 1, oz - 70, pr.b]);
    },
    house() {
      const [ox, oy, oz] = off('house');
      const [x0, y0, x1, y1] = M.house, pts = rect(x0, y0, x1, y1);
      const d0 = -50, T = 100;
      const u = stag(pr.o, 1, 6);
      if (sec == null) {
        solid(pts, { d0, th: T, u });
        // 面板螺钉 + 铭牌
        if (pr.d > 0) for (const [bx, by] of [[x0 + 16, y0 + 16], [x1 - 16, y0 + 16], [x0 + 16, y1 - 16], [x1 - 16, y1 - 16]]) line(circ(bx, by, 5, 14), { w: LW.thin, closed: true, u: pr.d, d: d0 });
        line(rect(x0 + 120, y0 + 22, x1 - 80, y0 + 62), { w: LW.thin, closed: true, u: pr.d, d: d0 });
        text('No. 1', (x0 + 120 + x1 - 80) / 2, y0 + 51, { size: 26, align: 'center', font: FONT.hand, u: pr.d, d: d0, nib: false });
      } else {
        // 剖切：左侧（x < sec）露出内部
        solid(pts, { d0, th: T, u: 1 });
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        const cl = rect(x0 - 40, y0 - 40, Math.min(x1 + 40, sec), y1 + 40);
        g.beginPath(); cl.forEach(([x, y], i) => { const [sx, sy] = S(x, y, d0); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); }); g.closePath(); g.clip();
        knock(pts, d0);
        const wt = 16;
        // 剖开的墙（剖面线）
        const walls = [rect(x0, y0, x1, y0 + wt), rect(x0, y1 - wt, x1, y1), rect(x0, y0, x0 + wt, y1), rect(x1 - wt, y0, x1, y1)];
        for (const wv of walls) { line(wv, { w: LW.det, closed: true, d: d0 }); hatch(wv, { sp: 8, d: d0, v: .9 }); }
        line(rect(x0 + wt, y0 + wt, x1 - wt, y1 - wt), { w: LW.det, closed: true, d: d0 });
        // 发条（阿基米德螺线）+ 棘轮 + 下链轮
        const sc = [X - 162, G - 170], sp = [];
        for (let i = 0; i <= 260; i++) { const a = i / 260 * TAU * 5.2 + th * .2; const r = 10 + i / 260 * 78; sp.push([sc[0] + Math.cos(a) * r, sc[1] + Math.sin(a) * r]); }
        line(sp, { w: LW.thin, d: d0 });
        line(circ(sc[0], sc[1], 10, 20), { w: LW.det, closed: true, d: d0 });
        line(gearPts(M.pinion[0], M.pinion[1], 16, 2.4, ga3), { w: LW.det, closed: true, d: d0 });
        line(circ(M.pinion[0], M.pinion[1], 6, 14), { w: LW.thin, closed: true, d: d0 });
        // 棘爪
        line([[X - 57, G - 250], [X - 32, G - 225], [X - 7, G - 250]], { w: LW.det, d: d0 });
        g.restore();
        // 剖切线 A–A
        const top = y0 - 90, bot = y1 + 90;
        line([[sec, top], [sec, bot]], { w: LW.out, dash: 'phantom', d: d0 });
        for (const [yy, dir] of [[top, 1], [bot, -1]]) {
          line([[sec, yy], [sec - 46, yy]], { w: LW.out, d: d0 });
          fillV([[sec - 46, yy], [sec - 30, yy - 6], [sec - 30, yy + 6]], 1, d0);
          text('A', sec - 64, yy + (dir > 0 ? 8 : 22), { size: 34, align: 'center', font: FONT.hand, d: d0, nib: false });
        }
      }
      BAL.push([[x0 + 60 + ox, y1 - 30 + oy], [x0 - 70 + ox, y1 + 60 + oy], 2, d0 + oz, pr.b]);
    },
    gauge() {
      const [ox, oy, oz] = off('gauge');
      const [cx, cy] = [M.gauge[0] + ox, M.gauge[1] + oy], d0 = -64 + oz, u = stag(pr.g, 4, 6);
      solid(circ(cx, cy, 34, 48), { d0, th: 14, w: LW.det, u, conn: false });
      line(circ(cx, cy, 27, 40), { w: LW.hair, closed: true, u: pr.d, d: d0 });
      for (let i = 0; i <= 10; i++) { const a = Math.PI * (.8 + 1.4 * i / 10); const r0 = i % 5 ? 21 : 17; line([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * 26, cy + Math.sin(a) * 26]], { w: LW.hair, u: pr.d, d: d0, nib: false }); }
      if (pr.d > .5) { text('0', cx - 12, cy + 18, { size: 13, align: 'center', font: FONT.tech, d: d0 }); text('1', cx + 13, cy + 18, { size: 13, align: 'center', font: FONT.tech, d: d0 }); }
      const na = Math.PI * (.8 + 1.4 * gv);
      line([[cx - Math.cos(na) * 6, cy - Math.sin(na) * 6], [cx + Math.cos(na) * 23, cy + Math.sin(na) * 23]], { w: LW.det, u: pr.d, d: d0, nib: false });
      line(circ(cx, cy, 3.5, 10), { w: LW.det, closed: true, u: pr.d, d: d0 });
      BAL.push([[cx - 24, cy - 22], [cx - 90, cy - 80], 4, d0, pr.b]);
    },
    big() {
      const [ox, oy, oz] = off('big'); const [cx, cy] = [M.big[0] + ox, M.big[1] + oy], d0 = -72 + oz, u = stag(pr.g, 0, 6);
      solid(gearPts(cx, cy, 48, m3, ga1), { d0, th: 18, w: LW.det, u, conn: false });
      line(circ(cx, cy, 72, 72), { w: LW.hair, dash: 'center', closed: true, u: pr.c, d: d0 });
      // 轮辐 + 轮毂
      for (let i = 0; i < 5; i++) { const a = ga1 + i * TAU / 5; line([[cx + Math.cos(a) * 16, cy + Math.sin(a) * 16], [cx + Math.cos(a) * 52, cy + Math.sin(a) * 52]], { w: LW.det, u: pr.d, d: d0, nib: false }); }
      line(circ(cx, cy, 55, 56), { w: LW.thin, closed: true, u: pr.d, d: d0 });
      line(circ(cx, cy, 16, 24), { w: LW.det, closed: true, u: pr.d, d: d0 });
      BAL.push([[cx - 52, cy + 40], [cx - 150, cy + 120], 3.1, d0, 0]);
    },
    idler() {
      const [ox, oy, oz] = off('idler'); const [cx, cy] = [M.idler[0] + ox, M.idler[1] + oy], d0 = -66 + oz, u = stag(pr.g, 1, 6);
      solid(gearPts(cx, cy, 24, m3, ga2), { d0, th: 14, w: LW.det, u, conn: false });
      line(circ(cx, cy, 36, 48), { w: LW.hair, dash: 'center', closed: true, u: pr.c, d: d0 });
      line(circ(cx, cy, 10, 18), { w: LW.det, closed: true, u: pr.d, d: d0 });
      for (let i = 0; i < 4; i++) { const a = ga2 + i * TAU / 4 + .4; line(circ(cx + Math.cos(a) * 21, cy + Math.sin(a) * 21, 5, 12), { w: LW.thin, closed: true, u: pr.d, d: d0 }); }
    },
    pinion() {
      const [ox, oy, oz] = off('pinion'); const [cx, cy] = [M.pinion[0] + ox, M.pinion[1] + oy], d0 = -62 + oz, u = stag(pr.g, 2, 6);
      solid(gearPts(cx, cy, 12, m3, ga3), { d0, th: 12, w: LW.det, u, conn: false });
      line(circ(cx, cy, 7, 14), { w: LW.det, closed: true, u: pr.d, d: d0 });
    },
    crank() {
      const [ox, oy, oz] = off('crank'); const [cx, cy] = [M.big[0] + ox, M.big[1] + oy], d0 = -92 + oz, u = stag(pr.d, 1, 8);
      const a = ga1 + 2.2, L = 84, ex = [cx + Math.cos(a) * L, cy + Math.sin(a) * L];
      const nx = -Math.sin(a), ny = Math.cos(a);
      const arm = [[cx + nx * 11, cy + ny * 11], [ex[0] + nx * 7, ex[1] + ny * 7], [ex[0] - nx * 7, ex[1] - ny * 7], [cx - nx * 11, cy - ny * 11]];
      solid(arm, { d0, th: 10, w: LW.det, u });
      solid(circ(cx, cy, 13, 20), { d0: d0 - 4, th: 10, w: LW.det, u, conn: false });
      // 手柄（朝向观众的圆柱）
      solid(circ(ex[0], ex[1], 11, 20), { d0: d0 - 46, th: 46, w: LW.det, u, conn: false });
      BAL.push([ex, [ex[0] - 70, ex[1] - 60], 3, d0 - 46, pr.b]);
    },
    bellows() {
      const [ox, oy, oz] = off('bellows'); const x1 = X - 272 + ox, L = 58 + 52 * bel, x0 = x1 - L, y0 = G - 262 + oy, y1 = G - 138 + oy, d0 = -40 + oz, u = stag(pr.d, 2, 8);
      const n = 6, top = [], bot = [];
      for (let i = 0; i <= n; i++) { const x = x1 - L * i / n, z = i % 2 ? 12 : 0; top.push([x, y0 + z]); bot.push([x, y1 - z]); }
      const body = [...top, ...bot.slice().reverse()];
      solid(body, { d0: d0 + 10, th: 60, w: LW.det, u, conn: false });
      for (let i = 1; i < n; i++) line([top[i], bot[i]], { w: LW.hair, u: pr.d, d: d0 + 10, nib: false });
      // 端板 + 喷嘴
      const bd = rect(x0 - 14, y0 - 12, x0, y1 + 12);
      solid(bd, { d0, th: 80, w: LW.det, u });
      const nz = [[x0 - 14, (y0 + y1) / 2 - 12], [x0 - 70, (y0 + y1) / 2 - 42], [x0 - 76, (y0 + y1) / 2 - 32], [x0 - 14, (y0 + y1) / 2 + 12]];
      solid(nz, { d0: d0 + 30, th: 20, w: LW.det, u });
      BAL.push([[x0 + L * .4, y0 + 20], [x0 - 40, y0 - 90], 5, d0 + 10, pr.b]);
    },
    mast(chainOnly) {
      const [ox, oy, oz] = off('mast');
      const yb = M.mastBot + oy, yt = M.mastTop + oy, n = 7;
      const wAt = y => 42 - 14 * (yb - y) / (yb - yt);
      const L = [], R = [];
      for (let i = 0; i <= n; i++) { const y = yb + (yt - yb) * i / n; L.push([X + ox - wAt(y), y]); R.push([X + ox + wAt(y), y]); }
      const u = stag(pr.o, 2, 6), ud = stag(pr.d, 0, 8);
      const face = (d) => {
        line(L, { w: LW.out, u, d }); line(R, { w: LW.out, u, d });
        for (let i = 0; i < n; i++) { line([L[i], R[i]], { w: LW.det, u: ud, d, nib: false }); line(i % 2 ? [L[i], R[i + 1]] : [R[i], L[i + 1]], { w: LW.det, u: ud, d, nib: false }); }
        line([L[n], R[n]], { w: LW.det, u: ud, d, nib: false });
      };
      if (proj.k > .01) face(oz + 30); // 后片桁架
      face(oz - 30);
      line([[X + ox, yb + 60], [X + ox, yt - 150]], { w: LW.hair, dash: 'center', u: pr.c, d: oz - 30 });
      BAL.push([[X + ox + wAt(yb - 260) , yb - 260], [X + ox + 120, yb - 330], 6, oz - 30, pr.b]);
    },
    chain() {
      const [ox, oy, oz] = off('chain');
      const yb = M.mastBot + oy + 20, yt = M.mastTop + oy - 20, d = oz - 5, u = stag(pr.d, 3, 8);
      const cw = 12;
      line([[X + ox - cw, yb], [X + ox - cw, yt]], { w: LW.thin, u, d }); line([[X + ox + cw, yb], [X + ox + cw, yt]], { w: LW.thin, u, d });
      // 链节（随小齿轮转动而移动）
      if (u >= 1) {
        const ph = ((gearAngles(th)[2] * 20) % 22 + 22) % 22;
        for (let y = yt + ph; y < yb; y += 22) { line([[X + ox - cw, y], [X + ox - cw, y + 12]], { w: LW.det, d, nib: false }); line([[X + ox + cw, y + 11 - 2 * ph % 11], [X + ox + cw, y + 23 - 2 * ph % 11]], { w: LW.det, d, nib: false }); }
      }
      // 隐藏段（在齿轮箱里）：虚线
      line([[X + ox - cw, M.mastBot + oy + 20], [X + ox - cw, M.pinion[1] + oy]], { w: LW.hair, dash: 'hidden', u, d });
      line([[X + ox + cw, M.mastBot + oy + 20], [X + ox + cw, M.pinion[1] + oy]], { w: LW.hair, dash: 'hidden', u, d });
      BAL.push([[X + ox - cw, (yb + yt) / 2 + 60], [X + ox - 120, (yb + yt) / 2], 7, d, pr.b]);
    },
    head() {
      const [ox, oy, oz] = off('head'); const cy = M.pivot[1] + oy, cx = X + ox, d0 = oz - 36;
      const pts = [[cx - 46, cy + 40], [cx - 46, cy - 24], [cx - 30, cy - 40], [cx + 30, cy - 40], [cx + 46, cy - 24], [cx + 46, cy + 40]];
      solid(pts, { d0, th: 72, u: stag(pr.o, 3, 6) });
      line(circ(cx, cy, 22, 36), { w: LW.hair, dash: 'hidden', closed: true, u: pr.d, d: d0 });
      line(circ(cx, cy, 8, 16), { w: LW.det, closed: true, u: pr.d, d: d0 });
      BAL.push([[cx + 40, cy - 30], [cx + 110, cy - 110], 8, d0, pr.b]);
    },
    boom() {
      const [ox, oy, oz] = off('boom'); const px = X + ox, py = M.pivot[1] + oy;
      const n = 9, L = M.boomLen, T = M.tail;
      const hAt = x => x < 0 ? 16 : 18 - 9 * x / L;
      const top = [], bot = [];
      for (let i = 0; i <= n + 2; i++) { const x = -T + (L + T) * i / (n + 2); top.push([x, -hAt(x)]); bot.push([x, hAt(x)]); }
      const tf = p => xf(p, px, py, boomA);
      const u = stag(pr.o, 4, 6), ud = stag(pr.d, 4, 8);
      const face = d => {
        line(tf(top), { w: LW.out, u, d }); line(tf(bot), { w: LW.out, u, d });
        for (let i = 0; i < top.length - 1; i++) line(tf(i % 2 ? [top[i], bot[i + 1]] : [bot[i], top[i + 1]]), { w: LW.det, u: ud, d, nib: false });
        line(tf([top[0], bot[0]]), { w: LW.det, u: ud, d, nib: false }); line(tf([top[top.length - 1], bot[bot.length - 1]]), { w: LW.det, u: ud, d, nib: false });
      };
      if (proj.k > .01) face(oz + 22);
      face(oz - 22);
      line(tf([[-T - 40, 0], [L + 60, 0]]), { w: LW.hair, dash: 'center', u: pr.c, d: oz - 22 });
      line(circ(px, py, 9, 16), { w: LW.det, closed: true, u: ud, d: oz - 40 });
      const bp = tf([[L * .55, -hAt(L * .55)]])[0];
      BAL.push([bp, [bp[0] + 40, bp[1] - 120], 9, oz - 22, pr.b]);
    },
    cw() {   // 配重：祖母的熨斗
      const [ox, oy, oz] = off('cw'); const px = X + ox, py = M.pivot[1] + oy;
      const hang = xf([[-M.tail + 14, 16]], px, py, boomA)[0];
      const hx = hang[0], hy = hang[1];
      line([[hx, hy], [hx, hy + 40]], { w: LW.det, u: stag(pr.d, 5, 8), d: oz - 10 });
      const iron = [[hx - 52, hy + 104], [hx + 40, hy + 104], [hx + 34, hy + 80], [hx - 10, hy + 66], [hx - 44, hy + 74]];
      solid(iron, { d0: oz - 24, th: 48, w: LW.det, u: stag(pr.o, 5, 6) });
      line([[hx - 30, hy + 70], [hx - 26, hy + 40], [hx + 16, hy + 40], [hx + 18, hy + 70]], { w: LW.det, u: stag(pr.d, 5, 8), d: oz - 24 });
      hatch(iron, { sp: 9, u: pr.h, d: oz - 24, ang: -Math.PI / 4 });
      BAL.push([[hx - 40, hy + 96], [hx - 110, hy + 150], 10, oz - 24, pr.b]);
    },
    net() {
      const [ox, oy, oz] = off('net'); const px = X + ox, py = M.pivot[1] + oy, d = oz - 10;
      const L = M.boomLen, tf = p => xf(p, px, py, boomA);
      const tip = tf([[L, 0]])[0];
      const hc = tf([[L + 104, 0]])[0], rx = 104, ry = 30;
      const u = stag(pr.o, 5, 6), ud = stag(pr.d, 6, 8);
      line(tf([[L - 6, -10], [L + 8, -10], [L + 8, 10], [L - 6, 10]]), { w: LW.det, closed: true, u, d });
      const hoopBack = ell(hc[0], hc[1], rx, ry, boomA, 40, Math.PI, TAU), hoopFront = ell(hc[0], hc[1], rx, ry, boomA, 40, 0, Math.PI);
      const bag = P.bag ?? 0;             // 0 = 空网下垂，1 = 兜住云（鼓起）
      const depth = 170 + 30 * bag, bw = 1 + .25 * bag;
      const bottom = [hc[0] + 10, hc[1] + depth];
      const left = ell(hc[0], hc[1], rx, ry, boomA, 1, Math.PI, Math.PI)[0], right = ell(hc[0], hc[1], rx, ry, boomA, 1, 0, 0)[0];
      const curve = (a, b, bulge, k = 24) => { const p = []; for (let i = 0; i <= k; i++) { const t = i / k, mt = 1 - t; const cx = (a[0] + b[0]) / 2 + bulge[0], cy = (a[1] + b[1]) / 2 + bulge[1]; p.push([mt * mt * a[0] + 2 * mt * t * cx + t * t * b[0], mt * mt * a[1] + 2 * mt * t * cy + t * t * b[1]]); } return p; };
      const bagOutline = [...curve(left, bottom, [-40 * bw, 30]), ...curve(bottom, right, [40 * bw, 30]).slice(1)];
      const bagPoly = [...bagOutline, ...hoopBack.slice().reverse()];
      if (!P.netNoFill) knock(bagPoly, d);
      if ((P.bagFill || 0) > 0) {   // 兜住的云：云体鼓进网兜，网线压在上面
        const inBag = [...bagOutline, ...hoopFront];
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.beginPath(); inBag.forEach(([x, y], i) => { const [sx, sy] = S(x, y, d); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); }); g.closePath(); g.clip();
        knock(inBag, d);
        g.globalCompositeOperation = 'lighter';
        const [cx0, cy0] = S(hc[0] - 20, hc[1] + depth * .15, d), R = rx * 1.25 * cam.z, a = .30 * P.bagFill;
        const gr = g.createRadialGradient(cx0, cy0, 0, cx0, cy0, R); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.6, `rgba(255,255,255,${a * .55})`); gr.addColorStop(1, `rgba(255,255,255,${a * .15})`);
        g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080); g.globalCompositeOperation = 'source-over';
        for (const [ox, oy, r] of [[-40, 40, 38], [25, 70, 34], [-5, 110, 26]]) line(circ(hc[0] + ox, hc[1] + oy * (depth / 170), r, 24, Math.PI * 1.1, Math.PI * 1.9), { w: LW.thin, v: .7 * P.bagFill, d, nib: false });
        g.restore();
      }
      if (P.net !== 'only') line(hoopBack, { w: LW.det, u, d });
      // 网眼：经线（从网圈到底）+ 纬线
      for (let i = 1; i < 8; i++) { const a = Math.PI * i / 8; const q = ell(hc[0], hc[1], rx, ry, boomA, 1, a, a)[0]; line(curve(q, bottom, [(q[0] - hc[0]) * .35 * bw, 20]), { w: LW.hair, u: ud, d, nib: false }); }
      for (let j = 1; j < 5; j++) { const t = j / 5; const cy = hc[1] + depth * t * .92, wd = rx * (1 - t * t * .85) * bw; line(ell(hc[0] + 6 * t, cy, wd, ry * (1 - t) * .8 + 2, 0, 36, 0, Math.PI), { w: LW.hair, u: ud, d, nib: false }); }
      line(bagOutline, { w: LW.det, u, d });
      line(hoopFront, { w: LW.out, u, d });
      BAL.push([[hc[0] + rx * .9, hc[1] + 30], [hc[0] + rx + 70, hc[1] + 70], 11, d, pr.b]);
      parts._net = { hc, rx, ry, bottom, d, tip };
    },
    vane() {
      const [ox, oy, oz] = off('vane'); const cx = X + ox, y0 = M.pivot[1] - 40 + oy, y1 = y0 - 90, d = oz - 10;
      const u = stag(pr.d, 7, 8);
      line([[cx, y0], [cx, y1]], { w: LW.det, u, d });
      line(circ(cx, y1 - 6, 6, 14), { w: LW.det, closed: true, u, d });
      const a = vane * 1.35;  // 0 = 迎风竖起，1 = 耷拉
      const fl = xf([[0, 0], [70, 12], [0, 30]], cx, y1 + 6, a);
      solid(fl, { d0: d, th: 4, w: LW.det, u });
      BAL.push([[cx - 4, y1 + 36], [cx - 90, y1 + 10], 12, d, pr.b]);
    },
  };
  const order = P.net === 'only' ? ['net'] : P.net === 'skip' ? ORDER.filter(k => k !== 'net') : ORDER;
  for (const k of order) parts[k]();
  if (P.net === 'only') { if (P.balloons !== false) for (const [a, b, n, d, u] of BAL) balloon(a, b, n, { u, d, dt: d }); return parts._net; }
  // 零件号（爆炸时跟着零件飞）
  if (P.balloons !== false) for (const [a, b, n, d, u] of BAL) if (Number.isInteger(n)) balloon(a, b, n, { u, d, dt: d });
  return parts._net;
}

// 花坛（不参与爆炸）
export function drawGarden(P = {}) {
  const u = P.u ?? 1, d0 = -45;
  const box = rect(1460, G - 60, 1820, G);
  solid(box, { d0, th: 90, u });
  for (let i = 1; i < 3; i++) line([[1460, G - 60 + 20 * i], [1820, G - 60 + 20 * i]], { w: LW.hair, u: P.ud ?? u, d: d0, nib: false });
  // 土
  const soil = [[1466, G - 60]]; for (let i = 0; i <= 18; i++) soil.push([1466 + i * 19, G - 64 - 6 * Math.abs(Math.sin(i * 1.7))]); soil.push([1814, G - 60]);
  line(soil, { w: LW.thin, u: P.ud ?? u, d: d0 });
  hatch(rect(1460, G - 60, 1820, G), { sp: 11, u: P.uh ?? u, d: d0, v: .55 });
  // 地面线 + 地面阴影短线
  line([[640, G], [1990, G]], { w: LW.out, u: P.ug ?? u, d: 0 });
  for (let x = 650; x < 1980; x += 26) line([[x, G + 4], [x - 14, G + 18]], { w: LW.hair, u: P.ug ?? u, d: 0, nib: false });
}
// 花：root 根部，h 高度，droop 0–1（低垂），bloom 0–1（花瓣展开），u 画出进度
export function flower(x, y, h, droop, bloom, u = 1, o = {}) {
  if (u <= 0) return;
  const d = o.d ?? -45, stem = [];
  const bend = droop * 1.6;
  let px = x, py = y, a = -Math.PI / 2;
  const N = 24;
  for (let i = 0; i <= N; i++) { stem.push([px, py]); const t = i / N; a += (bend * t * t) / N * 2.2 + (o.sway || 0) / N; px += Math.cos(a) * h / N; py += Math.sin(a) * h / N; }
  const us = clamp(u / .5);
  line(stem, { w: LW.det, u: us, d });
  // 叶
  if (u > .35) {
    const ul = clamp((u - .35) / .3);
    for (const [k, s] of [[8, 1], [13, -1]]) {
      const [bx, by] = stem[k], la = -Math.PI / 2 + s * (1.0 - droop * .5) + (droop * .9);
      const L = 44 * (o.leaf ?? 1), tip = [bx + Math.cos(la) * L, by + Math.sin(la) * L], n = [-Math.sin(la) * 12, Math.cos(la) * 12];
      const leaf = [[bx, by], [bx + (tip[0] - bx) * .5 + n[0], by + (tip[1] - by) * .5 + n[1]], tip, [bx + (tip[0] - bx) * .5 - n[0], by + (tip[1] - by) * .5 - n[1]], [bx, by]];
      line(leaf, { w: LW.thin, u: ul, d });
      line([[bx, by], tip], { w: LW.hair, u: ul, d, nib: false });
    }
  }
  // 花头
  if (u > .6) {
    const uh = clamp((u - .6) / .4);
    const [hx, hy] = stem[N], ha = a + Math.PI / 2;
    const np = 7, R = 26 * (o.size ?? 1);
    for (let i = 0; i < np; i++) {
      const pa = ha - Math.PI / 2 + (i - (np - 1) / 2) * (.25 + .38 * bloom), L = R * (.55 + .75 * bloom);
      const pp = [[hx, hy], [hx + Math.cos(pa - .22) * L * .7, hy + Math.sin(pa - .22) * L * .7], [hx + Math.cos(pa) * L, hy + Math.sin(pa) * L], [hx + Math.cos(pa + .22) * L * .7, hy + Math.sin(pa + .22) * L * .7], [hx, hy]];
      line(pp, { w: LW.thin, u: clamp(uh * 1.6 - i * .08), d });
    }
    line(circ(hx, hy, 6 + 3 * bloom, 14), { w: LW.det, closed: true, u: uh, d });
  }
}

// 爆炸装配路径（点划线：零件从哪里来）
export function explodePaths(E, boomA = -.52, u = 1) {
  if (E <= 0.001 || u <= 0) return;
  const P = (k, x, y, d0) => { const e = explodeOf(k, E), v = EXP[k]; if (e < .02) return; line([[x, y], [x + v[0] * e + 0.0001, y + v[1] * e]], { w: LW.hair, dash: 'center', v: .75, u, d: d0, nib: false }); };
  // 深度方向的路径需要逐点投影：用短折线沿深度插值
  const PD = (k, x, y, d0) => { const e = explodeOf(k, E), v = EXP[k]; if (e < .02) return; const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([x + v[0] * e * t, y + v[1] * e * t, d0 + v[2] * e * t]); }
    for (let i = 1; i < pts.length; i++) { if (i % 2 === 0) continue; const a = pts[i - 1], b = pts[i]; lineD(a, b); } };
  PD('crank', M.big[0], M.big[1], -92); PD('big', M.big[0], M.big[1], -72); PD('idler', M.idler[0], M.idler[1], -66); PD('pinion', M.pinion[0], M.pinion[1], -62); PD('gauge', M.gauge[0], M.gauge[1], -64);
  P('bellows', X - 272, G - 200, -40); P('base', X + 150, G - 44, -70); P('base', X - 250, G - 44, -70);
  const o = k => { const e = explodeOf(k, E), v = EXP[k]; return [v[0] * e, v[1] * e]; };
  const at = (k, r) => { const [ox, oy] = o(k); return [X + ox + Math.cos(boomA) * r, M.pivot[1] + oy + Math.sin(boomA) * r]; };
  const seg2 = (a, b, d) => line([a, b], { w: LW.hair, dash: 'center', v: .75, u, d, nib: false });
  seg2(at('boom', M.boomLen), at('net', M.boomLen), -10);
  const t1 = at('boom', -M.tail + 14), t2 = at('cw', -M.tail + 14); seg2(t1, [t2[0], t2[1]], -24);
}
function lineD(a, b) {
  const A = S(a[0], a[1], a[2]), B = S(b[0], b[1], b[2]);
  g.setTransform(1, 0, 0, 1, 0, 0); g.strokeStyle = 'rgb(190,190,190)'; g.lineWidth = lw(LW.hair); g.setLineDash([]);
  g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
}
