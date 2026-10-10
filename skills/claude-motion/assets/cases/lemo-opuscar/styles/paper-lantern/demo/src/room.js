// 真实世界：胡桃木桌上的纸雕灯箱（木框、内壁）、昏暗房间、茶具与一盘真月饼
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { paint, tex } from './paper.js';
import { cakeFace } from './shots/s03_press.js';
RectAreaLightUniformsLib.init();

export const BOX = { w: .56, h: .33, d: .16, front: .014, border: .035 };
const tl = new THREE.TextureLoader();
const woodCache = {};
function wood(rep = 1, rot = 0) {
  const k = rep + ':' + rot; if (woodCache[k]) return woodCache[k];
  const ld = (f, srgb) => { const t = tl.load('/core/assets/polyhaven/' + f); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.rotation = rot; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return woodCache[k] = { map: ld('walnut_diff.jpg', true), normalMap: ld('walnut_nor.jpg'), roughnessMap: ld('walnut_rough.jpg') };
}

export async function lightbox(S, E, o = {}) {
  const g = new THREE.Group(); S.scene.add(g);
  const { w, h, d, front, border } = BOX;
  const W = w + border * 2, H = h + border * 2;
  // 前框：带孔的挤出体
  const sh = new THREE.Shape(); sh.moveTo(-W / 2, -H / 2); sh.lineTo(W / 2, -H / 2); sh.lineTo(W / 2, H / 2); sh.lineTo(-W / 2, H / 2); sh.closePath();
  const hole = new THREE.Path(); const r = .006; hole.moveTo(-w / 2 + r, -h / 2); hole.lineTo(w / 2 - r, -h / 2); hole.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); hole.lineTo(w / 2, h / 2 - r); hole.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); hole.lineTo(-w / 2 + r, h / 2); hole.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); hole.lineTo(-w / 2, -h / 2 + r); hole.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); sh.holes.push(hole);
  const fgeo = new THREE.ExtrudeGeometry(sh, { depth: .018, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 3, curveSegments: 6 });
  const wm = new THREE.MeshStandardMaterial({ ...wood(3), color: '#8a6a52', roughness: .55, normalScale: new THREE.Vector2(.6, .6) });
  const frame = new THREE.Mesh(fgeo, wm); frame.position.z = front - .004; frame.castShadow = frame.receiveShadow = true; g.add(frame);
  // 箱体四壁 + 背板（外侧木纹，内侧深色纸）
  const side = (sw, shh, sd, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sw, shh, sd), wm); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); };
  const bt = border * .5;
  side(W, bt, d, 0, -h / 2 - bt / 2, front - d / 2); side(W, bt, d, 0, h / 2 + bt / 2, front - d / 2);
  side(bt, H, d, -w / 2 - bt / 2, 0, front - d / 2); side(bt, H, d, w / 2 + bt / 2, 0, front - d / 2);
  side(W, H, .01, 0, 0, front - d - .005);
  // 内侧黑纸衬（防止看到木头内壁的反光）
  const inner = new THREE.MeshStandardMaterial({ color: '#0a0806', roughness: 1 });
  for (const [ww, hh, x, y, rx, ry] of [[w, d, 0, -h / 2 + .0005, -Math.PI / 2, 0], [w, d, 0, h / 2 - .0005, Math.PI / 2, 0], [d, h, -w / 2 + .0005, 0, 0, Math.PI / 2], [d, h, w / 2 - .0005, 0, 0, -Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), inner); m.position.set(x, y, front - d / 2); m.rotation.set(rx, ry, 0); m.receiveShadow = true; g.add(m);
  }
  // 桌面 + 墙
  const tw = wood(4, Math.PI / 2);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), new THREE.MeshStandardMaterial({ ...tw, color: '#6a4a36', roughness: .45 }));
  table.rotation.x = -Math.PI / 2; table.position.set(0, -H / 2, .4); table.receiveShadow = true; g.add(table);
  const wallC = paint(4, 2.4, x => { const gr = x.createRadialGradient(0, .1, .1, 0, 0, 2); gr.addColorStop(0, '#2a2018'); gr.addColorStop(1, '#0a0806'); x.fillStyle = gr; x.fillRect(-2, -1.2, 4, 2.4); }, 200);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.4), new THREE.MeshStandardMaterial({ map: tex(wallC), roughness: 1 }));
  wall.position.set(0, .6, -.9); wall.receiveShadow = true; g.add(wall);
  // 灯箱向外透出的光（面光源，照亮桌面和茶具）
  const spill = new THREE.RectAreaLight(o.spillCol || '#ffc98a', o.spill ?? 6, w * .9, h * .9); spill.position.set(0, 0, front + .002); spill.lookAt(0, -.05, 1); g.add(spill);
  const fill = new THREE.HemisphereLight('#3a3040', '#140c06', .25); g.add(fill);
  // 茶具（Poly Haven CC0）+ 一盘真月饼
  const gl = await new GLTFLoader().loadAsync('/core/assets/polyhaven/tea_set_01/tea_set_01.gltf');
  const pick = n => gl.scene.getObjectByName(n);
  const props = new THREE.Group(); g.add(props);
  const place = (n, x, z, ry = 0) => { const m = pick(n); if (!m) return; m.position.set(x, -H / 2, z); m.rotation.set(0, ry, 0); m.traverse(c => { if (c.isMesh) { c.castShadow = c.receiveShadow = true; } }); props.add(m); return m; };
  place('tea_set_01_teapot_01', .5, .02, -.6); place('tea_set_01_cup_small_01', .38, .17, .3); place('tea_set_01_saucer_circular_03', .38, .17);
  const plate = place('tea_set_01_plate_large_circular_03', -.42, .14);
  const face = (kind) => paint(.08, .08, x => cakeFace(x, .036, kind, kind === 'bump' ? {} : { base: '#b8742c', hi: '#e9b25c', lo: '#6a3812' }), 3000);
  const topMat = new THREE.MeshStandardMaterial({ map: tex(face('color')), bumpMap: tex(face('bump'), { linear: true }), bumpScale: 6, roughness: .45, metalness: .1, transparent: false, alphaTest: .5 });
  const sideMat = new THREE.MeshStandardMaterial({ color: '#8a5220', roughness: .6 });
  for (const [dx, dz, ry] of [[-.02, -.01, .3], [.035, .03, 1.2]]) {
    const c = new THREE.Group();
    const top = new THREE.Mesh(new THREE.PlaneGeometry(.08, .08), topMat); top.rotation.x = -Math.PI / 2; top.position.y = .026; c.add(top);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(.0345, .036, .025, 48), sideMat); cyl.position.y = .0128; c.add(cyl);
    c.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; });
    c.position.set(-.42 + dx, -H / 2 + .012, .14 + dz); c.rotation.y = ry; props.add(c);
  }
  return { g, frame, spill, table, props };
}
