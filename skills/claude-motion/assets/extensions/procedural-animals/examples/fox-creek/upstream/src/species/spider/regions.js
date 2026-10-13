// Meshing plan. A spider is mostly thin legs spread over a wide box, so one dense grid would be
// wasteful: the body (prosoma, abdomen, palps, coxae, trochanters) is one region, every leg its
// own region from the middle of the trochanter outward, and the chelicerae and fangs are rigid
// regions of their own (they move on their own bones). Legs and body overlap across a cut plane
// through the trochanter and cross-fade there (both surfaces see the same primitives near the cut).
import { spiderDims } from './rig.js';
import { legJoints, LEG_KEYS } from '../../core/rig/spider.js';
import { lerp, norm, sub, smoothstep } from '../../core/math/vec.js';

// cut planes through the trochanters (reference space)
export function legCuts(J, d) {
  const F = d.unit / 0.013;
  return LEG_KEYS.map((key) => {
    const S = key[0], i = +key[1];
    const lj = legJoints(i, S);
    const t = J[lj[1]], f = J[lj[2]];
    return { key, p: lerp(t, f, 0.5), n: norm(sub(f, t)), e: J[lj[3]], r: d.legR[2][0] * 0.001 * 2.2 * (i === 4 ? d.hindR : 1) };
  });
}

function box(points, pad) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const p of points) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k] - pad); mx[k] = Math.max(mx[k], p[k] + pad); }
  return [mn, mx];
}

export function spiderRegions(rig, params, Q) {
  const J = rig.J, d = spiderDims(params);
  // the tarantula is stockier (thicker legs, bigger abdomen for its unit): slightly coarser cells
  const F = (d.unit / 0.013) * (d.variant === 'tarantula' ? 1.12 : 1), r = Q.res;
  const hB = 0.156e-3 * F * r, hL = 0.148e-3 * F * r, hC = 0.115e-3 * F * r;
  const B = 2.2 * Math.max(hB, hL);
  const cuts = legCuts(J, d);
  // s: signed distance along the cut normal; near: within reach of the leg (distance to the segment
  // from the cut centre to the knee)
  for (const c of cuts) { c.ab = sub(c.e, c.p); c.ab2 = c.ab[0] ** 2 + c.ab[1] ** 2 + c.ab[2] ** 2; }
  const inCut = (c, x, y, z) => {
    const dx = x - c.p[0], dy = y - c.p[1], dz = z - c.p[2];
    const s = dx * c.n[0] + dy * c.n[1] + dz * c.n[2];
    const t = Math.max(0, Math.min(1, (dx * c.ab[0] + dy * c.ab[1] + dz * c.ab[2]) / c.ab2));
    const ex = dx - c.ab[0] * t, ey = dy - c.ab[1] * t, ez = dz - c.ab[2] * t;
    return { s, near: ex * ex + ey * ey + ez * ez < c.r * c.r };
  };
  const bodyClip = (x, y, z) => {
    for (const c of cuts) { const q = inCut(c, x, y, z); if (q.near && q.s > B) return false; }
    return true;
  };
  const maxR = Math.max(...d.legR.map((q) => q[0])) * 0.001 * d.hindR;
  const minPad = 0.4e-3 * F;
  // body box: axial joints, palps, coxae, trochanters, the start of the femora
  const bodyPts = [];
  for (const k of Object.keys(J)) if (!/^(femur|patella|tibia|meta|tarsus|claw)/.test(k)) bodyPts.push(J[k]);
  for (const c of cuts) bodyPts.push(c.p);
  const abd = d.abdomen.r.map((x) => x * 0.001);
  const [bmin, bmax] = box(bodyPts, Math.max(abd[0], abd[1]) + minPad);
  bmin[1] = Math.max(bmin[1], -0.2e-3 * F);
  const regions = [{ name: 'body', part: 'body', bmin, bmax, h: hB, F: 5, clip: bodyClip }];
  const rigid = [];
  for (const S of ['L', 'R']) {
    const [cmin, cmax] = box([J['cheBase' + S], J['cheTip' + S]], d.chel.r[0] * 0.0013 + minPad);
    rigid.push({ name: 'chel' + S, part: 'chel' + S, bmin: cmin, bmax: cmax, h: hC, F: 5, rigidBone: 'chelicera' + S });
    const [fmin, fmax] = box([J['cheTip' + S], J['fangTip' + S]], d.chel.fangR * 0.0015 + minPad * 0.5);
    rigid.push({ name: 'fang' + S, part: 'fang' + S, bmin: fmin, bmax: fmax, h: hC * 0.8, F: 5, rigidBone: 'fang' + S });
  }
  const legs = { L: [], R: [] };
  for (const c of cuts) {
    const S = c.key[0], i = +c.key[1];
    const lj = legJoints(i, S).slice(1).map((n) => J[n]);
    const [lmin, lmax] = box(lj, maxR * 1.3 + minPad);
    legs[S].push({ name: 'leg' + c.key, part: 'leg' + c.key, bmin: lmin, bmax: lmax, h: hL, F: 5, clip: (x, y, z) => inCut(c, x, y, z).s > -B });
  }
  return {
    jobs: [[...regions, ...rigid], legs.L, legs.R],
    fade(x, y, z, name) {
      if (name === 'body') {
        let f = 1;
        for (const c of cuts) { const q = inCut(c, x, y, z); if (q.near) f *= 1 - smoothstep(-B, B, q.s); }
        return f;
      }
      if (name.startsWith('leg')) {
        const c = cuts.find((q) => 'leg' + q.key === name);
        return smoothstep(-B, B, inCut(c, x, y, z).s);
      }
      return 1;
    },
  };
}
