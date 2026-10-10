// The Bell Founder · front / back views for the model sheet (static, symmetric drawings)
import * as WC from './engine/index.js';
import { part, drawPart, put } from './rig.js';

const PI = Math.PI;
const LF = WC.light(.7, -.45, .3);
// mirror half control points (x ≥ 0, listed top→bottom along the right edge, first and last on x = 0)
const sym = h => [...h, ...h.slice(1, -1).reverse().map(([x, y]) => [-x, y])];
const mir = cp => cp.map(([x, y]) => [-x, y]).reverse();
const P = (key, def) => part('V.' + key, { light: LF, seed: key.length * 5 + key.charCodeAt(0), ...def });

// ---------------------------------------------------------------- founder
const FL = [[2, -282], [62, -282], [68, -150], [62, -52], [80, -30], [84, 0], [2, 0], [8, -52], [8, -150]];
const FUA = [[74, -530], [106, -506], [116, -430], [108, -392], [86, -394], [78, -460]];
const FFA = [[84, -402], [110, -398], [120, -322], [114, -300], [92, -302], [86, -360]];
const FHA = [[84, -312], [118, -312], [130, -270], [122, -234], [96, -232], [82, -266]];
function founderSide(g, back, t) {
  g.save(); g.scale(1.04, .86);
  for (const s of [1, -1]) {
    const f = s < 0 ? mir : x => x;
    drawPart(g, P(`f${back}L${s}`, { cp: f(FL), a0: PI / 2, sp: 7, k: s > 0 ? 1 : .7, feats: [{ cp: f([[4, -54], [40, -56], [64, -54]]), w: 3 }, { cp: f([[4, -8], [44, -8], [82, -8]]), w: 2.4 }] }), t);
  }
  g.restore(); g.translate(0, 40);
  drawPart(g, P(`f${back}torso`, { cp: sym([[0, -552], [40, -548], [82, -522], [100, -478], [102, -400], [96, -320], [90, -278], [0, -278]]), a0: PI / 2, sp: 7, R: 50,
    feats: back ? [{ cp: [[-40, -530], [0, -400], [34, -300]], w: 5, black: true }, { cp: [[40, -530], [0, -400], [-34, -300]], w: 5, black: true }, { cp: [[-36, -530], [4, -400], [38, -300]], w: 2 }, { cp: [[36, -530], [-4, -400], [-38, -300]], w: 2 }, { cp: [[-30, -300], [0, -296], [30, -300]], w: 3 }] : [] }), t);
  if (!back) drawPart(g, P('fapron', { cp: sym([[0, -502], [40, -500], [50, -420], [58, -300], [62, -168], [0, -164]]), dir: PI / 2, sp: 7, R: 34,
    feats: [{ cp: [[-58, -300], [0, -296], [58, -300]], w: 6, black: true }, { cp: [[-58, -290], [0, -287], [58, -290]], w: 2.4 }, { cp: [[-36, -500], [-30, -548]], w: 3 }, { cp: [[36, -500], [30, -548]], w: 3 }, { cp: [[22, -470], [26, -330], [30, -180]], w: 2 }] }), t);
  for (const s of [1, -1]) {
    const f = s < 0 ? mir : x => x;
    drawPart(g, P(`f${back}UA${s}`, { cp: f(FUA), a0: PI / 2, sp: 6, k: s > 0 ? 1 : .75 }), t);
    drawPart(g, P(`f${back}FA${s}`, { cp: f(FFA), a0: PI / 2, sp: 6, k: s > 0 ? 1 : .75, feats: [{ cp: f([[84, -398], [98, -406], [112, -400]]), w: 4.5 }] }), t);
    drawPart(g, P(`f${back}HA${s}`, { cp: f(FHA), sp: 4, white: true, outline: 2.8, lo: .5, k: s > 0 ? 1.05 : .8, feats: back ? [{ cp: f([[96, -290], [110, -284]]), w: 2 }] : [{ cp: f([[96, -262], [98, -238]]), w: 2.2 }, { cp: f([[106, -264], [108, -238]]), w: 2.2 }, { cp: f([[115, -266], [116, -242]]), w: 2 }] }), t);
  }
  // head
  drawPart(g, P(`f${back}head`, { cp: sym([[0, -652], [28, -646], [44, -626], [49, -600], [47, -574], [40, -554], [26, -540], [0, -536]]), sp: 4, R: 26, res: 1, halo: 4, white: !back, outline: back ? 0 : 3, amb: back ? 0 : .2, k: 1, lo: .5, dir: 'contour',
    feats: back ? [] : [
      { cp: [[-36, -603], [-24, -608], [-11, -603]], w: 5 }, { cp: [[11, -603], [24, -608], [36, -603]], w: 5 },
      { cp: [[-26, -592], [-19, -591]], w: 4 }, { cp: [[19, -591], [26, -592]], w: 4 },
      { cp: [[-22, -630], [0, -634], [22, -630]], w: 2 }, { cp: [[-24, -620], [0, -623], [24, -620]], w: 2 },
      { cp: [[-6, -598], [-9, -574], [-3, -566], [4, -566], [9, -572]], w: 2.4 } ] }), t);
  for (const s of [1, -1]) { const f = s < 0 ? mir : x => x; drawPart(g, P(`f${back}ear${s}`, { cp: f([[46, -598], [58, -600], [60, -578], [48, -566]]), white: true, outline: 2.6, sp: 3, R: 8, k: s > 0 ? 1.1 : .8, lo: .6 }), t); }
  if (!back) drawPart(g, P('fbeard', { cp: sym([[0, -566], [22, -572], [42, -566], [48, -540], [44, -498], [34, -450], [18, -414], [0, -402]]), white: true, outline: 3, halo: 0, dir: PI / 2, sp: 6, lo: .2, seg: [30, 110], gap: [5, 18],
    tone: () => (x, y) => .3 + .8 * Math.min(1, Math.max(0, (x + 46) / 92)) + .15 * Math.sin(x * .5) }), t);
  else for (const s of [1, -1]) { const f = s < 0 ? mir : x => x; drawPart(g, P(`fbbeard${s}`, { cp: f([[40, -560], [50, -540], [46, -500], [36, -470], [34, -520]]), white: true, outline: 2.5, halo: 0, dir: PI / 2, sp: 5, tone: () => () => .6 }), t); }
}
export function drawFounderFront(g, M, t = 1e9) { put(g, M, () => founderSide(g, '', t)); }
export function drawFounderBack(g, M, t = 1e9) { put(g, M, () => founderSide(g, 'b', t)); }

