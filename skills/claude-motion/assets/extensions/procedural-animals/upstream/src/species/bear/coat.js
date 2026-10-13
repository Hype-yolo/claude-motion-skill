// The brown bear's coat: long shaggy guard hair over a dense underfur, painted per vertex in
// reference space.
//
// Colour fields: the back, hump and head are the
// palest parts (sun-bleached guard-hair tips), the legs darkest (near black on the lower legs and
// feet), the belly dark; the face is a little paler and greyer than the crown, the muzzle paler
// again, the ears dark with darker rims, the nose pad, lips and soles black, the claws horn coloured
// (dark in Eurasian bears, pale cream in grizzlies). Grizzled coats use the shader's agouti band
// (surf.z): dark roots and a dark band below a pale (silver-cream) tip. Coats (params.coat): 'dark'
// (Eurasian chocolate), 'red' (reddish brown), 'medium' (coastal brown), 'blonde' (straw, dark
// legs), 'grizzled' (silver-tipped grizzly) and 'black' (American black bear: black with a tan
// muzzle). Cubs are fluffy and uniform, Eurasian cubs often with a pale neck collar.
// Fur length: longest on the hump, nape and neck ruff (winter guard hair 9-12 cm), long on the
// flanks, belly fringe, forearm "sleeves" and thigh "trousers", short on the face, lower legs and
// feet (research 6.1).
import { HEAD_O, MUZZLE_Z0 } from './rig.js';
import { EYE_BASE } from './sculpt.js';
import { neckS, eyePatchesAt } from './regions.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, fbm3, vnoise3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT, smoothField } from '../../core/build/coatKit.js';

// sRGB swatches (neutral-light albedo). `tip`: hump / back guard-hair tips, `ag`: agouti
// amounts (dark band below the tip) per region.
const COATS = {
  dark: {
    back: 0x5c4029, flank: 0x4c3422, tip: 0x76573a, head: 0x634833, face: 0x6e5540, muzzle: 0x86684c,
    leg: 0x35251a, belly: 0x33241a, ear: 0x3a291d, earRim: 0x1f1610, earInner: 0x2a1e16, claw: 0x3a3530,
    ag: { back: 0.12, head: 0.08, leg: 0.1 },
  },
  // (side3: a deep red-brown with paler tips on the back, the shoulders darker; less orange than before)
  red: {
    back: 0x7a4c30, flank: 0x5e3924, tip: 0x9a6a48, head: 0x7a5236, face: 0x846044, muzzle: 0x9a7658,
    leg: 0x38241a, belly: 0x3a2518, ear: 0x4a2e1c, earRim: 0x241810, earInner: 0x2e1f16, claw: 0x3c3530,
    ag: { back: 0.12, head: 0.06, leg: 0.1 },
  },
  medium: {
    back: 0x80593a, flank: 0x6e4b30, tip: 0xa57b4c, head: 0x8a653e, face: 0x92704e, muzzle: 0x9e7c58,
    leg: 0x45301f, belly: 0x352315, ear: 0x4e3622, earRim: 0x251a12, earInner: 0x2e2118, claw: 0x8e8272,
    ag: { back: 0.1, head: 0.06, leg: 0.1 },
  },
  // (front3, tq3: golden-blonde tips on the hump and shoulders, a darker face, near-black legs and chest)
  // (front3's medians, forehead #735644, cheeks #755c34, hump #89553d with its locks ranging #5b2d00 to
  // #c69665 and a pale muzzle #c8a68b: the old head / face 0x8e6e50 / 0x967656 with little agouti rendered as an
  // even pale cream, a plush toy (the default showcase bear, grizzly s1, is blonde))
  blonde: {
    back: 0x96683e, flank: 0x74522f, tip: 0xc8965c, head: 0x7c5a3c, face: 0x846240, muzzle: 0xc0a486,
    leg: 0x3a2c22, belly: 0x3e2e22, ear: 0x5e4632, earRim: 0x2e2218, earInner: 0x3a2c20, claw: 0xb8ab94,
    ag: { back: 0.3, head: 0.32, leg: 0.1 },
  },
  // (tq4, tq1, front1: a dark chocolate-grey coat, silver-tipped on the back and shoulders, a dark face and
  // legs; the pale grey-beige of before read as a sheep's fleece)
  grizzled: {
    back: 0x7c7064, flank: 0x5a4e46, tip: 0x9e9282, head: 0x6e5c4e, face: 0x7a6858, muzzle: 0x8a7866,
    leg: 0x302826, belly: 0x383028, ear: 0x4a3e34, earRim: 0x241e1a, earInner: 0x2a2420, claw: 0xcfc2a8,
    ag: { back: 0.6, head: 0.4, leg: 0.12 },
  },
  black: {
    back: 0x1b1816, flank: 0x171412, tip: 0x24201d, head: 0x1c1917, face: 0x2a2420, muzzle: 0x8a6a4a,
    leg: 0x121010, belly: 0x151311, ear: 0x1a1715, earRim: 0x0f0d0c, earInner: 0x1c1816, claw: 0x2a2622,
    ag: { back: 0.0, head: 0.0, leg: 0 },
  },
};
// desaturation of the head, face and muzzle swatches toward their luminance, per coat (palette())
// (0.7 for the brown coats drew a grey hood on the Eurasian bear's rust body)
const FACE_DESAT = { dark: 0.55, red: 0.55, medium: 0.55, blonde: 0.45, grizzled: 0.65, black: 0.35 };
const TOUSLE = 0.8;
const CUB = 0x6a4c34; // cubs: a uniform soft brown natal coat
const COLLAR = 0xe8e0cc; // the pale neck collar of many Eurasian cubs

// Value noise stretched along a flow direction `t` (unit, reference space): `k` cycles per metre across the flow, `s` times
// longer along it, so the pattern runs in streaks with the hair (locks). The along-flow coordinate is measured from
// anchors snapped to 4 cm cells and two lattices offset by half a cell are cross-faded, so curving flow does not shear
// it (as the coat shader's own streak() for the base without shells).
function streak(p, t, k, s, o) {
  const fr = (x) => x - Math.floor(x);
  const edge = (a, b, c) => Math.min(a, 1 - a, b, 1 - b, c, 1 - c);
  const g = [p[0] * 25, p[1] * 25, p[2] * 25];
  const ea = edge(fr(g[0]), fr(g[1]), fr(g[2])), eb = edge(fr(g[0] + 0.5), fr(g[1] + 0.5), fr(g[2] + 0.5));
  const st = k * (1 - 1 / s);
  const at = (a, oo) => {
    const d = ((p[0] - a[0]) * t[0] + (p[1] - a[1]) * t[1] + (p[2] - a[2]) * t[2]) * st;
    return vnoise3(p[0] * k - t[0] * d + oo, p[1] * k - t[1] * d, p[2] * k - t[2] * d);
  };
  const nA = at(g.map((x) => Math.floor(x) * 0.04), o), nB = at(g.map((x) => (Math.floor(x + 0.5) - 0.5) * 0.04), o + 17.3);
  const w = (ea * ea) / (ea * ea + eb * eb + 1e-6);
  return (nB + (nA - nB) * w - 0.5) / Math.sqrt(w * w + (1 - w) * (1 - w)) + 0.5;
}

const desat = (c, k) => { const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return c.map((x) => x + (y - x) * k); };

// claw horn (claws.js): the palette's claw colour at the base, paler worn horn toward the tip (side1, tq2, detail_bipedal)
export function clawColour(params) {
  const c = palette(params).claw;
  // dark horn at the base (a near-black grey-brown, darker than the swatch for the pale grizzly claws), worn paler
  // toward the tip. (Mixed toward 0x6a5e52 / 0xd2c4a8 the bare horn, lit by the sun without the fur's self-shadowing,
  // rendered pale ivory along its whole length, ~(148, 139, 126) median, where photos show dark horn with
  // lighter tips. The dark base still reads against the ground the claws lie on.)
  return { base: mix3(c, srgb(0x2a2420), 0.6), tip: mix3(c, srgb(0xcdbfa6), 0.7) };
}

