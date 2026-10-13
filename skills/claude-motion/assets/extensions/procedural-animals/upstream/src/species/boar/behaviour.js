// Wild boar behaviour layer for the quadruped engine (species.motion.hooks, see core/motion/actions.js):
//
//   update(P, dt, layer)  every frame over the action layer: the mane (P.furRaise: the long dorsal
//                         bristles rise when the boar is alarmed, charging, hit or galloping away;
//                         `motion.input.alarm = true` raises it on demand), jaw champing in a threat,
//                         ear flicks, the lazy tail swing, automatic idle variants (sniffing with the
//                         snout raised, a bout of rooting, a head shake, grunting), the charge steering
//                         of the attack and the spin of the hit
//   actions               eat (rooting: the disc ploughs the ground in forward-upward thrusts, the head
//                         swinging side to side), sniff (snout raised, the disc testing the air in
//                         quick small movements, ears forward), grunt, headshake, attack (a threat with
//                         the head low and champing jaws, then a fast head-low charge ending in an upward
//                         tusk hook with a head toss: attackHit style 'tusk'), hit (squeal and spin round
//                         toward the blow), lie (on the belly, forelegs folded), sleep (flat on the side,
//                         legs out)
//
// Posture lengths (headRaise, neckReach, fwd, side) are engine units (x cfg.k): species metres /
// cfg.unit.
import * as THREE from 'three';
import { clamp, smooth, TAU } from '../../core/motion/common.js';
import { mx, ONESHOTS, POSTURES } from '../../core/motion/actions.js';

const PI = Math.PI;
const sm = (w) => w * w * (3 - 2 * w);

function B(e) {
  if (!e._boar) {
    e._boar = {
      ear: [{ age: 9, next: 2 + e.rand() * 4, a: 0 }, { age: 9, next: 3 + e.rand() * 5, a: 0 }],
      idleT: 6 + e.rand() * 6,
      raise: 0,
      charge: null, spin: null,
    };
  }
  return e._boar;
}
const busy = (L) => L.postures.length > 0 || L.oneshots.some((a) => !a.stopping);

