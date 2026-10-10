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
 if(c.preview.localPath){await access(path.join(root,c.preview.localPath));previews++;}
}
if(cat.caseCount!==ids.size)throw Error('Catalog count mismatch');
for(const pack of ['lemo-opuscar','reelmimic']){
 const base='assets/cases/'+pack;
 const manifest=JSON.parse(await read(base+'/IMPORT.json'));
 for(const f of manifest.files){
  const data=await readFile(path.join(root,base,f.path));
  if(createHash('sha256').update(data).digest('hex')!==f.sha256)throw Error('Upstream hash mismatch: '+pack+'/'+f.path);checked++;
 }
}
for(const f of ['LICENSE','THIRD_PARTY_NOTICES.md','assets/examples/rumor/scene.js','references/installation.md'])await access(path.join(root,f));
console.log(JSON.stringify({cases:ids.size,packagedPreviews:previews,upstreamFilesVerified:checked,status:'passed',boundary:'File integrity and availability; not visual quality or full-case runtime verification.'},null,2));
