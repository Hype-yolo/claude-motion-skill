// "Video frame → silent-film drawing" (WebGL2). Also the house style: the film's own tonal paintings go through it too,
// so real footage and animation share one hand.
//   const rd = new Redraw(1440, 1080);
//   const out = rd.render(srcCanvasOrImage, { frame, lines: 1, tone: 1, hatch: 1, levels: 5 });   // → canvas (grey)
// Pipeline: luminance + gentle contrast → separable Gaussian blurs at σ and kσ → XDoG edges (soft tanh threshold) = ink lines
//           → luminance posterised into `levels` wash steps with soft transitions → hatching in the darks (45°, then crossed),
//           hatch pattern re-drawn ("boils") every 2 frames like hand-redrawn animation → paper white highlights.
// Params: sigma (px, 1.1), k (1.6), p (XDoG sharpen, 22), eps (.62), phi (edge softness, 26), lines/tone/hatch (mix 0..1),
//         levels (wash steps), gamma (tone curve), gap (hatch spacing px), lineDark (ink value), paper (white value),
//         src = { x, y, w, h } crop of the source in source pixels (fit to cover), flipX.
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p*.5+.5; gl_Position = vec4(p,0,1); }`;
const HEAD = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform vec2 R; uniform sampler2D T;`;
const FS_LUM = HEAD + `
uniform vec4 crop; uniform vec2 srcSize; uniform float gam, con;
void main(){
  vec2 px = vec2(uv.x, 1.-uv.y) * R;
  vec2 sp = crop.xy + px / R * crop.zw;             // source pixel
  vec3 c = texture(T, sp / srcSize).rgb;
  float L = dot(c, vec3(.30,.59,.11));
  L = pow(clamp(L,0.,1.), gam);
  L = clamp((L - .5) * con + .5, 0., 1.);
  o = vec4(vec3(L), 1.);
}`;
const FS_BLUR = HEAD + `
uniform vec2 dir; uniform float sig;
void main(){
  vec2 st = uv; float s = 0., w = 0.;
  int n = int(ceil(sig*3.));
  for (int i = -12; i <= 12; i++) { if (i < -n || i > n) continue; float x = float(i); float k = exp(-x*x/(2.*sig*sig)); s += texture(T, st + dir*x/R).r * k; w += k; }
  o = vec4(vec3(s/w), 1.);
}`;
const FS_BILAT = HEAD + `
uniform float rs, ss2;
void main(){
  float c = texture(T, uv).r, s = 0., w = 0.;
  for (int j = -3; j <= 3; j++) for (int i = -3; i <= 3; i++) {
    vec2 o2 = vec2(float(i), float(j)) * ss2;
    float v = texture(T, uv + o2 / R).r;
    float k = exp(-dot(o2,o2)/(2.*9.*ss2*ss2) - (v-c)*(v-c)/(2.*rs*rs));
    s += v*k; w += k;
  }
  o = vec4(vec3(s/w), 1.);
}`;
const FS_FINAL = HEAD + `
uniform sampler2D A, B, Lm; uniform float frame, p, eps, phi, uLines, uTone, uHatch, levels, gap, lineDark, paper, seed, washDark, washGam, h1, h2, h3;
float h21(vec2 q){ q = fract(q*vec2(123.34,456.21)); q += dot(q,q+45.32); return fract(q.x*q.y); }
float vn(vec2 q){ vec2 i=floor(q), f=fract(q); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
// one family of hatch lines: angle a, spacing g, darkness-driven width
float hatchLine(vec2 px, float a, float g, float w, float bk){
  vec2 d = vec2(cos(a), sin(a));
  float wob = (vn(px * .02 + bk * 3.7) - .5) * 2.2 + (vn(px*.11 + bk) - .5) * .7;   // hand wobble
  float t = dot(px, vec2(-d.y, d.x)) + wob + bk * 17.31;
  float f = abs(fract(t / g) - .5) * g;                                             // distance to nearest line (px)
  float brk = smoothstep(.18, .3, vn(vec2(dot(px, d) * .035, floor(t / g) * 1.7 + bk)));   // broken strokes
  return (1. - smoothstep(w * .5, w * .5 + .9, f)) * brk;
}
void main(){
  vec2 px = vec2(uv.x, 1.-uv.y) * R;
  float g1 = texture(A, uv).r, g2 = texture(B, uv).r, L = texture(Lm, uv).r;
  // XDoG
  // DoG band-pass: ink on the dark side of every edge (tone-independent, so dark areas are not flooded)
  float Dg = g1 - g2;
  float ink = smoothstep(eps, eps + 1. / phi, -Dg * p);
  float edge = 1. - ink;
  // wash: soft posterisation of the smoothed luminance
  float Ls = mix(L, g1, .6);
  float q = Ls * (levels - 1.);
  float fq = floor(q), fr = q - fq;
  float st = (fq + smoothstep(.3, .7, fr)) / (levels - 1.);
  float wash = mix(Ls, st, uTone);
  wash = mix(washDark, paper, pow(wash, washGam));
  // hatching in the darks, boiling every 2 frames (each frame is "redrawn")
  float bk = floor(frame / 2.);
  float dk = 1. - Ls;
  float h = 0.;
  h = max(h, hatchLine(px, .785, gap, .75 + dk * 1.1, bk) * smoothstep(h1, h1 + .08, dk));
  h = max(h, hatchLine(px, -.785, gap * 1.1, .7 + dk * 1.0, bk + 5.) * smoothstep(h2, h2 + .08, dk));
  h = max(h, hatchLine(px, .12, gap * .85, .7 + dk * .9, bk + 9.) * smoothstep(h3, h3 + .06, dk));
  float c = mix(wash, lineDark, h * uHatch * .88);
  c = mix(c, lineDark, (1. - edge) * uLines);
  o = vec4(vec3(c), 1.);
}`;

