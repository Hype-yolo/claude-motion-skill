// 皮影幕布合成（WebGL2）：画面 = 色调映射( 灯光场 × 驴皮透射率 × 布纹 ) + 前景层 + 辉光
// 输入：tr（透射率，白 = 全透）、front（预乘 RGBA 前景：舞台木框、观众、幕后场景、字幕）、可选 lmap（灯光图，r×6 = 亮度）
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p*.5+.5; gl_Position = vec4(p,0,1); }`;
const SCREEN = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D tr, front, lmap; uniform vec2 res; uniform vec3 cam; uniform vec4 rect;
uniform vec4 lamps[10]; uniform float sigB, sigC, amb, expo, haze, time, useMap, cloth, fade, frontOnly, mir;
uniform vec3 lcol, hotcol, fadeCol;
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.0; for (int i=0;i<4;i++){ s += a*vn(p); p *= 2.03; a *= .5; } return s; }
void main(){
  vec2 px = vec2(uv.x, 1.0-uv.y) * res;                 // 视口像素（y 向下）
  vec2 s = cam.xy + (px - res*.5) / cam.z * vec2(mir, 1.0);   // 幕布坐标（mir = -1：从幕后看）
  vec4 F = texture(front, uv);
  if (frontOnly > .5) { o = vec4(mix(F.rgb, fadeCol, fade), 1); return; }
  // 热浪：向上漂的扭曲
  vec2 hz = vec2(vn(s*.018 + vec2(0.0, time*2.6)) - .5, vn(s*.021 + vec2(5.0, time*3.1)) - .5) * haze;
  vec3 T = texture(tr, uv + hz / res * cam.z).rgb * (1.0 - fade * 0.0);
  // 灯光场
  vec3 L;
  if (useMap > .5) { L = texture(lmap, uv).rgb * 6.0 * lcol; }
  else {
    float Ls = 0.0, Lh = 0.0, tot = 0.0;
    for (int k=0;k<10;k++){ vec4 lp = lamps[k]; if (lp.z <= 0.0) continue; vec2 d = s - lp.xy; float r2 = dot(d,d);
      Ls += lp.z * exp(-r2/(2.0*sigB*sigB)); Lh += lp.z * lp.w * exp(-r2/(2.0*sigC*sigC)); tot += lp.z; }
    L = (Ls + amb*tot) * lcol + Lh * hotcol;
  }
  // 布纹：细经纬 + 纤维噪点 + 大尺度疏密
  float th = .5 + .5*sin(s.x*2.6 + vn(s*.35)*2.0) * sin(s.y*2.6 + vn(s.yx*.35)*2.0);
  float cl = 1.0 - cloth*(.05*th + .05*vn(s*1.7) + .09*(fbm(s*.0045) - .5) + .03*(h2(floor(s*1.3)) - .5));
  float ed = smoothstep(0.0, 70.0, s.x-rect.x) * smoothstep(0.0, 70.0, rect.z-s.x) * smoothstep(0.0, 60.0, s.y-rect.y) * smoothstep(0.0, 60.0, rect.w-s.y);
  float inside = step(rect.x, s.x) * step(s.x, rect.z) * step(rect.y, s.y) * step(s.y, rect.w);
  vec3 hdr = L * T * cl * (.62 + .38*ed) * expo;
  vec3 c = 1.0 - exp(-hdr);
  c *= inside;
  c = F.rgb + c * (1.0 - F.a);
  c = mix(c, fadeCol, fade);
  o = vec4(c, 1);
}`;
const DOWN = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D src; uniform vec2 px; uniform float thr;
vec3 t(vec2 q){ vec3 c = texture(src,q).rgb; float l = dot(c, vec3(.3,.55,.15)); return c * smoothstep(thr, thr+.2, l); }
void main(){ o = vec4(t(uv)*.25 + (t(uv+px*vec2(1,1)) + t(uv+px*vec2(-1,1)) + t(uv+px*vec2(1,-1)) + t(uv+px*vec2(-1,-1)))*.1875, 1); }`;
const BLUR = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D src; uniform vec2 dir;
void main(){ float w[5] = float[](.2270270270, .1945945946, .1216216216, .0540540541, .0162162162);
  vec3 c = texture(src,uv).rgb*w[0]; for(int i=1;i<5;i++){ c += (texture(src,uv+dir*float(i)*1.5).rgb + texture(src,uv-dir*float(i)*1.5).rgb)*w[i]; } o = vec4(c,1); }`;
