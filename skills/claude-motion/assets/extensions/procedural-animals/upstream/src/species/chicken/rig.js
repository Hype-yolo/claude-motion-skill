// Chicken skeleton in bind pose (metres). Forward = +Z, up = +Y, the bird's left = +X; ground at y = 0,
// the feet under the centre of mass. Reference individual: a ~2 kg brown layer hen standing relaxed
// (hip height 0.21 m, back 0.27 m, crown 0.345 m, bill tip to tail tip 0.42 m). Leg bones from layer
// osteometry (Animals 2020: tibiotarsus 117-120 mm; femur ~0.65 and tarsometatarsus ~0.68 of it);
// wing bones humerus 77, ulna 70, hand 66 mm. The femur points forward and down inside the
// body (knee hidden in the feathers), the drumstick runs down and back to the hock at 85 mm, the
// scaled shank stands almost vertical.
//
// The rig adapts to the individual (params.form, see index.js): roosters stand more upright on longer
// legs with a longer neck and carry two sickle feathers a side; chicks have a round body, a big head
// on a short neck, short legs and stubby wings.
import { buildRig } from '../../core/rig/rig.js';
import { birdBones, birdLimbs, neckChain, wingJoints, featherJoints } from '../../core/rig/bird.js';
import { wingFor, feathersFor } from './motion.js';

export const NECK_SEGS = 4;
// head-local origin (between the eyes) of the reference hen
export const HEAD_O = [0, 0.328, 0.108];

const n2 = (y, z) => { const l = Math.hypot(y, z); return [0, y / l, z / l]; };
const D = Math.PI / 180;

// rotate a point about the x axis through c (pitch the torso up by a, radians)
const pitchAbout = (p, c, a) => {
  const y = p[1] - c[1], z = p[2] - c[2], ca = Math.cos(a), sa = Math.sin(a);
  return [p[0], c[1] + y * ca + z * sa, c[2] - y * sa + z * ca];
};

export function headOrigin(form = {}) {
  return form.headO || HEAD_O;
}

// torso transform of an individual: the reference torso lifted with the hip and pitched up about it
export function torsoFn(form = {}) {
  const hipY = 0.205 * (form.hipK ?? 1), up = (form.up ?? 0) * D, dyH = hipY - 0.205;
  const c = [0, hipY, -0.028];
  return (p) => pitchAbout([p[0], p[1] + dyH, p[2]], c, up);
}

