// Export subtitle cues (for .srt) straight from the film's timeline: node tools/cues.mjs [content.json] > cues.json
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const D = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const film = await import(path.join(D, 'film.js'));
const C = JSON.parse(fs.readFileSync(path.join(D, process.argv[2] || 'content.json')));
let durs = {}; try { durs = JSON.parse(fs.readFileSync(path.join(D, 'voices/dur.json'))); } catch (e) {}
film.setup(C, durs);
console.log(JSON.stringify(film.srtCues(), null, 1));
