// The Bell Founder · characters (profile views, rigged) — the Founder and the Apprentice
// Local space: feet at (0,0), y up is negative, facing +x. Founder ≈ 650 tall, Apprentice ≈ 450.
import * as WC from './engine/index.js';
import { part, drawPart, mul, T, R, S, about, put, ap } from './rig.js';

export const LKEY = WC.light(.85, -.38, .2);            // key light from upper right (in front of the face)
const PI = Math.PI;
const NULLG = (() => { const c = document.createElement('canvas'); c.width = c.height = 2; return c.getContext('2d'); })();

// ================================================================ FOUNDER
const F = {
  farThigh: { cp: [[-44, -282], [32, -282], [36, -210], [32, -146], [-20, -142], [-28, -212]], a0: PI / 2, k: .7, sp: 7 },
  farShin: { cp: [[-20, -160], [32, -160], [34, -100], [30, -52], [76, -32], [82, 0], [-24, 0], [-20, -52], [-16, -100]], a0: PI / 2, k: .7, sp: 7, feats: [{ cp: [[-22, -8], [30, -8], [80, -8]], w: 2.4 }] },
  farUpper: { cp: [[-4, -530], [38, -524], [44, -466], [40, -404], [20, -388], [0, -398], [-8, -464]], a0: PI / 2, k: .7 },
  farFore: { cp: [[0, -408], [42, -410], [68, -356], [86, -310], [68, -294], [48, -322], [8, -374]], k: .7 },
  farHand: { cp: [[62, -310], [94, -316], [116, -296], [122, -266], [110, -242], [92, -240], [76, -256], [60, -286]], white: true, outline: 2.8, sp: 4, R: 16, amb: 0, k: .9, lo: .5, dir: 'contour' },
  torso: { cp: [[40, -558], [4, -548], [-28, -520], [-46, -470], [-52, -400], [-48, -330], [-40, -280], [64, -280], [82, -330], [88, -410], [84, -478], [62, -530]], a0: PI / 2, R: 44, sp: 7,
    feats: [{ cp: [[-26, -500], [-40, -430], [-42, -350]], w: 3.5, seg: [50, 120] }, { cp: [[-6, -520], [-18, -460], [-22, -400]], w: 2.5 }] },
  apron: { cp: [[48, -500], [90, -488], [96, -420], [100, -330], [104, -230], [104, -162], [40, -156], [34, -230], [38, -330], [44, -420]], dir: PI / 2 + .05, R: 30, sp: 7,
    feats: [{ cp: [[36, -300], [70, -297], [101, -300]], w: 6, black: true }, { cp: [[36, -290], [70, -287], [101, -290]], w: 2.5 }, { cp: [[62, -480], [66, -380], [68, -250], [66, -170]], w: 2.2, seg: [60, 160] }, { cp: [[50, -498], [44, -526], [42, -552]], w: 3 }] },
  nearThigh: { cp: [[-18, -282], [58, -282], [62, -210], [58, -146], [6, -142], [-2, -212]], a0: PI / 2, sp: 7, feats: [{ cp: [[50, -250], [56, -180]], w: 2.4 }] },
  nearShin: { cp: [[6, -160], [58, -160], [60, -100], [56, -52], [102, -32], [108, 0], [2, 0], [6, -52], [10, -100]], a0: PI / 2, sp: 7,
    feats: [{ cp: [[6, -54], [32, -56], [56, -54]], w: 3.2 }, { cp: [[4, -8], [60, -8], [106, -8]], w: 2.6 }] },
  nearThumb: { cp: [[98, -304], [114, -301], [128, -287], [126, -275], [112, -282], [100, -290]], white: true, outline: 2.6, sp: 3, R: 8, amb: .1, lo: .5, halo: 2, light: WC.light(.9, -.35, .5) },
  farThumb: { cp: [[90, -304], [106, -301], [120, -287], [118, -275], [104, -282], [92, -290]], white: true, outline: 2.4, sp: 3, R: 8, amb: 0, k: .9, lo: .5, halo: 2 },
  head: { cp: [[36, -598], [44, -630], [70, -648], [100, -640], [116, -618], [119, -601], [112, -593], [115, -586], [123, -577], [127, -568], [123, -560], [114, -559], [104, -545], [74, -538], [52, -548], [40, -570]], white: true, outline: 3.2, halo: 4, sp: 4, R: 26, res: 1, light: WC.light(.9, -.35, .5), amb: .15, k: 1, lo: .45, dir: 'contour',
    feats: [
      { cp: [[90, -606], [103, -610], [116, -604]], w: 5.5 },               // bushy brow
      { dot: [104, -593, 3.6, 2.6] },                                        // eye
      { cp: [[80, -628], [95, -632], [108, -626]], w: 2 }, { cp: [[82, -619], [97, -622], [110, -617]], w: 2 },   // furrows
      { cp: [[62, -592], [53, -584], [53, -570], [61, -563]], w: 3.2 },     // ear
      { cp: [[113, -567], [118, -562], [122, -562]], w: 2.6 },              // nostril wing
      { cp: [[106, -580], [100, -568], [98, -557]], w: 2 },                 // cheek crease
      { cp: [[95, -590], [88, -588]], w: 1.5 }, { cp: [[95, -586], [89, -581]], w: 1.5 },   // crow's feet
    ] },
  beard: { cp: [[60, -592], [70, -580], [80, -568], [94, -565], [108, -562], [118, -560], [128, -552], [124, -545], [124, -520], [120, -490], [112, -458], [100, -430], [86, -408], [78, -428], [70, -465], [62, -505], [56, -545], [57, -575]],
    white: true, outline: 3, sp: 6, lo: .2, hi: 1, dir: PI / 2 + .1, seg: [30, 120], gap: [5, 18], halo: 0,
    tone: () => (x, y) => .25 + .9 * Math.min(1, Math.max(0, (x - 60) / 60)) + .15 * Math.sin(x * .45 + y * .01) },
  nearUpper: { cp: [[4, -530], [46, -524], [52, -466], [48, -404], [28, -388], [8, -398], [0, -464]], a0: PI / 2, R: 22 },
  nearFore: { cp: [[8, -408], [50, -410], [76, -356], [94, -310], [76, -294], [56, -322], [16, -374]], R: 20,
    feats: [{ cp: [[10, -402], [30, -412], [50, -406]], w: 4.5 }, { cp: [[40, -376], [58, -344], [70, -318]], w: 1.8 }] },
  nearHand: { cp: [[70, -310], [102, -316], [124, -296], [130, -266], [118, -242], [100, -240], [84, -256], [68, -286]], white: true, outline: 3, sp: 4, R: 16, amb: .1, k: 1, lo: .5, light: WC.light(.9, -.35, .5), dir: 'contour',
    feats: [{ cp: [[102, -292], [116, -280], [121, -264]], w: 2 }, { cp: [[93, -281], [107, -268], [111, -252]], w: 2 }, { cp: [[85, -270], [97, -258], [100, -246]], w: 1.8 }] },
};
const FJ = { sh: [24, -510], el: [28, -398], wr: [84, -300], shF: [18, -512], elF: [20, -398], wrF: [76, -300], neck: [52, -548], hip: [20, -272], knee: [32, -148], hipF: [-6, -272], kneeF: [6, -148] };
export const FOUNDER_POSE = {
  stand: { a1: .06, a2: -.08, a3: 0, f1: .12, f2: -.14, f3: 0, lean: .14, head: .05, q1: -.08, k1: .14, q2: 0.06, k2: 0.1 },
  hammerUp: { a1: -2.95, a2: -.5, a3: .45, f1: -2.7, f2: -.55, f3: .45, lean: -.28, head: -.15, q1: -.45, k1: .5, q2: 0.22, k2: 0.15, tool: 'hammer' },
  hammerDown: { a1: -.95, a2: 0, a3: .9, f1: -.8, f2: -.05, f3: .9, lean: .55, head: .3, q1: -.6, k1: .8, q2: 0.22, k2: 0.18, tool: 'hammer' },
  hammerRest: { a1: .25, a2: -.1, a3: 1.5, f1: .3, f2: -.1, f3: 0, lean: .3, head: .35, q1: -.15, k1: .3, q2: 0.1, k2: 0.18, tool: 'hammer' },
  pour: { a1: -1.05, a2: -.75, a3: .25, f1: -1.2, f2: -.6, f3: .2, lean: .28, head: .1, q1: -.4, k1: .6, q2: 0.22, k2: 0.18, tool: 'tongs' },
  lift: { a1: -1.35, a2: -.9, a3: .45, f1: -1.45, f2: -.8, f3: .4, lean: -.08, head: 0, q1: -.3, k1: .45, q2: 0.22, k2: 0.18, tool: 'tongs' },
  tend: { a1: -.7, a2: -1.1, a3: .1, f1: -.5, f2: -1.2, f3: 0, lean: .35, head: .15, q1: -.3, k1: .5, q2: 0.15, k2: 0.18 },
  ropeUp: { a1: -3.0, a2: -.05, a3: 0, f1: -2.85, f2: -.1, f3: 0, lean: -.05, head: -.3, q1: -.1, k1: .15, q2: 0.1, k2: 0.1 },
  ropeDown: { a1: -1.9, a2: -.3, a3: 0, f1: -1.8, f2: -.3, f3: 0, lean: .4, head: .15, q1: -.45, k1: .75, q2: 0.2, k2: 0.18 },
  lookUp: { a1: .1, a2: -.1, a3: 0, f1: .15, f2: -.1, f3: 0, lean: -.05, head: -.38, q1: -.05, k1: .1, q2: 0.05, k2: 0.08 },
  nod: { a1: .08, a2: -.2, a3: 0, f1: .12, f2: -.2, f3: 0, lean: .2, head: .3, q1: -.08, k1: .15, q2: 0.06, k2: 0.1 },
  walkA: { a1: .35, a2: -.25, f1: -.3, f2: -.2, lean: .2, head: .08, q1: -.4, k1: .25, q2: 0.22, k2: 0.18 },
  walkB: { a1: -.25, a2: -.3, f1: .3, f2: -.15, lean: .2, head: .08, q1: .25, k1: .4, q2: -0.35, k2: 0.18 },
  grief: { a1: .25, a2: -.02, a3: .1, f1: .3, f2: -.05, f3: 0, lean: .38, head: .45, q1: -.1, k1: .3, q2: 0.05, k2: 0.18 },
};
const fp = (n, x = '') => part('F.' + n + x, { light: LKEY, seed: n.length * 7 + n.charCodeAt(0), ...F[n], ...(x ? EXPR_F[x.slice(1)]?.(F[n]) : {}) });

