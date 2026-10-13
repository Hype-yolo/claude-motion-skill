// Web Worker entry: builds one individual (or one meshing job of it) off the main thread.
// Messages: { task: 'mesh', species, opts, job } -> { type: 'mesh', parts }
//           { task: 'finish', species, opts, jobs } -> { type: 'done', data }
//           { task: 'all', species, opts } -> { type: 'done', data }
import { loadSpecies } from './registry.js';
import { prepare, meshJob, finish, buildSync, transferables } from './core/build/pipeline.js';
import { regionTransferables } from './core/build/mesh.js';

self.onmessage = async (e) => {
  const m = e.data || {};
  try {
    const species = await loadSpecies(m.species);
    const t0 = performance.now();
    const progress = (msg) => self.postMessage({ type: 'progress', msg, t: performance.now() - t0 });
    if (m.task === 'mesh') {
      const parts = meshJob(species, m.opts, m.job);
      self.postMessage({ type: 'mesh', job: m.job, parts }, regionTransferables(parts));
    } else if (m.task === 'finish') {
      const prep = prepare(species, m.opts);
      const out = finish(species, m.opts, m.jobs, prep, progress);
      self.postMessage({ type: 'done', data: out }, transferables(out));
    } else {
      const out = buildSync(species, m.opts, progress);
      self.postMessage({ type: 'done', data: out }, transferables(out));
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err && err.stack) || err) });
  }
};
