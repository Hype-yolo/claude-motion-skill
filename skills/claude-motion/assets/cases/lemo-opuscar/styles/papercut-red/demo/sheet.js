// 角色设定表（女孩 / 年兽）：?test=sheet_girl / ?test=sheet_nian
import { PAL, fillPaper, piece, fill, cut, trace, canvas, Pl, P, ellipsePoly, curve, cutTaper } from './paper.js';
import { sawRow, crescentRows, swirl, doubleSwirl, cloudCut, rosette, plum } from './motifs.js';
import { put, mul, T, S, R } from './rig.js';
import { drawGirl, buildGirl, GJ, PELVIS } from './girl.js';
import { drawNian, buildNian, NPOSE, NJ, HS } from './nian.js';
import { wedgeFlat, tuanhua } from './tuanhua.js';

const INK = '#3a1410';
function label(g, x, y, s, size = 19, col = INK, align = 'left', wt = 500, italic = false) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.font = `${italic ? 'italic ' : ''}${wt} ${size}px "Fraunces"`; g.fillStyle = col; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); g.restore();
}
function leader(g, x0, y0, x1, y1) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.strokeStyle = 'rgba(58,20,16,.7)'; g.lineWidth = 1.2; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]);
  g.beginPath(); g.arc(x1, y1, 3, 0, 7); g.fillStyle = 'rgba(58,20,16,.85)'; g.fill(); g.restore();
}
function rivet(g, x, y, r = 8) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.beginPath(); g.arc(x, y, r, 0, 7); g.strokeStyle = '#1d4a8a'; g.lineWidth = 2; g.stroke(); g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fillStyle = '#1d4a8a'; g.fill(); g.restore();
}
function panel(g, x0, y0, x1, y1, title, sub) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.strokeStyle = 'rgba(58,20,16,.55)'; g.lineWidth = 1.5; g.strokeRect(x0 + 8, y0 + 8, x1 - x0 - 16, y1 - y0 - 16); g.restore();
  label(g, x0 + 22, y0 + 36, title, 20, '#8e0f1c', 'left', 700);
  if (sub) label(g, x0 + 22 + measure(g, title, 20, 700) + 12, y0 + 36, sub, 17, INK, 'left', 400, true);
}
function measure(g, s, size, wt) { g.save(); g.font = `${wt} ${size}px "Fraunces"`; const w = g.measureText(s).width; g.restore(); return w; }
function header(g, title, right) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const strip = piece([0, 0, 1920, 64], q => {
    const top = []; for (let x = 0; x <= 1920; x += 12) top.push([x, 2 + (x / 12 % 2) * 5]);
    const bot = []; for (let x = 1920; x >= 0; x -= 12) bot.push([x, 58 + (x / 12 % 2) * 5]);
    fill(q, qq => trace(qq, top.concat(bot)), PAL.sub);
  }, { ss: 1, seed: 5, col: PAL.sub });
  put(g, strip, [1, 0, 0, 1, 0, 2], { shadow: .8 });
  label(g, 26, 44, title, 30, '#fff1d6', 'left', 700);
  label(g, 1894, 42, right, 19, '#fff1d6', 'right', 400, true);
  // 印章
  g.fillStyle = PAL.red; g.fillRect(26 + measure(g, title, 30, 700) + 18, 12, 40, 40);
  g.font = '400 30px "Ma Shan Zheng"'; g.fillStyle = '#fff1d6'; g.textAlign = 'center'; g.fillText('剪', 26 + measure(g, title, 30, 700) + 38, 43);
  g.restore();
}

