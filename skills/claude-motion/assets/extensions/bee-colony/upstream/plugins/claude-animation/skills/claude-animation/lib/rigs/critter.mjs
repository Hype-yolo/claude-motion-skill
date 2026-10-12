// critter.mjs — a blocky little hero built for action: squash & stretch, run, jump, flip, punch, kick,
// get hurt, charge up. Rounded block body with a faint pixel grid, two tall eyes, stub arms, four legs.
//
// LOCAL SPACE: facing +x, origin on the ground under the body centre; feet on y = 0. Body 130 × 100 at s = 1.
//   critter(ctx, x, groundY, s, pose)
// pose: {
//   color       body colour (default a warm orange)
//   flip        face -x
//   gait        run phase (radians); omit to stand
//   sq          squash/stretch: >1 = squashed (wide, short), <1 = stretched (tall, thin); about the feet
//   rot         whole-body spin about the body centre (flips, tumbles)
//   face        "normal" | "blink" | "happy" | "angry" | "hurt" | "surprised" | "focus"
//   punch       0..1 front arm jab (0 rest, 1 fully out); punchBack for the rear arm
//   kick        0..1 front leg kick
//   arms        "rest" | "up" (cheer) | "guard"
//   crouch      0..1 lowers the body (charging, before a jump)
//   aura        0..1 power-up glow + flame tongues
//   flash       0..1 white hit flash
//   air         true while airborne: legs tuck
// }
import { clamp, lerp, rad, ellipse, stroke, fill, line, at, poly, rrect, hatch, INK } from "../core.mjs";

function shade(hex, k) { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(clamp(k > 0 ? v + (255 - v) * k : v * (1 + k), 0, 255))); return `rgb(${c.join(",")})`; }

