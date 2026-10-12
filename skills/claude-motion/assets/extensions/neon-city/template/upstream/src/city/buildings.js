// Every building tier is one instance of a unit box. Homes, offices and towers wear real facades from a
// texture array (assets-src/facades.mjs): Hong Kong walls captured from photo-textured models, with rooms
// lit per window behind the glass, and photographed night office towers. Warehouses, masts, shop podiums and
// the Zenith stay procedural. On top: interior parallax, LED fins and crowns, rain, neon spill from the street.
import * as THREE from 'three/webgpu';
import {
  attribute, positionWorld, positionGeometry, normalGeometry, vec2, vec3, vec4, float, floor, fract, mix, smoothstep,
  step, select, abs, max, min, texture, cameraPosition, cameraViewMatrix, exp, sin, fwidth, length, dot, normalize, atan,
  round, sqrt,
} from 'three/tsl';
import { CITY, STYLE } from './layout.js';
import { hash12, hash13, filteredPulse } from '../tsl/util.js';
import { hash2 } from '../core/rng.js';
import { U, noiseTex } from '../core/shared.js';
import { lmUV } from './lightmap.js';
import { chunkedInstances, iPR, iS } from './instancing.js';
import FAC from './facades.json';

const PALETTE = ['#8a8f94', '#9d8c7f', '#7f9b92', '#a48b92', '#8e9aaa', '#6f6a64', '#a39d8c', '#7d8a9e'].map((h) => new THREE.Color(h));
// Hong Kong mosaic tile: faded pastels over grey concrete
const TILE_TINT = ['#f0e6d2', '#d9e6e0', '#e8d6d6', '#d6dfeb', '#efe3c4', '#e0e0e0', '#dcd2e6', '#cfe3d0'].map((h) => new THREE.Color(h));
const ACCENT = ['#2de2ff', '#ff3df2', '#ffb03a', '#7a5cff', '#3dff8b', '#ff2a3c', '#eaf6ff'].map((h) => new THREE.Color(h));
const LAYER = Object.fromEntries(FAC.layers.map((l, i) => [l.name, i]));

export const CHUNK = 400;
// facade kit: buildings this close to U.kitCenter wear modelled facades; their upper walls step back to make room
export const KIT_NEAR = 180;
export const KIT_INSET = 0.9;

// null: the procedural curtain wall (buildings differ in grid, glass and spandrel; sharp at any distance)
const LAYER_PICK = {
  [STYLE.TENEMENT]: ['hk-brown', 'hk-pink', 'hk-office', 'tonglau', 'hk-brown', 'hk-pink'],
  [STYLE.ESTATE]: ['hk-white', 'hk-tower', 'hk-pink', 'hk-tower'],
  [STYLE.OFFICE]: ['hk-office', null, 'piers', null, 'office-c', null],
  [STYLE.GLASS]: [null],
};
// massing.js feature kinds, as aInfo.x codes (0-4 styles, 5 masts)
const KIND = { clad: 6, louvre: 8, led: 9, plant: 10 };

// which facade a tier wears and where its grid starts on each face (0 west, 1 east, 2 north, 3 south).
// Decided here rather than in the shader so the facade kit can lay its cells on exactly the same grid.
function facadeOf(b, t, key, kitLayers) {
  const style = t.style ?? b.style;
  const names = t.kind || t.mast ? null : LAYER_PICK[style];
  const name = names ? names[Math.floor(((b.seed * 13.71) % 1) * names.length)] : null;
  const layer = name ? LAYER[name] : -1;
  const L = FAC.layers[Math.max(0, layer)];
  const res = L.kind === 'res';
  const bayOff = [], floorOff = [];
  let bays = 0, floors = 0;
  for (let f = 0; f < 4; f++) {
    const r = hash2(key, f + 11);
    bayOff.push(res ? Math.floor(r * L.bays) : 0);
    floorOff.push(res ? Math.floor(((r * 7.7) % 1) * L.floors) : 0);
    bays += bayOff[f] * 8 ** f;
    floors += floorOff[f] * 8 ** f;
  }
  const kit = !!name && kitLayers.has(name) && !b.zenith && (style === STYLE.TENEMENT || style === STYLE.ESTATE);
  // tenements keep a shop band below 4.6 m that the kit leaves to the shopfronts
  const split = kit ? (style === STYLE.TENEMENT && t.y0 === 0 ? 4.6 : 0) : -1;
  return { layer, name, bayOff, floorOff, packed: [layer, bays, floors, split], kit, split };
}