export function girlSheet(g) {
  const Gp = buildGirl();
  g.setTransform(1, 0, 0, 1, 0, 0); fillPaper(g, 'rice', 0, 0, 1920, 1080);
  header(g, 'THE GIRL — PAPER-CUT MODEL SHEET  v1', 'Nian Comes to Town · one sheet of red paper · 12 fps jointed cut-out');
  // A 转面
  panel(g, 0, 66, 720, 764, 'TURNAROUND', 'profile acts · front is fold-cut');
  const k = 1.42, by = 742;
  drawGirl(g, [k, 0, 0, k, 130, by], { expr: 'smile', shF: -.15, elF: -.25 });
  put(g, Gp.front, [k, 0, 0, k, 360, by]);
  drawGirl(g, [k, 0, 0, k, 590, by], { flip: true, expr: 'smile', shF: -.15, elF: -.25 });
  label(g, 150, 758, 'profile R (film)', 16, INK, 'center', 500, true); label(g, 360, 758, 'front · half cut, mirrored', 16, INK, 'center', 500, true); label(g, 580, 758, 'profile L (flipped)', 16, INK, 'center', 500, true);
  // 身高刻度
  g.save(); g.strokeStyle = 'rgba(58,20,16,.35)'; g.setLineDash([6, 5]); for (const [yy, t] of [[by, '0'], [by - 212 * k, '½'], [by - 424 * k, '1']]) { g.beginPath(); g.moveTo(24, yy); g.lineTo(700, yy); g.stroke(); label(g, 700, yy - 4, t, 14, INK, 'right'); } g.restore();
  // A2 纸与纹样
  panel(g, 0, 764, 720, 1080, 'PAPER & PATTERN', 'everything is cut, nothing is painted');
  const chips = [[PAL.red, 'china red', '#d2201f'], [PAL.nian, 'nian red', '#b00f26'], [PAL.far, 'far hills', '#7e1424'], ['#f2e8d0', 'rice paper', '#f2e8d0'], [PAL.indigo, 'night paper', '#1c2446'], [PAL.gold, 'gold foil', 'finale only']];
  chips.forEach(([c, n, v], i) => {
    const x = 36 + i * 112, y = 814, pc = piece([0, 0, 88, 58], q => fill(q, qq => trace(qq, Pl([[0, 0], [88, 0], [88, 58], [0, 58]], true, .5, i + 3)), c), { ss: 1, seed: i, col: c });
    put(g, pc, [1, 0, 0, 1, x, y], { shadow: .8 }); label(g, x, y + 80, n, 16, INK, 'left', 600); label(g, x, y + 98, v, 14, INK, 'left', 400, true);
  });
  const pats = [
    ['sawtooth 锯齿', q => { for (let r = 0; r < 3; r++) sawRow(q, [[6, 14 + r * 22], [110, 14 + r * 22]], 16, 8, 1, .74); }],
    ['crescent 月牙', q => crescentRows(q, 4, 6, 116, 70, 12, 4.5, 0, .72)],
    ['swirl 旋涡', q => { doubleSwirl(q, 60, 40, 60, 5, .4); }],
    ['cloud 云纹', q => { cloudCut(q, 50, 44, 20, 3.4, .2, 1); cloudCut(q, 92, 30, 12, 2.6, 2, -1); }],
  ];
  pats.forEach(([n, fn], i) => {
    const x = 36 + i * 136, y = 930;
    const pc = piece([0, 0, 120, 80], q => { fill(q, qq => trace(qq, Pl([[0, 0], [120, 0], [120, 80], [0, 80]], true, .5, i + 9)), PAL.red); fn(q); }, { ss: 2, seed: i + 20 });
    put(g, pc, [1, 0, 0, 1, x, y], { shadow: .8 }); label(g, x, y + 104, n, 16, INK, 'left', 600);
  });
  { const w = wedgeFlat(1.2); put(g, w, [.26, 0, 0, .26, 590, 926], { shadow: .8 }); label(g, 590, 1034, '1/8 wedge → 团花', 16, INK, 'left', 600); }

  // B 分件
  panel(g, 720, 66, 1250, 560, 'PIECES', 'pinned at neck · shoulders · elbows · hips · knees');
  const kb = 1.3;
  const P = (p, x, y, pins, lab, lx, ly) => { put(g, p, [kb, 0, 0, kb, x, y]); for (const [px, py] of pins) rivet(g, x + px * kb, y + py * kb, 7); if (lab) label(g, lx ?? x, ly ?? y + 24, lab, 16, INK, 'center', 500, true); };
  P(Gp.head.smile, 850, 346, [[0, 0]], 'head', 850, 380);
  P(Gp.torso, 1040, 330, [GJ.neck, GJ.shF, GJ.shB, GJ.hipF, GJ.hipB], 'padded coat', 1040, 384);
  P(Gp.uaF, 1170, 140, [[0, 0], [0, 46]], 'upper arm', 1170, 232);
  P(Gp.faF.fist, 1170, 262, [[0, 0]], 'forearm + hand', 1170, 368);
  P(Gp.thF, 790, 410, [[0, 0], [0, 52.5]], 'thigh', 790, 510);
  P(Gp.shF, 890, 410, [[0, 0]], 'shin + tiger shoe', 910, 510);
  { const M = [1.7, 0, 0, 1.7, 1110, 460]; put(g, Gp.bladeA, mul(M, R(-.25))); put(g, Gp.bladeB, mul(M, R(.25))); rivet(g, 1110, 460, 6); label(g, 1110, 510, 'scissors · 2 blades', 16, INK, 'center', 500, true); }
  label(g, 1236, 552, 'blue rings = rivets (joint pins)', 14, '#1d4a8a', 'right', 500, true);
  // C 脸片
  panel(g, 1250, 66, 1920, 560, 'FACE PIECES', 'swapped whole, never morphed');
  const faces = [['smile', 'smile'], ['surprise', 'surprise'], ['scared', 'scared'], ['determined', 'determined'], ['sleep', 'asleep (dawn)']];
  faces.forEach(([e, n], i) => {
    const col = i < 3 ? i : i - 3, row = i < 3 ? 0 : 1, x = row ? 1440 + col * 260 : 1370 + col * 225, y = row ? 520 : 290, kk = 1.08;
    put(g, Gp.head[e], [kk, 0, 0, kk, x, y]); label(g, x + 10, y + 26, n, 16, INK, 'center', 600);
  });
  // D 关键姿势
  panel(g, 720, 560, 1920, 1080, 'KEY POSES', '12 fps, held on twos');
  const poses = [
    [{ expr: 'smile', shF: -1.05, elF: -1.5, handF: 'fist', scissors: { ang: -.3, open: .45 }, shB: -.6, elB: -1.1, handB: 'fist' }, 'cutting at the window'],
    [{ expr: 'scared', ground: true, lean: .42, hipF: -1.35, knF: 1.25, hipB: -1.15, knB: 1.2, shF: -1.3, elF: -1.9, shB: -1.0, elB: -1.8, head: -.05 }, 'ducks below the sill'],
    [{ expr: 'determined', lean: -.08, shF: -2.15, elF: -.7, shB: -1.95, elB: -.75, handF: 'flat', handB: 'flat', hipF: .1, hipB: -.08, head: -.3 }, 'presses the flower up'],
    [{ expr: 'determined', lean: -.03, shF: -1.62, elF: -.12, handF: 'fist', scissors: { ang: -1.45, open: .5 }, shB: .35, elB: -1.2, hipF: -.18, knF: .1, hipB: .2, knB: .05 }, 'scissors out — faces Nian'],
  ];
  poses.forEach(([p, n], i) => { const x = 850 + i * 300, y = 1030; const r = drawGirl(g, [1.02, 0, 0, 1.02, x, y], p); if (i === 2) put(g, tuanhua(1), [.2, 0, 0, .2, r.joints.hand[0] + 20, r.joints.hand[1] - 50]); label(g, x + 20, 1062, n, 17, INK, 'center', 600); });
}

