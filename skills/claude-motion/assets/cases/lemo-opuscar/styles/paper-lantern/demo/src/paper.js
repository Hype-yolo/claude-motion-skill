// 纸雕层：画布（米制坐标、y 向上）→ 纸纹 + 顶边受光 + 底边暗 → 三维平面（背光透纸 + 自发光窗 + 投影）
import * as THREE from 'three';
import { mulberry, TAU } from './lib.js';

export const PPM = 5200;   // 每米像素数（0.4 m 宽的画面 ≈ 2080 px）

export function cv(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

// —— 纹理：纸纤维（正面肌理）与透光云纹（背光时看到的纸浆絮状）——
function makeGrain(n, seed) {
  const c = cv(n, n), x = c.getContext('2d'), R = mulberry(seed), img = x.createImageData(n, n), d = img.data;
  for (let i = 0; i < n * n; i++) { const v = R(); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v < .5 ? 0 : 255; d[i * 4 + 3] = Math.abs(v - .5) * 30; }
  x.putImageData(img, 0, 0); x.lineCap = 'round';
  for (let i = 0; i < n * 1.4; i++) {
    const px = R() * n, py = R() * n, a = R() * TAU, l = 5 + R() * 22;
    x.strokeStyle = R() < .5 ? 'rgba(40,30,20,.10)' : 'rgba(255,255,255,.16)'; x.lineWidth = .5 + R() * .8;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + .5) * l * .5, py + Math.sin(a + .5) * l * .5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  return c;
}
export const GRAIN = makeGrain(512, 7);

function makeCloud(n, seed) {   // 平铺的多倍频值噪声 + 纤维，灰度
  const R = mulberry(seed), c = cv(n, n), x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, n, n);
  for (const [cnt, rmin, rmax, a] of [[60, 40, 120, .22], [260, 10, 40, .16], [900, 3, 10, .12]]) {
    for (let i = 0; i < cnt; i++) {
      const px = R() * n, py = R() * n, r = rmin + R() * (rmax - rmin), v = R() < .5 ? 0 : 255;
      for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) {
        const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
        g.addColorStop(0, `rgba(${v},${v},${v},${a})`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
        x.fillStyle = g; x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
      }
    }
  }
  x.lineCap = 'round';
  for (let i = 0; i < n * 2; i++) {
    const px = R() * n, py = R() * n, a = R() * TAU, l = 6 + R() * 30;
    x.strokeStyle = `rgba(255,255,255,${.05 + R() * .12})`; x.lineWidth = .6 + R();
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + .6) * l * .5, py + Math.sin(a + .6) * l * .5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  return c;
}
let cloudTex = null;
export function CLOUD() {
  if (!cloudTex) { cloudTex = new THREE.CanvasTexture(makeCloud(512, 3)); cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping; }
  return cloudTex;
}

// —— 画布：米制，原点在中心，y 向上 ——
// draw(x, k)：x 已变换到米制；k = 像素/米（用来换算线宽）
export function paint(w, h, draw, ppm = PPM) {
  const c = cv(w * ppm, h * ppm), x = c.getContext('2d');
  x.setTransform(ppm, 0, 0, -ppm, c.width / 2, c.height / 2);
  draw(x, ppm);
  x.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}
// 在米制画布里写字（局部翻转回正）
export function text(x, s, px, py, size, font, o = {}) {
  x.save(); x.translate(px, py); x.scale(.001, -.001); if (o.rot) x.rotate(o.rot);
  x.font = `${o.weight || ''} ${size * 1000}px ${font}`.trim(); x.textAlign = o.align || 'center'; x.textBaseline = o.base || 'middle';
  x.fillStyle = o.fill || '#000'; x.fillText(s, 0, 0); if (o.stroke) { x.lineWidth = o.stroke * 1000; x.strokeStyle = o.fill; x.stroke(); } x.restore();
}
export function vtext(x, s, px, py, size, font, o = {}) {   // 竖排
  const gap = o.gap ?? 1.08;
  [...s].forEach((ch, i) => text(x, ch, px, py - i * size * gap, size, font, o));
}

// 纸面处理：纸纹、顶边受光、底边暗（像素空间）
export function finish(c, o = {}) {
  const x = c.getContext('2d'), W = c.width, H = c.height;
  if (o.grain !== false) { x.save(); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = o.grainA ?? .9; x.fillStyle = x.createPattern(GRAIN, 'repeat'); x.fillRect(0, 0, W, H); x.restore(); }
  const band = (dy, col, blur) => {
    const t = cv(W, H), y = t.getContext('2d');
    y.drawImage(c, 0, 0); y.globalCompositeOperation = 'destination-out'; y.drawImage(c, 0, dy);
    y.globalCompositeOperation = 'source-in'; y.fillStyle = col; y.fillRect(0, 0, W, H);
    x.save(); x.globalCompositeOperation = 'source-atop'; if (blur) x.filter = `blur(${blur}px)`; x.drawImage(t, 0, 0); x.restore();
  };
  if (o.rim !== 0) band(o.rimPx ?? 3, o.rimCol || `rgba(255,236,200,${o.rim ?? .35})`, .6);
  if (o.under !== 0) band(-(o.underPx ?? 3), `rgba(0,0,0,${o.under ?? .28})`, .8);
  return c;
}

