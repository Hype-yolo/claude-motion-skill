// Shark variants: the great white (default) and the blacktip reef shark in one species module
// (createAnimal('shark', { variant: 'blacktip' })).
//
// Every length is a fraction of the total length TL (snout tip -> tip of the upper caudal lobe,
// measured along the body axis). `prof` rows are [u (fraction of TL from the snout), top (dorsal
// outline above the axis), bot (ventral outline below the axis), hw (half width)]. Fin outlines are
// 2D polygons in TL units (see sculpt.js for each fin's frame). Colours are sRGB hex sampled from the
// reference photos.

export const VARIANT_KEYS = ['white', 'blacktip'];

export const VARIANTS = {
  // Great white shark (Carcharodon carcharias), adult female: spindle-shaped, conical snout, near
  // symmetric lunate tail with a caudal keel, tiny second dorsal and anal fins.
  white: {
    name: 'Great white shark', latin: 'Carcharodon carcharias',
    TL: 4.5, cellK: 1.0,
    prof: [
      [0.004, 0.004, 0.003, 0.005], [0.02, 0.019, 0.013, 0.02], [0.045, 0.034, 0.028, 0.04], [0.08, 0.048, 0.043, 0.059],
      [0.13, 0.062, 0.057, 0.074], [0.19, 0.075, 0.07, 0.081], [0.26, 0.085, 0.08, 0.084], [0.33, 0.091, 0.083, 0.085],
      [0.4, 0.09, 0.08, 0.082], [0.47, 0.083, 0.071, 0.074], [0.55, 0.07, 0.057, 0.062], [0.63, 0.053, 0.042, 0.047],
      [0.7, 0.039, 0.031, 0.036], [0.75, 0.029, 0.023, 0.03], [0.8, 0.022, 0.019, 0.027],
    ],
    // head landmarks: occ = spine0 (the rigid head ends behind the gill slits), eye (u, e = height
    // as a fraction of the half depth, r = radius / TL), mouth: front of the gape on the underside
    // (uF), corner (uC, eC), lower-jaw depth, nostril
    head: {
      occ: 0.21, eye: { u: 0.066, e: 0.3, r: 0.0058 }, snoutY: 0.004,
      mouth: { uF: 0.047, uC: 0.1, eC: -0.42, jawDepth: 0.03, smile: 0.35 },
      gills: { u0: 0.185, u1: 0.258, n: 5, e0: -0.62, e1: 0.5, lean: 0.012 },
      nostril: { u: 0.028, e: -0.62 },
    },
    precaudal: 0.8,
    fins: {
      // first dorsal: points (du back from the origin, dv up from the back) in TL
      dorsal1: { u: 0.365, poly: [[0, -0.02], [0, 0], [0.018, 0.04], [0.035, 0.078], [0.049, 0.103], [0.058, 0.108], [0.063, 0.1], [0.064, 0.072], [0.072, 0.04], [0.088, 0.016], [0.108, 0.004], [0.1, -0.02]], thick: 0.014 },
      dorsal2: { u: 0.71, poly: [[0, -0.01], [0, 0], [0.006, 0.012], [0.012, 0.016], [0.016, 0.01], [0.026, 0.002], [0.024, -0.01]], thick: 0.006 },
      anal: { u: 0.725, poly: [[0, 0.01], [0, 0], [0.006, -0.012], [0.012, -0.016], [0.016, -0.01], [0.026, -0.002], [0.024, 0.01]], thick: 0.006 },
      // caudal: upper / lower lobe length and angle (deg from the axis), fork depth, keel
      caudal: { up: 0.245, upAng: 40, low: 0.185, lowAng: -46, fork: 0.085, notch: 0, chord: 0.05, keel: 0.012, thick: 0.0105 },
      // pectoral: base (u, e on the flank), span (anterior margin) / TL, sweep back / droop / abduct
      // (deg), outline in (s along the span 0..1, c chordwise in TL, + = leading edge)
      pectoral: {
        u: 0.262, e: -0.55, len: 0.19, sweep: 42, droop: 26, abduct: 50, thick: 0.0095,
        poly: [[-0.02, 0.05], [0.25, 0.042], [0.55, 0.026], [0.8, 0.004], [0.93, -0.014], [1.0, -0.03], [0.985, -0.034], [0.9, -0.033], [0.8, -0.031], [0.55, -0.034], [0.3, -0.042], [0.12, -0.05], [0.02, -0.058], [-0.02, -0.05]],
      },
      pelvic: { u: 0.6, len: 0.07, abduct: 26, thick: 0.008, poly: [[-0.05, 0.035], [0.4, 0.028], [0.8, 0.01], [1.0, -0.006], [0.9, -0.018], [0.4, -0.02], [-0.05, -0.024]] },
      clasper: 0.075,
    },
    spineSegs: 12, caudalSegs: 3,
    denticle: 0.0012, gloss: 0.26,
    colour: {
      back: 0x757b7f, flank: 0x8e9497, belly: 0xf0efea, boundary: 0xa9aeb0, finTip: 0x19191b,
      finUnder: 0xdedcd6, gum: 0xa87a7a, mouth: 0x4a3436, tooth: 0xf1ece0, gill: 0x2a2224, scar: 0xb8bcbc,
      freckle: 0x3c4248,
      tones: [[0x757b7f, 0.45], [0x7e7a70, 0.35], [0x676e74, 0.2]],
    },
    eye: { iris: [0x07080a, 0x101820, 0x1a2430, 0x040506], sclera: 0xd6d6d0, pupil: [0.72, 0.82], lids: 'none' },
    boundary: { e: -0.12, rag: 0.12 },
  },

  // Blacktip reef shark (Carcharhinus melanopterus): slender, short broadly rounded snout, large
  // first dorsal over the pectoral free tips, heterocercal tail with a terminal lobe, black fin tips.
  blacktip: {
    name: 'Blacktip reef shark', latin: 'Carcharhinus melanopterus',
    TL: 1.3, cellK: 1.15,
    prof: [
      [0.004, 0.004, 0.003, 0.009], [0.02, 0.014, 0.011, 0.025], [0.045, 0.024, 0.021, 0.036], [0.08, 0.034, 0.031, 0.045],
      [0.13, 0.045, 0.042, 0.053], [0.19, 0.056, 0.052, 0.058], [0.26, 0.068, 0.064, 0.062], [0.33, 0.077, 0.07, 0.065],
      [0.4, 0.078, 0.069, 0.064], [0.47, 0.073, 0.062, 0.059], [0.55, 0.058, 0.048, 0.048], [0.63, 0.046, 0.037, 0.038],
      [0.7, 0.034, 0.027, 0.027], [0.75, 0.025, 0.02, 0.02], [0.78, 0.021, 0.018, 0.017],
    ],
    head: {
      occ: 0.2, eye: { u: 0.07, e: 0.28, r: 0.0078 }, snoutY: 0.002,
      mouth: { uF: 0.052, uC: 0.098, eC: -0.55, jawDepth: 0.026, smile: 0.15 },
      gills: { u0: 0.2, u1: 0.25, n: 5, e0: -0.45, e1: 0.25, lean: 0.006 },
      nostril: { u: 0.03, e: -0.6 },
    },
    precaudal: 0.785,
    fins: {
      dorsal1: { u: 0.39, poly: [[0, -0.02], [0, 0], [0.024, 0.042], [0.046, 0.08], [0.064, 0.11], [0.074, 0.118], [0.08, 0.11], [0.08, 0.078], [0.086, 0.044], [0.1, 0.02], [0.122, 0.006], [0.112, -0.02]], thick: 0.011 },
      dorsal2: { u: 0.72, poly: [[0, -0.01], [0, 0], [0.01, 0.024], [0.017, 0.034], [0.023, 0.03], [0.026, 0.012], [0.04, 0.004], [0.036, -0.01]], thick: 0.006 },
      anal: { u: 0.735, poly: [[0, 0.01], [0, 0], [0.01, -0.024], [0.017, -0.032], [0.023, -0.028], [0.026, -0.012], [0.04, -0.004], [0.036, 0.01]], thick: 0.006 },
      caudal: { up: 0.265, upAng: 29, low: 0.145, lowAng: -52, fork: 0.07, notch: 0.035, chord: 0.045, keel: 0, thick: 0.0075 },
      pectoral: {
        u: 0.28, e: -0.62, len: 0.175, sweep: 44, droop: 30, abduct: 52, thick: 0.0085,
        poly: [[-0.02, 0.045], [0.25, 0.04], [0.55, 0.027], [0.8, 0.007], [0.93, -0.01], [1.0, -0.026], [0.985, -0.031], [0.9, -0.03], [0.8, -0.029], [0.55, -0.03], [0.3, -0.036], [0.12, -0.042], [0.02, -0.05], [-0.02, -0.044]],
      },
      pelvic: { u: 0.6, len: 0.075, abduct: 28, thick: 0.0065, poly: [[-0.05, 0.035], [0.4, 0.028], [0.8, 0.01], [1.0, -0.008], [0.9, -0.02], [0.4, -0.022], [-0.05, -0.026]] },
      clasper: 0.085,
    },
    spineSegs: 12, caudalSegs: 3,
    denticle: 0.0006, gloss: 0.28,
    colour: {
      back: 0x817e77, flank: 0x9d9b95, belly: 0xf1f0ec, boundary: 0xc6c5c0, finTip: 0x111112,
      finUnder: 0xe4e3de, gum: 0xa88078, mouth: 0x4a3434, tooth: 0xf1ece0, gill: 0x3a3634, scar: 0xb4b3ae,
      paleBand: 0xd2d0ca, freckle: 0x6a6964, flankBand: 0x6e6d68,
      // grey with a faint bronze cast (#8a8476 rendered sandy tan / khaki
      // in the warm showcase light)
      tones: [[0x817e77, 0.5], [0x857f75, 0.3], [0x7b7c7a, 0.2]],
    },
    eye: { iris: [0x1c1f18, 0x6f7564, 0x8f9480, 0x2a2d24], sclera: 0x9a9a92, pupil: [0.35, 0.7], lids: 'bird' },
    boundary: { e: -0.3, rag: 0.03 },
  },
};
