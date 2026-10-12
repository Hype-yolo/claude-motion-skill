// 正交相机后期：场景(MSAA+深度) → GTAO → 远处按深度融进渐变天空(+星星) → 移轴模糊 → 辉光 → 粉彩调色/暗角 → 色调映射
// 改自 core/three/post.js（core 的景深用 perspectiveDepthToViewZ，正交相机下不成立）
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

const compShader = {
  uniforms: {
    tColor: { value: null }, tDepth: { value: null }, tAO: { value: null }, aoAmt: { value: .8 },
    near: { value: .1 }, far: { value: 500 }, camDist: { value: 100 },
    hz0: { value: 10 }, hz1: { value: 30 },
    zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() },
    stars: { value: 0 }, starOff: { value: 0 }, time: { value: 0 }, res: { value: new THREE.Vector2(1920, 1080) },
  },
  vertexShader: VS,
  fragmentShader: `
    #include <packing>
    varying vec2 vUv; uniform sampler2D tColor, tDepth, tAO; uniform float aoAmt, near, far, camDist, hz0, hz1, stars, starOff, time;
    uniform vec3 zen, hor; uniform vec2 res;
    float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){
      float d = texture2D(tDepth, vUv).x;
      float vz = -orthographicDepthToViewZ(d, near, far);
      vec3 col = texture2D(tColor, vUv).rgb;
      float ao = pow(texture2D(tAO, vUv).r, 1.5);
      col *= mix(1., ao, aoAmt);
      // 天空：屏幕纵向渐变（地平线色 → 天顶色）
      float gy = smoothstep(.55, 1.3, vUv.y);
      vec3 sky = mix(hor, zen, gy);
      float hz = d >= .99999 ? 1. : smoothstep(hz0, hz1, vz - camDist);
      // 星星：只在"天"的部分（雾浓处）出现
      if (stars > 0.) {
        vec2 sp = vec2(vUv.x * res.x / res.y + starOff, vUv.y) * 150.;
        vec2 cell = floor(sp), f = fract(sp) - .5;
        float r = h21(cell);
        if (r > .935) {
          vec2 o = vec2(h21(cell + 7.1), h21(cell + 3.3)) - .5;
          float dd = length(f - o * .6);
          float tw = .55 + .45 * sin(time * (1.5 + r * 3.) + r * 40.);
          float br = smoothstep(.16, 0., dd) * tw * (r > .99 ? 1.6 : .8);
          sky += vec3(.95, .92, .85) * br * stars * smoothstep(.35, .95, hz) * smoothstep(.4, .75, vUv.y);
        }
      }
      col = mix(col, sky, hz);
      gl_FragColor = vec4(col, 1.);
    }`
};

class ScenePass extends Pass {
  constructor(scene, camera, w, h, o) {
    super(); this.scene = scene; this.camera = camera; this.needsSwap = true;
    this.rt = new THREE.WebGLRenderTarget(w, h, { samples: 4, type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(w, h, THREE.FloatType) });
    this.comp = new FullScreenQuad(new THREE.ShaderMaterial(compShader));
    this.u = this.comp.material.uniforms; this.u.res.value.set(w, h);
    this.ao = new GTAOPass(scene, camera, w, h);
    this.ao.output = GTAOPass.OUTPUT.Off;
    this.ao.updateGtaoMaterial({ radius: o.aoRadius ?? .6, distanceExponent: 1.4, thickness: o.aoThickness ?? .8, scale: o.aoScale ?? 1.6, distanceFallOff: .7, samples: 16 });
    this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 8, rings: 2, samples: 16 });
  }
  render(renderer, writeBuffer) {
    renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(this.scene, this.camera);
    const hid = []; this.scene.traverse(o => { if (o.visible && (o.isSprite || o.isPoints || (o.material && o.material.transparent))) { o.visible = false; hid.push(o); } });
    this.ao.render(renderer, null, null);
    hid.forEach(o => { o.visible = true; });
    const u = this.u; u.tColor.value = this.rt.texture; u.tDepth.value = this.rt.depthTexture; u.tAO.value = this.ao.gtaoMap;
    u.near.value = this.camera.near; u.far.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.comp.render(renderer);
  }
}

// 移轴：画面上下两端轻微模糊（微缩模型感）
const tiltShader = {
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1920, 1080) }, fy: { value: .5 }, band: { value: .28 }, maxR: { value: 5 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 res; uniform float fy, band, maxR;
    void main(){
      float r = maxR * smoothstep(band, band + .35, abs(vUv.y - fy));
      vec4 c = texture2D(tDiffuse, vUv);
      if (r < .3) { gl_FragColor = c; return; }
      vec3 acc = c.rgb; float ws = 1.;
      for (int i = 0; i < 24; i++) {
        float rr = r * sqrt((float(i) + .5) / 24.), th = float(i) * 2.39996;
        acc += texture2D(tDiffuse, vUv + vec2(cos(th), sin(th)) * rr / res).rgb; ws += 1.;
      }
      gl_FragColor = vec4(acc / ws, 1.);
    }`
};

const gradeShader = {
  uniforms: { tDiffuse: { value: null }, vig: { value: .22 }, fade: { value: 1 }, sat: { value: 1 }, contrast: { value: 0 }, lift: { value: new THREE.Color(0, 0, 0) }, tint: { value: new THREE.Color(1, 1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float vig, fade, sat, contrast; uniform vec3 lift, tint;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - .5; d.x *= 1.3;
      c.rgb *= tint;
      float l = dot(c.rgb, vec3(.2126, .7152, .0722)); c.rgb = mix(vec3(l), c.rgb, sat);
      c.rgb = c.rgb * (1. + contrast) / (1. + contrast * c.rgb / (c.rgb + .6));
      c.rgb = lift + c.rgb * (1. - lift);
      c.rgb *= (1. - vig * smoothstep(.3, .9, length(d))) * fade;
      gl_FragColor = c; }`
};

export function makePost(renderer, scene, camera, w, h, o = {}) {
  const s = o.ssaa || 1, W = w * s, H = h * s;
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
  const sp = new ScenePass(scene, camera, W, H, o);
  const tilt = new ShaderPass(tiltShader); tilt.uniforms.res.value.set(W, H); tilt.uniforms.maxR.value = 3 * s;
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), .35, .6, .9);
  const grade = new ShaderPass(gradeShader);
  composer.addPass(sp); composer.addPass(tilt); composer.addPass(bloom); composer.addPass(grade); composer.addPass(new OutputPass());
  return { composer, sp, comp: sp.u, tilt: tilt.uniforms, bloom, grade: grade.uniforms, ssaa: s };
}
