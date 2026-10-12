"use strict";
const $err = document.getElementById('err');
function fail(msg){ $err.hidden=false; $err.textContent += (typeof msg==='string'?msg:(msg&&msg.stack)||String(msg)) + '\n'; }
window.addEventListener('error', e => fail(e.message + (e.filename? `\n  @ ${e.filename.split('/').pop()}:${e.lineno}`:'')));

const Q = new URLSearchParams(location.search);
const FIXED_T = Q.has('t') ? parseFloat(Q.get('t')) : null;
const DEBUG = Q.has('debug');

const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', { antialias:false, alpha:false, depth:false, stencil:false, powerPreference:'high-performance', preserveDrawingBuffer: FIXED_T!==null });
if (!gl) { fail("WebGL2 is not available in this browser."); throw 0; }
const extF32 = gl.getExtension('EXT_color_buffer_float');
const extF16 = gl.getExtension('EXT_color_buffer_half_float');
const extAniso = gl.getExtension('EXT_texture_filter_anisotropic');
if (!extF32 && !extF16) { fail("This GPU cannot render to floating-point textures (EXT_color_buffer_float / EXT_color_buffer_half_float missing)."); throw 0; }
const FFT_FMT = extF32 ? gl.RGBA32F : gl.RGBA16F;

/* ---------------- GL helpers ---------------- */
function sh(type, src, name){
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const lines = src.split('\n').map((l,i)=>`${String(i+1).padStart(3)}  ${l}`);
    const m = /ERROR: \d+:(\d+)/.exec(log); const ln = m? +m[1] : 0;
    fail(`Shader "${name}":\n${log}\n` + (ln? lines.slice(Math.max(0,ln-4), ln+2).join('\n') : ''));
    throw new Error('shader '+name);
  }
  return s;
}
function prog(vs, fs, name){
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs, name+'.vs'));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs, name+'.fs'));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { fail(`Link "${name}": ${gl.getProgramInfoLog(p)}`); throw 0; }
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i=0;i<n;i++){ const info = gl.getActiveUniform(p,i); u[info.name.replace(/\[0\]$/,'')] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
function tex(w, h, fmt, { filter=gl.LINEAR, wrap=gl.CLAMP_TO_EDGE, mip=false, aniso=0 } = {}){
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  const levels = mip ? Math.floor(Math.log2(Math.max(w,h)))+1 : 1;
  gl.texStorage2D(gl.TEXTURE_2D, levels, fmt, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  if (aniso && extAniso) gl.texParameterf(gl.TEXTURE_2D, extAniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(aniso, gl.getParameter(extAniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  return t;
}
function rt(w, h, fmt, opts){
  const t = tex(w,h,fmt,opts); const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) fail('Incomplete framebuffer ('+st+') '+w+'x'+h);
  return { t, fb, w, h };
}
function bindT(unit, t){ gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D, t); }
function target(r){ gl.bindFramebuffer(gl.FRAMEBUFFER, r? r.fb : null); gl.viewport(0,0, r? r.w : canvas.width, r? r.h : canvas.height); }

const triVAO = gl.createVertexArray(); gl.bindVertexArray(triVAO);
{ const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0); }
function fullscreen(){ gl.bindVertexArray(triVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); }

const VS = `#version 300 es
layout(location=0) in vec2 p; out vec2 vUv;
void main(){ vUv = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;
const HEAD = `#version 300 es
precision highp float; precision highp sampler2D; precision highp int;
in vec2 vUv; out vec4 o;
`;

/* ---------------- Ocean spectrum (FFT) ---------------- */
const N = 256, LOGN = 8;
const L = 4.6;               // patch size (m)
const DEPTH = 1.6;          // mean depth (m)
const TARGET_SLOPE = 0.078;  // RMS slope

function mulberry(a){ return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const rnd = mulberry(7);
function gauss(){ let u=0,v=0; while(!u) u=rnd(); v=rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }

function buildH0(){
  const kp = 2*Math.PI/0.62, kcut = 2*Math.PI/0.045;
  const wd = [0.8, 0.6];
  const re = new Float32Array(N*N), im = new Float32Array(N*N);
  let s2 = 0;
  for (let m=0;m<N;m++) for (let n=0;n<N;n++){
    const nx = n<N/2? n : n-N, nz = m<N/2? m : m-N;
    const kx = 2*Math.PI*nx/L, kz = 2*Math.PI*nz/L, k = Math.hypot(kx,kz);
    let P = 0;
    if (k>1e-6){
      const lk = Math.log(k/kp);
      const bump = Math.exp(-0.5*(lk/0.36)**2);
      const tail = 0.035*Math.exp(-((kp/k)**2))*Math.exp(-((k/kcut)**2));
      const swell = 0.35*Math.exp(-0.5*(Math.log(k/(2*Math.PI/1.6))/0.3)**2);
      const c = (kx*wd[0]+kz*wd[1])/k;
      const spread = (0.3 + 0.7*c*c) * (c<0? 0.35 : 1);
      P = (bump + tail + swell) * spread / (k*k*k*k);
    }
    const a = Math.sqrt(P/2);
    const i = m*N+n; re[i] = gauss()*a; im[i] = gauss()*a;
    s2 += 2*k*k*(re[i]*re[i]+im[i]*im[i]);
  }
  const sc = TARGET_SLOPE/Math.sqrt(s2);
  const data = new Float32Array(N*N*4);
  for (let m=0;m<N;m++) for (let n=0;n<N;n++){
    const i=m*N+n, j=((N-m)%N)*N + ((N-n)%N);
    data[i*4]=re[i]*sc; data[i*4+1]=im[i]*sc; data[i*4+2]=re[j]*sc; data[i*4+3]=-im[j]*sc;
  }
  const t = tex(N,N,gl.RGBA32F,{filter:gl.NEAREST, wrap:gl.REPEAT});
  gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,N,N,gl.RGBA,gl.FLOAT,data);
  return t;
}
const h0Tex = buildH0();
const fftA = rt(N,N,FFT_FMT,{filter:gl.NEAREST, wrap:gl.REPEAT});
const fftB = rt(N,N,FFT_FMT,{filter:gl.NEAREST, wrap:gl.REPEAT});
const surfRT = rt(N,N,gl.RGBA16F,{wrap:gl.REPEAT, mip:true, aniso:8});

const pSpec = prog(VS, HEAD+`
uniform sampler2D uH0; uniform float uT, uL;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
void main(){
  ivec2 id = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(uH0, id, 0);
  vec2 n = vec2(id); n -= step(${N/2}.0, n) * ${N}.0;
  vec2 k = 6.28318530718*n/uL; float kl = length(k);
  float w = sqrt(9.81*kl + 7.4e-5*kl*kl*kl);
  // gentle dispersion quantisation keeps the loop seamless over 60 s
  float w0 = 6.28318530718/60.0; w = floor(w/w0)*w0;
  float c = cos(w*uT), sn = sin(w*uT);
  vec2 H = cmul(s.xy, vec2(c,sn)) + cmul(s.zw, vec2(c,-sn));
  vec2 C1 = H - k.x*H;                    // h + i*dh/dx
  vec2 C2 = vec2(-k.y*H.y, k.y*H.x);      // dh/dz
  o = vec4(C1, C2);
}`, 'spectrum');

const pFFT = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform int uP, uHoriz;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
void main(){
  ivec2 id = ivec2(gl_FragCoord.xy);
  int j = uHoriz==1 ? id.x : id.y;
  int k = j & (uP-1);
  int i = ((j - (j & (2*uP-1))) >> 1) + k;
  bool y1 = (j & uP) != 0;
  ivec2 a = uHoriz==1 ? ivec2(i, id.y) : ivec2(id.x, i);
  ivec2 b = uHoriz==1 ? ivec2(i+${N/2}, id.y) : ivec2(id.x, i+${N/2});
  vec4 x0 = texelFetch(uSrc, a, 0), x1 = texelFetch(uSrc, b, 0);
  float ang = 3.14159265359*float(k)/float(uP);
  vec2 w = vec2(cos(ang), sin(ang));
  vec4 wx = vec4(cmul(w,x1.xy), cmul(w,x1.zw));
  o = y1 ? x0-wx : x0+wx;
}`, 'fft');

const pResolve = prog(VS, HEAD+`
uniform sampler2D uSrc;
void main(){
  vec4 s = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0);
  vec2 sl = vec2(s.y, s.z);
  o = vec4(s.x, sl, dot(sl,sl));
}`, 'resolve');

function runFFT(t){
  gl.disable(gl.BLEND);
  target(fftA); gl.useProgram(pSpec.p); bindT(0,h0Tex); gl.uniform1i(pSpec.u.uH0,0); gl.uniform1f(pSpec.u.uT,t); gl.uniform1f(pSpec.u.uL,L); fullscreen();
  gl.useProgram(pFFT.p); gl.uniform1i(pFFT.u.uSrc,0);
  let src=fftA, dst=fftB;
  for (let horiz=1; horiz>=0; horiz--) for (let s=0;s<LOGN;s++){
    target(dst); bindT(0,src.t); gl.uniform1i(pFFT.u.uP, 1<<s); gl.uniform1i(pFFT.u.uHoriz, horiz); fullscreen();
    [src,dst]=[dst,src];
  }
  target(surfRT); gl.useProgram(pResolve.p); bindT(0,src.t); gl.uniform1i(pResolve.u.uSrc,0); fullscreen();
  gl.bindTexture(gl.TEXTURE_2D, surfRT.t); gl.generateMipmap(gl.TEXTURE_2D);
}

/* ---------------- Interactive ripples (wave equation) ---------------- */
const RN = 256, RSIZE = 7.0;   // local simulation, metres
const rip = [0,1].map(()=>rt(RN,RN,gl.RGBA16F,{wrap:gl.CLAMP_TO_EDGE}));
let ripIdx = 0, ripCenter = [0,0];
const pRipple = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform vec2 uShift; uniform vec4 uDrop; // xy uv, z radius(uv), w strength
void main(){
  vec2 px = 1.0/vec2(textureSize(uSrc,0));
  vec2 uv = vUv + uShift;
  vec4 c = texture(uSrc, uv);
  float avg = 0.25*(texture(uSrc, uv+vec2(px.x,0)).r + texture(uSrc, uv-vec2(px.x,0)).r + texture(uSrc, uv+vec2(0,px.y)).r + texture(uSrc, uv-vec2(0,px.y)).r);
  float v = c.g + (avg - c.r)*0.9;
  v *= 0.9955;
  float h = c.r + v;
  h *= 0.9985;
  if (uDrop.w != 0.0){ float d = length((vUv - uDrop.xy)); float r = uDrop.z; if (d < r){ float f = 0.5+0.5*cos(3.14159*d/r); h -= uDrop.w*f; } }
  // fade out near borders so the local field blends into open water
  vec2 e = min(vUv, 1.0-vUv); float edge = smoothstep(0.0, 0.06, min(e.x,e.y));
  h *= mix(0.9, 1.0, edge); v *= mix(0.9, 1.0, edge);
  if (uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.) { h=0.; v=0.; }
  o = vec4(h, v, 0, 1);
}`, 'ripple');
const pRipN = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform float uTexel;  // metres per texel
void main(){
  vec2 px = 1.0/vec2(textureSize(uSrc,0));
  float hx = texture(uSrc, vUv+vec2(px.x,0)).r - texture(uSrc, vUv-vec2(px.x,0)).r;
  float hz = texture(uSrc, vUv+vec2(0,px.y)).r - texture(uSrc, vUv-vec2(0,px.y)).r;
  float h = texture(uSrc,vUv).r;
  float lap = (texture(uSrc, vUv+vec2(px.x,0)).r + texture(uSrc, vUv-vec2(px.x,0)).r + texture(uSrc, vUv+vec2(0,px.y)).r + texture(uSrc, vUv-vec2(0,px.y)).r - 4.0*h)/(uTexel*uTexel);
  o = vec4(h, hx/(2.0*uTexel), hz/(2.0*uTexel), lap);
}`, 'rippleNormals');
const ripN = rt(RN,RN,gl.RGBA16F,{wrap:gl.CLAMP_TO_EDGE});
gl.bindFramebuffer(gl.FRAMEBUFFER, rip[0].fb); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
gl.bindFramebuffer(gl.FRAMEBUFFER, rip[1].fb); gl.clear(gl.COLOR_BUFFER_BIT);
gl.bindFramebuffer(gl.FRAMEBUFFER, ripN.fb); gl.clear(gl.COLOR_BUFFER_BIT);
const drops = [];
let ripActive = 0; // frames since last disturbance, to skip work when calm

