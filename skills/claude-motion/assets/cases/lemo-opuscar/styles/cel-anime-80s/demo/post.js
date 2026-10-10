// 录像带 + CRT 后期（WebGL2）：透过光辉光 + 晕染 + 调色 → 色度渗色 / 红右移 → 字幕 → 荧光辉光 → 扫描线 + RGB 光栅 + 四角压暗；开机亮线、磁带跟踪噪声
// 输入两张 2D 画布：scene（画面）与 glow（只画发光体：霓虹、车灯、透过光文字）
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p*.5+.5; gl_Position = vec4(p,0,1); }`;
const PRE = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D scene, glow; uniform vec2 px; uniform float thr, sk;
vec3 tap(vec2 q){ vec3 s = texture(scene,q).rgb; float l = dot(s, vec3(.3,.55,.15)); return texture(glow,q).rgb + s * smoothstep(thr, thr+.25, l) * sk; }
void main(){ vec3 c = tap(uv) * .4 + (tap(uv+px*vec2(1,1)) + tap(uv+px*vec2(-1,1)) + tap(uv+px*vec2(1,-1)) + tap(uv+px*vec2(-1,-1))) * .15; o = vec4(c,1); }`;
const DOWN = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D src; uniform vec2 px;
void main(){ vec3 c = texture(src,uv).rgb*.25 + (texture(src,uv+px*vec2(1,1)).rgb + texture(src,uv+px*vec2(-1,1)).rgb + texture(src,uv+px*vec2(1,-1)).rgb + texture(src,uv+px*vec2(-1,-1)).rgb)*.1875; o = vec4(c,1); }`;
const BLUR = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D src; uniform vec2 dir;
void main(){ float w[5] = float[](.2270270270, .1945945946, .1216216216, .0540540541, .0162162162);
  vec3 c = texture(src,uv).rgb*w[0]; for(int i=1;i<5;i++){ c += (texture(src,uv+dir*float(i)*1.5).rgb + texture(src,uv-dir*float(i)*1.5).rgb)*w[i]; } o = vec4(c,1); }`;