export function tex(c, o = {}) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
}

// —— 材质：纸（受光 + 背光透纸 + 自发光贴图）——
// U：镜头共享的 uniforms { uLight: vec3 背光中心, uLightR, uLightCol, uLit }
export function paperMat(map, U, o = {}) {
  const m = new THREE.MeshStandardMaterial({
    map, alphaTest: .5, alphaToCoverage: true, roughness: o.rough ?? .92, metalness: o.metal ?? 0, side: THREE.FrontSide,
    emissive: o.emissiveMap ? new THREE.Color(o.glowCol || '#ffffff') : new THREE.Color(0), emissiveMap: o.emissiveMap || null, emissiveIntensity: o.glow ?? 0,
  });
  if (o.envMap) { m.envMap = o.envMap; m.envMapIntensity = o.envI ?? 1; }
  if (o.bumpMap) { m.bumpMap = o.bumpMap; m.bumpScale = o.bump ?? 4; }
  if (o.color) m.color.set(o.color);
  const own = { uTrans: { value: o.trans ?? .25 }, uGlowLit: { value: 1 }, tCloud: { value: CLOUD() }, uCloudS: { value: o.cloudS ?? 9 }, uClip: { value: new THREE.Vector4(0, 0, 100, 0) } };
  m.userData.u = own;
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, U, own);
    s.vertexShader = 'varying vec3 vWP;\n' + s.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.)).xyz;');
    s.fragmentShader = 'varying vec3 vWP; uniform vec3 uLight, uLightCol; uniform float uLightR, uLit, uTrans, uGlowLit, uCloudS; uniform sampler2D tCloud; uniform vec4 uClip;\n' +
      s.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
        { float cd = length(vWP.xy - uClip.xy) - uClip.z; if (uClip.w < .5 ? cd > 0. : cd < 0.) discard; }`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance *= uGlowLit;
        { float d = length(vWP.xy - uLight.xy); float fall = mix(.22, 1., exp(-d*d/(uLightR*uLightR)));
          float g = texture2D(tCloud, vMapUv * uCloudS).r;
          totalEmissiveRadiance += diffuseColor.rgb * uLightCol * (uTrans * uLit * fall * (.35 + 1.3 * g)); }`);
  };
  m.customProgramCacheKey = () => 'paperT' + (o.emissiveMap ? 'g' : '') + (o.envMap ? 'e' : '') + (o.bumpMap ? 'b' : '');
  return m;
}
const depthCache = new Map();
function depthMat(map) {
  if (!depthCache.has(map.uuid)) depthCache.set(map.uuid, new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: .5, side: THREE.DoubleSide }));
  return depthCache.get(map.uuid);
}

// 一张纸雕层。o: { w, h, draw, glowDraw?, glow, trans, z, x, y, ax, ay, U, shadow, recv, finish:{...}, ppm }
// ax/ay：锚点（米，相对画布中心），网格原点即锚点，便于做关节
export function sheet(o) {
  const ppm = o.ppm || PPM;
  const c = finish(paint(o.w, o.h, o.draw, ppm), o.finish || {});
  const map = tex(c);
  let emissiveMap = null;
  if (o.glowDraw) emissiveMap = tex(paint(o.w, o.h, o.glowDraw, ppm * (o.glowRes ?? .5)));
  let bumpMap = null;
  if (o.bumpDraw) { const bc = paint(o.w, o.h, o.bumpDraw, ppm); const bx = bc.getContext('2d'); if (o.bumpBlur) { const t = cv(bc.width, bc.height), tx = t.getContext('2d'); tx.filter = `blur(${o.bumpBlur}px)`; tx.drawImage(bc, 0, 0); bumpMap = tex(t, { linear: true }); } else bumpMap = tex(bc, { linear: true }); }
  const mat = paperMat(map, o.U, { ...o, emissiveMap, bumpMap });
  const geo = new THREE.PlaneGeometry(o.w, o.h); geo.translate(-(o.ax || 0), -(o.ay || 0), 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = o.shadow ?? true; mesh.receiveShadow = o.recv ?? true; mesh.customDepthMaterial = depthMat(map);
  mesh.position.set((o.x || 0) + (o.ax || 0), (o.y || 0) + (o.ay || 0), o.z || 0);
  mesh.userData = { canvas: c, map };
  return mesh;
}

// 天幕：不受光的渐变背板（HDR 亮度倍数），可叠星点
export function skyPanel(o) {
  const c = paint(o.w, o.h, (x, k) => {
    const g = x.createLinearGradient(0, o.h / 2, 0, -o.h / 2);
    o.stops.forEach(([p, col]) => g.addColorStop(p, col));
    x.fillStyle = g; x.fillRect(-o.w / 2, -o.h / 2, o.w, o.h);
    if (o.extra) o.extra(x, k);
    if (o.stars) {
      const R = mulberry(o.seed || 5);
      for (let i = 0; i < o.stars; i++) {
        const px = (R() - .5) * o.w, py = (R() - .5) * o.h, r = (.4 + R() * R() * 1.6) / k, a = .25 + R() * .6;
        if (py < (o.starMinY ?? -1)) continue;
        x.fillStyle = `rgba(255,246,220,${a})`; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
      }
    }
  }, o.ppm || 1400);
  const x = c.getContext('2d'); x.save(); x.globalAlpha = .5; x.globalCompositeOperation = 'overlay'; x.fillStyle = x.createPattern(GRAIN, 'repeat'); x.fillRect(0, 0, c.width, c.height); x.restore();
  const m = new THREE.MeshBasicMaterial({ map: tex(c), color: new THREE.Color(1, 1, 1).multiplyScalar(o.gain ?? 1) });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), m); mesh.position.set(o.x || 0, o.y || 0, o.z);
  mesh.userData.base = o.gain ?? 1;
  return mesh;
}

