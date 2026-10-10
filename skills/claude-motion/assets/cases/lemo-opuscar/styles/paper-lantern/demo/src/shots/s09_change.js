// S9 · 嫦娥：大月亮前飞过的嫦娥与飘带、云上的玉兔；镜头下摇到人间——屋顶上抬头看月亮的人
import * as THREE from 'three';
import { sheet, skyPanel, moon, setMoon, paperMat, tex, paint } from '../paper.js';
import { osmanthus, xiangyun, jiangnanHouse, lantern, reeds, ridge, FONT } from '../art.js';
import { change, rabbit, ribbon, childStand, grannyStand, girlStand } from '../people.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, eo, lerp, clamp, mulberry, TAU } from '../lib.js';

// 飘带网格：沿 x 方向的细长条，顶点每帧按波动更新
function ribbonMesh(U, len, w, col) {
  const geo = new THREE.PlaneGeometry(len, w, 48, 1); geo.translate(-len / 2, 0, 0);
  const c = paint(len, w, x => { x.fillStyle = col; x.fillRect(-len / 2, -w / 2, len, w); }, 2000);
  const m = new THREE.Mesh(geo, paperMat(tex(c), U, { trans: .5 })); m.material.side = THREE.DoubleSide; m.castShadow = true;
  const base = geo.attributes.position.array.slice();
  m.userData.wave = (t, amp, k, sp, ph) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const u = -base[i] / len, taper = 1 - .75 * u;
      p[i] = base[i]; p[i + 1] = base[i + 1] * taper + amp * u * Math.sin(k * u * TAU - t * sp + ph) - u * u * amp * .6;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return m;
}

