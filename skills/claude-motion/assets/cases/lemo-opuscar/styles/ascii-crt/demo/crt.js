// 单色磷光 CRT 后期（WebGL2）。改写自 core/post/crt.js：去掉录像带色度渗色和 RGB 光栅（单色显示器没有荫罩），
// 改成 P3 琥珀磷光的强度 → 颜色映射 + 第二通道（地球蓝）+ 曲面屏桶形畸变 + 圆角屏幕 + 玻璃反光 + 开 / 关机。
// 输入：场景画布 R = 琥珀强度，G = 地球蓝强度（可 >1 的部分靠叠加两次表达，饱和在 1）。
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p*.5+.5; gl_Position = vec4(p,0,1); }`;
const PRE = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D scene; uniform vec2 px;
void main(){ vec3 c = texture(scene,uv).rgb*.4 + (texture(scene,uv+px*vec2(1,1)).rgb + texture(scene,uv+px*vec2(-1,1)).rgb + texture(scene,uv+px*vec2(1,-1)).rgb + texture(scene,uv+px*vec2(-1,-1)).rgb)*.15; o = vec4(c,1); }`;
const DOWN = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D src; uniform vec2 px;
void main(){ vec3 c = texture(src,uv).rgb*.25 + (texture(src,uv+px*vec2(1,1)).rgb + texture(src,uv+px*vec2(-1,1)).rgb + texture(src,uv+px*vec2(1,-1)).rgb + texture(src,uv+px*vec2(-1,-1)).rgb)*.1875; o = vec4(c,1); }`;
const BLUR = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D src; uniform vec2 dir;
void main(){ float w[5] = float[](.2270270270, .1945945946, .1216216216, .0540540541, .0162162162);
  vec3 c = texture(src,uv).rgb*w[0]; for(int i=1;i<5;i++){ c += (texture(src,uv+dir*float(i)*1.5).rgb + texture(src,uv-dir*float(i)*1.5).rgb)*w[i]; } o = vec4(c,1); }`;
