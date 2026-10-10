// 力与准 7 项：weightlifting shooting archery gym_art gym_rhythm gym_tramp pentathlon
(function () {
  const G = window.G, P = G.P, POSES = window.POSES;
  // 世界角写法（0 下 / 90 前 / 180 上），body: true 的帧按骨架约定原样使用
  const WA = (p) => {
    if (p.body) return { ...p };
    const o = { ...p }, f = (p.rot || 0) + (p.torso || 0), r = p.rot || 0;
    for (const k of ['aR1', 'aR2', 'aL1', 'aL2']) if (k in o) o[k] += f;
    for (const k of ['lR1', 'lR2', 'lL1', 'lL2']) if (k in o) o[k] += r;
    return o;
  };
  const kp = (keys) => { const k = keys.map(WA); return (u) => G.keyPose(k, u); };
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const target = (ctx, x, y, r, C, hit) => {
    const cols = [C.fg, C.bg, C.fg, C.bg, C.acc];
    for (let i = 0; i < 5; i++) G.disc(ctx, x, y, r * (1 - i * 0.19), cols[i]);
    if (hit > 0 && hit < 1) { ctx.save(); ctx.globalAlpha *= 1 - hit; G.ring(ctx, x, y, r * (0.3 + G.E.o3(hit) * 1.4), 0.014, C.acc); ctx.restore(); }
  };

  // ── 举重：抓举。第 2 拍锁定过头并定住 ──
  POSES.weightlifting = {
    pose: kp([
      { b: 0, y: 0.18, torso: 50, aR1: 0, aR2: 0, aL1: 0, aL2: 0, lR1: 75, lR2: -15, lL1: 71, lL2: -19 },
      { b: 0.6, y: 0.12, torso: 38, aR1: 0, aR2: 0, aL1: 0, aL2: 0, lR1: 45, lR2: -5, lL1: 41, lL2: -9, e: 'io' },
      { b: 1.05, y: -0.03, torso: -8, aR1: 2, aR2: 2, aL1: 2, aL2: 2, lR1: 4, lR2: -6, lL1: 0, lL2: -10, e: 'io3' },
      { b: 1.5, y: 0.29, torso: 22, aR1: 192, aR2: 192, aL1: 190, aL2: 190, lR1: 104, lR2: -26, lL1: 100, lL2: -30, e: 'oExp' },
      { b: 2, y: 0.0, torso: 0, aR1: 198, aR2: 198, aL1: 196, aL2: 196, lR1: 3, lR2: -2, lL1: -3, lL2: -6, e: 'o3' },
      { b: 2.4, y: 0.005, torso: 0, aR1: 197, aR2: 199, aL1: 195, aL2: 197, lR1: 3, lR2: -2, lL1: -3, lL2: -6 },
      { b: 4, y: 0.0, torso: 0, aR1: 198, aR2: 198, aL1: 196, aL2: 196, lR1: 3, lR2: -2, lL1: -3, lL2: -6 },
    ]),
    fig: { x: -0.06, y: 0.04 },
    back: (ctx, J, u, C) => P.ground(ctx, 0.46, C, -0.8, 0.8),
    // 锁定时杠铃在头后上方，片只压住头的一角
    front: (ctx, J, u, C) => {
      const h = mid(J.aR[2], J.aL[2]);
      const shake = u > 2 && u < 2.8 ? Math.sin(u * 60) * 0.004 * (2.8 - u) : 0;
      // 侧视：杠铃片是圆
      const hy = h[1] - 0.02;
      G.disc(ctx, h[0] + shake, hy, 0.125, C.acc);
      G.ring(ctx, h[0] + shake, hy, 0.088, 0.011, C.bg);
      G.disc(ctx, h[0] + shake, hy, 0.03, C.bg);
      // 锁定一刻的光圈
      const t = (u - 2) / 0.7;
      if (t > 0 && t < 1) { ctx.save(); ctx.globalAlpha *= 1 - t; G.ring(ctx, h[0], h[1] - 0.02, 0.15 + G.E.o3(t) * 0.18, 0.012, C.line); ctx.restore(); }
    },
    iconU: 2.4,
  };

  // ── 射击：立姿步枪，屏息 → 第 2 拍击发，中靶 ──
  const aim = { torso: -8, head: 14, aR1: 30, aR2: 150, aL1: 10, aL2: 160, lR1: 8, lR2: 8, lL1: -10, lL2: -10 };
  POSES.shooting = {
    pose: (u) => {
      const k = G.keyPose([
        { b: 0, ...WA({ ...aim, torso: -2, head: 4, aR1: 20, aR2: 120 }) },
        { b: 0.8, ...WA(aim), e: 'io3' },
        { b: 2, ...WA(aim) },
        { b: 2.08, ...WA({ ...aim, torso: -11, head: 11 }), e: 'oExp' },
        { b: 2.6, ...WA(aim), e: 'io' },
      ], u);
      const br = u < 2 ? Math.sin(u * Math.PI) * 0.004 : 0; // 呼吸
      return { ...k, y: br };
    },
    fig: { x: -0.5 },
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -0.4, 1.35);
      target(ctx, 1.12, J.sho[1] - 0.03, 0.11, C, (u - 2.15) / 0.8);
      ctx.fillStyle = C.line; ctx.fillRect(1.114, J.sho[1] + 0.08, 0.012, 0.38);
    },
    front: (ctx, J, u, C) => {
      // 枪：枪托抵肩，枪管沿视线向前
      const s = J.sho, lift = G.clamp(1 - Math.abs(u - 2.08) / 0.4) * 0.02;
      const a = [s[0] - 0.06, s[1] + 0.01], b = [s[0] + 0.54, s[1] - 0.035 - lift];
      G.seg(ctx, a, [s[0] + 0.28, s[1] - 0.015 - lift / 2], 0.05, C.fg);
      G.seg(ctx, a, b, 0.022, C.fg);
      G.seg(ctx, [s[0] + 0.14, s[1] - 0.04], [s[0] + 0.2, s[1] - 0.05], 0.018, C.fg);
      // 弹道
      const t = (u - 2) / 0.2;
      if (t > 0 && t < 1.6) {
        ctx.save(); ctx.globalAlpha *= G.clamp(1.6 - t);
        const x0 = b[0] + 0.02, x1 = G.lerp(x0, 1.12, G.clamp(t));
        ctx.fillStyle = C.acc; ctx.fillRect(Math.max(x0, x1 - 0.35), b[1] - 0.006, x1 - Math.max(x0, x1 - 0.35), 0.012);
        ctx.restore();
      }
      if (u > 2.15) G.disc(ctx, 1.12, J.sho[1] - 0.03, 0.018, C.bg);
    },
    iconU: 1.6,
  };

  // ── 射箭：举弓 → 开弓靠位 → 第 2 拍撒放 ──
  POSES.archery = {
    pose: kp([
      { b: 0, torso: -2, head: 0, aR1: 60, aR2: 70, aL1: 40, aL2: 80, lR1: 8, lR2: 8, lL1: -10, lL2: -10 },
      { b: 0.7, torso: -3, head: 4, aR1: 90, aR2: 90, aL1: 50, aL2: 95, lR1: 8, lR2: 8, lL1: -10, lL2: -10, e: 'io3' },
      { b: 1.4, torso: -4, head: 6, aR1: 90, aR2: 90, aL1: -80, aL2: 96, lR1: 8, lR2: 8, lL1: -10, lL2: -10, e: 'io3' },
      { b: 2, torso: -4, head: 6, aR1: 90, aR2: 90, aL1: -82, aL2: 95, lR1: 8, lR2: 8, lL1: -10, lL2: -10 },
      { b: 2.2, torso: -5, head: 6, aR1: 91, aR2: 91, aL1: -100, aL2: -50, lR1: 8, lR2: 8, lL1: -10, lL2: -10, e: 'oExp' },
      { b: 3.2, torso: -4, head: 6, aR1: 88, aR2: 88, aL1: -96, aL2: -45, lR1: 8, lR2: 8, lL1: -10, lL2: -10 },
    ]),
    fig: { x: -0.2 },
    back: (ctx, J, u, C) => P.ground(ctx, 0.46, C, -0.6, 1.2),
    front: (ctx, J, u, C) => {
      const bh = J.aR[2]; // 持弓手
      const H = 0.34;
      const top = [bh[0] - 0.06, bh[1] - H], bot = [bh[0] - 0.06, bh[1] + H];
      const drawn = u > 1.0 && u < 2.05;
      const release = G.clamp((u - 2) / 0.12);
      const pull = drawn ? G.E.io3((u - 0.7) / 0.7) : 0;
      // 弓臂：拉满时更弯
      const bend = 0.1 + 0.05 * pull;
      ctx.strokeStyle = C.acc; ctx.lineWidth = 0.026; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.quadraticCurveTo(bh[0] + bend * 1.8, bh[1], bot[0], bot[1]); ctx.stroke();
      // 弦
      const sh = J.aL[2];
      const nock = u < 0.7 ? [bh[0] - 0.06, bh[1]] : drawn || u < 2 ? [G.lerp(bh[0] - 0.06, sh[0], G.clamp((u - 0.7) / 0.7)), G.lerp(bh[1], sh[1], G.clamp((u - 0.7) / 0.7))] : [bh[0] - 0.06 - Math.sin((u - 2) * 30) * 0.02 * (1 - G.clamp((u - 2) / 0.8)), bh[1]];
      ctx.strokeStyle = C.line; ctx.lineWidth = 0.007;
      ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(nock[0], nock[1]); ctx.lineTo(bot[0], bot[1]); ctx.stroke();
      // 箭
      let ax0, ax1;
      if (u < 2) { ax0 = nock[0]; ax1 = Math.max(bh[0] + 0.12, nock[0] + 0.6); }
      else { const fx = G.E.i3(G.clamp((u - 2) / 0.35)) * 3; ax0 = nock[0] + 0.02 + fx + release * 0.1; ax1 = ax0 + 0.6; }
      const ay = u < 2 ? nock[1] : bh[1];
      if (ax0 < 2.2) {
        G.seg(ctx, [ax0, ay], [ax1, ay], 0.014, C.fg);
        G.poly(ctx, [[ax1 + 0.05, ay], [ax1 - 0.01, ay - 0.025], [ax1 - 0.01, ay + 0.025]], C.fg);
        G.poly(ctx, [[ax0, ay], [ax0 + 0.07, ay], [ax0 + 0.03, ay - 0.03]], C.acc);
      }
      if (u > 2 && u < 2.7) P.speed(ctx, Math.min(ax0 + 0.1, 1.4), ay, 0.6, 3, C, 1 - (u - 2) / 0.7);
    },
    iconU: 1.8,
  };

  // ── 竞技体操：单杠大回环 ──
  // 手固定在杠上，身体绕杠转；顶部慢、底部快
  const hang = (rot, arch) => ({ body: true, rot, torso: 0, head: -4, aR1: 180, aR2: 180, aL1: 178, aL2: 178, lR1: arch, lR2: arch, lL1: arch - 3, lL2: arch - 3 });
  POSES.gym_art = {
    pose: (u) => {
      const ph = u / 2; // 2 拍一圈
      const th = 180 + 360 * ph - 38 * Math.sin(2 * Math.PI * ph);
      const arch = -14 * Math.max(0, Math.cos((th - 360) * G.D2R)) + 10 * Math.max(0, -Math.cos((th - 360) * G.D2R)) * 0;
      const p = hang(th, arch);
      const J = G.joints(p);
      const h = mid(J.aR[2], J.aL[2]);
      return { ...p, x: -h[0], y: -h[1] };
    },
    fig: { s: 0.6, y: -0.16 },
    back: (ctx, J, u, C) => {
      // 单杠：杠 = 圆点，两根立柱 + 拉索（侧视）
      G.seg(ctx, [0, 0], [0, 1.4], 0.03, C.line);
      G.seg(ctx, [0, -0.02], [-0.75, 1.4], 0.012, C.line);
      G.seg(ctx, [0, -0.02], [0.75, 1.4], 0.012, C.line);
      ctx.fillStyle = C.line; ctx.fillRect(-1.3, 1.4, 2.6, 0.02);
      // 回环轨迹
      ctx.save(); ctx.globalAlpha *= 0.55; ctx.strokeStyle = C.line; ctx.lineWidth = 0.016;
      const th = 180 + 360 * (u / 2) - 38 * Math.sin(2 * Math.PI * u / 2);
      const a1 = (th + 90) * G.D2R;
      ctx.beginPath(); ctx.arc(0, 0, 1.02, a1 - 1.6, a1 - 0.15); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 0.88, a1 - 1.2, a1 - 0.2); ctx.stroke();
      ctx.restore();
    },
    front: (ctx, J, u, C) => G.disc(ctx, 0, 0, 0.035, C.acc),
    iconU: 0,
  };

  // ── 艺术体操：带操，劈叉跳 ──
  const rgPose = kp([
    { b: 0, x: -0.25, y: 0.02, torso: 6, head: -6, aR1: -40, aR2: -30, aL1: 40, aL2: 50, lR1: 25, lR2: 20, lL1: -25, lL2: -40 },
    { b: 0.6, x: -0.12, y: 0.07, torso: 10, head: -4, aR1: 60, aR2: 70, aL1: -30, aL2: -20, lR1: 30, lR2: -20, lL1: -20, lL2: -30 },
    { b: 1, x: 0.0, y: -0.2, torso: 2, head: -12, aR1: 150, aR2: 165, aL1: -120, aL2: -135, lR1: 92, lR2: 94, lL1: -92, lL2: -94, e: 'o3' },
    { b: 1.5, x: 0.14, y: 0.05, torso: 4, head: -6, aR1: 120, aR2: 135, aL1: -80, aL2: -90, lR1: 12, lR2: 6, lL1: -30, lL2: -34, e: 'i3' },
    { b: 2.2, x: 0.18, y: 0.0, torso: 30, head: -18, aR1: 100, aR2: 110, aL1: -100, aL2: -110, lR1: 2, lR2: 2, lL1: -80, lL2: -84, e: 'io' },
    { b: 3, x: 0.12, y: -0.03, torso: -8, head: -20, aR1: 175, aR2: 185, aL1: 120, aL2: 150, lR1: 4, lR2: 4, lL1: -10, lL2: 60, e: 'io' },
    { b: 4, x: 0.08, y: -0.03, torso: -10, head: -22, aR1: 180, aR2: 190, aL1: 115, aL2: 150, lR1: 4, lR2: 4, lL1: -10, lL2: 60 },
  ]);
  POSES.gym_rhythm = {
    pose: rgPose,
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -1, 1);
      // 带：手 → 棍 → 沿过去的手部轨迹拖出的彩带，带波纹
      const pts = [];
      const N = 36;
      for (let i = 0; i < N; i++) {
        const uu = u - i * 0.035;
        const Jp = G.joints(rgPose(uu));
        const h = Jp.aR[2], e = Jp.aR[1];
        const d = [h[0] - e[0], h[1] - e[1]], L = Math.hypot(d[0], d[1]) || 1;
        const tip = [h[0] + d[0] / L * 0.2, h[1] + d[1] / L * 0.2];
        const w = Math.sin(i * 0.45 - u * 9) * 0.05 * (i / N);
        pts.push([tip[0] - (d[1] / L) * w, tip[1] + (d[0] / L) * w + i * 0.004]);
      }
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 1; i < N; i++) {
        ctx.strokeStyle = C.acc; ctx.lineWidth = 0.046 * (1 - i / N * 0.6); ctx.globalAlpha = 1 - (i / N) * 0.6;
        ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
      }
      ctx.restore();
    },
    front: (ctx, J, u, C) => {
      const h = J.aR[2], e = J.aR[1];
      const d = [h[0] - e[0], h[1] - e[1]], L = Math.hypot(d[0], d[1]) || 1;
      G.seg(ctx, h, [h[0] + d[0] / L * 0.2, h[1] + d[1] / L * 0.2], 0.012, C.fg);
    },
    iconU: 1,
  };

  // ── 蹦床：压网 → 高空团身空翻 → 落网，再来一次直体 ──
  const tuck = (rot, y) => ({ body: true, rot, y, torso: 20, head: 10, aR1: 70, aR2: 20, aL1: 65, aL2: 15, lR1: 125, lR2: -10, lL1: 120, lL2: -15 });
  const straight = (rot, y) => ({ body: true, rot, y, torso: 0, head: 0, aR1: 20, aR2: 18, aL1: 16, aL2: 14, lR1: 2, lR2: 2, lL1: -2, lL2: -2 });
  const land = (y) => ({ body: true, rot: 0, y, torso: 14, head: 0, aR1: 40, aR2: 60, aL1: 35, aL2: 55, lR1: 40, lR2: -18, lL1: 36, lL2: -22 });
  const up = (y) => ({ body: true, rot: 0, y, torso: 0, head: -6, aR1: 175, aR2: 178, aL1: 170, aL2: 174, lR1: 2, lR2: 2, lL1: -2, lL2: -2 });
  POSES.gym_tramp = {
    pose: (u) => {
      const ph = ((u % 2) + 2) % 2, second = u >= 2;
      const H = 0.62;
      const y = ph < 0.1 ? 0.12 : 0.12 - (H + 0.12) * 4 * ((ph - 0.1) / 1.8) * (1 - (ph - 0.1) / 1.8);
      const yy = ph >= 1.9 ? 0.12 : y;
      let p;
      if (ph < 0.1) p = land(0.12);
      else if (ph < 0.4) p = G.lerpPose(land(yy), up(yy), G.E.o3((ph - 0.1) / 0.3));
      else if (ph < 1.5) {
        const k = G.E.io((ph - 0.4) / 1.1);
        p = second ? straight(360 * k, yy) : G.lerpPose(tuck(360 * k, yy), tuck(360 * k, yy), 0);
        if (!second) { const a = G.clamp((ph - 0.4) / 0.15), b = G.clamp((1.5 - ph) / 0.15); p = G.lerpPose(up(yy), p, Math.min(a, b)); p.rot = 360 * k; }
      } else if (ph < 1.9) p = G.lerpPose(up(yy), land(yy), G.E.io((ph - 1.5) / 0.4));
      else p = land(0.12);
      return p;
    },
    fig: { s: 0.78, y: 0.14 },
    back: (ctx, J, u, C) => {
      const ph = ((u % 2) + 2) % 2;
      const dip = ph < 0.1 || ph > 1.9 ? 0.09 : ph < 0.25 ? 0.09 * (1 - (ph - 0.1) / 0.15) : 0;
      const yb = 0.58;
      // 网床（压下去是 V 形）
      ctx.strokeStyle = C.fg; ctx.lineWidth = 0.022; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-0.55, yb); ctx.quadraticCurveTo(0, yb + dip * 2, 0.55, yb); ctx.stroke();
      ctx.fillStyle = C.line;
      ctx.fillRect(-0.6, yb - 0.01, 1.2, 0.022);
      G.seg(ctx, [-0.56, yb], [-0.66, yb + 0.26], 0.02, C.line);
      G.seg(ctx, [0.56, yb], [0.66, yb + 0.26], 0.02, C.line);
      // 空中轨迹点
      if (ph > 0.4 && ph < 1.5) {
        ctx.save(); ctx.globalAlpha *= 0.5;
        for (let i = 1; i < 6; i++) G.disc(ctx, 0, J.hip[1] + i * 0.09, 0.012, C.line);
        ctx.restore();
      }
    },
    iconU: 0.95,
  };

  // ── 现代五项：激光跑。跑 → 急停举枪 → 第 3 拍击发 → 再跑。五个圆点逐个点亮 ──
  const aimP = { torso: -2, head: 4, aR1: 90, aR2: 90, aL1: 10, aL2: 40, lR1: 16, lR2: 8, lL1: -14, lL2: -14 };
  POSES.pentathlon = {
    pose: (u) => {
      const run = (uu) => ({ ...G.runCycle(uu / 1.0, 0.85, { lean: 10 }), head: -4 });
      const aim = WA(aimP);
      if (u < 1.3) return run(u);
      if (u < 1.8) return G.lerpPose(run(u), aim, G.E.o3((u - 1.3) / 0.5));
      if (u < 3.25) return u > 3 && u < 3.1 ? { ...aim, torso: -4, aR1: 95, aR2: 97 } : aim;
      return G.lerpPose(aim, run(u), G.E.io((u - 3.25) / 0.6));
    },
    fig: { x: -0.3 },
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -0.6, 1.2);
      if (u < 1.6) P.speed(ctx, -0.35, -0.05, 0.7, 4, C, 1 - u / 1.6);
      if (u > 3.3) P.speed(ctx, -0.35, -0.05, 0.7, 4, C, G.clamp((u - 3.3) / 0.4));
      target(ctx, 0.96, -0.2, 0.085, C, (u - 3.05) / 0.8);
      // 五项五点
      for (let i = 0; i < 5; i++) {
        const on = u >= i * 0.8 - 0.001;
        const cx = 0.0 + i * 0.15;
        if (on) G.disc(ctx, cx, -0.7, 0.038, i === Math.min(4, Math.floor(u / 0.8)) ? C.acc : C.fg);
        else G.ring(ctx, cx, -0.7, 0.032, 0.012, C.line);
      }
    },
    front: (ctx, J, u, C) => {
      if (u > 1.5 && u < 3.4) {
        const h = J.aR[2], e = J.aR[1];
        const d = [h[0] - e[0], h[1] - e[1]], L = Math.hypot(d[0], d[1]) || 1;
        G.seg(ctx, h, [h[0] + d[0] / L * 0.1, h[1] + d[1] / L * 0.1], 0.04, C.fg);
        G.seg(ctx, h, [h[0] - 0.005, h[1] + 0.06], 0.03, C.fg);
        // 激光
        const t = (u - 3) / 0.35;
        if (t > 0 && t < 1) {
          ctx.save(); ctx.globalAlpha *= 1 - t;
          const a = [h[0] + d[0] / L * 0.12, h[1] + d[1] / L * 0.12];
          G.seg(ctx, a, [0.96, -0.2], 0.01, C.acc);
          ctx.restore();
        }
      }
    },
    iconU: 2.4,
  };
})();
