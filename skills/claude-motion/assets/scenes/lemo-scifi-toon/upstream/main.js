// Coffee Run — Sci-Fi Sitcom Toon 风格 demo
import { clamp, lerp, seg, ss, eo, ei, eio, back, spring, hash, TAU } from '/core/lib.js';
import { W, H, INK, init, frame, g, push, pop, translate, rotate, scale, shape, fillOnly, stroke, ell, arc, rr, rect, spline, dot, text, screenRect, S, noodle, reset } from './toon.js';
import { vask, gary, coffeeCup, PAL } from './chars.js';
import * as Wd from './worlds.js';
import { DUR, q, VO, SHOTS, shotAt, WIPES, TAGS, T, CUES, CREDITS } from './story.js';

init(document.getElementById('c'));
const J = async f => { try { const r = await fetch(f); if (r.ok) return await r.json(); } catch (e) { } return null; };
const LINES = await J('lines.json'), DURS = (await J('voices/dur.json')) || {}, LIPS = (await J('voices/lips.json')) || {};
const LINE = Object.fromEntries(LINES.map(l => [l.id, l]));
const vdur = id => DURS[id] ?? LINE[id].text.length * .07;

// —— 口型：说话人当前句的张合（12fps 步进）——
function talk(who, t) {
  const tq = q(t);
  for (const [id, t0] of Object.entries(VO)) {
    const L = LINE[id]; if (L.who !== who) continue;
    if (tq >= t0 && tq < t0 + vdur(id)) {
      const k = Math.floor((tq - t0) * 24), lp = LIPS[id];
      const o = lp ? (lp.o[k] ?? 0) : .5 * (1 + Math.sin(tq * 20)) / 2, b = lp ? (lp.b[k] ?? .5) : .5;
      return { o, w: .8 + .45 * b - .2 * o, talking: true };
    }
  }
  return { o: 0, w: 1, talking: false };
}
const blinkAt = (t, list, d = .12) => list.some(b => t >= b && t < b + d);
const garyBlinks = t => { const k = Math.floor(t * 12); return hash(Math.floor(k / 26) * 7.1) > .4 && k % 26 === 0 || k % 26 === 1 && hash(Math.floor(k / 26) * 7.1) > .4; };

// 传送门弹开：轻微过冲（~12%），不盖住角色
const popOpen = x => x <= 0 ? 0 : back(clamp(x / .32), 1.7);
// —— 镜头 ——
function cam(cx, cy, z, rot = 0, shake = 0, t = 0) {
  reset(); translate(W / 2, H / 2);
  if (shake) { const f = Math.floor(t * 24); translate((hash(f) - .5) * shake * 2, (hash(f + 77) - .5) * shake * 2); }
  scale(z); if (rot) rotate(rot); translate(-cx, -cy);
}
const walk = (t, t0, t1, a, b) => lerp(a, b, ss(seg(t, t0, t1)));
const legsWalk = (tq, on, amp = 22) => on ? [[Math.sin(tq * 12) * amp, -Math.max(0, Math.cos(tq * 12)) * 14], [-Math.sin(tq * 12) * amp, -Math.max(0, -Math.cos(tq * 12)) * 14]] : [[0, 0], [0, 0]];
// 弹跳落地挤压
const landSq = (t, tl) => { const u = t - tl; if (u < 0 || u > .5) return 1; return 1 - .22 * Math.exp(-u * 9) * Math.cos(u * 30); };
// 从 a 抛物线飞到 b
const arcPos = (t, t0, t1, a, b, h) => { const u = clamp((t - t0) / (t1 - t0)); return [lerp(a[0], b[0], u), lerp(a[1], b[1], u) - Math.sin(u * Math.PI) * h]; };

// —— Vask / Gary 的默认姿态 ——
const VX = 1180, GX = 760, FLOOR = 900;
const armRest = { R: { h: [22, 168], bend: 18 }, L: { h: [-22, 168], bend: -18 } };
function V(t, o = {}) {
  const m = talk('VASK', t);
  const tq = q(t);   // 呼吸 + 说话时的点头（12fps）
  return { x: VX, y: FLOOR, s: 1, face: -1, lid: .47, look: [0, 0], armR: armRest.R, armL: armRest.L, mouth: { o: m.o, w: m.w, sm: -.35 }, sq: 1 + .008 * Math.sin(tq * 2.3), headTilt: .12 + (m.talking ? (m.o - .3) * .07 : 0), ...o };
}
function G(t, o = {}) {
  const m = talk('GARY', t);
  const tq = q(t);
  return { x: GX, y: FLOOR, s: 1, face: 1, t, nerv: .4, look: [.5, -.2], blink: garyBlinks(t), mouth: { o: m.o * 1.15, w: m.w, sm: -.5 }, armR: { h: [-44, 76], bend: 20 }, armL: { h: [44, 76], bend: -20 }, sq: 1 + .012 * Math.sin(tq * 3.1), headTilt: m.talking ? (m.o - .3) * .1 : Math.sin(tq * 1.7) * .03, ...o };
}
const withMouth = (P, sm) => { P.mouth = { ...P.mouth, sm }; return P; };

