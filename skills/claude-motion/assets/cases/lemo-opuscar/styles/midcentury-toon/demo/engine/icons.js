// Icon library, drawn in the mid-century manual style (flat off-register colour + broken ink).
// icon(ctx, name, cx, cy, size, o) — size = box edge in px. Designed in a 200-unit box centred on 0,0.
// Names: dock, phone, start, cable, wifi, plug, water, beans, cup, filter, box, clock, check, leaf, key, bulb, spark, gear
import { PAL, shape, ink, ellipse, rrect, rect, spline, starPts, xform, TAU, sparkle } from './toon.js';

const L = 5; // nominal ink width in icon units (scaled)
export const ICONS = {
  dock(ctx, c) {
    shape(ctx, spline([[-64, 70], [-56, -30], [-36, -44], [36, -44], [56, -30], [64, 70]], true, 5), { fill: c.light, line: L, seed: 1, shade: [{ pts: [[26, -50], [70, -50], [70, 72], [36, 72]], color: PAL.paperD }] });
    shape(ctx, rrect(-38, -22, 76, 40, 9), { fill: c.main, line: L * 0.7, seed: 2 });
    for (let i = 0; i < 3; i++) ink(ctx, [[-26, -12 + i * 10], [26, -12 + i * 10]], 3, { color: c.dark, seed: 3 + i, taper: false });
    shape(ctx, rect(-28, 44, 14, 26), { fill: PAL.chrome, line: 3, seed: 7 }); shape(ctx, rect(14, 44, 14, 26), { fill: PAL.chrome, line: 3, seed: 8 });
    ink(ctx, spline([[64, 50], [86, 58], [92, 84]], false, 6), 5, { seed: 9 });
  },
  phone(ctx, c) {
    shape(ctx, rrect(-50, -86, 100, 172, 18), { fill: PAL.ink, line: 0, seed: 11, off: [0, 0] });
    shape(ctx, rrect(-40, -70, 80, 128, 6), { fill: c.light, line: 0, seed: 12 });
    // wifi fan on screen
    for (let i = 0; i < 3; i++) ink(ctx, ellipse(0, 20, 14 + i * 14, 14 + i * 14, 16, -Math.PI * 0.78, -Math.PI * 0.22), 5.5, { color: c.main, seed: 13 + i, taper: false });
    shape(ctx, ellipse(0, 20, 6, 6, 10), { fill: c.main, line: 0, seed: 16 });
    shape(ctx, ellipse(0, 72, 7, 7, 12), { fill: PAL.inkSoft, line: 0, seed: 17, off: [0, 0] });
  },
  start(ctx, c) {
    shape(ctx, ellipse(0, 10, 86, 34, 40), { fill: c.dark, line: L, seed: 21 });
    shape(ctx, [[-86, 10], [-86, -8], ...ellipse(0, -8, 86, 34, 40, Math.PI, TAU), [86, 10], ...ellipse(0, 10, 86, 34, 40, 0, Math.PI)], { fill: c.light, line: 0, seed: 22 });
    shape(ctx, ellipse(0, -8, 86, 34, 40), { fill: c.main, line: L, seed: 23 });
    ink(ctx, ellipse(0, -10, 22, 10, 20, -Math.PI / 2 + 0.8, Math.PI * 1.5 - 0.8), 5, { seed: 24, color: PAL.white });
    ink(ctx, [[0, -26], [0, -10]], 5, { seed: 25, color: PAL.white, taper: false });
    // press finger arrow
    shape(ctx, [[-10, -120], [10, -120], [10, -76], [24, -76], [0, -52], [-24, -76], [-10, -76]], { fill: PAL.coral, line: 3.5, seed: 26 });
  },
  cable(ctx, c) {
    const pts = []; for (let i = 0; i <= 80; i++) { const u = i / 80, a = u * TAU * 2.2; pts.push([-70 + u * 110 + Math.cos(a) * 30, Math.sin(a) * 30 + (u - 0.5) * 40]); }
    ink(ctx, pts, 7, { seed: 31, taper: false });
    shape(ctx, rrect(40, -8, 38, 30, 6), { fill: c.light, line: 4, seed: 32 });
    ink(ctx, [[78, 0], [94, 0]], 4, { seed: 33, taper: false }); ink(ctx, [[78, 14], [94, 14]], 4, { seed: 34, taper: false });
    // the "lift it" arrow
    shape(ctx, [[-60, -58], [-44, -58], [-44, -92], [-30, -92], [-52, -118], [-74, -92], [-60, -92]], { fill: c.main, line: 3.5, seed: 35 });
  },
  wifi(ctx, c) { for (let i = 0; i < 3; i++) ink(ctx, ellipse(0, 50, 36 + i * 32, 36 + i * 32, 18, -Math.PI * 0.8, -Math.PI * 0.2), 12, { color: i === 2 ? c.main : PAL.ink, seed: 41 + i, taper: false }); shape(ctx, ellipse(0, 50, 14, 14, 12), { fill: c.main, line: 4, seed: 44 }); },
  plug(ctx, c) {
    shape(ctx, rrect(-40, -40, 80, 70, 14), { fill: c.light, line: L, seed: 51 });
    shape(ctx, rect(-24, -80, 12, 42), { fill: PAL.chrome, line: 3.5, seed: 52 }); shape(ctx, rect(12, -80, 12, 42), { fill: PAL.chrome, line: 3.5, seed: 53 });
    ink(ctx, spline([[0, 30], [0, 60], [30, 80], [70, 80]], false, 6), 7, { seed: 54 });
  },
  water(ctx, c) { shape(ctx, spline([[0, -90], [40, -20], [52, 30], [0, 76], [-52, 30], [-40, -20]], true, 8), { fill: c.main, line: L, seed: 61, shade: [{ pts: ellipse(20, 30, 40, 50, 20), color: c.dark, alpha: 0.4 }] }); sparkle(ctx, -18, 10, 18, { fill: PAL.white }); },
  beans(ctx, c) { [[-34, -10, 0.5], [30, 20, -0.4]].forEach(([x, y, a], i) => { shape(ctx, ellipse(x, y, 48, 34, 30, 0, TAU, a), { fill: c.dark === PAL.ink ? PAL.brown : PAL.brown, line: L, seed: 62 + i }); ink(ctx, xform(spline([[-38, 4], [-10, -8], [10, 8], [38, -4]], false, 5), x, y, a), 4, { seed: 64 + i }); }); },
  cup(ctx, c) {
    shape(ctx, [[-60, -40], [60, -40], [44, 60], [-44, 60]], { fill: c.main, line: L, seed: 71 });
    ink(ctx, ellipse(66, 6, 22, 26, 20, -1.4, 1.4), 7, { seed: 72 });
    shape(ctx, ellipse(0, 72, 84, 12, 30), { fill: c.light, line: 4, seed: 73 });
    for (let i = 0; i < 3; i++) ink(ctx, spline([[-26 + i * 26, -56], [-34 + i * 26, -76], [-22 + i * 26, -94]], false, 5), 5, { seed: 74 + i, color: PAL.inkSoft });
  },
  filter(ctx, c) { shape(ctx, [[-70, -50], [70, -50], [22, 60], [-22, 60]], { fill: c.light, line: L, seed: 81 }); for (let i = 0; i < 4; i++) ink(ctx, [[-50 + i * 30, -40], [-14 + i * 10, 50]], 3, { seed: 82 + i, color: c.dark }); },
  box(ctx, c) {
    shape(ctx, [[-70, -30], [70, -30], [70, 70], [-70, 70]], { fill: PAL.kraft, line: L, seed: 91, shade: [{ pts: [[30, -30], [70, -30], [70, 70], [30, 70]], color: PAL.kraftD }] });
    shape(ctx, [[-70, -30], [-96, -70], [-20, -70], [0, -30]], { fill: PAL.kraftL, line: 4, seed: 92 }); shape(ctx, [[70, -30], [96, -70], [20, -70], [0, -30]], { fill: PAL.kraftL, line: 4, seed: 93 });
    shape(ctx, ellipse(-10, 20, 26, 26, 20), { fill: c.main, line: 3.5, seed: 94 });
  },
  clock(ctx, c) { shape(ctx, ellipse(0, 0, 80, 80, 48), { fill: c.light, line: L, seed: 101 }); ink(ctx, [[0, 0], [0, -54]], 7, { seed: 102 }); ink(ctx, [[0, 0], [38, 18]], 7, { seed: 103 }); shape(ctx, ellipse(0, 0, 8, 8, 10), { fill: c.main, line: 0, seed: 104 }); },
  check(ctx, c) { shape(ctx, ellipse(0, 0, 80, 80, 48), { fill: c.main, line: L, seed: 111 }); ink(ctx, [[-36, 0], [-8, 28], [40, -30]], 16, { seed: 112, color: PAL.white, taper: false }); },
  leaf(ctx, c) { shape(ctx, spline([[0, 80], [-60, 10], [-30, -70], [0, -90], [30, -70], [60, 10]], true, 8), { fill: c.main, line: L, seed: 121 }); ink(ctx, [[0, 90], [0, -70]], 5, { seed: 122 }); },
  key(ctx, c) { shape(ctx, ellipse(-40, 0, 40, 40, 30), { fill: c.main, line: L, seed: 131 }); shape(ctx, ellipse(-40, 0, 14, 14, 16), { fill: PAL.paper, line: 3.5, seed: 132 }); shape(ctx, [[0, -10], [86, -10], [86, 10], [70, 10], [70, 30], [56, 30], [56, 10], [0, 10]], { fill: c.main, line: L, seed: 133 }); },
  bulb(ctx, c) { shape(ctx, spline([[0, -90], [56, -50], [40, 10], [24, 40], [-24, 40], [-40, 10], [-56, -50]], true, 8), { fill: c.light, line: L, seed: 141 }); shape(ctx, rrect(-24, 40, 48, 36, 6), { fill: PAL.chrome, line: 4, seed: 142 }); sparkle(ctx, 0, -40, 26, { fill: c.main }); },
  spark(ctx, c) { shape(ctx, starPts(0, 0, 86, 8, 0.4), { fill: c.main, line: L, seed: 151 }); sparkle(ctx, 0, 0, 40, { fill: PAL.white }); },
  gear(ctx, c) { const p = []; for (let i = 0; i < 32; i++) { const a = i / 32 * TAU, r = (i % 4 < 2) ? 84 : 64; p.push([Math.cos(a) * r, Math.sin(a) * r]); } shape(ctx, p, { fill: c.main, line: L, seed: 161 }); shape(ctx, ellipse(0, 0, 26, 26, 20), { fill: PAL.paper, line: 4, seed: 162 }); },
};
export function icon(ctx, name, cx, cy, size, o = {}) {
  const c = { main: o.main || PAL.teal, light: o.light || PAL.white, dark: o.dark || PAL.tealD };
  const f = ICONS[name] || ICONS.spark;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(size / 200, size / 200); f(ctx, c); ctx.restore();
}