export class Redraw {
  constructor(w = 1440, h = 1080) {
    this.w = w; this.h = h;
    this.canvas = document.createElement('canvas'); this.canvas.width = w; this.canvas.height = h;
    const gl = this.gl = this.canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) throw new Error('webgl2 unavailable');
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = fs => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
    this.pLum = prog(FS_LUM); this.pBlur = prog(FS_BLUR); this.pFin = prog(FS_FINAL); this.pBil = prog(FS_BILAT);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    for (const p of [this.pLum, this.pBlur, this.pFin, this.pBil]) { const l = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); }
    const mkTex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    this.src = mkTex();
    this.rt = [0, 1, 2, 3, 4, 5].map(() => { const t = mkTex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, fb }; });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  _pass(prog, target, texs, uni) {
    const gl = this.gl; gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null); gl.viewport(0, 0, this.w, this.h);
    let i = 0; for (const [name, tex] of texs) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(gl.getUniformLocation(prog, name), i); i++; }
    gl.uniform2f(gl.getUniformLocation(prog, 'R'), this.w, this.h);
    for (const k in uni) { const v = uni[k], l = gl.getUniformLocation(prog, k); if (l == null) continue; if (Array.isArray(v)) (v.length === 2 ? gl.uniform2f(l, ...v) : gl.uniform4f(l, ...v)); else gl.uniform1f(l, v); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  render(img, o = {}) {
    const gl = this.gl;
    const sw = img.videoWidth || img.naturalWidth || img.width, shh = img.videoHeight || img.naturalHeight || img.height;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    // crop: cover-fit by default
    let cr = o.src; if (!cr) { const a = this.w / this.h, b = sw / shh; cr = b > a ? { x: (sw - shh * a) / 2, y: 0, w: shh * a, h: shh } : { x: 0, y: (shh - sw / a) / 2, w: sw, h: sw / a }; }
    let [L, A1, A2, B1, B2, L2] = this.rt;
    // texture v=0 is the top row (no flip), so sampling with top-left pixel coords is direct; render targets are bottom-up, handled by uv
    this._pass(this.pLum, L, [['T', this.src]], { crop: [cr.x, cr.y, cr.w, cr.h], srcSize: [sw, shh], gam: o.gamma ?? 1, con: o.contrast ?? 1.08 });
    for (let i = 0; i < (o.bilateral ?? 0); i++) { this._pass(this.pBil, L2, [['T', L.t]], { rs: o.bilRange ?? .09, ss2: o.bilStep ?? 1.3 }); [L, L2] = [L2, L]; }
    const sig = o.sigma ?? 1.1, k = o.k ?? 1.6;
    this._pass(this.pBlur, A1, [['T', L.t]], { dir: [1, 0], sig });
    this._pass(this.pBlur, A2, [['T', A1.t]], { dir: [0, 1], sig });
    this._pass(this.pBlur, B1, [['T', L.t]], { dir: [1, 0], sig: sig * k });
    this._pass(this.pBlur, B2, [['T', B1.t]], { dir: [0, 1], sig: sig * k });
    this._pass(this.pFin, null, [['A', A2.t], ['B', B2.t], ['Lm', L.t]], {
      frame: o.frame ?? 0, p: o.p ?? 14, eps: o.eps ?? .35, phi: o.phi ?? 4, uLines: o.lines ?? 1, uTone: o.tone ?? 1, uHatch: o.hatch ?? 1,
      levels: o.levels ?? 5, gap: o.gap ?? 5.5, lineDark: o.lineDark ?? .07, paper: o.paper ?? .95, seed: o.seed ?? 1,
      washDark: o.washDark ?? .34, washGam: o.washGam ?? .85, h1: o.h1 ?? .42, h2: o.h2 ?? .6, h3: o.h3 ?? .8 });
    return this.canvas;
  }
}
