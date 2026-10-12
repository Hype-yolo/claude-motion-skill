/* BLOCKWORLD — a voxel sandbox game in one file.
   Needs window.THREE (three 0.180 bundle with EffectComposer/RenderPass/UnrealBloomPass/OutputPass).

   World:   224 x 72 x 224 blocks, seeded simplex terrain, biomes (ocean, beach,
            plains, forest, desert, taiga, snowy peaks), spaghetti caves, ores,
            oak/pine trees, cactus, grass + flowers.
   Render:  chunked face-culled meshes, per-vertex ambient occlusion with
            anisotropy-free quad flipping, flood-fill block light from lamps,
            sun/moon shadow map, day/night sky, stars, drifting voxel clouds,
            animated water, bloom.
   Play:    first-person physics (AABB, gravity, jump, sprint, fly), DDA ray
            picking, break/place with particles, 9-slot hotbar, held-block view.

   API:  const g = Blockworld.create(canvas, { w, h, dpr, seed })
         g.update(dt)            advance sim (player physics, particles, water, clouds)
         g.render()
         g.setTime(tod)          0 midnight, .25 sunrise, .5 noon, .75 sunset
         g.cam(x,y,z,yaw,pitch)  place camera directly (cinematics)
         g.pick() / g.breakBlock(x,y,z) / g.placeBlock(x,y,z,id)
         g.bindInput(el)         keyboard/mouse play mode
         g.ui(container)         crosshair + hotbar DOM                      */
