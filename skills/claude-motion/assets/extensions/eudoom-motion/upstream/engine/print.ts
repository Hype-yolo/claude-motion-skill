// The print pass (replaces bloom/grain post). The composited frame is treated as artwork: every pixel
// is separated into four ink coverages through a LUT (tools/make_inklut.py), each ink is screened
// (solid where full, halftone dots where a tint), shifted by its own registration offset, given
// riso-like ink texture, and printed onto paper by multiplying transmittances. So nothing can
// appear on screen that four inks on paper couldn't print.
import * as THREE from 'three';
import { FSPass, W, H } from './gl';
import { LIN } from './palette';
import type { PostParams } from './post';
import { hash, hexToLinear } from './util';

const INKS = ['black', 'blue', 'yellow', 'orange'] as const;
// screen angles (radians) per ink, the classic separation angles
const ANG = [45, 15, 0, 75].map((d) => (d * Math.PI) / 180);
// how much each ink's plate drifts (yellow and orange wander most, as on a riso drum change)
const DRIFT = [0.6, 1.0, 1.4, 1.2];

export class PrintPost {
  pass: FSPass;
  private lut: THREE.Data3DTexture | null = null;
  private lutN = 33;

  private T0: THREE.Vector3[];
  private T1 = INKS.map(() => new THREE.Vector3());

  constructor() {
    const T = (['black', 'blue', 'yellow', 'orange'] as const).map((k) => {
      const c = LIN[k], p = LIN.paper;
      return new THREE.Vector3(Math.min(1, c[0] / p[0]), Math.min(1, c[1] / p[1]), Math.min(1, c[2] / p[2]));
    });
    this.T0 = T;
    this.pass = new FSPass(/* glsl */ `
      precision highp sampler3D;
      uniform sampler2D src;
      uniform sampler3D lut;
      uniform float lutN;
      uniform vec3 inkT[4];
      uniform vec3 paper;
      uniform vec2 regOff[4];
      uniform float angles[4];
      uniform float cell, seed, inkTex, edgeRough, zoom, fade, flash, paperNoise;
      uniform int mode;
      uniform vec2 shake, res, paperShift;

      vec3 srcSRGB(vec2 px) {
        vec2 p = (px - 0.5 * res) / zoom + 0.5 * res - shake;
        return toSRGB(sat(texture(src, p / res).rgb));
      }
      vec4 sep(vec3 s) {
        vec3 q = (s * (lutN - 1.0) + 0.5) / lutN;
        vec4 a = texture(lut, q);
        return clamp((a - 0.035) / 0.965, 0.0, 1.0); // dead zone: LUT noise near paper prints nothing
      }
      // dot area -> threshold (inverse of the cos+cos dot's area curve, fitted in make_inklut)
      float dotThresh(float a) {
        float c = 25.10827;
        c = c * a - 87.90272; c = c * a + 117.42293; c = c * a - 73.76078; c = c * a + 22.79786;
        c = c * a - 4.40398; c = c * a + 1.74246; c = c * a - 0.00203;
        return clamp(c, 0.0, 1.0);
      }
      float screenDot(vec2 px, float ang, float a, float cellPx) {
        if (a <= 0.004) return 0.0;
        if (a >= 0.975) return 1.0;
        float c = dotThresh(a);
        float s = sin(ang), co = cos(ang);
        vec2 r = mat2(co, -s, s, co) * px / cellPx;
        float d = 0.5 - 0.25 * (cos(TAU * r.x) + cos(TAU * r.y));
        float aa = max(fwidth(d) * 0.75, 1e-4);
        return 1.0 - smoothstep(c - aa, c + aa, d);
      }
      float bayer4(vec2 p) {
        ivec2 i = ivec2(mod(floor(p), 4.0));
        int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
        return (float(b[i.y * 4 + i.x]) + 0.5) / 16.0;
      }
      float inkGrain(vec2 px, float k) {
        // riso solids: fine mottle where the paper drank more or less ink, sparse unprinted specks,
        // faint drum banding. Black is nearly opaque, so it gets a fraction of the variation.
        vec2 q = px + paperShift;
        float amp = k < 0.5 ? 0.3 : 1.0;
        float fine = 0.5 + 0.5 * snoise(q * 0.42 + vec2(k * 7.3, seed * 0.37));
        float mott = 0.5 + 0.5 * snoise(q / 16.0 + vec2(seed * 0.21, k * 3.1));
        float speck = step(0.988, hash12(floor(q) + seed * 17.0 + k * 91.0));
        float band = 0.5 + 0.5 * sin(q.y / 11.0 + k * 2.0 + seed);
        float loss = amp * (0.06 * fine + 0.07 * mott * mott + 0.02 * band) + speck * 0.7;
        return 1.0 - inkTex * clamp(loss, 0.0, 1.0);
      }
      void main() {
        vec2 px = FRAG_PX;
        vec3 outc = paper;
        // paper: fibres + mottle, fixed to the sheet
        vec2 q = px + paperShift;
        float fib = snoise(q * vec2(0.8, 0.22)) * 0.010 + snoise(q * 0.045) * 0.016 + (hash12(floor(q * 1.0)) - 0.5) * 0.018;
        outc *= 1.0 + fib * paperNoise;
        for (int k = 0; k < 4; k++) {
          float fk = float(k);
          vec2 jit = vec2(snoise(px * 0.55 + vec2(seed * 3.1, fk * 13.0)), snoise(px * 0.55 + vec2(19.7 + fk * 5.0, seed * 2.3))) * edgeRough;
          vec4 cov = sep(srcSRGB(px + regOff[k] + jit));
          float a = k == 0 ? cov.x : k == 1 ? cov.y : k == 2 ? cov.z : cov.w;
          float m;
          if (mode == 1 && k == 0) m = step(bayer4(px / 2.0), a); // fax: 1-bit ordered dither
          else m = screenDot(px, angles[k], a, cell);
          m *= inkGrain(px, fk);
          outc *= 1.0 - m * (1.0 - inkT[k]);
        }
        outc = mix(outc, paper, clamp(flash, 0.0, 1.0));
        outc = mix(outc, paper, clamp(fade, 0.0, 1.0));
        vec3 s = toSRGB(sat(outc));
        s += (hash12(gl_FragCoord.xy * 1.37 + seed) - 0.5) / 255.0;
        fragColor = vec4(sat(s), 1.0);
      }`, {
      src: { value: null }, lut: { value: null }, lutN: { value: 33 },
      inkT: { value: T }, paper: { value: new THREE.Vector3(...LIN.paper) },
      regOff: { value: [0, 1, 2, 3].map(() => new THREE.Vector2()) },
      angles: { value: ANG },
      cell: { value: 7 }, seed: { value: 0 }, inkTex: { value: 1 }, edgeRough: { value: 0.6 },
      zoom: { value: 1 }, fade: { value: 0 }, flash: { value: 0 }, paperNoise: { value: 1 },
      mode: { value: 0 }, shake: { value: new THREE.Vector2() }, res: { value: new THREE.Vector2(W, H) },
      paperShift: { value: new THREE.Vector2() },
    });
  }

