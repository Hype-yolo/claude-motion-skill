// The chicken's plumage and bare parts, baked per vertex: contour-feather shingles (material 9) coloured
// by feather tract (hackle, back, wing bow, breast, fluff, saddle) with per-feather markings (shaft
// streaks, bars, spangles; surf.z < 0, marking colour in patternColor), a soft down haze that is long
// in the fluffy underparts and drumsticks, hair-like lanceolate hackles and saddle on roosters, bare
// glossy red skin on the face, comb and wattles (material 4), red or white earlobes, a horn-yellow
// keratin bill and claws, and scaled shanks and toes (material 6). Colours per breed and sex are in
// palette() (sampled from the reference photos and breed standards).
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, add, mul, clamp, smoothstep, mix, fbm3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT } from '../../core/build/coatKit.js';

// feather marking modes (shader: coatMaterial.js, material 9, surf.z = -(mode + amount))
export const MARK = { lace: 0, bar: 1, shaft: 2, spangle: 3 };
const markZ = (mode, amt) => -(mode + clamp(amt, 0, 0.98));

const C = (hex) => srgb(hex);
export function palette(p = {}) {
  const breed = p.breed || 'red', male = p.sex === 'male', juv = p.age === 'juvenile';
  const skin = { comb: C(0xc41f2a), wattle: C(0xb81d24), face: C(0xcc3a42), lobe: C(0xbd2e38), lobeWhite: C(0xece6da) };
  const P = {
    red: male
      ? { body: C(0x7a2c12), back: C(0x9c3f16), hackle: C(0xc8741e), hackleTip: C(0xe0a040), saddle: C(0xc05a18), bow: C(0x6e2410), breast: C(0x1a1410), fluff: C(0x2a2420), tail: C(0x10171a), tailIrid: 0.7, flight: C(0x2a2018), flightEdge: C(0x8a4a22), leg: C(0xd8b04a), bill: C(0xcfae6a), lobe: 'red', marks: [] }
      : { body: C(0x9c5a2c), back: C(0x98562a), hackle: C(0xb67434), hackleTip: C(0xc4843e), saddle: C(0x9c5a2c), bow: C(0x8a4a24), breast: C(0xa4602e), fluff: C(0xd6bf98), tail: C(0x3e2416), tailIrid: 0.1, flight: C(0x5e3820), flightEdge: C(0xa06c3e), leg: C(0xdcb44a), bill: C(0xd8b876), lobe: 'red', marks: [{ mode: MARK.shaft, amt: 0.6, col: C(0x4e2612), where: ['hackle', 'head'] }, { mode: MARK.lace, amt: 0.4, col: C(0xc89458), where: ['back', 'wing', 'body'] }] },
    leghorn: { body: C(0xefede6), back: C(0xefede6), hackle: C(0xf2f0ea), hackleTip: C(0xf4f2ec), saddle: C(0xf1efe8), bow: C(0xece9e1), breast: C(0xf0eee7), fluff: C(0xf3f2ee), tail: C(0xeeece5), tailIrid: 0, flight: C(0xebe8df), flightEdge: C(0xf1efe8), leg: C(0xe6c34a), bill: C(0xe6c86a), lobe: 'white', marks: [] },
    australorp: { body: C(0x141619), back: C(0x131518), hackle: C(0x15171a), hackleTip: C(0x17191c), saddle: C(0x141619), bow: C(0x131518), breast: C(0x16181b), fluff: C(0x34363a), tail: C(0x101214), tailIrid: 0.8, flight: C(0x111214), flightEdge: C(0x161719), leg: C(0x2c2e32), bill: C(0x2e2e30), lobe: 'red', marks: [], irid: 0.75 },
    barred: { body: C(0xdcdcd4), back: C(0xd8d8d0), hackle: C(0xdedfd8), hackleTip: C(0xe2e2dc), saddle: C(0xdcdcd4), bow: C(0xd8d8d0), breast: C(0xdcdcd4), fluff: C(0xcacac2), tail: C(0xcfcfc8), tailIrid: 0, flight: C(0xb8b8b0), flightEdge: C(0xd0d0c8), leg: C(0xe2bf4c), bill: C(0xe0c262), lobe: 'red', marks: [{ mode: MARK.bar, amt: male ? 0.78 : 0.92, col: C(0x1c1c1e), where: 'all' }], barred: true },
    buff: { body: C(0xcf9a52), back: C(0xcb944c), hackle: C(0xd6a45c), hackleTip: C(0xdcae66), saddle: C(0xd0984e), bow: C(0xc68e48), breast: C(0xd09a54), fluff: C(0xe0c08a), tail: C(0xb67e3c), tailIrid: 0, flight: C(0xbd8743), flightEdge: C(0xd2a05a), leg: C(0xe6cfbe), bill: C(0xe0c8a2), lobe: 'red', marks: [] },
    speckled: { body: C(0x6a2c16), back: C(0x6a2c16), hackle: C(0x7a3518), hackleTip: C(0x8a4020), saddle: C(0x6e2e16), bow: C(0x622814), breast: C(0x6e2e16), fluff: C(0xb8a088), tail: C(0x1c1614), tailIrid: 0.4, flight: C(0x3c2014), flightEdge: C(0xe8e2d6), leg: C(0xe3cbbd), bill: C(0xd8c6a0), lobe: 'red', marks: [{ mode: MARK.spangle, amt: 0.8, col: C(0xf2eee6), where: 'all' }], spangled: true },
  };
  const out = { ...(P[breed] || P.red), ...skin, breed, male };
  if (!male && breed === 'red') out.tail = C(0x4a2a16);
  // chicks: down only (yellow, black or chipmunk-striped), pale legs and bill, no comb
  if (juv) {
    const down = {
      red: { body: C(0xd7b77a), back: C(0x8a6238), stripe: C(0x6b4726), fluff: C(0xeedca2) },
      leghorn: { body: C(0xf2e08a), back: C(0xf0dc84), fluff: C(0xf6ea9e) },
      buff: { body: C(0xf0d488), back: C(0xecce80), fluff: C(0xf6e4a2) },
      australorp: { body: C(0x1a1a1c), back: C(0x161618), fluff: C(0xd8d0b0) },
      barred: { body: C(0x1c1c1e), back: C(0x18181a), fluff: C(0x5a5a58), spot: C(0xf0ecd8) },
      speckled: { body: C(0x7a5836), back: C(0x5e3f24), stripe: C(0x4a2e1a), fluff: C(0xdcc49a) },
    }[breed] || { body: C(0xf2e08a), back: C(0xf0dc84), fluff: C(0xf6ea9e) };
    Object.assign(out, down, { hackle: down.body, hackleTip: down.body, saddle: down.back, bow: down.back, breast: down.fluff, tail: down.back, flight: mix3(down.back, down.body, 0.3), flightEdge: down.body, tailIrid: 0, marks: [], leg: C(0xe9c98a), bill: C(0xd9bc8c), juv: true });
  }
  if (p.tone) for (const k of ['body', 'back', 'hackle', 'hackleTip', 'saddle', 'bow', 'breast', 'tail', 'flight']) out[k] = out[k].map((x) => x * p.tone);
  return out;
}

