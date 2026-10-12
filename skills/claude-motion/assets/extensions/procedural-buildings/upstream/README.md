# ProceduralBuildingsThreeJS

![The configurator: the French building in the city, with the GUI](docs/screenshots/app.jpg)

A web configurator for procedural buildings ported from Blender geometry nodes,
standing in a procedural city drawn as an architectural massing model, under a
cinematic lighting set. The **🏙 building** selector at the top of the GUI
switches between:

- **French**: a Haussmann-style Parisian apartment building (below);
- **New York**: the pre-war corner building from `NYC_CornerBuilding.blend`,
  evaluated live from its real node graph (see [New York building](#new-york-building));
- **Chinese**: the corner apartment building with shops, enclosed balconies,
  AC units, laundry and a rooftop sign from `CN_ApartmentBuilding.blend`,
  evaluated live the same way (see [Chinese apartment building](#chinese-apartment-building)).

| French | New York | Chinese |
| --- | --- | --- |
| ![The Haussmann-style French building](docs/screenshots/paris.jpg) | ![The New York corner building](docs/screenshots/new-york.jpg) | ![The Chinese apartment building](docs/screenshots/chinese.jpg) |

The French building is ported from the geometry-nodes setup in `FrenchBuilding.blend`:

- **FR_Procedural_Building** (modifier "French Building" on `FR_Building`) and its
  **FR_Facade_Side** subgroup assemble the facade modules;
- **FR_Interior_Rooms** / **FR_Interior_Curtains** (on `FR_Rooms` / `FR_Curtains`)
  read the building's instances and add lit rooms behind the windows and voile
  curtains;
- **FR_SidewalkFollowBuilding** (modifier "Follow Building" on `FR_Sidewalk` /
  `FR_Curb`, driven by Bays X / Y) stretches the paved sidewalk and the granite
  curb around the building. Both meshes and their materials are exported by
  `tools/export_fr_street.py` and drawn with the graph renderer and shader-graph
  compiler of the New York building ([src/street.ts](src/street.ts)); the
  city's streets start at the curb.

The module meshes are exported to an instanced kit (`public/assets/kit.glb`), and
all four graphs are ported to TypeScript. The port is **verified against
Blender's evaluated geometry**: instance positions match to the float32 bit, and
the roof cap, room meshes with their shader attributes, and curtains match
within 2e-4 m (`npm run verify`).

## Run

```sh
npm install
npm run dev
```

GUI folders:

- **building**: the modifier inputs, with the same names and ranges as the .blend:
  bays X / Y, floors, dormers, balcony type (Existing / Exterior), detail pattern
  (Off / Same / Alternate / Random per floor), detail style (Refends / Pilasters /
  Ornamented Panels), detail seed, detail depth.
- **interiors**: room / curtain visibility, room seed, max room depth,
  curtain seed, no-curtain and closed-curtain chances, room brightness.
- **building · New York** (when selected): every input of the NYC_Building
  modifier, grouped by its panels (Building, Facade, Windows, Facade Modules, AC,
  Balconies, Interiors, Lighting, Shops, Escalator, Fire Escapes, Signs, Roof,
  Cornice), with the .blend's ranges and tooltips; angles in degrees; a
  "reset to .blend values" button.
- **building · Chinese** (when selected): every input of the CN_Building
  modifier, grouped by its panels (Building, Facade, Windows, Residents'
  Additions, Shops, Rooftop Sign, Roof, Street), including the Wall Tint color
  and the rooftop Sign Text; the same reset button.
- **🎬 lighting set** (with **🏙 city**), **🎥 camera**, **✨ post**, **snow**, **rain**: see below.

On start a preloader streams everything, evaluates all three buildings and
compiles their shaders (see [Loading](#loading)), so switching building types
afterwards is a swap.

## How the port works

| .blend | TypeScript |
| --- | --- |
| FR_Facade_Side + FR_Procedural_Building | [src/generator.ts](src/generator.ts) |
| FR_Interior_Rooms, FR_Interior_Curtains | [src/interiors.ts](src/interiors.ts) |
| Hash Value / Random Value nodes | [src/rng.ts](src/rng.ts) |
| FR_Stone, FR_StoneTrim, FR_Zinc, FR_Iron, FR_WindowFrame, FR_DoorWood, FR_Glass, FR_Interior, FR_Voile | [src/materials.ts](src/materials.ts) |

- Each side is a row of 3 m bays: a 4.2 m ground floor (door on the middle bay of
  the front), 3.2 m upper floors (continuous balcony on the 2nd floor and the top
  floor, and optionally a projecting balcony on every other window), a wall-detail
  overlay per floor, a corner pier, a cornice, and a zinc mansard with or without
  dormers. The four sides wrap a (3·bays X + 2) × (3·bays Y + 2) m footprint under
  a zinc roof cap.
- The interior graphs hash each window's **instance position** to pick its room
  photo, curtain state and so on. [src/generator.ts](src/generator.ts) therefore
  rebuilds instance matrices the way Blender does: Euler → float32 quaternion →
  matrix, and the SSE `mul_m4_m4m4` summation order, all in `Math.fround`. Without
  that, a side facade lands at y = 2.5 instead of Blender's 2.4999998 and every
  hash changes.
- The modules have no UVs: every .blend material is a world-space triplanar
  projection of an ambientCG texture set, with tint, roughness range, bump, and
  FBM grime streaks. That is re-injected into MeshStandard/MeshPhysical materials
  via `onBeforeCompile`. Blender-only shader terms (Ambient Occlusion, Bevel) are
  left out.
- FR_Interior is an emission shader: a flat-perspective lookup into a 2×5 atlas
  of apartment photos (`tex/interiors.jpg`), per-room offset, mirroring, and warm
  "lamps on" tint.

## New York building

The NYC building is not re-typed in TypeScript. Its ~3,500 geometry nodes and
28 material node trees are **dumped from the .blend and executed in the browser**,
so edits in Blender carry over by re-running the export scripts.

| piece | file |
| --- | --- |
| geometry-nodes evaluator (fields, 60 node types, Blender float32 / hash / multi-input order semantics; shared with the Chinese building) | [src/nyc/gn.ts](src/nyc/gn.ts) |
| meshes, point clouds, curves, instances, Blender matrices + primitives | [src/nyc/geo.ts](src/nyc/geo.ts) |
| module kit + String to Curves glyphs | [src/nyc/kit.ts](src/nyc/kit.ts) |
| shader node trees → GLSL in MeshPhysicalMaterial (triplanar texture sets, ramps, noise, bump, room projections, glass) | [src/nyc/shadergraph.ts](src/nyc/shadergraph.ts) |
| leaves → InstancedMesh per mesh / material slot, instance attributes packed as vec4 | [src/nyc/flatten.ts](src/nyc/flatten.ts), [src/nyc/render.ts](src/nyc/render.ts) |
| GUI metadata, defaults, stage bounds (`GraphBuilding`, `NycBuilding`) | [src/nyc/building.ts](src/nyc/building.ts) |

Assets live in `public/assets/nyc/` (`graph.json`, `kit.json` + `kit.bin`,
`materials.json`, `tex/`, ~11 MB) and load the first time New York is selected.
A rebuild takes ~0.4–1.2 s in the browser, so the GUI rebuilds when a slider is
released. Its Sidewalk runs all the way round (Sidewalk All Around, on by
default) or only along the two street facades, round the corner; the stage
paves the sides it leaves bare, and the city's streets start at its curb.

Known approximations: Noise / Voronoi / White Noise textures are GLSL
look-alikes (not Blender's exact hashes), custom sign text ignores kerning, and
instance attributes that drive material colours are not verified value by value
(only geometry is, see below). The stage uses its own lights and tone
mapping, so the building reads brighter than Blender's AgX render of the same
view; the colours measure the same hue.

## Chinese apartment building

`CN_ApartmentBuilding.blend`'s **CN_Building** modifier (on `CN_CornerApartment`)
runs on the same evaluator as New York: its ~3,100 geometry nodes (CN_Building,
CN_Facade, CN_Roof, CN_Street, CN_Finalize) and 42 materials are dumped from the
.blend by [tools/cn/](tools/cn/) and executed in the browser
([src/cn/building.ts](src/cn/building.ts) holds the footprint and stage bounds).

What this graph needed beyond New York:

- **One realized mesh.** The graph realizes everything, then CN_Finalize
  box-projects a `UVMap` per material (corner domain) and tints the `Col` color
  attribute. So the evaluator has corner-domain attributes, FLOAT2 / color /
  int attributes, and domain adaptation (copy / average), and the building draws
  as one mesh per material.
- **New nodes:** Merge by Distance (Blender's index-order welding with averaged
  attributes), region Extrude, Flip Faces, Mesh Grid, Curve Circle / Line,
  Resample Curve, Spline Parameter, Distribute Points on Faces (Blender's
  per-triangle drand48 generator, seed × 5383843, Poisson elimination and
  swap-remove order), Geometry Proximity, Face Area, Material Selection,
  Evaluate on Domain, Separate / Combine Color, color Mix, Remove Named
  Attribute, point-domain Delete Geometry.
- **Float-exact face normals.** The Normal field reads Blender's face normal
  cache, which is Newell's method in float32 for every face. The UV projection
  of 45° faces depends on its last bit.
- **UV-mapped materials.** The shader compiler also handles UV Map, Color
  Attribute, tangent-space Normal Map (tangent frame from UV derivatives) and
  Principled Alpha: blended for BLENDED materials (glass, PVC strip curtains,
  decals), clipped at 0.5 for dithered ones (leaves).
- **Chinese text.** The rooftop Sign Text goes through String to Curves with
  Bfont, which falls back to Noto Sans CJK. The kit carries ASCII plus the
  1,172 characters of [tools/cn/glyphs.txt](tools/cn/glyphs.txt): common Chinese
  signage and residential characters, traditional / Japanese kanji, hiragana,
  katakana and CJK punctuation. Each glyph also carries Blender's own Fill Curve
  triangulation, because its constrained Delaunay welds touching strokes (e.g. 福,
  寓), so the extruded sign matches Blender exactly. Characters that aren't in the
  list are left out; add them to the file and re-run the kit export.

Assets live in `public/assets/cn/` (`graph.json`, `kit.json` + `kit.bin` with
the glyphs, `materials.json`, `tex/` with 1024 px color and normal maps and
512 px roughness / AO / opacity / metalness maps; ~23 MB). They load the first
time Chinese is selected. A rebuild takes ~2 s, the GUI rebuilds when a slider
is released, and with its Sidewalk on (all the way round) the stage adds no
paving of its own: the streets start at its curb.

Known approximations: alpha-clipped leaves cast solid shadows, and Fill Curve
on curves that aren't untouched String to Curves glyphs triangulates with
three's ear-clipping, not Blender's CDT (the graph doesn't do that).

## The city

The building stands in a procedural city ([src/city/](src/city/)) drawn like an
architectural massing model: white roads and sidewalks, and plain white volumes
(one per lot; towers get a podium and a setback). No greenery, cars or street
furniture: the building on its paved forecourt is the only detailed thing.

![The New York building in its city, from above](docs/screenshots/city.jpg)

- **It follows the building.** The hero block is the footprint + its sidewalk +
  a paved forecourt (none when the building brings its own sidewalk: the
  streets start at its curb); a street grid wraps it, with block sizes drawn
  per grid index, so a bigger building pushes the city outward and the city keeps its
  buildings. The first ring stays below the building's height (it grows with
  it), a skyline rises beyond, and the massing follows the building type: an
  even Parisian cornice line, a New York downtown of narrow lots and towers, a
  taller Chinese city ([src/city/layout.ts](src/city/layout.ts)).
- **One draw call**: the whole city is one InstancedMesh of boxes (~700–900)
  with one clay material ([src/city/glsl.ts](src/city/glsl.ts)). Near the
  building it casts into the key light's shadow map and takes GTAO; further out a
  1024² heightmap carries its shadows (a short march towards the sun).
- **Clear the view**: a building standing between the camera and the hero sinks
  into the ground, eased (instance matrices on the CPU, so shadows and GTAO
  follow), and rises again as the camera moves on.
- **Reflections**: in the city, the scene's environment map is captured from the
  city itself (sky + skyline, the building hidden), per city, once per look.
- **🏙 city** (under **🎬 lighting set**): the environment (City, or the dark
  studio Stage the building stood on before), key on the city, "clear the view",
  and a new random city.
- Layouts are cached (the three building types + one more size), so switching
  back is a swap; a new size lays out in ~5–30 ms.

## Loading

[src/preloader.ts](src/preloader.ts) and `index.html`: a white massing model
that assembles itself as the app loads (the building first, then the city
around it), a progress bar and the current step.

1. every asset streams at once (the French kit, both graph buildings, their
   textures; progress counts three's loader items and fetches);
2. each building is built once: the graphs evaluate on the main thread (~0.4 s
   New York, ~2 s Chinese), the loader keeps animating on the compositor;
3. each building is put on the stage and its shaders compiled
   (`compileAsync`, KHR_parallel_shader_compile) and rendered once, for the
   shadow / AO / DoF pass variants; each city's reflections are captured.

Built buildings are cached per type until their values change, so switching
types doesn't re-evaluate a graph, and every shader is already compiled (on
ANGLE / D3D11 a first compile of the node-graph materials stalls for seconds).
A graph building re-evaluating after a slider change shows an "evaluating…"
pill. The reveal flies from high above the city down into the hero shot.

## Cinematic lighting set

The lighting set ([src/studio.ts](src/studio.ts)): a sky dome (horizon →
zenith gradient with a glow on the light source, a sun / moon disk, stars, a
drifting cloud deck) that melts into the haze, the city's roads as the floor,
and the stone plinth / site paving under the building (only where the building
brings no sidewalk of its own).

| Golden Hour | Blue Hour | Neon Night |
| --- | --- | --- |
| ![Golden Hour, street level](docs/screenshots/golden-hour.jpg) | ![Blue Hour](docs/screenshots/blue-hour.jpg) | ![Neon Night](docs/screenshots/neon-night.jpg) |
| **Storm + rain** | **Blue Hour + snow** | **Facade detail** |
| ![Storm with rain, street level](docs/screenshots/rain.jpg) | ![Blue Hour with snow](docs/screenshots/snow.jpg) | ![Facade detail at golden hour](docs/screenshots/facade-detail.jpg) |

- **Moods**: *Architectural* (the default: soft, bright daylight on the white
  model, Khronos PBR Neutral tone mapping so whites stay white), *Studio*,
  *Golden Hour*, *Blue Hour*, *Midnight Noir*, *Overcast*, *Storm*, *Clear
  Day*, *Neon Night*. Each is a complete "Look": key / fill / rim lights (color,
  intensity, azimuth, elevation, shadow softness), hemisphere bounce, IBL, facade
  uplights, room brightness, sky, height haze, key on the city, tone mapping
  (ACES / AgX / Neutral) and grade. Switching moods crossfades every value,
  and every value is editable live under **🎬 lighting set**.
- **Light rig**: key (directional, 4k soft PCF shadows fitted to the building,
  long enough for a low sun), fill, a rim spot with an optional **volumetric
  beam**, hemisphere bounce, four grazing **facade uplights**, and **lightning**
  strikes while it rains.
- **Height fog**: three's fog chunks are patched with an analytic exponential
  height fog. It pools on the ground and thins towards the roof, and every
  material gets it.
- **Post** ([src/postfx.ts](src/postfx.ts)): GTAO ambient occlusion (glass,
  curtains, particles and the beam are excluded), depth of field with autofocus
  on the orbit target, the mood's tone mapping, and a film grade (white
  balance, split toning, contrast, saturation, chromatic aberration, vignette,
  grain, animated letterbox off / 1.85 / 2.39 / 2.76 : 1).
- **Camera** ([src/shots.ts](src/shots.ts)): *Hero ¾*, *Street level*,
  *Worm's-eye*, *Aerial*, *Facade detail* and *Profile* are framed from the live
  building size (and the letterbox) and flown to with an eased dolly. Also: field
  of view and auto-orbit. Grabbing the camera cancels a move.
- **Weather**: snow (flakes + accumulation shells on the building, the city,
  floor and sidewalk) and rain (streaks + wet, puddled, rippling surfaces on the building
  and the stage) — [src/snow.ts](src/snow.ts), [src/snowAccum.ts](src/snowAccum.ts),
  [src/rain.ts](src/rain.ts), [src/wet.ts](src/wet.ts).

## Blender files

The three source files live in [blender/](blender/): `FrenchBuilding.blend`,
`NYC_CornerBuilding.blend` and `CN_ApartmentBuilding.blend` (Blender 5.1), with
every image they use in `blender/textures/`, linked with relative paths, so they
open anywhere: the ambientCG and Poly Haven sets (CC0) by set name, and in
`misc/` the rest (the New York interior atlases and a few render previews). They
are stored with [Git LFS](https://git-lfs.com) (~380 MB): install it before
cloning, or run `git lfs pull` in an existing clone.

They are shared copies of the working files. After editing an original,
refresh its copy (its images are collected again; the original is not touched):

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --factory-startup `
  "$HOME\Desktop\FrenchBuilding.blend" --python tools\collect_blend.py -- .
```

## Blender tooling (Blender 5.1)

Run from the project root. Every script is non-destructive, so it can also be
`exec()`'d inside a live session, e.g. through the Blender MCP; set the global
named in its docstring first.

```powershell
$blender = "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
$blend = "$HOME\Desktop\FrenchBuilding.blend"   # wherever the .blend lives

# re-export the module kit + textures after editing modules / materials in the .blend
& $blender --background $blend --python tools\export_kit.py -- .

# dump Blender's evaluated geometry for 4 parameter sets (ground truth for npm run verify)
& $blender --background $blend --python tools\dump_truth.py -- tools\truth.json

# dump the node graphs to JSON (for reviewing graph changes)
& $blender --background $blend --python tools\dump_graph.py -- graph.json

# re-export the sidewalk + curb (FR_Sidewalk / FR_Curb) and their materials
& $blender --background $blend --python tools\export_fr_street.py -- .
```

New York (`NYC_CornerBuilding.blend`, read-only):

```powershell
$nyc = "$HOME\Desktop\NYC_CornerBuilding.blend"
& $blender --background $nyc --python tools\nyc\dump_nyc_graph.py -- public\assets\nyc\graph.json
& $blender --background $nyc --python tools\nyc\export_nyc_kit.py -- .
& $blender --background $nyc --python tools\nyc\export_nyc_materials.py -- .
& $blender --background $nyc --python tools\nyc\dump_nyc_truth.py -- tools\nyc\truth.json
```

Chinese (`CN_ApartmentBuilding.blend`, read-only):

```powershell
$cn = "$HOME\Desktop\CN_ApartmentBuilding.blend"
& $blender --background $cn --python tools\cn\dump_cn_graph.py -- public\assets\cn\graph.json
& $blender --background $cn --python tools\cn\export_cn_kit.py -- .
& $blender --background $cn --python tools\cn\export_cn_materials.py -- .
& $blender --background $cn --python tools\cn\dump_cn_truth.py -- tools\cn\truth.json
```

`export_kit.py` writes `public/assets/kit.glb` (module meshes with their material
slots) and `public/assets/tex/` (1024 px color maps, 512 px roughness +
displacement packs, and the interior atlas).

## Verifying the port against Blender

```sh
npm run verify
```

This compares the generator with `tools/truth.json` (from `dump_truth.py`) and
prints `ALL CHECKS MATCH BLENDER` when every building instance, the roof cap,
every room vertex (position + `room_local` / `room_p1..3`) and every curtain
vertex agree.

```sh
npm run verify:nyc
```

Runs the NYC evaluator on 4 parameter sets from `tools/nyc/truth.json` (the
file's values; LOW detail with a 1.9 rad corner; MEDIUM with other styles and a
custom sign; escalator / casement / grid sashes) and matches every rendered
piece against Blender's depsgraph (mesh signature + world matrix within 2 mm).
It prints `NYC: ALL SETS MATCH BLENDER`.

```sh
npm run verify:cn
```

Runs the evaluator on 5 parameter sets from `tools/cn/truth.json`:
- the file's values;
- a wider building at LOD1 with ceramic tile, a wall tint and a Latin sign;
- a small 3-floor building with every resident addition and an empty roof;
- a 12-floor LOD2 building with other window, shop and height settings;
- the Collision boxes.

For every material of the realized output mesh it compares the face, corner
and smooth-face counts, area, bounding box, and the area-weighted moments of
face centers, UVMap and Col with Blender's. It prints
`CN: ALL SETS MATCH BLENDER`.

`node tools/nyc/screenshot_nyc.mjs <url> <outDir> [shot | cam=px,py,pz,tx,ty,tz] [mood] [json params]`
takes headless screenshots of the New York building, and
`node tools/cn/screenshot_cn.mjs` (same arguments) of the Chinese building.

The README screenshots in `docs/screenshots/` come from a production build
(no dev server; the shot list is in the script):

```sh
npx vite build --outDir <dist>
node tools/readme_shots.mjs <dist>                              # all of them
node tools/readme_shots.mjs <dist> docs/screenshots snow rain   # some of them
```

## Showcase videos

[tools/video/](tools/video/) records one 1080p60 showcase video per building:
a hook (the building morphing under its title), one segment per parameter
group with its own camera move and a card showing the live values, a lighting
finale and an outro. The storyboards (parameter keyframes, camera keys, moods,
weather) are in [tools/video/stories.mjs](tools/video/stories.mjs).

```sh
npx vite build --outDir <dist>
node tools/video/record.mjs french <dist> out/paris.mp4     # or nyc, cn
node tools/video/record.mjs cn <dist> out/cn.mp4 --stills 5,12.5,30   # single frames, to check framing
```

The app runs in headless Chrome, served straight from `<dist>`, on a virtual
clock: `requestAnimationFrame` only fires when the recorder advances it by
exactly 1/60 s. A frame whose parameters change rebuilds the building first,
however long that takes (~3 s for the Chinese graph), so the video stays smooth.
Each frame is captured and piped to ffmpeg (libx264). `--from` / `--to` record
a time range; `node tools/video/probe.mjs <dist> <kind> <json params> <material regex>`
prints where a material's geometry sits on the stage, for framing shots.

Two 3-second hooks go with them:

- **Split screen** ([tools/video/split.mjs](tools/video/split.mjs)): Paris,
  New York and 中国 side by side in portrait panels, each changing fast (floors,
  footprint, colour) until all three switch to blue hour together, under a
  "Blender Geometry Nodes → three.js" header with a live parameter chip per
  panel. It records the panels (stories `split_fr` / `split_ny` / `split_cn`)
  in parallel, renders the graphics as transparent frames and stacks it all
  with ffmpeg: `node tools/video/split.mjs <dist> out/split.mp4`.
- **Blender** ([tools/video/blender_record.py](tools/video/blender_record.py) +
  [blender_compose.mjs](tools/video/blender_compose.mjs)): Blender's own UI
  (Geometry Nodes workspace, Material Preview) with the three buildings side by
  side while their modifier inputs change. The script appends the Paris and
  Chinese buildings next to New York, drives the inputs from a timer and saves a
  window screenshot per frame; the compositor adds the dragging cursor, the
  field highlight, a zoom and the title card. It opens a fullscreen Blender
  window for a few minutes (here on the second monitor):

  ```powershell
  & $blender blender\NYC_CornerBuilding.blend --factory-startup --window-geometry 0 -1080 1920 1080 `
    --python tools\video\blender_record.py -- out\blender_frames
  node tools\video\blender_compose.mjs out\blender_frames out\blender.mp4
  ```

The logos in `tools/video/assets/` are the Blender app icon and the three.js
icon.
