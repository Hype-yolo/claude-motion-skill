// Roof sequence: run along the catwalk → tower clock hits XII (silence) → the throw → the fall → the catch (bell 1)
// → bandleader opens the song (bells 2–4) → the sign lights letter by letter toward Pip (5–11) → bell 12 behind him.
import * as D from './engine/deco.js';
import * as T from './engine/type.js';
import * as B from './engine/bulbs.js';
import * as CH from './chars.js';
import * as TL from './timeline.js';
import { makeCam } from './engine/cam.js';
import { drawRoof, signRig, sky } from './scenes/roof.js';
const { C } = D;

// Letters light one per bell: letter i (0..11) at strike(i+1). Before the bells: all dark.
export function bellLit(t) {
  const Tm = Array.from({ length: 12 }, (_, i) => TL.strike(i + 1));
  return B.litSequence(t, Tm, { flash: .2 });
}
const rig = () => signRig({});
const pipW = (r, u, n = -.8) => r.at(u, 0, n);
function camNear(r, u, d, h, side = 0, extra = {}) {
  const p = pipW(r, u), Nv = r.Nv, Dv = r.Dv;
  return { x: p[0] - Nv[0] * d + Dv[0] * side, y: p[1] + h, z: p[2] - Nv[2] * d + Dv[2] * side, f: 1100, oy: 540, yaw: r.th + (extra.dyaw || 0), ...extra };
}
function drawPipAt(g, cam, w, P) {
  const f = cam.P(...w), s = cam.scaleAt(...w) * CH.PIP_M / CH.PIP_H;
  CH.drawFigure(g, { x: f[0], y: f[1] - (CH.PIP_SOLE - (P.bob || 0)) * s, s, ...P });
  return { f, s };
}

// R1 · 31.416 → 32.9: Pip sprints along the catwalk under the dark giant letters (camera pans with him)
export function roofRun(g, t) {
  const r = rig(), t0 = TL.ROOF0, k = D.seg(t, t0, TL.CLOCK);
  const L = r.L, u = D.lerp(L - .4, L * .55, k);
  const camU = D.lerp(L - 1.6, L * .58, D.ss(k));
  drawRoof(g, {
    t, lit: () => 0, cam: camNear(r, camU, 4.4, .8, 0, { pitch: .22 }),
    pip: (g, cam) => { const rc = CH.runCycle((t - t0) * 1.9 * 2); drawPipAt(g, cam, pipW(r, u), { view: 'side', dir: -1, face: 'determined', ...rc.pose, bob: rc.bob, letter: 'N' }); },
  });
}

// 32.9 → 33.45: the tower clock — minute hand clunks onto XII at T.clock
export function towerClock(g, t) {
  const tc = TL.CLOCK;
  const bg = g.createRadialGradient(960, 540, 100, 960, 540, 1100); bg.addColorStop(0, '#1c150c'); bg.addColorStop(1, '#040302');
  g.fillStyle = bg; g.fillRect(0, 0, 1920, 1080);
  D.sunburst(g, 960, 540, { rays: 64, r0: 470, r1: 1300, mode: 'both', colorA: 'rgba(201,162,75,.07)', w: 1.4, alpha: .6 });
  const before = t < tc, jolt = !before && t - tc < .12 ? Math.sin((t - tc) * 80) * 4 * (1 - (t - tc) / .12) : 0;
  const m = before ? 59 : 60, s = before ? 58 + (t - (tc - .55)) / .55 * 2 : 0;
  g.save(); g.translate(0, jolt);
  T.clockFace(g, 960, 540, 400, { h: before ? 11 : 12, m: before ? 58.6 : 0, s: null, lit: before ? .15 : .35, roman: true });
  for (let i = 0; i < 60; i++) { if (i % 5 === 0) continue; const a = -Math.PI / 2 + i * D.TAU / 60; D.gline(g, [[960 + Math.cos(a) * 340, 540 + jolt + Math.sin(a) * 340], [960 + Math.cos(a) * 362, 540 + jolt + Math.sin(a) * 362]], { w: 1.2 }); }
  g.restore();
  D.vignette(g, 1920, 1080, .6);
}

