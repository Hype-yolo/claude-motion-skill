# Bee colony drawing system

Source: buildwithhanif/claude-animation-skill @ 4ddb8c80fdec96dc9f55d4b9bdee60bde6f0134b, MIT.

Actually retained: original core.mjs arc-length Catmull path sampler, deterministic grain/hatch; textures.mjs fibrePaper/sun/grass; nature.mjs bee (striped fuzzy abdomen/wing flap) and blossom (petal vein/ink outline). Template swaps the Node canvas factory import for an equivalent browser factory; original drawing functions remain. No ant character is forced into this bee story. The original ant film is audit material only.

New story: bee discovers flower, gathers pollen, returns to hive, dances and guides a second worker. All scene/layout/flight/event data are rewritten. Silent 18s1280×72024fps. Edit template/scene.js; helper API available in lib.

Create with create.mjs --out NEW_DIR. Export with Skill scripts/render.mjs --root NEW_DIR --out NEW_DIR/film.mp4 --fps 24. Original songs/fonts/media not included. Original code MIT, license retained. Style and quality benefit require human review.
