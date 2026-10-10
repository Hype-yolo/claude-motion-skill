// 时间线唯一真值：120 BPM，2/4 拍（1 拍 = 0.5 s，1 小节 = 1 s）
export const DUR = 49;
export const BEAT = .5;
export const T = {
  snips: [.25, 1.0, 1.75], lift: 2.62, title: 3.0, titleFold: 6.5, village: 7.0,
  rise: 12.0, lightsOut: [14.0, 14.5, 15.0, 15.5, 16.0, 16.5], candleOut: 16.5,
  room: 17.0, blink: 18.3, decide: 19.5,
  red: 21.76, light: 22.5, noise: 23.28, nod: 23.6,
  folds: [24.0, 25.0, 26.0], cut0: 26.5, cut1: 29.4, unfolds: [30.0, 30.25, 30.5], bloom: 31.0,
  paste: 31.55, outside: 32.0, lanterns: [32.0, 32.25, 32.5, 32.75, 33.0, 33.25, 33.5, 33.75],
  nianClose: 34.0, flinch: 34.25, flee: 35.3, fireworks: [35.5, 36.25, 37.0], phraseEnd: 37.5,
  dawn: 38.0, sunUp: 39.0, asleep: 40.8, reveal: 42.5, cadence: 44.0, end: 46.0, endTicks: [46.5, 47.0]
};
// 旁白起点（秒）
export const VO = [
  { id: 'L1', t: 7.6, text: 'Every New Year’s Eve, the monster Nian came down from the mountains.' },
  { id: 'L2', t: 13.6, text: 'One by one, the village put out its lights.' },
  { id: 'L3', t: 19.6, text: 'But Nian fears three things: the color red, bright light, and loud noise.' },
  { id: 'L4', t: 35.2, text: 'Crackle, bang! And away ran Nian.' },
  { id: 'L5', t: 38.6, text: 'That is why, every New Year, we still paste red paper on our windows.' },
];
// 镜头表 [起, 止, 名]
export const SHOTS = [
  [0, 2.9, 'macro'], [2.9, 7.1, 'title'], [7.0, 12.0, 'village'], [12.0, 17.0, 'rise'], [17.0, 19.5, 'eye'],
  [19.5, 24.0, 'decide'], [24.0, 31.25, 'fold'], [31.25, 32.0, 'paste'], [32.0, 34.0, 'glow'], [34.0, 35.3, 'nianClose'],
  [35.3, 38.0, 'flee'], [38.0, 40.8, 'dawn'], [40.8, 42.5, 'asleep'], [42.5, 49.0, 'reveal']
];
export const shotAt = t => { for (let i = SHOTS.length - 1; i >= 0; i--) if (t >= SHOTS[i][0]) return SHOTS[i]; return SHOTS[0]; };
