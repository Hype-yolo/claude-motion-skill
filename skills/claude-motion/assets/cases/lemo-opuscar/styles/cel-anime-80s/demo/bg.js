// 喷枪背景：加载时一次性画成大图（color + emissive 两张），逐帧只做平移——和真实动画"背景美术 + 赛璐璐"的分工一样
import { canvas, rng, rgba, mix, airbrush, vgrad, TAU, poly, path } from './cel.js';

export const NEON = ['#ff3fa4', '#35e7ff', '#ffd23f', '#ff5a3c', '#b36bff', '#4dff9a'];
const SIGNS_V = ['喫茶', 'ホテル', 'ラーメン', 'カラオケ', '薬局', '洋菓子', 'ネオン', '書店', '中華', 'ビデオ'];
const SIGNS_H = ['BAR', 'CAFE', 'DISCO', 'HOTEL', 'RADIO', '24H', 'VIDEO', 'TAXI', 'PIZZA', 'ARCADE', 'CLUB', 'MOTEL'];

// 霓虹灯管：color 图上画灯管本体（白芯 + 色边），emissive 图上画同形状的色光
function neonText(g, e, txt, x, y, size, col, vertical = false, font = 'Dela Gothic One') {
  for (const [ctx, pass] of [[g, 0], [e, 1]]) {
    ctx.save(); ctx.font = `${size}px "${font}"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const chars = vertical ? [...txt] : [txt];
    chars.forEach((ch, i) => {
      const yy = vertical ? y + (i - (chars.length - 1) / 2) * size * 1.05 : y;
      if (pass === 0) {
        ctx.strokeStyle = rgba(col, .9); ctx.lineWidth = size * .16; ctx.strokeText(ch, x, yy);
        ctx.strokeStyle = mix(col, '#ffffff', .75); ctx.lineWidth = size * .05; ctx.strokeText(ch, x, yy);
      } else {
        ctx.strokeStyle = col; ctx.lineWidth = size * .2; ctx.strokeText(ch, x, yy);
        ctx.strokeStyle = mix(col, '#ffffff', .5); ctx.lineWidth = size * .06; ctx.strokeText(ch, x, yy);
      }
    });
    ctx.restore();
  }
}
function neonRect(g, e, x, y, w, h, col, r = 10) {
  for (const [ctx, pass] of [[g, 0], [e, 1]]) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    ctx.strokeStyle = pass ? col : rgba(col, .85); ctx.lineWidth = pass ? 8 : 6; ctx.stroke();
    ctx.strokeStyle = mix(col, '#ffffff', pass ? .4 : .75); ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
}

// —— 街面楼群（可横向循环）——  mode: 'night' | 'dawn'
export function streetPlate(LW, Hh, seed = 3, mode = 'night') {
  const [c, g] = canvas(LW, Hh), [ec, e] = canvas(LW, Hh), R = rng(seed);
  e.fillStyle = '#000'; e.fillRect(0, 0, LW, Hh);
  const night = mode === 'night';
  const bldg = [];
  for (let x = 0; x < LW;) { const w = 240 + R() * 340; bldg.push([x, Math.min(w, LW - x)]); x += w + (R() < .25 ? 60 + R() * 140 : 0); }
  const base = Hh;   // 人行道线 = 画布底
  for (const [x, w] of bldg) {
    if (w < 120) continue;
    const top = R() < .35 ? 140 + R() * 220 : -20;
    const hue = [night ? '#2a1f4a' : '#6a4a6a', night ? '#1f2446' : '#5a4a70', night ? '#34203f' : '#7a5566', night ? '#232a3d' : '#5b5c78'][Math.floor(R() * 4)];
    // 立面：上暗下亮的喷枪渐变
    vgrad(g, x, top, w, base - top, [[0, mix(hue, '#000000', .45)], [.7, hue], [1, mix(hue, night ? '#ff4fa8' : '#ffb080', .18)]]);
    g.fillStyle = rgba('#000000', .25); g.fillRect(x + w - 10, top, 10, base - top);    // 楼角暗边
    g.fillStyle = rgba('#ffffff', .06); g.fillRect(x, top, 5, base - top);
    if (top > 0) { g.fillStyle = mix(hue, '#000000', .6); g.fillRect(x - 6, top - 10, w + 12, 12); }   // 女儿墙
    // 窗户格
    const cols = Math.max(2, Math.floor(w / 70)), cw = w / cols;
    for (let yy = top + 40; yy < base - 250; yy += 86) for (let i = 0; i < cols; i++) {
      const wx = x + i * cw + cw * .2, ww = cw * .6, lit = R() < (night ? .38 : .15);
      g.fillStyle = lit ? (R() < .7 ? '#ffd98a' : '#9fe8ff') : mix(hue, '#000000', .35);
      g.fillRect(wx, yy, ww, 44);
      if (lit) { e.fillStyle = rgba(g.fillStyle, .35); e.fillRect(wx, yy, ww, 44); g.fillStyle = rgba('#000000', .25); g.fillRect(wx, yy + 30, ww, 14); }
      g.fillStyle = rgba('#000000', .35); g.fillRect(wx, yy + 44, ww, 5);
    }
    // 空调外机、管道
    if (R() < .6) { const ax = x + R() * (w - 60); g.fillStyle = '#4a4a5e'; g.fillRect(ax, base - 330, 50, 32); g.fillStyle = '#2a2a38'; g.beginPath(); g.arc(ax + 25, base - 314, 11, 0, TAU); g.fill(); }
    g.strokeStyle = rgba('#000000', .35); g.lineWidth = 4; g.beginPath(); g.moveTo(x + w * .88, top < 0 ? 0 : top); g.lineTo(x + w * .88, base); g.stroke();
    // 店面：暖光橱窗 + 遮阳棚
    const sy = base - 210;
    const shopCol = ['#ffcf7a', '#ffe7b0', '#ff9f7a', '#9fdcff'][Math.floor(R() * 4)];
    g.fillStyle = mix(hue, '#000000', .5); g.fillRect(x + 8, sy - 20, w - 16, 230);
    vgrad(g, x + 20, sy + 10, w - 40, 180, [[0, rgba(shopCol, night ? .95 : .5)], [1, rgba(mix(shopCol, '#ff6a3c', .4), night ? .8 : .4)]]);
    e.fillStyle = rgba(shopCol, night ? .45 : .12); e.fillRect(x + 20, sy + 10, w - 40, 180);
    // 橱窗里的剪影（人 / 货架）
    g.fillStyle = rgba('#2a1830', .7);
    for (let k = 0; k < 3; k++) { const px = x + 40 + R() * (w - 100); if (R() < .5) { g.beginPath(); g.ellipse(px, sy + 90, 14, 16, 0, 0, TAU); g.fill(); g.fillRect(px - 20, sy + 106, 40, 90); } else g.fillRect(px - 30, sy + 120, 60, 70); }
    g.fillStyle = rgba('#000000', .5); for (let k = 1; k < 3; k++) g.fillRect(x + 20 + (w - 40) * k / 3 - 3, sy + 10, 6, 180);
    // 遮阳棚条纹
    const aw = NEON[Math.floor(R() * NEON.length)];
    for (let k = 0; k < (w - 16) / 36; k++) { g.fillStyle = k % 2 ? mix(aw, '#1a1030', .45) : mix('#f0e8f0', '#1a1030', .35); g.beginPath(); g.moveTo(x + 8 + k * 36, sy - 24); g.lineTo(x + 8 + k * 36 + 36, sy - 24); g.lineTo(x + 8 + k * 36 + 40, sy + 14); g.lineTo(x + 4 + k * 36, sy + 14); g.fill(); }
    // 横招牌（霓虹字）
    const ncol = NEON[Math.floor(R() * NEON.length)], txt = SIGNS_H[Math.floor(R() * SIGNS_H.length)];
    const sgy = sy - 110, sw = Math.min(w - 40, 60 + txt.length * 52);
    g.fillStyle = '#120b1e'; g.fillRect(x + (w - sw) / 2, sgy - 42, sw, 84);
    if (night || R() < .5) { neonText(g, e, txt, x + w / 2, sgy + 2, 56, ncol, false, 'Kanit'); neonRect(g, e, x + (w - sw) / 2 + 8, sgy - 34, sw - 16, 68, ncol, 8); }
    else { g.font = '800 italic 56px Kanit'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = mix(ncol, '#ffffff', .3); g.fillText(txt, x + w / 2, sgy + 2); }
    // 霓虹在墙上的色光溢出
    if (night) airbrush(g, x + w / 2, sgy, sw * .8, 120, ncol, .22);
    // 竖招牌
    if (R() < .7) {
      const vx = x + (R() < .5 ? 26 : w - 26), vt = SIGNS_V[Math.floor(R() * SIGNS_V.length)], vcol = NEON[Math.floor(R() * NEON.length)];
      const vh = vt.length * 72 + 40, vy = Math.max(top + 30, sgy - 70 - vh);
      g.fillStyle = '#150d22'; g.fillRect(vx - 38, vy, 76, vh);
      g.fillStyle = rgba('#000000', .4); g.fillRect(vx + 32, vy, 6, vh);
      if (night || R() < .4) { neonText(g, e, vt, vx, vy + vh / 2, 60, vcol, true); neonRect(g, e, vx - 32, vy + 6, 64, vh - 12, vcol, 6); airbrush(g, vx, vy + vh / 2, 110, vh * .7, vcol, night ? .2 : .08); }
      else { g.font = '60px "Dela Gothic One"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = mix(vcol, '#ffffff', .2); [...vt].forEach((ch, i) => g.fillText(ch, vx, vy + vh / 2 + (i - (vt.length - 1) / 2) * 63)); }
    }
  }
  // 人行道
  return { c, e: ec, w: LW, h: Hh };
}

// 远景天际线（循环）
export function skylinePlate(LW, Hh, seed = 9, mode = 'night') {
  const [c, g] = canvas(LW, Hh), [ec, e] = canvas(LW, Hh), R = rng(seed);
  e.fillStyle = '#000'; e.fillRect(0, 0, LW, Hh);
  const night = mode === 'night';
  for (let layer = 0; layer < 2; layer++) {
    const col = night ? (layer ? '#241a48' : '#1a1438') : (layer ? '#8a5a7a' : '#a07088');
    for (let x = -100; x < LW + 100;) {
      const w = 60 + R() * 160, h = (layer ? 180 : 260) + R() * (layer ? 260 : 420), y = Hh - h;
      g.fillStyle = col; g.fillRect(x, y, w, h);
      if (R() < .3) { g.fillRect(x + w / 2 - 3, y - 60, 6, 60); e.fillStyle = '#ff2a2a'; e.beginPath(); e.arc(x + w / 2, y - 60, 4, 0, TAU); e.fill(); g.fillStyle = '#ff5050'; g.beginPath(); g.arc(x + w / 2, y - 60, 3, 0, TAU); g.fill(); g.fillStyle = col; }
      // 窗格（成行成列，少量亮灯）+ 受光边
      g.fillStyle = rgba(night ? '#6a5aa8' : '#ffd0b0', layer ? .35 : .22); g.fillRect(x, y, 3, h);
      const cols = Math.max(1, Math.floor(w / 16)), rows = Math.floor(h / 22), lit = night ? (layer ? .3 : .18) : .05;
      for (let rI = 0; rI < rows; rI++) { if (R() < .3) continue; for (let cI = 0; cI < cols; cI++) {
        if (R() > lit) continue;
        const wx = x + 6 + cI * 16, wy = y + 12 + rI * 22; if (wx > x + w - 10) continue;
        const cc = R() < .75 ? '#ffcf80' : '#8fdcff'; g.fillStyle = rgba(cc, layer ? .85 : .55); g.fillRect(wx, wy, 7, 9);
        if (night) { e.fillStyle = rgba(cc, layer ? .35 : .2); e.fillRect(wx, wy, 7, 9); }
      } }
      x += w + R() * 30;
    }
    // 城市雾：底部的粉紫色喷枪光
    vgrad(g, 0, Hh * .45, LW, Hh * .55, [[0, rgba(night ? '#ff4fa8' : '#ffb080', 0)], [1, rgba(night ? '#ff4fa8' : '#ffc090', layer ? .28 : .18)]]);
  }
  return { c, e: ec, w: LW, h: Hh };
}

// 横向运动模糊（"流し"背景）：多次平移叠加
export function smear(plate, px, n = 10) {
  const out = {};
  for (const k of ['c', 'e']) {
    const [c, g] = canvas(plate.w, plate.h);
    g.globalAlpha = 1 / n;
    for (let i = 0; i < n; i++) { const dx = (i / (n - 1) - .5) * px; g.drawImage(plate[k], dx, 0); g.drawImage(plate[k], dx + (dx < 0 ? plate.w : -plate.w), 0); }
    out[k] = c;
  }
  return { ...out, w: plate.w, h: plate.h };
}

// 湿路面倒影：楼群翻转 + 纵向拖影 + 模糊 + 压暗
export function reflectPlate(plate, Hr, strength = .8) {
  const out = {};
  for (const k of ['c', 'e']) {
    const [c, g] = canvas(plate.w, Hr);
    if (k === 'e') { g.fillStyle = '#000'; g.fillRect(0, 0, plate.w, Hr); }
    g.save(); g.filter = 'blur(5px)';
    for (let i = 0; i < 6; i++) {   // 纵向拖影（水面的竖条倒影）
      g.globalAlpha = (k === 'c' ? .3 : .28) * (1 - i / 7);
      g.save(); g.translate(0, i * 26); g.scale(1, -1.15); g.drawImage(plate[k], 0, -plate.h, plate.w, plate.h); g.restore();
    }
    g.restore();
    // 横向水纹：交替压暗
    g.globalAlpha = 1; g.globalCompositeOperation = k === 'c' ? 'source-atop' : 'multiply';
    for (let y = 0; y < Hr; y += 6) { const a = .12 + .1 * Math.sin(y * .37) + .08 * Math.sin(y * 1.3); g.fillStyle = k === 'c' ? rgba('#0a0616', a) : `rgb(${255 * (1 - a)},${255 * (1 - a)},${255 * (1 - a)})`; g.fillRect(0, y, plate.w, 3); }
    g.globalCompositeOperation = k === 'c' ? 'source-atop' : 'multiply';
    const gr = g.createLinearGradient(0, 0, 0, Hr);
    if (k === 'c') { gr.addColorStop(0, rgba('#000000', 0)); gr.addColorStop(1, rgba('#05030c', .7)); }
    else { gr.addColorStop(0, `rgb(${255 * strength},${255 * strength},${255 * strength})`); gr.addColorStop(1, 'rgb(40,40,40)'); }
    g.fillStyle = gr; g.fillRect(0, 0, plate.w, Hr);
    out[k] = c;
  }
  return { ...out, w: plate.w, h: Hr };
}

// 循环平移绘制
export function drawLoop(g, img, w, x, y, dw, dh) {
  let ox = ((x % w) + w) % w; ox -= w;
  for (let xx = ox; xx < 1920; xx += w) g.drawImage(img, xx, y, dw ?? img.width, dh ?? img.height);
}

// —— 开场下摇用的纵向长画：远景（天空 + 月 + 云 + 远楼）——
export function tallFar(Hh = 3200) {
  const [c, g] = canvas(1920, Hh), [ec, e] = canvas(1920, Hh), R = rng(21);
  e.fillStyle = '#000'; e.fillRect(0, 0, 1920, Hh);
  vgrad(g, 0, 0, 1920, Hh, [[0, '#04031a'], [.25, '#120d38'], [.5, '#2c1552'], [.7, '#6a2468'], [1, '#2a1238']]);
  for (let i = 0; i < 260; i++) { const x = R() * 1920, y = R() * 1400, r = R() < .1 ? 1.8 : .9; g.fillStyle = rgba('#e8e0ff', .35 + R() * .5); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  // 细月 + 月晕
  airbrush(g, 1420, 420, 260, 260, '#b9a8ff', .18);
  const moon = new Path2D(); moon.arc(1420, 420, 70, 0, TAU); const cut = new Path2D(); cut.arc(1420, 420, 70, 0, TAU); cut.arc(1448, 404, 66, 0, TAU);
  for (const [ctx, col] of [[g, '#fff6e0'], [e, rgba('#fff0d0', .8)]]) { ctx.save(); ctx.clip(moon); ctx.fillStyle = col; ctx.fill(cut, 'evenodd'); ctx.restore(); }
  // 云：喷枪软边，下缘被城市灯光染成粉色
  g.save(); g.filter = 'blur(18px)';
  for (let i = 0; i < 26; i++) {
    const y = 700 + R() * 900, x = R() * 2200 - 140, w = 300 + R() * 500, h = 40 + R() * 70;
    g.fillStyle = rgba('#3a2a6a', .55); g.beginPath(); g.ellipse(x, y, w, h, 0, 0, TAU); g.fill();
    g.fillStyle = rgba('#c0508a', .25 + (y - 700) / 900 * .3); g.beginPath(); g.ellipse(x + 20, y + h * .5, w * .8, h * .45, 0, 0, TAU); g.fill();
  }
  g.restore();
  // 远楼
  for (let layer = 0; layer < 3; layer++) {
    const col = ['#1a1236', '#221842', '#2c1f50'][layer];
    for (let x = -60; x < 1980;) {
      const w = 110 + R() * 200, top = 1350 + layer * 260 + R() * 380;
      vgrad(g, x, top, w, Hh - top, [[0, mix(col, '#6a4aa0', .25)], [.2, col], [1, mix(col, '#000', .3)]]);
      g.fillStyle = rgba('#8a6ad0', .25); g.fillRect(x, top, 3, Hh - top);
      if (R() < .45) { g.fillStyle = col; g.fillRect(x + w * .5 - 3, top - 90, 6, 90); lampDot(g, e, x + w * .5, top - 90, '#ff3040'); }
      if (R() < .3) { g.fillStyle = col; g.beginPath(); g.moveTo(x, top); g.lineTo(x + w / 2, top - 70); g.lineTo(x + w, top); g.fill(); }
      const cols = Math.floor(w / 18), lit = .12 + layer * .08;
      for (let yy = top + 20; yy < Hh; yy += 24) { if (R() < .25) continue; for (let i = 0; i < cols; i++) { if (R() > lit) continue; const cc = R() < .7 ? '#ffcf80' : '#8fdcff'; g.fillStyle = rgba(cc, .7); g.fillRect(x + 6 + i * 18, yy, 8, 10); e.fillStyle = rgba(cc, .25); e.fillRect(x + 6 + i * 18, yy, 8, 10); } }
      x += w + R() * 20;
    }
    vgrad(g, 0, 1500 + layer * 300, 1920, 900, [[0, rgba('#ff4fa8', 0)], [1, rgba('#ff4fa8', .12)]]);
  }
  return { c, e: ec, w: 1920, h: Hh };
}
function lampDot(g, e, x, y, col) { g.fillStyle = mix(col, '#ffffff', .5); g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); e.fillStyle = col; e.beginPath(); e.arc(x, y, 7, 0, TAU); e.fill(); }

// —— 近景：两侧大楼（竖招牌）+ 底部街道（用 streetPlate 的一段）——
export function tallNear(street, Hh = 3600) {
  const [c, g] = canvas(1920, Hh), [ec, e] = canvas(1920, Hh), R = rng(33);
  e.fillStyle = '#000'; e.fillRect(0, 0, 1920, Hh);
  // 底部街面：楼群立面
  const base = Hh - 330;
  g.drawImage(street.c, 600, 0, 1920, street.h, 0, base - street.h, 1920, street.h);
  e.drawImage(street.e, 600, 0, 1920, street.h, 0, base - street.h, 1920, street.h);
  // 两侧近楼
  for (const side of [0, 1]) {
    const x0 = side ? 1920 - 330 : 0, w = 330, top = 600 + side * 300;
    vgrad(g, x0, top, w, base - top, [[0, '#1c1432'], [.6, '#2a1c44'], [1, '#3a2248']]);
    g.fillStyle = rgba('#000', .35); g.fillRect(side ? x0 : x0 + w - 16, top, 16, base - top);
    for (let yy = top + 40; yy < base - 300; yy += 80) for (let i = 0; i < 4; i++) {
      const lit = R() < .3, wx = x0 + 24 + i * 76; g.fillStyle = lit ? '#ffd28a' : '#140e26'; g.fillRect(wx, yy, 48, 46);
      if (lit) { e.fillStyle = rgba('#ffd28a', .3); e.fillRect(wx, yy, 48, 46); }
    }
    // 大竖招牌
    for (let k = 0; k < 2; k++) {
      const sx = side ? x0 - 20 : x0 + w + 20, sy = top + 500 + k * 900, txt = side ? (k ? 'カラオケ' : 'ホテル') : (k ? '喫茶' : 'ネオン'), col = side ? (k ? '#35e7ff' : '#ff3fa4') : (k ? '#ffd23f' : '#b36bff');
      g.fillStyle = '#130b20'; g.fillRect(sx - 60, sy, 120, txt.length * 118 + 60);
      neonText(g, e, txt, sx, sy + (txt.length * 118 + 60) / 2, 100, col, true);
      neonRect(g, e, sx - 52, sy + 8, 104, txt.length * 118 + 44, col, 8);
      airbrush(g, sx, sy + txt.length * 60, 240, txt.length * 110, col, .16);
    }
  }
  // 路面 + 倒影
  vgrad(g, 0, base, 1920, Hh - base, [[0, '#1a1030'], [1, '#0a0614']]);
  g.save(); g.globalAlpha = .35; g.filter = 'blur(6px)'; g.translate(0, base * 2); g.scale(1, -1); g.drawImage(c, 0, base - 700, 1920, 700, 0, base - 700, 1920, 700); g.restore();
  e.save(); e.globalAlpha = .4; e.filter = 'blur(6px)'; e.translate(0, base * 2); e.scale(1, -1); e.drawImage(ec, 0, base - 700, 1920, 700, 0, base - 700, 1920, 700); e.restore();
  g.fillStyle = '#4a3d66'; g.fillRect(0, base, 1920, 5);
  return { c, e: ec, w: 1920, h: Hh, base };
}
