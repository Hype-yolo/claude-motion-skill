// demo.js — "The Letter" (10 s). Hina dashes down a sakura street to hand Ren a letter; he's caught off guard.
//   A 0.0–3.4  establishing: tilt down from the sky to the street, Hina runs in with the letter and skids to a stop
//   B 3.4–6.4  [slash wipe] knees-up: she winds up, bows and thrusts the letter (smear, focus-line BG), Ren's take
//   C 6.4–10   [impact frame] Ren close-up: dramatic zoom, surprised → flustered → a soft smile. [star iris out]
(() => {
  const U = 125;
  // ---------------------------------------------------------------- A: establishing
  const runX = tt => lerp(-160, 760, easeOut(seg(tt, .35, 2.5)) * .15 + seg(tt, .35, 2.5) * .85);
  function shotA(t, lt, dur) {
    setTOD('day');
    const k = ease(seg(lt, 0, 2.2)), cam = { x: 960 + 40 * k, y: lerp(120, 560, k), zoom: lerp(1, 1.1, ease(seg(lt, .6, 3.4))) };
    SET.street(cam, t, {});
    const ta = onTwos(lt), x = runX(ta), v = (runX(ta + .02) - runX(ta - .02)) / .04;
    const stopped = ta > 2.5, skid = seg(ta, 2.35, 2.75);
    const sway = [-v / U * .05 + follow(ta, tt => runX(tt) / U, 5, 12, 1.4), 0];
    const hinaO = { t: ta, turn: .75, sway, face: stopped ? 'embarrassed' : 'determined',
      prop: { hand: 'L', draw: PROPS.envelope, rot: -60 } };
    if (!stopped) Object.assign(hinaO, { run: x / (3.4 * U), runAmt: 1 - skid * .8, lean: -skid * 18 });
    else Object.assign(hinaO, { armL: [25, 95, 'hold'], armR: [-4, 16, 'relax'], lean: 6 * spring(ta, 2.5, 5, 13), look: [.2, .5], blink: autoBlink(ta, 2) });
    const r = ren(1330, 955, U, { t: ta, turn: -.55, face: ta > 2.7 ? 'surprised' : 'deadpan', look: ta > 2.4 ? [-.8, 0] : [0, 0], sway: [.02 * Math.sin(t), 0] });
    hina(x, 965, U, hinaO);
    camEnd();
    petals(t, { n: 34, size: 15, wind: 110, seed: 'A' });
    if (lt < .45) flash(1 - lt / .45, '#fff8f0');
    if (lt > dur - .35) slashWipe(seg(lt, dur - .35, dur) * .5);
  }
  // ---------------------------------------------------------------- B: the thrust
  function shotB(t, lt, dur) {
    setTOD('day');
    const ta = onTwos(lt), cam = { x: 1060 + 30 * ease(seg(lt, 0, 3)), y: 640, zoom: 1.3 };
    const hit = .92, after = ta >= hit;
    SET.street(cam, t, {});
    if (after) {                                   // cut on action: the BG drops to a pink focus-line "moment"
      camEnd(); G.save(); G.setTransform(1, 0, 0, 1, 0, 0);
      const g = G.createRadialGradient(W * .42, H * .42, 50, W * .42, H * .42, 1200); g.addColorStop(0, '#fff3f6'); g.addColorStop(.5, '#ffc2d2'); g.addColorStop(1, '#e889a8');
      G.fillStyle = g; G.fillRect(0, 0, W, H); focusLines(t, W * .6, H * .4, { col: 'rgba(255,255,255,.95)', r: 380, n: 120, w: 14 }); G.restore();
      parallax(cam, 1);
    }
    // Hina: fidget → anticipation (lean back, arm cocked, squash) → thrust + bow → overshoot and settle
    const pull = ease(seg(ta, .45, .8)), go = easeOut(seg(ta, .8, hit)), set = spring(ta, hit, 6, 16);
    const lean = lerp(0, -12, pull) * (1 - go) + go * 24 + set * 8;
    const armL = [lerp(lerp(22, -18, pull), 76, go) + set * 6, lerp(lerp(100, 140, pull), 16, go), 'hold', 0, lerp(1, .8, go)];   // forearm foreshortens toward Ren/camera
    const armR = [lerp(8, -10, pull) * (1 - go) + go * -30, lerp(12, 30, pull) * (1 - go) + go * 10, after ? 'fist' : 'open'];
    const face = ta < .45 ? 'embarrassed' : 'xd', sq = pull * .06 * (1 - go) - go * .04 * (1 - seg(ta, hit, hit + .2));
    const sway = [-(go - pull) * .12 + set * .2, 0];
    const hi = hina(760, 1500, 180, { t: ta, turn: .55, face, sq, lean, armL, armR, sway, look: [.4, .3], prop: { hand: 'L', draw: PROPS.envelope, rot: -75 } });
    if (ta > .84 && ta < hit + .12 && hi.handL) smearLines(hi.handL[0] - 260, hi.handL[1] + 30, hi.handL[0] - 20, hi.handL[1], 90, 'rgba(255,255,255,.95)', 5, 'thr' + beatN(ta));
    const tk = take(ta, 1.25, 1);
    ren(1480, 1500 + tk.dy * 30, 180, { t: ta, turn: -.5, face: ta < 1.2 ? 'deadpan' : 'surprised', sq: tk.sq * .5, look: [-.6, .2], });
    camEnd();
    if (after) petals(t, { n: 22, size: 20, wind: 60, seed: 'B' });
    if (lt < .35) slashWipe(.5 + seg(lt, 0, .35) * .5);
  }
  // ---------------------------------------------------------------- C: Ren's reaction close-up
  function shotC(t, lt, dur) {
    setTOD('day');
    const ta = onTwos(lt), dz = dramaticZoom(lt, 0, .12, 16);
    const cam = { x: 1100 + dz.dx, y: 380 + dz.dy, zoom: 1.7 * dz.zoom };
    SET.street(cam, t, {});
    camEnd();
    blurBand(0, H, { blur: 5, n: 0 });
    G.save(); G.fillStyle = 'rgba(255,236,242,.25)'; G.fillRect(0, 0, W, H); G.restore();
    G.save(); G.translate(W / 2 + dz.dx, H / 2 + dz.dy); G.scale(dz.zoom, dz.zoom); G.translate(-W / 2, -H / 2);
    const f = faceAt(ta, [[0, 'surprised'], [1.25, 'embarrassed'], [2.05, 'smile']]);
    const tk = take(ta, .05, .8);
    bust(DESIGNS.ren, 1000, 470 + tk.dy * 20, 560, { t: ta, turn: -.22, face: f.face, sq: tk.sq * .4 + f.sq, blink: f.blink ?? autoBlink(ta, 4),
      look: f.face === 'smile' ? [-.35, .05] : f.face === 'embarrassed' ? [.5, .4] : [-.3, 0], sway: [.02 * Math.sin(t * 1.3), 0], blush: f.face === 'smile' ? .55 : undefined });
    if (f.face === 'smile') sparkles(t, 1000, 400, 560, 9, 'renC', .72);
    G.restore();
    petals(t, { n: 16, size: 34, wind: 80, seed: 'C', speed: 1.4 });
    impactFrame(lt < 3 / 24 ? 1 : 0, 'invert', { x: 1000, y: 430, t });
    if (lt > dur - .5) irisWipe(seg(lt, dur - .5, dur) * .5, 1000, 450, { shape: 'star', col: '#2a2440' });
  }
  shots([[0, shotA], [3.4, shotB], [6.4, shotC]]);
  window.overlayHook = (c, t) => {
    const line = (a, b, txt) => { if (t >= a && t < b) subtitle(c, txt, { alpha: clamp(Math.min((t - a) / .12, (b - t) / .12)) }); };
    line(4.35, 6.3, '請、請收下這個！');
    line(8.6, 9.7, '……謝謝。');
  };
  window.EXTRA_FONTS.push(['800 58px "M PLUS Rounded 1c"', '請、請收下這個！……謝謝。'], ['900 58px "Noto Sans TC"', '請、請收下這個！……謝謝。']);
})();
