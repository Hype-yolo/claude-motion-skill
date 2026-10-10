// Title (T), envelope insert, ballroom (Busby Berkeley), and the ending (dial ding → doors → end card).
import * as D from './engine/deco.js';
import * as T from './engine/type.js';
import * as B from './engine/bulbs.js';
import * as CH from './chars.js';
import * as TL from './timeline.js';
import { sky } from './scenes/roof.js';
import { drawLobby, doors, plaque } from './scenes/lobby.js';
const { C } = D;

// ---------- TITLE: a gold point bursts into rays and a stepped arch as the clarinet glides up; title bar on the hit ----------
export function titleShot(g, t) {
  const hit = TL.T.titleHit, k = D.seg(t, .05, hit);            // draw-on follows the glissando (slow → fast, like pitch rising)
  const d = Math.pow(k, 1.8);
  const push = 1 + .06 * D.seg(t, 0, TL.T.street);
  g.fillStyle = '#050403'; g.fillRect(0, 0, 1920, 1080);
  g.save(); g.translate(960, 560); g.scale(push, push); g.translate(-960, -560);
  D.sunburst(g, 960, 560, { rays: 72, r0: 30, r1: 1400, mode: 'wedges', colorA: 'rgba(201,162,75,.07)' });
  D.glow(g, 960, 560, 520, '#c9a24b', .2);
  // radial lines
  if (d > 0) D.sunburst(g, 960, 560, { rays: 72, r0: 40, r1: 60 + d * 1300, mode: 'lines', w: 1.8, alpha: .75 * Math.min(1, d * 3), sheen: .3 + d * .5 });
  if (t > hit) D.sunburst(g, 960, 560, { rays: 72, r0: 40, r1: 1400, mode: 'wedges', colorA: `rgba(201,162,75,${.06 * D.eo(D.seg(t, hit, hit + .6))})` });
  // three stepped arches draw on, outer first
  for (let i = 0; i < 3; i++) {
    const pts = D.stepArchPts(960, 1000, 1180 - i * 170, 900 - i * 110, { steps: 3, crown: 'round' });
    D.gline(g, pts, { w: i ? 1.6 : 2.6, part: D.ss(D.seg(d, .15 + i * .15, .75 + i * .08)), glow: .5 });
  }
  // the travelling spark (head of the draw-on)
  if (t < hit) { const r = 20 + d * 60; D.glow(g, 960, 560, 80 + d * 200, '#ffd88a', .5); D.sparkle(g, 960, 560, r, { rot: t * 2 }); }
  g.restore();
  // title bar + year badge
  if (t >= hit - .02) {
    const p = D.seg(t, hit, hit + 1.05), out = 0;
    D.glow(g, 960, 470, 700, '#ffcf7a', .18 * D.eo(p));
    T.titleBar(g, 'MIDNIGHT', 960, 440, { p, size: 96, sub: 'AT THE STARLIGHT HOTEL', subSize: 30, sheen: D.lerp(-.2, 1.2, D.seg(t, hit + .3, hit + 1.6)) });
    T.yearBadge(g, '1930', 960, 700, 78, { p: D.seg(t, hit + .45, hit + 1.2) });
    const lab = D.ss(D.seg(t, hit + 1.0, hit + 1.6));
    if (lab > 0) T.goldText(g, 'NEW YEAR’S EVE', 960, 830, { size: 26, font: 'Josefin', weight: 600, track: 12, alpha: lab, shadow: false });
  }
  D.vignette(g, 1920, 1080, .5);
}

