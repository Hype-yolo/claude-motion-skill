// 场景 B：低语林（Whisperwood）——夜林，Wren 提灯从左走到右；灯是主光，树影随她转动
import * as THREE from 'three';
import { PPM, texOf, spriteMats, billboard, glow, radialTex, mulberry, h2, rock } from './px.js';
import { mat, mesh, worldUV } from './kit.js';
import { particles, beamCard, flick } from './fx.js';
import { makeChar } from './chars.js';
import { clamp, seg, ss, lerp, monotone } from '/core/lib.js';
import { pathZ, bark, canopy, fern, grassTuft, mushroom, forestGround, treeline } from './forest_art.js';

const T0 = 25.5, T1 = 35.5, SPEED = 1.15, X0 = -6.2;
const wxAt = t => X0 + SPEED * (t - T0);

export function buildForest() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#132540');
  scene.fog = new THREE.FogExp2('#152a48', .04);
  const R = mulberry(31);

  // —— 光：极暗的月光（投影）+ 冷色天光；提灯是主光 ——
  const moon = new THREE.DirectionalLight('#86a4e0', 1.2); moon.position.set(-8, 20, 7); moon.target.position.set(0, 0, 0);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -22, right: 22, top: 18, bottom: -18, near: 1, far: 60 }); moon.shadow.bias = -.0008; moon.shadow.normalBias = .03;
  scene.add(moon, moon.target);
  const hemi = new THREE.HemisphereLight('#34507e', '#07090c', 1.0); scene.add(hemi);

  // —— 地面 ——
  const GW = 48, GD = 30, GZ = -3;
  const gc = forestGround(GW * PPM, GD * PPM, (u, v) => [-GW / 2 + u * GW, GZ - GD / 2 + v * GD]);
  const gt = texOf(gc); const gm = new THREE.MeshStandardMaterial({ map: gt, roughness: .95 });
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(GW, GD), gm); gnd.rotation.x = -Math.PI / 2; gnd.position.z = GZ; gnd.receiveShadow = true; scene.add(gnd);

  // —— 树：3D 树干（像素树皮）+ 公告板树冠团簇 ——
  const barkM = [bark(48, 48, 3), bark(48, 48, 7)].map(c => mat(c, { rough: .95 }));
  const canopyTex = [0, 1, 2, 3].map(i => texOf(canopy(150, 104, 11 + i * 7, { n: 8 + i })));
  const trunks = [];
  function tree(x, z, r, hgt, o = {}) {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(r * .82, r * 1.05, hgt, 10, 3); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 + (h2(i % 11, Math.round(y), 5) - .5) * .12; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    geo.translate(0, hgt / 2, 0);
    const tr = mesh(geo, barkM[o.b ?? 0]); g.add(tr);
    // 根部外撇
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + R(); const rg = new THREE.ConeGeometry(r * .5, r * 1.6, 5); rg.rotateZ(Math.PI / 2 + .9); rg.rotateY(a); rg.translate(Math.cos(a) * r * .9, r * .25, -Math.sin(a) * r * .9); g.add(mesh(rg, barkM[o.b ?? 0])); }
    // 树冠
    const nC = o.canopy ?? 3;
    for (let k = 0; k < nC; k++) {
      const s = (o.cs ?? 5.5) * (.75 + R() * .5), c = billboard(canopyTex[(k + (o.b ?? 0)) % 4], s, s * .69, { ay: .5, shadow: true });
      c.position.set((R() - .5) * s * .5, hgt * (o.ch ?? .82) + (R() - .3) * 1.6, (R() - .5) * 1.2); g.add(c);
    }
    g.position.set(x, 0, z); scene.add(g); trunks.push(g); return g;
  }
  // 后排巨树（只看得到树干下半段 → 顶天立地）
  for (let x = -16; x < 16; x += 2.6 + R() * 1.6) tree(x + R(), -3.2 - R() * 2.8, .38 + R() * .3, 12, { b: (x * 7 | 0) & 1, cs: 6, ch: .6 });
  for (let x = -18; x < 18; x += 3.4 + R() * 2) tree(x, -8 - R() * 4, .5 + R() * .3, 12, { b: 1, cs: 7, ch: .45 });
  // 小径近侧的树（在 Wren 与镜头之间，较疏）
  const exitTree = null;
  [[-8.6, 3.6, .42], [4.75, 3.3, .5]].forEach(([x, z, r], i) => tree(x, z, r, 13, { b: i & 1, canopy: 0 }));
  // 小径旁的细树
  [[-6.8, -1.6], [-.8, -1.9], [2.6, -1.5], [7.3, -1.8]].forEach(([x, z], i) => tree(x, z, .22, 8, { b: i & 1, cs: 3.4, ch: .5, canopy: 2 }));

  // —— 倒木、石头 ——
  { const lg = new THREE.CylinderGeometry(.34, .42, 5.2, 9); lg.rotateZ(Math.PI / 2); lg.rotateY(.18); lg.translate(1.2, .32, -2.6); scene.add(mesh(lg, barkM[1])); }
  const rockM = mat(rock(64, 64, { seed: 4, cols: ['#0b0c10', '#171820', '#24252e', '#33343e', '#474854'] }));
  [[-4.4, -1.3, .45], [3.6, 1.35, .35], [6.2, -1.2, .55], [-8.4, 1.4, .5], [.3, 1.5, .28]].forEach(([x, z, s]) => { const g = new THREE.DodecahedronGeometry(s, 0); g.scale(1.3, .75, 1); g.translate(x, s * .5, z); scene.add(mesh(g, rockM)); });

  // —— 草丛 / 蕨：实例化公告板（投影）——
  function scatter(canvas, wM, hM, n, place) {
    const tex = texOf(canvas), M = spriteMats(tex, null);
    const geo = new THREE.PlaneGeometry(wM, hM).translate(0, hM / 2, 0);
    const im = new THREE.InstancedMesh(geo, M.m, n); im.castShadow = true; im.receiveShadow = false; im.customDepthMaterial = M.depth; im.customDistanceMaterial = M.dist;
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) { const [x, z, s] = place(i); o.position.set(x, 0, z); o.rotation.set(0, (R() - .5) * .5, 0); o.scale.set(s * (R() > .5 ? 1 : -1), s, s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
    scene.add(im); return im;
  }
  const offPath = (minD = 1.1) => { for (; ;) { const x = -15 + R() * 30, z = -6 + R() * 10, d = Math.abs(z - pathZ(x)); if (d > minD) return [x, z]; } };
  [grassTuft(18, 12, 4), grassTuft(20, 14, 9), grassTuft(16, 10, 13)].forEach((c, k) => scatter(c, .75, .5, 70, () => { const [x, z] = offPath(.75 + R() * .5); return [x, z, .8 + R() * .7]; }));
  [fern(44, 26, 2), fern(40, 24, 6)].forEach((c, k) => scatter(c, 1.7, 1.0, 26, () => { const [x, z] = offPath(1.3); return [x, z, .8 + R() * .6]; }));
  // 近景大蕨（镜头前、会被糊掉）
  scatter(fern(44, 26, 17), 2.6, 1.55, 10, i => [-14 + i * 3.1 + R() * 1.5, 4.9 + R() * 1.8, 1 + R() * .5]);

  // —— 中景灌木团（树冠贴图缩小版，贴地，受月光/灯光）——
  for (let i = 0; i < 26; i++) { const [x, z] = offPath(1.6); if (z > 0) continue; const s = 1.4 + R() * 1.8, b = billboard(canopyTex[i % 4], s, s * .69, { ay: .12 }); b.position.set(x, 0, z - .4); scene.add(b); }
  // —— 发光蘑菇 ——
  const mushGlows = [];
  [[-5.1, -1.9], [-.6, -2.4], [3.1, -1.9], [6.6, -1.35], [-3.2, 1.25], [8.8, 1.3]].forEach(([x, z], i) => {
    const m = mushroom(5 + i), b = billboard(texOf(m.c), .5, .43, { em: texOf(m.e), emCol: '#9ff6ff', emI: 1.4, shadow: false });
    b.position.set(x, 0, z); scene.add(b);
    const g = glow('#6fe8ff', .9, .5); g.position.set(x, .2, z + .05); scene.add(g); mushGlows.push(g);
  });

  // —— 远景树林剪影 ——
  { const tl = new THREE.Mesh(new THREE.PlaneGeometry(70, 12).translate(0, 6, 0), new THREE.MeshBasicMaterial({ map: texOf(treeline(210, 36)), transparent: true, alphaTest: .5, fog: true })); tl.position.set(0, 0, -16); scene.add(tl); }

  // —— 月光柱 + 地面光斑 ——
  const shafts = [], spots = [];
  const moonDir = new THREE.Vector3(.36, -1, -.3).normalize();
  [[-2.3, -.6, 1.1], [4.2, -.2, .8], [-9, -1.5, .9]].forEach(([x, z, k]) => {
    const top = new THREE.Vector3(x, 0, z).addScaledVector(moonDir, -16);
    const b = beamCard(16.5, 1.3, 2.4, '#a8c2ff', { k: .3 * k, fall: .35 }); scene.add(b); shafts.push({ b, top, k });
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7), new THREE.MeshBasicMaterial({ map: radialTex('spot', [[0, 'rgba(255,255,255,.9)'], [.5, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]), color: new THREE.Color('#7f9ee8').multiplyScalar(.22 * k), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    sp.rotation.x = -Math.PI / 2; sp.position.set(x, .02, z); scene.add(sp); spots.push(sp);
  });

  // —— 萤火虫 + 光柱里的浮尘 ——
  const FF = [...Array(70)].map(() => [-14 + R() * 28, .3 + R() * 2.4, -5 + R() * 8, R() * 20, .5 + R()]);
  const flies = particles(FF.length, (i, t, o) => { const f = FF[i]; o.x = f[0] + Math.sin(t * .31 * f[4] + f[3]) * 1.1; o.y = f[1] + Math.sin(t * .47 + f[3] * 1.7) * .35; o.z = f[2] + Math.cos(t * .23 * f[4] + f[3]) * .7;
    const bl = Math.max(0, Math.sin(t * (.9 + f[4] * .6) + f[3] * 3)); o.a = .15 + Math.pow(bl, 3) * 1.6; o.s = .11; o.r = 2.2; o.g = 2.8; o.b = .7; }, { soft: 1 });
  scene.add(flies);
  const DU = [...Array(90)].map((_, i) => { const s = shafts[i % 2]; return [s.top.x + moonDir.x * (6 + R() * 10) + (R() - .5) * 1.8, R() * 5, s.top.z + moonDir.z * (6 + R() * 10) + (R() - .5) * 1, R() * 10]; });
  const dust = particles(DU.length, (i, t, o) => { const d = DU[i]; o.x = d[0] + Math.sin(t * .2 + d[3]) * .3; o.y = ((d[1] + t * .06) % 5); o.z = d[2]; o.a = .35 + .25 * Math.sin(t * 1.1 + d[3]); o.s = .03; o.r = .8; o.g = .9; o.b = 1.2; }, { soft: 1 });
  scene.add(dust);

  // —— Wren + 提灯 ——
  const wren = makeChar('wren'); scene.add(wren.root);
  // 精灵受光上限：灯贴着她，别把像素照爆（只改这个实例的材质）
  wren.mesh.material.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight = min(outgoingLight, diffuseColor.rgb * 1.35 + totalEmissiveRadiance);\n#include <opaque_fragment>'); };
  wren.mesh.material.customProgramCacheKey = () => 'wrenCap'; wren.mesh.material.needsUpdate = true;
  const lamp = new THREE.PointLight('#ffa648', 14, 16, 1.3); lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.bias = -.003; lamp.shadow.camera.near = .08; scene.add(lamp);
  const lampG = glow('#ffc070', 1.25, 1.1); scene.add(lampG);
  const lampG2 = glow('#ff9a40', 4.2, .35); scene.add(lampG2);
  const fill = new THREE.PointLight('#8fa6e0', 1.2, 6, 2); scene.add(fill);   // 冷色轮廓补光（HD-2D 式角色补光：暗场里把像素角色从背景里托出来）

  // —— 镜头：高位 3/4 横移，略领先；末段减速，她走进近景树后 ——
  const lookX = monotone([[T0, wxAt(T0) + 2.4], [28.5, wxAt(28.5) + 1.1], [32.8, wxAt(32.8) + .9], [T1, 3.95]]);

  function update(t, shot, cam, post, renderer) {
    const wx = wxAt(t), wz = pathZ(wx) * .9;
    const lx = lookX(t);
    cam.fov = 30; cam.updateProjectionMatrix();
    cam.position.set(lx + .7, 6.3, wz * .2 + 12.2); cam.lookAt(lx, .75, wz * .3 - .2);

    // Wren：9fps 步进走路
    const fi = Math.floor(t * 9) % 4, fr = ['w0', 'w1', 'w2', 'w3'][fi];
    wren.root.position.set(wx, 0, wz); wren.frame(fr); wren.face(cam, false);
    // 灯：跟手、微摆
    const sw = Math.sin(t * 9 * Math.PI / 2) * .025;
    const lp = wren.lanternPos(fr, false); lp.x += sw; lp.y += Math.abs(sw) * .4;
    const toCam = cam.position.clone().sub(lp).setY(0).normalize();
    lamp.position.copy(lp).addScaledVector(toCam, .42); lamp.position.y += .06;
    const fk = flick(t, 3);
    lamp.intensity = 14 * fk; lampG.position.copy(lp).addScaledVector(toCam, .05); lampG.material.opacity = .85 + .15 * fk; lampG2.position.copy(lampG.position); lampG2.material.opacity = .3 * fk;
    fill.position.set(wx - .6, 1.7, wz + 1.6);

    mushGlows.forEach((g, i) => g.material.opacity = .35 + .15 * Math.sin(t * 1.3 + i * 2));
    shafts.forEach(s => { const side = s.b.userData.aim(s.top, moonDir, cam); s.b.material.uniforms.k.value = .28 * s.k * side; s.b.material.uniforms.t.value = t; });
    flies.userData.update(t); dust.userData.update(t);

    // 后期：更暗、更冷，焦点锁 Wren，大光圈
    renderer.toneMappingExposure = 1.2;
    post.bloom.strength = .6; post.bloom.threshold = .8;
    const V = post.vig.uniforms; V.amt.value = .72; V.warm.value = 0; V.sat.value = 1.05;
    post.dof.focus = cam.position.distanceTo(new THREE.Vector3(wx, .7, wz)); post.dof.aper = 380; post.dof.maxCoc = 24;
  }
  return { scene, update };
}
