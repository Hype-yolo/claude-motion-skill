// Test and sheet scenes (?scene=sheets.xxx)
import { shoot, gate, FW, FH } from './stage.js';
import { drawFigure, P0, runPose, runBob, walkPose, mixPose } from './engine/figure.js';
import { OTTO, GIRL, COP, SELLER, drawLoaf } from './chars.js';
import { form, grey, V, mottle } from './engine/ink.js';

export function test(g, t) {
  const dev = shoot(fg => {
    fg.fillStyle = grey(.86); fg.fillRect(0, 0, FW, FH);
    fg.fillStyle = grey(.7); fg.fillRect(0, 900, FW, 180);
    const s = 105;
    [0, 45, 90, 180].forEach((yaw, i) => drawFigure(fg, OTTO, { x: 170 + i * 260, ground: 880, scale: s, yaw, pose: P0(), t }));
    drawFigure(fg, OTTO, { x: 1200, ground: 880, scale: s, yaw: 90, pose: runPose(.15), t });
  }, { frame: 0, strength: .3, sepia: .15 });
  gate(g, dev);
}
export function heads(g, t) {
  const dev = shoot(fg => {
    fg.fillStyle = grey(.86); fg.fillRect(0, 0, FW, FH);
    const s = 300;
    [0, 45, 90].forEach((yaw, i) => drawFigure(fg, OTTO, { x: 250 + i * 470, y: 1500, scale: s, yaw, pose: P0(), t }));
  }, { frame: 0, strength: .2, sepia: .15 });
  gate(g, dev);
}

import { Redraw } from './engine/redraw.js';
let _rd = null; const rd = () => _rd || (_rd = new Redraw(1440, 1080));
const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
export async function redrawTest(g, t, q) {
  const img = await loadImg('assets/redraw_src.jpg');
  const out = rd().render(img, { frame: 0, bilateral: 3, sigma: 1.3, p: 24, eps: .28, phi: 5, gamma: .9, washDark: .2, h1: .55, h2: .72, h3: .88, gap: 5 });
  const dev = shoot(fg => { fg.drawImage(out, 0, 0); }, { frame: 3, strength: .5, sepia: .15 });
  gate(g, dev);
}
export function redrawFig(g, t) {
  // our own tonal drawing through the same redraw
  const dev0 = document.createElement('canvas'); dev0.width = FW; dev0.height = FH; const c = dev0.getContext('2d');
  c.fillStyle = grey(.86); c.fillRect(0, 0, FW, FH); c.fillStyle = grey(.7); c.fillRect(0, 900, FW, 180);
  const s = 105;
  [0, 45, 90, 180].forEach((yaw, i) => drawFigure(c, OTTO, { x: 170 + i * 260, ground: 880, scale: s, yaw, pose: P0(), t }));
  drawFigure(c, OTTO, { x: 1200, ground: 880, scale: s, yaw: 90, pose: runPose(.15), t });
  const out = rd().render(dev0, { frame: 0 });
  const dev = shoot(fg => { fg.drawImage(out, 0, 0); }, { frame: 3, strength: .4, sepia: .15 });
  gate(g, dev);
}

// arm / shoulder test: Otto in key arm poses at a large scale, through the Redraw pass (?scene=sheets.armTest)
import { OTTO as _O, GIRL as _G } from './chars.js';
import { pose as _pose, EXPR as _E } from './poses.js';
import { P0 as _P0, runPose as _run, drawFigure as _df } from './engine/figure.js';
import { Redraw as _RD } from './engine/redraw.js';
import { setFrame as _sf, grey as _grey } from './engine/ink.js';
let _rdA = null;
export function armTest(g, t, q) {
  _sf(0, { boil: 0 });
  const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const x = c.getContext('2d');
  x.fillStyle = _grey(.9); x.fillRect(0, 0, 1920, 1080);
  const side = () => { const p = _P0(); p.aL = { fl: .2, abd: 1.4, el: .3, wr: 0, hand: 'open' }; p.aR = { fl: .1, abd: .2, el: .2, wr: 0, hand: 'relax' }; return p; };
  const reach = () => { const p = _P0(); p.lean = .15; p.aL = { fl: 1.4, abd: .1, el: .1, wr: 0, hand: 'open' }; return p; };
  const L = [[_pose('lift'), 15], [_pose('lift'), 70], [_pose('carry'), 70], [reach(), 80], [side(), 0], [_run(.3), 90], [_pose('kneel'), 60]];
  L.forEach(([p, yaw], i) => _df(x, _O, { x: 140 + i * 270, ground: 1040, scale: 104, yaw, pose: p, t: 0 }));
  _rdA = _rdA || new _RD(1920, 1080);
  g.drawImage(q.raw ? c : _rdA.render(c, { frame: 0 }), 0, 0);
}
import { drawBoule as _db, drawBouleHalf as _dbh } from './chars.js';
import { bouleInHands as _bih, bouleHalves as _bh } from './poses.js';
export function loafTest(g, t, q) {
  _sf(0, { boil: 0 });
  const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const x = c.getContext('2d');
  x.fillStyle = _grey(.9); x.fillRect(0, 0, 1920, 1080);
  for (let i = 0; i < 3; i++) _db(x, 1450 + i * 150, 120, 60, i * .7);
  _dbh(x, 1500, 280, 60, 0); _dbh(x, 1650, 280, 60, Math.PI);
  const lift = _pose('lift'), carry = _pose('carry');
  _df(x, _O, { x: 200, ground: 1040, scale: 104, yaw: 15, pose: lift, t: 0, props: { between: _bih() } });
  _df(x, _O, { x: 520, ground: 1040, scale: 104, yaw: 70, pose: lift, t: 0, props: { between: _bih() } });
  _df(x, _O, { x: 850, ground: 1040, scale: 104, yaw: 20, pose: carry, t: 0, props: { between: _bih() } });
  _df(x, _O, { x: 1180, ground: 1040, scale: 104, yaw: 75, pose: carry, t: 0, props: { between: _bih() } });
  const k = _pose('kneel'); k.aL.abd = .6; k.aR.abd = .6;
  _df(x, _O, { x: 1560, ground: 1040, scale: 104, yaw: 60, pose: k, t: 0, props: _bh(.42) });
  _rdA = _rdA || new _RD(1920, 1080);
  g.drawImage(q.raw ? c : _rdA.render(c, { frame: 0 }), 0, 0);
}
