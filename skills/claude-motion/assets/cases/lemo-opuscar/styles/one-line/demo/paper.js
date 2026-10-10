// 暖白纸：程序化纸纹（云斑 + 纤维 + 颗粒），锚定在纸面上随镜头移动缩放
import { mulberry } from '/core/lib.js';

function tile(size, seed, fn) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); fn(g, size, mulberry(seed)); return c;
}
function noiseLayer(g, S, rnd, cells, amp) {
  const s = document.createElement('canvas'); s.width = s.height = cells; const sg = s.getContext('2d');
  const im = sg.createImageData(cells, cells);
  for (let i = 0; i < cells * cells; i++) { const v = 128 + (rnd() - .5) * 2 * amp; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  sg.putImageData(im, 0, 0);
  // 平铺无缝：3×3 画再取中间
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) g.drawImage(s, x * S, y * S, S, S);
}

export function makePaper() {
  // 大尺度：云斑（中性灰 128 为不变）
  const mottle = tile(512, 11, (g, S, rnd) => {
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, S, S);
    g.globalAlpha = 1; noiseLayer(g, S, rnd, 8, 26);
    g.globalAlpha = .55; noiseLayer(g, S, rnd, 24, 22);
    g.globalAlpha = 1;
  });
  // 细尺度：纤维 + 颗粒
  const fiber = tile(1024, 23, (g, S, rnd) => {
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, S, S);
    g.globalAlpha = .6; noiseLayer(g, S, rnd, 160, 26); g.globalAlpha = 1;
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * S, y = rnd() * S, L = 6 + rnd() * 34, a = rnd() * Math.PI * 2, bend = (rnd() - .5) * .8;
      const light = rnd() < .6; g.strokeStyle = light ? `rgba(255,255,255,${.10 + rnd() * .16})` : `rgba(60,50,40,${.06 + rnd() * .08})`;
      g.lineWidth = .6 + rnd() * .9; g.beginPath();
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const bx = x + ox * S, by = y + oy * S; g.moveTo(bx, by);
        g.quadraticCurveTo(bx + Math.cos(a + bend) * L * .5, by + Math.sin(a + bend) * L * .5, bx + Math.cos(a) * L, by + Math.sin(a) * L);
      }
      g.stroke();
    }
    const im = g.getImageData(0, 0, S, S);
    for (let i = 0; i < S * S; i++) { const d = (rnd() - .5) * 14; im.data[i * 4] += d; im.data[i * 4 + 1] += d; im.data[i * 4 + 2] += d; }
    g.putImageData(im, 0, 0);
  });
  return { mottle, fiber };
}

// cam: {cx, cy, k, r}；世界 → 屏幕：R(-r)·(p - c)·k + 中心
export function drawPaper(ctx, paper, cam, W, H) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgb(244,239,228)'; ctx.fillRect(0, 0, W, H);
  const layer = (img, worldSize, alpha) => {
    if (alpha <= 0.01) return;
    const pat = ctx.createPattern(img, 'repeat');
    const s = worldSize / img.width * cam.k, c = Math.cos(-cam.r), sn = Math.sin(-cam.r);
    // 世界点 p 映射：screen = R·(p - c)·k + W/2；图案坐标 u = p / (worldSize/img.width)
    const m = new DOMMatrix([c * s, sn * s, -sn * s, c * s, 0, 0]);
    const o = [-cam.cx * cam.k, -cam.cy * cam.k];
    m.e = W / 2 + c * o[0] - sn * o[1]; m.f = H / 2 + sn * o[0] + c * o[1];
    pat.setTransform(m);
    ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = alpha; ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
  };
  layer(paper.mottle, 1400, .55);
  // 纤维层随缩放淡出（拉远时太细会闪）
  const fz = Math.min(1, Math.max(0, (cam.k - 0.7) / 1.6));
  layer(paper.fiber, 260, .85 * fz);
  layer(paper.fiber, 1100, .6 * (1 - fz) + .25);
  ctx.restore();
}

export function vignette(ctx, W, H, amt = .13) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(90,70,50,0)'); g.addColorStop(1, `rgba(90,70,50,${amt})`);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}

// 纸齿：稀疏的亮点和短纤维，用 screen 叠在墨上——墨线里透出一点纸的颗粒
export function makeTooth() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const rnd = mulberry(77); g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5200; i++) { const x = rnd() * 512, y = rnd() * 512, r = .4 + rnd() * 1.1; g.fillStyle = `rgba(255,250,240,${.10 + rnd() * .35})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  for (let i = 0; i < 500; i++) { const x = rnd() * 512, y = rnd() * 512, a = rnd() * 7, L = 3 + rnd() * 9; g.strokeStyle = `rgba(255,250,240,${.12 + rnd() * .25})`; g.lineWidth = .6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  return c;
}
export function drawTooth(ctx, tooth, cam, W, H, alpha = .32) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pat = ctx.createPattern(tooth, 'repeat');
  const worldSize = 90, s = worldSize / tooth.width * cam.k, c = Math.cos(-cam.r), sn = Math.sin(-cam.r);
  const m = new DOMMatrix([c * s, sn * s, -sn * s, c * s, 0, 0]); const o = [-cam.cx * cam.k, -cam.cy * cam.k];
  m.e = W / 2 + c * o[0] - sn * o[1]; m.f = H / 2 + sn * o[0] + c * o[1]; pat.setTransform(m);
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = alpha * Math.min(1, Math.max(0, (cam.k - 1.2) / 1.5)); ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
