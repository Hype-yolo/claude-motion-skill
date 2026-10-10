// 2D 叠加层：章节卡、对话框、字幕、片名、镜头间黑场
import { VO, SHOTS, T } from './story.js';

const cv = document.getElementById('ov'), g = cv.getContext('2d');
const W = 1920, H = 1080;
let DURS = {};
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = x => { x = clamp(x); return x * x * (3 - 2 * x); };

export async function overlayReady() {
  await Promise.all(['500 40px Cinzel', '700 40px Cinzel', 'italic 500 40px "Cormorant Garamond"', '600 40px "Cormorant Garamond"', '500 40px "Cormorant Garamond"'].map(f => document.fonts.load(f)));
  DURS = await (await fetch('voices/dur.json')).json();
}
export const CREDIT = { music: 'Music: “Precipice” by Scott Buckley — scottbuckley.com.au (CC BY 4.0)   ·   Voices: Kokoro TTS' };
// 片尾署名（2026-09-26 已加进成片）：默认开启；?nocredit=1 可关掉（复现旧版 hd-2d_v1.mp4 的片尾）
const SHOW_TEAM = !new URLSearchParams(location.search).has('nocredit');
CREDIT.team = 'LemoLab × Claude Opus 5.5';

// 金色细线 + 菱形饰件
function ornament(cx, y, w, a) {
  g.save(); g.globalAlpha = a; g.strokeStyle = '#c9a863'; g.fillStyle = '#e2c989'; g.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    const gr = g.createLinearGradient(cx, 0, cx + s * w, 0); gr.addColorStop(0, 'rgba(226,201,137,1)'); gr.addColorStop(1, 'rgba(226,201,137,0)');
    g.strokeStyle = gr; g.beginPath(); g.moveTo(cx + s * 16, y); g.lineTo(cx + s * w, y); g.stroke();
    g.beginPath(); g.arc(cx + s * 26, y, 2.5, 0, 7); g.fill();
  }
  g.beginPath(); g.moveTo(cx, y - 8); g.lineTo(cx + 8, y); g.lineTo(cx, y + 8); g.lineTo(cx - 8, y); g.closePath(); g.stroke();
  g.beginPath(); g.moveTo(cx, y - 3.5); g.lineTo(cx + 3.5, y); g.lineTo(cx, y + 3.5); g.lineTo(cx - 3.5, y); g.closePath(); g.fill();
  g.restore();
}
function spaced(text, x, y, sp) {   // 字距
  const ws = [...text].map(c => g.measureText(c).width), tot = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
  let cx = x - tot / 2; [...text].forEach((c, i) => { g.fillText(c, cx + ws[i] / 2, y); cx += ws[i] + sp; });
}
function glowText(fn, col, blur) { g.save(); g.shadowColor = col; g.shadowBlur = blur; fn(); g.restore(); fn(); }

// —— 章节卡 ——
function chapterCard(t) {
  const a0 = ss(seg(t, .5, 1.6)), a1 = ss(seg(t, 1.5, 2.6)), out = 1 - ss(seg(t, 4.6, 5.4));
  const bg = g.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 1100); bg.addColorStop(0, '#11172a'); bg.addColorStop(1, '#020308');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.globalAlpha = a0 * out; g.fillStyle = '#d8c28e'; g.font = '500 34px Cinzel'; spaced('CHAPTER  I', W / 2, 452, 10);
  ornament(W / 2, 500, 240 * (.4 + .6 * a0), a0 * out);
  g.globalAlpha = a1 * out; g.fillStyle = '#f3ead6'; g.font = 'italic 500 78px "Cormorant Garamond"';
  glowText(() => g.fillText('Wren, the Lampbearer', W / 2, 578 - (1 - a1) * 10), 'rgba(255,190,110,.35)', 24);
  // 一粒火星慢慢飘过
  const u = seg(t, .8, 5.2), ex = 600 + u * 760, ey = 700 - u * 260 + Math.sin(u * 9) * 18, ea = Math.sin(u * Math.PI) * out;
  g.globalAlpha = 1; const eg = g.createRadialGradient(ex, ey, 0, ex, ey, 26); eg.addColorStop(0, `rgba(255,220,150,${.9 * ea})`); eg.addColorStop(.25, `rgba(255,150,60,${.35 * ea})`); eg.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = eg; g.fillRect(ex - 30, ey - 30, 60, 60); g.fillStyle = `rgba(255,240,200,${ea})`; g.fillRect(Math.round(ex) - 2, Math.round(ey) - 2, 4, 4);
  g.globalAlpha = 1;
}