// ---------- ENVELOPE insert ----------
export function envelopeInsert(g, t) {
  const t0 = TL.T.envelope, k = D.seg(t, t0, TL.T.wing1);
  const bg = g.createLinearGradient(0, 0, 0, 1080); bg.addColorStop(0, '#0c0e12'); bg.addColorStop(1, '#1a130b'); g.fillStyle = bg; g.fillRect(0, 0, 1920, 1080);
  // street bokeh
  const R = D.mulberry(8); for (let i = 0; i < 40; i++) D.glow(g, R() * 1920, R() * 1080, 30 + R() * 90, R() < .5 ? '#ffc36a' : '#f6e8c4', .12 + R() * .12);
  const s = 1 + k * .06;
  g.save(); g.translate(960, 520); g.scale(s, s); g.rotate(-.05);
  // the envelope, big, held by a gloved hand at lower right
  const w = 1100, h = 700;
  g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 50; g.fillStyle = '#f5eddb'; g.fillRect(-w / 2, -h / 2, w, h); g.shadowBlur = 0;
  const pg = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); pg.addColorStop(0, 'rgba(255,252,240,.5)'); pg.addColorStop(1, 'rgba(170,140,95,.3)'); g.fillStyle = pg; g.fillRect(-w / 2, -h / 2, w, h);
  D.gline(g, D.rectPts(-w / 2 + 22, -h / 2 + 22, w - 44, h - 44), { w: 2.4 }); D.gline(g, D.rectPts(-w / 2 + 34, -h / 2 + 34, w - 68, h - 68), { w: 1 });
  // stamp-like deco corner fan
  D.fan(g, w / 2 - 110, -h / 2 + 120, 70, { a0: Math.PI, a1: D.TAU, ribs: 7, fill: '#1d6b57' });
  g.font = '600 26px Josefin'; g.fillStyle = '#6a5338'; g.textAlign = 'left'; if ('letterSpacing' in g) g.letterSpacing = '6px'; g.fillText('SPECIAL DELIVERY', -w / 2 + 80, -h / 2 + 110);
  T.goldText(g, 'ROOFTOP BALLROOM', 0, -10, { size: 78, font: 'Limelight', track: 5, shadow: false, fill: '#2a1d10' });
  D.gline(g, [[-300, 30], [300, 30]], { w: 1.6 });
  T.goldText(g, 'BEFORE MIDNIGHT', 0, 100, { size: 48, font: 'Poiret', track: 14, shadow: false, fill: '#8e1b2e' });
  // the gold wax seal with the treble clef
  const glint = TL.T.sealGlint, gk = D.seg(t, glint - .05, glint + .45);
  g.beginPath(); g.arc(0, 230, 70, 0, D.TAU); g.fillStyle = D.goldGrad(g, -70, 160, 70, 300, { sheen: D.lerp(.1, .95, gk) }); g.fill();
  g.beginPath(); g.arc(0, 230, 58, 0, D.TAU); g.strokeStyle = '#8a6a2a'; g.lineWidth = 3; g.stroke();
  CH.clef(g, 0, 232, 12, '#5a3e14', .5);
  g.restore();
  if (gk > 0 && gk < 1) D.sparkle(g, 960 + 40, 520 + 190, 70 * Math.sin(gk * Math.PI), { rot: gk });
  CH.gloveHand(g, 1480, 900, 17, -.9, .75, { sleeve: '#8e1b2e' });
  D.vignette(g, 1920, 1080, .55);
}

