#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {cp,mkdir,access} from 'node:fs/promises';
const args=process.argv.slice(2),i=args.indexOf('--out');
if(i<0||!args[i+1])throw Error('Usage: node create-project.mjs --out <new-directory>');
const dst=path.resolve(args[i+1]);
try{await access(dst);throw Error('Output already exists: choose a new directory.');}catch(e){if(e.code!=='ENOENT')throw e;}
const here=path.dirname(fileURLToPath(import.meta.url));
await mkdir(dst,{recursive:true});
await cp(path.join(here,'examples','otter-windsock'),dst,{recursive:true});
await cp(path.join(here,'crayon.js'),path.join(dst,'crayon.js'));
await cp(path.join(here,'LICENSE'),path.join(dst,'LICENSE.songbie'));
await cp(path.join(here,'SOURCE.json'),path.join(dst,'SOURCE.json'));
console.log(dst);