// —— 对话框（深色半透明 + 金色细框 + 名牌 + 打字机）——
function wrap(text, maxW) { const words = text.split(' '), lines = []; let cur = ''; for (const w of words) { const n = cur ? cur + ' ' + w : w; if (g.measureText(n).width > maxW && cur) { lines.push(cur); cur = w; } else cur = n; } if (cur) lines.push(cur); return lines; }
function dialog(t, v) {
  const a = ss(seg(t, T.dlgIn, T.dlgIn + .35)) * (1 - ss(seg(t, T.dlgOut - .35, T.dlgOut)));
  if (a <= 0) return;
  const bw = 1180, bh = 210, x = (W - bw) / 2, y = H - bh - 58 + (1 - a) * 14;
  g.save(); g.globalAlpha = a;
  const bgr = g.createLinearGradient(0, y, 0, y + bh); bgr.addColorStop(0, 'rgba(14,18,34,.86)'); bgr.addColorStop(1, 'rgba(6,8,18,.9)');
  g.fillStyle = bgr; g.fillRect(x, y, bw, bh);
  g.strokeStyle = 'rgba(214,190,130,.9)'; g.lineWidth = 2; g.strokeRect(x + .5, y + .5, bw - 1, bh - 1);
  g.strokeStyle = 'rgba(214,190,130,.35)'; g.lineWidth = 1; g.strokeRect(x + 7.5, y + 7.5, bw - 15, bh - 15);
  for (const [cx, cy] of [[x, y], [x + bw, y], [x, y + bh], [x + bw, y + bh]]) { g.fillStyle = '#e2c989'; g.beginPath(); g.moveTo(cx, cy - 7); g.lineTo(cx + 7, cy); g.lineTo(cx, cy + 7); g.lineTo(cx - 7, cy); g.fill(); }
  // 名牌
  g.font = '600 34px "Cormorant Garamond"'; const nw = g.measureText(v.who).width + 56;
  g.fillStyle = 'rgba(10,12,24,.95)'; g.fillRect(x + 36, y - 26, nw, 50); g.strokeStyle = 'rgba(214,190,130,.9)'; g.lineWidth = 1.5; g.strokeRect(x + 36.5, y - 25.5, nw - 1, 49);
  g.fillStyle = '#e8d5a4'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(v.who, x + 64, y - 1);
  // 正文：按配音时长打字
  g.font = '500 44px "Cormorant Garamond"'; g.fillStyle = '#f4efe4';
  const d = DURS[v.id] || 5, n = v.sub.length, shown = Math.floor(n * clamp((t - v.t + .05) / (d * .92)));
  const lines = wrap(v.sub, bw - 150); let k = shown;
  lines.forEach((L, i) => { const s = L.slice(0, Math.max(0, k)); k -= L.length + 1; g.fillText(s, x + 72, y + 78 + i * 58); });
  if (shown >= n && Math.floor(t * 2.5) % 2 === 0) { g.fillStyle = '#e2c989'; const tx = x + bw - 56, ty = y + bh - 38; g.beginPath(); g.moveTo(tx - 9, ty - 5); g.lineTo(tx + 9, ty - 5); g.lineTo(tx, ty + 6); g.fill(); }
  g.restore();
}

// —— 字幕 ——
function subtitle(t, v) {
  const d = DURS[v.id] || 3, a = ss(seg(t, v.t - .15, v.t + .2)) * (1 - ss(seg(t, v.t + d + .45, v.t + d + .8)));
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.font = 'italic 500 50px "Cormorant Garamond"';
  const y = H - 88, tw = g.measureText(v.sub).width;
  const sh = g.createLinearGradient(0, y - 70, 0, y + 40); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(.5, 'rgba(0,0,0,.38)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh; g.fillRect(W / 2 - tw / 2 - 160, y - 70, tw + 320, 110);
  g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 10; g.shadowOffsetY = 2; g.fillStyle = '#f6f0e2'; g.fillText(v.sub, W / 2, y);
  g.restore();
}

// —— 片名 ——
function title(t) {
  const a = ss(seg(t, 67.4, 68.8)), out = 1 - ss(seg(t, 75.3, 76.4));
  if (a <= 0) return;
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.globalAlpha = a * out * .5; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.globalAlpha = a * out; g.font = '700 118px Cinzel';
  const gr = g.createLinearGradient(0, 360, 0, 470); gr.addColorStop(0, '#fff3cf'); gr.addColorStop(.55, '#e2c27c'); gr.addColorStop(1, '#a8803e');
  g.fillStyle = gr; glowText(() => spaced('THE LAMPBEARER', W / 2, 420, 14), 'rgba(255,200,120,.55)', 40);
  ornament(W / 2, 502, 330 * (.3 + .7 * a), a * out);
  const b = ss(seg(t, 69.1, 69.9));
  g.globalAlpha = b * out; g.font = 'italic 500 50px "Cormorant Garamond"'; g.fillStyle = '#f3ead6'; g.fillText('Every path begins with a single light.', W / 2, 572);
  const c = ss(seg(t, 71.5, 72.5));
  if (SHOW_TEAM) { g.globalAlpha = ss(seg(t, 70.6, 71.6)) * out * .85; g.font = '500 30px Cinzel'; g.fillStyle = '#d8c28e'; spaced(CREDIT.team, W / 2, 668, 4); }
  if (CREDIT.music) { g.globalAlpha = c * out * .75; g.font = '500 24px "Cormorant Garamond"'; g.fillStyle = '#cfc6b2'; g.fillText(CREDIT.music, W / 2, H - 70); }
  g.restore();
}

// —— 镜头间黑场（换场景时淡出淡入）——
const FADES = [[5.5, .5, .7], [15.0, .25, .35], [25.5, .35, .5], [35.5, .35, .5], [49.5, .25, .35], [58.0, .3, .6]];
function blackout(t) {
  let a = 0;
  for (const [c, o, i] of FADES) { if (t < c && t > c - o) a = Math.max(a, ss((t - (c - o)) / o)); if (t >= c && t < c + i) a = Math.max(a, 1 - ss((t - c) / i)); }
  a = Math.max(a, ss(seg(t, 75.6, 76.5)));
  if (a > 0) { g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(0, 0, W, H); }
}

export function drawOverlay(t, shot) {
  g.clearRect(0, 0, W, H);
  if (shot.id === 'card') { chapterCard(t); blackout(t); return; }
  for (const v of VO) { if (v.title) continue; if (v.dlg) dialog(t, v); else subtitle(t, v); }
  title(t);
  blackout(t);
}
