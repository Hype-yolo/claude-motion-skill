// Everything you hear is synthesised: rain and the city's hum, wind, the KITE's turbines, impacts, thunder,
// chimes, and a score that thickens with speed and height. Nothing starts until the first user gesture.
const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
// D minor: Dm  Bb  F  C, one bar each
const CHORDS = [
  [50, 53, 57, 62],
  [46, 50, 53, 58],
  [41, 48, 53, 57],
  [48, 52, 55, 60],
];
const BPM = 94;

function noiseBuffer(ctx, seconds, kind) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
  }
  return buf;
}

function impulse(ctx, seconds, decay) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
  }
  return buf;
}

export class Sound {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.radio = true;
    this.energy = 0;
    this.bright = 0;
    this.inRun = false;
  }

  // must be called from a user gesture
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }));
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.006; comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    comp.connect(this.master).connect(ctx.destination);
    this.mix = comp;
    // the world gets muffled inside the cloud deck and when paused
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000; this.muffle.Q.value = 0.4;
    this.muffle.connect(comp);
    this.sfx = ctx.createGain(); this.sfx.connect(this.muffle);
    this.amb = ctx.createGain(); this.amb.connect(this.muffle);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0; this.musicBus.connect(comp);
    // shared reverb and a dotted-eighth echo for the score and the chimes
    this.verb = ctx.createConvolver(); this.verb.buffer = impulse(ctx, 3.2, 2.6);
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.55;
    this.verb.connect(verbOut).connect(comp);
    this.echo = ctx.createDelay(1.5); this.echo.delayTime.value = (60 / BPM) * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const echoTone = ctx.createBiquadFilter(); echoTone.type = 'lowpass'; echoTone.frequency.value = 2600;
    this.echo.connect(echoTone).connect(fb).connect(this.echo);
    const echoOut = ctx.createGain(); echoOut.gain.value = 0.4;
    echoTone.connect(echoOut).connect(comp);
    echoOut.connect(this.verb);

    this.white = noiseBuffer(ctx, 3, 'white');
    this.pink = noiseBuffer(ctx, 4, 'pink');
    this.brown = noiseBuffer(ctx, 5, 'brown');

    const loop = (buf, dest, rate = 1) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
      s.loopStart = Math.random(); s.start(0, Math.random() * buf.duration);
      s.connect(dest); return s;
    };
    const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };

    // rain: a bright hiss and a heavier body; patter comes from modulating the hiss with fast noise
    this.rainG = gain(0); this.rainG.connect(this.amb);
    const hissF = filt('highpass', 2400); const hissP = filt('peaking', 5200, 0.8); hissP.gain.value = 4;
    loop(this.pink, hissF); hissF.connect(hissP).connect(this.rainG);
    const bodyF = filt('bandpass', 700, 0.5); const bodyG = gain(0.6);
    loop(this.pink, bodyF, 0.9); bodyF.connect(bodyG).connect(this.rainG);
    // the city: a low rumble of traffic and air conditioning, gone by the cloud deck
    this.cityG = gain(0); this.cityG.connect(this.amb);
    const cityF = filt('lowpass', 220, 0.6);
    loop(this.brown, cityF); cityF.connect(this.cityG);
    // wind against the craft
    this.windG = gain(0); this.windG.connect(this.amb);
    this.windF = filt('bandpass', 400, 0.8);
    loop(this.white, this.windF, 0.5); this.windF.connect(this.windG);
    // high altitude air: thin and cold
    this.highG = gain(0); this.highG.connect(this.amb);
    const highF = filt('bandpass', 1400, 2.5);
    loop(this.pink, highF, 0.7); highF.connect(this.highG);

    // engine: two detuned saws through a moving lowpass, a fan whine above, a hover hum below, jet roar for boost
    this.engG = gain(0); this.engG.connect(this.sfx);
    this.engF = filt('lowpass', 500, 2.2); this.engF.connect(this.engG);
    this.osc1 = ctx.createOscillator(); this.osc1.type = 'sawtooth';
    this.osc2 = ctx.createOscillator(); this.osc2.type = 'sawtooth'; this.osc2.detune.value = 14;
    const o2g = gain(0.6);
    this.osc1.connect(this.engF); this.osc2.connect(o2g).connect(this.engF);
    this.whine = ctx.createOscillator(); this.whine.type = 'sine';
    this.whineG = gain(0); this.whine.connect(this.whineG).connect(this.sfx);
    this.hum = ctx.createOscillator(); this.hum.type = 'triangle'; this.hum.frequency.value = 48;
    this.humG = gain(0); this.hum.connect(this.humG).connect(this.sfx);
    this.roarG = gain(0); this.roarF = filt('bandpass', 900, 0.6);
    loop(this.white, this.roarF); this.roarF.connect(this.roarG).connect(this.sfx);
    for (const o of [this.osc1, this.osc2, this.whine, this.hum]) o.start();

    this.applySettings();
    const t = ctx.currentTime;
    this.master.gain.setValueAtTime(0, t);
    this.master.gain.linearRampToValueAtTime(this.settings.volume, t + 2.5);
    this.nextNote = ctx.currentTime + 0.2;
    this.step16 = 0;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  applySettings() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.volume, t, 0.1);
    this.musicBus.gain.setTargetAtTime(this.radio ? this.settings.music * 0.7 : 0, t, 0.4);
  }

  toggleRadio() {
    this.radio = !this.radio;
    this.applySettings();
    return this.radio;
  }

  // per-frame state: speed m/s, throttle, boost 0..1, air, altitude, height above ground, in cloud 0..1, paused
  update(dt, s) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, T = 0.06;
    const above = s.alt > 660 ? Math.min(1, (s.alt - 660) / 200) : 0;
    const rain = (1 - above) * (1 - s.inCloud * 0.6) * (0.25 + 0.75 * this.settings.rain) * (s.covered ? 0.35 : 1);
    this.rainG.gain.setTargetAtTime(0.42 * rain, t, 0.3);
    this.cityG.gain.setTargetAtTime(0.5 * Math.max(0, 1 - s.alt / 420), t, 0.3);
    const w = Math.min(1, s.speed / 110);
    this.windG.gain.setTargetAtTime(w * w * (s.air ? 0.5 : 0.22) + above * 0.08, t, T);
    this.windF.frequency.setTargetAtTime(250 + w * 1500, t, T);
    this.highG.gain.setTargetAtTime(above * 0.06 + s.inCloud * 0.05, t, 0.4);

    const on = s.paused ? 0 : 1;
    const rpm = Math.min(1, s.speed / 125) * 0.75 + Math.abs(s.throttle) * 0.15 + s.boost * 0.2;
    const f = 52 + rpm * 120;
    this.osc1.frequency.setTargetAtTime(f, t, T);
    this.osc2.frequency.setTargetAtTime(f * 1.5, t, T);
    this.engF.frequency.setTargetAtTime(240 + rpm * 1400 + s.boost * 800, t, T);
    this.engG.gain.setTargetAtTime(on * (0.05 + rpm * 0.07), t, T);
    this.whine.frequency.setTargetAtTime(900 + rpm * 2600, t, T);
    this.whineG.gain.setTargetAtTime(on * (0.006 + rpm * 0.014), t, T);
    this.humG.gain.setTargetAtTime(on * (s.air ? 0.1 : 0.05), t, 0.2);
    this.hum.frequency.setTargetAtTime(s.air ? 46 + s.vy * 0.25 : 40, t, 0.2);
    this.roarG.gain.setTargetAtTime(on * s.boost * 0.22, t, 0.08);
    this.roarF.frequency.setTargetAtTime(700 + s.boost * 900 + w * 600, t, T);
    this.muffle.frequency.setTargetAtTime(s.paused ? 700 : 20000 - s.inCloud * 17500, t, 0.25);

    // musical energy: speed, height and being on the clock
    const e = Math.min(1, (s.speed / 70) * 0.55 + Math.min(1, s.alt / 400) * 0.25 + (this.inRun ? 0.35 : 0) + (s.boost ? 0.15 : 0));
    this.energy += (e - this.energy) * Math.min(1, dt * 0.6);
    this.bright = above;
  }

  // ---- score: a look-ahead sequencer on sixteenths ----
  schedule() {
    const ctx = this.ctx;
    if (!this.radio || this.settings.music <= 0.001) { this.nextNote = ctx.currentTime + 0.1; return; }
    const spb = 60 / BPM / 4;
    while (this.nextNote < ctx.currentTime + 0.12) {
      this.playStep(this.step16, this.nextNote);
      this.nextNote += spb;
      this.step16 = (this.step16 + 1) % 256;
    }
  }

  playStep(i, t) {
    const bar = Math.floor(i / 16) % 4, s = i % 16;
    const chord = CHORDS[bar];
    const e = this.energy;
    if (s === 0) this.pad(chord, t, (60 / BPM) * 4);
    if (e > 0.18 && s % 2 === 0 && [0, 3, 6, 8, 10, 14].includes(s)) this.bass(chord[0] - 12 + (s === 10 ? 12 : 0), t, e);
    if (e > 0.42) {
      const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
      const k = pattern[s % 8] + (s >= 8 && e > 0.7 ? 1 : 0);
      const n = chord[k % 4] + 12 * (1 + Math.floor(k / 4));
      this.arp(n, t, Math.min(1, (e - 0.42) * 2.5));
    }
    if (e > 0.62 && s % 2 === 0) this.hat(t, s % 4 === 2 ? 1 : 0.45, Math.min(1, (e - 0.62) * 3));
    if (this.inRun && s % 4 === 0) this.kick(t);
  }

  voice(type, freq, t, dur, g, { attack = 0.01, cutoff = 4000, q = 0.7, dest = this.musicBus, detune = 0, send = 0 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = q;
    const a = ctx.createGain();
    a.gain.setValueAtTime(0, t);
    a.gain.linearRampToValueAtTime(g, t + attack);
    a.gain.setTargetAtTime(0, t + Math.max(attack, dur * 0.6), dur * 0.3);
    o.connect(f).connect(a).connect(dest);
    if (send) { const sg = ctx.createGain(); sg.gain.value = send; a.connect(sg).connect(this.echo); }
    o.start(t); o.stop(t + dur * 1.8 + 0.1);
    return f;
  }

  pad(chord, t, dur) {
    const cut = 700 + this.bright * 1600 + this.energy * 500;
    for (const n of chord) {
      for (const d of [-9, 9]) {
        const f = this.voice('sawtooth', NOTE(n), t, dur * 1.15, 0.022, { attack: 1.4, cutoff: cut, detune: d, dest: this.verb });
        f.frequency.setValueAtTime(cut * 0.6, t);
        f.frequency.linearRampToValueAtTime(cut, t + dur * 0.5);
        this.voice('sawtooth', NOTE(n), t, dur * 1.15, 0.016, { attack: 1.4, cutoff: cut, detune: d });
      }
    }
  }

  bass(n, t, e) {
    const f = this.voice('sawtooth', NOTE(n), t, 0.24, 0.11 * Math.min(1, e * 2), { attack: 0.005, cutoff: 260 + e * 500, q: 4 });
    f.frequency.setValueAtTime(900 + e * 700, t);
    f.frequency.exponentialRampToValueAtTime(220, t + 0.18);
  }

  arp(n, t, g) {
    this.voice('square', NOTE(n), t, 0.14, 0.03 * g, { attack: 0.004, cutoff: 1800 + this.bright * 2400, send: 0.7 });
  }

  hat(t, accent, g) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.white;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
    const a = ctx.createGain();
    a.gain.setValueAtTime(0.05 * accent * g, t);
    a.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f).connect(a).connect(this.musicBus);
    s.start(t, Math.random() * 2, 0.08);
  }

  kick(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const a = ctx.createGain(); a.gain.setValueAtTime(0.32, t); a.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(a).connect(this.musicBus); o.start(t); o.stop(t + 0.32);
  }

  // ---- one-shots ----
  burst(buf, t, { type = 'lowpass', f0 = 1200, f1 = 200, g = 0.3, dur = 0.3, dest = this.sfx, rate = 1 }) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const a = ctx.createGain(); a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(a).connect(dest);
    s.loop = dur > buf.duration * 0.5;
    s.start(t, Math.random() * Math.max(0, buf.duration - dur - 0.1)); s.stop(t + dur + 0.05);
  }

  impact(strength) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, k = Math.min(1, strength / 30);
    this.burst(this.white, t, { f0: 2400 + k * 2000, f1: 300, g: 0.18 + k * 0.4, dur: 0.18 + k * 0.25 });
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const a = this.ctx.createGain(); a.gain.setValueAtTime(0.25 + k * 0.5, t); a.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(a).connect(this.sfx); o.start(t); o.stop(t + 0.4);
  }

  thunder(dist) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + Math.min(5, Math.max(0.15, dist / 343));
    const near = Math.max(0, 1 - dist / 1200);
    if (near > 0.3) this.burst(this.white, t, { f0: 3000, f1: 400, g: 0.35 * near, dur: 0.35, dest: this.amb });
    this.burst(this.brown, t + 0.05, { f0: 420 + near * 400, f1: 50, g: 0.55 + near * 0.4, dur: 4.5 + Math.random() * 2.5, dest: this.amb, rate: 0.6 });
  }

  chime(i, n) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const scale = [62, 65, 69, 72, 74, 77, 81, 84];
    const m = scale[Math.min(scale.length - 1, Math.floor((i / Math.max(1, n - 1)) * (scale.length - 1)))];
    for (const [d, g] of [[0, 0.09], [7, 0.05]]) this.voice('triangle', NOTE(m + d), t, 0.5, g, { attack: 0.004, cutoff: 6000, dest: this.sfx, send: 0.6 });
  }

  shard() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [74, 78, 81, 86, 90].forEach((m, k) => this.voice('sine', NOTE(m), t + k * 0.055, 0.6, 0.07, { attack: 0.003, cutoff: 9000, dest: this.sfx, send: 0.8 }));
  }

  ui() {
    if (!this.ctx) return;
    this.voice('sine', 1760, this.ctx.currentTime, 0.05, 0.04, { attack: 0.002, cutoff: 9000, dest: this.sfx });
  }

  beep(high) {
    if (!this.ctx) return;
    this.voice('square', high ? 1320 : 660, this.ctx.currentTime, high ? 0.5 : 0.18, 0.05, { attack: 0.003, cutoff: 3000, dest: this.sfx });
  }

  fanfare(medal) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = medal === 'gold' ? [62, 69, 74, 78, 81] : medal ? [62, 69, 74, 77] : [62, 65, 69];
    notes.forEach((m, k) => this.voice('sawtooth', NOTE(m), t + k * 0.11, 1.2, 0.05, { attack: 0.01, cutoff: 2600, dest: this.sfx, send: 0.5 }));
  }

  horn() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const f of [392, 494]) {
      const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
      const a = this.ctx.createGain(); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.06, t + 0.02); a.gain.setValueAtTime(0.06, t + 0.38); a.gain.linearRampToValueAtTime(0, t + 0.45);
      o.connect(lp).connect(a).connect(this.sfx); o.start(t); o.stop(t + 0.5);
    }
  }

  whoosh() {
    if (!this.ctx) return;
    this.burst(this.pink, this.ctx.currentTime, { type: 'bandpass', f0: 400, f1: 2600, g: 0.25, dur: 0.6 });
  }
}