function stepRipples(shiftUV){
  gl.disable(gl.BLEND); gl.useProgram(pRipple.p); gl.uniform1i(pRipple.u.uSrc,0);
  for (let s=0;s<1;s++){
    const src = rip[ripIdx], dst = rip[1-ripIdx];
    target(dst); bindT(0, src.t);
    gl.uniform2f(pRipple.u.uShift, s===0? shiftUV[0]:0, s===0? shiftUV[1]:0);
    const d = drops.shift();
    gl.uniform4f(pRipple.u.uDrop, d? d[0]:0, d? d[1]:0, d? d[2]:0, d? d[3]:0);
    fullscreen(); ripIdx = 1-ripIdx;
  }
  target(ripN); gl.useProgram(pRipN.p); bindT(0, rip[ripIdx].t); gl.uniform1i(pRipN.u.uSrc,0); gl.uniform1f(pRipN.u.uTexel, RSIZE/RN); fullscreen();
}

/* ---------------- Caustics ---------------- */
const G = 256, C = 1024;
const causRT = rt(C,C,gl.RGBA16F,{wrap:gl.REPEAT, mip:true, aniso:8});
const gridVAO = gl.createVertexArray(); gl.bindVertexArray(gridVAO);
{
  const v = new Float32Array((G+1)*(G+1)*2); let o=0;
  for (let j=0;j<=G;j++) for (let i=0;i<=G;i++){ v[o++]=i/G; v[o++]=j/G; }
  const idx = new Uint32Array(G*G*6); o=0;
  for (let j=0;j<G;j++) for (let i=0;i<G;i++){ const a=j*(G+1)+i, b=a+1, c=a+G+1, d=c+1; idx[o++]=a; idx[o++]=b; idx[o++]=c; idx[o++]=b; idx[o++]=d; idx[o++]=c; }
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
}
gl.bindVertexArray(null);
const pCaus = prog(`#version 300 es
precision highp float; precision highp sampler2D;
layout(location=0) in vec2 aUV;
uniform sampler2D uSurf; uniform float uL, uDepth, uIor; uniform vec3 uSun; uniform vec2 uShift;
out vec2 vSrc;
void main(){
  ivec2 off = ivec2(gl_InstanceID % 3 - 1, gl_InstanceID / 3 - 1);
  vec4 s = textureLod(uSurf, aUV, 0.0);
  vec3 n = normalize(vec3(-s.y, 1.0, -s.z));
  vec3 r = refract(-uSun, n, 1.0/uIor);
  vec3 P = vec3(aUV.x*uL, s.x, aUV.y*uL);
  vec3 F = P + r*((-uDepth - s.x)/r.y);
  vSrc = aUV*uL;
  vec2 c = (F.xz - uShift)/uL + vec2(off);
  gl_Position = vec4(c*2.0-1.0, 0.0, 1.0);
}`, `#version 300 es
precision highp float;
in vec2 vSrc; out vec4 o; uniform float uNorm;
void main(){
  vec2 a = dFdx(vSrc), b = dFdy(vSrc);
  float area = abs(a.x*b.y - a.y*b.x);
  float I = min(area*uNorm, 40.0);
  o = vec4(I);
}`, 'caustics');

