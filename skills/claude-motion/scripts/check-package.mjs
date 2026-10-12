import {readFile, access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>readFile(path.join(root,rel),'utf8');
const cat=JSON.parse(await read('references/case-catalog.json'));
let checked=0,previews=0;const ids=new Set();
for(const c of cat.cases){
 if(ids.has(c.id))throw Error('Duplicate case '+c.id);ids.add(c.id);
 for(const rel of Object.values(c.paths)){
  const absolute=path.resolve(root,rel);if(!absolute.startsWith(root+path.sep))throw Error('Path outside package');await access(absolute);
 }
 if(c.productionEngine){for(const key of ["createScript","guide","template","preview","verification"])await access(path.join(root,c.productionEngine[key]));}
 if(c.preview.localPath){await access(path.join(root,c.preview.localPath));previews++;}
}
if(cat.caseCount!==ids.size)throw Error('Catalog count mismatch');
for(const pack of ['lemo-opuscar','reelmimic','animate']){
 const base='assets/cases/'+pack;
 const manifest=JSON.parse(await read(base+'/IMPORT.json'));
 for(const f of manifest.files){
  const data=await readFile(path.join(root,base,f.path));
  if(createHash('sha256').update(data).digest('hex')!==f.sha256)throw Error('Upstream hash mismatch: '+pack+'/'+f.path);checked++;
 }
}
const engines=JSON.parse(await read('references/engine-catalog.json')).engines;
for(const e of engines){for(const key of ['createScript','verifyScript','guide','template','preview'])await access(path.join(root,e[key]));for(const example of e.examples){const base=path.join(root,e.template,example),m=JSON.parse(await readFile(path.join(base,'ENGINE-INPUT.json'),'utf8'));for(const f of m.files){const hash=createHash('sha256').update(await readFile(path.join(base,f.path))).digest('hex');if(hash!==f.sha256)throw Error('Engine source hash mismatch '+e.id+'/'+f.path)}}}
const models=JSON.parse(await read('references/model-catalog.json')).models;
for(const m of models){for(const f of m.files){const data=await readFile(path.join(root,m.path,f.path));if(createHash('sha256').update(data).digest('hex')!==f.sha256)throw Error('Model integrity mismatch '+m.id+'/'+f.path)}}
const scenes=JSON.parse(await read('references/scene-catalog.json')).scenes;
for(const e of scenes){await access(path.join(root,e.preview));for(const f of e.files){const data=await readFile(path.join(root,e.path,f.path));if(createHash('sha256').update(data).digest('hex')!==f.sha256)throw Error('Scene integrity mismatch '+e.id+'/'+f.path)}}
const extensions=JSON.parse(await read('references/extension-catalog.json')).extensions;
for(const e of extensions){for(const k of ['createScript','guide','preview'])await access(path.join(root,e[k]));for(const f of e.files){const b=await readFile(path.join(root,e.path,f.path));if(createHash('sha256').update(b).digest('hex')!==f.sha256)throw Error('Extension integrity mismatch '+e.id+'/'+f.path)}}
for(const f of ['LICENSE','THIRD_PARTY_NOTICES.md','assets/examples/rumor/scene.js','references/installation.md','references/how-it-works.md'])await access(path.join(root,f));
console.log(JSON.stringify({cases:ids.size,sourceExtensions:extensions.length,extensionFilesVerified:extensions.reduce((n,e)=>n+e.files.length,0),concreteModels:models.length,sceneStarters:scenes.length,productionEngines:engines.length,productionExamples:engines.reduce((n,e)=>n+e.examples.length,0),packagedPreviews:previews,upstreamFilesVerified:checked,status:'passed',boundary:'File integrity and availability; not visual quality or full-case runtime verification.'},null,2));
