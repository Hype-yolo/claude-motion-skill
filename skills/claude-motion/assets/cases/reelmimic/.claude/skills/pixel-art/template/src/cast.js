// cast.js: the pixel-art character system. Two original demo characters drawn procedurally in pixels (no bitmaps):
//   pip(x, y, o)   a round, 40-px sprout-spirit in a red scarf (small, bouncy, big eyes)
//   juno(x, y, o)  a tall, 65-px kid in a yellow raincoat with a navy bob and a springy cowlick
// (x, y) = the ground point between the feet, in world px. One call draws the whole character as one outlined sprite
// (limbs are parts of the same sprite, so they always connect). Options (all optional):
//   t          time (default: the frame time) — drives blinks, idles, tears
//   face       expression name (EXPR below) or use act(t, keys) to act changes
//   view       'front' | 'q' (3/4) | 'side' | 'back'        flip: true → faces left
//   look       [lx, ly] pupils −1..1 (lx + = toward facing)  blink: false to disable auto-blink; seed: blink phase
//   sq         squash (+) / stretch (−)                      dx, dy: offsets in px (dy − = up)
//   arm        [a0, a1] arm angles in radians: 0 = straight out, + up, − down (ARM.down ≈ −1.3). In 'side'/'q' view
//              a0 = back arm, a1 = front arm, both measured toward the facing side. bend: [b0, b1] elbow (juno only)
//   hold       [fn0, fn1] draw a prop in that hand: fn(hx, hy, ang) in world px, ang = forearm direction (radians)
//   walk       walk phase (cycles per stride; use walkTo()) → 6-frame walk cycle   air: true → legs tucked (jumps)
//   drag       −1..1 secondary motion for hair/sprout/scarf (use vel() of your motion)   wind: −1..1 scarf/hair blow
//   emote      emote kind + emoteAge (s since it popped); emoteSide ±1 (default: facing side)
//       tint: ['#hex', k] mood tint     z: integer scale (close-up)
// Returns { head, top, hands: [[x,y],[x,y]], face } in world px for attaching strings, emotes and props.

const CR = {
  skin: regRamp(['#5a2a33', '#a4524a', '#e3906e', '#f6c29a', '#ffe4c8']),
  hair: regRamp(['#141329', '#22224a', '#34386c', '#56609c']),
  coat: regRamp(['#6a3420', '#b86420', '#f0a02e', '#ffd05a', '#fff0a0']),
  pants: regRamp(['#141a2c', '#24304e', '#3a4c76']),
  boot: regRamp(['#40121e', '#842634', '#c43e48', '#ea766c']),
  body: regRamp(['#5c3a3c', '#a86e5a', '#e8b48c', '#f8dcb4', '#fff4e2']),
  leaf: regRamp(['#1a4428', '#2c7438', '#4eaa46', '#96d666']),
  scarf: regRamp(['#4e1628', '#9e2638', '#dc4448', '#ff8262']),
  feet: regRamp(['#351f22', '#65382f', '#935641', '#bf7a58']),
  eye: '#231a33', white: '#fffaf0', blush: '#f27c84', tear: '#6cc4f4', mouth: '#5a1f2e', inside: '#9e2a3a', tongue: '#f07a84',
};
regRamp([CR.eye, '#3a2e52']); regRamp([CR.mouth, '#8a3040']);
const ARM = { down: -1.3, low: -.7, out: 0, up: 1.25, high: 1.45 };

// ---------- expressions ----------
const EXPR = {
  neutral: { eyes: 'open', mouth: 'flat' },
  happy: { eyes: 'open', mouth: 'smile', blush: 1, idle: 'bounce' },
  excited: { eyes: 'shine', mouth: 'grin', blush: 1, idle: 'hop', emote: '!' },
  laugh: { eyes: 'squeeze', mouth: 'laugh', blush: 2, idle: 'laugh', emote: 'note' },
  love: { eyes: 'heart', mouth: 'smile', blush: 2, idle: 'sway', emote: 'heart' },
  shy: { eyes: 'happy', mouth: 'pout', blush: 2, idle: 'sway', emote: 'sweat' },
  smug: { eyes: 'half', mouth: 'smug', blush: 1, idle: 'sway' },
  sad: { eyes: 'sad', mouth: 'frown', brows: 'sad', idle: 'droop', emote: 'dots' },
  cry: { eyes: 'squeeze', mouth: 'wail', brows: 'sad', tears: 1, idle: 'sob', emote: 'sweat' },
  angry: { eyes: 'angry', mouth: 'grit', brows: 'angry', tint: ['#ff3a2a', .1], idle: 'shake', emote: 'anger' },
  determined: { eyes: 'half', mouth: 'flat', brows: 'angry', idle: 'still', emote: 'star' },
  surprised: { eyes: 'wide', mouth: 'O', brows: 'up', idle: 'still', emote: '!' },
  scared: { eyes: 'tiny', mouth: 'wavy', brows: 'sad', tint: ['#7088d0', .12], idle: 'shiver', emote: 'sweat' },
  confused: { eyes: ['open', 'half'], mouth: 'wavy', idle: 'still', emote: '?' },
  thinking: { eyes: 'open', look: [1, -1], mouth: 'side', idle: 'still', emote: '?' },
  sleepy: { eyes: 'sleepy', mouth: 'o', idle: 'breathe', emote: 'zzz' },
};
const EXPR_NAMES = Object.keys(EXPR);

