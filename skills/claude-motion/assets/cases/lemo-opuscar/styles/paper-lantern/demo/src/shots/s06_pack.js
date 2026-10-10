// S6 · 装盒：月饼放进礼盒 → 压上字条 → 写好地址 → 合盖（“于是，我出发了”）
import * as THREE from 'three';
import { sheet, skyPanel, text, vtext } from '../paper.js';
import { osmanthus, FONT } from '../art.js';
import { boxFront, label, cake3q, pendant } from '../props.js';
import { arm } from '../people.js';
import { cakeFace } from './s03_press.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, eo, ei, lerp, clamp, back, TAU } from '../lib.js';

export function giftBox(S, E, o = {}) {   // 返回 {inner, front, lid}；盒子中心 cx，底 by，宽 w，前脸高 h
  const { U } = S, { cx = 0, by = -.06, w = .17, h = .07, z = -.06, col = '#9e2a20', dark = '#5e1510', gold = '#d9a441', to = '小满 收' } = o;
  const inner = S.add(sheet({ U, w: w + .02, h: h + .06, x: cx, y: by + h / 2 + .02, z: z - .012, trans: .2, draw: x => {
    x.fillStyle = dark; x.fillRect(-w / 2, -h / 2 - .02, w, h + .03);
    x.fillStyle = '#c99a4a'; x.fillRect(-w / 2 + .004, -h / 2 - .02, w - .008, h * .15);   // 金色衬纸
  } }));
  const front = S.add(sheet({ U, w: w + .02, h: h + .02, x: cx, y: by + h / 2, z, trans: .2, draw: x => {
    boxFront(x, 0, -h / 2, w, h, col, gold);
    if (to) label(x, w * .22, 0, w * .3, h * .52, [[to, h * .07, h * .16], ['外婆 寄', -h * .13, h * .09]], { rot: -.04, font: FONT.xing });
    text(x, '月', -w * .24, 0, h * .38, FONT.brush, { fill: gold });
  } }));
  const lid = S.add(sheet({ U, w: w + .03, h: h * .5, x: cx, y: by + h + .004, z: z + .003, trans: .2, draw: x => {
    x.fillStyle = col; x.fillRect(-w / 2 - .005, -h * .2, w + .01, h * .4);
    x.strokeStyle = gold; x.lineWidth = h * .025; x.strokeRect(-w / 2, -h * .15, w, h * .3);
    for (let i = 0; i < 9; i++) { x.fillStyle = gold; x.beginPath(); x.arc(-w * .4 + i * w * .1, 0, h * .03, 0, TAU); x.fill(); }
    text(x, '中秋', 0, 0, h * .2, FONT.brush, { fill: gold });
  } }));
  return { inner, front, lid };
}

