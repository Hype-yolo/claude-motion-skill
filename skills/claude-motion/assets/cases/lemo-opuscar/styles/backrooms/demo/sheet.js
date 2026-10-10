// "东西"的剪影设计页（关卡 1 交付）：index.html?sheet=1
// 左：正面剪影（静止 / 挥手）与 1.75 m 员工、2.70 m 吊顶的比例；中下：挥手的四个相位；右：设计要点 + 片中的样子
import { drawThing } from './thing2d.js';

for (const f of ["700 30px 'IBM Plex Sans Condensed'", "400 30px 'IBM Plex Sans'", "600 30px 'IBM Plex Sans'", "600 30px 'IBM Plex Mono'", "500 30px 'IBM Plex Mono'"]) await document.fonts.load(f);
const W = 1920, H = 1080;
const ov = document.getElementById('ov'), x = ov.getContext('2d');
const ctxImg = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = 'out/t/fig_ctx.jpg'; });

const PPM = 270, FLOOR = 950;
const px = (m, cx) => cx + m * PPM, py = m => FLOOR - m * PPM;
function human(cx) {   // 1.75 m 的普通员工参考（灰，同样的画法，正常比例）
  x.save(); x.translate(cx, FLOOR); x.fillStyle = x.strokeStyle = '#c9c1ad';
  const S = PPM; const L = (a, b, w) => { x.lineCap = 'round'; x.lineWidth = w * S; x.beginPath(); x.moveTo(a[0] * S, -a[1] * S); x.lineTo(b[0] * S, -b[1] * S); x.stroke(); };
  for (const sd of [-1, 1]) { L([sd * .09, .9], [sd * .1, .08], .15); L([sd * .21, 1.43], [sd * .24, .82], .09); }
  x.beginPath(); x.moveTo(-.19 * S, -1.46 * S); x.lineTo(.19 * S, -1.46 * S); x.lineTo(.15 * S, -.9 * S); x.lineTo(-.15 * S, -.9 * S); x.closePath(); x.fill();
  L([-.17, 1.44], [.17, 1.44], .1); L([0, 1.45], [0, 1.56], .1);
  x.beginPath(); x.ellipse(0, -1.65 * S, .1 * S, .125 * S, 0, 0, 7); x.fill();
  x.restore();
}
function render() {
  x.fillStyle = '#e8e3d2'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(120,110,80,.13)'; x.lineWidth = 1;
  for (let X = 40; X < 1240; X += PPM / 4) { x.beginPath(); x.moveTo(X, 170); x.lineTo(X, FLOOR); x.stroke(); }
  for (let m = 0; m <= 2.75; m += .25) { x.beginPath(); x.moveTo(40, py(m)); x.lineTo(1240, py(m)); x.stroke(); }
  // 标题
  x.fillStyle = '#1d1b17'; x.font = "700 52px 'IBM Plex Sans Condensed'"; x.fillText('"THE COWORKER" — silhouette design', 48, 74);
  x.font = "400 25px 'IBM Plex Sans'"; x.fillStyle = '#4a4436';
  x.fillText('Seen once, ~25 m away, standing in a gap of dead lights. In focus for about half a second. Never a close-up.', 48, 116);
  // 高度线
  const lines = [[0, 'FLOOR', '#5d5545', []], [1.75, 'STAFF  1.75 m', '#857b62', [10, 8]], [2.42, 'IT  2.42 m', '#8a2a1a', [10, 8]], [2.7, 'CEILING GRID  2.70 m', '#5d5545', [4, 6]]];
  x.font = "600 20px 'IBM Plex Mono'";
  for (const [m, t, c, d] of lines) { x.strokeStyle = c; x.setLineDash(d); x.lineWidth = m ? 1.6 : 3; x.beginPath(); x.moveTo(40, py(m)); x.lineTo(1240, py(m)); x.stroke(); x.fillStyle = c; x.fillText(t, 48, py(m) - 8); }
  x.setLineDash([]);
  // 参考员工 + 两个正面剪影
  human(270);
  x.save(); x.translate(560, FLOOR); drawThing(x, PPM, { wave: 1, ph: .5, tilt: .28 }); x.restore();
  x.font = "600 22px 'IBM Plex Sans'"; x.fillStyle = '#3a352a'; x.textAlign = 'center';
  x.fillText('reference: staff', 270, FLOOR + 36); x.fillText('front — the wave', 600, FLOOR + 36);
  // 挥手相位小图（同一比例尺的一半）
  [-1.4, 0, 1.4].forEach((p, i) => { x.save(); x.translate(840 + i * 150, FLOOR); drawThing(x, PPM * .5, { wave: 1, ph: p, tilt: .28 }); x.restore(); });
  x.fillText('wave cycle, 2.4 s (too slow)', 1010, FLOOR + 36);
  x.textAlign = 'left';
  // 设计要点
  const notes = [
    ['Reads as a colleague first:', 1], ['shirt collar, straight posture, a polite wave.', 0], ['', 0],
    ['Then it is wrong by 15–40%:', 1], ['· 2.42 m — head nearly touches the grid', 0], ['· head 0.8× a person, neck 1.6× long, tilted', 0],
    ['· shoulders narrow, set high, sloped', 0], ['· arms hang to the knee; long fingers', 0], ['', 0],
    ['Pure matte near-black #0B0A09. No face,', 0], ['no eyes. A hole in the light.', 0],
  ];
  notes.forEach(([n, b], i) => { x.font = `${b ? 600 : 400} 23px 'IBM Plex Sans'`; x.fillStyle = '#2d2a22'; x.fillText(n, 1290, 190 + i * 32); });
  x.fillStyle = 'rgba(0,0,0,.1)'; x.fillRect(1268, 160, 2, 860);
  // 片中的样子
  if (ctxImg) {   // 4:3 画幅中央 1/2 区域（放大 2 倍看）
    x.drawImage(ctxImg, 240 + 360, 270, 720, 540, 1290, 560, 590, 442);
    x.font = "600 20px 'IBM Plex Mono'"; x.fillStyle = '#5d5545'; x.fillText('ON TAPE (33.4 s, zoomed, 2× crop)', 1290, 548);
  }
}
window.DUR = 1; window.render = render; render(); window.READY = true;