function _idle(kind, t, seed = 0) {
  const s = st(t), b = bpOf(s);
  switch (kind) {
    case 'bounce': return { dy: frac(b) < .3 ? -1 : 0 };
    case 'hop': { const k = frac(b); return { dy: -Math.round(Math.max(0, Math.sin(k * Math.PI)) * 3), sq: k < .12 ? .08 : 0 }; }
    case 'laugh': return { dy: Math.floor(s * 8 + seed) % 2 ? -1 : 0, sq: Math.floor(s * 8 + seed) % 2 ? -.03 : .03 };
    case 'sway': return { dx: Math.round(Math.sin(s * 2.4 + seed)), dy: 0 };
    case 'droop': return { dy: Math.sin(s * 1.6 + seed) > .2 ? 1 : 0, sq: .03 };
    case 'sob': return { dy: Math.floor(s * 5) % 2, sq: Math.floor(s * 5) % 2 ? .05 : 0 };
    case 'shake': return { dx: [0, 1, 0, -1][Math.floor(s * 12) % 4] };
    case 'shiver': return { dx: Math.floor(s * 12) % 3 === 0 ? 1 : 0 };
    case 'breathe': return { sq: Math.sin(s * 1.8 + seed) * .03 };
    default: return {};
  }
}
const _blinking = (t, seed = 0) => { const per = 2.6 + hash(seed * 7.1 + 1) * 1.6, a = (st(t) + hash(seed) * per) % per; return a < .12; };

// act(t, keys, o): an acted emotion timeline, keys = [[t0, 'face', { overrides }], ...]. Around each change: a
// squash + blink frame just before (anticipation), the face swaps, a take (stretch + hop) settles with overshoot,
// and the expression's emote pops (emoteHold s, default 1.5). Returns options to spread into pip()/juno().
function act(t, keys, o = {}) {
  let i = 0; while (i + 1 < keys.length && t >= keys[i + 1][0]) i++;
  const [t0, face, over = {}] = keys[i], ex = EXPR[face] || {}, s = st(t), out = { face, sq: 0, dy: 0 };
  const nx = keys[i + 1]; if (nx && s > nx[0] - .1) { out.sq += .1; out.blinkNow = true; }
  const a = s - t0, amt = (over.take ?? o.take ?? 1) * (i > 0 || t0 > 0 ? 1 : 0);
  if (a >= 0 && amt) { out.sq += -.16 * amt * Math.exp(-7 * a) * Math.cos(17 * a); out.dy += -Math.round(3 * amt * Math.exp(-8 * a) * Math.max(0, Math.cos(9 * a))); }
  const em = 'emote' in over ? over.emote : ex.emote, hold = over.emoteHold ?? o.emoteHold ?? 1.5;
  if (em && a < hold && i >= (o.emoteFrom ?? 0)) { out.emote = em; out.emoteAge = a; }
  const { take, emote, emoteHold, ...rest } = over; return { ...out, ...rest };
}
// walkTo(t, t0, t1, x0, x1, stride): position + walk phase that plants the feet (no sliding); e = easing
function walkTo(t, t0, t1, x0, x1, stride = 20, e = x => x) {
  const k = e(seg(t, t0, t1)), x = lerp(x0, x1, k), moving = t > t0 && t < t1;
  return { x, walk: moving ? Math.abs(x - x0) / stride : null, moving, dir: Math.sign(x1 - x0) };
}

