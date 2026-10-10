// 字幕：说书人题板——黑漆窄木牌 + 细金线 + 朱红"说"字印；Cormorant Garamond 600
export function drawSub(g, text, a = 1, slide = 0) {
  if (!text || a <= 0) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = a;
  g.font = '600 46px "Cormorant Garamond"';
  const tw = g.measureText(text).width, seal = 46, padL = 22, padR = 36, gap = 20;
  const w = padL + seal + gap + tw + padR, h = 70, x = 960 - w / 2, y = 1080 - 58 - h + slide * 18;
  // 木牌：深褐漆面 + 轻微木纹渐变 + 投影
  g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 18; g.shadowOffsetY = 4;
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(46,22,14,.93)'); gr.addColorStop(.5, 'rgba(30,14,9,.93)'); gr.addColorStop(1, 'rgba(22,10,7,.93)');
  g.fillStyle = gr; rr(g, x, y, w, h, 6); g.fill(); g.shadowColor = 'transparent';
  g.strokeStyle = 'rgba(168,129,63,.8)'; g.lineWidth = 1.5; rr(g, x + 6, y + 6, w - 12, h - 12, 3); g.stroke();
  // 朱印
  const sx = x + padL, sy = y + (h - seal) / 2;
  g.fillStyle = '#b3261b'; rr(g, sx, sy, seal, seal, 4); g.fill();
  g.strokeStyle = 'rgba(255,220,190,.55)'; g.lineWidth = 1.2; rr(g, sx + 3.5, sy + 3.5, seal - 7, seal - 7, 2); g.stroke();
  g.font = '400 34px "Ma Shan Zheng"'; g.fillStyle = '#f6dcc0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('说', sx + seal / 2, sy + seal / 2 + 2);
  g.font = '600 46px "Cormorant Garamond"'; g.fillStyle = '#f3e2bf'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(text, sx + seal + gap, y + h / 2 + 1);
  g.restore();
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
