// worlds.js — 每个平行宇宙一套配色的背景、客串外星人、传送门
// 舞台坐标：1920×1080，地平线/地面约 y=900；背景画得比舞台宽，给推拉摇留余量
import { clamp, lerp, hash, vnoise, TAU, ss } from '/core/lib.js';
import { INK, g, push, pop, translate, rotate, scale, shape, fillOnly, stroke, ell, arc, spline, rr, rect, noodle, quad, dot, text, bands, S } from './toon.js';
import { eye, mouth, hand, vask, PAL } from './chars.js';

const X0 = -1400, X1 = 3400;

// 果冻摇摆：矩形点加剪切
function jellyRect(x, y, w, h, r, t, amp, ph) {
  const k = Math.sin(t * 5.2 + ph) * amp;
  return rr(x, y, w, h, r).map(([px, py]) => [px + k * (y + h - py) / h, py + Math.sin(t * 5.2 + ph + 1) * amp * .15 * (py - y - h) / h]);
}

// ———————————————————— 传送门 ————————————————————
// cx,cy 中心；r 半径；open 0..1；t 时间（漩涡每帧平滑旋转）
export function portal(cx, cy, r, t, { open = 1, sx = .74, spin = 1 } = {}) {
  if (open <= .001) return;
  const R = r * open;
  push(); translate(cx, cy); scale(sx, 1);
  fillOnly(ell(0, 0, R * 1.55, R * 1.45, 48), 'rgba(140,255,90,.14)', { boil: .6 });
  fillOnly(ell(0, 0, R * 1.28, R * 1.22, 48), 'rgba(140,255,90,.18)', { boil: .6 });
  // 黏液外缘
  const rim = []; const N = 22;
  for (let i = 0; i < N; i++) { const a = i / N * TAU, k = 1 + .09 * (vnoise(i * 1.7 + t * 3) - .5) * 2 + .05 * Math.sin(a * 5 + t * 6); rim.push([Math.cos(a) * R * k, Math.sin(a) * R * k]); }
  const rimS = spline(rim);
  shape(rimS, {
    fill: '#3fd93a', lw: 8, shade: () => {
      fillOnly(ell(0, 0, R * .9, R * .9, 40), '#6ef24c', { boil: .3 });
      // 旋臂
      const arms = 5;
      for (let k = 0; k < arms; k++) {
        const pts = [], pts2 = [];
        for (let j = 0; j <= 22; j++) {
          const u = j / 22, rr_ = R * (1 - u) * .95, a = k / arms * TAU + u * 3.6 + t * 2.6 * spin;
          pts.push([Math.cos(a) * rr_, Math.sin(a) * rr_]);
          const a2 = a + .55 * (1 - u * .7); pts2.push([Math.cos(a2) * rr_, Math.sin(a2) * rr_]);
        }
        fillOnly([...pts, ...pts2.reverse()], k % 2 ? '#b8ff5a' : '#21b33c', { boil: .4 });
      }
      fillOnly(ell(0, 0, R * .3, R * .3, 24), '#dcffa8', { boil: .5 });
      fillOnly(ell(0, 0, R * .14, R * .14, 16), '#ffffff', { boil: .5 });
    }
  });
  // 火花
  for (let i = 0; i < 12; i++) {
    const a = hash(i) * TAU + t * (1.5 + hash(i + 4) * 2), d = R * (1.05 + .25 * ((t * .8 + hash(i + 9)) % 1));
    dot(Math.cos(a) * d, Math.sin(a) * d, 5 + hash(i + 2) * 4, i % 3 ? '#caff7a' : '#ffffff');
  }
  // 滴落
  if (open > .6) for (let i = 0; i < 3; i++) {
    const u = (t * .9 + i / 3) % 1, x = (-.4 + i * .4) * R, y0 = R * .92;
    shape(spline([[x - 10, y0], [x + 10, y0], [x + 7, y0 + 20 + u * 40], [x, y0 + 32 + u * 50], [x - 7, y0 + 20 + u * 40]]), { fill: '#3fd93a', lw: 6 });
  }
  pop();
}

