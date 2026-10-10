// sheet.js — 角色设定表（?mode=sheet&w=2880&h=1620）与厨房群演表（?mode=kitchen）
import * as T from './toon.js';
import { P, mug, cube, MUG } from './chars.js';
import { clock, toaster, faucet, shaker, plateStair, hanging, sugarBowl, windowCurtain } from './cast.js';
import { fatTitle, subPlate } from './ui.js';
const { stroke, ell, arc, shape } = T;

// 纸面 + 页眉
function paper(g, CW, CH, title, sub) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#E9E5DA'; g.fillRect(0, 0, CW, CH);
  // 纸纹：低频斑驳 + 细纤维
  const k = CW / 1920;
  for (let i = 0; i < 900; i++) { const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * CW, y = (Math.sin(i * 78.233) * 12345.678 % 1 + 1) % 1 * CH; g.fillStyle = i % 3 ? 'rgba(90,85,70,.05)' : 'rgba(255,255,250,.18)'; g.beginPath(); g.arc(x, y, (2 + (i % 7) * 3) * k, 0, 6.283); g.fill(); }
  g.fillStyle = P.ink; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.font = `${46 * k}px Limelight`; g.fillText(title, 34 * k, 62 * k);
  g.font = `${24 * k}px "IM Fell English SC"`; g.fillStyle = P.dark; g.fillText(sub, 36 * k, 92 * k);
  g.strokeStyle = P.ink; g.lineWidth = 3 * k; g.beginPath(); g.moveTo(30 * k, 104 * k); g.lineTo(CW - 30 * k, 104 * k); g.stroke();
  g.lineWidth = 1.2 * k; g.beginPath(); g.moveTo(30 * k, 110 * k); g.lineTo(CW - 30 * k, 110 * k); g.stroke();
}
function label(g, k, x, y, s, size = 20, align = 'center', col = P.dark) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = col; g.font = `${size * k}px "IM Fell English SC"`; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x * k, y * k); }
function box(g, k, x, y, w, h, title) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.strokeStyle = P.mid; g.lineWidth = 1.5 * k; g.setLineDash([6 * k, 5 * k]); g.strokeRect(x * k, y * k, w * k, h * k); g.setLineDash([]);
  if (title) { g.fillStyle = '#E9E5DA'; g.font = `${19 * k}px "IM Fell English SC"`; const tw = g.measureText(title).width; g.fillRect(x * k + 14 * k, y * k - 12 * k, tw + 16 * k, 22 * k); label(g, k, x + 22, y + 6, title, 19, 'left', P.ink); }
}
// 构造辅助线（浅灰）
function guide(g, k, x0, x1, ys) { g.setTransform(1, 0, 0, 1, 0, 0); g.strokeStyle = 'rgba(120,115,105,.35)'; g.lineWidth = 1 * k; for (const y of ys) { g.beginPath(); g.moveTo(x0 * k, y * k); g.lineTo(x1 * k, y * k); g.stroke(); } }
function speedLines(pts, n = 3, len = 80) { for (let i = 0; i < n; i++) stroke([[pts[0] - len - i * 10, pts[1] + i * 22], [pts[0] - 10 - i * 10, pts[1] + i * 22]], T.S.lw * .7, { line: P.mid }); }

