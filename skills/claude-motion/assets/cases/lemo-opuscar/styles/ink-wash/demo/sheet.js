// 角色设定表（关卡 1）：?test=sheet
import { mk, draw, TONE, mass } from './ink.js';
import { hero, POSE, VERM } from './hero.js';
import { face } from './face.js';
import { seal } from './seal.js';

const INK = '#000';
function text(c, s, x, y, font, a = .9, align = 'left', spacing = 0) {
  c.save(); c.globalAlpha = a; c.fillStyle = INK; c.font = font; c.textAlign = align; c.textBaseline = 'alphabetic';
  if (spacing) c.letterSpacing = spacing + 'px';
  c.fillText(s, x, y); c.restore();
}
function frame(L, x, y, w, h, seed) {  // 细干笔框
  const o = { w: 1.6, tone: .55, dry: .55, prof: 'even', seed };
  draw(L, mk([[x, y], [x + w, y + 1]], { ...o, seed: seed + 1 }));
  draw(L, mk([[x + w, y], [x + w - 1, y + h]], { ...o, seed: seed + 2 }));
  draw(L, mk([[x + w, y + h], [x, y + h - 1]], { ...o, seed: seed + 3 }));
  draw(L, mk([[x, y + h], [x + 1, y]], { ...o, seed: seed + 4 }));
}
export function renderSheet(t, A, comp) {
  A.clear();
  const L = A.ink, cd = A.cd;
  // 标题
  text(cd, 'THE SWORDSMAN', 70, 88, '600 54px CormorantSC', .92, 'left', 6);
  text(cd, 'model sheet  ·  Chinese Ink Wash  ·  “The Swordsman and the River”  ·  v1', 72, 124, 'italic 500 25px Cormorant', .7);
  seal(A.cc, 640, 42, 58, .95, 5);
  // 转面
  const base = 575, sc = 4.1;
  const turn = [['FRONT', POSE.front, 1, 205], ['PROFILE', POSE.stand, 1, 515], ['BACK', POSE.back, 1, 825], ['IN FILM  ·  RIGHT → LEFT', POSE.stand, -1, 1150]];
  turn.forEach(([lab, p, dir, x], i) => {
    hero(L, p, { x, y: base, s: sc, dir, seed: 10 + i, t: .8 });
    text(cd, lab, x, base + 40, '600 20px CormorantSC', .72, 'center', 3);
  });
  // 地面淡墨一抹
  draw(L, mk([[80, base + 4], [700, base + 6], [1330, base + 3]], { w: 7, tone: .12, wet: 1, dry: .2, prof: 'lens', seed: 77 }));
  // 色板
  const px = 1440; let py = 190;
  text(cd, 'INK  ·  FIVE TONES', px, 168, '600 21px CormorantSC', .75, 'left', 3);
  const tones = [['JIAO', 'burnt', TONE.jiao], ['NONG', 'thick', TONE.nong], ['ZHONG', 'heavy', TONE.zhong], ['DAN', 'light', TONE.dan], ['QING', 'clear', TONE.qing]];
  tones.forEach(([n, en, v], i) => {
    const y = py + i * 44;
    draw(L, mk([[px, y], [px + 90, y - 2], [px + 150, y + 1]], { w: 26, tone: v, wet: .8, dry: .12, prof: 'brush', seed: 200 + i }));
    text(cd, `${n}`, px + 175, y + 8, '600 22px CormorantSC', .85, 'left', 2);
    text(cd, `${en} · ${v.toFixed(2)}`, px + 290, y + 8, 'italic 500 22px Cormorant', .65);
  });
  py += 5 * 44 + 10;
  draw({ col: A.cc }, mk([[px, py], [px + 90, py - 2], [px + 150, py + 1]], { w: 26, tone: .95, dry: .3, color: VERM, prof: 'brush', seed: 300 }));
  text(cd, 'ZHU', px + 175, py + 8, '600 22px CormorantSC', .85, 'left', 2);
  text(cd, 'vermilion · #B02E22', px + 290, py + 8, 'italic 500 22px Cormorant', .65);
  py += 44;
  A.cc.fillStyle = 'rgba(242,236,222,1)'; A.cc.fillRect(px, py - 16, 150, 30);
  frame(L, px, py - 16, 150, 30, 400);
  text(cd, 'XUAN', px + 175, py + 8, '600 22px CormorantSC', .85, 'left', 2);
  text(cd, 'rice paper · #F2ECDE', px + 290, py + 8, 'italic 500 22px Cormorant', .65);
  // 设计要点
  const notes = ['Hat — one wet mass, two dry ridge lines.', 'Robe — pale base + two loaded strokes;', '   the dark edge of the brush is the contour.', 'Legs, sword — burnt-ink lines.', 'Tassel — the only colour in the film.'];
  notes.forEach((s, i) => text(cd, s, px, py + 52 + i * 28, 'italic 500 22px Cormorant', .72));
  // 表情（特写小格）
  const ex = [['CALM', 'calm'], ['ALERT', 'alert'], ['RESOLVE', 'resolve'], ['AT PEACE', 'peace']];
  text(cd, 'EXPRESSIONS', 70, 668, '600 21px CormorantSC', .75, 'left', 3);
  ex.forEach(([lab, e], i) => {
    const x = 70 + i * 232, y = 686, w = 212, h = 318;
    for (const c of [A.cw, A.cd, A.cc]) { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); }
    face(L, e, { x: x + w / 2 + 4, y: y + 150, s: 2.25, seed: 30 + i });
    for (const c of [A.cw, A.cd, A.cc]) c.restore();
    frame(L, x, y, w, h, 500 + i * 10);
    text(cd, lab, x + w / 2, y + h + 32, '600 20px CormorantSC', .72, 'center', 3);
  });
  // 关键姿势
  text(cd, 'KEY POSES', 1030, 668, '600 21px CormorantSC', .75, 'left', 3);
  const kp = [['LEAP', POSE.leap, -1, 1130], ['BOW', POSE.bow, 1, 1340], ['WRITING', { ...POSE.backWrite, aR: [[8.5, -74], [20, -79], [31, -85]], sword: { a: -.62 } }, 1, 1520], ['DRAW', POSE.draw, 1, 1700]];
  kp.forEach(([lab, p, dir, x], i) => {
    const y = lab === 'LEAP' ? 975 : 1010;
    hero(L, p, { x, y, s: 2.9, dir, seed: 60 + i, t: 1.3 });
    text(cd, lab, x + (lab === 'LEAP' ? 10 : 0), 1045, '600 20px CormorantSC', .72, 'center', 3);
  });
  // 点水的墨圈
  for (let k = 0; k < 2; k++) {
    const r = 30 + k * 26;
    draw(L, mk(Array.from({ length: 25 }, (_, i) => { const a = i / 24 * Math.PI * 2; return [1160 + Math.cos(a) * r, 1012 + Math.sin(a) * r * .22]; }), { w: 3 - k, tone: .5 - k * .2, dry: .5, wet: .5, prof: 'even', seed: 700 + k }));
  }
  comp(A, null, { bleed: 4, rim: 1.0, vig: .12 });
}