const IORS = [1.3315, 1.3335, 1.3365];
let causShift = [0,0];
function renderCaustics(sun){
  target(causRT); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(pCaus.p); bindT(0, surfRT.t); gl.uniform1i(pCaus.u.uSurf,0);
  gl.uniform1f(pCaus.u.uL, L); gl.uniform1f(pCaus.u.uDepth, DEPTH); gl.uniform3fv(pCaus.u.uSun, sun);
  gl.uniform1f(pCaus.u.uNorm, (C/L)*(C/L));
  // flat-surface refraction shift (green) keeps the pattern registered; per-channel residual = dispersion fringes
  const sy = sun[1], sinI = Math.sqrt(1-sy*sy), sinT = sinI/IORS[1], cosT = Math.sqrt(1-sinT*sinT);
  const hd = Math.hypot(sun[0],sun[2]) || 1, tanT = sinT/cosT;
  causShift = [-sun[0]/hd*DEPTH*tanT, -sun[2]/hd*DEPTH*tanT];
  gl.uniform2fv(pCaus.u.uShift, causShift);
  gl.bindVertexArray(gridVAO);
  const masks = [[1,0,0,0],[0,1,0,0],[0,0,1,0]];
  for (let c=0;c<3;c++){ gl.colorMask(...masks[c]); gl.uniform1f(pCaus.u.uIor, IORS[c]); gl.drawElementsInstanced(gl.TRIANGLES, G*G*6, gl.UNSIGNED_INT, 0, 9); }
  gl.colorMask(true,true,true,true); gl.disable(gl.BLEND);
  gl.bindTexture(gl.TEXTURE_2D, causRT.t); gl.generateMipmap(gl.TEXTURE_2D);
}

/* ---------------- Pebbles ---------------- */
const pebTex = tex(1024, 1024, gl.SRGB8_ALPHA8, { wrap:gl.REPEAT, mip:true, aniso:16 });
let pebReady = false;
{ const img = new Image(); img.onload = () => { gl.bindTexture(gl.TEXTURE_2D, pebTex); gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,img); gl.generateMipmap(gl.TEXTURE_2D); pebReady = true; };
  img.onerror = () => fail('Could not decode the pebble texture.');
  // the texture is embedded as base64 at the very end of this file (keeps it a single self-contained file that also works from file://)
  addEventListener('DOMContentLoaded', () => { img.src = 'data:image/jpeg;base64,' + document.getElementById('pebbles-texture').textContent.trim(); }); }

