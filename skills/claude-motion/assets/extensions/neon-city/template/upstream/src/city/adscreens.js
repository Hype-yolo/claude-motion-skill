// Giant LED screens: the advertising the city wears on its towers. The artwork is drawn here at load
// (no download, no third-party brands): sixteen fictional campaigns, each laid out for a tall banner and for a
// wide board, packed into one atlas. Each screen alternates between two campaigns with a wipe, scans and
// glitches now and then, and shows its LED pitch when you fly close.
import * as THREE from 'three/webgpu';
import { attribute, positionGeometry, normalGeometry, vec2, vec3, float, mix, step, abs, texture, floor, fract, smoothstep, max, fwidth, length, cameraPosition, normalize, cross } from 'three/tsl';
import { U } from '../core/shared.js';
import { chunkedInstances } from './instancing.js';
import { hash12 } from '../tsl/util.js';

const HEI = "'Chiron Hei HK Variable', 'PingFang HK', sans-serif";
const SUNG = "'Chiron Sung HK Variable', 'Songti TC', serif";
const OX = "'Oxanium Variable', sans-serif";
const MONO = "'JetBrains Mono Variable', monospace";

// helpers on a 2D context
function grad(g, x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
}
function text(g, s, x, y, font, color, { align = 'center', base = 'middle', spacing = 0, maxW } = {}) {
  g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = base;
  if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
  if (maxW) { const w = g.measureText(s).width; if (w > maxW) { g.save(); g.translate(x, y); g.scale(maxW / w, 1); g.fillText(s, 0, 0); g.restore(); return; } }
  g.fillText(s, x, y);
}
function vtext(g, s, x, y, size, font, color, gap = 1.04) {
  [...s].forEach((ch, i) => text(g, ch, x, y + i * size * gap, `${font.replace('SIZE', size)}`, color));
}
function halftone(g, W, H, color, step, fn) {
  g.fillStyle = color;
  for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) {
    const r = fn(x / W, y / H) * step * 0.5;
    if (r > 0.3) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  }
}
function lines(g, W, H, color, n, vertical = false, wdt = 1) {
  g.strokeStyle = color; g.lineWidth = wdt;
  for (let i = 1; i < n; i++) {
    g.beginPath();
    if (vertical) { g.moveTo((W * i) / n, 0); g.lineTo((W * i) / n, H); } else { g.moveTo(0, (H * i) / n); g.lineTo(W, (H * i) / n); }
    g.stroke();
  }
}

