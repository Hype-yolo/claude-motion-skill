// 姿势库约定（所有 poses/*.js 共用）
//
// POSES[name] = {
//   pose(u) → 姿势对象         u = 本卡开始后的拍数（150 BPM，1 拍 0.4s；卡长 4 拍，快切卡 2 拍）
//            或 keys: [...] + loop: 拍数   （见 G.keyPose）
//   back(ctx, J, u, C)   可选，画在人形后面的道具/环境（单位 = 身高，原点 = 髋部）
//   front(ctx, J, u, C)  可选，画在人形前面的道具
//   fig: 可选 { s: 缩放, x, y }  人形在舞台里的偏移（身高单位）
//   second: 可选 (u) → 姿势     第二个人（对手 / 队友），画在主人形后面，用 C.far2 颜色
//   secondX: 第二人偏移 [x, y]，secondFace: -1 表示面向左
// }
// C = { fg 近侧色, far 远侧色, far2 第二人色, acc 点缀色, bg 背景色, line 细线色 }
// 设计语言：官方核心图形的几何感——道具用圆、半圆、胶囊线段、直线；不画写实细节。
// 动作要卡在拍点上：u = 0,1,2,3 是重拍，关键动作（出手、击球、落地）落在整数拍。
window.POSES = window.POSES || {};

(function () {
  const G = window.G;
  // 常用道具
  G.P = {
    ball: (ctx, x, y, r, C, o = {}) => {
      G.disc(ctx, x, y, r, o.col || C.acc);
      if (o.seam !== false) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip(); G.disc(ctx, x + r * 0.9, y - r * 0.9, r * 0.95, o.col2 || C.bg); ctx.restore(); }
    },
    racket: (ctx, hand, ang, len, headR, C, o = {}) => {
      // ang：度，0 = 向下，90 = 向前
      const d = [Math.sin(ang * G.D2R), Math.cos(ang * G.D2R)];
      const tip = [hand[0] + d[0] * len, hand[1] + d[1] * len];
      G.seg(ctx, hand, tip, 0.022, o.col || C.fg);
      const hc = [tip[0] + d[0] * headR, tip[1] + d[1] * headR];
      ctx.save(); ctx.translate(hc[0], hc[1]); ctx.rotate(-ang * G.D2R);
      ctx.strokeStyle = o.col || C.fg; ctx.lineWidth = 0.02;
      ctx.beginPath(); ctx.ellipse(0, 0, headR * 0.78, headR, 0, 0, Math.PI * 2); ctx.stroke();
      if (o.solid) { ctx.fillStyle = o.col || C.fg; ctx.fill(); }
      ctx.restore();
      return hc;
    },
    stick: (ctx, a, b, w, C, col) => G.seg(ctx, a, b, w, col || C.fg),
    ground: (ctx, y, C, x0 = -1.2, x1 = 1.2) => { ctx.fillStyle = C.line; ctx.fillRect(x0, y, x1 - x0, 0.012); },
    // 速度线：从 (x,y) 往后拉 n 条
    speed: (ctx, x, y, len, n, C, a = 1) => {
      ctx.save(); ctx.globalAlpha *= a;
      for (let i = 0; i < n; i++) { ctx.fillStyle = C.line; ctx.fillRect(x - len * (0.6 + 0.4 * ((i * 37) % 10) / 10), y + (i - (n - 1) / 2) * 0.07, len * (0.5 + 0.5 * ((i * 53) % 10) / 10), 0.012); }
      ctx.restore();
    },
    // 物体飞行弧线（0→1）
    arc: (a, b, h, t) => [G.lerp(a[0], b[0], t), G.lerp(a[1], b[1], t) - h * 4 * t * (1 - t)],
  };
})();