// ------------------------------------------------------------------------------------------------
function update(P, dt, L) {
  const e = L.engine, b = B(e), cfg = e.cfg;
  const vn = e.speed / cfg.sq;
  const still = 1 - smooth(0.1, 0.6, vn);

  // --- mane: raised in alarm (galloping away, charging, hit, on demand)
  let want = e.input.alarm ? 1 : 0;
  want = Math.max(want, 0.55 * smooth(4.2, 6.5, vn) * P.gaitW);
  for (const a of L.oneshots) {
    const w = sm(a.w);
    if (a.name === 'attack') want = Math.max(want, w);
    else if (a.name === 'hit') want = Math.max(want, 0.8 * w);
    else if (a.name === 'sniff') want = Math.max(want, 0.25 * w);
  }
  // (eased here as well as in the renderer: a smooth rise, a slower fall)
  b.raise += (want - b.raise) * (1 - Math.exp(-dt * (want > b.raise ? 6 : 1.5)));
  P.furRaise = Math.max(P.furRaise || 0, b.raise);
  // alarm: head up, ears forward, tail out stiff
  if (e.input.alarm) {
    const k = still * (busy(L) ? 0.3 : 1);
    mx(P, 'headRaise', 0.05 / cfg.unit, k); mx(P, 'headPitch', -0.2, k); mx(P, 'earFlat', -0.2, k);
    mx(P, 'tailLift', 0.5, 1); mx(P, 'tailStiff', 1.6, 1);
  }

  // --- ear flicks (one ear at a time)
  for (const E of b.ear) {
    E.age += dt; E.next -= dt * (0.5 + 0.5 * still);
    if (E.next <= 0) { E.next = 3 + e.rand() * 7; E.age = 0; E.a = 0.6 + 0.5 * e.rand(); }
    if (E.age < 0.5) { const f = Math.sin(Math.min(1, E.age / 0.45) * PI) * E.a; mx(P, 'earTwitch', 2.2, f * (1 - P.eyelid)); }
  }

  // --- dead / flat on the side: ears fold back along the neck, out of the ground
  const dead = L.postures.reduce((m, p) => (p.name === 'death' ? Math.max(m, p.w) : m), 0);
  const flat = Math.max(smooth(0.3, 1.0, Math.abs(P.roll)), dead * smooth(0.3, 1, dead));
  if (flat > 0) { mx(P, 'earFlat', 1.1, flat); mx(P, 'earTwitch', 0, flat); }
  // ... and the long, deep head (carried 40 deg nose-down in the bind pose) lies level on its cheek:
  // nose up to the horizontal, the occiput higher than a cat-sized skull, rolled with the body rather
  // than twisted on the atlas (the throat stretched)
  let side = 0, lift = 0;
  for (const p of L.postures) {
    const k = p.name === 'death' ? sm(clamp(p.w, 0, 1)) * smooth(0.35, 1.0, p.t) : p.name === 'sleep' && p.tune.style === 'lateral' ? sm(clamp(p.w, 0, 1)) * smooth(1.0, 3.0, p.t) : 0;
    if (k > side) { side = k; lift = p.name === 'death' ? 0.08 * k + 0.12 * Math.sin(Math.PI * k) : 0.16 * k + 0.12 * Math.sin(Math.PI * k); }
    // (going down to sleep: the head is held clear of the ground while the body settles and rolls)
    if (p.name === 'sleep' && p.tune.style === 'lateral') {
      const k2 = sm(clamp(p.w, 0, 1)) * smooth(0.4, 3.0, p.t);
      lift = Math.max(lift, 0.16 * k2 + 0.16 * Math.sin(Math.PI * k2));
      side = Math.max(side, 1e-4);
    }
  }
  if (side > 0 && P.headW > 0) {
    P.headPos.y += lift * cfg.s;
    P.headPitch -= 0.3 * side;
    P.headRoll *= 1 - 0.5 * side;
  }
  // the thin tail lies straight along the ground (no curl round the body)
  P.tailSide *= 0.35;

  // --- charge steering (attack)
  const cg = b.charge;
  if (cg) {
    if (cg.run) {
      e.wantSpeed = Math.max(e.wantSpeed, cg.speed * smooth(0, 0.4, cg.tRun));
      e.wantHeading = cg.heading;
    } else if (cg.brake) e.wantSpeed = Math.min(e.wantSpeed, 0);
  }
  // --- spin round toward a blow (hit)
  const sp = b.spin;
  if (sp) {
    sp.t += dt;
    if (sp.t < sp.dur && !L.holdsStill()) e.wantHeading = sp.heading;
    else {
      if (!(e.input.speed > 0.05) && e.input.heading !== undefined && e.input.heading !== null) e.input.heading = sp.heading;
      b.spin = null;
    }
  }

  // --- any other action interrupts rooting
  if (L.oneshots.some((a) => !a.stopping && ['attack', 'jump', 'sniff', 'headshake'].includes(a.name))) for (const a of L.oneshots) if (a.name === 'eat' || a.name === 'drink') a.stopping = true;

  // --- idle variants
  if (e.idleVariants !== false && L.idle.w > 0.98 && !busy(L) && !e.input.look && !e.input.follow) {
    b.idleT -= dt;
    if (b.idleT <= 0) {
      b.idleT = 8 + e.rand() * 9;
      const r = e.rand();
      if (r < 0.35) L.play('sniff');
      else if (r < 0.6) L.play('eat', { duration: 3.5 + 3 * e.rand() });
      else if (r < 0.75) L.play('headshake');
      else L.play('grunt');
    }
  } else if (busy(L)) b.idleT = Math.max(b.idleT, 3);
}

