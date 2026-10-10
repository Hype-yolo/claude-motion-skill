// 单独的引擎演示帧（STYLE.md §10 用）：?scene=star&t=…
import { Holo, modelFromPath, normalizeModel, drawPad, drawScanPlane } from './engine/holo.js';
import * as U from './engine/hud.js';
const W = 1920, H = 1080;
// 暖橙色四角光点 + 一截光标尾巴：用"唯一彩色"keep 保持它自己的颜色，其余按全息主色
export function star(g, t) {
  const T = U.theme(188, 38), holo = new Holo(W, H);
  const P = []; for (let i = 0; i < 8; i++) { const a = Math.PI / 2 + i * Math.PI / 4, r = i % 2 ? 0.16 : 0.5; P.push([Math.cos(a) * r, Math.sin(a) * r + 0.6]); }
  const star = modelFromPath(P, { depth: 0.12, id: 'star', slices: 3 });
  const tail = modelFromPath([[0.62, 0.1], [0.7, 0.1], [0.7, 0.55], [0.62, 0.55]], { depth: 0.06, id: 'caret' });
  const m = { name: 'demo', parts: [...star.parts, ...tail.parts] };
  m.byId = Object.fromEntries(m.parts.map(p => [p.id, p]));
  normalizeModel(m, 1.6);
  const cam = { target: [0, 0.55, 0], yaw: 0.5 + t * 0.2, pitch: 0.18, dist: 2.6, fov: 0.6, cx: W / 2, cy: H * 0.5 };
  U.background(g, W, H, T, { cx: W / 2, cy: H / 2 });
  drawPad(g, cam, W, H, { hue: T.hue, rot: t * 0.2 });
  const sy = Math.min(1.4, t * 0.6);
  const info = holo.draw(g, m, cam, { hue: T.hue, scan: t < 2.4 ? { y: sy } : null, solid: t > 2.6 ? 1 : 0, keep: { star: '#D97757' } });
  if (t < 2.4) drawScanPlane(g, cam, W, H, sy, { hue: T.hue, r: 0.9 });
  U.targetBox(g, T, info.bbox.star, t > 2.4 ? 1 : 0, { tag: 'TGT 01 · LOCK', lockK: Math.min(1, (t - 2.4) * 4) });
  U.vignette(g, W, H, 0.5);
}
