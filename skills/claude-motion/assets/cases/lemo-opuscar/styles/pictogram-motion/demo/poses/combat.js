// 格斗 9 项：judo karate taekwondo boxing wrestling fencing jujitsu kurash mma
(function () {
  const G = window.G, P = G.P, POSES = window.POSES;
  // 用「世界角」写手臂/腿（0 = 竖直向下，90 = 水平向前，180 = 竖直向上），这里换算成骨架约定
  // body: true 的关键帧直接按骨架约定（相对身体）写，适合翻滚 / 躺地
  const WA = (p) => {
    if (p.body) return { ...p };
    const o = { ...p }, f = (p.rot || 0) + (p.torso || 0), r = p.rot || 0;
    for (const k of ['aR1', 'aR2', 'aL1', 'aL2']) if (k in o) o[k] += f;
    for (const k of ['lR1', 'lR2', 'lL1', 'lL2']) if (k in o) o[k] += r;
    return o;
  };
  const K = (arr) => arr.map(WA);
  const kp = (keys) => { const k = K(keys); return (u) => G.keyPose(k, u); };
  // 冲击：从 p 点放射短线，t 0→1
  const burst = (ctx, p, t, C, r0 = 0.05, n = 7, col) => {
    if (t <= 0 || t >= 1) return;
    const e = G.E.o3(t);
    ctx.save(); ctx.globalAlpha *= 1 - t;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.3;
      const r1 = r0 + e * 0.1, r2 = r0 + e * 0.2;
      G.seg(ctx, [p[0] + Math.cos(a) * r1, p[1] + Math.sin(a) * r1], [p[0] + Math.cos(a) * r2, p[1] + Math.sin(a) * r2], 0.014, col || C.acc);
    }
    ctx.restore();
  };
  // 腰带：横在髋部上方，垂直于躯干
  const belt = (ctx, J, col, tails) => {
    const up = J.up, pr = [-up[1], up[0]];
    const c = [J.hip[0] + up[0] * 0.035, J.hip[1] + up[1] * 0.035];
    G.seg(ctx, [c[0] - pr[0] * 0.07, c[1] - pr[1] * 0.07], [c[0] + pr[0] * 0.07, c[1] + pr[1] * 0.07], 0.034, col);
    if (tails) {
      const k = [c[0] + pr[0] * 0.05, c[1] + pr[1] * 0.05];
      G.seg(ctx, k, [k[0] + 0.035, k[1] + 0.1], 0.02, col);
      G.seg(ctx, k, [k[0] + 0.065, k[1] + 0.085], 0.02, col);
    }
  };
  // 第二人（镜像）关节 → 主画布坐标
  const J2 = (def, u) => {
    const J = G.joints(def.second(u)), o = def.secondX || [0, 0], f = def.secondFace === -1 ? -1 : 1;
    const m = (p) => [o[0] + f * p[0], o[1] + p[1]];
    return { J, m, up: [f * J.up[0], J.up[1]], hip: m(J.hip), hR: m(J.aR[2]), hL: m(J.aL[2]), head: m(J.head) };
  };

  // ── 柔道：一本背负投。第 2 拍对手翻过肩背，第 3 拍背着地 ──
  const judo = {
    pose: kp([
      { b: 0, torso: 8, aR1: 60, aR2: 85, aL1: 50, aL2: 95, lR1: 12, lR2: 4, lL1: -14, lL2: -14 },
      { b: 0.9, y: 0.08, torso: 32, aR1: 55, aR2: 120, aL1: 40, aL2: 110, lR1: 35, lR2: -22, lL1: 20, lL2: -30 },
      { b: 2, y: 0.11, torso: 78, aR1: 35, aR2: 10, aL1: 20, aL2: -5, lR1: 32, lR2: -18, lL1: -8, lL2: -25, e: 'io3' },
      { b: 3, y: 0.06, torso: 58, aR1: 20, aR2: 5, aL1: 10, aL2: -10, lR1: 28, lR2: -12, lL1: -12, lL2: -22, e: 'o3' },
    ]),
    second: kp([
      { b: 0, torso: 8, aR1: 60, aR2: 85, aL1: 50, aL2: 95, lR1: 12, lR2: 4, lL1: -14, lL2: -14 },
      { b: 0.9, x: 0.12, y: -0.02, rot: 12, torso: 28, aR1: 70, aR2: 90, aL1: 60, aL2: 80, lR1: -10, lR2: -18, lL1: -25, lL2: -30 },
      { b: 1.6, body: true, x: 0.3, y: -0.46, rot: 120, torso: 10, aR1: 30, aR2: 30, aL1: 10, aL2: 10, lR1: -10, lR2: -10, lL1: -20, lL2: -20 },
      { b: 2.2, body: true, x: 0.58, y: -0.3, rot: 215, torso: 0, aR1: 60, aR2: 60, aL1: 40, aL2: 40, lR1: -5, lR2: -5, lL1: -15, lL2: -15, e: 'lin' },
      { b: 2.8, body: true, x: 0.82, y: 0.37, rot: 270, torso: 0, aR1: 140, aR2: 160, aL1: 110, aL2: 130, lR1: 30, lR2: 10, lL1: 12, lL2: 2, e: 'o3' },
      { b: 3.3, body: true, x: 0.84, y: 0.37, rot: 270, torso: 0, aR1: 150, aR2: 170, aL1: 115, aL2: 135, lR1: 45, lR2: 8, lL1: 20, lL2: 0, e: 'o3' },
    ]),
    secondX: [0.36, 0], secondFace: -1,
    fig: { s: 0.82, x: 0.26 },
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -1.1, 0.8);
      // 着地冲击波
      const t = (u - 2.8) / 0.8;
      if (t > 0 && t < 1) { ctx.save(); ctx.globalAlpha *= 1 - t; ctx.fillStyle = C.acc; const w = 0.2 + G.E.o3(t) * 0.6; ctx.fillRect(-0.48 - w / 2, 0.475, w, 0.018); ctx.restore(); }
    },
    iconU: 1.9,
  };
  POSES.judo = judo;

  // ── 空手道：型。反击拳 → 前踢 → 换手拳，动作干脆、定住 ──
  const kA = { torso: 4, aR1: 90, aR2: 90, aL1: -40, aL2: 80, lR1: 42, lR2: 0, lL1: -32, lL2: -30, y: 0.06 };
  const kB = { torso: -6, aR1: 20, aR2: 150, aL1: 40, aL2: 140, lR1: 100, lR2: 96, lL1: -6, lL2: -6, y: -0.02 };
  const kC = { torso: 4, aR1: -40, aR2: 80, aL1: 90, aL2: 90, lR1: 42, lR2: 0, lL1: -32, lL2: -30, y: 0.06 };
  POSES.karate = {
    pose: kp([
      { b: 0, ...kA, aR1: 30, aR2: 60 },
      { b: 0.22, ...kA, e: 'oExp' },
      { b: 1.7, ...kA },
      { b: 1.82, torso: 0, aR1: 25, aR2: 150, aL1: 35, aL2: 140, lR1: 60, lR2: -30, lL1: -8, lL2: -8, y: 0 },
      { b: 2, ...kB, e: 'oExp' },
      { b: 2.5, ...kB },
      { b: 2.75, ...kC, aL1: 30, aL2: 60, e: 'o3' },
      { b: 3, ...kC, e: 'oExp' },
    ]),
    back: (ctx, J, u, C) => P.ground(ctx, 0.46, C, -0.9, 0.9),
    front: (ctx, J, u, C) => {
      belt(ctx, J, C.acc, true);
      burst(ctx, J.aR[2], (u - 0.22) / 0.5, C, 0.05, 6);
      burst(ctx, J.lR[2], (u - 2) / 0.5, C, 0.05, 6);
      burst(ctx, J.aL[2], (u - 3) / 0.5, C, 0.05, 6);
    },
    iconU: 2.2,
  };

  // ── 跆拳道：高位横踢（护头 + 护具）──
  const tStance = { y: 0.03, torso: 6, aR1: 20, aR2: 110, aL1: 35, aL2: 120, lR1: 26, lR2: 8, lL1: -24, lL2: -28 };
  POSES.taekwondo = {
    pose: kp([
      { b: 0, ...tStance },
      { b: 0.5, ...tStance, y: 0.0 },
      { b: 1, ...tStance, y: 0.05 },
      { b: 1.5, y: 0, torso: -8, aR1: 10, aR2: 100, aL1: 40, aL2: 120, lR1: 115, lR2: 0, lL1: -4, lL2: -8, e: 'o3' },
      { b: 2, y: -0.03, torso: -42, aR1: -40, aR2: -20, aL1: 60, aL2: 120, lR1: 150, lR2: 152, lL1: -10, lL2: -12, e: 'oExp' },
      { b: 2.6, y: -0.02, torso: -38, aR1: -35, aR2: -15, aL1: 60, aL2: 120, lR1: 146, lR2: 148, lL1: -10, lL2: -12 },
      { b: 3.1, y: 0.02, torso: -5, aR1: 10, aR2: 100, aL1: 40, aL2: 120, lR1: 100, lR2: 0, lL1: -6, lL2: -10, e: 'io' },
      { b: 3.6, ...tStance, e: 'o3' },
    ]),
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -0.9, 0.9);
      // 脚的轨迹弧
      const t = G.clamp((u - 1.5) / 0.5), fade = 1 - G.clamp((u - 2.1) / 0.8);
      if (t > 0 && fade > 0) {
        ctx.save(); ctx.globalAlpha *= fade * 0.9;
        ctx.strokeStyle = C.line; ctx.lineWidth = 0.02; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(J.hip[0], J.hip[1], 0.47, 1.1, -0.95, true); ctx.stroke();
        ctx.beginPath(); ctx.arc(J.hip[0], J.hip[1], 0.39, 1.0, -0.8, true); ctx.stroke();
        ctx.restore();
      }
    },
    front: (ctx, J, u, C) => {
      // 护具：躯干上的圆角块
      const c = [J.hip[0] + J.up[0] * 0.17, J.hip[1] + J.up[1] * 0.17];
      G.seg(ctx, [c[0] - J.up[0] * 0.07, c[1] - J.up[1] * 0.07], [c[0] + J.up[0] * 0.07, c[1] + J.up[1] * 0.07], 0.165, C.acc);
      burst(ctx, J.lR[2], (u - 2) / 0.55, C, 0.06, 7);
    },
    iconU: 2.2,
  };

  // ── 拳击：刺拳、刺拳、后手直拳 ──
  const bG = { y: 0.04, torso: 12, aR1: 25, aR2: 160, aL1: 45, aL2: 150, lR1: 16, lR2: 2, lL1: -20, lL2: -26 };
  const jab = { ...bG, torso: 18, aL1: 90, aL2: 90 };
  const cross = { ...bG, torso: 26, x: 0.04, aR1: 92, aR2: 92, aL1: 30, aL2: 160, lR1: 20, lR2: 2, lL1: -32, lL2: -34 };
  POSES.boxing = {
    pose: kp([
      { b: 0, ...bG },
      { b: 0.3, ...jab, e: 'oExp' },
      { b: 0.6, ...bG },
      { b: 1, ...jab, e: 'oExp' },
      { b: 1.3, ...bG },
      { b: 1.7, ...bG, y: 0.07, torso: 8, x: -0.02 },
      { b: 2, ...cross, e: 'oExp' },
      { b: 2.5, ...cross },
      { b: 3.1, ...bG, e: 'io' },
      { b: 3.6, ...bG, y: 0.02 },
    ]),
    back: (ctx, J, u, C) => P.ground(ctx, 0.46, C, -0.9, 0.9),
    front: (ctx, J, u, C) => {
      G.disc(ctx, J.aL[2][0], J.aL[2][1], 0.066, C.acc);
      G.disc(ctx, J.aR[2][0], J.aR[2][1], 0.07, C.acc);
      burst(ctx, [J.aL[2][0] + 0.06, J.aL[2][1]], (u - 0.3) / 0.4, C, 0.07, 5);
      burst(ctx, [J.aL[2][0] + 0.06, J.aL[2][1]], (u - 1) / 0.4, C, 0.07, 5);
      burst(ctx, [J.aR[2][0] + 0.07, J.aR[2][1]], (u - 2) / 0.6, C, 0.08, 8);
    },
    iconU: 2.1,
  };

  // ── 摔跤：抱双腿摔 ──
  POSES.wrestling = {
    pose: kp([
      { b: 0, x: -0.05, y: 0.1, torso: 38, aR1: 55, aR2: 95, aL1: 45, aL2: 100, lR1: 32, lR2: -22, lL1: -18, lL2: -38 },
      { b: 0.8, x: -0.02, y: 0.13, torso: 45, aR1: 60, aR2: 90, aL1: 50, aL2: 95, lR1: 38, lR2: -25, lL1: -20, lL2: -40 },
      { b: 1.2, x: 0.14, y: 0.22, torso: 62, aR1: 88, aR2: 100, aL1: 80, aL2: 100, lR1: 78, lR2: -8, lL1: 8, lL2: -92, e: 'oExp' },
      { b: 2, x: 0.3, y: 0.1, torso: 42, aR1: 100, aR2: 150, aL1: 95, aL2: 145, lR1: 30, lR2: -15, lL1: -35, lL2: -48, e: 'io3' },
      { b: 2.9, x: 0.4, y: 0.2, torso: 68, aR1: 95, aR2: 100, aL1: 85, aL2: 95, lR1: 60, lR2: -30, lL1: 5, lL2: -90, e: 'o3' },
    ]),
    second: kp([
      { b: 0, y: 0.1, torso: 36, aR1: 55, aR2: 95, aL1: 45, aL2: 100, lR1: 30, lR2: -22, lL1: -18, lL2: -38 },
      { b: 0.8, y: 0.1, torso: 36, aR1: 55, aR2: 95, aL1: 45, aL2: 100, lR1: 30, lR2: -22, lL1: -18, lL2: -38 },
      { b: 1.2, y: 0.04, torso: 30, aR1: 75, aR2: 110, aL1: 70, aL2: 120, lR1: 18, lR2: 10, lL1: -10, lL2: -10 },
      { b: 2, body: true, x: -0.18, y: -0.1, rot: -48, torso: 10, aR1: 150, aR2: 170, aL1: 130, aL2: 160, lR1: 40, lR2: 30, lL1: 20, lL2: 10, e: 'io3' },
      { b: 2.9, body: true, x: -0.42, y: 0.37, rot: -90, torso: 0, aR1: 160, aR2: 175, aL1: 140, aL2: 170, lR1: 50, lR2: 8, lL1: 28, lL2: 0, e: 'o3' },
    ]),
    secondX: [0.36, 0], secondFace: -1,
    fig: { s: 0.82, x: -0.36 },
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -0.7, 1.3);
      const t = (u - 2.9) / 0.8;
      if (t > 0 && t < 1) { ctx.save(); ctx.globalAlpha *= 1 - t; ctx.fillStyle = C.acc; const w = 0.3 + G.E.o3(t) * 0.7; ctx.fillRect(0.86 - w / 2, 0.475, w, 0.018); ctx.restore(); }
    },
    iconU: 2,
  };

  // ── 击剑：前进 → 弓步刺中，亮灯 ──
  const fG = { y: 0.07, torso: 0, aR1: 38, aR2: 78, aL1: -115, aL2: 165, lR1: 36, lR2: -4, lL1: -34, lL2: -12 };
  POSES.fencing = {
    pose: kp([
      { b: 0, ...fG },
      { b: 0.45, ...fG, x: 0.06, y: 0.05, lR1: 45, lR2: 5, e: 'o3' },
      { b: 0.9, ...fG, x: 0.1 },
      { b: 1.5, ...fG, x: 0.1, y: 0.08, aR1: 60, aR2: 85 },
      { b: 2, x: 0.3, y: 0.15, torso: 10, aR1: 92, aR2: 92, aL1: -70, aL2: -75, lR1: 82, lR2: -2, lL1: -62, lL2: -62, e: 'oExp' },
      { b: 2.8, x: 0.3, y: 0.15, torso: 10, aR1: 92, aR2: 92, aL1: -70, aL2: -75, lR1: 82, lR2: -2, lL1: -62, lL2: -62 },
      { b: 3.6, ...fG, x: 0.16, e: 'io3' },
    ]),
    second: kp([
      { b: 0, ...fG },
      { b: 0.9, ...fG, x: -0.06 },
      { b: 1.7, ...fG, x: -0.04, aR1: 55, aR2: 110 },
      { b: 2, ...fG, x: -0.1, torso: -14, aR1: 70, aR2: 150, lR1: 30, lR2: -5, e: 'o3' },
      { b: 3, ...fG, x: -0.12, torso: -8, aR1: 20, aR2: 40, e: 'io' },
    ]),
    secondX: [1.22, 0], secondFace: -1,
    fig: { s: 0.72, x: -0.44 },
    back: (ctx, J, u, C) => {
      // 剑道（piste）
      ctx.fillStyle = C.line; ctx.fillRect(-0.8, 0.46, 2.85, 0.012);
      ctx.fillRect(-0.8, 0.44, 0.012, 0.05); ctx.fillRect(2.04, 0.44, 0.012, 0.05); ctx.fillRect(0.61, 0.44, 0.012, 0.05);
      // 对手的剑
      const S = J2(POSES.fencing, u), el = S.m(S.J.aR[1]), h = S.hR;
      const d = [h[0] - el[0], h[1] - el[1]], L = Math.hypot(d[0], d[1]);
      G.seg(ctx, h, [h[0] + d[0] / L * 0.5, h[1] + d[1] / L * 0.5], 0.012, C.far2);
      G.disc(ctx, h[0], h[1], 0.032, C.far2);
    },
    front: (ctx, J, u, C) => {
      const el = J.aR[1], h = J.aR[2];
      const d = [h[0] - el[0], h[1] - el[1]], L = Math.hypot(d[0], d[1]);
      // 刺中时剑身略弯
      const bend = G.clamp(1 - Math.abs(u - 2.1) / 0.5) * 0.05;
      const tip = [h[0] + d[0] / L * 0.52, h[1] + d[1] / L * 0.52 - bend];
      ctx.strokeStyle = C.fg; ctx.lineWidth = 0.012; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.quadraticCurveTo(h[0] + d[0] / L * 0.3, h[1] + d[1] / L * 0.3 - bend * 1.6, tip[0], tip[1]); ctx.stroke();
      G.disc(ctx, h[0], h[1], 0.034, C.acc);
      // 亮灯：刺中后的光圈
      const t = (u - 2) / 0.9;
      if (t > 0 && t < 1) { ctx.save(); ctx.globalAlpha *= 1 - t; G.ring(ctx, tip[0], tip[1], 0.03 + G.E.o3(t) * 0.16, 0.016, C.acc); ctx.restore(); }
      if (u > 2 && u < 3.2) G.disc(ctx, tip[0], tip[1], 0.025, C.acc);
    },
    iconU: 2.2,
  };

  // ── 柔术：跪姿抓把 → 扫倒 → 骑乘控臂 ──
  POSES.jujitsu = {
    pose: kp([
      { b: 0, x: -0.02, y: 0.225, torso: 18, aR1: 70, aR2: 85, aL1: 60, aL2: 95, lR1: 0, lR2: -90, lL1: -4, lL2: -92 },
      { b: 1, x: 0.04, y: 0.2, torso: 30, aR1: 80, aR2: 60, aL1: 70, aL2: 60, lR1: 30, lR2: -60, lL1: -4, lL2: -92 },
      { b: 1.9, x: 0.52, y: 0.22, torso: 38, aR1: 95, aR2: 40, aL1: 85, aL2: 30, lR1: 40, lR2: -80, lL1: 20, lL2: -95, e: 'io3' },
      { b: 2.6, x: 0.62, y: 0.25, torso: -5, aR1: 110, aR2: 16, aL1: 116, aL2: 22, lR1: 30, lR2: -95, lL1: 22, lL2: -96, e: 'o3' },
      { b: 3.2, x: 0.6, y: 0.25, torso: -12, aR1: 106, aR2: 12, aL1: 112, aL2: 18, lR1: 30, lR2: -95, lL1: 22, lL2: -96 },
    ]),
    second: kp([
      { b: 0, y: 0.225, torso: 18, aR1: 70, aR2: 85, aL1: 60, aL2: 95, lR1: 0, lR2: -90, lL1: -4, lL2: -92 },
      { b: 1, body: true, x: -0.04, y: 0.2, rot: -25, torso: 10, aR1: 90, aR2: 110, aL1: 80, aL2: 120, lR1: 20, lR2: -60, lL1: 0, lL2: -80 },
      { b: 1.9, body: true, x: -0.2, y: 0.37, rot: -90, torso: 0, aR1: 70, aR2: 80, aL1: 140, aL2: 160, lR1: 55, lR2: 8, lL1: 35, lL2: 0, e: 'io3' },
      { b: 2.6, body: true, x: -0.2, y: 0.37, rot: -90, torso: 0, aR1: 92, aR2: 92, aL1: 150, aL2: 170, lR1: 60, lR2: 10, lL1: 38, lL2: 2, e: 'o3' },
      // 拍地认输
      { b: 3.0, body: true, x: -0.2, y: 0.37, rot: -90, torso: 0, aR1: 92, aR2: 92, aL1: 130, aL2: 150, lR1: 60, lR2: 10, lL1: 38, lL2: 2 },
      { b: 3.2, body: true, x: -0.2, y: 0.37, rot: -90, torso: 0, aR1: 92, aR2: 92, aL1: 165, aL2: 180, lR1: 60, lR2: 10, lL1: 38, lL2: 2, e: 'oExp' },
      { b: 3.4, body: true, x: -0.2, y: 0.37, rot: -90, torso: 0, aR1: 92, aR2: 92, aL1: 130, aL2: 150, lR1: 60, lR2: 10, lL1: 38, lL2: 2 },
      { b: 3.6, body: true, x: -0.2, y: 0.37, rot: -90, torso: 0, aR1: 92, aR2: 92, aL1: 165, aL2: 180, lR1: 60, lR2: 10, lL1: 38, lL2: 2, e: 'oExp' },
    ]),
    secondX: [0.3, 0], secondFace: -1,
    fig: { s: 0.86, x: -0.3, y: -0.04 },
    back: (ctx, J, u, C) => P.ground(ctx, 0.46, C, -0.6, 1.4),
    front: (ctx, J, u, C) => {
      const S = J2(POSES.jujitsu, u);
      if (u > 2.4) G.disc(ctx, S.hR[0], S.hR[1], 0.03, C.acc);
      // 拍地
      for (const tb of [3.2, 3.6]) burst(ctx, S.hL, (u - tb) / 0.35, C, 0.04, 5);
    },
    iconU: 2.8,
  };

  // ── 克拉什：抓腰带 → 抱起 → 摔倒 ──
  POSES.kurash = {
    pose: kp([
      { b: 0, x: 0, y: 0.03, torso: 16, aR1: 45, aR2: 62, aL1: 40, aL2: 70, lR1: 14, lR2: 2, lL1: -16, lL2: -20 },
      { b: 1, x: 0.04, y: 0.1, torso: 8, aR1: 40, aR2: 70, aL1: 35, aL2: 78, lR1: 34, lR2: -18, lL1: -8, lL2: -30 },
      { b: 1.9, x: 0.06, y: 0.0, torso: -24, aR1: 70, aR2: 100, aL1: 65, aL2: 110, lR1: 18, lR2: 0, lL1: -18, lL2: -18, e: 'io3' },
      { b: 2.9, x: 0.2, y: 0.12, torso: 50, aR1: 60, aR2: 40, aL1: 50, aL2: 30, lR1: 40, lR2: -10, lL1: -30, lL2: -40, e: 'o3' },
    ]),
    second: kp([
      { b: 0, x: 0, y: 0.03, torso: 16, aR1: 45, aR2: 62, aL1: 40, aL2: 70, lR1: 14, lR2: 2, lL1: -16, lL2: -20 },
      { b: 1, x: 0.03, y: 0.02, torso: 20, aR1: 45, aR2: 62, aL1: 40, aL2: 70, lR1: 10, lR2: 4, lL1: -18, lL2: -18 },
      { b: 1.9, x: 0.06, y: -0.22, rot: -12, torso: 18, aR1: 50, aR2: 60, aL1: 40, aL2: 55, lR1: 20, lR2: -10, lL1: -10, lL2: -30, e: 'io3' },
      { b: 2.4, body: true, x: -0.2, y: -0.12, rot: -70, torso: 5, aR1: 120, aR2: 140, aL1: 100, aL2: 130, lR1: 40, lR2: 30, lL1: 20, lL2: 10, e: 'lin' },
      { b: 2.9, body: true, x: -0.46, y: 0.37, rot: -90, torso: 0, aR1: 160, aR2: 175, aL1: 140, aL2: 170, lR1: 50, lR2: 8, lL1: 28, lL2: 0, e: 'o3' },
    ]),
    secondX: [0.34, 0], secondFace: -1,
    fig: { s: 0.84, x: -0.3 },
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -0.7, 1.3);
      const t = (u - 2.9) / 0.8;
      if (t > 0 && t < 1) { ctx.save(); ctx.globalAlpha *= 1 - t; ctx.fillStyle = C.acc; const w = 0.3 + G.E.o3(t) * 0.7; ctx.fillRect(0.84 - w / 2, 0.475, w, 0.018); ctx.restore(); }
    },
    front: (ctx, J, u, C) => {
      belt(ctx, J, C.acc, false);
      const S = J2(POSES.kurash, u);
      belt(ctx, { hip: S.hip, up: S.up }, C.acc, false);
    },
    iconU: 1.9,
  };

  // ── 综合格斗：八角笼 + 小手套，刺拳 → 中段扫踢 ──
  const mG = { y: 0.06, torso: 10, aR1: 22, aR2: 158, aL1: 42, aL2: 150, lR1: 18, lR2: 2, lL1: -22, lL2: -28 };
  POSES.mma = {
    pose: kp([
      { b: 0, ...mG },
      { b: 0.3, ...mG, y: 0.03 },
      { b: 0.6, ...mG, torso: 16, aL1: 90, aL2: 90, e: 'oExp' },
      { b: 0.95, ...mG },
      { b: 1.5, ...mG, y: 0.08, torso: 4 },
      { b: 1.75, y: 0.02, torso: -12, aR1: 0, aR2: 60, aL1: 45, aL2: 150, lR1: 70, lR2: -30, lL1: -10, lL2: -12 },
      { b: 2, y: 0, torso: -28, aR1: -45, aR2: -25, aL1: 50, aL2: 150, lR1: 102, lR2: 98, lL1: -12, lL2: -14, e: 'oExp' },
      { b: 2.45, y: 0, torso: -24, aR1: -40, aR2: -20, aL1: 50, aL2: 150, lR1: 98, lR2: 94, lL1: -12, lL2: -14 },
      { b: 3, ...mG, e: 'io3' },
      { b: 3.5, ...mG, y: 0.03 },
    ]),
    back: (ctx, J, u, C) => {
      // 铁丝网（菱形格）+ 上沿
      ctx.save(); ctx.beginPath(); ctx.rect(-0.95, -0.72, 1.9, 1.18); ctx.clip();
      ctx.globalAlpha *= 0.32; ctx.strokeStyle = C.line; ctx.lineWidth = 0.008;
      for (let i = -12; i < 14; i++) {
        ctx.beginPath(); ctx.moveTo(-1.2 + i * 0.12, -0.8); ctx.lineTo(-1.2 + i * 0.12 + 1.3, 0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-1.2 + i * 0.12, 0.5); ctx.lineTo(-1.2 + i * 0.12 + 1.3, -0.8); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = C.line; ctx.fillRect(-0.95, -0.72, 1.9, 0.02); ctx.fillRect(-0.95, 0.46, 1.9, 0.012);
    },
    front: (ctx, J, u, C) => {
      G.disc(ctx, J.aL[2][0], J.aL[2][1], 0.046, C.acc);
      G.disc(ctx, J.aR[2][0], J.aR[2][1], 0.048, C.acc);
      burst(ctx, [J.aL[2][0] + 0.05, J.aL[2][1]], (u - 0.6) / 0.4, C, 0.06, 5);
      burst(ctx, J.lR[2], (u - 2) / 0.55, C, 0.06, 7);
    },
    iconU: 2.1,
  };
})();
