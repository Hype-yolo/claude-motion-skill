// ../../../产品库/claude-motion-kit/skills/claude-motion/assets/extensions/anidoodle-paper/src/paper-materials.ts
var rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
var clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
var lerp = (a, b, t) => a + (b - a) * t;
var lerpP = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
var hex = (h) => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
var mix = (a, b, t) => {
  const x = hex(a), y = hex(b);
  return "#" + x.map((v, i) => Math.round(lerp(v, y[i], t)).toString(16).padStart(2, "0")).join("");
};
var resample = (s, n) => {
  const cum = [0];
  for (let i = 1; i < s.length; i++) cum.push(cum[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]));
  const L = cum[cum.length - 1], out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const d = L * k / (n - 1);
    while (j < s.length - 1 && cum[j] < d) j++;
    const f = (d - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
    out.push(lerpP(s[j - 1], s[j], clamp(f)));
  }
  return out;
};
var boxOf = (pts) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
};
var bounds = boxOf;
var ring = (s) => s.reduce((a, p, i) => a + Math.hypot(p[0] - s[(i + 1) % s.length][0], p[1] - s[(i + 1) % s.length][1]), 0);
var scissor = (shape, seed, amt = 0.6) => {
  const s = resample([...shape, shape[0]], Math.max(16, Math.round(ring(shape) / 5))).slice(0, -1), r = rng(seed);
  return s.map(([x, y]) => [x + (r() - 0.5) * amt, y + (r() - 0.5) * amt]);
};
var path = (c, pts, close = true) => {
  c.beginPath();
  pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  if (close) c.closePath();
};
var rect = (w, h, cx = 0, cy = 0) => [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
var fibres = (c, shape, color, seed, density = 1, blotch = 0.22) => {
  const b = bounds(shape), r = rng(seed), area = (b.x1 - b.x0) * (b.y1 - b.y0);
  c.save();
  path(c, shape);
  c.clip();
  for (let i = 0; i < 6; i++) {
    const x = b.x0 + r() * (b.x1 - b.x0), y = b.y0 + r() * (b.y1 - b.y0), rx = 30 + r() * 110, g = c.createRadialGradient(x, y, 0, x, y, rx);
    const col = r() < 0.5 ? mix(color, "#ffffff", 0.25) : mix(color, "#6b4a22", 0.14);
    g.addColorStop(0, col);
    g.addColorStop(1, col + "00");
    c.globalAlpha = blotch;
    c.fillStyle = g;
    c.fillRect(x - rx, y - rx, rx * 2, rx * 2);
  }
  c.lineCap = "round";
  const n = Math.round(area / 1100 * density);
  for (let i = 0; i < n; i++) {
    const x = b.x0 + r() * (b.x1 - b.x0), y = b.y0 + r() * (b.y1 - b.y0), a = r() * Math.PI, l = 2 + r() * 7;
    c.strokeStyle = r() < 0.6 ? mix(color, "#fffdf4", 0.5) : mix(color, "#3a2410", 0.28);
    c.globalAlpha = 0.18 + r() * 0.25;
    c.lineWidth = 0.4 + r() * 0.5;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 2, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 2, x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }
  c.restore();
  c.globalAlpha = 1;
};
var gouache = (c, shape, color, seed, o = {}) => {
  const { dir = 0, len = 44, w = 13, vary = 0.1, dens = 1 } = o, r = rng(seed), b = bounds(shape), area = (b.x1 - b.x0) * (b.y1 - b.y0);
  c.fillStyle = color;
  path(c, shape);
  c.fill();
  c.save();
  path(c, shape);
  c.clip();
  c.lineCap = "round";
  const n = Math.max(6, Math.round(area / (len * w) * 1.6 * dens));
  for (let i = 0; i < n; i++) {
    const x = b.x0 + r() * (b.x1 - b.x0), y = b.y0 + r() * (b.y1 - b.y0), a = dir + (r() - 0.5) * 0.35, l = len * (0.6 + r() * 0.7), k = r();
    c.strokeStyle = k < 0.5 ? mix(color, "#ffffff", vary * (0.5 + r())) : mix(color, "#1d2430", vary * (0.4 + r()));
    c.globalAlpha = 0.28 + r() * 0.25;
    c.lineWidth = w * (0.6 + r() * 0.6);
    c.beginPath();
    c.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2);
    c.quadraticCurveTo(x + (r() - 0.5) * 6, y + (r() - 0.5) * 6, x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2);
    c.stroke();
  }
  c.restore();
  c.globalAlpha = 1;
};
var shadeSide = (c, shape, color, seed, side, depth, dir = Math.PI / 2) => {
  const b = bounds(shape), r = rng(seed);
  c.save();
  path(c, shape);
  c.clip();
  c.lineCap = "round";
  for (let i = 0; i < 16; i++) {
    const u = r(), x = side[0] > 0 ? b.x1 - r() * depth : side[0] < 0 ? b.x0 + r() * depth : b.x0 + u * (b.x1 - b.x0), y = side[1] > 0 ? b.y1 - r() * depth : side[1] < 0 ? b.y0 + r() * depth : b.y0 + u * (b.y1 - b.y0), l = 16 + r() * 26;
    c.strokeStyle = color;
    c.globalAlpha = 0.3 + r() * 0.25;
    c.lineWidth = 5 + r() * 7;
    c.beginPath();
    c.moveTo(x - Math.cos(dir) * l / 2, y - Math.sin(dir) * l / 2);
    c.lineTo(x + Math.cos(dir) * l / 2, y + Math.sin(dir) * l / 2);
    c.stroke();
  }
  c.restore();
  c.globalAlpha = 1;
};
var print = (c, shape, fn) => {
  c.save();
  path(c, shape);
  c.clip();
  fn(bounds(shape));
  c.restore();
  c.globalAlpha = 1;
};
var wavePrint = (c, shape, col, gap = 22, sw = 2) => print(c, shape, (b) => {
  c.strokeStyle = col;
  c.lineWidth = sw;
  c.globalAlpha = 0.55;
  for (let y = b.y0 + 8, row = 0; y < b.y1 + 10; y += gap, row++) {
    c.beginPath();
    for (let x = b.x0 - 30 + row % 2 * 15; x < b.x1 + 30; x += 30) {
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 7.5, y - 7, x + 15, y);
    }
    c.stroke();
  }
});
var dotPrint = (c, shape, col, gap = 14, rad = 2.2) => print(c, shape, (b) => {
  c.fillStyle = col;
  c.globalAlpha = 0.8;
  for (let y = b.y0, row = 0; y < b.y1 + gap; y += gap * 0.87, row++) for (let x = b.x0 + row % 2 * gap * 0.5; x < b.x1 + gap; x += gap) {
    c.beginPath();
    c.arc(x, y, rad, 0, 6.28);
    c.fill();
  }
});
var diamondPrint = (c, shape, col, gap = 26) => print(c, shape, (b) => {
  c.fillStyle = col;
  c.globalAlpha = 0.5;
  for (let y = b.y0, row = 0; y < b.y1 + gap; y += gap / 2, row++) for (let x = b.x0 + row % 2 * gap / 2; x < b.x1 + gap; x += gap) {
    c.beginPath();
    c.moveTo(x, y - 4);
    c.lineTo(x + 3, y);
    c.lineTo(x, y + 4);
    c.lineTo(x - 3, y);
    c.closePath();
    c.fill();
  }
  c.globalAlpha = 0.18;
  c.strokeStyle = col;
  c.lineWidth = 0.8;
  for (let d = b.x0 - (b.y1 - b.y0); d < b.x1; d += gap) {
    c.beginPath();
    c.moveTo(d, b.y0);
    c.lineTo(d + (b.y1 - b.y0), b.y1);
    c.stroke();
    c.beginPath();
    c.moveTo(d + (b.y1 - b.y0), b.y0);
    c.lineTo(d, b.y1);
    c.stroke();
  }
});
var stonePrint = (c, shape, base, seed) => print(c, shape, (b) => {
  const r = rng(seed);
  for (let y = b.y0, row = 0; y < b.y1; y += 17, row++) for (let x = b.x0 - row % 2 * 16; x < b.x1; ) {
    const w = 26 + r() * 16;
    c.fillStyle = mix(base, r() < 0.5 ? "#ffffff" : "#3b3226", 0.06 + r() * 0.14);
    c.globalAlpha = 1;
    c.beginPath();
    c.roundRect(x + 1.5, y + 1.5, w - 3, 14, 4);
    c.fill();
    x += w;
  }
});
var newsPrint = (c, shape, seed) => print(c, shape, (b) => {
  const r = rng(seed);
  c.fillStyle = "#4a4640";
  c.globalAlpha = 0.5;
  for (let col = b.x0 + 4; col < b.x1; col += 36) for (let y = b.y0 + 4; y < b.y1; y += 4.2) {
    if (r() < 0.06) {
      y += 6;
      continue;
    }
    const l = 20 + r() * 12;
    c.fillRect(col, y, l, 1.3);
  }
  c.globalAlpha = 0.7;
  c.fillRect(b.x0 + 16, b.y0 + 30, 60, 5);
});
var woodPrint = (c, shape, col, seed) => print(c, shape, (b) => {
  const r = rng(seed);
  c.strokeStyle = col;
  c.lineWidth = 1;
  c.globalAlpha = 0.35;
  for (let y = b.y0; y < b.y1; y += 3 + r() * 4) {
    c.beginPath();
    c.moveTo(b.x0, y);
    for (let x = b.x0; x <= b.x1; x += 40) c.lineTo(x, y + Math.sin(x * 0.013 + y) * 1.6);
    c.stroke();
  }
  c.globalAlpha = 0.5;
  c.strokeStyle = mix(col, "#000000", 0.2);
  for (let x = b.x0 + 60 + r() * 60; x < b.x1; x += 90 + r() * 90) {
    c.beginPath();
    c.moveTo(x, b.y0);
    c.lineTo(x, b.y1);
    c.stroke();
  }
});
var cutPath = (c, pc, dx = 0, dy = 0, grow = 0) => {
  c.save();
  c.translate(dx, dy);
  c.beginPath();
  pc.cut.forEach((s) => {
    s.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath();
  });
  c.fill(pc.hole ? "evenodd" : "nonzero");
  if (pc.border || grow) {
    c.lineJoin = "round";
    c.lineWidth = 2 * ((pc.border ?? 0) + grow);
    c.strokeStyle = c.fillStyle;
    c.stroke();
  }
  c.restore();
};
export {
  bounds,
  clamp,
  cutPath,
  diamondPrint,
  dotPrint,
  fibres,
  gouache,
  lerp,
  lerpP,
  mix,
  newsPrint,
  path,
  rect,
  resample,
  rng,
  scissor,
  shadeSide,
  stonePrint,
  wavePrint,
  woodPrint
};
