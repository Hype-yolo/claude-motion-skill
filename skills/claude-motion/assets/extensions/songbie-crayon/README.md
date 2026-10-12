# Songbie crayon rendering system

Adapted from [JohnnyWang8802/songbie](https://github.com/JohnnyWang8802/songbie/tree/97225eb54a351c9938ad896e04bef7a7020393fb), commit `97225eb54a351c9938ad896e04bef7a7020393fb`, © 2026 Johnny Wang, MIT. The upstream picture is a snowman playing piano with a cat. The new included example is an otter repairing a windsock by a river. They are different works.

## Make an independent editable project

```sh
node create-project.mjs --out /absolute/new/project
cd /absolute/new/project
npm install
npx playwright install chromium
npm run preview
# Open http://127.0.0.1:8000
npm run render
```

The scene itself requires only a modern browser Canvas 2D API. Export additionally uses Node 22+, Playwright Chromium and `ffmpeg`/`ffprobe` on PATH. `@napi-rs/canvas` is not required: the upstream canvas API calls were kept and moved into a browser-compatible closure. The copied exporter also works with `MOTION_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs` if already installed. `npm run render` writes film.mp4 and an export report. Default example: 18 seconds, 1280×720, 24 fps, silent, no text overlays.

## API

```js
import {createCrayonRenderer} from './crayon.js';
const E=createCrayonRenderer(canvas);
E.begin(t,24); // original three-frame BOIL and warm paper background
E.setCamera([158,146,273],[-8,50,24],895);
E.box([-10,10],[0,20],[-5,5],'#ad8260',{seed:12});
E.crayon(E.ellipsePts(640,360,90,70),'#92715b',{seed:1});
E.depthSort([{pos:[0,0,0],draw:()=>{/* draw object using E.P / E.PP */}}]);
E.finish(); // original cold-press tooth and crayon drag composite
```

`crayon`, `stroke`, `PRESS`, 2D geometry, pinhole projection, box face culling, `makeTooth` and `applyTooth` are retained byte-for-byte as function regions; see SOURCE.json and research preservation-evidence.json. The paper noise grid is widened to fit landscape sizes. `depthSort` is a reusable painter-order wrapper around the source's original `P(pos)[2]` criterion. There is no triangle z-buffer. Projected billboards and convex box faces require sensible draw groups; complex intersecting meshes need explicit splitting.

Edit `scene.js` to author objects, story events, camera and poses. Keep per-object seeds stable. Do not replace crayon with flat fills if claiming this rendering system. `crayon` resets global alpha, so whole-character opacity needs an offscreen layer or a compositing pass. The example reflection reuses the same character draw with a vertical flip/compression and a river clip. Its initial repair, progressive stitches, lifted sleeve and lowered gaze are authored for the new prompt; they do not come from the upstream story.

`upstream/` retains original picture and score for auditing only. No Logic Pro samples or original soundtrack are included or required. Authors' claim of Claude usage is provenance stated in upstream README, not independently audited model-call evidence. Running this renderer proves rendering mechanics and export, not a universal aesthetic effect.
