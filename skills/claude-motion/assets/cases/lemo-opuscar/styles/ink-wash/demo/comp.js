// 宣纸合成器（WebGL2）
// 每个画面三张 2D 画布：wet（湿墨，晕开 + 边缘积墨 + 颗粒）、dry（干墨，纸纹咬边）、col（朱砂、绫裱等颜色层）。
// 两套画面 A/B 用"墨晕"蒙版转场：新画面从一团正在扩散的墨里长出来，前沿有一圈深色水线。
const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0,1); }`;
const FS = `#version 300 es
precision highp float; out vec4 o;
uniform sampler2D wA, dA, cA, wB, dB, cB;
uniform vec2 res;
uniform vec3 paperX;           // 纸纹偏移(px) + 缩放
uniform vec3 paperXB;
uniform vec2 bleed;            // A/B 晕染半径 px
uniform vec2 rim;              // A/B 积边强度
uniform vec4 trans;            // 转场：cx, cy, R(px), on
uniform vec4 rev;              // A 画面的墨晕显现：cx, cy, R, on
uniform vec2 shake; uniform float flash, fade, vig, warm;
uniform vec3 paperCol;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0., w = .5; for(int i=0;i<5;i++){ a += w*vn(p); p = p*2.03 + 17.1; w *= .5; } return a; }
// 纸：大块云纹 + 三个方向的长纤维 + 细颗粒
float fiber(vec2 p, float ang){ float c = cos(ang), s = sin(ang); vec2 q = vec2(c*p.x + s*p.y, -s*p.x + c*p.y);
  float n = vn(vec2(q.x*.018, q.y*.9)); return smoothstep(.78, .95, n); }
vec3 paper(vec2 fc, vec3 X){
  vec2 p = (fc + X.xy) / X.z;
  float fine = clamp(X.z*1.2, 0., 1.);                 // 缩小时淡出细纹，防闪烁
  float cloud = fbm(p*.0028) - .5, cloud2 = fbm(p*.011 + 3.) - .5;
  float fb = fiber(p, .35) + fiber(p + 91., 2.1) * .8 + fiber(p*1.7 + 13., 1.2) * .6;
  float grain = vn(p*.9) - .5;
  vec3 c = paperCol * (1. + cloud*.07 + cloud2*.03*fine + grain*.035*fine);
  c += vec3(.018,.016,.012) * fb * fine;
  c -= vec3(.012,.014,.018) * smoothstep(.65,.9, vn(p*.05 + 7.)) * fine;   // 纸浆暗斑
  return c;
}
const vec2 PD[12] = vec2[](vec2(-.326,-.406), vec2(-.840,-.074), vec2(-.696,.457), vec2(-.203,.621), vec2(.962,-.195), vec2(.473,-.480),
  vec2(.519,.767), vec2(.185,-.893), vec2(.507,.064), vec2(.896,.412), vec2(-.322,-.933), vec2(-.792,-.598));
