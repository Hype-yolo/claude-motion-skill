// The Runaway Loaf — film assembly.
// Frame pipeline: shot paints a tonal 4:3 frame → Redraw (ink lines, wash steps, boiling hatch) → iris (a mask in the camera)
// → FilmPost (silver/sepia print, grain, flicker, weave, scratches, burn) → dust/hair → projected into the 4:3 gate
// between theatre curtains. Motion is sampled at 16 fps ("hand-cranked"); flicker and weave run at 24.
import { Redraw } from './engine/redraw.js';
import { FilmPost, damage } from './engine/film.js';
import { intertitle, iris, theatre } from './engine/cards.js';
import { setFrame, S as IS } from './engine/ink.js';
import { SEC, DUR as D, HIT, secAt } from './timeline.js';
import { CARDS } from './cardspecs.js';
import * as SH from './shots.js';

export const DUR = D;
const W = 1920, H = 1080, FW = 1440, FH = 1080, GATE = { x: 240, y: 0, w: FW, h: FH };
const fc = document.createElement('canvas'); fc.width = FW; fc.height = FH; const fg = fc.getContext('2d');
let RD = null, FP = null;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ss = x => { x = clamp(x); return x * x * (3 - 2 * x); };

// per-section film look: crank = projector speed feel, str = damage, sepia (warmer when tender), fps = motion sampling
const LOOK = {
  PRE: { str: .7, sepia: .12, fps: 16 }, TITLE: { str: .55, sepia: .14, fps: 16 }, BAKERY: { str: .5, sepia: .14, fps: 16 },
  CARD1: { str: .55, sepia: .14, fps: 16 }, CHASE: { str: .85, sepia: .1, fps: 18, crank: 1.35 }, MARKET: { str: .8, sepia: .1, fps: 18, crank: 1.3 },
  CARD2: { str: .8, sepia: .1, fps: 16, crank: 1.3 }, ROLL: { str: .55, sepia: .14, fps: 16 }, SIL: { str: .45, sepia: .18, fps: 16 },
  CARD3: { str: .4, sepia: .26, fps: 16 }, TENDER: { str: .32, sepia: .34, fps: 16 }, IRIS: { str: .3, sepia: .36, fps: 16 }, END: { str: .45, sepia: .3, fps: 16 },
};

// shot table: section → shot fn(g, lt, t) painting the tonal frame (lt = seconds since section start)
const SHOTS = { BAKERY: SH.bakery, CHASE: SH.chase, MARKET: SH.market, ROLL: SH.roll, SIL: SH.sil, TENDER: SH.tender, IRIS: SH.irisShot };

export function renderFilm(g, t, Q) {
  RD = RD || new Redraw(FW, FH); FP = FP || new FilmPost(FW, FH);
  const sec = secAt(t), look = LOOK[sec.name], frame = Math.floor(t * 24 + 1e-6);
  const ta = Math.floor(t * look.fps + 1e-6) / look.fps;            // hand-cranked motion sampling
  const lt = Math.max(0, ta - sec.t0);
  fg.setTransform(1, 0, 0, 1, 0, 0); fg.globalAlpha = 1; fg.globalCompositeOperation = 'source-over'; fg.filter = 'none';
  let src = fc, exposure = 1;
  const card = CARDS[sec.name];
  if (sec.name === 'PRE') {
    // dark screen, the lamp strikes up: two flashes of clear leader, then the title card fades up behind the curtains
    fg.fillStyle = '#0e0d0b'; fg.fillRect(0, 0, FW, FH);
    exposure = .25 + .6 * ss((t - HIT.curtain) / .6);
  } else if (card) {
    intertitle(fg, FW, FH, card, t - sec.t0);
  } else {
    setFrame(ta, { boil: 1 }); IS.sepLine = .5;
    fg.fillStyle = '#fff'; fg.fillRect(0, 0, FW, FH);
    fg.save(); SHOTS[sec.name](fg, lt, ta); fg.restore();
    src = RD.render(fc, { frame });
  }
  // iris masks happen in the camera, so they are printed (aged) with the frame
  const ir = irisAt(t);
  if (ir) {
    if (src !== fc) { fg.setTransform(1, 0, 0, 1, 0, 0); fg.drawImage(src, 0, 0); src = fc; }
    iris(fg, FW, FH, ir.x, ir.y, ir.r, 4);
  }
  const fp = { frame, strength: look.str, sepia: look.sepia, crank: look.crank ?? 1, exposure };
  if (card) fp.halation = 1.4;
  const dev = FP.render(src, fp);
  // curtains: part at the start, close at the end
  const curtain = t < HIT.title ? ss((t - HIT.curtain) / 1.1) : 1 - ss((t - HIT.curtainOut) / 1.1);
  theatre(g, W, H, GATE, Math.max(.3, FP.mean * (sec.name === 'PRE' ? exposure : 1)), curtain);
  g.save(); g.beginPath(); g.roundRect(GATE.x, GATE.y, GATE.w, GATE.h, 22); g.clip();
  g.drawImage(dev, GATE.x, GATE.y);
  damage(g, GATE.x, GATE.y, FW, FH, frame, look.str);
  g.restore();
  // curtains are in front of the screen: redraw them over the image when they are (partly) closed
  if (curtain < 1) curtainsOver(g, curtain, Math.max(.55, FP.mean));   // footlights keep the closed velvet visible
}

