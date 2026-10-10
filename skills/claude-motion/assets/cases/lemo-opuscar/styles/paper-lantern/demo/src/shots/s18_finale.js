// S18 · 片尾：灯箱里是“两扇窗一个月亮”，镜头拉出到桌前；“中秋快乐”
import * as THREE from 'three';
import { sheet, text } from '../paper.js';
import { FONT } from '../art.js';
import { mutualSet, MM } from './s16_mutual.js';
import { lightbox } from '../room.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, eo, lerp, clamp } from '../lib.js';

export async function build(E) {
  const S = stage({ light: MM, lightR: .16, lightCol: '#ffe2ae', key: .9, amb: 0, ambCol: '#7d90c8', keyCol: '#d6dcff', keyPos: [0, .155, .005], keyTarget: [0, -.06, -.1], keyAngle: 1.1 });
  const M = mutualSet(S, E);
  M.arcs.material.userData.u.uClip.value.set(0, 0, 100, 0);
  const title = S.add(sheet({ U: S.U, w: .28, h: .07, x: 0, y: -.005, z: -.092, trans: .3, shadow: false, recv: false, finish: { rim: .6 }, draw: x => { text(x, '中秋快乐', 0, 0, .046, FONT.brush, { fill: '#f3d998' }); x.fillStyle = '#b3302a'; x.fillRect(.105, -.022, .014, .014); text(x, '团圆', .112, -.015, .0055, FONT.brush, { fill: '#f6e3c3' }); } }));
  // 署名：灯箱底部前景坡上的一条金色剪纸字（和「中秋快乐」同一种纸），标题落定后淡入
  const sign = S.add(sheet({ U: S.U, w: .26, h: .02, x: 0, y: -.1515, z: -.024, trans: .3, shadow: false, recv: false, finish: { rim: .5 }, draw: x => text(x, 'LemoLab × Claude Opus 5.5', 0, 0, .0115, FONT.song, { fill: '#f3d998', weight: 600 }) }));
  const R = await lightbox(S, E, { spill: 7 });
  const tT = E.cue('L25') - .15, tOut = E.cue('L24') - .2;
  return {
    S,
    update(t) {
      const k = eo(seg(t, tT, tT + 1.2)); title.visible = k > 0; title.material.color.setScalar(k); title.position.y = -.004 + .004 * k; title.scale.setScalar(.94 + .06 * k);
      const ks = ss(seg(t, tT + 1.0, tT + 2.0)); sign.visible = ks > 0; sign.material.color.setScalar(ks);
      const out = eio(seg(t, tOut, tT + 2.4));
      aim(S.cam, [0, lerp(.0, .07, out), lerp(.5, 1.08, out), 0, lerp(.0, -.025, out), -.07], t, { hand: .0006 });
      this._fz = lerp(-.08, .0, ss(seg(t, tOut + 1, tT + 1.5)));
      R.spill.intensity = 7 * (1 + .03 * Math.sin(t * 5.3));
    },
    post() { return { focus: S.cam.position.z - (this._fz ?? -.08), aper: 18, maxCoc: 14, bloom: { strength: .38, radius: .6, threshold: 1.15 } }; },
    grade() { return { expo: 1.05, vig: .45, sat: 1.03, contrast: .1 }; },
  };
}
