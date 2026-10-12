#!/usr/bin/env node
import {readFile,access} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import{fileURLToPath}from'node:url';import path from'node:path';import{createHash}from'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),val=k=>args[args.indexOf(k)+1];const catalog=JSON.parse(await readFile(path.join(root,'references/extension-catalog.json'),'utf8'));
if(args.includes('--list')){console.log(JSON.stringify(catalog,null,2));process.exit(0)}
const item=catalog.extensions.find(e=>e.id===val('--extension'));if(!item||!args.includes('--out'))throw Error('Usage: create-extension.mjs --extension ID --out NEW_DIRECTORY');const out=path.resolve(val('--out'));try{await access(out);throw Error('Output exists; choose a new directory')}catch(e){if(e.code!=='ENOENT')throw e}
for(const f of item.files){const p=path.resolve(root,item.path,f.path);if(!p.startsWith(path.resolve(root,item.path)+path.sep))throw Error('Path outside component');const b=await readFile(p);if(createHash('sha256').update(b).digest('hex')!==f.sha256)throw Error('Component changed '+f.path)}
const result=spawnSync(process.execPath,[path.join(root,item.createScript),'--out',out],{stdio:'inherit'});if(result.status!==0)throw Error('Creator failed');
console.log(JSON.stringify({id:item.id,out,edit:item.edit,render:item.renderCommand.replaceAll('<skill>',root).replaceAll('<out>',out),boundary:item.boundary},null,2));