// ---------- shared rig & face ----------
function _rig(x, y, o) {
  const fl = o.flip ? -1 : 1, sq = o.sq || 0, sx = 1 + (sq > 0 ? sq * .7 : sq * .45), sy = 1 - sq;
  const X0 = Math.round(x + (o.dx || 0)), Y0 = Math.round(y + (o.dy || 0));
  const L = (lx, ly) => [X0 + fl * lx * sx, Y0 + ly * sy];
  const Lp = pts => pts.map(([a, b]) => L(a, b));
  return { fl, sx, sy, X0, Y0, L, Lp };
}
// mirrored pixel at local offset from a snapped origin (face features keep their exact pixel shape)
function _fp(R, ox, oy, i, j, c) { px(ox + R.fl * i, oy + j, c); }
function _eye(R, kind, lx, ly, ew, eh, side, look, t) {
  const [ox, oy] = R.L(lx, ly).map(Math.round), E = CR.eye, Wc = CR.white;
  const P_ = (i, j, c) => _fp(R, ox, oy, i, j, c), inner = side < 0 ? ew - 1 : 0, outer = side < 0 ? 0 : ew - 1;
  const lkx = Math.round(clamp(look[0], -1, 1)), lky = Math.round(clamp(look[1], -1, 1));
  switch (kind) {
    case 'open': case 'shine': case 'sad': case 'angry': case 'half': {
      for (let j = 0; j < eh; j++) for (let i = 0; i < ew; i++) {
        if (kind === 'sad' && j === 0 && i === outer) continue;
        if (kind === 'angry' && j === 0 && i === inner) continue;
        if (kind === 'half' && j === 0) continue;
        P_(i + lkx, j + lky, E);
      }
      if (kind === 'half') for (let i = -1; i <= ew; i++) P_(i + lkx, 1 + lky, E);
      else { P_(lkx + (ew > 2 ? 0 : 0), lky + (kind === 'sad' || kind === 'angry' ? 1 : 0), Wc); if (kind === 'shine' || ew > 2) P_(lkx + ew - 1, lky + eh - 1, kind === 'shine' ? Wc : '#4a3e66'); }
      break;
    }
    case 'wide': case 'tiny': {
      for (let j = -1; j <= eh; j++) for (let i = -1; i <= ew; i++) { const edge = j === -1 || j === eh || i === -1 || i === ew; if (edge && (i === -1 || i === ew) && (j === -1 || j === eh)) continue; P_(i, j, edge ? E : Wc); }
      const jx = kind === 'tiny' ? (Math.floor(st(t) * 12) % 2) : 0, cx = Math.floor((ew - 1) / 2) + lkx + jx, cy = Math.floor((eh - 1) / 2) + lky;
      P_(clamp(cx, 0, ew - 1), clamp(cy, 0, eh - 1), E); if (kind === 'wide') P_(clamp(cx, 0, ew - 1), clamp(cy + 1, 0, eh - 1), E);
      break;
    }
    case 'happy': {   // ∩ arcs
      const a = ew > 2 ? 0 : -1, b = ew > 2 ? ew - 1 : ew;
      for (let i = a + 1; i < b; i++) P_(i, 1, E); P_(a, 2, E); P_(b, 2, E); P_(a, 3, E); P_(b, 3, E); break;
    }
    case 'closed': for (let i = -1; i <= ew; i++) P_(i, 2, E); P_(side < 0 ? -1 : ew, 1, E); break;
    case 'sleepy': for (let i = -1; i <= ew; i++) P_(i, 2, E); for (let i = 0; i < ew; i++) P_(i, 3, E); break;
    case 'squeeze': { const pts = side < 0 ? [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]] : [[2, 0], [1, 1], [0, 2], [1, 3], [2, 4]]; const o2 = ew > 2 ? 0 : -.5; for (const [i, j] of pts) P_(Math.round(i + o2 - (side < 0 ? 0 : 0)), j - 1, E); break; }
    case 'heart': { const H_ = ['rr.rr', 'rrrrr', '.rrr.', '..r..']; const x0 = Math.floor(ew / 2) - 2; H_.forEach((l, j) => { for (let i = 0; i < 5; i++) if (l[i] === 'r') P_(x0 + i, j, i === 1 && j === 1 ? '#ffb0c0' : '#e8485c'); }); break; }
    case 'dot': P_(Math.floor(ew / 2), 1, E); P_(Math.floor(ew / 2), 2, E); break;
  }
}
const MOUTHS = {
  flat: ['kkk'], smile: ['k...k', '.kkk.'], grin: ['kkkkk', 'krrrk', '.kkk.'], laugh: ['kkkkk', 'krrrk', 'krttk', '.kkk.'],
  O: ['.kk.', 'krrk', 'krrk', '.kk.'], o: ['.k.', 'k.k', '.k.'], frown: ['.kkk.', 'k...k'], wavy: ['.k.k.', 'k.k.k'],
  cat: ['k.k.k', '.k.k.'], smug: ['....k', 'kkkk.'], wail: ['.kkk.', 'krrrk', 'krttk', 'kkkkk'], grit: ['kkkkk', 'kwkwk', 'kkkkk'],
  side: ['..kk', '.k..'], pout: ['.k.', 'k.k'],
};
function _mouth(R, kind, lx, ly) {
  const g = MOUTHS[kind]; if (!g) return; const [ox, oy] = R.L(lx, ly).map(Math.round), w = g[0].length, x0 = -Math.floor(w / 2);
  const cm = { k: CR.mouth, r: CR.inside, t: CR.tongue, w: CR.white };
  g.forEach((l, j) => { for (let i = 0; i < w; i++) if (cm[l[i]]) _fp(R, ox, oy, x0 + i, j, cm[l[i]]); });
}
function _brows(R, kind, lx, ly, ew, side, col) {
  if (!kind) return; const [ox, oy] = R.L(lx, ly).map(Math.round), inner = side < 0 ? ew - 1 : 0, outer = side < 0 ? 0 : ew - 1, di = side < 0 ? 1 : -1;
  if (kind === 'sad') { _fp(R, ox, oy, inner, -3, col); _fp(R, ox, oy, inner - di, -2, col); _fp(R, ox, oy, outer - di * 0, -2, col); }
  if (kind === 'angry') { _fp(R, ox, oy, inner + di, -1, col); _fp(R, ox, oy, inner, -2, col); _fp(R, ox, oy, outer, -3, col); }
  if (kind === 'up') { for (let i = 0; i < ew; i++) _fp(R, ox, oy, i, -4, col); }
}
// face(R, f, spec): f = { eyes: [[lx,ly],[lx,ly]|null], ew, eh, mouth: [lx,ly], blush: [[lx,ly],[lx,ly]], brow col }
function _face(R, f, ex, o, t) {
  const blink = o.blinkNow || (o.blink !== false && _blinking(t, o.seed || 0)), look = o.look || ex.look || [0, 0];
  const kinds = Array.isArray(ex.eyes) ? ex.eyes : [ex.eyes, ex.eyes];
  if ((ex.blush || o.blush) && f.blush) { const n = o.blush ?? ex.blush; for (const [bx, by] of f.blush) { if (!bx && bx !== 0) continue; const [ox, oy] = R.L(bx, by).map(Math.round); _fp(R, ox, oy, 0, 0, CR.blush); _fp(R, ox, oy, 1, 0, CR.blush); if (n > 1) { _fp(R, ox, oy, -1, 0, CR.blush); _fp(R, ox, oy, 2, 0, CR.blush); _fp(R, ox, oy, 0, 1, CR.blush); _fp(R, ox, oy, 1, 1, CR.blush); } } }
  f.eyes.forEach((e, i) => {
    if (!e) return; const side = i === 0 ? -1 : 1; let k = kinds[i] || 'open';
    if (blink && ['open', 'shine', 'sad', 'angry', 'half', 'wide', 'tiny'].includes(k)) k = 'closed';
    _eye(R, k, e[0], e[1], f.ew - (e[2] || 0), f.eh, side, look, t);
    if (f.browCol) _brows(R, ex.brows, e[0], e[1] + (ex.brows === 'up' ? 0 : 0), f.ew - (e[2] || 0), side, f.browCol);
    if (ex.tears) { const [ox, oy] = R.L(e[0], e[1]).map(Math.round), s = st(t), n = 2 + (Math.floor(s * 12) % 4); const tx = side < 0 ? 0 : f.ew - 1; for (let j = 0; j < n; j++) _fp(R, ox, oy, tx, 3 + j, CR.tear); if (Math.floor(s * 12) % 4 === 3) _fp(R, ox, oy, tx + side, 5 + n, CR.tear); }
  });
  if (f.mouth) _mouth(R, o.mouth || ex.mouth, f.mouth[0], f.mouth[1]);
}
// arm: shoulder (local) → elbow → hand; w px thick. Returns [hx, hy] world.
function _arm(R, sh, a, len1, len2, bend, w, col, hand, holdFn, outward) {
  const [sx, sy] = R.L(sh[0], sh[1]), d = outward * R.fl;
  const ex = sx + Math.cos(a) * len1 * d * R.sx, ey = sy - Math.sin(a) * len1 * R.sy, a2 = a + bend;
  const hx = ex + Math.cos(a2) * len2 * d * R.sx, hy = ey - Math.sin(a2) * len2 * R.sy;
  line(sx, sy, ex, ey, col, w); if (len2) line(ex, ey, hx, hy, col, w);
  const ang = Math.atan2(hy - ey, hx - ex || (len2 ? 1e-6 : Math.cos(a) * d));
  if (holdFn) { part(); holdFn(hx, hy, len2 ? ang : Math.atan2(-Math.sin(a), Math.cos(a) * d)); part(); }
  disc(hx, hy, 1, hand);
  return [Math.round(hx), Math.round(hy)];
}
function _legGait(o, view) {
  if (o.walk == null) return null; const f = Math.floor(frac(o.walk) * 6) / 6, a = f * TAU;
  return { a, fA: Math.sin(a), fB: -Math.sin(a), lA: Math.max(0, Math.cos(a)), lB: Math.max(0, -Math.cos(a)), bob: -Math.round(Math.abs(Math.cos(a))), swing: Math.sin(a) };
}
function _mood(o, t) { const ex = EXPR[o.face || 'neutral'] || EXPR.neutral, id = _idle(ex.idle, t, o.seed || 0); return { ex, id }; }

