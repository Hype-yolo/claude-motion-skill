// S3 · 俯拍：揉面 → 包馅 → 木模“啪”地一压 → 印出“圆”字 → 烤成金色
import * as THREE from 'three';
import { sheet, text } from '../paper.js';
import { FONT, leaf } from '../art.js';
import { arm } from '../people.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, eo, ei, lerp, clamp, mulberry, TAU, back } from '../lib.js';

// 月饼顶面纹样：kind='color' | 'bump'；r 半径；ch 中心字；wobble 手工歪扭程度
export function cakeFace(x, r, kind, o = {}) {
  const B = kind === 'bump', R = mulberry(o.seed || 3), wob = o.wobble || 0;
  const W = a => 1 + wob * (Math.sin(a * 3 + 1) * .5 + Math.sin(a * 5 + 2) * .3);
  const petals = o.petals ?? 16;
  const rim = a => r * W(a) * (1 - .055 * Math.pow(Math.abs(Math.cos(a * petals / 2)), .7));
  const poly = f => { x.beginPath(); for (let i = 0; i <= 240; i++) { const a = i / 240 * TAU, rr = f(a); i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); };
  // 侧壁/底色
  x.fillStyle = B ? '#9a9a9a' : (o.base || '#fff'); poly(rim); x.fill();
  // 外缘凸起花边
  x.fillStyle = B ? '#e6e6e6' : (o.hi || '#fff'); poly(a => rim(a) * .97); x.fill();
  x.fillStyle = B ? '#707070' : (o.lo || '#e2d2b8'); poly(a => r * .78 * W(a)); x.fill();
  x.fillStyle = B ? '#b0b0b0' : (o.base || '#fff'); poly(a => r * .74 * W(a)); x.fill();
  // 花瓣刻槽
  x.strokeStyle = B ? '#5a5a5a' : (o.lo || '#e2d2b8'); x.lineWidth = r * .03; x.lineCap = 'round';
  for (let i = 0; i < petals; i++) { const a = (i + .5) / petals * TAU; x.beginPath(); x.moveTo(Math.cos(a) * r * .8, Math.sin(a) * r * .8); x.lineTo(Math.cos(a) * r * .93, Math.sin(a) * r * .93); x.stroke(); }
  // 八瓣卷草
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + .2; x.save(); x.rotate(a);
    x.fillStyle = B ? '#dcdcdc' : (o.hi || '#fff');
    x.beginPath(); x.moveTo(r * .38, 0); x.quadraticCurveTo(r * .55, r * .16, r * .7, 0); x.quadraticCurveTo(r * .55, -r * .06, r * .38, 0); x.fill();
    x.beginPath(); x.arc(r * .64, r * .07, r * .03, 0, TAU); x.fill();
    x.restore();
  }
  // 连珠
  x.fillStyle = B ? '#e0e0e0' : (o.hi || '#fff');
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; x.beginPath(); x.arc(Math.cos(a) * r * .34 * W(a), Math.sin(a) * r * .34 * W(a), r * .018, 0, TAU); x.fill(); }
  // 中心：圆框 + 字
  x.fillStyle = B ? '#606060' : (o.lo || '#e2d2b8'); x.beginPath(); x.arc(0, 0, r * .3, 0, TAU); x.fill();
  x.fillStyle = B ? '#9c9c9c' : (o.base || '#fff'); x.beginPath(); x.arc(0, 0, r * .27, 0, TAU); x.fill();
  const ch = o.ch ?? '圆';
  if (ch.length === 1) text(x, ch, 0, -r * .01, r * .4, o.font || FONT.brush, { fill: B ? '#f4f4f4' : (o.hi || '#fff'), rot: o.chRot || 0 });
  else { text(x, ch[0], 0, r * .1, r * .2, o.font || FONT.hand, { fill: B ? '#f4f4f4' : (o.hi || '#fff'), rot: .08 }); text(x, ch[1], r * .01, -r * .11, r * .2, o.font || FONT.hand, { fill: B ? '#f4f4f4' : (o.hi || '#fff'), rot: -.1 }); }
}