// ---------- BALLROOM: oblique ring (fans open one per eighth) → overhead kaleidoscope → the dancers become a clock ----------
const N = 8;
function ballroomFloor(g, cx, cy, rx, ry, t, rot) {
  g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
  const fg = g.createRadialGradient(0, 0, 50, 0, 0, rx * 1.3); fg.addColorStop(0, '#221a10'); fg.addColorStop(1, '#050403');
  g.beginPath(); g.arc(0, 0, rx * 1.3, 0, D.TAU); g.fillStyle = fg; g.fill();
  D.sunburst(g, 0, 0, { rays: 48, r0: rx * .12, r1: rx * 1.28, rot, mode: 'both', colorA: 'rgba(201,162,75,.10)', w: 2, alpha: .9 });
  for (let k = 1; k <= 4; k++) D.gline(g, D.arcPts(0, 0, rx * k * .32, 0, D.TAU, 90), { w: k === 4 ? 3 : 1.4 });
  g.restore();
}
export function ballroomShot(g, t) {
  const t0 = TL.TUTTI, t1 = TL.BALL1, t2 = TL.BALL2, t3 = TL.PULL0;
  const fanT = i => t0 + i * TL.B / 2;
  if (t < t1) {
    // --- oblique: a ring of 8 fan dancers seen from a low balcony; camera cranes up (ellipse opens)
    const k = D.seg(t, t0, t1), crane = D.eio(k);
    sky(g, t, { moon: false });
    // the lit sign as big bokeh along the top + band shell glow
    for (let i = 0; i < 12; i++) { const x = 120 + i * 152; D.glow(g, x, 70, 150, '#ffcf7a', .35); g.beginPath(); g.arc(x, 70, 30, 0, D.TAU); g.fillStyle = 'rgba(255,236,190,.4)'; g.fill(); }
    const cx = 960, cy = D.lerp(760, 640, crane), rx = 640, ry = rx * D.lerp(.2, .42, crane);
    ballroomFloor(g, cx, cy, rx, ry, t, t * .1);
    const rot = -Math.PI / 2 + (t - t0) * .35;
    const order = [...Array(N).keys()].map(i => ({ i, a: rot + i / N * D.TAU })).sort((a, b) => Math.sin(a.a) - Math.sin(b.a));
    for (const { i, a } of order) {
      const x = cx + Math.cos(a) * rx * .78, y = cy + Math.sin(a) * ry * .78, depth = (Math.sin(a) + 1) / 2;
      const s = D.lerp(2.2, 3.4, depth) * D.lerp(1, .9, crane);
      const open = D.eo(D.seg(t, fanT(i), fanT(i) + .22));
      const dir = Math.cos(a) > 0 ? 1 : -1;
      g.save(); g.globalAlpha = D.lerp(.75, 1, depth);
      CH.drawDancer(g, x, y - 60 * s, s, { dir, fan: .15 + .85 * open, raise: .25 + .75 * open, sway: Math.sin(t * 4 + i) * .3 });
      g.restore();
      if (open > 0 && open < 1) D.sparkle(g, x + dir * 60 * s * .5, y - 100 * s, 30 * Math.sin(open * Math.PI), { alpha: .9 });
    }
    D.vignette(g, 1920, 1080, .45);
    return;
  }
  // --- overhead: straight down, 8-fold symmetric bloom, slow rotation; then the ring becomes a clock
  const k2 = D.seg(t, t1, t2), k3 = D.seg(t, t2, t3);
  g.fillStyle = '#040302'; g.fillRect(0, 0, 1920, 1080);
  const rot = (t - t1) * .45;
  const cx = 960, cy = 540;
  ballroomFloor(g, cx, cy, 520, 520, t, -rot * .5);
  // mirror ring (Berkeley's kaleidoscope): a smaller reflected ring counter-rotating, faint
  const form = D.eio(D.seg(t, t2, TL.T.clockForm));
  const beatPulse = .85 + .15 * Math.cos((t - t1) / TL.B * Math.PI * 2);
  if (form > .4) { const ha = D.ss(D.seg(form, .4, .9)); g.save(); g.globalAlpha = ha;
    for (const [len, w] of [[450, 14], [300, 24]]) { g.beginPath(); g.moveTo(cx - w, cy); g.lineTo(cx, cy - len); g.lineTo(cx + w, cy); g.lineTo(cx, cy + 40); g.closePath(); g.fillStyle = D.goldGrad(g, cx - w, cy - len, cx + w, cy, { sheen: .5 }); g.fill(); }
    g.beginPath(); g.arc(cx, cy, 22, 0, D.TAU); g.fillStyle = D.goldGrad(g, cx - 22, cy - 22, cx + 22, cy + 22, { sheen: .4 }); g.fill(); g.restore(); }
  if (form < 1) for (let i = 0; i < N; i++) { const a = -rot * 1.3 + (i + .5) / N * D.TAU; g.save(); g.globalAlpha = .28 * (1 - form); CH.drawDancerTop(g, cx + Math.cos(a) * 170, cy + Math.sin(a) * 170, 2.3, a, { fan: beatPulse * .9 }); g.restore(); }
  for (let i = 0; i < N; i++) {
    // ring position → clock position: dancers 0 and 1 become the hands (both pointing to XII), the others spread to the hour ring
    let a = rot + i / N * D.TAU, r = 330, s = 4.1, fan = beatPulse;
    if (form > 0) {
      const hour = [0, 0, 2, 4, 5, 7, 8, 10][i], ta = -Math.PI / 2 + hour / 12 * D.TAU;
      let tr = 380, ts = 3.7;
      if (i === 0) { tr = 115; ts = 3.9; } if (i === 1) { tr = 260; ts = 3.4; }
      // unwrap angle toward target
      let da = ((ta - a) % D.TAU + D.TAU * 1.5) % D.TAU - Math.PI;
      a = a + da * form; r = D.lerp(r, tr, form); s = D.lerp(s, ts, form);
      if (i < 2) fan = D.lerp(fan, 1, form);
    }
    CH.drawDancerTop(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, s, a, { fan, spin: (t - t1) * 1.5 });
  }
  // the clock face appears on the floor as the formation locks (roman numerals ring + two gold hands at twelve)
  if (form > .6) {

    const a = D.ss(D.seg(form, .6, 1));
    const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let h = 0; h < 12; h++) { const an = -Math.PI / 2 + h / 12 * D.TAU; g.save(); g.translate(cx + Math.cos(an) * 485, cy + Math.sin(an) * 485); g.rotate(an + Math.PI / 2); T.goldText(g, R[h], 0, 12, { size: 38, font: 'Italiana', alpha: a, shadow: false }); g.restore(); }
    D.gline(g, D.arcPts(cx, cy, 520, 0, D.TAU, 120), { w: 3, alpha: a, glow: .6 });
  }
  if (t > TL.T.clockForm && t < TL.T.clockForm + .3) D.sparkle(g, cx, cy - 400, 90 * (1 - (t - TL.T.clockForm) / .3), { alpha: 1 });
  D.vignette(g, 1920, 1080, .55);
}

