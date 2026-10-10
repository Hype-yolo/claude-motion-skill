// 空间：手工路线 + 程序化填充的无尽办公格子间；自写光照着色器（上千盏日光灯来自一张数据贴图）
import * as THREE from 'three';
import { mulberry, hash } from '/core/lib.js';
import * as TX from './tex.js';

export const H = 2.7;                 // 吊顶高度
export const LX = 2.4, LZ = 2.4;      // 灯阵间距
export const LOX = 0.1, LOZ = 1.8;    // 灯阵原点偏移（让走廊中线、出口走廊中线正好有一排灯）
const WT = 0.16;                      // 墙厚
const LN = 128, LOFF = 64;   // 灯索引 i,j ∈ [-64, 63]            // 灯数据贴图 128×128，索引偏移

// ———————————————————— 布局 ————————————————————
// 墙 = 轴向线段 {a:'x'|'z', c: 常量坐标, s0, s1}（a='x' 表示墙沿 x 延伸、z = c）
export const WALLS = [];
const wx = (z, x0, x1) => WALLS.push({ a: 'x', c: z, s0: Math.min(x0, x1), s1: Math.max(x0, x1) });
const wz = (x, z0, z1) => WALLS.push({ a: 'z', c: x, s0: Math.min(z0, z1), s1: Math.max(z0, z1) });
// 主走廊 A：x ∈ [-1.6, 1.8]，从 z=3 向北延伸到雾里
const AW = -1.6, AE = 1.8;
[[3.2, -2.6], [-4.6, -6.0], [-8.8, -16.0], [-18.6, -21.5], [-24.2, -27.8], [-31.0, -38.5], [-41.2, -52], [-55, -63], [-66, -74], [-77.6, -88], [-90.4, -102], [-105, -140]].forEach(([a, b]) => wz(AW, a, b));
[[3.2, -3.2], [-6.2, -9.0], [-11.2, -14.2], [-16.4, -20.9], [-23.5, -27.2], [-30.5, -34.0], [-36.6, -45.5], [-48.5, -58], [-61, -70], [-72.4, -81], [-84, -97], [-99.4, -140]].forEach(([a, b]) => wz(AE, a, b));
wx(3.2, AW, AE);
// 出口走廊：z ∈ [-23.5, -20.9]，x 从 1.8 到 8.0；尽头墙上一扇门 + EXIT
export const EXIT = { x: 8.0, z: -22.2, doorW: 0.92, doorH: 2.1 };
wx(-20.9, AE, 8.0); wx(-23.5, AE, 8.0);
wz(8.0, -20.9, EXIT.z + EXIT.doorW / 2); wz(8.0, EXIT.z - EXIT.doorW / 2, -23.5);
// 门后的小房间：x ∈ [8, 11.2]
wz(8.0, -19.6, -20.9); wz(8.0, -23.5, -24.8); wz(11.2, -19.6, -24.8); wx(-19.6, 8.0, 11.2); wx(-24.8, 8.0, 11.2);
const LINTEL = { x: 8.0, z0: EXIT.z - EXIT.doorW / 2, z1: EXIT.z + EXIT.doorW / 2, y0: EXIT.doorH };
// 禁区：程序化填充不许进入（路线与视线）
const KEEP = [
  [AW - 0.3, -145, AE + 0.3, 3.5],        // 主走廊
  [AE - 0.2, -23.9, 8.3, -20.5],         // 出口走廊
  [7.7, -25.2, 11.6, -19.2],             // 门后房间
  [-6, -1.5, AW, 1.5],                   // 开场墙背后（无所谓，但保持干净）
];
const inKeep = (x0, z0, x1, z1, m = 0.25) => KEEP.some(([a, b, c, d]) => x1 > a - m && x0 < c + m && z1 > b - m && z0 < d + m);
// 程序化填充：墙在 2.4 m 网格线上（与灯阵错开），随机长度，合并共线段
{
  const R = mulberry(1234);
  const GX = x => 2.4 * x + 1.3, GZ = z => 2.4 * z + 0.6;
  for (let i = -18; i <= 18; i++) for (let j = -62; j <= 2; j++) {
    const x = GX(i), z = GZ(j);
    if (R() < 0.21 && !inKeep(x, z - WT, x + 2.4, z + WT)) wx(z, x, x + 2.4);
    if (R() < 0.21 && !inKeep(x - WT, z, x + WT, z + 2.4)) wz(x, z, z + 2.4);
  }
}
// 柱子
export const PILLARS = [];
{
  const R = mulberry(77);
  for (let i = -18; i <= 18; i++) for (let j = -40; j <= 2; j++) {
    const x = 2.4 * i + 1.3, z = 2.4 * j + 0.6;
    if (R() < 0.07 && !inKeep(x - .3, z - .3, x + .3, z + .3, .5)) PILLARS.push([x, z]);
  }
  PILLARS.push([-0.9, -30.6]);   // 主走廊里一根柱子（远景层次）
}

