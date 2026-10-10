// cast.js: jointed paper puppets. Every body part is a separate cut piece; joints are brass split-pin brads, so limbs
// always visibly connect. Faces are layered paper (eye whites, pupils, eyelid pieces, brows, cheeks, replacement mouths).
//
//   pom(x, y, u, opts)   round orange critter in teal overalls (about 8.5u tall, 5u wide)
//   lulu(x, y, u, opts)  tall girl puppet in a mustard coat   (about 15u tall, 4u wide)
//   (x, y) = the ground point between the feet. u = size unit in px (medium shot: pom u≈55–75, lulu u≈32–42).
//
// opts (all optional):
//   face      expression name (see EXPR) or an object { eye, lid, brow, mouth, ... } — use moods() to change it
//   view      'front' | '3q' (three-quarter, facing screen-right; add flip:true to face left)
//   flip      mirror the puppet
//   look      [lx, ly] pupils (-1..1), or a number for lx
//   blink     0..1 extra eyelid (auto-blink runs anyway; blink:false turns auto-blink off)
//   armL/armR [shoulder, elbow] degrees. 0 = hanging down, +90 = pointing toward the facing side (screen-right
//             unless flipped), 180 = straight up, -90 = pointing back. Elbow adds to the shoulder angle.
//   footL/footR [dx, dy] in u: foot offset from its rest spot (dy < 0 lifts it). Knees bend by IK, so feet stay planted.
//   sq        squash (+) / stretch (−): the hips drop and the knees bend, torso+head widen slightly
//   dy        whole-puppet vertical offset in u (jumps; up is negative)
//   lean      torso lean in degrees (+ = toward the facing side); tilt = head tilt in degrees
//   holdL/holdR  a prop in that hand: 'apple' | 'balloon' | 'flower' | 'star' | 'gift' | 'letter' |
//             { prop, ang, s, col } | (x, y, ang, u) => draw. Drawn between the palm and the thumb (a real grip).
//   jit       per-step placement jitter in px (default ≈ u/50); 0 for a locked pose
// Returns the joints in world px: { hand: [L, R], elbow, shoulder, foot, head, top, mouth } for aiming props/emotes.

// ---------- expressions ----------
// eye: open | wide | arcUp (^ ^) | shut (> <) | heart ; lid 0..1 (upper eyelid) ; low 0..1 (lower lid, smiling eyes)
// tilt: lid slant (+ angry, − sad) ; brow: [lift, angle] (angle + = inner ends down/angry, − = worried)
// mouth: flat | set | small | smile | grin | open | frown | o | wail | grit | wobble ; cheek 0..2 ; tears, sweat, vein
const EXPR = {
  neutral: { eye: 'open', lid: .12, brow: [0, 0], mouth: 'flat', cheek: .7 },
  happy: { eye: 'open', lid: .06, low: .28, brow: [.25, -4], mouth: 'smile', cheek: 1 },
  laugh: { eye: 'arcUp', brow: [.45, -6], mouth: 'open', cheek: 1.2 },
  sad: { eye: 'open', lid: .4, tilt: -20, brow: [.1, -22], mouth: 'frown', cheek: .5, pupilY: .35 },
  cry: { eye: 'shut', brow: [.1, -24], mouth: 'wail', cheek: .9, tears: 1 },
  angry: { eye: 'open', lid: .42, tilt: 24, brow: [-.2, 26], mouth: 'grit', cheek: 0, vein: 1 },
  surprised: { eye: 'wide', pupil: .62, brow: [.8, -4], mouth: 'o', cheek: .4 },
  scared: { eye: 'wide', pupil: .45, brow: [.55, -20], mouth: 'wobble', cheek: 0, sweat: 1 },
  love: { eye: 'heart', brow: [.4, -8], mouth: 'grin', cheek: 1.6 },
  sleepy: { eye: 'open', lid: .7, brow: [-.05, -4], mouth: 'small', cheek: .6, pupilY: .3 },
  wink: { eye: 'open', eyeR: 'arcUp', lid: .05, low: .25, brow: [.3, -6], mouth: 'grin', cheek: 1.1 },
  determined: { eye: 'open', lid: .3, tilt: 12, brow: [-.1, 16], mouth: 'set', cheek: .4 },
  shy: { eye: 'open', lid: .25, pupilY: .4, look: [-.6, 0], brow: [.2, -12], mouth: 'small', cheek: 1.9 },
};
const MOUTH_IN = '#6E2331', MOUTH_LINE = '#4E2629';

// moods(lt, [[t, 'neutral'], [1.2, 'surprised'], ...]) → { face, blink, sq, dy } — a replacement-animation change:
// the eyes blink shut on the swap step (hiding the pop), with a small take on surprised/scared changes.
// Spread it into the puppet opts (add to sq/dy if you also jump): pom(x, y, u, { ...m, ... }).
function moods(lt, keys) {
  const st = sm(lt); let i = 0; while (i + 1 < keys.length && st >= keys[i + 1][0]) i++;
  const face = keys[i][1]; let blink = 0, sq = 0, dy = 0;
  for (let j = 1; j < keys.length; j++) {
    const tc = keys[j][0], d = Math.round((st - tc) * PAPER.fps);
    if (d === -1) blink = Math.max(blink, .55); else if (d === 0) blink = 1; else if (d === 1) blink = Math.max(blink, .45);
    const big = ['surprised', 'scared', 'angry', 'laugh'].includes(keys[j][1]);
    if (d === -1) sq += big ? .12 : .05;
    if (big && d >= 0 && d < 8) { const tk = take(st, tc, .8); sq += tk.sq; dy += tk.dy * .35; }
  }
  return { face, blink, sq, dy };
}
// auto blink: every few seconds, 3 steps, phase from the seed so two puppets never blink together
function autoBlink(seed) { const n = Math.floor(T * PAPER.fps + 1e-6), L = 38 + (seed % 3) * 11, p = (n + seed * 7) % L; return p === 0 ? .6 : p === 1 ? 1 : p === 2 ? .45 : 0; }