// ---------- ENDING: the lobby dial swings to R, "ding", plaque flips to IN SERVICE — too late. Doors close into the end card. ----------
export function endDial(g, t) {
  const t0 = TL.FINAL, k = D.seg(t, t0, TL.DING);
  drawLobby(g, {
    t, dial: D.back(k, 1.4), clock: { h: 12, m: 0, s: 5 }, cam: { x: 0, y: 3.0, z: 8.6, f: 1080, oy: 560 }, guests: false,
    plaque: 1.4, radioOn: 1, plaqueFlip: D.seg(t, TL.DING + .1, TL.DING + .4),
  });
  // flip the plaque text: draw a replacement plaque with IN SERVICE after the flip
  const flip = D.seg(t, TL.DING + .12, TL.DING + .38);
  if (flip > 0) { /* handled by the plaque redraw below */ }
  const cam = { x: 0, y: 3.2, z: 9.6 };
  if (t > TL.DING) { D.glow(g, 960, 170, 260, '#ffd27a', .45 * (1 - D.seg(t, TL.DING, TL.DING + .6))); }
  D.vignette(g, 1920, 1080, .5);
}

export function endCard(g, t) {
  const t0 = TL.CARD0, k = D.seg(t, t0, t0 + 1.2);
  // closed elevator doors fill the frame; a black lacquer plaque carries the credits
  g.fillStyle = '#050403'; g.fillRect(0, 0, 1920, 1080);
  doors(g, 960, 1080, 1920, 1080, 0, true);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, 1920, 1080);
  const pw = 1180, ph = 720, x0 = 960 - pw / 2, y0 = 170;
  g.save(); g.globalAlpha = D.eo(k);
  g.fillStyle = 'rgba(6,5,4,.93)'; g.fillRect(x0, y0, pw, ph);
  D.gline(g, D.rectPts(x0, y0, pw, ph), { w: 2.6 }); D.gline(g, D.rectPts(x0 + 14, y0 + 14, pw - 28, ph - 28), { w: 1 });
  g.restore();
  T.titleBar(g, 'MIDNIGHT', 960, 300, { p: D.seg(t, t0 + .1, t0 + 1.1), size: 74, sub: 'AT THE STARLIGHT HOTEL', subSize: 24, wings: false });
  const a = D.ss(D.seg(t, t0 + .6, t0 + 1.4));
  T.goldText(g, 'ART DECO', 960, 480, { size: 44, font: 'Limelight', track: 14, alpha: a });
  g.save(); g.globalAlpha = a; g.textAlign = 'center';
  g.font = '600 26px Josefin'; if ('letterSpacing' in g) g.letterSpacing = '8px'; g.fillStyle = C.gold2; g.fillText('LEMO-OPUSCAR', 960, 545);
  g.font = '400 24px Josefin'; if ('letterSpacing' in g) g.letterSpacing = '3px'; g.fillStyle = C.ivory; g.fillText('LemoLab × Claude Opus 5.5', 960, 590);
  D.gline(g, [[760, 625], [1160, 625]], { w: 1.2 });
  g.font = '400 21px Josefin'; if ('letterSpacing' in g) g.letterSpacing = '1px'; g.fillStyle = C.ivoryD;
  ['Original score & sound: Lemo-Opuscar · Voices: Kokoro (bm_fable, am_puck)',
    'Piano: “Salamander Grand Piano V3” by Alexander Holm, CC BY 3.0',
    'Samples (CC0): Versilian Studios VSCO 2 CE & VCSL, Karoryfer Samples',
    'Fonts (OFL): Limelight · Poiret One · Josefin Sans · Italiana'].forEach((s, i) => g.fillText(s, 960, 680 + i * 38));
  g.restore();
  D.vignette(g, 1920, 1080, .5);
}
