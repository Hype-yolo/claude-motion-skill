// 角色：皮普（正/背两面，逐帧重画姿势）、皱皱、折折（立体纸飞机）、鲸鱼、小船
import * as THREE from 'three';
import * as A from './art.js';
import { cv, INK } from './paper.js';
import { texOf } from './book.js';
import { cutMesh, blobShadow } from './cutmesh.js';
import { clamp, lerp } from './lib.js';

function dynPlane(c, h, ax, ay, side) {
  const t = texOf(c), w = h * c.width / c.height;
  const g = new THREE.PlaneGeometry(w, h); g.translate(w / 2 - ax * w, ay * h - h / 2, 0);
  const m = new THREE.MeshStandardMaterial({ map: t, alphaTest: .5, alphaToCoverage: true, roughness: .85, side });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true;
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: .5, side: THREE.DoubleSide });
  return { mesh, t };
}

export function makePip(H = .036) {
  const cF = cv(A.PIP_W, A.PIP_H), cB = cv(A.PIP_W, A.PIP_H);
  A.drawPip(cF.getContext('2d'), {}); A.drawPipBack(cB.getContext('2d'), {});
  const ay = 1050 / A.PIP_H;
  const F = dynPlane(cF, H, .5, ay, THREE.FrontSide), B = dynPlane(cB, H, .5, ay, THREE.BackSide);
  F.mesh.castShadow = true;
  const root = new THREE.Group(), body = new THREE.Group(); body.add(F.mesh, B.mesh); root.add(body);
  const shadow = blobShadow(H * .32, .5);
  let key = '';
  const pip = {
    root, body, shadow, H,
    pose(p) {
      const k = JSON.stringify(p, (kk, v) => typeof v === 'number' ? Math.round(v * 40) / 40 : v);
      if (k === key) return; key = k;
      A.drawPip(cF.getContext('2d'), p); A.drawPipBack(cB.getContext('2d'), p); F.t.needsUpdate = B.t.needsUpdate = true;
    },
    // 头顶在世界中的位置（气泡锚点）
    head(v = new THREE.Vector3()) { return v.set(0, H * .98, 0).applyMatrix4(body.matrixWorld); },
  };
  return pip;
}

export function makeCrumple(D = .042) {
  const c = cv(A.CR_W, A.CR_H); A.drawCrumple(c.getContext('2d'), {});
  const F = dynPlane(c, D, .5, .5, THREE.DoubleSide); F.mesh.castShadow = true;
  const root = new THREE.Group(), spin = new THREE.Group(); spin.add(F.mesh); spin.position.y = D * .5 * (400 / 380) * .95; root.add(spin);
  const shadow = blobShadow(D * .45, .45);
  let key = '';
  return {
    root, spin, shadow, D,
    pose(p) { const k = JSON.stringify(p, (kk, v) => typeof v === 'number' ? Math.round(v * 20) / 20 : v); if (k === key) return; key = k; A.drawCrumple(c.getContext('2d'), p); F.t.needsUpdate = true; },
    head(v = new THREE.Vector3()) { return v.set(0, D * .95, 0).applyMatrix4(root.matrixWorld); },
  };
}