// 33.45 → 34.45: the throw. Medium, side view at the rail: anticipation → release → follow-through wobble
export function roofThrow(g, t) {
  const r = rig(), u = r.L * .55;
  const tw = TL.T.windup, tr = TL.T.release;
  drawRoof(g, {
    t, lit: () => 0, cam: camNear(r, u - .6, 3.9, 1.1, 0, { pitch: .06, f: 1150 }),
    pip: (g, cam) => {
      let P;
      if (t < tw) P = CH.lerpPose(CH.POSES.stand, CH.POSES.windup, D.ss(D.seg(t, tw - .45, tw)));
      else if (t < tr) P = CH.lerpPose(CH.POSES.windup, CH.POSES.release, D.ei(D.seg(t, tw + .25, tr)));
      else P = CH.lerpPose(CH.POSES.release, CH.POSES.wobble, D.back(D.seg(t, tr, tr + .35), 1.2));
      if (t > tr + .5) P = CH.lerpPose(CH.POSES.wobble, CH.POSES.stand, D.ss(D.seg(t, tr + .5, tr + .9)));
      const face = t < tw - .1 ? 'shout' : t < tr + .05 ? 'effort' : t < tr + .6 ? 'panic' : 'calm';
      const talk = t < tw ? Math.abs(Math.sin((t - TL.LINES[5].t) * 16)) : 0;
      drawPipAt(g, cam, pipW(r, u, -1.0), { view: 'side', dir: -1, ...P, face: face === 'shout' ? { ...CH.FACES.shout, mOpen: .3 + .7 * talk } : face, letter: t < tr ? 'N' : null });
      // the letter leaving his hand
      if (t >= tr) { const f = cam.P(...pipW(r, u - .9 - (t - tr) * 3.5, -1.3)), s = cam.scaleAt(...pipW(r, u, -1)); CH.envelope(g, f[0], f[1] - s * (1.9 - (t - tr) * 2.4), s * .03, (t - tr) * 9); }
    },
  });
}

// 34.45 → 35.86: follow the letter down in slow motion past the dark letters to the terrace; a white glove rises
export function letterFall(g, t) {
  const t0 = TL.T.release + .1, t1 = TL.STRIKE1, k = D.seg(t, t0, t1);
  const scroll = D.eio(k);
  // background layers scrolling up (the camera tilts down): sky → dark letters/scaffold → terrace glow
  sky(g, t, { moon: false });
  const S = rig().S;
  g.save(); g.translate(0, -scroll * 1500);
  // giant dark letters passing close to the camera
  B.drawSign(g, S, -120, -80, 1.35, { lit: () => 0, only: 8 }); B.drawSign(g, S, -520, -300, 1.35, { lit: () => 0, only: 9 });
  for (let x = 0; x < 1920; x += 160) D.gline(g, [[x, 380], [x, 900]], { w: 1.2, alpha: .5 });
  D.gline(g, [[0, 900], [1920, 900]], { w: 2.4 });
  // the catwalk underside and the parapet
  g.fillStyle = '#0d0a07'; g.fillRect(0, 900, 1920, 180); D.chevrons(g, 0, 1920, 960, { n: 16, h: 30, rows: 3, gap: 14 });
  g.fillStyle = '#080605'; g.fillRect(0, 1080, 1920, 900);
  // terrace below: warm glow, dancers' heads & fans closed (waiting), band shell
  const tg = g.createRadialGradient(960, 2400, 50, 960, 2400, 1100); tg.addColorStop(0, 'rgba(255,206,130,.55)'); tg.addColorStop(1, 'rgba(255,206,130,0)');
  g.fillStyle = tg; g.fillRect(0, 1500, 1920, 1500);
  g.restore();
  // the letter, centred, tumbling slowly, with a faint gold trail
  const ex = 960 + Math.sin(k * 5) * 60, ey = 470 + Math.sin(k * 3) * 30;
  D.speedLines(g, ex, ey - 40, Math.PI / 2, { n: 5, len: 260, spread: 120, w: 3, alpha: .6, seed: 3 });
  CH.envelope(g, ex, ey, 20, k * 9);
  D.sparkle(g, ex + 20, ey - 10, 30 * (.5 + .5 * Math.sin(k * 20)), { alpha: .8 });
  // the glove rising into frame at the end, open, reaching
  const up = D.ss(D.seg(t, t1 - .6, t1));
  if (up > 0) CH.gloveHand(g, 960, D.lerp(1300, ey + 150, up), 13, 0, 0);
  D.vignette(g, 1920, 1080, .5);
}
// the trail loop above leaves no state; keep envelopes opaque