// ———————————————————— 实验室 ————————————————————
export function lab(t, { clockMin = 58, screen = 'no', drip = -1, potDrops = 0, green = 0 } = {}) {
  // 墙
  fillOnly(rect(X0, -1200, X1 - X0, 2100), '#a7c3b1', { boil: 0 });
  for (let x = -1200; x < 3400; x += 260) stroke([[x, -1200], [x, 860]], 4, { line: '#7c9d8a' });
  fillOnly(rect(X0, -1200, X1 - X0, 170), '#8fae9b', { boil: 0 });
  // 日光灯
  shape(rr(700, -40, 520, 46, 10), { fill: '#eef6f0', lw: 6 }); stroke([[760, -60], [760, -40]], 5); stroke([[1160, -60], [1160, -40]], 5);
  // 地板
  shape(rect(X0, 860, X1 - X0, 900), { fill: '#6c7c75', lw: 6 });
  for (let k = 0; k < 4; k++) stroke([[X0, 900 + k * 60 + k * k * 12], [X1, 900 + k * 60 + k * k * 12]], 4, { line: '#58665f' });
  shape(rect(X0, 830, X1 - X0, 32), { fill: '#557065', lw: 6 });
  // 黑板
  shape(rr(620, 250, 560, 330, 10), {
    fill: '#2f4a3f', lw: 8, shade: () => {
      text('COFFEE ≥ EVERYTHING', 900, 305, { font: '400 38px VT323', fill: '#e8f0e0' });
      text('∂(me)/∂t = caffeine − Gary', 890, 360, { font: '400 32px VT323', fill: '#e8f0e0' });
      text('PORTAL v7  (DO NOT)', 860, 520, { font: '400 30px VT323', fill: '#ffd36e' });
    }
  });
  stroke(spline([[700, 450], [740, 410], [780, 450], [740, 490], [715, 455], [740, 430], [760, 450]], false), 4, { line: '#e8f0e0' });
  stroke([[1040, 420], [1120, 470]], 4, { line: '#e8f0e0' }); stroke([[1040, 470], [1120, 420]], 4, { line: '#e8f0e0' });
  shape(rr(640, 572, 520, 16, 4), { fill: '#b08a5a', lw: 5 });
  // 挂钟 6:58
  push(); translate(1420, 160);
  shape(ell(0, 0, 78, 78, 40), { fill: '#f7f3e8', lw: 8 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; stroke([[Math.cos(a) * 60, Math.sin(a) * 60], [Math.cos(a) * 68, Math.sin(a) * 68]], 4); }
  const mA = clockMin / 60 * TAU - Math.PI / 2, hA = (6 + clockMin / 60) / 12 * TAU - Math.PI / 2;
  stroke([[0, 0], [Math.cos(hA) * 38, Math.sin(hA) * 38]], 8); stroke([[0, 0], [Math.cos(mA) * 58, Math.sin(mA) * 58]], 5);
  const sA = Math.floor(t) / 60 * TAU - Math.PI / 2; stroke([[0, 0], [Math.cos(sA) * 60, Math.sin(sA) * 60]], 2.5, { line: '#e8392b' });
  dot(0, 0, 7);
  pop();
  // 右侧架子 + 烧瓶
  for (const y of [360, 560]) shape(rr(1580, y, 560, 22, 4), { fill: '#b08a5a', lw: 6 });
  const flask = (x, y, h, col, kind) => {
    if (kind === 0) shape(spline([[x - 12, y - h], [x + 12, y - h], [x + 12, y - h * .55], [x + 40, y - 6], [x - 40, y - 6], [x - 12, y - h * .55]]), { fill: '#e8f6f4', lw: 6, shade: () => fillOnly(rect(x - 60, y - h * .38, 120, h), col, { boil: .3 }) });
    else shape(rr(x - 26, y - h, 52, h, 10), { fill: '#e8f6f4', lw: 6, shade: () => fillOnly(rect(x - 40, y - h * .6, 80, h), col, { boil: .3 }) });
  };
  flask(1640, 360, 110, '#ff4fa0', 0); flask(1730, 360, 80, '#9cf23c', 1); flask(1820, 360, 120, '#44c8f5', 0); flask(1930, 360, 90, '#ffb020', 1);
  // 泡着眼球的罐子（伏笔）
  shape(rr(2010, 250, 90, 110, 14), { fill: '#d8f5ea', lw: 6, shade: () => { fillOnly(rect(2000, 280, 110, 90), '#b6ecd4', { boil: .3 }); } });
  eye(2055, 318, 22, 22, { look: [-.8, .2], pupil: 5 });
  for (let i = 0; i < 5; i++) shape(rr(1620 + i * 42, 470 - (i % 2) * 14, 36, 90 + (i % 2) * 14, 4), { fill: ['#e85d4a', '#4a7fe8', '#e8c14a', '#8e5ae8', '#4ab87a'][i], lw: 6 });
  // 左侧：台面 + 咖啡机
  shape(rect(-200, 640, 840, 240), { fill: '#8e7a66', lw: 7, shade: () => { fillOnly(rect(-200, 640, 840, 30), '#a8927c', { boil: .3 }); } });
  for (let x = -120; x < 640; x += 250) shape(rr(x, 700, 220, 150, 8), { fill: '#7a6857', lw: 6 });
  shape(rr(-230, 616, 900, 34, 6), { fill: '#d9d4c8', lw: 7 });
  // 咖啡机（复古 CRT 脸）
  shape(rr(170, 290, 330, 330, 26), { fill: '#c4c9d1', lw: 8, shade: () => { fillOnly(rect(400, 280, 120, 360), '#a3a9b3', { boil: .3 }); } });
  shape(rr(215, 330, 200, 140, 18), {
    fill: screen === 'no' ? '#1c2b25' : '#1c2b25', lw: 7, shade: () => {
      const blink = Math.floor(t * 2) % 2 === 0;
      if (screen === 'no') {
        eye(275, 380, 14, 14, { look: [0, .5], pupil: 0, closed: true, lw: 5 });
        stroke(arc(275, 392, 12, 8, Math.PI * 1.1, Math.PI * 1.9, 8), 5, { line: '#7dff6a' });
        stroke(arc(355, 392, 12, 8, Math.PI * 1.1, Math.PI * 1.9, 8), 5, { line: '#7dff6a' });
        stroke(arc(315, 440, 22, 12, Math.PI * 1.15, Math.PI * 1.85, 10), 5, { line: '#7dff6a' });
        if (blink) text('NO', 315, 360, { font: '400 44px VT323', fill: '#ff5a4a' });
      } else if (screen === 'yes') {
        text('...', 315, 400, { font: '400 60px VT323', fill: '#7dff6a' });
      }
    }
  });
  shape(rr(280, 480, 70, 34, 6), { fill: '#7a808a', lw: 6 });   // 出水口
  for (const bx of [440, 470]) shape(ell(bx, 380, 12, 12, 12), { fill: bx === 440 ? '#e8392b' : '#f5c23c', lw: 5 });
  // 咖啡壶
  shape(spline([[250, 520], [380, 520], [392, 590], [368, 616], [262, 616], [238, 590]]), { fill: 'rgba(220,240,250,.85)', lw: 7, shade: () => { if (potDrops) fillOnly(rect(220, 606, 200, 20), '#5a3a26', { boil: .3 }); } });
  shape(noodle([390, 545], [420, 590], -18, 12, 12), { fill: '#2b2b33', lw: 5 });
  shape(rr(244, 510, 142, 18, 6), { fill: '#2b2b33', lw: 5 });
  if (drip >= 0) {   // 最后一滴
    const y = lerp(514, 606, clamp(drip * drip));
    if (drip < 1) shape(spline([[315, y - 14], [322, y], [315, y + 8], [308, y]]), { fill: '#5a3a26', lw: 4 });
    else if (drip < 1.4) { const u = (drip - 1) / .4; stroke(arc(315, 606, 18 * u + 4, 5 * u + 2, Math.PI, TAU, 10), 3); }
  }
  // 仙人掌
  shape(rr(560, 560, 60, 56, 8), { fill: '#d9774a', lw: 6 });
  shape(rr(572, 490, 36, 76, 18), { fill: '#5fae4a', lw: 6 });
  shape(noodle([604, 530], [630, 500], -8, 16, 14), { fill: '#5fae4a', lw: 5 });
  if (green > 0) fillOnly(rect(X0, -1200, X1 - X0, 3000), `rgba(120,255,80,${.1 * green})`, { boil: 0 });
}

// ———————————————————— 果冻宇宙 J-9 ————————————————————
export function jelly(t, { counter = true } = {}) {
  bands(['#ff4f9a', '#ff66ab', '#ff80bb', '#ff9bcb'], -1000, 760);
  // 果冻太阳
  push(); translate(1500, 170); scale(1 + Math.sin(t * 6) * .05, 1 - Math.sin(t * 6) * .05);
  shape(ell(0, 0, 110, 110, 40), { fill: '#e9ff5c', lw: 7, shade: () => fillOnly(ell(-35, -40, 30, 18, 16), '#ffffff', { boil: .3 }) });
  pop();
  // 飘浮果冻块
  for (let i = 0; i < 6; i++) {
    const x = hash(i + 1) * 2600 - 400, y = 80 + hash(i + 7) * 380 + Math.sin(t * 1.5 + i) * 18, s = 40 + hash(i + 3) * 40;
    push(); translate(x, y); rotate(Math.sin(t + i) * .3);
    shape(jellyRect(-s / 2, -s / 2, s, s, 10, t, 5, i), { fill: ['#9df03c', '#52e0e0', '#ffd23c'][i % 3], lw: 6, shade: () => fillOnly(rect(-s * .3, -s * .35, s * .18, s * .5), 'rgba(255,255,255,.6)', { boil: 0 }) });
    pop();
  }
  // 果冻楼群
  const B = [[-500, 260, 520], [-180, 200, 620], [80, 240, 480], [1220, 230, 560], [1500, 280, 700], [1830, 220, 520], [2100, 260, 600]];
  B.forEach(([x, w, h], i) => {
    shape(jellyRect(x, 780 - h, w, h, 40, t, 14, i * 1.3), {
      fill: i % 2 ? '#b8f03c' : '#8fe03a', lw: 7, shade: () => {
        fillOnly(rect(x + w * .66, 0, w * .5, 900), 'rgba(40,120,20,.28)', { boil: .3 });
        for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) fillOnly(rr(x + 36 + c * (w * .45), 780 - h + 60 + r * 110, w * .28, 60, 20), '#ff66ab', { boil: .4 });
      }
    });
  });
  // 地面
  const gp = [[X0, 780]]; for (let x = X0; x <= X1; x += 160) gp.push([x, 780 + Math.sin(x * .01 + t * 3) * 10]);
  shape([...gp, [X1, 1600], [X0, 1600]], { fill: '#b62c8c', lw: 7, shade: () => { for (let i = 0; i < 18; i++) fillOnly(ell(hash(i + 20) * 3200 - 700, 850 + hash(i + 30) * 300, 40 + hash(i) * 50, 14, 16), '#d24aa6', { boil: .3 }); } });
  // 招牌
  if (counter) {
    push(); translate(560, 250); rotate(Math.sin(t * 3) * .04);
    stroke([[-120, -120], [-120, -40]], 5); stroke([[120, -120], [120, -40]], 5);
    shape(rr(-230, -50, 460, 110, 30), { fill: '#52e0e0', lw: 8 });
    text('CAFÉ GLORP', 0, 8, { font: '400 64px "Titan One"', fill: '#ffffff', outlineW: 10 });
    pop();
  }
}
export function jellyCounter(t) {
  shape(jellyRect(520, 700, 880, 220, 40, t, 6, 2), { fill: '#52e0e0', lw: 8, shade: () => { fillOnly(rect(520, 700, 880, 40), '#8ff2f2', { boil: .3 }); fillOnly(rect(1150, 700, 300, 300), 'rgba(0,80,100,.25)', { boil: .3 }); } });
}
// 独眼果冻店员
export function blobby(x, y, s, t, { look = [0, 0], blink = false, o = 0, lean = 0 } = {}) {
  push(); translate(x, y); scale(s); rotate(lean);
  const w = Math.sin(t * 7) * 8;
  const body = spline([[-150, 0], [-160, -140], [-110, -250 + w], [0, -290 - w], [110, -250 + w], [160, -140], [150, 0], [0, 12]]);
  shape(body, {
    fill: '#ff7fd0', lw: 8, shade: () => {
      fillOnly(spline([[60, -280], [170, -150], [160, 20], [80, 20], [110, -150]]), '#e855b3', { boil: .3 });
      for (const [a, b, r] of [[-80, -120, 16], [-30, -60, 10], [70, -90, 13], [-100, -200, 9]]) fillOnly(ell(a, b, r, r, 12), '#c53d98', { boil: .3 });
      fillOnly(ell(-70, -220, 26, 14, 14), 'rgba(255,255,255,.7)', { boil: .2 });
    }
  });
  // 眼柄
  const top = [20 + w * 2, -430 - w];
  shape(noodle([0, -270], top, 30, 40, 26), { fill: '#ff7fd0', lw: 7 });
  eye(top[0], top[1], 58, 58, { look, lid: blink ? 1 : .1, skin: '#ff7fd0', pupil: 7 });
  // 嘴 + 口水
  mouth(-10, -140, 110, { o: .35 + o * .5 + Math.abs(Math.sin(t * 3)) * .1, sm: .6, lw: 7 });
  const dr = (t * 1.2) % 1;
  shape(spline([[-40, -120], [-28, -120], [-30, -90 + dr * 60], [-36, -80 + dr * 70], [-42, -90 + dr * 60]]), { fill: '#c9f7ff', lw: 5 });
  // 三只小手
  shape(noodle([-140, -120], [-230, -170 + Math.sin(t * 5) * 20], 30, 36, 26), { fill: '#ff7fd0', lw: 7 });
  shape(noodle([140, -120], [230, -60], -30, 36, 26), { fill: '#ff7fd0', lw: 7 });
  pop();
}
// 杯子里的果冻眼球
export function jellyCup(x, y, s, t, { blink = 0 } = {}) {
  push(); translate(x, y); scale(s);
  shape([[-110, -200], [110, -200], [85, 0], [-85, 0]], { fill: '#f7f3ea', lw: 8, shade: () => fillOnly([[40, -210], [120, -210], [95, 10], [30, 10]], '#d9d1c1', { boil: .3 }) });
  shape(ell(0, -200, 112, 26, 30), { fill: '#e8e0d0', lw: 8 });
  const k = Math.sin(t * 8) * 6;
  shape(jellyRect(-95, -330, 190, 150, 30, t * 1.5, 10, 0), { fill: '#7fe03a', lw: 8, shade: () => { fillOnly(rect(20, -340, 120, 200), 'rgba(30,110,20,.3)', { boil: .3 }); fillOnly(rr(-70, -310, 26, 70, 12), 'rgba(255,255,255,.65)', { boil: .2 }); } });
  eye(5 + k * .5, -262, 44, 44, { look: [.1, .15], lid: blink, skin: '#7fe03a', pupil: 9 });
  pop();
}

