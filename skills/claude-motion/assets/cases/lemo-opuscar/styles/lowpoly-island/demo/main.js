// The Island That Grew — Low-poly Isometric Island 风格 demo
import * as THREE from 'three';
import { clamp, seg, ss, eio, eo, lerp, monotone, TAU } from '/core/lib.js';
import { DUR, T, VO, SKY, shotAt, BEAT, CREDITS } from './story.js';
import { makePost } from './post.js';
import { makeSea } from './sea.js';
import { buildWorld } from './world.js';

const W = 1920, H = 1080, QS = new URLSearchParams(location.search);
const SSAA = +(QS.get('ssaa') ?? 2);
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-10, 10, 5, -5, 1, 1600);
const post = makePost(renderer, scene, camera, W, H, { ssaa: SSAA, aoRadius: .7, aoScale: 1.5, aoThickness: 1 });
post.bloom.strength = .32; post.bloom.threshold = .95; post.bloom.radius = .55;

const sea = makeSea(scene);
const world = buildWorld(scene);

// —— 灯光 ——
const hemi = new THREE.HemisphereLight('#eef6fb', '#c6b89c', 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff6e8', 2.6); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.0006; sun.shadow.normalBias = .02; sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 120 }); sun.shadow.camera.updateProjectionMatrix();
scene.add(sun, sun.target);

// —— 天色插值 ——
const C = h => new THREE.Color(h);
const SK = SKY.map(k => ({ t: k[0], zen: C(k[1]), hor: C(k[2]), deep: C(k[3]), shal: C(k[4]), sun: C(k[5]), sunI: k[6], hs: C(k[7]), hg: C(k[8]), hI: k[9], el: k[10], az: k[11], night: k[12] }));
function skyAt(t) {
  let i = 0; while (i < SK.length - 2 && t > SK[i + 1].t) i++;
  const a = SK[i], b = SK[i + 1], u = ss(seg(t, a.t, b.t)), o = {};
  for (const k of ['zen', 'hor', 'deep', 'shal', 'sun', 'hs', 'hg']) o[k] = a[k].clone().lerp(b[k], u);
  for (const k of ['sunI', 'hI', 'el', 'az', 'night']) o[k] = lerp(a[k], b[k], u);
  return o;
}

// —— 镜头：正交等距；target / 方位角 / 俯角 / 视野高 ——
const DEG = Math.PI / 180;
const K = (keys) => { const f = monotone(keys); return f; };
const grow = {
  tx: K([[0, world.BUOY[0] - 1.2], [6.25, world.BUOY[0] - 1.6], [10, 2.2], [12.5, .8], [13.75, .5]]),
  tz: K([[0, world.BUOY[1] - .6], [6.25, world.BUOY[1] - 1.0], [10, 0], [12.5, .2], [13.75, .2]]),
  ty: K([[0, .2], [8, .4], [21.25, .6]]),
  az: K([[0, 28], [6.25, 40], [10.6, 62], [12.5, 74], [13.75, 84]]),
  el: K([[0, 28], [6.25, 30], [21.25, 33]]),
  fh: K([[0, 7.5], [6.25, 8.4], [9, 10.2], [10.6, 11.4], [12.5, 12.6], [13.75, 13.4], [21.25, 16.2]]),
};
let CAM = {};
function cam(t) {
  const [t0, t1, name] = shotAt(t), u = seg(t, t0, t1);
  let tg = [0, .6, 0], az = 45, el = 30, fh = 20, hzA = .1, hzB = .52, tiltF = .5, tiltB = .3;
  switch (name) {
    case 'grow': case 'grow2': tg = [grow.tx(t), grow.ty(t), grow.tz(t)]; az = grow.az(t); el = grow.el(t); fh = grow.fh(t); break;
    case 'rock': tg = [.1, 1.45, .1]; az = lerp(62, 72, u); el = 29; fh = lerp(6.2, 5.8, u); tiltB = .28; break;
    case 'trees': tg = [.3, 1.2, -.2]; az = lerp(92, 112, u); el = 30; fh = lerp(9.2, 8.6, u); break;
    case 'houses': tg = [2.55, 1.1, -1.35]; az = lerp(116, 126, u); el = 26; fh = lerp(6.4, 6.0, u); tiltB = .26; break;
    case 'details': tg = [-3.2, .8, 2.4]; az = lerp(300, 310, u); el = 27; fh = lerp(6.6, 7.4, u); tiltB = .26; break;
    case 'square': tg = [1.2, 1.1, -1.4]; az = lerp(196, 204, u); el = 34; fh = 12.5; tiltB = .26; break;
    case 'dock': { const B = world.boatAt(Math.max(t, T.dock + .6)); const d = world.dockEnd; const k = ss(seg(t, T.dock + .5, t1 - .3)) * .8;
      tg = [lerp(d[0] - 1.2, B.x ?? d[0], k), .5, lerp(d[1] - 1.0, B.z ?? d[1], k)]; az = lerp(240, 234, u); el = 30; fh = lerp(9.5, 11, u); break; }
    case 'dusk': tg = [0, .7, 0]; az = lerp(222, 216, u); el = 31; fh = lerp(15, 13.2, eio(u)); break;
    case 'lost': { const b = world.boatFar; tg = [b[0] * .45, .5, b[1] * .45]; az = lerp(186, 182, u); el = 21; fh = 24; hzA = .0; hzB = .34; break; }
    case 'tower': tg = [0, 3.7, 0]; az = lerp(206, 213, u); el = 24; fh = 6.9; hzA = .04; hzB = .36; tiltB = .34; break;
    default: {   // beam：高俯角，随光束半速旋转；回港后正交拉远
      const z = ss(seg(t, T.home, T.end + .6)), zz = Math.pow(z, 1.6);
      // 点亮后先高俯角看光束扫过全岛（八音盒），再缓慢下俯让星空"升起来"，最后正交拉远
      const dn = ss(seg(t, 38.4, T.home + .6));
      tg = [0, lerp(1.2, 0, z), 0]; az = 200 + (t - T.ignite) * (world.OMEGA / DEG) * .22; el = lerp(lerp(50, 25, dn), 22, z);
      fh = lerp(17, 19, dn) * Math.pow(420 / 19, zz); hzA = lerp(lerp(.1, .0, dn), -.02, z); hzB = lerp(lerp(.52, .36, dn), .3, z); tiltB = lerp(.3, .5, z);
    }
  }
  const D = Math.max(300, fh * 3), ce = Math.cos(el * DEG);   // 相机要足够远：正交画面下缘的视线起点不能落到海面以下
  camera.position.set(tg[0] + D * ce * Math.sin(az * DEG), tg[1] + D * Math.sin(el * DEG), tg[2] + D * ce * Math.cos(az * DEG));
  camera.up.set(0, 1, 0); camera.lookAt(tg[0], tg[1], tg[2]);
  const fw = fh * W / H; camera.left = -fw / 2; camera.right = fw / 2; camera.top = fh / 2; camera.bottom = -fh / 2; camera.near = 1; camera.far = D + fh * 5 + 800; camera.updateProjectionMatrix();
  const cot = 1 / Math.tan(el * DEG);
  post.comp.camDist.value = D; post.comp.hz0.value = hzA * fh * cot; post.comp.hz1.value = hzB * fh * cot;
  post.tilt.fy.value = tiltF; post.tilt.band.value = tiltB;
  CAM = { tg, az, el, fh, name };
}

// —— 2D 层：片名、字幕、片尾 ——
const ov = document.getElementById('ov'), g = ov.getContext('2d');
let DURS = {};
try { const r = await fetch('voices/dur.json'); if (r.ok) DURS = await r.json(); } catch (e) { }
const voDur = v => DURS[v.id] ?? v.text.length * .065;
const subSpan = v => { const i = VO.indexOf(v), nx = VO[i + 1]; let b = v.t + Math.max(1.8, voDur(v) + .6); if (nx) b = Math.min(b, nx.t - .05); return [v.t - .05, b]; };
function hexIcon(x, y, s, top) {   // 平面着色的小六边形地块：顶面 + 两个侧面
  const P = a => [x + Math.cos(a) * s, y + Math.sin(a) * s * .58];
  const pts = [0, 1, 2, 3, 4, 5].map(i => P(i * Math.PI / 3 + Math.PI / 6 * 0));
  const dy = s * .55;
  g.save();
  g.fillStyle = '#b88a5e'; g.beginPath(); g.moveTo(...pts[0]); g.lineTo(pts[0][0], pts[0][1] + dy); g.lineTo(pts[1][0], pts[1][1] + dy); g.lineTo(pts[2][0], pts[2][1] + dy); g.lineTo(pts[3][0], pts[3][1] + dy); g.lineTo(...pts[3]); g.closePath(); g.fill();
  g.fillStyle = '#9a7048'; g.beginPath(); g.moveTo(...pts[0]); g.lineTo(pts[0][0], pts[0][1] + dy); g.lineTo(pts[1][0], pts[1][1] + dy); g.lineTo(...pts[1]); g.closePath(); g.fill();
  g.fillStyle = top; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(x, y); g.lineTo(...pts[3]); g.lineTo(...pts[4]); g.lineTo(...pts[5]); g.closePath(); g.fill();
  g.restore();
}
const iconTop = t => t < 6 ? '#f5c2b0' : t < 26 ? '#93c96c' : t < 31 ? '#ffa860' : '#ffc676';
function spaced(text, x, y, track, align = 'center') {   // 手动字距
  const ws = [...text].map(ch => g.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0) + track * (text.length - 1);
  let cx = align === 'center' ? x - tot / 2 : x; const pos = [];
  [...text].forEach((ch, i) => { pos.push(cx); cx += ws[i] + track; });
  return pos;
}
function titleBlock(t, t0, y, alpha, rise = true) {
  const TXT = 'THE ISLAND THAT GREW';
  g.save(); g.globalAlpha = alpha; g.font = '600 78px "Josefin Sans"'; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const pos = spaced(TXT, W / 2, y, 16);
  g.save(); g.beginPath(); g.rect(0, 0, W, y + 14); g.clip();
  [...TXT].forEach((ch, i) => {
    const s = t - (t0 + i * .055); if (rise && s < 0) return;
    const off = rise ? (s < .28 ? 110 * Math.pow(1 - s / .28, 2) : -Math.sin((s - .28) * 14) * Math.exp(-(s - .28) * 8) * 10) : 0;
    g.shadowColor = 'rgba(20,40,70,.35)'; g.shadowBlur = 18; g.shadowOffsetY = 4; g.fillStyle = '#ffffff'; g.fillText(ch, pos[i], y + off);
  });
  g.restore();
  // 水线
  const wl = rise ? ss(seg(t, t0, t0 + .8)) : 1; g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(W / 2 - 330 * wl, y + 22); g.lineTo(W / 2 + 330 * wl, y + 22); g.stroke();
  g.font = '300 34px "Josefin Sans"'; g.fillStyle = 'rgba(255,255,255,.92)'; g.shadowColor = 'rgba(20,40,70,.3)'; g.shadowBlur = 10;
  const sa = rise ? ss(seg(t, t0 + 1.3, t0 + 1.9)) : 1; g.globalAlpha = alpha * sa;
  const p2 = spaced('a low-poly island film', W / 2, y + 74, 5); [...'a low-poly island film'].forEach((ch, i) => g.fillText(ch, p2[i], y + 74));
  g.restore();
}
function hud(t) {
  g.clearRect(0, 0, W, H);
  if (QS.get('nohud')) return;
  if (t >= T.title[0] && t < T.title[1] + .1) titleBlock(t, T.title[0], 330, 1 - ss(seg(t, T.title[1] - .45, T.title[1])));
  if (t < T.end && !QS.get('poster')) {
    const v = VO.find(v => { const [a, b] = subSpan(v); return t >= a && t < b; });
    if (v) {
      const [a, b] = subSpan(v), al = ss(seg(t, a, a + .18)) * (1 - ss(seg(t, b - .2, b)));
      g.save(); g.globalAlpha = al; g.font = '600 44px Quicksand'; g.textBaseline = 'middle'; g.textAlign = 'left';
      const tw = g.measureText(v.text).width, x0 = W / 2 - (tw + 58) / 2, y = H - 118;
      hexIcon(x0 + 18, y - 6, 17, iconTop(t));
      g.shadowColor = 'rgba(15,25,45,.55)'; g.shadowBlur = 14; g.shadowOffsetY = 2; g.fillStyle = '#fffdf8'; g.fillText(v.text, x0 + 58, y + 2);
      g.restore();
    }
  }
  if (QS.get('poster')) titleBlock(t, 0, 190, 1, false);
  if (t >= T.end) {
    const a = ss(seg(t, T.end, T.end + .8));
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, `rgba(8,12,34,${.15 * a})`); gr.addColorStop(1, `rgba(8,12,34,${.55 * a})`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    titleBlock(t, T.end, 372, a, false);
    g.save(); g.globalAlpha = ss(seg(t, T.end + .5, T.end + 1.2)); hexIcon(W / 2, 668, 20, '#ffc676');
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffd89a'; g.font = '600 30px "Josefin Sans"';
    const p = spaced('LOW-POLY ISLAND  ·  LEMO-OPUSCAR', W / 2, 738, 6); [...'LOW-POLY ISLAND  ·  LEMO-OPUSCAR'].forEach((ch, i) => { g.textAlign = 'left'; g.fillText(ch, p[i], 738); });
    g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '500 30px Quicksand'; g.fillText('LemoLab × Claude Opus 5.5', W / 2, 794);
    g.font = '500 20px Quicksand'; g.fillStyle = 'rgba(255,255,255,.62)'; CREDITS.forEach((c, i) => g.fillText(c, W / 2, H - 92 + i * 30));
    g.restore();
  }
}

// —— 渲染 ——
function render(t) {
  const sk = skyAt(t);
  cam(t);
  const night = sk.night, amp = 1 + night * .35;
  sea.U.uTime.value = t; sea.U.uAmp.value = amp; sea.U.uDeep.value.copy(sk.deep); sea.U.uShal.value.copy(sk.shal);
  sea.U.uFoam.value.set(night > .5 ? '#9fb0e0' : '#ffffff');
  hemi.color.copy(sk.hs); hemi.groundColor.copy(sk.hg); hemi.intensity = sk.hI;
  const se = sk.el * DEG, sa = sk.az * DEG;
  sun.color.copy(sk.sun); sun.intensity = sk.sunI;
  sun.target.position.set(0, 0, 0); sun.position.set(Math.cos(se) * Math.sin(sa) * 60, Math.sin(se) * 60, Math.cos(se) * Math.cos(sa) * 60);
  post.comp.zen.value.copy(sk.zen); post.comp.hor.value.copy(sk.hor);
  post.comp.stars.value = ss(seg(night, .3, 1)); post.comp.starOff.value = CAM.az / 60; post.comp.time.value = t;
  const gd = post.grade;
  gd.sat.value = lerp(1.04, 1.1, night); gd.contrast.value = lerp(.06, .12, night); gd.lift.value.setRGB(lerp(.018, .012, night), lerp(.016, .016, night), lerp(.024, .045, night));
  gd.vig.value = lerp(.16, .32, night);
  post.bloom.strength = lerp(.22, .5, night);
  { const f = new THREE.Vector3(); camera.getWorldDirection(f); const fl = Math.hypot(f.x, f.z) || 1; sea.U.uFwd.value.set(f.x / fl, f.z / fl); sea.U.uTgt.value.set(CAM.tg[0], CAM.tg[2]); sea.U.uSpanF.value = CAM.fh / Math.tan(CAM.el * DEG) * .5; sea.U.uNight.value = night; }
  world.update(t, { night, amp, sea, winAmt: 1, px: CAM.fh / H, camBack: new THREE.Vector3().subVectors(camera.position, new THREE.Vector3(...CAM.tg)).normalize() });
  post.composer.render();
  hud(t);
}

// —— 音效 / 配乐事件（给 mix.py 和配乐脚本）——
function events() {
  const ev = world.EVS.slice();
  VO.forEach(v => ev.push({ t: v.t, type: 'vo', id: v.id, text: v.text }));
  ev.push({ t: 0, type: 'amb', what: 'waves', d: DUR });
  ev.push({ t: T.day - 1, type: 'amb', what: 'gulls', d: T.night0 - T.day + 2 });
  ev.push({ t: T.day, type: 'amb', what: 'mill', d: T.night - T.day });
  ev.push({ t: T.night0 + 1, type: 'amb', what: 'crickets', d: DUR - T.night0 - 1 });
  ev.push({ t: T.title[0], type: 'title' }); ev.push({ t: T.end, type: 'endcard' });
  for (const k of ['first', 'day', 'dock', 'dusk', 'night', 'rise', 'ignite', 'home', 'far', 'end']) ev.push({ t: T[k], type: 'cue', name: k });
  return ev.sort((a, b) => a.t - b.t);
}

// 远方浮标：放在结尾机位画面右下（先算出那一刻的相机，再反投影到海面）
{ cam(T.bellFar + .3); const fw = CAM.fh * W / H, R = new THREE.Vector3(), U = new THREE.Vector3(), F = new THREE.Vector3();
  camera.updateMatrixWorld(); R.setFromMatrixColumn(camera.matrixWorld, 0); U.setFromMatrixColumn(camera.matrixWorld, 1); camera.getWorldDirection(F);
  const p = new THREE.Vector3(...CAM.tg).addScaledVector(R, fw * .3).addScaledVector(U, -CAM.fh * .27); const k = -p.y / F.y; p.addScaledVector(F, k);
  world.BUOY_FAR[0] = p.x; world.BUOY_FAR[1] = p.z; }
window.render = render; window.DUR = DUR; window.EV = events(); window.DBG = { camera, world, post, scene, sun, hemi };
await document.fonts.load('600 78px "Josefin Sans"'); await document.fonts.load('300 34px "Josefin Sans"'); await document.fonts.load('600 44px Quicksand'); await document.fonts.load('500 30px Quicksand');
render(parseFloat(QS.get('t') ?? '10'));
if (QS.get('dbg')) { const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); const out = [];
  scene.traverseVisible(o => { if (o.isMesh && !o.isInstancedMesh) { const b = new THREE.Box3().setFromObject(o); if (!b.isEmpty() && fr.intersectsBox(b)) { const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()); if (sz.length() < 50) out.push(o.geometry.type + ' ' + c.toArray().map(v => v.toFixed(2)) + ' sz ' + sz.toArray().map(v => v.toFixed(2))); } } });
  console.error('VIS ' + out.join(' | ')); }
window.READY = true;