// ---------------------------------------------------------------- apprentice
const BL = [[4, -130], [26, -130], [26, -32], [36, -14], [38, 0], [2, 0], [4, -32]];
const BUA = [[44, -332], [64, -322], [70, -270], [66, -236], [50, -236], [46, -280]];
const BFA = [[50, -246], [68, -246], [76, -196], [74, -182], [54, -180], [50, -200]];
const BHA = [[54, -186], [74, -186], [76, -168], [66, -160], [56, -166]];
function boyView(g, back, t) {
  for (const s of [1, -1]) { const f = s < 0 ? mir : x => x; drawPart(g, P(`b${back}L${s}`, { cp: f(BL), a0: PI / 2, sp: 5, k: s > 0 ? 1 : .7 }), t); }
  if (back) drawPart(g, P('bbtail', { cp: [[-14, -344], [8, -340], [12, -250], [4, -236], [-10, -238], [-16, -300]], dir: PI / 2, sp: 4.5, R: 12, feats: [{ cp: [[-8, -240], [-9, -228]], w: 2.5 }, { cp: [[0, -240], [0, -228]], w: 2.5 }, { cp: [[7, -240], [8, -228]], w: 2.5 }] }), t);
  drawPart(g, P(`b${back}coat`, { cp: sym([[0, -346], [26, -344], [48, -326], [58, -290], [64, -220], [72, -130], [74, -110], [0, -110]]), a0: PI / 2, sp: 6, R: 40,
    feats: back ? [{ cp: [[0, -330], [0, -220], [0, -114]], w: 2.2 }, { cp: [[-72, -122], [0, -118], [72, -122]], w: 3 }] : [{ cp: [[2, -330], [2, -220], [2, -114]], w: 2.4 }, { cp: [[-72, -122], [0, -118], [72, -122]], w: 3 }, ...[-300, -250, -200, -150].map(y => ({ cp: [[10, y], [15, y]], w: 5 }))] }), t);
  drawPart(g, P(`b${back}wrap`, { cp: sym([[0, -360], [36, -358], [42, -336], [0, -330]]), dir: .1, sp: 4, R: 8 }), t);
  if (!back) {
    drawPart(g, P('bftail', { cp: [[-24, -342], [-8, -338], [-12, -262], [-28, -258]], dir: PI / 2, sp: 4, R: 8, feats: [{ cp: [[-26, -262], [-27, -250]], w: 2.4 }, { cp: [[-19, -262], [-19, -250]], w: 2.4 }, { cp: [[-12, -262], [-11, -250]], w: 2.4 }] }), t);
    // compass on the chest
    WC.drawStrokes(g, WC.cutAlong([[10, -334], [14, -300], [20, -284]], { w: 2, kind: 'k', seed: 2 }), { t });
    const cx = 20, cy = -270, r = 13;
    WC.drawStrokes(g, WC.cutAlong(WC.offsetPoly(WC.ellipse(cx, cy, r, r, 24), 2.5), { closed: true, w: 4, seg: [300, 600], seed: 3 }), { t });
    WC.fillPoly(g, [WC.ellipse(cx, cy, r, r, 24)], '#000'); WC.fillPoly(g, [WC.ellipse(cx, cy, r * .72, r * .72, 24)], '#fff');
    WC.fillPoly(g, [[[cx + 5, cy - 7], [cx + 1.5, cy + 1], [cx - 5, cy + 7], [cx - 1.5, cy - 1]]], '#000');
  }
  for (const s of [1, -1]) {
    const f = s < 0 ? mir : x => x;
    drawPart(g, P(`b${back}UA${s}`, { cp: f(BUA), a0: PI / 2, sp: 5, k: s > 0 ? 1 : .75 }), t);
    drawPart(g, P(`b${back}FA${s}`, { cp: f(BFA), a0: PI / 2, sp: 5, k: s > 0 ? 1 : .75, feats: [{ cp: f([[52, -198], [74, -196]]), w: 3 }] }), t);
    drawPart(g, P(`b${back}HA${s}`, { cp: f(BHA), sp: 3.5, white: true, outline: 2.4, lo: .5, k: s > 0 ? 1.05 : .8 }), t);
  }
  drawPart(g, P(`b${back}head`, { cp: sym([[0, -442], [30, -436], [44, -416], [47, -390], [41, -366], [27, -350], [0, -344]]), sp: 4, R: 26, res: 1, halo: 4, white: !back, outline: back ? 0 : 3, amb: .25, k: 1, lo: .5, dir: 'contour',
    feats: back ? [{ cp: [[-30, -400], [-20, -380]], w: 2.5 }, { cp: [[-10, -404], [-6, -382]], w: 2.5 }, { cp: [[12, -404], [8, -382]], w: 2.5 }, { cp: [[30, -400], [22, -380]], w: 2.5 }] : [{ cp: [[-25, -401], [-18, -403], [-10, -400]], w: 3.2 }, { cp: [[10, -400], [18, -403], [25, -401]], w: 3.2 }, { cp: [[-20, -390], [-15, -390]], w: 4.6 }, { cp: [[15, -390], [20, -390]], w: 4.6 },
      { cp: [[1, -383], [3, -373], [-1, -371]], w: 2 }, { cp: [[-6, -359], [0, -357], [6, -359]], w: 2.2 }] }), t);
  for (const s of [1, -1]) { const f = s < 0 ? mir : x => x; drawPart(g, P(`b${back}ear${s}`, { cp: f([[44, -394], [54, -396], [54, -376], [44, -372]]), white: !back, outline: back ? 0 : 2.4, sp: 3, R: 7, k: s > 0 ? 1.1 : .8, lo: .6 }), t); }
  drawPart(g, P(`b${back}cap`, { cp: sym([[0, -458], [30, -452], [48, -426], [50, -410], [0, -412]]), dir: PI / 2, sp: 4.5, R: 18, feats: [-36, -24, -12, 0, 12, 24, 36].map(x => ({ cp: [[x, -414], [x * .8, -446 + Math.abs(x) * .3]], w: 2.2 })) }), t);
  drawPart(g, P(`b${back}brim`, { cp: sym([[0, -414], [50, -412], [52, -396], [0, -398]]), white: true, outline: 2.4, halo: 3, tone: () => () => 1, feats: [-44, -33, -22, -11, 0, 11, 22, 33, 44].map(x => ({ cp: [[x, -412], [x, -398]], w: 1.8 })) }), t);
  drawPart(g, P(`b${back}pom`, { poly: WC.ellipse(0, -464, 14, 13, 20), white: true, outline: 2.4, halo: 3, sp: 3, R: 10, feats: [[-6, -468], [3, -470], [6, -460], [-4, -458], [0, -464]].map(([x, y]) => ({ cp: [[x, y], [x + 2, y + 2]], w: 2.4 })) }), t);
}
export function drawBoyFront(g, M, t = 1e9) { put(g, M, () => boyView(g, '', t)); }
export function drawBoyBack(g, M, t = 1e9) { put(g, M, () => boyView(g, 'b', t)); }