// each campaign draws into W x H (tall when H > W); s is the short side
const ADS = [
  // cyberware clinic
  (g, W, H, tall, s) => {
    g.fillStyle = '#07070a'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,40,70,0.35)'; g.lineWidth = s * 0.004;
    for (let r = 1; r < 7; r++) { g.beginPath(); g.arc(W * (tall ? 0.5 : 0.78), H * (tall ? 0.7 : 0.5), s * 0.09 * r, 0, Math.PI * 2); g.stroke(); }
    if (tall) vtext(g, '義體', W * 0.5, H * 0.2, s * 0.62, `900 SIZEpx ${HEI}`, '#ff2846');
    else text(g, '義體', W * 0.32, H * 0.45, `900 ${s * 0.56}px ${HEI}`, '#ff2846');
    text(g, 'CHROME CLINIC', tall ? W * 0.5 : W * 0.32, tall ? H * 0.86 : H * 0.84, `700 ${s * 0.085}px ${OX}`, '#f4f4f6', { spacing: s * 0.02, maxW: (tall ? W : W * 0.55) * 0.9 });
    text(g, '24H · 無痛升級 · 分期付款', tall ? W * 0.5 : W * 0.32, tall ? H * 0.92 : H * 0.94, `500 ${s * 0.05}px ${HEI}`, '#ff8090', { maxW: W * 0.9 });
  },
  // energy drink
  (g, W, H, tall, s) => {
    g.fillStyle = '#c6ff1a'; g.fillRect(0, 0, W, H);
    halftone(g, W, H, '#9fd400', s * 0.04, (x, y) => (tall ? y : x));
    g.save(); g.translate(W * (tall ? 0.5 : 0.7), H * 0.5); g.rotate(-0.12);
    const cw = s * 0.34, ch = s * 0.78;
    g.fillStyle = '#0b0b0b'; g.beginPath(); g.roundRect(-cw / 2, -ch / 2, cw, ch, cw * 0.18); g.fill();
    g.fillStyle = '#c6ff1a'; g.fillRect(-cw / 2, -ch * 0.08, cw, ch * 0.05);
    g.beginPath(); g.moveTo(cw * 0.08, -ch * 0.32); g.lineTo(-cw * 0.2, ch * 0.04); g.lineTo(cw * 0.02, ch * 0.04); g.lineTo(-cw * 0.1, ch * 0.32); g.lineTo(cw * 0.22, -ch * 0.06); g.lineTo(0, -ch * 0.06); g.closePath(); g.fill();
    g.restore();
    text(g, 'VOLT', W * (tall ? 0.5 : 0.28), H * (tall ? 0.12 : 0.42), `italic 800 ${s * (tall ? 0.42 : 0.4)}px ${OX}`, '#0b0b0b', { maxW: (tall ? W : W * 0.5) * 0.94 });
    text(g, '雷霆能量', W * (tall ? 0.5 : 0.28), H * (tall ? 0.9 : 0.78), `900 ${s * 0.12}px ${HEI}`, '#0b0b0b', { spacing: s * 0.03 });
  },
  // bank
  (g, W, H, tall, s) => {
    g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#0a1430'], [1, '#02040c']]); g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(232,196,110,0.55)'; g.lineWidth = s * 0.006;
    for (let r = 0; r < 9; r++) { g.beginPath(); g.arc(W * 0.5, tall ? H * 0.32 : H * 1.25, s * (0.12 + r * 0.075), Math.PI, 0); g.stroke(); }
    if (tall) vtext(g, '天頂銀行', W * 0.5, H * 0.5, s * 0.2, `700 SIZEpx ${SUNG}`, '#e8c46e', 1.12);
    else text(g, '天頂銀行', W * 0.5, H * 0.42, `700 ${s * 0.3}px ${SUNG}`, '#e8c46e', { spacing: s * 0.05 });
    text(g, 'ZENITH BANK', W * 0.5, tall ? H * 0.42 : H * 0.7, `600 ${s * 0.07}px ${OX}`, '#f3e3b8', { spacing: s * 0.04 });
    text(g, 'TRUST THE ALTITUDE', W * 0.5, tall ? H * 0.96 : H * 0.86, `400 ${s * 0.04}px ${OX}`, '#9aa4c4', { spacing: s * 0.03 });
  },
  // neural link
  (g, W, H, tall, s) => {
    g.fillStyle = grad(g, 0, 0, W, H, [[0, '#ff2fa6'], [0.55, '#6a1cff'], [1, '#12043a']]); g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = s * 0.003;
    for (let r = 1; r < 22; r++) { g.beginPath(); g.ellipse(W * 0.5, H * (tall ? 0.38 : 0.5), s * 0.03 * r, s * 0.03 * r * 0.55, 0, 0, Math.PI * 2); g.stroke(); }
    text(g, 'SYNAPSE', W * 0.5, H * (tall ? 0.7 : 0.5), `200 ${s * 0.16}px ${OX}`, '#ffffff', { spacing: s * 0.05, maxW: W * 0.92 });
    text(g, '感知一切', W * 0.5, H * (tall ? 0.8 : 0.72), `700 ${s * 0.1}px ${HEI}`, '#ffe0f4', { spacing: s * 0.06 });
    text(g, 'FEEL EVERYTHING', W * 0.5, H * (tall ? 0.86 : 0.84), `500 ${s * 0.04}px ${OX}`, '#ffd0ef', { spacing: s * 0.05 });
  },
  // noodles
  (g, W, H, tall, s) => {
    g.fillStyle = '#ff6a13'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(W * (tall ? 0.5 : 0.72), H * (tall ? 0.62 : 0.66), s * 0.34, 0, Math.PI); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = s * 0.012; g.lineCap = 'round';
    for (let i = -1; i <= 1; i++) { const cx = W * (tall ? 0.5 : 0.72) + i * s * 0.12; g.beginPath(); g.moveTo(cx, H * (tall ? 0.56 : 0.56)); g.bezierCurveTo(cx - s * 0.05, H * 0.46, cx + s * 0.05, H * 0.4, cx, H * (tall ? 0.36 : 0.22)); g.stroke(); }
    text(g, '麵', W * (tall ? 0.5 : 0.25), H * (tall ? 0.2 : 0.48), `900 ${s * (tall ? 0.6 : 0.7)}px ${SUNG}`, '#ffffff');
    text(g, '牛肉麵 $28', W * (tall ? 0.5 : 0.72), H * (tall ? 0.88 : 0.9), `700 ${s * 0.09}px ${HEI}`, '#2a0a00');
  },
  // flying cars
  (g, W, H, tall, s) => {
    g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#29e0ff'], [1, '#08245e']]); g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 5; i++) {
      const y = H * (tall ? 0.2 : 0.3) + i * s * 0.08, x = W * (tall ? 0.5 : 0.25);
      g.globalAlpha = 1 - i * 0.17;
      g.beginPath(); g.moveTo(x - s * 0.22, y + s * 0.06); g.lineTo(x, y - s * 0.02); g.lineTo(x + s * 0.22, y + s * 0.06); g.lineTo(x + s * 0.22, y + s * 0.1); g.lineTo(x, y + s * 0.02); g.lineTo(x - s * 0.22, y + s * 0.1); g.fill();
    }
    g.globalAlpha = 1;
    text(g, 'NOVA AERO', W * (tall ? 0.5 : 0.66), H * (tall ? 0.72 : 0.42), `800 ${s * 0.12}px ${OX}`, '#ffffff', { spacing: s * 0.02, maxW: (tall ? W : W * 0.6) * 0.92 });
    text(g, '新星飛行 · 直航月台', W * (tall ? 0.5 : 0.66), H * (tall ? 0.8 : 0.66), `600 ${s * 0.065}px ${HEI}`, '#dff8ff', { maxW: (tall ? W : W * 0.6) * 0.92 });
  },
  // dim sum
  (g, W, H, tall, s) => {
    g.fillStyle = '#b3001b'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#ffcf4d'; g.lineWidth = s * 0.012;
    const n = tall ? 3 : 5;
    for (let i = 0; i < n; i++) for (let j = 0; j < (tall ? 2 : 1); j++) {
      const cx = tall ? W * (0.25 + j * 0.5) : W * (0.12 + i * 0.19), cy = tall ? H * (0.55 + i * 0.13) : H * 0.78;
      g.beginPath(); g.arc(cx, cy, s * 0.085, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(cx, cy, s * 0.05, 0, Math.PI * 2); g.stroke();
    }
    text(g, '點心', W * 0.5, H * (tall ? 0.22 : 0.36), `900 ${s * (tall ? 0.42 : 0.42)}px ${SUNG}`, '#ffcf4d', { spacing: s * 0.04 });
    text(g, 'DIM SUM 24/7', W * 0.5, H * (tall ? 0.4 : 0.58), `700 ${s * 0.07}px ${OX}`, '#fff3cf', { spacing: s * 0.03 });
  },
  // manufacturing corp
  (g, W, H, tall, s) => {
    g.fillStyle = '#ecebe6'; g.fillRect(0, 0, W, H);
    lines(g, W, H, 'rgba(0,0,0,0.12)', Math.round(W / (s * 0.08)), true);
    lines(g, W, H, 'rgba(0,0,0,0.12)', Math.round(H / (s * 0.08)));
    g.fillStyle = '#e1001a'; g.fillRect(W * (tall ? 0.18 : 0.06), H * (tall ? 0.1 : 0.18), s * 0.32, s * 0.32);
    g.fillStyle = '#ecebe6'; g.fillRect(W * (tall ? 0.18 : 0.06) + s * 0.1, H * (tall ? 0.1 : 0.18) + s * 0.1, s * 0.12, s * 0.22);
    text(g, 'KAIZEN-DYNE', tall ? W * 0.5 : W * 0.62, H * (tall ? 0.56 : 0.4), `800 ${s * 0.1}px ${OX}`, '#111', { maxW: (tall ? W : W * 0.62) * 0.92 });
    text(g, '明日製造', tall ? W * 0.5 : W * 0.62, H * (tall ? 0.66 : 0.62), `700 ${s * 0.11}px ${HEI}`, '#111', { spacing: s * 0.04 });
    text(g, 'BUILD TOMORROW', tall ? W * 0.5 : W * 0.62, H * (tall ? 0.92 : 0.82), `500 ${s * 0.045}px ${MONO}`, '#e1001a', { spacing: s * 0.02 });
  },
  // pharmacy
  (g, W, H, tall, s) => {
    g.fillStyle = '#f3fbf5'; g.fillRect(0, 0, W, H);
    const cx = W * (tall ? 0.5 : 0.22), cy = H * (tall ? 0.32 : 0.5), a = s * 0.12;
    g.fillStyle = '#00b86b'; g.fillRect(cx - a, cy - a * 3, a * 2, a * 6); g.fillRect(cx - a * 3, cy - a, a * 6, a * 2);
    text(g, '藥房', W * (tall ? 0.5 : 0.64), H * (tall ? 0.7 : 0.42), `900 ${s * 0.3}px ${HEI}`, '#00553a', { spacing: s * 0.05 });
    text(g, 'PHARMACY · 24H', W * (tall ? 0.5 : 0.64), H * (tall ? 0.84 : 0.76), `700 ${s * 0.06}px ${OX}`, '#00553a', { spacing: s * 0.02, maxW: (tall ? W : W * 0.6) * 0.92 });
  },
  // arcade
  (g, W, H, tall, s) => {
    g.fillStyle = '#16052e'; g.fillRect(0, 0, W, H);
    const p = s * 0.03;
    for (let i = 0; i < 160; i++) { const r = Math.sin(i * 12.9898) * 43758.5453; const fx = r - Math.floor(r), fy = (r * 7.13) % 1; g.fillStyle = i % 3 ? '#ff4fd8' : '#4fe9ff'; g.fillRect(Math.floor((fx * W) / p) * p, Math.floor((Math.abs(fy) * H) / p) * p, p, p); }
    text(g, 'ARCADE', W * 0.5, H * (tall ? 0.4 : 0.42), `800 ${s * (tall ? 0.2 : 0.24)}px ${MONO}`, '#fff36b', { spacing: s * 0.02, maxW: W * 0.92 });
    text(g, '遊戲機中心', W * 0.5, H * (tall ? 0.58 : 0.72), `900 ${s * 0.11}px ${HEI}`, '#ffffff', { spacing: s * 0.03, maxW: W * 0.92 });
    text(g, 'INSERT COIN', W * 0.5, H * (tall ? 0.9 : 0.9), `500 ${s * 0.045}px ${MONO}`, '#ff4fd8', { spacing: s * 0.04 });
  },
  // the game itself
  (g, W, H, tall, s) => {
    g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#1a0420'], [0.6, '#3a0638'], [1, '#ff3df2']]); g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,61,242,0.9)'; g.lineWidth = s * 0.006;
    const bx = W * (tall ? 0.5 : 0.82);
    g.beginPath(); g.moveTo(bx - s * 0.03, H); g.lineTo(bx - s * 0.015, H * 0.08); g.lineTo(bx, 0); g.lineTo(bx + s * 0.015, H * 0.08); g.lineTo(bx + s * 0.03, H); g.stroke();
    if (tall) vtext(g, '霓虹天頂', W * 0.5, H * 0.2, s * 0.2, `700 SIZEpx ${SUNG}`, '#ffffff', 1.1);
    else text(g, '霓虹天頂', W * 0.4, H * 0.42, `700 ${s * 0.28}px ${SUNG}`, '#ffffff', { spacing: s * 0.04 });
    text(g, 'NEON ZENITH · 1418 M', tall ? W * 0.5 : W * 0.4, H * (tall ? 0.94 : 0.74), `400 ${s * 0.05}px ${OX}`, '#ffc8f8', { spacing: s * 0.05, maxW: W * 0.9 });
  },
  // night market
  (g, W, H, tall, s) => {
    g.fillStyle = '#ffd400'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#111';
    const st = s * 0.12;
    for (let x = -H; x < W + H; x += st * 2) { g.beginPath(); g.moveTo(x, tall ? H : H); g.lineTo(x + st, H); g.lineTo(x + st + H * 0.18, H * 0.82); g.lineTo(x + H * 0.18, H * 0.82); g.fill(); }
    text(g, '夜市', W * 0.5, H * (tall ? 0.3 : 0.38), `900 ${s * (tall ? 0.48 : 0.42)}px ${HEI}`, '#111', { spacing: s * 0.04 });
    text(g, 'TEMPLE ST NIGHT MARKET', W * 0.5, H * (tall ? 0.62 : 0.68), `700 ${s * 0.05}px ${OX}`, '#111', { spacing: s * 0.02, maxW: W * 0.92 });
  },
  // clouds real estate
  (g, W, H, tall, s) => {
    g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#0d1b2a'], [0.5, '#415a77'], [1, '#e0e1dd']]); g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(W * ((i * 0.37) % 1), H * (0.62 + (i % 3) * 0.08), s * 0.4, s * 0.05, 0, 0, Math.PI * 2); g.fill(); }
    text(g, '雲上之家', W * 0.5, H * (tall ? 0.24 : 0.3), `700 ${s * 0.16}px ${SUNG}`, '#ffffff', { spacing: s * 0.06 });
    text(g, 'ORBITAL RESIDENCES', W * 0.5, H * (tall ? 0.33 : 0.48), `500 ${s * 0.05}px ${OX}`, '#dbe7ff', { spacing: s * 0.05, maxW: W * 0.92 });
    text(g, 'YOUR HOME ABOVE THE RAIN', W * 0.5, H * (tall ? 0.92 : 0.9), `400 ${s * 0.035}px ${OX}`, '#1b263b', { spacing: s * 0.04, maxW: W * 0.92 });
  },
  // tea
  (g, W, H, tall, s) => {
    g.fillStyle = '#0e3b2a'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#7ed957'; g.beginPath(); g.ellipse(W * (tall ? 0.5 : 0.75), H * (tall ? 0.36 : 0.5), s * 0.16, s * 0.3, 0.6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#0e3b2a'; g.lineWidth = s * 0.008; g.beginPath(); g.moveTo(W * (tall ? 0.5 : 0.75) - s * 0.14, H * (tall ? 0.36 : 0.5) + s * 0.2); g.lineTo(W * (tall ? 0.5 : 0.75) + s * 0.14, H * (tall ? 0.36 : 0.5) - s * 0.2); g.stroke();
    text(g, '綠茶', W * (tall ? 0.5 : 0.32), H * (tall ? 0.74 : 0.42), `900 ${s * 0.26}px ${SUNG}`, '#e9ffd9', { spacing: s * 0.04 });
    text(g, 'MATCHA · 冷泡', W * (tall ? 0.5 : 0.32), H * (tall ? 0.88 : 0.74), `600 ${s * 0.06}px ${HEI}`, '#7ed957', { spacing: s * 0.03 });
  },
  // concert
  (g, W, H, tall, s) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * (tall ? 0.4 : 0.5);
    for (let r = 12; r > 0; r--) { g.fillStyle = `hsl(${280 + r * 8}, 100%, ${10 + r * 4}%)`; g.beginPath(); g.arc(cx, cy, s * 0.04 * r, 0, Math.PI * 2); g.fill(); }
    text(g, 'MIKA', cx, cy, `800 ${s * 0.22}px ${OX}`, '#ffffff', { spacing: s * 0.04 });
    text(g, '演唱會 LIVE', W * 0.5, H * (tall ? 0.78 : 0.86), `700 ${s * 0.08}px ${HEI}`, '#ffd1ff', { spacing: s * 0.03 });
    text(g, '03.14 · ZENITH ARENA', W * 0.5, H * (tall ? 0.86 : 0.95), `400 ${s * 0.04}px ${MONO}`, '#c9a0ff', { spacing: s * 0.03, maxW: W * 0.92 });
  },
  // mahjong
  (g, W, H, tall, s) => {
    g.fillStyle = '#04563c'; g.fillRect(0, 0, W, H);
    const tw = s * 0.16, th = s * 0.22;
    const tiles = ['中', '發', '白'];
    tiles.forEach((t, i) => {
      const x = tall ? W * 0.5 - tw / 2 : W * (0.08 + i * 0.13), y = tall ? H * (0.08 + i * 0.13) : H * 0.3;
      g.fillStyle = '#f7f2e4'; g.beginPath(); g.roundRect(x, y, tw, th, tw * 0.12); g.fill();
      text(g, t, x + tw / 2, y + th / 2, `900 ${tw * 0.7}px ${SUNG}`, i === 0 ? '#c8102e' : i === 1 ? '#00843d' : '#1d4ed8');
    });
    text(g, '麻雀館', W * (tall ? 0.5 : 0.7), H * (tall ? 0.7 : 0.42), `900 ${s * 0.18}px ${HEI}`, '#ffd76a', { spacing: s * 0.04 });
    text(g, 'MAHJONG · 通宵', W * (tall ? 0.5 : 0.7), H * (tall ? 0.82 : 0.7), `600 ${s * 0.06}px ${OX}`, '#e8ffe9', { spacing: s * 0.03, maxW: (tall ? W : W * 0.55) * 0.92 });
  },
];

