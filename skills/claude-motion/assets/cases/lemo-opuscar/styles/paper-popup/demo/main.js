// 《小精灵冒险记》主程序：场景搭建 + 时间轴 + render(t)
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as L from './lib.js';
import { clamp, lerp, seg, ss, eio, eo, back, TAU, mulberry, track, env } from './lib.js';
import * as A from './art.js';
import { cv } from './paper.js';
import { makeBook, coverCanvases, texOf, BW, BD, PG } from './book.js';
import { pages, buildSets, buildSlats, updatePops, RISE, FOLD } from './sets.js';
import { makePip, makeCrumple, makeFold, makeWhale, makeBoat } from './actors.js';
import { cutMesh, particles, blobShadow } from './cutmesh.js';
import { makePost } from './post.js';
import { VO, BUB, DUR, OPEN, TURNS } from './story.js';
import * as HUD from './hud.js';

const W = 1920, H = 1080;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('stage').appendChild(renderer.domElement);
const ov = document.getElementById('ov'), OX = ov.getContext('2d');

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, W / H, .004, 30);
const post = makePost(renderer, scene, cam, W, H);

// ---------- 资源 ----------
const fontList = ['500 40px Fredoka', '600 40px Fredoka', '700 40px Fredoka', '40px "Lilita One"', '40px "IM Fell English"', 'italic 40px "IM Fell English"', '40px "ZCOOL KuaiLe"'];
await Promise.all(fontList.map(f => document.fonts.load(f, 'Aa小精灵')));
const DURS = await (await fetch('voices/dur.json')).json();
const hdr = await new RGBELoader().loadAsync('assets/lythwood_lounge_2k.hdr'); hdr.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = hdr; scene.background = hdr; scene.backgroundBlurriness = .22;
const ENV_YAW = parseFloat(new URLSearchParams(location.search).get('yaw') || '2.3');
scene.backgroundRotation.set(0, ENV_YAW, 0); scene.environmentRotation.set(0, ENV_YAW, 0);

