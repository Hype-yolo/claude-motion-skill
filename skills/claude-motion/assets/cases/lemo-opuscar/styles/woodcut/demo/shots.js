// The Bell Founder — shots. Each shot: { t0, t1, draw(g, t, lt), events(K) }
import * as WC from './engine/index.js';
import * as ST from './stage.js';
import { clamp, lerp, seg, ss, eio, eo, ei, mulberry } from '/core/lib.js';
import { buildWorld, drawValley, snowAt, PW, PH, HOR, TOWER, BELFRY } from './world.js';
import { curl, peelState } from './trans.js';
import { captionAt } from './film.js';
import { drawFounder, FOUNDER_POSE, drawBoy, BOY_POSE, drawCompass } from './chars.js';
import * as FX from './fx.js';

const W = 1920, H = 1080, PI = Math.PI;
const { m, c, IMG } = ST;
let X = null, K = null;
export const SHOTS = [];
const TABLE = { pat: null };

// ------------------------------------------------------------------ frame helpers
// print frame into target (canvas ctx) — cam in plate coords
export function printFrame(tg, t, cam, draw, o = {}) {
  ST.begin(cam);
  draw(m, c);
  ST.end();
  if (!o.noCap) { const cp = captionAt(t); if (cp) ST.caption(cp.text, cp.a); }
  const out = X.printer.render(ST.M, ST.C, { seed: o.seed ?? 3, inkSeed: o.inkSeed ?? 3, reg: o.reg || [3, 2], plateAmt: o.plateAmt ?? 1 });
  const j = o.jolt || [0, 0];
  if (j[0] || j[1]) { tg.fillStyle = '#EFE8D8'; tg.fillRect(0, 0, W, H); }
  tg.drawImage(out, j[0], j[1]);
}
// a hard cut lands like a new impression: 2 frames of misregistration
export const jolt = lt => lt < 1 / 24 ? [5, -3] : lt < 2 / 24 ? [-2, 1] : [0, 0];
export const regJolt = lt => lt < 1 / 24 ? [10, -6] : lt < 2 / 24 ? [6, 1] : [3, 2];

// the inked block on the table (mirrored image). cam.x is in mirrored plate coords (screen-left = u small)
export function blockFrame(tg, cam, draw, o = {}) {
  m.setTransform(1, 0, 0, 1, 0, 0); c.setTransform(1, 0, 0, 1, 0, 0);
  m.fillStyle = '#000'; m.fillRect(0, 0, W, H); c.clearRect(0, 0, W, H);
  const k = ST.camMatrix(cam, false);
  m.save(); m.setTransform(...k); m.beginPath(); m.rect(0, 0, PW, PH); m.clip(); m.transform(-1, 0, 0, 1, PW, 0);
  draw(m, c);
  m.restore();
  const out = X.printer.render(ST.M, ST.C, { mode: 'block', sheen: o.sheen ?? .14, wetX: o.wetX ?? -1, grainAng: .02 });
  tg.drawImage(out, 0, 0);
  table(tg, k);
}
function table(tg, k) {
  tg.save();
  tg.beginPath(); tg.rect(-10, -10, W + 20, H + 20);
  const P = [[0, 0], [PW, 0], [PW, PH], [0, PH]].map(([x, y]) => [k[0] * x + k[2] * y + k[4], k[1] * x + k[3] * y + k[5]]);
  tg.moveTo(...P[0]); for (const p of P.slice(1)) tg.lineTo(...p); tg.closePath();
  tg.clip('evenodd');
  const im = X.table, s = k[0] * .9;
  tg.setTransform(s, 0, 0, s, k[4] - 300 * s, k[5] - 400 * s);
  tg.filter = 'brightness(.42) saturate(.7)';
  for (let yy = -1; yy < 3; yy++) for (let xx = -1; xx < 3; xx++) tg.drawImage(im, xx * im.width, yy * im.height);
  tg.filter = 'none'; tg.setTransform(1, 0, 0, 1, 0, 0);
  // the block casts a shadow on the table
  tg.strokeStyle = 'rgba(0,0,0,.6)'; tg.lineWidth = 18 * k[0]; tg.filter = `blur(${10 * k[0]}px)`;
  tg.beginPath(); tg.moveTo(P[0][0] + 10, P[0][1] + 10); for (const p of P.slice(1)) tg.lineTo(p[0] + 10, p[1] + 10); tg.closePath(); tg.stroke();
  tg.filter = 'none'; tg.restore();
  // block edge: a thin lit bevel
  tg.strokeStyle = 'rgba(216,194,156,.35)'; tg.lineWidth = Math.max(1, 3 * k[0]);
  tg.beginPath(); tg.moveTo(P[3][0], P[3][1]); tg.lineTo(P[0][0], P[0][1]); tg.lineTo(P[1][0], P[1][1]); tg.stroke();
}
const buf = i => X.bufs[i];