// walkCycle(lt, { rate, stride, lift, swing, phase }) → { footL, footR, armL, armR, dy, lean } (stepped)
// rate = full cycles per second. To keep planted feet from sliding, move the puppet at walkSpeed(o) * u px/s.
function walkCycle(lt, o = {}) {
  const rate = o.rate || 1.5, stride = o.stride ?? .75, lift = o.lift ?? .5, sw = o.swing ?? 34, p = frac(sm(lt) * rate + (o.phase || 0)), a = p * TAU;
  const leg = ph => { const b = ph * TAU; return [-Math.cos(b) * stride, -Math.max(0, Math.sin(b)) * lift]; };
  return { footL: leg(p), footR: leg(p + .5), armL: [-Math.cos(a) * sw + 4, 12], armR: [Math.cos(a) * sw + 4, 12], dy: -.14 * Math.abs(Math.sin(a)), lean: o.lean ?? 5 };
}
const walkSpeed = (o = {}) => 4 * (o.stride ?? .75) * (o.rate || 1.5);
// jumpPose(lt, t0, t1, h) → { dy, sq, armL, armR, footL, footR } : crouch + arms back → stretch + arms up → land squash
function jumpPose(lt, t0, t1, h = 3) {
  const st = sm(lt), j = jump(st, t0, t1, h), pre = seg(st, t0 - .3, t0), air = st >= t0 && st < t1, k = air ? (st - t0) / (t1 - t0) : 0, post = seg(st, t1, t1 + .35);
  let arm = st < t0 ? lerp(8, -40, pre) : air ? lerp(140, 110, k) : lerp(80, 10, post);
  const tuck = air ? Math.sin(k * Math.PI) : 0;
  return { dy: j.dy, sq: j.sq + (st < t0 ? .25 * pre : 0), armL: [-arm, air ? -10 : 10], armR: [arm, air ? 10 : 10], footL: [-.15 * tuck, -.45 * tuck], footR: [.2 * tuck, -.3 * tuck] };
}

