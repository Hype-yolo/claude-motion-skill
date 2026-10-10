// Palette-knife impasto renderer (WebGL2).
// Every mark is an instanced "stroke": knife / brush / dab / line.
// Pass 1 paints strokes into two targets at 2x resolution: colour (+coverage) and paint height.
// Pass 2 lights the height field (raking light, wet speculars, canvas weave where paint is thin),
// downsamples to the output and grades.
//
// Stroke layout (F floats per stroke) — see S.* offsets below.

export const F = 20;
export const S = { x: 0, y: 1, ang: 2, len: 3, wid: 4, r: 5, g: 6, b: 7, r2: 8, g2: 9, b2: 10, seed: 11, type: 12, rev: 13, app: 14, alpha: 15, hgt: 16, bend: 17, skew: 18, taper: 19 };
export const KNIFE = 0, BRUSH = 1, DAB = 2, LINE = 3;

const SEGS = 10;   // triangle-strip segments along a stroke (lets strokes bend)

const VS = `#version 300 es
layout(location=0) in vec2 aC;
layout(location=1) in vec4 a0; // x y ang len
layout(location=2) in vec4 a1; // wid r g b
layout(location=3) in vec4 a2; // r2 g2 b2 seed
layout(location=4) in vec4 a3; // type rev app alpha
layout(location=5) in vec4 a4; // hgt bend skew taper
uniform mat3 uM;      // plate local -> scene
uniform vec4 uCam;    // cx cy zoom rot
uniform vec2 uView;   // output W H
uniform float uWidMul;
out vec2 vUV; out vec2 vPx;
flat out vec3 vC1; flat out vec3 vC2; flat out vec4 vP; flat out vec4 vQ;
void main(){
  float u = aC.x, v = aC.y;
  float len = a0.w, wid = a1.x * uWidMul, bend = a4.y, taper = a4.w;
  float ext = min(wid * .35, len * .5) + 1.5;       // room for caps / edge noise
  float el = len + 2. * ext;
  float s = (u - .5) * el;                           // distance along stroke
  vec2 d = vec2(cos(a0.z), sin(a0.z)), n = vec2(-d.y, d.x);
  float k = s / max(len, 1e-3);                      // -0.5..0.5 over the body
  float off = bend * len * (.25 - k * k);
  vec2 tn = normalize(d + n * (-2. * bend * k));
  vec2 nn = vec2(-tn.y, tn.x);
  float margin = 1.3;
  vec2 p = a0.xy + d * s + n * off + nn * v * wid * .5 * margin;
  vec2 sp = (uM * vec3(p, 1.)).xy;
  float sc = uCam.z, cr = cos(uCam.w), sr = sin(uCam.w);
  vec2 q = sp - uCam.xy; q = vec2(cr * q.x - sr * q.y, sr * q.x + cr * q.y) * sc + uView * .5;
  gl_Position = vec4(q / uView * 2. - 1., 0., 1.); gl_Position.y = -gl_Position.y;
  float det = abs(uM[0][0] * uM[1][1] - uM[0][1] * uM[1][0]);
  float pxs = sc * sqrt(det);
  vUV = vec2(s / max(len, 1e-3) + .5, v * margin);
  vPx = vec2(len, wid) * pxs;
  vC1 = a1.yzw; vC2 = a2.xyz;
  vP = vec4(a2.w, a3.x, a3.y, a3.z);   // seed type rev app
  vQ = vec4(a3.w, a4.x, a4.z, taper);  // alpha hgt skew taper
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUV; in vec2 vPx;
flat in vec3 vC1; flat in vec3 vC2; flat in vec4 vP; flat in vec4 vQ;
uniform float uT, uReveal, uAppear, uAppDur, uRevDur, uAlpha, uHgt, uGrey, uWet, uRun;
uniform vec3 uTint;
layout(location=0) out vec4 oC;
layout(location=1) out vec4 oH;
float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(h1(i), h1(i + 1.), f); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + 1.), f.x), f.y); }
vec3 greyOf(vec3 c){ float g = dot(c, vec3(.3, .59, .11)); g = mix(.5, g, .92); return mix(vec3(g) * uTint, c, .05); }
void main(){
  float u = vUV.x, v = vUV.y, seed = vP.x; int type = int(vP.y + .5);
  float L = max(vPx.x, 1.), W = max(vPx.y, 1.);
  float alpha = vQ.x * uAlpha, hgt = vQ.y * uHgt, skew = vQ.z, taper = vQ.w;
  // paint-on (the stroke is laid down along its length)
  float ap = uAppDur <= 0. ? 1. : clamp((uT - uAppear - vP.w) / uAppDur, 0., 1.);
  if (uT < uAppear + vP.w) discard;
  float lay = ap * 1.25;                                    // wet front position along u
  // taper narrows the start of the stroke (wedges, petals)
  float wmul = mix(1. - taper, 1., clamp(u, 0., 1.));
  float av = abs(v) / max(wmul, .05);
  float us = u + skew * v * W / L * .5;                     // slanted knife ends
  float cov = 0., h = 0.; vec3 col = vC1; float mixT = 0.;
  float aa = 1.2;                                           // edge softness in px
  if (type == 0) {                                          // ---- palette knife
    float ew = (n1(us * L / 16. + seed * 17.) - .5) * .16 + (n1(us * L / 5. + seed * 3.) - .5) * .05;
    float side = (1. + ew - av) * W * .5;                   // px to the long edge
    float st = (us - (n1(v * 2.3 + seed * 5.) * .05)) * L;  // px from start edge
    float load = .78 + h1(seed * 9.1) * .5;                 // how far the paint lasts
    float streak = n2(vec2(v * W / 9. + seed * 31., us * L / 110.)) * .7 + n2(vec2(v * W / 4. + seed * 3., us * L / 60.)) * .3;
    float fine = n2(vec2(v * W / 2.2 + seed * 7., us * L / 30.));
    float runout = smoothstep(load - .35, load + .12, us) * uRun;  // paint running out -> broken streaks
    float en = (1. - us) * L + (streak - .5) * W * .5 * uRun;      // px to the end edge
    cov = clamp(side / aa + .5, 0., 1.) * clamp(st / aa + .5, 0., 1.) * clamp(en / aa + .5, 0., 1.);
    cov *= step(runout * .95, streak * .7 + fine * .35);
    mixT = smoothstep(.25, .85, streak * .75 + us * .4) * .9;
    // paint squeezed to one side of the blade + a lip where the knife lifted off
    float sideR = smoothstep(.7, .97, v * sign(h1(seed * 3.3) - .5)) * (1. - smoothstep(.97, 1.08, av)) * .28;
    float lip = smoothstep(load - .25, load, us) * (1. - smoothstep(load, load + .1, us)) * .35;
    float pile = smoothstep(0., .02, us) * (1. - smoothstep(.02, .09, us)) * .22;
    h = .5 + sideR + lip + pile + (streak - .5) * .34 + (fine - .5) * .05 - us * .12;
  } else if (type == 1) {                                   // ---- bristle brush
    float along = (us - .5) * L, hw = W * .5 * wmul;
    float x = max(abs(along) - max(L * .5 - hw, 0.), 0.);
    float dist = length(vec2(x, abs(v) * W * .5 * wmul / max(wmul, .05))) ;
    float br = n2(vec2(v * W / 2.4 + seed * 13., us * L / 90.));
    float br2 = n2(vec2(v * W / 1.1 + seed * 5., us * L / 30.));
    float edge = hw * (.92 + (br - .5) * .18);
    cov = clamp((edge - dist) / aa + .5, 0., 1.);
    float dry = smoothstep(.55, 1.02, us) * (.6 + h1(seed) * .5);
    cov *= step(dry, br * .8 + br2 * .3);
    mixT = smoothstep(.3, .8, br) * .8;
    h = .45 + (br - .5) * .45 + (br2 - .5) * .2 + (1. - smoothstep(0., .12, us)) * .25;
  } else if (type == 2) {                                   // ---- dab (thick blob)
    vec2 q = vec2((us - .5) * L, v * W * .5);
    float r = length(q / vec2(L * .5, W * .5));
    float wob = (n1(atan(q.y, q.x) * 2. + seed * 11.) - .5) * .18;
    cov = clamp((1. + wob - r) * min(L, W) * .5 / aa + .5, 0., 1.);
    float tex = n2(q / 3. + seed * 7.);
    mixT = smoothstep(.2, .9, tex * .6 + (1. - r) * .5);
    h = .55 + smoothstep(.55, .85, r) * (1. - smoothstep(.85, 1.05, r)) * .5 + (tex - .5) * .25;
  } else {                                                  // ---- thin line (rain, hairlines)
    float along = (us - .5) * L;
    float x = max(abs(along) - L * .5, 0.);
    float dist = length(vec2(x, abs(v) * W * .5));
    cov = clamp((W * .5 - dist) / max(aa, W * .35) + .5, 0., 1.) * smoothstep(0., .25, us) * (1. - smoothstep(.7, 1., us) * .7);
    mixT = us;
    h = .25;
  }
  cov *= smoothstep(lay, lay - .08, u);                     // not yet laid
  if (cov * alpha < .004) discard;
  col = mix(vC1, vC2, mixT);
  // grey world -> colour: each stroke is re-laid in colour by a knife sweep along its length
  float rt = uReveal + vP.z;
  float rp = uRevDur <= 0. ? step(rt, uT) : clamp((uT - rt) / uRevDur, 0., 1.);
  float swept = step(u, rp * 1.3 - .15);
  float g = uGrey * (1. - swept);
  col = mix(col, greyOf(col), g);
  float a = cov * alpha;
  oC = vec4(col, a);
  oH = vec4(h * hgt, uWet * (1. - g * .3), 0., a);
}`;

