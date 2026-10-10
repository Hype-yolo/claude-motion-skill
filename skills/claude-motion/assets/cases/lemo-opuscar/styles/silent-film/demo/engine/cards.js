// Intertitle cards (art-deco border + serif), iris, and the theatre around the 4:3 gate.
import { grey } from './ink.js';
export const CARD_BG = '#0e0d0b', CARD_FG = '#ece5d5';
export const FONT_BODY = 'Old Standard TT', FONT_TITLE = 'Playfair Display SC';

// ---- art-deco border ----
// level 0 = one heavy rule (a shout), 1 = double rule + stepped corners + fans, 2 = + vines and flowers (tender)
export function decoBorder(g, x, y, w, h, level = 1, col = CARD_FG, seed = 1) {
  g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'square';
  const wob = (v, i) => v + Math.sin(i * 12.9898 + seed * 78.233) * .5;   // hand-lettered card: tiny wobble
  if (level === 0) { g.lineWidth = 9; g.strokeRect(x + 30, y + 30, w - 60, h - 60); g.restore(); return; }
  const m1 = 34, m2 = 52, st = 34;
  g.lineWidth = 2.2; g.strokeRect(wob(x + m1, 1), wob(y + m1, 2), w - 2 * m1, h - 2 * m1);
  // inner heavy rule with stepped (notched) corners
  g.lineWidth = 5.5;
  const X0 = x + m2, Y0 = y + m2, X1 = x + w - m2, Y1 = y + h - m2, s = st;
  g.beginPath();
  g.moveTo(X0 + s, Y0); g.lineTo(X1 - s, Y0); g.lineTo(X1 - s, Y0 + s * .5); g.lineTo(X1 - s * .5, Y0 + s * .5); g.lineTo(X1 - s * .5, Y0 + s); g.lineTo(X1, Y0 + s);
  g.lineTo(X1, Y1 - s); g.lineTo(X1 - s * .5, Y1 - s); g.lineTo(X1 - s * .5, Y1 - s * .5); g.lineTo(X1 - s, Y1 - s * .5); g.lineTo(X1 - s, Y1);
  g.lineTo(X0 + s, Y1); g.lineTo(X0 + s, Y1 - s * .5); g.lineTo(X0 + s * .5, Y1 - s * .5); g.lineTo(X0 + s * .5, Y1 - s); g.lineTo(X0, Y1 - s);
  g.lineTo(X0, Y0 + s); g.lineTo(X0 + s * .5, Y0 + s); g.lineTo(X0 + s * .5, Y0 + s * .5); g.lineTo(X0 + s, Y0 + s * .5); g.closePath();
  g.stroke();
  // corner fans (sunburst) in the notches
  const fan = (cx, cy, a0) => { g.lineWidth = 1.6; for (let i = 0; i <= 6; i++) { const a = a0 + i / 6 * Math.PI / 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6); g.lineTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26); g.stroke(); } g.beginPath(); g.arc(cx, cy, 4, 0, 7); g.fill(); };
  fan(x + m1, y + m1, 0); fan(x + w - m1, y + m1, Math.PI / 2); fan(x + w - m1, y + h - m1, Math.PI); fan(x + m1, y + h - m1, Math.PI * 1.5);
  // top/bottom centre diamonds with rules
  const dia = (cx, cy) => { g.beginPath(); g.moveTo(cx, cy - 11); g.lineTo(cx + 16, cy); g.lineTo(cx, cy + 11); g.lineTo(cx - 16, cy); g.closePath(); g.fill(); g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 120, cy); g.lineTo(cx - 26, cy); g.moveTo(cx + 26, cy); g.lineTo(cx + 120, cy); g.stroke(); g.beginPath(); g.arc(cx - 132, cy, 3, 0, 7); g.arc(cx + 132, cy, 3, 0, 7); g.fill(); };
  dia(x + w / 2, y + m2 + 30); dia(x + w / 2, y + h - m2 - 30);
  if (level >= 2) {        // vines + small flowers along the sides
    g.lineWidth = 1.5;
    for (const side of [0, 1]) {
      const sx = side ? x + w - m2 - 26 : x + m2 + 26;
      g.beginPath();
      for (let i = 0; i <= 60; i++) { const u = i / 60, yy = y + m2 + 70 + u * (h - 2 * m2 - 140), xx = sx + Math.sin(u * Math.PI * 5) * 9 * (side ? -1 : 1); i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
      g.stroke();
      for (let k = 0; k < 5; k++) {
        const u = (k + .5) / 5, yy = y + m2 + 70 + u * (h - 2 * m2 - 140), xx = sx + Math.sin(u * Math.PI * 5) * 9 * (side ? -1 : 1);
        for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; g.beginPath(); g.ellipse(xx + Math.cos(a) * 5, yy + Math.sin(a) * 5, 4.2, 2.4, a, 0, 7); g.fill(); }
        g.fillStyle = CARD_BG; g.beginPath(); g.arc(xx, yy, 2, 0, 7); g.fill(); g.fillStyle = col;
      }
    }
  }
  g.restore();
}

