// S17 · 九百多年前的中秋：苏轼临江举杯望月；“但愿人长久，千里共婵娟”逐列写出
import * as THREE from 'three';
import { sheet, skyPanel, moon, setMoon, vtext, text } from '../paper.js';
import { karst, xiangyun, waves, waterTop, willow, reeds, ridge, FONT } from '../art.js';
import { sushi, spline, SUSHI_SHOULDER } from '../people.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, eo, ei, lerp, clamp, mulberry, TAU } from '../lib.js';

export function cloudCurtain(S, z) {   // 近景祥云幕（转场用）：左右两片，前缘是一串云头，面上刻旋涡
  const mk = side => S.add(sheet({ U: S.U, w: .5, h: .4, z, trans: .7, shadow: false, recv: false, draw: x => {
    const R = mulberry(side > 0 ? 3 : 7), edge = side > 0 ? -.03 : .03;
    x.fillStyle = '#cfc4dc'; x.fillRect(side > 0 ? edge : -.25, -.2, .25 - Math.abs(edge) + .0, .4);
    x.beginPath(); for (let i = 0; i < 12; i++) { const y = -.2 + i * .036, r = .024 + R() * .01; x.moveTo(edge + r, y); x.arc(edge - side * .004, y, r, 0, TAU); } x.fill();
    x.save(); x.globalCompositeOperation = 'destination-out'; x.strokeStyle = '#000'; x.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const cy = -.2 + i * .036, cx = edge - side * .004, r = .02; x.lineWidth = .0022; x.beginPath(); for (let k = 0; k <= 30; k++) { const u = k / 30, th = -side * u * 1.7 * TAU + 1, rr = r * (.15 + .6 * u); k ? x.lineTo(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr) : x.moveTo(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr); } x.stroke(); }
    x.restore();
  } }));
  return [mk(1), mk(-1)];
}

