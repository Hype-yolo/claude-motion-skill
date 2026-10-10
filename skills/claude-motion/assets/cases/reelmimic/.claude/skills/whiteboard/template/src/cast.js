// cast.js: the whiteboard engine's doodle characters. Two originals:
//   bo(x, y, u, o)     a round-headed kid in a shirt (noodle limbs, a black mop of hair with one curl)
//   mochi(x, y, u, o)  a small round cat with one orange ear and an orange-tipped tail
// x,y = the point between the feet on the ground (world px); u = size unit (Bo is ~10.5u tall, Mochi ~7.8u).
// Common options:
//   face: an EXPR name ('neutral','happy','laugh','sad','cry','angry','surprised','scared','love','sleepy','thinking',
//         'wink','proud','confused','excited','dizzy')    look: [lx, ly] eye direction (-1..1)
//   view: 0 front … 1 side (facing right; flip: true faces left)       sq: squash (+) / stretch (-)   dy: lift in u
//   arm: [[angle, bend], [angle, bend]] (degrees; 0 = hanging down, + = outward/forward and up; bend + = elbow up)
//   leg: [[angle, bend], ...] (Bo only)    walk: phase in cycles (use stroll())   tilt: head tilt (radians)
//   hold: { R: 'bulb' | 'phone' | … | fn(x,y,u,key) → strokes, L: … }   emote: '!', '?', 'zzz', 'hearts', 'sweat', …
//   draw: [a, b] → the character is drawn on between a and b (the hand follows), then stays; hand: false hides the hand
//   shirt: colour      w: line width     t: time for blinks/idles (defaults to the video time)    blink: true forces a blink
//   id: wobble seed (give two copies of the same character different ids)
// Returns { hand: { L: [x,y], R: [x,y] }, head: [x,y], top: [x,y], strokes }.
// mood(lt, [[t,'face'], ...]) → { face, sq, dy, blink }: acted expression changes (blink + take on each change).
// stroll(lt, t0, t1, x0, x1, u) → { x, walk, flip, moving }: walk from x0 to x1 between t0 and t1.

const EXPR = {
  neutral: { eyes: 'dot', mouth: 'small' },
  happy: { eyes: 'happy', mouth: 'smile', blush: 1 },
  laugh: { eyes: 'happy', mouth: 'open', blush: 1, fx: 'lines' },
  sad: { eyes: 'dot', brows: 'sad', mouth: 'frown', look: [0, .5] },
  cry: { eyes: 'closed', brows: 'sad', mouth: 'wail', fx: 'tears' },
  angry: { eyes: 'dot', brows: 'angry', mouth: 'grit', fx: 'anger' },
  surprised: { eyes: 'big', brows: 'up', mouth: 'o' },
  scared: { eyes: 'tiny', brows: 'sad', mouth: 'wavy', fx: 'sweat' },
  love: { eyes: 'heart', mouth: 'smile', blush: 1, fx: 'hearts' },
  sleepy: { eyes: 'line', mouth: 'osmall', fx: 'zzz' },
  thinking: { eyes: 'dot', brows: 'think', mouth: 'side', look: [.5, -.6], fx: '?' },
  wink: { eyes: 'wink', mouth: 'smile', blush: 1 },
  proud: { eyes: 'happy', brows: 'up', mouth: 'smirk', fx: 'sparkle' },
  confused: { eyes: 'uneven', brows: 'think', mouth: 'wavy', fx: '?' },
  excited: { eyes: 'big', brows: 'up', mouth: 'open', blush: 1, fx: '!' },
  dizzy: { eyes: 'x', mouth: 'wavy', fx: 'swirl' },
};
const EXPR_NAMES = Object.keys(EXPR);

// automatic blinks: ~every 3.4 s, 0.1 s long, desynchronised by seed
function blinkAt(t, seed = 0) { const p = 3.4, s = t + seed * 1.37, k = Math.floor(s / p), ph = s - k * p - hash(k * 3.1 + seed) * 2; return ph >= 0 && ph < .1; }
function mood(lt, keys, amt = .6) {
  let i = 0; while (i + 1 < keys.length && lt >= keys[i + 1][0]) i++;
  let sq = 0, dy = 0, blink = false;
  for (let j = 1; j < keys.length; j++) { const tk = keys[j][0]; if (lt > tk - .08 && lt < tk + .04) blink = true; const k = take(lt, tk, keys[j][2] ?? amt); sq += k.sq; dy += k.dy; }
  return { face: keys[i][1], sq, dy, blink };
}
function stroll(lt, t0, t1, x0, x1, u, cycle = 4.4) {
  const k = seg(lt, t0, t1), e = lerp(k, ease(k), .5), x = lerp(x0, x1, e), moving = lt > t0 && lt < t1;
  return { x, walk: moving ? Math.abs(x - x0) / (u * cycle) : null, flip: x1 < x0, moving };
}

