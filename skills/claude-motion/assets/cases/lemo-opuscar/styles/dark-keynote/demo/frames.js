// frames.js — 关卡风格帧 / 引擎示例
import * as E from './engine.js';
export function engineDemo(g, t) {
  E.bg(g); E.grid(g, { ox: 960, oy: 540 });
  const pts = []; for (let i = 0; i <= 40; i++) { const u = i / 40; pts.push([360 + u * 1100, 640 - Math.sin(u * Math.PI) * 260 + Math.sin(u * 9) * 20]); }
  E.setAccent('#D97757'); E.trail(g, pts, { width: 8 });
  const p = E.sparklePath(1480, 380, 90, 0.2); E.litShape(g, p, { accent: true, glowR: 40, bbox: [1390, 290, 180, 180] });
  E.caret(g, 1560, 380, 120); E.setAccent('#B7F34A');
  const card = new Path2D(); card.roundRect(300, 200, 420, 160, 28); E.litShape(g, card, { sweep: 0.5, bbox: [300, 200, 420, 160] });
}

// 海报：揭幕后的 Tidy 窗口 + 片名
import { renderFilm } from './film.js';
export function poster(g) {
  const [c, cg] = E.buf('posterSrc'); renderFilm(cg, 23.6, { nosub: true });
  E.bg(g); E.grid(g, { ox: 960, oy: 540, alpha: 0.6 });
  // 画面边缘羽化，避免缩小后的画框露出矩形边
  cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = 'destination-in';
  const m = cg.createRadialGradient(960, 560, 520, 960, 560, 1080); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  cg.fillStyle = m; cg.fillRect(0, 0, 1920, 1080); cg.globalCompositeOperation = 'source-over';
  const s = 0.8; g.drawImage(c, 960 - 960 * s, 1080 - 1080 * s + 20, 1920 * s, 1080 * s);
  const vg = g.createLinearGradient(0, 0, 0, 330); vg.addColorStop(0, 'rgba(10,11,15,1)'); vg.addColorStop(1, 'rgba(10,11,15,0)'); g.fillStyle = vg; g.fillRect(0, 0, 1920, 330);
  g.font = E.font(112, 600); g.fillStyle = E.PAL.text; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  if (g.letterSpacing !== undefined) g.letterSpacing = '-3px';
  g.fillText('Room to Think', 960, 170); const w = g.measureText('Room to Think').width;
  if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
  E.caret(g, 960 + w / 2 + 26, 132, 104, {});
  g.font = E.font(24, 500, 'mono'); g.fillStyle = E.PAL.dim; if (g.letterSpacing !== undefined) g.letterSpacing = '4px';
  g.fillText('A LAUNCH FILM FOR TIDY  ·  DARK TECH KEYNOTE  ·  LEMO-OPUSCAR', 960, 232); if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
  g.textAlign = 'left'; E.vignette(g, 0.4);
}
