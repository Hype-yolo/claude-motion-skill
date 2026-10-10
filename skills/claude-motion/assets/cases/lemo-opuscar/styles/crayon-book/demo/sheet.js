// 角色设定表：?test=model&page=girl|moon&v=1
import { layer, clear, line, fill, text, handCircle, CAM } from './crayon.js';
import { group, clearGroup } from './rig.js';
import { girl, head, sheep, moon, star } from './chars.js';
import { PAL } from './pal.js';
const C = group(), BG = layer(), TX = layer(), WX = layer(), WW = layer(), DUMMY = layer();
const WXG = { k: DUMMY, f: WX, l: WX };
const INK = PAL.crayon.ink;

function label(s, x, y, size = 30, o = {}) { text(TX, s, x, y, { size, col: INK, p: 0.9, ...o }); }

export function sheet(comp, t, Q) {
  const page = Q.get('page') || 'girl', v = Q.get('v') || '1';
  clearGroup(C); [BG, TX, WX, WW, DUMMY].forEach(clear);
  CAM.x = 960; CAM.y = 540; CAM.s = 1;
  if (page === 'girl') girlPage(v); else moonPage(v);
  comp.paperCam(0, 0, 1);
  comp.begin();
  comp.crayon(BG.c);
  if (page === 'moon') { comp.crayon(WX.c); comp.wash(WW.c, { color: PAL.wash }); }
  comp.group(C);
  comp.crayon(TX.c);
  comp.finish({ vig: 0.18 });
}

function rule(x0, y0, x1, y1, seed) { line(BG, [[x0, y0], [x1, y1]], { w: 3, col: PAL.crayon.sky, p: 0.55, seed, wob: 1.5 }); }

function girlPage(v) {
  label(`PIP  —  model sheet v${v}`, 40, 58, 48, { align: 'left', font: 'Gaegu', weight: 700 });
  label('"The Moon Can\'t Sleep"  ·  crayon picture book  ·  about 2.6 heads tall, drawn the way a child would', 560, 56, 26, { align: 'left', p: 0.6 });
  // 转面
  const views = [['front', 'FRONT'], ['q', '3/4'], ['side', 'SIDE'], ['back', 'BACK']];
  views.forEach(([vw, lab], i) => {
    const x = 150 + i * 235;
    girl(C, { x, y: 520, s: 1.12, view: vw, expr: 'awake', seed: 1000 + i * 37 });
    label(lab, x, 562, 30);
  });
  rule(40, 590, 1000, 590, 3); rule(1010, 90, 1010, 1060, 4);
  // 表情
  const ex = [['awake', 'awake (curious)'], ['smile', 'happy wave'], ['sing', 'singing'], ['yawn', 'yawn'], ['sleep', 'asleep']];
  ex.forEach(([e, lab], i) => {
    const x = 125 + i * 190;
    head(C, { x, y: 710, s: 1.05, view: 'q', expr: e, seed: 2000 + i * 41 });
    label(lab, x, 822, 26);
  });
  rule(40, 850, 1000, 850, 5);
  // 调色盒
  const cols = Object.entries(PAL.crayon);
  cols.forEach(([k, c], i) => {
    const x = 60 + i * 80, y = 900;
    fill(BG, [[x, y], [x + 58, y], [x + 58, y + 80], [x, y + 80]], { col: c, p: 0.8, seed: 300 + i, gap: 9, w: 11 });
    if (k === 'white') line(BG, [[x, y], [x + 58, y], [x + 58, y + 80], [x, y + 80], [x, y]], { w: 3, col: PAL.crayon.sky, p: 0.4, seed: 350 });
    label(k, x + 29, y + 112, 22);
  });
  label('12 crayons only · outlines always indigo, never black', 520, 1050, 24, { p: 0.7 });
  // 关键姿势
  label('KEY POSES', 1040, 130, 34, { align: 'left', font: 'Gaegu', weight: 700 });
  // 1 被窝里挥手
  girl(C, { x: 1170, y: 470, s: 0.95, view: 'front', pose: 'bed', expr: 'smile', arms: { R: [[34, -182], [80, -200], [94, -252]] }, seed: 3100 });
  fill(BG, [[1040, 380], [1300, 380], [1310, 470], [1030, 470]], { col: PAL.crayon.sky, p: 0.7, seed: 3150, ang: 0.3 });
  line(BG, [[1030, 382], [1100, 370], [1180, 386], [1250, 372], [1310, 382]], { w: 7, seed: 3151 });
  label('1 · waves from bed', 1170, 520, 26);
  // 2 爬梯（背面，小羊坐肩上）
  const lad = [[1440, 110], [1440, 480]], lad2 = [[1520, 110], [1520, 480]];
  line(BG, lad, { w: 8, col: PAL.crayon.brown, seed: 3201 }); line(BG, lad2, { w: 8, col: PAL.crayon.brown, seed: 3202 });
  for (let r = 0; r < 6; r++) line(BG, [[1436, 140 + r * 62], [1524, 138 + r * 62]], { w: 7, col: PAL.crayon.brown, seed: 3210 + r });
  girl(C, { x: 1480, y: 470, s: 0.92, view: 'back', pose: 'climb', ph: 0, seed: 3300, sheep: P => sheep(C, { x: P([[4, -128]])[0][0], y: P([[4, -128]])[0][1], s: 0.78, seed: 3350, r: -0.2 }) });
  label('2 · climbs (back view)', 1480, 520, 26);
  // 3 屋顶上唱歌
  fill(BG, [[1600, 460], [1900, 340], [1900, 480], [1600, 480]], { col: PAL.crayon.red, p: 0.75, seed: 3400, ang: -0.4 });
  line(BG, [[1600, 460], [1900, 340]], { w: 7, seed: 3401 });
  girl(C, { x: 1700, y: 416, s: 0.92, view: 'side', pose: 'sit', expr: 'sing', headTilt: -0.3, seed: 3500, sheep: P => sheep(C, { x: P([[46, -58]])[0][0], y: P([[46, -58]])[0][1], s: 0.72, seed: 3550 }) });
  // 飘起的音符
  [[1800, 170, 0], [1850, 120, 1], [1770, 110, 2]].forEach(([x, y, i]) => note(x, y, 900 + i));
  label('3 · sings on the roof', 1740, 520, 26);
  // 4 睡着：仰面躺在屋顶上，小羊趴在胸口
  const sl = 0.2;
  fill(BG, [[1030, 734], [1500, 830], [1500, 870], [1030, 870]], { col: PAL.crayon.red, p: 0.75, seed: 3600, ang: 0.4 });
  line(BG, [[1030, 734], [1500, 830]], { w: 7, seed: 3601 });
  girl(C, { x: 1270, y: 800, s: 0.95, view: 'side', pose: 'lieback', expr: 'sleep', r: sl, seed: 3700, sheep: P => sheep(C, { x: P([[-58, -112]])[0][0], y: P([[-58, -112]])[0][1], s: 0.74, r: sl, seed: 3750, eyesClosed: true }) });
  label('4 · asleep on the roof, sheep on her chest', 1270, 900, 26);
  // 小羊
  sheep(C, { x: 1700, y: 760, s: 1.6, seed: 3800 });
  label('the plush sheep', 1700, 900, 26);
  label('she carries it everywhere', 1700, 935, 22, { p: 0.6 });
  label('notes: dot eyes, round cheeks, star hair-clip (yellow) = echo of the stars.  Lines boil on 2s.', 1455, 1050, 22, { p: 0.65 });
}
function note(x, y, seed) {
  line(TX, [[x, y], [x, y - 44]], { w: 6, seed, col: INK });
  line(TX, [[x, y - 44], [x + 18, y - 34], [x + 20, y - 22]], { w: 6, seed: seed + 1, col: INK });
  fill(TX, handCircle(x - 9, y, 10, seed, 0, 16), { col: INK, p: 0.95, gap: 3.5, w: 5, seed: seed + 2, over: 1 });
}

