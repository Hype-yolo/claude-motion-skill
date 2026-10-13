// The spider's coat: chitin (material 8) under a covering of setae (shell hairs), and glossy bare
// cuticle around the eyes and on the fangs (keratin-like, material 5).
//
// Wolf spider (Hogna / Lycosa type): dark brown carapace with a pale median band and pale
// submarginal bands, dark striae radiating from the fovea, black ocular area; abdomen with a dark
// lanceolate heart mark in front and pale chevrons behind; banded legs; black venter.
// Tarantula morphs: red-knee (Brachypelma: velvet black, orange knee bands, pale rings, tan carapace
// margin, reddish abdominal setae), rosy (Grammostola: pinkish brown) and pinktoe (Avicularia: black
// with pink tarsi). Colours sampled from the reference photos.
//
// Pattern and mark distances are stored in "cheetah-equivalent" metres (real distance x PK) so the
// covering shader's anti-aliasing widths and hair-level edge jitter, which are tuned for a cheetah,
// stay proportionate on a 25 mm animal.
import { spiderDims } from './rig.js';
import { EYES, eyeSpec } from './sculpt.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { srgb, mix3 } from '../../core/build/coatKit.js';
import { norm, sub, dot, cross, add, mul, smoothstep, clamp, mix, fbm3, len } from '../../core/math/vec.js';

const MAT = { CHITIN: 8, KERATIN: 5 };

function palette(p) {
  const w = p.coatWarmth || 0, l = p.coatLightness || 0;
  // warmth (rufous .. cool), lightness, and greyness (Pardosa-like grey individuals .. brown Hogna)
  const gr = p.coatGrey || 0;
  const tw = (c) => {
    const r = c[0] * (1 + 0.12 * w + l), g = c[1] * (1 + 0.03 * w + l), b = c[2] * (1 - 0.12 * w + l);
    const y = 0.3 * r + 0.55 * g + 0.15 * b;
    return [mix(r, y, gr), mix(g, y, gr), mix(b, y * 1.04, gr)];
  };
  if (p.variant !== 'tarantula') {
    return {
      carapace: tw(srgb(0x3a2b1f)), stripe: tw(srgb(0xa08a6a)), margin: tw(srgb(0x8c7657)),
      abdomen: tw(srgb(0x4e3b2a)), heart: tw(srgb(0x261b13)), chevron: tw(srgb(0x8e7a5c)), abdSide: tw(srgb(0x5d4935)),
      leg: tw(srgb(0x5f4a35)), legBand: tw(srgb(0x9a8465)), legDark: tw(srgb(0x33261b)),
      chel: srgb(0x1f1812), chelHair: tw(srgb(0x6a4a2c)), venter: srgb(0x1a1512), ocular: srgb(0x0d0b09),
      fang: srgb(0x160f0b), palp: tw(srgb(0x5a4633)), spinneret: tw(srgb(0x6e5a44)),
    };
  }
  const morph = p.morph || 'redknee';
  const base = {
    carapace: srgb(0x17120f), stripe: srgb(0x17120f), margin: srgb(0xc3884b),
    abdomen: srgb(0x1a1411), heart: srgb(0x120d0b), chevron: srgb(0x6b3a22), abdSide: srgb(0x1c1512),
    leg: srgb(0x15110e), legBand: srgb(0xd9651e), legDark: srgb(0x0f0c0a), legRing: srgb(0xe0a068),
    chel: srgb(0x120e0c), chelHair: srgb(0x2a1d16), venter: srgb(0x0e0b09), ocular: srgb(0x0a0908),
    fang: srgb(0x0e0a08), palp: srgb(0x16120f), spinneret: srgb(0x201813), tarsusTip: null,
  };
  if (morph === 'rosy') {
    Object.assign(base, {
      carapace: srgb(0x6e4c40), margin: srgb(0x9a7462), abdomen: srgb(0x5e4036), chevron: srgb(0x8a5a4a), abdSide: srgb(0x5a3e34),
      leg: srgb(0x4a3530), legBand: srgb(0x86645a), legRing: srgb(0x9a7a6c), legDark: srgb(0x35261f), chelHair: srgb(0x6a4a3e), palp: srgb(0x4a3530),
    });
  } else if (morph === 'pinktoe') {
    Object.assign(base, {
      carapace: srgb(0x1b191d), margin: srgb(0x2a2630), abdomen: srgb(0x1c1a1e), chevron: srgb(0x3a3036), abdSide: srgb(0x1c1a1e),
      leg: srgb(0x1a181c), legBand: srgb(0x2c2830), legRing: srgb(0x2c2830), legDark: srgb(0x121014), tarsusTip: srgb(0xe07a7a), palp: srgb(0x1a181c),
    });
  }
  const tw2 = (c) => (c ? [c[0] * (1 + l), c[1] * (1 + l), c[2] * (1 + l)] : c);
  for (const k of Object.keys(base)) base[k] = tw2(base[k]);
  return base;
}