// ---------- shared building blocks ----------
function _rig(x, y, u, o, id) {
  const f = o.flip ? -1 : 1, sq = o.sq || 0, sx = u * (1 + sq), sy = u * (1 - sq), dyy = (o.dy || 0) * u;
  const P = (lx, ly) => [x + f * lx * sx, y + ly * sy + dyy];
  const lw = o.w || clamp(u * .46, 3.5, 20), out = [];
  const add = (st, z) => { for (const s of flatStrokes(st)) { s.z = z; out.push(s); } };
  const line = (k, pts, z = 0, q = {}) => add(S.path(pts.map(p => P(...p)), { key: id + k, wob: u * .035, bow: 0, w: lw, ...q }), z);
  const loop = (k, pts, z = 0, q = {}) => add(S.path(pts.map(p => P(...p)), { key: id + k, wob: u * .03, bow: 0, w: lw, closed: true, ...q }), z);
  const fill = (pts, col, z, q = {}) => add(S.fill(catmull(pts.map(p => P(...p)), true, 8), { col, mode: 'cover', alpha: 1, shift: [u * .1, u * .07], ...q }), z);
  const ell = (cx, cy, rx, ry, n = 22) => { const p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; p.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return p; };
  return { f, P, lw, out, add, line, loop, fill, ell, u, id };
}
// limb: start S (local), upper length l1 at angle a (deg from down, + toward dir), forearm l2 at a+b
function _limb(Sx, Sy, dir, a, b, l1, l2) {
  const r1 = a * Math.PI / 180, r2 = (a + b) * Math.PI / 180, E = [Sx + dir * l1 * Math.sin(r1), Sy + l1 * Math.cos(r1)];
  return { E, H: [E[0] + dir * l2 * Math.sin(r2), E[1] + l2 * Math.cos(r2)], ang: r2 };
}
// the face: eyes, brows, mouth, blush and effects around the head. (fx,fy) face centre, sep eye spacing, head = [hx,hy,hr]
function _face(R, fx, fy, sep, e, o, head, cat) {
  const { line, add, P, lw, u, id } = R, lk = o.look || e.look || [0, 0], eyes = e.eyes;
  const ew = lw * .95, dotR = u * .3, faceZ = 4;
  [-1, 1].forEach(s => {
    const ex = fx + s * sep + lk[0] * .16, ey = fy + lk[1] * .14, k = 'e' + s;
    let ty = eyes; if (ty === 'wink') ty = s < 0 ? 'dot' : 'happy'; if (ty === 'uneven') ty = s < 0 ? 'dot' : 'big';
    if (o.blink && ['dot', 'big', 'tiny', 'uneven', 'wink'].includes(e.eyes)) ty = 'line';
    if (ty === 'dot') add(S.dot(...P(ex, ey), dotR * 1.02, {}), faceZ);
    else if (ty === 'big' || ty === 'tiny') {
      add(S.fill(catmull(R.ell(ex, ey - .05, .52, .6).map(p => P(...p)), true, 8), { col: '#FFFFFF', mode: 'cover', alpha: 1, z: faceZ - .2 }), faceZ - .2);
      line(k + 'o', R.ell(ex, ey - .05, .52, .6, 16).concat([R.ell(ex, ey - .05, .52, .6, 16)[0]]), faceZ, { w: ew * .8 });
      add(S.dot(...P(ex + lk[0] * .18, ey + lk[1] * .18), ty === 'big' ? u * .24 : u * .12), faceZ + .1);
    }
    else if (ty === 'happy') line(k, [[ex - .38, ey + .14], [ex, ey - .22], [ex + .38, ey + .14]], faceZ, { w: ew });
    else if (ty === 'closed') line(k, [[ex - .38, ey - .06], [ex, ey + .18], [ex + .38, ey - .06]], faceZ, { w: ew });
    else if (ty === 'line') line(k, [[ex - .36, ey + .02], [ex + .36, ey + .02]], faceZ, { w: ew });
    else if (ty === 'x') { line(k + 'a', [[ex - .3, ey - .3], [ex + .3, ey + .3]], faceZ, { w: ew * .9 }); line(k + 'b', [[ex + .3, ey - .3], [ex - .3, ey + .3]], faceZ, { w: ew * .9 }); }
    else if (ty === 'heart') { const [hx, hy] = P(ex, ey); add([S.heart(hx, hy, u * 1.05, { key: id + k, col: INK.red, w: ew * .8 }), S.fill(polyCircle(hx, hy - u * .05, u * .36, u * .3), { col: INK.red, alpha: .9 })], faceZ); }
    // brows
    const b = e.brows, inner = -s;
    if (b === 'up') line(k + 'b', [[ex - .34, ey - .86], [ex, ey - 1.06], [ex + .34, ey - .86]], faceZ, { w: ew * .85 });
    else if (b === 'angry') line(k + 'b', [[ex - inner * .46, ey - 1.0], [ex + inner * .34, ey - .62]], faceZ, { w: ew });
    else if (b === 'sad') line(k + 'b', [[ex - inner * .44, ey - .66], [ex + inner * .34, ey - .98]], faceZ, { w: ew * .9 });
    else if (b === 'think') line(k + 'b', s < 0 ? [[ex - .34, ey - .78], [ex + .3, ey - .8]] : [[ex - .34, ey - .9], [ex, ey - 1.14], [ex + .34, ey - .98]], faceZ, { w: ew * .85 });
    if (e.blush) add(S.line(...P(ex - .3 + s * .12, fy + .72), ...P(ex + .3 + s * .12, fy + .6), { key: id + k + 'bl', hl: true, col: HL.pink, w: u * .4, alpha: .75, wob: 0 }), faceZ - .5);
    if (e.fx === 'tears') { const tt = frac((o.t ?? T) * 1.6 + (s > 0 ? .5 : 0)); line(k + 'tr', [[ex + s * .1, ey + .25], [ex + s * .28, ey + .9], [ex + s * .22, ey + 1.6]], faceZ, { col: INK.blue, w: ew * .9 });
      add(S.dot(...P(ex + s * .25, ey + 1.7 + tt * 1.6), u * .16, { col: INK.blue, alpha: 1 - tt }), faceZ); }
  });
  // mouth
  const m = e.mouth, mx = fx + lk[0] * .1, my = fy + 1.05, q = { w: ew };
  const dark = (pts, k) => { add(S.fill(catmull(pts.map(p => P(...p)), true, 6), { col: INK.black, mode: 'cover', alpha: 1 }), faceZ); line(k, [...pts, pts[0]], faceZ + .1, { w: ew * .8, closed: true }); };
  if (cat && (m === 'small' || m === 'smile')) { line('mw', [[mx - .5, my - .12], [mx - .25, my + (m === 'smile' ? .2 : .1)], [mx, my - .06], [mx + .25, my + (m === 'smile' ? .2 : .1)], [mx + .5, my - .12]], faceZ, q); }
  else if (m === 'small') line('m', [[mx - .3, my], [mx, my + .12], [mx + .3, my]], faceZ, q);
  else if (m === 'smile') line('m', [[mx - .62, my - .12], [mx, my + .36], [mx + .62, my - .12]], faceZ, q);
  else if (m === 'frown') line('m', [[mx - .5, my + .24], [mx, my - .1], [mx + .5, my + .24]], faceZ, q);
  else if (m === 'side') line('m', [[mx - .1, my + .04], [mx + .45, my - .1]], faceZ, q);
  else if (m === 'smirk') line('m', [[mx - .5, my], [mx + .05, my + .2], [mx + .5, my - .18]], faceZ, q);
  else if (m === 'wavy') line('m', [[mx - .55, my + .05], [mx - .28, my - .1], [mx, my + .05], [mx + .28, my - .1], [mx + .55, my + .05]], faceZ, { w: ew * .85 });
  else if (m === 'o') dark(R.ell(mx, my + .1, .3, .38, 12), 'm');
  else if (m === 'osmall') dark(R.ell(mx, my + .05, .16, .2, 10), 'm');
  else if (m === 'open') { const pts = [[mx - .7, my - .15], [mx - .35, my + .5], [mx, my + .72], [mx + .35, my + .5], [mx + .7, my - .15], [mx, my - .1]]; dark(pts, 'm'); add(S.fill(catmull(R.ell(mx, my + .45, .3, .16, 10).map(p => P(...p)), true, 6), { col: INK.red, mode: 'cover', alpha: 1 }), faceZ + .05); }
  else if (m === 'wail') dark([[mx - .5, my + .45], [mx - .3, my + .02], [mx, my - .1], [mx + .3, my + .02], [mx + .5, my + .45], [mx, my + .6]], 'm');
  else if (m === 'grit') { line('m', [[mx - .55, my - .16], [mx + .55, my - .16], [mx + .55, my + .2], [mx - .55, my + .2], [mx - .55, my - .16]], faceZ, { w: ew * .8, straight: true }); line('m2', [[mx - .5, my + .02], [mx + .5, my + .02]], faceZ, { w: ew * .6 }); }
  // effects around the head
  const [hx, hy, hr] = head, tt = o.t ?? T, fx2 = e.fx || o.emote, side = 1, em = o.emote || fx2;
  const ex = hx + side * hr * .95, ey = hy - hr * 1.0;
  const eq = { w: lw * .9 };
  if (em === 'anger') { const c = [hx + hr * .78, hy - hr * .78]; [0, 1, 2, 3].forEach(i => { const a = i * Math.PI / 2 + Math.PI / 4; line('an' + i, [[c[0] + Math.cos(a) * .5 - Math.sin(a) * .2, c[1] + Math.sin(a) * .5 + Math.cos(a) * .2], [c[0] + Math.cos(a) * .2, c[1] + Math.sin(a) * .2], [c[0] + Math.cos(a) * .5 + Math.sin(a) * .2, c[1] + Math.sin(a) * .5 - Math.cos(a) * .2]], 7, { col: INK.red, w: lw * .8 }); }); }
  if (em === 'sweat') { const d = [hx + hr * .92, hy - hr * .35 + frac(tt * .8) * .6]; line('sw', [[d[0], d[1] - .6], [d[0] + .3, d[1] + .05], [d[0], d[1] + .3], [d[0] - .3, d[1] + .05], [d[0], d[1] - .6]], 7, { col: INK.blue, w: lw * .75 }); }
  if (em === 'hearts') [0, 1].forEach(i => { const k = frac(tt * .6 + i * .5), [px, py] = P(hx + (i ? 1.4 : -1.2) + Math.sin(k * 6 + i) * .25, hy - hr - .4 - k * 2.2); if (k < .9) add([S.heart(px, py, u * (.8 + .3 * i), { key: id + 'hh' + i, col: INK.red, w: lw * .7 }), S.fill(polyCircle(px, py - u * .05, u * .28 * (1 + .3 * i), u * .22 * (1 + .3 * i)), { col: INK.red, alpha: .85 })], 7); });
  if (em === 'zzz') [0, 1, 2].forEach(i => { const k = frac(tt * .45 + i / 3), s = .35 + k * .4, zx = hx + hr * .7 + k * 1.6, zy = hy - hr - .2 - k * 2.4; if (k < .92) line('z' + i, [[zx - s, zy - s], [zx + s, zy - s], [zx - s, zy + s], [zx + s, zy + s]], 7, { col: INK.blue, w: lw * .75, straight: true, key: id + 'z' + i }); });
  if (em === 'sparkle') [[hx + hr * 1.1, hy - hr * .9, .45], [hx + hr * 1.45, hy - hr * .3, .3]].forEach(([a, b, s], i) => { const k = .7 + .3 * Math.sin(tt * 8 + i * 2); line('sp' + i, [[a, b - s * k], [a, b + s * k]], 7, { col: INK.orange, w: lw * .8 }); line('sq' + i, [[a - s * k, b], [a + s * k, b]], 7, { col: INK.orange, w: lw * .8 }); });
  if (em === 'lines') [0, 1, 2].forEach(i => { const a = -1.9 + i * .38; line('ln' + i, [[hx + Math.cos(a) * (hr + .5), hy + Math.sin(a) * (hr + .5)], [hx + Math.cos(a) * (hr + 1.2), hy + Math.sin(a) * (hr + 1.2)]], 7, { col: INK.orange, w: lw * .8 }); });
  if (em === '?') { const qx = hx + hr * .9, qy = hy - hr - 1.3, b = Math.sin(tt * 5) * .12; line('q', [[qx - .5, qy - .6 + b], [qx, qy - 1.05 + b], [qx + .5, qy - .55 + b], [qx, qy + .05 + b], [qx, qy + .45 + b]], 7, { col: INK.orange, w: lw }); add(S.dot(...P(qx, qy + .95 + b), lw * .65, { col: INK.orange }), 7); }
  if (em === '!') { const qx = hx + hr * .9, qy = hy - hr - 1.2, b = Math.abs(Math.sin(tt * 7)) * -.15; line('x', [[qx, qy - 1 + b], [qx + .05, qy + .35 + b]], 7, { col: INK.red, w: lw * 1.2 }); add(S.dot(...P(qx + .05, qy + .9 + b), lw * .75, { col: INK.red }), 7); }
  if (em === 'swirl') line('sr', Array.from({ length: 20 }, (_, i) => { const a = i / 19 * TAU * 1.5 + tt * 6; return [hx + Math.cos(a) * 1.3, hy - hr - .5 + Math.sin(a) * .35]; }), 7, { col: INK.purple, w: lw * .7 });
}
function _hold(R, prop, hp, key) {
  if (!prop) return;
  const st = typeof prop === 'function' ? prop(hp[0], hp[1], R.u, key) : PROPS[prop] ? PROPS[prop](hp[0], hp[1], R.u, key) : null;
  if (st) R.add(st, 5.2);
}
function _finish(R, o, ret) {
  ret.strokes = R.out;
  if (o.strokesOnly) return ret;
  if (o.draw) drawOn(R.out, o.draw[0], o.draw[1], { hand: o.hand, t: o.clock });
  else ink(R.out, { alpha: o.alpha });
  return ret;
}

