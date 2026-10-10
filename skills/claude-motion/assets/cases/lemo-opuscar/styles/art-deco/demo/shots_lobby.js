// Lobby shots (L): wide run, button presses + OUT OF ORDER plaque, face close-up (panic → silence → cap fix → resolve).
import * as D from './engine/deco.js';
import * as T from './engine/type.js';
import * as CH from './chars.js';
import * as TL from './timeline.js';
import { drawLobby } from './scenes/lobby.js';

const pipAt = (g, cam, x, z, P, shadow = true) => {
  const f = cam.P(x, 0, z), s = cam.scaleAt(x, 0, z) * CH.PIP_M / CH.PIP_H;
  if (shadow) { g.save(); g.translate(f[0], f[1]); g.scale(1, .22); D.glow(g, 0, 0, s * 38, '#000000', .75); g.restore(); }
  CH.drawFigure(g, { x: f[0], y: f[1] - (CH.PIP_SOLE - (P.bob || 0)) * s, s, ...P });
  return { f, s };
};

// 12.931 → 14.483: wide, Pip sprints up the runner toward the elevator; slow push-in
export function lobbyWide(g, t) {
  const t0 = TL.T.wing2, t1 = TL.T.press1, k = D.seg(t, t0 - .5, t1);
  const camZ = D.lerp(0, 1.4, D.eio(D.seg(t, t0 - .5, t1)));
  drawLobby(g, {
    t, dial: 0, clock: { h: 11, m: 57, s: 20 + (t - t0) * 8 }, cam: { z: camZ },
    pip: (g, cam) => {
      const z = D.lerp(2.6, 10.6, D.ss(k)), x = D.lerp(-.3, .6, k);
      const ph = Math.floor((t - t0) * 12) / 12 * 1.9;          // 12 fps stepping
      const r = CH.runFront(ph);
      pipAt(g, cam, x, z, { view: 'back', ...r, bob: r.bob, letter: 'N', cap: { rot: -.08 } });
    },
  });
}

// 14.483 → 16.552: medium at the elevator. Three presses (a hopeful one, two impatient), nothing; then the plaque drops.
export function lobbyButton(g, t) {
  const tp = TL.T.plaque, since = t - tp;
  const shake = since > 0 && since < .35 ? Math.sin(since * 90) * 6 * (1 - since / .35) : 0;
  g.save(); g.translate(0, shake);
  drawLobby(g, {
    t, dial: 0, clock: { h: 11, m: 57, s: 40 }, cam: { x: .55, y: 1.3, z: 8.4, f: 1150, oy: 560 }, guests: false,
    btnUp: [TL.T.press1, TL.T.press2, TL.T.press3].some(p => t > p && t < p + .12) ? 1 : 0,
    plaque: since > 0 ? Math.min(1 + since * .0, since / .28) + (since > .28 ? (since - .28) : 0) : null,
    pip: (g, cam) => {
      // press = arm extends to the panel on each press time
      let armN = [.08, .15], lean = 0, face = 'neutral', recoil = 0;
      for (const p of [TL.T.press1, TL.T.press2, TL.T.press3]) { const d = t - p; if (d > -.12 && d < .22) { const e = d < 0 ? D.ss((d + .12) / .12) : 1 - D.ss(d / .22); armN = [D.lerp(.08, 1.25, e), D.lerp(.15, .5, e)]; lean = .06 * e; } }
      if (t > TL.T.press2 - .1) face = 'worry';
      if (since > 0) { recoil = D.back(D.seg(since, 0, .25)); face = 'panic'; armN = [D.lerp(.08, 1.1, recoil), D.lerp(.2, 1.9, recoil)]; lean = -.22 * recoil; }
      const foot = t > TL.T.press2 && since < 0 ? Math.max(0, Math.sin((t - TL.T.press2) * Math.PI * 2 / TL.B * 2)) * .35 : 0;   // impatient toe tap on eighths
      pipAt(g, cam, .72 - recoil * .35, 12.25 - recoil * .5, { view: 'side', dir: 1, face, lean, armN, armF: [-.1 + recoil * .9, .3 + recoil * 1.4], legN: [.05 + foot * .5 + recoil * .25, -foot], legF: [-.04 - recoil * .3, -recoil * .2], letter: 'F' });
    },
  });
  g.restore();
}