// ---------- the generic puppet rig ----------
const dirOf = a => [Math.sin(a * D2R), Math.cos(a * D2R)];
function drawHold(h, x, y, ang, u) {
  if (!h) return;
  if (typeof h === 'function') return h(x, y, ang, u);
  const spec = typeof h === 'string' ? { prop: h } : h, f = PROPS[spec.prop]; if (!f) return;
  f(x + (spec.dx || 0) * u, y + (spec.dy || 0) * u, spec.ang ?? 0, (spec.s || .62) * u, spec.col);
}
function ik2(hx, hy, fx, fy, l1, l2, bend) {   // → knee [x, y]; bend +1 = knee toward +x side of the hip→foot line
  let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy); const maxd = (l1 + l2) * .999; if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; }
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), base = Math.atan2(dy, dx), s = bend > 0 ? -1 : 1;
  // atan2 frame: rotating the hip→foot direction by -a swings toward +x when the foot is below the hip
  const ang = base + s * a; return [hx + Math.cos(ang) * l1, hy + Math.sin(ang) * l1];
}
function puppet(D, x, y, u, o = {}) {
  const view = o.view === '3q' ? '3q' : 'front', q3 = view === '3q', flip = o.flip ? -1 : 1, V = D[view];
  const sq = o.sq || 0, lean = o.lean || 0, sx = 1 + .28 * sq, sy = 1 - .28 * sq, crouch = Math.max(0, sq) * D.crouch * u - Math.max(0, -sq) * .6 * u;
  const hipY = -D.hipH * u + crouch, lr = lean * D2R, cs = Math.cos(lr), sn = Math.sin(lr);
  const B = (px, py) => { const X = px * u * sx, Y = py * u * sy; return [X * cs - Y * sn, hipY + X * sn + Y * cs]; };
  const oy = y + (o.dy || 0) * u, W2 = (lx, ly) => [x + flip * lx, oy + ly];
  let e = typeof o.face === 'object' ? o.face : EXPR[o.face || 'neutral'] || EXPR.neutral;
  if (o.faceMix) e = { ...e, ...o.faceMix };
  const blink = o.blink === false ? 0 : Math.max(autoBlink(D.seed + (o.seed || 0)), o.blink || 0);
  const look = o.look == null ? (e.look || [0, 0]) : Array.isArray(o.look) ? o.look : [o.look, 0];
  const S = D.seed + (o.seed || 0) * 1000;
  const savedJ = PAPER.jit, savedD = PAPER.dry; PAPER.jit = o.jit ?? Math.min(2.2, u / 50); if (o.dry) PAPER.dry = true;
  G.save(); G.translate(x, oy); if (flip < 0) G.scale(-1, 1);
  const J = { hand: [], elbow: [], shoulder: [], foot: [] };

  // --- arms (FK) ---
  const arm = (i) => {
    const sp = B(...V.shoulders[i]), pose = (i === 0 ? o.armL : o.armR) || D.restArm[i], a1 = pose[0] + lean, a2 = a1 + (pose[1] || 0);
    const d1 = dirOf(a1), el = [sp[0] + d1[0] * D.upper * u, sp[1] + d1[1] * D.upper * u], d2 = dirOf(a2), hd = [el[0] + d2[0] * D.fore * u, el[1] + d2[1] * D.fore * u];
    const far = q3 && i === 0, tint = far ? D.farTint : 0, col = c => tint ? mixCol(c, '#3A2A30', tint) : c;
    piece(SH.capsule(D.upper * u, D.armR[0] * u, D.armR[1] * u), { x: sp[0], y: sp[1], rot: -a1, col: col(D.sleeve || D.limb), mat: D.sleeveMat, depth: 1, seed: S + 11 + i });
    piece(SH.capsule(D.fore * u, D.armR[1] * u, D.armR[2] * u), { x: el[0], y: el[1], rot: -a2, col: col(D.sleeve2 || D.sleeve || D.limb), mat: D.sleeveMat, depth: 1, seed: S + 13 + i });
    if (D.cuff) piece(SH.round(D.armR[2] * 2.3 * u, D.armR[2] * 1.1 * u, D.armR[2] * .5 * u), { x: el[0] + d2[0] * (D.fore - .08) * u, y: el[1] + d2[1] * (D.fore - .08) * u, rot: -a2, col: col(D.cuff), depth: .5, seed: S + 15 + i });
    brad(el[0], el[1], D.brad * u);
    // hand: palm, prop, thumb over it
    piece(SH.circle(D.handR * u), { x: hd[0], y: hd[1], col: col(D.hand), depth: .9, seed: S + 17 + i });
    const hold = i === 0 ? o.holdL : o.holdR;
    if (hold) {
      G.save(); if (flip < 0) { G.translate(hd[0], hd[1]); G.scale(-1, 1); G.translate(-hd[0], -hd[1]); }   // props stay readable (unmirrored)
      drawHold(hold, hd[0], hd[1], a2, u); G.restore();
      const td = dirOf(a2 + (i === 0 ? -70 : 70));
      piece(SH.ellipse(D.handR * .4 * u, D.handR * .58 * u), { x: hd[0] + td[0] * D.handR * .8 * u, y: hd[1] + td[1] * D.handR * .8 * u, rot: -a2, col: col(D.hand), depth: .8, seed: S + 19 + i });
    } else {
      const td = dirOf(a2 + (i === 0 ? -1 : 1) * 60 * (q3 ? 1 : 1));
      piece(SH.ellipse(D.handR * .42 * u, D.handR * .62 * u), { x: hd[0] + td[0] * D.handR * .78 * u, y: hd[1] + td[1] * D.handR * .78 * u, rot: -(a2 + (i === 0 ? -1 : 1) * 60), col: col(D.hand), depth: .6, seed: S + 21 + i });
    }
    brad(sp[0], sp[1], D.brad * u * 1.1);
    J.hand[i] = W2(...hd); J.elbow[i] = W2(...el); J.shoulder[i] = W2(...sp);
  };
  // --- legs (IK) ---
  const leg = (i) => {
    const hp = B(...V.hips[i]), off = (i === 0 ? o.footL : o.footR) || [0, 0], rest = V.feet[i];
    const ax = (rest[0] + off[0]) * u, ay = (-D.ankleH + (off[1] || 0)) * u;
    const bend = q3 ? 1 : (i === 0 ? -1 : 1), kn = ik2(hp[0], hp[1], ax, ay, D.thigh * u, D.shin * u, bend);
    const a1 = Math.atan2(kn[0] - hp[0], kn[1] - hp[1]) / D2R, kd = Math.hypot(ax - kn[0], ay - kn[1]), sd = Math.min(kd, D.shin * u), a2 = Math.atan2(ax - kn[0], ay - kn[1]) / D2R;
    const an = [kn[0] + Math.sin(a2 * D2R) * sd, kn[1] + Math.cos(a2 * D2R) * sd];
    const far = q3 && i === 0, col = c => far ? mixCol(c, '#3A2A30', D.farTint) : c;
    piece(SH.capsule(D.thigh * u, D.legR[0] * u, D.legR[1] * u), { x: hp[0], y: hp[1], rot: -a1, col: col(D.leg), mat: D.legMat, depth: 1, seed: S + 31 + i });
    piece(SH.capsule(sd, D.legR[1] * u, D.legR[2] * u), { x: kn[0], y: kn[1], rot: -a2, col: col(D.leg2 || D.leg), mat: D.legMat, depth: 1, seed: S + 33 + i });
    const fw = q3 ? 1 : (i === 0 ? -.45 : .45), toe = (off[1] || 0) < -.05 ? -8 * fw : 0;
    piece(D.footShape(u), { x: an[0] + fw * D.foot[2] * u, y: an[1] + D.foot[3] * u, rot: toe, sx: q3 || i === 1 ? 1 : -1, col: col(D.shoe), mat: D.shoeMat, depth: 1, seed: S + 35 + i });
    brad(kn[0], kn[1], D.brad * u);
    J.foot[i] = W2(an[0], an[1] + D.ankleH * u);
  };

  // draw order: far arm (3/4) · back pieces · legs · body · hip brads · head · near arms
  if (q3) arm(0);
  G.save(); G.translate(0, hipY); G.rotate(lr); G.scale(sx, sy); D.back(u, view, o, S); G.restore();
  leg(0); leg(1);
  G.save(); G.translate(0, hipY); G.rotate(lr); G.scale(sx, sy); D.body(u, view, o, S); G.restore();
  for (let i = 0; i < 2; i++) { const hp = B(...V.hips[i]); brad(hp[0], hp[1], D.brad * u * 1.1); }
  // head (tilt around the neck)
  const nk = V.neck, hc = V.head, tilt = (o.tilt || 0) + (flip < 0 ? 0 : 0);
  G.save(); G.translate(0, hipY); G.rotate(lr); G.scale(sx, sy); G.translate(nk[0] * u, nk[1] * u); G.rotate(tilt * D2R); G.translate((hc[0] - nk[0]) * u, (hc[1] - nk[1]) * u);
  D.head(u, view, o, S, e, { blink, look });
  G.restore();
  if (q3) arm(1); else { arm(0); arm(1); }
  G.restore(); PAPER.jit = savedJ; PAPER.dry = savedD;
  const hw = B(...V.head), tr = tilt * D2R;
  J.head = W2(hw[0], hw[1]); J.top = W2(hw[0] + Math.sin(tr + lr) * D.topR * u, hw[1] - Math.cos(tr + lr) * D.topR * u); J.mouth = W2(hw[0] + (q3 ? D.face.turn * u : 0), hw[1] + D.face.mouth[1] * u);
  return J;
}

