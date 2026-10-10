// Rocket from Spare Parts — Brick Toy 风格 demo
import * as THREE from 'three';
import { makePost } from '/core/three/post.js';
import { clamp, seg, eio, eo, ss, lerp, hash } from '/core/lib.js';
import { COL, BRICK, PLATE, brick } from './bricks.js';
import { DUR, T, VO, shotAt, q, qc, BEAT, CREDITS } from './story.js';
import { buildSet, PAD, PAD_TOP, TOP, MOON } from './set.js';
import { makeAstro, walkPose } from './actors.js';
import { makeRockets } from './rockets.js';

const W = 1920, H = 1080;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(2); renderer.setSize(W, H);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, .5, 3000);
const post = makePost(renderer, scene, camera, W, H, { ssaa: 2, ao: true, aoRadius: 3.5, aoThickness: 3, aoAmt: .9 });
post.bloom.strength = .14; post.bloom.threshold = 1.3;
post.vig.uniforms.amt.value = .36; post.vig.uniforms.warm.value = -.35; post.vig.uniforms.contrast.value = .26; post.vig.uniforms.sat.value = 1.1;

const set = await buildSet(scene);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// —— 散落的备用零件（左后方与桌面，避开倒塌方向 +x）——
{
  let s = 7; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const PAL = [COL.red, COL.blue, COL.yellow, COL.green, COL.white, COL.orange, COL.lgray, COL.azure, COL.black, COL.tan];
  const spots = [[PAD.x, PAD.z, 6], [-4.5, 5.5, 2.2], [-58, -34, 14]];
  for (let i = 0, n = 0; i < 400 && n < 44; i++) {
    const onDesk = n > 18, x = onDesk ? -40 + R() * 70 : -14 + R() * 14, z = onDesk ? -8 + R() * 40 : -9 + R() * 20;
    if (!onDesk && Math.abs(x) > 15.5) continue; if (onDesk && Math.abs(x) < 17 && Math.abs(z) < 13) continue;
    if (spots.some(([a, b, r]) => Math.hypot(a - x, b - z) < r)) continue;
    if (x > 12 && z > -12) continue;
    spots.push([x, z, 2.6]); n++;
    const d = [[2, 4], [2, 2], [1, 2], [1, 4], [2, 3], [1, 1], [2, 6]][Math.floor(R() * 7)];
    const m = brick(d[0], d[1], PAL[Math.floor(R() * PAL.length)], { h: R() < .3 ? PLATE : BRICK });
    m.position.set(x, onDesk ? 0 : TOP, z); m.rotation.y = R() * Math.PI; scene.add(m);
    if (onDesk && R() < .25) { m.rotation.z = Math.PI / 2; m.position.y = d[0] / 2; }
  }
}

const astro = makeAstro(); scene.add(astro.root);
const rockets = makeRockets(scene);
const pickBrick = brick(2, 2, COL.red); scene.add(pickBrick);
// 开场特写那块砖的接触阴影（主光影子落在砖背后，镜头这侧需要一点 AO）
const aoTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const ao = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.6), new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false })); ao.rotation.set(-Math.PI / 2, 0, -.35); ao.position.set(24, .02, 6); scene.add(ao);
const moonBrick = brick(2, 2, COL.red); scene.add(moonBrick);

// —— 宇航员的表演 ——
const FWD = ry => V(Math.sin(ry), 0, Math.cos(ry));
const SP_PLACE = V(PAD.x - 4.3, TOP, PAD.z), RY_PLACE = Math.PI / 2;
const SP_THROW = V(PAD.x - 6.5, TOP, PAD.z + 3.5), RY_THROW = Math.atan2(PAD.x - SP_THROW.x, PAD.z - SP_THROW.z);
const SP_BACK = SP_THROW.clone().addScaledVector(FWD(RY_THROW), -2.4), SP_SIT = SP_BACK.clone().addScaledVector(FWD(RY_THROW), -1.6);
const SP_PILE = V(-4.5, TOP, 5.5), RY_PILE = 0, RY_TOPAD = Math.atan2(PAD.x - SP_PILE.x, PAD.z - SP_PILE.z);
const layerLand = [...Array(11)].map((_, i) => T.layer(i + 1)).concat([T.cone1]);