// ———————————————————— 马克杯宇宙 M-2 ————————————————————
export function mugWorld(t) {
  bands(['#ff7a2f', '#ff8f3f', '#ffa450', '#ffb862'], -1000, 700);
  // 方糖月亮
  push(); translate(430, 180); rotate(.2 + Math.sin(t) * .03);
  shape(rr(-80, -80, 160, 160, 18), { fill: '#fff8ee', lw: 7, shade: () => { fillOnly(rect(20, -90, 70, 180), '#f0dcc4', { boil: .3 }); for (let i = 0; i < 9; i++) dot(-50 + hash(i) * 100, -50 + hash(i + 5) * 100, 3, '#e8cfae'); } });
  pop();
  // 远山
  shape(spline([[X0, 720], [-300, 560], [300, 640], [800, 520], [1400, 620], [2000, 540], [2600, 650], [X1, 600], [X1, 900], [X0, 900]]), { fill: '#2b9c98', lw: 7 });
  shape(spline([[X0, 760], [-100, 680], [600, 720], [1200, 670], [1900, 730], [2600, 690], [X1, 720], [X1, 900], [X0, 900]]), { fill: '#1f7d7a', lw: 7 });
  // 地面瓷砖
  shape(rect(X0, 760, X1 - X0, 900), { fill: '#135e61', lw: 7, shade: () => { for (let k = 0; k < 6; k++) stroke([[X0, 800 + k * k * 18], [X1, 800 + k * k * 18]], 4, { line: '#0e4a4d' }); for (let x = -1200; x < 3400; x += 180) stroke([[960 + (x - 960) * .3, 760], [x, 1300]], 4, { line: '#0e4a4d' }); } });
}
export function umbrella(x, y, s, col = '#ff5a5a') {
  push(); translate(x, y); scale(s);
  stroke([[0, -300], [0, 0]], 8);
  const top = [[-230, -300], ...arc(0, -300, 230, 110, Math.PI, TAU, 20).slice(1, -1), [230, -300]];
  shape([...top, [230, -300], [0, -300]], { fill: '#fff5e6', lw: 7, shade: () => { for (let k = -2; k <= 2; k += 2) fillOnly([[0, -410], [k * 60 - 50, -290], [k * 60 + 50, -290]], col, { boil: .3 }); } });
  pop();
}
export function table(x, y, s = 1) {
  push(); translate(x, y); scale(s);
  shape(rr(-12, -150, 24, 150, 6), { fill: '#e0d4c0', lw: 6 });
  shape(ell(0, -150, 150, 26, 30), { fill: '#fff5e6', lw: 7 });
  shape(ell(0, 0, 70, 12, 20), { fill: '#e0d4c0', lw: 6 });
  pop();
}
// 马克杯族：杯身长脸，用吸管喝玻璃杯里的小人
export function mugGuy(x, y, s, t, { col = '#e9e2f5', look = [0, 0], turn = 0, lick = 0, sip = 0, lid = .45, guyLevel = 1, page = 0 } = {}) {
  push(); translate(x, y); scale(s);
  // 把手
  shape(spline([[120, -260], [215, -250], [225, -130], [120, -110], [120, -150], [178, -160], [178, -225], [120, -222]]), { fill: col, lw: 8 });
  shape(rr(-130, -330, 260, 330, 36), { fill: col, lw: 8, shade: () => { fillOnly(rect(60, -340, 90, 360), 'rgba(0,0,0,.14)', { boil: .3 }); fillOnly(rect(-140, -290, 300, 26), '#ff7a2f', { boil: .3 }); } });
  shape(ell(0, -330, 130, 30, 30), { fill: '#6b3e26', lw: 8 });
  const fx = turn * 30;
  eye(-45 + fx, -200, 30, 32, { look, lid, pupil: 5, skin: col });
  eye(35 + fx, -200, 30, 32, { look, lid, pupil: 5, skin: col });
  stroke([[-78 + fx, -250], [-20 + fx, -240]], 7); stroke([[10 + fx, -240], [68 + fx, -250]], 7);
  mouth(-5 + fx, -120, 60, { o: sip ? .15 : lick * .4, sm: .5, lw: 6, tongue: true });
  if (lick > 0) shape(spline([[-5 + fx + 20 * lick, -110], [20 + fx + 20 * lick, -104], [10 + fx + 20 * lick, -86], [-12 + fx + 20 * lick, -92]]), { fill: '#e8637a', lw: 5 });
  pop();
}
// 玻璃杯 + 泡在里面看报纸的小人
export function glassGuy(x, y, s, t, { level = 1, page = 0, wave = 0 } = {}) {
  push(); translate(x, y); scale(s);
  const lv = -150 + (1 - level) * 90;
  shape([[-60, -180], [60, -180], [50, 0], [-50, 0]], { fill: 'rgba(210,240,255,.55)', lw: 7, shade: () => fillOnly(rect(-80, lv, 160, 200), '#9c5a32', { boil: .3 }) });
  // 小人：头、报纸
  push(); translate(0, lv - 4);
  shape(ell(0, -30, 20, 22, 18), { fill: '#f2c9a0', lw: 5 });
  dot(-6, -32, 2.5); dot(7, -32, 2.5); stroke([[-6, -20], [6, -20]], 3);
  stroke(arc(0, -44, 18, 10, Math.PI * 1.1, Math.PI * 1.9, 8), 4);
  const pg = page % 1;
  shape([[-50, -40], [0, -34], [0, 6], [-50, 0]], { fill: '#f4f1ea', lw: 4 });
  shape([[0, -34], [50 - pg * 60, -40 - Math.sin(pg * Math.PI) * 20], [50 - pg * 60, 0 - Math.sin(pg * Math.PI) * 20], [0, 6]], { fill: '#eae6dc', lw: 4 });
  for (let k = 0; k < 3; k++) stroke([[-44, -28 + k * 9], [-8, -26 + k * 9]], 2);
  if (wave) { shape(noodle([18, -10], [40, -50 - Math.sin(t * 16) * 8], -6, 8, 7), { fill: '#f2c9a0', lw: 4 }); }
  pop();
  pop();
}
export function straw(a, b) { shape(noodle(a, b, 0, 14, 14), { fill: '#ff5a8a', lw: 5 }); }

