// S2 · 外婆的厨房（“我是一块月饼，出生在外婆的厨房。”）
import * as THREE from 'three';
import { sheet, skyPanel, moon, setMoon } from '../paper.js';
import { osmanthus, lantern, mooncake, xiangyun, FONT } from '../art.js';
import { roundWindow, steamers, stove, jar, bowl, pendant, calendar, table, cut } from '../props.js';
import { grannyStand, arm, GRAN_SHOULDER } from '../people.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, lerp, clamp, mulberry, TAU } from '../lib.js';

export function kitchenSet(S, o = {}) {
  const { U } = S;
  const WIN = o.win || [.1, .052];
  const sky = S.add(skyPanel({ w: .6, h: .36, z: -.14, stops: [[0, '#0d1838'], [1, '#2e4274']], stars: 60 }));
  const mn = S.add(moon({ x: WIN[0] + .012, y: WIN[1] + .012, z: -.135, r: .018, gain: 1.9, halo: 3.5, haloGain: .35 }));
  const branch = S.add(sheet({ U, w: .2, h: .16, x: WIN[0], y: WIN[1], z: -.125, trans: .3, glow: .5, glowCol: '#ffcf70', draw: x => { x.fillStyle = '#26345c'; osmanthus(x, { cx: .05, by: -.1, h: .1, flowers: '#d9a24a', seed: 3, leaves: 30, nFlowers: 25 }); }, glowDraw: g => { g.fillStyle = '#000'; osmanthus(g, { cx: .05, by: -.1, h: .1, flowers: '#fff', seed: 3, leaves: 30, nFlowers: 25 }); } }));
  const wall = S.add(sheet({ U, w: .6, h: .36, z: -.112, trans: .9, draw: x => {
    x.fillStyle = '#b08058'; x.fillRect(-.3, -.18, .6, .36);
    x.fillStyle = '#9a5f2e'; for (let i = 0; i < 9; i++) x.fillRect(-.3, -.18 + i * .045, .6, .0012);   // 砖缝感的横纹
    x.fillStyle = '#5a321a'; roundWindow(x, WIN[0], WIN[1], .042, .0016, 'ice');
    x.fillStyle = '#5a321a'; x.fillRect(-.3, .118, .6, .014);   // 房梁
  } }));
  const deco = S.add(sheet({ U, w: .6, h: .36, z: -.1, trans: .25, glow: 0, draw: x => {
    calendar(x, -.02, .06, .026, '#efe2c4', '#3a2014', '#b8322a');
    x.fillStyle = '#4a2814';   // 挂着的辣椒串、蒜
    x.fillRect(-.075, .06, .0012, .06);
    for (let i = 0; i < 9; i++) { x.fillStyle = i % 2 ? '#a3291f' : '#b8322a'; x.beginPath(); x.ellipse(-.075 + (i % 2 ? .004 : -.004), .052 - i * .0055, .0035, .0065, (i % 2 ? .5 : -.5), 0, TAU); x.fill(); }
    x.fillStyle = '#e9dcc0'; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(-.058, .06 - i * .008, .0045, 0, TAU); x.fill(); }
    x.fillStyle = '#4a2814'; x.fillRect(-.058, .06, .001, .06);
  } }));
  const back = S.add(sheet({ U, w: .6, h: .36, z: -.084, trans: .2, glow: 1.4, glowCol: '#ff9a40', draw: x => {
    x.fillStyle = '#6e3b1f';
    x.fillRect(-.27, .0, .1, .004); x.fillRect(-.27, .045, .1, .004);    // 左侧搁架
    x.fillStyle = '#6e3b1f'; jar(x, -.25, .004, .022, .026); jar(x, -.225, .004, .016, .02); bowl(x, -.195, .004, .022, .01); bowl(x, -.195, .014, .02, .009);
    jar(x, -.255, .049, .016, .022); jar(x, -.232, .049, .02, .028); x.fillRect(-.212, .049, .012, .03);
    stove(x, .205, -.1, .11, .07, '#6e3b1f', '#ffb45a');
    steamers(x, .205, -.022, .075, 3, '#8a5129', '#6e3b1f');
  }, glowDraw: g => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(.205 - .11 * .14, -.1); g.lineTo(.205 - .11 * .14, -.1 + .07 * .3); g.arc(.205, -.1 + .07 * .3, .11 * .14, Math.PI, 0, true); g.lineTo(.205 + .11 * .14, -.1); g.fill(); } }));
  // 蒸汽
  const steam = S.add(sheet({ U, w: .12, h: .16, x: .205, y: .09, z: -.08, trans: .9, shadow: false, recv: false, draw: x => {
    x.strokeStyle = '#f3e3c8'; x.lineCap = 'round';
    for (const [dx, ph, w] of [[-.015, 0, .006], [.008, 1.7, .0075], [.025, 3.1, .005]]) {
      x.lineWidth = w; x.beginPath();
      for (let i = 0; i <= 40; i++) { const u = i / 40, y = -.07 + u * .14, px = dx + .008 * Math.sin(u * 7 + ph) * u; i ? x.lineTo(px, y) : x.moveTo(px, y); }
      x.stroke();
    }
  } }));
  steam.material.transparent = true; steam.material.alphaToCoverage = false; steam.material.depthWrite = false;
  const lamp = S.add(sheet({ U, w: .08, h: .1, x: -.02, y: .1, z: -.068, trans: .1, glow: 3.2, glowCol: '#ffc878', ay: .04, draw: x => pendant(x, 0, .02, .045, '#3a1d10'), glowDraw: g => pendant(g, 0, .02, .045, '#000', g) }));
  return { sky, mn, branch, wall, deco, back, steam, lamp };
}