// ---------- props (grip point = hand position; upright) ----------
const PROPS = {
  bulb: (x, y, u, k) => ICON.bulb(x, y - 1.8 * u, 3.8 * u, { key: k + 'bulb' }),
  bulbOn: (x, y, u, k) => ICON.bulb(x, y - 1.8 * u, 3.8 * u, { key: k + 'bulb', rays: true }),
  phone: (x, y, u, k) => ICON.phone(x, y - 1 * u, 2.6 * u, { key: k + 'ph' }),
  coin: (x, y, u, k) => ICON.coin(x, y - 1.2 * u, 2.4 * u, { key: k + 'co' }),
  heart: (x, y, u, k) => ICON.heart(x, y - 1.5 * u, 2.8 * u, { key: k + 'he' }),
  star: (x, y, u, k) => ICON.star(x, y - 1.5 * u, 2.8 * u, { key: k + 'sr' }),
  flag: (x, y, u, k) => [S.line(x, y + .9 * u, x, y - 3.4 * u, { key: k + 'fp', wob: .5 }), S.path([[x, y - 3.3 * u], [x + 2 * u, y - 2.8 * u], [x, y - 2.1 * u]], { key: k + 'ff', straight: true }), S.fill([[x, y - 3.3 * u], [x + 2 * u, y - 2.8 * u], [x, y - 2.1 * u]], { col: INK.red })],
  balloon: (x, y, u, k) => [S.path([[x, y], [x + .3 * u, y - 1.5 * u], [x - .1 * u, y - 3 * u]], { key: k + 'bs', w: WB.w * .5 }), S.circle(x - .1 * u, y - 4.3 * u, 1.1 * u, 1.3 * u, { key: k + 'bb', turns: 1 }), S.fill(polyCircle(x - .1 * u, y - 4.3 * u, 1.05 * u, 1.25 * u), { col: INK.red, alpha: .85 })],
  book: (x, y, u, k) => [S.rect(x - 1.1 * u, y - 1.6 * u, 2.2 * u, 1.6 * u, { key: k + 'bk', r: 4 }), S.line(x, y - 1.6 * u, x, y, { key: k + 'bl' }), S.fill(polyRect(x - 1.1 * u, y - 1.6 * u, 2.2 * u, 1.6 * u), { col: INK.blue, alpha: .8 })],
  cup: (x, y, u, k) => [S.path([[x - .8 * u, y - 1.6 * u], [x - .7 * u, y + .3 * u], [x + .7 * u, y + .3 * u], [x + .8 * u, y - 1.6 * u]], { key: k + 'cu', straight: true }), S.path([[x + .8 * u, y - 1.2 * u], [x + 1.3 * u, y - .9 * u], [x + .75 * u, y - .3 * u]], { key: k + 'ch' }), S.fill(polyRect(x - .75 * u, y - 1.55 * u, 1.5 * u, 1.8 * u), { col: INK.orange, alpha: .8 }), S.wave(x - .2 * u, y - 2 * u, x - .1 * u, y - 3.1 * u, 4, 1.5, { key: k + 'st', col: INK.grey, w: WB.w * .6 })],
  fish: (x, y, u, k) => { const p = [[x - 1.3 * u, y - .7 * u], [x - .2 * u, y - 1.3 * u], [x + .9 * u, y - .7 * u], [x - .2 * u, y - .1 * u]]; return [S.path(p, { key: k + 'fs', closed: true }), S.path([[x + .8 * u, y - .7 * u], [x + 1.5 * u, y - 1.2 * u], [x + 1.5 * u, y - .2 * u], [x + .8 * u, y - .7 * u]], { key: k + 'ft', straight: true }), S.dot(x - .75 * u, y - .8 * u, WB.w * .45), S.fill(catmull(p, true), { col: HL.blue, alpha: .9 })]; },
  marker: (x, y, u, k) => [S.rect(x - .25 * u, y - 2 * u, .5 * u, 2.6 * u, { key: k + 'mk', r: 4 }), S.fill(polyRect(x - .25 * u, y - 2 * u, .5 * u, .7 * u), { col: INK.blue })],
  sign: (x, y, u, k) => [S.line(x, y + .8 * u, x, y - 2 * u, { key: k + 'sp' }), S.rect(x - 2.2 * u, y - 4.6 * u, 4.4 * u, 2.6 * u, { key: k + 'sr', r: 6 }), S.fill(polyRect(x - 2.2 * u, y - 4.6 * u, 4.4 * u, 2.6 * u), { col: '#FFFFFF', mode: 'cover', alpha: 1 })],
};

