# voxel — new source-assisted film

Upstream: [L1vsun/BLOCKWORLD](https://github.com/L1vsun/BLOCKWORLD/tree/4d33550c023661beda4a012630e5d93819a6677e) @ 4d33550c023661beda4a012630e5d93819a6677e.

## Actual retained implementation
Original game.js seeded terrain/noise, procedural block atlas, face-culling AO chunk mesher, sun/moon lighting/shadows and original oak() tree algorithm. Original bundled Three 0.180 renderer retained. Added rawSet/rebuildAll/blockMesh expose those mechanisms; tree blocks are produced by oak and displayed using the original atlas UV mapping.

## New subject, event and camera
New sculpted block hillside/bare patch, a new garden robot and planting arm, seed placement, tree growth by scaling source-generated oak geometry, and a deterministic observation camera.

## Asset and licensing boundary
MIT game code. Procedural textures and original vendor bundle retained with license notices; no downloaded model/texture/character assets.

## Runtime boundary
Original game port is deliberately bounded to a 4x4 chunk cinematic world. No claim that the full playable 224x72x224 game or block-edit interface is integrated; tree growth is new geometry scaling, not a biological simulation.

## Editable files and rendering
Edit scene.js for story/camera and blockworld.js for the extracted original game.
Run a local static server in this folder. index.html renders the source at time 0; call render(t) to seek. preview.html plays film.mp4 after export.

Render: node <skill>/scripts/render.mjs --root <out> --page index.html --out <out>/film.mp4 --fps 24 --gpu metal

Target: 18 seconds, 1280x720, 24 fps, 432 frames, silent. Initial representative frames inspected before first full export. First complete export will be frozen under first-export/ and hashed; later revisions, if any, must be separate. No external generation service or image generation used.
