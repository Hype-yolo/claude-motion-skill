import { writeShui, shuiStrokes, cutStroke } from './glyph.js';
import { renderFrame } from './frames.js';
import { renderSheet } from './sheet.js';
import { mk, draw, TONE, blot } from './ink.js';
import { hero, POSE } from './hero.js';
export function render(t, A, B, comp, mode) {
  A.clear();
  const L = A.ink;
  if (mode === 'faces') return renderFaces(t, A, comp);
  if (mode === 'pose') {
    A.clear(); const L = A.ink;
    const names = (new URLSearchParams(location.search).get('p') || 'leap,touch,skid').split(',');
    names.forEach((n, i) => hero(L, POSE[n], { x: 400 + i * 600, y: 900, s: 7, dir: -1, seed: 5 + i, t }));
    comp(A, null, { bleed: 6, rim: 1.0 }); return;
  }
  if (mode === 'frame') return renderFrame(t, A, comp, new URLSearchParams(location.search).get('f'));
  if (mode === 'glyph') {
    A.clear(); const c = A.cc;
    const fams = ['MaShanZheng', 'ZhiMangXing'];
    fams.forEach((f, i) => {
      const x0 = 100 + i * 900, y0 = 100, S = 800;
      c.strokeStyle = 'rgba(200,0,0,.35)'; c.lineWidth = 1;
      for (let k = 0; k <= 10; k++) { c.beginPath(); c.moveTo(x0 + k * 80, y0); c.lineTo(x0 + k * 80, y0 + S); c.stroke(); c.beginPath(); c.moveTo(x0, y0 + k * 80); c.lineTo(x0 + S, y0 + k * 80); c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,.8)'; c.font = `${S}px ${f}`; c.textBaseline = 'alphabetic'; c.textAlign = 'center';
      const m = c.measureText('水');
      c.fillText('水', x0 + S / 2, y0 + S / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
      c.fillStyle = 'red'; c.font = '20px sans-serif'; for (let k = 0; k <= 10; k++) { c.fillText(k * 10, x0 - 20, y0 + k * 80 + 6); c.fillText(k * 10, x0 + k * 80, y0 - 8); }
    });
    comp(A, null, { bleed: 1 }); return;
  }
  if (mode === 'shui') {
    A.clear();
    const b1 = [80, 140, 700]; writeShui(A.ink, B, b1, [1, 1, 1, 1]);
    const S2 = shuiStrokes([900, 140, 700]); for (const s2 of S2) draw(A.ink, s2, 1);
    const st = [[1, .5, 0, 0], [1, 1, 1, .6]];
    st.forEach((pr, i) => writeShui(A.ink, B, [1620, 100 + i * 330, 280], pr));
    comp(A, null, { bleed: 4, rim: 1 }); return;
  }
  if (mode === 'sheet') return renderSheet(t, A, comp);
  if (mode === 'hero') {
    const s = 4.2;
    hero(L, POSE.front, { x: 220, y: 500, s, seed: 1 });
    hero(L, POSE.stand, { x: 620, y: 500, s, seed: 2 });
    hero(L, POSE.back, { x: 1000, y: 500, s, seed: 3 });
    hero(L, POSE.stand, { x: 1400, y: 500, s, seed: 4, dir: -1 });
    hero(L, POSE.leap, { x: 300, y: 1010, s: 3.6, seed: 5 });
    hero(L, POSE.draw, { x: 750, y: 1010, s: 3.6, seed: 6 });
    hero(L, POSE.bow, { x: 1200, y: 1010, s: 3.6, seed: 7 });
    hero(L, POSE.backWrite, { x: 1600, y: 1010, s: 3.6, seed: 8 });
    comp(A, null, { bleed: 5, rim: 1.0 });
  }
}
import { face } from './face.js';
export function renderFaces(t, A, comp) {
  A.clear(); const L = A.ink;
  ['calm', 'alert', 'resolve', 'peace'].forEach((e, i) => face(L, e, { x: 260 + i * 460, y: 560, s: 5, seed: 3 }));
  comp(A, null, { bleed: 5, rim: 1.0 });
}