// ---------- Bo: the round-headed kid ----------
function bo(x, y, u, o = {}) {
  const id = o.id || 'bo', R = _rig(x, y, u, o, id), { line, loop, fill, add, P, lw } = R;
  const e = EXPR[o.face || 'neutral'] || EXPR.neutral, v = clamp(o.view || 0), t = o.t ?? T;
  const blink = o.blink || (!o.noBlink && blinkAt(t, id.length));
  const oo = { ...o, blink, t };
  let arms = o.arm || [[24, 14], [24, 14]], legs = o.leg || [[5, 0], [5, 0]], dyWalk = 0;
  if (o.walk != null) {
    const q = o.walk * TAU; dyWalk = -.2 * Math.abs(Math.cos(q));
    const lg = ph => [30 * Math.sin(ph), -45 * Math.max(0, Math.cos(ph))];
    if (v >= .5) { legs = [lg(q), lg(q + Math.PI)]; if (!o.arm) arms = [[-26 * Math.sin(q), 25], [26 * Math.sin(q), 25]]; }
    else { legs = [[5, -30 * Math.max(0, Math.sin(q))], [5, -30 * Math.max(0, -Math.sin(q))]]; }
  }
  const dy0 = dyWalk, Y = yy => yy + dy0;
  const hx = 0, hy = Y(-7.75), hr = 2.35, side = v >= .5;
  const headTilt = o.tilt || 0, fx = hx + v * 1.1 + (o.look ? o.look[0] * .2 : 0), fy = hy + .15;
  const shx = 1.05 * (1 - .7 * v), hipx = .68 * (1 - .75 * v);
  // head (skin fill + wobbly circle outline), hair, ears
  add(S.circle(...P(hx, hy), hr * u * (1 + (o.sq || 0)), hr * u * (1 - (o.sq || 0)), { key: id + 'head', w: lw, turns: 1.04, a0: -2.4, spiral: .02, wob: u * .03 }), 3);
  if (!side) [-1, 1].forEach(s => line('ear' + s, [[s * (hr - .1), hy - .45], [s * (hr + .38), hy - .3], [s * (hr + .38), hy + .3], [s * (hr - .1), hy + .45]], 2.9, { w: lw * .9 }));
  else { const ear = R.ell(-1.05, hy + .3, .36, .48, 14); add(S.fill(catmull(ear.map(p => P(...p)), true, 6), { col: INK.skin, mode: 'cover', alpha: 1, cost: u * .4 }), 3.6); loop('ear', ear, 3.7, { w: lw * .85 }); line('earin', [[-1.02, hy + .12], [-1.15, hy + .32], [-1.0, hy + .5]], 3.8, { w: lw * .55 }); }
  const a0 = (196 - 34 * v) * Math.PI / 180, a1 = (344 - 26 * v) * Math.PI / 180, hair = [];
  for (let i = 0; i <= 12; i++) { const a = lerp(a0, a1, i / 12); hair.push([hx + Math.cos(a) * hr * 1.03, hy + Math.sin(a) * hr * 1.03]); }
  for (let i = 0; i <= 8; i++) { const a = lerp(a1, a0, i / 8), r = i % 2 ? .58 : .76; hair.push([hx + Math.cos(a) * hr * r, hy + Math.sin(a) * hr * r + .25]); }
  add(S.fill(hair.map(p => P(...p)), { col: INK.black, mode: 'cover', alpha: 1, cost: u * 3 }), 3.4);
  line('curl', [[hx + .2 - v * .4, hy - hr * 1.0], [hx + .5 - v * .4, hy - hr - .9], [hx + 1.25 - v * .4, hy - hr - .95], [hx + 1.2 - v * .4, hy - hr - .35], [hx + .65 - v * .4, hy - hr - .5]], 3.5, { w: lw * .95 });
  // face
  _face(R, fx, fy, .85 * (1 - .28 * v), e, oo, [hx, hy, hr], false);
  // torso (shirt)
  const tw = 1 - .25 * v, torso = [[-1.05 * tw, Y(-5.5)], [1.05 * tw, Y(-5.5)], [1.55 * tw, Y(-2.8)], [1.35 * tw, Y(-2.35)], [-1.35 * tw, Y(-2.35)], [-1.55 * tw, Y(-2.8)]];
  loop('torso', torso, 1);
  if (!side) line('collar', [[-.45, Y(-5.45)], [0, Y(-5.0)], [.45, Y(-5.45)]], 1.1, { w: lw * .75 });
  // limbs: in front view index 0 = screen-left arm/leg (outward = -x); in side view both point forward (+x)
  const hands = {};
  [0, 1].forEach(i => {
    const s = i ? 1 : -1, dir = side ? 1 : s, far = side && i === 0, z = far ? -3 : 5;
    const [la, lb] = legs[i] || [5, 0], L = _limb(s * hipx, Y(-2.5), dir, la, lb, 1.28, 1.22);
    line('leg' + i, [[s * hipx, Y(-2.6)], L.E, L.H], far ? -3 : -2, { w: lw * 1.05 });
    const fxo = side ? .32 : s * .22, shoe = R.ell(L.H[0] + fxo, L.H[1] - .05, .6, .3, 14);
    add(S.fill(catmull(shoe.map(p => P(...p)), true, 6), { col: INK.black, mode: 'cover', alpha: 1, shift: [0, 0], cost: u }), far ? -2.9 : -1.9);
    const [aa, ab] = arms[i] || [14, 12], A = _limb(s * shx, Y(-5.05), dir, aa, ab, 1.45, 1.35);
    line('arm' + i, [[s * shx * .92, Y(-5.15)], A.E, A.H], z, { w: lw * 1.02 });
    const hp = P(...A.H); hands[i ? 'R' : 'L'] = hp;
    _hold(R, o.hold && o.hold[i ? 'R' : 'L'], hp, id + i);
    add(S.fill(polyCircle(hp[0], hp[1], u * .44), { col: INK.skin, mode: 'cover', alpha: 1, shift: [0, 0], cost: u * .5 }), z + .5);
    add(S.circle(hp[0], hp[1], u * .44, u * .44, { key: id + 'hand' + i, w: lw * .9, wob: 0, turns: 1.02 }), z + 1);
  });
  // colour last: head skin + shirt
  fill(R.ell(hx, hy, hr * .99, hr * .99, 26), INK.skin, 2.5, { shift: [0, 0] });
  fill(torso, o.shirt || INK.orange, .5, { mode: 'cover' });
  return _finish(R, o, { hand: hands, head: P(hx, hy), top: P(hx, hy - hr - 1), strokes: null });
}