const tl = new THREE.TextureLoader();
const wt = n => { const t = tl.load(`assets/walnut_${n}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.2, 1.4); t.anisotropy = 12; return t; };
const wdiff = wt('diff'); wdiff.colorSpace = THREE.SRGBColorSpace;
const desk = new THREE.Mesh(new THREE.BoxGeometry(2.6, .04, 1.7), new THREE.MeshStandardMaterial({ map: wdiff, normalMap: wt('nor'), roughnessMap: wt('rough'), color: '#c9a88a', envMapIntensity: .8 }));
desk.position.set(0, -.02, .25); desk.receiveShadow = true; scene.add(desk);

const gl = new GLTFLoader();
async function prop(name, x, z, s, ry) {
  const m = (await gl.loadAsync(`assets/${name}/${name}.gltf`)).scene;
  m.position.set(x, 0, z); m.scale.setScalar(s); m.rotation.y = ry;
  m.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  scene.add(m); return m;
}
const lamp = await prop('desk_lamp_arm_01', -.347, .51, .55, -.76);
lamp.traverse(o => { if (o.isMesh && o.material.name.includes('light')) { o.material = o.material.clone(); o.material.emissive = new THREE.Color('#ffd9a0'); o.material.emissiveIntensity = 6; } });
const plant = await prop('potted_plant_04', .5, -.02, 1, .4);
const tea = await prop('tea_set_01', 0, 0, 1, 0);
{ // 只留茶壶、一只杯子+碟子、糖罐，重新摆
  const keep = { tea_set_01_teapot_01: [.52, .2, .5], tea_set_01_teapot_01_lid: [.52, .2, .5], tea_set_01_cup_small_01: [.36, .5, 2.2], tea_set_01_saucer_circular_04: [.36, .5, 0], tea_set_01_sugar_cup_01: [.55, .42, 0], tea_set_01_sugar_cup_01_lid: [.55, .42, 0] };
  const dead = [];
  tea.traverse(o => { if (o.isMesh || o.name.startsWith('tea_set_01_')) { if (!o.name.startsWith('tea_set_01_')) return; const k = keep[o.name]; if (!k) dead.push(o); else { o.position.x = k[0]; o.position.z = k[1]; o.rotation.y = k[2]; } } });
  dead.forEach(o => o.parent.remove(o));
  tea.traverse(o => { if (o.name === 'tea_set_01_cup_small_01' || o.name === 'tea_set_01_teapot_01' || o.name === 'tea_set_01_sugar_cup_01') o.position.y += o.name.includes('cup_small') ? .012 : 0; });
}
const clock = await prop('alarm_clock_01', -.52, .18, 1.1, .9);
clock.traverse(o => { if (o.isMesh && o.material.name.includes('Glass')) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = .18; o.material.roughness = .05; o.castShadow = false; } });
// 铅笔（程序生成）
{
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.0038, .0038, .15, 6), new THREE.MeshStandardMaterial({ color: '#f2b632', roughness: .5 }));
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(.0038, .0008, .018, 6), new THREE.MeshStandardMaterial({ color: '#e8c79a', roughness: .8 }));
  const lead = new THREE.Mesh(new THREE.CylinderGeometry(.0008, .0001, .004, 6), new THREE.MeshStandardMaterial({ color: '#333', roughness: .4 }));
  const ferr = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .012, 12), new THREE.MeshStandardMaterial({ color: '#c9c2b0', metalness: 1, roughness: .3 }));
  const eras = new THREE.Mesh(new THREE.CylinderGeometry(.0039, .0039, .01, 12), new THREE.MeshStandardMaterial({ color: '#e88a8a', roughness: .9 }));
  wood.position.y = .084; lead.position.y = .095; ferr.position.y = -.081; eras.position.y = -.092;
  g.add(body, wood, lead, ferr, eras); g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.rotation.set(0, .5, Math.PI / 2); g.position.set(-.08, .0038, .5); scene.add(g);
}

// ---------- 书 ----------
const cover = coverCanvases((x, px, py, w, h) => { const c = cv(A.PIP_W, A.PIP_H); A.drawPip(c.getContext('2d'), { eyes: 'happy', mouth: 'open', armL: 1.9, armR: 1.9, flap: .8 }); x.drawImage(c, px, py, w, h); });
const book = makeBook(cover);
scene.add(book.root);
const P = pages(), PT = {}; for (const k in P) PT[k] = texOf(P[k]);
const SPREAD = [{ sky: PT.sky0, ground: PT.ground0 }, { sky: PT.sky1, ground: PT.ground1 }, { sky: PT.sky2night, ground: PT.ground2, skyLeaf: PT.sky2day }, { sky: PT.sky3, ground: PT.ground3 }];
const { L: POPS, ex: EX } = buildSets(book);
buildSlats(book, PT.sky2day, PT.sky2night, EX);

// ---------- 角色 ----------
const pip = makePip(); book.stage.add(pip.root); book.stage.add(pip.shadow);
const crumple = makeCrumple(); book.stage.add(crumple.root); book.stage.add(crumple.shadow);
const fold = makeFold(); book.stage.add(fold.root); book.stage.add(fold.shadow);
const whale = makeWhale(.1); book.stage.add(whale.root);
const boat = makeBoat(.062); book.stage.add(boat);

// ---------- 灯光 ----------
const lampHead = new THREE.Vector3(-.28, .375, .44);
const spot = new THREE.SpotLight('#fff0dc', 0, 3, .75, .55, 2); spot.position.copy(lampHead); spot.target.position.set(.02, 0, .2);
spot.castShadow = true; spot.shadow.mapSize.set(4096, 4096); spot.shadow.bias = -.00006; spot.shadow.normalBias = .0004; spot.shadow.radius = 5; spot.shadow.camera.near = .05; spot.shadow.camera.far = 2;
scene.add(spot, spot.target);
const bulb = new THREE.PointLight('#ffcf94', 0, .6, 2); bulb.position.copy(lampHead).add(new THREE.Vector3(0, -.02, 0)); scene.add(bulb);
const sun = new THREE.DirectionalLight('#fff3e0', 0); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.00008; sun.shadow.normalBias = .0003; sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -.3, right: .3, top: .3, bottom: -.3, near: .1, far: 3 }); sun.target.position.set(0, .05, .12); scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#cfe6ff', '#caa27a', 0); scene.add(hemi);

// ---------- 粒子 ----------
function spriteTex(fn, n = 64) { const c = cv(n, n), x = c.getContext('2d'); fn(x, n); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const glowTex = spriteTex((x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
const starTex = spriteTex((x, n) => { x.translate(n / 2, n / 2); x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? n * .1 : n * .48; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); const g = x.createRadialGradient(0, 0, 0, 0, 0, n * .3); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(-n / 2, -n / 2, n, n); }, 128);
const puffTex = spriteTex((x, n) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, g = x.createRadialGradient(n / 2 + Math.cos(a) * n * .15, n / 2 + Math.sin(a) * n * .15, 0, n / 2 + Math.cos(a) * n * .15, n / 2 + Math.sin(a) * n * .15, n * .3); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); } }, 128);
const quad = new THREE.PlaneGeometry(1, 1);
const addMat = (map, col) => new THREE.MeshBasicMaterial({ map, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: true });
const camQ = new THREE.Quaternion();
function billboard(fn) { return (i, t) => { const p = fn(i, t); if (p) { const e = new THREE.Euler().setFromQuaternion(camQ); p.rx = e.x; p.ry = e.y; p.rz = e.z + (p.spin || 0); } return p; }; }
const PS = [];
// 台灯光束里的灰尘（世界坐标）
PS.push(particles(quad, addMat(glowTex, new THREE.Color(1.2, 1.0, .75)), 90, billboard((i, t) => {
  const on = Math.max(seg(t, 0, 2) * (1 - seg(t, 13, 15)), seg(t, 104.8, 106)); if (on <= 0) return null;
  const R = mulberry(i * 7 + 1), u = R(), v = R(), w = R(), sp = .004 + R() * .006;
  const x = lerp(-.34, .1, u) + Math.sin(t * .3 + i) * .02, y = .02 + ((v * .38 + t * sp) % .38), z = lerp(.1, .6, w) + Math.cos(t * .23 + i) * .02;
  return { x, y, z, s: (.0016 + R() * .0022) * on * (.5 + .5 * Math.sin(t * 1.3 + i * 2)) };
})));
// 开书时的金色星光（book.stage 坐标）
const sparkleMat = addMat(starTex, new THREE.Color(2.4, 1.9, .9));
const sparkle = particles(quad, sparkleMat, 120, billboard((i, t) => {
  const R = mulberry(i * 13 + 5), t0 = OPEN[0] + .5 + R() * 2.6, life = 1.2 + R() * 1.2, k = (t - t0) / life; if (k < 0 || k > 1) return null;
  const x = lerp(-.2, .2, R()), z = lerp(.02, .28, R());
  return { x: x + Math.sin(k * 6 + i) * .01, y: k * (.08 + R() * .1), z, s: .006 * Math.sin(k * Math.PI) * (.5 + R()), spin: t * 2 + i };
}));
book.stage.add(sparkle); PS.push(sparkle);
// 抚平纸团时的小星星
const smooth = particles(quad, addMat(starTex, new THREE.Color(2.2, 2.0, 1.3)), 40, billboard((i, t) => {
  const R = mulberry(i * 3 + 9), t0 = 64.4 + R() * 1.9, life = .6 + R() * .4, k = (t - t0) / life; if (k < 0 || k > 1) return null;
  return { x: .075 + (R() - .5) * .05, y: .003 + k * .03, z: .15 + (R() - .5) * .02, s: .004 * Math.sin(k * Math.PI), spin: t * 3 };
}));
book.stage.add(smooth); PS.push(smooth);
// 萤火虫（傍晚的纸片谷）
const ffly = particles(quad, addMat(glowTex, new THREE.Color(2.2, 2.4, .8)), 18, billboard((i, t) => {
  const on = seg(t, 37, 39) * (1 - seg(t, 48.4, 48.9)); if (on <= 0) return null;
  const R = mulberry(i * 5 + 3);
  return { x: lerp(-.18, .2, R()) + Math.sin(t * .7 + i) * .012, y: .01 + R() * .05 + Math.sin(t * 1.1 + i * 3) * .006, z: lerp(.1, .24, R()), s: .005 * on * (.5 + .5 * Math.sin(t * 3 + i)) };
}));
book.stage.add(ffly); PS.push(ffly);
// 飘落的叶子（森林）
const leafIts = ['#e8a33a', '#c9612e', '#f2c14e', '#7fbf4f'].map(c => A.leafBit(c));
const leafMats = leafIts.map(it => cutMesh(it).userData.front.material);
for (let li = 0; li < 4; li++) {
  const lp = particles(new THREE.PlaneGeometry(.006, .004), leafMats[li], 6, (i, t) => {
    const on = seg(t, TURNS[0][1] - .2, TURNS[0][1] + .5) * (1 - seg(t, TURNS[1][0], TURNS[1][0] + .3)); if (on <= 0) return null;
    const R = mulberry(li * 50 + i * 7), per = 5 + R() * 3, k = ((t + R() * per) % per) / per;
    return { x: lerp(-.21, .21, R()) + Math.sin(k * 9 + i) * .012, y: .13 * (1 - k), z: lerp(.06, .25, R()), rx: Math.sin(k * 7) * .8, ry: k * 5, rz: Math.sin(k * 11) * 1.2, s: on };
  });
  lp.castShadow = true; book.stage.add(lp); PS.push(lp);
}
// 彩纸（鲸鱼喷水）
const confCols = ['#ff5a5a', '#ffd23f', '#5ac8ff', '#7ee07a', '#ff8fd0', '#ffffff'];
const confMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .8 });
const conf = particles(new THREE.PlaneGeometry(.0026, .0017), confMat, 90, (i, t) => {
  const R = mulberry(i * 11 + 2), t0 = 79.0 + R() * 1.6, life = 1.3 + R() * .6, k = (t - t0) / life; if (k < 0 || k > 1) return null;
  const vx = (R() - .5) * .06, vy = .09 + R() * .06, vz = (R() - .5) * .03, g = .16, tt = k * life;
  return { x: WHALE_X - .007 + vx * tt, y: WHALE_TOP() + vy * tt - g * tt * tt, z: .052 + vz * tt, rx: tt * 9 + i, ry: tt * 7, rz: tt * 5, s: 1, col: new THREE.Color(confCols[i % confCols.length]) };
});
conf.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(90 * 3).fill(1), 3);
book.stage.add(conf); PS.push(conf);
// 踩踏星星
const stompStars = particles(new THREE.PlaneGeometry(.007, .007), cutMesh(A.star(.004)).userData.front.material, 16, (i, t) => {
  const t0 = i < 8 ? 61.55 : 62.15, k = (t - t0) / .7; if (k < 0 || k > 1) return null;
  const a = (i % 8) / 8 * TAU + .3, r = .035 * eo(k);
  return { x: .075 + Math.cos(a) * r, y: .03 + Math.sin(a) * r * .8 - k * k * .02, z: .152, rz: k * 6, s: 1 - k * .5 };
});
book.stage.add(stompStars); PS.push(stompStars);
// 白烟（变身 / 落地）
const puffMat = new THREE.MeshBasicMaterial({ map: puffTex, transparent: true, depthWrite: false, color: '#fffaf0' });
const PUFFS = [[66.2, .075, .006, .15, 1.2], [21.42, -.115, 0, .15, .5], [62.7, .03, 0, .15, .45], [110.45, .2, -PG, .52, .6], [111.0, .215, -PG, .53, .4], [104.28, .0, .05, .33, .6]];
const puffs = particles(quad, puffMat, PUFFS.length * 7, billboard((i, t) => {
  const P0 = PUFFS[(i / 7) | 0], j = i % 7, k = (t - P0[0]) / .55; if (k < 0 || k > 1) return null;
  const a = j / 7 * TAU, r = .012 * P0[4] * eo(k);
  return { x: P0[1] + Math.cos(a) * r, y: P0[2] + .004 * P0[4] + Math.abs(Math.sin(a)) * r * .6, z: P0[3] + Math.sin(a) * r * .3, s: .012 * P0[4] * (.6 + k) * (1 - k * k) };
}));
book.stage.add(puffs); PS.push(puffs);

// ---------- 鲸鱼 ----------
const WHALE_X = .0;
function whaleY(t) { return lerp(-.06, .006, back(seg(t, 78.2, 78.9), 1.4)) - ss(seg(t, 81.3, 82.2)) * .05; }
function WHALE_TOP() { return whaleY(Tnow) + whale.h * (1 - 178 / 800); }
let Tnow = 0;

// ---------- 皮普编舞 ----------
// 走路段：返回位置与步相
function walk(t, t0, t1, a, b) {
  const k = eio(seg(t, t0, t1)) * .0 + seg(t, t0, t1), kk = ss(seg(t, t0, t0 + .25)) * 0 + k;
  const x = lerp(a[0], b[0], kk), z = lerp(a[1], b[1], kk), dist = Math.hypot(b[0] - a[0], b[1] - a[1]) * kk;
  return { x, z, ph: dist / .018 * TAU, moving: t > t0 && t < t1 };
}
function arc(t, t0, t1, a, b, h) { const k = seg(t, t0, t1); return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k) + 4 * h * k * (1 - k), z: lerp(a[2], b[2], k) }; }
const blinkAt = t => { const p = t % 3.7; return p < .12 ? Math.sin(p / .12 * Math.PI) : 0; };

function pipState(t) {
  const S = { vis: true, x: 0, y: 0, z: .15, face: 1, sy: 1, sx: 1, pose: { armL: .25, armR: .25, mouth: 'smile', blink: blinkAt(t) }, gy: 0, onBoat: false, rotY: 0, scale: 1 };
  const P = S.pose, bob = (amp = .0006) => { S.y += Math.abs(Math.sin(t * 2.2)) * amp; };
  const land = (t0, d = .18, amt = .25) => { const k = seg(t, t0, t0 + d); if (k > 0 && k < 1) { const s = Math.sin(k * Math.PI) * amt; S.sy *= 1 - s; S.sx *= 1 + s * .7; } };
  const crouch = (t0, d = .15, amt = .2) => { const k = seg(t, t0 - d, t0); if (k > 0 && k < 1) { S.sy *= 1 - amt * k; S.sx *= 1 + amt * .6 * k; } };
  const walking = w => { if (w.moving) { P.walk = w.ph; P.stride = 1; S.y += Math.abs(Math.sin(w.ph)) * .0012; P.armL = .25 + Math.sin(w.ph) * .5; P.armR = .25 - Math.sin(w.ph) * .5; P.flap = .3; } };
  // ---- 第一幕：纸片谷 ----
  if (t < 20.62) { S.vis = false; return S; }
  if (t < 48.9) {
    if (t < 21.42) { // 从门里蹦出来
      const a = arc(t, 20.62, 21.42, [-.13, .004, .0862], [-.115, 0, .15], .03); S.x = a.x; S.y = a.y; S.z = a.z;
      S.scale = lerp(.55, 1, eo(seg(t, 20.62, 20.9))); S.face = Math.cos(seg(t, 20.62, 21.42) * TAU * 2); P.eyes = 'happy'; P.mouth = 'open'; P.armL = P.armR = 1.6; P.flap = 1;
      return S;
    }
    S.x = -.115; S.z = .15; land(21.42);
    if (t < 22.4) { bob(); }
    else if (t < 25.6) { // 早上好！
      P.mouth = 'open'; P.eyes = 'happy'; P.armL = P.armR = 2.3 + Math.sin(t * 10) * .15; P.flap = .5 + .5 * Math.sin(t * 14);
      for (const h0 of [22.55, 23.25]) { const k = seg(t, h0, h0 + .38); if (k > 0 && k < 1) S.y += 4 * .008 * k * (1 - k); land(h0 + .38, .15, .15); }
    }
    else if (t < 31.2) { const w = walk(t, 26.2, 31.0, [-.115, .15], [.035, .16]); S.x = w.x; S.z = w.z; walking(w); if (!w.moving) bob(); }
    else if (t < 35) { S.x = .035; S.z = .16; P.look = [.8, .5]; P.eyes = (t > 32 && t < 34.6) ? 'happy' : 'open'; bob(); }
    else if (t < 39.2) { S.x = .035; S.z = .16; P.look = [.3, -.4]; bob(.0003); }
    else if (t < 43.6) { // 另一盏灯亮了：转向镜头
      S.x = .035; S.z = .16; P.eyes = 'wide'; P.mouth = 'o'; P.look = [-.2, -.7]; P.flap = .2 * Math.sin(t * 6); S.y += .001 * ss(seg(t, 39.2, 40));
    }
    else if (t < 48.6) { // 我要去找它！
      S.x = .035; S.z = .16; P.mouth = t > 45.2 && t < 48.2 ? 'grin' : 'determined'; P.eyes = 'open'; P.armR = lerp(.25, 2.6, ss(seg(t, 43.8, 44.2))); P.armL = .1;
      const k = seg(t, 46.7, 47.15); if (k > 0 && k < 1) S.y += 4 * .01 * k * (1 - k); land(47.15, .15, .18);
      if (t > 47.8) { S.face = Math.cos(seg(t, 47.8, 48.1) * Math.PI * 0); }
    }
    S.scale = 1 - ss(seg(t, 48.6, 48.9));
    return S;
  }
  // ---- 第二幕：森林 ----
  if (t < 51.8) { S.vis = false; return S; }
  if (t < 71.9) {
    S.scale = eo(seg(t, 51.8, 52.1)) * (1 - ss(seg(t, 71.6, 71.9)));
    if (t < 57.2) { const w = walk(t, 51.8, 56.9, [-.21, .15], [.0, .15]); S.x = w.x; S.z = w.z; walking(w); if (!w.moving) bob(); P.look = t > 56.7 ? [.8, 0] : [0, 0]; }
    else if (t < 60.8) { // 被拦住
      S.x = .0; S.z = .15; P.eyes = 'wide'; P.mouth = t < 58.5 ? 'o' : 'worried'; P.look = [.8, .1];
      const k = seg(t, 57.3, 57.65); if (k > 0 && k < 1) { S.y += 4 * .007 * k * (1 - k); S.x -= .006 * k; } if (t >= 57.65) S.x -= .006; land(57.65, .12, .15);
    }
    else if (t < 62.75) { // 两次踩踏
      crouch(61.0, .2, .25); P.mouth = 'grin'; P.eyes = 'open'; P.armL = P.armR = 1.2; P.flap = 1;
      if (t < 61.0) { S.x = -.006; }
      else if (t < 61.55) { const a = arc(t, 61.0, 61.55, [-.006, 0, .15], [.072, .03, .151], .035); S.x = a.x; S.y = a.y; S.z = a.z; }
      else if (t < 62.15) { const a = arc(t, 61.55, 62.15, [.072, .03, .151], [.074, .012, .151], .03); S.x = a.x; S.y = a.y; S.z = a.z; land(61.55, .1, .3); }
      else { const a = arc(t, 62.15, 62.75, [.074, .012, .151], [.03, 0, .15], .025); S.x = a.x; S.y = a.y; S.z = a.z; land(62.15, .1, .3); P.eyes = 'happy'; }
    }
    else if (t < 66.2) { // 走过去，抚平
      land(62.75, .15, .2);
      const w = walk(t, 63.6, 64.3, [.03, .15], [.05, .153]); S.x = w.x; S.z = w.z; walking(w);
      if (t > 64.4) { P.armR = 1.4 + Math.sin(t * 16) * .5; P.armL = .9 + Math.sin(t * 16 + 1) * .4; P.eyes = 'happy'; P.mouth = 'smile'; }
    }
    else { // 折折诞生
      S.x = .05; S.z = .153; P.eyes = t > 66.5 ? 'wide' : 'happy'; P.mouth = t > 66.5 ? 'open' : 'smile';
      if (t > 67.5) { P.look = [Math.sin(t * 5) * .6, -.5]; P.eyes = 'happy'; P.armL = P.armR = 2.0; }
      const k = seg(t, 69.0, 69.4); if (k > 0 && k < 1) S.y += 4 * .01 * k * (1 - k); land(69.4, .15, .2);
    }
    return S;
  }
  // ---- 第三幕：海（皮普在船上） ----
  if (t < 74.4) { S.vis = false; return S; }
  if (t < 87.0) {
    S.onBoat = true; S.scale = 1 - ss(seg(t, 86.7, 87.0));
    P.flap = .2; P.armL = .3; P.armR = .3;
    if (t > 79.3 && t < 81.2) { P.armR = 2.4 + Math.sin(t * 12) * .4; P.eyes = 'happy'; P.mouth = 'open'; }
    if (t > 82.0) { P.look = [-.2, -.8]; P.eyes = t > 83 ? 'open' : 'wide'; P.mouth = 'o'; }
    return S;
  }
  // ---- 第四幕：最后一页 ----
  if (t < 89.8) { S.vis = false; return S; }
  if (t < 104.3) {
    S.scale = eo(seg(t, 89.8, 90.1));
    if (t < 96.3) {
      let w = walk(t, 90.0, 94.4, [-.2, .15], [-.02, .19]);
      if (t > 94.4) w = walk(t, 94.6, 96.2, [-.02, .19], [0, .284]);
      S.x = w.x; S.z = w.z; walking(w); if (!w.moving) bob();
      P.look = [.4, 0]; P.mouth = t > 92 ? 'smile' : 'o';
    } else if (t < 103.3) {
      S.x = 0; S.z = .284; P.look = [0, .9]; P.eyes = 'wide'; P.mouth = 'worried';
      if (t > 97.8 && t < 101.3) S.x += Math.sin(t * 40) * .0003;
      if (t > 101.1) { const w = walk(t, 101.4, 102.3, [0, .284], [0, .25]); S.z = w.z; walking(w); P.mouth = 'determined'; P.eyes = 'open'; }
    } else if (t < 103.95) { const w = walk(t, 103.3, 103.95, [0, .25], [0, .296]); S.z = w.z; S.x = 0; walking(w); P.mouth = 'grin'; P.flap = 1; }
    else { const a = arc(t, 103.95, 104.3, [0, 0, .296], [0, .02, .33], .025); S.x = a.x; S.y = a.y; S.z = a.z; P.mouth = 'open'; P.eyes = 'happy'; P.armL = P.armR = 2.2; P.flap = 1; }
    return S;
  }
  // ---- 飞出书本：骑在折折身上 ----
  if (t < 111.0) { S.riding = true; P.mouth = 'open'; P.eyes = 'happy'; P.armL = P.armR = 2.0 + Math.sin(t * 8) * .3; P.flap = .6; if (t > 110.45) { const a = arc(t, 110.45, 111.0, [0, 0, 0], [0, 0, 0], .01); } return S; }
  // ---- 真实世界 ----
  S.x = .215; S.z = .53; S.gy = -PG; S.y = -PG; land(111.0, .2, .3);
  if (t < 111.0) { }
  if (t < 113.2) { S.face = t < 111.6 ? 1 : t < 112.3 ? Math.cos(seg(t, 111.6, 111.75) * Math.PI) : Math.cos(Math.PI + seg(t, 112.3, 112.45) * Math.PI); P.eyes = 'wide'; P.mouth = 'o'; P.look = t > 112.6 ? [-.5, -.9] : [0, 0]; }
  else if (t < 118.6) { P.look = [-.6, -.9]; P.eyes = 'wide'; P.mouth = t > 115 ? 'smile' : 'o'; if (t > 116.2) { P.look = [0, -.2]; P.eyes = 'open'; } }
  else { P.look = [0, -.15]; P.eyes = t > 121.5 ? 'happy' : 'open'; P.mouth = 'open'; P.armR = 2.4 + Math.sin(t * 9) * .45; P.armL = .3; P.flap = .4 + .4 * Math.sin(t * 7);
    const k = seg(t, 121.0, 121.4); if (k > 0 && k < 1) S.y += 4 * .008 * k * (1 - k); land(121.4, .15, .18); }
  return S;
}

// ---------- 皱皱编舞 ----------
function crumpleState(t) {
  const S = { vis: false, x: .26, spin: 0, sy: 1, sx: 1, pose: { mood: 'angry', blink: blinkAt(t + 1.3), mouthOpen: 0 } };
  if (t < 56.5 || t > 66.3) return S;
  S.vis = true;
  const k = eo(seg(t, 56.6, 57.7)); S.x = lerp(.26, .075, k); S.spin = (S.x - .26) / .021;
  S.spin += Math.sin(seg(t, 57.6, 58.2) * Math.PI * 3) * .12 * (1 - seg(t, 57.6, 58.2));
  if (t > 57.8 && t < 60.2) S.pose.mouthOpen = Math.abs(Math.sin((t - 57.8) * 14)) * .9;
  const hit = (t0, amt) => { const q = seg(t, t0, t0 + .3); if (q > 0 && q < 1) { const s = Math.sin(q * Math.PI) * amt; S.sy *= 1 - s; S.sx *= 1 + s * .6; } };
  hit(61.55, .35);
  if (t > 62.15) { const q = eo(seg(t, 62.15, 62.3)); S.sy *= lerp(1, .28, q); S.sx *= lerp(1, 1.35, q); S.pose.mood = 'dizzy'; S.spin = Math.sin(t * 3) * .05; }
  if (t > 64.4) { S.sy *= lerp(1, .5, seg(t, 64.4, 66.1)); S.sx *= lerp(1, 1.15, seg(t, 64.4, 66.1)); S.pose.mood = t > 65.3 ? 'calm' : 'dizzy'; }
  if (t > 66.2) S.vis = false;
  return S;
}
// ---------- 折折飞行路径 ----------
function foldState(t) {
  const S = { vis: false, f: 1, pos: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0, face: 'happy', gy: 0 };
  if (t < 66.2) return S;
  S.vis = true;
  if (t < 71.9) {
    if (t < 67.5) { S.f = ss(seg(t, 66.55, 67.3)); S.pos.set(.075, .0012 + .012 * ss(seg(t, 66.8, 67.5)), .152); S.face = t > 67.35 ? 'happy' : 'sleep'; S.yaw = 0; S.roll = 0; }
    else if (t < 68.7) { const k = seg(t, 67.5, 68.7), a = k * TAU; S.pos.set(.05 + Math.sin(a) * .035, .013 + .02 * Math.sin(k * Math.PI), .152 + Math.cos(a) * .03 - .03); S.yaw = -a + Math.PI / 2 * 0; S.roll = -.5 * Math.sin(k * Math.PI); }
    else { S.pos.set(.085, .03 + Math.sin(t * 2.5) * .003, .16); S.yaw = Math.PI; S.roll = Math.sin(t * 2) * .1; }
    const sc = 1 - ss(seg(t, 71.6, 71.9)); S.scale = sc; return S;
  }
  if (t < 74.6) { S.vis = false; return S; }
  if (t < 87.0) { const bx = boatX(t); const a = t * 1.3; S.pos.set(bx + Math.cos(a) * .035, .055 + Math.sin(t * 2.1) * .006, .135 + Math.sin(a) * .02); S.yaw = -a - Math.PI / 2; S.roll = -.35; S.scale = eo(seg(t, 74.6, 75.0)) * (1 - ss(seg(t, 86.7, 87.0))); return S; }
  if (t < 89.8) { S.vis = false; return S; }
  if (t < 103.9) { S.scale = eo(seg(t, 89.8, 90.2)); const px = lerp(-.24, -.06, eo(seg(t, 90.0, 96.0))); S.pos.set(px, lerp(.035, .05, seg(t, 94, 97)) + Math.sin(t * 2.3) * .003, lerp(.12, .34, seg(t, 90, 97))); S.yaw = t < 96.2 ? 0 : -Math.PI / 2 + .6; S.roll = Math.sin(t * 2) * .1; return S; }
  // 俯冲接住皮普，飞出书本 → 降落在桌上
  const PATH = FLIGHT;
  const p = PATH.at(t), q = PATH.at(t + .02);
  S.pos.copy(p); const d = q.clone().sub(p); S.yaw = Math.atan2(-d.z, d.x); S.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) * .8; S.roll = PATH.roll(t);
  if (t > 110.45) { S.pos.copy(PATH.at(110.45)); const k = seg(t, 110.45, 110.9); S.pos.x += .018 * eo(k); S.pitch = 0; S.yaw = PATH.yawEnd; S.roll = 0; }
  S.gy = -PG;
  return S;
}
// 飞行关键点（stage 坐标；桌面 y=-PG）
const FLIGHT = (() => {
  const K = [[103.9, [-.06, .05, .34]], [104.28, [.0, .012, .325]], [104.8, [.0, .02, .42]], [106.2, [.16, .12, .72]], [107.6, [.42, .15, .6]], [108.9, [.36, .08, .38]], [110.0, [.22, .01, .47]], [110.45, [.19, -PG + .002, .52]]];
  const tr = track(K.map(k => [k[0], k[1]]));
  return { at: t => new THREE.Vector3(...tr(t)), roll: t => Math.sin(seg(t, 104.8, 110.4) * Math.PI * 2) * .5, yawEnd: .05 };
})();
function boatX(t) { return lerp(-.13, .11, seg(t, 74.6, 87.0)); }

// ---------- 摄像机 ----------
// [t, px,py,pz, tx,ty,tz, fov, aper]；CUT 之间独立插值（世界坐标）
const SH = [
  [
    [0.0, .5, .2, 1.12, -.08, .12, .2, 34, 3.0],
    [4.5, .34, .3, .98, -.04, .08, .18, 32, 3.0],
    [7.5, .18, .42, .78, .0, .02, .14, 30, 3.2],
    [9.8, .08, .4, .7, .0, .03, .14, 30, 3],
    [12.4, .0, .27, .78, .0, .1, .1, 30, 2.6],
    [15.0, -.02, .105, .56, -.02, .085, .1, 30, 2.2],
    [17.0, -.05, .08, .46, -.06, .06, .1, 30, 2.2],
    [20.0, -.105, .052, .34, -.12, .04, .12, 30, 2.4],
    [25.2, -.1, .05, .33, -.11, .036, .14, 30, 2.4],
    [28.5, -.02, .07, .40, .0, .06, .12, 30, 2.2],
    [30.2, .04, .08, .42, .05, .085, .08, 30, 2.2],
    [32.6, .08, .055, .36, .09, .035, .13, 30, 2.4],
    [35.0, .06, .06, .39, .07, .05, .12, 30, 2.2],
    [39.0, .05, .055, .36, .05, .05, .12, 30, 2.3],
    [42.0, .045, .045, .28, .04, .04, .15, 30, 2.5],
    [46.5, .045, .047, .29, .04, .038, .15, 30, 2.5],
    [48.6, .02, .1, .52, .0, .07, .1, 30, 2],
    [50.0, .0, .13, .6, .0, .08, .1, 30, 1.8],
    [51.4, -.12, .07, .42, -.13, .05, .12, 30, 2.2],
    [54.5, -.07, .055, .38, -.07, .042, .13, 30, 2.3],
    [57.0, .03, .055, .38, .03, .04, .13, 30, 2.3],
    [61.0, .035, .06, .37, .035, .045, .13, 30, 2.3],
    [63.5, .05, .05, .31, .05, .035, .14, 30, 2.5],
    [67.5, .05, .06, .34, .05, .05, .13, 30, 2.4],
    [70.5, .05, .06, .36, .05, .05, .13, 30, 2.4],
    [71.6, .02, .1, .52, .0, .07, .1, 30, 2],
    [73.0, .0, .13, .6, .0, .08, .1, 30, 1.8],
    [74.4, -.1, .1, .44, -.1, .035, .13, 30, 2.2],
    [77.5, -.05, .1, .44, -.05, .035, .13, 30, 2.2],
    [79.0, -.02, .1, .46, -.01, .04, .1, 30, 2.2],
    [81.8, .0, .11, .5, .0, .09, .08, 30, 2],
    [84.5, .06, .1, .43, .06, .04, .13, 30, 2.2],
    [86.8, .02, .1, .52, .0, .07, .1, 30, 2],
    [88.2, .0, .13, .6, .0, .08, .1, 30, 1.8],
    [89.6, -.08, .08, .46, -.08, .05, .12, 30, 2.2],
    [93.0, -.03, .09, .46, -.02, .03, .18, 30, 2.2],
    [96.4, .0, .1, .5, .0, .02, .22, 30, 2.2],
  ],
  [ // 反打：从皮普身后望向真实世界
    [96.4, .05, .03, .185, -.1, .15, .5, 56, 2.6, .11],
    [99.5, .048, .029, .19, -.11, .16, .5, 56, 2.6, .105],
    [103.2, .046, .03, .195, -.1, .15, .5, 56, 2.6, .1],
    [104.8, .04, .035, .2, -.06, .12, .6, 56, 2.6, .15],
  ],
  [ // 正面大全：飞出书本、降落
    [104.8, .38, .22, 1.08, .04, .07, .36, 32, 3],
    [106.5, .44, .2, 1.02, .2, .09, .55, 32, 3],
    [108.2, .46, .15, .92, .3, .05, .5, 32, 3.2],
    [110.4, .33, .06, .76, .2, .01, .52, 32, 3.6],
    [112.0, .27, .036, .66, .205, .016, .525, 30, 4],
    [116.5, .245, .03, .63, .205, .02, .525, 30, 4],
    [120.0, .235, .028, .61, .205, .02, .525, 30, 4],
    [123.4, .24, .05, .66, .19, .03, .5, 30, 3.8],
    [128.0, .32, .2, .98, .12, .06, .4, 32, 3.2],
    [133.0, .34, .25, 1.05, .12, .07, .4, 32, 3.2],
  ],
];
const SHOTS = SH.map(keys => ({ t0: keys[0][0], t1: keys[keys.length - 1][0], f: track(keys.map(k => [k[0], [...k.slice(1, 9), k[9] || 0]])) }));
function camAt(t) {
  let s = SHOTS[0]; for (const S of SHOTS) if (t >= S.t0) s = S;
  const v = s.f(t);
  return { pos: new THREE.Vector3(v[0], v[1], v[2]), tgt: new THREE.Vector3(v[3], v[4], v[5]), fov: v[6], aper: v[7], focus: v[8] };
}

// ---------- 灯光时间轴 ----------
function lightsAt(t) {
  const inStory = seg(t, OPEN[0] + .4, OPEN[1] + 1.5) * (1 - seg(t, 103.6, 105.2));
  const real = 1 - inStory;
  // 故事里的"纸太阳"
  const dusk = seg(t, 34.6, 37.5) * (1 - seg(t, TURNS[0][0], TURNS[0][1]));
  const night = seg(t, 81.8, 83.6) * (1 - seg(t, TURNS[2][0] + .5, TURNS[2][1]));
  const lastPage = seg(t, TURNS[2][0] + .5, TURNS[2][1]);
  const sunI = inStory * (2.6 - dusk * 1.6 - night * 1.9 - lastPage * .6);
  const sunCol = new THREE.Color('#fff3e0').lerp(new THREE.Color('#ffae6b'), dusk).lerp(new THREE.Color('#9fb4ff'), night);
  // 台灯：真实世界主光；故事里傍晚"另一盏灯亮了"时亮起
  const lampOn = seg(t, 39.2, 40.4) * (1 - seg(t, TURNS[0][0], TURNS[0][1]));
  const lampI = real * 1.0 + inStory * (.12 + lampOn * 1.1 + lastPage * .5);
  return { sunI, sunCol, lampI, hemiI: .15 + inStory * (.55 - dusk * .25 - night * .35), envI: .42 * real + inStory * (.35 - night * .2), exposure: 1 - dusk * .08 };
}

// ---------- 音效事件（给 mix.py） ----------
const EV = [];
EV.push({ t: OPEN[0], type: 'creak' }, { t: OPEN[1] - .2, type: 'thump' }, { t: OPEN[0] + .6, type: 'sparkle', d: 2.8 });
for (const r of POPS) { const t0 = RISE[r.spread] + r.d; EV.push({ t: t0 + .1, type: 'pop', s: r.spread }); }
for (const [a, b] of TURNS) EV.push({ t: a + .45, type: 'page', d: b - a - .7 });
EV.push({ t: 20.42, type: 'door' }, { t: 20.66, type: 'boing' }, { t: 21.42, type: 'land' }, { t: 22.55, type: 'hop' }, { t: 23.25, type: 'hop' }, { t: 46.7, type: 'hop' });
EV.push({ t: 56.6, type: 'roll', d: 1.1 }, { t: 57.3, type: 'bang' }, { t: 61.0, type: 'boing' }, { t: 61.55, type: 'stomp' }, { t: 62.15, type: 'stomp2' }, { t: 61.55, type: 'nice' }, { t: 62.15, type: 'great' });
EV.push({ t: 64.4, type: 'sparkle', d: 1.8 }, { t: 66.2, type: 'poof' }, { t: 66.55, type: 'fold', d: .75 }, { t: 67.5, type: 'whoosh' }, { t: 69.0, type: 'hop' });
EV.push({ t: 78.2, type: 'splash' }, { t: 79.0, type: 'spout', d: 1.8 }, { t: 81.3, type: 'splash' });
for (let i = 0; i < 4; i++) EV.push({ t: 81.8 + i * .28 + .3, type: 'clack' });
for (let i = 0; i < 9; i++) EV.push({ t: 82.4 + i * .12 + .5, type: 'tink' });
EV.push({ t: 39.3, type: 'lampon' }, { t: 103.95, type: 'boing' }, { t: 104.25, type: 'whoosh' }, { t: 106.0, type: 'whoosh' }, { t: 110.45, type: 'skid' }, { t: 111.0, type: 'land' }, { t: 121.0, type: 'hop' });
for (const e of HUD.blipTimes()) EV.push(e);
// 走路脚步：按步相过零点
{ let prev = 0; for (let f = 0; f < DUR * 60; f++) { const t = f / 60, s = pipState(t); const ph = s.pose.walk || 0; if (s.vis && s.pose.stride && Math.floor(ph / Math.PI) !== Math.floor(prev / Math.PI)) EV.push({ t, type: 'step' }); prev = ph; } }
EV.sort((a, b) => a.t - b.t);
window.EV = EV; window.DUR = DUR;

// ---------- 渲染 ----------
const tmpV = new THREE.Vector3();
function toScreen(v) { const p = v.clone().project(cam); if (p.z > 1) return null; return [(p.x * .5 + .5) * W, (-p.y * .5 + .5) * H]; }

window.render = function (t) {
  Tnow = t;
  // 书
  const op = eio(seg(t, OPEN[0], OPEN[1])), wob = t > OPEN[0] - .8 && t < OPEN[0] ? Math.sin(t * 60) * .004 * seg(t, OPEN[0] - .8, OPEN[0]) : 0;
  book.setOpen(Math.PI / 2 * op + wob + Math.sin(seg(t, OPEN[1] - .2, OPEN[1] + .5) * Math.PI) * -.03);
  let spread = 0; for (let i = 0; i < 3; i++) if (t >= TURNS[i][0] + .45) spread = i + 1;
  let turning = -1; for (let i = 0; i < 3; i++) if (t >= TURNS[i][0] + .45 && t < TURNS[i][1] - .3) turning = i;
  book.groundMat.map = SPREAD[spread].ground; book.groundMat.needsUpdate = true;
  const skyIdx = turning >= 0 ? turning : spread; book.backMat.map = SPREAD[skyIdx].sky; book.backMat.needsUpdate = true;
  if (turning >= 0) {
    const a = TURNS[turning][0] + .45, b = TURNS[turning][1] - .3;
    book.leafFront.material.map = SPREAD[turning].ground; book.leafBack.material.map = SPREAD[turning + 1].skyLeaf || SPREAD[turning + 1].sky;
    book.leafFront.material.emissiveMap = book.leafFront.material.map; book.leafBack.material.emissiveMap = book.leafBack.material.map;
    book.leafFront.material.needsUpdate = book.leafBack.material.needsUpdate = true;
    book.setLeaf(eio(seg(t, a, b)));
  } else book.setLeaf(0);
  // 封面没打开时，页面不必显示道具
  updatePops(POPS, t);
  // 纸片谷机关
  const s0vis = t > RISE[0] && t < FOLD[0] + 1;
  EX.sun.visible = s0vis; EX.sun.position.y = lerp(-.12, -.004, back(seg(t, 15.3, 18.0), 1.2)) - ss(seg(t, 34.6, 37.6)) * .11 + Math.sin(seg(t, 29.3, 30.3) * Math.PI) * .006;
  EX.sun.children[0].rotation.z = Math.sin(t * 1.2) * .03;
  EX.door.rotation.y = -1.9 * back(seg(t, 20.3, 20.7), 1.5) * (1 - ss(seg(t, 22.0, 22.6)) * .95);
  EX.win.material.opacity = ss(seg(t, 36.0, 37.5)) * (t < FOLD[0] ? 1 : 0);
  for (const c of EX.clouds) { c.g.visible = s0vis && t > 14; c.g.position.y = c.y + (1 - L.spring(t - 15.6 - c.ph * .01, 4, .4)) * .16 + Math.sin(t * .8 + c.ph) * .002; c.g.position.y += ss(seg(t, FOLD[0], FOLD[0] + .5)) * .2; c.g.rotation.z = Math.sin(t * .9 + c.ph) * .02; }
  const swish = [32.02, 33.0, 33.88];
  EX.river.forEach((r, k) => { let dx = Math.sin(t * 2.6 + k * 2.1) * .003; for (const s of swish) dx += Math.sin(seg(t, s - .1, s + .5) * Math.PI) * .012 * (k % 2 ? -1 : 1); r.m.position.x = dx; });
  // 海
  EX.waves.forEach((r, k) => { r.m.position.x = Math.sin(t * 1.7 + k * 1.3) * .008 * (k % 2 ? -1 : 1); r.m.position.y = Math.sin(t * 2.3 + k) * .0012; });
  const s2vis = t > RISE[2] && t < FOLD[2] + .6;
  EX.slats.forEach((g, i) => { g.visible = s2vis && t > TURNS[1][1] - .3; g.rotation.y = Math.PI * eio(seg(t, 81.8 + i * .28, 82.5 + i * .28)); });
  EX.moon.visible = s2vis; EX.moon.position.y = .4 - L.spring(t - 82.4, 4, .45) * (t > 82.4 ? .2 : 0) + Math.sin(t) * .002 + ss(seg(t, FOLD[2], FOLD[2] + .5)) * .25;
  for (const s of EX.stars) { s.g.visible = s2vis; const k = t - 82.5 - s.d; s.g.position.y = .4 - (k > 0 ? L.spring(k, 5, .4) * (.4 - s.y) : 0) + ss(seg(t, FOLD[2], FOLD[2] + .5)) * .25; s.g.rotation.z = Math.sin(t * 1.5 + s.ph) * .08; }
  whale.root.visible = t > 78 && t < 82.3; whale.root.position.set(WHALE_X, whaleY(t), .052); whale.setHappy(t > 79.2); whale.root.rotation.z = Math.sin(t * 2) * .03;
  boat.visible = t > TURNS[1][1] - .2 && t < FOLD[2] + .4;
  const bx = boatX(t), by = lerp(-.04, -.006, back(seg(t, 74.4, 75.1), 1.4)) - ss(seg(t, 86.6, 87.1)) * .05 + Math.sin(t * 2.3) * .0015;
  boat.position.set(bx, by, .14); boat.rotation.z = Math.sin(t * 1.9) * .06;

  // 皮普
  const ps = pipState(t);
  pip.root.visible = ps.vis; pip.shadow.visible = ps.vis;
  if (ps.vis) {
    pip.pose(ps.pose);
    let px = ps.x, py = ps.y, pz = ps.z;
    if (ps.onBoat) { px = bx + .008; py = by + .062 * .62 * .5; pz = .1395; pip.root.rotation.z = boat.rotation.z; }
    else pip.root.rotation.z = 0;
    const fs = foldState(t);
    if (ps.riding) { const fp = fs.pos; px = fp.x - .004; py = fp.y + .004; pz = fp.z; }
    pip.root.position.set(px, py, pz);
    pip.body.scale.set(ps.sx * ps.face * ps.scale, ps.sy * ps.scale, ps.scale);
    // 骑飞机时面向镜头
    if (ps.riding) { const c = camAt(t).pos; pip.root.rotation.y = Math.atan2(c.x - px, c.z - pz - PG * 0); } else pip.root.rotation.y = 0;
    const gy = ps.onBoat ? -1 : (ps.riding ? fs.gy : ps.gy);
    pip.shadow.visible = ps.vis && !ps.onBoat && gy > -1 && !(ps.riding && t < 104.8);
    pip.shadow.position.set(px, (ps.riding ? -PG : ps.gy) + .0004, pz); pip.shadow.scale.setScalar(ps.scale * clamp(1 - (py - (ps.riding ? -PG : ps.gy)) * 12, .3, 1));
  }
  // 皱皱
  const cs = crumpleState(t);
  crumple.root.visible = crumple.shadow.visible = cs.vis;
  if (cs.vis) { crumple.pose(cs.pose); crumple.root.position.set(cs.x, 0, .152); crumple.spin.rotation.z = cs.spin; crumple.root.scale.set(cs.sx, cs.sy, 1); crumple.shadow.position.set(cs.x, .0004, .152); crumple.shadow.scale.set(cs.sx, 1, 1); }
  // 折折
  const fs = foldState(t);
  fold.root.visible = fs.vis; fold.shadow.visible = fs.vis && t < 104 || (fs.vis && t > 104.8);
  if (fs.vis) {
    fold.fold(fs.f); fold.drawFace(fs.face, blinkAt(t + .7));
    fold.craft.traverse(o => { if (o.isMesh) o.castShadow = !(t > 74 && t < 104); });
    fold.root.position.copy(fs.pos); fold.root.rotation.set(0, 0, 0); fold.root.rotation.order = 'YZX';
    fold.root.rotation.y = fs.yaw; fold.root.rotation.z = fs.pitch; fold.root.rotation.x = fs.roll;
    const sc = fs.scale ?? 1; fold.root.scale.setScalar(sc);
    fold.shadow.position.set(fs.pos.x, fs.gy + .0004, fs.pos.z); fold.shadow.scale.setScalar(sc * clamp(1 - (fs.pos.y - fs.gy) * 8, .3, 1));
  }
  // 灯光
  const Lt = lightsAt(t);
  sun.intensity = Lt.sunI; sun.color.copy(Lt.sunCol); sun.position.set(-.35, .55, .75);
  spot.intensity = Lt.lampI * 2.2; bulb.intensity = Lt.lampI * .35; hemi.intensity = Lt.hemiI;
  scene.environmentIntensity = Lt.envI; scene.backgroundIntensity = .6 + Lt.envI * .4;
  renderer.toneMappingExposure = Lt.exposure;
  // 摄像机
  const C = camAt(t);
  cam.position.copy(C.pos); cam.fov = C.fov; cam.lookAt(C.tgt); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  camQ.copy(cam.quaternion);
  post.dof.focus = C.focus > .001 ? C.focus : C.pos.distanceTo(C.tgt); post.dof.aper = C.aper; post.dof.maxCoc = 14;
  post.vig.uniforms.fade.value = 1;
  post.vig.uniforms.warm.value = .12;
  post.bloom.strength = .22 + seg(t, OPEN[0], OPEN[0] + 1) * (1 - seg(t, OPEN[1] + .5, OPEN[1] + 2)) * .15;
  for (const p of PS) p.userData.update(t);
  scene.updateMatrixWorld(true);
  post.composer.render();
  // 2D 叠加
  OX.clearRect(0, 0, W, H);
  const an = {};
  if (ps.vis) an.pip = toScreen(pip.head(tmpV));
  if (cs.vis) an.crumple = toScreen(crumple.head(tmpV));
  if (fs.vis) an.fold = toScreen(fold.head(tmpV));
  HUD.drawChapter(OX, t);
  HUD.drawBang(OX, t, 57.3, an.pip);
  const cp = cs.vis ? toScreen(new THREE.Vector3(.075, .045 + PG, .152)) : null;
  HUD.drawAction(OX, t, [{ t0: 61.55, text: 'NICE!', p: cp, col: ['#fff35a', '#ff9a2e'] }, { t0: 62.15, text: 'GREAT!', p: cp, col: ['#a8f0ff', '#3fa1ff'] }]);
  HUD.drawBubbles(OX, t, an);
  HUD.drawSubs(OX, t, DURS);
  HUD.drawEnd(OX, t);
  if (t < 1.4 || t > DUR - 1.5) { OX.fillStyle = `rgba(0,0,0,${1 - seg(t, 0, 1.4) * (1 - seg(t, DUR - 1.5, DUR))})`; OX.fillRect(0, 0, W, H); }
};
window.DBG = { pip, boat, fold, whale, book, cam };
window.render(0);
window.READY = true;
