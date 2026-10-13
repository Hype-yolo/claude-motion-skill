// Species registry. String ids resolve through loaders (dynamic imports), so a bundler only pulls in
// the species a game actually asks for. Species modules can also be imported and registered
// directly: `import wolf from 'procedural-animals/species/wolf'; createAnimal(wolf, ...)`.
const loaders = {
  bear: () => import('./species/bear/index.js'),
  boar: () => import('./species/boar/index.js'),
  cat: () => import('./species/cat/index.js'),
  cheetah: () => import('./species/cheetah/index.js'),
  chicken: () => import('./species/chicken/index.js'),
  cow: () => import('./species/cow/index.js'),
  crow: () => import('./species/crow/index.js'),
  deer: () => import('./species/deer/index.js'),
  dog: () => import('./species/dog/index.js'),
  eagle: () => import('./species/eagle/index.js'),
  fish: () => import('./species/fish/index.js'),
  fox: () => import('./species/fox/index.js'),
  frog: () => import('./species/frog/index.js'),
  goat: () => import('./species/goat/index.js'),
  horse: () => import('./species/horse/index.js'),
  lion: () => import('./species/lion/index.js'),
  pig: () => import('./species/pig/index.js'),
  rabbit: () => import('./species/rabbit/index.js'),
  rat: () => import('./species/rat/index.js'),
  shark: () => import('./species/shark/index.js'),
  sheep: () => import('./species/sheep/index.js'),
  snake: () => import('./species/snake/index.js'),
  spider: () => import('./species/spider/index.js'),
  wolf: () => import('./species/wolf/index.js'),
};
const loaded = new Map();

export function registerSpecies(mod) {
  const s = mod.default || mod;
  loaded.set(s.id, s);
  return s;
}

export async function loadSpecies(id) {
  if (typeof id === 'object' && id) return registerSpecies(id);
  if (loaded.has(id)) return loaded.get(id);
  const l = loaders[id];
  if (!l) throw new Error(`procedural-animals: unknown species "${id}". Known: ${listSpecies().join(', ')}`);
  return registerSpecies(await l());
}

export function getLoadedSpecies(id) { return loaded.get(id); }
export function listSpecies() { return [...new Set([...Object.keys(loaders), ...loaded.keys()])]; }
export function addLoader(id, fn) { loaders[id] = fn; }