// ---------- 折折：可折叠的立体纸飞机 ----------
function planeFaceCanvas() {
  const c = cv(512, 256), x = c.getContext('2d');
  x.fillStyle = '#fbf8f1'; x.fillRect(0, 0, 512, 256);
  x.strokeStyle = 'rgba(110,150,210,.4)'; x.lineWidth = 3; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(0, 30 + i * 40); x.lineTo(512, 30 + i * 40); x.stroke(); }
  return c;
}
export function makeFold(L = .052, S = .05, KD = .011) {
  const paper = planeFaceCanvas(), face = cv(512, 256), fx = face.getContext('2d');
  const tPaper = texOf(paper), tFace = texOf(face);
  const drawFace = (mood = 'happy', blink = 0) => {
    fx.drawImage(paper, 0, 0);
    // 眼睛靠机头（u 大的一侧）
    const ex = 390, ey = 70;
    fx.fillStyle = INK;
    if (mood === 'sleep') { fx.lineWidth = 9; fx.lineCap = 'round'; fx.strokeStyle = INK; for (const d of [0, 46]) { fx.beginPath(); fx.moveTo(ex - 14 + d, ey); fx.quadraticCurveTo(ex + d, ey + 10, ex + 14 + d, ey); fx.stroke(); } }
    else for (const d of [0, 46]) { fx.beginPath(); fx.ellipse(ex + d, ey, 11, 20 * (1 - blink * .9), 0, 0, Math.PI * 2); fx.fill(); fx.fillStyle = '#fff'; fx.beginPath(); fx.ellipse(ex + d - 3, ey - 8, 4, 6, 0, 0, Math.PI * 2); fx.fill(); fx.fillStyle = INK; }
    fx.beginPath(); fx.ellipse(ex + 64, ey + 30, 16, 9, 0, 0, Math.PI * 2); fx.fillStyle = 'rgba(255,120,130,.5)'; fx.fill();
    if (mood !== 'sleep') { fx.beginPath(); fx.moveTo(ex + 6, ey + 34); fx.quadraticCurveTo(ex + 26, ey + 52, ex + 44, ey + 32); fx.lineWidth = 7; fx.strokeStyle = INK; fx.lineCap = 'round'; fx.stroke(); }
    tFace.needsUpdate = true;
  };
  drawFace('sleep');
  const mPaper = new THREE.MeshStandardMaterial({ map: tPaper, roughness: .9, side: THREE.DoubleSide });
  const mFace = new THREE.MeshStandardMaterial({ map: tFace, roughness: .9, side: THREE.DoubleSide });
  // 四个三角：左右翼、左右龙骨；全部绕机身中线（x 轴）铰接
  const mkTri = (mat, uvs) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
  };
  const wingL = mkTri(mPaper, [1, .5, 0, .5, 0, 1]), wingR = mkTri(mPaper, [1, .5, 0, .5, 0, 0]);
  const keelL = mkTri(mFace, [1, .9, 0, .9, .15, 0]), keelR = mkTri(mFace, [1, .9, 0, .9, .15, 0]);
  const craft = new THREE.Group(); craft.add(wingL, wingR, keelL, keelR);
  const root = new THREE.Group(); root.add(craft);
  const N = [L / 2, 0, 0], T = [-L / 2, 0, 0];
  const setTri = (m, a, b, c) => { const p = m.geometry.attributes.position; p.setXYZ(0, ...a); p.setXYZ(1, ...b); p.setXYZ(2, ...c); p.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere(); };
  const rot = (x, r, th, side) => [x, r * Math.sin(th), side * r * Math.cos(th)];
  function fold(f) {
    const wth = lerp(0, .16, f), kth = lerp(-.02, -Math.PI / 2 + .05, f);
    setTri(wingL, N, rot(-L / 2, S / 2, wth, -1), T);
    setTri(wingR, N, T, rot(-L / 2, S / 2, wth, 1));
    setTri(keelL, N, T, rot(-L / 2 + .006, KD, kth, -1));
    setTri(keelR, N, T, rot(-L / 2 + .006, KD, kth, 1));
  }
  fold(1);
  const shadow = blobShadow(L * .45, .35);
  return { root, craft, fold, drawFace, shadow, L, head(v = new THREE.Vector3()) { return v.set(0, .02, 0).applyMatrix4(root.matrixWorld); } };
}

export function makeWhale(w = .1) {
  const c = cv(1400, 800), c2 = cv(1400, 800); A.drawWhale(c.getContext('2d'), {}); A.drawWhale(c2.getContext('2d'), { happy: true });
  const root = new THREE.Group();
  const a = cutMesh({ c, w, h: w * 800 / 1400, ax: .5, ay: 1 }), b = cutMesh({ c: c2, w, h: w * 800 / 1400, ax: .5, ay: 1 });
  root.add(a, b); b.visible = false;
  return { root, w, h: w * 800 / 1400, setHappy(h) { a.visible = !h; b.visible = !!h; } };
}
export function makeBoat(w = .06) {
  const g = new THREE.Group(), sail = cutMesh(A.boat(w, 'sail')), hull = cutMesh(A.boat(w, 'hull'));
  sail.position.set(-w * .12, 0, -.003); hull.position.z = .002; g.add(sail, hull); return g;
}
