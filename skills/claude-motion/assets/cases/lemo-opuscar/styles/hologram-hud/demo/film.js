// 《Volt · Spec Scan》场景编排：所有文案来自 content.json，时间线按条目数自动重排（120 BPM，1 小节 = 2 s）
import { Holo, drawScanPlane, drawPad } from './engine/holo.js';
import * as U from './engine/hud.js';
const { clamp } = U;
const W = 1920, H = 1080, BEAT = 0.5, BAR = 2;
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const eo = t => 1 - Math.pow(1 - clamp(t), 3);
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const sine = t => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t));
let YK = 1;   // 模型高度 / demo 自行车高度（1.02）：扫描高度、镜头目标高度按它缩放

// ---------- 时间线 ----------
export function buildTimeline(C, dur = {}) {
  const n = C.callouts.length;
  const TL = { intro: [0, 4 * BAR], calls: [] };
  let t = TL.intro[1];
  const modes = ['push', 'orbit', 'loupe'];
  C.callouts.forEach((c, i) => {
    const bars = i === 0 ? 3 : 2;              // 第一个慢讲，之后加速
    TL.calls.push({ i, c, mode: modes[i % 3], t0: t, t1: t + bars * BAR, long: bars === 3 });
    t += bars * BAR;
  });
  TL.regroup = [t, t + BAR]; t += BAR;
  TL.high = [t, t + 2 * BAR]; t += 2 * BAR;
  TL.lock = [t, t + 3 * BAR]; t += 3 * BAR;
  TL.end = [t, t + 5]; t += 5;
  TL.DUR = t;
  // 旁白起点（拍点上）
  TL.vo = [{ id: 'intro', t: 3.0, text: C.intro_vo }];
  TL.calls.forEach(s => TL.vo.push({ id: 'c' + s.i, t: s.t0 + (s.long ? 1.0 : 0.25), text: s.c.vo }));
  TL.vo.push({ id: 'outro', t: TL.lock[0] + 1.0, text: C.outro_vo });
  for (const v of TL.vo) v.d = dur[v.id] ?? v.text.split(' ').length / 2.6;
  return TL;
}

// 每个参数卡的内部节拍（相对锁定时刻）
function callBeats(s) {
  const k = s.long ? 1 : 0.5;
  return {
    push: 1.5 * k + (s.long ? 0 : 0.25),
    ex0: 1.0 * k, ex1: 2.0 * k + (s.long ? 0 : 0.25),
    lab: s.long ? 2.0 : 1.0, roll0: 2.0 * k + (s.long ? 0 : 0.5), roll1: 3.0 * k + (s.long ? 0 : 0.5),
    det: 2.0 * k + (s.long ? 0 : 0.5),
  };
}