  async init() {
    const meta = await (await fetch('lut/inklut.json')).json();
    const buf = new Uint8Array(await (await fetch('lut/inklut.bin')).arrayBuffer());
    const N = meta.N as number;
    const tex = new THREE.Data3DTexture(buf, N, N, N);
    tex.format = THREE.RGBAFormat;
    tex.type = THREE.UnsignedByteType;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapR = tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.unpackAlignment = 1;
    tex.needsUpdate = true;
    this.lut = tex;
    this.lutN = N;
  }

  render(renderer: THREE.WebGLRenderer, src: THREE.Texture, out: THREE.WebGLRenderTarget | null, p: PostParams, t: number) {
    const u = this.pass.u;
    // the print clock: registration and ink texture change once per printed "generation"
    const fps = p.printFps ?? 12;
    const gen = fps > 0 ? Math.floor(t * fps + 1e-6) : 0;
    const reg = p.reg ?? 1.6;
    const offs = u.regOff!.value as THREE.Vector2[];
    for (let k = 0; k < 4; k++) {
      // a fixed per-ink bias (the plates were never quite aligned) plus a per-generation wobble
      const bx = (hash(k, 11) - 0.5) * 2, by = (hash(k, 23) - 0.5) * 2;
      const wx = (hash(gen, k, 5) - 0.5) * 2, wy = (hash(gen, k, 7) - 0.5) * 2;
      offs[k]!.set((bx * 0.7 + wx * 0.5) * reg * DRIFT[k]!, (by * 0.7 + wy * 0.5) * reg * DRIFT[k]!);
    }
    // a drum change: an ink swapped for this frame
    if (p.inks) {
      INKS.forEach((k, i) => {
        const h = p.inks![k], q = LIN.paper;
        if (!h) { this.T1[i]!.copy(this.T0[i]!); return; }
        const c = hexToLinear(h); this.T1[i]!.set(Math.min(1, c[0] / q[0]), Math.min(1, c[1] / q[1]), Math.min(1, c[2] / q[2]));
      });
      u.inkT!.value = this.T1;
    } else u.inkT!.value = this.T0;
    u.src!.value = src;
    u.lut!.value = this.lut;
    u.lutN!.value = this.lutN;
    u.cell!.value = p.cell ?? 7;
    u.seed!.value = gen % 997;
    u.inkTex!.value = p.inkTex ?? 1;
    u.edgeRough!.value = p.edge ?? 0.6;
    u.zoom!.value = p.zoom;
    u.fade!.value = p.fade;
    u.flash!.value = p.flash;
    u.paperNoise!.value = p.paperNoise ?? 1;
    u.mode!.value = p.mode ?? 0;
    (u.shake!.value as THREE.Vector2).set(p.shake[0], p.shake[1]);
    (u.paperShift!.value as THREE.Vector2).set(p.paperShift?.[0] ?? 0, p.paperShift?.[1] ?? 0);
    this.pass.render(renderer, out);
  }
}

export const INK_ORDER = INKS;
