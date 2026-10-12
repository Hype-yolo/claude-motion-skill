# 送别 · Farewell

A snowman plays a farewell song on the piano. The black cat watching from the lid jumps down to play along. The snowman melts; when the last note fades, only a red scarf is left, and the cat curls up on it to sleep.

A 72-second crayon animation, 1080×1080 at 24 fps. No AI video model and no drawn assets: every frame is rendered by code written with **Claude Opus 5.5**.

![cover](media/cover.jpg)

![storyboard](media/storyboard.jpg)

▶️ Watch: [media/songbie.mp4](media/songbie.mp4) (720p preview)

## How it works

Everything is plain JavaScript running on Node.js.

- **3D scene, 2D drawing.** The room, piano, bench, snowman and cat are modelled in centimetres and projected through a pinhole camera onto a canvas (`@napi-rs/canvas`). The camera slowly pushes in as the story goes on.
- **Simulated crayon.** Shapes are not filled. Each one is hatched with hundreds of short, jittered strokes, then a paper-grain layer is applied on top. The jitter is re-seeded every 3 frames, which gives the hand-drawn "boil".
- **One score drives everything.** `score.js` holds every note of the song. The audio and the picture both read it, so the snowman's twig hands and the cat's paw land on the keys you hear.
- **Melting is one parameter.** A single value from 0 to 1 controls the body slumping, the face shrinking, the scarf loosening, the water on the bench and the puddle on the floor.
- **Depth-sorted characters.** The cat and the snowman are drawn in order of their real distance from the camera.
- **Output.** Raw frames are piped to `ffmpeg`, which encodes H.264 and mixes in the audio at −14 LUFS.

## Files

| File | What it does |
|---|---|
| `render.js` | The whole picture: scene, camera, crayon renderer, characters, animation, encoding |
| `score.js` | The song as data: notes, timing, pedal, story beats |
| `sampler.js` | Plays the score through piano samples and writes `out/audio.wav` |
| `out/audio.wav` | The finished audio track, so you can render the video without the samples |
| `render_piano.swift`, `exs_dump.py` | Helper tools used while building the piano sound |

## Run it

You need Node.js 20+ and `ffmpeg` on your PATH.

```bash
npm install
```

```bash
npm run render
```

The full render is 1740 frames and takes about 13 minutes on an Apple Silicon laptop. For a few test frames instead:

```bash
npm run stills
```

## About the piano sound

The audio was made with the Steinway piano samples that ship with Apple Logic Pro. Those samples are Apple's copyrighted content, so they are **not** in this repository, and `sampler.js` will not run without them. The rendered `out/audio.wav` is included, which is all `render.js` needs.

## The song

送别 (*Songbie*, "Farewell") has lyrics by Li Shutong (1915), set to the melody of *Dreaming of Home and Mother* by John P. Ordway (1851). Both are in the public domain.

## License

Code: [MIT](LICENSE).
