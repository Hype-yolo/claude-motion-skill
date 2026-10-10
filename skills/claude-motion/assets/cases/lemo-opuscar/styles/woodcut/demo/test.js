import * as SH from './sheet.js';
import * as WC from './engine/index.js';
import * as ST from './stage.js';
import { buildWorld, drawValley, snowAt, PW, PH } from './world.js';
export async function init() { ST.printer(); }
export function test(g, mode, t, qs) {
  if (mode === 'char') return testChar(g, t, qs);
  if (mode === 'hands') return testHands(g, t, qs);
  if (mode === 'pour') return testPour(g, t, qs);
  if (mode === 'sheetA') return SH.sheetA(g);
  if (mode === 'sheetB') return SH.sheetB(g);
  if (mode === 'filter') return testFilter(g, t, qs);
  if (mode === 'spark') return testSpark(g, t);
  if (mode === 'village') {
    const K = buildWorld();
    ST.begin({ x: PW / 2, y: PH / 2, z: +(qs.get('z') || 1) });
    drawValley(ST.m, ST.c, t, { figures: (m) => {
      drawBoy(m, [.36, 0, 0, .36, 700, 842], BOY_POSE.walkB);
      drawFounder(m, [.36, 0, 0, .36, 790, 846], FOUNDER_POSE.walkA);
    } });
    const fl = WC.flecks(snowAt(K, t).map(([x, y, r]) => [x, y, r]), { seed: 3 });
    WC.drawStrokes(ST.m, fl);
    ST.end();
    ST.caption('That winter, the snow closed every road, and the tower had no bell.');
    ST.print(g, { seed: 3 });
  }
}
import { drawFounder, FOUNDER_POSE, drawBoy, BOY_POSE } from './chars.js';
export function testChar(g, t, qs) {
  ST.begin({}, { full: true });
  const m = ST.m;
  m.fillStyle = '#000'; m.fillRect(0, 0, 1920, 1080);
  const k = .72;
  ['stand', 'hammerUp', 'hammerDown', 'pour', 'ropeDown', 'grief'].forEach((p, i) => drawFounder(m, [k, 0, 0, k, 60 + i * 300, 520], FOUNDER_POSE[p]));
  ['stand', 'bellowsDown', 'clutch', 'throwWind', 'throwOut', 'lookUp', 'shield', 'walkA'].forEach((p, i) => drawBoy(m, [.9, 0, 0, .9, 60 + i * 230, 1040], BOY_POSE[p]));
  ST.end(); ST.print(g, { seed: 2 });
}
let IMGS = {}, FIL = {};
async function loadImg(src) { if (IMGS[src]) return IMGS[src]; const im = new Image(); im.src = src; await im.decode(); return IMGS[src] = im; }
export async function preload(qs) { if (qs.get('test') === 'filter') await loadImg(qs.get('img') || 'assets/bearded_man_cc0.jpg'); }
function testFilter(g, t, qs) {
  const src = qs.get('img') || 'assets/bearded_man_cc0.jpg', im = IMGS[src];
  const key = src + qs.get('sp');
  if (!FIL[key]) { const t0 = performance.now(); FIL[key] = WC.woodcutFilter(im, { rect: [0, 0, 1920, 1080], sp: +(qs.get('sp') || 6), black: +(qs.get('bk') || .06), white: +(qs.get('wt') || .8), gamma: +(qs.get('gm') || 1.1), reveal: { t0: 0, t1: 1, mode: 'light' } }); console.warn('filter ms', performance.now() - t0, FIL[key].strokes.length); }
  ST.begin({}, { full: true }); ST.m.setTransform(1, 0, 0, 1, 0, 0);
  ST.m.fillStyle = '#000'; ST.m.fillRect(0, 0, 1920, 1080);
  WC.drawStrokes(ST.m, FIL[key].strokes, { t });
  ST.end(); ST.print(g, { seed: 4, mode: qs.get('mode') || 'print' });
}
import * as IN from './interior.js';
export function testPour(g, t, qs) {
  ST.begin({ x: +(qs.get('cx') || 1000), y: +(qs.get('cy') || 480), z: +(qs.get('z') || 1.18) });
  const m = ST.m, c = ST.c;
  const k = 1.18, FM = [k, 0, 0, k, 470, 890];
  const me = drawFounder(m, FM, FOUNDER_POSE.pour, 1e9, { measure: true });
  const tip = me.tip, cr = [tip[0] + 30, tip[1] + 44];
  const MO = IN.MOULD(), src = [MO.cup[0], MO.cup[1] - 6];
  IN.drawWorkshop(m, c, t, { rays: (m, c) => {
    const R = WC.rays(src[0], src[1], { n: 60, r0: 62, r1: [700, 1500], w: 22, seed: 9, jit: .8, bend: .03 });
    WC.drawStrokes(m, R);
    const q = Math.floor(t * 12), bl = []; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, r = 104 + 9 * Math.sin(i * 1.7 + q) + 6 * Math.sin(i * 4.3 - q * 1.3); bl.push([src[0] + Math.cos(a) * r, src[1] + Math.sin(a) * r * .8]); }
    WC.fillPoly(m, [bl], '#fff');
    const gr = c.createRadialGradient(src[0], src[1], 20, src[0], src[1], 820);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.35, 'rgba(0,0,0,.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(-2000, -2000, 6000, 6000);
  } });
  drawBoy(m, [-1.35, 0, 0, 1.35, 1590, 890], { ...BOY_POSE.lookUp, head: -.2, expr: 'wonder', a1: -1.6, a2: -.9 });
  drawFounder(m, FM, { ...FOUNDER_POSE.pour, expr: 'focus' });
  const C = IN.crucible(m, c, cr[0], cr[1], .95, 1);
  if (!qs.get('nostream')) IN.stream(m, c, C.lip, MO.cup, t, 24);
  if (!qs.get('nosparks')) IN.sparks(m, c, MO.cup[0], MO.cup[1] - 10, t, 50, 240, 3);
  ST.end();
  ST.print(g, { seed: 5 });
}
import { founderHands } from './hands.js';
let HC = null;
export function testHands(g, t, qs) {
  if (!HC) HC = founderHands(924, 456);
  if (qs.get('raw')) { g.fillStyle = '#000'; g.fillRect(0, 0, 1920, 1080); g.drawImage(HC.clay, 0, 0, 1848, 912); g.drawImage(HC.hands, 0, 0, 1848, 912); return; }
  if (!HC.f) {
    const [cv, q] = WC.canvas(924, 456); q.fillStyle = '#000'; q.fillRect(0, 0, 924, 456); q.drawImage(HC.clay, 0, 0);
    HC.fc = WC.woodcutFilter(cv, { rect: [0, 0, 1848, 912], sp: 5, black: .05, white: .8, gamma: 1.1, res: 3 });
    const reg = new WC.Region(q => q.drawImage(HC.hands, 0, 0, 1848, 912), { res: 2, bbox: [0, 0, 1848, 912] });
    HC.fh = WC.woodcutFilter(HC.hands, { rect: [0, 0, 1848, 912], region: qs.get('noreg') ? undefined : reg, sp: 4.5, black: .06, white: .82, gamma: 1.05, res: 2, reveal: { t0: 0, t1: 1 }, debug: 1 });
    { const d = HC.fh.dir; console.warn('dirs', d(1000,400), d(900,300), d(1200,500), HC.fh.tone(900,300), HC.fh.tone(1200, 500)); }
    HC.f = 1; console.warn('strokes', HC.fc.strokes.length, HC.fh.strokes.length, reg.W, reg.H, reg.m.reduce((a,b)=>a+b,0), HC.fh.tone(1000,400), HC.fh.tone(600,300));
  }
  ST.begin({ x: 924, y: 456, z: 1 }); const m = ST.m;
  m.fillStyle = '#000'; m.fillRect(-100, -100, 2100, 1200);
  WC.drawStrokes(m, HC.fc.strokes); WC.drawStrokes(m, HC.fh.strokes, { t });
  ST.end(); ST.print(g, { seed: 3 });
}