export function build(E) {
  const MN = [.025, .08, -.13];
  const S = stage({ light: MN, lightR: .15, lightCol: '#ffe6b8', key: .85, amb: .28, ambCol: '#7d8cc0', keyCol: '#d6dcff' });
  const { U } = S;
  S.add(skyPanel({ w: .6, h: .36, z: -.14, stops: [[0, '#0b1230'], [.55, '#1c2c58'], [1, '#3e4f80']], stars: 200, starMinY: -.02 }));
  const mn = S.add(moon({ x: MN[0], y: MN[1], z: MN[2], r: .038, gain: 1.7, halo: 4.2, haloGain: .32 }));
  S.add(sheet({ U, w: .6, h: .36, z: -.115, trans: .85, draw: x => { x.fillStyle = '#c3cbe8'; xiangyun(x, .06, .04, .009, -1, { tail: 3 }); xiangyun(x, -.12, .1, .007, 1); } }));
  S.add(sheet({ U, w: .6, h: .36, z: -.1, trans: .7, draw: x => { x.fillStyle = '#6a86c2'; karst(x, { x0: -.3, x1: .3, base: -.03, peaks: [[-.25, .05, .025], [-.16, .07, .03], [-.07, .04, .02], [.02, .06, .025], [.12, .045, .02], [.22, .07, .028]], carve: .0005 }); } }));
  S.add(sheet({ U, w: .6, h: .36, z: -.08, trans: .4, glow: 1.1, glowCol: '#ffe0a6', draw: x => {
    x.fillStyle = '#22325e'; waterTop(x, { x0: -.3, x1: .3, base: -.045, amp: .001, len: .05 });
    x.save(); x.beginPath(); x.rect(-.3, -.2, .6, .15); x.clip(); waves(x, { x0: -.3, x1: .3, y0: -.052, y1: -.2, r: .006, fill: '#22325e', line: '#34487a', lw: .0006 }); x.restore();
    trail(x, '#e9cf96');
    x.fillStyle = '#1a2850'; x.beginPath(); x.moveTo(.0, -.07); x.lineTo(.06, -.07); x.lineTo(.05, -.078); x.lineTo(.01, -.078); x.fill(); x.fillRect(.028, -.07, .002, .03);   // 小舟
  }, glowDraw: g => trail(g, '#fff') }));
  function trail(x, col) { x.fillStyle = col; const R = mulberry(5); for (let i = 0; i < 34; i++) { const w = .022 * (.3 + R() * .8); x.beginPath(); x.ellipse(MN[0] + (R() - .5) * .01, -.053 - i * .0026, w / 2, .0004, 0, 0, TAU); x.fill(); } }
  // 岸、柳、苏轼
  S.add(sheet({ U, w: .6, h: .36, z: -.055, trans: .12, draw: x => {
    x.fillStyle = '#141e40';
    x.beginPath(); x.moveTo(-.3, -.2); x.lineTo(-.3, -.06); x.quadraticCurveTo(-.2, -.055, -.12, -.075); x.quadraticCurveTo(-.08, -.085, -.04, -.095); x.lineTo(-.02, -.2); x.fill();
    willow(x, { cx: -.23, by: -.07, h: .19, strands: 26, seed: 8 });
  } }));
  const SX = -.078, SY = -.07, SS = .09;
  const su = S.add(sheet({ U, w: .2, h: .2, x: SX, y: SY + .06, z: -.05, trans: .06, draw: x => { x.fillStyle = '#10183a'; x.translate(0, -.06); sushi(x, SS); } }));
  const sh = [SX + SUSHI_SHOULDER[0] * SS, SY + SUSHI_SHOULDER[1] * SS];
  const armS = S.add(sheet({ U, w: .08, h: .08, x: sh[0], y: sh[1], z: -.0495, trans: .06, draw: x => {   // 抬臂举杯 + 下垂的宽袖
    const k = SS * 2; x.fillStyle = '#10183a';
    spline(x, k, [[-.012, .025], [.04, .03], [.09, .075], [.112, .088, 1], [.12, .07], [.1, .045], [.095, .0], [.085, -.07], [.06, -.13, 1], [.03, -.09], [.0, -.05], [-.02, -.02]]);
    x.fill();
    x.beginPath(); x.ellipse(.118 * k, .086 * k, .014 * k, .01 * k, .9, 0, TAU); x.fill();
    x.beginPath(); x.moveTo(.112 * k, .1 * k); x.lineTo(.142 * k, .1 * k); x.lineTo(.136 * k, .12 * k); x.lineTo(.118 * k, .12 * k); x.closePath(); x.fill(); x.fillRect(.124 * k, .09 * k, .006 * k, .012 * k);   // 酒杯
  } }));
  // 江边的石头
  S.add(sheet({ U, w: .2, h: .06, x: SX, y: SY - .004, z: -.051, trans: .06, draw: x => { x.fillStyle = '#10183a'; spline(x, 1, [[-.06, -.03, 1], [-.05, -.004], [-.025, .004], [.01, .003], [.04, -.002], [.07, -.03, 1]]); x.fill(); } }));
  S.add(sheet({ U, w: .62, h: .38, z: -.015, trans: .03, draw: x => { x.fillStyle = '#070c1e'; x.strokeStyle = '#070c1e'; ridge(x, { x0: -.31, x1: .31, base: -.15, amp: .008, seed: 4, freq: 12 }); reeds(x, { x0: -.31, x1: -.1, by: -.155, h: .05, n: 36, seed: 2 }); } }));
  // 诗句：两列金字，逐列写出；朱印“东坡”
  const cols = [['但愿人长久', .165, E.cue('L23') - .05], ['千里共婵娟', .132, E.word('L23', 5) - .05]];
  const CS = .021, CH = CS * 1.06 * 5 + CS * .5;
  const poem = cols.map(([s, cx, t0]) => {
    const m = S.add(sheet({ U, w: CS * 1.5, h: CH, x: cx, y: .1 - CH / 2, z: -.11, ay: CH / 2, trans: .4, shadow: false, recv: false, finish: { rim: .6 }, draw: x => vtext(x, s, 0, CH / 2 - CS * .6, CS, FONT.brush, { fill: '#f0d596', gap: 1.06 }) }));
    m.userData.t0 = t0; return m;
  });
  const seal = S.add(sheet({ U, w: .02, h: .02, x: .112, y: -.0, z: -.11, trans: .2, shadow: false, recv: false, draw: x => { x.fillStyle = '#b3302a'; x.fillRect(-.007, -.007, .014, .014); vtext(x, '东坡', 0, .0032, .0052, FONT.brush, { fill: '#f6e3c3', gap: 1.05 }); } }));
  const curtain = cloudCurtain(S, .15);
  return {
    S,
    update(t) {
      // 祥云幕拉开
      const op = eio(seg(t, .0, 1.3)); curtain[0].position.x = .035 + op * .35; curtain[1].position.x = -.035 - op * .35; curtain.forEach(c => c.visible = op < .99);
      armS.rotation.z = lerp(-.35, 0, eio(seg(t, .6, 2.6))) + .012 * Math.sin(t * 1.1);
      poem.forEach(m => { const k = Math.max(.001, eo(seg(t, m.userData.t0, m.userData.t0 + 1.25))); m.scale.y = k; m.material.map.repeat.y = k; m.material.map.offset.y = 1 - k; m.visible = t > m.userData.t0 - .02; });
      seal.visible = t > cols[1][2] + 1.2; seal.scale.setScalar(Math.max(.001, eo(seg(t, cols[1][2] + 1.2, cols[1][2] + 1.5))));
      const u = eio(clamp(t / E.dur));
      aim(S.cam, [lerp(-.015, .02, u), lerp(.0, .012, u), lerp(.4, .42, u), lerp(-.015, .025, u), lerp(.005, .02, u), -.07], t);
    },
    post() { return { focus: S.cam.position.z + .05, aper: 12, maxCoc: 12, bloom: { strength: .4, radius: .6, threshold: 1.1 } }; },
    grade() { return { expo: 1.05, vig: .45, sat: 1.02, contrast: .1 }; },
  };
}