// ---------- Mochi: the round cat ----------
function mochi(x, y, u, o = {}) {
  const id = o.id || 'mochi', R = _rig(x, y, u, o, id), { line, loop, fill, add, P, lw } = R;
  const e = EXPR[o.face || 'neutral'] || EXPR.neutral, v = clamp(o.view || 0), t = o.t ?? T;
  const blink = o.blink || (!o.noBlink && blinkAt(t, id.length + 3)), oo = { ...o, blink, t };
  const sway = Math.sin(t * 2.4 + 1) * .25, hands = {};
  if (v < .5) {   // ---- front, sitting
    const half = [[0, 0], [1.7, .02], [2.35, -.7], [2.45, -1.9], [2.1, -3.15], [2.3, -4.3], [2.1, -5.45], [1.9, -6.15], [2.05, -7.65], [1.0, -6.75], [0, -6.85]];
    const out = [...half, ...half.slice(1, -1).reverse().map(([a, b]) => [-a, b])];
    const tip = [8, 12]; // indices of the two ear tips (right ear at 8, left ear mirrored at 12)
    add(S.path(out.map(p => P(...p)), { key: id + 'body', closed: true, sharp: tip, wob: u * .03, bow: 0, w: lw }), 1);
    // tail behind the body (right side)
    const tl = [[2.0, -.6], [3.2, -.8], [3.9 + sway * .3, -2.0], [3.5 + sway, -3.1], [2.9 + sway, -3.3]];
    line('tail', tl, -1, { w: lw });
    const tp = catmull(tl.map(p => P(...p))), n = tp.length;
    add(mk(tp.slice(Math.floor(n * .72)), { col: INK.orange, w: lw * 2.1 }), -.9);
    // face, whiskers, nose
    const fx = (o.look ? o.look[0] * .15 : 0), fy = -4.7;
    _face(R, fx, fy, .95, e, oo, [0, -4.5, 2.4], true);
    add(S.fill([P(fx - .22, fy + .5), P(fx + .22, fy + .5), P(fx, fy + .78)], { col: INK.pink, mode: 'cover', alpha: 1, shift: [0, 0], cost: u * .3 }), 4.2);
    [-1, 1].forEach(s => { line('wh' + s + 'a', [[s * 1.55, -4.05], [s * 2.95, -4.35]], 4, { w: lw * .6 }); line('wh' + s + 'b', [[s * 1.55, -3.7], [s * 2.9, -3.55]], 4, { w: lw * .6 }); });
    // front paws (arms) + feet
    // front legs (they double as arms: raise them to hold things) + the back feet peeking out at the sides
    const arms = o.arm || [[3, 0], [3, 0]];
    [0, 1].forEach(i => {
      const s = i ? 1 : -1, [aa, ab] = arms[i], A = _limb(s * .78, -2.75, s, aa, ab, 1.2, 1.15), up = aa > 40;
      line('arm' + i, [[s * .78, -2.9], A.E, A.H], 5, { w: lw });
      const hp = P(...A.H); hands[i ? 'R' : 'L'] = hp; _hold(R, o.hold && o.hold[i ? 'R' : 'L'], hp, id + i);
      const pr = up ? [u * .42, u * .42] : [u * .5, u * .34], pc = up ? hp : P(A.H[0] + s * .05, A.H[1] - .04);
      add(S.fill(polyCircle(pc[0], pc[1], pr[0], pr[1]), { col: '#FFFFFF', mode: 'cover', alpha: 1, cost: u * .4 }), 5.5);
      add(S.circle(pc[0], pc[1], pr[0], pr[1], { key: id + 'paw' + i, w: lw * .85, wob: 0, turns: 1.02 }), 6);
      line('ft' + i, [[s * 1.55, -.02], [s * 1.95, -.42], [s * 2.3, -.3]], 1.2, { w: lw * .9 });
    });
    fill(out, '#FFFFFF', .2, { shift: [0, 0], sharp: tip });
    add(S.fill([P(-1.9, -6.15), P(-2.05, -7.65), P(-1.0, -6.75), P(-1.2, -5.9)], { col: INK.orange, alpha: .9, cost: u }), .6);
    return _finish(R, o, { hand: hands, head: P(0, -4.6), top: P(0, -7.8), strokes: null });
  }
  // ---- side, standing / walking (facing right)
  const q = (o.walk ?? 0) * TAU, walking = o.walk != null, bob = walking ? -.12 * Math.abs(Math.cos(q)) : 0, Y = yy => yy + bob;
  const body = [[-2.7, Y(-2.6)], [-2.2, Y(-3.8)], [0, Y(-4.1)], [1.9, Y(-3.6)], [2.4, Y(-2.4)], [1.7, Y(-1.45)], [0, Y(-1.3)], [-2.1, Y(-1.45)]];
  const legs = [[1.3, 1], [-1.8, 0], [.9, 0], [-1.4, 1]];   // [hip x, phase offset]: far legs first
  legs.forEach(([lx, ph], i) => {
    const far = i < 2, a = walking ? 26 * Math.sin(q + ph * Math.PI) : 0, L = _limb(lx, Y(-1.6), 1, a, walking ? -20 * Math.max(0, Math.cos(q + ph * Math.PI)) : 0, .8, .8);
    line('lg' + i, [[lx, Y(-1.8)], L.E, L.H], far ? -3 : 1.5, { w: lw, col: far ? mixCol(INK.black, '#FFFFFF', .3) : INK.black });
    add(S.fill(polyCircle(...P(L.H[0] + .1, L.H[1] - .05), u * .32, u * .24), { col: '#FFFFFF', mode: 'cover', alpha: 1, cost: u * .3 }), far ? -2.8 : 1.6);
    add(S.circle(...P(L.H[0] + .1, L.H[1] - .05), u * .32, u * .24, { key: id + 'pw' + i, w: lw * .8, wob: 0 }), far ? -2.7 : 1.7);
    if (!far) hands[i === 2 ? 'R' : 'L'] = P(L.H[0], L.H[1]);
  });
  loop('body', body, 1);
  const tl = [[-2.6, Y(-3.0)], [-3.6, Y(-3.6)], [-3.9 + sway * .5, Y(-4.9)], [-3.4 + sway, Y(-5.7)], [-2.9 + sway, Y(-5.5)]];
  line('tail', tl, -1, { w: lw });
  const tp = catmull(tl.map(p => P(...p))); add(mk(tp.slice(Math.floor(tp.length * .72)), { col: INK.orange, w: lw * 2.1 }), -.9);
  const hx = 2.2, hy = Y(-4.7), hr = 1.95;
  const head = [[hx - 1.9, hy + .2], [hx - 1.55, hy - 1.3], [hx - 1.4, hy - 2.7], [hx - .45, hy - 1.95], [hx + .5, hy - 2.0], [hx + 1.3, hy - 2.75], [hx + 1.45, hy - 1.3], [hx + 1.95, hy + .1], [hx + 1.3, hy + 1.55], [hx, hy + 1.8], [hx - 1.4, hy + 1.45]];
  add(S.path(head.map(p => P(...p)), { key: id + 'head', closed: true, sharp: [2, 5], wob: u * .03, bow: 0, w: lw }), 3);
  fill(head, '#FFFFFF', 2.5, { shift: [0, 0] });
  add(S.fill([P(hx - 1.55, hy - 1.3), P(hx - 1.4, hy - 2.7), P(hx - .45, hy - 1.95), P(hx - .9, hy - 1.3)], { col: INK.orange, alpha: .9, cost: u }), 3.1);
  _face(R, hx + .45 + (o.look ? o.look[0] * .12 : 0), hy + .1, .72, e, oo, [hx, hy + .3, 2.0], true);
  add(S.fill([P(hx + .25, hy + .6), P(hx + .65, hy + .6), P(hx + .45, hy + .85)], { col: INK.pink, mode: 'cover', alpha: 1, cost: u * .3 }), 4.2);
  line('wha', [[hx + 1.5, hy + .7], [hx + 2.7, hy + .45]], 4, { w: lw * .6 }); line('whb', [[hx + 1.5, hy + 1.0], [hx + 2.6, hy + 1.15]], 4, { w: lw * .6 });
  fill(body, '#FFFFFF', .2, { shift: [0, 0] });
  if (o.hold && o.hold.R) _hold(R, o.hold.R, P(hx + 1.7, hy + 1.3), id + 'm');   // carried in the mouth
  return _finish(R, o, { hand: hands, head: P(hx, hy), top: P(hx, hy - 2.9), strokes: null });
}
