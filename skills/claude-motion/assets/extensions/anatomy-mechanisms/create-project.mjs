#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {access,mkdir,cp} from 'node:fs/promises';
const args=process.argv.slice(2),i=args.indexOf('--out');
if(i<0||!args[i+1])throw Error('Usage: create-project.mjs --out NEW_DIRECTORY');
const out=path.resolve(args[i+1]),here=path.dirname(fileURLToPath(import.meta.url));
try{await access(out);throw Error('Output already exists')}catch(e){if(e.code!=='ENOENT')throw e}
await mkdir(out,{recursive:true});
await cp(path.join(here,'examples','anemograph'),out,{recursive:true});
for(const f of ['mechanisms.js','vendor','LICENSE.anatomy','SOURCE.json'])await cp(path.join(here,f),path.join(out,f),{recursive:true});
console.log(JSON.stringify({out,edit:'scene.js',render:'node <skill>/scripts/render.mjs --root '+out+' --out '+out+'/film.mp4 --fps 24'}));