function walk(t, t0, t1, A, B, stride = 2.6) {
  const u = seg(t, t0, t1), p = A.clone().lerp(B, u), d = A.distanceTo(B) * u;
  return { p, moving: t > t0 && t < t1, phi: d / stride * Math.PI * 2 };
}
function astroAt(t) {
  const P = { x: 0, z: 0, y: TOP, ry: 0, blink: Math.floor(t * 12) % 37 === 0 };
  let vis = true, hold = 'over', mv = null;
  const put = (p, ry) => { P.x = p.x; P.y = p.y; P.z = p.z; P.ry = ry; };
  if (t < 3.4) vis = false;
  else if (t < T.firstClick) {   // 端着第一块砖走进来
    mv = walk(t, 3.4, 3.85, SP_PLACE.clone().add(V(-4.5, 0, 0)), SP_PLACE); put(mv.p, RY_PLACE);
    if (mv.moving) Object.assign(P, walkPose(mv.phi, .4));
    P.armL = P.armR = [-.95, .05]; hold = 'carry'; P.nod = .25;
  } else if (t < 5.4) {   // 放下 → 小跳庆祝 → 走去抛砖位
    if (t < 4.9) { put(SP_PLACE, RY_PLACE); const u = seg(t, 4.2, 4.7); P.y += Math.sin(u * Math.PI) * .9; P.armL = P.armR = [lerp(-.6, -2.9, ss(seg(t, 4.1, 4.4))), .15]; P.nod = -.2; }
    else { mv = walk(t, 4.9, 5.4, SP_PLACE, SP_THROW); put(mv.p, RY_THROW); Object.assign(P, walkPose(mv.phi)); }
  } else if (t < T.cone1 + .1) {   // 抛砖蒙太奇
    put(SP_THROW, RY_THROW);
    const L = layerLand.find(l => t < l + .1) ?? T.cone1, c0 = L - 2 * BEAT, u = clamp((t - c0) / (2 * BEAT));
    const a = u < .4 ? lerp(-2.3, -2.95, ss(u / .4)) : u < .5 ? lerp(-2.95, -3.35, (u - .4) / .1) : lerp(-3.35, -2.3, ss((u - .5) / .5));
    P.armL = P.armR = [a, .12]; P.nod = -.45 - .1 * Math.sin(u * Math.PI); P.bob = u > .4 && u < .55 ? .15 : 0;
  } else if (t < T.wobble) {   // 后退两步，得意
    mv = walk(t, 14.2, 15.0, SP_THROW, SP_BACK, 1.6); put(mv.p, RY_THROW);
    if (mv.moving) Object.assign(P, walkPose(-mv.phi, .35)); else { const v = ss(seg(t, 15.0, 15.25)); P.armL = P.armR = [-.15, .1 + v * 2.3]; P.nod = -.45; P.y += Math.sin(seg(t, 15.0, 15.3) * Math.PI) * .5; }
  } else if (t < T.fall) {   // 塔在晃：紧张
    put(SP_BACK, RY_THROW); const w = seg(t, T.wobble, T.fall); P.armL = P.armR = [-.2, .45 + w * .6]; P.nod = -.45; P.look = Math.sin(t * 14) * .08 * w;
  } else if (t < T.sit) {   // 倒塌：举手惊呼，跳开，然后垂头
    const u = seg(t, T.fall, T.fall + .4), p = SP_BACK.clone().lerp(SP_SIT, eo(u)); put(p, RY_THROW); P.y += Math.sin(u * Math.PI) * 1.1;
    const drop = ss(seg(t, 18.6, 20.2)); P.armL = P.armR = [lerp(-.5, -.25, drop), lerp(2.6, .1, drop)]; P.nod = lerp(-.3, .35, drop);
  } else if (t < 25.6) {   // 坐在废墟边
    put(SP_SIT, RY_THROW); P.sit = ss(seg(t, T.sit, T.sit + .45)); P.nod = .5 - ss(seg(t, 24.0, 24.6)) * .25; P.armL = P.armR = [-.45, .05]; P.tipGlow = .8;
    if (t > T.pickUp) { P.armR = [lerp(-.45, -1.2, ss(seg(t, T.pickUp, T.pickUp + .25))), .1]; P.look = -.25; P.nod = .3; }
  } else if (t < 26.4) {   // 站起来
    put(SP_SIT, RY_THROW); P.sit = 1 - ss(seg(t, 25.6, 26.1)); P.armR = [-1.2, .1]; P.armL = [-.3, .05]; P.nod = .1;
  } else if (t < 27.0) {   // 走向零件堆
    mv = walk(t, 26.4, 27.0, SP_SIT, SP_PILE); put(mv.p, lerp(RY_THROW, RY_PILE, ss(seg(t, 26.4, 26.7)))); Object.assign(P, walkPose(mv.phi)); P.armR = [-1.1, .1];
  } else if (t < T.found) {   // 翻找：扔轮子、扔小花
    put(SP_PILE, RY_PILE); P.lean = .32; const dig = Math.sin((t - 27) * 11);
    P.armL = [-.9 + dig * .35, .1]; P.armR = [-.9 - dig * .35, .1]; P.nod = .35;
    const fl = (tt, side) => { const u = seg(t, tt - .1, tt + .25); if (u > 0 && u < 1) { const a = lerp(-1.0, -3.5, Math.sin(u * Math.PI)); if (side) P.armR = [a, .2]; else P.armL = [a, .2]; P.lean = .1; } };
    fl(T.toss[0], 1); fl(T.toss[1], 0); hold = 'hand';
  } else if (t < T.coneLand) {   // 找到了！举起锥头 → 转向火箭 → 抛
    const turn = ss(seg(t, 29.8, 30.2)); put(SP_PILE, lerp(RY_PILE, RY_TOPAD, turn));
    P.y += Math.sin(seg(t, T.found + .1, T.found + .45) * Math.PI) * .8;
    const th = T.coneLand - .5, u = seg(t, th - .15, th + .2);
    P.armL = P.armR = [u > 0 ? lerp(-2.9, -3.4, Math.sin(u * Math.PI)) : -2.9, .12]; P.nod = -.25;
  } else if (t < T.walkOut) vis = false;   // 在火箭里
  else {   // 月球：走出来，放下一块砖，挥手
    const base = V(MOON.x, set.MOON_TOP, MOON.z), A = base.clone().add(V(2.5, 0, -4.5)), B = base.clone().add(V(5.2, 0, 2.2));
    mv = walk(t, T.walkOut, 46.0, A, B); put(mv.p, .75);
    if (mv.moving) Object.assign(P, walkPose(mv.phi));
    if (t < 46.8) { P.armL = P.armR = [-.95, .05]; hold = 'carry'; if (t >= 46.0) P.nod = .3; }
    else { const w = t - 46.8; P.armR = [-.2, 2.7 + Math.sin(w * 9) * .35]; P.armL = [0, .1]; P.nod = -.1; P.look = -.3; }
  }
  return { vis, P, hold };
}

