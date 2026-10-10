// 剪纸母题：全部在米制画布上画（y 向上）。颜色由调用方给。
import { mulberry, TAU, lerp, clamp } from './lib.js';

export const FONT = { brush: '"MaShanZheng"', xing: '"ZhiMangXing"', hand: '"LongCang"', song: '"NotoSerifSC"' };

// —— 山 ——
// 喀斯特圆峰：peaks=[[cx, h, w], ...]，平滑取最大
export function karst(x, o) {
  const { x0, x1, base, bottom = base - 1, peaks, step = .002, rough = 0, seed = 1 } = o;
  const R = mulberry(seed), ph = R() * 100;
  x.beginPath(); x.moveTo(x0, bottom);
  for (let u = x0; u <= x1 + step; u += step) {
    let y = 0;
    for (const [cx, h, w] of peaks) { const d = (u - cx) / w; y += Math.pow(Math.max(0, h * Math.exp(-d * d * 2.2)), 4); }
    y = Math.pow(y, .25);
    y += rough * (Math.sin(u * 91 + ph) * .5 + Math.sin(u * 237 + ph * 2) * .3 + Math.sin(u * 511) * .2);
    x.lineTo(u, base + y);
  }
  x.lineTo(x1, bottom); x.closePath(); x.fill();
  if (o.carve) {   // 山体内的等高刻线（镂空细缝，透出后层的光）
    x.save(); x.globalCompositeOperation = 'destination-out'; x.strokeStyle = '#000'; x.lineCap = 'round'; x.lineWidth = o.carve;
    for (const [cx, h, w] of peaks) for (const [f, d] of [[.78, .14], [.55, .3], [.34, .46]]) {
      if (h * f < .012) continue;
      x.beginPath(); let started = false;
      for (let u = cx - w * 1.1; u <= cx + w * 1.1; u += step) {
        const dd = (u - cx) / (w * f), yy = base + h * f * Math.exp(-dd * dd * 2.2) - h * d * .35;
        const inside = Math.exp(-dd * dd * 2.2) > .22;
        if (inside) { started ? x.lineTo(u, yy) : x.moveTo(u, yy); started = true; } else started = false;
      }
      x.stroke();
    }
    x.restore();
  }
}
// 噪声山脊
export function ridge(x, o) {
  const { x0, x1, base, amp, bottom = base - 1, seed = 1, freq = 12, step = .002 } = o;
  const R = mulberry(seed), ph = [R() * 9, R() * 9, R() * 9];
  x.beginPath(); x.moveTo(x0, bottom);
  for (let u = x0; u <= x1 + step; u += step) {
    const y = amp * (.55 * Math.sin(u * freq + ph[0]) + .3 * Math.sin(u * freq * 2.3 + ph[1]) + .15 * Math.sin(u * freq * 5.1 + ph[2]));
    x.lineTo(u, base + y);
  }
  x.lineTo(x1, bottom); x.closePath(); x.fill();
}