// —— 世界 ——
function world(name, t, o = {}) {
  if (name === 'lab') Wd.lab(t, o);
  else if (name === 'jelly') Wd.jelly(t, o);
  else if (name === 'mug') Wd.mugWorld(t);
  else if (name === 'teeth') Wd.teethWorld(t);
  else if (name === 'pigeon') Wd.pigeonWorld(t);
  else if (name === 'vasks') Wd.vaskCafe(t, o);
  else if (name === 'normal') Wd.normalCafe(t);
}
// 被传送门吸进去：往门中心压扁缩小
function sucked(P, t, t0, t1, px, py) {
  const u = ei(seg(t, t0, t1)); if (u <= 0) return P;
  return { ...P, x: lerp(P.x, px, u), y: lerp(P.y, py + 200, u), s: (P.s ?? 1) * (1 - u * .95), sq: 1 + u * .6, lean: (P.lean || 0) + u * .4 };
}
// 从传送门吐出来：飞行 + 落地挤压
function spit(P, t, t0, tl, from, h = 160) {
  if (t < t0) return null;
  if (t < tl) { const [x, y] = arcPos(t, t0, tl, from, [P.x, P.y], h); const u = seg(t, t0, tl); return { ...P, x, y, sq: 1.25 - u * .25, lean: (P.lean || 0) + (1 - u) * .5 * (P.face || 1), s: (P.s ?? 1) * lerp(.4, 1, eo(u * 2)), armR: { h: [60, -150], bend: 30 }, armL: { h: [-60, -150], bend: -30 } }; }
  return { ...P, sq: landSq(t, tl) };
}

