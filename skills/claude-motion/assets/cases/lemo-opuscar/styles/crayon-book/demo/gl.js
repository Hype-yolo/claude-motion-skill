// WebGL2 合成器：纸面 → 蜡笔层（纸纹阈值附着）→ 水彩层（蜡笔防水）→ 终合成（纸纹浮雕、暗角）
// 每个蜡笔层是一张 Canvas2D：RGB = 蜡笔颜色，A = 笔压。着色器按"笔压 > 纸纹凹陷深度"决定蜡是否附着。
export const W = 1920, H = 1080;

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p*.5+.5; gl_Position = vec4(p,0,1); }`;

// 纸纹：像素坐标 → 高度 [0,1]（1 = 纸面凸起）
const TOOTH = `
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
uniform float uToothScale;
float toothRaw(vec2 px){
  px /= uToothScale;
  float n = vn(px/1.35)*.34 + vn(px/2.9+17.)*.33 + vn(px/6.3+41.)*.21;
  n += (vn(vec2(px.x/10., px.y/1.9)+7.)-.5)*.22;   // 纤维方向的细长凹槽（横向拖出的条纹）
  n += (vn(vec2(px.x/2.1, px.y/13.)+71.)-.5)*.08;
  return n;
}
float tooth(vec2 px){ return smoothstep(.16,.86,toothRaw(px)+.06); }
// 纸跟着画走：屏幕像素 → 纸面坐标（随镜头平移；缩放时在两个八度之间交叉，颗粒在屏幕上始终约 1 px）
uniform vec3 uPC;
vec2 paperQ(vec2 uv, vec2 res){ vec2 sp = vec2(uv.x*res.x, (1.-uv.y)*res.y); return (sp - res*.5)/uPC.z + uPC.xy; }
float toothRawAt(vec2 uv, vec2 res, vec2 off){
  float L = log2(uPC.z); float k = floor(L), f = L - k;
  vec2 q = paperQ(uv, res);
  float a = toothRaw(q*exp2(k) + off), b = toothRaw(q*exp2(k+1.) + off + 37.1);
  return mix(a, b, smoothstep(0.,1.,f));
}
float toothAt(vec2 uv, vec2 res, vec2 off){ return smoothstep(.16,.86,toothRawAt(uv,res,off)+.06); }
`;

// 纸面底色：低频斑驳
const FS_PAPER = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform vec3 uPaper; uniform vec2 uRes; uniform vec2 uPoff;
${TOOTH}
void main(){
  vec2 px = paperQ(uv, uRes) + uPoff;
  float m = vn(px/180.)*.6 + vn(px/60.+9.)*.4;
  vec3 c = uPaper * (0.975 + 0.035*m);
  o = vec4(c, 0.);
}`;

const FS_IMG = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D uL;
void main(){ o = texture(uL, uv); }`;

// 剪影垫底：角色身后的背景被"留白"（孩子先画人、再绕着人画背景）
const FS_KNOCK = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uL; uniform vec3 uPaper; uniform vec2 uRes; uniform vec2 uPoff;
${TOOTH}
void main(){
  float m = texture(uL, uv).a;
  if (m < .5) discard;
  vec2 px = paperQ(uv, uRes) + uPoff;
  float n = vn(px/180.)*.6 + vn(px/60.+9.)*.4;
  o = vec4(uPaper*(0.975+0.035*n), 0.);
}`;