// ------------------------------------------------------------------ S1–S2 · the first cut, the valley carved (0–7)
const TITLE = { x: 560, y: 140, size: 96, text: 'THE BELL FOUNDER' };
let OPEN = null;
function buildOpen() {
  if (OPEN) return OPEN;
  OPEN = {};
  const pts = []; for (let u = 12; u <= PW - 12; u += 6) pts.push([PW - u, HOR + 9 + Math.sin((PW - u) * .004) * 6]);
  OPEN.line = WC.mkStroke(pts, pts.map((_, i) => 7.5 + 1.5 * Math.sin(i * .07)), { kind: 'v', seed: 5, chip: .12 });
  OPEN.lineTip = u => { const i = clamp(Math.floor(u * (pts.length - 1)), 0, pts.length - 1); return pts[i]; };
  // the title, carved (hatched letters on the block, solid white letters in the print)
  const font = `400 ${TITLE.size}px "IM Fell English SC"`;
  const reg = new WC.Region(q => { q.font = font; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(TITLE.text, TITLE.x, TITLE.y); }, { res: 1, bbox: [TITLE.x - 560, TITLE.y - 70, TITLE.x + 560, TITLE.y + 70] });
  OPEN.title = WC.hatch(reg, { dir: WC.dirAngle(PI / 2 - .25), tone: () => 1, sp: 3.2, wmax: 4.4, seed: 3, seg: [10, 40], gap: [0, 1], reveal: { t0: 6.0, t1: 6.85, key: (x, y) => clamp((x - TITLE.x + 520) / 1040), speed: 700, jit: .04 } });
  OPEN.font = font;
  const rule = [[TITLE.x - 360, TITLE.y + 70], [TITLE.x + 360, TITLE.y + 70]];
  OPEN.rule = WC.cutAlong(rule, { w: 4, kind: 'v', seg: [720, 800], seed: 9, reveal: { t0: 6.8, t1: 6.95, speed: 5000 } });
  // stabbed snow = the first positions of the falling snow
  const Kw = buildWorld('print'); const r = mulberry(91);
  OPEN.flakes = WC.flecks(snowAt(Kw, 0, { t0: 0 }).map(([x, y, rr]) => [x, y, rr]), { seed: 3 });
  OPEN.flakes.forEach((f, i) => { f.t0 = 6.0 + (i % 4) * .25 + r() * .05; f.dur = .03; });
  return OPEN;
}
function titleSolid(m) { m.save(); m.font = OPEN.font; m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillStyle = '#fff'; m.fillText(TITLE.text, TITLE.x, TITLE.y); m.restore(); WC.drawStrokes(m, OPEN.rule); }
function lineProg(t) { const u = seg(t, 1.0, 2.8); return u < .3 ? .05 * (u / .3) ** 1.5 : .05 + .95 * ss((u - .3) / .7) ** .85; }
function openCam(t) {
  const tipU = PW - OPEN.lineTip(lineProg(t))[0];    // mirrored coords
  const z = t < 1.2 ? 4.2 : t < 2.9 ? lerp(4.2, 1.9, eio(seg(t, 1.2, 2.9))) : t < 6.2 ? lerp(1.9, .9, eio(seg(t, 2.9, 6.2))) : lerp(.9, 1, eio(seg(t, 6.6, 7.6)));
  const half = IMG.w / 2 / z;
  const fx = t < 1.0 ? 12 + half * .75 : clamp(tipU + half * .2, half * .9, PW - half * .9);
  const x = t < 2.9 ? fx : lerp(clamp(fx, 0, PW), PW / 2, eio(seg(t, 2.9, 5.6)));
  const y = t < 2.9 ? HOR : lerp(HOR, PH / 2, eio(seg(t, 2.9, 5.6)));
  return { x: t < 1 ? fx : (t < 2.9 ? fx : x), y, z };
}
function drawBlockContent(m, t, prog = null) {
  drawValley(m, c, t, { mode: t > 7.0 ? 'print' : 'carve', skyT: t, figures: null });
  // the first cut
  const p = prog ?? lineProg(t);
  if (p > 0) { m.fillStyle = '#fff'; m.beginPath(); WC.strokePath(m, OPEN.line, p); m.fill(); }
  if (t > 7.0) titleSolid(m); else { WC.drawStrokes(m, OPEN.title, { t }); WC.drawStrokes(m, OPEN.rule, { t }); }
  WC.drawStrokes(m, OPEN.flakes, { t });
  if (p > 0 && p < 1) { const [x, y] = OPEN.lineTip(p); WC.chip(m, { x, y, a: PI, w: 7 }, 1.2); }
}
SHOTS.push({
  t0: 0, t1: 7.0,
  draw(g, t) { buildOpen(); blockFrame(g, openCam(t), m => drawBlockContent(m, t), { sheen: .16 }); },
  events: K => [
    { t: K.knife_first, type: 'knife_bite' }, { t: K.knife_first, type: 'knife_run', dur: 1.8 }, { t: K.line_end, type: 'knife_flick' },
    ...[0, .25, .5, .75].map(d => ({ t: K.carve_ridge + d, type: 'gouge_u' })), ...[0, .2, .4, .6, .8].map(d => ({ t: K.carve_village + d, type: 'gouge_v' })),
    { t: K.carve_fine, type: 'carve_fine', dur: 1.0 }, { t: K.carve_title, type: 'carve_title', dur: .9 },
    ...[0, .25, .5, .75].map(d => ({ t: K.carve_title + d, type: 'stab' })),
  ],
});