"use strict";
(function () {
  const T = window.THREE;

  // ------------------------------------------------------------------ rng + noise
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, z, s) {
    let h = (x * 374761393 + z * 668265263 + s * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function makeNoise(seed) {
    const rnd = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
    const g3 = [1,1,0, -1,1,0, 1,-1,0, -1,-1,0, 1,0,1, -1,0,1, 1,0,-1, -1,0,-1, 0,1,1, 0,-1,1, 0,1,-1, 0,-1,-1];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6, F3 = 1 / 3, G3 = 1 / 6;
    function n2(xin, yin) {
      const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2, x0 = xin - (i - t), y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n0 = 0, n1 = 0, nn2 = 0;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) { const g = pm12[ii + perm[jj]] * 3; t0 *= t0; n0 = t0 * t0 * (g3[g] * x0 + g3[g + 1] * y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) { const g = pm12[ii + i1 + perm[jj + j1]] * 3; t1 *= t1; n1 = t1 * t1 * (g3[g] * x1 + g3[g + 1] * y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) { const g = pm12[ii + 1 + perm[jj + 1]] * 3; t2 *= t2; nn2 = t2 * t2 * (g3[g] * x2 + g3[g + 1] * y2); }
      return 70 * (n0 + n1 + nn2);
    }
    function n3(xin, yin, zin) {
      const s = (xin + yin + zin) * F3;
      const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
      const t = (i + j + k) * G3;
      const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
      const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
      const ii = i & 255, jj = j & 255, kk = k & 255;
      let n = 0, tt, g;
      tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      if (tt > 0) { g = pm12[ii + perm[jj + perm[kk]]] * 3; tt *= tt; n += tt * tt * (g3[g] * x0 + g3[g + 1] * y0 + g3[g + 2] * z0); }
      tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      if (tt > 0) { g = pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; tt *= tt; n += tt * tt * (g3[g] * x1 + g3[g + 1] * y1 + g3[g + 2] * z1); }
      tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      if (tt > 0) { g = pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; tt *= tt; n += tt * tt * (g3[g] * x2 + g3[g + 1] * y2 + g3[g + 2] * z2); }
      tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      if (tt > 0) { g = pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; tt *= tt; n += tt * tt * (g3[g] * x3 + g3[g + 1] * y3 + g3[g + 2] * z3); }
      return 32 * n;
    }
    return { n2, n3 };
  }

  // ------------------------------------------------------------------ blocks
  const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, WATER = 5, LOG = 6, LEAVES = 7, SNOW = 8,
    PLANK = 9, GLASS = 10, BRICK = 11, PINELOG = 12, PINELEAVES = 13, CACTUS = 14, GRAVEL = 15,
    COAL = 16, GOLD = 17, BEDROCK = 18, LAMP = 19, COBBLE = 20, TALLGRASS = 21, ROSE = 22, DANDELION = 23,
    SNOWGRASS = 24;
  const NBLOCK = 25;
  const NAMES = ["air", "grass", "dirt", "stone", "sand", "water", "oak log", "leaves", "snow", "planks", "glass",
    "bricks", "pine log", "pine needles", "cactus", "gravel", "coal ore", "gold ore", "bedrock", "lamp", "cobblestone",
    "tall grass", "rose", "dandelion", "snowy grass"];
  // kind: 0 opaque, 1 cutout (leaves/glass), 2 water, 3 cross plant, -1 air
  const KIND = new Int8Array(NBLOCK).fill(0);
  KIND[AIR] = -1; KIND[WATER] = 2; KIND[LEAVES] = 1; KIND[PINELEAVES] = 1; KIND[GLASS] = 1;
  KIND[TALLGRASS] = 3; KIND[ROSE] = 3; KIND[DANDELION] = 3;
  const OPAQUE = new Uint8Array(NBLOCK), SOLID = new Uint8Array(NBLOCK), AOCC = new Uint8Array(NBLOCK);
  for (let b = 0; b < NBLOCK; b++) {
    OPAQUE[b] = KIND[b] === 0 ? 1 : 0;
    SOLID[b] = KIND[b] === 0 || KIND[b] === 1 ? 1 : 0;
    AOCC[b] = KIND[b] === 0 || b === LEAVES || b === PINELEAVES ? 1 : 0;
  }

  // tile ids in the atlas
  const TL = { grassTop: 0, grassSide: 1, dirt: 2, stone: 3, sand: 4, water: 5, logSide: 6, logTop: 7, leaves: 8,
    snow: 9, snowSide: 10, plank: 11, glass: 12, brick: 13, pineLeaves: 14, cactusSide: 15, cactusTop: 16, gravel: 17,
    coal: 18, gold: 19, bedrock: 20, lamp: 21, pineLog: 22, tallgrass: 23, rose: 24, dandelion: 25, cobble: 26 };
  // [top, bottom, side]
  const FACES = [];
  FACES[GRASS] = [TL.grassTop, TL.dirt, TL.grassSide];
  FACES[DIRT] = [TL.dirt, TL.dirt, TL.dirt];
  FACES[STONE] = [TL.stone, TL.stone, TL.stone];
  FACES[SAND] = [TL.sand, TL.sand, TL.sand];
  FACES[WATER] = [TL.water, TL.water, TL.water];
  FACES[LOG] = [TL.logTop, TL.logTop, TL.logSide];
  FACES[LEAVES] = [TL.leaves, TL.leaves, TL.leaves];
  FACES[SNOW] = [TL.snow, TL.snow, TL.snow];
  FACES[PLANK] = [TL.plank, TL.plank, TL.plank];
  FACES[GLASS] = [TL.glass, TL.glass, TL.glass];
  FACES[BRICK] = [TL.brick, TL.brick, TL.brick];
  FACES[PINELOG] = [TL.logTop, TL.logTop, TL.pineLog];
  FACES[PINELEAVES] = [TL.pineLeaves, TL.pineLeaves, TL.pineLeaves];
  FACES[CACTUS] = [TL.cactusTop, TL.cactusTop, TL.cactusSide];
  FACES[GRAVEL] = [TL.gravel, TL.gravel, TL.gravel];
  FACES[COAL] = [TL.coal, TL.coal, TL.coal];
  FACES[GOLD] = [TL.gold, TL.gold, TL.gold];
  FACES[BEDROCK] = [TL.bedrock, TL.bedrock, TL.bedrock];
  FACES[LAMP] = [TL.lamp, TL.lamp, TL.lamp];
  FACES[COBBLE] = [TL.cobble, TL.cobble, TL.cobble];
  FACES[TALLGRASS] = [TL.tallgrass, TL.tallgrass, TL.tallgrass];
  FACES[ROSE] = [TL.rose, TL.rose, TL.rose];
  FACES[DANDELION] = [TL.dandelion, TL.dandelion, TL.dandelion];
  FACES[SNOWGRASS] = [TL.snow, TL.dirt, TL.snowSide];

  const HOTBAR = [GRASS, COBBLE, PLANK, BRICK, GLASS, LOG, LAMP, SAND, LEAVES];

  // ------------------------------------------------------------------ textures (procedural pixel art)
  const TS = 16, CELL = 96, INNER = 64, GUT = 16, ACOLS = 8, AROWS = 4;
  function makeTiles(seed) {
    const rnd = mulberry32(seed ^ 0x51f15e);
    const tiles = [];
    const mk = (fn) => {
      const c = document.createElement("canvas"); c.width = c.height = TS;
      const x = c.getContext("2d"); const img = x.createImageData(TS, TS);
      for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
        const col = fn(px, py); const o = (py * TS + px) * 4;
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = col.length > 3 ? col[3] : 255;
      }
      x.putImageData(img, 0, 0); c.px = img.data; return c;
    };
    const jit = (c, a) => { const k = 1 + (rnd() - 0.5) * a; return [Math.min(255, c[0] * k) | 0, Math.min(255, c[1] * k) | 0, Math.min(255, c[2] * k) | 0]; };
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const grassC = [[96, 160, 58], [84, 146, 50], [108, 172, 66], [74, 134, 44]];
    const dirtC = [[134, 96, 67], [121, 85, 58], [148, 108, 76], [110, 78, 52]];
    const stoneC = [[125, 125, 125], [112, 112, 112], [138, 138, 138], [100, 100, 102]];
    const sandC = [[219, 207, 163], [208, 195, 150], [228, 216, 174], [200, 188, 142]];
    tiles[TL.grassTop] = mk(() => jit(pick(grassC), 0.1));
    tiles[TL.dirt] = mk(() => jit(pick(dirtC), 0.12));
    tiles[TL.grassSide] = mk((x, y) => {
      const edge = 3 + ((hash2(x, 7, seed) * 3) | 0);
      return y < edge ? jit(pick(grassC), 0.1) : jit(pick(dirtC), 0.12);
    });
    tiles[TL.stone] = mk((x, y) => { const v = hash2(x >> 1, y, 3) > 0.82 ? 0.78 : 1; const c = jit(pick(stoneC), 0.08); return [c[0] * v, c[1] * v, c[2] * v]; });
    tiles[TL.cobble] = mk((x, y) => {
      const cx = (x + (y >> 2) * 3) % 5, cy = y % 4;
      const mortar = cx === 0 || cy === 0;
      const c = jit(pick(stoneC), 0.12); const k = mortar ? 0.55 : 1;
      return [c[0] * k, c[1] * k, c[2] * k];
    });
    tiles[TL.sand] = mk(() => jit(pick(sandC), 0.06));
    tiles[TL.gravel] = mk(() => { const g = pick([[130, 124, 120], [100, 96, 94], [150, 144, 138], [118, 108, 102]]); return jit(g, 0.1); });
    tiles[TL.water] = mk(() => jit([48, 92, 196], 0.12).concat([200]));
    tiles[TL.logSide] = mk((x) => { const s = x % 4 === 0 ? 0.72 : 1; const c = jit([104, 80, 48], 0.1); return [c[0] * s, c[1] * s, c[2] * s]; });
    tiles[TL.pineLog] = mk((x) => { const s = x % 3 === 0 ? 0.7 : 1; const c = jit([66, 48, 32], 0.1); return [c[0] * s, c[1] * s, c[2] * s]; });
    tiles[TL.logTop] = mk((x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5); const ring = Math.floor(d) % 3 === 0;
      if (d > 7) return jit([98, 74, 44], 0.1);
      return ring ? jit([150, 118, 72], 0.06) : jit([178, 144, 90], 0.06);
    });
    tiles[TL.leaves] = mk(() => rnd() < 0.2 ? [0, 0, 0, 0] : jit(pick([[58, 128, 40], [48, 112, 34], [70, 140, 48], [40, 100, 30]]), 0.12));
    tiles[TL.pineLeaves] = mk(() => rnd() < 0.16 ? [0, 0, 0, 0] : jit(pick([[40, 86, 52], [32, 74, 44], [48, 98, 58]]), 0.12));
    tiles[TL.snow] = mk(() => jit([240, 246, 252], 0.04));
    tiles[TL.snowSide] = mk((x, y) => { const edge = 3 + ((hash2(x, 3, seed) * 3) | 0); return y < edge ? jit([240, 246, 252], 0.04) : jit(pick(dirtC), 0.12); });
    tiles[TL.plank] = mk((x, y) => {
      const board = y % 4 === 3; const seam = (y >> 2) % 2 === 0 ? x === 5 : x === 12;
      const c = jit([176, 138, 86], 0.08); const k = board || seam ? 0.66 : 1;
      return [c[0] * k, c[1] * k, c[2] * k];
    });
    tiles[TL.glass] = mk((x, y) => {
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      const glint = (x - y === 3 || x - y === 4) && x > 3 && x < 11;
      if (edge) return [210, 236, 244, 255];
      if (glint) return [255, 255, 255, 220];
      return [200, 230, 240, 0];
    });
    tiles[TL.brick] = mk((x, y) => {
      const row = y >> 2, off = row % 2 ? 4 : 0;
      const mortar = y % 4 === 3 || (x + off) % 8 === 7;
      return mortar ? jit([196, 188, 176], 0.05) : jit(pick([[150, 68, 52], [138, 60, 46], [162, 76, 58]]), 0.08);
    });
    tiles[TL.cactusSide] = mk((x, y) => { const rib = x % 4 === 1; const spine = rib && y % 5 === 2; if (spine) return [230, 226, 190]; const c = jit([60, 128, 52], 0.08); const k = rib ? 1.15 : 0.9; return [c[0] * k, c[1] * k, c[2] * k]; });
    tiles[TL.cactusTop] = mk((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); return d < 3 ? jit([120, 170, 90], 0.06) : jit([66, 136, 58], 0.08); });
    const ore = (c1) => (x, y) => { const s = hash2(x >> 1, y >> 1, 77 + c1[0]) > 0.72 && hash2(x, y, 5) > 0.3; return s ? jit(c1, 0.1) : jit(pick(stoneC), 0.08); };
    tiles[TL.coal] = mk(ore([34, 34, 36]));
    tiles[TL.gold] = mk(ore([240, 200, 60]));
    tiles[TL.bedrock] = mk(() => jit(pick([[60, 60, 62], [30, 30, 32], [90, 90, 92]]), 0.15));
    tiles[TL.lamp] = mk((x, y) => {
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      const cross = x === 7 || x === 8 || y === 7 || y === 8;
      if (edge) return [120, 84, 40];
      if (cross) return [200, 150, 80];
      return jit([255, 214, 130], 0.08);
    });
    const plant = (fn) => mk((x, y) => fn(x, y) || [0, 0, 0, 0]);
    tiles[TL.tallgrass] = plant((x, y) => {
      const blades = [2, 5, 8, 11, 13];
      for (const b of blades) { const top = 3 + ((hash2(b, 1, seed) * 7) | 0); const bx = b + Math.round((15 - y) * (b < 8 ? -0.12 : 0.12)); if (x === bx && y >= top) return jit([88, 150, 54], 0.14); }
      return null;
    });
    const flower = (pet, cen) => plant((x, y) => {
      if (x === 7 && y >= 7) return jit([60, 120, 40], 0.1);
      if ((x === 6 && y === 10) || (x === 8 && y === 11)) return [70, 132, 46];
      const d = Math.hypot(x - 7, y - 4.5);
      if (d < 1) return cen; if (d < 2.8) return jit(pet, 0.08);
      return null;
    });
    tiles[TL.rose] = flower([214, 44, 50], [250, 220, 90]);
    tiles[TL.dandelion] = flower([250, 214, 40], [230, 160, 20]);
    return tiles;
  }
  // Atlas as raw pixels (not a canvas): canvas storage is premultiplied, which zeroes the
  // colour of transparent texels and makes mipmaps average black fringes into leaves and
  // grass. Here transparent texels carry the tile's average colour, and each tile is
  // padded by a gutter of clamped edge texels so mip levels never bleed a neighbour in.
  function makeAtlas(tiles) {
    const AW = ACOLS * CELL, AH = AROWS * CELL, data = new Uint8Array(AW * AH * 4);
    const SC = INNER / TS;
    tiles.forEach((t, i) => {
      if (!t) return;
      const px = t.px; let r = 0, g = 0, b = 0, n = 0;
      for (let k = 0; k < px.length; k += 4) if (px[k + 3] > 127) { r += px[k]; g += px[k + 1]; b += px[k + 2]; n++; }
      const avg = n ? [r / n, g / n, b / n] : [0, 0, 0];
      const ox = (i % ACOLS) * CELL, oy = Math.floor(i / ACOLS) * CELL;
      for (let ay = 0; ay < CELL; ay++) for (let ax = 0; ax < CELL; ax++) {
        const sx = Math.min(TS - 1, Math.max(0, Math.floor((ax - GUT) / SC))), sy = Math.min(TS - 1, Math.max(0, Math.floor((ay - GUT) / SC)));
        const s4 = (sy * TS + sx) * 4, a = px[s4 + 3];
        const o = ((AH - 1 - (oy + ay)) * AW + ox + ax) * 4; // DataTexture rows run bottom-up
        if (a > 127) { data[o] = px[s4]; data[o + 1] = px[s4 + 1]; data[o + 2] = px[s4 + 2]; }
        else { data[o] = avg[0]; data[o + 1] = avg[1]; data[o + 2] = avg[2]; }
        data[o + 3] = a;
      }
    });
    return { data, AW, AH };
  }
  function tileUV(tile, tu, tv) {
    const col = tile % ACOLS, row = Math.floor(tile / ACOLS);
    const W = ACOLS * CELL, H = AROWS * CELL;
    return [(col * CELL + GUT + tu * INNER) / W, 1 - (row * CELL + GUT + (1 - tv) * INNER) / H];
  }
  function tileAvg(canvas) {
    const d = canvas.getContext("2d").getImageData(0, 0, TS, TS).data; let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    return n ? [r / n / 255, g / n / 255, b / n / 255] : [1, 1, 1];
  }

  // ------------------------------------------------------------------ the game
  function create(canvas, opts = {}) {
    const W = opts.w || 1280, H = opts.h || 720, SEED = opts.seed || 20260929;
    const CS = 16, NCX = opts.chunks || 4, NCZ = opts.chunks || 4, WX = CS * NCX, WZ = CS * NCZ, WY = 72, SEA = 26;
    const vox = new Uint8Array(WX * WY * WZ);
    const light = new Uint8Array(WX * WY * WZ);
    const idx = (x, y, z) => (y * WZ + z) * WX + x;
    const inW = (x, y, z) => x >= 0 && x < WX && z >= 0 && z < WZ && y >= 0 && y < WY;
    const get = (x, y, z) => (inW(x, y, z) ? vox[idx(x, y, z)] : y < 0 ? BEDROCK : AIR);
    const lightAt = (x, y, z) => (inW(x, y, z) ? light[idx(x, y, z)] : 0);
    const lamps = new Set();

    // ---------- terrain generation
    const N = makeNoise(SEED), N2 = makeNoise(SEED + 101), N3 = makeNoise(SEED + 202);
    const fbm = (n, x, z, o) => { let a = 1, f = 1, s = 0, m = 0; for (let i = 0; i < o; i++) { s += a * n.n2(x * f, z * f); m += a; a *= 0.5; f *= 2.03; } return s / m; };
    const ridged = (n, x, z, o) => { let a = 1, f = 1, s = 0, m = 0; for (let i = 0; i < o; i++) { const v = 1 - Math.abs(n.n2(x * f, z * f)); s += a * v * v; m += a; a *= 0.5; f *= 2.1; } return s / m; };
    const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const hmap = new Int16Array(WX * WZ), temp = new Float32Array(WX * WZ), moist = new Float32Array(WX * WZ);
    for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++) {
      const c = fbm(N, x * 0.0065 + 3.1, z * 0.0065 - 1.7, 4);
      const m = ridged(N2, x * 0.011, z * 0.011, 4);
      const d = fbm(N3, x * 0.035, z * 0.035, 3);
      let h = SEA + 1 + c * 16 + d * 2.5;
      const mount = sstep(0.12, 0.55, c);
      h += mount * (m * 36 - 4);
      hmap[z * WX + x] = Math.max(4, Math.min(WY - 12, Math.floor(h)));
      temp[z * WX + x] = fbm(N3, x * 0.006 + 40, z * 0.006 - 20, 2);
      moist[z * WX + x] = fbm(N2, x * 0.008 - 60, z * 0.008 + 90, 2);
    }
    const H_ = (x, z) => hmap[Math.min(WZ - 1, Math.max(0, z)) * WX + Math.min(WX - 1, Math.max(0, x))];
    const biome = new Uint8Array(WX * WZ); // 0 plains 1 forest 2 desert 3 taiga 4 beach 5 ocean 6 peak
    for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++) {
      const i = z * WX + x, h = hmap[i], t = temp[i], mo = moist[i];
      let b;
      if (h < SEA) b = 5;
      else if (h <= SEA + 1) b = t > 0.3 ? 2 : 4;
      else if (h > 52) b = 6;
      else if (t > 0.28 && mo < 0.05) b = 2;
      else if (t < -0.22 || h > 44) b = 3;
      else if (mo > 0.02) b = 1;
      else b = 0;
      biome[i] = b;
    }
    for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++) {
      const i = z * WX + x, h = hmap[i], b = biome[i];
      const slope = Math.max(Math.abs(H_(x + 1, z) - h), Math.abs(H_(x - 1, z) - h), Math.abs(H_(x, z + 1) - h), Math.abs(H_(x, z - 1) - h));
      for (let y = 0; y < WY; y++) {
        let v = AIR;
        if (y === 0) v = BEDROCK;
        else if (y < h - 3) v = STONE;
        else if (y < h) v = b === 2 || b === 4 || b === 5 ? SAND : slope > 2 && b === 6 ? STONE : DIRT;
        else if (y === h) {
          if (b === 5) v = h < SEA - 4 ? GRAVEL : SAND;
          else if (b === 2 || b === 4) v = SAND;
          else if (b === 6) v = slope > 2 ? STONE : SNOW;
          else if (slope > 3 && h > 38) v = STONE;
          else if (b === 3 && h > 40) v = SNOWGRASS;
          else v = GRASS;
        } else if (y <= SEA) v = WATER;
        if (y === 1 && hash2(x, z, 9) < 0.5) v = BEDROCK;
        vox[idx(x, y, z)] = v;
      }
    }
    // caves + ores
    for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++) {
      const h = hmap[z * WX + x], top = biome[z * WX + x] === 5 ? h - 6 : h - 3;
      for (let y = 3; y < top; y++) {
        const a = N.n3(x * 0.045, y * 0.075, z * 0.045), b = N2.n3(x * 0.045 + 31, y * 0.075, z * 0.045 - 17);
        if (a * a + b * b < 0.011) { vox[idx(x, y, z)] = AIR; continue; }
        if (vox[idx(x, y, z)] === STONE) {
          const r = hash2(x * 31 + y, z * 17 - y, 4);
          if (r < 0.012 && N3.n3(x * 0.2, y * 0.2, z * 0.2) > 0.3) vox[idx(x, y, z)] = COAL;
          else if (y < 22 && r > 0.996) vox[idx(x, y, z)] = GOLD;
        }
      }
    }
    // trees + plants
    const setIf = (x, y, z, v, onlyAir = true) => { if (!inW(x, y, z)) return; const i = idx(x, y, z); if (!onlyAir || vox[i] === AIR || KIND[vox[i]] === 3) vox[i] = v; };
    function oak(x, y, z, r) {
      const th = 4 + Math.floor(r * 3);
      for (let dy = -2; dy <= 1; dy++) {
        const rad = dy >= 0 ? 1 : 2;
        for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
          if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && hash2(x + dx, z + dz, y + dy) < 0.6) continue;
          if (dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
          setIf(x + dx, y + th + dy, z + dz, LEAVES);
        }
      }
      for (let i = 0; i < th; i++) setIf(x, y + i, z, LOG, false);
    }
    function pine(x, y, z, r) {
      const th = 6 + Math.floor(r * 4);
      for (let i = 0; i < th; i++) setIf(x, y + i, z, PINELOG, false);
      let rad = 0;
      for (let dy = th + 1; dy >= 3; dy--) {
        const rr = rad > 2 ? 2 : rad;
        for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) {
          if (Math.abs(dx) + Math.abs(dz) > rr + (rr > 1 ? 0 : 1)) continue;
          if (dx === 0 && dz === 0 && dy < th) continue;
          setIf(x + dx, y + dy, z + dz, PINELEAVES);
        }
        rad = (th + 1 - dy) % 2 === 1 ? rad + 1 : Math.max(1, rad - 1);
      }
    }
    for (let z = 3; z < WZ - 3; z++) for (let x = 3; x < WX - 3; x++) {
      const i = z * WX + x, h = hmap[i], b = biome[i], top = vox[idx(x, h, z)];
      if (h >= WY - 14) continue;
      const r = hash2(x, z, 1), r2 = hash2(x, z, 2);
      if (top === GRASS || top === SNOWGRASS) {
        const dens = b === 1 ? 0.045 : b === 3 ? 0.035 : 0.004;
        if (r < dens && vox[idx(x, h + 1, z)] === AIR) {
          let ok = true;
          for (let dz = -2; dz <= 2 && ok; dz++) for (let dx = -2; dx <= 2; dx++) { const t = vox[idx(x + dx, h + 1, z + dz)]; if (t === LOG || t === PINELOG) { ok = false; break; } }
          if (ok) { if (b === 3) pine(x, h + 1, z, r2); else oak(x, h + 1, z, r2); continue; }
        }
        if (top === GRASS && vox[idx(x, h + 1, z)] === AIR) {
          if (r2 < (b === 0 ? 0.16 : 0.1)) vox[idx(x, h + 1, z)] = TALLGRASS;
          else if (r2 > 0.985) vox[idx(x, h + 1, z)] = hash2(x, z, 3) < 0.5 ? ROSE : DANDELION;
        }
      } else if (top === SAND && b === 2 && r < 0.006 && h > SEA) {
        const ch = 2 + Math.floor(r2 * 3);
        for (let k = 1; k <= ch; k++) setIf(x, h + k, z, CACTUS);
      }
    }

    // ---------- block light (flood fill from lamps)
    function relight() {
      light.fill(0);
      const q = [];
      for (const k of lamps) { light[k] = 15; q.push(k); }
      while (q.length) {
        const k = q.pop(), l = light[k]; if (l <= 1) continue;
        const x = k % WX, z = Math.floor(k / WX) % WZ, y = Math.floor(k / (WX * WZ));
        const nb = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
        for (const d of nb) {
          const nx = x + d[0], ny = y + d[1], nz = z + d[2];
          if (!inW(nx, ny, nz)) continue;
          const j = idx(nx, ny, nz);
          if (OPAQUE[vox[j]] && vox[j] !== LAMP) continue;
          if (light[j] < l - 1) { light[j] = l - 1; q.push(j); }
        }
      }
    }

    // ---------- three setup
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
    renderer.setPixelRatio(opts.dpr || Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W, H, false);
    if (opts.cssSize !== false) { canvas.style.width = W + "px"; canvas.style.height = H + "px"; }
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(opts.fov || 72, W / H, 0.05, 520);
    scene.add(camera);
    const fog = new T.Fog(0xa9d3f5, 70, 250); scene.fog = fog;

    const tiles = makeTiles(SEED);
    const atl = makeAtlas(tiles);
    const atlas = new T.DataTexture(atl.data, atl.AW, atl.AH, T.RGBAFormat);
    atlas.needsUpdate = true;
    atlas.colorSpace = T.SRGBColorSpace; atlas.magFilter = T.NearestFilter; atlas.minFilter = T.NearestMipmapLinearFilter;
    atlas.anisotropy = renderer.capabilities.getMaxAnisotropy(); atlas.generateMipmaps = true;
    const tileColor = tiles.map((t) => (t ? tileAvg(t) : [1, 1, 1]));

    const lampU = { value: 1 };
    const patch = (m) => {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uLamp = lampU;
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nattribute vec2 lx;\nvarying vec2 vLx;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLx = lx;");
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying vec2 vLx;\nuniform float uLamp;")
          .replace("#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0,0.66,0.34) * pow(vLx.x,1.5) * uLamp;\n" +
            "totalEmissiveRadiance += diffuseColor.rgb * vLx.y * 2.4;");
      };
      return m;
    };
    const matOpaque = patch(new T.MeshLambertMaterial({ map: atlas, vertexColors: true }));
    const matCutout = patch(new T.MeshLambertMaterial({ map: atlas, vertexColors: true, alphaTest: 0.45 }));
    const waterU = { uTime: { value: 0 } };
    const matWater = new T.MeshPhongMaterial({ color: 0x2f6fd0, transparent: true, opacity: 0.74, shininess: 90, specular: 0x7fa2dd, depthWrite: false, vertexColors: true });
    matWater.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = waterU.uTime;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec3 vWp;")
        .replace("#include <begin_vertex>",
          "#include <begin_vertex>\nvec4 wpw = modelMatrix * vec4(transformed,1.0);\n" +
          "if (normal.y > 0.5) transformed.y += 0.05*sin(wpw.x*0.9+uTime*1.6)*cos(wpw.z*0.8+uTime*1.3) - 0.05;\nvWp = (modelMatrix*vec4(transformed,1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec3 vWp;")
        .replace("#include <normal_fragment_maps>",
          "#include <normal_fragment_maps>\n" +
          "{ vec2 p = vWp.xz; float a = uTime;\n" +
          "  vec3 pn = vec3(0.10*sin(p.x*1.7+a*2.1)+0.06*sin(p.x*3.1-p.y*2.3+a*2.9), 1.0, 0.10*cos(p.y*1.9+a*1.7)+0.06*cos(p.x*2.7+p.y*3.3-a*2.3));\n" +
          "  if (vNormal.y > 0.5 || -vNormal.y > 0.5) normal = normalize((viewMatrix*vec4(normalize(pn),0.0)).xyz); }")
        .replace("#include <dithering_fragment>",
          "#include <dithering_fragment>\n" +
          "{ float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);\n" +
          "  gl_FragColor.a = clamp(opacity + fres*0.35, 0.0, 0.95); }");
    };

    // ---------- chunk meshing
    const chunks = [];
    const AOK = [0.42, 0.62, 0.8, 1.0];
    // corner offsets per face: d axis, sign, u/v axes
    function buildChunk(cx, cz) {
      const P = [[], [], []], Nn = [[], [], []], U = [[], [], []], C = [[], [], []], L = [[], [], []], I = [[], [], []];
      const x0 = cx * CS, z0 = cz * CS;
      const quad = (m, verts, nrm, uvs, cols, lxs, flip) => {
        const b = P[m].length / 3;
        for (let k = 0; k < 4; k++) {
          P[m].push(verts[k][0], verts[k][1], verts[k][2]); Nn[m].push(nrm[0], nrm[1], nrm[2]);
          U[m].push(uvs[k][0], uvs[k][1]); C[m].push(cols[k], cols[k], cols[k]); L[m].push(lxs[k][0], lxs[k][1]);
        }
        if (flip) I[m].push(b + 1, b + 2, b + 3, b + 1, b + 3, b);
        else I[m].push(b, b + 1, b + 2, b, b + 2, b + 3);
      };
      const lnorm = (l) => { const v = l / 15; return v * v; };
      for (let y = 0; y < WY; y++) for (let z = z0; z < z0 + CS; z++) for (let x = x0; x < x0 + CS; x++) {
        const b = vox[idx(x, y, z)]; if (b === AIR) continue;
        const k = KIND[b], ft = FACES[b];
        if (k === 3) {
          const tile = ft[0], s = 0.42, cxp = x + 0.5, czp = z + 0.5, ll = lnorm(lightAt(x, y, z));
          const j1 = (hash2(x, z, 11) - 0.5) * 0.3, j2 = (hash2(x, z, 12) - 0.5) * 0.3;
          const pts = [[[-s, -s], [s, s]], [[-s, s], [s, -s]]];
          for (const pp of pts) {
            const a = [cxp + pp[0][0] + j1, y, czp + pp[0][1] + j2], c = [cxp + pp[1][0] + j1, y, czp + pp[1][1] + j2];
            // both windings with an up normal: a DoubleSide back face would flip the
            // normal downward and light the blade with only the dark ground bounce
            const vq = [a, c, [c[0], y + 1, c[2]], [a[0], y + 1, a[2]]], uq = [tileUV(tile, 0, 0), tileUV(tile, 1, 0), tileUV(tile, 1, 1), tileUV(tile, 0, 1)];
            quad(1, vq, [0, 1, 0], uq, [0.8, 0.8, 1, 1], [[ll, 0], [ll, 0], [ll, 0], [ll, 0]], false);
            quad(1, [vq[1], vq[0], vq[3], vq[2]], [0, 1, 0], [uq[1], uq[0], uq[3], uq[2]], [0.8, 0.8, 1, 1], [[ll, 0], [ll, 0], [ll, 0], [ll, 0]], false);
          }
          continue;
        }
        const m = k === 2 ? 2 : k === 1 ? 1 : 0;
        for (let d = 0; d < 3; d++) for (let s = -1; s <= 1; s += 2) {
          const nx = x + (d === 0 ? s : 0), ny = y + (d === 1 ? s : 0), nz = z + (d === 2 ? s : 0);
          const n = get(nx, ny, nz);
          if (k === 0 && OPAQUE[n]) continue;
          if (k === 1 && (OPAQUE[n] || (b === GLASS && n === GLASS))) continue;
          if (k === 2 && (n === WATER || OPAQUE[n] || (d !== 1 && KIND[n] === 1))) continue;
          if (k === 2 && d === 1 && s < 0) continue;
          const tile = d === 1 ? (s > 0 ? ft[0] : ft[1]) : ft[2];
          const u = (d + 1) % 3, v = (d + 2) % 3;
          const verts = [], uvs = [], cols = [], lxs = [], aos = [];
          const corners = s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
          const emis = b === LAMP ? 1 : 0;
          for (const [cu, cv] of corners) {
            const p = [x, y, z];
            p[d] += s > 0 ? 1 : 0; p[u] += cu; p[v] += cv;
            if (k === 2 && d === 1 && get(x, y + 1, z) !== WATER) p[1] -= 0.12;
            verts.push(p);
            let tu, tv;
            if (d === 0) { tu = cv; tv = cu; } else if (d === 2) { tu = cu; tv = cv; } else { tu = cv; tv = cu; }
            if ((d === 0 && s < 0) || (d === 2 && s > 0)) tu = 1 - tu;
            uvs.push(tileUV(tile, tu, tv));
            // AO + smooth block light from the 4 cells in front of this corner
            const f = [nx, ny, nz];
            const s1 = f.slice(), s2 = f.slice(), c3 = f.slice();
            s1[u] += cu ? 1 : -1; s2[v] += cv ? 1 : -1; c3[u] += cu ? 1 : -1; c3[v] += cv ? 1 : -1;
            let ao = 3;
            if (k !== 2) {
              const o1 = AOCC[get(s1[0], s1[1], s1[2])], o2 = AOCC[get(s2[0], s2[1], s2[2])], o3 = AOCC[get(c3[0], c3[1], c3[2])];
              ao = o1 && o2 ? 0 : 3 - (o1 + o2 + o3);
            }
            aos.push(ao);
            let ls = lightAt(nx, ny, nz), ln = 1;
            for (const q of [s1, s2, c3]) { const qb = get(q[0], q[1], q[2]); if (!OPAQUE[qb]) { ls += lightAt(q[0], q[1], q[2]); ln++; } }
            lxs.push([lnorm(ls / ln), emis]);
            const shade = d === 1 ? (s > 0 ? 1 : 0.55) : d === 0 ? 0.82 : 0.9;
            cols.push(AOK[ao] * (k === 2 ? 1 : shade));
          }
          const flip = aos[0] + aos[2] < aos[1] + aos[3];
          quad(m, verts, d === 0 ? [s, 0, 0] : d === 1 ? [0, s, 0] : [0, 0, s], uvs, cols, lxs, flip);
        }
      }
      const meshes = [];
      for (let m = 0; m < 3; m++) {
        if (!P[m].length) { meshes.push(null); continue; }
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(P[m], 3));
        g.setAttribute("normal", new T.Float32BufferAttribute(Nn[m], 3));
        g.setAttribute("uv", new T.Float32BufferAttribute(U[m], 2));
        g.setAttribute("color", new T.Float32BufferAttribute(C[m], 3));
        g.setAttribute("lx", new T.Float32BufferAttribute(L[m], 2));
        g.setIndex(P[m].length / 3 > 65535 ? new T.Uint32BufferAttribute(I[m], 1) : new T.Uint16BufferAttribute(I[m], 1));
        g.computeBoundingSphere();
        const mesh = new T.Mesh(g, m === 0 ? matOpaque : m === 1 ? matCutout : matWater);
        if (m < 2) { mesh.castShadow = true; mesh.receiveShadow = true; } else { mesh.receiveShadow = true; mesh.renderOrder = 2; }
        scene.add(mesh); meshes.push(mesh);
      }
      return meshes;
    }
    function rebuild(cx, cz) {
      if (cx < 0 || cz < 0 || cx >= NCX || cz >= NCZ) return;
      const k = cz * NCX + cx;
      if (chunks[k]) for (const m of chunks[k]) if (m) { scene.remove(m); m.geometry.dispose(); }
      chunks[k] = buildChunk(cx, cz);
    }
    relight();
    let faceCount = 0;
    for (let cz = 0; cz < NCZ; cz++) for (let cx = 0; cx < NCX; cx++) rebuild(cx, cz);
    for (const c of chunks) for (const m of c) if (m) faceCount += m.geometry.index.count / 6;

    // ---------- sky, sun, moon, stars, clouds
    const skyU = { sunDir: { value: new T.Vector3(0, 1, 0) }, day: { value: 1 }, dusk: { value: 0 } };
    const sky = new T.Mesh(new T.SphereGeometry(480, 32, 16), new T.ShaderMaterial({
      uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
      vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: `varying vec3 vD; uniform vec3 sunDir; uniform float day; uniform float dusk;
        void main(){
          float h = clamp(vD.y, -0.2, 1.0);
          vec3 zen = mix(vec3(0.004,0.007,0.02), vec3(0.09,0.26,0.62), day);
          vec3 hor = mix(vec3(0.015,0.03,0.07), vec3(0.52,0.72,0.92), day);
          hor = mix(hor, vec3(0.95,0.45,0.2), dusk * smoothstep(-0.2, 0.9, dot(normalize(vD.xz+1e-4), normalize(sunDir.xz+1e-4))) * 0.9);
          vec3 c = mix(hor, zen, pow(max(h,0.0), 0.55));
          float sd = max(dot(vD, sunDir), 0.0);
          c += vec3(1.0,0.72,0.42) * pow(sd, 18.0) * (0.35*day + 0.9*dusk);
          c += vec3(1.0,0.95,0.85) * smoothstep(0.9985, 0.9993, sd) * 6.0 * max(day, dusk);
          float md = max(dot(vD, -sunDir), 0.0);
          c += vec3(0.75,0.82,1.0) * smoothstep(0.9989, 0.9994, md) * 2.2 * (1.0-day);
          c += vec3(0.25,0.3,0.45) * pow(md, 40.0) * (1.0-day) * 0.4;
          if (vD.y < 0.0) c = mix(c, hor*0.8, smoothstep(0.0, -0.2, vD.y));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    sky.renderOrder = -10; scene.add(sky);
    const starG = new T.BufferGeometry(); { const srnd = mulberry32(SEED + 5); const a = [];
      for (let i = 0; i < 2600; i++) { const u = srnd() * 2 - 1, th = srnd() * Math.PI * 2, r = Math.sqrt(1 - u * u); if (u < 0.02) continue; a.push(r * Math.cos(th) * 440, u * 440, r * Math.sin(th) * 440); }
      starG.setAttribute("position", new T.Float32BufferAttribute(a, 3)); }
    const starM = new T.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    const stars = new T.Points(starG, starM); stars.renderOrder = -9; scene.add(stars);

    const cloudG = (() => { const cn = makeNoise(SEED + 9); const CSZ = 12, NC = 56, P = [], Nn = [], idxs = []; const on = (i, j) => { const ii = ((i % NC) + NC) % NC, jj = ((j % NC) + NC) % NC; return cn.n2(ii * 0.19, jj * 0.19) + 0.4 * cn.n2(ii * 0.5, jj * 0.5) > 0.38; };
      const face = (p, n) => { const b = P.length / 3; for (const q of p) P.push(...q); for (let k = 0; k < 4; k++) Nn.push(...n); idxs.push(b, b + 1, b + 2, b, b + 2, b + 3); };
      const TH = 4;
      for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) { if (!on(i, j)) continue; const x = i * CSZ, z = j * CSZ, x1 = x + CSZ, z1 = z + CSZ;
        face([[x, TH, z], [x, TH, z1], [x1, TH, z1], [x1, TH, z]], [0, 1, 0]);
        face([[x, 0, z], [x1, 0, z], [x1, 0, z1], [x, 0, z1]], [0, -1, 0]);
        if (!on(i + 1, j)) face([[x1, 0, z], [x1, TH, z], [x1, TH, z1], [x1, 0, z1]], [1, 0, 0]);
        if (!on(i - 1, j)) face([[x, 0, z], [x, 0, z1], [x, TH, z1], [x, TH, z]], [-1, 0, 0]);
        if (!on(i, j + 1)) face([[x, 0, z1], [x1, 0, z1], [x1, TH, z1], [x, TH, z1]], [0, 0, 1]);
        if (!on(i, j - 1)) face([[x, 0, z], [x, TH, z], [x1, TH, z], [x1, 0, z]], [0, 0, -1]); }
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new T.Float32BufferAttribute(Nn, 3)); g.setIndex(idxs); g.userData.span = NC * CSZ; return g; })();
    const cloudM = new T.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, emissive: 0x303844, depthWrite: false });
    const clouds = new T.Group(); for (let k = 0; k < 2; k++) { const m = new T.Mesh(cloudG, cloudM); m.position.x = k * cloudG.userData.span; m.renderOrder = 1; clouds.add(m); }
    clouds.position.set(-cloudG.userData.span / 2, 104, -cloudG.userData.span / 2 + WZ / 2); scene.add(clouds);

    const hemi = new T.HemisphereLight(0xbfd9ff, 0x5a4a38, 1.0); scene.add(hemi);
    const sun = new T.DirectionalLight(0xfff1dc, 2.4); sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
    const sc = sun.shadow.camera; sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90; sc.near = 1; sc.far = 400;
    scene.add(sun); scene.add(sun.target);

    // ---------- selection box, particles, held block
    const sel = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.004, 1.004, 1.004)), new T.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
    sel.visible = false; scene.add(sel);
    const PMAX = 400;
    const partMesh = new T.InstancedMesh(new T.BoxGeometry(0.13, 0.13, 0.13), new T.MeshLambertMaterial({ vertexColors: false }), PMAX);
    partMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); partMesh.count = 0; partMesh.castShadow = false; scene.add(partMesh);
    const parts = [];
    const prnd = mulberry32(SEED + 77);
    const vmScene = new T.Scene();
    const vmHemi = new T.HemisphereLight(0xffffff, 0x777788, 1.4); vmScene.add(vmHemi);
    const vmSun = new T.DirectionalLight(0xffffff, 1.2); vmSun.position.set(0.4, 1, 0.6); vmScene.add(vmSun);
    const held = new T.Mesh(new T.BoxGeometry(0.42, 0.42, 0.42), new T.MeshLambertMaterial({ map: atlas, transparent: true, alphaTest: 0.3 }));
    vmScene.add(held);
    function setHeldTile(b) {
      const g = held.geometry, uv = g.attributes.uv; const ft = FACES[b];
      // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 verts each)
      const faceTile = [ft[2], ft[2], ft[0], ft[1], ft[2], ft[2]];
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
        const ou = [0, 1, 0, 1][k], ov = [1, 1, 0, 0][k]; const t = tileUV(faceTile[f], ou, ov); uv.setXY(f * 4 + k, t[0], t[1]);
      }
      uv.needsUpdate = true;
      held.material.emissive = new T.Color(b === LAMP ? 0x553311 : 0x000000);
    }

    // ---------- post
    let composer = null;
    if (T.EffectComposer) {
      composer = new T.EffectComposer(renderer); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H);
      composer.addPass(new T.RenderPass(scene, camera));
      const vmPass = new T.RenderPass(vmScene, camera); vmPass.clear = false; vmPass.clearDepth = true; composer.addPass(vmPass);
      composer.bloom = new T.UnrealBloomPass(new T.Vector2(W, H), 0.32, 0.5, 0.9); composer.addPass(composer.bloom);
      composer.addPass(new T.OutputPass());
    }

    // ---------- state
    const G = {
      scene, camera, renderer, WX, WY, WZ, SEA, NAMES, HOTBAR, get, hmap, biome,
      stats: { faces: faceCount, blocks: 0, types: NBLOCK - 1, chunks: NCX * NCZ },
      tod: 0.32, yaw: 0, pitch: 0, pos: new T.Vector3(WX / 2, 60, WZ / 2), vel: new T.Vector3(),
      slot: 0, fly: false, onGround: false, swing: 0, walkPhase: 0, time: 0, keys: {}, playing: false,
      showHeld: true, uiEls: null,
    };
    { let n = 0; for (let i = 0; i < vox.length; i++) if (vox[i] !== AIR && vox[i] !== WATER) n++; G.stats.blocks = n; }
    setHeldTile(HOTBAR[0]);

    // spawn: highest dry ground near the centre
    G.surface = (x, z) => { for (let y = WY - 1; y > 0; y--) { const b = get(x, y, z); if (SOLID[b] || b === WATER) return y; } return 0; };
    { let best = null; for (let r = 0; r < 60 && !best; r++) for (let a = 0; a < 16; a++) { const x = Math.round(WX / 2 + Math.cos(a / 16 * 6.283) * r), z = Math.round(WZ / 2 + Math.sin(a / 16 * 6.283) * r); const y = G.surface(x, z); if (get(x, y, z) !== WATER && y > SEA) { best = [x + 0.5, y + 1, z + 0.5]; break; } }
      if (best) G.pos.set(best[0], best[1], best[2]); }

    // ---------- edits
    function touch(x, y, z, lit) {
      const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
      const set = new Set([cz * NCX + cx]);
      const lx = x - cx * CS, lz = z - cz * CS;
      if (lx === 0) set.add(cz * NCX + cx - 1); if (lx === CS - 1) set.add(cz * NCX + cx + 1);
      if (lz === 0) set.add((cz - 1) * NCX + cx); if (lz === CS - 1) set.add((cz + 1) * NCX + cx);
      if (lx === 0 && lz === 0) set.add((cz - 1) * NCX + cx - 1);
      if (lit) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) set.add((cz + dz) * NCX + cx + dx);
      for (const k of set) { const kx = k % NCX, kz = Math.floor(k / NCX); if (kx >= 0 && kz >= 0 && kx < NCX && kz < NCZ && Math.abs(kx - cx) <= 1) rebuild(kx, kz); }
    }
    function setBlock(x, y, z, b) {
      if (!inW(x, y, z)) return false;
      const i = idx(x, y, z), old = vox[i]; if (old === b) return false;
      vox[i] = b;
      const lit = old === LAMP || b === LAMP || lightAt(x, y, z) > 0 || (OPAQUE[b] && lamps.size > 0);
      if (old === LAMP) lamps.delete(i); if (b === LAMP) lamps.add(i);
      if (lit) relight();
      // plants on top of a removed block drop with it
      if (b === AIR && KIND[get(x, y + 1, z)] === 3) { vox[idx(x, y + 1, z)] = AIR; }
      touch(x, y, z, lit);
      return true;
    }
    function burst(x, y, z, b, n = 28) {
      const tile = FACES[b][2], col = tileColor[tile];
      for (let k = 0; k < n; k++) {
        if (parts.length >= PMAX) parts.shift();
        const sh = 0.75 + prnd() * 0.45;
        parts.push({ p: new T.Vector3(x + 0.2 + prnd() * 0.6, y + 0.2 + prnd() * 0.6, z + 0.2 + prnd() * 0.6),
          v: new T.Vector3((prnd() - 0.5) * 4, prnd() * 4.5 + 1, (prnd() - 0.5) * 4), life: 0.7 + prnd() * 0.6,
          c: new T.Color(col[0] * sh, col[1] * sh, col[2] * sh).convertSRGBToLinear(), s: 0.6 + prnd() * 0.8 });
      }
    }
    G.breakBlock = (x, y, z) => { const b = get(x, y, z); if (b === AIR || b === WATER || b === BEDROCK) return false; burst(x, y, z, b, KIND[b] === 3 ? 10 : 28); setBlock(x, y, z, AIR); G.swing = 1; return true; };
    G.placeBlock = (x, y, z, b) => { const cur = get(x, y, z); if (cur !== AIR && cur !== WATER && KIND[cur] !== 3) return false; if (KIND[cur] === 3) vox[idx(x, y, z)] = AIR; const ok = setBlock(x, y, z, b); if (ok) G.swing = 1; return ok; };
    G.setBlock = setBlock;
    G.select = (s) => { G.slot = ((s % 9) + 9) % 9; setHeldTile(HOTBAR[G.slot]); if (G.uiEls) G.uiEls.update(); };

    // DDA voxel raycast from the camera
    G.pick = (reach = 6) => {
      const o = camera.getWorldPosition(new T.Vector3()); const d = camera.getWorldDirection(new T.Vector3());
      let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
      const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
      const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
      let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx, ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy, tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz;
      let face = [0, 0, 0], t = 0;
      while (t <= reach) {
        const b = get(x, y, z);
        if (b !== AIR && b !== WATER) return { x, y, z, b, face, t };
        if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; face = [-sx, 0, 0]; }
        else if (ty < tz) { y += sy; t = ty; ty += tdy; face = [0, -sy, 0]; }
        else { z += sz; t = tz; tz += tdz; face = [0, 0, -sz]; }
      }
      return null;
    };

    // ---------- time of day
    G.setTime = (tod) => {
      G.tod = tod;
      const a = (tod - 0.25) * Math.PI * 2;
      const sd = new T.Vector3(Math.cos(a), Math.sin(a), 0.32).normalize();
      skyU.sunDir.value.copy(sd);
      const day = sstep(-0.1, 0.22, sd.y), dusk = sstep(0.35, 0.0, Math.abs(sd.y)) * sstep(-0.25, 0.0, sd.y);
      skyU.day.value = day; skyU.dusk.value = dusk;
      starM.opacity = Math.max(0, 1 - day * 1.6) * 0.9;
      const hor = new T.Color().setRGB(0.015 + 0.505 * day, 0.03 + 0.69 * day, 0.07 + 0.85 * day);
      hor.lerp(new T.Color(0.9, 0.46, 0.24), dusk * 0.55);
      fog.color.copy(hor).convertLinearToSRGB().convertSRGBToLinear();
      fog.color.setRGB(Math.pow(hor.r, 1 / 2.2) * 0.9, Math.pow(hor.g, 1 / 2.2) * 0.9, Math.pow(hor.b, 1 / 2.2) * 0.9, T.SRGBColorSpace);
      const moonUp = sd.y < 0;
      const ld = moonUp ? sd.clone().negate() : sd;
      sun.userData.dir = ld;
      sun.intensity = moonUp ? 0.5 * sstep(0.0, 0.25, -sd.y) : 2.6 * sstep(-0.02, 0.18, sd.y);
      sun.color.set(moonUp ? 0x8fa6ff : 0xffffff).lerp(new T.Color(0xff9a55), moonUp ? 0 : dusk * 0.8);
      hemi.intensity = 0.24 + 0.87 * day;
      hemi.color.setRGB(0.55 + 0.2 * day, 0.62 + 0.25 * day, 0.9 + 0.1 * day);
      lampU.value = 0.35 + 1.5 * (1 - day);
      cloudM.color.setRGB(0.2 + 0.8 * day + dusk * 0.2, 0.22 + 0.78 * day, 0.28 + 0.72 * day - dusk * 0.2);
      cloudM.emissive.setRGB(0.04 + 0.2 * day, 0.05 + 0.2 * day, 0.08 + 0.22 * day).lerp(new T.Color(0.5, 0.22, 0.12), dusk * 0.7);
      renderer.toneMappingExposure = 1.0 + 0.18 * (1 - day);
      matWater.color.setRGB(0.03 + 0.05 * day, 0.08 + 0.12 * day, 0.2 + 0.42 * day);
      vmHemi.intensity = 0.25 + 1.15 * day; vmSun.intensity = 0.15 + 1.05 * day;
      if (composer) composer.bloom.strength = 0.3 + 0.45 * (1 - day);
    };
    G.setTime(G.tod);

    G.cam = (x, y, z, yaw, pitch) => { G.pos.set(x, y, z); G.yaw = yaw; G.pitch = pitch; G.camDirect = true; };

    // ---------- physics
    const collides = (px, py, pz) => {
      const r = 0.3;
      for (let y = Math.floor(py); y <= Math.floor(py + 1.79); y++)
        for (let z = Math.floor(pz - r); z <= Math.floor(pz + r); z++)
          for (let x = Math.floor(px - r); x <= Math.floor(px + r); x++) if (SOLID[get(x, y, z)]) return true;
      return false;
    };
    function physics(dt) {
      const k = G.keys, fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), side = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
      const sp = G.fly ? 11 : k.ShiftLeft ? 5.8 : 4.3;
      const cy = Math.cos(G.yaw), sy = Math.sin(G.yaw);
      let wx = (-sy * fwd + cy * side), wz = (-cy * fwd - sy * side); const l = Math.hypot(wx, wz) || 1; wx /= l; wz /= l;
      const moving = fwd || side;
      const inWater = get(Math.floor(G.pos.x), Math.floor(G.pos.y + 0.4), Math.floor(G.pos.z)) === WATER;
      const accel = G.onGround || G.fly ? 14 : 3;
      G.vel.x += ((moving ? wx * sp : 0) - G.vel.x) * Math.min(1, accel * dt);
      G.vel.z += ((moving ? wz * sp : 0) - G.vel.z) * Math.min(1, accel * dt);
      if (G.fly) { G.vel.y += (((k.Space ? 1 : 0) - (k.ControlLeft || k.KeyC ? 1 : 0)) * 8 - G.vel.y) * Math.min(1, 10 * dt); }
      else if (inWater) { G.vel.y = Math.max(G.vel.y - 9 * dt, -3); if (k.Space) G.vel.y = 3.2; G.vel.x *= 0.9; G.vel.z *= 0.9; }
      else { G.vel.y -= 28 * dt; if (k.Space && G.onGround) G.vel.y = 8.6; G.vel.y = Math.max(G.vel.y, -40); }
      G.onGround = false;
      const steps = Math.ceil(Math.max(Math.abs(G.vel.x), Math.abs(G.vel.y), Math.abs(G.vel.z)) * dt / 0.2) || 1;
      const h = dt / steps;
      for (let s = 0; s < steps; s++) {
        let nx = G.pos.x + G.vel.x * h; if (collides(nx, G.pos.y, G.pos.z)) { G.vel.x = 0; nx = G.pos.x; } G.pos.x = nx;
        let nz = G.pos.z + G.vel.z * h; if (collides(G.pos.x, G.pos.y, nz)) { G.vel.z = 0; nz = G.pos.z; } G.pos.z = nz;
        let ny = G.pos.y + G.vel.y * h; if (collides(G.pos.x, ny, G.pos.z)) { if (G.vel.y < 0) { G.onGround = true; ny = Math.floor(ny) + 1; if (collides(G.pos.x, ny, G.pos.z)) ny = G.pos.y; } else ny = G.pos.y; G.vel.y = 0; } G.pos.y = ny;
      }
      G.pos.x = Math.min(WX - 0.4, Math.max(0.4, G.pos.x)); G.pos.z = Math.min(WZ - 0.4, Math.max(0.4, G.pos.z));
      if (G.pos.y < -10) G.pos.y = G.surface(Math.floor(G.pos.x), Math.floor(G.pos.z)) + 2;
      if (moving && G.onGround) G.walkPhase += dt * (k.ShiftLeft ? 11 : 8.5);
    }

    // ---------- per-frame
    G.update = (dt) => {
      G.time += dt;
      waterU.uTime.value = G.time;
      if (G.playing) physics(dt);
      // camera
      const bob = G.playing && !G.fly ? Math.sin(G.walkPhase) * 0.05 : 0;
      camera.position.set(G.pos.x, G.pos.y + (G.camDirect ? 0 : 1.62) + bob, G.pos.z);
      camera.rotation.set(G.pitch, G.yaw, 0, "YXZ");
      camera.updateMatrixWorld();
      sky.position.copy(camera.position); stars.position.copy(camera.position);
      // shadow frustum follows the camera, snapped to texels to stop shimmering
      const ld = sun.userData.dir || new T.Vector3(0, 1, 0);
      const fwd = camera.getWorldDirection(new T.Vector3());
      const c = camera.position.clone().addScaledVector(fwd.setY(0).normalize(), 40);
      const texel = 180 / 4096; c.x = Math.round(c.x / texel) * texel; c.z = Math.round(c.z / texel) * texel; c.y = 30;
      sun.target.position.copy(c); sun.position.copy(c).addScaledVector(ld, 200); sun.target.updateMatrixWorld();
      // clouds drift
      const span = cloudG.userData.span; clouds.position.x = -span / 2 + ((G.time * 1.6) % span) - span / 2 + WX / 2;
      // selection
      const hit = G.hideSel ? null : G.pick();
      if (hit) { sel.visible = true; sel.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5); } else sel.visible = false;
      G.hit = hit;
      // particles
      const m4 = new T.Matrix4(), q = new T.Quaternion(), sc3 = new T.Vector3();
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.v.y -= 20 * dt; p.p.addScaledVector(p.v, dt);
        if (SOLID[get(Math.floor(p.p.x), Math.floor(p.p.y - 0.06), Math.floor(p.p.z))]) { p.p.y = Math.floor(p.p.y - 0.06) + 1.06; p.v.set(p.v.x * 0.5, 0, p.v.z * 0.5); }
      }
      partMesh.count = parts.length;
      parts.forEach((p, i) => { const s = p.s * Math.min(1, p.life * 3); m4.compose(p.p, q, sc3.set(s, s, s)); partMesh.setMatrixAt(i, m4); partMesh.setColorAt(i, p.c); });
      partMesh.instanceMatrix.needsUpdate = true; if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
      // held block + swing
      G.swing = Math.max(0, G.swing - dt * 4.5);
      const sw = Math.sin((1 - G.swing) * Math.PI) * (G.swing > 0 ? 1 : 0);
      const hb = G.playing ? Math.sin(G.walkPhase) * 0.02 : 0;
      held.visible = G.showHeld;
      const off = new T.Vector3(0.52 - sw * 0.18, -0.5 + hb - sw * 0.1 + Math.abs(Math.cos(G.walkPhase)) * 0.012, -0.78 + sw * 0.1).applyQuaternion(camera.quaternion);
      held.position.copy(camera.position).add(off);
      held.quaternion.copy(camera.quaternion).multiply(new T.Quaternion().setFromEuler(new T.Euler(-0.12 - sw * 0.7, 0.72, 0.04)));
    };
    G.render = () => { if (composer) composer.render(); else { renderer.render(scene, camera); renderer.autoClear = false; renderer.clearDepth(); renderer.render(vmScene, camera); renderer.autoClear = true; } };
    G.resize = (w, h) => { G.w = w; G.h = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); if (composer) composer.setSize(w, h); };
    G.w = W; G.h = H;
    // laptop knobs: render scale and shadow map size (0 = no shadows) can change while playing
    G.setPixelRatio = (d) => { renderer.setPixelRatio(d); if (composer) composer.setPixelRatio(d); G.resize(G.w, G.h); };
    G.setShadows = (size) => {
      sun.castShadow = size > 0;
      if (size > 0 && sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    };
    if (opts.shadow != null) G.setShadows(opts.shadow);

    // ---------- input (play mode)
    G.sens = 0.0024;
    G.bindInput = (el) => {
      G.playing = true; G.camDirect = false;
      const locked = () => document.pointerLockElement === el;
      const doBreak = () => { const h = G.pick(); if (h) G.breakBlock(h.x, h.y, h.z); };
      const doPlace = () => { const h = G.pick(); if (!h) return;
        const px = h.x + h.face[0], py = h.y + h.face[1], pz = h.z + h.face[2];
        const pb = { x0: G.pos.x - 0.3, x1: G.pos.x + 0.3, y0: G.pos.y, y1: G.pos.y + 1.8, z0: G.pos.z - 0.3, z1: G.pos.z + 0.3 };
        const inter = px + 1 > pb.x0 && px < pb.x1 && py + 1 > pb.y0 && py < pb.y1 && pz + 1 > pb.z0 && pz < pb.z1;
        if (!inter || !SOLID[HOTBAR[G.slot]]) G.placeBlock(px, py, pz, HOTBAR[G.slot]); };
      addEventListener("keydown", (e) => { G.keys[e.code] = true; if (e.code === "KeyF") { G.fly = !G.fly; G.vel.y = 0; }
        if (e.code.startsWith("Digit")) { const n = +e.code.slice(5); if (n >= 1 && n <= 9) G.select(n - 1); }
        if (e.code === "KeyT") G.setTime((G.tod + 0.125) % 1);
        // trackpad-friendly: Q breaks, E places without clicking
        if (locked() && !e.repeat && e.code === "KeyQ") doBreak();
        if (locked() && !e.repeat && e.code === "KeyE") doPlace();
        if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault(); });
      addEventListener("keyup", (e) => { G.keys[e.code] = false; });
      addEventListener("blur", () => { G.keys = {}; });   // cmd-tab away must not leave W held down
      // listen on the document, not the canvas: the "click to play" overlay sits on top of the
      // canvas and would swallow the click. Chrome rejects a re-lock right after Esc; ignore it.
      document.addEventListener("click", () => { if (document.pointerLockElement === el) return;
        const r = el.requestPointerLock(); if (r && r.catch) r.catch(() => {}); });
      addEventListener("mousemove", (e) => { if (!locked()) return;
        G.yaw -= e.movementX * G.sens; G.pitch = Math.max(-1.55, Math.min(1.55, G.pitch - e.movementY * G.sens)); });
      addEventListener("mousedown", (e) => { if (!locked()) return;
        // macOS: ctrl+click is the secondary click
        if (e.button === 2 || (e.button === 0 && e.ctrlKey)) doPlace(); else if (e.button === 0) doBreak(); });
      addEventListener("contextmenu", (e) => e.preventDefault());
      // one hotbar step per mouse-wheel notch (~100px, or 1 "line") and per ~60px of trackpad
      // scroll; the cooldown stops a trackpad momentum flick from spinning through every slot
      let wheelAcc = 0, lastStep = 0;
      addEventListener("wheel", (e) => { if (!locked()) return; e.preventDefault();
        wheelAcc += e.deltaMode ? Math.sign(e.deltaY) * 100 : e.deltaY;
        const now = performance.now();
        if (Math.abs(wheelAcc) >= 60 && now - lastStep > 110) { G.select(G.slot + Math.sign(wheelAcc)); wheelAcc = 0; lastStep = now; }
        else if (now - lastStep <= 110) wheelAcc = 0; }, { passive: false });
    };

    // ---------- UI: crosshair + hotbar with isometric block icons
    function icon(b, size) {
      const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
      const ft = FACES[b]; const k = size / 34;
      if (KIND[b] === 3) { x.drawImage(tiles[ft[0]], 0, 0, TS, TS, size * 0.1, size * 0.1, size * 0.8, size * 0.8); return c; }
      const cx = size / 2, y0 = size * 0.06;
      const faces = [[tiles[ft[0]], [k, k * 0.5, -k, k * 0.5, cx, y0], 1], [tiles[ft[2]], [k, k * 0.5, 0, k * 1.12, cx - 16 * k, y0 + 8 * k], 0.72], [tiles[ft[2]], [k, -k * 0.5, 0, k * 1.12, cx, y0 + 16 * k], 0.52]];
      for (const [img, m, sh] of faces) { x.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); x.drawImage(img, 0, 0); x.globalAlpha = 1 - sh; x.fillStyle = "#000"; x.globalCompositeOperation = "source-atop"; x.fillRect(0, 0, 16, 16); x.globalCompositeOperation = "source-over"; x.globalAlpha = 1; }
      x.setTransform(1, 0, 0, 1, 0, 0); return c;
    }
    G.icon = icon;
    G.ui = (host) => {
      const st = document.createElement("style");
      st.textContent = `.bw-x{position:absolute;left:50%;top:50%;width:18px;height:18px;transform:translate(-50%,-50%);pointer-events:none;mix-blend-mode:difference}
        .bw-x:before,.bw-x:after{content:"";position:absolute;background:#fff}.bw-x:before{left:8px;top:0;width:2px;height:18px}.bw-x:after{top:8px;left:0;height:2px;width:18px}
        .bw-hb{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:flex;gap:2px;padding:3px;background:rgba(0,0,0,.45);border:2px solid rgba(0,0,0,.6);pointer-events:none}
        .bw-hb div{width:40px;height:40px;border:2px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;background:rgba(40,40,40,.5)}
        .bw-hb div.on{border-color:#fff;box-shadow:0 0 0 1px #000 inset}
        .bw-name{position:absolute;left:50%;bottom:62px;transform:translateX(-50%);font:600 12px/1 ui-monospace,Menlo,monospace;color:#fff;text-shadow:0 1px 0 #000,1px 0 0 #000;letter-spacing:.06em;pointer-events:none;transition:none}`;
      host.appendChild(st);
      const x = document.createElement("div"); x.className = "bw-x"; host.appendChild(x);
      const hb = document.createElement("div"); hb.className = "bw-hb"; host.appendChild(hb);
      const nm = document.createElement("div"); nm.className = "bw-name"; host.appendChild(nm);
      const slots = HOTBAR.map((b) => { const d = document.createElement("div"); const ic = icon(b, 32); d.appendChild(ic); hb.appendChild(d); return d; });
      G.uiEls = { update() { slots.forEach((d, i) => d.classList.toggle("on", i === G.slot)); nm.textContent = NAMES[HOTBAR[G.slot]]; } };
      G.uiEls.update();
      return G.uiEls;
    };
    G.rawSet = (x,y,z,b) => { if(inW(x,y,z)) vox[idx(x,y,z)]=b; }; G.rebuildAll = () => { relight(); for(let z=0;z<NCZ;z++)for(let x=0;x<NCX;x++)rebuild(x,z); }; G.makeOak = oak;
    G.blockMesh = (b) => {
      const geo=new T.BoxGeometry(1,1,1),uv=geo.attributes.uv,ft=FACES[b],faceTile=[ft[2],ft[2],ft[0],ft[1],ft[2],ft[2]];
      for(let f=0;f<6;f++)for(let k=0;k<4;k++){const t=tileUV(faceTile[f],[0,1,0,1][k],[1,1,0,0][k]);uv.setXY(f*4+k,t[0],t[1]);}
      const m=new T.Mesh(geo,new T.MeshLambertMaterial({map:atlas,alphaTest:KIND[b]===1?.45:0}));m.castShadow=m.receiveShadow=true;return m;
    };
    return G;
  }

  window.Blockworld = { create, BLOCK: { AIR, GRASS, DIRT, STONE, SAND, WATER, LOG, LEAVES, SNOW, PLANK, GLASS, BRICK, PINELOG, PINELEAVES, CACTUS, GRAVEL, COAL, GOLD, BEDROCK, LAMP, COBBLE, TALLGRASS, ROSE, DANDELION, SNOWGRASS } };
})();
