// 产品：虚构耳机 Aura —— 玻璃鹅卵石耳机（无柄、透镜形）+ 旋盖玻璃充电盒
// 单位：毫米。耳机本地轴 Y = 朝外（正面玻璃穹顶），-Y = 入耳方向（导管 + 硅胶耳塞）
import * as THREE from 'three';

// —— 材质 ——
export const AURA_A = new THREE.Color('#62dcff');   // 光纹主色：冰蓝
export const AURA_B = new THREE.Color('#a98bff');   // 峰值：淡紫

export function glass(o = {}) {
  return new THREE.MeshPhysicalMaterial(Object.assign({
    color: '#ffffff', metalness: 0, roughness: .015, transmission: 1, thickness: 3, ior: 1.52,
    dispersion: 5, attenuationColor: new THREE.Color('#f3f8fb'), attenuationDistance: 160,
    specularIntensity: 1, envMapIntensity: 1.25,
  }, o));
}
export const frosted = (o = {}) => glass(Object.assign({ color: '#eef2f5', transmission: .82, roughness: .4, thickness: 7, dispersion: 1.5, envMapIntensity: 1.1 }, o));
const metal = (color, rough, o = {}) => new THREE.MeshPhysicalMaterial(Object.assign({ color, metalness: 1, roughness: rough, envMapIntensity: 1.2 }, o));

// 程序贴图（画布）
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// 拉丝金属：同心细纹（驱动振膜、电池盖）
const brushed = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  let s = 3; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) { const r = R() * w * .7; g.strokeStyle = `rgba(${R() < .5 ? 255 : 0},${R() < .5 ? 255 : 0},${R() < .5 ? 255 : 0},${.05 + R() * .08})`; g.lineWidth = .6 + R(); g.beginPath(); g.arc(w / 2, h / 2, r, 0, 7); g.stroke(); }
}, false);
// PCB：石墨底 + 金色走线 + 焊盘
const pcbTex = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#15181c'; g.fillRect(0, 0, w, h);
  let s = 11; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.strokeStyle = '#c9a25a'; g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    let x = w / 2 + (R() - .5) * w * .8, y = h / 2 + (R() - .5) * h * .8; g.lineWidth = 3 + R() * 5; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { const d = 40 + R() * 160, a = Math.floor(R() * 8) * Math.PI / 4; x += Math.cos(a) * d; y += Math.sin(a) * d; g.lineTo(x, y); }
    g.stroke(); g.fillStyle = '#d8b46a'; g.beginPath(); g.arc(x, y, 7 + R() * 5, 0, 7); g.fill();
  }
  g.strokeStyle = 'rgba(201,162,90,.8)'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, w * .46, 0, 7); g.stroke();
});
const pcbRough = canvasTex(4, 4, (g) => { g.fillStyle = '#777'; g.fillRect(0, 0, 4, 4); }, false);

