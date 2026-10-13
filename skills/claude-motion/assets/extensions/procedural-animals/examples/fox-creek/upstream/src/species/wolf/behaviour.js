// Wolf body language, layered over the core actions every frame (species.motion.hooks.update, see
// core/motion/actions.js).
//
// Tail carriage by mood (Schenkel 1947 in Mech & Boitani 2003): hangs at rest, ~level in the
// travelling trot (the carriage table in motion.js), raised stiff above the back in a threat or an
// attack, tucked between the hind legs when hit or afraid. Ears: pricked forward when alert (a look
// target), pinned flat in an attack (core) and when howling. Hackles: the long guard hair of the
// mane, cape and saddle lifts during an attack (P.furRaise -> the coat shader). Snarl: the jaw opens
// on the crouch before the bite so the canines show. Howling: an idle variant every 25-60 s of
// standing still (or on demand via `motion.input.howl = true`): head thrown back 50-60 deg, ears
// back, jaw half open in an "O", lasting 3-6 s.
import { clamp, smooth, lerp, angDiff } from '../../core/motion/common.js';
import { mx, mxLegs } from '../../core/motion/actions.js';
const sm = (w) => w * w * (3 - 2 * w);

// moveTo: a wolf slows down to turn onto a point close beside or behind it. The engine caps the speed
// only by the heading error (1.5 sk beyond 1.2 rad), so with the wolf's calm turn rate (1.8 rad/s) a
// target inside its turning circle was circled without end. A point is reachable
// on a turn of radius R only while it lies outside the turning circle on its side: R < d / (2 sin err)
// (d distance, err bearing from the heading). The speed is capped so the radius at the engine's yaw
// limit, v / w(v), keeps a margin inside that bound; near the point and well off the heading the wolf
// all but pivots, then goes. (Engine-wide, the same cap belongs in quadruped.js drive().)
const ARRIVE_MARGIN = 0.8;
function arriveCap(e, st) {
  const inp = e.input, cfg = e.cfg;
  // arrived (drive() dropped the target and zeroed the speed): stand facing the way it went instead of
  // pivoting on to the last bearing of the point (a front paw dragged ~2 % S in that pivot)
  if (st.tgt && !inp.target && !inp.follow && !inp.speed && Math.hypot(st.tgt.x - e.pos.x, st.tgt.z - e.pos.z) < 0.5 * cfg.k + 0.03 * e.speed) {
    inp.heading = e.heading + 0.25 * e.yawRate;
    e.wantHeading = inp.heading;
  }
  st.tgt = inp.target && !inp.follow ? (st.tgt || { x: 0, z: 0 }) : null;
  if (!st.tgt) return;
  st.tgt.x = inp.target.x; st.tgt.z = inp.target.z;
  if (!(e.wantSpeed > 0.05) || e.air?.active) return;
  const dx = inp.target.x - e.pos.x, dz = inp.target.z - e.pos.z, d = Math.hypot(dx, dz);
  const err = Math.abs(angDiff(e.heading, Math.atan2(dx, dz))), sn = Math.sin(err);
  if (sn < 1e-3) return;
  const rMax = (ARRIVE_MARGIN * d) / (2 * sn);
  // the engine's yaw-rate limit at speed v (quadruped.js step: pivots are slower than turns on the move)
  const wAt = (v) => Math.min(cfg.turnRate * lerp(0.55, 1, smooth(0.3, 2, v / cfg.sq)), cfg.latAccelMax / Math.max(v, 0.5 * cfg.sk));
  if (e.wantSpeed / wAt(e.wantSpeed) <= rMax) return;
  // v / w(v) grows with v: bisect for the fastest speed whose turning radius fits
  let lo = 0, hi = e.wantSpeed;
  for (let i = 0; i < 12; i++) { const m = 0.5 * (lo + hi); if (m / wAt(m) <= rMax) lo = m; else hi = m; }
  // (a point ahead that the straight line passes within the stop radius needs no turn: the cap fades out)
  const stopR = 0.35 * cfg.k + 0.02 * e.speed;
  e.wantSpeed = lerp(e.wantSpeed, lo, err < 1.2 ? smooth(0.4 * stopR, 0.8 * stopR, d * sn) : 1);
}