// ---------- faces (layered paper) ----------
function drawFace(F, s, e, o, S) {
  const q3 = o.view === '3q', sh = q3 ? F.turn * s : 0, blink = o.blink || 0, L = o.look || [0, 0];
  const exOf = (x, i) => q3 ? x * .8 + sh + (i === 0 ? .06 * s : 0) : x;
  // cheeks first (under the eyes)
  if ((e.cheek ?? .7) > 0) F.cheeks.forEach(([cx0, cy0], i) => {
    const far = q3 && i === 0, k = e.cheek ?? .7, r = F.cheekR * s * (.75 + .25 * Math.min(k, 2));
    piece(SH.ellipse(r * (far ? .7 : 1), r * .8), { x: exOf(cx0 * s, i) + (far ? .1 * s : 0), y: cy0 * s, col: F.cheekCol || PC.pink, depth: .35, seed: S + 61 + i, alpha: clamp(.45 + .3 * k) });
  });
  F.eyes.forEach(([x0, y0], i) => {
    const side = i === 0 ? -1 : 1, far = q3 && i === 0, cx = exOf(x0 * s, i), cy = y0 * s, kind = (i === 1 && e.eyeR) || e.eye || 'open';
    const wide = kind === 'wide', rx = F.eyeR[0] * s * (far ? .78 : 1) * (wide ? 1.15 : 1), ry = F.eyeR[1] * s * (wide ? 1.15 : 1);
    const lid = clamp(Math.max(kind === 'wide' ? 0 : (e.lid || 0), blink));
    if (kind === 'heart') {
      piece(SH.heart(ry * 2.4), { x: cx, y: cy, rot: side * 8, col: PC.red, depth: .6, seed: S + 71 + i });
      piece(SH.ellipse(ry * .22, ry * .16), { x: cx - ry * .35, y: cy - ry * .25, col: PC.white, depth: .1, seed: S + 73 + i, edge: false });
    } else if (kind === 'arcUp' || (lid >= .97 && kind !== 'shut')) {
      const up = kind === 'arcUp';
      piece(SH.band(rx * .95, ry * .34, up ? 200 : 20, up ? 340 : 160), { x: cx, y: cy + (up ? ry * .45 : -ry * .35), col: F.lineCol || PC.ink, depth: .4, seed: S + 75 + i });
    } else if (kind === 'shut') {
      const d = -side * (q3 ? 1 : 1), w = rx * 1.1, t = ry * .22;
      piece(SH.poly([[-w * .55 * d, -ry * .55], [w * .55 * d, 0], [-w * .55 * d, ry * .55], [-w * .55 * d + t * d * 1.2, ry * .55 + t * .2], [w * .55 * d - t * 1.9 * d, 0], [-w * .55 * d + t * d * 1.2, -ry * .55 - t * .2]]), { x: cx, y: cy, col: F.lineCol || PC.ink, depth: .4, seed: S + 77 + i });
    } else {
      piece(SH.ellipse(rx, ry), { x: cx, y: cy, col: F.white || PC.white, mat: 'card', depth: .45, seed: S + 81 + i });
      const pr = F.pupil * s * (e.pupil ?? 1) * (far ? .9 : 1), mx = Math.max(0, rx - pr * 1.05), my = Math.max(0, ry - pr * 1.05);
      const px = cx + clamp(L[0] + (q3 ? .35 : 0), -1, 1) * mx * .8, py = cy + clamp((L[1] || 0) + (e.pupilY || 0), -1, 1) * my * .8;
      piece(SH.circle(pr), { x: px, y: py, col: F.pupilCol || PC.ink, depth: .3, seed: S + 83 + i });
      piece(SH.circle(pr * .32), { x: px - pr * .32, y: py - pr * .36, col: PC.white, depth: 0, seed: S + 85 + i, edge: false });
      if (lid > .02) {
        const E = SH.ellipse(rx * 1.14, ry * 1.14), phi = (e.tilt || 0) * -side * D2R, c0 = -ry * 1.14 + 2 * ry * 1.14 * lid;
        piece(clipHalf(E, Math.sin(phi), Math.cos(phi), c0), { x: cx, y: cy, col: F.lid, depth: .45, seed: S + 87 + i });
      }
      if ((e.low || 0) > .02) piece(clipHalf(SH.ellipse(rx * 1.14, ry * 1.14), 0, -1, -(ry * 1.14 * (1 - 2 * e.low))), { x: cx, y: cy, col: F.lid, depth: .35, seed: S + 89 + i });
    }
    // brow
    if (F.brow && e.brow) {
      const [lift, ang] = e.brow, bw = F.brow[0] * s * (far ? .8 : 1);
      piece(SH.round(bw, F.brow[1] * s, F.brow[1] * s * .5), { x: cx, y: cy - ry - F.brow[2] * s - lift * ry * .7, rot: -side * ang, col: F.browCol || PC.ink, depth: .35, seed: S + 91 + i });
    }
    // tears: tissue streams + falling drops
    if (e.tears) {
      const tx = cx + side * rx * .55;
      piece(SH.round(ry * .5, ry * 2.4, ry * .25), { x: tx, y: cy + ry * 1.6, col: '#8FD0F0', mat: 'tissue', depth: .2, seed: S + 95 + i });
      for (let k = 0; k < 2; k++) { const p = frac(sm(T) * 1.4 + k * .5 + i * .25); piece(SH.drop(ry * .32), { x: tx + side * p * ry * 1.4, y: cy + ry * (1.2 + p * 3.2), col: '#8FD0F0', mat: 'tissue', depth: .8, seed: S + 97 + k + i * 2, alpha: 1 - p * .6 }); }
    }
  });
  const mx = (F.mouth[0] * s) * (q3 ? .8 : 1) + sh * 1.05, my = F.mouth[1] * s;
  drawMouth(e.mouth || 'flat', mx, my, s * F.mouthS, S, q3);
  if (e.sweat) piece(SH.drop(.26 * s), { x: (F.sweat[0] * s) + sh * .6, y: F.sweat[1] * s + sm(T) * 0, col: '#9AD6F2', mat: 'tissue', depth: 1, seed: S + 99 });
  if (e.vein) { const vx = F.vein[0] * s + sh * .5, vy = F.vein[1] * s; for (let k = 0; k < 4; k++) piece(SH.band(.2 * s, .08 * s, 100, 170), { x: vx + (k % 2 ? .1 : -.1) * s, y: vy + (k < 2 ? .1 : -.1) * s, rot: k * 90, col: PC.red, depth: .5, seed: S + 101 + k }); }
}
function drawMouth(kind, x, y, s, S, q3) {
  const P = (sh, o) => piece(sh, { x, y, depth: .35, seed: S + 111, col: MOUTH_LINE, ...o });
  switch (kind) {
    case 'flat': P(SH.round(.6 * s, .12 * s, .06 * s)); break;
    case 'set': P(SH.round(.5 * s, .12 * s, .06 * s), { rot: -7 }); break;
    case 'small': P(SH.ellipse(.13 * s, .1 * s), { col: MOUTH_IN }); break;
    case 'smile': P(SH.band(.4 * s, .13 * s, 28, 152), { y: y - .3 * s }); break;
    case 'frown': P(SH.band(.36 * s, .12 * s, 212, 328), { y: y + .38 * s }); break;
    case 'grin': P(SH.smooth([[-.5 * s, -.1 * s, 1], [.5 * s, -.1 * s, 1], [.3 * s, .22 * s], [0, .3 * s], [-.3 * s, .22 * s]]), { col: MOUTH_IN }); piece(SH.ellipse(.2 * s, .08 * s), { x, y: y + .14 * s, col: PC.rose, depth: .1, seed: S + 112 }); break;
    case 'open': P(SH.smooth([[-.46 * s, -.16 * s, 1], [.46 * s, -.16 * s, 1], [.38 * s, .2 * s], [0, .5 * s], [-.38 * s, .2 * s]]), { col: MOUTH_IN }); piece(SH.ellipse(.24 * s, .12 * s), { x, y: y + .3 * s, col: PC.rose, depth: .1, seed: S + 113 }); piece(SH.round(.62 * s, .09 * s, .04 * s), { x, y: y - .1 * s, col: PC.white, depth: .1, seed: S + 114 }); break;
    case 'o': P(SH.ellipse(.2 * s, .27 * s), { col: MOUTH_IN }); piece(SH.ellipse(.11 * s, .08 * s), { x, y: y + .12 * s, col: PC.rose, depth: .1, seed: S + 115 }); break;
    case 'wail': P(SH.smooth([[-.5 * s, .08 * s, 1], [0, -.22 * s], [.5 * s, .08 * s, 1], [.36 * s, .42 * s], [0, .5 * s], [-.36 * s, .42 * s]]), { col: MOUTH_IN }); piece(SH.ellipse(.22 * s, .1 * s), { x, y: y + .36 * s, col: PC.rose, depth: .1, seed: S + 116 }); break;
    case 'grit': P(SH.round(.82 * s, .38 * s, .1 * s)); piece(SH.round(.7 * s, .26 * s, .06 * s), { x, y, col: PC.white, depth: .15, seed: S + 117 }); piece(SH.rect(.66 * s, .04 * s), { x, y, col: MOUTH_LINE, depth: 0, seed: S + 118, edge: false }); break;
    case 'wobble': { const a = [], n = 6, w = .7 * s, t = .1 * s; for (let i = 0; i <= n; i++) a.push([-w / 2 + w * i / n, (i % 2 ? -1 : 1) * .07 * s - t / 2]); for (let i = n; i >= 0; i--) a.push([-w / 2 + w * i / n, (i % 2 ? -1 : 1) * .07 * s + t / 2]); P(SH.poly(a)); break; }
  }
}