const _a = V(0, 0, 0), _b = V(0, 0, 0);
function handsWorld() { astro.root.updateMatrixWorld(true); astro.arms[0].hand.getWorldPosition(_a); astro.arms[1].hand.getWorldPosition(_b); return _a.clone().add(_b).multiplyScalar(.5); }

// —— 镜头 ——
const cockpitW = V(PAD.x, PAD_TOP + 3.5 * BRICK, PAD.z + 2.02);
const moonC = () => V(MOON.x, set.MOON_TOP, MOON.z);
let ctxX = null;
function cam(t, st) {
  const [t0, t1, name] = st, u = seg(t, t0, t1);
  let pos, look, fov = 32, focus = null, aper = 800;
  const astroP = astro.root.position.clone().add(V(0, 5, 0));
  switch (name) {
    case 'macro': pos = V(16.5, 2.0, 17).lerp(V(18.6, 1.6, 14.2), eio(u)); look = V(24, .5, 6); fov = 30; focus = V(24, .6, 6); aper = 1100; break;
    case 'place': pos = V(PAD.x - 15, 16, PAD.z + 19); look = V(PAD.x - 3, 2.5, PAD.z); focus = V(PAD.x - 2.5, 2, PAD.z); aper = 700; break;
    case 'mA': pos = V(PAD.x + 5.5, 1.3, PAD.z + 11); look = V(PAD.x - 2, 5.5, PAD.z); fov = 44; focus = V(PAD.x - 1, 4, PAD.z + 1); aper = 600; break;
    case 'mB': pos = V(PAD.x - 4, 5.5, PAD.z + 23); look = V(PAD.x - 3, 6, PAD.z); fov = 34; focus = astroP; break;
    case 'mC': { const top = PAD_TOP + 7 * BRICK; pos = V(PAD.x + 9, top + .5, PAD.z + 17); look = V(PAD.x - 1.5, top + 1.2, PAD.z); fov = 34; focus = V(PAD.x, top, PAD.z + 1); aper = 600; break; }
    case 'mD': pos = V(PAD.x - 3, 27, PAD.z + 7); look = V(PAD.x - 3.5, 0, PAD.z + 1); fov = 40; focus = V(PAD.x - 4, 8, PAD.z + 2); aper = 900; break;
    case 'mE': pos = V(PAD.x - 17, 8, PAD.z + 18).lerp(V(PAD.x - 13, 9.5, PAD.z + 21), u); look = V(PAD.x - 2, 7, PAD.z); fov = 34; focus = V(PAD.x - 2, 6, PAD.z); break;
    case 'proud': pos = V(PAD.x - 7, 1.6, PAD.z + 23); look = V(PAD.x - 2.5, 9, PAD.z); fov = 46; focus = astroP; aper = 650; break;
    case 'collapse': {
      pos = V(PAD.x + 1, 6.5, PAD.z + 27); look = V(PAD.x + 3, 5.5, PAD.z); fov = 40; focus = V(PAD.x + 3, 3, PAD.z);
      const sh = seg(t, T.fall, T.fall + .2) * (1 - seg(t, T.fall + .4, 19.2)), fr = Math.floor(t * 24);
      pos.add(V(hash(fr) - .5, hash(fr + 99) - .5, 0).multiplyScalar(sh * .9)); break;
    }
    case 'alone': { const f = FWD(RY_THROW), sd = V(f.z, 0, -f.x); pos = SP_SIT.clone().addScaledVector(f, 13).addScaledVector(sd, 6).add(V(0, 1.4, 0)).lerp(SP_SIT.clone().addScaledVector(f, 11).addScaledVector(sd, 5).add(V(0, 1.5, 0)), u); look = SP_SIT.clone().add(V(0, 3.4, 0)); fov = 34; focus = SP_SIT.clone().add(V(0, 2.5, 0)); aper = 650; break; }
    case 'pickup': { const f = FWD(RY_THROW), sd = V(f.z, 0, -f.x); pos = SP_SIT.clone().addScaledVector(f, 10.5).addScaledVector(sd, -3.5).add(V(0, 3.6, 0)); look = SP_SIT.clone().addScaledVector(f, 1).addScaledVector(sd, -.8).add(V(0, 2.2, 0)); fov = 30; focus = SP_SIT.clone().addScaledVector(f, 1).add(V(0, 2.5, 0)); aper = 550; break; }
    case 'rummage': pos = SP_PILE.clone().add(V(7, 7, 16)); look = SP_PILE.clone().add(V(0, 4, 1.5)); fov = 34; focus = SP_PILE.clone().add(V(0, 3.5, 1)); aper = 650; break;
    case 'rebuild': pos = V(PAD.x - 5, 12, PAD.z + 29); look = V(PAD.x - 3, 3.5, PAD.z + 2); fov = 40; focus = V(PAD.x - 2, 3, PAD.z + 1); aper = 900; break;
    case 'visor': pos = cockpitW.clone().add(V(1.4, .5, 6.2)).lerp(cockpitW.clone().add(V(1.1, .4, 5.2)), u); look = cockpitW; fov = 24; focus = cockpitW.clone().add(V(0, 0, .6)); aper = 500; break;
    case 'fins': pos = V(PAD.x + 5.5, .9, PAD.z + 7.5); look = V(PAD.x + .5, 1.6, PAD.z); focus = V(PAD.x + 2, 1.5, PAD.z + 2); break;
    case 'pad': pos = V(PAD.x - 15, 4, PAD.z + 23); look = V(PAD.x, 5, PAD.z); fov = 34; focus = V(PAD.x, 5, PAD.z); break;
    case 'liftoff': {
      const oy = ctxX ? ctxX.off.y : 0;
      pos = V(PAD.x - 12, 2 + oy * .1, PAD.z + 26); look = V(PAD.x, 5 + oy * .78, PAD.z); fov = 38; focus = V(PAD.x, 5 + oy, PAD.z); aper = 900; break;
    }
    case 'cruise': {   // 跟拍：摄影机贴着火箭侧面飞
      const d = V(MOON.x - PAD.x, 0, MOON.z - PAD.z).normalize(), perp = V(d.z, 0, -d.x), rc = V(PAD.x, PAD_TOP + 4, PAD.z).add(ctxX.off);
      pos = rc.clone().addScaledVector(perp, 11).addScaledVector(d, -17).add(V(0, 6, 0)); look = rc.clone().addScaledVector(d, 8).add(V(0, -1.2, 0)); fov = 40; focus = rc; aper = 450; break;
    }
    case 'moon': { const c = moonC(); pos = c.clone().add(V(15, 5, 19)); look = c.clone().add(V(0, 3.5, 0)); fov = 36; focus = c.clone().add(V(2, 3, 0)); break; }
    default: {   // reveal / endcard
      const c = moonC(), w = name === 'endcard' ? 1 : eio(u);
      pos = c.clone().add(V(20, 9, 26)).lerp(V(38, 78, 100), w); look = c.clone().add(V(2, 4, 2)).lerp(V(-20, 4, -18), w); fov = 38;
      focus = look.clone(); aper = lerp(1100, 380, w);
    }
  }
  camera.position.copy(pos); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(look);
  // 阴影视锥按镜头收紧（越紧越锐利）
  const k = set.key, fc = focus || look, span = name === 'reveal' || name === 'endcard' ? 95 : name === 'cruise' || name === 'liftoff' ? 60 : 32;
  k.target.position.copy(fc); k.position.copy(fc).add(V(-60, 110, 50)); k.target.updateMatrixWorld();
  Object.assign(k.shadow.camera, { left: -span, right: span, top: span, bottom: -span }); k.shadow.camera.updateProjectionMatrix();
  post.dof.focus = focus ? camera.position.distanceTo(focus) : 40; post.dof.aper = aper; post.dof.maxCoc = 16;
}

