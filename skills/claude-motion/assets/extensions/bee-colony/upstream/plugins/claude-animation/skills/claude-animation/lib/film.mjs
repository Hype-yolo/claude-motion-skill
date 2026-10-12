// film.mjs — the harness. A film is a pure function frame(ctx, t, i) -> pixels; this file renders it,
// previews it and checks it. Same command line for every film:
//
//   node film.mjs render                    stage -> encode -> publish out/<name>.mp4 (+ render.json)
//   node film.mjs sheet 0,1.2,3.5           one tile per time            -> out/sheet.png
//   node film.mjs strip 5.2 12              12 consecutive frames from 5.2s (fast actions, contacts)
//   node film.mjs verify                    same frame rendered in and out of order must be identical
//
//   import { run, exposure } from "./lib/film.mjs";
//   run({ name: "wm", W: 1080, H: 1080, fps: 24, dur: 10.5, setup(ctx) {...}, frame(ctx, t, i) {...} });
import { createCanvas } from "./core.mjs";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Exposure: which moment the DRAWINGS show at time t. On ones = every frame, on twos = each drawing
// held two frames (the classic hand-drawn cadence), hold = frozen. Camera and root motion can stay on
// ones while the drawing steps on twos: pass exposure(t) only to the drawing code.
//   const drawT = exposure(t, [{ at: 0, on: 2 }, { at: 4.5, on: 1 }, { at: 8, hold: true }], 24);
export function exposure(t, track, fps) {
  let cur = track[0]; for (const e of track) if (t >= e.at) cur = e;
  if (cur.hold) return cur.at;
  const n = cur.on || 1, f = Math.floor((t - cur.at) * fps + 1e-6); return cur.at + Math.floor(f / n) * n / fps;
}

function args() { const [, , mode = "render", a, b] = process.argv; return { mode, a, b }; }

