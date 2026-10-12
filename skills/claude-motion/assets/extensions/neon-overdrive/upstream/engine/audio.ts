// Music analysis (data/audio.json) sampled at arbitrary song time.

export interface AudioJSON {
  duration: number;
  bpm: number;
  fps: number;
  beats: number[];
  downbeats: number[];
  sections: { name: string; start: number; end: number }[];
  features: Record<string, number[]>;
  onsets: Record<string, [number, number][]>;
  bar0?: number;
  bass_midi?: number[];
  spectrum?: { file: string; frames: number; mel: number; chroma: number; fmin: number; fmax: number };
  wave?: { file: string; rate: number; channels: number; frames: number };
}

export interface AudioSample {
  rms: number; low: number; mid: number; high: number;
  vocal: number; drums: number; bass: number; other: number;
  /** Decaying pulses (1 at the hit, half-life ~90-140 ms), scaled by hit strength. */
  kick: number; snare: number; hat: number; vonset: number;
}

const FEATURES = ['rms', 'low', 'mid', 'high', 'vocal', 'drums', 'bass', 'other'] as const;

export class AudioData {
  duration: number;
  bpm: number;
  beats: number[];
  downbeats: number[];
  sections: { name: string; start: number; end: number }[];
  /** Frame rate of the envelopes, bass pitch and spectrogram. */
  fps: number;
  private feat: Record<string, Float32Array> = {};
  onsets: Record<string, [number, number][]>;
  private bassMidiArr: Float32Array;
  /** Spectrogram of the mix: frame-major uint8, MEL mel bands (low→high, 0..255 = per-band normalized dB, floor..peak) then 12 chroma bins (C..B) per frame, at `fps`. */
  spec: Uint8Array = new Uint8Array(0);
  specFrames = 0;
  readonly MEL: number;
  static readonly CHROMA = 12;
  /** Raw stereo waveform (peak-normalized, −1..1), interleaved L/R at waveRate. */
  wave: Float32Array = new Float32Array(0);
  waveRate = 11025;

  constructor(j: AudioJSON) {
    this.duration = j.duration;
    this.bpm = j.bpm;
    this.beats = j.beats;
    this.downbeats = j.downbeats;
    this.sections = j.sections;
    this.fps = j.fps || 100;
    // envelopes may be nested under `features` or top-level arrays
    for (const k of FEATURES) this.feat[k] = Float32Array.from(j.features?.[k] ?? ((j as any)[k] as number[] | undefined) ?? []);
    this.onsets = j.onsets ?? {};
    this.bassMidiArr = Float32Array.from(j.bass_midi ?? []);
    this.MEL = j.spectrum?.mel ?? 64;
  }

  static async load(): Promise<AudioData> {
    const r = await fetch('data/audio.json');
    if (!r.ok) throw new Error('no audio analysis data found (data/audio.json)');
    const j: AudioJSON = await r.json();
    const a = new AudioData(j);
    const bins = await Promise.all([j.spectrum?.file, j.wave?.file].map(async (f) => {
      if (!f) return null;
      const r = await fetch(f);
      // data/wave.bin is a playable copy of the song, so it isn't in the repo; analyze.py regenerates it
      return r.ok && !r.headers.get('content-type')?.includes('text/html') ? new Uint8Array(await r.arrayBuffer()) : null;
    }));
    if (bins[0]) { a.spec = bins[0]; a.specFrames = Math.floor(bins[0].length / (a.MEL + AudioData.CHROMA)); }
    if (bins[1]) {
      const i16 = new Int16Array(bins[1].buffer, bins[1].byteOffset, bins[1].byteLength >> 1);
      a.wave = new Float32Array(i16.length);
      for (let i = 0; i < i16.length; i++) a.wave[i] = i16[i]! / 32767;
      a.waveRate = j.wave!.rate;
    }
    return a;
  }

