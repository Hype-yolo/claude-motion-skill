import { hexToLinear } from './util';

// Printed in four inks on one paper. Every colour on screen is paper, an ink, a tint of an ink
// (halftoned by the print pass) or an overprint of two inks. See TREATMENT.md.
// Keep INK in sync with tools/make_inklut.py (the separation LUT is built from the same values).
export const INK = {
  paper: '#f3eee3',
  black: '#1d1b20',
  blue: '#2b3f9e',
  yellow: '#ffd21f',
  orange: '#f2602b',
} as const;

export type InkKey = keyof typeof INK;

const PAPER_LIN = hexToLinear(INK.paper);
const T: Record<Exclude<InkKey, 'paper'>, [number, number, number]> = Object.fromEntries(
  (['black', 'blue', 'yellow', 'orange'] as const).map((k) => {
    const c = hexToLinear(INK[k]);
    return [k, [Math.min(1, c[0] / PAPER_LIN[0]), Math.min(1, c[1] / PAPER_LIN[1]), Math.min(1, c[2] / PAPER_LIN[2])]];
  }),
) as any;

const toS = (x: number) => (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);

/**
 * CSS colour of a mix of inks at the given coverages, as the print model renders it
 * (paper x product of (1 - a(1 - T))). Draw with these and the print pass recovers the coverages:
 * `ink({ blue: 0.3 })` becomes a 30% blue halftone, `ink({ blue: 1, yellow: 1 })` a solid overprint.
 */
export function ink(cov: Partial<Record<Exclude<InkKey, 'paper'>, number>>, alpha = 1): string {
  const rgb = [PAPER_LIN[0], PAPER_LIN[1], PAPER_LIN[2]];
  for (const [k, a] of Object.entries(cov) as [Exclude<InkKey, 'paper'>, number][]) {
    const t = T[k];
    for (let i = 0; i < 3; i++) rgb[i]! *= 1 - a * (1 - t[i]!);
  }
  const [r, g, b] = rgb.map((x) => Math.round(Math.max(0, Math.min(1, toS(x))) * 255));
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Solid ink or paper as CSS. */
export const C = {
  paper: INK.paper,
  black: INK.black,
  blue: INK.blue,
  yellow: INK.yellow,
  orange: INK.orange,
  green: ink({ blue: 1, yellow: 1 }), // overprint
  brown: ink({ blue: 1, orange: 1 }), // overprint
  red: ink({ yellow: 1, orange: 1 }), // overprint
} as const;

/** Linear RGB triplets for GL uniforms. */
export const LIN = Object.fromEntries(Object.entries(INK).map(([k, v]) => [k, hexToLinear(v)])) as Record<InkKey, [number, number, number]>;

// --- compatibility with the engine's older palette API (HUD, glsl consts) ---
export const HEX = {
  ink: INK.black,
  ink2: INK.black,
  graphite: '#5E5B57',
  ash: '#9C978F',
  bone: INK.paper,
  signal: INK.orange,
  ember: INK.yellow,
  blood: INK.orange,
  acid: INK.yellow,
} as const;
export type PaletteKey = keyof typeof HEX;
export function rgba(key: PaletteKey | string, a = 1): string {
  const hex = (HEX as Record<string, string>)[key] ?? (INK as Record<string, string>)[key] ?? key;
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
