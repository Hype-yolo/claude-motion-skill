// fx.mjs — game-feel effects, all pure functions of time (seeded, no state between frames).
//   hit-stop:      const tw = timeWarp(STOPS); g = tw.game(t) (freezes on contacts); tw.real(g) for sound cues
//   screen shake:  const [dx, dy] = shake(t, [[t0, amp], ...])
//   particles:     sparks / debris / dust / confetti / rising embers bursting at t0
//   impact:        ring(), flashAlpha(), comicText(), floatText(), afterimages via a draw callback
//   shapes:        starburst() (rounded-ray spark), heart(), speed lines are in core.mjs
import { clamp, lerp, eOut, eIn, eBack, rng, hash, ellipse, stroke, fill, line, at, poly, INK } from "./core.mjs";

// ---------------------------------------------------------------- hit-stop: game time freezes briefly on contact
// stops: [[gameTime, duration], ...] in GAME time. game(t) maps real -> game; real(g) maps game -> real.
export function timeWarp(stops) {
  const S = [...stops].sort((a, b) => a[0] - b[0]);
  return {
    game(t) { let acc = 0; for (const [s, d] of S) { if (t < s + acc) break; if (t < s + acc + d) return s; acc += d; } return t - acc; },
    real(g) { let acc = 0; for (const [s, d] of S) { if (s >= g) break; acc += d; } return g + acc; },
    frozen(t) { let acc = 0; for (const [s, d] of S) { if (t < s + acc) break; if (t < s + acc + d) return true; acc += d; } return false; },
  };
}
// ---------------------------------------------------------------- screen shake: decaying, deterministic
export function shake(t, events, dur = .45) {
  let x = 0, y = 0;
  for (const [t0, amp] of events) { const d = t - t0; if (d < 0 || d > dur) continue; const k = Math.exp(-d * 9) * amp;
    x += Math.sin(d * 97 + t0) * k; y += Math.cos(d * 83 + t0 * 3) * k * .8; }
  return [x, y];
}
// ---------------------------------------------------------------- particles
// kind: "spark" (streaks), "debris" (tumbling chunks), "dust" (puffs), "confetti", "ember" (rising glow)
export function burstParticles(ctx, t, t0, x, y, o = {}) {
  const d = t - t0, { n = 14, speed = 520, life = .6, gravity = 900, colors = ["#FFD35A", "#FFF3C4", "#F28C28"], size = 8, kind = "spark", seed = 1, spread = Math.PI * 2, dir = -Math.PI / 2 } = o;
  if (d < 0 || d > life * 1.6) return;
  const r = rng(seed * 977 + Math.floor(t0 * 1000));
  for (let i = 0; i < n; i++) {
    const a = dir + (r() - .5) * spread, sp = speed * (.45 + r() * .75), L = life * (.6 + r() * .6), dd = Math.min(d, L), fade = 1 - clamp(d / L);
    if (fade <= 0) { r(); r(); continue; }
    const px = x + Math.cos(a) * sp * dd, py = y + Math.sin(a) * sp * dd + (kind === "ember" ? -gravity * .3 * dd * dd : .5 * gravity * dd * dd), col = colors[i % colors.length], sz = size * (.6 + r() * .8);
    ctx.save(); ctx.globalAlpha *= fade;
    if (kind === "spark") { const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp + gravity * dd, vl = Math.hypot(vx, vy) || 1; line(ctx, [[px, py], [px - vx / vl * sz * 3, py - vy / vl * sz * 3]], sz * .55, col); }
    else if (kind === "debris") { at(ctx, px, py, 1, d * (6 + i), () => { poly(ctx, [[-sz, -sz * .6], [sz * .8, -sz], [sz, sz * .7], [-sz * .7, sz]]); fill(ctx, col); stroke(ctx, 1.8); }); }
    else if (kind === "dust") { const s2 = sz * (1 + d * 3); ellipse(ctx, px, py, s2, s2 * .7); fill(ctx, col); }
    else if (kind === "confetti") { at(ctx, px, py, 1, d * 8 + i, () => { ctx.scale(Math.cos(d * 10 + i), 1); ctx.fillStyle = col; ctx.fillRect(-sz / 2, -sz * .7, sz, sz * 1.4); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.strokeRect(-sz / 2, -sz * .7, sz, sz * 1.4); }); }
    else if (kind === "ember") { const g = ctx.createRadialGradient(px, py, 0, px, py, sz * 2); g.addColorStop(0, col); g.addColorStop(1, "rgba(255,200,80,0)"); ctx.fillStyle = g; ctx.fillRect(px - sz * 2, py - sz * 2, sz * 4, sz * 4); }
    ctx.restore();
  }
}
// dust puff at the feet on landing (two clouds sliding out sideways)
export function landDust(ctx, t, t0, x, y, s = 1, color = "rgba(214,190,150,.85)") {
  const d = t - t0; if (d < 0 || d > .5) return; const k = eOut(d / .5), a = 1 - d / .5;
  ctx.save(); ctx.globalAlpha *= a; for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) { const px = x + sg * (30 + k * (70 + i * 30)) * s, py = y - (6 + i * 7) * s - k * 10 * s, r = (16 + i * 5) * s * (1 - .3 * k);
    ellipse(ctx, px, py, r, r * .75); fill(ctx, color); ellipse(ctx, px, py, r, r * .75); stroke(ctx, 1.6, "rgba(90,70,50,.5)"); } ctx.restore();
}
// expanding shock ring
export function ring(ctx, t, t0, x, y, r1 = 160, { dur = .35, w = 10, color = "#FFF3C4", squash = 1 } = {}) {
  const d = t - t0; if (d < 0 || d > dur) return; const k = eOut(d / dur);
  ctx.save(); ctx.globalAlpha *= 1 - d / dur; ctx.beginPath(); ctx.ellipse(x, y, Math.max(1, r1 * k), Math.max(1, r1 * k * squash), 0, 0, Math.PI * 2); ctx.lineWidth = w * (1 - k * .7); ctx.strokeStyle = color; ctx.stroke(); ctx.restore();
}
// full-frame (or local) white flash intensity after a hit
export const flashAlpha = (t, t0, dur = .12) => (t < t0 || t > t0 + dur) ? 0 : 1 - (t - t0) / dur;
// radial impact spikes (comic "pow" star) behind a word
export function impactStar(ctx, x, y, r, n = 12, color = "#FFD35A", rot = 0) {
  const P = []; for (let i = 0; i < n * 2; i++) { const a = rot + i / (n * 2) * Math.PI * 2, rr = i % 2 ? r * .55 : r * (1 + .12 * hash(i)); P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  poly(ctx, P); fill(ctx, color); poly(ctx, P); stroke(ctx, 4);
}
// comic word that slams in over an impact star and holds, e.g. "POW!", "HIT!", "K.O."
export function comicText(ctx, t, t0, x, y, str, { size = 90, dur = .7, color = "#FFFFFF", star = "#FFD35A", rot = -.12, font = "sans-serif" } = {}) {
  const d = t - t0; if (d < 0 || d > dur) return; const k = eBack(clamp(d / .16), 2.6), out = 1 - clamp((d - dur + .15) / .15);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k * out, k * out);
  if (star) impactStar(ctx, 0, -size * .3, size * 1.25, 12, star, d * 2);
  ctx.font = `${size}px "${font}"`; ctx.textAlign = "center"; ctx.lineJoin = "round"; ctx.lineWidth = size * .16; ctx.strokeStyle = INK; ctx.strokeText(str, 0, 0); ctx.fillStyle = color; ctx.fillText(str, 0, 0);
  ctx.restore();
}
// a number or word that pops and floats up, e.g. "+100", "-12"
export function floatText(ctx, t, t0, x, y, str, { size = 44, color = "#FFFFFF", dur = .8, rise = 90, font = "sans-serif" } = {}) {
  const d = t - t0; if (d < 0 || d > dur) return; const k = eBack(clamp(d / .15), 2), a = 1 - clamp((d - dur * .6) / (dur * .4));
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y - eOut(d / dur) * rise); ctx.scale(k, k); ctx.font = `${size}px "${font}"`; ctx.textAlign = "center"; ctx.lineJoin = "round";
  ctx.lineWidth = size * .18; ctx.strokeStyle = INK; ctx.strokeText(str, 0, 0); ctx.fillStyle = color; ctx.fillText(str, 0, 0); ctx.restore();
}
// afterimages: call draw(ctx, gamePastTime, alpha) for a few earlier moments (dashes, fast flips)
export function afterimages(ctx, g, draw, { n = 4, gap = .035, alpha = .35, tint = null } = {}) {
  for (let i = n; i >= 1; i--) { ctx.save(); ctx.globalAlpha *= alpha * (1 - i / (n + 1)); draw(ctx, g - i * gap, i); ctx.restore(); }
}
// a rounded-ray spark: the special-attack projectile, pickups, stars
export function starburst(ctx, x, y, r, { rays = 10, color = "#D97757", inner = .4, rot = 0, glow = 0, outline = true } = {}) {
  if (glow > 0) { const g = ctx.createRadialGradient(x, y, r * .2, x, y, r * 2.2); g.addColorStop(0, `rgba(255,190,120,${.7 * glow})`); g.addColorStop(1, "rgba(255,190,120,0)"); ctx.fillStyle = g; ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4); }
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const drawRays = () => { ctx.beginPath(); let first = true; const pt = (x2, y2) => { first ? ctx.moveTo(x2, y2) : ctx.lineTo(x2, y2); first = false; };
    for (let i = 0; i < rays; i++) { const a = i / rays * Math.PI * 2, w = Math.PI / rays * .85;
      pt(Math.cos(a - w) * r * inner, Math.sin(a - w) * r * inner);
      for (let k = 0; k <= 6; k++) { const aa = a - w * .35 + k / 6 * w * .7, rr = r * (1 - .06 * Math.pow((k - 3) / 3, 2)); pt(Math.cos(aa) * rr, Math.sin(aa) * rr); }
      pt(Math.cos(a + w) * r * inner, Math.sin(a + w) * r * inner); }
    ctx.closePath(); };
  drawRays(); const g2 = ctx.createRadialGradient(0, 0, r * .1, 0, 0, r); g2.addColorStop(0, "#FFD3B8"); g2.addColorStop(1, color); ctx.fillStyle = g2; ctx.fill(); if (outline) { ctx.lineWidth = Math.max(2, r * .045); ctx.strokeStyle = INK; ctx.lineJoin = "round"; ctx.stroke(); }
  ctx.restore();
}
export function heart(ctx, x, y, s, full = true) {
  const P = []; for (let i = 0; i <= 30; i++) { const a = i / 30 * Math.PI * 2; P.push([x + 16 * Math.pow(Math.sin(a), 3) * s, y - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * s]); }
  poly(ctx, P); fill(ctx, full ? "#E5484D" : "rgba(40,30,30,.35)"); if (full) { ellipse(ctx, x - 6 * s, y - 6 * s, 3.5 * s, 2.5 * s, -.5); fill(ctx, "rgba(255,255,255,.8)"); } poly(ctx, P); stroke(ctx, 3);
}