export function chickenJoints(form = {}) {
  const legK = form.legK ?? 1, neckK = form.neckK ?? 1;
  const juv = !!form.chick;
  // ---- legs (left), from the hip down
  const femur = 0.078 * (form.femurK ?? legK), tib = 0.118 * legK, tar = 0.08 * (form.tarK ?? legK);
  const hip = [0.03, 0.205 * (form.hipK ?? 1), -0.028];
  const fa = 32 * D;
  const knee = [0.042, hip[1] - femur * Math.sin(fa), hip[2] + femur * Math.cos(fa)];
  const lean = 16 * D;
  const mtpY = 0.009;
  const ankleY = mtpY + tar * Math.cos(lean);
  const dy = knee[1] - ankleY, dz = Math.sqrt(Math.max(1e-6, tib * tib - dy * dy));
  const ankle = [0.034, ankleY, knee[2] - dz];
  const mtp = [0.03, mtpY, ankle[2] + tar * Math.sin(lean)];
  // ---- torso and head (reference hen), pitched up about the hip for an upright carriage
  const T = torsoFn(form);
  const J = {
    synsacrum: T([0, 0.218, -0.04]),
    tailBase: T([0, 0.244, -0.128]),
    tailTip: T([0, 0.262, -0.156]),
    neckBase: T([0, 0.25, 0.07]),
    shoulderL: T([0.057, 0.232, 0.052]),
    hipL: hip, kneeL: knee, ankleL: ankle, mtpL: mtp,
  };
  if (form.tailUp) {
    // roosters carry the tail higher: pitch the pygostyle up about its base
    const a = form.tailUp * D, b = J.tailBase, t = J.tailTip;
    J.tailTip = pitchAbout(t, b, -a);
  }
  if (juv) {
    // chick: round body, the tail stub barely out of the down, neck base forward
    J.synsacrum = [0, hip[1] + 0.012, -0.03];
    J.tailBase = [0, hip[1] + 0.02, -0.075];
    J.tailTip = [0, hip[1] + 0.03, -0.088];
    J.neckBase = [0, hip[1] + 0.05, 0.045];
    // (the shoulder near the ball's surface: the folded wing lies on the ball, not inside it)
    J.shoulderL = [0.068, hip[1] + 0.045, 0.03];
  }
  // head: the reference head, carried by the neck (longer neck -> higher head)
  const HO = headOrigin(form);
  const hk = form.headK ?? 1;
  const occ0 = [0, HO[1] - 0.01 * hk, HO[2] - 0.02 * hk];
  // neck: from the neck base to the occiput; its length scales with neckK (and the torso pitch)
  const nb = J.neckBase;
  const occ = juv ? [0, nb[1] + 0.042, nb[2] + 0.012] : [0, nb[1] + (occ0[1] - 0.25) * neckK, nb[2] + (occ0[2] - 0.07) * neckK];
  const ho = [0, occ[1] + 0.01 * hk, occ[2] + 0.02 * hk];
  J.occiput = occ;
  const bk = form.billK ?? 1;
  J.bill = [0, ho[1] - 0.007 * hk * bk, ho[2] + (0.017 + 0.027 * bk) * hk];
  J.jawHinge = [0, ho[1] - 0.012 * hk, ho[2] - 0.007 * hk];
  J.jawTip = [0, ho[1] - 0.012 * hk, ho[2] + (0.017 + 0.023 * bk) * hk];
  J._headO = ho;
  // toes: III (middle) forward, II inner, IV outer, I (hallux) back; two segments each, on the ground
  const toe = (j, yawDeg, a, b, back = false) => {
    const y = (yawDeg * Math.PI) / 180, m = J.mtpL;
    const dir = back ? [Math.sin(y), 0, -Math.cos(y)] : [Math.sin(y), 0, Math.cos(y)];
    J[`t${j}mL`] = [m[0] + dir[0] * a, 0.005, m[2] + dir[2] * a];
    J[`t${j}tL`] = [m[0] + dir[0] * (a + b), 0.0035, m[2] + dir[2] * (a + b)];
  };
  const tk = form.toeK ?? 1;
  toe(3, 3, 0.032 * tk, 0.027 * tk);
  toe(2, -24, 0.024 * tk, 0.021 * tk);
  toe(4, 27, 0.026 * tk, 0.022 * tk);
  toe(1, -10, 0.013 * tk, 0.013 * tk, true);
  const t0 = juv ? n2(1, 0.5) : n2(1, 0.62), t1 = juv ? n2(1, 0.2) : n2(1, 0.05);
  neckChain(J, NECK_SEGS, t0, t1, 0.42);
  const wing = wingFor(form), feathers = feathersFor(form);
  wingJoints(J, wing);
  featherJoints(J, wing, feathers, { bindFan: 0.2 });
  return J;
}

export function chickenRig(form = {}) {
  const J = chickenJoints(form);
  const HO = J._headO;
  delete J._headO;
  const F = feathersFor(form);
  const neck = Array.from({ length: NECK_SEGS - 1 }, (_, i) => 'neck' + (NECK_SEGS - 1 - i));
  const neckBones = Array.from({ length: NECK_SEGS }, (_, i) => 'neck' + (NECK_SEGS - 1 - i));
  const rig = buildRig({
    joints: J,
    unit: 0.34,
    headOrigin: HO,
    bones: birdBones({ neckSegs: NECK_SEGS, jaw: true, primaries: F.primaries.length, secondaries: F.secondaries.length, rectrices: F.rectrices.length }),
    axial: {
      points: ['bill', 'occiput', ...neck, 'neckBase', 'synsacrum', 'tailBase', 'tailTip'],
      bones: ['head', ...neckBones, 'chest', 'pelvis', 'tail'],
      // wide blends along the (thick, hackled) neck: the skull's influence runs down the neck and the
      // neck base blends far into the breast, so head-down / head-up poses bend the whole neck
      blend: Object.fromEntries([
        [1, [-0.22, 0.1]],
        ...Array.from({ length: NECK_SEGS - 1 }, (_, k) => [2 + k, [-0.035, 0.035]]),
        [1 + NECK_SEGS, [-0.5, 0.035]],
      ]),
    },
    limbs: birdLimbs({
      leg: { tCore: 0.95, aCore: 0.04, aBody: -0.045, midX: 0.014 },
      wing: { tCore: 0.3, aCore: 0.06, aBody: form.chick ? -0.16 : -0.05, midX: 0.02 },
    }),
    appendages: [],
    webTags: ['flankfold', 'scapular'],
  });
  rig.headO = HO;
  return rig;
}
