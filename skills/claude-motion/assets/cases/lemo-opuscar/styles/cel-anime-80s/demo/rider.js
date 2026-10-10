// 少女"夜鸟"与摩托：侧面骑行赛璐璐（原点 = 两轮中间的地面，y 向上为负）
import { cel, path, poly, ribbon, flutter, line, TAU, rgba } from './cel.js';
import { head80 } from './head80.js';

const RW = [-310, -118], FW = [322, -118], WR = 118;

// 车轮：轮胎 + 金色三辐轮毂（3 张画循环 = 高速频闪感）+ 刹车盘 + 速度弧线
export function wheel(g, c, P, o, front) {
  const [x, y] = c;
  g.save(); g.translate(x, y);
  const tire = new Path2D(); tire.arc(0, 0, WR, 0, TAU);
  cel(g, tire, { f: P.tire.f, s: P.tire.s, so: [-10, -12], h: P.tire.h, ho: [5, 6], l: P.tire.l, lw: 2.4 });
  // 轮胎侧面的字样带（深色细环）
  g.strokeStyle = rgba('#000000', .25); g.lineWidth = 3; g.beginPath(); g.arc(0, 0, WR * .86, 0, TAU); g.stroke();
  const rim = new Path2D(); rim.arc(0, 0, WR * .76, 0, TAU);
  cel(g, rim, { f: P.dark.s, l: P.gold.l, lw: 2 });
  const blur = o.speed ?? 1;
  const a0 = o.wheelA + (front ? .4 : 0);
  // 高速：轮毂变成一圈金色模糊盘 + 若隐若现的三辐
  if (blur > .3) {
    g.fillStyle = rgba(P.gold.f, .28 * blur); g.beginPath(); g.arc(0, 0, WR * .74, 0, TAU); g.arc(0, 0, WR * .2, 0, TAU, true); g.fill();
  }
  g.globalAlpha = 1 - .55 * Math.min(1, blur);
  for (let k = 0; k < 3; k++) {
    const a = a0 + k * TAU / 3, ca = Math.cos(a), sa = Math.sin(a), pa = Math.cos(a + 1.57), pb = Math.sin(a + 1.57);
    const sp = poly([[ca * 18 + pa * 13, sa * 18 + pb * 13], [ca * 84 + pa * 7, sa * 84 + pb * 7], [ca * 84 - pa * 7, sa * 84 - pb * 7], [ca * 18 - pa * 13, sa * 18 - pb * 13]]);
    cel(g, sp, { f: P.gold.f, s: P.gold.s, so: [-4, -5], l: P.gold.l, lw: 1.6 });
  }
  g.globalAlpha = 1;
  if (front) {   // 刹车盘（带孔）
    const d = new Path2D(); d.arc(0, 0, WR * .56, 0, TAU); d.arc(0, 0, WR * .3, 0, TAU, true);
    cel(g, d, { f: rgba(P.chrome.f, .9), l: P.chrome.l, lw: 1.4 });
    g.fillStyle = P.chrome.s; for (let k = 0; k < 12; k++) { const a = a0 * .5 + k * TAU / 12; g.beginPath(); g.arc(Math.cos(a) * WR * .43, Math.sin(a) * WR * .43, 3, 0, TAU); g.fill(); }
    // 卡钳
    cel(g, [[-20, -70], [8, -76], [14, -52], [-14, -44]], { f: P.magenta.f, s: P.magenta.s, so: [-3, -3], l: P.magenta.l, lw: 1.6 });
  }
  const hub = new Path2D(); hub.arc(0, 0, 17, 0, TAU);
  cel(g, hub, { f: P.chrome.f, s: P.chrome.s, so: [-4, -4], l: P.chrome.l, lw: 1.6 });
  // 速度弧线（白色细弧，贴着胎面）
  if (blur > .2) {
    g.strokeStyle = rgba('#ffffff', .55 * blur); g.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const a = -o.wheelA * 1.7 + k * 1.57, r = WR * (.8 + .06 * (k % 2)); g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, r, a, a + .7); g.stroke(); }
  }
  g.restore();
}

