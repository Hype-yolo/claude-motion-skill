// "The Honeybee, Plate VII" — a museum / science-card film in the copperplate engraving style.
// All words and data come from content.json. Timing is on a 96 BPM grid (1 beat = 0.625 s) and re-flows with the
// number of details (1–4). The scene only calls the engine (engine/*) and the specimen builders (subjects/*).
import * as B from './engine/burin.js';
import { drawSheet, paperTexture, borderInk, engraveText, writeScript, wrapLines, roundelFrame, PAL, FONTS, measure } from './engine/plate.js';
import { Wash } from './engine/wash.js';
import * as Cu from './engine/copper.js';
import { buildBee } from './subjects/bee.js';
import { buildDetail, DETAILS } from './subjects/details.js';
import { buildScallop } from './subjects/scallop.js';
const SUBJECTS = { bee: buildBee, scallop: buildScallop };
import { clamp, eio, eo, ss } from '/core/lib.js';

export const W = 1920, H = 1080, BEAT = 0.625;
const PLATE = [70, 44, 1850, 1036], BORDER = [100, 72, 1820, 1008];
const SLOTS = { UL: [300, 300], LL: [300, 700], LR: [1620, 700], UR: [1620, 300] }, SLOT_ORDER = ['UL', 'LL', 'LR', 'UR'], RR = 120;
const NOTE = { size: 29, width: 380, lead: 1.12 };               // one size for every note; long notes wrap, never shrink
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;