// —— 祥云 ——（一团旋涡云头 + 拖尾），s=尺度，dir=±1 拖尾方向
export function xiangyun(x, cx, cy, s, dir = 1, o = {}) {
  const heads = o.heads || [[0, 0, 1], [1.05 * dir, -.12, .72], [-.9 * dir, -.18, .62], [.35 * dir, .72, .58]];
  x.save(); x.translate(cx, cy);
  x.beginPath();
  for (const [hx, hy, r] of heads) { x.moveTo(hx * s + r * s, hy * s); x.arc(hx * s, hy * s, r * s, 0, TAU); }
  // 拖尾：从主云头下缘向外渐细
  const L = (o.tail ?? 2.6) * s, d = dir;
  x.moveTo(-.2 * s * d, -.55 * s);
  x.bezierCurveTo((.8 * d) * s, -1.05 * s, (1.8 * d) * s, -.55 * s, (1.6 * d) * s + L * .3 * d, -.75 * s);
  x.bezierCurveTo((1.8 * d) * s + L * .5 * d, -.9 * s, (1.6 * d) * s + L * .9 * d, -.62 * s, (1.4 * d) * s + L * d, -.78 * s);
  x.bezierCurveTo((1.4 * d) * s + L * .7 * d, -.98 * s, (1.2 * d) * s + L * .2 * d, -1.02 * s, .3 * d * s, -.98 * s);
  x.closePath();
  x.fill();
  // 旋涡刻线（镂空）
  x.globalCompositeOperation = 'destination-out'; x.strokeStyle = '#000'; x.lineCap = 'round';
  for (const [hx, hy, r] of heads) {
    x.lineWidth = r * s * .16; x.beginPath();
    for (let i = 0; i <= 40; i++) {
      const u = i / 40, th = (o.spin ?? 1) * d * (u * 1.75 * TAU) + 1.2, rr = r * s * (.12 + .62 * u);
      const px = hx * s + Math.cos(th) * rr, py = hy * s + Math.sin(th) * rr;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke();
  }
  x.globalCompositeOperation = 'source-over';
  x.restore();
}

// —— 水波（鱼鳞纹）——
export function waves(x, o) {
  const { x0, x1, y0, y1, r, fill, line, lw } = o;
  x.fillStyle = fill; x.fillRect(x0, y1, x1 - x0, y0 - y1);
  x.strokeStyle = line; x.lineWidth = lw;
  let row = 0;
  for (let y = y0; y > y1; y -= r * .55, row++) {
    for (let u = x0 + (row % 2) * r; u < x1 + r; u += r * 2) {
      x.beginPath(); x.arc(u, y, r, Math.PI * 1.08, Math.PI * 1.92); x.stroke();
      x.beginPath(); x.arc(u, y, r * .62, Math.PI * 1.12, Math.PI * 1.88); x.stroke();
    }
  }
}
// 波浪顶边（水面）
export function waterTop(x, o) {
  const { x0, x1, base, amp, len, bottom = base - 1, ph = 0 } = o;
  x.beginPath(); x.moveTo(x0, bottom);
  for (let u = x0; u <= x1; u += .001) x.lineTo(u, base + amp * Math.sin((u / len) * TAU + ph) + amp * .4 * Math.sin((u / len) * TAU * 2.3 + ph * 1.7));
  x.lineTo(x1, bottom); x.closePath(); x.fill();
}

// —— 树 ——
// 树干：从 (bx,by) 起，分叉枝条列表 [[x1,y1,w]...]
function limb(x, ax, ay, bx, by, w0, w1, bend = .15) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  const mx = (ax + bx) / 2 + nx * L * bend, my = (ay + by) / 2 + ny * L * bend;
  x.beginPath();
  x.moveTo(ax + nx * w0 / 2, ay + ny * w0 / 2);
  x.quadraticCurveTo(mx + nx * (w0 + w1) / 4, my + ny * (w0 + w1) / 4, bx + nx * w1 / 2, by + ny * w1 / 2);
  x.lineTo(bx - nx * w1 / 2, by - ny * w1 / 2);
  x.quadraticCurveTo(mx - nx * (w0 + w1) / 4, my - ny * (w0 + w1) / 4, ax - nx * w0 / 2, ay - ny * w0 / 2);
  x.closePath(); x.fill();
}
export { limb };
// 桂花树：圆冠（多个云团）+ 叶形镂空 + 花点（花点画在 glow 或另色）
export function osmanthus(x, o) {
  const { cx, by, h, seed = 3, flowers } = o, R = mulberry(seed), s = h;
  const trunkTop = by + h * .45;
  limb(x, cx, by, cx - .02 * s, trunkTop, .09 * s, .05 * s, .12);
  limb(x, cx - .01 * s, by + h * .3, cx - .22 * s, by + h * .62, .04 * s, .018 * s, -.1);
  limb(x, cx - .015 * s, by + h * .38, cx + .2 * s, by + h * .66, .035 * s, .016 * s, .12);
  const blobs = o.blobs || [[0, .72, .3], [-.24, .64, .22], [.24, .66, .22], [-.12, .88, .2], [.14, .9, .19], [-.36, .52, .14], [.36, .55, .14], [0, 1.0, .14]];
  x.beginPath();
  for (const [bx, byy, r] of blobs) {
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = i / n * TAU, k = 1 + .08 * Math.sin(a * 5 + bx * 20);
      const px = cx + bx * s + Math.cos(a) * r * s * k, py = by + byy * s + Math.sin(a) * r * s * k;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath();
  }
  x.fill();
  if (o.cut !== false) {   // 叶形镂空
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < (o.leaves ?? 60); i++) {
      const [bx, byy, r] = blobs[Math.floor(R() * blobs.length)];
      const a = R() * TAU, rr = Math.sqrt(R()) * r * .78;
      leaf(x, cx + (bx + Math.cos(a) * rr) * s, by + (byy + Math.sin(a) * rr) * s, .035 * s * (.6 + R() * .5), R() * TAU);
    }
    x.globalCompositeOperation = 'source-over';
  }
  if (flowers) {
    x.fillStyle = flowers;
    for (let i = 0; i < (o.nFlowers ?? 70); i++) {
      const [bx, byy, r] = blobs[Math.floor(R() * blobs.length)];
      const a = R() * TAU, rr = Math.sqrt(R()) * r * .9;
      const px = cx + (bx + Math.cos(a) * rr) * s, py = by + (byy + Math.sin(a) * rr) * s, fr = .008 * s * (.7 + R() * .6);
      for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(px + Math.cos(k * TAU / 4) * fr, py + Math.sin(k * TAU / 4) * fr, fr * .8, 0, TAU); x.fill(); }
    }
  }
}
export function leaf(x, px, py, L, a) {
  x.save(); x.translate(px, py); x.rotate(a);
  x.beginPath(); x.moveTo(-L / 2, 0); x.quadraticCurveTo(0, L * .38, L / 2, 0); x.quadraticCurveTo(0, -L * .38, -L / 2, 0); x.fill();
  x.restore();
}
// 松：树干 + 层叠横向针叶团
export function pine(x, o) {
  const { cx, by, h, seed = 2 } = o, R = mulberry(seed), s = h;
  limb(x, cx, by, cx + .06 * s, by + h * .9, .07 * s, .03 * s, .1);
  const tiers = o.tiers || [[.95, .16], [.78, .26], [.6, .32], [.42, .26]];
  for (const [ty, w] of tiers) {
    const px = cx + .05 * s * ty, py = by + ty * s;
    x.beginPath(); x.moveTo(px - w * s, py - .02 * s);
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const u = i / n, qx = px - w * s + u * 2 * w * s;
      x.quadraticCurveTo(qx - w * s / n, py + (.05 + .03 * R()) * s * Math.sin(u * Math.PI) + .02 * s, qx, py + .03 * s * Math.sin(u * Math.PI));
    }
    x.quadraticCurveTo(px, py - .07 * s, px - w * s, py - .02 * s); x.fill();
  }
}
// 柳：主干 + 下垂柳丝
export function willow(x, o) {
  const { cx, by, h, seed = 4, strands = 26, phase = 0 } = o, R = mulberry(seed), s = h;
  limb(x, cx, by, cx + .08 * s, by + h * .78, .08 * s, .04 * s, -.12);
  limb(x, cx + .06 * s, by + h * .6, cx - .18 * s, by + h * .86, .035 * s, .015 * s, .15);
  limb(x, cx + .07 * s, by + h * .68, cx + .3 * s, by + h * .9, .03 * s, .012 * s, -.15);
  x.lineCap = 'round';
  for (let i = 0; i < strands; i++) {
    const sx = cx + (-.3 + R() * .66) * s, sy = by + (.8 + R() * .16) * s, L = (.35 + R() * .45) * s, sway = (o.sway ?? .03) * s * Math.sin(phase + i);
    x.lineWidth = .006 * s; x.beginPath(); x.moveTo(sx, sy);
    x.bezierCurveTo(sx + .05 * s, sy + .02 * s, sx + .02 * s + sway * .5, sy - L * .5, sx + sway, sy - L); x.stroke();
    for (let k = 1; k < 7; k++) { const u = k / 7; leaf(x, sx + sway * u + .02 * s * (1 - u), sy - L * u, .03 * s, -Math.PI / 2 + (k % 2 ? .5 : -.5)); }
  }
}
// 芦苇 / 草丛
export function reeds(x, o) {
  const { x0, x1, by, h, n = 40, seed = 6, sway = 0 } = o, R = mulberry(seed);
  x.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const px = lerp(x0, x1, R()), hh = h * (.4 + R() * .6), lean = (R() - .5) * .3 + sway * (.6 + R() * .4);
    x.lineWidth = h * .018; x.beginPath(); x.moveTo(px, by);
    x.quadraticCurveTo(px + lean * hh * .3, by + hh * .6, px + lean * hh, by + hh); x.stroke();
    if (R() < .45) leaf(x, px + lean * hh, by + hh + h * .04, h * .12, Math.PI / 2 + lean);
    else if (R() < .5) { x.save(); x.translate(px + lean * hh * .5, by + hh * .5); x.rotate(R() < .5 ? .6 : -.6); x.beginPath(); x.ellipse(h * .06, 0, h * .08, h * .012, 0, 0, TAU); x.fill(); x.restore(); }
  }
}

