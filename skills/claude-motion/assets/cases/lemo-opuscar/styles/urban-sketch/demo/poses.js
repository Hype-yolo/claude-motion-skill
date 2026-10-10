// 角色造型 + 姿势库（身体坐标，单位 = 身高；yaw 0 = 背对镜头）
import { hex, lerp, clamp, ss, R3 } from './engine.js';
const { V } = R3;

export const LOOK = {
  her: { skin: hex('#eec3a4'), top: hex('#eeebe2'), hair: hex('#8a5a3c'), dress: 1, sleeve: 'none', hairLong: 1, torso: [.082, .066, .09], flare: .17, shoe: hex('#b98a60') },
  him: { skin: hex('#d9a383'), top: hex('#7187a6'), bottom: hex('#c8b48e'), hair: hex('#2f2622'), curly: 1, hairVol: 1.1, torso: [.078, .086, .108], shoe: hex('#e8e4da') },
  cyclA: { skin: hex('#e2b394'), top: hex('#f1efe8'), bottom: hex('#2f3440'), hair: hex('#4a3a30'), shoe: hex('#333') },
  cyclB: { skin: hex('#b07a5c'), top: hex('#c9796a'), bottom: hex('#5a6173'), hair: hex('#231c1a') },
  jog: { skin: hex('#c89274'), top: hex('#8fb3a0'), bottom: hex('#3b3f4a'), hair: hex('#2e2622') },
  walkA: { skin: hex('#e8c0a0'), top: hex('#b58fb0'), bottom: hex('#d8cbb0'), hair: hex('#c49a5c'), hairLong: 1 },
  walkB: { skin: hex('#9c6a50'), top: hex('#e2c46a'), bottom: hex('#6a6a70'), hair: hex('#231c1a'), curly: 1 },
  picA: { skin: hex('#e5b898'), top: hex('#d97f6a'), bottom: hex('#c9b99a'), hair: hex('#6a4a34'), hairLong: 1 },
  picB: { skin: hex('#c48a6a'), top: hex('#8ea6c4'), bottom: hex('#7d7466'), hair: hex('#2e2622') },
  picC: { skin: hex('#f0cdb0'), top: hex('#e9d27a'), bottom: hex('#8a9ab0'), hair: hex('#b8864e'), hairLong: 1 },
  rower: { skin: hex('#d9a383'), top: hex('#e8e2d4'), bottom: hex('#7a8aa0'), hair: hex('#4a3a30') },
};

// 坐在地上（背影）：腿向前，手撑在身后两侧
export function sit(o = {}) {
  return {
    hipY: .085, hipZ: 0, lean: o.lean ?? -.08, side: o.side ?? 0, twist: o.twist ?? 0, headYaw: o.headYaw ?? 0, nod: o.nod ?? 0, headSide: o.headSide ?? 0,
    footL: o.footL ?? V(-.13, .025, .4), footR: o.footR ?? V(.1, .025, .44),
    handL: o.handL ?? V(-.07, .2, .26), handR: o.handR ?? V(.08, .2, .28), elbL: o.elbL ?? V(-1, -.3, 0), elbR: o.elbR ?? V(1, -.3, 0), hairBlow: o.hairBlow ?? 0,
  };
}
// 跑：φ 相位（弧度），k 强度 0..1（起跑/收步）
export function run(ph, k = 1, o = {}) {
  const s = Math.sin(ph), c = Math.cos(ph), s2 = Math.sin(ph + Math.PI), c2 = Math.cos(ph + Math.PI);
  const knee = cc => .25 + 1.35 * Math.pow(Math.max(0, cc), 1.2);
  return {
    hipY: .5 - .025 * k + .03 * k * Math.abs(Math.sin(ph)), lean: (.28 + (o.lean ?? 0)) * k,
    legL: .75 * s * k, kneeL: lerp(0, knee(c), k), legR: .75 * s2 * k, kneeR: lerp(0, knee(c2), k),
    armL: -.85 * s * k, bendL: lerp(.2, 1.45, k), armR: -.85 * s2 * k, bendR: lerp(.2, 1.45, k), abdL: .12, abdR: .12,
    headYaw: o.headYaw ?? 0, nod: -.15 * k + (o.nod ?? 0), twist: .12 * s * k,
  };
}
export function walk(ph, o = {}) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return {
    hipY: .515 + .01 * Math.abs(c), lean: .04, legL: .38 * s, kneeL: .1 + .45 * Math.max(0, c), legR: -.38 * s, kneeR: .1 + .45 * Math.max(0, -c),
    armL: -.32 * s, bendL: .25, armR: .32 * s, bendR: .25, headYaw: o.headYaw ?? 0, nod: o.nod ?? 0, twist: .06 * s,
  };
}
export function stand(o = {}) { return { hipY: .52, lean: o.lean ?? 0, armL: .05, armR: -.05, bendL: .2, bendR: .2, headYaw: o.headYaw ?? 0, nod: o.nod ?? 0, ...o }; }
// 骑车：踏板相位
export function cycle(ph) {
  const r = .085, pedal = s => V(0, .2 + Math.sin(ph + s) * r, .05 + Math.cos(ph + s) * r);
  return { hipY: .6, hipZ: -.02, lean: .55, footL: pedal(0), footR: pedal(Math.PI), handL: V(-.12, .74, .34), handR: V(.12, .74, .34), elbL: V(-.5, -.5, -1), elbR: V(.5, -.5, -1), nod: -.35 };
}
// 扑：p 0..1（腾空 → 伸直 → 落地）
export function dive(p, catchHand) {
  const e = ss(p);
  return { hipY: lerp(.5, .16, e), hipZ: 0, lean: lerp(.4, 1.35, e), legL: lerp(.3, -.55, e), kneeL: lerp(.9, .3, e), legR: lerp(-.4, -.75, e), kneeR: lerp(.4, .5, e),
    handR: catchHand ?? V(.08, lerp(.95, .2, e), lerp(.3, .78, e)), handL: V(-.12, lerp(.9, .22, e), lerp(.25, .7, e)), elbL: V(-1, 0, 0), elbR: V(1, 0, 0), nod: -.2 };
}
// 趴着（接住后）
export function prone(p = 0) { return { hipY: .09, lean: 1.45, legL: -.2, kneeL: .5 + p * .3, legR: -.3, kneeR: .9, handR: V(.1, .1, .78), handL: V(-.15, .06, .6), elbL: V(-1, -1, 0), elbR: V(1, -1, 0), nod: -.9 + p * .3 }; }
// 挥手 / 举帽
export function wave(ph, o = {}) { const a = Math.sin(ph) * .12; return { ...stand(o), handR: V(.16 + a, 1.12, .02), elbR: V(1, 0, 0), handL: o.handL, elbL: V(-1, 0, 0) }; }
export const mixPose = (a, b, t) => { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[k], y = b[k]; if (x === undefined) o[k] = y; else if (y === undefined) o[k] = x; else if (Array.isArray(x)) o[k] = x.map((v, i) => lerp(v, y[i], t)); else o[k] = lerp(x, y, t); } return o; };
