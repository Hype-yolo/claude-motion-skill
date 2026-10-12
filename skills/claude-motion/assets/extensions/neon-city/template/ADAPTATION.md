# canal — new source-assisted film

Upstream: [billpwchan/neon-zenith](https://github.com/billpwchan/neon-zenith/tree/27ad04ef04aa9e1e1366fccc63e15a379b999f01) @ 27ad04ef04aa9e1e1366fccc63e15a379b999f01.

## Actual retained implementation
Original corporate/rngFor tier geometry, complete createBuildings procedural TSL window/parallax/grime/neon-spill material, makeNoiseTexture, original stateless createRain streak and splash shaders, chunkedInstances. The city chooses original GLASS style to use the procedural branch, with neutral array placeholders for the unused captured-facade branch.

## New subject, event and camera
New canal, stone bridge, paper canopy with ribs, maintenance quadrotor with retrieval tether, umbrella fall/drift/retrieval and a moving camera.

## Asset and licensing boundary
MIT code. Concrete and shutter maps are CC0 according to upstream CREDITS: Poly Haven. No CC BY external vehicle/shop/building models, photographic facade atlases, fonts, HDRI or audio are included.

## Runtime boundary
Three 0.170.0 bundled. Original upstream is 0.186.1; this adaptation was actually rendered with 0.170.0. Native WebGL backend, not a full WebGPU/game port.

## Editable files and rendering
Edit scene.source.js, then npm install and npm run build; the ready scene.js bundle needs no network or npm to preview.
Run a local static server in this folder. index.html renders the source at time 0; call render(t) to seek. preview.html plays film.mp4 after export.

Render: node <skill>/scripts/render.mjs --root <out> --page index.html --out <out>/film.mp4 --fps 24 --gpu metal

Target: 18 seconds, 1280x720, 24 fps, 432 frames, silent. Initial representative frames inspected before first full export. First complete export will be frozen under first-export/ and hashed; later revisions, if any, must be separate. No external generation service or image generation used.
