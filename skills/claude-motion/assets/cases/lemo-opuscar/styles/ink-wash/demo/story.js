// 时间线唯一真值（秒）。配乐 music/score.py 按同一套时间写。
export const DUR = 48;
export const T = {
  dropFall: .5, dropHit: .9, bloomEnd: 5.2,
  titleIn: 2.6, titleOut: 6.4,
  panA: 5.6, panB: 10.6,
  cliffBloom: 6.2,
  paint: [8.8, 9.4, 10.0], tassel: 10.3,
  crouch: 13.8, leap: 14.2, x3a: 14.45, x3b: 15.3,           // 起跳 → 墨晕转场到过江
  step0: 15.3333, beat: .66667, nSteps: 9,
  darken: 19.9,
  shot4: 21.3, skid: 21.3, skidEnd: 22.2,
  cut5: 26.8, drop5: 27.3, drip5: 27.6,
  shot5b: 27.9, draw: 28.0,
  w1: [28.5, 29.0], w2: [29.2, 29.75], w3: [29.95, 30.35],
  hush: 30.5,
  cut: 32.4, cutEnd: 32.57,
  x7a: 35.0, x7b: 35.8,
  bank: 39.6, close: [38.6, 40.2],
  shotBow: 40.4, bow: [40.9, 41.5],
  scrollA: 42.6, scrollB: 45.0, seal: 44.6, endCard: 45.6,
};
// 旁白（语音起点）与字幕（停留 ≥ 语音 + 0.6 s）
export const VO = [
  { id: 'L1', t: 10.6, sub: [10.5, 14.7], text: 'The river keeps no name.\nIt waits for no one.' },
  { id: 'L2', t: 15.6, sub: [15.5, 19.4], text: 'He crossed it the only way he knew —\nlightly.' },
  { id: 'L3', t: 22.5, sub: [22.4, 26.3], text: 'Halfway over,\nthe river rose to meet him.' },
  { id: 'L4', t: 35.9, sub: [35.8, 39.2], text: 'Draw a sword to cut the water…' },
  { id: 'L5', t: 39.6, sub: [39.5, 42.95], text: '…and the water only flows on.' },
];
export const stepTimes = () => Array.from({ length: T.nSteps }, (_, k) => T.step0 + k * T.beat);
