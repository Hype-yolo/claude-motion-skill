// Autopilot for testing runs (?bot): steers at the next gate, slows for tight turns, steps round buildings,
// hops over street traffic, and lands on a landing gate. If it can finish under bronze, a person can.
import { queryBoxes } from '../city/layout.js';

const _b = [];
function blocked(city, x, y, z, r) {
  queryBoxes(city, x - r, z - r, x + r, z + r, _b);
  for (const b of _b) {
    if (y + 1.2 < b.y0 || y - 0.3 > b.y1) continue;
    if (x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1) return true;
  }
  return false;
}

export class Bot {
  controls(game) {
    const k = game.kite, r = game.run, city = game.city;
    if (!r || game.state !== 'run') return { throttle: 0, steer: 0, lift: 0, boost: false };
    const d = r.def;
    const g = d.gates[r.gate];
    const next = d.gates[r.gate + 1];
    const last = r.gate === d.gates.length - 1;
    const dx = g.x - k.pos.x, dz = g.z - k.pos.z, dist = Math.hypot(dx, dz);
    const want = Math.atan2(-dx, -dz);
    let err = want - k.yaw;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    let steer = Math.max(-1, Math.min(1, -err * 2.6));
    const air = k.mode === 'air';
    // street runs: skim at 3.2 m, over the roofs of the traffic
    const ty = d.ground ? 3.2 : g.y;
    const dy = ty - k.pos.y;
    let lift = Math.max(-1, Math.min(1, dy / 4));
    let throttle = Math.abs(err) > 0.9 ? 0.2 : 1;
    let boost = Math.abs(err) < 0.2 && dist > 80;

    // slow for the turn after this gate: the yaw rate falls with speed, so a tight line needs less of it
    if (next) {
      const a1 = Math.atan2(dx, dz), a2 = Math.atan2(next.x - g.x, next.z - g.z);
      let turn = Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)));
      const vCap = turn > 1.2 ? 11 : turn > 0.6 ? 30 : 200;
      if (dist < 20 + k.speed * 1.5 && k.speed > vCap) { throttle = -1; boost = false; }
    }
    // don't arrive before we've climbed or dropped to the gate
    if (!d.ground && Math.abs(dy) > 10 && Math.abs(dy) / Math.max(1, dist) > 0.5) { throttle = Math.min(throttle, 0.2); boost = boost && dy < 0; }
    if (!d.ground && Math.abs(dy) > 30) boost = true;

    // head for the gate along the first clear line: straight at it if nothing is in the way, else the nearest
    // heading either side of it that is. Probes are the car's own half-width, so kerbside lamp posts the car
    // passes by do not read as a wall
    const reach = Math.min(dist, Math.max(14, k.speed * 0.8));
    const clear = (ang) => {
      for (let s = 2; s <= reach; s += 2) if (blocked(city, k.pos.x - Math.sin(ang) * s, k.pos.y, k.pos.z - Math.cos(ang) * s, 1.4)) return false;
      return true;
    };
    if (!clear(want)) {
      let go = null;
      for (let a = 0.3; a < 2.8 && go === null; a += 0.3) {
        // try the side the car is already turning toward first
        const first = err > 0 ? 1 : -1;
        if (clear(want + a * first)) go = want + a * first;
        else if (clear(want - a * first)) go = want - a * first;
      }
      if (go === null) lift = 1;
      else {
        const e = Math.atan2(Math.sin(go - k.yaw), Math.cos(go - k.yaw));
        steer = Math.max(-1, Math.min(1, -e * 2.6));
      }
      throttle = Math.min(throttle, 0.4);
      boost = false;
    }

    if (last && d.land) {
      // come in above the pad, slow over it, then settle
      if (dist > 6) { lift = k.pos.y < g.y + 6 ? 1 : 0; if (dist < 60 && k.speed > 14) throttle = -1; }
      else { lift = -1; throttle = k.speed > 2 ? -0.6 : 0; }
      boost = false;
    }
    if (!air && lift <= 0 && d.ground) lift = 1;

    // pinned against something: back off for a second, turning the other way, as a driver would
    const dt = 1 / 60;
    this.stuck = throttle > 0 && k.speed < 1.5 ? (this.stuck || 0) + dt : 0;
    if (this.stuck > 1) { this.back = 1; this.backSteer = -Math.sign(steer || 1); this.stuck = 0; }
    if (this.back > 0) { this.back -= dt; return { throttle: -1, steer: this.backSteer, lift, boost: false }; }
    return { throttle, steer, lift, boost };
  }
}
