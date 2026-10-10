// Film assembly: shot list on the timeline grid, in-media transitions (symmetric door splits, revolving-door wipe, match cuts),
// subtitle cards. Everything is deterministic in t.
import * as D from './engine/deco.js';
import * as T from './engine/type.js';
import * as TL from './timeline.js';
import { titleShot, envelopeInsert, ballroomShot, endDial, endCard } from './shots_misc.js';
import { streetShot, pullShot } from './shots_out.js';
import { lobbyWide, lobbyButton, lobbyFace } from './shots_lobby.js';
import { stairShot } from './shots_stairs.js';
import { kitchenShot } from './shots_kitchen.js';
import { roofRun, towerClock, roofThrow, letterFall, theCatch, bandleader, signLights, lastLetter } from './shots_roof.js';
import { doors } from './scenes/lobby.js';

export const DUR = TL.DUR;
const Tm = TL.T;
const SHOTS = [
  [0, Tm.street, titleShot, 'title'],
  [Tm.street, Tm.envelope, streetShot, 'street'],
  [Tm.envelope, Tm.wing1, envelopeInsert, 'envelope'],
  [Tm.wing1, Tm.press1, lobbyWide, 'lobby wide'],
  [Tm.press1, Tm.faceCU, lobbyButton, 'button'],
  [Tm.faceCU, Tm.stair, lobbyFace, 'face'],
  [Tm.stair, TL.KIT0, stairShot, 'stairs'],
  [TL.KIT0, TL.ROOF0, kitchenShot, 'kitchen'],
  [TL.ROOF0, TL.CLOCK - .26, roofRun, 'roof run'],
  [TL.CLOCK - .26, TL.CLOCK + .3, towerClock, 'clock'],
  [TL.CLOCK + .3, Tm.release + .1, roofThrow, 'throw'],
  [Tm.release + .1, TL.STRIKE1, letterFall, 'fall'],
  [TL.STRIKE1, TL.strike(2), theCatch, 'catch'],
  [TL.strike(2), TL.strike(5), bandleader, 'bandleader'],
  [TL.strike(5), TL.strike(12), signLights, 'sign'],
  [TL.strike(12), TL.TUTTI, lastLetter, 'last T'],
  [TL.TUTTI, TL.PULL0, ballroomShot, 'ballroom'],
  [TL.PULL0, TL.FINAL, pullShot, 'pull-back'],
  [TL.FINAL, TL.DOORS1, endDial, 'dial'],
  [TL.DOORS1, TL.DUR + 1, endCard, 'card'],
];
export const shotAt = t => SHOTS.find(s => t < s[1]) || SHOTS[SHOTS.length - 1];

// transitions: [t0, t1, kind, outgoingShotFn]
const TR = [
  [Tm.archOpen, Tm.street, 'split', titleShot, streetShot],          // title arch splits open onto the street
  [Tm.wing1, Tm.wing2 + .08, 'revolve', envelopeInsert, lobbyWide],   // revolving-door wings sweep the envelope away into the lobby
  [Tm.snare, Tm.stair, 'split', lobbyFace, stairShot],                // stair doors burst open
  [Tm.doors, TL.ROOF0, 'split', kitchenShot, roofRun],                // kitchen swing doors burst open onto the roof
  [TL.DOORS0, TL.DOORS1, 'close', null, null],                        // elevator doors close into the end card
];

let offA = null;
const off = () => { if (!offA) { offA = document.createElement('canvas'); offA.width = 1920; offA.height = 1080; } return offA; };