// —— 2D 层：字幕、片名、片尾 ——
const ov = document.getElementById('ov'), g = ov.getContext('2d');
let DURS = {};
try { const r = await fetch('voices/dur.json'); if (r.ok) DURS = await r.json(); } catch (e) { }
const voDur = v => DURS[v.id] ?? v.text.length * .07;
function brickIcon(x, y, s = 1, col = '#f2cd37') {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = col; g.beginPath(); g.roundRect(0, 8, 58, 26, 5); g.fill();
  g.beginPath(); g.roundRect(7, 0, 18, 10, 3); g.roundRect(33, 0, 18, 10, 3); g.fill(); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 28, 58, 6); g.restore();
}
function pill(text, y, tag) {
  g.font = '600 46px Fredoka'; const tw = g.measureText(text).width, pw = tw + 150, ph = 84, x = (W - pw) / 2;
  g.fillStyle = 'rgba(18,20,26,.62)'; g.beginPath(); g.roundRect(x, y, pw, ph, 42); g.fill();
  if (tag) {
    g.font = '700 22px Fredoka'; const w2 = g.measureText(tag).width + 44; g.fillStyle = 'rgba(18,20,26,.8)'; g.beginPath(); g.roundRect(x + 40, y - 34, w2, 36, 18); g.fill();
    g.fillStyle = '#ff4b3e'; g.beginPath(); g.arc(x + 60, y - 16, 6, 0, 7); g.fill(); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(tag, x + 74, y - 15);
    g.font = '600 46px Fredoka';
  }
  brickIcon(x + 30, y + 21, 1, tag ? '#ff4b3e' : '#f2cd37');
  g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(text, x + 110, y + ph / 2 + 2);
}
function hud(t) {
  g.clearRect(0, 0, W, H);
  const cnt = VO.filter(v => v.radio && t >= v.t - .05 && t < T.ignite);
  if (cnt.length) pill(cnt.map(v => v.text).join('  '), H - 150, 'MISSION CONTROL');
  else if (t < T.end) { const v = VO.find(v => !v.radio && t >= v.t - .05 && t < v.t + voDur(v) + .5); if (v) pill(v.text, H - 150); }
  if (t >= T.title[0] && t < T.title[1]) {   // 片名（12fps 步进弹出）
    const u = seg(q(t), T.title[0], T.title[0] + .25), s = u < 1 ? .6 + .5 * Math.sin(u * Math.PI * .75) : 1, a = 1 - seg(t, T.title[1] - .25, T.title[1]);
    g.save(); g.globalAlpha = a; g.translate(W / 2, 200); g.scale(s, s);
    g.font = '700 104px Fredoka'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 24; g.shadowOffsetY = 6; g.fillStyle = '#fff'; g.fillText('Rocket from Spare Parts', 0, 0);
    g.shadowBlur = 0; g.shadowOffsetY = 0; g.font = '600 34px Fredoka'; g.fillStyle = '#f2cd37'; g.fillText('A BRICK TOY FILM', 0, 78);
    g.restore();
  }
  if (t >= T.end) {   // 片尾卡
    const a = ss(seg(t, T.end, T.end + .5));
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, `rgba(10,12,16,${.25 * a})`); gr.addColorStop(1, `rgba(10,12,16,${.8 * a})`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
    g.font = '700 96px Fredoka'; g.fillText('Rocket from Spare Parts', W / 2, H / 2 - 40);
    brickIcon(W / 2 - 29, H / 2 + 40, 1);
    g.font = '600 34px Fredoka'; g.fillStyle = '#f2cd37'; g.fillText('BRICK TOY  ·  LEMO-OPUSCAR', W / 2, H / 2 + 120);
    g.font = '600 30px Fredoka'; g.fillStyle = '#fff'; g.fillText('LemoLab × Claude Opus 5.5', W / 2, H / 2 + 172);
    g.font = '400 22px Fredoka'; g.fillStyle = 'rgba(255,255,255,.75)'; CREDITS.forEach((c, i) => g.fillText(c, W / 2, H - 110 + i * 34));
    g.restore();
  }
}

