// Lightning somewhere over the city every so often: two to four strokes in quick succession light the clouds,
// the rain and the wet streets, and the thunder follows at the speed of sound.
import { U } from '../core/shared.js';

export class Lightning {
  constructor(onStrike) {
    this.onStrike = onStrike;
    this.next = 9 + Math.random() * 10;
    this.pulses = [];
    this.t = 0;
  }

  strike(camPos) {
    const a = Math.random() * Math.PI * 2, d = 300 + Math.random() * 1600;
    U.flashPos.value.set(camPos.x + Math.cos(a) * d, 600, camPos.z + Math.sin(a) * d);
    const n = 2 + Math.floor(Math.random() * 3);
    let t = this.t;
    for (let i = 0; i < n; i++) {
      this.pulses.push({ t0: t, dur: 0.05 + Math.random() * 0.08, peak: i === 0 ? 0.6 + Math.random() * 0.4 : 0.35 + Math.random() * 0.6 });
      t += 0.07 + Math.random() * 0.16;
    }
    this.onStrike?.(d);
  }

  update(dt, camPos) {
    this.t += dt;
    this.next -= dt;
    if (this.next <= 0) {
      this.strike(camPos);
      this.next = 14 + Math.random() * 26;
    }
    let f = 0;
    for (const p of this.pulses) {
      const x = (this.t - p.t0) / p.dur;
      if (x >= 0 && x < 4) f = Math.max(f, p.peak * (x < 1 ? 1 : Math.exp(-(x - 1) * 2.2)));
    }
    this.pulses = this.pulses.filter((p) => this.t - p.t0 < p.dur * 4);
    U.flash.value = f;
  }
}
