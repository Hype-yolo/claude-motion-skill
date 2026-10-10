// 特效：雨（3 张循环）、水花、速度线（流線）、镜头光晕、光条、尾灯光轨
import { rng, rgba, mix, TAU, hash, W, H } from './cel.js';

// 雨丝：drawing = 第几张（3 张循环，12fps 换张）；ang = 倾角（弧度，0 = 竖直）
export function rain(g, e, drawing, o = {}) {
  const R = rng(1000 + (drawing % 3) * 77 + (o.seed || 0));
  const n = o.n ?? 220, ang = o.ang ?? .25, len = o.len ?? [40, 110], a = o.a ?? .35, col = o.col || '#cfe3ff';
  const sx = Math.sin(ang), cy = Math.cos(ang);
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = R() * (W + 400) - 200, y = R() * (H + 200) - 100, L = len[0] + R() * (len[1] - len[0]), near = R();
    g.strokeStyle = rgba(col, a * (.35 + near * .65)); g.lineWidth = .8 + near * (o.w ?? 1.6);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - sx * L, y + cy * L * -1); g.stroke();
    if (e && near > .85) { e.strokeStyle = rgba(col, .18); e.lineWidth = 2; e.beginPath(); e.moveTo(x, y); e.lineTo(x - sx * L, y - cy * L); e.stroke(); }
  }
  g.restore();
}
// 地面水花：小王冠 + 涟漪（y0..y1 之间，透视缩放）
export function splashes(g, drawing, y0, y1, n = 40, col = '#cfe3ff', seed = 0) {
  const R = rng(500 + drawing * 13 + seed);
  g.save(); g.strokeStyle = rgba(col, .45); g.lineWidth = 1.4;
  for (let i = 0; i < n; i++) {
    const y = y0 + R() * (y1 - y0), s = .4 + (y - y0) / (y1 - y0) * 1.2, x = R() * W;
    g.beginPath(); g.ellipse(x, y, 10 * s, 3 * s, 0, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(x - 5 * s, y); g.lineTo(x - 8 * s, y - 9 * s); g.moveTo(x, y - 1); g.lineTo(x, y - 12 * s); g.moveTo(x + 5 * s, y); g.lineTo(x + 8 * s, y - 9 * s); g.stroke();
  }
  g.restore();
}

// 速度线背景：radial（放射，中心 cx,cy）或 horizontal
export function speedLines(g, drawing, o) {
  const R = rng(3000 + drawing * 31 + (o.seed || 0));
  const col = o.col || '#ffffff';
  g.save();
  if (o.type === 'radial') {
    const n = o.n || 90;
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, w = (.004 + R() * .018) * (o.wmul || 1), r0 = (o.r0 || 160) + R() * 260, r1 = 2400;
      g.fillStyle = rgba(col, (o.a || .8) * (.4 + R() * .6));
      g.beginPath(); g.moveTo(o.cx + Math.cos(a) * r0, o.cy + Math.sin(a) * r0);
      g.lineTo(o.cx + Math.cos(a - w) * r1, o.cy + Math.sin(a - w) * r1); g.lineTo(o.cx + Math.cos(a + w) * r1, o.cy + Math.sin(a + w) * r1); g.fill();
    }
  } else {
    const n = o.n || 70;
    for (let i = 0; i < n; i++) {
      const y = R() * H, L = 300 + R() * 1400, x = R() * (W + L) - L, h = 1 + R() * (o.hmax || 7);
      const gr = g.createLinearGradient(x, 0, x + L, 0);
      gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.3, rgba(col, (o.a || .7) * (.4 + R() * .6))); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(x, y, L, h);
    }
  }
  g.restore();
}

// 镜头光晕：星芒 + 横向光条（anamorphic）+ 沿中心线的鬼影
export function flare(e, x, y, s = 1, col = '#bfe6ff', o = {}) {
  e.save(); e.globalCompositeOperation = 'lighter';
  const core = e.createRadialGradient(x, y, 0, x, y, 180 * s);
  core.addColorStop(0, rgba('#ffffff', .95)); core.addColorStop(.12, rgba(col, .6)); core.addColorStop(1, rgba(col, 0));
  e.fillStyle = core; e.beginPath(); e.arc(x, y, 180 * s, 0, TAU); e.fill();
  // 横向光条
  const L = (o.streak ?? 900) * s, hh = 5 * s;
  const gr = e.createLinearGradient(x - L, 0, x + L, 0);
  gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.5, rgba(mix(col, '#ffffff', .6), .9)); gr.addColorStop(1, rgba(col, 0));
  e.fillStyle = gr; e.fillRect(x - L, y - hh, L * 2, hh * 2);
  e.fillStyle = rgba('#ffffff', .8); e.fillRect(x - L * .3, y - 1.2 * s, L * .6, 2.4 * s);
  // 星芒（4 + 2 条）
  const spikes = o.spikes ?? 6, rot = o.rot ?? .3;
  for (let k = 0; k < spikes; k++) {
    const a = rot + k * TAU / spikes, len = (k % 2 ? 160 : 300) * s;
    e.save(); e.translate(x, y); e.rotate(a);
    const sg = e.createLinearGradient(0, 0, len, 0); sg.addColorStop(0, rgba('#ffffff', .8)); sg.addColorStop(1, rgba(col, 0));
    e.fillStyle = sg; e.beginPath(); e.moveTo(0, -3 * s); e.lineTo(len, 0); e.lineTo(0, 3 * s); e.fill(); e.restore();
  }
  // 鬼影
  if (o.ghosts !== false) {
    const cx = W / 2, cy = H / 2, dx = cx - x, dy = cy - y;
    const G = [[.35, 40, '#7fffd4', .16], [.62, 22, '#ff9fe0', .22], [1.15, 70, '#8fb0ff', .1], [1.4, 30, '#ffe08a', .18], [1.75, 110, '#b08aff', .07]];
    for (const [k, r, c, a] of G) {
      const gx = x + dx * k * 2, gy = y + dy * k * 2;
      e.fillStyle = rgba(c, a * (o.ghostA ?? 1)); e.beginPath();
      for (let j = 0; j < 6; j++) { const aa = j * TAU / 6 + .3; e[j ? 'lineTo' : 'moveTo'](gx + Math.cos(aa) * r * s, gy + Math.sin(aa) * r * s); }
      e.fill();
    }
  }
  e.restore();
}

// 发光点（透过光的小光源）：scene 上画实心亮核，glow 上画色光
export function lamp(g, e, x, y, r, col, a = 1) {
  if (g) { g.fillStyle = mix(col, '#ffffff', .7); g.beginPath(); g.arc(x, y, r * .45, 0, TAU); g.fill(); }
  if (e) { const gr = e.createRadialGradient(x, y, 0, x, y, r * 3); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(.3, rgba(col, a * .5)); gr.addColorStop(1, rgba(col, 0)); e.fillStyle = gr; e.beginPath(); e.arc(x, y, r * 3, 0, TAU); e.fill(); }
}

// 光轨：沿折线的发光条（尾灯拖影）
export function trail(g, e, pts, col, w = 6) {
  for (const [ctx, ww, a] of [[e, w * 3, .7], [e, w, 1], [g, w * .5, .9]]) {
    if (!ctx) continue;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const f = 1 - i / pts.length;
      ctx.strokeStyle = rgba(ctx === g ? mix(col, '#ffffff', .6) : col, a * f); ctx.lineWidth = ww * (.4 + .6 * f);
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    }
    ctx.restore();
  }
}
