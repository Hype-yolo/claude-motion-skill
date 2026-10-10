// Stained-glass compositor (WebGL2).
//   glass   = tonemap( backlight(x,y,time) * transmittance * glass texture ) + weathering haze * room light
//   surface = albedo * (room ambient + glow spilled from lit lancets + point lights)
//   floor   = procedural flagstones * (room ambient + projected colour patch map)     (perspective or top-down)
//   + additive light shafts, bloom (bright glass eats into the lead = irradiation), grade, vignette, overlay.
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p*.5+.5; gl_Position = vec4(p,0,1); }`;
const MAIN = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D G, S, Rt, Pm;
uniform vec2 res; uniform vec3 cam;
uniform float sunU, bandW, bandSoft, skew, sunI, skyI, roseI, lb, haze, amb, raysK, floorMode, floorY, camD, eyeH, patchK, texK, time;
uniform vec3 sunCol, skyCol, roseCol, ambCol;
uniform vec4 lancets[5]; uniform float lancI[5];
uniform vec4 pts[4]; uniform vec3 ptsCol[4];
uniform vec4 pmRect; uniform vec3 topCam;   // top-down floor camera: X, Z, scale
uniform vec2 roseC; uniform float roseR; uniform vec4 sweep;
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.0; for (int i=0;i<4;i++){ s += a*vn(p); p *= 2.03; a *= .5; } return s; }
// hand-blown pot-metal glass: streaks, thickness clouds, seed bubbles, scratches
float glassTex(vec2 w, float sc){
  float ang = fbm(w*.0021)*6.2832; vec2 d = vec2(cos(ang), sin(ang));
  vec2 r = vec2(dot(w,d), dot(w, vec2(-d.y,d.x)));
  float st = (vn(vec2(r.x*.012, r.y*.45)) - .5) + .5*(vn(vec2(r.x*.03, r.y*1.1)) - .5);
  float cl = fbm(w*.006) - .5;
  float t = 1.0 + st*.13 + cl*.12;
  float fine = smoothstep(.55, 1.6, sc);
  vec2 c = floor(w/13.0), f = w - c*13.0; float hb = h2(c);
  if (hb > .78) { vec2 bp = vec2(h2(c+3.1), h2(c+7.7))*13.0; float br = .6 + 1.3*h2(c+1.3); float q = length(f-bp)/br;
    if (q < 1.25) t *= mix(1.0, mix(1.16, .72, smoothstep(.45, 1.0, q)) , fine) * (q > 1.0 ? mix(1.0, 1.03, fine) : 1.0); }
  vec2 c2 = floor(w/70.0), f2 = w - c2*70.0; float hs = h2(c2+9.0);
  if (hs > .7) { float a2 = h2(c2+2.0)*3.1416; vec2 n2 = vec2(-sin(a2), cos(a2)); float dl = abs(dot(f2-35.0, n2)); float along = abs(dot(f2-35.0, vec2(n2.y,-n2.x)));
    t *= 1.0 - fine*.16*smoothstep(.55, .1, dl)*step(along, 22.0*h2(c2+5.0)+6.0); }
  return mix(1.0, t, texK);
}
vec3 backlight(vec2 w){
  if (lb > .5) return vec3(1.0, .96, .9) * 1.55 * (0.88 + .24*fbm(w*.004));
  vec3 L = skyI*skyCol;
  float u = w.x + skew*w.y; float a = sunU - bandW*.5, b = sunU + bandW*.5;
  float lit = smoothstep(a-bandSoft, a, u) * (1.0 - smoothstep(b, b+bandSoft, u));
  float inRose = 1.0 - step(roseR, length(w - roseC));
  L += (1.0-inRose) * lit * sunI * sunCol * (0.9 + .22*fbm(w*.006 + time*.05));
  L += inRose * roseI * roseCol;
  for (int k=0;k<4;k++){ vec4 q = pts[k]; if (q.w <= 0.0) continue; float d = length(w - q.xy); L += ptsCol[k] * q.w * exp(-d*d/(2.0*q.z*q.z)); }
  return L;
}
vec3 roomLight(vec2 w){
  vec3 L = amb*ambCol;
  for (int k=0;k<5;k++){ vec4 r = lancets[k]; if (lancI[k] <= 0.0) continue;
    vec2 q = max(max(r.xy - w, w - r.zw), 0.0); float d = length(q);
    vec3 c = k==4 ? roseCol : sunCol; L += c * lancI[k] * (.34*exp(-d/150.0) + .10*exp(-d/600.0)); }
  for (int k=0;k<4;k++){ vec4 q = pts[k]; if (q.w <= 0.0) continue; float d = length(w - q.xy); L += ptsCol[k] * q.w * .35 * exp(-d/(q.z*2.2)); }
  if (sweep.z > 0.0) { float b = smoothstep(sweep.w - 60.0, sweep.w - 20.0, w.y) * (1.0 - smoothstep(sweep.w + 70.0, sweep.w + 110.0, w.y));
    L += vec3(1.0, .82, .55) * sweep.z * b * exp(-pow((w.x - sweep.x)/sweep.y, 2.0)); }
  return L;
}
float flag(vec2 f, out float tone){   // large irregular flagstones (jittered-grid cells), worn
  float C = 300.0; vec2 g = floor(f/C), q = f/C - g; float F1 = 9.0, F2 = 9.0; vec2 id = vec2(0);
  for (int j=-1;j<=1;j++) for (int i=-1;i<=1;i++){ vec2 o = vec2(float(i),float(j)); vec2 c = o + .5 + (vec2(h2(g+o), h2(g+o+17.3)) - .5)*.62;
    vec2 d = q - c; float dd = max(abs(d.x)*1.0, abs(d.y)*1.08) + .12*length(d); if (dd < F1){ F2 = F1; F1 = dd; id = g+o; } else if (dd < F2) F2 = dd; }
  tone = .74 + .38*h2(id); tone *= .84 + .32*fbm(f*.004 + id*3.1);
  float e = (F2 - F1)*C;
  return smoothstep(2.0, 7.0, e + (vn(f*.06)-.5)*4.0);
}
vec3 floorCol(vec2 f){
  float tone; float m = flag(f, tone);
  vec3 alb = vec3(.62,.57,.5) * tone * (0.78 + .4*fbm(f*.008)) * (0.9 + .16*vn(f*.15)) * (0.92 + .1*vn(f*.9));
  alb = mix(vec3(.3,.27,.24), alb, m);
  vec3 L = amb*ambCol*.9;
  vec2 pu = (f - pmRect.xy) / pmRect.zw;
  if (pu.x > -0.1 && pu.x < 1.1 && pu.y > -0.1 && pu.y < 1.1) {
    vec2 tq = vec2(pu.x, 1.0-pu.y); vec3 P0 = texture(Pm, tq).rgb, H = vec3(0);
    for (int k=0;k<8;k++){ float a = float(k)*.7854; vec2 dq = vec2(cos(a), sin(a)); H += texture(Pm, tq + dq*.009).rgb + texture(Pm, tq + dq*.028).rgb; }
    H /= 16.0;
    vec3 pc = mix(P0, H, .35); float pl = dot(pc, vec3(.3,.55,.15)); pc = mix(vec3(pl), pc, .78);   // soft, slightly desaturated
    L += (pc * (.85 + .3*vn(f*.03)) + H*.45) * patchK * sunCol;   // plus a glow halo around the patch
  }
  // light pooled near the wall base under lit lancets
  for (int k=0;k<4;k++){ if (lancI[k] <= 0.0) continue; vec4 r = lancets[k]; float cx = (r.x+r.z)*.5; float dx = abs(f.x - cx);
    L += sunCol * lancI[k] * .05 * exp(-dx/300.0) * exp(-f.y/500.0); }
  for (int k=0;k<4;k++){ vec4 q = pts[k]; if (q.w <= 0.0) continue; float dx = abs(f.x - q.x); L += ptsCol[k]*q.w*.05*exp(-dx/(q.z*3.0))*exp(-f.y/400.0); }
  return alb * L;
}
void main(){
  vec2 px = vec2(uv.x, 1.0-uv.y) * res;
  vec2 w = cam.xy + (px - res*.5) / cam.z;
  vec4 g = texture(G, uv), s = texture(S, uv);
  vec3 c = vec3(0.0);
  if (floorMode > 1.5) { vec2 f = vec2(topCam.x - (px.x - res.x*.5)/topCam.z, topCam.y - (px.y - res.y*.5)/topCam.z); c = floorCol(f); }
  else if (floorMode > .5) {
    float yb = (floorY - cam.y)*cam.z + res.y*.5; float y0 = yb - cam.z*eyeH;
    if (px.y > yb) { float fl = cam.z*camD; float dist = fl*eyeH/(px.y - y0); vec2 f = vec2(cam.x + (px.x - res.x*.5)*dist/fl, camD - dist); c = floorCol(f); }
  }
  if (g.a > 0.0) {
    vec3 T = g.rgb / max(g.a, 1e-3);
    vec3 gl = T * backlight(w) * glassTex(w, cam.z);
    vec3 hz = vec3(.52,.55,.58) * haze * (.55 + .9*fbm(w*.018)) * (amb*ambCol + .25*skyI*skyCol);
    c = mix(c, gl + hz, g.a);
  }
  if (s.a > 0.0) { vec3 A = s.rgb / max(s.a, 1e-3); c = mix(c, A * roomLight(w), s.a); }
  c += texture(Rt, uv).rgb * raysK;
  o = vec4(c, 1.0);
}`;
const TONE = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D src; uniform float expo;
void main(){ vec3 h = texture(src, uv).rgb*expo;
  vec3 pc = 1.0 - exp(-h);                                   // per-channel (bright glass burns toward white)
  float l = dot(h, vec3(.2126,.7152,.0722)); vec3 hp = h * (1.0 - exp(-l)) / max(l, 1e-4);   // hue-preserving
  vec3 c = mix(min(hp, vec3(1.0)), pc, smoothstep(.55, 1.6, max(max(h.r,h.g),h.b)) * .8);
  o = vec4(c, 1.0); }`;
const DOWN = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D src; uniform vec2 px; uniform float thr;
vec3 t(vec2 q){ vec3 c = texture(src,q).rgb; float l = dot(c, vec3(.3,.55,.15)); return c * smoothstep(thr, thr+.25, l); }
void main(){ o = vec4(t(uv)*.25 + (t(uv+px*vec2(1,1)) + t(uv+px*vec2(-1,1)) + t(uv+px*vec2(1,-1)) + t(uv+px*vec2(-1,-1)))*.1875, 1); }`;
const BLUR = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D src; uniform vec2 dir;
void main(){ float w[5] = float[](.2270270270, .1945945946, .1216216216, .0540540541, .0162162162);
  vec3 c = texture(src,uv).rgb*w[0]; for(int i=1;i<5;i++){ c += (texture(src,uv+dir*float(i)*1.5).rgb + texture(src,uv-dir*float(i)*1.5).rgb)*w[i]; } o = vec4(c,1); }`;
const COMP = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D scene, b1, b2, b3, O; uniform float bloom, vign, sat, contrast, fade, time; uniform vec3 tint;
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec3 c = texture(scene, uv).rgb;
  vec3 B = texture(b1,uv).rgb*.55 + texture(b2,uv).rgb*.75 + texture(b3,uv).rgb*.9;
  c = 1.0 - (1.0 - c) * (1.0 - clamp(B * bloom, 0.0, 1.0));   // screen blend
  c = clamp(c, 0.0, 1.0);
  float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
  c = mix(c, c*c*(3.0-2.0*c), contrast);
  c *= tint;
  vec2 d = uv - .5; float vv = vign * smoothstep(.2, .95, dot(d*vec2(1.2, 1.0), d*vec2(1.2, 1.0))*2.3); c *= 1.0 - vv;
  c *= 1.0 - fade;
  c += (h2(uv*1733.0 + time) - .5) / 255.0;   // dither against banding in the dark stone
  vec4 ov = texture(O, uv); c = ov.rgb + c * (1.0 - ov.a);
  o = vec4(clamp(c, 0.0, 1.0), 1);
}`;
export function makeComp(cv) {
  const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
  gl.getExtension('EXT_color_buffer_float'); gl.getExtension('OES_texture_float_linear');
  const W = cv.width, H = cv.height;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const prog = fs => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  const P = { main: prog(MAIN), tone: prog(TONE), down: prog(DOWN), blur: prog(BLUR), comp: prog(COMP) };
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const tex = (w, h, fl) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); if (w) { if (fl) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null); else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); } return t; };
  const fbo = (w, h, fl) => { const t = tex(w, h, fl), f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f, w, h }; };
  const T = { G: tex(), S: tex(), R: tex(), P: tex(), O: tex() };
  const A = fbo(W, H, true), Tn = fbo(W, H), D = [fbo(W / 2, H / 2), fbo(W / 4, H / 4), fbo(W / 8, H / 8)], Dt = [fbo(W / 2, H / 2), fbo(W / 4, H / 4), fbo(W / 8, H / 8)];
  const up = (t, c, premul) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premul); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); };
  const locs = new Map(); const U = (p, n) => { const k = p.__id + n; let l = locs.get(k); if (l === undefined) { l = gl.getUniformLocation(p, n); locs.set(k, l); } return l; };
  Object.values(P).forEach((p, i) => p.__id = 'p' + i + ':');
  const bindT = (p, name, t, unit) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(U(p, name), unit); };
  const draw = f => { gl.bindFramebuffer(gl.FRAMEBUFFER, f ? f.f : null); gl.viewport(0, 0, f ? f.w : W, f ? f.h : H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  function render(L, o) {
    // L = {G,S,R,P,O} canvases ; o = parameters
    up(T.G, L.G, true); up(T.S, L.S, true); up(T.R, L.R, false); if (L.P) up(T.P, L.P, false); up(T.O, L.O, true);
    let p = P.main; gl.useProgram(p);
    bindT(p, 'G', T.G, 0); bindT(p, 'S', T.S, 1); bindT(p, 'Rt', T.R, 2); bindT(p, 'Pm', T.P, 3);
    const f1 = (n, v) => gl.uniform1f(U(p, n), v), f3 = (n, v) => gl.uniform3f(U(p, n), v[0], v[1], v[2]);
    gl.uniform2f(U(p, 'res'), W, H); f3('cam', o.cam);
    f1('sunU', o.sunU ?? -9999); f1('bandW', o.bandW ?? 270); f1('bandSoft', o.bandSoft ?? 30); f1('skew', o.skew ?? .3); f1('sunI', o.sunI ?? 0);
    f1('skyI', o.skyI ?? .18); f1('roseI', o.roseI ?? 0); f1('lb', o.lb ? 1 : 0); f1('haze', o.haze ?? .5); f1('amb', o.amb ?? .2); f1('raysK', o.raysK ?? 1);
    f1('floorMode', o.floorMode ?? 0); f1('floorY', o.floorY ?? 900); f1('camD', o.camD ?? 2400); f1('eyeH', o.eyeH ?? 170); f1('patchK', o.patchK ?? 1); f1('texK', o.texK ?? 1); f1('time', o.time ?? 0);
    f3('sunCol', o.sunCol || [1, .95, .85]); f3('skyCol', o.skyCol || [.6, .7, .9]); f3('roseCol', o.roseCol || [1, .9, .7]); f3('ambCol', o.ambCol || [.9, .85, .8]);
    const lr = new Float32Array(20), li = new Float32Array(5);
    (o.lancets || []).forEach((r, i) => { lr.set(r.rect, i * 4); li[i] = r.I; });
    gl.uniform4fv(U(p, 'lancets'), lr); gl.uniform1fv(U(p, 'lancI'), li);
    const pv = new Float32Array(16), pc = new Float32Array(12);
    (o.pts || []).slice(0, 4).forEach((q, i) => { pv.set([q[0], q[1], q[2], q[3]], i * 4); pc.set(q[4], i * 3); });
    gl.uniform4fv(U(p, 'pts'), pv); gl.uniform3fv(U(p, 'ptsCol'), pc);
    const pr = o.pmRect || [0, 0, 1, 1]; gl.uniform4f(U(p, 'pmRect'), pr[0], pr[1], pr[2], pr[3]);
    f3('topCam', o.topCam || [0, 0, 1]); gl.uniform4f(U(p, 'sweep'), ...(o.sweep || [0, 1, 0, 0])); gl.uniform2f(U(p, 'roseC'), ...(o.roseC || [0, -9999])); f1('roseR', o.roseR ?? 0);
    draw(A);
    p = P.tone; gl.useProgram(p); bindT(p, 'src', A.t, 0); gl.uniform1f(U(p, 'expo'), o.expo ?? 1.0); draw(Tn);
    let src = Tn.t;
    for (let i = 0; i < 3; i++) {
      p = P.down; gl.useProgram(p); bindT(p, 'src', src, 0); gl.uniform2f(U(p, 'px'), 1 / D[i].w, 1 / D[i].h); gl.uniform1f(U(p, 'thr'), i === 0 ? (o.thr ?? .55) : 0); draw(D[i]);
      p = P.blur; gl.useProgram(p); bindT(p, 'src', D[i].t, 0); gl.uniform2f(U(p, 'dir'), 1 / D[i].w, 0); draw(Dt[i]);
      bindT(p, 'src', Dt[i].t, 0); gl.uniform2f(U(p, 'dir'), 0, 1 / D[i].h); draw(D[i]);
      src = D[i].t;
    }
    p = P.comp; gl.useProgram(p);
    bindT(p, 'scene', Tn.t, 0); bindT(p, 'b1', D[0].t, 1); bindT(p, 'b2', D[1].t, 2); bindT(p, 'b3', D[2].t, 3); bindT(p, 'O', T.O, 4);
    const f2 = (n, v) => gl.uniform1f(U(p, n), v);
    f2('bloom', o.bloom ?? .5); f2('vign', o.vign ?? .35); f2('sat', o.sat ?? 1.08); f2('contrast', o.contrast ?? .15); f2('fade', o.fade ?? 0); f2('time', o.time ?? 0);
    gl.uniform3f(U(p, 'tint'), ...(o.tint || [1, 1, 1]));
    draw(null);
  }
  return { render, gl };
}
