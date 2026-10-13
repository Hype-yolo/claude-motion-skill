// Snake coat: overlapping dorsal scales (keeled on the rattlesnake), wide ventral scutes, head plates;
// corn snake saddles with dark borders, lateral blotches and the checkerboard belly; rattlesnake
// diamonds with pale edges, flank blotches, face stripes and the black-and-white "coon tail".
// Everything is laid out in body coordinates: arc length sigma along the spine from the occiput and
// the arc u around the body from the dorsal midline, so the pattern wraps the tube like the real one.
import { SPINE } from './rig.js';
import { eyeSpec } from './sculpt.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { srgb, mix3, MAT, distPolyline } from '../../core/build/coatKit.js';
import { clamp, smoothstep, mix, fbm3, rng } from '../../core/math/vec.js';

// Colour sets (sRGB hex sampled from reference photos in neutral light).
export const MORPHS = {
  normal: { ground: 0xc9763f, flank: 0xd99a5c, saddle: 0xa8321f, lateral: 0x983a26, border: 0x1b1310, belly: 0xe9e2d2, check: 0x171412, mark: [0.012, 0.009, 0.008] },
  okeetee: { ground: 0xd6843f, flank: 0xe0a45e, saddle: 0xb52f1c, lateral: 0xa23421, border: 0x100b09, belly: 0xece4d2, check: 0x141110, mark: [0.006, 0.004, 0.004], borderW: 2.6 },
  wild: { ground: 0xa68a6c, flank: 0xb89c7c, saddle: 0x8a3a24, lateral: 0x7c3a28, border: 0x1d1512, belly: 0xe4ddcc, check: 0x1a1715, mark: [0.013, 0.01, 0.009] },
  amel: { ground: 0xeb9656, flank: 0xf0b070, saddle: 0xd9482a, lateral: 0xd65a36, border: 0xf2ece0, belly: 0xf3eee4, check: 0xe8a070, mark: [0.86, 0.82, 0.74], borderW: 1.2 },
  anery: { ground: 0xa9a6a2, flank: 0xbdbab4, saddle: 0x4a4847, lateral: 0x55524f, border: 0x151414, belly: 0xe6e4e0, check: 0x161515, mark: [0.01, 0.01, 0.01] },
  juvenile: { ground: 0x9c8672, flank: 0xae9a86, saddle: 0x6e2a1c, lateral: 0x5e2a20, border: 0x140e0c, belly: 0xe6e0d2, check: 0x151211, mark: [0.008, 0.006, 0.006] },
};
export const DIAMONDBACK = {
  ground: 0x8a7560, flank: 0x9a846a, diamond: 0x56422f, centre: 0x76604a, edge: 0xcdbd9c, blotch: 0x5e4a38,
  belly: 0xe2d6bc, ringW: 0xe6e0d4, ringB: 0x1a1715, rattle: 0xbfae8c, mark: [0.69, 0.6, 0.45],
};

export function markColorOf(params) {
  if (params.variant === 'rattlesnake') return DIAMONDBACK.mark;
  return (MORPHS[params.coat?.morph] || MORPHS.normal).mark;
}