function moonPage(v) {
  label(`THE MOON  —  model sheet v${v}`, 40, 58, 48, { align: 'left', font: 'Gaegu', weight: 700 });
  label('a yellow-crayon disc with a child\'s face · it has not slept in weeks', 780, 56, 26, { align: 'left', p: 0.6 });
  const ex = [['wide', 'can\'t sleep (staring)'], ['grumpy', 'tossing (scrunched)'], ['look', 'counting sheep'], ['yawn', 'yawning'], ['drowsy', 'drowsy']];
  ex.forEach(([e, lab], i) => {
    const x = 160 + i * 330, y = 290;
    moon(C, { x, y, s: 130, expr: e, seed: 4000 + i * 53, r: e === 'grumpy' ? -0.35 : 0 });
    label(lab, x, 470, 28);
  });
  rule(40, 505, 1880, 505, 7);
  // 入睡：闭眼 → 拉上被子 → 弯月
  label('FALLING ASLEEP  (the phase change is the moon pulling up its blanket)', 40, 560, 30, { align: 'left', font: 'Gaegu', weight: 700 });
  const ph = [[0, 0, 0], [0.4, 1, 0], [0.75, 1, 0.3], [1, 0, 0]];
  ph.forEach(([b, hand, tuck], i) => {
    const x = 160 + i * 250, y = 780;
    moon(C, { x, y, s: 92, expr: 'asleep', cap: 1, blanket: b, hand, tuck, r: -1.0 * Math.min(1, i), seed: 5000 + i * 31 });
    label(['nightcap drawn on', 'hand pulls the quilt', 'fold edge, tuck', 'sleeping crescent'][i], x, 930, 24);
  });
  // 右下：蜡笔防水材质试样
  label('WAX RESIST  (the climax)', 1150, 560, 30, { align: 'left', font: 'Gaegu', weight: 700 });
  for (let i = 0; i < 26; i++) { const x = 1170 + (i * 97 % 670), y = 620 + ((i * 53) % 290); star(WXG, [x, y], 9 + (i % 4) * 4, 6000 + i, 0.1 * i, PAL.crayon.white, false); }
  moon(WXG, { x: 1720, y: 700, s: 66, expr: 'asleep', blanket: 1, cap: 1, r: -1.0, seed: 6100 });
  const g = WW.g; g.fillStyle = '#000';
  for (let k = 0; k < 4; k++) { g.globalAlpha = 0.55; g.beginPath(); g.moveTo(1400 + k * 3, 600); g.lineTo(1880, 600 + k * 4); g.lineTo(1880 - k * 5, 930); g.lineTo(1395, 935 - k * 3); g.closePath(); g.fill(); }
  label('white crayon stars, invisible on paper', 1280, 960, 22, { p: 0.7 });
  label('→ a sweep of ultramarine wash reveals them', 1640, 960, 22, { p: 0.7 });
  rule(1120, 540, 1120, 1000, 8);
  // 小羊（数羊用的羊）
  sheep(C, { x: 1270, y: 760, s: 1.1, seed: 6200 });
  label('counted sheep', 1270, 830, 22, { p: 0.7 });
  label('lines boil on 2s · colouring spills past the outline · 12 crayons + 1 watercolour', 960, 1050, 24, { p: 0.65 });
}
