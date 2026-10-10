import { Impasto, Strokes } from './engine/impasto.js';
const q = new URLSearchParams(location.search);
export async function setup(canvas) {
  const E = new Impasto(canvas);
  const name = q.get('scene') || 'wide';
  const grey = +(q.get('grey') || 0), reveal = grey ? 1e6 : -1e6;
  const z = +(q.get('zoom') || 1);
  window.DUR = 1;
  if (name === 'cellmed') {
    const M = await import('./scenes/medium.js'), C = await import('./scenes/cellist.js');
    const bg = M.buildMedium(), cel = C.buildCellist(M.CELL_S);
    const bb = E.batch(bg.strokes.data()), tb = E.texture(bg.ref.ctx.canvas);
    const body = E.batch(cel.body.strokes.data()), head = E.batch(cel.head.strokes.data());
    const tBody = E.texture(cel.body.ref.ctx.canvas), tHead = E.texture(cel.head.ref.ctx.canvas);
    const s = M.CELL_S, [ox, oy] = M.CELL_AT, Mx = [s, 0, 0, s, ox, oy];
    const cam = { x: +(q.get('cx') || 1000), y: +(q.get('cy') || 565), zoom: z };
    const dyn = new Strokes(64);
    return t => {
      E.begin(); const o = { cam, grey, reveal, t };
      E.under(tb, M.MW, M.MH, o); E.draw(bb, o);
      // underpaint of cellist plates: local rect starts at (-ox,-oy) in local units
      const Mu = [s, 0, 0, s, ox - cel.body.ox * s, oy - cel.body.oy * s];
      E.under(tBody, cel.body.ref.w, cel.body.ref.h, { ...o, M: Mu }); E.draw(body, { ...o, M: Mx });
      dyn.clear(); C.bowArm(dyn, +(q.get('p') || .5)); E.drawNow(dyn.data(), { ...o, M: Mx, run: .15 });
      E.under(tHead, cel.head.ref.w, cel.head.ref.h, { ...o, M: Mu }); E.draw(head, { ...o, M: Mx }); dyn.clear(); C.face(dyn, {}); E.drawNow(dyn.data(), { ...o, M: Mx });
      E.finish();
    };
  }
  if (name === 'girlc') {
    const Gm = await import('./scenes/girl.js');
    const S = Gm.buildGirl();
    const bb = E.batch(S.bg.strokes.data()), tb = E.texture(S.bg.ref.ctx.canvas);
    const body = E.batch(S.body.strokes.data()), head = E.batch(S.head.strokes.data());
    const tBody = E.texture(S.body.ref.ctx.canvas), tHead = E.texture(S.head.ref.ctx.canvas);
    const [ox, oy] = Gm.GIRL_AT, Mx = [1, 0, 0, 1, ox, oy], Mu = [1, 0, 0, 1, ox - Gm.GOX, oy - Gm.GOY];
    const cam = { x: +(q.get('cx') || 1000), y: +(q.get('cy') || 1200), zoom: z };
    const dyn = new Strokes(64);
    const P = k => +(q.get(k) || 0);
    return t => {
      E.begin(); const o = { cam, grey, reveal, t };
      E.under(tb, Gm.GW, Gm.GH, o); E.draw(bb, o);
      E.under(tBody, Gm.GRW, Gm.GRH, { ...o, M: Mu }); E.draw(body, { ...o, M: Mx });
      E.under(tHead, Gm.GRW, Gm.GRH, { ...o, M: Mu }); E.draw(head, { ...o, M: Mx });
      dyn.clear(); Gm.girlFace(dyn, { look: P('look'), happy: P('happy') }); Gm.girlArm(dyn, { lift: P('lift'), open: P('open'), colour: P('open') > 0 ? 1 : 0, tilt: P('tilt') });
      E.drawNow(dyn.data(), { ...o, M: Mx, grey: 0, run: 0 });
      E.finish();
    };
  }
  const mod = await import(`./scenes/${name}.js`);
  const S = mod['build' + name[0].toUpperCase() + name.slice(1)]();
  const b = E.batch(S.strokes.data()); const tex = E.texture(S.ref.ctx.canvas);
  const cx = +(q.get('cx') || S.ref.w / 2), cy = +(q.get('cy') || S.ref.h / 2);
  return t => { E.begin(); const cam = { x: cx, y: cy, zoom: z }; E.under(tex, S.ref.w, S.ref.h, { cam, grey, reveal }); E.draw(b, { t, grey, reveal, cam }); E.finish(); };
}
