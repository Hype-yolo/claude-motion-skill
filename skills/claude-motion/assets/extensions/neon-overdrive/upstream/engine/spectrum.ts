// GPU copies of the analysis for shaders: the mel spectrogram and chroma (with their history, so a
// shader can read any time, e.g. a spectrogram terrain scrolling past), and the raw stereo waveform.
//
// Textures can't be taller than 16384 rows, so frames are packed ROWS_PER frames per texture row:
// frame f, band b lives at texel ((f % PACK) * bands + b, f / PACK). Use the GLSL helpers below,
// which do the unpacking and the interpolation:
//
//   const pass = new FSPass(`${SPECTRUM_GLSL}
//     uniform float t;
//     void main() { float e = melAt(t, vUv.x * 63.0); ... }`, { t: { value: 0 }, ...spectrumUniforms(this.ctx.spectrum) });
import * as THREE from 'three';
import { AudioData } from './audio';

const PACK = 32; // frames per texture row
const WAVE_W = 4096;

export interface SpectrumTextures {
  mel: THREE.DataTexture;
  chroma: THREE.DataTexture;
  wave: THREE.DataTexture;
  frames: number;
  fps: number;
  bands: number;
  waveRate: number;
  waveFrames: number;
}

export function createSpectrumTextures(a: AudioData): SpectrumTextures {
  const F = Math.max(1, a.specFrames), M = a.MEL, S = M + 12, rows = Math.ceil(F / PACK);
  const mel = new Uint8Array(PACK * M * rows), chroma = new Uint8Array(PACK * 12 * rows);
  for (let f = 0; f < a.specFrames; f++) {
    const x = f % PACK, y = Math.floor(f / PACK);
    mel.set(a.spec.subarray(f * S, f * S + M), y * PACK * M + x * M);
    chroma.set(a.spec.subarray(f * S + M, f * S + S), y * PACK * 12 + x * 12);
  }
  const tex = (data: ArrayBufferView, w: number, h: number, format: THREE.PixelFormat, type: THREE.TextureDataType) => {
    const t = new THREE.DataTexture(data as any, w, h, format, type);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  };
  const wn = Math.max(1, a.wave.length >> 1), wrows = Math.ceil(wn / WAVE_W);
  const wave = new Float32Array(WAVE_W * wrows * 2);
  wave.set(a.wave);
  return {
    mel: tex(mel, PACK * M, rows, THREE.RedFormat, THREE.UnsignedByteType),
    chroma: tex(chroma, PACK * 12, rows, THREE.RedFormat, THREE.UnsignedByteType),
    wave: tex(wave, WAVE_W, wrows, THREE.RGFormat, THREE.FloatType),
    frames: F, fps: a.fps, bands: M, waveRate: a.waveRate, waveFrames: wn,
  };
}

/** Uniforms for SPECTRUM_GLSL; spread into an FSPass / ShaderMaterial's uniforms. */
export function spectrumUniforms(s: SpectrumTextures) {
  return {
    uMel: { value: s.mel }, uChroma: { value: s.chroma }, uWave: { value: s.wave },
    uSpecInfo: { value: new THREE.Vector4(s.frames, s.fps, s.bands, 0) },
    uWaveInfo: { value: new THREE.Vector2(s.waveFrames, s.waveRate) },
  };
}

/**
 * GLSL helpers (include in the fragment source after GLSL_COMMON):
 *   float melAt(float t, float band)   mel energy 0..1 (per-band normalized dB: 0 = band floor, 1 = band peak) at song time t, band 0..63 (fractional ok)
 *   float melAvg(float t, float b0, float b1)  mean over bands [b0, b1] (integers, ≤ 16 bands wide is cheap)
 *   float chromaAt(float t, int k)     chroma bin k (0 = C .. 11 = B), 0..1
 *   vec2  waveAt(float t)              raw stereo sample (L, R) −1..1 at song time t
 */
export const SPECTRUM_GLSL = /* glsl */ `
uniform sampler2D uMel; uniform sampler2D uChroma; uniform sampler2D uWave;
uniform vec4 uSpecInfo; // frames, fps, bands, -
uniform vec2 uWaveInfo; // frames, rate
float melTexel(int f, int b) {
  int F = int(uSpecInfo.x), B = int(uSpecInfo.z);
  f = clamp(f, 0, F - 1); b = clamp(b, 0, B - 1);
  return texelFetch(uMel, ivec2((f % ${PACK}) * B + b, f / ${PACK}), 0).r;
}
float melAt(float t, float band) {
  float x = clamp(t * uSpecInfo.y, 0.0, uSpecInfo.x - 1.001);
  int f = int(floor(x)); float ft = x - float(f);
  float bb = clamp(band, 0.0, uSpecInfo.z - 1.001);
  int b = int(floor(bb)); float fb = bb - float(b);
  float v0 = mix(melTexel(f, b), melTexel(f, b + 1), fb);
  float v1 = mix(melTexel(f + 1, b), melTexel(f + 1, b + 1), fb);
  return mix(v0, v1, ft);
}
float melAvg(float t, float b0, float b1) {
  float s = 0.0, n = 0.0;
  for (int i = 0; i < 64; i++) { float b = b0 + float(i); if (b > b1) break; s += melAt(t, b); n += 1.0; }
  return s / max(n, 1.0);
}
float chromaAt(float t, int k) {
  float x = clamp(t * uSpecInfo.y, 0.0, uSpecInfo.x - 1.001);
  int f = int(floor(x)); float ft = x - float(f);
  int F = int(uSpecInfo.x);
  float a = texelFetch(uChroma, ivec2((f % ${PACK}) * 12 + k, f / ${PACK}), 0).r;
  int f1 = min(f + 1, F - 1);
  float b = texelFetch(uChroma, ivec2((f1 % ${PACK}) * 12 + k, f1 / ${PACK}), 0).r;
  return mix(a, b, ft);
}
vec2 waveTexel(int i) {
  i = clamp(i, 0, int(uWaveInfo.x) - 1);
  return texelFetch(uWave, ivec2(i % ${WAVE_W}, i / ${WAVE_W}), 0).rg;
}
vec2 waveAt(float t) {
  float x = clamp(t * uWaveInfo.y, 0.0, uWaveInfo.x - 1.001);
  int i = int(floor(x));
  return mix(waveTexel(i), waveTexel(i + 1), x - float(i));
}
`;
