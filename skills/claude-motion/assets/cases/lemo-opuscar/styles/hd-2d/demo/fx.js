// 氛围件：天空、星、海面、粒子（萤火/浮尘/火星/雨）、体积光柱、火光闪烁
import * as THREE from 'three';
import { h2, mulberry } from './px.js';

export const flick = (t, s = 0) => 1 + .09 * Math.sin(t * 13.1 + s) + .06 * Math.sin(t * 23.7 + s * 2.1) + .05 * Math.sin(t * 7.3 + s * 3.3);

// —— 天空穹顶（渐变 + 月亮光晕），不受雾影响 ——
export function sky(o = {}) {
  const u = {
    top: { value: new THREE.Color(o.top ?? '#070b1c') }, mid: { value: new THREE.Color(o.mid ?? '#16254a') }, hor: { value: new THREE.Color(o.hor ?? '#3a5270') },
    moonDir: { value: (o.moonDir ?? new THREE.Vector3(-.3, .35, -1)).clone().normalize() }, moonCol: { value: new THREE.Color(o.moonCol ?? '#dfe8ff') }, moonI: { value: o.moonI ?? 1 },
    k: { value: 1 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize((modelMatrix * vec4(position,0.)).xyz); vec4 p = projectionMatrix * viewMatrix * vec4((modelMatrix*vec4(position,1.)).xyz,1.); gl_Position = p.xyww; }`,
    fragmentShader: `varying vec3 vD; uniform vec3 top, mid, hor, moonCol; uniform vec3 moonDir; uniform float moonI, k;
      void main(){ float y = vD.y; vec3 c = y > .18 ? mix(mid, top, smoothstep(.18, .75, y)) : mix(hor, mid, smoothstep(-.02, .18, y));
        float d = max(dot(normalize(vD), moonDir), 0.); c += moonCol * (pow(d, 900.) * 6. + pow(d, 60.) * .25 + pow(d, 8.) * .06) * moonI;
        gl_FragColor = vec4(c * k, 1.); }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), m); mesh.renderOrder = -10; mesh.frustumCulled = false;
  return { mesh, u };
}

// —— 星星：方形像素点，闪烁 ——
export function stars(n = 600, seed = 3, o = {}) {
  const R = mulberry(seed), pos = [], ph = [];
  for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, y = .08 + Math.pow(R(), .8) * .9, r = Math.sqrt(1 - y * y); pos.push(Math.cos(a) * r * 800, y * 800, Math.sin(a) * r * 800); ph.push(R() * 10, .4 + R() * R() * 1.6); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.Float32BufferAttribute(ph, 2));
  const m = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, k: { value: 1 }, px: { value: o.px ?? 3 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `attribute vec2 ph; uniform float t, px; varying float vA; void main(){ vec4 p = projectionMatrix * viewMatrix * vec4(position,1.); gl_Position = p.xyww; vA = ph.y * (.65 + .35 * sin(t * (1.5 + ph.x * .3) + ph.x * 7.)); gl_PointSize = px * (ph.y > 1.3 ? 2. : 1.); }`,
    fragmentShader: `varying float vA; uniform float k; void main(){ gl_FragColor = vec4(vec3(.8,.87,1.) * vA * k, 1.); }`,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -9; return p;
}

