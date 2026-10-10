// Copperplate engraving engine — public entry.
//   burin.js  line engine: ordered strokes, hatching, cross-hatching, stipple, fur, tone fields, formTone, contourHatch
//   plate.js  paper, plate mark, border, engraved lettering, roundels, leader lines
//   wash.js   hand colouring (independent layer)
//   copper.js the copper plate, grooves, burin and swarf (for close-ups of the cutting)
export * as B from './burin.js';
export * from './plate.js';
export { Wash } from './wash.js';
export * as Copper from './copper.js';
import * as B from './burin.js';

// Engrave any closed shape with a light direction: outline + form-following hatching in the engraver's three passes.
//   d: SVG path string (or { polys }), at: B.xf(x, y, scale, rot)
//   light: [x, y] toward the light (screen space). style: 'hatch' (straight families bent to the form) | 'contour'.
// Returns { ink, shape, tone } — the ink groups are `${g}ol`, `${g}h1`, `${g}h2`, `${g}h3`, ready for ink.schedule().
export function engraveShape(d, { at = B.xf(), light = [-0.6, -0.7], spacing = 4, wMax = 1.6, outlineW = 1.8, style = 'hatch', angle = -0.6, ink = new B.Ink(), g = '', base = 0.05, seed = 1 } = {}) {
  const sh = typeof d === 'string' ? B.shape(d, at) : d;
  const tone = B.formTone(sh.polys, { light, base });
  ink.group(g + 'ol'); for (const p of sh.polys) B.outline(ink, p, { w: outlineW, light, seed });
  for (const l of sh.lines || []) B.stroke(ink, l, outlineW * 0.8);
  if (style === 'contour') { ink.group(g + 'h1'); B.contourHatch(ink, sh.polys, { spacing, tone, wMax, thr: 0.12, seed }); ink.group(g + 'h2'); B.hatch(ink, sh.polys, { angle, spacing: spacing * 1.15, tone, thr: 0.55, wMax: wMax * 0.8, seed: seed + 1 }); }
  else { ink.group(g + 'h1'); B.hatch(ink, sh.polys, { angle, spacing, tone, thr: 0.12, wMax, seed }); ink.group(g + 'h2'); B.hatch(ink, sh.polys, { angle: angle + 1.05, spacing: spacing * 1.1, tone, thr: 0.5, wMax: wMax * 0.8, seed: seed + 1 }); }
  ink.group(g + 'h3'); B.hatch(ink, sh.polys, { angle: angle - 0.5, spacing: spacing * 1.25, tone, thr: 0.78, wMax: wMax * 0.6, seed: seed + 2 });
  return { ink, shape: sh, tone };
}
