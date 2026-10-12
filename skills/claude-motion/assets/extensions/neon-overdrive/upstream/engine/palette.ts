import { hexToLinear } from './util';

// Evangelion HUD: NERV-terminal black, command orange, emergency red, and the instrument
// accents: phosphor green (scopes, MAGI), pattern blue (targets), Unit-01 purple + lime (berserk).
// Old key names (bone, signal, ...) are kept as aliases so the engine's HUD/post code still works.
export const HEX = {
  ink: '#050403', // terminal black
  ink2: '#120C06', // raised panel black (warm)
  graphite: '#4A3218', // dim orange-brown lines
  ash: '#9C6A2E', // mid amber
  bone: '#FFE9C8', // warm white (primary text on black)
  metal: '#C8B8A0',
  orange: '#FF7A00', // command orange: the main HUD colour
  amber: '#FFB000', // highlight amber
  red: '#FF1A1A', // EMERGENCY red
  blood: '#6A0000', // deep red panels
  green: '#39FF6A', // phosphor green (scopes, MAGI approve)
  cyan: '#00C8FF', // pattern blue (targets, blood type blue)
  purple: '#7A3CFF', // Unit-01 purple
  lime: '#B6FF00', // Unit-01 lime
  signal: '#FF1A1A', // alias: red
  ember: '#FF5A3C',
  brine: '#00C8FF', // alias: cyan
  sulfur: '#FFB000', // alias: amber
} as const;

export type PaletteKey = keyof typeof HEX;

/** Linear RGB triplets for GL uniforms. */
export const LIN: Record<PaletteKey, [number, number, number]> = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<PaletteKey, [number, number, number]>;

/** CSS rgba() for Canvas2D. */
export function rgba(key: PaletteKey | string, a = 1): string {
  const hex = (HEX as Record<string, string>)[key] ?? key;
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
