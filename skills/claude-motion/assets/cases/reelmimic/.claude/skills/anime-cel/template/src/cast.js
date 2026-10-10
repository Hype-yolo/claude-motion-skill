// cast.js — the anime character system: a shared rig + two original characters (Hina, Ren).
//
//   hina(x, y, u, o) / ren(x, y, u, o) → info      (x, y) = ground point between the feet, u = HEAD HEIGHT in px
//   Heights: Hina ≈ 5.6u, Ren ≈ 5.9u.  Full body in frame: u ≈ 120–150 · knees-up: 200–260 · bust: 380–480
//   · face close-up: 600–900 (then put the camera on the head: info.head gives its screen point).
//
// Every part is built in the character's own units (1 = head height) from a skeleton posed by joint angles, drawn
// as groups that share one outline (see drawGroup in anime.js), so limbs are continuous silhouettes. The head is
// built on a construction (skull sphere + morphing face outline) so it turns front → 3/4 → profile with features
// placed on the skull. See GUIDE.md for the full option list.

const DEG = Math.PI / 180;
const dirA = a => [Math.sin(a), Math.cos(a)];          // angle measured from straight DOWN, positive toward +x
const addV = (p, d, k = 1) => [p[0] + d[0] * k, p[1] + d[1] * k];
const nrm2 = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

// draw fn() in a local frame: ex, ey = the local x/y axes (in the current units), o = origin. Light follows.
function inFrame(ex, ey, o, fn) {
  G.save(); G.transform(ex[0], ex[1], ey[0], ey[1], o[0], o[1]);
  const keep = _L, lx = ex[0] * _L[0] + ex[1] * _L[1], ly = ey[0] * _L[0] + ey[1] * _L[1];
  const sx = Math.hypot(...ex), sy = Math.hypot(...ey); _L = nrm2([lx / sx / sx, ly / sy / sy]);
  fn(); _L = keep; G.restore();
}

// ======================================================================================= expressions
// eye: type ('open' | 'happy' | 'closed' | 'xd' | 'dot' | 'line' | 'white' | 'sparkle' | 'tight' | 'half' | 'swirl'),
//      open (lid 0..1+), squint (lower lid up 0..1), iris (size ×), tilt (+ angry: inner lid corner down, − worried)
// brow: raise (+ up), ang (+ inner end up = worried/sad, − = angry), mouth: see drawMouth, blush 0..1, fx: face marks
const EXPR = {
  neutral:    { eye: { open: 1 }, brow: {}, mouth: 'neutral' },
  smile:      { eye: { open: .92, squint: .22 }, brow: { raise: .01 }, mouth: 'smile', blush: .25 },
  happy:      { eye: { type: 'happy' }, brow: { raise: .03, ang: .02 }, mouth: 'grin', blush: .45 },
  laugh:      { eye: { type: 'happy' }, brow: { raise: .04, ang: .03 }, mouth: 'wide', blush: .5 },
  sad:        { eye: { open: .78, iris: .95, tilt: -.14, look: [0, .45], wet: 1 }, brow: { ang: .07, raise: .01 }, mouth: 'frown' },
  cry:        { eye: { type: 'tight' }, brow: { ang: .08, raise: .01 }, mouth: 'wail', fx: ['tears'], blush: .4 },
  angry:      { eye: { open: .9, tilt: .36, iris: .88, squint: .2 }, brow: { ang: -.13, raise: -.055 }, mouth: 'grit', fx: ['vein'] },
  rage:       { eye: { type: 'white', open: 1.05, tilt: .35 }, brow: { ang: -.1, raise: -.03 }, mouth: 'shout', fx: ['vein', 'steam'] },
  surprised:  { eye: { open: 1.12, iris: .78 }, brow: { raise: .06 }, mouth: 'o' },
  shocked:    { eye: { type: 'white', open: 1.15 }, brow: { raise: .07, ang: .03 }, mouth: 'shout', fx: ['gloom', 'sweat'] },
  scared:     { eye: { open: 1.05, iris: .6, tilt: -.1, shake: 1 }, brow: { ang: .08, raise: .04 }, mouth: 'wavy', fx: ['sweat', 'gloom'] },
  love:       { eye: { type: 'sparkle', open: 1.05, iris: 1.08 }, brow: { raise: .04, ang: .03 }, mouth: 'grin', blush: .9, fx: ['sparkles'] },
  sleepy:     { eye: { type: 'half', open: .38 }, brow: { raise: -.01, ang: .03 }, mouth: 'o', fx: [] },
  deadpan:    { eye: { type: 'dot' }, brow: { raise: 0 }, mouth: 'line' },
  xd:         { eye: { type: 'xd' }, brow: { ang: .05, raise: .02 }, mouth: 'wide', blush: .6 },
  embarrassed:{ eye: { open: .82, look: [-.6, .35], tilt: -.08, wet: .6 }, brow: { ang: .06, raise: .02 }, mouth: 'wavy', blush: 1, fx: ['sweat'] },
  smug:       { eye: { type: 'half', open: .62, squint: .3 }, brow: { raise: .015, ang: -.03 }, mouth: 'cat', blush: .15 },
  determined: { eye: { open: .96, tilt: .22, iris: .95, squint: .1 }, brow: { ang: -.08, raise: -.03 }, mouth: 'set', fx: [] },
  dizzy:      { eye: { type: 'swirl' }, brow: { ang: .06 }, mouth: 'wavy', fx: ['sweat'] },
};
const EXPR_NAMES = Object.keys(EXPR);

// ======================================================================================= designs
// Two original characters. Hina: small, bright, long chestnut hair, cream cardigan. Ren: tall, cool, messy navy
// hair, open blazer. Colours go through tone() (time-of-day tint) when drawn.
const DESIGNS = {
  hina: {
    name: 'hina', line: '#4c2830', lineSoft: '#8a4a4c',
    skin: { b: '#fde9de', s: '#f1bda9', h: '#fff7f2' }, blush: '#f5788c', mouthIn: '#9a3040', tongue: '#e8808a',
    hair: { b: '#94513f', s: '#643230', h: '#c47a5c', spec: '#f4bf97', line: '#4a2327' },
    iris: { top: '#123046', mid: '#2a8390', bot: '#98ead3', pupil: '#0d1a28' },
    eyeW: .205, eyeH: .25, eyeY: .07, eyeR: .385, lash: .036, spikes: 2, browCol: '#6e3a36',
    eyeU: [[-.5, .08], [-.38, -.28], [-.1, -.5], [.22, -.5], [.46, -.3], [.62, -.14]],
    eyeL: [[-.46, .2], [-.2, .42], [.14, .47], [.4, .34], [.5, .14]],
    mouthY: .315, chinY: .465, jawW: 1, faceW: 1, earShow: .5,
    // body (units = head height)
    hipH: 2.8, hipX: .19, shV: 1.37, shX: .39, neckV: 1.64, neckLen: .16, neckW: .155, chest: 1.25,
    ua: 1.02, fa: .9, hl: .54, thigh: 1.38, weight: 'R', shin: 1.3, ankleH: .1,
    torso: [[1.66, .07], [1.6, .24], [1.53, .42], [1.42, .48], [1.3, .46], [1.12, .41], [.92, .37], [.62, .33], [.34, .4], [.2, .42]],
    armW: [.25, .215, .18, .205, .19, .205], legW: [.38, .32, .2, .255, .2, .13],
    clothes: 'hina', hairStyle: 'hina',
    cardigan: { b: '#f4e7ca', s: '#d9c39c', h: '#fffaf0' }, collar: { b: '#fbfbff', s: '#d9dbee' }, ribbon: { b: '#e2485c', s: '#b02f46' },
    skirt: { b: '#353f70', s: '#252c52', h: '#4a5690' }, sock: { b: '#2d3150', s: '#1e2138' }, shoe: { b: '#70402f', s: '#4a2620', h: '#a0684f' },
    hairLen: 1.45,
  },
  ren: {
    name: 'ren', line: '#221e38', lineSoft: '#5a4e70',
    skin: { b: '#f9e2d4', s: '#e4b19e', h: '#fff4ec' }, blush: '#ee7f8e', mouthIn: '#8a2c3c', tongue: '#e07b86',
    hair: { b: '#303656', s: '#1c1f37', h: '#4f5a86', spec: '#8e9dd0', line: '#1a1830' },
    iris: { top: '#262550', mid: '#5a5ea8', bot: '#b2bdf0', pupil: '#14132b' },
    eyeW: .198, eyeH: .148, eyeY: .095, eyeR: .375, lash: .03, spikes: 0, browCol: '#242845', browW: .028, browDrop: -.01, crease: .5,
    eyeU: [[-.5, .0], [-.34, -.36], [-.04, -.48], [.3, -.46], [.52, -.24], [.62, -.1]],
    eyeL: [[-.46, .26], [-.2, .46], [.14, .5], [.42, .38], [.54, .1]],
    mouthY: .345, chinY: .515, jawW: .98, faceW: .97, earShow: 1, irisS: .9,
    hipH: 3.02, hipX: .21, shV: 1.44, shX: .49, neckV: 1.74, neckLen: .15, neckW: .235, chest: 1.32,
    ua: 1.12, fa: .97, hl: .6, thigh: 1.5, weight: 'L', pocketArm: 'L', kneeIn: .22, shin: 1.42, ankleH: .1,
    torso: [[1.76, .09], [1.7, .3], [1.63, .52], [1.52, .6], [1.36, .56], [1.15, .5], [.9, .46], [.6, .44], [.2, .47], [-.12, .5]],
    armW: [.3, .26, .215, .245, .225, .235], legW: [.43, .38, .31, .3, .29, .29],
    clothes: 'ren', hairStyle: 'ren',
    blazer: { b: '#3d4873', s: '#29315a', h: '#5a67a0' }, shirt: { b: '#f6f7fc', s: '#d3d7ea' }, tie: { b: '#2d8f89', s: '#1d6461' },
    pants: { b: '#5a5f73', s: '#42465a', h: '#737a92' }, shoe: { b: '#f4f3f6', s: '#c7c6d6', h: '#ffffff' }, shoeAcc: '#e05a5a',
  },
};

