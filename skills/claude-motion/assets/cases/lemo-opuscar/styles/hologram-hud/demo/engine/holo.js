// hologram-hud · 全息线框引擎
// 读 JSON 线框模型（顶点 / 边 / 四边面），负责：透视投影、转台旋转、扫描生长、局部爆炸、
// 零件自转、实心全息面（菲涅尔）、景深衰减、两级辉光。纯 Canvas 2D，确定性（只依赖参数）。
//
//   const model = await loadModel('models/volt.json');
//   const H = new Holo(1920, 1080);
//   const info = H.draw(ctx, model, cam, { hue: 190, scan: { y: 0.6 }, explode: { battery: 1 } });
//   info.bbox.battery -> [x0, y0, x1, y1]   info.anchor.battery -> [sx, sy]
//
// cam = { target:[x,y,z], yaw, pitch, dist, fov(弧度), cx, cy(屏幕上 target 的位置), roll }

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

export async function loadModel(url, o = {}) {
  const j = await (await fetch(url)).json();
  const m = prepModel(j);
  return o.normalize === false ? m : normalizeModel(m, o.diag);
}
export function prepModel(j) {
  let ymin = 1e9, ymax = -1e9;
  for (const P of j.parts) for (const C of P.pieces) {
    C.v = Float32Array.from(C.v); C.e = Uint32Array.from(C.e); C.q = Uint32Array.from(C.q || []);
    C.part = P.id; C.n = C.v.length / 3;
    for (let i = 1; i < C.v.length; i += 3) { ymin = Math.min(ymin, C.v[i]); ymax = Math.max(ymax, C.v[i]); }
  }
  j.ymin = ymin; j.ymax = ymax;
  j.byId = Object.fromEntries(j.parts.map(P => [P.id, P]));
  return j;
}

// 归一化：把任意尺寸的模型缩放到统一的"舞台尺寸"（包围盒对角线 = diag，默认 2.3117 = demo 里的自行车），
// x/z 居中、落地 y = 0。锚点、中心、爆炸向量、自转轴一起缩放。镜头参数因此可以跨产品复用。
export function normalizeModel(m, diag = 2.3117) {
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const P of m.parts) for (const C of P.pieces) for (let i = 0; i < C.v.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], C.v[i + k]); mx[k] = Math.max(mx[k], C.v[i + k]); }
  const s = diag / Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
  const o = [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2];
  const T = p => [(p[0] - o[0]) * s, (p[1] - o[1]) * s, (p[2] - o[2]) * s];
  for (const P of m.parts) {
    P.anchor = T(P.anchor); if (P.center) P.center = T(P.center);
    for (const C of P.pieces) {
      for (let i = 0; i < C.v.length; i += 3) { C.v[i] = (C.v[i] - o[0]) * s; C.v[i + 1] = (C.v[i + 1] - o[1]) * s; C.v[i + 2] = (C.v[i + 2] - o[2]) * s; }
      C.explode = C.explode.map(x => x * s);
      if (C.axis) C.axis = { c: T(C.axis.c), d: C.axis.d };
    }
  }
  m.ymin = 0; m.ymax = (mx[1] - mn[1]) * s; m.scale = s;
  return m;
}

// 相机：返回 project(p) -> [sx, sy, z]
export function makeCamera(cam, W, H) {
  const { target: T, yaw, pitch, dist } = cam;
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const eye = [T[0] + dist * sy * cp, T[1] + dist * sp, T[2] + dist * cy * cp];
  // 前向 f = T - eye；右 r = f × up；上 u = r × f
  let f = [T[0] - eye[0], T[1] - eye[1], T[2] - eye[2]]; const fl = Math.hypot(...f); f = f.map(x => x / fl);
  let r = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]; const rl = Math.hypot(...r); r = r.map(x => x / rl);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const foc = (H / 2) / Math.tan((cam.fov || 0.6) / 2);
  const cx = cam.cx ?? W / 2, cyy = cam.cy ?? H / 2, roll = cam.roll || 0, cr = Math.cos(roll), sr = Math.sin(roll);
  const project = (x, y, z, out) => {
    const dx = x - eye[0], dy = y - eye[1], dz = z - eye[2];
    const zc = dx * f[0] + dy * f[1] + dz * f[2];
    const xc = dx * r[0] + dy * r[1] + dz * r[2], yc = dx * u[0] + dy * u[1] + dz * u[2];
    const k = foc / Math.max(zc, 0.02);
    const X = xc * k, Y = -yc * k;
    out[0] = cx + X * cr - Y * sr; out[1] = cyy + X * sr + Y * cr; out[2] = zc;
    return out;
  };
  return { project, eye, f, dist, foc };
}

