// 程序化小城：路网、街区、带窗建筑（着色器开窗 + 夜间亮窗）、屋顶细节、树、路灯、红绿灯、公园池塘、工地塔吊、学校跑道、停车场、火车站与铁轨、屋顶霓虹招牌、郊区与农田
import * as THREE from 'three';
import { GB } from './geo.js';
import { mulberry, clamp } from '/core/lib.js';

export const AV = [-360, -270, -180, -90, 0, 90, 180, 270, 360];   // 南北向大道（x 坐标）
export const ST = [-240, -180, -120, -60, 0, 60, 120, 180, 240];   // 东西向街道（z 坐标）
export const avW = x => x === 0 ? 24 : 12;
export const stW = z => z === 0 ? 20 : 12;
export const SW = 4;                                  // 人行道宽
export const CURB = .16;
export const RAIL = { zA: -281, zB: -290.5, pz0: -287.4, pz1: -283.1, px0: -95, px1: 95 };
export const EXT = { x0: -450, x1: 450, z0: -272, z1: 300 };
export const PARK = { x0: 12, x1: 84, z0: 10, z1: 54 };
export const POND = { x: 44, z: 34, rx: 20, rz: 11 };
export const ZEBRA_Z = 30;
export const SIGN = { x: -52, z: -76, y: 0 };        // 屋顶霓虹招牌所在楼（y 在建造时填）
export const U = { night: { value: 0 }, sky: { value: new THREE.Color('#8fb4d8') }, sun: { value: 1 }, lit: { value: 1 } };

const FACADE = ['#efe6d6', '#e9d9bd', '#d9c3a0', '#c9784f', '#b85c45', '#e8c872', '#f0d9a8', '#d8e2dc', '#a9c5c2', '#c8d0d8', '#9fb3c8', '#e3a58c', '#f2ece2', '#cfc6b8', '#8e9aa6', '#dcb67a'];
const TOWER = ['#9fb3c8', '#b8c4cc', '#7f95a8', '#c9d3d8', '#d9d4c8', '#6f8596'];
const ROOF = ['#8b8a86', '#a09c94', '#6e6c69', '#b7b2a8', '#7d7870', '#9a8f80', '#c2bcb0', '#5f5c58'];
const TILE = ['#b4553c', '#9c4a36', '#c26a48', '#7a5a4a', '#5f6770', '#a8543f'];

// —— 建筑材质：着色器开窗、夜间亮窗、玻璃更光滑 ——
export function buildingMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: 0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uNight = U.night; sh.uniforms.uSky = U.sky; sh.uniforms.uLit = U.lit;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 wp; varying vec3 vWp; varying vec2 vFac; varying vec3 vWP;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvWp = wp; vFac = uv; vWP = (modelMatrix * vec4(position, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; varying vec2 vFac; varying vec3 vWP; uniform float uNight; uniform vec3 uSky; uniform float uLit;
      float hh(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.x+p.y)*p.z); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); float a = hh(vec3(i,1.)), b = hh(vec3(i+vec2(1,0),1.)), c = hh(vec3(i+vec2(0,1),1.)), d = hh(vec3(i+vec2(1,1),1.)); return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
      float gWin = 0.; float gLit = 0.; const float CURB_Y = ${CURB.toFixed(2)};`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { float gn = vn(vWP.xz * .7 + vWP.y * .13) * .6 + vn(vWP.xz * 3.1 - vWP.y * .9) * .4; diffuseColor.rgb *= .9 + .18 * gn; diffuseColor.rgb *= mix(.62, 1., smoothstep(CURB_Y, CURB_Y + 2.6, vWP.y)); }
      if (vFac.x >= 0. && vWp.x > 0.) {
        vec2 cs = vWp.xy; vec2 q = vFac / cs; vec2 id = floor(q); vec2 f = fract(q);
        float gf = step(vFac.y, vWp.y + ${CURB.toFixed(2)});
        float ty = floor(vWp.z / 1000.);
        float wx = .24, wy0 = .32, wy1 = .82;
        if (ty == 1.) { wx = .03; wy0 = .36; wy1 = .78; }
        else if (ty == 2.) { wx = .05; wy0 = .07; wy1 = .95; }
        else if (ty == 3.) { wx = .32; wy0 = .34; wy1 = .76; }
        if (gf > .5) { wx = .06; wy0 = .06; wy1 = .8; }
        vec2 fw = fwidth(q) * 1.2;
        float win = smoothstep(wx-fw.x, wx+fw.x, f.x) * (1.-smoothstep(1.-wx-fw.x, 1.-wx+fw.x, f.x))
                  * smoothstep(wy0-fw.y, wy0+fw.y, f.y) * (1.-smoothstep(wy1-fw.y, wy1+fw.y, f.y));
        float lod = clamp(max(fw.x, fw.y) * 2.5 - .35, 0., 1.);
        win = mix(win, (1.-2.*wx)*(wy1-wy0), lod);
        float r = hh(vec3(id, fract(vWp.z / 1000.) * 97.));
        vec3 glass = mix(vec3(.05,.07,.10), uSky * .8, .2 + .4*r);
        if (gf > .5) glass = mix(vec3(.06,.06,.07), vec3(.42,.36,.3), .35*r);
        gWin = win;
        float inY = (f.y - wy0) / (wy1 - wy0), inX = (f.x - wx) / (1. - 2.*wx);
        glass *= mix(1., .55 + .45 * smoothstep(.72, 1., 1. - inY) , 1. - lod) * mix(1., .75 + .25 * smoothstep(0., .18, inX), 1. - lod);
        float frame = win * (1. - smoothstep(0., fw.y * 2.5 + .03, min(min(inY, 1. - inY) * (wy1-wy0) * cs.y, min(inX, 1.-inX) * (1.-2.*wx) * cs.x) - .06));
        diffuseColor.rgb = mix(diffuseColor.rgb, glass, win);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.92, .91, .88), frame * (1. - lod) * .7);
        // 顶部女儿墙一条暗线、楼层之间的腰线
        float band = 1. - smoothstep(0., fw.y*2., abs(f.y - .02)) * .12 * (1.-lod);
        diffuseColor.rgb *= band;
        gLit = win * step(r, .2) * step(.55, hh(vec3(vWp.z, id.y, id.x*.37))) * (1. - lod * .6) * step(hh(vec3(id.yx, 3.3)), uLit);
      }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, floor(vWp.z / 1000.) == 2. ? .08 : .22, gWin);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      metalnessFactor = mix(metalnessFactor, .35, gWin);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += gLit * uNight * vec3(1.0, .72, .42) * 1.25;`);
  };
  return m;
}

