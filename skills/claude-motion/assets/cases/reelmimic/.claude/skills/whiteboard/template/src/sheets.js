// sheets.js: model sheets as standalone loops (they only run with --loop=<name>):
//   node render.mjs --loop=faces --sheet=0 --cols=1 --w=1920 --out=out/check/faces.jpg     every expression, both characters
//   node render.mjs --loop=poses --sheet=0 --cols=1 --w=1920 --out=out/check/poses.jpg     views, walk, jump, props
//   node render.mjs --loop=kit   --sheet=0 --cols=1 --w=1920 --out=out/check/kit.jpg       icons, strokes, fills, text
(() => {
  const label = (s, x, y, size = 30, col = INK.grey) => { G.save(); G.font = `700 ${size}px ${FONT_HAND}`; G.textAlign = 'center'; G.fillStyle = col; G.fillText(s, x, y); G.restore(); };
  const plain = t => { WB.clock = t; board({ kind: 'white' }); };

  LOOPS.faces = t => {
    plain(t);
    EXPR_NAMES.forEach((name, i) => {
      const cx = 120 + (i % 8) * 240, row = Math.floor(i / 8);
      bo(cx - 30, 330 + row * 520, 17, { face: name, id: 'bo', noBlink: true, t, arm: [[20, 20], [20, 20]] });
      mochi(cx + 62, 330 + row * 520 + 150, 11, { face: name, noBlink: true, t });
      label(name, cx, 395 + row * 520 + 110 - 30);
    });
  };
  LOOPS.faces.len = 2;

  LOOPS.poses = t => {
    plain(t);
    const u = 20;
    bo(170, 470, u, { face: 'happy', view: 0, noBlink: true }); label('front', 170, 530);
    bo(420, 470, u, { face: 'neutral', view: .5, noBlink: true }); label('3/4', 420, 530);
    bo(660, 470, u, { face: 'neutral', view: 1, noBlink: true }); label('side', 660, 530);
    bo(900, 470, u, { face: 'neutral', view: 1, flip: true, noBlink: true }); label('flip', 900, 530);
    [0, .25, .5, .75].forEach((ph, i) => bo(1150 + i * 150, 470, u * .8, { face: 'happy', view: 1, walk: ph, noBlink: true }));
    label('walk cycle', 1370, 530);
    bo(1760, 470, u * .8, { face: 'excited', sq: -.14, dy: -1.8, arm: [[150, 10], [150, 10]], leg: [[20, -40], [20, -40]], noBlink: true }); label('jump', 1760, 530);
    // props in hands
    const props = ['bulb', 'phone', 'coin', 'heart', 'flag', 'balloon', 'book', 'cup', 'star', 'sign'];
    props.forEach((p, i) => { const x = 110 + i * 185; bo(x, 980, 15, { face: 'happy', arm: [[16, 12], [120, 40]], hold: { R: p }, noBlink: true }); label(p, x, 1040); });
    mochi(1780, 740, 16, { face: 'happy', noBlink: true }); mochi(1640, 740, 16, { face: 'love', view: 1, noBlink: true, walk: .3 });
    mochi(1520, 740, 14, { face: 'excited', arm: [[140, 20], [30, -10]], hold: { R: 'fish' }, noBlink: true });
  };
  LOOPS.poses.len = 2;

  LOOPS.kit = t => {
    plain(t);
    const names = Object.keys(ICON);
    names.forEach((n, i) => { const x = 110 + (i % 10) * 180, y = 120 + Math.floor(i / 10) * 210; ink(ICON[n](x, y, 120)); label(n, x, y + 100, 26); });
    const y0 = 560;
    ink([S.arrow(80, y0, 360, y0 - 60), S.circle(520, y0, 90, 60), S.rect(680, y0 - 70, 220, 140), S.box(960, y0 - 80, 260, 130, { tail: [1010, y0 + 110] }), S.bubble(1400, y0 - 20, 150, 90, [1300, y0 + 110]), S.cloud(1700, y0, 150, 90)]);
    ink([hatch(polyCircle(170, 800, 90), { col: INK.blue }), S.circle(170, 800, 90, 90, { col: INK.blue }), scribble(polyRect(330, 720, 200, 160)), S.rect(330, 720, 200, 160), hatch(polyRect(600, 720, 200, 160), { col: INK.red, angle: -40, gap: 14 }), S.rect(600, 720, 200, 160, { col: INK.red })]);
    const b = writeOn('Handwriting 手寫字 ✓', 880, 820, -1, 0, { size: 84, hand: false });
    ink([hilite(b.x, b.y, b.w * .45, b.h), S.underline(b.x, b.y2 + 6, b.w, { col: INK.red, double: true })]);
    writeOn('Kalam + LXGW WenKai TC', 880, 960, -1, 0, { size: 58, col: INK.blue, hand: false });
    ink([S.heart(1800, 800, 90, { col: INK.red }), S.star(1800, 960, 60, { col: INK.orange })]);
  };
  LOOPS.kit.len = 2;
})();
