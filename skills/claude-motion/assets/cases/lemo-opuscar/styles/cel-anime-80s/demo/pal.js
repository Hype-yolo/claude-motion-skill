// 色指定（color model）：白天标准色 → 按时间带（夜 / 黎明）自动换算，和真实动画的"时间帯別 色指定"一样
import { hex } from './cel.js';

export const BASE = {
  skin: { f: '#ffd9c4', s: '#e2a395', h: '#fff1e8', l: '#5a2e2e' },
  blush: '#ff9a9a',
  hair: { f: '#4a3472', s: '#2d1e4e', h: '#8f74cc', l: '#2e1850' },
  lash: '#1c0f26',
  jacket: { f: '#2f6fe2', s: '#1d45a2', h: '#86b6ff', l: '#112459' },
  stripe: { f: '#f4f6fb', s: '#b7c0d9', l: '#44506e' },
  scarf: { f: '#ff6b6b', s: '#cf3d5b', h: '#ffb6a2', l: '#761b34' },
  pants: { f: '#363c5c', s: '#20243c', h: '#5b6490', l: '#0d0f1f' },
  boot: { f: '#48424f', s: '#2a2632', h: '#80798f', l: '#121016' },
  glove: { f: '#3e3a4a', s: '#26232f', h: '#7a7690', l: '#100e16' },
  cuff: { f: '#22c3b2', s: '#138578', l: '#0b3d38' },
  strap: { f: '#5a4c66', s: '#3a3044', l: '#16101c' },
  lens: { f: '#86e6ff', s: '#3a9fd0', h: '#ffffff', l: '#1d3a58' },
  phone: { f: '#2a2a34', s: '#16161d', h: '#5c5c70', l: '#08080c' },
  white: { f: '#f3f6fc', s: '#a9b3cd', h: '#ffffff', l: '#39456a' },
  teal: { f: '#1fc4b2', s: '#12857c', h: '#8ff5e8', l: '#0b3e3a' },
  magenta: { f: '#ff4fa8', s: '#b8327a', l: '#5c1238' },
  dark: { f: '#2b2d40', s: '#181a26', h: '#50546e', l: '#08090f' },
  chrome: { f: '#dfe7f3', s: '#646f90', h: '#ffffff', l: '#2b3350' },
  gold: { f: '#e2b24e', s: '#9a6c28', h: '#fff0b0', l: '#4d3210' },
  tire: { f: '#23232f', s: '#15151c', h: '#565873', l: '#07070b' },
  seat: { f: '#2e2a36', s: '#1b1822', h: '#5d5670', l: '#0a090d' },
  eye: { f: '#5b3fb0', s: '#2c1d66', h: '#b69cff', l: '#150a33' },
  white_eye: '#fbf8ff',
  mouth: '#9a3b4a',
};

const mul = (c, m) => { const v = hex(c); return '#' + v.map((x, i) => Math.max(0, Math.min(255, Math.round(x * m[i]))).toString(16).padStart(2, '0')).join(''); };

// 时间带：f/h 用 lit 乘色，s 用 shade 乘色，线色也跟着压暗
export const LIGHTS = {
  day: { lit: [1, 1, 1], shade: [1, 1, 1], line: [1, 1, 1] },
  night: { lit: [.78, .74, 1.0], shade: [.58, .52, .92], line: [.8, .7, 1.1] },
  dawn: { lit: [1.04, .9, .84], shade: [.86, .66, .8], line: [1, .8, .85] },
  sil: { lit: [.2, .16, .32], shade: [.14, .1, .24], line: [.3, .2, .5] },
  backlit: { lit: [.42, .3, .55], shade: [.24, .16, .36], line: [.4, .25, .5] },
};
export function palette(name) {
  const L = LIGHTS[name], out = {};
  for (const [k, v] of Object.entries(BASE)) {
    if (typeof v === 'string') { out[k] = mul(v, L.lit); continue; }
    out[k] = {};
    for (const [kk, c] of Object.entries(v)) out[k][kk] = mul(c, kk === 's' ? L.shade : kk === 'l' ? L.line : L.lit);
  }
  return out;
}
export const PAL = { day: palette('day'), night: palette('night'), dawn: palette('dawn'), sil: palette('sil'), backlit: palette('backlit') };
// 夜景的皮肤单独指定：中性偏冷的亮部 + 冷紫阴影（按乘色换算会整张脸发粉）
Object.assign(PAL.night.skin, { f: '#e9c9c4', s: '#9b82b4', h: '#fff2f2' });
PAL.night.blush = '#e0869a';
