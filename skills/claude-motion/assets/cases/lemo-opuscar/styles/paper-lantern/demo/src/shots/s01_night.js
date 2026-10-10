// S1 · 中秋夜（开灯 → 片名）：月亮、祥云、群山、临水村落、桂花树、灯笼
import { sheet, skyPanel, moon, setMoon, vtext, text } from '../paper.js';
import { karst, ridge, xiangyun, waves, waterTop, osmanthus, reeds, jiangnanHouse, pavilion, lantern, FONT } from '../art.js';
import { stage, aim } from '../stage.js';
import { lightbox, BOX } from '../room.js';
import { seg, ss, eio, lerp, clamp, mulberry } from '../lib.js';

export const MOON = [-.05, .05, -.125];

export async function build(E) {
  const S = stage({ light: MOON, lightR: .15, lightCol: '#ffe2ae', key: 1.0, amb: .3, ambCol: '#7d90c8', keyCol: '#d6dcff', keyPos: [0, .155, .005], keyTarget: [0, -.06, -.1], keyAngle: 1.1 });
  S.amb.intensity = 0;
  const { U } = S;
  const sky = S.add(skyPanel({ w: .56, h: .33, z: -.135, stops: [[0, '#0a1330'], [.45, '#172a58'], [.75, '#2e4478'], [1, '#43598a']], stars: 260, starMinY: -.02 }));
  const mn = S.add(moon({ x: MOON[0], y: MOON[1], z: MOON[2], r: .04, gain: 1.75, halo: 4.2, haloGain: .3 }));

  const clouds = S.add(sheet({ U, w: .558, h: .328, z: -.112, trans: .9, finish: { rim: .5 }, draw: x => {
    x.fillStyle = '#c3cbe8';
    xiangyun(x, -.092, .02, .0105, 1, { tail: 3 });
    xiangyun(x, .065, .1, .0075, -1, { tail: 2.4 });
    xiangyun(x, .22, .035, .006, 1);
    xiangyun(x, -.22, .1, .0065, 1);
  } }));
  const far = S.add(sheet({ U, w: .558, h: .328, z: -.098, trans: .7, draw: x => {
    x.fillStyle = '#6a86c2';
    karst(x, { x0: -.28, x1: .28, base: -.035, peaks: [[-.31, .05, .026], [-.25, .04, .022], [-.15, .068, .026], [-.07, .035, .018], [.05, .075, .03], [.12, .05, .022], [.22, .065, .026], [.31, .046, .026]], rough: .0005, carve: .0005 });
  } }));
  const mid = S.add(sheet({ U, w: .558, h: .328, z: -.08, trans: .45, draw: x => {
    x.fillStyle = '#3f5a92';
    karst(x, { x0: -.28, x1: .28, base: -.05, peaks: [[-.34, .045, .035], [-.22, .055, .03], [-.12, .032, .026], [.17, .052, .026], [.265, .068, .028], [.35, .04, .026]], rough: .0004, seed: 4, carve: .0006 });
    ridge(x, { x0: -.28, x1: .28, base: -.056, amp: .005, seed: 9, freq: 30 });
  } }));
  const village = S.add(sheet({ U, w: .558, h: .328, z: -.062, trans: .25, glow: 2.2, glowCol: '#ffb862', draw: x => drawVillage(x, null), glowDraw: g => drawVillage(null, g) }));
  const river = S.add(sheet({ U, w: .558, h: .328, z: -.046, trans: .3, glow: 1.2, glowCol: '#ffe0a6', draw: x => {
    x.fillStyle = '#22325e'; waterTop(x, { x0: -.28, x1: .28, base: -.07, amp: .001, len: .05 });
    x.save(); x.beginPath(); x.rect(-.28, -.2, .56, .126); x.clip();
    waves(x, { x0: -.28, x1: .28, y0: -.076, y1: -.2, r: .006, fill: '#22325e', line: '#34487a', lw: .0006 });
    x.restore();
    moonTrail(x, '#e9cf96');
  }, glowDraw: g => moonTrail(g, '#fff') }));
  const tree = S.add(sheet({ U, w: .558, h: .328, z: -.03, trans: .12, glow: .55, glowCol: '#ffc766', draw: x => {
    x.fillStyle = '#17224a'; osmanthus(x, { cx: -.215, by: -.115, h: .16, flowers: '#d9a24a', seed: 5, leaves: 80, nFlowers: 60 });
    x.fillStyle = '#17224a'; bridge(x);
  }, glowDraw: g => { g.fillStyle = '#000'; osmanthus(g, { cx: -.215, by: -.115, h: .16, flowers: '#fff', seed: 5, leaves: 80, nFlowers: 60 }); } }));
  const fg = S.add(sheet({ U, w: .558, h: .328, z: -.014, trans: .05, draw: x => {
    x.fillStyle = '#0e1532'; x.strokeStyle = '#0e1532';
    ridge(x, { x0: -.28, x1: .28, base: -.112, amp: .006, seed: 3, freq: 14 });
    reeds(x, { x0: .08, x1: .32, by: -.116, h: .05, n: 40, seed: 8 });
    reeds(x, { x0: -.34, x1: -.14, by: -.116, h: .038, n: 26, seed: 12 });
  } }));
  const lant = S.add(sheet({ U, w: .2, h: .3, x: .19, y: .1, z: .004, trans: .05, glow: 1.25, glowCol: '#ff8a48', shadow: false, recv: false, ay: .13, draw: x => {
    x.fillStyle = '#0d1328'; lantern(x, { cx: -.012, cy: -.02, r: .013, stringLen: .2 }); lantern(x, { cx: .022, cy: .012, r: .01, stringLen: .2 });
  }, glowDraw: g => { const o = { col: '#000', rib: '#000', cap: '#000', string: false, tassel: false }; lantern(g, { ...o, cx: -.012, cy: -.02, r: .013 }, g); lantern(g, { ...o, cx: .022, cy: .012, r: .01 }, g); } }));
  const title = S.add(sheet({ U, w: .1, h: .13, x: .128, y: .06, z: -.104, trans: .25, shadow: false, recv: false, finish: { rim: .6 }, draw: x => {
    vtext(x, '一个月饼', .016, .045, .02, FONT.brush, { fill: '#f1dbac', gap: 1.02 });
    vtext(x, '的相思', -.012, .025, .02, FONT.brush, { fill: '#f1dbac', gap: 1.02 });
    x.fillStyle = '#b3302a'; x.fillRect(-.022, -.05, .015, .015);
    vtext(x, '中秋', -.0145, -.0395, .0058, FONT.brush, { fill: '#f7e6c8', gap: 1.0 });
  } }));

  const R = await lightbox(S, E, { spill: 7 });
  const layers = [clouds, far, mid, village, river, tree, fg, lant];
  const hide = new URLSearchParams(location.search).get('hide'); if (hide) for (const [k, v] of Object.entries({ clouds, far, mid, village, river, tree, fg, lant, title })) if (hide.split(',').includes(k)) v.visible = false;
  return {
    S,
    update(t) {
      const km = ss(seg(t, .5, 3.2)); setMoon(mn, km);
      sky.material.color.setScalar(.03 + .97 * ss(seg(t, .8, 3.5)));
      layers.forEach((m, i) => { const u = m.material.userData.u; m.userData.trans0 ??= u.uTrans.value; u.uTrans.value = m.userData.trans0 * ss(seg(t, 1.2 + i * .42, 3.6 + i * .42)); });
      S.key.intensity = S.base.key * ss(seg(t, 3.4, 6.2)); S.amb.intensity = S.base.amb * ss(seg(t, 1.5, 4.5));
      village.material.userData.u.uGlowLit.value = ss(seg(t, 5.2, 7.2)); river.material.userData.u.uGlowLit.value = km * (.85 + .15 * Math.sin(t * 2.1));
      tree.material.userData.u.uGlowLit.value = ss(seg(t, 3.5, 6)); lant.material.userData.u.uGlowLit.value = ss(seg(t, 6, 8)) * (1 + .06 * Math.sin(t * 7.3) * Math.sin(t * 3.1));
      const tk = ss(seg(t, E.titleIn, E.titleIn + 1.6)); title.visible = tk > 0;
      title.position.y = .06 - .005 * (1 - tk); title.material.userData.u.uTrans.value = .25 * tk; title.material.color.setScalar(tk);
      lant.rotation.z = .03 * Math.sin(t * .9) + .012 * Math.sin(t * 2.3);
      clouds.position.x = t * .0005;
      R.spill.intensity = 7 * ss(seg(t, .8, 4.5)) * (1 + .03 * Math.sin(t * 5.3));
      // 镜头：屋里远景看灯箱 → 推进框内 → 缓推
      const a = eio(seg(t, 2.6, 9.6)), b = eio(seg(t, 9.6, E.dur + 1));
      const z = lerp(lerp(1.3, .56, a), .5, b);
      aim(S.cam, [lerp(.0, .005, a) - .01 * b, lerp(.12, -.004, a) + .008 * b, lerp(1.45, z, a > 0 ? 1 : 0) * 0 + (a > 0 ? z : lerp(1.45, 1.3, seg(t, 0, 2.6))), lerp(-.01, -.004, a) - .01 * b, lerp(-.04, .002, a) + .012 * b, -.07], t);
      this._fz = lerp(.014, -.062, ss(seg(t, 6, 9)));
    },
    post() { return { focus: S.cam.position.z - (this._fz ?? -.062), aper: lerp(26, 14, ss(seg(0, 0, 1))), maxCoc: 14, bloom: { strength: .32, radius: .55, threshold: 1.25 } }; },
    grade() { return { expo: 1.08, vig: .42, sat: 1.05, contrast: .1 }; },
  };

  function drawVillage(x, g) {
    const wall = '#5a70a6', tile = '#1b284f';
    if (x) { x.fillStyle = tile; ridge(x, { x0: -.28, x1: .28, base: -.07, amp: .003, seed: 2, freq: 20 }); }
    const houses = [[-.07, -.071, .038, .018], [-.02, -.07, .046, .02], [.034, -.068, .036, .024], [.083, -.071, .05, .019], [.138, -.067, .034, .023], [.185, -.071, .044, .019]];
    houses.forEach(([cx, by, w, h], i) => {
      const wins = i % 2 ? [[w * .16, h * .35, w * .14, h * .3], [w * .7, h * .35, w * .14, h * .3]] : [[w * .2, h * .35, w * .15, h * .3]];
      jiangnanHouse(x, { cx, by, w, h, windows: wins, wall, tile }, g);
    });
    if (x) { x.fillStyle = tile; pavilion(x, { cx: .245, by: -.073, w: .026, h: .04 }); }
  }
  function moonTrail(x, col) {
    const R = mulberry(21); x.fillStyle = col;
    for (let i = 0; i < 40; i++) { const y = -.075 - i * .0022 - R() * .001, w = (.022 - i * .00035) * (.2 + R() * .9), c = MOON[0] * .9 + (R() - .5) * .01;
      x.beginPath(); x.ellipse(c, y, w / 2, .00035 + R() * .0004, 0, 0, Math.PI * 2); x.fill(); }
  }
  function bridge(x) {
    x.beginPath(); x.moveTo(.0, -.086); x.quadraticCurveTo(.07, -.05, .14, -.086); x.lineTo(.14, -.092); x.lineTo(0, -.092); x.closePath(); x.fill();
    x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.ellipse(.07, -.093, .03, .026, 0, 0, Math.PI); x.fill(); x.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 9; i++) { const u = (i + .5) / 9; x.fillRect(.012 + u * .116, -.08 + Math.sin(u * Math.PI) * .026 - .003, .0012, .007); }
    x.lineWidth = .0009; x.strokeStyle = x.fillStyle; x.beginPath(); x.moveTo(.01, -.083); x.quadraticCurveTo(.07, -.043, .13, -.083); x.stroke();
  }
}
