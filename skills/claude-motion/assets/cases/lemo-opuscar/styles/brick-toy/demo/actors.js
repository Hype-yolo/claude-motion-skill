// 积木宇航员：纯积木拼成的可动人偶（腿/臂绕髋/肩转动，头可转）
import * as THREE from 'three';
import { COL, BRICK, PLATE, brick, plate, mesh, roundGeo, plastic } from './bricks.js';

export const HIP = PLATE + 2 * BRICK;                 // 2.8
export const SHOULDER = HIP + PLATE + 2 * BRICK;      // 5.6
export const ARM_L = 3 * BRICK;                       // 3.6

export function makeAstro() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const legs = [-.5, .5].map(x => {
    const g = new THREE.Group(); g.position.set(x, HIP, 0); body.add(g);
    for (let i = 0; i < 2; i++) { const b = brick(1, 1, COL.white); b.position.y = -HIP + PLATE + i * BRICK; g.add(b); }
    const f = plate(1, 2, COL.dgray); f.position.set(0, -HIP, .3); g.add(f);
    return g;
  });
  const hip = plate(2, 2, COL.lgray); hip.position.y = HIP; body.add(hip);
  for (let i = 0; i < 2; i++) { const b = brick(2, 2, COL.white); b.position.y = HIP + PLATE + i * BRICK; body.add(b); }
  for (const [c, dx] of [[COL.red, -.45], [COL.yellow, 0], [COL.blue, .45]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .1, 20), plastic(c)); b.rotation.x = Math.PI / 2; b.position.set(dx, HIP + PLATE + BRICK * 1.45, 1.03); body.add(b);
  }
  const pack = brick(2, 1, COL.lgray); pack.position.set(0, HIP + PLATE + .2, -1.5); body.add(pack);   // 背包
  const arms = [-1.5, 1.5].map(x => {
    const g = new THREE.Group(); g.position.set(x, SHOULDER - .1, 0); body.add(g);
    for (let i = 0; i < 3; i++) { const b = mesh(roundGeo(.5), COL.white); b.position.y = -ARM_L + i * BRICK; g.add(b); }
    const hand = new THREE.Group(); hand.position.y = -ARM_L - .2; g.add(hand);
    return { g, hand };
  });
  const collar = plate(2, 2, COL.lgray); collar.position.y = SHOULDER; body.add(collar);
  const head = new THREE.Group(); head.position.set(0, SHOULDER + PLATE, 0); body.add(head);
  const helm = mesh(roundGeo(1, BRICK * 2), COL.white); helm.scale.set(1.12, 1, 1.12); head.add(helm);
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(1.17, 1.17, 1.45, 40, 1, true, -1.0, 2.0),
    new THREE.MeshPhysicalMaterial({ color: '#0f2036', roughness: .04, metalness: .3, clearcoat: 1, envMapIntensity: 1.8, side: THREE.DoubleSide }));
  visor.position.y = BRICK; head.add(visor);
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#d8f0ff', emissiveIntensity: .8 });
  const eyes = [-.3, .3].map(ex => { const e = new THREE.Mesh(new THREE.SphereGeometry(.16, 16, 12), eyeMat); e.position.set(ex * 1.3, BRICK * 1.05, 1.2); head.add(e); return e; });
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.4, 8), plastic(COL.lgray)); ant.rotation.z = -.5; ant.position.set(1.35, BRICK * 1.9, -.2); head.add(ant);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(.18, 16, 12), new THREE.MeshStandardMaterial({ color: '#ff3b30', emissive: '#ff2a1a', emissiveIntensity: 2 })); tip.position.set(1.7, BRICK * 1.9 + .62, -.2); head.add(tip);
  root.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });

  // pose：所有角度单位弧度；arm = [前后 x, 侧抬 z]；legs = [左, 右] 前后摆；sit 0..1
  function pose(p) {
    root.position.set(p.x, p.y ?? 0, p.z); root.rotation.y = p.ry ?? 0;
    const sit = p.sit ?? 0;
    body.position.y = (p.bob ?? 0) - sit * (HIP - .55);
    body.rotation.x = p.lean ?? 0;
    legs[0].rotation.x = (p.legs?.[0] ?? 0) - sit * 1.45; legs[1].rotation.x = (p.legs?.[1] ?? 0) - sit * 1.45;
    const aL = p.armL ?? [0, 0], aR = p.armR ?? [0, 0];
    arms[0].g.rotation.set(aL[0], 0, -aL[1]); arms[1].g.rotation.set(aR[0], 0, aR[1]);
    head.rotation.set(p.nod ?? 0, p.look ?? 0, p.tilt ?? 0);
    const blink = p.blink ? .15 : 1; eyes.forEach(e => e.scale.set(1, blink, 1));
    tip.material.emissiveIntensity = p.tipGlow ?? 2;
  }
  return { root, body, arms, head, legs, pose };
}

// 走路：φ 为步伐相位
export function walkPose(phi, amp = .55) {
  const s = Math.sin(phi);
  return { legs: [s * amp, -s * amp], armL: [-s * amp * .6, .06], armR: [s * amp * .6, .06], bob: Math.abs(Math.cos(phi)) * .18 };
}
