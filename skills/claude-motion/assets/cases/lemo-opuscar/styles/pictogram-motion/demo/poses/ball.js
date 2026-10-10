// 球类 16 项（足篮排手曲橄棒板高 + 持拍 6 项 + 泰克球）
(function () {
  const G = window.G, P = G.P, POSES = window.POSES, D2R = G.D2R;

  // ── 小工具 ──
  const ang = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]) / D2R; // 世界角：0 下，90 前
  const along = (p, deg, d) => [p[0] + Math.sin(deg * D2R) * d, p[1] + Math.cos(deg * D2R) * d];
  const off = (p, dx, dy) => [p[0] + dx, p[1] + dy];
  const poseAt = (def, u) => (def.pose ? def.pose(u) : G.keyPose(def.keys, u, def.loop));
  const jAt = (def, u) => G.joints(poseAt(def, u));
  const memo = (f) => { let v; return () => (v === undefined ? (v = f()) : v); };
  const ph = (u, L) => ((u % L) + L) % L;
  // 分段飞行：segs = [[u0, u1, from, to, 弧高, 缓动?]]，返回位置或 null
  const fly = (u, segs) => {
    for (const s of segs) {
      if (u >= s[0] && u < s[1]) {
        const a = typeof s[2] === 'function' ? s[2]() : s[2], b = typeof s[3] === 'function' ? s[3]() : s[3];
        const t = (s[5] || G.E.lin)((u - s[0]) / (s[1] - s[0]));
        return P.arc(a, b, s[4] || 0, t);
      }
    }
    return null;
  };
  // 拖尾：沿飞行方向画几条渐隐短线
  const trail = (ctx, u, segs, C, n = 5, du = 0.035, r = 0.03) => {
    for (let i = n; i >= 1; i--) {
      const p = fly(u - i * du, segs);
      if (!p) continue;
      ctx.save(); ctx.globalAlpha *= 0.28 * (1 - i / (n + 1));
      G.disc(ctx, p[0], p[1], r * (1 - i / (n + 2) * 0.5), C.acc);
      ctx.restore();
    }
  };
  const hand = (J) => J.aR[2];
  const farHand = (J) => J.aL[2];
  const foreAng = (J) => ang(J.aR[1], J.aR[2]);

  // 羽毛球：球托 + 锥形羽毛，dir = 飞行方向（世界角）
  const shuttle = (ctx, p, dir, C) => {
    const d = [Math.sin(dir * D2R), Math.cos(dir * D2R)], n = [-d[1], d[0]];
    const b0 = [p[0] - d[0] * 0.012, p[1] - d[1] * 0.012];
    const b1 = [p[0] - d[0] * 0.085, p[1] - d[1] * 0.085];
    G.poly(ctx, [[b0[0] + n[0] * 0.012, b0[1] + n[1] * 0.012], [b1[0] + n[0] * 0.04, b1[1] + n[1] * 0.04], [b1[0] - n[0] * 0.04, b1[1] - n[1] * 0.04], [b0[0] - n[0] * 0.012, b0[1] - n[1] * 0.012]], C.acc);
    G.disc(ctx, p[0], p[1], 0.02, C.fg);
  };
  const dirOf = (u, segs) => { const a = fly(u - 0.02, segs), b = fly(u + 0.02, segs); return a && b ? ang(a, b) : 90; };

  // 球门（足球：纯线 + 网格）
  const goal = (ctx, x, top, C, net = true) => {
    ctx.fillStyle = C.line;
    ctx.fillRect(x, top, 0.022, 0.46 - top);
    ctx.fillRect(x, top, 1.2, 0.022);
    if (net) {
      ctx.save(); ctx.globalAlpha *= 0.45;
      for (let i = 1; i < 9; i++) ctx.fillRect(x + i * 0.09, top, 0.008, 0.46 - top);
      for (let j = 1; j < 7; j++) ctx.fillRect(x, top + j * (0.46 - top) / 7, 1.2, 0.008);
      ctx.restore();
    }
  };

  // ───────── 足球：射门 ─────────
  const FB = POSES.football = {
    loop: 2, iconU: 1.05,
    keys: [
      { b: 0, torso: 6, lR1: -20, lR2: -45, lL1: 15, lL2: 5, aR1: -30, aR2: 10, aL1: 30, aL2: 60 },
      { b: 0.6, torso: -4, y: -0.01, lR1: -50, lR2: -120, lL1: 10, lL2: 0, aR1: -25, aR2: 0, aL1: 75, aL2: 80 },
      { b: 1, torso: -12, lR1: 35, lR2: 30, lL1: -4, lL2: -6, aR1: -50, aR2: -25, aL1: 100, aL2: 100, e: 'i3' },
      { b: 1.4, torso: -20, y: -0.02, lR1: 100, lR2: 105, lL1: -8, lL2: -12, aR1: -65, aR2: -45, aL1: 115, aL2: 125, e: 'o3' },
    ],
  };
  const fbSegs = [
    [0, 0.95, [-1.3, 0.4], [0.31, 0.4], 0, G.E.o2],
    [0.95, 1.0, [0.31, 0.4], [0.31, 0.4], 0],
    [1.0, 1.55, [0.31, 0.4], [1.55, -0.2], 0.12, G.E.o2],
  ];
  FB.back = (ctx, J, u, C) => { P.ground(ctx, 0.46, C, -1.6, 1.6); goal(ctx, 0.95, -0.28, C); };
  FB.front = (ctx, J, u, C) => {
    const q = ph(u, 2);
    trail(ctx, q, fbSegs, C, 5, 0.03, 0.06);
    const p = fly(q, fbSegs);
    if (p) P.ball(ctx, p[0], p[1], 0.06, C);
  };

  // ───────── 篮球：跳投 ─────────
  const BK = POSES.basketball = {
    iconU: 2.05, fig: { x: -0.28 },
    keys: [
      { b: 0, torso: 18, y: 0.03, lR1: 25, lR2: -5, lL1: -15, lL2: -35, aR1: 40, aR2: 20, aL1: -10, aL2: 40 },
      { b: 0.5, torso: 20, y: 0.04, lR1: 22, lR2: -8, lL1: -12, lL2: -32, aR1: 35, aR2: 10, aL1: -5, aL2: 45 },
      { b: 1, torso: 8, y: 0.07, lR1: 35, lR2: -12, lL1: 22, lL2: -25, aR1: 75, aR2: 140, aL1: 62, aL2: 130 },
      { b: 1.6, torso: -2, y: -0.15, lR1: 10, lR2: -10, lL1: -5, lL2: -25, aR1: 160, aR2: 170, aL1: 150, aL2: 172, e: 'o3' },
      { b: 2, torso: -4, y: -0.19, lR1: 8, lR2: -14, lL1: -6, lL2: -28, aR1: 165, aR2: 150, aL1: 150, aL2: 175 },
      { b: 2.6, torso: -2, y: -0.13, lR1: 10, lR2: -12, lL1: -5, lL2: -26, aR1: 155, aR2: 110, aL1: 140, aL2: 165 },
      { b: 3.2, torso: 6, y: 0.03, lR1: 20, lR2: -10, lL1: 0, lL2: -22, aR1: 70, aR2: 60, aL1: 40, aL2: 55, e: 'io' },
      { b: 4, torso: 8, y: 0.02, lR1: 18, lR2: -8, lL1: -4, lL2: -20, aR1: 25, aR2: 35, aL1: 10, aL2: 30 },
    ],
  };
  const RIM = [1.02, -0.62];
  const bkRel = memo(() => off(hand(jAt(BK, 2)), 0.02, -0.07));
  const bkSegs = [
    [2, 3.05, bkRel, [RIM[0], RIM[1] - 0.04], 0.5],
    [3.05, 3.5, [RIM[0], RIM[1] - 0.04], [RIM[0] - 0.01, RIM[1] + 0.3], 0, G.E.i3],
  ];
  BK.back = (ctx, J, u, C) => {
    P.ground(ctx, 0.46, C, -1.6, 1.8);
    // 篮板 + 篮筐 + 网
    ctx.fillStyle = C.line; ctx.fillRect(1.2, -0.92, 0.03, 0.42);
    G.seg(ctx, [1.2, -0.62], [1.1, -0.62], 0.02, C.line);
    ctx.save(); ctx.globalAlpha *= 0.6;
    for (let i = 0; i < 4; i++) { const x = RIM[0] - 0.085 + i * 0.056; G.seg(ctx, [x, RIM[1]], [RIM[0] - 0.05 + i * 0.033, RIM[1] + 0.13], 0.01, C.line); }
    ctx.restore();
  };
  BK.front = (ctx, J, u, C) => {
    const r = 0.058;
    let p = null;
    if (u < 1) { // 运球
      const h = hand(J); const k = Math.abs(Math.sin(Math.PI * u * 2));
      p = [h[0] + 0.02, G.lerp(0.46 - r, h[1] + r * 0.6, k)];
    } else if (u < 2) p = off(hand(J), 0.02, -0.07);
    else { trail(ctx, u, bkSegs, C, 5, 0.04, r); p = fly(u, bkSegs); }
    if (p) P.ball(ctx, p[0], p[1], r, C);
    // 篮筐画在球前面
    G.seg(ctx, [RIM[0] - 0.09, RIM[1]], [RIM[0] + 0.09, RIM[1]], 0.024, C.fg);
  };

  // ───────── 排球：扣球 ─────────
  const VB = POSES.volleyball = {
    loop: 4, iconU: 2, fig: { s: 0.92, x: -0.2, y: 0.08 },
    keys: [
      { b: 0, torso: 15, lR1: -30, lR2: -60, lL1: 30, lL2: 10, aR1: -60, aR2: -40, aL1: -50, aL2: -30 },
      { b: 1, torso: 25, y: 0.08, lR1: 40, lR2: -20, lL1: 30, lL2: -30, aR1: -85, aR2: -75, aL1: -75, aL2: -65 },
      { b: 1.6, torso: -15, y: -0.28, lR1: -10, lR2: -70, lL1: 10, lL2: -50, aR1: 175, aR2: 250, aL1: 150, aL2: 150, e: 'o3' },
      { b: 2, torso: 10, y: -0.3, lR1: 10, lR2: -40, lL1: 20, lL2: -30, aR1: 160, aR2: 150, aL1: 60, aL2: 40, e: 'iExp' },
      { b: 2.5, torso: 30, y: -0.2, lR1: 30, lR2: -10, lL1: 20, lL2: -20, aR1: 60, aR2: 40, aL1: 20, aL2: 40, e: 'o3' },
      { b: 3.2, torso: 15, y: 0.06, lR1: 35, lR2: -15, lL1: 25, lL2: -25, aR1: 30, aR2: 50, aL1: -10, aL2: 20 },
    ],
  };
  const vbHit = memo(() => off(hand(jAt(VB, 2)), 0.05, -0.05));
  const vbSegs = [
    [0.4, 2, [-1.1, 0.25], vbHit, 0.75],
    [2, 2.35, vbHit, [1.35, 0.52], 0],
  ];
  VB.back = (ctx, J, u, C) => {
    P.ground(ctx, 0.46, C, -1.6, 1.8);
    const x = 0.44;
    ctx.fillStyle = C.line; ctx.fillRect(x, -0.62, 0.02, 1.08); // 网柱
    // 网面：一条竖向网带（侧视）+ 网格
    ctx.save(); ctx.globalAlpha *= 0.35; ctx.fillStyle = C.fg; ctx.fillRect(x - 0.03, -0.62, 0.08, 0.36); ctx.restore();
    ctx.save(); ctx.globalAlpha *= 0.6; ctx.fillStyle = C.line;
    for (let j = 0; j < 8; j++) ctx.fillRect(x - 0.03, -0.6 + j * 0.045, 0.08, 0.007);
    ctx.restore();
    ctx.fillStyle = C.fg; ctx.fillRect(x - 0.04, -0.63, 0.1, 0.025); ctx.fillRect(x - 0.04, -0.27, 0.1, 0.015);
  };
  VB.front = (ctx, J, u, C) => {
    const q = ph(u, 4);
    trail(ctx, q, vbSegs, C, 6, 0.025, 0.062);
    const p = fly(q, vbSegs);
    if (p) P.ball(ctx, p[0], p[1], 0.062, C);
  };

  // ───────── 手球：跳起射门（抬膝）─────────
  const HB = POSES.handball = {
    iconU: 1.7, fig: { x: -0.25 },
    keys: [
      { b: 0, ...G.runCycle(0.25, 0.8, { lean: 10 }), aR1: 60, aR2: 120 },
      { b: 1, torso: 5, y: -0.06, lL1: 0, lL2: -10, lR1: 80, lR2: 0, aR1: 190, aR2: 230, aL1: 70, aL2: 90 },
      { b: 1.6, torso: -10, y: -0.24, lR1: 92, lR2: 12, lL1: -10, lL2: -45, aR1: 205, aR2: 245, aL1: 95, aL2: 100, e: 'o3' },
      { b: 2, torso: 22, y: -0.25, lR1: 95, lR2: 20, lL1: -10, lL2: -50, aR1: 118, aR2: 112, aL1: 40, aL2: 60, e: 'iExp' },
      { b: 2.5, torso: 30, y: -0.15, lR1: 60, lR2: 0, lL1: -5, lL2: -30, aR1: 40, aR2: 30, aL1: -10, aL2: 20, e: 'o3' },
      { b: 3.2, torso: 15, y: 0.04, lR1: 30, lR2: -10, lL1: -10, lL2: -30, aR1: 20, aR2: 40, aL1: -10, aL2: 10 },
    ],
  };
  const hbRel = memo(() => off(hand(jAt(HB, 2)), 0.03, -0.03));
  const hbSegs = [[2, 2.35, hbRel, [1.5, 0.25], 0]];
  HB.back = (ctx, J, u, C) => {
    P.ground(ctx, 0.46, C, -1.6, 1.8);
    // 红白相间的门柱
    const x = 1.05, top = -0.2;
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? C.fg : C.acc; ctx.fillRect(x, top + i * (0.66 / 6), 0.035, 0.66 / 6 + 0.001); }
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? C.fg : C.acc; ctx.fillRect(x + i * 0.12, top, 0.12, 0.035); }
  };
  HB.front = (ctx, J, u, C) => {
    let p;
    if (u < 2) p = off(hand(J), 0.03, -0.03);
    else { trail(ctx, u, hbSegs, C, 5, 0.03, 0.045); p = fly(u, hbSegs); }
    if (p) P.ball(ctx, p[0], p[1], 0.045, C);
  };

  // ───────── 曲棍球：推击 ─────────
  const HK = POSES.hockey = {
    loop: 2, iconU: 0.6,
    keys: [
      { b: 0, torso: 45, y: 0.08, head: -25, lR1: 40, lR2: -10, lL1: -20, lL2: -50, aR1: 40, aR2: 30, aL1: 50, aL2: 40 },
      { b: 0.6, torso: 40, y: 0.08, head: -25, lR1: 40, lR2: -10, lL1: -20, lL2: -50, aR1: -25, aR2: -50, aL1: -15, aL2: -35 },
      { b: 1, torso: 50, y: 0.08, head: -25, lR1: 42, lR2: -8, lL1: -22, lL2: -52, aR1: 48, aR2: 38, aL1: 55, aL2: 45, e: 'iExp' },
      { b: 1.35, torso: 42, y: 0.07, head: -20, lR1: 40, lR2: -10, lL1: -20, lL2: -50, aR1: 105, aR2: 115, aL1: 95, aL2: 105, e: 'o3' },
    ],
  };
  const stick = (J) => {
    const a = foreAng(J), h = hand(J);
    const top = along(h, a, -0.12), tip = along(h, a, 0.36);
    return { top, tip, a };
  };
  const hkTip = memo(() => { const s = stick(jAt(HK, 1)); return [s.tip[0] + 0.07, 0.425]; });
  HK.back = (ctx, J, u, C) => { P.ground(ctx, 0.46, C, -1.6, 1.6); };
  HK.front = (ctx, J, u, C) => {
    const s = stick(J);
    G.seg(ctx, s.top, s.tip, 0.026, C.fg);
    // J 形弯头
    const n = along(s.tip, s.a + 90, 0.07);
    G.seg(ctx, s.tip, n, 0.03, C.fg);
    const q = ph(u, 2), b = hkTip();
    let p = q < 1 ? b : [b[0] + (q - 1) * 3.2, b[1]];
    if (q >= 1) { for (let i = 1; i <= 5; i++) { ctx.save(); ctx.globalAlpha *= 0.25 * (1 - i / 6); G.disc(ctx, p[0] - i * 0.06, p[1], 0.035, C.acc); ctx.restore(); } }
    G.disc(ctx, p[0], p[1], 0.035, C.acc);
  };

  // ───────── 七人制橄榄球：带球冲刺 → 鱼跃达阵 ─────────
  const RG = POSES.rugby = {
    iconU: 2.6, fig: { x: -0.3 },
    pose: (u) => {
      const run = (v) => ({ ...G.runCycle(v, 0.95, { lean: 16 }), aR1: 30, aR2: 125, aL1: 95, aL2: 100, head: -6 });
      const dive = { x: 0.35, rot: 72, torso: 8, y: 0.17, lR1: -20, lR2: -45, lL1: -30, lL2: -60, aR1: 168, aR2: 175, aL1: 160, aL2: 170, head: 10 };
      const down = { x: 0.5, rot: 84, torso: 6, y: 0.335, lR1: -12, lR2: -30, lL1: -20, lL2: -40, aR1: 172, aR2: 178, aL1: 165, aL2: 175, head: 15 };
      if (u < 1.7) return run(u);
      if (u < 2.5) return G.lerpPose(run(u), dive, G.E.io((u - 1.7) / 0.8));
      if (u < 3.1) return G.lerpPose(dive, down, G.E.i3((u - 2.5) / 0.6));
      return down;
    },
  };
  RG.back = (ctx, J, u, C) => {
    P.ground(ctx, 0.46, C, -1.6, 1.8);
    ctx.fillStyle = C.fg; ctx.fillRect(0.95, 0.4, 0.035, 0.07); // 达阵线
    // H 形球门
    ctx.fillStyle = C.line;
    ctx.fillRect(1.25, -0.95, 0.022, 1.41); ctx.fillRect(1.55, -0.95, 0.022, 1.41); ctx.fillRect(1.25, -0.2, 0.32, 0.022);
    if (u < 1.8) P.speed(ctx, -0.35, -0.05, 0.8, 5, C, 0.8);
  };
  RG.front = (ctx, J, u, C) => {
    const h = u < 2.2 ? off(J.aR[1], 0.06, 0.02) : J.aR[2];
    const a = u < 2.2 ? 70 : 100;
    ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(-a * D2R + Math.PI / 2);
    ctx.fillStyle = C.acc; ctx.beginPath(); ctx.ellipse(0, 0, 0.075, 0.045, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.bg; ctx.fillRect(-0.03, -0.004, 0.06, 0.008);
    ctx.restore();
  };

  // ───────── 棒垒球：挥棒击球 ─────────
  const BB = POSES.baseball = {
    iconU: 2.05,
    keys: [
      { b: 0, torso: 8, lR1: 22, lR2: 12, lL1: -20, lL2: -15, aR1: -70, aR2: 165, aL1: -55, aL2: 160, bat: 205 },
      { b: 1, torso: 4, lR1: 45, lR2: 0, lL1: -22, lL2: -25, aR1: -95, aR2: 175, aL1: -80, aL2: 170, bat: 232 },
      { b: 1.75, torso: 6, lR1: 28, lR2: 18, lL1: -25, lL2: -35, aR1: -80, aR2: 170, aL1: -70, aL2: 165, bat: 238 },
      { b: 2, torso: 0, lR1: 25, lR2: 20, lL1: -25, lL2: -45, aR1: 88, aR2: 90, aL1: 84, aL2: 86, bat: 90, e: 'iExp' },
      { b: 2.6, torso: -10, lR1: 22, lR2: 20, lL1: -20, lL2: -65, aR1: 150, aR2: 205, aL1: 140, aL2: 195, bat: 248, e: 'o3' },
    ],
  };
  const batPt = (J, u, d) => along(hand(J), G.keyPose(BB.keys, u).bat, d);
  const bbHit = memo(() => batPt(jAt(BB, 2), 2, 0.3));
  const bbSegs = [
    [1.35, 2, [1.5, -0.1], bbHit, 0.04],
    [2, 2.45, bbHit, [1.4, -1.1], 0.1, G.E.o2],
  ];
  BB.back = (ctx, J, u, C) => { P.ground(ctx, 0.46, C, -1.6, 1.6); G.poly(ctx, [[-0.02, 0.46], [0.16, 0.46], [0.16, 0.48], [0.07, 0.5], [-0.02, 0.48]], C.line); };
  BB.front = (ctx, J, u, C) => {
    const a = G.keyPose(BB.keys, u).bat, h = hand(J);
    G.seg(ctx, along(h, a, -0.04), along(h, a, 0.2), 0.022, C.fg);
    G.seg(ctx, along(h, a, 0.18), along(h, a, 0.42), 0.042, C.fg);
    trail(ctx, u, bbSegs, C, 5, 0.035, 0.033);
    const p = fly(u, bbSegs);
    if (p) P.ball(ctx, p[0], p[1], 0.033, C);
  };

  // ───────── 板球：直线驱球 + 三柱门 ─────────
  const CK = POSES.cricket = {
    iconU: 2.1, fig: { x: 0.1 },
    keys: [
      { b: 0, torso: 25, y: 0.03, lR1: 15, lR2: 0, lL1: -12, lL2: -18, aR1: 30, aR2: 18, aL1: 36, aL2: 24, bat: 350 },
      { b: 1, torso: 18, y: 0.02, lR1: 20, lR2: 5, lL1: -15, lL2: -20, aR1: -20, aR2: 5, aL1: -10, aL2: 15, bat: 200 },
      { b: 1.6, torso: 22, y: 0.05, lR1: 45, lR2: 0, lL1: -25, lL2: -35, aR1: -35, aR2: -5, aL1: -25, aL2: 5, bat: 205 },
      { b: 2, torso: 30, y: 0.07, lR1: 52, lR2: -2, lL1: -35, lL2: -45, aR1: 42, aR2: 50, aL1: 47, aL2: 56, bat: 15, e: 'iExp' },
      { b: 2.6, torso: 15, y: 0.05, lR1: 50, lR2: -2, lL1: -35, lL2: -48, aR1: 135, aR2: 155, aL1: 128, aL2: 150, bat: 150, e: 'o3' },
    ],
  };
  const ckBat = (J, u) => G.keyPose(CK.keys, u).bat;
  const ckHit = memo(() => along(hand(jAt(CK, 2)), 15, 0.3));
  const ckSegs = [
    [1.1, 1.65, [1.5, -0.25], [0.75, 0.44], 0],
    [1.65, 2, [0.75, 0.44], ckHit, 0.02],
    [2, 2.4, ckHit, [1.6, 0.42], 0.02],
  ];
  CK.back = (ctx, J, u, C) => {
    P.ground(ctx, 0.46, C, -1.6, 1.6);
    // 三柱门 + 横木
    for (let i = 0; i < 3; i++) G.seg(ctx, [-0.52 + i * 0.05, 0.46], [-0.52 + i * 0.05, 0.14], 0.018, C.line);
    G.seg(ctx, [-0.535, 0.13], [-0.415, 0.13], 0.016, C.line);
  };
  CK.front = (ctx, J, u, C) => {
    const a = ckBat(J, u), h = hand(J);
    G.seg(ctx, along(h, a, -0.05), along(h, a, 0.1), 0.02, C.fg);
    G.seg(ctx, along(h, a, 0.13), along(h, a, 0.4), 0.058, C.fg);
    trail(ctx, u, ckSegs, C, 5, 0.035, 0.033);
    const p = fly(u, ckSegs);
    if (p) P.ball(ctx, p[0], p[1], 0.033, C, { seam: false });
  };

  // ───────── 高尔夫：开球 ─────────
  const GF = POSES.golf = {
    iconU: 2.9, fig: { x: -0.15 },
    keys: [
      { b: 0, torso: 40, y: 0.02, lR1: 12, lR2: 2, lL1: -8, lL2: -12, aR1: 50, aR2: 50, aL1: 47, aL2: 47, club: 35 },
      { b: 1, torso: 38, y: 0.02, lR1: 12, lR2: 2, lL1: -8, lL2: -12, aR1: 10, aR2: -30, aL1: 20, aL2: -10, club: -80 },
      { b: 1.8, torso: 30, y: 0.02, lR1: 14, lR2: 0, lL1: -6, lL2: -12, aR1: -125, aR2: -160, aL1: -115, aL2: -150, club: -175 },
      { b: 2, torso: 38, y: 0.02, lR1: 10, lR2: 2, lL1: -10, lL2: -14, aR1: 52, aR2: 52, aL1: 49, aL2: 49, club: 35, e: 'iExp' },
      { b: 2.8, torso: -12, y: 0, lR1: 5, lR2: 0, lL1: -12, lL2: -55, aR1: 150, aR2: 205, aL1: 140, aL2: 200, club: 235, e: 'o3' },
    ],
  };
  const gfBall = [0.55, 0.425];
  const gfSegs = [[2, 2.6, gfBall, [1.7, -0.8], 0.15, G.E.o2]];
  GF.back = (ctx, J, u, C) => {
    P.ground(ctx, 0.46, C, -1.6, 1.8);
    // 远处旗杆
    G.seg(ctx, [1.35, 0.46], [1.35, 0.05], 0.012, C.line);
    G.poly(ctx, [[1.35, 0.05], [1.48, 0.1], [1.35, 0.15]], C.acc);
    ctx.fillStyle = C.line; ctx.fillRect(gfBall[0] - 0.005, 0.44, 0.01, 0.02); // 球座
  };
  GF.front = (ctx, J, u, C) => {
    const a = G.keyPose(GF.keys, u).club, h = hand(J);
    const head = along(h, a, 0.46);
    G.seg(ctx, h, head, 0.018, C.fg);
    G.seg(ctx, head, along(head, a + 90, 0.06), 0.04, C.fg);
    if (u < 2) G.disc(ctx, gfBall[0], gfBall[1], 0.024, C.acc);
    else { trail(ctx, u, gfSegs, C, 5, 0.03, 0.024); const p = fly(u, gfSegs); if (p) G.disc(ctx, p[0], p[1], 0.024, C.acc); }
  };

  // ═══════ 持拍类（2 拍一格，击球落在第 1 拍）═══════

  // ───────── 羽毛球：跳杀 ─────────
  const BM = POSES.badminton = {
    loop: 2, iconU: 0.95, fig: { s: 0.94, y: 0.1 },
    keys: [
      { b: 0, torso: 10, y: 0.04, lR1: 35, lR2: -10, lL1: -20, lL2: -40, aR1: -60, aR2: -100, aL1: 100, aL2: 130 },
      { b: 0.6, torso: -20, y: -0.15, lR1: 30, lR2: -60, lL1: -30, lL2: -80, aR1: 190, aR2: 262, aL1: 140, aL2: 150, e: 'o3' },
      { b: 1, torso: 5, y: -0.17, lR1: 20, lR2: -40, lL1: -20, lL2: -60, aR1: 170, aR2: 162, aL1: 40, aL2: 60, e: 'iExp' },
      { b: 1.4, torso: 25, y: -0.08, lR1: 40, lR2: -10, lL1: -10, lL2: -50, aR1: 40, aR2: 30, aL1: -20, aL2: 0, e: 'o3' },
    ],
  };
  const bmHit = memo(() => { const J = jAt(BM, 1); return along(hand(J), foreAng(J), 0.22); });
  const bmSegs = [[0, 1, [1.4, -0.6], bmHit, 0.45], [1, 1.35, bmHit, [1.4, 0.55], 0]];
  BM.front = (ctx, J, u, C) => {
    P.racket(ctx, hand(J), foreAng(J) + 8, 0.14, 0.07, C);
    const q = ph(u, 2), p = fly(q, bmSegs);
    if (p) shuttle(ctx, p, dirOf(q, bmSegs), C);
  };
  BM.back = (ctx, J, u, C) => P.ground(ctx, 0.46, C, -1.6, 1.6);

  // ───────── 乒乓球：正手拉球 ─────────
  const TT = POSES.tabletennis = {
    loop: 2, iconU: 1.05, fig: { x: -0.3 },
    keys: [
      { b: 0, torso: 25, y: 0.05, lR1: 30, lR2: -5, lL1: -15, lL2: -35, aR1: -35, aR2: 25, aL1: 60, aL2: 100 },
      { b: 0.65, torso: 28, y: 0.06, lR1: 32, lR2: -5, lL1: -15, lL2: -35, aR1: -50, aR2: 10, aL1: 55, aL2: 95 },
      { b: 1, torso: 20, y: 0.05, lR1: 30, lR2: -5, lL1: -15, lL2: -35, aR1: 60, aR2: 120, aL1: 50, aL2: 90, e: 'iExp' },
      { b: 1.4, torso: 12, y: 0.03, lR1: 28, lR2: -6, lL1: -14, lL2: -34, aR1: 120, aR2: 175, aL1: 40, aL2: 80, e: 'o3' },
    ],
  };
  const TABLE_Y = 0.05;
  const ttHit = memo(() => { const J = jAt(TT, 1); return along(hand(J), foreAng(J), 0.1); });
  const ttSegs = [[0, 0.6, [1.6, -0.2], [0.9, TABLE_Y - 0.02], 0.1], [0.6, 1, [0.9, TABLE_Y - 0.02], ttHit, 0.18], [1, 1.6, ttHit, [1.8, -0.15], 0.3]];
  TT.back = (ctx, J, u, C) => {
    P.ground(ctx, 0.46, C, -1.6, 1.8);
    ctx.fillStyle = C.line; ctx.fillRect(0.42, TABLE_Y, 1.4, 0.035); ctx.fillRect(0.55, TABLE_Y, 0.03, 0.41);
    ctx.fillStyle = C.fg; ctx.fillRect(1.25, TABLE_Y - 0.08, 0.015, 0.08); // 球网
  };
  TT.front = (ctx, J, u, C) => {
    P.racket(ctx, hand(J), foreAng(J), 0.05, 0.06, C, { solid: true });
    const q = ph(u, 2); trail(ctx, q, ttSegs, C, 4, 0.03, 0.022);
    const p = fly(q, ttSegs); if (p) G.disc(ctx, p[0], p[1], 0.022, C.acc);
  };

  // ───────── 网球：发球 ─────────
  // 发球是整圈挥臂：关键帧写成连续角度（-50 → -410），不用 loop 插值，按 2 拍取模
  const tnKeys = [
    { b: 0, torso: -5, lR1: 15, lR2: 0, lL1: -15, lL2: -20, aR1: -50, aR2: -80, aL1: 165, aL2: 175 },
    { b: 0.6, torso: -22, y: 0.03, lR1: 28, lR2: -18, lL1: -8, lL2: -32, aR1: -160, aR2: -25, aL1: 170, aL2: 175 },
    { b: 1, torso: 15, y: -0.08, lR1: 5, lR2: -30, lL1: -20, lL2: -60, aR1: -185, aR2: -182, aL1: 60, aL2: 30, e: 'iExp' },
    { b: 1.5, torso: 35, y: 0, lR1: 40, lR2: 10, lL1: -30, lL2: -60, aR1: -340, aR2: -345, aL1: 30, aL2: 60, e: 'o3' },
    { b: 2, torso: -5, lR1: 15, lR2: 0, lL1: -15, lL2: -20, aR1: -410, aR2: -440, aL1: 165, aL2: 175 },
  ];
  const TN = POSES.tennis = {
    iconU: 0.98, fig: { y: 0.05 },
    pose: (u) => G.keyPose(tnKeys, ph(u, 2)),
  };
  const tnHit = memo(() => { const J = jAt(TN, 1); return along(hand(J), foreAng(J), 0.22); });
  const tnToss = memo(() => off(farHand(jAt(TN, 0)), 0, -0.04));
  const tnSegs = [
    [0, 0.8, tnToss, () => off(tnHit(), -0.02, -0.12), 0, G.E.o2],
    [0.8, 1, () => off(tnHit(), -0.02, -0.12), tnHit, 0, G.E.i3],
    [1, 1.3, tnHit, [1.6, 0.3], 0],
  ];
  TN.back = (ctx, J, u, C) => P.ground(ctx, 0.46, C, -1.6, 1.6);
  TN.front = (ctx, J, u, C) => {
    P.racket(ctx, hand(J), foreAng(J), 0.14, 0.085, C);
    const q = ph(u, 2); if (q >= 1) trail(ctx, q, tnSegs, C, 5, 0.025, 0.032);
    const p = fly(q, tnSegs); if (p) P.ball(ctx, p[0], p[1], 0.032, C);
  };

  // ───────── 软式网球：正手上旋挑高（软球 = 空心浅色）─────────
  const ST = POSES.softtennis = {
    loop: 2, iconU: 1.4, fig: { x: -0.2 },
    keys: [
      { b: 0, torso: 10, y: 0.04, lR1: 30, lR2: -10, lL1: -25, lL2: -40, aR1: -70, aR2: -40, aL1: 80, aL2: 90 },
      { b: 0.6, torso: 14, y: 0.06, lR1: 34, lR2: -12, lL1: -28, lL2: -45, aR1: -80, aR2: -75, aL1: 85, aL2: 95 },
      { b: 1, torso: 5, y: 0.03, lR1: 30, lR2: -8, lL1: -22, lL2: -38, aR1: 55, aR2: 75, aL1: 20, aL2: 40, e: 'iExp' },
      { b: 1.5, torso: -6, y: 0, lR1: 20, lR2: -10, lL1: -20, lL2: -50, aR1: 150, aR2: 215, aL1: 0, aL2: 20, e: 'o3' },
    ],
  };
  const stHit = memo(() => { const J = jAt(ST, 1); return along(hand(J), foreAng(J), 0.2); });
  const stSegs = [[0, 0.55, [1.6, -0.1], [0.75, 0.43], 0.1], [0.55, 1, [0.75, 0.43], stHit, 0.12], [1, 1.8, stHit, [1.8, -0.55], 0.55]];
  const softBall = (ctx, p, C) => { G.disc(ctx, p[0], p[1], 0.036, C.fg); G.disc(ctx, p[0], p[1], 0.02, C.bg); };
  ST.back = (ctx, J, u, C) => {
    P.ground(ctx, 0.46, C, -1.6, 1.8);
    ctx.fillStyle = C.line; ctx.fillRect(1.25, 0.12, 0.018, 0.34); ctx.fillStyle = C.fg; ctx.fillRect(1.25, 0.1, 0.35, 0.02);
  };
  ST.front = (ctx, J, u, C) => {
    P.racket(ctx, hand(J), foreAng(J), 0.13, 0.078, C);
    const q = ph(u, 2), p = fly(q, stSegs);
    if (p) softBall(ctx, p, C);
  };

  // ───────── 壁球：弓步低截击 + 前墙 ─────────
  const SQ = POSES.squash = {
    loop: 2, iconU: 1.05, fig: { x: -0.25 },
    keys: [
      { b: 0, torso: 15, y: 0.02, lR1: 30, lR2: -10, lL1: -30, lL2: -40, aR1: -100, aR2: -170, aL1: 60, aL2: 70 },
      { b: 0.7, torso: 30, y: 0.1, lR1: 75, lR2: 0, lL1: -50, lL2: -60, aR1: -110, aR2: -190, aL1: -20, aL2: -10 },
      { b: 1, torso: 35, y: 0.12, lR1: 80, lR2: 5, lL1: -55, lL2: -65, aR1: 60, aR2: 80, aL1: -40, aL2: -30, e: 'iExp' },
      { b: 1.4, torso: 30, y: 0.1, lR1: 78, lR2: 3, lL1: -52, lL2: -62, aR1: 110, aR2: 130, aL1: -35, aL2: -25, e: 'o3' },
    ],
  };
  const WALL = 1.05;
  const sqHit = memo(() => { const J = jAt(SQ, 1); return along(hand(J), foreAng(J), 0.2); });
  const sqSegs = [[0, 1, [WALL, -0.15], sqHit, 0.08], [1, 1.3, sqHit, [WALL, 0.05], 0], [1.3, 2, [WALL, 0.05], [-1.5, 0.2], 0.25]];
  SQ.back = (ctx, J, u, C) => {
    P.ground(ctx, 0.46, C, -1.6, WALL);
    ctx.fillStyle = C.line; ctx.fillRect(WALL, -1.0, 0.03, 1.47);
    ctx.fillStyle = C.fg; ctx.fillRect(WALL - 0.02, 0.33, 0.05, 0.03); ctx.fillRect(WALL - 0.02, -0.45, 0.05, 0.02); // 底板线 / 发球线
  };
  SQ.front = (ctx, J, u, C) => {
    P.racket(ctx, hand(J), foreAng(J), 0.16, 0.07, C);
    const q = ph(u, 2); trail(ctx, q, sqSegs, C, 4, 0.03, 0.025);
    const p = fly(q, sqSegs); if (p) G.disc(ctx, p[0], p[1], 0.025, C.fg);
  };

  // ───────── 板式网球：后玻璃反弹后回击（实心打孔拍）─────────
  const PD = POSES.padel = {
    loop: 2, iconU: 1.05, fig: { x: 0.1 },
    keys: [
      { b: 0, torso: 20, y: 0.06, lR1: 40, lR2: -5, lL1: -20, lL2: -45, aR1: -60, aR2: -20, aL1: 70, aL2: 100 },
      { b: 0.6, torso: 24, y: 0.08, lR1: 42, lR2: -6, lL1: -22, lL2: -48, aR1: -75, aR2: -45, aL1: 72, aL2: 102 },
      { b: 1, torso: 15, y: 0.07, lR1: 40, lR2: -5, lL1: -20, lL2: -45, aR1: 55, aR2: 90, aL1: 30, aL2: 60, e: 'iExp' },
      { b: 1.4, torso: 5, y: 0.04, lR1: 38, lR2: -6, lL1: -20, lL2: -44, aR1: 120, aR2: 160, aL1: 20, aL2: 50, e: 'o3' },
    ],
  };
  const GLASS = -0.62;
  const pdHit = memo(() => { const J = jAt(PD, 1); return along(hand(J), foreAng(J), 0.1); });
  const pdSegs = [[0, 0.25, [1.5, -0.3], [0.15, 0.43], 0], [0.25, 0.55, [0.15, 0.43], [GLASS + 0.03, -0.05], 0.1], [0.55, 1, [GLASS + 0.03, -0.05], pdHit, 0.05], [1, 1.4, pdHit, [1.6, -0.05], 0.1]];
  PD.back = (ctx, J, u, C) => {
    P.ground(ctx, 0.46, C, GLASS, 1.6);
    // 后玻璃：半透明面板 + 框
    ctx.save(); ctx.globalAlpha *= 0.18; ctx.fillStyle = C.fg; ctx.fillRect(GLASS - 0.25, -0.75, 0.25, 1.21); ctx.restore();
    ctx.fillStyle = C.line; ctx.fillRect(GLASS - 0.012, -0.75, 0.024, 1.21); ctx.fillRect(GLASS - 0.25, -0.75, 0.25, 0.018);
    // 玻璃反光斜线
    ctx.save(); ctx.globalAlpha *= 0.35; G.seg(ctx, [GLASS - 0.2, -0.3], [GLASS - 0.06, -0.55], 0.012, C.fg); G.seg(ctx, [GLASS - 0.2, -0.15], [GLASS - 0.1, -0.3], 0.012, C.fg); ctx.restore();
  };
  PD.front = (ctx, J, u, C) => {
    const hc = P.racket(ctx, hand(J), foreAng(J), 0.06, 0.075, C, { solid: true });
    // 打孔
    ctx.save(); ctx.translate(hc[0], hc[1]); ctx.rotate(-foreAng(J) * D2R);
    for (let j = -2; j <= 2; j++) for (let i = -1; i <= 1; i++) G.disc(ctx, i * 0.022 + (j % 2 ? 0.011 : 0), j * 0.022, 0.006, C.bg);
    ctx.restore();
    const q = ph(u, 2); trail(ctx, q, pdSegs, C, 4, 0.03, 0.03);
    const p = fly(q, pdSegs); if (p) P.ball(ctx, p[0], p[1], 0.03, C);
  };

  // ───────── 泰克球：抬膝颠球 → 头球过网落在弧形台面 ─────────
  const TQ = POSES.teqball = {
    iconU: 2, fig: { x: -0.4 },
    keys: [
      { b: 0, torso: 0, lR1: 4, lR2: 2, lL1: -4, lL2: -4, aR1: -30, aR2: -10, aL1: 30, aL2: 50 },
      { b: 1, torso: -3, lR1: 85, lR2: 0, lL1: -5, lL2: -5, aR1: -40, aR2: -20, aL1: 40, aL2: 60, e: 'o3' },
      { b: 1.6, torso: -15, head: -15, y: 0.02, lR1: 12, lR2: 0, lL1: -6, lL2: -10, aR1: -50, aR2: -30, aL1: -45, aL2: -25 },
      { b: 2, torso: 18, head: 20, y: -0.05, lR1: 10, lR2: -20, lL1: -10, lL2: -30, aR1: -45, aR2: -20, aL1: -40, aL2: -20, e: 'iExp' },
      { b: 2.6, torso: 6, head: 0, lR1: 6, lR2: -4, lL1: -6, lL2: -8, aR1: -30, aR2: -10, aL1: 20, aL2: 40, e: 'o3' },
      { b: 4, torso: 0, lR1: 4, lR2: 2, lL1: -4, lL2: -4, aR1: -30, aR2: -10, aL1: 30, aL2: 50 },
    ],
  };
  const tabY = (x) => 0.02 + 0.3 * (x - 1.0) * (x - 1.0);
  const tqKnee = memo(() => { const J = jAt(TQ, 1); return off(J.lR[1], 0.02, -0.08); });
  const tqHead = memo(() => { const J = jAt(TQ, 2); return off(J.head, 0.07, -0.07); });
  const tqSegs = [
    [0, 1, [0.3, -0.95], tqKnee, 0, G.E.i3],
    [1, 2, tqKnee, tqHead, 0.35],
    [2, 2.8, tqHead, [1.3, tabY(1.3) - 0.055], 0.35],
    [2.8, 3.6, [1.3, tabY(1.3) - 0.055], [2.0, -0.35], 0.25],
  ];
  TQ.back = (ctx, J, u, C) => {
    P.ground(ctx, 0.46, C, -1.6, 1.8);
    // 弧形台面 + 中间网 + 支柱
    ctx.strokeStyle = C.line; ctx.lineWidth = 0.04; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i <= 30; i++) { const x = 0.42 + (1.16 * i) / 30; i ? ctx.lineTo(x, tabY(x)) : ctx.moveTo(x, tabY(x)); }
    ctx.stroke();
    ctx.fillStyle = C.line; ctx.fillRect(0.98, tabY(1), 0.04, 0.46 - tabY(1)); ctx.fillRect(0.82, 0.44, 0.36, 0.02);
    ctx.fillStyle = C.fg; ctx.fillRect(0.99, -0.1, 0.02, 0.12);
  };
  TQ.front = (ctx, J, u, C) => {
    trail(ctx, u, tqSegs, C, 4, 0.03, 0.055);
    const p = fly(u, tqSegs); if (p) P.ball(ctx, p[0], p[1], 0.055, C);
  };
})();
