// 第 6 章 山与海：赛艇、皮划艇、帆船、冲浪、铁人三项、公路/场地/BMX/山地自行车、马术
(function () {
  const G = window.G, P = G.P, POSES = window.POSES, L = G.LEN, D2R = G.D2R;
  const R2D = 180 / Math.PI;
  const { lerp, clamp, E } = G;

  // ── 反向运动学：给世界坐标目标点，求四肢角度（逐帧解，角度跳变无所谓，渲染只用 sin/cos）──
  function ik(A, T, L1, L2, bend) {
    const dx = T[0] - A[0], dy = T[1] - A[1];
    let d = Math.hypot(dx, dy);
    d = clamp(d, Math.abs(L1 - L2) + 1e-4, L1 + L2 - 1e-4);
    const base = Math.atan2(dx, dy);
    const b = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const a1 = base + bend * b;
    const K = [A[0] + Math.sin(a1) * L1, A[1] + Math.cos(a1) * L1];
    return [a1 * R2D, Math.atan2(T[0] - K[0], T[1] - K[1]) * R2D];
  }
  // base: {x,y,rot,torso,head}；T: fR/fL 脚、hR/hL 手（世界坐标），kR/kL/eR/eL 弯向（+1 / -1）
  function solve(base, T) {
    const p = Object.assign({ x: 0, y: 0, rot: 0, torso: 0, head: 0 }, base);
    const hip = [p.x, p.y], tf = p.rot + p.torso, sl = L.torso - 0.025;
    const sho = [hip[0] + Math.sin(tf * D2R) * sl, hip[1] - Math.cos(tf * D2R) * sl];
    const leg = (t, k) => { const [a, b] = ik(hip, t, L.th, L.sh, k); return [a + p.rot, b + p.rot]; };
    const arm = (t, k) => { const [a, b] = ik(sho, t, L.ua, L.fa, k); return [a + tf, b + tf]; };
    if (T.fR) [p.lR1, p.lR2] = leg(T.fR, T.kR ?? 1);
    if (T.fL) [p.lL1, p.lL2] = leg(T.fL, T.kL ?? 1);
    if (T.hR) [p.aR1, p.aR2] = arm(T.hR, T.eR ?? -1);
    if (T.hL) [p.aL1, p.aL2] = arm(T.hL, T.eL ?? -1);
    return p;
  }
  // 局部（骑手坐标，未旋转，原点 = 髋）→ 世界
  const W = (p, loc) => { const v = G.rot2(loc, p.rot || 0); return [(p.x || 0) + v[0], (p.y || 0) + v[1]]; };
  const inFrame = (ctx, J, fn) => { ctx.save(); ctx.translate(J.hip[0], J.hip[1]); ctx.rotate((J.p.rot || 0) * D2R); fn(); ctx.restore(); };
  const fract = (x) => x - Math.floor(x);
  // 水：同色系更深一档 + 顶部一排青海波（官方核心图形里的鳞纹）
  const waterCol = (C) => G.mix(C.bg, '#000000', 0.16);
  function waterBand(ctx, y, u, C, per = 0.3, loop = 1, dir = 1) {
    const wc = waterCol(C), off = fract(u / loop) * per * dir;
    const cy = y + per * 0.5;
    ctx.fillStyle = wc; ctx.fillRect(-2.4, cy, 4.8, 1.4);
    for (let i = -10; i < 11; i++) {
      const x = i * per + off;
      G.disc(ctx, x, cy, per * 0.5, wc);
      ctx.strokeStyle = C.line; ctx.lineWidth = 0.01;
      for (const r of [0.36, 0.22]) { ctx.beginPath(); ctx.arc(x, cy, per * r, Math.PI, 0); ctx.stroke(); }
    }
  }
  const capsule = (ctx, a, b, w, col) => G.seg(ctx, a, b, w, col);

  // ── 自行车 ──
  // g：局部几何 { ra, fa, r, bb, sc, ht, hb, bar, crank, kind }
  function drawBike(ctx, g, u, C, spin, o = {}) {
    const lw = 0.024;
    const wheel = (c, disc) => {
      if (disc) { G.disc(ctx, c[0], c[1], g.r, C.far2); G.disc(ctx, c[0], c[1], g.r * 0.18, C.acc); }
      G.ring(ctx, c[0], c[1], g.r - lw * 0.5, g.knobby ? 0.04 : lw, C.fg);
      if (g.knobby) { ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(spin); for (let i = 0; i < 18; i++) { ctx.rotate(Math.PI * 2 / 18); ctx.fillStyle = C.fg; ctx.fillRect(-0.012, g.r - 0.005, 0.024, 0.022); } ctx.restore(); }
      if (!disc) {
        ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(spin);
        for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); G.seg(ctx, [-g.r * 0.9, 0], [g.r * 0.9, 0], 0.008, C.line); }
        ctx.restore(); G.disc(ctx, c[0], c[1], 0.018, C.fg);
      }
    };
    wheel(g.ra, g.discRear); wheel(g.fa, g.discFront);
    const fc = C.acc, fw = 0.026;
    capsule(ctx, g.bb, g.ra, fw * 0.8, fc); capsule(ctx, g.sc, g.ra, fw * 0.8, fc);
    capsule(ctx, g.bb, g.sc, fw, fc); capsule(ctx, g.sc, g.ht, fw, fc);
    capsule(ctx, g.bb, g.hb, fw * 1.15, fc); capsule(ctx, g.ht, g.hb, fw * 1.2, fc);
    if (g.susp) { G.seg(ctx, g.hb, g.fa, 0.03, fc); G.seg(ctx, g.hb, G.lerp(g.hb[0], g.fa[0], 0.5) === 0 ? g.fa : [lerp(g.hb[0], g.fa[0], 0.55), lerp(g.hb[1], g.fa[1], 0.55)], 0.05, fc); }
    else capsule(ctx, g.hb, g.fa, fw * 0.8, fc);
    // 座
    capsule(ctx, [g.sc[0] - 0.08, g.sc[1] - 0.02], [g.sc[0] + 0.05, g.sc[1] - 0.025], 0.03, C.fg);
    // 把
    capsule(ctx, g.ht, g.bar, 0.022, C.fg);
    if (g.drops) { ctx.strokeStyle = C.fg; ctx.lineWidth = 0.02; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(g.bar[0], g.bar[1]); ctx.arc(g.bar[0], g.bar[1] + 0.045, 0.045, -Math.PI / 2, Math.PI / 2); ctx.lineTo(g.bar[0] - 0.03, g.bar[1] + 0.09); ctx.stroke(); }
    if (g.aero) capsule(ctx, g.bar, [g.bar[0] + 0.12, g.bar[1] - 0.01], 0.018, C.fg);
    if (g.riser) capsule(ctx, [g.bar[0] - 0.02, g.bar[1] + 0.02], [g.bar[0] + 0.02, g.bar[1] - 0.04], 0.022, C.fg);
    // 牙盘 + 远侧曲柄
    G.ring(ctx, g.bb[0], g.bb[1], 0.05, 0.014, C.fg);
    const th = o.crank ?? u * Math.PI * 2;
    const pL = [g.bb[0] + Math.cos(th + Math.PI) * g.crank, g.bb[1] + Math.sin(th + Math.PI) * g.crank];
    G.seg(ctx, g.bb, pL, 0.018, C.far);
  }
  function drawNearCrank(ctx, g, u, C, o = {}) {
    const th = o.crank ?? u * Math.PI * 2;
    const pR = [g.bb[0] + Math.cos(th) * g.crank, g.bb[1] + Math.sin(th) * g.crank];
    G.seg(ctx, g.bb, pR, 0.02, C.fg);
    G.seg(ctx, [pR[0] - 0.025, pR[1]], [pR[0] + 0.025, pR[1]], 0.016, C.acc);
    G.disc(ctx, g.bb[0], g.bb[1], 0.016, C.acc);
  }
  const pedals = (g, th) => [
    [g.bb[0] + Math.cos(th) * g.crank, g.bb[1] + Math.sin(th) * g.crank],
    [g.bb[0] + Math.cos(th + Math.PI) * g.crank, g.bb[1] + Math.sin(th + Math.PI) * g.crank],
  ];
  // 骑车人：base 姿势 + 几何 + 曲柄角 → 姿势
  function rider(base, g, th, hands) {
    const [pR, pL] = pedals(g, th);
    const hb = hands || g.hand || g.bar;
    return solve(base, { fR: W(base, pR), fL: W(base, pL), hR: W(base, hb), hL: W(base, [hb[0] - 0.015, hb[1] + 0.005]), kR: 1, kL: 1, eR: -1, eL: -1 });
  }
  // 路面：虚线滚动（2 拍循环）
  function road(ctx, y, u, C, loop = 2, x0 = -1.4, x1 = 1.4) {
    P.ground(ctx, y, C, x0, x1);
    const per = 0.5, off = fract(u / loop) * per * 4;
    ctx.fillStyle = C.line;
    for (let x = x0 - per * 4; x < x1; x += per) { const xx = x - off + per * 4; if (xx > x0 && xx < x1) ctx.fillRect(xx, y + 0.05, per * 0.45, 0.012); }
  }

  const GROAD = { ra: [-0.22, 0.36], fa: [0.5, 0.36], r: 0.19, bb: [0.13, 0.34], sc: [-0.02, 0.07], ht: [0.4, 0.08], hb: [0.43, 0.17], bar: [0.47, 0.07], hand: [0.45, 0.14], crank: 0.08, drops: true };
  POSES.cyc_road = {
    fig: { s: 0.92, x: -0.12, y: -0.02 },
    iconU: 0.25,
    pose: (u) => rider({ torso: 70, head: -32, y: Math.sin(u * Math.PI * 2) * 0.004 }, GROAD, u * Math.PI * 2),
    back: (ctx, J, u, C) => {
      P.speed(ctx, -0.4, -0.05, 0.9, 6, C, 0.7);
      road(ctx, 0.55, u, C);
      inFrame(ctx, J, () => drawBike(ctx, GROAD, u, C, u * 5));
    },
    front: (ctx, J, u, C) => inFrame(ctx, J, () => drawNearCrank(ctx, GROAD, u, C)),
  };

  const GTRACK = { ra: [-0.22, 0.36], fa: [0.5, 0.36], r: 0.19, bb: [0.13, 0.34], sc: [-0.02, 0.07], ht: [0.41, 0.1], hb: [0.44, 0.17], bar: [0.44, 0.06], hand: [0.56, 0.03], crank: 0.08, aero: true, discRear: true };
  POSES.cyc_track = {
    fig: { s: 0.92, x: -0.12, y: -0.02 },
    iconU: 0.25,
    pose: (u) => rider({ torso: 78, head: -40 }, GTRACK, u * Math.PI * 2 * 1.25),
    back: (ctx, J, u, C) => {
      // 赛道倾斜的色带（场地赛车道的蓝线红线）
      ctx.save();
      ctx.beginPath(); ctx.rect(-1.6, -1, 3.2, 1.55); ctx.clip();
      const off = fract(u / 2) * 0.6;
      for (let i = -6; i < 8; i++) {
        const x = i * 0.3 - off * 2;
        ctx.fillStyle = G.rgba(i % 2 ? C.fg : C.acc, i % 2 ? 0.1 : 0.16);
        ctx.beginPath(); ctx.moveTo(x, 0.55); ctx.lineTo(x + 0.08, 0.55); ctx.lineTo(x + 0.58, -1); ctx.lineTo(x + 0.5, -1); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = C.fg; ctx.fillRect(-1.6, 0.55, 3.2, 0.018);
      ctx.fillStyle = C.acc; ctx.fillRect(-1.6, 0.6, 3.2, 0.03);
      P.speed(ctx, -0.35, -0.08, 1.1, 7, C, 0.9);
      inFrame(ctx, J, () => drawBike(ctx, GTRACK, u, C, u * 6.25, { crank: u * Math.PI * 2 * 1.25 }));
    },
    front: (ctx, J, u, C) => inFrame(ctx, J, () => drawNearCrank(ctx, GTRACK, u, C, { crank: u * Math.PI * 2 * 1.25 })),
  };

  // BMX：土坡飞跃（2 拍：0 起跳，~0.8 最高点，1.6 落地）
  const GBMX = { ra: [-0.2, 0.38], fa: [0.3, 0.38], r: 0.14, bb: [0.06, 0.37], sc: [-0.08, 0.2], ht: [0.26, 0.14], hb: [0.27, 0.22], bar: [0.3, 0.02], hand: [0.3, 0.03], crank: 0.075, riser: true };
  function bmxState(u) {
    u = ((u % 2) + 2) % 2;
    if (u < 1.6) {
      const t = u / 1.6;
      return { y: -0.4 * Math.sin(Math.PI * t), rot: lerp(-24, 20, E.io(t)), tuck: Math.sin(Math.PI * t) };
    }
    const t = (u - 1.6) / 0.4;
    return { y: 0.03 * Math.sin(Math.PI * t), rot: lerp(20, -24, E.io(t)), tuck: 0 };
  }
  POSES.cyc_bmx = {
    fig: { s: 0.95, x: 0, y: 0.02 },
    iconU: 0.75,
    pose: (u) => {
      const s = bmxState(u);
      const hipLoc = [0, -0.02 + s.tuck * 0.08];
      const base = { x: 0, y: s.y, rot: s.rot, torso: 30 + s.tuck * 12, head: -10 };
      // 起跳后收腿：脚仍踩踏板，髋往下压（屈膝）
      const p = rider(base, GBMX, 0.15, null);
      return p;
    },
    back: (ctx, J, u, C) => {
      // 土坡：以 0.8 拍时正好在车下
      const ph = ((u % 2) + 2) % 2;
      const cx = (0.8 - ph) * 1.1;
      ctx.fillStyle = C.far2;
      for (const ox of [cx - 2.2, cx, cx + 2.2]) {
        ctx.beginPath(); ctx.moveTo(ox - 0.75, 0.52); ctx.quadraticCurveTo(ox - 0.35, 0.18, ox, 0.2); ctx.quadraticCurveTo(ox + 0.35, 0.18, ox + 0.75, 0.52); ctx.fill();
      }
      P.ground(ctx, 0.52, C, -1.6, 1.6);
      const s = bmxState(u);
      if (s.tuck > 0.2) P.speed(ctx, -0.3, 0.05, 0.6, 4, C, s.tuck);
      inFrame(ctx, J, () => drawBike(ctx, GBMX, u, C, u * 7, { crank: 0.15 }));
    },
    front: (ctx, J, u, C) => inFrame(ctx, J, () => drawNearCrank(ctx, GBMX, u, C, { crank: 0.15 })),
  };

  // 山地：下坡，车身前倾，每拍压过一块石头
  const GMTB = { ra: [-0.3, 0.38], fa: [0.5, 0.38], r: 0.21, bb: [0.1, 0.36], sc: [-0.1, 0.12], ht: [0.36, 0.1], hb: [0.39, 0.19], bar: [0.38, 0.0], hand: [0.37, 0.01], crank: 0.08, knobby: true, susp: true, riser: true };
  POSES.cyc_mtb = {
    fig: { s: 0.9, x: -0.05, y: -0.04 },
    iconU: 0.1,
    pose: (u) => {
      const f = fract(u);
      const bump = Math.exp(-f * 6) * Math.sin(f * 18) * 0.035;
      return rider({ rot: 17 + bump * 40, y: -bump, torso: 34, head: -28 }, GMTB, 0);
    },
    back: (ctx, J, u, C) => {
      inFrame(ctx, J, () => {
        // 坡面（跟车身同角度），石头每拍经过前轮
        ctx.fillStyle = C.far2;
        ctx.beginPath(); ctx.moveTo(-2, 0.59); ctx.lineTo(2, 0.59); ctx.lineTo(2, 1.4); ctx.lineTo(-2, 1.4); ctx.fill();
        const off = fract(u) * 0.8;
        for (let i = -3; i < 4; i++) {
          const x = 0.5 + i * 0.8 - off;
          G.disc(ctx, x, 0.6, 0.05 + ((i + 5) % 3) * 0.018, C.acc);
        }
        drawBike(ctx, GMTB, u, C, u * 5, { crank: 0 });
      });
      P.speed(ctx, -0.45, -0.25, 0.7, 5, C, 0.6);
    },
    front: (ctx, J, u, C) => inFrame(ctx, J, () => drawNearCrank(ctx, GMTB, u, C, { crank: 0 })),
  };

  // ── 赛艇：每拍一次入水（catch 落在整拍）──
  const OAR_PIVOT = [0.17, 0.03];
  function rowState(u) {
    const f = fract(u);
    // s：0 = 入水（catch），1 = 出水（finish）
    const s = f < 0.42 ? E.o2(f / 0.42) : 1 - E.io((f - 0.42) / 0.58);
    const legs = clamp(s / 0.6), body = clamp((s - 0.25) / 0.5), arms = clamp((s - 0.55) / 0.45);
    const hipX = lerp(0.03, -0.13, E.io(legs));
    const torso = lerp(26, -24, E.io(body));
    const tf = torso * D2R, sl = L.torso - 0.025;
    const sho = [hipX + Math.sin(tf) * sl, -Math.cos(tf) * sl];
    const recov = f >= 0.42;
    const hand = [lerp(sho[0] + 0.29, sho[0] + 0.1, E.io(arms)), lerp(sho[1] + 0.07, sho[1] + 0.15, E.io(arms)) + (recov ? 0.035 : 0)];
    return { s, hipX, torso, hand, recov, f };
  }
  POSES.rowing = {
    fig: { s: 0.82, x: -0.05, y: -0.02 },
    iconU: 0.0,
    pose: (u) => {
      const r = rowState(u);
      return solve({ x: r.hipX, y: 0, torso: r.torso, head: -r.torso * 0.5 }, { fR: [0.36, 0.08], fL: [0.35, 0.085], hR: r.hand, hL: [r.hand[0] - 0.01, r.hand[1] + 0.005], kR: 1, kL: 1 });
    },
    back: (ctx, J, u, C) => {
      // 水 + 青海波（向右流：船往左走）
      waterBand(ctx, 0.17, u, C, 0.3, 1);
      // 远侧桨
      const r = rowState(u);
      const hand = J.aL[2];
      const d = [OAR_PIVOT[0] - hand[0], OAR_PIVOT[1] - hand[1]], n = Math.hypot(d[0], d[1]);
      const bl = [OAR_PIVOT[0] + d[0] / n * 0.5, OAR_PIVOT[1] + d[1] / n * 0.5 - 0.02];
      G.seg(ctx, hand, bl, 0.016, C.far);
      // 艇身
      ctx.fillStyle = C.acc;
      ctx.beginPath(); ctx.moveTo(-1.1, 0.075); ctx.quadraticCurveTo(0, 0.28, 1.1, 0.075); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.fg; ctx.fillRect(-1.05, 0.07, 2.1, 0.014);
      // 滑座轨道 + 脚蹬板
      ctx.fillStyle = C.fg; ctx.fillRect(-0.2, 0.06, 0.34, 0.02);
      G.seg(ctx, [0.38, 0.12], [0.41, -0.0], 0.02, C.fg);
      // 座
      G.seg(ctx, [J.hip[0] - 0.07, 0.05], [J.hip[0] + 0.06, 0.05], 0.03, C.fg);
      // 桨架
      G.seg(ctx, [0.02, 0.09], OAR_PIVOT, 0.014, C.fg);
      P.speed(ctx, 0.9, -0.1, 0.5, 3, C, 0.0);
    },
    front: (ctx, J, u, C) => {
      const r = rowState(u);
      const hand = J.aR[2];
      const d = [OAR_PIVOT[0] - hand[0], OAR_PIVOT[1] - hand[1]], n = Math.hypot(d[0], d[1]);
      const bl = [OAR_PIVOT[0] + d[0] / n * 0.55, OAR_PIVOT[1] + d[1] / n * 0.55];
      G.seg(ctx, hand, bl, 0.02, C.fg);
      // 桨叶
      ctx.save(); ctx.translate(bl[0], bl[1]); ctx.rotate(Math.atan2(d[1], d[0]));
      ctx.fillStyle = C.fg; ctx.beginPath(); ctx.ellipse(0.02, 0, 0.09, r.recov ? 0.018 : 0.045, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // 入水溅起：整拍时
      const f = r.f;
      if (f < 0.3) {
        const k = f / 0.3;
        ctx.save(); ctx.globalAlpha = 1 - k;
        for (let i = 0; i < 5; i++) { const a = (-0.9 + i * 0.45); G.disc(ctx, bl[0] + Math.sin(a) * 0.12 * (0.4 + k), 0.24 - Math.cos(a) * 0.1 * (0.3 + k) - k * 0.05, 0.018 * (1 - k * 0.5), C.fg); }
        ctx.restore();
      }
    },
  };

  // ── 皮划艇：双叶桨，每拍一侧入水 ──
  function paddle(u) {
    const beat = Math.floor(u), f = u - beat, side = beat % 2; // 0 = 近侧入水，1 = 远侧
    const catchB = [0.56, 0.15], exitB = [0.1, 0.14];
    const catchD = [-0.5, -0.87], exitD = [-0.16, -0.99];
    let B, D;
    if (f < 0.5) { const t = E.o2(f / 0.5); B = [lerp(catchB[0], exitB[0], t), lerp(catchB[1], exitB[1], t)]; D = [lerp(catchD[0], exitD[0], t), lerp(catchD[1], exitD[1], t)]; }
    else {
      // 回桨：桨杆转半圈，另一端来到前面
      const t = E.io((f - 0.5) / 0.5);
      const a0 = Math.atan2(exitD[1], exitD[0]), a1 = Math.atan2(-catchD[1], -catchD[0]);
      let da = a1 - a0; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      const M0 = [exitB[0] + exitD[0] * 0.425, exitB[1] + exitD[1] * 0.425];
      const M1 = [catchB[0] + catchD[0] * 0.425, catchB[1] + catchD[1] * 0.425];
      const M = [lerp(M0[0], M1[0], t), lerp(M0[1], M1[1], t) - Math.sin(Math.PI * t) * 0.08];
      const a = a0 + da * t; const dd = [Math.cos(a), Math.sin(a)];
      B = [M[0] - dd[0] * 0.425, M[1] - dd[1] * 0.425]; D = dd;
    }
    const n = Math.hypot(D[0], D[1]); D = [D[0] / n, D[1] / n];
    const e1 = B, e2 = [B[0] + D[0] * 0.85, B[1] + D[1] * 0.85];
    // side 1 时两端对调（同一支桨转了半圈）
    return side === 0 ? { a: e1, b: e2, dip: f < 0.5 ? 'a' : null } : { a: e2, b: e1, dip: f < 0.5 ? 'b' : null };
  }
  POSES.canoe = {
    fig: { s: 0.9, x: -0.05, y: 0.02 },
    iconU: 0.1,
    pose: (u) => {
      const pd = paddle(u);
      const at = (k) => [lerp(pd.a[0], pd.b[0], k), lerp(pd.a[1], pd.b[1], k)];
      const f = fract(u);
      const torso = 8 + (f < 0.5 ? lerp(20, -6, E.o2(f / 0.5)) : lerp(-6, 20, E.io((f - 0.5) / 0.5)));
      return solve({ torso, head: -torso * 0.4 }, { fR: [0.44, 0.04], fL: [0.43, 0.045], kR: -1, kL: -1, hR: at(0.36), hL: at(0.64), eR: -1, eL: -1 });
    },
    back: (ctx, J, u, C) => {
      // 激流回旋门：条纹杆从右往左经过
      const gx = 1.3 - fract(u / 4) * 2.8;
      G.seg(ctx, [gx - 0.8, -0.9], [gx + 0.8, -0.9], 0.008, C.line);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? C.fg : C.acc; ctx.fillRect(gx - 0.012, -0.9 + i * 0.13, 0.024, 0.13); }
      const pd = paddle(u);
      G.seg(ctx, pd.a, pd.b, 0.022, C.far);
      // 远端桨叶（本拍如果是远侧入水，画暗）
      const blade = (p, q, col) => { ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(Math.atan2(p[1] - q[1], p[0] - q[0])); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, 0.085, 0.04, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
      blade(pd.b, pd.a, C.far);
    },
    front: (ctx, J, u, C) => {
      const pd = paddle(u);
      G.seg(ctx, pd.a, pd.b, 0.022, C.fg);
      const blade = (p, q, col) => { ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(Math.atan2(p[1] - q[1], p[0] - q[0])); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, 0.085, 0.04, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
      blade(pd.a, pd.b, C.fg);
      // 艇身盖住腿
      ctx.fillStyle = C.acc;
      ctx.beginPath(); ctx.moveTo(-0.9, 0.06); ctx.quadraticCurveTo(0.0, -0.06, 0.98, 0.08); ctx.quadraticCurveTo(0.0, 0.24, -0.9, 0.06); ctx.fill();
      G.seg(ctx, [-0.13, 0.0], [0.15, 0.0], 0.032, C.fg); // 舱口
      // 水面
      waterBand(ctx, 0.1, u, C, 0.24, 1);
      // 入水水花
      const f = fract(u);
      if (f < 0.35 && pd.dip) {
        const p = pd.dip === 'a' ? pd.a : pd.b, k = f / 0.35;
        ctx.save(); ctx.globalAlpha = 1 - k;
        for (let i = 0; i < 5; i++) G.disc(ctx, p[0] + (i - 2) * 0.05 * (1 + k), 0.12 - Math.sin((i / 4) * Math.PI) * 0.12 * (0.4 + k), 0.017, C.fg);
        ctx.restore();
      }
    },
  };

  // ── 帆船：压舷，随浪起伏；每拍一阵风让人往外压 ──
  function sailState(u) {
    const heel = Math.sin(u * Math.PI / 2) * 5, pitch = Math.sin(u * Math.PI / 2 + 1) * 0.03;
    const f = fract(u), gust = Math.exp(-f * 4) * (1 - Math.exp(-f * 30));
    return { heel, pitch, gust };
  }
  POSES.sailing = {
    fig: { s: 0.72, x: 0.05, y: 0.12 },
    iconU: 0.3,
    pose: (u) => {
      const s = sailState(u);
      const base = { x: -0.12, y: 0.0 + s.pitch, rot: s.heel, torso: -52 - s.gust * 14, head: 30 };
      return solve(base, { fR: W(base, [0.36, 0.07]), fL: W(base, [0.35, 0.075]), hR: W(base, [0.02, 0.0]), hL: W(base, [-0.1, -0.28 + s.gust * 0.03]), kR: 1, kL: 1, eR: -1, eL: 1 });
    },
    back: (ctx, J, u, C) => {
      const s = sailState(u);
      // 浪
      const off = fract(u / 4) * 0.5;
      ctx.fillStyle = waterCol(C);
      for (let i = -9; i < 10; i++) { const x = i * 0.5 + off; ctx.beginPath(); ctx.arc(x, 0.3, 0.25, Math.PI, 0); ctx.fill(); ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(x, 0.3, 0.15, Math.PI, 0); ctx.fill(); ctx.fillStyle = waterCol(C); }
      ctx.fillRect(-4, 0.3, 8, 0.7);
      ctx.save(); ctx.translate(0, s.pitch); ctx.rotate(s.heel * D2R);
      // 帆（三角 + 帆骨）、桅杆、横杆
      const mast = [0.3, 0.06], top = [0.3, -1.15], boom = [-0.55, -0.34];
      ctx.fillStyle = C.acc;
      ctx.beginPath(); ctx.moveTo(top[0] - 0.02, top[1] + 0.02); ctx.quadraticCurveTo(-0.3 - s.gust * 0.05, -0.75, boom[0], boom[1]); ctx.lineTo(0.3, -0.34); ctx.fill();
      for (let i = 1; i < 4; i++) { const y = -0.34 - i * 0.2; G.seg(ctx, [0.28, y], [lerp(boom[0], 0.3, i * 0.24) + 0.02, y + 0.02], 0.008, C.bg); }
      G.seg(ctx, mast, top, 0.022, C.fg);
      G.seg(ctx, [0.3, -0.34], boom, 0.02, C.fg);
      // 主帆索
      G.seg(ctx, [-0.35, -0.34], [-0.2, 0.04], 0.006, C.line);
      // 船身
      ctx.fillStyle = C.fg;
      ctx.beginPath(); ctx.moveTo(-0.62, 0.06); ctx.lineTo(0.95, 0.06); ctx.quadraticCurveTo(0.7, 0.26, 0.3, 0.26); ctx.lineTo(-0.58, 0.24); ctx.closePath(); ctx.fill();
      // 舵柄延长杆
      G.seg(ctx, [-0.6, 0.04], [-0.3, 0.0], 0.014, C.fg);
      ctx.restore();
    },
    front: (ctx, J, u, C) => {
      // 前景一排浪头
      const off = fract(u / 4) * 0.5;
      ctx.fillStyle = C.bg;
      for (let i = -6; i < 7; i++) { const x = i * 0.5 - off * 0.6; ctx.beginPath(); ctx.arc(x + 0.25, 0.42, 0.12, Math.PI, 0); ctx.fill(); }
    },
  };

  // ── 冲浪：卷浪 = 偏心同心圆（管浪）+ 一条二次曲线浪面；0 拍底部转向，2 拍顶部甩浪 ──
  const SQ = [[-0.45, -0.52], [0.12, -0.2], [1.3, 0.42]];
  const qpt = (t) => [0, 1].map((i) => (1 - t) * (1 - t) * SQ[0][i] + 2 * t * (1 - t) * SQ[1][i] + t * t * SQ[2][i]);
  const qtan = (t) => [0, 1].map((i) => 2 * (1 - t) * (SQ[1][i] - SQ[0][i]) + 2 * t * (SQ[2][i] - SQ[1][i]));
  function surfState(u) {
    const up = u < 2 ? E.io(u / 2) : 1 - E.io((u - 2) / 2); // 0 底部 → 1 顶部
    const t = lerp(0.5, 0.28, up);
    const p = qpt(t), tg = qtan(t);
    const a = Math.atan2(tg[1], tg[0]) * R2D;
    const board = a - up * 22; // 顶部转向时板头抬起
    const n = G.rot2([0, -1], board);
    return { up, board, bp: p, hip: [p[0] + n[0] * 0.35, p[1] + n[1] * 0.35] };
  }
  POSES.surfing = {
    fig: { s: 0.74, x: 0.16, y: 0.3 },
    iconU: 2,
    pose: (u) => {
      const s = surfState(u);
      const base = { x: s.hip[0], y: s.hip[1], rot: s.board, torso: 40 - s.board * 0.5, head: -18 + s.board * 0.3 };
      return solve(base, { fR: W(base, [0.22, 0.32]), fL: W(base, [-0.2, 0.33]), kR: 1, kL: 1, hR: W(base, [0.5, 0.02 + s.up * 0.06]), hL: W(base, [-0.42, -0.22 - s.up * 0.12]), eR: -1, eL: 1 });
    },
    back: (ctx, J, u, C) => {
      const wc = waterCol(C), lite = G.mix(C.bg, C.fg, 0.12);
      // 远处海面
      ctx.fillStyle = wc; ctx.fillRect(-2.4, SQ[2][1], 4.8, 1.2);
      // 浪面（曲线以下）
      ctx.fillStyle = wc;
      ctx.beginPath(); ctx.moveTo(SQ[0][0], SQ[0][1]); ctx.quadraticCurveTo(SQ[1][0], SQ[1][1], SQ[2][0], SQ[2][1]);
      ctx.lineTo(SQ[2][0], 1.4); ctx.lineTo(-2.4, 1.4); ctx.lineTo(-2.4, SQ[0][1]); ctx.fill();
      // 管浪：偏心同心圆，越往里越往左下偏，像卷进去
      const spin = u * 0.12;
      const rings = 7;
      for (let i = 0; i < rings; i++) {
        const k = i / (rings - 1);
        const r = lerp(0.62, 0.1, k);
        const cx = lerp(-0.92, -1.08 + Math.sin(spin + k) * 0.02, k), cy = lerp(-0.04, 0.16, k);
        G.disc(ctx, cx, cy, r, i % 2 ? wc : (i % 4 === 0 ? C.acc : lite));
      }
      // 浪唇：一道粗弧从浪面顶端卷过管浪
      ctx.strokeStyle = wc; ctx.lineWidth = 0.16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-0.92, -0.04, 0.6, Math.PI * 1.25, Math.PI * 1.92); ctx.stroke();
      G.disc(ctx, -1.3, -0.4, 0.09, wc);
      for (let i = 0; i < 9; i++) {
        const t = i / 8, a = Math.PI * (1.05 + t * 0.9);
        G.disc(ctx, -0.92 + Math.cos(a) * 0.66, -0.04 + Math.sin(a) * 0.66, 0.035 - t * 0.012 + Math.sin(u * 3 + i) * 0.004, C.fg);
      }
      // 浪面的条纹（速度感）
      ctx.save();
      ctx.beginPath(); ctx.moveTo(SQ[0][0], SQ[0][1]); ctx.quadraticCurveTo(SQ[1][0], SQ[1][1], SQ[2][0], SQ[2][1]); ctx.lineTo(SQ[2][0], 1.4); ctx.lineTo(-0.3, 1.4); ctx.closePath(); ctx.clip();
      ctx.strokeStyle = C.line; ctx.lineWidth = 0.01;
      for (let i = 1; i < 5; i++) {
        const o = i * 0.11 + fract(u / 4) * 0.11;
        ctx.beginPath(); ctx.moveTo(SQ[0][0] + 0.2, SQ[0][1] + o); ctx.quadraticCurveTo(SQ[1][0], SQ[1][1] + o, SQ[2][0], SQ[2][1] + o); ctx.stroke();
      }
      ctx.restore();
      // 板
      const s = surfState(u);
      inFrame(ctx, J, () => {
        ctx.fillStyle = C.acc;
        ctx.beginPath(); ctx.ellipse(0.0, 0.365, 0.5, 0.038, 0, 0, Math.PI * 2); ctx.fill();
        G.seg(ctx, [-0.42, 0.365], [0.42, 0.365], 0.008, C.fg);
        // 板尾的尾流
        ctx.fillStyle = G.rgba(C.fg, 0.5); ctx.fillRect(-1.0, 0.39, 0.48, 0.012); ctx.fillRect(-0.85, 0.415, 0.32, 0.01);
      });
      // 甩浪水花：2 拍
      const d = u - 1.85;
      if (d > 0 && d < 1.3) {
        const k = d / 1.3;
        ctx.save(); ctx.globalAlpha = 1 - k * k;
        const tail = G.rot2([-0.45, 0.36], s.board);
        const b0 = [J.hip[0] + tail[0], J.hip[1] + tail[1]];
        for (let i = 0; i < 14; i++) {
          const a = (-150 + i * 9) * D2R, sp = 0.5 + (i % 4) * 0.18;
          G.disc(ctx, b0[0] + Math.cos(a) * sp * k, b0[1] + Math.sin(a) * sp * k + k * k * 0.35, 0.03 * (1 - k * 0.5) * (0.7 + (i % 3) * 0.3), C.fg);
        }
        ctx.restore();
      }
    },
  };

  // ── 铁人三项：游 → 骑 → 跑，三个小人依次在拍点上出现，一条赛道线串起来 ──
  const GTRI = { ra: [-0.22, 0.36], fa: [0.48, 0.36], r: 0.19, bb: [0.13, 0.34], sc: [-0.02, 0.07], ht: [0.4, 0.09], hb: [0.43, 0.17], bar: [0.44, 0.07], hand: [0.55, 0.04], crank: 0.08, aero: true };
  const TRI_S = 0.4, TRI_DX = 0.6 / 0.4;
  const pop = (u, t0) => E.oBack(clamp((u - t0) / 0.35), 2.2);
  function swimPose(u) {
    const a = u * 360;
    return { rot: 90, torso: 0, head: -70, aR1: 180 - a, aR2: 180 - a + 20, aL1: -a, aL2: -a + 20, lR1: Math.sin(u * 12) * 12, lR2: Math.sin(u * 12 - 1) * 16, lL1: -Math.sin(u * 12) * 12, lL2: -Math.sin(u * 12 - 1) * 16 };
  }
  POSES.triathlon = {
    fig: { s: TRI_S, x: -0.6, y: 0.02 },
    iconU: 2.5,
    pose: (u) => swimPose(u * 0.75),
    back: (ctx, J, u, C) => {
      // 赛道线（三段颜色不同，逐段生长）
      const y = 0.55;
      const segs = [[-0.6, TRI_DX * 0.5], [TRI_DX * 0.5, TRI_DX * 1.5], [TRI_DX * 1.5, TRI_DX * 2 + 0.6]];
      segs.forEach((s, i) => {
        const p = clamp((u - i * 0.9) / 0.6);
        if (p <= 0) return;
        ctx.fillStyle = i === 1 ? C.acc : C.line;
        ctx.fillRect(s[0], y + 0.12, (s[1] - s[0]) * E.o3(p), 0.035);
        G.disc(ctx, i * TRI_DX, y + 0.1375, 0.055 * E.oBack(p), C.fg);
      });
      // 标签
      ctx.save(); ctx.fillStyle = C.fg; ctx.font = '500 0.15px "DM Mono"'; ctx.textAlign = 'center'; ctx.letterSpacing = '0.02px';
      ['SWIM', 'BIKE', 'RUN'].forEach((t, i) => { const p = clamp((u - i * 0.9) / 0.4); if (p > 0) { ctx.globalAlpha = p; ctx.fillText(t, i * TRI_DX, 1.0); } });
      ctx.restore();
    },
    front: (ctx, J, u, C) => {
      // 水面：几道波纹盖住泳者下半身
      ctx.strokeStyle = C.fg; ctx.lineWidth = 0.022; ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) { const x = -0.64 + i * 0.26 + fract(u) * 0.26 * -1 + 0.26; ctx.beginPath(); ctx.arc(x, 0.2, 0.13, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      ctx.fillStyle = C.bg; ctx.fillRect(-0.9, 0.2, 1.7, 0.2);
      // 骑
      const pb = pop(u, 0.9);
      if (pb > 0) {
        ctx.save(); ctx.translate(TRI_DX, -0.08); ctx.scale(pb, pb);
        const th = u * Math.PI * 2;
        const p = rider({ torso: 74, head: -36 }, GTRI, th);
        const Jb = G.joints(p);
        drawBike(ctx, GTRI, u, C, u * 5, { crank: th });
        G.drawFigure(ctx, Jb, C.fg, C.far);
        drawNearCrank(ctx, GTRI, u, C, { crank: th });
        ctx.restore();
      }
      // 跑
      const pr = pop(u, 1.8);
      if (pr > 0) {
        ctx.save(); ctx.translate(TRI_DX * 2, 0); ctx.scale(pr, pr);
        const Jr = G.joints({ ...G.runCycle(u / 1.2, 0.9, { lean: 12 }), head: -6 });
        G.drawFigure(ctx, Jr, C.fg, C.far);
        ctx.restore();
      }
    },
  };

  // ── 马术：障碍跳跃，第 2 拍在栏上方 ──
  function horseState(u) {
    // 0–1.2 慢跑接近，1.2 起跳，2 最高点，2.8 落地，之后慢跑
    const jt = clamp((u - 1.2) / 1.6);
    const air = u > 1.2 && u < 2.8;
    const y = air ? -0.45 * Math.sin(Math.PI * jt) : 0;
    const pitch = air ? lerp(-20, 20, E.io(jt)) : 0;
    const canter = Math.sin(u * Math.PI * 2) * (air ? 0 : 1);
    return { jt, air, y: y + canter * 0.02, pitch: pitch + canter * 2.5, ph: u };
  }
  function drawHorse(ctx, s, C) {
    const col = C.acc, far = G.mix(C.acc, C.bg, 0.35);
    const leg = (hip, a1, a2, len, c, w) => { const k = [hip[0] + Math.sin(a1 * D2R) * len, hip[1] + Math.cos(a1 * D2R) * len]; const f = [k[0] + Math.sin(a2 * D2R) * len, k[1] + Math.cos(a2 * D2R) * len]; G.seg(ctx, hip, k, w, c); G.seg(ctx, k, f, w * 0.8, c); G.disc(ctx, f[0], f[1], w * 0.55, c); };
    const fr = [0.34, 0.26], hd = [-0.42, 0.24];
    let fA, fB, hA, hB;
    if (s.air) {
      // 前腿收起，后腿后蹬
      const t = s.jt;
      fA = [lerp(40, 70, t), lerp(-60, -30, t)]; fB = [lerp(30, 60, t), lerp(-70, -40, t)];
      hA = [lerp(-50, 10, t), lerp(-40, 30, t)]; hB = [lerp(-40, 20, t), lerp(-30, 40, t)];
    } else {
      const p = s.ph * Math.PI * 2;
      fA = [Math.sin(p) * 30, Math.sin(p) * 30 - Math.max(0, Math.cos(p)) * 60]; fB = [Math.sin(p - 0.8) * 30, Math.sin(p - 0.8) * 30 - Math.max(0, Math.cos(p - 0.8)) * 60];
      hA = [Math.sin(p + 2.4) * 28, Math.sin(p + 2.4) * 28 + Math.max(0, -Math.cos(p + 2.4)) * 35]; hB = [Math.sin(p + 1.6) * 28, Math.sin(p + 1.6) * 28 + Math.max(0, -Math.cos(p + 1.6)) * 35];
    }
    const LL = 0.27;
    leg(fr, fB[0], fB[1], LL, far, 0.07); leg(hd, hB[0], hB[1], LL, far, 0.08);
    // 尾
    ctx.strokeStyle = far; ctx.lineWidth = 0.06; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-0.58, 0.12); ctx.quadraticCurveTo(-0.78, 0.15 + (s.air ? -0.1 : 0), -0.74, 0.42); ctx.stroke();
    // 身体
    G.seg(ctx, [-0.44, 0.19], [0.36, 0.19], 0.3, col);
    // 颈 + 头
    G.seg(ctx, [0.32, 0.14], [0.56, -0.2], 0.17, col);
    G.seg(ctx, [0.56, -0.22], [0.76, -0.06], 0.11, col);
    G.poly(ctx, [[0.52, -0.3], [0.55, -0.4], [0.59, -0.29]], col); // 耳
    // 鬃
    ctx.strokeStyle = far; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(0.34, 0.04); ctx.lineTo(0.52, -0.26); ctx.stroke();
    leg(fr, fA[0], fA[1], LL, col, 0.075); leg(hd, hA[0], hA[1], LL, col, 0.085);
    // 马鞍
    G.seg(ctx, [-0.12, 0.05], [0.12, 0.05], 0.04, C.fg);
  }
  POSES.equestrian = {
    fig: { s: 0.62, x: 0.0, y: -0.12 },
    iconU: 2,
    pose: (u) => {
      const s = horseState(u);
      const jump = s.air ? Math.sin(Math.PI * s.jt) : 0;
      const base = { x: 0, y: s.y - 0.02 - jump * 0.05, rot: s.pitch, torso: 22 + jump * 26, head: -18 - jump * 10 };
      return solve(base, { fR: W(base, [0.08 + jump * 0.04, 0.36]), fL: W(base, [0.07 + jump * 0.04, 0.365]), kR: 1, kL: 1, hR: W(base, [0.4 + jump * 0.08, 0.0 - jump * 0.04]), hL: W(base, [0.39 + jump * 0.08, 0.01 - jump * 0.04]) });
    },
    back: (ctx, J, u, C) => {
      // 障碍：u = 2 时在马身下
      const x = (2 - u) * 0.9;
      const gy = 0.83;
      ctx.fillStyle = C.line; ctx.fillRect(-2.2, gy, 4.4, 0.016);
      for (const ox of [x, x + 3.6, x - 3.6]) {
        G.seg(ctx, [ox - 0.26, gy], [ox - 0.26, gy - 0.62], 0.035, C.fg);
        G.seg(ctx, [ox + 0.26, gy], [ox + 0.26, gy - 0.62], 0.035, C.fg);
        for (let i = 0; i < 3; i++) {
          const yy = gy - 0.2 - i * 0.17;
          for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? C.fg : C.far2; ctx.fillRect(ox - 0.26 + k * 0.13, yy, 0.13, 0.045); }
        }
      }
      const s = horseState(u);
      ctx.save(); ctx.translate(J.hip[0], J.hip[1] + 0.02); ctx.rotate(s.pitch * D2R);
      drawHorse(ctx, s, C);
      ctx.restore();
    },
  };
})();
