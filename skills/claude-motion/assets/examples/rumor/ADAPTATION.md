# Actual adaptation

Source: lemomo-ai/lemo-opuscar, commit `c4bc370eb15d36c88e074fdba1b0248b62a8e419`, case `lemo-midcentury-toon` (Meet Pip). Source attribution is the library author's claim, not an independently audited model-generation claim. The frozen package was the only creative reference read. The original preview was inspected. `prepare-case.mjs` copied the source and license inventory; see `REFERENCE-INPUT.json`.

## Runtime use

- `styles/midcentury-toon/demo/engine/toon.js` is imported unchanged. Actual calls use `setClock`, `shape`, `ink`, `ellipse`, `spline`, `rect`, `plane`, `text`, `sparkle`, `paperFinish`, timing helpers, and the mutable `PAL` / `REG` settings. The off-register color/outline separation, twelve-Hz register jitter, seeded dry-brush texture, pressure ribbon outline with breaks, and paper finish all execute in the final renderer. They are not descriptions or palette-only references.
- `styles/midcentury-toon/demo/engine/chars.js` is imported unchanged. Its `drawOwner` executes for every person. Original June head/bob silhouette, body/clothing paths, sleeve joints, glove union, facial expressions, blink, and grounded feet/shadows are reused. Four neighbors are variants of the same source character, differentiated by sweater and hair palette. The scene temporarily parameterizes PAL per character and restores it before the next drawing.
- The new `scene.js` rewrites staging, timings, speech bubbles, relay, expressions, character orientation, arm gestures, original goldfish/bowl/table drawings, shark and monster embellishments, English dialogue, and final reality comparison. Body stillness and moving arms are intentionally retained.

## Changed / omitted

The register base offset is reduced from 6/4 pixels to 3.2/2.1 at 1280×720, jitter from 1.6 to .8. Character scale is scene dependent. Custom arm angles are driven by deterministic time. No source-code module was edited; all new behavior lives in scene.js.

Original vacuum, dock, appliance instruction narrative, original shot sequence/timeline, demo end card, source sound, narration, subtitles, fonts, icons module, route generator, medallions, and scene iris helpers are not invoked. Source code copies may contain those unused features but do not run them. No separate WebGL compositor exists in the selected engine; its Canvas off-register and grain mechanisms are preserved.

The requested silent film overrides the style guide's three-layer sound recommendation. Georgia uses the installed system font through Chromium, avoiding absent source fonts. No external artwork, references, web assets, audio, or generated images were added.

## License

MIT source license and copied third-party font license notices remain in the prepared source tree. No bundled third-party font is loaded by the film. Original scene additions are provided with this delivery; original upstream notices remain intact.