export function drawFounder(g, M, pose = FOUNDER_POSE.stand, t = 1e9, o = {}) {
  if (o.measure) g = NULLG;
  const P = { ...FOUNDER_POSE.stand, ...pose };
  const LS = S(1.04, .86);
  const legs = (q, k, hip, knee) => { const th = mul(LS, about(...hip, q || 0)), sh = mul(th, about(...knee, k || 0)); return [th, sh]; };
  const [nT, nS] = legs(P.q1, P.k1, FJ.hip, FJ.knee), [fT, fS] = legs(P.q2, P.k2, FJ.hipF, FJ.kneeF);
  const dy = Math.max(ap(nS, 104, 0)[1], ap(nS, 4, 0)[1], ap(fS, 78, 0)[1], ap(fS, -22, 0)[1]);
  M = mul(M, T(0, -dy));
  const ML = M; M = mul(M, T(0, 40));
  const root = mul(M, about(10, -280, P.lean));
  const up = mul(root, about(...FJ.shF, P.f1)), fo = mul(up, about(...FJ.elF, P.f2)), ha = mul(fo, about(...FJ.wrF, P.f3));
  put(g, up, () => drawPart(g, fp('farUpper'), t));
  put(g, fo, () => drawPart(g, fp('farFore'), t));
  put(g, ha, () => { drawPart(g, fp('farHand'), t); drawPart(g, fp('farThumb'), t); });
  put(g, mul(ML, fT), () => drawPart(g, fp('farThigh'), t)); put(g, mul(ML, fS), () => drawPart(g, fp('farShin'), t));
  put(g, root, () => { drawPart(g, fp('torso'), t); drawPart(g, fp('apron'), t); });
  put(g, mul(ML, nS), () => drawPart(g, fp('nearShin'), t)); put(g, mul(ML, nT), () => drawPart(g, fp('nearThigh'), t));
  const hd = mul(root, about(...FJ.neck, P.head));
  const ex = P.expr ? '.' + P.expr : '';
  put(g, hd, () => { drawPart(g, fp('head', ex), t); drawPart(g, fp('beard'), t); });
  const nu = mul(root, about(...FJ.sh, P.a1)), nf = mul(nu, about(...FJ.el, P.a2)), nh = mul(nf, about(...FJ.wr, P.a3));
  const tool = o.tool ?? P.tool;
  if (tool === 'hammer') put(g, nh, () => drawTool(g, 'hammer', t));
  put(g, nu, () => drawPart(g, fp('nearUpper'), t));
  put(g, nf, () => drawPart(g, fp('nearFore'), t));
  put(g, nh, () => { drawPart(g, fp('nearHand'), t); drawPart(g, fp('nearThumb'), t); });
  if (tool === 'tongs') put(g, nh, () => drawTool(g, 'tongs', t));
  return { hand: nh, farHand: ha, head: hd, root, grip: ap(nh, 104, -276), tip: ap(nh, ...TONGS_TIP), hammerHead: ap(nh, 242, -276), M };
}

