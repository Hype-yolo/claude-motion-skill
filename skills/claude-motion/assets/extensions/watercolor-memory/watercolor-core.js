import * as THREE from'three';import{createNoise4D}from'simplex-noise';const CLIMAX=9.75;
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeNoise(size = 256) {
  const noise4 = createNoise4D(mulberry32(1337));
  const chans = [ { f: 3, o: 5 }, { f: 6, o: 4 }, { f: 24, o: 3 }, { f: 4, o: 4 } ];
  const raw = new Float32Array(size * size * 4);
  const cu = new Float32Array(size), su = new Float32Array(size);
  for (let i = 0; i < size; i++) { const a = (i / size) * Math.PI * 2; cu[i] = Math.cos(a); su[i] = Math.sin(a); }
  const lo = [1e9, 1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9, -1e9];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    for (let c = 0; c < 4; c++) {
      const { f, o } = chans[c];
      let v = 0, amp = 0.5, r = f / (Math.PI * 2);
      for (let k = 0; k < o; k++) {
        const off = c * 31.7 + k * 7.3;
        v += amp * noise4(cu[x] * r + off, su[x] * r - off, cu[y] * r + off * 0.5, su[y] * r - off * 0.5);
        amp *= 0.5; r *= 2;
      }
      raw[(y * size + x) * 4 + c] = v;
      if (v < lo[c]) lo[c] = v; if (v > hi[c]) hi[c] = v;
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < raw.length; i++) { const c = i & 3; data[i] = Math.round(255 * (raw[i] - lo[c]) / (hi[c] - lo[c])); }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.needsUpdate = true;
  return tex;
}

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Inverse of the swing's perspective pendulum: given a point on screen (scene
// uv), where on the resting swing drawing did it come from? pose = (sinθ, cosθ,
// lateral px, alpha). The swing moves toward/away from the viewer in depth.
const SWING_GLSL = /* glsl */`
  const vec2 ART = vec2(2000.0, 1500.0);
  const float PIVOT_Y = 405.0, ROPE_L = 590.0, EYE_Y = 820.0, CAM_D = 2000.0, SWING_CX = 1040.0;
  vec2 unswing(vec2 uv, vec4 pose) {
    vec2 a = vec2(uv.x * ART.x, (1.0 - uv.y) * ART.y);
    float s = CAM_D * (a.y - PIVOT_Y) / (ROPE_L * (CAM_D * pose.y + (a.y - EYE_Y) * pose.x));
    s = max(s, 0.0);
    float k = CAM_D / (CAM_D - s * ROPE_L * pose.x);
    vec2 b = vec2(SWING_CX + (a.x - SWING_CX - pose.z * s) / k, PIVOT_Y + s * ROPE_L);
    b = mix(a, b, step(PIVOT_Y, a.y));
    return vec2(b.x / ART.x, 1.0 - b.y / ART.y);
  }
`;