export function makeFilm(C, voiceDur = {}) {
  const subject = SUBJECTS[C.subject] ? C.subject : 'bee';
  const bee = SUBJECTS[subject]({ x: 960, y: 606, s: 1 });
  const details = (C.details || []).slice(0, 4);

  // ------------------------------------------------------------------ timeline (seconds)
  const T = {};
  T.hook = [0, 2.5]; T.lift = 2.0; T.peel = [2.5, 3.2];
  T.build = { ol: [2.6, 4.6], h1: [3.3, 5.5], h2: [4.4, 6.2], h3: [5.0, 6.9], border: [3.0, 5.6] };
  T.title = 6.25;
  T.d0 = 9.375;
  const dets = []; let s = T.d0;
  // role: 'A' the long signature detail, 'B' a tilt-down detail (only as the 2nd of 3–4), 'C' pull-back-then-push; the score uses the same roles
  const roleOf = i => i === 0 ? 'A' : (i === 1 && details.length > 2) ? 'B' : 'C';
  details.forEach((d, i) => { const D = i === 0 ? 9 * BEAT : 7 * BEAT; dets.push({ ...d, i, s, D, long: i === 0, role: roleOf(i) }); s += D; });
  T.dEnd = s; T.gather = [s, s + 2 * BEAT]; T.silence = [s + 2 * BEAT, s + 4 * BEAT];
  T.colour = [s + 4 * BEAT, s + 12 * BEAT]; T.landing = [s + 12 * BEAT, s + 19 * BEAT]; T.end = [s + 19 * BEAT, s + 26 * BEAT];
  const DUR = T.end[1];

  // ------------------------------------------------------------------ ink schedules
  const ink = bee.ink;
  ink.schedule('ol0', -2.6, 4.2, { conc: 1 });
  ink.schedule('ol', ...T.build.ol, { conc: 16 });
  ink.schedule('h1', ...T.build.h1, { conc: 70 });
  ink.schedule('h2', ...T.build.h2, { conc: 70 });
  ink.schedule('h3', ...T.build.h3, { conc: 90 });
  ink.build();
  // the traced design: faint scratches on the copper that the burin will follow
  const guide = new B.Ink(); guide.S = ink.S.filter(x => x.g === 'ol' || x.g === 'ol0').map(x => ({ ...x, s0: -20, s1: -19 })); guide.build();
  const frameInk = new B.Ink(); borderInk(frameInk, BORDER); frameInk.schedule('main', ...T.build.border, { conc: 1.2 }); frameInk.build();

  // ------------------------------------------------------------------ details: slots, focus side, roundel content, timing
  const natSlot = SLOT_ORDER[details.length] || null;
  const OBST = subject === 'bee' ? ['wings', 'thorax', 'abdomen', 'head'] : Object.keys(bee.regions);
  const obstacles = name => OBST.filter(k => k !== name).flatMap(k => bee.regions[k] ? bee.regions[k].polys : []);
  for (const d of dets) {
    d.slotName = SLOT_ORDER[d.i]; d.slot = SLOTS[d.slotName];
    const f = bee.focus[d.focus] || bee.focus.eye;
    const left = d.slot[0] < W / 2, mx = x => left === (x < 960) ? x : 1920 - x;   // the instance on the slot's side
    d.f = { x: mx(f.x), y: f.y, r: f.r };
    // a drawn magnification when the library has one for this part; otherwise the roundel magnifies the figure itself
    d.art = subject === 'bee' && DETAILS[d.focus] ? buildDetail(d.focus) : { magnify: true, regions: {} };
    // relative timing: the first detail is the long signature move; the second rides a tilt; later ones play wide
    const a = d.i === 0 ? { push: [0, 1.1], ring: [1.05, 1.45], burn: [1.1, 1.4], cont: [1.35, 3.5], travel: [1.9, 3.4], name: 3.3, latin: 3.6, note: 3.9 }
            : d.role === 'B' ? { push: [0, 1.0], ring: [0.5, 0.8], burn: [0.52, 0.75], cont: [0.7, 2.2], travel: [0.8, 1.8], name: 1.9, latin: 2.15, note: 2.4 }
                        : { push: [0, 1.0], ring: [0.5, 0.8], burn: [0.52, 0.75], cont: [0.7, 2.2], travel: [0.9, 2.1], name: 2.0, latin: 2.25, note: 2.5 };
    for (const k in a) a[k] = Array.isArray(a[k]) ? a[k].map(v => v + d.s) : a[k] + d.s;
    d.a = a;
    const [c0, c1] = a.cont, D = c1 - c0;
    if (!d.art.magnify) {
    d.art.ink.schedule('ol', c0, c0 + 0.5 * D, { conc: 12 });
    d.art.ink.schedule('h1', c0 + 0.2 * D, c0 + 0.78 * D, { conc: 60 });
    d.art.ink.schedule('h2', c0 + 0.42 * D, c0 + 0.92 * D, { conc: 60 });
    d.art.ink.schedule('h3', c0 + 0.5 * D, c1, { conc: 60 });
    d.art.ink.schedule('rule', c0 + 0.55 * D, c1, { conc: 30 });
    d.art.ink.build(); }
    d.lab = { name: `FIG. ${d.i + 1}  ·  ${String(d.name || '').toUpperCase()}`, latin: d.latin || '', note: d.note || '' };
    // the leader: straight if it can reach the roundel without crossing a wing or the body, else via a waypoint
    const obs = obstacles(subject === 'bee' ? ({ eye: 'head', hamuli: 'wings', corbicula: '' }[d.focus] ?? '') : '').filter(p => !B.inPoly([p], d.f.x, d.f.y));
    const rim = (px, py) => { const dx = px - d.slot[0], dy = py - d.slot[1], L = Math.hypot(dx, dy); return [d.slot[0] + dx / L * RR, d.slot[1] + dy / L * RR]; };
    const clear = (a0, b0) => { const L = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]); for (let q = 14; q < L; q += 4) { const x = a0[0] + (b0[0] - a0[0]) * q / L, y = a0[1] + (b0[1] - a0[1]) * q / L; for (let k = 0; k < 9; k++) { const rr = k ? 34 : 0, an = k * Math.PI / 4; if (B.inAny(obs, x + Math.cos(an) * rr, y + Math.sin(an) * rr)) return false; } } return true; };
    const len = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    let best = null; const r0 = rim(d.f.x, d.f.y);
    if (clear([d.f.x, d.f.y], r0)) best = { wp: null, L: len([d.f.x, d.f.y], r0) };
    else for (let gx = 140; gx <= 1780; gx += 20) for (let gy = 90; gy <= 990; gy += 20) {
      const wp = [gx, gy], r1 = rim(gx, gy); if (Math.hypot(gx - d.slot[0], gy - d.slot[1]) < RR + 20) continue;
      if (!clear([d.f.x, d.f.y], wp) || !clear(wp, r1)) continue; const L = len([d.f.x, d.f.y], wp) + len(wp, r1);
      if (!best || L < best.L) best = { wp, L };
    }
    d.wp = best ? best.wp : null;
    if (typeof location !== 'undefined' && location.search.includes('dbg')) console.warn('leader', d.focus, JSON.stringify(d.f), JSON.stringify(best), obs.length, obs.map(p => p.length).join(','));
  }

  // ------------------------------------------------------------------ hand colouring
  const colours = Object.fromEntries((C.colors || []).map(c => [c.region, c.color]));
  const wash = new Wash({ scale: 1.5 }), dWash = dets.map(() => new Wash({ scale: 0.55 }));
  const cOrder = (C.colors || []).map(c => c.region);
  const c0 = T.colour[0] + 0.1;
  cOrder.forEach((name, k) => {
    const r = bee.regions[name]; if (!r) return;
    const t0 = c0 + k * 0.42, origin = name === 'abdomen' ? [r.bbox[0] + (r.bbox[2] - r.bbox[0]) * 0.35, r.bbox[1] + (r.bbox[3] - r.bbox[1]) * 0.3] : null;
    wash.add({ path: r.path, polys: r.polys, color: colours[name], alpha: name === 'wings' ? 0.5 : name === 'pollen' ? 0.95 : 0.72, origin, t0, dur: name === 'wings' ? 1.6 : 1.25, seed: k + 1, spill: name === 'pollen' ? 2.5 : 3.5, lift: name === 'wings' ? 0.8 : 0.55 });
    dets.forEach((d, j) => { for (const [rn, rr] of Object.entries(d.art.regions)) { if (rn !== name && !(rn === 'hooks' && name === 'legs')) continue; dWash[j].add({ path: rr.path, polys: rr.polys, color: colours[name], alpha: name === 'wings' ? 0.45 : name === 'pollen' ? 0.92 : name === 'head' ? 0.4 : name === 'eyes' ? 0.55 : 0.6, t0: t0 + 0.15, dur: 1.3, seed: k + 11 + j, spill: 12, offset: [7, 5] }); } });
  });

  // ------------------------------------------------------------------ voice plan (lines from content.json; durations from the TTS)
  const lines = (C.voice && C.voice.lines) || [];
  const vd = id => voiceDur[id] || Math.max(1.6, (lines.find(l => l.id === id)?.text.length || 30) / 14);
  const vo = [];
  const put = (id, t) => { const l = lines.find(x => x.id === id); if (l) vo.push({ id, t0: t, t1: t + vd(id), text: l.text }); };
  put('title', T.title + 0.15);
  dets.forEach((d, i) => put('d' + (i + 1), d.s + (d.long ? 0.45 : 0.3)));
  put('close', T.colour[0] + 0.5);
  const subs = vo.map((v, i) => ({ t0: v.t0 - 0.1, t1: Math.min(v.t1 + 0.6, vo[i + 1] ? vo[i + 1].t0 - 0.2 : 1e9), text: v.text }));

  // ------------------------------------------------------------------ camera
  const first = ink.S.find(x => x.g === 'ol0');
  const tipAt = t => { const f = (first.n - 1) * clamp((t - first.s0) / (first.s1 - first.s0)), j = Math.min(first.n - 2, Math.floor(f)), u = f - j, xy = first.xy;
    const x = xy[2 * j] + (xy[2 * j + 2] - xy[2 * j]) * u, y = xy[2 * j + 1] + (xy[2 * j + 3] - xy[2 * j + 1]) * u;
    const k0 = Math.max(0, j - 3), k1 = Math.min(first.n - 1, j + 4), dx = xy[2 * k1] - xy[2 * k0], dy = xy[2 * k1 + 1] - xy[2 * k0 + 1], L = Math.hypot(dx, dy) || 1;
    return { x, y, dx: dx / L, dy: dy / L }; };
  const HOOKZ = 4.2;
  const followCam = t => { const tp = tipAt(Math.min(t, T.lift)); return { cx: tp.x + 20, cy: tp.y + 30, z: HOOKZ * (1 - 0.03 * Math.min(t, 3)), rot: -0.05 + 0.012 * Math.min(t, 3) }; };
  const WIDE = { cx: 960, cy: 540, z: 1, rot: 0 };
  const keys = [];
  const K = (t, c, e = eio) => keys.push([t, c, e]);
  K(T.peel[1], followCam(T.peel[1]));
  K(6.2, WIDE);
  K(T.d0, WIDE);
  const frameFor = d => {
    const cx = d.slot[0] < 960 ? 700 : 1258;
    if (d.i === 0) return { cx, cy: d.slot[1] < 540 ? 440 : 640, z: 1.45, rot: 0 };
    if (d.role === 'B') return { cx, cy: 702, z: 1.45, rot: 0 };
    return { cx, cy: d.slot[1] < 540 ? 378 : 702, z: 1.45, rot: 0 };        // read-in framing after the wide
  };
  for (const d of dets) {
    const a = d.a, fr = frameFor(d);
    if (d.i === 0) { d.st = { x: d.f.x + 14, y: d.f.y + 2 }; K(a.push[1], { cx: d.f.x + 18, cy: d.f.y + 4, z: 4.3, rot: 0.012 }); K(a.travel[0], { cx: d.st.x, cy: d.st.y, z: 4.5, rot: 0.01 }, x => x); K(a.travel[1] + 0.6, fr); K(d.s + d.D, fr, x => x); }
    else if (d.role === 'B') { K(a.push[1], fr); K(d.s + d.D, fr, x => x); }
    else { K(a.push[1], WIDE); K(d.s + 2.9, WIDE, x => x); K(d.s + 3.9, fr); K(d.s + d.D, fr, x => x); }
  }
  K(T.gather[1] - 0.1, WIDE); K(T.colour[0], WIDE);
  K(T.colour[0] + 2.5, { cx: 962, cy: 546, z: 1.02, rot: -0.0015 }); K(T.colour[1], WIDE);
  K(T.end[1] + 1, WIDE);
  const camAt = t => {
    if (t <= T.peel[1]) return followCam(t);
    // the signature move: the camera rides with the magnifying roundel as it lifts off the eye and carries it to its slot
    const d0 = dets[0];
    if (d0 && t >= d0.a.travel[0] && t <= d0.a.travel[1] + 0.6) {
      const a = d0.a, u = seg(t, a.travel[0], a.travel[1] + 0.6), r = roundelAt(d0, Math.min(t, a.travel[1])), fr = frameFor(d0);
      const z = Math.exp(lerp(Math.log(4.5), Math.log(fr.z), eio(u))), w = Math.pow(ss(u), 1.6), k0 = ss(seg(t, a.travel[0], a.travel[0] + 0.5));
      const fx = lerp(d0.st.x, r.x + (fr.cx - d0.slot[0]) * 0.35, k0), fy = lerp(d0.st.y, r.y + (fr.cy - d0.slot[1]) * 0.35, k0);
      return { cx: lerp(fx, fr.cx, w), cy: lerp(fy, fr.cy, w), z, rot: lerp(0.01, 0, u) };
    }
    let i = 0; while (i < keys.length - 1 && keys[i + 1][0] <= t) i++;
    const [ta, ca] = keys[i], nx = keys[i + 1]; if (!nx) return ca;
    const [tb, cb, e] = nx; const u = e(seg(t, ta, tb));
    const za = Math.log(ca.z), zb = Math.log(cb.z), z = Math.exp(lerp(za, zb, u));
    const wa = 1 / ca.z, wb = 1 / cb.z, v = Math.abs(wb - wa) > 1e-6 ? (1 / z - wa) / (wb - wa) : u;
    const k = Math.abs(za - zb) > 0.3 ? clamp(v) : u;
    return { cx: lerp(ca.cx, cb.cx, k), cy: lerp(ca.cy, cb.cy, k), z, rot: lerp(ca.rot || 0, cb.rot || 0, u) };
  };

  // ------------------------------------------------------------------ roundel state
  function roundelAt(d, t) {
    const a = d.a; if (t < a.ring[0]) return null;
    const u = eio(seg(t, ...a.travel));
    const x = lerp(d.f.x, d.slot[0], u), y = lerp(d.f.y, d.slot[1], u) - Math.sin(u * Math.PI) * 30, r = Math.exp(lerp(Math.log(d.f.r), Math.log(RR), u));
    return { x, y, r, ring: seg(t, ...a.ring), burn: seg(t, ...a.burn), travel: u };
  }

  // ------------------------------------------------------------------ render
  function applyCam(ctx, c, pre = null) { ctx.setTransform(1, 0, 0, 1, 0, 0); if (pre) ctx.transform(...pre); ctx.translate(W / 2, H / 2); ctx.rotate(c.rot || 0); ctx.scale(c.z, c.z); ctx.translate(-c.cx, -c.cy); }

  function drawLeader(ctx, d, r, t) {
    const f = [d.f.x, d.f.y];
    let wp = null; if (d.wp) { const m = [(f[0] + r.x) / 2, (f[1] + r.y) / 2]; wp = [lerp(m[0], d.wp[0], r.travel), lerp(m[1], d.wp[1], r.travel)]; }
    const aim = wp || f, dx = aim[0] - r.x, dy = aim[1] - r.y, L = Math.hypot(dx, dy) || 1; if (L < r.r + 6) return;
    const end = [r.x + dx / L * r.r, r.y + dy / L * r.r];
    ctx.save(); ctx.strokeStyle = PAL.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 0.95;
    ctx.beginPath(); ctx.moveTo(...f); if (wp) ctx.lineTo(...wp); ctx.lineTo(...end); ctx.stroke();
    ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(f[0], f[1], 1.7, 0, 7); ctx.fill(); ctx.restore();
    const nxt = wp || end, ddx = nxt[0] - f[0], ddy = nxt[1] - f[1], LL = Math.hypot(ddx, ddy) || 1;
    engraveText(ctx, String(d.i + 1), f[0] + ddx / LL * 26 + (-ddy / LL) * 11, f[1] + ddy / LL * 26 + (ddx / LL) * 11 + 5, { size: 15, italic: true, p: seg(t, d.a.travel[1] - 0.3, d.a.travel[1] + 0.2) });
  }

  function drawPaperScene(ctx, t, cam, { noColour = false, pre = null, inkOnly = false } = {}) {
    applyCam(ctx, cam, pre);
    if (!inkOnly) drawSheet(ctx, { W, H, plate: PLATE });
    if (!noColour) wash.draw(ctx, t);
    ink.draw(ctx, t);
    frameInk.draw(ctx, t);
    if (inkOnly) return;
    // titles
    const tt = T.title;
    engraveText(ctx, String(C.title || '').toUpperCase() + '.', 960, 132, { size: 50, weight: 600, track: 0.16, p: seg(t, tt, tt + 0.9) });
    engraveText(ctx, C.latin || '', 960, 170, { size: 24, italic: true, weight: 400, p: seg(t, tt + 0.45, tt + 1.1) });
    const tg = T.gather[0];
    engraveText(ctx, String(C.plate_no || '').toUpperCase() + '.', BORDER[2] - 16, 116, { size: 22, weight: 600, track: 0.12, align: 'right', p: seg(t, tg + 0.1, tg + 0.6) });
    engraveText(ctx, String(C.series || '').toUpperCase(), BORDER[0] + 16, 112, { size: 13, weight: 500, track: 0.22, align: 'left', p: seg(t, tg + 0.2, tg + 1.0) });
    // leaders under the roundels
    for (const d of dets) { const r = roundelAt(d, t); if (r && r.travel > 0) drawLeader(ctx, d, r, t); }
    // roundels
    dets.forEach((d, j) => {
      const r = roundelAt(d, t); if (!r) return;
      ctx.save(); ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.clip();
      ctx.globalAlpha = ss(r.burn);
      ctx.fillStyle = PAL.paper; ctx.fillRect(r.x - r.r, r.y - r.r, r.r * 2, r.r * 2);
      ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(paperTexture(W, H), 0, 0, W, H);
      ctx.globalAlpha = 0.55 * ss(r.burn); ctx.fillStyle = PAL.plateTone; ctx.fillRect(r.x - r.r, r.y - r.r, r.r * 2, r.r * 2);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.translate(r.x, r.y); const k = r.r / 500; ctx.scale(k, k);
      if (d.art.magnify) {
        const M = 500 / (d.f.r * 2.4), tb = t < d.a.cont[0] ? -99 : lerp(-2.7, 7.0, seg(t, ...d.a.cont));
        ctx.scale(M, M); ctx.translate(-d.f.x, -d.f.y);
        if (!noColour) wash.draw(ctx, t);
        ink.draw(ctx, tb, { wScale: 0.55 });
      } else {
        if (!noColour) dWash[j].draw(ctx, t);
        d.art.ink.draw(ctx, t, { wScale: Math.max(1, 0.55 / (k * cam.z)) ** 0.6 });
      }
      ctx.restore();
      roundelFrame(ctx, r.x, r.y, r.r, { p: r.ring, w: 2.0 });
      const lx = d.slot[0], ly = d.slot[1] + RR;
      if (t > d.a.name) {
        engraveText(ctx, d.lab.name, lx, ly + 36, { size: 17, weight: 600, track: 0.14, p: seg(t, d.a.name, d.a.name + 0.6) });
        engraveText(ctx, d.lab.latin, lx, ly + 64, { size: 20, italic: true, weight: 400, p: seg(t, d.a.latin, d.a.latin + 0.55) });
        const lines = wrapLines(ctx, d.lab.note, NOTE.width, { size: NOTE.size, font: FONTS.script });
        const np = seg(t, d.a.note, d.a.note + 1.1);
        lines.forEach((ln, q) => writeScript(ctx, ln, lx, ly + 100 + q * NOTE.size * NOTE.lead, { size: NOTE.size, p: clamp(np * lines.length - q) }));
      }
    });
    // an empty slot shows the specimen at natural size (the plate is ~20 cm wide, the bee ~13 mm long)
    if (natSlot && t > T.gather[0]) {
      const [sx, sy] = SLOTS[natSlot], k = 0.19, tb = lerp(2.4, 6.9, seg(t, T.gather[0], T.gather[1] - 0.1));
      ctx.save(); ctx.translate(sx, sy - 6); ctx.scale(k, k); ctx.translate(-960, -606);
      if (!noColour) wash.draw(ctx, t);
      ink.draw(ctx, tb, { wScale: 2.1 }); ctx.restore();
      engraveText(ctx, (C.nat_size_label || 'Natural size').toUpperCase(), sx, sy + 110, { size: 15, weight: 600, track: 0.2, p: seg(t, T.gather[0] + 0.4, T.gather[1]) });
    }
    // the caption (the call to action) and the engravers' signatures
    const tl = T.landing[0];
    engraveText(ctx, C.caption || '', 960, 988, { size: 22, italic: true, weight: 500, p: seg(t, tl + 0.05, tl + 0.8) });
    if (C.signature) {
      engraveText(ctx, C.signature.left || '', BORDER[0] + 4, 1026, { size: 13, italic: true, align: 'left', p: seg(t, tl + 1.0, tl + 1.4) });
      engraveText(ctx, C.signature.right || '', BORDER[2] - 4, 1026, { size: 13, italic: true, align: 'right', p: seg(t, tl + 1.2, tl + 1.6) });
    }
  }

  function screenOf(cam, x, y) { const m = new DOMMatrix().translateSelf(W / 2, H / 2).rotateSelf(cam.rot * 180 / Math.PI).scaleSelf(cam.z, cam.z).translateSelf(-cam.cx, -cam.cy); const p = m.transformPoint(new DOMPoint(x, y)); return [p.x, p.y]; }
  function drawCopperScene(ctx, t, cam) {
    applyCam(ctx, cam);
    Cu.drawCopper(ctx, [-300, -300, W + 300, H + 300]);
    Cu.copperLight(ctx, W, H, cam); applyCam(ctx, cam);
    guide.draw(ctx, Infinity, { color: 'rgba(255,226,196,0.4)', wScale: 0.3, dx: -0.25, dy: -0.25 });
    guide.draw(ctx, Infinity, { color: 'rgba(60,24,8,0.25)', wScale: 0.2, dx: 0.2, dy: 0.2 });
    Cu.drawGrooves(ctx, ink, Math.min(t, T.lift + 0.001), { zoom: cam.z });
    const tp = tipAt(Math.min(t, T.lift)), sp = screenOf(cam, tp.x, tp.y), dv = [tp.dx * Math.cos(cam.rot) - tp.dy * Math.sin(cam.rot), tp.dx * Math.sin(cam.rot) + tp.dy * Math.cos(cam.rot)];
    const lift = ss(seg(t, T.lift, T.lift + 0.35));
    const cut = (Math.min(t, T.lift) + 1.6) * 150;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    Cu.drawSwarf(ctx, sp, dv, cut, { s: 1.25 });
    Cu.drawBurin(ctx, sp, dv, { s: 1.1, lift });
    ctx.restore();
  }

  function drawSubs(ctx, t) {
    const sb = subs.find(x => t >= x.t0 && t < x.t1); if (!sb) return;
    const a = Math.min(seg(t, sb.t0, sb.t0 + 0.25), 1 - seg(t, sb.t1 - 0.2, sb.t1));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const size = 38, lines = wrapLines(ctx, sb.text, 860, { size, font: FONTS.script });
    const lh = size * 1.12, hgt = lines.length * lh + 24, wid = Math.max(...lines.map(l => measure(ctx, l, { size, font: FONTS.script, weight: 400 }).tw)) + 70;
    const y1 = 1058, y0 = y1 - hgt, x0 = 960 - wid / 2;
    ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(60,40,20,0.28)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#f4eddb'; ctx.beginPath();
    const R = B.RNG(7); ctx.moveTo(x0, y0); for (let x = x0; x <= x0 + wid; x += 14) ctx.lineTo(x, y0 + (R() - 0.5) * 2.2); for (let y = y0; y <= y1; y += 12) ctx.lineTo(x0 + wid + (R() - 0.5) * 2, y); for (let x = x0 + wid; x >= x0; x -= 14) ctx.lineTo(x, y1 + (R() - 0.5) * 2.2); for (let y = y1; y >= y0; y -= 12) ctx.lineTo(x0 + (R() - 0.5) * 2, y); ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent';
    lines.forEach((ln, i) => writeScript(ctx, ln, 960, y0 + 12 + lh * (i + 0.8), { size, color: '#2b1e14', p: 1, alpha: a }));
    ctx.restore();
  }

  function drawEnd(ctx, t) {
    const p = seg(t, T.end[0], T.end[0] + 0.7); if (p <= 0) return;
    const y = lerp(-H - 40, 0, eo(p));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(0, y);
    // tissue guard: translucent, faintly creased, falling over the plate
    ctx.fillStyle = 'rgba(246,241,229,0.9)'; ctx.fillRect(0, 0, W, H + 40);
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.25; ctx.drawImage(paperTexture(W, H), 0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createLinearGradient(0, H - 40, 0, H + 40); g.addColorStop(0, 'rgba(120,100,70,0)'); g.addColorStop(1, 'rgba(120,100,70,0.25)'); ctx.fillStyle = g; ctx.fillRect(0, H - 40, W, 80);
    const e0 = T.end[0] + 0.3, E = C.end || {}, q = (a, b) => seg(t, e0 + a, e0 + b);
    engraveText(ctx, String(E.film_title || C.title || '').toUpperCase(), 960, 420, { size: 46, weight: 600, track: 0.14, p: q(0, 0.5) });
    engraveText(ctx, E.style_name || 'Copperplate Engraving', 960, 478, { size: 27, italic: true, p: q(0.05, 0.45) });
    engraveText(ctx, 'LEMO-OPUSCAR', 960, 580, { size: 20, weight: 600, track: 0.3, p: q(0.1, 0.45) });
    engraveText(ctx, 'LemoLab × Claude Opus 5.5', 960, 622, { size: 23, italic: true, p: q(0.1, 0.45) });
    (E.credits || []).forEach((c, i) => engraveText(ctx, c, 960, 720 + i * 30, { size: 17, weight: 500, track: 0.04, p: q(0.15, 0.5) }));
    ctx.restore();
  }

  function render(ctx, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    const cam = camAt(t);
    if (t < T.peel[0]) drawCopperScene(ctx, t, cam);
    else if (t < T.peel[1]) drawPeel(ctx, t, cam);
    else drawPaperScene(ctx, t, cam);
    // print finish: a warm vignette
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (t >= T.peel[0]) { const vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.55, W / 2, H / 2, H * 1.15); vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(120,86,46,0.2)'); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    if (t >= T.peel[1] && !(typeof location !== 'undefined' && location.search.includes('nosub'))) drawSubs(ctx, t);
    drawEnd(ctx, t);
  }

  // the proof is pulled: the sheet peels back across the frame. Behind the fold, the printed face; ahead of it, the copper;
  // on the fold, the curling sheet shows its back with the print showing through, mirrored.
  function drawPeel(ctx, t, cam) {
    const u = ss(seg(t, ...T.peel)) * 0.7 + seg(t, ...T.peel) * 0.3, dir = [0.8, 0.6], span = 2700, off = lerp(-span / 2 - 260, span / 2 + 260, u);
    const c = [W / 2 - dir[0] * off, H / 2 - dir[1] * off], n = [-dir[1], dir[0]], fw = 380;
    const band = (d0, d1) => { const A = [c[0] + dir[0] * d0, c[1] + dir[1] * d0], Bp = [c[0] + dir[0] * d1, c[1] + dir[1] * d1]; ctx.beginPath(); ctx.moveTo(A[0] + n[0] * 3000, A[1] + n[1] * 3000); ctx.lineTo(A[0] - n[0] * 3000, A[1] - n[1] * 3000); ctx.lineTo(Bp[0] - n[0] * 3000, Bp[1] - n[1] * 3000); ctx.lineTo(Bp[0] + n[0] * 3000, Bp[1] + n[1] * 3000); ctx.closePath(); };
    drawCopperScene(ctx, t, cam);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); band(0, 4000); ctx.clip(); drawPaperScene(ctx, t, cam, { noColour: true }); ctx.restore();
    // shadow of the lifted sheet on the copper
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); band(-fw * 0.9, -fw * 2.2); ctx.clip();
    const sg = ctx.createLinearGradient(c[0] - dir[0] * fw * 0.9, c[1] - dir[1] * fw * 0.9, c[0] - dir[0] * fw * 2.2, c[1] - dir[1] * fw * 2.2); sg.addColorStop(0, 'rgba(30,10,2,0.6)'); sg.addColorStop(1, 'rgba(30,10,2,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H); ctx.restore();
    // the flap: mirror of the paper just behind the fold, seen from its back
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); band(0, -fw); ctx.clip();
    ctx.fillStyle = '#efe6d0'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(paperTexture(W, H), 0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    const dx = dir[0], dy = dir[1], cd = c[0] * dx + c[1] * dy, M = [1 - 2 * dx * dx, -2 * dx * dy, -2 * dx * dy, 1 - 2 * dy * dy, 2 * cd * dx, 2 * cd * dy];
    ctx.globalAlpha = 0.28; ctx.filter = 'blur(0.8px)';
    drawPaperScene(ctx, t, cam, { noColour: true, pre: M, inkOnly: true });
    ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fg = ctx.createLinearGradient(c[0], c[1], c[0] - dir[0] * fw, c[1] - dir[1] * fw);
    // the sheet bends like a cylinder: a dark crease at the fold, a bright roll, then it turns away from the light
    fg.addColorStop(0, 'rgba(70,52,28,0.55)'); fg.addColorStop(0.06, 'rgba(120,96,60,0.2)'); fg.addColorStop(0.22, 'rgba(255,252,242,0.55)'); fg.addColorStop(0.5, 'rgba(255,255,255,0.05)'); fg.addColorStop(0.85, 'rgba(120,96,60,0.25)'); fg.addColorStop(1, 'rgba(80,60,34,0.45)');
    ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.strokeStyle = 'rgba(80,60,34,0.5)'; ctx.lineWidth = 1.4; band(-fw, -fw - 0.01); ctx.stroke(); ctx.restore();
  }

  // ------------------------------------------------------------------ events (sound cues) for the mixer
  const EV = [];
  EV.push({ t: 0, type: 'burin', until: T.lift });
  EV.push({ t: T.lift, type: 'lift' });
  EV.push({ t: T.peel[0] - 0.25, type: 'press' }, { t: T.peel[0], type: 'peel' });
  EV.push({ t: T.build.ol[0], type: 'hatch', until: T.build.h3[1] });
  for (const g of ['ol', 'h1', 'h2', 'h3']) EV.push({ t: T.build[g][0], type: 'pass', g });
  EV.push({ t: T.title, type: 'title', n: [...String(C.title || '')].length + 1, dur: 0.9 });
  for (const d of dets) EV.push({ t: d.a.push[0], type: 'push', i: d.i, role: d.role, dur: d.D }, { t: d.a.ring[0], type: 'ring', i: d.i }, { t: d.a.burn[0], type: 'burnish', i: d.i }, { t: d.a.cont[0], type: 'cut', until: d.a.cont[1], i: d.i }, { t: d.a.travel[0], type: 'travel', until: d.a.travel[1], i: d.i }, { t: d.a.travel[1], type: 'land', i: d.i }, { t: d.a.name, type: 'letters', dur: 0.6 }, { t: d.a.note, type: 'quill', dur: 1.1, i: d.i });
  EV.push({ t: T.gather[0], type: 'natsize' }, { t: T.silence[0], type: 'silence', until: T.silence[1] });
  cOrder.forEach((name, k) => EV.push({ t: c0 + k * 0.42, type: 'drop', region: name }));
  EV.push({ t: T.landing[0], type: 'landing' }, { t: T.landing[0] + 0.05, type: 'letters', dur: 0.75 }, { t: T.landing[0] + 1.0, type: 'dot' }, { t: T.landing[0] + 1.2, type: 'dot' }, { t: T.end[0] - 0.2, type: 'tissue' });
  vo.forEach(v => EV.push({ t: v.t0, type: 'vo', id: v.id, dur: v.t1 - v.t0 }));
  EV.sort((a, b) => a.t - b.t);

  return { render, DUR, T, EV, subs, dets, cam: camAt };
}
