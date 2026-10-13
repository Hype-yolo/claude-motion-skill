// Brown bear (Ursus arctos). Plantigrade, heavy-bodied omnivore with a shoulder hump, a dished face,
// small round ears and long non-retractile fore claws; walks, ambles, canters and gallops but avoids
// the trot. Variants: Eurasian (default), grizzly, coastal (Kodiak / Kamchatka type) and, on request
// only, the American black bear (Ursus americanus: no hump, straight profile, bigger ears).
import { bearRig, HEAD_O } from './rig.js';
import { sculptBear, eyeOf } from './sculpt.js';
import { bearRegions } from './regions.js';
import { bearCoat } from './coat.js';
import { motion } from './motion.js';
import { bearClaws } from './claws.js';

// random draws never produce the black bear (a different species): it is built only when asked for
const VARIANTS = [['eurasian', 0.45], ['grizzly', 0.3], ['coastal', 0.25]];
// coat colour morph per variant (probabilities)
const COATS = {
  eurasian: [['dark', 0.55], ['red', 0.25], ['medium', 0.2]],
  grizzly: [['grizzled', 0.7], ['blonde', 0.2], ['medium', 0.1]],
  coastal: [['medium', 0.5], ['blonde', 0.3], ['dark', 0.2]],
  black: [['black', 1]],
};
const pick = (list, x) => { for (const [name, p] of list) { if (x < p) return name; x -= p; } return list[list.length - 1][0]; };

export default {
  id: 'bear',
  name: 'Brown bear',
  latin: 'Ursus arctos',
  group: 'paws',
  plan: 'quadruped',
  covering: 'fur',
  variants: [
    { id: 'eurasian', name: 'Eurasian brown bear', latin: 'Ursus arctos arctos' },
    { id: 'grizzly', name: 'Grizzly bear', latin: 'Ursus arctos horribilis' },
    { id: 'coastal', name: 'Kodiak / coastal brown bear', latin: 'Ursus arctos middendorffi' },
    { id: 'black', name: 'American black bear', latin: 'Ursus americanus' },
  ],

  // Seeded individual. Males are much larger (1.2-2x the mass: x1.16 linear here), with broader
  // heads, thicker necks and a bigger hump; cubs (age 'juvenile', a yearling): x0.45 size, big domed
  // head with a short muzzle, large ears, short legs, fluffy uniform coat, Eurasian cubs often with a
  // pale neck collar. Individuals vary in size, leg and body length, head, muzzle, ears, hump, girth,
  // claw length, coat colour (morph per variant), sun-bleaching and coat length (summer / winter).
  variation(R, o) {
    const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
    const age = o.age || 'adult';
    const juv = age === 'juvenile' ? 1 : 0;
    const male = sex === 'male';
    const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
    let variant = o.variant;
    const xv = R();
    if (!variant) variant = pick(VARIANTS, xv);
    const coat = o.overrides?.coat || pick(COATS[variant] || COATS.eurasian, R());
    const black = variant === 'black' ? 1 : 0;
    const vSize = { eurasian: 1, grizzly: 1.02, coastal: 1.11, black: 0.84 }[variant] || 1;
    const size = (male ? 1.08 : 0.93) * vSize * (1 + 0.04 * g()) * (juv ? 0.45 : 1);
    const legs = 1 + 0.03 * g() - 0.08 * juv + 0.04 * black;
    const head = 1.1 * (male ? 1.03 : 0.98) * (1 + 0.025 * g());
    const hump = Math.max(0, ({ eurasian: 0.9, grizzly: 1.25, coastal: 1.05, black: 0 }[variant] ?? 1) * (male ? 1.12 : 0.92) * (1 + 0.15 * g()) * (juv ? 0.3 : 1));
    return {
      sex, age, size, variant, coat, juv,
      muzzle: (1 + 0.04 * g()) * (juv ? 0.66 : 1) * (black ? 1.04 : 1),
      headW: 1.1 * (male ? 1.07 : 0.96) * (1 + 0.025 * g()) * (juv ? 1.02 : 1) * (black ? 0.9 : 1),
      ear: (1 + 0.08 * g()) * (juv ? 1.3 : 1) * (black ? 1.3 : 1) * (variant === 'grizzly' ? 0.95 : 1),
      dish: clamp01(({ eurasian: 1, grizzly: 1.1, coastal: 0.9, black: 0.15 }[variant] ?? 1) + 0.12 * g()) * (juv ? 0.5 : 1),
      hump,
      girth: (male ? 1.04 : 0.98) * (1 + 0.035 * g()) * (juv ? 0.96 : 1) * (black ? 0.9 : 1),
      claw: ({ grizzly: 1.15, black: 0.65 }[variant] ?? 1) * (1 + 0.1 * g()) * (juv ? 0.7 : 1),
      tail: 1 + 0.1 * g(),
      shag: Math.max(0.65, (1 + 0.18 * g()) * (juv ? 0.9 : 1)),
      bleach: black ? 0 : Math.max(0, 0.35 + 0.5 * g()),
      collar: juv && variant === 'eurasian' && R() < 0.7 ? 0.6 + 0.4 * R() : 0,
      coatWarmth: 0.5 * g(),
      coatLightness: 0.1 * g(),
      coatSeed: Math.floor(R() * 1e6),
      minThick: 0.005,
      warps: [
        { type: 'legs', k: legs, top: 0.5 },
        { type: 'length', k: 1 + 0.03 * g() - 0.06 * juv, z0: -0.35, z1: 0.33 },
        { type: 'scaleAbout', c: HEAD_O, k: head * (juv ? 1.38 : 1), r0: 0.13, r1: 0.3 },
      ],
    };
  },
  rig: (params) => bearRig(params),
  sculpt: (m, rig, params) => sculptBear(m, rig, params),
  regions: bearRegions,
  coat: bearCoat,
  // the claws: curved horn tubes on the paw bones (claws.js)
  surfaces: bearClaws,
  eyeSpecs: (params) => [1, -1].map((side) => ({ side, spec: eyeOf(params), headOrigin: HEAD_O, bone: 'head', look: EYE_LOOK })),
  motion,
  render: {
    markColor: [0.01, 0.008, 0.007],
    strandDensity: 650,
    // big locks of guard hair (side3, front3, tq4: clumped locks with pale tips; at 0.85 the coat read as
    // a dense even pile, velvet; below ~0.6 the short face hair curls like a lamb's)
    // (0.75: between velvet, 0.85, and round scale-like tufts at medium, 0.62)
    clumpDensity: 0.75,
    // (the tufts start in hair over 3 mm and form fully at 22 mm: the 9 mm muzzle a little (0.18), the 12-14 mm
    // eye surround and bridge half (0.4-0.5), the 20 mm forehead and cheeks nearly fully. At [12, 45] mm the face
    // got none and its short hair rendered as a smooth pale felt, a suede mask; at [2, 12] the
    // forehead curled like lamb's wool, as the default [5.5, 16] did with the old 20-30 mm forehead)
    clumpLen: [0.003, 0.022],
    // no silhouette fins: on the 6-10 cm coat they draw contour lines inside the body wherever the hump,
    // back or rump outline crosses it (a pale harness round the hump from behind, a ring round the face),
    // even at finWidth 0.25; the shells alone give the shaggy outline
    fins: false,
    // (cast shadows on the shells looked up at the hair's root: the neck's long hair behind the jaw lies in the head's
    // shadow, and with each layer shadowed at its own height the shell stack showed there as torn dark sheets in look
    // turns)
    shellShadowRoot: 1,
  },
};

