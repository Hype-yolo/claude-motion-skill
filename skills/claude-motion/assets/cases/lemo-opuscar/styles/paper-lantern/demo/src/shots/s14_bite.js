// S14 · 咬一口：小满侧脸特写；窗外的城市化成小时候——桂花树下外婆牵着她看月亮；眼睛红了（一点泪光）
import * as THREE from 'three';
import { sheet, skyPanel, moon, setMoon } from '../paper.js';
import { osmanthus, karst, jiangnanHouse, FONT } from '../art.js';
import { girlStand, grannyStand, childStand, arm, GIRL_SHOULDER } from '../people.js';
import { cake3q } from '../props.js';
import { cakeFace } from './s03_press.js';
import { towers } from './s11_city.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, eo, lerp, clamp, mulberry, TAU } from '../lib.js';

export function build(E) {
  const S = stage({ light: [-.02, .06, -.12], lightR: .16, lightCol: '#ffe6c0', key: .9, amb: .22, ambCol: '#8a86c8', keyCol: '#ffe0bc', keyPos: [.1, .25, .26] });
  const { U } = S;
  const WX = .09, WY = .03, WW = .2, WH = .15;
  S.add(skyPanel({ w: .5, h: .32, z: -.15, stops: [[0, '#150f2e'], [.6, '#2a2152'], [1, '#5a4270']], stars: 30 }));
  const mn = S.add(moon({ x: WX + .03, y: WY + .045, z: -.145, r: .016, gain: 1.4, halo: 3.5, haloGain: .25 }));
  const city = S.add(sheet({ U, w: .5, h: .32, z: -.13, trans: .4, glow: 1.4, glowCol: '#ffd08a', ppm: 3600, draw: x => towers(x, null, { x0: -.1, x1: .25, by: WY - WH / 2, col: '#2e2656', win: '#f2cf8a', dark: '#262048', seed: 8, hmin: .03, hmax: .09, wmin: .015, wmax: .03, cell: .003, lit: .35, gap: .004 }), glowDraw: g => towers(null, g, { x0: -.1, x1: .25, by: WY - WH / 2, col: '', seed: 8, hmin: .03, hmax: .09, wmin: .015, wmax: .03, cell: .003, lit: .35, gap: .004 }), glowRes: .8 }));
  // 回忆：暖色的旧时光（在城市前面，淡入）
  const mem = S.add(sheet({ U, w: .5, h: .32, z: -.125, trans: .6, glow: 1.2, glowCol: '#ffc766', draw: x => {
    const gr = x.createLinearGradient(0, WY + WH / 2, 0, WY - WH / 2); gr.addColorStop(0, '#6a4a70'); gr.addColorStop(1, '#c08a58'); x.fillStyle = gr; x.fillRect(WX - WW / 2, WY - WH / 2, WW, WH);
    x.fillStyle = '#8a5a48'; karst(x, { x0: WX - WW / 2, x1: WX + WW / 2, base: WY - .02, peaks: [[WX - .06, .025, .02], [WX + .01, .035, .025], [WX + .07, .02, .02]] });
    x.fillStyle = '#4a2a20'; x.fillRect(WX - WW / 2, WY - WH / 2, WW, .035);
    osmanthus(x, { cx: WX - .05, by: WY - WH / 2 + .03, h: .09, flowers: '#e8b04a', seed: 4, leaves: 30, nFlowers: 40 });
    x.fillStyle = '#4a2a20'; x.save(); x.translate(WX + .03, WY - WH / 2 + .033); grannyStand(x, .05); x.translate(.018, 0); childStand(x, .028); x.restore();
  }, glowDraw: g => { g.fillStyle = '#000'; osmanthus(g, { cx: WX - .05, by: WY - WH / 2 + .03, h: .09, flowers: '#fff', seed: 4, leaves: 30, nFlowers: 40 }); } }));
  mem.material.transparent = true; mem.material.alphaToCoverage = false; mem.material.depthWrite = false;
  S.add(sheet({ U, w: .5, h: .32, z: -.1, trans: .7, draw: x => {
    x.fillStyle = '#8a7fa8'; x.fillRect(-.25, -.16, .5, .32); x.fillStyle = '#7a7098'; for (let i = 0; i < 10; i++) x.fillRect(-.25 + i * .05, -.16, .0012, .32);
    x.save(); x.globalCompositeOperation = 'destination-out'; x.fillRect(WX - WW / 2, WY - WH / 2, WW, WH); x.restore();
    x.strokeStyle = '#1e1b32'; x.lineWidth = .004; x.strokeRect(WX - WW / 2, WY - WH / 2, WW, WH); x.fillStyle = '#1e1b32'; x.fillRect(WX - .0015, WY - WH / 2, .003, WH);
  } }));
  // 小满侧脸（大尺寸半身）
  const GS = .42, GX = -.08, GY = -.34;
  const girl = S.add(sheet({ U, w: .5, h: .32, z: -.06, trans: .05, draw: x => { x.fillStyle = '#15122a'; x.translate(GX, GY); girlStand(x, GS); } }));
  const sh = [GX + GIRL_SHOULDER[0] * GS, GY + GIRL_SHOULDER[1] * GS];
  // 手 + 月饼（举到嘴边）
  const hand = new THREE.Group(); hand.position.set(sh[0], sh[1], -.058); S.scene.add(hand);
  const armM = sheet({ U, w: .3, h: .3, trans: .05, draw: x => { x.fillStyle = '#1b1732'; arm(x, GS, .05, 2.26, { w: .04, wrist: -.4 }); } });
  hand.add(armM);
  const face = x => cakeFace(x, .018, 'color', { base: '#b8742c', hi: '#e9b25c', lo: '#6a3812' });
  const mk = bite => sheet({ U, w: .05, h: .04, trans: .1, metal: .5, rough: .36, envMap: E.env, envI: 1.1, draw: x => { cake3q(x, 0, 0, .018, face, { k: .5 }); if (bite) { x.save(); x.globalCompositeOperation = 'destination-out'; for (const [bx, by, r] of [[.017, .003, .007], [.02, -.004, .006], [.014, .009, .005]]) { x.beginPath(); x.arc(bx, by, r, 0, TAU); x.fill(); } x.restore(); } } });
  const cakeA = mk(false), cakeB = mk(true);
  const handTip = (() => { const L1 = .175 * GS, L2 = .155 * GS, a = .05, b = 2.26; return [Math.cos(a) * L1 + Math.cos(a + b) * L2, Math.sin(a) * L1 + Math.sin(a + b) * L2]; })();
  for (const c of [cakeA, cakeB]) { c.position.set(handTip[0] + .01, handTip[1] + .006, .001); c.rotation.z = .35; hand.add(c); }
  cakeB.visible = false;
  // 泪光
  const tear = new THREE.Mesh(new THREE.CircleGeometry(.0011, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#e8f0ff').multiplyScalar(1.3), transparent: true }));
  const eye = [GX + .066 * GS, GY + .94 * GS]; tear.position.set(eye[0], eye[1], -.059); S.scene.add(tear);
  S.add(sheet({ U, w: .52, h: .34, z: -.015, trans: .02, draw: x => { x.fillStyle = '#0a0816'; x.fillRect(-.26, -.17, .52, .03); } }));
  const tB = E.word('L18', 1) + .05, tMem0 = E.word('L18', 5) - .2, tMem1 = E.word('L18', 11) + .3, tTear = E.word('L18', 15) - .25;
  return {
    S,
    update(t) {
      // 抬手（开场前 0.6s 已在抬）→ 咬 → 放低
      const up = eio(seg(t, 0, tB)), dn = eio(seg(t, tB + .45, tB + 1.4));
      hand.rotation.z = lerp(-.55, 0, up) - .2 * dn; hand.position.y = sh[1] - .03 * (1 - up) - .012 * dn;
      cakeA.visible = t < tB + .05; cakeB.visible = !cakeA.visible;
      const chew = t > tB && t < tB + 1.2 ? .002 * Math.sin((t - tB) * 18) * (1 - (t - tB) / 1.2) : 0;
      girl.position.y = chew * .3;
      // 窗外化成回忆
      const mk2 = ss(seg(t, tMem0, tMem0 + 1.0)) * (1 - ss(seg(t, tMem1 + 1.2, tMem1 + 2.2)));
      mem.material.opacity = mk2; mem.visible = mk2 > .01; mem.material.userData.u.uGlowLit.value = mk2;
      // 泪光：闪一下，慢慢滑下一点
      const tk = seg(t, tTear, tTear + 1.6); tear.visible = t > tTear; tear.material.opacity = Math.sin(Math.PI * clamp(tk * 1.1)) * .75; tear.position.set(eye[0] - .004 * eo(tk), eye[1] - .006 - .016 * eo(tk), -.059);
      const u = eio(clamp(t / E.dur));
      aim(S.cam, [lerp(-.005, .005, u), lerp(.05, .052, u), lerp(.3, .25, u), lerp(.0, .01, u), lerp(.04, .045, u), -.07], t);
    },
    post() { return { focus: S.cam.position.z + .06, aper: 20, maxCoc: 18, bloom: { strength: .4, radius: .6, threshold: 1.1 } }; },
    grade() { return { expo: 1.02, vig: .52, sat: 1.0, contrast: .1, lift: [.006, 0, .018] }; },
  };
}
