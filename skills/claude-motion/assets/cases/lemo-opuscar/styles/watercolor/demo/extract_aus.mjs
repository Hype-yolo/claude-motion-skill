// 生成 aus.js（澳洲大陆 + 塔斯马尼亚两条海岸线环）：node extract_aus.mjs
// 依赖已内置 vendor/：topojson-client 3.1.0（ISC）+ world-atlas 2.0.2 countries-50m.json（Natural Earth，ISC/公有领域）
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const OUTF = path.resolve(process.env.OUT || path.join(path.dirname(fileURLToPath(import.meta.url)), 'aus.js'));
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const { feature } = createRequire(import.meta.url)('./vendor/topojson-client.min.cjs');
const topo = JSON.parse(fs.readFileSync('vendor/countries-50m.json'));
const f = feature(topo, topo.objects.countries).features.find(f => f.properties.name === 'Australia');
const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
const rings = polys.map(p => p[0]).map(r => ({ n: r.length, area: Math.abs(r.reduce((s, [x, y], i) => { const [x2, y2] = r[(i + 1) % r.length]; return s + x * y2 - x2 * y; }, 0) / 2), r }));
rings.sort((a, b) => b.area - a.area);
console.log(rings.slice(0, 5).map(r => [r.n, r.area.toFixed(1)]));
const keep = rings.slice(0, 2).map(r => r.r.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]));
fs.writeFileSync(OUTF, 'window.AUS=' + JSON.stringify(keep) + ';\n');
