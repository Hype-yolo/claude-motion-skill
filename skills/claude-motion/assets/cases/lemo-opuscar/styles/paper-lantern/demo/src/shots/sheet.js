import { sheet, skyPanel } from '../paper.js';
import { mooncake } from '../art.js';
import * as H from '../people.js';
import { stage, aim } from '../stage.js';
export function build(E) {
  const S = stage({ key: 1.2, amb: .5, keyCol: '#fff1dd' });
  S.add(skyPanel({ w: 1, h: .6, z: -.1, stops: [[0, '#e9d9b8'], [1, '#d8c29a']] }));
  S.add(sheet({ U: S.U, w: .6, h: .34, z: -.02, trans: .1, draw: x => {
    x.fillStyle = '#2a1a14';
    x.save(); x.translate(-.25, -.15); H.grannyStand(x, .15, { pin: '#2a1a14' }); x.translate(0, .77 * .15); H.arm(x, .15, -1.25, .9, { sleeve: 1.2 }); x.restore();
    x.save(); x.translate(-.14, -.08); H.grannySit(x, .15); x.translate(0, .29 * .15); H.arm(x, .15, -.7, .7, { sleeve: 1.2 }); x.restore();
    x.save(); x.translate(-.02, -.08); H.girlSit(x, .16); x.translate(0, .275 * .16); H.arm(x, .16, -.4, 1.9); x.restore();
    x.save(); x.translate(.09, -.15); H.girlStand(x, .17); x.translate(0, .775 * .17); H.arm(x, .17, -1.5, .15); x.restore();
    x.save(); x.translate(.16, -.15); H.childStand(x, .08); x.restore();
    x.save(); x.translate(.23, -.15); H.sushi(x, .16); x.restore();
    x.save(); x.translate(-.2, .07); H.change(x, .14); x.restore();
    H.ribbon(x, [[-.2,.1],[-.24,.08],[-.28,.1],[-.32,.075],[-.36,.09]], .004, .0015);
    x.save(); x.translate(.0, .06); H.rabbit(x, .05); x.restore();
    mooncake(x, { cx: .15, cy: .09, r: .04 });
  } }));
  return { S, update(t) { aim(S.cam, [0, 0, .7, 0, 0, -.02], t, { hand: 0 }); }, post() { return { focus: .72, aper: 0, maxCoc: 0, bloom: { strength: 0 } }; }, grade() { return { expo: 1, vig: .1 }; } };
}
