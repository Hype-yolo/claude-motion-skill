// 通勤火车：6 节车厢（白车身 + 色带 + 车窗 + 车门 + 受电弓），沿铁轨 x 方向
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RAIL } from './city.js';

export const CAR_L = 20, CAR_GAP = .6, NCARS = 6;
export function makeTrain(scene, stripe = '#e8542f') {
  const side = (() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const x = c.getContext('2d');
    x.fillStyle = '#f3f3ef'; x.fillRect(0, 0, 1024, 160);
    x.fillStyle = '#1d8a86'; x.fillRect(0, 96, 1024, 64); x.fillStyle = stripe; x.fillRect(0, 88, 1024, 8); x.fillRect(0, 0, 1024, 12);
    x.fillStyle = '#26303a'; x.fillRect(0, 36, 1024, 44);
    x.fillStyle = '#f3f3ef'; for (let i = 0; i < 16; i++) x.fillRect(i * 64 + 58, 36, 8, 44);
    for (const dx of [150, 490, 830]) { x.fillStyle = '#c9ccd0'; x.fillRect(dx, 20, 60, 128); x.fillStyle = '#26303a'; x.fillRect(dx + 6, 30, 22, 60); x.fillRect(dx + 32, 30, 22, 60); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  const sideM = new THREE.MeshPhysicalMaterial({ map: side, roughness: .35, clearcoat: .6, clearcoatRoughness: .2 });
  const roofM = new THREE.MeshStandardMaterial({ color: '#8f969d', roughness: .55 });
  const endM = new THREE.MeshPhysicalMaterial({ color: '#f3f3ef', roughness: .35, clearcoat: .5 });
  const cars = [];
  for (let i = 0; i < NCARS; i++) {
    const g = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(CAR_L, 3.4, 3);
    const body = new THREE.Mesh(bodyGeo, [endM, endM, roofM, roofM, sideM, sideM]); body.position.y = 2.35;
    const roof = new THREE.Mesh(new RoundedBoxGeometry(CAR_L - .4, .5, 2.7, 2, .2), roofM); roof.position.y = 4.1;
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(CAR_L - 1, .6, 2.6), new THREE.MeshStandardMaterial({ color: '#3a3f45', roughness: .7 })); skirt.position.y = .6;
    for (const ax of [-6.5, 6.5]) { const ac = new THREE.Mesh(new THREE.BoxGeometry(2.4, .45, 1.6), roofM); ac.position.set(ax, 4.5, 0); g.add(ac); }
    g.add(body, roof, skirt);
    if (i === 0 || i === NCARS - 1) {   // 车头：斜面驾驶窗
      const nose = new THREE.Mesh(new RoundedBoxGeometry(1.4, 3.2, 3, 2, .4), new THREE.MeshPhysicalMaterial({ color: stripe, roughness: .3, clearcoat: .8 }));
      nose.position.set((i === 0 ? 1 : -1) * (CAR_L / 2 + .3), 2.4, 0); g.add(nose);
      const win = new THREE.Mesh(new THREE.BoxGeometry(.2, 1.1, 2.4), new THREE.MeshPhysicalMaterial({ color: '#1a222b', roughness: .1, clearcoat: 1 }));
      win.position.set((i === 0 ? 1 : -1) * (CAR_L / 2 + 1.02), 3.1, 0); g.add(win);
    }
    if (i === 1) { const pan = new THREE.Mesh(new THREE.BoxGeometry(2.6, .9, .1), roofM); pan.position.set(0, 4.9, 0); pan.rotation.z = .5; g.add(pan); }
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    scene.add(g); cars.push(g);
  }
  return {
    cars,
    // head = 车头前端 x；z = 轨道
    place(head, z = RAIL.zA, dir = 1) {
      cars.forEach((g, i) => { g.position.set(head - dir * (CAR_L / 2 + i * (CAR_L + CAR_GAP)), .55, z); g.rotation.y = dir > 0 ? 0 : Math.PI; g.visible = true; });
    },
    hide() { cars.forEach(g => g.visible = false); },
  };
}