// ---------- JUNO: tall raincoat kid (≈65 px incl. cowlick) ----------
function juno(x, y, o = {}) {
  const t = o.t ?? T, { ex, id } = _mood(o, t), view = o.view || 'front', g = _legGait(o, view);
  const R = _rig(x, y, { ...o, dx: (o.dx || 0) + (id.dx || 0), dy: (o.dy || 0) + (id.dy || 0) + (g ? g.bob : 0), sq: (o.sq || 0) + (id.sq || 0) });
  const side = view === 'side', q = view === 'q', back = view === 'back', front = view === 'front';
  const fsh = side ? 3 : q ? 1 : 0, arm = o.arm || [ARM.down, ARM.down], bend = o.bend || [.25, .25], drag = clamp(o.drag || 0, -1, 1), wind = o.wind || 0;
  const hands = [];
  const sw = g ? g.swing * .32 : 0;
  beginSpr();
  // back arm (side / q views): darker, behind the body
  if (side || q) { hands[0] = _arm(R, [side ? -1 : -5, -37], arm[0] - sw, 8, 7, bend[0], 3, CR.coat[1], CR.skin[2], o.hold && o.hold[0], 1); part(); }
  // legs + boots
  const air = o.air ? 1 : 0;
  const legs = side || q ? [[-1 + (q ? -2 : 0), g ? g.fB * 5 : -2, g ? g.lB * 3 : 0, true], [1 + (q ? 2 : 0), g ? g.fA * 5 : 3, g ? g.lA * 3 : 0, false]]
    : [[-3, -4, g ? Math.max(0, g.fA) * 2 : 0, false], [3, 4, g ? Math.max(0, g.fB) * 2 : 0, false]];
  for (const [hx, fx0, lift, far] of legs) {
    const fx = fx0 + (air ? (side ? 2 : 0) : 0), fy = -lift - air * 4;
    const pc = far ? CR.pants[0] : CR.pants[1], bc = far ? CR.boot[1] : CR.boot[2];
    const [kx, ky] = R.L((hx + fx) / 2 + (air ? 3 : 0) * (side || q ? 1 : 0), -12 - air * 3);
    line(...R.L(hx, -20), kx, ky, pc, 3); line(kx, ky, ...R.L(fx, fy - 4), pc, 3);
    if (side || q) poly(R.Lp([[fx - 2, fy - 5], [fx + 2, fy - 5], [fx + 2, fy - 3], [fx + 4, fy - 2], [fx + 4, fy], [fx - 2, fy]]), bc);
    else poly(R.Lp([[fx - 2, fy - 5], [fx + 2, fy - 5], [fx + 3, fy - 1], [fx + 2, fy + 0], [fx - 3, fy], [fx - 3, fy - 1]]), bc);
    part();
  }
  // raincoat
  const cw = side ? .78 : q ? .9 : 1;
  poly(R.Lp([[-5 * cw, -39], [5 * cw, -39], [7 * cw, -33], [9 * cw, -22], [10 * cw, -18], [-10 * cw, -18], [-9 * cw, -22], [-7 * cw, -33]]), CR.coat[2]);
  poly(R.Lp([[(side ? -1 : 3) * cw, -39], [5 * cw, -39], [7 * cw, -33], [9 * cw, -22], [10 * cw, -18], [(side ? 0 : 5) * cw, -18]]), CR.coat[1]);
  line(...R.L(-9 * cw, -19), ...R.L(9 * cw, -19), CR.coat[1]);
  line(...R.L(-6 * cw, -36), ...R.L(-8 * cw, -24), CR.coat[3]);
  if (front || q) { const zx = q ? 2 : 0; line(...R.L(zx, -38), ...R.L(zx, -20), CR.coat[1]); px(...R.L(zx - 2, -34), CR.coat[0]); px(...R.L(zx - 2, -29), CR.coat[0]); rect(...R.L(-7 + zx, -26), 3, 1, CR.coat[1]); }
  else { line(...R.L(4, -38), ...R.L(6, -20), CR.coat[1]); oval(...R.L(-4, -39), 3, 2, CR.coat[2]); }
  part();
  // head: neck, hair mass, face, bangs, cowlick
  const hx = side ? 1 : q ? .5 : 0;
  rect(...R.L(-1, -42), 3, 3, CR.skin[1]);
  oval(...R.L(hx - (side ? 2 : q ? 1 : 0), -51), 11 * R.sx, 10 * R.sy, CR.hair[1]);
  poly(R.Lp([[hx - 11 - (side ? 1 : 0), -51], [hx + (side ? 6 : 11), -51], [hx + (side ? 6 : 11), -44], [hx + (side ? 5 : 9), -41], [hx - (side ? 10 : 9), -41], [hx - 11 - (side ? 1 : 0), -44]]), CR.hair[1]);
  if (!back) {
    const fcx = side ? 3 : q ? 1.5 : 0;
    part(); oval(...R.L(fcx, -48), (side ? 7 : 8) * R.sx, 7.5 * R.sy, CR.skin[2]);
    if (side) px(...R.L(11, -47), CR.skin[2]);
    oval(...R.L(fcx - (side ? 2 : 3), -45), 2, 1, CR.skin[2]);
    part();
    const B = side ? [[-6, -56], [-1, -60], [6, -59], [10, -55], [10, -52], [8, -53], [6, -51], [4, -53], [1, -51], [-2, -52], [-6, -48]]
      : [[-9, -54], [-6, -58], [0, -60], [6, -58], [9, -54], [9, -50], [7, -52], [6, -50], [4, -52], [2, -51], [0, -53], [-2, -51], [-4, -52], [-6, -50], [-7, -52], [-9, -50]];
    poly(R.Lp(B.map(([a, b]) => [a + (q ? 1 : 0), b])), CR.hair[1]);
  } else part();
  // hair shine + cowlick (springs with drag)
  line(...R.L(hx - 7, -56), ...R.L(hx - 3, -59), CR.hair[2]); px(...R.L(hx - 1, -59), CR.hair[3]);
  const dg = Math.round(drag * 3), wd = Math.round(wind * 2);
  pline(R.Lp([[hx + 1, -60], [hx + 2 + wd, -63 + dg], [hx + 5 + wd, -65 + dg * 1.5], [hx + 7 + wd, -63 + dg * 1.5]]), CR.hair[1], 2);
  part(false);
  if (!back) {
    const f = side ? { eyes: [null, [6, -49]], mouth: [9, -44], blush: [[5, -45]] }
      : q ? { eyes: [[-3, -49, 0], [5, -49]], mouth: [3, -44], blush: [[-5, -45], [7, -45]] }
        : { eyes: [[-5, -49], [4, -49]], mouth: [0, -44], blush: [[-8, -45], [6, -45]] };
    _face(R, { ...f, ew: 2, eh: 4, browCol: null }, ex, o, t);
  }
  // front arm(s)
  part();
  if (front || back) {
    hands[0] = _arm(R, [-6, -37], arm[0], 8, 7, bend[0], 3, CR.coat[2], CR.skin[3], o.hold && o.hold[0], -1); part();
    hands[1] = _arm(R, [6, -37], arm[1], 8, 7, bend[1], 3, CR.coat[2], CR.skin[3], o.hold && o.hold[1], 1);
  } else hands[1] = _arm(R, [side ? 1 : 4, -37], arm[1] + sw, 8, 7, bend[1], 3, CR.coat[2], CR.skin[3], o.hold && o.hold[1], 1);
  const tint = ex.tint || o.tint;
  endSpr({ tint: tint === undefined ? P.charTint : tint, z: o.z, ax: R.X0, ay: R.Y0, flash: o.flash });
  const top = R.L(hx, -64), info = { head: R.L(0, -50), top, hands, face: R.L(side ? 5 : 0, -47) };
  if (o.emote) emote(o.emote, (o.emoteSide ?? R.fl) > 0 ? top[0] + 4 : top[0] - 18, top[1] - 1, { age: o.emoteAge ?? 1 });
  return info;
}

