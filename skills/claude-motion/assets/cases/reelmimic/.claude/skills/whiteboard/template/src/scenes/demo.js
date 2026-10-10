// demo.js: "Got an idea?" (10 s). Bo is drawn on, thinks, a light bulb appears above him; he jumps and grabs it.
// The eraser wipes the board; Bo walks in with the glowing bulb and shares it with sleepy Mochi, who falls in love.
// Shows: establishing camera move, handwriting + underline, drawn-on character, expression takes, anticipation →
// jump → landing squash, a prop picked up and held, eraser transition, walk cycle, captions.
(() => {
  const U = 42;                               // Bo's size in shot A
  const BX = 1340, BY = 940;                  // Bo's feet (world)

  // ---- A: the idea -------------------------------------------------------------------------------------------
  function idea(t, lt, dur) {
    wbBegin(lt, { cam: [[0, [640, 470, 1.12]], [1.1, [690, 478, 1.08]], [2.1, [1170, 560, 1.0]], [dur, [1190, 570, 1.03]]] });

    const title = writeOn('Got an idea?', 300, 470, .15, 1.0, { size: 140, col: INK.blue });
    drawOn(S.underline(title.x, title.y2 + 4, title.w, { col: INK.orange }), 1.05, 1.25);

    // Bo's acting: think → notice the bulb (take) → excited → crouch, jump, grab it at the top → land, laugh
    const m = mood(lt, [[0, 'thinking'], [3.0, 'surprised', .55], [3.35, 'excited'], [4.2, 'laugh', .3]]);
    const J = jump(lt, 3.65, 4.15, 3.8), grab = 3.9;
    const arm = kf(lt, [[3.3, [24, 14, 24, 14]], [3.5, [-12, 30, -12, 30]], [3.65, [-20, 20, -20, 20]], [3.78, [140, 30, 170, 0]], [4.2, [40, 50, 150, 8]], [4.4, [55, 60, 145, 10]]], easeOut);
    const leg = lt > 3.65 && lt < 4.15 ? [[22, -45], [14, -30]] : null;
    const pose = { face: m.face, blink: m.blink, look: lt > 2.8 && lt < grab ? [0, -1] : null, sq: m.sq + J.sq, dy: m.dy + J.dy, arm: [arm.slice(0, 2), arm.slice(2)], leg, emote: lt > 3.3 ? '-' : null };
    // where Bo's right hand will be at the top of the jump: the bulb waits exactly there
    const J2 = jump(grab, 3.65, 4.15, 3.8), apex = bo(BX, BY, U, { strokesOnly: true, dy: J2.dy, sq: J2.sq, arm: [[140, 30], [170, 0]] }).hand.R;
    if (lt < grab) drawOn(PROPS.bulb(apex[0], apex[1], U, 'bo1'), 2.5, 2.9);
    const me = bo(BX, BY, U, { ...pose, draw: [1.3, 2.45], hold: lt >= grab ? { R: 'bulbOn' } : null });
    // hand-drawn "pop" marks around the bulb as he grabs it (they follow his hand)
    const hr = me.hand.R;
    if (lt > grab && lt < grab + .45) ink(S.rays(hr[0], hr[1] - 1.8 * U, 2.6 * U, 3.2 * U, 8, { col: INK.red, key: 'pop' }), { alpha: 1 - seg(lt, grab + .25, grab + .45) });

    camEnd();
    eraseWipe(seg(lt, dur - .75, dur), { rows: 3 });
  }

  // ---- B: share it -------------------------------------------------------------------------------------------
  function share(t, lt, dur) {
    wbBegin(lt, { cam: [[0, [960, 560, 1]], [dur, [1010, 580, 1.07]]] });
    const u = 40, MX = 1330, MY = 930;

    const walk = stroll(lt, .8, 2.1, -300, 720, u);
    const turn = kf(lt, [[2.15, 1], [2.4, .45]]);
    const offer = kf(lt, [[2.15, [70, 25]], [2.55, [100, 5]]], backOut);
    const swing = walk.walk != null ? -26 * Math.sin(walk.walk * TAU) : 10;
    const bm = mood(lt, [[0, 'happy'], [2.45, 'proud', .3]]);
    bo(walk.x, 930, u, { face: bm.face, blink: bm.blink, sq: bm.sq, view: turn, walk: walk.walk, arm: [[swing, 20], offer], hold: { R: (x, y, u, k) => ICON.bulb(x + .5 * u, y - 1.5 * u, 3.3 * u, { key: k + 'bulb', rays: true }) } });

    const mm = mood(lt, [[0, 'sleepy'], [3.15, 'surprised', 1], [3.5, 'love']]);
    const hop = jump(lt, 3.6, 3.9, 1.1);
    mochi(MX, MY, u * .95, { face: mm.face, blink: mm.blink, sq: mm.sq + hop.sq, dy: mm.dy + hop.dy, look: lt > 3.1 ? [-1, 0] : null,
      arm: lt > 3.5 ? [[3, 0], [kf(lt, [[3.5, 3], [3.75, 150]], backOut), 25 + 20 * Math.sin(lt * 14)]] : null, draw: [.1, 1.2] });

    const txt = writeOn('Share it!', 1000, 250, 2.2, 2.8, { size: 140, col: INK.red, align: 'center' });
    drawOn(S.underline(txt.x, txt.y2 + 2, txt.w, { col: INK.blue, double: true }), 2.83, 3.02);
  }

  shots([[0, idea], [5.5, share]]);
  wbCaptions([[.45, 5.1, '每個*好點子*，都從一筆開始'], [5.85, 9.9, '分享出去，*點子會發光*']]);
})();
