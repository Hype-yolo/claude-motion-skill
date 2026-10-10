// S10 · 擦肩而过：两列夜车交会，对面车窗里闪过另一个盒子（“外婆 收”），交会瞬间时间变慢
import * as THREE from 'three';
import { sheet, skyPanel, moon, text } from '../paper.js';
import { karst, ridge, FONT } from '../art.js';
import { boxFront } from '../props.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, lerp, clamp, mulberry, TAU } from '../lib.js';

// 车厢侧面：车窗挖空（能看见里面）；inner=true 画车厢内部（暖光 + 座椅靠背）
export function carriage(x, n, cw, ch, col, inner, g) {
  for (let i = 0; i < n; i++) {
    const L = -n * cw / 2 + i * cw;
    if (inner) {
      if (g) { g.fillStyle = '#fff'; g.fillRect(L, -ch * .12, cw, ch * .5); continue; }
      x.fillStyle = '#e9b86c'; x.fillRect(L, -ch * .12, cw, ch * .5);
      x.fillStyle = '#9a5a2a'; for (let k = 0; k < 4; k++) { x.beginPath(); x.roundRect(L + cw * (.06 + k * .23), -ch * .12, cw * .06, ch * .26, ch * .03); x.fill(); }
      continue;
    }
    x.fillStyle = col; x.beginPath(); x.roundRect(L + cw * .01, -ch / 2, cw * .98, ch, ch * .08); x.fill();
    x.fillStyle = '#e8d9a8'; x.fillRect(L, -ch * .22, cw, ch * .035); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(L + cw * .01, ch * .42, cw * .98, ch * .08);
    x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000';
    for (let k = 0; k < 4; k++) x.fillRect(L + cw * (.09 + k * .23), -ch * .08, cw * .15, ch * .42);
    x.restore();
  }
}

const erf = x => { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + .3275911 * a); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-a * a)); };

export function build(E) {
  const S = stage({ light: [.08, .08, -.14], lightR: .2, lightCol: '#e0e6ff', key: .9, amb: .28, ambCol: '#7d90c8', keyCol: '#d6dcff' });
  const { U } = S;
  S.add(skyPanel({ w: .7, h: .4, z: -.15, stops: [[0, '#0a1330'], [.6, '#1a2d5c'], [1, '#34497c']], stars: 150 }));
  S.add(moon({ x: .1, y: .085, z: -.145, r: .022, gain: 1.8, halo: 4, haloGain: .3 }));
  S.add(sheet({ U, w: .8, h: .4, z: -.13, trans: .6, draw: x => { x.fillStyle = '#4f6aa2'; const R = mulberry(9), pk = []; for (let u = -.4; u < .4; u += .04 + R() * .02) pk.push([u, .015 + R() * .03, .018]); karst(x, { x0: -.4, x1: .4, base: .0, peaks: pk, carve: .0005 }); } }));
  // 对面的车（往南，向左疾驶），窗里有一个蓝色礼盒
  const CW = .11, CH = .05, NC = 10, K = 1.45;
  const farIn = S.add(sheet({ U, w: CW * NC, h: .08, y: .035, z: -.106, trans: .3, glow: .9, glowCol: '#ffc36a', ppm: 3000, draw: x => carriage(x, NC, CW, CH, '', true), glowDraw: g => carriage(null, NC, CW, CH, '', true, g) }));
  const far = S.add(sheet({ U, w: CW * NC, h: .08, y: .035, z: -.1, trans: .15, ppm: 3600, draw: x => carriage(x, NC, CW, CH, '#1d4a3a', false) }));
  const otherBox = S.add(sheet({ U, w: .03, h: .03, y: .03, z: -.103, trans: .2, draw: x => { boxFront(x, 0, -.008, .022, .012, '#2a4f7a', '#e0c070'); x.fillStyle = '#f2ead6'; x.save(); x.rotate(-.05); x.fillRect(.0, -.005, .009, .006); x.restore(); text(x, '外婆收', .0045, -.002, .0016, FONT.hand, { fill: '#2a1a12' }); } }));
  // 近处：我们的车（往北），窗里是红礼盒
  const nearIn = S.add(sheet({ U, w: CW * K * 8, h: .13, y: -.06, z: -.058, trans: .3, glow: .9, glowCol: '#ffc36a', ppm: 3600, draw: x => carriage(x, 8, CW * K, CH * K, '', true), glowDraw: g => carriage(null, 8, CW * K, CH * K, '', true, g) }));
  const near = S.add(sheet({ U, w: CW * K * 8, h: .13, y: -.06, z: -.05, trans: .1, ppm: 4200, draw: x => carriage(x, 8, CW * K, CH * K, '#1f5140', false) }));
  const myBox = S.add(sheet({ U, w: .05, h: .04, y: -.065, z: -.054, trans: .2, draw: x => { boxFront(x, 0, -.01, .034, .017, '#9e2a20', '#d9a441'); x.fillStyle = '#f2ead6'; x.save(); x.rotate(.04); x.fillRect(.003, -.007, .012, .009); x.restore(); } }));
  S.add(sheet({ U, w: .8, h: .4, z: -.02, trans: .03, draw: x => { x.fillStyle = '#070c1c'; x.fillRect(-.4, -.2, .8, .065); for (let i = 0; i < 12; i++) x.fillRect(-.4 + i * .07, -.14, .004, .03); } }));
  const tMeet = E.cue('L14') + 1.0;   // “擦肩而过”
  // 我方车厢：相对镜头几乎静止；对面车：先快、交会时慢、再快
  const myWin = { x: -CW * K * 8 / 2 + 4 * CW * K + CW * K * (.09 + 1 * .23) + CW * K * .075 };
  return {
    S,
    update(t) {
      const drift = t * .004;
      near.position.x = nearIn.position.x = -myWin.x - drift; myBox.position.x = near.position.x + myWin.x; near.position.y = nearIn.position.y = -.06 + .0007 * Math.sin(t * 9); myBox.position.y = -.057 + .0007 * Math.sin(t * 9);
      // 对面车：以交会时刻为 0，速度在交会附近降到 12%（时间变慢）——位置 = 速度曲线的积分
      const dt = t - tMeet, sg = .35, F = dt - .88 * sg * Math.sqrt(Math.PI / 2) * erf(dt / (sg * Math.SQRT2));
      const bl = -CW * NC / 2 + 5 * CW + CW * (.09 + 2 * .23) + CW * .075;
      const fx = -bl - drift - .42 * F;
      far.position.x = farIn.position.x = fx; otherBox.position.x = fx + bl;
      otherBox.position.y = .04 + .0007 * Math.sin(t * 9 + 1);
      aim(S.cam, [-.002 - drift * .3, -.02, .34, -.002 - drift * .3, -.012, -.08], t, { hand: .0008 });
    },
    post() { return { focus: S.cam.position.z + .07, aper: 16, maxCoc: 16, bloom: { strength: .38, radius: .6, threshold: 1.1 } }; },
    grade(t) { return { expo: 1.02, vig: .45, sat: 1.02, contrast: .1 }; },
  };
}
