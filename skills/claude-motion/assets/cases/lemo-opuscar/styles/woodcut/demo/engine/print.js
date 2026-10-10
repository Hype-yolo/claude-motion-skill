// Woodcut engine · printing compositor (WebGL2)
// Takes the carve MASK (white = cut away, black = wood left standing) and an optional COLOUR PLATE
// (alpha = plate density) and turns them into either
//   mode 'print': black ink pulled onto laid paper — ragged knife edges, uneven ink, wood-grain streaks,
//                 specks where the ink didn't take, the colour plate overprinted with its own mottle and
//                 a fixed misregistration;
//   mode 'block': the inked wood block itself — glossy black surface with grain sheen, pale wood in the
//                 cuts with groove shading.
const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D M, C; uniform vec2 R; uniform float mode, seed, inkSeed, edge, plateAmt, inkAmt, grainAng, sheen;
uniform vec2 reg; uniform float wetX; uniform vec3 paperC, inkC, plateC, woodC;
out vec4 o;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=.5; } return s; }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
void main(){
  vec2 px = vec2(gl_FragCoord.x, R.y - gl_FragCoord.y);
  vec2 sp = px + seed*97.;             // paper-anchored noise
  vec2 ip = px + inkSeed*131.;         // per-impression noise (can step at 12 fps)
  // ragged knife edge: displace the lookup, then threshold with noise
  vec2 d = (vec2(vn(ip*.33), vn(ip*.33+19.7)) - .5) * 2.6 * edge + (vec2(vn(ip*1.3+5.), vn(ip*1.3+9.)) - .5) * 1.1 * edge;
  float m = texture(M, (px + d) / R).r;
  float th = .5 + (vn(ip*.7+3.) - .5) * .34 * edge;
  float cut = smoothstep(th - .1, th + .1, m);
  float ink = 1. - cut;
  vec3 col;
  if (mode < .5) {
    // ---- paper ----
    float cloud = fbm(sp*.0035) - .5, fib = vn(rot(.35)*sp*vec2(.9,.035)) + vn(rot(-.8)*sp*vec2(.7,.03)) - 1.;
    vec3 paper = paperC * (1. + .05*cloud + .022*fib + .018*(h21(sp)-.5));
    // colour plate (misregistered), mottled, overprints paper where the wood was cut
    float c = texture(C, (px - reg) / R).a;
    float cm = c * (.8 + .28*fbm(ip*.02+4.)) * plateAmt;
    cm *= 1. - .35*smoothstep(.6,.9, vn(ip*.25+2.)) ;
    vec3 base = mix(paper, paper * plateC / paperC, clamp(cm,0.,1.));
    // ---- ink ----
    vec2 gp = rot(grainAng) * ip;
    float dens = .965 + .035*(fbm(ip*.004)-.5)*2.;
    dens -= .045 * smoothstep(.62, .9, vn(gp*vec2(.0035, .7)));                   // wood grain streaks
    dens -= .55 * smoothstep(.84, .92, vn(ip*.5)) * smoothstep(.4, .8, fbm(ip*.007)); // specks that didn't take
    dens = clamp(dens * inkAmt, 0., 1.);
    vec3 inkT = inkC * mix(vec3(1.), plateC / paperC, .18 * clamp(cm, 0., 1.));    // black over the plate: warm black
    col = mix(base, inkT, ink * dens);
  } else {
    // ---- the inked block ----
    vec2 gp = rot(grainAng) * px;
    float grain = vn(gp*vec2(.003, .09)) * .6 + vn(gp*vec2(.01, .35)) * .4;
    vec3 wood = woodC * (.86 + .2*grain) * (1. + .04*(h21(px)-.5));
    float mb = textureLod(M, px / R, 2.2).r;                              // blurred mask → groove depth
    vec2 gm = vec2(textureLod(M, (px+vec2(3,0))/R, 2.).r - textureLod(M, (px-vec2(3,0))/R, 2.).r,
                   textureLod(M, (px+vec2(0,3))/R, 2.).r - textureLod(M, (px-vec2(0,3))/R, 2.).r);
    wood *= .62 + .38*smoothstep(.25, .95, mb);
    wood *= 1. + .5*clamp(dot(gm, vec2(-.7,-.7)), -.5, .5);               // lit / shaded groove walls
    float sh = pow(vn(gp*vec2(.0022, .3)), 3.) * sheen * .6 + .25*sheen*smoothstep(0., 1., 1. - length((px - vec2(.25,.2)*R)/R));
    float wet = smoothstep(wetX + 40., wetX - 60., px.x) * step(0., wetX);
    sh += wet * (.05 + .22 * pow(vn(gp*vec2(.004, .02) + 3.), 2.));
    vec3 surf = inkC * (1. + .18*grain) + vec3(sh);
    col = mix(wood, surf, ink);
  }
  o = vec4(col, 1.);
}`;
const hex = s => { const n = parseInt(s.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

export function makePrinter(W = 1920, H = 1080) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
  if (!gl) throw new Error('webgl2 unavailable');
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = u => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
  const tM = tex(0), tC = tex(1);
  const U = n => gl.getUniformLocation(pr, n);
  gl.uniform1i(U('M'), 0); gl.uniform1i(U('C'), 1); gl.uniform2f(U('R'), W, H);
  const blank = document.createElement('canvas'); blank.width = 4; blank.height = 4;
  function upload(u, t, c) { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.generateMipmap(gl.TEXTURE_2D); }
  return {
    canvas: cv,
    // mask: canvas (white = cut), color: canvas with alpha = plate density (or null)
    render(mask, color, o = {}) {
      gl.viewport(0, 0, W, H);
      upload(0, tM, mask); upload(1, tC, color || blank);
      gl.uniform1f(U('mode'), o.mode === 'block' ? 1 : 0);
      gl.uniform1f(U('seed'), o.seed ?? 1); gl.uniform1f(U('inkSeed'), o.inkSeed ?? o.seed ?? 1);
      gl.uniform1f(U('edge'), o.edge ?? 1); gl.uniform1f(U('plateAmt'), o.plateAmt ?? 1); gl.uniform1f(U('inkAmt'), o.inkAmt ?? 1);
      gl.uniform1f(U('grainAng'), o.grainAng ?? 0); gl.uniform1f(U('sheen'), o.sheen ?? .12);
      gl.uniform2f(U('reg'), ...(o.reg || [3, 2])); gl.uniform1f(U('wetX'), o.wetX ?? -1);
      gl.uniform3f(U('paperC'), ...hex(o.paper || '#EFE8D8')); gl.uniform3f(U('inkC'), ...hex(o.ink || '#111111'));
      gl.uniform3f(U('plateC'), ...hex(o.plate || '#C8502A')); gl.uniform3f(U('woodC'), ...hex(o.wood || '#D8C29C'));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return cv;
    }
  };
}