// ======================================================================================= hair data
// A lock = control points [azimuth°, y, r] from root to tip on the skull (azimuth 0 = facing the viewer at turn 0,
// +90 = screen right), w = width, flex = how much it swings. Layer 'front' draws over the face, 'back' behind the
// head and body. Locks that turn behind the head move to the back layer by themselves.
const HAIR = {
  hina: {
    Rh: .5, hairline: [-.2, -.14, .06, .16, .32], specY: -.29, capBack: 'b',
    front: [
      { p: [[62, -.3, .5], [74, -.02, .545], [77, .3, .53], [72, .6, .5]], w: .15, flex: 1.3 },
      { p: [[-62, -.3, .5], [-74, -.02, .545], [-77, .3, .53], [-72, .6, .5]], w: .15, flex: 1.3 },
      { p: [[40, -.42, .46], [53, -.2, .555], [60, .03, .535], [62, .13, .51]], w: .15 },
      { p: [[-42, -.42, .46], [-55, -.18, .555], [-62, .05, .535], [-65, .15, .51]], w: .15 },
      { p: [[20, -.46, .44], [30, -.26, .545], [37, -.05, .53], [41, .05, .505]], w: .16 },
      { p: [[-24, -.46, .44], [-34, -.25, .545], [-42, -.05, .53], [-46, .06, .505]], w: .17 },
      { p: [[6, -.48, .42], [11, -.27, .54], [15, -.08, .53], [17, -.01, .505]], w: .16 },
      { p: [[-7, -.48, .42], [-11, -.27, .54], [-14, -.07, .53], [-17, .02, .505]], w: .17 },
      { p: [[0, -.47, .43], [1, -.3, .535], [3, -.15, .53]], w: .1 },
      { p: [[-6, -.42, .16], [-2, -.6, .26], [12, -.7, .28], [24, -.63, .3]], w: .065, flex: 2.2, ahoge: 1 },
    ],
    back: [
      ...[100, 122, 144, 166].map((a, i) => ({ p: [[a, -.25, .5], [a + 4, .3, .6], [a + 2, .95, .6 - i * .02], [a - 4, 1.45 - i * .04, .52]], w: .34 })),
      ...[-100, -122, -144, -166].map((a, i) => ({ p: [[a, -.25, .5], [a - 4, .3, .6], [a - 2, .95, .6 - i * .02], [a + 4, 1.42 - i * .04, .52]], w: .34 })),
      { p: [[88, -.2, .5], [96, .2, .56], [96, .75, .56], [92, 1.25, .52]], w: .2 },
      { p: [[-88, -.2, .5], [-96, .2, .56], [-96, .75, .56], [-92, 1.25, .52]], w: .2 },
    ],
  },
  ren: {
    Rh: .545, hairline: [-.24, -.17, .02, .14, .3], specY: -.32, capBack: 'b',
    front: [
      { p: [[-34, -.5, .4], [-18, -.34, .56], [0, -.12, .545], [12, .02, .52]], w: .17 },
      { p: [[38, -.5, .4], [26, -.32, .565], [12, -.1, .545], [4, .12, .52]], w: .15 },
      { p: [[72, -.26, .5], [82, .0, .555], [84, .2, .52]], w: .14 },
      { p: [[-72, -.26, .5], [-82, .0, .555], [-84, .2, .52]], w: .14 },
      { p: [[44, -.42, .46], [58, -.2, .565], [66, .04, .535]], w: .16 },
      { p: [[-46, -.42, .46], [-60, -.18, .565], [-68, .06, .535]], w: .16 },
      { p: [[26, -.46, .44], [38, -.26, .56], [48, -.06, .53], [54, .02, .505]], w: .17 },
      { p: [[-26, -.46, .44], [-38, -.24, .56], [-48, -.04, .53], [-51, .08, .505]], w: .18 },
      { p: [[10, -.48, .42], [16, -.3, .555], [22, -.08, .535], [26, .04, .505]], w: .19 },
      { p: [[-4, -.48, .42], [-8, -.3, .555], [-16, -.06, .535], [-24, .07, .505]], w: .2 },
      { p: [[2, -.47, .43], [4, -.3, .55], [3, -.16, .535]], w: .11 },
    ],
    back: [
      ...[100, 126, 152, 180, 208, 234, 260].map((a, i) => { const k = 1 - Math.abs(i - 3) / 3; return { p: [[a, -.3, .47], [a + 3, -.05, .52], [a + 6, lerp(.08, .24, k), lerp(.5, .44, k)], [a + 9, lerp(.16, .38, k) + (i % 2) * .03, lerp(.48, .34, k)]], w: lerp(.14, .2, k) }; }),
    ],
  },
};

// ======================================================================================= helpers for scenes
// autoBlink(t, seed): eye openness 0..1 with a blink every ~2.5–4 s, drawn on twos (open, half, shut, half, open).
function autoBlink(t, seed = 0) {
  const per = 3.3, k = Math.floor(t / per), at = k * per + .25 + hash(k * 3.7 + seed * 11.3) * (per - .8), d = t - at;
  if (d < 0 || d >= 4 / 12) return 1;
  return [.45, 0, .1, .6][Math.floor(d * 12)];
}
// talk(t, seed): a mouth shape cycling on threes (8 drawings/s), like anime lip flap. Returns a mouth name.
function talk(t, seed = 0) { const k = Math.floor(t * 8), h = hash(k * 1.93 + seed * 7.1); return ['a', 'o', 'a', 'i', 'n', 'a', 'e', 'o'][Math.floor(h * 8)]; }
// faceAt(t, [[t0, 'neutral'], [1.2, 'surprised'], ...]) → { face, blink, sq, since }: expressions change on a drawing,
// with a 1-frame blink (anime does this) and a small squash-pop the scene may add to the character.
function faceAt(t, keys) {
  let i = 0; while (i + 1 < keys.length && t >= keys[i + 1][0]) i++;
  const since = t - keys[i][0], ch = i > 0 && since < 1 / 12;
  return { face: keys[i][1], blink: ch ? .15 : null, sq: i > 0 ? -.05 * Math.exp(-since * 10) * Math.cos(since * 30) : 0, since };
}
// follow(t, f, k, w): spring follow-through. f(t) → number or [x, y] (e.g. a character's x over time); returns how
// far a loose part (hair, skirt, ribbon) lags/overshoots, in the same units. Pure: integrates the past 1.2 s.
function follow(t, f, k = 6, w = 14, amt = 1) {
  const dt = 1 / 60, v = tt => { const a = f(tt - dt), b = f(tt), c = f(tt + dt); return Array.isArray(b) ? b.map((_, j) => (a[j] - 2 * b[j] + c[j]) / (dt * dt)) : [(a - 2 * b + c) / (dt * dt)]; };
  let acc = null;
  for (let tau = 0; tau < 1.2; tau += dt) {
    const a = v(t - tau), h = Math.exp(-k * tau) * Math.sin(w * tau) / w * dt;
    acc = acc ? acc.map((s, j) => s - a[j] * h) : a.map(x => -x * h);
  }
  return acc.length === 1 ? acc[0] * amt : acc.map(x => x * amt);
}
// walkPose(phase, amt): legs/arms for a walk (phase 0..1 per two steps). For bodies turned ≳ 3/4 (turn ≥ .4).
// one leg's cycle as key poses [phase, hip°, knee°] (contact → down → passing → reach), sampled cyclically
const WALK_KEYS = [[0, 24, 4], [.1, 16, 18], [.3, 0, 6], [.45, -16, 10], [.55, -22, 32], [.7, -4, 56], [.85, 20, 26], [1, 24, 4]];
const RUN_KEYS = [[0, 30, 14], [.13, 8, 34], [.3, -28, 18], [.45, -32, 78], [.65, 14, 112], [.85, 46, 52], [1, 30, 14]];
const cyc = (keys, p) => kf(frac(p), keys.map(([ph, a, b]) => [ph, [a, b]]), x => x);
function walkPose(p, amt = 1) {
  const L = cyc(WALK_KEYS, p), R = cyc(WALK_KEYS, p + .5);
  return { legL: [L[0] * amt, L[1] * amt], legR: [R[0] * amt, R[1] * amt], armL: [-R[0] * .8 * amt, (10 + Math.max(0, R[0]) * .6) * amt], armR: [-L[0] * .8 * amt, (10 + Math.max(0, L[0]) * .6) * amt], lean: 3 * amt };
}
// runPose(phase): a run with forward lean, pumping bent arms and a flight phase (dy).
function runPose(p, amt = 1) {
  const L = cyc(RUN_KEYS, p), R = cyc(RUN_KEYS, p + .5), fl = Math.max(0, Math.sin(frac(p) * TAU * 2 - 1.2));
  return { legL: [L[0] * amt, L[1] * amt], legR: [R[0] * amt, R[1] * amt], armL: [-R[0] * 1.1 * amt, (80 + R[0] * .4) * amt], armR: [-L[0] * 1.1 * amt, (80 + L[0] * .4) * amt], lean: 14 * amt, dy: -.16 * fl * amt };
}
// stroll(t, t0, t1, x0, x1, u, stride): eased walk from x0 to x1 → { x, phase, moving }
function stroll(t, t0, t1, x0, x1, u, stride = 2.6) {
  const k = ease(seg(t, t0, t1)), x = lerp(x0, x1, k);
  return { x, phase: Math.abs(x - x0) / (stride * u), moving: t > t0 && t < t1 };
}