// ---------- emotes (paper marks that pop in, stepped) ----------
// emote(kind, x, y, s, age) kinds: '!' '?' heart sweat zzz anger sparkle note ; age = seconds since it appeared
function emote(kind, x, y, s = 40, age = 1) {
  const a = sm(age); if (a < 0) return; const pop = a < .25 ? backOut(a / .25) : 1, bob = sway('em' + kind, .08 * s, .9);
  G.save(); G.translate(x, y + bob); G.scale(pop, pop);
  const P = (sh, o) => piece(sh, { depth: 1.4, seed: 1900, jit: 0, ...o });
  switch (kind) {
    case '!': P(SH.poly([[-.3 * s, -1.6 * s], [.3 * s, -1.6 * s], [.15 * s, -.35 * s], [-.15 * s, -.35 * s]]), { col: PC.red }); P(SH.circle(.2 * s), { y: 0, col: PC.red, seed: 1901 }); break;
    case '?': P(SH.band(.45 * s, .26 * s, 180, 400), { y: -1.15 * s, col: PC.blue }); P(SH.round(.26 * s, .45 * s, .1 * s), { y: -.5 * s, col: PC.blue, seed: 1902 }); P(SH.circle(.17 * s), { y: 0, col: PC.blue, seed: 1903 }); break;
    case 'heart': P(SH.heart(1.2 * s), { rot: sway('eh', 8, .8), col: PC.red }); P(SH.heart(.55 * s), { x: .75 * s, y: -.8 * s, rot: 15, col: PC.rose, seed: 1904 }); break;
    case 'sweat': P(SH.drop(.35 * s), { col: '#9AD6F2', mat: 'tissue' }); break;
    case 'zzz': [0, 1, 2].forEach(i => { const z = (.35 + i * .15) * s; P(SH.poly([[-z, -z], [z, -z], [z, -z + z * .35], [-z * .35, z - z * .35], [z, z - z * .35], [z, z], [-z, z], [-z, z - z * .35], [z * .35, -z + z * .35], [-z, -z + z * .35]]), { x: i * .6 * s, y: -i * .8 * s, rot: -10, col: PC.lilac, seed: 1905 + i }); }); break;
    case 'anger': for (let k = 0; k < 4; k++) P(SH.band(.32 * s, .13 * s, 100, 170), { x: (k % 2 ? .16 : -.16) * s, y: (k < 2 ? .16 : -.16) * s, rot: k * 90, col: PC.red, seed: 1910 + k }); break;
    case 'sparkle': [[0, 0, 1], [.9, -.6, .55], [-.7, -.9, .45]].forEach(([dx, dy, k], i) => P(SH.star(.6 * s * k, .18 * s * k, 4), { x: dx * s, y: dy * s, rot: sway('sp' + i, 10, .7), col: i ? PC.lemon : PC.yellow, seed: 1915 + i })); break;
    case 'note': P(SH.ellipse(.32 * s, .24 * s), { rot: -20, col: PC.ink }); P(SH.rect(.1 * s, 1.1 * s), { x: .26 * s, y: -.55 * s, col: PC.ink, seed: 1920 }); P(SH.poly([[.2 * s, -1.1 * s], [.7 * s, -.85 * s], [.7 * s, -.6 * s], [.2 * s, -.8 * s]]), { col: PC.ink, seed: 1921 }); break;
  }
  G.restore();
}