function render(t0) {
  const t = q(t0), st = shotAt(t0);
  const A = astroAt(t); astro.root.visible = A.vis; astro.pose(A.P);
  const mid = handsWorld(), fwd = FWD(A.P.ry);
  const holdPos = A.hold === 'carry' ? mid.clone().add(V(0, -.55, 0)).addScaledVector(fwd, .3) : mid.clone().add(V(0, .25, 0));
  const behind = side => V(A.P.x, TOP, A.P.z).addScaledVector(fwd, -5).add(V(side * 2.5, 0, 0));
  const r = rockets.update(t0, { set, handPos: mid, handsUpPos: holdPos, carryPos: holdPos, carryRy: A.P.ry, astroRy: A.P.ry, behind });
  ctxX = r.X;
  const pbRest = SP_SIT.clone().add(V(1.9, 0, 1.2));   // 捡起的那块红砖
  if (t < T.pickUp + .2) { pickBrick.position.copy(pbRest); pickBrick.rotation.set(0, .5, 0); }
  else if (t < 27.0) { pickBrick.position.copy(astro.arms[1].hand.getWorldPosition(V(0, 0, 0)).add(V(0, -.6, 0))); pickBrick.rotation.set(0, A.P.ry, 0); }
  else { pickBrick.position.copy(SP_PILE.clone().add(V(1.4, 0, 1.8))); pickBrick.rotation.set(0, .9, 0); }
  const mbSlot = moonC().add(V(6.2, 0, 4.6));   // 月球上放下的砖
  moonBrick.visible = t >= T.walkOut;
  if (t < 46.5) moonBrick.position.copy(holdPos);
  else { const u = seg(t, 46.5, T.placeBrick); moonBrick.position.copy(u >= 1 ? mbSlot : holdPos.clone().lerp(mbSlot, u * u)); }
  moonBrick.rotation.set(0, A.P.ry, 0);
  ao.visible = t < 3.4;
  cam(t0, st);
  post.composer.render();
  hud(t0);
}