// ------------------------------------------------------------------------------------------------
// eat: rooting. The disc goes to the ground ahead of the forefeet (the engine's grazing posture),
// then ploughs forward and flicks up and sideways, turning the soil; the head swings side to side,
// the mouth closed but for short chews, a grunt now and then.
const eat = {
  kind: 'oneshot',
  start(inst, L) { ONESHOTS.eat.start(inst, L); inst.grunt = 1 + L.engine.rand() * 2; inst.side = L.engine.rand() < 0.5 ? -1 : 1; },
  update(inst, dt, L) {
    inst.grunt -= dt;
    if (inst.grunt <= 0) { inst.grunt = 1.5 + L.engine.rand() * 2.5; L.engine.emit('vocalize', { kind: 'grunt' }); }
    return ONESHOTS.eat.update(inst, dt, L);
  },
  apply(P, w, inst, L) {
    ONESHOTS.eat.apply(P, w, inst, L);
    const e = L.engine, t = inst.t, s = e.cfg.s;
    const k = w * smooth(0.6, 1.4, t);
    // thrust cycle ~0.9 s: push the disc forward along the ground, then lever it up and aside
    const c = (t * 1.1) % 1;
    const push = smooth(0.0, 0.45, c) * (1 - smooth(0.55, 0.95, c));
    const flick = smooth(0.4, 0.6, c) * (1 - smooth(0.62, 0.95, c));
    const n = Math.floor(t * 1.1);
    const side = ((n * 7919) % 3) - 1; // -1, 0, 1: flick direction per thrust
    const sh = Math.sin(e.heading), ch = Math.cos(e.heading);
    const fwd = 0.045 * s * push * k, lat = 0.03 * s * flick * side * k;
    P.headPos.x += sh * fwd + ch * lat; P.headPos.z += ch * fwd - sh * lat;
    P.headPos.y += 0.035 * s * flick * k;
    P.headPitch -= 0.3 * flick * k;
    P.headYaw += (0.22 * Math.sin(t * 0.8 + inst.side) + 0.15 * flick * side) * k;
    P.headRoll += 0.12 * flick * side * k;
    // the mouth stays closed while the disc ploughs (the engine's grazing chew would hang it open, red
    // lining showing): only short chews, the lips barely parting
    mx(P, 'jaw', 0.035 * Math.pow(Math.max(0, Math.sin(t * 5.5)), 4), w);
    mx(P, 'earFlat', 0.15, k);
  },
};

// sniff: stands still with the snout raised to wind, the disc testing the air in small quick moves,
// ears forward; a short snort at the end
const sniff = {
  kind: 'oneshot', fade: 0.4,
  start(inst, L) { const e = L.engine; inst.dur = inst.opts.duration ?? 3.2 + e.rand() * 1.5; inst.yaw = (e.rand() - 0.5) * 0.7; inst.snort = false; },
  update(inst, dt, L) {
    if (!inst.snort && inst.t > inst.dur - 0.6) { inst.snort = true; L.engine.emit('vocalize', { kind: 'snort' }); }
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t, u = 1 / e.cfg.unit;
    const up = w * smooth(0, 0.6, t);
    mx(P, 'lookW', 0, up);
    mx(P, 'headRaise', 0.1 * u, up); mx(P, 'neckReach', 0.02 * u, up);
    // (quick small movements of the raised snout: two frequencies)
    const tw = 0.05 * Math.sin(t * TAU * 2.3) + 0.035 * Math.sin(t * TAU * 3.7 + 1);
    mx(P, 'headPitch', -0.5 + tw, up); mx(P, 'headOmega', 2.2, up);
    mx(P, 'headYaw', inst.yaw + 0.25 * Math.sin(t * 0.9) + 0.4 * tw, up);
    mx(P, 'earFlat', -0.25, up); mx(P, 'earTwitch', 0.3, up);
    const snort = smooth(inst.dur - 0.6, inst.dur - 0.5, t) * (1 - smooth(inst.dur - 0.4, inst.dur - 0.2, t));
    mx(P, 'breathAmp', 2.5, snort * w); mx(P, 'headPitch', -0.3, snort * w);
    mx(P, 'tailLift', 0.15, up);
  },
};

