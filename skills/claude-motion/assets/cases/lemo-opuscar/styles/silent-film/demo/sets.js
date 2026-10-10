// Set pieces for the small hill town (tonal painting; the Redraw pass inks and hatches them).
import { form, stroke, wash, shade, catmull, grey, pathOf, rectPts, ellipsePts, mottle, H as hash, VN, cylShade } from './engine/ink.js';

const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (i, s = 1) => hash(i * 12.9898 + s * 78.233);

// soft sky with a couple of washed clouds (orthochromatic stock: skies print almost white)
export function sky(g, W, Hh, seed = 1, v = .93) {
  const gr = g.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, grey(v - .06)); gr.addColorStop(1, grey(v + .02));
  g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 5; i++) {
    const x = rnd(i, seed) * W, y = rnd(i + 9, seed) * Hh * .5, r = 120 + rnd(i + 3, seed) * 180;
    const c = g.createRadialGradient(x, y, 0, x, y, r); c.addColorStop(0, grey(1, .5)); c.addColorStop(1, grey(1, 0));
    g.fillStyle = c; g.beginPath(); g.ellipse(x, y, r * 1.8, r * .5, 0, 0, 7); g.fill();
  }
}

// a town house facade standing on a (possibly sloping) base line
// o: { x, base (y at left), slope (dy/dx), w, h, v (wall), roof, floors, win (per floor), door, shop:{text, awning}, seed, stone }
export function house(g, o) {
  const { x, w, h } = o, sl = o.slope || 0, base = o.base, v = o.v ?? .68, seed = o.seed ?? 1;
  const yb = xx => base + (xx - x) * sl;                                         // ground under the facade
  const top = Math.min(yb(x), yb(x + w)) - h;
  const wall = [[x, top], [x + w, top], [x + w, yb(x + w)], [x, yb(x)]];
  form(g, wall, { v, line: 2.4, grad: .12, seed, shade: 0 });
  mottle(g, x, top, w, h + 40, .12, seed);
  // plaster cracks / stone courses
  if (o.stone) { g.strokeStyle = grey(v - .18, .5); g.lineWidth = 1.2; for (let yy = top + 30; yy < yb(x) - 4; yy += 26) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); const off = ((yy / 26) | 0) % 2 ? 0 : 24; for (let xx = x + off; xx < x + w; xx += 48) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + 26); g.stroke(); } } }
  // corner quoins
  for (let yy = top; yy < yb(x) - 20; yy += 44) { form(g, rectPts(x, yy, 22, 40), { v: v + .08, line: 1.2, grad: .08, seed: seed + yy }); form(g, rectPts(x + w - 22, yy + 22, 22, 40), { v: v + .08, line: 1.2, grad: .08, seed: seed + yy + 1 }); }
  // roof: eave + tiles
  const rh = o.roofH ?? 70;
  const roof = [[x - 18, top], [x + w + 18, top], [x + w - 8, top - rh], [x + 8, top - rh]];
  form(g, roof, { v: o.roofV ?? .32, line: 2.4, grad: .15, seed: seed + 3, shade: 6 });
  g.strokeStyle = grey((o.roofV ?? .32) - .12, .7); g.lineWidth = 1.2;
  for (let k = 1; k < 5; k++) { const yy = top - rh * k / 5; g.beginPath(); g.moveTo(lerp(x - 18, x + 8, k / 5), yy); g.lineTo(lerp(x + w + 18, x + w - 8, k / 5), yy); g.stroke(); }
  form(g, rectPts(x - 22, top - 4, w + 44, 12), { v: .45, line: 1.8, seed: seed + 4 });
  if (o.chimney !== false) { const cx = x + w * (.2 + rnd(seed) * .6); form(g, rectPts(cx, top - rh - 60, 34, 70), { v: .5, line: 2, seed: seed + 5, shade: 5 }); form(g, rectPts(cx - 5, top - rh - 66, 44, 10), { v: .4, line: 1.8, seed: seed + 6 }); }
  // windows
  const floors = o.floors ?? 2, shopH = o.shop ? 190 : 0;
  const usable = h - shopH - 30, fh = usable / floors;
  const nw = o.win ?? Math.max(1, Math.round(w / 110));
  for (let f = 0; f < floors; f++) for (let i = 0; i < nw; i++) {
    const ww = Math.min(62, w / nw * .5), wh = Math.min(96, fh * .62);
    const cx = x + (i + .5) * w / nw, cy = top + 22 + f * fh + fh * .45;
    window_(g, cx - ww / 2, cy - wh / 2, ww, wh, seed + f * 10 + i, o.shutters ?? true);
  }
  // shop front
  if (o.shop) {
    const sy = yb(x + w / 2) - shopH;
    form(g, rectPts(x + 14, sy, w - 28, 44), { v: .3, line: 2, seed: seed + 7, shade: 4 });
    if (o.shop.text) { g.save(); g.font = `700 ${Math.min(30, (w - 60) / o.shop.text.length * 1.35)}px "Old Standard TT"`; g.fillStyle = grey(.9); g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '3px'; g.fillText(o.shop.text, x + w / 2, sy + 23); g.restore(); }
    // big window + door
    const dw = 70, winW = w - 60 - dw;
    form(g, rectPts(x + 22, sy + 58, winW, shopH - 72), { v: .2, line: 2.2, grad: .2, seed: seed + 8 });
    g.fillStyle = grey(.62, .5); g.beginPath(); g.moveTo(x + 30, sy + 64); g.lineTo(x + 30 + winW * .35, sy + 64); g.lineTo(x + 30, sy + 64 + (shopH - 80) * .5); g.fill();   // glass reflection
    for (let k = 1; k < 3; k++) stroke(g, [[x + 22 + winW * k / 3, sy + 58], [x + 22 + winW * k / 3, sy + shopH - 14]], 2, { seed: seed + 20 + k });
    form(g, rectPts(x + w - 30 - dw, sy + 54, dw, shopH - 54), { v: .35, line: 2.2, grad: .15, seed: seed + 9, shade: 5 });
    form(g, rectPts(x + w - 24 - dw, sy + 64, dw - 12, 60), { v: .22, line: 1.4, seed: seed + 10 });
    if (o.shop.awning) awning(g, x + 10, sy + 50, w - 20, 70, o.shop.awning, seed + 11);
  } else if (o.door) {
    const dx = x + w * (o.door.at ?? .7) - 36, dy = yb(dx) - 150;
    form(g, rectPts(dx, dy, 72, 150), { v: .3, line: 2.2, grad: .15, seed: seed + 12, shade: 6 });
    form(g, [[dx - 8, dy - 8], [dx + 80, dy - 8], [dx + 80, dy], [dx - 8, dy]], { v: .75, line: 1.6, seed: seed + 13 });
  }
  return { top, yb };
}
export function window_(g, x, y, w, h, seed = 1, shutters = true) {
  if (shutters) { form(g, rectPts(x - w * .48, y, w * .46, h), { v: .42, line: 1.6, seed }); form(g, rectPts(x + w * 1.02, y, w * .46, h), { v: .42, line: 1.6, seed: seed + 1 });
    for (let k = 1; k < 6; k++) { stroke(g, [[x - w * .45, y + h * k / 6], [x - w * .05, y + h * k / 6]], 1, { seed, alpha: .6 }); stroke(g, [[x + w * 1.05, y + h * k / 6], [x + w * 1.45, y + h * k / 6]], 1, { seed, alpha: .6 }); } }
  form(g, rectPts(x - 4, y - 4, w + 8, h + 8), { v: .82, line: 1.8, seed: seed + 2 });
  form(g, rectPts(x, y, w, h), { v: .18, line: 1.4, grad: .2, seed: seed + 3 });
  g.fillStyle = grey(.55, .45); g.beginPath(); g.moveTo(x + 3, y + 3); g.lineTo(x + w * .55, y + 3); g.lineTo(x + 3, y + h * .45); g.fill();
  stroke(g, [[x + w / 2, y], [x + w / 2, y + h]], 2, { color: grey(.82), seed }); stroke(g, [[x, y + h * .45], [x + w, y + h * .45]], 2, { color: grey(.82), seed });
  form(g, rectPts(x - 10, y + h + 2, w + 20, 9), { v: .78, line: 1.6, seed: seed + 4, shade: 3 });
}
// striped canvas awning (stripes alternate light/dark), scalloped edge
export function awning(g, x, y, w, drop, stripes = 8, seed = 1, tilt = 0, sag = 0) {
  const pts = [[x, y], [x + w, y + tilt], [x + w + 20, y + drop + tilt], [x - 20, y + drop]];
  form(g, pts, { v: .85, line: 2.2, seed, shade: 5 });
  const n = stripes * 2;
  for (let i = 0; i < n; i += 2) {
    const a = i / n, b = (i + 1) / n;
    const q = [[lerp(x, x + w, a), y + tilt * a], [lerp(x, x + w, b), y + tilt * b], [lerp(x - 20, x + w + 20, b), y + drop + tilt * b + Math.sin(b * Math.PI) * sag], [lerp(x - 20, x + w + 20, a), y + drop + tilt * a + Math.sin(a * Math.PI) * sag]];
    form(g, q, { v: .34, line: 0, seed: seed + i });
  }
  // scallops
  for (let i = 0; i < n; i++) {
    const a = (i + .5) / n, cx = lerp(x - 20, x + w + 20, a), cy = y + drop + tilt * a + Math.sin(a * Math.PI) * sag;
    form(g, ellipsePts(cx, cy + 4, (w + 40) / n * .5, 12, 0, 14), { v: i % 2 ? .85 : .34, line: 1.4, seed: seed + 30 + i });
  }
}
// cobbled street (side view with a ground band). y0 = back edge line, y1 = front, slope = dy/dx
export function street(g, W, y0, y1, slope = 0, seed = 1, v = .6) {
  const yb = (x, base) => base + (x - W / 2) * slope;
  const pts = [[0, yb(0, y0)], [W, yb(W, y0)], [W, y1 + 60], [0, y1 + 60]];
  form(g, pts, { v, line: 0, grad: .1, seed });
  // cobbles: rows get taller toward the viewer
  let yy = y0; let row = 0;
  while (yy < y1 + 60) {
    const hgt = 10 + (yy - y0) / (y1 - y0) * 24, wid = hgt * 1.7;
    for (let x = -wid + (row % 2) * wid * .5; x < W + wid; x += wid) {
      const cy = yb(x, yy) + hgt / 2, r = rnd(row * 97 + (x | 0), seed);
      form(g, ellipsePts(x + wid / 2, cy, wid * .44, hgt * .4, (r - .5) * .2, 10), { v: v + .06 + (r - .5) * .12, line: 1.1, lineColor: grey(v - .3), grad: .2, seed: row * 7 + (x | 0) });
    }
    yy += hgt * .92; row++;
  }
}
// curb / sidewalk
export function sidewalk(g, W, y, h, slope = 0, v = .72) {
  const yb = x => y + (x - W / 2) * slope;
  form(g, [[0, yb(0) - h], [W, yb(W) - h], [W, yb(W)], [0, yb(0)]], { v, line: 2, seed: 81, grad: .08 });
  form(g, [[0, yb(0)], [W, yb(W)], [W, yb(W) + 14], [0, yb(0) + 14]], { v: v - .2, line: 2, seed: 82 });
  for (let x = 40; x < W; x += 140) stroke(g, [[x, yb(x) - h], [x + 20, yb(x + 20)]], 1.2, { seed: 83 + x, alpha: .6 });
}
// cast-iron lamp post with an arm (arm extends toward armDir)
export function lampPost(g, x, yb, h, armDir = -1, armLen = 120) {
  const top = yb - h;
  form(g, [[x - 16, yb], [x + 16, yb], [x + 11, yb - 70], [x - 11, yb - 70]], { v: .18, line: 2, seed: 91, shade: 4 });
  form(g, [[x - 7, yb - 70], [x + 7, yb - 70], [x + 5, top], [x - 5, top]], { v: .16, line: 2, seed: 92, cyl: -Math.PI / 2 });
  form(g, [[x - 14, top + 30], [x + 14, top + 30], [x + 14, top + 42], [x - 14, top + 42]], { v: .2, line: 1.6, seed: 93 });
  const ax = x + armDir * armLen;
  form(g, [[x, top + 10], [ax, top + 10], [ax, top + 20], [x, top + 22]], { v: .16, line: 1.8, seed: 94 });
  stroke(g, catmull([[x, top + 60], [x + armDir * armLen * .5, top + 30], [ax, top + 20]], false, 6), 3, { seed: 95 });   // curly bracket
  // the lantern
  const lp = [[ax - 22, top + 22], [ax + 22, top + 22], [ax + 16, top + 80], [ax - 16, top + 80]];
  form(g, lp, { v: .82, line: 2.2, seed: 96 });
  form(g, [[ax - 26, top + 14], [ax + 26, top + 14], [ax, top - 8]], { v: .2, line: 2, seed: 97 });
  return { armY: top + 10, armX0: Math.min(x, ax), armX1: Math.max(x, ax), ax };
}
// wooden crate (side view)
export function crate(g, x, y, w, h, v = .6, seed = 1, rot = 0) {
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot);
  const b = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  form(g, b, { v, line: 2.2, seed, shade: w * .06 });
  for (let k = 1; k < 3; k++) stroke(g, [[-w / 2, -h / 2 + h * k / 3], [w / 2, -h / 2 + h * k / 3]], 1.4, { seed: seed + k });
  stroke(g, [[-w / 2 + 4, -h / 2 + 4], [w / 2 - 4, h / 2 - 4]], 1.8, { seed: seed + 5, alpha: .7 });
  g.restore();
}
// a pile of round fruit (oranges/apples) inside a box
export function fruitPile(g, x, y, w, h, n, v, seed = 1, r = 14) {
  for (let i = 0; i < n; i++) {
    const fx = x + r + rnd(i, seed) * (w - 2 * r), fy = y + h - r - rnd(i + 50, seed) * (h * .9) + Math.abs(fx - x - w / 2) / w * h * .5;
    fruit(g, fx, fy, r * (.85 + rnd(i + 99, seed) * .3), v, seed + i);
  }
}
export function fruit(g, x, y, r, v = .55, seed = 1) {
  form(g, ellipsePts(x, y, r, r * .96, 0, 16), { v, line: Math.max(1.1, r * .12), grad: .3, seed, shade: r * .35 });
  g.fillStyle = grey(.95, .6); g.beginPath(); g.arc(x - r * .35, y - r * .35, r * .22, 0, 7); g.fill();
}
export function melon(g, x, y, r, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot);
  const body = ellipsePts(0, 0, r * 1.25, r, 0, 24);
  form(g, body, { v: .3, line: 2.2, grad: .3, seed: 101, shade: r * .3 });
  g.save(); pathOf(g, body); g.clip(); g.strokeStyle = grey(.14); g.lineWidth = r * .12;
  for (let k = -3; k <= 3; k++) { g.beginPath(); g.ellipse(0, 0, Math.abs(k) * r * .38 + 2, r * 1.1, 0, 0, 7); g.stroke(); }
  g.restore(); g.fillStyle = grey(.85, .5); g.beginPath(); g.ellipse(-r * .4, -r * .45, r * .3, r * .16, -.4, 0, 7); g.fill();
  g.restore();
}
// wheeled fruit cart, side view; returns attachment points
export function cart(g, x, yb, w, o = {}) {
  const h = 120, wheelR = 58, bodyY = yb - wheelR - h + 20;
  const tilt = o.tilt || 0;   // rotation around the wheel axle (cart tipping when the seller sits on the shafts)
  g.save(); g.translate(x + w * .5, yb - wheelR); g.rotate(tilt); g.translate(-(x + w * .5), -(yb - wheelR));
  // shafts (handles) toward the right
  form(g, [[x + w - 10, bodyY + h - 26], [x + w + 170, bodyY + h - 60], [x + w + 172, bodyY + h - 48], [x + w - 10, bodyY + h - 12]], { v: .45, line: 1.8, seed: 111 });
  // body
  form(g, [[x, bodyY], [x + w, bodyY], [x + w - 14, bodyY + h], [x + 14, bodyY + h]], { v: .55, line: 2.4, grad: .14, seed: 112, shade: 8 });
  for (let k = 1; k < 4; k++) stroke(g, [[x + 6, bodyY + h * k / 4], [x + w - 6, bodyY + h * k / 4]], 1.4, { seed: 113 + k, alpha: .8 });
  // produce boxes on top
  if (o.boxes !== false) {
    crate(g, x + 18, bodyY - 70, w * .42, 72, .62, 120); fruitPile(g, x + 20, bodyY - 118, w * .4, 60, 14, .5, 121, 15);
    crate(g, x + w * .52, bodyY - 70, w * .42, 72, .62, 122); fruitPile(g, x + w * .52 + 2, bodyY - 112, w * .4, 52, 12, .72, 123, 16);
  }
  g.restore();
  // wheel (does not rotate with the tilt around its own axle)
  const wx = x + w * .5, wy = yb - wheelR;
  form(g, ellipsePts(wx, wy, wheelR, wheelR, 0, 30), { v: .3, line: 2.4, seed: 131 });
  form(g, ellipsePts(wx, wy, wheelR - 10, wheelR - 10, 0, 30), { v: .62, line: 1.8, seed: 132 });
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + (o.wheelRot || 0); stroke(g, [[wx, wy], [wx + Math.cos(a) * (wheelR - 10), wy + Math.sin(a) * (wheelR - 10)]], 2.4, { seed: 133 + k }); }
  form(g, ellipsePts(wx, wy, 9, 9, 0, 12), { v: .3, line: 1.6, seed: 141 });
  return { top: bodyY - 70, shaftEnd: [x + w + 170, bodyY + h - 54], wheel: [wx, wy] };
}
// ground contact shadow
export function contactShadow(g, x, y, rx, ry = 8, a = .3) {
  const c = g.createRadialGradient(x, y, 0, x, y, rx); c.addColorStop(0, `rgba(20,16,12,${a})`); c.addColorStop(1, 'rgba(20,16,12,0)');
  g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y); g.fillStyle = c; g.beginPath(); g.arc(x, y, rx, 0, 7); g.fill(); g.restore();
}
