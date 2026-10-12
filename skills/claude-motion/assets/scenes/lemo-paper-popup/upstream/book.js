// 立体书：书脊在远端（z=0），封面向后翻到 90° 立起来当舞台背景
import * as THREE from 'three';
import { cv, paperFill, GRAIN } from './paper.js';
import { mulberry, clamp } from './lib.js';

export const BW = 0.44, BD = 0.30;       // 书页宽（x）× 深（z）
export const BT = 0.0035, HB = 0.014;    // 封板厚、半本书页厚
export const PG = BT + HB;               // 下半本页面高度

export function texOf(c, o = {}) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  return t;
}

// 书页边（细横线）
function edgeCanvas() {
  const c = cv(512, 64), x = c.getContext('2d'); x.fillStyle = '#efe6d2'; x.fillRect(0, 0, 512, 64);
  const R = mulberry(9);
  for (let i = 0; i < 64; i += 1.3) { x.fillStyle = `rgba(150,130,100,${.08 + R() * .18})`; x.fillRect(0, i, 512, .6); }
  return c;
}

// 布面封面 + 烫金标题；同时生成 roughness(g)/metalness(b) 贴图
export function coverCanvases(drawPipIcon) {
  const w = 2048, h = Math.round(2048 * BD / BW), c = cv(w, h), x = c.getContext('2d'), m = cv(w, h), y = m.getContext('2d');
  // 布纹
  x.fillStyle = '#1f5566'; x.fillRect(0, 0, w, h);
  const R = mulberry(3);
  for (let i = 0; i < h; i += 3) { x.fillStyle = `rgba(0,0,0,${.05 + R() * .07})`; x.fillRect(0, i, w, 1.2); }
  for (let i = 0; i < w; i += 3) { x.fillStyle = `rgba(255,255,255,${.02 + R() * .04})`; x.fillRect(i, 0, 1.2, h); }
  for (let i = 0; i < 90; i++) { const px = R() * w, py = R() * h, r = 60 + R() * 300, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(${R() < .5 ? '0,0,0' : '120,170,180'},${.06 * R()})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, 2 * r, 2 * r); }
  // 金色区域同时画进 m（b=金属，g=粗糙）
  y.fillStyle = 'rgb(0,235,0)'; y.fillRect(0, 0, w, h);
  const GOLD = '#e0b456';
  const both = fn => { x.save(); fn(x, GOLD); x.restore(); y.save(); fn(y, 'rgb(0,90,255)'); y.restore(); };
  both((k, col) => { k.strokeStyle = col; k.lineWidth = 10; k.strokeRect(90, 90, w - 180, h - 180); k.lineWidth = 4; k.strokeRect(120, 120, w - 240, h - 240);
    for (const [cx, cy] of [[120, 120], [w - 120, 120], [120, h - 120], [w - 120, h - 120]]) { k.beginPath(); k.arc(cx, cy, 34, 0, Math.PI * 2); k.fillStyle = col; k.fill(); } });
  both((k, col) => { k.fillStyle = col; k.textAlign = 'center'; k.textBaseline = 'alphabetic';
    k.font = '150px "Lilita One"'; k.fillText('The Little', w * .63, h * .33);
    k.font = '210px "Lilita One"'; k.fillText("Sprite's", w * .63, h * .52);
    k.font = '170px "Lilita One"'; k.fillText('Adventure', w * .63, h * .69);
    k.font = 'italic 70px "IM Fell English"'; k.fillText('~ a paper tale ~', w * .63, h * .81); });
  // 圆形插图（纸色底 + 皮普）
  const cx = w * .24, cy = h * .52, r = 330;
  both((k, col) => { k.beginPath(); k.arc(cx, cy, r + 26, 0, Math.PI * 2); k.lineWidth = 14; k.strokeStyle = col; k.stroke(); });
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();
  x.fillStyle = '#f4e9cf'; x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  x.fillStyle = '#9fd18a'; x.beginPath(); x.ellipse(cx, cy + r * .95, r * 1.3, r * .55, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#ffd766'; x.beginPath(); x.arc(cx + r * .45, cy - r * .45, r * .2, 0, Math.PI * 2); x.fill();
  drawPipIcon(x, cx - r * .5, cy - r * .55, r * 1.0, r * 1.25);
  x.restore();
  y.save(); y.beginPath(); y.arc(cx, cy, r, 0, Math.PI * 2); y.fillStyle = 'rgb(0,200,0)'; y.fill(); y.restore();
  return { c, m };
}

