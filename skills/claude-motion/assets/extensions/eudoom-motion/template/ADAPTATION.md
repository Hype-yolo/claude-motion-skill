# orbit — source adaptation

Prompt: A tiny spacecraft moves from a crowded orbit to a quiet moon landing, with clear instrument diagrams explaining the journey.

Source: https://github.com/Salmisaari/eudoom-video/tree/a7bb5ed43644cb214bd3546266c8492914177f98

## Retained code

- original four-ink PrintPost
- actual 33-cube separation LUT
- ink transmittance multiplication
- dot screens, plate registration, ink grain, paper fibers

## New subject, event and framing

Replaced EU song/history, imagery and lyrics with a crowded-orbit spacecraft transfer and landing. New planet, 18 satellites, trajectory, rocket, cratered moon and instrument readouts. Original four-ink shader and separation LUT create the printed material. Diagrams are illustrative and not flight physics.

## License and asset boundary

Original repository code: MIT. License and fixed-source SHA-256 inventories accompany this project. No original song, piano sample, lyrics, supplied photo or completed reference video is used. Dependencies retain their own licenses under licenses/. 

## Output and validation

18 s; 1280 × 720; 24 fps; silent. Created independently from the extension template. Representative frames visually inspected before first full export. Full film, ffprobe and decode results are in the render report. First full export is preserved; no post-export revision. Run a local HTTP server to open index.html, or use the video preview.html after export. User aesthetic approval remains pending.

## Edit and export

Edit scene.js; core code lives in system.js (bundled from upstream files).

```sh
npm install
npx playwright install chromium
node render.mjs --root . --out film.mp4 --fps 24
```

MOTION_PLAYWRIGHT_MODULE may point to an existing local Playwright index.js. No runtime external requests are required.
