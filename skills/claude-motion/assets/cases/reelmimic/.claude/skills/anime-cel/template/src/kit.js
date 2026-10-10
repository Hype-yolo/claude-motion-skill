// kit.js: the shared runtime for ReelMimic's Canvas-2D drawing engines (pixel art, paper cut-out, whiteboard, anime
// cel, crayon storybook). Each engine copies this file into its template unchanged and adds its own drawing library.
//
// The render contract is the same as painted-animation's, so the same render.mjs drives every engine:
//   window.ready = true once fonts and assets are loaded
//   window.renderAt(t, type, q)                → data URL of the frame at time t
//   window.renderSheet(times, cols, w, crop, at) → { url, ms[] } contact sheet (crop = [x,y,w,h] in screen px,
//                                                 at = [x,y,w,h] around a WORLD point, wherever the camera put it)
// Every frame is a pure function of t: frames render in parallel and out of order, so nothing may carry over from one
// frame to the next. Use hash()/rnd() for stable randomness, never Math.random().
//
// An engine plugs in through window.ENGINE = { setup(), begin(t), end(t) } (all optional):
//   setup() → once, async (load images, build textures); begin(t) → before the shot draws (e.g. switch G to a low-res
//   buffer); end(t) → after it (e.g. upscale, add grain). Shots draw with the 2D context G.

const W = 1920, H = 1080, TAU = Math.PI * 2;
const DUR = PROJECT.duration, BPM = PROJECT.bpm || 120, BEAT = 60 / BPM, OFF = PROJECT.offset || 0;
const FPS = PROJECT.fps || 24;

// ---------- math & timing (pure functions of t) ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, x) => a + (b - a) * x;
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeIn = x => Math.pow(clamp(x), 3);
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const backOut = x => { x = clamp(x); const s = 1.9; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const elasticOut = x => { x = clamp(x); return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (TAU / 3)) + 1; };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// seeded stream for one element: const r = rnd('tree' + i); r() → 0..1, the same every frame
function rnd(key) { let h = 2166136261; for (const c of String(key)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); let s = h >>> 0 || 1; return () => (s = Math.imul(s ^ (s >>> 15), 2246822519) >>> 0, s = (s ^ (s >>> 13)) >>> 0, (s % 1000003) / 1000003); }
const seg = (t, a, b) => clamp((t - a) / (b - a));
const frac = x => x - Math.floor(x);
const bpOf = t => (t - OFF) / BEAT;
const beatN = t => Math.floor(bpOf(t));
const pulse = (t, k = 6) => Math.exp(-frac(bpOf(t)) * k);
const wob = (t, f = 1, ph = 0) => Math.sin((t * f + ph) * TAU);
// hold drawings like hand animation: onTwos(t) = 12 drawings/s, onStep(t, 8) = 8/s (stop-motion feel)
const onTwos = t => Math.floor(t * 12 + 1e-6) / 12;
const onStep = (t, n) => Math.floor(t * n + 1e-6) / n;
function kf(t, keys, e = ease) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) {
    const [a, va] = keys[i - 1], [b, vb] = keys[i], k = e((t - a) / (b - a));
    return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], k)) : lerp(va, vb, k);
  }
  return keys[keys.length - 1][1];
}
function mixCol(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = i => Math.round(lerp((pa >> i) & 255, (pb >> i) & 255, clamp(k)));
  return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
}
const shakeXY = (t, amt) => { const f = Math.floor(t * 24); return [(hash(f * 1.7) - .5) * 2 * amt, (hash(f * 2.3 + 9) - .5) * 2 * amt]; };
// motion principles
const spring = (t, t0, k = 6, w = 18) => t < t0 ? 0 : Math.exp(-k * (t - t0)) * Math.sin(w * (t - t0));
const arcPt = (p0, p1, h, k) => [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k) - h * 4 * k * (1 - k)];
function jump(t, t0, t1, h = 3) {   // → { dy (units, up is negative), sq (squash +, stretch -) }
  if (t < t0 - .12) return { dy: 0, sq: 0 };
  if (t < t0) return { dy: 0, sq: .18 * ease(seg(t, t0 - .12, t0)) };
  if (t < t1) { const k = (t - t0) / (t1 - t0); return { dy: -h * 4 * k * (1 - k), sq: -.16 * Math.abs(1 - 2 * k) }; }
  const a = t - t1; return { dy: 0, sq: .22 * Math.exp(-8 * a) * Math.cos(20 * a) };
}
function take(t, t0, amt = 1) {   // surprise take peaking at t0
  if (t < t0 - .1) return { sq: 0, dy: 0 };
  if (t < t0) return { sq: .12 * amt * ease(seg(t, t0 - .1, t0)), dy: 0 };
  const a = t - t0; return { sq: -.26 * amt * Math.exp(-6 * a) * Math.cos(16 * a), dy: -1.2 * amt * Math.exp(-7 * a) * Math.max(0, Math.cos(9 * a)) };
}

// ---------- shots ----------
// shots([[t0, fn], ...]); fn(t, lt, dur) paints the WHOLE frame (background included) with G.
const SHOTS = [], LOOPS = {};
function shots(list) { SHOTS.push(...list); SHOTS.sort((a, b) => a[0] - b[0]); }
function drawWorld(t) {
  if (window.LOOP) return window.LOOP(t);
  if (!SHOTS.length) { G.fillStyle = '#EDE6D8'; G.fillRect(0, 0, W, H); return; }
  let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1][0]) i++;
  const t0 = SHOTS[i][0], end = i + 1 < SHOTS.length ? SHOTS[i + 1][0] : DUR;
  SHOTS[i][1](t, t - t0, end - t0);
  if (CAM) camEnd();
}