export function makeBook(cover) {
  const root = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: '#1f5566', roughness: .85 });
  const edge = texOf(edgeCanvas()); edge.wrapS = edge.wrapT = THREE.RepeatWrapping;
  const edgeMat = new THREE.MeshStandardMaterial({ map: edge, roughness: .95 });
  const pageTop = new THREE.MeshStandardMaterial({ color: '#f3ead6', roughness: .95 });

  // 下半本：封板 + 书页块
  const lb = new THREE.Mesh(new THREE.BoxGeometry(BW + .012, BT, BD + .006), cloth); lb.position.set(0, BT / 2, BD / 2 + .002);
  const lp = new THREE.Mesh(new THREE.BoxGeometry(BW, HB, BD - .002), [edgeMat, edgeMat, pageTop, pageTop, edgeMat, edgeMat]); lp.position.set(0, BT + HB / 2, BD / 2);
  for (const m of [lb, lp]) { m.castShadow = m.receiveShadow = true; root.add(m); }
  // 书脊
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(PG, PG, BW + .012, 24, 1, false, Math.PI, Math.PI), cloth);
  spine.rotation.z = Math.PI / 2; spine.position.set(0, PG, -.001); spine.castShadow = true; root.add(spine);

  const hinge = new THREE.Group(); hinge.position.set(0, PG, 0); root.add(hinge);
  const upper = new THREE.Group(); hinge.add(upper);
  const open = new THREE.Group(); open.rotation.x = Math.PI / 2; upper.add(open);
  // 打开状态坐标（open 帧 = 立起时的世界朝向）：背景页在 z=0 朝 +z，书块在 z<0
  const up = new THREE.Mesh(new THREE.BoxGeometry(BW, BD - .002, HB), [edgeMat, edgeMat, edgeMat, edgeMat, pageTop, pageTop]); up.position.set(0, BD / 2, -HB / 2);
  const ub = new THREE.Mesh(new THREE.BoxGeometry(BW + .012, BD + .006, BT), cloth); ub.position.set(0, BD / 2 + .002, -HB - BT / 2);
  const coverTex = texOf(cover.c), mr = texOf(cover.m, { linear: true });
  const coverMat = new THREE.MeshStandardMaterial({ map: coverTex, roughnessMap: mr, metalnessMap: mr, roughness: 1, metalness: 1 });
  const cp = new THREE.Mesh(new THREE.PlaneGeometry(BW + .008, BD + .002), coverMat); cp.rotation.x = Math.PI; cp.position.set(0, BD / 2 + .002, -HB - BT - .0003);
  for (const m of [up, ub, cp]) { m.castShadow = m.receiveShadow = true; open.add(m); }

  // 地面页（stage 帧）与背景页（open 帧），带书沟弯曲
  const groundGeo = new THREE.PlaneGeometry(BW - .006, BD - .004, 1, 30); groundGeo.rotateX(-Math.PI / 2); groundGeo.translate(0, 0, BD / 2);
  gutter(groundGeo, 'z');
  const groundMat = new THREE.MeshStandardMaterial({ roughness: .92, color: '#ffffff' });
  const ground = new THREE.Mesh(groundGeo, groundMat); ground.position.y = .0003; ground.receiveShadow = true;
  const stage = new THREE.Group(); hinge.add(stage); stage.add(ground);
  const backGeo = new THREE.PlaneGeometry(BW - .006, BD - .004, 1, 30); backGeo.translate(0, BD / 2, 0); gutter(backGeo, 'y');
  const backMat = new THREE.MeshStandardMaterial({ roughness: .92, color: '#ffffff' });
  const back = new THREE.Mesh(backGeo, backMat); back.position.z = .0003; back.receiveShadow = true; open.add(back);
  const sky = new THREE.Group(); open.add(sky);

  // 翻页：一张弯曲的纸，正面=旧地面，背面=新天空
  const NS = 40, mkLeafGeo = () => { const g = new THREE.PlaneGeometry(BW - .008, 1, 1, NS); return g; };
  const lf = mkLeafGeo(), lb2 = mkLeafGeo();
  const leafFront = new THREE.Mesh(lf, new THREE.MeshStandardMaterial({ roughness: .92, side: THREE.FrontSide }));
  const leafBack = new THREE.Mesh(lb2, new THREE.MeshStandardMaterial({ roughness: .92, side: THREE.BackSide }));
  // UV：正面 v=1 在书沟；背面 v=1 在自由端（立起后在上）
  const uvF = lf.attributes.uv, uvB = lb2.attributes.uv;
  for (let i = 0; i < uvF.count; i++) { const v = uvF.getY(i); /* v:1 顶行 → s=0 */ uvB.setY(i, 1 - v); }
  uvB.needsUpdate = true;
  for (const m of [leafFront, leafBack]) { m.material.emissive = new THREE.Color(.42, .4, .38); m.castShadow = true; m.receiveShadow = true; m.visible = false; stage.add(m); }
  function setLeaf(u, bendAmt = .55) {
    const vis = u > 0 && u < 1; leafFront.visible = leafBack.visible = vis; if (!vis) return;
    const th = Math.PI / 2 * u, L = bendAmt * Math.sin(Math.PI * u);
    for (const g of [lf, lb2]) {
      const p = g.attributes.position, n = NS + 1;
      // PlaneGeometry 顶点顺序：行 iy=0..NS（y 从 +0.5 到 -0.5），每行 2 个
      let zz = 0, yy = 0;
      const col = [];
      for (let iy = 0; iy <= NS; iy++) {
        const s = iy / NS;
        if (iy > 0) { const phi = th * (1 - L * (s - .5 / NS)) + (1 - u) * 0; zz += Math.cos(phi) * BD / NS; yy += Math.sin(phi) * BD / NS; }
        col.push([yy, zz]);
      }
      for (let iy = 0; iy <= NS; iy++) for (let ix = 0; ix < 2; ix++) { const k = iy * 2 + ix; p.setY(k, col[iy][0] + .0009); p.setZ(k, col[iy][1]); }
      p.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
    }
  }

  function setOpen(th) { upper.rotation.x = -th; }
  return { root, hinge, upper, open, stage, sky, ground, back, groundMat, backMat, leafFront, leafBack, setLeaf, setOpen, coverMat };
}

function gutter(g, axis) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const d = axis === 'z' ? p.getZ(i) : p.getY(i), dip = -.0045 * Math.exp(-d / .012);
    if (axis === 'z') p.setY(i, p.getY(i) + dip); else p.setZ(i, p.getZ(i) + dip);
  }
  g.computeVertexNormals();
}