// 蜡笔层
const FS_CRAYON = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uL; uniform vec2 uRes; uniform vec2 uGoff; uniform float uGain; uniform float uSoft;
${TOOTH}
void main(){
  vec4 L = texture(uL, uv);
  if (L.a < .003) { o = vec4(0); return; }
  float t = toothAt(uv, uRes, uGoff);
  float a = clamp(L.a*uGain, 0., 1.);
  // 笔压越大，越能压进纸纹凹处
  float thr = 1.0 - a*1.22;
  float cov = smoothstep(thr - uSoft, thr + uSoft, t);
  cov *= smoothstep(0.0, 0.18, a);
  vec3 c = L.rgb * (1.0 - 0.10*a*a);           // 重压时蜡更厚、颜色更沉
  o = vec4(c, cov);
}`;

// 水彩层：读上一张（rgb + 蜡覆盖 a），乘上水彩透射色；蜡处防水
const FS_WASH = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uPrev; uniform sampler2D uW; uniform vec2 uRes; uniform vec3 uT; uniform vec2 uGoff;
uniform float uResist; uniform float uEdge; uniform float uGran;
${TOOTH}
void main(){
  vec4 P = texture(uPrev, uv);
  vec4 Wc = texture(uW, uv);
  float d = Wc.a;
  vec2 px = uv*uRes;
  if (d > .002) {
    float blur = textureLod(uW, uv, 4.0).a;
    float blur2 = textureLod(uW, uv, 2.0).a;
    float edge = clamp(d - blur, 0., 1.)*uEdge + clamp(d - blur2, 0., 1.)*uEdge*.6;   // 水痕：颜料在边缘堆积
    float t = smoothstep(.16,.86, toothRaw(paperQ(uv,uRes)*0.55 + uGoff + 300.) + .06);
    vec2 wq = paperQ(uv, uRes);
    float lo = vn(wq/160.)*.5 + vn(wq/55.+3.)*.3 + vn(wq/19.+8.)*.2;                 // 渲开的浓淡（花椰菜状）
    float gr = smoothstep(.35, .05, t);                                              // 颗粒只沉积在最深的纸纹凹处
    float dd = d * (0.82 + 0.3*lo) * (1.0 + uGran*.45*gr) + edge;
    float wax = P.a;
    float res = 1.0 - uResist*smoothstep(.12, .55, wax);                            // 蜡笔防水
    dd = clamp(dd*res, 0., 1.25);
    vec3 tr = mix(vec3(1.), uT, clamp(dd,0.,1.));
    tr *= mix(1.0, 0.82, clamp(dd-1.0,0.,1.)*4.);
    o = vec4(P.rgb*tr, P.a);
  } else o = P;
}`;

