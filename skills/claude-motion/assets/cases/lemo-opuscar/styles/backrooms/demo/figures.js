// 人形：① 摄像者自己的腿和鞋（低头时入画）② "东西"——远处的细长剪影，比例略不对
import * as THREE from 'three';
import { paint } from './world.js';

// 两点之间的胶囊（半径 r），每帧可重新摆
function limb(mat, r) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, 1, 4, 10), mat);
  m.userData.r = r;
  m.set = (a, b, r2) => {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    m.position.copy(a).addScaledVector(d, .5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    const k = (r2 ?? r) / r;   // CapsuleGeometry 总高 1+2r：整体按 y 缩放到 ≈ L+r（端头略压扁，剪影上看不出）
    m.scale.set(k, Math.max(.01, (L + r) / (1 + 2 * r)), k);
  };
  return m;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// —— 摄像者的鞋：低头时只露鞋尖和一截地毯（裤腿不入画）——
// 鞋 = 脚印轮廓挤出 + 倒角（鞋面）+ 略大一圈的浅色鞋底 + 鞋带 + 鞋头缝线；+z 为鞋尖
function shoeGeo(w, L, h, bevel) {
  const sh = new THREE.Shape(), n = 40;
  for (let k = 0; k <= n; k++) {       // 顶视轮廓：鞋尖圆、前掌宽、足弓收、后跟圆
    const a = k / n * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    const zf = sn;                      // -1 后跟 … +1 鞋尖
    const wid = w / 2 * (0.78 + 0.22 * Math.sin((zf + 1) / 2 * Math.PI * 1.1)) * (zf > .55 ? Math.sqrt(Math.max(0, 1 - ((zf - .55) / .5) ** 2)) * .35 + .65 : 1);
    const x = c * wid - (zf > 0 ? .006 * zf : 0), z = zf * L / 2;
    k ? sh.lineTo(x, z) : sh.moveTo(x, z);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .8, bevelSegments: 4, curveSegments: 24 });
  g.rotateX(-Math.PI / 2); g.scale(1, 1, -1);   // 轮廓平面 → 地面，挤出方向 → 向上
  return g;
}
export function makeLegs(scene) {
  const g = new THREE.Group(); scene.add(g);
  const leather = paint({ color: '#2a2521', shin: 60, spec: .14 }), sole = paint({ color: '#6b6457' }), laceM = paint({ color: '#3a342e' }), stitch = paint({ color: '#4a4239' });
  const upperG = shoeGeo(.1, .28, .045, .025), soleG = shoeGeo(.112, .295, .012, .004);
  const parts = [0, 1].map(() => {
    const s = new THREE.Group();
    const so = new THREE.Mesh(soleG, sole); so.position.y = .004;
    const up = new THREE.Mesh(upperG, leather); up.position.y = .02; up.scale.set(1, 1, 1);
    // 鞋面前高后低：前半段的"鞋舌/鞋带区"凸起
    const tongue = new THREE.Mesh(new THREE.CapsuleGeometry(.03, .08, 4, 10), leather); tongue.rotation.x = Math.PI / 2 - .25; tongue.scale.set(1.2, 1, .7); tongue.position.set(0, .085, -.02);
    s.add(so, up, tongue);
    for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(.05, .006, .007), laceM); l.position.set(0, .1 - k * .006, -.05 + k * .022); l.rotation.x = -.25; s.add(l); }
    const cap = new THREE.Mesh(new THREE.TorusGeometry(.04, .0025, 4, 20, Math.PI), stitch); cap.rotation.x = -Math.PI / 2; cap.position.set(0, .085, .07); s.add(cap);
    g.add(s);
    return { s };
  });
  // body = {x, z, yaw, phase, amp}（phase = 步态相位，amp = 步幅 0..1）
  g.pose = (b) => {
    const fw = V(-Math.sin(b.yaw), 0, -Math.cos(b.yaw)), rt = V(Math.cos(b.yaw), 0, -Math.sin(b.yaw));
    parts.forEach((p, i) => {
      const sd = i ? 1 : -1, ph = b.phase + i * Math.PI;
      const fwd = Math.sin(ph) * .26 * b.amp + .15, lift = Math.max(0, Math.cos(ph)) * .06 * b.amp;
      const ank = V(b.x, 0, b.z).addScaledVector(fw, fwd).addScaledVector(rt, sd * (.11 + b.stance));
      p.s.position.copy(ank).setY(lift);
      p.s.rotation.set(0, b.yaw + Math.PI - sd * .1, 0);   // +z（鞋尖）朝前，略外八
      p.s.rotateX(Math.max(0, Math.cos(ph)) * .2 * b.amp);
    });
  };
  return g;
}

// —— "东西"：走廊尽头的剪影公告板（Canvas2D 有机轮廓，见 thing2d.js），每帧重画挥手 ——
import { drawThing } from './thing2d.js';
import { silhouetteMat } from './world.js';
export function makeThing(scene) {
  const PX = 400, Wm = 1.6, Hm = 2.8;
  const cv = document.createElement('canvas'); cv.width = Wm * PX; cv.height = Hm * PX;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(Wm, Hm), silhouetteMat(tex));
  m.geometry.translate(0, Hm / 2, 0);
  m.isPoints = true;   // 让 GTAOPass 的法线/深度预渲染跳过它（否则整块矩形会在背景上压出 AO 暗框）
  scene.add(m);
  m.pose = (wave = 1, ph = 0, tilt = .28) => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save(); ctx.translate(cv.width / 2, cv.height - 4); drawThing(ctx, PX, { wave, ph, tilt, color: '#000' }); ctx.restore();
    tex.needsUpdate = true;
  };
  m.pose(0);
  return m;
}