// ---------- 相机 ----------
const CAM = {
  hook: { target: [0.05, 0.50, 0], yaw: 1.00, pitch: 0.24, dist: 2.7, cx: 0.56, cy: 0.54, roll: 0 },
  introEnd: { target: [0.0, 0.52, 0], yaw: 0.42, pitch: 0.12, dist: 2.85, cx: 0.60, cy: 0.49, roll: 0 },
  loupe: { target: [0.02, 0.52, 0], yaw: 0.30, pitch: 0.10, dist: 3.5, cx: 0.42, cy: 0.47, roll: 0 },
  regroup: { target: [0.0, 0.52, 0], yaw: 0.62, pitch: 0.00, dist: 3.05, cx: 0.60, cy: 0.49, roll: 0 },
  lock: { target: [0.0, 0.52, 0], yaw: 0.62, pitch: 0.17, dist: 3.5, cx: 0.51, cy: 0.47, roll: 0 },
};
function partCam(model, s, u) {
  const P = model.byId[s.c.part], a = P?.center || P?.anchor || [0, 0.5, 0];
  if (s.mode === 'push') return { target: a, yaw: lerp(0.66, 0.78, u), pitch: 0.2, dist: lerp(1.62, 1.5, u), cx: 0.37, cy: 0.5, roll: 0 };
  if (s.mode === 'orbit') return { target: a, yaw: lerp(-0.2, 0.8, sine(u)), pitch: 0.14, dist: 1.35, cx: 0.48, cy: 0.5, roll: 0 };
  return { ...CAM.loupe, cx: lerp(0.49, 0.475, u) };   // 右移，给左栏芯片留出干净的空间
}
const mixCam = (A, B, w) => ({
  target: A.target.map((x, i) => lerp(x, B.target[i], w)),
  yaw: lerp(A.yaw, B.yaw, w), pitch: lerp(A.pitch, B.pitch, w), dist: Math.exp(lerp(Math.log(A.dist), Math.log(B.dist), w)),
  cx: lerp(A.cx, B.cx, w), cy: lerp(A.cy, B.cy, w), roll: lerp(A.roll || 0, B.roll || 0, w),
});
function segCam(model, TL, t) {
  const [i0, i1] = TL.intro;
  if (t < i1) {
    const u = seg(t, 0, i1);
    return mixCam(CAM.hook, CAM.introEnd, eo(u * 1.1));
  }
  for (const s of TL.calls) if (t < s.t1) {
    const u = seg(t, s.t0, s.t1), b = callBeats(s);
    const prev = s.i === 0 ? CAM.introEnd : partCam(model, TL.calls[s.i - 1], 1);
    let here = partCam(model, s, u);
    // 进入：第一个用推（慢），之后用甩（快，跟着目标框；甩镜跨段：下一段锁定前 0.45 s 开始）
    if (s.i === 0) here = mixCam(prev, here, eio(seg(t, s.t0, s.t0 + b.push)));
    else here = mixCam(prev, here, eio(seg(t, s.t0 - 0.45, s.t0 + 0.05)));
    const nx = TL.calls[s.i + 1];
    if (nx && t > nx.t0 - 0.45) here = mixCam(partCam(model, s, 1), partCam(model, nx, 0), eio(seg(t, nx.t0 - 0.45, nx.t0 + 0.05)));
    return here;
  }
  const last = TL.calls[TL.calls.length - 1];
  if (t < TL.regroup[1]) return mixCam(partCam(model, last, 1), CAM.regroup, eio(seg(t, TL.regroup[0], TL.regroup[0] + 1.4)));
  if (t < TL.high[1]) {
    const u = seg(t, TL.high[0], TL.high[1]);
    return { ...CAM.regroup, pitch: lerp(0, 0.22, sine(u)), dist: lerp(3.05, 2.8, sine(u)), cx: lerp(0.60, 0.585, u) };
  }
  const u = seg(t, TL.lock[0], TL.lock[1]);
  const hi = { ...CAM.regroup, pitch: 0.22, dist: 2.8, cx: 0.585 };
  if (t < TL.lock[1]) return mixCam(hi, { ...CAM.lock, dist: lerp(3.5, 3.4, u) }, eio(seg(t, TL.lock[0], TL.lock[0] + 1.5)));
  return { ...CAM.lock, dist: 3.4 };
}
import { makeCamera } from './engine/holo.js';
const projOf = cam => makeCamera(cam, W, H).project;
const spinPt = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
// 把 cx/cy 比例换成像素
const px = c => ({ ...c, cx: c.cx * W, cy: c.cy * H, fov: 0.6 });