// One step of pigment transport: a noise-weighted max-dilation, so each wet
// front follows the paper's uneven thirst (fingers, tide lines, drips).
const SIM_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev, uMask, uNoise;
  uniform vec2  uTexel;
  uniform vec4  uInject;
  uniform vec4  uK;
  uniform float uRad;
  uniform vec4  uSweep;
  uniform float uAngle;
  uniform vec2  uSeat;
  uniform vec4  uPose;
  const float ASPECT = 4.0 / 3.0;
  ${SWING_GLSL}

  void main() {
    vec2 sp = vUv * vec2(ASPECT, 1.0);
    float nL = texture2D(uNoise, sp * 1.3 + vec2(0.11, 0.53)).r;
    float nM = texture2D(uNoise, sp * 4.7 + vec2(0.37, 0.19)).g;
    float nH = texture2D(uNoise, sp * 13.0 + vec2(0.71, 0.83)).b;
    float thirst = mix(0.45, 2.0, smoothstep(0.28, 0.72, 0.5 * nL + 0.3 * nM + 0.2 * nH));

    vec4 f = texture2D(uPrev, vUv);
    for (int i = 0; i < 8; i++) {
      float a = uAngle + float(i) * 0.78539816;
      vec2 d = vec2(cos(a), sin(a));
      vec3 grav = 1.0 - vec3(0.16, 0.55, 0.3) * d.y;      // ropes drip hardest
      vec3 nb = texture2D(uPrev, vUv + d * uTexel * uRad).rgb;
      f.rgb = max(f.rgb, nb * exp(-uK.rgb * uRad * thirst * grav));
    }

    // the swing's regions follow it, so pigment is laid along its path
    vec2 wuv = vUv;
    vec3 m = vec3(texture2D(uMask, vUv).r, texture2D(uMask, wuv).gb);
    vec3 wetting = 0.3 + 0.7 * vec3(smoothstep(0.35, 0.65, nM), smoothstep(0.35, 0.65, nH), smoothstep(0.3, 0.7, nL));
    float sB = 1.0 - smoothstep(uSweep.r - 0.05, uSweep.r, vUv.x);           // trunk → tip
    float sR = smoothstep(uSweep.g - 0.04, uSweep.g, wuv.y);                  // down the ropes
    float sS = 1.0 - smoothstep(uSweep.b - 0.04, uSweep.b, length((wuv - uSeat) * vec2(ASPECT, 1.0)));
    vec3 src = m * vec3(sB, sR, sS);
    f.rgb = max(f.rgb, uInject.rgb * src * wetting);
    gl_FragColor = vec4(min(f.rgb, vec3(1.0)), 0.0);
  }