function splitOpen(g, img, p) {
  // the outgoing frame is two door leaves hinged at the outer edges; they swing open (foreshortened) from the centre seam
  const e = D.eio(D.seg(p, .12, 1)), seamGlow = 1 - D.seg(p, 0, .35);
  for (const sd of [-1, 1]) {
    const w = 960 * (1 - e);
    if (w < 1) continue;
    g.save();
    const sx = sd < 0 ? 0 : 960;
    g.beginPath(); g.rect(sd < 0 ? 0 : 1920 - w, 0, w, 1080); g.clip();
    g.translate(sd < 0 ? 0 : 1920, 0); g.scale((1 - e) * sd, 1);
    g.drawImage(img, sd < 0 ? 0 : 960, 0, 960, 1080, sd < 0 ? 0 : -960, 0, 960, 1080);
    g.restore();
    // shading on the swinging leaf + gold edge
    const ex = sd < 0 ? w : 1920 - w;
    const sh = g.createLinearGradient(sd < 0 ? 0 : 1920, 0, ex, 0); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, `rgba(0,0,0,${.55 * e})`);
    g.fillStyle = sh; g.fillRect(sd < 0 ? 0 : ex, 0, w, 1080);
    D.gline(g, [[ex, 0], [ex, 1080]], { w: 3, glow: .8 });
  }
  if (seamGlow > 0) { D.glow(g, 960, 540, 700, '#ffd8a0', .45 * seamGlow, 2.2); D.gline(g, [[960, 0], [960, 1080]], { w: 3, glow: 1, alpha: seamGlow }); }
}
function revolve(g, img, t) {
  // wing 1 sweeps right→left across the frame (a glass panel with gold mullions); behind it the lobby, in front the envelope
  const k1 = D.eio(D.seg(t, Tm.wing1, Tm.wing2 - .05));
  const x = D.lerp(2100, -180, k1);
  g.save(); g.beginPath(); g.rect(0, 0, Math.max(0, x), 1080); g.clip(); g.drawImage(img, 0, 0); g.restore();
  const panel = (px, a) => {
    if (px < -250 || px > 2150) return;
    const w = 220; g.save(); g.globalAlpha = a;
    const gg = g.createLinearGradient(px - w / 2, 0, px + w / 2, 0); gg.addColorStop(0, 'rgba(255,220,160,.05)'); gg.addColorStop(.5, 'rgba(255,236,200,.28)'); gg.addColorStop(1, 'rgba(255,220,160,.05)');
    g.fillStyle = gg; g.fillRect(px - w / 2, 0, w, 1080);
    D.gline(g, [[px - w / 2, 0], [px - w / 2, 1080]], { w: 4, glow: .6 }); D.gline(g, [[px + w / 2, 0], [px + w / 2, 1080]], { w: 2.5 });
    for (const y of [360, 380, 700, 720]) D.gline(g, [[px - w / 2, y], [px + w / 2, y]], { w: 1.4 });
    g.restore();
  };
  panel(x, 1);
  const k2 = D.eio(D.seg(t, Tm.wing2 - .05, Tm.wing2 + .08));
  if (k2 > 0 && k2 < 1) panel(D.lerp(2100, -180, k2), .7);
}

export function renderFilm(g, t, Q) {
  const shot = shotAt(t);
  const tr = TR.find(r => t >= r[0] && t < r[1]);
  if (tr && tr[4]) tr[4](g, t); else shot[2](g, t);
  if (tr) {
    const p = (t - tr[0]) / (tr[1] - tr[0]);
    if (tr[2] === 'close') {
      // two bronze leaves slide in from the edges and meet at the seam (the end card's doors)
      const e = D.eio(p), w = 960 * e;
      doors(g, 960, 1080, 1920, 1080, 1 - e, true, false);
      D.vignette(g, 1920, 1080, .4);
    } else {
      const h = off().getContext('2d'); h.setTransform(1, 0, 0, 1, 0, 0); h.globalAlpha = 1; h.globalCompositeOperation = 'source-over';
      tr[3](h, tr[2] === 'split' ? Math.min(t, tr[0] + .02) : t);
      if (tr[2] === 'split') splitOpen(g, off(), p);
      else revolve(g, off(), t);
    }
  }
  if (!(Q && Q.has && Q.has('nosub'))) drawSubs(g, t);
}

// ---------- subtitles ----------
let LINES = [], DURS = {};
export async function init() {
  LINES = await (await fetch('lines.json')).json();
  DURS = await (await fetch('voices/dur.json')).json();
}
export function subs() {
  return TL.LINES.map(l => {
    const L = LINES.find(x => x.id === l.id) || {}, d = DURS[l.id] || 2;
    return { id: l.id, t0: l.t, t1: l.t + Math.max(1.8, d + .6), text: L.sub || L.text, who: l.who };
  });
}
function drawSubs(g, t) {
  for (const s of subs()) {
    if (t < s.t0 - .05 || t > s.t1 + .3) continue;
    const p = D.seg(t, s.t0 - .05, s.t0 + .3), out = D.seg(t, s.t1 - .05, s.t1 + .25);
    T.subtitleCard(g, s.text, { p, out, speaker: s.who === 'boy' ? 'boy' : 'radio', cy: 990, size: 40 });
  }
}
export function events() { return SHOTS.map(s => ({ t: s[0], type: 'shot', name: s[3] })); }