// ---------- 主渲染 ----------
export function makeFilm(C, model, dur) {
  YK = (model.ymax || 1.02) / 1.02;
  for (const k in CAM) { CAM[k].target0 = CAM[k].target0 || CAM[k].target; CAM[k].target = [CAM[k].target0[0], CAM[k].target0[1] * YK, CAM[k].target0[2]]; }
  const T = U.theme(C.hue, C.accent);
  const TL = buildTimeline(C, dur);
  const holo = new Holo(W, H), loupeHolo = new Holo(W, H);
  const n = C.callouts.length;
  const railStep = Math.min(112, 410 / Math.max(1, n - 1)), railY = i => 470 + i * railStep;

  // 甩镜运动模糊：只在甩的 0.5 s 里，按 180° 快门（1/48 s）取 5 个子帧做累积平均
  const accC = document.createElement('canvas'); accC.width = W; accC.height = H;
  const subC = document.createElement('canvas'); subC.width = W; subC.height = H;
  function whipK(t) { for (const s of TL.calls) if (s.i > 0 && t > s.t0 - 0.45 && t < s.t0 + 0.05) return Math.sin(Math.PI * seg(t, s.t0 - 0.45, s.t0 + 0.05)); return 0; }
  function render(ctx, t, opt = {}) {
    if (opt.noblur || whipK(t) < 0.05) return renderFrame(ctx, t, opt);
    const N = 5, shutter = 1 / 48, a = accC.getContext('2d'), sg = subC.getContext('2d');
    a.globalAlpha = 1; a.globalCompositeOperation = 'source-over';
    for (let k = 0; k < N; k++) {
      const tk = t + (k / (N - 1) - 0.5) * shutter;
      sg.setTransform(1, 0, 0, 1, 0, 0); renderFrame(sg, tk, { ...opt, frameT: t });
      a.globalAlpha = 1 / (k + 1); a.drawImage(subC, 0, 0);
    }
    ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(accC, 0, 0); ctx.restore();
  }
  function renderFrame(ctx, t, opt = {}) {
    const frame = Math.round((opt.frameT ?? t) * 24);
    const cam = px(segCam(model, TL, t));
    // ---- 状态 ----
    let scan = null, scanDown = null, solid = 0, spin = 0, gain = 1, glitchAmt = 0, focus = null, dim = 0.22;
    const explode = {}, angle = {};
    const [i0, i1] = TL.intro;
    if (t < 2.7) scan = { y: lerp(0.2, 1.16, sine(seg(t, -0.35, 2.6))) * YK, band: 0.07 * YK };
    let active = null;
    for (const s of TL.calls) {
      const b = callBeats(s), L = s.t0;
      const out = 1 - eio(seg(t, s.t1 - 0.55, s.t1 - 0.05));
      const k = eo(seg(t, L + b.ex0, L + b.ex1)) * out;
      for (const P of model.byId[s.c.part]?.pieces || []) explode[P.id] = k;
      if (t >= s.t0 - (s.mode === 'loupe' ? 0 : 0.45) && t < s.t1 - 0.05) active = s;   // 甩向放大镜时先别把全车点亮
      if (s.c.part === 'motor' || s.mode === 'orbit') { angle['motor-rotor'] = (t - L) * 1.6 * k; angle['motor-stator'] = -(t - L) * 0.9 * k; }
      angle['brake-rotor'] = (t - L) * 0.8 * k * (s.c.part === 'brakes' ? 1 : 0) + (angle['brake-rotor'] || 0);
    }
    if (active && active.mode !== 'loupe') { focus = active.c.part; dim = 0.13; }
    // 重组：变暗 → 静音一拍 → 点亮
    const [r0, r1] = TL.regroup, [h0, h1] = TL.high;
    if (t >= r0 && t < h0) gain = lerp(1, 0.32, eio(seg(t, r1 - 0.6, r1 - 0.45)));
    if (t >= h0) {
      solid = eo(seg(t, h0, h0 + 0.35));
      gain = 1 + 0.5 * Math.exp(-(t - h0) * 3);
      spin = t < h1 ? eio(seg(t, h0, h1)) * Math.PI * 2 : 0;
      glitchAmt = t < h0 + 0.13 ? 1 - (t - h0) / 0.13 : 0;
    }
    // 点亮后沿车身上行的光波（24.0 一次，和弦换时 26.0 再一次）
    let wave = null;
    if (t >= h0 && t < h0 + 1.4) wave = { y: lerp(-0.1, 1.35, eio(seg(t, h0, h0 + 1.3))), w: 0.07 };
    else if (t >= h0 + 2 && t < h0 + 3.2) wave = { y: lerp(-0.1, 1.35, eio(seg(t, h0 + 2, h0 + 3.1))), w: 0.05 };
    const [e0, e1] = TL.end;
    if (t >= e0) scanDown = { y: lerp(1.2, -0.05, eio(seg(t, e0, e0 + 1.25))) * YK };

    // ---- 背景 ----
    U.background(ctx, W, H, T, { px: -cam.yaw * 260 - cam.cx * 0.2, py: cam.pitch * 300, cx: cam.cx, cy: cam.cy + 40 });
    const padA = t >= e0 ? 1 - seg(t, e0 + 1.0, e0 + 2.0) * 0.6 : clamp(0.25 + t * 0.5);
    drawPad(ctx, cam, W, H, { hue: T.hue, rot: t * 0.12 + spin, alpha: padA * (t >= r0 && t < h0 ? gain : 1) });

    // ---- 投影光柱（点亮之后） ----
    if (solid > 0) U.beam(ctx, T, (x, y, z, o) => { const q = spinPt(x, z, spin); return projOf(cam)(q[0], y, q[1], o); }, solid * (t >= e0 ? 1 - seg(t, e0, e0 + 1.0) : 1), t, { y1: 1.25 * YK });
    // ---- 主体 ----
    const flash = {};
    if (t >= TL.lock[0]) TL.calls.forEach((s, j) => { const tt = TL.lock[0] + 0.5 + j * BEAT / 2; flash[s.c.part] = t >= tt && t < tt + 0.16 ? 1 : 0; });
    const info = holo.draw(ctx, model, cam, { flash,
      hue: T.hue, scan, scanDown, explode, angle, solid, spin, gain, focus, dim, scanOffset: t * 24, wave,
      lineWidth: 1.3 * (1 + (t >= h0 ? 0.5 * Math.exp(-(t - h0) * 1.2) + 0.12 * solid : 0)),
    });
    if (scan && scan.y < 1.15) drawScanPlane(ctx, cam, W, H, scan.y, { hue: T.hue, r: 1.0, rot: t * 0.3, alpha: 1 - seg(t, 2.35, 2.7) });
    if (scanDown && t < e0 + 1.4) drawScanPlane(ctx, cam, W, H, scanDown.y, { hue: T.hue, r: 1.0, rot: -t * 0.3, alpha: 1 - seg(t, e0 + 1.1, e0 + 1.4) });

    // ---- 界面 ----
    const hudA = t >= e0 ? 1 - seg(t, e0, e0 + 0.5) : 1;
    // 片头标题（开场与落版共用左栏）
    const titleIn = clamp(seg(t, 2.0, 2.5) * 1.0), titleOut = 1 - seg(t, i1 - 0.5, i1 - 0.1);
    const titleBack = seg(t, TL.lock[0] + 0.25, TL.lock[0] + 0.9);
    const tA = t < TL.lock[0] ? titleIn * titleOut : titleBack * hudA;
    if (tA > 0) titleBlock(ctx, T, t, frame, tA, t < TL.lock[0] ? { roll: seg(t, 2.0, 2.5), sub: seg(t, 3.0, 3.4), tag: seg(t, 3.5, 3.9) } : { roll: seg(t, TL.lock[0] + 0.25, TL.lock[0] + 0.75), sub: 1, tag: 1 });
    // 开场"探测到系统"：三个预备目标框闪一下
    if (t > 5.9 && t < i1) {   // 6.0 / 6.5 / 7.0，7.5 是静音
      TL.calls.forEach((s, j) => {
        const tt = 6.0 + j * 0.5 * (3 / Math.max(3, n));
        const k = seg(t, tt, tt + 0.12) * (1 - seg(t, i1 - 0.35, i1 - 0.05));
        U.targetBox(ctx, T, info.bbox[s.c.part], 0.35 * k, { alpha: 0.55 * k, lockK: 0.2 + 0.1 * Math.sin(t * 20 + j), pad: 10 });
      });
    }
    // 参数卡
    for (const s of TL.calls) {
      const b = callBeats(s), L = s.t0;
      const vis = t >= L - 0.05 && t < s.t1;
      if (!vis) continue;
      const out = 1 - seg(t, s.t1 - 0.4, s.t1 - 0.05);
      const lk = seg(t, L, L + 0.22);
      const flash = t >= L && t < L + 0.12;
      const idx = String(s.i + 1).padStart(2, '0');
      if (s.mode !== 'loupe') U.targetBox(ctx, T, info.bbox[s.c.part], lk, { alpha: out, flash, tag: `TGT ${idx} · LOCK`, pad: 22 });
      let anchor = info.anchor[s.c.part];
      const card = { x: 1240, y: 318 };
      if (s.mode === 'loupe') {
        const lp = loupe(ctx, T, t, s, b, model, cam, info, explode, angle, out);
        anchor = lp.anchor; card.x = 1290; card.y = 640;
      }
      const lp = seg(t, L + b.lab - 0.25, L + b.lab + 0.25);
      if (s.mode !== 'loupe') {
        const elbow = [lerp(anchor[0], card.x - 30, 0.55), card.y];
        U.leader(ctx, T, anchor, elbow, [card.x - 12, card.y], lp, { alpha: out, pulse: t > L + b.roll1 ? seg(t, L + b.roll1, L + b.roll1 + 0.5) : 0 });
      }
      const rl = seg(t, L + b.roll0, L + b.roll1);
      U.specCard(ctx, T, card.x, card.y, s.c, {
        reveal: seg(t, L + b.lab, L + b.lab + 0.4), roll: rl, detail: seg(t, L + b.det, L + b.det + 0.6), frame,
        flash: t >= L + b.roll1 && t < L + b.roll1 + 0.1,
      }, { index: idx, alpha: out, w: s.mode === 'loupe' ? 440 : 470, big: s.mode === 'loupe' ? 116 : 136 });
    }
    // 左侧停靠栏：读过的参数
    const lockLead = t >= TL.lock[0] && t < TL.end[0];
    TL.calls.forEach((s, j) => {
      const inA = seg(t, s.t1 - 0.25, s.t1 + 0.1);
      if (inA <= 0) return;
      const x = lerp(140, 110, eo(inA));
      U.chip(ctx, T, x, railY(j), s.c, inA * hudA * (t >= r0 && t < h0 ? Math.max(0.5, gain) : 1), { index: String(j + 1).padStart(2, '0'), w: 360 });
      // 落版：芯片引线接到零件
      if (lockLead) {
        const tt = TL.lock[0] + 0.5 + j * BEAT / 2, lp = seg(t, tt, tt + 0.2);
        U.marker(ctx, T, info.anchor[s.c.part], String(j + 1).padStart(2, '0'), lp * hudA, t > tt ? seg(t, tt, tt + 0.6) : 0, (model.byId[s.c.part].tagDir ?? 1));
      }
    });
    // 落版：右栏重量 / 价格 / 行动
    if (t >= TL.lock[0]) footer(ctx, T, t, frame, TL, C, hudA);
    // 取景框
    U.chrome(ctx, W, H, T, {
      alpha: hudA * (t >= r0 && t < h0 ? Math.max(0.35, gain) : 1),
      tl: `${C.product} ${C.model_code}  //  SPEC SCAN`,
      tr: statusText(t, TL, n, info),
      bl: `HOLO.${String(frame).padStart(4, '0')}  ·  Y ${(scan ? scan.y : 1.16 * YK).toFixed(2)} M`,
      br: `${(cam.yaw * 57.3).toFixed(1)}°  ·  ${(cam.pitch * 57.3).toFixed(1)}°  ·  ${cam.dist.toFixed(2)} M`,
      px: -cam.yaw * 200,
    });
    // 甩镜速度线
    for (const s of TL.calls) if (s.i > 0) {
      const w = seg(t, s.t0 - 0.45, s.t0 + 0.05); if (w > 0 && w < 1) streaks(ctx, T, Math.sin(w * Math.PI), s.i);
    }
    // 字幕
    if (!opt.nosub) {
      const v = subAt(TL, t);
      if (v) U.subtitle(ctx, W, H, T, v.text, v.a * hudA, { t });
    }
    // 片尾卡
    if (t >= e0 + 1.0) endCard(ctx, T, t - (e0 + 1.0), frame, C);
    U.vignette(ctx, W, H, 0.5);
    if (glitchAmt > 0) U.glitch(ctx, W, H, glitchAmt, frame * 7.3);
  }

  function subAt(TL, t) {
    for (const v of TL.vo) {
      const nx = TL.vo[TL.vo.indexOf(v) + 1];
      const end = Math.min(v.t + Math.max(1.8, v.d + 0.6), nx ? nx.t - 0.12 : 1e9);
      if (t >= v.t - 0.1 && t < end) return { text: v.text, a: seg(t, v.t - 0.1, v.t + 0.1) * (1 - seg(t, end - 0.15, end)) };
    }
    return null;
  }

  function statusText(t, TL, n, info) {
    if (t < 2.6) return `SCANNING  ${String(Math.round(clamp(t / 2.6) * 100)).padStart(3, '0')}%`;
    if (t < TL.intro[1]) return `SCAN COMPLETE  ·  ${n} SYSTEMS`;
    for (const s of TL.calls) if (t < s.t1) return `TARGET ${s.i + 1}/${n}  ·  ${s.c.part.toUpperCase()}`;
    if (t < TL.high[0]) return `RECOMPILING`;
    if (t < TL.high[1]) return `HOLO SOLID  ·  360°`;
    return `SPEC SHEET  ·  READY`;
  }

  // 放大镜：画中画，用第二个相机放大零件
  function loupe(ctx, T, t, s, b, model, cam, info, explode, angle, out) {
    const L = s.t0, open = eo(seg(t, L + 0.05, L + 0.5)) * out;
    const R = 225 * open, cxL = 1530, cyL = 355;
    const a = info.anchor[s.c.part] || [W / 2, H / 2];
    if (open <= 0.01) return { anchor: [cxL, cyL] };
    // 连接线：零件小圈 → 放大镜
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = T.line(0.6 * open); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(a[0], a[1], 46, 0, Math.PI * 2); ctx.stroke();
    const ang = Math.atan2(cyL - a[1], cxL - a[0]), perp = ang + Math.PI / 2;
    for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(a[0] + Math.cos(perp) * 46 * sg, a[1] + Math.sin(perp) * 46 * sg); ctx.lineTo(cxL + Math.cos(perp) * R * sg, cyL + Math.sin(perp) * R * sg); ctx.stroke(); }
    ctx.restore();
    // 内容
    const pa = model.byId[s.c.part].center || model.byId[s.c.part].anchor;
    const lc = { target: pa, yaw: lerp(0.75, 0.45, seg(t, L, s.t1)), pitch: 0.16, dist: 0.7, fov: 0.6, cx: cxL, cy: cyL, roll: 0 };
    ctx.save();
    ctx.beginPath(); ctx.arc(cxL, cyL, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(2,10,14,0.92)'; ctx.fillRect(cxL - R, cyL - R, R * 2, R * 2);
    U.background(ctx, W, H, T, { px: t * 20, py: 0, cx: cxL, cy: cyL, alpha: 1.4 });
    const li = loupeHolo.draw(ctx, model, lc, { hue: T.hue, explode, angle, focus: s.c.part, dim: 0.12, lineWidth: 1.5 });
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = T.line(0.9 * open); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cxL, cyL, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = T.dim(0.6 * open); ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) { const th = i / 90 * Math.PI * 2 + t * 0.2, r2 = R + (i % 15 ? 7 : 16); ctx.moveTo(cxL + Math.cos(th) * (R + 3), cyL + Math.sin(th) * (R + 3)); ctx.lineTo(cxL + Math.cos(th) * r2, cyL + Math.sin(th) * r2); }
    ctx.stroke();
    ctx.font = `20px ${U.FONT.mono}`; ctx.fillStyle = T.line(0.85 * open); ctx.textAlign = 'left';
    ctx.fillText(`ZOOM ×${(CAM.loupe.dist / 0.7).toFixed(1)}`, cxL - R + 10, cyL - R - 12);
    ctx.restore();
    // 目标框在放大镜里锁定
    const lk = seg(t, L + 0.25, L + 0.5);
    U.targetBox(ctx, T, li.bbox[s.c.part], lk, { flash: t >= L + 0.25 && t < L + 0.37, pad: 14, tag: `TGT ${String(s.i + 1).padStart(2, '0')} · LOCK`, alpha: out });
    return { anchor: [cxL, cyL + R] };
  }

  function titleBlock(ctx, T, t, frame, a, st) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const x = 110, y = 262;
    ctx.font = `300 176px ${U.FONT.ui}`; ctx.letterSpacing = '26px';
    ctx.fillStyle = T.hi(a);
    ctx.fillText(U.rollText(C.product, st.roll, frame, 5), x - 6, y);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = T.line(0.9 * a); ctx.fillRect(x, y + 26, 360 * eo(st.sub), 2);
    ctx.font = `22px ${U.FONT.mono}`; ctx.fillStyle = T.line(0.9 * a * st.sub);
    ctx.fillText(U.rollText(`${C.model_code}  ·  ${C.category.toUpperCase()}`, st.sub * 1.3, frame, 9), x, y + 62);
    U.fitFont(ctx, C.tagline, 500, 36, U.FONT.ui, 420, 20);
    ctx.fillStyle = T.hi(0.85 * a * st.tag);
    const lines = U.wrap(ctx, C.tagline, 420);
    lines.forEach((l, i) => ctx.fillText(l, x, y + 114 + i * 40));
    ctx.restore();
  }

  function footer(ctx, T, t, frame, TL, C, a) {
    const L0 = TL.lock[0], F = C.footer, x = 1510, w = 330;
    const items = [F.weight, F.price].filter(Boolean);
    U.plate(ctx, T, x - 20, 540, w + 40, (F.cta ? 360 : 300), a * seg(t, L0 + 1.3, L0 + 1.6));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.textAlign = 'left';
    items.forEach((it, j) => {
      const tt = L0 + 1.5 + j * BEAT, r = seg(t, tt, tt + 0.3), roll = seg(t, tt, tt + 0.5);
      if (r <= 0) return;
      const y = 560 + j * 150;
      ctx.strokeStyle = T.line(0.8 * a * r); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * eo(r), y); ctx.stroke();
      ctx.font = `20px ${U.FONT.mono}`; ctx.fillStyle = T.dim(a * r); ctx.fillText(it.label.toUpperCase(), x, y + 30);
      const bs = U.fitFont(ctx, it.value, 300, 92, U.FONT.ui, w - 90, 40);
      const adv = ctx.measureText('0').width * 1.02;
      ctx.fillStyle = roll >= 1 ? T.acc(a) : T.line(0.8 * a);
      const vw = U.monoText(ctx, U.rollText(it.value, roll, frame, 31 + j), x - 3, y + 30 + bs * 0.86, adv);
      ctx.font = `500 ${Math.round(bs * 0.3)}px ${U.FONT.ui}`; ctx.fillStyle = roll >= 1 ? T.acc(0.9 * a) : T.line(0.6 * a);
      ctx.fillText(it.unit || '', x + vw + 8, y + 30 + bs * 0.86);
    });
    if (F.cta) {
      const tt = L0 + 2.5, r = seg(t, tt, tt + 0.35);
      if (r > 0) {
        const y = 860;
        ctx.letterSpacing = '2px';
        U.fitFont(ctx, F.cta.toUpperCase(), 600, 21, U.FONT.ui, w - 30, 14);
        const tw = Math.min(w, ctx.measureText(F.cta.toUpperCase()).width + 30);
        ctx.strokeStyle = T.acc(0.9 * a * r); ctx.lineWidth = 1.5; ctx.strokeRect(x, y - 30, tw * eo(r), 44);
        ctx.fillStyle = T.acc(a * clamp(r * 2 - 1)); ctx.fillText(F.cta.toUpperCase(), x + 15, y);
        ctx.letterSpacing = '0px';
      }
    }
    ctx.restore();
  }

  function endCard(ctx, T, u, frame, C) {
    const a = seg(u, 0, 0.4);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.textAlign = 'center';
    ctx.font = `300 96px ${U.FONT.ui}`; ctx.letterSpacing = '10px'; ctx.fillStyle = T.hi(a);
    ctx.fillText(U.rollText(C.film_title, seg(u, 0, 0.6), frame, 41), W / 2, 420); ctx.letterSpacing = '0px';
    ctx.font = `600 30px ${U.FONT.ui}`; ctx.letterSpacing = '6px'; ctx.fillStyle = T.line(0.9 * seg(u, 0.4, 0.8));
    ctx.fillText('SCI-FI HOLOGRAM HUD', W / 2, 490); ctx.letterSpacing = '0px';
    ctx.fillStyle = T.line(0.6 * seg(u, 0.4, 0.8)); ctx.fillRect(W / 2 - 180, 525, 360, 1.5);
    ctx.font = `500 34px ${U.FONT.ui}`; ctx.fillStyle = T.hi(0.95 * seg(u, 0.8, 1.2));
    ctx.fillText('Lemo-Opuscar', W / 2, 590);
    ctx.font = `22px ${U.FONT.mono}`; ctx.fillStyle = T.line(0.85 * seg(u, 1.0, 1.4));
    ctx.fillText('LemoLab × Claude Opus 5.5', W / 2, 636);
    ctx.font = `20px ${U.FONT.mono}`; ctx.fillStyle = T.dim(0.9 * seg(u, 1.3, 1.7));
    (C.credits || []).forEach((l, i) => ctx.fillText(l, W / 2, 720 + i * 32));
    ctx.restore();
  }

  function streaks(ctx, T, k, seed) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 28; i++) {
      const y = ((Math.sin(i * 91.7 + seed) * 0.5 + 0.5) * H), len = 200 + 600 * Math.abs(Math.sin(i * 13.1)), x = (Math.sin(i * 7.9 + seed * 3) * 0.5 + 0.5) * W;
      ctx.fillStyle = T.line(0.22 * k); ctx.fillRect(x - len / 2, y, len, 1.4);
    }
    ctx.restore();
  }

  // ---------- 声音事件（给混音 / 配乐 / 卡点自检） ----------
  function events() {
    const E = [], ev = (t, type, o = {}) => E.push({ t: +t.toFixed(4), type, ...o });
    ev(0, 'scan', { d: 2.6 });
    for (const y of [0.3, 0.55, 0.8, 1.0]) { // 扫描面经过的高度 → 时间
      let lo = 0, hi = 2.6; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; (lerp(0.2, 1.16, sine(seg(m, -0.35, 2.6))) * YK < y * YK ? lo = m : hi = m); } ev(lo, 'scan_tick', { y });
    }
    ev(2.0, 'roll', { d: 0.5, n: C.product.length }); ev(2.5, 'confirm_small'); ev(2.5, 'scan_done');
    ev(3.0, 'type_line'); ev(3.5, 'type_line');
    TL.calls.forEach((s, j) => ev(6.0 + j * 0.5 * (3 / Math.max(3, n)), 'detect', { i: j }));
    ev(7.5, 'silence', { d: 0.5, kind: 'near' });
    for (const s of TL.calls) {
      const b = callBeats(s), L = s.t0, part = s.c.part;
      if (s.i > 0) ev(L - 0.45, 'whip', { d: 0.5 });
      if (s.i > 0) ev(L - 0.4, 'jcut', { part, d: 0.4 });
      ev(L, 'lock', { i: s.i, part, bar: true });
      if (s.i === 0) ev(L, 'push', { d: b.push });
      if (s.mode === 'loupe') { ev(L + 0.05, 'loupe_open'); ev(L + 0.25, 'lock_small'); ev(s.t1 - 0.4, 'loupe_close'); }
      if (s.mode === 'orbit') ev(L, 'orbit', { d: s.t1 - L });
      ev(L + b.ex0, 'explode', { part, d: b.ex1 - b.ex0 });
      ev(L + b.lab - 0.25, 'leader');
      ev(L + b.roll0, 'roll', { d: b.roll1 - b.roll0, n: String(s.c.value).length });
      ev(L + b.roll1, 'confirm', { i: s.i, bar: true });
      ev(s.t1 - 0.55, 'reassemble', { part });
      ev(s.t1 - 0.25, 'dock', { i: s.i });
    }
    const [r0, r1] = TL.regroup, [h0, h1] = TL.high, L0 = TL.lock[0];
    ev(r0, 'regroup');
    ev(r1 - 1.0, 'powerdown', { d: 0.5 });
    ev(r1 - 0.5, 'silence', { d: 0.5, kind: 'true' });
    ev(h0, 'ignite', { bar: true }); ev(h0, 'glitch', { d: 0.13 }); ev(h0, 'wave', { d: 1.3 }); ev(h0 + 2, 'wave', { d: 1.1 });
    ev(h0, 'spin', { d: h1 - h0 });
    ev(L0 + 0.25, 'roll', { d: 0.5, n: C.product.length });
    TL.calls.forEach((s, j) => ev(L0 + 0.5 + j * BEAT / 2, 'ping', { i: j }));
    ['weight', 'price'].forEach((k, j) => { if (C.footer?.[k]) { ev(L0 + 1.5 + j * BEAT, 'roll', { d: 0.5, n: String(C.footer[k].value).length }); ev(L0 + 2.0 + j * BEAT, 'confirm_small'); } });
    if (C.footer?.cta) ev(L0 + 2.5, 'cta');
    ev(TL.end[0], 'erase', { d: 1.25 });
    ev(TL.end[0] + 1.0, 'card_tick'); ev(TL.end[0] + 1.4, 'card_tick'); ev(TL.end[0] + 1.8, 'card_tick'); ev(TL.end[0] + 2.2, 'card_tick');
    for (const v of TL.vo) ev(v.t, 'vo', { id: v.id, d: v.d });
    return E.sort((a, b) => a.t - b.t);
  }
  function subs() {
    return TL.vo.map((v, i) => { const nx = TL.vo[i + 1]; return { t0: v.t - 0.1, t1: Math.min(v.t + Math.max(1.8, v.d + 0.6), nx ? nx.t - 0.12 : 1e9), text: v.text }; });
  }
  const timeline = () => ({ bpm: 120, bar: BAR, dur: TL.DUR, intro: TL.intro, calls: TL.calls.map(s => ({ i: s.i, part: s.c.part, mode: s.mode, t0: s.t0, t1: s.t1 })), regroup: TL.regroup, high: TL.high, lock: TL.lock, end: TL.end, vo: TL.vo });
  return { render, TL, events, subs, timeline };
}