export function chickenCoat(ctx) {
  const { model, rig, pos, nrm, regionOf, regionNames, weights, nV, params } = ctx;
  const { BONES, J } = rig;
  const form = params.form || {};
  const Pal = palette(params);
  const male = params.sex === 'male' && !Pal.juv;
  const comb = new Float32Array(nV * 3), tint = new Float32Array(nV * 4), surf = new Float32Array(nV * 4);
  const furLen = new Float32Array(nV), mark = new Float32Array(nV).fill(1), pattern = new Float32Array(nV).fill(1), patCol = new Float32Array(nV * 4);
  const boneName = BONES.map((b) => b.name);
  const tagged = (...t) => model.prims.filter((p) => t.includes(p.tag));
  const billP = tagged('bill'), mandP = model.forPart('jaw');
  const eyeP = tagged('eyesocket'), clawP = tagged('claw'), spurP = tagged('spur');
  const combP = tagged('comb'), wattleP = tagged('wattle'), lobeP = tagged('earlobe');
  const legP = tagged('tarsus', 'toe', 'pad', 'hock', 'spur', 'shank');
  const minD = (list, p) => { let d = 1e9; for (const q of list) d = Math.min(d, SDFModel.dist(q, p[0], p[1], p[2])); return d; };
  const HO = rig.headOrigin, hk = form.headK ?? 1;
  const axialPts = rig.AXIAL.points;
  const axialDir = (p) => {
    let best = 1e9, dir = [0, 0, -1];
    for (let i = 0; i < axialPts.length - 1; i++) {
      const a = axialPts[i], b = axialPts[i + 1], ab = sub(b, a), l2 = dot(ab, ab);
      const t = clamp(dot(sub(p, a), ab) / l2, 0, 1);
      const q = add(a, mul(ab, t)), d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      if (d < best) { best = d; dir = norm(ab); }
    }
    return dir;
  };
  const lobeCol = Pal.lobe === 'white' ? Pal.lobeWhite : Pal.lobe;
  const marks = Pal.marks || [];
  const irid0 = Pal.irid ?? 0.1;
  const neckTop = J.occiput[1], neckBot = J.neckBase[1];
  for (let v = 0; v < nV; v++) {
    const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]], n = [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
    const bn = boneName[weights.dominant[v]] || '';
    const region = regionNames[regionOf[v]];
    let col = Pal.body, mat = MAT.FEATHER, fl = 0.004, gloss = 0.4, size = 0.022, irid = irid0 * 0.3, mz = 0;
    let flow = axialDir(p), mcol = null;
    const h = [(p[0] - HO[0]) / hk, (p[1] - HO[1]) / hk, (p[2] - HO[2]) / hk];
    const up = n[1];
    let tract = 'body';
    if (region === 'jaw' || bn === 'jaw') {
      mat = MAT.KERATIN; col = Pal.bill; fl = 0; gloss = 0.5; size = 0; irid = 0; flow = [0, 0, 1];
      if (minD(billP, p) < 0.0005 && h[2] < 0.035) { mat = MAT.MOUTH; col = srgb(0xc98a86); }
    } else if (bn === 'head' || region === 'head') {
      // head: feathered crown and nape, bare red face, comb, wattles, earlobes, bill
      // (grading into the neck's hackles toward the nape: no seam at the head / body cut)
      const rn = smoothstep(0.016, 0.034, Math.hypot(h[0] * 0.6, h[1], h[2]));
      col = mix3(Pal.hackle, Pal.hackleTip, 0.6); size = mix(0.006, male ? 0.014 : 0.016, rn); fl = mix(0.0025, male ? 0.009 : 0.005, rn); gloss = mix(0.35, male ? 0.55 : 0.4, rn); irid = irid0 * 0.35;
      flow = norm([0, -0.35, -1]);
      if (Math.abs(h[0]) > 0.006) flow = norm([h[0] * 10, -0.5, -1]);
      tract = 'head';
      const dB = minD(billP, p), dC = combP.length ? minD(combP, p) : 1, dW = wattleP.length ? minD(wattleP, p) : 1, dL = lobeP.length ? minD(lobeP, p) : 1;
      const cvh = fbm3(p[0] * 700, p[1] * 700, p[2] * 700, 2) - 0.5;
      const bare = (col2, g2) => { mat = MAT.SKIN; col = col2; fl = 0; gloss = g2; size = 0; irid = 0; tract = 'bare'; };
      if (dB < 0.0012 && h[2] > 0.0195 - 0.35 * Math.min(0, h[1] + 0.004)) { mat = MAT.KERATIN; col = Pal.bill; fl = 0; gloss = 0.55; irid = 0; size = 0; flow = [0, 0, 1]; tract = 'bill'; }
      else if (dC < 0.0012) { bare(Pal.comb, 0.55); flow = [0, 1, 0]; }
      else if (dW < 0.0012) { bare(Pal.wattle, 0.6); flow = [0, -1, 0]; }
      else if (dL < 0.0009) { bare(lobeCol, 0.5); }
      else if (!Pal.juv && h[2] > -0.0095 + 0.0015 * cvh && h[2] < 0.03 && h[1] < 0.0048 - 60 * Math.max(0, h[2] - 0.006) ** 2 - 40 * Math.max(0, -0.001 - h[2]) ** 2 + 0.0008 * cvh && h[1] > -0.022 && Math.abs(h[0]) > 0.0024) {
        // bare facial skin with sparse bristles; feathered at its rear edge
        bare(Pal.face, 0.45);
        fl = 0.0012 * smoothstep(-0.004, -0.009, h[2]);
      }
      // the eye ring: bare skin at the lid margin
      for (const e of eyeP) {
        const de = SDFModel.dist(e, p[0], p[1], p[2]);
        if (Math.abs(de) < 0.0011) { mat = MAT.DARK_SKIN; col = Pal.juv ? srgb(0x3a3230) : mix3(Pal.face, srgb(0x40181a), 0.5); fl = 0; tract = 'bare'; }
      }
      if (Pal.juv && tract === 'head') { mat = MAT.FUR; fl = 0.007; size = 0.004; col = mix3(Pal.body, Pal.fluff, 0.3); gloss = 0.2; }
    } else if (/^(tarsus|toe)/.test(bn) || (bn.startsWith('tibia') && minD(legP, p) < 0.0009)) {
      // scaled shank and toes: large scutes down the front, small reticulate scales behind
      mat = MAT.SCALES; col = Pal.leg; fl = 0; gloss = 0.4; irid = 0; tract = 'leg';
      const front = bn.startsWith('tarsus') ? smoothstep(-0.2, 0.6, n[2]) : 0.5;
      size = mix(0.0022, 0.0042, front);
      flow = [0, -1, 0];
      if (/^toe/.test(bn)) { const b = BONES[weights.dominant[v]]; flow = norm(sub(b.tail, b.head)); size = 0.0028; }
      if (minD(clawP, p) < 0.0005) { mat = MAT.KERATIN; col = mix3(Pal.leg, srgb(0x6a6056), 0.5); gloss = 0.6; size = 0; }
      if (spurP.length && minD(spurP, p) < 0.0006) { mat = MAT.KERATIN; col = mix3(Pal.leg, srgb(0x5a5048), 0.45); gloss = 0.6; size = 0; }
    } else if (bn.startsWith('tibia') || bn.startsWith('femur')) {
      // drumstick: soft fluffy feathers pointing down the leg
      col = mix3(Pal.fluff, Pal.body, Pal.juv ? 0.4 : 0.55); fl = Pal.juv ? 0.009 : 0.008; size = 0.016; gloss = 0.3; irid = 0; tract = 'fluff';
      flow = [0, -1, -0.3];
    } else if (/^(humerus|ulna|hand)/.test(bn)) {
      // wing coverts: lie toward the trailing edge; the bow (lesser coverts) is darker on red breeds
      const b = BONES[weights.dominant[v]];
      const d = norm(sub(b.tail, b.head));
      const sL = b.side === 'R' ? 'R' : 'L';
      let wn = norm(cross(sub(J['elbow' + sL], J['shoulder' + sL]), sub(J['wrist' + sL], J['elbow' + sL])));
      if (wn[1] < 0) wn = mul(wn, -1);
      const s = b.side === 'R' ? -1 : 1;
      flow = mul(norm(cross(wn, d)), s);
      if (!Pal.juv && /^(ulna|hand)/.test(bn)) {
        // the forearm's coverts lie back and down along the folded flight feathers, as the greater
        // covert cards along the shield's rim (coverts.js), not straight across the forearm
        const dU = norm(sub(J['wrist' + sL], J['elbow' + sL])), tU = mul(norm(cross(wn, dU)), s);
        flow = norm(add(mul(dU, -0.64), mul(tU, 0.77)));
      }
      size = 0.02; fl = 0.003; tract = 'wing';
      const top = dot(n, wn);
      col = top < 0 ? mix3(Pal.fluff, Pal.body, 0.5) : Pal.bow;
      irid = top < 0 ? 0 : irid0 * 0.8;
      // a chick's wing is down in the colour of the down on its bed (the folded wing lies on the flank's
      // brown: its pale underside and dark bow showed as a lens and a dark knob at the wrist), the
      // underwing a little lighter; as long as the down around it
      if (Pal.juv) { const L = chickWingDownLook(params); col = top < 0 ? L.under : L.top; fl = top < 0 ? L.furUnder : L.fur; mat = MAT.FUR; size = L.size / (params.size || 1); gloss = L.gloss; irid = 0; }
    } else {
      // body tracts
      const dorsal = smoothstep(-0.25, 0.45, up);
      const ny = (p[1] - neckBot) / Math.max(1e-3, neckTop - neckBot);
      if (bn.startsWith('neck') || (bn === 'chest' && ny > -0.25 && p[2] > J.synsacrum[2])) {
        // hackles: narrow feathers flowing down the neck and over the shoulders
        tract = 'hackle';
        col = mix3(Pal.hackle, Pal.hackleTip, smoothstep(0.2, 1, ny) * 0.6);
        size = male ? 0.014 : 0.016; fl = male ? 0.009 : 0.005; gloss = male ? 0.55 : 0.4; irid = irid0 * 0.35;
        // the breast below the hackles (roosters: black breast)
        if (up < -0.1 && p[2] > J.neckBase[2]) { col = mix3(col, Pal.breast, smoothstep(-0.1, -0.5, up)); tract = 'breast'; }
      } else {
        col = mix3(Pal.breast, Pal.back, dorsal);
        size = p[2] > 0.02 ? 0.02 : 0.024;
        fl = mix(0.007, 0.0035, dorsal); gloss = mix(0.3, 0.45, dorsal);
        irid = irid0 * mix(0.3, 0.9, dorsal);
        tract = dorsal > 0.5 ? 'back' : 'breast';
        // underparts: fluffy, light
        const under = smoothstep(0.2, -0.5, up) * smoothstep(0.175, 0.13, p[1]);
        col = mix3(col, Pal.fluff, under * (male && Pal.breed === 'red' ? 0.4 : 0.85));
        fl = mix(fl, Pal.juv ? 0.01 : 0.012, under);
        if (under > 0.5) tract = 'fluff';
        // saddle / rump: the back rising into the tail
        const sw = smoothstep(J.synsacrum[2] + 0.015, J.synsacrum[2] - 0.045, p[2]) * smoothstep(-0.35, 0.25, up) * (bn === 'tail' ? 0 : 1);
        if (sw > 0) {
          col = mix3(col, Pal.saddle, sw);
          if (male) { fl = mix(fl, 0.012, sw); size = mix(size, 0.012, sw); gloss = mix(gloss, 0.55, sw); if (sw > 0.5) tract = 'saddle'; }
        }
        if (bn === 'tail') { col = mix3(Pal.tail, Pal.saddle, 0.35); irid = Pal.tailIrid; tract = 'tail'; }
        // flow: along the body, bending down around the flanks and the breast
        if (up < 0.3) flow = norm(add(flow, [0, -0.7 * (1 - up), 0]));
        if (tract === 'saddle') flow = norm(add(flow, [0, -1.2, 0]));
      }
      if (Pal.juv) {
        // chick down: a soft ball, chipmunk stripes down the back on brown breeds, a pale belly
        // (in a crease whose skin turns down from the ball's radial direction - the wing's bed under the
        // folded wing - by the radial direction: the bed's upper wall showed as a pale band along the wing)
        const rd = norm(sub(p, [0, J.hipL[1] + 0.01, -0.01])), wR = 1 - smoothstep(0.6, 0.95, dot(n, rd));
        const upJ = Math.max(up, mix(up, rd[1], wR)), dorsalJ = smoothstep(-0.25, 0.45, upJ);
        col = mix3(Pal.fluff, Pal.body, smoothstep(-0.6, 0.2, upJ));
        if (dorsalJ > 0.4) col = mix3(col, Pal.back, 0.7);
        if (Pal.stripe && dorsal > 0.55) {
          const st = Math.abs(p[0]);
          const band = smoothstep(0.012, 0.006, Math.abs(st - 0.022)) + smoothstep(0.008, 0.003, st);
          col = mix3(col, Pal.stripe, clamp(band, 0, 1) * 0.85);
        }
        mat = MAT.FUR; fl = 0.012; size = 0.004; gloss = 0.2; irid = 0;
      }
    }
    // chicks: all down (fur shells), no contour feathers yet
    if (Pal.juv && mat === MAT.FEATHER) { mat = MAT.FUR; fl = Math.max(fl, 0.009); }
    // per-feather markings (shader), by tract
    if (mat === MAT.FEATHER && !Pal.juv) {
      for (const mk of marks) {
        if (mk.where !== 'all' && !mk.where.includes(tract)) continue;
        mz = markZ(mk.mode, mk.amt * (tract === 'fluff' ? 0.5 : 1));
        mcol = mk.col;
        break;
      }
    }
    // red roosters: hackle and saddle feathers with a dark centre stripe, black-green tail
    if (male && Pal.breed === 'red' && (tract === 'hackle' || tract === 'saddle')) { mz = markZ(MARK.shaft, 0.35); mcol = srgb(0x3a1a0a); }
    // low-frequency colour variation
    const cv = fbm3(p[0] * 30 + (params.seed || 0), p[1] * 30, p[2] * 30, 3) - 0.5;
    const kv = mat === MAT.FEATHER ? 0.22 : mat === MAT.SKIN ? 0.12 : 0.1;
    col = [col[0] * (1 + kv * cv), col[1] * (1 + kv * cv), col[2] * (1 + kv * 0.8 * cv)];
    // comb: tangent to the surface
    const f = sub(flow, mul(n, dot(flow, n)));
    const fN = norm(Math.hypot(...f) > 1e-6 ? f : cross(n, [1, 0, 0]));
    comb.set(fN, v * 3);
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    furLen[v] = fl;
    surf[v * 4] = gloss; surf[v * 4 + 1] = size * (params.size || 1);
    surf[v * 4 + 2] = mat === MAT.FEATHER ? mz : 0;
    surf[v * 4 + 3] = mat === MAT.FEATHER ? irid : 0;
    if (mcol) { patCol[v * 4] = mcol[0]; patCol[v * 4 + 1] = mcol[1]; patCol[v * 4 + 2] = mcol[2]; patCol[v * 4 + 3] = 0; }
  }
  return { comb, tint, pattern, mark, furLen, surf, patternColor: patCol };
}

