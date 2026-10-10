// 纸上方真实的笔和手：只画投影（柔和、低透明度），不画笔、不画手。
// 画里没有阴影——投影属于纸上方的真实世界。
import { clamp, lerp, ss, vnoise } from '/core/lib.js';

const SH = 'rgba(64,52,40,1)';

// 笔杆投影：从笔尖朝 dir 方向的楔形，长度随缩放（笔本身的尺寸是固定的纸面尺寸）
export function penShadow(ctx, tip, dir, k, opts = {}) {
  const [x, y] = tip, [dx, dy] = dir, L = 560 * k, lift = opts.lift || 0;
  const nx = -dy, ny = dx, w0 = 1.2 * k + 1.5, w1 = 18 * k;
  const off = (6 + lift * 70) * Math.max(1, k * .4);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = `blur(${(3 + 2.2 * k).toFixed(1)}px)`;
  ctx.globalAlpha = (opts.alpha ?? 1) * 0.15;
  ctx.fillStyle = SH; ctx.beginPath();
  ctx.moveTo(x + dx * off + nx * w0, y + dy * off + ny * w0);
  ctx.lineTo(x + dx * L + nx * w1, y + dy * L + ny * w1);
  ctx.lineTo(x + dx * L - nx * w1, y + dy * L - ny * w1);
  ctx.lineTo(x + dx * off - nx * w0, y + dy * off - ny * w0); ctx.closePath(); ctx.fill();
  ctx.filter = 'none'; ctx.globalAlpha = 1;
  if (!lift) { ctx.fillStyle = 'rgba(20,18,16,0.9)'; ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, 1.05 * k), 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// 手的投影：掌心椭圆 + 四根手指 + 拇指，朝笔尖弯着。size = 手长（像素），ang = 手指指向（弧度），chub = 胖度（孩子）
let off = null;
export function handShadow(ctx, cx, cy, size, ang, alpha, chub = 0, t = 0) {
  if (alpha <= 0.005) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  if (!off) { off = document.createElement('canvas'); off.width = W; off.height = H; }
  const g = off.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  g.fillStyle = '#000'; g.translate(cx, cy); g.rotate(ang);
  const s = size, fw = s * (0.085 + chub * .03), fl = s * (0.36 - chub * .1);
  // 掌心（手指朝 +x）、手腕 / 前臂
  g.beginPath(); g.ellipse(-s * .12, 0, s * .3, s * (.2 + chub * .03), 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(-s * .55, s * .02, s * .34, s * (.13 + chub * .03), 0, 0, Math.PI * 2); g.fill();
  // 四根手指：略弯向笔
  for (let i = 0; i < 4; i++) {
    const oy = (i - 1.5) * fw * 1.08, len = fl * (1 - Math.abs(i - 1.2) * .12), bend = .18 + i * .05;
    g.save(); g.translate(s * .12, oy); g.rotate(bend * (oy > 0 ? 1 : .6));
    g.beginPath(); g.roundRect(0, -fw / 2, len, fw, fw / 2); g.fill(); g.restore();
  }
  // 拇指
  g.save(); g.translate(-s * .02, -s * .17); g.rotate(-.55);
  g.beginPath(); g.roundRect(0, -fw * .55, fl * .8, fw * 1.1, fw * .55); g.fill(); g.restore();
  // 染成投影色，整体模糊后一次性叠上（重叠处不会更深）
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = SH; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = `blur(${(size * .008 + 2.5).toFixed(1)}px)`; ctx.globalAlpha = alpha; ctx.drawImage(off, 0, 0);
  ctx.restore();
}
