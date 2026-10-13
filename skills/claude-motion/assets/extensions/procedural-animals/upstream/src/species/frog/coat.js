// The frog's skin: wet, glossy, finely granular (material 7: bumps, clear coat, subsurface), bigger
// tubercles on the back, smooth belly. Colour: green head / upper lip, olive to brown dorsum with dark
// mottling grown on the surface, lighter flanks, cream belly, pale or (breeding male bullfrog) yellow
// throat, legs with dark crossbands, brown tympanum (pale ring and dark centre in males), dark lip
// line, darker webbing. Common frog: brown / olive with dark blotches, the dark temporal mask behind
// the eye over the tympanum, pale dorsolateral folds, barred legs, speckled belly.
// Works in the reference space of rig.js; colours sampled from the reference photos.
import { HEAD_O } from './rig.js';
import { tympanum } from './sculpt.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, fbm3, rng } from '../../core/math/vec.js';
import { srgb, mix3, MAT, poissonFeatures, featureDistance } from '../../core/build/coatKit.js';

// sRGB palettes
const PALETTES = {
  // bullfrog, green (the common look: green head, olive back)
  green: {
    head: 0x6a8640, lip: 0x88a452, back: 0x5c6238, flank: 0x80845e, mottle: 0x33351f, belly: 0xe8e2c8,
    throatF: 0xe0dac2, throatM: 0xd6bf3c, leg: 0x6e6e44, band: 0x34321f, tymp: 0x6a5838, web: 0x5a5840, lipline: 0x2a2a18,
  },
  // bullfrog, olive-brown
  olive: {
    head: 0x77764e, lip: 0x8c8c5c, back: 0x6a5c3e, flank: 0x8a7c5a, mottle: 0x3c3020, belly: 0xe4dec6,
    throatF: 0xdcd6be, throatM: 0xcfb844, leg: 0x665640, band: 0x302619, tymp: 0x6b5a3e, web: 0x5a4c3a, lipline: 0x2a2418,
  },
  // bullfrog, pale tan morph
  pale: {
    head: 0x9c9864, lip: 0xb0ac78, back: 0x92845a, flank: 0xa8986e, mottle: 0x5e5236, belly: 0xece6d0,
    throatF: 0xe6e0ca, throatM: 0xd8c460, leg: 0x8c7c56, band: 0x564a30, tymp: 0x7a6846, web: 0x7a6c50, lipline: 0x4a4028,
  },
  // common frog (Rana temporaria): brown / olive / rufous individuals
  temporaria: {
    head: 0x86704e, lip: 0x9c8866, back: 0x7b6546, flank: 0x957e5e, mottle: 0x33251a, belly: 0xe2d6b4,
    throatF: 0xe6e2d6, throatM: 0xc4ccd4, leg: 0x7a6446, band: 0x33251a, tymp: 0x3f2d20, web: 0x6a5642, lipline: 0x2e2218,
    mask: 0x36261b, fold: 0xa48c64, speckle: 0xb07236,
  },
};
const TONGUE = srgb(0xd89a8a), MOUTH = srgb(0xc98a7e);

function coatColours(p) {
  const base = PALETTES[p.colour] || PALETTES.green;
  const w = p.coatWarmth || 0, l = p.coatLightness || 0, gr = p.coatGreen || 0;
  const tweak = (h) => { const c = srgb(h); return [c[0] * (1 + 0.12 * w + l - 0.1 * gr), c[1] * (1 + 0.03 * w + l + 0.06 * gr), c[2] * (1 - 0.14 * w + l - 0.12 * gr)]; };
  const C = {};
  for (const [k, v] of Object.entries(base)) C[k] = ['belly', 'throatF', 'throatM'].includes(k) ? srgb(v) : tweak(v);
  return C;
}