// 主体绘制器（持有离屏层，复用）
export class Holo {
  constructor(W = 1920, H = 1080) {
    this.W = W; this.H = H;
    this.L = mk(W, H);                         // 线框层
    this.G1 = mk(W / 4, H / 4); this.G2 = mk(W / 8, H / 8);   // 辉光
    this.F = mk(W, H);                                          // 实心面层（隔行扫描纹理）
    const pc = mk(1, 4), pg = pc.getContext('2d');
    pg.fillStyle = 'rgba(0,0,0,1)'; pg.fillRect(0, 0, 1, 2); pg.fillStyle = 'rgba(0,0,0,0.38)'; pg.fillRect(0, 2, 1, 2);
    this.scanPat = this.F.getContext('2d').createPattern(pc, 'repeat');
    this.tmp = new Float32Array(3);
  }
  // opts:
  //  hue            主色相（0–360）
  //  spin           转台角（弧度，绕 y 轴，中心 spinC）
  //  scan           { y, band=0.06, hot=1 }：只画 y 以下（世界高度），扫描前沿发白；null=全部
  //  scanDown       { y }：反向——只画 y 以下（从上往下擦掉），用于收尾
  //  explode        { partId | pieceId : 0–1 }
  //  angle          { pieceId : 弧度 } 沿 piece.axis 自转
  //  solid          0–1 实心全息面
  //  focus          partId：其余零件压暗到 dim
  //  dim            0–1（focus 之外的亮度）
  //  gain           整体亮度
  //  only           [partId] 只画这些
  //  keep           { pieceId: color } 唯一彩色：这些零件保持自己的颜色（hex）
  //  glow           辉光强度（默认 1）
  //  wave           { y, w }：世界高度 y 附近 ±w 的边和面加亮（沿车身上行的光波）
  //  piece.hot      模型里标 hot 的 piece 爆炸时整体发白（例如电芯）
  //  flash          { partId: 0–1 }：>0.5 时整个零件发白（热点打点时闪一下）
  draw(ctx, model, cam, o = {}) {
    const { W, H } = this, L = this.L, g = L.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    const C = makeCamera(cam, W, H), P = C.project, t3 = this.tmp;
    const hue = o.hue ?? 190, gain = o.gain ?? 1, solid = o.solid || 0;
    const spin = o.spin || 0, cs = Math.cos(spin), sn = Math.sin(spin), sc = o.spinC || [0, 0, 0];
    const scan = o.scan, sy = scan ? scan.y : Infinity, band = scan?.band ?? 0.06;
    const down = o.scanDown, wave = o.wave;
    const info = { bbox: {}, anchor: {}, project: P, cam: C, dots: 0 };
    // 深度范围（用于雾化）
    const dN = C.dist - 1.1, dF = C.dist + 1.1;
    const LV = 7;                                        // 透明度量化级数
    const paths = [], hot = [], fills = [];
    for (let i = 0; i < LV; i++) { paths.push(new Path2D()); hot.push(new Path2D()); fills.push(new Path2D()); }
    const keepPaths = {};
    const dots = new Path2D();
    const tr = (x, y, z, out) => {   // 转台
      const dx = x - sc[0], dz = z - sc[2];
      out[0] = sc[0] + dx * cs + dz * sn; out[1] = y; out[2] = sc[2] - dx * sn + dz * cs;
      return out;
    };
    for (const Pt of model.parts) {
      if (o.only && !o.only.includes(Pt.id)) continue;
      const focusMul = o.focus && o.focus !== Pt.id ? (o.dim ?? 0.25) : 1;
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      for (const Pc of Pt.pieces) {
        const k = o.explode ? (o.explode[Pc.id] ?? o.explode[Pt.id] ?? 0) : 0;
        const vis = Pc.internal ? clamp(k * 3) : 1;
        if (vis <= 0.001) continue;
        const ang = o.angle ? (o.angle[Pc.id] || 0) : 0;
        const ex = Pc.explode[0] * k, ey = Pc.explode[1] * k, ez = Pc.explode[2] * k;
        const n = Pc.n, V = Pc.v;
        const S = new Float32Array(n * 3), Y = new Float32Array(n);   // 屏幕坐标 + 世界高度
        let ca = 1, sa = 0, ax = null;
        if (ang && Pc.axis) { ca = Math.cos(ang); sa = Math.sin(ang); ax = Pc.axis; }
        for (let i = 0; i < n; i++) {
          let x = V[i * 3], y = V[i * 3 + 1], z = V[i * 3 + 2];
          if (ax) { const dx = x - ax.c[0], dy = y - ax.c[1]; x = ax.c[0] + dx * ca - dy * sa; y = ax.c[1] + dx * sa + dy * ca; }   // 只支持 z 轴自转
          x += ex; y += ey; z += ez;
          Y[i] = y;
          tr(x, y, z, t3); P(t3[0], t3[1], t3[2], t3);
          S[i * 3] = t3[0]; S[i * 3 + 1] = t3[1]; S[i * 3 + 2] = t3[2];
          if (y <= sy && !Pc.internal && Pc.box !== false) {   // 目标框用静止姿态（不含爆炸位移、内部件）
            let bx = t3[0], by = t3[1];
            if (k) { tr(x - ex, y - ey, z - ez, t3); P(t3[0], t3[1], t3[2], t3); bx = t3[0]; by = t3[1]; }
            if (bx < bx0) bx0 = bx; if (bx > bx1) bx1 = bx; if (by < by0) by0 = by; if (by > by1) by1 = by;
          }
        }
        const keep = o.keep && o.keep[Pc.id];
        let kp = null; if (keep) kp = keepPaths[keep] || (keepPaths[keep] = { p: new Path2D(), f: new Path2D() });
        const E = Pc.e, mulA = focusMul * vis * gain;
        for (let j = 0; j < E.length; j += 2) {
          const a = E[j], b = E[j + 1];
          let ya = Y[a], yb = Y[b];
          let x0 = S[a * 3], y0 = S[a * 3 + 1], x1 = S[b * 3], y1 = S[b * 3 + 1];
          const zm = (S[a * 3 + 2] + S[b * 3 + 2]) / 2;
          if (scan) {
            if (ya > sy && yb > sy) continue;
            if (ya > sy || yb > sy) {   // 剪到扫描面
              const tcut = (sy - ya) / (yb - ya);
              const xi = x0 + (x1 - x0) * tcut, yi = y0 + (y1 - y0) * tcut;
              if (ya > sy) { x0 = xi; y0 = yi; ya = sy; } else { x1 = xi; y1 = yi; yb = sy; }
              dots.rect(xi - 1.5, yi - 1.5, 3, 3); info.dots++;
            }
          }
          if (down) {   // 反向擦除：只留 y 以下，截断处打点
            if (ya > down.y && yb > down.y) continue;
            if (ya > down.y || yb > down.y) {
              const tcut = (down.y - ya) / (yb - ya);
              const xi = x0 + (x1 - x0) * tcut, yi = y0 + (y1 - y0) * tcut;
              if (ya > down.y) { x0 = xi; y0 = yi; ya = down.y; } else { x1 = xi; y1 = yi; yb = down.y; }
              dots.rect(xi - 1.5, yi - 1.5, 3, 3);
            }
          }
          const fog = clamp(1 - (zm - dN) / (dF - dN) * 0.75, 0.22, 1);
          const lv = Math.min(LV - 1, Math.floor(fog * mulA * LV));
          if (lv < 0 || fog * mulA < 0.03) continue;
          const ymid = (ya + yb) / 2;
          const isHot = (scan && Math.max(ya, yb) > sy - band) || (down && Math.max(ya, yb) > down.y - 0.05) || (Pc.hot && k > 0.02) || (wave && Math.abs(ymid - wave.y) < wave.w) || (o.flash && o.flash[Pt.id] > 0.5);
          const target = kp ? kp.p : (isHot ? hot[lv] : paths[lv]);
          target.moveTo(x0, y0); target.lineTo(x1, y1);
        }
        if (solid > 0) {
          const Q = Pc.q;
          for (let j = 0; j < Q.length; j += 4) {
            const a = Q[j], b = Q[j + 1], c = Q[j + 2], d = Q[j + 3];
            if (scan && Math.max(Y[a], Y[b], Y[c], Y[d]) > sy) continue;
            if (down && Math.max(Y[a], Y[b], Y[c], Y[d]) > down.y) continue;
            // 屏幕空间面积法线近似菲涅尔：面越侧（投影越窄）越亮
            const ax_ = S[a * 3], ay_ = S[a * 3 + 1], bx_ = S[b * 3], by_ = S[b * 3 + 1], cx_ = S[c * 3], cy_ = S[c * 3 + 1], dx_ = S[d * 3], dy_ = S[d * 3 + 1];
            const area = Math.abs((cx_ - ax_) * (dy_ - by_) - (dx_ - bx_) * (cy_ - ay_)) / 2;
            const e1 = Math.hypot(bx_ - ax_, by_ - ay_), e2 = Math.hypot(dx_ - ax_, dy_ - ay_);
            const facing = clamp(area / Math.max(1e-3, e1 * e2));   // 1 = 正对，0 = 侧面
            let fr = 0.3 + 0.7 * Math.pow(1 - facing, 1.6);   // 菲涅尔：侧面（轮廓）更亮
            if (wave) { const ym = (Y[a] + Y[c]) / 2, dw = Math.abs(ym - wave.y); if (dw < wave.w * 2) fr += (1 - dw / (wave.w * 2)) * 0.9; }
            const lv = Math.min(LV - 1, Math.floor(fr * solid * focusMul * vis * gain * LV));
            if (lv < 1) continue;
            const T = kp ? kp.f : fills[lv];
            T.moveTo(ax_, ay_); T.lineTo(bx_, by_); T.lineTo(cx_, cy_); T.lineTo(dx_, dy_); T.closePath();
          }
        }
      }
      if (bx1 > bx0) info.bbox[Pt.id] = [bx0, by0, bx1, by1];
      const an = Pt.anchor; tr(an[0], an[1], an[2], t3); P(t3[0], t3[1], t3[2], t3); info.anchor[Pt.id] = [t3[0], t3[1], t3[2]];
    }
    // 画：面 → 线 → 热线 → 交点
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    if (solid > 0) {
      const F = this.F, f = F.getContext('2d');
      f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, W, H);
      f.globalCompositeOperation = 'lighter';
      for (let i = 1; i < LV; i++) { f.fillStyle = `hsla(${hue},90%,${55 + i * 5}%,${0.1 + (i / LV) * 0.6})`; f.fill(fills[i]); }
      f.globalCompositeOperation = 'destination-in'; f.setTransform(1, 0, 0, 1, 0, (o.scanOffset || 0) % 4); f.fillStyle = this.scanPat; f.fillRect(0, -8, W, H + 16); f.setTransform(1, 0, 0, 1, 0, 0);
      f.globalCompositeOperation = 'source-over';
      g.drawImage(F, 0, 0);
    }
    const lw = o.lineWidth || 1.35;
    for (let i = 0; i < LV; i++) {
      const a = (i + 1) / LV;
      g.strokeStyle = `hsla(${hue},100%,${50 + a * 30}%,${0.06 + a * 0.84})`; g.lineWidth = lw * (0.7 + a * 0.5);
      g.stroke(paths[i]);
    }
    for (let i = 0; i < LV; i++) { const a = (i + 1) / LV; g.strokeStyle = `hsla(${hue},70%,92%,${0.35 + a * 0.65})`; g.lineWidth = lw * 1.3; g.stroke(hot[i]); }
    for (const col in keepPaths) { g.fillStyle = col + '30'; g.fill(keepPaths[col].f); g.strokeStyle = col; g.lineWidth = lw * 1.2; g.stroke(keepPaths[col].p); }
    if ((scan && sy < 1e8) || down) { g.fillStyle = `hsla(${hue},60%,96%,1)`; g.fill(dots); }
    g.globalCompositeOperation = 'source-over';
    this.composite(ctx, o.glow ?? 1, o.alpha ?? 1);
    return info;
  }
  // 把线框层 + 两级辉光叠到目标画布
  composite(ctx, glow = 1, alpha = 1) {
    const { L, G1, G2, W, H } = this;
    const g1 = G1.getContext('2d'), g2 = G2.getContext('2d');
    g1.clearRect(0, 0, G1.width, G1.height); g1.filter = 'blur(3px)'; g1.drawImage(L, 0, 0, G1.width, G1.height); g1.filter = 'none';
    g2.clearRect(0, 0, G2.width, G2.height); g2.filter = 'blur(4px)'; g2.drawImage(L, 0, 0, G2.width, G2.height); g2.filter = 'none';
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85 * glow * alpha; ctx.drawImage(G1, 0, 0, W, H);
    ctx.globalAlpha = 0.7 * glow * alpha; ctx.drawImage(G2, 0, 0, W, H);
    ctx.globalAlpha = alpha; ctx.drawImage(L, 0, 0);
    ctx.restore();
  }
}

