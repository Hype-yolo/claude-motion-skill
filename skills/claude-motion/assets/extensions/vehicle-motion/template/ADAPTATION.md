# convoy — new source-assisted film

Upstream: [drcollect/demolition-derby](https://github.com/drcollect/demolition-derby/tree/f559fc60a7f2ee3a21a4faf77e998ae31ad67c43) @ f559fc60a7f2ee3a21a4faf77e998ae31ad67c43.

## Actual retained implementation
Original Vehicle.step actually runs: raycast suspension springs/dampers, drive/brake/reverse, speed-dependent steering, friction ellipse, wheel slip/spin, engine and gear outputs. Original createWorld/120 Hz settings and collision groups. 2161 steps are baked to seekable transform/wheel tracks.

## New subject, event and camera
Three newly constructed delivery carts with no Collect geometry or named car designs, one-way bridge/river/banks, timed queue control and turn-by-turn crossing.

## Asset and licensing boundary
MIT code. All five Collect Car models, their geometry, designs and trademarks are explicitly excluded from MIT and are NOT copied into this extension or generated project. The exclusion notice is included only as documentation. New simple cart geometry is original local code. Rapier dependency has Apache-2.0 license.

## Runtime boundary
Three 0.170.0 and Rapier 0.21.0 bundled. No deformation/damage, derby arena/game, Collect assets, audio or autonomous collision-avoidance capability claimed. New queue control supplies inputs to real vehicle dynamics; trajectory checks validate this one story.

## Editable files and rendering
Edit scene.source.js, then npm install and npm run build; the ready scene.js bundle needs no network or npm to preview.
Run a local static server in this folder. index.html renders the source at time 0; call render(t) to seek. preview.html plays film.mp4 after export.

Render: node <skill>/scripts/render.mjs --root <out> --page index.html --out <out>/film.mp4 --fps 24 --gpu metal

Target: 18 seconds, 1280x720, 24 fps, 432 frames, silent. Initial representative frames inspected before first full export. First complete export will be frozen under first-export/ and hashed; later revisions, if any, must be separate. No external generation service or image generation used.
