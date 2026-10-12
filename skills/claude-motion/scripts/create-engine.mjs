#!/usr/bin/env node
import{readFile,writeFile,mkdir,cp,access,readdir}from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),a=process.argv.slice(2),opt=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
const cat=JSON.parse(await readFile(path.join(skill,'references/engine-catalog.json'),'utf8'));
if(a.includes('--list')){console.log(JSON.stringify(cat,null,2));process.exit(0)}
const engine=cat.engines.find(e=>e.id===opt('--engine'));if(!engine||!opt('--out'))throw Error('Usage: create-engine.mjs --engine hd2d|papercut|handdrawn|glass|swiss --out NEW_DIR [--example NAME]');
if(engine.rejectedExamples?.includes(opt('--example')||engine.examples[0])&&!a.includes('--allow-rejected'))throw Error('This example was rejected for visual quality. Use create-model.mjs for revised objects, or explicitly use --allow-rejected for archival reproduction.');
if(engine.id==='handdrawn')console.error('Character-fit warning: Clawd is reused. It is not proof of Claude style; design or choose the character for this story.');
const example=opt('--example')||engine.examples[0];if(!engine.examples.includes(example))throw Error('Unknown example for this engine');const out=path.resolve(opt('--out'));try{await access(out);throw Error('Output exists; choose a new directory')}catch(e){if(e.code!=='ENOENT')throw e}
const deps=engine.id==='handdrawn'?['p5/lib/p5.min.js','p5.brush/dist/p5.brush.js']:['hd2d','glass'].includes(engine.id)?['three/build/three.module.js']:[];for(const f of deps)await access(path.join(skill,'node_modules',f));
await cp(path.join(skill,engine.template,example),out,{recursive:true});
if(engine.id==='handdrawn'){await mkdir(path.join(out,'vendor'),{recursive:true});await cp(path.join(skill,'node_modules/p5/lib/p5.min.js'),path.join(out,'vendor/p5.min.js'));await cp(path.join(skill,'node_modules/p5.brush/dist/p5.brush.js'),path.join(out,'vendor/p5.brush.js'));}
if(['hd2d','glass'].includes(engine.id))for(const d of ['build','examples/jsm'])await cp(path.join(skill,'node_modules/three',d),path.join(out,'vendor/three',d),{recursive:true});
// Snapshot actual delivered authoring inputs; does not copy a previous film's verification as new proof.
const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(e.name==='vendor')continue;const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else files.push({path:path.relative(out,p),sha256:createHash('sha256').update(await readFile(p)).digest('hex')})}}await walk(out);
await writeFile(path.join(out,'STARTER.json'),JSON.stringify({engine:engine.id,example,files,note:'Editable example, not an automatically generated new story. Write the new subject, actions and shots; re-render and verify. No prior film approval is inherited.'},null,2)+'\n');
console.log(JSON.stringify({out,engine:engine.id,example,render:`node ${path.join(skill,'scripts/render.mjs')} --root "${out}" ${engine.nativePage?'--page index.html ':''}--out "${path.join(out,'film.mp4')}"`,guide:path.join(skill,engine.guide)},null,2));