export async function run(F) {
  const { mode, a, b } = args();
  const W = F.W, H = F.H, fps = F.fps || 24, N = Math.round(F.dur * fps), out = path.resolve(F.out || "out");
  fs.mkdirSync(out, { recursive: true });
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  const state = F.setup ? await F.setup(ctx) : {};
  const draw = (t, i) => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    if (!F.alpha) { ctx.fillStyle = F.background || "#F3EEDD"; ctx.fillRect(0, 0, W, H); } else ctx.clearRect(0, 0, W, H);
    F.frame(ctx, t, i, state); ctx.restore(); };
  // motion blur by temporal supersampling, only where a film asks for it (fast flights)
  const acc = F.blur ? new Float64Array(W * H * 4) : null;
  const pixels = (i) => {
    const t = i / fps, S = F.blur ? F.blur(t) || 1 : 1;
    if (S === 1) { draw(t, i); return ctx.getImageData(0, 0, W, H).data; }
    acc.fill(0);
    for (let k = 0; k < S; k++) { draw(t + (k / S - .5) / fps * .9, i); const d = ctx.getImageData(0, 0, W, H).data;
      for (let j = 0; j < d.length; j += 4) { const al = d[j + 3]; if (!al) continue; acc[j] += d[j] * al; acc[j + 1] += d[j + 1] * al; acc[j + 2] += d[j + 2] * al; acc[j + 3] += al; } }
    const o = new Uint8ClampedArray(acc.length);
    for (let j = 0; j < acc.length; j += 4) { const al = acc[j + 3]; if (!al) continue; o[j] = acc[j] / al; o[j + 1] = acc[j + 1] / al; o[j + 2] = acc[j + 2] / al; o[j + 3] = al / S; }
    return o;
  };
  const tile = (times, file, sc = F.sheetScale || .3, cols = Math.min(times.length, 6), under = null) => {
    const rows = Math.ceil(times.length / cols), S = createCanvas(Math.round(W * sc * cols), Math.round(H * sc * rows * (under ? 2 : 1))), sx = S.getContext("2d");
    return { S, sx, put(k, img, row = 0) { const col = k % cols, r = Math.floor(k / cols) * (under ? 2 : 1) + row; sx.drawImage(img, col * W * sc, r * H * sc, W * sc, H * sc); },
      label(k, s) { const col = k % cols, r = Math.floor(k / cols) * (under ? 2 : 1); sx.fillStyle = "rgba(0,0,0,.65)"; sx.fillRect(col * W * sc, r * H * sc, 86, 26); sx.fillStyle = "#fff"; sx.font = "18px sans-serif"; sx.fillText(s, col * W * sc + 6, r * H * sc + 19); },
      save() { fs.writeFileSync(file, S.toBuffer("image/png")); console.log("wrote", file); } };
  };
  const frameCanvas = (i) => { const d = pixels(i), cc = createCanvas(W, H), x = cc.getContext("2d"), im = x.createImageData(W, H); im.data.set(d); x.putImageData(im, 0, 0); return cc; };

  if (mode === "sheet") { const ts = a.split(",").map(Number), T = tile(ts, path.join(out, "sheet.png")); ts.forEach((t, k) => { T.put(k, frameCanvas(Math.round(t * fps))); T.label(k, t.toFixed(2) + "s"); }); T.save(); return; }
  if (mode === "strip") { const t0 = Number(a), n = Number(b || 12), i0 = Math.round(t0 * fps), ts = Array.from({ length: n }, (_, k) => (i0 + k) / fps), T = tile(ts, path.join(out, "strip.png"), .22, Math.min(n, 6));
    ts.forEach((t, k) => { T.put(k, frameCanvas(i0 + k)); T.label(k, "f" + (i0 + k)); }); T.save(); return; }
  if (mode === "verify") {
    const pick = [0, Math.floor(N / 3), Math.floor(N / 2), N - 1, Math.floor(N / 5)], h = (i) => crypto.createHash("md5").update(pixels(i)).digest("hex");
    const fwd = pick.map(h), back = [...pick].reverse().map(h).reverse(), again = pick.map(h);
    const bad = pick.filter((_, k) => fwd[k] !== back[k] || fwd[k] !== again[k]);
    if (bad.length) { console.error("NOT deterministic at frames", bad.join(", "), "- something depends on render order (state kept between frames, Math.random, Date)"); process.exit(1); }
    console.log("ok: frames", pick.join(", "), "identical in and out of order"); return; }

  // render: stage, encode, then publish; a failed encode never replaces a good file
  const stage = path.join(out, ".staging"); fs.mkdirSync(stage, { recursive: true });
  const name = F.name || "film", t0 = Date.now();
  const base = ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(fps), "-i", "-"];
  const outs = F.alpha === "matte"
    ? ["-filter_complex", "[0]split[a][b];[a]format=rgb24,format=yuv420p[c];[b]alphaextract,format=yuv420p[m]", "-map", "[c]", "-c:v", "libx264", "-crf", "14", path.join(stage, name + "-rgb.mp4"), "-map", "[m]", "-c:v", "libx264", "-crf", "11", path.join(stage, name + "-matte.mp4")]
    : F.alpha === "prores" ? ["-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", path.join(stage, name + ".mov")]
    : ["-c:v", "libx264", "-crf", String(F.crf ?? 15), "-preset", "medium", "-pix_fmt", "yuv420p", path.join(stage, name + ".mp4")];
  const ff = spawn("ffmpeg", [...base, ...outs], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < N; i++) { const d = pixels(i); await new Promise((r) => ff.stdin.write(Buffer.from(d.buffer, d.byteOffset, d.byteLength)) ? r() : ff.stdin.once("drain", r));
    if (i % (fps * 5) === 0) process.stdout.write(`  ${(i / fps).toFixed(1)}s\n`); }
  ff.stdin.end(); const code = await new Promise((r) => ff.on("close", r));
  if (code !== 0) { console.error("encode failed; previous outputs left untouched"); process.exit(1); }
  const made = fs.readdirSync(stage); for (const f of made) fs.renameSync(path.join(stage, f), path.join(out, f));
  fs.writeFileSync(path.join(out, name + ".render.json"), JSON.stringify({ name, W, H, fps, dur: F.dur, frames: N, seconds: (Date.now() - t0) / 1000, files: made }, null, 1));
  console.log(`rendered ${N} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${made.join(", ")}`);
}