// —— 音效事件（给 mix.py）——
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  add('click', qc(T.firstClick), { v: 1.2 }); add('title', T.title[0]);
  for (let i = 1; i < 12; i++) { add('whoosh', qc(T.layer(i) - .5), { v: .5 }); add('click', qc(T.layer(i)), { v: .9 }); }
  add('whoosh', qc(T.cone1 - .5), { v: .5 }); add('click', qc(T.cone1), { v: .9, pitch: 1.4 });
  for (let k = 0; k < 7; k++) add('creak', T.wobble + .15 + k * .22, { v: .3 + k * .1 });
  add('crash', qc(T.fall + .45)); for (let k = 0; k < 26; k++) add('clack', T.fall + .5 + Math.pow(k / 26, 1.6) * 2.2 + hash(k) * .08, { v: 1 - k / 30 });
  add('thump', qc(T.sit + .4), { v: .5 }); add('click', qc(T.pickUp + .2), { v: .6 });
  add('whoosh', T.toss[0], { v: .6 }); add('clack', T.toss[0] + .6, { v: .8 }); add('whoosh', T.toss[1], { v: .6 }); add('clack', T.toss[1] + .6, { v: .6 });
  add('ding', qc(T.found));
  for (let k = 0; k < 12; k++) add('click', qc(T.rebuild + k * T.rebuildStep + .45), { v: .75, pitch: 1 + (k % 3) * .08 });
  for (let i = 0; i < 4; i++) add('click', qc(T.rebuild + 1.4 + i * .15 + .4), { v: .6 });
  add('click', qc(T.rebuild + 6.5 * T.rebuildStep + .4), { v: .6 });
  add('whoosh', T.coneLand - .5, { v: .7 }); add('click', qc(T.coneLand), { v: 1.3, pitch: .8 });
  add('quindar', T.quindar); add('rumble', T.flicker, { d: 1.5, v: .3 }); add('ignite', T.ignite); add('roar', T.ignite, { d: 42.5 - T.ignite });
  add('roar', 42.5, { d: T.land - 42.5, v: .35 }); add('thump', qc(T.land), { v: 1 }); add('click', qc(T.placeBrick), { v: 1.1 }); add('click', T.end, { v: 1.2 });
  let last = null;   // 脚步：抽样表演
  for (let f = 0; f < DUR * 12; f++) {
    const t = f / 12, A = astroAt(t); if (!A.vis) { last = null; continue; }
    const l = A.P.legs?.[0] ?? 0, s = Math.sign(l);
    if (last !== null && s !== 0 && s !== last && Math.abs(l) > .05) add('step', t, { v: .5 });
    if (s !== 0) last = s;
  }
  return ev.sort((a, b) => a.t - b.t);
}

window.render = render; window.DUR = DUR; window.EV = events(); window.DBG = { camera, astro, post };
await document.fonts.load('600 46px Fredoka'); await document.fonts.load('700 104px Fredoka');
render(parseFloat(new URLSearchParams(location.search).get('t') ?? '10'));
window.READY = true;