// ======================================================================================= head construction
// Face outline keys (18 points, same order) at turn 0, .5 and 1 (facing screen right); morphed between.
const FACE_KEYS = [
  [[0, -.5], [.28, -.43], [.4, -.25], [.42, -.08], [.415, .04], [.4, .12], [.37, .21], [.315, .29], [.23, .37], [.12, .435], [0, .465], [-.12, .435], [-.23, .37], [-.315, .29], [-.37, .21], [-.415, .04], [-.42, -.25], [-.28, -.43]],
  [[-.03, -.51], [.27, -.44], [.385, -.26], [.41, -.08], [.395, .03], [.405, .11], [.375, .2], [.335, .27], [.275, .35], [.215, .42], [.15, .463], [.03, .43], [-.12, .345], [-.25, .23], [-.37, .08], [-.45, -.12], [-.43, -.33], [-.29, -.47]],
  [[-.03, -.52], [.25, -.45], [.36, -.28], [.4, -.08], [.385, .02], [.45, .15], [.405, .195], [.41, .25], [.4, .3], [.37, .36], [.3, .43], [.16, .39], [.03, .3], [-.1, .17], [-.27, .0], [-.44, -.14], [-.44, -.32], [-.28, -.47]],
];
function faceOutline(D, turn) {
  const a = Math.abs(turn), sg = turn < 0 ? -1 : 1, [A, B, k] = a <= .5 ? [FACE_KEYS[0], FACE_KEYS[1], a / .5] : [FACE_KEYS[1], FACE_KEYS[2], (a - .5) / .5];
  return A.map((p, i) => {
    let x = lerp(p[0], B[i][0], k), y = lerp(p[1], B[i][1], k);
    if (y > .15) { x *= D.jawW; y = .15 + (y - .15) * (D.chinY - .15) / (.465 - .15); }
    return [x * D.faceW * sg, y];
  });
}
const wrapDeg = a => ((a + 180) % 360 + 360) % 360 - 180;
function hairlineY(D, az) {  // hairline height at an azimuth (deg): front, 45°, temple, 135°, nape
  const h = HAIR[D.hairStyle].hairline, a = Math.abs(wrapDeg(az)) / 45, i = Math.min(3, Math.floor(a));
  return lerp(h[i], h[i + 1], ease(a - i));
}
// lock → { pts (outline), C (centreline), z (depth: + in front), W (width fn) } in head units
function lockGeom(L, psi, sway, t, key) {
  const n = L.p.length, ph = hash(key * 13.7) * TAU;
  const P = L.p.map(([az, y, r], i) => {
    const k = i / (n - 1), b = az * DEG + psi, f = (L.flex ?? 1) * k * k;
    const w = .012 * Math.sin(t * 2.1 + ph + k * 2) * k * (L.flex ?? 1);
    const rr = i === 0 ? r * .88 : r; return [rr * Math.sin(b) + (sway[0] + w) * f, y + sway[1] * f * .6];
  });
  const C = crPts(P, false, 8), W = s => L.w * (s < .22 ? lerp(.35, 1, Math.sqrt(s / .22)) : Math.pow(Math.max(0, (1 - s) / .78), .9));
  const mid = L.p[Math.floor(n / 2)];
  return { pts: ccw(ribbonPts(C, W, false)), C, W, z: Math.cos(mid[0] * DEG + psi), L };
}
// the eye in eye-local coords (x: -.5 inner → +.5 outer, y: -.5 top → .5 bottom) → head units
function eyeShape(D, ex) {
  const o = clamp(ex.open ?? 1, 0, 1.3), sq = ex.squint || 0, tl = ex.tilt || 0;
  const Yc = x => .2 + .12 * (1 - 4 * x * x);                     // the closed-lid line (a gentle ∪)
  const U = D.eyeU.map(([x, y]) => { const yo = y * (o > 1 ? o : 1) + tl * (.5 - x) * (tl > 0 ? 1.05 : .6); return [x, lerp(Yc(x), yo, Math.min(1, o))]; });
  if (ex.type === 'half') U.forEach(p => p[1] = Math.max(p[1], lerp(-.05, .12, clamp((1 - o) * 1.4)) + p[0] * .02));
  const Lo = D.eyeL.map(([x, y]) => [x, Math.max(lerp(y, y - .42, sq), 0)]);
  // keep the lower lid under the upper
  for (const p of Lo) { const ux = U.reduce((best, q) => Math.abs(q[0] - p[0]) < Math.abs(best[0] - p[0]) ? q : best); p[1] = Math.max(p[1], ux[1] + .06); }
  return { U, Lo };
}

// ======================================================================================= eyes
function drawEye(D, cx, cy, j, persp, ex, look, t, lw) {
  const ew = D.eyeW * lerp(.42, 1, persp), eh = D.eyeH * (ex.type === 'white' || (ex.open || 1) > 1 ? 1.08 : 1);
  const P = ([x, y]) => [cx + j * x * ew, cy + y * eh], line = tone(D.line), type = ex.type || 'open';
  const lashW = D.lash;
  const lashCurve = (pts, w, prof = TAPER.lash) => ink(pts.map(P), w, line, prof);
  if (type === 'happy') { lashCurve([[-.5, .22], [-.22, -.12], [.12, -.18], [.5, .12]], lashW * 1.05, TAPER.both); return; }
  if (type === 'tight') { lashCurve([[-.5, .02], [-.2, .24], [.15, .16], [.52, .3]], lashW * 1.1, TAPER.both); lashCurve([[.3, .02], [.58, -.1]], lashW * .5, TAPER.both); return; }
  if (type === 'xd') { lashCurve([[.42, -.36], [-.3, .04], [.42, .4]], lashW * 1.25, TAPER.soft); return; }
  if (type === 'dot') { G.fillStyle = line; G.beginPath(); G.ellipse(cx + j * .02 * ew, cy + .1 * eh, .12 * ew, .17 * eh, 0, 0, TAU); G.fill(); return; }
  if (type === 'line') { lashCurve([[-.4, .12], [.45, .1]], lashW * .8, TAPER.both); return; }
  if (type === 'swirl') {
    const pts = []; for (let i = 0; i < 40; i++) { const a = i * .45 + t * 10 * j, r = .05 + i / 40 * .42; pts.push([Math.cos(a) * r, .05 + Math.sin(a) * r * 1.1]); }
    ink(pts.map(P), lashW * .5, line, TAPER.soft); return;
  }
  const { U, Lo } = eyeShape(D, ex);
  const open = ex.open ?? 1;
  if (open < .2) {                                                   // shut (blink): one confident lash line
    lashCurve(U, lashW * 1.05, TAPER.lash);
    ink([P([.46, U[4][1]]), P([.6, U[4][1] + .05])], lashW * .4, line, TAPER.head); return;
  }
  const white = polyPath(crPts([...U.slice(0, 5), ...Lo.slice().reverse()], true, 6).map(P));
  // sclera (a cool off-white) with the upper lid's cast shadow
  G.fillStyle = '#fdfbff'; G.fill(white);
  G.save(); G.clip(white);
  if (type !== 'white') {
    const s = (ex.iris ?? 1) * (D.irisS || 1), ix = cx + (look[0] * .2) * ew, iy = cy + (.1 + look[1] * .16) * eh, rx = .33 * ew * s, ry = .5 * eh * s * lerp(.92, 1, persp);
    const ir = new Path2D(); ir.ellipse(ix, iy, rx, ry, 0, 0, TAU);
    const g = G.createLinearGradient(0, iy - ry, 0, iy + ry); g.addColorStop(0, tone(D.iris.top)); g.addColorStop(.5, tone(D.iris.mid)); g.addColorStop(1, tone(D.iris.bot));
    G.fillStyle = g; G.fill(ir);
    G.save(); G.clip(ir);
    G.fillStyle = tone(D.iris.pupil); G.beginPath(); G.ellipse(ix, iy - ry * .06, rx * .42, ry * .44, 0, 0, TAU); G.fill();
    G.globalAlpha = .75; G.fillStyle = tone(D.iris.bot); G.beginPath(); G.ellipse(ix, iy + ry * .78, rx * .72, ry * .42, 0, 0, TAU); G.fill();   // lower glow
    G.globalAlpha = .5; for (let k = -2; k <= 2; k++) { if (!k) continue; ink([[ix + rx * .16 * k, iy + ry * .25], [ix + rx * .3 * k, iy + ry * .8]], rx * .09, '#ffffff', TAPER.both, { raw: true }); }
    G.globalAlpha = 1; G.strokeStyle = tone(D.iris.top); G.lineWidth = rx * .1; G.stroke(ir);
    G.restore();
    // catch-lights: a big one toward the light, a small one opposite (sparkle eyes: stars)
    const lx = _L[0] >= 0 ? 1 : -1;
    if (type === 'sparkle') {
      sparkle(ix + lx * rx * .3, iy - ry * .3, rx * .75, t * 2, '#ffffff', false); sparkle(ix - lx * rx * .35, iy + ry * .35, rx * .38, .4, '#ffffff', false);
      sparkle(ix + lx * rx * .45, iy + ry * .45, rx * .18, 0, '#ffffff', false);
    } else {
      G.fillStyle = '#ffffff'; G.beginPath(); G.ellipse(ix + lx * rx * .36, iy - ry * .34, rx * .32, ry * .24, -.4 * lx, 0, TAU); G.fill();
      G.beginPath(); G.ellipse(ix - lx * rx * .34, iy + ry * .36, rx * .14, ry * .1, 0, 0, TAU); G.fill();
    }
    if (ex.wet) { G.globalAlpha = .8 * ex.wet; ink([[ix - rx * .9, iy + ry * .62], [ix, iy + ry * .75], [ix + rx * .9, iy + ry * .6]], ry * .1, '#ffffff', TAPER.both); G.globalAlpha = 1; }
  } else {
    const ix = cx + look[0] * .1 * ew, iy = cy + .06 * eh; G.fillStyle = line; G.beginPath(); G.ellipse(ix, iy, .05 * ew, .07 * eh, 0, 0, TAU); G.fill();
  }
  // the upper lid's shadow band on the eye
  const band = [...U.slice(0, 5), ...U.slice(0, 5).reverse().map(([x, y]) => [x, y + .24])];
  G.fillStyle = 'rgba(70,50,110,.22)'; G.fill(polyPath(crPts(band, true, 5).map(P)));
  G.restore();
  // line work: crease, upper lash (thick, flicks out), lash spikes, lower lash (thin, outer part)
  if ((D.crease ?? 1) > 0) { G.globalAlpha = D.crease ?? 1; ink(U.slice(1, 5).map(([x, y]) => [x + .04, y - .18 - .04 * (1 - Math.abs(x))]).map(P), lashW * .22, tone(D.lineSoft), TAPER.both); G.globalAlpha = 1; }
  lashCurve(U, lashW);
  const tip = U[5], u4 = U[4];
  for (let k = 0; k < D.spikes; k++) { const b = P([u4[0] - .08 - k * .12, u4[1] - .06 + k * .02]), e = P([u4[0] + .1 - k * .1, u4[1] - .24 - k * .04]); ink([b, e], lashW * .45, line, TAPER.head); }
  const lo = crPts(Lo, false, 6), n0 = Math.floor(lo.length * .42);
  ink(lo.slice(n0).map(([x, y]) => P([x, y + .03])), lashW * .38, line, TAPER.both, { raw: true });
  ink(lo.slice(2, Math.floor(lo.length * .24)).map(([x, y]) => P([x, y + .03])), lashW * .18, tone(D.lineSoft), TAPER.both, { raw: true });
}
function drawBrow(D, cx, cy, j, persp, br, lw) {
  const ew = D.eyeW * lerp(.5, 1, persp), y0 = cy - D.eyeH * .5 - .07 - (D.browDrop || 0) - (br.raise || 0), a = br.ang || 0;
  const P = ([x, y]) => [cx + j * x * ew, y0 + y];
  ink([[-.42, -a * .75 + .005], [-.1, -.028 - a * .3], [.3, -.03 + a * .05], [.66, .012 + a * .2]].map(P), D.browW || .02, tone(D.browCol), TAPER.both);
}

