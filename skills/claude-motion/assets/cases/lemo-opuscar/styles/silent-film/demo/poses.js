// Key poses and expressions for The Runaway Loaf (built on engine/figure.js P0()).
import { P0, runPose, mixPose } from './engine/figure.js';
import { drawLoaf, drawBoule, drawBouleHalf } from './chars.js';

export const EXPR = {
  deadpan: { open: .78, brow: 0, look: [0, 0] },
  proud: { open: .32, brow: .5, browA: -.35, smile: .75, look: [0, -.3] },
  alarm: { open: 1.35, brow: 1.3, browA: .5, mouthOpen: .55, mouthW: .75 },
  tender: { open: .55, brow: .35, browA: .85, smile: .65, look: [.2, .5] },
  wink: { open: .9, brow: .3, smile: .7, wink: 1, winkAmt: 1 },
  worry: { open: .95, brow: .5, browA: .6, smile: -.2 },
};
const clone = o => JSON.parse(JSON.stringify(o));
export function pose(name, k = 1) {
  const p = P0();
  switch (name) {
    case 'lift': {       // the loaf held high over his head, chin up
      Object.assign(p, { lean: -.1, nod: -.28, headTilt: 0 });
      p.aL = { fl: 2.85, abd: .1, el: .55, wr: .15, hand: 'grip', edge: .8 }; p.aR = { fl: 2.85, abd: .1, el: .55, wr: .15, hand: 'grip', edge: .8 };
      p.L = { hip: .1, abd: .1, knee: .05, ankle: 0 }; p.R = { hip: -.12, abd: .06, knee: 0, ankle: .05 };
      p.expr = EXPR.proud; break;
    }
    case 'crouch': {     // anticipation before the lift
      Object.assign(p, { lean: .3, nod: .15 });
      p.aL = { fl: .55, abd: .2, el: 1.2, wr: 0, hand: 'grip' }; p.aR = { fl: .55, abd: .2, el: 1.2, wr: 0, hand: 'grip' };
      p.L = { hip: .75, abd: .1, knee: 1.1, ankle: .3 }; p.R = { hip: .45, abd: .06, knee: 1.0, ankle: .5 };
      p.expr = EXPR.deadpan; break;
    }
    case 'carry': {      // loaf held in front with both hands
      p.aL = { fl: .75, abd: .05, el: .95, wr: .1, hand: 'grip' }; p.aR = { fl: .75, abd: .05, el: .95, wr: .1, hand: 'grip' };
      p.expr = EXPR.proud; break;
    }
    case 'hang': {       // hanging from a rail by both hands, legs dangling
      Object.assign(p, { lean: -.05, nod: .25 });
      p.aL = { fl: 3.0, abd: .15, el: .08, wr: .05, hand: 'grip', edge: .8 }; p.aR = { fl: 3.05, abd: .1, el: .1, wr: .05, hand: 'grip', edge: .8 };
      p.L = { hip: .25, abd: .08, knee: .45, ankle: -.5 }; p.R = { hip: -.1, abd: .05, knee: .25, ankle: -.6 };
      p.expr = EXPR.deadpan; break;
    }
    case 'kneel': {      // one knee down, breaking the loaf
      Object.assign(p, { lean: .12, nod: .2 });
      p.L = { hip: 1.45, abd: .08, knee: 1.5, ankle: .1 }; p.R = { hip: -.15, abd: .05, knee: 1.95, ankle: -.95 };
      p.aL = { fl: .9, abd: .3, el: .55, wr: .1, hand: 'grip' }; p.aR = { fl: .9, abd: .3, el: .55, wr: .1, hand: 'grip' };
      p.expr = EXPR.tender; break;
    }
    case 'tiptoe': {
      Object.assign(p, { lean: .06, nod: -.05 });
      p.L = { hip: .35, abd: .05, knee: .5, ankle: -.6 }; p.R = { hip: -.25, abd: .05, knee: .35, ankle: -.8 };
      p.aL = { fl: .4, abd: .25, el: 1.4, wr: .4, hand: 'relax' }; p.aR = { fl: -.3, abd: .25, el: 1.2, wr: .4, hand: 'relax' };
      p.expr = EXPR.worry; break;
    }
    case 'alarm': {      // hands flung up
      Object.assign(p, { lean: -.12, nod: -.15 });
      p.aL = { fl: 1.25, abd: .5, el: 1.35, wr: -.3, hand: 'open' }; p.aR = { fl: 1.15, abd: .5, el: 1.45, wr: -.3, hand: 'open' };   // startled: palms up by the shoulders
      p.L = { hip: .15, abd: .1, knee: .15, ankle: 0 }; p.R = { hip: -.1, abd: .08, knee: .05, ankle: 0 };
      p.expr = EXPR.alarm; break;
    }
    case 'run': { const r = runPose(.2, k); r.expr = EXPR.deadpan; return r; }
    default: break;
  }
  return p;
}
// loaf held between both hands (props.front)
export const loafInHands = (L = 1.25, roll = 0) => (g, J, pr, s) => {
  const a = pr.P(J.arms.L.hand), b = pr.P(J.arms.R.hand), c = pr.P(J.arms.L.wr), d = pr.P(J.arms.R.wr);
  const mx = (a[0] + b[0] + c[0] + d[0]) / 4, my = (a[1] + b[1] + c[1] + d[1]) / 4;
  const ang = Math.abs(b[0] - a[0]) > s * .3 ? Math.atan2(b[1] - a[1], b[0] - a[0]) : 0;
  drawLoaf(g, mx, my - s * .05, s * L, ang > Math.PI / 2 ? ang - Math.PI : ang < -Math.PI / 2 ? ang + Math.PI : ang, roll);
};
// one half in each hand
export const halves = (L = .62) => ({
  holdL: (g, wr, hd, s) => drawLoaf(g, hd[0], hd[1], s * L, -.5, 0, { half: 1 }),
  holdR: (g, wr, hd, s) => drawLoaf(g, hd[0], hd[1], s * L, .5, 0, { half: -1 }),
});

// the round loaf held between both hands (props.between): centred between the palms, the near hand drawn over it
export const bouleInHands = (rk = .58, rot = 0) => (g, J, pr, s) => {
  const hc = side => { const a = pr.P(J.arms[side].wr), b = pr.P(J.arms[side].hand); return [(a[0] + b[0] * 2) / 3, (a[1] + b[1] * 2) / 3]; };
  const l = hc('L'), r = hc('R'), d = Math.hypot(r[0] - l[0], r[1] - l[1]);
  const rad = Math.max(s * .5, Math.min(s * .66, d * .5 - s * .04)) * rk / .58;   // the loaf fills the gap between the palms
  drawBoule(g, (l[0] + r[0]) / 2, (l[1] + r[1]) / 2 - s * .04, rad, rot);
};
export const bouleHalves = (rk = .42) => ({
  holdL: (g, wr, hd, s) => drawBouleHalf(g, hd[0], hd[1], s * rk, Math.atan2(hd[1] - wr[1], hd[0] - wr[0]) + Math.PI),
  holdR: (g, wr, hd, s) => drawBouleHalf(g, hd[0], hd[1], s * rk, Math.atan2(hd[1] - wr[1], hd[0] - wr[0]) + Math.PI),
});
