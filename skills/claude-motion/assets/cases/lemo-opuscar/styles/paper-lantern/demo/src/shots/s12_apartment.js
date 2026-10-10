// S12 · 小满加完班回到公寓：窗外是城市，桌上是外婆寄来的盒子；她掀开盖子，暖光涌出来
import * as THREE from 'three';
import { burst, sheet, skyPanel, moon } from '../paper.js';
import { boxFront } from '../props.js';
import { girlSit, arm, GIRL_SHOULDER } from '../people.js';
import { chair } from '../props.js';
import { towers } from './s11_city.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, eo, lerp, clamp, mulberry, TAU } from '../lib.js';

export function cityWindow(S, o = {}) {   // 墙上大窗 + 窗外城市（给 S12/S14 共用）
  const { U } = S, WX = o.wx ?? -.09, WY = o.wy ?? .045, WW = o.ww ?? .2, WH = o.wh ?? .13;
  S.add(skyPanel({ w: .6, h: .36, z: -.15, stops: [[0, '#150f2e'], [.6, '#2a2152'], [1, '#5a4270']], stars: 20 }));
  const mn = S.add(moon({ x: WX + WW * .3, y: WY + WH * .32, z: -.145, r: .01, gain: 1.1, halo: 3, haloGain: .15, core: '#f4ecdc', mid: '#e8dcc8', edge: '#d8c8b0' }));
  const city = S.add(sheet({ U, w: .6, h: .36, z: -.13, trans: .4, glow: 1.4, glowCol: '#ffd08a', ppm: 3600, draw: x => towers(x, null, { x0: -.3, x1: .3, by: WY - WH / 2 - .01, col: '#2e2656', win: '#f2cf8a', dark: '#262048', seed: 5, hmin: .03, hmax: .1, wmin: .015, wmax: .03, cell: .003, lit: .35, gap: .004, neon: true }), glowDraw: g => towers(null, g, { x0: -.3, x1: .3, by: WY - WH / 2 - .01, col: '', seed: 5, hmin: .03, hmax: .1, wmin: .015, wmax: .03, cell: .003, lit: .35, gap: .004, neon: true }), glowRes: .8 }));
  const wall = S.add(sheet({ U, w: .6, h: .36, z: -.1, trans: .6, draw: x => {
    x.fillStyle = o.wall || '#7e76a0'; x.fillRect(-.3, -.18, .6, .36);
    x.save(); x.globalCompositeOperation = 'destination-out'; x.fillRect(WX - WW / 2, WY - WH / 2, WW, WH); x.restore();
    x.fillStyle = '#23203a'; x.lineWidth = .004; x.strokeStyle = '#23203a'; x.strokeRect(WX - WW / 2, WY - WH / 2, WW, WH); x.fillRect(WX - .0015, WY - WH / 2, .003, WH);
    x.fillStyle = '#6c6890'; x.fillRect(WX - WW / 2 - .01, WY - WH / 2 - .008, WW + .02, .006);   // 窗台
  } }));
  return { mn, city, wall, W: [WX, WY, WW, WH] };
}