export function wolfUpdate(P, dt, L) {
  const e = L.engine;
  const st = L._wolf || (L._wolf = { howlIn: 25 + e.rand() * 20, howlT: -1, howlDur: 4, howlW: 0 });
  arriveCap(e, st);
  // (the sleeping forepaw pull-back below overrides this animal's fold placement only while it sleeps)
  if (st.acts && st.acts.fold && !L.postures.some((p) => p.name === 'sleep')) st.acts.fold = undefined;
  let raise = 0;

  for (const a of L.oneshots) {
    const w = sm(a.w);
    if (w <= 0) continue;
    if (a.name === 'attack') {
      const t = a.t;
      // threat -> lunge: hackles up, tail raised stiff above the back, snarl before the bite
      raise = Math.max(raise, w * (0.5 + 0.5 * smooth(0, 0.2, t)));
      mx(P, 'tailLift', 0.75, w); mx(P, 'tailStiff', 1.8, w);
      const snarl = smooth(0.0, 0.12, t) * (1 - smooth(0.22, 0.3, t));
      P.jaw = Math.max(P.jaw, 0.3 * snarl * w); // (the lower fangs come clear of the upper lip)
      mx(P, 'headRaise', -0.035, snarl * w);
    } else if (a.name === 'hit') {
      // flinch: tail clamped between the hind legs, ears flat (core), body drops (core)
      const k = w * (1 - smooth(0.45, 0.75, a.t) * 0.6);
      mx(P, 'tailLift', -0.8, k); mx(P, 'tailStiff', 1.6, k); mx(P, 'tailIdle', 0, k);
    }
  }
  // dying / dead: ears folded back flat against the neck
  for (const p of L.postures) {
    if (p.name === 'death') { const w = sm(clamp(p.w, 0, 1)) * smooth(0.3, 1.0, p.t); mx(P, 'earFlat', 1.15, w); mx(P, 'earTwitch', 0, w); mx(P, 'headRoll', p.side * 0.8, w); P.headPos.y += 0.05 * e.cfg.s * w; }
  }
  // curled sleep (curled1: a ring on one hip, the nose tucked by the tail). The spine
  // bends into a C (2.2 rad, rolled 0.45 onto the hip, the hind legs to the inside); the head turns back
  // along the inside of the curl and rests on the ground by the hind feet (yaw 2.3 rad; the occiput 20 cm
  // inside and 5 cm ahead of the turned chest's shoulders, 10 cm up: further back, the throat's stretch
  // > 3x rose past 4 % of its triangles); the brush sweeps round the outside of the hind feet and forward
  // to the nose (tailSide 3.4 curves it progressively, tailCurl -0.5 holds the root back: the old 2.4 rad
  // turned it near the root and tucked it under the belly). The forelegs stay forward on the ground, as in
  // curled1: tucked (the core's tuck places them in the unbent body frame, ~26 cm off, and the elbow
  // flipped on the way out), reached (the paw stands up) or turned with the chest (the inner elbow dropped
  // into the ground: 7-23 mm) they failed the metrics. (roll 0.45: 0.65 pressed the lower forearm 9-14 mm
  // into the ground, 0.5 up to 6 mm)
  for (const p of L.postures) {
    if (p.name === 'sleep' && p.tune.style !== 'lateral') {
      const c = sm(clamp(p.w, 0, 1)) * smooth(1.2, 3.2, p.t), side = p.side, k = e.cfg.k, fr = e.fr;
      mx(P, 'roll', side * 0.45, c); mx(P, 'bend', side * 2.2, c);
      mxLegs(P, 'side', 0, 0.55, c); mxLegs(P, 'spread', 0, 0, c);
      // forelegs drawn back under the head (curled1: the paws just show at the front of the ring, not a leg's
      // length ahead of it like a sphinx's): the engine's fold places the forepaw at zS + actions.fold.front.z
      // leg lengths, flat on the ground; this animal's own copy of that tuning moves it 25 cm back once the
      // curl has settled, the forearm and paw kept flat and the elbows folding up beside the chest. (A 'reach'
      // blend stood the paw up and swung the elbow 10 mm into the ground; a 'sit' blend stood the forelegs up
      // like posts; the core's tuck places the paw in the unbent body frame, ~26 cm off.) Skin penetration
      // 0.30-0.62 % S (seeds 1-4, every morph, both sides).
      const cF = sm(clamp(p.w, 0, 1)) * smooth(2.6, 4.4, p.t);
      if (!st.acts) { st.acts = { ...e.cfg.actions }; e.cfg.actions = st.acts; }
      const L0 = e.legs[0].def, z0 = (0.5 * L0.Lr + L0.Lmc) / L0.len;
      // (k -1.45, beta 0 and z0 are the engine's own fold values: continuous as the pull-back fades)
      st.acts.fold = cF > 1e-3 ? { front: { z: z0 - (cF * 0.25 * k) / L0.len, k: -1.45, beta: 0 } } : undefined;
      mx(P, 'headYaw', side * 2.3, c);
      // the chest's flat forward and left (its frame is the last frame's: the posture changes slowly)
      const q = fr.qCh;
      let fx = 2 * (q.x * q.z + q.w * q.y), fz = 1 - 2 * (q.x * q.x + q.y * q.y);
      const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
      const lat = side * 0.2 * k, fwd = 0.05 * k;
      const tx = fr.shC.x + fz * lat + fx * fwd, tz = fr.shC.z - fx * lat + fz * fwd;
      const hp = P.headPos;
      hp.x += (tx - hp.x) * c; hp.z += (tz - hp.z) * c; hp.y += (e.terrainH(tx, tz) + 0.1 * k - hp.y) * c;
      mx(P, 'tailCurl', side * -0.5, c); mx(P, 'tailSide', side * 3.4, c); mx(P, 'tailStiff', 0.7, c);
    }
  }

  // lying: rolled onto one hip, both hind legs to that side (lying1), not a symmetric sphinx
  for (const p of L.postures) {
    if (p.name === 'lie') {
      const w = sm(clamp(p.w, 0, 1)) * smooth(0.6, 1.8, p.t);
      mx(P, 'roll', p.side * 0.25, w);
      mxLegs(P, 'side', 0, 0.5, w);
    }
  }

  // alert: ears pricked forward while watching something
  const idleW = L.idle.w;
  if (e.input.look && raise < 0.01) mx(P, 'earFlat', -0.18, clamp(P.lookW, 0, 1));

  // howling (idle variant)
  const still = idleW > 0.95 && !L.postures.length && !L.oneshots.some((a) => !a.stopping && a.name !== 'hit');
  if (st.howlT < 0) {
    if (still) st.howlIn -= dt;
    if (e.input.howl && idleW > 0.3) { e.input.howl = false; st.howlIn = 0; }
    if (st.howlIn <= 0 && still) { st.howlT = 0; st.howlDur = 3 + e.rand() * 3; }
  } else {
    st.howlT += dt;
    if (!still && idleW < 0.6) st.howlT = Math.max(st.howlT, st.howlDur);
    if (st.howlT > st.howlDur + 1.2) { st.howlT = -1; st.howlIn = 25 + e.rand() * 35; }
  }
  const hw = st.howlT < 0 ? 0 : smooth(0, 0.9, st.howlT) * (1 - smooth(st.howlDur, st.howlDur + 1.2, st.howlT));
  st.howlW = hw;
  if (hw > 0.001) {
    const w = hw * idleW;
    mx(P, 'lookW', 0, w);
    mx(P, 'headRaise', 0.07, w); mx(P, 'neckReach', -0.03, w);
    mx(P, 'headPitch', -1.0, w);
    // the "O" opens after the head is up, with a slight waver
    const o = smooth(0.5, 1.2, st.howlT) * (1 - smooth(st.howlDur - 0.3, st.howlDur + 0.4, st.howlT));
    mx(P, 'jaw', 0.2 + 0.03 * Math.sin(st.howlT * 5.1), o * w); mx(P, 'jawOmega', 6, w);
    mx(P, 'earFlat', 0.55, w); mx(P, 'earTwitch', 0, w);
    mx(P, 'breathAmp', 0.4, w); mx(P, 'eyelid', 0.45, o * w);
    mx(P, 'dropH', 0.05, w);
  }
  P.furRaise = Math.max(P.furRaise || 0, raise);
}