function clamp01(x) { return Math.max(0, Math.min(1.3, x)); }

// Round pupil, brown iris (#3a2516 in shade, amber-brown #6b4a2a in bright light: face2, front3, tq1 show
// a brown to amber ring round a clearly darker pupil, not a black bead), no visible sclera in normal
// gaze, black lid rims.
// (face1 / face2 show the eye at 0.12-0.65 of the brightness of the fur beside it, a brown iris round a darker pupil:
// a brighter iris rendered paler than that fur in full sun, a golden-beige eye; 60 % of its albedo was tried next,
// and at 45 % it read black in the studio)
// (now a dull, dark warm brown, ~30 % of that 60 % iris: the 60 % iris (hi R/B 5) lit up golden-amber in the
// showcase's sun (photos: the ring's hue 0-30 deg, saturation 0.06-0.35, 0.16-0.39 of the fur's
// luminance); a dark neutral iris turned the sky's blue-grey, so it stays warm (R/B ~3) to offset the sky light)
export const EYE_LOOK = {
  pupil: 'round',
  lids: 'mammal',
  iris: { inner: [0.02, 0.012, 0.007], mid: [0.032, 0.019, 0.011], hi: [0.05, 0.03, 0.016], outer: [0.012, 0.0075, 0.0045] },
  // (the sclera a bear shows round the iris is pigmented dark brown: the default-grey sclera, x0.6 when 'not visible',
  // albedo ~0.15, was paler than the iris and drew a pale grey ring whenever the eye turned in its aperture)
  sclera: { color: [0.06, 0.042, 0.03], visible: false },
  lidColor: [0.015, 0.012, 0.01],
  pupilSize: [0.26, 0.44],
  // (a faint clear coat: at the default 1 the sky's reflection on the cornea swamped the dark iris and the eyes read
  // pale blue-grey in the showcase; 0.15 keeps a small wet catchlight)
  cornea: 0.15,
  // (and the eyeball's environment sheen, which the showcase's bright sky laid over the dark iris as a blue-grey film;
  // probed in the page: indirect specular x0 gives a dark brown eye, x0.1 keeps a faint sheen)
  envSpecular: 0.1,
};
