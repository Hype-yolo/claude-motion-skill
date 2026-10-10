// STAIRWELL — an architectural cross-section of the tower's stair core (Art Deco poster section drawing).
// Switchback flights: flight A runs left→right up to a mid landing, flight B right→left up to the next floor.
// The camera cranes vertically; it can pull out to the whole 30-floor section and push back in.
import * as D from '../engine/deco.js';
import * as T from '../engine/type.js';
import * as CH from '../chars.js';
const { C } = D;

export const FLOOR_H = 3.2, HALF = 3.0, WALL = 4.0, TOP_FLOOR = 30, FIRST = 1;
// Pip's position for a continuous flight index u (0 = bottom of flight A on floor FIRST).
export function pipAt(u) {
  const n = Math.floor(u), f = u - n, A = n % 2 === 0;
  const y0 = FIRST * FLOOR_H + n * FLOOR_H / 2;
  // run along the flight with a short landing dwell at each end (turn)
  const run = D.clamp((f - .06) / .88);
  const x = A ? D.lerp(-HALF, HALF, run) : D.lerp(HALF, -HALF, run);
  const y = y0 + run * FLOOR_H / 2;
  return { x, y, dir: A ? 1 : -1, n, f, run, floor: FIRST + Math.floor((n + 1) / 2) };
}

