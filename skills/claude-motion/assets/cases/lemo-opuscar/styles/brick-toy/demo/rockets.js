// 火箭：一号（细高塔，逐块抛上去）→ 倒塌（预计算物理）→ 用散落的砖重建二号（带尾翼、驾驶舱、大锥头）→ 点火升空
import * as THREE from 'three';
import { COL, BRICK, PLATE, brick, mesh, coneGeo, slopeGeo, roundGeo, plastic } from './bricks.js';
import { T, q, BEAT } from './story.js';
import { PAD, PAD_TOP, TOP, MOON, groundY } from './set.js';
import { clamp, seg, eo, eio, ss, mulberry, hash } from '/core/lib.js';

const V1C = ['red', 'white', 'white', 'red', 'white', 'white', 'white', 'red', 'white', 'white', 'red', 'white'];
const V2L = ['white', 'white', 'red', 'white', 'white', 'red'];
export const V2H = V2L.length * BRICK;      // 二号火箭主体高 7.2
const G = 420;                              // 玩具尺度的重力（略慢，便于看清）
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

export function makeRockets(scene) {
  const R = mulberry(23);
  // —— 一号火箭的砖 ——
  const v1 = V1C.map((c, i) => {
    const m = brick(2, 4, COL[c]); scene.add(m);
    return { m, c, i, slot: new THREE.Vector3(PAD.x, PAD_TOP + i * BRICK, PAD.z), land: T.layer(i) };
  });
  const cone1 = mesh(coneGeo(1, 1.6), COL.red); scene.add(cone1);
  const cone1Slot = new THREE.Vector3(PAD.x, PAD_TOP + 12 * BRICK, PAD.z);

  // —— 倒塌模拟：先整体绕 +x 底边倾倒，θ>0.38 后散开成独立刚体 ——
  const SIM_DT = 1 / 240, SIM_T = 4.0, SAMPLE = 24;
  const bodies = [...v1.map(b => ({ m: b.m, h: BRICK, half: new THREE.Vector3(1, .6, 2) })), { m: cone1, h: 1.6, half: new THREE.Vector3(1, .8, 1) }];
  const pivot = new THREE.Vector3(PAD.x + 1, PAD_TOP, PAD.z);
  const initPos = [...v1.map(b => b.slot.clone().add(new THREE.Vector3(0, BRICK / 2, 0))), cone1Slot.clone().add(new THREE.Vector3(0, .8, 0))];   // 质心
  let th = 0.07, om = 0; const Hc = 13 * BRICK / 2;
  const tipFrames = [];
  while (th < .38) { const a = (G / (Hc * 1.6)) * Math.sin(th); om += a * SIM_DT; th += om * SIM_DT; tipFrames.push(th); }
  const tipDur = tipFrames.length * SIM_DT;
  const rigid = (p0, ang) => { const r = p0.clone().sub(pivot); r.applyAxisAngle(new THREE.Vector3(0, 0, 1), -ang); return r.add(pivot); };
  const st = bodies.map((b, k) => {
    const p = rigid(initPos[k], th), r = initPos[k].clone().sub(pivot);
    const vel = new THREE.Vector3(0, 0, -om).cross(r.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -th));   // ω × r
    vel.x += (R() - .3) * 6; vel.z += (R() - .5) * 9; vel.y += R() * 3;
    return { p, v: vel, q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -th), w: new THREE.Vector3((R() - .5) * 6, (R() - .5) * 8, -om + (R() - .5) * 4), rest: false, half: b.half };
  });
  const samples = [];   // samples[f][k] = [x,y,z,qx,qy,qz,qw]
  const corners = [-1, 1].flatMap(a => [-1, 1].flatMap(b => [-1, 1].map(c => new THREE.Vector3(a, b, c))));
  for (let f = 0, n = Math.round(SIM_T / SIM_DT); f <= n; f++) {
    const tt = f * SIM_DT;
    if (f % (240 / SAMPLE) === 0) samples.push(st.map(s => [s.p.x, s.p.y, s.p.z, s.q.x, s.q.y, s.q.z, s.q.w]));
    for (const s of st) {
      if (s.rest) continue;
      s.v.y -= G * SIM_DT; s.p.addScaledVector(s.v, SIM_DT);
      const wl = s.w.length(); if (wl > 1e-5) { _q.setFromAxisAngle(_v.copy(s.w).divideScalar(wl), wl * SIM_DT); s.q.premultiply(_q); }
      // 地面碰撞：最低角点
      let low = Infinity, lowC = null;
      for (const c of corners) { _v.set(c.x * s.half.x, c.y * s.half.y, c.z * s.half.z).applyQuaternion(s.q).add(s.p); if (_v.y < low) { low = _v.y; lowC = _v.clone(); } }
      const gy = groundY(lowC.x, lowC.z);
      if (low < gy) {
        s.p.y += gy - low;
        if (s.v.y < 0) s.v.y *= -.28;
        s.v.x *= .72; s.v.z *= .72; s.w.multiplyScalar(.6);
        // 趋向平躺：把局部 y 轴往最接近的世界轴拉
        const up = _v.set(0, 1, 0).applyQuaternion(s.q);
        const ax = [new THREE.Vector3(0, Math.sign(up.y) || 1, 0), new THREE.Vector3(Math.sign(up.x) || 1, 0, 0), new THREE.Vector3(0, 0, Math.sign(up.z) || 1)];
        const best = ax.reduce((a, b) => (Math.abs(up.dot(b)) > Math.abs(up.dot(a)) ? b : a));
        _q.setFromUnitVectors(up.clone(), best); s.q.premultiply(new THREE.Quaternion().slerp(_q, .06));
        if (s.v.length() < 2.5 && wl < 1.5 && tt > .6) {
          s.rest = true; s.v.set(0, 0, 0); s.w.set(0, 0, 0);
          _q.setFromUnitVectors(_v.set(0, 1, 0).applyQuaternion(s.q).clone(), best); s.q.premultiply(_q);
          let lo = Infinity; for (const c of corners) { _v.set(c.x * s.half.x, c.y * s.half.y, c.z * s.half.z).applyQuaternion(s.q).add(s.p); lo = Math.min(lo, _v.y); }
          s.p.y += groundY(s.p.x, s.p.z) - lo;
        }
      }
    }
    // 砖与砖在水平面上互相推开（避免躺成一叠）
    for (let a = 0; a < st.length; a++) for (let b = a + 1; b < st.length; b++) {
      const A = st[a], B = st[b], dx = B.p.x - A.p.x, dz = B.p.z - A.p.z, dy = Math.abs(B.p.y - A.p.y), d = Math.hypot(dx, dz);
      if (dy < 1.4 && d < 2.6 && d > 1e-4 && (!A.rest || !B.rest)) {
        const push = (2.6 - d) * .5, nx = dx / d, nz = dz / d;
        if (!A.rest) { A.p.x -= nx * push; A.p.z -= nz * push; }
        if (!B.rest) { B.p.x += nx * push; B.p.z += nz * push; }
      }
    }
  }
  const restPose = k => { const s = samples[samples.length - 1][k]; return { p: new THREE.Vector3(s[0], s[1], s[2]), q: new THREE.Quaternion(s[3], s[4], s[5], s[6]) }; };
  // 质心 → 砖原点（底面中心）
  const toOrigin = (p, qq, h) => p.clone().sub(new THREE.Vector3(0, h / 2, 0).applyQuaternion(qq));

  // —— 二号火箭：两块 2×4 拼一层 4×4；红砖去第 3、6 层 ——
  const slots2 = []; V2L.forEach((c, j) => [-1, 1].forEach(s => slots2.push({ c, p: new THREE.Vector3(PAD.x + s, PAD_TOP + j * BRICK, PAD.z) })));
  const pool = { red: v1.filter(b => b.c === 'red'), white: v1.filter(b => b.c === 'white') };
  slots2.forEach((s, k) => { const b = pool[s.c].shift(); b.slot2 = s.p; b.fly2 = T.rebuild + k * T.rebuildStep; });

  // 尾翼、驾驶舱（在零件堆里）、大锥头
  const rocket2 = new THREE.Group(); scene.add(rocket2);   // 升空后所有部件的父级（局部原点 = 发射台中心）
  const fins = [[2, 0, 0], [-2, 0, Math.PI], [0, 2, -Math.PI / 2], [0, -2, Math.PI / 2]].map(([dx, dz, ry], i) => {
    const m = mesh(slopeGeo(2.2, BRICK * 2.4, 1), COL.red); scene.add(m);
    return { m, slot: new THREE.Vector3(PAD.x + dx, PAD_TOP, PAD.z + dz), ry, fly: T.rebuild + 1.4 + i * .15, from: new THREE.Vector3(-9 + i * 1.6, TOP, 9.5 - i * .4), fromRy: R() * 3 };
  });
  const cockpit = new THREE.Group(); scene.add(cockpit);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(.95, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#cfeaff', transmission: 1, thickness: .1, roughness: .02, ior: 1.3, envMapIntensity: .5 })); dome.rotation.x = Math.PI / 2; cockpit.add(dome);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.98, .12, 12, 40), plastic(COL.lgray)); cockpit.add(ring);
  const pilot = new THREE.Group(); pilot.position.z = .15; cockpit.add(pilot);   // 驾驶舱里的迷你宇航员脸
  const ph = new THREE.Mesh(new THREE.SphereGeometry(.62, 24, 16), plastic(COL.white)); pilot.add(ph);
  const pv = new THREE.Mesh(new THREE.SphereGeometry(.5, 24, 16, Math.PI * .15, Math.PI * .7, Math.PI * .28, Math.PI * .42), new THREE.MeshPhysicalMaterial({ color: '#0f2036', roughness: .05, clearcoat: 1 })); pv.scale.setScalar(1.25); pilot.add(pv);
  const pe = [-.2, .2].map(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 8), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#e8f6ff', emissiveIntensity: 1.6 })); e.position.set(x, .05, .66); pilot.add(e); return e; });
  cockpit.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const cockpitSlot = new THREE.Vector3(PAD.x, PAD_TOP + 3.5 * BRICK, PAD.z + 2.02), cockpitFrom = new THREE.Vector3(-7.5, TOP + .5, 11);
  const cone2 = mesh(coneGeo(2, 3), COL.red); scene.add(cone2);
  const cone2Slot = new THREE.Vector3(PAD.x, PAD_TOP + V2H, PAD.z), cone2Pile = new THREE.Vector3(-5.5, TOP, 8.5);

  // 零件堆里的笑料道具：轮子、小花
  const wheel = new THREE.Group(); { const tire = new THREE.Mesh(new THREE.TorusGeometry(.9, .45, 16, 32), plastic(COL.black)); const hub = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .9, 24), plastic(COL.lgray)); hub.rotation.x = Math.PI / 2; wheel.add(tire, hub); wheel.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(wheel); }
  const flower = new THREE.Group(); { const stem = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 2, 8), plastic(COL.green)); stem.position.y = 1; flower.add(stem); for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .2, 16), plastic(COL.yellow)); const a = i / 5 * Math.PI * 2; p.position.set(Math.cos(a) * .45, 2.1, Math.sin(a) * .45); flower.add(p); } const c = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .3, 16), plastic(COL.red)); c.position.y = 2.15; flower.add(c); flower.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(flower); }

  // —— 火焰（透明橙/黄圆片）与烟（白色圆砖）——
  const flameMats = ['#ff6a00', '#ff9d00', '#ffd000', '#fff2b0'].map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 3.2, transparent: true, opacity: .9, roughness: .2, toneMapped: true }));
  const flames = [...Array(48)].map((_, i) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(i % 3 ? .5 : .32, i % 3 ? .5 : .32, .4, 24), flameMats[0]); m.visible = false; scene.add(m); return { m, a: hash(i * 3.1) * Math.PI * 2, s: hash(i * 7.7), h: hash(i * 1.9) }; });
  const flameLight = new THREE.PointLight('#ff8a3a', 0, 60, 2); scene.add(flameLight);
  const smoke = [...Array(46)].map((_, i) => { const big = hash(i * 5.3) < .55; const m = mesh(roundGeo(big ? 1 : .5, big ? BRICK : BRICK * .66), COL.white); m.visible = false; scene.add(m); return { m, a: hash(i * 2.7) * Math.PI * 2, t0: T.ignite - .5 + hash(i * 9.1) * 4.5, sp: 6 + hash(i * 4.4) * 10, big }; });

  // 火箭整体变换（升空后）
  function rocketXform(t, set) {
    if (t < T.lift) return { off: new THREE.Vector3(), ry: 0, thrust: t >= T.flicker ? seg(t, T.flicker, T.ignite) * .5 + seg(t, T.ignite, T.lift) * .5 : 0 };
    if (t < 40.0) { const u = t - T.lift; return { off: new THREE.Vector3(Math.sin(u * 3) * .05, 2.2 * u * u + .6 * u, 0), ry: u * .05, thrust: 1 }; }
    if (t < 42.5) {   // 巡航：朝书堆方向飞
      const u = (t - 40.0) / 2.5, d = new THREE.Vector3(MOON.x - PAD.x, 0, MOON.z - PAD.z).normalize();
      return { off: d.multiplyScalar(34 * u * (.6 + .4 * u)).add(new THREE.Vector3(0, 21.6 + 13.2 * u - 3 * u * u, 0)), ry: .15 + u * .5, thrust: 1 };
    }
    const u = eo(seg(t, 42.5, T.land));
    const moonOff = new THREE.Vector3(MOON.x - PAD.x, set.MOON_TOP - PAD_TOP, MOON.z - PAD.z);
    return { off: moonOff.add(new THREE.Vector3(0, (1 - u) * 26, 0)), ry: Math.PI * .85, thrust: t < T.land ? .45 : Math.max(0, .45 - (t - T.land) * 1.5) };
  }
  const place2 = (obj, localSlot, x, ry = 0) => {   // localSlot 为世界坐标（发射台时）→ 按火箭变换
    const l = localSlot.clone().sub(new THREE.Vector3(PAD.x, 0, PAD.z)).applyAxisAngle(UP, x.ry);
    obj.position.set(PAD.x, 0, PAD.z).add(l).add(x.off); obj.rotation.set(0, ry + x.ry, 0);
  };
  const arc = (a, b, u, lift) => a.clone().lerp(b, u).add(new THREE.Vector3(0, Math.sin(Math.PI * u) * lift, 0));
  const snapY = u => u >= 1 ? 0 : 0;   // 落定用 back 缓动在 flight 内完成

  function update(t0, ctx) {
    const t = q(t0), set = ctx.set;
    const X = rocketXform(t0, set);   // 火箭飞行平滑（24fps），积木与角色仍按 12fps 步进
    const hand = ctx.handPos, handsUp = ctx.handsUpPos;
    // 一号火箭 + 倒塌 + 重建
    v1.forEach((b, k) => {
      const m = b.m; m.visible = true;
      if (t >= (b.fly2 ?? Infinity)) {   // 重建：从静止处飞回二号槽位
        const u = clamp((t - b.fly2) / .45), rp = restPose(k);
        if (u < 1) {
          const from = toOrigin(rp.p, rp.q, BRICK);
          m.position.copy(arc(from, b.slot2, eio(u), 5 + b.slot2.y * .3));
          m.quaternion.copy(rp.q).slerp(new THREE.Quaternion(), eio(u)); m.rotateY(Math.sin(u * Math.PI) * 1.4);
        } else place2(m, b.slot2, X);
        return;
      }
      if (t >= T.fall) {   // 倒塌中/已散落
        const lt = t - T.fall;
        if (lt < tipDur) { const ang = tipFrames[Math.min(tipFrames.length - 1, Math.floor(lt / SIM_DT))]; const c = rigid(initPos[k], ang); m.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -ang); m.position.copy(toOrigin(c, m.quaternion, BRICK)); }
        else { const f = Math.min(samples.length - 1, Math.round((lt - tipDur) * SAMPLE)), s = samples[f][k]; m.quaternion.set(s[3], s[4], s[5], s[6]); m.position.copy(toOrigin(new THREE.Vector3(s[0], s[1], s[2]), m.quaternion, BRICK)); }
        return;
      }
      m.quaternion.identity();
      const land = b.land;
      if (k === 0) {   // 第一块：宇航员端着走来，放下
        if (t < 3.9) { m.position.copy(ctx.carryPos); m.rotation.y = ctx.carryRy; }
        else { const u = seg(t, 3.9, 4.0); m.position.copy(ctx.carryPos.clone().lerp(b.slot, u * u)); }
        if (t < 3.4) { m.position.set(24, 0, 6); m.rotation.y = .35; }   // 开场特写：躺在桌上
        if (t >= 4.0) m.position.copy(b.slot);
      } else if (t < land - BEAT * 2) m.visible = false;
      else if (t < land - .5) { m.position.copy(handsUp); m.rotation.y = ctx.astroRy; }
      else if (t < land) { const u = (t - (land - .5)) / .5; m.position.copy(arc(handsUp, b.slot.clone().add(new THREE.Vector3(0, .35, 0)), u, 3.5)); m.rotation.set(Math.sin(u * 5) * .3, ctx.astroRy * (1 - u) + u * Math.PI * 2, 0); }
      else { const u = seg(t, land, land + .17); m.position.copy(b.slot).add(new THREE.Vector3(0, (1 - u) * .35 * (u < .5 ? 1 : .3), 0)); m.rotation.set(0, 0, 0); }
      if (t >= T.wobble) {   // 摇晃：绕 +x 底边小角度摆动
        const w = t - T.wobble, ang = .025 * Math.sin(w * 2 * Math.PI * 2.1) * (w / 1.67) + .01 * w;
        const c = rigid(b.slot.clone().add(new THREE.Vector3(0, BRICK / 2, 0)), ang); m.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -ang); m.position.copy(toOrigin(c, m.quaternion, BRICK));
      }
    });
    // 小锥顶
    {
      const land = T.cone1, k = v1.length;
      if (t >= T.fall) {
        const lt = t - T.fall;
        if (lt < tipDur) { const ang = tipFrames[Math.min(tipFrames.length - 1, Math.floor(lt / SIM_DT))]; const c = rigid(initPos[k], ang); cone1.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -ang); cone1.position.copy(toOrigin(c, cone1.quaternion, 1.6)); }
        else { const f = Math.min(samples.length - 1, Math.round((lt - tipDur) * SAMPLE)), s = samples[f][k]; cone1.quaternion.set(s[3], s[4], s[5], s[6]); cone1.position.copy(toOrigin(new THREE.Vector3(s[0], s[1], s[2]), cone1.quaternion, 1.6)); }
        cone1.visible = true;
      } else if (t < land - BEAT * 2) cone1.visible = false;
      else {
        cone1.visible = true; cone1.quaternion.identity();
        if (t < land - .5) cone1.position.copy(handsUp);
        else if (t < land) { const u = (t - (land - .5)) / .5; cone1.position.copy(arc(handsUp, cone1Slot, u, 3.5)); cone1.rotation.set(0, u * 6, 0); }
        else cone1.position.copy(cone1Slot);
        if (t >= T.wobble) { const w = t - T.wobble, ang = .025 * Math.sin(w * 2 * Math.PI * 2.1) * (w / 1.67) + .01 * w; const c = rigid(initPos[k], ang); cone1.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -ang); cone1.position.copy(toOrigin(c, cone1.quaternion, 1.6)); }
      }
    }
    // 尾翼
    fins.forEach(f => {
      const u = clamp((t - f.fly) / .4);
      if (t < f.fly) { f.m.position.copy(f.from); f.m.rotation.set(0, f.fromRy, 0); }
      else if (u < 1) { f.m.position.copy(arc(f.from, f.slot, eio(u), 5)); f.m.rotation.set(0, f.fromRy + (f.ry - f.fromRy) * eio(u), 0); }
      else place2(f.m, f.slot, X, f.ry);
    });
    // 驾驶舱
    {
      const fly = T.rebuild + 6.5 * T.rebuildStep, u = clamp((t - fly) / .4);
      if (t < fly) { cockpit.position.copy(cockpitFrom); cockpit.rotation.set(-Math.PI / 2, 0, 0); }
      else if (u < 1) { cockpit.position.copy(arc(cockpitFrom, cockpitSlot, eio(u), 5)); cockpit.rotation.set(-Math.PI / 2 * (1 - eio(u)), 0, 0); }
      else place2(cockpit, cockpitSlot, X);
      pilot.visible = t >= T.coneLand && t < T.land + .5;
      pe.forEach(e => e.scale.y = (Math.floor(t * 12) % 40 === 0) ? .2 : 1);
    }
    // 大锥头：零件堆 → 宇航员手里 → 抛到顶上
    {
      const throwT = T.coneLand - .5;
      if (t < T.found) { cone2.position.copy(cone2Pile); cone2.rotation.set(0, 0, 1.2); }
      else if (t < throwT) { cone2.position.copy(handsUp); cone2.rotation.set(0, 0, 0); }
      else if (t < T.coneLand) { const u = (t - throwT) / .5; cone2.position.copy(arc(handsUp, cone2Slot.clone().add(new THREE.Vector3(0, .4, 0)), u, 6)); cone2.rotation.set(0, u * 6.3, 0); }
      else place2(cone2, cone2Slot, X);
    }
    // 笑料道具：从手里往身后抛
    const tossArc = (obj, t0, rest0, restRot, land) => {
      if (t < t0) { obj.position.copy(rest0); obj.rotation.copy(restRot); return; }
      const u = clamp((t - t0) / .6);
      obj.position.copy(arc(hand, land, u, 4)); obj.rotation.set(u * 9, u * 3, 0);
      if (u >= 1) { obj.position.copy(land); obj.rotation.set(Math.PI / 2, 0, 0); }
    };
    const back = ctx.behind;
    tossArc(wheel, T.toss[0], new THREE.Vector3(-3.5, TOP + .9, 9.8), new THREE.Euler(Math.PI / 2, 0, 0), back(1));
    tossArc(flower, T.toss[1], new THREE.Vector3(-2.5, TOP, 8.2), new THREE.Euler(Math.PI / 2, 0, .4), back(-1));
    if (t >= T.toss[1] + .6) { flower.position.y = TOP + .35; flower.rotation.set(0, 0, Math.PI / 2); }
    if (t >= T.toss[0] + .6) { wheel.position.y = TOP + .45; }

    // 火焰 + 烟
    const nozzle = new THREE.Vector3(PAD.x, PAD_TOP - .2, PAD.z).add(X.off), fr = Math.floor(t0 * 24);
    const thr = X.thrust;
    flames.forEach((f, i) => {
      const on = thr > .02; f.m.visible = on; if (!on) return;
      const h = (f.h * .8 + hash(fr * 13 + i) * .5) * 5.5 * thr, r = (1.8 - h / 4.2) * (.4 + .6 * f.s) * Math.min(1, thr * 2), a = f.a + hash(fr + i * 3) * .8;
      f.m.position.set(nozzle.x + Math.cos(a) * r, nozzle.y - h, nozzle.z + Math.sin(a) * r);
      f.m.material = flameMats[Math.max(0, Math.min(3, Math.floor((1 - h / (5.5 * thr + .01)) * 3.2 + hash(fr * 7 + i) * .8)))];
      const sc = .7 + hash(fr * 5 + i) * .6; f.m.scale.set(sc, 1, sc);
    });
    flameLight.position.copy(nozzle).add(new THREE.Vector3(0, -2, 0)); flameLight.intensity = thr * (600 + hash(fr) * 300);
    smoke.forEach(s => {
      const age = t0 - s.t0, onPad = t0 < 42.5;
      if (age < 0 || !onPad) { s.m.visible = false; return; }
      const d = s.sp * (1 - Math.exp(-age * 1.2)), grow = Math.min(1.6, .35 + age * .9);
      s.m.visible = true;
      s.m.position.set(PAD.x + Math.cos(s.a) * (2 + d), PAD_TOP + age * .5 * (s.big ? 1 : 1.6), PAD.z + Math.sin(s.a) * (2 + d) * .8);
      s.m.scale.setScalar(grow); s.m.rotation.y = s.a;
    });
    return { X };
  }
  return { update, v1, cone1, rocket2, cockpit, cone2, fins };
}