// ———————————————————— 镜头 ————————————————————
const SH = {};
SH.pot = (t, tq) => {
  cam(330, 470, lerp(2.15, 2.4, ss(seg(t, 0, 2.3))));
  world('lab', t, { drip: (t - T.drip) / .6, potDrops: 1 });
};
SH.two = (t, tq) => {
  cam(lerp(990, 970, seg(t, 2.3, 5.6)), 560, 1.28);
  world('lab', t, { potDrops: 1 });
  const gx = walk(tq, T.enter, T.enter + .55, 380, GX);
  const tw = T.twitch.find(a => t >= a && t < a + .45);
  vask(V(t, { holdR: 'mug', armR: { h: [40, 100], bend: 44 }, look: [.1, .45], twitch: tw ? t - tw : 0, lid: .5 }));
  const walking = tq < T.enter + .55;
  gary(G(t, { x: gx, legL: legsWalk(tq, walking)[0], legR: legsWalk(tq, walking)[1], look: [.6, -.5], lean: walking ? .08 : 0, armR: walking ? { h: [30, 80], bend: 10 } : { h: [-40, 70 + Math.sin(tq * 9) * 6], bend: 20 }, armL: walking ? { h: [-30, 80], bend: -10 } : { h: [40, 70 - Math.sin(tq * 9) * 6], bend: -20 } }));
};
SH.vCU1 = (t, tq) => {
  cam(1150, 440, 2.5);
  world('lab', t, { potDrops: 1 });
  const lk = tq > 5.8 ? [-.1, .1] : [.1, .45];   // 眼珠转向 Gary（脸不动）
  gary(G(t, { x: GX - 60 }));
  vask(V(t, { holdR: 'mug', armR: { h: [40, 100], bend: 44 }, look: lk, lid: .52, brow: -.2 }));
};
SH.gCU1 = (t, tq) => {
  cam(GX + 10, 610, 2.45);
  world('lab', t, { potDrops: 1 });
  const gulp = seg(tq, T.gulp - .1, T.gulp + .3);
  gary(G(t, { nerv: .9, sweat: seg(t, 6.8, 7.9) * .99, look: [.7, -.6], pupil: 2.8, blink: blinkAt(tq, [6.75, 7.45], .09), mouth: { o: 0, w: gulp > 0 && gulp < 1 ? .5 : .8, sm: -.8 }, sq: 1 - Math.sin(gulp * Math.PI) * .04, armR: { h: [-44, 60], bend: 20 }, armL: { h: [44, 60], bend: -20 } }));
};
SH.vCU2 = (t, tq) => {
  cam(1175, 470, 1.95);
  world('lab', t, { potDrops: 1 });
  // 预备动作：先微沉，再抬起遥控器
  const up = ss(seg(tq, T.raise + .08, T.raise + .4)), dip = Math.sin(seg(tq, T.raise - .05, T.raise + .12) * Math.PI);
  const press = tq >= T.press && tq < T.press + .2 ? 1 : 0;
  vask(V(t, { holdR: 'remote', armR: { h: [lerp(30, 95, up), lerp(170 + dip * 10, -30, up)], bend: 40, ra: .1 }, look: [-.2, .1], lid: .5, press, holdL: 'mug', armL: { h: [-10, 120], bend: -30 }, bob: dip * 6 }));
};
SH.open = (t, tq) => {
  const sh = t < T.burst + .45 ? 14 * (1 - seg(t, T.burst, T.burst + .45)) * (t > T.burst ? 1 : 0) : 0;
  cam(960, 540, lerp(1.02, 1.08, seg(t, 9.5, 12.6)), 0, sh, t);
  world('lab', t, { green: seg(t, T.burst, T.burst + .2) });
  const op = t < T.burst ? 0 : popOpen(t - T.burst);
  Wd.portal(960, 610, 250, t, { open: op });
  // Gary 吓一跳往后蹦
  const hop = seg(tq, T.burst + .05, T.burst + .45);
  let gp = G(t, { x: 560 - eo(hop) * 60, y: FLOOR - Math.sin(hop * Math.PI) * 70, nerv: 1, look: [.7, 0], sweat: t * 1.3, eyeS: 1.15, pupil: 2.6, armR: hop > 0 && hop < 1 ? { h: [50, -120], bend: 30 } : { h: [-40, 60], bend: 20 }, armL: hop > 0 && hop < 1 ? { h: [-50, -120], bend: -30 } : { h: [40, 60], bend: -20 } });
  // Gary 看镜头（打破第四面墙），然后跳进去
  if (tq >= T.garyLook && tq < T.garyIn) gp = { ...gp, look: [0, 0], face: 1, mouth: { o: 0, w: .6, sm: -.9 } };
  if (tq >= T.garyIn) { const u = seg(tq, T.garyIn, T.garyIn + .3); gp = { ...gp, x: lerp(500, 960, u), y: FLOOR - Math.sin(u * Math.PI) * 180, lean: .6, sq: 1.2, armR: { h: [80, -60], bend: 20 }, armL: { h: [60, -80], bend: -20 } }; gp = sucked(gp, t, T.garyIn + .15, T.garyIn + .33, 960, 610); }
  // Vask：端着空杯，面无表情地走进门
  let vp = V(t, { x: 1360, holdR: 'remote', armR: { h: [60, 60], bend: 40 }, holdL: 'mug', armL: { h: [-10, 120], bend: -30 }, look: [.4, .1] });
  if (tq > T.vaskIn - .6) { const walking = tq < T.vaskIn + .1; vp.x = walk(tq, T.vaskIn - .6, T.vaskIn + .1, 1360, 1080); [vp.legL, vp.legR] = legsWalk(tq, walking, 18); }
  vp = sucked(vp, t, T.vaskIn + .1, T.vaskIn + .35, 960, 610);
  if (tq < T.vaskIn + .35) vask(vp);
  if (tq < T.garyIn + .33) gary(gp);
};
SH.rush = (t) => {
  const u = ei(seg(t, 12.6, 12.85));
  cam(960, 610, lerp(1.08, 7, u));
  world('lab', t, { green: 1 });
  Wd.portal(960, 610, 250, t);
};
// —— 果冻宇宙 ——
SH.jWide = (t, tq) => {
  cam(960, 560, 1.0);
  world('jelly', t);
  Wd.blobby(1160, 700, .95, t, { look: [-.6, .4] }); Wd.jellyCounter(t);
  const op = t < T.jClose ? popOpen(t - 12.85) : 1 - ei(seg(t, T.jClose, T.jClose + .3));
  Wd.portal(300, 330, 150, t, { open: op });
  const v = spit(V(t, { x: 720, y: 1010, face: 1, holdR: 'remote', armR: { h: [60, 80], bend: 40 }, holdL: 'mug', armL: { h: [-10, 120], bend: -30 }, look: [.6, .1] }), tq, T.jSpitV, T.jLandV, [300, 330], 120);
  const gq = spit(G(t, { x: 430, y: 1010, look: [.3, -.2], nerv: 1, eyeS: 1.1 }), tq, T.jSpitG, T.jLandG, [300, 330], 90);
  if (gq) { const w = seg(t, T.jLandG, T.jLandG + 1.2); gq.sq = gq.sq * (1 + Math.sin(w * 40) * .06 * (1 - w)); gary(gq); }
  if (v) vask(v);
};
SH.jCounter = (t, tq) => {
  cam(930, 560, 1.18);
  world('jelly', t);
  const gl = seg(tq, T.glorp - .1, T.glorp + .35);
  Wd.blobby(1160, 700, .95, t, { look: [-.7, .3], o: Math.sin(gl * Math.PI) });
  Wd.jellyCounter(t);
  // 杯子滑到吧台上
  const su = eo(seg(tq, T.slide[0], T.slide[1]));
  if (tq >= T.slide[0]) Wd.jellyCup(lerp(1040, 830, su), 700, .42, t, { blink: 0 });
  vask(V(t, { x: 640, y: 1030, face: 1, holdR: 'remote', armR: { h: [40, 110], bend: 40 }, holdL: 'mug', armL: { h: [60, 60], bend: -30 }, look: [.8, -.1], lid: .5 }));
  gary(G(t, { x: 360, y: 1040, look: [.8, -.3], nerv: .8, sweat: t, eyeS: 1.08 }));
};
SH.jCup = (t, tq) => {
  cam(830, 610, 3.3 + seg(t, 17.6, 18.8) * .2);
  world('jelly', t);
  Wd.blobby(1160, 700, .95, t, { look: [-.7, .3] });
  Wd.jellyCounter(t);
  const b = seg(tq, T.eyeBlink, T.eyeBlink + .25), lid = b > 0 && b < 1 ? Math.sin(b * Math.PI) : 0;
  Wd.jellyCup(830, 700, .42, t, { blink: lid });
};
SH.jReact = (t, tq) => {
  cam(960, 600, 1.4);
  world('jelly', t, { counter: false });
  const op = t < T.jClick + .02 ? 0 : popOpen(t - T.jClick);
  Wd.portal(960, 640, 200, t, { open: op });
  const back = seg(tq, T.jBack[0], T.jBack[1]);
  const vm = talk('VASK', t);
  let vp = V(t, { x: 1110, y: 1010, face: -1, holdR: 'remote', armR: { h: [60, 60], bend: 40 }, holdL: 'mug', armL: { h: [-10, 120], bend: -30 }, look: [0, 0], lid: .55, press: tq >= T.jClick && tq < T.jClick + .15 ? 1 : 0 });
  let gp = G(t, { x: 800, y: 1010, face: 1, look: [0, 0], nerv: 1, eyeS: 1.2, pupil: 2.4, sweat: t, mouth: { o: talk('GARY', t).o * 1.2, w: .9, sm: -.9 } });
  if (back > 0) { vp = sucked({ ...vp, x: lerp(1110, 1040, back), legL: legsWalk(tq, back < 1)[0], legR: legsWalk(tq, back < 1)[1] }, t, T.jBack[0] + .25, T.jBack[1], 960, 640); gp = sucked({ ...gp, x: lerp(800, 880, back), legL: legsWalk(tq, back < 1)[0], legR: legsWalk(tq, back < 1)[1] }, t, T.jBack[0] + .3, T.jBack[1], 960, 640); }
  if (tq < T.jBack[1]) { gary(gp); vask(vp); }
};
// —— 马克杯宇宙 ——
SH.mWide = (t, tq) => {
  cam(960, 560, 1.0);
  world('mug', t);
  Wd.umbrella(1420, 760, .9, '#3fb5a8'); Wd.table(1420, 900, 1.1);
  Wd.mugGuy(1230, 900, .75, t, { sip: 1, look: [.5, 0], col: '#f3ecff' }); Wd.glassGuy(1560, 752, .55, t, { level: .9 }); Wd.straw([1225, 818], [1552, 700]);
  Wd.umbrella(160, 740, .7, '#ffd23c');
  Wd.mugGuy(1780, 880, .6, t, { sip: 0, look: [-.8, 0], col: '#d8f0ff', lid: .3 });
  const op = t < 22.0 ? popOpen(t - 20.9) : 1 - ei(seg(t, 22.0, 22.3));
  Wd.portal(380, 560, 170, t, { open: op });
  const v = spit(V(t, { x: 820, y: 1000, face: 1, holdR: 'remote', armR: { h: [60, 80], bend: 40 }, holdL: 'mug', armL: { h: [-10, 120], bend: -30 }, look: [.7, 0] }), tq, T.mSpit, T.mSpit + .4, [380, 560], 90);
  const gq = spit(G(t, { x: 560, y: 1010, look: [.8, -.1], nerv: 1 }), tq, T.mSpit + .2, T.mSpit + .6, [380, 560], 80);
  if (gq) gary(gq); if (v) vask(v);
};
SH.mSip = (t, tq) => {
  cam(1400, 690, 2.05);
  world('mug', t);
  Wd.umbrella(1420, 760, .9, '#3fb5a8'); Wd.table(1420, 900, 1.1);
  const turn = ss(seg(tq, T.mTurn, T.mTurn + .25)), lk = seg(tq, T.lick[0], T.lick[1]);
  const sipping = tq < T.sip[1];
  Wd.mugGuy(1230, 900, .75, t, { sip: sipping ? 1 : 0, look: [lerp(.5, -.1, turn), lerp(0, .2, turn)], turn: turn * .4, lick: lk > 0 && lk < 1 ? Math.sin(lk * Math.PI) : 0, lid: lerp(.45, .6, turn), col: '#f3ecff' });
  Wd.glassGuy(1560, 752, .55, t, { level: lerp(.9, .55, seg(tq, T.sip[0], T.sip[1])), page: seg(tq, T.page, T.page + .35), wave: tq >= T.wave[0] && tq < T.wave[1] ? 1 : 0 });
  Wd.straw([1225 + turn * 22, 818], [1552, 700]);
};
SH.gScream = (t, tq) => {
  const shk = t > T.guyShake && t < T.guyShake + .5 ? 10 : 0;
  cam(560, 680, 2.2, 0, shk, t);
  world('mug', t);
  const m = talk('GARY', t);
  const big = t > T.guyShake ? 1.35 : 1.2;
  gary(G(t, { x: 560, y: 1010, look: [.2, -.1], nerv: 1.3, eyeS: big, pupil: 2.2, sweat: t * 1.6, mouth: { o: Math.min(1, m.o * 1.35), w: m.w * 1.1, sm: -1 }, armR: { h: [130, -60], bend: -20 }, armL: { h: [-40, -110], bend: 30 }, brow: 1.4, mouthS: t > T.guyShake ? 1.9 : 1.5 }));
};
SH.vNope = (t, tq) => {
  cam(840, 445, 2.35);
  world('mug', t);
  vask(V(t, { x: 820, y: 1000, face: 1, holdR: 'remote', armR: { h: [70, 40], bend: 40 }, holdL: 'mug', armL: { h: [-10, 120], bend: -30 }, look: [0, 0], lid: .56, press: tq >= T.mClick ? 1 : 0, blink: blinkAt(tq, [27.15], .09) }));
};
// —— 蒙太奇：每宇宙 1 秒 ——
function montageDuo(t, tq, tc, click, px = 300) {
  const op = popOpen(t - tc + .1);
  Wd.portal(px, 620, 190, t, { open: Math.min(1, op) });
  gary(G(t, { x: px + 130, y: 1010, look: [.8, -.1], nerv: 1.2, eyeS: 1.2, pupil: 2.4, sweat: t * 2 }));
  vask(V(t, { x: px + 360, y: 1000, face: 1, holdR: 'remote', armR: { h: [90, 30], bend: 40 }, holdL: 'mug', armL: { h: [-10, 120], bend: -30 }, look: [.6, 0], lid: .56, press: tq >= click ? 1 : 0 }));
}
SH.teeth = (t, tq) => {
  cam(960, 560, lerp(1.0, 1.06, seg(t, 28.4, 29.4)));
  world('teeth', t);
  Wd.molar(lerp(1500, 1300, seg(t, 28.3, 29.4)), 990, 1.05, t, { chomp: Math.abs(Math.sin(t * 14)) });
  montageDuo(t, tq, 28.4, T.montClick[0]);
};
SH.pigeon = (t, tq) => {
  cam(960, 560, lerp(1.0, 1.06, seg(t, 29.4, 30.4)));
  world('pigeon', t);
  shape(rr(1050, 800, 700, 260, 16), { fill: '#b8b2a6', lw: 7, shade: () => fillOnly(rect(1050, 800, 700, 26), '#d8d2c6', { boil: .3 }) });
  Wd.pigeon(1360, 812, 1.15, t);
  montageDuo(t, tq, 29.4, T.montClick[1]);
};
SH.vasks = (t, tq) => {
  cam(960, 560, lerp(1.0, 1.05, seg(t, 30.4, 31.4)));
  Wd.vaskCafe(t, { seats: false });
  montageDuo(t, tq, 30.4, T.montClick[2]);
  // 一排 Vask 齐刷刷转头
  const turn = tq >= T.vasksTurn;
  for (let i = 0; i < 4; i++) vask(V(t, { x: 1080 + i * 210, y: 960 + (i % 2) * 20, s: .72, face: -1, holdR: 'mug', armR: { h: [40, 100], bend: 44 }, look: turn ? [-.9, 0] : [.8, .3], lid: .5, mouth: { o: 0, sm: -.35 } }));
};
// —— 正常宇宙 ——
SH.nWide = (t, tq) => {
  cam(1000, 560, 1.02);
  world('normal', t);
  const hu = ss(seg(tq, T.hand[0], T.hand[1])), hb = tq >= T.take ? 1 - ss(seg(tq, T.take, T.take + .3)) : hu;
  const hp = Wd.barista(860, 640, 1, t, { arm: hb });
  Wd.cafeCounter(t);
  if (tq < T.take) coffeeCup(hp[0] + 14, hp[1] + 40, .55, {});
  const op = t < T.nClose ? 1 : 1 - ei(seg(t, T.nClose, T.nClose + .3));
  Wd.portal(1700, 620, 180, t, { open: op });
  const took = tq >= T.take;
  vask(V(t, { x: 1250, y: 1010, face: -1, holdR: took ? 'cup' : 'remote', cupP: {}, armR: took ? { h: [70, 60], bend: 40 } : { h: [50, 90], bend: 40 }, holdL: took ? 'remote' : 'mug', armL: { h: [-10, 120], bend: -30 }, look: [.5, 0], lid: .47 }));
  gary(G(t, { x: 1520, y: 1030, face: -1, look: [.6, -.1], nerv: .6 }));
};
SH.nTwo = (t, tq) => {
  cam(1380, 560, 1.6);
  world('normal', t);
  const hp = Wd.barista(860, 640, 1, t, { arm: 0 });
  Wd.cafeCounter(t);
  const relief = tq < 34.9, m = talk('GARY', t);
  gary(G(t, { x: 1560, y: 1030, face: -1, nerv: relief ? .1 : .6, look: relief ? [.3, -.3] : [.95, .1], lid: relief ? .35 : .45, mouth: { o: m.o, w: m.w, sm: relief ? .6 : -.3 }, blink: relief && tq > 34.1 && tq < 34.5, armR: relief ? { h: [-60, 30], bend: 20 } : { h: [-44, 76], bend: 20 } }));
  const clk = tq >= T.nClick;
  vask(V(t, { x: 1250, y: 1010, face: -1, holdR: 'cup', cupP: {}, armR: { h: [70, 60], bend: 40 }, holdL: 'remote', armL: { h: clk ? [-60, 40] : [-10, 120], bend: -30 }, look: [-.6, 0], lid: .5 }));
};
// —— 回到实验室 ——
SH.lReturn = (t, tq) => {
  cam(960, 540, 1.0);
  world('lab', t, { green: t < T.lClose[1] ? 1 - seg(t, T.lClose[0], T.lClose[1]) : 0 });
  const op = t < T.lClose[0] ? popOpen(t - 36.05) : 1 - ei(seg(t, T.lClose[0], T.lClose[1]));
  Wd.portal(960, 610, 230, t, { open: op });
  const v = spit(V(t, { holdR: 'cup', cupP: {}, armR: { h: [70, 60], bend: 40 }, holdL: 'remote', armL: { h: [-10, 120], bend: -30 }, look: [.1, .3] }), tq, T.lSpit, T.lLandV, [960, 610], 110);
  const gq = spit(G(t, { x: 640, nerv: .8, look: [.6, -.2] }), tq, T.lSpit + .15, T.lLandG, [960, 610], 90);
  if (gq) gary(gq); if (v) vask(v);
};
// 杯子在 Vask 手里的世界坐标（与 chars.js 的 drawArm 同一套几何）
function cupWorld(P) {
  const s = P.s ?? 1, f = P.face ?? 1, lean = P.lean ?? .06, sh = [52, -332], h = P.armR.h;
  let x = sh[0] + h[0] + 4, y = sh[1] + h[1] + 34;
  const c = Math.cos(lean), sn = Math.sin(lean); [x, y] = [x * c - y * sn, x * sn + y * c];
  return [P.x + x * s * f, P.y + y * s];
}
SH.vSip = (t, tq) => {
  cam(1150, 440, 2.15);
  world('lab', t);
  const up = ss(seg(tq, T.cupUp, T.sipL[0])), down = ss(seg(tq, T.sipL[1], T.sipL[1] + .3));
  const a = up * (1 - down);
  const bliss = tq >= T.sipL[0] + .2;
  vask(V(t, { holdR: 'cup', cupP: {}, armR: { h: [lerp(70, 44, a), lerp(60, -22, a)], bend: 40 }, closed: bliss, brow: bliss ? .7 : 0, lid: .47, mouth: { ...talk('VASK', t), sm: bliss ? .5 : -.35 }, headTilt: bliss ? -.02 : .12 }));
};
function cupShot(t, tq, o) {
  const P = V(t, { holdR: 'cup', armR: { h: [70, 60], bend: 40 } });
  P.cupP = o;
  const [cx, cy] = cupWorld(P);
  cam(cx, cy - 55, 4.2);
  world('lab', t);
  vask(P);
}
SH.cupHi = (t, tq) => {
  const r = ss(seg(tq, T.rise[0], T.rise[1])), e = seg(tq, T.eyesOpen, T.eyesOpen + .15);
  const bub = tq >= T.bubble && tq < T.rise[0] ? .1 : 0;
  cupShot(t, tq, { rise: Math.max(r, bub), eyes: e, o: talk('COFFEE', t).o, arms: seg(tq, 41.5, 41.8), t, look: [0, -.2] });
};
SH.gAlive = (t, tq) => {
  cam(700, 600, 2.3, 0, 3, t);
  world('lab', t);
  gary(G(t, { x: 700, nerv: 1.5, eyeS: 1.3, pupil: 2.1, look: [.8, -.2], sweat: t * 1.8, armR: { h: [135, -50], bend: -20 }, armL: { h: [-50, -100], bend: 30 }, brow: 1.5, mouthS: 1.6, mouth: { o: Math.min(1, talk('GARY', t).o * 1.3), w: 1, sm: -1 } }));
};
SH.stare = (t, tq) => {
  const P = V(t, { holdR: 'cup', armR: { h: [150, -40], bend: 50 }, look: [1, .45], lid: .5, headTilt: .16 });
  P.cupP = { rise: 1, eyes: 1, look: [-.8, -.4], blink: blinkAt(tq, T.blinkC, .09), t, arms: 0 };
  cam(1085, 440, lerp(2.25, 2.7, ss(seg(t, 44.0, 46.4))));
  world('lab', t);
  vask(P);
};
SH.vDecaf = (t, tq) => {
  cam(1215, 430, lerp(2.9, 3.15, seg(t, 46.4, 48.0)));
  world('lab', t);
  vask(V(t, { holdR: 'cup', cupP: { rise: 1, eyes: 1, look: [-.8, -.4], t }, armR: { h: [150, -40], bend: 50 }, look: [1, .45], lid: lerp(.5, .6, seg(tq, 46.4, 47.5)), headTilt: .16, brow: -.3 }));
};
SH.cupYep = (t, tq) => {
  const n = seg(tq, T.nod, T.nod + .6), nod = Math.sin(n * Math.PI * 3) * .12 * (n < 1 ? 1 : 0);
  cupShot(t, tq, { rise: 1, eyes: 1, happy: tq >= T.nod ? 1 : 0, o: talk('COFFEE', t).o, a: nod, arms: .6, t });
};
SH.toss = (t, tq) => {
  cam(1060, 560, 1.22);
  world('lab', t, { green: seg(t, T.tOpen, T.tOpen + .2) * .8 });
  const op = t < T.tOpen ? 0 : popOpen(t - T.tOpen);
  Wd.portal(1700, 600, 200, t, { open: op });
  // 杯子被反手扔到身后，飞进传送门
  const pre = seg(tq, T.toss - .2, T.toss), fl = seg(tq, T.toss, T.toss + .12);
  let armR = { h: [70, 60], bend: 40 };
  if (tq < T.toss) armR = { h: [lerp(70, 50, pre), lerp(60, 120, pre)], bend: 40 };
  else if (tq < T.toss + .5) armR = { h: [lerp(50, -60, eo(fl)), lerp(120, -150, eo(fl))], bend: -20 };
  else armR = { h: [lerp(-60, 30, seg(tq, T.toss + .5, T.toss + .9)), lerp(-150, 160, seg(tq, T.toss + .5, T.toss + .9))], bend: 20 };
  const holding = tq < T.toss + .06;
  const turned = tq >= T.turnG;
  const clicked = tq >= T.tClick;
  const vp = V(t, { x: 1180, face: turned ? -1 : -1, holdR: holding ? 'cup' : null, cupP: { rise: 1, eyes: 1, happy: 1, t, arms: .6 }, armR, holdL: 'remote', armL: { h: clicked && tq < T.tClick + .6 ? [-70, 20] : [-10, 120], bend: -30 }, press: clicked && tq < T.tClick + .15 ? 1 : 0, look: turned ? [.6, .1] : [-.3, .2], lid: .5 });
  vask(vp);
  if (!holding && tq < T.tossLand + .05) {   // 飞行中的杯子（旋转 + 小手举起 "wheee"）
    const [x, y] = arcPos(t, T.toss + .06, T.tossLand, [1190, 470], [1700, 600], 260);
    const u = seg(t, T.toss + .06, T.tossLand);
    coffeeCup(x, y + 60, .55 * (1 - u * .6), { rise: 1, eyes: 1, happy: 1, arms: 1, t, a: u * 7 });
  }
  const sag = ss(seg(tq, T.sag, T.sag + .5));
  gary(G(t, { x: 650, nerv: .5 * (1 - sag), look: [.7, -.2 + sag * .4], lid: sag * .4, sq: 1 - sag * .05, lean: sag * .1, mouth: { o: 0, sm: -1, w: .7 }, armR: { h: [0, 110], bend: 10 }, armL: { h: [0, 110], bend: -10 }, sweat: sag > 0 ? t : null }));
};

