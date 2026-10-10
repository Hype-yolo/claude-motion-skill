// The Bell Founder — shots 5–17 (15 s → end)
import * as WC from './engine/index.js';
import * as ST from './stage.js';
import { clamp, lerp, seg, ss, eio, eo, ei, mulberry } from '/core/lib.js';
import { buildWorld, drawValley, snowAt, PW, PH, HOR, TOWER, BELFRY } from './world.js';
import { curl, peelState } from './trans.js';
import { drawFounder, FOUNDER_POSE as FP, drawBoy, BOY_POSE as BP, drawCompass } from './chars.js';
import { drawFounderBack } from './views.js';
import * as IN from './interior.js';
import * as FX from './fx.js';
import { part, drawPart, put, mul, T, R, S } from './rig.js';
import { founderHands, boyCompass } from './hands.js';
const CUT_C = 31.9167, K_ = { click: 32.3333 }, CMP = {};   // the compass insert opens inside the silence

const W = 1920, H = 1080, PI = Math.PI;
const { m, c, IMG } = ST;
const st12 = t => Math.floor(t * 12) / 12;          // characters step on twos
const FLIP = (k, x, y) => [-k, 0, 0, k, x, y], NORM = (k, x, y) => [k, 0, 0, k, x, y];
let H_ = null;

