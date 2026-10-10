// City Lights, 1987 — 80s Cel Anime demo
import { canvas, W, H, hash } from './cel.js';
import { makePost } from './post.js';
import { DUR, SHOTS, shotAt, T, VO, bar, BEAT } from './story.js';
import { streetPlate, skylinePlate, smear, reflectPlate, tallFar, tallNear } from './bg.js';
import { SHOTS_FN as S0 } from './shots.js';
import * as S1 from './scenes1.js';
import * as S2 from './scenes2.js';
import * as S3 from './scenes3.js';
import * as S4 from './scenes4.js';
import { hud, subSpans } from './hud.js';

const qs = new URLSearchParams(location.search);
const [sc, g] = canvas(W, H), [gc, e] = canvas(W, H);
const post = makePost(document.getElementById('gl'));
const [ovc, ov] = canvas(W, H);   // 字幕层（离屏）
const TEST = qs.get('test');
const testMod = TEST ? await import('./test.js') : null;

await document.fonts.load('60px "Dela Gothic One"', '喫茶ホテルラーメンカラオケ薬局洋菓子ネオン書店中華ビデオシティ・ライツ');
await document.fonts.load('italic 800 56px Kanit'); await document.fonts.load('italic 900 56px Kanit');
await document.fonts.load('500 40px "Barlow SC"'); await document.fonts.load('600 40px "Barlow SC"'); await document.fonts.load('700 40px "Barlow SC"');

// —— 资源（加载时一次画好）——
const A = {};
{
  const st = streetPlate(4800, 700, 3, 'night'); A.street = smear(st, 16, 8); A.refl = reflectPlate(A.street, 340, .8);
  A.sky = skylinePlate(3840, 560, 9, 'night');
  const sd = streetPlate(4800, 700, 11, 'dawn'); A.streetDawn = smear(sd, 16, 8); A.reflDawn = reflectPlate(A.streetDawn, 340, .5);
  A.skyDawn = skylinePlate(3840, 560, 5, 'dawn');
  A.tallFar = tallFar(3200); A.tallNear = tallNear(st, 3600);
  A.highway = S2.highwayPlate(); A.jump = S3.jumpPlate(); A.lift = S4.liftPlate();
}
const SHOTS_FN = { ...S0, crane: S1.crane, tape: S1.tape, eyes: S1.eyes, title: S1.title,
  rear: S2.rear, bust: S => S2.bustShot(S), wheel: S2.wheelShot, highway: S2.highway,
  bridge: S3.bridge, throttle: S3.throttle, charge: S3.charge, jump: S3.jump, land: S3.land,
  handoff: S4.handoff, deck: S4.deck, liftoff: S4.liftoff, smile: S4.smile, endcard: S4.endcard };
let DURS = {}; try { const r = await fetch('voices/dur.json'); if (r.ok) DURS = await r.json(); } catch (x) { }
const SPANS = subSpans(DURS);

function render(t) {
  for (const x of [g, e]) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; }
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const fr = Math.round(t * 24);
  let over = {};
  if (testMod) testMod.test(g, e, t, TEST);
  else {
    const st = shotAt(t), [t0, t1, name] = st;
    const fn = SHOTS_FN[qs.get('shot') || name];
    if (fn) over = fn({ t, lt: t - t0, u: (t - t0) / (t1 - t0), g, e, A, name }) || {};
  }
  // 字幕先画到离屏画布，交给 CRT 管线合成（字幕是录在带子上的）
  if (qs.get('nosub') || testMod) ov.clearRect(0, 0, W, H); else hud(ov, t, SPANS);
  const crt = { power: Math.min(1, t / .6), track: t >= T.play - 1 / 48 && t < T.play + 8 / 24 ? 1 - .5 * ((t - T.play) * 24 / 8) : 0 };
  post.render(sc, gc, fr, ovc, qs.get('raw') ? { bloom: 0, halo: 0, soft: 0, flick: 0, lift: 0, contrast: 0, fade: 0, sat: 1, tint: [1, 1, 1], scan: 0, grille: 0, bleed: 1, rshift: 0, glow: 0, corner: 0, noiseA: 0, power: 1, track: 0, expo: 1 } : { ...crt, ...over });
}
// —— 音效事件（给 mix.py）——
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  for (const v of VO) if (v.who === 'D') { add('squelch', v.t - .18); add('squelch', v.t + (DURS[v.id] || 2) + .08, { v: .7 }); }
  add('tapeclick', 6.9); add('rev', T.rev[0]); add('rev', T.rev[1], { v: 1.2 });
  add('crton', 0.02); add('launch', T.title); add('whoosh', bar(9) - .15, { v: .7 }); add('whoosh', bar(12) - .2, { v: .5 });
  add('spray', bar(11), { d: BEAT * 4 });
  for (let k = 0; k < 8; k++) add('bell', bar(13) + k * .5, { v: .8 });
  add('clunk', bar(13) + .9, { v: .6 });
  add('twist', T.throttle); add('impact', T.jump); add('wind', T.jump, { d: bar(18) - T.jump });
  add('land', T.land); add('scrape', T.land + .05, { d: 1.1 });
  add('grab', T.handoff); add('button', T.play); add('tapenoise', T.play - 1 / 48, { d: 8 / 24 + .05 }); add('motor', T.play + .05, { d: 45.52 - T.play - .05 });
  add('ignite', T.lift + .15); add('roar', T.lift + .25, { d: T.end + 2.5 - T.lift });
  return ev.sort((a, b) => a.t - b.t);
}
window.EV = events();
window.render = render; window.DUR = DUR; window.POST = post;
render(parseFloat(qs.get('t') ?? '15'));
window.READY = true;
