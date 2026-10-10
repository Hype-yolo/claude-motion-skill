// 移轴后期（由 core/three/post.js 复制改写）
// 场景以 ssaa 倍分辨率渲染（MSAA + 深度）→ [GTAO] → CoC 计算并 2×2 降采样到输出分辨率
// → 移轴景深 gather（物理 CoC 与屏幕空间"上下虚化带"混合，逐像素旋转采样盘）→ 辉光 → 调色（高饱和/对比/暗角）→ 色调映射
// 相比 core 的改动：① DOF 在 1× 分辨率做（半径大、采样多、快）；② 加入 band 虚化带；③ 调色加 lift/tint；④ 逐像素随机旋转去除螺旋纹
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

const cocShader = {
  uniforms: {
    tColor: { value: null }, tDepth: { value: null }, tAO: { value: null }, aoAmt: { value: 0 },
    focus: { value: 100 }, aper: { value: 4 }, maxCoc: { value: 24 }, near: { value: .1 }, far: { value: 5000 },
    srcRes: { value: new THREE.Vector2(3840, 2160) },
    bandY: { value: .5 }, bandW: { value: .08 }, bandAmp: { value: 30 }, bandMix: { value: .5 }, bandTilt: { value: 0 }, bandPow: { value: 1.3 },
  },
  vertexShader: VS,
  fragmentShader: `
    #include <packing>
    varying vec2 vUv; uniform sampler2D tColor, tDepth, tAO; uniform vec2 srcRes;
    uniform float aoAmt, focus, aper, maxCoc, near, far, bandY, bandW, bandAmp, bandMix, bandTilt, bandPow;
    float cocAt(vec2 uv){
      float d = texture2D(tDepth, uv).x;
      float z = -perspectiveDepthToViewZ(d, near, far);
      return aper * (1.0/focus - 1.0/z);
    }
    void main(){
      vec2 h = .5 / srcRes;
      float cp = .25 * (cocAt(vUv + vec2(-h.x,-h.y)) + cocAt(vUv + vec2(h.x,-h.y)) + cocAt(vUv + vec2(-h.x,h.y)) + cocAt(vUv + vec2(h.x,h.y)));
      // 屏幕空间虚化带：清晰带中心 bandY（可倾斜），带外按距离增长；上方算远景（正），下方算近景（负）
      float y = vUv.y + bandTilt * (vUv.x - .5);
      float dy = y - bandY;
      float cb = sign(dy) * bandAmp * pow(max(0., abs(dy) - bandW) / .5, bandPow);
      float c = clamp(mix(cp, cb, bandMix), -maxCoc, maxCoc);
      vec3 col = texture2D(tColor, vUv).rgb;   // 线性过滤 = 2×2 盒式降采样
      if (aoAmt > 0.) col *= mix(1., pow(texture2D(tAO, vUv).r, 1.5), aoAmt);
      gl_FragColor = vec4(col, c);
    }`
};

const gatherShader = {
  uniforms: { tIn: { value: null }, res: { value: new THREE.Vector2(1920, 1080) }, maxCoc: { value: 24 } },
  vertexShader: VS,
  fragmentShader: `
    varying vec2 vUv; uniform sampler2D tIn; uniform vec2 res; uniform float maxCoc;
    float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec4 c0 = texture2D(tIn, vUv); float a0 = abs(c0.a);
      if (maxCoc < .5) { gl_FragColor = vec4(c0.rgb, 1.); return; }
      // 本像素周围最大模糊（近景要能糊到清晰物体上）
      vec3 acc = c0.rgb / (a0*a0 + 1.); float wsum = 1. / (a0*a0 + 1.);
      float rot = h12(gl_FragCoord.xy) * 6.2832;
      const int N = 128;
      for (int i = 0; i < N; i++) {
        float r = maxCoc * sqrt((float(i) + .5) / float(N));
        float th = float(i) * 2.39996 + rot;
        vec2 off = vec2(cos(th), sin(th)) * r / res;
        vec4 s = texture2D(tIn, vUv + off);
        float sa = abs(s.a);
        if (s.a > c0.a) sa = min(sa, max(a0, 0.));   // 更远的样本不能糊到更近的清晰物体上
        float w = smoothstep(r - 1.5, r + .5, sa) / (sa*sa + 1.);
        acc += s.rgb * w; wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, 1.);
    }`
};

