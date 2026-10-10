// plate.js — the printed sheet around an engraving: laid paper, the pressed plate mark, ruled border,
// engraved lettering (roman capitals and copperplate script), magnification roundels and leader lines.
// Everything draws in world coordinates under the camera transform, so it stays sharp at any zoom.
import * as B from './burin.js';
const { clamp, RNG, noise2, sstep } = B;

export const PAL = {
  paper: '#f1e8d2', plateTone: '#e8ddc2', ink: '#1c1510', inkSoft: '#3a2c20', foxing: '#9a6a34',
  bevelDark: 'rgba(96,70,40,0.42)', bevelLight: 'rgba(255,251,240,0.95)',
};
export const FONTS = { roman: 'Bodoni Moda', script: 'Pinyon Script' };

// ---------- paper: a world-space texture (laid lines, fibres, foxing), built once ----------
let paperCache = null;
export function paperTexture(W = 1920, H = 1080, seed = 53) {
  if (paperCache && paperCache.W === W && paperCache.H === H) return paperCache.c;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), R = RNG(seed);
  const im = g.createImageData(W, H), d = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise2(x / 2.2, y / 2.2, 1) * 0.45 + noise2(x / 34, y / 34, 2) * 0.35 + noise2(x / 190, y / 190, 3) * 0.45;
    const laid = (y % 4 === 0 ? 0.03 : 0) + (x % 72 < 1 ? 0.035 : 0);
    const v = 255 - (n * 13 + laid * 90);
    const i = (y * W + x) * 4; d[i] = v; d[i + 1] = v - 1.5; d[i + 2] = v - 6; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  // fibres
  g.globalAlpha = 0.06; g.strokeStyle = '#6b5030'; g.lineWidth = 0.6;
  for (let k = 0; k < 900; k++) { const x = R() * W, y = R() * H, a = R() * 6.28, l = 3 + R() * 9; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.6, y + Math.sin(a + 0.6) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  // foxing: small rust spots, mostly toward the edges
  for (let k = 0; k < 70; k++) { let x = R() * W, y = R() * H; if (R() < 0.7) { if (R() < 0.5) x = R() < 0.5 ? R() * 120 : W - R() * 120; else y = R() < 0.5 ? R() * 90 : H - R() * 90; } const r = 1 + R() * 5; g.globalAlpha = 0.05 + R() * 0.1; g.fillStyle = PAL.foxing; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  paperCache = { W, H, c };
  return c;
}

// the sheet: paper, plate tone inside the plate mark, the bevel of the mark (debossed, lit from the upper left)
export function drawSheet(ctx, { W = 1920, H = 1080, plate = [70, 44, 1850, 1036], tone = 1 } = {}) {
  const [x0, y0, x1, y1] = plate;
  ctx.save();
  ctx.fillStyle = PAL.paper; ctx.fillRect(-2000, -2000, W + 4000, H + 4000);
  ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(paperTexture(W, H), 0, 0, W, H);
  // plate tone: the thin film of ink the printer leaves when wiping the plate
  ctx.globalAlpha = 0.55 * tone; ctx.fillStyle = PAL.plateTone; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // the bevel: top and left walls turn from the light, bottom and right catch it
  const b = 5;
  ctx.fillStyle = PAL.bevelDark;
  ctx.beginPath(); ctx.moveTo(x0 - b, y0 - b); ctx.lineTo(x1 + b, y0 - b); ctx.lineTo(x1, y0); ctx.lineTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x0 - b, y1 + b); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.bevelLight;
  ctx.beginPath(); ctx.moveTo(x1 + b, y0 - b); ctx.lineTo(x1 + b, y1 + b); ctx.lineTo(x0 - b, y1 + b); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(90,64,36,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(x0 - b, y0 - b, x1 - x0 + 2 * b, y1 - y0 + 2 * b);
  ctx.restore();
}

// ruled border: a heavy line and a hairline, cut as ink so it can be engraved in time
export function borderInk(ink, [x0, y0, x1, y1], { gap = 9 } = {}) {
  B.outline(ink, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { w: 2.4, vary: 0.15, grain: 0.04, step: 4 });
  B.outline(ink, [[x0 + gap, y0 + gap], [x1 - gap, y0 + gap], [x1 - gap, y1 - gap], [x0 + gap, y1 - gap]], { w: 0.8, vary: 0.1, grain: 0.04, step: 4 });
}

// ---------- engraved lettering ----------
// Roman capitals are cut glyph by glyph (each glyph wipes in from the left, as the burin travels);
// script is written in one continuous stroke from left to right with a soft wet edge.
export function measure(ctx, str, { size = 40, font = FONTS.roman, weight = 500, italic = false, track = 0 } = {}) {
  ctx.save(); ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px "${font}"`;
  const chars = [...str], ws = chars.map(ch => ctx.measureText(ch).width), tw = ws.reduce((a, b) => a + b, 0) + track * size * Math.max(0, chars.length - 1);
  ctx.restore(); return { chars, ws, tw };
}
export function engraveText(ctx, str, x, y, o = {}) {
  const { size = 40, font = FONTS.roman, weight = 500, italic = false, track = 0, align = 'center', color = PAL.ink, p = 1, alpha = 1 } = o;
  if (p <= 0 || !str) return;
  const { chars, ws, tw } = measure(ctx, str, o);
  ctx.save(); ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px "${font}"`; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = alpha;
  let cx = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  const N = chars.length, shown = p * (N + 2);
  for (let i = 0; i < N; i++) {
    const f = clamp(shown - i * 1.0 - 0.5, 0, 1.5) / 1.5;
    if (f > 0) {
      if (f < 1) { ctx.save(); ctx.beginPath(); ctx.rect(cx - 2, y - size * 1.2, (ws[i] + 4) * f, size * 1.6); ctx.clip(); ctx.fillText(chars[i], cx, y); ctx.restore(); }
      else ctx.fillText(chars[i], cx, y);
    }
    cx += ws[i] + track * size;
  }
  ctx.restore();
}
export function writeScript(ctx, str, x, y, o = {}) {
  const { size = 40, font = FONTS.script, color = PAL.ink, align = 'center', p = 1, alpha = 1, weight = 400 } = o;
  if (p <= 0 || !str) return;
  ctx.save(); ctx.font = `${weight} ${size}px "${font}"`; ctx.textBaseline = 'alphabetic';
  const tw = ctx.measureText(str).width, x0 = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  const edge = x0 - size * 0.3 + (tw + size * 0.6) * clamp(p);
  ctx.globalAlpha = alpha;
  if (p < 1) {
    const g = ctx.createLinearGradient(edge - size * 0.9, 0, edge, 0); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.rect(x0 - size, y - size * 1.5, edge - x0 + size, size * 2.2); ctx.clip(); ctx.fillStyle = g;
    // solid part
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - size, y - size * 1.5, Math.max(0, edge - size * 0.9 - x0 + size), size * 2.2); ctx.clip(); ctx.fillStyle = color; ctx.fillText(str, x0, y); ctx.restore();
    ctx.fillText(str, x0, y);
  } else { ctx.fillStyle = color; ctx.fillText(str, x0, y); }
  ctx.restore();
}
// fit a string into a width: shrink to minSize, then wrap into two lines
export function fitLines(ctx, str, maxW, o) {
  let size = o.size; const min = o.minSize ?? o.size * 0.8;
  for (; size >= min; size -= 1) { if (measure(ctx, str, { ...o, size }).tw <= maxW) return { lines: [str], size }; }
  const words = str.split(' '); let best = null;
  for (let k = 1; k < words.length; k++) { const a = words.slice(0, k).join(' '), b = words.slice(k).join(' '), w = Math.max(measure(ctx, a, { ...o, size: o.size }).tw, measure(ctx, b, { ...o, size: o.size }).tw); if (!best || w < best.w) best = { w, lines: [a, b] }; }
  size = o.size; while (size > min * 0.85 && best.w * size / o.size > maxW) size -= 1;
  return { lines: best.lines, size };
}

