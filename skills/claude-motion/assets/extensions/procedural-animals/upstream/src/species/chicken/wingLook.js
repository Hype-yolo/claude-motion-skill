// The folded wing's tertials (sec8-10, the top of the folded stack behind the shield) read as contour
// feathers: their top layers are restyled from vane cards to material FEATHER (the body's shingle shading,
// the wing tract's colour and markings) with the body's down shells (furLen), so the rear of the folded
// wing continues the plumage (as vanes they were one flat, glossy panel). Their undersides stay vanes.
import { MAT } from '../../core/build/coatKit.js';

// the cards of a featherCards block: [{ bone, start, n, top: [start, start + n / 2) }]
export function cardBlocks(fc, boneNames) {
  const out = [];
  let v = 0;
  const nV = fc.nV;
  // runs of one bone; each run holds 1 or 2 cards of equal size (feather, covert)
  const runs = [];
  while (v < nV) {
    const b = fc.skinIndex[v * 4];
    let e = v; while (e < nV && fc.skinIndex[e * 4] === b) e++;
    runs.push([b, v, e]); v = e;
  }
  const cs = Math.min(...runs.map(([, a, e]) => e - a));
  for (const [b, a, e] of runs) for (let k = 0; a + k * cs < e; k++) out.push({ bone: b, name: boneNames[b], covert: k > 0, start: a + k * cs, n: cs });
  return out;
}

export function restyleWing(fc, rig, look) {
  if (!look) return fc;
  const names = rig.BONES.map((b) => b.name);
  for (const c of cardBlocks(fc, names)) {
    const m = /^sec(\d+)[LR]$/.exec(c.name);
    if (!m || c.covert) continue;
    const i = +m[1] - 1;
    if (i < 7) continue;
    for (let v = c.start; v < c.start + c.n / 2; v++) {
      fc.tint.set([look.rgb[0], look.rgb[1], look.rgb[2], MAT.FEATHER], v * 4);
      fc.surf.set([look.gloss, look.size, look.mz, look.irid], v * 4);
      fc.pattern[v] = 1;
      fc.furLen[v] = look.fur ?? 0;
      if (look.mcol) fc.patternColor.set([look.mcol[0], look.mcol[1], look.mcol[2], 0], v * 4);
    }
  }
  return fc;
}

// A chick's wing is down-covered skin with at most a few short pin feathers at its tip: its flight-feather
// cards (narrow pin-feather cards, motion.js feathersFor) are restyled as down, both faces material FUR
// with the down shells of the wing tract around them (the top the colour of the down on the folded wing's
// bed, the underside the pale underwing), so the folded wing reads as part of the ball of down and the
// flapping wing as a small downy wing (as plain vanes they were a pale opaque lens on the down).
// look: { top: rgb, under: rgb, fur (m), furUnder (m, the underside's short down), furTip (fraction of fur left at the tip), size, gloss }
export function downyWing(fc, rig, look) {
  if (!look) return fc;
  const names = rig.BONES.map((b) => b.name);
  for (const c of cardBlocks(fc, names)) {
    if (!/^(pri|sec)\d+[LR]$/.test(c.name)) continue;
    for (let v = c.start; v < c.start + c.n; v++) {
      const top = v < c.start + c.n / 2;
      const t = fc.surf[v * 4 + 3], k = 1 + 0.05 * Math.sin(v * 0.37);
      const rgb = top ? look.top : look.under;
      fc.tint.set([rgb[0] * k, rgb[1] * k, rgb[2] * k, MAT.FUR], v * 4);
      fc.surf.set([look.gloss, look.size, 0, 0], v * 4);
      fc.pattern[v] = 1;
      fc.furLen[v] = (top ? look.fur : look.furUnder ?? look.fur) * (1 - (1 - look.furTip) * t);
      fc.patternColor.set([0, 0, 0, 0], v * 4);
    }
  }
  return fc;
}
