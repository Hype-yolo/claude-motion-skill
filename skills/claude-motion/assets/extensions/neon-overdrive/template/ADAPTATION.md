# neon — source adaptation

Prompt: A city subway pulse travels through tunnels, branching stations light up in sequence, and the pulse resolves into a calm network map.

Source: https://github.com/bizarro/evangelion/tree/8f670f3262c75a454d26e01e062da96db7eefb05

## Retained code

- original LineBatch instanced capsule SDF
- HDR line rendering
- original Post 7-level bloom pyramid, halation, grain, tone shoulder and texture HUD

## New subject, event and framing

Replaced EVA motifs, lyrics, audio-driven feature analysis and original scenes with a subway network. New routes, stations, traveling pulse segments, perspective tunnel ribs and a calm resolved map. Original GPU capsule batch and HDR post-processing are called. Station labels are illustrative fiction.

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
