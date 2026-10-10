// memsprites.js — 回忆里的精灵：4 色小时候（160×90 原生）、8-bit 少年（篝火，坐姿）
import { C, GBI, sprFromRows } from './px.js';
const G4 = { k: GBI[0], d: GBI[1], l: GBI[2], w: GBI[3] };
// 小 ARLO：深色头发、拿木剑；两帧走路
const KA = [[
  '...kkk....',
  '..kdddk...',
  '.kdddddk..',
  '.kddwwwk..',
  '.kdwwkwk..',
  '..kwwwwk..',
  '...kkkk...',
  '..kdddk...',
  '.kdddddk..',
  '.kwddddkl.',
  '..kllllkl.',
  '..kk.kk.l.',
  '.kk...kk..',
], [
  '...kkk....',
  '..kdddk...',
  '.kdddddk..',
  '.kddwwwk..',
  '.kdwwkwk..',
  '..kwwwwk..',
  '...kkkk...',
  '..kdddk...',
  '.kdddddkl.',
  '.kwddddkl.',
  '..kllllk..',
  '...kkkk...',
  '...kk.kk..',
]];
// 小 WREN：浅色头发 + 发辫；两帧走路（围巾尾巴由场景程序画）
const KW = [[
  '...kkkk...',
  '..kllllk..',
  '.kllllllk.',
  'klllwwwwk.',
  'kllwwkwwk.',
  'klkwwwwk..',
  '.k.kkkk...',
  '..kdddddk.',
  '.kwllllk..',
  '..kllllk..',
  '.klllllk..',
  '..kk.kk...',
  '.kk...kk..',
], [
  '...kkkk...',
  '..kllllk..',
  '.kllllllk.',
  'klllwwwwk.',
  'kllwwkwwk.',
  'klkwwwwk..',
  '.k.kkkk...',
  '..kdddddk.',
  '.kwllllk..',
  '..kllllk..',
  '.klllllk..',
  '...kkkk...',
  '...kk.kk..',
]];
// 小 WREN 指向远方
const KW_POINT = [
  '...kkkk...',
  '..kllllk..',
  '.kllllllk.',
  'klllwwwwk.',
  'kllwwkwwk.',
  'klkwwwwk..',
  '.k.kkkkkkw',
  '..kddddd..',
  '.kllllk...',
  '..kllllk..',
  '.klllllk..',
  '..kk.kk...',
  '.kk...kk..',
];
const cache = new Map();
const mk = (k, rows, map) => { if (!cache.has(k)) cache.set(k, sprFromRows(rows, map)); return cache.get(k); };
export const kidArlo = f => mk('ka' + (f & 1), KA[f & 1], G4);
export const kidWren = f => mk('kw' + (f & 1), KW[f & 1], G4);
export const kidWrenPoint = () => mk('kwp', KW_POINT, G4);