// ---------------------------------------------------------------- tools (in hand space; grip ≈ (104,-276))
const TOOLS = {
  hammer: { handle: { cp: [[100, -267], [100, -285], [236, -283], [236, -269]], dir: 0, sp: 4, R: 6 },
            head: { cp: [[222, -318], [262, -318], [262, -234], [222, -234]], dir: PI / 2, sp: 4, R: 14 } },
  tongs: { a: { cp: [[96, -286], [114, -280], [48, -30], [30, -36]], dir: 1.85, sp: 4, R: 6 },
           b: { cp: [[112, -276], [128, -268], [66, -24], [48, -30]], dir: 1.85, sp: 4, R: 6 } },
};
export const TONGS_TIP = [44, -20];
function drawTool(g, name, t) {
  const D = TOOLS[name];
  for (const k of Object.keys(D)) drawPart(g, part('tool.' + name + k, { light: LKEY, poly: D[k].cp.length === 4 ? D[k].cp : null, ...D[k], halo: 3 }), t);
}

// ================================================================ APPRENTICE
const B = {
  farThigh: { cp: [[-12, -132], [18, -132], [18, -66], [-10, -66]], a0: PI / 2, k: .7, sp: 5 },
  farShin: { cp: [[-11, -76], [17, -76], [16, -32], [40, -14], [42, 0], [-14, 0], [-12, -32]], a0: PI / 2, k: .7, sp: 5 },
  farUpper: { cp: [[12, -330], [38, -328], [40, -280], [36, -236], [18, -232], [10, -280]], k: .7, sp: 5 },
  farFore: { cp: [[16, -246], [38, -248], [58, -200], [64, -186], [50, -178], [34, -206], [16, -232]], k: .7, sp: 5 },
  farHand: { cp: [[52, -188], [66, -192], [74, -178], [70, -166], [56, -164], [50, -176]], white: true, outline: 2.4, sp: 3.5, R: 8, amb: 0, k: .9, lo: .5 },
  scarfTail: { cp: [[6, -340], [-14, -332], [-34, -304], [-46, -256], [-44, -232], [-32, -240], [-22, -290], [-2, -320]], dir: PI / 2 + .3, sp: 5, R: 14,
    feats: [{ cp: [[-44, -236], [-48, -222]], w: 2.5 }, { cp: [[-38, -234], [-40, -220]], w: 2.5 }, { cp: [[-30, -240], [-30, -228]], w: 2.5 }] },
  nearThigh: { cp: [[2, -132], [32, -132], [32, -66], [4, -66]], a0: PI / 2, sp: 5 },
  nearShin: { cp: [[3, -76], [31, -76], [30, -32], [56, -14], [58, 0], [2, 0], [4, -32]], a0: PI / 2, sp: 5, feats: [{ cp: [[3, -6], [30, -6], [56, -6]], w: 2 }] },
  nearThumb: { cp: [[68, -191], [76, -191], [85, -183], [81, -178], [72, -183]], white: true, outline: 2.2, sp: 3, R: 6, amb: .15, lo: .5, halo: 2, light: WC.light(.9, -.35, .5) },
  openHand: { cp: [[60, -188], [72, -194], [90, -196], [96, -190], [84, -186], [98, -184], [98, -178], [84, -178], [94, -172], [90, -166], [70, -166], [58, -176]], white: true, outline: 2.2, sp: 3, R: 6, amb: .15, lo: .5, halo: 3, light: WC.light(.9, -.35, .5) },
  coat: { cp: [[20, -342], [-4, -336], [-24, -302], [-34, -222], [-42, -130], [-40, -110], [66, -110], [70, -130], [64, -222], [58, -298], [44, -336]], a0: PI / 2 + .1, sp: 6, R: 36,
    feats: [{ cp: [[56, -300], [60, -220], [64, -120]], w: 2.4 }, { cp: [[-40, -122], [10, -118], [66, -122]], w: 3 }, { cp: [[0, -300], [-8, -220], [-14, -130]], w: 2.2, seg: [50, 120] }, { cp: [[24, -300], [22, -210], [22, -124]], w: 1.8 }] },
  wrap: { cp: [[-2, -352], [50, -354], [54, -334], [2, -326]], dir: .2, sp: 4, R: 8 },
  head: { cp: [[6, -380], [14, -416], [42, -432], [70, -422], [82, -402], [84, -390], [90, -381], [86, -373], [82, -367], [83, -359], [76, -350], [60, -342], [36, -344], [16, -358]], white: true, outline: 3, halo: 4, sp: 4, R: 26, res: 1, light: WC.light(.9, -.35, .5), amb: .2, k: 1, lo: .5, dir: 'contour',
    feats: [
      { cp: [[65, -401], [73, -404], [81, -400]], w: 3.6 },        // brow
      { dot: [75, -390.5, 4.2, 3.4] },                               // eye
      { cp: [[38, -384], [33, -377], [35, -369], [40, -368]], w: 2.4 },  // ear
      { cp: [[76, -359], [81, -358]], w: 2.2 },                    // mouth
      { cp: [[84, -373], [86.5, -371]], w: 2 },                    // nostril
      { cp: [[18, -394], [13, -380]], w: 3 }, { cp: [[26, -396], [22, -384]], w: 2.4 },  // hair under the cap
    ] },
  cap: { cp: [[2, -386], [8, -420], [36, -444], [70, -438], [88, -414], [86, -402], [60, -406], [30, -404], [8, -396]], dir: PI / 2 + .35, sp: 4.5, R: 16,
    feats: [[14, -404, 22, -426], [26, -406, 34, -436], [40, -406, 46, -440], [54, -406, 58, -438], [68, -406, 70, -432], [80, -406, 80, -420]].map(([a, b, c, d]) => ({ cp: [[a, b], [c, d]], w: 2.2 })) },
  brim: { cp: [[4, -384], [8, -404], [48, -410], [88, -412], [90, -400], [50, -398]], white: true, outline: 2.4, halo: 3, sp: 3, tone: () => () => 1,
    feats: [16, 26, 36, 46, 56, 66, 76, 84].map(x => ({ cp: [[x, -386 - (x - 4) * .16], [x + 1, -404 - (x - 8) * .1]], w: 1.8 })) },
  pom: { poly: WC.ellipse(22, -450, 13, 12, 20), white: true, outline: 2.4, sp: 3, R: 10, dir: .8, halo: 3,
    feats: [[16, -454], [24, -446], [28, -456], [18, -444], [22, -458], [30, -448]].map(([x, y]) => ({ cp: [[x, y], [x + 2, y + 2]], w: 2.4 })) },
  nearUpper: { cp: [[18, -332], [46, -330], [48, -280], [44, -234], [24, -230], [16, -280]], sp: 5, R: 16 },
  nearFore: { cp: [[22, -246], [46, -248], [66, -200], [72, -186], [58, -178], [42, -206], [22, -232]], sp: 5, R: 14,
    feats: [{ cp: [[56, -196], [66, -188]], w: 3 }] },
  nearHand: { cp: [[60, -188], [74, -192], [82, -178], [78, -166], [64, -164], [58, -176]], white: true, outline: 2.4, sp: 3.5, R: 8, amb: .15, k: 1, lo: .5, light: WC.light(.9, -.35, .5) },
};
const BJ = { sh: [32, -322], el: [34, -240], wr: [66, -184], shF: [26, -324], elF: [26, -240], wrF: [58, -184], neck: [40, -346], hip: [17, -126], knee: [18, -70], hipF: [3, -126], kneeF: [4, -70] };
export const BOY_POSE = {
  stand: { a1: .08, a2: -.1, a3: 0, f1: .12, f2: -.15, f3: 0, lean: .03, head: 0 },
  bellowsUp: { a1: -1.3, a2: -.4, a3: .3, f1: -1.35, f2: -.35, f3: .3, lean: .1, head: .05, q1: -.2, k1: .3, q2: .1, k2: .15 },
  bellowsDown: { a1: -.5, a2: -.1, a3: .2, f1: -.6, f2: -.1, f3: .2, lean: .5, head: .25, q1: -.55, k1: .9, q2: .3, k2: .4 },
  clutch: { a1: -.25, a2: -2.3, a3: -.4, f1: .1, f2: -.2, f3: 0, lean: .12, head: .2, compass: 1 },
  throwWind: { a1: 1.1, a2: -1.0, a3: .2, f1: -.3, f2: -.3, f3: 0, lean: -.25, head: -.05, q1: -.3, k1: .2, q2: .3, k2: .3, compass: 1 },
  throwOut: { a1: -1.55, a2: -.05, a3: .4, f1: .4, f2: -.2, f3: 0, lean: .45, head: .25, q1: -.6, k1: .8, q2: .45, k2: .2, hand: 'open', compass: 1 },
  lookUp: { a1: .1, a2: -.15, a3: 0, f1: .15, f2: -.15, f3: 0, lean: -.2, head: -.5, q1: -.1, k1: .1 },
  shield: { a1: -1.7, a2: -1.1, a3: .2, f1: .2, f2: -.3, f3: 0, lean: -.18, head: -.2, q1: -.35, k1: .3, q2: .3, k2: .1 },
  walkA: { a1: .4, a2: -.3, f1: -.35, f2: -.2, lean: .1, head: .05, q1: -.45, k1: .3, q2: .35, k2: .4 },
  walkB: { a1: -.3, a2: -.3, f1: .35, f2: -.2, lean: .1, head: .05, q1: .3, k1: .45, q2: -.4, k2: .25 },
  ropeUp: { a1: -2.9, a2: -.1, a3: 0, f1: -2.8, f2: -.15, f3: 0, lean: .02, head: -.35 },
  ropeDown: { a1: -1.8, a2: -.35, a3: 0, f1: -1.7, f2: -.35, f3: 0, lean: .35, head: .1, q1: -.4, k1: .7, q2: .2, k2: .4 },
};
const bp = (n, x = '') => part('B.' + n + x, { light: LKEY, seed: n.length * 11 + n.charCodeAt(0), ...B[n], ...(x ? EXPR_B[x.slice(1)]?.(B[n]) : {}) });

