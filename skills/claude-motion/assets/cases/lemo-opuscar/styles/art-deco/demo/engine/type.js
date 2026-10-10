// Art Deco engine · typography & graphic components (title bar, numerals, year badge, dial, clock, subtitle card).
import { C, TAU, clamp, lerp, seg, ss, eo, eio, back, mix, rgba, goldGrad, gline, toPath, arcPts, sunburst, fan, sparkle, glow, polyPart } from './deco.js';

export const FONTS = { title: 'Limelight', deco: 'Poiret', sans: 'Josefin', serif: 'Italiana' };

// Gold-filled text with an engraved shadow and an optional moving sheen. align: 'center' | 'left' | 'right'.
export function goldText(g, text, x, y, { size = 72, font = FONTS.title, weight = '', align = 'center', sheen = .4, track = 0, sx = 1, sy = 1, shadow = true, fill = null, alpha = 1, stroke = 0 } = {}) {
  g.save(); g.globalAlpha *= alpha;
  g.font = `${weight} ${size}px ${font}`.trim(); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) g.letterSpacing = `${track}px`;
  const w = g.measureText(text).width - (track ? track : 0);
  const x0 = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;
  g.translate(x, y); g.scale(sx, sy);
  if (shadow) { g.fillStyle = 'rgba(0,0,0,.65)'; g.fillText(text, x0 + size * .03, size * .045); }
  g.fillStyle = fill || goldGrad(g, x0, -size * .9, x0 + w, size * .15, { sheen });
  g.fillText(text, x0, 0);
  if (stroke) { g.strokeStyle = C.gold0; g.lineWidth = stroke; g.strokeText(text, x0, 0); }
  g.restore();
  return w * sx;
}
export function measure(g, text, size, font = FONTS.title, track = 0, weight = '') {
  g.save(); g.font = `${weight} ${size}px ${font}`.trim(); if ('letterSpacing' in g) g.letterSpacing = `${track}px`; const w = g.measureText(text).width; g.restore(); return w;
}

// Plaque outline: a rectangle whose short ends step outward like a ziggurat (pointing left/right).
function plaquePts(cx, cy, w, h, step = .18) {
  const hw = w / 2, hh = h / 2, s = h * step;
  return [[cx - hw, cy - hh], [cx + hw, cy - hh], [cx + hw, cy - hh + s], [cx + hw + s, cy - hh + s], [cx + hw + s, cy - hh + 2 * s], [cx + hw + 2 * s, cy - hh + 2 * s],
  [cx + hw + 2 * s, cy + hh - 2 * s], [cx + hw + s, cy + hh - 2 * s], [cx + hw + s, cy + hh - s], [cx + hw, cy + hh - s], [cx + hw, cy + hh],
  [cx - hw, cy + hh], [cx - hw, cy + hh - s], [cx - hw - s, cy + hh - s], [cx - hw - s, cy + hh - 2 * s], [cx - hw - 2 * s, cy + hh - 2 * s],
  [cx - hw - 2 * s, cy - hh + 2 * s], [cx - hw - s, cy - hh + 2 * s], [cx - hw - s, cy - hh + s], [cx - hw, cy - hh + s], [cx - hw, cy - hh]];
}

