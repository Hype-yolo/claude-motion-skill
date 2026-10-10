// 字幕层（不经过胶片后期，像录像带上后加的字幕）：奶黄色半窄体 + 深色描边；调度员青色 + "BASE" 无线电标签
import { W, H, rgba } from './cel.js';
import { VO, T } from './story.js';
export function subSpans(durs) {
  const S = VO.map(v => { const d = durs[v.id] ?? v.text.length * .07; return { ...v, a: v.t - .05, b: v.t + Math.max(d + .6, 1.9) }; });
  S.forEach((s, i) => { if (S[i + 1]) s.b = Math.min(s.b, S[i + 1].a); });   // 不重叠：下一句出现时上一句让位
  return S;
}
export function hud(c, t, spans) {
  c.clearRect(0, 0, W, H);
  if (t >= T.end) return;
  const v = spans.find(s => t >= s.a && t < s.b); if (!v) return;
  const radio = v.who === 'D', y = H - 96;
  c.save(); c.font = '600 54px "Barlow SC"'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  const tw = c.measureText(v.text).width, tagW = radio ? 150 : 0, x = (W - tw - tagW) / 2 + tagW;
  if (radio) {   // 无线电标签
    const tx = x - tagW, ty = y - 24;
    c.fillStyle = rgba('#07121a', .78); c.beginPath(); c.roundRect(tx, ty, 128, 48, 8); c.fill();
    c.strokeStyle = '#8ff4ff'; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = '#ff4a4a'; c.beginPath(); c.arc(tx + 24, y, 8, 0, 7); c.fill();
    c.font = '700 28px "Barlow SC"'; c.fillStyle = '#8ff4ff'; c.fillText('BASE', tx + 42, y + 1);
    c.font = '600 54px "Barlow SC"';
  }
  c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 10; c.shadowOffsetY = 3;
  c.strokeStyle = '#120a1e'; c.lineWidth = 9; c.strokeText(v.text, x, y);
  c.shadowColor = 'transparent';
  c.fillStyle = radio ? '#8ff4ff' : '#fff0a0'; c.fillText(v.text, x, y);
  c.restore();
}