// —— 摩托车身 ——
export function bike(g, P, o) {
  const sq = o.squash || 0;   // 悬挂压缩（落地）
  const rim = o.rim;
  // 后轮 + 摇臂
  wheel(g, RW, P, o, false);
  cel(g, poly([[-70, -196], [-40, -170], [-300, -110], [-318, -132]]), { f: P.dark.f, s: P.dark.s, so: [-3, -5], h: P.dark.h, ho: [2, 4], l: P.dark.l, lw: 2 });
  // 前轮 + 挡泥板 + 前叉
  wheel(g, FW, P, o, true);
  g.save(); g.translate(0, sq * 28);
  cel(g, [[228, -210], [290, -250], [380, -238], [418, -190], [396, -198], [360, -222], [292, -226], [246, -200]], { f: P.white.f, s: P.white.s, so: [-4, -6], l: P.white.l, lw: 2 });
  // 前叉：上段镀铬，下段金色
  const fork = (x0, y0, x1, y1, w) => poly([[x0 - w, y0], [x0 + w, y0], [x1 + w, y1], [x1 - w, y1]]);
  cel(g, fork(262, -372, 300, -236 + sq * 10, 10), { f: P.chrome.f, s: P.chrome.s, so: [-6, 0], h: P.chrome.h, ho: [3, 0], l: P.chrome.l, lw: 2 });
  cel(g, fork(300, -250 + sq * 10, 322, -118 - sq * 28, 13), { f: P.gold.f, s: P.gold.s, so: [-7, 0], h: P.gold.h, ho: [3, 0], l: P.gold.l, lw: 2 });
  g.restore();
  g.save(); g.translate(0, sq * 34);
  // 排气管（镀铬，上翘）
  // 后侧盖 + 车架（填满坐垫下方）
  cel(g, poly([[-40, -310], [-250, -334], [-230, -300], [-90, -196], [-40, -200]]), { f: P.dark.f, s: P.dark.s, so: [0, -10], l: P.dark.l, lw: 2 });
  const ex = [[-30, -132, 1], [-120, -148], [-150, -160, 1], [-300, -212, 1], [-306, -176, 1], [-160, -128, 1], [-120, -120], [-30, -112, 1]];
  cel(g, ex, { f: P.chrome.f, s: P.chrome.s, so: [0, -10], h: P.chrome.h, ho: [0, 5], l: P.chrome.l, lw: 2 });
  const cap = new Path2D(); cap.ellipse(-303, -194, 8, 18, .32, 0, TAU);
  cel(g, cap, { f: P.dark.s, l: P.chrome.l, lw: 1.8 });
  line(g, [[-170, -156], [-176, -128]], P.chrome.l, 1.6);
  // 脚踏
  cel(g, poly([[-70, -236], [-20, -236], [-20, -226], [-70, -226]]), { f: P.chrome.s, l: P.chrome.l, lw: 1.4 });
  // 尾段
  const tail = [[-30, -352], [-200, -356], [-330, -396, 1], [-360, -376, 1], [-352, -352], [-300, -330], [-180, -306], [-60, -300]];
  cel(g, tail, { f: P.white.f, s: P.white.s, so: [-6, -12], h: P.white.h, ho: [3, 5], l: P.white.l, lw: 2.2, rim });
  cel(g, poly([[-212, -350], [-336, -390], [-346, -380], [-240, -340]]), { f: P.teal.f, l: P.teal.l, lw: 1.2 });
  // 尾灯
  cel(g, poly([[-352, -376], [-362, -374], [-356, -352], [-346, -356]]), { f: '#ff4050', l: '#5a0a14', lw: 1.4 });
  // 坐垫
  cel(g, [[-36, -350], [-60, -374], [-190, -372], [-222, -356]], { f: P.seat.f, s: P.seat.s, so: [0, -5], l: P.seat.l, lw: 2 });
  // 发动机（整流罩下面露出一点）
  cel(g, poly([[-80, -120], [150, -120], [150, -205], [-60, -215]]), { f: P.dark.f, s: P.dark.s, so: [0, -12], l: P.dark.l, lw: 2 });
  for (let k = 0; k < 5; k++) line(g, [[-40 + k * 30, -200], [-40 + k * 30, -130]], P.dark.h, 2);
  // 侧整流罩
  const fair = [[392, -336, 1], [398, -286], [360, -258], [236, -262], [192, -232], [170, -154], [126, -112, 1], [-50, -112, 1], [-92, -156], [-70, -236], [-10, -300], [90, -318], [200, -338], [300, -366]];
  const FP = cel(g, fair, { f: P.white.f, s: P.white.s, so: [-10, -16], h: P.white.h, ho: [4, 6], l: P.white.l, lw: 2.4, rim,
    clipFn: gg => {   // 涂装：青绿色斜条 + 洋红细线 + 夜鸟徽记
      gg.fillStyle = P.teal.f; gg.fill(poly([[420, -312], [420, -272], [-120, -150], [-120, -190]]));
      gg.fillStyle = P.teal.s; gg.fill(poly([[420, -282], [420, -272], [-120, -150], [-120, -160]]));
      gg.fillStyle = P.magenta.f; gg.fill(poly([[420, -324], [420, -317], [-120, -196], [-120, -203]]));
      gg.fillStyle = P.dark.f; gg.save(); gg.translate(40, -175); gg.fill(poly([[-34, -8], [0, 8], [34, -8], [22, 6], [0, 20], [-22, 6]])); gg.restore();
    } });
  // 分缝线
  line(g, [[170, -300], [150, -170], [120, -118]], P.white.l, 1.4);
  // 油箱
  const tank = [[-42, -348], [-26, -384], [60, -404], [168, -396], [210, -370], [196, -334], [90, -318], [-30, -316]];
  cel(g, tank, { f: P.white.f, s: P.white.s, so: [-8, -14], h: P.white.h, ho: [4, 6], l: P.white.l, lw: 2.2, rim,
    clipFn: gg => { gg.fillStyle = P.teal.f; gg.fill(poly([[-60, -372], [230, -390], [230, -376], [-60, -358]])); } });
  // 高光条（硬边白条，赛璐璐金属漆的"光の線"）
  g.fillStyle = P.white.h; g.fill(poly([[10, -392], [120, -400], [118, -394], [12, -386]]));
  g.restore();
  // 风挡 + 车头（跟着前叉一起略沉）
  g.save(); g.translate(0, sq * 30);
  const scr = [[330, -356], [300, -392], [236, -450, 1], [214, -444, 1], [228, -400], [250, -370]];
  g.fillStyle = rgba(o.screenTint || '#7fd8ff', .45); g.fill(path(scr));
  g.fillStyle = rgba('#ffffff', .5); g.fill(poly([[300, -386], [244, -440], [236, -436], [288, -380]]));
  line(g, scr, P.teal.l, 2, true);
  // 车头灯（侧面看到的灯罩边缘）
  cel(g, [[378, -330], [396, -318], [400, -292], [384, -290]], { f: '#fff7d6', l: P.white.l, lw: 1.6 });
  // 手把
  cel(g, poly([[226, -414], [262, -404], [258, -392], [224, -402]]), { f: P.dark.f, l: P.dark.l, lw: 1.6 });
  g.restore();
}

