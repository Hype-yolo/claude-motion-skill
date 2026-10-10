import { PAL, fillPaper } from './paper.js';
import { drawGirl, GPOSE } from './girl.js';
import { T, S, mul } from './rig.js';
import { drawNian, NPOSE } from './nian.js';
import { tuanhua, tuanhuaHoles, wedgeFlat } from './tuanhua.js';
import { put } from './rig.js';
import { transmitOf } from './paper.js';
import { drawClimax } from './climax.js';
import { girlSheet, nianSheet } from './sheet.js';
export function test(g, mode, t, qs) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (mode === 'nian') {
    fillPaper(g, 'indigo', 0, 0, 1920, 1080);
    const k = +(qs.get('s') || .9); const pose = NPOSE[qs.get('pose')] ? NPOSE[qs.get('pose')] : qs.get('pose') === 'scared' ? { flip: true, lean: -.08, head: .22, jaw: .1, eye: 'squint', tail: -.5, pawUp: true, fnU: -1.75, fnL: -1.25, ffU: .25, ffL: -.1, bnU: -.18, bnL: .25, bfU: .1, bfL: .05 } : { jaw: +(qs.get('jaw') || 0), eye: qs.get('eye') || 'normal' };
    drawNian(g, [k, 0, 0, k, 1000, +(qs.get('y') || 560)], pose);
    drawGirl(g, [1, 0, 0, 1, 1700, 1000], {});
  }
  if (mode === 'tuan') {
    fillPaper(g, 'rice', 0, 0, 1920, 1080);
    put(g, tuanhua(), [1.1, 0, 0, 1.1, 500, 540]);
    // 背光版
    g.fillStyle = '#10131f'; g.fillRect(960, 0, 960, 1080);
    const gr = g.createRadialGradient(1440, 540, 0, 1440, 540, 520); gr.addColorStop(0, '#fff4d6'); gr.addColorStop(1, '#ffae52');
    g.fillStyle = gr; g.fillRect(1000, 80, 880, 920);
    const t = tuanhua();
    g.save(); g.globalCompositeOperation = 'multiply'; put(g, t, [1.1, 0, 0, 1.1, 1440, 540], { img: transmitOf(t), shadow: 0 }); g.restore();
  }
  if (mode === 'sheet_girl') girlSheet(g);
  if (mode === 'sheet_nian') nianSheet(g);
  if (mode === 'frame') { drawClimax(g, t, { lit: +(qs.get('lit') ?? 1) }); }
  if (mode === 'girl') {
    fillPaper(g, 'rice', 0, 0, 1920, 1080);
    const exprs = ['smile', 'surprise', 'scared', 'determined', 'sleep'];
    drawGirl(g, [2, 0, 0, 2, 300, 1000], { expr: 'smile' });
    exprs.forEach((e, i) => drawGirl(g, [1, 0, 0, 1, 700 + i * 250, 520], { expr: e, scissors: i === 3 ? { ang: -1.4, open: .4 } : null, handF: i === 3 ? 'fist' : 'open' }));
    fillPaper(g, 'indigo', 600, 560, 1320, 520);
    exprs.forEach((e, i) => drawGirl(g, [1.6, 0, 0, 1.6, 600 + i * 260, 1260], { expr: e }));
  }
}