// ---------- gold title bar ----------
// p: 0→1 entrance (line from a point → bar unfolds symmetrically → letters rise → wings & glint). out: 0→1 exit (reverse, closes to a line then a point).
export function titleBar(g, text, cx, cy, o = {}) {
  const { p = 1, out = 0, size = 76, font = FONTS.title, track = 6, sub = null, subSize = null, wings = true, pad = null, sheen = null, fillBar = true } = o;
  const k = p * (1 - out);
  if (k <= 0) return;
  const ssz0 = subSize ?? size * .34;
  const tw = Math.max(measure(g, text, size, font, track), sub ? measure(g, sub, ssz0, FONTS.sans, ssz0 * .45, 600) : 0), padX = pad ?? size * .9;
  const W = tw + padX * 2, H = size * (sub ? 2.05 : 1.45);
  const lineP = ss(seg(k, 0, .35)), open = eio(seg(k, .22, .6)), txt = ss(seg(k, .42, .85)), orn = back(seg(k, .62, 1));
  const sh = sheen ?? lerp(-.2, 1.2, seg(p, .45, 1));
  g.save();
  // 1) centre line grows from a point
  const lw = W * .5 * lineP + (wings ? Math.min(W * .16, size * 1.9) * orn : 0);
  if (lineP > 0) {
    glow(g, cx, cy, 60 + 200 * lineP, '#ffcf7a', .25 * (1 - open * .6));
    if (open < .98) gline(g, [[cx - lw, cy], [cx + lw, cy]], { w: 2.2, glow: .6 * (1 - open) });
  }
  // 2) bar unfolds (top/bottom borders part from the centre line)
  if (open > 0) {
    const hh = H / 2 * open;
    const pts = plaquePts(cx, cy, W, hh * 2, .16);
    if (fillBar) {
      const gr = g.createLinearGradient(0, cy - hh, 0, cy + hh); gr.addColorStop(0, '#16120c'); gr.addColorStop(.5, '#050403'); gr.addColorStop(1, '#16120c');
      g.fillStyle = gr; g.fill(toPath(pts, true));
    }
    gline(g, pts, { w: 2.6, closed: true, bb: [cx - W / 2, cy - hh, cx + W / 2, cy + hh], sheen: .3 + sh * .4 });
    const inner = plaquePts(cx, cy, W - 22, Math.max(2, hh * 2 - 22), .16);
    if (hh > 14) gline(g, inner, { w: 1.2, closed: true, bb: [cx - W / 2, cy - hh, cx + W / 2, cy + hh], sheen: .5 });
    // wings: stepped rules that extend beyond the plaque
    if (wings && orn > 0) {
      const s = hh * 2 * .16, ex = W / 2 + 2 * s + 10;
      for (const sg of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const y = cy + (i - 1) * hh * .32, L = Math.min(W * .16, size * 1.9) * (i % 2 ? .7 : 1) * orn;
          gline(g, [[cx + sg * ex, y], [cx + sg * (ex + L), y]], { w: i === 1 ? 2 : 1.2 });
        }
        fan(g, cx + sg * (ex + Math.min(W * .16, size * 1.9) * orn + 16), cy, Math.min(22, size * .3) * orn, { a0: sg > 0 ? -Math.PI / 2 : Math.PI / 2, a1: sg > 0 ? Math.PI / 2 : Math.PI * 1.5, ribs: 5, open: orn, fill: C.gold1, ring: .3 });
      }
    }
  }
  // 3) letters rise out of the centre line, clipped to the bar
  if (txt > 0) {
    g.save();
    const hh = H / 2 * open; g.beginPath(); g.rect(cx - W, cy - hh + 3, W * 2, hh * 2 - 6); g.clip();
    const ty = cy + (sub ? -size * .02 : size * .34) + (1 - txt) * size * .5;
    goldText(g, text, cx, ty, { size, font, track, sheen: sh, alpha: txt });
    if (sub) {
      const ssz = subSize ?? size * .34;
      goldText(g, sub, cx, cy + size * .66 + (1 - txt) * size * .3, { size: ssz, font: FONTS.sans, weight: 600, track: ssz * .45, sheen: sh + .2, alpha: txt, shadow: false });
    }
    g.restore();
  }
  if (orn > .6 && out < .2) sparkle(g, cx + W / 2 - 8, cy - H / 2 * open + 4, 24 * (1 - Math.abs(seg(p, .8, 1) - .5) * 2), { alpha: 1 });
  g.restore();
  return { w: W, h: H };
}

