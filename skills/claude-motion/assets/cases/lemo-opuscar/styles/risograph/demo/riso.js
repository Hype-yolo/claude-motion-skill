// Riso 印刷合成器（WebGL2）
// 输入：一张"分版画布"——R = 蓝版浓度，G = 黄版浓度，B = 荧光粉版浓度（0 = 不上墨，255 = 实地）
//   用普通 source-over 绘制 = 自动"挖空"（后画的形状在三个版上都盖住先画的）；
//   用 'lighter' 只往某个通道加 = "叠印"（例如粉色太阳叠在蓝天上 → 紫）。
// 输出：纸白底上三块专色 multiply 叠印，每版独立的：套色错位（位移+微旋转）、网点半调（各自网角）、
//   墨粒（实地里的漏白点）、墨色不均（沿走纸方向的条纹 + 大块浓淡）、版边粗糙、上版开关与"滚筒刷墨"揭示。
export const INK = {
  blue: [0, 120, 191],        // Riso Blue
  yellow: [255, 232, 0],      // Riso Yellow
  pink: [255, 72, 176],       // Riso Fluorescent Pink
};
export const PAPER = [246, 241, 230];

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec2 uOff[3];      // 每版位移（px）
uniform float uRot[3];     // 每版微旋转（rad，绕画面中心）
uniform float uAng[3];     // 网角
uniform vec3 uInk[3];
uniform vec3 uPaper;
uniform float uSeed;       // 每"印一张"变一次（12fps 步进 = 墨粒沸腾）
uniform float uBoil;       // 墨粒沸腾比例 0..1
uniform float uSheet;      // 纸张级变化（墨色条纹/浓淡）：只在换镜头时变，避免满屏闪
uniform float uPeriod;     // 网点周期 px
uniform float uGate[3];    // 该版是否已上机 0..1
uniform float uSweep[3];   // 刷墨揭示：该版从右往左推进到的 x（px）；>= uRes.x+200 表示全开
uniform float uGrain;      // 墨粒强度
uniform float uWaterY;     // 水面（px，画布坐标）；<0 表示无水
uniform float uWaterAmp;   // 倒影摆幅（px）
uniform float uWaterT;
uniform float uWaterSep;   // 倒影里的分版错位（0..1）
uniform float uRefl;       // 倒影强度
uniform float uWaterB;     // 水面下边界（px）
out vec4 o;

