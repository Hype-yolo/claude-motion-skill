// 低多边形海面：三角网格顶点动画（多组正弦），flatShading 让每个三角面各自反光；
// 浅滩颜色由"已长出的地块"实时画出的浅水图驱动（泻湖跟岛一起长）
import * as THREE from 'three';

// CPU 版同一个波函数（浮标、小船跟着起伏）
export function waveH(x, z, t, amp = 1) {
  return amp * (.075 * Math.sin(.9 * x + 1.25 * t) + .06 * Math.sin(.77 * z - 1.05 * t + 1.3)
    + .045 * Math.sin(1.6 * (x + z) + 2.0 * t) + .03 * Math.sin(2.3 * x - 1.9 * z + 2.6 * t));
}
const WAVE_GLSL = `
  float waveH(vec2 p, float t, float amp){
    return amp * (.075 * sin(.9 * p.x + 1.25 * t) + .06 * sin(.77 * p.y - 1.05 * t + 1.3)
      + .045 * sin(1.6 * (p.x + p.y) + 2.0 * t) + .03 * sin(2.3 * p.x - 1.9 * p.y + 2.6 * t));
  }`;

export const SHALLOW_SPAN = 64;   // 浅水图覆盖的世界范围（以原点为中心）

export function makeSea(scene) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const sg = cv.getContext('2d');
  const shallowTex = new THREE.CanvasTexture(cv); shallowTex.colorSpace = THREE.NoColorSpace; shallowTex.flipY = false;
  const U = {
    uTime: { value: 0 }, uAmp: { value: 1 }, uDeep: { value: new THREE.Color('#3aa3b8') }, uShal: { value: new THREE.Color('#86e0d2') },
    uShallow: { value: shallowTex }, uSpan: { value: SHALLOW_SPAN }, uFoam: { value: new THREE.Color('#ffffff') },
    uFwd: { value: new THREE.Vector2(0, -1) }, uTgt: { value: new THREE.Vector2() }, uSpanF: { value: 20 }, uNight: { value: 0 },
    uBeam: { value: new THREE.Vector4(0, 0, .1, 60) }, uBeamCol: { value: new THREE.Color('#ffe9b8') },
  };
  const mkMat = (near) => {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: .55, metalness: 0 });
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\nuniform float uTime, uAmp; varying vec2 vW;${WAVE_GLSL}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 wp0 = modelMatrix * vec4(transformed, 1.);
          vW = wp0.xz;
          transformed.z += waveH(wp0.xz, uTime, uAmp);`);   // 平面先绕 x 转了 -90°，局部 z = 世界 y
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nuniform vec3 uDeep, uShal, uFoam, uBeamCol; uniform sampler2D uShallow; uniform float uSpan, uSpanF, uNight, uTime; uniform vec2 uFwd, uTgt; uniform vec4 uBeam; varying vec2 vW;\nfloat hh(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 suv = vW / uSpan + .5;
          float s = ${near ? 'texture2D(uShallow, suv).r' : '0.'};
          if (suv.x < 0. || suv.y < 0. || suv.x > 1. || suv.y > 1.) s = 0.;
          vec3 wc = mix(uDeep, uShal, smoothstep(.05, .85, s));
          wc = mix(wc, uFoam, smoothstep(.9, .99, s) * .55);
          // 夜：近处更暗、远处向天空带渐亮
          float farK = dot(vW - uTgt, uFwd) / uSpanF;
          wc *= mix(1., mix(.55, 1.12, smoothstep(-.55, .9, farK)), uNight);
          diffuseColor.rgb = wc;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          // 灯塔光束照亮的水面：一条亮带 + 波面高光闪烁
          if (uBeam.y > 0.) {
            vec2 rel = vW; float r = length(rel);
            float da = abs(mod(atan(rel.y, rel.x) - uBeam.x + 3.14159265, 6.2831853) - 3.14159265);
            float hw = uBeam.z * (1. + 1.8 / max(r, .5));
            float band = smoothstep(hw, hw * .25, da) * smoothstep(1.5, 4., r) * pow(clamp(1. - r / uBeam.w, 0., 1.), 1.2);
            vec2 cell = floor(vW * 2.2); float tw = hh(cell + floor(uTime * 7.) * .137);
            float glint = pow(tw, 14.) * 3.5;
            totalEmissiveRadiance += uBeamCol * band * uBeam.y * (.55 + glint);
          }`);
    };
    return m;
  };
  const geo = new THREE.PlaneGeometry(220, 220, 200, 200).toNonIndexed();
  const near = new THREE.Mesh(geo, mkMat(true)); near.rotation.x = -Math.PI / 2; near.receiveShadow = false; scene.add(near);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000, 180, 180), mkMat(false)); far.rotation.x = -Math.PI / 2; far.position.y = -.55; scene.add(far);

  // 浅水图：每帧按地块位置与升起进度画模糊的圆斑
  function drawShallow(blobs) {
    sg.fillStyle = '#000'; sg.fillRect(0, 0, 512, 512);
    const k = 512 / SHALLOW_SPAN;
    for (const [x, z, r, a] of blobs) {
      if (a <= 0) continue;
      const px = (x / SHALLOW_SPAN + .5) * 512, py = (z / SHALLOW_SPAN + .5) * 512, rr = r * k;
      const gr = sg.createRadialGradient(px, py, 0, px, py, rr);
      gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.55, `rgba(255,255,255,${a * .8})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      sg.globalCompositeOperation = 'lighten'; sg.fillStyle = gr; sg.beginPath(); sg.arc(px, py, rr, 0, 7); sg.fill();
    }
    sg.globalCompositeOperation = 'source-over';
    shallowTex.needsUpdate = true;
  }
  return { near, far, U, drawShallow };
}
