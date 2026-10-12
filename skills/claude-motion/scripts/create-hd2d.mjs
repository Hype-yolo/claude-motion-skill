#!/usr/bin/env node
// Build a self-contained native WebGL project; upstream files remain byte-identical.
import {readFile,writeFile,mkdir,cp,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),idx=args.indexOf('--out');
if(idx<0||!args[idx+1])throw Error('Usage: node create-hd2d.mjs --out <new directory>');
const out=path.resolve(args[idx+1]);
try{await access(out);throw Error('Output already exists. Choose a new directory.');}catch(e){if(e.code!=='ENOENT')throw e;}
const upstream=path.join(skill,'assets/cases/lemo-opuscar');
await access(path.join(skill,'node_modules/three/build/three.module.js'));
await mkdir(out,{recursive:true});await cp(path.join(skill,'assets/engines/hd2d'),out,{recursive:true});
const files=[];await mkdir(path.join(out,'engine/upstream'),{recursive:true});
for(const name of ['px.js','kit.js','fx.js','chars.js','post_ts.js']){
 const source='styles/hd-2d/demo/'+name,b=await readFile(path.join(upstream,source));
 await writeFile(path.join(out,'engine/upstream',name),b);
 files.push({path:'engine/upstream/'+name,source,sha256:createHash('sha256').update(b).digest('hex')});
}
await mkdir(path.join(out,'licenses'),{recursive:true});
await cp(path.join(upstream,'LICENSE'),path.join(out,'licenses/lemo-opuscar-MIT.txt'));
await cp(path.join(skill,'node_modules/three/LICENSE'),path.join(out,'licenses/three-MIT.txt'));
for(const dir of ['build','examples/jsm'])await cp(path.join(skill,'node_modules/three',dir),path.join(out,'vendor/three',dir),{recursive:true});
const cat=JSON.parse(await readFile(path.join(skill,'references/case-catalog.json'),'utf8'));
await writeFile(path.join(out,'ENGINE-INPUT.json'),JSON.stringify({case:'lemo-hd-2d',source:cat.cases.find(c=>c.id==='lemo-hd-2d').source,three:'0.170.0',files,adaptation:'New scene, procedural tram and passenger. Uses original PX/atlas/billboard, world UV/material/house and DOF/bloom shaders. Does not import the original story, sets, character drawings or music.'},null,2)+'\n');
console.log(JSON.stringify({out,entry:path.join(out,'index.html'),render:`node ${path.join(skill,'scripts/render.mjs')} --root ${out} --page index.html --out ${out}/film.mp4`,note:'Starter is the last-tram example. Write new story/scene; do not relabel this example as a new film.'},null,2));
