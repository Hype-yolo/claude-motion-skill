// Keyboard, gamepad and touch merged into one set of axes and one-shot actions.
const KEYS = {
  throttle: [['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']],
  steer: [['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']],
  lift: [['Space'], ['KeyC']],
};
const ACTIONS = { KeyV: 'camera', KeyM: 'map', KeyH: 'help', KeyR: 'reset', Escape: 'pause', KeyF: 'horn', Enter: 'confirm', KeyN: 'next', KeyB: 'radio' };

export class Input {
  constructor() {
    this.down = new Set();
    this.queue = [];
    this.touch = { throttle: 0, steer: 0, lift: 0, boost: false };
    this.enabled = true;
    this.lastDevice = 'keyboard';
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.lastDevice = 'keyboard';
      const a = ACTIONS[e.code];
      if (a) this.queue.push(a);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    this.padPrev = [];
  }

  axis(name) {
    const [pos, neg] = KEYS[name];
    return (pos.some((k) => this.down.has(k)) ? 1 : 0) - (neg.some((k) => this.down.has(k)) ? 1 : 0);
  }

  // returns the merged control state for this frame
  poll() {
    let throttle = this.axis('throttle'), steer = this.axis('steer'), lift = this.axis('lift');
    let boost = this.down.has('ShiftLeft') || this.down.has('ShiftRight');
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const dz = (v) => (Math.abs(v) < 0.12 ? 0 : v);
      const rt = p.buttons[7]?.value || 0, lt = p.buttons[6]?.value || 0;
      const ax = dz(p.axes[0] || 0), ry = dz(p.axes[3] || 0);
      if (rt || lt || ax || ry) this.lastDevice = 'gamepad';
      throttle = throttle || rt - lt;
      steer = steer || ax;
      lift = lift || -ry || (p.buttons[0]?.pressed ? 1 : 0) - (p.buttons[1]?.pressed ? 1 : 0);
      boost = boost || !!p.buttons[5]?.pressed || !!p.buttons[10]?.pressed;
      const map = { 3: 'camera', 8: 'map', 9: 'pause', 12: 'next', 2: 'horn' };
      for (const [b, a] of Object.entries(map)) {
        const pressed = !!p.buttons[b]?.pressed;
        if (pressed && !this.padPrev[b]) this.queue.push(a);
        this.padPrev[b] = pressed;
      }
    }
    const t = this.touch;
    throttle = throttle || t.throttle;
    steer = steer || t.steer;
    lift = lift || t.lift;
    boost = boost || t.boost;
    if (!this.enabled) return { throttle: 0, steer: 0, lift: 0, boost: false };
    return { throttle, steer, lift, boost };
  }

  take() {
    const q = this.queue;
    this.queue = [];
    return q;
  }
}
