// VHS 摄像机后期（three ShaderPass，最后一道，直接输出到 1920×1080 画布）
// 顺序：4:3 画幅 → 磁带逐行抖动 / 磁头切换条 / 跟踪撕裂 → 镜头桶形畸变（OSD 不畸变）
//   → 亮度水平带宽限制 + 锐化振铃 → 色度大幅水平糊开并滞后 → 高光向右拖尾 → 自动白平衡 / 曝光 / AGC 噪点
//   → 掉磁（白色横线）→ 黑电平抬升 + 高光软削 → 暗角
// 不做 CRT 扫描线/光栅：这是"被录下来的带子"，不是"在显像管上看"
export const VHS = {
  uniforms: {
    tDiffuse: { value: null }, tOSD: { value: null },
    res: { value: [1920, 1080] }, src: { value: [720, 540] },
    frame: { value: 0 }, tint: { value: [1, 1, 1] }, expo: { value: 1 }, gain: { value: 0.03 },
    sharp: { value: 0.9 }, lumaW: { value: 1.25 }, chromaW: { value: 5.0 }, chromaShift: { value: 1.6 }, sat: { value: 1.0 },
    jitter: { value: 0.3 }, track: { value: 0 }, roll: { value: 0 }, barrel: { value: 0.07 }, vig: { value: 0.42 },
    black: { value: 0.045 }, dropout: { value: 1 }, off: { value: 0 }, smear: { value: 0.35 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: `
precision highp float;
uniform sampler2D tDiffuse, tOSD; uniform vec2 res, src; uniform vec3 tint;
uniform float frame, expo, gain, sharp, lumaW, chromaW, chromaShift, sat, jitter, track, roll, barrel, vig, black, dropout, off, smear;
varying vec2 vUv;
float h1(float n){ return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn1(float x){ float i = floor(x), f = fract(x); f = f*f*(3.-2.*f); return mix(h1(i), h1(i+1.), f); }
const mat3 toYIQ = mat3(.299, .596, .211, .587, -.274, -.523, .114, -.322, .312);
const mat3 toRGB = mat3(1., 1., 1., .956, -.272, -1.106, .621, -.647, 1.703);
vec2 lens(vec2 q){ vec2 p = q - .5; vec2 pa = p * vec2(1.333, 1.); float r2 = dot(pa, pa); p *= 1. + barrel * r2; p *= 1. - barrel * .3; return p + .5; }
// 信号 = 画面（经镜头）+ OSD（电子叠加，不经镜头）
vec3 sig(vec2 q){
  vec2 ql = lens(q);
  vec3 c = texture2D(tDiffuse, ql).rgb;
  if (ql.x < 0. || ql.x > 1. || ql.y < 0. || ql.y > 1.) c = vec3(0.);
  vec4 o = texture2D(tOSD, q);
  return mix(c, o.rgb, o.a);
}
void main(){
  vec2 fc = gl_FragCoord.xy; float bw = res.y * 4. / 3.; float x0 = (res.x - bw) * .5;
  if (fc.x < x0 || fc.x > x0 + bw) { gl_FragColor = vec4(0., 0., 0., 1.); return; }
  vec2 uv = vec2((fc.x - x0) / bw, fc.y / res.y);
  float F = floor(frame);
  // 垂直滚动（开机/撕裂时画面上下滚）
  uv.y = fract(uv.y + roll);
  float line = floor((1. - uv.y) * src.y);          // 磁带行号（自上而下）
  float dx = 1. / src.x;
  // 逐行水平抖动（时基误差）
  float off1 = (h1(line * .37 + F * 1.13) - .5) * jitter * dx;
  off1 += (vn1(line * .012 + F * .7) - .5) * jitter * .8 * dx;   // 低频摆动（周期 ~80 行，不会把字拧成斜体）
  // 磁头切换：底部几行横向错开 + 噪声
  float hsw = smoothstep(src.y - 10., src.y - 3., line);
  off1 += hsw * (.012 + .025 * h1(line + F * 3.1));
  // 跟踪撕裂：一条滚动的噪声带 + 带内大幅错行
  float band = 0.;
  if (track > 0.) {
    float by = fract(h1(F * .31) * .6 + F * .037);
    band = smoothstep(.09 * track + .02, 0., abs(uv.y - by));
    off1 += (h1(line * .13 + F * 7.1) - .5) * .05 * track * (1. + band * 4.);
    off1 += band * track * .06 * sin(F * 2.3 + line * .02);
    uv.y += (h1(F * 1.9) - .5) * .02 * track;
  }
  vec2 q = vec2(uv.x + off1, uv.y);
  // 亮度：窄高斯 + 宽高斯 → 锐化振铃（VHS 摄像机的"边缘增强"白边）
  float Y = 0., Yw = 0., ws = 0., wws = 0.;
  for (int i = -3; i <= 3; i++) { float fi = float(i); float w = exp(-fi * fi / (2. * lumaW * lumaW)); Y += dot(sig(q + vec2(fi * dx, 0.)), vec3(.299, .587, .114)) * w; ws += w; }
  for (int i = -4; i <= 4; i++) { float fi = float(i) * 1.8; float w = exp(-fi * fi / (2. * 12.)); Yw += dot(sig(q + vec2(fi * dx, 0.)), vec3(.299, .587, .114)) * w; wws += w; }
  Y /= ws; Yw /= wws;
  Y = Y + sharp * (Y - Yw);
  // 色度：宽窗平均、向右滞后
  vec2 IQ = vec2(0.); float cw = 0.;
  for (int i = -5; i <= 5; i++) { float fi = float(i) * chromaW * .4; float w = exp(-float(i * i) / 12.); IQ += (toYIQ * sig(q + vec2((fi - chromaShift) * dx, 0.))).yz * w; cw += w; }
  IQ /= cw;
  // 高光向右拖尾（亮灯的"彗尾"）
  float tail = 0.;
  for (int i = 1; i <= 6; i++) { float yy = dot(sig(q - vec2(float(i) * 2.5 * dx, 0.)), vec3(.299, .587, .114)); tail += max(yy - .82, 0.) * (1. - float(i) / 7.); }
  Y += tail * smear;
  // 色度噪声（低频横向色斑）+ 亮度噪声（横向拉长的颗粒，暗处更明显 = AGC）
  float px = floor((fc.x - x0) / bw * src.x / 1.5);
  float nY = (h2(vec2(px, line) + F * 7.3) - .5) + (h2(vec2(floor(px / 3.), line) + F * 3.1) - .5) * .6;
  Y += nY * gain * (1.3 - Y * .8);
  IQ += (vec2(vn1(uv.x * 38. + line * 3.1 + F * 17.), vn1(uv.x * 31. + line * 1.7 + F * 11.)) - .5) * gain * .5;
  IQ *= sat;
  vec3 c = toRGB * vec3(Y, IQ);
  // 跟踪带内：雪花 + 丢色
  if (track > 0.) { float sn = h2(vec2(floor(fc.x / 3.), line) + F * 31.); c = mix(c, vec3(sn), band * .8 * track); c = mix(c, vec3(dot(c, vec3(.33))), band * track); }
  if (hsw > 0.) c = mix(c, vec3(h2(vec2(px, line + F))), hsw * .35);
  // 掉磁：每帧 0~2 条短白线
  if (dropout > 0.) for (int k = 0; k < 3; k++) {
    float fk = float(k); float hk = h1(F * 3.7 + fk * 11.3);
    if (hk > .55) continue;
    float dl = floor(h1(F * 1.3 + fk * 5.1) * src.y), dxs = h1(F * 2.9 + fk * 7.7), dlen = .02 + .1 * h1(F * 4.1 + fk);
    if (abs(line - dl) < .6 && uv.x > dxs && uv.x < dxs + dlen) c = mix(c, vec3(.95), dropout * (1. - (uv.x - dxs) / dlen));
  }
  // 白平衡 / 曝光 / 黑电平 / 高光软削
  c *= tint * expo;
  c = c * (1. - black) + black;
  c = mix(c, (1. - exp(-c * 1.6)) / (1. - exp(-1.6)), smoothstep(.55, 1.2, c));   // 只在高光处软削
  // 暗角（镜头）
  vec2 d = (uv - .5) * vec2(1.25, 1.); c *= 1. - vig * smoothstep(.2, .85, length(d));
  c = mix(c, vec3(0.), off);
  gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
}`,
};
