// Extracted unchanged function bodies from Lemo swiss-motion film.js. Only export declarations added. MIT.
export function font(g, weight, size, fam = 'Archivo') {
  g.font = `${weight} ${size}px ${fam}`;
  g.letterSpacing = size >= 90 && fam === 'Archivo' ? `${(-size * 0.022).toFixed(1)}px` : '0px';
}
const textW = (g, s) => g.measureText(s).width;
// 从基线下方吸附出现的一段文字（p: 0→1 进入；q: 0→1 向上翻走）
export function revealText(g, s, x, y, size, p, q = 0) {
  if (p <= 0 || q >= 1) return;
  const w = textW(g, s) + size * .1;
  g.save(); g.beginPath(); g.rect(x - 2, y - size * 1.02, w + 4, size * 1.30); g.clip();
  g.fillText(s, x, y + (1 - p) * size * 1.05 - q * size * 1.3);
  g.restore();
}