// —— 海面：像素化波纹 + 灯光倒影条 + 月光碎光 ——
export function sea(size = 600, o = {}) {
  const N = 8;
  const u = {
    t: { value: 0 }, ppm: { value: o.ppm ?? 10 }, deep: { value: new THREE.Color(o.deep ?? '#050c18') }, shallow: { value: new THREE.Color(o.shallow ?? '#112640') },
    crest: { value: new THREE.Color(o.crest ?? '#3a6286') }, camPos: { value: new THREE.Vector3() },
    lp: { value: [...Array(N)].map(() => new THREE.Vector3()) }, lc: { value: [...Array(N)].map(() => new THREE.Vector3()) }, nL: { value: 0 },
    fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 }, calm: { value: 0 }, bright: { value: 1 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `varying vec3 vW; varying float vFog; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vec4 mv = viewMatrix * w; vFog = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      varying vec3 vW; varying float vFog; uniform float t, ppm, nL, fogDensity, calm, bright; uniform vec3 deep, shallow, crest, camPos, fogColor; uniform vec3 lp[${N}]; uniform vec3 lc[${N}];
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float bayer(vec2 p){ vec2 q = mod(floor(p), 4.); int x = int(q.x), y = int(q.y); int i = y*4+x; float B[16]; B[0]=0.;B[1]=8.;B[2]=2.;B[3]=10.;B[4]=12.;B[5]=4.;B[6]=14.;B[7]=6.;B[8]=3.;B[9]=11.;B[10]=1.;B[11]=9.;B[12]=15.;B[13]=7.;B[14]=13.;B[15]=5.; for(int k=0;k<16;k++) if(k==i) return (B[k]+.5)/16.; return .5; }
      void main(){
        vec2 P = floor(vW.xz * ppm) / ppm;           // 像素量化
        vec2 G = floor(vW.xz * ppm);
        float amp = 1. - calm * .7;
        float w1 = n(P * vec2(.35, 1.4) + vec2(t * .25, t * .06)), w2 = n(P * vec2(.8, 2.6) - vec2(t * .18, -t * .1) + 13.);
        float w = w1 * .6 + w2 * .4;
        float dist = length(vW.xz - camPos.xz);
        vec3 col = mix(shallow, deep, smoothstep(10., 120., dist));
        float band = smoothstep(.62, .7, w) * amp; col = mix(col, crest, band * .55 * (1. - smoothstep(60., 220., dist)));
        // 灯光倒影：沿"光源→相机"方向拉长的竖条，被波纹打碎
        vec3 add = vec3(0.);
        for (int i = 0; i < ${N}; i++) { if (float(i) >= nL) break;
          vec2 L = lp[i].xz, C = camPos.xz; vec2 dir = normalize(C - L); vec2 d = vW.xz - L; float along = dot(d, dir); float perp = abs(d.x * dir.y - d.y * dir.x);
          float wid = max(.35, .5 + lp[i].y * .06 + along * .018); float s = exp(-perp * perp / (wid * wid)) * smoothstep(-2., 1., along) * exp(-max(along, 0.) / (18. + lp[i].y * 1.5));
          float br = step(.45 - .12 * sin(t * 2. + G.y * .7), fract(w * 5. + G.y * .13 + t * .6));
          add += lc[i] * s * (.25 + .75 * br);
        }
        // 碎光闪点
        float sp = step(.985, h(G + floor(t * 6.))) * step(.55, w) * amp * (1. - smoothstep(20., 90., dist));
        col += add * bright + crest * sp * 1.2 * bright;
        float fog = 1. - exp(-fogDensity * fogDensity * vFog * vFog);
        col = mix(col, fogColor, fog);
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m); mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = false;
  return { mesh, u, setLights(arr) { arr.slice(0, N).forEach((L, i) => { u.lp.value[i].copy(L.p); u.lc.value[i].set(L.c.r * L.i, L.c.g * L.i, L.c.b * L.i); }); u.nL.value = Math.min(N, arr.length); } };
}

// —— 粒子：CPU 按 t 确定性计算位置 → Points（方形像素点，可柔边） ——
export function particles(n, fn, o = {}) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), a = new Float32Array(n), sz = new Float32Array(n), col = new Float32Array(n * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('a', new THREE.BufferAttribute(a, 1)); g.setAttribute('sz', new THREE.BufferAttribute(sz, 1)); g.setAttribute('col', new THREE.BufferAttribute(col, 3));
  const m = new THREE.ShaderMaterial({
    uniforms: { scale: { value: o.scale ?? 1 }, soft: { value: o.soft ?? 0 } }, transparent: true, depthWrite: false, blending: o.blend ?? THREE.AdditiveBlending,
    vertexShader: `attribute float a, sz; attribute vec3 col; varying float vA; varying vec3 vC; uniform float scale; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv; gl_PointSize = sz * scale * 400. / -mv.z; vA = a; vC = col; }`,
    fragmentShader: `varying float vA; varying vec3 vC; uniform float soft; void main(){ vec2 d = gl_PointCoord - .5; float r = length(d) * 2.; float m = soft > .5 ? pow(max(0., 1. - r), 1.6) : step(max(abs(d.x), abs(d.y)), .5); gl_FragColor = vec4(vC * vA * m, soft > .5 ? m * vA : vA); }`,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false;
  const tmp = { x: 0, y: 0, z: 0, a: 0, s: 1, r: 1, g: 1, b: 1 };
  p.userData.update = t => {
    for (let i = 0; i < n; i++) { tmp.a = 1; tmp.s = 1; fn(i, t, tmp); pos[i * 3] = tmp.x; pos[i * 3 + 1] = tmp.y; pos[i * 3 + 2] = tmp.z; a[i] = tmp.a; sz[i] = tmp.s; col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b; }
    g.attributes.position.needsUpdate = g.attributes.a.needsUpdate = g.attributes.sz.needsUpdate = g.attributes.col.needsUpdate = true;
  };
  return p;
}

// —— 雨：线段，按风向倾斜 ——
export function rain(n, box, o = {}) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 6); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.LineBasicMaterial({ color: o.color ?? '#9fb4d0', transparent: true, opacity: o.opacity ?? .35, depthWrite: false, blending: THREE.AdditiveBlending });
  const L = new THREE.LineSegments(g, m); L.frustumCulled = false;
  const R = mulberry(o.seed ?? 9), seeds = [...Array(n)].map(() => [R(), R(), R(), .7 + R() * .6]);
  L.userData.update = (t, wind = [-6, 0]) => {
    const [x0, y0, z0, x1, y1, z1] = box, H = y1 - y0, sp = o.speed ?? 22, len = o.len ?? .9;
    for (let i = 0; i < n; i++) { const s = seeds[i], ph = ((s[1] * H - t * sp * s[3]) % H + H) % H, y = y0 + ph, dt = (H - ph) / (sp * s[3]);
      const x = x0 + ((s[0] * (x1 - x0) + wind[0] * dt) % (x1 - x0) + (x1 - x0)) % (x1 - x0), z = z0 + s[2] * (z1 - z0) + wind[1] * dt * 0;
      const vx = wind[0] / sp * len, vy = -len; pos.set([x, y, z, x - vx, y - vy, z], i * 6); }
    g.attributes.position.needsUpdate = true;
  };
  return L;
}

// —— 体积光柱：加色的锥/板，沿长度渐隐，边缘柔，浮尘噪声 ——
export function shaft(len, r0, r1, col, o = {}) {
  const geo = new THREE.CylinderGeometry(r0, r1, len, 24, 1, true); geo.translate(0, -len / 2, 0);
  const m = new THREE.ShaderMaterial({
    uniforms: { col: { value: new THREE.Color(col) }, k: { value: o.k ?? .25 }, t: { value: 0 }, fall: { value: o.fall ?? 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vN, vV; uniform vec3 col; uniform float k, t, fall;
      void main(){ float e = abs(dot(normalize(vN), normalize(vV))); float edge = pow(e, 1.8); float along = pow(vUv.y, fall);
        float dust = .8 + .2 * sin(vUv.x * 40. + t * .7) * sin(vUv.y * 23. - t * .4);
        gl_FragColor = vec4(col * k * edge * along * dust, 1.); }`,
  });
  return new THREE.Mesh(geo, m);
}