const CVS = `#version 300 es
layout(location=0) in vec2 p; out vec2 vUV;
void main(){ vUV = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;

const CFS = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 o;
uniform sampler2D uC, uH;
uniform vec2 uTex;        // 1 / internal size
uniform vec3 uL;          // light dir (x right, y down, z up)
uniform float uNorm, uAmb, uDif, uSpec, uShin, uAO;
uniform vec3 uGround, uLift, uGain;
uniform float uSat, uExpo, uVig, uContrast, uWeave;
uniform vec3 uLightCol;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float H(vec2 uv){ return texture(uH, uv).r; }
void main(){
  vec2 uv = vUV;
  vec4 c = texture(uC, uv);                 // 2x2 box at exact 2x
  vec2 t = uTex;
  float hl = H(uv - vec2(t.x, 0)), hr = H(uv + vec2(t.x, 0)), hu = H(uv - vec2(0, t.y)), hd = H(uv + vec2(0, t.y));
  float hl2 = H(uv - vec2(3. * t.x, 0)), hr2 = H(uv + vec2(3. * t.x, 0)), hu2 = H(uv - vec2(0, 3. * t.y)), hd2 = H(uv + vec2(0, 3. * t.y));
  vec2 gr = vec2(hr - hl, hd - hu) * .7 + vec2(hr2 - hl2, hd2 - hu2) * .18;
  vec3 N = normalize(vec3(-gr * uNorm, 1.));
  vec3 L = normalize(uL);
  float hc = H(uv);
  float blur = (hl2 + hr2 + hu2 + hd2) * .25;
  float ao = clamp(1. - (blur - hc) * uAO, .55, 1.08);
  float dif = max(dot(N, L), 0.);
  vec3 R = reflect(-L, N);
  float wet = texture(uH, uv).g;
  float sp = pow(max(R.z, 0.), uShin) * uSpec * (.35 + wet);
  // canvas weave where paint is thin
  vec2 px = uv / t;
  float weave = (sin(px.x * .9) * sin(px.y * .9) * .5 + .5) * .5 + h2(floor(px * .5)) * .5;
  vec3 base = mix(uGround * (1. - uWeave + weave * uWeave * 2.), c.rgb, c.a);
  vec3 col = base * (uAmb + uDif * dif) * ao + sp * uLightCol;
  // grade
  col *= uExpo;
  col = (col - .5) * uContrast + .5;
  float g = dot(col, vec3(.3, .59, .11));
  col = mix(vec3(g), col, uSat);
  col = uLift + col * (uGain - uLift);
  vec2 q = vUV - .5; q.x *= 1.78;
  col *= 1. - uVig * smoothstep(.35, 1.1, length(q));
  o = vec4(clamp(col, 0., 1.), 1.);
}`;