// ---------- numerals ----------
// Tall deco digits: Poiret One stretched vertically, gold, with twin rules above & below.
export function decoDigits(g, str, x, y, size, { align = 'center', rules = true, sheen = .4, sy = 1.45, font = FONTS.deco, track = null, alpha = 1 } = {}) {
  const tr = track ?? size * .08;
  const w = goldText(g, str, x, y, { size, font, align, sheen, sy, track: tr, alpha });
  if (rules) {
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    for (const d of [-size * sy * .82, size * .18]) { gline(g, [[x0 - 8, y + d], [x0 + w + 8, y + d]], { w: 1.6, alpha }); gline(g, [[x0 - 8, y + d + (d < 0 ? -6 : 6)], [x0 + w + 8, y + d + (d < 0 ? -6 : 6)]], { w: .9, alpha }); }
  }
  return w;
}
// Year badge: a lozenge with "19" over a rule over "30", rays behind.
export function yearBadge(g, year, cx, cy, r, { p = 1, sheen = .4, rays = true } = {}) {
  const a = year.slice(0, 2), b = year.slice(2);
  const k = eo(p);
  if (rays) sunburst(g, cx, cy, { rays: 40, r0: r * 1.05, r1: r * (1.05 + .5 * k), mode: 'lines', w: 1.6, alpha: .9 * k });
  const d = r * k, pts = [[cx, cy - d], [cx + d * .82, cy], [cx, cy + d], [cx - d * .82, cy], [cx, cy - d]];
  g.save(); const gr = g.createRadialGradient(cx, cy, 0, cx, cy, d); gr.addColorStop(0, '#1b150d'); gr.addColorStop(1, '#050403'); g.fillStyle = gr; g.fill(toPath(pts, true)); g.restore();
  gline(g, pts, { w: 2.6, glow: .3 }); gline(g, pts.map(([x, y]) => [cx + (x - cx) * .88, cy + (y - cy) * .88]), { w: 1.1 });
  if (p > .4) {
    const al = ss(seg(p, .4, .9));
    goldText(g, a, cx, cy - r * .06, { size: r * .5, font: FONTS.deco, sy: 1.3, sheen, alpha: al, track: r * .04 });
    gline(g, [[cx - r * .42, cy + r * .04], [cx + r * .42, cy + r * .04]], { w: 1.6, alpha: al });
    goldText(g, b, cx, cy + r * .6, { size: r * .5, font: FONTS.deco, sy: 1.3, sheen: sheen + .2, alpha: al, track: r * .04 });
  }
}
// Floor medallion: circle + stepped cap + number (used for floor counters and chapter marks).
export function floorMedallion(g, label, cx, cy, r, { sheen = .4, sub = null, alpha = 1, lit = 0 } = {}) {
  g.save(); g.globalAlpha *= alpha;
  if (lit) glow(g, cx, cy, r * 2.4, '#ffcf7a', .35 * lit);
  sunburst(g, cx, cy, { rays: 24, r0: r * 1.08, r1: r * 1.45, mode: 'lines', w: 1.4, alpha: .8 });
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); const gr = g.createRadialGradient(cx - r * .3, cy - r * .3, 0, cx, cy, r); gr.addColorStop(0, '#221a10'); gr.addColorStop(1, '#040302'); g.fillStyle = gr; g.fill();
  gline(g, arcPts(cx, cy, r, 0, TAU, 64), { w: 2.4, closed: false }); gline(g, arcPts(cx, cy, r * .86, 0, TAU, 64), { w: 1 });
  // stepped cap
  const s = r * .22; const cap = [[cx - r * .5, cy - r * .88], [cx - r * .5, cy - r * .88 - s * .6], [cx - r * .25, cy - r * .88 - s * .6], [cx - r * .25, cy - r * .88 - s * 1.2], [cx + r * .25, cy - r * .88 - s * 1.2], [cx + r * .25, cy - r * .88 - s * .6], [cx + r * .5, cy - r * .88 - s * .6], [cx + r * .5, cy - r * .88]];
  gline(g, cap, { w: 1.8 });
  goldText(g, String(label), cx, cy + r * (sub ? .22 : .36), { size: r * (String(label).length > 2 ? .62 : .82), font: FONTS.deco, sy: 1.25, sheen, track: 2 });
  if (sub) goldText(g, sub, cx, cy + r * .6, { size: r * .17, font: FONTS.sans, weight: 600, track: r * .06, shadow: false });
  g.restore();
}