// ---------- camera (world → screen) ----------
let CAM = null, LAST_CAM = null;
function camBegin(cx = W / 2, cy = H / 2, zoom = 1, rot = 0) {
  G.save(); G.translate(W / 2, H / 2); G.rotate(rot); G.scale(zoom, zoom); G.translate(-cx, -cy);
  CAM = LAST_CAM = { cx, cy, zoom, rot };
}
function camEnd() { G.restore(); CAM = null; }
function toScreen(x, y, cam = CAM) {
  if (!cam) return [x, y];
  const dx = (x - cam.cx) * cam.zoom, dy = (y - cam.cy) * cam.zoom, c = Math.cos(cam.rot), s = Math.sin(cam.rot);
  return [W / 2 + dx * c - dy * s, H / 2 + dx * s + dy * c];
}

// ---------- canvases & frame ----------
// G: the context shots draw into (an engine may point it at a low-res buffer in begin()). OUT: the visible 1920×1080.
let G = null, OUT = null, OUTC = null, T = 0;
function makeCanvas(w = W, h = H) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
async function renderFrame(t) {
  T = t; CAM = LAST_CAM = null;
  G = OUT; G.setTransform(1, 0, 0, 1, 0, 0); G.globalAlpha = 1; G.globalCompositeOperation = 'source-over';
  G.clearRect(0, 0, W, H);
  if (window.ENGINE && ENGINE.begin) ENGINE.begin(t);
  drawWorld(t);
  if (window.ENGINE && ENGINE.end) ENGINE.end(t);
  OUT.setTransform(1, 0, 0, 1, 0, 0); OUT.globalAlpha = 1; OUT.globalCompositeOperation = 'source-over';
  if (window.overlayHook) window.overlayHook(OUT, t);   // crisp captions / karaoke above everything
}
window.renderAt = async (t, type = 'image/png', q = .92) => { await renderFrame(t); return OUTC.toDataURL(type, q); };
window.renderSheet = async (times, cols = 3, w = 640, crop = null, at = null) => {
  if (at) at = at.map((v) => typeof v === 'string' ? (0, eval)(v) : v);
  const [, , cw, ch] = at || crop || [0, 0, W, H], h = Math.round(w * ch / cw), rows = Math.ceil(times.length / cols), sc = makeCanvas(cols * w, rows * h);
  const c = sc.getContext('2d'), ms = [];
  for (let i = 0; i < times.length; i++) {
    const t0 = performance.now(); await renderFrame(times[i]); ms.push(Math.round(performance.now() - t0));
    const x = (i % cols) * w, y = Math.floor(i / cols) * h;
    const [cx, cy] = at ? toScreen(at[0], at[1], LAST_CAM).map((v, j) => v - (j ? ch : cw) / 2) : crop || [0, 0];
    c.imageSmoothingEnabled = !(window.ENGINE && ENGINE.crisp);
    c.drawImage(OUTC, cx, cy, cw, ch, x, y, w, h);
    c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x, y, 84, 24); c.fillStyle = '#fff'; c.font = '15px sans-serif'; c.fillText(times[i].toFixed(2) + 's', x + 6, y + 17);
  }
  return { url: sc.toDataURL('image/jpeg', .9), ms };
};
window.gpuInfo = () => 'canvas2d';

// ---------- captions (optional) ----------
// A simple, legible caption bar on the overlay: caption(c, text, { y, size, font, fg, bg }). Engines may style their own.
function caption(c, txt, o = {}) {
  const size = o.size || 54, y = o.y || H - 70, font = o.font || `700 ${size}px "Noto Sans TC", "Noto Sans", system-ui, sans-serif`;
  c.save(); c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(txt).width + size * 1.1;
  c.fillStyle = o.bg || 'rgba(20,18,26,.72)'; const r = size * .5;
  c.beginPath(); c.roundRect(W / 2 - w / 2, y - size * .78, w, size * 1.56, r); c.fill();
  c.lineJoin = 'round'; c.lineWidth = size * .14; c.strokeStyle = 'rgba(0,0,0,.55)'; c.strokeText(txt, W / 2, y + 2);
  c.fillStyle = o.fg || '#FFF8EC'; c.fillText(txt, W / 2, y + 2); c.restore();
}

// ---------- boot ----------
async function boot() {
  OUTC = document.getElementById('out'); OUT = OUTC.getContext('2d', { willReadFrequently: false });
  const fonts = [...(window.EXTRA_FONTS || [])].map(([f, txt]) => document.fonts.load(f, txt));
  await Promise.all(fonts);
  if (window.ENGINE && ENGINE.setup) await ENGINE.setup();
  window.ready = true;
  if (!location.search.includes('render')) devUI();
}
function devUI() {
  const s = document.getElementById('scrub'), lab = document.getElementById('tt'); if (!s) return;
  s.max = window.LOOP ? window.LOOP.len : DUR; s.step = 1 / FPS;
  let busy = false, want = null;
  const go = async () => { if (busy) return; busy = true; while (want != null) { const t = want; want = null; const t0 = performance.now(); await renderFrame(t); lab.textContent = `${t.toFixed(2)}s  ·  ${Math.round(performance.now() - t0)} ms/frame`; } busy = false; };
  s.addEventListener('input', () => { want = +s.value; go(); });
  want = +(new URLSearchParams(location.search).get('t') || 0); s.value = want; go();
}
window.addEventListener('load', () => { const q = new URLSearchParams(location.search).get('loop'); if (q && LOOPS[q]) window.LOOP = LOOPS[q]; boot(); });
