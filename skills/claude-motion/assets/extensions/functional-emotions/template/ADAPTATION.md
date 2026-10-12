# emotion — source adaptation

Prompt: Show how a shy forest creature notices a distant sound, chooses between hiding and approaching, then relaxes when it finds a friendly visitor.

Source: https://github.com/ledbetterljoshua/functional-emotions-video/tree/b34c20a4f8f64ee87079a2ae2fdedf2cf1990a49

## Retained code

- original GPU instanced brushstroke painter
- edge-following source color sampling
- dry-bristle stroke shader
- canvas weave, vignette, light finish

## New subject, event and framing

Replaced full song chapters, original human cast and lyrics with newly drawn shy forest creatures. A distant visual sound-wave cue is noticed, two possible paths appear, the creature withdraws and then approaches a friendly visitor; facial tension relaxes. Original GPU repainting remains. No audio track is included, so sound is represented visually.

## License and asset boundary

Original repository code: MIT. License and fixed-source SHA-256 inventories accompany this project. No original song, piano sample, lyrics, supplied photo or completed reference video is used. Dependencies retain their own licenses under licenses/. 

## Output and validation

18 s; 1280 × 720; 24 fps; silent. Created independently from the extension template. Representative frames visually inspected before first full export. Full film, ffprobe and decode results are in the render report. First full export is preserved; no post-export revision. Run a local HTTP server to open index.html, or use the video preview.html after export. User aesthetic approval remains pending.

## Edit and export

Edit scene.js; core code lives in paint.js.

```sh
npm install
npx playwright install chromium
node render.mjs --root . --out film.mp4 --fps 24
```

MOTION_PLAYWRIGHT_MODULE may point to an existing local Playwright index.js. No runtime external requests are required.
