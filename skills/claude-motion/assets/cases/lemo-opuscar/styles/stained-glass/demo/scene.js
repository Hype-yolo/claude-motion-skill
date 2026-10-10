// Scene renderer: one state object -> one frame. Camera is an affine view of the wall plane; the floor is
// rendered by the compositor with a perspective consistent at the wall base; light shafts are drawn in 2D.
import { mulberry, hash } from '/core/lib.js';
import { Pass } from './glass.js';
import { FLOOR, LW, LX, BOT, APEX, ROSE, drawStone, drawTracery, drawLancet, drawRose, lancetPath, LTINT } from './window.js';

const PMW = 1024, PMH = 768;
export function camMatrix(cam) { return new DOMMatrix().translate(960, 540).scale(cam[2]).translate(-cam[0], -cam[1]); }

// lit fraction of each lancet under the moving sun band
export function lancetLit(st) {
  const W = st.bandW ?? 310;
  return LX.map(cx => { const a = Math.max(cx - LW / 2, st.sunU - W / 2), b = Math.min(cx + LW / 2, st.sunU + W / 2); return Math.max(0, b - a) / LW; });
}
// perspective projection of a room point (X along wall, H height above floor, Z out from wall) to screen
export function proj3(cam, fl, X, H, Z) {
  const s = cam[2], dist = fl.camD - Z, yb = (FLOOR - cam[1]) * s + 540, y0 = yb - s * fl.eyeH;
  return [960 + (X - cam[0]) * s * fl.camD / dist, y0 + s * fl.camD * (fl.eyeH - H) / dist];
}

