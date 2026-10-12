# Lanshu Signal Explainer · sourced DOM/SVG production component

One source style is integrated: `v2-signal` from cclank/lanshu-create-ai-presenter-video at commit `762d3ee42623b75a4ec63ad6aa61ace69d78ce6e` (MIT). This is not a claim that all twelve upstream styles or the presenter pipeline have been integrated. No portrait, voice API, paid service, or remote runtime request is used.

## Create an independent editable project

```sh
node create.mjs --out /absolute/new/project
cd /absolute/new/project
npm install
npx playwright install chromium
npm run serve
# open http://127.0.0.1:8023 ; Play/pause and seek controls are in the bottom margin
npm run render
```

Node 22+, FFmpeg/ffprobe and Chromium are required. Actual validation used Node 26.0.0, Playwright 1.63.0 and the installed Chromium. A host can reuse Playwright by setting `MOTION_PLAYWRIGHT_MODULE` to its `index.mjs` instead of installing it in each project.

The upstream painter is native DOM/SVG, not a Canvas painter. `export.mjs` is a local screenshot adapter: it invokes `window.render(t)`, captures each complete 1280×720 frame, sends 432 PNG frames to FFmpeg and checks decoding and deterministic seeking. It preserves actual upstream DOM geometry, typography and SVG wires rather than replacing the style with a reimplementation. It produces `film.mp4`, `preview.png`, `film.report.json` and refuses to overwrite a full film. For a revision use `--out film_v2.mp4` and retain the original source snapshot. `--frames 1,4,8.5,11,17.5` makes preflight stills. No audio track is emitted.

## Retained implementation

`lib/core.js`, `lib/kit.js`, and `lib/kit.css` are byte-identical copies of the pinned source. `SOURCE.json` records their hashes and source paths. The example directly calls upstream `Story`, `Chapters`, `Kit.backdrop`, `Kit.hud`, `Kit.ticker`, `Kit.label`, `Kit.note`, `Kit.wire`, `Kit.bez`, `Kit.tracker` and `Kit.stamp`. These provide time-driven layout and drawing, text decoding, chapter progress, SVG cable path drawing, Bézier pulse geometry and focus brackets. They are actual implementation calls, not a style description.

The `kit.wire` packet train is disabled in this particular single-message narrative; a custom six-slot optical train follows `Kit.bez` on the same wire curves, with a deterministic attenuation reset at each repeater. The intact information is demonstrated by two displays of `101101`. The kit's wire packet/trail implementation remains available for network traffic stories.

## Adapt to a new topic

This starter is a **performed cable example**, not a topic-agnostic text-to-film generator. A new topic requires editing `story.js` (chapter timings, message/diagram data), `film.js` (objects and performed events) and, if needed, `style.css`. It exposes the entire real V2 component API for graphs, formulas, comparison bars and notes. Do not just replace the heading to claim a new adaptation. Read the pinned upstream `KIT.md` in the research folder for additional factories.

Use this style for system mechanisms, networking and causal diagrams; do not force it on character acting, texture-rich film or 3D material demonstrations. Scientific scale and the physical waveform are schematic. This scene does not simulate actual fibre dispersion, noise, error correction, geographical routing or real repeater count. It shows optical amplification, not decoding/re-encoding at every repeater.

The code preserves MIT attribution in `LICENSE-lanshu`. The repository author is the source attribution; model authorship has not been independently audited. Technical verification does not prove audience approval or a universal Claude style.
