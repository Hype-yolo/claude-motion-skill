// Intertitle designs, keyed by timeline section. level: 0 = a shout (heavy rule), 1 = narration, 2 = tender (vines).
export const CARDS = {
  TITLE: { level: 1, lines: [{ text: 'The Runaway Loaf', font: 'Playfair Display SC', weight: 900, size: 112 }, { text: 'a photoplay in one reel', italic: true, size: 40, spacing: 2 }], gap: 1.35 },
  CARD1: { level: 1, lines: [{ text: 'The loaf', italic: true, size: 80 }, { text: 'had other plans.', italic: true, size: 80 }], gap: 1.3 },
  CARD2: { level: 0, shake: .35, lines: [{ text: 'STOP THAT', font: 'Playfair Display SC', weight: 900, size: 128 }, { text: 'BAKER!', font: 'Playfair Display SC', weight: 900, size: 150 }], gap: 1.12 },
  CARD3: { level: 2, lines: [{ text: '“Is it yours,', italic: true, size: 76 }, { text: 'mister?”', italic: true, size: 76 }], gap: 1.35 },
  END: { level: 2, dy: -10, lines: [
    { text: 'The End', font: 'Playfair Display SC', weight: 900, size: 104 },
    { text: 'The Runaway Loaf  ·  1920s Silent Film', italic: true, size: 34, spacing: 1 },
    { text: 'LEMO-OPUSCAR', font: 'Playfair Display SC', weight: 700, size: 30, spacing: 8 },
    { text: 'LemoLab × Claude Opus 5.5', size: 30 },
    { text: 'Piano: VSCO 2 CE upright  ·  Reed organ: FreePats  (CC0)', italic: true, size: 24 },
    { text: 'Fonts: Playfair Display, Old Standard TT (OFL)', italic: true, size: 24 },
  ], gap: 1.55 },
};