class TiltPass extends Pass {
  constructor(scene, camera, w, h, o = {}) {
    super(); this.scene = scene; this.camera = camera; this.needsSwap = true;
    const s = this.s = o.ssaa || 2, W = w * s, H = h * s;
    this.rt = new THREE.WebGLRenderTarget(W, H, { samples: o.msaa ?? 4, type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(W, H, THREE.FloatType) });
    this.rt.texture.minFilter = this.rt.texture.magFilter = THREE.LinearFilter;
    this.rtC = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    this.coc = new FullScreenQuad(new THREE.ShaderMaterial(cocShader));
    this.coc.material.uniforms.srcRes.value.set(W, H);
    this.gat = new FullScreenQuad(new THREE.ShaderMaterial(gatherShader));
    this.gat.material.uniforms.res.value.set(w, h);
    this.focus = 100; this.aper = 4; this.maxCoc = 24; this.aoAmt = 0;
    this.band = { y: .5, w: .08, amp: 30, mix: .5, tilt: 0, pow: 1.3 };
    if (o.ao) {
      this.ao = new GTAOPass(scene, camera, W, H);
      this.ao.output = GTAOPass.OUTPUT.Off;
      this.ao.updateGtaoMaterial({ radius: o.aoRadius ?? 2, distanceExponent: 1.2, thickness: o.aoThickness ?? 2, scale: o.aoScale ?? 1.6, distanceFallOff: .6, samples: 16 });
      this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4 * s, rings: 2, samples: 16 });
      this.aoAmt = o.aoAmt ?? .8;
    }
  }
  render(renderer, writeBuffer) {
    renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(this.scene, this.camera);
    if (this.ao && this.aoAmt > 0) this.ao.render(renderer, null, null);
    const u = this.coc.material.uniforms, b = this.band;
    u.tColor.value = this.rt.texture; u.tDepth.value = this.rt.depthTexture; u.focus.value = this.focus; u.aper.value = this.aper; u.maxCoc.value = this.maxCoc;
    u.near.value = this.camera.near; u.far.value = this.camera.far;
    u.bandY.value = b.y; u.bandW.value = b.w; u.bandAmp.value = b.amp; u.bandMix.value = b.mix; u.bandTilt.value = b.tilt; u.bandPow.value = b.pow;
    u.tAO.value = this.ao ? this.ao.gtaoMap : null; u.aoAmt.value = this.ao ? this.aoAmt : 0;
    renderer.setRenderTarget(this.rtC); this.coc.render(renderer);
    const g = this.gat.material.uniforms; g.tIn.value = this.rtC.texture; g.maxCoc.value = this.maxCoc;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.gat.render(renderer);
  }
}

const gradeShader = {
  uniforms: { tDiffuse: { value: null }, amt: { value: .3 }, fade: { value: 1 }, warm: { value: 0 }, contrast: { value: .3 }, sat: { value: 1.35 }, lift: { value: 0 }, tint: { value: new THREE.Vector3(1, 1, 1) }, expo: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float amt, fade, warm, contrast, sat, lift, expo; uniform vec3 tint;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); c.rgb = max(c.rgb, 0.) * expo;
      vec2 d = vUv - .5; d.x *= 1.3; float v = 1. - amt * smoothstep(.2, .9, length(d));
      c.rgb *= v * fade; c.rgb *= mix(vec3(1.), vec3(1.07, 1., .88), warm) * tint;
      float l = dot(c.rgb, vec3(.2126, .7152, .0722)); c.rgb = max(mix(vec3(l), c.rgb, sat), 0.);
      c.rgb = c.rgb * (1. + contrast) / (1. + contrast * c.rgb / (c.rgb + .5));
      c.rgb += lift * (1. - c.rgb) * .06;
      gl_FragColor = c; }`
};

export function makePost(renderer, scene, camera, w, h, o = {}) {
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType }));
  const dof = new TiltPass(scene, camera, w, h, o);
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), .25, .6, 1.2);
  const grade = new ShaderPass(gradeShader);
  const out = new OutputPass();
  composer.addPass(dof); composer.addPass(bloom); composer.addPass(grade); composer.addPass(out);
  return { composer, dof, bloom, grade };
}
