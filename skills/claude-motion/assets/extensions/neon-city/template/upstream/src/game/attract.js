// The title sequence: a slow cut between four shots, from the parked KITE on a market street up to the
// cloud tops where the Zenith breaks through. Each shot eases between two camera poses.
import * as THREE from 'three/webgpu';
import { CITY } from '../city/layout.js';
import { SKY_ALT } from '../life/skytraffic.js';

const ease = (t) => t * t * (3 - 2 * t);

export class Attract {
  constructor(camera, kite, city, fade) {
    this.camera = camera;
    this.fade = fade;
    const k = kite.pos.clone();
    const fwd = kite.fwd.clone();
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const av = city.xs.filter((l) => l.w >= 24).reduce((a, l) => (Math.abs(l.p + 96) < Math.abs(a.p + 96) ? l : a));
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    this.shots = [
      // low and close, circling the front of the parked car under the signs
      {
        dur: 11, fov: [42, 36],
        pos: (t) => {
          // in front of the car, from over its own lane round to the kerb: traffic queues behind it, not here
          const a = 0.55 - ease(t) * 0.85;
          return k.clone().addScaledVector(fwd, Math.cos(a) * 8.2).addScaledVector(side, Math.sin(a) * 8.2).setY(k.y + 1.1 + t * 0.5);
        },
        look: (t, p) => {
          const toCar = k.clone().sub(p).setY(0).normalize();
          const left = new THREE.Vector3(toCar.z, 0, -toCar.x);
          return k.clone().addScaledVector(fwd, -0.4).addScaledVector(left, 2.6).setY(k.y + 0.7);
        },
      },
      // up the street, rising past the blade signs
      {
        dur: 10, fov: [52, 56],
        pos: (t) => k.clone().addScaledVector(fwd, 14 + t * 30).addScaledVector(side, 5.4).setY(3.2 + ease(t) * 34),
        look: (t) => k.clone().addScaledVector(fwd, 120 + t * 60).setY(14 + t * 18),
      },
      // the 168 m lane down the avenue beside the Zenith, in a canyon of towers
      {
        dur: 10, fov: [56, 58],
        pos: (t) => V(av.p - 5, SKY_ALT.z[1] + 5, 560 - t * 260),
        look: (t) => V(av.p + 30, SKY_ALT.z[1] + 40, 300 - t * 260),
      },
      // above the weather: a sea of lit cloud, the spire through it, the moon
      {
        dur: 13, fov: [46, 42],
        pos: (t) => V(1150 - t * 160, CITY.cloudTop + 70 + t * 30, 1180 - t * 170),
        look: () => V(0, 920, 0),
      },
    ];
    this.i = 0;
    this.t = 0;
    this.active = false;
  }

  start() {
    this.active = true;
    this.i = 0;
    this.t = 0;
  }

  stop() {
    this.active = false;
    this.fade.classList.remove('on');
  }

  update(dt) {
    if (!this.active) return;
    const s = this.shots[this.i];
    this.t += dt;
    if (this.t > s.dur) {
      this.t = 0;
      this.i = (this.i + 1) % this.shots.length;
      return this.update(0);
    }
    // dip to black across each cut
    this.fade.classList.toggle('on', this.t > s.dur - 0.45);
    const u = this.t / s.dur;
    const cam = this.camera;
    cam.position.copy(s.pos(u));
    cam.lookAt(s.look(u, cam.position));
    cam.fov = s.fov[0] + (s.fov[1] - s.fov[0]) * ease(u);
    cam.updateProjectionMatrix();
  }
}
