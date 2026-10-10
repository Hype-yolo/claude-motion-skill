// S16 · 相思的“相”，是互相的相：左边外婆的窗，右边小满的窗，中间同一个月亮；两道光从窗口连到月亮
import * as THREE from 'three';
import { sheet, skyPanel, moon, setMoon, text } from '../paper.js';
import { karst, ridge, xiangyun, waves, waterTop, osmanthus, jiangnanHouse, reeds, FONT } from '../art.js';
import { grannySit, girlSit, arm, spline } from '../people.js';
import { towers } from './s11_city.js';
import { cloudCurtain } from './s17_sushi.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, eo, lerp, clamp, mulberry, TAU } from '../lib.js';

export const MM = [0, .07, -.13];
// 共用的“两扇窗 + 一个月亮”布景（S16 与片尾灯箱里都用；尺寸适配灯箱内腔 .56×.33）
export function mutualSet(S, E, o = {}) {
  const { U } = S;
  const sky = S.add(skyPanel({ w: .56, h: .33, z: -.14, stops: [[0, '#0a1330'], [.5, '#1a2c5c'], [.85, '#34487c'], [1, '#4a5a86']], stars: 240, starMinY: -.03 }));
  const mn = S.add(moon({ x: MM[0], y: MM[1], z: MM[2], r: .045, gain: 1.7, halo: 4.2, haloGain: .32 }));
  S.add(sheet({ U, w: .558, h: .328, z: -.115, trans: .85, draw: x => { x.fillStyle = '#c3cbe8'; xiangyun(x, -.075, .045, .009, 1, { tail: 3 }); xiangyun(x, .08, .1, .007, -1, { tail: 2.4 }); xiangyun(x, .2, .03, .0055, -1); xiangyun(x, -.21, .11, .006, 1); } }));
  S.add(sheet({ U, w: .558, h: .328, z: -.1, trans: .7, draw: x => { x.fillStyle = '#6a86c2'; karst(x, { x0: -.28, x1: .28, base: -.03, peaks: [[-.2, .04, .025], [-.12, .06, .025], [-.04, .035, .02], [.05, .05, .025], [.13, .065, .025], [.21, .04, .022]], carve: .0005 }); } }));
  S.add(sheet({ U, w: .558, h: .328, z: -.085, trans: .4, glow: 1, glowCol: '#ffe0a6', draw: x => {
    x.fillStyle = '#22325e'; waterTop(x, { x0: -.28, x1: .28, base: -.05, amp: .001, len: .05 });
    x.save(); x.beginPath(); x.rect(-.28, -.2, .56, .145); x.clip(); waves(x, { x0: -.28, x1: .28, y0: -.057, y1: -.2, r: .006, fill: '#22325e', line: '#34487a', lw: .0006 }); x.restore();
    x.fillStyle = '#e9cf96'; const R = mulberry(3); for (let i = 0; i < 30; i++) { const w = .02 * (.3 + R() * .8); x.beginPath(); x.ellipse((R() - .5) * .01, -.058 - i * .0025, w / 2, .0004, 0, 0, TAU); x.fill(); }
  }, glowDraw: g => { g.fillStyle = '#fff'; const R = mulberry(3); for (let i = 0; i < 30; i++) { const w = .02 * (.3 + R() * .8); g.beginPath(); g.ellipse((R() - .5) * .01, -.058 - i * .0025, w / 2, .0004, 0, 0, TAU); g.fill(); } } }));
  // 左：外婆家（圆窗亮着，窗里外婆举着月饼）
  const left = S.add(sheet({ U, w: .558, h: .328, z: -.06, trans: .2, glow: 2.2, glowCol: '#ffb862', draw: x => drawLeft(x, null), glowDraw: g => drawLeft(null, g) }));
  // 右：小满的高楼（一扇窗亮着，窗里小满举着月饼）
  const right = S.add(sheet({ U, w: .558, h: .328, z: -.06, trans: .2, glow: 2.2, glowCol: '#ffd08a', draw: x => drawRight(x, null), glowDraw: g => drawRight(null, g) }));
  S.add(sheet({ U, w: .558, h: .328, z: -.03, trans: .05, draw: x => { x.fillStyle = '#0e1532'; x.strokeStyle = '#0e1532'; ridge(x, { x0: -.28, x1: .28, base: -.14, amp: .006, seed: 3, freq: 14 }); reeds(x, { x0: -.05, x1: .05, by: -.14, h: .03, n: 20, seed: 8 }); } }));
  // 两道光：从窗口弧线连到月亮（用以月亮为心的圆形裁切，从外往里长）
  const arcs = S.add(sheet({ U, w: .558, h: .328, z: -.07, trans: 0, glow: 3, glowCol: '#ffd990', shadow: false, recv: false, finish: { rim: 0, under: 0, grain: false }, draw: x => drawArcs(x, '#f6dca0'), glowDraw: g => drawArcs(g, '#fff'), glowRes: 1 }));
  return { sky, mn, left, right, arcs };

  function drawLeft(x, g) {
    const c = x || g;
    if (x) { x.fillStyle = '#1d2a52'; ridge(x, { x0: -.28, x1: -.05, base: -.1, amp: .004, seed: 2, freq: 20 }); x.fillRect(-.28, -.2, .23, .1); osmanthus(x, { cx: -.24, by: -.1, h: .1, flowers: '#d9a24a', seed: 5, leaves: 40, nFlowers: 30 }); }
    const hx = -.14, hy = -.1, hw = .1, hh = .055;
    if (x) { jiangnanHouse(x, { cx: hx, by: hy, w: hw, h: hh, windows: [], wall: '#4a5f96', tile: '#1b284f' }); }
    // 圆窗
    const wx = hx + .01, wy = hy + hh * .5, wr = .016;
    if (g) { g.fillStyle = '#fff'; g.beginPath(); g.arc(wx, wy, wr, 0, TAU); g.fill(); g.fillStyle = '#000'; g.save(); g.translate(wx - .004, wy - wr); grannySit(g, .04); g.restore(); return; }
    x.fillStyle = '#f4c46e'; x.beginPath(); x.arc(wx, wy, wr, 0, TAU); x.fill();
    x.save(); x.beginPath(); x.arc(wx, wy, wr, 0, TAU); x.clip(); x.fillStyle = '#3a1d10'; x.translate(wx - .004, wy - wr); grannySit(x, .04); x.translate(0, .04 * .29); arm(x, .04, 1.0, -.2, { sleeve: 1.2 }); x.fillStyle = '#b8742c'; x.beginPath(); x.arc(.04 * .3, .04 * .44, .003, 0, TAU); x.fill(); x.restore();
    x.strokeStyle = '#1b284f'; x.lineWidth = .0015; x.beginPath(); x.arc(wx, wy, wr, 0, TAU); x.stroke();
  }
  function drawRight(x, g) {
    const bx = .15, by = -.1, bw = .07, bh = .14;
    if (x) { x.fillStyle = '#1d1a3e'; x.fillRect(.05, -.2, .23, .1); towers(x, null, { x0: .05, x1: .28, by: -.1, col: '#2a2456', win: '#e8cc90', dark: '#231e4a', seed: 21, hmin: .04, hmax: .09, wmin: .02, wmax: .035, cell: .004, lit: .25, gap: .004 }); x.fillStyle = '#1d1a3e'; x.fillRect(bx - bw / 2, by, bw, bh); x.fillRect(bx - bw * .3, by + bh, bw * .6, .01); }
    else towers(null, g, { x0: .05, x1: .28, by: -.1, col: '', seed: 21, hmin: .04, hmax: .09, wmin: .02, wmax: .035, cell: .004, lit: .25, gap: .004 });
    const wx = bx - .012, wy = by + bh * .62, ww = .028, wh = .022;
    if (g) { g.fillStyle = '#fff'; g.fillRect(wx - ww / 2, wy - wh / 2, ww, wh); g.fillStyle = '#000'; g.save(); g.translate(wx + .004, wy - wh / 2); g.scale(-1, 1); girlSit(g, .04); g.restore(); return; }
    x.fillStyle = '#f7d38f'; x.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);
    x.save(); x.beginPath(); x.rect(wx - ww / 2, wy - wh / 2, ww, wh); x.clip(); x.fillStyle = '#2a1d3a'; x.translate(wx + .004, wy - wh / 2); x.scale(-1, 1); girlSit(x, .04); x.translate(0, .04 * .275); arm(x, .04, 1.0, -.2); x.fillStyle = '#b8742c'; x.beginPath(); x.arc(.04 * .3, .04 * .42, .003, 0, TAU); x.fill(); x.restore();
    for (let i = 0; i < 18; i++) { const R = mulberry(40 + i); if (R() < .6) continue; x.fillStyle = '#e8cc90'; x.fillRect(bx - bw / 2 + .006 + (i % 3) * .022, by + .01 + Math.floor(i / 3) * .02, .012, .008); }
  }
  function drawArcs(c, col) {
    c.strokeStyle = col; c.lineCap = 'round'; c.setLineDash([.0025, .004]); c.lineWidth = .0012;
    c.beginPath(); c.moveTo(-.13, -.07); c.quadraticCurveTo(-.1, .06, MM[0] - .03, MM[1] - .01); c.stroke();
    c.beginPath(); c.moveTo(.138, -.013); c.quadraticCurveTo(.11, .07, MM[0] + .03, MM[1] - .01); c.stroke();
    c.setLineDash([]);
  }
}