export function buildCity(scene) {
  const R = mulberry(20260925);
  const bld = new GB(), plain = new GB(), mark = new GB(), grass = new GB();
  const trees = [], lamps = [], tlights = [], props = [];
  const blocks = [], bl = [];

  // —— 街区划分 ——
  const xs = [EXT.x0 + 6, ...AV, EXT.x1 - 6], zs = [EXT.z0 + 6, ...ST, EXT.z1 - 6];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const xa = xs[i], xb = xs[i + 1], za = zs[j], zb = zs[j + 1];
    const x0 = xa + (AV.includes(xa) ? avW(xa) / 2 : 0), x1 = xb - (AV.includes(xb) ? avW(xb) / 2 : 0);
    const z0 = za + (ST.includes(za) ? stW(za) / 2 : 0), z1 = zb - (ST.includes(zb) ? stW(zb) / 2 : 0);
    blocks.push({ i, j, x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 });
  }
  const find = (x, z) => blocks.find(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
  const special = new Map();
  special.set(find(40, 30), 'park');
  special.set(find(130, -90), 'construction');
  special.set(find(-130, 90), 'school');
  special.set(find(130, 30), 'parking');
  special.set(find(-40, 30), 'plaza');
  special.set(find(0 + 1, -260), 'station');      // 大道北端与铁路之间
  special.set(find(-1, -260), 'station');
  special.set(find(-220, -30), 'pool');

  // —— 人行道底座 ——
  for (const b of blocks) plain.box(b.x0, b.x1, 0, CURB, b.z0, b.z1, '#c7c3ba', '#c9c5bc');

  // —— 建筑 ——
  const downtown = (x, z) => Math.exp(-((x * x) / (230 * 230) + (z * z) / (190 * 190)));
  function building(x0, x1, z0, z1, floors, o = {}) {
    const fh = o.fh || 3.1 + R() * .4, h = floors * fh + CURB;
    const ty = o.ty ?? (floors > 9 ? (R() < .6 ? 2 : 1) : R() < .55 ? 0 : R() < .5 ? 3 : 1);
    const bay = o.bay || (ty === 2 ? 1.6 + R() * .5 : ty === 3 ? 2.6 + R() * .8 : 1.9 + R() * .9);
    const wall = o.wall || FACADE[Math.floor(R() * FACADE.length)], roof = o.roof || ROOF[Math.floor(R() * ROOF.length)];
    bld.box(x0, x1, CURB, h, z0, z1, wall, roof, { facade: true, wp: [bay, fh, ty * 1000 + R() * 97] });
    bl.push({ x0, x1, z0, z1, h });
    // 底商雨篷（彩色条纹）
    if (floors >= 2 && R() < .4 && ty !== 2) {
      const AW = ['#d8412f', '#2f8a5a', '#2b6cb0', '#f2b705', '#e07b39', '#7a4a8c', '#1f6b6b'][Math.floor(R() * 7)], y = CURB + fh * .95, dp = 1.4;
      plain.box(x0 + .5, x1 - .5, y, y + .35, z1, z1 + dp, AW); plain.box(x0 + .5, x1 - .5, y, y + .35, z0 - dp, z0, AW);
      plain.box(x1, x1 + dp, y, y + .35, z0 + .5, z1 - .5, AW); plain.box(x0 - dp, x0, y, y + .35, z0 + .5, z1 - .5, AW);
    }
    // 女儿墙
    const pw = .35, ph = .7;
    if (!o.noParapet && (x1 - x0) > 4) {
      plain.box(x0, x1, h, h + ph, z0, z0 + pw, wall); plain.box(x0, x1, h, h + ph, z1 - pw, z1, wall);
      plain.box(x0, x0 + pw, h, h + ph, z0, z1, wall); plain.box(x1 - pw, x1, h, h + ph, z0, z1, wall);
    }
    // 屋顶细节：空调机组、楼梯间、水塔
    const w = x1 - x0, d = z1 - z0;
    if (w > 6 && d > 6) {
      const n = 1 + Math.floor(R() * 4);
      for (let k = 0; k < n; k++) {
        const s = 1 + R() * 1.6, px = x0 + 1.2 + R() * (w - 2.4 - s), pz = z0 + 1.2 + R() * (d - 2.4 - s);
        plain.box(px, px + s, h, h + .8 + R() * .8, pz, pz + s * (.7 + R() * .8), R() < .5 ? '#d9d9d6' : '#9ea3a8');
      }
      if (R() < .35) { const s = 3 + R() * 2, px = x0 + 1 + R() * (w - s - 2), pz = z0 + 1 + R() * (d - s - 2); plain.box(px, px + s, h, h + 2.6, pz, pz + s, wall, roof); }
      if (R() < .22 && floors > 4) {   // 木水塔
        const px = x0 + 2 + R() * (w - 4), pz = z0 + 2 + R() * (d - 4);
        for (const [ox, oz] of [[-.9, -.9], [.9, -.9], [-.9, .9], [.9, .9]]) plain.box(px + ox - .1, px + ox + .1, h, h + 2, pz + oz - .1, pz + oz + .1, '#4a4440');
        plain.cyl(px, pz, 1.5, h + 2, h + 4.6, '#8b6a4c', 10); plain.cyl(px, pz, 1.6, h + 4.6, h + 5.3, '#5a4a40', 10);
      }
      if (R() < .12) grass.box(x0 + .8, x1 - .8, h + .02, h + .12, z0 + .8, z1 - .8, '#6f9a4a', '#77a352', { noSides: true });   // 屋顶绿化
      if (R() < .3) { const px = x0 + 1 + R() * (w - 2), pz = z0 + 1 + R() * (d - 2), ah = 2.5 + R() * 4; plain.box(px - .06, px + .06, h, h + ah, pz - .06, pz + .06, '#6a6e72'); plain.box(px - .7, px + .7, h + ah * .7, h + ah * .7 + .06, pz - .04, pz + .04, '#6a6e72'); }   // 天线
      if (R() < .18 && floors < 7) { const nx = Math.floor((w - 3) / 2.2); for (let k = 0; k < nx; k++) plain.box(x0 + 1.5 + k * 2.2, x0 + 3.3 + k * 2.2, h + .3, h + .45, z0 + 1.5, z0 + Math.min(d - 1.5, 5), '#27406e', '#2f4f8a'); }   // 太阳能板
      for (let k = 0; k < 2; k++) if (R() < .5) { plain.cyl(x0 + 1 + R() * (w - 2), z0 + 1 + R() * (d - 2), .3, h, h + .9, '#b8bcc0', 8); }   // 排风管
    }
    // 立面细节：窗下空调外机、阳台、底商招牌
    const faces = [[0, x0, x1, z1, 1], [0, x0, x1, z0, -1], [1, z0, z1, x1, 1], [1, z0, z1, x0, -1]];
    const unit = (f, a, y, wA, hh2, dp, col) => { const [ax, , , c, n] = f; if (ax === 0) plain.box(a - wA / 2, a + wA / 2, y, y + hh2, n > 0 ? c : c - dp, n > 0 ? c + dp : c, col); else plain.box(n > 0 ? c : c - dp, n > 0 ? c + dp : c, y, y + hh2, a - wA / 2, a + wA / 2, col); };
    const balc = ty === 0 && floors >= 3 && R() < .35, acP = ty === 2 ? .0 : .05;
    for (const f of faces) {
      const nb = Math.floor((f[2] - f[1]) / bay);
      for (let fl = 1; fl < floors; fl++) for (let bI = 0; bI < nb; bI++) {
        const a = f[1] + (bI + .5) * bay, y = CURB + fl * fh;
        if (balc && bI % 2 === 0 && f[0] === 0) { unit(f, a, y - .05, bay * .8, .14, .9, '#d8d4cc'); unit(f, a, y + .1, bay * .8, .8, .06, '#5a5f66'); }
        else if (R() < acP) unit(f, a, y + .15, .8, .55, .45, '#dedcd6');
      }
    }
    if (floors >= 2 && ty !== 2 && R() < .45) {   // 底商招牌
      const SC = ['#d8412f', '#2b6cb0', '#f2b705', '#2f8a5a', '#e07bb0', '#1f3b66', '#f4f1ea'];
      for (const f of faces) if (R() < .6) { const L2 = f[2] - f[1]; if (L2 < 6) continue; const sw = Math.min(L2 - 2, 3 + R() * 5), a = f[1] + 1 + R() * (L2 - 2 - sw) + sw / 2; unit(f, a, CURB + fh * .95 + .4, sw, .7, .25, SC[Math.floor(R() * SC.length)]); unit(f, a, CURB + fh * .95 + .6, sw * .7, .3, .27, '#f7f5ef'); }
    }
    return h;
  }
  // 塔楼（带退台）
  function tower(x0, x1, z0, z1, floors) {
    const wall = TOWER[Math.floor(R() * TOWER.length)], fh = 3.6, bay = 1.7 + R() * .5, ty = R() < .7 ? 2 : 1;
    const h1 = building(x0, x1, z0, z1, Math.floor(floors * .7), { wall, fh, bay, ty, noParapet: true });
    const ix = (x1 - x0) * .15, iz = (z1 - z0) * .15;
    return building(x0 + ix, x1 - ix, z0 + iz, z1 - iz, Math.ceil(floors * .3), { wall, fh, bay, ty, noParapet: false }) || h1;
  }
  function perimeter(b, zone) {
    const x0 = b.x0 + SW, x1 = b.x1 - SW, z0 = b.z0 + SW, z1 = b.z1 - SW;
    const W = x1 - x0, D = z1 - z0;
    const dmax = Math.min(24, D / 2 - 2), dmin = Math.min(12, dmax);
    const low = b.j === 0;
    const floorsAt = (x, z) => { if (low) return 1 + Math.floor(R() * 3); const f = downtown(x, z); let n = Math.round(2 + f * 4.5 + R() * (1.5 + 3 * f)); return clamp(n, 2, 10); };
    const lots = (a0, a1, cb) => { let a = a0; while (a < a1 - 4) { let w = 9 + R() * 14; if (a1 - (a + w) < 8) w = a1 - a; cb(a, a + w); a += w; } };
    const dN = dmin + R() * (dmax - dmin), dS = dmin + R() * (dmax - dmin);
    // 北排、南排（整宽）
    lots(x0, x1, (a, c) => { const d = dN * (.8 + R() * .2); const f = floorsAt(a, z0); if (f > 7 && R() < .3 && c - a > 14) tower(a, c, z0, z0 + d, f + 5); else building(a, c, z0, z0 + d, f); });
    lots(x0, x1, (a, c) => { const d = dS * (.8 + R() * .2); const f = floorsAt(a, z1); if (f > 7 && R() < .3 && c - a > 14) tower(a, c, z1 - d, z1, f + 5); else building(a, c, z1 - d, z1, f); });
    // 东西排（中段）
    const zA = z0 + dN, zB = z1 - dS;
    if (zB - zA > 8) {
      const dW = Math.min(dmin + R() * 8, W / 2 - 3), dE = Math.min(dmin + R() * 8, W / 2 - 3);
      lots(zA, zB, (a, c) => building(x0, x0 + dW, a, c, floorsAt(x0, a)));
      lots(zA, zB, (a, c) => building(x1 - dE, x1, a, c, floorsAt(x1, a)));
      // 内院：草地或铺地 + 几棵树
      const cx0 = x0 + dW + 1, cx1 = x1 - dE - 1, cz0 = zA + 1, cz1 = zB - 1;
      if (cx1 - cx0 > 4 && cz1 - cz0 > 4) {
        const green = R() < .6;
        grass.flat(cx0, cx1, cz0, cz1, CURB + .01, green ? '#7aa856' : '#b9b2a4');
        const nt = Math.floor((cx1 - cx0) * (cz1 - cz0) / 90);
        for (let k = 0; k < nt; k++) trees.push([cx0 + 2 + R() * (cx1 - cx0 - 4), CURB, cz0 + 2 + R() * (cz1 - cz0 - 4), 3 + R() * 2.5]);
      }
    }
  }

  const P = {};
  for (const b of blocks) {
    const sp = special.get(b), zone = downtown(b.cx, b.cz);
    if (!sp) { perimeter(b, zone); continue; }
    const x0 = b.x0 + SW, x1 = b.x1 - SW, z0 = b.z0 + SW, z1 = b.z1 - SW;
    if (sp === 'park') {
      grass.flat(x0, x1, z0, z1, CURB + .01, '#6fa24a');
      // 小路
      grass.flat(x0, x1, ZEBRA_Z - 1.6, ZEBRA_Z + 1.6, CURB + .02, '#d8c9a4');
      grass.ring(POND.x, POND.z, POND.rx + 1.2, POND.rz + 1.2, POND.rx + 3.4, POND.rz + 3.4, CURB + .03, '#d8c9a4');
      grass.ring(POND.x, POND.z, POND.rx, POND.rz, POND.rx + 1.2, POND.rz + 1.2, CURB + .04, '#8f8a7c');
      P.pondY = CURB - .25;
      for (let k = 0; k < 70; k++) {
        const x = x0 + 2 + R() * (x1 - x0 - 4), z = z0 + 2 + R() * (z1 - z0 - 4);
        const e = ((x - POND.x) / (POND.rx + 5)) ** 2 + ((z - POND.z) / (POND.rz + 5)) ** 2;
        if (e < 1 || Math.abs(z - ZEBRA_Z) < 3.5) continue;
        trees.push([x, CURB, z, 4 + R() * 3]);
      }
    } else if (sp === 'plaza') {
      const mx = x0 + (x1 - x0) * .45;
      perimeter({ ...b, x1: mx + SW }, zone);
      grass.flat(mx, x1, z0, z1, CURB + .01, '#d9d2c3');
      grass.disc((mx + x1) / 2, (z0 + z1) / 2, 7, 7, CURB + .02, '#bfb6a6');
      plain.cyl((mx + x1) / 2, (z0 + z1) / 2, 5.6, CURB, CURB + .6, '#cfc8ba', 24);
      grass.disc((mx + x1) / 2, (z0 + z1) / 2, 5.0, 5.0, CURB + .62, '#4f93b5');
      plain.cyl((mx + x1) / 2, (z0 + z1) / 2, .5, CURB + .6, CURB + 1.8, '#e6e1d6', 8);
      for (let k = 0; k < 6; k++) trees.push([mx + 3 + k * ((x1 - mx - 6) / 5), CURB, z0 + 2.5, 3.5]), trees.push([mx + 3 + k * ((x1 - mx - 6) / 5), CURB, z1 - 2.5, 3.5]);
      P.fountain = [(mx + x1) / 2, (z0 + z1) / 2];
    } else if (sp === 'construction') {
      grass.flat(x0, x1, z0, z1, CURB + .01, '#b89a6a');
      // 半成品框架：柱网 + 楼板
      const fx0 = x0 + 12, fx1 = x0 + 44, fz0 = z0 + 8, fz1 = z1 - 8;
      for (let f = 0; f < 5; f++) {
        const y = CURB + f * 3.6;
        plain.box(fx0, fx1, y + 3.3, y + 3.6, fz0, fz1, '#b7b2a8');
        for (let x = fx0; x <= fx1 + .01; x += 8) for (let z = fz0; z <= fz1 + .01; z += (fz1 - fz0) / 3) plain.box(x - .3, x + .3, y, y + 3.3, z - .3, z + .3, '#a9a39a');
      }
      for (let x = fx0; x <= fx1 + .01; x += 8) for (let z = fz0; z <= fz1 + .01; z += (fz1 - fz0) / 3) plain.box(x - .3, x + .3, CURB + 18, CURB + 21, z - .3, z + .3, '#a9a39a');
      // 塔吊塔身
      const cx = x1 - 14, cz = (z0 + z1) / 2, H = 46;
      plain.box(cx - 1, cx + 1, CURB, H, cz - 1, cz + 1, '#f2b705');
      plain.box(cx - 2.5, cx + 2.5, CURB, CURB + 1, cz - 2.5, cz + 2.5, '#8a8a8a');
      P.crane = { x: cx, z: cz, y: H };
      // 材料堆、工棚
      plain.box(x0 + 3, x0 + 9, CURB, CURB + 2.6, z0 + 3, z0 + 6, '#e8e4dc', '#3f6fb0');
      plain.box(x0 + 3, x0 + 9, CURB, CURB + 2.6, z0 + 7, z0 + 10, '#e8e4dc', '#3f6fb0');
      for (let k = 0; k < 8; k++) plain.box(x0 + 50 + (k % 4) * 2.2, x0 + 52 + (k % 4) * 2.2, CURB, CURB + .6 + (k > 3 ? .6 : 0), z1 - 10, z1 - 4, '#9c7b54');
      props.push({ type: 'truck', x: x0 + 20, z: z1 - 4, ry: 0, col: '#f2b705' }, { type: 'truck', x: x0 + 32, z: z0 + 4, ry: 0, col: '#e8e4dc' });
    } else if (sp === 'school') {
      building(x0, x1, z0, z0 + 14, 3, { wall: '#e8c872', roof: '#8a8c8e' });
      building(x0, x0 + 14, z0 + 14, z1, 3, { wall: '#e8c872', roof: '#8a8c8e' });
      const cx = (x0 + 14 + x1) / 2 + 1, cz = (z0 + 14 + z1) / 2 + 1;
      grass.flat(x0 + 14, x1, z0 + 14, z1, CURB + .01, '#6fa24a');
      grass.stadium(cx, cz, 26, 9.5, 14.5, CURB + .03, '#c4553d');
      grass.stadium(cx, cz, 26, 9.5, 9.7, CURB + .04, '#f4f1ea'); grass.stadium(cx, cz, 26, 11.1, 11.25, CURB + .04, '#f4f1ea'); grass.stadium(cx, cz, 26, 12.7, 12.85, CURB + .04, '#f4f1ea');
      grass.flat(cx - 12, cx + 12, cz - 8, cz + 8, CURB + .035, '#5f9a3e');
      P.track = { x: cx, z: cz, L: 26, r: 11.8 };
    } else if (sp === 'parking') {
      grass.flat(x0, x1, z0, z1, CURB + .01, '#5c6066');
      for (let r = 0; r < 4; r++) {
        const zr = z0 + 5 + r * 10;
        for (let k = 0; k < 26; k++) {
          const x = x0 + 3 + k * 2.8;
          mark.flat(x - .06, x + .06, zr - 2.5, zr + 2.5, CURB + .03, '#e8e8e2');
          if (R() < .72) props.push({ type: 'car', x: x + 1.4, z: zr + (r % 2 ? .1 : -.1), ry: Math.PI / 2 + (R() < .5 ? 0 : Math.PI), col: null, park: true });
        }
      }
    } else if (sp === 'station') {
      grass.flat(x0, x1, z0, z1, CURB + .01, '#d6cfc0');
      if (b.x0 < 0 && b.x1 > 0 || Math.abs(b.cx) < 60) {
        // 站房
        const sx0 = Math.max(x0, -38), sx1 = Math.min(x1, 38);
        if (sx1 - sx0 > 10) {
          bld.box(sx0, sx1, CURB, 11, z0, z0 + 16, '#e7dcc7', '#7b6e62', { facade: true, wp: [5.5, 5.4, 3.3] });
          plain.box(sx0 - .3, sx1 + .3, 11, 12, z0 - .3, z0 + 16.3, '#8a4b3a');
        }
      }
      for (let k = 0; k < 10; k++) trees.push([x0 + 4 + R() * (x1 - x0 - 8), CURB, z1 - 3 - R() * 4, 4]);
    } else if (sp === 'pool') {
      perimeter(b, zone);
      const cx = b.cx, cz = b.cz;
      grass.flat(cx - 13, cx + 13, cz - 7, cz + 7, CURB + .05, '#e9e4da');
      grass.flat(cx - 11, cx + 11, cz - 4.5, cz + 4.5, CURB + .06, '#39b4d0');
      for (let k = 1; k < 6; k++) mark.flat(cx - 11, cx + 11, cz - 4.5 + k * 1.5 - .05, cz - 4.5 + k * 1.5 + .05, CURB + .07, '#e9f6f8');
    }
  }

  // —— 路面标线 ——
  const WHITE = '#ecebe6', YEL = '#e8c24a', MY = .025;
  const worn = col => { const c = new THREE.Color(col); const k = R(); return k < .35 ? c.lerp(new THREE.Color('#8a8b8d'), .25 + R() * .3) : c; };   // 标线磨损
  const dash = (ax, a0, a1, c, w, col, L = 3, G = 4) => { for (let a = a0; a < a1; a += L + G) { const e = Math.min(a + L, a1); if (ax === 'z') mark.flat(c - w / 2, c + w / 2, a, e, MY, worn(col)); else mark.flat(a, e, c - w / 2, c + w / 2, MY, worn(col)); } };
  // 井盖、补丁路面、油渍
  const PATCH = ['#3f4246', '#56595d', '#44474b', '#5e5f60'];
  for (const X of AV) for (let z = EXT.z0 + 10; z < EXT.z1 - 10; z += 11 + R() * 30) { const ox = (R() - .5) * (avW(X) - 3); if (ST.some(Z => Math.abs(z - Z) < stW(Z) / 2 + 5)) continue;
    if (R() < .45) { mark.disc(X + ox, z, .38, .38, .018, '#2b2d30', 12); mark.ring(X + ox, z, .38, .38, .45, .45, .019, '#6a6c6f', 12); }
    else if (R() < .5) { const w = 1 + R() * 3, l = 1.5 + R() * 5; mark.flat(X + ox - w / 2, X + ox + w / 2, z, z + l, .012, PATCH[Math.floor(R() * 4)]); }
    else mark.disc(X + ox, z, .5 + R() * .9, .4 + R() * .6, .011, '#35383c', 10); }
  for (const Z of ST) for (let x = EXT.x0 + 10; x < EXT.x1 - 10; x += 11 + R() * 30) { const oz = (R() - .5) * (stW(Z) - 3); if (AV.some(X => Math.abs(x - X) < avW(X) / 2 + 5)) continue;
    if (R() < .45) { mark.disc(x, Z + oz, .38, .38, .018, '#2b2d30', 12); mark.ring(x, Z + oz, .38, .38, .45, .45, .019, '#6a6c6f', 12); }
    else if (R() < .5) { const w = 1 + R() * 3, l = 1.5 + R() * 5; mark.flat(x, x + l, Z + oz - w / 2, Z + oz + w / 2, .012, PATCH[Math.floor(R() * 4)]); }
    else mark.disc(x, Z + oz, .5 + R() * .9, .4 + R() * .6, .011, '#35383c', 10); }
  const spans = (arr, wf, lo, hi) => { const S = []; let a = lo; for (const c of arr) { S.push([a, c - wf(c) / 2]); a = c + wf(c) / 2; } S.push([a, hi]); return S; };
  for (const X of AV) {
    for (const [a, b] of spans(ST, stW, EXT.z0, EXT.z1)) {
      const a2 = a + 6, b2 = b - 6; if (b2 <= a2) continue;
      if (X === 0) { mark.flat(-.35, -.2, a2, b2, MY, YEL); mark.flat(.2, .35, a2, b2, MY, YEL); dash('z', a2, b2, -4.25, .15, WHITE); dash('z', a2, b2, 4.25, .15, WHITE); }
      else dash('z', a2, b2, X, .15, WHITE);
    }
  }
  for (const Z of ST) {
    for (const [a, b] of spans(AV, avW, EXT.x0, EXT.x1)) {
      const a2 = a + 6, b2 = b - 6; if (b2 <= a2) continue;
      if (Z === 0) { mark.flat(a2, b2, -.35, -.2, MY, YEL); mark.flat(a2, b2, .2, .35, MY, YEL); dash('x', a2, b2, -3.75, .15, WHITE); dash('x', a2, b2, 3.75, .15, WHITE); }
      else dash('x', a2, b2, Z, .15, WHITE);
    }
  }
  // 斑马线与停止线
  const zebraAcross = (axis, c, from, to, at) => {   // 跨越 from..to 的斑马线；条纹沿行车方向
    for (let s = from + .4; s < to - .4; s += 1.2) { if (axis === 'av') mark.flat(s, s + .6, at - 1.6, at + 1.6, MY, WHITE); else mark.flat(at - 1.6, at + 1.6, s, s + .6, MY, WHITE); }
  };
  for (const X of AV) for (const Z of ST) {
    const hx = avW(X) / 2, hz = stW(Z) / 2;
    zebraAcross('av', 0, X - hx, X + hx, Z - hz - 2.4); zebraAcross('av', 0, X - hx, X + hx, Z + hz + 2.4);
    zebraAcross('st', 0, Z - hz, Z + hz, X - hx - 2.4); zebraAcross('st', 0, Z - hz, Z + hz, X + hx + 2.4);
    mark.flat(X - hx, X, Z - hz - 4.6, Z - hz - 4.2, MY, WHITE); mark.flat(X, X + hx, Z + hz + 4.2, Z + hz + 4.6, MY, WHITE);
    mark.flat(X - hx - 4.6, X - hx - 4.2, Z, Z + hz, MY, WHITE); mark.flat(X + hx + 4.2, X + hx + 4.6, Z - hz, Z, MY, WHITE);
  }
  zebraAcross('av', 0, -12, 12, ZEBRA_Z);   // 鸭子过的斑马线（大道中段）
  mark.flat(-12, 0, ZEBRA_Z - 3.2, ZEBRA_Z - 2.8, MY, WHITE); mark.flat(0, 12, ZEBRA_Z + 2.8, ZEBRA_Z + 3.2, MY, WHITE);

  // —— 树：大道、主街两侧 + 公园 ——
  for (const [a, b] of spans(ST, stW, EXT.z0 + 8, EXT.z1 - 8)) for (let z = a + 8; z < b - 6; z += 9) { if (Math.abs(z - ZEBRA_Z) < 5) continue; trees.push([-13.6, CURB, z, 3.2 + R()]); trees.push([13.6, CURB, z, 3.2 + R()]); }
  for (const [a, b] of spans(AV, avW, EXT.x0 + 8, EXT.x1 - 8)) for (let x = a + 8; x < b - 6; x += 9) { trees.push([x, CURB, -11.6, 3 + R()]); trees.push([x, CURB, 11.6, 3 + R()]); }

  // —— 路灯 ——
  for (const X of AV) for (const [a, b] of spans(ST, stW, EXT.z0 + 8, EXT.z1 - 8)) for (let z = a + 8; z < b - 5; z += 16) { lamps.push([X - avW(X) / 2 - .8, z, 1]); lamps.push([X + avW(X) / 2 + .8, z + 8, -1]); }
  for (const Z of ST) for (const [a, b] of spans(AV, avW, EXT.x0 + 8, EXT.x1 - 8)) for (let x = a + 8; x < b - 5; x += 16) { lamps.push([x, Z - stW(Z) / 2 - .8, 2]); lamps.push([x + 8, Z + stW(Z) / 2 + .8, -2]); }

  // —— 红绿灯杆（每个路口四角）——
  for (const X of AV) for (const Z of ST) {
    const hx = avW(X) / 2 + .9, hz = stW(Z) / 2 + .9;
    tlights.push({ X, Z, x: X - hx, z: Z - hz, face: 'ns' }, { X, Z, x: X + hx, z: Z + hz, face: 'ns' }, { X, Z, x: X + hx, z: Z - hz, face: 'ew' }, { X, Z, x: X - hx, z: Z + hz, face: 'ew' });
  }

  // —— 铁路：道床、钢轨、站台、雨棚、接触网杆 ——
  const RX0 = -3200, RX1 = 3200;
  plain.box(RX0, RX1, 0, .35, RAIL.zB - 3.2, RAIL.zA + 3.2, '#8e8577', '#8a8174');
  for (const zc of [RAIL.zA, RAIL.zB]) for (const o of [-.72, .72]) plain.box(RX0, RX1, .35, .55, zc + o - .05, zc + o + .05, '#6d6a66', '#b9bcc0');
  for (const zc of [RAIL.zA, RAIL.zB]) for (let x = -420; x < 420; x += .9) plain.box(x - .13, x + .13, .35, .45, zc - 1.25, zc + 1.25, '#6b5a4a');   // 枕木
  plain.box(RAIL.px0, RAIL.px1, 0, 1.1, RAIL.pz0, RAIL.pz1, '#bdb7ab', '#cfc9bd');
  mark.flat(RAIL.px0, RAIL.px1, RAIL.pz1 - .5, RAIL.pz1 - .2, 1.12, '#e8c24a'); mark.flat(RAIL.px0, RAIL.px1, RAIL.pz0 + .2, RAIL.pz0 + .5, 1.12, '#e8c24a');
  // 站台：灯柱、长椅（不做整片雨棚——俯拍时会挡住站台上的人）
  for (let x = RAIL.px0 + 6; x < RAIL.px1 - 3; x += 16) { const pz = (RAIL.pz0 + RAIL.pz1) / 2; plain.box(x - .1, x + .1, 1.1, 4.4, pz - .1, pz + .1, '#54606b'); plain.box(x - .5, x + .5, 4.3, 4.5, pz - .25, pz + .25, '#e8e4dc'); plain.box(x + 4, x + 6, 1.1, 1.55, pz - .35, pz + .35, '#8a5a3c'); }

  for (let x = RX0; x < RX1; x += 50) { const zc = RAIL.zB - 3.6; plain.box(x - .15, x + .15, 0, 7.6, zc - .15, zc + .15, '#6b6f73'); plain.box(x - .08, x + .08, 7.1, 7.3, zc, RAIL.zA + 1, '#6b6f73'); }
  // 天桥（站台 → 站房）
  // 站台上的地道楼梯口（通往站房的地下通道）
  { const pz = (RAIL.pz0 + RAIL.pz1) / 2; plain.box(-3.5, 3.5, 1.1, 3.6, pz - 1.2, pz + 1.2, '#cfc9bd', '#6e8aa3'); plain.box(-3.2, 3.2, 1.1, 3.2, pz - 1.25, pz + 1.25, '#2a2e33', '#6e8aa3', { noTop: true }); }
  // 铁路北侧：围栏后的小屋与田地
  plain.box(RX0, RX1, 0, 1.4, RAIL.zB - 5.5, RAIL.zB - 5.35, '#7c8a73');

  // —— 郊区：小房子（人字屋顶）——
  const sub = new GB();
  const inCity = (x, z) => x > EXT.x0 - 10 && x < EXT.x1 + 10 && z > RAIL.zB - 8 && z < EXT.z1 + 10;
  const GZ = [];
  for (let gz = -300 - 44; gz > -1400; gz -= 44) GZ.push(gz);
  for (let gz = EXT.z1 + 6; gz < 1400; gz += 44) GZ.push(gz);
  for (let gz = RAIL.zB - 8; gz < EXT.z1 + 6; gz += 44) GZ.push(gz);
  for (let gx = -1500; gx < 1500; gx += 60) for (const gz of GZ) {
    if (inCity(gx + 30, gz + 22) || inCity(gx + 2, gz + 2) || inCity(gx + 58, gz + 42)) continue;
    if (gz < RAIL.zB - 6 && gz + 44 > RAIL.zB - 6) continue;
    const dist = Math.hypot(gx, gz * 1.3);
    if (dist > 1150 + 250 * Math.sin(gx * .004 + gz * .003)) continue;
    // 街道留空：只在每个格子内部排房
    sub.box(gx + 3, gx + 57, 0, CURB, gz + 3, gz + 41, '#c7c3ba');
    if (R() < .18) { sub.flat(gx + 4, gx + 56, gz + 4, gz + 40, CURB + .01, '#78a553'); for (let k = 0; k < 6; k++) trees.push([gx + 6 + R() * 48, CURB, gz + 6 + R() * 32, 4 + R() * 2]); continue; }
    for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) {
      if (R() < .12) continue;
      const hx0 = gx + 5 + k * 10.4, hz0 = gz + 5 + r * 18, w = 7 + R() * 2, d = 8 + R() * 3, fl = 1 + Math.floor(R() * 2.3), fh = 3;
      const wall = FACADE[Math.floor(R() * FACADE.length)], tile = TILE[Math.floor(R() * TILE.length)];
      const h = CURB + fl * fh;
      bld.box(hx0, hx0 + w, CURB, h, hz0, hz0 + d, wall, tile, { facade: true, wp: [2.6, fh, R() * 99], noTop: true });
      bld.gable(hx0 - .3, hx0 + w + .3, hz0 - .3, hz0 + d + .3, h, 2.2 + R() * .8, tile, wall, R() < .5);
      if (R() < .5) sub.flat(hx0, hx0 + w, hz0 + d + .5, hz0 + 17, CURB + .01, '#7fab58');
      if (R() < .5) trees.push([hx0 + w + 1.2, CURB, hz0 + d + 3, 3 + R() * 2]);
    }
  }
  // 农田拼布
  const fields = new GB(), FC = ['#9cbf5c', '#b9c46a', '#7ea84c', '#d6c27a', '#8fb35a', '#a7b86a', '#c9b56c', '#6f9a48'];
  for (let gx = -3000; gx < 3000; gx += 120) for (let gz = -3000; gz < 3000; gz += 90) {
    const d = Math.hypot(gx + 60, (gz + 45) * 1.3); if (d < 1050) continue;
    fields.flat(gx + 1.5, gx + 118.5, gz + 1.5, gz + 88.5, .03, FC[Math.floor(R() * FC.length)]);
    if (R() < .25) for (let k = 0; k < 8; k++) trees.push([gx + R() * 120, 0, gz + (R() < .5 ? 0 : 90), 5 + R() * 3]);
  }

  // —— 建网格 ——
  const matB = buildingMaterial();
  const matP = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
  const matM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 });
  const add = (g, m, cast = true) => { const o = new THREE.Mesh(g.build(), m); o.castShadow = cast; o.receiveShadow = true; scene.add(o); return o; };
  add(bld, matB); add(plain, matP); add(grass, matP, false); add(mark, matM, false); add(sub, matP, false); add(fields, matP, false);

  // 路面（沥青，带细微噪声纹理）
  const asph = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    x.fillStyle = '#4b4e53'; x.fillRect(0, 0, 512, 512);
    const r = mulberry(5);
    for (let i = 0; i < 26000; i++) { const v = 64 + r() * 34; x.fillStyle = `rgba(${v},${v},${v + 3},${.25 + r() * .3})`; x.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(40,40,44,${.05 + r() * .06})`; x.beginPath(); x.ellipse(r() * 512, r() * 512, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  const road = new THREE.Mesh(new THREE.PlaneGeometry(EXT.x1 - EXT.x0 + 40, EXT.z1 - EXT.z0 + 40), new THREE.MeshStandardMaterial({ map: asph, roughness: .92 }));
  road.rotation.x = -Math.PI / 2; road.position.set((EXT.x0 + EXT.x1) / 2, 0, (EXT.z0 + EXT.z1) / 2); road.receiveShadow = true; scene.add(road);
  // 郊区路面（更浅的沥青）+ 远处地面
  const sroad = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3000), new THREE.MeshStandardMaterial({ color: '#5d6062', roughness: .95 }));
  sroad.rotation.x = -Math.PI / 2; sroad.position.set(0, -.02, 0); sroad.receiveShadow = true; scene.add(sroad);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), new THREE.MeshStandardMaterial({ color: '#86a45a', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.05; ground.receiveShadow = true; scene.add(ground);

  // 池塘水面
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: '#3f86a3', roughness: .12, metalness: .1 }));
  water.rotation.x = -Math.PI / 2; water.scale.set(POND.rx, POND.rz, 1); water.position.set(POND.x, CURB + .02, POND.z); water.receiveShadow = true; scene.add(water);

  // —— 树（实例化：树干 + 两团树冠）——
  const nT = trees.length;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.18, .25, 1, 6), new THREE.MeshStandardMaterial({ color: '#6b4f3a', roughness: .9 }), nT);
  const cg = new THREE.IcosahedronGeometry(1, 1);
  const crown = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ roughness: .95 }), nT * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), cc = new THREE.Color();
  const TC = ['#4f8a3a', '#5c9a40', '#3f7a35', '#6aa447', '#4a8040', '#7fae4c', '#55913f'];
  trees.forEach(([x, y, z, s], i) => {
    const th = s * .45;
    m4.compose(pv.set(x, y + th / 2, z), q.identity(), sv.set(s * .25, th, s * .25)); trunk.setMatrixAt(i, m4);
    const col = cc.set(TC[Math.floor(R() * TC.length)]);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6);
    m4.compose(pv.set(x, y + th + s * .42, z), q, sv.set(s * .62, s * .55, s * .62)); crown.setMatrixAt(i * 2, m4); crown.setColorAt(i * 2, col);
    m4.compose(pv.set(x + (R() - .5) * s * .4, y + th + s * .8, z + (R() - .5) * s * .4), q, sv.set(s * .42, s * .4, s * .42)); crown.setMatrixAt(i * 2 + 1, m4); crown.setColorAt(i * 2 + 1, col.clone().multiplyScalar(1.12));
  });
  for (const o of [trunk, crown]) { o.castShadow = true; o.receiveShadow = true; scene.add(o); }

  // —— 路灯（实例化杆 + 灯头；夜间光斑）——
  for (let i = lamps.length - 1; i >= 0; i--) if (Math.abs(lamps[i][0]) < 18 && Math.abs(lamps[i][1] - ZEBRA_Z) < 9) lamps.splice(i, 1);
  const nL = lamps.length;
  const pole = new THREE.InstancedMesh(new THREE.BoxGeometry(.18, 7, .18), new THREE.MeshStandardMaterial({ color: '#4a5058', roughness: .6 }), nL);
  const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, .14, .14), new THREE.MeshStandardMaterial({ color: '#4a5058', roughness: .6 }), nL);
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .75, .45) });
  const head = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, .3, .6), headMat, nL);
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,180,110,.55)'); g.addColorStop(.45, 'rgba(255,150,75,.3)'); g.addColorStop(1, 'rgba(255,130,50,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(17, 17).rotateX(-Math.PI / 2), poolMat, nL);
  lamps.forEach(([x, z, d], i) => {
    const ax = Math.abs(d) === 1 ? 'z' : 'x', s = Math.sign(d);
    m4.compose(pv.set(x, 3.5, z), q.identity(), sv.set(1, 1, 1)); pole.setMatrixAt(i, m4);
    const ox = ax === 'z' ? s * .8 : 0, oz = ax === 'x' ? s * .8 : 0;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ax === 'z' ? 0 : Math.PI / 2);
    m4.compose(pv.set(x + ox, 7, z + oz), q, sv.set(1, 1, 1)); arm.setMatrixAt(i, m4);
    m4.compose(pv.set(x + ox * 1.9, 6.9, z + oz * 1.9), q, sv.set(1, 1, 1)); head.setMatrixAt(i, m4);
    m4.compose(pv.set(x + ox * 4.5, .05, z + oz * 4.5), q.identity(), sv.set(1, 1, 1)); pools.setMatrixAt(i, m4);
  });
  pole.castShadow = arm.castShadow = true; scene.add(pole, arm, head, pools);

  // —— 红绿灯（杆 + 三色灯实例化，颜色逐帧更新）——
  const nTL = tlights.length;
  const tpole = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, 4.2, .2), new THREE.MeshStandardMaterial({ color: '#3d4247', roughness: .6 }), nTL);
  const tbox = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, 1.4, .5), new THREE.MeshStandardMaterial({ color: '#23272b', roughness: .5 }), nTL);
  const lampMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const tlamp = new THREE.InstancedMesh(new THREE.SphereGeometry(.28, 8, 6), lampMat, nTL * 2);   // 每杆两个灯：面向两个方向的"当前色"
  tlights.forEach((L, i) => {
    m4.compose(pv.set(L.x, 2.1, L.z), q.identity(), sv.set(1, 1, 1)); tpole.setMatrixAt(i, m4);
    m4.compose(pv.set(L.x, 4.5, L.z), q.identity(), sv.set(1, 1, 1)); tbox.setMatrixAt(i, m4);
  });
  tpole.castShadow = tbox.castShadow = true; scene.add(tpole, tbox, tlamp);

  // —— 塔吊的吊臂（逐帧旋转）——
  const craneArm = new THREE.Group();
  if (P.crane) {
    const Y = new THREE.MeshStandardMaterial({ color: '#f2b705', roughness: .6 });
    const jib = new THREE.Mesh(new THREE.BoxGeometry(44, 1.4, 1.4), Y); jib.position.set(14, 0, 0);
    const cjib = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 1.6), Y); cjib.position.set(-7, 0, 0);
    const cw = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: '#8a8a8a' })); cw.position.set(-12, -1.2, 0);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), new THREE.MeshStandardMaterial({ color: '#e8e4dc' })); cab.position.set(1.5, -1.6, 1.6);
    const peak = new THREE.Mesh(new THREE.ConeGeometry(1, 6, 4), Y); peak.position.set(0, 3.5, 0);
    const cable = new THREE.Mesh(new THREE.BoxGeometry(.08, 20, .08), new THREE.MeshStandardMaterial({ color: '#333' })); cable.position.set(26, -10, 0);
    const load = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1.2), new THREE.MeshStandardMaterial({ color: '#9c7b54' })); load.position.set(26, -20.5, 0);
    craneArm.add(jib, cjib, cw, cab, peak, cable, load); craneArm.position.set(P.crane.x, P.crane.y + .7, P.crane.z);
    craneArm.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } }); scene.add(craneArm);
  }

  // —— 屋顶霓虹招牌 ——
  const sign = makeSign(scene);

  return { bl, blocks, special, trees, lamps, tlights, props, P, tlamp, head, headMat, pools, poolMat, craneArm, sign, water };
}

// 屋顶招牌：钢架 + 每个字母一块面板（亮/灭两套材质）
function makeSign(scene) {
  const g = new THREE.Group();
  const L1 = 'TOY TOWN', L2 = 'RUSH HOUR';
  const letters = [];
  const mk = (ch, col) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 160; const x = c.getContext('2d');
    x.font = '800 150px Overpass'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.lineWidth = 10; x.strokeStyle = '#fff'; x.fillStyle = '#fff';
    x.fillText(ch, 64, 140);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  };
  const place = (str, y, size, col, gap) => {
    const n = str.length, w = size * .78, total = n * w;
    [...str].forEach((ch, i) => {
      if (ch === ' ') return;
      const tex = mk(ch);
      const on = new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(col).multiplyScalar(1), depthWrite: false, toneMapped: true });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size * .8, size), on);
      m.position.set(-total / 2 + w * (i + .5), y, .32);
      g.add(m); letters.push({ m, col: new THREE.Color(col), ch });
      // 字母背板（白天可见的漆面字）
      const back = new THREE.Mesh(new THREE.PlaneGeometry(size * .8, size), new THREE.MeshStandardMaterial({ map: tex, transparent: true, color: new THREE.Color(col).lerp(new THREE.Color('#2a2c30'), .82), roughness: .5, alphaTest: .3 }));   // 未点亮的灯管：暗灰带一点底色
      back.position.set(m.position.x, y, .28); back.castShadow = true; g.add(back);
    });
    return total;
  };
  const w1 = place(L1, 9.2, 6.4, '#ff4f6d'), w2 = place(L2, 3.0, 4.6, '#43e0ff');
  const W = Math.max(w1, w2) + 3;
  const steel = new THREE.MeshStandardMaterial({ color: '#3c4148', roughness: .5, metalness: .4 });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(W, 12.6, .4), new THREE.MeshStandardMaterial({ color: '#1d2126', roughness: .7 })); panel.position.set(0, 6.2, 0); panel.castShadow = true; g.add(panel);
  for (let x = -W / 2 + 1; x <= W / 2 - 1 + .01; x += (W - 2) / 5) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.3, 3.6, .3), steel); leg.position.set(x, -1.8, -.6); leg.castShadow = true; g.add(leg);
    const br = new THREE.Mesh(new THREE.BoxGeometry(.2, 4.5, .2), steel); br.position.set(x, -1.6, -2); br.rotation.x = .75; g.add(br);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(W, .25, .25), steel); rail.position.set(0, .1, -.6); g.add(rail);
  scene.add(g);
  return { g, letters, W };
}
