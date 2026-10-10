// 时间线唯一真值（秒）。配音按 whisper 逐词时间对齐到画面卡点。
export const DUR = 47.5;
export const TITLE = { t0: 5.6, t1: 8.2, text: 'The Line That Never Lifted', sub: 'a one-line drawing' };
export const VO = [
  { id: 'L1', text: 'Everyone begins by holding on.', t0: 2.44, dur: 2.377, sub: [2.44, 5.3] },           // "on" = 攥紧 4.1
  { id: 'L2', text: 'Then someone teaches you to let go.', t0: 10.8, dur: 2.334, sub: [10.8, 13.8] },
  { id: 'L3', text: 'For a while, one line was enough for two.', t0: 16.3, dur: 2.638, sub: [16.3, 19.6] }, // "two" = 第二次鼻尖相碰
  { id: 'L4a', text: 'Sometimes the line stops.', t0: 24.05, dur: 2.005, sub: [24.05, 26.3] },
  { id: 'L4b', text: 'And then it goes on.', t0: 26.37, dur: 1.584, sub: [26.37, 28.6] },                // "goes" = 笔重新出发 26.85
  { id: 'L5', text: 'Your turn now.', t0: 40.35, dur: 1.386, sub: [40.35, 42.4] },
];
export const HAND = { enter: 40.3, grip: 41.1, oldOut: [41.3, 42.6], newLine: 41.7 };
export const END = { t0: 43.4 };