export function build(E) {
  const S = stage({ light: MM, lightR: .16, lightCol: '#ffe2ae', key: .9, amb: .28, ambCol: '#7d90c8', keyCol: '#d6dcff' });
  const M = mutualSet(S, E);
  const tA = E.cue('L21') + .2, tB = E.word('L21', 7) + .1;   // 从“互”字起光线长到月亮
  const curtain = cloudCurtain(S, .15);
  return {
    S,
    update(t) {
      const k = eio(seg(t, tA, tB + 1.4)); M.arcs.material.userData.u.uClip.value.set(MM[0], MM[1], lerp(.3, .0, k), 1);
      M.arcs.visible = k > .001;
      setMoon(M.mn, 1 + .15 * ss(seg(t, tB + .8, tB + 1.8)));
      const cl = eio(seg(t, E.dur - 1.2, E.dur)); curtain[0].position.x = .035 + (1 - cl) * .35; curtain[1].position.x = -.035 - (1 - cl) * .35; curtain.forEach(c => c.visible = cl > .001);
      const u = eio(clamp(t / E.dur));
      aim(S.cam, [0, lerp(.05, .0, u), lerp(.3, .5, u), 0, lerp(.055, .0, u), -.08], t);
    },
    post() { return { focus: S.cam.position.z + .06, aper: 12, maxCoc: 12, bloom: { strength: .42, radius: .65, threshold: 1.1 } }; },
    grade() { return { expo: 1.05, vig: .42, sat: 1.05, contrast: .1 }; },
  };
}