// 扫描面：在世界高度 y 处画一圈投影环 + 径向刻度 + 屏幕上的光幕
export function drawScanPlane(ctx, cam, W, H, y, o = {}) {
  const C = makeCamera(cam, W, H), P = C.project, t = new Float32Array(3);
  const hue = o.hue ?? 190, R = o.r ?? 0.95, c = o.c || [0, 0, 0], a = o.alpha ?? 1;
  const pts = [];
  for (let i = 0; i <= 96; i++) { const th = i / 96 * TAU; P(c[0] + Math.cos(th) * R, y, c[2] + Math.sin(th) * R, t); pts.push([t[0], t[1]]); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // 光幕：椭圆内填充
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
  ctx.fillStyle = `hsla(${hue},90%,60%,${0.07 * a})`; ctx.fill();
  ctx.strokeStyle = `hsla(${hue},80%,85%,${0.75 * a})`; ctx.lineWidth = 1.6; ctx.stroke();
  // 刻度
  ctx.beginPath();
  for (let i = 0; i < 72; i++) {
    const th = i / 72 * TAU + (o.rot || 0), r2 = R * (i % 6 ? 1.03 : 1.07);
    P(c[0] + Math.cos(th) * R, y, c[2] + Math.sin(th) * R, t); ctx.moveTo(t[0], t[1]);
    P(c[0] + Math.cos(th) * r2, y, c[2] + Math.sin(th) * r2, t); ctx.lineTo(t[0], t[1]);
  }
  ctx.strokeStyle = `hsla(${hue},80%,80%,${0.5 * a})`; ctx.lineWidth = 1; ctx.stroke();
  // 屏幕空间光幕（横向渐隐）
  P(c[0], y, c[2], t); const yy = t[1];
  const gr = ctx.createLinearGradient(0, yy - 60, 0, yy + 60);
  gr.addColorStop(0, `hsla(${hue},90%,60%,0)`); gr.addColorStop(0.5, `hsla(${hue},90%,70%,${0.10 * a})`); gr.addColorStop(1, `hsla(${hue},90%,60%,0)`);
  ctx.fillStyle = gr; ctx.fillRect(0, yy - 60, W, 120);
  const gl = ctx.createLinearGradient(0, 0, W, 0);
  gl.addColorStop(0, `hsla(${hue},90%,80%,0)`); gl.addColorStop(0.5, `hsla(${hue},90%,85%,${0.55 * a})`); gl.addColorStop(1, `hsla(${hue},90%,80%,0)`);
  ctx.fillStyle = gl; ctx.fillRect(0, yy - 0.75, W, 1.5);
  ctx.restore();
}

// 投影台：地面上的同心环 + 刻度 + 放射网格（跟着相机透视）
export function drawPad(ctx, cam, W, H, o = {}) {
  const C = makeCamera(cam, W, H), P = C.project, t = new Float32Array(3);
  const hue = o.hue ?? 190, a = o.alpha ?? 1, rot = o.rot || 0, y = o.y ?? 0, c = o.c || [0, 0, 0];
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const ring = (R, al, w = 1, dash = 0) => {
    ctx.beginPath();
    for (let i = 0; i <= 128; i++) { const th = i / 128 * TAU; P(c[0] + Math.cos(th) * R, y, c[2] + Math.sin(th) * R, t); i ? ctx.lineTo(t[0], t[1]) : ctx.moveTo(t[0], t[1]); }
    ctx.setLineDash(dash ? [dash, dash * 1.6] : []);
    ctx.strokeStyle = `hsla(${hue},80%,70%,${al * a})`; ctx.lineWidth = w; ctx.stroke();
  };
  ring(1.05, 0.55, 1.4); ring(1.12, 0.3, 1, 6); ring(0.7, 0.18, 1); ring(1.45, 0.14, 1); ring(2.1, 0.07, 1);
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = 0; i < 120; i++) {
    const th = i / 120 * TAU + rot, big = i % 10 === 0, r0 = 1.05, r1 = big ? 1.2 : 1.1;
    P(c[0] + Math.cos(th) * r0, y, c[2] + Math.sin(th) * r0, t); ctx.moveTo(t[0], t[1]);
    P(c[0] + Math.cos(th) * r1, y, c[2] + Math.sin(th) * r1, t); ctx.lineTo(t[0], t[1]);
  }
  ctx.strokeStyle = `hsla(${hue},80%,78%,${0.5 * a})`; ctx.lineWidth = 1; ctx.stroke();
  // 放射线 + 地面网格（距离渐隐）
  for (let i = 0; i < 24; i++) {
    const th = i / 24 * TAU + rot * 0.25;
    ctx.beginPath();
    P(c[0] + Math.cos(th) * 1.2, y, c[2] + Math.sin(th) * 1.2, t); ctx.moveTo(t[0], t[1]);
    P(c[0] + Math.cos(th) * 2.4, y, c[2] + Math.sin(th) * 2.4, t); ctx.lineTo(t[0], t[1]);
    ctx.strokeStyle = `hsla(${hue},70%,60%,${0.08 * a})`; ctx.stroke();
  }
  ctx.restore();
}

