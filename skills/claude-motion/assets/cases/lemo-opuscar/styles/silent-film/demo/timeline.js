// The Runaway Loaf (v2, tightened) — tempo grid: single source of truth for picture, score, mix and cue check.
// Photoplay cue-sheet sections. Every section starts on the previous one's end; beats are in that section's tempo.
export const FPS = 24;

// [name, bpm, beats, cue-sheet mood]
const SECS = [
  ['PRE',     96, 2.5, 'projector starts, curtains part (no music)'],
  ['TITLE',   96, 6,   'Maestoso (main title)'],
  ['BAKERY',  96, 10,  'Andante (the Loaf theme, proud)'],
  ['CARD1',   96, 4.5, 'comic "uh-oh" + accelerando pickup'],
  ['CHASE',  144, 12,  'Hurry (octave runs)'],
  ['MARKET', 144, 16,  'Hurry, stop-time for the chain gag'],
  ['CARD2',  144, 6,   'tremolo shout'],
  ['ROLL',    88, 6,   'ritardando (the last roll)'],
  ['SIL',     60, 2,   'SILENCE (projector only)'],
  ['CARD3',   72, 3.5, 'reed organ enters pp'],
  ['TENDER',  72, 10,  'Tenderly (the Loaf theme, slow)'],
  ['IRIS',    72, 4,   'iris closes; the wink'],
  ['END',     72, 6,   'finale chord + runout, curtains close'],
];

export const SEC = {};
let t = 0;
for (const [name, bpm, beats, mood] of SECS) {
  const beat = 60 / bpm, dur = beat * beats;
  SEC[name] = { name, bpm, beats, beat, t0: t, t1: t + dur, dur, mood };
  t += dur;
}
export const DUR = +t.toFixed(4);
export const at = (name, b = 0) => SEC[name].t0 + b * SEC[name].beat;   // time of beat b in a section
export const secAt = tt => { for (const k in SEC) if (tt < SEC[k].t1) return SEC[k]; return SEC.END; };

// Named hits: the picture lands on these, the score writes to them (cuecheck compares them).
export const HIT = {
  curtain:    at('PRE', .5),
  title:      at('TITLE', 0),
  irisOpen:   at('BAKERY', 0),
  lift:       at('BAKERY', 1),       // loaf goes up (pride)
  sill:       at('BAKERY', 5),       // loaf set down on the sill
  pat:        at('BAKERY', 6),
  wobble:     at('BAKERY', 7),
  fall:       at('BAKERY', 8),       // rolls off the sill
  bounce:     at('BAKERY', 8.5),
  take:       at('BAKERY', 9),       // double take
  card1:      at('CARD1', 0),
  chase:      at('CHASE', 0),
  grab:       at('CHASE', 6),        // reaches for it — the loaf hops over a cobble
  miss:       at('CHASE', 7),        // looks at his empty hand
  market:     at('MARKET', 0),
  plank:      at('MARKET', 5),       // foot on the see-saw → melon launched
  copIn:      at('MARKET', 8),
  copLook:    at('MARKET', 10),
  melonDown:  at('MARKET', 12),      // the melon lands on the constable
  card2:      at('CARD2', 0),
  roll:       at('ROLL', 0),
  stop:       at('ROLL', 5),         // loaf stops against her shoe
  silence:    at('SIL', 0),
  card3:      at('CARD3', 0),
  tender:     at('TENDER', 0),
  kneel:      at('TENDER', 3),
  crack:      at('TENDER', 5),       // the loaf breaks in two
  give:       at('TENDER', 6),
  herLift:    at('TENDER', 7),       // she lifts her half high (echo of the opening)
  hisLift:    at('TENDER', 8),
  irisClose:  at('IRIS', 0),
  wink:       at('IRIS', 2.5),
  end:        at('END', 0),
  curtainOut: at('END', 4.2),
};

// Intertitles: [section, spec key]
export const CARDS_AT = [['TITLE', 'title'], ['CARD1', 'c1'], ['CARD2', 'c2'], ['CARD3', 'c3'], ['END', 'end']];
