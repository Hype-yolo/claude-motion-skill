// Builds an individual's data: in Web Workers when possible (meshing jobs in parallel, then
// weights + coat), otherwise on the calling thread. Results are cached per (species, seed, quality,
// sex, age) so a herd that reuses individuals shares geometry.
import { buildSync, normaliseOptions } from './core/build/pipeline.js';
import { loadSpecies } from './registry.js';

let defaultWorkerFactory = null;
export function setWorkerFactory(fn) { defaultWorkerFactory = fn; }

function makeWorker(opt) {
  if (opt === false) return null;
  try {
    if (typeof opt === 'function') return opt();
    if (defaultWorkerFactory) return defaultWorkerFactory();
    if (typeof Worker === 'undefined') return null;
    return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  } catch (e) {
    return null;
  }
}

const cache = new Map();
export function cacheKey(speciesId, opts) {
  const o = normaliseOptions(opts);
  return [speciesId, o.seed, o.quality, o.sex || '', o.age || '', o.variant || '', JSON.stringify(o.overrides)].join('|');
}

export async function buildAnimalData(species, opts = {}, onProgress = () => {}) {
  const s = await loadSpecies(species);
  const key = cacheKey(s.id, opts);
  if (cache.has(key)) return cache.get(key);
  const p = buildInWorkers(s, opts, onProgress).catch((e) => { cache.delete(key); throw e; });
  cache.set(key, p);
  return p;
}
export function clearBuildCache() { cache.clear(); }

async function buildInWorkers(species, opts, onProgress) {
  const o = normaliseOptions(opts);
  const nJobs = species.regions ? null : 1;
  void nJobs;
  const first = makeWorker(opts.worker);
  if (!first) {
    await new Promise((r) => setTimeout(r, 0));
    return buildSync(species, o, onProgress);
  }
  const t0 = performance.now();
  // how many meshing jobs? (cheap: prepare runs the sculpt only)
  const { prepare } = await import('./core/build/pipeline.js');
  const jobsN = prepare(species, o).reg.jobs.length;
  const workers = [first];
  for (let i = 1; i < jobsN; i++) { const w = makeWorker(opts.worker); if (w) workers.push(w); }
  const call = (w, msg) => new Promise((resolve, reject) => {
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') onProgress(m.msg);
      else if (m.type === 'error') reject(new Error(m.message));
      else resolve(m);
    };
    w.onerror = (e) => reject(new Error(e.message || 'procedural-animals worker failed'));
    w.postMessage(msg);
  });
  try {
    const jobs = new Array(jobsN);
    let next = 0;
    await Promise.all(workers.map(async (w) => {
      while (next < jobsN) {
        const j = next++;
        onProgress('mesh ' + j);
        const r = await call(w, { task: 'mesh', species: species.id, opts: o, job: j });
        jobs[j] = r.parts;
      }
    }));
    onProgress('finish');
    const r = await call(first, { task: 'finish', species: species.id, opts: o, jobs });
    r.data.stats.buildMs = Math.round(performance.now() - t0);
    return r.data;
  } finally {
    for (const w of workers) w.terminate();
  }
}
