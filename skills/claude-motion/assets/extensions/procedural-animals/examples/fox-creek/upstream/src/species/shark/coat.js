// Shark coat: dermal denticles (material 6 with a sub-millimetre feature size and weak rims: a matte,
// sandpaper skin, no visible scales), countershading with a crisp ragged boundary (the pattern SDF,
// white belly), fin colours (white shark: pale pectoral undersides with black tips; blacktip reef: the
// black tips of every fin and the pale band under the dorsal tip, as crisp marks), the blacktip's
// white flank wedge, gill slits and ampullae pores as marks, seeded scars, gums, mouth and teeth.
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, clamp, smoothstep, rng, fbm3, add, mul, cross } from '../../core/math/vec.js';
import { srgb, mix3, MAT, distPolyline, poissonFeatures, featureDistance, projectToSurface } from '../../core/build/coatKit.js';
import { sharkGeo } from './rig.js';
import { CELL } from './sculpt.js';

// body kinds
const K_BODY = 0, K_FIN = 2, K_MOUTH = 3, K_GILL = 4, K_TOOTH = 5, K_GUM = 6, K_DARK = 8, K_CUT = 9;

export function sharkCoat(ctx) {
  const { pos, nrm, nV, lists, regionOf, regionNames, params } = ctx;
  const G = sharkGeo(params);
  const V = G.V, TL = G.TL, H = V.head;
  const key = params.variant;
  const white = key === 'white';
  const R = rng(7331 + (params.coatSeed || 0));
  const col = {};
  for (const [k, hex] of Object.entries(V.colour)) if (typeof hex === 'number') col[k] = srgb(hex);
  // individual tone: one of the species' dorsal tones, then a small shade shift
  const tones = V.colour.tones;
  const tone = srgb(tones[Math.min(tones.length - 1, params.tone | 0)][0]);
  const shade = params.coatShade || 0;
  const back = tone.map((x) => x * (1 + 0.14 * shade));
  const flank = mix3(col.flank, back, 0.35).map((x) => x * (1 + 0.1 * shade));
  const cell = TL * CELL * (V.cellK || 1);
  // per-individual offsets of the noise fields (ragged boundary, mottling) and of the boundary height
  const ox = ((params.coatSeed || 0) % 997) * 0.731, oy = ((params.coatSeed || 0) % 991) * 0.377;
  const bShift = params.bndShift || 0;

  const comb = new Float32Array(nV * 3);
  const tint = new Float32Array(nV * 4);
  const pattern = new Float32Array(nV).fill(1);
  const patternColor = new Float32Array(nV * 4);
  const mark = new Float32Array(nV).fill(1);
  const furLen = new Float32Array(nV);
  const surf = new Float32Array(nV * 4);
  // the skin without fins and carvers: lines laid out on the outline (G.flank) are projected onto it
  // (the smooth unions of the sections stand a few millimetres proud of the outline)
  const skinPrims = ctx.model.forPart('body').filter((pr) => !pr.carve && (pr.tag === 'head' || pr.tag === 'body' || pr.tag === 'keel'));
  const onSkin = (q) => projectToSurface(skinPrims, q, 4);
  const rJaw = regionNames.indexOf('jaw'), rUT = regionNames.indexOf('uteeth'), rLT = regionNames.indexOf('lteeth');

  // ---- seeded scars (long pale crescents read as marks drawn on the skin):
  // short, thin, faint scratches on the grey flank and head, and on adults a few healed tooth rakes
  // (3-5 short parallel scratches); the blacktip carries at most one or two
  const scars = [];
  const nScar = white ? Math.round((params.scarK ?? 1) * (1.5 + 3.5 * R())) : (R() < 0.35 * (params.scarK ?? 1) ? 1 : 0);
  const addScratch = (u0, e0, s, ang, l, w, k) => {
    const pts = [];
    const n = 4;
    for (let j = 0; j <= n; j++) {
      const f = j / n;
      const du = (Math.cos(ang) * (f - 0.5) * l) / TL;
      const de = (Math.sin(ang) * (f - 0.5) * l) / Math.max(0.01 * TL, G.hd(u0));
      pts.push(onSkin(G.flank(clamp(u0 + du, 0.03, G.pc), clamp(e0 + de, -0.6, 0.95), s)));
    }
    scars.push({ pts, w: pts.map((_, j) => w * (j === 0 || j === n ? 0.35 : 1)), s, k });
  };
  for (let i = 0; i < nScar; i++) {
    const s = R() < 0.5 ? 1 : -1;
    const u0 = 0.1 + 0.55 * R(), e0 = 0.05 + 0.7 * R();
    const ang = (R() - 0.5) * 1.4;
    const w = (0.0011 + 0.0007 * R()) * TL;
    const k = 0.22 + 0.18 * R();
    if (white && R() < 0.3) {
      // healed tooth rake: short parallel scratches across a bite arc
      const nR = 3 + Math.floor(R() * 3), l = (0.008 + 0.006 * R()) * TL, gap = 0.006 * TL;
      for (let j = 0; j < nR; j++) addScratch(u0 + ((j - nR / 2) * gap * Math.cos(ang)) / TL, e0 + ((j - nR / 2) * gap * Math.sin(ang)) / Math.max(0.01 * TL, G.hd(u0)), s, ang + Math.PI / 2, l * (0.8 + 0.4 * R()), w * 0.9, k);
    } else addScratch(u0, e0, s, ang, (0.012 + 0.03 * R()) * TL, w, k);
  }
  // gill slits (polylines on both sides, as in the sculpt)
  const slits = [];
  {
    const Gi = H.gills;
    for (const s of [1, -1]) {
      for (let i = 0; i < Gi.n; i++) {
        const u = Gi.u0 + ((Gi.u1 - Gi.u0) * i) / (Gi.n - 1);
        const len = 1 - 0.18 * Math.abs(i - (Gi.n - 1) * 0.6) / Gi.n;
        const pts = [];
        for (let j = 0; j <= 6; j++) {
          const e = Gi.e0 + ((Gi.e1 - Gi.e0) * len * j) / 6;
          pts.push(onSkin(G.flank(u - Gi.lean * (e - Gi.e0), e, s)));
        }
        const w = Math.max((white ? 0.0013 : 0.0009) * TL, (white ? 0.45 : 0.35) * cell * ((ctx.Q && ctx.Q.res) || 1));
        slits.push({ pts, w: pts.map((_, j) => w * (j === 0 || j === 6 ? 0.45 : 1)) });
      }
    }
  }

  // nostrils (a dark carved cup reads as a second eye): a thin dark oblique slit on the
  // shallow groove, as a crisp mark
  const nostrils = [];
  for (const s of [1, -1]) {
    const c0 = G.flank(H.nostril.u, H.nostril.e, s), ax = norm([s * 0.5, 0, 1]);
    const pts = [-1, -0.5, 0, 0.5, 1].map((f) => onSkin(add(c0, mul(ax, f * 0.0075 * TL))));
    const w = Math.max(0.0007 * TL, 0.3 * cell);
    nostrils.push({ pts, w: pts.map((_, j) => w * (j === 0 || j === 4 ? 0.3 : j === 2 ? 1 : 0.8)) });
  }

  // ---- classify every vertex
  const kind = new Uint8Array(nV);
  const finOf = new Array(nV);
  const wFin = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const reg = regionOf[v];
    if (reg === rUT || reg === rLT) { kind[v] = K_TOOTH; continue; }
    const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
    const n = [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
    let bestF = null, dF = 1e9, dB = 1e9, carveHit = null;
    for (const pr of lists[v]) {
      const d = SDFModel.dist(pr, p[0], p[1], p[2]);
      if (pr.carve) { if (Math.abs(d) < cell * 0.9 && (!carveHit || Math.abs(d) < carveHit.d)) carveHit = { pr, d: Math.abs(d) }; continue; }
      const isFin = pr.tag === 'fin' || pr.tag === 'finCore' || pr.tag === 'clasper';
      if (isFin) { if (d < dF) { dF = d; bestF = pr; } } else if (pr.tag !== 'pecBase' && d < dB) dB = d;
    }
    let k = K_BODY;
    if (bestF) {
      // continuous fin share: the fin colours blend into the body's over a short fillet (no jagged
      // border where the nearest primitive switches)
      finOf[v] = bestF;
      wFin[v] = smoothstep(-0.25, 1, (dB - dF) / (0.012 * TL));
      if (wFin[v] > 0.5) k = K_FIN;
    }
    if (carveHit) {
      const tg = carveHit.pr.tag;
      if (tg === 'gillslit') k = K_BODY;
      else if (tg === 'mouthcut' || tg === 'jawcut') k = G.u(p[2]) > H.mouth.uC + 0.004 ? K_BODY : K_CUT;
      else if (tg === 'mouth') k = K_MOUTH;
      else if (tg === 'eyesocket') k = K_DARK;
      else if (tg === 'nostril') k = K_BODY;
    }
    kind[v] = k;
  }

  // ampullae of Lorenzini: dark pores on the underside and sides of the snout
  const pores = poissonFeatures({
    pos, nrm, nV, R,
    radius: (v) => {
      if (kind[v] !== K_BODY) return 0;
      const u = G.u(pos[v * 3 + 2]);
      if (u > 0.085 || u < 0.006) return 0;
      const e = (pos[v * 3 + 1] - G.yc(u)) / Math.max(1e-6, G.hd(u));
      return e < 0.35 ? (white ? 0.0011 : 0.0012) * TL : 0;
    },
    spacing: 3.2, gap: 0.004 * TL, cell: 0.02 * TL,
  });

  const bnd = V.boundary;
  // boundary height (fraction of the half depth) of the pale belly along the body
  const eBound = (u) => {
    if (white) {
      // from below the eye through the mouth corner, dipping under the pectoral, rising to the peduncle
      const tbl = [[0, -0.9], [0.03, -0.55], [0.06, -0.32], [0.12, -0.3], [0.2, -0.26], [0.28, -0.3], [0.36, -0.14], [0.46, -0.08], [0.56, 0.0], [0.66, 0.02], [0.74, 0.1], [0.8, 0.14]];
      return lerpTable(tbl, u) + bnd.e + 0.12;
    }
    const tbl = [[0, -0.5], [0.08, -0.42], [0.18, -0.4], [0.3, -0.42], [0.45, -0.38], [0.6, -0.3], [0.72, -0.2], [0.8, -0.1]];
    return lerpTable(tbl, u) + bnd.e + 0.3;
  };

  for (let v = 0; v < nV; v++) {
    const o3 = v * 3, o4 = v * 4;
    const p = [pos[o3], pos[o3 + 1], pos[o3 + 2]];
    const n = [nrm[o3], nrm[o3 + 1], nrm[o3 + 2]];
    const k = kind[v];
    const u = clamp(G.u(p[2]), 0, 1.3);
    const uc = Math.min(u, G.pc);
    // height on the flank as a fraction of the half depth (held at a minimum depth at the snout tip,
    // where the section shrinks to a point: the tip is grey above, pale below, not a pale blob)
    const e = (p[1] - G.yc(uc)) / Math.max(G.hd(uc), 0.03 * TL);
    // mottling: broad cloudy patches, smaller blotches and fine flecks (stronger on the back)
    const m1 = fbm3(p[0] * 6 / TL + ox, p[1] * 6 / TL, p[2] * 6 / TL + oy, 3) - 0.5;
    const m2 = fbm3(p[0] * 22 / TL + oy, p[1] * 22 / TL + 4.1, p[2] * 22 / TL + ox, 3) - 0.5;
    const m3 = fbm3(p[0] * 90 / TL + 7.7, p[1] * 90 / TL + ox, p[2] * 90 / TL + oy, 2) - 0.5;
    // denticles lie nose -> tail
    let cm = norm(sub([0, 0, -1], mul(n, -n[2])));
    if (!Number.isFinite(cm[0])) cm = [0, 0, -1];
    let c, mat = MAT.SCALES, gl = V.gloss, sz = V.denticle;
    if (k === K_TOOTH) {
      c = col.tooth;
      tint.set([c[0], c[1], c[2], MAT.KERATIN], o4);
      comb.set([0, 1, 0], o3);
      surf.set([0.75, 0, 0, 0], o4);
      continue;
    }
    if (k === K_MOUTH || k === K_CUT) {
      // (not a red-gummed band) the lip line itself is a dark, neutral crease; only the
      // inside of the mouth, seen when the jaws open, is dark pink
      c = k === K_CUT ? mix3(back.map((x) => x * 0.22), col.mouth, 0.25) : col.mouth;
      tint.set([c[0], c[1], c[2], MAT.SKIN], o4);
      comb.set(cm, o3);
      surf.set([0.6, 0, 0, 0], o4);
      continue;
    }
    if (k === K_GUM) {
      c = col.gum;
      tint.set([c[0], c[1], c[2], MAT.SKIN], o4);
      comb.set(cm, o3);
      surf.set([0.65, 0, 0, 0], o4);
      continue;
    }
    if (k === K_DARK || k === K_GILL) {
      c = k === K_GILL ? col.gill : [0.012, 0.011, 0.011];
      tint.set([c[0], c[1], c[2], MAT.SKIN], o4);
      comb.set(cm, o3);
      surf.set([0.3, 0, 0, 0], o4);
      continue;
    }
    // ---------------- skin: body, head, jaw and fins
    const up = smoothstep(-0.6, 1.0, e * 0.8 + n[1] * 0.45);
    c = mix3(flank, back, up);
    // body pattern: the pale belly below a crisp, ragged boundary
    // (domain-warped noise at three scales: long tongues of grey reaching down, white notches up, and a
    // jagged fine edge; near the peduncle the line breaks up into patches)
    const wq = (fbm3(p[0] * 9 / TL + ox, p[1] * 9 / TL + 2.3, p[2] * 9 / TL + oy, 2) - 0.5) * 0.06 * TL;
    const q0 = p[0] + wq, q1 = p[1] - wq, q2 = p[2] + wq * 1.7;
    const ragK = 1 + 0.8 * smoothstep(0.55, 0.78, uc);
    const rag = ragK * (bnd.rag * (fbm3(q0 * 14 / TL + 3.1 + ox, q1 * 14 / TL + oy, q2 * 14 / TL, 3) - 0.5) * 2
      + bnd.rag * 0.8 * (fbm3(q0 * 38 / TL + oy, q1 * 38 / TL + 1.7, q2 * 38 / TL + ox, 3) - 0.5)
      + bnd.rag * 0.45 * (fbm3(q0 * 95 / TL + 5.3, q1 * 95 / TL + ox, q2 * 95 / TL + oy, 2) - 0.5));
    let belly = (e - (eBound(uc) + rag + bShift * smoothstep(0.08, 0.2, uc))) * Math.max(G.hd(uc), 0.03 * TL) * 0.6;
    const cBody0 = c;
    let cFin = null, bellyFin = 0;
    if (finOf[v] && wFin[v] > 0.001) {
      const pr = finOf[v];
      const nm = pr.finName || 'clasper';
      const f2 = pr.fin2;
      const q = f2 ? sub(p, f2.origin) : [0, 0, 0];
      const a = f2 ? dot(q, f2.u) : 0, b = f2 ? dot(q, f2.v) : 0;
      let polyMaxA = 0, polyMaxB = -1e9, polyMinB = 1e9;
      if (f2) for (const pp of f2.poly) { polyMaxA = Math.max(polyMaxA, pp[0]); polyMaxB = Math.max(polyMaxB, pp[1]); polyMinB = Math.min(polyMinB, pp[1]); }
      cm = norm(sub(cm, mul(n, dot(cm, n))));
      bellyFin = 0.01 * TL;
      if (nm.startsWith('pectoral') || nm.startsWith('pelvic')) {
        // pale undersides of the paired fins: only the flat of the underside, read against the fin's own
        // plane (a test on the world normal wrapped the pale underside round the rounded
        // edge into a pale rim, a fat sausage edge seen from the front). The whole rim stays grey, as on
        // the real fins (the white shark's pectoral underside has a dark margin).
        const nF = norm(cross(f2.u, f2.v));
        const nd = dot(n, nF) * (nF[1] >= 0 ? 1 : -1);
        const wU = smoothstep(-0.6, -0.85, nd);
        c = mix3(mix3(back, flank, 0.15), mix3(c, col.finUnder, white ? 0.9 : 0.8), wU);
        bellyFin = clamp((nd + 0.74) * 0.03 * TL, -0.01 * TL, 0.01 * TL);
        const span = polyMaxA;
        if (white && nm.startsWith('pectoral')) {
          // black blotch at the ventral tip, dusky trailing margin (underside only)
          mark[v] = Math.min(mark[v], Math.max((0.86 * span - a) * 0.5, (nd + 0.74) * 0.03 * TL));
          c = mix3(c, back, smoothstep(0.55, 0.95, a / span) * 0.35 * wU);
        }
        if (!white) mark[v] = Math.min(mark[v], ((nm.startsWith('pelvic') ? 0.72 : 0.8) * span - a) * 0.6);
      } else if (nm === 'dorsal1') {
        c = mix3(back, flank, 0.1);
        if (!white) {
          const hFin = polyMaxB;
          mark[v] = Math.min(mark[v], (0.78 * hFin - b) * 0.6);
          // pale band under the black tip
          c = mix3(c, col.paleBand, (1 - smoothstep(0.08, 0.2, Math.abs(b / hFin - 0.68))) * 0.55);
        }
      } else if (nm === 'dorsal2' || nm === 'anal') {
        c = mix3(back, flank, nm === 'anal' ? 0.6 : 0.1);
        if (!white) mark[v] = Math.min(mark[v], nm === 'anal' ? (b - 0.5 * polyMinB) * 0.6 : (0.55 * polyMaxB - b) * 0.6);
      } else if (nm === 'caudal') {
        c = mix3(back, flank, smoothstep(0.1, -0.15, b / TL) * 0.4);
        if (!white) {
          // black lower lobe tip and a dusky trailing margin
          const tipL = [Math.cos(G.caudal.la) * G.caudal.low * TL, Math.sin(G.caudal.la) * G.caudal.low * TL];
          const dl = Math.hypot(a - tipL[0], b - tipL[1]) - 0.42 * G.caudal.low * TL;
          const tipU = [Math.cos(G.caudal.ua) * G.caudal.up * TL, Math.sin(G.caudal.ua) * G.caudal.up * TL];
          const du = Math.hypot(a - tipU[0], b - tipU[1]) - 0.12 * G.caudal.up * TL;
          mark[v] = Math.min(mark[v], dl * 0.8, du * 0.8);
          const trail = trailDist(f2.poly, a, b);
          mark[v] = Math.min(mark[v], trail - 0.006 * TL);
        } else {
          c = mix3(c, back.map((x) => x * 0.8), 0.3);
        }
      } else {
        // claspers
        c = mix3(col.finUnder, flank, 0.5);
      }
      if (nm === 'clasper') cm = [0, 0, -1];
      cFin = c;
      c = cBody0;
    }
    if (k !== K_FIN) {
      // head and body details: a thin shadow round the eye (the black eye must stand out of the grey)
      const de = Math.hypot(Math.abs(p[0]) - G.eye.x, p[1] - G.eye.y, p[2] - G.eye.z);
      c = mix3(c, back.map((x) => x * 0.6), (1 - smoothstep(G.eye.r * 1.05, G.eye.r * 1.6, de)) * 0.45);
      if (!white) {
        // the white flank wedge: a pale tongue running forward from above the pelvic fins
        const t = clamp((u - 0.36) / 0.3, 0, 1);
        const ec = -0.05 - 0.2 * t;
        const hw = 0.03 + 0.22 * t * t;
        const dw = (Math.abs(e - ec + rag * 0.3) - hw) * G.hd(uc) * 0.6 + (u < 0.36 ? (0.36 - u) * TL * 0.6 : 0) + (u > 0.68 ? (u - 0.68) * TL : 0);
        belly = Math.min(belly, dw);
      }
      // pores: small dark dots shaded into the colour (sub-vertex in size: a soft darkening, no hard mark)
      const [dp] = featureDistance(pores, p, n);
      if (dp < 0.004 * TL) c = mix3(c, c.map((x) => x * 0.6), (1 - smoothstep(-0.0012 * TL, 0.0025 * TL, dp)) * 0.45);
      // white shark: dark freckles on the snout and around the jaws; scattered dark flecks on the back
      if (white) {
        // (5 cm snout blotches read as leopard spots) a few small dark dots
        // along the upper lip only, and faint scattered flecks on the back
        const m4 = fbm3(p[0] * 160 / TL + oy, p[1] * 160 / TL + 2.9, p[2] * 160 / TL + ox, 2) - 0.5;
        const lip = (1 - smoothstep(0.07, 0.1, u)) * smoothstep(0.03, 0.05, u) * (1 - smoothstep(0.08, 0.22, Math.abs(e - (H.mouth.eC + 0.12))));
        const fk = smoothstep(0.3, 0.34, m4) * lip * 0.7 + smoothstep(0.34, 0.37, m3) * 0.12 * smoothstep(0.0, 0.5, e);
        c = mix3(c, col.freckle, clamp(fk, 0, 1) * 0.5);
      } else {
        // blacktip: the dusky band along the flank above the white wedge
        const t = clamp((u - 0.3) / 0.38, 0, 1);
        const db = Math.abs(e - (-0.02 - 0.12 * t + rag * 0.3)) / (0.07 + 0.05 * Math.sin(Math.PI * t));
        c = mix3(c, col.flankBand, (1 - smoothstep(0.6, 1.4, db)) * smoothstep(0.26, 0.4, u) * (1 - smoothstep(0.66, 0.76, u)) * 0.55);
      }
      if (u < H.nostril.u + 0.02) for (const ns of nostrils) mark[v] = Math.min(mark[v], distPolyline(p, ns.pts, ns.w));
      // gill slits
      if (u > H.gills.u0 - 0.03 && u < H.gills.u1 + 0.03) {
        for (const sl of slits) mark[v] = Math.min(mark[v], distPolyline(p, sl.pts, sl.w));
      }
    }
    if (cFin) {
      const w = wFin[v];
      c = mix3(c, cFin, w);
      belly = belly + (bellyFin - belly) * w;
    }
    // scars: pale, slightly glossy scratches
    for (const sc of scars) {
      if (Math.sign(p[0]) !== sc.s && Math.abs(p[0]) > 0.02 * TL) continue;
      const d = distPolyline(p, sc.pts, sc.w);
      if (d < 0.004 * TL) {
        const f = 1 - smoothstep(-0.0004 * TL, 0.0009 * TL, d);
        c = mix3(c, col.scar, f * sc.k);
      }
    }
    // mottling (on the grey, a little on the fins; the pale belly stays clean)
    const dors = 0.5 + 0.5 * smoothstep(-0.4, 0.6, e);
    c = c.map((x) => x * (1 + dors * (0.2 * m1 + 0.1 * m2 + (white ? 0.1 : 0.07) * m3)));
    if (regionOf[v] === rJaw) belly = Math.min(belly, -0.004 * TL + (e + 0.2) * 0.001);
    pattern[v] = belly;
    const bc = mix3(col.belly, col.boundary, smoothstep(-0.03 * TL, 0, belly) * 0.35);
    patternColor.set([...bc, 1], o4);
    tint.set([c[0], c[1], c[2], mat], o4);
    comb.set(cm, o3);
    surf.set([gl, sz * (k === K_FIN ? 0.8 : 1), 0, 0], o4);
  }
  // clamp far SDF values (the shader's antialiasing width comes from their derivatives)
  for (let v = 0; v < nV; v++) {
    if (pattern[v] > 0.02 * TL) pattern[v] = 0.02 * TL;
    if (pattern[v] < -0.02 * TL) pattern[v] = -0.02 * TL;
    if (mark[v] > 0.02 * TL) mark[v] = 0.02 * TL;
    if (mark[v] < -0.02 * TL) mark[v] = -0.02 * TL;
  }
  return { comb, tint, pattern, mark, furLen, patternColor, surf, stats: { scars: scars.length, pores: pores.spots.length } };
}