const COMP = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D scene, b1, b2, b3, b4; uniform vec2 res;
uniform float frame, curv, zoom, scan, glow, halo, beam, noiseA, flick, power, off, corner, refl, expo, earthSat;
uniform vec3 amber, amberLo, amberHi, earth, glass;
float h1(float n){ return fract(sin(n*127.1+311.7)*43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
vec3 phos(float a){                       // 琥珀磷光：暗处偏橙，过曝处偏白
  vec3 c = mix(amberLo, amber, smoothstep(.0, .55, a)) * a;
  c += amberHi * smoothstep(.62, 1.25, a) * .55;
  return c; }
vec3 phosE(float e){ vec3 c = earth * e; c += vec3(.92,.97,1.0) * smoothstep(.65, 1.3, e) * .45; return c; }
void main(){
  // 曲面屏：桶形畸变
  vec2 cc = (uv - .5) * 2.0;
  vec2 d = cc; d.x *= 1.0 + curv * d.y * d.y * .9; d.y *= 1.0 + curv * 1.25 * d.x * d.x;
  d /= zoom;
  // 开机：亮点 → 横线 → 全屏；关机：全屏 → 横线 → 亮点
  float sx = 1.0, sy = 1.0, boost = 0.0;
  if (power < 1.0) { sx = smoothstep(0.0, .35, power); sy = max(.004, smoothstep(.35, 1.0, power)); boost = pow(1.0 - sy, 3.0) * 1.4; }
  if (off > 0.0) { sy = max(.004, 1.0 - smoothstep(0.0, .45, off)); sx = max(.002, 1.0 - smoothstep(.45, .85, off)); boost = max(boost, pow(1.0 - sy, 2.0) * 1.2); }
  vec2 q = vec2(d.x / max(sx, .001), d.y / sy) * .5 + .5;
  // 电子束：横向一点点糊（扫描方向）
  vec2 s = 1.0 / res;
  vec3 sc = texture(scene, q).rgb * .6 + (texture(scene, q + s*vec2(beam,0)).rgb + texture(scene, q - s*vec2(beam,0)).rgb) * .2;
  float a = sc.r * expo, e = sc.g * expo;
  vec3 B = texture(b1,q).rgb*.5 + texture(b2,q).rgb*.55 + texture(b3,q).rgb*.5 + texture(b4,q).rgb*.45;
  vec3 Hh = texture(b3,q).rgb*.6 + texture(b4,q).rgb;
  vec3 c = phos(a) + phosE(e) * earthSat;
  c += (amber * B.r + earth * B.g) * glow + (amberLo * Hh.r + earth * .8 * Hh.g) * halo;
  // 扫描线：3px 周期，亮处暗缝变窄
  vec2 P = uv * res;
  float L = clamp(max(a, e), 0.0, 1.0);
  float ph = .5 - .5 * cos(6.2831853 * (q.y * res.y) / 3.0);
  c *= 1.0 - scan * ph * (1.0 - .55 * L);
  // 屏幕玻璃底色（未激发的磷光粉不是纯黑）+ 信号噪声 + 高压闪烁
  float inside = 1.0 - smoothstep(-.004, .004, sdRound(d, vec2(1.0), .09));
  vec2 dd = d; float vig = 1.0 - corner * (.35 * dot(dd, dd) + .9 * dd.x*dd.x*dd.y*dd.y);
  c += glass * vig;
  c += (h2(P + frame * 17.0) - .5) * noiseA * (.5 + L);
  c *= 1.0 + (h1(frame * .73) - .5) * flick;
  c *= vig;
  // 玻璃反光：左上一大块很淡的斜向高光 + 屏幕边缘一圈暗
  float r = smoothstep(.9, .0, length(dd - vec2(-.55, .6))) * refl;
  c += vec3(1.0, .93, .85) * r * .03;
  c *= inside;
  // 屏幕外：机身塑料边框，屏幕的辉光打在内沿上
  float edge = sdRound(d, vec2(1.0), .09);
  vec3 bezel = vec3(.018, .015, .013) + (amber * B.r + earth * B.g) * .22 * smoothstep(.12, .0, edge);
  c = mix(bezel, c, inside);
  // 开 / 关机：中心亮线
  c = c * (1.0 + boost) + min(expo, 1.0) * boost * vec3(1.0, .82, .55) * smoothstep(.012, 0.0, abs(uv.y - .5)) * step(abs(uv.x - .5), max(sx, .004) * .5) * inside;
  o = vec4(clamp(c, 0., 1.), 1);
}`;

export function makeCRT(cv) {
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
  const tScene = tex(W, H);
  const L = [2, 4, 8, 16].map(d => ({ a: fbo(Math.ceil(W / d), Math.ceil(H / d)), b: fbo(Math.ceil(W / d), Math.ceil(H / d)) }));
  const U = (p, n) => gl.getUniformLocation(p, n);
  const draw = (target) => { if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h); } else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); } gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  const bindT = (unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); };

  const params = { curv: .045, zoom: 1.0, scan: .3, glow: .55, halo: .22, beam: .8, noiseA: .025, flick: .012, power: 1, off: 0,
    corner: .55, refl: 1, expo: 1, earthSat: 1,
    amber: [1.0, .69, .0], amberLo: [1.0, .40, .02], amberHi: [1.0, .92, .72], earth: [.72, .88, 1.0], glass: [.034, .024, .017] };

  function render(scene, frame, over = {}) {
    const o = Object.assign({}, params, over);
    gl.bindTexture(gl.TEXTURE_2D, tScene); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, scene);
    gl.useProgram(P.pre); bindT(0, tScene); gl.uniform1i(U(P.pre, 'scene'), 0); gl.uniform2f(U(P.pre, 'px'), 1 / W, 1 / H);
    draw(L[0].a);
    for (let i = 0; i < L.length; i++) {
      const lv = L[i];
      if (i > 0) { gl.useProgram(P.down); bindT(0, L[i - 1].a.t); gl.uniform1i(U(P.down, 'src'), 0); gl.uniform2f(U(P.down, 'px'), 1 / L[i - 1].a.w, 1 / L[i - 1].a.h); draw(lv.a); }
      gl.useProgram(P.blur); gl.uniform1i(U(P.blur, 'src'), 0);
      bindT(0, lv.a.t); gl.uniform2f(U(P.blur, 'dir'), 1 / lv.a.w, 0); draw(lv.b);
      bindT(0, lv.b.t); gl.uniform2f(U(P.blur, 'dir'), 0, 1 / lv.a.h); draw(lv.a);
    }
    const p = P.comp; gl.useProgram(p);
    bindT(0, tScene); for (let i = 0; i < 4; i++) bindT(i + 1, L[i].a.t);
    ['scene', 'b1', 'b2', 'b3', 'b4'].forEach((n, i) => gl.uniform1i(U(p, n), i));
    gl.uniform2f(U(p, 'res'), W, H); gl.uniform1f(U(p, 'frame'), frame);
    for (const k of ['curv', 'zoom', 'scan', 'glow', 'halo', 'beam', 'noiseA', 'flick', 'power', 'off', 'corner', 'refl', 'expo', 'earthSat']) {
      if (!Number.isFinite(o[k])) throw new Error('crt param NaN: ' + k);
      gl.uniform1f(U(p, k), o[k]);
    }
    for (const k of ['amber', 'amberLo', 'amberHi', 'earth', 'glass']) gl.uniform3fv(U(p, k), o[k]);
    draw(null);
  }
  return { render, params };
}
