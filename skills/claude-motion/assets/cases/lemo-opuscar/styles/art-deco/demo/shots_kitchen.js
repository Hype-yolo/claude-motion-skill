// KITCHEN (K): side-scrolling tracking shot with parallax. Match cut in on a spinning silver tray (the "30" medallion rhymes with it),
// chefs chop on the backbeats, a Busby-Berkeley tunnel of raised trays, Pip slides under, the last tray knocks his cap off,
// the cap lands back on his head a bar later (he doesn't even look), he whistles the first four notes of the song.
import * as D from './engine/deco.js';
import * as T from './engine/type.js';
import * as CH from './chars.js';
import * as TL from './timeline.js';
const { C } = D;

const PPM = 265, GROUND = 1010;
// Pip's x (metres) over time: runs, slows a touch in the slide, runs to the doors
export function pipX(t) {
  const t0 = TL.KIT0;
  return (t - t0) * 4.1 - (t > TL.T.trays ? Math.min(t - TL.T.trays, .6) * .8 : 0);
}
const camX = t => pipX(t) + 1.6;
const WAITERS = [7.4, 8.6, 9.8, 11.0];
const CHEFS = [1.2, 3.0, 4.8];

function tray(g, x, y, r, spin = 0, tilt = 1) {
  g.save(); g.translate(x, y); g.scale(1, tilt);
  const gr = g.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.5, '#c9ccd0'); gr.addColorStop(1, '#6e737a');
  g.beginPath(); g.arc(0, 0, r, 0, D.TAU); g.fillStyle = gr; g.fill();
  g.strokeStyle = C.gold2; g.lineWidth = Math.max(1, r * .05); g.stroke();
  g.save(); g.rotate(spin);
  for (let i = 0; i < 24; i++) { const a = i / 24 * D.TAU; g.beginPath(); g.moveTo(Math.cos(a) * r * .22, Math.sin(a) * r * .22); g.lineTo(Math.cos(a) * r * .86, Math.sin(a) * r * .86); g.strokeStyle = 'rgba(90,70,40,.5)'; g.lineWidth = Math.max(.6, r * .018); g.stroke(); }
  g.restore();
  g.beginPath(); g.arc(0, 0, r * .22, 0, D.TAU); g.strokeStyle = C.gold1; g.lineWidth = Math.max(1, r * .03); g.stroke();
  g.beginPath(); g.arc(0, 0, r * .9, 0, D.TAU); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = Math.max(.5, r * .012); g.stroke();
  g.restore();
}
function toque(g, x, y, s) {   // chef's hat, pleated
  g.save(); g.translate(x, y); g.scale(s, s);
  const p = new Path2D(); p.moveTo(-5, 0); p.lineTo(-5.5, -9); p.bezierCurveTo(-9, -11, -7, -17, -3, -15.5); p.bezierCurveTo(-1.5, -19, 2.5, -19, 3.4, -15.5); p.bezierCurveTo(7.5, -17, 9, -11, 5.5, -9); p.lineTo(5, 0); p.closePath();
  const gr = g.createLinearGradient(-6, 0, 6, 0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#bdb6a6'); g.fillStyle = gr; g.fill(p);
  g.strokeStyle = 'rgba(120,110,90,.5)'; g.lineWidth = .3; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 1.8, -1); g.lineTo(i * 2.1, -9); g.stroke(); }
  g.restore();
}