  /** Mel band energy 0..1 at t (band 0..MEL-1, fractional bands interpolate), linear in time. 0..1 = the band.s floor..peak (dB-linear). */
  mel(t: number, band: number): number {
    const F = this.specFrames, S = this.MEL + AudioData.CHROMA;
    if (!F) return 0;
    const x = Math.max(0, Math.min(F - 1.001, t * this.fps)), i = Math.floor(x), f = x - i;
    const b = Math.max(0, Math.min(this.MEL - 1.001, band)), bi = Math.floor(b), bf = b - bi;
    const at = (fi: number, bb: number) => this.spec[fi * S + bb]!;
    const v0 = at(i, bi) * (1 - bf) + at(i, bi + 1) * bf, v1 = at(i + 1, bi) * (1 - bf) + at(i + 1, bi + 1) * bf;
    return (v0 * (1 - f) + v1 * f) / 255;
  }

  /** All MEL bands at t into `out` (0..1). */
  melFrame(t: number, out = new Float32Array(this.MEL)): Float32Array {
    for (let b = 0; b < this.MEL; b++) out[b] = this.mel(t, b);
    return out;
  }

  /** Chroma of the harmonic stem at t (12 bins C..B, 0..1) into `out`. */
  chroma(t: number, out = new Float32Array(12)): Float32Array {
    const F = this.specFrames, S = this.MEL + AudioData.CHROMA;
    if (!F) return out.fill(0);
    const x = Math.max(0, Math.min(F - 1.001, t * this.fps)), i = Math.floor(x), f = x - i;
    for (let k = 0; k < 12; k++) out[k] = (this.spec[i * S + this.MEL + k]! * (1 - f) + this.spec[(i + 1) * S + this.MEL + k]! * f) / 255;
    return out;
  }

  /** Bass-stem pitch at t as a (fractional) MIDI note, 0 where the bass is silent/unvoiced. No interpolation across note changes. */
  bassMidi(t: number): number {
    const a = this.bassMidiArr;
    if (!a.length) return 0;
    return a[Math.max(0, Math.min(a.length - 1, Math.round(t * this.fps)))]!;
  }

  /** Waveform sample at t: [L, R] (−1..1), linear interpolation. */
  waveAt(t: number, out: [number, number] = [0, 0]): [number, number] {
    const n = this.wave.length >> 1;
    if (!n) { out[0] = out[1] = 0; return out; }
    const x = Math.max(0, Math.min(n - 1.001, t * this.waveRate)), i = Math.floor(x), f = x - i;
    out[0] = this.wave[2 * i]! * (1 - f) + this.wave[2 * i + 2]! * f;
    out[1] = this.wave[2 * i + 1]! * (1 - f) + this.wave[2 * i + 3]! * f;
    return out;
  }

  /**
   * Sidechain "pump" on the beat grid, the future-house bounce: 0 right at each beat (the kick ducks
   * everything), recovering to 1 over ~55% of the beat. Pure beat-grid shape — weight it by env('bass')
   * or the section to keep it quiet in breakdowns.
   */
  pump(t: number, recover = 0.55): number {
    const b = this.beatAt(t), ph = b - Math.floor(b);
    const x = Math.min(1, ph / recover);
    return 1 - (1 - x) * (1 - x); // fast drop, eased recovery
  }

  /** The section at t with its local progress 0..1 and index. */
  sectionAt(t: number): { name: string; start: number; end: number; p: number; i: number } {
    let i = this.sections.findIndex((s) => t >= s.start && t < s.end);
    if (i < 0) i = t < (this.sections[0]?.start ?? 0) ? 0 : this.sections.length - 1;
    const s = this.sections[i]!;
    return { ...s, p: Math.max(0, Math.min(1, (t - s.start) / (s.end - s.start))), i };
  }

  /** Linear-interpolated envelope value at time t. */
  env(name: string, t: number): number {
    const a = this.feat[name];
    if (!a || a.length === 0) return 0;
    const x = t * this.fps;
    const i = Math.floor(x);
    if (i < 0) return a[0]!;
    if (i >= a.length - 1) return a[a.length - 1]!;
    const f = x - i;
    return a[i]! * (1 - f) + a[i + 1]! * f;
  }