// ———————————————————— 屏幕层 ————————————————————
function wipe(t) {
  for (const [tc, hw] of WIPES) {
    const d = Math.abs(t - tc); if (d > hw) continue;
    const u = 1 - d / hw, R = 1350 * Math.pow(u, .6);
    reset(); Wd.portal(960, 540, R, t, { open: 1, sx: 1, spin: 2.2 });
    if (d < .03) screenRect('#dcffa8', .7);
  }
}
// 宇宙标签：复古终端读数，逐字打出
function tag(t) {
  for (const [a, b, id, desc, bg, fg] of TAGS) {
    if (t < a || t >= b) continue;
    const u = t - a, n = Math.floor(u * (b - a < 1.5 ? 110 : 40)), s1 = id.slice(0, n), s2 = desc.slice(0, Math.max(0, n - id.length));
    reset(); translate(0, 0);
    const pop_ = back(seg(t, a, a + .18), 2.2);
    push(); translate(70, 62); scale(pop_);
    g.font = '400 58px VT323'; const w1 = Math.max(g.measureText(id).width, g.measureText(desc).width * 40 / 58 * 1.2) + 60;
    shape(rr(0, 0, Math.max(360, w1), 118, 12), { fill: bg, lw: 7 });
    text('▶ ' + s1 + (n < id.length && Math.floor(t * 6) % 2 ? '█' : ''), 24, 38, { font: '400 54px VT323', fill: fg, align: 'left' });
    text(s2, 26, 86, { font: '400 40px VT323', fill: fg, align: 'left' });
    pop();
  }
}
// 字幕：粗圆体白字 + 厚黑边 + 说话人色块（也在 boil）
const WHO_COL = { VASK: '#2a9d8f', GARY: '#ef5b3f', COFFEE: '#8a5431' };
const WORLD_CUTS = [12.85, 20.9, 28.4, 29.4, 30.4, 31.4, 36.05, 44.0, 53.0];   // 44.0：冷场要干净的画面
const SUBS = Object.entries(VO).map(([id, t0]) => {
  const L = LINE[id], text_ = L.sub || L.text, d = vdur(id);
  let t1 = t0 + Math.max(d + .35, .9 + text_.length / 17);
  const cut = WORLD_CUTS.find(c => c > t0 + .1); if (cut && t1 > cut) t1 = Math.max(cut - .02, t0 + d + .2);
  return { id, t0, t1, who: L.who, text: text_ };
});
// 太长的句子拆成两行（在中点附近的空格处断开）
function wrapSub(str) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.font = '800 50px "Baloo 2"';
  if (g.measureText(str).width < 1300) return [str];
  const mid = str.length / 2; let best = -1;
  for (let i = 0; i < str.length; i++) if (str[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return [str.slice(0, best), str.slice(best + 1)];
}
function subs(t) {
  const act = SUBS.filter(s => t >= s.t0 && t < s.t1).slice(-2);
  let y = H - 92;
  for (let i = act.length - 1; i >= 0; i--) {
    const s = act[i], a = i === act.length - 1 ? 1 : .7, lines = wrapSub(s.text);
    const pop_ = back(seg(t, s.t0, s.t0 + .12), 2);
    g.setTransform(1, 0, 0, 1, 0, 0); g.font = '800 50px "Baloo 2"';
    const tw = Math.max(...lines.map(l => g.measureText(l).width)); g.font = '800 26px "Baloo 2"'; const nw = g.measureText(s.who).width + 34;
    const total = nw + 22 + tw, x0 = (W - total) / 2, y0 = y - (lines.length - 1) * 66;
    reset(); g.globalAlpha = a;
    push(); translate(x0 + nw / 2, y0 - 4); scale(pop_); translate(-nw / 2, 0);
    shape(rr(0, -22, nw, 44, 14), { fill: WHO_COL[s.who], lw: 5 });
    text(s.who, nw / 2, 2, { font: '800 26px "Baloo 2"', fill: '#fff' });
    pop();
    lines.forEach((l, k) => text(l, x0 + nw + 22, y0 + k * 66, { font: '800 50px "Baloo 2"', fill: '#fff', align: 'left', outlineW: 11 }));
    g.globalAlpha = 1;
    y = y0 - 84;
  }
}
function titleCard(t) {
  const [a, b] = T.title; if (t < a || t >= b) return;
  const u = seg(q(t), a, a + .25), s = u < 1 ? back(u, 2.4) : 1, out = 1 - seg(t, b - .2, b);
  reset(); translate(960, 190); scale(s * out, s);
  titleArt(t);
}
function titleArt(t, big = 1) {
  // 片名：50 年代原子时代电视片头——奶油色块状字 + 品红硬投影 + 青色轨道环，一颗咖啡豆绕字飞行（不用荧光绿、不做滴液，避开原作 logo 的联想）
  const k = big, orb = t * 1.6, rx = 560 * k, ry = 92 * k;
  const ring = (a0, a1, lw) => { const P = arc(0, 6 * k, rx, ry, a0, a1, 40); stroke(P, lw + 12, { boil: .5 }); stroke(P, lw, { line: '#5ee6ff', boil: .5 }); };
  const bean = () => { const bx = Math.cos(orb) * rx, by = 6 * k + Math.sin(orb) * ry; push(); translate(bx, by); rotate(orb + 1.2);
    shape(ell(0, 0, 26 * k, 18 * k), { fill: '#8a4b2a', lw: 6 }); stroke([[-18 * k, 3 * k], [0, -3 * k], [18 * k, 3 * k]], 4); pop(); };
  rotate(-.05);
  push(); rotate(.12); ring(Math.PI, TAU, 9 * k); if (Math.sin(orb) < 0) bean(); pop();   // 环的后半圈在字后面
  text('COFFEE RUN', 12 * k, 12 * k, { font: `400 ${150 * k}px Bungee`, fill: '#ff4fa3', outlineW: 22, outlineCol: INK });
  text('COFFEE RUN', 0, 0, { font: `400 ${150 * k}px Bungee`, fill: '#fff3d6', outlineW: 22, outlineCol: INK });
  push(); rotate(.12); ring(0, Math.PI, 9 * k); if (Math.sin(orb) >= 0) bean(); pop();   // 前半圈压在字上
  for (let i = 0; i < 4; i++) {   // 四角星闪
    const x = [-600, 610, -420, 470][i] * k, y = [-110, -95, 120, 118][i] * k, r = (16 + 10 * Math.sin(t * 5 + i * 1.7)) * k;
    shape([[x, y - r], [x + r * .28, y - r * .28], [x + r, y], [x + r * .28, y + r * .28], [x, y + r], [x - r * .28, y + r * .28], [x - r, y], [x - r * .28, y - r * .28]], { fill: '#ffe066', lw: 5 });
  }
}
function endCard(t) {
  const a = ss(seg(t, T.end, T.end + .3));
  reset(); screenRect('#241339');
  Wd.portal(960, 520, 460, t * .6, { open: spring(t - T.end, 7, .45), sx: 1 });
  screenRect('#241339', .5);
  // 片尾彩蛋：Decaf 在漩涡里打转挥手
  const k = t - T.end;
  if (k > 1.2) coffeeCup(960 + Math.sin(k * 1.3) * 70, 770 + Math.cos(k * 1.1) * 14, .56, { rise: 1, eyes: 1, happy: 1, arms: 1, t, a: Math.sin(k * 2) * .4 });
  const s = back(seg(q(t), T.end, T.end + .3), 2.2);
  reset(); translate(960, 290); scale(s); titleArt(t, 1.05);
  reset();
  const b = ss(seg(t, T.end + .5, T.end + 1));
  g.globalAlpha = b;
  text('SCI-FI SITCOM TOON', 960, 452, { font: '400 66px VT323', fill: '#ffe066', outlineW: 9 });
  text('LemoLab × Claude Opus 5.5', 960, 880, { font: '800 44px "Baloo 2"', fill: '#fff', outlineW: 8 });
  CREDITS.forEach((c, i) => text(c, 960, 948 + i * 36, { font: '700 25px "Baloo 2"', fill: 'rgba(255,255,255,.82)' }));
  g.globalAlpha = 1;
}

function render(t) {
  frame(t);
  screenRect('#000');
  const [, , name] = shotAt(t), tq = q(t);
  if (name === 'end') endCard(t);
  else SH[name](t, tq);
  wipe(t);
  titleCard(t);
  tag(t);
  subs(t);
}

// —— 音效事件（给 mix.py / score.py）——
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  for (const [id, t0] of Object.entries(VO)) add('vo', t0, { id });
  for (const c of CUES) add('cue', c.t0, c);
  // 环境声段
  let cur = null;
  for (const [a, b, , w] of SHOTS) { if (cur && cur.w === w && Math.abs(cur.b - a) < .01) cur.b = b; else { if (cur) add('amb', cur.a, { w: cur.w, d: +(cur.b - cur.a).toFixed(3) }); cur = { a, b, w }; } }
  add('amb', cur.a, { w: cur.w, d: +(cur.b - cur.a).toFixed(3) });
  add('plip', T.drip + .6);
  [2.36, 2.58, 2.8].forEach(x => add('squeak', x, { v: .5 }));
  T.twitch.forEach(x => add('tic', x));
  add('gulp', T.gulp);
  add('cloth', T.raise);
  add('click', T.press); add('portalOpen', T.burst); add('portalHum', T.burst + .1, { d: 12.85 - T.burst });
  add('boing', T.burst + .08, { v: .5 }); add('slam', T.title[0]);
  add('suck', T.vaskIn + .1); add('suck', T.garyIn + .15); add('whooshBig', 12.55);
  for (const [tc] of WIPES) add('portalWhoosh', tc - .16);
  // 果冻
  add('portalOpen', 12.9, { v: .6 }); add('pop', T.jSpitV); add('pop', T.jSpitG); add('boing', T.jLandV); add('boing', T.jLandG, { v: 1.1 }); add('portalClose', T.jClose + .25);
  add('gurgle', 15.3); add('glorp', T.glorp); add('slide', T.slide[0]); add('squish', T.slide[1]); add('wetblink', T.eyeBlink);
  add('click', T.jClick); add('portalOpen', T.jClick + .03, { v: .7 }); add('suck', T.jBack[0] + .35);
  // 马克杯
  add('pop', T.mSpit); add('thud', T.mSpit + .4); add('thud', T.mSpit + .6, { v: .7 }); add('portalClose', 22.25, { v: .6 });
  add('slurp', T.sip[0], { d: T.sip[1] - T.sip[0] }); add('page', T.page); add('lick', T.lick[0] + .05); add('click', T.mClick);
  // 蒙太奇
  T.montClick.forEach(x => add('click', x, { v: .8 }));
  add('chomp', T.chomp); add('chomp', T.chomp + .28); add('coo', T.coo); add('swish', T.vasksTurn);
  // 正常宇宙
  add('shopbell', 31.5); add('portalClose', T.nClose + .25, { v: .6 }); add('cupSet', T.take); add('click', T.nClick);
  // 回家
  add('portalOpen', 36.08, { v: .7 }); add('pop', T.lSpit); add('thud', T.lLandV); add('thud', T.lLandG, { v: .8 }); add('portalClose', T.lClose[1] - .05);
  add('slurp', T.sipL[0], { d: .5, v: .8 });
  add('bloop', T.bubble); add('bloop', T.bubble + .12, { v: .7 }); add('squish', T.rise[0], { v: .6 }); add('blip', T.eyesOpen);
  T.blinkC.forEach(x => add('blip', x, { v: .7 }));
  add('bloop', T.nod, { v: .6 });
  add('whoosh', T.toss); add('wheee', T.toss + .05, { d: T.tossLand - T.toss }); add('click', T.tClick); add('portalOpen', T.tOpen); add('portalHum', T.tOpen + .1, { d: T.end - T.tOpen - .1, v: .6 }); add('gulpPortal', T.tossLand);
  add('slam', T.end, { v: .8 });
  // 脚步（抽样表演里的腿）
  return ev.sort((a, b) => a.t - b.t);
}

window.render = render; window.DUR = DUR; window.EV = events(); window.SUBS = SUBS;
for (const f of ['800 50px "Baloo 2"', '400 60px "Titan One"', '400 60px Bungee', '400 40px VT323']) await document.fonts.load(f);
render(parseFloat(new URLSearchParams(location.search).get('t') ?? '10.5'));
window.READY = true;
