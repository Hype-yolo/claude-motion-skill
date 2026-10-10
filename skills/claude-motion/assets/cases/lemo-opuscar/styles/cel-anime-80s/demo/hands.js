// 戴手套的手（捏握：手指在物体后，拇指压在物体正面）。局部坐标：拇指尖 = (0,0)，手从左边伸进来（dir=-1 时镜像）
import { cel, poly, line, TAU } from './cel.js';
import { limb } from './rider.js';

// C = { glove:{f,s,h,l}, cuff:{f,s,l}, sleeve:{f,s,h,l}, stripe?, pad? }
export function hand(g, C, part, o = {}) {
  const dir = o.dir || 1, squeeze = o.squeeze || 0;
  g.save(); g.scale(dir, 1);
  const G = { f: C.glove.f, s: C.glove.s, h: C.glove.h, l: C.glove.l, lw: 3 };
  if (part === 'back') {
    // 袖子 + 袖口
    cel(g, poly([[-1200, -150], [-420, -118], [-420, 128], [-1200, 170]]), { f: C.sleeve.f, s: C.sleeve.s, so: [0, -46], h: C.sleeve.h, ho: [0, 10], l: C.sleeve.l, lw: 3,
      clipFn: C.stripe ? gg => { gg.fillStyle = C.stripe; gg.fillRect(-1200, -30, 780, 24); } : null });
    cel(g, poly([[-440, -120], [-330, -104], [-330, 112], [-440, 124]]), { f: C.cuff.f, s: C.cuff.s, so: [0, -24], l: C.cuff.l, lw: 3 });
    line(g, [[-400, -116], [-398, 120]], C.cuff.l, 2);
    // 四根手指（在物体后面，稍微弯曲扇开）
    for (let i = 0; i < 4; i++) {
      const y = -52 + i * 38 + squeeze * i * -3, x0 = -130, len = 150 - Math.abs(i - 1.2) * 16;
      cel(g, limb([x0, y], [x0 + len * .55, y + 6], 44, 40), { ...G, so: [0, -10], ho: [0, 4] });
      cel(g, limb([x0 + len * .55, y + 6], [x0 + len, y + 14 + i * 2], 40, 34), { ...G, so: [0, -10] });
    }
    // 手背（腕 → 指节），带指节护垫与缝线
    cel(g, [[-340, -96], [-230, -110], [-130, -90], [-104, -60], [-100, -22], [-98, 16], [-102, 54], [-120, 86], [-230, 100], [-340, 100]], { ...G, so: [0, -26], ho: [0, 8] });
    if (C.pad) { const p = new Path2D(); p.roundRect(-150, -80, 46, 150, 18); cel(g, p, { f: C.pad, l: C.glove.l, lw: 2.5 }); }
    for (const y of [-50, 0, 46]) line(g, [[-320, y * .8], [-170, y]], C.glove.l, 1.8);
  } else {
    // 拇指（在物体正面）：两节
    cel(g, limb([-220, -52], [-96, -86], 64, 54), { ...G, so: [-6, -12], ho: [3, 5] });
    cel(g, limb([-100, -86], [-4, -30], 52, 44), { ...G, so: [-6, -10], ho: [3, 5] });
    line(g, [[-40, -64], [-18, -46]], C.glove.l, 2);
  }
  g.restore();
}
export const HER = P => ({ glove: P.glove, cuff: P.cuff, sleeve: P.jacket, stripe: P.stripe.f, pad: P.dark.s });
export const HIS = { glove: { f: '#f4f2ec', s: '#c8c0b0', h: '#ffffff', l: '#4a4238' }, cuff: { f: '#d0d0da', s: '#9a9aa8', l: '#3a3a48' }, sleeve: { f: '#ff8a3c', s: '#c85a2a', h: '#ffc08a', l: '#5a2410' } };
