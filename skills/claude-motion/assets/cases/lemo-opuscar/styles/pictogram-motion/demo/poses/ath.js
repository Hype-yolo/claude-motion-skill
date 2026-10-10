// 田径 14 项
(function () {
  const G = window.G, P = G.P, POSES = window.POSES;

  POSES.sprint = {
    iconU: 0.25,
    pose: (u) => ({ ...G.runCycle(u / 1.0, 1, { lean: 16 }), head: -6 }),
    back: (ctx, J, u, C) => { P.speed(ctx, -0.35, -0.05, 0.9, 5, C, 0.8); },
  };

  // 跨栏：每 2 拍过一个栏，第 1 拍腾空
  POSES.hurdles = {
    iconU: 0.62,
    pose: (u) => {
      const k = G.keyPose([
        { b: 0, ...G.runCycle(0.25, 1, { lean: 14 }) },
        { b: 0.55, torso: 38, y: -0.12, lR1: 92, lR2: 92, lL1: -60, lL2: -150, aR1: -40, aR2: 20, aL1: 120, aL2: 95, e: 'o3' },
        { b: 1.2, torso: 26, y: -0.08, lR1: 40, lR2: 10, lL1: 20, lL2: -80, aR1: -10, aR2: 60, aL1: 70, aL2: 90 },
        { b: 2, ...G.runCycle(0.25, 1, { lean: 14 }), e: 'io' },
      ], u, 2);
      return { ...k, head: -8 };
    },
    back: (ctx, J, u, C) => {
      // 栏架从右往左划过，第 0.55 拍正好在身下
      const ph = ((u % 2) + 2) % 2;
      const x = (0.62 - ph) * 1.1; // 每 2 拍移动 2.2 = 一个栏间距；u=0.62 时栏在正下方
      ctx.fillStyle = C.acc;
      for (const ox of [x - 2.2, x, x + 2.2]) {
        ctx.fillRect(ox - 0.14, 0.12, 0.28, 0.035);
        ctx.fillRect(ox - 0.13, 0.12, 0.018, 0.34);
        ctx.fillRect(ox + 0.112, 0.12, 0.018, 0.34);
      }
      P.ground(ctx, 0.46, C, -1.6, 1.6);
    },
  };

  // ───────── 公用小工具 ─────────
  const mod = (u, L) => ((u % L) + L) % L;
  const mixP = G.lerpPose;
  const R2D = 180 / Math.PI;
  // 世界方向 → 该坐标系下的肢体角（dirDown 的反函数）
  const angTo = (dir, frame) => { const l = G.rot2(dir, -frame); return Math.atan2(l[0], l[1]) * R2D; };
  // 抛物线：p0 起点，v 初速（每拍），g 重力（每拍²），t 拍
  const fly = (p0, v, g, t) => [p0[0] + v[0] * t, p0[1] + v[1] * t + 0.5 * g * t * t];
  // 跑动中逐渐过渡到关键帧
  const runInto = (u, ph, k, lean, key, t0, t1) => mixP({ ...G.runCycle(ph, k, { lean }) }, key, G.E.io(G.inv(t0, t1, u)));
  // 地面刻度线（跑道分道标记），随速度左移
  const dashes = (ctx, y, u, speed, C, gap = 0.5) => {
    ctx.fillStyle = C.line;
    const off = mod(u * speed, gap);
    for (let x = -1.6 - off; x < 1.6; x += gap) ctx.fillRect(x, y, gap * 0.45, 0.012);
  };

  // ───────── 接力：第 2 拍交棒 ─────────
  const relayMain = (u) => {
    const x = u < 2 ? G.lerp(-0.5, -0.26, G.E.io(u / 2)) : G.lerp(-0.26, -0.48, G.E.io((u - 2) / 2));
    const k = u < 2 ? 1 : G.lerp(1, 0.55, G.E.io((u - 2) / 2));
    const p = { ...G.runCycle(u, k, { lean: 14 }), x, head: -6 };
    const reach = G.E.io(G.inv(1.2, 1.8, u)) * (1 - G.E.io(G.inv(2.15, 2.7, u)));
    p.aR1 = G.lerp(p.aR1, 82, reach); p.aR2 = G.lerp(p.aR2, 88, reach);
    return p;
  };
  const relaySecond = (u) => {
    const x = u < 2 ? G.lerp(0.06, 0.02, G.E.io(u / 2)) : G.lerp(0.02, 0.42, G.E.i3((u - 2) / 2) * 0.6 + (u - 2) / 2 * 0.4);
    const p = { ...G.runCycle(u + 0.5, u < 2 ? 0.8 : 1, { lean: 16 }), x, head: -4 };
    const back = 1 - G.E.io(G.inv(2.05, 2.5, u));
    p.aR1 = G.lerp(p.aR1, -72, back); p.aR2 = G.lerp(p.aR2, -58, back);
    return p;
  };
  POSES.relay = {
    iconU: 2,
    fig: { x: 0.07 },
    pose: relayMain,
    second: relaySecond, secondX: [0.24, 0],
    back: (ctx, J, u, C) => { dashes(ctx, 0.46, u, 0.9, C, 0.42); },
    front: (ctx, J, u, C) => {
      // 交棒：2 拍前在后一棒手里，之后到前一棒手里
      const J2 = G.joints(relaySecond(u));
      const h2 = [J2.aR[2][0] + 0.24, J2.aR[2][1]];
      const h1 = J.aR[2];
      const t = G.E.io(G.inv(1.92, 2.08, u));
      const c = [G.lerp(h1[0], h2[0], t), G.lerp(h1[1], h2[1], t)];
      G.seg(ctx, [c[0] - 0.07, c[1] + 0.012], [c[0] + 0.07, c[1] - 0.012], 0.04, C.acc);
    },
  };

  // ───────── 中长跑：两人成团，步频不变、幅度收小 ─────────
  POSES.distance = {
    iconU: 0.25,
    fig: { x: 0.18 },
    pose: (u) => ({ ...G.runCycle(u, 0.72, { lean: 8 }), head: -2 }),
    second: (u) => ({ ...G.runCycle(u + 0.5, 0.72, { lean: 8 }), head: -2 }),
    secondX: [-0.46, 0.0],
    back: (ctx, J, u, C) => {
      dashes(ctx, 0.46, u, 0.7, C, 0.5);
      P.ground(ctx, 0.46, C, -1.6, 1.6);
    },
  };

  // ───────── 障碍跑：踩上障碍架，跳进水池 ─────────
  const steepleKeys = [
    { b: 0.75, torso: 16, y: -0.1, lR1: 45, lR2: -35, lL1: -35, lL2: -100, aR1: -35, aR2: 25, aL1: 55, aL2: 110 },
    { b: 1.0, torso: 22, y: -0.22, lR1: 62, lR2: -8, lL1: -40, lL2: -105, aR1: -45, aR2: 5, aL1: 70, aL2: 110, e: 'o3' },
    { b: 1.55, torso: 16, y: -0.2, lR1: -40, lR2: -70, lL1: 70, lL2: 30, aR1: 60, aR2: 100, aL1: -40, aL2: 0 },
    { b: 2.0, torso: 24, y: 0.03, lR1: -45, lR2: -105, lL1: 32, lL2: 8, aR1: 40, aR2: 90, aL1: -55, aL2: -10, e: 'i3' },
    { b: 2.5, torso: 18, y: -0.02, ...(() => { const r = G.runCycle(0.25, 1, { lean: 16 }); delete r.torso; delete r.y; return r; })() },
  ];
  POSES.steeple = {
    iconU: 1.0,
    pose: (u) => {
      u = mod(u, 4);
      if (u < 0.75) return runInto(u, u * 1.33 - 0.75, 1, 14, steepleKeys[0], 0.35, 0.75);
      if (u < 2.5) return G.keyPose(steepleKeys, u);
      return runInto(u, u - 2.25, 1, 14, G.runCycle(u - 2.25, 1, { lean: 14 }), 0, 1);
    },
    back: (ctx, J, u, C) => {
      u = mod(u, 4);
      const x = (1 - u) * 0.85 + 0.12; // u=1 时障碍架在前脚下
      // 水池
      ctx.fillStyle = C.line; ctx.fillRect(x + 0.18, 0.47, 1.0, 0.1);
      ctx.strokeStyle = C.acc; ctx.lineWidth = 0.012;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + 0.28 + i * 0.16, 0.5, 0.06, Math.PI, 0); ctx.stroke(); }
      P.ground(ctx, 0.46, C, -1.6, x + 0.18); P.ground(ctx, 0.46, C, x + 1.18, 1.8);
      // 障碍架：粗横梁 + 两腿
      ctx.fillStyle = C.acc;
      ctx.fillRect(x - 0.24, 0.13, 0.48, 0.07);
      ctx.fillRect(x - 0.2, 0.2, 0.035, 0.26); ctx.fillRect(x + 0.165, 0.2, 0.035, 0.26);
    },
    front: (ctx, J, u, C) => {
      u = mod(u, 4);
      const t = u - 2;
      if (t < 0 || t > 0.9) return;
      const x0 = (1 - u) * 0.85 + 0.12 + 0; // 落水点跟着水池走
      const fx = J.lL[2][0];
      ctx.save(); ctx.globalAlpha = 1 - t / 0.9;
      for (let i = 0; i < 7; i++) {
        const a = (-150 + i * 20) * G.D2R;
        const p = fly([fx, 0.46], [Math.cos(a) * 0.55, -0.7 - (i % 3) * 0.12], 2.6, t);
        G.disc(ctx, p[0], Math.min(p[1], 0.47), 0.022 - i * 0.001, C.acc);
      }
      ctx.restore();
    },
  };

  // ───────── 马拉松：放松的步子，4 拍 3 个步态循环；公里牌掠过 ─────────
  POSES.marathon = {
    iconU: 1.0,
    pose: (u) => {
      const p = G.runCycle(u * 0.75, 0.58, { lean: 7 });
      p.aR2 = p.aR1 + 100; p.aL2 = p.aL1 + 100; p.head = 2;
      return p;
    },
    back: (ctx, J, u, C) => {
      // 路面中线
      ctx.fillStyle = C.line;
      const off = mod(u * 0.55, 0.36);
      for (let x = -1.6 - off; x < 1.6; x += 0.36) ctx.fillRect(x, 0.54, 0.2, 0.018);
      P.ground(ctx, 0.46, C, -1.6, 1.6);
      // 公里牌
      const x = 1.25 - mod(u, 4) * 0.62;
      ctx.fillStyle = C.line; ctx.fillRect(x - 0.008, -0.2, 0.016, 0.66);
      G.disc(ctx, x, -0.26, 0.09, C.acc);
      G.disc(ctx, x, -0.26, 0.05, C.bg);
    },
  };

  // ───────── 竞走：前腿伸直、屈臂摆动，每拍一步 ─────────
  POSES.walk = {
    iconU: 0.5,
    pose: (u) => {
      const ph = u / 2, s = Math.sin(ph * Math.PI * 2), c = Math.cos(ph * Math.PI * 2);
      const lR1 = 30 * s, lL1 = -30 * s;
      return {
        torso: 3, head: -2, y: 0.028 * s * s - 0.012,
        lR1, lR2: lR1 - 50 * Math.pow(Math.max(0, c), 2),
        lL1, lL2: lL1 - 50 * Math.pow(Math.max(0, -c), 2),
        aR1: -42 * s, aR2: -42 * s + 96, aL1: 42 * s, aL2: 42 * s + 96,
      };
    },
    back: (ctx, J, u, C) => { dashes(ctx, 0.46, u, 0.45, C, 0.5); P.ground(ctx, 0.46, C, -1.6, 1.6); },
  };

  // ───────── 跳高：背越式。第 1 拍起跳，第 2 拍过杆，第 3 拍落垫 ─────────
  // 起跳时转身 180°（2D 里就是镜像），所以腾空段在 front() 里画一个镜像人形，主人形移出画面。
  const HJ_SWITCH = 1.1;
  const hjTake = { b: 1.0, x: -0.28, y: -0.08, torso: -8, head: -6, lR1: 82, lR2: 2, lL1: -8, lL2: -14, aR1: 150, aR2: 168, aL1: 138, aL2: 158 };
  // 镜像人形的姿势（未镜像的值；x 为世界坐标，画的时候取负）
  const hjAir = [
    { b: HJ_SWITCH, X: -0.22, y: -0.16, rot: -18, torso: -6, head: -8, lR1: 60, lR2: 0, lL1: -6, lL2: -12, aR1: 150, aR2: 165, aL1: 140, aL2: 155 },
    { b: 1.55, X: -0.04, y: -0.5, rot: -62, torso: -18, head: -14, lR1: 20, lR2: -30, lL1: 10, lL2: -40, aR1: 40, aR2: 50, aL1: 30, aL2: 40, e: 'o2' },
    { b: 2.0, X: 0.12, y: -0.64, rot: -90, torso: -28, head: -22, lR1: -30, lR2: -112, lL1: -24, lL2: -104, aR1: 12, aR2: 22, aL1: 4, aL2: 14 },
    { b: 2.55, X: 0.3, y: -0.34, rot: -122, torso: -8, head: -6, lR1: 30, lR2: 20, lL1: 22, lL2: 12, aR1: 60, aR2: 70, aL1: 50, aL2: 60, e: 'i3' },
    { b: 3.0, X: 0.42, y: 0.07, rot: -96, torso: 0, head: 8, lR1: 72, lR2: 30, lL1: 62, lL2: 18, aR1: 70, aR2: 80, aL1: 60, aL2: 70, e: 'o3' },
    { b: 4.0, X: 0.44, y: 0.08, rot: -92, torso: 4, head: 10, lR1: 40, lR2: -10, lL1: 30, lL2: -20, aR1: 30, aR2: 40, aL1: 20, aL2: 30 },
  ];
  const HJ_BAR = [0.12, -0.52];
  POSES.highjump = {
    iconU: 2.0,
    pose: (u) => {
      u = mod(u, 4);
      if (u >= HJ_SWITCH) return { x: 100 };
      if (u < 1) {
        const x = G.lerp(-0.78, -0.28, u);
        return { ...runInto(u, u * 1.4, 1, 10, hjTake, 0.62, 1.0), x };
      }
      return hjTake;
    },
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -1.6, 1.6);
      // 海绵垫
      ctx.fillStyle = C.line; ctx.fillRect(0.06, 0.22, 0.8, 0.24);
      ctx.fillStyle = C.acc; ctx.fillRect(0.06, 0.22, 0.8, 0.03);
      // 立柱 + 横杆端头
      ctx.fillStyle = C.line; ctx.fillRect(HJ_BAR[0] - 0.008, HJ_BAR[1] - 0.06, 0.016, 0.46 - HJ_BAR[1] + 0.06);
      G.seg(ctx, [HJ_BAR[0] - 0.16, HJ_BAR[1] + 0.02], [HJ_BAR[0] + 0.16, HJ_BAR[1] - 0.02], 0.022, C.acc);
    },
    front: (ctx, J, u, C) => {
      u = mod(u, 4);
      if (u < HJ_SWITCH) return;
      const k = G.keyPose(hjAir, u);
      const p = { ...k, x: -k.X };
      ctx.save(); ctx.scale(-1, 1);
      G.drawFigure(ctx, G.joints(p), C.fg, C.far);
      ctx.restore();
    },
  };

  // ───────── 撑竿跳高：第 1 拍插斗，第 2 拍倒立，第 3 拍过杆 ─────────
  const PV_BOX = [0.02, 0.46];
  const pvKeys = [
    { b: 1.0, x: -0.5, y: -0.06, torso: 4, head: -4, lR1: 82, lR2: -6, lL1: -22, lL2: -30, aR1: 168, aR2: 172, aL1: 132, aL2: 146 },
    { b: 1.45, x: -0.42, y: -0.3, rot: -30, torso: 0, head: -6, lR1: 70, lR2: 20, lL1: -10, lL2: -40, aR1: 172, aR2: 176, aL1: 160, aL2: 170, e: 'o2' },
    { b: 1.9, x: -0.28, y: -0.62, rot: -95, torso: 0, head: -4, lR1: 110, lR2: 100, lL1: 104, lL2: 94, aR1: 176, aR2: 178, aL1: 168, aL2: 174 },
    { b: 2.5, x: -0.1, y: -1.02, rot: -176, torso: 0, head: 0, lR1: 4, lR2: 2, lL1: 0, lL2: -2, aR1: 178, aR2: 180, aL1: 172, aL2: 176, e: 'io' },
    { b: 3.0, x: 0.06, y: -1.18, rot: -112, torso: -18, head: -18, lR1: -30, lR2: -40, lL1: -24, lL2: -34, aR1: 120, aR2: 130, aL1: 110, aL2: 120, e: 'o2' },
    { b: 3.55, x: 0.32, y: -0.45, rot: -100, torso: -6, head: 0, lR1: 40, lR2: 30, lL1: 30, lL2: 20, aR1: 150, aR2: 160, aL1: 140, aL2: 150, e: 'i3' },
    { b: 4.0, x: 0.42, y: 0.12, rot: -92, torso: 0, head: 8, lR1: 70, lR2: 30, lL1: 60, lL2: 20, aR1: 80, aR2: 90, aL1: 70, aL2: 80, e: 'o3' },
  ];
  const pvRun = (u) => {
    const p = { ...G.runCycle(u * 1.3, 0.95, { lean: 8 }), x: G.lerp(-1.0, -0.5, u) };
    p.aR1 = 38; p.aR2 = 92; p.aL1 = -20; p.aL2 = 62;
    return p;
  };
  const pvPose = (u) => {
    u = mod(u, 4);
    if (u < 1) return mixP(pvRun(u), pvKeys[0], G.E.io(G.inv(0.7, 1.0, u)));
    return G.keyPose(pvKeys, u);
  };
  const PV_LEN = 1.28;
  POSES.polevault = {
    iconU: 2.5,
    fig: { s: 0.58, y: 0.17, x: 0.08 },
    pose: pvPose,
    back: (ctx, J, u, C) => {
      u = mod(u, 4);
      P.ground(ctx, 0.46, C, -2.0, 2.0);
      // 插斗
      G.poly(ctx, [[PV_BOX[0] - 0.12, 0.46], [PV_BOX[0], 0.52], [PV_BOX[0] + 0.02, 0.46]], C.line);
      // 垫子
      ctx.fillStyle = C.line; ctx.fillRect(0.14, 0.18, 0.9, 0.28);
      ctx.fillStyle = C.acc; ctx.fillRect(0.14, 0.18, 0.9, 0.035);
      // 立柱 + 横杆
      const bx = 0.12, by = -0.95;
      ctx.fillStyle = C.line; ctx.fillRect(bx - 0.01, by - 0.05, 0.02, 0.46 - by + 0.05);
      G.seg(ctx, [bx - 0.2, by + 0.025], [bx + 0.2, by - 0.025], 0.028, C.acc);
    },
    front: (ctx, J, u, C) => {
      u = mod(u, 4);
      const hand = J.aR[2];
      ctx.strokeStyle = C.acc; ctx.lineWidth = 0.032; ctx.lineCap = 'round';
      if (u < 1) {
        // 持竿助跑：竿穿过双手，竿头从上扬降到插斗
        const a = G.lerp(-16, 20, G.E.io(u)) * G.D2R; // 与水平夹角，正 = 向下
        const d = [Math.cos(a), Math.sin(a)];
        ctx.beginPath(); ctx.moveTo(hand[0] - d[0] * 0.35, hand[1] - d[1] * 0.35); ctx.lineTo(hand[0] + d[0] * (PV_LEN - 0.35), hand[1] + d[1] * (PV_LEN - 0.35)); ctx.stroke();
        return;
      }
      let top = hand;
      if (u > 2.85) {
        // 放竿：竿绕插斗往回倒
        const t = G.E.io(G.inv(2.85, 4, u));
        const a = G.lerp(-78, -140, t) * G.D2R;
        top = [PV_BOX[0] + Math.cos(a) * PV_LEN, PV_BOX[1] + Math.sin(a) * PV_LEN];
      }
      const dx = top[0] - PV_BOX[0], dy = top[1] - PV_BOX[1], L = Math.hypot(dx, dy);
      const bend = Math.max(0, PV_LEN - L) * 0.9 + 0.22 * Math.sin(Math.PI * G.clamp((u - 1) / 1.5)) ;
      const mx = (PV_BOX[0] + top[0]) / 2 - (dy / L) * bend, my = (PV_BOX[1] + top[1]) / 2 + (dx / L) * bend;
      ctx.beginPath(); ctx.moveTo(PV_BOX[0], PV_BOX[1]); ctx.quadraticCurveTo(mx, my, top[0], top[1]); ctx.stroke();
    },
  };

  // ───────── 跳远 · 三级跳：第 1 拍踏板，第 3 拍落沙坑 ─────────
  const ljKeys = [
    { b: 1.0, x: -0.4, y: -0.06, torso: 6, head: -4, lL1: -28, lL2: -34, lR1: 86, lR2: 2, aR1: -52, aR2: -20, aL1: 125, aL2: 145 },
    { b: 1.55, x: -0.18, y: -0.34, torso: -8, head: -6, lR1: -8, lR2: -64, lL1: -22, lL2: -86, aR1: 168, aR2: 176, aL1: 158, aL2: 170, e: 'o2' },
    { b: 2.2, x: 0.08, y: -0.26, torso: 40, head: 6, lR1: 98, lR2: 92, lL1: 92, lL2: 86, aR1: 90, aR2: 96, aL1: 84, aL2: 90 },
    { b: 2.8, x: 0.3, y: 0.2, torso: 34, head: 8, lR1: 82, lR2: 66, lL1: 76, lL2: 60, aR1: -60, aR2: -40, aL1: -66, aL2: -48, e: 'i3' },
    { b: 4.0, x: 0.34, y: 0.22, torso: 40, head: 10, lR1: 78, lR2: 50, lL1: 72, lL2: 44, aR1: 10, aR2: 40, aL1: 4, aL2: 34 },
  ];
  POSES.longjump = {
    iconU: 2.2,
    fig: { s: 0.8, y: 0.08, x: -0.02 },
    pose: (u) => {
      u = mod(u, 4);
      if (u < 1) return { ...runInto(u, u * 1.4, 1, 12, ljKeys[0], 0.6, 1.0), x: G.lerp(-0.85, -0.4, u) };
      return G.keyPose(ljKeys, u);
    },
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -1.6, -0.02);
      // 起跳板 + 三级跳的三个脚印
      ctx.fillStyle = C.fg; ctx.fillRect(-0.47, 0.455, 0.1, 0.02);
      for (let i = 0; i < 3; i++) G.disc(ctx, -1.35 + i * 0.28, 0.5, 0.018, C.line);
      // 沙坑
      ctx.fillStyle = C.line; ctx.fillRect(-0.02, 0.46, 0.95, 0.07);
      ctx.fillStyle = C.acc;
      for (let i = 0; i < 9; i++) G.disc(ctx, 0.04 + i * 0.105, 0.47, 0.03, C.acc);
    },
    front: (ctx, J, u, C) => {
      u = mod(u, 4);
      const t = u - 2.8;
      if (t < 0 || t > 1) return;
      ctx.save(); ctx.globalAlpha = 1 - t;
      for (let i = 0; i < 8; i++) {
        const a = (-160 + i * 18) * G.D2R;
        const p = fly([0.52, 0.45], [Math.cos(a) * 0.7, -0.5 - (i % 3) * 0.2], 2.4, t);
        G.disc(ctx, p[0], Math.min(p[1], 0.46), 0.02, C.acc);
      }
      ctx.restore();
    },
  };

  // ───────── 铅球：滑步 → 第 3 拍推出 ─────────
  const shotKeys = [
    { b: 0, x: -0.3, y: 0.1, torso: 55, head: 10, lR1: 62, lR2: -34, lL1: -34, lL2: -46, aR1: -100, aR2: 52, aL1: 70, aL2: 92 },
    { b: 1.0, x: -0.3, y: 0.14, torso: 62, head: 14, lR1: 74, lR2: -50, lL1: 20, lL2: -10, aR1: -100, aR2: 52, aL1: 40, aL2: 70 },
    { b: 1.7, x: -0.1, y: 0.06, torso: 36, head: 6, lR1: -30, lR2: -62, lL1: 50, lL2: 18, aR1: -96, aR2: 54, aL1: 80, aL2: 100, e: 'o3' },
    { b: 2.5, x: -0.04, y: 0.0, torso: 10, head: -4, lR1: -18, lR2: -40, lL1: 36, lL2: 18, aR1: -80, aR2: 70, aL1: 10, aL2: 40 },
    { b: 3.0, x: 0.04, y: -0.12, torso: -14, head: -16, lR1: -14, lR2: -18, lL1: 16, lL2: 10, aR1: 138, aR2: 140, aL1: -70, aL2: -44, e: 'o3' },
    { b: 3.6, x: 0.1, y: -0.02, torso: 30, head: 4, lR1: 30, lR2: -20, lL1: -50, lL2: -80, aR1: 96, aR2: 100, aL1: -40, aL2: -20 },
    { b: 4.0, x: 0.1, y: 0.0, torso: 28, head: 4, lR1: 26, lR2: -16, lL1: -44, lL2: -70, aR1: 70, aR2: 80, aL1: -30, aL2: -10 },
  ];
  const shotPose = (u) => G.keyPose(shotKeys, mod(u, 4));
  const SHOT_REL = G.joints(shotPose(3)).aR[2];
  POSES.shot = {
    iconU: 3.0,
    pose: shotPose,
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -1.6, 1.6);
      // 投掷圈的抵趾板（半圆）
      ctx.fillStyle = C.line; ctx.beginPath(); ctx.arc(0.4, 0.46, 0.08, Math.PI, 0); ctx.fill();
    },
    front: (ctx, J, u, C) => {
      u = mod(u, 4);
      const t = u - 3;
      const p = t < 0 ? J.aR[2] : fly(SHOT_REL, [0.95, -0.9], 1.6, t);
      G.disc(ctx, p[0], p[1], 0.062, C.acc);
      if (t > 0 && t < 0.5) P.speed(ctx, p[0] - 0.08, p[1], 0.3 * (1 - t * 2), 3, C, 0.7);
    },
  };

  // ───────── 铁饼：后引 → 第 3 拍甩出 ─────────
  // 注意：手臂角在躯干坐标系里，世界角 = 局部角 − 躯干前倾
  const discKeys = [
    { b: 0, x: -0.12, y: 0.04, torso: 22, head: 4, lR1: 26, lR2: -14, lL1: -22, lL2: -34, aR1: -46, aR2: -44, aL1: 96, aL2: 110 },
    { b: 1.2, x: -0.16, y: 0.09, torso: 30, head: 6, lR1: 32, lR2: -24, lL1: -28, lL2: -46, aR1: -52, aR2: -50, aL1: 120, aL2: 130 },
    { b: 2.0, x: -0.1, y: 0.07, torso: 26, head: 2, lR1: -24, lR2: -50, lL1: 38, lL2: 12, aR1: -66, aR2: -64, aL1: 90, aL2: 104, e: 'io' },
    { b: 3.0, x: 0.02, y: -0.06, torso: -8, head: -10, lR1: -8, lR2: -12, lL1: 18, lL2: 12, aR1: 84, aR2: 86, aL1: -86, aL2: -70, e: 'iExp' },
    { b: 3.6, x: 0.08, y: 0.0, torso: 24, head: 4, lR1: 20, lR2: -30, lL1: -40, lL2: -70, aR1: 146, aR2: 150, aL1: -40, aL2: -20, e: 'o3' },
    { b: 4.0, x: 0.08, y: 0.02, torso: 22, head: 4, lR1: 18, lR2: -26, lL1: -36, lL2: -64, aR1: 128, aR2: 136, aL1: -30, aL2: -10 },
  ];
  const discPose = (u) => G.keyPose(discKeys, mod(u, 4));
  const DISC_REL = G.joints(discPose(3)).aR[2];
  const discus = (ctx, p, spin, C) => {
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(-0.25);
    ctx.fillStyle = C.acc; ctx.beginPath(); ctx.ellipse(0, 0, 0.075, 0.022 + 0.008 * Math.sin(spin), 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  POSES.discus = {
    iconU: 3.0,
    pose: discPose,
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -1.6, 1.6);
      // 挥臂弧线
      u = mod(u, 4);
      if (u > 2.2 && u < 3.3) {
        const s = J.sho, a = G.clamp((u - 2.2) / 0.8);
        ctx.save(); ctx.globalAlpha = Math.min(1, (3.3 - u) * 3) * 0.8;
        ctx.strokeStyle = C.line; ctx.lineWidth = 0.05; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(s[0], s[1], 0.31, Math.PI * 0.95, Math.PI * (0.95 + 1.05 * a)); ctx.stroke();
        ctx.restore();
      }
    },
    front: (ctx, J, u, C) => {
      u = mod(u, 4);
      const t = u - 3;
      const p = t < 0 ? J.aR[2] : fly(DISC_REL, [1.25, -0.75], 0.9, t);
      discus(ctx, p, u * 20, C);
    },
  };

  // ───────── 链球：三圈加速，第 3 拍出手 ─────────
  const HAM_C = [0, -0.12], HAM_RX = 0.78, HAM_RY = 0.32;
  const HAM_REL = 1.75 * Math.PI; // 出手相位：在身前、向右上方运动
  const hamPhi = (u) => {
    // 3 拍 3 圈，越转越快
    const t = G.clamp(u / 3);
    return HAM_REL - 2 * Math.PI * 3 * (1 - t) * (0.6 + 0.4 * (1 - t));
  };
  const hamHead = (u) => {
    if (u <= 3) { const f = hamPhi(u); return [HAM_C[0] + HAM_RX * Math.cos(f), HAM_C[1] + HAM_RY * Math.sin(f), Math.sin(f)]; }
    const f = HAM_REL, p0 = [HAM_C[0] + HAM_RX * Math.cos(f), HAM_C[1] + HAM_RY * Math.sin(f)];
    return [...fly(p0, [2.4, -1.4], 2.0, u - 3), 1];
  };
  const hamPose = (u) => {
    u = mod(u, 4);
    const f = u <= 3 ? hamPhi(u) : HAM_REL;
    const lean = -14 - 8 * Math.cos(f);
    const base = { x: -0.02, y: 0.05 + 0.02 * Math.sin(f * 2), torso: lean, head: -8, lR1: 18, lR2: -16, lL1: -16, lL2: -34 };
    let aR, aL;
    if (u <= 3) {
      const J0 = G.joints({ ...base });
      const h = hamHead(u);
      const d = [(h[0] - J0.sho[0]) * 0.45 + 0.12, h[1] - J0.sho[1] + 0.25], L = Math.hypot(d[0], d[1]);
      const a = angTo([d[0] / L, d[1] / L], lean);
      aR = [a, a]; aL = [a - 6, a - 6];
    } else {
      const t = G.E.o3((u - 3) / 0.6);
      aR = [G.lerp(angTo([0.95, -0.3], lean), 160, t), G.lerp(angTo([0.95, -0.3], lean), 165, t)];
      aL = [aR[0] - 10, aR[1] - 10];
      base.torso = G.lerp(lean, 6, t); base.lR1 = G.lerp(18, -10, t); base.lL1 = G.lerp(-16, 20, t);
    }
    return { ...base, aR1: aR[0], aR2: aR[1], aL1: aL[0], aL2: aL[1] };
  };
  const drawHammer = (ctx, J, u, C, front) => {
    u = mod(u, 4);
    const h = hamHead(u);
    if ((h[2] > 0) !== front) return;
    let grip = J.aR[2];
    if (u > 3) { const f = HAM_REL, p0 = [HAM_C[0] + HAM_RX * Math.cos(f), HAM_C[1] + HAM_RY * Math.sin(f)]; const d = [h[0] - p0[0], h[1] - p0[1]]; grip = [J.aR[2][0] + d[0], J.aR[2][1] + d[1]]; }
    G.seg(ctx, grip, h, 0.012, C.line);
    G.disc(ctx, h[0], h[1], 0.062, C.acc);
  };
  POSES.hammer = {
    iconU: 2.2,
    pose: hamPose,
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -1.6, 1.6);
      // 旋转轨迹
      if (mod(u, 4) < 3) {
        ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = C.line; ctx.lineWidth = 0.012;
        ctx.beginPath(); ctx.ellipse(HAM_C[0], HAM_C[1], HAM_RX, HAM_RY, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      drawHammer(ctx, J, u, C, false);
    },
    front: (ctx, J, u, C) => drawHammer(ctx, J, u, C, true),
  };

  // ───────── 标枪：持枪助跑 → 引枪 → 第 3 拍鞭打出手 ─────────
  const javCarry = { aR1: -168, aR2: -110 }; // 枪举在肩上方
  const javKeys = [
    { b: 1.3, x: -0.3, y: 0.0, torso: -6, head: -4, lR1: 30, lR2: 10, lL1: -30, lL2: -70, aR1: -120, aR2: -108, aL1: 100, aL2: 120 },
    { b: 2.2, x: -0.2, y: 0.02, torso: -22, head: -8, lR1: 40, lR2: 22, lL1: -32, lL2: -56, aR1: -100, aR2: -96, aL1: 110, aL2: 130 },
    { b: 2.7, x: -0.12, y: 0.0, torso: -18, head: -8, lR1: 36, lR2: 30, lL1: -40, lL2: -70, aR1: -108, aR2: -100, aL1: 70, aL2: 90 },
    { b: 3.0, x: -0.04, y: -0.02, torso: 28, head: 4, lR1: 34, lR2: 30, lL1: -40, lL2: -86, aR1: 158, aR2: 146, aL1: -40, aL2: -20, e: 'iExp' },
    { b: 3.5, x: 0.02, y: 0.02, torso: 46, head: 10, lR1: 30, lR2: 10, lL1: -30, lL2: -90, aR1: 60, aR2: 50, aL1: -60, aL2: -40, e: 'o3' },
    { b: 4.0, x: 0.04, y: 0.02, torso: 40, head: 8, lR1: 24, lR2: 6, lL1: -24, lL2: -80, aR1: 40, aR2: 40, aL1: -40, aL2: -20 },
  ];
  const javPose = (u) => {
    u = mod(u, 4);
    if (u < 1.3) {
      const p = { ...G.runCycle(u * 1.3, 0.9, { lean: 6 }), x: G.lerp(-0.55, -0.3, u / 1.3), ...javCarry };
      return mixP(p, javKeys[0], G.E.io(G.inv(0.9, 1.3, u)));
    }
    return G.keyPose(javKeys, u);
  };
  const JAV_REL = G.joints(javPose(3)).aR[2];
  const javelin = (ctx, grip, ang, C) => {
    const d = [Math.cos(ang), Math.sin(ang)];
    G.seg(ctx, [grip[0] - d[0] * 0.36, grip[1] - d[1] * 0.36], [grip[0] + d[0] * 0.56, grip[1] + d[1] * 0.56], 0.02, C.acc);
    G.seg(ctx, [grip[0] - d[0] * 0.04, grip[1] - d[1] * 0.04], [grip[0] + d[0] * 0.05, grip[1] + d[1] * 0.05], 0.034, C.acc);
  };
  POSES.javelin = {
    iconU: 2.5,
    pose: javPose,
    back: (ctx, J, u, C) => { P.ground(ctx, 0.46, C, -1.6, 1.6); if (mod(u, 4) < 1.3) dashes(ctx, 0.46, u, 0.8, C, 0.4); },
    front: (ctx, J, u, C) => {
      u = mod(u, 4);
      if (u < 3) { javelin(ctx, J.aR[2], G.lerp(-10, -28, G.E.io(G.inv(1.0, 2.2, u))) * G.D2R, C); return; }
      const t = u - 3, v = [1.7, -1.05 + 1.0 * t];
      const p = fly(JAV_REL, [1.7, -1.05], 1.0, t);
      javelin(ctx, p, Math.atan2(v[1], v[0]), C);
    },
  };
})();
