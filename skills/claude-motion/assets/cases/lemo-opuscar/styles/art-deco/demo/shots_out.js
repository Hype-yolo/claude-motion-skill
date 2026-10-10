// Exterior shots: street crane-down (S) and the finale pull-back (R5).
import * as D from './engine/deco.js';
import * as CH from './chars.js';
import * as TL from './timeline.js';
import { drawTower, Z0, SIGN_H, SIGN_Y } from './scenes/tower.js';

export function pipOnGround(g, cam, x, z, P) {
  const f = cam.P(x, 0, z); if (f[2] < .3) return;
  const s = cam.scaleAt(x, 0, z) * CH.PIP_M / CH.PIP_H;
  g.save(); g.translate(f[0], f[1]); g.scale(1, .2); D.glow(g, 0, 0, s * 40, '#000000', .7); g.restore();
  CH.drawFigure(g, { x: f[0], y: f[1] - CH.PIP_SOLE * s, s, ...P });
}

export function streetShot(g, t) {
  const t0 = TL.T.street, t1 = TL.T.envelope;
  const k = D.eio(D.seg(t, t0 + .1, t1 - .5));
  // true crane-down: from the dark sign (frontal) all the way down the facade to the kerb
  const y = D.lerp(SIGN_Y + 2.2, 1.45, k), pitch = D.lerp(.02, .1, k), f = D.lerp(1850, 1000, D.ss(D.seg(t, t0, t1 - .6)));
  const { cam } = drawTower(g, {
    t, cam: { x: -1.3, y, z: -8, f, pitch }, lit: () => 0, clock: { h: 11, m: 55, s: 0 },
  });
  // Pip at the kerb, back view, head tilted up at the dark sign; a small breath of anticipation before he runs in
  const look = D.ss(D.seg(t, t1 - 1.4, t1 - .8));
  pipOnGround(g, cam, -.5, -4.6, { view: 'back', ...CH.FRONT_POSES.stand, armN: [.25, .5], armF: [.1, .15], letter: 'N', headTilt: -.25 * look, cap: { rot: -.05, dy: -.6 * look } });
  D.vignette(g, 1920, 1080, .45);
}

// Finale: start on Pip standing in the lit sign waving his cap, fly back to reveal the whole tower + fireworks.
export function pullShot(g, t) {
  const t0 = TL.PULL0, t1 = TL.FINAL;
  const k = D.eio(D.seg(t, t0, t1 + .6));
  const px0 = 9.2;   // Pip's x on the catwalk (right part of the sign)
  const z = D.lerp(Z0 + 4 - .9 - 3.4, -95, Math.pow(k, .8)), y = D.lerp(SIGN_Y + .95, 44, k), x = D.lerp(px0, 0, D.ss(k));
  const pitch = D.lerp(.0, .14, k);
  const fw = [];
  for (let i = 0; i < 10; i++) fw.push({ x: (i % 2 ? 1 : -1) * (14 + (i * 7) % 26), y: 96 + (i * 13) % 34, z: Z0 + 10 + (i * 5) % 20, t0: t0 + .5 + i * TL.B, r: 6 + (i % 3) * 3, col: i % 3 ? '#ffd27a' : '#f6e8c4' });
  const chase = (li, bi, gi) => { const ph = ((gi - (t - t0) * 22) % 6 + 6) % 6; return ph < 2 ? 1.3 : .82; };
  drawTower(g, {
    t, cam: { x, y, z, f: 1000, pitch }, lit: chase, fireworks: fw, moon: true,
    pip: (g, cam, sg) => {
      const px = 9.2, pz = sg.zS - .9, f = cam.P(px, sg.y0, pz); if (f[2] < .5) return;
      const s = cam.scaleAt(px, sg.y0, pz) * CH.PIP_M / CH.PIP_H;
      const wave = Math.sin((t - t0) * Math.PI * 2 / (TL.B * 2)) * .35;
      CH.drawFigure(g, { x: f[0], y: f[1] - CH.PIP_SOLE * s, s, view: 'front', face: 'joy', ...CH.FRONT_POSES.capwave, armN: [2.9 + wave, .5], cap: { off: true },
        item: (gg, hx, hy, a) => { gg.save(); gg.translate(hx, hy - 3.5); gg.rotate(-a + Math.PI + .3); gg.fillStyle = '#8e1b2e'; gg.fillRect(-4.2, -3.1, 8.4, 6.2); gg.fillStyle = D.goldGrad(gg, -4, 0, 4, 0, { sheen: .3 }); gg.fillRect(-4.2, 1.3, 8.4, 1.8); gg.beginPath(); gg.ellipse(0, -3.1, 4.2, 1.2, 0, 0, D.TAU); gg.fillStyle = '#d4485c'; gg.fill(); gg.restore(); } });
      // the cap in his raised hand
    },
  });
  D.vignette(g, 1920, 1080, .45);
}
