# Pixel bird drawing and frame system

Source: simonw/tools @ e12bd6da66e591ce2bc3fad88124e930126ac9eb, kakapo-party.html; Apache-2.0. Original region from rand helpers through FRAMES builder is extracted without rewriting: BODY/AIR_LEGS/WING definitions, palette variants, widen(), buildFrames(), paintGrid().

New story: two birds collect twigs and weave a nest on a stump; a third arrives with a final feather. Background, nest geometry, carried twigs, choreographed walk/hop paths are new. Original party/music/confetti event loop is excluded. Retained bird sprites are explicitly reused; the result is a new story using original bird designs.

Edit template/scene.js for new subject and events, birds.js for sprite variants; do not count copying this example as new adaptation. create.mjs --out NEW_DIR; export via Skill scripts/render.mjs --root NEW_DIR --out NEW_DIR/film.mp4 --fps 24. Browser Canvas2D only, no network. Silent 18s720p. Apache license accompanies the modified extraction.