// STYLE.md §10 minimal example, verbatim: a warm-orange four-point spark with a cursor tail, carved and printed.
// Engine only (no stage.js). ?test=spark&t=… animates the carving (t 0 → 1.2 s).
let SPK = null;
function testSpark(g, t) {
  if (!SPK) {
    const [mask, m] = WC.canvas(), [plate, c] = WC.canvas(), P = WC.makePrinter();
    const star = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 70 : 260; star.push([960 + Math.cos(a) * r, 500 + Math.sin(a) * r]); }
    const spark = WC.shape([star], { light: WC.light(.5, -.6, .6), sp: 9, halo: 8, reveal: { t0: 0, t1: .8, key: (x, y) => Math.hypot(x - 960, y - 500) / 300 } });
    const tail = WC.cutAlong([[1030, 590], [1090, 680], [1110, 770]], { w: 24, kind: 'u', seg: [300, 400], reveal: { t0: .8, t1: 1.1, speed: 900 } });
    SPK = { m, c, mask, plate, P, star, spark, tail };
  }
  const { m, c, mask, plate, P, star, spark, tail } = SPK;
  m.fillStyle = '#000'; m.fillRect(0, 0, 1920, 1080);   // the uncut block
  c.clearRect(0, 0, 1920, 1080);
  WC.drawStrokes(m, WC.rays(960, 500, { n: 36, r0: 300, r1: [420, 640], w: 10, seed: 2, reveal: { t0: .5, t1: 1.0 } }), { t });
  spark.draw(m, t);                                      // black shape + white form-following cuts + halo
  WC.drawStrokes(m, tail, { t });
  WC.plate(c, [star], t > .8 ? 1 : 0);                   // the one colour: the spark keeps its own orange
  g.drawImage(P.render(mask, plate, { seed: 4, plate: '#D97757' }), 0, 0);
}
