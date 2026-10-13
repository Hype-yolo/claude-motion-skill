// Snake: corn snake (Pantherophis guttatus) by default; western diamondback rattlesnake
// (Crotalus atrox) with `variant: 'rattlesnake'`. Proving species for the snake body plan
// (core/motion/snake.js, core/rig/snake.js).
import { snakeRig } from './rig.js';
import { sculptSnake, eyeSpec } from './sculpt.js';
import { snakeRegions } from './regions.js';
import { snakeCoat, markColorOf } from './coat.js';
import { motion } from './motion.js';

const VARIANTS = { corn: 'corn', cornsnake: 'corn', rattlesnake: 'rattlesnake', rattler: 'rattlesnake', diamondback: 'rattlesnake', viper: 'rattlesnake' };

export default {
  id: 'snake',
  name: 'Snake',
  latin: 'Pantherophis guttatus',
  group: 'others',
  plan: 'snake',
  covering: 'scales',
  variants: [
    { id: 'corn', name: 'Corn snake', latin: 'Pantherophis guttatus' },
    { id: 'rattlesnake', name: 'Western diamondback rattlesnake', latin: 'Crotalus atrox' },
  ],

  // Seeded individual. Size: corn adults 0.9-1.5 m (reference 1.2 m), rattlesnake 0.9-1.6 m, males
  // larger with longer tails; hatchlings ~0.3 m with relatively bigger heads and eyes.
  variation(R, o) {
    const variant = VARIANTS[String(o.variant || 'corn').toLowerCase()] || 'corn';
    const viper = variant === 'rattlesnake';
    const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
    const age = o.age || 'adult';
    const juv = age === 'juvenile';
    const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
    const male = sex === 'male';
    const size = (male ? 1.04 : 0.96) * (1 + 0.1 * g()) * (juv ? 0.27 : 1) * (viper && male ? 1.05 : 1);
    const shape = {
      length: 1,
      girth: (1 + 0.07 * g()) * (juv ? 0.92 : 1) * (viper && !male ? 1.04 : 1),
      head: (1 + 0.04 * g()) * (juv ? 1.4 : 1),
      tail: (male ? 1.08 : 0.94) * (1 + 0.04 * g()),
    };
    const r = R();
    const morph = viper ? 'diamondback' : r < 0.52 ? 'normal' : r < 0.68 ? 'okeetee' : r < 0.84 ? 'wild' : r < 0.94 ? 'amel' : 'anery';
    return {
      variant, sex, age, size, shape,
      warps: [],
      minThick: 0.0005,
      rattleSegs: viper ? (juv ? 1 : 5 + Math.floor(R() * 4)) : 0,
      coat: { morph, seed: Math.floor(R() * 1e6), warm: 1.1 * g(), light: 0.1 * g(), count: 1 + 0.1 * g(), dull: Math.max(0, 0.45 * g() + 0.1), blotch: 1 + 0.18 * g(), tone: viper ? 2 * R() - 1 : 0 },
    };
  },
  rig: (params) => snakeRig(params),
  sculpt: (m, rig, params) => sculptSnake(m, rig, params),
  regions: snakeRegions,
  coat: snakeCoat,
  eyeSpecs: (params, rig) => [1, -1].map((side) => ({ side, spec: eyeSpec(params), headOrigin: rig.J.v0, bone: 'head', look: lookOf(params) })),
  motion,
  // render hints may depend on the individual (the mark colour follows the morph)
  render: (params) => ({ markColor: markColorOf(params || {}) }),
};

function lookOf(params) {
  if (params.variant === 'rattlesnake') {
    return { pupil: 'slit', lids: 'none', pupilSize: [0.1, 0.55], iris: { inner: [0.12, 0.1, 0.07], mid: [0.33, 0.27, 0.19], hi: [0.5, 0.42, 0.3], outer: [0.16, 0.13, 0.09] }, sclera: { color: [0.2, 0.17, 0.12], visible: false }, lidColor: [0.2, 0.17, 0.13] };
  }
  const amel = params.coat?.morph === 'amel';
  return {
    pupil: 'round', lids: 'none', pupilSize: [0.34, 0.5],
    iris: amel
      ? { inner: [0.35, 0.02, 0.03], mid: [0.62, 0.06, 0.07], hi: [0.8, 0.2, 0.16], outer: [0.4, 0.03, 0.04] }
      : { inner: [0.2, 0.06, 0.02], mid: [0.62, 0.22, 0.06], hi: [0.82, 0.42, 0.14], outer: [0.16, 0.05, 0.02] },
    sclera: { color: [0.3, 0.12, 0.05], visible: false }, lidColor: [0.3, 0.12, 0.05],
  };
}