// ———————————————————— 灯阵数据 ————————————————————
export const lightData = new Float32Array(LN * LN * 4);
export const lightTex = new THREE.DataTexture(lightData, LN, LN, THREE.RGBAFormat, THREE.FloatType);
lightTex.magFilter = lightTex.minFilter = THREE.NearestFilter;
export const LIGHTS = [];   // {i, j, x, z, base, col:[r,g,b], kind}
const wallHitsRect = (x0, z0, x1, z1) => WALLS.some(w => w.a === 'x'
  ? (w.c + WT / 2 > z0 && w.c - WT / 2 < z1 && w.s1 > x0 && w.s0 < x1)
  : (w.c + WT / 2 > x0 && w.c - WT / 2 < x1 && w.s1 > z0 && w.s0 < z1));
{
  const R = mulberry(99);
  for (let i = -LOFF; i < LOFF; i++) for (let j = -LOFF; j < LOFF; j++) {
    const x = LX * i + LOX, z = LZ * j + LOZ;
    if (Math.abs(x) > 60 || z > 12 || z < -150) continue;
    if (wallHitsRect(x - .32, z - .62, x + .32, z + .62)) continue;
    const r = R();
    const warm = (R() - .5) * 0.16, green = R() * 0.07;
    let kind = r < 0.035 ? 'dead' : r < 0.06 ? 'flicker' : 'ok';
    // 主走廊远处的暗区：它站在那里
    if (Math.abs(x - LOX) < 5.5 && z < -44 && z > -70) kind = 'dead';   // 它站在 z=-52.4：头顶和身后都是暗的
    if (Math.abs(x - LOX) < 5.5 && z <= -70) kind = 'dim';                // 更远处只剩微光：剪影是暗底上的更暗一块
    // 出口走廊靠门的两盏灭着：让红色标志在暗处发光；门后房间亮着（开门时光漏出来）
    if (Math.abs(z + 22.2) < .5 && x > 4 && x < 8) kind = 'dead';
    // 路线上关键区域保证亮
    if (Math.abs(x - LOX) < .5 && z > -30 && z < 3 && kind !== 'ok') kind = 'ok';
    if (Math.abs(z + 22.2) < .5 && ((x > 1 && x < 4) || (x > 8 && x < 12))) kind = 'ok';
    const base = kind === 'dead' ? 0 : kind === 'dim' ? 0.12 + R() * 0.08 : 0.85 + R() * 0.3;
    LIGHTS.push({ i, j, x, z, base, col: [1 + warm, 1 + green, 0.84 - warm * 0.6], kind, ph: R() * 100 });
  }
}
// 每帧更新：g = 全局亮度（灯闪），extra(i,j) → 覆盖倍数
export function updateLights(t, g = 1, extra = null) {
  lightData.fill(0);
  for (const L of LIGHTS) {
    let k = L.base;
    if (L.kind === 'flicker') {   // 坏灯管：大部分时间亮，偶尔短暂熄灭/发颤
      const s = Math.floor(t * 24 + L.ph), h1 = hash(s * 1.7 + L.ph), h2 = hash(Math.floor(t * 1.3 + L.ph));
      k *= h2 < 0.35 ? (h1 < 0.5 ? 0.15 : 0.9) : 1.0;
    }
    if (extra) k *= extra(L, t);
    const o = ((L.j + LOFF) * LN + (L.i + LOFF)) * 4;
    lightData[o] = L.col[0] * k * g; lightData[o + 1] = L.col[1] * k * g; lightData[o + 2] = L.col[2] * k * g; lightData[o + 3] = 1;
  }
  lightTex.needsUpdate = true;
}