// ———————————————————— 蒙太奇三宇宙 ————————————————————
export function teethWorld(t, u) {
  bands(['#c3122f', '#d8203a', '#ea3a4a'], -1000, 760);
  for (let i = 0; i < 6; i++) { const x = hash(i + 50) * 2400 - 200, y = 100 + hash(i + 51) * 250; push(); translate(x, y); tooth(0, 0, .5 + hash(i) * .3, '#ffe9ef'); pop(); }
  shape(spline([[X0, 800], [-200, 700], [400, 760], [1000, 690], [1600, 750], [2200, 700], [X1, 760], [X1, 1600], [X0, 1600]]), { fill: '#ff8fa6', lw: 8, shade: () => { for (let i = 0; i < 14; i++) fillOnly(ell(hash(i + 70) * 2600 - 400, 820 + hash(i + 71) * 200, 50, 16, 14), '#f06a88', { boil: .3 }); } });
  for (let i = 0; i < 7; i++) { push(); translate(-300 + i * 380, 760); tooth(0, 0, .9 + hash(i + 9) * .5, '#fffaf2'); pop(); }
}
export function tooth(x, y, s, col = '#fffaf2') {
  push(); translate(x, y); scale(s);
  shape(spline([[-90, -200], [-30, -220], [0, -195], [30, -220], [90, -200], [100, -110], [70, 0], [40, 0], [20, -60], [-20, -60], [-40, 0], [-70, 0], [-100, -110]]), { fill: col, lw: 8 });
  pop();
}
export function molar(x, y, s, t, { chomp = 0 } = {}) {
  push(); translate(x, y); scale(s);
  const hop = Math.abs(Math.sin(t * 9)) * 30;
  translate(0, -hop);
  const jaw = chomp * 40;
  shape(spline([[-160, -330], [-50, -370], [0, -330], [50, -370], [160, -330], [180, -160], [120, 0], [60, 0], [30, -90], [-30, -90], [-60, 0], [-120, 0], [-180, -160]]), { fill: '#fffaf2', lw: 9, shade: () => fillOnly(rect(80, -380, 140, 400), '#e9e0d6', { boil: .3 }) });
  eye(-55, -240, 34, 38, { look: [0, .2], pupil: 5, skin: '#fffaf2' });
  eye(45, -240, 34, 38, { look: [0, .2], pupil: 5, skin: '#fffaf2' });
  stroke([[-100, -300], [-25, -280]], 9); stroke([[15, -280], [90, -300]], 9);
  mouth(0, -150, 130, { o: .3 + jaw / 60, sm: -.2, lw: 8 });
  pop();
}
export function pigeonWorld(t) {
  bands(['#5f78a8', '#6e87b6', '#7e96c2'], -1000, 780);
  for (let i = 0; i < 9; i++) { const x = -600 + i * 380, h = 260 + hash(i + 3) * 300; shape(rect(x, 780 - h, 300, h + 20), { fill: i % 2 ? '#8b93a6' : '#7a8296', lw: 7, shade: () => { for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) fillOnly(rect(x + 30 + c * 90, 780 - h + 30 + r * 70, 50, 36), '#a9b7d6', { boil: .3 }); } }); }
  stroke(spline([[X0, 250], [0, 330], [960, 300], [1900, 340], [X1, 260]], false), 5);
  for (let i = 0; i < 8; i++) { const x = -200 + i * 320; push(); translate(x, 310 + Math.sin(x * .002) * 10); scale(.35); pigeon(0, 0, 1, t + i, { tie: false }); pop(); }
  shape(rect(X0, 780, X1 - X0, 900), { fill: '#565d6e', lw: 7 });
}
export function pigeon(x, y, s, t, { tie = true, coo = 0 } = {}) {
  push(); translate(x, y); scale(s);
  const bob = Math.floor(t * 6) % 2 ? 18 : -6;
  shape(spline([[-150, -60], [-110, -230], [60, -250], [150, -150], [120, -30], [0, 0]]), { fill: '#8c96ad', lw: 8, shade: () => { fillOnly(spline([[-140, -150], [-40, -120], [40, -60], [-80, -20]]), '#6c7690', { boil: .3 }); } });
  push(); translate(bob, 0);
  shape(spline([[40, -230], [70, -330], [150, -350], [190, -300], [160, -210], [90, -190]]), { fill: '#7a84a0', lw: 8, shade: () => fillOnly(rect(20, -250, 200, 50), '#4fb39a', { boil: .4 }) });
  shape([[185, -310], [245, -296], [186, -284]], { fill: '#e8b43c', lw: 6 });
  eye(150, -305, 18, 18, { look: [.6, 0], pupil: 4, skin: '#7a84a0', lid: .2 });
  pop();
  if (tie) { shape([[40, -190], [80, -190], [70, -110], [60, -60], [50, -110]], { fill: '#e8392b', lw: 6 }); }
  pop();
}
export function vaskCafe(t, { turn = 0, seats = true } = {}) {
  fillOnly(rect(X0, -1200, X1 - X0, 2100), '#3b1f66', { boil: 0 });
  for (let x = -1200; x < 3400; x += 200) fillOnly(rect(x, -1200, 90, 2100), '#46287a', { boil: 0 });
  shape(rect(X0, 820, X1 - X0, 900), { fill: '#e8d84a', lw: 7 });
  const SEATS = [[260, 800, .42, 1], [720, 780, .38, -1], [1180, 790, .4, 1], [1650, 800, .42, -1], [480, 980, .55, 1], [1440, 990, .55, -1]];
  if (seats) SEATS.forEach(([x, y, s, f], i) => {
    table(x + f * 120 * s * 2, y, s * 1.6);
    const lk = turn > (i * .08) ? [(960 - x) / 1400 * f, .5] : [f * .8, 0];
    vask({ x, y, s, face: f, lid: .5, look: lk, holdR: 'mug', armR: { h: [60, 120], bend: 20 }, mouth: { sm: -.3 } });
  });
}

