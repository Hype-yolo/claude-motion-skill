// story.js — 时间线（唯一的真值来源：画面、字幕、拟音、配乐 cue 全部从这里导出）
// 角色 12fps 步进（q），镜头/传送门/特效每帧平滑
export const DUR = 57.5;
export const ANIM_FPS = 12;
export const q = t => Math.floor(t * ANIM_FPS + 1e-6) / ANIM_FPS;
export const BEAT = .5;   // 120 BPM；每个音乐 cue 的第一拍 = 它的剪辑点

// 对白：id → 开始时间（台词文本、说话人来自 lines.json）
export const VO = {
  p1: 2.75, v1: 5.62, v2: 8.2,
  v3: 15.35, v4: 19.25, p2: 19.72,
  p3: 24.35, v5: 27.3,
  v6a: 28.5, v6b: 29.5, v6c: 30.5,
  p4: 33.75,
  v7: 38.55, c1: 41.45, p5: 42.4, v8: 46.55, c2: 48.2, v9: 50.75,
};

// 镜头表 [起, 止, 名, 宇宙]
export const SHOTS = [
  [0, 2.3, 'pot', 'lab'], [2.3, 5.6, 'two', 'lab'], [5.6, 6.7, 'vCU1', 'lab'], [6.7, 7.9, 'gCU1', 'lab'], [7.9, 9.5, 'vCU2', 'lab'],
  [9.5, 12.6, 'open', 'lab'], [12.6, 12.85, 'rush', 'lab'],
  [12.85, 15.1, 'jWide', 'jelly'], [15.1, 17.6, 'jCounter', 'jelly'], [17.6, 18.8, 'jCup', 'jelly'], [18.8, 20.9, 'jReact', 'jelly'],
  [20.9, 22.7, 'mWide', 'mug'], [22.7, 24.3, 'mSip', 'mug'], [24.3, 27.1, 'gScream', 'mug'], [27.1, 28.4, 'vNope', 'mug'],
  [28.4, 29.4, 'teeth', 'teeth'], [29.4, 30.4, 'pigeon', 'pigeon'], [30.4, 31.4, 'vasks', 'vasks'],
  [31.4, 33.6, 'nWide', 'normal'], [33.6, 36.05, 'nTwo', 'normal'],
  [36.05, 37.6, 'lReturn', 'lab'], [37.6, 40.7, 'vSip', 'lab'], [40.7, 42.3, 'cupHi', 'lab'], [42.3, 44.0, 'gAlive', 'lab'],
  [44.0, 46.4, 'stare', 'lab'], [46.4, 48.0, 'vDecaf', 'lab'], [48.0, 49.1, 'cupYep', 'lab'], [49.1, 53.0, 'toss', 'lab'],
  [53.0, DUR, 'end', 'end'],
];
export const shotAt = t => SHOTS.find(s => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];

// 传送门转场（全屏漩涡在 tc 时刻盖满画面）：[tc, 半宽]
export const WIPES = [[12.85, .2], [20.9, .2], [28.4, .16], [29.4, .12], [30.4, .12], [31.4, .18], [36.05, .2]];

// 宇宙标签（左上角读数）：[起, 止, 编号, 描述, 底色, 字色]
export const TAGS = [
  [13.2, 17.55, 'DIMENSION J-9', 'EVERYTHING IS JELLY', '#ff4f9a', '#fff'],
  [21.15, 28.35, 'DIMENSION M-2', 'COFFEE DRINKS YOU', '#ff8a3d', '#fff'],
  [28.46, 29.37, 'DIMENSION T-7', 'ALL TEETH', '#d8203a', '#fff'],
  [29.45, 30.37, 'DIMENSION P-0', 'PIGEONS IN CHARGE', '#5f78a8', '#fff'],
  [30.45, 31.37, 'DIMENSION V-V', 'EVERYONE IS VASK', '#e8d84a', '#3b1f66'],
  [31.6, 36.0, 'DIMENSION 1-A', 'COMPLETELY NORMAL', '#b08a62', '#fff'],
];

// 关键时刻
export const T = {
  drip: .62, enter: 2.3, twitch: [3.0, 4.6], gulp: 6.98, raise: 7.95, press: 9.38,
  burst: 9.55, title: [10.0, 12.35], vaskIn: 11.55, garyLook: 11.95, garyIn: 12.25,
  jSpitV: 13.05, jSpitG: 13.3, jLandV: 13.5, jLandG: 13.78, jClose: 14.4,
  glorp: 16.95, slide: [17.02, 17.45], eyeBlink: 18.22, jClick: 19.98, jBack: [20.3, 20.85],
  mSpit: 21.02, sip: [22.75, 23.7], page: 23.0, wave: [23.35, 23.95], mTurn: 23.6, lick: [23.8, 24.25], guyShake: 26.55, mClick: 28.1,
  montClick: [29.2, 30.2, 31.2], chomp: 28.85, coo: 29.75, vasksTurn: 30.62,
  nClose: 31.55, hand: [32.25, 32.9], take: 32.95, nClick: 35.55,
  lSpit: 36.12, lLandV: 36.5, lLandG: 36.7, lClose: [37.05, 37.45],
  cupUp: 37.7, sipL: [38.0, 38.5], bubble: 40.8, rise: [40.95, 41.25], eyesOpen: 41.25,
  blinkC: [44.9, 45.85], nod: 48.15, toss: 49.45, tossLand: 50.3, tClick: 49.78, tOpen: 49.82, turnG: 50.55, sag: 52.3,
  end: 53.0,
};

// 配乐 cue（给 music/score.py）：每个 cue 的 t0 就是它的第一拍
export const CUES = [
  { name: 'riser', t0: 8.15, t1: 9.55 },
  { name: 'theme', t0: 10.0, t1: 12.85, pickup: 9.55 },
  { name: 'jelly', t0: 12.85, t1: 17.6 },
  { name: 'mug', t0: 20.9, t1: 28.4 },
  { name: 'montage', t0: 28.4, t1: 31.4, hits: [28.4, 29.4, 30.4] },
  { name: 'muzak', t0: 31.4, t1: 36.05 },
  { name: 'bliss', t0: 38.2, t1: 40.75 },
  { name: 'panic', t0: 42.3, t1: 44.0 },
  { name: 'finale', t0: 51.0, t1: DUR, pickup: 49.85, hit: 53.0 },
];

export const CREDITS = [
  'Original score & sound effects synthesized in code (numpy) · Voices: Kokoro TTS (Apache-2.0)',
  'Fonts: Baloo 2, Titan One, Bungee, VT323 — Google Fonts, SIL OFL 1.1',
];