export function critter(ctx, x, y, s = 1, p = {}) {
  const col = p.color || "#D97757", flip = !!p.flip, sq = p.sq ?? 1, crouch = p.crouch || 0, face = p.face || "normal", t = p.t || 0;
  const BW = 130 * Math.sqrt(sq), BH = 100 / Math.sqrt(sq) * (1 - crouch * .18), LEG = p.air ? 8 : 14 * (1 - crouch * .5), cy = -LEG - BH / 2;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (flip ? -1 : 1), s);
  // aura behind everything
  if (p.aura > 0) { const a = p.aura, g = ctx.createRadialGradient(0, cy, 20, 0, cy, 170 + 40 * a); g.addColorStop(0, `rgba(255,190,110,${.55 * a})`); g.addColorStop(1, "rgba(255,190,110,0)"); ctx.fillStyle = g; ctx.fillRect(-260, cy - 260, 520, 520);
    for (let i = 0; i < 9; i++) { const u = i / 9, fx = -BW / 2 - 10 + u * (BW + 20), h = (60 + 50 * Math.abs(Math.sin(t * 9 + i * 1.7))) * a;
      ctx.beginPath(); ctx.moveTo(fx - 14, -LEG); ctx.quadraticCurveTo(fx - 18, -LEG - h * .6, fx + Math.sin(t * 7 + i) * 8, -LEG - BH - h * .4); ctx.quadraticCurveTo(fx + 18, -LEG - h * .6, fx + 14, -LEG); ctx.closePath();
      ctx.fillStyle = `rgba(255,${150 + (i % 3) * 30},70,${.35 * a})`; ctx.fill(); } }
  // contact shadow
  if (!p.air) { ctx.save(); ctx.globalAlpha *= .25; ellipse(ctx, 0, 2, BW * .62, 8); fill(ctx, "#2A1A10"); ctx.restore(); }
  ctx.save(); if (p.rot) { ctx.translate(0, cy); ctx.rotate(p.rot); ctx.translate(0, -cy); }
  // legs: four stubs, far pair darker; running alternates pairs
  const run = p.gait !== undefined, ph = p.gait || 0;
  const legX = [-44, -16, 16, 44];
  legX.forEach((lx, i) => { const far = i % 2 === 1, pair = (i === 0 || i === 3) ? 0 : 1, sw = run ? Math.sin(ph + pair * Math.PI) : 0;
    const lift = run ? Math.max(0, Math.cos(ph + pair * Math.PI)) * 10 : 0, kx = (p.kick && i === 3) ? p.kick * 60 : 0, ky = (p.kick && i === 3) ? -p.kick * 30 : 0;
    const L = p.air ? LEG + 4 : LEG, x0 = lx * (BW / 130) + sw * 12, y0 = -L - lift * .5;
    if (kx) { poly(ctx, rrect(x0 - 8, -L - 10, 16 + kx, 16, 6)); fill(ctx, shade(col, -.15)); stroke(ctx, 2.6); poly(ctx, rrect(x0 + kx - 4, -L - 16 + ky * .2, 22, 26, 7)); fill(ctx, shade(col, .05)); stroke(ctx, 2.8); return; }
    poly(ctx, rrect(x0 - 8, y0 - 4, 16, L + 4 - lift * .5, 4)); fill(ctx, far ? shade(col, -.35) : shade(col, -.15)); stroke(ctx, 2.6); });
  // rear arm
  const arm = (front, jab) => { const ax = front ? BW / 2 - 6 : -BW / 2 + 6, ay = cy + 8, up = p.arms === "up", guard = p.arms === "guard";
    const ext = jab * 78, ex = ax + (front ? 1 : -1) * (up ? 4 : 10) + (front ? ext : ext * .6 * (front ? 1 : 1)), ey = up ? ay - 48 : guard ? ay - 18 : ay + 6 - jab * 6;
    const fx = front ? ex : (jab > 0 ? ax + ext : ex);
    ctx.save(); poly(ctx, rrect(Math.min(ax, fx) - 2, ey - 10, Math.abs(fx - ax) + 4 + 16, 20, 8)); fill(ctx, shade(col, front ? -.05 : -.3)); stroke(ctx, 2.6);
    if (jab > .3) { poly(ctx, rrect(fx + 4, ey - 15, 30, 30, 9)); fill(ctx, shade(col, .1)); stroke(ctx, 3); line(ctx, [[fx + 12, ey - 6], [fx + 12, ey + 6]], 2, "rgba(30,20,15,.5)"); }
    ctx.restore(); };
  arm(false, p.punchBack || 0);
  // body: gradient + pixel grid + hatch + rim + specular
  const B = rrect(-BW / 2, cy - BH / 2, BW, BH, 20);
  const g = ctx.createLinearGradient(-BW / 2, cy - BH / 2, BW / 2, cy + BH / 2); g.addColorStop(0, shade(col, .28)); g.addColorStop(.55, col); g.addColorStop(1, shade(col, -.28));
  poly(ctx, B); fill(ctx, g);
  ctx.save(); poly(ctx, B); ctx.clip();
  ctx.strokeStyle = "rgba(90,35,15,.12)"; ctx.lineWidth = 1.2; for (let gx = -BW / 2; gx < BW / 2; gx += 13) { ctx.beginPath(); ctx.moveTo(gx, cy - BH / 2); ctx.lineTo(gx, cy + BH / 2); ctx.stroke(); } for (let gy = cy - BH / 2; gy < cy + BH / 2; gy += 13) { ctx.beginPath(); ctx.moveTo(-BW / 2, gy); ctx.lineTo(BW / 2, gy); ctx.stroke(); }
  hatch(ctx, () => { ctx.beginPath(); ctx.rect(-BW / 2, cy + BH * .1, BW, BH); }, rad(-50), 6, "#7A2E14", 1, .3, [-BW / 2, cy, BW / 2, cy + BH / 2]);
  line(ctx, [[-BW / 2 + 14, cy + BH / 2 - 7], [BW / 2 - 14, cy + BH / 2 - 7]], 4, "rgba(255,210,170,.5)");
  ctx.restore();
  poly(ctx, B); stroke(ctx, 3.4);
  poly(ctx, rrect(-BW / 2 + 12, cy - BH / 2 + 9, BW * .32, 10, 5)); fill(ctx, "rgba(255,255,255,.55)");
  // eyes (side view: both on the front half)
  const ex = [BW * .1, BW * .34], eyY = cy - BH * .06;
  const eye = (xx) => {
    if (face === "blink") line(ctx, [[xx - 7, eyY + 4], [xx + 7, eyY + 4]], 4);
    else if (face === "happy") { ctx.beginPath(); ctx.moveTo(xx - 9, eyY + 6); ctx.lineTo(xx, eyY - 6); ctx.lineTo(xx + 9, eyY + 6); stroke(ctx, 4.4); }
    else if (face === "hurt") { line(ctx, [[xx - 8, eyY - 8], [xx + 8, eyY + 8]], 4); line(ctx, [[xx + 8, eyY - 8], [xx - 8, eyY + 8]], 4); }
    else { const tall = face === "surprised" ? 32 : face === "focus" ? 16 : 26, w = face === "surprised" ? 15 : 13;
      poly(ctx, rrect(xx - w / 2, eyY - tall / 2, w, tall, 4)); fill(ctx, "#1A120E"); ellipse(ctx, xx - 2, eyY - tall / 2 + 6, 3, 4); fill(ctx, "#fff");
      if (face === "angry" || face === "focus") line(ctx, [[xx - 12, eyY - tall / 2 - 12 + (xx > BW * .2 ? 6 : 0)], [xx + 12, eyY - tall / 2 - 12 + (xx > BW * .2 ? 0 : 6)]], 5); } };
  ex.forEach(eye);
  if (face === "surprised") { ctx.font = "bold 64px sans-serif"; ctx.fillStyle = INK; ctx.fillText("!", BW * .2, cy - BH / 2 - 26); }
  if (face === "happy" || face === "hurt") { ellipse(ctx, BW * .44, cy + BH * .22, 9, 5); fill(ctx, "rgba(229,72,77,.45)"); }
  // front arm on top
  arm(true, p.punch || 0);
  // hit flash
  if (p.flash > 0) { ctx.save(); ctx.globalAlpha *= p.flash; poly(ctx, B); fill(ctx, "#FFFFFF"); ctx.restore(); }
  ctx.restore();
  ctx.restore();
}