float revealM(vec2 fc){
  if (rev.w < .5) return 1.;
  float d = length(fc - rev.xy); float n = fbm(fc*.004 + 5.)*.55 + fbm(fc*.02)*.25;
  float dn = d * (.7 + n) ;
  return 1. - smoothstep(rev.z*.92, rev.z, dn);
}
// 一套画面的墨色密度（0..1）与朱砂层
float inkD(sampler2D W, sampler2D D, vec2 fc, float R, float rimK, vec3 X, bool isA){
  vec2 p = (fc + X.xy) / X.z;
  vec2 disp = vec2(fbm(p*.012), fbm(p*.012 + 31.)) - .5;
  vec2 feather = vec2(vn(p*.21), vn(p*.21 + 7.)) - .5;
  vec2 q = fc + disp * R * 1.1 + feather * R * .35;
  float a = 0., b = 0.;
  for (int i = 0; i < 12; i++) {
    vec2 o1 = q + PD[i] * R * .5, o2 = q + PD[i] * R * 1.35;
    float m1 = 1., m2 = 1.;
    if (isA && rev.w > .5) { m1 = revealM(o1); m2 = revealM(o2); }
    a += texture(W, o1 / res).a * m1; b += texture(W, o2 / res).a * m2;
  }
  a /= 12.; b /= 12.;
  float s0 = texture(W, q / res).a * ((isA && rev.w > .5) ? revealM(q) : 1.);
  float edge = max(0., a - b);
  float g1 = vn(p*.35), g2 = fbm(p*.06);
  float wet = mix(s0, a, .72) * (.86 + .22*g2) + edge * rimK * (.8 + .5*g1) + b * .10;
  // 干墨：纤维抖动 + 纸纹咬边
  vec2 j = vec2(vn(p*.7), vn(p*.7 + 5.)) - .5;
  float dry = texture(D, (fc + j * 1.6) / res).a;
  if (isA && rev.w > .5) dry *= revealM(fc);
  float tooth = smoothstep(.62, .9, vn(p*.55 + 3.)) * .45;
  dry *= 1. - tooth * (1. - dry*.5);
  // 显现前沿的积墨水线
  float front = 0.;
  if (isA && rev.w > .5) { float m = revealM(fc); front = m * (1. - smoothstep(.0, .6, m)) ; }
  return clamp(1. - (1. - clamp(wet,0.,1.)) * (1. - clamp(dry,0.,1.)), 0., 1.);
}
vec3 inkCol(float D){ return mix(vec3(.52,.55,.58), vec3(.075,.068,.062), smoothstep(.0, .85, D)); }
vec3 shade(vec3 pc, float D, vec4 col, vec2 fc, vec3 X){
  vec3 c = pc * mix(vec3(1.), inkCol(D), clamp(D*1.05, 0., 1.));
  vec2 p = (fc + X.xy) / X.z;
  float sp = smoothstep(.2, .45, vn(p*.8 + 11.)) * .25 + .75;        // 印泥/颜料吃纸不匀
  c = mix(c, col.rgb * (pc / paperCol) , col.a * sp);
  return c;
}
void main(){
  vec2 fc = gl_FragCoord.xy; fc.y = res.y - fc.y; fc += shake;
  vec3 pa = paper(fc, paperX);
  float DA = inkD(wA, dA, fc, bleed.x, rim.x, paperX, true);
  vec4 CA = texture(cA, fc / res);
  vec3 c = shade(pa, DA, CA, fc, paperX);
  if (trans.w > .5) {
    vec3 pb = paper(fc, paperXB);
    float DB = inkD(wB, dB, fc, bleed.y, rim.y, paperXB, false);
    vec4 CB = texture(cB, fc / res);
    vec3 cb = shade(pb, DB, CB, fc, paperXB);
    float d = length(fc - trans.xy);
    float n = fbm(fc*.0028 + 2.)*.7 + fbm(fc*.009 + 9.)*.2;
    float dn = d * (.72 + n);
    float m = 1. - smoothstep(trans.z*.9, trans.z, dn);
    float band = exp(-pow((dn - trans.z*.95)/(trans.z*.05 + 14.), 2.)) * .6;
    c = mix(c, cb, m);
    c *= 1. - band * .38 * smoothstep(0., 40., trans.z) * (1. - smoothstep(res.x*1.1, res.x*1.5, trans.z));
  }
  // 暗角 + 旧纸暖调
  vec2 uv = gl_FragCoord.xy / res - .5;
  c *= 1. - vig * dot(uv*vec2(1.,.9), uv*vec2(1.,.9)) * 1.2;
  c = mix(c, c * vec3(1.02, .99, .94), warm);
  c = mix(c, paperCol, flash);
  c = mix(c, vec3(0.), fade);
  o = vec4(clamp(c, 0., 1.), 1.);
}`;

export function makeComp(canvas) {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
  if (!gl) throw new Error('no webgl2');
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n);
  const names = ['wA', 'dA', 'cA', 'wB', 'dB', 'cB'];
  const tex = names.map((n, i) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.uniform1i(U(n), i); return t;
  });
  const up = (i, cv) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); };
  const W = canvas.width, H = canvas.height;
  // A、B: {wet, dry, col} 画布；o: 参数
  return function composite(A, B, o = {}) {
    gl.viewport(0, 0, W, H);
    up(0, A.wet); up(1, A.dry); up(2, A.col);
    const tr = o.trans || [0, 0, 0, 0];
    if (B && tr[3] > .5) { up(3, B.wet); up(4, B.dry); up(5, B.col); }
    gl.uniform2f(U('res'), W, H);
    const px = o.paper || [0, 0, 1], pxb = o.paperB || [0, 0, 1];
    gl.uniform3f(U('paperX'), px[0], px[1], px[2]); gl.uniform3f(U('paperXB'), pxb[0], pxb[1], pxb[2]);
    gl.uniform2f(U('bleed'), o.bleed ?? 6, o.bleedB ?? 6);
    gl.uniform2f(U('rim'), o.rim ?? .8, o.rimB ?? .8);
    gl.uniform4f(U('trans'), tr[0], tr[1], tr[2], tr[3]);
    const rv = o.rev || [0, 0, 0, 0]; gl.uniform4f(U('rev'), rv[0], rv[1], rv[2], rv[3]);
    const sk = o.shake || [0, 0]; gl.uniform2f(U('shake'), sk[0], sk[1]);
    gl.uniform1f(U('flash'), o.flash ?? 0); gl.uniform1f(U('fade'), o.fade ?? 0);
    gl.uniform1f(U('vig'), o.vig ?? .22); gl.uniform1f(U('warm'), o.warm ?? .5);
    const pc = o.paperCol || [.95, .925, .87]; gl.uniform3f(U('paperCol'), pc[0], pc[1], pc[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

// 一套三张画布
export function layerSet(W = 1920, H = 1080) {
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const wet = mk(), dry = mk(), col = mk();
  const L = { wet, dry, col, W, H, cw: wet.getContext('2d'), cd: dry.getContext('2d'), cc: col.getContext('2d') };
  L.ink = { wet: L.cw, dry: L.cd, col: L.cc };
  L.clear = () => { for (const c of [L.cw, L.cd, L.cc]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H); } };
  L.xf = (s, tx, ty) => { for (const c of [L.cw, L.cd, L.cc]) c.setTransform(s, 0, 0, s, tx, ty); };
  return L;
}
