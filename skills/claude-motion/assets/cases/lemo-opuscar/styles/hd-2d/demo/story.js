// 时间线（秒）：镜头、旁白、关键事件
export const DUR = 76.5;
export const SHOTS = [
  { id: 'card', a: 0, b: 5.5 },
  { id: 'harborWide', a: 5.5, b: 15.0 },
  { id: 'pier', a: 15.0, b: 25.5 },
  { id: 'forest', a: 25.5, b: 35.5 },
  { id: 'cliff', a: 35.5, b: 49.5 },
  { id: 'lamp', a: 49.5, b: 58.0 },
  { id: 'harborEnd', a: 58.0, b: 67.0 },
  { id: 'title', a: 67.0, b: 76.5 },
];
export const T = {
  lhFlicker: 11.5, lhOut: 12.35,          // 灯塔熄灭
  light: 16.2,                             // 守灯人点亮小提灯
  dlgIn: 17.3, dlgOut: 24.0,               // 对话框
  wrenRun: 23.6,
  gust: 40.6, dim: 41.3, dark: 42.0, relight: 45.6, stand: 47.6,
  pour: 52.6, ignite: 53.5, beam: 54.4,
  ships: 59.2,
};
// 旁白：t = 开始时间；dur 取自 voices/dur.json
export const VO = [
  { id: 'n1', t: 6.8, sub: 'For a hundred years, the lighthouse of Greywater never once went dark.' },
  { id: 'n2', t: 12.6, sub: 'Tonight, it did.' },
  { id: 'k1', t: 17.8, dlg: true, who: 'Old Keeper', sub: 'Take the last flame, little Wren. Keep it close. Don’t let the wind have it.' },
  { id: 'n3', t: 27.0, sub: 'Through the Whisperwood, where even the moon loses its way,' },
  { id: 'n4', t: 36.3, sub: 'up the Gale Steps, where the storm tried to take it from her.' },
  { id: 'n5', t: 44.3, sub: 'But a flame held by careful hands does not go out.' },
  { id: 'n6', t: 59.5, sub: 'And far out at sea, every lost ship found its way home.' },
  { id: 'n7', t: 69.3, sub: 'Every path begins with a single light.', title: true },
];
export const shotAt = t => SHOTS.find(s => t >= s.a && t < s.b) || SHOTS[SHOTS.length - 1];