/* ---------------- Main water shader ---------------- */
const pMain = prog(VS, HEAD+`
uniform sampler2D uSurf, uCaus, uPeb, uRip;
uniform vec3 uCam, uR, uU, uF, uSun;
uniform float uTanF, uAspect, uL, uDepth, uTime, uRipSize;
uniform vec2 uCausShift, uRipCenter;

const float IOR = 1.3335;
const vec3 SIG_A = vec3(0.40, 0.074, 0.088);
const vec3 SIG_S = vec3(0.028, 0.052, 0.068);
const vec3 SIG_T = SIG_A + SIG_S;
const vec3 SUN = vec3(1.0, 0.90, 0.74) * 6.0;
const float PI = 3.14159265359;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }

float ridge(float a){ // periodic headland silhouette, elevation in radians (~1.5-4 deg)
  return 0.040 + 0.016*sin(a*2.0+0.7) + 0.011*sin(a*5.0+2.1) + 0.006*sin(a*11.0+0.3) + 0.003*sin(a*23.0+1.7);
}
float fbm2(vec2 p){ float v=0., a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p=p*2.03+17.1; a*=0.5; } return v; }
vec3 sky(vec3 d){
  float e = d.y;
  float mu = dot(d, uSun);
  vec3 zen = vec3(0.11, 0.27, 0.62), hor = vec3(0.66, 0.78, 0.90);
  vec3 c = mix(hor, zen, pow(clamp(e,0.,1.), 0.42));
  c += vec3(1.0, 0.86, 0.66) * (0.22*pow(max(mu,0.),6.) + 0.30*pow(max(mu,0.),64.) + 1.6*pow(max(mu,0.),2400.));
  // distant headland: pine canopy over pale limestone, softened by ~2 km of air
  float a = atan(d.z, d.x);
  float r = ridge(a) + 0.0045*(vnoise(vec2(a*260.0, 0.0))-0.5) + 0.002*(vnoise(vec2(a*900.0, 3.0))-0.5);
  float back = smoothstep(-0.3, 0.95, dot(normalize(vec2(d.x,d.z)+1e-5), normalize(vec2(uSun.x,uSun.z))));
  float u = clamp(e / max(r, 1e-3), 0.0, 1.0);
  vec2 q = vec2(a*420.0, e*420.0);
  float tex = fbm2(q);
  vec3 pine = vec3(0.045, 0.070, 0.042) * (0.6 + 0.8*tex);
  vec3 rock = vec3(0.30, 0.28, 0.23) * (0.55 + 0.7*fbm2(q*1.7+5.0));
  float cliff = smoothstep(0.42, 0.18, u + 0.25*(tex-0.5)) * smoothstep(0.35, 0.75, vnoise(vec2(a*18.0, 1.0)));
  vec3 land = mix(pine, rock, cliff);
  land *= mix(1.0, 0.45, back);                         // backlit toward the sun
  land = mix(land, hor*0.92, 0.38 + 0.25*back);          // aerial perspective
  float w = fwidth(e)*1.2 + 2e-4;
  c = mix(c, land, smoothstep(r+w, r-w, e) * step(-0.3, e));
  return c;
}

vec4 texBS(sampler2D t, vec2 uv){ // cubic B-spline filtering in 4 bilinear taps: smooth slopes -> smooth highlights
  vec2 ts = vec2(textureSize(t,0)); vec2 p = uv*ts - 0.5; vec2 f = fract(p); p = floor(p);
  vec2 f2 = f*f, f3 = f2*f;
  vec2 w0 = (-f3 + 3.0*f2 - 3.0*f + 1.0)/6.0, w1 = (3.0*f3 - 6.0*f2 + 4.0)/6.0;
  vec2 w2 = (-3.0*f3 + 3.0*f2 + 3.0*f + 1.0)/6.0, w3 = f3/6.0;
  vec2 g0 = w0+w1, g1 = w2+w3; vec2 h0 = (w1/g0 - 0.5 + p)/ts, h1 = (w3/g1 + 1.5 + p)/ts;
  return (texture(t, vec2(h0.x,h0.y))*g0.x + texture(t, vec2(h1.x,h0.y))*g1.x)*g0.y
       + (texture(t, vec2(h0.x,h1.y))*g0.x + texture(t, vec2(h1.x,h1.y))*g1.x)*g1.y;
}
float floorDepth(vec2 xz){
  // shelving bottom: shallow near the shore behind the viewer, deeper toward open water
  float shelf = 0.95 + 0.17*clamp(-xz.y + 1.5, 0.0, 14.0);
  return shelf + 0.30*(vnoise(xz*0.22)-0.5) + 0.10*(vnoise(xz*0.9+7.0)-0.5);
}
vec3 pebbles(vec2 x, float sc, out float hgt){
  vec2 uv = x / (vec2(0.78, 0.78)*sc);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  float k = vnoise(x*0.85);
  float l = k*8.0; float ia = floor(l), f = fract(l);
  vec2 oa = sin(vec2(3.0,7.0)*ia), ob = sin(vec2(3.0,7.0)*(ia+1.0));
  vec3 a = textureGrad(uPeb, uv+oa, dx, dy).rgb, b = textureGrad(uPeb, uv+ob, dx, dy).rgb;
  float s = dot(a-b, vec3(1));
  float m = smoothstep(0.2, 0.8, f - 0.1*s);
  // coarse luminance as pseudo-height (pale stone tops, dark gaps)
  vec3 ca = textureGrad(uPeb, uv+oa, dx*6.0, dy*6.0).rgb, cb = textureGrad(uPeb, uv+ob, dx*6.0, dy*6.0).rgb;
  hgt = dot(mix(ca,cb,m), vec3(0.3,0.55,0.15));
  return mix(a, b, m);
}
float fresnel(float ci, float n){
  ci = clamp(ci, 0.0, 1.0);
  float st2 = (1.0-ci*ci)/(n*n); if (st2 >= 1.0) return 1.0;
  float ct = sqrt(1.0-st2);
  float rs = (ci - n*ct)/(ci + n*ct), rp = (n*ci - ct)/(n*ci + ct);
  return 0.5*(rs*rs + rp*rp);
}

void main(){
  vec2 ndc = vUv*2.0-1.0;
  vec3 rd = normalize(uF + ndc.x*uAspect*uTanF*uR + ndc.y*uTanF*uU);
  vec3 wd = rd; wd.y = min(wd.y, -0.0015); wd = normalize(wd);

  // ---- surface intersection (height field, fixed-point) ----
  float t = -uCam.y / wd.y;
  vec2 xz; vec4 A; vec4 B; vec4 R;
  const mat2 M = mat2(0.8, -0.6, 0.6, 0.8);
  const float SC = 0.41, WB = 0.10;
  float hsum = 0.0;
  for (int i=0;i<3;i++){
    xz = uCam.xz + wd.xz*t;
    A = texture(uSurf, xz/uL);
    B = texture(uSurf, (M*xz)/(uL*SC) + 0.37);
    vec2 ruv = (xz - uRipCenter)/uRipSize + 0.5;
    R = texture(uRip, ruv);
    hsum = A.x + WB*SC*B.x + R.x;
    t = (hsum - uCam.y) / wd.y;
  }
  vec3 P = uCam + wd*t;
  A = texBS(uSurf, P.xz/uL);
  B = texBS(uSurf, (M*P.xz)/(uL*SC) + 0.37);
  vec2 slope = A.yz + WB*(transpose(M)*B.yz) + R.yz;
  const mat2 M2 = mat2(0.28, 0.96, -0.96, 0.28);
  vec4 Cm = texture(uSurf, (M2*P.xz)/(uL*0.13) + 0.71);
  slope += 0.13*exp(-t*0.18)*(transpose(M2)*Cm.yz);
  float var = max(A.w - dot(A.yz,A.yz), 0.0) + WB*WB*max(B.w - dot(B.yz,B.yz), 0.0);
  vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
  float dist = t;

  vec3 v = -wd;
  float nv = dot(n, v);
  if (nv < 0.02) { n = normalize(n + v*(0.02-nv)); nv = dot(n,v); }
  float F = fresnel(nv, IOR);

  // ---- reflection ----
  vec3 rr = reflect(wd, n); rr.y = abs(rr.y);
  vec3 refl = sky(rr) * 1.25;

  // sun glints: GGX with slope-variance widening (LEAN-style)
  float a2 = 0.00012 + 1.2*var;
  vec3 h = normalize(v + uSun);
  float nh = max(dot(n,h),0.0), nl = max(dot(n,uSun),0.0);
  float c2 = max(nh*nh, 1e-4); float tan2 = (1.0-c2)/c2;
  float D = exp(-tan2/a2)/(PI*a2*c2*c2);             // Beckmann: no long GGX tail, crisp glints
  float Vis = 0.5/(nl*sqrt(nv*nv*(1.0-a2)+a2) + nv*sqrt(nl*nl*(1.0-a2)+a2) + 1e-5);
  float Fh = fresnel(max(dot(h,v),0.0), IOR);
  vec3 spec = SUN * min(D*Vis*Fh*nl, 12000.0);

  // ---- refraction / underwater ----
  vec3 tr = refract(wd, n, 1.0/IOR);
  float fy = -floorDepth(P.xz);
  float s = (fy - P.y)/tr.y; vec3 FP = P + tr*s;
  for (int i=0;i<2;i++){ fy = -floorDepth(FP.xz); s = (fy - P.y)/tr.y; FP = P + tr*s; }
  s = max(s, 0.0);

  // bottom made of zones: fine pebbles, coarse cobbles, and sand that fills the gaps first
  float hgt, hgt2;
  vec3 pf = pebbles(FP.xz, 1.0, hgt);
  vec3 pc = pebbles(FP.xz.yx*vec2(-1.0,1.0) + 5.3, 1.7, hgt2);
  float coarse = smoothstep(0.45, 0.62, fbm2(FP.xz*0.21 + 40.0));
  vec3 alb = mix(pf, pc, coarse); hgt = mix(hgt, hgt2, coarse);
  float zone = fbm2(FP.xz*0.16 + 3.0) + 0.10*(vnoise(FP.xz*2.5)-0.5);
  float sandM = smoothstep(hgt + 0.02, hgt + 0.16, (zone - 0.46)*1.6);
  float marks = 0.5 + 0.5*sin(dot(FP.xz, vec2(0.93, 0.37))*16.0 + 3.0*vnoise(FP.xz*0.8));
  vec3 sand = vec3(0.60, 0.55, 0.44) * (0.82 + 0.22*vnoise(FP.xz*40.0) + 0.10*marks);
  sand = sand*sand*1.4; // to linear-ish, matching the texture
  alb = mix(alb, sand, sandM); hgt = mix(hgt, 0.42 + 0.05*marks, sandM);
  alb = mix(vec3(dot(alb,vec3(0.3,0.55,0.15))), alb, 0.8) * vec3(1.10, 1.0, 0.86);
  // large-scale variation: sun-bleached patches, darker weedy hollows, a hint of olive film
  float big = vnoise(FP.xz*0.45) * 0.65 + vnoise(FP.xz*1.3+3.1) * 0.35;
  float weed = smoothstep(0.55, 0.85, vnoise(FP.xz*0.32 + 11.0));
  alb *= mix(0.62, 1.22, big);
  alb = mix(alb, alb*vec3(0.55, 0.62, 0.40), weed*0.7); alb = mix(vec3(0.30,0.29,0.27), pow(alb, vec3(1.2)), 0.72) * 0.6;

  vec3 sunT = refract(-uSun, vec3(0,1,0), 1.0/IOR);
  float Ts = 1.0 - fresnel(uSun.y, IOR);
  float depthHere = max(P.y - FP.y, 0.0);
  // relief: nudge caustic lookup by pseudo height along the sun path; darken gaps a little
  vec2 cuv = (FP.xz - uCausShift + sunT.xz/(-sunT.y)*(hgt-0.35)*0.05)/uL;
  vec3 caus = texture(uCaus, cuv, 1.0).rgb;
  // touch ripples focus light too: first-order lensing from the local curvature where the sun ray entered
  vec2 S = FP.xz - sunT.xz*depthHere/(-sunT.y);
  float lap = texture(uRip, (S - uRipCenter)/uRipSize + 0.5).a;
  caus *= clamp(1.0/(1.0 + 0.12*depthHere*lap), 0.45, 3.0);
  float ao = mix(0.55, 1.0, smoothstep(0.08, 0.42, hgt));
  vec3 Esun = SUN * Ts * exp(-SIG_T*depthHere/(-sunT.y)) * caus * (-sunT.y) * mix(0.75, 1.0, ao);
  vec3 skyIrr = vec3(0.62, 0.70, 0.78) * PI * 0.22;
  vec3 Esky = skyIrr * exp(-(SIG_A + 0.4*SIG_S)*depthHere*1.25) * ao;
  vec3 Lfloor = alb/PI * (Esun + Esky);

  vec3 Tv = exp(-SIG_T*s);
  float cosS = dot(sunT, -tr);
  float g = 0.8; float ph = (1.0-g*g)/(4.0*PI*pow(1.0+g*g-2.0*g*cosS, 1.5));
  vec3 Lmid = SUN*Ts*exp(-SIG_T*depthHere*0.5/(-sunT.y))*(ph+0.02) + skyIrr*exp(-SIG_A*depthHere*0.6)/(4.0*PI);
  vec3 Lin = SIG_S/SIG_T * Lmid * (1.0 - Tv) * 3.2;
  vec3 under = Lfloor*Tv + Lin;
  // suspended specks at three depths: tiny sunlit particles that give the water column volume
  for (int k=0;k<3;k++){
    float dz = 0.22 + 0.38*float(k);
    float tt = dz / max(-tr.y, 0.05);
    vec2 q = (P.xz + tr.xz*tt)*48.0 + vec2(uTime*(0.05+0.03*float(k)), uTime*0.02) + float(k)*17.0;
    vec2 id = floor(q), f = fract(q) - 0.5;
    float r = hash12(id + float(k)*13.1);
    vec2 of = vec2(hash12(id+3.1), hash12(id+7.7)) - 0.5;
    float fw = fwidth(q.x) + fwidth(q.y);
    float dot_ = smoothstep(0.10 + fw, 0.0, length(f - of*0.6)) * step(0.988, r) * step(tt, s);
    float fade = exp(-SIG_T.g*tt*2.0) * smoothstep(1.2, 0.3, fw);
    under += dot_ * fade * SUN * Ts * 0.022 * mix(vec3(0.9,1.0,0.95), vec3(0.4,0.35,0.3), step(0.992, r));
  }

  vec3 col = F*refl + (1.0-F)*under + spec;

  // distant haze over the water
  float haze = 1.0 - exp(-dist*0.004);
  float muh = max(dot(normalize(vec3(wd.x,0.0,wd.z)), uSun), 0.0);
  vec3 hazeC = vec3(0.60, 0.71, 0.82) + vec3(1.0,0.86,0.66)*(0.22*pow(muh,6.0)+0.3*pow(muh,64.0));
  col = mix(col, hazeC*0.95, haze*0.8);

  // sky above horizon
  vec3 skyc = sky(rd);
  float mu = dot(rd, uSun);
  skyc += SUN*18.0*smoothstep(0.99996, 0.999985, mu);
  float hz = smoothstep(-0.0005, 0.0015, rd.y);
  col = mix(col, skyc, hz);

  o = vec4(max(col, 0.0), 1.0);
}`, 'water');