// ---------- POM: round orange critter, teal overalls, red boots ----------
const POM = {
  seed: 1000, hipH: 2.05, crouch: 1.1, ankleH: .3, thigh: .95, shin: .92, legR: [.42, .38, .34], upper: .9, fore: .82, armR: [.36, .33, .3], handR: .44,
  brad: .13, topR: 3.2, farTint: .12,
  limb: PC.orange, sleeve: PC.orange, hand: PC.orange, leg: PC.orange, shoe: PC.red, restArm: [[-14, 8], [14, -8]],
  foot: [0, 0, .22, -.02], footShape: u => SH.smooth([[-.5 * u, .12 * u], [-.45 * u, -.22 * u], [.25 * u, -.3 * u], [.65 * u, -.05 * u], [.6 * u, .22 * u], [0, .3 * u]]),
  front: { hips: [[-.72, 0], [.72, 0]], feet: [[-.95, 0], [.95, 0]], shoulders: [[-1.45, -1.85], [1.45, -1.85]], neck: [0, -2.6], head: [0, -4.35] },
  '3q': { hips: [[-.35, -.05], [.62, 0]], feet: [[-.55, 0], [.75, 0]], shoulders: [[-.95, -1.95], [1.3, -1.8]], neck: [.1, -2.6], head: [.12, -4.35] },
  face: { eyes: [[-.8, -.28], [.8, -.28]], eyeR: [.44, .54], pupil: .27, lid: PC.orange, brow: [.55, .13, .22], browCol: PC.bark, lineCol: PC.ink,
    cheeks: [[-1.52, .4], [1.52, .4]], cheekR: .36, mouth: [0, .92], mouthS: .9, turn: .62, sweat: [2.2, -.9], vein: [1.4, -1.5] },
  back(u, view, o, S) {   // curled tail behind the body (a thick paper crescent with a cream tip)
    const q3 = view === '3q', sd = q3 ? -1 : 1, w = sway('pomtail', 5, .7);
    G.save(); G.translate(sd * 1.25 * u, -.1 * u); G.scale(sd, 1); G.rotate(w * D2R);
    piece(SH.band(.95 * u, .5 * u, 95, 300), { x: .75 * u, y: -.95 * u, col: PC.orange, depth: 1, seed: S + 1 });
    const e = [.75 * u + Math.cos(300 * D2R) * .95 * u, -.95 * u + Math.sin(300 * D2R) * .95 * u];
    piece(SH.circle(.3 * u), { x: e[0], y: e[1], col: PC.tangerine, depth: .5, seed: S + 2 });
    G.restore();
  },
  body(u, view, o, S) {
    const q3 = view === '3q', bx = q3 ? .1 : 0, bs = q3 ? .93 : 1;
    const body = SH.smooth([[0, -2.9 * u], [1.3 * u, -2.5 * u], [1.8 * u, -1.25 * u], [1.6 * u, -.1 * u], [.85 * u, .42 * u], [0, .48 * u], [-.85 * u, .42 * u], [-1.6 * u, -.1 * u], [-1.8 * u, -1.25 * u], [-1.3 * u, -2.5 * u]]);
    piece(body, { x: bx * u, sx: bs, col: PC.orange, depth: 1.2, seed: S + 3 });
    piece(clipHalf(body, 0, -1, 1.0 * u), { x: bx * u, sx: bs, col: PC.teal, depth: .5, seed: S + 4 });                                   // trousers
    const bib = q3 ? .35 : 0;
    piece(SH.round(1.55 * u, 1.2 * u, .22 * u), { x: bib * u, y: -1.35 * u, col: PC.teal, depth: .5, seed: S + 5 });                    // bib
    piece(SH.round(.7 * u, .5 * u, .1 * u), { x: (bib + .05) * u, y: -1.25 * u, rot: -3, col: mixCol(PC.teal, PC.navy, .3), depth: .3, seed: S + 6 });   // pocket
    [-1, 1].forEach((sd, i) => { const x0 = (bib + sd * .6) * u; piece(SH.round(.26 * u, 1.05 * u, .1 * u), { x: x0 + sd * .12 * u, y: -2.2 * u, rot: sd * 14, col: PC.teal, depth: .5, seed: S + 7 + i }); brad(x0, -1.85 * u, .14 * u); });
  },
  head(u, view, o, S, e, st) {
    const q3 = view === '3q', F = POM.face;
    // ears (behind the head)
    const ears = q3 ? [[-1.05, -1.55, -24, .85], [1.55, -1.45, 18, 1]] : [[-1.45, -1.5, -20, 1], [1.45, -1.5, 20, 1]];
    ears.forEach(([ex, ey, r, k], i) => {
      const ear = SH.smooth([[-.72 * u * k, .35 * u, 1], [-.12 * u * k, -1.0 * u * k], [.12 * u * k, -1.02 * u * k], [.7 * u * k, .35 * u, 1]]);
      piece(ear, { x: ex * u, y: ey * u, rot: r + sway('pomear' + i, 3, .6), col: q3 && i === 0 ? mixCol(PC.orange, '#3A2A30', .1) : PC.orange, depth: 1, seed: S + 41 + i });
      piece(SH.smooth([[-.4 * u * k, .25 * u, 1], [-.06 * u * k, -.62 * u * k], [.06 * u * k, -.62 * u * k], [.4 * u * k, .25 * u, 1]]), { x: ex * u, y: (ey + .02) * u, rot: r + sway('pomear' + i, 3, .6), col: PC.pink, depth: .3, seed: S + 43 + i });
    });
    const hs = q3 ? .95 : 1;
    piece(SH.ellipse(2.4 * u * hs, 2.08 * u), { x: q3 ? .08 * u : 0, col: PC.orange, depth: 1.3, seed: S + 45 });
    // cream muzzle and a fringe tuft
    piece(SH.ellipse(1.42 * u * (q3 ? .9 : 1), 1.0 * u), { x: (q3 ? F.turn * 1.05 : 0) * u, y: .72 * u, col: PC.cream, depth: .45, seed: S + 46 });
    piece(SH.smooth([[-.6 * u, 0, 1], [-.3 * u, -.55 * u], [0, -.2 * u], [.3 * u, -.62 * u], [.62 * u, 0, 1], [0, .15 * u]]), { x: (q3 ? .35 : 0) * u, y: -1.95 * u, rot: 4, col: PC.tangerine, depth: .6, seed: S + 47 });
    drawFace(F, u, e, { view, blink: st.blink, look: st.look }, S);
    // nose on the muzzle (above the mouth)
    piece(SH.smooth([[-.26 * u, -.08 * u], [.26 * u, -.08 * u], [.05 * u, .2 * u], [-.05 * u, .2 * u]]), { x: (q3 ? F.turn * 1.25 : 0) * u, y: .42 * u, col: PC.bark, depth: .4, seed: S + 49 });
  },
};
function pom(x, y, u, o = {}) { return puppet(POM, x, y, u, o); }

