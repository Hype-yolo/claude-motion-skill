# watercolor — source adaptation

Prompt: An old seaside postcard gradually dissolves into flowing watercolor, then gathers into a new picture of a sailboat returning home.

Source: https://github.com/iamtechartist/memory-fading-into-watercolor/tree/0bcc7cedfa9b0323437d746916174c9bba34026e

## Retained code

- GPU max-dilation pigment transport with anisotropic paper thirst
- torus-mapped simplex FBM
- Beer-Lambert absorbance
- wet-edge pooling, back-runs, paper tooth, graphite recollection

## New subject, event and framing

Replaced original swing/tree with a newly drawn lighthouse harbor postcard. It dissolves into paper-fed pigment, clears, then a larger returning sailboat gathers into a new image. Color diffusion and absorption are genuine original shaders; swing warping disabled because it is inapplicable. New shoreline, harbor geometry, caption, masks, timing, no sound.

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