function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; }

// 任意形状 → 线框模型：给一条 2D 闭合路径（米），挤出成有厚度的线框体（前后轮廓 + 侧棱 + 侧面四边面 + 若干中间截面）。
// 例：modelFromPath(starPts, { depth: 0.12, id: 'star', slices: 3 }) → 可直接交给 Holo.draw（可扫描、可爆炸、可实心）
export function modelFromPath(pts, o = {}) {
  const d = o.depth ?? 0.1, id = o.id || 'shape', sl = Math.max(2, o.slices ?? 3), n = pts.length;
  const v = [], e = [], q = [];
  for (let k = 0; k < sl; k++) {
    const z = -d / 2 + d * k / (sl - 1);
    for (const [x, y] of pts) v.push(x, y, z);
    for (let i = 0; i < n; i++) e.push(k * n + i, k * n + (i + 1) % n);
  }
  for (let k = 0; k < sl - 1; k++) for (let i = 0; i < n; i++) {
    if (k === 0 || i % (o.ribEvery || 1) === 0) e.push(k * n + i, (k + 1) * n + i);
    q.push(k * n + i, k * n + (i + 1) % n, (k + 1) * n + (i + 1) % n, (k + 1) * n + i);
  }
  const cx = pts.reduce((s, p) => s + p[0], 0) / n, cy = pts.reduce((s, p) => s + p[1], 0) / n;
  return prepModel({ name: id, parts: [{ id, anchor: [cx, cy, d / 2], pieces: [{ id, explode: o.explode || [0, 0, 0], v, e, q }] }] });
}
