// 鸭子一家：母鸭（白羽）+ 四只小鸭（黄绒毛）。车削（lathe）有机曲面身体、sheen 绒毛材质
// 表演：过斑马线（摇摆步态）→ 跳路沿（预备压缩 → 起跳拉伸 → 落地压缩回弹）；最后一只第一次撞到路沿弹回，第二次才上去
import * as THREE from 'three';
import { clamp, lerp, seg, ss, eo, hash } from '/core/lib.js';
import { CURB, POND, ZEBRA_Z } from './city.js';

// 身体轮廓（沿 y 轴车削，之后躺倒成沿 x 的蛋形）
function bodyGeo(len, wid) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16, a = u * Math.PI;
    // 蛋形：尾部（u=0）略尖、胸部（u≈.65）最宽
    const r = Math.sin(a) * (0.82 + 0.18 * Math.sin(a * .9 + .5)) * (1 - .25 * Math.pow(1 - u, 3));
    pts.push(new THREE.Vector2(Math.max(r, .001) * wid / 2, (u - .5) * len));
  }
  const g = new THREE.LatheGeometry(pts, 20);
  g.rotateZ(-Math.PI / 2);   // 轴向 → +x（头朝 +x）
  return g;
}
function fuzzMat(col, sheen) {
  return new THREE.MeshPhysicalMaterial({ color: col, roughness: .92, sheen: 1, sheenRoughness: .55, sheenColor: new THREE.Color(sheen), clearcoat: 0 });
}

function makeDuck(adult) {
  const L = adult ? .6 : .24, Wd = adult ? .34 : .17;   // 比真实略大一点（微缩摄影里的'演员'要看得清）
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const col = adult ? '#f4f1ea' : '#f4cf45', sh = adult ? '#ffffff' : '#fff2a8';
  const M = fuzzMat(col, sh);
  const torso = new THREE.Mesh(bodyGeo(L, Wd), M); torso.scale.set(1, adult ? .78 : .92, 1); torso.position.y = adult ? .16 : .085; body.add(torso);
  // 尾巴翘起
  const tail = new THREE.Mesh(new THREE.ConeGeometry(Wd * .22, L * .28, 10), M); tail.rotation.z = Math.PI / 2 + .6; tail.position.set(-L * .5, torso.position.y + L * .08, 0); body.add(tail);
  // 脖子 + 头
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(Wd * .2, Wd * .26, L * .32, 12), M); neck.position.set(L * .3, torso.position.y + L * .2, 0); neck.rotation.z = -.25; body.add(neck);
  const head = new THREE.Group(); head.position.set(L * .36, torso.position.y + L * (adult ? .42 : .36), 0); body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(Wd * (adult ? .3 : .42), 18, 14), M); skull.scale.set(1.15, 1, .95); head.add(skull);
  const billMat = new THREE.MeshStandardMaterial({ color: adult ? '#f08a1c' : '#f29a2a', roughness: .5 });
  const bill = new THREE.Mesh(new THREE.SphereGeometry(Wd * (adult ? .17 : .2), 12, 8), billMat); bill.scale.set(1.9, .45, 1.1); bill.position.set(Wd * (adult ? .38 : .5), -Wd * .03, 0); head.add(bill);
  const eyeM = new THREE.MeshStandardMaterial({ color: '#141414', roughness: .2 });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(Wd * .055, 8, 6), eyeM); e.position.set(Wd * .14, Wd * .08, s * Wd * (adult ? .24 : .33)); head.add(e); }
  // 翅膀（小鸭是绒毛小翅）
  const wingM = fuzzMat(adult ? '#e9e4da' : '#efc23a', sh);
  const wings = [];
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), wingM); w.scale.set(L * .3, Wd * .2, Wd * .16); w.position.set(-L * .06, torso.position.y + L * .06, s * Wd * .3); w.rotation.x = s * .2; body.add(w); wings.push(w); }
  // 脚蹼
  const footM = new THREE.MeshStandardMaterial({ color: '#f07e1a', roughness: .6 });
  const feet = [];
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), footM); f.scale.set(Wd * .3, .012, Wd * .2); f.position.set(L * .05, .01, s * Wd * .2); g.add(f); feet.push(f); }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return { g, body, head, wings, feet, L, Wd, adult };
}

