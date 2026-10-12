# app — source adaptation

Prompt: Introduce a fictional pocket astronomy app: align a star chart, reveal three useful controls, and turn a saved observation into a timeline.

Source: https://github.com/Leonxlnx/claude-launchvideo/tree/f0906e8629fa524c7cedc1ac959bf987005ee846

## Retained code

- original anim.ts E curves, frame tweens, SPR spring configurations, hitPulse
- original RackFocus sharp/constant-blur crossfade
- original Cursor path and press squash

## New subject, event and framing

Replaced Tessel/calendar branding and app with fictional Aster astronomy. Newly written star chart aligns, ALIGN/FIND/DIM controls reveal, cursor saves an observation, then a three-node timeline grows. Original easing/springs, focus crossfade and pointer implementation are called in React. Local browser screenshot exporter preserves native DOM.

## License and asset boundary

Original repository code: MIT. License and fixed-source SHA-256 inventories accompany this project. No original song, piano sample, lyrics, supplied photo or completed reference video is used. Dependencies retain their own licenses under licenses/. Remotion 4 is eligible for this individual local evaluation; its free-use license is not MIT and does not allow relicensing or selling derivatives of Remotion.

## Output and validation

18 s; 1280 × 720; 24 fps; silent. Created independently from the extension template. Representative frames visually inspected before first full export. Full film, ffprobe and decode results are in the render report. First full export is preserved; no post-export revision. Run a local HTTP server to open index.html, or use the video preview.html after export. User aesthetic approval remains pending.

## Edit and export

Edit film.js; core code lives in system.js (bundled from upstream files).

```sh
npm install
npx playwright install chromium
node export.mjs --root . --out film.mp4
```

MOTION_PLAYWRIGHT_MODULE may point to an existing local Playwright index.js. No runtime external requests are required.
