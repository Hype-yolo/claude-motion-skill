// A rendered plan of the city, drawn once: streets, blocks, buildings shaded by height, the harbour.
// The minimap crops and rotates it every frame; the full map screen draws it with markers on top.
import { CITY, SEEDS } from '../city/layout.js';

export const MAP = { extent: 1900, size: 2048 };
export const toMap = (v) => ((v + MAP.extent) / (MAP.extent * 2)) * MAP.size;

export function drawCityMap(city) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = MAP.size;
  const g = cv.getContext('2d');
  const k = MAP.size / (MAP.extent * 2);
  g.fillStyle = '#07080f';
  g.fillRect(0, 0, MAP.size, MAP.size);
  // harbour
  g.fillStyle = '#04101a';
  g.fillRect(0, toMap(CITY.harbourZ), MAP.size, toMap(CITY.farShoreZ) - toMap(CITY.harbourZ));
  // streets as light bands
  g.fillStyle = '#1b2233';
  for (const l of city.xs) g.fillRect(toMap(l.p - l.w / 2), toMap(-CITY.half), l.w * k, (CITY.harbourZ + CITY.half) * k);
  for (const l of city.zs) g.fillRect(toMap(-CITY.half), toMap(l.p - l.w / 2), CITY.half * 2 * k, l.w * k);
  // pavements
  g.fillStyle = '#10141f';
  for (const b of city.blocks) g.fillRect(toMap(b.x0), toMap(b.z0), (b.x1 - b.x0) * k, (b.z1 - b.z0) * k);
  // buildings: brighter for taller
  for (const b of [...city.outer, ...city.buildings]) {
    const h = Math.min(1, b.h / 420);
    const v = Math.round(22 + h * 70);
    g.fillStyle = b.outer ? `rgb(${v * 0.5},${v * 0.52},${v * 0.6})` : `rgb(${v * 0.62},${v * 0.68},${v * 0.86})`;
    for (const t of b.tiers) if (!t.feat || t.y0 < 1) g.fillRect(toMap(t.x0), toMap(t.z0), Math.max(1, (t.x1 - t.x0) * k), Math.max(1, (t.z1 - t.z0) * k));
  }
  // the Zenith
  g.fillStyle = '#ff3df2';
  g.beginPath();
  g.arc(toMap(CITY.zenith.x), toMap(CITY.zenith.z), 6, 0, Math.PI * 2);
  g.fill();
  return cv;
}

export function districtLabels() {
  return SEEDS.map((s) => ({ x: s.x, z: s.z, zh: s.zh, en: s.en }));
}
