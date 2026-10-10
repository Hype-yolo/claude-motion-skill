// 字幕 = 题跋：斜体焦墨小字，放在画面留白处，句首一枚小朱印；墨晕出现/化开
import { clamp } from '/core/lib.js';
import { VERM } from './hero.js';
export function subtitle(A, text, x, y, a = 1, o = {}) {
  if (a <= 0) return;
  const size = o.size || 46, lines = text.split('\n');
  const c = A.cd, w = A.cw;
  // 出现时先"湿"（进 wet 层晕开），再"干"（dry 层清晰）
  const wetK = o.wetK ?? clamp(1 - a) * .8;
  for (const [ctx, k] of [[w, wetK], [c, 1 - wetK * .6]]) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = clamp(a * k * .9); ctx.fillStyle = '#000';
    ctx.font = `italic 500 ${size}px Cormorant`; ctx.letterSpacing = '1px'; ctx.textBaseline = 'alphabetic';
    lines.forEach((ln, i) => ctx.fillText(ln, x + size * .62, y + i * size * 1.22));
    ctx.restore();
  }
  // 句首小印
  const s = size * .32, cc = A.cc;
  cc.save(); cc.setTransform(1, 0, 0, 1, 0, 0); cc.globalAlpha = clamp(a * .92); cc.fillStyle = `rgb(${VERM.join(',')})`;
  cc.fillRect(x, y - size * .36 - s / 2, s, s); cc.restore();
}
