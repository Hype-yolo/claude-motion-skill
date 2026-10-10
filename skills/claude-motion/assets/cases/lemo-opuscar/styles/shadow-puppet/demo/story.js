// 时间线：唯一真值（镜头、旁白、灯、箭、音效、配乐 cue 都从这里来）。100 BPM：1 拍 = 0.6 s，1 小节 = 2.4 s
export const BEAT = .6, BAR = 2.4;
export const DUR = 54.4;
export const T = {
  clap: .4, match: 1.0, lampOn: 1.25,
  titleIn: 2.4, titleSet: 3.6, titleOut: 6.6,
  sun0: 7.2, flares: [7.8, 8.4, 8.9, 9.3, 9.6, 9.9, 10.2, 10.4, 10.6], hot: 10.8,
  burn0: 11.0, burn1: 16.4, flames: 13.2,
  run0: 18.3, run1: 20.7, hop: 20.9, liang: 21.6, lookUp: 22.9,
  draw1: [25.5, 27.2], rel: [27.6, 29.4, 30.6, 31.2, 31.8, 32.1, 32.4, 32.7, 33.0], fly: [.3, .3, .22, .22, .2, .2, .18, .18, .18],
  last0: 33.5, lastDraw: 34.0, stop: 34.8, lower0: 36.0, lower1: 37.1, softGong: 36.9,
  heal0: 37.4, river: 38.6, canopy: 39.6, heal1: 42.0,
  pull0: 40.6, truck0: 43.2, cutBack: 43.8, truck1: 44.5,
  bow: 48.3, clap2: 50.6, endIn: 50.9, end: 54.4
};
// 被射顺序（sun 0 留下）
export const KILL = [6, 1, 3, 7, 2, 8, 4, 9, 5];
export const hitT = i => T.rel[i] + T.fly[i];
// 旁白（起点；时长读 voices/dur.json）
export const VO = [
  { id: 'L1', t: 7.45, text: 'Long ago, ten suns climbed the sky at once.' },
  { id: 'L2', t: 12.3, text: 'The rivers boiled. The fields cracked. The whole earth began to burn.' },
  { id: 'L3', t: 22.35, text: 'Then came Hou Yi, the archer.' },
  { id: 'L4', t: 25.2, text: 'One arrow for every burning sun.' },
  { id: 'L5', t: 37.75, text: 'But the last one, he spared. So the world would have light, and not fire.' },
  { id: 'L6', t: 45.2, text: 'One light is enough. Even now, every shadow play burns just one.' }
];
// 镜头表：[t0, t1, name]
export const SHOTS = [
  [0, 7.2, 'house'], [7.2, 12.0, 'suns'], [12.0, 18.0, 'land'], [18.0, 21.6, 'enter'], [21.6, 25.2, 'liang'],
  [25.2, 28.3, 'draw'], [28.3, 30.0, 'second'], [30.0, 34.8, 'volley'], [34.8, 37.2, 'last'], [37.2, 43.2, 'heal'],
  [43.2, 44.5, 'truck'], [44.5, 50.8, 'back'], [50.8, 54.4, 'end']
];
export const shotAt = t => SHOTS.find(s => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
