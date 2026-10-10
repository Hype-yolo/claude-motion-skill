// 镜头调度：按时间选镜头，处理墨晕转场，给出合成参数与音效事件
import { T, VO, DUR, stepTimes } from './story.js';
import { renderCross, renderRise, heroX } from './cross.js';
import * as W from './world.js';
import * as C from './climax.js';
import * as P from './passage.js';
import { clamp, ss, eio } from '/core/lib.js';
export { seal } from './seal.js';

export async function init(TMP) { W.init(); C.init(TMP); }

export function frame(t, A, B, TMP) {
  // 1–2 虚白 → 江岸（手卷横移）
  if (t < T.x3a) return W.renderOpen(A, t, TMP);
  // 2→3 墨晕转场
  if (t < T.x3b) {
    const oa = W.renderOpen(A, t, TMP), ob = renderCross(B, t);
    const u = (t - T.x3a) / (T.x3b - T.x3a);
    return { ...oa, paperB: ob.paper, bleedB: ob.bleed, rimB: ob.rim, trans: [W.leapScreen(t)[0], W.leapScreen(t)[1], 20 + 2300 * ss(u), 1] };
  }
  if (t < T.shot4) return renderCross(A, t);
  if (t < T.cut5) return renderRise(A, t);
  if (t < T.x7a) return C.render(A, t, TMP);
  if (t < T.x7b) {
    const oa = C.render(A, t, TMP), ob = P.render(B, t, TMP);
    const u = (t - T.x7a) / (T.x7b - T.x7a);
    return { ...oa, paperB: ob.paper, bleedB: ob.bleed, rimB: ob.rim, trans: [1300, 620, 20 + 2300 * ss(u), 1] };
  }
  return P.render(A, t, TMP);
}

// 字幕位置：每个镜头的留白处 [x, y, size]
export function subPos(id, t) {
  switch (id) {
    case 'L1': return [170, 860];
    case 'L2': return [150, 250];
    case 'L3': return [1180, 170];
    case 'L4': return [140, 200];
    case 'L5': return t < T.shotBow ? [140, 200] : [1180, 300];
  }
  return [150, 900];
}

// 音效与对白事件（events.mjs 导出给 mix.py）
export function events() {
  const E = [];
  for (const v of VO) E.push({ t: v.t, type: 'vo', id: v.id });
  E.push({ t: T.dropHit, type: 'drip', gain: 1 });
  T.paint.forEach(tp => E.push({ t: tp, type: 'brush', gain: .5 }));
  E.push({ t: T.leap - .05, type: 'whoosh', gain: .5 });
  stepTimes().forEach((ts, k) => E.push({ t: ts, type: 'step', gain: .8, k }));
  stepTimes().forEach((ts, k) => E.push({ t: ts + .1, type: 'whoosh', gain: .25, k }));
  E.push({ t: T.shot4, type: 'splash', gain: .8 });
  E.push({ t: T.skid + .25, type: 'skid', gain: .7 });
  E.push({ t: T.drip5, type: 'drip', gain: .9 });
  E.push({ t: T.draw, type: 'sword', gain: 1 });
  [T.w1, T.w2, T.w3].forEach(w => E.push({ t: w[0], type: 'brush', gain: 1, dur: w[1] - w[0] }));
  E.push({ t: T.cut, type: 'cut', gain: 1 });
  E.push({ t: T.cut + .05, type: 'splatter', gain: 1 });
  E.push({ t: T.cut + .3, type: 'collapse', gain: 1 });
  E.push({ t: T.close[0], type: 'waterclose', gain: .7 });
  E.push({ t: T.bow[0], type: 'cloth', gain: .6 });
  E.push({ t: T.seal, type: 'seal', gain: 1 });
  E.push({ type: 'silence', t0: T.cut5, t1: T.drip5 - .01 });
  E.push({ type: 'silence', t0: T.hush, t1: T.cut });
  E.push({ type: 'amb', kind: 'wind', t0: 0, t1: T.cut5 });
  E.push({ type: 'amb', kind: 'water', t0: T.x3a, t1: T.cut5 });
  E.push({ type: 'amb', kind: 'roar', t0: T.darken, t1: T.cut5 });
  E.push({ type: 'amb', kind: 'water', t0: T.x7a, t1: DUR });
  return E;
}
