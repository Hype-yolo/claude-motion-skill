// Frame-time governor. Under vsync every frame reads as the refresh interval however much headroom the GPU has,
// so the scale steps down on missed frames and, after a run of clean ones, probes back up; a probe that
// costs frames doubles the wait before the next one.
export class Governor {
  constructor(apply, { min = 0.5, max = 1, start = 1 } = {}) {
    this.apply = apply;
    this.scale = start;
    this.minScale = min;
    this.maxScale = max;
    this.times = new Float32Array(90);
    this.sorted = new Float32Array(90);
    this.idx = 0;
    this.count = 0;
    this.cooldown = 2;
    this.clean = 0;
    this.probeWait = 2;
    this.lastProbe = -1e9;
    this.clock = 0;
    this.locked = false;
  }

  reset(cooldown = 1.5) {
    this.count = 0;
    this.clean = 0;
    this.cooldown = cooldown;
  }

  tick(dtMs) {
    if (this.locked) return;
    this.clock += dtMs / 1000;
    this.times[this.idx] = dtMs;
    this.idx = (this.idx + 1) % this.times.length;
    this.count = Math.min(this.count + 1, this.times.length);
    this.cooldown -= dtMs / 1000;
    if (this.count < 45) return;
    const arr = this.sorted.subarray(0, this.count);
    arr.set(this.times.subarray(0, this.count));
    arr.sort();
    const p90 = arr[Math.floor(this.count * 0.9)];
    const missed = dtMs > 21;
    this.clean = missed ? 0 : this.clean + dtMs / 1000;
    if (this.cooldown > 0) return;
    let next = this.scale;
    if (p90 > 19.5) {
      next = this.scale * 0.88;
      if (this.clock - this.lastProbe < 4) this.probeWait = Math.min(30, this.probeWait * 2);
    } else if (this.scale < this.maxScale && this.clean > this.probeWait) {
      next = this.scale * 1.1;
      this.lastProbe = this.clock;
    } else if (this.clock - this.lastProbe > 12) {
      this.probeWait = Math.max(2, this.probeWait * 0.9);
    }
    next = Math.min(this.maxScale, Math.max(this.minScale, next));
    if (Math.abs(next - this.scale) > 0.01) {
      const down = next < this.scale;
      this.scale = next;
      this.apply(next);
      this.reset(down ? 1.0 : 1.5);
    }
  }
}