export function renderScene(Lc, L, comp, st) {
  const { G, S, R, O, P } = Lc;
  for (const c of [G, S, R, O]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 1920, 1080); }
  const cam = st.cam, M = camMatrix(cam);
  const hw = 960 / cam[2], hh = 540 / cam[2], view = [cam[0] - hw, cam[1] - hh, cam[0] + hw, cam[1] + hh];
  const top = st.floorMode === 2;
  const lit = lancetLit(st).map(v => v * (st.sunI > 0 ? 1 : 0));
  if (!top) {
    drawStone(S, M, view, { inscription: st.inscription, gild: st.gild });
    const Pz = new Pass(G, S); Pz.setTransform(M);
    for (let i = 0; i < 4; i++) {
      const cx = LX[i]; if (cx + LW / 2 + 40 < view[0] || cx - LW / 2 - 40 > view[2]) continue;
      Pz.setTransform(M); drawLancet(Pz, i, (st.lancets || [])[i] || {});
    }
    if (view[1] < ROSE.y + ROSE.r) { Pz.setTransform(M); drawRose(Pz); }
    drawTracery(S, M);
  }
  // floor light-patch map (glass projected by parallel sunlight)
  let pmRect = null;
  const fl = st.floor || { camD: 2600, eyeH: 300 };
  if ((st.floorMode || 0) > 0 && st.sunI > 0) {
    const rx = st.pm ? st.pm[0] : -1800, rz = st.pm ? st.pm[1] : 0, rw = st.pm ? st.pm[2] : 3600, rh = st.pm ? st.pm[3] : 2700;
    pmRect = [rx, rz, rw, rh];
    P.setTransform(1, 0, 0, 1, 0, 0); P.fillStyle = '#000'; P.fillRect(0, 0, PMW, PMH);
    const kx = PMW / rw, ky = PMH / rh, sx = st.sx, sz = st.sz;
    const PM = new DOMMatrix([kx, 0, -sx * kx, -sz * ky, (FLOOR * sx - rx) * kx, (FLOOR * sz - rz) * ky]);
    const Pp = new Pass(P, P, 'proj');
    for (let i = 0; i < 4; i++) {
      if (lit[i] <= .01) continue;
      P.save(); P.globalAlpha = Math.min(1, lit[i]); Pp.setTransform(PM);
      P.fillStyle = '#000';
      drawLancet(Pp, i, (st.lancets || [])[i] || {}); P.restore();
    }
    P.setTransform(1, 0, 0, 1, 0, 0);
    // soften (glass scatter + sun disc penumbra)
    P.filter = `blur(${st.pmBlur ?? 3}px)`; P.globalCompositeOperation = 'copy'; P.drawImage(L.P, 0, 0); P.filter = 'none'; P.globalCompositeOperation = 'source-over';
  }
  // light shafts + dust (in the air between window and floor)
  if (!top && st.sunI > 0 && (st.raysK ?? 1) > 0) {
    R.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      if (lit[i] <= .01) continue;
      const cx = LX[i], tint = LTINT[i], n = 14;
      for (let k = 0; k < n; k++) {
        const u0 = k / n, u1 = (k + 1) / n, xa = cx - LW / 2 + u0 * LW, xb = cx - LW / 2 + u1 * LW;
        const ytop = APEX + 60 + Math.abs((u0 + u1) / 2 - .5) * 200, ybot = BOT;
        const q = (x, y) => { const H = FLOOR - y; return [proj3(cam, fl, x, H, 0), proj3(cam, fl, x + H * st.sx, 0, H * st.sz)]; };
        const [a0, a1] = q(xa, ytop), [b0, b1] = q(xb, ytop), [c0, c1] = q(xb, ybot), [d0, d1] = q(xa, ybot);
        const flick = .55 + .45 * Math.sin(k * 2.7 + (st.time || 0) * .6 + hash(k + i * 9) * 6) * Math.sin(k * 1.3 + (st.time || 0) * .23);
        const I = lit[i] * st.sunI * .05 * flick * (st.raysK ?? 1) * Math.min(1, .75 / Math.max(.5, cam[2]) + .15);
        const gr = R.createLinearGradient(a0[0], a0[1], a1[0], a1[1]);
        const col = (m) => `rgba(${Math.round(255 * Math.min(1, tint[0] * st.sunCol[0] * I * m))},${Math.round(255 * Math.min(1, tint[1] * st.sunCol[1] * I * m))},${Math.round(255 * Math.min(1, tint[2] * st.sunCol[2] * I * m))},1)`;
        gr.addColorStop(0, col(.08)); gr.addColorStop(.22, col(.8)); gr.addColorStop(.45, col(1)); gr.addColorStop(1, col(.3));
        R.fillStyle = gr; R.beginPath(); R.moveTo(a0[0], a0[1]); R.lineTo(b0[0], b0[1]); R.lineTo(c0[0], c0[1]); R.lineTo(c1[0], c1[1]); R.lineTo(b1[0], b1[1]); R.lineTo(a1[0], a1[1]); R.closePath(); R.fill();
      }
      // dust motes drifting inside the shaft
      const rnd = mulberry(77 + i);
      for (let k = 0; k < 90; k++) {
        const u = rnd(), v = (rnd() + (st.time || 0) * .012 * (.5 + rnd())) % 1, yw = APEX + 80 + rnd() * (BOT - APEX - 80);
        const x = cx - LW / 2 + u * LW, H = FLOOR - yw, X = x + H * st.sx * v, Hh = H * (1 - v), Z = H * st.sz * v;
        const p = proj3(cam, fl, X + Math.sin((st.time || 0) * .7 + k) * 8, Hh + Math.cos((st.time || 0) * .5 + k * 1.7) * 6, Z);
        const tw = .5 + .5 * Math.sin((st.time || 0) * 2.2 + k * 3.1);
        const a = lit[i] * st.sunI * .16 * tw * (st.raysK ?? 1), r = (.8 + rnd() * 1.6) * Math.sqrt(cam[2]);
        R.fillStyle = `rgba(${Math.round(255 * Math.min(1, a))},${Math.round(235 * Math.min(1, a))},${Math.round(200 * Math.min(1, a))},1)`;
        R.beginPath(); R.arc(p[0], p[1], r, 0, 7); R.fill();
      }
    }
    R.globalCompositeOperation = 'source-over';
  }
  if (st.overlay) st.overlay(O, M);
  const lancets = LX.map((cx, i) => ({ rect: [cx - LW / 2, APEX, cx + LW / 2, BOT], I: lit[i] * st.sunI }));
  lancets.push({ rect: [ROSE.x - ROSE.r, ROSE.y - ROSE.r, ROSE.x + ROSE.r, ROSE.y + ROSE.r], I: st.roseI || 0 });
  comp.render(L, {
    cam, sunU: st.sunU, bandW: st.bandW ?? 310, bandSoft: st.bandSoft ?? 24, skew: st.skew ?? .06, sunI: st.sunI, sunCol: st.sunCol,
    skyI: st.skyI ?? .16, skyCol: st.skyCol, roseI: st.roseI || 0, roseCol: st.roseCol || st.sunCol, roseC: [ROSE.x, ROSE.y], roseR: ROSE.r,
    amb: st.amb ?? .18, ambCol: st.ambCol, haze: st.haze ?? .55, raysK: 1, lancets, pts: st.pts || [],
    sweep: st.sweep, floorMode: st.floorMode || 0, floorY: FLOOR, camD: fl.camD, eyeH: fl.eyeH, patchK: st.patchK ?? 1.1, pmRect: pmRect || [0, 0, 1, 1], topCam: st.topCam,
    expo: st.expo ?? 1.1, bloom: st.bloom ?? .55, thr: st.thr ?? .5, vign: st.vign ?? .4, sat: st.sat ?? 1.1, contrast: st.contrast ?? .12, fade: st.fade || 0, tint: st.tint, time: st.time || 0,
  });
}