export const HOPS_Y = CURB;
export function makeDucks(scene) {
  const D = [makeDuck(true), makeDuck(false), makeDuck(false), makeDuck(false), makeDuck(false)];
  D.forEach(d => scene.add(d.g));
  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const blobs = D.map(d => { const m = new THREE.Mesh(new THREE.PlaneGeometry(d.L * 1.3, d.Wd * 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); scene.add(m); return m; });

  // 姿态：x,z 位置、y 离地、yaw、步相、挤压（sy<1 压扁）、低头、跳
  function pose(i, P) {
    const d = D[i], g = d.g;
    g.visible = P.vis !== false; blobs[i].visible = g.visible;
    if (!g.visible) return;
    g.position.set(P.x, P.y, P.z); g.rotation.set(0, P.yaw ?? 0, 0);
    const ph = P.phase ?? 0, walk = P.walk ?? 0;
    // 摇摆步态：身体左右翻滚 + 上下颠
    d.body.rotation.x = Math.sin(ph) * .16 * walk;
    d.body.position.y = Math.abs(Math.sin(ph)) * d.L * .06 * walk;
    const sy = P.sy ?? 1; d.body.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    d.head.rotation.z = (P.nod ?? 0) + Math.sin(ph * 2) * .06 * walk;
    d.head.rotation.y = P.look ?? 0;
    d.wings.forEach((w, k) => { w.rotation.x = (k ? 1 : -1) * (.25 + (P.flap ?? 0) * 1.1); });
    d.feet.forEach((f, k) => { const s = k ? 1 : -1; f.position.x = d.L * .05 + Math.sin(ph + (k ? Math.PI : 0)) * d.L * .12 * walk; f.position.y = .01 + Math.max(0, Math.sin(ph + (k ? Math.PI : 0))) * .02 * walk - (P.air ?? 0) * 0; });
    blobs[i].position.set(P.x, (P.groundY ?? P.y) + .012, P.z); blobs[i].rotation.y = P.yaw ?? 0;
    const hgt = P.y - (P.groundY ?? P.y); blobs[i].material.opacity = clamp(1 - hgt * 3, .3, 1);
  }
  return { D, pose };
}

// —— 编排 ——（t = 成片秒数；clock = 城市时钟，用于延时段的过街位置）
// 过街：沿 z≈ZEBRA_Z，从西侧路沿 x=-13 走到东侧路沿 x=11.6，然后跳上 CURB 高的人行道
export function duckState(i, t, clock, clockAt, HOPS) {
  const CURB_X = 11.62, V = .8;
  const zOff = [0, .35, -.3, .25, -.2][i];
  const z = ZEBRA_Z + zOff;
  const hopT = i === 4 ? HOPS[5] : HOPS[i];                         // 最后一只：第二次成功
  const arriveT = (i === 4 ? HOPS[4] : hopT) - .28;                  // 到路沿（预备开始）
  const cArr = clockAt(arriveT);
  const P = { x: 0, y: 0, z, yaw: 0, walk: 0, phase: 0, sy: 1, groundY: 0 };
  const walkPhase = c => c * (i ? 16 : 10);
  if (t < arriveT) {
    // 过街：位置由城市时钟决定（延时段里是快进的，真实段里是真实速度）
    const x = CURB_X - V * (cArr - clock);
    if (x < -13) { P.x = -13.4 - i * .45; P.y = CURB; P.groundY = CURB; P.z = z + (i ? Math.sin(i * 2.1) * .3 : 0); P.nod = Math.sin(clock * .7 + i) * .15; P.look = Math.sin(clock * .5 + i * 1.3) * .5; return P; }   // 西侧人行道上等
    P.x = x; P.walk = 1; P.phase = walkPhase(clock); return P;
  }
  // 跳路沿
  const hop = (t0, fail) => {
    const u = t - t0;   // t0 = 起跳时刻
    if (u < -.28) return null;
    if (u < 0) { const k = seg(u, -.28, 0); P.x = CURB_X - .02; P.sy = 1 - .28 * Math.sin(k * Math.PI * .5); P.nod = .25 * k; P.flap = k * .3; return true; }    // 预备：下蹲
    const air = fail ? .22 : .3;
    if (u < air) {
      const k = u / air;
      if (fail) {   // 撞上路沿边、弹回
        P.x = CURB_X - .02 + Math.sin(k * Math.PI) * .06 - k * .25; P.y = Math.sin(k * Math.PI) * .13; P.sy = 1.15 - .1 * k; P.flap = 1; P.nod = -.3; return true;
      }
      P.x = lerp(CURB_X - .02, CURB_X + .28, k); P.y = Math.sin(k * Math.PI) * .2 + CURB * ss(k); P.sy = 1.22 - .2 * k; P.flap = Math.sin(k * Math.PI); P.nod = -.25; P.groundY = k > .5 ? CURB : 0; return true;
    }
    return false;
  };
  if (i === 4 && t < HOPS[5] - .28) {
    const r = hop(HOPS[4], true);
    if (r) return P;
    // 摔坐回路面 → 甩头 → 退半步 → 再来
    const u = t - (HOPS[4] + .22);
    P.x = CURB_X - .27 + Math.min(u, .5) * .1;
    if (u < .14) { P.sy = 1 - .3 * Math.sin(u / .14 * Math.PI); }
    else if (u < .9) { P.look = Math.sin(u * 22) * .45 * (1 - (u - .14) / .76); P.nod = .1; }
    else { P.walk = 1; P.phase = t * 16; P.x = lerp(CURB_X - .22, CURB_X - .02, seg(t, HOPS[4] + 1.1, HOPS[5] - .3)); }
    return P;
  }
  const r = hop(hopT, false);
  if (r) return P;
  // 落地回弹 → 在人行道上往公园走（真实段慢慢走，快进段快速走到池塘）
  const u = t - (hopT + .3);
  P.y = CURB; P.groundY = CURB;
  if (u < .25) { P.x = CURB_X + .28; P.sy = 1 - .25 * Math.sin(u / .25 * Math.PI) ; return P; }
  const cLand = clockAt(hopT + .55), dist = Math.max(0, (clock - cLand)) * .7;
  // 路线：人行道 → 公园小路 → 池塘边 → 水里
  const path = [[CURB_X + .28, z], [15.5, z], [22, ZEBRA_Z + 1 + zOff], [POND.x - POND.rx + 1.5, POND.z - 2 + zOff * 2], [POND.x - POND.rx + 6, POND.z + zOff * 3]];
  let rem = dist, k = 0;
  while (k < path.length - 1) { const l = Math.hypot(path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]); if (rem <= l) break; rem -= l; k++; }
  if (k >= path.length - 1) { const e = path[path.length - 1]; P.x = e[0] + Math.sin(clock * .05 + i) * 2; P.z = e[1] + Math.cos(clock * .04 + i) * 1.5; P.y = CURB - .12; P.groundY = CURB - .12; P.swim = 1; return P; }
  const a = path[k], b = path[k + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, uu = rem / l;
  P.x = lerp(a[0], b[0], uu); P.z = lerp(a[1], b[1], uu); P.yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]); P.walk = 1; P.phase = walkPhase(clock);
  return P;
}
