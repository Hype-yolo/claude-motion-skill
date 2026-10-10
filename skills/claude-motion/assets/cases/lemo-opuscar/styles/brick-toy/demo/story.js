// 时间线：所有剪辑点对齐配乐小节；动画按 12fps 步进（定格动画"拍两格"）
export const DUR = 54;
export const ANIM_FPS = 12;
export const q = t => Math.floor(t * ANIM_FPS + 1e-6) / ANIM_FPS;
export const qc = t => Math.ceil(t * ANIM_FPS - 1e-6) / ANIM_FPS;   // 事件首次出现在画面上的那一帧

// Monkeys Spinning Monkeys：143.55 BPM，曲中第一拍 0.07s 对齐成片 4.0s（第一块砖扣下）
export const BEAT = 60 / 143.555;
export const beat = n => 4.0 + n * BEAT;
export const bar = n => beat(n * 4);

export const T = {
  firstClick: 4.0,
  title: [4.15, 5.6],
  layer: i => i === 0 ? 4.0 : beat(2 * i),        // 一号火箭第 i 层落定（0..11）
  cone1: bar(6),                                  // 14.03 小锥顶
  wobble: bar(7),                                 // 15.70 开始晃
  fall: bar(8),                                   // 17.37 倒下，音乐切断
  sit: 20.9,
  pickUp: 25.2,
  reprise: 26.4,                                  // 主题轻轻回来
  toss: [27.4, 28.2],                             // 扔轮子、扔小花
  found: 29.0,                                    // 找到大锥头
  rebuild: 29.9,                                  // 零件飞回（每 0.19s 一块）
  rebuildStep: .19,
  coneLand: 32.5,
  quindar: 32.8,
  count: [33.3, 34.3, 35.3],
  flicker: 35.0,
  ignite: 36.5,                                   // Heroic Age 爆发点
  lift: 37.0,
  land: 44.2,
  walkOut: 45.0,
  placeBrick: 46.6,
  reveal: 48.0,
  end: 51.71,                                    // Heroic Age 最后一个重音（跳剪 10 小节后）
};

export const VO = [
  { id: 'v1', t: 0.8, text: 'Every rocket starts with one brick.' },
  { id: 'v2', t: 6.0, text: 'Then another. And another.' },
  { id: 'v3', t: 22.6, text: 'The first one fell apart.' },
  { id: 'v4', t: 25.6, text: "That's okay. Now we have spare parts." },
  { id: 'c3', t: T.count[0], text: 'Three…', radio: true },
  { id: 'c2', t: T.count[1], text: 'Two…', radio: true },
  { id: 'c1', t: T.count[2], text: 'One…', radio: true },
  { id: 'v5', t: 45.2, text: 'And every moon base… starts with one brick.' },
];

// 镜头：[起, 止, 名]
export const SHOTS = [
  [0, 3.4, 'macro'], [3.4, bar(1), 'place'],
  [bar(1), bar(2), 'mA'], [bar(2), bar(3), 'mB'], [bar(3), bar(4), 'mC'], [bar(4), bar(5), 'mD'], [bar(5), bar(6), 'mE'],
  [bar(6), 16.9, 'proud'], [16.9, 20.5, 'collapse'], [20.5, 25.0, 'alone'], [25.0, 26.3, 'pickup'], [26.3, 29.8, 'rummage'], [29.8, 32.5, 'rebuild'],
  [32.5, 34.2, 'visor'], [34.2, 35.4, 'fins'], [35.4, T.ignite, 'pad'], [T.ignite, 40.0, 'liftoff'], [40.0, 42.5, 'cruise'],
  [42.5, T.reveal, 'moon'], [T.reveal, T.end, 'reveal'], [T.end, DUR, 'endcard'],
];
export const shotAt = t => SHOTS.find(s => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];

export const CREDITS = [
  'Music: “Monkeys Spinning Monkeys”, “Heroic Age” — Kevin MacLeod (incompetech.com), CC BY 4.0',
  'HDRI, wood & props: Poly Haven, CC0 · Voice: Kokoro TTS',
];