float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float h21s(vec2 p, float s){ return h21(p + s * 17.13); }
float vn(vec2 p, float s){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  float a = h21s(i, s), b = h21s(i + vec2(1, 0), s), c = h21s(i + vec2(0, 1), s), d = h21s(i + vec2(1, 1), s);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

float dens(int i, vec2 px){
  vec2 q = rot(px - uRes * .5, uRot[i]) + uRes * .5 - uOff[i];
  float d = texture(uTex, q / uRes)[i];
  if (uWaterY > 0. && q.y > uWaterY && q.y < uWaterB) {
    // 倒影：以水面为轴翻转，每版用不同相位的正弦摆动 → 倒影里套色散开
    float fi = float(i);
    float yy = 2. * uWaterY - q.y;
    float depth = (q.y - uWaterY);
    float w = sin(q.y * .09 + uWaterT * 2.3 + fi * 2.1) * (1. + depth * .012) + sin(q.y * .031 - uWaterT * 1.3 + fi) * .6;
    float sep = uWaterSep * (fi - 1.) * 14.;
    vec2 rq = vec2(q.x + w * uWaterAmp + sep, yy);
    float r = rq.y > 0. ? texture(uTex, rq / uRes)[i] : 0.;
    // 水面横向断裂（波纹里的纸白细缝）
    float gap = step(.72, vn(vec2(q.x * .012, q.y * .35) + uWaterT * vec2(.8, 0), 3.));
    r *= uRefl * (1. - gap * .85);
    d = 1. - (1. - d) * (1. - r);
  }
  return d;
}

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  // 纸：暖白 + 纤维
  float fib = vn(px * vec2(.9, .25), 7.) * .5 + vn(px * .05, 9.) * .5;
  vec3 col = uPaper * (.975 + .03 * fib);
  for (int i = 0; i < 3; i++) {
    if (uGate[i] <= 0.001) continue;
    vec2 q = rot(px - uRes * .5, uRot[i]) + uRes * .5 - uOff[i];
    float d = dens(i, px);
    // 刷墨揭示：从右往左推进，边缘有一道偏浓的墨带
    // 刷墨揭示：已刷区域 = x < uSweep（从左往右推进），推进边缘有一道偏浓的墨带
    float reveal = 1. - smoothstep(-5., 5., px.x - uSweep[i]);
    float band = exp(-pow((px.x - uSweep[i]) / 22., 2.));
    if (d < .002 && band < .01) continue;
    // 网点：沿本版坐标（随套色一起错位）
    vec2 g = rot(q, uAng[i]) / uPeriod;
    float spot = 1. - (cos(6.2831853 * g.x) + cos(6.2831853 * g.y) + 2.) * .25; // 0..1
    // 墨粒与版边粗糙
    // 墨粒：静态部分跟着纸走（每个镜头一张纸），沸腾部分每印一张变一次、幅度小（uBoil）
    float n1 = mix(h21s(floor(q * .9), uSheet + float(i) * 3.1), h21s(floor(q * .9), uSeed + float(i) * 3.1), uBoil);
    float n2 = vn(q * .33, uSheet * .7 + float(i));
    float thr = spot + (n1 - .5) * .16 * uGrain + (n2 - .5) * .12;
    float dd = d * 1.06;
    float cov = smoothstep(thr - .07, thr + .07, dd);
    cov = max(cov, smoothstep(.9, 1., d) * .96);   // 实地
    // 漏白点（实地里纸色透出）
    float sp = h21s(floor(q * .55), uSheet * 1.3 + float(i) * 7.7 + floor(uSeed * uBoil * 2.) * 0.);
    cov *= 1. - step(.955 - .03 * uGrain, sp) * .75 * smoothstep(.4, 1., d);
    // 墨色不均：沿走纸方向（竖向）的条纹 + 大块浓淡 + 每张纸的整体浓度
    float streak = vn(vec2(q.x * .025, q.y * .0022), 11. + float(i) + uSheet * .37);
    float blot = vn(q * .004, 5. + float(i) * 2. + uSheet * .13);
    float k = .80 + .14 * streak + .08 * blot;
    k = clamp(k, 0., 1.);
    float c = clamp(cov * k * reveal + band * .45 * smoothstep(0., .25, d), 0., 1.) * uGate[i];
    col *= mix(vec3(1.), uInk[i], c);
  }
  o = vec4(col, 1.);
}`;

export function makeRiso(out, W, H) {
  const gl = out.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false });
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  const U = n => gl.getUniformLocation(pr, n);
  const u = {}; for (const n of ['uTex', 'uRes', 'uOff', 'uRot', 'uAng', 'uInk', 'uPaper', 'uSeed', 'uBoil', 'uSheet', 'uPeriod', 'uGate', 'uSweep', 'uGrain', 'uWaterY', 'uWaterAmp', 'uWaterT', 'uWaterSep', 'uRefl', 'uWaterB']) u[n] = U(n);
  gl.viewport(0, 0, W, H);
  return function print(plate, o = {}) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, plate);
    const inks = o.inks || [INK.blue, INK.yellow, INK.pink];
    gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uRes, W, H);
    const off = o.off || [[0, 0], [0, 0], [0, 0]];
    gl.uniform2fv(u.uOff, off.flat());
    gl.uniform1fv(u.uRot, o.rot || [0, 0, 0]);
    gl.uniform1fv(u.uAng, o.ang || [0.2618, 0, 1.309]);  // 15° / 0° / 75°
    gl.uniform3fv(u.uInk, inks.map(c => c.map(v => v / 255)).flat());
    gl.uniform3fv(u.uPaper, (o.paper || PAPER).map(v => v / 255));
    gl.uniform1f(u.uSeed, o.seed ?? 0);
    gl.uniform1f(u.uSheet, o.sheet ?? 0);
    gl.uniform1f(u.uBoil, o.boil ?? .35);
    gl.uniform1f(u.uPeriod, o.period ?? 7);
    gl.uniform1fv(u.uGate, o.gate || [1, 1, 1]);
    gl.uniform1fv(u.uSweep, o.sweep || [1e5, 1e5, 1e5]);
    gl.uniform1f(u.uGrain, o.grain ?? 1);
    const w = o.water || null;
    gl.uniform1f(u.uWaterY, w ? w.y : -1);
    gl.uniform1f(u.uWaterAmp, w ? w.amp : 0);
    gl.uniform1f(u.uWaterT, w ? w.t : 0);
    gl.uniform1f(u.uWaterSep, w ? w.sep : 0);
    gl.uniform1f(u.uRefl, w ? w.refl : 0);
    gl.uniform1f(u.uWaterB, w ? (w.b ?? 1e5) : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}