// view: { cy (world y at screen centre), ppm (pixels per metre), cx (world x at centre) }
export function drawStairs(g, view, o = {}) {
  const { cy, ppm, cx = 0 } = view, t = o.t || 0;
  const X = x => 960 + (x - cx) * ppm, Y = y => 540 - (y - cy) * ppm;
  const y0w = cy - 540 / ppm - FLOOR_H, y1w = cy + 540 / ppm + FLOOR_H;
  const fLo = Math.max(0, Math.floor(y0w / FLOOR_H)), fHi = Math.min(TOP_FLOOR + 1, Math.ceil(y1w / FLOOR_H));
  const lw = Math.max(.8, Math.min(2.4, ppm / 60));
  const gl = (pts, w = lw, a = 1) => D.gline(g, pts.map(([x, y]) => [X(x), Y(y)]), { w, alpha: a });
  // background: stair-core void (warm dark) + exterior night seen through the right-hand windows
  const bg = g.createLinearGradient(0, 0, 0, 1080); bg.addColorStop(0, '#0c0a08'); bg.addColorStop(1, '#070605'); g.fillStyle = bg; g.fillRect(0, 0, 1920, 1080);
  // night sky + skyline beyond the tower edges, then the hotel floors on both sides of the core (seen when the camera pulls out)
  {
    const sg = g.createLinearGradient(0, 0, 0, 1080); sg.addColorStop(0, '#070b12'); sg.addColorStop(1, '#10231f');
    const R0 = D.mulberry(4);
    const halfW = f => f >= 27 ? 8.2 : f >= 22 ? 11.5 : 15;
    if (X(-15) > 0 || X(15) < 1920) {
      g.fillStyle = sg; g.fillRect(0, 0, 1920, 1080);
      for (let i = 0; i < 90; i++) { const x = R0() * 1920, y = R0() * 1080; g.fillStyle = `rgba(255,240,210,${.2 + R0() * .4})`; g.fillRect(x, y, 1.5, 1.5); }
    }
    const R = D.mulberry(21);
    for (let f = fLo; f <= Math.min(fHi, TOP_FLOOR); f++) {
      const yF = f * FLOOR_H, yT = Y(yF + FLOOR_H), yb = Y(yF), hw = halfW(f);
      const xa = X(-hw), xb = X(hw);
      g.fillStyle = f % 2 ? '#0e0b08' : '#0b0907'; g.fillRect(xa, yT, xb - xa, yb - yT + 1);
      for (const sd of [-1, 1]) for (let k = 0; k < 6; k++) {
        const dx = sd * (WALL + 1.6 + k * 2.2); if (Math.abs(dx) > hw - .8) break;
        const a0 = X(dx) - .45 * ppm, w = Math.max(1, .9 * ppm), h = Math.max(1, 2.1 * ppm);
        if (a0 > 1920 || a0 + w < 0) continue;
        const on = R() < .72; g.fillStyle = on ? `rgba(255,${185 + R() * 45 | 0},105,${.35 + R() * .35})` : 'rgba(40,30,20,.6)'; g.fillRect(a0, Y(yF + 2.1), w, h);
      }
      D.gline(g, [[xa, yb], [xb, yb]], { w: Math.max(.6, lw * .6), alpha: .7 });
      D.gline(g, [[xa, yT], [xa, yb]], { w: Math.max(.8, lw), alpha: .9 }); D.gline(g, [[xb, yT], [xb, yb]], { w: Math.max(.8, lw), alpha: .9 });
    }
    // stepped crown above the top floor
    const yTop = TOP_FLOOR * FLOOR_H + FLOOR_H;
    [[8.2, 0], [6, 2.4], [4, 4.6], [2, 6.6]].forEach(([hw, dy], i) => { const x0 = X(-hw), x1 = X(hw), y0 = Y(yTop + dy + 2.4), y1 = Y(yTop + dy); g.fillStyle = '#0a0806'; g.fillRect(x0, y0, x1 - x0, y1 - y0); D.gline(g, D.rectPts(x0, y0, x1 - x0, y1 - y0), { w: Math.max(.8, lw) }); });
    // core interior backdrop
    const c0 = X(-WALL), c1 = X(WALL);
    g.fillStyle = bg; g.fillRect(c0, Math.max(0, Y(yTop)), c1 - c0, 1080);
  }
  for (let f = fLo; f <= fHi; f++) {
    const yF = f * FLOOR_H, yM = yF + FLOOR_H / 2;
    if (f > TOP_FLOOR) continue;
    // back wall panels: vertical fluting + a warm fan sconce at each landing
    const sc = [X(-WALL + .5), Y(yF + 2.3)];
    if (ppm > 20) { D.glow(g, sc[0], sc[1] - ppm * .6, ppm * 2.2, '#ffc36a', .3, 1.4); D.fan(g, sc[0], sc[1], ppm * .28, { ribs: 5, fill: '#c9a24b', ring: .25 }); }
    const sc2 = [X(WALL - .5), Y(yM + 2.3)];
    if (ppm > 20 && f < TOP_FLOOR) { D.glow(g, sc2[0], sc2[1] - ppm * .6, ppm * 1.8, '#ffc36a', .22, 1.4); D.fan(g, sc2[0], sc2[1], ppm * .24, { ribs: 5, fill: '#c9a24b', ring: .25 }); }
    // floor slab at the left landing (cut, poche with gold outline) + mid landing slab on the right
    const slab = (x0, x1, y) => {
      g.fillStyle = '#171109'; g.fillRect(X(x0), Y(y), X(x1) - X(x0), .3 * ppm);
      gl([[x0, y], [x1, y]], lw * 1.2); gl([[x0, y - .3], [x1, y - .3]], lw * .6, .7);
    };
    slab(-WALL, -HALF, yF);
    if (f < TOP_FLOOR) {
      slab(HALF, WALL, yM);
      // flights: A (left→right, yF→yM) and B (right→left, yM→yF+H)
      for (const [xa, ya, xb, yb, back] of [[HALF, yM, -HALF, yF + FLOOR_H, 1], [-HALF, yF, HALF, yM, 0]]) {
        g.save(); g.globalAlpha *= back ? .42 : 1;
        const n = 9, pts = [];
        for (let i = 0; i < n; i++) { const x0 = D.lerp(xa, xb, i / n), x1 = D.lerp(xa, xb, (i + 1) / n), y1 = D.lerp(ya, yb, (i + 1) / n); pts.push([x0, y1], [x1, y1]); }
        // underside (soffit) + treads filled
        const poly = [[xa, ya], ...pts, [xb, yb - .32], [xa, ya - .32]];
        g.beginPath(); poly.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.closePath();
        const fg = g.createLinearGradient(X(xa), 0, X(xb), 0); fg.addColorStop(0, '#1d150b'); fg.addColorStop(1, '#120d07'); g.fillStyle = fg; g.fill();
        gl([[xa, ya], ...pts], lw);
        gl([[xa, ya - .32], [xb, yb - .32]], lw * .6, .6);
        // gold handrail + chevron balusters
        const hr = .95;
        gl([[xa, ya + hr], [xb, yb + hr]], lw * 1.1);
        if (ppm > 25) for (let i = 1; i < n; i += 2) { const xm = D.lerp(xa, xb, i / n), ym = D.lerp(ya, yb, i / n); gl([[xm, ym + .12], [xm, ym + hr]], lw * .45, .6); }
        g.restore();
      }
    }
    // floor medallion + door on the left landing
    if (f >= 1) {
      const m = [X(-WALL + .75), Y(yF + 2.55)], r = Math.max(6, ppm * .42);
      if (ppm > 6) {
        const lit = o.litFloor != null ? D.clamp(1 - Math.abs(f - o.litFloor) * 1.2) : 0;
        if (ppm > 30) T.floorMedallion(g, String(f), m[0], m[1], r, { sub: f === TOP_FLOOR ? 'KITCHEN' : null, lit });
        else if (ppm > 8) { D.gline(g, D.arcPts(m[0], m[1], r, 0, D.TAU, 24), { w: 1 }); if (lit > .1) D.glow(g, m[0], m[1], r * 3, '#ffcf7a', .6 * lit); }
      }
      if (ppm > 30) { // door (left wall) — tall deco door with a fan light
        const dx0 = X(-WALL + .05), dw = .5 * ppm, dy0 = Y(yF + 2.1);
        g.fillStyle = '#0a0806'; g.fillRect(dx0, dy0, dw, 2.1 * ppm); D.gline(g, D.rectPts(dx0, dy0, dw, 2.1 * ppm), { w: lw * .8 });
      }
    }
  }
  // section walls (poche): thick black cut with gold outline and hatching
  for (const [x0, x1] of [[-WALL - .35, -WALL], [WALL, WALL + .35]]) {
    const a = X(x0), b = X(x1);
    const top = Math.max(0, Y(TOP_FLOOR * FLOOR_H + FLOOR_H));
    g.fillStyle = '#030202'; g.fillRect(a, top, b - a, 1080 - top);
    g.save(); g.beginPath(); g.rect(a, 0, b - a, 1080); g.clip(); g.strokeStyle = 'rgba(201,162,75,.28)'; g.lineWidth = 1;
    const step = Math.max(8, ppm * .25); for (let k = -1080; k < 1080 + (b - a); k += step) { g.beginPath(); g.moveTo(a + k, 0); g.lineTo(a + k + 1080, 1080); g.stroke(); }
    g.restore();
    D.gline(g, [[a, top], [a, 1080]], { w: lw * 1.2 }); D.gline(g, [[b, top], [b, 1080]], { w: lw * 1.2 });
  }
  // tall windows in the right wall (openings in the poche) every floor
  if (ppm > 14) for (let f = fLo; f <= fHi && f < TOP_FLOOR; f++) {
    const yw = f * FLOOR_H + FLOOR_H / 2 + .9, a = X(WALL), b = X(WALL + .35);
    g.fillStyle = 'rgba(255,190,110,.35)'; g.fillRect(a, Y(yw + 1.6), b - a, 1.6 * ppm); D.gline(g, D.rectPts(a, Y(yw + 1.6), b - a, 1.6 * ppm), { w: lw * .6 });
  }

  return { X, Y };
}
