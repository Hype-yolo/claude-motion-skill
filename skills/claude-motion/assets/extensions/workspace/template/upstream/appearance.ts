/** Deterministic character appearance derived from a desk's seed. */

const SKIN_TONES = ['#f1c9a5', '#e0ac85', '#c68863', '#a0674b', '#7a4a33', '#5b3726'];
const HAIR_COLORS = ['#1f1a17', '#3b2a20', '#6b4a2f', '#a57a4c', '#d9b77a', '#8c8c8c', '#b3462f'];
const SHIRT_COLORS = [
  '#3d85c6',
  '#e07a5f',
  '#81b29a',
  '#f2cc8f',
  '#9b72cf',
  '#4ecdc4',
  '#2f3e46',
  '#e56b6f',
  '#f4f1de',
];
const PANTS_COLORS = ['#2f3e46', '#3b4a6b', '#4a4a4a', '#6b5a45', '#1f2328', '#5b6270'];
const SHOES_COLORS = ['#1f2328', '#f4f4f4', '#6f4e37', '#3a3f47'];
export const HAIR_STYLES = ['hair_short', 'hair_long', 'hair_bun', 'hair_curly', 'hair_cap'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export interface Appearance {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
  hairStyle: HairStyle;
  glasses: boolean;
}

/** Small deterministic PRNG (mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)]!;
}

export function appearanceFromSeed(seed: number): Appearance {
  const random = seededRandom(seed);
  return {
    skin: pick(random, SKIN_TONES),
    hair: pick(random, HAIR_COLORS),
    shirt: pick(random, SHIRT_COLORS),
    pants: pick(random, PANTS_COLORS),
    shoes: pick(random, SHOES_COLORS),
    hairStyle: pick(random, HAIR_STYLES),
    glasses: random() < 0.3,
  };
}