export function drawBoy(g, M, pose = BOY_POSE.stand, t = 1e9, o = {}) {
  if (o.measure) g = NULLG;
  const P = { ...BOY_POSE.stand, ...pose };
  const legs = (q, k, hip, knee) => { const th = about(...hip, q || 0), sh = mul(th, about(...knee, k || 0)); return [th, sh]; };
  const [nT, nS] = legs(P.q1, P.k1, BJ.hip, BJ.knee), [fT, fS] = legs(P.q2, P.k2, BJ.hipF, BJ.kneeF);
  const dy = Math.max(ap(nS, 56, 0)[1], ap(nS, 2, 0)[1], ap(fS, 40, 0)[1], ap(fS, -14, 0)[1]);
  M = mul(M, T(0, -dy));
  const root = mul(M, about(12, -120, P.lean));
  const up = mul(root, about(...BJ.shF, P.f1)), fo = mul(up, about(...BJ.elF, P.f2)), ha = mul(fo, about(...BJ.wrF, P.f3));
  put(g, up, () => drawPart(g, bp('farUpper'), t)); put(g, fo, () => drawPart(g, bp('farFore'), t)); put(g, ha, () => drawPart(g, bp('farHand'), t));
  put(g, mul(M, fT), () => drawPart(g, bp('farThigh'), t)); put(g, mul(M, fS), () => drawPart(g, bp('farShin'), t));
  put(g, root, () => drawPart(g, bp('scarfTail'), t));
  put(g, mul(M, nS), () => drawPart(g, bp('nearShin'), t)); put(g, mul(M, nT), () => drawPart(g, bp('nearThigh'), t));
  put(g, root, () => { drawPart(g, bp('coat'), t); if (o.compass !== false) drawCompassOnChest(g, t, P.compass ? 0 : 1); drawPart(g, bp('wrap'), t); });
  const hd = mul(root, about(...BJ.neck, P.head));
  const ex = P.expr ? '.' + P.expr : '';
  put(g, hd, () => { drawPart(g, bp('head', ex), t); drawPart(g, bp('cap'), t); drawPart(g, bp('brim'), t); drawPart(g, bp('pom'), t); });
  const nu = mul(root, about(...BJ.sh, P.a1)), nf = mul(nu, about(...BJ.el, P.a2)), nh = mul(nf, about(...BJ.wr, P.a3));
  put(g, nu, () => drawPart(g, bp('nearUpper'), t)); put(g, nf, () => drawPart(g, bp('nearFore'), t)); put(g, nh, () => { if (P.hand === 'open') drawPart(g, bp('openHand'), t); else { drawPart(g, bp('nearHand'), t); drawPart(g, bp('nearThumb'), t); } });
  return { hand: nh, head: hd, root, palm: ap(nh, 70, -178), M };
}
// the brass compass on its cord (visible = 1 hanging on the chest)
export function compassPoly(cx, cy, r) { return WC.ellipse(cx, cy, r, r, 28); }
function drawCompassOnChest(g, t, vis) {
  if (!vis) return;
  const c = WC.cutAlong([[46, -338], [50, -300], [60, -276]], { w: 2.2, kind: 'k', seed: 4 }); WC.drawStrokes(g, c, { t });
  drawCompass(g, 62, -262, 13, t);
}
export function drawCompass(g, cx, cy, r, t = 1e9, needle = -.5, open = 1) {
  WC.drawStrokes(g, WC.cutAlong(WC.offsetPoly(compassPoly(cx, cy, r), r * .2), { closed: true, w: r * .3, kind: 'v', seg: [400, 800], gap: [0, 1], seed: 5 }), { t });
  WC.fillPoly(g, [compassPoly(cx, cy, r)], '#000');
  if (open > 0) {
    WC.fillPoly(g, [compassPoly(cx, cy, r * .74)], '#fff');
    // needle: black diamond + tick marks
    const a = needle, ca = Math.cos(a), sa = Math.sin(a), L = r * .62, w = r * .14;
    WC.fillPoly(g, [[[cx + ca * L, cy + sa * L], [cx - sa * w, cy + ca * w], [cx - ca * L, cy - sa * L], [cx + sa * w, cy - ca * w]]], '#000');
    for (let i = 0; i < 8; i++) { const b = i / 8 * PI * 2; g.fillStyle = '#000'; g.fillRect(cx + Math.cos(b) * r * .64 - r * .04, cy + Math.sin(b) * r * .64 - r * .04, r * .08, r * .08); }
  } else {
    WC.drawStrokes(g, WC.cutAlong(WC.ellipse(cx, cy, r * .6, r * .6, 20), { closed: true, w: r * .1, kind: 'k', seed: 7 }), { t });
  }
  // bow (ring on top)
  WC.drawStrokes(g, WC.cutAlong(WC.ellipse(cx, cy - r * 1.15, r * .22, r * .2, 12), { closed: true, w: r * .1, kind: 'k', seed: 9 }), { t });
}