const COMP = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D scene, b1, b2, b3, b4, subs; uniform vec2 res; uniform float frame, bloom, halo, soft, sat, lift, contrast, flick, expo, fade;
uniform float scan, grille, bleed, rshift, glow, corner, noiseA, power, track, hasSubs;
uniform vec3 tint, shadowTint;
float h1(float n){ return fract(sin(n*127.1+311.7)*43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
vec3 rgb2yc(vec3 c){ float Y = dot(c, vec3(.299,.587,.114)); return vec3(Y, (c.b-Y)*.564, (c.r-Y)*.713); }
vec3 yc2rgb(vec3 y){ return vec3(y.x+1.403*y.z, y.x-.344*y.y-.714*y.z, y.x+1.773*y.y); }
// 录像带信号：亮度清晰，色度水平糊开（NTSC/VHS 的色度带宽只有亮度的几分之一），红色略右移
vec3 samp(vec2 q){
  vec2 s = 1.0/res;
  vec3 c0 = texture(scene, q).rgb;
  vec3 bl = (texture(scene,q+s*vec2(1,0)).rgb + texture(scene,q-s*vec2(1,0)).rgb + texture(scene,q+s*vec2(0,1)).rgb + texture(scene,q-s*vec2(0,1)).rgb)*.25;
  float Y = rgb2yc(mix(c0, bl, soft)).x;
  float cb = 0.0, cr = 0.0; float n = 0.0;
  for (int i = -4; i <= 4; i++) { float fi = float(i); if (abs(fi) > bleed*.5) continue;
    cb += rgb2yc(texture(scene, q + s*vec2(fi, 0)).rgb).y;
    cr += rgb2yc(texture(scene, q + s*vec2(fi - rshift, 0)).rgb).z; n += 1.0; }
  return yc2rgb(vec3(Y, cb/n, cr/n));
}
void main(){
  vec2 q = uv;
  // CRT 开机：先是一个亮点横向拉成一条线，再纵向展开
  float pw = power, sy = 1.0, sx = 1.0, boost = 0.0;
  if (pw < 1.0) { sx = smoothstep(0.0, .3, pw); sy = max(.003, smoothstep(.3, 1.0, pw)); boost = pow(1.0-sy, 3.0); }
  q = vec2(.5 + (q.x-.5)/max(sx,.001), .5 + (q.y-.5)/sy);
  // 磁带跟踪噪声：逐行横向撕裂 + 一条滚动噪声带 + 底部磁头切换条
  float band = 0.0;
  if (track > 0.0) {
    float by = fract(h1(floor(frame)) * .7 + .15);
    band = smoothstep(.07, .0, abs(uv.y - by)) ;
    float line = floor(uv.y * res.y / 2.0);
    q.x += (h1(line*.13 + frame*7.1) - .5) * .012 * track * (1.0 + band * 5.0);
    q.x += band * track * .03 * sin(frame * 3.0);
    q.y += (h1(frame*1.3) - .5) * .012 * track;
    if (uv.y < .05) q.x += .03 * track * (h1(floor(uv.y*res.y) + frame) - .3);
  }
  vec3 c = samp(q) * expo;
  vec3 B = texture(b1,q).rgb*.55 + texture(b2,q).rgb*.6 + texture(b3,q).rgb*.5 + texture(b4,q).rgb*.4;
  vec3 Hh = (texture(b3,q).rgb + texture(b4,q).rgb*1.3) * vec3(1.0,.32,.16);
  c += B * bloom + Hh * halo;
  c = clamp(c, 0.0, 1.0);
  float l = dot(c, vec3(.299,.587,.114));
  c = clamp(mix(vec3(l), c, sat), 0.0, 1.0);
  c = mix(c, c*c*(3.0-2.0*c), contrast);
  c = c * tint;
  c = c*(1.0-lift) + lift*shadowTint;
  c = mix(c, vec3(dot(c,vec3(.33))), fade);
  // 字幕：录在带子上的一部分，所以也吃扫描线和光栅（但不吃调色）
  if (hasSubs > 0.5) { vec4 sb = texture(subs, q); c = mix(c, sb.rgb, sb.a); }
  // 荧光辉光（亮处向周围溢出）
  vec3 gb = texture(b1,q).rgb*.6 + texture(b2,q).rgb*.4;
  c += glow * max(gb - .15, 0.0);
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) c = vec3(0);
  // 信号噪声 + 跟踪噪声带
  vec2 P = uv*res;
  c += (h2(P + frame*17.0) - .5) * noiseA;
  if (track > 0.0) { float nz = h2(vec2(floor(P.x/3.0), floor(P.y/2.0)) + frame*31.0); c = mix(c, vec3(nz), band * .75 * track); c = mix(c, vec3(dot(c, vec3(.33))), band*.5*track); }
  // 扫描线：3px 周期，亮处暗缝变窄
  float L = dot(clamp(c,0.,1.), vec3(.3,.59,.11));
  float ph = .5 - .5*cos(6.2831853 * (P.y) / 3.0);
  c *= 1.0 - scan * ph * (1.0 - .6*L);
  // 光栅：RGB 竖条
  int gx = int(mod(floor(P.x), 3.0));
  vec3 m = vec3(1.0 - grille); if (gx == 0) m.r = 1.0 + grille*2.0; else if (gx == 1) m.g = 1.0 + grille*2.0; else m.b = 1.0 + grille*2.0;
  c *= m;
  // 四角压暗（不做曲面黑边）
  vec2 u2 = (uv - .5) * 2.0;
  c *= 1.0 - corner * (u2.x*u2.x*u2.y*u2.y*2.0 + .25*(u2.x*u2.x + u2.y*u2.y));
  c *= 1.0 + (h1(frame*.73)-.5)*flick;
  c = c * (1.0 + boost * 1.5) + boost * vec3(.85, .9, 1.0) * smoothstep(.006, 0.0, abs(uv.y-.5)) * step(abs(uv.x-.5), sx*.5);
  o = vec4(clamp(c,0.,1.),1);
}`;

export function makePost(cv) {
  const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false });
  const W = cv.width, H = cv.height;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const prog = fs => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  const P = { pre: prog(PRE), down: prog(DOWN), blur: prog(BLUR), comp: prog(COMP) };
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const tex = (w, h) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
  const fbo = (w, h) => { const t = tex(w, h), f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f, w, h }; };
  const tScene = tex(W, H), tGlow = tex(W, H), tSubs = tex(W, H);
  const L = [2, 4, 8, 16].map(d => ({ a: fbo(Math.ceil(W / d), Math.ceil(H / d)), b: fbo(Math.ceil(W / d), Math.ceil(H / d)) }));
  const U = (p, n) => gl.getUniformLocation(p, n);
  const draw = (target) => { if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h); } else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); } gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  const bindT = (unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); };
  const upload = (t, c) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c); };

  // CRT 克制版 A：扫描线 3px/.18、光栅 .06、色度渗色 7px + 红右移 2px、荧光辉光 .35、四角压暗
  const params = { bloom: .85, halo: .22, thr: .9, sk: .12, soft: .2, sat: 1.05, lift: .04, contrast: .15, flick: .01, expo: 1.06, fade: .03,
    scan: .18, grille: .06, bleed: 7, rshift: 2, glow: .35, corner: .28, noiseA: .018, power: 1, track: 0,
    tint: [1.0, .985, .97], shadowTint: [.16, .08, .22] };

  function render(scene, glow, frame, subs = null, over = {}) {
    const o = Object.assign({}, params, over);
    upload(tScene, scene); upload(tGlow, glow); if (subs) upload(tSubs, subs);
    gl.useProgram(P.pre); bindT(0, tScene); bindT(1, tGlow);
    gl.uniform1i(U(P.pre, 'scene'), 0); gl.uniform1i(U(P.pre, 'glow'), 1); gl.uniform2f(U(P.pre, 'px'), 1 / W, 1 / H);
    gl.uniform1f(U(P.pre, 'thr'), o.thr); gl.uniform1f(U(P.pre, 'sk'), o.sk);
    draw(L[0].a);
    for (let i = 0; i < L.length; i++) {
      const lv = L[i];
      if (i > 0) { gl.useProgram(P.down); bindT(0, L[i - 1].a.t); gl.uniform1i(U(P.down, 'src'), 0); gl.uniform2f(U(P.down, 'px'), 1 / L[i - 1].a.w, 1 / L[i - 1].a.h); draw(lv.a); }
      gl.useProgram(P.blur); gl.uniform1i(U(P.blur, 'src'), 0);
      bindT(0, lv.a.t); gl.uniform2f(U(P.blur, 'dir'), 1 / lv.a.w, 0); draw(lv.b);
      bindT(0, lv.b.t); gl.uniform2f(U(P.blur, 'dir'), 0, 1 / lv.a.h); draw(lv.a);
    }
    const p = P.comp; gl.useProgram(p);
    bindT(0, tScene); for (let i = 0; i < 4; i++) bindT(i + 1, L[i].a.t); bindT(5, tSubs);
    ['scene', 'b1', 'b2', 'b3', 'b4', 'subs'].forEach((n, i) => gl.uniform1i(U(p, n), i));
    gl.uniform2f(U(p, 'res'), W, H); gl.uniform1f(U(p, 'frame'), frame); gl.uniform1f(U(p, 'hasSubs'), subs ? 1 : 0);
    for (const k of ['bloom', 'halo', 'soft', 'sat', 'lift', 'contrast', 'flick', 'expo', 'fade', 'scan', 'grille', 'bleed', 'rshift', 'glow', 'corner', 'noiseA', 'power', 'track']) gl.uniform1f(U(p, k), o[k]);
    gl.uniform3fv(U(p, 'tint'), o.tint); gl.uniform3fv(U(p, 'shadowTint'), o.shadowTint);
    draw(null);
  }
  return { render, params, gl, P };
}
