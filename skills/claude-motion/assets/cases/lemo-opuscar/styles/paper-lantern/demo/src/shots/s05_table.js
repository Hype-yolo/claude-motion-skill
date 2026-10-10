// S5 · 空着的位子（L07）→ 墙上小满的照片（L08）
import * as THREE from 'three';
import { sheet, skyPanel, moon, text } from '../paper.js';
import { osmanthus, lantern, FONT } from '../art.js';
import { roundWindow, bowl, teapot, pendant, chair, cut } from '../props.js';
import { grannySit, girlStand, childStand, arm, spline, GRAN_SHOULDER } from '../people.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, lerp, clamp, mulberry, TAU } from '../lib.js';

export function portrait(x, w, h, o = {}) {   // 相框 + 小满半身像
  x.fillStyle = o.frame || '#3a2010'; x.beginPath(); x.roundRect(-w / 2, -h / 2, w, h, w * .04); x.fill();
  x.fillStyle = '#c7d3dc'; x.fillRect(-w * .42, -h * .42, w * .84, h * .84);
  const g = x.createLinearGradient(0, h * .42, 0, -h * .42); g.addColorStop(0, '#9fb3c8'); g.addColorStop(1, '#e8e0cf'); x.fillStyle = g; x.fillRect(-w * .42, -h * .42, w * .84, h * .84);
  x.save(); x.beginPath(); x.rect(-w * .42, -h * .42, w * .84, h * .84); x.clip();
  x.fillStyle = '#6f829a'; for (let i = 0; i < 7; i++) x.fillRect(-w * .42 + i * w * .13, -h * .42, w * .08, h * (.25 + (i * 37 % 5) * .06));   // 远处城市
  x.fillStyle = o.ink || '#2b1d18'; x.translate(-w * .02, -h * .95); girlStand(x, h * 1.05);
  x.restore();
}