export function snakeCoat(ctx) {
  const { rig, params, pos, nrm, nV, regionOf, regionNames, weights } = ctx;
  const J = rig.J, B = rig.plan, viper = params.variant === 'rattlesnake';
  const cp = params.coat || {};
  const R = rng(9173 + (cp.seed || 0));
  const AXL = weights.axialLengths;
  const s0 = AXL[1]; // arc of v0 from the nose
  const total = AXL[AXL.length - 1] - s0;
  const sVent = total * (1 - B.tailFrac);
  const hL = B.headLen, W = B.P.headW * B.kH, H = B.P.headH * B.kH;
  const yB = -J.v0[1];
  // axis samples: y and half width at arc sigma
  const axY = (sg) => {
    let i = 1;
    while (i < AXL.length - 2 && sg + s0 > AXL[i + 1]) i++;
    const t = clamp((sg + s0 - AXL[i]) / (AXL[i + 1] - AXL[i]), 0, 1);
    const a = J['v' + (i - 1)], b = J['v' + i];
    return a[1] + (b[1] - a[1]) * t;
  };
  const hwAt = (sg) => B.hw(clamp(sg / total, 0, 1));

  // ---- colours
  const juv = params.age === 'juvenile';
  const morph = viper ? null : juv && (cp.morph === 'normal' || cp.morph === 'wild') ? MORPHS.juvenile : MORPHS[cp.morph] || MORPHS.normal;
  const warm = cp.warm || 0, light = cp.light || 0;
  const tweak = (hex) => { const c = srgb(hex); return [c[0] * (1 + 0.1 * warm + light), c[1] * (1 + 0.02 * warm + light), c[2] * (1 - 0.1 * warm + light)]; };
  const C0 = viper
    ? Object.fromEntries(Object.entries(DIAMONDBACK).filter(([k]) => k !== 'mark').map(([k, v]) => [k, tweak(v)]))
    : Object.fromEntries(Object.entries(morph).filter(([k]) => typeof morph[k] === 'number' && k !== 'borderW').map(([k, v]) => [k, tweak(v)]));
  // individuals range from bright orange to duller, browner / greyer grounds
  const C = C0;
  if (!viper && (cp.morph === 'normal' || cp.morph === 'okeetee')) {
    const d = clamp(cp.dull || 0, 0, 0.7);
    C.ground = mix3(C.ground, srgb(MORPHS.wild.ground), d); C.flank = mix3(C.flank, srgb(MORPHS.wild.flank), d);
    C.saddle = mix3(C.saddle, srgb(0x8e2c1c), d * 0.6);
  }
  if (viper) {
    // wild C. atrox range from pale grey through grey-brown to reddish-brown, with bolder or fainter
    // diamonds (seeded tone: < 0 greyer, > 0 redder; light: paler / darker)
    const tone = clamp(cp.tone || 0, -1, 1), lt = cp.light || 0;
    const tgt = tone < 0 ? srgb(0x8f8c86) : srgb(0x9a6a4e);
    const k = Math.abs(tone) * 0.75;
    for (const key of ['ground', 'flank', 'centre']) C[key] = mix3(C[key], [tgt[0] * (key === 'flank' ? 1.08 : 1), tgt[1] * (key === 'flank' ? 1.08 : 1), tgt[2] * (key === 'flank' ? 1.08 : 1)], k);
    C.diamond = mix3(C.diamond, tone < 0 ? srgb(0x4a4744) : srgb(0x5a3526), k * 0.7);
    for (const key of ['ground', 'flank', 'centre', 'edge']) C[key] = C[key].map((c) => c * (1 + 1.6 * lt));
    C.diamond = mix3(C.diamond, C.ground, clamp(0.3 - 0.3 * ((cp.blotch || 1) - 1) / 0.18, 0, 0.55));
  }
  const bk = cp.blotch || 1;

  // ---- pattern features (body coordinates)
  const sStart = viper ? 0.045 * total : Math.max(0, 1.5 * hL - (0.5 * (total * (1 - B.tailFrac) - 1.5 * hL)) / 36);
  const feats = []; // { s, a, b, u (centre across), kind, col }
  if (viper) {
    const n = Math.round((cp.count || 1) * 29);
    const sp = (sVent - sStart) / n;
    for (let k = 0; k < n; k++) {
      const s = sStart + (k + 0.5) * sp + (R() - 0.5) * 0.08 * sp;
      feats.push({ s, a: 0.56 * sp, b: 0.9, u: 0, kind: 'diamond' });
      // flank blotches below the lateral corners of the diamonds
      for (const side of [1, -1]) feats.push({ s: s + 0.5 * sp + (R() - 0.5) * 0.1 * sp, a: 0.2 * sp, b: 0.28, u: side * 1.55, kind: 'blotch' });
    }
  } else {
    const n = Math.round((cp.count || 1) * 36);
    const sp = (sVent - sStart) / n;
    for (let k = 0; k < n; k++) {
      const s = sStart + (k + 0.5) * sp + (R() - 0.5) * 0.14 * sp;
      feats.push({ s, a: (0.25 + 0.06 * R()) * sp * bk, b: (1.0 + 0.14 * R()) * bk, u: (R() - 0.5) * 0.12, kind: 'saddle' });
      for (const side of [1, -1]) if (R() < 0.85) feats.push({ s: s + 0.5 * sp + (R() - 0.5) * 0.2 * sp, a: (0.15 + 0.05 * R()) * sp * bk, b: 0.3 + 0.08 * R(), u: side * (1.72 + 0.1 * R()), kind: 'lateral' });
    }
    // tail: saddles continue, closer
    const nt = Math.round(11 * (cp.count || 1));
    const spt = (total * 0.985 - sVent) / nt;
    for (let k = 0; k < nt; k++) feats.push({ s: sVent + (k + 0.5) * spt, a: 0.27 * spt * bk, b: 1.2, u: 0, kind: 'saddle' });
  }
  feats.sort((p, q) => p.s - q.s);
  // belly checks (corn): blocks on alternating sides, scute by scute
  const checks = [];
  const scute = viper ? total / 182 : total / 215;
  if (!viper) {
    for (let s = 0.09 * total; s < sVent; s += scute) {
      if (R() < 0.5) checks.push({ s: s + scute * (0.4 + 0.2 * R()), a: scute * (0.45 + 0.5 * R()), side: R() < 0.5 ? 1 : -1, w: 0.3 + 0.25 * R() });
    }
  }

  // head and neck features, as 2-D polylines in a projection of the (straight) bind pose:
  // top view (x, z) for the crown and nape, side view (z, y) for the flanks of the head
  const E = eyeSpec(params);
  const eyeC = eyeFrameOf(E, J.v0, 1).c; // left eye centre (x > 0)
  const z0 = J.v0[2];
  const ez = eyeC[2] - z0, ey = eyeC[1]; // eye position along the head, height (world)
  const seg2 = (px, py, P, Wd) => {
    let best = 1e9;
    for (let i = 0; i < P.length - 1; i++) {
      const ax = P[i][0], ay = P[i][1], bx = P[i + 1][0] - ax, by = P[i + 1][1] - ay;
      const t = clamp(((px - ax) * bx + (py - ay) * by) / (bx * bx + by * by || 1e-12), 0, 1);
      const d = Math.hypot(px - ax - bx * t, py - ay - by * t) - (Wd[i] + (Wd[i + 1] - Wd[i]) * t);
      if (d < best) best = d;
    }
    return best;
  };
  const kH = B.kH;
  // corn: spear point (two blotches meeting in a point between the eyes, running back onto the neck),
  // the interocular bar, and the post-ocular stripe through the eye to the jaw angle
  const spearL = [[0.0, z0 + ez + 0.003 * kH], [0.06 * W, z0 + 0.4 * hL], [0.11 * W, z0 + 0.0 * hL], [0.14 * W, z0 - 0.35 * hL], [0.1 * W, z0 - 0.75 * hL]];
  const spearW = [0.0006, 0.0011, 0.0013, 0.0014, 0.001].map((w) => w * kH);
  const barP = [[0, z0 + ez + 0.1 * E.r], [eyeC[0] * 0.85, z0 + ez + 0.4 * E.r]];
  const postP = [[z0 + ez - 1.0 * E.r, ey - 0.3 * E.r], [z0 + 0.2 * hL, 0.45 * H], [z0 + 0.02 * hL, 0.36 * H]];
  // rattlesnake: pale pre-ocular stripe (front of the eye down to the lip) and post-ocular stripe
  // (behind the eye diagonally to the mouth corner), with the dark mask between them
  const preV = [[z0 + ez + 1.7 * E.r, ey + 1.1 * E.r], [z0 + 0.78 * hL, 0.62 * H], [z0 + 0.66 * hL, 0.4 * H]];
  const postV = [[z0 + ez - 0.5 * E.r, ey - 1.5 * E.r], [z0 + 0.3 * hL, 0.34 * H], [z0 + 0.02 * hL, 0.26 * H]];
  const maskV = [[z0 + ez + 0.4 * E.r, ey], [z0 + 0.3 * hL, 0.5 * H], [z0 + 0.05 * hL, 0.42 * H]];
  // fine vertical sutures between the labial scales (corn)
  const labialMark = (x, z, k) => {
    const u = ((z - J.v0[2]) / hL - 0.12) / 0.11; // ~8 labials from the jaw angle to the snout
    if (u < 0 || u > 8) return 1;
    const f = Math.abs(u - Math.round(u));
    return f * 0.11 * hL - 0.00008 * B.kH + (1 - k) * 0;
  };
  // ---- per-vertex outputs
  const comb = new Float32Array(nV * 3), tint = new Float32Array(nV * 4), pattern = new Float32Array(nV).fill(1);
  const mark = new Float32Array(nV).fill(1), furLen = new Float32Array(nV), patternColor = new Float32Array(nV * 4), surf = new Float32Array(nV * 4);
  const bw = ((morph && morph.borderW) || 1) * 0.0007;
  const idx = { body: 0, head: 1, jaw: 2, tongue: 3, fork: 4, fang: 5, rattle: 6 };
  for (let v = 0; v < nV; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
    const reg = idx[regionNames[regionOf[v]]] ?? 0;
    // comb: scales overlap tail-ward
    let cx = -nx * -nz, cy = -ny * -nz, cz = -1 - nz * -nz;
    const cl = Math.hypot(cx, cy, cz) || 1;
    comb[v * 3] = cx / cl; comb[v * 3 + 1] = cy / cl; comb[v * 3 + 2] = cz / cl;
    const sg = weights.axialS[v] - s0;
    const hw = hwAt(Math.max(0, sg));
    const ya = axY(Math.max(0, sg));
    const th = Math.atan2(x, y - ya); // 0 dorsal, +-pi ventral
    const u = th; // angular coordinate (radians around the body)
    const nzF = fbm3(x * 60, y * 60, z * 60, 3) - 0.5;
    const nLo = fbm3(x * 9, y * 9, z * 9, 3) - 0.5;
    let col, mat = MAT.SCALES, gloss = viper ? 0.28 : 0.55, size = (viper ? 0.0042 : 0.0024) * (hw / (viper ? 0.0265 : 0.0135)) ** 0.35, keel = viper ? 0.85 : 0.05, irid = viper ? -0.15 : -0.4;
    let pat = 1, pcol = null, mk = 1;
    const belly = reg <= 1 && y < 0.1 * hw && ny < -0.75 && sg > -0.2 * hL;
    // ---------------- body (and neck)
    if (reg === 0 || reg === 1) {
      const lat = smoothstep(0.9, 2.2, Math.abs(u)); // 0 dorsal .. 1 low flank
      const t = clamp(sg / total, 0, 1);
      if (viper) {
        col = mix3(C.ground, C.flank, lat);
        if (sg > sVent) {
          // coon tail: alternating rings from the vent to the rattle
          const rl = (total - sVent) / 9.5;
          const q = (sg - sVent) / rl;
          col = C.ringW;
          const f = q - Math.floor(q);
          if (Math.floor(q) % 2 === 1) { pat = -Math.min(f, 1 - f) * rl; pcol = C.ringB; }
          else pat = Math.min(f, 1 - f) * rl;
          pat += nzF * 0.0015;
        }
      } else {
        col = mix3(C.ground, C.flank, lat);
      }
      // dorsal features near sigma
      let lo = 0, hi = feats.length;
      while (lo < hi) { const md = (lo + hi) >> 1; if (feats[md].s < sg - 0.06) lo = md + 1; else hi = md; }
      for (let k = lo; k < feats.length && feats[k].s < sg + 0.06; k++) {
        const F = feats[k];
        if (sg > sVent && viper) break;
        const ds = sg - F.s, du = (u - F.u) * hw; // metres across the surface
        const bb = F.b * hw;
        let d;
        if (F.kind === 'diamond') {
          const L1 = Math.abs(ds) / F.a + Math.abs(du) / bb;
          d = (L1 - 1) * (F.a * bb) / Math.hypot(F.a, bb);
        } else {
          const rr = Math.min(F.a, bb) * 0.55;
          const qx = Math.abs(ds) - (F.a - rr), qy = Math.abs(du) - (bb - rr);
          d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
        }
        d += nzF * (viper ? 0.0012 : 0.0016);
        if (d < pat) {
          pat = d;
          if (F.kind === 'diamond') pcol = mix3(C.diamond, C.centre, smoothstep(-0.003, -0.009, d) * 0.8);
          else pcol = F.kind === 'saddle' ? C.saddle : F.kind === 'lateral' ? C.lateral : C.blotch;
        }
      }
      if (viper && sg <= sVent) {
        // pale diamond edges (one scale wide), fading into the ground colour
        col = mix3(C.edge, col, smoothstep(0.0022, 0.0034, pat + 0.0006 * nzF));
        mk = 1;
      } else if (!viper) {
        mk = Math.abs(pat) - bw * (0.8 + 0.4 * (0.5 + nzF));
      }
      // belly
      if (belly || Math.abs(u) > 2.55) {
        const bcol = viper ? C.belly : C.belly;
        const e = belly ? 1 : smoothstep(2.55, 2.75, Math.abs(u));
        col = mix3(col, bcol, e);
        if (e > 0.5) { pat = 1; pcol = null; mk = 1; }
        if (!viper && belly) {
          // checkerboard blocks, and two dark stripes under the tail
          let best = 1;
          for (const c of checks) {
            if (Math.abs(c.s - sg) > scute * 3) continue;
            const qx = Math.abs(sg - c.s) - c.a, xc = c.side * hw * (0.2 + c.w * 0.5), qy = Math.abs(x - xc) - hw * c.w * 0.5;
            const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
            if (d < best) best = d;
          }
          if (sg > sVent) best = Math.min(best, Math.abs(Math.abs(x) - hw * 0.35) - hw * 0.14);
          if (best < 1) { pat = best + nzF * 0.0006; pcol = C.check; }
        }
        if (belly) { mat = MAT.SCALES; gloss = 0.7; size = scute; keel = -1; irid = -0.3; }
      }
      // head and nape: the scales grow into large head plates over ~1 head length, and their relief
      // fades in the same span, so head and neck are one continuous covering (no seam)
      // (measured straight back from the occiput in the bind pose, identical on the overlapping head
      // and body meshes, so their cross-fade shows no seam)
      const sgG = J.v0[2] - z;
      const hq = smoothstep(-0.1 * hL, 1.2 * hL, sgG); // 0 on the head .. 1 on the body
      if (!belly && sgG < 1.2 * hL) {
        const plate = viper ? 0.0027 * kH : 0.009 * kH;
        size = size + (plate - size) * (1 - hq);
        keel = keel * (viper ? 0.5 + 0.5 * hq : 1);
        irid = mix(viper ? -0.5 : -0.75, irid, hq);
        gloss = mix(viper ? 0.35 : 0.75, gloss, hq);
      }
      const upper = ny > -0.15 && y > 0.35 * hw;
      if (!viper && sgG < 1.3 * hL) {
        // spear point on the crown and nape (top view), with black borders
        let d = 1;
        if (upper) {
          const ax = Math.abs(x);
          d = Math.min(seg2(ax, z, spearL, spearW), seg2(ax, z, barP, [0.0012 * kH, 0.0009 * kH])) + nzF * 0.0005;
        }
        // post-ocular stripe on the side of the head (side view)
        if (Math.abs(x) > 0.2 * W && sgG < 0.1 * hL) d = Math.min(d, seg2(z, y, postP, [0.0009 * kH, 0.0012 * kH, 0.0009 * kH]) + nzF * 0.0004);
        if (d < pat) { pat = d; pcol = C.saddle; mk = Math.abs(d) - bw * 0.9; }
      }
      if (viper && sgG < 0.3 * hL && Math.abs(x) > 0.15 * W) {
        const dm = seg2(z, y, maskV, [0.0022 * kH, 0.0022 * kH, 0.0016 * kH]);
        if (dm < 0) col = mix3(col, C.diamond, 0.75 * smoothstep(0, -0.0015, dm));
        mk = Math.min(mk, seg2(z, y, preV, [0.0011 * kH, 0.0018 * kH, 0.0015 * kH]) + nzF * 0.0004, seg2(z, y, postV, [0.0011 * kH, 0.002 * kH, 0.0016 * kH]) + nzF * 0.0004);
      }
      if (reg === 1 && sgG < 0.02 * hL) {
        const hy = y - J.v0[1];
        if (viper) {
          col = mix3(col, C.edge, 0.8 * smoothstep(yB + 0.46 * H, yB + 0.34 * H, hy));
        } else {
          // labials: belly cream with thin, faint sutures
          if (hy < yB + 0.48 * H) col = mix3(col, C.belly, 0.7 * smoothstep(yB + 0.48 * H, yB + 0.38 * H, hy));
          if (hy < yB + 0.48 * H && Math.abs(x) > 0.3 * W) mk = Math.min(mk, labialMark(x, z, 0.1));
        }
        // mouth: the palate, well inside the lips (no lining shows while the mouth is shut)
        if (ny < -0.6 && hy < yB + 0.4 * H && Math.abs(x) < 0.15 * W && z > J.v0[2] + 0.12 * hL && !belly) { mat = MAT.MOUTH; col = srgb(0x8a5a58); pat = 1; mk = 1; }
      }
      // low-frequency mottling
      col = [col[0] * (1 + 0.1 * nLo), col[1] * (1 + 0.1 * nLo), col[2] * (1 + 0.08 * nLo)];
      void t;
    } else if (reg === 2) {
      // lower jaw: pale labials outside (plates, faint relief), mouth lining well inside
      const hy = y - J.v0[1];
      col = viper ? mix3(C.edge, C.belly, 0.5) : mix3(C.belly, C.flank, 0.3);
      size = viper ? 0.003 * kH : 0.008 * kH;
      keel = 0; gloss = viper ? 0.5 : 0.75; irid = viper ? -0.5 : -0.75;
      if (ny > 0.6 && hy > yB + 0.32 * H && Math.abs(x) < 0.12 * W) { mat = MAT.MOUTH; col = srgb(0x8a5a58); }
    } else if (reg === 3 || reg === 4) {
      mat = MAT.SKIN;
      col = viper ? srgb(0x141212) : reg === 4 ? srgb(0x1a0f0f) : srgb(0x5a1414);
      gloss = 0.85;
    } else if (reg === 5) {
      mat = MAT.KERATIN; col = srgb(0xece4d0); gloss = 0.8;
    } else if (reg === 6) {
      mat = MAT.KERATIN;
      col = mix3(C.rattle, [C.rattle[0] * 0.55, C.rattle[1] * 0.5, C.rattle[2] * 0.45], 0.5 + 0.5 * Math.sin(-z * 900));
      gloss = 0.55;
    }
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    pattern[v] = pat;
    mark[v] = mk;
    const pc = pcol || col;
    patternColor[v * 4] = pc[0]; patternColor[v * 4 + 1] = pc[1]; patternColor[v * 4 + 2] = pc[2]; patternColor[v * 4 + 3] = pcol ? 1 : 0;
    surf[v * 4] = gloss; surf[v * 4 + 1] = size; surf[v * 4 + 2] = keel; surf[v * 4 + 3] = irid;
  }
  void SPINE; void mix;
  return { comb, tint, pattern, mark, furLen, patternColor, surf, stats: { features: feats.length, checks: checks.length } };
}
