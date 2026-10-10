// S11 · 小满的城市：高楼一层层升起，灯很亮，月亮很远很淡
import * as THREE from 'three';
import { sheet, skyPanel, moon, setMoon } from '../paper.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, eo, back, lerp, clamp, mulberry, TAU } from '../lib.js';

// 一排楼：随机高度、平顶/尖顶/阶梯顶；窗格（glow 版只画亮着的窗）
export function towers(x, g, o) {
  const R = mulberry(o.seed || 1), c = x || g;
  let px = o.x0;
  while (px < o.x1) {
    const w = o.wmin + R() * (o.wmax - o.wmin), h = o.hmin + R() * (o.hmax - o.hmin), top = o.by + h, kind = R();
    if (x) {
      x.fillStyle = o.col; x.fillRect(px, o.by - .2, w, h + .2);
      if (kind < .25) { x.fillRect(px + w * .2, top, w * .6, h * .06); x.fillRect(px + w * .47, top + h * .06, w * .06, h * .12); }
      else if (kind < .45) { x.beginPath(); x.moveTo(px, top); x.lineTo(px + w / 2, top + w * .5); x.lineTo(px + w, top); x.fill(); }
      else if (kind < .6) { x.fillRect(px + w * .15, top, w * .7, h * .05); x.fillRect(px + w * .3, top + h * .05, w * .4, h * .04); }
    }
    const cols = Math.max(2, Math.round(w / o.cell)), rows = Math.round(h / (o.cell * 1.4));
    for (let r = 1; r < rows; r++) for (let k = 0; k < cols; k++) {
      const lit = R() < o.lit, wx = px + (k + .25) / cols * w, wy = o.by + r / rows * h, ww = w / cols * .5, wh = o.cell * .6;
      if (g) { if (lit) { g.fillStyle = R() < .15 ? '#9fe' : '#fff'; g.fillRect(wx, wy, ww, wh); } }
      else { x.fillStyle = lit ? (R() < .15 ? '#bfe6ff' : o.win) : o.dark; x.fillRect(wx, wy, ww, wh); }
    }
    if (o.neon && R() < .3 && g) { g.fillStyle = R() < .5 ? '#ff5fa0' : '#5ff0ff'; g.fillRect(px + w * .1, o.by + h * .6, w * .8, o.cell * .5); }
    if (o.neon && x && R() < .3) { x.fillStyle = R() < .5 ? '#ff7fb0' : '#7ff0ff'; x.fillRect(px + w * .1, o.by + h * .6, w * .8, o.cell * .5); }
    px += w + o.gap * R();
  }
}

export function build(E) {
  const MN = [.12, .1, -.14];
  const S = stage({ light: [0, -.02, -.14], lightR: .2, lightCol: '#c9b8ff', key: .8, amb: .3, ambCol: '#8a86c8', keyCol: '#d8d4ff' });
  const { U } = S;
  S.add(skyPanel({ w: .7, h: .5, y: .03, z: -.15, stops: [[0, '#150f2e'], [.5, '#2a2152'], [.85, '#4a3a6e'], [1, '#6a4a70']], stars: 25 }));
  const mn = S.add(moon({ x: MN[0], y: MN[1], z: MN[2], r: .013, gain: .9, halo: 3, haloGain: .12, core: '#f4ecdc', mid: '#e8dcc8', edge: '#d8c8b0' }));
  // 雾霾带
  const haze = S.add(sheet({ U, w: .7, h: .4, z: -.13, trans: .9, shadow: false, recv: false, finish: { rim: 0, under: 0 }, draw: x => { const gr = x.createLinearGradient(0, .04, 0, -.06); gr.addColorStop(0, 'rgba(160,130,190,0)'); gr.addColorStop(.6, 'rgba(160,130,190,.35)'); gr.addColorStop(1, 'rgba(160,130,190,.1)'); x.fillStyle = gr; x.fillRect(-.35, -.2, .7, .4); } }));
  haze.material.transparent = true; haze.material.alphaToCoverage = false; haze.material.alphaTest = .005; haze.material.depthWrite = false;
  const rows = [
    { z: -.12, col: '#4a3f7a', win: '#e8d0a0', dark: '#3e346a', seed: 3, hmin: .06, hmax: .15, wmin: .02, wmax: .04, cell: .004, lit: .3, trans: .5, glow: 1.2 },
    { z: -.1, col: '#342b5e', win: '#f2cf8a', dark: '#2b2350', seed: 7, hmin: .05, hmax: .13, wmin: .025, wmax: .05, cell: .005, lit: .35, trans: .3, glow: 1.6, neon: true },
    { z: -.08, col: '#231c44', win: '#f7d38f', dark: '#1d173a', seed: 11, hmin: .04, hmax: .11, wmin: .03, wmax: .06, cell: .006, lit: .4, trans: .2, glow: 2, neon: true },
    { z: -.06, col: '#161230', win: '#fbd797', dark: '#120f28', seed: 17, hmin: .03, hmax: .08, wmin: .035, wmax: .07, cell: .007, lit: .45, trans: .1, glow: 2.2, neon: true },
  ];
  const layers = rows.map((r, i) => S.add(sheet({ U, w: .7, h: .4, z: r.z, trans: r.trans, glow: r.glow, glowCol: '#ffd08a', ppm: 4400,
    draw: x => towers(x, null, { ...r, x0: -.35, x1: .35, by: -.07 - i * .012, gap: .006 }), glowDraw: g => towers(null, g, { ...r, x0: -.35, x1: .35, by: -.07 - i * .012, gap: .006 }), glowRes: .8 })));
  // 高架桥与车流光带
  const road = S.add(sheet({ U, w: .7, h: .4, z: -.04, trans: .1, glow: 2.5, glowCol: '#ffffff', draw: x => { x.fillStyle = '#0c0a1e'; x.fillRect(-.35, -.2, .7, .1); x.fillRect(-.35, -.1, .7, .006); for (let i = 0; i < 10; i++) x.fillRect(-.33 + i * .075, -.2, .008, .1); },
    glowDraw: g => { const R = mulberry(2); for (let i = 0; i < 40; i++) { const px = -.35 + R() * .7, w = .01 + R() * .03; g.fillStyle = R() < .5 ? '#ff6040' : '#fff4d0'; g.fillRect(px, -.093 + (R() < .5 ? 0 : .002), w, .0012); } } }));
  return {
    S,
    update(t) {
      // 楼群从下往上依次升起（立体书弹出的感觉）
      layers.forEach((m, i) => { const k = back(seg(t, .1 + i * .28, .9 + i * .28), 1.2); m.position.y = -.16 * (1 - k); });
      road.material.emissiveMap.wrapS = THREE.RepeatWrapping; road.material.emissiveMap.offset.x = -t * .05;
      setMoon(mn, .9 + .1 * Math.sin(t * .7));
      const u = eio(clamp(t / E.dur));
      aim(S.cam, [lerp(-.02, .03, u), lerp(-.04, .02, u), lerp(.36, .4, u), lerp(-.01, .06, u), lerp(-.04, .05, u), -.1], t);
    },
    post() { return { focus: S.cam.position.z + .08, aper: 12, maxCoc: 12, bloom: { strength: .5, radius: .6, threshold: 1.0 } }; },
    grade() { return { expo: 1.05, vig: .45, sat: 1.05, contrast: .12, lift: [.006, .0, .02], gain: [.98, .98, 1.03] }; },
  };
}
