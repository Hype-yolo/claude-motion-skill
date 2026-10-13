// Crow skeleton in bind pose (metres). Forward = +Z, up = +Y, the bird's left = +X; ground at y = 0,
// the feet under the centre of mass at z ~ 0. Proportions from the side reference photo (side1: tarsus
// 60 mm -> 1.3 mm/px; bill tip to tail tip 0.44 m, crown 0.33 m above the feet with the head up) and
// corvid osteometry (femur 47, tibiotarsus 84, tarsometatarsus 57 mm; humerus 67, ulna 78, hand 58 mm).
// Wings are bound half open (drooped out to the side) so the arm skin deforms evenly toward both the
// folded and the spread wing; the flight feathers are separate bones (see core/rig/bird.js).
import { buildRig } from '../../core/rig/rig.js';
import { birdBones, birdLimbs, neckChain, wingJoints, featherJoints } from '../../core/rig/bird.js';
import { WING, FEATHERS } from './motion.js';

export const NECK_SEGS = 4;
// the head sits low and close on the body (the neck's S is hidden in the feathers): HEAD_DROP moves
// the skull and bill down / back from the base layout (otherwise the neck reads thick and upright)
export const HEAD_DROP = [0, -0.005, -0.003];
const hd = (v) => [v[0] + HEAD_DROP[0], v[1] + HEAD_DROP[1], v[2] + HEAD_DROP[2]];
export const HEAD_O = hd([0, 0.3, 0.106]); // head-local origin: between the eyes

const n2 = (y, z) => { const l = Math.hypot(y, z); return [0, y / l, z / l]; };

export function crowJoints() {
  const J = {
    synsacrum: [0, 0.166, -0.034],
    tailBase: [0, 0.168, -0.074],
    tailTip: [0, 0.166, -0.097],
    neckBase: [0, 0.205, 0.046],
    occiput: hd([0, 0.281, 0.064]),
    bill: hd([0, 0.305, 0.187]),
    jawHinge: hd([0, 0.29, 0.1]),
    jawTip: hd([0, 0.296, 0.181]),
    shoulderL: [0.03, 0.213, 0.03],
    hipL: [0.026, 0.15, -0.03],
    kneeL: [0.033, 0.122, 0.008],
    ankleL: [0.03, 0.058, -0.044],
    mtpL: [0.024, 0.0062, -0.02],
  };
  // toes: III (middle) forward, II inner, IV outer, I (hallux) back; two segments each (phalanges +
  // claw in the distal one), lying on the ground
  const toe = (j, yawDeg, a, b, back = false) => {
    const y = (yawDeg * Math.PI) / 180, m = J.mtpL;
    const dir = back ? [Math.sin(y), 0, -Math.cos(y)] : [Math.sin(y), 0, Math.cos(y)];
    J[`t${j}mL`] = [m[0] + dir[0] * a, 0.0034, m[2] + dir[2] * a];
    J[`t${j}tL`] = [m[0] + dir[0] * (a + b), 0.0022, m[2] + dir[2] * (a + b)];
  };
  toe(3, 2, 0.02, 0.021);
  toe(2, -22, 0.014, 0.016);
  toe(4, 24, 0.015, 0.017);
  toe(1, -6, 0.014, 0.015, true);
  neckChain(J, NECK_SEGS, n2(0.45, 1), n2(1, -0.35), 0.42);
  wingJoints(J, WING);
  featherJoints(J, WING, FEATHERS, { bindFan: 0.2 });
  return J;
}

export function crowRig() {
  const J = crowJoints();
  const neck = Array.from({ length: NECK_SEGS - 1 }, (_, i) => 'neck' + (NECK_SEGS - 1 - i));
  const neckBones = Array.from({ length: NECK_SEGS }, (_, i) => 'neck' + (NECK_SEGS - 1 - i));
  return buildRig({
    joints: J,
    unit: 0.25,
    headOrigin: HEAD_O,
    bones: birdBones({ neckSegs: NECK_SEGS, jaw: true, primaries: FEATHERS.primaries.length, secondaries: FEATHERS.secondaries.length, rectrices: FEATHERS.rectrices.length }),
    axial: {
      points: ['bill', 'occiput', ...neck, 'neckBase', 'synsacrum', 'tailBase', 'tailTip'],
      bones: ['head', ...neckBones, 'chest', 'pelvis', 'tail'],
      // wide blends along the neck: a thick, feathered neck on few segments bends over its whole
      // length instead of creasing at the joints. The skull's influence runs well down the neck and
      // the neck base blends far into the breast (the breast feathers follow the neck), which keeps
      // skin distortion low in head-down / head-back poses (metrics: distort3)
      blend: Object.fromEntries([
        [1, [-0.5, 0.2]],
        ...Array.from({ length: NECK_SEGS - 1 }, (_, k) => [2 + k, [-0.1, 0.1]]),
        [1 + NECK_SEGS, [-0.45, 0.03]],
      ]),
    },
    limbs: birdLimbs({
      leg: { tCore: 0.95, aCore: 0.07, aBody: -0.05, midX: 0.012 },
      wing: { tCore: 0.3, aCore: 0.16, aBody: -0.16, midX: 0.02 },
    }),
    appendages: [],
    webTags: ['flankfold', 'scapular'],
  });
}
