// 水上 7 项：四种泳姿（2 拍卡，2 拍一个完整划水循环）+ 跳水、花样游泳、水球
// 泳姿人形水平：rot = 90 头朝右、俯卧；rot = -90 头朝左、仰卧。
// 此时手臂局部角：180 = 指向头顶方向，90 = 腹侧，0 = 指向脚，-90 = 背侧。
(function () {
  const G = window.G, P = G.P, POSES = window.POSES;
  const mod = (u, L) => ((u % L) + L) % L;
  const TAU = Math.PI * 2;
  const fly = (p0, v, g, t) => [p0[0] + v[0] * t, p0[1] + v[1] * t + 0.5 * g * t * t];

  // 水：back() 里画水下的鳞纹，front() 里盖一层半透明水体 + 水面波峰
  const crests = (ctx, y, u, C, flow) => {
    const k = 0.13, off = mod(u * flow, k);
    ctx.fillStyle = C.line;
    for (let x = -1.8 - off; x < 1.8; x += k) { ctx.beginPath(); ctx.arc(x, y, k * 0.28, Math.PI, 0); ctx.fill(); }
  };
  const waterBack = (ctx, y, u, C, flow = 0.5) => {
    crests(ctx, y, u, C, flow);
    ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = C.line; ctx.lineWidth = 0.01;
    const k = 0.16, off = mod(u * flow * 0.5, k);
    for (let r = 0; r < 4; r++) for (let x = -1.8 - off; x < 1.8; x += k) {
      ctx.beginPath(); ctx.arc(x + (r % 2 ? k / 2 : 0), y + 0.16 + r * 0.1, k * 0.45, Math.PI, 0); ctx.stroke();
    }
    ctx.restore();
  };
  const waterFront = (ctx, y, u, C, o = {}) => {
    ctx.fillStyle = G.rgba(C.bg, o.alpha ?? 0.42);
    ctx.fillRect(-2, y, 4, 2.5);
    ctx.fillStyle = C.line; ctx.fillRect(-2, y - 0.006, 4, 0.012);
    if (o.crests) crests(ctx, y, u, C, o.flow ?? 0.5);
  };
  // 身后的尾流线
  const wake = (ctx, x, y, u, C) => {
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const L = 0.25 + 0.2 * ((i * 37) % 10) / 10;
      const ox = x - mod(u * 0.9 + i * 0.37, 1) * 0.5;
      ctx.globalAlpha = 0.7 * (1 - mod(u * 0.9 + i * 0.37, 1));
      ctx.fillStyle = C.fg; ctx.fillRect(ox - L, y - 0.02 + (i % 2) * 0.03, L, 0.014);
    }
    ctx.restore();
  };
  const flutter = (ph, amp = 11) => {
    const s = Math.sin(TAU * 3 * ph);
    return { lR1: amp * s, lR2: amp * s - 14 * Math.max(0, Math.sin(TAU * 3 * ph + 1)), lL1: -amp * s, lL2: -amp * s - 14 * Math.max(0, Math.sin(TAU * 3 * ph + 1 + Math.PI)) };
  };
  const SURF = 0.03; // 泳姿：身体中线略高于水面，读得清

  // ───────── 自由泳：两臂交替，每拍一臂入水 ─────────
  const freeArm = (a) => {
    a = ((a + 180) % 360 + 360) % 360 - 180; // (-180, 180]
    if (a >= 0) return [a, a + 32 * Math.sin(Math.PI * a / 180)];            // 水下抱水
    return [a, a - 105 * Math.sin(Math.PI * -a / 180)];                     // 空中高肘移臂
  };
  POSES.free = {
    iconU: 0.4,
    pose: (u) => {
      const ph = mod(u, 2) / 2;
      const aN = freeArm(180 - 360 * ph), aF = freeArm(-360 * ph);
      return { rot: 90, x: -0.06, y: 0.0, torso: 0, head: 6, aR1: aN[0], aR2: aN[1], aL1: aF[0], aL2: aF[1], ...flutter(ph) };
    },
    back: (ctx, J, u, C) => waterBack(ctx, SURF, u, C, 1),
    front: (ctx, J, u, C) => { waterFront(ctx, SURF, u, C, { flow: 1 }); wake(ctx, -0.55, SURF, u, C); },
  };

  // ───────── 蛙泳：划手抬头换气 → 收腿 → 蹬夹 → 滑行 ─────────
  const breastKeys = [
    { b: 0, rot: 90, x: -0.04, y: 0.0, torso: 0, head: 0, aR1: 178, aR2: 180, aL1: 172, aL2: 176, lR1: 2, lR2: 0, lL1: -2, lL2: -4 },
    { b: 0.55, rot: 84, x: -0.04, y: -0.04, torso: -20, head: -14, aR1: 116, aR2: 168, aL1: 110, aL2: 162, lR1: 34, lR2: -48, lL1: 30, lL2: -52 },
    { b: 0.95, rot: 86, x: -0.04, y: -0.03, torso: -6, head: -4, aR1: 168, aR2: 176, aL1: 162, aL2: 170, lR1: 72, lR2: -44, lL1: 68, lL2: -48 },
    { b: 1.3, rot: 90, x: -0.04, y: 0.0, torso: 0, head: 2, aR1: 178, aR2: 180, aL1: 172, aL2: 176, lR1: 8, lR2: 2, lL1: 4, lL2: -2, e: 'o3' },
    { b: 2, rot: 90, x: -0.04, y: 0.0, torso: 0, head: 0, aR1: 178, aR2: 180, aL1: 172, aL2: 176, lR1: 2, lR2: 0, lL1: -2, lL2: -4 },
  ];
  POSES.breast = {
    iconU: 0.55,
    pose: (u) => G.keyPose(breastKeys, mod(u, 2)),
    back: (ctx, J, u, C) => waterBack(ctx, SURF, u, C, 0.6),
    front: (ctx, J, u, C) => {
      waterFront(ctx, SURF, u, C, { flow: 0.6 });
      const t = mod(u, 2);
      if (t > 1.2 && t < 2) wake(ctx, -0.5, SURF, u, C);
    },
  };

  // ───────── 仰泳：头朝左仰卧，直臂出水 ─────────
  const backArm = (a) => {
    a = ((a % 360) + 360) % 360;
    if (a <= 180) return [a, a];                                            // 空中直臂
    return [a, a + 55 * Math.sin(Math.PI * (a - 180) / 180)];               // 水下屈臂推水
  };
  POSES.back = {
    iconU: 0.5,
    pose: (u) => {
      const ph = mod(u, 2) / 2;
      const aN = backArm(360 * ph + 90), aF = backArm(360 * ph + 270);
      const f = flutter(ph, 10);
      return { rot: -90, x: 0.06, y: 0.0, torso: 0, head: -6, aR1: aN[0], aR2: aN[1], aL1: aF[0], aL2: aF[1], lR1: f.lR1, lR2: f.lR1 + 10 * Math.max(0, Math.sin(TAU * 3 * ph + 1)), lL1: f.lL1, lL2: f.lL1 + 10 * Math.max(0, Math.sin(TAU * 3 * ph + 1 + Math.PI)) };
    },
    back: (ctx, J, u, C) => waterBack(ctx, SURF, -u, C, 1),
    front: (ctx, J, u, C) => {
      waterFront(ctx, SURF, -u, C, { flow: 1 });
      ctx.save(); ctx.scale(-1, 1); wake(ctx, -0.55, SURF, u, C); ctx.restore();
    },
  };

  // ───────── 蝶泳：双臂同时，身体波浪起伏 ─────────
  POSES.fly = {
    iconU: 1.5,
    pose: (u) => {
      const ph = mod(u, 2) / 2;
      let a = freeArm(180 - 360 * ph);
      if (a[0] < 0) a = [a[0], a[0] + 10];
      const s = Math.sin(TAU * ph), k = Math.sin(TAU * 2 * ph);
      return {
        rot: 90 + 9 * s, x: -0.06, y: -0.06 * Math.max(0, -s), torso: -14 * Math.max(0, -Math.sin(TAU * ph + 0.3)), head: -6 * Math.max(0, -s),
        aR1: a[0], aR2: a[1], aL1: a[0] - 8, aL2: a[1] - 8,
        lR1: 18 * k, lR2: 18 * k - 34 * Math.max(0, Math.sin(TAU * 2 * ph + 1.2)), lL1: 18 * k - 4, lL2: 18 * k - 4 - 34 * Math.max(0, Math.sin(TAU * 2 * ph + 1.2)),
      };
    },
    back: (ctx, J, u, C) => waterBack(ctx, SURF, u, C, 0.9),
    front: (ctx, J, u, C) => { waterFront(ctx, SURF, u, C, { flow: 0.9 }); wake(ctx, -0.55, SURF, u, C); },
  };

  // ───────── 跳水：第 1 拍起跳，空中抱膝翻转一周半，第 3 拍垂直入水 ─────────
  const DV_SURF = 0.55, DV_BOARD = -0.415;
  const dvKeys = [
    { b: 0, x: -0.8, y: -0.865, torso: 0, head: 0, aR1: 4, aR2: 6, aL1: -4, aL2: -2, lR1: 2, lR2: 2, lL1: -2, lL2: -2 },
    { b: 0.55, x: -0.8, y: -0.9, torso: -2, head: -6, aR1: 176, aR2: 178, aL1: 170, aL2: 174, lR1: 2, lR2: 0, lL1: -2, lL2: -4 },
    { b: 0.85, x: -0.8, y: -0.79, torso: 22, head: 0, aR1: -48, aR2: -40, aL1: -54, aL2: -46, lR1: 58, lR2: -44, lL1: 54, lL2: -48, e: 'io' },
    { b: 1.0, x: -0.76, y: -0.98, torso: 0, head: -4, aR1: 178, aR2: 180, aL1: 172, aL2: 176, lR1: 2, lR2: 0, lL1: -4, lL2: -6, e: 'o3' },
    { b: 1.3, x: -0.62, y: -1.15, rot: 80, torso: 16, head: 10, aR1: 96, aR2: 158, aL1: 92, aL2: 152, lR1: 124, lR2: -14, lL1: 118, lL2: -20, e: 'o2' },
    { b: 1.9, x: -0.42, y: -1.1, rot: 300, torso: 16, head: 10, aR1: 96, aR2: 158, aL1: 92, aL2: 152, lR1: 124, lR2: -14, lL1: 118, lL2: -20, e: 'lin' },
    { b: 2.35, x: -0.24, y: -0.75, rot: 450, torso: 0, head: 0, aR1: 178, aR2: 180, aL1: 176, aL2: 178, lR1: 2, lR2: 0, lL1: -2, lL2: -2, e: 'lin' },
    { b: 3.0, x: -0.12, y: -0.035, rot: 540, torso: 0, head: 0, aR1: 180, aR2: 180, aL1: 178, aL2: 178, lR1: 0, lR2: 0, lL1: -1, lL2: -1, e: 'i3' },
    { b: 3.5, x: -0.12, y: 1.1, rot: 540, torso: 0, head: 0, aR1: 180, aR2: 180, aL1: 178, aL2: 178, lR1: 0, lR2: 0, lL1: -1, lL2: -1, e: 'lin' },
    { b: 4.0, x: -0.12, y: 1.6, rot: 540 },
  ];
  POSES.diving = {
    iconU: 1.6,
    fig: { s: 0.6, y: 0.15, x: 0.12 },
    pose: (u) => G.keyPose(dvKeys, mod(u, 4)),
    back: (ctx, J, u, C) => {
      // 跳台 + 支柱
      ctx.fillStyle = C.line; ctx.fillRect(-1.42, DV_BOARD + 0.05, 0.1, DV_SURF - DV_BOARD);
      ctx.fillStyle = C.acc; ctx.fillRect(-1.55, DV_BOARD, 0.86, 0.06);
      waterBack(ctx, DV_SURF, u, C, 0.3);
    },
    front: (ctx, J, u, C) => {
      u = mod(u, 4);
      // 水体：入水后完全遮住人形（渐隐横条是官方图形里的元素）
      ctx.fillStyle = C.bg; ctx.fillRect(-2, DV_SURF, 4, 2);
      ctx.fillStyle = C.line;
      for (let i = 0; i < 6; i++) { ctx.globalAlpha = 1 - i / 6; ctx.fillRect(-1.6, DV_SURF + 0.04 + i * 0.07, 3.2, 0.018); }
      ctx.globalAlpha = 1;
      ctx.fillRect(-2, DV_SURF - 0.008, 4, 0.016);
      // 入水：竖直水花 + 扩散涟漪
      const t = u - 3.0;
      if (t > 0 && t < 1) {
        const x = -0.12;
        ctx.save(); ctx.globalAlpha = 1 - t;
        for (let i = 0; i < 7; i++) {
          const vx = (i - 3) * 0.1, p = fly([x, DV_SURF], [vx, -1.6 - (3 - Math.abs(i - 3)) * 0.35], 5, t);
          G.disc(ctx, p[0], Math.min(p[1], DV_SURF), 0.03, C.acc);
        }
        ctx.strokeStyle = C.fg; ctx.lineWidth = 0.02;
        for (let r = 0; r < 2; r++) { const k = G.E.o3(G.clamp(t * 1.4 - r * 0.2)); ctx.beginPath(); ctx.ellipse(x, DV_SURF, 0.1 + 0.55 * k, 0.03 + 0.07 * k, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
      }
    },
  };

  // ───────── 花样游泳（双人镜像）：第 1 拍托举出水 V 字，第 3 拍倒立举腿 ─────────
  const AS_SURF = 0.1;
  const asKeys = [
    { b: 0, x: -0.26, y: 0.42, torso: 0, head: 0, aR1: 62, aR2: 84, aL1: 54, aL2: 74, lR1: 56, lR2: -30, lL1: 36, lL2: -52 },
    { b: 1.0, x: -0.26, y: 0.08, torso: -4, head: -14, aR1: 154, aR2: 160, aL1: 144, aL2: 150, lR1: 4, lR2: 0, lL1: -4, lL2: -6, e: 'o3' },
    { b: 1.6, x: -0.26, y: 0.6, torso: 0, head: 0, aR1: 172, aR2: 176, aL1: 168, aL2: 172, lR1: 0, lR2: 0, lL1: 0, lL2: 0, e: 'i3' },
    { b: 2.1, x: -0.26, y: 0.66, rot: 180, torso: 0, head: 0, aR1: 176, aR2: 178, aL1: 172, aL2: 176, lR1: 2, lR2: 2, lL1: -2, lL2: -2 },
    { b: 3.0, x: -0.26, y: 0.13, rot: 180, torso: 0, head: 0, aR1: 150, aR2: 170, aL1: 140, aL2: 160, lR1: 0, lR2: 0, lL1: 88, lL2: 90, e: 'o3' },
    { b: 3.5, x: -0.26, y: 0.1, rot: 180, torso: 0, head: 0, aR1: 150, aR2: 170, aL1: 140, aL2: 160, lR1: 0, lR2: 0, lL1: 2, lL2: 2 },
    { b: 4.0, x: -0.26, y: 0.1, rot: 180, torso: 0, head: 0, aR1: 150, aR2: 170, aL1: 140, aL2: 160, lR1: 0, lR2: 0, lL1: 2, lL2: 2 },
  ];
  const asPose = (u) => G.keyPose(asKeys, mod(u, 4));
  POSES.artistic = {
    iconU: 3.6,
    pose: asPose,
    second: asPose, secondX: [0, 0], secondFace: -1,
    back: (ctx, J, u, C) => waterBack(ctx, AS_SURF, u, C, 0.2),
    front: (ctx, J, u, C) => {
      waterFront(ctx, AS_SURF, u, C, { flow: 0.2, alpha: 0.7 });
      // 托举 / 举腿瞬间的水花
      const t = mod(u, 4);
      for (const [t0, xs] of [[1.0, [-0.26, 0.26]], [3.0, [-0.26, 0.26]]]) {
        const k = t - t0 + 0.15;
        if (k < 0 || k > 0.7) continue;
        ctx.save(); ctx.globalAlpha = 1 - k / 0.7;
        for (const x of xs) for (let i = 0; i < 5; i++) {
          const p = fly([x, AS_SURF], [(i - 2) * 0.25, -0.8 - (2 - Math.abs(i - 2)) * 0.2], 4, k);
          G.disc(ctx, p[0], Math.min(p[1], AS_SURF), 0.022, C.acc);
        }
        ctx.restore();
      }
    },
  };

  // ───────── 水球：踩水 → 引球 → 第 2 拍射门 ─────────
  const WP_SURF = -0.04;
  const eggbeater = (u) => ({ lR1: 56 + 14 * Math.sin(TAU * u), lR2: -30 + 22 * Math.sin(TAU * u + 1), lL1: 50 - 14 * Math.sin(TAU * u), lL2: -40 - 22 * Math.sin(TAU * u + 1) });
  const wpKeys = [
    { b: 0, x: -0.2, y: 0.24, torso: 10, head: -2, aR1: 190, aR2: 226, aL1: 78, aL2: 88 },
    { b: 1.4, x: -0.22, y: 0.12, torso: -6, head: -6, aR1: 204, aR2: 252, aL1: 86, aL2: 92 },
    { b: 2.0, x: -0.16, y: 0.15, torso: 22, head: 0, aR1: 132, aR2: 130, aL1: 40, aL2: 60, e: 'iExp' },
    { b: 2.5, x: -0.14, y: 0.18, torso: 30, head: 4, aR1: 72, aR2: 74, aL1: 30, aL2: 50, e: 'o3' },
    { b: 3.3, x: -0.16, y: 0.24, torso: 12, head: -4, aR1: 150, aR2: 160, aL1: 70, aL2: 84 },
    { b: 4.0, x: -0.18, y: 0.24, torso: 10, head: -4, aR1: 172, aR2: 190, aL1: 76, aL2: 88 },
  ];
  const wpPose = (u) => ({ ...G.keyPose(wpKeys, mod(u, 4)), ...eggbeater(u) });
  const WP_REL = G.joints(wpPose(2)).aR[2];
  const wpBall = (ctx, p, C) => {
    G.disc(ctx, p[0], p[1], 0.064, C.acc);
    ctx.strokeStyle = C.bg; ctx.lineWidth = 0.01;
    ctx.beginPath(); ctx.arc(p[0] - 0.09, p[1], 0.09, -0.6, 0.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(p[0] + 0.09, p[1], 0.09, Math.PI - 0.6, Math.PI + 0.6); ctx.stroke();
  };
  POSES.waterpolo = {
    iconU: 1.4,
    pose: wpPose,
    back: (ctx, J, u, C) => {
      // 球门：门柱 + 横梁 + 网格
      ctx.fillStyle = C.fg; ctx.fillRect(0.6, -0.44, 0.03, 0.42); ctx.fillRect(0.6, -0.44, 0.5, 0.03);
      ctx.strokeStyle = C.line; ctx.lineWidth = 0.008;
      for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0.63 + i * 0.07, -0.41); ctx.lineTo(0.63 + i * 0.07 + 0.05, WP_SURF); ctx.stroke(); }
      for (let j = 1; j < 5; j++) { ctx.beginPath(); ctx.moveTo(0.63, -0.41 + j * 0.08); ctx.lineTo(1.1, -0.41 + j * 0.08); ctx.stroke(); }
      waterBack(ctx, WP_SURF, u, C, 0.2);
    },
    front: (ctx, J, u, C) => {
      const t = mod(u, 4) - 2;
      waterFront(ctx, WP_SURF, u, C, { flow: 0.2, alpha: 0.62 });
      if (t < 0) wpBall(ctx, J.aR[2], C);
      else if (t < 0.55) wpBall(ctx, fly(WP_REL, [1.1, 0.1], 0.6, t), C);
      else { // 入网后落在网里
        const p = fly(WP_REL, [1.1, 0.1], 0.6, 0.55);
        wpBall(ctx, [p[0] + (t - 0.55) * 0.08, Math.min(WP_SURF - 0.07, p[1] + (t - 0.55) * 0.6)], C);
      }
    },
  };
})();