export function register(SHOTS, H) {
  H_ = H;
  const add = s => SHOTS.push(s);

  // ---------------------------------------------------------------- S5 · the founder's hands (15–19), fine engraving
  let HD = null;
  function hands() {
    if (HD) return HD;
    const hc = founderHands(924, 456);
    const [cv, q] = WC.canvas(924, 456); q.fillStyle = '#000'; q.fillRect(0, 0, 924, 456); q.drawImage(hc.clay, 0, 0);
    const clay = WC.woodcutFilter(cv, { rect: [0, 0, 1848, 912], sp: 5, black: .05, white: .8, gamma: 1.1, res: 3, reveal: { t0: 15.0, t1: 15.35, mode: 'down' } });
    const reg = new WC.Region(qq => qq.drawImage(hc.hands, 0, 0, 1848, 912), { res: 2, bbox: [0, 0, 1848, 912] });
    const hs = WC.woodcutFilter(hc.hands, { rect: [0, 0, 1848, 912], region: reg, sp: 4.5, black: .06, white: .82, gamma: 1.05, res: 2, reveal: { t0: 15.0, t1: 15.75, mode: 'light', speed: 1500 } });
    return HD = { clay: clay.strokes, hands: hs.strokes };
  }
  add({
    t0: 15.0, t1: 19.0,
    draw(g, t, lt) {
      const D = hands();
      const push = eio(seg(t, 15.3, 16.1)) * 34 + eio(seg(t, 17.3, 18.1)) * 34;    // two strickle strokes
      H.printFrame(g, t, { x: 924 + 40 * seg(t, 15, 19), y: 470, z: lerp(1.0, 1.13, eio(seg(t, 15, 19))) }, m => {
        m.fillStyle = '#000'; m.fillRect(-200, -200, 2300, 1400);
        WC.drawStrokes(m, D.clay, { t });
        m.save(); m.translate(push, push * -.06); WC.drawStrokes(m, D.hands, { t }); m.restore();
        // a few flecks of loam lifted by the board
        const r = mulberry(5 + Math.floor(t * 12));
        if (seg(t, 15.5, 16.3) * (1 - seg(t, 16.3, 16.6)) > 0 || seg(t, 17.5, 18.3) * (1 - seg(t, 18.3, 18.6)) > 0) WC.drawStrokes(m, WC.flecks(Array.from({ length: 10 }, () => [1330 + push + r() * 90, 640 + r() * 40, 2 + r() * 2]), { seed: 3 }));
      }, { seed: 7, inkSeed: 7 });
    },
    events: K => [{ t: K.fire_jcut, type: 'amb_forge', dur: 8.5 }, { t: 15.0, type: 'wind_muffled', dur: 4.0 }, { t: 15.0, type: 'carve_fine', dur: .7, gain: .5 }, { t: K.rasp1 - .3, type: 'clay_rasp', dur: .8 }, { t: K.rasp2 - .3, type: 'clay_rasp', dur: .8 }],
  });

  // ---------------------------------------------------------------- S6 · gifts (19–23): one action, one sound, one cut
  const GIFTS = [['pot', 19.0, 1.3, -.15, 0], ['candle', 20.0, 1.25, .2, 1], ['keys', 21.0, 1.6, -.4, 2], ['ring', 21.5, 2.4, .1, 3], ['spoon', 22.0, 1.4, .5, 0], ['bracelet', 22.25, 1.6, -.2, 1]];
  const SLEEVE = [
    { sl: [[-120, -600], [60, -600], [70, -260], [-60, -250]], hand: [[-58, -262], [66, -270], [96, -200], [80, -150], [40, -120], [-10, -130], [-60, -190]] },
    { sl: [[-90, -600], [90, -600], [60, -270], [-70, -270]], hand: [[-66, -280], [58, -282], [80, -210], [60, -150], [0, -126], [-50, -150], [-76, -210]] },
    { sl: [[-140, -600], [40, -600], [80, -300], [-40, -280]], hand: [[-40, -290], [78, -300], [110, -230], [90, -170], [40, -150], [-10, -170], [-44, -230]] },
    { sl: [[-100, -600], [80, -600], [56, -250], [-80, -250]], hand: [[-78, -262], [52, -262], [70, -190], [50, -130], [-10, -110], [-60, -140], [-86, -200]] },
  ];
  function giver(m, i, open) {   // a villager's arm reaching into frame from above, hand just opened
    const S_ = SLEEVE[i];
    drawPart(m, part('gsl' + i, { poly: S_.sl, light: WC.light(.5, -.2, .3), R: 30, sp: 7, dir: PI / 2 + .1, halo: 6, seed: i + 30, lo: .35 }));
    drawPart(m, part('ghd' + i + open, { poly: WC.spline(S_.hand, 5, true), white: true, outline: 4, sp: 5, R: 22, amb: .15, lo: .45, halo: 5, light: WC.light(.7, -.4, .5), seed: i + 40,
      feats: open ? [{ cp: [[-20, -150], [-24, -126]], w: 3 }, { cp: [[6, -146], [4, -120]], w: 3 }, { cp: [[30, -150], [34, -128]], w: 3 }] : [{ cp: [[-30, -200], [0, -190], [40, -200]], w: 3 }] }));
  }
  function giftInsert(m, t, name, t0, s, rot, who, heapN) {
    const lt = t - t0, cx = 924, cy = 860;
    m.fillStyle = '#000'; m.fillRect(-500, -500, 3000, 2000);
    FX.crucibleTop(m, cx, cy, 900, heapN);
    // the object: fell and hits the heap at t0, bounces once
    const bounce = Math.abs(Math.sin(Math.min(lt, .3) / .3 * PI)) * 40 * (1 - lt / .5);
    m.save(); m.translate(cx - 60 + who * 20, cy - 260 - Math.max(0, bounce) * 2); m.rotate(rot + lt * .3); FX.drawGift(m, name, s * 2.3); m.restore();
    // impact ticks
    if (lt < .25) { const r = mulberry(9), st = []; for (let i = 0; i < 9; i++) { const a = -PI + i / 8 * PI, d0 = 130 * s, d1 = d0 + 50 + r() * 40; const e0 = d0 * 2.3, e1 = d1 * 2.3; st.push(WC.mkStroke([[cx - 60 + Math.cos(a) * e0, cy - 260 + Math.sin(a) * e0 * .6], [cx - 60 + Math.cos(a) * e1, cy - 260 + Math.sin(a) * e1 * .6]], 8, { kind: 'v', seed: i })); } WC.drawStrokes(m, st); }
    // the giver's hand above, rising away after letting go
    m.save(); m.translate(cx + 300 - who * 90, 470 - lt * 220); m.scale(1.5, 1.5); giver(m, who, 1); m.restore();
  }
  GIFTS.forEach(([name, t0, s, rot, who], i) => {
    const t1 = i < GIFTS.length - 1 ? GIFTS[i + 1][1] : 22.5;
    add({
      t0, t1,
      draw(g, t, lt) { H.printFrame(g, t, { x: 924 + [0, -60, 50, 0, -30, 40][i], y: 470 + [0, 20, -10, 30, 0, 10][i], z: [1, 1.12, 1.3, 1.55, 1.2, 1.4][i], r: [0, .03, -.04, .02, -.05, .04][i] }, m => giftInsert(m, t, name, t0, s, rot, who, 3 + i * 3), { jolt: H.jolt(lt), seed: 7 + i }); },
      events: K => [{ t: t0, type: 'gift_' + name }],
    });
  });
  const coatFolds = () => H.X().coatFolds || (H.X().coatFolds = WC.hatch(new WC.Region([WC.rect(0, 0, 1848, 912)], { res: 6 }), { dir: WC.dirAngle(PI / 2 + .15), tone: (x, y) => .2 + .12 * Math.sin(x * .004) - .1 * (x > 500 && x < 1400), sp: 34, lo: .25, seed: 4, seg: [120, 400], gap: [30, 120] }));
  // the boy's hand closes over the compass: he keeps it (same engraved maquette as the turning-point insert)
  add({
    t0: 22.5, t1: 23.0,
    draw(g, t, lt) {
      const st = t < 22.5 + 3 / 24 ? 'shut' : 'grip';
      H.printFrame(g, t, { x: 924 - 20 * seg(t, 22.5, 23), y: 456, z: lerp(1.08, 1.16, eo(seg(t, 22.5, 23))) }, m => {
        m.fillStyle = '#000'; m.fillRect(-500, -500, 3000, 2000);
        WC.drawStrokes(m, coatFolds());
        WC.drawStrokes(m, compassState(st));
      }, { jolt: H.jolt(lt), seed: 13 });
    },
    events: K => [{ t: K.clutch, type: 'cloth_grip' }],
  });

  // ---------------------------------------------------------------- the forge interior helpers
  function crucibleInFire(m, c, glow, k = 1) {   // the crucible sitting in the furnace mouth
    const x = 180, y = 700;
    IN.crucible(m, c, x, y, 0, glow, 1.05);
    if (glow > 0) { const gr = c.createRadialGradient(x, y - 40, 10, x, y - 40, 420 * k); gr.addColorStop(0, `rgba(0,0,0,${.9 * glow})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(-500, 0, 1400, 1100); }
  }
  function forgeWide(m, c, t, o) {
    IN.drawWorkshop(m, c, t, { fire: o.fire ?? 1, noMould: false });
    crucibleInFire(m, c, o.glow ?? 0, o.glowR ?? 1);
    const pump = o.pump ?? 0;
    FX.bellows(m, 330, 690, 1, .5 + .5 * Math.cos(pump * PI * 2), t);
    const down = Math.cos(pump * PI * 2) < 0;
    drawBoy(m, FLIP(1.12, 700, 812), down ? BP.bellowsDown : BP.bellowsUp);
    drawFounder(m, FLIP(1.0, 990, 812), { ...FP.tend, expr: 'focus' });
  }

  // ---------------------------------------------------------------- S7 · the furnace; the first colour (23–25)
  add({
    t0: 23.0, t1: 25.0,
    draw(g, t, lt) {
      const b = (t - 23.0) / .6667;                     // one pump per beat
      const glow = ss(seg(t, 24.3333, 24.55));
      const pu = eio(seg(t, 24.1, 25.0));                // push in on the crucible as the copper melts: the first colour, close
      H.printFrame(g, t, { x: lerp(560, 360, pu), y: lerp(520, 610, pu), z: lerp(1.1, 1.16, seg(t, 23, 24.1)) + .62 * pu }, m => forgeWide(m, c, t, { pump: st12(b * .6667) / .6667, glow, fire: 1.15 }), { jolt: H.jolt(lt), seed: 17, reg: glow > 0 && t < 24.45 ? H.regJolt(t - 24.3333) : [3, 2] });
    },
    events: K => [0, 1, 2].map(i => ({ t: K.furnace + i * .6667, type: 'bellows' })).concat([{ t: K.furnace, type: 'fire_roar', dur: 5.3 }, { t: K.glow, type: 'molten_bubble', dur: 2.5 }]),
  });

  // ---------------------------------------------------------------- S7b · first pour (25–26.8)
  function pourScene(m, c, t, o) {
    const k = 1.18, FM = NORM(k, 470, 890), pose = o.pose;
    const me = drawFounder(m, FM, pose, 1e9, { measure: true });
    const tip = me.tip, cr = [tip[0] + 30, tip[1] + 44], MO = IN.MOULD(), src = [MO.cup[0], MO.cup[1] - 6];
    IN.drawWorkshop(m, c, t, { fire: o.fire ?? 1, rays: o.rays ? (m, c) => o.rays(m, c, src) : null });
    if (o.boy) drawBoy(m, FLIP(1.3, 1620, 890), o.boy);
    drawFounder(m, FM, { ...pose, expr: 'focus' });
    const C = IN.crucible(m, c, cr[0], cr[1], o.tilt, 1);
    const gl = c.createRadialGradient(cr[0], cr[1], 10, cr[0], cr[1], 380); gl.addColorStop(0, 'rgba(0,0,0,.95)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gl; c.fillRect(-500, -500, 3000, 2000);
    if (o.stream > 0) { IN.stream(m, c, C.lip, MO.cup, t, o.sw ?? 20, o.stream); if (o.stream >= 1) IN.sparks(m, c, MO.cup[0], MO.cup[1] - 10, t, o.sparks ?? 24, o.sparkR ?? 160, 3); }
    return { src, C, MO };
  }
  add({
    t0: 25.0, t1: 26.8,
    draw(g, t, lt) {
      const tilt = lerp(0, .95, eio(seg(t, 25.35, 25.72)));
      const pose = t < 25.4 ? FP.lift : FP.pour;
      H.printFrame(g, t, { x: 1000, y: 480, z: 1.32 }, m => pourScene(m, c, t, {
        pose, tilt, stream: seg(t, 25.6667, 25.8), sw: 18, boy: { ...BP.shield, expr: 'wonder' },
        rays: t > 25.6667 ? (m, c, src) => { WC.drawStrokes(m, WC.rays(src[0], src[1], { n: 9, r0: 70, r1: [180, 300], w: 12, seed: 4, jit: .6, reveal: { t0: 25.6667, t1: 25.95 } }), { t }); } : null,
      }), { jolt: H.jolt(lt), seed: 19 });
    },
    events: K => [{ t: K.tongs, type: 'tongs_clank' }, { t: K.pour1, type: 'pour', dur: 1.2 }, { t: K.pour1 + .05, type: 'sizzle', dur: 1.0 }],
  });

  // ---------------------------------------------------------------- S8 · the mould smashed (26.8–28.333)
  add({
    t0: 26.8, t1: 28.3333,
    draw(g, t, lt) {
      const strike = 27.0, pose = t < strike - .12 ? FP.hammerUp : t < strike ? { ...FP.hammerUp, a1: -1.9, a2: -.2, lean: .1 } : FP.hammerDown;
      const brk = t - strike, sh = t >= strike && t < strike + .125 ? [[14, -9], [-10, 6], [5, -3]][Math.floor((t - strike) * 24)] || [0, 0] : [0, 0];
      const rest = t > 27.6 ? FP.hammerRest : pose;
      H.printFrame(g, t, { x: 1010 - sh[0], y: 520 - sh[1], z: 1.12 }, m => {
        IN.drawWorkshop(m, c, t, { noMould: true, fire: .8 });
        FX.bell(m, c, 1250, 800, 380, { lightSide: 'l' });
        IN.mouldBreak(m, brk < 0 ? -1 : brk, { spread: 1 });
        if (brk >= 0 && brk < .5) { const r = mulberry(3 + Math.floor(t * 24)); WC.drawStrokes(m, WC.flecks(Array.from({ length: 30 }, () => [1250 + (r() - .5) * 500 * (brk + .2), 500 + (r() - .3) * 300 + brk * 300, 3 + r() * 5]), { seed: 5 })); }
        drawFounder(m, NORM(1.12, 760, 880), { ...rest, expr: 'focus' });
      }, { jolt: H.jolt(lt), seed: 21 });
    },
    events: K => [{ t: K.smash - .18, type: 'whoosh' }, { t: K.smash, type: 'mould_smash' }, { t: K.smash + .15, type: 'debris', dur: .9 }, { t: K.reveal1, type: 'dust', dur: .6 }],
  });

  // ---------------------------------------------------------------- S8b · the dead note; the crack (28.333–29.667)
  add({
    t0: 28.3333, t1: 29.6667,
    draw(g, t, lt) {
      const z = lerp(1.9, 3.3, eo(seg(t, 28.3333, 28.54)));
      const cr = seg(t, 28.4, 29.6);
      H.printFrame(g, t, { x: 1300, y: 640, z }, m => {
        IN.drawWorkshop(m, c, t, { noMould: true, fire: .6 });
        FX.bell(m, c, 1250, 800, 380, { lightSide: 'l', sp: 3.2, crack: cr });
        // the small hammer's head taps and withdraws
        const hx = 1250 + 250 + 60 * seg(t, 28.36, 28.7), hy = 650;
        WC.drawStrokes(m, WC.cutAlong(WC.offsetPoly(WC.rect(hx - 10, hy - 34, 70, 68), 3), { closed: true, w: 5, seed: 3 }));
        WC.fillPoly(m, [WC.rect(hx - 10, hy - 34, 70, 68), WC.rect(hx + 60, hy - 8, 240, 16)], '#000');
      }, { jolt: H.jolt(lt), seed: 23 });
    },
    events: K => [{ t: K.clunk, type: 'clunk' }, { t: K.clunk + .07, type: 'crack', dur: 1.2 }],
  });

  // ---------------------------------------------------------------- S9 · silence: the village at the door (29.667–32.333)
  let VPOS = null;
  add({
    t0: 29.6667, t1: CUT_C,
    draw(g, t, lt) {
      VPOS = VPOS || [[700, 800, 2.0, 1], [860, 790, 1.8, 0], [990, 812, 1.45, 2], [1120, 796, 1.9, 3], [1260, 806, 1.75, 0]];
      H.printFrame(g, t, { x: 924, y: 456, z: 1 }, m => {
        m.fillStyle = '#000'; m.fillRect(-500, -500, 3000, 2000);
        // outside, framed by the door: night, snow ground, snowfall
        m.save(); m.beginPath(); m.rect(600, 110, 720, 760); m.clip();
        m.fillStyle = '#fff'; m.fillRect(600, 330, 720, 640);
        WC.drawStrokes(m, H.X().doorGround || (H.X().doorGround = WC.hatch(new WC.Region([WC.rect(600, 330, 720, 560)], { res: 3 }), { dir: WC.dirAngle(.02), tone: (x, y) => y < 360 ? .5 : .04 + .22 * ((y - 330) / 560), sp: 10, lo: .3, seed: 3, seg: [40, 160], gap: [20, 60] })), { color: '#000' });
        for (const [x, y, s, k] of VPOS) FX.villager(m, x, y, s, k, .9 + .3 * seg(t, 29.8, 31.5), k % 2 ? -1 : 1);
        WC.drawStrokes(m, WC.flecks(snowAt(buildWorld(), t, { t0: 20, wind: 2.5, fall: .8 }).filter(([x, y]) => x > 560 && x < 1360).map(([x, y, r]) => [x, y, r]), { seed: 4 }));
        m.restore();
        // door jambs + lintel: carved planks
        for (const [x, y, w, h] of [[560, 90, 40, 800], [1320, 90, 40, 800], [560, 70, 800, 40]]) drawPart(m, part('jamb' + x + y, { poly: WC.rect(x, y, w, h), light: WC.light(.6, 0, .3), R: 12, sp: 5, dir: w > h ? 0 : PI / 2, halo: 4, seed: x, lo: .45 }));
        // light spilling on the floor inside
        WC.drawStrokes(m, H.X().spill || (H.X().spill = WC.hatch(new WC.Region([[[600, 870], [1320, 870], [1600, 1000], [380, 1000]]], { res: 3 }), { dir: WC.dirAngle(0), tone: (x, y) => .75 - (y - 870) / 200, sp: 9, lo: .3, seed: 5, seg: [40, 200] })));
        // the founder, from behind, hammer lowering
        const hk = eio(seg(t, 30.0, 31.8));
        drawFounderBack(m, [1.9, 0, 0, 1.9, 360, 1420]);
        m.save(); m.translate(566, 610); m.rotate(lerp(-.55, -.04, hk)); WC.fillPoly(m, [WC.rect(-11, 0, 22, 260), WC.rect(-55, 250, 110, 70)], '#000'); WC.drawStrokes(m, WC.cutAlong([[11, 10], [11, 250], [55, 250], [55, 320]], { w: 4, kind: 'k', seed: 2 })); m.restore();
      }, { jolt: H.jolt(lt), seed: 29 });
    },
    events: K => [{ t: K.silence1, type: 'far_wind', dur: 2.6 }],
  });

  // ---------------------------------------------------------------- S10 · the compass (32.333–36.333)
  // a) silence continues: the open compass in his palm (the needle still points home); his thumb shuts the lid → "click"
  function compassState(lid) {
    if (CMP[lid]) return CMP[lid];
    const { hands } = boyCompass(924, 456, lid);
    const reg = new WC.Region(qq => qq.drawImage(hands, 0, 0, 1848, 912), { res: 2, bbox: [0, 0, 1848, 912] });
    const F = WC.woodcutFilter(hands, { rect: [0, 0, 1848, 912], region: reg, sp: 4.5, black: .05, white: .72, gamma: .9, res: 2, seed: lid.length,
      reveal: lid === 'open' ? { t0: CUT_C, t1: CUT_C + .3, mode: 'light', speed: 1800 } : null });
    return CMP[lid] = F.strokes;
  }
  add({
    t0: CUT_C, t1: 33.0,
    draw(g, t, lt) {
      const lid = t < K_.click - 2 / 24 ? 'open' : t < K_.click ? 'half' : 'shut';
      const hit = t >= K_.click ? t - K_.click : -1;
      H.printFrame(g, t, { x: 924 + 14 * seg(t, CUT_C, 33), y: 456, z: lerp(1.04, 1.12, eio(seg(t, CUT_C, 33))) }, m => {
        m.fillStyle = '#000'; m.fillRect(-500, -500, 3000, 2000);
        WC.drawStrokes(m, coatFolds());
        WC.drawStrokes(m, compassState(lid), { t });
      }, { jolt: H.jolt(hit >= 0 ? hit : lt), seed: 31 });
    },
    events: K => [{ t: K.click, type: 'compass_click' }],
  });
  add({   // b) his face: the decision
    t0: 33.0, t1: 34.5,
    draw(g, t, lt) {
      H.printFrame(g, t, { x: 924, y: 456, z: lerp(1, 1.06, seg(t, 33, 34.5)) }, m => {
        m.fillStyle = '#000'; m.fillRect(-500, -500, 3000, 2000);
        WC.drawStrokes(m, H.X().fireWall || (H.X().fireWall = WC.hatch(new WC.Region([WC.rect(0, 0, 1848, 912)], { res: 6 }), { dir: WC.dirAngle(PI / 2), tone: (x, y) => .55 - x / 3000, sp: 16, lo: .3, seed: 9, seg: [60, 220], gap: [10, 50] })));
        const lift = eio(seg(t, 33.3, 33.9));
        drawBoy(m, NORM(3.6, 827, 1804), { ...BP.stand, head: lerp(.2, -.05, lift), expr: lift > .5 ? 'determined' : 'hesitant' });
        const gl = c.createRadialGradient(1400, 700, 10, 1400, 700, 900); gl.addColorStop(0, 'rgba(0,0,0,.45)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gl; c.fillRect(0, 0, 1848, 912);
      }, { jolt: H.jolt(lt), seed: 33 });
    },
  });
  add({   // c) he throws it
    t0: 34.5, t1: 35.3,
    draw(g, t, lt) {
      const rel = 34.95, pose = t < rel ? BP.throwWind : BP.throwOut;
      H.printFrame(g, t, { x: 820, y: 500, z: 1.25 }, m => {
        IN.drawWorkshop(m, c, t, { noMould: false, fire: 1 });
        crucibleInFire(m, c, .5);
        drawFounder(m, FLIP(1.0, 1180, 812), { ...FP.stand, expr: 'nod', head: .2 });
        const bm = drawBoy(m, NORM(1.15, 560, 812), { ...pose, expr: 'determined' });
        if (t >= rel) { const u = (t - rel) / .35, x = lerp(bm.palm[0] + 30, 220, u), y = lerp(bm.palm[1], 640, u) - Math.sin(u * PI) * 160; if (u < 1) drawCompass(m, x, y, 16, 1e9, u * 9, 0); }
      }, { jolt: H.jolt(lt), seed: 35 });
    },
    events: K => [{ t: 34.95, type: 'throw_whoosh' }],
  });
  add({   // d) into the crucible
    t0: 35.3, t1: 36.3333,
    draw(g, t, lt) {
      H.printFrame(g, t, { x: 924, y: 470 + 40 * eo(seg(t, 35.3, 35.6)), z: 1.2 }, m => {
        m.fillStyle = '#000'; m.fillRect(-500, -500, 3000, 2000);
        FX.crucibleTop(m, 924, 700, 380, 20);
        const u = seg(t, 35.3, 35.5), y = lerp(80, 610, u * u), b = t > 35.5 ? Math.abs(Math.sin(seg(t, 35.5, 35.75) * PI)) * 30 * (1 - seg(t, 35.5, 35.9)) : 0;
        drawCompass(m, 900, y - b, 46, 1e9, t * 4, 0);
      }, { jolt: H.jolt(lt), seed: 37 });
    },
    events: K => [{ t: K.compass_drop, type: 'compass_drop' }],
  });

  // ---------------------------------------------------------------- S11 · the second pour (36.333–41.667)
  add({
    t0: 36.3333, t1: 37.6667,
    draw(g, t, lt) {
      const b = (t - 36.3333) / .3333;             // pumping on eighths
      H.printFrame(g, t, { x: 470, y: 560, z: 1.45, r: -.03 }, m => forgeWide(m, c, t, { pump: st12(b * .3333) / .3333, glow: 1, glowR: 1.4, fire: 1.8 }), { jolt: H.jolt(lt), seed: 41 });
    },
    events: K => [0, 1, 2, 3].map(i => ({ t: K.bellows2 + i * .3333, type: 'bellows', gain: .8 })).concat([{ t: K.bellows2, type: 'fire_roar', dur: 5.4, gain: 1.4 }]),
  });
  add({
    t0: 37.6667, t1: 39.0,
    draw(g, t, lt) {
      H.printFrame(g, t, { x: 660, y: 300, z: lerp(1.55, 1.68, seg(t, 37.67, 39)) }, m => {
        const k = 1.18, FM = NORM(k, 470, 890), me = drawFounder(m, FM, FP.lift, 1e9, { measure: true }), cr = [me.tip[0] + 30, me.tip[1] + 44];
        IN.drawWorkshop(m, c, t, { fire: 1.6, noMould: true });
        drawFounder(m, FM, { ...FP.lift, expr: 'focus' });
        IN.crucible(m, c, cr[0], cr[1], .08 * Math.sin(t * 3), 1);
        const gl = c.createRadialGradient(cr[0], cr[1] - 40, 20, cr[0], cr[1] - 40, 620); gl.addColorStop(0, 'rgba(0,0,0,1)'); gl.addColorStop(.5, 'rgba(0,0,0,.65)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gl; c.fillRect(-500, -500, 3000, 2000);
        IN.sparks(m, c, cr[0], cr[1] - 50, t, 14, 120, 7);
      }, { jolt: H.jolt(lt), seed: 43 });
    },
    events: K => [{ t: K.lift, type: 'tongs_clank' }, { t: K.lift, type: 'molten_bubble', dur: 1.3, gain: 1.3 }],
  });
  add({
    t0: 39.0, t1: 41.6667,
    draw(g, t, lt) {
      const u = eio(seg(t, 39.2, 41.2));
      const cam = { x: lerp(1180, 1000, u), y: lerp(430, 480, u), z: lerp(2.4, 1.18, u) };
      const R0 = 39.3333, flood = ss(seg(t, R0, R0 + .45));
      H.printFrame(g, t, cam, m => pourScene(m, c, t, {
        pose: FP.pour, tilt: .95, stream: seg(t, 39.0, 39.2), sw: 26, sparks: 50, sparkR: 240, fire: 1.4, boy: { ...BP.shield, expr: 'wonder' },
        rays: (m, c, src) => {
          if (t < R0) return;
          WC.drawStrokes(m, H.X().rays2 || (H.X().rays2 = WC.rays(src[0], src[1], { n: 60, r0: 62, r1: [700, 1500], w: 22, seed: 9, jit: .8, bend: .03, reveal: { t0: R0, t1: R0 + .5, jit: .25 } })), { t });
          const q = Math.floor(t * 12), bl = [], br = 104 * ss(seg(t, R0, R0 + .15)); for (let i = 0; i < 48; i++) { const a = i / 48 * PI * 2, r = br + 9 * Math.sin(i * 1.7 + q) + 6 * Math.sin(i * 4.3 - q * 1.3); bl.push([src[0] + Math.cos(a) * r, src[1] + Math.sin(a) * r * .8]); }
          if (br > 5) WC.fillPoly(m, [bl], '#fff');
          const gr = c.createRadialGradient(src[0], src[1], 20, src[0], src[1], 820); gr.addColorStop(0, `rgba(0,0,0,${flood})`); gr.addColorStop(.35, `rgba(0,0,0,${.75 * flood})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = gr; c.fillRect(-2000, -2000, 6000, 6000);
        },
      }), { jolt: H.jolt(lt), seed: 45, reg: t > R0 && t < R0 + .1 ? H.regJolt(t - R0) : [3, 2] });
    },
    events: K => [{ t: K.pour2, type: 'pour', dur: 2.6, gain: 1.5 }, { t: K.pour2 + .05, type: 'sizzle', dur: 2.4, gain: 1.3 }, { t: K.rays2, type: 'rays_carve' }, { t: K.pour2, type: 'sparks', dur: 2.5 }],
  });
  // ---------------------------------------------------------------- S12 · the bell, whole (41.667–43.0)
  function revealScene(m, c, t) {
    IN.drawWorkshop(m, c, t, { noMould: true, fire: .7 });
    const warm = .35 * (1 - seg(t, 41.7, 43.0)) + .1;
    IN.steam(m, 1250, 800, t, 1 - seg(t, 42.3, 43.0) * .7);          // behind the bell: only wisps escape past its edges
    FX.bell(m, c, 1250, 800, 380, { lightSide: 'l', warm, glow: .6 });
    IN.mouldBreak(m, Math.max(-1, (t - 41.75) * .8), { spread: .6, seed: 8 });
    drawFounder(m, NORM(1.12, 700, 880), { ...FP.nod, expr: 'nod' });
    drawBoy(m, FLIP(1.2, 1720, 880), { ...BP.lookUp, expr: 'wonder', head: -.25 });
  }
  add({
    t0: 41.6667, t1: 43.0,
    draw(g, t, lt) { H.printFrame(g, t, { x: 1150, y: 520, z: 1.12 }, m => revealScene(m, c, t), { jolt: H.jolt(lt), seed: 47 }); },
    events: K => [{ t: K.reveal2, type: 'steam', dur: 1.6 }, { t: K.reveal2 + .15, type: 'debris', dur: 1.0, gain: .6 }],
  });

  // ---------------------------------------------------------------- the valley with the bell (end)
  const BELL = { x: BELFRY.x, y: BELFRY.y + 38, h: 62 };
  function valleyBell(m, c, t, o = {}) {
    drawValley(m, c, 9, { bell: (m, c) => FX.bell(m, c, BELL.x, BELL.y, BELL.h, { sp: .9, lightSide: 'l', glow: o.glow ?? 0, clapper: o.clapper ?? 0 }), figures: o.figures });
    if (o.rope) { WC.drawStrokes(m, H.X().rope || (H.X().rope = WC.cutAlong([[BELL.x + 4, BELL.y - 30], [BELL.x + 10, 460], [BELL.x + 30, 640], [BELL.x + 60, 690]], { w: 2.6, kind: 'k', seed: 3 }))); }
  }
  function towerCrowd(m) { [[1100, 700, .32, 0], [1150, 706, .3, 1], [1200, 704, .34, 3], [1260, 708, .3, 2], [1300, 702, .32, 1], [1070, 710, .28, 2]].forEach(([x, y, s, k]) => FX.villager(m, x, y, s, k, .2)); drawFounder(m, NORM(.15, 1230, 712), FP.ropeUp); drawBoy(m, NORM(.15, 1255, 712), BP.ropeUp); }
  function snowFlakes(m, t, o = {}) {
    const fl = snowAt(buildWorld(), t, { t0: 9, freeze: o.freeze ?? 1e9 });
    const r = mulberry(99), keep = [];
    for (const [x, y, rr] of fl) { const die = 52.5 + r() * 2.0; if (t < die) keep.push([x, y, rr]); }
    WC.drawStrokes(m, WC.flecks(keep, { seed: 3 }));
  }
  function towerPage(tg, t, lt) {
    H.printFrame(tg, t, { x: 1190, y: 440, z: 2.1 }, m => { valleyBell(m, c, t, { rope: 1, figures: towerCrowd }); snowFlakes(m, t); }, { seed: 51, jolt: lt != null ? H.jolt(lt) : [0, 0] });
  }
  // ---------------------------------------------------------------- S13 · page turn → the tower (43.0–44.333)
  add({
    t0: 43.0, t1: 44.3333,
    draw(g, t) {
      const X = H.X(), [ob, oq] = H.buf(0), [nb, nq] = H.buf(1), [bb, bq] = H.buf(2);
      H.printFrame(oq, 43.0, { x: 1150, y: 520, z: 1.12 }, m => revealScene(m, c, 43.0), { seed: 47 });
      towerPage(nq, t);
      g.drawImage(nb, 0, 0);
      // back of the turning sheet: paper with the print showing through, mirrored
      bq.globalAlpha = 1; bq.drawImage(PAPER(), 0, 0); bq.save(); bq.globalCompositeOperation = 'multiply'; bq.globalAlpha = .3; bq.setTransform(-1, 0, 0, 1, W, 0); bq.drawImage(ob, 0, 0); bq.restore();
      const { xf, r } = peelState(seg(t, 43.0, 44.2), 200);
      curl(g, ob, bb, xf, r, { F: 1900 });
    },
    events: K => [{ t: K.pull2, type: 'peel', dur: 1.2 }, { t: K.pull2 + .1, type: 'wind_ext', dur: 1.2 }],
  });
  let PAPERC = null;
  function PAPER() {
    if (PAPERC) return PAPERC;
    m.setTransform(1, 0, 0, 1, 0, 0); m.fillStyle = '#fff'; m.fillRect(0, 0, W, H); c.clearRect(0, 0, W, H);
    const out = H.X().printer.render(ST.M, ST.C, { seed: 13 }); const [cv, q] = WC.canvas(); q.drawImage(out, 0, 0); return PAPERC = cv;
  }
  function ropeFist(m, rx, cy, k, who, close) {
    const L = WC.light(.6, -.5, .45), sk = { white: true, outline: 4.5 * k, sp: 4.5, R: 26 * k, amb: who === 'B' ? .22 : .08, lo: .45, halo: 6, light: L };
    // sleeve + back of the hand, left of the rope
    drawPart(m, part('rs' + who, { poly: [[rx - 900 * k, cy - 170 * k], [rx - 330 * k, cy - 150 * k], [rx - 300 * k, cy + 150 * k], [rx - 900 * k, cy + 190 * k]], light: WC.light(.6, -.3, .3), R: 30, sp: 8, dir: PI / 2 + .15, halo: 6, seed: who.charCodeAt(0), lo: .35, feats: [{ cp: [[rx - 340 * k, cy - 140 * k], [rx - 312 * k, cy + 140 * k]], w: 5 }] }));
    drawPart(m, part('rb' + who, { poly: WC.spline([[rx - 340 * k, cy - 140 * k], [rx - 150 * k, cy - 150 * k], [rx - 40 * k, cy - 120 * k], [rx - 30 * k, cy + 110 * k], [rx - 160 * k, cy + 150 * k], [rx - 330 * k, cy + 140 * k]], 6, true), ...sk, seed: 80 + who.charCodeAt(0),
      feats: who === 'F' ? [{ cp: [[rx - 300 * k, cy - 60 * k], [rx - 200 * k, cy - 70 * k], [rx - 90 * k, cy - 50 * k]], w: 3 }, { cp: [[rx - 290 * k, cy + 10 * k], [rx - 190 * k, cy], [rx - 90 * k, cy + 15 * k]], w: 3 }, { cp: [[rx - 250 * k, cy - 110 * k], [rx - 240 * k, cy + 100 * k]], w: 2.2 }] : [] }));
    // four fingers wrapping across the rope, stacked
    for (let i = 0; i < 4; i++) {
      const y = cy - 105 * k + i * 70 * k, ext = lerp(60, 150, close) * k;
      drawPart(m, part('rf' + who + i + (close > .5 ? 1 : 0), { poly: WC.spline([[rx - 60 * k, y - 30 * k], [rx + ext * .7, y - 32 * k], [rx + ext, y - 12 * k], [rx + ext, y + 14 * k], [rx + ext * .7, y + 32 * k], [rx - 60 * k, y + 30 * k]], 5, true), ...sk, seed: 90 + i,
        feats: [{ cp: [[rx + 20 * k, y - 26 * k], [rx + 28 * k, y], [rx + 20 * k, y + 26 * k]], w: 2.6 * k }, { cp: [[rx + ext * .75, y - 22 * k], [rx + ext * .8, y + 22 * k]], w: 2 * k }] }));
    }
    // the thumb over the top finger
    drawPart(m, part('rt' + who, { poly: WC.spline([[rx - 150 * k, cy - 150 * k], [rx - 20 * k, cy - 185 * k], [rx + 90 * k, cy - 170 * k], [rx + 100 * k, cy - 130 * k], [rx - 10 * k, cy - 110 * k], [rx - 140 * k, cy - 100 * k]], 5, true), ...sk, seed: 99 }));
  }
  // ---------------------------------------------------------------- S14 · the longest silence (44.333–47.333)
  add({ t0: 44.3333, t1: 45.3333, draw(g, t, lt) { towerPage(g, t); } });
  add({   // two hands on the rope
    t0: 45.3333, t1: 46.3333,
    draw(g, t, lt) {
      H.printFrame(g, t, { x: 924, y: 456, z: 1 }, m => {
        m.fillStyle = '#000'; m.fillRect(-500, -500, 3000, 2000);
        WC.drawStrokes(m, coatFolds());
        // the rope: a twisted white cut with black lay lines
        m.fillStyle = '#fff'; m.fillRect(880, -20, 90, 960);
        const lay = []; for (let y = -20; y < 940; y += 26) lay.push(WC.mkStroke([[880, y], [925, y + 17], [970, y + 34]], 5, { kind: 'k', seed: y })); WC.drawStrokes(m, lay, { color: '#000' });
        // the old hand (above) wraps the rope; the boy's small hand slides in below and closes
        ropeFist(m, 925, 300, 1.0, 'F', 1);
        const u = eo(seg(t, 45.6, 46.0));
        if (u > 0) { m.save(); m.translate(lerp(-520, 0, u), 0); ropeFist(m, 925, 640, .72, 'B', clamp((u - .6) / .4)); m.restore(); }
      }, { jolt: H.jolt(lt), seed: 53 });
    },
    events: K => [],
  });
  add({ t0: 46.3333, t1: 47.3333, draw(g, t, lt) { H.printFrame(g, t, { x: BELL.x, y: BELL.y - 20, z: 5.2 }, m => { valleyBell(m, c, t, { clapper: 0 }); snowFlakes(m, t); }, { jolt: H.jolt(lt), seed: 55 }); } });

  // ---------------------------------------------------------------- S15–16 · the bell rings; the valley listens (47.333–54.4)
  const TB = 47.3333;
  add({
    t0: TB, t1: 54.4,
    draw(g, t, lt) {
      const u = seg(t, TB, TB + 5.0), e = 1 - Math.pow(1 - u, 2.6);
      const z = Math.exp(lerp(Math.log(5.2), 0, e));
      const cam = { x: lerp(BELL.x, PW / 2, e), y: lerp(BELL.y - 20, PH / 2, e), z };
      const sw = t - TB, clap = sw < .06 ? -.32 : -.32 * Math.cos(sw * 5.2) * Math.exp(-sw * .9);
      const flash = t < TB + .12 ? regJ(t - TB) : [3, 2];
      H.printFrame(g, t, cam, m => {
        valleyBell(m, c, t, { clapper: clap, glow: ss(seg(t, TB + .6, TB + 2.4)) });
        FX.rings(m, BELL.x, BELL.y - 20, sw, { n: 5, speed: 330, gap: .55, w: 4.5, max: 2000 });
        snowFlakes(m, t, { freeze: TB });
        // the copper retreats from the whole valley into the bell
        const rr = lerp(2600, 20, ss(seg(t, TB + .2, TB + 2.6)));
        if (rr > 30) { const gr = c.createRadialGradient(BELL.x, BELL.y - 30, 0, BELL.x, BELL.y - 30, rr); gr.addColorStop(0, 'rgba(0,0,0,.9)'); gr.addColorStop(.7, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(-3000, -3000, 9000, 9000); }
      }, { seed: 57, reg: flash });
    },
    events: K => [{ t: K.bell, type: 'bell' }, { t: K.echo1, type: 'echo', gain: .5 }, { t: K.echo2, type: 'echo', gain: .3 }, ...Array.from({ length: 14 }, (_, i) => ({ t: 52.6 + i * .12 + (i % 3) * .03, type: 'ink_dot', gain: .5 - i * .025 }))],
  });
  const regJ = lt => lt < 1 / 24 ? [9, -5] : lt < 2 / 24 ? [5, 1] : [3, 2];

  // ---------------------------------------------------------------- S17 · end card (54.4–58.5)
  let END = null;
  function endStrokes() {
    if (END) return END;
    END = {};
    END.rule = WC.cutAlong([[560, 432], [1290, 432]], { w: 5, kind: 'v', seg: [900, 1000], seed: 7, reveal: { t0: 55.0, t1: 55.55, speed: 1400 } });
    END.bell = true;
    return END;
  }
  function endPage(tg, t) {
    const E = endStrokes();
    H.printFrame(tg, t, { x: 924, y: 456, z: 1 }, m => {
      m.fillStyle = '#fff'; m.fillRect(-500, -500, 3000, 2000);
      // a black block panel: the title carved into it
      m.fillStyle = '#000'; m.fillRect(420, 232, 1008, 280);
      m.save(); m.font = '400 84px "IM Fell English SC"'; m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillStyle = '#fff'; m.fillText('THE BELL FOUNDER', 924, 350); m.restore();
      WC.drawStrokes(m, E.rule, { t });
      FX.bell(m, c, 924, 222, 170, { glow: 1, lightSide: 'l', sp: 2.4 });
      // letterpress lines on the paper
      const a = ss(seg(t, 55.6, 55.9)), b = ss(seg(t, 56.0, 56.3));
      m.save(); m.textAlign = 'center'; m.textBaseline = 'middle';
      m.font = 'italic 400 46px "IM Fell English"'; m.fillStyle = `rgba(0,0,0,${a})`; m.fillText('A Woodcut Print', 924, 572);
      m.font = '400 38px "IM Fell English SC"'; m.fillText('Lemo-Opuscar', 924, 640);
      m.font = '400 34px "IM Fell English"'; m.fillText('LemoLab × Claude Opus 5.5', 924, 690);
      m.font = 'italic 400 24px "IM Fell English"'; m.fillStyle = `rgba(0,0,0,${b})`;
      m.fillText('Voice: Kokoro (am_onyx) · Samples: VS Chamber Orchestra CE & VCSL, CC0 (Versilian Studios)', 924, 764);
      m.fillText('Type: IM Fell English, SIL OFL (Igino Marini) · Walnut table: Poly Haven, CC0 · everything else carved in code', 924, 798);
      m.restore();
    }, { seed: 61, noCap: true });
    // the bell's copper line stays: a small bell carved over the title block
  }
  add({
    t0: 54.4, t1: 58.5,
    draw(g, t, lt) {
      const [nb, nq] = H.buf(1);
      endPage(nq, t);
      if (t >= 55.0) { g.drawImage(nb, 0, 0); return; }
      const [ob, oq] = H.buf(0), [bb, bq] = H.buf(2);
      H.printFrame(oq, t, { x: PW / 2, y: PH / 2, z: 1 }, m => { valleyBell(m, c, t, { glow: 1 }); snowFlakes(m, t, { freeze: TB }); }, { seed: 57 });
      g.drawImage(nb, 0, 0);
      bq.drawImage(PAPER(), 0, 0); bq.save(); bq.globalCompositeOperation = 'multiply'; bq.globalAlpha = .3; bq.setTransform(-1, 0, 0, 1, W, 0); bq.drawImage(ob, 0, 0); bq.restore();
      const { xf, r } = peelState(seg(t, 54.4, 55.0), 180);
      curl(g, ob, bb, xf, r, { F: 1900 });
    },
    events: K => [{ t: 54.4, type: 'peel', dur: .6 }, { t: K.endcard, type: 'knife_bite' }, { t: K.endcard, type: 'knife_run', dur: .55 }],
  });
}
