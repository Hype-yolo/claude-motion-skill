// 布景：真实书桌（HDRI + 胡桃木 + 茶具 + 台灯 + 铅笔 + 一摞书）+ 绿色底板 + 书顶的积木月球
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { COL, PLATE, BRICK, mesh, plate, brickGeo, roundGeo, plastic } from './bricks.js';
import { mulberry } from '/core/lib.js';

const PH = '/core/assets/polyhaven/';
export const M = 125;              // 1 米 = 125 凸点单位（8mm）
export const TOP = .3;             // 底板顶面
export const PAD = { x: 9, z: -2 };
export const PAD_TOP = TOP + PLATE;
export const MOON = { x: -58, z: -34 };

export async function buildSet(scene) {
  const hdr = await new RGBELoader().loadAsync(PH + 'photo_studio_loft_hall_2k.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr; scene.background = hdr;
  scene.backgroundBlurriness = .5; scene.backgroundIntensity = .22; scene.environmentIntensity = .45;
  scene.environmentRotation.y = scene.backgroundRotation.y = 1.2;

  const tl = new THREE.TextureLoader(), tex = (f, srgb) => { const t = tl.load(PH + f); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3.5, 3.5); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: tex('walnut_diff.jpg', true), normalMap: tex('walnut_nor.jpg'), roughnessMap: tex('walnut_rough.jpg'), roughness: 1 }));
  desk.rotation.x = -Math.PI / 2; desk.position.set(-20, 0, -20); desk.receiveShadow = true; scene.add(desk);

  // 灯
  const key = new THREE.DirectionalLight('#fff4e8', 3.0); key.position.set(-60, 110, 50); key.target.position.set(-10, 0, -10);
  key.castShadow = true; key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -.0004; key.shadow.normalBias = .03; key.shadow.radius = 4;
  Object.assign(key.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 10, far: 400 }); scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#cfe0ff', .45); fill.position.set(60, 40, -50); scene.add(fill);
  // 柔光箱：大面积面光源给塑料清晰的矩形高光（玩具摄影的标志）
  RectAreaLightUniformsLib.init();
  const box = (col, I, w, h, p, at) => { const l = new THREE.RectAreaLight(col, I, w, h); l.position.set(...p); l.lookAt(...at); scene.add(l); return l; };
  const softKey = box('#fff6ee', 6, 70, 45, [-55, 60, 55], [0, 4, 0]);
  const softRim = box('#e4eeff', 9, 60, 30, [45, 45, -75], [0, 6, 0]);
  const softMoon = box('#fff6ee', 5, 50, 35, [-20, 70, 10], [-58, 17, -34]);

  // 真实道具
  const gl = new GLTFLoader();
  const load = async n => (await gl.loadAsync(`${PH}${n}/${n}.gltf`)).scene;
  const tea = await load('tea_set_01');
  const keep = { tea_set_01_teapot_01: [30, -44, .6], tea_set_01_teapot_01_lid: [30, -44, .6], tea_set_01_cup_small_01: [44, -18, 2.4], tea_set_01_saucer_circular_04: [44, -18, 0] };
  const dead = [];
  tea.traverse(o => { if (!o.name.startsWith('tea_set_01_')) return; const k = keep[o.name]; if (!k) dead.push(o); else { o.position.set(k[0] / M, o.position.y + (o.name.includes('cup_small') ? .012 : 0), k[1] / M); o.rotation.y = k[2]; } });
  dead.forEach(o => o.parent.remove(o));
  tea.scale.setScalar(M); scene.add(tea);
  const lamp = await load('desk_lamp_arm_01'); lamp.scale.setScalar(M); lamp.position.set(-125, 0, -20); lamp.rotation.y = 1.77; scene.add(lamp);
  for (const o of [tea, lamp]) o.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
  const bulb = new THREE.PointLight('#ffe2b8', 700, 120, 2); bulb.position.set(-75, 46, -32); scene.add(bulb);

  // 铅笔
  const pencil = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.95, .95, 22, 6), new THREE.MeshStandardMaterial({ color: '#f3b61f', roughness: .45 }));
  const wood = new THREE.Mesh(new THREE.ConeGeometry(.95, 2.6, 6), new THREE.MeshStandardMaterial({ color: '#e9c89a', roughness: .8 })); wood.position.y = 12.3;
  const lead = new THREE.Mesh(new THREE.ConeGeometry(.3, .8, 12), new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: .4 })); lead.position.y = 14;
  const fer = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.4, 16), new THREE.MeshStandardMaterial({ color: '#b9bcc0', metalness: 1, roughness: .3 })); fer.position.y = -11.7;
  const eras = new THREE.Mesh(new THREE.CylinderGeometry(.95, .95, 1.6, 16), new THREE.MeshStandardMaterial({ color: '#e88a8a', roughness: .8 })); eras.position.y = -13.2;
  pencil.add(body, wood, lead, fer, eras); pencil.rotation.set(Math.PI / 2, 0, 1.1); pencil.position.set(22, .95, 22);
  pencil.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; }); scene.add(pencil);

  // 一摞书（顶上放月球）
  const books = new THREE.Group(); books.position.set(MOON.x, 0, MOON.z); scene.add(books);
  const cloth = ['#7b2d26', '#274b6d', '#3d5c3a', '#c9a45c'];
  let by = 0; const R = mulberry(11);
  [[34, 4.2, 25], [31, 3.4, 23], [33, 5, 24], [28, 3.6, 21]].forEach(([w, h, d], i) => {
    const b = new THREE.Group(); b.position.y = by; b.rotation.y = (R() - .5) * .25;
    const cover = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: cloth[i], roughness: .75 }));
    cover.position.y = h / 2; b.add(cover);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(w - .6, h - .7, d - .3), new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: .9 }));
    pages.position.set(.4, h / 2, 0); b.add(pages);
    b.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; });
    books.add(b); by += h;
  });
  const moonTop = by;

  // 积木月球：灰色圆板堆出的高地 + 陨石坑
  const moon = new THREE.Group(); moon.position.set(MOON.x, moonTop, MOON.z); scene.add(moon);
  const g1 = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 10.8, PLATE * 2, 48), plastic(COL.lgray)); g1.position.y = PLATE; moon.add(g1);
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2 + R() * .2, r = 9 + R() * 1.5, h = PLATE * (2 + Math.floor(R() * 3));
    const m = mesh(roundGeo(R() < .5 ? .5 : 1, h), R() < .3 ? COL.dgray : COL.lgray); m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); moon.add(m);
  }
  for (const [x, z, r] of [[4, 3, 1.6], [-5, -2, 1.1], [2, -6, .9], [-3, 6, .8]]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * .9, .25, 32), plastic(COL.dgray)); c.position.set(x, PLATE * 2 + .1, z); moon.add(c);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, .22, 8, 32), plastic(COL.lgray)); rim.rotation.x = Math.PI / 2; rim.position.set(x, PLATE * 2 + .2, z); moon.add(rim);
  }
  moon.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; });
  const MOON_TOP = moonTop + PLATE * 2;

  // 绿色底板 + 发射台 + 警示条
  const bp = new THREE.Mesh(brickGeo(32, 24, .3), new THREE.MeshPhysicalMaterial({ color: '#4f9e3a', roughness: .55, clearcoat: .12, clearcoatRoughness: .5 }));
  bp.receiveShadow = bp.castShadow = true; scene.add(bp);
  const pad = plate(8, 8, COL.dgray); pad.position.set(PAD.x, TOP, PAD.z); scene.add(pad);
  for (let i = 0; i < 8; i++) { const s = plate(1, 1, i % 2 ? COL.black : COL.yellow, { tile: true }); s.position.set(PAD.x - 3.5 + i, PAD_TOP, PAD.z + 4.5); scene.add(s); }

  return { key, bulb, moon, MOON_TOP, lamp };
}

// 地面高度：底板范围内是底板顶，否则桌面
export const groundY = (x, z) => (Math.abs(x - PAD.x) < 4 && Math.abs(z - PAD.z) < 4) ? PAD_TOP : (Math.abs(x) < 16 && Math.abs(z) < 12) ? TOP : 0;
