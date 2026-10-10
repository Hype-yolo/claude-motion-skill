// 剪纸网格：正面=美术，背面=纸色（同一剪影），能投出镂空阴影
import * as THREE from 'three';
import { texOf } from './book.js';

const cache = new Map();
export function mats(tex, backCol = '#efe8da') {
  const k = tex.uuid + backCol; if (cache.has(k)) return cache.get(k);
  const front = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .5, alphaToCoverage: true, roughness: .88, side: THREE.FrontSide });
  const back = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .5, alphaToCoverage: true, roughness: .92, side: THREE.BackSide });
  const bc = new THREE.Color(backCol);
  back.onBeforeCompile = s => { s.uniforms.backCol = { value: bc }; s.fragmentShader = 'uniform vec3 backCol;\n' + s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = backCol;'); };
  back.customProgramCacheKey = () => 'paperback';
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: .5, side: THREE.DoubleSide });
  const r = { front, back, depth }; cache.set(k, r); return r;
}

// item: {c,w,h,ax,ay}；返回 group，原点=锚点
export function cutMesh(item, o = {}) {
  const tex = o.tex || texOf(item.c), s = o.s ?? 1, w = item.w * s, h = item.h * s;
  const geo = new THREE.PlaneGeometry(w, h); geo.translate(w / 2 - item.ax * w, item.ay * h - h / 2, 0);
  const m = mats(tex, o.backCol);
  const f = new THREE.Mesh(geo, m.front), b = new THREE.Mesh(geo, m.back);
  f.castShadow = o.shadow ?? true; f.customDepthMaterial = m.depth; f.receiveShadow = true; b.receiveShadow = true;
  const g = new THREE.Group(); g.add(f, b); g.userData = { w, h, tex, front: f, back: b };
  return g;
}

// 软圆影子贴片
let blobTex = null;
export function blobShadow(r, a = .45) {
  if (!blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.55, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: a, depthWrite: false, color: '#2a1a10' }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 2; m.material.polygonOffset = true; m.material.polygonOffsetFactor = -2;
  return m;
}

// 细线（挂云/星星的线）
export function thread(len, col = '#6b5a4a') {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(.00018, .00018, len, 5), new THREE.MeshStandardMaterial({ color: col, roughness: .8 }));
  m.geometry.translate(0, len / 2, 0); m.castShadow = true; return m;
}

// 实例化粒子：fn(i, t) → {x,y,z, rx,ry,rz, s, vis}
export function particles(geo, mat, n, fn) {
  const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false;
  const d = new THREE.Object3D();
  im.userData.update = t => {
    let any = false;
    for (let i = 0; i < n; i++) {
      const p = fn(i, t);
      if (!p || p.s <= 0) { d.position.set(0, -10, 0); d.scale.setScalar(1e-5); }
      else { any = true; d.position.set(p.x, p.y, p.z); d.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0); d.scale.setScalar(p.s); }
      d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      if (p && p.col && im.instanceColor !== undefined) im.setColorAt(i, p.col);
    }
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.visible = any;
  };
  return im;
}