export function build(E) {
  const S = stage({ light: [.14, .02, -.08], lightR: .12, lightCol: '#ffcf96', key: 1.0, amb: .25, ambCol: '#8a86c8', keyCol: '#ffe0bc', keyPos: [.08, .28, .26] });
  const { U } = S;
  const CW = cityWindow(S);
  // 台灯 + 桌 + 椅
  S.add(sheet({ U, w: .6, h: .36, z: -.075, trans: .15, glow: 2.6, glowCol: '#ffc878', draw: x => {
    x.fillStyle = '#1e1a30'; x.fillRect(.19, -.03, .004, .07); x.beginPath(); x.moveTo(.17, .05); x.lineTo(.215, .05); x.lineTo(.2, .075); x.lineTo(.185, .075); x.closePath(); x.fill(); x.fillRect(.18, -.032, .03, .004);
    x.fillStyle = '#ffe2a8'; x.beginPath(); x.ellipse(.1925, .049, .02, .003, 0, 0, TAU); x.fill();
  }, glowDraw: g => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(.1925, .049, .02, .003, 0, 0, TAU); g.fill(); } }));
  const GX = -.02, GY = -.07, GS = .16;
  const girl = S.add(sheet({ U, w: .6, h: .36, z: -.06, trans: .06, draw: x => { x.fillStyle = '#16132a'; chair(x, GX - .01, -.165, .1, 1); x.translate(GX, GY); girlSit(x, GS); } }));
  const sh = [GX + GIRL_SHOULDER[0] * GS, GY + (GIRL_SHOULDER[1] - .5) * GS];
  const armS = S.add(sheet({ U, w: .14, h: .14, x: sh[0], y: sh[1], z: -.0595, trans: .06, draw: x => { x.fillStyle = '#16132a'; arm(x, GS, -.2, .25, { w: .04 }); } }));
  S.add(sheet({ U, w: .6, h: .36, z: -.052, trans: .05, draw: x => { x.fillStyle = '#1a1628'; x.fillRect(.0, -.032, .26, .007); x.fillRect(.02, -.18, .006, .15); x.fillRect(.23, -.18, .006, .15);
    x.fillStyle = '#2a2640'; x.save(); x.translate(.2, -.025); x.fillRect(-.028, 0, .045, .003); x.rotate(-1.35); x.fillRect(0, 0, .028, .002); x.restore(); } }));   // 桌 + 笔记本
  const box = S.add(sheet({ U, w: .08, h: .04, x: .1, y: -.014, z: -.05, trans: .2, draw: x => boxFront(x, 0, -.011, .06, .025, '#9e2a20', '#d9a441') }));
  const lid = S.add(sheet({ U, recv: false, shadow: false, w: .08, h: .02, x: .1, y: .0015, z: -.049, trans: .2, draw: x => { x.fillStyle = '#9e2a20'; x.fillRect(-.032, -.004, .064, .008); x.fillStyle = '#d9a441'; x.fillRect(-.03, -.001, .06, .0015); } }));
  // 盒子里涌出的暖光（加色光束）
  const glow = burst(.1, .07);
  glow.position.set(.1, .033, -.0505); S.scene.add(glow);
  S.add(sheet({ U, w: .62, h: .38, z: -.015, trans: .03, draw: x => { x.fillStyle = '#0c0a18'; x.fillRect(-.31, -.19, .62, .03); x.beginPath(); x.moveTo(.31, .19); x.lineTo(.24, .19); x.quadraticCurveTo(.26, .0, .25, -.19); x.lineTo(.31, -.19); x.fill(); } }));
  const tOpen = E.word('L16', 6) - .1;   // “拆开盒子”
  return {
    S,
    update(t) {
      const op = eio(seg(t, tOpen, tOpen + .8));
      armS.rotation.z = lerp(0, .35, ss(seg(t, tOpen - .8, tOpen))) - .1 * op;
      lid.position.set(.1 + op * .03, .0015 + op * .012, -.049); lid.rotation.z = -op * .18;
      const gk = ss(seg(t, tOpen + .2, tOpen + 1.2)); glow.userData.set(gk * 1.1); glow.scale.set(1, .6 + .4 * gk, 1);
      const u = eio(clamp(t / E.dur));
      aim(S.cam, [lerp(-.02, .05, u), lerp(.0, -.01, u), lerp(.4, .3, u), lerp(-.01, .06, u), lerp(-.005, -.012, u), -.07], t);
    },
    post() { return { focus: S.cam.position.z + .055, aper: 16, maxCoc: 14, bloom: { strength: .42, radius: .6, threshold: 1.05 } }; },
    grade() { return { expo: 1.02, vig: .5, sat: 1.0, contrast: .1, lift: [.006, 0, .018], gain: [1, .99, 1.02] }; },
  };
}
