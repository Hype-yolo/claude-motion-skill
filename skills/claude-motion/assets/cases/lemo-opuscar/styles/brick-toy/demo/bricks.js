// 积木几何与材质。单位：1 = 一个凸点间距（8mm）；砖高 1.2，板高 0.4
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const BRICK = 1.2, PLATE = 0.4, STUD_R = .24, STUD_H = .18;
export const COL = {
  red: '#c91a09', blue: '#0055bf', yellow: '#f2cd37', green: '#237841', white: '#f4f4f1', black: '#1b2a34',
  orange: '#fe8a18', lgray: '#a0a5a9', dgray: '#6c6e68', tan: '#e4cd9e', azure: '#36aebf', lime: '#bbe90b',
};

// 塑料表面：细微划痕 + 指纹的粗糙度贴图（g 通道）
function smudgeTex(seed = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  let s = seed * 9301; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = 'rgb(0,44,0)'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18; i++) {   // 指纹：同心弧
    const cx = R() * 512, cy = R() * 512, r0 = 20 + R() * 40;
    x.strokeStyle = 'rgba(0,120,0,.08)'; x.lineWidth = 1.2;
    for (let r = 4; r < r0; r += 3) { x.beginPath(); x.ellipse(cx, cy, r, r * .75, R() * 3, 0, Math.PI * 2); x.stroke(); }
  }
  for (let i = 0; i < 70; i++) {   // 划痕
    x.strokeStyle = `rgba(0,${90 + R() * 80 | 0},0,${.1 + R() * .2})`; x.lineWidth = .5 + R() * .8;
    const px = R() * 512, py = R() * 512, a = R() * Math.PI, l = 10 + R() * 60;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const SMUDGE = [1, 2, 3].map(smudgeTex);
const matCache = new Map();
export function plastic(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (matCache.has(key)) return matCache.get(key);
  const m = o.trans
    ? new THREE.MeshPhysicalMaterial({ color, transmission: .92, thickness: .8, roughness: .06, ior: 1.52, clearcoat: 1 })
    : new THREE.MeshPhysicalMaterial({ color, roughness: .9, roughnessMap: SMUDGE[matCache.size % 3], clearcoat: .85, clearcoatRoughness: .07, specularIntensity: .9, envMapIntensity: 1.15 });
  if (!o.trans) m.roughness = 1;   // 由贴图控制（~.27）
  matCache.set(key, m); return m;
}

function studs(w, d, y, round = false) {
  const gs = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
    const g = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 28, 1); g.translate(i - w / 2 + .5, y + STUD_H / 2, j - d / 2 + .5); gs.push(g);
    const lip = new THREE.TorusGeometry(STUD_R - .02, .02, 6, 28); lip.rotateX(Math.PI / 2); lip.translate(i - w / 2 + .5, y + STUD_H - .01, j - d / 2 + .5); gs.push(lip);
  }
  return gs;
}
const clean = g => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; };
const geoCache = new Map();
function cached(key, fn) { if (!geoCache.has(key)) geoCache.set(key, fn()); return geoCache.get(key); }

// 方砖/板：w×d，h = BRICK 或 PLATE；底部在 y=0
export function brickGeo(w, d, h = BRICK, o = {}) {
  return cached(`b${w}x${d}x${h}${o.tile ? 't' : ''}`, () => {
    const body = new RoundedBoxGeometry(w - .02, h - .01, d - .02, 4, .06); body.translate(0, h / 2, 0);
    return mergeGeometries([body, ...(o.tile ? [] : studs(w, d, h))].map(clean));
  });
}
export function roundGeo(r, h = BRICK) {   // 圆砖（1×1 r=.5，2×2 r=1）
  return cached(`r${r}x${h}`, () => {
    const body = new THREE.CylinderGeometry(r - .01, r - .01, h - .01, 40, 1); body.translate(0, h / 2, 0);
    const n = Math.round(r * 2);
    return mergeGeometries([body, ...studs(n, n, h)].map(clean));
  });
}
export function coneGeo(r, h) {
  return cached(`c${r}x${h}`, () => {
    const body = new THREE.CylinderGeometry(.26, r - .01, h, 40, 1); body.translate(0, h / 2, 0);
    return mergeGeometries([body, ...studs(1, 1, h)].map(clean));
  });
}
export function slopeGeo(len, h = BRICK * 2, d = 1) {   // 尾翼：斜坡楔形，沿 x 伸出
  return cached(`s${len}x${h}x${d}`, () => {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(len, 0); s.lineTo(len, .35); s.lineTo(.6, h); s.lineTo(0, h); s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: d - .02, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 2 });
    g.translate(0, 0, -(d - .02) / 2); return clean(g);
  });
}

export function mesh(geo, color, o = {}) {
  const m = new THREE.Mesh(geo, plastic(color, o)); m.castShadow = true; m.receiveShadow = true; return m;
}
export const brick = (w, d, color, o = {}) => mesh(brickGeo(w, d, o.h ?? BRICK, o), color, o);
export const plate = (w, d, color, o = {}) => mesh(brickGeo(w, d, PLATE, o), color, o);