export function frogCoat(ctx) {
  const { model, rig, pos, nrm, regionOf, weights, nV, params } = ctx;
  const { BONES } = rig;
  const COL = coatColours(params);
  const male = params.sex === 'male';
  const temporaria = params.variant === 'common-frog';
  const juv = params.age === 'juvenile';
  const { dominant, skinIndex, skinWeight, limbMember } = weights;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const R = rng((params.coatSeed || 1) * 31 + 7);

  const isLimb = BONES.map((b) => /^(humerus|radius|metacarpus|fpaw|femur|tibia|metatarsus|hpaw)/.test(b.name));
  const byTag = (t) => model.prims.filter((p) => p.tag === t);
  const eyePrims = byTag('eyesocket'), lidPrims = byTag('eyelid');
  const tympPrims = byTag('tympanum'), foldPrims = byTag('stfold'), dlPrims = byTag('dlfold');
  const nostrils = byTag('nostril');
  const jawPrims = model.forPart('jaw');
  const headUpper = model.prims.filter((p) => p.part === 'body' && p.bone === 'head' && !p.carve);
  const webPrims = byTag('web');

  // per-vertex classification
  // region: 0 trunk, 1 head (upper), 2 jaw (lower jaw part), 3 tongue, 4 throat, 5 eye, 6 limb
  const region = new Uint8Array(nV);
  const legBone = new Int16Array(nV).fill(-1);
  const legness = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const bn = BONES[dominant[v]].name;
    let lb = -1, lw = 0, lsum = 0;
    for (let k = 0; k < 4; k++) {
      const b = skinIndex[v * 4 + k], w = skinWeight[v * 4 + k];
      if (isLimb[b]) { lsum += w; if (w > lw) { lw = w; lb = b; } }
    }
    legBone[v] = lb;
    legness[v] = lb >= 0 ? smoothstep(0.25, 0.75, lsum) : 0;
    void limbMember;
    const rn = ctx.regionNames[regionOf[v]];
    if (rn === 'jaw') region[v] = 2;
    else if (rn === 'tongue') region[v] = 3;
    else if (bn.startsWith('eye')) region[v] = 5;
    else if (bn === 'throat') region[v] = 4;
    else if (bn === 'head' || bn === 'neck2' || bn === 'neck1') region[v] = 1;
    else if (legness[v] > 0.5) region[v] = 6;
    else region[v] = 0;
  }

  // ---- dark mottling (spots grown on the surface): large on the back, smaller on the flanks and
  // head, none on the belly; the legs carry crossbands instead
  const spotR = (v) => {
    const n = N(v), p = P(v), r = region[v];
    if (r === 2 || r === 3 || r === 4) return 0;
    if (r === 6 || legness[v] > 0.3) return 0;
    if (n[1] < -0.25) return 0;
    const back = smoothstep(-0.2, 0.6, n[1]);
    let rad = (temporaria ? 0.0034 : 0.0028) * (0.7 + 0.5 * back);
    if (r === 1 || r === 5) rad *= temporaria ? 0.55 : 0.6;
    if (r === 1 && p[2] > HEAD_O[2] + 0.02) rad *= 0.6; // snout: small freckles
    return rad * (params.mottleSize || 1);
  };
  const density = params.mottle ?? 0.7;
  const F = poissonFeatures({ pos, nrm, nV, radius: (v) => (R() < density ? spotR(v) : 0), R, spacing: temporaria ? 1.35 : 1.5, gap: 0.002, cell: 0.012 });
  for (const s of F.spots) { s.el = 1 + 0.8 * R(); s.c = norm([R() - 0.5, (R() - 0.5) * 0.3, 1]); }

  // leg crossbands: along each limb bone's axis
  const bandPeriod = temporaria ? 0.0105 : 0.0125;
  const bandPhase = BONES.map(() => R());

  const T = tympanum(params);
  const comb = new Float32Array(nV * 3);
  const tint = new Float32Array(nV * 4);
  const furLen = new Float32Array(nV);
  const markSDF = new Float32Array(nV).fill(1);
  const pattern = new Float32Array(nV).fill(1);
  const patternColor = new Float32Array(nV * 4);
  const surf = new Float32Array(nV * 4);

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    const h = sub(p, HEAD_O);
    const L = legness[v];
    const side = p[0] >= 0 ? 1 : -1;
    let col, mat = MAT.WET_SKIN, mark = 1, pat = 1, gloss = 0.85, bump = 0.0012;
    let patCol = COL.mottle, patI = 0.9;

    // comb (bump / clear-coat anisotropy direction): nose -> vent, down the legs
    let d = [0, 0, -1];
    if (legBone[v] >= 0 && L > 0.3) { const b = BONES[legBone[v]]; d = norm(sub(b.tail, b.head)); }
    let t = sub(d, mul(n, dot(d, n)));
    if (len(t) < 1e-4) t = cross(n, [1, 0, 0]);
    t = norm(t);
    comb[v * 3] = t[0]; comb[v * 3 + 1] = t[1]; comb[v * 3 + 2] = t[2];

    // dorsal / ventral blend (countershading by normal and height)
    const up = n[1];
    const ventral = Math.max(smoothstep(-0.25, -0.6, up) * smoothstep(0.03, 0.015, p[1]), smoothstep(-0.45, -0.85, up));
    if (r === 3) { col = TONGUE; mat = MAT.MOUTH; }
    else if (r === 0 || r === 6 || r === 5 || r === 1 || r === 4 || r === 2) {
      // ---- base: back -> flank -> belly
      col = mix3(COL.flank, COL.back, smoothstep(-0.1, 0.55, up));
      col = mix3(col, COL.belly, ventral);
      bump = mix(0.0009, 0.0017, smoothstep(-0.2, 0.7, up));
      gloss = mix(0.72, 0.9, smoothstep(-0.3, 0.5, up));
      // head: green, brighter on the upper lip; throat pale (female) / yellow (male)
      if (r === 1 || r === 5 || r === 2 || r === 4 || r === 0) {
        const headW = (r === 4 ? 0.4 : 1) * smoothstep(-0.05, -0.022, h[2]);
        let hc = COL.head;
        // upper lip: the band just above the mouth line
        const lipBand = smoothstep(-0.012, -0.018, h[1]) * smoothstep(-0.03, -0.02, h[1]);
        hc = mix3(hc, COL.lip, lipBand * 0.8 + smoothstep(0.02, 0.035, h[2]) * 0.2);
        col = mix3(col, hc, headW * smoothstep(-0.5, 0.3, up));
        bump = mix(0.0008, 0.0011, smoothstep(-0.2, 0.6, up));
      }
      // throat and chin underside
      if (r === 4 || r === 2 || (r === 1 && up < -0.3)) {
        const thr = male ? COL.throatM : COL.throatF;
        const under = r === 4 ? smoothstep(0.2, -0.4, up) : smoothstep(-0.2, -0.6, up);
        col = mix3(col, thr, under);
        bump = mix(bump, 0.0006, under); gloss = mix(gloss, 0.7, under);
      }
      if (r === 0) {
        // the chest and belly are smooth and pale; the flank low down lighter
        bump = mix(bump, 0.0006, ventral);
      }
      // ---- legs: base colour with dark crossbands on the upper (outer) side, pale undersides
      if (L > 0 && legBone[v] >= 0) {
        const b = BONES[legBone[v]];
        const foot = /fpaw|hpaw/.test(b.name), hand = /metacarpus|fpaw/.test(b.name);
        // (the sprawled, folded legs show their outer faces: those count as the upper side)
        const upL = Math.max(up, 0.9 * n[0] * side);
        const outer = smoothstep(-0.3, 0.4, upL) * (1 - (foot ? 0.3 : 0));
        let lc = mix3(COL.belly, COL.leg, smoothstep(-0.8, -0.35, upL));
        if (/femur/.test(b.name)) lc = mix3(lc, mix3(COL.belly, COL.flank, 0.4), smoothstep(-0.2, -0.7, upL) * 0.6);
        if (foot) lc = mix3(COL.web, COL.leg, 0.5);
        if (hand) lc = mix3(lc, COL.belly, 0.25);
        col = mix3(col, lc, L);
        bump = mix(bump, foot ? 0.0006 : 0.0011, L);
        // crossbands across the bone
        if (/femur|tibia|metatarsus|humerus|radius/.test(b.name)) {
          const ax = norm(sub(b.tail, b.head));
          const along = dot(sub(p, b.head), ax);
          const ph = along / bandPeriod + bandPhase[b.index] + 0.25 * (fbm3(p[0] * 300, p[1] * 300, p[2] * 300, 2) - 0.5);
          const f = Math.abs(ph - Math.floor(ph) - 0.5); // 0 at band centre
          const wBand = (temporaria ? 0.2 : 0.17) + 0.05 * (fbm3(p[0] * 120, p[1] * 120, p[2] * 120, 2) - 0.5);
          const bandSD = (f - wBand) * bandPeriod;
          if (outer > 0.25) { pat = Math.min(pat, bandSD + (1 - outer) * 0.002); patCol = COL.band; }
        }
      }
      // ---- webbing: darker, smooth, translucent look
      if (L > 0.5 && legBone[v] >= 0 && /hpaw/.test(BONES[legBone[v]].name)) {
        let dw = 1e9;
        for (const w of webPrims) dw = Math.min(dw, SDFModel.dist(w, p[0], p[1], p[2]));
        if (dw < 0.0004) { col = mix3(COL.web, COL.leg, 0.2); bump = 0.0005; gloss = 0.75; }
      }
      // ---- tympanum: flat brown disc, pale ring and dark centre spot in males
      if (r === 1 || r === 0) {
        for (const tp of tympPrims) {
          const c = [tp.P[0], tp.P[1], tp.P[2]];
          const dd = len(sub(p, c));
          const rr = T.r;
          if (dd < rr + 0.002) {
            const disc = smoothstep(rr + 0.0012, rr - 0.0004, dd);
            let tc = COL.tymp;
            if (male) tc = mix3(tc, mix3(COL.tymp, COL.flank, 0.6), smoothstep(rr * 0.55, rr * 0.8, dd) * (1 - smoothstep(rr * 0.85, rr, dd)));
            tc = mix3(tc, mix3(COL.tymp, COL.head, 0.35), male ? smoothstep(rr * 0.3, rr * 0.1, dd) : 0);
            col = mix3(col, tc, disc);
            bump = mix(bump, 0.0005, disc); gloss = mix(gloss, 0.95, disc);
            if (Math.abs(dd - rr) < 0.0012) mark = Math.min(mark, Math.abs(dd - rr) - 0.0004 + (male ? 0.0003 : 0));
          }
        }
        // the supratympanic fold: a little paler ridge (bullfrog: same colour, a fine dark edge below)
        let df = 1e9;
        for (const f of foldPrims) df = Math.min(df, SDFModel.dist(f, p[0], p[1], p[2]));
        if (df < 0.0015) col = mix3(col, mix3(col, COL.lip, 0.4), smoothstep(0.0015, 0.0, df) * 0.5);
      }
      // ---- the lip line: a dark line where the upper and lower jaws meet (mouth corner to snout)
      if (r === 1) {
        const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
        if (dj < 0.0012) mark = Math.min(mark, dj - 0.0002);
        // (skin just inside the lips shows in the closed mouth's slit from the side: dark lip, the
        // pink mouth lining only deeper in, seen when the mouth gapes)
        if (dj < -0.0022) { col = MOUTH; mat = MAT.MOUTH; } else if (dj < -0.0004) col = COL.lipline;
      } else if (r === 2) {
        const dh = SDFModel.evalList(headUpper, p[0], p[1], p[2]);
        if (dh < -0.0022) { col = MOUTH; mat = MAT.MOUTH; }
        else if (dh < -0.0004) col = COL.lipline;
        else if (dh < 0.0014) mark = Math.min(mark, dh - 0.0006);
        // the lower lip: pale
        col = mat === MAT.MOUTH || col === COL.lipline ? col : mix3(col, COL.belly, smoothstep(-0.3, 0.2, up) * 0.35);
      }
      // ---- eyes: the fleshy lid a little paler at its rim, a dark line under the eye
      if (r === 5 || r === 1) {
        for (const e of eyePrims) {
          const de = SDFModel.dist(e, p[0], p[1], p[2]);
          if (de < 0.0018 && de > -0.003) {
            col = mix3(col, COL.lip, smoothstep(0.0018, 0.0003, de) * 0.35);
            if (Math.abs(de) < 0.0007) mark = Math.min(mark, Math.abs(de) - 0.00035);
          }
        }
        void lidPrims;
      }
      // ---- nostrils: dark
      for (const ns of nostrils) {
        const dn = SDFModel.dist(ns, p[0], p[1], p[2]);
        if (dn < 0.0009) mark = Math.min(mark, dn - 0.0004);
      }
      // ---- common frog: the dark temporal mask (eye -> over the tympanum -> jaw angle), pale
      // dorsolateral folds, chevron on the nape, orange-speckled belly
      if (temporaria) {
        if (r === 1 || r === 5 || r === 0) {
          // mask: a band from behind the eye back and down over the tympanum
          const hx = Math.abs(h[0]);
          const mz = (h[2] + 0.004) / -0.042; // 0 at the eye, 1 behind the tympanum
          if (hx > 0.012 && mz > -0.1 && mz < 1.15) {
            const yc = mix(-0.002, -0.014, clamp(mz, 0, 1));
            const halfH = 0.0065 + 0.003 * Math.sin(Math.PI * clamp(mz, 0, 1));
            const sd = Math.max(Math.abs(h[1] - yc) - halfH, -mz * 0.02, (mz - 1) * 0.02, (0.2 - dot(n, [side, 0.1, 0])) * 0.01);
            if (sd < pat) { pat = sd; patCol = COL.mask; patI = 0.95; }
          }
        }
        let dl = 1e9;
        for (const f of dlPrims) dl = Math.min(dl, SDFModel.dist(f, p[0], p[1], p[2]));
        if (dl < 0.002) col = mix3(col, COL.fold, smoothstep(0.002, 0.0, dl) * 0.7);
        if (ventral > 0.3 && r === 0) {
          const sp = fbm3(p[0] * 700, p[1] * 700, p[2] * 700, 2);
          col = mix3(col, COL.speckle, smoothstep(0.58, 0.68, sp) * ventral * 0.6);
        }
      }
      // ---- mottling on top
      if (r !== 2 && r !== 4 && legness[v] < 0.6) {
        let [sd] = featureDistance(F, p, n, 1);
        sd += 0.0022 * (fbm3(p[0] * 420, p[1] * 420, p[2] * 420, 3) - 0.5);
        if (sd < pat) { pat = sd; patCol = r === 0 || r === 6 ? COL.mottle : mix3(COL.mottle, COL.head, 0.25); patI = temporaria ? 0.85 : 0.6; }
      }
      // female bullfrog: grey mottled throat
      if (!male && !temporaria && (r === 4 || r === 2) && up < -0.2) {
        const g = fbm3(p[0] * 260, p[1] * 260, p[2] * 260, 3);
        col = mix3(col, mix3(col, [0.25, 0.25, 0.2], 0.5), smoothstep(0.55, 0.65, g) * 0.6);
      }
    } else {
      col = COL.back;
    }
    if (juv) col = mix3(col, mix3(col, COL.head, 0.6), 0.3);

    // low-frequency colour variation
    const cv = fbm3(p[0] * 60, p[1] * 60, p[2] * 60, 3) - 0.5;
    col = [col[0] * (1 + 0.16 * cv), col[1] * (1 + 0.13 * cv), col[2] * (1 + 0.1 * cv)];

    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    furLen[v] = 0;
    markSDF[v] = clamp(mark, -0.01, 0.01);
    pattern[v] = clamp(pat, -0.01, 0.01);
    patternColor[v * 4] = patCol[0]; patternColor[v * 4 + 1] = patCol[1]; patternColor[v * 4 + 2] = patCol[2]; patternColor[v * 4 + 3] = mat === MAT.WET_SKIN ? patI : 0;
    surf[v * 4] = gloss; surf[v * 4 + 1] = bump * (params.bumpK || 1); surf[v * 4 + 2] = 0; surf[v * 4 + 3] = 0;
  }
  void add; void mix;
  return { comb, tint, pattern, mark: markSDF, furLen, patternColor, surf, region };
}