// ======================================================================================= mouths
// Mouth names: neutral smile grin wide open o cat frown wavy line set grit shout wail + talk shapes a i u e o n
function drawMouth(D, mx, my, fw, name, lw, t) {
  const line = tone(D.line), inC = tone(D.mouthIn), tg = tone(D.tongue);
  G.save(); G.translate(mx, my); G.scale(fw, 1);
  const lip = (pts, w = .013, prof = TAPER.both) => ink(pts, w, line, prof);
  const hole = (pts, tongue = true, teeth = 0) => {
    const p = polyPath(crPts(pts, true, 6)); G.fillStyle = inC; G.fill(p);
    G.save(); G.clip(p);
    if (tongue) { G.fillStyle = tg; G.beginPath(); G.ellipse(0, Math.max(...pts.map(q => q[1])) + .006, .05, .035, 0, 0, TAU); G.fill(); }
    if (teeth) { G.fillStyle = '#ffffff'; G.fillRect(-.2, Math.min(...pts.map(q => q[1])) - .01, .4, teeth); }
    G.restore();
    G.strokeStyle = line; G.lineWidth = lw * .55; G.lineJoin = 'round'; G.stroke(p);
  };
  switch (name) {
    case 'smile': lip([[-.05, -.012], [-.02, .006], [.02, .006], [.05, -.012]], .012); break;
    case 'neutral': case 'n': lip([[-.03, .002], [0, .004], [.03, 0]], .01); break;
    case 'line': lip([[-.055, 0], [.055, .002]], .011); break;
    case 'frown': lip([[-.04, .01], [0, -.006], [.04, .01]], .011); break;
    case 'set': lip([[-.05, .004], [0, -.004], [.05, .002]], .012); break;
    case 'grin': hole([[-.065, -.012], [0, -.006], [.065, -.012], [.03, .045], [-.03, .045]], true, .012); break;
    case 'wide': case 'shout': hole([[-.075, -.03], [0, -.04], [.075, -.03], [.055, .06], [0, .085], [-.055, .06]], true, name === 'shout' ? .014 : 0); break;
    case 'wail': hole([[-.07, -.01], [-.02, -.035], [.03, -.02], [.07, -.03], [.06, .05], [0, .07], [-.06, .05]], true, 0); break;
    case 'a': case 'open': hole([[-.04, -.012], [0, -.016], [.04, -.012], [.025, .035], [-.025, .035]], true); break;
    case 'i': case 'e': hole([[-.05, -.01], [0, -.012], [.05, -.01], [.035, .018], [-.035, .018]], false, .01); break;
    case 'o': case 'u': hole([[0, -.022], [.022, 0], [0, .03], [-.022, 0]], false); break;
    case 'cat': lip([[-.05, -.012], [-.025, .01], [0, -.004]], .011); lip([[0, -.004], [.025, .01], [.05, -.012]], .011); break;
    case 'wavy': { const P = []; for (let i = 0; i <= 12; i++) { const x = -.05 + i / 12 * .1; P.push([x, Math.sin(i * 1.6 + t * 20) * .007]); } lip(P, .011, TAPER.soft); break; }
    case 'grit': G.scale(1.35, 1.35); G.fillStyle = '#ffffff'; G.beginPath(); G.roundRect(-.06, -.018, .12, .034, .012); G.fill(); G.strokeStyle = line; G.lineWidth = lw * .5; G.stroke();
      G.beginPath(); G.moveTo(-.058, 0); G.lineTo(.058, 0); for (const x of [-.03, 0, .03]) { G.moveTo(x, -.017); G.lineTo(x, .016); } G.lineWidth = lw * .3; G.stroke(); break;
    default: lip([[-.03, .002], [0, .004], [.03, 0]], .01);
  }
  G.restore();
}

// ======================================================================================= face marks (comedy fx)
function sweatDrop(x, y, s, line, t) {
  const dy = (t % 1.2) * .04 * s;
  const P = [[0, -1, 0, true], [.55, .3], [0, .75], [-.55, .3]].map(([a, b, ...r]) => [x + a * s, y + dy + b * s, ...r]);
  const path = polyPath(ccw(crPts(P.map(p => [p[0], p[1], 0, p[3]]), true, 7)));
  drawGroup([{ path, b: '#cfeeff', s: '#8fc8ee', d: s * .22 }], line, s * .1);
  G.fillStyle = '#ffffff'; G.beginPath(); G.ellipse(x - s * .18, y + dy + s * .18, s * .09, s * .18, .3, 0, TAU); G.fill();
}
function angerVein(x, y, s, t) {
  const k = 1 + .12 * Math.sin(t * 18), col = '#e2324c';
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, cx = x + Math.cos(a) * s * .42 * k, cy = y + Math.sin(a) * s * .42 * k, r = s * .36 * k;
    const P = []; for (let j = 0; j <= 8; j++) { const b = a + Math.PI - .95 + j / 8 * 1.9; P.push([cx + Math.cos(b) * r, cy + Math.sin(b) * r]); }
    ink(P, s * .17, col, TAPER.soft, { raw: true });
  }
}
function tearStreams(D, eyes, t) {
  for (const e of eyes) {
    const x0 = e.cx + e.j * D.eyeW * .25, y0 = e.cy + D.eyeH * .4, P = [];
    for (let i = 0; i <= 10; i++) { const k = i / 10; P.push([x0 + e.j * (.02 + k * .05) + Math.sin(k * 7 - t * 18 + e.j) * .012, y0 + k * .62]); }
    ink(P, .07, 'rgba(150,215,255,.92)', s => .55 + .45 * s); ink(P.map(([x, y]) => [x - .012, y]), .018, 'rgba(255,255,255,.95)', TAPER.both);
    G.fillStyle = 'rgba(160,220,255,.9)'; G.beginPath(); G.ellipse(e.cx, e.cy + D.eyeH * .38, D.eyeW * .45, D.eyeH * .12, 0, 0, TAU); G.fill();
  }
}