// 肢体：两端圆头的锥形胶囊
export function limb(a, b, w1, w2) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d, px = -uy, py = ux;
  const r1 = w1 / 2, r2 = w2 / 2, pts = [];
  const cap = (c, r, s) => { const out = []; for (let k = 0; k <= 4; k++) { const an = -Math.PI / 2 + k * Math.PI / 4; const ca = Math.cos(an), sa = Math.sin(an); out.push([c[0] + (ux * ca * s + px * sa * s) * r, c[1] + (uy * ca * s + py * sa * s) * r]); } return out; };
  return cap(b, r2, 1).concat(cap(a, r1, -1));
}

// —— 整个骑手（侧面）——
export function riderSide(g, P, o) {
  const ph = o.ph || 0, rim = o.rim, bob = o.bob || 0;
  g.save(); g.translate(0, bob * .4);
  bike(g, P, o);
  g.restore();
  g.save(); g.translate(0, bob);
  // 围巾尾巴（在身体后面）
  for (let k = 0; k < 2; k++) {
    const wd = o.wind ?? 1, sp = flutter(50, -516 + k * 8, (Math.PI - .02 + k * .08) * wd + (Math.PI / 2 + .35 - k * .15) * (1 - wd), (320 - k * 70) * (.55 + .45 * wd), 16, (20 + k * 6) * wd + 3, 1.35, ph * TAU + k * 2.1, -(26 + k * 22) * wd);
    cel(g, ribbon(sp, u => 34 - u * 12 - k * 6), { f: k ? P.scarf.s : P.scarf.f, s: P.scarf.s, so: [0, -9], h: P.scarf.h, ho: [0, 4], l: P.scarf.l, lw: 2, rim });
  }
  // 腿（近侧）
  cel(g, [[-130, -402], [0, -392], [86, -380], [98, -350], [74, -322], [-10, -330], [-120, -350]], { f: P.pants.f, s: P.pants.s, so: [0, -14], h: P.pants.h, ho: [0, 4], l: P.pants.l, lw: 2.2, rim });
  cel(g, [[60, -370], [96, -350], [30, -262], [-6, -270]], { f: P.pants.f, s: P.pants.s, so: [-10, 0], l: P.pants.l, lw: 2.2 });
  const boot = [[22, -290], [-4, -268], [-14, -240], [-60, -238], [-62, -222, 1], [30, -220, 1], [36, -236], [40, -280]];
  cel(g, boot, { f: P.boot.f, s: P.boot.s, so: [-6, -6], h: P.boot.h, ho: [3, 3], l: P.boot.l, lw: 2 });
  line(g, [[-62, -226], [30, -224]], P.boot.l, 3);
  // 身体（夹克，前倾趴姿）
  const torso = [[-162, -364], [-140, -410], [-92, -454], [-24, -498], [28, -530], [74, -526], [90, -496], [62, -452], [12, -420], [-40, -390], [-50, -362]];
  cel(g, torso, { f: P.jacket.f, s: P.jacket.s, so: [-6, -26], h: P.jacket.h, ho: [4, 7], l: P.jacket.l, lw: 2.4, rim,
    clipFn: gg => { gg.fillStyle = P.stripe.f; gg.fill(poly([[-170, -380], [70, -540], [78, -528], [-160, -366]])); } });
  // 夹克下摆的褶
  line(g, [[-90, -430], [-60, -410]], P.jacket.l, 1.6); line(g, [[-40, -470], [-10, -452]], P.jacket.l, 1.6);
  // 围巾绕颈（领口的一圈）
  cel(g, [[24, -540], [80, -536], [94, -504], [54, -498], [20, -514]], { f: P.scarf.f, s: P.scarf.s, so: [0, -8], h: P.scarf.h, l: P.scarf.l, lw: 2 });
  // 头
  g.save(); g.translate(98, -604); g.rotate(.1); g.scale(.76, .76); head80(g, P, { view: 'side', expr: o.expr || 'determined', ph, wind: o.wind ?? 1, rim, body: false, neckEnd: 112, open: o.open }); g.restore();
  // 手臂（近侧）：上臂 + 前臂 + 袖口 + 手套
  cel(g, limb([40, -518], [138, -452], 60, 44), { f: P.jacket.f, s: P.jacket.s, so: [-8, -8], h: P.jacket.h, ho: [3, 3], l: P.jacket.l, lw: 2.2, rim });
  cel(g, limb([136, -454], [218, -422], 42, 34), { f: P.jacket.f, s: P.jacket.s, so: [4, -8], l: P.jacket.l, lw: 2.2 });
  line(g, [[40, -536], [140, -470], [214, -434]], P.stripe.f, 4);
  cel(g, poly([[200, -416], [226, -438], [238, -424], [214, -402]]), { f: P.cuff.f, l: P.cuff.l, lw: 1.6 });
  cel(g, [[214, -430], [240, -440], [262, -420], [250, -398], [220, -400]], { f: P.glove.f, s: P.glove.s, so: [-3, -6], h: P.glove.h, ho: [2, 3], l: P.glove.l, lw: 2 });
  g.restore();
}

// 尾灯 / 车头灯位置（给发光层用，局部坐标）
export const LAMPS = { tail: [-356, -366], head: [396, -310] };
