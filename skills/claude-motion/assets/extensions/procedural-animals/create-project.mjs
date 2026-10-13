#!/usr/bin/env node
import {fileURLToPath} from 'node:url';import path from 'node:path';import{cp,mkdir,access}from'node:fs/promises';
const a=process.argv.slice(2),i=a.indexOf('--out');if(i<0||!a[i+1])throw Error('Usage: node create-project.mjs --out <new-directory>');
const out=path.resolve(a[i+1]),here=path.dirname(fileURLToPath(import.meta.url));try{await access(out);throw Error('Output already exists');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(out,{recursive:true});await cp(path.join(here,'examples/fox-creek'),out,{recursive:true});for(const n of ['upstream','vendor','procedural-animals.js','LICENSE','SOURCE.json'])await cp(path.join(here,n),path.join(out,n),{recursive:true});console.log(JSON.stringify({out,render:`MOTION_PLAYWRIGHT_MODULE=<playwright-index.mjs> node ${out}/render.mjs --root ${out} --page index.html --out ${out}/film.mp4 --fps 24`}));
