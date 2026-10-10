// 风格试看：?look=1&cx=..&cy=..&z=..
import { arrivalField, compositor } from './engine.js';
import { buildWorld, W, H } from './world.js';
const q = new URLSearchParams(location.search);
const t0 = performance.now();
const world = buildWorld();
console.log('world', (performance.now() - t0) | 0, 'ms');
const gw = 640, gh = 360, arr = new Float32Array(gw * gh).fill(0);
const glc = document.createElement('canvas'); glc.width = 1920; glc.height = 1080;
const comp = compositor(glc, { ...world, arr, gw, gh });
const ctx = document.getElementById('c').getContext('2d');
window.DUR = 1;
window.render = t => { const cam = { cx: +(q.get('cx') ?? W / 2), cy: +(q.get('cy') ?? H / 2), z: +(q.get('z') ?? 1920 / W) }; comp(cam, 99); ctx.drawImage(glc, 0, 0); };
window.READY = true;