// ---------- PIP: round sprout-spirit (≈40 px incl. sprout) ----------
function pip(x, y, o = {}) {
  const t = o.t ?? T, { ex, id } = _mood(o, t), view = o.view || 'front', g = _legGait(o, view);
  const R = _rig(x, y, { ...o, dx: (o.dx || 0) + (id.dx || 0), dy: (o.dy || 0) + (id.dy || 0) + (g ? g.bob : 0), sq: (o.sq || 0) + (id.sq || 0) });
  const side = view === 'side', q = view === 'q', back = view === 'back', front = view === 'front';
  const arm = o.arm || [ARM.low, ARM.low], drag = clamp(o.drag || 0, -1, 1), wind = o.wind || 0, sw = g ? g.swing * .6 : 0, hands = [];
  const ts = st(t), flut = Math.round(Math.sin(ts * 9) * (Math.abs(wind) + (g ? 1 : 0)) * .8);
  beginSpr();
  if (side || q) { hands[0] = _arm(R, [side ? -2 : -8, -13], arm[0] - sw, 6, 0, 0, 3, CR.body[1], CR.body[2], o.hold && o.hold[0], 1); part(); }
  // feet
  const air = o.air ? 1 : 0;
  const feet = side || q ? [[g ? g.fB * 4 - 1 : -4, g ? g.lB * 2 : 0, true], [g ? g.fA * 4 + 1 : 4, g ? g.lA * 2 : 0, false]] : [[-5, g ? Math.max(0, g.fA) * 2 : 0, false], [5, g ? Math.max(0, g.fB) * 2 : 0, false]];
  for (const [fx, lift, far] of feet) { oval(...R.L(fx + (side ? 1 : 0), -2 - lift - air * 2), 3.5 * R.sx, 2.2, far ? CR.feet[1] : CR.feet[2]); }
  part();
  // scarf tail behind (side/q) + body
  if (side || q) { const tx = side ? -8 : -6; poly(R.Lp([[tx + 2, -11], [tx, -7], [tx - 6 - Math.abs(wind) * 3, -5 + flut - drag * 2], [tx - 7 - Math.abs(wind) * 3, -9 + flut - drag * 2]]), CR.scarf[1]); part(); }
  const bcx = 0, bcy = -17;
  oval(...R.L(bcx, bcy), 13 * R.sx, 12.5 * R.sy, CR.body[1]);
  oval(...R.L(bcx - 1, bcy - 1), 12 * R.sx, 11.3 * R.sy, CR.body[2]);
  oval(...R.L(bcx - (side ? 2 : 5), bcy - 7), 3.2 * R.sx, 2 * R.sy, CR.body[3]); px(...R.L(bcx - (side ? 3 : 6), bcy - 8), CR.body[4]);
  // scarf band + knot + front tail
  part();
  oval(...R.L(0, -9), 10.6 * R.sx, 2 * R.sy, CR.scarf[2]);
  line(...R.L(-9, -8), ...R.L(9, -8), CR.scarf[1]); px(...R.L(-5, -10), CR.scarf[3]); px(...R.L(-1, -10), CR.scarf[3]); px(...R.L(3, -10), CR.scarf[3]);
  if (front) { part(); const kx = 6; oval(...R.L(kx, -9), 2.2, 2, CR.scarf[3]); poly(R.Lp([[kx - 1, -8], [kx + 2, -8], [kx + 3 + flut, -1], [kx + flut, -1]]), CR.scarf[2]); px(...R.L(kx + 1 + flut, -4), CR.scarf[3]); px(...R.L(kx + 1 + flut, -2), CR.scarf[1]); }
  // sprout
  part();
  const dg = drag * 2.5, wd = wind * 2, top = [(side ? -1 : 0) + wd * .5, -34 + dg];
  pline(R.Lp([[side ? -1 : 0, -29], [(side ? -1 : 0) + wd * .3, -32 + dg * .5], top]), CR.leaf[1], 1);
  poly(R.Lp([[top[0], top[1]], [top[0] - 3, top[1] - 3 + dg * .4], [top[0] - 6, top[1] - 2 + dg * .6], [top[0] - 3, top[1] + 1]]), CR.leaf[2]);
  poly(R.Lp([[top[0], top[1]], [top[0] + 2, top[1] - 4 + dg * .4], [top[0] + 6, top[1] - 4 + dg * .6], [top[0] + 4, top[1]]]), CR.leaf[2]);
  px(...R.L(top[0] + 3, top[1] - 3 + dg * .5), CR.leaf[3]); px(...R.L(top[0] - 3, top[1] - 2 + dg * .4), CR.leaf[3]);
  part(false);
  if (!back) {
    const f = side ? { eyes: [null, [7, -20]], mouth: [10, -14], blush: [[5, -15]] }
      : q ? { eyes: [[-3, -20, 1], [5, -20]], mouth: [3, -14], blush: [[-6, -15], [8, -15]] }
        : { eyes: [[-6, -20], [4, -20]], mouth: [0, -14], blush: [[-10, -15], [7, -15]] };
    _face(R, { ...f, ew: 3, eh: 4, browCol: CR.body[1] }, ex, o, t);
  }
  part();
  if (front || back) {
    hands[0] = _arm(R, [-11, -13], arm[0], 6, 0, 0, 3, CR.body[2], CR.body[3], o.hold && o.hold[0], -1); part();
    hands[1] = _arm(R, [11, -13], arm[1], 6, 0, 0, 3, CR.body[2], CR.body[3], o.hold && o.hold[1], 1);
  } else hands[1] = _arm(R, [side ? 2 : 5, -12], arm[1] + sw, 6, 0, 0, 3, CR.body[2], CR.body[3], o.hold && o.hold[1], 1);
  const tint = ex.tint || o.tint;
  endSpr({ tint: tint === undefined ? P.charTint : tint, z: o.z, ax: R.X0, ay: R.Y0, flash: o.flash });
  const tp = R.L(top[0], top[1] - 4), info = { head: R.L(0, -17), top: tp, hands, face: R.L(side ? 6 : 0, -17) };
  if (o.emote) emote(o.emote, (o.emoteSide ?? R.fl) > 0 ? tp[0] + 5 : tp[0] - 19, tp[1] + 2, { age: o.emoteAge ?? 1 });
  return info;
}
const CAST = { pip, juno };
// contact shadow under a character (call BEFORE drawing it)
function footShadow(x, y, w = 12, lift = 0) { shadowAt(x, y, Math.max(3, w - lift * .3), 2, 1); }