export function modelSheet(g, CW, CH, t) {
  const k = CW / 1920;
  paper(g, CW, CH, 'THE MUG  &  THE CUBE', 'Model sheet No. 1  ·  "Coffee Cup Chase"  ·  1930s rubber hose  ·  line 6 px @ 1080  ·  animate on twos, breathe on every beat');
  T.BASE.splice(0, 6, k, 0, 0, k, 0, 0); T.S.lwScale = k; T.frame(t);
  // ——— 马克杯 ———
  box(g, k, 30, 128, 1150, 356, 'THE MUG — turnaround');
  const gy = 446, mk = .8;
  guide(g, k, 40, 1170, [gy, gy + MUG.y1 * mk, gy + MUG.y0 * mk, gy - 172 * mk]);
  const views = [[0, 'front'], [38, 'three-quarter'], [78, 'profile'], [180, 'back']];
  views.forEach(([tn, lab], i) => {
    const x = 175 + i * 280;
    mug({ x, y: gy, k: mk, turn: tn, t: 0, armL: { x: -128, y: -34, hand: 'open', bend: 14 }, armR: { x: 128, y: -34, hand: 'open', bend: -14 }, eyes: { lx: tn ? .45 : 0 }, mouth: { type: 'smile' }, steam: tn === 180 ? 'lazy' : 'lazy', back: tn === 180 });
    label(g, k, x, gy + 30, lab, 20);
  });
  // 表情
  box(g, k, 30, 500, 1150, 262, 'expressions — the steam is the mood');
  const ex = [
    ['sleepy', { eyes: { lid: .58, lx: 0, ly: .3 }, mouth: { type: 'yawn' }, steam: 'lazy' }],
    ['BITTER!', { eyes: { type: 'squeeze' }, mouth: { type: 'pucker', w: 60 }, steam: 'bitter', brows: 'angry', shake: 3 }],
    ['alarmed', { eyes: { type: 'wide' }, mouth: { type: 'o', open: 1.1 }, steam: 'up', brows: 'up' }],
    ['let down', { eyes: { lid: .38, ly: .7, lx: -.3, lidTilt: -.2 }, mouth: { type: 'frown' }, steam: 'sad', brows: 'sad' }],
    ['sweet', { eyes: { type: 'happy' }, mouth: { type: 'beam', open: .7 }, steam: 'heart', blush: true }],
  ];
  ex.forEach(([lab, o], i) => {
    const x = 142 + i * 228, y = 772;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.beginPath(); g.rect((x - 112) * k, 512 * k, 224 * k, 222 * k); g.clip();
    mug({ x, y: 790, k: .7, turn: 0, t: .3, ...o });
    g.restore();
    label(g, k, x, 755, lab, 21, 'center', lab === 'BITTER!' ? P.ink : P.dark);
  });
  // 关键姿势
  box(g, k, 30, 780, 1150, 290, 'key poses — no elbows, no knees');
  // 跑：风车腿 + 前倾
  const RX = 150, RY = 1040;
  speedLines([RX - 60, RY - 240], 3, 90);
  stroke(arc(RX + 6, RY - 44, 46, 30, Math.PI * .2, Math.PI * 1.6, 18), T.S.lw * .6, { line: P.mid });
  mug({ x: RX + 20, y: RY, k: .7, turn: 40, t: .5, lean: .26, legL: { x: 86, y: -8, bend: -20, ang: -.2, dir: 1 }, legR: { x: -96, y: -64, bend: 26, ang: .7, dir: 1 }, armR: { x: 200, y: -150, hand: 'grab', front: true, bend: -26 }, armL: { x: -170, y: -70, hand: 'fist', bend: 24 }, eyes: { lx: .9, ly: 0, lid: .15 }, brows: 'angry', mouth: { type: 'grin', open: .5 }, steam: 'blown' });
  label(g, k, RX, 1062, 'the chase', 19);
  // 伸长：胳膊伸满画面
  const SX = 520;
  mug({ x: SX, y: RY, k: .66, turn: 30, lean: -.05, t: .5, armR: { x: 540, y: -50, hand: 'grab', front: true, via: [[180, -210], [290, -90], [410, -190]] }, armL: { x: -140, y: -60, hand: 'open', bend: 20 }, eyes: { type: 'squeeze', side: -1 }, mouth: { type: 'grin', open: .35, w: 56 }, brows: 'angry', steam: 'up', legL: { x: -44, y: 0, bend: 10 }, legR: { x: 52, y: 0, bend: -10 } });
  label(g, k, SX + 90, 1062, 'the stretch (rubber arm, any length)', 19);
  // 跳舞：踢腿
  const DX = 990;
  mug({ x: DX, y: RY, k: .64, turn: 12, sy: 1.06, sx: .96, t: .5, legL: { x: -30, y: 0, bend: 6 }, legR: { x: 116, y: -120, bend: -26, ang: -.9, dir: 1 }, armL: { x: -190, y: -270, hand: 'open', bend: 30 }, armR: { x: 180, y: -280, hand: 'open', bend: -30 }, eyes: { type: 'happy' }, mouth: { type: 'beam' }, steam: 'heart', blush: true });
  label(g, k, DX, 1062, 'the dance', 19);

  // ——— 方糖 ———
  box(g, k, 1200, 128, 690, 356, 'THE CUBE — turnaround');
  const cy = 420;
  guide(g, k, 1210, 1880, [cy, cy - 54 * 1.6 - 28 * 1.6]);
  [[0, 'front'], [35, 'three-quarter'], [72, 'profile'], [180, 'back']].forEach(([tn, lab], i) => {
    const x = 1280 + i * 150;
    cube({ x, y: cy, k: 1.5, turn: tn, armL: { x: -44, y: -44, hand: 'open', bend: 6 }, armR: { x: 44, y: -44, hand: 'open', bend: -6 }, eyes: { lx: tn ? .5 : 0 }, mouth: { type: 'smile' } });
    label(g, k, x, cy + 30, lab, 19);
  });
  // 身高对比
  g.save(); g.globalAlpha = .3; mug({ x: 1862, y: cy, k: .42, turn: 0, steam: 'none', mouth: { type: 'smile' }, eyes: {} }); cube({ x: 1822, y: cy, k: .42, turn: 20 }); g.restore();
  label(g, k, 1840, cy + 34, 'to scale', 17);
  box(g, k, 1200, 500, 690, 262, 'expressions');
  const cex = [
    ['scared', { eyes: { type: 'wide' }, mouth: { type: 'wavy', open: .8 }, brows: 'up', sweat: [[-50, -84, 5], [48, -92, 4]] }],
    ['sly', { eyes: { lid: .45, lx: .7 }, mouth: { type: 'grin', open: .35 } }],
    ['touched', { eyes: { lx: 0, ly: -.6 }, mouth: { type: 'frown' }, brows: 'sad' }],
    ['joy', { eyes: { type: 'happy' }, mouth: { type: 'beam', open: .8 } }],
  ];
  cex.forEach(([lab, o], i) => { const x = 1290 + i * 168; cube({ x, y: 722, k: 1.7, turn: 18, ...o }); label(g, k, x, 750, lab, 20); });
  box(g, k, 1200, 780, 690, 290, 'key poses');
  // 逃跑
  speedLines([1250, 930], 3, 60);
  cube({ x: 1320, y: 1030, k: 1.5, turn: 45, lean: .22, legL: { x: 26, y: -6, bend: -6, dir: 1 }, legR: { x: -24, y: -18, bend: 8, ang: .5, dir: 1 }, armL: { x: -40, y: -110, hand: 'open', bend: 10 }, armR: { x: 46, y: -118, hand: 'open', bend: -10 }, eyes: { type: 'wide', lx: -.8 }, mouth: { type: 'wavy' }, brows: 'up', sweat: [[-48, -96, 5]] });
  label(g, k, 1320, 1062, 'the getaway', 19);
  // 纵身一跳
  cube({ x: 1510, y: 1000, k: 1.5, turn: 20, sy: 1.18, sx: .88, legL: { x: -10, y: -8, bend: 8 }, legR: { x: 14, y: -16, bend: -8, ang: .4 }, armL: { x: -44, y: -108, hand: 'open', bend: 6 }, armR: { x: 48, y: -108, hand: 'open', bend: -6 }, eyes: { type: 'happy' }, mouth: { type: 'o', open: .9 } });
  stroke(arc(1510, 1044, 30, 6, 0, Math.PI * 2, 20), T.S.lw * .5, { line: P.mid });
  label(g, k, 1510, 1062, 'the leap', 19);
  // 结局：泡在咖啡里
  mug({ x: 1760, y: 1040, k: .72, turn: 0, t: .5, eyes: { type: 'happy' }, mouth: { type: 'beam', open: .6 }, steam: 'heart', steamX: 64, blush: true, armL: { x: -150, y: -130, hand: 'open', bend: 14 }, armR: { x: 150, y: -130, hand: 'open', bend: -14 },
    inCup: () => { cube({ x: -24, y: -234, k: 1.25, turn: 0, legLen: 0, towel: true, eyes: { type: 'happy' }, mouth: { type: 'smile' }, armL: { x: -62, y: -104, hand: 'wave', bend: 8 } }); } });
  label(g, k, 1760, 1062, 'the finale (a hot bath)', 19);
}

