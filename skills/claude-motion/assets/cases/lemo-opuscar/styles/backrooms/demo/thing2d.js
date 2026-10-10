// "东西"的剪影：Canvas2D 画的有机轮廓（片中做成走廊尽头的公告板，永远近乎正对镜头）
// 同一个函数也用于剪影设计页。单位：米；原点 = 两脚中间的地面
// o = { wave: 0..1 抬手程度, ph: 挥手相位(rad), tilt: 头歪(rad) }
const lerp = (a, b, t) => a + (b - a) * t;
const P = (x, y) => ({ x, y });
const mixP = (a, b, t) => P(lerp(a.x, b.x, t), lerp(a.y, b.y, t));

// 沿折线画一条粗细渐变的"肢体"（圆头圆角的短段叠起来，关节处自然圆滑）
function limb(x, pts, widths, S) {
  x.lineCap = 'round'; x.lineJoin = 'round';
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], n = 10;
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, p0 = mixP(a, b, t0), p1 = mixP(a, b, t1);
      x.lineWidth = lerp(widths[i], widths[i + 1], (t0 + t1) / 2) * S;
      x.beginPath(); x.moveTo(p0.x * S, -p0.y * S); x.lineTo(p1.x * S, -p1.y * S); x.stroke();
    }
  }
}
// 手：掌 + 细长手指（张开挥手 / 垂下微蜷）
function hand(x, wr, dir, open, S) {
  const ang = Math.atan2(dir.y, dir.x), c = Math.cos(ang), s = Math.sin(ang);
  const R = (u, v) => P(wr.x + u * c - v * s, wr.y + u * s + v * c);   // u 沿手的方向，v 垂直
  limb(x, [wr, R(.1, 0)], [.05, .06], S);                                 // 手掌
  const fingers = open ? [[-.045, .2, -.32], [-.016, .23, -.1], [.014, .235, .08], [.04, .2, .28]] : [[-.02, .19, -.05], [-.005, .21, 0], [.01, .2, .04], [.022, .17, .08]];
  for (const [v, len, spread] of fingers) {
    const base = R(.09, v * 1.1), mid = R(.09 + len * .55, v * 1.1 + Math.sin(spread) * len * .5), tip = R(.09 + len * (open ? .98 : .9), v * 1.1 + Math.sin(spread) * len * (open ? 1 : .6) + (open ? 0 : .015));
    limb(x, [base, mid, tip], [.02, .016, .011], S);
  }
  const th = open ? [R(.03, .03), R(.1, .09), R(.16, .12)] : [R(.03, .025), R(.09, .04), R(.13, .03)];
  limb(x, th, [.024, .018, .012], S);
}
export function drawThing(x, S, o = {}) {
  const w = o.wave ?? 0, ph = o.ph ?? 0, tilt = o.tilt ?? .28;
  x.save(); x.fillStyle = x.strokeStyle = o.color || '#0b0a09';
  // 腿（西裤，裤腿略宽，脚踝处收）
  for (const sd of [-1, 1]) {
    limb(x, [P(sd * .085, 1.27), P(sd * .1, .72), P(sd * .1, .1), P(sd * .105, .04)], [.17, .12, .095, .09], S);
    // 鞋（正面看是扁的）
    x.beginPath(); x.ellipse(sd * .11 * S, -.035 * S, .062 * S, .04 * S, 0, 0, 7); x.fill();
  }
  // 躯干：衬衫下摆塞进裤腰，胸腔窄长，肩窄而高、斜
  x.beginPath();
  const T = (px, py) => [px * S, -py * S];
  x.moveTo(...T(-.16, 1.2));
  x.bezierCurveTo(...T(-.165, 1.42), ...T(-.2, 1.62), ...T(-.2, 1.84));
  x.bezierCurveTo(...T(-.205, 1.93), ...T(-.2, 1.99), ...T(-.16, 2.02));     // 左肩（斜）
  x.bezierCurveTo(...T(-.1, 2.05), ...T(-.06, 2.06), ...T(-.035, 2.08));     // 领口
  x.lineTo(...T(.035, 2.085));
  x.bezierCurveTo(...T(.06, 2.06), ...T(.1, 2.05), ...T(.16, 2.02));
  x.bezierCurveTo(...T(.2, 1.99), ...T(.205, 1.93), ...T(.2, 1.84));
  x.bezierCurveTo(...T(.2, 1.62), ...T(.165, 1.42), ...T(.16, 1.2));
  x.closePath(); x.fill();
  // 领尖：两个小尖角（让它"像穿着衬衫的同事"）
  for (const sd of [-1, 1]) { x.beginPath(); x.moveTo(...T(sd * .02, 2.07)); x.lineTo(...T(sd * .075, 2.035)); x.lineTo(...T(sd * .05, 2.1)); x.closePath(); x.fill(); }
  // 脖子（太长，往一侧歪）
  const nb = P(0, 2.03), nt = P(Math.sin(tilt) * .1, 2.26);
  limb(x, [nb, mixP(nb, nt, .5), nt], [.085, .07, .066], S);
  // 头（偏小的椭圆，跟着歪）
  x.save(); x.translate((nt.x + Math.sin(tilt) * .06) * S, -(nt.y + .085) * S); x.rotate(tilt * .9);
  x.beginPath(); x.ellipse(0, 0, .072 * S, .098 * S, 0, 0, 7); x.fill();
  x.beginPath(); x.ellipse(0, .05 * S, .05 * S, .06 * S, 0, 0, 7); x.fill();   // 下巴
  x.restore();
  // 左臂：垂到膝盖
  const shL = P(-.17, 1.97), elL = P(-.235, 1.43), wrL = P(-.255, .92);
  limb(x, [shL, elL, wrL], [.1, .07, .052], S);
  hand(x, wrL, P(-.01, -1), false, S);
  // 右臂：从垂下 → 抬起挥手（前臂绕肘慢慢左右摆）
  const shR = P(.17, 1.97);
  const elD = P(.235, 1.43), wrD = P(.255, .92);
  const elU = P(.52, 1.74), sw = Math.sin(ph) * .11;
  const wrU = P(elU.x + Math.sin(sw + .12) * .5, elU.y + Math.cos(sw + .12) * .5);
  const elR = mixP(elD, elU, w), wrR = mixP(wrD, wrU, w);
  limb(x, [shR, elR, wrR], [.1, .07, .052], S);
  const dirD = P(.01, -1), dirU = P(Math.sin(sw * 1.3 + .1), Math.cos(sw * 1.3 + .1));
  hand(x, wrR, P(lerp(dirD.x, dirU.x, w), lerp(dirD.y, dirU.y, w)), w > .5, S);
  x.restore();
}
