// 高潮画面：窗花背光透亮，光与纹样把年兽挡在门外（风格帧 + 成片 S9 共用）
import { PAL, fillPaper, paperTile, canvas } from './paper.js';
import { put, mul, T, S, R } from './rig.js';
import { drawGirl } from './girl.js';
import { drawNian, NJ, NPOSE } from './nian.js';
import { tuanhua, tuanhuaHoles } from './tuanhua.js';
import { housePiece, mountainPiece, snowPiece, plumTreePiece, drawSnow } from './village.js';
import { beginLight, pool, lightImage, lightMasked, lightRect, applyLight, glowWindow, bloom, rays, E } from './light.js';
const [NLc, NL] = canvas(1920, 1080);

const W = 1920, H = 1080, K = {};
function build() {
  if (K.house) return K;
  K.house = housePiece({ w: 540, h: 270, seed: 71, win: { x: -110, y: -150, r: 100, round: true }, door: { x: 150, w: 110, h: 190 } });
  K.small = [0, 1, 2].map(i => housePiece({ w: 250 + i * 20, h: 130, seed: 72 + i, col: '#a0142a', doufang: false, win: { x: -45 - i * 5, y: -72, w: 64, h: 50 }, door: { x: 60, w: 50, h: 88 } }));
  K.mFar = mountainPiece({ w: 2800, col: '#5e1026', seed: 81, hs: 1.1 });
  K.mMid = mountainPiece({ w: 2800, col: '#7a1226', seed: 84, hs: .8 });
  K.snow = snowPiece({ w: 3000, h: 300 });
  K.tree = plumTreePiece({ seed: 91 });
  K.flower = tuanhua(1.4);
  K.mini = tuanhua(.5);
  K.holes = tuanhuaHoles(1);
  return K;
}
const xy = (C, p) => [C[0] * p[0] + C[2] * p[1] + C[4], C[1] * p[0] + C[3] * p[1] + C[5]];
export function drawClimax(g, t = 0, o = {}) {
  build();
  const C = o.C || mul(T(960, 560), mul(S(1.42), T(-1190, -690))), lit = o.lit ?? 1;
  beginLight(o.amb || 'rgb(104,106,160)');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  fillPaper(g, 'indigo', 0, 0, W, H, C);
  g.restore();
  // 远山、中山
  put(g, K.mFar, mul(C, T(900, 760)), { shadow: .8 });
  put(g, K.mMid, mul(C, T(1100, 850)), { shadow: .9 });
  // 远处小房子（窗亮）
  const smalls = [[260, 880, .8], [980, 876, .72], [1180, 884, .66]];
  smalls.forEach(([x, y, s], i) => {
    const h = K.small[i], M = mul(C, mul(T(x, y), S(s)));
    const win = h.win;
    glowWindow(g, M, win, lit, null, { lattice: 3, lw: 3, mini: K.mini });
    glowWindow(E, M, win, lit, null, { lattice: 3, lw: 3, mini: K.mini });
    lightRect(q => { q.setTransform(...M); q.rect(win.x - win.w / 2, win.y - win.h / 2, win.w, win.h); });
    put(g, h, M, { shadow: .8 });
    const c = [M[4] + M[0] * win.x, M[5] + M[3] * win.y]; pool(c[0], c[1] + 30, 170 * s, 'rgba(255,170,90,1)', .55 * lit);
  });
  // 雪地
  put(g, K.snow, mul(C, T(960, 915)), { shadow: .6 });
  // 年兽（朝右，后仰、捂眼）
  const ns = o.ns || .64;
  NL.setTransform(1, 0, 0, 1, 0, 0); NL.clearRect(0, 0, W, H);
  const NR = drawNian(NL, mul(C, mul(T(o.nx || 600, 960), mul(S(ns), T(0, -NJ.ground)))), {
    ...NPOSE.flinch, flip: true
  }, { shadow: 1.4 });
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(NLc, 0, 0); g.restore();
  // 主屋：窗花背光
  const HM = mul(C, T(1540, 935)), win = K.house.win;
  const fl = { p: K.flower, M: mul(T(win.x, win.y), S(win.r * 1.02 / 400)) };
  glowWindow(g, HM, win, lit, fl, {});
  glowWindow(E, HM, win, lit, fl, {});
  lightRect(q => { q.setTransform(...HM); q.arc(win.x, win.y, win.r, 0, 7); });
  put(g, K.house, HM, { shadow: 1 });
  put(g, K.tree, mul(C, mul(T(1880, 930), S(.9))), { shadow: 1 });
  // 女孩：门前举剪刀
  drawGirl(g, mul(C, mul(T(1265, 950), S(1.12))), {
    flip: true, expr: 'determined', lean: -.03, shF: -1.62, elF: -.12, handF: 'fist', scissors: { ang: -1.45, open: .5 }, shB: .35, elB: -1.2, hipF: -.18, knF: .1, hipB: .2, knB: .05
  });
  // —— 光 ——
  const wc = [HM[4] + HM[0] * win.x, HM[5] + HM[3] * win.y], z = C[0];
  pool(wc[0], wc[1], 620 * z, 'rgba(255,184,112,1)', .8 * lit);
  pool(wc[0] - 300 * z, wc[1] + 60 * z, 560 * z, 'rgba(255,110,70,1)', .55 * lit);
  // 投影纹样：地面（压扁）+ 年兽（放大、偏红）
  lightImage(K.holes, mul(C, [1.25, 0, -.9, .3, 1190, 1010]), .85 * lit, 'rgb(255,190,120)', 1.5);
  const fc = xy(NR.M.head, [-410, -30]), PM = [.62 * z, .07 * z, -.05 * z, .6 * z, fc[0], fc[1]];
  lightMasked(K.holes, PM, NLc, 1.0 * lit, 'rgb(255,228,180)', .6);
  lightMasked(K.holes, PM, NLc, .6 * lit, 'rgb(255,160,110)', 2.5);
  applyLight(g);
  bloom(g, .9 * lit);
  rays(g, wc[0], wc[1], .55 * lit, 20, 3.2);
  drawSnow(g, t, W, H, 0); drawSnow(g, t, W, H, 1);
  return { wc };
}
