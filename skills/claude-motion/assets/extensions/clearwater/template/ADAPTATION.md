# pond — new source-assisted film

Upstream: [Aureliengmz/clearwater](https://github.com/Aureliengmz/clearwater/tree/4bc826134321043a25df3c2b6fed16fb7b9241e8) @ 4bc826134321043a25df3c2b6fed16fb7b9241e8.

## Actual retained implementation
Entire original ocean-spectrum FFT, ripple wave equation, RGB refracted-grid caustics, Fresnel/absorption/refraction main water shader, procedural pebble bed and bloom/tone/grain.

## New subject, event and camera
New red maple geometry with lobes and veins, stones, wooden footbridge, timed leaf landing and drift. Added Three geometry is composited over the native water canvas with the same camera basis. The timeline advances the original ripple solver at fixed 60 Hz and resets on backward seek.

## Asset and licensing boundary
MIT code and embedded procedural pebble texture; README identifies tools/make_pebbles.py as its generator. No author portrait, brand artwork, music or third-party models copied into the visible scene.

## Runtime boundary
Three 0.170.0 bundled. Use default Chromium software renderer for exact repeatability. Metal produced sub-pixel caustic accumulation differences in RGB; software passed identical repeated seek. Lens-diffraction glare is disabled; FFT water, caustics, and bloom are active. Stones/bridge added by an overlay are not part of the water shader reflection/refraction integrator.

## Editable files and rendering
Edit scene.source.js, then npm install and npm run build; the ready scene.js bundle needs no network or npm to preview.
Run a local static server in this folder. index.html renders the source at time 0; call render(t) to seek. preview.html plays film.mp4 after export.

Render: node <skill>/scripts/render.mjs --root <out> --page index.html --out <out>/film.mp4 --fps 24

Target: 18 seconds, 1280x720, 24 fps, 432 frames, silent. Initial representative frames inspected before first full export. First complete export will be frozen under first-export/ and hashed; later revisions, if any, must be separate. No external generation service or image generation used.
