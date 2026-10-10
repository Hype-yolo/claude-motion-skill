// 字幕：手写体 Caveat，小而安静；从左到右"写"出来，淡出；背后一圈纸色光晕避开墨线
import { clamp, ss } from '/core/lib.js';
const INK = 'rgba(29,26,23,';
function halo(ctx, text, x, y, w) { ctx.strokeStyle = 'rgba(244,239,228,0.9)'; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.filter = 'blur(3px)'; ctx.strokeText(text, x, y); ctx.filter = 'none'; }

export function subtitle(ctx, text, t0, t1, t, W, H, opt = {}) {
  if (t < t0 - 0.01 || t > t1 + 0.45) return;
  const size = opt.size || 46, y = opt.y ?? H - 100;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `500 ${size}px Caveat`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const w = ctx.measureText(text).width, x0 = W / 2 - w / 2;
  const write = clamp((t - t0) / Math.min(0.85, 0.2 + text.length * 0.017));
  ctx.globalAlpha = 1 - clamp((t - t1) / 0.45);
  ctx.beginPath(); ctx.rect(x0 - 24, y - size * 1.3, (w + 48) * ss(write), size * 2); ctx.clip();
  halo(ctx, text, W / 2, y, 12);
  ctx.fillStyle = INK + '0.84)'; ctx.fillText(text, W / 2, y);
  ctx.restore();
}

// 片名：单线连笔的 Sacramento，从左到右写出，写在纸的空白处（画面右上，风筝在中间）
export function title(ctx, T, t, W, H) {
  if (t < T.t0 || t > T.t1 + 0.7) return;
  const y = 190;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '76px Sacramento'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const w = ctx.measureText(T.text).width, x = W - 90 - w;   // 写在右上角的空白纸上
  const write = clamp((t - T.t0) / 1.6), fade = 1 - clamp((t - T.t1) / 0.7);
  ctx.globalAlpha = fade;
  ctx.save(); ctx.beginPath(); ctx.rect(x - 30, y - 96, (w + 60) * write, 170); ctx.clip();
  halo(ctx, T.text, x, y, 14); ctx.fillStyle = INK + '0.9)'; ctx.fillText(T.text, x, y); ctx.restore();
  ctx.globalAlpha = fade * clamp((t - T.t0 - 1.2) / 0.6);
  ctx.font = '500 30px Caveat'; ctx.letterSpacing = '4px'; halo(ctx, T.sub, x + 10, y + 52, 10); ctx.fillStyle = INK + '0.62)'; ctx.fillText(T.sub, x + 10, y + 52);
  ctx.restore();
}

// 片尾卡：写在右侧空白纸上，孩子的新线还在左边画
export function endCard(ctx, E, t, W, H) {
  if (t < E.t0) return;
  const x = 1330, y = 470;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.textAlign = 'left';
  const a1 = clamp((t - E.t0) / 1.4), a2 = clamp((t - E.t0 - 0.9) / 0.8), a3 = clamp((t - E.t0 - 1.5) / 0.8);
  ctx.font = '82px Sacramento';
  const w = ctx.measureText('The Line That').width;
  ctx.save(); ctx.beginPath(); ctx.rect(x - 20, y - 180, (w + 60) * a1, 260); ctx.clip();
  ctx.fillStyle = INK + '0.9)'; ctx.fillText('The Line That', x, y - 70); ctx.fillText('Never Lifted', x + 40, y + 10); ctx.restore();
  ctx.globalAlpha = a2; ctx.font = '600 32px Caveat'; ctx.letterSpacing = '9px'; ctx.fillStyle = INK + '0.72)'; ctx.fillText('ONE-LINE DRAWING', x + 6, y + 92);
  ctx.globalAlpha = a3; ctx.font = '500 30px Caveat'; ctx.letterSpacing = '2px'; ctx.fillStyle = INK + '0.58)'; ctx.fillText('LemoLab × Claude Opus 5.5', x + 6, y + 140);
  ctx.restore();
}
