// events.js — 声音事件表（window.EV → events.json → mix.py）。拟音跟材质走：陶瓷 / 糖 / 金属 / 水 / 橡皮
import { K, VO, BEAT, bar, DUR } from './story.js';
export function buildEvents() {
  const E = [];
  const add = (t, type, o = {}) => E.push({ t: +t.toFixed(4), type, ...o });
  for (const [id, t] of Object.entries(VO)) add(t, 'vo', { id });
  // 片名卷上去
  add(K.roll[0], 'shade', { d: K.roll[1] - K.roll[0] });
  // 起床
  add(K.ring[0], 'bell', { d: K.ring[1] - K.ring[0] });
  add(K.wake, 'jolt');
  add(K.yawn[0], 'yawn', { d: K.yawn[1] - K.yawn[0] });
  add(K.dip + .1, 'plip');
  add(K.lick, 'slurp');
  for (const w of K.wah) add(w, 'rattle', { v: .6 });     // 杯身打颤（小号"哇哇"在配乐里）
  add(K.peek[0], 'lidup');
  add(K.boing, 'boing');
  add(K.boing + .2, 'lidclank');
  add(K.windup, 'windup', { d: K.go - K.windup });
  add(K.go, 'zip');
  // 追逐脚步：方糖八分音符（糖粒木鱼），杯子四分音符（陶瓷）
  for (let t = K.go; t < K.dive - .17; t += BEAT / 2) add(t, 'stepCube');
  for (let t = K.go; t < K.skid[0]; t += BEAT) add(t, 'stepMug');
  add(K.shakerPass - .15, 'twirl', { d: 1.2 });
  add(K.dive, 'zipIn');
  add(K.skid[0], 'skid', { d: K.skid[1] - K.skid[0] });
  add(K.lever, 'click');
  for (let t = K.lever + BEAT / 2; t < K.ding - .05; t += BEAT / 2) add(t, 'tick');
  add(K.ding, 'toastDing'); add(K.ding, 'spring'); add(K.ding + .02, 'fwoosh');
  for (const b of K.blink) add(b, 'blink');
  // 橱柜
  add(K.fallIn, 'whistleDown', { d: K.plateCube(0) - K.fallIn });
  for (let i = 0; i < 7; i++) { add(K.plateCube(i), 'clinkSmall', { i }); add(K.plateMug(i), 'clonk', { i }); }
  add(K.mugHand, 'grab'); add(K.mugUp, 'stretchUp');
  add(K.leap, 'whoosh'); add(K.slide[0], 'slideScrape', { d: K.slide[1] - K.slide[0] });
  add(K.crash, 'chinaCrash');
  add(K.crash + .7, 'whoosh');
  // 水槽
  add(K.splash, 'splash');
  add(K.splash, 'gurgle', { d: K.silence[0] - K.splash });
  add(K.mugLand, 'plateBreak');
  add(K.worry, 'shiver', { d: .5 });
  add(K.stretch[0], 'rubber', { d: K.stretch[1] - K.stretch[0] });
  add(K.sink, 'drainSlurp');
  add(K.tug, 'creak');
  add(K.retract[0], 'zipBack'); add(K.retract[0] + .05, 'cork'); add(K.retract[1], 'drips');
  // 放手
  add(K.setDown, 'tap');
  for (const p of K.pats) add(p, 'pat');
  add(K.turnAway, 'shuffle');
  for (let t = K.walk[0]; t < K.walk[1] - .05; t += BEAT) add(t, 'stepSoft');
  add(K.sigh, 'sigh');
  add(K.hop, 'hopSmall'); add(K.launch, 'whoosh'); add(K.plop, 'plop');
  // 甜
  for (let i = 0; i < 3; i++) add(K.smack + i * 1 / 6, 'smack');
  add(K.popUp, 'bloop');
  // 高潮：每拍一次吐司弹起（很轻，给乐队添一点"厨房在跳"的质感）
  for (let t = bar(24); t < bar(27) - .01; t += BEAT) add(t, 'popLight');
  add(K.shut, 'irisThunk');
  add(0, 'projector', { d: DUR });
  return E.sort((a, b) => a.t - b.t);
}