// 终合成：纸纹浮雕（蜡在凸起处，所以浮雕盖在一切之上）、暖暗角
const FS_FINAL = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uS; uniform vec2 uRes; uniform float uVig; uniform float uEmb; uniform vec2 uPoff; uniform float uLift; uniform vec4 uLamp;
${TOOTH}
void main(){
  vec4 S = texture(uS, uv);
  vec2 du = vec2(1./uRes.x, 0.), dv = vec2(0., 1./uRes.y);
  float t0 = toothRawAt(uv, uRes, uPoff), tx = toothRawAt(uv+du, uRes, uPoff), ty = toothRawAt(uv-dv, uRes, uPoff);
  vec2 g = vec2(tx-t0, ty-t0);
  float waxSmooth = 1.0 - .55*S.a;                     // 蜡把纸纹填平一些
  float lit = 1.0 + (g.x*-.9 + g.y*.9)*uEmb*waxSmooth - (1.0-t0)*.035*waxSmooth;
  vec3 c = S.rgb*lit;
  c += S.a*.018*uLift;                                   // 蜡的微光
  vec2 q = uv-.5; q.x *= uRes.x/uRes.y;
  float v = 1.0 - uVig*dot(q,q);
  c *= mix(vec3(1.), vec3(1.0,.965,.9), clamp((1.0-v)*1.4,0.,1.)) * v;
  if (uLamp.w > 0.) {   // 台灯暖光：一团暖黄，边缘落进暖暗
    vec2 d = (uv - uLamp.xy); d.x *= uRes.x/uRes.y;
    float fall = exp(-dot(d,d)/(uLamp.z*uLamp.z));
    vec3 lamp = mix(vec3(.46,.36,.30), vec3(1.07,1.0,.9), fall);
    c *= mix(vec3(1.), lamp, uLamp.w);
  }
  o = vec4(clamp(c,0.,1.), 1.);
}`;

function sh(gl, type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.slice(0, 200)); return s; }
function prog(gl, fs) {
  const p = gl.createProgram(); gl.attachShader(p, sh(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}

export function makeComp(canvas, w = W, h = H) {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false, alpha: false });
  if (!gl) throw new Error('no webgl2');
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const P = { img: prog(gl, FS_IMG), knock: prog(gl, FS_KNOCK), paper: prog(gl, FS_PAPER), crayon: prog(gl, FS_CRAYON), wash: prog(gl, FS_WASH), final: prog(gl, FS_FINAL) };
  function tex(mip) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function target() {
    const t = tex(false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f };
  }
  const T = [target(), target()]; let cur = 0;
  const layerTex = tex(false), washTex = tex(true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  let toothScale = 1; let pc = [0, 0, 1];
  function use(pr, extra = {}) {
    gl.useProgram(pr.p);
    if (pr.u.uRes) gl.uniform2f(pr.u.uRes, w, h);
    if (pr.u.uToothScale) gl.uniform1f(pr.u.uToothScale, toothScale);
    if (pr.u.uPC) gl.uniform3f(pr.u.uPC, pc[0], pc[1], pc[2]);
    for (const k in extra) { const l = pr.u[k]; if (!l) continue; const v = extra[k]; if (Array.isArray(v)) (v.length === 2 ? gl.uniform2f : gl.uniform3f).call(gl, l, ...v); else gl.uniform1f(l, v); }
  }
  const draw = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.viewport(0, 0, w, h);
  return {
    gl,
    set toothScale(v) { toothScale = v; },
    paperCam(x, y, z) { pc = [x, y, z]; },   // 纸面坐标：镜头中心（纸面像素）与相对缩放
    begin(paper = [0.957, 0.937, 0.890], poff = [0, 0]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, T[cur].f); gl.disable(gl.BLEND);
      use(P.paper, { uPaper: paper, uPoff: poff }); draw();
    },
    knock(cv, paper = [0.957, 0.937, 0.890], poff = [0, 0]) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, layerTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.bindFramebuffer(gl.FRAMEBUFFER, T[cur].f); gl.disable(gl.BLEND);
      use(P.knock, { uPaper: paper, uPoff: poff }); gl.uniform1i(P.knock.u.uL, 0); draw();
    },
    group(C, o = {}) { this.knock(C.k.c); this.crayon(C.f.c, o); this.crayon(C.l.c, o); },
    crayon(cv, { goff = [0, 0], gain = 1, soft = 0.07 } = {}) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, layerTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.bindFramebuffer(gl.FRAMEBUFFER, T[cur].f);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      use(P.crayon, { uGoff: goff, uGain: gain, uSoft: soft }); gl.uniform1i(P.crayon.u.uL, 0); draw();
      gl.disable(gl.BLEND);
    },
    wash(cv, { color = [0.16, 0.2, 0.46], goff = [0, 0], resist = 0.93, edge = 1.6, gran = 0.6 } = {}) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, washTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.generateMipmap(gl.TEXTURE_2D);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T[cur].t);
      const nx = 1 - cur; gl.bindFramebuffer(gl.FRAMEBUFFER, T[nx].f); gl.disable(gl.BLEND);
      use(P.wash, { uT: color, uGoff: goff, uResist: resist, uEdge: edge, uGran: gran });
      gl.uniform1i(P.wash.u.uPrev, 0); gl.uniform1i(P.wash.u.uW, 1); draw();
      cur = nx;
    },
    image(cv) {   // 预渲染好的图（书页）：普通 alpha 叠加，不再过纸纹
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, layerTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.bindFramebuffer(gl.FRAMEBUFFER, T[cur].f);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      use(P.img); gl.uniform1i(P.img.u.uL, 0); draw(); gl.disable(gl.BLEND);
    },
    finish({ vig = 0.32, emb = 0.55, poff = [0, 0], lift = 1, lamp = [0.5, 0.5, 1, 0] } = {}) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.disable(gl.BLEND);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T[cur].t);
      use(P.final, { uVig: vig, uEmb: emb, uPoff: poff, uLift: lift }); gl.uniform4f(P.final.u.uLamp, ...lamp); gl.uniform1i(P.final.u.uS, 0); draw();
    },
  };
}
