// S4 · 明朝的习俗：桥上互赠月饼的两人 + 展开的卷轴（《西湖游览志余》）
import * as THREE from 'three';
import { sheet, skyPanel, moon, setMoon, text, vtext } from '../paper.js';
import { willow, xiangyun, reeds, waves, waterTop, osmanthus, lantern, FONT } from '../art.js';
import { spline } from '../people.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, eo, lerp, clamp, mulberry, TAU } from '../lib.js';

// 古人长袍（面朝右；原点=脚底；hat: 'wing' 乌纱翅 | 'scarf' 头巾）
export function robed(x, s, o = {}) {
  spline(x, s, [[-.03, .99], [.03, .985], [.058, .955], [.06, .935], [.072, .915, 1], [.06, .906], [.062, .89], [.055, .872], [.03, .862], [.03, .83], [.07, .8], [.1, .7], [.12, .5], [.15, .2], [.18, .02], [.19, 0, 1], [-.17, 0, 1], [-.15, .1], [-.12, .4], [-.09, .65], [-.075, .8], [-.05, .86], [-.06, .93]]);
  x.fill();
  if (o.hat === 'wing') { x.beginPath(); x.ellipse(0, .99 * s, .062 * s, .035 * s, 0, Math.PI, 0, true); x.fill(); x.fillRect(-.16 * s, .965 * s, .32 * s, .012 * s); x.beginPath(); x.ellipse(-.16 * s, .971 * s, .02 * s, .012 * s, 0, 0, TAU); x.ellipse(.16 * s, .971 * s, .02 * s, .012 * s, 0, 0, TAU); x.fill(); }
  else { x.beginPath(); x.ellipse(-.005 * s, .985 * s, .06 * s, .045 * s, 0, 0, TAU); x.fill(); x.beginPath(); x.moveTo(-.05 * s, .97 * s); x.quadraticCurveTo(-.11 * s, .9 * s, -.1 * s, .8 * s); x.lineTo(-.08 * s, .82 * s); x.quadraticCurveTo(-.08 * s, .92 * s, -.03 * s, .96 * s); x.fill(); }
  // 前伸的双臂 + 宽袖（捧物 / 作揖）
  const a = o.reach ?? .0;
  x.beginPath(); x.moveTo(.02 * s, .8 * s); x.quadraticCurveTo(.16 * s, (.72 + a) * s, .24 * s, (.66 + a) * s); x.lineTo(.25 * s, (.6 + a) * s); x.quadraticCurveTo(.2 * s, (.52 + a) * s, .12 * s, (.5 + a * .5) * s); x.quadraticCurveTo(.06 * s, .55 * s, .0, .62 * s); x.closePath(); x.fill();
  x.beginPath(); x.ellipse(.26 * s, (.64 + a) * s, .025 * s, .018 * s, 0, 0, TAU); x.fill();
  if (o.bow) { /* 鞠躬由外部旋转实现 */ }
}

