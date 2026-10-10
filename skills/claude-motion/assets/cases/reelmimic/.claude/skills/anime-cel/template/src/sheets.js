// sheets.js — model sheets as LOOPS (render with --loop=<name>): faces_hina, faces_ren, turns, bodies, hands, fx.
//   node render.mjs --loop=faces_hina --sheet=0 --cols=1 --w=1920 --out=out/check/faces_hina.jpg
(() => {
  const paper = () => { G.fillStyle = '#f4f1f8'; G.fillRect(0, 0, W, H); };
  const cellClip = (x, y, w, h, fn) => { G.save(); G.beginPath(); G.rect(x, y, w, h); G.clip(); G.fillStyle = '#e9e4f2'; G.fillRect(x + 4, y + 4, w - 8, h - 8); fn(); G.restore(); };
  const label = (txt, x, y) => { G.fillStyle = '#4a4560'; G.font = '600 22px system-ui, sans-serif'; G.textAlign = 'center'; G.fillText(txt, x, y); };
  for (const who of ['hina', 'ren']) {
    LOOPS['faces_' + who] = t => {
      paper(); const D = DESIGNS[who], cols = 6, cw = W / cols, ch = H / 4;
      EXPR_NAMES.forEach((name, i) => {
        const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
        cellClip(x, y, cw, ch, () => { bust(D, x + cw / 2, y + ch * .47, 150, { face: name, t: t + i * .37, blink: 1, turn: (i % 3 === 2) ? .35 : 0 }); label(name, x + 70, y + 30); });
      });
    };
    LOOPS['faces_' + who].len = 2;
  }
  LOOPS.turns = t => {
    paper(); const turns = [-1, -.5, 0, .5, 1];
    turns.forEach((tr, i) => { cellClip(i * W / 5, 0, W / 5, H / 2, () => bust(DESIGNS.hina, i * W / 5 + W / 10, H * .26, 200, { turn: tr, face: 'smile', blink: 1, t })); });
    turns.forEach((tr, i) => { cellClip(i * W / 5, H / 2, W / 5, H / 2, () => bust(DESIGNS.ren, i * W / 5 + W / 10, H * .76, 200, { turn: tr, face: 'neutral', blink: 1, t })); });
  };
  LOOPS.turns.len = 2;
  LOOPS.bodies = t => {
    paper(); const u = 150, gy = 1010;
    hina(170, gy, u, { turn: 0, face: 'happy', t, armL: [20, 10, 'open'], armR: [150, 20, 'spread'] });
    hina(470, gy, u, { turn: .5, face: 'smile', t, armR: [40, 70, 'open'], prop: { hand: 'R', draw: PROPS.envelope, rot: 0 } });
    hina(770, gy, u, { turn: 1, face: 'neutral', t, walk: frac(t) });
    ren(1130, gy, u * .95, { turn: 0, face: 'neutral', t, armL: [6, 4, 'fist'], armR: [30, 120, 'peace'] });
    ren(1450, gy, u * .95, { turn: -.5, face: 'smug', t, armL: [70, 40, 'point'] });
    ren(1760, gy, u * .95, { turn: -1, face: 'determined', t, run: frac(t * 1.5) });
  };
  LOOPS.bodies.len = 2;
  LOOPS.hands = t => {
    paper(); const shapes = ['open', 'relax', 'fist', 'point', 'peace', 'spread', 'hold', 'grip'];
    shapes.forEach((s, i) => { G.save(); const x = 120 + i * 232; G.translate(x, 250); G.scale(420, 420); _L = LIGHT; drawHand(DESIGNS.hina, [0, 0], 0, 1, s, s === 'hold' ? { draw: PROPS.envelope } : s === 'grip' ? { draw: PROPS.can } : null, 4 / 420, 420); G.restore(); label(s, x, 520); });
    shapes.forEach((s, i) => { G.save(); const x = 120 + i * 232; G.translate(x, 640); G.scale(420, 420); _L = LIGHT; drawHand(DESIGNS.ren, [0, 0], -.3, -1, s, null, 4 / 420, 420); G.restore(); });
  };
  LOOPS.hands.len = 1;
})();
(() => {
  for (const who of ['hina', 'ren']) {
    LOOPS['close_' + who] = t => {
      G.fillStyle = '#eef0f6'; G.fillRect(0, 0, W, H);
      const D = DESIGNS[who], f = window.CLOSE_FACE || 'neutral';
      [0, .5, 1].forEach((tr, i) => { G.save(); G.beginPath(); G.rect(i * 640, 0, 640, H); G.clip(); bust(D, i * 640 + 320, 430, 520, { turn: tr, face: f, blink: 1, t }); G.restore(); });
    };
    LOOPS['close_' + who].len = 2;
  }
})();
(() => {
  // sets × time of day, and the effects library
  const panel = (i, fn) => { G.save(); const x = (i % 2) * W / 2, y = Math.floor(i / 2) * H / 2; G.translate(x, y); G.scale(.5, .5); G.beginPath(); G.rect(0, 0, W, H); G.clip(); fn(); if (CAM) camEnd(); G.restore(); };
  LOOPS.sets = t => {
    panel(0, () => { setTOD('morning'); SET.street({ x: 960, y: 540, zoom: 1 }, t); camEnd(); });
    panel(1, () => { setTOD('day'); SET.classroom({ x: 960, y: 540, zoom: 1 }, t); hina(900, 1000, 110, { t, turn: .3, face: 'smile', armR: [30, 110, 'hold'], prop: { hand: 'R', draw: PROPS.book, rot: 90 } }); camEnd(); });
    panel(2, () => { setTOD('evening'); SET.rooftop({ x: 960, y: 540, zoom: 1 }, t, { sun: [1500, 640] }); ren(900, 1000, 110, { t, turn: .5, face: 'smile' }); camEnd(); });
    panel(3, () => { setTOD('night'); SET.street({ x: 960, y: 540, zoom: 1 }, t); hina(700, 980, 110, { t, turn: .6, face: 'surprised' }); camEnd(); });
    setTOD('day');
  };
  LOOPS.sets.len = 2;
  LOOPS.fx = t => {
    panel(0, () => { G.fillStyle = '#20264a'; G.fillRect(0, 0, W, H); speedLines(t, 0, { n: 70 }); hina(960, 1010, 130, { t, turn: 1, run: frac(t * 1.6), face: 'determined' }); });
    panel(1, () => { setTOD('day'); SET.street({ x: 960, y: 540, zoom: 1 }, t); hina(960, 960, 130, { t, turn: 0, face: 'love' }); camEnd(); blurBand(300, 480, { t }); });
    panel(2, () => { G.fillStyle = '#ffe7ef'; G.fillRect(0, 0, W, H); ren(960, 1300, 200, { t, face: 'rage' }); impactFrame(1, 'red', { x: 960, y: 400, t }); });
    panel(3, () => { G.fillStyle = '#fbe9f0'; G.fillRect(0, 0, W, H); petals(t, { n: 60, size: 20 }); sparkles(t, 600, 500, 300, 8, 'a'); smear((x, y) => { heart(x, y, 70, '#ff5a7a', '#4c2830'); }, [300, 800], [1400, 400], 4); smearLines(300, 800, 1300, 440, 80, 'rgba(255,90,122,.8)'); focusLines(t, 1400, 400, { r: 200, n: 60, col: 'rgba(60,40,90,.6)' }); });
  };
  LOOPS.fx.len = 2;
})();

LOOPS.motion = t => {
  G.fillStyle = '#f4f1f8'; G.fillRect(0, 0, W, H); G.fillStyle = '#e2dcea'; G.fillRect(0, 1000, W, 80);
  hina(150, 1000, 130, { t, turn: 0, face: 'smile' }); hina(420, 1000, 130, { t, turn: .55, face: 'smile' });
  ren(700, 1000, 125, { t, turn: 0, face: 'neutral' }); ren(980, 1000, 125, { t, turn: -.55, face: 'neutral' });
  hina(1260, 1000, 130, { t, turn: .8, walk: frac(t), face: 'happy' }); ren(1620, 1000, 125, { t, turn: .8, run: frac(t * 1.4), face: 'determined' });
};
LOOPS.motion.len = 1;
