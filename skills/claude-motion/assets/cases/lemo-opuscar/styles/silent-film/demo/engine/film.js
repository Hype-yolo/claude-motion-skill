// Film-aging post module (WebGL2). Stack it on ANY 2D canvas:
//   const film = new FilmPost(1440, 1080);
//   const out = film.render(srcCanvas, { frame, strength: .6, sepia: .15 }, colorMaskCanvas?);   // → canvas
//   damage(g2d, x, y, w, h, frame, strength)   // dust, hairs and splice marks drawn on top (2D)
// Params (all optional, 0..1 unless noted):
//   strength  master amount of damage (scales flicker, weave, scratches, dust, burn, grain)
//   grain, flicker, weave, scratches, burn, vignette, halation   individual multipliers (default 1)
//   sepia     0 = neutral silver, 1 = full brown-toned print
//   black, white  print density endpoints (default .055 / .93); contrast (S-curve, default 1)
//   jump      px vertical frame jump (splice), exposure (multiplier, default 1)
//   crank     projector speed (1 = normal; >1 makes the flicker faster/stronger — hand-cranked)
// colorMask: optional canvas whose alpha marks pixels that keep their own colour ("the one colour").
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p*.5+.5; gl_Position = vec4(p,0,1); }`;
const FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D T, B, C; uniform vec2 R; uniform float frame, seed;
uniform float uStr, uGrain, uFlick, uScr, uBurn, uVig, uHal, uSepia, uBlack, uWhite, uCon, uExpo, uHasC;
uniform vec2 uWeave;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float h11(float x){ return fract(sin(x*127.1+311.7)*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p*=2.07; a*=.5; } return s; }
float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
void main(){
  vec2 px = vec2(uv.x, 1.-uv.y)*R;                       // pixel coords, top-left origin
  vec2 q = px - uWeave;                                   // gate weave: image moves under the fixed aperture
  vec2 st = q / R;
  // slight optical softness (print of a print)
  vec3 c0 = texture(T, st).rgb;
  vec3 c1 = (texture(T, st+vec2(.7,0)/R).rgb + texture(T, st-vec2(.7,0)/R).rgb + texture(T, st+vec2(0,.7)/R).rgb + texture(T, st-vec2(0,.7)/R).rgb)*.25;
  vec3 col = mix(c0, c1, .45);
  float L = lum(col);
  // halation: highlights bleed
  vec3 bl = texture(B, st).rgb; float Lb = lum(bl);
  L += uHal * .22 * max(0., Lb - .55) * 1.8;
  // exposure + flicker (uExpo already contains per-frame flicker) + uneven density across the frame
  float dens = (fbm(vec2(st.x*1.3, st.y*1.1) + vec2(frame*.021, seed)) - .5) * .09 * uFlick * uStr;
  L = L * uExpo + dens;
  // S-curve contrast
  L = clamp(L, 0., 1.2);
  float s = L*L*(3.-2.*L); L = mix(L, s, clamp(uCon-1., -1., 1.) + .35);
  // print density endpoints
  L = mix(uBlack, uWhite, clamp(L, 0., 1.));
  // vertical scratches (white = emulsion scraped off the print, dark = dirt on the negative)
  float scr = 0.;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float life = floor((frame + fi*17.) / (5. + fi*3.));               // each scratch lives a few frames
    float on = step(1. - uScr*uStr*(.55 - fi*.1), h11(life*3.1 + fi*7.7));
    float x = h11(life*1.7 + fi) * R.x + sin(frame*.37 + fi)*3.;
    float w = .6 + h11(life + fi*2.) * 1.4;
    float d = abs(px.x - x);
    float seg = step(.25, vn(vec2(px.y*.008 + fi*9., life)));           // broken along its length
    float dark = step(.62, h11(life*9.1 + fi));
    scr += on * seg * smoothstep(w, 0., d) * (dark > .5 ? -.55 : .7);
  }
  L += scr;
  // burn / edge fog: uneven brown darkening creeping in from the frame edges
  vec2 e = min(st, 1. - st); float ed = min(e.x*R.x/R.y, e.y);
  float burnN = fbm(st*vec2(3.,2.4) + vec2(seed*.3, frame*.004));
  float burn = smoothstep(.12 + burnN*.1, 0., ed) * uBurn * uStr;
  L *= 1. - burn*.55;
  // vignette
  vec2 cv = st - .5; float vig = dot(cv*vec2(1.,1.15), cv*vec2(1.,1.15));
  L *= 1. - uVig * smoothstep(.10, .62, vig) * .62;
  // silver grain: 2 octaves, coarser in the mids
  float g1 = h21(floor(px/1.25) + vec2(frame*13.1, frame*7.7)) - .5;
  float g2 = vn(px/2.6 + vec2(frame*31.7, frame*11.3)) - .5;
  float gmid = 1. - abs(L - .5)*1.3;
  L += (g1*.08 + g2*.07) * uGrain * (.45 + uStr*.55) * gmid;
  L = clamp(L, 0., 1.);
  // tone: neutral silver → sepia print
  vec3 silver = vec3(L) * vec3(.985, .99, 1.0);
  vec3 sep = mix(vec3(.105,.07,.045), vec3(.62,.50,.37), smoothstep(0., .6, L));
  sep = mix(sep, vec3(.97,.92,.82), smoothstep(.5, 1., L));
  vec3 outc = mix(silver, sep, uSepia);
  outc += vec3(.035,.012,-.01) * burn;                     // burned edges go brown
  // the one colour: keep hue where the mask says so (same grain + exposure)
  if (uHasC > .5) {
    vec4 cm = texture(C, st);
    if (cm.a > .003) {
      vec3 cc = cm.rgb * uExpo;
      cc += (g1*.06 + g2*.05) * uGrain;
      cc *= 1. - uVig * smoothstep(.10, .62, vig) * .62;
      outc = mix(outc, clamp(cc, 0., 1.), cm.a);
    }
  }
  // outside the image (weave exposes the frame line) → black
  float inside = step(0., st.x) * step(st.x, 1.) * step(0., st.y) * step(st.y, 1.);
  o = vec4(outc * inside, 1.);
}`;