const UVS = `#version 300 es
layout(location=0) in vec2 p;
uniform mat3 uM; uniform vec4 uCam; uniform vec2 uView, uSize;
out vec2 vUV; out vec2 vS;
void main(){ vUV = p; vec2 lp = p * uSize; vS = lp; vec2 sp = (uM * vec3(lp, 1.)).xy;
  float cr = cos(uCam.w), sr = sin(uCam.w); vec2 q = sp - uCam.xy; q = vec2(cr * q.x - sr * q.y, sr * q.x + cr * q.y) * uCam.z + uView * .5;
  gl_Position = vec4(q / uView * 2. - 1., 0., 1.); gl_Position.y = -gl_Position.y; }`;
const UFS = `#version 300 es
precision highp float;
in vec2 vUV; in vec2 vS; uniform sampler2D uImg; uniform float uT, uReveal, uGrey, uAlpha; uniform vec3 uTint; uniform vec3 uRevC;
layout(location=0) out vec4 oC; layout(location=1) out vec4 oH;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){ vec4 c = texture(uImg, vUV); if (c.a < .02) discard;
  float rt = uReveal + (uRevC.z > 0. ? length((vS - uRevC.xy) * vec2(1., 1.6)) / uRevC.z : 0.);
  float g = uGrey * (1. - step(rt + .1, uT));
  float l = dot(c.rgb, vec3(.3, .59, .11)); l = mix(.5, l, .92);
  vec3 col = mix(c.rgb, mix(vec3(l) * uTint, c.rgb, .05), g);
  float a = c.a * uAlpha;
  oC = vec4(col, a); oH = vec4(.12 + h2(floor(vS * .7)) * .06, .1, 0., a); }`;