// ======================================================================================= head
// headGeom: everything about the head at this pose, in head units (origin = centre of the skull, 1 = head height).
function headGeom(D, o, t) {
  const turn = clamp(o.headTurn ?? o.turn ?? 0, -1, 1), psi = turn * Math.PI / 2, H = HAIR[D.hairStyle], sway = o.sway || [0, 0];
  const face = faceOutline(D, turn), facePath = smooth(face, true, 7);
  const locks = { front: [], back: [] };
  H.front.forEach((L, i) => { const g = lockGeom(L, psi, sway, t, i); (g.z < -.28 ? locks.back : locks.front).push(g); });
  H.back.forEach((L, i) => { const g = lockGeom(L, psi, [sway[0] * 1.4, sway[1]], t, 50 + i); (g.z > .15 ? locks.front : locks.back).push(g); });
  // the front hair cap: hairline across the visible hemisphere + the skull silhouette over the top
  const Rh = H.Rh, cap = [], cy = -.06;
  for (let b = -90; b <= 90; b += 5) cap.push([Rh * Math.sin(b * DEG), hairlineY(D, b - turn * 90)]);
  const yR = cap[cap.length - 1][1], yL = cap[0][1];
  if (yR > cy) cap.push([Rh, cy]);
  for (let a = 6; a <= 174; a += 6) cap.push([Rh * Math.cos(a * DEG), cy - Rh * Math.sin(a * DEG) * 1.02]);
  if (yL > cy) cap.push([-Rh, cy]);
  return { turn, psi, face, facePath, locks, cap: polyPath(ccw(cap)), Rh };
}
function drawHeadBack(D, hg, lw) {
  const hc = D.hair, back = [];
  const nape = HAIR[D.hairStyle].hairline[4], cb = [];
  for (let a = 0; a <= 360; a += 10) { const x = hg.Rh * .97 * Math.cos(a * DEG), y = -.06 + hg.Rh * .99 * Math.sin(a * DEG); cb.push([x, Math.min(y, nape)]); }
  const capB = polyPath(ccw(cb));
  back.push({ path: capB, b: tone(hc.s), d: 0 });
  for (const g of hg.locks.back.sort((a, b) => a.z - b.z)) back.push({ path: polyPath(g.pts), b: tone(hc.b), s: tone(hc.s), h: tone(hc.h), d: .07, r: .018, join: 'miter' });
  drawGroup(back, tone(hc.line), lw);
  for (const g of hg.locks.back) strand(g, tone(hc.line), lw * .7);
}
function strand(g, col, w) {   // an interior strand line along one side of a lock, from its tip up
  const C = g.C, N = C.length, a = Math.floor(N * .38), side = [];
  for (let i = a; i < N - 1; i++) { const p = C[i], q = C[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, ww = g.W(i / (N - 1)) * .5 * .55; side.push([p[0] - dy / l * ww, p[1] + dx / l * ww]); }
  if (side.length > 2) ink(side, w * 1.4, col, s => Math.pow(Math.sin(Math.PI * s), .5) * (.3 + .7 * s), { raw: true });
}
function drawHeadFront(D, hg, o, t, lw) {
  const ex = o.expr, turn = hg.turn, psi = hg.psi, sk = D.skin, line = tone(D.line);
  // ears (part of the face silhouette)
  const parts = [], ears = [];
  for (const j of [-1, 1]) {
    const th = psi + j * Math.PI / 2, c = Math.cos(th); if (c < -.25) continue;
    const s = Math.sin(th), ex_ = clamp(s * 1 + (turn ? -Math.sign(turn) : 0) * Math.max(0, c) * .9, -1, 1), x0 = .4 * s * D.faceW;
    const sc = D.earShow * lerp(.45, 1, Math.abs(ex_)), sgn = ex_ >= 0 ? 1 : -1;
    const P = [[0, -.07], [.06, -.075], [.085, .0], [.06, .08], [.02, .12], [0, .09]].map(([x, y]) => [x0 + sgn * x * sc * 1.1, .1 + y]);
    ears.push({ P, sgn, x0, sc });
    parts.push({ path: smooth(P, true, 6), b: tone(sk.b), s: tone(sk.s), d: .02 });
  }
  parts.push({ path: hg.facePath, b: tone(sk.b), s: tone(sk.s), h: tone(sk.h), d: .045 * Math.max(.4, Math.abs(Math.sin(psi)) + .3), r: .012 });
  drawGroup(parts, line, lw);
  for (const e of ears) ink([[e.x0 + e.sgn * .05 * e.sc, .06], [e.x0 + e.sgn * .03 * e.sc, .12], [e.x0 + e.sgn * .01 * e.sc, .15]], lw * .8, tone(D.lineSoft), TAPER.both);
  // front hair geometry (needed for the shadow it casts on the face)
  const hc = D.hair, frontLocks = hg.locks.front.sort((a, b) => a.z - b.z);
  const hairParts = [{ path: hg.cap, b: tone(hc.b), noLine: false }];
  for (const g of frontLocks) hairParts.push({ path: polyPath(g.pts), b: tone(hc.b), s: tone(hc.s), d: .045, join: 'miter' });
  const hairU = union(hairParts.map(p => p.path));
  // face details, clipped to the face
  const eyes = [];
  for (const j of [-1, 1]) { const th = psi + j * .47, c = Math.cos(th); if (c < -.12) continue; eyes.push({ j, cx: D.eyeR * Math.sin(th) * D.faceW * (1 - .2 * clamp((Math.abs(turn) - .6) / .4) * (c > .3 ? 1 : 0)) + (o.eyeShake ? Math.sin(t * 90 + j) * .006 : 0), cy: D.eyeY, persp: clamp(c, 0, 1) }); }
  G.save(); G.clip(hg.facePath);
  G.fillStyle = tone(sk.s); G.fill(shifted(hairU, -_L[0] * .035, .075));               // hair shadow on the forehead
  const fw = lerp(.55, 1, Math.cos(psi)), sn = Math.sin(psi);
  if (ex.fx && ex.fx.includes('gloom')) {
    const g = G.createLinearGradient(0, -.4, 0, .2); g.addColorStop(0, 'rgba(60,70,160,.55)'); g.addColorStop(1, 'rgba(60,70,160,0)'); G.fillStyle = g; G.fillRect(-.6, -.6, 1.2, .9);
    for (let i = 0; i < 7; i++) ink([[-.28 + i * .09 + sn * .15, -.3], [-.28 + i * .09 + sn * .15, -.08 - (i % 2) * .05]], .012, 'rgba(40,40,110,.7)', TAPER.head, { raw: true });
  }
  const bl = o.blush ?? ex.blush ?? 0;
  if (bl > 0) for (const e of eyes) {
    const bx = e.cx + e.j * .03 + sn * .02, by = e.cy + D.eyeH * .78, rx = .085 * lerp(.5, 1, e.persp);
    const g = G.createRadialGradient(bx, by, 0, bx, by, rx * 1.2); g.addColorStop(0, D.blush + Math.round(clamp(bl) * 150).toString(16).padStart(2, '0')); g.addColorStop(1, D.blush + '00');
    G.fillStyle = g; G.save(); G.translate(bx, by); G.scale(1, .5); G.translate(-bx, -by); G.beginPath(); G.arc(bx, by, rx * 1.2, 0, TAU); G.fill(); G.restore();
    if (bl > .35) { G.globalAlpha = clamp(bl * 1.2); for (let k = 0; k < 3 + (bl > .7); k++) { const hx = bx - rx * .55 + k * rx * .38 * lerp(.6, 1, e.persp); ink([[hx + .014, by - .018], [hx - .012, by + .018]], .01, tone('#e0506c'), TAPER.both, { raw: true }); } G.globalAlpha = 1; }
  }
  // nose: a small tick + a shadow plane on the far side
  const nx = .43 * sn * D.faceW, ny = .225;
  if (Math.abs(turn) < .85) {
    const k = Math.abs(sn), sg = Math.sign(sn) || (_L[0] > 0 ? -1 : 1);
    G.fillStyle = tone(sk.s); G.beginPath(); G.moveTo(nx, ny - .06); G.lineTo(nx + sg * (.018 + .02 * k), ny + .005); G.lineTo(nx, ny + .012); G.fill();
    ink([[nx + sg * (.004 + .018 * k), ny - .01], [nx + sg * (.012 + .02 * k), ny + .008], [nx - sg * .006, ny + .012]], lw * .75, tone(D.lineSoft), TAPER.both);
  } else ink([[nx - .03 * Math.sign(sn), ny + .01], [nx - .012 * Math.sign(sn), ny + .016]], lw * .6, tone(D.lineSoft), TAPER.both);
  // mouth
  const mouth = o.mouth || ex.mouth || 'neutral';
  drawMouth(D, .4 * sn * D.faceW * (Math.abs(turn) > .8 ? .93 : .92), D.mouthY, fw, mouth, lw, t);
  G.restore();
  // front hair: cap + locks, one silhouette; per-lock shade; spec band; strand lines
  drawGroup(hairParts, tone(hc.line), lw);
  G.save(); G.clip(hairU);
  G.fillStyle = tone(hc.s); G.globalAlpha = .9; G.fill(shifted(hairU, 0, .0)); G.globalAlpha = 1;
  G.clip(shifted(hairU, _L[0] * .05, _L[1] * .05 - .012));
  G.fillStyle = tone(hc.b); G.fill(hairU);
  for (const g of frontLocks) { const p = polyPath(g.pts); G.save(); G.clip(p); G.fillStyle = tone(hc.s); G.fill(p); G.clip(shifted(p, _L[0] * g.L.w * .24, _L[1] * g.L.w * .12 - .01)); G.fillStyle = tone(hc.b); G.fill(p); G.restore(); }
  // the "angel ring" specular band
  // a zig-zag band on the skull, broken into clumps, biased toward the light; it slides as the head turns
  const H = HAIR[D.hairStyle], q = rnd('spec' + D.name), band = new Path2D(), lb = _L[0] < 0 ? -1 : 1;
  const runs = [[-62, -30], [-24, 8], [14, 44], [50, 70]].map(([a, b]) => [a + lb * 8, b + lb * 8]);
  runs.forEach(([a0, a1], ri) => {
    const top = [], bot = [], n = 8, fade = ri === (lb < 0 ? 3 : 0) ? .55 : 1;
    for (let i = 0; i <= n; i++) {
      const az = lerp(a0, a1, i / n) * DEG + psi * .9, c = Math.cos(az); if (c < .08) continue;
      const x = hg.Rh * .96 * Math.sin(az), y = H.specY + .075 * (1 - c), edge = i === 0 || i === n;
      const up = edge ? 0 : (.025 + q() * .05) * c * fade, dn = edge ? 0 : (.035 + q() * .08) * c * fade, th = .007 * c;
      top.push([x, y - th - (i % 2 ? up : 0)]); bot.push([x + .004, y + th + (i % 2 ? 0 : dn)]);
    }
    if (top.length > 2) polyPath([...top, ...bot.reverse()], true, band);
  });
  G.fillStyle = tone(hc.spec); G.fill(band);

  G.restore();
  for (const g of frontLocks) if (!g.L.ahoge) strand(g, tone(hc.line), lw * .75);
  // eyes and brows (drawn over the hair, as anime does), clipped to the face so turned heads hide the far eye
  G.save(); G.clip(union([hg.facePath, hairU]));
  const look = o.look || ex.eye.look || [0, 0], eyeState = { ...ex.eye };
  if (o.blink != null && eyeState.type !== 'happy' && !['xd', 'dot', 'line', 'tight', 'swirl'].includes(eyeState.type)) eyeState.open = (eyeState.open ?? 1) * o.blink;
  for (const e of eyes) {
    const lk = [clamp(look[0] + sn * .55, -1, 1) * e.j * (e.j), look[1]];
    drawEye(D, e.cx, e.cy, e.j, e.persp, eyeState, [look[0] + sn * .5, look[1]], t, lw);
    if (!['xd', 'happy'].includes(eyeState.type) || true) drawBrow(D, e.cx, e.cy, e.j, e.persp, ex.brow || {}, lw);
  }
  G.restore();
  // face marks
  const fx = [...(ex.fx || []), ...(o.fx || [])], side = _L[0] > 0 ? -1 : 1;
  if (ex.fx && ex.fx.includes('tears')) tearStreams(D, eyes, t);
  if (fx.includes('sweat')) sweatDrop(side * .44 + sn * .1, -.3, .1, line, t);
  if (fx.includes('vein')) angerVein(-side * .26 + sn * .12, -.36, .13, t);
  if (fx.includes('steam')) for (let i = 0; i < 2; i++) { const k = frac(t * 1.4 + i * .5), x = (i ? .5 : -.5) * (1 + k * .3), y = -.35 - k * .3; G.globalAlpha = 1 - k; G.fillStyle = '#ffffff'; G.beginPath(); G.arc(x, y, .06 + k * .06, 0, TAU); G.arc(x + .06, y - .03, .05 + k * .05, 0, TAU); G.fill(); G.globalAlpha = 1; }
  return { eyes };
}

// ======================================================================================= hands
// Hand shapes in hand-local units (1 = hand length): origin = wrist, +x toward the fingertips, +y = thumb side.
// 'open' 'fist' 'point' 'peace' 'spread' 'hold' (pinch: a flat prop sits between thumb and fingers) 'grip' (a
// handle sits inside the curled fingers). Returns the parts per layer: back (behind the prop) and front.
function handShape(shape) {
  const F = (P, w) => tubePts(P.map(([x, y], i) => [x, y, w * (1 - i / P.length * .22)]), 6), palm = [[-.02, -.15], [.2, -.22], [.46, -.22], [.5, .02], [.46, .2], [.2, .2], [-.02, .14]];
  const ys = [-.17, -.055, .06, .16];
  const fingers = (len, curl) => ys.map((y, i) => { const l = len * [.92, 1, .96, .8][i]; return F([[.4, y], [.4 + l * .55, y + curl * .3 - .01 * i], [.4 + l, y + curl]], .125); });
  const thumbOut = F([[.12, .15], [.3, .3], [.5, .34]], .14);
  switch (shape) {
    case 'relax': return { back: [[[-.02, -.13], [.2, -.17], [.44, -.16], [.5, .02], [.44, .15], [.2, .15], [-.02, .12]], ...[-.1, 0, .09].map((y, i) => F([[.4, y], [.62, y + .03], [.78, y + .12 + i * .02], [.8, y + .2]], .12)), F([[.1, .12], [.3, .22], [.46, .26]], .12)], front: [], lines: [[[.62, -.05], [.76, .02]], [[.62, .045], [.76, .12]]] };
    case 'fist': return { back: [palm, ...ys.map((y, i) => F([[.38, y], [.52, y + .01]], .13 + (i === 3 ? -.01 : 0)))], front: [F([[.12, .17], [.32, .2], [.5, .08]], .13)], lines: ys.slice(0, 3).map((y, i) => [[.46, y + .055], [.56, y + .06]]) };
    case 'point': return { back: [palm, ...ys.slice(1).map(y => F([[.38, y], [.52, y + .01]], .13)), F([[.4, -.17], [.7, -.19], [1.02, -.19]], .115)], front: [F([[.12, .17], [.32, .2], [.5, .08]], .13)], lines: [[[.46, 0], [.56, 0]], [[.46, .11], [.56, .11]]] };
    case 'peace': return { back: [palm, ...ys.slice(2).map(y => F([[.38, y], [.52, y + .01]], .13)), F([[.4, -.17], [.72, -.28], [.98, -.36]], .115), F([[.4, -.06], [.74, -.06], [1.02, -.05]], .115)], front: [F([[.12, .17], [.32, .2], [.5, .1]], .13)], lines: [[[.46, .11], [.56, .11]]] };
    case 'spread': return { back: [palm, ...ys.map((y, i) => { const a = (i - 1.5) * .3, l = .55 * [.92, 1, .96, .8][i]; return F([[.42, y], [.42 + Math.cos(a) * l * .55, y + Math.sin(a) * l * .55], [.42 + Math.cos(a) * l, y + Math.sin(a) * l]], .12); }), F([[.14, .16], [.28, .36], [.42, .52]], .14)], front: [], lines: [] };
    case 'hold': return { back: [palm, ...fingers(.52, .05)], front: [F([[.12, .16], [.34, .12], [.58, .02]], .14)], grip: [.6, .06], lines: [[[.72, -.11], [.93, -.1]], [[.72, .005], [.95, .01]], [[.72, .11], [.9, .12]]] };
    case 'grip': return { back: [palm], front: [...ys.map(y => F([[.36, y], [.56, y + .02], [.6, y + .12]], .13)), F([[.12, .17], [.32, .22], [.5, .16]], .13)], grip: [.52, .12], lines: [] };
    default: return { back: [palm, ...fingers(.52, .05), thumbOut], front: [], lines: [[[.72, -.11], [.93, -.1]], [[.72, .005], [.96, .01]], [[.72, .11], [.9, .12]]] };
  }
}
function drawHand(D, wrist, ang, th, shape, prop, lw, u) {
  const hl = D.hl, ex = [Math.sin(ang) * hl, Math.cos(ang) * hl], ey = [-Math.cos(ang) * hl * th, Math.sin(ang) * hl * th];
  const S = handShape(shape), sk = D.skin, line = tone(D.line), L = lw / hl;
  let gripAt = null;
  inFrame(ex, ey, wrist, () => {
    const part = P => ({ path: polyPath(ccw(P.length > 8 ? P : crPts(P, true, 5))), b: tone(sk.b), s: tone(sk.s), d: .07 });
    drawGroup(S.back.map(part), line, L);
    for (const l of S.lines) ink(l, L * 1.1, tone(D.lineSoft), TAPER.both);
    if (S.grip) {
      gripAt = S.grip;
      if (prop) { G.save(); G.translate(...S.grip); G.rotate(((prop.rot || 0)) * DEG); G.scale(1 / hl, 1 / hl); G.translate(...(prop.at || [0, 0])); prop.draw(prop.s || 1, line); G.restore(); }
    }
    if (S.front.length) drawGroup(S.front.map(part), line, L);
  });
  return gripAt ? addV(addV(wrist, ex, gripAt[0]), ey, gripAt[1]) : addV(wrist, ex, .5);
}

// ======================================================================================= body
function drawChar(D, x, y, u, o = {}) {
  const t = o.t ?? T;
  const lwPx = o.lw ?? clamp(1.5 + u * .011, 2, 6.5), lw = lwPx / u;
  const fx = o.flip ? -1 : 1, sq = o.sq || 0, sx = 1 + sq * .6, syy = 1 - sq;
  // pose
  let pose = { ...o };
  if (o.walk != null) pose = { ...walkPose(o.walk, o.walkAmt ?? 1), ...o, legL: o.legL || walkPose(o.walk, o.walkAmt ?? 1).legL, legR: o.legR || walkPose(o.walk, o.walkAmt ?? 1).legR };
  if (o.run != null) { const r = runPose(o.run, o.runAmt ?? 1); pose = { ...r, ...o, legL: o.legL || r.legL, legR: o.legR || r.legR, armL: o.armL || r.armL, armR: o.armR || r.armR, lean: (o.lean ?? 0) + r.lean, dy: (o.dy || 0) + r.dy }; }
  if (o.walk != null) { const w = walkPose(o.walk, o.walkAmt ?? 1); pose.armL = o.armL || w.armL; pose.armR = o.armR || w.armR; pose.lean = (o.lean ?? 0) + w.lean; }
  const bt = clamp(o.bodyTurn ?? o.turn ?? 0, -1, 1), abt = Math.abs(bt), side = abt > .3, f = bt >= 0 ? 1 : -1;
  // contrapposto: a standing pose puts the weight on one leg — that hip rises and pushes out, the shoulders counter-tilt,
  // the spine makes a gentle S, the free knee relaxes. Default for standing; stance:'straight' turns it off.
  const moving = o.walk != null || o.run != null, standing = !moving && o.ground !== false;
  const cp = (o.stance ?? (standing ? 'contra' : 'straight')) === 'contra' ? (o.contra ?? 1) : 0, ws = (o.weight || D.weight || 'R') === 'L' ? -1 : 1;
  if (cp) {
    if (!o.legL && !o.legR) { const wl = side ? [-5, 3] : [-3, 0], fl = side ? [16, 26] : [9, 32]; pose.legL = ws < 0 ? wl : fl; pose.legR = ws < 0 ? fl : wl; pose.legL = pose.legL.map(v => v * cp); pose.legR = pose.legR.map(v => v * cp); }
    const nearIsL = f > 0, nearA = [1 * cp, 12 * cp, 'relax'], farA = [-11 * cp, 10 * cp, 'relax'];
    if (!o.armL) pose.armL = side ? (nearIsL ? nearA : farA) : D.pocketArm === 'L' ? [14 * cp, -40 * cp, 'pocket'] : [5 * cp, (ws < 0 ? 10 : 18) * cp, 'relax'];
    if (!o.armR) pose.armR = side ? (nearIsL ? farA : nearA) : [5 * cp, (ws < 0 ? 18 : 10) * cp, 'relax'];
    if (side) { pose.lean = (pose.lean || 0) - 2.5 * f * cp; pose.headFwd = 5 * f * cp; }
  }
  const pelvisRoll = side ? 0 : -ws * 7.5 * DEG * cp, shoulderRoll = side ? 0 : ws * 4 * DEG * cp, sCurve = side ? 0 : -ws * 3 * DEG * cp;
  const lean = (pose.lean || 0) * DEG, bend = (pose.bend || 0) * DEG, wf = lerp(1, .64, abt);
  const expr = typeof o.face === 'object' ? o.face : (EXPR[o.face || 'neutral'] || EXPR.neutral);
  const blink = o.blink ?? (o.autoBlink === false ? 1 : autoBlink(t, D.name === 'ren' ? 5 : 1));
  const mouth = o.mouth || (o.talk ? talk(t, D.name.length) : null);
  // legs → where the pelvis must be for the feet to touch the ground
  const legA = s => { const L = (s < 0 ? pose.legL : pose.legR) || [0, 0]; if (side) { const a1 = L[0] * DEG * f; return [a1, a1 - (L[1] || 0) * DEG * f, 1]; } const a1 = L[0] * DEG * s; return [a1, a1 - s * (L[1] || 0) * DEG * (D.kneeIn ?? .6), Math.cos((L[1] || 0) * DEG * .5)]; };
  const hipJ = s => [s * D.hipX * lerp(1, .3, abt), Math.sin(pelvisRoll) * s * D.hipX];
  const legPts = s => { const [a1, a2, fsh] = legA(s), h = hipJ(s), k = addV(h, dirA(a1), D.thigh * (side ? 1 : lerp(1, .9, 1 - fsh))), an = addV(k, dirA(a2), D.shin * fsh); return { h, k, an, a1, a2 }; };
  const LL = legPts(-1), LR = legPts(1);
  const low = Math.max(LL.an[1], LR.an[1]) + D.ankleH;
  const py = (o.ground === false ? -D.hipH : -low) + (pose.dy || 0);
  const Pv = [(pose.hipX || 0) + ws * .07 * cp * (side ? 0 : 1), py];
  // spine frame: height v above the hip joints, sideways offset xx; lean + bend + S-curve, pelvis→shoulder roll
  const F = (v, xx) => { const k = ease(clamp(v / 1.5)), roll = lerp(pelvisRoll, shoulderRoll, k);
    const r = rot2(xx * Math.cos(roll), -v + xx * Math.sin(roll), lean + bend * v / 3.2 + sCurve * k); return [Pv[0] + r[0], Pv[1] + r[1]]; };
  // secondary motion
  const sway = o.sway || [0, 0];
  const info = {};
  G.save(); G.translate(x, y); G.scale(u * fx * sx, u * syy);
  const keepL = _L; _L = [LIGHT[0] * fx, LIGHT[1]];
  const hLean = lean + bend * .5 + (o.tilt || 0) * DEG - sCurve * .8 + ws * 2.5 * DEG * cp * (side ? 0 : 1) + (pose.headFwd || 0) * DEG, neckB = F(D.neckV, (o.neckX || 0));
  const headO = addV(addV(neckB, dirA(Math.PI + hLean + (o.tilt || 0) * DEG * .3), D.neckLen + D.chinY + .02), [bt * .07, abt * .05]);
  const hg = headGeom(D, { ...o, sway: [sway[0] - Math.sin(lean) * .15, sway[1]] }, t);
  const drawHead = () => inFrame([Math.cos(hLean), Math.sin(hLean)], [-Math.sin(hLean), Math.cos(hLean)], headO, () => { info.hf = drawHeadFront(D, hg, { ...o, expr, blink, mouth, eyeShake: expr.eye.shake }, t, lw); });
  const drawBack = () => inFrame([Math.cos(hLean), Math.sin(hLean)], [-Math.sin(hLean), Math.cos(hLean)], headO, () => drawHeadBack(D, hg, lw));
  // arms
  const shJ = s => F(D.shV, s * D.shX * lerp(1, .2, abt) * (side ? 1 : 1));
  const armGeo = s => {
    const A = (s < 0 ? pose.armL : pose.armR) || [4, 6, 'open'], lift = clamp((Math.abs(A[0]) - 40) / 100) * .1;
    const sh = addV(shJ(s), [side ? f * lift * .6 * Math.sign(A[0]) : s * lift * .35, -lift]);
    const a1 = (side ? A[0] * f : A[0] * s) * DEG, a2 = a1 + (side ? (A[1] || 0) * f : (A[1] || 0) * s) * DEG;
    const e = addV(sh, dirA(a1 + lean * .4), D.ua), w = addV(e, dirA(a2 + lean * .4), D.fa * (A[4] ?? 1));
    const ha = a2 + lean * .4 + (A[3] || 0) * DEG * (side ? f : s);
    return { sh, e, w, ha, hand: A[2] || 'open', a1, a2, A };
  };
  const drawArm = s => {
    const g = armGeo(s), wd = D.armW, dir = nrm2([g.w[0] - g.e[0], g.w[1] - g.e[1]]);
    // hand first (the cuff overlaps the wrist)
    const hy = [-Math.cos(g.ha), Math.sin(g.ha)];
    let th = s > 0 ? 1 : -1; if (side) th = hy[1] * f > 0 ? -f * (s > 0 ? 1 : 1) : f; if (!side && Math.abs(hy[1]) > .5) th = hy[1] > 0 ? -1 : 1;
    if (g.A[5]) th *= -1;
    const prop = o.prop && (o.prop.hand || 'R') === (s < 0 ? 'L' : 'R') ? o.prop : null;
    const handAt = g.hand === 'pocket' ? (ink([addV(g.w, [-.08, -.06]), addV(g.w, [.02, .1])], lw * .9, tone(D.line), TAPER.both), g.w) : drawHand(D, addV(g.w, dir, -.05), g.ha, th, prop ? (g.hand === 'open' ? 'hold' : g.hand) : g.hand, prop, lw, u);
    const m1 = [(g.sh[0] + g.e[0]) / 2, (g.sh[1] + g.e[1]) / 2], m2 = [(g.e[0] + g.w[0]) / 2, (g.e[1] + g.w[1]) / 2];
    const cl = D.clothes === 'hina' ? D.cardigan : D.blazer;
    // sleeve: tapers shoulder → elbow (pinched) → a looser forearm → gathered at the cuff
    const ud = nrm2([g.e[0] - g.sh[0], g.e[1] - g.sh[1]]), cuffLen = D.clothes === 'hina' ? .15 : .1, ce = addV(g.w, dir, -.02), cs = addV(ce, dir, -cuffLen);
    const f1 = [lerp(g.e[0], cs[0], .45), lerp(g.e[1], cs[1], .45)];
    const sleeve = tubePts([[...g.sh, wd[0]], [...m1, wd[1]], [...addV(g.e, ud, -.06), wd[2] * 1.03], [...g.e, wd[2]], [...addV(g.e, dir, .07), wd[2] * 1.04], [...f1, wd[3]], [...addV(cs, dir, .02), wd[4]]], 5);
    const cuff = tubePts([[...cs, wd[5]], [...ce, wd[5] * (D.clothes === 'hina' ? .97 : 1)]], 3, false);
    const cuffCol = D.clothes === 'hina' ? { b: tone(mixCol(cl.b, cl.s, .45)), s: tone(cl.s) } : { b: tone(cl.b), s: tone(cl.s) };
    const parts = [{ path: polyPath(ccw(sleeve)), b: tone(cl.b), s: tone(cl.s), h: tone(cl.h), d: .07, r: .015 }, { path: polyPath(ccw(cuff)), b: cuffCol.b, s: cuffCol.s, d: .05 }];
    drawGroup(parts, tone(D.line), lw);
    const n = [-dir[1], dir[0]], bendK = Math.abs(Math.sin((g.a2 - g.a1) / 2)), inner = Math.sign(Math.sin(g.a2 - g.a1)) || 1, soft = tone(D.lineSoft);
    // elbow: creases on the inner side (more as it bends), a point line on the outer side
    for (let k = 0; k < 2 + (bendK > .4); k++) { const o1 = addV(addV(g.e, n, -inner * wd[2] * (.5 - k * .12)), dir, -.03 + k * .05);
      ink([o1, addV(addV(o1, n, inner * wd[2] * (.35 + bendK * .2)), dir, .03 + bendK * .04)], lw * (1 - k * .2), soft, TAPER.both); }
    ink([addV(addV(g.e, n, inner * wd[2] * .5), ud, -.07), addV(addV(g.e, n, inner * wd[2] * .38), dir, .05)], lw * .7, soft, TAPER.both);
    // forearm drape folds and the cuff edge / ribbing
    ink([addV(addV(cs, n, wd[4] * .45), dir, -.16), addV(addV(cs, n, wd[4] * .05), dir, -.03)], lw * .7, soft, TAPER.both);
    if (D.clothes === 'hina') for (const k of [-.25, 0, .25]) ink([addV(addV(cs, n, k * wd[5]), dir, .025), addV(addV(ce, n, k * wd[5]), dir, -.02)], lw * .5, soft, TAPER.both);
    else { const sc = tubePts([[...addV(ce, dir, -.03), wd[5] * .72], [...addV(ce, dir, .025), wd[5] * .68]], 3, false); drawGroup([{ path: polyPath(ccw(sc)), b: tone(D.shirt.s), s: tone(mixCol(D.shirt.s, '#7a82a6', .3)), d: .03 }], tone(D.line), lw * .7); }
    info[s < 0 ? 'handL' : 'handR'] = handAt;
  };
  // legs
  const drawLeg = s => {
    const g = s < 0 ? LL : LR, P = F(0, 0), off = [P[0] - Pv[0], P[1] - Pv[1]];
    const h = addV(g.h, [Pv[0], Pv[1]]), k = addV(g.k, [Pv[0], Pv[1]]), an = addV(g.an, [Pv[0], Pv[1]]), wd = D.legW;
    const m1 = [(h[0] * .5 + k[0] * .5), (h[1] * .5 + k[1] * .5)], m2 = [(k[0] * .5 + an[0] * .5), (k[1] * .5 + an[1] * .5)];
    const top = addV(h, [0, -.25]);
    const c1 = [k[0] * .7 + an[0] * .3, k[1] * .7 + an[1] * .3], c2 = [k[0] * .3 + an[0] * .7, k[1] * .3 + an[1] * .7];
    const P5 = [[...top, wd[0]], [...h, wd[0]], [...m1, wd[1]], [...k, wd[2]], [...c1, wd[3]], [...c2, wd[4]], [...an, wd[5]]];
    const parts = [], dirS = nrm2([an[0] - k[0], an[1] - k[1]]);
    // shoe
    const sideShoe = side || Math.abs(Math.sin(g.a2)) > .5, sf = side ? f : (Math.sin(g.a2) >= 0 ? 1 : -1);
    const footA = side ? (g.a2 - (o.ground === false ? 0 : 0)) * .5 : 0;
    const sh = D.shoe, shoeP = sideShoe
      ? [[-.1, -.06], [.03, -.1], [.2, -.06], [.3, .01], [.3, .06], [-.11, .06]].map(([a, b]) => { const r = rot2(a * sf, b, footA); return [an[0] + r[0], an[1] + D.ankleH * .35 + r[1]]; })
      : [[-.11, -.05], [.11, -.05], [.14, .05], [.08, .1], [-.08, .1], [-.14, .05]].map(([a, b]) => [an[0] + a + s * .02, an[1] + D.ankleH * .2 + b]);
    if (D.clothes === 'hina') {
      parts.push({ path: polyPath(ccw(tubePts(P5, 6))), b: tone(D.skin.b), s: tone(D.skin.s), h: tone(D.skin.h), d: .06, r: .012 });
      const sock = tubePts([[...addV(k, dirS, .16), wd[3] * 1.05], [...c1, wd[3] * 1.06], [...c2, wd[4] * 1.06], [...an, wd[5] * 1.12]], 6);
      parts.push({ path: polyPath(ccw(sock)), b: tone(D.sock.b), s: tone(D.sock.s), d: .06 });
    } else {
      parts.push({ path: polyPath(ccw(tubePts(P5.map((p, i) => [p[0], p[1], p[2]]), 6))), b: tone(D.pants.b), s: tone(D.pants.s), h: tone(D.pants.h), d: .08, r: .015 });
    }
    parts.push({ path: smooth(shoeP, true, 5), b: tone(sh.b), s: tone(sh.s), h: tone(sh.h), d: .04, r: .015 });
    drawGroup(parts, tone(D.line), lw);
    if (D.clothes === 'hina') { ink([addV(k, dirS, .2), addV(addV(k, dirS, .2), [-dirS[1], dirS[0]], wd[3] * .5)], lw * .6, tone(D.lineSoft)); }
    else { ink([addV(k, [0, -.1]), addV(k, [s * .05, .08]), addV(k, [s * .02, .2])], lw * .7, tone(D.lineSoft), TAPER.both); G.fillStyle = D.shoeAcc; }
    info[s < 0 ? 'footL' : 'footR'] = an;
  };
  // torso
  const torsoPts = () => {
    const R = D.torso.map(([v, w]) => F(v, w * wf + bt * .03 * (v > 1 ? 1 : 0))), Lf = D.torso.map(([v, w]) => F(v, -w * wf + bt * .03 * (v > 1 ? 1 : 0)));
    return [...R, ...Lf.reverse()];
  };
  const drawNeck = () => {
    const sn = Math.sin(hg.psi), nb = F(D.neckV - .12, -sn * .04), top = addV(addV(headO, dirA(hLean), .16), [-sn * .07 * Math.cos(hLean), 0]);
    const neck = polyPath(ccw(tubePts([[...nb, D.neckW * 1.05], [...top, D.neckW]], 4, false)));
    drawGroup([{ path: neck, b: tone(D.skin.b), s: tone(D.skin.s), d: .05 }], tone(D.line), lw);
    // the jaw's cast shadow on the neck
    G.save(); G.clip(neck); inFrame([Math.cos(hLean), Math.sin(hLean)], [-Math.sin(hLean), Math.cos(hLean)], headO, () => { G.fillStyle = tone(D.skin.s); G.fill(shifted(hg.facePath, _L[0] * -.02, .085)); }); G.restore();
  };
  const drawTorso = () => {
    const tp = torsoPts(), torso = smooth(tp, true, 5), parts = [];
    const cx = v => F(v, bt * .22 * wf);
    if (D.clothes === 'hina') {
      // skirt (under the cardigan hem), pleated
      const sw = sway[0] * .5, legSpread = Math.max(.62, Math.abs(LL.k[0] - LR.k[0]) * .5 + .3);
      const hem = []; const n = 9;
      for (let i = 0; i <= n; i++) { const k2 = i / n, xx = lerp(-legSpread, legSpread, k2) * lerp(1, .8, abt); hem.push(addV(F(-.66, xx), [sw * (1 - Math.abs(k2 - .5)), (i % 2 ? .035 : 0)])); }
      const skirtP = [F(.66, -.33 * wf), F(.66, .33 * wf), ...hem.slice().reverse().map((p, i) => i === 0 ? p : p)];
      const skirt = polyPath(ccw([F(.66, -.34 * wf), F(.66, .34 * wf), ...hem.slice().reverse()]));
      drawGroup([{ path: skirt, b: tone(D.skirt.b), s: tone(D.skirt.s), h: tone(D.skirt.h), d: .09, r: .02,
        clip: () => { for (let i = 1; i < n; i += 2) { G.fillStyle = tone(D.skirt.s); G.globalAlpha = .55; G.beginPath(); const a = F(.66, lerp(-.3, .3, i / n) * wf), b = F(.66, lerp(-.3, .3, (i + 1) / n) * wf); G.moveTo(...a); G.lineTo(...b); G.lineTo(...hem[i + 1]); G.lineTo(...hem[i]); G.fill(); G.globalAlpha = 1; } } }], tone(D.line), lw);
      for (let i = 1; i < n; i++) { const a = F(.3, lerp(-.34, .34, i / n) * wf); ink([a, hem[i]], lw * .8, tone(D.line), TAPER.tail); }
      // cardigan body
      parts.push({ path: torso, b: tone(D.cardigan.b), s: tone(D.cardigan.s), h: tone(D.cardigan.h), d: .1, r: .02 });
      drawGroup(parts, tone(D.line), lw);
      // hem ribbing, button line, collar + ribbon
      const hemL = F(.24, -.41 * wf), hemR = F(.24, .41 * wf); ink([hemL, cx(.22), hemR], lw * .8, tone(D.lineSoft), TAPER.soft);
      ink([cx(1.15), cx(.7), cx(.2)], lw * .9, tone(D.line), TAPER.soft);
      for (const v of [1.0, .75, .5]) { const b = cx(v); G.fillStyle = tone('#c9a870'); G.beginPath(); G.arc(b[0] + .035, b[1], .025, 0, TAU); G.fill(); }
      const c0 = cx(1.66), col = [[...F(1.62, -.2 * wf)], [...F(1.72, -.02)], [...F(1.72, .02)], [...F(1.62, .2 * wf)], [...cx(1.3)]];
      const flap = sg => polyPath(ccw(crPts([[...F(1.74, sg * .02)], [...F(1.7, sg * .15 * wf)], [...F(1.6, sg * .25 * wf)], [...F(1.37, sg * .2 * wf + bt * .06), 0, true], [...F(1.44, sg * .05 * wf + bt * .12)], [...F(1.5, bt * .15 * wf), 0, true]], true, 5)));
      const collarL = flap(-1), collarR = flap(1);
      drawGroup([{ path: collarL, b: tone(D.collar.b), s: tone(D.collar.s), d: .03 }, { path: collarR, b: tone(D.collar.b), s: tone(D.collar.s), d: .03 }], tone(D.line), lw * .9, { thick: .3 });
      // ribbon bow
      const rb = cx(1.43), bow = [];
      const loop = sg => polyPath(ccw(crPts([[rb[0], rb[1]], [rb[0] + sg * .14, rb[1] - .08], [rb[0] + sg * .19, rb[1] + .01], [rb[0] + sg * .1, rb[1] + .05]], true, 6)));
      const tail = sg => polyPath(ccw(crPts([[rb[0] + sg * .01, rb[1]], [rb[0] + sg * .08 + sway[0] * .3, rb[1] + .22], [rb[0] + sg * .05 + sway[0] * .3, rb[1] + .27, 0, true], [rb[0] + sg * .01 + sway[0] * .3, rb[1] + .22]], true, 5)));
      drawGroup([tail(-1), tail(1), loop(-1), loop(1)].map(p => ({ path: p, b: tone(D.ribbon.b), s: tone(D.ribbon.s), d: .025 })), tone(D.line), lw * .85);
      const knot = new Path2D(); knot.ellipse(rb[0], rb[1], .035, .04, 0, 0, TAU); drawGroup([{ path: knot, b: tone(D.ribbon.b), s: tone(D.ribbon.s), d: .01 }], tone(D.line), lw * .8);
    } else {
      parts.push({ path: torso, b: tone(D.blazer.b), s: tone(D.blazer.s), h: tone(D.blazer.h), d: .12, r: .02 });
      drawGroup(parts, tone(D.line), lw);
      // open jacket: shirt panel, tie, lapels
      const sh = polyPath(ccw([F(1.84, -.13 * wf), F(1.86, .0), F(1.84, .13 * wf), cx(1.1), F(.95, .1 * wf + bt * .2), F(-.08, .12 * wf + bt * .2), F(-.08, -.1 * wf + bt * .2), F(.95, -.1 * wf + bt * .2)]));
      drawGroup([{ path: sh, b: tone(D.shirt.b), s: tone(D.shirt.s), d: .04 }], tone(D.line), lw * .9, { thick: .2 });
      const tk = cx(1.6), tie = polyPath(ccw([[tk[0] - .045, tk[1]], [tk[0] + .045, tk[1]], addV(cx(.7), [.06 + sway[0] * .2, 0]), addV(cx(.62), [sway[0] * .2, .05]), addV(cx(.7), [-.06 + sway[0] * .2, 0])]));
      drawGroup([{ path: tie, b: tone(D.tie.b), s: tone(D.tie.s), d: .03 }], tone(D.line), lw * .85);
      for (const sg of [-1, 1]) ink([F(1.72, sg * .15 * wf), F(1.45, sg * .24 * wf + bt * .1), F(1.05, sg * .12 * wf + bt * .2), F(-.1, sg * .13 * wf + bt * .2)], lw * 1.1, tone(D.line), TAPER.soft);
      ink([F(1.45, .24 * wf), F(1.35, .3 * wf)], lw * .8, tone(D.line), TAPER.both); ink([F(1.45, -.24 * wf), F(1.35, -.3 * wf)], lw * .8, tone(D.line), TAPER.both);
      const pk = F(.35, .3 * wf * (bt >= 0 ? 1 : -1)); ink([addV(pk, [-.1, 0]), addV(pk, [.1, 0])], lw * .8, tone(D.lineSoft), TAPER.soft);
    }
  };
  // ---- draw order: back hair, far limbs, legs, neck, torso, near arms, head
  const near = f < 0 ? 1 : -1, far = -near;
  const armsOver = o.armsOver;
  drawBack();
  if (side) drawArm(far);
  if (side) { drawLeg(far); drawLeg(near); } else { drawLeg(-1); drawLeg(1); }
  drawNeck();
  drawTorso();
  if (!armsOver) { if (side) drawArm(near); else { drawArm(-1); drawArm(1); } }
  drawHead();
  if (armsOver) { if (side) drawArm(near); else { drawArm(-1); drawArm(1); } }
  _L = keepL;
  G.restore();
  // screen-space info for the scene (props, cameras, effects)
  const toW = p => [x + p[0] * u * fx * sx, y + p[1] * u * syy];
  info.head = toW(headO); info.u = u; info.top = toW(addV(headO, [0, -.6]))[1];
  if (info.handL) info.handL = toW(info.handL); if (info.handR) info.handR = toW(info.handR);
  if (info.footL) info.footL = toW(info.footL); if (info.footR) info.footR = toW(info.footR);
  // sparkles/hearts around the head for 'love'
  const fxl = [...(expr.fx || []), ...(o.fx || [])];
  if (fxl.includes('sparkles')) sparkles(t, info.head[0], info.head[1] - u * .1, u * 1.1, 7, D.name);
  return info;
}
const hina = (x, y, u, o) => drawChar(DESIGNS.hina, x, y, u, o);
const ren = (x, y, u, o) => drawChar(DESIGNS.ren, x, y, u, o);
// bust(): draw just the head and shoulders large (close-ups). Same options; (x, y) = the head centre on screen.
function bust(D, x, y, u, o = {}) {
  const h = D.hipH + D.neckV + D.neckLen + D.chinY + .02;
  return drawChar(D, x, y + (h - 0) * u, u, { ...o, ground: false, dy: 0 });
}
