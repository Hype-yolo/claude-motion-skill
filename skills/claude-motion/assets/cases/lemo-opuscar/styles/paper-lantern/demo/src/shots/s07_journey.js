// S7 · 出发：翻过山、跨过江，夜车（绿皮车）横穿画面，月亮一直跟着
import * as THREE from 'three';
import { sheet, skyPanel, moon, setMoon } from '../paper.js';
import { karst, ridge, xiangyun, waves, waterTop, pine, reeds, osmanthus, FONT } from '../art.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, lerp, clamp, mulberry, TAU } from '../lib.js';

// 绿皮车：车头在右；by = 轨面；返回长度
export function train(x, x0, by, n, o = {}, g = null) {
  const cw = o.cw ?? .07, ch = o.ch ?? .02, gap = cw * .04, col = o.col || '#1d4a3a', roof = o.roof || '#123026', win = o.win || '#f7c56d';
  for (let i = 0; i < n; i++) {
    const L = x0 + i * (cw + gap);
    if (!g) {
      x.fillStyle = col; x.beginPath(); x.roundRect(L, by + ch * .18, cw, ch, ch * .12); x.fill();
      x.fillStyle = roof; x.beginPath(); x.roundRect(L + cw * .02, by + ch * 1.12, cw * .96, ch * .16, ch * .08); x.fill();
      x.fillStyle = '#e8d9a8'; x.fillRect(L, by + ch * .42, cw, ch * .05);    // 腰线
      x.fillStyle = '#111'; for (const k of [.15, .3, .7, .85]) { x.beginPath(); x.arc(L + cw * k, by + ch * .12, ch * .12, 0, TAU); x.fill(); }
    }
    const c = g || x;
    c.fillStyle = g ? '#fff' : win;
    for (let k = 0; k < 7; k++) { if (o.dark && (i * 7 + k) % 5 === 2) continue; c.fillRect(L + cw * (.08 + k * .125), by + ch * .6, cw * .08, ch * .38); }
  }
  // 车头
  const L = x0 + n * (cw + gap), hw = cw * .75;
  if (!g) {
    x.fillStyle = col; x.beginPath(); x.moveTo(L, by + ch * .18); x.lineTo(L + hw * .8, by + ch * .18); x.quadraticCurveTo(L + hw, by + ch * .2, L + hw, by + ch * .6); x.quadraticCurveTo(L + hw, by + ch * 1.1, L + hw * .7, by + ch * 1.18); x.lineTo(L, by + ch * 1.18); x.closePath(); x.fill();
    x.fillStyle = '#111'; for (const k of [.2, .5, .8]) { x.beginPath(); x.arc(L + hw * k, by + ch * .12, ch * .14, 0, TAU); x.fill(); }
    x.fillStyle = win; x.beginPath(); x.moveTo(L + hw * .62, by + ch * .75); x.lineTo(L + hw * .85, by + ch * .75); x.quadraticCurveTo(L + hw * .95, by + ch * .9, L + hw * .7, by + ch * 1.05); x.lineTo(L + hw * .62, by + ch * 1.05); x.closePath(); x.fill();
  } else { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(L + hw * .62, by + ch * .75); g.lineTo(L + hw * .85, by + ch * .75); g.quadraticCurveTo(L + hw * .95, by + ch * .9, L + hw * .7, by + ch * 1.05); g.lineTo(L + hw * .62, by + ch * 1.05); g.closePath(); g.fill();
    const hl = g.createLinearGradient(L + hw, 0, L + hw + .08, 0); hl.addColorStop(0, 'rgba(255,255,255,.8)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.beginPath(); g.moveTo(L + hw, by + ch * .5); g.lineTo(L + hw + .08, by + ch * .1); g.lineTo(L + hw + .08, by + ch * 1.1); g.closePath(); g.fill(); }
  return n * (cw + gap) + hw;
}

export function build(E) {
  const S = stage({ light: [0, .06, -.13], lightR: .25, lightCol: '#ffe2ae', key: .9, amb: .3, ambCol: '#7d90c8', keyCol: '#d0d8ff' });
  const { U } = S;
  const sky = S.add(skyPanel({ w: .75, h: .42, z: -.14, stops: [[0, '#0a1330'], [.5, '#182c5a'], [1, '#3a5184']], stars: 200, starMinY: -.05 }));
  const mn = S.add(moon({ x: .1, y: .07, z: -.135, r: .03, gain: 1.8, halo: 4.5, haloGain: .35 }));
  const W = 2.0, CX = .5;   // 全景宽 2 m，中心 x=.5
  S.add(sheet({ U, w: W, h: .4, x: CX, z: -.115, trans: .8, ppm: 2400, draw: x => { x.fillStyle = '#c3cbe8'; const R = mulberry(3); for (let i = 0; i < 12; i++) xiangyun(x, -1 + i * .17 + R() * .05, .06 + R() * .07, .006 + R() * .003, R() < .5 ? 1 : -1, { tail: 2.5 }); } }));
  S.add(sheet({ U, w: W, h: .4, x: CX, z: -.1, trans: .7, ppm: 2600, draw: x => {
    x.fillStyle = '#6a86c2'; const R = mulberry(5), pk = []; for (let u = -1; u < 1; u += .045 + R() * .03) pk.push([u, .03 + R() * .05, .02 + R() * .012]);
    karst(x, { x0: -1, x1: 1, base: -.03, peaks: pk, carve: .0005 });
  } }));
  S.add(sheet({ U, w: W, h: .4, x: CX, z: -.085, trans: .45, ppm: 3000, draw: x => {
    x.fillStyle = '#3f5a92'; const R = mulberry(8), pk = []; for (let u = -1; u < 1; u += .06 + R() * .05) pk.push([u, .02 + R() * .05, .025 + R() * .015]);
    karst(x, { x0: -1, x1: 1, base: -.045, peaks: pk, carve: .0006, seed: 4 });
  } }));
  S.add(sheet({ U, w: W, h: .4, x: CX, z: -.07, trans: .3, ppm: 3000, glow: 1.1, glowCol: '#ffe0a6', draw: x => {
    x.fillStyle = '#22325e'; waterTop(x, { x0: -1, x1: 1, base: -.055, amp: .001, len: .05 });
    x.save(); x.beginPath(); x.rect(-1, -.2, 2, .142); x.clip(); waves(x, { x0: -1, x1: 1, y0: -.062, y1: -.2, r: .006, fill: '#22325e', line: '#34487a', lw: .0006 }); x.restore();
    // 帆船
    for (const [bx, s] of [[-.55, .03], [.12, .025], [.62, .032]]) { x.fillStyle = '#1a2850'; x.beginPath(); x.moveTo(bx - s, -.06); x.lineTo(bx + s, -.06); x.lineTo(bx + s * .7, -.068); x.lineTo(bx - s * .7, -.068); x.fill(); x.beginPath(); x.moveTo(bx, -.06); x.lineTo(bx, -.06 + s * 1.5); x.quadraticCurveTo(bx + s * .7, -.06 + s * .8, bx + s * .1, -.06 + s * .1); x.fill(); }
  } }));
  // 桥 + 轨道（桥在 x -0.1 ~ 1.1）
  const BY = -.04;
  S.add(sheet({ U, w: W, h: .4, x: CX, z: -.052, trans: .12, ppm: 3600, draw: x => {
    x.fillStyle = '#16213f';
    x.fillRect(-1, BY - .006 - .5 * 0, 2, .006);     // 桥面
    for (let i = 0; i < 16; i++) { const px = -.62 + i * .08; x.fillRect(px - .006, -.2, .012, .2 + BY - .006); }
    x.save(); x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 15; i++) { const px = -.58 + i * .08; x.beginPath(); x.ellipse(px, -.07, .034, .025, 0, 0, Math.PI); x.fill(); } x.restore();
    x.lineWidth = .0012; x.strokeStyle = '#16213f'; for (let i = 0; i < 60; i++) { const px = -.9 + i * .03; x.beginPath(); x.moveTo(px, BY); x.lineTo(px + .015, BY + .012); x.lineTo(px + .03, BY); x.stroke(); } x.fillRect(-1, BY + .012, 2, .0012);
    x.fillStyle = '#16213f'; ridge(x, { x0: -1, x1: -.66, base: -.05, amp: .01, seed: 2, freq: 20 }); ridge(x, { x0: .6, x1: 1, base: -.05, amp: .01, seed: 5, freq: 20 });
  } }));
  const tr = S.add(sheet({ U, w: .8, h: .06, z: -.049, trans: .15, glow: 2.2, glowCol: '#ffc060', shadow: true, draw: x => train(x, -.38, 0, 8), glowDraw: g => train(null, -.38, 0, 8, {}, g), glowRes: 1 }));
  // 近景松树与桂花树
  S.add(sheet({ U, w: W, h: .4, x: CX, z: -.028, trans: .06, ppm: 3200, draw: x => {
    x.fillStyle = '#0f1734'; const R = mulberry(12);
    for (let i = 0; i < 6; i++) { const px = -.85 + i * .33 + R() * .06; if (i % 2) pine(x, { cx: px, by: -.24, h: .15 + R() * .04, seed: i }); else osmanthus(x, { cx: px, by: -.22, h: .1 + R() * .03, seed: i, leaves: 40 }); }
    ridge(x, { x0: -1, x1: 1, base: -.12, amp: .008, seed: 7, freq: 16 });
  } }));
  S.add(sheet({ U, w: W, h: .4, x: CX, z: .012, trans: .02, ppm: 2400, draw: x => { x.fillStyle = '#080d20'; x.strokeStyle = '#080d20'; ridge(x, { x0: -1, x1: 1, base: -.14, amp: .012, seed: 9, freq: 10 }); reeds(x, { x0: -1, x1: 1, by: -.15, h: .06, n: 120, seed: 3 }); } }));
  return {
    S,
    update(t) {
      const u = t / E.dur, cx = lerp(-.05, .55, eio(clamp(u * .9 + .05)));
      sky.position.x = cx; mn.position.x = cx + .09 - .02 * u;
      const tx = lerp(-.35, 1.0, clamp(t / (E.dur + 1)));
      tr.position.set(tx, BY + .001 + .0006 * Math.abs(Math.sin(t * 9)), -.049); tr.rotation.z = .002 * Math.sin(t * 4.5);
      aim(S.cam, [cx, -.012, .42, cx + .01, -.02, -.06], t, { hand: .0008 });
    },
    post() { return { focus: S.cam.position.z + .05, aper: 14, maxCoc: 14, bloom: { strength: .4, radius: .6, threshold: 1.1 } }; },
    grade(t) { return { expo: 1.05, vig: .42, sat: 1.05, contrast: .1 }; },
  };
}