const COMP = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D scene, b1, b2, b3; uniform float bloom, vign, sat, contrast; uniform vec3 bcol, tint;
void main(){
  vec3 c = texture(scene, uv).rgb;
  vec3 B = texture(b1,uv).rgb*.5 + texture(b2,uv).rgb*.7 + texture(b3,uv).rgb*.8;
  c += B * bloom * bcol;
  c = clamp(c, 0.0, 1.0);
  float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
  c = mix(c, c*c*(3.0-2.0*c), contrast);
  c *= tint;
  vec2 d = uv - .5; float vv = vign * smoothstep(.25, .95, dot(d*vec2(1.25, 1.0), d*vec2(1.25, 1.0))*2.2); c *= mix(vec3(1.0), vec3(.7, .47, .25), vv);
  o = vec4(clamp(c, 0.0, 1.0), 1);
}`;
export function makeGL(cv) {
  const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
  const W = cv.width, H = cv.height;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const prog = fs => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  const P = { screen: prog(SCREEN), down: prog(DOWN), blur: prog(BLUR), comp: prog(COMP) };
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const tex = (w, h) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); return t; };
  const fbo = (w, h) => { const t = tex(w, h), f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f, w, h }; };
  const T = { tr: tex(), front: tex(), lmap: tex() };
  const A = fbo(W, H), D = [fbo(W / 2, H / 2), fbo(W / 4, H / 4), fbo(W / 8, H / 8)], Dt = [fbo(W / 2, H / 2), fbo(W / 4, H / 4), fbo(W / 8, H / 8)];
  const up = (t, c, premul) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premul); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); };
  const U = (p, n) => gl.getUniformLocation(p, n);
  const bindT = (p, name, t, unit) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(U(p, name), unit); };
  const draw = (f) => { gl.bindFramebuffer(gl.FRAMEBUFFER, f ? f.f : null); gl.viewport(0, 0, f ? f.w : W, f ? f.h : H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  // o: {cam:[cx,cy,z], rect, lamps:[[x,y,I,core]..], sigB, sigC, amb, expo, haze, time, lcol, hotcol, cloth, fade, frontOnly, bloom, thr, vign, sat, contrast, bcol, tint}
  function render(tr, front, o, lmap) {
    up(T.tr, tr, false); up(T.front, front, true); if (lmap) up(T.lmap, lmap, false);
    let p = P.screen; gl.useProgram(p);
    bindT(p, 'tr', T.tr, 0); bindT(p, 'front', T.front, 1); bindT(p, 'lmap', T.lmap, 2);
    gl.uniform2f(U(p, 'res'), W, H); gl.uniform3f(U(p, 'cam'), ...(o.cam || [960, 540, 1])); gl.uniform4f(U(p, 'rect'), ...(o.rect || [0, 0, 1920, 1080]));
    const lv = new Float32Array(40); (o.lamps || []).slice(0, 10).forEach((l, i) => lv.set([l[0], l[1], l[2], l[3] ?? 1], i * 4));
    gl.uniform4fv(U(p, 'lamps'), lv);
    const f1 = (n, v) => gl.uniform1f(U(p, n), v);
    f1('sigB', o.sigB ?? 650); f1('sigC', o.sigC ?? 110); f1('amb', o.amb ?? .35); f1('expo', o.expo ?? 2.2); f1('haze', o.haze ?? 0); f1('time', o.time ?? 0);
    f1('mir', o.mir ?? 1); f1('useMap', lmap ? 1 : 0); f1('cloth', o.cloth ?? 1); f1('fade', o.fade ?? 0); f1('frontOnly', o.frontOnly ? 1 : 0);
    gl.uniform3f(U(p, 'lcol'), ...(o.lcol || [1, .77, .46])); gl.uniform3f(U(p, 'hotcol'), ...(o.hotcol || [1, .9, .62])); gl.uniform3f(U(p, 'fadeCol'), ...(o.fadeCol || [0, 0, 0]));
    draw(A);
    // 辉光
    let src = A.t;
    for (let i = 0; i < 3; i++) {
      p = P.down; gl.useProgram(p); bindT(p, 'src', src, 0); gl.uniform2f(U(p, 'px'), 1 / D[i].w, 1 / D[i].h); gl.uniform1f(U(p, 'thr'), i === 0 ? (o.thr ?? .72) : 0); draw(D[i]);
      p = P.blur; gl.useProgram(p); bindT(p, 'src', D[i].t, 0); gl.uniform2f(U(p, 'dir'), 1 / D[i].w, 0); draw(Dt[i]);
      bindT(p, 'src', Dt[i].t, 0); gl.uniform2f(U(p, 'dir'), 0, 1 / D[i].h); draw(D[i]);
      src = D[i].t;
    }
    p = P.comp; gl.useProgram(p);
    bindT(p, 'scene', A.t, 0); bindT(p, 'b1', D[0].t, 1); bindT(p, 'b2', D[1].t, 2); bindT(p, 'b3', D[2].t, 3);
    const f2 = (n, v) => gl.uniform1f(U(p, n), v);
    f2('bloom', o.bloom ?? .35); f2('vign', o.vign ?? .35); f2('sat', o.sat ?? 1.05); f2('contrast', o.contrast ?? .12);
    gl.uniform3f(U(p, 'bcol'), ...(o.bcol || [1, .82, .6])); gl.uniform3f(U(p, 'tint'), ...(o.tint || [1, 1, 1]));
    draw(null);
  }
  return { render, gl };
}