// 导光材质：暗的抛光亚克力 + 可控的光脉冲（沿 uv.x 流动）
// pulses: [{p, w, a, h}] p=位置(0..1) w=宽度 a=强度 h=色相混合；wrap=true 表示环形首尾相接
const WHITE = canvasTex(2, 2, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 2, 2); });
export function guideMat(wrap) {
  const m = new THREE.MeshPhysicalMaterial({ color: '#15181b', roughness: .08, metalness: 0, clearcoat: 1, clearcoatRoughness: .05, emissive: '#ffffff', emissiveMap: WHITE, envMapIntensity: 1.4 });
  const U = { uP: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, .1, 0, 0)) }, uBase: { value: .02 }, uA: { value: AURA_A }, uB: { value: AURA_B }, uWrap: { value: wrap ? 1 : 0 } };
  m.userData.U = U;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec4 uP[8]; uniform float uBase, uWrap; uniform vec3 uA, uB;`)
      .replace('#include <emissivemap_fragment>', `{
        float x = vEmissiveMapUv.x; vec3 acc = uA * uBase;
        for (int i = 0; i < 8; i++) { vec4 P = uP[i]; if (P.z <= 0.) continue;
          float d = x - P.x; if (uWrap > .5) d = fract(d + .5) - .5;
          // 彗星形脉冲：P.y 的符号 = 运动方向；头部窄高斯，身后指数拖尾（长度 = 4×宽度）
          float w = abs(P.y), s = sign(P.y + 1e-6), a = d * s;
          float head = exp(-a * a / (w * w * .25)), tail = a < 0. ? exp(a / (w * 4.)) * .55 : 0.;
          float k = max(head, tail);
          acc += (mix(uA, uB, P.w + (1. - head) * .25) * k + vec3(head * head * head * .35)) * P.z; }
        totalEmissiveRadiance = acc; }`);
  };
  m.customProgramCacheKey = () => 'guide' + (wrap ? 1 : 0);
  return m;
}
export function setPulses(mat, list, base = .02) {
  const U = mat.userData.U; U.uBase.value = base;
  for (let i = 0; i < 8; i++) { const p = list[i]; U.uP.value[i].set(p ? p.p : 0, p ? p.w : .1, p ? p.a : 0, p ? p.h : 0); }
}

// —— 几何工具 ——
const lathe = (pts, seg = 128) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
// 平滑轮廓：少量控制点 → Catmull-Rom 细分（避免旋转体出现棱角）
const smooth = (pts, n = 96) => new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y))).getSpacedPoints(n).map(v => [Math.max(0, v.x), v.y]);
const ell = (rx, ry, a0, a1, n, sgn = 1) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([rx * Math.cos(a), sgn * ry * Math.sin(a)]); } return o; };

// —— 耳机 ——
// 返回 { root, parts:[{obj, off, rot}], guides:[ring, spiral], glow }
export function makeBud(side = 1) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const parts = [];
  const add = (obj, y, off, rot = [0, 0, 0]) => { const g = new THREE.Group(); g.add(obj); g.position.y = y; body.add(g); parts.push({ g, y, off, rot }); return g; };

  // 正面：透明玻璃穹顶（实心透镜感：thickness 大一些，内部零件被放大折射）
  const front = new THREE.Mesh(lathe([[10, 0], ...ell(10, 5.2, 0, Math.PI / 2, 48).slice(1)]), glass({ thickness: 4.5, side: THREE.DoubleSide }));
  add(front, 0, 40, [0, .35, .05]);
  // 光纹通道：刻在穹顶下的 6 条螺旋（导光）
  const spiral = new THREE.Group(), spMat = guideMat(false);
  for (let k = 0; k < 6; k++) {
    const pts = []; for (let i = 0; i <= 60; i++) { const u = i / 60, r = 1.6 + u * 5.6, a = k * Math.PI / 3 + u * 2.2 * side; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(u * Math.PI) * .25, Math.sin(a) * r)); }
    spiral.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, .13, 8), spMat));
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), metal('#e6e9ec', .05)); hub.scale.y = .5; spiral.add(hub);
  add(spiral, 2.9, 31, [0, -.5, 0]);
  // 光环导光圈
  const ringMat = guideMat(true);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7.5, .8, 32, 160), ringMat); ring.rotation.x = Math.PI / 2;
  add(ring, 1.5, 23, [.15, 0, .1]);
  // 驱动单元：同心波纹振膜 + 防尘帽
  const drv = new THREE.Group();
  const rip = []; for (let i = 0; i <= 60; i++) { const r = 5.8 * (1 - i / 60); rip.push([r, .12 * Math.sin(i * .9) * (1 - i / 60) + (i > 44 ? (i - 44) * .045 : 0)]); }
  const diaph = new THREE.Mesh(lathe(rip.reverse().map(([r, y]) => [r, y]).reverse()), metal('#c8c2b8', .22, { roughnessMap: brushed, side: THREE.DoubleSide }));
  drv.add(diaph);
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(6.1, 5.4, 1.2, 96, 1, true), metal('#9aa0a6', .3, { side: THREE.DoubleSide })); basket.position.y = -.6; drv.add(basket);
  add(drv, .9, 15, [0, .8, 0]);
  // 钛金属腰线
  const band = new THREE.Mesh(new THREE.TorusGeometry(10, .42, 24, 180), metal('#d4d7db', .16)); band.rotation.x = Math.PI / 2; band.scale.z = .75;
  add(band, 0, 7, [0, 0, 0]);
  // 磁铁
  const mag = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 1.5, 64), metal('#e8eaec', .14)); add(mag, -.7, 0, [0, 0, 0]);
  // PCB + 元件
  const pcb = new THREE.Group();
  const board = new THREE.Mesh(new THREE.CylinderGeometry(6.9, 6.9, .5, 96), new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: pcbTex, roughness: .45, metalness: .35, clearcoat: .6, clearcoatRoughness: .3 }));
  pcb.add(board);
  let s = 5; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const chipM = new THREE.MeshPhysicalMaterial({ color: '#0b0c0e', roughness: .35 }), capM = metal('#b88b4a', .3);
  for (let i = 0; i < 16; i++) { const a = R() * 6.28, r = 1.5 + R() * 4.2, big = i < 3; const c = new THREE.Mesh(new THREE.BoxGeometry(big ? 2.2 : .6 + R() * .6, big ? .5 : .35, big ? 2.2 : .35 + R() * .3), big ? chipM : capM); c.position.set(Math.cos(a) * r, .4, Math.sin(a) * r); c.rotation.y = R() * 3; pcb.add(c); }
  add(pcb, -2, -8, [0, -.7, .05]);
  // 电池：拉丝钢纽扣
  const bat = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 2.2, 96), metal('#b9bec4', .28, { roughnessMap: brushed })); add(bat, -3.4, -15, [0, .4, 0]);
  // 背壳：磨砂玻璃 + 导管
  const rear = [[0, -9.6], [2.3, -9.6], [2.75, -9.2], [2.8, -6.8], [3.1, -5.9], [3.9, -5.15], ...ell(10, 5.2, Math.asin(.97), 0, 40, -1).slice(1)];
  const back = new THREE.Mesh(lathe(smooth(rear, 120)), frosted({ side: THREE.DoubleSide }));
  add(back, 0, -24, [0, -.3, 0]);
  const grill = new THREE.Mesh(new THREE.CircleGeometry(2.1, 48), metal('#8d9399', .4)); grill.rotation.x = Math.PI / 2; grill.position.y = -9.62;
  back.add(grill);
  // 硅胶耳塞：乳白半透
  const tipP = [[2.85, -7.2], [3.05, -7.6], [4.6, -8.6], [5.5, -10.2], [5.4, -11.6], [4.7, -12.6], [3.2, -12.9], [2.3, -12.7], [2.2, -12.2], [2.5, -12.0], [2.7, -8]];
  const tip = new THREE.Mesh(lathe(smooth(tipP, 80)), new THREE.MeshPhysicalMaterial({ color: '#c9d0d6', roughness: .62, sheen: 1, sheenRoughness: .45, sheenColor: '#ffffff', envMapIntensity: 1.8 }));
  add(tip, 0, -34, [0, .5, 0]);

  // 内部光：光纹亮起时照亮金属零件
  const glow = new THREE.PointLight(AURA_A.clone(), 0, 40, 2); glow.position.y = 1.5; body.add(glow);

  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  return { root, body, parts, ring: ringMat, spiral: spMat, glow, side };
}
// 爆炸视图：e 0..1（部件沿本地 Y 轴展开并各自悬浮旋转），spin = 额外自转相位
export function explode(bud, e, spin = 0) {
  for (const p of bud.parts) {
    p.g.position.y = p.y + p.off * e;
    // 每个零件在展开时带一点不同角度的倾斜（按序号的确定性偏移），合拢时归零
    const i = bud.parts.indexOf(p), tx = Math.sin(i * 1.7 + .4) * .32, tz = Math.cos(i * 2.3 + .9) * .28;
    p.g.rotation.set((p.rot[0] + tx) * e, p.rot[1] * e + spin * p.off * .004 * e, (p.rot[2] + tz) * e);
  }
}

// —— 充电盒：鹅卵石形，磨砂玻璃底座 + 透明玻璃旋盖（绕一端的金属销水平旋开）——
export const CASE = { rx: 33, rz: 27, hb: 15, hl: 17, pivot: 30 };
export function makeCase() {
  const root = new THREE.Group();
  const { rx, rz, hb, hl, pivot } = CASE;
  // 底座（平底的半椭球）
  const baseP = [[0, -hb], [rx * .55, -hb], ...ell(rx, hb, -Math.acos(.62), 0, 40).slice(1).map(([x, y]) => [x, y])];
  const base = new THREE.Mesh(lathe(baseP, 160), frosted({ thickness: 14, side: THREE.DoubleSide, roughness: .42, transmission: .9 }));
  base.scale.z = rz / rx; root.add(base);
  // 台面：石墨缎面 + 两个镀铬托环
  const shape = new THREE.Shape(); shape.absellipse(0, 0, rx - .6, rz - .6, 0, Math.PI * 2);
  const holes = [-15.5, 15.5].map(x => { const h = new THREE.Path(); h.absarc(x, 0, 10.6, 0, Math.PI * 2, true); return h; });
  shape.holes.push(...holes);
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(shape, 96), new THREE.MeshPhysicalMaterial({ color: '#16181b', roughness: .38, metalness: .6, clearcoat: .4, clearcoatRoughness: .25, side: THREE.DoubleSide }));
  deck.rotation.x = -Math.PI / 2; deck.position.y = -.05; root.add(deck);
  for (const x of [-15.5, 15.5]) { const t = new THREE.Mesh(new THREE.TorusGeometry(10.7, .35, 16, 128), metal('#dfe2e6', .08)); t.rotation.x = Math.PI / 2; t.position.set(x, 0, 0); root.add(t); }
  // 充电指示光带：沿台面边缘的导光细线
  const edgeMat = guideMat(true);
  const ep = []; for (let i = 0; i <= 200; i++) { const a = i / 200 * Math.PI * 2; ep.push(new THREE.Vector3(Math.cos(a) * (rx - 2.2), .1, Math.sin(a) * (rz - 2.2))); }
  const edge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ep, true), 400, .22, 8, true), edgeMat); root.add(edge);
  // 翻盖（透明玻璃薄壳）：铰链在盒子后缘，开盖时立起来停在盒子后方，被背光打成一圈玻璃光环
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0, -rz); root.add(lidPivot);
  const lid = new THREE.Mesh(lathe(ell(rx, hl, 0, Math.PI / 2, 48), 160), glass({ thickness: 1.6, side: THREE.DoubleSide, dispersion: 4 }));
  lid.scale.z = rz / rx; lid.position.z = rz; lidPivot.add(lid);
  const lidRim = new THREE.Mesh(new THREE.TorusGeometry(rx, .45, 16, 200), metal('#d9dce0', .12)); lidRim.rotation.x = Math.PI / 2; lidRim.scale.y = rz / rx; lidRim.position.set(0, .2, rz); lidPivot.add(lidRim);
  // 铰链：一根横向镀铬短轴
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 18, 48), metal('#eceef0', .08)); hinge.rotation.z = Math.PI / 2; hinge.position.set(0, .4, -rz + .6); root.add(hinge);
  // 底座内部的发光盘（不透明，被磨砂玻璃模糊成一团柔光 = "充电"光）+ 内部点光源
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#dff3ff') });
  const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 96), glowMat); glowDisc.rotation.x = -Math.PI / 2; glowDisc.scale.set(rx * .62, rz * .62, 1); glowDisc.position.y = -hb + 2.2; root.add(glowDisc);
  const inner = new THREE.PointLight('#e2f4ff', 0, 60, 2); inner.position.set(0, -7, 0); root.add(inner);
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  const setGlow = I => { glowMat.color.set('#dff3ff').multiplyScalar(I * 1.6); inner.intensity = I * 14; glowDisc.visible = I > 0.001; };
  setGlow(0);
  return { root, lidPivot, hinge, setGlow, edge: edgeMat, cradles: [new THREE.Vector3(-15.5, 1.2, 0), new THREE.Vector3(15.5, 1.2, 0)], floorY: -hb };
}
