import { g, C, clear, paperFinish, label, W, H } from './paper.js';
import { loadFonts } from './glyph.js';
import { agentSide, agentFront, courierSide, courierFront, key, runPose, walkPose, coRunPose, AGENT_POSE, COURIER_POSE } from './chars.js';
import { modelSheet } from './sheet.js';
import { frame } from './frames.js';
import { renderFilm, DUR, events, setLines, subs } from './film.js';
import { titleGeom } from './scenes.js';
import { drawTitle } from './title.js';
const Q = new URLSearchParams(location.search);
await Promise.all(['400 40px LGothic', '400 40px LSpartan', '600 40px LSpartan', '700 40px LSpartan', '800 40px LSpartan'].map(f => document.fonts.load(f)));
await loadFonts();
const lines = await (await fetch('lines.json')).json();
const dur = await (await fetch('voices/dur.json')).json();
setLines(lines, dur);
window.DUR = DUR; window.EV = events(); window.SUBS = subs();
window.render = t => {
  if (Q.get('test') === 'chars') {
    clear(C.mus);
    agentSide(150, 560, .8, AGENT_POSE.stand);
    agentFront(330, 560, .8); agentFront(480, 560, .8, true);
    for (let i = 0; i < 8; i++) agentSide(640 + i * 150, 560, .7, runPose(i / 8));
    ['flatten', 'skid', 'overShoulder', 'leap', 'reach'].forEach((k, i) => agentSide(150 + i * 230, 1040, .75, AGENT_POSE[k]));
    for (let i = 0; i < 3; i++) courierSide(1330 + i * 190, 1040, .66, i < 2 ? walkPose(i * .25) : coRunPose(.3));
    courierSide(1850, 1040, .66, COURIER_POSE.lookBack);
    key(1880, 120, 1.2, 0);
    paperFinish();
    return;
  }
  if (Q.has('sheet')) { modelSheet(t, Q); paperFinish(); return; }
  if (Q.has('frame')) { frame(Q.get('frame'), t, Q); paperFinish(); return; }
  renderFilm(t, { nosub: Q.has('nosub') });
  if (Q.has('poster')) {   // 海报：列车定格那一格 + 天上一行纸白片名
    const G = titleGeom();
    g.setTransform(1, 0, 0, 1, 0, 0); g.translate(1235, 150); g.scale(.36, .36); g.translate(-(G.x + G.w / 2), -(G.y + G.h / 2));
    drawTitle(G.x, G.y, 250, { split: 0, col: C.paper, holeCol: C.ink });
    key(G.khx, G.khy, G.kh, 0, { line: 1.2 });
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  paperFinish();
};
window.READY = true;
