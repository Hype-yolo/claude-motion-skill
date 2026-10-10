// 晒图纸合成器（WebGL2）：纸张在纸面坐标里程序生成（任意缩放都清晰），
// ink 画布（R = 白线曝光度，黑 = 纸）+ fx 画布（R = 投影变暗，G = 水渍湿度，B = 红色印章）合成到输出画布。
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;
const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D ink, fx, ov;
uniform vec2 res, sheet;
uniform vec4 cam;        // cx, cy, zoom, rot
uniform float wetBlur, seed, desk, sheetA, fade;
uniform vec4 roll;       // 纸卷甩开：x = 已铺开的纸面 x（>= sheet.x 表示全铺开），y = 卷筒半径
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx)*.1031 + seed*.0173); q += dot(q, q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float s = 0., a = .5; for(int i=0;i<5;i++){ s += a*vn(p); p = p*2.03 + 17.1; a *= .5; } return s; }
vec2 toSheet(vec2 s){ vec2 d = (s - res*.5)/cam.z; float c = cos(-cam.w), si = sin(-cam.w); return vec2(c*d.x - si*d.y, si*d.x + c*d.y) + cam.xy; }
vec3 paper(vec2 p){
  // 普鲁士蓝：低频褪色 + 涂布刷痕（横向拉长）
  float n1 = fbm(p/760.), n2 = fbm(vec2(p.x/1500., p.y/70.) + 3.), n3 = fbm(p/190. + 9.);
  vec3 dark = vec3(.094,.200,.420), light = vec3(.165,.345,.650);   // ≈ #18336B → #2A58A6
  float m = clamp(.10 + .95*(n1-.25) + .22*(n2-.5) + .14*(n3-.5) + .18*(p.x/sheet.x) , 0., 1.);
  vec3 c = mix(dark, light, m);
  // 纸纤维：高频亮暗 + 稀疏纤维丝
  float fib = vn(p*.55)*.5 + vn(p*1.7)*.5;
  c *= .955 + .075*fib;
  float fl = smoothstep(.93, 1., vn(vec2(p.x*.02 + p.y*.07, p.y*.9 - p.x*.3)*.35));
  c = mix(c, c*1.12 + .02, fl*.35);
  // 折痕：纸面十字折（亮边/暗边 + 折线上掉色磨白）
  float fx = p.x - sheet.x*.5 - 6.*(vn(vec2(p.y*.01, 2.))-.5), fy = p.y - sheet.y*.5 - 6.*(vn(vec2(p.x*.01, 5.))-.5);
  float cx = exp(-fx*fx/18.), cy = exp(-fy*fy/18.);
  float sx = smoothstep(-14., 0., fx) - smoothstep(0., 14., fx), sy = smoothstep(-14., 0., fy) - smoothstep(0., 14., fy);
  c *= 1. + .06*sign(fx)*(1.-abs(sx))*exp(-fx*fx/260.) + .05*sign(fy)*exp(-fy*fy/260.);
  float wear = (cx + cy)*smoothstep(.45, .8, fbm(p/9.));
  c = mix(c, vec3(.55,.66,.82), clamp(wear*.55, 0., .6));
  // 边缘褪白：不规则
  float e = min(min(p.x, sheet.x - p.x), min(p.y, sheet.y - p.y));
  float bl = smoothstep(90., 0., e + 70.*(fbm(p/60.)-.5));
  c = mix(c, vec3(.50,.62,.80), bl*.8);
  float cor = smoothstep(260., 0., length(min(p, sheet - p)) + 90.*(fbm(p/40.)-.5));
  c = mix(c, vec3(.58,.68,.84), cor*.5);
  // 小污点
  float sp = smoothstep(.985, 1., vn(p/14. + 40.));
  c *= 1. - .18*sp;
  return c;
}
void main(){
  vec2 s = vec2(uv.x, 1.-uv.y)*res;
  vec2 p = toSheet(s);
  vec2 tuv = vec2(uv.x, uv.y);
  vec4 F = texture(fx, tuv);
  vec4 Fb = textureLod(fx, tuv, 3.);
  float wet = clamp(max(F.g, Fb.g*.9), 0., 1.);
  float inside = step(0., p.x)*step(p.x, sheet.x)*step(0., p.y)*step(p.y, sheet.y);
  // 纸卷甩开：roll.x 以右还没铺开
  float unrolled = step(p.x, roll.x);
  inside *= unrolled;
  // 桌面：深色绘图桌布
  vec3 deskC = vec3(.052,.066,.086) * (.9 + .2*fbm(p/30.)) ;
  deskC *= desk;
  vec3 col = deskC;
  // 纸的投影（落在桌上）
  vec2 sp2 = p - vec2(10., 16.);
  float shadowIn = step(0., sp2.x)*step(sp2.x, min(sheet.x, roll.x))*step(0., sp2.y)*step(sp2.y, sheet.y);
  col *= 1. - .55*shadowIn*(1.-inside);
  if (inside > .5) {
    vec3 pc = paper(p);
    // 湿：蓝变深、更饱和；水痕边
    float rim = clamp(wet*(1.-wet)*4., 0., 1.);
    float wn = fbm(p/35.);
    vec3 wetC = pc*vec3(.70,.78,.92) + vec3(0.,.01,.05);
    pc = mix(pc, wetC, smoothstep(.05, .5, wet)*.85);
    pc = mix(pc, pc*1.25 + vec3(.05,.07,.10), rim*rim*(.5 + .5*wn)*.55);
    // 白线：锐利 + 晕开；湿处被泡软
    float L0 = texture(ink, tuv).r;
    float L1 = textureLod(ink, tuv, 1.6).r, L2 = textureLod(ink, tuv, 2.8).r, L3 = textureLod(ink, tuv, 4.).r;
    float w = clamp(wet*wetBlur, 0., 1.);
    float sharp = mix(L0, mix(L1, L2, .5), w*.85);
    float grainK = .80 + .20*smoothstep(.2, .8, vn(p*.9 + 3.));
    float L = clamp(sharp*grainK + L1*.18 + L2*.10 + w*L3*.35, 0., 1.);
    vec3 lineC = vec3(.905,.940,.975);
    pc = mix(pc, lineC, L*mix(.96, .72, w));
    col = pc;
  }
  // 投影（手、云）：纸面变暗
  col *= 1. - .62*clamp(Fb.r*.5 + F.r*.5, 0., 1.);
  // 红色印章：橡皮章的颗粒与漏墨
  float st = F.b;
  if (st > .001) {
    float holes = smoothstep(.12, .45, vn(p*.45 + 11.)*.6 + fbm(p/6.)*.6);
    vec3 red = vec3(.76,.22,.17);
    col = mix(col, red*(.85 + .2*fbm(p/20.)), clamp(st*holes*1.05, 0., .92));
  }
  // 纸卷筒：铺开边缘上的卷筒（卷起的纸，背面是浅色）
  if (roll.x < sheet.x) {
    float d = p.x - roll.x;
    if (d > -roll.y && d < roll.y*1.2 && p.y > -4. && p.y < sheet.y + 4.) {
      float k = clamp((d + roll.y)/(2.2*roll.y), 0., 1.);
      vec3 back = vec3(.74,.76,.72)*(.55 + .6*sin(k*3.14159));
      vec3 front = mix(vec3(.12,.24,.48), vec3(.22,.40,.72), sin(k*3.14159));
      col = mix(front, back, step(.55, fract(k*3.1 + .1)));
      col *= .8 + .35*sin(k*3.14159);
    }
  }
  // 暗角
  vec2 q = uv - .5; col *= 1. - .22*dot(q, q)*2.2;
  col = mix(deskC*.0, col, sheetA);
  vec4 O = texture(ov, tuv);
  col = col*(1.-O.a) + O.rgb;
  col *= 1. - fade;
  o = vec4(col, 1.);
}`;

export function makePaper(canvas, W, H) {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = (unit) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
  const tInk = tex(0), tFx = tex(1), tOv = tex(2);
  const U = n => gl.getUniformLocation(pr, n);
  gl.uniform1i(U('ink'), 0); gl.uniform1i(U('fx'), 1); gl.uniform1i(U('ov'), 2);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  return (inkC, fxC, ovC, o) => {
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tInk); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, inkC); gl.generateMipmap(gl.TEXTURE_2D);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tFx); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fxC); gl.generateMipmap(gl.TEXTURE_2D);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tOv); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ovC); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.generateMipmap(gl.TEXTURE_2D);
    gl.uniform2f(U('res'), W, H); gl.uniform2f(U('sheet'), o.sheet[0], o.sheet[1]);
    gl.uniform4f(U('cam'), o.cam.x, o.cam.y, o.cam.z, o.cam.r || 0);
    gl.uniform1f(U('wetBlur'), o.wetBlur ?? 1); gl.uniform1f(U('seed'), o.seed ?? 0);
    gl.uniform1f(U('desk'), o.desk ?? 1); gl.uniform1f(U('fade'), o.fade ?? 0); gl.uniform1f(U('sheetA'), o.sheetA ?? 1);
    gl.uniform4f(U('roll'), o.roll?.[0] ?? 1e6, o.roll?.[1] ?? 40, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
}