export function build(E) {
  const WIN = [-.07, .055], PH = [.105, .05];
  const S = stage({ light: [-.02, .08, -.07], lightR: .13, lightCol: '#ffd29a', key: .9, amb: .17, ambCol: '#c08a60', keyCol: '#ffdcb4' });
  const { U } = S;
  S.add(skyPanel({ w: .6, h: .36, z: -.14, stops: [[0, '#0d1838'], [1, '#2e4274']], stars: 60 }));
  S.add(moon({ x: WIN[0] - .01, y: WIN[1] + .01, z: -.135, r: .017, gain: 1.9, halo: 3.5, haloGain: .35 }));
  S.add(sheet({ U, w: .6, h: .36, z: -.112, trans: .9, draw: x => {
    x.fillStyle = '#b08058'; x.fillRect(-.3, -.18, .6, .36);
    x.fillStyle = '#9a6a44'; for (let i = 0; i < 9; i++) x.fillRect(-.3, -.18 + i * .045, .6, .0012);
    x.fillStyle = '#5a321a'; roundWindow(x, WIN[0], WIN[1], .04, .0015, 'grid');
    x.fillStyle = '#5a321a'; x.fillRect(-.3, .118, .6, .014);
  } }));
  // 墙上：福字 + 小满的照片
  S.add(sheet({ U, w: .6, h: .36, z: -.104, trans: .2, draw: x => {
    x.save(); x.translate(.02, .06); x.rotate(Math.PI / 4); x.fillStyle = '#b8322a'; x.fillRect(-.016, -.016, .032, .032); x.restore();
    text(x, '福', .02, .059, .022, FONT.brush, { fill: '#e9c26a' });
  } }));
  const photo = S.add(sheet({ U, w: .06, h: .075, x: PH[0], y: PH[1], z: -.1, trans: .25, draw: x => portrait(x, .05, .064) }));
  // 吊灯
  S.add(sheet({ U, w: .08, h: .1, x: -.02, y: .105, z: -.07, trans: .1, glow: 3, glowCol: '#ffc878', ay: .04, draw: x => pendant(x, 0, .02, .042, '#3a1d10'), glowDraw: g => pendant(g, 0, .02, .042, '#000', g) }));
  // 外婆坐在左边；右边空椅
  const GX = -.105, GY = -.096, GS = .15;
  const gran = S.add(sheet({ U, w: .5, h: .36, z: -.064, trans: .06, draw: x => { x.fillStyle = '#2e170d'; chair(x, GX - .005, -.14, .1, 1); x.translate(GX, GY); grannySit(x, GS, { pin: '#2e170d' }); x.translate(GRAN_SHOULDER[0] * GS, (GRAN_SHOULDER[1] - .48) * GS); arm(x, GS, -.35, .5, { sleeve: 1.25 }); } }));
  const empty = S.add(sheet({ U, w: .5, h: .36, z: -.052, trans: .06, draw: x => { x.fillStyle = '#2e170d'; chair(x, .11, -.14, .1, -1); } }));
  // 圆桌 + 菜 + 月饼 + 茶具 + 空位前的碗筷
  S.add(sheet({ U, w: .5, h: .3, z: -.046, trans: .08, draw: x => {
    x.fillStyle = '#3a1c0e';
    x.fillRect(-.075, -.05, .15, .01); x.fillRect(-.07, -.06, .14, .01); x.fillRect(-.008, -.13, .016, .07); x.fillRect(-.04, -.135, .08, .008);
    x.fillStyle = '#3a1c0e'; bowl(x, -.045, -.04, .03, .012); teapot(x, .0, -.04, .022); bowl(x, .045, -.04, .03, .012);
    x.fillStyle = '#6e2c18'; x.beginPath(); x.ellipse(-.045, -.028, .012, .0025, 0, 0, TAU); x.fill();
    x.fillStyle = '#3a1c0e'; x.fillRect(.056, -.04, .002, .02); x.fillRect(.06, -.04, .002, .02);   // 空位的筷子
  } }));
  const plate = S.add(sheet({ U, w: .06, h: .03, x: -.02, y: -.034, z: -.044, trans: 0, metal: .6, rough: .36, envMap: E.env, envI: .9, draw: x => {
    x.fillStyle = '#c7873a'; for (const [dx, dy] of [[-.012, -.002], [.004, -.002], [-.004, .006]]) { x.beginPath(); x.roundRect(dx - .008, dy - .005, .016, .009, .003); x.fill(); }
  } }));
  const fg = S.add(sheet({ U, w: .62, h: .38, z: -.014, trans: .04, draw: x => {
    x.fillStyle = '#1a0c06'; x.fillRect(-.31, -.19, .62, .05);
    lantern(x, { cx: -.21, cy: .1, r: .016, col: '#1a0c06', rib: '#1a0c06', cap: '#1a0c06', stringLen: .1 });
    x.fillRect(.27, -.19, .04, .38);
  } }));
  const tPan = E.cue('L07') + .4, tPush = E.cue('L08') - .1;
  let fz = -.064;
  return {
    S,
    update(t) {
      const pan = eio(seg(t, tPan, tPan + 2.4)), push = eio(seg(t, tPush, tPush + 3.4));
      const cx = lerp(lerp(-.075, .085, pan), PH[0], push), cy = lerp(lerp(-.03, -.035, pan), PH[1], push);
      const z = lerp(lerp(.34, .32, pan), .15, push);
      aim(S.cam, [cx + lerp(.01, 0, push), cy - .006, z, cx, cy, -.08], t);
      fz = lerp(lerp(-.064, -.052, ss(seg(t, tPan + .6, tPan + 1.8))), -.1, push);
    },
    post() { return { focus: S.cam.position.z - fz, aper: 18, maxCoc: 16, bloom: { strength: .38, radius: .6, threshold: 1.1 } }; },
    grade() { return { expo: 1.0, vig: .5, sat: .98, contrast: .1, lift: [.012, .006, 0], gain: [1.02, 1, .96] }; },
  };
}