function curtainsOver(g, open, spill) {
  // velvet drapes sliding in from both sides over the screen (theatre() only paints the side masking)
  const cover = (1 - open) * (W / 2 + 10);
  if (cover < 1) return;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  theatre(x, W, H, { x: W / 2, y: 0, w: 0, h: H }, spill, 1);
  g.save();
  g.drawImage(c, 0, 0, W / 2, H, cover - W / 2, 0, W / 2, H);          // left drape slides in
  g.drawImage(c, W / 2, 0, W / 2, H, W - cover, 0, W / 2, H);          // right drape slides in
  // footlights: warm light washing up the velvet from the stage edge
  g.save(); g.beginPath(); g.rect(0, 0, cover, H); g.rect(W - cover, 0, cover, H); g.clip();
  g.globalCompositeOperation = 'screen';
  const fl = g.createRadialGradient(W / 2, H + 120, 60, W / 2, H + 120, 1250);
  fl.addColorStop(0, 'rgba(255,170,110,.42)'); fl.addColorStop(.55, 'rgba(170,70,50,.16)'); fl.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fl; g.fillRect(0, 0, W, H); g.restore();
  // a soft shadow at each leading edge
  for (const [x0, dir] of [[cover, -1], [W - cover, 1]]) { const gr = g.createLinearGradient(x0, 0, x0 + dir * 60, 0); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(Math.min(x0, x0 + dir * 60), 0, 60, H); }
  g.restore();
}

// iris in / out (film coordinates)
function irisAt(t) {
  const full = 1900;
  if (t >= SEC.BAKERY.t0 && t < HIT.lift + .5) {                     // opens on the loaf held high
    const k = ss((t - HIT.irisOpen) / (HIT.lift + .45 - HIT.irisOpen));
    return { x: 575, y: 560, r: 6 + k * full };                        // on the loaf in his hands
  }
  if (t >= SEC.IRIS.t0 && t < SEC.IRIS.t1) {                         // closes on the girl, stops for the wink, then shuts
    const b = (t - SEC.IRIS.t0) / SEC.IRIS.beat;
    const c = SH.girlFace(t - SEC.TENDER.t0);
    let r;
    if (b < 2) r = full - (full - 190) * ss(b / 2);
    else if (b < 3.3) r = 190;
    else r = 190 * (1 - ss((b - 3.3) / .6));
    return { x: c[0], y: c[1], r: Math.max(0.5, r) };
  }
  return null;
}

export function events() {
  const ev = [];
  for (const k in SEC) ev.push({ t: SEC[k].t0, type: 'section', name: k });
  for (const k in HIT) ev.push({ t: HIT[k], type: 'hit', name: k });
  return ev.sort((a, b) => a.t - b.t);
}