export class FilmPost {
  constructor(w = 1440, h = 1080) {
    this.w = w; this.h = h;
    this.canvas = document.createElement('canvas'); this.canvas.width = w; this.canvas.height = h;
    const gl = this.gl = this.canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('webgl2 unavailable');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = this.pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = [0, 1, 2].map(() => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; });
    this.U = {}; for (const n of ['T', 'B', 'C', 'R', 'frame', 'seed', 'uStr', 'uGrain', 'uFlick', 'uScr', 'uBurn', 'uVig', 'uHal', 'uSepia', 'uBlack', 'uWhite', 'uCon', 'uExpo', 'uHasC', 'uWeave']) this.U[n] = gl.getUniformLocation(pr, n);
    this.small = document.createElement('canvas'); this.small.width = Math.round(w / 8); this.small.height = Math.round(h / 8);
    this.sg = this.small.getContext('2d', { willReadFrequently: true });
    this.mean = .5;
  }
  // per-frame random helpers (deterministic)
  static rnd(n) { n = Math.sin(n * 91.3458 + 17.123) * 47453.5453; return n - Math.floor(n); }
  weaveAt(frame, p = {}) {
    const k = (p.strength ?? .6) * (p.weave ?? 1), cr = p.crank ?? 1, r = FilmPost.rnd;
    const f = frame * cr;
    let x = (Math.sin(f * .31) * .6 + Math.sin(f * .113 + 1.3) * .8 + (r(frame) - .5) * .5) * 1.4 * k;
    let y = (Math.sin(f * .23 + .7) * .7 + Math.sin(f * .071 + 2.1) * .9 + (r(frame + 99) - .5) * .6) * 1.6 * k;
    if (r(Math.floor(frame / 2) * 3.7) < .025 * k) y += 4 * k;                       // occasional perforation jump
    return [x, y + (p.jump || 0)];
  }
  flickerAt(frame, p = {}) {
    const k = (p.strength ?? .6) * (p.flicker ?? 1), cr = p.crank ?? 1, r = FilmPost.rnd;
    const f = frame * cr;
    return 1 + ((r(frame) - .5) * .09 + Math.sin(f * 1.9) * .025 * cr + Math.sin(f * .37) * .02) * k;
  }
  render(src, p = {}, colorMask = null) {
    const gl = this.gl, U = this.U, frame = p.frame ?? 0;
    gl.viewport(0, 0, this.w, this.h); gl.useProgram(this.pr);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    this.sg.drawImage(src, 0, 0, this.small.width, this.small.height);
    // mean brightness (for theatre spill light)
    const d = this.sg.getImageData(0, 0, this.small.width, this.small.height).data; let s = 0; for (let i = 0; i < d.length; i += 16) s += d[i]; this.mean = s / (d.length / 16) / 255;
    this.sg.filter = 'blur(2px)'; this.sg.drawImage(this.small, 0, 0); this.sg.filter = 'none';
    const up = (i, img) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.tex[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); };
    up(0, src); up(1, this.small); if (colorMask) up(2, colorMask); else { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.tex[2]); }
    gl.uniform1i(U.T, 0); gl.uniform1i(U.B, 1); gl.uniform1i(U.C, 2);
    gl.uniform2f(U.R, this.w, this.h); gl.uniform1f(U.frame, frame); gl.uniform1f(U.seed, p.seed ?? 3.1);
    const str = p.strength ?? .6;
    gl.uniform1f(U.uStr, str); gl.uniform1f(U.uGrain, p.grain ?? 1); gl.uniform1f(U.uFlick, p.flicker ?? 1);
    gl.uniform1f(U.uScr, p.scratches ?? 1); gl.uniform1f(U.uBurn, p.burn ?? 1); gl.uniform1f(U.uVig, p.vignette ?? 1);
    gl.uniform1f(U.uHal, p.halation ?? 1); gl.uniform1f(U.uSepia, p.sepia ?? .12);
    gl.uniform1f(U.uBlack, p.black ?? .055); gl.uniform1f(U.uWhite, p.white ?? .93); gl.uniform1f(U.uCon, p.contrast ?? 1);
    gl.uniform1f(U.uExpo, (p.exposure ?? 1) * this.flickerAt(frame, p)); gl.uniform1f(U.uHasC, colorMask ? 1 : 0);
    const [wx, wy] = this.weaveAt(frame, p); gl.uniform2f(U.uWeave, wx, wy);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }
}