export function kitchenShot(g, t) {
  const t0 = TL.KIT0, cx = camX(t);
  const X = (x, par = 1) => 960 + (x - cx * par) * PPM * par, Y = y => GROUND - y * PPM;
  // match-cut zoom from the spinning tray (first waiter's tray) out to the full frame
  const zin = 1 - D.eio(D.seg(t, t0, t0 + .62));
  const trayW = [WAITERS[0] - .55, 1.82];
  const zc = [X(trayW[0]), Y(trayW[1])];
  const Z = 1 + zin * 7.2;
  g.save();
  if (zin > 0) { g.setTransform(1, 0, 0, 1, 0, 0); g.translate(D.lerp(zc[0], 960, zin), D.lerp(zc[1], 540, zin)); g.scale(Z, Z); g.translate(-zc[0], -zc[1]); }
  // back wall: ivory/black tiles with a gold band, arched pass-through windows
  const par = .82;
  const wg = g.createLinearGradient(0, 0, 0, GROUND); wg.addColorStop(0, '#0d0a08'); wg.addColorStop(1, '#1c150d'); g.fillStyle = wg; g.fillRect(-200, -200, 2400, 1500);
  for (let k = -40; k < 80; k++) { const x = X(k * .6, par); if (x < -50 || x > 1970) continue; g.fillStyle = k % 4 ? 'rgba(201,162,75,.10)' : 'rgba(201,162,75,.28)'; g.fillRect(x, -200, k % 4 ? 2 : 3, GROUND - 1.2 * PPM + 180); }
  // wainscot: small ivory/umber tiles below the band
  const tile = .2 * PPM * par, ox = ((-cx * par * PPM) % (tile * 2) + tile * 2) % (tile * 2);
  g.fillStyle = '#cfc3a8'; g.fillRect(-200, GROUND - 1.2 * PPM, 2400, 1.2 * PPM);
  g.fillStyle = '#3a2e22';
  for (let yy = GROUND - 1.2 * PPM, r = 0; yy < GROUND; yy += tile, r++) for (let xx = -tile * 2 + ox - (r % 2 ? tile : 0); xx < 2100; xx += tile * 2) g.fillRect(xx, yy, tile, tile);
  const band = GROUND - 1.2 * PPM; g.fillStyle = '#0b0907'; g.fillRect(-200, band - 18, 2400, 30);
  D.gline(g, [[-200, band - 18], [2200, band - 18]], { w: 3 }); D.gline(g, [[-200, band + 12], [2200, band + 12]], { w: 2 });
  for (let k = -2; k < 8; k++) {   // arched windows into the dining room (warm light)
    const wx = X(k * 5.2 + 2.6, par), wy = Y(3.9), ww = 1.6 * PPM * par, wh = 2.2 * PPM * par;
    g.fillStyle = '#2a1a0c'; g.beginPath(); g.moveTo(wx - ww / 2, wy + wh * .5); g.lineTo(wx - ww / 2, wy - wh * .2); g.arc(wx, wy - wh * .2, ww / 2, Math.PI, D.TAU); g.lineTo(wx + ww / 2, wy + wh * .5); g.closePath(); g.fill();
    D.glow(g, wx, wy, ww * .8, '#ffc36a', .5);
    D.gline(g, D.arcPts(wx, wy - wh * .2, ww / 2, Math.PI, D.TAU, 24), { w: 2 });
    D.sunburst(g, wx, wy + wh * .1, { rays: 12, r0: ww * .12, r1: ww * .5, a0: Math.PI, a1: D.TAU, mode: 'lines', w: 1.2, alpha: .7 });
  }
  // counter + chefs chopping on the backbeats (kb 1,3,5,…)
  const cy = Y(1.0);
  const beatK = (t - t0) / TL.KB, back = Math.floor(beatK) % 2 === 1, ph = beatK - Math.floor(beatK);
  CHEFS.forEach((x, i) => {
    const hx = X(x), s = PPM * 1.8 / CH.PIP_H;
    const chop = back ? D.eo(D.seg(ph, 0, .18)) * (1 - D.ss(D.seg(ph, .5, 1))) : 0;
    CH.drawFigure(g, { x: hx, y: Y(0) - CH.PIP_SOLE * s * 1.05, s: s * 1.05, view: 'side', dir: 1, style: 'waiter', face: { open: .5, lid: .5, look: [.4, .8], mouth: 'line' }, armN: [D.lerp(1.9, 1.05, chop), D.lerp(.5, 1.2, chop)], armF: [.6, 1.4], lean: .1,
      item: (gg, x2, y2, a) => { gg.save(); gg.translate(x2, y2); gg.rotate(-a + Math.PI / 2); gg.fillStyle = '#d9dde2'; gg.fillRect(-1, -9, 3.5, 10); gg.fillStyle = '#2a1d10'; gg.fillRect(-.6, 1, 2.2, 3.5); gg.restore(); } });
    const hs = s * 1.05; toque(g, hx + 1.2 * hs, Y(0) - (CH.PIP_SOLE + 61 + 9) * hs, hs);
  });
  g.fillStyle = '#15110c'; g.fillRect(X(-3), cy, X(7.2) - X(-3), Y(0) - cy);
  D.gline(g, [[X(-3), cy], [X(7.2), cy]], { w: 3 }); D.chevrons(g, X(-3), X(7.2), cy + 40, { n: 18, h: 26, rows: 2, gap: 14 });
  // chopping board sparks of veg on each chop
  if (back && ph < .2) CHEFS.forEach(x => D.sparkle(g, X(x) + 70, cy - 10, 16 * (1 - ph * 5), { alpha: .8, color: '#f3d98b' }));
  // tunnel of raised trays: waiters in a row behind the path, each extends one tray over the passage
  const bob = Math.sin(beatK * Math.PI) * .03;
  WAITERS.forEach((x, i) => {
    const s = PPM * 1.78 / CH.PIP_H * .96;
    CH.drawFigure(g, { x: X(x + .35), y: Y(0) - CH.PIP_SOLE * s - bob * PPM, s, view: 'side', dir: -1, style: 'waiter', face: { open: .55, lid: .5, look: [.5, 0], mouth: 'smile' }, armN: [2.2, -.15], armF: [-.1, .3], legN: [.03, 0], legF: [-.03, 0] });
  });
  // the trays themselves (drawn over the path)
  WAITERS.forEach((x, i) => {
    let tx = X(x - .55), ty = Y(1.82 + bob);
    const spin = (t - t0) * (i === 0 ? 9 : 2) + i;
    tray(g, tx, ty, .6 * PPM, spin, i === 0 ? D.lerp(.3, 1, zin) : .3);
  });
  // the swing doors to the roof: centred on screen exactly when they burst open (the frame splits on their seam)
  { const xd = pipX(TL.T.doors) + 1.6, x0 = X(xd), hw = .95 * PPM, top = Y(2.55), bot = Y(0);
    if (x0 - hw < 2000) {
      g.fillStyle = '#060504'; g.fillRect(x0 - hw - 30, top - 40, hw * 2 + 60, bot - top + 40);
      D.archFrame(g, x0, bot, hw * 2 + 50, bot - top + 60, { rings: 2, gap: 12, steps: 2, crown: 'flat', burst: false, lw: 2 });
      for (const sd of [-1, 1]) {
        const lx = sd < 0 ? x0 - hw : x0; const lg = g.createLinearGradient(lx, 0, lx + hw, 0); lg.addColorStop(0, '#3a2412'); lg.addColorStop(.5, '#5a3a1c'); lg.addColorStop(1, '#2a180a');
        g.fillStyle = lg; g.fillRect(lx, top, hw, bot - top); D.gline(g, D.rectPts(lx, top, hw, bot - top), { w: 2 });
        const pc = [lx + hw / 2, top + (bot - top) * .3]; g.beginPath(); g.arc(pc[0], pc[1], hw * .28, 0, D.TAU); g.fillStyle = 'rgba(200,215,230,.55)'; g.fill();
        D.gline(g, D.arcPts(pc[0], pc[1], hw * .28, 0, D.TAU, 40), { w: 3 }); D.glow(g, pc[0], pc[1], hw * .5, '#dfe8f0', .25);
        D.chevrons(g, lx + 20, lx + hw - 20, top + (bot - top) * .62, { n: 4, h: 24, rows: 3, gap: 14 });
      } } }
  // Pip
  const px = pipX(t), sP = PPM * CH.PIP_M / CH.PIP_H;
  const ts = TL.T.trays, capHit = TL.T.capHit, capLand = TL.T.capLand;
  let pose, bob2 = 0, face = 'determined', capOff = false;
  if (t >= ts - .12 && t < ts + .62) {
    const e = D.ss(D.seg(t, ts - .12, ts + .05)) * (1 - D.ss(D.seg(t, ts + .42, ts + .62)));
    const rc = CH.runCycle((t - t0) * 2.1);
    pose = CH.lerpPose(rc.pose, CH.POSES.slide, e); bob2 = D.lerp(rc.bob, 20 * e, e); face = 'calm';
  } else { const rc = CH.runCycle((Math.floor((t - t0) * 12) / 12) * 2.1); pose = rc.pose; bob2 = rc.bob; face = t > ts ? 'calm' : 'determined'; }
  if (t > capHit && t < capLand) capOff = true;
  const whistle = t > TL.T.whistle - .05 && t < TL.T.doors - .05;
  if (whistle) face = { open: 0, arc: 'down', brow: -.6, mouth: 'o', mOpen: .12 };
  CH.drawFigure(g, { x: X(px), y: Y(0) - (CH.PIP_SOLE - bob2) * sP, s: sP, view: 'side', dir: 1, face, ...pose, letter: 'N', cap: capOff ? { off: true } : undefined });
  // the flying cap: ballistic arc with spin from the hit to the landing
  if (capOff) {
    const k = D.seg(t, capHit, capLand), x0 = pipX(capHit) + .12, x1 = pipX(capLand) + .12;
    const headY = 1.62, peak = 3.1, y = headY + (peak - headY) * 4 * k * (1 - k);
    const cx2 = X(D.lerp(x0, x1, k)), cy2 = Y(y);
    for (let j = 1; j < 5; j++) { const kj = Math.max(0, k - j * .025), yj = headY + (peak - headY) * 4 * kj * (1 - kj); D.sparkle(g, X(D.lerp(x0, x1, kj)), Y(yj), 14 - j * 2.5, { alpha: .5 - j * .1, glow: 0 }); }
    g.save(); g.translate(cx2, cy2); g.rotate(k * D.TAU * 3); g.scale(sP * 1.6, sP * 1.6);
    g.fillStyle = '#8e1b2e'; g.fillRect(-4.2, -3.1, 8.4, 6.2); g.fillStyle = D.goldGrad(g, -4, 0, 4, 0, { sheen: .3 }); g.fillRect(-4.2, 1.3, 8.4, 1.8);
    g.beginPath(); g.ellipse(0, -3.1, 4.2, 1.2, 0, 0, D.TAU); g.fillStyle = '#d4485c'; g.fill();
    g.restore();
    D.speedLines(g, cx2, cy2, Math.atan2(-(Y(y) - Y(headY + (peak - headY) * 4 * Math.max(0, k - .05) * (1 - k + .05))), 1), { n: 3, len: 60, spread: 20, w: 2, alpha: .5, seed: 2 });
  }
  if (t > capHit && t < capHit + .18) D.sparkle(g, X(pipX(capHit) + .1), Y(1.8), 40 * (1 - (t - capHit) / .18), { alpha: 1 });
  if (t > capLand && t < capLand + .2) D.sparkle(g, X(px) + 10, Y(1.85), 34 * (1 - (t - capLand) / .2), { alpha: 1 });
  // whistle notes (gold ♪ glyphs) rising from his mouth on the four whistle notes
  if (whistle) [0, 1, 2, 3].forEach(i => {
    const tn = TL.T.whistle + i * TL.KB / 2, a = t - tn; if (a < 0 || a > .9) return;
    g.save(); g.globalAlpha = 1 - a / .9; g.font = `700 ${46 + i * 4}px Josefin`; g.fillStyle = C.gold2; g.fillText('♪', X(px) + 60 + a * 90, Y(1.5) - a * 140 - i * 10); g.restore();
  });
  // foreground: hanging copper pots & ladles (parallax 1.35), steam
  const fp = 1.35;
  for (let k = -3; k < 14; k++) {
    const x = X(k * 2.6, fp), y = 60 + (k % 3) * 30;
    if (x < -300 || x > 2200) continue;
    D.gline(g, [[x, -10], [x, y]], { w: 2 });
    g.save(); g.translate(x, y); const r = 70 + (k % 2) * 30;
    g.beginPath(); g.arc(0, r * .9, r, Math.PI * 1.05, Math.PI * 1.95, true); g.closePath();
    const cg = g.createLinearGradient(-r, 0, r, 0); cg.addColorStop(0, '#2a1208'); cg.addColorStop(.4, '#b86a3a'); cg.addColorStop(1, '#1a0a05'); g.fillStyle = cg; g.fill();
    g.strokeStyle = C.gold1; g.lineWidth = 2; g.stroke(); g.restore();
  }
  for (let i = 0; i < 6; i++) { const sx = X(i * 3.3 + 1, .95), a = ((t * .5 + i * .37) % 1); D.glow(g, sx, Y(1.1 + a * 1.8), 60 + a * 60, '#fff6e6', .12 * (1 - a)); }
  g.restore();
  D.vignette(g, 1920, 1080, .45);
}
