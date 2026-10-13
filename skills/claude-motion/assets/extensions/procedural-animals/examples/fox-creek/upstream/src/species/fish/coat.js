// Fish coat: scales (material 6, with iridescence) on the body, smooth glossy skin on the scaleless
// head, fins as translucent membranes (material 11: ray phase / position along the ray / opacity in
// `surf`), variant colour schemes (trout spots and pink band, goldfish metallic orange and sarasa
// patches, clownfish bands with black edging, bluegill bars, ear flap and breast), mouth and gills.
import { SDFModel } from '../../core/sdf/sdf.js';
import { finRayCoords } from '../../core/rig/swimmer.js';
import { norm, sub, dot, cross, clamp, smoothstep, mix, rng, fbm3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT, poissonFeatures, featureDistance, smoothField } from '../../core/build/coatKit.js';
import { fishGeo } from './rig.js';
import { CELL, opEdgeU } from './sculpt.js';

const FIN_MAT = MAT.FIN ?? 11;

export function fishCoat(ctx) {
  const { model, pos, nrm, nV, lists, regionOf, regionNames, params, weights } = ctx;
  const G = fishGeo(params);
  const V = G.V, SL = G.SL, H = V.head;
  const key = params.variant;
  const R = rng(4049 + (params.coatSeed || 0));
  const col = {};
  for (const [k, hex] of Object.entries(V.colour)) col[k] = srgb(hex);
  const morph = params.morph || '';
  const shade = params.coatShade || 0;
  const tweak = (c, k = 1) => [c[0] * (1 + shade * 0.12 * k), c[1] * (1 + shade * 0.08 * k), c[2] * (1 + shade * 0.04 * k)];
  const cell = SL * CELL * (V.cellK || 1);

  const comb = new Float32Array(nV * 3);
  const tint = new Float32Array(nV * 4);
  const pattern = new Float32Array(nV).fill(1);
  const patternColor = new Float32Array(nV * 4);
  const mark = new Float32Array(nV).fill(1);
  const furLen = new Float32Array(nV);
  const surf = new Float32Array(nV * 4);
  const kind = new Uint8Array(nV); // 0 body, 1 head, 2 fin, 5 adipose, 6 jaw, 7 ear flap, 8 buccal cavity, 9 lips' cut faces
  const finInfo = new Array(nV);
  const jawRegion = regionNames.indexOf('jaw');

  for (let v = 0; v < nV; v++) {
    const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
    const n = [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
    let best = null, bd = 1e9, carveHit = null;
    for (const pr of lists[v]) {
      const d = SDFModel.dist(pr, p[0], p[1], p[2]);
      if (pr.carve) { if (Math.abs(d) < cell * 0.9 && (!carveHit || Math.abs(d) < carveHit.d)) carveHit = { pr, d: Math.abs(d) }; continue; }
      if (d < bd) { bd = d; best = pr; }
    }
    const u = G.u(p[2]);
    const u1 = clamp(u, 0, 1), e1 = (p[1] - G.yc(u1)) / Math.max(1e-6, G.hd(u1));
    // head (scaleless) in front of the gill cover's free edge, scaled body behind it
    let k = u < opEdgeU(H.op, clamp(e1, -1.2, 1.2)) ? 1 : 0;
    if (regionOf[v] === jawRegion) k = 6;
    if (best && (best.tag === 'fin')) { k = 2; finInfo[v] = { prim: best, rc: finRayCoords(best.fin, p) }; }
    if (best && best.tag === 'adipose') k = 5;
    if (carveHit) {
      const tg = carveHit.pr.tag;
      if ((tg === 'mouthcut' && n[1] < -0.25) || (tg === 'jawcut' && n[1] > 0.3)) k = 9;
      else if (tg === 'mouth') k = 8;
    }
    if (best && best.tag === 'earflap') k = 7;
    kind[v] = k;
    void n;
  }

  // ---- spots (trout on the body and on the dorsal / adipose / caudal fins; bluegill dorsal blotch)
  let spotsF = null;
  if (key === 'trout' || morph === 'sarasa') {
    const sarasa = morph === 'sarasa';
    spotsF = poissonFeatures({
      pos, nrm, nV, R,
      radius: (v) => {
        const k = kind[v];
        const y = pos[v * 3 + 1], u = G.u(pos[v * 3 + 2]);
        if (sarasa) {
          if (k !== 0 && k !== 1) return 0;
          return 0.07 * SL;
        }
        if (k === 2) {
          const fi = finInfo[v];
          const nm = fi.prim.fin.name;
          if (!(nm.startsWith('dorsal') || nm === 'caudal')) return 0;
          return 0.0075 * SL;
        }
        if (k !== 0 && k !== 5 && k !== 1) return 0;
        const e = (y - G.yc(u)) / G.hd(u);
        const dens = smoothstep(-0.35, 0.25, e) * (u < 0.1 ? 0 : 1);
        return dens > 0.2 ? (0.0042 + 0.003 * dens) * SL * (params.spotScale || 1) : 0;
      },
      spacing: sarasa ? 1.4 : 1.9, gap: sarasa ? 0.01 * SL : 0.003 * SL, cell: sarasa ? 0.12 * SL : 0.03 * SL,
    });
  }

  for (let v = 0; v < nV; v++) {
    const o3 = v * 3, o4 = v * 4;
    const p = [pos[o3], pos[o3 + 1], pos[o3 + 2]];
    const n = [nrm[o3], nrm[o3 + 1], nrm[o3 + 2]];
    const k = kind[v];
    const u = clamp(G.u(p[2]), 0, 1.3);
    const uc = Math.min(u, 1);
    const e = (p[1] - G.yc(uc)) / Math.max(1e-6, G.hd(uc));
    const noise = fbm3(p[0] * 9 / SL, p[1] * 9 / SL, p[2] * 9 / SL, 3) - 0.5;
    let c, mat = MAT.SCALES, gl = V.gloss, sz = V.scale * SL, irid = V.irid, sw = 0;
    let cm = norm(sub([0, 0, -1], mul(n, -n[2])));
    if (k === 2) {
      // ---------------- fin membrane
      const { prim, rc } = finInfo[v];
      const nm = prim.fin.name;
      cm = rc.dir;
      mat = FIN_MAT;
      c = mix3(col.fin, col.finEdge, 0);
      let opac = key === 'clownfish' ? 0.86 : key === 'bluegill' ? 0.7 : key === 'goldfish' ? 0.55 : 0.6;
      const along = rc.along;
      c = mix3(c, mix3(c, col.back, 0.4), smoothstep(0.5, 0.0, along) * 0.5);
      if (key === 'trout') {
        // white leading edge on the pelvic and anal fins, olive elsewhere
        if (nm.startsWith('pelvic') || nm === 'anal') {
          const lead = nm === 'anal' ? rc.phase < 1.2 : rc.phase < 1.2;
          if (lead) c = mix3(c, col.finEdge, 0.85);
          if (nm.startsWith('pelvic') || nm === 'anal') c = mix3(c, srgb(0xb58a6a), 0.3);
        }
      } else if (key === 'goldfish') {
        c = mix3(col.fin, col.finEdge, smoothstep(0.3, 1, along));
      } else if (key === 'clownfish') {
        // black margins: the outer band of every fin
        const rayLen = 1;
        void rayLen;
        const margin = nm.startsWith('pectoral') ? 0.0 : 0.13 * (params.edgeK ?? 1);
        if (margin > 0) mark[v] = (1 - along - margin) * 0.2 * SL;
      } else if (key === 'bluegill') {
        if (nm === 'dorsal1') {
          // dark blotch at the rear of the soft dorsal fin
          const ph = rc.phase / Math.max(1, prim.fin.rays.length - 1);
          const d = Math.hypot((ph - 0.88) * 0.55, (along - 0.32) * 0.45) - 0.16;
          pattern[v] = d * 0.1 * SL;
          patternColor.set([...srgb(0x1e1e18), 0.9], o4);
        }
        if (nm.startsWith('pelvic') || nm === 'anal') c = mix3(c, srgb(0x3c3a2c), 0.5);
      }
      if (morph === 'black' && key === 'clownfish') c = mix3(c, srgb(0x2a160c), 0.7);
      c = tweak(c, 0.5);
      sw = opac * (0.92 + 0.16 * noise);
      surf[o4] = 0.75; surf[o4 + 1] = rc.phase; surf[o4 + 2] = along; surf[o4 + 3] = sw;
      if (spotsF && (nm.startsWith('dorsal') || nm === 'caudal')) {
        const [d] = featureDistance(spotsF, p, n);
        pattern[v] = d; patternColor.set([...col.spot, 1], o4);
      }
      tint.set([c[0], c[1], c[2], mat], o4);
      comb.set(cm, o3);
      continue;
    }
    if (k === 8) {
      // buccal cavity (seen only when the mouth opens): dark, moist red-brown, not a black hole
      c = srgb(0x4a2622);
      tint.set([c[0], c[1], c[2], MAT.SKIN], o4);
      comb.set(cm, o3);
      surf.set([0.6, 0, 0, 0], o4);
      continue;
    }
    // ---------------- body, head, jaw, adipose
    const up = smoothstep(-0.2, 0.9, e * 0.8 + n[1] * 0.35);
    const lowK = smoothstep(0.2, -0.85, e * 0.85 + n[1] * 0.25);
    if (key === 'trout') {
      c = mix3(col.lower, col.upper, smoothstep(-0.35, 0.3, e));
      c = mix3(c, col.back, smoothstep(0.35, 0.95, up));
      c = mix3(c, col.belly, smoothstep(0.4, 0.95, lowK));
      // the pink lateral band from the gill cover to the tail (and a flush on the cheek)
      const band = (1 - smoothstep(0.1, 0.34, Math.abs(e - 0.02))) * smoothstep(0.16, 0.3, u) * (params.bandK ?? 1);
      c = mix3(c, col.band, band * 0.55);
      if (k === 1 || k === 6) {
        const cheek = (1 - smoothstep(0.2, 0.7, Math.abs(e + 0.1))) * smoothstep(0.1, 0.2, u);
        c = mix3(mix3(c, col.head, 0.25), col.cheek, cheek * 0.6 * (params.bandK ?? 1));
      }
    } else if (key === 'goldfish') {
      c = mix3(col.lower, col.upper, smoothstep(-0.5, 0.3, e));
      c = mix3(c, col.back, smoothstep(0.45, 0.95, up));
      c = mix3(c, col.belly, smoothstep(0.35, 0.95, lowK));
      if (morph === 'white') c = mix3(srgb(0xf1eee6), srgb(0xf6e7c8), smoothstep(0.3, 0.9, up) * 0.4);
      if (morph === 'red') c = mix3(c, srgb(0xd83414), 0.72);
      // common goldfish range from orange-gold to red-orange
      if (morph === 'common') { const t = (params.hueShift ?? 0.5) - 0.5; c = t < 0 ? mix3(c, srgb(0xf5a834), -t * 1.1) : mix3(c, srgb(0xe85a18), t * 0.8); }
    } else if (key === 'clownfish') {
      c = mix3(col.lower, col.upper, smoothstep(-0.5, 0.2, e));
      c = mix3(c, col.back, smoothstep(0.5, 1.0, up) * 0.6);
      c = mix3(c, col.belly, smoothstep(0.5, 1.0, lowK) * 0.5);
      if (morph === 'black') c = mix3(c, srgb(0x1c120c), 0.85);
    } else {
      // bluegill: olive back, brassy flanks, orange / yellow breast, dusky vertical bars, blue cheek
      c = mix3(col.lower, col.upper, smoothstep(-0.5, 0.25, e));
      c = mix3(c, col.back, smoothstep(0.4, 0.95, up));
      const breast = smoothstep(0.1, 0.85, lowK) * (1 - smoothstep(0.35, 0.6, u));
      c = mix3(c, params.sex === 'male' ? col.breast : col.belly, breast * 0.85);
      c = mix3(c, col.belly, smoothstep(0.55, 1, lowK) * (1 - breast) * 0.5);
      const barPh = (u - 0.3) / 0.105;
      const bar = u > 0.28 && u < 0.95 ? Math.pow(0.5 + 0.5 * Math.cos(barPh * 2 * Math.PI), 3) * smoothstep(-0.7, 0.2, e) : 0;
      c = mix3(c, col.spot, bar * 0.45 * (params.barK ?? 1));
      if (k === 1 || k === 6) {
        const streak = 0.5 + 0.5 * Math.sin((p[1] - G.axisY) / SL * 90 + u * 30);
        // two or three blue-violet streaks across the lower cheek and gill cover
        const zone = (1 - smoothstep(0.15, 0.45, Math.abs(e + 0.35))) * smoothstep(0.1, 0.18, u) * (1 - smoothstep(0.28, 0.33, u));
        c = mix3(c, col.cheek, zone * smoothstep(0.55, 0.85, streak) * 0.5);
      }
    }
    if (k === 7) c = col.ear;
    if (col.ear && (k === 0 || k === 1)) {
      // the bluegill's opercular flap: a solid black lobe (~0.08 x 0.05 SL) at the top rear of the gill cover
      const fz = (u - (H.op + 0.03)) / 0.058, fy = (p[1] - (G.yc(H.op) + 0.2 * G.hd(H.op))) / (0.034 * SL);
      const r = fz * fz + fy * fy;
      if (r < 1.25) c = mix3(c, col.ear, smoothstep(1.25, 0.9, r));
    }
    // the lips' cut faces (the lip line at rest, the inside of the lips when the mouth opens): the
    // skin colour a little darker, toward the pale pink of the mouth lining
    if (k === 9) c = mix3(c.map((x) => x * 0.85), srgb(0xb88a80), 0.3);
    // the gill cover's free edge: a soft shading line (the plate overlaps the body there), the head
    // colour darkened ~15 %, fading out where the edge runs under the throat and the nape
    const eC = clamp(e, -1.2, 1.2);
    const du = u - opEdgeU(H.op, eC);
    const edgeLine = (k === 0 || k === 1) ? smoothstep(-0.005, 0.0, du) * (1 - smoothstep(0.0015, 0.008, du)) * (1 - smoothstep(0.62, 0.9, Math.abs(eC + 0.05))) : 0;
    c = c.map((x) => x * (1 - 0.15 * edgeLine));
    c = mix3(c, c.map((x) => x * 0.8), 0.25 * (noise + 0.5));
    c = tweak(c);
    if (k === 5) { sz = 0.0008 * SL; }
    // the head is scaleless skin (tiny scale size: no scale relief, same sheen); behind the gill
    // cover the scales fade in over V.scaleFade of SL (surf.w < 0 lowers their contrast), so large
    // scales (goldfish) do not start at a hard line
    let sw2 = irid;
    if (k === 1 || k === 6 || k === 9) sz = 0.0006 * SL;
    else if (k === 0 && V.scaleFade && du < V.scaleFade) sw2 = mix(-1, irid, clamp(du / V.scaleFade, 0, 1));
    // spots / patches
    if (spotsF && (k === 0 || k === 1 || k === 5 || (k === 6 && morph === 'sarasa'))) {
      const [d] = featureDistance(spotsF, p, n);
      pattern[v] = d;
      patternColor.set([...col.spot, 1], o4);
    }
    if (key === 'clownfish') {
      const bandsSD = clownBands(G, u, e);
      pattern[v] = bandsSD;
      patternColor.set([...col.spot, 1], o4);
      // black edging around the bands
      mark[v] = Math.abs(bandsSD) - 0.012 * SL * (params.edgeK ?? 1);
      if (morph === 'black') patternColor.set([...col.spot, 1], o4);
    }
    tint.set([c[0], c[1], c[2], mat], o4);
    comb.set(cm, o3);
    surf.set([gl, sz, 0, sw2], o4);
  }
  // far from any feature the SDF is 'infinite': clamp it, or its screen-space derivative (the shader's
  // antialiasing width) explodes across the triangles on that border and paints a stepped line
  for (let v = 0; v < nV; v++) { if (pattern[v] > 0.03 * SL) pattern[v] = 0.03 * SL; if (mark[v] > 0.03 * SL) mark[v] = 0.03 * SL; }
  // soften fin opacity / phase noise across the mesh
  const w = new Float32Array(nV);
  for (let v = 0; v < nV; v++) w[v] = surf[v * 4 + 3];
  smoothField(w, weights.neighbors, 1, (v) => kind[v] !== 2);
  for (let v = 0; v < nV; v++) if (kind[v] === 2) surf[v * 4 + 3] = w[v];
  return { comb, tint, pattern, mark, furLen, patternColor, surf, stats: { spots: spotsF ? spotsF.spots.length : 0 } };
}

const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

// clownfish: three white bands (behind the eye curving forward, mid-body with a forward bulge,
// caudal peduncle), as a signed distance in metres (< 0 inside a band)
function clownBands(G, u, e) {
  const SL = G.SL;
  // the forehead and chin stand above the outline table (the sections overlap there): without the
  // clamp the head band's forward curve ran onto the snout as a white smear
  e = clamp(e, -1.1, 1.1);
  const band = (c, w) => (Math.abs(u - c) - w) * SL;
  const b1 = band(0.235 - 0.05 * e * e + 0.01 * e, 0.045);
  const b2 = band(0.53 + 0.07 * Math.exp(-e * e * 4) - 0.03, 0.05 + 0.012 * Math.exp(-e * e * 4));
  const b3 = band(0.905, 0.035);
  return Math.min(b1, b2, b3);
}
void cross; void dot; void mix;
