// Eagle skeleton in bind pose (metres). Forward = +Z, up = +Y, the bird's left = +X; ground at y = 0,
// the feet under the centre of mass at z ~ 0. Reference individual: adult bald eagle, ~4.7 kg,
// crown ~0.66 m above the feet when standing upright (body axis 48 deg above horizontal, side1 /
// golden_side1 photos: 45-55 deg), bill tip to tail tip 0.86 m. Bones from raptor osteometry scaled to a 95 mm
// tarsometatarsus: femur 100, tibiotarsus 160, tarsometatarsus 95 mm; humerus 190, ulna 220,
// hand 150 mm; long thick toes with huge talons (hallux and inner toe the largest).
// Wings are bound half open (drooped out to the side) so the arm skin deforms evenly toward both the
// folded and the spread wing; the flight feathers are separate bones (see core/rig/bird.js).
import { buildRig } from '../../core/rig/rig.js';
import { birdBones, birdLimbs, neckChain, wingJoints, featherJoints } from '../../core/rig/bird.js';
import { WING, FEATHERS } from './motion.js';

export const NECK_SEGS = 4;
export const TILT = 48; // standing body axis above horizontal (deg)
export const HEAD_O = [0, 0.595, 0.205]; // head-local origin: between the eyes

const n2 = (y, z) => { const l = Math.hypot(y, z); return [0, y / l, z / l]; };
// body-axis frame: a along the axis (forward-up), b dorsal
const ct = Math.cos((TILT * Math.PI) / 180), st = Math.sin((TILT * Math.PI) / 180);
export const SYN = [0, 0.285, -0.03];
export const AX = (a, b, x = 0) => [x, SYN[1] + a * st + b * ct, SYN[2] + a * ct - b * st];
export const U_AX = [0, st, ct];
export const V_AX = [0, ct, -st];

// leg bones (m): femur, tibiotarsus (the tarsometatarsus is ankle -> MTP)
const FEMUR = 0.098, TIBIA = 0.1595;
// knee of a hip -> knee -> ankle chain with the given lengths, bent toward `pole`
function kneeOf(hip, ankle, l1, l2, pole) {
  const d = [ankle[0] - hip[0], ankle[1] - hip[1], ankle[2] - hip[2]], L = Math.hypot(...d);
  const e1 = d.map((v) => v / L), pd = pole[0] * e1[0] + pole[1] * e1[1] + pole[2] * e1[2];
  let e2 = pole.map((v, i) => v - pd * e1[i]);
  const l = Math.hypot(...e2);
  e2 = e2.map((v) => v / l);
  const c = (l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), sn = Math.sqrt(Math.max(0, 1 - c * c));
  return hip.map((h, i) => h + e1[i] * l1 * c + e2[i] * l1 * sn);
}

export function eagleJoints() {
  const hl = (x, y, z) => [HEAD_O[0] + x, HEAD_O[1] + y, HEAD_O[2] + z];
  const J = {
    synsacrum: SYN,
    tailBase: AX(-0.06, 0.05),
    tailTip: null,
    neckBase: AX(0.19, -0.03),
    occiput: hl(0, -0.026, -0.058),
    bill: hl(0, -0.046, 0.109),
    jawHinge: hl(0, -0.027, -0.002),
    jawTip: hl(0, -0.04, 0.094),
    // the shoulder at the front of the thorax, level with the neck's root (flight photos: the wing's
    // leading edge meets the body right behind the white hood)
    shoulderL: AX(0.2, 0.045, 0.056),
    // the hip (acetabulum) high in the body, ~6 cm under the back; the knee hidden in the flank
    // feathers (solved below from the femur and tibiotarsus lengths)
    hipL: AX(0, 0.015, 0.055),
    ankleL: [0.064, 0.108, -0.03],
    mtpL: [0.05, 0.016, 0.0],
  };
  // the tail points 38 deg below the horizontal standing (10 deg above the body axis; in flight it
  // droops below the body axis, see motion tail.flight)
  J.tailTip = [0, J.tailBase[1] - 0.042 * Math.sin(38 * Math.PI / 180), J.tailBase[2] - 0.042 * Math.cos(38 * Math.PI / 180)];
  J.kneeL = kneeOf(J.hipL, J.ankleL, FEMUR, TIBIA, [0, 0, 1]);
  // toes: III (middle) forward, II inner, IV outer, I (hallux) back; two segments each (phalanges +
  // talon in the distal one), lying on the ground
  const toe = (j, yawDeg, a, b, back = false) => {
    const y = (yawDeg * Math.PI) / 180, m = J.mtpL;
    const dir = back ? [Math.sin(y), 0, -Math.cos(y)] : [Math.sin(y), 0, Math.cos(y)];
    J[`t${j}mL`] = [m[0] + dir[0] * a, 0.011, m[2] + dir[2] * a];
    J[`t${j}tL`] = [m[0] + dir[0] * (a + b), 0.0085, m[2] + dir[2] * (a + b)];
  };
  toe(3, 3, 0.046, 0.05);
  toe(2, -24, 0.036, 0.048);
  toe(4, 28, 0.037, 0.04);
  toe(1, -8, 0.03, 0.05, true);
  neckChain(J, NECK_SEGS, n2(1, 0.15), n2(1, 0.7), 0.35);
  wingJoints(J, WING);
  featherJoints(J, WING, FEATHERS, { bindFan: 0.2 });
  return J;
}

export function eagleRig() {
  const J = eagleJoints();
  const neck = Array.from({ length: NECK_SEGS - 1 }, (_, i) => 'neck' + (NECK_SEGS - 1 - i));
  const neckBones = Array.from({ length: NECK_SEGS }, (_, i) => 'neck' + (NECK_SEGS - 1 - i));
  return buildRig({
    joints: J,
    unit: 0.5,
    headOrigin: HEAD_O,
    bones: birdBones({ neckSegs: NECK_SEGS, jaw: true, primaries: FEATHERS.primaries.length, secondaries: FEATHERS.secondaries.length, rectrices: FEATHERS.rectrices.length }),
    axial: {
      points: ['bill', 'occiput', ...neck, 'neckBase', 'synsacrum', 'tailBase', 'tailTip'],
      bones: ['head', ...neckBones, 'chest', 'pelvis', 'tail'],
      // wide blends along the thick feathered neck (see the crow): the skull's influence runs down the
      // neck and the neck base blends into the breast
      blend: Object.fromEntries([
        [1, [-0.2, 0.1]],
        ...Array.from({ length: NECK_SEGS - 1 }, (_, k) => [2 + k, [-0.03, 0.03]]),
        [1 + NECK_SEGS, [-0.45, 0.03]],
      ]),
    },
    limbs: birdLimbs({
      leg: { tCore: 0.95, aCore: 0.07, aBody: -0.05, midX: 0.012 },
      wing: { tCore: 0.4, aCore: 0.16, aBody: -0.24, midX: 0.02 },
    }),
    appendages: [],
    webTags: ['flankfold', 'scapular'],
  });
}