// ———————————————————— "完全正常"宇宙 1-A ————————————————————
export function normalCafe(t) {
  fillOnly(rect(X0, -1200, X1 - X0, 2100), '#f1e3c6', { boil: 0 });
  for (let x = -1200; x < 3400; x += 120) stroke([[x, -1200], [x, 860]], 3, { line: '#e4d2ae' });
  // 吊灯
  for (const lx of [560, 960, 1360]) { stroke([[lx, -200], [lx, 120]], 4); shape(spline([[lx - 60, 180], [lx - 40, 120], [lx + 40, 120], [lx + 60, 180]]), { fill: '#2f6b4f', lw: 6 }); fillOnly(ell(lx, 186, 40, 10, 16), '#fff2b8', { boil: .3 }); }
  // 菜单板
  shape(rr(700, 230, 520, 250, 10), {
    fill: '#3a3a3a', lw: 8, shade: () => {
      text('MENU', 960, 275, { font: '400 44px "Titan One"', fill: '#f1e3c6' });
      text('COFFEE ........ 3', 960, 335, { font: '400 36px VT323', fill: '#f1e3c6' });
      text('TEA ........... 3', 960, 375, { font: '400 36px VT323', fill: '#f1e3c6' });
      text('MUFFIN ........ 2', 960, 415, { font: '400 36px VT323', fill: '#f1e3c6' });
    }
  });
  // 盆栽
  for (const [px, ps] of [[180, 1.1], [1760, 1]]) {
    push(); translate(px, 860); scale(ps);
    for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * .32; shape(spline([[0, -110], [Math.cos(a) * 90 - 20, -110 + Math.sin(a) * 160], [Math.cos(a) * 160, -110 + Math.sin(a) * 210], [Math.cos(a) * 90 + 20, -110 + Math.sin(a) * 150]]), { fill: k % 2 ? '#4f9a4a' : '#3f8a3e', lw: 6 }); }
    shape([[-70, -120], [70, -120], [55, 0], [-55, 0]], { fill: '#c9764a', lw: 7 });
    pop();
  }
  shape(rect(X0, 860, X1 - X0, 900), { fill: '#b08a62', lw: 7, shade: () => { for (let x = -1200; x < 3400; x += 160) stroke([[x, 860], [x - 80, 1600]], 3, { line: '#977350' }); } });
}
export function cafeCounter(t) {
  shape(rect(380, 600, 1160, 300), { fill: '#a8744a', lw: 8, shade: () => { for (let x = 380; x < 1540; x += 90) stroke([[x, 640], [x, 900]], 3, { line: '#8c5e3a' }); } });
  shape(rr(350, 580, 1220, 40, 8), { fill: '#e9dcc4', lw: 7 });
  // 咖啡机
  shape(rr(1180, 410, 260, 176, 14), { fill: '#c9ccd2', lw: 7, shade: () => fillOnly(rect(1360, 400, 100, 200), '#a9adb5', { boil: .3 }) });
  shape(rr(1230, 380, 160, 36, 8), { fill: '#8e939c', lw: 6 });
  dot(1250, 460, 10, '#3fb56b'); dot(1290, 460, 10, '#e8b43c');
}
// 过于标准的店员阿姨
export function barista(x, y, s, t, { arm = 0, o = 0 } = {}) {
  push(); translate(x, y); scale(s);
  shape(spline([[-120, 0], [-130, -180], [-90, -300], [90, -300], [130, -180], [120, 0]]), { fill: '#3f8a5e', lw: 8, shade: () => fillOnly(rr(-70, -260, 140, 260, 20), '#f4f1ea', { boil: .3 }) });
  shape(noodle([-20, -310], [-20, -350], 0, 40, 40), { fill: '#f0c19a', lw: 6 });
  shape(ell(0, -420, 90, 86, 40), { fill: '#f0c19a', lw: 8 });
  shape(spline([[-92, -440], [-60, -505], [0, -515], [60, -505], [92, -440], [60, -470], [0, -478], [-60, -470]]), { fill: '#7a4a2e', lw: 7 });
  shape(ell(0, -530, 40, 34, 24), { fill: '#7a4a2e', lw: 7 });   // 发髻
  stroke(arc(-32, -420, 16, 12, Math.PI * 1.1, Math.PI * 1.9, 8), 6); stroke(arc(32, -420, 16, 12, Math.PI * 1.1, Math.PI * 1.9, 8), 6);
  fillOnly(ell(-55, -385, 16, 8, 10), '#f59a8c', { boil: .3 }); fillOnly(ell(55, -385, 16, 8, 10), '#f59a8c', { boil: .3 });
  mouth(0, -372, 80, { o: .3 + o * .3, sm: 1.2, lw: 6, tongue: false });
  // 递咖啡的手
  const hx = lerp(80, 330, arm), hy = lerp(-150, -230, arm);
  shape(noodle([100, -270], [hx, hy], 20, 42, 34), { fill: '#3f8a5e', lw: 7 });
  hand(hx, hy, -.2, 20, '#f0c19a', { fist: true });
  pop();
  return [x + lerp(80, 330, arm) * s, y + lerp(-150, -230, arm) * s];
}