// unit box (y 0..1) whose walls are cut at a split height: below it the wall stays on the lot line, above it
// the wall can step back (a ledge closes the step). aWall = (outward normal x, z, segment): 0 fixed, 1 split
// height on the line, 2 split height stepped back, 3 top stepped back.
function splitBox() {
  const pos = [], nrm = [], wall = [], idx = [];
  const quad = (v, n) => {
    const b = pos.length / 3;
    for (const [p, w] of v) { pos.push(...p); nrm.push(...n); wall.push(...w); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  for (const [nx, nz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    // corners left to right as seen from outside
    const L = [nx * 0.5 - nz * 0.5, nz * 0.5 + nx * 0.5], R = [nx * 0.5 + nz * 0.5, nz * 0.5 - nx * 0.5];
    const P = (c, y) => [c[0], y, c[1]];
    const w = (seg) => [nx, nz, seg];
    quad([[P(L, 0), w(0)], [P(R, 0), w(0)], [P(R, 0.5), w(1)], [P(L, 0.5), w(1)]], [nx, 0, nz]);
    quad([[P(L, 0.5), w(1)], [P(R, 0.5), w(1)], [P(R, 0.5), w(2)], [P(L, 0.5), w(2)]], [0, 1, 0]);
    quad([[P(L, 0.5), w(2)], [P(R, 0.5), w(2)], [P(R, 1), w(3)], [P(L, 1), w(3)]], [nx, 0, nz]);
  }
  quad([[[-0.5, 1, 0.5], [0, 0, 0]], [[0.5, 1, 0.5], [0, 0, 0]], [[0.5, 1, -0.5], [0, 0, 0]], [[-0.5, 1, -0.5], [0, 0, 0]]], [0, 1, 0]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aWall', new THREE.Float32BufferAttribute(wall, 3));
  g.setIndex(idx);
  return g;
}

export function createBuildings(city, tex, lightmap, facades, kitLayers = new Set()) {
  const all = [...city.buildings, ...city.outer];
  const chunks = new Map();
  for (let bi = 0; bi < all.length; bi++) {
    const b = all[bi];
    if (b.baked) continue; // district.js draws it
    for (let ti = 0; ti < b.tiers.length; ti++) {
      const t = b.tiers[ti];
      t.fac = facadeOf(b, t, bi * 8 + ti, kitLayers);
      const key = `${Math.floor(t.x / CHUNK)},${Math.floor(t.z / CHUNK)}`;
      if (!chunks.has(key)) chunks.set(key, []);
      chunks.get(key).push({ b, t, top: !t.feat && !t.mast && t.y1 >= b.h - 0.01 });
    }
  }

  const base = splitBox();

  const material = createFacadeMaterial(tex, lightmap, facades);
  const items = [];
  for (const list of chunks.values()) for (const it of list) items.push(it);
  for (const it of items) { it.x = it.t.x; it.z = it.t.z; }
  const group = chunkedInstances({
    items, geometry: base, material, chunk: CHUNK, name: 'buildings', rotated: false,
    place: ({ t }) => [t.x, t.y0, t.z, 0, t.w, t.y1 - t.y0, t.d],
    attrs: {
      aInfo: { size: 4, fn: ({ b, t, top }) => [t.mast ? 5 : t.kind ? KIND[t.kind] : (t.style ?? b.style), b.seed, b.h, top ? 1 : 0] },
      aSize: { size: 4, fn: ({ t }) => [t.y0, t.y1, t.w, t.d] },
      aFac: { size: 4, fn: ({ t }) => t.fac.packed },
    },
  });
  material.positionNode = buildingPosition();
  return { group, material };
}

function buildingPosition() {
  const aw = attribute('aWall', 'vec3');
  const fac = attribute('aFac', 'vec4');
  const seg = aw.z;
  const atSplit = step(0.5, seg).mul(step(seg, 2.5));
  const stepped = step(1.5, seg);
  const h = iS.y;
  const y = mix(positionGeometry.y, max(fac.w, 0).div(h).min(1), atSplit);
  const p = vec3(positionGeometry.x, y, positionGeometry.z).mul(iS).add(iPR.xyz);
  // same distance the kit measures on the CPU: to the tier's footprint centre, vertically to its span
  const c = U.kitCenter;
  const dy = max(float(0), max(iPR.y.sub(c.y), c.y.sub(iPR.y.add(h))));
  const d = length(vec3(iPR.x.sub(c.x), dy, iPR.z.sub(c.z)));
  const near = step(0, fac.w).mul(step(d, KIT_NEAR));
  return p.sub(vec3(aw.x, 0, aw.y).mul(stepped.mul(near).mul(KIT_INSET)));
}

function palette(list, idx) {
  // small constant table lookup without arrays: chain of selects
  let c = vec3(list[0].r, list[0].g, list[0].b);
  for (let i = 1; i < list.length; i++) c = select(idx.greaterThanEqual(i - 0.5), vec3(list[i].r, list[i].g, list[i].b), c);
  return c;
}

// per-layer constant from facades.json
function lut(layer, fn) {
  let v = float(fn(FAC.layers[0]));
  for (let i = 1; i < FAC.layers.length; i++) v = select(layer.greaterThanEqual(i - 0.5), float(fn(FAC.layers[i])), v);
  return v;
}

const OFFICE_TONE = ['#ffcf98', '#fff0d8', '#f4f6ff', '#dcecff', '#fff4e6', '#c9f2ff'].map((h) => new THREE.Color(h));
const GLASS_TINT = ['#0c1a22', '#1b150e', '#0a0c11', '#0f222c', '#0c1d16', '#1a1a1f'].map((h) => new THREE.Color(h));
const SPANDREL = ['#08090c', '#2c3036', '#4a463f', '#2e241b', '#11161e', '#3d4148'].map((h) => new THREE.Color(h));
const CURTAINS = ['#e8d9b8', '#d9a7a0', '#9fb6d6', '#b7cfa4', '#e6c27a', '#c9a3c9', '#f0ece2', '#a0a0a0'].map((h) => new THREE.Color(h));
const WALLPAPER = ['#d8d2c4', '#c9d6cf', '#e2d8c0', '#bfc8d4', '#d4c3c3'].map((h) => new THREE.Color(h));

function createFacadeMaterial(tex, lightmap, fac) {
  const m = new THREE.MeshStandardNodeMaterial();
  const info = attribute('aInfo', 'vec4');
  const size = attribute('aSize', 'vec4');
  const style = info.x, seed = info.y, bH = info.z, isTop = info.w;
  const y1 = size.y;

  const isTen = step(abs(style.sub(STYLE.TENEMENT)), 0.5);
  const isGlass = step(abs(style.sub(STYLE.GLASS)), 0.5);
  const isEst = step(abs(style.sub(STYLE.ESTATE)), 0.5);
  const isOff = step(abs(style.sub(STYLE.OFFICE)), 0.5);
  const isWare = step(abs(style.sub(STYLE.WAREHOUSE)), 0.5);
  const isMast = step(abs(style.sub(5)), 0.5);
  const isRes = isTen.add(isEst).min(1); // homes: small windows, curtains, rooms
  const isClad = step(abs(style.sub(6)), 0.5), isLouv = step(abs(style.sub(8)), 0.5);
  const isLed = step(abs(style.sub(9)), 0.5), isPlant = step(abs(style.sub(10)), 0.5);
  const isFeat = isClad.add(isLouv).add(isLed).add(isPlant).min(1);

  const n = normalGeometry;
  const isRoof = step(0.5, n.y);
  const P = positionWorld;
  // facade frame, as seen from outside: u runs left to right from the face's left edge, v is height
  const uDir = vec3(n.z, 0, n.x.negate());
  const faceW = abs(n.z).mul(size.z).add(abs(n.x).mul(size.w));
  const u = positionGeometry.x.mul(size.z).mul(n.z).sub(positionGeometry.z.mul(size.w).mul(n.x)).add(faceW.mul(0.5));
  const v = P.y;
  const faceId = n.x.add(n.z.mul(2)).add(3);
  const streetBand = step(v, 4.6).mul(isTen.add(isOff));

  // --- real facades: which layer, and where on it (chosen per tier on the CPU, see facadeOf) ---
  const grid = attribute('aFac', 'vec4');
  const layer = grid.x;
  const faceIdx = select(abs(n.x).greaterThan(0.5), step(0, n.x), step(0, n.z).add(2));
  const digit = (packed) => {
    const d = select(faceIdx.lessThan(0.5), float(1), select(faceIdx.lessThan(1.5), float(8), select(faceIdx.lessThan(2.5), float(64), float(512))));
    const q = floor(packed.div(d).add(0.001));
    return q.sub(floor(q.div(8).add(0.001)).mul(8));
  };
  const useFac = isRes.add(isOff).add(isGlass).min(1).mul(isRoof.oneMinus()).mul(streetBand.oneMinus()).mul(step(bH, 1500)).mul(step(-0.5, layer)); // the Zenith keeps its own skin
  const fl = layer.max(0);
  const litKind = lut(layer, (l) => (l.kind === 'lit' ? 1 : 0));
  const isResL = litKind.oneMinus().mul(useFac), isLitL = litKind.mul(useFac);
  const tW = lut(layer, (l) => l.w), tH = lut(layer, (l) => l.h);
  const tBays = lut(layer, (l) => Math.max(1, l.bays)), tFloors = lut(layer, (l) => l.floors);
  const faceRnd = hash12(vec2(seed.mul(71.3), faceId));
  // home facades: bays stretch a little so every face ends on a whole window; floors keep the city's 3.1 m
  const colFit = faceW.max(0.5).div(max(float(1), round(faceW.div(tW.div(tBays)))));
  const bayOff = digit(grid.y), floorOff = digit(grid.z);
  const resFloorH = tH.div(tFloors);
  // image rows run top-down, so the tile's v is negated (the sampler repeats)
  const resUV = vec2(u.div(colFit).add(bayOff).div(tBays), v.div(resFloorH).add(floorOff).div(tFloors).negate());
  const litUV = vec2(u.div(tW).add(faceRnd.mul(3.7)), v.div(tH).add(fract(faceRnd.mul(5.3))).negate());
  const fuv = mix(litUV, resUV, isResL);
  const fA = texture(fac.albedo, fuv).depth(fl).rgb;
  const fM = texture(fac.mask, fuv).depth(fl);
  const fN = texture(fac.normal, fuv).depth(fl);

  // procedural curtain walls: every tower its own grid, floor height, glazing ratio, glass and spandrel
  const hA = fract(seed.mul(91.7)), hB = fract(seed.mul(57.3)), hC = fract(seed.mul(33.1)), hD = fract(seed.mul(77.9));

  const floorH = mix(isGlass.mul(mix(float(3.6), float(4.3), hB)).add(isOff.mul(mix(float(3.4), float(4.0), hB))).add(isEst.mul(2.9)).add(isTen.mul(CITY.floorH)).add(isWare.mul(5)).add(isMast.mul(4)), resFloorH, isResL);
  const colW = mix(mix(float(2.0), float(2.7), fract(seed.mul(7.13))).mul(isTen).add(isEst.mul(2.3)).add(isGlass.mul(mix(float(1.25), float(2.1), hA))).add(isOff.mul(mix(float(2.2), float(3.4), hA))).add(isWare.mul(7)).add(isMast.mul(2)), colFit, isResL);

  const cu = u.div(colW), cv = v.div(floorH);
  const fu = fract(cu), fv = fract(cv);
  const wu = fwidth(cu), wv = fwidth(cv);
  const far = smoothstep(0.3, 0.9, max(wu, wv));

  // on a home facade each window is its own room: the id in the mask plus which repeat of the tile
  const winId = floor(fM.g.mul(255).add(0.5));
  const rep = floor(resUV);
  const cell = mix(vec2(floor(cu), floor(cv)), vec2(winId.add(rep.x.mul(257)), rep.y), isResL);

  const rnd = hash13(vec3(cell.x.add(faceId.mul(1013)), cell.y, seed.mul(977)));
  const rnd2 = hash13(vec3(cell.x.mul(1.7).add(seed.mul(311)), cell.y.mul(3.1), faceId));
  const rnd3 = hash13(vec3(cell.y.mul(2.3), cell.x.add(seed.mul(53)), faceId.mul(7)));

  // procedural window apertures: warehouses, masts, the Zenith
  const wx0 = mix(float(0.2), float(0.04), isGlass.add(isOff).min(1));
  const wx1 = float(1).sub(wx0);
  const wy0 = isRes.mul(0.3).add(isGlass.mul(mix(float(0.04), float(0.3), hC))).add(isOff.mul(mix(float(0.22), float(0.4), hC))).add(isWare.mul(0.55)).add(isMast);
  const wy1 = isRes.mul(0.76).add(isGlass.mul(0.97)).add(isOff.mul(mix(float(0.82), float(0.93), hD))).add(isWare.mul(0.8)).add(isMast);
  const winX = filteredPulse(cu, wx0, wx1, wu);
  const winY = filteredPulse(cv, wy0, wy1, wv);
  const wareGate = mix(float(1), step(6, v).mul(step(0.6, rnd)), isWare);
  const procWindow = winX.mul(winY).mul(streetBand.oneMinus()).mul(isRoof.oneMinus()).mul(wareGate).mul(isMast.oneMinus()).mul(useFac.oneMinus()).mul(isFeat.oneMinus());
  const window = mix(procWindow, fM.r, isResL);
  // position inside the aperture, 0..1
  const ax = fu.sub(wx0).div(wx1.sub(wx0)).clamp(0, 1);
  const ay = fv.sub(wy0).div(wy1.sub(wy0)).clamp(0, 1);

  // lit rooms; a few change every minute or two
  const slow = floor(U.time.div(mix(float(50), float(170), rnd2)).add(rnd2.mul(9)));
  const flick = hash13(vec3(cell.x, cell.y, slow.add(seed.mul(53))));
  // offices light by tenant: runs of a few to a dozen bays per floor, the odd whole floor
  const zone = floor(cell.x.div(floor(mix(float(4), float(13), hD))));
  const floorRnd = mix(hash12(vec2(cell.y.add(zone.mul(0.37)), seed.mul(131).add(faceId))), hash12(vec2(cell.y, seed.mul(7.1))).mul(0.6), step(0.86, hash12(vec2(cell.y.mul(1.3), seed.mul(17)))));
  const litRatio = isTen.mul(0.36).add(isEst.mul(0.5)).add(isOff.add(isGlass).mul(mix(float(0.14), float(0.5), hB))).add(isWare.mul(0.2));
  const pickLit = mix(mix(rnd, flick, 0.3), floorRnd, isGlass.add(isOff).min(1).mul(useFac.oneMinus()));
  const lit = step(pickLit, litRatio);

  // room light: Hong Kong homes run on cool fluorescent tubes; some tungsten, the odd coloured lamp
  const warm = vec3(1.0, 0.66, 0.36), fluo = vec3(0.82, 0.96, 1.0), led = vec3(0.7, 0.8, 1.0);
  const neonRoom = mix(vec3(1.0, 0.3, 0.8), vec3(0.3, 0.85, 1.0), step(0.5, fract(rnd2.mul(13.0))));
  let roomCol = mix(fluo, warm, step(0.58, rnd2));
  roomCol = mix(roomCol, neonRoom, step(0.94, rnd2).mul(isTen));
  // each office tenant its own lighting: warm, neutral or daylight panels, one floor-zone at a time
  const offTone = palette(OFFICE_TONE, floor(hash12(vec2(zone.add(faceId.mul(31)), cell.y.add(seed.mul(41)))).mul(OFFICE_TONE.length)));
  roomCol = mix(roomCol, offTone, isGlass.add(isOff).min(1));

  // interior mapping: march the view ray into a room the size of the cell
  const rd = normalize(P.sub(cameraPosition));
  const du = dot(rd, uDir), dv = rd.y, dn = dot(rd, vec3(n).negate()).max(0.02);
  const depth = mix(float(3.6), float(6.5), isGlass.add(isOff).min(1));
  const x0 = fu.mul(colW), yy0 = fv.mul(floorH);
  const sdu = select(du.greaterThanEqual(0), du.max(1e-4), du.min(-1e-4));
  const sdv = select(dv.greaterThanEqual(0), dv.max(1e-4), dv.min(-1e-4));
  const tx = select(sdu.greaterThan(0), colW.sub(x0).div(sdu), x0.negate().div(sdu));
  const ty = select(sdv.greaterThan(0), floorH.sub(yy0).div(sdv), yy0.negate().div(sdv));
  const tz = depth.div(dn);
  const tmin = min(min(tx, ty), tz);
  const hx = x0.add(sdu.mul(tmin)), hy = yy0.add(sdv.mul(tmin)), hz = dn.mul(tmin);
  const onBack = step(tz, min(tx, ty));
  const onSide = step(tx, min(ty, tz)).mul(onBack.oneMinus());
  const onCeil = step(ty, min(tx, tz)).mul(step(0, sdv)).mul(onBack.oneMinus());
  const onFloor = step(ty, min(tx, tz)).mul(step(sdv, 0)).mul(onBack.oneMinus());
  const lamp = vec3(colW.mul(0.5), floorH.sub(0.05), depth.mul(0.45));
  const toLamp = vec3(hx, hy, hz).sub(lamp);
  const fall = float(1.6).div(float(1).add(dot(toLamp, toLamp).mul(0.22)));
  const paper = palette(WALLPAPER, floor(rnd3.mul(WALLPAPER.length)));
  const furniture = step(hy, mix(float(0.9), float(1.9), hash12(vec2(floor(hx.div(0.9)), rnd)))).mul(step(0.35, hash12(vec2(floor(hx.div(0.9)).add(5), rnd2)))).mul(onBack);
  const tube = onCeil.mul(smoothstep(0.08, 0.02, abs(hz.sub(lamp.z)))).mul(smoothstep(0.5, 0.35, abs(hx.sub(lamp.x)).div(colW)));
  const surf = paper.mul(onBack.add(onSide.mul(0.7))).add(vec3(0.5, 0.45, 0.4).mul(onFloor.mul(0.45))).add(vec3(0.8).mul(onCeil.mul(0.6)));
  const roomLit = surf.mul(furniture.mul(-0.75).add(1)).mul(fall).mul(roomCol).add(roomCol.mul(tube.mul(5)));
  const roomDark = surf.mul(0.012).mul(fall);

  // curtains glow with the room behind them; grilles and frames sit in front of everything.
  // Captured facades already hold curtains and furniture behind their panes: those light up with the room,
  // and the parallax room shows through where the pane is clear.
  const paneLum = dot(fA, vec3(0.2126, 0.7152, 0.0722));
  const drawn = smoothstep(0.04, 0.22, paneLum);
  const photoRoom = fA.mul(roomCol).mul(fall.mul(0.8).add(2.2));
  const curtainOn = step(0.38, rnd3).mul(isRes).mul(isResL.oneMinus());
  const cover = mix(float(0.25), float(1.05), hash12(cell.add(seed.mul(9))));
  const fromLeft = step(0.5, fract(rnd3.mul(7)));
  const cx = mix(float(1).sub(ax), ax, fromLeft);
  const curtainMask = curtainOn.mul(step(cx, cover)).mul(sin(cx.mul(60).add(rnd.mul(9))).mul(0.15).add(0.85));
  const curtainCol = palette(CURTAINS, floor(fract(rnd3.mul(17)).mul(CURTAINS.length)));
  const blinds = isGlass.add(isOff).min(1).mul(step(0.55, rnd3)).mul(smoothstep(0.4, 0.5, fract(ay.mul(16))).mul(0.55).add(0.45));
  const procInside = mix(roomLit, curtainCol.mul(roomCol).mul(fall.mul(0.5).add(0.25)), curtainMask).mul(blinds.oneMinus().mul(0.6).add(0.4).mul(isGlass.add(isOff).min(1)).add(isRes.add(isWare)));
  const inside = mix(procInside, mix(roomLit.mul(0.7), photoRoom, drawn.mul(0.5).add(0.45)), isResL);
  const tv = step(0.95, rnd).mul(isRes).mul(sin(U.time.mul(9).add(rnd.mul(40))).mul(0.3).add(sin(U.time.mul(23.0).add(rnd2.mul(20))).mul(0.2)).add(0.5));
  const tvLight = vec3(0.4, 0.55, 1.0).mul(tv).mul(0.5);
  // after hours most office floors keep a corridor or a cleaner's light on
  const isOffice = isGlass.add(isOff).min(1);
  const dimOn = step(pickLit, litRatio.add(0.3)).mul(isOffice);
  const roomOut = mix(roomDark.add(tvLight).add(roomLit.mul(dimOn).mul(0.07)), inside, lit);
  const mullion = filteredPulse(ax, float(0.48), float(0.52), wu.mul(2.5)).mul(isRes)
    .add(filteredPulse(ay, float(0.62), float(0.66), wv.mul(2.5)).mul(isRes.mul(step(0.5, rnd2))))
    .add(float(1).sub(smoothstep(0.0, 0.04, ax).mul(smoothstep(1.0, 0.96, ax)).mul(smoothstep(0.0, 0.05, ay)).mul(smoothstep(1.0, 0.95, ay)))).min(1);
  const grille = step(0.66, hash12(cell.mul(0.77).add(seed))).mul(isTen).mul(filteredPulse(ax.mul(9), float(0), float(0.16), wu.mul(9)).max(filteredPulse(ay.mul(3), float(0), float(0.1), wv.mul(3))));
  const glassOcc = mullion.add(grille.mul(0.85)).min(1).mul(isResL.oneMinus());
  const procAvg = isRes.mul(0.34).add(isOffice.mul(0.03)).add(isGlass.mul(0.42)).add(isOff.mul(0.36)).add(isWare.mul(0.05)).mul(useFac.oneMinus());
  const roomAvg = roomCol.mul(litRatio).mul(mix(procAvg, fM.r.mul(1.4), isResL));
  const emitWin = mix(roomOut.mul(float(1).sub(glassOcc)).mul(window), roomAvg.mul(isRoof.oneMinus()).mul(streetBand.oneMinus()), far);

  // photographed night towers: the lit fraction glows; floors go dark and come back over the evening
  const floorIdx = floor(v.div(tH.div(tFloors)));
  const floorSlow = floor(U.time.div(90).add(hash12(vec2(floorIdx, seed.mul(19))).mul(7)));
  const floorOn = step(0.22, hash13(vec3(floorIdx, seed.mul(61).add(faceId), floorSlow))).mul(0.85).add(0.15);
  const officeTone = mix(vec3(1.0, 0.94, 0.86), vec3(0.86, 0.95, 1.05), fract(seed.mul(23.9)));
  const photoEmit = fA.mul(fM.r).mul(officeTone).mul(floorOn).mul(1.9).mul(isLitL);

  // walls: weathered pastel; captured walls keep their own grime and get a faded mosaic tint
  const colIdx = floor(fract(seed.mul(17.3)).mul(PALETTE.length));
  const wallTint = palette(PALETTE, colIdx);
  const conc = texture(tex.concreteAlbedo, vec2(v, u).div(6.2)).rgb;
  const nz = texture(noiseTex, vec2(u.div(41), v.div(53)));
  const drip = step(0.55, rnd).mul(isTen).mul(smoothstep(0.32, 0.08, abs(fu.sub(0.55)))).mul(smoothstep(0.3, 0.0, fv)).mul(texture(noiseTex, vec2(u.div(1.3), v.div(9))).a.mul(0.8).add(0.2));
  const slabLine = isRes.mul(filteredPulse(cv, float(0), float(0.06), wv)).mul(0.5);
  const grime = smoothstep(0.0, 9.0, v).mul(0.3).add(0.7).mul(float(1).sub(drip.mul(0.6)));
  const resWall = wallTint.mul(mix(vec3(0.9), conc.mul(1.5), 0.35)).mul(grime).mul(nz.r.mul(0.45).add(0.78)).mul(float(1).add(slabLine));
  // the shop band is street-level concrete, not the painted tower: grey, stained, with a dark plinth
  const bandWall = conc.mul(vec3(0.5, 0.49, 0.47)).mul(nz.r.mul(0.4).add(0.7)).mul(mix(float(0.45), float(1), smoothstep(0.3, 0.45, v)))
    .mul(float(1).sub(texture(noiseTex, vec2(u.div(0.9), v.div(7))).a.mul(smoothstep(4.6, 1.5, v)).mul(0.35)));
  const tileTint = palette(TILE_TINT, floor(fract(seed.mul(31.7)).mul(TILE_TINT.length)));
  const tintAmt = mix(float(0.25), float(0.75), fract(seed.mul(5.9)));
  const capturedWall = fA.mul(mix(vec3(1), tileTint.mul(1.15), tintAmt)).mul(nz.r.mul(0.3).add(0.85)).mul(smoothstep(0.0, 14.0, v).mul(0.25).add(0.75));
  const glassBody = palette(GLASS_TINT, floor(fract(seed.mul(3.7)).mul(GLASS_TINT.length)));
  const spandrel = palette(SPANDREL, floor(fract(seed.mul(19.3)).mul(SPANDREL.length)));
  const wareWall = vec3(0.17, 0.18, 0.19).mul(texture(tex.shutterAlbedo, vec2(u.div(3), v.div(3))).rgb.mul(1.4));
  const roofCol = vec3(0.07, 0.07, 0.078).mul(nz.g.mul(0.6).add(0.7));

  let albedo = mix(resWall, bandWall, streetBand).mul(isTen.add(isEst).add(isOff)).add(wareWall.mul(isWare)).add(spandrel.mul(isGlass)).add(vec3(0.05).mul(isMast));
  albedo = mix(albedo, glassBody, procWindow.mul(isGlass.add(isOff).min(1)).mul(far.oneMinus()));
  albedo = mix(albedo, vec3(0.008, 0.009, 0.012), procWindow.mul(isRes.add(isWare)).mul(float(1).sub(glassOcc)).mul(far.oneMinus()));
  albedo = mix(albedo, vec3(0.09, 0.09, 0.1), procWindow.mul(glassOcc).mul(far.oneMinus()));
  // real facades: glass goes dark (the rooms light it from inside); a photo's lit fraction is emissive
  albedo = mix(albedo, mix(capturedWall, fA.mul(0.06), fM.r), isResL);
  albedo = mix(albedo, fA.mul(fM.r.oneMinus()).mul(0.9), isLitL);
  // massing features: anodised or stone cladding with panel joints, louvred plant floors, LED crowns, bare plant
  const pu = u.div(1.5), pv = v.div(3.0);
  const joint = filteredPulse(pu, float(0), float(0.035), fwidth(pu)).max(filteredPulse(pv, float(0), float(0.03), fwidth(pv)));
  const cladCol = mix(vec3(0.045, 0.05, 0.06), vec3(0.16, 0.15, 0.14), step(0.6, fract(seed.mul(47.3)))).mul(joint.mul(-0.55).add(1));
  const sv = v.div(0.34);
  const slat = filteredPulse(sv, float(0), float(0.5), fwidth(sv));
  const louvCol = mix(vec3(0.02), vec3(0.13, 0.13, 0.14), slat);
  const plantCol = conc.mul(vec3(0.42, 0.41, 0.4)).mul(nz.r.mul(0.4).add(0.7)).mul(grime);
  albedo = mix(albedo, cladCol, isClad);
  albedo = mix(albedo, louvCol, isLouv);
  albedo = mix(albedo, plantCol, isPlant);
  albedo = mix(albedo, vec3(0.015), isLed);
  albedo = mix(albedo, roofCol, isRoof);

  const procGlassy = procWindow.mul(float(1).sub(glassOcc)).mul(far.oneMinus());
  const procMetal = procGlassy.mul(isGlass.add(isOff).min(1)).mul(0.8).add(procGlassy.mul(isRes).mul(0.3)).mul(step(bH, 1500).mul(0.75).add(0.25)); // the Zenith stays dark glass
  const facMetal = mix(fM.r.mul(0.35), max(fN.b.mul(0.45), smoothstep(0.35, 0.1, fM.b).mul(0.45)), litKind);
  m.metalnessNode = mix(mix(procMetal, facMetal, useFac), isClad.mul(0.75).add(isLouv.mul(0.5)), isFeat.mul(isRoof.oneMinus()));
  const procRough = mix(mix(float(0.7), float(0.48), U.rain), float(0.05), procGlassy).mul(isRoof.mul(0.4).add(1)).min(1);
  m.roughnessNode = mix(mix(procRough, fM.b.mul(mix(float(1), float(0.7), U.rain)), useFac), isClad.mul(0.32).add(isLouv.mul(0.5)).add(isPlant.mul(0.9)).add(isLed.mul(0.4)), isFeat.mul(isRoof.oneMinus()));

  // relief from the captured normals (AC units, sills, frames) in the face's own frame
  // photo normals are derived from the picture and ripple in reflections: photo layers stay flat
  const tn = fN.rg.mul(2).sub(1).mul(litKind.oneMinus());
  const nFac = normalize(uDir.mul(tn.x).add(vec3(0, tn.y, 0)).add(vec3(n).mul(sqrt(float(1).sub(dot(tn, tn)).max(0.02)))));
  m.normalNode = cameraViewMatrix.mul(vec4(mix(vec3(n), nFac, useFac), 0)).xyz.normalize();

  // LED dressing on towers: vertical fins, floor lines and crowns, some animated
  const accentIdx = floor(fract(seed.mul(29.7)).mul(ACCENT.length));
  const accent = palette(ACCENT, accentIdx);
  const ledKind = fract(seed.mul(41.3));
  // real towers carry their LEDs on the corners and every few floors, not as stripes over the glass
  const wall = isRoof.oneMinus();
  const corner = smoothstep(fwidth(u).add(0.35), float(0.3), u).add(smoothstep(faceW.sub(0.35).sub(fwidth(u)), faceW.sub(0.3), u)).min(1);
  const fin = corner.mul(step(ledKind, 0.35)).mul(isGlass).mul(wall);
  const floorLine = filteredPulse(cv.div(5), float(0.0), float(0.012), wv.div(5)).mul(step(0.35, ledKind).mul(step(ledKind, 0.55))).mul(isGlass).mul(wall);
  const sweep = sin(v.mul(0.02).sub(U.time.mul(1.4)).add(seed.mul(30))).mul(0.5).add(0.5);
  const crownBand = smoothstep(y1.sub(9), y1.sub(1), v).mul(isTop).mul(step(110, bH)).mul(step(0.6, fract(seed.mul(53.1)))).mul(isGlass.add(isOff).min(1)).mul(isRoof.oneMinus());
  const crown = crownBand.mul(filteredPulse(cu, float(0.0), float(0.55), wu).mul(0.6).add(0.4)).mul(sweep.mul(0.6).add(0.6));
  const ledI = fin.add(floorLine).mul(sweep.mul(0.7).add(0.5)).mul(2.0).add(crown.mul(3.2)).mul(step(bH, 1500)); // the Zenith has its own lights

  const mastTip = isMast.mul(smoothstep(y1.sub(4), y1, v)).mul(step(0.5, fract(U.time.mul(0.75).add(seed))));
  const rel = positionGeometry.xz.mul(vec2(size.z, size.w));
  const r = length(rel);
  const pad = isRoof.mul(isGlass).mul(isTop).mul(step(26, min(size.z, size.w)));
  const ring = pad.mul(smoothstep(0.35, 0.0, abs(r.sub(9.5)))).mul(step(0.5, fract(atan(rel.y, rel.x).mul(2.546))).mul(0.6).add(0.4));

  // LED crowns: panels that chase and twinkle; ledges carry a lit edge on half the towers
  const lp = vec2(u.div(1.1), v.div(1.1));
  const panelId = hash12(floor(lp).add(seed.mul(97)));
  const chase = sin(v.mul(0.09).sub(U.time.mul(1.7)).add(u.mul(0.05)).add(seed.mul(40))).mul(0.5).add(0.5);
  const panelOn = step(0.25, panelId).mul(filteredPulse(lp.x, float(0.06), float(0.94), fwidth(lp.x))).mul(filteredPulse(lp.y, float(0.08), float(0.92), fwidth(lp.y)));
  const accent2 = palette(ACCENT, floor(fract(seed.mul(61.7)).mul(ACCENT.length)));
  // panels under a couple of pixels blend to their average instead of sparkling
  const ledFar = smoothstep(0.25, 0.7, max(fwidth(lp.x), fwidth(lp.y)));
  const ledEmit = mix(mix(accent, accent2, step(0.5, fract(panelId.mul(5.3)))).mul(panelOn), mix(accent, accent2, 0.5).mul(0.55), ledFar).mul(chase.mul(1.6).add(0.5)).mul(isLed).mul(wall).mul(2.4);
  const thin = step(size.y.sub(size.x), 1.6);
  const edge = smoothstep(0.35, 0.0, v.sub(size.x)).mul(isClad).mul(thin).mul(wall).mul(step(0.5, fract(seed.mul(13.9))));
  const louvGlow = vec3(1.0, 0.62, 0.34).mul(slat.oneMinus()).mul(0.07).mul(isLouv).mul(wall);
  // the city lights its own walls from below: sodium and neon bounce near the street, dim sky above
  const glowH = exp(v.negate().div(90)).mul(0.17).add(0.045);
  const ambient = vec3(0.95, 0.66, 0.66).mul(glowH).add(vec3(0.3, 0.36, 0.62).mul(0.04));
  // dark curtain-wall glass picks up the city: neon-tinted glow low down, the clouds' violet above
  const fres = float(1).sub(dot(rd.negate(), vec3(n)).clamp(0, 1)).pow(4).mul(0.85).add(0.06);
  const skyRefl = mix(vec3(0.5, 0.2, 0.42), vec3(0.1, 0.08, 0.16), smoothstep(0, 320, v));
  const glassRefl = skyRefl.mul(fres).mul(procGlassy).mul(isOffice).mul(lit.oneMinus()).mul(0.32);

  const spillUV = lmUV(P.xz.add(vec2(n.x, n.z).mul(2.0)));
  const spill = texture(lightmap.near, spillUV).rgb.mul(exp(v.negate().div(5.5)).mul(1.5).add(exp(v.negate().div(26)).mul(0.18))).mul(isRoof.oneMinus());
  const flash = U.flash.mul(0.45).mul(vec3(0.7, 0.8, 1.0)).mul(albedo.add(0.04)).mul(smoothstep(-200, 400, v));

  m.colorNode = albedo;
  m.emissiveNode = emitWin.mul(0.85)
    .add(photoEmit)
    .add(accent.mul(ledI))
    .add(vec3(1.0, 0.1, 0.06).mul(mastTip.mul(8)))
    .add(vec3(0.6, 1.0, 0.7).mul(ring.mul(3)))
    .add(spill.mul(albedo.add(0.03)))
    .add(ledEmit)
    .add(glassRefl)
    .add(accent.mul(edge.mul(sweep.mul(0.8).add(0.6)).mul(1.6)))
    .add(louvGlow)
    .add(albedo.mul(ambient).mul(isRoof.mul(-0.6).add(1)))
    .add(flash);
  return m;
}
