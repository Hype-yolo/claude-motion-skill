// Standard snake skeleton (the names the snake motion engine, core/motion/snake.js, expects).
//
// Axial chain, head to tail tip:  nose <- v0 -> v1 -> ... -> vN
//   head        v0 -> nose            (v0 = occiput / atlas, the head's pivot on the neck)
//   spine0..    v(i) -> v(i+1)        (N bones, each pointing tail-ward; spine0 is the root bone)
// Rigid parts riding on the head (each meshed as its own rigid region):
//   jaw         jawHinge -> jawTip    (lower jaw, rotates about the quadrate hinge)
//   tongue      tongueBase -> tongueFork   (tongue shaft; slides forward out of its sheath in the jaw)
//   tongueTip   tongueFork -> tongueTip    (the forked tips; flick up and down)
//   fang        fangBase -> fangTip   (hinged maxillary fangs of vipers; folded along the palate at rest)
// A rattle (or any tail-tip ornament) is meshed as a rigid region on the last spine bone.
//
// Bind pose: the snake lies straight along -Z with its belly on y = 0; joint vi sits on the body axis
// at height = the distance from the axis to the belly (the engine reads it back as the axis height).
// Joints are on the midline (no left/right pairs).

/**
 * Spine joints v0..vN from a list of segment lengths and axis heights.
 * @param J        joint table to fill
 * @param z0       z of v0 (the occiput)
 * @param lens     N segment lengths (m), head -> tail
 * @param height   (sigma, t) -> axis height above the belly at arc distance sigma from v0 (t = sigma / total)
 */
export function snakeSpine(J, z0, lens, height) {
  const total = lens.reduce((a, b) => a + b, 0);
  let s = 0;
  J.v0 = [0, height(0, 0), z0];
  // place joints by arc length along the (slightly tilted) axis so bone lengths equal `lens`
  let z = z0;
  for (let i = 0; i < lens.length; i++) {
    s += lens[i];
    const y = height(s, s / total);
    const dy = y - J['v' + i][1];
    z -= Math.sqrt(Math.max(1e-10, lens[i] * lens[i] - dy * dy));
    J['v' + (i + 1)] = [0, y, z];
  }
  return J;
}

/** Bone list: head, jaw, tongue, tongueTip, fang, spine0..spine(n-1). */
export function snakeBones(n, { neck = 4, tail = 0 } = {}) {
  const b = [];
  for (let i = 0; i < n; i++) {
    const region = i < neck ? 'neck' : i >= n - tail ? 'tail' : 'torso';
    b.push(['spine' + i, 'v' + i, 'v' + (i + 1), i === 0 ? null : 'spine' + (i - 1), { region }]);
  }
  b.push(
    ['head', 'v0', 'nose', 'spine0', { region: 'head' }],
    ['jaw', 'jawHinge', 'jawTip', 'head', { region: 'jaw', group: 'jaw' }],
    ['tongue', 'tongueBase', 'tongueFork', 'jaw', { region: 'tongue', group: 'tongue' }],
    ['tongueTip', 'tongueFork', 'tongueTip', 'tongue', { region: 'tongue', group: 'tongue' }],
    ['fang', 'fangBase', 'fangTip', 'head', { region: 'fang', group: 'fang' }],
  );
  return b;
}

/** Axial chain description for buildRig (skin weights along nose -> tail tip). */
export function snakeAxial(n) {
  return {
    points: ['nose', ...Array.from({ length: n + 1 }, (_, i) => 'v' + i)],
    bones: ['head', ...Array.from({ length: n }, (_, i) => 'spine' + i)],
  };
}

/** Segment lengths for n bones over `total` metres: uniform, shortened toward the tail tip so the
 *  thin tail can curl tightly (tipShrink = length of the last bone relative to the others). */
export function snakeSegments(n, total, { tipShrink = 0.55, tipBones = 8, neckShrink = 0.85, neckBones = 3 } = {}) {
  const w = Array.from({ length: n }, (_, i) => {
    let k = 1;
    if (i >= n - tipBones) k = 1 - (1 - tipShrink) * ((i - (n - tipBones) + 1) / tipBones);
    if (i < neckBones) k = neckShrink + (1 - neckShrink) * (i / neckBones);
    return k;
  });
  const sw = w.reduce((a, b) => a + b, 0);
  return w.map((k) => (k * total) / sw);
}