// dust specks, hairs and the odd blotch, drawn over the processed frame (2D). Deterministic per frame.
export function damage(g, x, y, w, h, frame, strength = .6, o = {}) {
  const r = FilmPost.rnd, k = strength;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const nDust = Math.floor((2 + r(frame * 1.3) * 7) * k * (o.dust ?? 1));
  for (let i = 0; i < nDust; i++) {
    const a = r(frame * 7.1 + i * 3.3), b = r(frame * 3.7 + i * 5.9), c = r(frame * 1.9 + i * 8.1);
    const px = x + a * w, py = y + b * h, rad = .8 + c * c * 3.2;
    const white = r(frame + i * 11.7) < .35;
    g.fillStyle = white ? `rgba(240,232,215,${.55 + c * .4})` : `rgba(12,10,8,${.6 + c * .35})`;
    g.beginPath();
    const m = 5 + Math.floor(c * 4);
    for (let j = 0; j < m; j++) { const an = j / m * Math.PI * 2, rr = rad * (.6 + r(i * 13 + j + frame) * .7); j ? g.lineTo(px + Math.cos(an) * rr, py + Math.sin(an) * rr) : g.moveTo(px + Math.cos(an) * rr, py + Math.sin(an) * rr); }
    g.fill();
  }
  // a hair caught in the gate: stays for ~10 frames, wiggles
  const hairLife = Math.floor(frame / 11);
  if (r(hairLife * 5.3) < .22 * k * (o.hair ?? 1)) {
    const hx = x + r(hairLife * 2.1) * w, hy = y + r(hairLife * 4.7) * h, len = 40 + r(hairLife) * 90;
    g.strokeStyle = 'rgba(10,8,6,.75)'; g.lineWidth = 1.2; g.beginPath();
    for (let j = 0; j <= 20; j++) { const u = j / 20, px = hx + Math.sin(u * 5 + hairLife) * 14 * u + u * len * .6, py = hy + u * len + Math.sin(u * 9 + frame * .3) * 3; j ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  }
  // rare big blotch (cue-mark-like) for a single frame
  if (r(frame * 2.9) < .012 * k * (o.blotch ?? 1)) {
    const bx = x + (.2 + r(frame) * .6) * w, by = y + (.15 + r(frame * 3) * .3) * h;
    g.fillStyle = 'rgba(245,238,222,.5)'; g.beginPath(); g.arc(bx, by, 10 + r(frame * 5) * 18, 0, 7); g.fill();
  }
  g.restore();
}
