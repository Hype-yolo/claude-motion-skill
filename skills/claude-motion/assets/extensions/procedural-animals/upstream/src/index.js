// procedural-animals: three.js Procedural Animals.
//
//   const wolf = await createAnimal('wolf', { seed: 3, quality: 'high', ground: (x, z) => h(x, z) });
//   scene.add(wolf.object);
//   wolf.move({ speed: 6, heading });   // or wolf.follow(body.position, body.velocity)
//   wolf.update(dt);                     // every frame
import { Animal } from './animal.js';
import { buildAnimalData } from './build.js';
import { loadSpecies } from './registry.js';
import { readBake } from './bake.js';

export { Animal } from './animal.js';
export { registerSpecies, listSpecies, loadSpecies, addLoader } from './registry.js';
export { buildAnimalData, setWorkerFactory, clearBuildCache } from './build.js';
export { QUALITY } from './core/build/pipeline.js';
export { writeBake, readBake } from './bake.js';

/**
 * Create an animal. Builds it procedurally (in Web Workers when available) or loads a baked file.
 * @param {string|object} species  species id ('wolf') or an imported species module
 * @param {object} opts  { seed, quality, sex, age, ground, water, position, heading, baked, worker, onProgress }
 */
export async function createAnimal(species, opts = {}) {
  const s = await loadSpecies(species);
  let data;
  if (opts.baked) data = readBake(opts.baked instanceof ArrayBuffer ? opts.baked : await opts.baked);
  else data = await buildAnimalData(s, opts, opts.onProgress);
  return new Animal(s, data, opts);
}
