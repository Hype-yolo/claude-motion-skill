// Woodcut engine · image / video-frame → woodcut filter
// Luminance decides how wide each white cut is (bright = wide), the structure tensor of the image decides
// which way the cuts run (along the isophotes, i.e. around the forms, like an engraver follows a cheek).
// Returns knife strokes in target space, each with a reveal time, so the frame can be "carved" live.
//
//   const F = woodcutFilter(img, { rect:[x,y,w,h], sp: 6 });   // → { strokes, tone(x,y), dir(x,y) }
//   drawStrokes(maskCtx, F.strokes, { t })                      // mask pre-filled black
import { clamp } from '/core/lib.js';
import { Region, hatch } from './hatch.js';

function boxBlur(A, W, H, r) {
  if (r < 1) return A;
  const B = new Float32Array(W * H), C = new Float32Array(W * H), k = 2 * r + 1;
  for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x <= r; x++) s += A[y * W + clamp(x, 0, W - 1)]; for (let x = 0; x < W; x++) { B[y * W + x] = s / k; s += A[y * W + Math.min(W - 1, x + r + 1)] - A[y * W + Math.max(0, x - r)]; } }
  for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += B[clamp(y, 0, H - 1) * W + x]; for (let y = 0; y < H; y++) { C[y * W + x] = s / k; s += B[Math.min(H - 1, y + r + 1) * W + x] - B[Math.max(0, y - r) * W + x]; } }
  return C;
}
const blur = (A, W, H, r) => boxBlur(boxBlur(A, W, H, r), W, H, r);   // ≈ gaussian

// src: image / canvas / video frame. o: { rect:[x,y,w,h] target, res (px per analysis cell), sp, wmax, lo, hi, gamma,
//   black, white (levels), a0 (fallback angle), tensor (blur radius, cells), coh, seg, gap, kind, seed,
//   reveal: { t0, t1, mode:'light'|'radial'|'down'|fn, cx, cy, speed, jit } }
export function woodcutFilter(src, o = {}) {
  const [rx, ry, rw, rh] = o.rect || [0, 0, 1920, 1080], res = o.res ?? 3;
  const W = Math.max(8, Math.round(rw / res)), H = Math.max(8, Math.round(rh / res));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const q = cv.getContext('2d', { willReadFrequently: true });
  // cover-fit the source into the rect
  const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
  const k = Math.max(W / sw, H / sh), dw = sw * k, dh = sh * k;
  q.drawImage(src, (W - dw) / 2 + (o.shift?.[0] ?? 0) / res, (H - dh) / 2 + (o.shift?.[1] ?? 0) / res, dw, dh);
  const id = q.getImageData(0, 0, W, H).data, Lr = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) Lr[i] = (.2126 * id[4 * i] + .7152 * id[4 * i + 1] + .0722 * id[4 * i + 2]) / 255;
  const L = blur(Lr, W, H, o.pre ?? 1);
  // levels
  const bk = o.black ?? .08, wt = o.white ?? .85, gm = o.gamma ?? 1;
  const T = new Float32Array(W * H); for (let i = 0; i < W * H; i++) T[i] = Math.pow(clamp((L[i] - bk) / (wt - bk)), gm);
  // structure tensor
  const Jxx = new Float32Array(W * H), Jxy = new Float32Array(W * H), Jyy = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, a = L[i - W - 1], b = L[i - W], c = L[i - W + 1], d = L[i - 1], f = L[i + 1], g = L[i + W - 1], h = L[i + W], j = L[i + W + 1];
    const gx = (c + 2 * f + j) - (a + 2 * d + g), gy = (g + 2 * h + j) - (a + 2 * b + c);
    Jxx[i] = gx * gx; Jxy[i] = gx * gy; Jyy[i] = gy * gy;
  }
  const tr = o.tensor ?? 4, bxx = blur(Jxx, W, H, tr), bxy = blur(Jxy, W, H, tr), byy = blur(Jyy, W, H, tr);
  // doubled-angle field (cos2θ, sin2θ) of the isophote direction, blended to a0 where incoherent
  const a0 = o.a0 ?? .45, C2 = new Float32Array(W * H), S2 = new Float32Array(W * H), cohK = o.coh ?? 1;
  let mx = 1e-9; for (let i = 0; i < W * H; i++) mx = Math.max(mx, bxx[i] + byy[i]);
  // (box blurs can leave tiny negative sums in flat areas → clamp before sqrt)
  for (let i = 0; i < W * H; i++) {
    const a = Math.max(0, bxx[i]), b = bxy[i], c = Math.max(0, byy[i]), tr2 = a + c, det = Math.sqrt((a - c) * (a - c) + 4 * b * b);
    const coh = tr2 > 1e-9 ? Math.min(1, det / tr2) : 0, str = clamp(Math.sqrt(tr2 / mx) * 6);
    const th = .5 * Math.atan2(2 * b, a - c) + Math.PI / 2;           // along the edge
    const w = clamp(coh * str * cohK);
    C2[i] = w * Math.cos(2 * th) + (1 - w) * Math.cos(2 * a0); S2[i] = w * Math.sin(2 * th) + (1 - w) * Math.sin(2 * a0);
  }
  const sm = o.smooth ?? 2, C2b = blur(C2, W, H, sm), S2b = blur(S2, W, H, sm);
  const samp = (A, x, y) => { let u = (x - rx) / res - .5, v = (y - ry) / res - .5; u = clamp(u, 0, W - 1.001); v = clamp(v, 0, H - 1.001); const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j; return (A[j * W + i] * (1 - fu) + A[j * W + i + 1] * fu) * (1 - fv) + (A[(j + 1) * W + i] * (1 - fu) + A[(j + 1) * W + i + 1] * fu) * fv; };
  const tone = (x, y) => samp(T, x, y);
  const dir = (x, y) => .5 * Math.atan2(samp(S2b, x, y), samp(C2b, x, y));
  const reg = o.region || new Region([[[rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh]]], { res: 4, pad: 1 });
  let reveal = null;
  if (o.reveal) {
    const r = o.reveal, mode = r.mode || 'light';
    const key = typeof mode === 'function' ? mode
      : mode === 'radial' ? (x, y) => clamp(Math.hypot(x - (r.cx ?? rx + rw / 2), y - (r.cy ?? ry + rh / 2)) / (Math.hypot(rw, rh) * .55))
        : mode === 'down' ? (x, y) => clamp((y - ry) / rh)
          : (x, y) => clamp(1 - tone(x, y)) * .85 + .15 * clamp((y - ry) / rh);   // lights first ("coarse to fine")
    reveal = { t0: r.t0 ?? 0, t1: r.t1 ?? 1, key, speed: r.speed ?? 1200, jit: r.jit ?? .06 };
  }
  const sp = o.sp ?? 6;
  const strokes = hatch(reg, { dir, tone, sp, wmax: o.wmax ?? sp * 1.02, lo: o.lo ?? .12, hi: o.hi ?? 1, gamma: o.lineGamma ?? .9, seg: o.seg || [sp * 5, sp * 22], gap: o.gap || [1, sp * .6], kind: o.kind || 'v', seed: o.seed ?? 3, reveal, step: o.step, dtest: o.dtest ?? .62, jit: o.jit ?? 0, debug: o.debug });
  return { strokes, tone, dir, W, H };
}