// ---------- props (drawn procedurally; inside a hold callback they join the character's outline) ----------
const PROP = {
  // diamond kite centred at (x,y); o: { s: half-height, tilt (rad), t, tail: [dx,dy] trailing direction, hang: tail hangs }
  kite(x, y, o = {}) {
    const own = !SPRM; if (own) beginSpr();
    const s = o.s ?? 9, a = o.tilt ?? 0, ca = Math.cos(a), sa = Math.sin(a), cs = o.cols || ['#e24a5e', '#ffd35e'], t = st(o.t ?? T);
    const Rt = (u, v) => [x + u * ca - v * sa, y + u * sa + v * ca];
    const top = Rt(0, -s), rt = Rt(s * .8, -s * .2), bot = Rt(0, s * 1.15), lt = Rt(-s * .8, -s * .2), mid = Rt(0, -s * .2);
    poly([top, rt, bot, lt], cs[0]); poly([top, rt, mid], cs[1]); poly([lt, mid, bot], cs[1]);
    part(false); line(...top, ...bot, '#7a4432'); line(...lt, ...rt, '#7a4432');
    part();
    const td = o.tail || [0, 1], n = 6, pts = [bot];
    for (let i = 1; i <= n; i++) { const k = i / n, wv = Math.sin(t * 10 - i * 1.3) * (o.hang ? 1 : 3) * k; pts.push([bot[0] + td[0] * i * 4.5 - td[1] * wv, bot[1] + td[1] * i * 4.5 + td[0] * wv]); }
    curve(pts, '#fff0d0', 1);
    for (let i = 2; i <= n; i += 2) { const [bx, by] = pts[i]; px(bx - 1, by, cs[i % 4 ? 0 : 1]); px(bx + 1, by, cs[i % 4 ? 0 : 1]); px(bx, by, cs[i % 4 ? 1 : 0]); }
    if (own) endSpr({ tint: o.tint === undefined ? P.charTint : o.tint });
    return { bridle: mid, tailEnd: pts[n] };
  },
  spool(x, y) { rect(x - 3, y - 4, 7, 2, '#a36844'); rect(x - 3, y + 3, 7, 2, '#a36844'); rect(x - 2, y - 2, 5, 5, '#fff0d0'); line(x - 2, y - 1, x + 2, y + 1, '#d8c8a8'); line(x - 2, y + 1, x + 2, y + 3, '#d8c8a8'); },
  lantern(x, y, o = {}) { line(x, y, x, y + 3, '#3a2e52'); rect(x - 3, y + 3, 7, 2, '#3a2e52'); rect(x - 3, y + 5, 7, 7, o.lit === false ? '#6a5a4a' : '#ffd35e'); rect(x - 2, y + 6, 5, 5, o.lit === false ? '#8a7a6a' : '#fff3b0'); rect(x - 3, y + 12, 7, 2, '#3a2e52'); },
  flower(x, y, ang = -Math.PI / 2, o = {}) { const L_ = 9, fx = x + Math.cos(ang) * L_, fy = y + Math.sin(ang) * L_; line(x, y, fx, fy, '#2f7545'); const c = o.c || '#ff8f8a'; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; disc(fx + Math.cos(a) * 2, fy + Math.sin(a) * 2, 1, c); } px(fx, fy, '#ffd35e'); },
  balloon(x, y, o = {}) { const bx = x + (o.dx ?? 2), by = y - (o.len ?? 26); curve([[x, y], [x + 2, y - 8], [bx - 1, by + 14], [bx, by + 9]], '#fff0d0'); oval(bx, by, 7, 8, o.c || '#e24a5e'); oval(bx - 2, by - 3, 2, 2, shade(o.c || '#e24a5e', 1)); px(bx, by + 9, o.c || '#e24a5e'); },
  mug(x, y) { rect(x - 3, y - 6, 6, 7, '#fff0d0'); rect(x + 3, y - 4, 2, 3, '#fff0d0'); rect(x - 2, y - 5, 4, 1, '#7a4432'); },
  letter(x, y, ang = 0) { rect(x - 5, y - 4, 10, 7, '#fff8e8'); line(x - 5, y - 4, x, y, '#c9b8a0'); line(x + 4, y - 4, x, y, '#c9b8a0'); px(x, y + 1, '#e24a5e'); },
  star(x, y, o = {}) { const r = o.r ?? 5; poly([...Array(10)].map((_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; }), o.c || '#ffd35e'); },
  umbrella(x, y, o = {}) { const h = o.h ?? 18, c = o.c || '#4f86c6'; line(x, y, x, y - h, '#3a2e52'); const cx = x, cy = y - h; poly([[cx - 13, cy + 2], [cx - 10, cy - 5], [cx, cy - 8], [cx + 10, cy - 5], [cx + 13, cy + 2]], c); for (const k of [-8, 0, 8]) line(cx + k, cy - 6, cx + k * 1.5, cy + 2, shade(c, -1)); line(x, y, x - 2, y + 2, '#3a2e52'); },
};