function palette(p) {
  const base = COATS[p.coat] || COATS.dark;
  const k = p.coatWarmth || 0, l = p.coatLightness || 0, juv = p.juv || 0;
  const cub = srgb(CUB).map((c) => c * (p.coat === 'black' ? 0.2 : p.coat === 'blonde' ? 1.5 : p.coat === 'grizzled' ? 1.2 : 1));
  const out = { ag: base.ag };
  for (const [key, hex] of Object.entries(base)) {
    if (key === 'ag') continue;
    let c = srgb(hex);
    if (key !== 'claw') c = [c[0] * (1 + 0.1 * k + l), c[1] * (1 + 0.02 * k + l), c[2] * (1 - 0.12 * k + l)];
    // (photos of brown bears in neutral light read greyer than the swatches: desaturate a fifth)
    // (the head more, per coat (FACE_DESAT): face1 / face2 / tq1 medians, forehead (156, 138, 116) / (198, 164, 149) /
    // (177, 156, 133), R/B 1.33-1.34, saturation 0.25; the render's red / dark faces at a third were an even orange-brown,
    // R/B 1.8-1.9. The blonde's head stays golden like its hump (front3: forehead R/B 2.1, saturation 0.5):
    // greyed, it was a grey mask framed by the golden ruff)
    if (key !== 'claw') { const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; c = c.map((x) => x + (y - x) * (/^(head|face|muzzle)$/.test(key) && !(p.coat === 'black' && key === 'muzzle') ? FACE_DESAT[p.coat] ?? 0.6 : 0.22)); }
    // cubs: the pattern is mostly washed into the uniform natal coat (legs stay darker)
    const keep = /leg|earRim|claw/.test(key) ? 0.55 : /muzzle/.test(key) ? 0.4 : 0.15;
    if (juv > 0 && key !== 'claw') c = mix3(c, cub, juv * (1 - keep));
    out[key] = c;
  }
  return out;
}

