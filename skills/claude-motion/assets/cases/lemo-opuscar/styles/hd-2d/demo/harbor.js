// 场景 A：灰水港（Greywater）夜景——码头、木筋房、帆船、海、远处崖顶灯塔
import * as THREE from 'three';
import { PX, PPM, ramp, hex, h2, fbm, texOf, cobbles, rock, woodPlanks, billboard, glow, blob, mulberry } from './px.js';
import { mats, mat, mesh, box, house, crate, barrel, fire, ridge, windowQuad } from './kit.js';
import { sky, stars, sea, particles, shaft, beamCard, flick } from './fx.js';
import { makeChar, SPX } from './chars.js';
import { T } from './story.js';
import { clamp, seg, ss, eio, eo, lerp, track } from '/core/lib.js';

export function buildHarbor() {
  const scene = new THREE.Scene(), MM = mats();
  scene.fog = new THREE.FogExp2('#16223a', .0105);
  const SEA_Y = -1.3;
  const SK = sky({ moonDir: new THREE.Vector3(-.55, .3, -1), top: '#050818', mid: '#101d3e', hor: '#2c4262' }); scene.add(SK.mesh);
  const ST = stars(900, 5); scene.add(ST);

  // —— 光 ——
  const moon = new THREE.DirectionalLight('#8fa8e0', 1.1); moon.position.set(-30, 40, -40); moon.target.position.set(0, 0, 0);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 150 }); moon.shadow.bias = -.0006; moon.shadow.normalBias = .02;
  scene.add(moon, moon.target);
  const hemi = new THREE.HemisphereLight('#3a4c7a', '#0a0a12', .9); scene.add(hemi);

  // —— 码头地面（石砌岸）——
  const cob = mat(cobbles(96, 96, { seed: 4 })), stone = mat(rock(96, 96, { seed: 2, cols: ['#15141a', '#26252c', '#383640', '#4b4852', '#615d66'] }));
  const quay = new THREE.Group();
  const top = mesh(new THREE.BoxGeometry(46, .4, 50).translate(-17, -.2, -19), cob); quay.add(top);
  const wallF = mesh(new THREE.BoxGeometry(46, 3.2, .6).translate(-17, -1.8, 5.7), stone); quay.add(wallF);
  const wallR = mesh(new THREE.BoxGeometry(.6, 3.2, 50).translate(5.7, -1.8, -19), stone); quay.add(wallR);
  // 台阶石条沿
  const curb = mesh(new THREE.BoxGeometry(46.4, .22, .7).translate(-17, .02, 5.7), stone); quay.add(curb);
  const curbR = mesh(new THREE.BoxGeometry(.7, .22, 50).translate(5.7, .02, -19), stone); quay.add(curbR);
  scene.add(quay);

  // —— 栈桥 ——
  const pier = new THREE.Group(), deckM = mat(woodPlanks(96, 96, { pw: 5, len: 96, seed: 8 }));
  const deck = mesh(new THREE.BoxGeometry(14, .22, 3).translate(12.5, -.11, .5), deckM, { swap: true }); pier.add(deck);
  for (let x = 6; x <= 19; x += 2.1) for (const z of [-.95, 1.95]) { const p = mesh(new THREE.CylinderGeometry(.14, .16, 3.4, 8).translate(x, -1.8, z), MM.beam); pier.add(p); }
  for (let x = 12.7; x <= 19; x += 3.1) { const b = box(.16, .7, .16, MM.beam); b.position.set(x, 0, -.95); pier.add(b); }
  const rail = box(6.4, .1, .12, MM.beam); rail.position.set(15.8, .66, -.95); pier.add(rail);
  scene.add(pier);

  // —— 房屋 ——
  const houses = [
    house({ x: -12, z: -6, w: 6, d: 5, h: 4.2, wall: 'wall', roof: 'roof', door: 1.4, windows: [[-1.6, 2.1]], upper: [[-1.3, 3.5], [1.4, 3.5]], side: [[0, 2.3, 1]] }),
    house({ x: -4.6, z: -5.5, w: 5.4, d: 4.6, h: 4.9, wall: 'wall3', roof: 'roof3', door: -1.3, windows: [[1.1, 2.1]], upper: [[-1.1, 3.9], [1.2, 3.9]], side: [[-.5, 2.4, 1], [-.5, 4, 1]] }),
    house({ x: -18.5, z: -6.3, w: 5.2, d: 5, h: 3.8, wall: 'wall2', roof: 'roof2', door: .8, windows: [[-1.2, 2]], upper: [[.9, 3.2]] }),
    house({ x: 1.6, z: -8.5, w: 4.2, d: 4.2, h: 3.6, wall: 'wall2', roof: 'roof', chimney: false, windows: [[-.8, 2]], side: [[.3, 2.2, 1]] }),
    house({ x: -9, z: -15.5, y: 0, w: 6, d: 5, h: 6.4, wall: 'wall3', roof: 'roof2', windows: [[-1.5, 3.2], [1.5, 3.2]], upper: [[0, 5.1]] }),
    house({ x: -17, z: -16, w: 5, d: 5, h: 5.2, wall: 'wall', roof: 'roof3', windows: [[0, 2.6]], upper: [[0, 4.1]] }),
    house({ x: -1.5, z: -17, w: 5, d: 5, h: 5.8, wall: 'wall', roof: 'roof', windows: [[-1, 3]], upper: [[1.2, 4.6]] }),
    house({ x: -25, z: -7, w: 5, d: 5, h: 4.5, wall: 'wall3', roof: 'roof', windows: [[0, 2.2]] }),
  ];
  houses.forEach(hh => scene.add(hh));
  const winLights = [[-13, 2.4, -3], [-4.2, 2.8, -2.8], [-18.5, 2.2, -3.4], [1, 2.2, -6]].map(([x, y, z]) => { const L = new THREE.PointLight('#ff9d4a', 9, 9, 2); L.position.set(x, y, z); scene.add(L); return L; });

  // —— 小道具 ——
  const R = mulberry(12);
  [[3.2, -1.8], [3.9, -1.2], [-7.4, -1.8], [-15.2, -2.3]].forEach(([x, z], i) => { const c = crate(.75 + R() * .2); c.position.set(x, 0, z); c.rotation.y = R() * .6; scene.add(c); if (i === 0) { const c2 = crate(.6); c2.position.set(x + .1, .8, z + .05); c2.rotation.y = .4; scene.add(c2); } });
  [[4.3, 2.8], [4.9, 3.4], [-9.4, -2.6], [-1.6, -2.4], [-2.3, -2.1]].forEach(([x, z]) => { const b = barrel(); b.position.set(x, 0, z); scene.add(b); });
  // 系缆桩
  [[13, 1.9], [17, 1.9], [8, -.9], [14.5, -.9]].forEach(([x, z]) => { const b = mesh(new THREE.CylinderGeometry(.12, .15, .4, 8).translate(x, .2, z), MM.plankDark); scene.add(b); });

  // —— 街灯（岸边）与栈桥尽头灯 ——
  const lamps = [];
  function lampPost(x, z, hgt = 3) {
    const g = new THREE.Group(); const pole = box(.14, hgt, .14, MM.plankDark); g.add(pole);
    const arm = box(.6, .08, .08, MM.plankDark); arm.position.set(.25, hgt - .15, 0); g.add(arm);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(.26, .34, .26), new THREE.MeshStandardMaterial({ color: '#2a2016', emissive: '#ffb45a', emissiveIntensity: 4 })); lamp.position.set(.5, hgt - .42, 0); g.add(lamp);
    const L = new THREE.PointLight('#ffae55', 14, 14, 2); L.position.set(.5, hgt - .5, 0); g.add(L);
    const gl = glow('#ffb25e', 1.6, 1.2); gl.position.copy(lamp.position); g.add(gl);
    g.position.set(x, 0, z); scene.add(g); lamps.push({ g, L, lamp, gl }); return g;
  }
  lampPost(-1.2, 3.6); lampPost(18.2, 1.8, 2.6);

  // —— 火盆 ——
  const brazier = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.34, .2, .26, 10, 1, true), new THREE.MeshStandardMaterial({ color: '#2a2a30', roughness: .6, metalness: .5, side: THREE.DoubleSide })); bowl.position.y = .78; brazier.add(bowl);
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .8, 5), bowl.material); const a = i / 3 * Math.PI * 2; l.position.set(Math.cos(a) * .17, .4, Math.sin(a) * .17); l.rotation.set(Math.sin(a) * .25, 0, -Math.cos(a) * .25); brazier.add(l); }
  const coals = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .05, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5a1a').multiplyScalar(2.2) })); coals.position.y = .88; brazier.add(coals);
  const bf = fire(.75, { seed: 2 }); bf.position.y = .86; brazier.add(bf);
  const bL = new THREE.PointLight('#ff8c3a', 16, 16, 2); bL.position.set(0, 1.35, .15); bL.castShadow = true; bL.shadow.mapSize.set(1024, 1024); bL.shadow.bias = -.004; bL.shadow.camera.near = .1; brazier.add(bL);
  const bG = glow('#ff9a4a', 2.4, 1.1); bG.position.y = 1.15; brazier.add(bG);
  brazier.position.set(9.7, 0, -.55); scene.add(brazier);

  // —— 帆船（泊在栈桥北侧）——
  const boat = new THREE.Group();
  {
    const hullShape = new THREE.Shape(); hullShape.moveTo(-4, -1.1); hullShape.lineTo(2.6, -1.1); hullShape.quadraticCurveTo(4.6, -.6, 5.2, 0); hullShape.quadraticCurveTo(4.6, .6, 2.6, 1.1); hullShape.lineTo(-4, 1.1); hullShape.quadraticCurveTo(-4.5, 0, -4, -1.1);
    const hg = new THREE.ExtrudeGeometry(hullShape, { depth: 1.5, bevelEnabled: false }); hg.rotateX(-Math.PI / 2); hg.translate(0, -1.1, 0);
    const hm = mat(woodPlanks(96, 96, { pw: 4, len: 96, seed: 21, cols: ['#150d0a', '#2c1b12', '#4a2d1c', '#6b4228', '#86582f'] }));
    boat.add(mesh(hg, hm));
    const stripe = mesh(new THREE.BoxGeometry(8.9, .14, 2.26).translate(.4, .33, 0), mat(woodPlanks(48, 48, { pw: 48, seed: 3, nails: false, cols: ['#3a0e10', '#6a1a1a', '#8a2a22'] }))); boat.add(stripe);
    const mast = mesh(new THREE.CylinderGeometry(.09, .12, 9, 8).translate(0, 4.8, 0), MM.beam); boat.add(mast);
    const boom = mesh(new THREE.CylinderGeometry(.07, .07, 5, 6).rotateZ(Math.PI / 2).translate(-2.2, 3.3, 0), MM.beam); boat.add(boom);
    const sail = new THREE.Mesh(new THREE.CylinderGeometry(.22, .18, 4.6, 8).rotateZ(Math.PI / 2).translate(-2.2, 3.55, 0), new THREE.MeshStandardMaterial({ color: '#7d7466', roughness: 1 })); sail.castShadow = true; boat.add(sail);
    const cabin = box(2, .9, 1.6, MM.plank); cabin.position.set(-2.4, .4, 0); boat.add(cabin);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(.18, .24, .18), new THREE.MeshStandardMaterial({ color: '#2a2016', emissive: '#ffb45a', emissiveIntensity: 4 })); bl.position.set(-3.9, 1.3, 0); boat.add(bl);
    const bgl = glow('#ffb25e', 1.2, 1.1); bgl.position.copy(bl.position); boat.add(bgl);
    // 桅索
    const rope = new THREE.LineBasicMaterial({ color: '#3a3026' });
    for (const [a, b] of [[[0, 9.2, 0], [5, .5, 0]], [[0, 9.2, 0], [-4, .5, 0]], [[0, 9.2, 0], [0, .5, 1.05]], [[0, 9.2, 0], [0, .5, -1.05]]]) boat.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]), rope));
  }
  boat.position.set(12, SEA_Y + .15, -3.3); scene.add(boat);

  // —— 岸边浪花：沿石岸和桩脚的像素白沫带 ——
  const foamC = new PX(64, 8); foamC.fill((x, y) => { const v = fbm(x * .2, y * .6, 31) - y * .06; return v > .5 ? (v > .6 ? [205, 220, 235] : [120, 150, 180]) : null; });
  const foamT = texOf(foamC.done(), { repeat: [1, 1] }); foamT.wrapS = foamT.wrapT = THREE.RepeatWrapping;
  const foams = [];
  const foamStrip = (x0, z0, x1, z1, w = .7) => { const L = Math.hypot(x1 - x0, z1 - z0), t2 = foamT.clone(); t2.needsUpdate = true; t2.repeat.set(L / 2.6, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L, w), new THREE.MeshBasicMaterial({ map: t2, transparent: true, alphaTest: .5, color: '#8fa6c4' })); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(z1 - z0, x1 - x0);
    m.position.set((x0 + x1) / 2, SEA_Y + .03, (z0 + z1) / 2); scene.add(m); foams.push(t2); };
  foamStrip(-40, 6.25, 6.25, 6.25); foamStrip(6.25, 6.25, 6.25, -44);
  // —— 海 ——
  const SEA = sea(1400, { ppm: 9 }); SEA.mesh.position.y = SEA_Y; scene.add(SEA.mesh);

  // —— 远处岬角 + 灯塔 ——
  const head = new THREE.Group();
  {
    const rm = mat(rock(128, 128, { seed: 7, cols: ['#0e0e14', '#1c1b22', '#2b2932', '#3c3a44', '#514e58'] }));
    const g = new THREE.CylinderGeometry(12, 20, 14, 9, 4); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (h2(Math.round(x * 3), Math.round(z * 3), 4) - .5) * .25 + (y > 9 ? -.08 : 0); p.setX(i, x * k); p.setZ(i, z * k); }
    g.translate(0, 7, 0); head.add(mesh(g, rm));
    const g2 = new THREE.CylinderGeometry(8, 14, 9, 8, 2); g2.translate(-13, 4.5, 7); head.add(mesh(g2, rm));
    const grass = mesh(new THREE.CylinderGeometry(11.6, 12, .5, 9).translate(0, 14.1, 0), mat(cobbles(64, 64, { seed: 9, cols: ['#0c140f', '#16241a', '#213626', '#2d4a32', '#3c5c3e'] })));
    head.add(grass);
  }
  head.position.set(56, SEA_Y, -62); scene.add(head);
  const LH = new THREE.Group();
  {
    const P = new PX(48, 96), W = ramp(['#8d8a88', '#b9b5ae', '#dcd8cf', '#f0ece2']), Rr = ramp(['#4a1216', '#7a1f22', '#a2302c', '#c2463a']);
    P.fill((x, y) => { const band = Math.floor(y / 24) % 2 === 1; const v = .55 + (h2(x >> 1, y >> 1, 2) - .5) * .2 - (y % 6 === 0 ? .15 : 0); return band ? Rr(v, x, y) : W(v, x, y); });
    const tm = new THREE.MeshStandardMaterial({ map: texOf(P.done()), roughness: .9 });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.85, 11, 16), tm); tower.position.y = 5.5; tower.castShadow = true; LH.add(tower);
    const gal = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, .2, 16), new THREE.MeshStandardMaterial({ color: '#202026' })); gal.position.y = 11.1; LH.add(gal);
    const room = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 1.5, 12), new THREE.MeshStandardMaterial({ color: '#1a1a20', emissive: '#fff0c0', emissiveIntensity: 0 })); room.position.y = 12; LH.add(room);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.3, 12), new THREE.MeshStandardMaterial({ color: '#2a1414' })); cap.position.y = 13.4; LH.add(cap);
    LH.userData.room = room;
  }
  LH.position.set(58, SEA_Y + 14.3, -64); scene.add(LH);
  const lhGlow = glow('#fff2c4', 16, 1.6); lhGlow.position.set(58, SEA_Y + 26.3, -64); scene.add(lhGlow);
  const lhL = new THREE.PointLight('#ffe6b0', 0, 60, 1.6); lhL.position.copy(lhGlow.position); scene.add(lhL);
  // 光柱：两道相对（绕 y 轴转）
  const beams = [0, 1].map(() => { const b = beamCard(170, 1.2, 26, '#fff0c8', { k: .5, fall: 1.1 }); scene.add(b); return b; });

  // —— 远山、远船 ——
  [[-420, -520, 520, 70, '#1b2944', 3, 0], [120, -560, 700, 60, '#15213a', 7, 0], [-100, -600, 900, 110, '#121c33', 11, 0]].forEach(([x, z, w, h, c, s]) => { const r = ridge(w, h, c, s, { ppm: 1.4 }); r.position.set(x, SEA_Y - 2, z); scene.add(r); });
  const ships = [];
  {
    const P = new PX(28, 30), Hh = ramp(['#0a0a10', '#15151e', '#22222e']), S = ramp(['#3a4052', '#566076', '#747e94']);
    P.poly([[2, 22], [26, 22], [22, 28], [6, 28]], (x, y) => Hh(.5, x, y));
    P.rect(13, 2, 1, 20, [20, 18, 22]); P.poly([[14, 3], [24, 7], [24, 19], [14, 20]], (x, y) => S(.5 + (x - 14) * .03, x, y)); P.poly([[12, 5], [5, 10], [5, 19], [12, 20]], (x, y) => S(.35, x, y));
    const tex = texOf(P.done());
    [[-24, -78, 1.7], [12, -104, 1.5], [36, -70, 1.8], [-52, -118, 1.4], [70, -126, 1.5], [26, -150, 1.2]].forEach(([x, z, s], i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(7 * s, 7.5 * s).translate(0, 3.2 * s, 0), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .5, color: '#9aa3be' }));
      m.position.set(x, SEA_Y, z); scene.add(m);
      const g = glow('#ffc070', 3.2 * s, 1.6); g.material.depthTest = false; g.renderOrder = 5; g.position.set(x - 2 * s, SEA_Y + 2.5 * s, z + .1); scene.add(g);
      ships.push({ m, g, x, z, i });
    });
  }

  // —— 浮尘/海雾粒子 ——
  const R2 = mulberry(77), dust = [...Array(160)].map(() => [R2() * 40 - 22, R2() * 6, R2() * 20 - 12, R2() * 10]);
  const D = particles(dust.length, (i, t, o) => { const d = dust[i]; o.x = d[0] + Math.sin(t * .2 + d[3]) * .8 + t * .15; o.y = d[1] + Math.sin(t * .3 + d[3] * 2) * .3; o.z = d[2]; o.a = .25 + .2 * Math.sin(t * 1.3 + d[3]); o.s = .05; o.r = .7; o.g = .8; o.b = 1; }, { soft: 1 });
  scene.add(D);
  // 火星（火盆上升）
  const embers = particles(40, (i, t, o) => { const ph = (t * .5 + h2(i, 1) ) % 1, x0 = (h2(i, 2) - .5) * .4; o.x = 9.7 + x0 + Math.sin(t * 2 + i) * .15 * ph; o.y = 1.1 + ph * 2.2; o.z = -.55 + (h2(i, 3) - .5) * .3; o.a = (1 - ph) * 1.4; o.s = .035; o.r = 3; o.g = 1.3; o.b = .35; });
  scene.add(embers);

  // —— 角色 ——
  const wren = makeChar('wren'), keeper = makeChar('keeper'); scene.add(wren.root, keeper.root);
  const lanternL = new THREE.PointLight('#ffb050', 0, 10, 2); lanternL.castShadow = true; lanternL.shadow.mapSize.set(1024, 1024); lanternL.shadow.bias = -.004; lanternL.shadow.camera.near = .05; scene.add(lanternL);
  const lanternG = glow('#ffc070', 1.1, 1.2); scene.add(lanternG);
  const tipG = glow('#ffc070', .5, 1.4); scene.add(tipG);

  const fill = new THREE.PointLight('#9fb2e8', 1.6, 7, 2); scene.add(fill);
  // —— 镜头 ——
  const W0 = new THREE.Vector3(7.6, 0, .75);   // Wren 在码头的位置
  const cams = {
    harborWide: { p: track([[5.5, [-17, 15, 38]], [15, [-13, 12, 31]]]), l: track([[5.5, [14, 5.5, -22]], [15, [15, 5.2, -24]]]), fov: 36, focus: 44, aper: 520 },
    pier: { p: track([[15, [W0.x + 1.3, 5.6, 9.6]], [25.5, [W0.x + .5, 4.8, 8.2]]]), l: track([[15, [W0.x + .7, .75, .1]], [25.5, [W0.x + .4, .8, .3]]]), fov: 30, focus: 0, aper: 300 },
    harborEnd: { p: track([[58, [-22, 26, 44]], [76.5, [-27, 33, 55]]]), l: track([[58, [22, 6, -40]], [76.5, [25, 11, -48]]]), fov: 42, focus: 70, aper: 380 },
    title: null,
  };

  function update(t, shot, cam, post) {
    const C = cams[shot.id] || cams.harborEnd; const p = C.p(t), l = C.l(t);
    cam.position.set(...p); cam.fov = C.fov; cam.updateProjectionMatrix(); cam.lookAt(...l);
    SK.u.k.value = 1; ST.material.uniforms.t.value = t;
    SEA.u.t.value = t; SEA.u.camPos.value.copy(cam.position); SEA.u.fogColor.value.copy(scene.fog.color); SEA.u.fogDensity.value = scene.fog.density;

    // 火光
    const fk = flick(t, 1); bL.intensity = 16 * fk; bG.material.opacity = .8 + .2 * fk; bf.userData.update(t, cam);
    winLights.forEach((L, i) => L.intensity = 8 * (1 + .04 * Math.sin(t * 3 + i)));
    lamps.forEach((L, i) => { L.L.intensity = 12 * flick(t, 5 + i * 3) ; });
    D.userData.update(t); embers.userData.update(t); foams.forEach((f, i) => f.offset.set(Math.sin(t * .6 + i) * .08, Math.floor(t * 4) % 2 * .12));

    // 灯塔：开场亮 → 11.5 闪两下 → 12.35 灭；终场 53.5 后重新点亮（光柱旋转）
    let lh = 1;
    if (t > T.lhFlicker && t < T.lhOut) { const u = (t - T.lhFlicker) / (T.lhOut - T.lhFlicker); lh = (u < .25 ? .3 : u < .4 ? 1 : u < .62 ? .15 : u < .72 ? .7 : .05) * (1 - u * .6); }
    else if (t >= T.lhOut && t < T.ignite) lh = 0;
    else if (t >= T.ignite) lh = 1.25;
    lhGlow.material.opacity = lh; lhGlow.visible = !location.search.includes('noglow'); lhGlow.scale.setScalar(16 * (.6 + .4 * lh)); lhL.intensity = lh * 900; LH.userData.room.material.emissiveIntensity = lh * 6;
    const beamOn = t < T.lhOut ? lh : t >= T.ignite ? 1 : 0;
    let face = 0;
    beams.forEach((bm, i) => { const ang = t * .55 + i * Math.PI, dir = new THREE.Vector3(Math.cos(ang), -.035, Math.sin(ang)); const side = bm.userData.aim(lhGlow.position, dir, cam);
      bm.visible = beamOn > .02; bm.material.uniforms.k.value = .55 * beamOn * Math.pow(side, 1.5); bm.material.uniforms.t.value = t;
      const toward = dir.dot(cam.position.clone().sub(lhGlow.position).normalize()); face = Math.max(face, Math.pow(Math.max(0, toward), 30)); });
    lhGlow.scale.multiplyScalar(1 + face * 1.4 * beamOn);

    // 远船灯：终场逐个亮
    ships.forEach((s, i) => { const on = ss(seg(t, T.ships + i * .7, T.ships + i * .7 + .5)); s.g.material.opacity = on * 1.6;
      const go = Math.max(0, t - T.ships - i * .7) * .9, dx = 4 - s.x, dz = -8 - s.z, dl = Math.hypot(dx, dz);   // 亮灯后缓缓驶向港口
      const px = s.x + dx / dl * go, pz = s.z + dz / dl * go, bob = Math.sin(t * .8 + i) * .15;
      s.m.position.set(px, SEA_Y + bob, pz); s.g.position.set(px - 2 * (s.m.geometry.parameters.width / 7), SEA_Y + bob + 2.5 * (s.m.geometry.parameters.width / 7), pz + .1); s.m.lookAt(cam.position.x, s.m.position.y, cam.position.z); });

    const lights = [{ p: lhGlow.position, c: new THREE.Color('#fff0c8'), i: lh * 1.2 }, { p: new THREE.Vector3(9.7, 1.2, -.55), c: new THREE.Color('#ff8c3a'), i: .9 * fk }, { p: new THREE.Vector3(-.7, 2.6, 3.6), c: new THREE.Color('#ffae55'), i: .7 }, { p: new THREE.Vector3(18.7, 2.2, 1.8), c: new THREE.Color('#ffae55'), i: .8 }, { p: new THREE.Vector3(8.1, .4, -3.3), c: new THREE.Color('#ffb45a'), i: .4 }, { p: new THREE.Vector3(-4.2, 2.5, -2.5), c: new THREE.Color('#ff9d4a'), i: .35 }];
    ships.forEach(s => lights.push({ p: s.g.position, c: new THREE.Color('#ffc070'), i: s.g.material.opacity * .5 }));
    SEA.setLights(lights);

    // —— 角色调度 ——
    const step8 = Math.floor(t * 8);
    wren.root.visible = keeper.root.visible = shot.id !== 'harborWide';
    const KX = W0.x + .85;
    keeper.root.position.set(KX, 0, W0.z - .05);
    let wx = W0.x, wf = 'emptyLow', wflip = false, kf = step8 % 24 === 0 ? 'blink' : (Math.floor(t * 1.5) % 2 ? 'idle1' : 'idle0'), lit = 0;
    if (shot.id === 'pier') {
      if (t < T.light - .9) { wf = 'emptyLow'; kf = 'idle0'; }
      else if (t < T.light + .5) { wf = 'upE'; kf = 'taper'; }
      else if (t < T.light + 1.1) { wf = 'up'; kf = 'taper'; }
      else if (t < T.wrenRun) { wf = Math.floor(t * 1.4) % 2 ? 'idle1' : 'idle0'; if (step8 % 29 === 3) wf = 'blink'; kf = t < T.dlgIn + .4 ? 'give' : kf; }
      else { wflip = true; const u = t - T.wrenRun; wx = W0.x - Math.max(0, u - .35) * 2.4; wf = u < .35 ? 'idle0' : ['w0', 'w1', 'w2', 'w3'][Math.floor(t * 10) % 4]; kf = u > 1.2 ? (Math.floor(t * 3) % 2 ? 'wave0' : 'wave1') : 'look'; }
      lit = t < T.light ? 0 : Math.min(1, (t - T.light) / .25);
    }
    if (shot.id === 'harborEnd' || shot.id === 'title') { wren.root.visible = false; kf = Math.floor(t * 3) % 2 ? 'wave0' : 'wave1'; if (t < T.ships + 1.5) kf = 'look'; }
    wren.root.position.set(wx, 0, W0.z); wren.frame(wf); wren.face(cam, wflip);
    keeper.frame(kf); keeper.face(cam, true);
    const lp = wren.lanternPos(wf, wflip);
    const toCam = cam.position.clone().sub(lp).setY(0).normalize().multiplyScalar(.45); lanternL.position.copy(lp).add(toCam); lanternL.intensity = wren.root.visible ? lit * 2.6 * flick(t, 9) : 0; lanternG.position.copy(lp); lanternG.material.opacity = wren.root.visible ? lit * .8 : 0;
    lanternG.scale.setScalar(1.1 + (t > T.light && t < T.light + .5 ? (1 - (t - T.light) / .5) * 1.6 : 0));
    // 点火棒火头
    const tipOn = shot.id === 'pier' && kf === 'taper'; tipG.material.opacity = tipOn ? .9 : 0;
    if (tipOn) { tipG.position.set(KX - 16 / 30, (50 - 19) / 30, W0.z); }

    fill.position.set(W0.x + .4, 1.6, W0.z + 2.2); fill.intensity = shot.id === 'pier' ? 1.8 : 0;
    // 景深：焦点跟 Wren（码头镜头）
    const dist = shot.id === 'pier' ? cam.position.distanceTo(new THREE.Vector3(W0.x + .4, .8, W0.z)) : C.focus;
    post.dof.focus = dist; post.dof.aper = C.aper; post.dof.maxCoc = 22;
  }
  return { scene, update };
}
