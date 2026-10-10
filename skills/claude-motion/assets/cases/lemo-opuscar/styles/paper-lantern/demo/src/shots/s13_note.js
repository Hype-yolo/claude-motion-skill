// S13 / S16b · 俯拍盒内：月饼 + 字条，字迹逐列/逐行写出来
// variant 'gran'：外婆的竖排行书；'girl'：小满的横排手写 + 歪扭的“外婆”月饼
import * as THREE from 'three';
import { sheet, text, vtext } from '../paper.js';
import { FONT } from '../art.js';
import { cakeFace } from './s03_press.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, eo, lerp, clamp, mulberry, TAU } from '../lib.js';

// 纸片按行/列“写出”：anchor 在起笔边，缩放 + 贴图裁剪（不挤压字形）
function reveal(m, k, axis) {
  const map = m.material.map; k = Math.max(.001, k);
  if (axis === 'y') { m.scale.y = k; map.repeat.y = k; map.offset.y = 1 - k; }
  else { m.scale.x = k; map.repeat.x = k; map.offset.x = 0; }
}

export function build(E, V = 'gran') {
  const girl = V === 'girl';
  const S = stage({ light: [0, 0, -.06], lightR: .2, lightCol: '#ffd9a8', key: 1.35, amb: .3, ambCol: girl ? '#d0a070' : '#b89ac8', keyCol: '#ffe6c4', keyPos: [-.1, .2, .3], keyTarget: [0, 0, -.06], shadowR: 8 });
  const { U } = S;
  const boxCol = girl ? '#2a4f7a' : '#9e2a20', lining = girl ? '#f1ece0' : '#c99a4a';
  // 盒内（俯视）：盒壁 + 衬纸
  S.add(sheet({ U, w: .5, h: .32, z: -.07, trans: .2, draw: x => {
    x.fillStyle = girl ? '#6a4a36' : '#3a3050'; x.fillRect(-.25, -.16, .5, .32);   // 桌面
    x.fillStyle = boxCol; x.fillRect(-.19, -.11, .38, .22);
    x.fillStyle = lining; x.fillRect(-.175, -.095, .35, .19);
    if (!girl) { x.strokeStyle = '#a87a30'; x.lineWidth = .0008; for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(-.175, -.095 + i * .016); x.lineTo(.175, -.095 + i * .016 + .01); x.stroke(); } }
    else { x.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 30; i++) x.fillRect(-.175 + i * .012, -.095, .0008, .19); }
  } }));
  const cx = girl ? .085 : -.075;
  const cake = S.add(sheet({ U, w: .1, h: .1, x: cx, y: -.005, z: -.064, trans: .1, envMap: E.env, envI: girl ? .6 : 1.1, metal: girl ? .15 : .55, rough: girl ? .5 : .34, bump: 8, bumpBlur: 2.5,
    draw: x => cakeFace(x, .042, 'color', girl ? { base: '#c9924a', hi: '#e2b068', lo: '#8a5a2a', ch: '外婆', wobble: .07, petals: 11, seed: 5 } : { base: '#b8742c', hi: '#e9b25c', lo: '#6a3812' }),
    bumpDraw: x => cakeFace(x, .042, 'bump', girl ? { ch: '外婆', wobble: .07, petals: 11, seed: 5 } : {}) }));
  if (girl) cake.rotation.z = .25;
  // 字条
  const NX = girl ? -.06 : .075, NW = girl ? .15 : .11, NH = girl ? .1 : .15;
  const paper = S.add(sheet({ U, w: NW + .01, h: NH + .01, x: NX, y: .0, z: -.063, trans: .5, draw: x => {
    x.fillStyle = girl ? '#fbf7ee' : '#f4ead2'; x.fillRect(-NW / 2, -NH / 2, NW, NH);
    if (girl) { x.strokeStyle = '#a8c4e0'; x.lineWidth = .0006; for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(-NW / 2 + .006, NH / 2 - .02 - i * .013); x.lineTo(NW / 2 - .006, NH / 2 - .02 - i * .013); x.stroke(); } }
    else { x.fillStyle = 'rgba(192,57,43,.55)'; for (let i = 0; i < 5; i++) x.fillRect(-NW / 2 + .012 + i * .021, -NH / 2 + .008, .0006, NH - .016); }
    x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(-NW / 2, -.0004, NW, .0008);   // 折痕
  } }));
  paper.rotation.z = girl ? -.05 : .04;
  // 字：每列/每行一张纸片，依次写出
  const lines = girl
    ? [['外婆，', -.052, .03, .0105], ['今年换我给你做。', -.052, .017, .0105], ['— 小满', .02, -.022, .0085]]
    : [['月亮圆了，', .036, .06, .0135], ['就算你回过家了。', .014, .06, .0135], ['外婆', -.03, -.03, .01]];
  const inks = lines.map(([s, lx, ly, sz], i) => {
    const vert = !girl, len = [...s].length * sz * (vert ? 1.08 : 1.0), wv = vert ? sz * 1.4 : len + sz, hv = vert ? len + sz : sz * 1.6;
    const m = S.add(sheet({ U, w: wv, h: hv, x: NX + (vert ? lx : lx + wv / 2), y: vert ? ly - hv / 2 : ly, z: -.0625, ax: vert ? 0 : -wv / 2, ay: vert ? hv / 2 : 0, trans: .3, shadow: false, finish: { rim: 0, under: 0, grain: false },
      draw: x => vert ? vtext(x, s, 0, hv / 2 - sz * .6, sz, FONT.xing, { fill: '#2a170c', gap: 1.08 }) : text(x, s, -wv / 2 + sz * .1, 0, sz, FONT.hand, { fill: '#27405e', align: 'left' }) }));
    m.rotation.z = paper.rotation.z; return m;
  });
  // 小满的字条上画个小月亮
  let doodle = null;
  if (girl) doodle = S.add(sheet({ U, w: .03, h: .03, x: NX + .05, y: -.03, z: -.0625, trans: .3, shadow: false, finish: { rim: 0, under: 0, grain: false }, draw: x => { x.strokeStyle = '#d98a2a'; x.lineWidth = .0012; x.beginPath(); x.arc(0, 0, .008, 0, TAU); x.stroke(); x.fillStyle = '#d98a2a'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; x.fillRect(Math.cos(a) * .012 - .0006, Math.sin(a) * .012 - .0006, .0012, .0012); } } }));
  const id = girl ? 'L20' : 'L17', t0 = E.cue(id) + (girl ? 3.3 : -.1), per = girl ? .8 : .85;
  return {
    S,
    update(t) {
      inks.forEach((m, i) => reveal(m, eo(seg(t, t0 + i * per, t0 + i * per + per * 1.05)), girl ? 'x' : 'y'));
      if (doodle) doodle.scale.setScalar(Math.max(.001, eo(seg(t, t0 + 3 * per, t0 + 3 * per + .5))));
      const u = eio(clamp(t / E.dur));
      const fx = girl ? lerp(.01, -.02, u) : lerp(NX * .5, NX * .7, u);
      aim(S.cam, [fx, lerp(-.01, .0, u), lerp(girl ? .31 : .3, .24, u), fx, lerp(-.005, .004, u), -.064], t, { roll: lerp(girl ? -.06 : .06, 0, u) });
    },
    post() { return { focus: S.cam.position.z + .0625, aper: 14, maxCoc: 16, bloom: { strength: .3, radius: .5, threshold: 1.3 } }; },
    grade() { return girl ? { expo: 1.02, vig: .5, sat: 1.02, contrast: .1, lift: [.012, .006, 0] } : { expo: 1.0, vig: .5, sat: 1.0, contrast: .1, lift: [.006, 0, .014] }; },
  };
}
