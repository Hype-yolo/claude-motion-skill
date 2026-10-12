# Human gait curves

Source: stefanomainardi/omacrt @ 8a643fdeffc79f7cf965e68c5699caa0e1280771, shell/src/people.rs, MIT.

Actual retained behavior: JOINTS 20 samples; Catmull-Rom interpolation in joints(); pelvis offset9degrees; THIGH22.5/SHIN21.5; stride() based on stance ankle travel; sagittal knee/ankle geometry, two-leg max reach ground height. These functions are ported to JS in gait.js, not a claim that the whole Rust renderer or measured imagery is bundled. people.png/gait.csv/article graphics are not included. New character geometry and palette are local.

New story: an elderly walker crosses a wet plaza, steadies a fallen pot, then resumes walking. Artistically simplified body and rain; not a medical/biomechanics simulator. Original joint/stride logic participates at every walking frame, not just a style label.

Create via create.mjs --out NEW_DIR; edit scene.js for poses/staging and gait.js for motion model. Export using Skill scripts/render.mjs --root NEW_DIR --out NEW_DIR/film.mp4 --fps 24. Canvas2D18s720p24fpssilent. Source MIT notice retained. Human review determines actual quality benefit.
