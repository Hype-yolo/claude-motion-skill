// Scene pass → bloom → grade (linear) → ACES → chromatic fringe, vignette → FXAA → grain.
// The scene pass resolution is the governor's knob; bloom and FXAA follow it.
import * as THREE from 'three/webgpu';
import {
  pass, renderOutput, uniform, vec2, vec3, vec4, float, screenUV, mix, smoothstep, length, luminance, dot, max, clamp,
  Fn, If, Loop, int, time, fract, sin,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { U } from './shared.js';

export function createPost(renderer, scene, camera) {
  const post = new THREE.RenderPipeline(renderer);
  post.outputColorTransform = false;

  const scenePass = pass(scene, camera);
  const sceneColor = scenePass.getTextureNode('output');

  const P = {
    exposure: uniform(1.0),
    bloomStrength: uniform(0.42),
    bloomRadius: uniform(0.32),
    bloomThreshold: uniform(1.0),
    saturation: uniform(1.08),
    contrast: uniform(1.06),
    shadowTint: uniform(new THREE.Color(0.86, 0.92, 1.12)),
    highTint: uniform(new THREE.Color(1.06, 0.97, 1.02)),
    vignette: uniform(0.42),
    chroma: uniform(0.0016),
    grain: uniform(0.035),
    speedBlur: uniform(0), // 0..1 while boosting
    whiteout: uniform(0), // inside a cloud
    whiteoutColor: uniform(new THREE.Color(0.32, 0.34, 0.42)),
    fade: uniform(1), // 0 black, 1 picture
  };

  const bloomPass = bloom(sceneColor, P.bloomStrength, P.bloomRadius, P.bloomThreshold);

  const composite = Fn(() => {
    const uv = screenUV;
    const toC = uv.sub(0.5);
    const r2 = dot(toC, toC);
    // lens fringe grows toward the corners
    const ca = toC.mul(P.chroma.mul(r2.mul(4).add(0.2)));
    const c = vec3(
      sceneColor.sample(uv.add(ca)).r,
      sceneColor.sample(uv).g,
      sceneColor.sample(uv.sub(ca)).b,
    ).toVar();
    // boost: a few radial taps toward the centre
    If(P.speedBlur.greaterThan(0.01), () => {
      const acc = c.toVar();
      Loop({ start: int(1), end: int(6) }, ({ i }) => {
        const k = float(i).mul(0.012).mul(P.speedBlur).mul(r2.mul(3).add(0.1));
        acc.addAssign(sceneColor.sample(uv.sub(toC.mul(k))).rgb);
      });
      c.assign(acc.div(6));
    });
    c.addAssign(bloomPass.rgb);
    c.mulAssign(P.exposure);
    // split tone in linear light: cool shadows, faintly warm-magenta highlights
    const l = luminance(c);
    c.assign(c.mul(mix(vec3(P.shadowTint), vec3(P.highTint), smoothstep(0.02, 0.6, l))));
    const l2 = luminance(c);
    c.assign(mix(vec3(l2), c, P.saturation));
    c.assign(mix(c, vec3(P.whiteoutColor).mul(1.2), P.whiteout));
    c.addAssign(vec3(0.75, 0.82, 1.0).mul(U.flash).mul(0.25));
    return vec4(c, 1);
  })();

  const display = Fn(() => {
    const t = renderOutput(composite, THREE.ACESFilmicToneMapping, THREE.SRGBColorSpace).rgb.toVar();
    t.assign(t.sub(0.5).mul(P.contrast).add(0.5).max(0));
    const toC = screenUV.sub(0.5);
    const vig = smoothstep(0.85, 0.2, length(toC.mul(vec2(1.0, 0.82))).mul(P.vignette.mul(1.6)));
    t.mulAssign(mix(float(1), vig, P.vignette.min(1)));
    return vec4(t.mul(P.fade), 1);
  })();

  const aa = fxaa(display);
  const finalNode = Fn(() => {
    const g = fract(sin(screenUV.x.mul(1371.13).add(screenUV.y.mul(3313.7)).add(time.mul(37.3))).mul(43758.5453)).sub(0.5);
    return vec4(aa.rgb.add(g.mul(P.grain)), 1);
  })();
  post.outputNode = finalNode;

  return {
    post,
    scenePass,
    params: P,
    bloomPass,
    setScale(s) {
      scenePass.setResolutionScale(s);
    },
    render() {
      post.render();
    },
  };
}
