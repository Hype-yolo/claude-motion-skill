// Tempo grid + cue times: single source of truth for picture, score, mix and checks.
export const BPM = 100, BEAT = 0.6, BAR = 2.4, BPM2 = 80, BEAT2 = 0.75;
export const TL = {
  SNAP: 1.5, LAND: 2.4, ZERO_LAB: 2.7, PULL0: 3.6, BASKET: 6.6, PULL1: 7.2,
  TITLE0: 5.4, TITLE1: 8.1, HARV_LAB: 8.1, INSET0: 8.4, KNIFE: 9.0, CUT: 9.3, INSET1: 10.8,
  DESC0: 10.8, DRY0: 12.0, DRY1: 15.15, SACK_POUR: 14.4, SACK: 15.0,
  TRUCK0: 15.6, TRUCK_GO: 16.2, JCUT_PORT: 17.4, PORT0: 18.0, DOOR: 18.3, LIFT: 18.3, LOAD0: 19.2, SHIP_LAB: 19.8, CASCADE: 21.6, DEPART: 22.2,
  SEA0: 22.8, FF0: 25.2, DIVE0: 27.6, HULL: 27.9, BOX_CUT: 28.8, SACK_CUT: 29.4, SIL0: 30.0, RING: 30.3, HORN: 33.6, ARRIVE: 34.8, UNLOAD: 34.8, TRUCK_B: 35.4,
  ROAST0: 36.0, WALL: 36.3, POUR: 36.6, CRACK0: 38.4, CRACK1: 39.6, COOL: 39.6, BIKE: 40.5,
  CAFE0: 40.8, ROOF: 41.1, HOPPER: 41.4, GRIND: 42.6, TAMP: 43.8, LOCK: 44.2, MACHINE: 44.4, SIL2: 45.3, DROP: 45.9, SLIDE: 47.4, CLINK: 48.15, PUSH: 48.9, HAND: 49.65,
  FULL0: 51.9, FULL1: 54.9, CARD: 54.9, END: 58.8,
};
// 100 BPM grid runs 0 → 43.8 (TAMP); ritardando 43.8 → 45.3; silence 45.3 → 45.9; 80 BPM from 45.9 (DROP).
// the dive: first level slower, the next two faster (a falling acceleration)
TL.DIVE = [TL.DIVE0, TL.HULL, 28.8, 29.4, 30.0];
// 16th-note cues
TL.SUNS = [...Array(21)].map((_, i) => +(TL.DRY0 + i * .15).toFixed(3));           // 12.00 … 15.00
TL.DAYS = [...Array(18)].map((_, i) => +(TL.FF0 + i * .15).toFixed(3));            // 25.20 … 27.75
TL.RAKES = [12.0, 12.6, 13.2, 13.8];
TL.CRACKS = [38.4, 38.55, 38.85, 39.0, 39.15, 39.3, 39.45, 39.6];                  // syncopated sixteenths
TL.DECK_CRANE = [19.8, 20.4, 21.0], TL.DECK_EIGHTH = [21.3, 21.6];
TL.TITLE_WORDS = [5.4, 5.7, 6.0, 6.3];
TL.FULL_STATIONS = [...Array(7)].map((_, i) => +(TL.FULL0 + .75 + i * .375).toFixed(3));   // 52.65 … 54.9: one kalimba note per station (8ths @80) as the route lights up
// subtitle hold = max(1.8 s, speech + 0.6 s); t0 = voice start
export const SUBS = [
  { id: 'L1', t0: 2.55, t1: 5.2, text: 'How far did your coffee travel?' },
  { id: 'L2', t0: 8.4, t1: 12.6, text: 'It began as a cherry on a hillside, with two seeds inside.' },
  { id: 'L3', t0: 12.9, t1: 17.05, text: 'Dried in the sun, then packed with four hundred thousand others.' },
  { id: 'L4', t0: 23.4, t1: 25.7, text: 'Eighteen days at sea.' },
  { id: 'L5', t0: 30.9, t1: 33.55, text: 'Somewhere in here is yours.' },
  { id: 'L6', t0: 49.9, t1: 54.4, text: 'Eleven thousand kilometres, from one pair of hands to yours.' },
];
// numbers on the map (must add up): 400 + 10,500 + 100 = 11,000 km
export const KM = { farm: 400, sea: 10500, city: 100, total: 11000 };
