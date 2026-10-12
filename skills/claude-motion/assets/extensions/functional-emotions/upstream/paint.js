// Painterly renderer.
// Scenes draw a flat underpainting (src) and a light layer (fx) with Canvas2D at half res.
// The GPU then repaints src with instanced brushstrokes that sample its colour and follow its edges,
// adds fx as glowing light on top, and finishes with canvas weave + vignette.

const W = 1920, H = 1080, SW = 960, SH = 540;

const Paint = (() => {
  const src = document.createElement('canvas'); src.width = SW; src.height = SH;
  const fx = document.createElement('canvas'); fx.width = SW; fx.height = SH;
  const fxb = document.createElement('canvas'); fxb.width = SW / 4; fxb.height = SH / 4;
  const sctx = src.getContext('2d'), fctx = fx.getContext('2d'), bctx = fxb.getContext('2d');

  let gl, progStroke, progQuad, progFinish, vaoStroke, layers = [], texSrc, texFx, texFxb, quadVao;

  const VS_STROKE = `#version 300 es
  precision highp float;
  layout(location=0) in vec2 aCorner;
  layout(location=1) in vec2 aBase;
  layout(location=2) in vec4 aRand;
  uniform sampler2D uSrc; uniform vec2 uRes; uniform float uBoil, uTime;
  uniform float uCell, uLen, uWid, uEdgeLo, uEdgeHi, uJit, uFlowK, uAlpha; uniform vec2 uSmear;
  out vec2 vUV; out vec3 vCol; out float vSeed, vA;
  float h(float n){ return fract(sin(n)*43758.5453); }
  float lum(vec3 c){ return dot(c, vec3(.3,.55,.15)); }
  float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    float a=h(dot(i,vec2(1,57))), b=h(dot(i+vec2(1,0),vec2(1,57))), c=h(dot(i+vec2(0,1),vec2(1,57))), d=h(dot(i+vec2(1,1),vec2(1,57)));
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
  void main(){
    float s = aRand.x*97. + uBoil*13.17;
    vec2 j = vec2(h(s), h(s+1.3)) - .5;
    vec2 pos = aBase + j * uCell * uJit;
    vec2 uv = pos / uRes;
    vec3 col = texture(uSrc, uv).rgb;
    vec2 e = vec2(2.5/${SW}.0, 2.5/${SH}.0);
    float gx = lum(texture(uSrc, uv+vec2(e.x,0)).rgb) - lum(texture(uSrc, uv-vec2(e.x,0)).rgb);
    float gy = lum(texture(uSrc, uv+vec2(0,e.y)).rgb) - lum(texture(uSrc, uv-vec2(0,e.y)).rgb);
    float edge = length(vec2(gx,gy));
    float ang = atan(gy, gx) + 1.5708;
    float flow = (n2(pos*.0022 + vec2(uTime*.03, 0.)) - .5) * 6.2832 * uFlowK + .35;
    ang = mix(flow, ang, smoothstep(.015, .08, edge));
    ang += (h(s+2.1) - .5) * .5;
    float sm = clamp(length(uSmear) / 60., 0., 1.);
    if (sm > 0.) ang = mix(ang, atan(uSmear.y, uSmear.x) + (h(s+2.1) - .5) * .12, sm);
    float vis = uEdgeLo < 0. ? 1. : smoothstep(uEdgeLo, uEdgeHi, edge);
    float len = uLen * (.7 + .6*h(s+3.7)) * (1. + sm * 3.), wid = uWid * (.7 + .5*h(s+4.9));
    vec2 c = aCorner; vec2 d = vec2(cos(ang), sin(ang));
    vec2 p = pos + d * c.x * len + vec2(-d.y, d.x) * c.y * wid;
    vec2 clip = p / uRes * 2. - 1.; clip.y = -clip.y;
    gl_Position = vec4(clip, 0, 1);
    vUV = c; vSeed = h(s+5.5);
    float v = (h(s+6.1)-.5)*.24;
    vCol = clamp(col * (1. + v) + vec3(h(s+7.)-.5, h(s+8.)-.5, h(s+9.)-.5)*.05, 0., 1.);
    vA = vis * uAlpha;
  }`;
  const FS_STROKE = `#version 300 es
  precision highp float;
  in vec2 vUV; in vec3 vCol; in float vSeed, vA; out vec4 o;
  float h(float n){ return fract(sin(n)*43758.5453); }
  float n1(float x){ float i=floor(x), f=fract(x); return mix(h(i),h(i+1.),f*f*(3.-2.*f)); }
  void main(){
    float x = vUV.x, y = vUV.y;
    float prof = (1. - pow(abs(x), 4.)) * (.85 + .15*sin(x*3.+vSeed*6.));
    float m = smoothstep(prof, prof - .25, abs(y));
    float br = n1(y*14. + vSeed*50.);
    float br2 = n1(y*37. + vSeed*91.);
    float dry = smoothstep(.0, .35, br - (x*.5+.5)*.55 + .25);
    float a = m * mix(1., dry, .75) * (.7 + .3*br2);
    vec3 c = vCol * (.86 + .22*br) + (br2-.5)*.03;
    o = vec4(c, a * vA);
  }`;
  const VS_QUAD = `#version 300 es
  layout(location=0) in vec2 aP; out vec2 vUV;
  void main(){ vUV = aP*.5+.5; gl_Position = vec4(aP,0,1); }`;
  const FS_UNDER = `#version 300 es
  precision highp float; in vec2 vUV; uniform sampler2D uSrc; out vec4 o;
  void main(){ o = vec4(texture(uSrc, vec2(vUV.x, 1.-vUV.y)).rgb * .92, 1); }`;
  const FS_FINISH = `#version 300 es
  precision highp float; in vec2 vUV; uniform sampler2D uFx, uFxb; uniform float uTime, uGrain, uVig, uBloom, uFrame; out vec4 o;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
  void main(){
    vec2 uv = vec2(vUV.x, 1.-vUV.y);
    vec3 f = texture(uFx, uv).rgb + texture(uFxb, uv).rgb * uBloom;
    vec2 px = gl_FragCoord.xy;
    float weave = (sin(px.x*1.9)*sin(px.y*1.9))*.5+.5;
    float g = h(px + uFrame*1.7) - .5;
    float vig = 1. - uVig * pow(length((vUV-.5)*vec2(1.,.8))*1.25, 2.2);
    o.rgb = f;
    o.a = clamp(vig, 0., 1.) * (1. + g*uGrain) * (.94 + .06*weave);
  }`;

  function sh(type, s) { const x = gl.createShader(type); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x) + s); return x; }
  function prog(vs, fs) { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }
  function tex() { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }

  // stroke layers: cell spacing, stroke half-length/half-width, edge gating
  const LAYERS = [
    { cell: 24, len: 36, wid: 11, edgeLo: -1, edgeHi: 0, jit: 1.2, flowK: 1, alpha: .95 },
    { cell: 13, len: 16, wid: 5.5, edgeLo: .02, edgeHi: .07, jit: 1.1, flowK: .8, alpha: .95 },
    { cell: 7, len: 8, wid: 2.6, edgeLo: .05, edgeHi: .14, jit: 1, flowK: .5, alpha: 1 },
  ];

  function init(canvas) {
    gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    progStroke = prog(VS_STROKE, FS_STROKE); progQuad = prog(VS_QUAD, FS_UNDER); progFinish = prog(VS_QUAD, FS_FINISH);
    texSrc = tex(); texFx = tex(); texFxb = tex();
    // quad
    quadVao = gl.createVertexArray(); gl.bindVertexArray(quadVao);
    const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    // stroke instances per layer
    for (const L of LAYERS) {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const base = []; let k = 0;
      for (let y = -L.cell; y < H + L.cell; y += L.cell) for (let x = -L.cell; x < W + L.cell; x += L.cell) {
        base.push(x + (y / L.cell % 2) * L.cell * .5, y); k++;
      }
      // shuffle draw order so overlaps don't read as a grid
      const idx = [...Array(k).keys()]; for (let i = k - 1; i > 0; i--) { const j = (i * 2654435761 >>> 0) % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      const B = new Float32Array(k * 2), R = new Float32Array(k * 4);
      idx.forEach((s, d) => { B[d * 2] = base[s * 2]; B[d * 2 + 1] = base[s * 2 + 1]; for (let c = 0; c < 4; c++) R[d * 4 + c] = ((s * 7919 + c * 104729) % 10007) / 10007; });
      const bb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bb); gl.bufferData(gl.ARRAY_BUFFER, B, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(1, 1);
      const rb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, rb); gl.bufferData(gl.ARRAY_BUFFER, R, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(2, 1);
      layers.push({ ...L, vao, n: k });
    }
    gl.bindVertexArray(null);
  }

  function upload(t, c) { gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); }

  // o: { boil (paint frames per second), grain, vig, bloom, strokeK (size multiplier), layers mask }
  function present(t, o = {}) {
    const boilRate = o.boil ?? 8;
    bctx.globalCompositeOperation = 'copy'; bctx.filter = 'blur(5px)'; bctx.drawImage(fx, 0, 0, fxb.width, fxb.height); bctx.filter = 'none';
    upload(texSrc, src); upload(texFx, fx); upload(texFxb, fxb);
    gl.viewport(0, 0, W, H); gl.disable(gl.DEPTH_TEST);
    // underpainting
    gl.disable(gl.BLEND); gl.useProgram(progQuad); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texSrc);
    gl.uniform1i(gl.getUniformLocation(progQuad, 'uSrc'), 0); gl.bindVertexArray(quadVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // strokes
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
    gl.useProgram(progStroke);
    const U = (n) => gl.getUniformLocation(progStroke, n);
    gl.uniform1i(U('uSrc'), 0); gl.uniform2f(U('uRes'), W, H); gl.uniform1f(U('uTime'), t);
    const sk = o.strokeK ?? 1;
    layers.forEach((L, i) => {
      if (o.layers && !o.layers[i]) return;
      gl.uniform1f(U('uBoil'), (Math.floor(t * boilRate) % 251) + i * 300);
      gl.uniform1f(U('uCell'), L.cell); gl.uniform1f(U('uLen'), L.len * sk); gl.uniform1f(U('uWid'), L.wid * sk);
      gl.uniform1f(U('uEdgeLo'), L.edgeLo); gl.uniform1f(U('uEdgeHi'), L.edgeHi); gl.uniform1f(U('uJit'), L.jit);
      gl.uniform1f(U('uFlowK'), (o.flowK ?? 1) * L.flowK); gl.uniform2f(U('uSmear'), (o.smear || [0, 0])[0], (o.smear || [0, 0])[1]); gl.uniform1f(U('uAlpha'), L.alpha);
      gl.bindVertexArray(L.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, L.n);
    });
    // light + finish: additive light, then multiply by vignette/grain via alpha trick in two passes
    gl.useProgram(progFinish); const F = (n) => gl.getUniformLocation(progFinish, n);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texFx); gl.uniform1i(F('uFx'), 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texFxb); gl.uniform1i(F('uFxb'), 2);
    gl.uniform1f(F('uTime'), t); gl.uniform1f(F('uGrain'), o.grain ?? .08); gl.uniform1f(F('uVig'), o.vig ?? .55); gl.uniform1f(F('uBloom'), o.bloom ?? 1.2); gl.uniform1f(F('uFrame'), Math.floor(t * 24) % 97);
    gl.bindVertexArray(quadVao);
    // pass 1: dst *= alpha (vignette/grain/weave)
    gl.blendFuncSeparate(gl.ZERO, gl.SRC_ALPHA, gl.ZERO, gl.ONE); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // pass 2: dst += light
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.activeTexture(gl.TEXTURE0);
  }

  return { init, present, sctx, fctx, src, fx };
})();
