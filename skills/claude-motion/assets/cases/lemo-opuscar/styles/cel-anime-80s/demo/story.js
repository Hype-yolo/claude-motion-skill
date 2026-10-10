// City Lights, 1987 — 时间线：所有剪辑点对齐配乐小节（原创配乐 116 BPM，4/4）
export const BPM = 116;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const bar = n => n * BAR;
export const beat = n => n * BEAT;
export const DUR = 59.0;

// 有限动画：角色 12fps（on twos），眨眼 / 拧油门等 8fps（on threes）
export const q12 = t => Math.floor(t * 12 + 1e-6) / 12;
export const q8 = t => Math.floor(t * 8 + 1e-6) / 8;
export const qc12 = t => Math.ceil(t * 12 - 1e-6) / 12;

export const T = {
  eyesOpen: 7.75,             // 三张画睁眼
  rev: [bar(4) + BEAT * 1, bar(4) + BEAT * 2.5],  // 两次轰油
  title: bar(5),              // 10.345 铜管齐奏
  warn: bar(13),              // 26.90 吊桥警示
  throttle: bar(14) + BEAT,   // 拧油门
  cutout: bar(15) + BEAT * 3, // 32.59 音乐抽空一拍 + 白闪
  jump: bar(16),              // 33.10 冲击帧 + 副歌
  land: bar(18),              // 37.24 落地
  handoff: bar(20) + BEAT,    // 手交磁带
  play: bar(21) + BEAT * .5,  // 按下 PLAY，配乐变卡带音质
  lift: bar(22),              // 45.52 火箭升空，配乐展开 + 升调
  smile: bar(25) + BEAT * 1,  // 微笑
  end: bar(26),               // 53.79 片尾卡
};

// 台词（D = 调度员，走无线电；G = 少女）
export const VO = [
  { id: 'd1', t: 0.9, who: 'D', text: 'Nightbird, come in. The launch is at dawn.' },
  { id: 'd2', t: 4.35, who: 'D', text: "The pilot won't fly without his tape." },
  { id: 'g1', t: 8.05, who: 'G', text: "Copy. I'll beat the sun." },
  { id: 'd3', t: bar(13) + .25, who: 'D', text: 'The drawbridge is going up! Turn back!' },
  { id: 'g2', t: bar(14) + BEAT * 1.6, who: 'G', text: 'No time to go around.' },
  { id: 'g3', t: bar(20) + BEAT * 1.9, who: 'G', text: 'Special delivery.' },
  { id: 'd4', t: bar(21) + BEAT * 1.2, who: 'D', text: "Tape's aboard. He's playing it now." },
  { id: 'g4', t: bar(24) + BEAT * 2.2, who: 'G', text: "Told you I'd beat the sun." },
];

// 镜头：[起, 止, 名]
export const SHOTS = [
  [0, bar(2), 'crane'],
  [bar(2), 7.24, 'tape'],
  [7.24, bar(5), 'eyes'],
  [bar(5), bar(7), 'title'],
  [bar(7), bar(9), 'side'],
  [bar(9), bar(10), 'rear'],
  [bar(10), bar(11), 'bust'],
  [bar(11), bar(12), 'wheel'],
  [bar(12), bar(13), 'highway'],
  [bar(13), bar(14), 'bridge'],
  [bar(14), bar(15), 'throttle'],
  [bar(15), bar(16), 'charge'],
  [bar(16), bar(18), 'jump'],
  [bar(18), bar(19), 'land'],
  [bar(19), bar(20), 'dawnride'],
  [bar(20), bar(21), 'handoff'],
  [bar(21), bar(22), 'deck'],
  [bar(22), bar(24), 'liftoff'],
  [bar(24), bar(26), 'smile'],
  [bar(26), DUR, 'endcard'],
];
export const shotAt = t => SHOTS.find(s => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];

export const CREDITS = [
  'Original score, sound design & animation: code-generated (numpy · Canvas · WebGL)',
  'Voices: Kokoro TTS (Apache 2.0)',
  'Fonts: Dela Gothic One, Kanit, Barlow Semi Condensed — SIL Open Font License',
];
