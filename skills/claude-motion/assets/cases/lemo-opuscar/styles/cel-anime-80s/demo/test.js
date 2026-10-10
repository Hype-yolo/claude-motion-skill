// 角色单独试画：index.html?test=model（角色设定表）| side | bust
import { canvas, W, H, LWK } from './cel.js';
import { PAL } from './pal.js';
import { riderSide } from './rider.js';
import { head80 } from './head80.js';
function cell(g, x, y, w, h, label, fn) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = '#e4e0e8'; g.fillRect(x, y, w, h);
  fn(); g.restore();
  g.strokeStyle = '#8a8494'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle = '#3a3448'; g.font = '600 26px "Barlow SC"'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(label, x + 16, y + 12);
}
export function test(g, glow, t, name) {
  g.fillStyle = '#6b7a9a'; g.fillRect(0, 0, W, H);
  if (name === 'model') {
    g.fillStyle = '#cfcad6'; g.fillRect(0, 0, W, H);
    const P = PAL.day, v = new URLSearchParams(location.search).get('v') || '1';
    g.fillStyle = '#2a2436'; g.font = 'italic 800 40px Kanit'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('NIGHTBIRD — MODEL SHEET v' + v, 24, 14);
    g.font = '500 22px "Barlow SC"'; g.fillText('City Lights, 1987 · 80s cel anime · neutral light', 640, 30);
    const top = [['3/4  (determined)', 'q', 'determined'], ['PROFILE', 'side', 'determined'], ['FRONT', 'front', 'determined']];
    top.forEach(([lab, view, expr], i) => cell(g, i * 640, 70, 640, 560, lab, () => { g.translate(i * 640 + 330, 70 + 270); g.scale(1.5, 1.5); head80(g, P, { view, expr, wind: .15 }); }));
    const ex = [['DETERMINED', 'determined'], ['PANTING', 'panting'], ['SMILE', 'smileopen'], ['SURPRISED', 'surprised']];
    ex.forEach(([lab, expr], i) => cell(g, i * 480, 630, 480, 450, lab, () => { g.translate(i * 480 + 250, 630 + 225); g.scale(1.35, 1.35); head80(g, P, { view: 'q', expr, wind: .15 }); }));
  }
  if (name === 'close') {
    g.fillStyle = '#cfcad6'; g.fillRect(0, 0, W, H);
    [['3/4  DETERMINED', 'determined'], ['3/4  SMILE', 'smileopen']].forEach(([lab, expr], i) => cell(g, i * 960, 0, 960, 1080, lab, () => { g.translate(i * 960 + 500, 520); g.scale(3.9, 3.9); LWK.k = .7; head80(g, PAL.day, { view: 'q', expr, wind: .15, detail: true }); LWK.k = 1; }));
  }
  if (name === 'side') {
    g.save(); g.translate(960, 900); g.scale(1.25, 1.25); riderSide(g, PAL.day, { ph: t, wheelA: t * 3, speed: .2 }); g.restore();
  }
}