export function build(E) {
  const S = stage({ light: [0, 0, -.06], lightR: .2, lightCol: '#ffd9a8', key: 1.5, amb: .28, ambCol: '#d0a070', keyCol: '#ffe2bc', keyPos: [-.12, .22, .32], keyTarget: [0, 0, -.06], shadowR: 8 });
  const { U } = S;
  const R = mulberry(4);
  // 案板：木纹 + 面粉 + 散落的桂花、碗、擀面杖
  S.add(sheet({ U, w: .56, h: .34, z: -.06, trans: .15, draw: x => {
    x.fillStyle = '#b07a48'; x.fillRect(-.28, -.17, .56, .34);
    for (let i = 0; i < 90; i++) { const y = -.17 + R() * .34; x.strokeStyle = `rgba(${R() < .5 ? '90,50,24' : '214,160,105'},${.15 + R() * .25})`; x.lineWidth = .0004 + R() * .0012; x.beginPath(); x.moveTo(-.28, y); for (let k = 0; k <= 20; k++) x.lineTo(-.28 + k * .028, y + Math.sin(k * .7 + i) * .0015 + (R() - .5) * .0006); x.stroke(); }
    for (let i = 0; i < 26; i++) { const px = (R() - .5) * .3, py = (R() - .5) * .2, rr = .01 + R() * .03, g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, 'rgba(250,244,230,.55)'); g.addColorStop(1, 'rgba(250,244,230,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
    x.fillStyle = 'rgba(252,248,238,.8)'; for (let i = 0; i < 700; i++) { const a = R() * TAU, rr = .04 + Math.pow(R(), 2) * .1; x.beginPath(); x.arc(Math.cos(a) * rr, Math.sin(a) * rr * .8, .0004 + R() * .0006, 0, TAU); x.fill(); }
    // 碗（馅）
    x.fillStyle = '#6e3a1e'; x.beginPath(); x.arc(-.17, .085, .05, 0, TAU); x.fill(); x.fillStyle = '#8c4f2b'; x.beginPath(); x.arc(-.17, .085, .043, 0, TAU); x.fill();
    x.fillStyle = '#4a1f10'; x.beginPath(); x.arc(-.17, .085, .038, 0, TAU); x.fill();
    x.fillStyle = '#5c2a16'; for (let i = 0; i < 12; i++) { x.beginPath(); x.arc(-.17 + (R() - .5) * .05, .085 + (R() - .5) * .05, .004 + R() * .005, 0, TAU); x.fill(); }
    // 擀面杖
    x.fillStyle = '#8a5a30'; x.save(); x.translate(-.12, -.11); x.rotate(.25); x.beginPath(); x.roundRect(-.1, -.009, .2, .018, .009); x.fill(); x.fillStyle = '#6a4020'; x.fillRect(-.1, -.002, .2, .002); x.restore();
    // 小面团
    for (const [px, py] of [[.17, .1], [.2, .07], [.215, .11]]) { const g = x.createRadialGradient(px - .004, py + .004, 0, px, py, .018); g.addColorStop(0, '#f6e6c4'); g.addColorStop(1, '#d9bb88'); x.fillStyle = g; x.beginPath(); x.arc(px, py, .017, 0, TAU); x.fill(); }
    // 桂花
    x.fillStyle = '#e8b14a'; for (let i = 0; i < 30; i++) { const px = (R() - .5) * .5, py = (R() - .5) * .3; if (Math.hypot(px, py) < .06) continue; for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(px + Math.cos(k * TAU / 4) * .0016, py + Math.sin(k * TAU / 4) * .0016, .0014, 0, TAU); x.fill(); } }
  } }));
  // 面团：先是擀开的面皮（揉），馅球落下后包成圆团
  const ball = (x, c0, c1, c2, r) => { const g = x.createRadialGradient(-r * .25, r * .3, r * .05, 0, 0, r); g.addColorStop(0, c0); g.addColorStop(.7, c1); g.addColorStop(1, c2); x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.fill(); };
  const sheetD = S.add(sheet({ U, w: .12, h: .12, z: -.0535, trans: .2, finish: { rim: .15 }, draw: x => { ball(x, '#f4e4c2', '#ead3a6', '#dcc08e', .05); x.strokeStyle = 'rgba(190,160,110,.35)'; x.lineWidth = .0008; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(0, 0, .012 + i * .008, 0, TAU); x.stroke(); } } }));
  const fill = S.add(sheet({ U, w: .06, h: .06, z: .05, trans: .1, draw: x => ball(x, '#8a4128', '#5e2614', '#44190c', .02) }));
  const dough = S.add(sheet({ U, w: .09, h: .09, z: -.052, trans: .2, finish: { rim: .2 }, draw: x => ball(x, '#fbeccb', '#ead0a0', '#cfae78', .035) }));
  // 月饼（印后）：白面坯 → 金色烤皮，用由内而外的圆形推进切换
  const cakeO = (lo, base, hi) => ({ U, w: .09, h: .09, z: -.0515, trans: .15, envMap: E.env, bumpBlur: 2.5, bumpDraw: x => cakeFace(x, .038, 'bump'), draw: x => cakeFace(x, .038, 'color', { base, hi, lo }) });
  const paleC = S.add(sheet({ ...cakeO('#c4ab80', '#e9d7b2', '#f6ead0'), metal: 0, rough: .7, bump: 7, envI: .6 })); paleC.material.color.setScalar(.9);
  const cake = S.add(sheet({ ...cakeO('#6a3812', '#b8742c', '#e9b25c'), metal: .55, rough: .34, bump: 9, envI: 1.2 })); cake.position.z = -.0513;
  // 木模（背面 + 雕花手柄）+ 外婆的手
  const mold = new THREE.Group(); S.scene.add(mold);
  const moldS = sheet({ U, w: .2, h: .2, trans: .05, draw: x => {
    x.fillStyle = '#5c311a'; x.beginPath(); x.roundRect(-.05, -.05, .1, .1, .012); x.fill();
    x.save(); x.rotate(-.6); x.beginPath(); x.roundRect(.04, -.012, .12, .024, .01); x.fill(); x.restore();
    x.strokeStyle = 'rgba(30,12,4,.5)'; x.lineWidth = .0008; for (let i = 0; i < 16; i++) { x.beginPath(); x.moveTo(-.048, -.045 + i * .006); x.bezierCurveTo(-.02, -.043 + i * .006, .02, -.047 + i * .006, .048, -.044 + i * .006); x.stroke(); }
    x.strokeStyle = '#3a1c0c'; x.lineWidth = .002; x.strokeRect(-.042, -.042, .084, .084);
    text(x, '福', 0, 0, .04, FONT.brush, { fill: '#3e1f0e' });
  } });
  const hand = sheet({ U, w: .2, h: .2, trans: .05, draw: x => {
    x.fillStyle = '#2d160c'; x.save(); x.translate(.11, -.07); arm(x, .5, 2.55, -.05, { L1: .12, L2: .12, w: .06, sleeve: 1.2, wrist: .1 }); x.restore();
  } });
  hand.position.z = .002; mold.add(moldS, hand);
  // 面粉扬尘
  const dust = S.add(sheet({ U, w: .24, h: .24, z: -.045, trans: .6, shadow: false, recv: false, finish: { rim: 0, under: 0, grain: false }, draw: x => {
    const R2 = mulberry(8); x.fillStyle = '#fbf6ea';
    for (let i = 0; i < 260; i++) { const a = R2() * TAU, rr = .045 + Math.pow(R2(), 1.5) * .07; x.beginPath(); x.arc(Math.cos(a) * rr, Math.sin(a) * rr, .0006 + R2() * .0014, 0, TAU); x.fill(); }
  } }));
  dust.material.transparent = true; dust.material.alphaToCoverage = false; dust.material.depthWrite = false; dust.material.alphaTest = .01;

  const tHit = E.word('L04', 13) + .02;   // “啪”
  const tLift = E.cue('L05') - .25, tBake = E.cue('L05') + .35, tYuan = E.word('L05', 8);
  return {
    S,
    update(t) {
      // 揉面（面皮起伏旋转）→ 馅球落下 → 包成圆团
      const kn = seg(t, 0, .9), wrap = ss(seg(t, 1.05, 1.45));
      sheetD.rotation.z = .6 * Math.sin(t * 3) * (1 - wrap); sheetD.scale.set((1 + .05 * Math.sin(t * 11) * (1 - kn * .5)) * lerp(1, .6, wrap), (1 - .05 * Math.sin(t * 11)) * lerp(1, .6, wrap), 1);
      const drop = eio(seg(t, .6, 1.05)); fill.position.set(0, 0, lerp(.12, -.051, drop)); fill.visible = t > .55 && wrap < .5; fill.scale.setScalar(lerp(1, .8, wrap));
      sheetD.visible = wrap < .98; dough.visible = wrap > .5; dough.scale.setScalar(lerp(.9, 1, ss(seg(t, 1.2, 1.6))) * (1 + .02 * Math.sin(t * 7)));
      // 木模：入画 → 悬停 → 啪 → 停 → 抬起
      const inK = eo(seg(t, 1.5, tHit - .35)), slam = ei(seg(t, tHit - .12, tHit)), lift = eio(seg(t, tLift, tLift + .7));
      let mz = lerp(.26, .05, inK); mz = lerp(mz, -.0475, slam); mz = lerp(mz, .3, lift);
      mold.position.set(lerp(.09, 0, inK) + lift * .12, lerp(.07, 0, inK) + lift * .1, mz);
      mold.rotation.z = lerp(.25, 0, inK) + lift * .2;
      mold.visible = t > 1.45 && lift < .99;
      const hit = t >= tHit;
      if (hit) dough.visible = sheetD.visible = fill.visible = false; paleC.visible = cake.visible = hit;
      // 扬尘
      const dk = seg(t, tHit, tHit + 1.1); dust.visible = hit && dk < 1; dust.scale.setScalar(.7 + .6 * eo(dk)); dust.material.opacity = .9 * (1 - dk);
      // 烘烤：面团白 → 金；金属感逐渐出现
      const bk = ss(seg(t, tBake, tBake + 1.4));
      const rr = bk * .05; cake.material.userData.u.uClip.value.set(0, 0, rr, 0); paleC.material.userData.u.uClip.value.set(0, 0, rr, 1);
      // 主光扫过（“圆”字时闪一下）
      const sweep = seg(t, tYuan - .5, tYuan + .9);
      S.key.position.set(lerp(-.14, .16, sweep), .22, .32); S.key.intensity = S.base.key * (1 + .25 * Math.exp(-Math.pow((t - tYuan - .2) / .25, 2)));
      // 镜头：俯视，砸下时震一下，揭开后慢推
      const shake = hit ? .0025 * Math.exp(-(t - tHit) * 9) * Math.sin((t - tHit) * 70) : 0;
      const push = eio(seg(t, tLift, E.dur));
      const z = lerp(.36, .21, push) - (t < tHit ? .02 * seg(t, 0, tHit) : 0);
      aim(S.cam, [.012 + shake, -.02 + shake * .6, z, 0, lerp(-.004, 0, push), -.052], t, { roll: lerp(.08, -.05, eio(clamp(t / E.dur))) });
    },
    post(t) { return { focus: S.cam.position.z + .052, aper: 12, maxCoc: 16, bloom: { strength: .3, radius: .5, threshold: 1.3 } }; },
    grade() { return { expo: 1.0, vig: .5, sat: 1.04, contrast: .12, lift: [.012, .006, 0], gain: [1.03, 1, .95] }; },
  };
}