// 35.86 → 36.38: bell 1 — the catch (ECU). Warm light rises from the first letter.
export function theCatch(g, t) {
  const k = D.seg(t, TL.STRIKE1, TL.strike(2));
  const bg = g.createLinearGradient(0, 0, 0, 1080); bg.addColorStop(0, '#0a0e14'); bg.addColorStop(1, '#1a130b'); g.fillStyle = bg; g.fillRect(0, 0, 1920, 1080);
  D.glow(g, 300, 120, 900, '#ffd08a', .45 * D.eo(k * 3));
  D.sunburst(g, 960, 1300, { rays: 40, r0: 300, r1: 1600, a0: Math.PI, a1: D.TAU, mode: 'lines', w: 1.4, alpha: .35 });
  const squeeze = D.eo(D.seg(t, TL.STRIKE1 - .03, TL.STRIKE1 + .07));
  const drop = 1 - D.eo(D.seg(t, TL.STRIKE1 - .25, TL.STRIKE1));
  CH.envelope(g, 960, 420 - drop * 500, 26, .15 + drop * 2);
  CH.gloveHand(g, 960, 560, 22, 0, squeeze);
  D.vignette(g, 1920, 1080, .55);
}

// 36.38 → 37.93: bells 2–4. The bandleader tears the seal, the sheet insert (bell 3), baton up & a look to the roof (bell 4).
export function bandleader(g, t, lit) {
  const s2 = TL.strike(2), s3 = TL.strike(3), s4 = TL.strike(4);
  if (t >= s3 && t < s4) return sheetInsert(g, t);
  const bg = g.createLinearGradient(0, 0, 0, 1080); bg.addColorStop(0, '#0a0e14'); bg.addColorStop(.7, '#1f170d'); bg.addColorStop(1, '#0b0806'); g.fillStyle = bg; g.fillRect(0, 0, 1920, 1080);
  // the sign's glow above, one letter brighter per bell (bokeh bulbs at the top of frame)
  const n = [1, 2, 3, 4].filter(k => t >= TL.strike(k)).length;
  for (let i = 0; i < 12; i++) { const on = i < n; const x = 150 + i * 150, y = 90 + Math.sin(i) * 20; if (on) { D.glow(g, x, y, 130, '#ffcf7a', .45); g.beginPath(); g.arc(x, y, 34, 0, D.TAU); g.fillStyle = 'rgba(255,236,190,.35)'; g.fill(); } else { g.beginPath(); g.arc(x, y, 30, 0, D.TAU); g.strokeStyle = 'rgba(201,162,75,.18)'; g.lineWidth = 2; g.stroke(); } }
  // band shell arches behind
  for (let k = 0; k < 4; k++) D.gline(g, D.arcPts(960, 1150, 620 + k * 90, Math.PI, D.TAU, 60), { w: 2 - k * .3, alpha: .7 });
  D.glow(g, 960, 700, 700, '#ffcf8a', .12 + .05 * n);
  // the conductor, medium shot (waist up), hands at the chest tearing the seal; bell 4: baton up, a look to the roof
  const s = 10.5, x = 930, y = 800;
  const sh = CH.shoulderR('q', 'conductor'), st = CH.STY.conductor;
  const tear = D.ss(D.seg(t, s2 - .12, s2 + .12)), up = D.ss(D.seg(t, s4 - .15, s4 + .18));
  let armN = [.18, -2.05 + tear * .45], armF = [.18, -2.05 + tear * .45];
  if (t >= s4) armN = CH.lerpPose({ a: armN }, { a: [2.75, .35] }, up).a;
  CH.drawFigure(g, { x, y: y + 60.6 * s * .0 + 58 * s * .0, s, view: 'q', style: 'conductor',
    face: t < s4 ? { open: .45, lid: .45, look: [0, .9], brow: -.3, mouth: 'line' } : { open: .95, look: [.2, -.9], brow: -1.2, browAng: -.1, mouth: 'smile' },
    armN, armF, headTilt: t < s4 ? .16 : .16 - .38 * up,
    item: (gg, hx, hy, a) => { if (t < s4) { gg.save(); gg.translate(hx - 4.5 - tear * 2, hy - 3); CH.envelope(gg, 0, 0, 1.2, -.06 + tear * .2); gg.restore(); } else { gg.save(); gg.translate(hx, hy); gg.rotate(-a + Math.PI * .92); gg.fillStyle = '#f7f1e2'; gg.fillRect(-.35, -1, .7, 22); gg.restore(); } } });
  // torn seal flake
  if (t > s2 && t < s3) { const k2 = D.seg(t, s2, s3); D.sparkle(g, x + 90 + k2 * 120, y - 420 + k2 * 260, 18 * (1 - k2), { alpha: 1 - k2 }); }
  D.vignette(g, 1920, 1080, .5);
}
// bell 3 insert: the sheet music — its title is the film's title; the notes are the real motif of the score
export function sheetInsert(g, t) {
  const k = D.seg(t, TL.strike(3), TL.strike(4));
  g.fillStyle = '#0b0806'; g.fillRect(0, 0, 1920, 1080);
  g.save(); g.translate(960, 560); g.rotate(-.04); g.scale(1 + k * .05, 1 + k * .05);
  const w = 1320, h = 820;
  g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 40; g.fillStyle = '#f3ead6'; g.fillRect(-w / 2, -h / 2, w, h); g.shadowBlur = 0;
  const pg = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); pg.addColorStop(0, 'rgba(255,250,235,.4)'); pg.addColorStop(1, 'rgba(160,130,90,.25)'); g.fillStyle = pg; g.fillRect(-w / 2, -h / 2, w, h);
  D.gline(g, D.rectPts(-w / 2 + 24, -h / 2 + 24, w - 48, h - 48), { w: 2 });
  T.goldText(g, 'MIDNIGHT AT THE STARLIGHT', 0, -h / 2 + 130, { size: 64, font: 'Limelight', track: 6, shadow: false, fill: '#2a1d10' });
  g.font = 'italic 600 26px Josefin'; g.fillStyle = '#5a4630'; g.textAlign = 'center'; g.fillText('a fox-trot · for the midnight number · New Year’s Eve, 1930', 0, -h / 2 + 185);
  // staff with the motif (first 8 beats)
  const x0 = -w / 2 + 110, x1 = w / 2 - 80, sy = 40, gap = 22;
  for (let i = 0; i < 5; i++) { g.strokeStyle = '#2a1d10'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, sy + i * gap); g.lineTo(x1, sy + i * gap); g.stroke(); }
  CH.clef(g, x0 + 40, sy + 2.4 * gap, 13, '#2a1d10', .45);
  // key signature Bb major: B♭, E♭
  g.font = '700 40px Josefin'; g.fillStyle = '#2a1d10'; g.fillText('♭', x0 + 92, sy + 2 * gap + 10); g.fillText('♭', x0 + 118, sy + .5 * gap + 10);
  const motif = [[0, 'F4', 1], [1, 'D5', 1.5], [2.5, 'C5', .5], [3, 'Bb4', 1], [4, 'Db5', 1], [5, 'C5', .5], [5.5, 'A4', .5], [6, 'Bb4', 2]];
  const steps = { 'F4': 0, 'G4': 1, 'A4': 2, 'Bb4': 3, 'C5': 4, 'Db5': 5, 'D5': 5, 'Eb5': 6 };
  const bx0 = x0 + 180, bw = (x1 - bx0) / 8;
  motif.forEach(([b, n, d], i) => {
    const x = bx0 + b * bw + 20, st = steps[n], y = sy + 4 * gap - (st + 1) * gap / 2;   // F4 = first space
    const appear = D.ss(D.seg(k, i * .06, i * .06 + .15));
    if (appear <= 0) return;
    g.save(); g.globalAlpha = appear; g.fillStyle = '#2a1d10';
    g.beginPath(); g.ellipse(x, y, 14, 10, -.35, 0, D.TAU); if (d >= 2) { g.lineWidth = 3.5; g.strokeStyle = '#2a1d10'; g.stroke(); } else g.fill();
    g.lineWidth = 3; g.strokeStyle = '#2a1d10'; g.beginPath(); g.moveTo(x + 12, y - 2); g.lineTo(x + 12, y - 70); g.stroke();
    if (d === .5) { g.beginPath(); g.moveTo(x + 12, y - 70); g.quadraticCurveTo(x + 34, y - 50, x + 26, y - 30); g.stroke(); }
    if (d === 1.5) { g.beginPath(); g.arc(x + 26, y, 4, 0, D.TAU); g.fill(); }
    if (n === 'Db5') { g.font = '700 36px Josefin'; g.fillText('♭', x - 34, y + 12); }
    g.restore();
  });
  [bx0 + 4 * bw, x1].forEach(x => { g.strokeStyle = '#2a1d10'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, sy); g.lineTo(x, sy + 4 * gap); g.stroke(); });
  g.restore();
  D.glow(g, 960, 300, 900, '#ffd08a', .12);
  D.vignette(g, 1920, 1080, .55);
}