// ---------------------------------------------------------------- expressions (swap the carved face cuts)
const fF = F.head.feats, fB = B.head.feats;
const EXPR_F = {
  focus: d => ({ feats: [{ cp: [[89, -601], [103, -603], [117, -597]], w: 6.5 }, { dot: [104, -593.5, 3.8, 1.8] }, ...fF.slice(2), { cp: [[96, -612], [100, -606]], w: 2 }] }),
  grief: d => ({ feats: [{ cp: [[90, -614], [102, -608], [114, -598]], w: 5 }, { cp: [[97, -591], [103, -589], [109, -591]], w: 2.6 }, fF[2], fF[3], fF[4], fF[5], { cp: [[106, -582], [99, -566], [97, -552]], w: 2.6 }, { cp: [[95, -588], [91, -572]], w: 2 }, { cp: [[102, -620], [104, -610]], w: 2 }] }),
  nod: d => ({ feats: [{ cp: [[90, -608], [103, -612], [116, -607]], w: 5 }, { cp: [[98, -594], [103, -596], [109, -593]], w: 2.8 }, ...fF.slice(2), { cp: [[96, -587], [90, -584]], w: 1.8 }, { cp: [[110, -578], [104, -572]], w: 2 }] }),
  up: d => ({ feats: [{ cp: [[90, -612], [103, -617], [116, -613]], w: 5.5 }, { dot: [107, -601, 3.6, 3.2] }, ...fF.slice(2)] }),
};
const EXPR_B = {
  curious: d => ({ feats: [{ cp: [[64, -407], [72, -411], [81, -408]], w: 3.6 }, { dot: [75, -392, 4.6, 4.2] }, ...fB.slice(2)] }),
  hesitant: d => ({ feats: [{ cp: [[65, -407], [72, -402], [80, -400]], w: 3.6 }, { dot: [75, -389, 3.6, 2.6] }, fB[2], { cp: [[74, -356], [79, -356], [82, -359]], w: 2.4 }, fB[4], fB[5], fB[6]] }),
  determined: d => ({ feats: [{ cp: [[65, -396], [73, -398], [82, -403]], w: 4.2 }, { dot: [76, -390.5, 4, 2.4, -.1] }, fB[2], { cp: [[75, -360], [83, -361]], w: 2.8 }, fB[4], fB[5], fB[6], { cp: [[62, -372], [70, -364]], w: 2 }] }),
  wonder: d => ({ feats: [{ cp: [[64, -408], [72, -413], [81, -410]], w: 3.6 }, { dot: [76, -396, 4.4, 4.4] }, fB[2], { cp: [[77, -362], [82, -358], [79, -353], [75, -357]], w: 2.8 }, fB[4], fB[5], fB[6]] }),
};