// —— 光柱卡片：沿轴线、始终把宽面朝向相机（轴向公告板）；正对相机时淡出，由光晕接力 ——
export function beamCard(len, w0, w1, col, o = {}) {
  const geo = new THREE.BufferGeometry(), N = 16, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) { const u = i / N, w = w0 + (w1 - w0) * u; pos.push(u * len, -w / 2, 0, u * len, w / 2, 0); uv.push(u, 0, u, 1); if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    uniforms: { col: { value: new THREE.Color(col) }, k: { value: o.k ?? .5 }, t: { value: 0 }, fall: { value: o.fall ?? 1.2 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 col; uniform float k, t, fall;
      void main(){ float e = 1. - abs(vUv.y * 2. - 1.); e = e * e * (3. - 2. * e); float a = pow(max(1. - vUv.x, 0.001), fall) * smoothstep(0., .04, vUv.x);
        float dust = .85 + .15 * sin(vUv.x * 60. - t * 1.3) * sin(vUv.y * 9. + t * .5);
        gl_FragColor = vec4(col * max(k, 0.) * e * a * dust, 1.); }`,
  });
  const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false;
  const D = new THREE.Vector3(), V = new THREE.Vector3(), Nn = new THREE.Vector3(), B = new THREE.Vector3(), M4 = new THREE.Matrix4();
  // origin: 世界坐标；dir: 单位方向；返回侧向系数（1=侧看，0=正对）
  mesh.userData.aim = (origin, dir, cam) => {
    D.copy(dir).normalize(); V.copy(cam.position).sub(origin); const vl = V.length(); V.divideScalar(vl);
    Nn.copy(V).addScaledVector(D, -V.dot(D)); if (Nn.lengthSq() < 1e-8) Nn.set(0, 1, 0); Nn.normalize(); B.crossVectors(Nn, D).normalize();
    M4.makeBasis(D, B, Nn); mesh.quaternion.setFromRotationMatrix(M4); mesh.position.copy(origin);
    return Math.sqrt(Math.max(0, 1 - Math.pow(V.dot(D), 2)));
  };
  return mesh;
}