// ---------- LULU: tall girl puppet, mustard coat, navy bob, rose scarf, lilac tights ----------
const LULU = {
  seed: 2000, hipH: 4.45, crouch: 1.6, ankleH: .32, thigh: 2.15, shin: 2.05, legR: [.36, .31, .27], upper: 1.7, fore: 1.55, armR: [.33, .29, .26], handR: .36,
  brad: .12, topR: 3.6, farTint: .12,
  limb: PC.skin, sleeve: PC.mustard, cuff: mixCol(PC.mustard, PC.brown, .25), hand: PC.skin, leg: PC.lilac, shoe: PC.red, restArm: [[-10, 6], [10, -6]],
  foot: [0, 0, .25, -.02], footShape: u => SH.smooth([[-.55 * u, .14 * u], [-.5 * u, -.2 * u], [.3 * u, -.28 * u], [.75 * u, -.02 * u], [.68 * u, .2 * u], [0, .28 * u]]),
  front: { hips: [[-.5, 0], [.5, 0]], feet: [[-.62, 0], [.62, 0]], shoulders: [[-1.12, -4.05], [1.12, -4.05]], neck: [0, -4.6], head: [0, -6.55] },
  '3q': { hips: [[-.2, -.05], [.45, 0]], feet: [[-.35, 0], [.55, 0]], shoulders: [[-.75, -4.1], [.95, -4.0]], neck: [.12, -4.6], head: [.15, -6.55] },
  face: { eyes: [[-.58, .08], [.58, .08]], eyeR: [.3, .38], pupil: .2, lid: PC.skin, brow: [.42, .1, .16], browCol: PC.navy, lineCol: PC.ink,
    cheeks: [[-.98, .62], [.98, .62]], cheekR: .26, mouth: [0, .98], mouthS: .62, turn: .42, sweat: [1.6, -.4], vein: [1.0, -1.1] },
  back(u, view, o, S) {   // scarf tail (it swings behind)
    const q3 = view === '3q', sw = sway('lulus', 5, .6);
    G.save(); G.translate((q3 ? -.35 : .55) * u, -4.4 * u); G.rotate(((q3 ? 28 : 12) + sw) * D2R);
    piece(SH.round(.5 * u, 1.9 * u, .2 * u), { y: .9 * u, col: PC.rose, depth: 1, seed: S + 1 });
    stripes(0, 1.75 * u, .5 * u, .2 * u, 3, [PC.rose, PC.white], { seed: S + 2, depth: .2 });
    G.restore();
  },
  body(u, view, o, S) {
    const q3 = view === '3q', cx = q3 ? .08 : 0, k = q3 ? .92 : 1;
    const coat = SH.smooth([[-.95 * u, -4.55 * u], [.95 * u, -4.55 * u], [1.35 * u, -3.7 * u], [1.55 * u, -1.2 * u], [2.0 * u, .85 * u, 1], [0, 1.02 * u], [-2.0 * u, .85 * u, 1], [-1.55 * u, -1.2 * u], [-1.35 * u, -3.7 * u]]);
    piece(coat, { x: cx * u, sx: k, col: PC.mustard, depth: 1.2, seed: S + 11 });
    const fx = (q3 ? .55 : 0) * u;
    piece(SH.rect(.08 * u, 5.1 * u), { x: fx + .05 * u, y: -1.75 * u, col: mixCol(PC.mustard, PC.brown, .35), depth: .15, seed: S + 12 });   // front seam
    [-3.3, -2.3, -1.3].forEach((by, i) => brad(fx + .38 * u, by * u, .15 * u));
    [-1, 1].forEach((sd, i) => { if (q3 && sd < 0) return; piece(SH.round(.8 * u, .62 * u, .12 * u), { x: fx + sd * (q3 ? 1.15 : 1.0) * u, y: -.7 * u, rot: sd * -4, col: mixCol(PC.mustard, PC.orange, .3), depth: .35, seed: S + 13 + i }); });
    // neck + scarf wrap
    piece(SH.capsule(.9 * u, .3 * u), { x: (q3 ? .1 : 0) * u, y: -5.2 * u, col: mixCol(PC.skin, PC.peach, .4), depth: .4, seed: S + 15 });
    piece(SH.round(2.1 * u * k, .62 * u, .3 * u), { x: (cx + (q3 ? .1 : 0)) * u, y: -4.45 * u, rot: q3 ? -4 : 0, col: PC.rose, depth: .9, seed: S + 16 });
    stripes((cx + (q3 ? .1 : 0)) * u, -4.45 * u, .5 * u, .56 * u, 2, [PC.white, PC.rose], { seed: S + 17, depth: .1 });
  },
  head(u, view, o, S, e, st) {
    const q3 = view === '3q', F = LULU.face;
    // hair back piece, bun and hair tie (behind the face)
    piece(SH.smooth([[-1.75 * u, 1.0 * u, 1], [-1.85 * u, -.6 * u], [-1.2 * u, -1.75 * u], [0, -2.1 * u], [1.2 * u, -1.75 * u], [1.85 * u, -.6 * u], [1.75 * u, 1.0 * u, 1], [0, .75 * u]]), { x: (q3 ? -.3 : 0) * u, col: PC.navy, depth: 1.2, seed: S + 3 });
    piece(SH.circle(.78 * u), { x: (q3 ? -.35 : 0) * u, y: -2.35 * u, col: PC.navy, depth: 1, seed: S + 4 });
    piece(SH.round(.9 * u, .28 * u, .1 * u), { x: (q3 ? -.3 : 0) * u, y: -1.72 * u, rot: q3 ? -8 : 0, col: PC.rose, depth: .6, seed: S + 5 });
    if (q3) piece(SH.poly([[0, -.3 * u], [.42 * u, .12 * u], [0, .22 * u]]), { x: 1.43 * u, y: .3 * u, col: PC.skin, depth: .8, seed: S + 20 });   // nose tip at the profile edge
    piece(SH.ellipse(1.48 * u * (q3 ? .96 : 1), 1.72 * u), { x: (q3 ? .05 : 0) * u, col: PC.skin, depth: 1.2, seed: S + 21 });
    if (q3) piece(SH.ellipse(.3 * u, .42 * u), { x: -1.0 * u, y: .1 * u, col: mixCol(PC.skin, PC.peach, .5), depth: .4, seed: S + 22 });   // ear
    // bangs: a scalloped fringe
    const bang = []; const n = 5; bang.push([-1.62 * u, .1 * u, 1]); bang.push([-1.45 * u, -1.25 * u]); bang.push([0, -1.9 * u]); bang.push([1.45 * u, -1.25 * u]); bang.push([1.62 * u, .1 * u, 1]);
    for (let i = n; i >= 0; i--) { const xx = -1.4 * u + 2.8 * u * i / n; bang.push([xx, (i % 2 ? -.72 : -.52) * u - (i === 0 || i === n ? -.35 * u : 0)]); }
    piece(SH.smooth(bang), { x: (q3 ? .32 : 0) * u, y: 0, col: PC.navy, depth: .9, seed: S + 23 });
    drawFace(F, u, e, { view, blink: st.blink, look: st.look }, S);
    if (!q3) piece(SH.ellipse(.13 * u, .1 * u), { x: 0, y: .5 * u, col: mixCol(PC.skin, PC.rose, .35), depth: .25, seed: S + 24 });
  },
};
function lulu(x, y, u, o = {}) { return puppet(LULU, x, y, u, o); }