// —— 建筑 ——
// 江南民居：白墙黛瓦马头墙；windows=[[dx,dy,w,h]] 相对墙左下；win 窗色，glow 画在 glowCtx
export function jiangnanHouse(x, o, g) {
  const { cx, by, w, h, roof = .3 * h, windows = [], win = '#f4c46e', wall = '#3a4a74', tile = '#1e2848', gables = true } = o;
  const L = cx - w / 2, top = by + h;
  if (g) { g.fillStyle = '#fff'; for (const [dx, dy, ww, hh] of windows) g.fillRect(L + dx, by + dy, ww, hh); return; }
  x.fillStyle = wall; x.fillRect(L, by, w, h);
  // 黛瓦屋顶：两端微翘
  x.fillStyle = tile; x.beginPath();
  x.moveTo(L - .06 * w, top); x.quadraticCurveTo(L + .05 * w, top + roof * .15, L + .08 * w, top + roof);
  x.lineTo(L + w - .08 * w, top + roof); x.quadraticCurveTo(L + w - .05 * w, top + roof * .15, L + w + .06 * w, top);
  x.lineTo(L + w + .07 * w, top + roof * .18); x.lineTo(L - .07 * w, top + roof * .18); x.closePath(); x.fill();
  x.fillRect(L - .06 * w, top - roof * .12, w * 1.12, roof * .14);
  if (gables) for (const side of [0, 1]) {   // 马头墙：两级台阶，白墙黑檐
    const sw = .13 * w;
    [[0, 1.55], [sw * .95, 1.15]].forEach(([off, k]) => {
      const x0 = side ? L + w - off - sw : L + off, hh = h + roof * k;
      x.fillStyle = wall; x.fillRect(x0, by, sw, hh);
      x.fillStyle = tile; x.beginPath(); x.moveTo(x0 - sw * .25, by + hh); x.lineTo(x0 + sw * 1.25, by + hh); x.lineTo(x0 + sw * 1.1, by + hh + roof * .22); x.lineTo(x0 - sw * .1, by + hh + roof * .22); x.closePath(); x.fill();
    });
  }
  for (const [dx, dy, ww, hh] of windows) {
    x.fillStyle = win; x.fillRect(L + dx, by + dy, ww, hh);
    x.fillStyle = tile; for (let i = 1; i < 3; i++) { x.fillRect(L + dx + ww * i / 3 - ww * .04, by + dy, ww * .08, hh); x.fillRect(L + dx, by + dy + hh * i / 3 - hh * .04, ww, hh * .08); }
  }
  x.fillStyle = tile; x.fillRect(L + w * .44, by, w * .12, h * .55);   // 门
}
// 亭子
export function pavilion(x, o) {
  const { cx, by, w, h } = o, s = w;
  x.fillRect(cx - s * .55, by, s * 1.1, s * .06);                       // 台基
  for (const u of [-.42, -.14, .14, .42]) x.fillRect(cx + u * s - s * .025, by + s * .06, s * .05, h * .55);   // 柱
  x.fillRect(cx - s * .5, by + s * .06 + h * .18, s, s * .025);          // 栏杆
  for (let i = 0; i < 9; i++) x.fillRect(cx - s * .48 + i * s * .12, by + s * .06, s * .012, h * .18);
  const ry = by + s * .06 + h * .55;
  x.fillRect(cx - s * .5, ry, s, s * .05);
  x.beginPath();   // 飞檐
  x.moveTo(cx - s * .82, ry + s * .2);
  x.quadraticCurveTo(cx - s * .6, ry + s * .04, cx - s * .3, ry + s * .1);
  x.lineTo(cx + s * .3, ry + s * .1);
  x.quadraticCurveTo(cx + s * .6, ry + s * .04, cx + s * .82, ry + s * .2);
  x.quadraticCurveTo(cx + s * .5, ry + s * .2, cx + s * .1, ry + h * .38);
  x.lineTo(cx - s * .1, ry + h * .38);
  x.quadraticCurveTo(cx - s * .5, ry + s * .2, cx - s * .82, ry + s * .2);
  x.closePath(); x.fill();
  x.beginPath(); x.moveTo(cx, ry + h * .5); x.lineTo(cx + s * .04, ry + h * .37); x.lineTo(cx - s * .04, ry + h * .37); x.fill();
  x.beginPath(); x.arc(cx, ry + h * .5, s * .03, 0, TAU); x.fill();
}
// 灯笼（红，glow 画发光）
export function lantern(x, o, g) {
  const { cx, cy, r, col = '#c8352a', rib = '#7a1a14', cap = '#2b1a14', string = true, tassel = true } = o;
  if (string) { x.fillStyle = cap; x.fillRect(cx - r * .03, cy + r * .9, r * .06, o.stringLen ?? r * 3); }
  x.fillStyle = cap; x.fillRect(cx - r * .45, cy + r * .72, r * .9, r * .2); x.fillRect(cx - r * .45, cy - r * .92, r * .9, r * .2);
  x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, r * 1.05, r * .85, 0, 0, TAU); x.fill();
  x.strokeStyle = rib; x.lineWidth = r * .06;
  for (const k of [-.6, -.25, .25, .6]) { x.beginPath(); x.ellipse(cx, cy, r * 1.05 * Math.abs(k), r * .85, 0, -Math.PI / 2, Math.PI / 2, k < 0); x.stroke(); }
  x.beginPath(); x.moveTo(cx, cy + r * .85); x.lineTo(cx, cy - r * .85); x.stroke();
  if (tassel) {
    x.fillStyle = cap; x.fillRect(cx - r * .04, cy - r * 1.3, r * .08, r * .4);
    x.fillStyle = col; x.beginPath(); x.moveTo(cx - r * .15, cy - r * 1.3); x.lineTo(cx + r * .15, cy - r * 1.3); x.lineTo(cx + r * .22, cy - r * 2.1); x.lineTo(cx - r * .22, cy - r * 2.1); x.closePath(); x.fill();
  }
  if (g) { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r * 1.05); gr.addColorStop(0, '#fff'); gr.addColorStop(.7, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,.2)'); g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, r * 1.05, r * .85, 0, 0, TAU); g.fill(); }
}

