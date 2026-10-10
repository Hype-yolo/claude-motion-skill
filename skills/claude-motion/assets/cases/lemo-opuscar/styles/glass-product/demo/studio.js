// 影棚：暗场玻璃摄影布光（黑底 + 条形柔光箱），环境贴图每帧由"灯条场景"重新生成（光扫 = 真的有一根灯条划过）
// 地面：黑色亮面 + 模糊镜面反射 + 程序焦散（玻璃把光聚在地上；随低音脉动、随声波外扩）
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export function makeStudio(renderer, scene) {
  // —— 灯条场景（只用来烘环境贴图）——
  const env = new THREE.Scene(); env.background = new THREE.Color('#000000');
  const strip = (w, h, I, col = '#ffffff') => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(I), side: THREE.DoubleSide }));
    env.add(m); return m;
  };
  const face = (m, p) => { m.position.set(...p); m.lookAt(0, 0, 0); };
  const L = {
    left: strip(22, 170, 3.2, '#f4f8ff'),        // 左后竖灯条：勾左轮廓
    right: strip(22, 170, 3.2, '#fffaf2'),       // 右后竖灯条
    top: strip(160, 70, 1.1, '#ffffff'),         // 顶部大柔光：给磨砂与金属一点体积
    front: strip(160, 50, .18, '#ffffff'),        // 前方低位补光（很弱）
    back: strip(260, 14, 1.4, '#e8f0ff'),        // 背后横灯条：地平线的轮廓光
    sweep: strip(26, 240, 0, '#ffffff'),         // 光扫：一根移动的竖灯条
    aura: strip(140, 140, 0, '#62dcff'),         // 光纹亮起时的彩色反光卡
    key: strip(150, 60, 2.5, '#ffffff'),         // 顶前方主柔光箱：给金属与 PCB 主光（默认关）
  };
  face(L.left, [-150, 40, -60]); face(L.right, [150, 40, -70]); face(L.top, [0, 170, 10]);
  face(L.front, [0, 10, 170]); face(L.back, [0, 20, -190]); face(L.aura, [0, -60, 120]); face(L.key, [0, 150, 120]);
  const base = { left: 3.2, right: 3.2, top: 1.1, front: .18, back: 1.4, key: 2.5 };
  const cols = {}; for (const k in L) cols[k] = L[k].material.color.clone().multiplyScalar(1 / Math.max(.001, base[k] ?? 1));

  // 背景：深灰径向渐变（影棚 sweep），强度按镜头调；让玻璃边缘从纯黑里分离出来
  const bgc = document.createElement('canvas'); bgc.width = 512; bgc.height = 288;
  { const g = bgc.getContext('2d'), gr = g.createRadialGradient(256, 120, 10, 256, 140, 300); gr.addColorStop(0, '#34383d'); gr.addColorStop(.45, '#16181b'); gr.addColorStop(1, '#000000'); g.fillStyle = gr; g.fillRect(0, 0, 512, 288); }
  const bgTex = new THREE.CanvasTexture(bgc); bgTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTex; scene.backgroundIntensity = 0;
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  // o: {k: {left,right,top,front,back}, sweep:{x (−1..1), I, ang}, aura:{I, col}}
  function updateEnv(o = {}) {
    for (const k in base) { const I = (o[k] ?? 1) * base[k]; L[k].material.color.copy(cols[k]).multiplyScalar(I); }
    const sw = o.sweep || { I: 0 };
    L.sweep.visible = sw.I > 0;
    if (sw.I > 0) {   // 灯条在镜头前方的弧上从左划到右（相机空间 → 世界空间由调用方给出方位角）
      const a = sw.az + sw.x * 1.35, r = 170;
      L.sweep.position.set(Math.sin(a) * r, 30 + (sw.y || 0), Math.cos(a) * r); L.sweep.lookAt(0, 0, 0); L.sweep.rotateZ(sw.tilt || 0);
      L.sweep.material.color.setRGB(sw.I, sw.I, sw.I);
    }
    const au = o.aura || { I: 0 };
    L.aura.visible = au.I > 0; if (au.I > 0) L.aura.material.color.copy(au.col).multiplyScalar(au.I);
    const rt = pmrem.fromScene(env, 0, 1, 1000);
    scene.environment = rt.texture;
    if (envRT) envRT.dispose(); envRT = rt;
  }

  // —— 地面 ——
  const FLOOR = { y: -15 };
  const floorShader = {
    name: 'GlassFloor',
    uniforms: {
      color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
      uRefl: { value: .32 }, uFade: { value: 260 }, uTime: { value: 0 },
      uC: { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)] },     // 焦散源：xz 位置、半径、强度
      uWave: { value: Array.from({ length: 12 }, () => new THREE.Vector4(0, 0, 0, 0)) },   // 声波环：xz、半径、强度
      uA: { value: new THREE.Color('#62dcff') }, uB: { value: new THREE.Color('#a98bff') }, uSpot: { value: .06 },
      uCenter: { value: new THREE.Vector2(0, 0) }, uBg: { value: null }, uBgI: { value: 0 }, uRes: { value: new THREE.Vector2(3840, 2160) },
    },
    vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
      void main(){ vUv = textureMatrix * vec4(position, 1.); vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uRefl, uFade, uTime, uSpot; uniform vec4 uC[3]; uniform vec4 uWave[12]; uniform vec3 uA, uB; uniform vec2 uCenter; uniform sampler2D uBg; uniform float uBgI; uniform vec2 uRes;
      varying vec4 vUv; varying vec3 vW;
      vec2 h2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
      // 自写焦散：Voronoi 边缘（F2−F1）+ 时间扭曲 → 亮丝网
      float vor(vec2 p, float t){ vec2 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = h2(i + g); o = .5 + .45 * sin(t + 6.2831 * o);
          float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
        return d2 - d1; }
      float caus(vec2 p, float t){ vec2 q = p + .55 * vec2(sin(p.y * 1.3 + t), cos(p.x * 1.1 - t * .8)); q += .25 * vec2(sin(q.y * 3.1 - t * 1.3), cos(q.x * 2.7 + t)); float e = vor(q * 1.4, t); return exp(-e * 14.) * (.6 + .4 * sin(q.x * 2. + q.y)); }
      void main(){
        vec2 xz = vW.xz; float r0 = length(xz - uCenter);
        // 模糊反射
        vec3 refl = vec3(0.); float sum = 0.;
        for (int i = 0; i < 12; i++) { float a = float(i) * 2.39996; float rr = sqrt((float(i) + .5) / 12.) * 5.;
          vec4 uv = vUv + vec4(cos(a) * rr, sin(a) * rr, 0., 0.) * vUv.w / 700.; refl += texture2DProj(tDiffuse, uv).rgb; sum += 1.; }
        refl /= sum;
        float fade = exp(-r0 * r0 / (uFade * uFade));
        vec3 col = refl * uRefl * fade;
        col += vec3(.02, .02, .021) * exp(-r0 * r0 / 9000.) * (1. + uSpot * 10.);   // 台面下一点点光池
        // 焦散
        for (int k = 0; k < 3; k++) { vec4 C = uC[k]; if (C.w <= 0.) continue;
          vec2 d = (xz - C.xy); float r = length(d) / C.z; float m = exp(-r * r * 1.6);
          float ring = exp(-pow((r - .72) / .07, 2.));   // 透镜环形焦散
          vec2 p = d / C.z * 3.2;
          vec3 c3 = vec3(caus(p * .985, uTime), caus(p, uTime), caus(p * 1.015, uTime));   // 色散：三通道不同尺度
          vec3 rr3 = vec3(exp(-pow((r - .70) / .06, 2.)), exp(-pow((r - .72) / .06, 2.)), exp(-pow((r - .74) / .06, 2.)));
          col += (c3 * m * .55 + rr3 * 1.2) * C.w * mix(vec3(1.), uA * 1.3, .3);
        }
        // 声波环：地面上外扩的彩色光环
        for (int k = 0; k < 12; k++) { vec4 Wv = uWave[k]; if (Wv.w <= 0.) continue;
          float r = length(xz - Wv.xy); float x = (r - Wv.z) / (.8 + Wv.z * .025);
          vec3 band = vec3(exp(-pow(x + .35, 2.) * 3.), exp(-x * x * 3.), exp(-pow(x - .35, 2.) * 3.));
          col += band * mix(uA, uB, clamp(Wv.z / 90., 0., 1.)) * Wv.w * exp(-r * r / 7000.);
        }
        // 远处地面融进背景渐变（无缝影棚 sweep）
        vec3 bgc = texture2D(uBg, gl_FragCoord.xy / uRes).rgb * uBgI;
        col = mix(bgc, col, exp(-r0 * r0 / (uFade * uFade * 2.2)));
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  };
  const floor = new Reflector(new THREE.PlaneGeometry(2000, 2000), { shader: floorShader, textureWidth: 1920, textureHeight: 1080, clipBias: .002, multisample: 4 });
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR.y; scene.add(floor);
  // 镜面反射只在每帧手动更新一次（否则透射预渲染里会再渲一遍）
  const reflUpdate = floor.onBeforeRender.bind(floor); floor.onBeforeRender = () => { };
  const U = floor.material.uniforms; U.uBg.value = bgTex;
  return { env, L, updateEnv, floor, FLOOR, U, reflect(camera, hide = []) { const v = hide.map(o => o.visible); hide.forEach(o => o.visible = false); reflUpdate(renderer, scene, camera); hide.forEach((o, i) => o.visible = v[i]); } };
}