// ---------- model sheets (render: node render.mjs --loop=faces --sheet=0 --cols=1 --w=1600 --out=out/check/faces.jpg) ----------
LOOPS.faces = t => {
  backdrop(PC.sand);
  const names = Object.keys(EXPR);
  names.forEach((nm, i) => {
    const col = i % 7, row = Math.floor(i / 7), x = 150 + col * 270, y = 470 + row * 520;
    pom(x - 55, y, 38, { face: nm, blink: false, jit: 0, view: i % 2 ? '3q' : 'front' });
    lulu(x + 80, y + 20, 22, { face: nm, blink: false, jit: 0, view: i % 2 ? 'front' : '3q', flip: true });
    G.save(); G.font = '700 26px "Noto Sans TC", sans-serif'; G.fillStyle = PC.ink; G.textAlign = 'center'; G.fillText(nm, x, y + 50); G.restore();
  });
};
LOOPS.faces.len = 1;
LOOPS.poses = t => {
  backdrop(PC.mint);
  pom(260, 900, 70, { face: 'happy', holdR: 'apple', armR: [120, 30], jit: 0 });
  pom(640, 900, 70, { face: 'determined', view: '3q', ...walkCycle(.25), jit: 0 });
  lulu(1000, 950, 40, { face: 'love', holdL: 'flower', armL: [-70, -40], armR: [150, 20], jit: 0 });
  lulu(1350, 950, 40, { view: '3q', face: 'neutral', ...walkCycle(.1, { stride: .9 }), jit: 0 });
  pom(1700, 900, 62, { view: '3q', flip: true, face: 'surprised', ...jumpPose(1.25, 1.2, 1.7, 2), jit: 0 });
};
LOOPS.poses.len = 1;
