// S15 · 同一个晚上，外婆也收到了一个盒子（蓝色的，小满寄的）
import * as THREE from 'three';
import { burst, sheet } from '../paper.js';
import { boxFront, label, chair, table, bowl } from '../props.js';
import { grannySit, arm, GRAN_SHOULDER } from '../people.js';
import { kitchenSet } from './s02_kitchen.js';
import { stage, aim } from '../stage.js';
import { FONT } from '../art.js';
import { seg, ss, eio, lerp, clamp, TAU } from '../lib.js';

export function build(E) {
  const S = stage({ light: [-.02, .075, -.068], lightR: .11, lightCol: '#ffcf96', key: 1.0, amb: .16, ambCol: '#c08a60', keyCol: '#ffd9ae', keyPos: [-.02, .3, .28] });
  const { U } = S;
  const K = kitchenSet(S);
  const GX = -.06, GY = -.096, GS = .15;
  S.add(sheet({ U, w: .6, h: .36, z: -.058, trans: .06, draw: x => { x.fillStyle = '#2e170d'; chair(x, GX - .005, -.14, .1, 1); x.translate(GX, GY); grannySit(x, GS, { pin: '#2e170d' }); } }));
  const sh = [GX + GRAN_SHOULDER[0] * GS, GY + (GRAN_SHOULDER[1] - .48) * GS];
  const armS = S.add(sheet({ U, w: .14, h: .14, x: sh[0], y: sh[1], z: -.0575, trans: .06, draw: x => { x.fillStyle = '#2e170d'; arm(x, GS, -.25, .2, { sleeve: 1.25 }); } }));
  S.add(sheet({ U, w: .6, h: .36, z: -.046, trans: .06, draw: x => { x.fillStyle = '#3a1c0e'; table(x, .03, -.04, .22, .1, .01); } }));
  const box = S.add(sheet({ U, w: .08, h: .05, x: .06, y: -.024, z: -.045, trans: .2, draw: x => { boxFront(x, 0, -.016, .064, .03, '#2a4f7a', '#e0c070'); label(x, .014, -.001, .024, .016, [['外婆 收', .001, .0045]], { font: FONT.hand, ink: '#27405e', rot: .06 }); } }));
  const lid = S.add(sheet({ U, recv: false, shadow: false, w: .08, h: .02, x: .06, y: -.0085, z: -.044, trans: .2, draw: x => { x.fillStyle = '#2a4f7a'; x.fillRect(-.034, -.004, .068, .008); x.fillStyle = '#e0c070'; x.fillRect(-.032, -.001, .064, .0015); } }));
  const glow = burst(.1, .07);
  glow.position.set(.06, .025, -.0455); S.scene.add(glow);
  S.add(sheet({ U, w: .62, h: .38, z: -.014, trans: .04, draw: x => { x.fillStyle = '#1a0c06'; x.fillRect(-.31, -.19, .62, .05); x.fillRect(.27, -.19, .04, .38); } }));
  const tOpen = E.word('L19', 6) - .2;
  return {
    S,
    update(t) {
      const reach = ss(seg(t, tOpen - 1, tOpen)), op = eio(seg(t, tOpen, tOpen + .9));
      armS.rotation.z = lerp(-.1, .2, reach) + .15 * op;
      lid.position.set(.06 - op * .028, -.0085 + op * .012, -.044); lid.rotation.z = op * .18;
      const gk = ss(seg(t, tOpen + .2, tOpen + 1.2)); glow.userData.set(gk * 1.0);
      K.steam.material.opacity = .3; K.lamp.material.userData.u.uGlowLit.value = 1 + .04 * Math.sin(t * 9.1);
      const u = eio(clamp(t / E.dur));
      aim(S.cam, [lerp(-.01, .03, u), lerp(-.01, -.018, u), lerp(.36, .26, u), lerp(.0, .035, u), lerp(-.02, -.02, u), -.06], t);
    },
    post() { return { focus: S.cam.position.z + .05, aper: 16, maxCoc: 14, bloom: { strength: .4, radius: .6, threshold: 1.1 } }; },
    grade() { return { expo: 1.02, vig: .5, sat: 1.02, contrast: .1, lift: [.012, .006, 0], gain: [1.02, 1, .96] }; },
  };
}
