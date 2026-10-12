// bean.mjs — the brush-ink + watercolour cast: a bean-bodied person with stick limbs, a head-and-
// shoulders bust, a speech bubble and a waving flag. Drawn with a Pen (lib/pen.mjs), so they draw
// themselves on and boil like everything else in that style.
//   pen.begin("hero", reveal); person(pen, x, groundY, scale, { hat: "peci", shirt: "#F2C230", walk: t * 9 }, t);
// options: skin, shirt, hair, hat (peci|pith|helmet|turban|fez|cap), glasses (sun|round), arms [l, r]
// (degrees from straight down, outward positive), bend [l, r], face (smile|open|flat|sad), walk (phase),
// look (eye shift px), mustache, sash, medals, jacketLine, mask, flip, still, dip.
import { lerp, rad, ellPts, rrect } from "../core.mjs";
const INK = "#2A2420", RED = "#D0312D", WHITE = "#FBF7EE", GOLD = "#E3B64B", NAVY = "#3C4A6B", SAND = "#D8C7A0";
export const SKIN = ["#D9A273", "#C68A5A", "#E9C29C", "#A8704A", "#F0CDB0", "#8E5B3A"];

// bean body, stick limbs, washed head and clothes. Local space: feet at 0, 1 unit = 1 px at s=1.
export function person(p, x, y, s, o, t) {
  const ctx = p.ctx;
  let bob = o.still ? 0 : Math.sin(t * 4.2 + x * .013) * 2.2, lg = [0, 0];
  if (o.walk != null) { const ph = o.walk; lg = [Math.sin(ph) * 24, -Math.sin(ph) * 24]; bob = -Math.abs(Math.cos(ph)) * 7; }
  ctx.save(); ctx.translate(x, y + bob * s); ctx.scale(s * (o.flip ? -1 : 1), s);
  const hy = -212 + (o.dip || 0), sk = o.skin || SKIN[0];
  // head
  p.wash(ellPts(0, hy, 31, 30, 18), sk, { alpha: .75 });
  p.ring(0, hy, 32, 31, { w: 4.2 });
  if (o.hair) p.wash([[-31, hy - 4], [-28, hy - 24], [-10, hy - 33], [12, hy - 33], [29, hy - 22], [31, hy - 6], [18, hy - 18], [-6, hy - 20]], o.hair, { alpha: .9 });
  hat(p, o.hat, hy, o);
  // face
  const bl = ((t + x * .0137) % 3.3) < .12;
  const ex = o.look || 0;
  if (o.glasses === "sun") { p.wash(ellPts(-12 + ex, hy - 1, 11, 8, 12), INK, { alpha: .9 }); p.wash(ellPts(12 + ex, hy - 1, 11, 8, 12), INK, { alpha: .9 }); p.stroke([[-2 + ex, hy - 2], [2 + ex, hy - 2]], { w: 3 }); }
  else {
    if (bl) { p.stroke([[-16 + ex, hy - 1], [-8 + ex, hy - 1]], { w: 3 }); p.stroke([[8 + ex, hy - 1], [16 + ex, hy - 1]], { w: 3 }); }
    else if (o.face === "sad") { p.stroke([[-17 + ex, hy + 1], [-12 + ex, hy - 4], [-7 + ex, hy + 1]], { w: 3 }); p.stroke([[7 + ex, hy + 1], [12 + ex, hy - 4], [17 + ex, hy + 1]], { w: 3 }); }
    else { p.dot(-12 + ex, hy - 1, 3.8); p.dot(12 + ex, hy - 1, 3.8); }
    if (o.glasses === "round") { p.ring(-12 + ex, hy - 1, 10, 10, { w: 2.6 }); p.ring(12 + ex, hy - 1, 10, 10, { w: 2.6 }); }
  }
  if (o.mustache) p.stroke([[-16, hy + 10], [-6, hy + 6], [0, hy + 9], [6, hy + 6], [16, hy + 10]], { w: 4.5, taper: .9 });
  const face = o.face || "smile";
  if (o.mask) { p.wash(rrect(-22, hy + 3, 44, 24, 8), "#E7F1F4", { alpha: .95 }); p.poly(rrect(-22, hy + 3, 44, 24, 8), { w: 2.8 }); p.stroke([[-22, hy + 8], [-31, hy]], { w: 2.2 }); p.stroke([[22, hy + 8], [31, hy]], { w: 2.2 }); }
  else if (face === "open") { p.wash(ellPts(0, hy + 14, 7, 8, 10), "#7A2A22", { alpha: .9 }); p.ring(0, hy + 14, 7, 8, { w: 2.6 }); }
  else if (face === "flat") p.stroke([[-8, hy + 15], [8, hy + 15]], { w: 3 });
  else if (face === "sad") p.stroke([[-9, hy + 18], [0, hy + 12], [9, hy + 18]], { w: 3 });
  else p.stroke([[-10, hy + 11], [0, hy + 17], [10, hy + 11]], { w: 3.2 });
  if (!o.mask && face !== "sad") { p.wash(ellPts(-20, hy + 9, 6, 4, 8), "#E58B7B", { alpha: .45 }); p.wash(ellPts(20, hy + 9, 6, 4, 8), "#E58B7B", { alpha: .45 }); }
  // body
  const torso = [[-22, -176], [22, -176], [30, -120], [31, -82], [-31, -82], [-30, -120]];
  p.wash(torso, o.shirt || WHITE, { alpha: .85, round: true });
  if (o.sash) p.wash([[-22, -172], [-10, -176], [30, -96], [22, -86]], o.sash, { alpha: .9 });
  if (o.jacketLine) p.stroke([[0, -176], [0, -84]], { w: 2.4 });
  p.blob(torso, { w: 4 });
  if (o.medals) { p.dot(-12, -150, 4, GOLD); p.dot(-4, -150, 4, RED); }
  // arms
  const [la, ra] = o.arms || [18, 18], [lb, rb] = o.bend || [0, 0];
  arm(p, -22, -166, la, lb, -1, sk); arm(p, 22, -166, ra, rb, 1, sk);
  // legs
  for (const [hx, a, sg] of [[-13, lg[0], -1], [13, lg[1], 1]]) {
    const fx = hx + Math.sin(rad(a)) * 80, fy = -82 + Math.cos(rad(a)) * 80;
    p.stroke([[hx, -84], [fx, fy]], { w: 5.2, taper: .3 });
    p.stroke([[fx - (sg < 0 ? 12 : 0), fy], [fx + (sg > 0 ? 12 : 0), fy]], { w: 6, taper: .2 });
  }
  ctx.restore();
}
function arm(p, sx, sy, a, b, sg, sk) {
  const d = (ang) => [sg * Math.sin(rad(ang)), Math.cos(rad(ang))];
  const [ux, uy] = d(a), ex = sx + ux * 42, ey = sy + uy * 42, [fx, fy] = d(a + b), hx = ex + fx * 40, hy = ey + fy * 40;
  p.stroke([[sx, sy], [ex, ey], [hx, hy]], { w: 4.6, taper: .3, smooth: false });
  p.wash(ellPts(hx, hy, 7, 7, 8), sk, { alpha: .8, wt: .2 }); p.ring(hx, hy, 7, 7, { w: 2.4, wt: .2 });
}
export function hat(p, kind, hy, o) {
  if (kind === "peci") { const P = [[-30, hy - 17], [-27, hy - 45], [27, hy - 45], [30, hy - 17], [0, hy - 21]]; p.wash(P, INK, { alpha: .92 }); p.poly([[-30, hy - 17], [-27, hy - 45], [27, hy - 45], [30, hy - 17]], { w: 3.4 }); }
  if (kind === "pith") { const P = []; for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI; P.push([Math.cos(a) * 36, hy - 14 + Math.sin(a) * 30]); }
    p.wash([...P, [48, hy - 12], [-48, hy - 12]], SAND, { alpha: .9 }); p.stroke(P, { w: 3.6 }); p.stroke([[-50, hy - 12], [50, hy - 12]], { w: 4 }); }
  if (kind === "helmet") { const P = []; for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI; P.push([Math.cos(a) * 37, hy - 6 + Math.sin(a) * 36]); }
    p.wash(P, "#3BAA5C", { alpha: .9 }); p.stroke([...P, P[0]], { w: 3.6 }); p.stroke([[10, hy - 8], [40, hy - 2]], { w: 3 }); }
  if (kind === "turban") { p.wash(ellPts(0, hy - 30, 36, 20, 14), WHITE, { alpha: .9 }); p.ring(0, hy - 30, 36, 20, { w: 3.2 }); p.stroke([[-30, hy - 30], [0, hy - 42], [30, hy - 26]], { w: 2.4 }); }
  if (kind === "fez") { const P = [[-22, hy - 22], [-18, hy - 56], [18, hy - 56], [22, hy - 22]]; p.wash(P, RED, { alpha: .9 }); p.poly(P, { w: 3.2 }); p.stroke([[0, hy - 56], [10, hy - 40]], { w: 2.2 }); }
  if (kind === "cap") { p.wash([[-32, hy - 12], [-26, hy - 34], [0, hy - 42], [26, hy - 34], [32, hy - 12], [56, hy - 10]], o.capColor || NAVY, { alpha: .9 }); p.stroke([[-32, hy - 12], [-26, hy - 34], [0, hy - 42], [26, hy - 34], [32, hy - 12], [56, hy - 10]], { w: 3.2 }); }
}
// head and shoulders only (delegates, masked faces)
export function bust(p, x, y, s, o, t) {
  const ctx = p.ctx; ctx.save(); ctx.translate(x, y + Math.sin(t * 3.3 + x) * 1.5); ctx.scale(s, s);
  const sh = [[-50, 0], [-44, -40], [-18, -60], [18, -60], [44, -40], [50, 0]];
  p.wash(sh, o.shirt || WHITE, { alpha: .85 }); p.stroke(sh, { w: 4, taper: .3 });
  const hy = -100, sk = o.skin || SKIN[0];
  p.wash(ellPts(0, hy, 31, 30, 18), sk, { alpha: .75 }); p.ring(0, hy, 32, 31, { w: 4.2 });
  if (o.hair) p.wash([[-31, hy - 4], [-28, hy - 24], [-10, hy - 33], [12, hy - 33], [29, hy - 22], [31, hy - 6], [18, hy - 18], [-6, hy - 20]], o.hair, { alpha: .9 });
  hat(p, o.hat, hy, o);
  const bl = ((t + x * .0137) % 3.1) < .12;
  if (bl) { p.stroke([[-16, hy - 1], [-8, hy - 1]], { w: 3 }); p.stroke([[8, hy - 1], [16, hy - 1]], { w: 3 }); } else { p.dot(-12, hy - 1, 3.8); p.dot(12, hy - 1, 3.8); }
  if (o.glasses === "round") { p.ring(-12, hy - 1, 10, 10, { w: 2.6 }); p.ring(12, hy - 1, 10, 10, { w: 2.6 }); }
  if (o.mask) { p.wash(rrect(-22, hy + 3, 44, 24, 8), "#E7F1F4", { alpha: .95 }); p.poly(rrect(-22, hy + 3, 44, 24, 8), { w: 2.8 }); p.stroke([[-22, hy + 8], [-31, hy]], { w: 2.2 }); p.stroke([[22, hy + 8], [31, hy]], { w: 2.2 }); }
  else p.stroke([[-10, hy + 11], [0, hy + 17], [10, hy + 11]], { w: 3.2 });
  ctx.restore();
}
export function bubble(p, x, y, str, o = {}) {
  const ctx = p.ctx; ctx.save(); ctx.font = `${o.size || 40}px "Patrick Hand"`;
  const w = ctx.measureText(str).width + 44, h = (o.size || 40) * 1.5; ctx.restore();
  const tail = o.tail ?? -1, B = rrect(x - w / 2, y - h / 2, w, h, h / 2);
  const tl = [[x + tail * w * .18 - 12, y + h / 2 - 3], [x + tail * w * .32, y + h / 2 + 22], [x + tail * w * .18 + 12, y + h / 2 - 3]];
  p.wash(B, WHITE, { alpha: .95, solid: true, wt: .2 }); p.wash(tl, WHITE, { alpha: .95, solid: true, wt: .1 });
  p.blob(B, { w: 3.6, wt: .6 }); p.stroke(tl, { w: 3.2, smooth: false, wt: .3 });
  p.text(str, x, y + (o.size || 40) * .33, { size: o.size || 40, color: o.color || INK, wt: .8 });
}
export function flagCloth(p, x, y, fw, fh, t, amp = 7) {           // waving red-white flag, hoisted at (x, y) top-left
  const n = 12, top = [], mid = [], bot = [];
  for (let i = 0; i <= n; i++) { const u = i / n, dx = u * fw, wv = Math.sin(u * 5.2 - t * 7.5) * amp * u, sq = Math.sin(u * 5.2 - t * 7.5 + .6) * 2 * u;
    top.push([x + dx - sq, y + wv]); mid.push([x + dx - sq, y + fh / 2 + wv]); bot.push([x + dx - sq, y + fh + wv]); }
  p.wash([...top, ...mid.slice().reverse()], RED, { alpha: .95, ox: x, oy: y + fh / 4 });
  p.wash([...mid, ...bot.slice().reverse()], WHITE, { alpha: .95, ox: x, oy: y + fh * .75, solid: true });
  p.stroke(top, { w: 3.2, taper: .3 }); p.stroke(bot, { w: 3.2, taper: .3 }); p.stroke([top[n], bot[n]], { w: 3, taper: .2, smooth: false });
}