// ---------- elevator dial (semicircle floor indicator) ----------
// value 0..1 along the arc; labels spread over the arc (left → right). Returns the needle tip.
export function dial(g, cx, cy, r, value, { labels = ['L', '5', '10', '15', '20', '25', 'R'], sheen = .4, needleColor = null, frame = true, ticks = 30, alpha = 1, lit = 0 } = {}) {
  g.save(); g.globalAlpha *= alpha;
  if (frame) {
    g.beginPath(); g.moveTo(cx - r * 1.12, cy + r * .08); g.arc(cx, cy + r * .08, r * 1.12, Math.PI, TAU); g.closePath();
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r * 1.12); gr.addColorStop(0, lit ? '#3a2a12' : '#1a140c'); gr.addColorStop(1, '#050403'); g.fillStyle = gr; g.fill();
    gline(g, [...arcPts(cx, cy + r * .08, r * 1.12, Math.PI, TAU, 60), [cx - r * 1.12, cy + r * .08]], { w: 2.6, closed: true });
    gline(g, arcPts(cx, cy + r * .08, r * 1.02, Math.PI, TAU, 60), { w: 1 });
  }
  if (lit) glow(g, cx, cy, r, '#ffcf7a', .25 * lit);
  for (let i = 0; i <= ticks; i++) {
    const a = Math.PI + Math.PI * i / ticks, big = i % 5 === 0;
    gline(g, [[cx + Math.cos(a) * r * (big ? .74 : .82), cy + Math.sin(a) * r * (big ? .74 : .82)], [cx + Math.cos(a) * r * .92, cy + Math.sin(a) * r * .92]], { w: big ? 2 : 1 });
  }
  labels.forEach((L, i) => {
    const a = Math.PI + Math.PI * (i / (labels.length - 1)) * .92 + Math.PI * .04, rr = r * .56;
    goldText(g, L, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr + r * .08, { size: r * .17, font: FONTS.deco, sy: 1.2, shadow: false, track: 1 });
  });
  const a = Math.PI + Math.PI * (.04 + .92 * clamp(value));
  const tip = [cx + Math.cos(a) * r * .9, cy + Math.sin(a) * r * .9];
  g.save(); g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
  g.beginPath(); g.moveTo(cx + Math.cos(a + Math.PI / 2) * r * .035, cy + Math.sin(a + Math.PI / 2) * r * .035); g.lineTo(tip[0], tip[1]); g.lineTo(cx + Math.cos(a - Math.PI / 2) * r * .035, cy + Math.sin(a - Math.PI / 2) * r * .035);
  g.lineTo(cx - Math.cos(a) * r * .12, cy - Math.sin(a) * r * .12); g.closePath(); g.fillStyle = needleColor || goldGrad(g, cx - r, cy - r, cx + r, cy, { sheen: .55 }); g.fill(); g.restore();
  g.beginPath(); g.arc(cx, cy, r * .07, 0, TAU); g.fillStyle = goldGrad(g, cx - r * .07, cy - r * .07, cx + r * .07, cy + r * .07, { sheen: .3 }); g.fill();
  sunburst(g, cx, cy + r * .08, { rays: 9, r0: r * .1, r1: r * .3, a0: Math.PI * 1.1, a1: Math.PI * 1.9, mode: 'lines', w: 1.2, alpha: .7 });
  g.restore();
  return tip;
}

// ---------- clock face ----------
export function clockFace(g, cx, cy, r, { h = 11, m = 59, s = null, lit = 0, roman = true, alpha = 1, sheen = .4, face = '#0b0906' } = {}) {
  g.save(); g.globalAlpha *= alpha;
  if (lit) glow(g, cx, cy, r * 2.2, '#ffd98a', .45 * lit);
  // stepped octagonal bezel
  const oct = []; for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + Math.PI / 8 + i * TAU / 8; oct.push([cx + Math.cos(a) * r * 1.16, cy + Math.sin(a) * r * 1.16]); }
  g.fillStyle = '#050403'; g.fill(toPath(oct, true));
  gline(g, oct, { w: 2.6 });
  g.beginPath(); g.arc(cx, cy, r, 0, TAU);
  const gr = g.createRadialGradient(cx, cy - r * .3, 0, cx, cy, r); gr.addColorStop(0, lit ? mix(face, '#6b4a18', .6 * lit + .2) : mix(face, '#3a2c18', .5)); gr.addColorStop(1, face); g.fillStyle = gr; g.fill();
  gline(g, arcPts(cx, cy, r, 0, TAU, 72), { w: 2 }); gline(g, arcPts(cx, cy, r * .93, 0, TAU, 72), { w: .9 });
  sunburst(g, cx, cy, { rays: 60, r0: r * .2, r1: r * .72, mode: 'lines', w: .9, alpha: .28 });
  const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + i * TAU / 12;
    if (roman) {
      g.save(); g.translate(cx + Math.cos(a) * r * .78, cy + Math.sin(a) * r * .78); g.rotate(a + Math.PI / 2);
      goldText(g, R[i], 0, r * .06, { size: r * (i === 0 ? .2 : .15), font: FONTS.serif, sy: 1.25, shadow: false, track: 0 }); g.restore();
    } else gline(g, [[cx + Math.cos(a) * r * .8, cy + Math.sin(a) * r * .8], [cx + Math.cos(a) * r * .92, cy + Math.sin(a) * r * .92]], { w: i % 3 ? 2 : 4 });
  }
  const hand = (ang, len, w, col) => {
    g.save(); g.translate(cx, cy); g.rotate(ang); g.beginPath();
    g.moveTo(-w, 0); g.lineTo(0, -len); g.lineTo(w, 0); g.lineTo(0, len * .14); g.closePath();
    g.fillStyle = col || goldGrad(g, -w, -len, w, 0, { sheen }); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 5; g.fill(); g.restore();
  };
  const hm = (m + (s ?? 0) / 60), hh = (h % 12) + hm / 60;
  hand(hh / 12 * TAU, r * .5, r * .055);
  hand(hm / 60 * TAU, r * .74, r * .04);
  if (s != null) hand(s / 60 * TAU, r * .8, r * .012, C.burgL);
  g.beginPath(); g.arc(cx, cy, r * .05, 0, TAU); g.fillStyle = C.gold2; g.fill();
  g.restore();
}