// 群演表：每个物件画两次——呼吸的两个极端（浅色 = 吸气压扁，实线 = 呼气拉长）
export function kitchenSheet(g, CW, CH, t) {
  const k = CW / 1920;
  paper(g, CW, CH, 'THE KITCHEN — SUPPORTING CAST', 'Model sheet No. 2  ·  everything is alive and breathes on the beat (ghost = squash extreme, ink = stretch extreme)  ·  palette  ·  titles  ·  captions');
  T.BASE.splice(0, 6, k, 0, 0, k, 0, 0); T.S.lwScale = k; T.frame(t);
  box(g, k, 30, 128, 1860, 440, 'the cast');
  const gy = 520;
  guide(g, k, 40, 1880, [gy]);
  const two = (fn) => { g.save(); g.globalAlpha = .22; fn(-1); g.restore(); g.globalAlpha = 1; fn(1); };
  two(b => clock(150, gy, 1.15, b, { mouth: 'grin' }));
  label(g, k, 150, gy + 32, 'alarm clock (rings at 7:00)', 18);
  two(b => toaster(410, gy, 1.2, b, { lx: .2, mouth: 'grin' }));
  label(g, k, 410, gy + 32, 'toaster (pops sugar like toast)', 18);
  two(b => faucet(650, gy, 1.2, b, { drip: 20 }));
  label(g, k, 700, gy + 32, 'faucet (the nose drips)', 18);
  two(b => { shaker(910, gy, 1.25, b, { lean: -.12 * b, mouth: 'grin' }); shaker(990, gy, 1.25, -b, { pepper: true, lean: .12 * b, lx: -.6 }); });
  label(g, k, 950, gy + 32, 'salt & pepper (a dance team)', 18);
  two(b => sugarBowl(1180, gy, 1.2, b, { lid: .35 }));
  label(g, k, 1180, gy + 32, 'sugar bowl (the cube lives here)', 18);
  two(b => windowCurtain(1420, gy - 20, .95, b));
  label(g, k, 1420, gy + 32, 'curtains (billow on the beat)', 18);
  two(b => { hanging(1640, 170, 1.05, 'pot', b * .12); hanging(1740, 170, 1.05, 'pan', -b * .12); hanging(1830, 170, 1.05, 'ladle', b * .1); });
  label(g, k, 1735, gy + 32, 'pots, pan & ladle (swing like bells)', 18);

  box(g, k, 30, 590, 900, 480, 'the china cabinet = a xylophone');
  plateStair(130, 1000, 1.1, 7);
  const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  notes.forEach((n, i) => label(g, k, 130 + i * 58 * 1.1 - 88, 1000 - i * 44 * 1.1 + 4, n, 24, 'center', P.ink));
  cube({ x: 130 + 3 * 58 * 1.1, y: 1000 - 3 * 44 * 1.1 - 12, k: 1.1, turn: 40, lean: .12, legL: { x: 16, y: -4, dir: 1 }, legR: { x: -14, y: -14, dir: 1, ang: .4 }, armL: { x: -36, y: -96, hand: 'open' }, armR: { x: 42, y: -100, hand: 'open' }, eyes: { type: 'wide', lx: .6 }, mouth: { type: 'o' } });
  label(g, k, 330, 680, 'each step = one note, rising', 22, 'center', P.ink);
  label(g, k, 330, 712, 'cube: xylophone eighths', 19);
  label(g, k, 330, 740, 'mug: tuba quarters (plates wobble)', 19);

  box(g, k, 950, 590, 940, 480, 'palette · lettering · captions');
  const pal = [['paper white', P.paper, '#F1EEE6'], ['light', P.light, '#C8C5BC'], ['mid', P.mid, '#9A978F'], ['dark mid', P.dmid, '#6B6963'], ['dark', P.dark, '#3B3A37'], ['ink', P.ink, '#141312']];
  pal.forEach(([n, c, hex], i) => { const x = 980 + i * 148; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = c; g.fillRect(x * k, 620 * k, 132 * k, 70 * k); g.strokeStyle = P.ink; g.lineWidth = 2 * k; g.strokeRect(x * k, 620 * k, 132 * k, 70 * k); label(g, k, x + 66, 712, n, 17); label(g, k, x + 66, 732, hex, 15, 'center', P.dmid); });
  // 片名字体
  g.setTransform(1, 0, 0, 1, 0, 0);
  fatTitle(g, 'Coffee Cup Chase', 1420 * k, 800 * k, 74 * k, { font: 'Shrikhand', bounce: i => Math.sin(i * 1.3) * 6 * k });
  label(g, k, 1420, 860, 'title: fat retro script, ink outline + drop shadow, each letter hops on its beat', 16);
  // 字幕牌
  subPlate(g, "And they're off!", 1420 * k, 950 * k, { size: 38 * k });
  label(g, k, 1420, 1012, "captions: the announcer's title card — IM Fell English SC, pops in on 2 frames, no fades", 16);
  label(g, k, 1420, 1040, 'film: 4:3 gate · rounded corners · weave ±1.5 px · flicker ±4% · scratches · dust · vignette', 16);
}