/* ---------------- Post: glare streaks + bloom + tonemap ---------------- */
const pBright = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform float uThr;
void main(){
  vec2 px = 1.0/vec2(textureSize(uSrc,0));
  vec3 c = vec3(0);
  for (int y=-1;y<=2;y++) for (int x=-1;x<=2;x++) c += texture(uSrc, vUv + (vec2(x,y)-0.5)*px*1.0).rgb;
  c /= 16.0;
  float l = max(max(c.r,c.g),c.b);
  float k = max(l - uThr, 0.0) / max(l, 1e-4);
  o = vec4(min(c*k, vec3(160.0)), 1);
}`, 'bright');
const pStreak = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform vec2 uDir; uniform float uStep, uAtt;
void main(){
  vec2 px = 1.0/vec2(textureSize(uSrc,0));
  vec3 c = vec3(0); float ws = 0.0;
  for (int s=0;s<4;s++){ float w = pow(uAtt, uStep*float(s)); c += w*texture(uSrc, vUv + uDir*px*uStep*float(s)).rgb; ws += w; }
  o = vec4(c/ws, 1);
}`, 'streak');
const pBlur = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform vec2 uDir;
void main(){
  vec2 px = uDir/vec2(textureSize(uSrc,0));
  vec3 c = texture(uSrc, vUv).rgb*0.2270270270;
  c += (texture(uSrc, vUv+px*1.3846153846).rgb + texture(uSrc, vUv-px*1.3846153846).rgb)*0.3162162162;
  c += (texture(uSrc, vUv+px*3.2307692308).rgb + texture(uSrc, vUv-px*3.2307692308).rgb)*0.0702702703;
  o = vec4(c,1);
}`, 'blur');
const pCopy = prog(VS, HEAD+`uniform sampler2D uSrc; uniform float uK; void main(){ o = vec4(texture(uSrc,vUv).rgb*uK,1); }`, 'copy');
const pRaw = prog(VS, HEAD+`uniform sampler2D uSrc; void main(){ o = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0); }`, 'raw');
const pFinal = prog(VS, HEAD+`
uniform sampler2D uHdr, uStreak, uB1, uB2; uniform float uExp, uTime, uNoPost; uniform vec2 uRes;
vec3 bicubic(sampler2D t, vec2 uv){
  vec2 ts = vec2(textureSize(t,0)); vec2 p = uv*ts - 0.5; vec2 f = fract(p); p = floor(p);
  vec2 w0 = f*(-0.5+f*(1.0-0.5*f)), w1 = 1.0+f*f*(-2.5+1.5*f), w2 = f*(0.5+f*(2.0-1.5*f)), w3 = f*f*(-0.5+0.5*f);
  vec2 g0 = w0+w1, g1 = w2+w3; vec2 h0 = (w1/g0 - 0.5 + p)/ts, h1 = (w3/g1 + 1.5 + p)/ts;
  return (texture(t, vec2(h0.x,h0.y)).rgb*g0.x + texture(t, vec2(h1.x,h0.y)).rgb*g1.x)*g0.y + (texture(t, vec2(h0.x,h1.y)).rgb*g0.x + texture(t, vec2(h1.x,h1.y)).rgb*g1.x)*g1.y;
}
vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec2 uv = vUv;
  // faint lateral chromatic aberration, like a phone lens
  vec2 cc = uv-0.5; float ca = 0.0012*dot(cc,cc)*4.0;
  vec3 c;
  c.r = texture(uHdr, uv + cc*ca).r; c.g = texture(uHdr, uv).g; c.b = texture(uHdr, uv - cc*ca).b;
  if (uNoPost < 0.5) c += texture(uStreak, uv).rgb * 0.9;
  if (uNoPost < 0.5) c += texture(uB1, uv).rgb * 0.035 + bicubic(uB2, uv) * 0.035;
  if (uNoPost > 1.5) c = texture(uStreak, uv).rgb * 0.55 * 20.0;
  c *= uExp;
  float vig = 1.0 - 0.22*dot(cc*vec2(1.0,0.8), cc*vec2(1.0,0.8))*2.2;
  c *= vig;
  c = aces(c);
  float lum = dot(c, vec3(0.2126,0.7152,0.0722));
  c = mix(vec3(lum), c, 0.90);
  c = mix(c, c*vec3(0.96,1.0,1.05), 1.0 - smoothstep(0.0, 0.35, lum));
  c = pow(c, vec3(1.0/2.2));
  float g = hash(gl_FragCoord.xy + fract(uTime*7.13)*917.0) - 0.5;
  c += g * 0.018 * (1.0 - c*0.6);
  o = vec4(c, 1);
}`, 'final');


/* ---------------- Lens diffraction glare ----------------
   The star around each sun glint is the lens aperture's diffraction pattern (its Fourier transform),
   integrated over wavelengths so the spikes carry faint rainbow tints. The bright image is convolved
   with it by FFT every frame, so the cost does not depend on how many glints there are. */
const GLARE_ON = !!extF32 && !Q.has('noglare');
const pFFTg = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform int uP, uHoriz, uHalf; uniform float uSign;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
void main(){
  ivec2 id = ivec2(gl_FragCoord.xy);
  int j = uHoriz==1 ? id.x : id.y;
  int k = j & (uP-1);
  int i = ((j - (j & (2*uP-1))) >> 1) + k;
  bool y1 = (j & uP) != 0;
  ivec2 a = uHoriz==1 ? ivec2(i, id.y) : ivec2(id.x, i);
  ivec2 b = uHoriz==1 ? ivec2(i+uHalf, id.y) : ivec2(id.x, i+uHalf);
  vec4 x0 = texelFetch(uSrc, a, 0), x1 = texelFetch(uSrc, b, 0);
  float ang = uSign*3.14159265359*float(k)/float(uP);
  vec2 w = vec2(cos(ang), sin(ang));
  vec4 wx = vec4(cmul(w,x1.xy), cmul(w,x1.zw));
  o = y1 ? x0-wx : x0+wx;
}`, 'fftGlare');
const pGSrc = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform float uThr, uWhich;
void main(){
  vec2 px = 1.0/vec2(textureSize(uSrc,0));
  vec2 st = 1.0/vec2(textureSize(uSrc,0)) * vec2(textureSize(uSrc,0)) / vec2(textureSize(uSrc,0));
  vec3 c = vec3(0);
  // 4 bilinear taps = 16 texels, enough for the ~4-5x downscale
  for (int y=0;y<2;y++) for (int x=0;x<2;x++) c += texture(uSrc, vUv + (vec2(x,y)-0.5)*px*2.0).rgb;
  c *= 0.25;
  float l = max(max(c.r,c.g),c.b);
  c *= max(l - uThr, 0.0)/max(l, 1e-4);
  c = min(c, vec3(80000.0)) * 1e-3;
  o = uWhich < 0.5 ? vec4(c.r, 0.0, c.g, 0.0) : vec4(c.b, 0.0, 0.0, 0.0);
}`, 'glareSrc');
const pGMul = prog(VS, HEAD+`
uniform sampler2D uSrc, uK;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
void main(){ ivec2 id = ivec2(gl_FragCoord.xy); vec4 a = texelFetch(uSrc,id,0), k = texelFetch(uK,id,0); o = vec4(cmul(a.xy,k.xy), cmul(a.zw,k.zw)); }`, 'glareMul');
const pGOut = prog(VS, HEAD+`
uniform sampler2D uA, uB; uniform vec2 uScale;
void main(){ ivec2 id = ivec2(gl_FragCoord.xy); vec4 a = texelFetch(uA,id,0), b = texelFetch(uB,id,0);
  o = vec4(max(vec3(a.x, a.z, b.x), 0.0)*1e3, 1); }`, 'glareOut');

function fft1(re, im, n, inv){
  for (let i=1,j=0;i<n;i++){ let bit=n>>1; for(;j&bit;bit>>=1) j^=bit; j^=bit;
    if(i<j){ let t=re[i]; re[i]=re[j]; re[j]=t; t=im[i]; im[i]=im[j]; im[j]=t; } }
  for (let len=2; len<=n; len<<=1){
    const ang=2*Math.PI/len*(inv?1:-1), wr=Math.cos(ang), wi=Math.sin(ang), h=len>>1;
    for (let i=0;i<n;i+=len){ let cr=1, ci=0;
      for (let k=0;k<h;k++){ const a=i+k, b=a+h; const xr=re[b]*cr-im[b]*ci, xi=re[b]*ci+im[b]*cr;
        re[b]=re[a]-xr; im[b]=im[a]-xi; re[a]+=xr; im[a]+=xi; const t=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=t; } } }
}
function fft2(re, im, w, h, inv){
  const rr=new Float32Array(w), ri=new Float32Array(w);
  for (let y=0;y<h;y++){ const o=y*w; rr.set(re.subarray(o,o+w)); ri.set(im.subarray(o,o+w)); fft1(rr,ri,w,inv); re.set(rr,o); im.set(ri,o); }
  const cr=new Float32Array(h), ci=new Float32Array(h);
  for (let x=0;x<w;x++){ for (let y=0;y<h;y++){ cr[y]=re[y*w+x]; ci[y]=im[y*w+x]; } fft1(cr,ci,h,inv); for (let y=0;y<h;y++){ re[y*w+x]=cr[y]; im[y*w+x]=ci[y]; } }
}
// Aperture: round lens with slightly flattened hexagonal edge, two hairline scratches and a few dust specks.
let PSF = null;
function buildPSF(){
  const n = 512, R = n*0.11, SS = 3, D = Math.PI/180;
  const re = new Float32Array(n*n), im = new Float32Array(n*n);
  const flats = [0,1,2,3,4,5].map(k => (15 + k*60)*D);
  const scratches = [ {a:21*D, o:0.12*R, w:2.2}, {a:22.5*D, o:-0.38*R, w:1.6}, {a:19*D, o:0.55*R, w:1.2}, {a:152*D, o:0.25*R, w:1.0}, {a:84*D, o:-0.2*R, w:0.8} ];
  const r2 = mulberry(3); const dust = Array.from({length:7}, () => ({x:(r2()-0.5)*1.4*R, y:(r2()-0.5)*1.4*R, r:(0.015+0.03*r2())*R}));
  for (let y=0;y<n;y++) for (let x=0;x<n;x++){
    let acc = 0;
    for (let sy=0; sy<SS; sy++) for (let sx=0; sx<SS; sx++){
      const dx = x - n/2 + (sx+0.5)/SS - 0.5, dy = y - n/2 + (sy+0.5)/SS - 0.5;
      if (dx*dx+dy*dy > R*R) continue;
      let ok = true;
      for (const f of flats) if (dx*Math.cos(f)+dy*Math.sin(f) > R*0.955) { ok=false; break; }
      if (ok) for (const sc of scratches) if (Math.abs(dx*Math.cos(sc.a)+dy*Math.sin(sc.a) - sc.o) < sc.w*0.5) { ok=false; break; }
      if (ok) for (const d of dust) if ((dx-d.x)**2+(dy-d.y)**2 < d.r*d.r) { ok=false; break; }
      if (ok) acc++;
    }
    re[y*n+x] = acc/(SS*SS);
  }
  fft2(re, im, n, n, false);
  const P = new Float32Array(n*n);
  for (let y=0;y<n;y++) for (let x=0;x<n;x++){ const i=((y+n/2)%n)*n + ((x+n/2)%n); P[y*n+x] = re[i]*re[i]+im[i]*im[i]; }
  // integrate over the visible spectrum: the pattern scales with wavelength
  const bands = [[440,[0.10,0.00,0.85]],[470,[0.00,0.15,1.00]],[500,[0.00,0.60,0.55]],[530,[0.05,1.00,0.15]],[560,[0.45,0.95,0.00]],[590,[0.95,0.55,0.00]],[620,[1.00,0.20,0.00]],[650,[0.70,0.05,0.00]]];
  const out = new Float32Array(n*n*3), sum=[0,0,0];
  const samp = (u,v) => { if (u<0||v<0||u>=n-1||v>=n-1) return 0; const x0=u|0, y0=v|0, fx=u-x0, fy=v-y0, i=y0*n+x0;
    return (P[i]*(1-fx)+P[i+1]*fx)*(1-fy) + (P[i+n]*(1-fx)+P[i+n+1]*fx)*fy; };
  for (const [lam, w] of bands){ const s = lam/550;
    for (let y=0;y<n;y++) for (let x=0;x<n;x++){ const v = samp(n/2+(x-n/2)/s, n/2+(y-n/2)/s)/(s*s); const o=(y*n+x)*3;
      out[o]+=v*w[0]; out[o+1]+=v*w[1]; out[o+2]+=v*w[2]; } }
  // phone lenses flare harder than an ideal aperture: lift the far field relative to the core
  for (let y=0;y<n;y++) for (let x=0;x<n;x++){ const r = Math.hypot(x-n/2, y-n/2); const w = 1 + 7*Math.min(1, Math.max(0, (r-3)/30)); const o=(y*n+x)*3; out[o]*=w; out[o+1]*=w; out[o+2]*=w; }
  for (let i=0;i<n*n;i++) for (let c=0;c<3;c++) sum[c]+=out[i*3+c];
  for (let i=0;i<n*n;i++) for (let c=0;c<3;c++) out[i*3+c]/=sum[c];
  PSF = { n, rgb: out };
}
let glareTick = 0, gX=0, gY=0, gSW=0, gSH=0, gA=[], gB=[], gK1=null, gK2=null;
function allocGlare(){
  for (const r of [...gA, ...gB]) { gl.deleteTexture(r.t); gl.deleteFramebuffer(r.fb); }
  if (gK1) { gl.deleteTexture(gK1); gl.deleteTexture(gK2); }
  gX = W>=H ? 512 : 256; gY = W>=H ? 256 : 512;
  // fit the frame inside ~75% of the grid so the spikes have room to fade before wrapping around
  const f = Math.min(gX*0.75/W, gY*0.75/H); gSW = Math.max(1, Math.round(W*f)); gSH = Math.max(1, Math.round(H*f));
  gA = [0,1].map(()=>rt(gX,gY,FFT_FMT,{filter:gl.NEAREST})); gB = [0,1].map(()=>rt(gX,gY,FFT_FMT,{filter:gl.NEAREST}));
  if (!PSF) buildPSF();
  // resample the PSF onto the grid: its full width spans ~1.15x the frame height
  const n = PSF.n, KH = 1.15*gSH, sc = n/KH;
  const kr = [0,1,2].map(()=>({re:new Float32Array(gX*gY), im:new Float32Array(gX*gY)}));
  const tot=[0,0,0];
  for (let gy=-gY/2; gy<gY/2; gy++) for (let gx=-gX/2; gx<gX/2; gx++){
    const u = n/2 + gx*sc, v = n/2 + gy*sc; if (u<0||v<0||u>=n-1||v>=n-1) continue;
    const x0=u|0, y0=v|0, fx=u-x0, fy=v-y0, i=((gy+gY)%gY)*gX + ((gx+gX)%gX);
    for (let c=0;c<3;c++){ const P = PSF.rgb, a=(y0*n+x0)*3+c;
      const val = (P[a]*(1-fx)+P[a+3]*fx)*(1-fy) + (P[a+n*3]*(1-fx)+P[a+n*3+3]*fx)*fy;
      kr[c].re[i] = val; tot[c] += val; } }
  const norm = 1/(gX*gY);
  for (let c=0;c<3;c++){ for (let i=0;i<gX*gY;i++) kr[c].re[i] *= norm/tot[c]; fft2(kr[c].re, kr[c].im, gX, gY, false); }
  const d1 = new Float32Array(gX*gY*4), d2 = new Float32Array(gX*gY*4);
  for (let i=0;i<gX*gY;i++){ d1[i*4]=kr[0].re[i]; d1[i*4+1]=kr[0].im[i]; d1[i*4+2]=kr[1].re[i]; d1[i*4+3]=kr[1].im[i]; d2[i*4]=kr[2].re[i]; d2[i*4+1]=kr[2].im[i]; }
  gK1 = tex(gX,gY,gl.RGBA32F,{filter:gl.NEAREST}); gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gX,gY,gl.RGBA,gl.FLOAT,d1);
  gK2 = tex(gX,gY,gl.RGBA32F,{filter:gl.NEAREST}); gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gX,gY,gl.RGBA,gl.FLOAT,d2);
}
function fftGrid(pair, sign){
  gl.useProgram(pFFTg.p); gl.uniform1i(pFFTg.u.uSrc,0); gl.uniform1f(pFFTg.u.uSign, sign);
  let src = 0;
  for (const [horiz, len] of [[1,gX],[0,gY]]){
    gl.uniform1i(pFFTg.u.uHoriz, horiz); gl.uniform1i(pFFTg.u.uHalf, len/2);
    for (let p=1; p<len; p<<=1){ target(pair[1-src]); bindT(0, pair[src].t); gl.uniform1i(pFFTg.u.uP, p); fullscreen(); src = 1-src; }
  }
  return src;
}
function renderGlare(){
  gl.disable(gl.BLEND);
  gl.useProgram(pGSrc.p); bindT(0, hdrRT.t); gl.uniform1i(pGSrc.u.uSrc,0); gl.uniform1f(pGSrc.u.uThr, 14.0);
  for (const [pair, which] of [[gA,0],[gB,1]]){
    gl.bindFramebuffer(gl.FRAMEBUFFER, pair[0].fb); gl.viewport(0,0,gX,gY); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0,0,gSW,gSH); gl.uniform1f(pGSrc.u.uWhich, which); fullscreen();
  }
  const res = [];
  for (const [pair, K] of [[gA,gK1],[gB,gK2]]){
    let s = fftGrid(pair, -1);
    target(pair[1-s]); gl.useProgram(pGMul.p); bindT(0, pair[s].t); bindT(1, K); gl.uniform1i(pGMul.u.uSrc,0); gl.uniform1i(pGMul.u.uK,1); fullscreen(); s = 1-s;
    if (s !== 0) { /* fftGrid always starts from index 0: copy back */ target(pair[0]); gl.useProgram(pRaw.p); bindT(0,pair[1].t); gl.uniform1i(pRaw.u.uSrc,0); fullscreen(); }
    res.push(pair[fftGrid(pair, 1)]);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, streakRT.fb); gl.viewport(0,0,streakRT.w,streakRT.h);
  gl.useProgram(pGOut.p); bindT(0,res[0].t); bindT(1,res[1].t); gl.uniform1i(pGOut.u.uA,0); gl.uniform1i(pGOut.u.uB,1); fullscreen();
}
let W=0, H=0, scale = 1.0, hdrRT, qA, qS, qB, qC, streakRT, b1, b2, b2t;
const DPR = Math.min(window.devicePixelRatio||1, 2);
let quality = FIXED_T!==null ? 1.0 : (DPR > 1.5 ? 0.72 : 0.95);
function alloc(){
  const cw = Math.max(1, Math.round(innerWidth*DPR*quality)), ch = Math.max(1, Math.round(innerHeight*DPR*quality));
  if (cw===W && ch===H) return;
  W=cw; H=ch; canvas.width=W; canvas.height=H;
  for (const r of [hdrRT,qA,qS,qB,qC,streakRT,b1,b2,b2t]) if (r){ gl.deleteTexture(r.t); gl.deleteFramebuffer(r.fb); }
  hdrRT = rt(W,H,gl.RGBA16F);
  const qw = Math.max(1,W>>1), qh = Math.max(1,H>>1);
  qA = rt(qw,qh,gl.RGBA16F); qS = rt(qw,qh,gl.RGBA16F); qB = rt(qw,qh,gl.RGBA16F); qC = rt(qw,qh,gl.RGBA16F);
  if (GLARE_ON) { allocGlare(); streakRT = rt(gSW,gSH,gl.RGBA16F); } else { streakRT = rt(4,4,gl.RGBA16F); gl.bindFramebuffer(gl.FRAMEBUFFER, streakRT.fb); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); }
  b1 = rt(qw,qh,gl.RGBA16F);
  b2 = rt(Math.max(1,qw>>2),Math.max(1,qh>>2),gl.RGBA16F,{}); b2t = rt(b2.w,b2.h,gl.RGBA16F);
}
window.addEventListener('resize', alloc);

function post(t){
  gl.disable(gl.BLEND);
  gl.useProgram(pBright.p); bindT(0,hdrRT.t); gl.uniform1i(pBright.u.uSrc,0);
  target(qA); gl.uniform1f(pBright.u.uThr, 2.5); fullscreen();
  // the glare is the heaviest post step: on phones refresh it every other frame (every third when struggling)
  const every = FIXED_T!==null ? 1 : (quality < 0.55 ? 3 : (DPR > 1.5 ? 2 : 1));
  if (GLARE_ON && (glareTick++ % every === 0)) renderGlare();
  // bloom
  gl.useProgram(pBlur.p); gl.uniform1i(pBlur.u.uSrc,0);
  target(qB); bindT(0,qA.t); gl.uniform2f(pBlur.u.uDir,1,0); fullscreen();
  target(b1); bindT(0,qB.t); gl.uniform2f(pBlur.u.uDir,0,1); fullscreen();
  gl.useProgram(pCopy.p); target(b2); bindT(0,b1.t); gl.uniform1i(pCopy.u.uSrc,0); gl.uniform1f(pCopy.u.uK,1.0); fullscreen();
  gl.useProgram(pBlur.p);
  for (let i=0;i<2;i++){ target(b2t); bindT(0,b2.t); gl.uniform2f(pBlur.u.uDir,1.5,0); fullscreen(); target(b2); bindT(0,b2t.t); gl.uniform2f(pBlur.u.uDir,0,1.5); fullscreen(); }
  // final
  if (Q.get('view')==='caus'){ target(null); gl.useProgram(pCopy.p); bindT(0,causRT.t); gl.uniform1i(pCopy.u.uSrc,0); gl.uniform1f(pCopy.u.uK,0.25); fullscreen(); return; }
  target(null); gl.useProgram(pFinal.p);
  bindT(0,hdrRT.t); bindT(1,streakRT.t); bindT(2,b1.t); bindT(3,b2.t);
  gl.uniform1i(pFinal.u.uHdr,0); gl.uniform1i(pFinal.u.uStreak,1); gl.uniform1i(pFinal.u.uB1,2); gl.uniform1i(pFinal.u.uB2,3);
  gl.uniform1f(pFinal.u.uExp, 0.63); gl.uniform1f(pFinal.u.uNoPost, Q.get('view')==='nopost'?1:(Q.get('view')==='glare'?2:0)); gl.uniform1f(pFinal.u.uTime, t); gl.uniform2f(pFinal.u.uRes, W, H);
  fullscreen();
}

/* ---------------- Camera & input ---------------- */
const SUN_EL = 31*Math.PI/180, SUN_AZ = 6*Math.PI/180;
const SUNV = [Math.sin(SUN_AZ)*Math.cos(SUN_EL), Math.sin(SUN_EL), -Math.cos(SUN_AZ)*Math.cos(SUN_EL)];
const cam = { yaw: Q.has('yaw')? parseFloat(Q.get('yaw')) : 0, pitch: Q.has('pitch')? parseFloat(Q.get('pitch')) : -0.72, vy:0, vp:0, h:1.55 };
let drag = null, lastTap = null;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); drag = {x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY, t:performance.now()}; });
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  const k = 1.2/Math.min(innerWidth, innerHeight);
  const dx = (e.clientX-drag.x)*k, dy = (e.clientY-drag.y)*k;
  cam.yaw -= dx; cam.pitch += dy; cam.vy = -dx; cam.vp = dy;
  cam.pitch = Math.max(-1.45, Math.min(0.35, cam.pitch));
  drag.x = e.clientX; drag.y = e.clientY;
});
canvas.addEventListener('pointerup', e => {
  if (drag && Math.hypot(e.clientX-drag.x0, e.clientY-drag.y0) < 8 && performance.now()-drag.t < 350) lastTap = [e.clientX, e.clientY];
  drag = null; hideHint();
});
canvas.addEventListener('pointercancel', () => drag = null);
const $hint = document.getElementById('hint');
let hintT = setTimeout(hideHint, 6000);
function hideHint(){ clearTimeout(hintT); $hint.classList.add('off'); }
if (FIXED_T!==null) $hint.style.display='none';

function camBasis(t){
  const hy = FIXED_T!==null ? 0 : 1;
  const yaw = cam.yaw + hy*(0.010*Math.sin(t*0.31) + 0.005*Math.sin(t*0.83+1.3));
  const pit = cam.pitch + hy*(0.007*Math.sin(t*0.47+2.0) + 0.003*Math.sin(t*1.13));
  const roll = hy*(0.006*Math.sin(t*0.39+0.4));
  const f = [Math.sin(yaw)*Math.cos(pit), Math.sin(pit), -Math.cos(yaw)*Math.cos(pit)];
  let r = [Math.cos(yaw), 0, Math.sin(yaw)];
  let u = [r[1]*f[2]-r[2]*f[1], r[2]*f[0]-r[0]*f[2], r[0]*f[1]-r[1]*f[0]];
  const cr=Math.cos(roll), sr=Math.sin(roll);
  const r2 = r.map((x,i)=>x*cr + u[i]*sr), u2 = u.map((x,i)=>u[i]*cr - r[i]*sr);
  const pos = [hy*0.03*Math.sin(t*0.21), cam.h + hy*0.015*Math.sin(t*0.57), hy*0.03*Math.cos(t*0.17)];
  return { f, r:r2, u:u2, pos };
}
const VFOV = 64*Math.PI/180;

// screen tap -> point on water plane -> drop in ripple sim
function tapToDrop(sx, sy, B){
  const nx = (sx/innerWidth)*2-1, ny = 1-(sy/innerHeight)*2;
  const tf = Math.tan(VFOV/2), asp = W/H;
  const d = [0,1,2].map(i => B.f[i] + nx*asp*tf*B.r[i] + ny*tf*B.u[i]);
  if (d[1] >= -0.01) return;
  const t = -B.pos[1]/d[1]; const px = B.pos[0]+d[0]*t, pz = B.pos[2]+d[2]*t;
  const u = (px - ripCenter[0])/RSIZE + 0.5, v = (pz - ripCenter[1])/RSIZE + 0.5;
  if (u<0.05||u>0.95||v<0.05||v>0.95) return;
  drops.push([u, v, 0.022, 0.07]);
  ripActive = 0;
}

/* ---------------- Loop ---------------- */
alloc();
const $dbg = document.getElementById('dbg'); if (DEBUG) $dbg.hidden = false;
let t0 = performance.now(), last = t0, acc = 0, frames = 0, ftAvg = 16, tSim = 0;
function frame(now){
  const dt = Math.min(0.05, (now-last)/1000); last = now;
  tSim += dt;
  const t = FIXED_T!==null ? FIXED_T : tSim;
  if (!drag){ cam.yaw += cam.vy*0.9; cam.pitch += cam.vp*0.9; cam.vy*=0.9; cam.vp*=0.9; cam.pitch = Math.max(-1.45, Math.min(0.35, cam.pitch)); }
  if (!pebReady){ requestAnimationFrame(frame); return; }
  const B = camBasis(t);

  runFFT(t*0.9);
  // keep the ripple window centred under the view, snapped to whole texels
  const look = -B.pos[1]/Math.min(B.f[1],-0.2);
  const want = [B.pos[0]+B.f[0]*look*0.9, B.pos[2]+B.f[2]*look*0.9];
  const tx = RSIZE/RN;
  const dxT = Math.round((want[0]-ripCenter[0])/tx), dzT = Math.round((want[1]-ripCenter[1])/tx);
  if (Q.has('tap') && !window.__tapped){ window.__tapped=1; const [x,y]=Q.get('tap').split(',').map(Number); lastTap=[x,y]; }
  if (lastTap){ tapToDrop(lastTap[0], lastTap[1], B); lastTap = null; }
  if (drag){ /* stir while dragging lightly? keep camera only */ }
  if (ripActive < 900){
    stepRipples([dxT/RN, dzT/RN]); ripCenter = [ripCenter[0]+dxT*tx, ripCenter[1]+dzT*tx]; ripActive++;
  } else { ripCenter = [ripCenter[0]+dxT*tx, ripCenter[1]+dzT*tx]; }

  renderCaustics(SUNV);

  target(hdrRT); gl.disable(gl.BLEND); gl.useProgram(pMain.p);
  bindT(0,surfRT.t); bindT(1,causRT.t); bindT(2,pebTex); bindT(3,ripN.t);
  const u = pMain.u;
  gl.uniform1i(u.uSurf,0); gl.uniform1i(u.uCaus,1); gl.uniform1i(u.uPeb,2); gl.uniform1i(u.uRip,3);
  gl.uniform3fv(u.uCam, B.pos); gl.uniform3fv(u.uR, B.r); gl.uniform3fv(u.uU, B.u); gl.uniform3fv(u.uF, B.f); gl.uniform3fv(u.uSun, SUNV);
  gl.uniform1f(u.uTanF, Math.tan(VFOV/2)); gl.uniform1f(u.uAspect, W/H); gl.uniform1f(u.uL, L); gl.uniform1f(u.uDepth, DEPTH); gl.uniform1f(u.uTime, t);
  gl.uniform1f(u.uRipSize, RSIZE); gl.uniform2fv(u.uRipCenter, ripCenter); gl.uniform2fv(u.uCausShift, causShift);
  fullscreen();
  post(t);

  // adaptive resolution
  if (FIXED_T===null){
    ftAvg = ftAvg*0.95 + (dt*1000)*0.05; frames++;
    if (frames > 90){
      if (ftAvg > 21 && quality > 0.42){ quality = Math.max(0.42, quality*0.87); alloc(); frames = 0; }
      else if (ftAvg < 14.5 && quality < 1.0){ quality = Math.min(1.0, quality*1.06); alloc(); frames = 0; }
    }
    if (DEBUG && frames%15===0) $dbg.textContent = `${(1000/ftAvg).toFixed(0)} fps · ${W}×${H} · q ${quality.toFixed(2)}`;
  }
  if (FIXED_T!==null){ window.__frames = (window.__frames||0)+1; if (window.__frames < (Q.has('frames')? +Q.get('frames') : 4)) requestAnimationFrame(frame); return; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
