// 角色设定表：?sheet=1
import { figure, drawPrims, hat, handwrite, R3 } from './engine.js';
import { LOOK, sit, run, walk, stand, cycle, dive, prone, wave } from './poses.js';
const ctx = document.getElementById('c').getContext('2d');
await document.fonts.load('40px Caveat');
window.DUR = 1;
window.render = () => {
  ctx.fillStyle = '#f5eede'; ctx.fillRect(0, 0, 1920, 1080);
  const S = 420, y1 = 500, y2 = 1020;
  const F = (lk, pose, x, y, yaw, s = S) => drawPrims(ctx, figure(LOOK[lk], pose, { x, y, S: s, yaw }, { seed: x | 0 }));
  if (new URLSearchParams(location.search).get('close')) {
    const Sc = 900, yb = 1040;
    const him = figure(LOOK.him, sit({ side: .06, headYaw: -.25, lean: -.05 }), { x: 700, y: yb, S: Sc, yaw: .15 }, { seed: 3 });
    const her = figure(LOOK.her, sit({ side: -.14, headSide: -.12, hairBlow: 0 }), { x: 1080, y: yb, S: Sc, yaw: -.1 }, { seed: 5 });
    drawPrims(ctx, him); drawPrims(ctx, her); const h = her.head; drawPrims(ctx, hat([h.c[0] - 4, h.c[1] - h.r * .62], h.r * 2.05, [.12, 0, -.08], { seed: 9 }));
    return;
  }
  F('her', sit({ side: -.12, headSide: -.1 }), 180, y1, 0);
  F('him', sit({ side: .05, headYaw: -.3 }), 420, y1, 0);
  F('her', stand(), 660, y1, 0); F('her', wave(0), 860, y1, Math.PI);
  F('him', stand(), 1060, y1, -Math.PI / 2); F('him', run(0), 1300, y1, -Math.PI / 2); F('him', run(1.6), 1530, y1, -Math.PI / 2); F('him', run(3.1), 1760, y1, Math.PI / 2);
  F('him', dive(.5), 200, y2, Math.PI / 2); F('him', prone(), 520, y2, Math.PI / 2);
  F('him', wave(0), 820, y2, Math.PI * .85);
  F('cyclA', cycle(0), 1060, y2, -Math.PI / 2);
  F('walkA', walk(0), 1300, y2, Math.PI / 2); F('walkB', walk(2), 1450, y2, -Math.PI / 2);
  F('picA', sit({}), 1640, y2, Math.PI * .8, 330);
  for (let k = 0; k < 4; k++) drawPrims(ctx, hat([1150 + k * 180, 120], 60, [k * .8, k * .5, k * .3]));
  handwrite(ctx, 'model sheet — her / him / park', 30, 60, 44, 1);
};
window.READY = true;
