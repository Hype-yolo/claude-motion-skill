import {readFile,mkdir,readdir,writeFile,lstat,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2), value=k=>args[args.indexOf(k)+1];
if(!args.includes('--case')||!args.includes('--out')){
 console.error('Usage: node prepare-case.mjs --case <id[,id]> --out <directory>');process.exit(1);
}
const ids=value('--case').split(','),out=path.resolve(value('--out'));
const cat=JSON.parse(await readFile(path.join(skill,'references/case-catalog.json'),'utf8'));
const cases=ids.map(id=>{const c=cat.cases.find(x=>x.id===id);if(!c)throw Error('Unknown case: '+id);return c;});
const tasks=new Map();
const hash=b=>createHash('sha256').update(b).digest('hex');
async function addTree(src,dest){
 const s=await lstat(src);if(s.isSymbolicLink())throw Error('Symlink not allowed: '+src);
 if(s.isDirectory()){for(const e of await readdir(src))await addTree(path.join(src,e),path.join(dest,e));}
 else if(s.isFile()){
  const b=await readFile(src),prev=tasks.get(dest);
  if(prev&&!prev.bytes.equals(b))throw Error('Selected cases have conflicting dependencies: '+dest);
  tasks.set(dest,{bytes:b,source:path.relative(skill,src),sha256:hash(b)});
 }
}
for(const c of cases){
 const root=path.resolve(skill,c.paths.packageRoot),slug=c.style.slug;
 if(!root.startsWith(skill+path.sep)||!/^[a-z0-9-]+$/.test(slug))throw Error('Invalid catalog path');
 if(c.copyFiles){
  // Non-Lemo packages retain their own namespace instead of sharing unrelated core/ files.
  for(const item of c.copyFiles){
   const src=path.resolve(root,item.from),dest=path.resolve(out,item.to);
   if(!src.startsWith(root+path.sep)||!dest.startsWith(out+path.sep))throw Error('Invalid copy path');
   await addTree(src,path.relative(out,dest));
  }
 }else{
  await addTree(path.join(root,'styles',slug),path.join('styles',slug));
  await addTree(path.join(root,'core'),'core');
  await addTree(path.join(root,'LICENSE'),path.join('reference-licenses',c.source.repo.replaceAll('/','--')+'.txt'));
 }
}
// Preflight every conflict before writing files. Different sources may share core imports.
for(const [rel,v] of tasks){
 const dest=path.join(out,rel);
 try{const s=await lstat(dest);if(!s.isFile()||s.isSymbolicLink()||!(await readFile(dest)).equals(v.bytes))throw Error('Refusing to overwrite changed file: '+dest);}
 catch(e){if(e.code!=='ENOENT')throw e;}
}
const manifestPath=path.join(out,'REFERENCE-INPUT.json');
try{await access(manifestPath);throw Error('REFERENCE-INPUT.json already exists; use a fresh output directory.');}catch(e){if(e.code!=='ENOENT')throw e;}
for(const [rel,v] of tasks){const dest=path.join(out,rel);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,v.bytes);}
const manifest={createdAt:new Date().toISOString(),cases:cases.map(c=>({id:c.id,source:c.source,runtime:c.runtime})),files:[...tasks].map(([path,v])=>({path,source:v.source,sha256:v.sha256,bytes:v.bytes.length}))};
await mkdir(out,{recursive:true});await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({out,cases:ids,files:tasks.size,manifest:manifestPath,note:'Source only. Check runtime dependencies and missing assets before adapting.'},null,2));