export function nianSheet(g) {
  const Np = buildNian(), Gp = buildGirl();
  g.setTransform(1, 0, 0, 1, 0, 0); fillPaper(g, 'rice', 0, 0, 1920, 1080);
  header(g, 'NIAN — PAPER-CUT MODEL SHEET  v1', 'deep red paper · big head, round belly, short legs · weight from sheer size');
  // A 侧面 + 标注
  panel(g, 0, 66, 1180, 650, 'NIAN IN PROFILE', 'pinned at 11 rivets · beside the girl at the same scale');
  const k = .45, ox = 640, oy = 624 - NJ.ground * k;
  const r = drawNian(g, [k, 0, 0, k, ox, oy], NPOSE.stand);
  for (const [n, p] of Object.entries(r.joints)) rivet(g, p[0], p[1], 7);
  for (const key of ['ffU', 'bfU']) { const M = r.M[key]; rivet(g, M[4], M[5], 6); const K2 = r.M[key.replace('U', 'L')]; rivet(g, K2[4], K2[5], 6); }
  drawGirl(g, [k, 0, 0, k, 1110, 624], { flip: true, expr: 'surprise' });
  const pt = (M, p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
  const lab = (text, sub, lx, ly, p) => { leader(g, lx + (lx < p[0] ? measure(g, text, 18, 700) + 6 : -6), ly - 6, p[0], p[1]); label(g, lx, ly, text, 18, INK, 'left', 700); if (sub) label(g, lx, ly + 19, sub, 15, INK, 'left', 400, true); };
  lab('horn', 'ring grooves', 40, 150, pt(r.M.head, [-110, -424]));
  lab('big round eye', 'eye piece swaps', 40, 262, pt(r.M.head, [-252, -166]));
  lab('saw-tooth grin', 'jaw hinges open', 40, 452, pt(r.M.jaw, [-160, 10]));
  lab('cloud-curl mane 云纹', null, 560, 124, pt(r.M.mane, [-40, -272]));
  lab('saw-tooth spine 锯齿', 'doubles as a mountain ridge', 860, 190, pt(r.M.body, [60, -254]));
  lab('joint swirls 旋涡', null, 930, 330, pt(r.M.body, [214, -15]));
  lab('crescent scales 月牙', null, 880, 540, pt(r.M.body, [30, -40]));
  lab('belly fringe 锯齿', null, 250, 600, pt(r.M.body, [-60, 176]));
  lab('cloud tail', null, 1010, 122, pt(r.M.tail, [10, -240]));
  label(g, 1160, 640, 'blue rings = rivets', 14, '#1d4a8a', 'right', 500, true);
  // B 眼片
  panel(g, 1180, 66, 1920, 650, 'EYE PIECES', 'the face never morphs');
  const eyes = [['normal', 'curious'], ['sniff', 'sniffing'], ['fierce', 'roar'], ['squint', 'dazzled by red light'], ['dizzy', 'fleeing']];
  eyes.forEach(([e, n], i) => {
    const col = i < 3 ? i : i - 3, row = i < 3 ? 0 : 1, kk = .3 * HS, cx = row ? 1435 + col * 240 : 1318 + col * 240, cy = row ? 490 : 250;
    put(g, Np.head[e], [kk, 0, 0, kk, cx + 225 * kk, cy + 170 * kk]); label(g, cx, cy + 128, n, 16, INK, 'center', 600);
  });
  // C 关键姿势
  panel(g, 0, 650, 1920, 1080, 'KEY POSES', 'slow and heavy — each footfall shakes the frame 2 px');
  const poses = [[NPOSE.stalk, 'stalks & sniffs the rooftops'], [NPOSE.roar, 'roars'], [NPOSE.flinch, 'flinches from the red light'], [{ ...NPOSE.run, flip: true }, 'runs for the hills']];
  poses.forEach(([p, n], i) => { const kk = .29, x = [290, 740, 1190, 1560][i], y = 1036 - NJ.ground * kk; drawNian(g, [kk, 0, 0, kk, x, y], p, { shadow: 1 }); label(g, x - 20, 1066, n, 17, INK, 'center', 600); });
}