export function build(E) {
  const LAMP = [-.02, .075, -.068];
  const S = stage({ light: LAMP, lightR: .11, lightCol: '#ffcf96', key: 1.0, amb: .16, ambCol: '#c08a60', keyCol: '#ffd9ae', keyPos: [-.02, .3, .28] });
  const { U } = S;
  const K = kitchenSet(S);
  // 外婆（站在桌后，揉面）
  const GX = -.085, GY = -.118, GS = .165;
  const gran = S.add(sheet({ U, w: .12, h: .2, x: GX, y: GY + .08, z: -.056, trans: .08, draw: x => { x.fillStyle = '#2e170d'; x.translate(0, -.08); grannyStand(x, GS, { pin: '#2e170d' }); } }));
  const shoulder = [GX + GRAN_SHOULDER[0] * GS, GY + GRAN_SHOULDER[1] * GS];
  const armS = S.add(sheet({ U, w: .12, h: .12, x: shoulder[0], y: shoulder[1], z: -.0555, trans: .08, ax: 0, ay: 0, draw: x => { x.fillStyle = '#2e170d'; arm(x, GS, -.75, .85, { sleeve: 1.25, wrist: .2 }); } }));
  const armF = S.add(sheet({ U, w: .12, h: .12, x: shoulder[0], y: shoulder[1], z: -.0505, trans: .08, draw: x => { x.fillStyle = '#3a1e12'; arm(x, GS, -.95, 1.15, { sleeve: 1.25, wrist: -.1 }); } }));
  // 桌 + 面团 + 碗 + 擀面杖 + 一盘做好的月饼
  const tbl = S.add(sheet({ U, w: .6, h: .3, z: -.04, trans: .08, draw: x => {
    x.fillStyle = '#3a1c0e'; table(x, -.01, -.04, .3, .08, .01);
    x.fillStyle = '#e8cf9d'; x.beginPath(); x.ellipse(-.02, -.033, .02, .008, 0, 0, TAU); x.fill();       // 面团
    x.fillStyle = '#3a1c0e'; bowl(x, .05, -.04, .036, .018); x.fillStyle = '#7a3a22'; x.beginPath(); x.ellipse(.05, -.023, .016, .003, 0, 0, TAU); x.fill();
    x.fillStyle = '#6b4024'; x.beginPath(); x.roundRect(-.07, -.04, .05, .005, .0025); x.fill();
    x.fillStyle = '#3a1c0e'; x.beginPath(); x.roundRect(.075, -.04, .07, .005, .002); x.fill();   // 托盘
  } }));
  const cakes = S.add(sheet({ U, w: .08, h: .03, x: .11, y: -.028, z: -.039, trans: 0, metal: .75, rough: .38, envMap: E.env, envI: .8, draw: x => {
    for (let i = 0; i < 3; i++) { x.fillStyle = '#d19a45'; x.beginPath(); x.roundRect(-.03 + i * .021, -.008, .018, .012, .003); x.fill(); x.fillStyle = '#a86c28'; x.fillRect(-.03 + i * .021, -.004, .018, .0012); }
  } }));
  const fg = S.add(sheet({ U, w: .62, h: .38, z: -.014, trans: .04, draw: x => {
    x.fillStyle = '#1a0c06';
    x.fillRect(-.31, -.19, .6, .06);                                    // 前景灶台边
    x.fillRect(-.31, -.19, .045, .38);                                   // 门框
    x.beginPath(); x.moveTo(-.265, .19); x.quadraticCurveTo(-.24, .06, -.262, -.02); x.lineTo(-.265, -.02); x.fill();   // 门帘
    jar(x, .22, -.13, .05, .06);
    lantern(x, { cx: .23, cy: .11, r: .014, col: '#1a0c06', rib: '#1a0c06', cap: '#1a0c06', stringLen: .1 });
  } }));
  return {
    S,
    update(t) {
      const k = Math.sin(t * 5.2);   // 揉面节奏
      armS.rotation.z = .1 * k; armF.rotation.z = -.1 * k;
      K.steam.position.y = .09 + (t * .004) % .01; K.steam.material.opacity = .35 + .1 * Math.sin(t * 1.3);
      K.lamp.rotation.z = .01 * Math.sin(t * .8);
      K.lamp.material.userData.u.uGlowLit.value = 1 + .04 * Math.sin(t * 9.1) * Math.sin(t * 3.7);
      const u = eio(clamp(t / E.dur));
      aim(S.cam, [lerp(.02, -.02, u), lerp(.0, -.012, u), lerp(.5, .38, u), lerp(.02, -.025, u), lerp(-.005, -.025, u), -.06], t);
    },
    post() { return { focus: S.cam.position.z + .056, aper: 16, maxCoc: 12, bloom: { strength: .4, radius: .6, threshold: 1.1 } }; },
    grade() { return { expo: 1.02, vig: .45, sat: 1.02, contrast: .1, lift: [.012, .006, .0], gain: [1.02, 1., .96] }; },
  };
}