// 37.93 → 41.55: bells 5–11. Low camera on the catwalk; Pip in the foreground; the letters light one by one toward him.
export function signLights(g, t) {
  const r = rig(), le = r.S.letters, uP = (le[10].x + le[10].w * .75) * r.k;
  const k = D.seg(t, TL.strike(5), TL.strike(12));
  const lit = bellLit(t);
  drawRoof(g, {
    t, lit, cam: camNear(r, uP, 3.0, .25, 2.6, { pitch: .36, f: 1000, oy: 640, dyaw: -.62 + k * .08 }),
    pip: (g, cam) => {
      // he turns to follow the light marching toward him: head from the far letters to near
      const turn = D.ss(k);
      drawPipAt(g, cam, pipW(r, uP, -.85), { view: 'q', dir: -1, face: { ...CH.FACES.awe, look: [D.lerp(.8, -.2, turn), -.6] }, ...CH.FRONT_POSES.stand, armN: [.15, .3], armF: [.3, .5], headTilt: -.14, letter: null });
    },
  });
}

// 41.55 → 42.067: bell 12. Close-up: the last T lights right behind him; gold floods his face; awe → joy.
export function lastLetter(g, t) {
  const s12 = TL.strike(12), k = D.seg(t, s12, TL.TUTTI);
  const on = t >= s12 ? D.eo(D.seg(t, s12, s12 + .12)) : 0;
  sky(g, t, { moon: false });
  // the T behind him: big bulbs (bokeh) + channel
  const S = rig().S, T11 = S.letters[11];
  g.save(); g.filter = 'blur(3px)';
  B.drawSign(g, S, 1320 - (T11.x + T11.w / 2) * 3.2, -60, 3.2, { lit: (li) => li === 11 ? (on ? 1 + .6 * (1 - k * 3) : 0) : li === 10 ? 1 : 0, only: 11 });
  B.drawSign(g, S, 1320 - (T11.x + T11.w / 2) * 3.2, -60, 3.2, { lit: (li) => 1, only: 10 });
  g.restore();
  if (on) { g.save(); g.globalCompositeOperation = 'lighter'; D.glow(g, 1320, 380, 1100, '#ffc466', .5 * on); g.restore(); }
  const face = t < s12 + .22 ? { ...CH.FACES.awe, look: [.3, -.4] } : 'joy';
  CH.drawFigure(g, { x: 800, y: 480 + 60.6 * 13, s: 13, view: 'q', dir: 1, face, ...CH.FRONT_POSES.stand, headTilt: -.08 });
  // warm light on his face / shoulder from the right (rim)
  if (on) { g.save(); g.globalCompositeOperation = 'soft-light'; const lg = g.createLinearGradient(1100, 0, 500, 0); lg.addColorStop(0, `rgba(255,200,110,${.9 * on})`); lg.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = lg; g.fillRect(0, 0, 1920, 1080); g.restore(); }
  D.vignette(g, 1920, 1080, .45);
}
