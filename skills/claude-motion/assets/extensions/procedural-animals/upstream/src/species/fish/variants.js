// Fish variants: four teleost body plans in one species module.
//
// Every length is a fraction of the standard length SL (snout tip -> caudal base). `prof` rows are
// [u (fraction of SL from the snout), top (dorsal outline above the axis), bot (ventral outline below
// the axis), hw (half width)]. Fins are given by their base (u range on the outline) and ray
// lengths / angles in the median plane (u forward, v up; angle 90 = straight up, 180 = straight back).
// Colours are sRGB hex sampled from reference photos.

export const VARIANT_KEYS = ['trout', 'goldfish', 'clownfish', 'bluegill'];

export const VARIANTS = {
  // Rainbow trout (Oncorhynchus mykiss), stream-resident adult: fusiform, small head-scales, spotted.
  trout: {
    name: 'Rainbow trout', latin: 'Oncorhynchus mykiss',
    SL: 0.26, cellK: 1.0,
    prof: [
      [0.012, 0.016, 0.012, 0.012], [0.03, 0.028, 0.022, 0.022], [0.06, 0.0497, 0.0432, 0.034], [0.1, 0.0691, 0.0648, 0.045],
      [0.16, 0.0886, 0.0842, 0.055], [0.23, 0.1048, 0.1004, 0.062], [0.32, 0.1188, 0.1145, 0.066], [0.42, 0.1264, 0.1188, 0.066],
      [0.52, 0.121, 0.1112, 0.061], [0.62, 0.1058, 0.095, 0.053], [0.72, 0.0864, 0.0756, 0.042], [0.82, 0.068, 0.0594, 0.031],
      [0.9, 0.0572, 0.0508, 0.023], [0.96, 0.054, 0.0497, 0.018], [1.0, 0.0562, 0.054, 0.015],
    ],
    head: { op: 0.235, occ: 0.19, eye: { u: 0.072, h: 0.03, r: 0.022 }, mouth: { h: -0.012, gape: 0.105, jawDepth: 0.03, upturn: 0 }, snout: 0.5 },
    fins: {
      dorsal: [{ u0: 0.42, u1: 0.565, n: 12, a0: 118, a1: 150, len: [0.135, 0.05], notch: 0 }],
      adipose: { u0: 0.79, u1: 0.845, h: 0.03 },
      anal: [{ u0: 0.675, u1: 0.79, n: 10, a0: 238, a1: 208, len: [0.11, 0.045] }],
      caudal: { len: 0.23, fork: 0.18, spread: 37, n: 19, lobe: 'pointed' },
      pectoral: { u: 0.245, h: -0.07, len: 0.13, n: 12, sweep: 38, droop: 22, abduct: 28, shape: 'pointed', parentU: 0.25 },
      pelvic: { u: 0.5, len: 0.105, n: 9, sweep: 22, abduct: 25 },
    },
    spineSegs: 12, caudalSegs: 3,
    scale: 0.004, gloss: 0.8, irid: 0.45,
    colour: {
      back: 0x56604a, upper: 0x80846a, band: 0xb66f78, lower: 0xc2c6be, belly: 0xe9e9e2, spot: 0x1d1d19,
      fin: 0x5e5c42, finEdge: 0xe8e6dc, head: 0x6f7456, cheek: 0xc97884, gill: 0x7a1c22,
    },
    eye: { iris: [0x3a3522, 0xb7a76e, 0xd8cc98, 0x2a2618] },
  },

  // Common goldfish (Carassius auratus): deep, round-backed cyprinid, big reflective scales, long dorsal.
  goldfish: {
    name: 'Goldfish', latin: 'Carassius auratus',
    SL: 0.125, cellK: 1.33,
    prof: [
      [0.012, 0.024, 0.016, 0.016], [0.035, 0.05, 0.036, 0.034], [0.07, 0.084, 0.064, 0.056], [0.11, 0.113, 0.093, 0.074],
      [0.17, 0.145, 0.123, 0.088], [0.24, 0.172, 0.15, 0.097], [0.33, 0.194, 0.172, 0.101], [0.43, 0.2, 0.176, 0.097],
      [0.53, 0.19, 0.162, 0.09], [0.63, 0.166, 0.138, 0.078], [0.73, 0.133, 0.109, 0.062], [0.82, 0.102, 0.086, 0.046],
      [0.9, 0.08, 0.071, 0.034], [0.96, 0.071, 0.066, 0.028], [1.0, 0.073, 0.069, 0.024],
    ],
    head: { op: 0.275, occ: 0.22, eye: { u: 0.105, h: 0.046, r: 0.036 }, mouth: { h: -0.008, gape: 0.036, jawDepth: 0.026, upturn: 0.3 }, snout: 0.8 },
    fins: {
      dorsal: [{ u0: 0.42, u1: 0.77, n: 16, a0: 108, a1: 150, len: [0.22, 0.075], firstSpine: true }],
      anal: [{ u0: 0.72, u1: 0.815, n: 7, a0: 238, a1: 214, len: [0.22, 0.12] }],
      caudal: { len: 0.36, fork: 0.45, spread: 38, n: 19, lobe: 'rounded' },
      pectoral: { u: 0.29, h: -0.13, len: 0.23, n: 14, sweep: 40, droop: 26, abduct: 32, shape: 'rounded' },
      pelvic: { u: 0.48, len: 0.23, n: 9, sweep: 26, abduct: 28 },
    },
    spineSegs: 12, caudalSegs: 3,
    scale: 0.052, gloss: 0.6, irid: 0.3, scaleEdge: 0.075, scaleFade: 0.03,
    colour: {
      back: 0xe0691a, upper: 0xee8a1e, band: 0xef8e22, lower: 0xf29a30, belly: 0xf6b25a, spot: 0xf4f1ea,
      fin: 0xf5a04a, finEdge: 0xf6b872, head: 0xee8a1e, cheek: 0xf09a34, gill: 0x8a2020,
    },
    eye: { iris: [0x3b2a0c, 0xa8781f, 0xd8ae52, 0x2c1e08] },
  },

  // Ocellaris clownfish (Amphiprion ocellaris): short oval body, rounded fins, three white bands.
  clownfish: {
    name: 'Clownfish', latin: 'Amphiprion ocellaris',
    SL: 0.068, cellK: 1.45,
    prof: [
      [0.012, 0.03, 0.022, 0.018], [0.035, 0.066, 0.05, 0.04], [0.07, 0.106, 0.084, 0.06], [0.12, 0.145, 0.12, 0.08],
      [0.2, 0.183, 0.16, 0.097], [0.3, 0.206, 0.188, 0.103], [0.4, 0.21, 0.198, 0.1], [0.5, 0.2, 0.19, 0.094],
      [0.6, 0.18, 0.17, 0.084], [0.7, 0.152, 0.142, 0.07], [0.8, 0.118, 0.112, 0.055], [0.9, 0.092, 0.087, 0.04],
      [0.96, 0.083, 0.08, 0.033], [1.0, 0.085, 0.082, 0.029],
    ],
    head: { op: 0.315, occ: 0.26, eye: { u: 0.12, h: 0.055, r: 0.046 }, mouth: { h: -0.02, gape: 0.055, jawDepth: 0.04, upturn: 0.2 }, snout: 0.9 },
    fins: {
      dorsal: [
        { u0: 0.3, u1: 0.55, n: 10, a0: 100, a1: 128, len: [0.1, 0.085], notch: 0.15, spiny: true },
        { u0: 0.55, u1: 0.88, n: 15, a0: 112, a1: 158, len: [0.16, 0.1], round: true },
      ],
      anal: [{ u0: 0.62, u1: 0.85, n: 12, a0: 250, a1: 205, len: [0.15, 0.1], round: true }],
      caudal: { len: 0.24, fork: -0.08, spread: 36, n: 17, lobe: 'rounded' },
      pectoral: { u: 0.33, h: -0.035, len: 0.21, n: 14, sweep: 30, droop: 10, abduct: 35, shape: 'rounded' },
      pelvic: { u: 0.38, len: 0.17, n: 6, sweep: 30, abduct: 30 },
    },
    spineSegs: 12, caudalSegs: 2,
    scale: 0.004, gloss: 0.65, irid: 0.02,
    colour: {
      back: 0xe85a14, upper: 0xf26b1d, band: 0xf26b1d, lower: 0xf47a28, belly: 0xf58a38, spot: 0xf7f7f2,
      fin: 0xf07a25, finEdge: 0x111111, head: 0xf26b1d, cheek: 0xf57d30, gill: 0x7a1c1c,
    },
    eye: { iris: [0x2a1004, 0xc2561a, 0xea8a3c, 0x0c0604] },
  },

  // Bluegill (Lepomis macrochirus): deep, strongly compressed disc, dark ear flap, vertical bars.
  bluegill: {
    name: 'Bluegill', latin: 'Lepomis macrochirus',
    SL: 0.155, cellK: 1.38,
    prof: [
      [0.012, 0.03, 0.022, 0.014], [0.035, 0.072, 0.052, 0.028], [0.07, 0.12, 0.09, 0.043], [0.12, 0.168, 0.138, 0.06],
      [0.2, 0.218, 0.196, 0.075], [0.3, 0.254, 0.228, 0.083], [0.4, 0.262, 0.238, 0.083], [0.5, 0.25, 0.224, 0.078],
      [0.6, 0.222, 0.196, 0.07], [0.7, 0.178, 0.156, 0.058], [0.8, 0.124, 0.11, 0.044], [0.88, 0.087, 0.078, 0.033],
      [0.95, 0.07, 0.065, 0.026], [1.0, 0.07, 0.067, 0.022],
    ],
    head: { op: 0.315, occ: 0.25, eye: { u: 0.118, h: 0.065, r: 0.042 }, mouth: { h: -0.01, gape: 0.05, jawDepth: 0.035, upturn: 0.25 }, snout: 0.85, earFlap: 0.055 },
    fins: {
      dorsal: [
        { u0: 0.36, u1: 0.6, n: 10, a0: 104, a1: 125, len: [0.13, 0.12], notch: 0.25, spiny: true },
        { u0: 0.6, u1: 0.88, n: 12, a0: 112, a1: 160, len: [0.18, 0.1], round: true },
      ],
      anal: [{ u0: 0.6, u1: 0.87, n: 13, a0: 252, a1: 205, len: [0.15, 0.1], round: true }],
      caudal: { len: 0.23, fork: 0.1, spread: 36, n: 17, lobe: 'rounded' },
      pectoral: { u: 0.33, h: -0.03, len: 0.28, n: 13, sweep: 25, droop: -12, abduct: 30, shape: 'sickle' },
      pelvic: { u: 0.36, len: 0.15, n: 6, sweep: 30, abduct: 30, spine: true },
    },
    spineSegs: 12, caudalSegs: 3,
    scale: 0.007, gloss: 0.55, irid: 0.1,
    colour: {
      back: 0x4a5236, upper: 0x6e7250, band: 0x76784e, lower: 0x9a8a50, belly: 0xd8b050, spot: 0x33362a,
      fin: 0x55543c, finEdge: 0x4c4a36, head: 0x666a48, cheek: 0x4a5aa0, gill: 0x6e1c1c, ear: 0x0f0f12, breast: 0xd9722a,
    },
    eye: { iris: [0x1c0a06, 0x5e2418, 0x8a3c26, 0x120604] },
  },
};
