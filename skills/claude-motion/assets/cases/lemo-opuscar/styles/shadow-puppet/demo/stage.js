// 舞台：前台木框（雕花横楣 + 立柱 + 台口）、前排小观众后脑剪影、前景立柱（转场）、片名 / 片尾镂空皮影牌
import { piece, drawPiece, fill, cut, cutLine, ink, within, smooth, poly, cloud, beads, beadLine, plum, lattice, coin, meander, DYE, canvas } from './carve.js';
import { mulberry } from '/core/lib.js';

// —— 木框（画在前景层，幕布坐标）；spill = 布透出来的光照在木框内沿上的强度 ——
export function drawFrame(g, Cam, spill = 1) {
  g.save(); g.setTransform(Cam[0], Cam[1], Cam[2], Cam[3], Cam[4], Cam[5]);
  const lac = '#2a0d08', lac2 = '#46140c', gold = '#8a6430';
  // 横楣
  g.fillStyle = lac; g.fillRect(-420, -520, 2760, 520);
  g.fillStyle = lac2; g.fillRect(-300, -200, 2520, 170);
  // 横楣雕花：一排云头卷 + 回纹金线
  g.strokeStyle = gold; g.lineWidth = 3;
  for (let x = -260; x < 2200; x += 120) { g.beginPath(); for (let i = 0; i <= 30; i++) { const a = i / 30 * Math.PI * 2.1, r = 34 * (1 - i / 30 * .75); const px = x + 60 + Math.cos(a) * r, py = -115 + Math.sin(a) * r * .7; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); }
  g.beginPath(); g.moveTo(-300, -200); g.lineTo(2220, -200); g.moveTo(-300, -30); g.lineTo(2220, -30); g.stroke();
  g.fillStyle = '#6a1a10'; g.fillRect(-300, -30, 2520, 30);
  // 立柱
  for (const x of [-230, 1920]) {
    const gr = g.createLinearGradient(x, 0, x + 230, 0); gr.addColorStop(0, '#1a0806'); gr.addColorStop(.5, '#3e110a'); gr.addColorStop(1, '#1a0806');
    g.fillStyle = gr; g.fillRect(x, -520, 230, 2000);
    g.strokeStyle = gold; g.lineWidth = 2.5; g.strokeRect(x + 24, 60, 182, 900);
  }
  // 台口（下沿）
  g.fillStyle = lac; g.fillRect(-420, 1080, 2760, 600);
  g.fillStyle = '#5a170d'; g.fillRect(-300, 1080, 2520, 46);
  g.strokeStyle = gold; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-300, 1126); g.lineTo(2220, 1126); g.stroke();
  // 内沿受光（布透出来的暖光照在木头上）
  g.globalCompositeOperation = 'lighter';
  const sp = (x0, y0, x1, y1, gx0, gy0, gx1, gy1) => { const gr = g.createLinearGradient(gx0, gy0, gx1, gy1); gr.addColorStop(0, `rgba(255,170,90,${.32 * spill})`); gr.addColorStop(1, 'rgba(255,150,70,0)'); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); };
  sp(-300, -120, 2220, 0, 0, 0, 0, -120); sp(-300, 1080, 2220, 1200, 0, 1080, 0, 1200); sp(-160, -30, 0, 1110, 0, 0, -160, 0); sp(1920, -30, 2080, 1110, 1920, 0, 2080, 0);
  g.restore();
}
// —— 前排小观众（视口坐标）——
export function drawAudience(g, a = 1, t = 0) {
  if (a <= 0) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = a; g.fillStyle = '#080404'; g.filter = 'blur(3px)';
  const heads = [[260, 1010, 95, 1], [560, 1040, 110, 0], [880, 1060, 90, 1], [1330, 1030, 105, 0], [1640, 1050, 95, 1]];
  heads.forEach(([x, y, r, bun], i) => {
    const bob = Math.sin(t * 1.3 + i * 2) * 3;
    g.beginPath(); g.ellipse(x, y + bob, r * .78, r, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(x, y + r * 1.25 + bob, r * 1.8, r * .9, 0, 0, 7); g.fill();
    if (bun) { g.beginPath(); g.arc(x + r * .1, y - r * .95 + bob, r * .32, 0, 7); g.fill(); }
  });
  g.restore();
}
// —— 前景立柱（转场遮挡，视口坐标）：x = 立柱中心 ——
export function drawPillar(g, x) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'blur(14px)';
  const w = 1500, gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  gr.addColorStop(0, 'rgba(12,4,3,0)'); gr.addColorStop(.08, '#120604'); gr.addColorStop(.45, '#3a1009'); gr.addColorStop(.55, '#2a0b07'); gr.addColorStop(.92, '#0e0503'); gr.addColorStop(1, 'rgba(12,4,3,0)');
  g.fillStyle = gr; g.fillRect(x - w / 2, -40, w, 1160);
  g.globalCompositeOperation = 'lighter'; const rg = g.createLinearGradient(x - w / 2, 0, x - w / 2 + 160, 0); rg.addColorStop(0, 'rgba(255,160,80,0)'); rg.addColorStop(.6, 'rgba(255,160,80,.16)'); rg.addColorStop(1, 'rgba(255,160,80,0)'); g.fillStyle = rg; g.fillRect(x - w / 2, -40, 200, 1160);
  g.restore();
}
// —— 镂空字皮影牌 ——
function plaque(w, h, lines, seed) {
  return piece([-w / 2 - 30, -h / 2 - 30, w / 2 + 30, h / 2 + 30], g => {
    const outer = q => { const r = 26; q.moveTo(-w / 2 + r, -h / 2); q.lineTo(w / 2 - r, -h / 2); q.quadraticCurveTo(w / 2 + 14, -h / 2 - 14, w / 2, -h / 2 + r); q.lineTo(w / 2, h / 2 - r); q.quadraticCurveTo(w / 2 + 14, h / 2 + 14, w / 2 - r, h / 2); q.lineTo(-w / 2 + r, h / 2); q.quadraticCurveTo(-w / 2 - 14, h / 2 + 14, -w / 2, h / 2 - r); q.lineTo(-w / 2, -h / 2 + r); q.quadraticCurveTo(-w / 2 - 14, -h / 2 - 14, -w / 2 + r, -h / 2); q.closePath(); };
    fill(g, '#3a1a10', outer);
    // 边框：红 + 绿角花，回纹
    const band = q => { outer(q); q.rect(-w / 2 + 26, -h / 2 + 26, w - 52, h - 52); };
    fill(g, DYE.red, band);
    within(g, band, () => { meander(g, -w / 2 + 30, -h / 2 + 20, w / 2 - 30, 5, 1.6); meander(g, -w / 2 + 30, h / 2 - 7, w / 2 - 30, 5, 1.6); for (let y = -h / 2 + 40; y < h / 2 - 30; y += 22) { coin(g, -w / 2 + 13, y, 6); coin(g, w / 2 - 13, y, 6); } });
    for (const [x, y] of [[-w / 2 + 13, -h / 2 + 13], [w / 2 - 13, -h / 2 + 13], [-w / 2 + 13, h / 2 - 13], [w / 2 - 13, h / 2 - 13]]) { fill(g, DYE.green, q => q.arc(x, y, 20, 0, 7)); cloud(g, x, y, 12, 0, 2, 1); ink(g, 2, q => q.arc(x, y, 20, 0, 7)); }
    ink(g, 2.5, outer); ink(g, 1.8, q => q.rect(-w / 2 + 26, -h / 2 + 26, w - 52, h - 52));
    // 镂空字
    g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const L of lines) { g.font = L.font; if (L.ls) g.letterSpacing = L.ls + 'px'; else g.letterSpacing = '0px'; g.fillText(L.text, L.x || 0, L.y); }
    g.restore();
    // 字里留几道皮筋（刻字的连筋，镂空字的做法）
    for (const L of lines) if (L.bars) for (let k = 0; k < L.bars; k++) { const x = -w / 2 + 60 + (k + .5) * (w - 120) / L.bars; ink(g, 2.4, q => { q.moveTo(x, L.y - L.size * .45); q.lineTo(x + 6, L.y + L.size * .45); }, '#3a1a10'); }
    // 朱印
    if (seed) { const sx = w / 2 - 150, sy = -h / 2 + 50; fill(g, '#b3261b', q => q.rect(sx, sy, 90, 90)); g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.font = '400 40px "Ma Shan Zheng"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('后羿', sx + 45, sy + 26); g.fillText('射日', sx + 45, sy + 66); g.restore(); ink(g, 2, q => q.rect(sx, sy, 90, 90)); }
  }, { ss: 2, seed: 50 + (seed || 0) });
}
let P = null;
export function buildStage() {
  if (P) return P;
  P = {
    title: plaque(1180, 380, [
      { text: 'HOU YI', font: '700 150px "Cormorant Garamond"', y: -50, ls: 18, size: 150 },
      { text: 'SHOOTS THE SUNS', font: '700 64px "Cormorant Garamond"', y: 82, ls: 12, size: 64 },
      { text: 'a shadow puppet tale', font: 'italic 600 34px "Cormorant Garamond"', y: 142, size: 34 }], 1),
    end: plaque(1180, 420, [
      { text: 'SHADOW PUPPETRY', font: '700 104px "Cormorant Garamond"', y: -64, ls: 10, size: 104 },
      { text: 'Hou Yi Shoots the Suns', font: 'italic 600 48px "Cormorant Garamond"', y: 40, size: 48 },
      { text: 'LemoLab × Claude Opus 5.5', font: '600 40px "Cormorant Garamond"', y: 128, ls: 4, size: 40 }], 0)
  };
  return P;
}
