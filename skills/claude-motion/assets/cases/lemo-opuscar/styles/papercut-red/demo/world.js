// 村子世界：布局 + 夜 / 昼两套纸色 + 夜景光照。背景层 = 靛蓝纸；只有窗花、灯笼、主角是红的。
import { PAL, fillPaper, canvas } from './paper.js';
import { put, mul, T, S, R } from './rig.js';
import { tuanhua, tuanhuaHoles } from './tuanhua.js';
import { housePiece, mountainPiece, snowPiece, plumTreePiece, lanternPiece, drawSnow } from './village.js';
import { beginLight, pool, lightMasked, lightRect, applyLight, glowWindow, bloom, rays, addMasked, E, L } from './light.js';
import { lerp, clamp, seg, ss, hash } from '/core/lib.js';

export const W = 1920, H = 1080, GROUND = 905;
export const NIGHT = { sky: 'ink', far: '#1f2a55', mid: '#29356e', house: '#35457f', tree: '#28346c', snow: '#7a88ba', lantern: PAL.red };
export const DAY = { sky: 'rice', far: '#e0877f', mid: '#cf4f4a', house: PAL.red, tree: '#b8191b', snow: '#f4ecd8', lantern: PAL.red };
// 8 户人家（x, 缩放, 熄灯时刻, 灯笼到达时刻）+ 女孩家
export const HOUSES = [
  [230, 1.05, 14.0, 33.75], [560, .95, 14.5, 33.5], [900, 1.12, 14.5, 33.25], [1240, .98, 15.0, 33.0],
  [1580, 1.08, 15.5, 32.75], [1900, .94, 15.5, 32.5], [2200, 1.0, 16.0, 32.0], [3060, 1.0, 16.0, 32.25]
].map(([x, s, out, relit], i) => ({ x, s, out, relit, i }));
export const HERO = { x: 2620, s: 1.2 };
const K = {};
function build() {
  if (K.night) return K;
  for (const [name, P] of [['night', NIGHT], ['day', DAY]]) {
    const k = K[name] = {};
    k.houses = HOUSES.map((h, i) => housePiece({ w: 250 + (i % 3) * 30, h: 140 + (i % 2) * 14, seed: 72 + i, col: P.house, doufang: false, win: { x: -48 - (i % 3) * 6, y: -78, w: 66, h: 52 }, door: { x: 64 + (i % 3) * 8, w: 52, h: 92 } }));
    k.hero = housePiece({ w: 540, h: 270, seed: 71, col: P.house, win: { x: -110, y: -150, r: 100, round: true }, door: { x: 150, w: 110, h: 190 } });
    k.far = mountainPiece({ w: 4200, col: P.far, seed: 81, hs: 1.25 });
    k.mid = mountainPiece({ w: 4200, col: P.mid, seed: 84, hs: .85 });
    k.snow = snowPiece({ w: 4400, h: 320, col: P.snow });
    k.tree = plumTreePiece({ seed: 91, col: P.tree });
  }
  K.lantern = lanternPiece({});
  K.flower = tuanhua(1.4); K.mini = tuanhua(.5); K.holes = tuanhuaHoles(1);
  return K;
}
export const kit = () => build();
const pt = (M, p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
// 房子窗的亮度
export function winI(h, t) {
  if (t < h.out) return 1;
  if (t < h.out + .14) return (1 - (t - h.out) / .14) * (.6 + .4 * Math.sin(t * 90));
  if (t < h.relit) return 0;
  const u = t - h.relit; return u < .2 ? Math.min(1.3, u / .12) : 1 + .3 * Math.exp(-(u - .2) * 5);
}
const [NLc, NL] = canvas(W, H), [GLc, GL] = canvas(W, H), [SIc, SI] = canvas(W, H);
export { NLc };
// 画村子。o: { pal:'night'|'day', light: bool, nian(ctx) 画年兽（返回 M）, nianLayer:'back'|'front',
//   hero: 'girl'|'dark'|'flower'|'none', heroI, girlSil(ctx,C) 画窗里的剪影, girl(ctx) 前景女孩, pattern: {on, a}, rays, snow }
export function drawVillage(g, C, t, o = {}) {
  const k = build(), P = o.pal === 'day' ? DAY : NIGHT, kk = k[o.pal === 'day' ? 'day' : 'night'], night = o.pal !== 'day';
  const z = C[0];
  if (night) beginLight(o.amb || 'rgb(214,214,236)');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); fillPaper(g, P.sky, 0, 0, W, H, C); g.restore();
  if (o.sky) o.sky(g);
  let NM = null;
  const nianLayer = () => {
    NL.setTransform(1, 0, 0, 1, 0, 0); NL.clearRect(0, 0, W, H);
    NM = o.nian(NL);
    if (o.nianClip) { NL.save(); NL.globalCompositeOperation = 'destination-in'; NL.setTransform(1, 0, 0, 1, 0, 0); o.nianClip(NL); NL.restore(); }
    if (night && o.nianDark != null) { SI.setTransform(1, 0, 0, 1, 0, 0); SI.globalCompositeOperation = 'copy'; SI.drawImage(NLc, 0, 0); SI.globalCompositeOperation = 'source-over'; NL.save(); NL.setTransform(1, 0, 0, 1, 0, 0); NL.globalCompositeOperation = 'multiply'; NL.fillStyle = o.nianDark; NL.fillRect(0, 0, W, H); NL.globalCompositeOperation = 'destination-in'; NL.drawImage(SIc, 0, 0); NL.restore(); }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(NLc, 0, 0); g.restore();

  };
  if (o.nian && o.nianBehindFar) nianLayer();
  put(g, kk.far, mul(C, T(1600, 690)), { shadow: .9 });
  if (o.nian && !o.nianBehindFar) nianLayer();
  put(g, kk.mid, mul(C, T(1600, 812)), { shadow: .9 });
  // 树
  for (const [x, s] of [[80, .8], [1400, .7], [2280, .85], [3200, .9]]) put(g, kk.tree, mul(C, mul(T(x, GROUND + 6), S(s))), { shadow: .9 });
  // 房子
  HOUSES.forEach((h, i) => {
    const hp = kk.houses[i], M = mul(C, mul(T(h.x, GROUND), S(h.s))), win = hp.win;
    const I = night ? winI(h, t) : 0;
    if (night) {
      if (I > 0) {
        glowWindow(g, M, win, Math.min(1, I), null, { lattice: 3, lw: 3, mini: K.mini });
        glowWindow(E, M, win, Math.min(1, I) * (o.glowE ?? .75), null, { lattice: 3, lw: 3, mini: K.mini });
        lightRect(q => { q.setTransform(...M); q.rect(win.x - win.w / 2, win.y - win.h / 2, win.w, win.h); });
        const c = pt(M, [win.x, win.y]); pool(c[0], c[1] + 40 * z * h.s, 230 * z * h.s, 'rgba(255,176,100,1)', .5 * Math.min(1.2, I));
      } else { g.save(); g.setTransform(...M); g.fillStyle = '#0c1024'; g.fillRect(win.x - win.w / 2, win.y - win.h / 2, win.w, win.h); g.restore(); }
    } else { g.save(); g.setTransform(...M); g.fillStyle = '#f7efdc'; g.fillRect(win.x - win.w / 2, win.y - win.h / 2, win.w, win.h); put(g, K.mini, mul([1, 0, 0, 1, 0, 0], [win.w / 900, 0, 0, win.w / 900, win.x, win.y]), { shadow: .5 }); g.restore(); }
    put(g, hp, M, { shadow: .9 });
    // 檐下两盏红灯笼
    for (const dx of [-hp.win.w * 1.7, hp.door.x + 40]) { const sw = Math.sin(t * 1.3 + i + dx) * .06; put(g, K.lantern, mul(M, mul(T(dx, -hp.wallH + 8), mul(R(sw), S(.8)))), { shadow: .8 }); }
    if (!night && o.dayWin) o.dayWin(g, M, win, h);
  });
  // 女孩家
  const HM = mul(C, mul(T(HERO.x, GROUND + 25), S(HERO.s))), hw = kk.hero.win;
  let wc = pt(HM, [hw.x, hw.y]);
  if (night) {
    const hero = o.hero || 'girl', I = o.heroI ?? 1;
    if (hero === 'flower' && I > 0) {
      const fl = { p: K.flower, M: mul(T(hw.x, hw.y), S(hw.r * 1.02 / 400)) };
      glowWindow(g, HM, hw, I, fl, { tcol: '#b51d18' }); glowWindow(E, HM, hw, I * (o.flowerE ?? .6), fl, { tcol: '#b51d18' });
      lightRect(q => { q.setTransform(...HM); q.arc(hw.x, hw.y, hw.r, 0, 7); });
    } else if (hero === 'girl' && I > 0) {
      glowWindow(g, HM, hw, I, null, {}); glowWindow(E, HM, hw, I * .6, null, {});
      lightRect(q => { q.setTransform(...HM); q.arc(hw.x, hw.y, hw.r, 0, 7); });
      if (o.girlSil) {  // 窗纸上的剪影
        SI.setTransform(1, 0, 0, 1, 0, 0); SI.globalCompositeOperation = 'source-over'; SI.clearRect(0, 0, W, H);
        o.girlSil(SI, HM); SI.globalCompositeOperation = 'source-in'; SI.fillStyle = 'rgba(92,16,12,.9)'; SI.fillRect(0, 0, W, H);
        g.save(); g.setTransform(...HM); g.beginPath(); g.arc(hw.x, hw.y, hw.r, 0, 7); g.clip(); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'blur(1.2px)'; g.drawImage(SIc, 0, 0); g.restore();
      }
    } else { g.save(); g.setTransform(...HM); g.fillStyle = '#0c1024'; g.beginPath(); g.arc(hw.x, hw.y, hw.r, 0, 7); g.fill(); g.restore(); }
  } else { g.save(); g.setTransform(...HM); g.fillStyle = '#f7efdc'; g.beginPath(); g.arc(hw.x, hw.y, hw.r, 0, 7); g.fill(); put(g, K.flower, mul([1, 0, 0, 1, 0, 0], [hw.r * 1.02 / 400, 0, 0, hw.r * 1.02 / 400, hw.x, hw.y]), { shadow: .6 }); g.restore(); }
  put(g, kk.hero, HM, { shadow: 1 });
  for (const dx of [-250, 250]) put(g, K.lantern, mul(HM, mul(T(dx, -262), mul(R(Math.sin(t * 1.1 + dx) * .05), S(1.1)))), { shadow: .8 });
  put(g, kk.snow, mul(C, T(1600, GROUND + 8)), { shadow: .6 });
  if (o.front) o.front(g, { HM, wc });
  // —— 光 ——
  if (night) {
    const hero = o.hero || 'girl', I = o.heroI ?? 1;
    if (I > 0 && hero !== 'dark' && hero !== 'none') {
      pool(wc[0], wc[1], (hero === 'flower' ? 700 : 420) * z, 'rgba(255,184,112,1)', (hero === 'flower' ? .75 : .5) * I);
      if (hero === 'flower' && o.groundPattern !== false) {
        const gp = mul(C, [1.25, 0, -.9, .3, HERO.x - 380, GROUND + 90]);
        lightMaskedFlat(gp, .8 * I);
      }
    }
    if (o.lights) o.lights({ wc, HM, NM });
    applyLight(g);
    if ((o.hero || 'girl') === 'flower' && (o.heroI ?? 1) > 0 && o.groundPattern !== false) addMasked(g, K.holes, mul(C, [1.25, 0, -.9, .3, HERO.x - 380, GROUND + 100]), null, 'rgb(255,170,100)', .32 * Math.min(1, o.heroI ?? 1), 1.2);
    if (o.after) o.after(g, { wc, HM, NM });
    bloom(g, o.bloom ?? .55);
    if (o.rays) rays(g, wc[0], wc[1], o.rays, 18, 2.6);
  }
  if (o.snow !== false) { drawSnow(g, t, W, H, 0, C, night ? {} : { col: '#fff8e8' }); drawSnow(g, t, W, H, 1, C, night ? {} : { col: '#fff8e8' }); }
  return { HM, wc, NM };
}
// 地面投影（落在雪地上）：直接加到光照图
import { lightImage } from './light.js';
function lightMaskedFlat(M, a) { lightImage(K.holes, M, Math.min(1, a * 1.3), 'rgb(255,206,140)', 1); }
