// S8 · 夜车车窗：窗外树影飞快后退，月亮不动；小桌上的礼盒随车摇晃（“原来这就是想家”）
import * as THREE from 'three';
import { sheet, skyPanel, moon } from '../paper.js';
import { karst, pine, osmanthus, ridge, FONT } from '../art.js';
import { boxFront } from '../props.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, lerp, clamp, mulberry, TAU } from '../lib.js';

function scroller(S, o) {   // 可平铺滚动的纸层
  const m = S.add(sheet({ U: S.U, w: o.w, h: o.h, x: o.x || 0, y: o.y || 0, z: o.z, trans: o.trans, ppm: o.ppm || 3000, draw: x => { for (const k of [-1, 0, 1]) { x.save(); x.translate(k * o.w, 0); o.draw(x); x.restore(); } } }));
  m.material.map.wrapS = THREE.RepeatWrapping; return m;
}

export function build(E) {
  const WN = [0, .035], WW = .2, WH = .12;
  const S = stage({ light: [.05, .07, -.14], lightR: .12, lightCol: '#e0e8ff', key: 1.1, amb: .25, ambCol: '#c08a60', keyCol: '#ffd9ae', keyPos: [-.06, .25, .26] });
  const { U } = S;
  S.add(skyPanel({ w: .5, h: .3, z: -.15, stops: [[0, '#0b1636'], [.6, '#1c3163'], [1, '#34497c']], stars: 90 }));
  S.add(moon({ x: .055, y: .065, z: -.145, r: .02, gain: 1.9, halo: 4, haloGain: .35 }));
  const far = scroller(S, { w: .6, h: .3, z: -.125, trans: .6, draw: x => { x.fillStyle = '#4f6aa2'; const R = mulberry(2), pk = []; for (let u = -.3; u < .3; u += .04 + R() * .02) pk.push([u, .02 + R() * .03, .018]); karst(x, { x0: -.3, x1: .3, base: -.01, peaks: pk, carve: .0005 }); } });
  const near = scroller(S, { w: .6, h: .3, z: -.1, trans: .15, draw: x => { x.fillStyle = '#131c3c'; const R = mulberry(6); for (let i = 0; i < 6; i++) { const px = -.28 + i * .1 + R() * .03; if (i % 2) pine(x, { cx: px, by: -.1, h: .12 + R() * .05, seed: i }); else osmanthus(x, { cx: px, by: -.1, h: .1 + R() * .03, seed: i, leaves: 20 }); } ridge(x, { x0: -.3, x1: .3, base: -.02, amp: .004, seed: 3, freq: 30 }); x.fillRect(-.3, -.15, .6, .12); } });
  const poles = scroller(S, { w: .9, h: .3, z: -.085, trans: .05, draw: x => { x.fillStyle = '#0a1024'; x.fillRect(-.45, .085, .9, .0008); x.fillRect(-.45, .075, .9, .0008); x.fillRect(-.3, -.15, .006, .25); x.fillRect(-.31, .08, .026, .003); } });
  // 车厢内壁：挖出车窗
  const wall = S.add(sheet({ U, w: .5, h: .3, z: -.06, trans: .15, draw: x => {
    x.fillStyle = '#6e4428'; x.fillRect(-.25, -.15, .5, .3);
    x.fillStyle = '#5a361f'; for (let i = 0; i < 12; i++) x.fillRect(-.25 + i * .045, -.15, .0015, .3); x.fillRect(-.25, -.045, .5, .004);
    x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.roundRect(WN[0] - WW / 2, WN[1] - WH / 2, WW, WH, .014); x.fill(); x.restore();
    x.fillStyle = '#3e2414'; x.lineWidth = .006; x.strokeStyle = '#3e2414'; x.beginPath(); x.roundRect(WN[0] - WW / 2, WN[1] - WH / 2, WW, WH, .014); x.stroke();
    x.fillRect(WN[0] - WW / 2, WN[1] - .002, WW, .003);   // 窗的横框
    // 窗帘（系在两侧）
    x.fillStyle = '#2f5a48';
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * (WW / 2 + .01), WN[1] + WH / 2 + .01); x.lineTo(s * (WW / 2 - .02), WN[1] + WH / 2 + .01); x.quadraticCurveTo(s * (WW / 2 - .012), WN[1], s * (WW / 2 + .005), WN[1] - .03); x.quadraticCurveTo(s * (WW / 2 + .012), WN[1] - .06, s * (WW / 2 + .03), WN[1] - .065); x.lineTo(s * (WW / 2 + .03), WN[1] + WH / 2 + .01); x.closePath(); x.fill(); }
    x.fillStyle = '#e8d9a8'; for (const s of [-1, 1]) x.fillRect(s * (WW / 2 + .004) - .008, WN[1] - .032, .016, .004);
  } }));
  // 小桌 + 礼盒 + 茶杯
  const tbl = S.add(sheet({ U, w: .5, h: .3, z: -.048, trans: .05, draw: x => { x.fillStyle = '#2e1a0e'; x.fillRect(-.12, -.035, .24, .008); x.fillRect(-.004, -.15, .008, .12); x.beginPath(); x.moveTo(-.06, -.043); x.lineTo(.06, -.043); x.lineTo(.004, -.07); x.lineTo(-.004, -.07); x.fill(); } }));
  const box = S.add(sheet({ U, w: .1, h: .06, x: -.03, y: -.008, z: -.046, trans: .15, draw: x => { boxFront(x, 0, -.02, .075, .036, '#9e2a20', '#d9a441'); x.fillStyle = '#9e2a20'; x.fillRect(-.04, .015, .08, .006); } }));
  const cup = S.add(sheet({ U, w: .04, h: .05, x: .065, y: -.015, z: -.046, trans: .5, draw: x => { x.fillStyle = 'rgba(230,240,235,.9)'; x.beginPath(); x.moveTo(-.008, -.012); x.lineTo(.008, -.012); x.lineTo(.01, .014); x.lineTo(-.01, .014); x.fill(); x.fillStyle = '#b8862e'; x.fillRect(-.009, -.01, .018, .016); } }));
  S.add(sheet({ U, w: .52, h: .32, z: -.015, trans: .03, draw: x => { x.fillStyle = '#150b05'; x.beginPath(); x.roundRect(-.26, -.16, .07, .22, .02); x.fill(); x.beginPath(); x.roundRect(.19, -.16, .07, .24, .02); x.fill(); x.fillStyle = '#e8dcc2'; x.fillRect(.195, .03, .06, .035); } }));
  return {
    S,
    update(t) {
      far.material.map.offset.x = t * .012; near.material.map.offset.x = t * .16; poles.material.map.offset.x = t * .35;
      const rock = Math.sin(t * 7.5) * .5 + Math.sin(t * 13.1) * .3;
      box.rotation.z = .012 * rock; box.position.y = -.008 + .0006 * Math.abs(Math.sin(t * 9)); cup.position.y = -.015 + .0005 * Math.abs(Math.sin(t * 9 + 1));
      const u = eio(clamp(t / E.dur));
      aim(S.cam, [lerp(.0, -.02, u), lerp(.0, -.005, u) + .0006 * Math.sin(t * 8), lerp(.36, .27, u), lerp(.005, -.02, u), lerp(.01, .0, u), -.06], t, { roll: .004 * Math.sin(t * 3.1), hand: .0008 });
    },
    post() { return { focus: S.cam.position.z + .046, aper: 16, maxCoc: 14, bloom: { strength: .35, radius: .6, threshold: 1.2 } }; },
    grade() { return { expo: 1.0, vig: .5, sat: 1.0, contrast: .1, lift: [.012, .006, 0], gain: [1.03, 1, .95] }; },   // 车厢内景保持暖调（v1 成片里继承自 S06 的值，现显式写出）
  };
}