function lerpTable(tbl, u) {
  if (u <= tbl[0][0]) return tbl[0][1];
  for (let i = 1; i < tbl.length; i++) {
    if (u <= tbl[i][0]) {
      const t = (u - tbl[i - 1][0]) / (tbl[i][0] - tbl[i - 1][0]);
      const s = t * t * (3 - 2 * t);
      return tbl[i - 1][1] + (tbl[i][1] - tbl[i - 1][1]) * s;
    }
  }
  return tbl[tbl.length - 1][1];
}

// distance (2D) from (a, b) to the caudal fin's trailing edge: the part of the outline behind the tips
function trailDist(poly, a, b) {
  let best = 1e9;
  // the trailing edge is the stretch between the upper tip (max b) and the lower tip (min b)
  let iU = 0, iL = 0;
  for (let i = 0; i < poly.length; i++) { if (poly[i][1] > poly[iU][1]) iU = i; if (poly[i][1] < poly[iL][1]) iL = i; }
  for (let i = iU; i < iL; i++) {
    const p = poly[i], q = poly[i + 1];
    const ex = q[0] - p[0], ey = q[1] - p[1];
    const t = clamp(((a - p[0]) * ex + (b - p[1]) * ey) / (ex * ex + ey * ey || 1e-12), 0, 1);
    best = Math.min(best, Math.hypot(a - p[0] - ex * t, b - p[1] - ey * t));
  }
  return best;
}
