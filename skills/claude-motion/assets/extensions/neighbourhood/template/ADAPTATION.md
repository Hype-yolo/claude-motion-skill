# town — source adaptation

Prompt: A small neighborhood works together to repair a broken footbridge; a baker, a gardener and a cyclist each contribute, then everyone crosses.

Source: https://github.com/ChetasLua/little-neighbourhood/tree/7888ed552f85d63a57351efc7a69345b791936eb

## Retained code

- original procedural animal head DNA and 3D projection
- original species features, ears, muzzles, eyes, fur
- original drawResident full body
- original inverse-kinematics arms/legs
- original paper and seeded ink line boil

## New subject, event and framing

Excluded Claude brand mascot and original tasks/game state. Extracted reusable animal anatomy, resident rig, paper and ink. A baker carries a plank, a gardener seats boards and a cyclist supplies a tool, repairing a gap and crossing together. New footbridge, houses, repair timeline and resident hand targets. Existing animal models reused with new role/context; body motion is the actual original resident rig.

## License and asset boundary

Original repository code: MIT. License and fixed-source SHA-256 inventories accompany this project. No original song, piano sample, lyrics, supplied photo or completed reference video is used. Dependencies retain their own licenses under licenses/. 

## Output and validation

18 s; 1280 × 720; 24 fps; silent. Created independently from the extension template. Representative frames visually inspected before first full export. Full film, ffprobe and decode results are in the render report. First full export is preserved; no post-export revision. Run a local HTTP server to open index.html, or use the video preview.html after export. User aesthetic approval remains pending.

## Edit and export

Edit scene.js; core code lives in neighbours.js.

```sh
npm install
npx playwright install chromium
node render.mjs --root . --out film.mp4 --fps 24
```

MOTION_PLAYWRIGHT_MODULE may point to an existing local Playwright index.js. No runtime external requests are required.


Revision v2: First complete film retained at learning/ab-test-14/skill/town. One authorized revision corrects the river crossing geometry: the narrow channel now occupies the bridge gap only, residents begin on banks and feet cross within the deck span. No material/rig substitution.
