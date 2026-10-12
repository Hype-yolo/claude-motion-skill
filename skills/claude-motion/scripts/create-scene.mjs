#!/usr/bin/env node
import{readFile,writeFile,cp,access}from'node:fs/promises';import{fileURLToPath}from'node:url';import path from'node:path';import{createHash}from'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),val=k=>args[args.indexOf(k)+1],cat=JSON.parse(await readFile(path.join(root,'references/scene-catalog.json'),'utf8'));
if(args.includes('--list')){console.log(JSON.stringify(cat,null,2));process.exit(0)}
const item=cat.scenes.find(e=>e.id===val('--scene'));if(!args.includes('--scene')||!item||!args.includes('--out'))throw Error('Usage: create-scene.mjs --scene ID --out NEW_DIR | --list');const out=path.resolve(val('--out'));try{await access(out);throw Error('Output exists; choose a new directory')}catch(e){if(e.code!=='ENOENT')throw e}
for(const f of item.files){const data=await readFile(path.join(root,item.path,f.path));if(createHash('sha256').update(data).digest('hex')!==f.sha256)throw Error('Template changed '+f.path)}
if(item.requiresThree)await access(path.join(root,'node_modules/three/build/three.module.js'));
await cp(path.join(root,item.path),out,{recursive:true});if(item.requiresThree)for(const d of ['build','examples/jsm'])await cp(path.join(root,'node_modules/three',d),path.join(out,'vendor/three',d),{recursive:true});
if(item.requiresThree)await cp(path.join(root,'node_modules/three/LICENSE'),path.join(out,'vendor/three/LICENSE'));
await writeFile(path.join(out,'SCENE.json'),JSON.stringify(item,null,2)+'\n');console.log(JSON.stringify({out,id:item.id,kind:item.kind,edit:item.edit,render:`node "${path.join(root,'scripts/render.mjs')}" --root "${out}" --page index.html --out "${path.join(out,'film.mp4')}"`,boundary:item.boundary},null,2));