// 16.552 → 18.103: close-up. "Out of order?!" → silence (two ticks) → eyes to the letter → fixes his cap → resolve.
export function lobbyFace(g, t) {
  const t0 = TL.T.faceCU, t1 = TL.T.snare;
  const push = D.eio(D.seg(t, t0, t1 + .3));
  // background: the lobby, far and soft (a low-res render scaled up with blur)
  const bg = bgLobby(t);
  g.save(); g.filter = 'blur(10px)'; g.drawImage(bg, -40, -40, 2000, 1160); g.filter = 'none'; g.restore();
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, 1920, 1080);
  const s = D.lerp(24, 27, push), x = 900 + push * 30, y = 520;
  const tl = TL.LINES.find(l => l.id === 'B1').t;
  let face = 'panic', tilt = 0, look = null;
  if (t > tl + .95) face = { ...CH.FACES.worry, look: [-.3, .9] };              // glance down at the letter
  if (t > TL.T.capFix + .1) face = 'determined';
  const talk = t > tl && t < tl + .8 ? Math.abs(Math.sin((t - tl) * 18)) : 0;
  if (face === 'panic') face = { ...CH.FACES.panic, mOpen: .3 + talk * .7 };
  // the hand fixing the cap: rises into frame, tugs the brim (cap rotates from askew to straight)
  const fix = D.seg(t, TL.T.capFix - .25, TL.T.capFix + .2), capRot = D.lerp(.12, -.06, D.ss(fix)) * (t > TL.T.capFix - .25 ? 1 : 1);
  const breathe = Math.sin((t - t0) * 3) * .006;
  // the real figure at close-up scale: head centre at (x, y)
  const up = D.ss(D.seg(t, TL.T.capFix - .4, TL.T.capFix - .05)) * (1 - D.ss(D.seg(t, TL.T.capFix + .3, TL.T.capFix + .7)));
  const shrug = t < tl + .9 ? D.ss(D.seg(t, tl - .1, tl + .2)) * (1 - D.ss(D.seg(t, tl + .6, tl + 1))) : 0;   // shoulders jump on the line
  const fixArm = CH.armIK(CH.shoulderR('q'), [5.6, -70.5], CH.STY.pip.uarm, CH.STY.pip.farm + 2.2, -1);
  const pose = CH.lerpPose({ ...CH.FRONT_POSES.stand, armN: [.25 + shrug * .5, .4 + shrug * 1.2], armF: [.25 + shrug * .5, .4 + shrug * 1.2] }, { ...CH.FRONT_POSES.stand, armN: fixArm, armF: [.2, .3] }, up);
  pose.armsOver = up > .05;
  const capR = t < TL.T.capFix - .2 ? .1 : D.lerp(.1, -.04, D.ss(D.seg(t, TL.T.capFix - .2, TL.T.capFix + .15)));
  CH.drawFigure(g, { x, y: y + (60.6 + shrug * 1.2) * s, s: s * (1 + breathe), view: 'q', face, ...pose, cap: { rot: capR }, headTilt: t > TL.T.capFix ? -.05 : .02 });
  D.vignette(g, 1920, 1080, .55);
}
let bgCanvas = null, bgT = -1;
function bgLobby(t) {
  if (!bgCanvas) { bgCanvas = document.createElement('canvas'); bgCanvas.width = 1920; bgCanvas.height = 1080; }
  if (bgT < 0) { const h = bgCanvas.getContext('2d'); drawLobby(h, { t, dial: 0, cam: { x: -1.5, y: 1.5, z: 6.5, f: 900, oy: 560 }, guests: true }); bgT = t; }
  return bgCanvas;
}