// ---------- subtitle card ----------
// A lacquer bar with stepped ends and a twin gold keyline; opens symmetrically from the centre (same grammar as the film's transitions).
// speaker: 'radio' (announcer — tiny microphone icon) | 'boy' (bellboy — cap icon) | null.
export function subtitleCard(g, text, { p = 1, out = 0, speaker = null, cx = 960, cy = 985, size = 42, maxW = 1500 } = {}) {
  const k = eio(clamp(p)) * (1 - eio(clamp(out)));
  if (k <= 0) return;
  g.save();
  const tw = measure(g, text, size, FONTS.sans, 1, 600), icon = speaker ? size * 1.3 : 0;
  const W = Math.min(maxW, tw + icon + size * 2.2), H = size * 1.9;
  const w = W * ss(seg(k, 0, .7)), hh = H / 2 * ss(seg(k, .15, .75));
  // gold hairline first
  gline(g, [[cx - w / 2 - 20, cy], [cx + w / 2 + 20, cy]], { w: 1.4, alpha: 1 - ss(seg(k, .3, .8)) });
  if (hh > 1) {
    const pts = plaquePts(cx, cy, w, hh * 2, .14);
    g.fillStyle = 'rgba(6,5,4,.88)'; g.fill(toPath(pts, true));
    gline(g, pts, { w: 2, closed: true, bb: [cx - W / 2, cy - H, cx + W / 2, cy + H], sheen: .35 });
    if (hh > 12) gline(g, plaquePts(cx, cy, w - 14, hh * 2 - 14, .14), { w: .9, closed: true, bb: [cx - W / 2, cy - H, cx + W / 2, cy + H], sheen: .6 });
  }
  const ta = ss(seg(k, .6, 1));
  if (ta > 0) {
    g.globalAlpha *= ta;
    const x0 = cx - (tw + icon) / 2;
    if (speaker === 'radio') micIcon(g, x0 + icon * .35, cy, size * .52);
    if (speaker === 'boy') capIcon(g, x0 + icon * .35, cy, size * .5);
    g.font = `600 ${size}px ${FONTS.sans}`; if ('letterSpacing' in g) g.letterSpacing = '1px'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = C.ivory; g.fillText(text, x0 + icon, cy + size * .08);
  }
  g.restore();
}
export function micIcon(g, x, y, s) {   // 1930s ribbon-mic silhouette in gold
  g.save(); g.translate(x, y);
  const pts = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; pts.push([Math.cos(a + Math.PI / 2) * s * .42 * 0 + Math.sin(a) * s * .45 * (i < 12 ? -1 : -1), 0]); }
  g.beginPath(); g.ellipse(0, -s * .15, s * .38, s * .55, 0, 0, TAU); g.fillStyle = goldGrad(g, -s, -s, s, s, { sheen: .4 }); g.fill();
  g.strokeStyle = '#050403'; g.lineWidth = 1.2; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(-s * .3, -s * .15 + i * s * .17); g.lineTo(s * .3, -s * .15 + i * s * .17); g.stroke(); }
  g.fillStyle = C.gold1; g.fillRect(-s * .05, s * .4, s * .1, s * .35); g.fillRect(-s * .3, s * .72, s * .6, s * .08);
  g.restore();
}
export function capIcon(g, x, y, s) {    // pillbox cap
  g.save(); g.translate(x, y); g.rotate(-.18);
  g.beginPath(); g.ellipse(0, -s * .45, s * .55, s * .16, 0, 0, TAU); g.fillStyle = C.burgL; g.fill();
  g.fillStyle = C.burg; g.fillRect(-s * .55, -s * .45, s * 1.1, s * .7);
  g.beginPath(); g.ellipse(0, s * .25, s * .55, s * .16, 0, 0, Math.PI); g.fill();
  g.fillStyle = C.gold1; g.fillRect(-s * .55, s * .05, s * 1.1, s * .16);
  g.restore();
}
