// 后期：场景 → (MSAA+深度) → 物理景深（CoC∝|1/f−1/z|，64 点螺旋采样）→ 辉光 → 色调映射 + 暗角
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const cocShader = {
  uniforms: { tColor: { value: null }, tDepth: { value: null }, focus: { value: .3 }, aper: { value: 4 }, maxCoc: { value: 18 }, near: { value: .01 }, far: { value: 50 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: `
    #include <packing>
    varying vec2 vUv; uniform sampler2D tColor, tDepth; uniform float focus, aper, maxCoc, near, far;
    void main(){
      float d = texture2D(tDepth, vUv).x;
      float z = -perspectiveDepthToViewZ(d, near, far);
      float c = clamp(aper * (1.0/focus - 1.0/z), -maxCoc, maxCoc);   // 负=近景，正=远景（像素）
      gl_FragColor = vec4(texture2D(tColor, vUv).rgb, c);
    }`
};
const gatherShader = {
  uniforms: { tIn: { value: null }, res: { value: new THREE.Vector2(1920, 1080) }, maxCoc: { value: 18 } },
  vertexShader: cocShader.vertexShader,
  fragmentShader: `
    varying vec2 vUv; uniform sampler2D tIn; uniform vec2 res; uniform float maxCoc;
    void main(){
      vec4 c0 = texture2D(tIn, vUv); float a0 = abs(c0.a);
      if (maxCoc < .5) { gl_FragColor = vec4(c0.rgb, 1.); return; }
      vec3 acc = c0.rgb / (a0*a0 + 1.); float wsum = 1. / (a0*a0 + 1.);
      const int N = 64;
      for (int i = 0; i < N; i++) {
        float r = maxCoc * sqrt((float(i) + .5) / float(N));
        float th = float(i) * 2.39996;
        vec2 off = vec2(cos(th), sin(th)) * r / res;
        vec4 s = texture2D(tIn, vUv + off);
        float sa = abs(s.a);
        // 比中心更远的样本，扩散半径不超过中心自己的（防止背景糊到清晰前景上）
        if (s.a > c0.a) sa = min(sa, max(a0, 0.));
        float w = smoothstep(r - 1.5, r + .5, sa) / (sa*sa + 1.);
        acc += s.rgb * w; wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, 1.);
    }`
};

class DofScenePass extends Pass {
  constructor(scene, camera, w, h) {
    super(); this.scene = scene; this.camera = camera; this.needsSwap = true;
    this.rt = new THREE.WebGLRenderTarget(w, h, { samples: 4, type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(w, h, THREE.FloatType) });
    this.rtC = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    this.coc = new FullScreenQuad(new THREE.ShaderMaterial(cocShader));
    this.gat = new FullScreenQuad(new THREE.ShaderMaterial(gatherShader));
    this.focus = .3; this.aper = 4; this.maxCoc = 16;
  }
  render(renderer, writeBuffer) {
    renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(this.scene, this.camera);
    const u = this.coc.material.uniforms;
    u.tColor.value = this.rt.texture; u.tDepth.value = this.rt.depthTexture; u.focus.value = this.focus; u.aper.value = this.aper; u.maxCoc.value = this.maxCoc;
    u.near.value = this.camera.near; u.far.value = this.camera.far;
    renderer.setRenderTarget(this.rtC); this.coc.render(renderer);
    const g = this.gat.material.uniforms; g.tIn.value = this.rtC.texture; g.maxCoc.value = this.maxCoc;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.gat.render(renderer);
  }
}

const vignetteShader = {
  uniforms: { tDiffuse: { value: null }, amt: { value: .35 }, fade: { value: 1 }, warm: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float amt, fade, warm;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - .5; d.x *= 1.25; float v = 1. - amt * smoothstep(.25, .85, length(d));
      c.rgb *= v * fade; c.rgb *= mix(vec3(1.), vec3(1.06, 1., .9), warm); gl_FragColor = c; }`
};

export function makePost(renderer, scene, camera, w, h) {
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType }));
  const dof = new DofScenePass(scene, camera, w, h);
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), .2, .5, 1.6);
  const vig = new ShaderPass(vignetteShader);
  const out = new OutputPass();
  composer.addPass(dof); composer.addPass(bloom); composer.addPass(vig); composer.addPass(out);
  return { composer, dof, bloom, vig };
}