`;

const COMP_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uState, uLines, uMask, uNoise;
  uniform vec2  uRes;
  uniform vec4  uScene;       // drawing-buffer px: origin.xy, size.zw
  uniform float uPx;
  uniform vec2  uSimTexel;
  uniform float uZoom;
  uniform vec2  uFocus, uDrift;
  uniform vec3  uAmount, uWet, uSplat;
  uniform vec4  uGhost;
  uniform vec4  uPose[6];
  uniform float uRecall, uPulse, uGlow, uRays, uClimax, uT;
  uniform float uSkyR, uSkyAmt, uDropShrink, uDropAmt;
  uniform vec4  uDrop[8];     // centre.xy (scene uv), age, size
  uniform vec3  uDropCol[8];
  uniform vec4  uRipple[3];   // centre.xy, age, amplitude
  uniform float uFlash, uBreath, uInvert, uPaint;
  const float ASPECT = 4.0 / 3.0;
  ${SWING_GLSL}

  const vec3 PAPER   = vec3(0.957, 0.925, 0.875);
  const vec3 GOLD    = vec3(0.955, 0.740, 0.170);
  const vec3 ORANGE  = vec3(0.950, 0.410, 0.090);
  const vec3 ULTRA   = vec3(0.210, 0.290, 0.830);
  const vec3 TURQ    = vec3(0.040, 0.560, 0.640);
  const vec3 MAGENTA = vec3(0.860, 0.130, 0.500);
  const vec3 CRIMSON = vec3(0.880, 0.190, 0.290);
  const vec3 CORAL   = vec3(0.960, 0.400, 0.310);
  const vec3 VIOLET  = vec3(0.410, 0.190, 0.620);
  const vec3 INDIGO  = vec3(0.110, 0.110, 0.370);
  const vec3 TEAL    = vec3(0.050, 0.380, 0.450);
  const vec3 GRAPHITE = vec3(0.200, 0.190, 0.190);

  vec3 ab(vec3 c) { return max(-log(c / PAPER), 0.0); }       // Beer–Lambert absorbance
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  vec3 skyPalette(float r) {
    vec3 c = mix(GOLD, ORANGE, smoothstep(0.0, 0.22, r));
    c = mix(c, CORAL, smoothstep(0.18, 0.40, r));
    c = mix(c, MAGENTA, smoothstep(0.36, 0.58, r));
    c = mix(c, VIOLET, smoothstep(0.55, 0.78, r));
    c = mix(c, INDIGO, smoothstep(0.76, 1.0, r));
    return mix(c, TEAL, smoothstep(1.02, 1.3, r));
  }

  float pigment(float f, float g, float thr, float soft, float poolW, float poolAmt,
                float flow, float bn, float tooth) {
    float dist = (f - thr) / g;                          // CSS px inside the wet edge
    float body = smoothstep(-soft, soft, dist);
    float pool = body * exp(-max(dist, 0.0) / poolW);    // pigment dragged to the drying edge
    float d = 0.3 + 0.55 * flow * flow;
    d += pool * poolAmt;
    d += smoothstep(0.75, 1.0, f) * 0.18;
    float lvl = 0.70;                                    // back-runs: pale lobes, dark rims
    float bIn  = smoothstep(lvl, lvl + 0.012, bn);
    float bRim = bIn * (1.0 - smoothstep(lvl + 0.012, lvl + 0.045, bn));
    d = d * (1.0 - 0.35 * bIn) + bRim * 0.5;
    d *= mix(1.3, 0.75, tooth);                          // granulation
    return body * d;
  }

  // Splatter flung from a burst: one hashed dot per grid cell, denser near the centre.
  float splat(vec2 sp, vec2 c, float age, float scale, float seed) {
    vec2 g = sp * scale, id = floor(g), fr = fract(g);
    float h1 = hash(id + seed), h2 = hash(id + seed + 11.3), h3 = hash(id + seed + 27.9), h4 = hash(id + seed + 41.7);
    vec2 ctr = 0.2 + 0.6 * vec2(h2, h3);
    float rad = mix(0.07, 0.32, h1 * h1);
    float dd = length((id + ctr) / scale - c * vec2(ASPECT, 1.0));
    float reach = 0.32 * (1.0 - exp(-age * 4.0));
    float keep = step(h4, exp(-dd / 0.08) * 0.8) * step(dd, reach);
    return keep * (1.0 - smoothstep(rad * 0.7, rad, length(fr - ctr)));
  }

  void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 s0  = (frag - uScene.xy) / uScene.zw;                   // screen, in unzoomed scene units
    // each bloom lands like a drop on water: a ring that bends the whole picture
    float sheen = 0.0;
    for (int i = 0; i < 3; i++) {
      vec4 rp = uRipple[i];
      if (rp.z > 0.0 && rp.z < 2.5) {
        vec2 q = (s0 - rp.xy) * vec2(ASPECT, 1.0);
        float x = length(q) - rp.z * 0.9;
        float env = exp(-x * x / 0.006) * exp(-rp.z * 1.5) * rp.w;
        float w = sin(x * 64.0);
        s0 += normalize(q + 1e-5) * w * env / vec2(ASPECT, 1.0);
        sheen += max(w, 0.0) * env;
      }
    }
    vec2 suv = uFocus + (s0 - uFocus) / uZoom + uDrift;          // mid plane: the drawing
    float zb = 1.0 + (uZoom - 1.0) * 0.55;
    vec2 buv = uFocus + (s0 - uFocus) / zb + uDrift * 0.55;      // back plane: the sky
    vec2 cuv = clamp(suv, 0.0, 1.0);
    vec2 sp  = cuv * vec2(ASPECT, 1.0);
    vec2 bsp = buv * vec2(ASPECT, 1.0);
    float inside = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
    float border = smoothstep(0.0, 0.07, cuv.x) * smoothstep(0.0, 0.07, 1.0 - cuv.x)
                 * smoothstep(0.0, 0.07, cuv.y) * smoothstep(0.0, 0.07, 1.0 - cuv.y) * inside;

    // ---------------------------------------------------------------- paper
    vec2 gp = suv * uScene.zw / uPx;
    float t1  = texture2D(uNoise, gp / 83.0).b;
    float t1s = texture2D(uNoise, (gp + vec2(-0.9, 0.9)) / 83.0).b;
    float t2  = texture2D(uNoise, gp / 211.0 + 0.5).g;
    float mot = texture2D(uNoise, gp / 1300.0 + 0.7).r;
    float tooth = clamp(t1 * 0.65 + t2 * 0.35, 0.0, 1.0);
    vec3 paper = PAPER * (1.0 + (tooth - 0.5) * 0.05 + (mot - 0.5) * 0.05);
    paper *= 1.0 + (t1 - t1s) * 0.2;

    vec3 A = vec3(0.0);                                            // sky + drops absorbance

    // ---------------------------------------------------------------- sky + note drops (back plane)
    vec2 bw = texture2D(uNoise, bsp * 0.7 + vec2(0.013, -0.009) * uT).ra - 0.5;
    float bn1 = texture2D(uNoise, bsp * 3.0 + bw * 0.4).r;
    float bn2 = texture2D(uNoise, bsp * 10.0 + bw).b;
    if (uSkyAmt > 0.0) {
      vec2 q = (buv - vec2(0.53, 0.47)) * vec2(ASPECT, 1.0);
      float dist = length(q + bw * 0.22) * (0.86 + 0.3 * bn1) + (bn2 - 0.5) * 0.03;
      float ins = uSkyR - dist;
      float body = smoothstep(-0.003, 0.006, ins);
      float pool = body * exp(-max(ins, 0.0) / 0.022);
      float r = clamp(dist / 0.95 + bw.x * 0.3 - 0.14 * max(uT - ${CLIMAX.toFixed(2)}, 0.0) + 0.1, 0.0, 1.4);
      float dens = (0.55 + 0.6 * bn1) * mix(1.25, 0.8, tooth) + pool * 1.3;
      float bIn = smoothstep(0.66, 0.68, bn2 * 0.5 + bn1 * 0.5);
      dens = dens * (1.0 - 0.4 * bIn) + bIn * (1.0 - smoothstep(0.68, 0.72, bn2 * 0.5 + bn1 * 0.5)) * 0.6;
      dens *= 0.25 + 0.75 * smoothstep(0.0, 0.16, dist);          // the sun stays paper-white
      A += ab(skyPalette(r)) * dens * body * uSkyAmt;
    }
    for (int i = 0; i < 8; i++) {
      vec4 dp = uDrop[i];
      if (dp.z > 0.0) {
        vec2 q = (buv - dp.xy) * vec2(ASPECT, 1.0);
        float r = dp.w * (1.0 - exp(-dp.z * 2.6)) * uDropShrink;
        float dist = length(q) * (0.78 + 0.5 * bn1) + (bn2 - 0.5) * 0.012;
        float ins = r - dist;
        float body = smoothstep(-0.0015, 0.003, ins);
        float pool = body * exp(-max(ins, 0.0) / 0.009);
        float dens = (0.4 + 0.5 * bn2) * mix(1.25, 0.8, tooth) + pool * 1.1;
        A += ab(uDropCol[i]) * dens * body * uDropAmt;
      }
    }

    // ---------------------------------------------------------------- region pigment (mid plane)
    vec2 tx = vec2(uSimTexel.x, 0.0), ty = vec2(0.0, uSimTexel.y);
    vec4 f  = texture2D(uState, cuv);
    vec4 gx = texture2D(uState, cuv + tx) - texture2D(uState, cuv - tx);
    vec4 gy = texture2D(uState, cuv + ty) - texture2D(uState, cuv - ty);
    float cssPerTexel = uScene.z * uSimTexel.x / uPx / uZoom;
    vec4 g = sqrt(gx * gx + gy * gy) / (2.0 * cssPerTexel) + 1e-5;

    vec2 warp = (texture2D(uNoise, sp * 0.8 + 0.3).ra - 0.5) * 0.35;
    float edgeN = texture2D(uNoise, sp * 9.0 + warp).b * 0.7 + texture2D(uNoise, sp * 31.0).b * 0.3 - 0.5;
    float fl0 = texture2D(uNoise, sp * 2.2 + warp).r;
    float fl1 = texture2D(uNoise, sp * 1.7 + warp + 0.41).a;
    float bnA = texture2D(uNoise, sp * 2.1 + warp * 0.6 + 0.17).g;
    float vg  = texture2D(uNoise, sp * 1.2 + 0.4).a;

    // the recall front radiates out from the swing
    float order = clamp(0.06 + 0.8 * length((cuv - vec2(0.52, 0.38)) * vec2(ASPECT, 1.0)) / 0.9 + edgeN * 0.15, 0.02, 0.9);
    float contract = smoothstep(order - 0.35, order, uRecall) * 0.7;
    float vanish = 1.0 - smoothstep(order - 0.12, order + 0.02, uRecall);

    vec3 d;
    d.x = pigment(f.r, g.r, 0.26 + edgeN * 0.10 + contract, 0.8, 2.4, 1.1, fl0, bnA, tooth);
    d.y = pigment(f.g, g.g, 0.28 + edgeN * 0.10 + contract, 0.8, 2.2, 1.05, fl1, bnA, tooth) * mix(1.25, 0.8, tooth);
    d.z = pigment(f.b, g.b, 0.24 + edgeN * 0.08 + contract, 1.8, 3.2, 1.0, fl0, bnA, tooth);
    if (uSplat.x > 0.0) d.x += splat(sp, vec2(0.47, 0.72), uSplat.x, 90.0, 1.0) + splat(sp, vec2(0.47, 0.72), uSplat.x, 34.0, 5.0);
    if (uSplat.y > 0.0) d.y += splat(sp, vec2(0.52, 0.52), uSplat.y, 90.0, 9.0) + splat(sp, vec2(0.52, 0.52), uSplat.y, 34.0, 13.0);
    if (uSplat.z > 0.0) d.z += splat(sp, vec2(0.52, 0.34), uSplat.z, 90.0, 17.0) + splat(sp, vec2(0.52, 0.34), uSplat.z, 34.0, 21.0);
    d *= uAmount * (1.0 + 0.2 * uWet) * border * vanish;
    d.x *= 1.0 - 0.6 * clamp(d.y + d.z, 0.0, 1.0);                 // ropes and seat lift the branch colour
    float held = smoothstep(0.0, 0.7, d.x + d.y + d.z);
    A *= 1.0 - 0.7 * held;                                         // and the drawing resists the sky wash

    A += mix(ab(GOLD), ab(ORANGE), smoothstep(0.3, 0.7, vg)) * d.x
       + mix(ab(ULTRA), ab(TURQ), smoothstep(0.35, 0.7, vg)) * d.y
       + mix(ab(MAGENTA), ab(CRIMSON), smoothstep(0.3, 0.7, vg)) * d.z;
    vec3 col = paper * exp(-A);

    // wet sheen: light catching the meniscus of fresh pigment
    vec2 grad = vec2(dot(gx.rgb, uWet * uAmount), dot(gy.rgb, uWet * uAmount));
    vec3 nrm = normalize(vec3(-grad * 22.0, 1.0));
    float spec = pow(max(dot(nrm, normalize(vec3(0.55, 0.6, 0.75))), 0.0), 28.0);
    col += vec3(1.0, 0.96, 0.88) * spec * 0.45 * clamp(d.x + d.y + d.z, 0.0, 1.0);

    // ---------------------------------------------------------------- graphite
    vec2 wuv = cuv;
    float mT = texture2D(uMask, cuv).r;
    vec2  mS = texture2D(uMask, wuv).gb;
    float gh = max(max(mT * uGhost.x, mS.x * uGhost.y), max(mS.y * uGhost.z, uGhost.w));
    float reveal = smoothstep(order - 0.06, order, uRecall);
    gh *= 1.0 - reveal;
    float bias = gh * 1.8;
    float grain = mix(0.62, 1.0, smoothstep(0.2, 0.75, tooth));
    // motion echoes: pencil at first, then trails of pigment as the memory turns to colour
    for (int k = 1; k < 6; k++) {
      float e = texture2D(uLines, cuv, 0.4 + float(k) * 0.4).g * uPose[k].w * grain * inside;
      vec3 trail = mix(GRAPHITE, mix(MAGENTA, ULTRA, float(k) / 5.0), uPaint);
      col = mix(col, trail, clamp(e * mix(1.0, 0.5, gh) * (1.0 + uPaint), 0.0, 1.0) * 0.55);
    }
    float line = max(texture2D(uLines, cuv, bias).r, texture2D(uLines, wuv, bias).g) * grain * inside;
    // on the dark sky the pencil turns to light, so the scene keeps its shape
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 ink = mix(GRAPHITE, vec3(1.0, 0.95, 0.84), (1.0 - smoothstep(0.32, 0.6, lum)) * uInvert);
    col = mix(col, ink, clamp(line * mix(1.0, 0.3, gh) * (1.0 + 0.25 * uPulse) * mix(1.0, 1.6, uInvert), 0.0, 1.0) * 0.9);
    // the pencil re-draws with a gold glint
    float band = smoothstep(0.0, 0.025, uRecall - order) * (1.0 - smoothstep(0.025, 0.11, uRecall - order)) * step(uRecall, 0.999);
    col = mix(col, vec3(1.0, 0.74, 0.28), clamp(line * band * 1.4, 0.0, 1.0) * 0.85);
    col += vec3(0.10, 0.06, 0.0) * band * border;

    // ---------------------------------------------------------------- light
    vec2 dL = (s0 - vec2(1.02, 1.08)) * vec2(uScene.z / uScene.w, 1.0);
    float ang = atan(dL.y, dL.x) / 6.2831853;
    float r1 = texture2D(uNoise, vec2(ang * 13.0 + 0.05 * sin(6.2831853 * uT / 12.0), 0.37)).b;
    float r2 = texture2D(uNoise, vec2(ang * 29.0 - 0.04 * sin(6.2831853 * uT / 6.0), 0.71)).g;
    float ray = pow(smoothstep(0.42, 0.95, r1 * 0.6 + r2 * 0.4), 1.4);
    float light = ray * exp(-length(dL) * 1.25) * uRays + exp(-length(dL) * 1.8) * uGlow * 0.45;
    col = 1.0 - (1.0 - col) * (1.0 - vec3(1.0, 0.82, 0.52) * light * 0.6);
    col *= mix(vec3(1.0), vec3(1.03, 0.95, 0.84), uGlow * 0.55);

    col += vec3(1.0, 0.95, 0.85) * sheen * 10.0;                      // light on the ripple crest
    float fl = uFlash * exp(-length((s0 - vec2(0.53, 0.47)) * vec2(ASPECT, 1.0)) * 1.6);
    col = mix(col, vec3(1.0, 0.97, 0.9), clamp(fl, 0.0, 1.0) * 0.7);
    float lumB = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(lumB) * 0.9, 0.4 * uBreath);                  // the held breath drains the world

    // ---------------------------------------------------------------- vignette + dither
    vec2 q = frag / uRes - 0.5; q.x *= uRes.x / uRes.y;
    float v = smoothstep(0.35, 1.15, length(q));
    col *= 1.0 - v * (0.16 + 0.2 * uClimax + 0.25 * uBreath);
    col = mix(col, col * mix(vec3(1.0, 0.97, 0.92), vec3(0.78, 0.68, 0.92), uClimax), v * 0.7);
    col += (fract(sin(dot(frag, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;


export{THREE,makeNoise,VERT,SIM_FRAG,COMP_FRAG};