export function spiderCoat(ctx) {
  const { rig, pos, nrm, regionOf, regionNames, weights, nV, params } = ctx;
  const d = spiderDims(params);
  const J = rig.J, BONES = rig.BONES;
  const U = d.unit, F = U / 0.013, PK = 0.33 / U;
  const wolf = d.variant === 'wolf';
  const COL = palette(params);
  const Mm = 0.001 * F; // one "wolf millimetre" at this variant's scale
  const comb = new Float32Array(nV * 3), tint = new Float32Array(nV * 4), pattern = new Float32Array(nV).fill(1);
  const mark = new Float32Array(nV).fill(1), furLen = new Float32Array(nV), patternColor = new Float32Array(nV * 4), surf = new Float32Array(nV * 4);
  const dom = weights.dominant;
  const contrast = params.patternContrast ?? 1;

  // carapace landmarks
  const z0 = J.pedA[2], z1 = J.front[2], Lc = z1 - z0;
  const fovea = [0, 0, z0 + 0.36 * Lc];
  const eyeC = add(J.ceph, [0, 0, 0.0]);
  const halfW = (z) => {
    // carapace half width along z (pear shape: widest behind the middle, narrow head)
    const u = (z - z0) / Lc;
    const wMax = d.carapace.wid * 0.0005, wHead = d.carapace.headW * 0.0005;
    return u < 0.45 ? wMax * Math.sqrt(Math.max(0.05, 1 - ((0.45 - u) / 0.47) ** 2)) : mix(wMax, wHead, smoothstep(0.45, 0.85, u));
  };
  const eyes = [];
  for (const e of EYES[d.variant]) { const E = eyeSpec(e); for (const s of [1, -1]) eyes.push({ c: eyeFrameOf(E, J.ceph, s).c, r: E.r }); }
  const boneKind = BONES.map((b) => {
    const m = /^(coxa|troch|femur|patella|tibia|meta|tarsus)(\d)([LR])$/.exec(b.name);
    if (m) return { kind: 'leg', seg: m[1], leg: +m[2], S: m[3] };
    if (/^palp/.test(b.name)) return { kind: 'palp', seg: b.name.replace(/^palp|[LR]$/g, '').toLowerCase() };
    return { kind: b.name.replace(/[LR]$/, '') };
  });
  const segIdx = { coxa: 0, troch: 1, femur: 2, patella: 3, tibia: 4, meta: 5, tarsus: 6 };

  for (let v = 0; v < nV; v++) {
    const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
    const n = [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
    const rn = regionNames[regionOf[v]];
    const b = BONES[dom[v]], bk = boneKind[dom[v]];
    let col = COL.carapace, mat = MAT.CHITIN, fl = 0, gloss = 0.05, pat = 1, pcol = COL.stripe, pint = 0, mk = 1;
    let cdir = [0, 0, -1];
    const noise = fbm3(p[0] / (1.6 * Mm), p[1] / (1.6 * Mm), p[2] / (1.6 * Mm), 3) - 0.5;
    const noiseF = fbm3(p[0] / (0.45 * Mm) + 7, p[1] / (0.45 * Mm), p[2] / (0.45 * Mm), 2) - 0.5;

    if (rn.startsWith('fang')) {
      mat = MAT.KERATIN; col = COL.fang; gloss = 0.9; fl = 0;
      cdir = sub(J['fangTip' + rn.slice(-1)], J['cheTip' + rn.slice(-1)]);
    } else if (rn.startsWith('chel')) {
      const S = rn.slice(-1);
      col = COL.chel; fl = (wolf ? 0.66 : 1.6) * Mm; gloss = 0.05;
      cdir = sub(J['cheTip' + S], J['cheBase' + S]);
      // hair on the front face, bare glossy cuticle near the tip (the fang base)
      const t = dot(sub(p, J['cheBase' + S]), norm(cdir)) / len(cdir);
      fl *= 1 - smoothstep(0.7, 0.95, t);
      col = mix3(col, COL.chelHair, clamp(0.5 + noise, 0, 1) * (wolf ? 0.35 : 0.5) * (1 - smoothstep(0.6, 0.9, t)));
    } else if (bk.kind === 'leg' || bk.kind === 'palp') {
      // ---- legs and palps: distal hair flow, pale joint bands
      const a = b.head, e = b.tail, ax = sub(e, a), L = len(ax);
      cdir = ax;
      const t = clamp(dot(sub(p, a), ax) / (L * L), 0, 1);
      const seg = bk.kind === 'leg' ? bk.seg : bk.seg === 'coxa' ? 'coxa' : bk.seg === 'troch' ? 'troch' : bk.seg === 'femur' ? 'femur' : bk.seg === 'patella' ? 'patella' : bk.seg === 'tibia' ? 'tibia' : 'tarsus';
      const si = segIdx[seg] ?? 6;
      const up = n[1];
      col = bk.kind === 'palp' ? COL.palp : COL.leg;
      if (si <= 1) col = mix3(COL.venter, col, smoothstep(-0.2, 0.6, up));
      // bands: pale rings near the distal end of femur, patella and tibia (wolf); red-knee: the
      // orange band covers the patella top and the distal femur, pale rings at tibia / metatarsus ends
      let bandD = 1e9, bandCol = COL.legBand;
      const along = t * L; // metres from the segment start
      if (wolf) {
        if (si === 2) bandD = Math.min(Math.abs(along - L * 0.18) - 0.35 * Mm, Math.abs(along - L * 0.62) - 0.4 * Mm);
        else if (si === 3) bandD = Math.abs(along - L * 0.5) - L * 0.22;
        else if (si === 4) bandD = Math.min(Math.abs(along - L * 0.2) - 0.45 * Mm, Math.abs(along - L * 0.72) - 0.4 * Mm);
        else if (si === 5) bandD = Math.abs(along - L * 0.12) - 0.3 * Mm;
        // diffuse, mottled banding of the setae (not crisp rings)
        bandD += 0.35 * Mm * noiseF + 0.25 * Mm * noise;
      } else if ((params.morph || 'redknee') === 'redknee' || params.morph === 'rosy') {
        if (si === 3) bandD = -0.2 * Mm + (0.25 - up) * 1.4 * Mm; // top of the patella
        else if (si === 2) bandD = (L - along) - 0.12 * L + (0.2 - up) * 1.2 * Mm;
        else if (si === 4) { bandD = Math.min(L - along - 0.07 * L, along - 0.04 * L) + (0.1 - up) * 0.8 * Mm; bandCol = COL.legRing; }
        else if (si === 5) { bandD = (L - along) - 0.06 * L + (0.1 - up) * 0.8 * Mm; bandCol = COL.legRing; }
        // "knee" stripes run lengthwise along the patella and tibia top in B. hamorii
        if (si === 3 || si === 4) bandD = Math.min(bandD, Math.abs(dot(norm(cross(ax, [0, 1, 0])), sub(p, a))) - 0.4 * Mm + (0.5 - up) * 2 * Mm);
      } else if (params.morph === 'pinktoe' && si === 6 && bk.kind === 'leg') {
        col = COL.tarsusTip;
      }
      // (wolf: soft edges, about 3x the anti-aliasing width, and a lower contrast)
      if (bandD < 1e8) { pat = bandD * PK * (wolf ? 0.33 : 1); pcol = bandCol; pint = contrast * (wolf ? 0.6 : 1); }
      // darker ventral side and joint membranes
      col = mix3(col, COL.legDark, smoothstep(0.1, -0.7, up) * 0.4);
      const lens = wolf ? [0.62, 0.64, 0.85, 0.8, 0.8, 0.72, 0.66] : [1.8, 1.8, 3.4, 3.2, 3.2, 2.8, 2.4];
      fl = lens[si] * Mm * (bk.kind === 'palp' ? 0.9 : 1) * (1 + 0.2 * noiseF);
      if (!wolf && si === 6) fl *= 0.8;
      gloss = 0.03;
    } else if (bk.kind === 'abdomen' || bk.kind === 'pedicel' || bk.kind === 'spinnerets') {
      // ---- abdomen: hair lying backwards, dorsal heart mark and chevrons, dark venter
      const c = d.abdomen.c.map((x) => x * 0.001), r = d.abdomen.r.map((x) => x * 0.001);
      const u = (p[2] - c[2]) / r[2]; // +1 front .. -1 rear
      const up = n[1];
      const dors = smoothstep(-0.1, 0.55, up);
      col = mix3(COL.venter, mix3(COL.abdSide, COL.abdomen, dors), smoothstep(-0.75, -0.2, up));
      cdir = [0, -0.15 * u, -1];
      if (wolf) {
        // lanceolate heart mark: a dark spear along the front half of the midline (tint), pale
        // chevrons over the rear half (pattern)
        const hw = mix(0.95, 0.15, clamp((0.95 - u) / 1.0, 0, 1)) * Mm;
        const heart = (Math.abs(p[0]) - hw * (u > -0.1 ? 1 : 0)) / Mm;
        col = mix3(col, COL.heart, smoothstep(0.3, -0.2, heart) * dors * contrast * smoothstep(-0.2, 0.2, u));
        mk = Math.min(mk, u > -0.05 && u < 0.95 ? (Math.abs(Math.abs(p[0]) - hw) - 0.08 * Mm) * PK / (dors > 0.3 ? 1 : 1e3) : 1);
        // rear half: pairs of pale spots flanking the midline, joined by faint, broken chevrons
        let spots = 1e9, ch = 1e9;
        for (let k = 0; k < 4; k++) {
          const uz = -0.12 - k * 0.2;
          spots = Math.min(spots, Math.hypot(Math.abs(p[0]) - r[0] * (0.3 - 0.03 * k), (u - uz) * r[2]) - 0.32 * Mm * (1 - 0.15 * k));
          const vz = uz + Math.abs(p[0]) / r[0] * 0.25;
          ch = Math.min(ch, Math.abs(u - vz) * r[2] - 0.1 * Mm * (1 - 0.2 * k));
        }
        ch = Math.max(ch, Math.abs(p[0]) - r[0] * 0.3, 0.25 * Mm * (noiseF + 0.2)); // broken up
        // pale flanks: lateral pale bands (Hogna) framing the dorsum
        const flank = Math.abs(Math.abs(p[0]) / r[0] - 0.72) * r[0] - 0.35 * Mm;
        pat = (Math.min(spots, ch, flank + 0.3 * Mm * noise) + 0.2 * Mm * noiseF) * PK * 0.6;
        pcol = COL.chevron;
        pint = dors * contrast * 0.8 * smoothstep(-0.35, 0.1, up);
        // mottling
        col = [col[0] * (1 + 0.3 * noiseF), col[1] * (1 + 0.28 * noiseF), col[2] * (1 + 0.24 * noiseF)];
        fl = 0.9 * Mm * (1 + 0.25 * noiseF);
      } else {
        // tarantula: long reddish setae on black; a bald urticating patch sometimes
        // black under the hair, the long setae reddish (strand-mottled, stronger on the dorsum)
        pat = (-0.5 * Mm + 0.2 * Mm * noise) * PK;
        pcol = COL.chevron;
        pint = smoothstep(-0.4, 0.3, up) * (0.4 + 0.3 * noiseF);
        fl = (3.8 + 1.2 * noiseF) * Mm * smoothstep(-0.9, -0.3, up) + 1.2 * Mm;
        if (params.bald) {
          const bd = len([p[0] / r[0], (p[1] - c[1] - r[1] * 0.7) / r[1], (p[2] - c[2] + r[2] * 0.35) / r[2]]);
          fl *= smoothstep(0.28, 0.42, bd + 0.05 * noise);
        }
      }
      if (bk.kind === 'spinnerets') { col = COL.spinneret; fl *= 0.3; }
      if (bk.kind === 'pedicel') fl *= 0.4;
      gloss = 0.03;
    } else {
      // ---- prosoma: carapace, head, sternum
      const up = n[1];
      const x = p[0], z = p[2];
      const W = halfW(z);
      const dors = smoothstep(-0.15, 0.35, up);
      col = mix3(COL.venter, COL.carapace, smoothstep(-0.55, -0.1, up));
      // hair radiates back and out from the eye region
      cdir = [x, 0, z - eyeC[2] - 0.001 * F];
      const u = (z - z0) / Lc;
      if (wolf) {
        // median band: narrow between the eyes, widest over the thorax, narrowing to the rear
        // (a narrow pale stripe between the eyes and down the face, widening behind the eyes)
        const mw = (u > 0.72 ? mix(0.5, 0.35, smoothstep(0.72, 0.95, u)) : mix(0.4, 0.85, smoothstep(0.1, 0.55, u))) * Mm;
        const median = Math.abs(x) - mw + 0.12 * Mm * noiseF;
        // submarginal bands along the sides of the carapace
        const rel = Math.abs(x) / Math.max(W, 1e-5);
        const sub1 = Math.abs(rel - 0.8) * W - 0.13 * W + 0.1 * Mm * noise;
        const subm = Math.max(sub1, (0.15 - up) * 3 * Mm, (u - 0.8) * 8 * Mm);
        pat = Math.min(median, subm) * PK;
        pint = dors * contrast;
        pcol = COL.stripe;
        // dark striae radiating from the fovea
        let st = 1e9;
        for (let k = 0; k < 4; k++) {
          const ang = (-0.95 + k * 0.62);
          const dir = [Math.sin(ang + Math.PI / 2), 0, Math.cos(ang + Math.PI / 2)];
          const q = sub([Math.abs(x), 0, z], fovea);
          const along = dot(q, dir);
          if (along > 0.4 * Mm && along < W * 0.95) st = Math.min(st, Math.abs(q[0] * dir[2] - q[2] * dir[0]) - 0.08 * Mm * (1 - along / W));
        }
        mk = Math.min(mk, dors > 0.2 ? st * PK : 1);
      } else {
        // velvet black centre with a tan margin and faint radiating lines
        const rel = Math.abs(x) / Math.max(W, 1e-5);
        pat = (Math.max(0.78 - rel, 0) * W * 1.0 - 0.06 * Mm + (0.25 - up) * 0.5 * Mm) * PK;
        if (up < -0.2) pat = 1;
        pcol = COL.margin; pint = (params.morph === 'pinktoe' ? 0.3 : 1) * smoothstep(-0.2, 0.2, up);
      }
      // ocular area (and the tarantula's tubercle): bare, black, glossy
      let eyeD = 1e9;
      for (const e of eyes) eyeD = Math.min(eyeD, len(sub(p, e.c)) - e.r * 1.35);
      if (eyeD < 0.5 * Mm * (wolf ? 1 : 0.6)) col = mix3(col, COL.ocular, smoothstep(0.5 * Mm, 0.05 * Mm, eyeD));
      fl = (wolf ? 0.72 : 1.1) * Mm * smoothstep(0.05 * Mm, 0.6 * Mm, eyeD);
      if (up < -0.5) fl *= 0.5; // sternum
      gloss = eyeD < 0.3 * Mm ? 0.4 : 0.05;
      if (b.name === 'head' && up > 0.2 && z > J.front[2] - 0.0015 * F) fl *= 0.6;
    }

    // low frequency colour noise
    col = [col[0] * (1 + 0.22 * noise), col[1] * (1 + 0.2 * noise), col[2] * (1 + 0.16 * noise)];
    // comb: tangent to the surface
    let cd = sub(cdir, mul(n, dot(cdir, n)));
    if (len(cd) < 1e-9) cd = norm(cross(n, [1, 0, 0])); else cd = norm(cd);
    comb.set(cd, v * 3);
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    pattern[v] = pat; mark[v] = mk; furLen[v] = fl;
    patternColor[v * 4] = pcol[0]; patternColor[v * 4 + 1] = pcol[1]; patternColor[v * 4 + 2] = pcol[2]; patternColor[v * 4 + 3] = pint;
    // gloss, feature scale (fine cuticle striation), agouti (banded setae), undercoat
    surf[v * 4] = gloss; surf[v * 4 + 1] = -0.00012 * F; surf[v * 4 + 2] = wolf ? 0.35 : 0.1; surf[v * 4 + 3] = 0;
  }

  // smooth hair length so shells do not step
  const nb = weights.neighbors, tmp = new Float32Array(nV);
  for (let it = 0; it < 2; it++) {
    for (let v = 0; v < nV; v++) {
      const ns = nb[v];
      if (!ns.length || tint[v * 4 + 3] !== MAT.CHITIN) { tmp[v] = furLen[v]; continue; }
      let a = 0;
      for (const u of ns) a += furLen[u];
      tmp[v] = 0.5 * furLen[v] + (0.5 * a) / ns.length;
    }
    furLen.set(tmp);
  }
  return { comb, tint, pattern, mark, furLen, patternColor, surf, stats: { patternScale: PK } };
}
