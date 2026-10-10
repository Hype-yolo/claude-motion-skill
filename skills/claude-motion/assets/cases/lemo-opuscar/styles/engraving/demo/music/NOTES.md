# Music notes: "The Honeybee, Plate VII"

Original score written in code (`score.py`; deterministic, and a rebuild gives a byte-identical `score.wav`). All melodies and progressions are new. It uses no existing or public-domain tunes.

- **Key:** D major. **Tempo:** 96 BPM in 4/4 (beat 0.625 s, bar 2.5 s, 16 bars = 40.0 s).
- **Forces:** harpsichord (continuo and solo figures) plus a string quartet: solo violin I and ensemble violin II, violas, cellos and contrabass. The strings play pizzicato up to 25.0 s and use the bow only from 26.25 s.
- **Rebuild:** from the repo root, run `.venv/bin/python styles/engraving/demo/music/score.py`. It takes about 5 s and writes `score.wav`, `stems/`, `cues.json`, `CREDITS_music.txt` and `timing_report.txt`.
- **Level:** integrated loudness is -18.0 LUFS (BS.1770, checked with ffmpeg ebur128). Peak is -1.2 dBFS. The file is 48 kHz stereo, 24-bit.
- **Stems:** `harpsichord.wav`, `pizz.wav` and `bowed.wav`. Each is 40.0 s and uses the same gain as the mix, so the three sum to the mix before the limiter (about 1 dB of peak limiting on two hits).

## Form (trio-sonata texture, the grammar of engraving followed by colour)

| Bars / time | Harmony | What happens |
|---|---|---|
| 1 (0–2.5) | — | Silent for burin foley. **1.875 / 2.1875** harpsichord pickup A4 → C#5, damped short (below -28 dBFS by 2.3). |
| 2 (2.5) | D, A/C# | **The print is pulled:** tutti downbeat accent (harpsichord D chord, cello, contrabass and viola pizz). Cello walking bass and viola in pizz 8ths. |
| 3 (5.0) | Bm, G, A7 | **5.0** violin II enters in 16th pizz, broken-chord "cross-hatching". **6.25** harpsichord 32nd-note arpeggio flourish (G, then A7) rises into **7.5**. |
| 4 (7.5) | D, G | Full texture. **9.375** it thins to a cello pizz A pedal plus a high harpsichord 8th figure (dominant, "curious"). |
| 5 (10.0) | A pedal | **10.425** ring "ting": solo violin pizz A6 with harpsichord A5. **11.275–12.5875** rising pizz and harpsichord scale A4 → A5 (8 notes, 0.1875 s apart). **12.775** landing on low D (cello, contrabass and harpsichord D). |
| 6 (12.5) | D, Bm | The pizz texture comes back lighter (it restarts at 13.125). |
| 7 (15.0) | Em7, A7, D | **15.0** Em7 downbeat. **15.5** ting (B6). **15.8–16.66** faster rise (7 notes, 1/7 s apart). **16.8** landing on D. |
| 8 (17.5) | Bm, G, A | Fuller texture. **19.375** thins to an A pedal (third detail). **19.875** ting (A6). |
| 9 (20.0) | D, G | **20.0** the violin I pizz melody, the most tuneful moment: A5 F#5 D6 · B5 G5-A5 B5 C#6-D6 · E6 G5 F#5. **21.475** landing on low G. **22.19** the lift: violin II 16th crescendo plus a harpsichord roll. |
| 10 (22.5) | Em, A7 | **23.75** harpsichord descending 16th run A5 → A4 (in octaves), ending on the dominant. The last note is 90 ms long and everything is gated to zero at 25.0. The expected tonic never comes, which is the joke. |
| 11 (25.0–26.25) | — | **Total digital silence** (-inf dBFS, reverb tails included). |
| 11b–13 (26.25) | D, Bm, G, Em7, A7 → **D** | **26.25** the first bowed notes of the film. Cellos, violas and violins enter pp on D and swell to mp by 27.6. Soprano line A5 B5 · D6 C#6 → D6, bass line descending in thirds D-B-G-E then A → D. The harpsichord is sparse and high: slow broken chords at 27.5, 28.75 and 30.0. **31.25** perfect cadence V7 → I: a low harpsichord D (not rolled) with the upper chord rolled after it, contrabass pizz, and bowed D chord. The tonic then rings. |
| 14 (32.5) | D | **33.75** wink: one soft solo-violin pizz D6. |
| 15–16 (35.0–40.0) | D | **35.625** a very soft harpsichord D-A-D roll for the end card. A fade from 36.6 reaches zero at 38.9. Digital silence from 39.0 to 40.0. |

**Narration windows.** Inside 6.4–9.6, 9.8–14.9, 15.3–19.2 and 19.7–23.3 the pizz is short and dry, which keeps 300 Hz–3 kHz transient rather than sustained. During 26.9–30.9 the bowed chords sit mostly in the bass (cellos and contrabass below 300 Hz) and above 900 Hz (violins at A5–D6), with only violas and violin II in the voice band at pp. The harpsichord plays only four soft broken chords there.