// 月亮：盘面（带淡淡的月海）+ 光晕
export function moon(o) {
  const r = o.r, g = new THREE.Group();
  const c = paint(r * 2.02, r * 2.02, (x, k) => {
    const gr = x.createRadialGradient(-r * .2, r * .25, 0, 0, 0, r);
    gr.addColorStop(0, o.core || '#fffaf0'); gr.addColorStop(.75, o.mid || '#fff0cf'); gr.addColorStop(1, o.edge || '#f7dca4');
    x.fillStyle = gr; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.fill();
    const R = mulberry(11);
    x.globalCompositeOperation = 'source-atop';
    for (const [px, py, rr, a] of [[-.3, .25, .32, .10], [.2, .35, .22, .08], [.28, -.1, .3, .09], [-.15, -.35, .25, .07], [-.45, -.05, .18, .06], [.05, .05, .15, .05]]) {
      const q = x.createRadialGradient(px * r, py * r, 0, px * r, py * r, rr * r);
      q.addColorStop(0, `rgba(190,150,100,${a})`); q.addColorStop(1, 'rgba(190,150,100,0)');
      x.fillStyle = q; x.fillRect(-r, -r, r * 2, r * 2);
    }
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(170,130,90,${.03 + R() * .04})`; x.beginPath(); x.arc((R() - .5) * 1.6 * r, (R() - .5) * 1.6 * r, (.01 + R() * .04) * r, 0, TAU); x.fill(); }
    if (o.art) o.art(x, k);
  }, Math.min(6000, 1200 / r > 0 ? 3000 / (r * 2) : 3000));
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.02, r * 2.02), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, color: new THREE.Color(1, 1, 1).multiplyScalar(o.gain ?? 2.2) }));
  g.add(disc);
  const hc = cv(256, 256), hx = hc.getContext('2d'), hg = hx.createRadialGradient(128, 128, 0, 128, 128, 128);
  hg.addColorStop(0, 'rgba(255,230,180,1)'); hg.addColorStop(.35, 'rgba(255,215,160,.35)'); hg.addColorStop(1, 'rgba(255,200,140,0)');
  hx.fillStyle = hg; hx.fillRect(0, 0, 256, 256);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(r * (o.halo ?? 5), r * (o.halo ?? 5)), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(o.haloCol || '#ffd9a0').multiplyScalar(o.haloGain ?? .35) }));
  halo.position.z = -.001; g.add(halo);
  g.userData = { disc, halo, gain: o.gain ?? 2.2, haloGain: o.haloGain ?? .35 };
  g.position.set(o.x, o.y, o.z);
  return g;
}
export function setMoon(m, k) {   // k: 0..1 亮度
  m.userData.disc.material.color.setScalar(m.userData.gain * k);
  m.userData.halo.material.color.set('#ffd9a0').multiplyScalar(m.userData.haloGain * k);
}

// 加色光晕（纸层外的“光”）：解析式径向衰减，中心在底边中点（不用贴图，避免透明贴图的边）
export function burst(w, h, col = '#ffcd82') {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({
    uniforms: { col: { value: new THREE.Color(col) }, k: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec2 vUv; uniform vec3 col; uniform float k; void main(){ vec2 d = (vUv - vec2(.5, 0.)) * vec2(1., 1.25); float a = pow(max(0., 1. - length(d) / .55), 2.2); gl_FragColor = vec4(col * a * k, 1.); }',
  }));
  m.renderOrder = 10; m.userData.set = k => { m.material.uniforms.k.value = k; }; return m;
}