// ---------- roundel: a magnification in a double-ruled circle ----------
// content: { ink, regions } built for radius 500 local units. The roundel draws at centre (x, y) with radius r.
export function roundelFrame(ctx, x, y, r, { p = 1, w = 2.2 } = {}) {
  if (p <= 0) return;
  ctx.save(); ctx.strokeStyle = PAL.ink; ctx.lineCap = 'round';
  const a0 = -Math.PI / 2 - 0.4, a1 = a0 + Math.PI * 2 * clamp(p);
  ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke();
  ctx.lineWidth = w * 0.38; ctx.beginPath(); ctx.arc(x, y, r - Math.max(3.5, r * 0.035), a0, a0 + Math.PI * 2 * clamp(p * 1.1 - 0.1)); ctx.stroke();
  ctx.restore();
}
// leader line from a point on the figure to the rim of a roundel, with a tiny reference number near its root
export function leader(ctx, from, to, { p = 1, w = 0.9, num = null, numP = 1, size = 16 } = {}) {
  if (p <= 0) return;
  const x = from[0] + (to[0] - from[0]) * clamp(p), y = from[1] + (to[1] - from[1]) * clamp(p);
  ctx.save(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(x, y); ctx.stroke();
  ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(from[0], from[1], w * 1.6, 0, 7); ctx.fill();
  ctx.restore();
  if (num != null && numP > 0) {
    const dx = to[0] - from[0], dy = to[1] - from[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const m = [from[0] + dx * 0.16 + nx * 12, from[1] + dy * 0.16 + ny * 12 + size * 0.35];
    engraveText(ctx, num, m[0], m[1], { size, italic: true, weight: 500, p: numP });
  }
}
// wrap a string into lines no wider than maxW at a fixed size (the size never changes; long text gets more lines)
export function wrapLines(ctx, str, maxW, o) {
  const words = String(str || '').split(/\s+/).filter(Boolean), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (!cur || measure(ctx, t, o).tw <= maxW) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  // balance two-line notes so no word is left alone on the second line
  if (lines.length === 2) { let best = null; for (let k = 1; k < words.length; k++) { const a = words.slice(0, k).join(' '), b = words.slice(k).join(' '), wa = measure(ctx, a, o).tw, wb = measure(ctx, b, o).tw; if (wa > maxW || wb > maxW) continue; const m = Math.max(wa, wb); if (!best || m < best.m) best = { m, l: [a, b] }; } if (best) return best.l; }
  return lines;
}