// ———————————————————— 着色器 ————————————————————
export const U = {
  uLights: { value: lightTex }, uAmb: { value: 0.16 }, uI: { value: 2.2 },
  uExitPos: { value: new THREE.Vector3(EXIT.x - 0.12, 2.32, EXIT.z) }, uExitI: { value: 0.0 },
  uFogCol: { value: new THREE.Color(0.19, 0.16, 0.075) }, uFogD: { value: 0.032 }, uFogG: { value: 1 },
  uTime: { value: 0 },
};
const VS = `
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const COMMON = `
uniform sampler2D uLights; uniform float uAmb, uI, uExitI, uFogD, uFogG, uTime; uniform vec3 uExitPos, uFogCol;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int k = 0; k < 5; k++){ s += a * vn(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
// 灯阵光照：周围 5×5 盏灯（每盏近似为朝下的面光源），外加一个随局部亮度走的"反弹光"
void lightAt(vec3 P, vec3 N, vec3 V, float shin, out vec3 dif, out vec3 spc, out vec3 amb){
  dif = vec3(0); spc = vec3(0); amb = vec3(0);
  float gi = floor((P.x - ${LOX.toFixed(2)}) / ${LX.toFixed(2)} + .5), gj = floor((P.z - ${LOZ.toFixed(2)}) / ${LZ.toFixed(2)} + .5);
  for (int di = -2; di <= 2; di++) for (int dj = -2; dj <= 2; dj++) {
    float i = gi + float(di), j = gj + float(dj);
    vec4 L = texture2D(uLights, (vec2(i, j) + ${LOFF}.5) / ${LN}.);
    if (L.a < .5) continue;
    vec3 lp = vec3(i * ${LX.toFixed(2)} + ${LOX.toFixed(2)}, ${(H - 0.02).toFixed(2)}, j * ${LZ.toFixed(2)} + ${LOZ.toFixed(2)});
    vec3 d = lp - P; float d2 = dot(d, d); vec3 l = d * inversesqrt(d2);
    float emit = .3 + .7 * max(l.y, 0.);
    float ndl = max(dot(N, l), 0.);
    dif += L.rgb * ndl * emit / (d2 + .3);
    if (shin > 0.) { vec3 hv = normalize(l + V); spc += L.rgb * pow(max(dot(N, hv), 0.), shin) * emit / (d2 + .3); }
    vec2 dh = d.xz; amb += L.rgb / (dot(dh, dh) + 3.);
  }
  dif *= uI; spc *= uI; amb *= uAmb;
  // 出口标志的红光
  if (uExitI > 0.) { vec3 d = uExitPos - P; float d2 = dot(d, d); vec3 l = d * inversesqrt(d2);
    dif += vec3(1., .08, .04) * uExitI * (max(dot(N, l), 0.) * .9 + .04) / (d2 + .15); }
}
vec3 fog(vec3 c, vec3 P){ float d = length(P - cameraPosition); float f = 1. - exp(-d * uFogD); return mix(c, uFogCol * uFogG, f); }
// 雾的颜色跟着当地的亮度走：灭灯的地方雾也暗（剪影才会是"光里的一个洞"）
vec3 fogA(vec3 c, vec3 P, vec3 a){ float d = length(P - cameraPosition); float f = 1. - exp(-d * uFogD);
  float k = clamp(dot(a, vec3(.333)) / (.2 * uAmb / .16), .15, 1.25); return mix(c, uFogCol * uFogG * k, f); }
`;
function mat(frag, extraU = {}, defs = {}) {
  return new THREE.ShaderMaterial({ uniforms: { ...U, ...extraU }, vertexShader: VS, fragmentShader: COMMON + frag, defines: defs });
}

// 墙：墙纸（按法线选世界坐标 UV）+ 幅与幅之间的褪色差 + 水渍 + 踢脚线
const WALL_FS = `
uniform sampler2D map;
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
  float u = abs(N.x) > .5 ? vW.z * sign(N.x) : -vW.x * sign(N.z);
  float roll = floor(u / .53);
  vec3 alb = texture2D(map, vec2(u / .53, vW.y / .53)).rgb;
  alb *= .92 + .12 * h21(vec2(roll, 3.1));                       // 每幅墙纸褪色程度不同
  float st = fbm(vec2(u * .9, vW.y * 1.4) + 5.);               // 大块污渍
  alb *= mix(vec3(1.), vec3(.82, .74, .55), smoothstep(.55, .78, st) * .8);
  float wmask = smoothstep(.45, .65, fbm(vec2(u * .23, 7.)));   // 只有部分墙段有水渍
  float wet = (fbm(vec2(u * .8, 3.)) * .5 + .05) * wmask;       // 墙根水渍（高度不一的潮痕）
  float tide = smoothstep(wet + .05, wet - .06, vW.y) * wmask;
  alb *= mix(vec3(1.), vec3(.74, .63, .42), tide * .55);
  alb *= 1. - .2 * smoothstep(.04, 0., abs(vW.y - wet)) * step(.15, wet);   // 潮痕的深色边
  alb *= mix(vec3(1.), vec3(.86, .8, .62), smoothstep(${(H - 0.35).toFixed(2)}, ${H.toFixed(2)}, vW.y) * .6); // 吊顶下的烟黄
  // 接缝翘边：幅边一条细暗线 + 旁边一点亮
  float sx = fract(u / .53) * .53;
  alb *= 1. - .4 * smoothstep(.008, 0., sx) * step(.3, h21(vec2(roll, 7.)));
  alb *= 1. + .12 * smoothstep(.012, .004, abs(sx - .012)) * step(.3, h21(vec2(roll, 7.)));
  // 个别幅的接缝在上半段翘起：露出发白的纸背（三角）+ 下面一道阴影
  if (h21(vec2(roll, 11.)) > .93) {
    float y0 = ${(H - 0.3).toFixed(2)} - 1.1 * h21(vec2(roll, 13.)), k = clamp((vW.y - y0) / (${H.toFixed(2)} - y0), 0., 1.);
    float wpe = .075 * k * (vW.y > y0 ? 1. : 0.);
    float tri = step(sx, wpe);
    alb = mix(alb, vec3(.8, .75, .58), tri * .9);
    alb *= 1. - .4 * smoothstep(.025, 0., sx - wpe) * step(wpe, sx) * step(.001, wpe);
  }
  // 零星的小污渍（很少）
  float sp = vn(vec2(u * 3.1, vW.y * 3.1) + 40.);
  alb *= 1. - .22 * smoothstep(.86, .93, sp) * step(.6, h21(vec2(floor(u / 2.), 9.)));
  // 踢脚线
  if (vW.y < .1) alb = vec3(.30, .24, .15) * (.9 + .1 * vn(vec2(u * 30., 1.)));
  vec3 d, s, a; lightAt(vW + N * .02, N, V, 0., d, s, a);
  vec3 c = alb * (d + a);
  gl_FragColor = vec4(fogA(c, vW, a), 1.);
}`;
// 地毯：绒面 + 潮湿发暗的斑块（更暗更亮滑）+ 靠墙更脏
const FLOOR_FS = `
uniform sampler2D map;
void main(){
  vec3 N = vec3(0, 1, 0); vec3 V = normalize(cameraPosition - vW);
  vec3 alb = texture2D(map, vW.xz / .9).rgb;
  alb *= .9 + .2 * vn(vW.xz * 1.3);
  float damp = smoothstep(.5, .68, fbm(vW.xz * .45 + 3.));
  alb *= mix(1., .6, damp);
  alb = mix(alb, alb * vec3(.95, .9, .8), smoothstep(.6, .8, fbm(vW.xz * 1.1)) * .5);
  alb *= .88 + .24 * fbm(vW.xz * 7.);                                          // 近看的绒面斑驳
  alb *= 1. - .16 * smoothstep(.64, .72, fbm(vW.xz * 2.3 + 11.));                 // 小块湿印
  vec3 d, s, a; lightAt(vW, N, V, 22., d, s, a);
  vec3 c = alb * (d + a * .7) + s * (.012 + .09 * damp) * vec3(1., .95, .8);
  gl_FragColor = vec4(fogA(c, vW, a), 1.);
}`;
// 吊顶：矿棉板 + 龙骨 + 个别板子的黄褐水渍
const CEIL_FS = `
uniform sampler2D map;
void main(){
  vec3 N = vec3(0, -1, 0); vec3 V = normalize(cameraPosition - vW);
  vec2 q = vec2((vW.x + .2) / 1.2, (vW.z - 1.2) / 1.2);
  vec3 alb = texture2D(map, q).rgb;
  vec2 tile = floor(vec2((vW.x + .2) / .6, (vW.z - 1.2) / 1.2));
  float hs = h21(tile);
  alb *= .95 + .08 * hs;
  vec2 f0 = fract(vec2((vW.x + .2) / .6, (vW.z - 1.2) / 1.2));
  bool inner = f0.x > .03 && f0.x < .97 && f0.y > .015 && f0.y < .985;
  float kind = h21(tile + 71.);
  bool missing = kind > .992 && inner, vent = kind > .972 && kind <= .992, yell = kind > .93 && kind <= .972;
  if (yell) alb *= mix(vec3(.93, .86, .7), vec3(.8, .68, .45), smoothstep(.2, .5, length(f0 - .5)));   // 整块发黄的板
  if (vent) { vec2 g = (f0 - .5) * vec2(1., 2.); float sq = step(max(abs(g.x), abs(g.y)), .38);          // 回风口：方形格栅
    float slot = step(.5, fract(g.y * 11.)); alb = mix(alb, mix(vec3(.2, .19, .16), vec3(.78, .76, .7), slot), sq);
    alb *= 1. - .3 * sq * step(.34, max(abs(g.x), abs(g.y))); }
  if (hs > .93 && !vent && !missing) { vec2 f = fract(vec2((vW.x + .2) / .6, (vW.z - 1.2) / 1.2)) - .5; f.x *= .5;
    float r = length(f + (vec2(h21(tile + 3.), h21(tile + 5.)) - .5) * .3); float ring = smoothstep(.22, .19, r) * (.5 + .5 * smoothstep(.12, .2, r));
    alb *= mix(vec3(1.), vec3(.72, .58, .34), ring * .8); }
  vec3 d, s, a; lightAt(vW - vec3(0, .05, 0), N, V, 0., d, s, a);
  vec3 c = alb * (d * .55 + a * 1.05);
  if (missing) c = vec3(.012, .01, .008) * (1. + 2. * smoothstep(.3, .0, min(min(f0.x, 1. - f0.x), min(f0.y, 1. - f0.y) * 2.)));   // 缺了一块：黑洞，边缘有一点点光
  gl_FragColor = vec4(fogA(c, vW, a), 1.);
}`;
// 日光灯板：发光区 = 贴图亮度 × 每盏灯自己的颜色与亮度
const TROF_FS = `
uniform sampler2D map; uniform float uEmit;
void main(){
  vec2 cell = vec2(floor((vW.x - ${LOX.toFixed(2)}) / ${LX.toFixed(2)} + .5), floor((vW.z - ${LOZ.toFixed(2)}) / ${LZ.toFixed(2)} + .5));
  vec4 L = texture2D(uLights, (cell + ${LOFF}.5) / ${LN}.);
  vec3 tx = texture2D(map, vUv).rgb;
  float glow = smoothstep(.75, .95, dot(tx, vec3(.33)));
  vec3 c = mix(tx * .25 * (L.rgb * .3 + .05), tx * L.rgb * uEmit, glow);
  gl_FragColor = vec4(fog(c, vW), 1.);
}`;
// 通用：贴图或纯色的漫反射物体（告示、软木板、门、插座、鞋裤……）
const PAINT_FS = `
uniform sampler2D map; uniform vec3 color; uniform float useMap, shin, spec, emit;
void main(){
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N; vec3 V = normalize(cameraPosition - vW);
  vec3 alb = color; if (useMap > .5) alb *= texture2D(map, vUv).rgb;
  vec3 d, s, a; lightAt(vW + N * .02, N, V, shin, d, s, a);
  vec3 c = alb * (d + a) + s * spec + alb * emit;
  gl_FragColor = vec4(fogA(c, vW, a), 1.);
}`;
// 剪影：alpha 测试，几乎不受光（只吃一点点），吃雾
const SIL_FS = `
uniform sampler2D map;
void main(){
  vec4 tx = texture2D(map, vUv); if (tx.a < .5) discard;
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
  vec3 d, s, a; lightAt(vW + N * .05, N, V, 0., d, s, a);
  vec3 c = vec3(.012, .011, .009) * (d + a);
  gl_FragColor = vec4(fogA(c, vW, a), 1.);
}`;
export function silhouetteMat(map) { const m = mat(SIL_FS, { map: { value: map } }); m.side = THREE.DoubleSide; return m; }
export function paint(o = {}) {
  return mat(PAINT_FS, {
    map: { value: o.map || null }, color: { value: new THREE.Color(o.color ?? '#ffffff') }, useMap: { value: o.map ? 1 : 0 },
    shin: { value: o.shin ?? 0 }, spec: { value: o.spec ?? 0 }, emit: { value: o.emit ?? 0 },
  });
}

// ———————————————————— 几何 ————————————————————
function boxInto(pos, nor, uv, x0, y0, z0, x1, y1, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const ni = g.toNonIndexed();
  pos.push(...ni.attributes.position.array); nor.push(...ni.attributes.normal.array); uv.push(...ni.attributes.uv.array);
}
function merged(pos, nor, uv) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

export function buildWorld(scene) {
  const T = { wall: TX.wallpaper(), carpet: TX.carpet(), ceil: TX.ceiling(), trof: TX.troffer() };
  // 墙 + 柱 + 门楣
  const P = [], N = [], UV = [];
  for (const w of WALLS) {
    if (w.a === 'x') boxInto(P, N, UV, w.s0, 0, w.c - WT / 2, w.s1, H, w.c + WT / 2);
    else boxInto(P, N, UV, w.c - WT / 2, 0, w.s0, w.c + WT / 2, H, w.s1);
  }
  for (const [x, z] of PILLARS) boxInto(P, N, UV, x - .24, 0, z - .24, x + .24, H, z + .24);
  boxInto(P, N, UV, LINTEL.x - WT / 2, LINTEL.y0, LINTEL.z0, LINTEL.x + WT / 2, H, LINTEL.z1);
  const walls = new THREE.Mesh(merged(P, N, UV), mat(WALL_FS, { map: { value: T.wall } }));
  scene.add(walls);
  // 地毯 / 吊顶
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), mat(FLOOR_FS, { map: { value: T.carpet } }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -40); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), mat(CEIL_FS, { map: { value: T.ceil } }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, -40); scene.add(ceil);
  // 灯板：合并成一个网格
  const tp = [], tn = [], tu = [];
  for (const L of LIGHTS) {
    const x0 = L.x - .3, x1 = L.x + .3, z0 = L.z - .6, z1 = L.z + .6, y = H - .004;
    tp.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z0, x1, y, z1, x0, y, z1);
    for (let k = 0; k < 6; k++) tn.push(0, -1, 0);
    tu.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  }
  const trofMat = mat(TROF_FS, { map: { value: T.trof }, uEmit: { value: 5.0 } });
  const trof = new THREE.Mesh(merged(tp, tn, tu), trofMat); scene.add(trof);
  return { walls, floor, ceil, trof, trofMat, T };
}

// 道具：告示（软木板上 / 直接贴墙）、出口标志、门、插座
export function buildProps(scene) {
  const out = {};
  const corkT = TX.cork(), rulesT = TX.notice('rules', { age: .8, seed: 5 }), rules2T = TX.notice('rules', { age: .9, seed: 6 }), sixT = TX.notice('six', { age: .2, seed: 8 });
  const NW = .34, NH = .46;
  // 1) 开场：西墙上的软木板 + 告示（朝 +x）
  {
    const g = new THREE.Group(); g.position.set(AW + WT / 2, 0, 0); g.rotation.y = Math.PI / 2;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(.86, .66, .03), paint({ color: '#5a4630' })); frame.position.set(0, 1.45, .015);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(.8, .6), paint({ map: corkT })); board.position.set(0, 1.45, .031);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(NW * .95, NH * .95), paint({ map: rulesT })); sheet.position.set(.08, 1.44, .034); sheet.rotation.z = -.015;
    // 一张旧便条（别的员工留下的）+ 图钉
    const memo = new THREE.Mesh(new THREE.PlaneGeometry(.12, .1), paint({ color: '#e9df9a' })); memo.position.set(-.26, 1.58, .033); memo.rotation.z = .08;
    g.add(frame, board, sheet, memo);
    for (const [px, py] of [[-.07, 1.64], [.23, 1.64], [-.26, 1.625]]) { const pin = new THREE.Mesh(new THREE.SphereGeometry(.009, 8, 6), paint({ color: '#b3261e', shin: 40, spec: .3 })); pin.position.set(px, py, .04); g.add(pin); }
    scene.add(g); out.board1 = g;
  }
  // 2) 同一张告示又出现在主走廊西墙（直接用胶带贴在墙纸上，稍微歪）
  {
    const g = new THREE.Group(); g.position.set(AW + WT / 2 + .002, 0, -12.62); g.rotation.y = Math.PI / 2;
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(NW, NH), paint({ map: rules2T })); sheet.position.set(0, 1.4, .002); sheet.rotation.z = .02;
    g.add(sheet);
    for (const [px, py, r] of [[-.15, 1.62, .5], [.15, 1.625, -.4], [-.155, 1.18, -.5], [.16, 1.175, .6]]) {
      const tape = new THREE.Mesh(new THREE.PlaneGeometry(.06, .02), paint({ color: '#d8c98a', spec: .02 })); tape.position.set(px, py, .004); tape.rotation.z = r; g.add(tape);
    }
    scene.add(g); out.sheet2 = g;
  }
  // 3) 门后房间东墙：第 6 条
  {
    const g = new THREE.Group(); g.position.set(11.2 - WT / 2 - .002, 0, EXIT.z); g.rotation.y = -Math.PI / 2;
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(NW, NH), paint({ map: sixT })); sheet.position.set(0, 1.42, .002);
    g.add(sheet);
    for (const [px, py, r] of [[-.15, 1.64, .4], [.15, 1.645, -.5]]) {
      const tape = new THREE.Mesh(new THREE.PlaneGeometry(.06, .02), paint({ color: '#e6dcae' })); tape.position.set(px, py, .004); tape.rotation.z = r; g.add(tape);
    }
    scene.add(g); out.sheet6 = g;
  }
  // 出口标志：门上方，朝 −x（朝向走廊）
  {
    const g = new THREE.Group(); g.position.set(EXIT.x - WT / 2, 2.34, EXIT.z); g.rotation.y = -Math.PI / 2;
    const box = new THREE.Mesh(new THREE.BoxGeometry(.38, .2, .07), paint({ color: '#d9d4c4' })); box.position.z = .035;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(.34, .17), paint({ map: TX.exitSign(), color: '#ffffff', emit: 9 }));
    face.position.z = .0705; g.add(box, face); scene.add(g); out.exit = g; out.exitFace = face;
  }
  // 门：铰链在南侧（z 大的一边），向房间里（+x）开
  {
    const pivot = new THREE.Group(); pivot.position.set(EXIT.x + WT / 2, 0, EXIT.z + EXIT.doorW / 2);
    const door = new THREE.Mesh(new THREE.BoxGeometry(.045, EXIT.doorH - .01, EXIT.doorW - .02), paint({ color: '#a39a86', shin: 30, spec: .05 }));
    door.position.set(-.03, EXIT.doorH / 2, -(EXIT.doorW - .02) / 2); pivot.add(door);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(.05, .04, .6), paint({ color: '#6f6a5e', shin: 60, spec: .4 })); bar.position.set(-.075, 1.0, -.46); pivot.add(bar);
    const kick = new THREE.Mesh(new THREE.BoxGeometry(.047, .25, EXIT.doorW - .03), paint({ color: '#6c6556', shin: 20, spec: .1 })); kick.position.set(-.03, .14, -(EXIT.doorW - .02) / 2); pivot.add(kick);
    scene.add(pivot); out.door = pivot;
    // 门框
    const fm = paint({ color: '#7d7462', shin: 20, spec: .05 });
    for (const dz of [-EXIT.doorW / 2 - .03, EXIT.doorW / 2 + .03]) { const j = new THREE.Mesh(new THREE.BoxGeometry(.2, EXIT.doorH + .05, .06), fm); j.position.set(EXIT.x, (EXIT.doorH + .05) / 2, EXIT.z + dz); scene.add(j); }
    const hd = new THREE.Mesh(new THREE.BoxGeometry(.2, .06, EXIT.doorW + .12), fm); hd.position.set(EXIT.x, EXIT.doorH + .03, EXIT.z); scene.add(hd);
  }
  // 插座（只放在路线墙上，离地 0.3 m）
  {
    const ot = TX.outlet(), m = paint({ map: ot });
    const spots = [[AW, -3.0, 1], [AE, -9.5, -1], [AW, -19.5, 1], [AE, -26.5, -1], [AW, -33, 1], [AE, 1.0, -1]];
    for (const [x, z, s] of spots) { const o = new THREE.Mesh(new THREE.PlaneGeometry(.07, .12), m); o.position.set(x + s * (WT / 2 + .003), .32, z); o.rotation.y = s * Math.PI / 2; scene.add(o); }
    // 出口走廊南墙一个
    const o = new THREE.Mesh(new THREE.PlaneGeometry(.07, .12), m); o.position.set(5.2, .32, -20.9 - WT / 2 - .003); o.rotation.y = Math.PI; scene.add(o);
  }
  return out;
}
