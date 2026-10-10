// 第 7 章 亚洲 · 新浪潮：卡巴迪、藤球、武术、滑板、攀岩、霹雳舞、电子竞技
(function () {
  const G = window.G, P = G.P, POSES = window.POSES, L = G.LEN, D2R = G.D2R;
  const R2D = 180 / Math.PI;
  const { lerp, clamp, E } = G;
  const fract = (x) => x - Math.floor(x);

  // ── 反向运动学（和 nature.js 同一套，逐帧求解）──
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
  // 关键帧插值：数字线性、[x,y] 逐分量；每段可带缓动 e
  function keyAt(keys, u) {
    if (u <= keys[0].b) return keys[0];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (u < b.b) {
        const t = (E[b.e || 'io'])((u - a.b) / (b.b - a.b));
        const o = {};
        for (const k in b) {
          if (k === 'e' || k === 'b') continue;
          const va = a[k] ?? b[k], vb = b[k];
          o[k] = Array.isArray(vb) ? [lerp(va[0], vb[0], t), lerp(va[1], vb[1], t)] : typeof vb === 'number' ? lerp(va, vb, t) : vb;
        }
        return o;
      }
    }
    return keys[keys.length - 1];
  }
  const fromKey = (k) => solve({ x: k.hip[0], y: k.hip[1], rot: k.rot || 0, torso: k.torso || 0, head: k.head || 0 },
    { fR: k.fR, fL: k.fL, hR: k.hR, hL: k.hL, kR: k.kR ?? 1, kL: k.kL ?? 1, eR: k.eR ?? -1, eL: k.eL ?? -1 });
  const burst = (ctx, x, y, t, r, C, n = 8) => {
    if (t < 0 || t > 1) return;
    ctx.save(); ctx.globalAlpha = 1 - t;
    G.ring(ctx, x, y, r * (0.3 + E.o3(t)), 0.014, C.acc);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + 0.3; const r0 = r * (0.55 + E.o3(t) * 0.6), r1 = r0 + r * 0.3 * (1 - t); G.seg(ctx, [x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1], 0.014, C.fg); }
    ctx.restore();
  };

  // ── 卡巴迪：进攻员压低身位，第 2 拍伸手触碰防守员，随即撤回；每拍喊一声 ──
  const KAB = [
    { b: 0, hip: [-0.3, 0.13], torso: 42, head: -24, fR: [-0.1, 0.46], fL: [-0.5, 0.46], hR: [-0.02, 0.14], hL: [-0.4, 0.02] },
    { b: 0.5, hip: [-0.26, 0.08], torso: 36, head: -24, fR: [-0.02, 0.44], fL: [-0.48, 0.46], hR: [0.04, 0.1], hL: [-0.36, 0.0] },
    { b: 1.0, hip: [-0.2, 0.1], torso: 38, head: -24, fR: [0.02, 0.46], fL: [-0.38, 0.45], hR: [0.1, 0.12], hL: [-0.34, 0.02] },
    { b: 1.4, hip: [-0.16, 0.13], torso: 34, head: -22, fR: [0.06, 0.46], fL: [-0.36, 0.46], hR: [0.12, 0.08], hL: [-0.3, -0.02] },
    { b: 2.0, hip: [0.08, 0.16], torso: 46, head: -30, fR: [0.4, 0.46], fL: [-0.36, 0.46], hR: [0.56, 0.16], hL: [-0.24, -0.08], e: 'oExp' },
    { b: 2.3, hip: [0.02, 0.14], torso: 30, head: -18, fR: [0.36, 0.46], fL: [-0.4, 0.46], hR: [0.36, 0.1], hL: [-0.3, -0.06] },
    { b: 3.0, hip: [-0.36, 0.06], torso: 18, head: -10, fR: [-0.14, 0.46], fL: [-0.58, 0.43], hR: [-0.1, -0.12], hL: [-0.46, -0.1], e: 'o3' },
    { b: 4.0, hip: [-0.3, 0.13], torso: 42, head: -24, fR: [-0.1, 0.46], fL: [-0.5, 0.46], hR: [-0.02, 0.14], hL: [-0.4, 0.02] },
  ];
  // 防守员（本地坐标，面朝 +x；画的时候镜像到右边）
  const KABD = [
    { b: 0, hip: [0.0, 0.12], torso: 40, head: -26, fR: [0.2, 0.46], fL: [-0.22, 0.46], hR: [0.26, 0.02], hL: [0.2, -0.04] },
    { b: 2.05, hip: [0.0, 0.13], torso: 40, head: -26, fR: [0.2, 0.46], fL: [-0.22, 0.46], hR: [0.26, 0.02], hL: [0.2, -0.04] },
    { b: 2.5, hip: [0.2, 0.18], torso: 58, head: -34, fR: [0.46, 0.46], fL: [-0.16, 0.46], hR: [0.62, 0.16], hL: [0.56, 0.1], e: 'o3' },
    { b: 3.2, hip: [0.1, 0.14], torso: 44, head: -28, fR: [0.34, 0.46], fL: [-0.14, 0.46], hR: [0.38, 0.1], hL: [0.3, 0.02] },
    { b: 4.0, hip: [0.0, 0.12], torso: 40, head: -26, fR: [0.2, 0.46], fL: [-0.22, 0.46], hR: [0.26, 0.02], hL: [0.2, -0.04] },
  ];
  POSES.kabaddi = {
    iconU: 2,
    pose: (u) => fromKey(keyAt(KAB, u)),
    second: (u) => fromKey(keyAt(KABD, u)),
    secondX: [0.8, 0], secondFace: -1,
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -1.6, 1.6);
      // 中线（半场分界）：地上一段粗线 + 竖直虚线
      ctx.fillStyle = C.acc; ctx.fillRect(0.22, 0.46, 0.03, 0.08);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = C.line; ctx.fillRect(0.228, 0.4 - i * 0.12, 0.014, 0.06); }
    },
    front: (ctx, J, u, C) => {
      // 每拍喊一声「卡巴迪」：嘴前两道声波弧
      const f = fract(u);
      if (f < 0.6) {
        const k = f / 0.6, h = J.head, a = (J.p.torso + J.p.head) * D2R;
        const dir = [Math.cos(a), Math.sin(a)];
        ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = C.fg; ctx.lineWidth = 0.014; ctx.lineCap = 'round';
        for (let i = 0; i < 2; i++) { const r = 0.1 + i * 0.05 + k * 0.08; ctx.beginPath(); ctx.arc(h[0], h[1], r, a - 0.5, a + 0.5); ctx.stroke(); }
        ctx.restore();
      }
      // 2 拍触碰
      burst(ctx, J.aR[2][0] + 0.04, J.aR[2][1], (u - 1.95) / 0.5, 0.16, C);
    },
  };

  // ── 藤球：倒挂金钩（背对球网，后翻，脚从头顶扣球），第 2 拍击球 ──
  const TK = [
    { b: 0, hip: [0.05, 0.02], rot: 0, torso: 6, head: -8, fR: [0.18, 0.46], fL: [-0.1, 0.46], hR: [0.25, -0.02], hL: [-0.2, -0.02] },
    { b: 1.0, hip: [0.05, 0.12], rot: 0, torso: 22, head: -30, fR: [0.2, 0.46], fL: [-0.12, 0.46], hR: [0.2, 0.1], hL: [-0.28, 0.1] },
    { b: 1.35, hip: [0.0, -0.22], rot: -30, torso: -4, head: -30, fR: [0.25, 0.1], fL: [-0.05, 0.22], hR: [0.3, -0.35], hL: [-0.3, -0.25], e: 'o2' },
    { b: 2.0, hip: [-0.04, -0.52], rot: -135, torso: 0, head: 10, fR: null, fL: null, hR: [0.3, -0.28], hL: [0.2, -0.2], e: 'io' },
    { b: 2.6, hip: [-0.1, -0.3], rot: -260, torso: 10, head: 0, fR: null, fL: null, hR: null, hL: null, e: 'io' },
    { b: 3.2, hip: [-0.12, 0.14], rot: -360, torso: 30, head: -20, fR: [0.05, 0.46], fL: [-0.28, 0.46], hR: [0.05, 0.12], hL: [-0.36, 0.0], e: 'o3' },
    { b: 4.0, hip: [-0.1, 0.04], rot: -360, torso: 10, head: -8, fR: [0.06, 0.46], fL: [-0.24, 0.46], hR: [0.14, -0.02], hL: [-0.3, -0.02] },
  ];
  function takrawPose(u) {
    const k = keyAt(TK, u);
    const p = fromKey({ ...k, fR: k.fR || [0, 0], fL: k.fL || [0, 0], hR: k.hR || [0, 0], hL: k.hL || [0, 0] });
    // 空中段：直接写角（身体坐标）：扣球腿从头顶甩过，另一条腿剪刀式反向
    const air = clamp((u - 1.3) / 0.35) * (1 - clamp((u - 2.8) / 0.4));
    if (air > 0) {
      const kick = u < 2 ? E.io(clamp((u - 1.3) / 0.7)) : 1 - E.io(clamp((u - 2.0) / 0.9));
      const A = {
        lR1: lerp(20, 128, kick), lR2: lerp(10, 132, kick),
        lL1: lerp(-10, -40, kick), lL2: lerp(-40, -70, kick),
        aR1: lerp(40, 60, kick), aR2: lerp(80, 40, kick), aL1: lerp(60, -70, kick), aL2: lerp(90, -40, kick),
      };
      for (const key in A) p[key] = lerp(p[key], A[key], air);
    }
    return p;
  }
  const BALL_R = 0.075;
  function takrawBall(u) {
    const Jc = G.joints(takrawPose(2.0));
    const pc = Jc.lR[2];
    const hit = [pc[0] - 0.02, pc[1] - 0.07];
    if (u < 2) {
      // 从右边抛进来（二传）
      const t = clamp((u - 0.2) / 1.8);
      const p0 = [1.25, 0.05];
      return { p: [lerp(p0[0], hit[0], t), lerp(p0[1], hit[1], t) - 0.9 * 4 * t * (1 - t) * 0.5], show: u > 0.2 };
    }
    const t = (u - 2) / 0.35;
    return { p: [lerp(hit[0], -1.5, t), lerp(hit[1], 0.5, t)], show: t < 1.2, fast: true, hit };
  }
  function drawRattan(ctx, x, y, r, C, spin) {
    G.disc(ctx, x, y, r, C.acc);
    ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; G.disc(ctx, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.2, C.bg); }
    G.disc(ctx, 0, 0, r * 0.2, C.bg);
    ctx.restore();
  }
  POSES.takraw = {
    fig: { s: 0.88, x: 0.08, y: 0.06 },
    iconU: 2,
    pose: takrawPose,
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -1.8, 1.8);
      // 网：在身后（左边）
      const nx = -0.66;
      G.seg(ctx, [nx, 0.46], [nx, -0.46], 0.022, C.fg);
      ctx.fillStyle = G.rgba(C.fg, 0.14); ctx.fillRect(nx - 0.5, -0.42, 0.5, 0.26);
      ctx.strokeStyle = C.line; ctx.lineWidth = 0.006;
      for (let i = 0; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(nx - 0.5 + i * 0.05, -0.42); ctx.lineTo(nx - 0.5 + i * 0.05, -0.16); ctx.stroke(); }
      for (let j = 0; j <= 5; j++) { ctx.beginPath(); ctx.moveTo(nx - 0.5, -0.42 + j * 0.052); ctx.lineTo(nx, -0.42 + j * 0.052); ctx.stroke(); }
      ctx.fillStyle = C.fg; ctx.fillRect(nx - 0.5, -0.43, 0.5, 0.02);
    },
    front: (ctx, J, u, C) => {
      const b = takrawBall(u);
      if (b.fast) {
        // 扣杀的拖尾
        const t0 = Math.max(2, u - 0.12);
        const bt = takrawBall(t0).p;
        ctx.save(); ctx.globalAlpha = 0.5; G.seg(ctx, bt, b.p, BALL_R * 1.6, C.acc); ctx.restore();
        burst(ctx, b.hit[0], b.hit[1], (u - 2) / 0.45, 0.22, C, 10);
      }
      if (b.show) drawRattan(ctx, b.p[0], b.p[1], BALL_R, C, u * 5);
    },
  };

  // ── 武术（剑术）：弓步刺剑 → 抡剑 → 腾空 → 仆步 ──
  const WS = [
    { b: 0, hip: [-0.02, 0.1], rot: 0, torso: 10, head: -6, fR: [0.34, 0.46], fL: [-0.42, 0.46], hR: [0.52, -0.16], hL: [-0.3, -0.46], sw: 0 },
    { b: 0.6, hip: [-0.02, 0.1], rot: 0, torso: 10, head: -6, fR: [0.34, 0.46], fL: [-0.42, 0.46], hR: [0.54, -0.17], hL: [-0.3, -0.47], sw: 0 },
    { b: 1.0, hip: [0.0, 0.0], rot: 0, torso: -10, head: 12, fR: [0.18, 0.46], fL: [-0.2, 0.46], hR: [0.08, -0.72], hL: [0.34, -0.3], sw: -70, e: 'o3' },
    { b: 1.35, hip: [0.02, 0.1], rot: 0, torso: 14, head: -4, fR: [0.18, 0.46], fL: [-0.16, 0.46], hR: [-0.22, -0.38], hL: [0.3, -0.12], sw: -140 },
    { b: 2.0, hip: [0.04, -0.34], rot: -6, torso: 4, head: -10, fR: [0.46, -0.52], fL: [-0.06, -0.08], kL: 1, hR: [-0.18, -0.78], hL: [0.42, -0.52], sw: -30, e: 'o3' },
    { b: 2.45, hip: [0.0, -0.08], rot: 0, torso: 14, head: -8, fR: [0.2, 0.3], fL: [-0.1, 0.36], hR: [0.1, -0.5], hL: [0.3, -0.3], sw: -10, e: 'i3' },
    { b: 3.0, hip: [-0.2, 0.28], rot: 0, torso: 26, head: -12, fR: [0.32, 0.46], fL: [-0.22, 0.46], hR: [0.34, 0.1], hL: [-0.34, -0.42], sw: 8, e: 'oExp' },
    { b: 4.0, hip: [-0.21, 0.29], rot: 0, torso: 27, head: -12, fR: [0.32, 0.46], fL: [-0.22, 0.46], hR: [0.35, 0.11], hL: [-0.34, -0.43], sw: 8 },
  ];
  const wushuPose = (u) => fromKey(keyAt(WS, u));
  function swordTip(u) {
    const k = keyAt(WS, u), J = G.joints(wushuPose(u));
    const h = J.aR[2], e = J.aR[1];
    const d = [h[0] - e[0], h[1] - e[1]], n = Math.hypot(d[0], d[1]);
    const v = G.rot2([d[0] / n, d[1] / n], k.sw || 0);
    return { h, tip: [h[0] + v[0] * 0.62, h[1] + v[1] * 0.62], v };
  }
  POSES.wushu = {
    iconU: 3,
    pose: wushuPose,
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -1.6, 1.6);
      // 剑光：过去 0.3 拍的剑身扫过的扇面
      const N = 10;
      for (let i = N; i >= 1; i--) {
        const a = swordTip(u - (i - 1) * 0.022), b = swordTip(u - i * 0.022);
        ctx.fillStyle = G.rgba(C.acc, 0.32 * (1 - i / N));
        ctx.beginPath(); ctx.moveTo(a.h[0], a.h[1]); ctx.lineTo(a.tip[0], a.tip[1]); ctx.lineTo(b.tip[0], b.tip[1]); ctx.lineTo(b.h[0], b.h[1]); ctx.fill();
      }
    },
    front: (ctx, J, u, C) => {
      const s = swordTip(u);
      // 剑身 + 护手 + 剑穗
      G.seg(ctx, s.h, s.tip, 0.018, C.fg);
      const g0 = [s.h[0] + s.v[0] * 0.04, s.h[1] + s.v[1] * 0.04];
      G.seg(ctx, [g0[0] - s.v[1] * 0.05, g0[1] + s.v[0] * 0.05], [g0[0] + s.v[1] * 0.05, g0[1] - s.v[0] * 0.05], 0.022, C.acc);
      const pom = [s.h[0] - s.v[0] * 0.06, s.h[1] - s.v[1] * 0.06];
      const lag = swordTip(u - 0.12);
      const tail = [pom[0] - (s.h[0] - lag.h[0]) * 1.4 - s.v[0] * 0.12, pom[1] - (s.h[1] - lag.h[1]) * 1.4 - s.v[1] * 0.12 + 0.08];
      ctx.strokeStyle = C.acc; ctx.lineWidth = 0.02; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pom[0], pom[1]); ctx.quadraticCurveTo((pom[0] + tail[0]) / 2 + 0.04, (pom[1] + tail[1]) / 2, tail[0], tail[1]); ctx.stroke();
      G.disc(ctx, tail[0], tail[1], 0.022, C.acc);
      // 仆步落地：一圈尘
      burst(ctx, J.lR[2][0], 0.46, (u - 2.95) / 0.6, 0.18, C);
    },
  };

  // ── 滑板：豚跳 + 尖翻越过台子，第 2 拍落地 ──
  function skateState(u) {
    // 板心、板角、翻转相位、下蹲量
    let y = 0, ang = 0, flip = 0, crouch = 0.1;
    if (u < 1) { crouch = lerp(0.06, 0.2, E.io(u)); }
    else if (u < 2) {
      const t = u - 1;
      y = -0.4 * Math.sin(Math.PI * t) * (t < 0.5 ? E.o2(t * 2) ** 0.4 : 1);
      ang = t < 0.12 ? lerp(0, -28, t / 0.12) : t < 0.45 ? lerp(-28, 0, (t - 0.12) / 0.33) : t < 0.85 ? 0 : lerp(0, 4, (t - 0.85) / 0.15);
      flip = clamp((t - 0.15) / 0.5);
      crouch = t < 0.1 ? lerp(0.2, 0.06, t / 0.1) : t < 0.5 ? lerp(0.06, 0.24, E.o2((t - 0.1) / 0.4)) : lerp(0.24, 0.12, (t - 0.5) / 0.5);
    } else {
      const t = u - 2;
      crouch = t < 0.25 ? lerp(0.12, 0.26, E.o3(t / 0.25)) : lerp(0.26, 0.04, E.io((t - 0.25) / 1.4));
      if (t > 1.7) crouch = lerp(0.04, 0.08, (t - 1.7) / 0.3);
    }
    return { c: [0, 0.4 + y], ang, flip, crouch };
  }
  POSES.skate = {
    fig: { s: 0.92, x: 0, y: 0.04 },
    iconU: 1.45,
    pose: (u) => {
      const s = skateState(u);
      const bp = (lx, ly) => { const v = G.rot2([lx, ly], s.ang); return [s.c[0] + v[0], s.c[1] + v[1]]; };
      const air = u > 1.1 && u < 1.95;
      const lift = air ? 0.02 : 0;
      const hip = [s.c[0] - 0.03, s.c[1] - 0.42 + s.crouch];
      const arm = air ? 1 : 0;
      return solve({ x: hip[0], y: hip[1], torso: 10 + s.crouch * 60, head: -8 },
        { fR: bp(0.17, -0.03 - lift), fL: bp(-0.2, -0.03 - lift), kR: 1, kL: 1, hR: [hip[0] + 0.3, hip[1] - 0.05 - arm * 0.1], hL: [hip[0] - 0.34, hip[1] - 0.15 - arm * 0.12], eR: -1, eL: 1 });
    },
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.47, C, -1.6, 1.6);
      // 台子：1.5 拍时在板下
      const x = (1.5 - u) * 0.9;
      for (const ox of [x, x + 3.6]) {
        ctx.fillStyle = C.far2; ctx.fillRect(ox - 0.28, 0.25, 0.56, 0.22);
        ctx.fillStyle = C.fg; ctx.fillRect(ox - 0.28, 0.24, 0.56, 0.025);
      }
      const s = skateState(u);
      if (u > 1.05 && u < 1.9) P.speed(ctx, -0.35, s.c[1] - 0.3, 0.6, 4, C, 0.7);
    },
    front: (ctx, J, u, C) => {
      const s = skateState(u);
      ctx.save(); ctx.translate(s.c[0], s.c[1] + 0.02); ctx.rotate(s.ang * D2R);
      const f = Math.cos(s.flip * Math.PI * 2); // 尖翻：板绕长轴转一圈
      ctx.scale(1, f === 0 ? 0.001 : f);
      // 板面 + 上翘的头尾
      ctx.fillStyle = f > 0 ? C.fg : C.acc;
      ctx.beginPath(); ctx.moveTo(-0.26, -0.012); ctx.lineTo(0.26, -0.012); ctx.lineTo(0.34, -0.06); ctx.lineTo(0.36, -0.045); ctx.lineTo(0.27, 0.012); ctx.lineTo(-0.27, 0.012); ctx.lineTo(-0.36, -0.045); ctx.lineTo(-0.34, -0.06); ctx.closePath(); ctx.fill();
      // 桥 + 轮
      G.disc(ctx, -0.19, 0.045, 0.03, C.acc); G.disc(ctx, 0.19, 0.045, 0.03, C.acc);
      ctx.fillStyle = C.fg; ctx.fillRect(-0.22, 0.01, 0.06, 0.02); ctx.fillRect(0.16, 0.01, 0.06, 0.02);
      ctx.restore();
      // 起跳拍板、落地
      burst(ctx, -0.34, 0.47, (u - 1.0) / 0.4, 0.12, C, 6);
      burst(ctx, 0.0, 0.47, (u - 2.0) / 0.5, 0.2, C, 8);
    },
  };

  // ── 攀岩（正面视角）：蛙式三点支撑 → 下沉蓄力 → 第 2 拍 dyno 抓到高点 → 岩壁下滚 ──
  const CL_D = 0.42;
  const CLK = [
    { b: 0, hip: [0.0, 0.08], torso: 0, head: -6, fR: [0.22, 0.4], fL: [-0.22, 0.42], hR: [0.26, -0.6], hL: [-0.26, -0.54] },
    { b: 1.0, hip: [0.02, 0.14], torso: 0, head: -18, fR: [0.22, 0.4], fL: [-0.22, 0.42], hR: [0.26, -0.6], hL: [-0.26, -0.54] },
    { b: 1.45, hip: [0.02, 0.22], torso: 0, head: -24, fR: [0.22, 0.4], fL: [-0.22, 0.42], hR: [0.26, -0.6], hL: [-0.26, -0.54], e: 'io' },
    { b: 2.0, hip: [0.1, -0.3], torso: 6, head: -24, fR: [0.2, 0.14], fL: [-0.16, 0.2], hR: [0.26, -1.04], hL: [-0.18, -0.64], e: 'oExp' },
    { b: 2.5, hip: [0.08, -0.26], torso: 2, head: -12, fR: [0.24, 0.06], fL: [-0.1, 0.18], hR: [0.26, -1.04], hL: [-0.18, -0.64] },
    { b: 3.0, hip: [0.02, -0.33], torso: 0, head: -6, fR: [0.24, -0.02], fL: [-0.22, 0.0], hR: [0.26, -1.04], hL: [-0.26, -0.96], e: 'o3' },
    { b: 4.0, hip: [0.02, -0.34], torso: 0, head: -6, fR: [0.24, -0.02], fL: [-0.22, 0.0], hR: [0.26, -1.04], hL: [-0.26, -0.96] },
  ];
  const clScroll = (u) => CL_D * E.io(clamp((u - 2.8) / 1.2));
  // 正面视角：右手 / 右脚往外弯（+x），左边往 -x 弯
  const climbPose = (u) => {
    const k = keyAt(CLK, u), s = clScroll(u);
    const sh = (p) => [p[0], p[1] + s];
    return fromKey({ ...k, hip: sh(k.hip), fR: sh(k.fR), fL: sh(k.fL), hR: sh(k.hR), hL: sh(k.hL), kR: 1, kL: -1, eR: -1, eL: 1 });
  };
  const HOLDS = [
    // [x, y, 形状, 尺寸]：0 圆，1 半圆，2 三角，3 月牙
    [0.26, -0.6, 0, 0.07], [-0.26, -0.54, 1, 0.08], [0.22, 0.44, 1, 0.07], [-0.22, 0.46, 0, 0.06],
    [0.26, -1.04, 3, 0.09], [-0.26, -0.96, 0, 0.065], [0.24, 0.02, 2, 0.07], [-0.22, 0.04, 0, 0.06],
    [-0.62, -0.3, 2, 0.08], [0.64, -0.12, 0, 0.1], [0.58, -0.8, 1, 0.07], [-0.6, 0.3, 3, 0.08], [0.62, 0.5, 2, 0.07], [-0.55, -1.2, 0, 0.07],
    [0.0, -1.35, 1, 0.08], [0.02, 0.72, 0, 0.07], [-0.02, -0.2, 3, 0.05],
  ];
  function hold(ctx, x, y, kind, r, col, hi) {
    ctx.fillStyle = col;
    ctx.beginPath();
    if (kind === 0) ctx.arc(x, y, r, 0, Math.PI * 2);
    else if (kind === 1) ctx.arc(x, y + r * 0.3, r, Math.PI, 0);
    else if (kind === 2) { ctx.moveTo(x - r, y + r * 0.6); ctx.lineTo(x, y - r * 0.8); ctx.lineTo(x + r, y + r * 0.6); }
    else { ctx.arc(x, y, r, 0.2, Math.PI - 0.2); }
    ctx.fill();
    G.disc(ctx, x, y, 0.012, hi);
  }
  POSES.climbing = {
    fig: { s: 0.82, x: 0, y: 0.1 },
    iconU: 2.0,
    pose: climbPose,
    back: (ctx, J, u, C) => {
      const s = clScroll(u);
      // 岩板接缝 + 螺栓点阵
      ctx.fillStyle = G.rgba(C.fg, 0.12);
      for (let i = -3; i <= 3; i++) ctx.fillRect(i * 0.42 - 0.004, -1.6, 0.008, 3.2);
      const oy = fract(s / CL_D) * CL_D;
      for (let j = -5; j <= 4; j++) ctx.fillRect(-1.5, j * CL_D + oy - 0.004, 3, 0.008);
      for (let j = -5; j <= 4; j++) for (let i = -4; i <= 4; i++) G.disc(ctx, i * 0.21 + 0.105, j * 0.21 + ((s % 0.21) + 0.21) % 0.21, 0.008, C.far2);
      HOLDS.forEach((h, i) => hold(ctx, h[0], h[1] + s, h[2], h[3], i < 8 ? C.acc : C.far2, C.bg));
      // 抓到的一瞬：点亮
      burst(ctx, 0.26, -1.04 + s, (u - 2.0) / 0.5, 0.2, C);
    },
  };

  // ── 霹雳舞：toprock → 下地 → 第 2 拍单手定格 → 空翻旋转 → 第 3 拍婴儿式定格 ──
  const BK = [
    { b: 0, hip: [-0.05, 0.02], rot: 0, torso: 4, head: -4, fR: [0.12, 0.46], fL: [-0.2, 0.46], hR: [0.18, -0.12], hL: [-0.02, -0.22] },
    { b: 0.5, hip: [0.02, 0.04], rot: 0, torso: 8, head: 6, fR: [0.26, 0.4], fL: [-0.12, 0.46], hR: [0.3, -0.4], hL: [-0.24, -0.1] },
    { b: 1.0, hip: [0.05, 0.02], rot: 0, torso: 2, head: -4, fR: [0.18, 0.46], fL: [-0.12, 0.46], hR: [0.12, -0.2], hL: [-0.1, -0.1] },
    { b: 1.5, hip: [0.0, 0.22], rot: 0, torso: 52, head: -20, fR: [0.2, 0.46], fL: [-0.24, 0.46], hR: [0.24, 0.46], hL: [-0.1, 0.2] },
    { b: 2.0, hip: [0.02, -0.06], rot: 152, torso: 0, head: -10, fR: [-0.28, -0.46], fL: [0.2, -0.52], hR: [0.18, 0.46], hL: [-0.18, 0.38], kR: -1, kL: 1, eR: 1, e: 'oExp' },
    { b: 2.35, hip: [0.02, -0.08], rot: 156, torso: 0, head: -10, fR: [-0.3, -0.48], fL: [0.2, -0.54], hR: [0.18, 0.46], hL: [-0.18, 0.38], kR: -1, kL: 1, eR: 1 },
    { b: 2.7, hip: [0.0, -0.3], rot: 330, torso: -10, head: 0, fR: [-0.1, -0.62], fL: [0.3, -0.5], hR: [0.3, -0.1], hL: [-0.2, -0.1] },
    { b: 3.0, hip: [-0.06, 0.12], rot: 468, torso: 0, head: 0, fR: [-0.42, 0.02], fL: [-0.28, 0.2], hR: [0.3, 0.46], hL: [0.18, 0.46], kR: -1, kL: -1, eR: 1, eL: 1, e: 'oExp' },
    { b: 4.0, hip: [-0.07, 0.12], rot: 470, torso: 0, head: 0, fR: [-0.43, 0.0], fL: [-0.28, 0.19], hR: [0.3, 0.46], hL: [0.18, 0.46], kR: -1, kL: -1, eR: 1, eL: 1 },
  ];
  POSES.breaking = {
    iconU: 2.2,
    pose: (u) => {
      const k = keyAt(BK, u);
      // 空翻段：头尾两个关键帧的四肢角不适合插值目标点，直接用 V 字腿
      const p = fromKey(k);
      const spin = clamp((u - 2.4) / 0.55) * (1 - clamp((u - 2.9) / 0.1));
      if (spin > 0) {
        const V = { lR1: 40, lR2: 40, lL1: -40, lL2: -40, aR1: 120, aR2: 150, aL1: -110, aL2: -140 };
        const w = Math.sin(Math.PI * clamp((u - 2.4) / 0.6));
        for (const key in V) p[key] = lerp(p[key], V[key], w);
      }
      return p;
    },
    back: (ctx, J, u, C) => {
      P.ground(ctx, 0.46, C, -1.6, 1.6);
      // 舞池：地上一块菱形光斑
      ctx.fillStyle = G.rgba(C.fg, 0.08);
      ctx.beginPath(); ctx.ellipse(0, 0.5, 0.8, 0.07, 0, 0, Math.PI * 2); ctx.fill();
      // 空翻的轨迹弧
      const t = (u - 2.35) / 0.8;
      if (t > 0 && t < 1) {
        ctx.save(); ctx.globalAlpha = 1 - t; ctx.strokeStyle = C.acc; ctx.lineWidth = 0.03; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, -0.08, 0.55, -Math.PI * 0.9, -Math.PI * 0.9 + Math.PI * 1.6 * E.o3(t * 1.4)); ctx.stroke();
        ctx.restore();
      }
    },
    front: (ctx, J, u, C) => {
      burst(ctx, 0.18, 0.46, (u - 2.0) / 0.5, 0.18, C);
      burst(ctx, 0.24, 0.46, (u - 3.0) / 0.5, 0.22, C, 10);
    },
  };

  // ── 电竞：戴耳机坐在电竞椅上，屏幕上几何 HUD 随拍脉冲 ──
  const ES_Y = 0.18;
  POSES.esports = {
    fig: { s: 0.8, x: -0.3, y: -0.08 },
    iconU: 2,
    pose: (u) => {
      const q = fract(u * 2), s16 = Math.sin(u * Math.PI * 8);
      const flick = Math.exp(-q * 8) * (Math.floor(u * 2) % 2 ? 1 : -1);
      const nod = Math.exp(-fract(u) * 6);
      const Y = ES_Y;
      return solve({ x: 0, y: Y, torso: 24 + nod * 3, head: -14 + nod * 8 },
        { fR: [0.3, 0.46], fL: [0.27, 0.46], kR: 1, kL: 1, hR: [0.4 + flick * 0.04, Y - 0.05 - Math.abs(flick) * 0.01], hL: [0.3, Y - 0.055 + Math.max(0, s16) * 0.014], eR: -1, eL: -1 });
    },
    back: (ctx, J, u, C) => {
      // 地面
      P.ground(ctx, 0.46, C, -1.2, 1.4);
      ctx.save(); ctx.translate(0, ES_Y);
      // 椅子：靠背 + 座 + 立柱 + 五星脚
      G.seg(ctx, [-0.13, 0.02], [-0.2, -0.5], 0.13, C.far2);
      G.disc(ctx, -0.2, -0.52, 0.075, C.far2);
      G.seg(ctx, [-0.16, 0.08], [0.16, 0.08], 0.06, C.far2);
      G.seg(ctx, [0.0, 0.1], [0.0, 0.22], 0.03, C.far2);
      G.seg(ctx, [-0.16, 0.23], [0.16, 0.23], 0.03, C.far2);
      G.disc(ctx, -0.16, 0.255, 0.028, C.far2); G.disc(ctx, 0.16, 0.255, 0.028, C.far2);
      // 桌子
      ctx.fillStyle = C.fg; ctx.fillRect(0.24, -0.03, 0.9, 0.03);
      ctx.fillRect(1.04, 0.0, 0.03, 0.46 - ES_Y);
      // 显示器
      const sx = 0.56, sy = -0.66, sw = 0.56, sh = 0.36;
      G.seg(ctx, [sx + sw * 0.55, -0.03], [sx + sw * 0.55, sy + sh], 0.03, C.fg);
      ctx.fillStyle = C.fg; ctx.fillRect(sx + sw * 0.4, -0.05, sw * 0.3, 0.02);
      ctx.fillStyle = C.fg; ctx.fillRect(sx - 0.02, sy - 0.02, sw + 0.04, sh + 0.04);
      const scr = G.mix(C.bg, '#000000', 0.45);
      ctx.fillStyle = scr; ctx.fillRect(sx, sy, sw, sh);
      // 屏幕光：照向玩家的脸
      ctx.fillStyle = G.rgba(C.acc, 0.12 + Math.exp(-fract(u) * 5) * 0.12);
      ctx.beginPath(); ctx.moveTo(sx, sy + 0.02); ctx.lineTo(sx, sy + sh - 0.02); ctx.lineTo(0.1, -0.1); ctx.lineTo(0.1, -0.6); ctx.fill();
      // HUD：准星、目标、血条
      ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
      const cx = sx + sw * 0.5, cy = sy + sh * 0.5, pulse = Math.exp(-fract(u) * 5);
      // 网格地面
      ctx.strokeStyle = G.rgba(C.acc, 0.35); ctx.lineWidth = 0.004;
      for (let i = 0; i < 7; i++) { const yy = cy + 0.04 + i * i * 0.006; ctx.beginPath(); ctx.moveTo(sx, yy); ctx.lineTo(sx + sw, yy); ctx.stroke(); }
      for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 0.02, cy + 0.04); ctx.lineTo(cx + i * 0.09, sy + sh); ctx.stroke(); }
      // 目标：每拍一个新位置，被击中时炸开
      const bt = Math.floor(u), ft = fract(u);
      const tx = cx + Math.sin(bt * 2.3) * 0.16, ty = cy - 0.03 + Math.cos(bt * 1.7) * 0.06;
      if (ft < 0.55) G.disc(ctx, tx, ty, 0.028 * (1 - ft), C.acc);
      burst(ctx, tx, ty, ft / 0.6, 0.07, C, 6);
      // 准星（跟着目标跳）
      const px = lerp(cx + Math.sin((bt - 1) * 2.3) * 0.16, tx, E.oExp(clamp(ft * 4))), py = lerp(cy - 0.03 + Math.cos((bt - 1) * 1.7) * 0.06, ty, E.oExp(clamp(ft * 4)));
      G.ring(ctx, px, py, 0.04 + pulse * 0.02, 0.006, C.fg);
      G.seg(ctx, [px - 0.07, py], [px - 0.03, py], 0.006, C.fg); G.seg(ctx, [px + 0.03, py], [px + 0.07, py], 0.006, C.fg);
      G.seg(ctx, [px, py - 0.07], [px, py - 0.03], 0.006, C.fg); G.seg(ctx, [px, py + 0.03], [px, py + 0.07], 0.006, C.fg);
      // 血条 / 比分
      ctx.fillStyle = C.fg; ctx.fillRect(sx + 0.03, sy + 0.03, 0.16 * (1 - u * 0.05), 0.014);
      ctx.fillStyle = C.acc; ctx.fillRect(sx + sw - 0.19, sy + 0.03, 0.16 * (0.9 - bt * 0.2), 0.014);
      ctx.restore();
      ctx.restore();
    },
    front: (ctx, J, u, C) => {
      // 键盘 + 鼠标
      ctx.fillStyle = C.acc; ctx.fillRect(0.25, ES_Y - 0.06, 0.12, 0.03);
      G.disc(ctx, J.aR[2][0] + 0.015, ES_Y - 0.05, 0.022, C.acc);
      // 耳机：头梁 + 耳罩 + 麦克风
      const h = J.head, a = (J.p.torso + J.p.head) * D2R;
      ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(a);
      ctx.strokeStyle = C.acc; ctx.lineWidth = 0.022; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, 0.1, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      G.disc(ctx, -0.02, 0.0, 0.05, C.acc);
      G.seg(ctx, [-0.02, 0.02], [0.08, 0.08], 0.012, C.acc);
      G.disc(ctx, 0.08, 0.08, 0.014, C.acc);
      ctx.restore();
    },
  };
})();
