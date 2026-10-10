// 时间线唯一真值：132 BPM，前面让出 1 拍给第一句旁白（OFF），小节 n 从 B(n) 开始
export const BPM = 132, BEAT = 60 / BPM, BAR = BEAT * 4, OFF = BEAT;
export const B = (n, beat = 1) => OFF + (n - 1) * BAR + (beat - 1) * BEAT;
export const DUR = B(25);            // 44.09 s
// 铜管强奏 = 剪辑点
export const HIT = {
  split: B(2), snatch: B(4), hide: B(7), train: B(10), freeze: B(12), roulette: B(13), pupil: B(14, 3), moon: B(15), title: B(19), button: B(21),
};
export const T = {
  bongo1: B(1, 3.5), bongo2: B(1, 4),
  words: [B(2, 2), B(2, 3), B(2, 4)],       // A / LEMOLAB / PICTURE 落地
  blinds: B(3, 3),                           // 网格百叶翻开 → 丝绒钥匙
  wipe: B(4, 3),                             // 信使风衣划像
  agentIn: B(5), skid: B(5, 2), lookBack: B(5, 3), toCam: B(5, 3.5), dash: B(5, 4),
  airport: B(6), pushIn: B(6, 3), hide: B(7), unhide: B(8), walkOn: B(8, 2), planeUp: B(9), fill1: B(9, 4.5),
  train: B(10), zoomTrain: B(10, 3), jump1: B(11, 1), jump2: B(11, 3), jump3: B(12) - BEAT * .5, freeze: B(12), resume: B(12, 3), land3: B(12, 3.5), wheel: B(12, 4),
  roulette: B(13), keyBet: B(13, 3), pupil: B(14, 3), moon: B(15),
  edge: B(16, 3), cornered: B(16, 4), toss: B(17), leap: B(17, 2), catch: B(17, 3),
  shatter: B(18), title: B(19), pushKey: B(20), keyIn: B(20, 3), click: B(21), silence: B(21, 2), bongoEnd: B(21, 3), hatTip: B(22, 2),
  endCard: B(23, 2), end: B(25),
};