export function build(E) {
  const MN = [0, .075, -.13];
  const S = stage({ light: MN, lightR: .13, lightCol: '#ffe8bc', key: .8, amb: .3, ambCol: '#8a9cc8', keyCol: '#d6dcff' });
  const { U } = S;
  S.add(skyPanel({ w: .7, h: .6, y: -.05, z: -.145, stops: [[0, '#0a1230'], [.45, '#16285a'], [.8, '#2a3f72'], [1, '#3a4f80']], stars: 320 }));
  const mn = S.add(moon({ x: MN[0], y: MN[1], z: MN[2], r: .08, gain: 1.35, halo: 2.4, haloGain: .22, art: x => {
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(200,160,110,.28)';
    osmanthus(x, { cx: .035, by: -.075, h: .07, seed: 7, leaves: 25, cut: true });
    x.fillRect(-.07, -.062, .08, .012); x.beginPath(); x.moveTo(-.075, -.05); x.quadraticCurveTo(-.03, -.035, .015, -.05); x.lineTo(.005, -.045); x.lineTo(-.065, -.045); x.fill();   // 广寒宫
    x.fillRect(-.055, -.05, .04, .01); x.beginPath(); x.moveTo(-.062, -.04); x.quadraticCurveTo(-.035, -.03, -.008, -.04); x.fill();
  } }));
  const clouds = S.add(sheet({ U, w: .7, h: .5, y: -.02, z: -.115, trans: .85, draw: x => { x.fillStyle = '#c3cbe8'; xiangyun(x, -.09, .02, .012, 1, { tail: 3 }); xiangyun(x, .1, .005, .011, -1, { tail: 2.6 }); xiangyun(x, -.2, .1, .008, 1); xiangyun(x, .21, .12, .007, -1); } }));
  const bunny = S.add(sheet({ U, w: .08, h: .06, x: .085, y: .02, z: -.108, trans: .3, draw: x => { x.fillStyle = '#e9e2d0'; x.translate(0, -.015); rabbit(x, .03); x.fillStyle = '#b89a6a'; x.fillRect(.012, 0, .012, .008); } }));
  // 嫦娥 + 两条飘带
  const ce = new THREE.Group(); S.scene.add(ce);
  const body = sheet({ U, w: .2, h: .16, trans: .25, draw: x => { x.fillStyle = '#231c3a'; change(x, .115); } });
  const rb1 = ribbonMesh(U, .17, .006, '#b8322a'), rb2 = ribbonMesh(U, .14, .005, '#d9a441');
  rb1.position.set(.0, .02, .001); rb2.position.set(-.006, .008, -.001);
  ce.add(body, rb1, rb2);
  // 人间：屋顶、灯窗、抬头望月的人
  const town = S.add(sheet({ U, w: .7, h: .3, y: -.085, z: -.07, trans: .3, glow: 2, glowCol: '#ffb862', draw: x => drawTown(x, null), glowDraw: g => drawTown(null, g) }));
  const people = S.add(sheet({ U, w: .7, h: .3, y: -.06, z: -.05, trans: .1, glow: 1.5, glowCol: '#ff8a48', draw: x => {
    x.fillStyle = '#141c38'; x.fillRect(-.35, -.15, .7, .06);
    // 屋顶平台上的一家人：外婆指着月亮，孩子
    x.fillRect(-.15, -.09, .12, .004);
    x.save(); x.translate(-.12, -.086); grannyStand(x, .045); x.restore();
    x.save(); x.translate(-.095, -.086); childStand(x, .026); x.restore();
    x.save(); x.translate(.14, -.09); girlStand(x, .045); x.restore();
    x.save(); x.translate(.17, -.09); x.scale(-1, 1); girlStand(x, .042); x.restore();
    lantern(x, { cx: -.02, cy: -.05, r: .006, stringLen: .03 }); lantern(x, { cx: .03, cy: -.045, r: .005, stringLen: .03 });
    x.strokeStyle = '#141c38'; reeds(x, { x0: -.35, x1: .35, by: -.095, h: .02, n: 50, seed: 9 });
  }, glowDraw: g => { const o = { col: '#000', rib: '#000', cap: '#000', string: false, tassel: false }; lantern(g, { ...o, cx: -.02, cy: -.05, r: .006 }, g); lantern(g, { ...o, cx: .03, cy: -.045, r: .005 }, g); } }));
  const tDown = E.word('L13', 24) - .4;   // “好让地上想家的人”
  return {
    S,
    update(t) {
      const fl = clamp(t / (tDown + 1));
      ce.position.set(lerp(-.09, .07, eio(fl)), .07 + lerp(-.02, .02, fl) + .004 * Math.sin(t * 1.3), -.09); ce.rotation.z = .12 + .03 * Math.sin(t * .9);
      rb1.userData.wave(t, .016, 1.2, 3.2, 0); rb2.userData.wave(t, .013, 1.4, 3.6, 1.5);
      bunny.position.y = .02 + .003 * Math.sin(t * 1.7); clouds.position.x = t * .002;
      const dn = eio(seg(t, tDown, E.dur - .2));
      aim(S.cam, [lerp(-.02, 0, fl), lerp(.07, -.12, dn), lerp(.34, .44, dn), lerp(-.01, 0, fl), lerp(.07, -.08, dn), -.1], t);
    },
    post() { return { focus: lerp(.44, S.cam.position.z + .06, 1), aper: 12, maxCoc: 12, bloom: { strength: .35, radius: .6, threshold: 1.25 } }; },
    grade() { return { expo: 1.05, vig: .45, sat: 1.02, contrast: .1 }; },
  };
  function drawTown(x, g) {
    const R = mulberry(4), c = x || g;
    if (x) { x.fillStyle = '#26345e'; ridge(x, { x0: -.35, x1: .35, base: -.02, amp: .004, seed: 1, freq: 30 }); }
    for (let i = 0; i < 14; i++) {
      const cx = -.33 + i * .05 + R() * .01, w = .036 + R() * .014, h = .02 + R() * .02, by = -.05 + R() * .01;
      const wins = [[w * .2, h * .35, w * .15, h * .3], [w * .62, h * .35, w * .15, h * .3]];
      jiangnanHouse(x, { cx, by, w, h, windows: wins, wall: '#3b4e80', tile: '#1b284f' }, g);
    }
  }
}