export function build(E) {
  const S = stage({ light: [-.05, .1, -.1], lightR: .2, lightCol: '#ffcf96', key: 1.2, amb: .2, ambCol: '#c08a60', keyCol: '#ffdcb4', keyPos: [-.05, .28, .26] });
  const { U } = S;
  S.add(skyPanel({ w: .6, h: .36, z: -.14, stops: [[0, '#3a1e10'], [.6, '#7a4524'], [1, '#9a5a30']] }));
  S.add(sheet({ U, w: .6, h: .36, z: -.12, trans: .6, glow: 2.2, glowCol: '#ffc070', draw: x => { x.fillStyle = '#6a3a1c'; x.fillRect(-.3, -.18, .6, .36); x.fillStyle = '#4a2612'; for (let i = 0; i < 8; i++) x.fillRect(-.3, -.18 + i * .05, .6, .002); pendant(x, -.12, .09, .05, '#3a1d10'); }, glowDraw: g => pendant(g, -.12, .09, .05, '#000', g) }));
  const B = giftBox(S, E, { cx: .0, by: -.06, z: -.06 });
  const cakeDraw = x => cake3q(x, 0, 0, .03, y => cakeFace(y, .03, 'color', { base: '#b8742c', hi: '#e9b25c', lo: '#6a3812' }));
  const cake = S.add(sheet({ U, w: .08, h: .06, z: -.0655, trans: .1, metal: .55, rough: .35, envMap: E.env, envI: 1.1, draw: cakeDraw }));
  const handL = S.add(sheet({ U, w: .2, h: .2, z: -.064, trans: .05, draw: x => { x.fillStyle = '#2e170d'; x.translate(-.1, .06); arm(x, .4, -.35, -.25, { L1: .12, L2: .1, w: .05, sleeve: 1.25 }); } }));
  const handR = S.add(sheet({ U, w: .2, h: .2, z: -.064, trans: .05, draw: x => { x.fillStyle = '#2e170d'; x.translate(.1, .06); x.scale(-1, 1); arm(x, .4, -.35, -.25, { L1: .12, L2: .1, w: .05, sleeve: 1.25 }); } }));
  const note = S.add(sheet({ U, w: .09, h: .05, z: -.063, trans: .6, draw: x => {
    x.fillStyle = '#f5ecd6'; x.save(); x.rotate(.05); x.fillRect(-.035, -.012, .07, .024); x.fillStyle = '#c0392b'; x.fillRect(-.035, .008, .07, .0012);
    x.fillStyle = '#b8a888'; x.fillRect(-.0005, -.012, .001, .024); x.restore();
  } }));
  const hand3 = S.add(sheet({ U, w: .2, h: .2, z: -.062, trans: .05, draw: x => { x.fillStyle = '#2e170d'; x.translate(.12, .08); x.scale(-1, 1); arm(x, .4, -.5, -.1, { L1: .12, L2: .1, w: .05, sleeve: 1.25 }); } }));
  S.add(sheet({ U, w: .6, h: .3, z: -.05, trans: .05, draw: x => { x.fillStyle = '#2a1409'; x.fillRect(-.3, -.15, .6, .09); x.fillStyle = '#3a1c0e'; x.fillRect(-.3, -.062, .6, .004); } }));
  S.add(sheet({ U, w: .62, h: .38, z: -.012, trans: .05, glow: .4, glowCol: '#ffc766', draw: x => { x.fillStyle = '#1a0c06'; osmanthus(x, { cx: -.2, by: -.16, h: .16, flowers: '#6a4a24', seed: 11, leaves: 50, nFlowers: 40 }); x.fillRect(-.24, -.19, .08, .05); } }));
  const t0 = E.cue('L09'), tNote = E.word('L09', 8) + .1, tLabel = E.word('L09', 14) - .1, tLid = E.cue('L10') - .45, tEnd = E.dur;
  return {
    S,
    update(t) {
      // 双手把月饼放进盒子
      const dn = eio(seg(t, .1, 1.5)), out = eio(seg(t, 1.5, 2.1));
      const cy = lerp(.06, -.03, dn);
      cake.position.set(0, cy, -.0655);
      handL.position.set(-.036 - out * .08, cy - .005 + out * .05, 0); handR.position.set(.036 + out * .08, cy - .005 + out * .05, 0);
      handL.position.z = handR.position.z = -.064;
      // 字条
      const nt = eio(seg(t, tNote - .7, tNote)), no = eio(seg(t, tNote + .1, tNote + .7));
      note.position.set(lerp(.1, .0, nt), lerp(.08, .012, nt), -.063); note.rotation.z = lerp(.4, 0, nt); note.visible = t > tNote - .75;
      hand3.position.set(lerp(.1, .0, nt) + no * .1, lerp(.08, .012, nt) + no * .06, -.062); hand3.visible = note.visible && no < .99;
      // 合盖
      const ld = ei(seg(t, tLid - .5, tLid));
      B.lid.position.y = lerp(.16, -.06 + .07 + .004, ld);
      // 镜头：中景 → 推近面单 → 合盖后推向盖子上的“中秋”并压暗
      const toLabel = eio(seg(t, tLabel - .3, tLabel + .9)), toLid = eio(seg(t, tLid, tEnd));
      const px = lerp(lerp(0, .036, toLabel), 0, toLid), py = lerp(lerp(.0, -.03, toLabel), .012, toLid), z = lerp(lerp(.3, .2, toLabel), .15, toLid);
      const shake = t > tLid ? .0012 * Math.exp(-(t - tLid) * 10) * Math.sin((t - tLid) * 60) : 0;
      aim(S.cam, [px, py + .004 + shake, z, px, py + shake, -.06], t);
    },
    post() { return { focus: S.cam.position.z + .06, aper: 14, maxCoc: 14, bloom: { strength: .35, radius: .6, threshold: 1.2 } }; },
    grade(t) { return { expo: 1.0, vig: .5, sat: 1.0, contrast: .1, lift: [.012, .006, 0], fade: 1 - ss(seg(t, tEnd - 1.0, tEnd)) }; },
  };
}