// ------------------------------------------------------------------ S3 · ink, paper, baren, peel (7–9)
let PAPER = null;
function paperTex() {   // blank laid paper = the print shader with nothing carved
  if (PAPER) return PAPER;
  m.setTransform(1, 0, 0, 1, 0, 0); m.fillStyle = '#fff'; m.fillRect(0, 0, W, H); c.clearRect(0, 0, W, H);
  const out = X.printer.render(ST.M, ST.C, { seed: 11 });
  const [cv, q] = WC.canvas(); q.drawImage(out, 0, 0); PAPER = cv; return cv;
}
function walkers(m, t) {
  const st = Math.floor(t * 12) / 12, ph = Math.floor(t * 3) % 2, wx = 610 + (st - 9) * 14;
  drawBoy(m, [.36, 0, 0, .36, wx, 846 - (st - 9) * 4], ph ? BOY_POSE.walkA : BOY_POSE.walkB);
  drawFounder(m, [.36, 0, 0, .36, wx + 90, 850 - (st - 9) * 4], ph ? FOUNDER_POSE.walkB : FOUNDER_POSE.walkA);
}
function firstPrintTo(tg, t) {
  printFrame(tg, t, { x: PW / 2, y: PH / 2, z: 1 }, m => { drawValley(m, c, 9, { figures: m => walkers(m, 9) }); titleSolid(m); WC.drawStrokes(m, WC.flecks(snowAt(buildWorld(), 9, { t0: 9 }).map(([x, y, r]) => [x, y, r]), { seed: 3 })); }, { noCap: true, seed: 5, inkSeed: 5 });
}
function baren(tg, x, y, rot) {
  tg.save(); tg.translate(x, y);
  tg.fillStyle = 'rgba(0,0,0,.35)'; tg.filter = 'blur(14px)'; tg.beginPath(); tg.ellipse(18, 22, 118, 112, 0, 0, PI * 2); tg.fill(); tg.filter = 'none';
  const gr = tg.createRadialGradient(-30, -30, 10, 0, 0, 120); gr.addColorStop(0, '#6b5238'); gr.addColorStop(.8, '#3b2a1a'); gr.addColorStop(1, '#22170e');
  tg.fillStyle = gr; tg.beginPath(); tg.arc(0, 0, 112, 0, PI * 2); tg.fill();
  tg.rotate(rot); tg.strokeStyle = 'rgba(255,230,190,.12)'; tg.lineWidth = 2;
  for (let i = 0; i < 6; i++) { tg.beginPath(); tg.arc(0, 0, 18 + i * 16, 0, PI * 1.6); tg.stroke(); }
  tg.fillStyle = '#2a1d12'; tg.fillRect(-16, -128, 32, 60);    // the knot of the sheath
  tg.restore();
}
function brayer(tg, x) {
  tg.save();
  tg.fillStyle = 'rgba(0,0,0,.45)'; tg.filter = 'blur(16px)'; tg.fillRect(x + 30, 30, 70, H - 40); tg.filter = 'none';
  const gr = tg.createLinearGradient(x - 38, 0, x + 38, 0);
  gr.addColorStop(0, '#050505'); gr.addColorStop(.35, '#3a3a3a'); gr.addColorStop(.5, '#8d8d8d'); gr.addColorStop(.62, '#2a2a2a'); gr.addColorStop(1, '#040404');
  tg.fillStyle = gr; tg.fillRect(x - 38, 16, 76, H - 60);
  tg.fillStyle = '#5a3d22'; tg.fillRect(x - 10, -40, 20, 70); tg.fillRect(x - 46, 6, 92, 14);
  tg.restore();
}
function rubMask(tg, t) {   // how much of the image shows through the back of the sheet, grown by baren circles
  const [cv, q] = X.rub || (X.rub = WC.canvas());
  q.setTransform(1, 0, 0, 1, 0, 0); q.clearRect(0, 0, W, H);
  // ink soaks through a little as soon as the sheet lies down; the baren's soft spiral rubs it fully through
  q.fillStyle = `rgba(0,0,0,${.22 + .1 * seg(t, 7.67, 8.0)})`; q.fillRect(0, 0, W, H);
  if (!X.brush) {
    const [bc, bq] = WC.canvas(360, 360), gr = bq.createRadialGradient(180, 180, 0, 180, 180, 180);
    gr.addColorStop(0, 'rgba(0,0,0,.34)'); gr.addColorStop(.6, 'rgba(0,0,0,.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    bq.fillStyle = gr; bq.fillRect(0, 0, 360, 360); X.brush = bc;
  }
  const N = 260, n = Math.floor(seg(t, 8.0, 8.5) * N);
  for (let i = 0; i < n; i++) { const [x, y] = barenPath(8.0 + i / N * .5); q.drawImage(X.brush, x - 180, y - 180); }
  return cv;
}
// an inward spiral with small circular wobbles (how a baren is actually worked), covering the whole sheet
function barenPath(t) {
  const u = seg(t, 8.0, 8.5), a = u * PI * 5 - PI / 2, k = 1 - .88 * u, w = u * PI * 38;
  return [960 + Math.cos(a) * 760 * k + Math.cos(w) * 40, 500 + Math.sin(a) * 380 * k + Math.sin(w) * 40];
}
function paperBack(tg, t, full = false) {    // the back of the sheet with the image showing through (mirrored print)
  const [fb, fq] = X.frontCv;
  tg.drawImage(paperTex(), 0, 0);
  const [sb, sq] = X.showCv || (X.showCv = WC.canvas());
  sq.globalCompositeOperation = 'source-over'; sq.clearRect(0, 0, W, H);
  sq.save(); sq.setTransform(-1, 0, 0, 1, W, 0); sq.drawImage(fb, 0, 0); sq.restore();
  if (!full) { sq.globalCompositeOperation = 'destination-in'; sq.drawImage(rubMask(null, t), 0, 0); sq.globalCompositeOperation = 'source-over'; }
  tg.save(); tg.globalCompositeOperation = 'multiply'; tg.globalAlpha = .42; tg.drawImage(sb, 0, 0); tg.restore();
}
SHOTS.push({
  t0: 7.0, t1: 9.0,
  draw(g, t) {
    buildOpen();
    X.frontCv = X.frontCv || WC.canvas();
    if (!X.frontDone) { firstPrintTo(X.frontCv[1], 9); X.frontDone = true; }
    const cam = openCam(Math.min(t, 7.6));
    const wetX = t < 7.6 ? lerp(-60, W + 60, seg(t, 7.0, 7.6)) : W + 200;
    if (t < 8.5) {
      blockFrame(g, cam, m => drawBlockContent(m, 7.01, 1), { sheen: .16, wetX });
      if (t < 7.62) brayer(g, wetX);
      if (t >= 7.6667) {
        const u = eo(seg(t, 7.6667, 7.98)), ye = H * u;
        const [pb, pq] = buf(0); paperBack(pq, t);
        g.save(); g.beginPath(); g.rect(0, 0, W, ye); g.clip(); g.drawImage(pb, 0, 0); g.restore();
        if (u < 1) {  // the falling edge: a soft shadow ahead of it, a curled lip
          const gr = g.createLinearGradient(0, ye, 0, ye + 90); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.fillRect(0, ye, W, 90);
          g.fillStyle = 'rgba(255,250,236,.8)'; g.fillRect(0, ye - 4, W, 4);
        }
        if (t >= 8.0) { const [bx, by] = barenPath(t); baren(g, bx, by, t * 9); }
      }
    } else {
      const u = seg(t, 8.5, 9.0), { xf, r } = peelState(u, 230);
      const offX = W * eio(seg(t, 8.56, 9.0));
      const [bb, bq] = buf(1);
      blockFrame(bq, cam, m => drawBlockContent(m, 7.01, 1), { sheen: .1 });
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.drawImage(bb, offX, 0);
      // table continues to the left of the block
      g.save(); g.beginPath(); g.rect(offX - W, 0, W, H); g.clip(); g.filter = 'brightness(.42) saturate(.7)';
      const im = X.table; for (let yy = -1; yy < 2; yy++) for (let xx = -2; xx < 1; xx++) g.drawImage(im, offX + xx * im.width - 300, yy * im.height - 400);
      g.filter = 'none'; g.restore();
      const [pb, pq] = buf(0); paperBack(pq, t, true);
      curl(g, pb, X.frontCv[0], xf, r, { offX, F: 1900 });
    }
  },
  events: K => [{ t: K.ink_roll, type: 'brayer', dur: .6 }, { t: K.paper_lay, type: 'paper_lay' }, { t: K.rub, type: 'baren', dur: .5 }, { t: K.peel, type: 'peel', dur: .5 }, { t: K.print_land, type: 'paper_land' }],
});

// ------------------------------------------------------------------ S4 · the first print: the village under snow (9–15)
SHOTS.push({
  t0: 9.0, t1: 15.0,
  draw(g, t, lt) {
    buildOpen();
    const u = eio(seg(t, 11.0, 14.3));
    const cam = { x: lerp(PW / 2, BELFRY.x - 20, u), y: lerp(PH / 2, BELFRY.y + 70, u), z: lerp(1, 2.7, u) };
    printFrame(g, t, cam, m => {
      drawValley(m, c, 9, { figures: m => walkers(m, t) });
      titleSolid(m);
      WC.drawStrokes(m, WC.flecks(snowAt(buildWorld(), t, { t0: 9 }).map(([x, y, r]) => [x, y, r]), { seed: 3 }));
    }, { seed: 5, inkSeed: 5 });
  },
  events: K => [{ t: 9.0, type: 'amb_wind', dur: 6.0 }, { t: 12.6, type: 'beam_creak' }],
});

export async function setup(ctx) {
  X = ctx; K = ctx.K;
  const more = await import('./shots2.js');
  more.register(SHOTS, { printFrame, blockFrame, jolt, regJolt, buf, X: () => X });
  SHOTS.sort((a, b) => a.t0 - b.t0);
}