// —— 月饼 ——（纹样圆盘，金色系）。o: {r, char, font, petals}
export function mooncake(x, o) {
  const { r, petals = 14, body = '#c98a3a', light = '#e8b35c', dark = '#8a5520', char = '圆' } = o;
  const cx = o.cx || 0, cy = o.cy || 0;
  x.save(); x.translate(cx, cy);
  // 花边外缘
  x.fillStyle = body; x.beginPath();
  for (let i = 0; i <= 200; i++) {
    const a = i / 200 * TAU, k = 1 - .06 * Math.pow(Math.abs(Math.cos(a * petals / 2)), .6);
    const px = Math.cos(a) * r * k, py = Math.sin(a) * r * k; i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.closePath(); x.fill();
  // 凹槽（花瓣之间的刻线）
  x.strokeStyle = dark; x.lineWidth = r * .025; x.lineCap = 'round';
  for (let i = 0; i < petals; i++) { const a = (i + .5) / petals * TAU; x.beginPath(); x.moveTo(Math.cos(a) * r * .72, Math.sin(a) * r * .72); x.lineTo(Math.cos(a) * r * .9, Math.sin(a) * r * .9); x.stroke(); }
  // 内圈
  x.lineWidth = r * .03; x.beginPath(); x.arc(0, 0, r * .7, 0, TAU); x.stroke();
  x.fillStyle = light; x.beginPath(); x.arc(0, 0, r * .66, 0, TAU); x.fill();
  // 连珠纹
  x.fillStyle = dark; for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; x.beginPath(); x.arc(Math.cos(a) * r * .6, Math.sin(a) * r * .6, r * .018, 0, TAU); x.fill(); }
  // 中心字
  if (char) {
    x.fillStyle = dark; x.beginPath(); x.arc(0, 0, r * .47, 0, TAU); x.lineWidth = r * .02; x.strokeStyle = dark; x.stroke();
    x.save(); x.scale(1, -1); x.font = `${r * .62}px ${o.font || FONT.brush}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = dark; x.fillText(char, 0, r * .04); x.restore();
  }
  x.restore();
}

// —— 人物剪影 ——（面朝右）；返回关节位置供动画
// 外婆坐姿：头、发髻、微驼背、开衫。原点=臀部座点
export function grannySeated(x, s, o = {}) {
  x.beginPath();
  // 身体（背 → 肩 → 胸 → 腹 → 腿）
  x.moveTo(-.16 * s, 0);
  x.bezierCurveTo(-.2 * s, .18 * s, -.2 * s, .38 * s, -.12 * s, .52 * s);   // 背
  x.bezierCurveTo(-.08 * s, .6 * s, .02 * s, .62 * s, .08 * s, .57 * s);    // 肩
  x.bezierCurveTo(.14 * s, .5 * s, .16 * s, .36 * s, .14 * s, .22 * s);     // 胸
  x.bezierCurveTo(.16 * s, .1 * s, .2 * s, .06 * s, .36 * s, .06 * s);      // 大腿上
  x.lineTo(.4 * s, .02 * s); x.lineTo(.4 * s, -.34 * s);                    // 膝 → 小腿
  x.lineTo(.46 * s, -.4 * s); x.lineTo(.3 * s, -.4 * s); x.lineTo(.3 * s, -.06 * s);
  x.lineTo(-.14 * s, -.06 * s); x.closePath(); x.fill();
  // 脖子 + 头
  x.beginPath(); x.moveTo(-.02 * s, .56 * s); x.lineTo(.04 * s, .56 * s); x.lineTo(.05 * s, .66 * s); x.lineTo(-.02 * s, .66 * s); x.fill();
  granHead(x, .02 * s, .74 * s, s, o);
}
export function granHead(x, hx, hy, s, o = {}) {
  x.beginPath();
  x.moveTo(hx - .08 * s, hy + .02 * s);
  x.bezierCurveTo(hx - .08 * s, hy + .12 * s, hx + .06 * s, hy + .14 * s, hx + .08 * s, hy + .05 * s);   // 头顶
  x.lineTo(hx + .1 * s, hy + .01 * s);    // 额头
  x.lineTo(hx + .115 * s, hy - .015 * s); // 鼻
  x.lineTo(hx + .095 * s, hy - .03 * s);
  x.lineTo(hx + .1 * s, hy - .045 * s);   // 嘴
  x.bezierCurveTo(hx + .09 * s, hy - .08 * s, hx + .04 * s, hy - .09 * s, hx + .0 * s, hy - .07 * s);   // 下巴
  x.lineTo(hx - .06 * s, hy - .05 * s);
  x.closePath(); x.fill();
  // 发髻
  x.beginPath(); x.arc(hx - .09 * s, hy + .06 * s, .045 * s, 0, TAU); x.fill();
  if (o.glasses) { x.save(); x.strokeStyle = x.fillStyle; x.lineWidth = .006 * s; x.restore(); }
}
// 手臂：从肩 (0,0) 伸向手，a=上臂角，b=前臂相对角（弧度），长度 L1/L2，粗细 w
export function arm(x, s, a, b, o = {}) {
  const L1 = (o.L1 ?? .2) * s, L2 = (o.L2 ?? .19) * s, w = (o.w ?? .055) * s;
  const ex = Math.cos(a) * L1, ey = Math.sin(a) * L1, hx = ex + Math.cos(a + b) * L2, hy = ey + Math.sin(a + b) * L2;
  limb(x, 0, 0, ex, ey, w * 1.1, w * .9, 0);
  limb(x, ex, ey, hx, hy, w * .9, w * .7, 0);
  x.beginPath(); x.arc(ex, ey, w * .45, 0, TAU); x.fill();
  x.beginPath(); x.ellipse(hx + Math.cos(a + b) * w * .3, hy + Math.sin(a + b) * w * .3, w * .55, w * .42, a + b, 0, TAU); x.fill();
  return [hx, hy];
}