// grunt: low grunts, the jaw barely opening, head a little down
const grunt = {
  kind: 'oneshot', fade: 0.2,
  start(inst) { inst.dur = 1.4; inst.n = 0; },
  update(inst, dt, L) {
    const n = Math.floor((inst.t - 0.2) / 0.4);
    if (n >= inst.n && n < 3 && inst.t > 0.2) { inst.n = n + 1; L.engine.emit('vocalize', { kind: 'grunt' }); }
    return inst.t >= inst.dur;
  },
  apply(P, w, inst) {
    const t = inst.t;
    const g = Math.max(0, Math.sin(clamp((t - 0.2) / 0.4, 0, 3) * PI));
    mx(P, 'jaw', 0.05 * g, w); mx(P, 'jawOmega', 25, w); mx(P, 'breathAmp', 1 + 1.5 * g, w);
    mx(P, 'headPitch', 0.08, w * smooth(0, 0.3, t));
  },
};

// head shake: fast rotations about the snout axis, ears flapping
const headshake = {
  kind: 'oneshot', fade: 0.12,
  start(inst) { inst.dur = 0.9; },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst) {
    const t = inst.t;
    const env = smooth(0, 0.12, t) * (1 - smooth(0.5, 0.85, t)) * w;
    const s = Math.sin(t * TAU * 4.5);
    mx(P, 'headOmega', 5, env);
    mx(P, 'headRoll', 0.35 * s, env); mx(P, 'headYaw', 0.12 * s, env); mx(P, 'headPitch', -0.05, env);
    mx(P, 'earTwitch', 2.5, env); mx(P, 'eyelid', 0.5, env); mx(P, 'lookW', 0, env);
  },
};

// attack: standing, a short threat (head low, mane up, jaws champing) then the charge; already
// running, straight into the charge. Head low and forward in the run, then at the target an upward
// hook of the lower tusks with a toss of the head to one side (attackHit at the mouth, style 'tusk'),
// then it brakes, ready to wheel and charge again.
const attack = {
  kind: 'oneshot', fade: 0.18, needsStand: true,
  start(inst, L) {
    const e = L.engine, b = B(e), cfg = e.cfg;
    inst.run = smooth(1.2, 3.5, e.speed / cfg.sq);
    inst.target = inst.opts.target ? inst.opts.target.clone() : null;
    inst.side = inst.opts.side ?? (e.rand() < 0.5 ? -1 : 1);
    inst.tThreat = inst.run > 0.3 ? 0.15 : 0.9;
    let h = e.heading;
    if (inst.target) h = Math.atan2(inst.target.x - e.pos.x, inst.target.z - e.pos.z);
    const dist = inst.target ? Math.hypot(inst.target.x - e.pos.x, inst.target.z - e.pos.z) : 3.2 * cfg.s;
    inst.vRun = clamp(dist * 1.4, 4, 7) * cfg.sq;
    inst.tRun = clamp(dist / (inst.vRun * 0.75) + 0.4, 1.0, 2.8);
    b.charge = { run: false, brake: false, heading: h, speed: inst.vRun, tRun: 0 };
    inst.hitAt = inst.tThreat + inst.tRun;
    inst.dur = inst.hitAt + 1.3;
    inst.hit = false;
  },
  update(inst, dt, L) {
    const e = L.engine, b = B(e);
    const cg = b.charge;
    if (cg) {
      cg.run = inst.t >= inst.tThreat && inst.t < inst.hitAt + 0.1;
      cg.brake = inst.t >= inst.hitAt + 0.1;
      if (cg.run) cg.tRun += dt;
    }
    if (!inst.hit && inst.t >= inst.hitAt) {
      inst.hit = true;
      const p = new THREE.Vector3().copy(e.cfg.mouthLocal).applyQuaternion(e.headPose.quaternion).add(e.headPose.position);
      const dir = e.forward(e.heading, new THREE.Vector3()).add(new THREE.Vector3(0, 0.6, 0)).normalize();
      e.emit('attackHit', { position: p, direction: dir, style: 'tusk' });
    }
    if (inst.t >= inst.dur) { b.charge = null; return true; }
    return false;
  },
  apply(P, w, inst, L) {
    const e = L.engine, cfg = e.cfg, u = 1 / cfg.unit, t = inst.t, h = inst.hitAt;
    if (inst.target) { P.look = inst.target; mx(P, 'lookW', 0.5, w); }
    // threat: head low, jaws champing (tooth clacking)
    const thr = smooth(0, 0.25, t) * (1 - smooth(inst.tThreat - 0.1, inst.tThreat + 0.1, t)) * (1 - inst.run);
    mx(P, 'jaw', 0.12 * Math.max(0, Math.sin(t * TAU * 4.5)), thr * w); mx(P, 'jawOmega', 35, w);
    mx(P, 'headPitch', 0.2, thr * w); mx(P, 'headRaise', -0.04 * u, thr * w); mx(P, 'dropF', 0.08, thr * w);
    // charge: head low and forward, ears back, tail up
    const low = smooth(inst.tThreat - 0.1, inst.tThreat + 0.3, t) * (1 - smooth(h - 0.12, h, t));
    mx(P, 'headRaise', -0.07 * u, low * w); mx(P, 'headPitch', 0.3, low * w); mx(P, 'neckReach', 0.03 * u, low * w);
    mx(P, 'earFlat', 0.9, w * smooth(0, 0.3, t)); mx(P, 'earTwitch', 0, w);
    mx(P, 'tailLift', 0.7, w * smooth(0, 0.5, t)); mx(P, 'tailStiff', 1.6, w);
    // the hook: from low and nose-down, the head tosses up and to one side, the jaw a little open
    const hook = smooth(h - 0.12, h + 0.08, t) * (1 - smooth(h + 0.25, h + 0.75, t));
    mx(P, 'headPitch', -0.5, hook * w); mx(P, 'headRaise', 0.06 * u, hook * w);
    mx(P, 'headRoll', 0.45 * inst.side, hook * w); mx(P, 'headYaw', 0.35 * inst.side, hook * w);
    mx(P, 'headOmega', 3, w * smooth(h - 0.3, h - 0.1, t) * (1 - smooth(h + 0.3, h + 0.6, t)));
    mx(P, 'jaw', 0.12, hook * w);
    // the forequarters drive up into the hook
    mx(P, 'dropF', -0.06, hook * w); mx(P, 'pitch', -0.04, hook * w);
  },
};