  /** Max over [t - w, t]: a peak-hold for punchy reactions. */
  envPeak(name: string, t: number, w = 0.08): number {
    let m = 0;
    for (let s = t - w; s <= t; s += 1 / this.fps) m = Math.max(m, this.env(name, s));
    return m;
  }

  /** Sum of decaying pulses from onsets of a kind (kick/snare/hat/vocal) before t. */
  hit(kind: string, t: number, halfLife = 0.11): number {
    const list = this.onsets[kind];
    if (!list || list.length === 0) return 0;
    let lo = 0, hi = list.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (list[m]![0] <= t) lo = m + 1; else hi = m; }
    let v = 0;
    for (let i = lo - 1; i >= 0 && i >= lo - 6; i--) {
      const [ot, s] = list[i]!;
      const dt = t - ot;
      if (dt > halfLife * 8) break;
      v = Math.max(v, s * Math.pow(0.5, dt / halfLife));
    }
    return v;
  }

  /** Onset events of a kind in [t0, t1). */
  events(kind: string, t0: number, t1: number): [number, number][] {
    return (this.onsets[kind] ?? []).filter(([t]) => t >= t0 && t < t1);
  }

  sample(t: number): AudioSample {
    return {
      rms: this.env('rms', t), low: this.env('low', t), mid: this.env('mid', t), high: this.env('high', t),
      vocal: this.env('vocal', t), drums: this.env('drums', t), bass: this.env('bass', t), other: this.env('other', t),
      kick: this.hit('kick', t, 0.12), snare: this.hit('snare', t, 0.14), hat: this.hit('hat', t, 0.06),
      vonset: this.hit('vocal', t, 0.15),
    };
  }

  /** Continuous beat index: 0 at first beat, fractional in between (extrapolated outside). */
  beatAt(t: number): number {
    const b = this.beats;
    if (b.length < 2) return t * (this.bpm / 60);
    if (t <= b[0]!) return (t - b[0]!) / (b[1]! - b[0]!);
    if (t >= b[b.length - 1]!) {
      const p = b[b.length - 1]! - b[b.length - 2]!;
      return b.length - 1 + (t - b[b.length - 1]!) / p;
    }
    let lo = 0, hi = b.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (b[m]! <= t) lo = m; else hi = m; }
    return lo + (t - b[lo]!) / (b[hi]! - b[lo]!);
  }

  /** Time of (fractional) beat index. */
  timeOfBeat(i: number): number {
    const b = this.beats;
    const n = b.length;
    const period = n > 1 ? (b[n - 1]! - b[0]!) / (n - 1) : 60 / this.bpm;
    if (i <= 0) return (b[0] ?? 0) + i * period;
    if (i >= n - 1) return b[n - 1]! + (i - (n - 1)) * period;
    const k = Math.floor(i);
    return b[k]! + (b[k + 1]! - b[k]!) * (i - k);
  }

  /** Continuous bar index from downbeats (0 at first downbeat). */
  barAt(t: number): number {
    const d = this.downbeats;
    if (d.length < 2) return this.beatAt(t) / 4;
    if (t <= d[0]!) return (t - d[0]!) / (d[1]! - d[0]!);
    if (t >= d[d.length - 1]!) {
      const p = d[d.length - 1]! - d[d.length - 2]!;
      return d.length - 1 + (t - d[d.length - 1]!) / p;
    }
    let lo = 0, hi = d.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (d[m]! <= t) lo = m; else hi = m; }
    return lo + (t - d[lo]!) / (d[hi]! - d[lo]!);
  }

  /** Nearest beat time to t. */
  nearestBeat(t: number): number {
    return this.timeOfBeat(Math.round(this.beatAt(t)));
  }

  section(t: number) {
    return this.sections.find((s) => t >= s.start && t < s.end) ?? this.sections[this.sections.length - 1];
  }
}
