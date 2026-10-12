// 时间线：96 BPM；律动从第一块地升起（6.25s）开始计小节。所有剪辑点、生长事件都对齐这个网格。
export const DUR = 53.0;
export const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4;   // 0.625 / 2.5
export const G0 = 6.25;                                    // 律动第 0 小节
export const bar = n => G0 + n * BAR;
export const beat = n => G0 + n * BEAT;

export const T = {
  bell1: 0.25, bell2: 2.9,
  title: [0.6, 3.6],
  first: bar(0),            // 6.25 第一块地
  tiles: bar(1),            // 8.75
  trees: bar(3),            // 13.75
  houses: bar(4),           // 16.25
  details: bar(5),          // 18.75
  day: bar(6),              // 21.25 切：白天延时
  dock: bar(7),             // 23.75 切：码头，小船出海
  dusk: bar(8),             // 26.25 切：黄昏大全景，窗户逐盏亮
  night0: bar(9),           // 28.75 天色退成夜
  night: bar(10),           // 31.25 切：夜，负空间
  rise: bar(11),            // 33.75 灯塔四环
  ignite: bar(12),          // 36.25 点亮（全片最强拍）
  found: bar(13) + 0.625,   // 39.375 光束扫到小船（第 5 拍 = 旋律里的休止）
  home: bar(14),            // 41.25 回港 + 开始拉远
  docked: bar(14) + 1.25,   // 42.5 靠岸
  far: bar(15),             // 43.75
  bellFar: 47.5,            // 远处浮标钟（开场同一个音）
  end: bar(17),             // 48.75 片尾卡
};

export const VO = [
  { id: 'v1', t: 3.7, text: 'Once, the ocean knew only one note.' },
  { id: 'v2', t: 7.0, text: 'Then, the ground began to sing.' },
  { id: 'v3', t: 26.5, text: 'By evening, every house knew its part.' },
  { id: 'v4', t: 31.25, text: 'But one note was still missing.' },
  { id: 'v5', t: 44.0, text: 'Far away, another island hears its first note.' },
];

// 和声（按律动小节），给事件取音高；配乐脚本读同一份
export const CHORDS = ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'D', 'D', 'Bm', 'D', 'A', 'D', 'Bm', 'G', 'D', 'D', 'D'];
const CT = { D: [62, 66, 69], Bm: [59, 62, 66], G: [55, 59, 62], A: [57, 61, 64] };
export const chordAt = t => CHORDS[Math.max(0, Math.min(CHORDS.length - 1, Math.floor((t - G0) / BAR)))];
// 取 t 时刻和弦里、落在 [lo,hi] 内的第 k 个音（k 为 0..1 的轮廓值）
export function noteAt(t, k, lo = 60, hi = 84) {
  const pcs = CT[chordAt(t)], ns = [];
  for (let m = lo; m <= hi; m++) if (pcs.some(p => (m - p) % 12 === 0)) ns.push(m);
  return ns[Math.max(0, Math.min(ns.length - 1, Math.round(k * (ns.length - 1))))];
}

// 天色关键帧：[t, 天顶, 地平线/远海雾, 海深, 海浅, 太阳色, 太阳强度, 环境天光, 环境地光, 环境强度, 太阳高度角°, 太阳方位角°, 夜值]
export const SKY = [
  [0.0, '#9fb6cf', '#f3d2c4', '#4f8ea3', '#8fc9c4', '#ffd9bf', 1.3, '#dfe6f2', '#b89a8a', 1.05, 12, 200, 0],
  [6.0, '#a9c4dc', '#f6dccd', '#4f93a8', '#93d0c8', '#ffe2c8', 1.7, '#e3ecf6', '#bfa590', 1.1, 22, 190, 0],
  [14.0, '#8fcbe6', '#e9f3f0', '#3aa3b8', '#86e0d2', '#fff4e2', 2.5, '#eef6fb', '#c2b59a', 1.15, 48, 150, 0],
  [21.25, '#88c8e8', '#eaf5f2', '#38a5bc', '#86e2d4', '#fff6e8', 2.7, '#eef6fb', '#c6b89c', 1.15, 52, 175, 0],
  [23.75, '#8cc4e4', '#f0f2e6', '#3aa0ba', '#8aded0', '#fff0d8', 2.6, '#eff3f4', '#c6b89c', 1.12, 40, 95, 0],
  [26.0, '#9ab8d8', '#ffd9b0', '#4f8fb0', '#9ed6c8', '#ffc98e', 2.2, '#f3e2d4', '#c89a80', 1.0, 22, 120, 0],
  [28.0, '#6f6fa8', '#ffa888', '#5a6a9e', '#b08aa6', '#ff9a68', 1.5, '#d8b8c8', '#a07a80', .8, 8, 105, .15],
  [30.0, '#2a2e5e', '#8a6a9c', '#2e3160', '#474a80', '#ff8a70', .35, '#7a80b8', '#5a5070', .55, 1, 100, .6],
  [31.25, '#12163a', '#4a4478', '#23264a', '#363a66', '#a9b0e8', .9, '#5c5ea8', '#2a2640', .55, 30, 300, 1],
  [53.0, '#11153a', '#4a4478', '#22254a', '#353965', '#a9b0e8', .9, '#5c5ea8', '#2a2640', .55, 30, 300, 1],
];

// 镜头段：[起, 止, 名]
export const SHOTS = [
  [0, beat(7), 'grow'],        // 开场空海 → 第一块地 → 地块铺开（转盘，缓慢拉远）
  [beat(7), bar(2) + BAR / 2, 'rock'],   // 10.625 切近景：中心礁石冲出水面（水花）
  [bar(2) + BAR / 2, T.trees, 'grow2'],   // 12.5 回到全岛（转盘继续）
  [T.trees, T.houses, 'trees'],           // 13.75 中景：树"啵"地长出
  [T.houses, T.details, 'houses'],        // 16.25 近景：楼层一层层弹性落定
  [T.details, T.day, 'details'],          // 18.75 近景：风车、码头木板、小船落水
  [T.day, T.dock, 'square'],
  [T.dock, T.dusk, 'dock'],
  [T.dusk, T.night, 'dusk'],
  [T.night, T.rise, 'lost'],
  [T.rise, T.ignite, 'tower'],
  [T.ignite, DUR, 'beam'],     // 点亮 → 拉远 → 片尾
];
export const shotAt = t => SHOTS.find(s => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];

export const CREDITS = [
  'Music, sound & 3D: original, generated in code · Voice: Kokoro TTS (af_sky)',
  'Fonts: Josefin Sans, Quicksand (SIL OFL)',
];
