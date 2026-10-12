// bug.mjs — a beetle-ish enemy: glossy domed shell with spots, head with glowing eyes and mandibles, six
// legs that scuttle, antennae. Same textured style as the ant (gradient, hatch, specular, rim light).
//
// LOCAL SPACE: facing -x (it walks toward a hero on its left), origin on the ground under the shell,
// feet on y = 0. Shell ≈ 170 × 90 at s = 1.   bug(ctx, x, groundY, s, pose)
// pose: { shell: colour, flip (face +x), gait, rot, squash (0..1 flattened), flash, jaw (0..1), angry,
//         hurt (x eyes), horns (boss), t }
import { clamp, lerp, rad, ellipse, stroke, fill, line, at, poly, hatch, INK } from "../core.mjs";

function shade(hex, k) { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(clamp(k > 0 ? v + (255 - v) * k : v * (1 + k), 0, 255))); return `rgb(${c.join(",")})`; }

export function bug(ctx, x, y, s = 1, p = {}) {
  const col = p.shell || "#6A3FA0", flip = !!p.flip, sq = p.squash || 0, t = p.t || 0, ph = p.gait;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (flip ? -1 : 1), s * (1 - sq * .65));
  if (!p.rot) { ctx.save(); ctx.globalAlpha *= .25; ellipse(ctx, 0, 2, 105, 9); fill(ctx, "#1A1020"); ctx.restore(); }
  if (p.rot) { ctx.translate(0, -60); ctx.rotate(p.rot); ctx.translate(0, 60); }
  // legs (three pairs): hip under the shell, knee out and up beside it, foot splayed on the ground
  const legs = (far) => { for (let i = 0; i < 3; i++) {
    const hx = -40 + i * 40 + (far ? 10 : 0), hy = -36, set = (i % 2) ^ (far ? 1 : 0), sw = ph === undefined ? 0 : Math.sin(ph + set * Math.PI) * 16, lift = ph === undefined ? 0 : Math.max(0, Math.cos(ph + set * Math.PI)) * 9;
    const kx = hx + (i - 1) * 46 - 8 + sw * .5, ky = -30 - lift, fx = hx + (i - 1) * 64 - 16 + sw, fy = -lift;
    line(ctx, [[hx, hy], [kx, ky], [fx, fy]], far ? 6 : 7.6, INK); line(ctx, [[hx, hy], [kx, ky], [fx, fy]], far ? 3 : 4, far ? "#2E2238" : "#4A3858");
    line(ctx, [[fx, fy], [fx - 9, fy + 1]], 3, INK); } };
  legs(true);
  // shell
  const SH = () => { ctx.beginPath(); ctx.moveTo(-88, -34); ctx.bezierCurveTo(-92, -112, 70, -118, 84, -40); ctx.quadraticCurveTo(0, -26, -88, -34); ctx.closePath(); };
  const g = ctx.createRadialGradient(-20, -100, 10, 0, -60, 120); g.addColorStop(0, shade(col, .35)); g.addColorStop(.6, col); g.addColorStop(1, shade(col, -.45)); SH(); fill(ctx, g);
  ctx.save(); SH(); ctx.clip();
  hatch(ctx, () => ellipse(ctx, 10, -40, 100, 30), rad(-40), 6, "#140A1E", 1.2, .35, [-100, -120, 100, -20]);
  line(ctx, [[-2, -104], [-4, -32]], 3, "rgba(20,10,30,.6)");                                   // elytra seam
  for (const [sx, sy, r] of [[-50, -70, 11], [-22, -88, 9], [28, -86, 10], [50, -62, 12], [-6, -58, 8]]) { ellipse(ctx, sx, sy, r, r * .8); fill(ctx, shade(col, -.55)); }
  ctx.beginPath(); ctx.ellipse(0, -70, 84, 40, 0, .3, 2.6); stroke(ctx, 3, "rgba(255,200,255,.25)");
  ctx.restore(); SH(); stroke(ctx, 3.4);
  ellipse(ctx, -34, -96, 22, 7, -.3); fill(ctx, "rgba(255,255,255,.6)");
  legs(false);
  if (p.horns) { for (const [hx2, a] of [[-40, -.5], [30, .4]]) { ctx.beginPath(); ctx.moveTo(hx2 - 8, -104); ctx.quadraticCurveTo(hx2 + a * 30, -150, hx2 + a * 50, -168); ctx.quadraticCurveTo(hx2 + a * 16, -130, hx2 + 8, -106); ctx.closePath(); fill(ctx, "#E8DCC0"); stroke(ctx, 2.8); } }
  // head
  ctx.save(); ctx.translate(-92, -46);
  ellipse(ctx, 0, 0, 30, 25); const hg = ctx.createRadialGradient(-8, -10, 2, 0, 0, 32); hg.addColorStop(0, shade(col, -.1)); hg.addColorStop(1, shade(col, -.6)); fill(ctx, hg); stroke(ctx, 3);
  // mandibles
  const j = p.jaw || 0; for (const sg of [-1, 1]) at(ctx, -24, 8, 1, sg * (.2 + j * .6), () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-26, sg * 4, -30, sg * 16); ctx.lineTo(-20, sg * 8); ctx.lineTo(-14, sg * 12); ctx.quadraticCurveTo(-8, sg * 4, 0, sg * 6); ctx.closePath(); fill(ctx, "#2A1E30"); stroke(ctx, 2); });
  if (j > .3) { ellipse(ctx, -26, 8, 10 * j, 12 * j); fill(ctx, "#5A0E1A"); }
  // eyes
  for (const [ex, ey] of [[-10, -8], [8, -12]]) {
    if (p.hurt) { line(ctx, [[ex - 6, ey - 6], [ex + 6, ey + 6]], 3.4); line(ctx, [[ex + 6, ey - 6], [ex - 6, ey + 6]], 3.4); continue; }
    const gl = ctx.createRadialGradient(ex, ey, 1, ex, ey, 16); gl.addColorStop(0, "rgba(255,80,60,.55)"); gl.addColorStop(1, "rgba(255,80,60,0)"); ctx.fillStyle = gl; ctx.fillRect(ex - 16, ey - 16, 32, 32);
    ellipse(ctx, ex, ey, 7, 8); fill(ctx, "#FF4A36"); stroke(ctx, 2); ellipse(ctx, ex - 2, ey - 3, 2.2, 2.2); fill(ctx, "#fff");
    if (p.angry) line(ctx, [[ex - 10, ey - 14 + (ex < 0 ? -4 : 2)], [ex + 10, ey - 14 + (ex < 0 ? 2 : -4)]], 4); }
  // antennae
  for (const [ax, sw] of [[-4, 0], [10, 1.3]]) { const w = Math.sin(t * 8 + sw) * 8; ctx.beginPath(); ctx.moveTo(ax, -22); ctx.quadraticCurveTo(ax - 10, -60, ax - 34 + w, -70); stroke(ctx, 3); ellipse(ctx, ax - 34 + w, -70, 4.5, 4.5); fill(ctx, INK); }
  ctx.restore();
  if (p.flash > 0) { ctx.save(); ctx.globalAlpha *= p.flash; SH(); fill(ctx, "#FFFFFF"); ellipse(ctx, -92, -46, 30, 25); fill(ctx, "#FFFFFF"); ctx.restore(); }
  ctx.restore();
}