export function bearCoat(ctx) {
  const { model, rig, pos, nrm, regionOf: partOf, weights, nV, params } = ctx;
  // the head's mesh cell (regions.js): the mouth interior is painted only deeper than a cell or so inside
  // the other part, so the facets of the lip line never show it with the mouth shut
  const cellH = 0.0036 * (ctx.Q?.res || 1), mouthIn = Math.max(0.004, 1.3 * cellH);
  const { BONES, AXIAL } = rig;
  const AX_LEN = weights.axialLengths;
  const C = palette(params);
  const AG = C.ag;
  const juv = params.juv || 0;
  const hw = params.headW || 1, mz = params.muzzle || 1;
  const shag = params.shag ?? 1; // coat length (summer 0.7 .. winter 1.2)
  const bleach = params.bleach ?? 0; // sun-bleached back and head (0..1)
  const collar = params.collar ?? 0; // cub neck collar (0..1)
  const nOff = (params.coatSeed || 0) % 997;
  const { dominant, axialS, skinIndex, skinWeight, limbMember, limbWhich } = weights;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX_LEN[1], sNeckBase = AX_LEN[3], sTailBase = AX_LEN[8];
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  const nosePrims = model.prims.filter((p) => p.tag === 'nose');
  const nostrilPrims = model.prims.filter((p) => p.tag === 'nostril');
  const caninePrims = model.prims.filter((p) => p.tag === 'canine');
  const carpalPrims = model.prims.filter((p) => p.tag === 'carpalpad');
  const jawPrims = model.forPart('jaw').filter((p) => p.tag !== 'canine');
  const bodyPrims = model.forPart('body');
  const headPrims = bodyPrims.filter((p) => p.bone === 'head' && !p.carve && p.tag !== 'canine');
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|femur|tibia|metatarsus|hpaw)/.test(b.name));
  const isPaw = BONES.map((b) => /^(fpaw|hpaw|metacarpus|metatarsus)/.test(b.name));
  const isFront = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw)/.test(b.name));
  // head-local coordinates of a reference-space point (undo head width and muzzle stretch)
  const headLocal = (p) => {
    const x = (p[0] - HEAD_O[0]) / hw, y = p[1] - HEAD_O[1];
    let z = p[2] - HEAD_O[2];
    if (z > MUZZLE_Z0) z = MUZZLE_Z0 + (z - MUZZLE_Z0) / mz;
    return [x, y, z];
  };

  // --- regions per vertex (0 torso, 1 neck, 2 head, 4 tail, 5 ear, 6 jaw) and limb blend
  const region = new Uint8Array(nV);
  const legness = new Float32Array(nV);
  const legBone = new Int16Array(nV).fill(-1);
  for (let v = 0; v < nV; v++) {
    const bn = BONES[dominant[v]].name;
    const p = P(v);
    let lb = -1, lw = 0;
    for (let k = 0; k < 4; k++) {
      const b = skinIndex[v * 4 + k], w = skinWeight[v * 4 + k];
      if (isLimb[b] && w > lw) { lw = w; lb = b; }
    }
    legBone[v] = lb;
    legness[v] = lb >= 0 ? smoothstep(0.15, 0.85, limbMember[v]) : 0;
    if (partOf[v] === 2) region[v] = 6;
    else if (bn.startsWith('ear')) region[v] = 5;
    else if (axialS[v] > sTailBase - 0.01 && bn.startsWith('tail')) region[v] = 4;
    else if (axialS[v] < sOcc + 0.01 || (partOf[v] === 1 && neckS(p[0], p[1], p[2]) > 0.03)) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] >= 2) legness[v] = 0;
  }
  void limbWhich;

  // --- comb (hair flow), bind space. Every field blends continuously (a hard switch in the flow
  // direction parts the shells along a line: it drew dark rings round the face and the neck)
  const segDir = (k) => {
    const K = Math.max(0, Math.min(k, AXIAL.points.length - 2));
    return norm(sub(AXIAL.points[K + 1], AXIAL.points[K]));
  };
  const comb = new Float32Array(nV * 3);
  const earBone = BONES.map((b) => /^ear/.test(b.name));
  // the pinna's frame: its centre, the cup's facing and up (base -> tip)
  const earFrame = (s) => {
    const b = BONES.find((bb) => bb.name === (s > 0 ? 'earL' : 'earR'));
    const up = norm(sub(b.tail, b.head));
    return { b, up, facing: norm([0.6 * s, 0.05, 1]), c: add(b.head, mul(sub(b.tail, b.head), 0.4)) };
  };
  const EARF = { 1: earFrame(1), [-1]: earFrame(-1) };
  const earW = (v) => { let ew = 0; for (let k = 0; k < 4; k++) if (earBone[skinIndex[v * 4 + k]]) ew += skinWeight[v * 4 + k]; return ew; };
  // ear hair lies out from the middle of the pinna: the rim fringe sticks out past the edge (a ragged outline, not a
  // clean circle), the cup's hair grows out of the cup, the back's up and out
  // (the cup's hair grows up across the hollow from its lower margin (face1: the cup filled with paler hair; lying in
  // from the whole margin it swirled into a vortex), the fringe out past the rim, the back's up and out: the flow
  // parts along the rim, as on a real ear)
  const earComb = (p, n) => {
    const E = EARF[p[0] > 0 ? 1 : -1];
    let rv = sub(p, E.c);
    rv = sub(rv, mul(E.facing, dot(rv, E.facing)));
    const radial = len(rv) > 1e-5 ? norm(rv) : E.up;
    const front = dot(n, E.facing);
    const wf = smoothstep(0.15, 0.55, front), wb = smoothstep(-0.1, -0.5, front);
    const out = norm(add(radial, mul(E.up, 0.5 * wb)));
    return norm(add(mul(out, 1 - wf), mul(norm(add(E.up, mul(radial, 0.25))), wf)));
  };
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    let d;
    {
      // body flow: along the axial chain (blended across the joints), hanging down the sides of the
      // body and, on the neck, the ruff hanging down and back
      const seg = weights.segT[v * 2] | 0, tt = weights.segT[v * 2 + 1];
      let db = add(add(segDir(seg), mul(segDir(seg - 1), 1 - smoothstep(0, 0.35, tt))), mul(segDir(seg + 1), smoothstep(0.65, 1, tt)));
      db = norm(db);
      const nk = 1 - smoothstep(sNeckBase - 0.06, sNeckBase + 0.12, axialS[v]);
      // (the chest front and the rump face along the body axis: the axial flow projects to nothing there
      // and the hair parted in a line across the brisket; it hangs down instead)
      const endOn = smoothstep(0.3, 0.8, Math.abs(n[2]));
      db = norm(add(db, [0, -(0.6 * Math.abs(n[0]) + 0.25 * smoothstep(0.1, -0.6, n[1]) + 1.5 * endOn) * (1 - nk) - 0.7 * nk, -0.1 * nk]));
      // head flow: out from the nose over the face and crown; the cheek ruff sweeps back, out and down
      const h = headLocal(p);
      let dh = norm(add(norm(sub(h, [0, -0.01, 0.22])), [0, -0.15, -0.4]));
      const cheekW = smoothstep(0.035, -0.03, h[2]) * smoothstep(0.035, 0.09, Math.abs(h[0]));
      dh = norm(add(dh, mul([Math.sign(h[0] || 1) * 0.5, -0.7, -0.6], cheekW)));
      // round the eye the hair lies away from it, radially (as the lashes and the hair of the lids do)
      {
        const ex = Math.sign(h[0] || 1) * EYE_BASE.c[0];
        const rv = [h[0] - ex, h[1] - EYE_BASE.c[1], h[2] - EYE_BASE.c[2]];
        const dE = len(rv);
        // (close to the lids only, and half way: a full radial flow out to 3 cm parted the hair in a crinkled line in
        // front of the eye, where it met the face's flow back from the nose)
        const wE = 0.6 * (1 - smoothstep(0.013, 0.024, dE));
        if (wE > 0 && dE > 1e-4) dh = norm(add(mul(dh, 1 - wE), mul(norm([rv[0] * hw, rv[1], rv[2]]), wE)));
      }
      const toBody = r === 6 ? 0 : smoothstep(sOcc - 0.05, sOcc + 0.1, axialS[v]);
      d = norm(add(mul(dh, 1 - toBody), mul(db, toBody)));
      const L = legness[v];
      if (L > 0 && legBone[v] >= 0) {
        const lbn = BONES[legBone[v]];
        let dl = norm(sub(lbn.tail, lbn.head));
        if (/^(fpaw|hpaw|metacarpus|metatarsus)/.test(lbn.name)) dl = norm(add(dl, [0, -0.3, 0.6]));
        else dl = norm(add(dl, [0, -0.3, -0.25]));
        d = norm(add(mul(d, 1 - L), mul(dl, L)));
      }
      if (r === 5 || r === 2) {
        const ew = earW(v);
        if (ew > 0.02) d = norm(add(mul(d, 1 - smoothstep(0.15, 0.7, ew)), mul(earComb(p, n), smoothstep(0.15, 0.7, ew))));
      }
    }
    // tousled: the long coat's locks lean a little this way and that (+-~20 deg, ~3 cm locks), so its tufts do not stand
    // in regular rows; at medium the evenly combed neck, shoulders and cheek ruff drew rows of round scale-like tufts,
    // a pine cone (the face, ears and feet keep their flow)
    {
      const hh = headLocal(p);
      const tw = TOUSLE * (r === 6 || r === 5 ? 0 : r === 2 ? smoothstep(0.035, -0.03, hh[2]) * smoothstep(0.03, 0.09, Math.abs(hh[0])) : smoothstep(0.08, 0.18, p[1]));
      if (tw > 0) {
        const q = [p[0] * 32 + nOff, p[1] * 32, p[2] * 32];
        d = norm(add(d, mul([vnoise3(q[0], q[1], q[2]) - 0.5, vnoise3(q[0] + 41.7, q[1], q[2]) - 0.5, vnoise3(q[0], q[1] + 23.1, q[2]) - 0.5], 2 * tw)));
      }
    }
    let t = sub(d, mul(n, dot(d, n)));
    if (len(t) < 1e-4) t = cross(n, [1, 0, 0]);
    t = norm(t);
    comb[v * 3] = t[0]; comb[v * 3 + 1] = t[1]; comb[v * 3 + 2] = t[2];
  }

  // --- per-vertex paint
  const furLen = new Float32Array(nV);
  const tint = new Float32Array(nV * 4);
  // marks are signed distances capped at MARK_FAR everywhere (the shader antialiases with fwidth: a value
  // that jumped from a few mm to 1 at the edge of a band drew a faint line or dashes there)
  const MARK_FAR = 0.02;
  const markSDF = new Float32Array(nV).fill(MARK_FAR);
  const surf = new Float32Array(nV * 4);
  // per-vertex fur-slope limit (furSlope.js: 1 = the default, Infinity = as painted) and hairless fur-id skin
  const slopeV = new Float32Array(nV).fill(1);
  const bareFur = new Uint8Array(nV);
  const g3 = (h, c, rr) => Math.exp(-(((Math.abs(h[0]) - c[0]) / rr[0]) ** 2 + ((h[1] - c[1]) / rr[1]) ** 2 + ((h[2] - c[2]) / rr[2]) ** 2));

  // Head, neck and ear paints are computed separately and blended across their junctions by position
  // (the head and body meshes overlap across the neck cut and cross-fade: a paint that switched by mesh
  // or by a region test drew a hard edge, a dark collar round the neck and a notched patch at the ear
  // bases whenever the nape stretched)
  const bodyPaint = (v, p, n, rb, nz, nz2) => {
    let col, fl, ag, mat = MAT.FUR, mark = MARK_FAR;
    const up = n[1];
    // dorsal: paler guard-hair tips on the back, hump and nape; darker flanks; dark belly
    const dors = smoothstep(-0.15, 0.7, up + 0.3 * nz);
    col = mix3(C.flank, C.back, dors);
    const humpW = smoothstep(0.02, 0.3, p[2]) * smoothstep(0.62, 0.5, p[2]) * smoothstep(0.2, 0.8, up) + (rb === 1 ? 0.7 * smoothstep(0.0, 0.7, up) : 0);
    // (the pale tips vary lock to lock, +-30 %, so the guard-hair locks of the hump, nape and back separate, front3 /
    // tq4; an even tip colour read as plush)
    const tipK = clamp(humpW * 0.75 + 0.35 * bleach * dors, 0, 1);
    col = mix3(col, C.tip, clamp(tipK * (1 + 0.6 * nz2) + 0.15 * nz2 * dors, 0, 1));
    // (a dark band under the pale tips of the hump and nape guard hair, so its locks separate, tq4 / front3)
    ag = mix(AG.back * 0.6, AG.back, dors) + 0.15 * clamp(humpW, 0, 1);
    const vent = smoothstep(-0.1, -0.7, up) * smoothstep(0.62, 0.45, p[1]);
    col = mix3(col, C.belly, vent * 0.85);
    ag *= 1 - 0.8 * vent;
    // hair length: longest on the hump and nape, long flanks, a hanging belly fringe
    // (the belly fringe hangs 12 cm: side1 / side2 / side3 show the belly line at 0.23-0.30 of the hump
    // height; at 9.5 cm the render's was 0.34-0.36)
    fl = mix(0.06, 0.075, smoothstep(-0.2, 0.6, up));
    // (8.5 cm on the hump: at 9.5 cm over the hump's sculpted swell its outline stood up as a mound)
    fl = Math.max(fl, 0.085 * clamp(humpW, 0, 1));
    // (on the brisket and the chest front between the forelegs, skin facing forward, 6.5 cm: seen from the front, a
    // 12 cm fringe there showed the bright ground through its shells as pale horizontal slices; the
    // flanks keep the 12 cm that makes the side silhouette's belly line)
    // (and on the chest's underside between the forelegs, whose fringe hangs into the gap between them)
    const chestFront = Math.max(smoothstep(0.15, 0.5, n[2]) * smoothstep(0.08, 0.22, p[2]), smoothstep(0.04, 0.14, p[2]) * smoothstep(0.14, 0.07, Math.abs(p[0])));
    // (and along the midline of the belly's front half, 8 cm: seen from the front the gap between the forelegs looks along
    // the belly, and its 12 cm fringe hung there edge-on as pale-gapped slices over the floor; the side
    // silhouette's belly line is the flanks' fringe)
    const midFront = smoothstep(0.12, 0.05, Math.abs(p[0])) * smoothstep(-0.2, 0.05, p[2]);
    fl = Math.max(fl, 0.12 * vent * (1 - 0.46 * chestFront) * (1 - 0.35 * midFront));
    if (rb === 1) {
      // neck ruff: long, hanging; darker toward the throat. It starts at the back of the head as long
      // as the crown hair there (4.5 cm) and grows to the ruff (a short ring between them read as a collar)
      // (below the ears and behind the jaw angles 4 cm too, where the cheek ruff ends: in a look turn the neck's side
      // behind the far jaw corner is seen edge-on, and longer hair there stood off as torn dark sheets)
      const sideN = 1 - smoothstep(0.2, 0.6, up);
      // (5.2-5.6 cm at the head, where the crown's 4.5 cm and the cheek ruff's tapered 5-6 cm end: at 2-4 cm the neck behind
      // the head was a trench of short hair between the cheek ruff and the long neck hair, a dark ring round the neck, a
      // collar, in the live page; torn dark sheets there are the shell shadows,
      // which look up at the hair's root, render.shellShadowRoot)
      fl = Math.max(fl, 0.08) * mix(mix(0.7, 0.65, sideN), 1, smoothstep(sOcc + 0.02, sOcc + 0.26, axialS[v]));
      col = mix3(col, C.flank, smoothstep(0.0, -0.6, up) * 0.6);
      // (little agouti on the neck's first 20 cm behind the head: the dark band under the tips is a dark shell layer at 3/4 of
      // the hair's height, and where the neck's long hair is seen edge-on behind the jaw in a look turn that layer showed
      // as torn dark sheets)
      ag *= mix(0.3, 1, smoothstep(sOcc + 0.08, sOcc + 0.3, axialS[v]));
      // (greyed toward the head like the cheek ruff over the neck's first 25 cm, so the face's grey runs into the neck;
      // over 15 cm the grey face ended in a ring, a hood)
      col = desat(col, 0.5 * (FACE_DESAT[params.coat] ?? 0.6) * (1 - smoothstep(sOcc, sOcc + 0.25, axialS[v])));
    }
    if (rb === 4) { fl = 0.05; col = mix3(C.flank, C.back, 0.5); }
    // (lock to lock: +-30 % in length, so the long coat breaks into locks instead of an even pile; +-15 % on the neck's
    // first 15 cm behind the head, whose long locks stood off as sheets behind the jaw corners in look turns)
    // (and by lock along the flow, ~2.5 cm across and ~8 cm long, +-45 %: at medium (16 shells) the evenly long neck and
    // shoulder hair drew rows of round scale-like tufts; locks of unequal length break the rows)
    const lkB = streak(p, [comb[v * 3], comb[v * 3 + 1], comb[v * 3 + 2]], 40, 3.2, 57 + nOff) - 0.5;
    fl *= 1 + (0.3 * nz2 + 0.9 * lkB * smoothstep(0.03, 0.06, fl)) * (rb === 1 ? mix(0.5, 1, smoothstep(sOcc + 0.05, sOcc + 0.2, axialS[v])) : 1);
    // (between the forelegs, under the chest, 4.5 cm and without the lock length noise: seen from the front the 6-9 cm
    // fringe hung into the gap between the forelegs, and the floor and its strands' sheen showed through its shells as a
    // pale banded patch below the chin; tq2 / front2 / front3 show a dark, dense chest there)
    const gapW = smoothstep(0.13, 0.07, Math.abs(p[0])) * smoothstep(0.06, 0.16, p[2]) * smoothstep(0.1, -0.4, n[1]) * smoothstep(0.62, 0.5, p[1]);
    if (gapW > 0) fl = mix(fl, Math.min(fl, 0.045), gapW);
    const L = legness[v];
    if (L > 0) {
      const lb = legBone[v];
      const front = lb >= 0 && isFront[lb];
      // legs darken toward the feet (near black below the elbow / stifle)
      const dark = smoothstep(0.62, 0.3, p[1] + 0.06 * nz);
      let lc = mix3(col, C.leg, dark);
      // (heavy hairy columns, tq2 / front3: the lower legs 5 cm, "sleeves" 9 cm behind the forearm, "trousers"
      // 10 cm behind the thighs; thinner, they read as long bare-looking legs)
      let lf = mix(0.05, 0.07, smoothstep(0.12, 0.45, p[1]));
      if (!front) lf = Math.max(lf, 0.1 * smoothstep(-0.1, -0.7, n[2]) * smoothstep(0.25, 0.5, p[1]));
      else lf = Math.max(lf, 0.09 * smoothstep(-0.2, -0.8, n[2]) * smoothstep(0.12, 0.3, p[1]));
      let la = AG.leg;
      // (short hair over the toes: the claws show their whole length)
      if (lb >= 0 && isPaw[lb]) { lf = mix(0.008, 0.035, smoothstep(0.025, 0.12, p[1])); lc = C.leg; la = 0; }
      col = mix3(col, lc, L);
      ag = mix(ag, la + (AG.back - la) * (1 - dark) * 0.6, L);
      fl = mix(fl, lf, L);
      // pads: bare, matte black leather where the paw meets the ground (the forefoot's palm and toe pads,
      // the whole long sole of the hind foot) and on the carpal pad; the rest of the underside is hairy
      // (the whole bare underside of the wrist flashed as a glossy black ball in every swing)
      if (lb >= 0 && isPaw[lb]) {
        let dc = 1;
        if (front) for (const c of carpalPrims) dc = Math.min(dc, SDFModel.dist(c, p[0], p[1], p[2]));
        const pad = front ? (p[1] < 0.016 && n[1] < -0.55) || (dc < 0.004 && n[1] < -0.2) : p[1] < 0.03 && n[1] < -0.35;
        // (nose leather: pebbled, satin; its id sits next to fur's, so the interpolated material id never
        // passes the mouth's pink at the rim, as skin (4) did)
        if (pad) { mat = MAT.NOSE; col = srgb(0x1c1814); fl = 0; }
        else if (p[1] < 0.035 && n[1] < -0.3) fl = Math.min(fl, 0.008);
      }
    }
    // cub collar: a pale band around the neck base
    if (collar > 0 && (rb === 1 || (rb === 0 && p[2] > 0.3))) {
      const band = Math.exp(-(((p[2] - 0.47 + 0.04 * nz) / 0.06) ** 2)) * smoothstep(0.2, -0.3, up + 0.4 * smoothstep(0.3, 0.9, Math.abs(n[0])));
      col = mix3(col, srgb(COLLAR), clamp(band * collar * 1.3, 0, 0.9));
    }
    if (mat === MAT.FUR) fl *= shag;
    return { col, fl, ag, mat, mark, under: 0.35 };
  };
  const EAR_PALE = srgb(0xd9c3a2);
  const earPaint = (v, p, n) => {
    const E = EARF[p[0] > 0 ? 1 : -1];
    const front = dot(n, E.facing);
    const ht = clamp(dot(sub(p, E.b.head), E.up) / 0.1, 0, 1);
    const nzF = vnoise3(p[0] * 110 + nOff, p[1] * 110, p[2] * 110) - 0.5;
    // distance from the middle of the cup in the ear's plane
    let rv = sub(p, E.c);
    rv = sub(rv, mul(E.facing, dot(rv, E.facing)));
    // the edge of the pinna (where the cup turns into the back), above its buried lower part
    const rim = (1 - smoothstep(0.25, 0.7, Math.abs(front))) * smoothstep(0.2, 0.45, ht);
    const cup = smoothstep(0.2, 0.6, front) * (1 - rim);
    // ears are furred all over in the head colour (a darker ear read as a teddy's cup on a pale head); the fringe
    // round the rim pale-tipped (tq2, tq1, front2), the cup's hollow dark only in its deep middle (face2) and
    // filled with paler hair growing in from its margin (face1, tq2). (A dark cup under a fringe ~15 % paler than
    // the head read as a Mickey Mouse disc)
    const pale = mix3(C.tip, EAR_PALE, 0.15);
    let col = mix3(C.head, C.ear, 0.15);
    col = mix3(col, pale, rim * 0.55);
    // (the dark hollow is the lower middle of the cup, running down into the crown hair, face1 / face2; a round dark
    // middle read as a hole)
    const lat = Math.abs(dot(rv, norm(cross(E.up, E.facing))));
    // (kept off the ear's base: running down to the crown it drew a dark rim / notch round the base)
    const hollow = cup * (1 - smoothstep(0.012, 0.026, lat)) * (1 - smoothstep(0.42, 0.7, ht)) * smoothstep(0.1, 0.28, ht);
    col = mix3(col, mix3(C.head, pale, 0.45), cup * (1 - hollow));
    col = mix3(col, C.earInner, 0.7 * hollow);
    // hair: the back 20 mm, the rim fringe ~33 mm and ragged (+-20 % lock to lock), the cup's margin 22 mm lying in
    // over the hollow, 12 mm in its middle (at 23 mm round a thin pinna the fringe drew the ear as a clean circle, a
    // cup with a smooth thick rim)
    let fl = mix(0.02, 0.033, rim);
    fl = mix(fl, mix(0.022, 0.013, hollow), cup);
    fl *= 1 + 0.4 * nzF;
    // (the rim's fringe and the back's outer band ragged by lock, +-40 % at ~1.5 cm: from behind the evenly long fringe drew
    // the ear as a round disc with a smooth outline; tq2 / side3 show tufted, uneven ear outlines)
    const back = smoothstep(-0.2, -0.6, front) * smoothstep(0.35, 0.7, ht);
    const nzR = vnoise3(p[0] * 65 + 13 + nOff, p[1] * 65, p[2] * 65) - 0.5;
    fl *= 1 + 0.8 * nzR * Math.max(rim, back);
    fl = mix(fl, fl * 1.2, back);
    col = mix3(col, pale, 0.3 * back * smoothstep(-0.1, 0.25, nzR));
    return { col, fl, ag: AG.head * 0.5, mat: MAT.FUR, mark: MARK_FAR, under: 0.35, rim };
  };
  const headPaint = (v, p, n, jaw, nz, nz2) => {
    const h = headLocal(p);
    const nzF = vnoise3(p[0] * 90 + nOff, p[1] * 90, p[2] * 90) - 0.5;
    let col = C.head, ag = AG.head, mat = MAT.FUR, mark = MARK_FAR, fl, nostril = 0, nrim = 0, bareLid = 0;
    // the face grades from the crown into a paler, greyer muzzle; the pale muzzle is the bridge and the
    // front of the snout (face1 / face2): the sides of the face below and behind the eyes stay darker
    // (the paler face colour on the front of the face, fading out over the cheeks: across the whole front half of the head,
    // the cheeks included, the grey face was a round disc framed by the ruff, a balloon round the muzzle in the live page's
    // low sun; face1 / face2 / tq1: the cheeks are the crown's colour)
    const face = smoothstep(-0.02, 0.07, h[2]) * (1 - 0.6 * smoothstep(0.04, 0.085, Math.abs(h[0])));
    col = mix3(col, C.face, face);
    // (graded over 10 cm from between the eyes to the nose, palest on the bridge and round the nose and
    // mouth; the sides of the snout under the eyes stay the face colour: a pale snout all round, sharply
    // bounded under the eyes, read as a teddy's muzzle patch)
    const lat = smoothstep(0.02, 0.05, Math.abs(h[0]));
    const muzz = smoothstep(0.06, 0.16, h[2]) * (1 - 0.7 * lat * smoothstep(0.2, 0.12, h[2]));
    col = mix3(col, C.muzzle, 0.7 * muzz);
    // (mottled lock to lock, lighter and darker locks: face1 / face2 / tq1 show a salt-and-pepper face with the hair's flow
    // in it; the body's 3 cm shade noise left the face an even plush, round 1 cm blotches read as spots on felt: locks are
    // streaks along the comb, ~7 mm across and ~3 cm long)
    const cv = [comb[v * 3], comb[v * 3 + 1], comb[v * 3 + 2]];
    const lock = streak(p, cv, 140, 4.5, 31 + nOff) - 0.5;
    const mot = 0.7 * lock + 0.3 * (vnoise3(p[0] * 110 + 31 + nOff, p[1] * 110, p[2] * 110) - 0.5);
    col = mul(col, 1 + 0.65 * mot * (1 - 0.4 * muzz));
    // (grizzled: pale-tipped guard hairs over a dark band on the forehead and cheeks, face1 / face2 / tq1; stronger in the
    // paler locks)
    ag = clamp(Math.max(ag, 0.7) * (1 - 0.6 * muzz) * (1 + 0.5 * lock), 0, 1);
    // (the long cheek ruff with a third of it: its dark band layer, seen edge-on at the jaw corner, drew torn dark sheets)
    ag *= mix(1, 0.35, smoothstep(0.25, 0.75, smoothstep(0.13, -0.05, h[2]) * smoothstep(-0.02, 0.14, Math.abs(h[0])) * smoothstep(0.125, 0.02, h[1]) * smoothstep(-0.14, -0.06, h[1])));
    // cheeks below and behind the eyes darker (the face is framed by darker hair)
    const cheek = smoothstep(0.045, 0.09, Math.abs(h[0])) * smoothstep(0.11, 0.0, h[2]) * smoothstep(0.045, -0.03, h[1]);
    col = mix3(col, mix3(C.head, C.flank, 0.5), cheek * 0.35);
    // the cheek ruff: long hair from beside and below the eyes back to the jaw angle and the neck
    // (the ruff starts beside and below the eyes: face1 / face2 are a disk of hair 3.1-3.4 x the eye
    // separation wide at eye level)
    // (down to the jaw line: the cheek hair hangs to below the mouth, so the face is widest at and below the
    // eyes, face1 / face2; a ruff ending at the eyes left a round head narrowing to the snout, a teddy's)
    // (it rises from ~2 cm under the eye to 9.5 cm at the jaw angle; over ~5 cm across the cheek it drew a hard edge
    // where the face's short hair met it, from the front a seam down the side of the face: the lateral ramp
    // runs over ~8 cm)
    const ruffW = smoothstep(0.13, -0.05, h[2]) * smoothstep(-0.02, 0.14, Math.abs(h[0])) * smoothstep(0.125, 0.02, h[1]) * smoothstep(-0.14, -0.06, h[1]);
    // (and it takes the neck ruff's colour as it lengthens: the face's grey-brown ending in a ring of the neck's paler,
    // golden-tipped hair drew the face as a disk; front3 / tq1: the hair round the face is the neck's)
    // (greyed half as much as the face: face1 / face2's cheek ruff, saturation 0.13-0.42, against the neck's 0.6-0.8 in the
    // render; the face's grey ending in the neck's saturated red-gold drew a grey mask framed by a ring)
    if (!jaw && ruffW > 0.02) col = mix3(col, desat(bodyPaint(v, p, n, 1, nz, nz2).col, 0.5 * (FACE_DESAT[params.coat] ?? 0.6)), 0.7 * smoothstep(0.1, 0.7, ruffW));
    // dark patches round the eyes, running a little down and forward
    // (a ring of dark hair right round the eye, 2.5 cm, and a darker streak from its front corner down toward
    // the side of the muzzle, face2 / front3: the eyes sit in shadow; a patch centred behind the eye left a pale
    // ring of short hair round a bead)
    const dEye = Math.hypot(Math.abs(h[0]) - EYE_BASE.c[0], h[1] - EYE_BASE.c[1], h[2] - EYE_BASE.c[2]);
    // (darker and wider below the eye: face1 / face2 show the eyes in patches of dark hair as dark as the cheeks or darker,
    // (78, 60, 63) under face2's eye against (113, 86, 77) on its cheek; the render's were as pale as the forehead)
    const eyeDark = Math.max(Math.exp(-((dEye / 0.03) ** 2)), 0.8 * g3(h, [0.036, 0.012, 0.085], [0.014, 0.02, 0.026]), 0.7 * g3(h, [0.048, 0.006, 0.066], [0.02, 0.016, 0.02]));
    col = mix3(col, mix3(C.head, C.leg, 0.8), eyeDark * 0.9);
    // lower jaw and throat a little darker
    // (the lower jaw small, dark and in shadow under the upper lip: face1 / tq1 / front1 show a small dark hairy
    // chin; a paler front read as a pale rounded lower lip under a smile)
    if (jaw) col = mix3(col, mix3(C.face, C.belly, 0.55), 0.75);
    // crown sun-bleached on some individuals
    col = mix3(col, C.tip, bleach * 0.4 * smoothstep(0.2, 0.8, n[1]) * (1 - muzz));
    // fur length (face1 / face2 / face3_profile): tousled strands 2-4 cm on the forehead and the cheeks, growing
    // gradually from the short muzzle out to the cheek ruff and back to the long crown, with the ears sunk in the
    // crown hair. Muzzle 9 mm at the nose, the bridge 13-14 mm between the eyes, the forehead and the face beside
    // and below the eyes 20 mm (they get a little clumping: texture, not curls, render.clumpLen). At 9-12 mm with
    // no clumping the face rendered as a suede mask framed by the long ruff
    // (the snout sleek from just in front of the eyes, the bridge 11 mm: face3_profile / side2 show a smooth snout line;
    // 14-18 mm on its top and sides stood up in 3/4 views as a pale sheet of shells over the far eye)
    fl = mix(0.02, 0.009, smoothstep(0.06, 0.15, h[2]));
    fl = mix(fl, Math.min(fl, 0.011), smoothstep(0.04, 0.012, Math.abs(h[0])) * smoothstep(0.05, 0.09, h[2]) * smoothstep(-0.01, 0.02, h[1]));
    // the forehead grades into the crown over its whole length (42 mm between the ears), ~50 mm round the ear
    // bases (face2, tq2: the lower third of each ear is buried in the crown hair)
    if (!jaw) {
      // (30 mm on the crown: at 42 mm, fully clumped, it drew rows of round tufts between the ears seen from the front,
      // lamb's wool; at 34 mm still rows)
      fl = Math.max(fl, mix(0.02, 0.03, smoothstep(0.045, -0.07, h[2])) * smoothstep(0.015, 0.06, h[1]));
      const dEarB = Math.hypot(Math.abs(h[0]) - 0.122, h[1] - 0.082, h[2] + 0.05);
      fl = Math.max(fl, 0.05 * Math.exp(-((dEarB / 0.045) ** 2)));
    }
    // (the cheek ruff, ruffW above: 9.5 cm at the jaw angle)
    // (tapering to ~5 cm toward the neck cut, where the neck's hair starts at that length: the cheek ruff's 9.5 cm hair
    // ended in a shelf over it, torn dark sheets at the far jaw corner in a look turn)
    // (by lock along the flow, +-45 %: the evenly long ruff drew a grid of round scale-like tufts behind the eye at medium)
    const lkR = streak(p, cv, 55, 3.2, 77 + nOff) - 0.5;
    fl = Math.max(fl, 0.095 * ruffW * mix(1, 0.65, smoothstep(-0.05, -0.14, h[2])) * (1 + 0.9 * lkR * smoothstep(0.2, 0.6, ruffW)));
    if (!jaw) fl = mix(fl, Math.max(fl, 0.045), smoothstep(-0.04, -0.15, h[2]));
    // (the throat skin under the jaw carries the jaw's long hair: 12 mm there beside a 4 cm jaw was a wall)
    if (!jaw) fl = Math.max(fl, mix(0.012, 0.04, smoothstep(0.1, -0.02, h[2])) * smoothstep(-0.03, -0.075, h[1]));
    // (the jaw: the lower lip 12 mm, hanging down over its rim, long under the cheek ruff and toward the throat,
    // 4 cm: a 2 cm jaw under the 7-9 cm ruff stood up as a wall along the jaw line)
    if (jaw) fl = mix(0.012, 0.04, smoothstep(0.1, -0.02, h[2]));
    // round the eyes the face hair is shorter, 12 mm out to ~3 cm from the eye (face3_profile), so the short hair
    // at the lids grows back within ~1 cm (a 2 cm ring of short hair round the eye drew a pale crater)
    const dEyeC = Math.hypot(Math.abs(h[0]) - EYE_BASE.c[0], h[1] - EYE_BASE.c[1], h[2] - EYE_BASE.c[2]);
    fl = Math.min(fl, mix(0.012, 0.1, smoothstep(0.028, 0.048, dEyeC)));
    // (in front of the eye, toward the bridge, shorter still, 5.5 mm at 1.6 cm: the far eye in a 3/4 view is seen past
    // the bridge, and the 12 mm hair there, combed out from the eye, stood off it as pale flaps over the eye)
    const eyeFront = smoothstep(-0.004, 0.008, h[2] - EYE_BASE.c[2]) * (1 - smoothstep(0.024, 0.034, dEyeC));
    fl = Math.min(fl, mix(fl, mix(0.0055, 0.012, smoothstep(0.016, 0.03, dEyeC)), eyeFront));
    // (the upper side of the bridge from the eyes forward ~4 cm, between the bridge's top and the eye: 5 mm, darker, and
    // without the lock-to-lock length noise. In a 3/4 view the snout's silhouette runs along it across the far eye, and its
    // 11-14 mm hair stood off there as a stepped edge of shells over the eye)
    const bSide = smoothstep(0.007, 0.016, Math.abs(h[0])) * (1 - smoothstep(0.04, 0.055, Math.abs(h[0])))
      * smoothstep(0.05, 0.064, h[2]) * (1 - smoothstep(0.105, 0.13, h[2]))
      * smoothstep(-0.012, 0.004, h[1]) * (1 - smoothstep(0.044, 0.058, h[1]));
    fl = Math.min(fl, mix(fl, 0.005, bSide));
    col = mix3(col, mix3(C.head, C.leg, 0.6), 0.4 * bSide * (1 - eyeDark));
    // lock to lock +-25 % at ~1 cm (the body's coat locks; an even length read as a pile)
    fl *= 1 + 0.5 * nzF * (1 - 0.8 * bSide);
    // (the crown and the top of the forehead also by lock, the locks running with the flow: its fully clumped 34 mm hair drew
    // rows of round shingle-like tufts between the ears from the front; with +-45 % about half the locks
    // fall under the 22 mm at which the tufts form fully)
    const crownW = smoothstep(0.015, 0.05, h[1]) * smoothstep(0.07, 0.02, h[2]) * (jaw ? 0 : 1);
    fl *= 1 + 0.55 * lock * crownW;
    // eye rims (dark lid margins)
    // (without eyelid patches, medium and below, the aperture is meshed at the head cell: a lid band one
    // cell wide, dark, so the stepped cut reads as the lid margin instead of lit grey facets)
    const lidW = ctx.Q && !eyePatchesAt(ctx.Q) ? Math.max(0.0018, 0.5 * cellH) : 0.0018;
    for (const e of eyePrims) {
      const de = SDFModel.dist(e, p[0], p[1], p[2]);
      mark = Math.min(mark, Math.abs(de) - Math.max(0.002, lidW));
      // (the lid margin: hairless skin painted black with the fur id, matte like the deep coat: as moist bare dark skin
      // (id 2) it mirrored the sky outdoors, a light blue-grey ring that made the eyes read as glassy marbles in the
      // showcase; the eyeball's cornea keeps the wet catchlight)
      if (Math.abs(de) < lidW) { mat = MAT.FUR; col = srgb(0x0b0908); fl = 0; ag = 0; bareLid = 1; }
      else if (Math.abs(de) < lidW + 0.0015) fl = Math.min(fl, 0.003);
      // (round the eye the hair lies away from it, like the hair of the lids (the comb): 5 mm at the margin, the
      // 12 mm eye-surround hair within ~7 mm; a 2-3 cm ring of 2-3 mm hair rendered as a pale smooth felt, a crater)
      else if (de < lidW + 0.0085) fl = Math.min(fl, mix(0.005, fl, smoothstep(lidW + 0.0015, lidW + 0.0085, de)));
    }
    // nose leather
    let dn = 1;
    for (const q of nosePrims) dn = Math.min(dn, SDFModel.dist(q, p[0], p[1], p[2]));
    // (the crisp rim is a mark band round the pad; a mark over the whole pad painted it and the nostrils one flat
    // mark colour)
    mark = Math.min(mark, Math.max(dn - 0.0045 + Math.max(0, 0.17 - h[2]), 0.0012 - dn));
    // (the leather wraps round the nostrils: the muzzle's pale hair reaching into a nostril's outer corner lit up as a pale
    // glint)
    let dq0 = 1;
    if (h[2] > 0.185 && !jaw) for (const q of nostrilPrims) dq0 = Math.min(dq0, SDFModel.dist(q, p[0], p[1], p[2]));
    if ((dn < 0.0035 || (dq0 < 0.0028 && dn < 0.007)) && h[2] > 0.19) {
      // (face2: a cool dark grey in shade, #282a37, the nostrils near black)
      mat = MAT.NOSE; col = srgb(0x25242a); fl = 0;
      // (the nostrils are openings: black inside, darkest deepest, so they read from the front and below as in
      // face2 even where the carve is shallow)
      let dq = 1;
      for (const q of nostrilPrims) dq = Math.min(dq, SDFModel.dist(q, p[0], p[1], p[2]));
      // (black from ~2 mm outside the carve: the leather's fixed grey on the inner walls of the rims, lit from above, drew
      // a pale lining round the lower half of each opening)
      nostril = smoothstep(0.0026, 0.0006, dq) * smoothstep(0.007, 0.0, dn);
      // (the leather round each nostril matte: its rim, a tight convex edge, caught the light as pale glints)
      nrim = smoothstep(0.0045, 0.001, dq);
      col = mix3(col, srgb(0x040303), nostril);
      // (the shader draws nose leather in its own fixed grey whatever the tint, and bare dark skin (lids, lips) moist
      // with a sharp highlight: two glossy beads. The nostril walls are hairless fur-id skin painted black, which the
      // base pass shades as the deep coat: dark and matte; the id lies next to the leather's)
      if (nostril > 0.5) { mat = MAT.FUR; col = srgb(0x030202); ag = 0; }
      // the groove between the nostrils: a crisp dark line down the lower half of the pad
      mark = Math.min(mark, Math.abs(h[0]) - 0.0011 + 2 * Math.max(0, h[1] + 0.012));
    } else if (dn < 0.008 && h[2] > 0.18) fl = Math.min(fl, 0.003);
    // (short dark hair round the nostrils' outer corners)
    if (mat === MAT.FUR && dq0 < 0.008) { const kq = smoothstep(0.008, 0.003, dq0); fl = Math.min(fl, mix(fl, 0.002, kq)); col = mix3(col, srgb(0x1a1512), 0.8 * kq); }
    if (h[2] > 0.185 && !jaw && mat !== MAT.NOSE) {
      // (a nostril wall reaching past the pad: bare and black like the rest of the nostril)
      let dq = 1;
      for (const q of nostrilPrims) dq = Math.min(dq, SDFModel.dist(q, p[0], p[1], p[2]));
      // (within 2.5 mm of the carve: its smooth subtraction leaves the deep walls 1-2 mm off the carver's own surface, and
      // there they took the muzzle's colour, a brown lining seen through the openings)
      if (dq < 0.0025) { mat = MAT.FUR; fl = 0; nostril = 1; col = srgb(0x030202); ag = 0; }
    }
    // below the pad the groove runs on as a dark philtrum, ~2 cm, fading toward the mouth (face2, face3_profile):
    // a soft dark cleft with the lip hair short along it (a crisp black line to the lip read as a teddy's stitching)
    // (short, soft and dim, the hair left as long as the lip's: a 3 cm black stripe of 3 mm hair down the pale lip read as
    // a drip under the nose; shorter hair there showed as a pale notch)
    // (not on the nostril walls, which are fur-id skin too: the lip's colour mixed into them drew a brown lining)
    if (h[2] > 0.17 && !jaw && mat === MAT.FUR && nostril < 0.5) {
      // (darker and a little wider right under the pad, fading over 1.5 cm: the hair's flow fans out from the pad's lower
      // edge there and a lit strand at the fan's root showed as a pale tick under the pad)
      const along = smoothstep(-0.046, -0.034, h[1]) * smoothstep(-0.016, -0.026, h[1]);
      const cleft = (1 - smoothstep(0.0015, 0.0045, Math.abs(h[0]))) * along;
      col = mix3(col, srgb(0x2a201a), 0.7 * cleft);
      // (the upper lip right under the pad darker, fading down and out: tq1 / face1; the pale lip hair under the
      // septum's point lit up as a pale tab)
      const under = smoothstep(-0.052, -0.034, h[1]) * (1 - smoothstep(0.006, 0.02, Math.abs(h[0])));
      col = mix3(col, mix3(C.face, C.belly, 0.5), 0.6 * under);
    }
    // lips: head vertices near the jaw surface, jaw vertices near the head surface (black lip line)
    // (the bare black lip shows only round the front of the mouth, under the nose: behind the canines the
    // lip hair covers the mouth line back to the corner below the eye; a black line drawn all the way back
    // read as a puppet's mouth, a frown in the low 3/4)
    const lipF = smoothstep(0.08, 0.12, h[2]);
    if (!jaw) {
      const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
      if (dj < -mouthIn) { mat = MAT.MOUTH; col = srgb(0x5e2e30); fl = 0; }
      else if (dj < 0.0015 * lipF) { mat = MAT.DARK_SKIN; col = srgb(0x1a1614); fl = 0; }
      // (toward the mouth line the hair shortens at under 1 mm per mm of skin, however long it is: the lip
      // hair lies over the line without standing up as a wall along it)
      else fl = Math.min(fl, mix(0.006, 0.003, lipF) + 0.85 * Math.max(0, dj - 0.0015 * lipF));
      mark = Math.min(mark, dj - 0.003 * lipF + 0.004 * (1 - lipF));
    } else {
      const dh = SDFModel.evalList(headPrims, p[0], p[1], p[2]);
      if (dh < -mouthIn) { mat = MAT.MOUTH; col = srgb(0x5e2e30); fl = 0; }
      else if (dh < 0.0015 * lipF) { mat = MAT.DARK_SKIN; col = srgb(0x1a1614); fl = 0; }
      else fl = Math.min(fl, mix(0.005, 0.003, lipF) + 0.85 * Math.max(0, dh - 0.0015 * lipF));
      mark = Math.min(mark, dh - 0.003 * lipF + 0.004 * (1 - lipF));
    }
    // (the shells of short, unclumped hair render as a pale smooth felt, much lighter than longer hair of the same
    // colour, whose strands show the darker coat between them: the lid margins and the muzzle a little darker)
    if (mat === MAT.FUR) col = mul(col, mix(0.72, 1, smoothstep(0.003, 0.012, fl)));
    // teeth
    for (const c of caninePrims) if (SDFModel.dist(c, p[0], p[1], p[2]) < 0.0015) { mat = MAT.KERATIN; col = srgb(0xe4dac4); fl = 0; mark = MARK_FAR; }
    void nz;
    return { col, fl, ag, mat, mark, under: 0.3, nostril, nrim, bare: nostril > 0.5 || bareLid > 0 };
  };
  const mixPaint = (a, b, t) => ({
    col: mix3(a.col, b.col, t), fl: mix(a.fl, b.fl, t), ag: mix(a.ag, b.ag, t), mark: Math.min(a.mark, b.mark),
    mat: a.mat === MAT.FUR ? b.mat : a.mat, under: mix(a.under, b.under, t), nostril: Math.max(a.nostril || 0, b.nostril || 0), nrim: Math.max(a.nrim || 0, b.nrim || 0), bare: !!(a.bare || b.bare),
  });

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    const nz = fbm3(p[0] * 5 + nOff, p[1] * 5, p[2] * 5, 3) - 0.5;
    const nz2 = vnoise3(p[0] * 30 + nOff, p[1] * 30, p[2] * 30) - 0.5;
    let o;
    if (r === 6) o = headPaint(v, p, n, true, nz, nz2);
    else {
      // head vs neck by position along the neck (the same for both meshes of the overlap), 10 cm wide
      const hn = r === 4 ? 0 : smoothstep(-0.05, 0.05, neckS(p[0], p[1], p[2]));
      const rb = r === 4 ? 4 : axialS[v] < sNeckBase ? 1 : 0;
      if (hn >= 0.999) o = headPaint(v, p, n, false, nz, nz2);
      else if (hn <= 0.001) o = bodyPaint(v, p, n, rb, nz, nz2);
      else o = mixPaint(bodyPaint(v, p, n, 1, nz, nz2), headPaint(v, p, n, false, nz, nz2), hn);
      // ears: blended into the head by their skin weight
      let ew = 0;
      for (let k = 0; k < 4; k++) if (earBone[skinIndex[v * 4 + k]]) ew += skinWeight[v * 4 + k];
      // (the hair length over a wider band than the colour: the 8-9 cm cheek ruff below the ear falls to the
      // ear's 2 cm without a wall at the ear base)
      if (ew > 0.02) {
        const fl0 = o.fl, ep = earPaint(v, p, n); o = mixPaint(o, ep, smoothstep(0.1, 0.7, ew)); o.fl = mix(fl0, ep.fl, smoothstep(0.02, 0.95, ew));
        // (the rim fringe stays as painted: the fur-slope limit bevelled it down to the back's 20 mm)
        if (ep.rim > 0.4 && ew > 0.6) slopeV[v] = Infinity;
      }
    }
    let { col, fl, ag, mat, mark, under } = o;
    const nostril = o.nostril || 0, nrim = o.nrim || 0;
    if (o.bare && mat === MAT.FUR) bareFur[v] = 1;
    // cubs: fluffy and uniform
    if (juv > 0 && mat === MAT.FUR) {
      fl = mix(fl, Math.max(fl * 0.7, r === 2 || r === 6 ? 0.02 : 0.04), juv);
      ag *= 1 - 0.8 * juv;
    }
    // low-frequency colour variation (patchy moult, sun-bleach) and a finer lock-to-lock shade
    const cvh = fbm3(p[0] * 3 + 5 + nOff, p[1] * 3, p[2] * 3, 2) - 0.5;
    // (grizzled coats: a stronger lock-to-lock speckle of silver-tipped and dark locks)
    const sp = params.coat === 'grizzled' ? 0.2 : 0.15;
    if (mat === MAT.FUR) col = [col[0] * (1 + 0.18 * nz + 0.12 * cvh + sp * nz2), col[1] * (1 + 0.16 * nz + 0.1 * cvh + sp * nz2), col[2] * (1 + 0.12 * nz + 0.04 * cvh + sp * nz2)];
    markSDF[v] = Math.min(MARK_FAR, mark);
    furLen[v] = fl;
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    surf[v * 4 + 2] = mat === MAT.FUR ? clamp(ag * (0.85 + 0.3 * nz2), 0, 1) : 0;
    surf[v * 4 + 3] = mat === MAT.FUR ? under : 0;
    if (mat === MAT.KERATIN) surf[v * 4] = 0.6;
    // (nose leather: pebbled and matte, roughness 0.76: at the shader's default 0.42 it drew a white sky highlight in the
    // showcase, at 0.62 a broad highlight across the top of a glossy dome; the paw pads dry and matte, 0.75)
    // (inside the nostrils and round their rims rough: a satin sheen there drew each nostril as a glossy bowl)
    if (mat === MAT.NOSE) surf[v * 4 + 1] = legBone[v] >= 0 && region[v] < 2 ? -0.75 : -mix(0.76, 0.97, Math.max(nostril, nrim));
  }

  // smooth fur length so the shells do not step (bare skin and the hairless nostril walls stay locked)
  smoothField(furLen, weights.neighbors, 3, (v) => tint[v * 4 + 3] > 0 || bareFur[v] === 1);
  // (the fur-slope limit lets hair painted over 25 mm rise proportionally faster; head hair painted just over it and
  // cut back under it kept that allowance and stood 1.1-1.2 mm per mm above the forehead hair at the ear bases, fur
  // walls: on the head, hair of 25-46 mm (the crown, the ear bases) rises at 1 mm per mm like shorter hair, and the ear's rim fringe is left as
  // painted only where it is over 25 mm)
  // (likewise on the feet and wrists, where the 3.5-5 cm hair of the lower leg meets the short hair of the toes)
  for (let v = 0; v < nV; v++) {
    const r = region[v];
    if (r !== 2 && r !== 5 && r !== 6 && !(legBone[v] >= 0 && pos[v * 3 + 1] < 0.15)) continue;
    const L = furLen[v];
    if (slopeV[v] === Infinity) { if (L < 0.025) slopeV[v] = 1; continue; }
    if (L > 0.025 && L < 0.046) slopeV[v] = Math.min(slopeV[v], 0.025 / L);
  }

  const pattern = new Float32Array(nV).fill(1);
  const patternColor = new Float32Array(nV * 4);
  return { comb, tint, pattern, mark: markSDF, furLen, patternColor, surf, region, furSlope: slopeV };
}