function sh(gl, type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => i + 1 + ': ' + l).join('\n').slice(0, 4000)); return s; }
function prog(gl, vs, fs) { const p = gl.createProgram(); gl.attachShader(p, sh(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); } return { p, u }; }

export const POST_DEFAULT = {
  light: [-.55, -.6, .7], norm: 3.2, amb: .8, dif: .28, spec: .16, shin: 30, ao: 1.2,
  ground: [.46, .4, .33], lift: [0, 0, 0], gain: [1, 1, 1], sat: 1, expo: 1, vig: .22, contrast: 1, weave: .12, lightCol: [1, .97, .9],
};

export class Impasto {
  constructor(canvas, { W = 1920, H = 1080, ss = 2 } = {}) {
    this.W = W; this.H = H; this.ss = ss; this.IW = W * ss; this.IH = H * ss;
    canvas.width = W; canvas.height = H;
    const gl = this.gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false });
    if (!gl) throw new Error('webgl2 unavailable');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float unavailable');
    this.sp = prog(gl, VS, FS); this.cp = prog(gl, CVS, CFS); this.up = prog(gl, UVS, UFS);
    // strip template
    const c = []; for (let i = 0; i <= SEGS; i++) { const u = i / SEGS; c.push(u, -1, u, 1); }
    this.strip = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.strip); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(c), gl.STATIC_DRAW);
    this.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const tex = (ifmt, fmt, type) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, this.IW, this.IH, 0, fmt, type, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    this.tC = tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    this.tH = tex(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
    this.fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tC, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.tH, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo incomplete');
    this.dyn = this.batch(new Float32Array(F * 4096), true);
  }
  // upload a Float32Array of strokes -> batch (VAO)
  batch(data, dynamic = false) {
    const gl = this.gl, vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.strip); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    for (let i = 0; i < 5; i++) { gl.enableVertexAttribArray(1 + i); gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, F * 4, i * 16); gl.vertexAttribDivisor(1 + i, 1); }
    gl.bindVertexArray(null);
    return { vao, buf, count: data.length / F, cap: data.length / F };
  }
  // start a frame
  begin(ground = POST_DEFAULT.ground) {
    const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb); gl.viewport(0, 0, this.IW, this.IH);
    gl.clearBufferfv(gl.COLOR, 0, [ground[0], ground[1], ground[2], 0]);
    gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.sp.p);
    gl.uniform2f(this.sp.u.uView, this.W, this.H);
  }
  // draw a batch. o: {M:[a,b,c,d,e,f] (x'=a x + c y + e, y'=b x + d y + f), cam:{x,y,zoom,rot}, t, reveal, revDur, appear, appDur, alpha, hgt, grey, wet, widMul, n}
  draw(b, o = {}) {
    const gl = this.gl, u = this.sp.u, M = o.M || [1, 0, 0, 1, 0, 0], cam = o.cam || { x: this.W / 2, y: this.H / 2, zoom: 1, rot: 0 };
    gl.uniformMatrix3fv(u.uM, false, [M[0], M[1], 0, M[2], M[3], 0, M[4], M[5], 1]);
    gl.uniform4f(u.uCam, cam.x, cam.y, cam.zoom, cam.rot || 0);
    gl.uniform1f(u.uT, o.t ?? 0); gl.uniform1f(u.uReveal, o.reveal ?? -1e6); gl.uniform1f(u.uRevDur, o.revDur ?? .2);
    gl.uniform1f(u.uAppear, o.appear ?? -1e6); gl.uniform1f(u.uAppDur, o.appDur ?? .15);
    gl.uniform1f(u.uAlpha, o.alpha ?? 1); gl.uniform1f(u.uHgt, o.hgt ?? 1); gl.uniform1f(u.uGrey, o.grey ?? 1); gl.uniform1f(u.uWet, o.wet ?? .3);
    gl.uniform1f(u.uWidMul, o.widMul ?? 1); gl.uniform1f(u.uRun, o.run ?? 1);
    gl.uniform3fv(u.uTint, o.tint || [.96, .99, 1.04]);
    gl.bindVertexArray(b.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (SEGS + 1) * 2, o.n ?? b.count);
  }
  // underpainting: a thin lay-in of the reference image under the strokes (so no canvas peeks between them)
  texture(canvas, blur = 1.5) {
    const gl = this.gl, c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d'); x.filter = `blur(${blur}px)`; x.drawImage(canvas, 0, 0);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  // draw an underpainting texture covering local rect (0,0)-(w,h). o.revC = [x, y, unitsPerSecond] (reveal spreads from a point)
  under(tex, w, h, o = {}) {
    const gl = this.gl, u = this.up.u, M = o.M || [1, 0, 0, 1, 0, 0], cam = o.cam || { x: this.W / 2, y: this.H / 2, zoom: 1, rot: 0 };
    gl.useProgram(this.up.p);
    gl.uniformMatrix3fv(u.uM, false, [M[0], M[1], 0, M[2], M[3], 0, M[4], M[5], 1]);
    gl.uniform4f(u.uCam, cam.x, cam.y, cam.zoom, cam.rot || 0); gl.uniform2f(u.uView, this.W, this.H); gl.uniform2f(u.uSize, w, h);
    gl.uniform1f(u.uT, o.t ?? 0); gl.uniform1f(u.uReveal, o.reveal ?? -1e6); gl.uniform1f(u.uGrey, o.grey ?? 1); gl.uniform1f(u.uAlpha, o.alpha ?? 1);
    gl.uniform3fv(u.uTint, o.tint || [.96, .99, 1.04]); gl.uniform3fv(u.uRevC, o.revC || [0, 0, 0]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u.uImg, 0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad01 || (this.quad01 = (() => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW); return b; })()));
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.useProgram(this.sp.p);
  }
  // draw a transient Float32Array of strokes (uploaded now)
  drawNow(data, o = {}) {
    const n = data.length / F; if (!n) return;
    const gl = this.gl;
    if (n > this.dyn.cap) { this.dyn = this.batch(new Float32Array(F * Math.ceil(n * 1.5)), true); }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dyn.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    this.draw(this.dyn, { ...o, n });
  }
  // light + grade to the screen
  finish(p = {}) {
    p = { ...POST_DEFAULT, ...p };
    const gl = this.gl, u = this.cp.u; gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(this.cp.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tC); gl.uniform1i(u.uC, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tH); gl.uniform1i(u.uH, 1);
    gl.uniform2f(u.uTex, 1 / this.IW, 1 / this.IH);
    gl.uniform3fv(u.uL, p.light); gl.uniform1f(u.uNorm, p.norm); gl.uniform1f(u.uAmb, p.amb); gl.uniform1f(u.uDif, p.dif);
    gl.uniform1f(u.uSpec, p.spec); gl.uniform1f(u.uShin, p.shin); gl.uniform1f(u.uAO, p.ao);
    gl.uniform3fv(u.uGround, p.ground); gl.uniform3fv(u.uLift, p.lift); gl.uniform3fv(u.uGain, p.gain);
    gl.uniform1f(u.uSat, p.sat); gl.uniform1f(u.uExpo, p.expo); gl.uniform1f(u.uVig, p.vig); gl.uniform1f(u.uContrast, p.contrast); gl.uniform1f(u.uWeave, p.weave);
    gl.uniform3fv(u.uLightCol, p.lightCol);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

// ---------- stroke list builder (CPU side) ----------
export class Strokes {
  constructor(cap = 1024) { this.a = new Float32Array(cap * F); this.n = 0; }
  push(o) {
    if ((this.n + 1) * F > this.a.length) { const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b; }
    const a = this.a, i = this.n++ * F;
    const c = o.c || [1, 1, 1], c2 = o.c2 || c;
    a[i] = o.x; a[i + 1] = o.y; a[i + 2] = o.ang || 0; a[i + 3] = o.len; a[i + 4] = o.wid;
    a[i + 5] = c[0]; a[i + 6] = c[1]; a[i + 7] = c[2]; a[i + 8] = c2[0]; a[i + 9] = c2[1]; a[i + 10] = c2[2];
    a[i + 11] = o.seed ?? Math.random() * 100; a[i + 12] = o.type ?? KNIFE; a[i + 13] = o.rev ?? 0; a[i + 14] = o.app ?? 0;
    a[i + 15] = o.alpha ?? 1; a[i + 16] = o.hgt ?? 1; a[i + 17] = o.bend ?? 0; a[i + 18] = o.skew ?? 0; a[i + 19] = o.taper ?? 0;
    return this;
  }
  data() { return this.a.subarray(0, this.n * F); }
  clear() { this.n = 0; return this; }
}

// colour helpers
export const hex = h => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; };
export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