// flight-feather card colours per breed: primaries with a lighter outer edge on red birds, black-green
// sickles and tail on red roosters, barred / spangled vanes
export function chickenFeatherColour(params) {
  const Pal = palette(params);
  const male = params.sex === 'male';
  return (kind, i, side, t, c, layer) => {
    const top = layer > 0;
    const covert = kind.endsWith('Covert');
    let rgb = Pal.flight, irid = 0, gloss = 0.4;
    if (kind === 'rectrix' || kind === 'tailCovert') { rgb = Pal.tail; irid = Pal.tailIrid; gloss = 0.5; }
    // (a spangled breed's flight feathers are mahogany edged, white only at the spangled tips)
    if (kind === 'primary' && c < -0.3) rgb = mix3(rgb, Pal.spangled ? mix3(Pal.body, Pal.flightEdge, 0.2) : Pal.flightEdge, 0.35);
    if (kind === 'primary' || kind === 'secondary') gloss = 0.22;
    if (kind === 'secondary' && top) {
      // folded, the secondaries show their outer vanes as a stack of edges below the covert shield:
      // a lighter fringe on each outer vane reads as feathers (a flat dark panel read as one plastic
      // slab); the tertials (innermost) lie on top along the back and are coloured like the coverts
      const lace = Pal.marks?.find((m) => m.mode === MARK.lace)?.col;
      // (each feather darker along its shaft and lighter toward its edges: the overlapping feathers
      // of the panel read one by one, not as a flat slab)
      const ac = Math.abs(c);
      // (a spangled breed's secondaries are mahogany with white tips, not white-edged)
      const edge = Pal.spangled ? mix3(Pal.body, Pal.flightEdge, 0.2) : Pal.flightEdge;
      // (vanes render lighter than the shingled skin around them: a little darker than the coverts)
      if (i >= 7) rgb = mix3(mix3(mix3(Pal.bow, Pal.flight, 0.45), lace || edge, 0.3 * ac), Pal.flight, 0.5 * (1 - ac) * (1 - t * 0.5)).map((x) => x * 0.82);
      else rgb = c < 0 ? mix3(rgb, edge, 0.6) : mix3(rgb, Pal.bow, 0.2);
    }
    if (covert && kind !== 'tailCovert') rgb = mix3(Pal.bow, Pal.body, 0.3);
    // the greater coverts along the folded wing's shield (coverts.js): the shield's colour, a slightly
    // darker base, no light fringe (a row of pale edges read as a comb)
    if (kind === 'wingCovert') rgb = mix3(Pal.bow, Pal.back, 0.3).map((x) => x * (0.7 + 0.12 * t));
    if (kind === 'tailCovert' && male && Pal.breed === 'red') { rgb = Pal.tail; irid = 0.8; }
    if (kind === 'tailCovert' && !male) rgb = mix3(Pal.saddle, Pal.tail, 0.2);
    // barred: light vanes with dark bars across them, drawn in the shader (a few per-vertex bars on a
    // card averaged to a plain grey band)
    let bar = null;
    if (Pal.barred) { rgb = srgb(0xd8d8d0); bar = { rgb: mix3(srgb(0xd8d8d0), srgb(0x1e1e20), male ? 0.66 : 0.78), period: kind === 'primary' || kind === 'rectrix' ? 0.0075 : 0.0062 }; }
    // (a chick's down has no spangles: its palette keeps the breed flag but no feather marks)
    if (Pal.spangled && Pal.marks.length && t > 0.85) rgb = mix3(rgb, Pal.marks[0].col, kind === 'primary' || kind === 'secondary' ? smoothstep(0.85, 1, t) : 1);
    if (!top) rgb = mix3(rgb, srgb(0x9a948c), 0.15);
    const k = 1 + (kind === 'secondary' ? 0.1 : 0.06) * Math.sin(i * 12.9898 + side * 3.1 + t * 2.1);
    return { rgb: [rgb[0] * k, rgb[1] * k, rgb[2] * k], gloss: top ? gloss : 0.3, irid: top ? irid : irid * 0.2, bar };
  };
}

