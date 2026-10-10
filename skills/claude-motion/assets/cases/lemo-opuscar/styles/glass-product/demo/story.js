// 时间线：120 BPM，1 拍 = 0.5 s，1 小节 = 2 s。所有剪辑点、光扫、脉冲都对齐拍点（音乐先行）
export const BPM = 120, BEAT = .5, BAR = 2;
export const DUR = 32;
export const b = n => n * BAR;   // 第 n 小节起点

export const T = {
  sweep1: [0.5, 1.7], sweep2: [2.0, 3.2],        // 黑场两道光扫
  title: [1.0, 3.9],
  lidOpen: [4.5, 7.6], lidClick: 8.0,            // 旋盖慢开，8.0 磁吸落定
  lift: [8.0, 9.4],                              // 右耳机磁吸浮起
  explode: [12.0, 15.2], hold: 15.5, snap: 16.0, // 爆炸视图 → 屏息 → 16.0 合拢（drop）
  liftL: [20.0, 21.2],
  reveal: 24.0, settle: [27.0, 27.8],            // 结尾光扫 + 两只耳机落回托槽
  name: [24.5, 27.7], end: 28.0,
};

// 镜头表（切点都在小节线上）
export const SHOTS = [
  [0, 4, 'dark'], [4, 8, 'open'], [8, 10, 'macroA'], [10, 12, 'macroB'], [12, 17, 'explode'],
  [17, 18, 'front'], [18, 20, 'channels'], [20, 22, 'pair'], [22, 24, 'caustics'], [24, 28, 'reveal'], [28, 32, 'end'],
];
export const shotAt = t => SHOTS.find(s => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];

// 声音可视化段的鼓点（808 kick）：每小节 1、2&、3、4 拍的变体；段外只有几个大重音
const KPAT = [0, .75, 1.0, 1.5];
export const KICKS = [];
for (let bar = 8; bar < 12; bar++) for (const o of KPAT) KICKS.push({ t: b(bar) + o, big: o === 0 && (bar === 8) });
KICKS.push({ t: 24.0, big: true });
// 微距段的光扫：每拍一道（卡 kick）
export const MACRO_SWEEPS = [8.0, 9.0, 10.0, 11.0];

// 旁白（am_michael）
export const VO = [
  { id: 'v1', t: 8.55, text: 'Nothing to hide.' },
  { id: 'v2', t: 12.45, text: 'Every part, in plain sight.' },
  { id: 'v3', t: 24.5, text: 'Meet Aura.' },
  { id: 'v4', t: 25.8, text: 'Hear the light.' },
];

// 拟音事件（材质：玻璃、金属、磁吸）；mix.py 从 events.json 读取
export const SFX = [
  { t: 0.45, type: 'sweep', d: 1.3, pan: [-.8, .8], v: .5 },
  { t: 1.95, type: 'sweep', d: 1.3, pan: [.8, -.8], v: .55 },
  { t: 4.5, type: 'slide', d: 3.1, v: .5 },                 // 玻璃翻盖与铰链的缓慢摩擦
  { t: 7.55, type: 'tock', v: .5 },                         // 翻盖到位
  { t: 8.0, type: 'click', v: .9, pan: .3 },                // 磁吸释放，耳机浮起
  { t: 8.02, type: 'lift', d: 1.2, v: .35, pan: .3 },
  ...[8.0, 9.0, 10.0, 11.0].map(t => ({ t: t - .02, type: 'sweep', d: .5, pan: [-.6, .6], v: .22 })),
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => ({ t: 12.02 + i * .07, type: 'puff', v: .28 + (i % 3) * .06, pan: -.6 + i * .13 })),
  { t: 12.0, type: 'slowwhoosh', d: 2.6, v: .5 },
  { t: 15.55, type: 'revwhoosh', d: .45, v: .8 },           // 全静里零件被吸回
  { t: 16.0, type: 'snap', v: 1.0 },                        // 合拢：磁吸 click 簇 + 玻璃叮
  { t: 20.0, type: 'lift', d: 1.1, v: .35, pan: -.6 },      // 左耳机飞入
  { t: 23.95, type: 'sweep', d: 1.35, pan: [-.8, .8], v: .5 },
  { t: 27.72, type: 'click', v: .75, pan: -.35 },           // 落回托槽
  { t: 27.84, type: 'click', v: .75, pan: .35 },
];