export function build(E) {
  const MN = [-.11, .06, -.125];
  const S = stage({ light: MN, lightR: .16, lightCol: '#ffe6b8', key: 1.0, amb: .3, ambCol: '#d8b890', keyCol: '#fff0da' });
  const { U } = S;
  S.add(skyPanel({ w: .62, h: .38, z: -.135, stops: [[0, '#b98a52'], [.6, '#d9b47c'], [1, '#e8cc98']], stars: 0 }));
  const mn = S.add(moon({ x: MN[0], y: MN[1], z: MN[2], r: .042, gain: 1.35, halo: 3.2, haloGain: .25, core: '#fffaf0', mid: '#fdf1d6', edge: '#f3dcae' }));
  S.add(sheet({ U, w: .62, h: .36, z: -.11, trans: .8, draw: x => { x.fillStyle = '#f1dfba'; xiangyun(x, -.03, .1, .008, -1, { tail: 3 }); xiangyun(x, -.2, .02, .0075, 1); } }));
  // 远处城楼屋脊
  S.add(sheet({ U, w: .62, h: .36, z: -.09, trans: .5, draw: x => {
    x.fillStyle = '#c29458';
    x.fillRect(-.31, -.18, .62, .16);
    const roof = (cx, by, w, h) => { x.beginPath(); x.moveTo(cx - w * .62, by + h * .15); x.quadraticCurveTo(cx - w * .45, by, cx - w * .3, by + h * .6); x.lineTo(cx + w * .3, by + h * .6); x.quadraticCurveTo(cx + w * .45, by, cx + w * .62, by + h * .15); x.lineTo(cx + w * .5, by - h * .1); x.lineTo(cx - w * .5, by - h * .1); x.closePath(); x.fill(); };
    const R = mulberry(3);
    for (let i = 0; i < 16; i++) { const cx = -.3 + i * .04 + R() * .01, h = .012 + R() * .012; x.fillRect(cx - .016, -.02, .032, h); roof(cx, -.02 + h, .04, .01); }
    x.fillRect(.02, -.02, .08, .05); roof(.06, .03, .1, .022); x.fillRect(.035, .045, .05, .018); roof(.06, .063, .075, .018);   // 城楼
  } }));
  // 河与桥、柳
  const midL = S.add(sheet({ U, w: .62, h: .36, z: -.068, trans: .3, draw: x => {
    x.fillStyle = '#9a6a3a'; waterTop(x, { x0: -.31, x1: .31, base: -.03, amp: .0008, len: .04 });
    x.save(); x.beginPath(); x.rect(-.31, -.18, .62, .148); x.clip(); waves(x, { x0: -.31, x1: .31, y0: -.036, y1: -.18, r: .006, fill: '#9a6a3a', line: '#b88a55', lw: .0006 }); x.restore();
  } }));
  const bridge = S.add(sheet({ U, w: .62, h: .36, z: -.052, trans: .15, draw: x => {
    x.fillStyle = '#6b4222';
    x.beginPath(); x.moveTo(-.2, -.07); x.quadraticCurveTo(-.08, -.0, .04, -.07); x.lineTo(.04, -.085); x.lineTo(-.2, -.085); x.closePath(); x.fill();
    x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.ellipse(-.08, -.086, .05, .045, 0, 0, Math.PI); x.fill(); x.restore();
    x.lineWidth = .0012; x.strokeStyle = '#6b4222'; x.beginPath(); x.moveTo(-.19, -.058); x.quadraticCurveTo(-.08, .012, .03, -.058); x.stroke();
    for (let i = 0; i < 11; i++) { const u = (i + .5) / 11, px = -.19 + u * .22, py = -.07 + Math.sin(u * Math.PI) * .035; x.fillRect(px - .0008, py, .0016, .011); }
    willow(x, { cx: -.27, by: -.1, h: .2, strands: 22, seed: 5 });
  } }));
  // 两人互赠（左者捧盒，右者作揖）
  const giver = S.add(sheet({ U, w: .1, h: .12, x: -.115, y: -.028, z: -.045, trans: .06, ay: -.05, draw: x => { x.fillStyle = '#3e2412'; x.translate(0, -.05); robed(x, .085, { hat: 'wing', reach: -.02 }); x.fillStyle = '#a3291f'; x.fillRect(.085 * .21, .085 * .6, .085 * .11, .085 * .07); x.fillStyle = '#d9a441'; x.fillRect(.085 * .21, .085 * .63, .085 * .11, .085 * .012); } }));
  const taker = S.add(sheet({ U, w: .1, h: .12, x: -.04, y: -.022, z: -.046, trans: .06, ay: -.05, draw: x => { x.fillStyle = '#3e2412'; x.translate(0, -.05); x.scale(-1, 1); robed(x, .08, { hat: 'scarf', reach: .02 }); } }));
  // 卷轴：右端为轴心，向左展开
  const SW = .2, SH = .19, SX = .215, SY = .01;
  const scroll = S.add(sheet({ U, w: SW, h: SH, x: SX - SW / 2, y: SY, z: -.03, ax: SW / 2, trans: .35, finish: { rim: .25 }, draw: x => {
    x.fillStyle = '#f3e7cb'; x.fillRect(-SW / 2, -SH / 2, SW, SH);
    x.fillStyle = '#8a5a2e'; x.fillRect(-SW / 2, SH / 2 - .01, SW, .004); x.fillRect(-SW / 2, -SH / 2 + .006, SW, .004);
    const F = FONT.brush, cs = .0148, ink = '#2a170c';
    vtext(x, '八月十五日谓之中秋', .07, .062, cs, F, { fill: ink, gap: 1.02 });
    vtext(x, '民间以月饼相遗', .045, .062, cs, F, { fill: ink, gap: 1.02 });
    vtext(x, '取团圆之义', .02, .062, cs, F, { fill: ink, gap: 1.02 });
    vtext(x, '明·田汝成', -.006, .062, .0072, F, { fill: '#5a3a22', gap: 1.08 }); vtext(x, '︽西湖游览志余︾', -.016, .062, .0072, F, { fill: '#5a3a22', gap: 1.08 });
    x.fillStyle = '#b3302a'; x.fillRect(-.045, -.062, .015, .015); vtext(x, '团圆', -.0375, -.0508, .0055, F, { fill: '#f6e3c3', gap: 1.05 });
  } }));
  const rodDraw = x => { x.fillStyle = '#4a2a14'; x.beginPath(); x.roundRect(-.005, -SH / 2 - .012, .01, SH + .024, .004); x.fill(); x.fillStyle = '#2a170c'; x.beginPath(); x.arc(0, SH / 2 + .012, .006, 0, TAU); x.arc(0, -SH / 2 - .012, .006, 0, TAU); x.fill(); };
  const rodR = S.add(sheet({ U, w: .03, h: SH + .05, x: SX, y: SY, z: -.028, trans: .05, draw: rodDraw }));
  const rodL = S.add(sheet({ U, w: .03, h: SH + .05, x: SX, y: SY, z: -.028, trans: .05, draw: x => { x.fillStyle = '#e9dbbd'; x.beginPath(); x.roundRect(-.008, -SH / 2, .016, SH, .006); x.fill(); rodDraw(x); } }));
  S.add(sheet({ U, w: .62, h: .38, z: -.012, trans: .04, draw: x => {
    x.fillStyle = '#2c180b'; x.strokeStyle = '#2c180b';
    x.fillRect(-.31, -.19, .62, .045);
    reeds(x, { x0: -.3, x1: -.05, by: -.145, h: .045, n: 30, seed: 5 });
    osmanthus(x, { cx: .3, by: .08, h: .12, flowers: '#6a4a24', seed: 9, leaves: 40, nFlowers: 30 });
  } }));
  const scrollMap = scroll.material.map;
  scrollMap.wrapS = THREE.ClampToEdgeWrapping;
  const tOpen = E.cue('L06') + .6;
  return {
    S,
    update(t) {
      const k = Math.max(.001, eo(seg(t, tOpen, tOpen + 2.4)));
      scroll.scale.x = k; scrollMap.repeat.x = k; scrollMap.offset.x = 1 - k;
      rodL.position.x = SX - SW * k;
      // 递盒：左者前倾，右者作揖
      const g = ss(seg(t, .3, 1.6)); giver.rotation.z = -.1 * g; giver.position.x = -.115 + .006 * g; taker.rotation.z = .16 * ss(seg(t, .9, 2)) * (1 - .3 * ss(seg(t, 2.6, 3.4)));
      const u = eio(clamp(t / E.dur));
      aim(S.cam, [lerp(-.075, .1, u), lerp(-.005, .004, u), lerp(.38, .4, u), lerp(-.075, .115, u), lerp(-.012, .008, u), -.05], t);
    },
    post() { return { focus: S.cam.position.z + .04, aper: 14, maxCoc: 12, bloom: { strength: .3, radius: .5, threshold: 1.3 } }; },
    grade() { return { expo: 1.0, vig: .45, sat: .95, contrast: .1, lift: [.02, .012, 0], gain: [1.02, 1, .94] }; },
  };
}