// hit: the engine's stagger with a squeal (mouth open, head up), then it spins round toward the blow
const hit = {
  ...ONESHOTS.hit,
  kind: 'oneshot',
  start(inst, L) {
    ONESHOTS.hit.start(inst, L);
    const e = L.engine, b = B(e);
    inst.dur = 1.0;
    inst.said = false;
    // face the source of the blow (the blow travels along inst.dir)
    const h = Math.atan2(-inst.dir.x, -inst.dir.z);
    b.spin = { heading: h, t: 0, dur: 1.6 };
  },
  update(inst, dt, L) {
    if (!inst.said && inst.t > 0.05) { inst.said = true; L.engine.emit('vocalize', { kind: 'squeal' }); }
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    ONESHOTS.hit.apply(P, w, inst, L);
    const t = inst.t;
    const sq = smooth(0.03, 0.12, t) * (1 - smooth(0.5, 0.8, t)) * w;
    mx(P, 'jaw', 0.32 + 0.04 * Math.sin(t * TAU * 12), sq); mx(P, 'jawOmega', 35, w);
    mx(P, 'headPitch', -0.3, sq); mx(P, 'eyelid', 0.4, sq);
    mx(P, 'tailLift', 0.5, w); mx(P, 'tailStiff', 1.5, w);
  },
};

// lie: on the belly, forelegs folded (the engine's kneeling lie, down front first, up front first),
// with the rise finished a little before the posture is released so the end-first springs settle
function lieApply(P, w, inst, L) {
  const we = inst.target > 0 ? w : smooth(0.3, 1, w);
  POSTURES.lie.apply(P, we, inst, L);
}
const lie = { kind: 'posture', fadeIn: 1.4, fadeOut: 1.3, apply: lieApply };

// sleep: flat on the side, legs extended (lateral recumbency, the usual sleeping posture in the nest)
const sleep = {
  kind: 'posture', fadeIn: 1.5, fadeOut: 1.4,
  apply(P, w, inst, L) {
    const we = inst.target > 0 ? w : smooth(0.3, 1, w);
    POSTURES.sleep.apply(P, we, inst, L);
  },
};

export const hooks = {
  update,
  actions: { eat, sniff, grunt, headshake, attack, hit, lie, sleep },
};