// atlas: tall cells (1:2) in the top half, wide cells (2:1) below
export function drawAdAtlas(small) {
  const A = small ? 2048 : 4096;
  const cv = document.createElement('canvas');
  cv.width = A; cv.height = A;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, A, A);
  const pw = A / 8, ph = A / 4, lw = A / 4, lh = A / 8;
  ADS.forEach((draw, i) => {
    for (const tall of [true, false]) {
      const W = tall ? pw : lw, H = tall ? ph : lh;
      const x = tall ? (i % 8) * pw : (i % 4) * lw, y = tall ? Math.floor(i / 8) * ph : A / 2 + Math.floor(i / 4) * lh;
      g.save(); g.beginPath(); g.rect(x, y, W, H); g.clip(); g.translate(x, y);
      draw(g, W, H, tall, Math.min(W, H));
      g.restore();
    }
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

export async function loadAdFonts() {
  const sample = '義體雷霆能量天頂銀行感知一切麵牛肉新星飛行直航月台點心明日製造藥房遊戲機中心霓虹夜市雲上之家綠茶冷泡演唱會麻雀館通宵中發白無痛升級分期付款';
  try {
    await Promise.all([
      document.fonts.load(`900 64px ${HEI}`, sample), document.fonts.load(`700 64px ${SUNG}`, sample),
      document.fonts.load(`800 64px ${OX}`, 'VOLT'), document.fonts.load(`200 64px ${OX}`, 'SYNAPSE'), document.fonts.load(`800 64px ${MONO}`, 'ARCADE'),
    ]);
  } catch { /* fallbacks draw instead */ }
}

export function createAdScreens(city, atlas) {
  const m = new THREE.MeshStandardNodeMaterial();
  const prm = attribute('aAd', 'vec4'); // campaign a, campaign b, tall, seed
  const lp = positionGeometry, ln = normalGeometry;
  const front = step(0.5, ln.z);
  const u = lp.x.add(0.5), v = lp.y.add(0.5);
  const tall = prm.z, seed = prm.w;
  // cell origin in the atlas (v up from the bottom of the texture)
  const cellUV = (id) => {
    const tx = fract(id.div(8)).mul(8).floor().div(8), ty = float(1).sub(floor(id.div(8)).add(1).div(4));
    const wx = fract(id.div(4)).mul(4).floor().div(4), wy = float(0.5).sub(floor(id.div(4)).add(1).div(8));
    return vec2(mix(wx.add(u.div(4)), tx.add(u.div(8)), tall), mix(wy.add(v.div(8)), ty.add(v.div(4)), tall));
  };
  const period = mix(float(7), float(12), seed);
  const phase = fract(U.time.div(period).add(seed.mul(5)));
  const showB = step(0.5, phase);
  // a wipe across the board at each change, with a band of noise at its edge
  const wipe = fract(phase.mul(2)).mul(8).clamp(0, 1);
  const edgeX = mix(v, u, step(0.5, fract(seed.mul(9.1))));
  const crossed = step(edgeX, wipe);
  const prevB = showB.oneMinus();
  const useB = mix(prevB, showB, crossed);
  const id = mix(prm.x, prm.y, useB);
  const c = texture(atlas, cellUV(id)).rgb;
  const band = smoothstep(0.06, 0.0, abs(edgeX.sub(wipe))).mul(step(wipe, 0.999));
  // glitch: now and then a few rows slide and split
  const gl = step(0.985, hash12(vec2(floor(U.time.mul(12)), seed.mul(77))));
  const row = floor(v.mul(40));
  const slide = gl.mul(step(0.6, hash12(vec2(row, floor(U.time.mul(12))))));
  const cg = texture(atlas, cellUV(id).add(vec2(slide.mul(0.006), 0))).rgb;
  const col = mix(c, vec3(cg.r, c.g, cg.b), slide);
  // LED pitch, only where it resolves; a scan bar rolls down
  const px = vec2(u, v).mul(mix(vec2(256, 128), vec2(128, 256), tall)).mul(2);
  const fw = max(fwidth(px.x), fwidth(px.y));
  const dot = smoothstep(0.62, 0.3, length(fract(px).sub(0.5)));
  const pitch = mix(dot.mul(0.75).add(0.35), float(1), smoothstep(0.25, 0.6, fw));
  const scan = smoothstep(0.08, 0.0, abs(fract(v.add(U.time.mul(0.11)).add(seed)).sub(0.5))).mul(0.25).add(1);
  const border = step(0.012, u).mul(step(u, 0.988)).mul(step(0.012, v)).mul(step(v, 0.988));
  const lum = col.mul(pitch).mul(scan).mul(border).add(vec3(0.6, 0.85, 1.0).mul(band.mul(1.5)));
  // the back is the steel frame: posts, rails and cross-bracing every two metres
  const dim = attribute('aDim', 'vec2');
  const bu = u.mul(dim.x).div(2), bv = v.mul(dim.y).div(2);
  const fwu = fwidth(bu).max(fwidth(bv));
  const bar = (x) => smoothstep(fwu.add(0.05), float(0.05), abs(fract(x.add(0.5)).sub(0.5)));
  const truss = max(max(bar(bu), bar(bv)), max(bar(bu.add(bv)), bar(bu.sub(bv))).mul(0.8));
  const back = step(ln.z, -0.5);
  const frameCol = mix(vec3(0.012, 0.012, 0.014), vec3(0.11, 0.105, 0.1), truss);
  m.colorNode = mix(mix(vec3(0.02, 0.02, 0.024), frameCol, back), col.mul(0.08), front);
  m.roughnessNode = float(0.35);
  m.metalnessNode = mix(float(0.7), float(0.1), front);
  m.emissiveNode = lum.mul(lum).mul(2.6).add(lum.mul(0.4)).mul(front).add(frameCol.mul(vec3(0.9, 0.6, 0.65)).mul(0.25).mul(back));

  const box = new THREE.BoxGeometry(1, 1, 1);
  box.deleteAttribute('uv');
  const group = chunkedInstances({
    items: city.screens,
    geometry: box,
    material: m,
    name: 'adscreens',
    place: (s) => [s.x, s.y, s.z, s.rotY, s.w, s.h, 0.35],
    attrs: {
      aDim: { size: 2, fn: (s) => [s.w, s.h] },
      aAd: {
        size: 4,
        fn: (s) => {
          const tallS = s.h > s.w ? 1 : 0;
          const a = Math.floor(s.seed * 16), b = (a + 1 + Math.floor(((s.seed * 97.3) % 1) * 15)) % 16;
          return [a, b, tallS, (s.seed * 13.7) % 1];
        },
      },
    },
  });
  return { group, material: m };
}

// Obstruction lights on the skyline: red on the roof corners of anything tall and on mast tips, flashing in
// step per building; camera-facing glows that keep a few pixels at any distance.
export function createAviationLights(city) {
  const pts = [];
  for (const b of city.buildings) {
    if (b.baked || b.zenith || b.h < 70) continue;
    const ph = (b.seed * 17.3) % 1, flash = b.h > 140 ? 1 : 0;
    for (const t of b.tiers) {
      if (t.mast) { pts.push([t.x, t.y1 + 0.4, t.z, ph, 1]); continue; }
      if (t.feat || t.y1 < b.h - 0.01) continue;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pts.push([t.x + sx * (t.w / 2 - 0.5), t.y1 + 0.5, t.z + sz * (t.d / 2 - 0.5), ph, flash]);
    }
  }
  const n = pts.length;
  const pos = new Float32Array(n * 12), ctr = new Float32Array(n * 12), prm = new Float32Array(n * 8), idx = new Uint32Array(n * 6);
  pts.forEach(([x, y, z, ph, fl], i) => {
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([cx, cy], k) => {
      pos.set([cx, cy, 0], i * 12 + k * 3);
      ctr.set([x, y, z], i * 12 + k * 3);
      prm.set([ph, fl], i * 8 + k * 2);
    });
    idx.set([0, 1, 2, 0, 2, 3].map((v) => v + i * 4), i * 6);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aCtr', new THREE.BufferAttribute(ctr, 3));
  g.setAttribute('aPrm', new THREE.BufferAttribute(prm, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const c = attribute('aCtr', 'vec3'), p = attribute('aPrm', 'vec2');
  const dir = c.sub(cameraPosition);
  const dist = length(dir);
  const fwd = dir.div(dist);
  const right = normalize(cross(fwd, vec3(0, 1, 0)));
  const up = cross(right, fwd);
  const size = max(float(0.9), dist.mul(0.0024));
  m.positionNode = c.add(right.mul(positionGeometry.x).add(up.mul(positionGeometry.y)).mul(size));
  const r = length(positionGeometry.xy);
  const on = mix(float(0.55), smoothstep(0.0, 0.08, fract(U.time.div(1.6).add(p.x))).mul(smoothstep(0.42, 0.3, fract(U.time.div(1.6).add(p.x)))), p.y);
  const core = smoothstep(0.35, 0.0, r).mul(8).add(smoothstep(1, 0, r).pow(3).mul(1.2));
  m.colorNode = vec3(1.0, 0.07, 0.04).mul(core).mul(on);
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.name = 'aviation';
  return { group: mesh, count: n };
}