// ---- intertitle: spec = { lines:[{text, font, size, italic, caps, spacing}], level, seed, shake }
export function intertitle(g, W, H, spec, t = 0) {
  g.save();
  g.fillStyle = CARD_BG; g.fillRect(0, 0, W, H);
  // faint fibre in the black card (it was a painted card photographed)
  g.globalAlpha = .06; for (let i = 0; i < 90; i++) { const a = Math.sin(i * 91.7) * 43758.5, b = a - Math.floor(a); const c = Math.sin(i * 17.3) * 9631.1, d = c - Math.floor(c); g.fillStyle = grey(.5 + d * .3); g.fillRect(b * W, d * H, 1 + d * 2, 1); }
  g.globalAlpha = 1;
  decoBorder(g, 0, 0, W, H, spec.level ?? 1, CARD_FG, spec.seed ?? 1);
  const lines = spec.lines, gap = spec.gap ?? 1.28;
  const total = lines.reduce((s, l) => s + l.size * gap, 0);
  let yy = H / 2 - total / 2 + (spec.dy ?? 0);
  for (const l of lines) {
    const f = `${l.italic ? 'italic ' : ''}${l.weight ?? 400} ${l.size}px "${l.font ?? FONT_BODY}"`;
    g.font = f; g.fillStyle = l.color ?? CARD_FG; g.textAlign = 'center'; g.textBaseline = 'middle';
    let sx = 0, sy = 0;
    if (spec.shake) { const k = Math.max(0, 1 - t / spec.shake) ; sx = Math.sin(t * 90) * 5 * k; sy = Math.cos(t * 77) * 4 * k; }
    const txt = l.caps ? l.text.toUpperCase() : l.text;
    if (l.spacing) { g.letterSpacing = l.spacing + 'px'; }
    g.fillText(txt, W / 2 + sx, yy + l.size * gap / 2 + sy);
    g.letterSpacing = '0px';
    if (l.rule) { const tw = g.measureText(txt).width; g.fillRect(W / 2 - tw * .35, yy + l.size * gap - 4, tw * .7, 2); }
    yy += l.size * gap;
  }
  g.restore();
}

// ---- iris: black outside a circle (soft optical edge). r in px; r >= diag means fully open.
export function iris(g, W, H, cx, cy, r, feather = 3) {
  if (r > Math.hypot(W, H)) return;
  const rr = Math.max(0.01, r);
  const gr = g.createRadialGradient(cx, cy, Math.max(0, rr - feather), cx, cy, rr + feather);
  gr.addColorStop(0, 'rgba(8,7,6,0)'); gr.addColorStop(1, 'rgba(8,7,6,1)');     // beyond the last stop the gradient stays opaque
  g.save(); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
}

// ---- theatre around the gate: black house, velvet curtains lit by the screen's spill ----
export function theatre(g, W, H, gate, spill = .3, curtainOpen = 1) {
  // gate = {x, y, w, h}
  g.save();
  g.fillStyle = '#050404'; g.fillRect(0, 0, W, H);
  const drawCurtain = (x0, x1, side) => {
    const n = 7, cw = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const xa = x0 + i * cw, gr = g.createLinearGradient(xa, 0, xa + cw, 0);
      const near = side < 0 ? (i + 1) / n : 1 - i / n;           // folds nearer the screen catch more light
      const L = (.035 + spill * .16 * Math.pow(near, 1.6));
      gr.addColorStop(0, `rgb(${L * 255 * 1.25 | 0},${L * 255 * .62 | 0},${L * 255 * .55 | 0})`);
      gr.addColorStop(.5, `rgb(${L * 255 * .5 | 0},${L * 255 * .25 | 0},${L * 255 * .22 | 0})`);
      gr.addColorStop(1, `rgb(${L * 255 * 1.1 | 0},${L * 255 * .55 | 0},${L * 255 * .5 | 0})`);
      g.fillStyle = gr; g.fillRect(xa, 0, cw + 1, H);
    }
    // top shadow
    const tg = g.createLinearGradient(0, 0, 0, H); tg.addColorStop(0, 'rgba(0,0,0,.75)'); tg.addColorStop(.25, 'rgba(0,0,0,.2)'); tg.addColorStop(.8, 'rgba(0,0,0,.15)'); tg.addColorStop(1, 'rgba(0,0,0,.7)');
    g.fillStyle = tg; g.fillRect(x0, 0, x1 - x0, H);
  };
  const cwid = gate.x;
  const off = (1 - curtainOpen) * (W / 2);        // curtains close toward the centre
  drawCurtain(0 - 0 + off - (1 - curtainOpen) * 0, cwid + off, -1);
  drawCurtain(W - cwid - off, W - off, 1);
  g.restore();
}