// the greater covert cards on the folded wing (coverts.js) shaded as the shield's contour feathers
// (material FEATHER: big shingles, the wing tract's colour and markings except the lace, which the
// shingle shader would draw across a card; matte: a glossy card caught the sky as a lavender band)
export function chickenWingCovertLook(params) {
  const Pal = palette(params);
  let mz = 0, mcol = null;
  for (const mk of Pal.marks || []) {
    if (mk.mode === MARK.lace) continue;
    if (mk.where !== 'all' && !mk.where.includes('wing')) continue;
    mz = markZ(mk.mode, mk.amt); mcol = mk.col; break;
  }
  // (no fur shells on a card: darker than the shield's base colour, whose down shells darken it)
  // (a rooster's wing is his dark bow colour: mixed with his bright back it read as an orange patch)
  const base = Pal.male ? mix3(Pal.bow, Pal.flight, 0.2) : mix3(Pal.bow, Pal.back, 0.4);
  return { rgb: base.map((x) => x * 0.99), gloss: 0.1, size: 0.035 * (params.size || 1), mz, mcol, irid: Pal.irid ? Pal.irid * 0.35 : 0, fur: 0.003 };
}

// the tertials on the folded wing (index.js restyle: their top layers shaded as contour feathers with down):
// the wing tract's colour and markings, lacing included (they are big enough for the shingle shader's lace)
export function chickenTertialLook(params) {
  const Pal = palette(params), L0 = chickenWingCovertLook(params);
  let mz = L0.mz, mcol = L0.mcol;
  for (const mk of Pal.marks || []) {
    if (mk.where !== 'all' && !mk.where.includes('wing')) continue;
    mz = markZ(mk.mode, mk.amt); mcol = mk.col; break;
  }
  return { ...L0, rgb: L0.rgb.map((x) => x * 1.15), size: 0.022 * (params.size || 1), gloss: 0.3, mz, mcol };
}

// a chick's wing cards restyled as down (wingLook.js downyWing): the top the down of the folded wing's
// bed (back over body), the underside the pale underwing
export function chickWingDownLook(params) {
  const Pal = palette(params);
  const top = mix3(Pal.back, Pal.body, 0.3);
  return { top, under: mix3(top, Pal.fluff, 0.35), fur: 0.012, furUnder: 0.004, furTip: 0.7, size: 0.004 * (params.size || 1), gloss: 0.2 };
}