**Reverb.** `S.room` per stem, applied before the silence gates, so no tail leaks into 25.0–26.25: harpsichord size .28 / mix .16, pizz .30 / .18, bowed .42 / .24. There is a 35 Hz high-pass on every stem.

## Timing check

Method: each accent in `cues.json` is measured on its own rendered stem, after reverb. The detector finds the first 30 % rise from the local trough to the local peak in [t-60 ms, t+120 ms]. Low landings are measured below 300 Hz and tings above 2 kHz. The results are then matched to the brief's cue map. Tolerance is ±42 ms (one frame at 24 fps). For the bowed entry, the measure is the first bowed sample above -100 dBFS.

```
Against the brief cue map (nearest measured accent):
OK  map  1.8750s  <-  1.8730s  err   -2.0 ms  pickup 1: harpsichord A4
OK  map  2.1875s  <-  2.1855s  err   -2.0 ms  pickup 2: harpsichord C#5
OK  map  2.5000s  <-  2.4990s  err   -1.0 ms  bar 2 downbeat: print pulled (tutti D accent)
OK  map  5.0000s  <-  5.0030s  err   +3.0 ms  bar 3: 2nd violin 16th pizz hatching enters
OK  map  6.2500s  <-  6.2500s  err   +0.0 ms  harpsichord flourish starts (title engraved)
OK  map  7.5000s  <-  7.5130s  err  +13.0 ms  bar 4: flourish lands, full texture
OK  map  9.3750s  <-  9.3800s  err   +5.0 ms  texture thins: cello A pedal + high harpsichord figure
OK  map 10.4250s  <- 10.4230s  err   -2.0 ms  ring ting #1 (violin pizz A6 + harpsichord A5)
OK  map 11.2750s  <- 11.2740s  err   -1.0 ms  rising line #1 starts
OK  map 12.7750s  <- 12.7970s  err  +22.0 ms  landing #1: low cello + bass pizz D
OK  map 15.0000s  <- 15.0070s  err   +7.0 ms  bar 7: second detail begins (Em7 downbeat)
OK  map 15.5000s  <- 15.4980s  err   -2.0 ms  ring ting #2 (violin pizz B6)
OK  map 15.8000s  <- 15.7940s  err   -6.0 ms  rising line #2 starts
OK  map 16.8000s  <- 16.8210s  err  +21.0 ms  landing #2: low cello + bass pizz D
OK  map 19.3750s  <- 19.3730s  err   -2.0 ms  third detail: thins to cello A pedal (+ harpsichord A2 / E5 figure)
OK  map 19.8750s  <- 19.8730s  err   -2.0 ms  ring ting #3 (violin pizz A6)
OK  map 20.0000s  <- 19.9980s  err   -2.0 ms  1st violin pizz melody begins
OK  map 21.4750s  <- 21.4810s  err   +6.0 ms  landing #3: low cello + bass pizz G
OK  map 22.2000s  <- 22.1915s  err   -8.5 ms  gentle lift (swell into bar 10)
OK  map 23.7500s  <- 23.7470s  err   -3.0 ms  harpsichord descending run starts
OK  map 26.2500s  <- 26.2616s  err  +11.6 ms  FIRST BOWED NOTE: strings enter pp on D (cellos/violas/violins)
OK  map 31.2500s  <- 31.2520s  err   +2.0 ms  perfect cadence V-I: tonic D lands (harpsichord roll + bass pizz + bowed D)
OK  map 33.7500s  <- 33.7490s  err   -1.0 ms  wink: soft violin pizz D6
OK  map 35.6250s  <- 35.6270s  err   +2.0 ms  end card: soft harpsichord tonic, fade begins

Silence 0.0–1.87 s: peak -240.0 dBFS
Silence 25.0–26.25 s: peak -240.0 dBFS  (25.3–26.25: -240.0)
Pickup ring 2.0–2.18 s: peak -31.6 dBFS; 2.3–2.49 s: peak -28.7 dBFS
Tail 39.0–40.0 s: peak -240.0 dBFS
Bowed stem silent before 26.25: peak -162.1 dBFS; first bowed sample above -100 dB at 26.2616 s
Bowed stem reaches -50 dBFS at 26.4148 s, -40 dBFS at 26.5168 s
Per-bar RMS (dBFS): b1:-35 b2:-20 b3:-21 b4:-19 b5:-21 b6:-23 b7:-20 b8:-22 b9:-20 b10:-19 b11:-36 b12:-24 b13:-20 b14:-21 b15:-25 b16:-74
Mix: 40.000 s, 2 ch, 48000 Hz, peak -1.20 dBFS, integrated -18.0 LUFS

ALL CUES WITHIN TOLERANCE
```

The full per-accent list, including the extra accents at 12.5875 and 24.8438, is in `timing_report.txt`.
